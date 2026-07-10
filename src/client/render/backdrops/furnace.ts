/**
 * Backdrop — THE GLASSBLACK FURNACES (floors 13–16, charred obsidian).
 *
 * The distance layer behind the candle-lit iso world: jagged black-glass
 * skylines at two fog stops — a far shard horizon barely above void, near
 * angular masses rising from the bottom corners and stabbing down from the
 * cavern ceiling — with the broken arch of a dead furnace sinking off the
 * left edge. Everything derives from void/surface/surface2 and sits under
 * the luminance ceiling; the single permitted warm exception is a handful
 * of hairline ember fissures cooling inside the nearest shards. The middle
 * 50% of the frame stays near-pure void — the game world renders over it.
 * Colors via tokens + shade()/mix() only; jitter via a private seeded LCG.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../paint.js";

// Private LCG (story slides' pattern, own seed) — never Math.random, never
// paint.ts crand (its stream belongs to the world-texture painters).
function furnaceRand(seed: number): () => number {
  let s = seed >>> 0 || 0xfa9e;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintFurnaceBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = furnaceRand(0xfa9e);
  const s = Math.min(w, h);

  // Fog stops — far shards barely above void; near shards up to the ceiling
  // tone mix(void, surface2, 1.0). Nothing painted brighter than surface2.
  const FAR = mix(C.void, C.surface2, 0.22);
  const MID = mix(C.void, C.surface2, 0.36);
  const NEAR = mix(C.void, C.surface2, 0.56);
  const SHEEN = mix(C.void, C.surface2, 0.95, 0.4); // glassy fracture-edge hairline

  // Flat closed silhouette from fractional [x, y] pairs, ±jy vertical jitter.
  const massOf = (pts: ReadonlyArray<readonly [number, number]>, fill: string, jy: number): void => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    let first = true;
    for (const [fx, fy] of pts) {
      const px = fx * w;
      const py = fy * h + (fy > -0.02 && fy < 1.02 ? (rand() - 0.5) * jy * h : 0);
      if (first) {
        ctx.moveTo(px, py);
        first = false;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
  };

  // ── 1. base wash — the one soft gradient: faint ceiling lift, void core ───
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, mix(C.void, C.surface, 0.22));
  base.addColorStop(0.2, C.void);
  base.addColorStop(0.78, C.void);
  base.addColorStop(1, shade(C.void, 0.82));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. far ceiling row — fog stop 1, a shallow serrated fringe up top ─────
  massOf(
    [
      [-0.05, -0.05], [-0.05, 0.055], [-0.02, 0.1], [0.03, 0.03], [0.08, 0.13],
      [0.12, 0.045], [0.18, 0.155], [0.23, 0.05], [0.3, 0.12], [0.36, 0.04],
      [0.42, 0.15], [0.47, 0.05], [0.54, 0.11], [0.6, 0.035], [0.66, 0.14],
      [0.72, 0.05], [0.78, 0.16], [0.84, 0.06], [0.9, 0.125], [0.95, 0.04],
      [1.02, 0.11], [1.05, 0.05], [1.05, -0.05],
    ],
    FAR,
    0.012,
  );

  // ── 3. far shard horizon — fog stop 1, low across the center, rising off
  //      both side edges so the composition never visibly ends ───────────────
  massOf(
    [
      [-0.05, 0.6], [0.015, 0.545], [0.05, 0.72], [0.09, 0.63], [0.135, 0.84],
      [0.175, 0.7], [0.21, 0.86], [0.26, 0.8], [0.315, 0.875], [0.36, 0.81],
      [0.425, 0.885], [0.475, 0.825], [0.53, 0.88], [0.585, 0.815], [0.64, 0.885],
      [0.685, 0.805], [0.73, 0.87], [0.77, 0.76], [0.8, 0.62], [0.845, 0.78],
      [0.885, 0.545], [0.925, 0.7], [0.97, 0.52], [1.05, 0.58], [1.05, 1.1], [-0.05, 1.1],
    ],
    FAR,
    0.01,
  );

  // ── 4. distant strata — thin tilted bedding planes across the bottom ──────
  ctx.globalAlpha = 0.45;
  for (const [yL, yR, th] of [
    [0.888, 0.902, 0.007],
    [0.928, 0.916, 0.009],
    [0.964, 0.974, 0.012],
  ] as const) {
    massOf(
      [[-0.02, yL], [1.02, yR], [1.02, yR + th], [-0.02, yL + th]],
      MID,
      0.004,
    );
  }
  ctx.globalAlpha = 1;

  // ── 5. the dead furnace — a broken arch sinking off the left edge ─────────
  massOf(
    [
      [-0.08, 0.4], [0.0, 0.365], [0.05, 0.42], [0.1, 0.38], [0.14, 0.47],
      [0.175, 0.44], [0.2, 0.56], [0.215, 0.7], [0.2, 0.78], [0.235, 0.86],
      [0.235, 1.05], [-0.08, 1.05],
    ],
    MID,
    0.008,
  );
  // its mouth — an arched opening, void showing through, half off-frame
  const acx = w * 0.045;
  const aw = w * 0.085;
  const springY = h * 0.63;
  const crownY = h * 0.51;
  const mouth = new Path2D();
  mouth.moveTo(acx - aw, h * 1.02);
  mouth.lineTo(acx - aw, springY);
  mouth.quadraticCurveTo(acx - aw, crownY, acx, crownY);
  mouth.quadraticCurveTo(acx + aw, crownY, acx + aw, springY);
  mouth.lineTo(acx + aw, h * 1.02);
  mouth.closePath();
  ctx.fillStyle = shade(C.void, 0.92);
  ctx.fill(mouth);
  // intrados hairline — the arch curve just barely catches the dark
  ctx.strokeStyle = mix(C.void, C.surface2, 0.8, 0.3);
  ctx.lineWidth = 1;
  ctx.stroke(mouth);

  // ── 6. near shard masses — fog stop 2, the bottom corners ─────────────────
  // left cluster, crowding the furnace mouth
  massOf(
    [
      [-0.06, 1.05], [-0.03, 0.72], [0.02, 0.86], [0.06, 0.665], [0.095, 0.83],
      [0.13, 0.74], [0.17, 0.92], [0.21, 0.845], [0.27, 1.02],
    ],
    NEAR,
    0.008,
  );
  // right cluster, the tallest glass in the frame
  massOf(
    [
      [0.7, 1.05], [0.735, 0.87], [0.765, 0.79], [0.78, 0.55], [0.815, 0.72],
      [0.85, 0.46], [0.885, 0.63], [0.92, 0.52], [0.96, 0.76], [1.0, 0.62],
      [1.06, 0.7], [1.06, 1.05],
    ],
    NEAR,
    0.008,
  );

  // ── 7. near ceiling shards — fewer, sharper, stabbing deeper ──────────────
  massOf(
    [
      [-0.05, -0.05], [-0.05, 0.03], [0.02, 0.05], [0.06, 0.205], [0.095, 0.04],
      [0.16, 0.06], [0.21, 0.02], [0.27, 0.045], [0.305, 0.17], [0.345, 0.03],
      [0.42, 0.05], [0.475, 0.015], [0.52, 0.225], [0.555, 0.04], [0.63, 0.06],
      [0.665, 0.02], [0.71, 0.185], [0.75, 0.035], [0.82, 0.055], [0.855, 0.015],
      [0.895, 0.23], [0.93, 0.05], [0.97, 0.02], [1.05, 0.04], [1.05, -0.05],
    ],
    NEAR,
    0.007,
  );

  // ── 8. fracture-edge sheen — a few 1px facets where glass meets void ──────
  ctx.strokeStyle = SHEEN;
  ctx.lineWidth = 1;
  for (const [x0, y0, x1, y1] of [
    [0.85, 0.46, 0.815, 0.72], // right cluster main peak, lit flank
    [0.78, 0.55, 0.765, 0.79],
    [0.06, 0.665, 0.02, 0.86], // left cluster peak
    [0.52, 0.225, 0.475, 0.015], // longest ceiling shard
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x0 * w, y0 * h);
    ctx.lineTo(x1 * w, y1 * h);
    ctx.stroke();
  }

  // ── 9. ember fissures — the ONE warm exception: hairline cracks cooling
  //      inside the nearest shards. Pixels, not fields; no glow. ─────────────
  const fissure = (x0: number, y0: number, x1: number, y1: number, a: number): void => {
    ctx.strokeStyle = shade(C.ember, 1, a);
    ctx.lineWidth = Math.max(1, Math.min(2, s * 0.002));
    ctx.beginPath();
    ctx.moveTo(x0 * w, y0 * h);
    const n = 4;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      ctx.lineTo(
        (x0 + (x1 - x0) * t) * w + (rand() - 0.5) * w * 0.008,
        (y0 + (y1 - y0) * t) * h + (rand() - 0.5) * h * 0.005,
      );
    }
    ctx.stroke();
  };
  fissure(0.788, 0.7, 0.845, 0.755, 0.6); // right cluster, low
  fissure(0.878, 0.615, 0.916, 0.7, 0.55); // right cluster, high
  fissure(0.055, 0.745, 0.115, 0.8, 0.6); // left cluster
  fissure(0.505, 0.09, 0.522, 0.185, 0.5); // longest ceiling shard, faintest
}
