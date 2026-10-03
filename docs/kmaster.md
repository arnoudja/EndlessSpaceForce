# EndlessSpaceForce — KMaster

This is the master concept document for EndlessSpaceForce. It is a shared, buildable picture of the game **before any implementation**. It records what was actually described, labels every assumption and every proposed default, and does not invent numeric balance, lore, card-game mechanics, or co-op.

This document is the **living concept**. Keep it: retrieve it later, update it when decisions change, and hand it to other agents for the next development steps.

**Assumption, read first:** the spoken description began with “a card type, shooter type,” then described flying, shooting, and later “standard arcade gameplay,” with no card rules. This document treats the game as an **arcade-type shooter** unless that phrase meant an actual card layer. A card layer is not designed here. If it was intended, the arcade pillar below would have to be revisited.

**Decisions (not open questions):**

- **Look and feel:** the frontend is **dark-mode steampunk**. Appearance only (UI, palette, ornament), not a license to invent lore, factions, or a story.
- **Basic weapon:** the simplest weapon is **always available** and **does not need ammunition**. Ammo — including **vector ammunition** — and **carry limits** apply only to weapons **beyond** that basic weapon.
- **Easy to learn, difficult to master:** the basic weapon is the easy path. This is a difficulty intent, not a new mastery system. Do not add ranks, skill trees, or other invented mastery layers to satisfy it. Do not invent new ammo types or lore to satisfy it either.
- **Shooting does not reset:** player firing does not reset distance or the run. **Only destruction** returns the player to the last checkpoint.
- **Enemies fire:** enemies shoot at the player. **Enemy shots can destroy** the craft. That is still destruction: only then does the player return to the last checkpoint. Player shooting still does not reset the run.
- **Difficulty with distance:** difficulty rises with **distance travelled**, not only with time. Farther runs mean **harder enemy pressure**. No formula is specified.
- **Some enemies move horizontally.** Not every enemy. Enemies still **come from the top**.

---

## Vision

EndlessSpaceForce is a browser game with three coupled parts: an arcade shooter you fly and shoot in, a much slower idle layer that keeps gathering while you are away, and a ship-configuration layer where spending resources and choosing weapons and ammunition is meant to be a bit challenging. The frontend look is **dark-mode steampunk** (decided). You always have a simplest weapon that needs no ammo. You steer a plane (the same player craft as the “ship”) in four directions. Enemies come from the top; they fire at you; some of them also move horizontally. Only destruction sends you to the last checkpoint — player shooting does not reset the run. Difficulty rises with distance travelled, not only with time; farther runs mean harder enemy pressure. Pick up weapon upgrades along the way, and, when offline, keep earning a trickle of idle credits based on how far you have gotten and how well you have done. Several people can play on the same backend at once; they do not see each other. The game should be easy to learn and difficult to master; the basic weapon is the easy path.

---

## The three pillars

### 1. Arcade shooter (active play)

This is the live game. The player steers a plane in four directions, enemies come from the top, and the player shoots them down. **Enemies fire at the player.** Enemy shots can destroy the craft. **Some** enemies also move horizontally; not every enemy. The **simplest weapon is always available** and needs no ammunition, so a player can always shoot. **Difficulty rises with distance travelled**, not only with time: farther runs mean harder enemy pressure. Enough damage destroys the craft and sends the player back to the last checkpoint. **Player shooting does not reset** distance or the run; only destruction does. Pickups along the way are used as weapon upgrades. Gameplay should be **easy to learn and difficult to master**; the basic weapon is the easy path, not a separate mastery system.

“Plane” and “ship” in the source description are the **same player craft**. This document uses “craft” when the distinction does not matter, “plane” for arcade flying and shooting, and “ship” for configuration. That is wording, not two vehicles.

This is standard arcade gameplay, not a card game. See the assumption at the top.

### 2. Idle layer (offline, much slower)

While the player is offline, they keep gathering resources based on how far they are in the game and how well they have done up to the moment they go offline. On return they can spend those idle credits. Idle gain is much, much slower than resources earned while playing. The idle layer is not a substitute for the shooter; it is a background trickle tied to existing progress and performance.

### 3. Ship configuration (deliberate, a bit challenging)

The player always has the **basic weapon** without spending or stocking ammo. Configuration is the layer beyond that: choose how to spend resources, what extra weapon to create, and what ammunition type to use. **Vector ammunition** costs more resources than other ammunition; keep that name. Some ammunition has a carry limit, so a ship cannot stock everything **beyond the basic weapon**. The challenge is the constraint on those extras: you cannot take every option, and the expensive choice (vector ammunition) competes with everything else for the same spend and the same carry space. The basic weapon is never gated by ammo or carry limits.

### How a player moves between the three

Active play, configuration, and idle are one game, not three products.

- **Into the arcade:** the player flies the craft (basic weapon always available, plus any extra configured weapons/ammo), shoots, dodges **enemy fire**, takes pickups, and risks checkpoint reset **only on destruction** (including destruction by enemy shots). Player shooting does not reset distance or the run. Some enemies move horizontally; all still come from the top. Difficulty rises with distance.
- **Into configuration:** the player spends resources to create a weapon **beyond the basic one** and choose ammunition, within carry limits. The basic weapon is not created and does not use ammo. Configuration is not described as happening mid-flight; **proposed default:** it happens outside the arcade run (before a run or after returning), not while enemies are on screen. After an idle return, idle credits are available to spend; whether they fund this same configuration spend is an open question.
- **Into idle:** leaving the game (closing the session / going offline) does not freeze progress. The backend keeps gathering at the idle rate from the snapshot of how far the player is and how well they have done at disconnect.
- **Back from idle:** on return, the player receives the idle credits that accumulated, can spend them, then can configure and/or play again.

What “spend idle credits” can buy is only stated as spending them; whether they convert into the same resource pool used to create weapons, or are a separate purse, is an open question (see below). Do not assume a third currency beyond the two named: **in-game resources** from play, and **idle credits** from being away.

---

## Play-session loop

A session of active play, as described:

1. The player is in the browser with their craft. The **basic weapon is always available** and needs no ammo. Any extra weapons, ammunition (including vector ammunition), and carry limits come from configuration beyond that.
2. They steer in four directions and shoot. Enemies come from the top, **fire at the player**, and **some** also move horizontally. **Player shooting does not reset** distance or the run.
3. Difficulty rises with **distance travelled**, not only with time. Farther runs mean harder enemy pressure. The intent is easy to learn, difficult to master; the basic weapon is the easy path.
4. Pickups appear along the way. Collecting them upgrades weapons.
5. Taking enough damage **destroys** the craft. **Enemy shots can destroy** the craft. **Only then** does play resume from the last checkpoint, not from an invented “start of the game” unless that checkpoint *is* the start. Player firing is not destruction.
6. While playing, the player earns in-game resources at the active (faster) rate. No amounts are specified.
7. The player stops: they leave, or they step out to spend and reconfigure. Stopping is what hands the idle layer the snapshot of distance and performance.

No lives count, score table, wave structure, or timer was specified. Do not add them as rules.

---

## Offline-return loop

1. The player goes offline. The backend, not the browser, is responsible for idle-time calculation.
2. Idle gathering continues, keyed to **how far they are in the game** and **how well they have done** at the moment they went offline. Both factors matter; neither was given a formula.
3. Idle gain is much, much slower than earning the same kind of progress by actually playing for that time.
4. On return, the player can spend the idle credits that accrued.
5. They may then reconfigure extras on the ship (spend, create a weapon beyond the basic one, choose ammunition, respect carry limits) and/or start another arcade session. The basic weapon remains available either way.

Idle does not shoot enemies, fire enemy shots, place pickups, or move checkpoints. It only gathers, slowly, from the snapshot taken at disconnect.

---

## Player-facing rules

These are the rules the player can rely on, including later decisions recorded above. Nothing below invents a number, a drop rate, or a named enemy.

- The player steers one craft in **four directions**.
- **Enemies come from the top.** The player shoots them down.
- **Enemies fire at the player.** **Enemy shots can destroy** the craft.
- **Some enemies also move horizontally.** Not every enemy. They still come from the top.
- The **simplest weapon is always available** and **needs no ammunition**.
- **Ammo, including vector ammunition, and carry limits apply only beyond that basic weapon.**
- Gameplay is **easy to learn and difficult to master**. The basic weapon is the easy path. That is not a separate mastery system.
- **Difficulty rises with distance travelled**, not only with time. Farther runs mean harder enemy pressure.
- **Player shooting does not reset** distance or the run.
- **Enough damage destroys** the craft. **Only destruction** sends the player to the **last checkpoint**. Enemy shots are a way that can happen. Player shots are not.
- **Pickups along the way** are used as **weapon upgrades**.
- **Playing** earns resources. **Being offline** still gathers, based on current distance and performance at disconnect, but **much more slowly**.
- On return, **idle credits can be spent**.
- Beyond the basic weapon, the player **chooses how to spend resources**, **what weapon to create**, and **what ammunition type to use**.
- **Vector ammunition** costs more resources. The name stays; the in-fiction meaning is still open.
- **Some ammunition has a carry limit.** A ship **cannot stock everything** among those extra ammo options. The basic weapon is not subject to that stock.
- Other people may be playing at the same time. **The player cannot see them.** There is no shared visible world, no co-op, and no PvP.

What was not stated is not a rule: hit points, fire rate (player or enemy), enemy HP, how many enemies move horizontally, checkpoint spacing, pickup frequency, resource amounts, idle formulas, which ammo types exist besides vector ammunition, which ammo types have carry limits, inventory sizes, and whether pickup upgrades persist after death or after a full logout.

---

## Currencies

Two earnings are named. Do not collapse them without a decision.

| Source | Name used here | Relative speed | When it accrues | What the player does with it |
| --- | --- | --- | --- | --- |
| Active play | In-game resources | Faster | While playing | Spend on ship configuration beyond the basic weapon (extra weapons, ammunition, including the higher cost of vector ammunition) |
| Offline | Idle credits | Much, much slower | While away, from distance + performance at disconnect | Spend on return |

Idle is not “the same income, just AFK.” It is a trickle. Playing is the main way to earn.

**Open (design-changing):** whether idle credits are a separate spendable purse or convert 1:1 (or at some other rate) into in-game resources. This document does not pick a number and does not merge the two silently.

**Proposed default (not a decision):** show both clearly to the player so idle never looks as fast as a play session. Keep them distinguishable in the UI even if a later decision converts idle credits into the resource pool on collect.

---

## Death, checkpoints, pickups, and weapon upgrades

**Death.** Damage accumulates. When the craft has taken enough damage to be destroyed, the player starts from the last checkpoint. **Enemy shots can destroy** the craft. Destruction is a position/progress reset to that checkpoint, not an invented permadeath of the account, and not an invented life counter.

**Decision — player shooting is not death.** Player firing does not reset distance or the run. Checkpoint return happens **only** on destruction (including destruction by enemy shots).

**Checkpoints.** A last checkpoint exists. How a checkpoint is created (automatic distance markers, stage clears, player action) was not stated. **Assumption:** at least one checkpoint exists so “last checkpoint” has meaning; a brand-new player’s last checkpoint may simply be the start of play.

**Pickups.** They appear along the way in the arcade run. They are used as weapon upgrades. That is an in-run upgrade path, separate from creating a weapon in ship configuration. Do not treat pickups as the configuration screen, and do not treat configuration as the only way to change weapons.

**Weapon upgrades vs creating a weapon.** Two different verbs were used:

- **Create** a weapon — ship configuration, spending resources, **beyond** the always-available basic weapon.
- **Upgrade** a weapon — pickups during the arcade run.

Whether a pickup upgrade lasts only until death, until the end of the run, or permanently is **not stated**. A wrong guess changes progression. It is listed under open questions, not filled in.

---

## Ship configuration, ammunition, and carry limits

Configuration is meant to be a bit challenging. The challenge is choice under scarcity **beyond the always-available basic weapon**, not a puzzle minigame (none was described), and not an invented mastery system.

The player:

1. Always has the **simplest weapon**, with **no ammunition required**.
2. Chooses **how to spend resources** on options beyond that.
3. Chooses **what weapon to create** beyond the basic weapon.
4. Chooses **what ammunition type to use** for those extra weapons.
5. Pays **more resources** if the ammunition is **vector ammunition**.
6. Hits **carry limits** on some ammunition, so the ship **cannot stock everything** among extra ammo. Carry limits do not apply to the basic weapon.

**Vector ammunition** is a proper loadout name in this design. Do not rename it to “special ammo,” “homing,” or similar. The exact in-fiction meaning (what the projectile *is*) is still open. Mechanically, this is committed: it is an ammunition type for weapons **beyond the basic weapon**, and it costs more. The basic weapon does not use it.

Carry limits are why extra configuration is a constraint rather than a checklist. If every ammunition type could be stocked at once, the “choose” step would collapse. Limits force a loadout: taking vector ammunition, or taking more of a limited type, means *not* taking something else. The player can still fly and shoot with the basic weapon if they take nothing extra. No inventory size or list of ammo types beyond vector ammunition is specified; additional types exist in principle (“what ammunition type,” “some ammo”) but are unnamed.

**Proposed default (not a decision):** extra configuration applies to the next arcade session of that player’s craft. The basic weapon does not depend on that step. Switching ammunition or creating a different extra weapon does not require seeing other players or a shared shop.

---

## Multiplayer boundary

Several players play at the same time on one backend. That is concurrent **isolated sessions**, not a shared world.

- Players **cannot see each other**.
- Not co-op.
- Not PvP.
- Not a shared visible world.

Each player’s arcade run, checkpoints, pickups, damage, configuration, and idle snapshot are that player’s. The backend’s job for “multiple players” is to host many independent sessions and store them, not to synchronize a common battlefield.

---

## Technical shape (concept level)

| Constraint | What it means |
| --- | --- |
| Browser-based first | The game is playable in the browser. No native client is required for the first version. |
| Client language | Not fixed. JavaScript or TypeScript is acceptable. |
| Backend | **Rust.** Idle-time calculations, storage, and related server work live here. |
| Host | The Rust service **initially runs on a Raspberry Pi**. |
| Development machine | Day-to-day work happens on an **Intel-based Omarchy machine**, not on ARM. |
| Cross-compile / portability | Dev is Intel; the first host is a Pi. The Rust service should stay **portable to aarch64** even though development is on Intel. Do not treat the toolchain as ARM-only, and do not assume the service can be x86-only. |
| Look and feel | **Decision:** dark-mode steampunk on the frontend. |
| Concurrency | Multiple players at once on that backend, each in an isolated session. |

The arcade loop runs where a browser can steer and shoot. Idle math and persistence do not depend on the browser staying open; that is why they belong on the Rust service. Isolated sessions mean the Pi does not have to simulate one shared world for everyone.

### Proposed default stack (proposal, not a decision)

**Proposal:** TypeScript in the browser (Canvas 2D game loop, built with Vite), talking to a Rust service (Axum, SQLite) on the Raspberry Pi.

Why this fits a browser and a Pi, without turning the proposal into a lock-in:

- **TypeScript** is an acceptable client language, catches more mistakes than plain JavaScript as the client grows, and still compiles to ordinary browser JS. No plugin, no install.
- **Canvas 2D** is enough for a four-direction craft, enemies from the top (some moving horizontally), player shots, enemy shots, and pickups. It avoids a heavy WebGL engine and keeps the client small enough for a Pi to serve as static files. The canvas and surrounding UI follow the **decided** dark-mode steampunk look. **Assumption inside this proposal:** 2D top-down (or top-origin) arcade view, because enemies come from the top and the description is standard arcade shooting, not a 3D flight sim.
- **Vite** is a proposed build tool only: fast local builds on the Intel Omarchy machine, static output the Pi can serve.
- **Rust + Axum** matches the required backend language, stays async and relatively light, and is developed on **Intel Omarchy** while remaining **portable to aarch64** so the same service can run on the Raspberry Pi.
- **SQLite** keeps storage in-process: no separate database server on the Pi, one file for isolated player records (progress, checkpoints, configuration, idle snapshot, idle credits). Concurrent isolated players are rows and sessions, not a shared physics world.
- **HTTP JSON** for accounts/sessions, loading and saving configuration, reporting disconnect time, and collecting idle credits on return. The arcade frame loop does not need to be server-authoritative for this concept to work. **Proposed default:** client runs the shooter; the server is source of truth for **idle calculation, stored progress, and configuration persistence**. That split matches “Rust does idle-time calculations, storage, and related server work” and keeps the Pi off N real-time combat simulations.

Player identity was not specified. **Proposed default:** a simple player account (or equivalent persistent id) so idle and configuration survive closing the browser. Without some identity, offline credits have nowhere to accrue.

This stack is a recommendation for a browser client plus a Raspberry Pi host, developed on Intel Omarchy. It is not a decision. Swapping Canvas for another 2D approach, Axum for another Rust HTTP crate, or SQLite for another embedded store does not change the game concept as long as the constraints above still hold (including **aarch64 portability** of the Rust service). The dark-mode steampunk look is **not** part of this stack proposal; it is already decided.

---

## Assumptions

Every assumption in this document, collected:

1. **“Card type” is not a card game** unless later corrected. The game is an arcade-type shooter. (Flagged at the top.)
2. **Plane and ship are the same player craft.**
3. **Four directions** means the craft can move up, down, left, and right. Whether diagonals are allowed was not stated; **proposed default:** four cardinal directions only, until control feel is decided.
4. **Enemies from the top** means a vertical incoming threat (arcade shmup-style traffic), not a 3D skybox. The player is not locked to a single rail; they still steer in four directions. **Decision:** some of those enemies also move horizontally; not all of them. **Decision:** they fire at the player.
5. **Difficulty** in a run rises with **distance travelled**, not only with time. Farther = harder enemy pressure. This is an in-run ramp, not an unspecified seasonal meta. No numbers are specified.
6. A **last checkpoint** exists; a new player’s checkpoint may be the start of play.
7. **Idle continues on the server** after the browser is gone.
8. **Idle credits and in-game resources** are both real to the player; they are not silently merged in this document.
9. **Configuration is outside the arcade run** (proposed default, not stated).
10. **Vector ammunition** is a loadout item with a higher resource cost for weapons **beyond the basic weapon**; its fictional meaning is unset. The basic weapon does not use ammunition.
11. **Other ammunition types exist** but are unnamed; only vector ammunition is named. They apply only beyond the basic weapon.
12. **Players are isolated**; concurrency is backend capacity, not a shared scene.
13. **Proposed stack** (TypeScript, Canvas 2D, Vite, Rust/Axum, SQLite, HTTP JSON, client-side arcade, server-side idle/storage) is a proposal, not a decision. Dark-mode steampunk, the always-available basic weapon, easy-to-learn / hard-to-master as difficulty intent (not a mastery system), player-shooting-does-not-reset, enemies firing, difficulty-with-distance, and some-enemies-move-horizontally are **decisions**, separate from that stack proposal.
14. **Some persistent player id** is required for idle and storage (proposed default).
15. **Dev vs host:** development is Intel Omarchy; first service host is a Raspberry Pi. The Rust service must stay portable to aarch64. It is not developed on ARM, and tools are not ARM-only for the dev machine.

---

## Open questions

Only questions where a wrong guess would change the design. Unspecified numbers are not listed as questions; they are simply unspecified.

1. Did “card type” mean an actual card layer, or arcade-type as the rest of the description indicates?
2. Are idle credits a separate purse, or do they convert into in-game resources on return? If they convert, that conversion *is* a number that must be designed later — do not pretend they are already the same currency.
3. What does “how well they have done” mean for the idle snapshot (survival, enemies destroyed, distance, upgrades, some combination)? Distance is already a separate factor (“how far they are”).
4. Do pickup-based weapon upgrades persist through death, through the end of a run, and/or through logout?
5. When is ship configuration allowed: only between runs, at checkpoints, or also during play?
6. How are checkpoints created and placed? That defines what death *costs*.
7. Does “four directions” include diagonals or only cardinal movement?
8. Must the server verify arcade outcomes (anti-cheat / authoritative combat), or is client-side combat acceptable on a trusted or casual Pi deployment? This changes the backend from storage-plus-idle to a combat sim.
9. What can idle credits be spent on, exactly — the same weapon/ammo creation as in-game resources, or something else?
10. What does **vector ammunition** do in play, besides costing more? The name is fixed; the behavior is not.

Do not fill these in inside this document. They are the points that need a decision before implementation pretends they were already specified.

---

## Proposed first playable slice (proposal)

A first playable version should prove **all three pillars** and the **isolation rule**, not only the shooter. This is a proposal, not a schedule and not a feature freeze.

Include:

- A browser session in the **decided dark-mode steampunk** look: one craft, **four-direction** steering, **shooting**, **enemies from the top** that **fire at the player**, **some** of which **move horizontally**, **difficulty rising with distance travelled** (farther = harder enemy pressure).
- The **basic weapon always available**, no ammo required; the player can complete a run on that easy path.
- **Player shooting does not reset** distance or the run. **Enemy shots can destroy** the craft. **Damage → destruction → last checkpoint** is the only checkpoint return (even if the only checkpoint is the start).
- At least one **pickup** that **upgrades the weapon** during the run.
- A configuration step **outside** the run, **beyond** the basic weapon: spend a resource, **create a weapon**, choose ammunition including **vector ammunition at higher cost**, and a **carry limit** that prevents stocking every extra ammunition option at once.
- **Idle:** leave, wait, return; receive **idle credits** from stored distance and a simple “how well they have done” snapshot; idle amount for that time is **visibly far smaller** than playing for that time. No invented formula in this document — the slice must *show the speed difference*, not lock the curve.
- **Rust** on the host: persist the player, configuration, checkpoint, idle snapshot, and idle payout. **More than one player** can be connected; they **do not see each other**.

Develop the slice on the **Intel Omarchy** machine. The first service host remains a **Raspberry Pi**, so keep the Rust service portable to **aarch64**. Client language: TypeScript under the proposed stack above, or JavaScript if TypeScript is declined.

Do not require a card layer, other players on screen, lore, or tuned economy numbers for this slice to count as playable.

---

## Out of scope (proposal)

Labeled as a proposal for what this concept is *not*, so implementation does not grow a second game:

- A **card game** or card layer (unless open question 1 reverses the arcade assumption).
- **Co-op, PvP, shared world, seeing other players**, parties, or lobbies.
- **Numeric balance**, drop tables, and idle formulas presented as if they were already decided.
- **Lore**, setting bible, named factions, or a story campaign.
- **Native desktop or mobile** clients as a requirement (browser first).
- **Chat, clans, matchmaking, leaderboards, spectating** — none were described.
- **Server-authoritative combat simulation** for every shot, unless open question 8 demands it.
- **Hosting beyond the Raspberry Pi** as a requirement for the initial service.
- Renaming **vector ammunition**.
- Invented ammunition types presented as canon; extra types may exist later but are unnamed here.
- An invented **mastery system** (ranks, skill trees, or similar). Easy-to-learn / difficult-to-master is difficulty intent; the basic weapon is the easy path.

This document is the KMaster: the living concept to retrieve, update, and hand to the next development step. It is not code, not a balance sheet, and not a license to add systems that were not asked for.
