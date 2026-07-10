/**
 * Backdrop — THE DROWNED STACKS (floors 9–12, verdigris slate biome).
 *
 * The distance layer behind the candle-lit iso world: a flooded library
 * receding into the dark. A still black waterline crosses the lower third —
 * a barely-lighter-than-void horizon with a broken mirror sheen — with
 * half-sunken shelf-stacks rising from it at two fog stops on the flanks,
 * kelp and rusted chains hanging from the ceiling line, and drowned heaps
 * breaking the surface in the bottom corners. The middle 50% of the frame
 * stays near-pure void: the game world renders on top of it, so every
 * silhouette lives in the outer ring and runs off-frame. Flat fills with
 * crisp edges; tones from void/surface/surface2 only, plus verdigrisDim
 * mixed ≤15% into the waterline sheen and one near shelf edge. All jitter
 * through a private seeded LCG (never Math.random, never paint.ts crand).
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../paint.js";

// Private LCG (story slides' pattern, own seed) — paint.ts crand()'s stream
// belongs to the world-texture painters and must not be touched.
function drownedRand(seed: number): () => number {
  let s = seed >>> 0 || 0xd80c;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintDrownedBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = drownedRand(0xd80c);
  const s = Math.min(w, h);

  // Fog stops — inverted against the void: nearer masses catch slightly more
  // of the drowned hall's ambient, but nothing exceeds surface2 (#1e1a26).
  const FAR = mix(C.void, C.surface, 0.38); // stop 1: barely above void
  const MID = mix(C.void, C.surface2, 0.5); // hanging forms, corner heaps
  const NEAR = mix(C.void, C.surface2, 0.82); // stop 2: flanking stacks
  const waterY = h * 0.7;

  // ── 1. base vertical wash — the only soft gradient in the frame ──────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, mix(C.void, C.surface, 0.26));
  base.addColorStop(0.16, mix(C.void, C.surface, 0.07));
  base.addColorStop(0.4, C.void);
  base.addColorStop(0.62, C.void);
  base.addColorStop(0.7, mix(C.void, C.surface, 0.08));
  base.addColorStop(1, shade(C.void, 0.85));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. distant gallery ledges — faint strata hairlines on the flanks ─────
  ctx.strokeStyle = mix(C.void, C.surface, 0.5, 0.35);
  ctx.lineWidth = 1;
  for (const [x0, x1, ly] of [
    [0, w * 0.2, h * 0.3],
    [w * 0.82, w, h * 0.345],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, ly + (rand() - 0.5) * s * 0.012);
    ctx.lineTo(x1, ly + (rand() - 0.5) * s * 0.012);
    ctx.stroke();
  }

  // ── 3. the ceiling line — two crisp jagged layers along the top edge ─────
  const flank = (t: number): number => Math.pow(Math.abs(t - 0.5) * 2, 1.6);
  const ceiling = (depth: (t: number) => number, fill: string): void => {
    const STEPS = 26;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      ctx.lineTo(t * w, depth(t) + (rand() - 0.5) * s * 0.012);
    }
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();
  };
  // stop 1: deep ragged rock, hanging lowest at the flanks
  ceiling((t) => h * (0.075 + 0.1 * flank(t)), FAR);
  // stop 2: the near ceiling lip, shallower, crisp against the far layer
  ceiling((t) => h * (0.04 + 0.055 * flank(t)), mix(C.void, C.surface2, 0.68));

  // ── 4. hanging forms — kelp strands and rusted chains off the ceiling ────
  const chain = (cx: number, top: number, len: number, tone: string, a: number): void => {
    ctx.strokeStyle = tone;
    ctx.globalAlpha = a;
    ctx.lineWidth = Math.max(1, s * 0.0022);
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top + len);
    ctx.stroke();
    const step = Math.max(5, s * 0.016);
    const rw = Math.max(2, s * 0.006);
    for (let ly = top + step * (0.4 + rand() * 0.4); ly < top + len; ly += step) {
      ctx.strokeRect(cx - rw / 2, ly, rw, step * 0.42);
    }
    ctx.globalAlpha = 1;
  };
  const kelp = (cx: number, top: number, len: number, tone: string, a: number): void => {
    const sway = (rand() - 0.5) * len * 0.35;
    ctx.strokeStyle = tone;
    ctx.globalAlpha = a;
    ctx.lineWidth = Math.max(1, s * 0.0028);
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.bezierCurveTo(cx + sway, top + len * 0.35, cx - sway * 0.6, top + len * 0.7, cx + sway * 0.4, top + len);
    ctx.stroke();
    for (let i = 1; i <= 3; i++) {
      const ty = top + (len * i) / 3.4;
      const tx = cx + sway * 0.5 * Math.sin(i * 1.7);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + (i % 2 === 0 ? 1 : -1) * s * 0.012, ty + s * 0.018);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  // densest and longest over the flanks; short over the calm center so
  // nothing dips below y = 0.25h between x = 0.25w and 0.75w
  const hangs: Array<{ fx: number; len: number; kind: "kelp" | "chain" }> = [
    { fx: 0.045, len: 0.3, kind: "chain" },
    { fx: 0.11, len: 0.2, kind: "kelp" },
    { fx: 0.18, len: 0.13, kind: "kelp" },
    { fx: 0.27, len: 0.09, kind: "chain" },
    { fx: 0.38, len: 0.07, kind: "kelp" },
    { fx: 0.52, len: 0.055, kind: "kelp" },
    { fx: 0.63, len: 0.08, kind: "chain" },
    { fx: 0.74, len: 0.11, kind: "kelp" },
    { fx: 0.82, len: 0.17, kind: "kelp" },
    { fx: 0.9, len: 0.26, kind: "chain" },
    { fx: 0.96, len: 0.19, kind: "kelp" },
  ];
  for (const hang of hangs) {
    const top = h * (0.035 + 0.055 * flank(hang.fx));
    const len = h * hang.len * (0.9 + rand() * 0.25);
    const long = hang.len >= 0.15;
    const tone = long ? MID : FAR;
    const a = long ? 0.55 + rand() * 0.2 : 0.4 + rand() * 0.2;
    if (hang.kind === "chain") {
      chain(w * hang.fx, top, len, tone, a);
    } else {
      kelp(w * hang.fx, top, len, tone, a);
    }
  }

  // ── 5. the shelf-stacks — half-sunken cases rising from the waterline ────
  const stack = (
    cx: number,
    sw: number,
    top: number,
    lean: number,
    tone: string,
    opts: { shelves?: number; cornice?: boolean; spines?: boolean } = {},
  ): void => {
    const x0 = cx - sw / 2;
    const x1 = cx + sw / 2;
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(x0, waterY + 2);
    ctx.lineTo(x0 + lean, top);
    ctx.lineTo(x1 + lean, top);
    ctx.lineTo(x1, waterY + 2);
    ctx.closePath();
    ctx.fill();
    if (opts.cornice === true) {
      const ch = Math.max(2, s * 0.008);
      ctx.fillRect(x0 + lean - sw * 0.08, top - ch, sw * 1.16, ch);
    }
    const nShelves = opts.shelves ?? 0;
    if (nShelves > 0) {
      const hgt = waterY - top;
      ctx.fillStyle = mix(tone, C.void, 0.55);
      for (let i = 1; i <= nShelves; i++) {
        const sy = top + (hgt * i) / (nShelves + 0.4);
        const off = lean * (1 - (sy - top) / hgt);
        ctx.fillRect(x0 + off + sw * 0.1, sy, sw * 0.8, Math.max(2, hgt * 0.045));
      }
    }
    if (opts.spines === true) {
      // gaps between drowned spines still standing under the cornice
      ctx.fillStyle = mix(tone, C.void, 0.32);
      const tickH = Math.max(3, (waterY - top) * 0.1);
      for (let i = 0; i < 4; i++) {
        const bx = cx + lean * 0.9 - sw * 0.28 + i * sw * 0.17 + (rand() - 0.5) * sw * 0.05;
        ctx.fillRect(bx, top + tickH * 0.55, Math.max(1.5, sw * 0.03), tickH);
      }
    }
  };

  // fog stop 1 — distant drowned rows receding off both flanks
  for (const side of [1, -1] as const) {
    let edge = side === 1 ? -w * 0.03 : w * 1.03;
    for (let i = 0; i < 3; i++) {
      const sw = w * (0.045 + rand() * 0.035);
      const top = waterY - h * (0.05 + rand() * 0.085);
      stack(edge + (side * sw) / 2, sw, top, (rand() - 0.5) * s * 0.014, FAR);
      edge += side * (sw + w * (0.012 + rand() * 0.022));
      if (side === 1 && edge > w * 0.16) break;
      if (side === -1 && edge < w * 0.84) break;
    }
  }

  // fog stop 2 — the flanking cases, running off-frame, leaning as they sink
  const L = { cx: w * 0.045, sw: w * 0.2, top: waterY - h * 0.295, lean: s * 0.018 };
  const R = { cx: w * 0.96, sw: w * 0.18, top: waterY - h * 0.255, lean: -s * 0.014 };
  stack(L.cx, L.sw, L.top, L.lean, NEAR, { shelves: 4, cornice: true, spines: true });
  stack(w * 0.185, w * 0.085, waterY - h * 0.16, -s * 0.008, mix(C.void, C.surface2, 0.62), { shelves: 3 });
  stack(R.cx, R.sw, R.top, R.lean, NEAR, { shelves: 4, cornice: true, spines: true });
  stack(w * 0.83, w * 0.075, waterY - h * 0.135, s * 0.006, mix(C.void, C.surface2, 0.62), { shelves: 2 });

  // ── 6. the waterline — a still black horizon across the lower third ──────
  // stepped flat bands (crisp fog steps, not a gradient) cut the stacks
  ctx.fillStyle = mix(C.void, C.surface, 0.12);
  ctx.fillRect(0, waterY, w, h * 0.045);
  ctx.fillStyle = mix(C.void, C.surface, 0.06);
  ctx.fillRect(0, waterY + h * 0.045, w, h * 0.07);
  ctx.fillStyle = shade(C.void, 0.88);
  ctx.fillRect(0, waterY + h * 0.115, w, h - waterY - h * 0.115);

  // the sheen: verdigrisDim mixed ≤15%, never brighter than surface tone —
  // one faint hairline clear across, broken mirror dashes on the flanks only
  const sheen = mix(mix(C.void, C.surface, 0.85), C.verdigrisDim, 0.14);
  ctx.fillStyle = sheen;
  ctx.globalAlpha = 0.2;
  ctx.fillRect(0, waterY - 1, w, 1);
  ctx.globalAlpha = 1;
  for (const [x0, x1] of [
    [0, w * 0.32],
    [w * 0.68, w],
  ] as const) {
    let dx = x0;
    while (dx < x1) {
      const len = w * (0.012 + rand() * 0.03);
      ctx.globalAlpha = 0.35 + rand() * 0.35;
      ctx.fillRect(dx, waterY - 1, Math.min(len, x1 - dx), 1.5);
      dx += len + w * (0.01 + rand() * 0.025);
    }
  }
  ctx.globalAlpha = 1;

  // ── 7. the one verdigris-kissed shelf edge (accent ≤15%) — the left ──────
  // case's inner upright, wet slate catching what the water throws back
  ctx.strokeStyle = mix(mix(C.void, C.surface2, 0.92), C.verdigrisDim, 0.15, 0.85);
  ctx.lineWidth = Math.max(1, s * 0.0024);
  ctx.beginPath();
  ctx.moveTo(L.cx + L.sw / 2 + L.lean, L.top);
  ctx.lineTo(L.cx + L.sw / 2, waterY);
  ctx.stroke();
  // and its drowned echo, fainter still
  ctx.fillStyle = mix(mix(C.void, C.surface, 0.7), C.verdigrisDim, 0.14);
  ctx.globalAlpha = 0.3;
  ctx.fillRect(L.cx + L.sw / 2 - 1, waterY + 2, 1.5, h * 0.05);
  ctx.globalAlpha = 1;

  // ── 8. broken mirror streaks under the flanking cases ────────────────────
  const reflect = (cx: number, sw: number, top: number): void => {
    const depth = (waterY - top) * 0.5;
    ctx.fillStyle = mix(C.void, C.surface, 0.3);
    for (let i = 0; i < 3; i++) {
      const rx = cx - sw * 0.3 + sw * 0.3 * i + (rand() - 0.5) * sw * 0.1;
      const end = waterY + depth * (0.5 + rand() * 0.5);
      let ry = waterY + 3 + rand() * h * 0.01;
      while (ry < end) {
        const seg = h * (0.008 + rand() * 0.02);
        ctx.globalAlpha = Math.max(0, 0.5 * (1 - (ry - waterY) / depth));
        ctx.fillRect(rx - 0.75, ry, 1.5, seg);
        ry += seg + h * (0.006 + rand() * 0.012);
      }
    }
    ctx.globalAlpha = 1;
  };
  reflect(L.cx, L.sw, L.top);
  reflect(R.cx, R.sw, R.top);

  // ── 9. drowned heaps breaking the surface in the bottom corners ──────────
  const heap = (anchor: number, dir: 1 | -1, reach: number, hh: number, tone: string): void => {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(anchor, h);
    ctx.lineTo(anchor, h - hh);
    let px = anchor;
    let py = h - hh;
    const steps = 4 + Math.floor(rand() * 2);
    for (let i = 0; i < steps; i++) {
      px += dir * (reach / steps) * (0.7 + rand() * 0.6);
      ctx.lineTo(px, py); // tread — a spilled ledger, a slate slab
      py = Math.min(h, py + (hh / steps) * (0.6 + rand() * 0.8));
      ctx.lineTo(px, py); // riser back down toward the water
    }
    ctx.lineTo(px, h);
    ctx.closePath();
    ctx.fill();
  };
  heap(0, 1, w * 0.19, h * 0.13, MID);
  heap(0, 1, w * 0.1, h * 0.07, mix(C.void, C.surface2, 0.72));
  heap(w, -1, w * 0.17, h * 0.115, MID);
  heap(w, -1, w * 0.085, h * 0.06, mix(C.void, C.surface2, 0.72));

  // one keeled plank tipping out of the water off the left heap
  ctx.fillStyle = mix(C.void, C.surface2, 0.58);
  ctx.beginPath();
  ctx.moveTo(w * 0.235, h * 0.93);
  ctx.lineTo(w * 0.175, h * 0.985);
  ctx.lineTo(w * 0.155, h * 0.975);
  ctx.lineTo(w * 0.222, h * 0.917);
  ctx.closePath();
  ctx.fill();
  // two still ripple hairlines where it enters
  ctx.strokeStyle = mix(C.void, C.surface, 0.5, 0.4);
  ctx.lineWidth = 1;
  for (const [rx0, rx1, ry] of [
    [w * 0.15, w * 0.2, h * 0.988],
    [w * 0.145, w * 0.21, h * 0.996],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(rx0, ry);
    ctx.lineTo(rx1, ry);
    ctx.stroke();
  }
}
