/**
 * Backdrop — THE BOTTOM (floor 25, the finale). The distance layer behind
 * the candle-lit world for the last room of the season: the Great Gate's
 * home, seen from inside. Every ring arc and every ridge line in the frame
 * converges on one point far beyond the top edge — the gate's hidden hub —
 * so the whole cavern reads as the interior of something circular and vast.
 * Two crown masses arc across the ceiling, flank arcs sweep past the side
 * edges, a great ring lies set into the floor, and from both bottom corners
 * rise ranks of votive-stub silhouettes, unlit. The one sanctioned warmth:
 * gold ink folded ≤12% into a single seam arc on the crown, plus three tiny
 * gold glints. Monumental, and almost invisible — the middle 50% of the
 * frame stays near-pure void for the game world.
 *
 * Guildhall painted-slide idiom: token colors via shade()/mix() only, flat
 * silhouette fills with crisp edges at distinct fog stops, no glow blobs,
 * jitter through a private seeded LCG (never Math.random, never crand).
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../paint.js";

// Private LCG (guildhall's hallRand pattern, own seed) — paint.ts crand()'s
// stream belongs to the world-texture painters and must not be touched.
function bottomRand(seed: number): () => number {
  let s = seed >>> 0 || 0x25b077;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

type Pt = { x: number; y: number };

export function paintBottomBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = bottomRand(0x25b077);
  const s = Math.min(w, h);

  // The gate's hub — far beyond the top of frame; shared by all arcs and
  // ridges. Blending both axes keeps the curvature sane at any aspect.
  const gcx = w * 0.5;
  const gcy = -(h * 0.35 + w * 0.3);

  // Fog stops — this layer lives between void and surface2, nothing brighter.
  const FAR = mix(C.void, C.surface2, 0.32); // barely above void
  const NEAR = mix(C.void, C.surface2, 0.58); // ceiling tone

  // ── 0. arc machinery ──────────────────────────────────────────────────────
  // A ring of the gate crossing the frame: for each x, the circle around the
  // hub that passes through (gcx, yAtCenter). Sampled as a hand-jittered
  // polyline so the strokes keep the woodcut's pulse.
  const STEPS = 56;
  const arcY = (yAtCenter: number, x: number): number => {
    const r = yAtCenter - gcy;
    const dx = x - gcx;
    const d2 = r * r - dx * dx;
    return d2 > 0 ? gcy + Math.sqrt(d2) : gcy;
  };
  const arcPts = (yAtCenter: number, jitter: number): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const x = (i / STEPS) * w;
      pts.push({ x, y: arcY(yAtCenter, x) + (rand() - 0.5) * jitter });
    }
    return pts;
  };
  const strokeSeg = (pts: Pt[], t0: number, t1: number, color: string, lw: number): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    let started = false;
    for (const p of pts) {
      const t = p.x / w;
      if (t < t0 || t > t1) continue;
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  };
  const fillAbove = (pts: Pt[], color: string): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    let started = false;
    for (const p of pts) {
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(w + 4, -h);
    ctx.lineTo(-4, -h);
    ctx.closePath();
    ctx.fill();
  };

  // ── 1. base vertical wash — the only soft gradient allowed ────────────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, shade(C.void, 0.8));
  base.addColorStop(0.3, C.void);
  base.addColorStop(0.74, C.void);
  base.addColorStop(1, mix(C.void, C.surface, 0.26));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. the crown — two ceiling masses with crisp curved edges ─────────────
  // Far ring shelf first (barely above void), the near crown over it; the
  // visible band between the two edges is the gate's uppermost ring, receding.
  const crownFar = arcPts(h * 0.205, h * 0.004);
  const crownNear = arcPts(h * 0.125, h * 0.003);
  fillAbove(crownFar, FAR);
  fillAbove(crownNear, NEAR);
  strokeSeg(crownFar, 0, 1, mix(C.void, C.surface2, 0.55, 0.35), 1);
  strokeSeg(crownNear, 0, 1, mix(C.void, C.surface2, 0.85, 0.5), 1);
  // one ring groove inside the near crown, and a run of rivets under its lip
  strokeSeg(arcPts(h * 0.072, h * 0.002), 0, 1, shade(NEAR, 1.26, 0.3), 1);
  ctx.fillStyle = mix(C.void, C.surface2, 1, 0.5);
  for (const t of [0.06, 0.17, 0.31, 0.5, 0.69, 0.83, 0.94]) {
    const rx = t * w;
    ctx.beginPath();
    ctx.arc(rx, arcY(h * 0.125, rx) - Math.max(2.5, s * 0.007), Math.max(0.8, s * 0.0016), 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 3. THE gilt seam — the one arc allowed to remember light ──────────────
  // Gold ink folded ≤12% into a crown-band seam; a soft under-stroke and a
  // hairline over it, edge to edge across the far shelf.
  const seamPts = arcPts(h * 0.168, h * 0.0016);
  const seamBase = mix(C.void, C.surface2, 0.75);
  strokeSeg(seamPts, 0, 1, mix(seamBase, C.goldInk, 0.12, 0.26), 2);
  strokeSeg(seamPts, 0, 1, mix(seamBase, C.goldInk, 0.12, 0.5), 1);

  // ── 4. flank arcs — the ring sweeping past the side edges ─────────────────
  // Stroked only near the frame edges (ghost reach, then a firmer pass right
  // at the edge) so the calm middle never sees them; they run off-frame.
  const flankA = arcPts(h * 0.44, h * 0.004);
  const flankB = arcPts(h * 0.585, h * 0.004);
  const ghost = mix(C.void, C.surface2, 0.55, 0.22);
  const firm = mix(C.void, C.surface2, 0.8, 0.4);
  strokeSeg(flankA, 0, 0.22, ghost, 1);
  strokeSeg(flankA, 0, 0.12, firm, 1.5);
  strokeSeg(flankA, 0.78, 1, ghost, 1);
  strokeSeg(flankA, 0.88, 1, firm, 1.5);
  strokeSeg(flankB, 0, 0.2, ghost, 1);
  strokeSeg(flankB, 0, 0.1, firm, 2);
  strokeSeg(flankB, 0.8, 1, ghost, 1);
  strokeSeg(flankB, 0.9, 1, firm, 2);

  // ── 5. ridge lines — everything converges on the hub above the frame ──────
  // Each ridge is the ray from a bottom-edge anchor toward the hub, drawn
  // only across a y-band; perspective (the shared vanishing point) is exact.
  const ridge = (fx: number, yTop: number, yBot: number, color: string, lw: number): void => {
    const f = (y: number): number => (y - gcy) / (h * 1.01 - gcy);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(gcx + fx * w * f(yBot), yBot);
    ctx.lineTo(gcx + fx * w * f(yTop), yTop);
    ctx.stroke();
  };
  // the floor fan, radiating through the bottom band
  const fan: Array<[number, number]> = [
    [-0.47, 0.16], [-0.34, 0.13], [-0.22, 0.1], [-0.11, 0.08],
    [0.11, 0.08], [0.22, 0.1], [0.34, 0.13], [0.47, 0.16],
  ];
  for (const [fx, a] of fan) {
    ridge(fx, h * (0.788 + rand() * 0.02), h * 1.02, mix(C.void, C.surface2, 0.7, a), 1);
  }
  // long flank ridges climbing the side walls toward the hidden point; they
  // dim to nothing where they cross the crown masses (darker than the fill)
  for (const [fx, a] of [[-0.78, 0.09], [-0.58, 0.13], [0.58, 0.13], [0.78, 0.09]] as const) {
    ridge(fx, h * 0.04, h * 1.02, mix(C.void, C.surface2, 0.6, a), 1);
  }

  // ── 6. the floor ring — the great circle set into the ground ──────────────
  const floorGhost = arcPts(h * 0.825, h * 0.003);
  const floorNear = arcPts(h * 0.888, h * 0.003);
  strokeSeg(floorGhost, 0, 1, mix(C.void, C.surface2, 0.5, 0.28), 1);
  strokeSeg(floorNear, 0, 1, mix(C.void, C.surface2, 0.85, 0.55), 2.5);
  strokeSeg(arcPts(h * 0.897, h * 0.003), 0, 1, mix(C.void, C.surface2, 0.6, 0.3), 1);

  // ── 7. votive stubs — ranks of dead candles rising from both corners ──────
  // Flat wax silhouettes with melted crowns and one run of drip each; far
  // rank barely above void, near rank at the ceiling tone, tallest at the
  // frame edges (running off-frame), tapering down toward the calm middle.
  type StubSpec = { fx: number; top: number; hw: number };
  const stub = (spec: StubSpec, col: string, flip: 1 | -1, rim = false): void => {
    const xc = spec.fx * w;
    const X = (u: number): number => xc + u * flip;
    const top = spec.top * h;
    const hw = spec.hw * s;
    const lip = top + s * (0.012 + rand() * 0.012);
    const dripY = top + (h - top) * (0.32 + rand() * 0.2);
    const dripH = s * (0.05 + rand() * 0.04);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(X(-hw), h + 4);
    ctx.lineTo(X(-hw * 1.05), lip); // inner melt lip
    ctx.quadraticCurveTo(X(-hw * 0.5), top + s * 0.002, X(-hw * 0.1), top + s * 0.004);
    ctx.quadraticCurveTo(X(hw * 0.2), top - s * 0.007, X(hw * 0.6), top + s * 0.006); // crown lumps
    ctx.lineTo(X(hw * 1.04), lip + s * 0.008); // outer sag
    ctx.lineTo(X(hw), dripY);
    ctx.quadraticCurveTo(X(hw * 1.26), dripY + dripH * 0.5, X(hw * 1.04), dripY + dripH); // wax run
    ctx.lineTo(X(hw), h + 4);
    ctx.closePath();
    ctx.fill();
    if (rim) {
      // a cool hairline where the crown still holds an edge
      ctx.strokeStyle = shade(col, 1.3, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X(-hw * 0.5), top + s * 0.002);
      ctx.quadraticCurveTo(X(-hw * 0.1), top + s * 0.003, X(hw * 0.2), top - s * 0.006);
      ctx.stroke();
    }
  };
  const leftFar: StubSpec[] = [
    { fx: -0.012, top: 0.575, hw: 0.052 },
    { fx: 0.085, top: 0.625, hw: 0.04 },
    { fx: 0.165, top: 0.69, hw: 0.032 },
  ];
  const leftNear: StubSpec[] = [
    { fx: -0.03, top: 0.665, hw: 0.06 },
    { fx: 0.062, top: 0.715, hw: 0.044 },
    { fx: 0.138, top: 0.775, hw: 0.034 },
    { fx: 0.205, top: 0.83, hw: 0.026 },
  ];
  const rightFar: StubSpec[] = [
    { fx: 1.015, top: 0.59, hw: 0.05 },
    { fx: 0.918, top: 0.64, hw: 0.038 },
    { fx: 0.838, top: 0.705, hw: 0.03 },
  ];
  const rightNear: StubSpec[] = [
    { fx: 1.03, top: 0.652, hw: 0.058 },
    { fx: 0.94, top: 0.705, hw: 0.045 },
    { fx: 0.862, top: 0.768, hw: 0.033 },
    { fx: 0.796, top: 0.838, hw: 0.024 },
  ];
  for (const sp of leftFar) stub(sp, FAR, 1);
  for (const [i, sp] of leftNear.entries()) stub(sp, NEAR, 1, i === 1);
  for (const sp of rightFar) stub(sp, FAR, -1);
  for (const [i, sp] of rightNear.entries()) stub(sp, NEAR, -1, i === 2);

  // ── 8. three gold glints — the last light the season will ever see ────────
  const gpx = Math.max(1, Math.round(s * 0.0024));
  const glints: Array<[number, number]> = [
    [w * 0.815, arcY(h * 0.168, w * 0.815) - 1], // a catch on the gilt seam
    [w * 0.062, h * 0.712], // the wick of one left votive
    [w * 0.66, arcY(h * 0.888, w * 0.66)], // a stud on the floor ring
  ];
  for (const [gx, gy] of glints) {
    ctx.fillStyle = mix(C.void, C.goldInk, 0.55 + rand() * 0.1, 0.75);
    ctx.fillRect(Math.round(gx), Math.round(gy), gpx, gpx);
  }
}
