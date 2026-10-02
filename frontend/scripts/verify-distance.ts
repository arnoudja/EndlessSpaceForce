/**
 * Quick regression: firing many times must not reset distance; starter gun works at 0 ammo.
 */
import { JSDOM } from "jsdom";
import { Game } from "../src/game";

const dom = new JSDOM("<!DOCTYPE html><canvas id=c></canvas>");
const canvas = dom.window.document.getElementById("c") as HTMLCanvasElement;
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

for (let i = 0; i < 20; i++) {
  game.tick(0.1, true);
}
const d = game.getDistance();
if (d <= 0) {
  console.error("FAIL: distance did not advance after ticks", d);
  process.exit(1);
}
if (ended.length > 0) {
  console.error("FAIL: run ended unexpectedly", ended);
  process.exit(1);
}
console.log("OK: distance", Math.floor(d), "after 20 shots; no run/end");
