/**
 * Backdrop — THE ROOT CELLARS (floors 5–8). The distance layer behind the
 * candle-lit world: an earthen cave whose ceiling drips root curtains — two
 * fog stops of hanging tangle along the whole top edge, the nearest tinged
 * with a whisper of gold ink (≤12%, the biome's only warmth). Swollen earth
 * masses bulge in from both side edges, and in the lower corners faint
 * shelf- and barrel-stack silhouettes hint that someone once stored things
 * against these far walls. The middle of the frame stays near-pure void —
 * the game renders on top of it.
 *
 * Guildhall painted-slide idiom: token colors via shade()/mix() only, flat
 * silhouette fills with crisp edges at distinct fog stops, no glow blobs,
 * jitter through a private seeded LCG (never Math.random, never crand).
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../paint.js";

// Private LCG (guildhall's hallRand pattern, own seed) — paint.ts crand()'s
// stream belongs to the world-texture painters and must not be touched.
function cellarsRand(seed: number): () => number {
  let s = seed >>> 0 || 0xce11a5;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintCellarsBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = cellarsRand(0xce11a5);
  const s = Math.min(w, h);

  // Fog stops — everything in this layer lives between void and surface2.
  const FAR = mix(C.void, C.surface2, 0.3); // barely above void
  const MID = mix(C.void, C.surface2, 0.58); // distinct middle distance
  const NEAR = mix(C.void, C.surface2, 0.85); // just under the luminance ceiling
  // The one sanctioned accent: gold ink folded ≤12% into the nearest curtain.
  const NEAR_ROOT = mix(NEAR, C.goldInk, 0.11);

  // edge weight: 0 at frame center → 1 at the left/right edges; the roots
  // hang deeper and the tangle thickens away from the calm middle.
  const edgeT = (x: number): number => Math.min(1, Math.abs(x / w - 0.5) * 2);

  // ── 1. base vertical wash — the only soft gradient allowed ───────────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, mix(C.void, C.surface, 0.4));
  base.addColorStop(0.2, shade(C.void, 0.98));
  base.addColorStop(0.55, C.void);
  base.addColorStop(0.9, C.void);
  base.addColorStop(1, shade(C.void, 0.88));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. distant strata bands — faint horizontal geology, low in the frame ──
  ctx.lineWidth = 1;
  for (const [fy, a] of [[0.795, 0.1], [0.855, 0.07]] as const) {
    const y0 = h * fy + (rand() - 0.5) * s * 0.008;
    ctx.strokeStyle = mix(C.void, C.surface2, 0.8, a);
    ctx.beginPath();
    ctx.moveTo(-2, y0);
    ctx.quadraticCurveTo(w * (0.35 + rand() * 0.3), y0 + s * (0.008 + rand() * 0.012), w + 2, y0 + (rand() - 0.5) * s * 0.015);
    ctx.stroke();
  }

  // ── 3. root curtains — scalloped tangle masses hung from the top edge ────
  // A filled path: valleys hug the ceiling, tips taper downward; depth grows
  // toward the side edges so the center stays shallow and calm.
  const curtain = (tone: string, baseDepth: number, edgeBoost: number): void => {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(-w * 0.02, -2);
    ctx.lineTo(-w * 0.02, h * baseDepth * 0.3);
    let x = -w * 0.02;
    while (x < w * 1.02) {
      const step = w * (0.028 + rand() * 0.042);
      const nx = x + step;
      const cx = (x + nx) / 2;
      const t = edgeT(cx);
      const tipY = h * baseDepth * (0.45 + edgeBoost * t * t + rand() * 0.35);
      const valleyY = h * baseDepth * 0.22 * (0.4 + rand() * 0.6) * (1 + t);
      // one root: curve down to a taper tip, back up to the next valley
      ctx.quadraticCurveTo(x + step * 0.22, tipY * 0.55, cx + (rand() - 0.5) * step * 0.24, tipY);
      ctx.quadraticCurveTo(nx - step * 0.24, tipY * 0.5, nx, valleyY);
      x = nx;
    }
    ctx.lineTo(w * 1.02, -2);
    ctx.closePath();
    ctx.fill();
  };
  // loose strands dangling below a curtain — thin tangle threads
  const strands = (tone: string, alpha: number, count: number, baseDepth: number, maxLen: number): void => {
    ctx.strokeStyle = shade(tone, 1, alpha);
    ctx.lineWidth = Math.max(1, s * 0.0022);
    for (let i = 0; i < count; i++) {
      const x = (rand() * 1.04 - 0.02) * w;
      const t = edgeT(x);
      const y0 = h * baseDepth * (0.3 + 0.8 * t * t + rand() * 0.3);
      const len = h * maxLen * (0.4 + rand() * 0.6) * (0.55 + 0.45 * t);
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.bezierCurveTo(
        x + (rand() - 0.5) * s * 0.05, y0 + len * 0.4,
        x + (rand() - 0.5) * s * 0.06, y0 + len * 0.75,
        x + (rand() - 0.5) * s * 0.04, y0 + len,
      );
      ctx.stroke();
    }
  };
  // fog stop 1 — the far curtain, barely above void, hangs the deepest
  curtain(FAR, 0.14, 1.1);
  strands(FAR, 0.75, 26, 0.14, 0.14);
  // fog stop 2 — the near curtain, ochre-touched, denser but shallower
  curtain(NEAR_ROOT, 0.085, 1.0);
  strands(NEAR_ROOT, 0.85, 18, 0.085, 0.09);

  // thick taproots plunging down the flanks, tying curtain to earth mass —
  // part of the near curtain, so they carry the same accent tone
  for (const [fx, reach] of [[0.045, 0.5], [0.115, 0.34], [0.905, 0.42], [0.965, 0.55]] as const) {
    const x0 = w * fx;
    const yEnd = h * (reach + rand() * 0.05);
    for (const [lw, tone] of [
      [Math.max(2.5, s * 0.008), shade(NEAR_ROOT, 0.8)],
      [Math.max(1, s * 0.003), NEAR_ROOT],
    ] as const) {
      ctx.strokeStyle = tone;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x0, h * 0.04);
      ctx.bezierCurveTo(
        x0 + (rand() - 0.5) * w * 0.05, yEnd * 0.35,
        x0 + (rand() - 0.5) * w * 0.06, yEnd * 0.7,
        x0 + (rand() - 0.5) * w * 0.035, yEnd,
      );
      ctx.stroke();
    }
  }

  // ── 4. swollen earth masses bulging in from the side edges ───────────────
  // Lumpy flat fills running off-frame top and bottom; two fog stops a side.
  const flank = (rightSide: boolean, tone: string, reach: number, rim: boolean): void => {
    const edgeX = rightSide ? w * 1.02 : -w * 0.02;
    const inner = (r: number): number => (rightSide ? w - w * r : w * r);
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(edgeX, -2);
    ctx.lineTo(inner(reach * (0.35 + rand() * 0.25)), -2);
    let y = 0;
    while (y < h) {
      const ny = Math.min(y + h * (0.11 + rand() * 0.12), h + 2);
      const bulge = reach * (0.5 + rand() * 0.5);
      ctx.quadraticCurveTo(inner(reach * (0.85 + rand() * 0.3)), (y + ny) / 2, inner(bulge), ny);
      y = ny;
    }
    ctx.lineTo(edgeX, h + 2);
    ctx.closePath();
    ctx.fill();
    if (rim) {
      // a crisp catch-light along the swollen edge — definition, not glow
      ctx.strokeStyle = shade(tone, 1.28, 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };
  flank(false, FAR, 0.2, false);
  flank(true, FAR, 0.22, false);

  // ── 5. lower-corner storage — shelf and barrel silhouettes, far-wall faint ─
  const shelfTone = mix(C.void, C.surface2, 0.42);
  const barrel = (bx: number, by: number, bw: number, bh: number): void => {
    ctx.fillStyle = shelfTone;
    ctx.beginPath();
    ctx.moveTo(bx - bw * 0.42, by);
    ctx.quadraticCurveTo(bx - bw * 0.58, by - bh * 0.5, bx - bw * 0.42, by - bh * 0.92);
    ctx.quadraticCurveTo(bx, by - bh * 1.06, bx + bw * 0.42, by - bh * 0.92);
    ctx.quadraticCurveTo(bx + bw * 0.58, by - bh * 0.5, bx + bw * 0.42, by);
    ctx.closePath();
    ctx.fill();
    // hoop — a darker seam across the belly
    ctx.strokeStyle = shade(shelfTone, 0.62, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - bw * 0.52, by - bh * 0.5);
    ctx.quadraticCurveTo(bx, by - bh * 0.58, bx + bw * 0.52, by - bh * 0.5);
    ctx.stroke();
  };
  // left corner: a lean-to shelf unit with jar silhouettes, one barrel beside
  const shX = w * 0.075;
  const shW = w * 0.105;
  const shBase = h * 0.965;
  const shTop = shBase - h * 0.13;
  ctx.strokeStyle = shelfTone;
  ctx.lineWidth = Math.max(1.5, s * 0.004);
  for (const ux of [shX - shW / 2, shX + shW / 2]) {
    ctx.beginPath();
    ctx.moveTo(ux, shBase);
    ctx.lineTo(ux + (rand() - 0.5) * s * 0.006, shTop);
    ctx.stroke();
  }
  for (let p = 0; p < 3; p++) {
    const py = shTop + (shBase - shTop) * (0.18 + p * 0.34);
    ctx.beginPath();
    ctx.moveTo(shX - shW * 0.56, py);
    ctx.lineTo(shX + shW * 0.56, py);
    ctx.stroke();
    // squat jars on each plank
    ctx.fillStyle = shelfTone;
    const nJars = 2 + Math.floor(rand() * 2);
    for (let j = 0; j < nJars; j++) {
      const jx = shX + shW * (j / Math.max(1, nJars - 1) - 0.5) * 0.72 + (rand() - 0.5) * shW * 0.08;
      const jw = shW * (0.1 + rand() * 0.06);
      const jh = (shBase - shTop) * (0.12 + rand() * 0.08);
      ctx.beginPath();
      ctx.moveTo(jx - jw / 2, py);
      ctx.lineTo(jx - jw / 2, py - jh * 0.7);
      ctx.quadraticCurveTo(jx - jw / 2, py - jh, jx, py - jh);
      ctx.quadraticCurveTo(jx + jw / 2, py - jh, jx + jw / 2, py - jh * 0.7);
      ctx.lineTo(jx + jw / 2, py);
      ctx.closePath();
      ctx.fill();
    }
  }
  barrel(w * 0.17, shBase, s * 0.062, s * 0.055);
  // right corner: a barrel stack, the outermost running off-frame
  const stBase = h * 0.97;
  const bw2 = s * 0.07;
  const bh2 = s * 0.06;
  barrel(w * 0.995, stBase, bw2 * 1.05, bh2);
  barrel(w * 0.9, stBase, bw2, bh2 * 0.96);
  barrel(w * 0.948, stBase - bh2 * 0.94, bw2 * 0.92, bh2 * 0.88);

  // ── 6. near flank bulges — fog stop 2, in front of the stores ────────────
  flank(false, MID, 0.115, true);
  flank(true, MID, 0.13, true);

  // ── 7. floor mounds — low rising earth in the bottom corners, off-frame ──
  ctx.fillStyle = MID;
  for (const right of [false, true]) {
    const inner = (r: number): number => (right ? w - w * r : w * r);
    ctx.beginPath();
    ctx.moveTo(inner(-0.02), h + 2);
    ctx.lineTo(inner(-0.02), h * (0.93 - rand() * 0.02));
    ctx.quadraticCurveTo(inner(0.1 + rand() * 0.04), h * (0.905 + rand() * 0.02), inner(0.19), h * 0.965);
    ctx.quadraticCurveTo(inner(0.25 + rand() * 0.04), h * 0.995, inner(0.32), h + 2);
    ctx.closePath();
    ctx.fill();
    // crisp crest line on the mound
    ctx.strokeStyle = shade(MID, 1.25, 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
