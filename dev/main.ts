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

// DEV-ONLY: M = the Tower X-Ray (all 25 floors of today's seed at a glance)
window.addEventListener("keydown", (ev) => {
  if (ev.key !== "m" && ev.key !== "M") return;
  const t = ev.target as HTMLElement | null;
  if (t !== null && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
  toggleTowerView(parent, ports, ports.getGuildhall().day, game);
});
