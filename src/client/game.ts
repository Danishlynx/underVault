/**
 * Phaser 4 game bootstrap (WebGL-only, roundPixels — 02 §8).
 * RESIZE scaling: the canvas is every pixel of its container — no
 * letterboxing, no dead margins (operator: Reddit embeds are small; waste
 * nothing). 480×854 remains the DESIGN reference for HUD metrics (04), but
 * the surface adapts to any aspect; HUD re-flows via Hud.layout and the
 * world camera fills the frame via iso.fitZoom. Flagged vs the "decided"
 * fixed internal res in DECISIONS (D62).
 */

import Phaser from "phaser";
import { COLOR_CSS } from "../../design/tokens/tokens.js";
import type { GamePorts } from "./net/ports.js";
import { BootScene } from "./scenes/Boot.js";
import { DescentScene } from "./scenes/Descent.js";
import { BACKDROPS } from "./render/backdrops/index.js";

export const PORTS_KEY = "uv-ports";
export const BACKDROP_KEY = "uv-paint-backdrop";

export function createUndervaultGame(parent: HTMLElement, ports: GamePorts): Phaser.Game {
  // the distance layer (D82): a DOM canvas UNDER a transparent game canvas
  // carries the per-biome painted cavern backdrop — an authored composition,
  // not procedural scatter (that era is closed; see DECISIONS D82)
  const backdrop = document.createElement("canvas");
  backdrop.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;";
  backdrop.style.background = COLOR_CSS.void;
  parent.appendChild(backdrop);
  let lastBi = 0;
  const paintBackdrop = (bi: number): void => {
    lastBi = bi;
    const rect = parent.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    backdrop.width = Math.round(w * dpr);
    backdrop.height = Math.round(h * dpr);
    const ctx = backdrop.getContext("2d");
    if (ctx === null) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = COLOR_CSS.void;
    ctx.fillRect(0, 0, w, h);
    (BACKDROPS[bi] ?? BACKDROPS[0])?.(ctx, w, h);
  };
  paintBackdrop(0);
  const ro = new ResizeObserver(() => paintBackdrop(lastBi));
  ro.observe(parent);

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    transparent: true, // the painted backdrop shows through the dark (D82)
    // NOT pixelArt (D68): that flag forces NEAREST filtering — right for
    // retro sprites, ruinous for our supersampled painterly masters (it
    // was the "why is everything pixelated" bug). Linear + mipmaps keeps
    // the 4× masters crisp at every camera zoom.
    antialias: true,
    mipmapFilter: "LINEAR_MIPMAP_LINEAR",
    roundPixels: true, // v4 defaults false — set explicitly (02 §8)
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || 480,
      height: parent.clientHeight || 854,
    },
    scene: [BootScene, DescentScene],
  });
  game.registry.set(PORTS_KEY, ports);
  game.registry.set(BACKDROP_KEY, paintBackdrop);
  // the game canvas must sit ABOVE the absolutely-positioned backdrop
  game.events.once(Phaser.Core.Events.READY, () => {
    game.canvas.style.position = "relative";
    game.canvas.style.zIndex = "1";
  });
  return game;
}
