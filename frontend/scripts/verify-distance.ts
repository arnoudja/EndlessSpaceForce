/**
 * Regression: held fire keeps shooting; distance does not reset.
 */
import { JSDOM } from "jsdom";
import { Game } from "../src/game";

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
};
canvas.getContext = () => ctx as CanvasRenderingContext2D;

const ended: unknown[] = [];
const game = new Game(
  canvas,
  { weaponKind: "cannon", basicRounds: 0, vectorRounds: 0, upgradeLevel: 0 },
  (s) => ended.push(s),
);

for (let i = 0; i < 60; i++) {
  game.tick(0.05, { fireHeld: true });
}
const d = game.getDistance();
const shots = game.bulletsFired;
if (d <= 0) {
  console.error("FAIL: distance did not advance", d);
  process.exit(1);
}
if (shots <= 5) {
  console.error("FAIL: held fire stopped early, shots=", shots);
  process.exit(1);
}
if (ended.length > 0) {
  console.error("FAIL: run ended unexpectedly", ended);
  process.exit(1);
}
console.log(
  "OK: distance",
  Math.floor(d),
  "shots",
  shots,
  "with held fire (no ammo)",
);
