import { api, ApiRequestError, type PlayerState } from "./api";
import { Game, type Loadout } from "./game";

const CALLSIGN_KEY = "esf_callsign";

const app = document.getElementById("app")!;
app.innerHTML = `
  <h1>EndlessSpaceForce</h1>
  <p class="subtitle">Dark steampunk hangar — configure, fly, idle trickle</p>
  <div id="hangar" class="panel">
    <div class="row">
      <div>
        <label for="callsign">Callsign</label>
        <input id="callsign" type="text" placeholder="pilot name" maxlength="32" />
      </div>
      <div class="actions" style="align-self: flex-end">
        <button type="button" id="btn-register">Register / load</button>
      </div>
    </div>
    <div id="purses" class="purses hidden"></div>
    <div id="loadout" class="hidden">
      <p>Carry: <span id="carry"></span></p>
      <div class="row">
        <div>
          <label for="purse">Pay from</label>
          <select id="purse">
            <option value="resources">In-game resources</option>
            <option value="idle">Idle credits</option>
          </select>
        </div>
      </div>
      <div class="actions">
        <button type="button" id="btn-cannon">Cannon (free)</button>
        <button type="button" id="btn-gattler">Gattler (40)</button>
        <button type="button" id="btn-basic">+10 gattler feed (5)</button>
        <button type="button" id="btn-vector">+10 vector (25)</button>
        <button type="button" id="btn-collect">Collect idle stipend</button>
        <button type="button" id="btn-leave">Leave / snapshot idle</button>
        <button type="button" id="btn-launch">Launch sortie</button>
      </div>
    </div>
    <p id="status" class="status"></p>
  </div>
  <div id="game-section" class="game-wrap hidden">
    <canvas id="game-canvas"></canvas>
    <p class="hint">Arrows/WASD move · Space starter gun (always) · 2 vector ammo · Gattler uses feed</p>
    <div class="actions" style="justify-content: center; margin-top: 0.75rem">
      <button type="button" id="btn-hangar" class="secondary">Return to hangar</button>
    </div>
  </div>
`;

const el = {
  callsign: document.getElementById("callsign") as HTMLInputElement,
  btnRegister: document.getElementById("btn-register")!,
  purses: document.getElementById("purses")!,
  loadout: document.getElementById("loadout")!,
  carry: document.getElementById("carry")!,
  purse: document.getElementById("purse") as HTMLSelectElement,
  status: document.getElementById("status")!,
  hangar: document.getElementById("hangar")!,
  gameSection: document.getElementById("game-section")!,
  canvas: document.getElementById("game-canvas") as HTMLCanvasElement,
  btnCannon: document.getElementById("btn-cannon")!,
  btnGattler: document.getElementById("btn-gattler")!,
  btnBasic: document.getElementById("btn-basic")!,
  btnVector: document.getElementById("btn-vector")!,
  btnCollect: document.getElementById("btn-collect")!,
  btnLeave: document.getElementById("btn-leave")!,
  btnLaunch: document.getElementById("btn-launch")!,
  btnHangar: document.getElementById("btn-hangar")!,
};

let state: PlayerState | null = null;
let game: Game | null = null;

function setStatus(msg: string, isError = false) {
  el.status.textContent = msg;
  el.status.classList.toggle("error", isError);
}

function callsign(): string {
  return el.callsign.value.trim();
}

function renderPurses(s: PlayerState) {
  el.purses.classList.remove("hidden");
  el.loadout.classList.remove("hidden");
  el.purses.innerHTML = `
    <div class="purse">Resources: <strong>${s.player.resources}</strong></div>
    <div class="purse">Idle credits: <strong>${s.player.idle_credits}</strong></div>
    <div class="purse">Pending idle: <strong>${s.pending_idle_credits}</strong></div>
    <div class="purse">Weapon: <strong>${s.player.weapon_kind}</strong></div>
  `;
  el.carry.textContent = `${s.carry_units_used} / ${s.carry_cap} (gattler feed×1, vector×4) — starter gun needs no ammo`;
}

async function refresh() {
  const cs = callsign();
  if (!cs) return;
  state = await api.getPlayer(cs);
  renderPurses(state);
}

async function registerOrLoad() {
  const cs = callsign();
  if (!cs) {
    setStatus("Enter a callsign.", true);
    return;
  }
  try {
    try {
      state = await api.createPlayer(cs);
      setStatus(`Registered ${cs}.`);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 409) {
        state = await api.getPlayer(cs);
        setStatus(`Loaded ${cs}.`);
      } else {
        throw e;
      }
    }
    localStorage.setItem(CALLSIGN_KEY, cs);
    renderPurses(state);
  } catch (e) {
    setStatus((e as Error).message, true);
  }
}

function purse(): "resources" | "idle" {
  return el.purse.value as "resources" | "idle";
}

async function configure(
  partial: Parameters<typeof api.configure>[1],
) {
  const cs = callsign();
  if (!cs) return;
  try {
    state = await api.configure(cs, { purse: purse(), ...partial });
    renderPurses(state);
    setStatus("Loadout updated.");
  } catch (e) {
    setStatus((e as Error).message, true);
  }
}

el.btnRegister.addEventListener("click", () => registerOrLoad());
el.btnCannon.addEventListener("click", () =>
  configure({ weapon_kind: "cannon" }),
);
el.btnGattler.addEventListener("click", () =>
  configure({ weapon_kind: "gattler" }),
);
el.btnBasic.addEventListener("click", () => configure({ buy_basic: 1 }));
el.btnVector.addEventListener("click", () => configure({ buy_vector: 1 }));
el.btnCollect.addEventListener("click", async () => {
  const cs = callsign();
  if (!cs) return;
  try {
    state = await api.collectIdle(cs);
    renderPurses(state);
    setStatus(
      state.pending_idle_credits === 0
        ? "Idle stipend collected (slow trickle vs active play)."
        : "No disconnect snapshot to collect.",
    );
  } catch (e) {
    setStatus((e as Error).message, true);
  }
});
el.btnLeave.addEventListener("click", async () => {
  const cs = callsign();
  if (!cs || !state) return;
  try {
    state = await api.leave(cs, state.player.snapshot_distance, state.player.snapshot_kills);
    renderPurses(state);
    setStatus("Snapshot stored for idle accrual.");
  } catch (e) {
    setStatus((e as Error).message, true);
  }
});

el.btnLaunch.addEventListener("click", () => {
  if (!state) {
    setStatus("Load a callsign first.", true);
    return;
  }
  const loadout: Loadout = {
    weaponKind: state.player.weapon_kind,
    basicRounds: state.player.basic_rounds,
    vectorRounds: state.player.vector_rounds,
    upgradeLevel: state.player.run_upgrade_level,
  };
  el.gameSection.classList.remove("hidden");
  el.hangar.setAttribute("inert", "");
  el.btnLaunch.blur();
  game?.stop();
  game = new Game(el.canvas, loadout, async (stats) => {
    el.gameSection.classList.add("hidden");
    el.hangar.removeAttribute("inert");
    const cs = callsign();
    if (!cs) return;
    try {
      state = await api.runEnd(cs, {
        distance: stats.distance,
        kills: stats.kills,
        died: stats.died,
        upgrade_level: stats.died ? 0 : stats.upgradeLevel,
        basic_left: stats.basicLeft,
        vector_left: stats.vectorLeft,
      });
      renderPurses(state);
      setStatus(
        `Returned from sortie. Distance ${stats.distance}, kills ${stats.kills}.`,
      );
    } catch (e) {
      setStatus((e as Error).message, true);
    }
  });
  game.start();
  setStatus("In flight — enemies from the top.");
});

el.btnHangar.addEventListener("click", () => {
  game?.returnToHangar();
});

const saved = localStorage.getItem(CALLSIGN_KEY);
if (saved) {
  el.callsign.value = saved;
  registerOrLoad().catch(() => undefined);
}

api.health().then((h) => {
  if (h.ok) setStatus("Hangar link online.");
}).catch(() => setStatus("Backend offline — start esf-server on :8787", true));
