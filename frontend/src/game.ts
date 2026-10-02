export type AmmoMode = "basic" | "vector";

export interface Loadout {
  weaponKind: string;
  basicRounds: number;
  vectorRounds: number;
  upgradeLevel: number;
}

export interface RunStats {
  distance: number;
  kills: number;
  died: boolean;
  upgradeLevel: number;
  basicLeft: number;
  vectorLeft: number;
}

type Keys = { up: boolean; down: boolean; left: boolean; right: boolean };

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  vector: boolean;
}

interface Enemy {
  x: number;
  y: number;
  vy: number;
  hp: number;
}

interface Pickup {
  x: number;
  y: number;
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private w = 480;
  private h = 640;
  private running = false;
  private keys: Keys = { up: false, down: false, left: false, right: false };
  private px = 240;
  private py = 520;
  private hp = 100;
  private maxHp = 100;
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private kills = 0;
  private distance = 0;
  private elapsed = 0;
  private spawnTimer = 0;
  private fireCooldown = 0;
  private ammoMode: AmmoMode = "basic";
  private basicLeft = 0;
  private vectorLeft = 0;
  private weaponKind = "cannon";
  private upgradeLevel = 0;
  private onEnd: (stats: RunStats) => void;
  private raf = 0;
  private lastTime = 0;

  private readonly onKeyDown = (e: KeyboardEvent) => this.onKey(e, true);
  private readonly onKeyUp = (e: KeyboardEvent) => this.onKey(e, false);

  constructor(
    canvas: HTMLCanvasElement,
    loadout: Loadout,
    onEnd: (stats: RunStats) => void,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");
    this.ctx = ctx;
    this.canvas = canvas;
    canvas.width = this.w;
    canvas.height = this.h;
    canvas.tabIndex = 0;
    this.weaponKind = loadout.weaponKind;
    this.basicLeft = loadout.basicRounds;
    this.vectorLeft = loadout.vectorRounds;
    this.upgradeLevel = loadout.upgradeLevel;
    this.onEnd = onEnd;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  /** Test hook: advance simulation without rendering. */
  tick(dt: number, fireStarter = false) {
    if (fireStarter) this.fireStarterGun();
    this.update(dt);
  }

  getDistance(): number {
    return this.distance;
  }

  setAmmoMode(mode: AmmoMode) {
    this.ammoMode = mode;
  }

  start() {
    this.running = true;
    this.canvas.focus();
    this.loop(0);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  returnToHangar() {
    this.finish(false);
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (!this.running) return;

    const map: Record<string, keyof Keys> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };
    const k = map[e.key];
    if (k) {
      e.preventDefault();
      this.keys[k] = down;
    }
    if (down && e.key === " ") {
      e.preventDefault();
      this.tryFire();
    }
    if (down && e.key === "1") {
      e.preventDefault();
      this.ammoMode = "basic";
    }
    if (down && e.key === "2") {
      e.preventDefault();
      this.ammoMode = "vector";
    }
  }

  private tryFire() {
    if (this.fireCooldown > 0) return;
    if (this.ammoMode === "vector") {
      if (this.vectorLeft <= 0) return;
      this.vectorLeft -= 1;
      this.fireVectorShot();
      return;
    }
    if (this.weaponKind === "gattler" && this.basicLeft > 0) {
      this.basicLeft -= 1;
      this.fireGattlerVolley();
      return;
    }
    this.fireStarterGun();
  }

  private fireStarterGun() {
    this.fireCooldown = 0.22;
    const dmg = 1 + this.upgradeLevel;
    this.bullets.push({
      x: this.px,
      y: this.py - 12,
      vx: 0,
      vy: -7,
      damage: dmg,
      vector: false,
    });
  }

  private fireVectorShot() {
    this.fireCooldown = 0.28;
    const dmg = 3 + this.upgradeLevel;
    this.bullets.push({
      x: this.px,
      y: this.py - 12,
      vx: 0,
      vy: -9,
      damage: dmg,
      vector: true,
    });
  }

  private fireGattlerVolley() {
    this.fireCooldown = 0.12;
    const dmg = 1 + this.upgradeLevel;
    const speed = 7;
    for (const spread of [-0.15, 0, 0.15]) {
      this.bullets.push({
        x: this.px,
        y: this.py - 12,
        vx: spread * 4,
        vy: -speed,
        damage: dmg,
        vector: false,
      });
    }
  }

  private loop(ts: number) {
    if (!this.running) return;
    const dt = Math.min(0.05, this.lastTime ? (ts - this.lastTime) / 1000 : 0.016);
    this.lastTime = ts;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private difficulty() {
    return 1 + this.elapsed / 45;
  }

  private update(dt: number) {
    this.elapsed += dt;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    const speed = 180;
    if (this.keys.up) this.py -= speed * dt;
    if (this.keys.down) this.py += speed * dt;
    if (this.keys.left) this.px -= speed * dt;
    if (this.keys.right) this.px += speed * dt;
    this.px = Math.max(20, Math.min(this.w - 20, this.px));
    this.py = Math.max(80, Math.min(this.h - 20, this.py));

    this.distance += 40 * dt * this.difficulty();

    this.spawnTimer -= dt;
    const diff = this.difficulty();
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.35, 1.4 - diff * 0.08);
      this.enemies.push({
        x: 40 + Math.random() * (this.w - 80),
        y: -20,
        vy: 60 + diff * 25,
        hp: Math.ceil(diff),
      });
    }

    for (const b of this.bullets) {
      b.x += b.vx;
      b.y += b.vy * 60 * dt;
    }
    this.bullets = this.bullets.filter((b) => b.y > -10 && b.y < this.h + 10);

    for (const e of this.enemies) {
      e.y += e.vy * dt;
    }

    for (const e of this.enemies) {
      for (const b of this.bullets) {
        if (
          Math.abs(e.x - b.x) < 18 &&
          Math.abs(e.y - b.y) < 18 &&
          e.hp > 0
        ) {
          e.hp -= b.damage;
          b.y = -999;
          if (e.hp <= 0) {
            this.kills += 1;
            if (Math.random() < 0.12) {
              this.pickups.push({ x: e.x, y: e.y });
            }
          }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.y < this.h + 30 && e.hp > 0);

    for (const p of this.pickups) {
      p.y += 40 * dt;
      if (Math.abs(p.x - this.px) < 22 && Math.abs(p.y - this.py) < 22) {
        this.upgradeLevel += 1;
        p.y = 9999;
      }
    }
    this.pickups = this.pickups.filter((p) => p.y < this.h);

    for (const e of this.enemies) {
      if (Math.abs(e.x - this.px) < 20 && Math.abs(e.y - this.py) < 20) {
        this.hp -= 35 * dt;
      }
    }

    if (this.hp <= 0) {
      this.respawnAtCheckpoint();
    }
  }

  private respawnAtCheckpoint() {
    this.px = 240;
    this.py = 520;
    this.hp = this.maxHp;
    this.upgradeLevel = 0;
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
  }

  private finish(died: boolean) {
    this.stop();
    this.onEnd({
      distance: Math.floor(this.distance),
      kills: this.kills,
      died,
      upgradeLevel: this.upgradeLevel,
      basicLeft: this.basicLeft,
      vectorLeft: this.vectorLeft,
    });
  }

  private draw() {
    const g = this.ctx;
    g.fillStyle = "#0d0c0a";
    g.fillRect(0, 0, this.w, this.h);

    g.strokeStyle = "#3d3528";
    for (let y = 0; y < this.h; y += 40) {
      g.beginPath();
      g.moveTo(0, (y + (this.elapsed * 30) % 40) % this.h);
      g.lineTo(this.w, (y + (this.elapsed * 30) % 40) % this.h);
      g.stroke();
    }

    for (const p of this.pickups) {
      g.fillStyle = "#b8860b";
      g.fillRect(p.x - 8, p.y - 8, 16, 16);
    }

    for (const e of this.enemies) {
      g.fillStyle = "#c45c3e";
      g.beginPath();
      g.moveTo(e.x, e.y + 14);
      g.lineTo(e.x - 14, e.y - 10);
      g.lineTo(e.x + 14, e.y - 10);
      g.closePath();
      g.fill();
    }

    for (const b of this.bullets) {
      g.fillStyle = b.vector ? "#e8c547" : "#f5f0e1";
      g.fillRect(b.x - 2, b.y - 6, 4, 10);
    }

    g.fillStyle = "#8b9bb4";
    g.beginPath();
    g.moveTo(this.px, this.py - 16);
    g.lineTo(this.px - 14, this.py + 12);
    g.lineTo(this.px + 14, this.py + 12);
    g.closePath();
    g.fill();

    g.fillStyle = "#f5f0e1";
    g.font = "12px monospace";
    g.fillText(`dist ${Math.floor(this.distance)}`, 8, 18);
    g.fillText(`kills ${this.kills}`, 8, 34);
    g.fillText(`upg ${this.upgradeLevel}`, 8, 50);
    g.fillText(
      `mode ${this.ammoMode} · feed ${this.basicLeft} · vector ${this.vectorLeft}`,
      8,
      66,
    );
    g.fillStyle = "#c45c3e";
    g.fillRect(8, 72, 100, 6);
    g.fillStyle = "#b8860b";
    g.fillRect(8, 72, this.hp, 6);
  }
}
