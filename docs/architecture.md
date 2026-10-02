# EndlessSpaceForce — v1 Architecture

This document describes the **first runnable version** on an Intel Omarchy dev machine (`devpc`), with a Rust service that remains **portable to aarch64** for a later Raspberry Pi host. Choices that close open questions in `kmaster.md` are labeled **initial default** — they are implementation decisions for v1, not canon.

---

## Goals (v1)

- Playable browser arcade shooter with dark-mode steampunk UI.
- Between-run ship configuration funded by two purses: **in-game resources** (fast) and **idle credits** (slow).
- Server-owned persistence, idle math, checkpoint, and configuration; client-owned real-time combat.
- Multiple callsigns on one backend; **no shared scene** and no visibility between players.

---

## Components

| Component | Technology | Responsibility |
| --- | --- | --- |
| **Web client** | TypeScript, Vite, Canvas 2D, CSS | Arcade loop, input, rendering, hub UI (config / idle / launch). Talks to API over HTTP JSON. |
| **Game service** | Rust, Axum, SQLite (`rusqlite` or `sqlx` with sqlite) | Player records, purses, loadout, checkpoint, disconnect snapshot, idle accrual, run settlement. |
| **Static assets** | Vite build output | Served by Vite dev server on dev; on Pi, same files via `tower-http` `ServeDir` or nginx. |

**Initial default:** monorepo layout: `frontend/`, `backend/`, `docs/`.

---

## Process split

```
┌─────────────────────┐         HTTP JSON          ┌──────────────────────┐
│  Browser (client)   │ ◄────────────────────────► │  esf-server (Rust) │
│  Canvas arcade sim  │                            │  SQLite esf.db       │
│  Hub / config UI    │                            │  idle + persistence  │
└─────────────────────┘                            └──────────────────────┘
```

### Client simulates (authoritative for feel, not for economy)

- Craft movement (four cardinal directions), shooting, projectile motion.
- Enemy spawn from top, difficulty ramp (spawn rate / speed / HP).
- Collision: damage, enemy kills, distance traveled (vertical progress proxy).
- Pickup collection → **run weapon upgrade level** (+1 damage tier until death).
- Death → reset craft to **last checkpoint** (v1: world origin / start only) **inside the same sortie**; distance and kills for the run keep accumulating. Only **Return to hangar** ends the run and calls `run/end`.
- **Starter gun** (space, mode basic): always available, unlimited, no carry cost. Teaches movement and shooting without economy friction.
- **Gattler feed** (`basic_rounds` in DB): optional purchased ammo for the Gattler weapon’s triple spread when mode is basic and feed remains.
- **Vector** (key `2`): heavier shots; consumes `vector_rounds` from carry; blocked when empty (starter gun still works on mode basic).
- During play the canvas holds keyboard focus; Space uses `preventDefault` so hangar buttons cannot steal fire or relaunch the sortie.

### Server owns (source of truth)

- Player identity: **callsign** (unique string, persisted).
- Both purses: `resources`, `idle_credits`.
- Loadout between runs: `weapon_kind`, purchased **gattler feed** (`basic_rounds`) and **vector** round counts subject to **carry cap** (starter gun excluded).
- Checkpoint id (v1: always `start`).
- **Disconnect snapshot**: `snapshot_distance`, `snapshot_kills`, `disconnected_at` (UTC).
- Accrued idle not yet collected (computed on `collect-idle`).
- Clearing **run weapon upgrade** on reported death / run end.

**Initial default:** combat is client-run; server trusts reported run summaries for v1 (distance, kills, resources earned, died flag). Anti-cheat is out of scope.

---

## Multiplayer / invisibility

- Each callsign is one row in SQLite. APIs are scoped by callsign path segment.
- No endpoint returns another player’s position, score, or session.
- No WebSocket room, no shared world state, no matchmaking.
- Two browsers with two callsigns = two isolated records. **Initial default:** no login password in v1; callsign is the handle (honor system on a home Pi).

---

## Data model (SQLite)

Single file: `ESF_DATABASE_PATH` or `./data/esf.db`.

**Table `players`**

| Column | Type | Notes |
| --- | --- | --- |
| `callsign` | TEXT PK | Player id |
| `resources` | INTEGER | In-game purse |
| `idle_credits` | INTEGER | Idle purse |
| `weapon_kind` | TEXT | `cannon` \| `gattler` (**initial default** names) |
| `basic_rounds` | INTEGER | Gattler feed rounds in loadout (not used by starter gun) |
| `vector_rounds` | INTEGER | Purchased vector ammo in loadout |
| `run_upgrade_level` | INTEGER | Pickup upgrade; server clears on death |
| `checkpoint` | TEXT | v1 always `start` |
| `snapshot_distance` | REAL | Last leave/disconnect |
| `snapshot_kills` | INTEGER | Last leave/disconnect |
| `disconnected_at` | TEXT NULL | ISO-8601 UTC when snapshot taken |
| `created_at` | TEXT | ISO-8601 UTC |

No other tables in v1.

### Carry limit (**initial default**)

- **Cap:** 100 **carry units** on optional loadout ammo only (starter gun is outside the cap).
- Gattler feed: 1 unit per round purchased (`basic_rounds`).
- Vector ammunition: 4 units per round (heavier, fewer carried).
- Total `basic_rounds + 4 * vector_rounds ≤ 100`.
- In play, vector mode consumes vector rounds; Gattler volleys consume feed when `weapon_kind = gattler` and feed > 0, otherwise the player still fires the free starter gun.

### Configuration prices (**initial default**, same currency choice per action)

Both purses may pay **configuration** purchases (weapon unlock / ammo buy). Spending tries `resources` first if the request says `purse: "resources"`, or `idle_credits` if `purse: "idle"`.

| Action | Cost (resources or idle credits) |
| --- | --- |
| Select `cannon` (default) | 0 |
| Select `gattler` | 40 |
| Buy 10 gattler feed rounds | 5 |
| Buy 10 vector rounds | 25 |

Weapon selection is between runs only (hub screen).

---

## Idle calculation (v1 formula)

Snapshot at **leave** or explicit disconnect: store `snapshot_distance` (max distance this run/session), `snapshot_kills`, and `disconnected_at = now()`.

When the player calls **collect idle**, let:

- `t` = whole minutes offline since `disconnected_at` (minimum 0).
- `d` = `snapshot_distance` (meters, client-reported integer).
- `k` = `snapshot_kills`.

**Performance factor** (rewards prior play, sublinear):

\[
P = 1 + \frac{d}{500} + \frac{k}{25}
\]

**Idle credits earned** (much slower than active play):

\[
\text{idle\_grant} = \left\lfloor t \times 0.02 \times P \right\rfloor
\]

**Initial default constants:**

- `0.02` credits per minute at `P = 1` → 1 credit per 50 minutes idle at start.
- Active play (settlement on run end): `resources += k * 3 + floor(d / 200)` per run segment — typically **orders of magnitude** more per minute of skilled play than idle.

After grant: add to `idle_credits`, clear `disconnected_at` (snapshot values retained for display until next leave).

---

## HTTP API (JSON)

Base URL **initial default:** `http://127.0.0.1:8787`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | `{ "ok": true, "service": "esf-server" }` |
| POST | `/players` | Body `{ "callsign": "..." }` → create player |
| GET | `/players/{callsign}` | Full player state + pending idle preview if disconnected |
| POST | `/players/{callsign}/leave` | Body `{ "distance": n, "kills": n }` → snapshot + disconnect |
| POST | `/players/{callsign}/collect-idle` | Apply idle formula, credit purse |
| POST | `/players/{callsign}/configure` | Body `{ "purse", "weapon_kind"?, "buy_basic"?, "buy_vector"? }` |
| POST | `/players/{callsign}/run/end` | Body `{ "distance", "kills", "died": bool, "upgrade_level" }` → resources grant, clear upgrade if died |

Errors: `{ "error": "message" }` with 4xx/5xx.

CORS: allow dev origin `http://127.0.0.1:5173` (**initial default**).

---

## Client application flow

1. **Hangar (hub):** enter/create callsign, see purses, configure weapon/ammo, preview idle, launch run.
2. **Run:** canvas shooter; on death or “Return to hangar”, POST `run/end` then optionally `leave`.
3. **Idle:** leaving sets snapshot; on next visit, “Collect idle stipend” calls `collect-idle`.

Steampunk UI: near-black `#0d0c0a`, brass `#b8860b` / copper `#c45c3e`, cream `#f5f0e1`, riveted panels (border + corner radius), monospace accents.

---

## Running on Omarchy (devpc)

**Initial default ports:**

- Backend: `8787` — `cd backend && cargo run` (or `ESF_LISTEN=127.0.0.1:8787`).
- Frontend: Vite `5173` — `cd frontend && npm run dev`, `VITE_API_URL=http://127.0.0.1:8787`.

Intel x86_64 native build for daily dev. No x86-only dependencies in the Rust crate (pure Rust + SQLite bundled).

---

## Raspberry Pi deployment (later; constraints now)

- Cross-compile or build on Pi: `aarch64-unknown-linux-gnu`.
- Same binary + `esf.db` + static `frontend/dist`.
- **Must stay true:** no x86-only crates; SQLite embedded; single-process Axum; static file serving optional in binary.
- Environment variables: `ESF_LISTEN`, `ESF_DATABASE_PATH`, `ESF_STATIC_DIR` (optional).

---

## KMaster open questions closed as initial defaults (v1 only)

| Topic | Initial default |
| --- | --- |
| Arcade vs card | Arcade shooter only |
| Configuration timing | Between runs only |
| Checkpoints | One checkpoint: start |
| Pickup upgrade persistence | Until in-run death (checkpoint respawn); cleared on `run/end` upgrade_level |
| Starter gun | Always free; carry limits apply only to gattler feed + vector |
| Idle vs resources | Two purses; both spend on same configure actions |
| Idle formula | Documented above |
| Ammo types | `basic` + `vector`; vector costlier and heavier |
| Carry limit | 100-unit cap formula above |
| Stack | TypeScript, Vite, Canvas 2D, Rust, Axum, SQLite, HTTP JSON |
| Identity | Callsign persisted server-side |

---

## Out of scope (v1)

- Auth/passwords, anti-cheat, additional checkpoints, card/co-op/PvP, shared visibility, WebGL, separate DB server.
