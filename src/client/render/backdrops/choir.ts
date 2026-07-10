/**
 * Biome backdrop — THE HOLLOW CHOIR (floors 17–20, pale limestone cathedral).
 *
 * The distance layer behind the candle-lit iso world: a drowned-in-dark
 * cathedral nave. Colossal organ-pipe column clusters run off both side
 * edges — vertical fluted silhouettes, the palest masses in the game, up to
 * the full ceiling tone — beneath a pointed-arch arcade line along the top;
 * in the lower-right corner the silhouette of a fallen bell, mouth toward
 * the nave, half sunk in rubble; a toppled pier shaft answers it lower-left.
 * Every tone is cool (void → surface2); the only accent is bone mixed ≤10%
 * into the nearest column edges. The middle 50% of the frame stays near-pure
 * void — the game world renders on top of it — so all silhouette interest
 * lives in the outer ring and runs off-frame at the sides.
 *
 * Painted-slide idiom: flat fills with crisp edges at three fog stops, no
 * radial glows, no soft gradients beyond the base vertical wash, private
 * seeded LCG (never Math.random, never paint.ts crand — that stream belongs
 * to the world-texture painters).
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../paint.js";

// Private LCG (the story slides' pattern, own seed).
function choirRand(seed: number): () => number {
  let s = seed >>> 0 || 0x17c4;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const TAU = Math.PI * 2;

export function paintChoirBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = choirRand(0x17c4);
  const s = Math.min(w, h);

  // Fog stops — all cool, nothing above the surface2 luminance ceiling.
  const FAR = mix(C.void, C.surface2, 0.22); // barely above void
  const MID = mix(C.void, C.surface2, 0.5); // the arcade line
  const NEAR = mix(C.void, C.surface2, 0.85); // palest mass in the game
  const COLFAR = mix(C.void, C.surface2, 0.32); // drowned column rank

  // ── 1. base wash — the one permitted soft gradient; center rows stay void ─
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, mix(C.void, C.surface, 0.3));
  base.addColorStop(0.22, mix(C.void, C.surface, 0.06));
  base.addColorStop(0.4, C.void);
  base.addColorStop(0.78, C.void);
  base.addColorStop(1, mix(C.void, C.surface, 0.12));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. distant strata — the drowned choir dais, two shallow floor steps ──
  for (const [yf, t, ea] of [
    [0.78, 0.09, 0.4],
    [0.845, 0.14, 0.55],
  ] as const) {
    const bandY = h * yf;
    ctx.fillStyle = mix(C.void, C.surface2, t);
    ctx.fillRect(0, bandY, w, h - bandY + 2);
    ctx.strokeStyle = mix(C.void, C.surface2, 0.34, ea);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, bandY + 0.5);
    ctx.lineTo(w, bandY + 0.5);
    ctx.stroke();
  }

  // ── 3. the arcade — pointed-arch line along the top, two fog stops ───────
  // The mass hangs from the top edge; openings are gothic lancets of void;
  // pier stubs end broken at varied depths (the vault is ruined, drowned).
  const arcadePath = (
    span: number,
    pierW: number,
    springY: number,
    apexY: number,
    stubMin: number,
    stubVar: number,
  ): Path2D => {
    const unit = span + pierW;
    const n = Math.ceil(w / unit) + 2;
    const x0 = -unit * (0.6 + rand() * 0.8); // start off-frame — no visible end
    const rise = springY - apexY;
    const p = new Path2D();
    p.moveTo(x0, -2);
    for (let i = 0; i <= n; i++) {
      const px = x0 + i * unit;
      const stub = springY + stubMin + rand() * stubVar;
      p.lineTo(px, stub);
      p.lineTo(px + pierW, stub);
      p.lineTo(px + pierW, springY);
      if (i < n) {
        const xa = px + pierW;
        const xb = px + unit;
        const xm = (xa + xb) / 2;
        // vertical spring, sharp apex — a lancet, not a round arch
        p.bezierCurveTo(xa + span * 0.02, apexY + rise * 0.5, xm - span * 0.1, apexY + rise * 0.2, xm, apexY);
        p.bezierCurveTo(xm + span * 0.1, apexY + rise * 0.2, xb - span * 0.02, apexY + rise * 0.5, xb, springY);
      }
    }
    p.lineTo(x0 + n * unit + pierW, -2);
    p.closePath();
    return p;
  };
  // fog stop 1: a smaller, deeper arcade behind
  ctx.fillStyle = FAR;
  ctx.fill(arcadePath(w * 0.062, w * 0.013, h * 0.085, h * 0.032, h * 0.02, h * 0.035));
  // fog stop 2: the near arcade, its silhouette edge barely lit
  const nave = arcadePath(w * 0.115, w * 0.024, h * 0.125, h * 0.05, h * 0.03, h * 0.075);
  ctx.fillStyle = MID;
  ctx.fill(nave);
  ctx.strokeStyle = mix(C.void, C.surface2, 0.78, 0.55);
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.stroke(nave);
  // rose-window tracery carved into the spandrel stone, clipped to the mass
  ctx.save();
  ctx.clip(nave);
  const rx = w * 0.5;
  const ry = h * 0.052;
  const rr = h * 0.048;
  ctx.strokeStyle = shade(MID, 0.72, 0.9);
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.beginPath();
  ctx.arc(rx, ry, rr, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = shade(MID, 0.72, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(rx, ry, rr * 0.5, 0, TAU);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2;
    ctx.moveTo(rx + Math.cos(a) * rr * 0.5, ry + Math.sin(a) * rr * 0.5);
    ctx.lineTo(rx + Math.cos(a) * rr, ry + Math.sin(a) * rr);
  }
  ctx.stroke();
  ctx.restore();

  // ── 4. the organ-pipe column clusters — the star, off both side edges ────
  // Vertical fluted silhouettes rising from below the frame, tops raking
  // down inboard so each cluster recedes into the dark before mid-frame.
  const pipeRank = (
    side: 1 | -1,
    inbStart: number,
    widths: readonly number[],
    tops: readonly number[],
    tone: string,
    near: boolean,
  ): void => {
    const gap = Math.max(1, w * 0.0016);
    let inb = inbStart; // distance inboard from the frame edge to the outer face
    for (let i = 0; i < widths.length; i++) {
      const pw = w * (widths[i] ?? 0.03);
      const top = h * (tops[i] ?? 0.3) + (rand() - 0.5) * h * 0.018;
      const x = side === 1 ? inb : w - inb - pw;
      const slant = pw * 0.16; // mitred cap, outer corner lower
      const innerX = side === 1 ? x + pw : x;
      const outerTop = top + slant;
      const fill = near && i % 2 === 1 ? shade(tone, 0.92) : tone;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(x, h + 4);
      ctx.lineTo(x, side === 1 ? outerTop : top);
      ctx.lineTo(x + pw, side === 1 ? top : outerTop);
      ctx.lineTo(x + pw, h + 4);
      ctx.closePath();
      ctx.fill();
      if (near) {
        // flat woodcut rounding: darker strip on the outboard third + flute line
        const stripW = pw * 0.32;
        ctx.fillStyle = shade(fill, 0.88);
        ctx.fillRect(side === 1 ? x : x + pw - stripW, outerTop + pw * 0.2, stripW, h - top);
        const fx = side === 1 ? x + pw * 0.62 : x + pw * 0.38;
        ctx.strokeStyle = shade(fill, 0.8, 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx, outerTop + pw * 0.35);
        ctx.lineTo(fx, h * 0.965);
        ctx.stroke();
        // crisp cap edge, held exactly at the ceiling tone
        ctx.strokeStyle = mix(C.void, C.surface2, 1, 0.8);
        ctx.lineWidth = Math.max(1, s * 0.0016);
        ctx.beginPath();
        ctx.moveTo(x, side === 1 ? outerTop : top);
        ctx.lineTo(x + pw, side === 1 ? top : outerTop);
        ctx.stroke();
      }
      // bone ≤10%, nearest column edges only: the exposed inner faces of the
      // two innermost pipes, a hairline fading out well before mid-frame
      if (near && i >= widths.length - 2) {
        const g = ctx.createLinearGradient(0, top, 0, h * 0.8);
        g.addColorStop(0, mix(fill, C.bone, 0.1, 0.9));
        g.addColorStop(1, mix(fill, C.bone, 0.1, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = Math.max(1, s * 0.002);
        ctx.beginPath();
        ctx.moveTo(innerX + (side === 1 ? -0.5 : 0.5), top);
        ctx.lineTo(innerX + (side === 1 ? -0.5 : 0.5), h * 0.8);
        ctx.stroke();
      }
      inb += pw + gap;
    }
  };
  // fog stop 1½: drowned ranks continuing the rake, dark against the arcade
  pipeRank(1, w * 0.045, [0.03, 0.028, 0.026, 0.025, 0.024, 0.023], [0.17, 0.225, 0.29, 0.36, 0.435, 0.515], COLFAR, false);
  pipeRank(-1, w * 0.05, [0.03, 0.028, 0.026, 0.025, 0.024, 0.023], [0.19, 0.245, 0.315, 0.385, 0.46, 0.54], COLFAR, false);
  // fog stop 3: the near ranks, hugging the edges, tallest running off-frame
  pipeRank(1, -w * 0.006, [0.038, 0.033, 0.029, 0.026, 0.023], [-0.07, 0.055, 0.155, 0.265, 0.385], NEAR, true);
  pipeRank(-1, -w * 0.006, [0.038, 0.033, 0.029, 0.026, 0.023], [-0.05, 0.07, 0.175, 0.29, 0.4], NEAR, true);

  // ── 5. rubble helper — jagged crest mounds, crisp, corners only ──────────
  const mound = (x0: number, x1: number, crestF: number, tone: string): void => {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(x0, h + 4);
    let mx = x0;
    while (mx < x1) {
      const nx = Math.min(mx + (x1 - x0) * (0.14 + rand() * 0.16), x1);
      ctx.lineTo((mx + nx) / 2, h * (crestF + (rand() - 0.5) * 0.02));
      ctx.lineTo(nx, h * (crestF + 0.025 + rand() * 0.02));
      mx = nx;
    }
    ctx.lineTo(x1, h + 4);
    ctx.closePath();
    ctx.fill();
  };

  // ── 6. lower-left: a toppled pier shaft and its scatter ──────────────────
  mound(-w * 0.02, w * 0.24, 0.955, mix(C.void, C.surface2, 0.24));
  ctx.save();
  ctx.translate(w * 0.07, h * 0.905);
  ctx.rotate(0.075);
  const shaftL = w * 0.24;
  const shaftT = s * 0.038;
  const shaftTone = mix(C.void, C.surface2, 0.4);
  ctx.fillStyle = shaftTone;
  ctx.fillRect(-shaftL * 0.55, -shaftT / 2, shaftL, shaftT);
  ctx.strokeStyle = shade(shaftTone, 0.82, 0.8);
  ctx.lineWidth = 1;
  for (const fy of [-0.16, 0.14]) {
    ctx.beginPath();
    ctx.moveTo(-shaftL * 0.55, shaftT * fy);
    ctx.lineTo(shaftL * 0.45, shaftT * fy);
    ctx.stroke();
  }
  ctx.fillStyle = shade(shaftTone, 0.7);
  ctx.beginPath();
  ctx.ellipse(shaftL * 0.45, 0, shaftT * 0.22, shaftT * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = mix(C.void, C.surface2, 0.56, 0.7);
  ctx.stroke();
  ctx.restore();
  // one tumbled drum beside it
  const drumX = w * 0.2;
  const drumY = h * 0.945;
  ctx.fillStyle = mix(C.void, C.surface2, 0.3);
  ctx.fillRect(drumX - s * 0.022, drumY - s * 0.02, s * 0.044, s * 0.04);
  ctx.fillStyle = mix(C.void, C.surface2, 0.36);
  ctx.beginPath();
  ctx.ellipse(drumX, drumY - s * 0.02, s * 0.022, s * 0.007, 0, 0, TAU);
  ctx.fill();

  // ── 7. lower-right: the fallen bell, mouth toward the nave ───────────────
  const bellTone = mix(C.void, C.surface2, 0.45);
  ctx.save();
  ctx.translate(w * 0.85, h * 0.9);
  ctx.rotate(-0.09);
  const R = s * 0.078;
  const L = s * 0.19;
  const mX = -L * 0.52;
  ctx.fillStyle = bellTone;
  ctx.beginPath();
  ctx.moveTo(mX, -R);
  ctx.bezierCurveTo(mX + L * 0.28, -R * 0.64, mX + L * 0.55, -R * 0.58, mX + L * 0.8, -R * 0.5);
  ctx.quadraticCurveTo(mX + L * 1.04, -R * 0.4, mX + L * 1.04, 0);
  ctx.quadraticCurveTo(mX + L * 1.04, R * 0.4, mX + L * 0.8, R * 0.5);
  ctx.bezierCurveTo(mX + L * 0.55, R * 0.58, mX + L * 0.28, R * 0.64, mX, R);
  ctx.quadraticCurveTo(mX - R * 0.3, 0, mX, -R);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = mix(C.void, C.surface2, 0.62, 0.6);
  ctx.lineWidth = Math.max(1, s * 0.0016);
  ctx.stroke();
  // the crown canon, a small knob merging into the dome
  ctx.fillStyle = bellTone;
  ctx.beginPath();
  ctx.arc(mX + L * 1.07, 0, R * 0.16, 0, TAU);
  ctx.fill();
  // the mouth — a deeper dark, its rim barely lit
  ctx.fillStyle = shade(C.void, 0.78);
  ctx.beginPath();
  ctx.ellipse(mX, 0, R * 0.26, R * 0.96, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = mix(C.void, C.surface2, 0.6, 0.75);
  ctx.lineWidth = 1;
  ctx.stroke();
  // the crack that silenced it
  ctx.strokeStyle = shade(C.void, 0.8, 0.9);
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.beginPath();
  ctx.moveTo(mX + L * 0.34, -R * 0.6);
  ctx.lineTo(mX + L * 0.42, -R * 0.28);
  ctx.lineTo(mX + L * 0.36, -R * 0.04);
  ctx.lineTo(mX + L * 0.44, R * 0.18);
  ctx.stroke();
  ctx.restore();
  // rubble the bell sank into, plus two shards of fallen vault web
  mound(w * 0.7, w * 1.02, 0.945, mix(C.void, C.surface2, 0.3));
  for (const [sxf, syf, rot] of [
    [0.745, 0.925, -0.3],
    [0.96, 0.905, 0.42],
  ] as const) {
    ctx.save();
    ctx.translate(w * sxf, h * syf);
    ctx.rotate(rot);
    ctx.fillStyle = mix(C.void, C.surface2, 0.34);
    ctx.beginPath();
    ctx.moveTo(-s * 0.028, s * 0.016);
    ctx.lineTo(-s * 0.006, -s * 0.02);
    ctx.lineTo(s * 0.028, -s * 0.006);
    ctx.lineTo(s * 0.018, s * 0.016);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
