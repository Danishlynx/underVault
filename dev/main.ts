// DEV-ONLY: deleted at M2 (replaced by src/client/game.ts bootstrapping from
// the Devvit expanded entrypoint with real network ports).

import "../design/tokens/tokens.css"; // via the module graph — a <link> to a
// path above the vite root 404s silently and strips every DOM sheet's theme
import { createUndervaultGame } from "../src/client/game.js";
import { createDevPorts } from "./rules-adapter.js";
import { toggleTowerView } from "./tower-view.js";

const parent = document.getElementById("app");
if (parent === null) throw new Error("dev harness: #app missing");

const ports = createDevPorts();
const game = createUndervaultGame(parent, ports);

// DEV-ONLY: P = the Tower X-Ray (all 25 floors at a glance; click a floor
// to teleport there). M is the in-game next-floor skip (Descent handles it).
window.addEventListener("keydown", (ev) => {
  if (ev.key !== "p" && ev.key !== "P") return;
  const t = ev.target as HTMLElement | null;
  if (t !== null && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
  toggleTowerView(parent, ports, ports.getGuildhall().day, game, (floor) => {
    game.events.emit("uv-dev-teleport", floor);
  });
});
