// DEV-ONLY: deleted at M2 (replaced by src/client/game.ts bootstrapping from
// the Devvit expanded entrypoint with real network ports).

import "../design/tokens/tokens.css"; // via the module graph — a <link> to a
// path above the vite root 404s silently and strips every DOM sheet's theme
import Phaser from "phaser";
import { createUndervaultGame } from "../src/client/game.js";
import { createDevPorts } from "./rules-adapter.js";
import { toggleTowerView } from "./tower-view.js";

// DEV-ONLY: standalone plate preview — `/?plate=meeting1` paints a single
// story painter fullscreen with no game booted, so parallel slide artists
// iterate through snap.ts with zero shared state (never wire unfinished
// plates into story.ts just to see them)
function bootPlatePreview(plate: string): void {
  const cv = document.createElement("canvas");
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
  cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;background:#000";
  document.body.appendChild(cv);
  const ctx = cv.getContext("2d");
  if (ctx === null) throw new Error("plate preview: no 2d context");
  // the vite dev server compiles /src modules on demand — dev-only, unbundled
  void import(/* @vite-ignore */ `/src/client/ui/story/${plate}.ts`).then((m: Record<string, unknown>) => {
    const fn = Object.entries(m).find(([k, v]) => k.startsWith("paint") && typeof v === "function")?.[1] as
      | ((c: CanvasRenderingContext2D, w: number, h: number) => void)
      | undefined;
    if (fn === undefined) throw new Error(`plate preview: no paint* export in ${plate}.ts`);
    fn(ctx, cv.width, cv.height);
    console.log(`[plate] painted ${plate} at ${cv.width}x${cv.height}`);
  });
}

const plateParam = new URLSearchParams(window.location.search).get("plate");
if (plateParam !== null && /^[a-z0-9-]+$/i.test(plateParam)) {
  bootPlatePreview(plateParam);
} else {
  bootGame();
}

function bootGame(): void {
  const parent = document.getElementById("app");
  if (parent === null) throw new Error("dev harness: #app missing");

  const ports = createDevPorts();
  const game = createUndervaultGame(parent, ports);
  // DEV-ONLY: deleted at M2 — probes read live sim state through this handle
  (window as unknown as { __uvGame?: Phaser.Game }).__uvGame = game;

  // DEV-ONLY: perf rig — Phaser has no WebGL draw-call counter, so count GL
  // draws ourselves and pipe fps+draws through the snap console relay (D75)
  game.events.once(Phaser.Core.Events.READY, () => {
    const r = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const gl = r.gl;
    let draws = 0;
    let lastDraws = 0;
    const de = gl.drawElements.bind(gl);
    const da = gl.drawArrays.bind(gl);
    gl.drawElements = (m: number, c: number, t: number, o: number): void => {
      draws++;
      de(m, c, t, o);
    };
    gl.drawArrays = (m: number, f: number, c: number): void => {
      draws++;
      da(m, f, c);
    };
    game.events.on(Phaser.Core.Events.POST_RENDER, () => {
      lastDraws = draws;
      draws = 0;
    });
    window.setInterval(() => {
      console.log(`[perf] fps=${game.loop.actualFps.toFixed(1)} draws=${lastDraws}`);
    }, 2000);
  });

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
}
