/**
 * Phaser 4 game bootstrap (WebGL-only, roundPixels — 02 §8).
 *
 * The surface fills its container — no letterboxing, no dead margins
 * (operator: Reddit embeds are small; waste nothing). 480×854 remains the
 * DESIGN reference for HUD metrics (04), but the surface adapts to any aspect;
 * HUD re-flows via Hud.layout and the world camera fills the frame via
 * iso.fitZoom. Flagged vs the "decided" fixed internal res in DECISIONS (D62).
 *
 * HIGH-DPI (D121): the WebGL backing store renders at the device pixel ratio
 * (capped at UI_MAX_DPR=2 — the crispness/perf sweet spot; 3× is 9× the pixels
 * for no perceptible gain and tanks phone fps) while the canvas DISPLAYS at the
 * logical CSS size. On a phone (dpr ~2.5–3) the old RESIZE path sized the buffer
 * to 1× CSS px and let the browser upscale it → muddy. Phaser 4 couples the
 * drawing buffer, cameras AND camera-fit to `gameSize` (no separate render
 * resolution — the v3 `resolution` config was removed), so the whole scene is
 * authored in PHYSICAL pixels: the world stays apparent-size-correct because
 * iso.fitZoom scales with gameSize, and the HUD compensates via uiScale()
 * (render/hud.ts). We drive Scale.NONE by hand so the buffer (physical) and the
 * CSS display size (logical) can differ — RESIZE mode forces them equal.
 */

import Phaser from "phaser";
import { COLOR } from "../../design/tokens/tokens.js";
import type { GamePorts } from "./net/ports.js";
import { BootScene } from "./scenes/Boot.js";
import { DescentScene } from "./scenes/Descent.js";

export const PORTS_KEY = "uv-ports";

/**
 * Effective device-pixel-ratio cap. Back to 2× (D124): the movement lag was
 * the server round-trips, NOT the GPU — dropping to 1.5× only softened the art
 * for nothing (operator: "graphics fine, server lagging... it's looking lowered
 * resolution"). 2× is crisp; the phone renders it fine.
 */
export const UI_MAX_DPR = 2;

/**
 * The single DPR factor everything renders at (game buffer, HUD compensation,
 * Descent chrome). Read live so a mid-session ratio change (window dragged
 * between monitors) stays consistent across the three call sites.
 */
export function uiScale(): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.min(Math.max(dpr, 1), UI_MAX_DPR);
}

export function createUndervaultGame(parent: HTMLElement, ports: GamePorts): Phaser.Game {
  // D125: clamp to the VISUAL viewport when available — on mobile the layout
  // viewport can exceed what is actually visible (browser chrome / webview
  // bars) and the bottom HUD bar rendered below the fold.
  const logicalW = (): number => {
    const vv = window.visualViewport;
    const base = Math.max(1, parent.clientWidth || 480);
    return vv !== null && vv !== undefined ? Math.max(1, Math.min(base, Math.floor(vv.width))) : base;
  };
  const logicalH = (): number => {
    const vv = window.visualViewport;
    const base = Math.max(1, parent.clientHeight || 854);
    return vv !== null && vv !== undefined ? Math.max(1, Math.min(base, Math.floor(vv.height))) : base;
  };

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    backgroundColor: COLOR.void,
    // NOT pixelArt (D68): that flag forces NEAREST filtering — right for
    // retro sprites, ruinous for our supersampled painterly masters (it
    // was the "why is everything pixelated" bug). Linear + mipmaps keeps
    // the 4× masters crisp at every camera zoom.
    antialias: true,
    mipmapFilter: "LINEAR_MIPMAP_LINEAR",
    roundPixels: true, // v4 defaults false — set explicitly (02 §8)
    scale: {
      // NONE: we own the buffer/CSS split. width/height are the PHYSICAL
      // backing size; applyBacking() sets the CSS display size below.
      mode: Phaser.Scale.NONE,
      width: Math.round(logicalW() * uiScale()),
      height: Math.round(logicalH() * uiScale()),
    },
    scene: [BootScene, DescentScene],
  });
  game.registry.set(PORTS_KEY, ports);

  // Size the drawing buffer to logical × dpr, but display the canvas at logical
  // CSS pixels — the browser down-samples the supersampled buffer → crisp.
  const applyBacking = (): void => {
    if (game.canvas === null || game.canvas === undefined || game.scale === undefined) return;
    const f = uiScale();
    const cssW = logicalW();
    const cssH = logicalH();
    const bw = Math.round(cssW * f);
    const bh = Math.round(cssH * f);
    // resize() sets gameSize + baseSize + canvas buffer and fires RESIZE, which
    // re-flows the cameras (world fit), the HUD and the grain layer.
    if (game.scale.width !== bw || game.scale.height !== bh) game.scale.resize(bw, bh);
    const style = game.canvas.style;
    style.width = cssW + "px";
    style.height = cssH + "px";
    style.display = "block";
  };

  // canvas only exists once boot completes — set the CSS size then, and keep it
  // aligned on viewport/orientation/embed-reflow changes.
  game.events.once(Phaser.Core.Events.READY, applyBacking);
  const onResize = (): void => applyBacking();
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  window.visualViewport?.addEventListener("resize", onResize); // mobile chrome show/hide (D125)
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
  ro?.observe(parent);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    ro?.disconnect();
  });
  return game;
}
