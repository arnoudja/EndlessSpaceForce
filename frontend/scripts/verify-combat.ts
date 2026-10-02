import { JSDOM } from "jsdom";
import { Game } from "../src/game";

function makeGame() {
  const dom = new JSDOM("<!DOCTYPE html><canvas id=c></canvas>");
  const { window } = dom;
  (globalThis as { window?: typeof window }).window = window;
  const canvas = window.document.getElementById("c") as HTMLCanvasElement;
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fillText: () => {},
    fill: () => {},
    arc: () => {},
  };
  canvas.getContext = () => ctx as CanvasRenderingContext2D;
  return new Game(
    canvas,
    { weaponKind: "cannon", basicRounds: 0, vectorRounds: 0, upgradeLevel: 0 },
    () => {},
  );
}

const early = makeGame();
for (let i = 0; i < 40; i++) early.tick(0.1);
const earlyDist = early.getDistance();

const late = makeGame();
for (let i = 0; i < 350; i++) late.tick(0.1);
const lateDist = late.getDistance();
const lateHostile = late.getHostileBulletCount();

if (lateDist <= earlyDist + 200) {
  console.error("FAIL: distance tier did not ramp", earlyDist, lateDist);
  process.exit(1);
}
if (lateHostile < 1) {
  console.error("FAIL: expected enemy fire at higher distance, hostile=", lateHostile);
  process.exit(1);
}
console.log(
  "OK: early dist",
  Math.floor(earlyDist),
  "late dist",
  Math.floor(lateDist),
  "hostile bolts seen",
  lateHostile,
);
