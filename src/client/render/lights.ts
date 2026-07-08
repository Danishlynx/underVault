/**
 * Iso fog-of-war + candle halo (placeholder light rig; the v4 point-light
 * rig with normal-mapped wall faces lands at W4). Fog darkens GROUND
 * diamonds only (a single Graphics above the tilemap layer, below all
 * billboards) — billboards self-dim via visibility rules in the scene.
 * Flicker is renderer-only cosmetics (the fx stream stays quarantined).
 */

import type Phaser from "phaser";
import { COLOR } from "../../../design/tokens/tokens.js";
import type { SimState } from "../../shared/sim/types.js";
import { gridToScreen, HALF_H, HALF_W, TILE_H, TILE_W } from "./iso.js";

export function drawFog(g: Phaser.GameObjects.Graphics, s: SimState, visible: Uint8Array): void {
  g.clear();
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x;
      if (visible[i]! === 1) continue;
      const alpha = s.seen[i]! === 1 ? 0.62 : 1;
      const c = gridToScreen(x, y);
      g.fillStyle(COLOR.void, alpha);
      g.beginPath();
      g.moveTo(c.sx, c.sy - HALF_H);
      g.lineTo(c.sx + HALF_W, c.sy);
      g.lineTo(c.sx, c.sy + HALF_H);
      g.lineTo(c.sx - HALF_W, c.sy);
      g.closePath();
      g.fillPath();
    }
  }
}

/** Elliptical (2:1) candle glow centered on the player's diamond. */
export function positionHalo(halo: Phaser.GameObjects.Image, s: SimState, radius: number): void {
  if (radius <= 0) {
    halo.setVisible(false);
    return;
  }
  halo.setVisible(true);
  const dw = (radius * 2 + 1) * TILE_W * 0.85;
  const dh = (radius * 2 + 1) * TILE_H * 0.85;
  halo.setDisplaySize(dw, dh);
  const c = gridToScreen(s.px, s.py);
  halo.setPosition(c.sx, c.sy);
}

/** Per-frame cosmetic flicker for guttering tiers (client-only randomness). */
export function flickerHalo(halo: Phaser.GameObjects.Image, radius: number): void {
  if (!halo.visible) return;
  if (radius <= 2 && radius > 0) {
    halo.setAlpha(0.75 + Math.random() * 0.25 * (radius === 1 ? 1 : 0.5));
  } else {
    halo.setAlpha(1);
  }
}
