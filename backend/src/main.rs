use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use chrono::{DateTime, Utc};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tower_http::cors::{Any, CorsLayer};

const CARRY_CAP: i64 = 100;
const VECTOR_UNIT_COST: i64 = 4;
const COST_GATTLER: i64 = 40;
const COST_BASIC_10: i64 = 5;
const COST_VECTOR_10: i64 = 25;
const IDLE_RATE_PER_MIN: f64 = 0.02;

#[derive(Clone)]
struct AppState {
    db: Arc<Mutex<Connection>>,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    ok: bool,
    service: &'static str,
}

#[derive(Debug, Serialize, Clone)]
struct PlayerRow {
    callsign: String,
    resources: i64,
    idle_credits: i64,
    weapon_kind: String,
    basic_rounds: i64,
    vector_rounds: i64,
    run_upgrade_level: i64,
    checkpoint: String,
    snapshot_distance: f64,
    snapshot_kills: i64,
    disconnected_at: Option<String>,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct PlayerResponse {
    player: PlayerRow,
    carry_units_used: i64,
    carry_cap: i64,
    pending_idle_credits: i64,
}

#[derive(Debug, Deserialize)]
struct CreatePlayer {
    callsign: String,
}

#[derive(Debug, Deserialize)]
struct LeaveBody {
    distance: f64,
    kills: i64,
}

#[derive(Debug, Deserialize)]
struct ConfigureBody {
    purse: String,
    weapon_kind: Option<String>,
    buy_basic: Option<i64>,
    buy_vector: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct RunEndBody {
    distance: f64,
    kills: i64,
    died: bool,
    upgrade_level: i64,
    basic_left: i64,
    vector_left: i64,
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    error: String,
}

#[derive(Debug)]
enum ApiError {
    BadRequest(String),
    NotFound(String),
    Conflict(String),
    Internal(String),
}

impl From<rusqlite::Error> for ApiError {
    fn from(e: rusqlite::Error) -> Self {
        ApiError::Internal(e.to_string())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, msg) = match self {
            ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
            ApiError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            ApiError::Conflict(m) => (StatusCode::CONFLICT, m),
            ApiError::Internal(m) => (StatusCode::INTERNAL_SERVER_ERROR, m),
        };
        (status, Json(ErrorBody { error: msg })).into_response()
    }
}

fn db_path() -> PathBuf {
    std::env::var("ESF_DATABASE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("./data/esf.db"))
}

fn init_db(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS players (
            callsign TEXT PRIMARY KEY,
            resources INTEGER NOT NULL DEFAULT 0,
            idle_credits INTEGER NOT NULL DEFAULT 0,
            weapon_kind TEXT NOT NULL DEFAULT 'cannon',
            basic_rounds INTEGER NOT NULL DEFAULT 30,
            vector_rounds INTEGER NOT NULL DEFAULT 0,
            run_upgrade_level INTEGER NOT NULL DEFAULT 0,
            checkpoint TEXT NOT NULL DEFAULT 'start',
            snapshot_distance REAL NOT NULL DEFAULT 0,
            snapshot_kills INTEGER NOT NULL DEFAULT 0,
            disconnected_at TEXT,
            created_at TEXT NOT NULL
        );
        ",
    )?;
    Ok(())
}

fn carry_units(basic: i64, vector: i64) -> i64 {
    basic + VECTOR_UNIT_COST * vector
}

fn performance_factor(distance: f64, kills: i64) -> f64 {
    1.0 + distance / 500.0 + (kills as f64) / 25.0
}

fn idle_minutes_since(disconnected_at: &str) -> i64 {
    let parsed = DateTime::parse_from_rfc3339(disconnected_at);
    match parsed {
        Ok(dt) => {
            let then = dt.with_timezone(&Utc);
            let elapsed = Utc::now().signed_duration_since(then);
            elapsed.num_minutes().max(0)
        }
        Err(_) => 0,
    }
}

fn pending_idle(row: &PlayerRow) -> i64 {
    if let Some(ref at) = row.disconnected_at {
        let t = idle_minutes_since(at);
        let p = performance_factor(row.snapshot_distance, row.snapshot_kills);
        (t as f64 * IDLE_RATE_PER_MIN * p).floor() as i64
    } else {
        0
    }
}

fn load_player(conn: &Connection, callsign: &str) -> Result<Option<PlayerRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT callsign, resources, idle_credits, weapon_kind, basic_rounds, vector_rounds,
                run_upgrade_level, checkpoint, snapshot_distance, snapshot_kills,
                disconnected_at, created_at
         FROM players WHERE callsign = ?1",
    )?;
    let mut rows = stmt.query(params![callsign])?;
    if let Some(row) = rows.next()? {
        Ok(Some(PlayerRow {
            callsign: row.get(0)?,
            resources: row.get(1)?,
            idle_credits: row.get(2)?,
            weapon_kind: row.get(3)?,
            basic_rounds: row.get(4)?,
            vector_rounds: row.get(5)?,
            run_upgrade_level: row.get(6)?,
            checkpoint: row.get(7)?,
            snapshot_distance: row.get(8)?,
            snapshot_kills: row.get(9)?,
            disconnected_at: row.get(10)?,
            created_at: row.get(11)?,
        }))
    } else {
        Ok(None)
    }
}

fn player_response(row: PlayerRow) -> PlayerResponse {
    let used = carry_units(row.basic_rounds, row.vector_rounds);
    let pending = pending_idle(&row);
    PlayerResponse {
        player: row,
        carry_units_used: used,
        carry_cap: CARRY_CAP,
        pending_idle_credits: pending,
    }
}

fn validate_callsign(callsign: &str) -> Result<(), ApiError> {
    let trimmed = callsign.trim();
    if trimmed.is_empty() || trimmed.len() > 32 {
        return Err(ApiError::BadRequest(
            "callsign must be 1-32 non-empty characters".into(),
        ));
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(ApiError::BadRequest(
            "callsign may only contain letters, numbers, underscore, hyphen".into(),
        ));
    }
    Ok(())
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        service: "esf-server",
    })
}

async fn create_player(
    State(state): State<AppState>,
    Json(body): Json<CreatePlayer>,
) -> Result<Json<PlayerResponse>, ApiError> {
    validate_callsign(&body.callsign)?;
    let callsign = body.callsign.trim().to_string();
    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    if load_player(&conn, &callsign)?.is_some() {
        return Err(ApiError::Conflict("callsign already exists".into()));
    }
    conn.execute(
        "INSERT INTO players (callsign, created_at) VALUES (?1, ?2)",
        params![callsign, now],
    )
    .map_err(|e| ApiError::Internal(e.to_string()))?;
    let row = load_player(&conn, &callsign)?
        .ok_or_else(|| ApiError::Internal("insert failed".into()))?;
    Ok(Json(player_response(row)))
}

async fn get_player(
    State(state): State<AppState>,
    Path(callsign): Path<String>,
) -> Result<Json<PlayerResponse>, ApiError> {
    let conn = state.db.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    let row = load_player(&conn, &callsign)?
        .ok_or_else(|| ApiError::NotFound("player not found".into()))?;
    Ok(Json(player_response(row)))
}

async fn leave_player(
    State(state): State<AppState>,
    Path(callsign): Path<String>,
    Json(body): Json<LeaveBody>,
) -> Result<Json<PlayerResponse>, ApiError> {
    let conn = state.db.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    if load_player(&conn, &callsign)?.is_none() {
        return Err(ApiError::NotFound("player not found".into()));
    }
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE players SET snapshot_distance = ?1, snapshot_kills = ?2, disconnected_at = ?3
         WHERE callsign = ?4",
        params![body.distance, body.kills, now, callsign],
    )
    .map_err(|e| ApiError::Internal(e.to_string()))?;
    let row = load_player(&conn, &callsign)?
        .ok_or_else(|| ApiError::Internal("update failed".into()))?;
    Ok(Json(player_response(row)))
}

async fn collect_idle(
    State(state): State<AppState>,
    Path(callsign): Path<String>,
) -> Result<Json<PlayerResponse>, ApiError> {
    let conn = state.db.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    let row = load_player(&conn, &callsign)?
        .ok_or_else(|| ApiError::NotFound("player not found".into()))?;
    let grant = pending_idle(&row);
    if row.disconnected_at.is_none() {
        return Ok(Json(player_response(row)));
    }
    conn.execute(
        "UPDATE players SET idle_credits = idle_credits + ?1, disconnected_at = NULL
         WHERE callsign = ?2",
        params![grant, callsign],
    )
    .map_err(|e| ApiError::Internal(e.to_string()))?;
    let row = load_player(&conn, &callsign)?
        .ok_or_else(|| ApiError::Internal("update failed".into()))?;
    Ok(Json(player_response(row)))
}

fn spend_from_purse(row: &PlayerRow, purse: &str, cost: i64) -> Result<(i64, i64), ApiError> {
    match purse {
        "resources" => {
            if row.resources < cost {
                return Err(ApiError::BadRequest("insufficient resources".into()));
            }
            Ok((row.resources - cost, row.idle_credits))
        }
        "idle" => {
            if row.idle_credits < cost {
                return Err(ApiError::BadRequest("insufficient idle credits".into()));
            }
            Ok((row.resources, row.idle_credits - cost))
        }
        _ => Err(ApiError::BadRequest("purse must be 'resources' or 'idle'".into())),
    }
}

async fn configure_player(
    State(state): State<AppState>,
    Path(callsign): Path<String>,
    Json(body): Json<ConfigureBody>,
) -> Result<Json<PlayerResponse>, ApiError> {
    let conn = state.db.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    let row = load_player(&conn, &callsign)?
        .ok_or_else(|| ApiError::NotFound("player not found".into()))?;

    let mut resources = row.resources;
    let mut idle_credits = row.idle_credits;
    let mut weapon_kind = row.weapon_kind.clone();
    let mut basic_rounds = row.basic_rounds;
    let mut vector_rounds = row.vector_rounds;

    if let Some(w) = &body.weapon_kind {
        let cost = match w.as_str() {
            "cannon" => 0,
            "gattler" => COST_GATTLER,
            other => {
                return Err(ApiError::BadRequest(format!("unknown weapon: {other}")));
            }
        };
        let (r, i) = spend_from_purse(
            &PlayerRow {
                resources,
                idle_credits,
                ..row.clone()
            },
            &body.purse,
            cost,
        )?;
        resources = r;
        idle_credits = i;
        weapon_kind = w.clone();
    }

    if let Some(packs) = body.buy_basic {
        if packs <= 0 {
            return Err(ApiError::BadRequest("buy_basic must be positive".into()));
        }
        let rounds = packs * 10;
        let cost = packs * COST_BASIC_10;
        let new_basic = basic_rounds + rounds;
        if carry_units(new_basic, vector_rounds) > CARRY_CAP {
            return Err(ApiError::BadRequest("carry limit exceeded".into()));
        }
        let (r, i) = spend_from_purse(
            &PlayerRow {
                resources,
                idle_credits,
                ..row.clone()
            },
            &body.purse,
            cost,
        )?;
        resources = r;
        idle_credits = i;
        basic_rounds = new_basic;
    }

    if let Some(packs) = body.buy_vector {
        if packs <= 0 {
            return Err(ApiError::BadRequest("buy_vector must be positive".into()));
        }
        let rounds = packs * 10;
        let cost = packs * COST_VECTOR_10;
        let new_vector = vector_rounds + rounds;
        if carry_units(basic_rounds, new_vector) > CARRY_CAP {
            return Err(ApiError::BadRequest("carry limit exceeded".into()));
        }
        let (r, i) = spend_from_purse(
            &PlayerRow {
                resources,
                idle_credits,
                ..row.clone()
            },
            &body.purse,
            cost,
        )?;
        resources = r;
        idle_credits = i;
        vector_rounds = new_vector;
    }

    conn.execute(
        "UPDATE players SET resources = ?1, idle_credits = ?2, weapon_kind = ?3,
         basic_rounds = ?4, vector_rounds = ?5 WHERE callsign = ?6",
        params![
            resources,
            idle_credits,
            weapon_kind,
            basic_rounds,
            vector_rounds,
            callsign
        ],
    )
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    let row = load_player(&conn, &callsign)?
        .ok_or_else(|| ApiError::Internal("update failed".into()))?;
    Ok(Json(player_response(row)))
}

async fn run_end(
    State(state): State<AppState>,
    Path(callsign): Path<String>,
    Json(body): Json<RunEndBody>,
) -> Result<Json<PlayerResponse>, ApiError> {
    let conn = state.db.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    if load_player(&conn, &callsign)?.is_none() {
        return Err(ApiError::NotFound("player not found".into()));
    }

    let resource_gain = body.kills * 3 + (body.distance / 200.0).floor() as i64;
    let upgrade = if body.died { 0 } else { body.upgrade_level.max(0) };

    let basic_left = body.basic_left.max(0);
    let vector_left = body.vector_left.max(0);
    if carry_units(basic_left, vector_left) > CARRY_CAP {
        return Err(ApiError::BadRequest("invalid ammo counts".into()));
    }

    conn.execute(
        "UPDATE players SET resources = resources + ?1, run_upgrade_level = ?2,
         basic_rounds = ?3, vector_rounds = ?4,
         snapshot_distance = MAX(snapshot_distance, ?5), snapshot_kills = MAX(snapshot_kills, ?6)
         WHERE callsign = ?7",
        params![
            resource_gain,
            upgrade,
            basic_left,
            vector_left,
            body.distance,
            body.kills,
            callsign
        ],
    )
    .map_err(|e| ApiError::Internal(e.to_string()))?;

    let row = load_player(&conn, &callsign)?
        .ok_or_else(|| ApiError::Internal("update failed".into()))?;
    Ok(Json(player_response(row)))
}

#[tokio::main]
async fn main() {
    let path = db_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).expect("create data dir");
    }
    let conn = Connection::open(&path).expect("open database");
    init_db(&conn).expect("init schema");

    let state = AppState {
        db: Arc::new(Mutex::new(conn)),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/players", post(create_player))
        .route("/players/{callsign}", get(get_player))
        .route("/players/{callsign}/leave", post(leave_player))
        .route("/players/{callsign}/collect-idle", post(collect_idle))
        .route("/players/{callsign}/configure", post(configure_player))
        .route("/players/{callsign}/run/end", post(run_end))
        .layer(cors)
        .with_state(state);

    let listen = std::env::var("ESF_LISTEN").unwrap_or_else(|_| "127.0.0.1:8787".into());
    let listener = tokio::net::TcpListener::bind(&listen)
        .await
        .expect("bind listen");
    println!("esf-server listening on http://{listen}");
    axum::serve(listener, app).await.expect("serve");
}
