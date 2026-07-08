/**
 * Fog-of-war + candle halo (placeholder light rig; the real v4 point-light
 * rig with normal maps lands at W4). Fog: unseen = solid void, seen = dim
 * memory, visible = clear. Flicker is renderer-only cosmetics (invariant 1:
 * the fx stream is reserved; validated state never sees any of this).
 */

import type Phaser from "phaser";
import { COLOR, CANVAS } from "../../../design/tokens/tokens.js";
import type { SimState } from "../../shared/sim/types.js";

const C = CANVAS.cellPx;

export function drawFog(g: Phaser.GameObjects.Graphics, s: SimState, visible: Uint8Array): void {
  g.clear();
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x;
      if (visible[i]! === 1) continue;
      const alpha = s.seen[i]! === 1 ? 0.62 : 1;
      g.fillStyle(COLOR.void, alpha);
      g.fillRect(x * C, y * C, C, C);
    }
  }
}

export function positionHalo(halo: Phaser.GameObjects.Image, s: SimState, radius: number): void {
  if (radius <= 0) {
    halo.setVisible(false);
    return;
  }
  halo.setVisible(true);
  const diameter = (radius * 2 + 1) * C * 1.45;
  halo.setDisplaySize(diameter, diameter);
  halo.setPosition(s.px * C + (C >> 1), s.py * C + (C >> 1));
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
