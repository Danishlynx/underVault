/**
 * Backdrop — THE WICKLESS DEEP (floors 21–24, near-black basalt).
 *
 * The distance layer behind the candle-lit world for the deepest biome, whose
 * identity is void: almost nothing. A single cluster of columnar-basalt
 * monoliths leans off the bottom-left corner at two fog stops (far barely
 * above void, near up to the surface2 ceiling), one hairline strata band
 * crosses the upper third — dimming as it passes the calm center — and five
 * or six single-pixel mineral glints sit in the outer ring. Two monolith
 * edges carry a ≤10% verdigrisDim whisper; everything else is void/surface2
 * math. The middle 50% of the frame stays near-pure void for the game world.
 * Colors via tokens + shade()/mix() only; jitter through a private seeded
 * LCG (never Math.random, never paint.ts crand).
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../paint.js";

// Private LCG (guildhall's hallRand pattern, own seed) — paint.ts crand()'s
// stream belongs to the world-texture painters and must not be touched.
function deepRand(seed: number): () => number {
  let s = seed >>> 0 || 0xdeeb;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintDeepBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = deepRand(0xdeeb);
  const s = Math.min(w, h);

  // ── 1. base wash — the only gradient in the frame, and barely one ─────────
  // Slightly crushed ceiling, pure void through the middle, the faintest
  // basalt-floor lift at the bottom. The center stays indistinguishable from
  // #0b0a10 so the world reads against true dark.
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, shade(C.void, 0.8));
  base.addColorStop(0.32, C.void);
  base.addColorStop(0.78, C.void);
  base.addColorStop(1, mix(C.void, C.surface, 0.24));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. the strata band — one hairline across the upper third ──────────────
  // A geologist's memory of a seam, bowed a hair, jittered by hand. It runs
  // edge to edge (never "ends") but drops to a whisper through the calm
  // middle so the center 50% keeps its blackness.
  const bandPts: Array<{ x: number; y: number }> = [];
  const STEPS = 26;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const bow = Math.sin(t * Math.PI) * h * 0.008;
    bandPts.push({ x: t * w, y: h * 0.212 + bow + (rand() - 0.5) * h * 0.004 });
  }
  const strokeBand = (t0: number, t1: number, a: number): void => {
    ctx.strokeStyle = mix(C.void, C.surface2, 0.9, a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (const p of bandPts) {
      const t = p.x / w;
      if (t < t0 || t > t1) continue;
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  };
  strokeBand(0, 1, 0.09); // continuous ghost
  strokeBand(0, 0.3, 0.16); // firmer at the frame edges only
  strokeBand(0.7, 1, 0.16);

  // ── 3. the monolith cluster, bottom-left — flat quads, crisp edges ────────
  // Columnar basalt: each slab a straight-sided quad with a tilted (or
  // chamfered) top. One shared fill per fog stop keeps the woodcut flatness.
  type Slab = { x0: number; x1: number; y0: number; y1: number; peak?: [number, number] };
  const slab = (sl: Slab, fill: string): void => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(sl.x0 * w, h);
    ctx.lineTo(sl.x0 * w, sl.y0 * h);
    if (sl.peak) ctx.lineTo(sl.peak[0] * w, sl.peak[1] * h);
    ctx.lineTo(sl.x1 * w, sl.y1 * h);
    ctx.lineTo(sl.x1 * w, h);
    ctx.closePath();
    ctx.fill();
  };
  const jit = (): number => (rand() - 0.5) * 0.012;

  // fog stop 1 — far columns, barely above void, running off the left edge.
  // Everything past x=0.25w stays below y=0.75h: the calm center is law.
  const farCol = mix(C.void, C.surface2, 0.3);
  slab({ x0: -0.06, x1: 0.075, y0: 0.555 + jit(), y1: 0.6 + jit() }, farCol);
  slab({ x0: 0.055, x1: 0.135, y0: 0.632 + jit(), y1: 0.615 + jit() }, farCol);
  slab({ x0: 0.12, x1: 0.21, y0: 0.742 + jit(), y1: 0.772 + jit() }, farCol);
  slab({ x0: 0.19, x1: 0.3, y0: 0.836 + jit(), y1: 0.862 + jit() }, farCol);

  // fog stop 2 — near slabs, up to the ceiling tone, overlapping the far ones
  const nearCol = mix(C.void, C.surface2, 0.62);
  const slabA: Slab = { x0: -0.05, x1: 0.045, y0: 0.664 + jit(), y1: 0.702 + jit() };
  const slabB: Slab = { x0: 0.035, x1: 0.105, y0: 0.622, y1: 0.606, peak: [0.062, 0.586 + jit()] };
  slab(slabA, nearCol);
  slab(slabB, nearCol);
  slab({ x0: 0.09, x1: 0.155, y0: 0.762 + jit(), y1: 0.744 + jit() }, nearCol);

  // one columnar joint inside the tallest slab — texture without noise
  ctx.strokeStyle = shade(nearCol, 0.72, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(slabB.peak![0] * w + w * 0.006, slabB.peak![1] * h + h * 0.012);
  ctx.lineTo(slabB.peak![0] * w + w * 0.002, h);
  ctx.stroke();

  // ── 4. the verdigris whisper — ≤10% accent on exactly two edges ───────────
  const accent = mix(shade(nearCol, 1.22), C.verdigrisDim, 0.1, 0.55);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  // edge one: the tall slab's left face
  ctx.beginPath();
  ctx.moveTo(slabB.x0 * w + 0.5, slabB.y0 * h);
  ctx.lineTo(slabB.x0 * w + 0.5, h * 0.92);
  ctx.stroke();
  // edge two: the off-frame slab's tilted crown
  ctx.beginPath();
  ctx.moveTo(0, slabA.y0 * h + (slabA.y1 - slabA.y0) * h * (0.05 / 0.095) * 0.5);
  ctx.lineTo(slabA.x1 * w, slabA.y1 * h);
  ctx.stroke();

  // ── 5. mineral glints — 6 single pixels in the outer ring, never the calm ─
  // Not stars: flecks of something crystalline in the basalt, two of them on
  // the monoliths themselves. All outside the middle-50% box on both axes.
  const px = Math.max(1, Math.round(s * 0.0022));
  const glints: Array<[number, number, number, number]> = [
    // [fx, fy, mix-toward-bone, alpha]
    [0.115, 0.545, 0.45, 0.5], // crown of the far column
    [0.056, 0.638, 0.5, 0.55], // face of the tall near slab
    [0.31, 0.884, 0.42, 0.42],
    [0.845, 0.792, 0.46, 0.5],
    [0.905, 0.338, 0.4, 0.38],
    [0.755, 0.142, 0.44, 0.45],
  ];
  for (const [fx, fy, t, a] of glints) {
    ctx.fillStyle = mix(C.void, C.bone, t + rand() * 0.06, a);
    ctx.fillRect(Math.round(fx * w), Math.round(fy * h), px, px);
  }
}
