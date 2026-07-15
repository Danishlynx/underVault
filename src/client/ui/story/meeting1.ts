/**
 * The Meeting, plate 1 — "Her Hands."
 * Extreme close intimacy: the Candlemaid's cupped hands around the First
 * Flame, the great mother-candle now a fist-sized stub on its mound of
 * ancient wax. The quiet horror: her hands have gone translucent as wax —
 * light passes through the finger edges and the seams between fingers, a
 * warm subsurface glow pools in the fingertips, and frozen drip-lines run
 * down her forearms into darkness. Behind the glow, only suggestion: the
 * kneeling silhouette's edge, a hood holding two pinprick reflected flames
 * where no light should reach, a long braid singed at the tip. On the
 * mound the finger-shadows point the wrong way — toward the flame. Two-hue
 * law: her flame is warm amber/white-gold; the chamber's knowledge-light
 * is a distant verdigris breath; everything else near-void. Bottom-center
 * stays calm and dark for the caption. Caller has DPR-scaled and cleared.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall pattern, own seed) — never Math.random, never
// paint.ts crand (that stream belongs to the world-texture painters).
function slideRand(seed: number): () => number {
  let s = seed >>> 0 || 0x4e14d5;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

type Curve = { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number };

export function paintMeeting1(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = slideRand(0x4e14d5);
  const s = Math.min(w, h);

  // ── geometry ─────────────────────────────────────────────────────────────
  const HS = s * 0.34; // hand scale — one hand's length
  const fx = w * 0.44; // flame axis (hands own the center-left)
  const fy = h * 0.46; // stub crown height
  const st0 = fy + HS * 0.03; // stub top
  const st1 = fy + HS * 0.44; // stub foot, sunk into the mound
  const sr = HS * 0.21; // stub half-width — fist-sized
  const moundY = fy + HS * 0.46;
  const heartX = fx; // where the light lives (flame mid-body)
  const heartY = st0 - HS * 0.16;
  const hx = fx + HS * 0.05; // hood center
  const hy = fy - HS * 0.92;

  // ── small helpers ────────────────────────────────────────────────────────
  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  /** Flame teardrop: round base, tapered tip with a slight lean. */
  const drop = (x: number, baseY: number, hgt: number, wdt: number, lean: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + lean, baseY - hgt);
    ctx.quadraticCurveTo(x + wdt, baseY - hgt * 0.38, x + wdt * 0.62, baseY - wdt * 0.55);
    ctx.arc(x, baseY - wdt * 0.55, wdt * 0.62, 0, Math.PI);
    ctx.quadraticCurveTo(x - wdt, baseY - hgt * 0.38, x + lean, baseY - hgt);
    ctx.closePath();
    ctx.fill();
  };
  /** Additive radial glow of a token color at alpha a. */
  const glow = (gx: number, gy: number, r: number, col: string, a: number): void => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, shade(col, 1, a));
    g.addColorStop(1, shade(col, 1, 0));
    ctx.fillStyle = g;
    ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
    ctx.restore();
  };
  const qPt = (c: Curve, t: number): [number, number] => {
    const u = 1 - t;
    return [u * u * c.x0 + 2 * u * t * c.cx + t * t * c.x1, u * u * c.y0 + 2 * u * t * c.cy + t * t * c.y1];
  };
  const qTan = (c: Curve, t: number): [number, number] => {
    const dx = 2 * (1 - t) * (c.cx - c.x0) + 2 * t * (c.x1 - c.cx);
    const dy = 2 * (1 - t) * (c.cy - c.y0) + 2 * t * (c.y1 - c.cy);
    const L = Math.hypot(dx, dy) || 1;
    return [dx / L, dy / L];
  };
  /** Restrict a quadratic to [a,b] (polar-form control point). */
  const qSub = (c: Curve, a: number, b: number): Curve => {
    const [x0, y0] = qPt(c, a);
    const [x1, y1] = qPt(c, b);
    const ka = (1 - a) * (1 - b);
    const kc = (1 - a) * b + a * (1 - b);
    const kb = a * b;
    return { x0, y0, cx: ka * c.x0 + kc * c.cx + kb * c.x1, cy: ka * c.y0 + kc * c.cy + kb * c.y1, x1, y1 };
  };
  /** Shift a curve toward the flame heart by k px — inner-edge offsets. */
  const toward = (c: Curve, k: number): Curve => {
    const off = (px: number, py: number): [number, number] => {
      const dx = heartX - px;
      const dy = heartY - py;
      const L = Math.hypot(dx, dy) || 1;
      return [px + (dx / L) * k, py + (dy / L) * k];
    };
    const [x0, y0] = off(c.x0, c.y0);
    const [cx2, cy2] = off(c.cx, c.cy);
    const [x1, y1] = off(c.x1, c.y1);
    return { x0, y0, cx: cx2, cy: cy2, x1, y1 };
  };
  const strokeCurve = (c: Curve, lw: number, color: string): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(c.x0, c.y0);
    ctx.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1);
    ctx.stroke();
    ctx.lineCap = "butt";
  };

  // ── 1. base void — a breath of lift where the light will live ───────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, shade(C.void, 0.72));
  base.addColorStop(0.38, mix(C.void, C.surface, 0.22));
  base.addColorStop(0.62, mix(C.void, C.surface, 0.13));
  base.addColorStop(1, shade(C.void, 0.55));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. the chamber's knowledge-light — one far verdigris breath ─────────
  const haze = ctx.createRadialGradient(w * 0.9, h * 0.1, 0, w * 0.9, h * 0.1, s * 0.62);
  haze.addColorStop(0, shade(C.verdigrisDim, 1, 0.16));
  haze.addColorStop(0.6, shade(C.verdigrisDim, 1, 0.06));
  haze.addColorStop(1, shade(C.verdigrisDim, 1, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    // cold motes drifting in the far light
    ctx.fillStyle = mix(C.verdigris, C.verdigrisDim, 0.5, 0.04 + rand() * 0.06);
    ctx.beginPath();
    ctx.arc(w * (0.7 + rand() * 0.28), h * (0.03 + rand() * 0.3), 0.5 + rand() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 3. the kneeling silhouette — only suggestion, two degrees off ───────
  const sil = new Path2D();
  sil.moveTo(fx - HS * 1.55, fy + HS * 1.15);
  sil.bezierCurveTo(fx - HS * 1.3, fy + HS * 0.38, fx - HS * 1.02, fy - HS * 0.06, fx - HS * 0.68, fy - HS * 0.44);
  sil.quadraticCurveTo(fx - HS * 0.5, fy - HS * 0.6, hx - HS * 0.33, hy + HS * 0.14);
  sil.bezierCurveTo(hx - HS * 0.42, hy - HS * 0.22, hx - HS * 0.18, hy - HS * 0.42, hx + HS * 0.04, hy - HS * 0.41);
  sil.bezierCurveTo(hx + HS * 0.28, hy - HS * 0.4, hx + HS * 0.4, hy - HS * 0.08, hx + HS * 0.34, hy + HS * 0.14);
  sil.quadraticCurveTo(fx + HS * 0.48, fy - HS * 0.58, fx + HS * 0.8, fy - HS * 0.4);
  sil.bezierCurveTo(fx + HS * 1.14, fy - HS * 0.1, fx + HS * 1.34, fy + HS * 0.42, fx + HS * 1.55, fy + HS * 1.15);
  sil.closePath();
  // fill fades radially — her edge dissolves into the void before it can
  // read as geometry; only the hood and near shoulders hold their shape
  const silG = ctx.createRadialGradient(fx, fy - HS * 0.35, HS * 0.1, fx, fy - HS * 0.35, HS * 1.85);
  silG.addColorStop(0, mix(C.void, C.surface, 0.44));
  silG.addColorStop(0.5, mix(C.void, C.surface, 0.3));
  silG.addColorStop(0.82, mix(C.void, C.surface, 0.3, 0.35));
  silG.addColorStop(1, mix(C.void, C.surface, 0.3, 0));
  ctx.fillStyle = silG;
  ctx.fill(sil);
  // hood cavity — a soft darkness where a face should be (no hard edge)
  {
    const cav = ctx.createRadialGradient(hx, hy - HS * 0.01, 0, hx, hy - HS * 0.01, HS * 0.19);
    cav.addColorStop(0, shade(C.void, 0.35, 0.85));
    cav.addColorStop(0.7, shade(C.void, 0.35, 0.4));
    cav.addColorStop(1, shade(C.void, 0.35, 0));
    ctx.fillStyle = cav;
    ctx.fillRect(hx - HS * 0.2, hy - HS * 0.21, HS * 0.4, HS * 0.4);
  }
  // her flame warming the robe — clipped wash, then colorless-cloth folds
  ctx.save();
  ctx.clip(sil);
  ctx.globalCompositeOperation = "lighter";
  const robeWash = ctx.createRadialGradient(fx, fy - HS * 0.1, 0, fx, fy - HS * 0.1, HS * 1.4);
  robeWash.addColorStop(0, shade(C.ember, 0.7, 0.2));
  robeWash.addColorStop(0.55, shade(C.ember, 0.7, 0.08));
  robeWash.addColorStop(1, shade(C.ember, 0.7, 0));
  ctx.fillStyle = robeWash;
  ctx.fillRect(fx - HS * 1.6, fy - HS * 1.7, HS * 3.2, HS * 3.2);
  ctx.globalCompositeOperation = "source-over";
  ctx.lineWidth = Math.max(1, s * 0.003);
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = mix(C.boneDim, C.ink, 0.6, 0.06 + rand() * 0.04);
    ctx.beginPath();
    ctx.moveTo(fx + HS * (-0.3 + 0.26 * k), fy - HS * 0.55);
    ctx.quadraticCurveTo(
      fx + HS * (-0.34 + 0.27 * k),
      fy - HS * 0.1,
      fx + HS * (-0.38 + 0.29 * k) + (rand() - 0.5) * HS * 0.06,
      fy + HS * 0.32,
    );
    ctx.stroke();
  }
  ctx.restore();
  // the long braid, over the robe — plaited, singed at the tip
  const br: Curve = {
    x0: hx + HS * 0.26,
    y0: hy + HS * 0.1,
    cx: fx + HS * 0.68,
    cy: fy - HS * 0.42,
    x1: fx + HS * 0.76,
    y1: fy + HS * 0.14,
  };
  strokeCurve(br, HS * 0.044, mix(C.surface2, C.boneDim, 0.12));
  for (let k = 0; k < 9; k++) {
    const t = 0.07 + (k / 8) * 0.82;
    const [bpx, bpy] = qPt(br, t);
    const [btx, bty] = qTan(br, t);
    const bnx = -bty;
    const bny = btx;
    const sw2 = HS * 0.019;
    const dir = k % 2 === 0 ? 1 : -1;
    ctx.strokeStyle = shade(C.void, 0.75, 0.4);
    ctx.lineWidth = Math.max(1, HS * 0.008);
    line(bpx - bnx * sw2, bpy - bny * sw2, bpx + bnx * sw2 + btx * sw2 * dir, bpy + bny * sw2 + bty * sw2 * dir);
    if (t > 0.5 && k % 2 === 1) {
      // flame-side glints on the lower plaits
      ctx.fillStyle = mix(C.flame, C.ember, 0.5, 0.18 * t);
      ctx.beginPath();
      ctx.arc(bpx - bnx * sw2 * 1.1, bpy - bny * sw2 * 1.1, Math.max(0.7, HS * 0.006), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  strokeCurve(qSub(br, 0.86, 1), HS * 0.036, shade(C.void, 0.55)); // charred length
  {
    const [tpx, tpy] = qPt(br, 1);
    ctx.strokeStyle = shade(C.void, 0.8, 0.85);
    ctx.lineWidth = 1.1;
    for (const [ddx, ddy] of [
      [0.35, 0.9],
      [0.8, 0.55],
      [0.05, 1],
    ] as const) {
      line(tpx, tpy, tpx + ddx * HS * 0.05, tpy + ddy * HS * 0.05);
    }
    glow(tpx + HS * 0.02, tpy + HS * 0.03, HS * 0.045, shade(C.ember, 1), 0.12);
    ctx.fillStyle = shade(C.ember, 1.1, 0.8);
    ctx.beginPath();
    ctx.arc(tpx + HS * 0.019, tpy + HS * 0.046, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.flameHi, 1, 0.7);
    ctx.beginPath();
    ctx.arc(tpx + HS * 0.042, tpy + HS * 0.029, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // the chamber's cold rim along her far side — hood crown to shoulder only
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.42, 0.3);
  ctx.lineWidth = Math.max(1, s * 0.0022);
  ctx.beginPath();
  ctx.moveTo(hx + HS * 0.02, hy - HS * 0.415);
  ctx.bezierCurveTo(hx + HS * 0.28, hy - HS * 0.4, hx + HS * 0.4, hy - HS * 0.08, hx + HS * 0.34, hy + HS * 0.14);
  ctx.quadraticCurveTo(fx + HS * 0.5, fy - HS * 0.6, fx + HS * 0.78, fy - HS * 0.45);
  ctx.stroke();

  // ── 4. warm ambient bloom — the only warmth in the world ────────────────
  glow(fx, st0 - HS * 0.1, s * 0.52, mix(C.flame, C.ember, 0.45), 0.24);
  glow(fx, st0 - HS * 0.1, HS * 0.9, shade(C.flame, 1), 0.28);

  // ── 5. her eyes — two pinprick reflected flames that shouldn't be there ──
  for (const [exo, eyo, esc] of [
    [-0.075, -0.012, 1],
    [0.078, -0.018, 0.9],
  ] as const) {
    const ex = hx + HS * exo;
    const ey = hy + HS * eyo;
    glow(ex, ey, HS * 0.05, shade(C.flame, 1), 0.09);
    drop(ex, ey + HS * 0.012, HS * 0.024 * esc, HS * 0.006 * esc, HS * 0.0015, shade(C.flame, 1.05, 0.85));
    drop(ex, ey + HS * 0.01, HS * 0.014 * esc, HS * 0.0035 * esc, 0, shade(C.flameHi, 1.2, 0.9));
  }

  // ── 6. the mound of mother-wax, and the shadows that face the flame ─────
  ctx.save();
  ctx.translate(fx, moundY);
  ctx.scale(1, 0.16);
  const mg = ctx.createRadialGradient(0, 0, 0, 0, 0, HS * 1.15);
  mg.addColorStop(0, mix(C.ember, C.ink, 0.22));
  mg.addColorStop(0.35, mix(C.ember, C.ink, 0.55, 0.85));
  mg.addColorStop(0.7, mix(C.ink, C.void, 0.5, 0.35));
  mg.addColorStop(1, shade(C.void, 1, 0));
  ctx.fillStyle = mg;
  ctx.fillRect(-HS * 1.2, -HS * 1.2, HS * 2.4, HS * 2.4);
  ctx.restore();
  // a few hardened rivulets, low on the mound's face
  ctx.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    const a = Math.PI * (0.36 + 0.28 * rand());
    const r0 = HS * (0.22 + rand() * 0.08);
    const r1 = r0 + HS * (0.2 + rand() * 0.22);
    ctx.strokeStyle = mix(C.parchmentAged, C.ember, 0.6, 0.12 - k * 0.02);
    ctx.lineWidth = Math.max(1, HS * 0.011);
    line(fx + Math.cos(a) * r0, moundY + Math.sin(a) * r0 * 0.16, fx + Math.cos(a) * r1, moundY + Math.sin(a) * r1 * 0.16);
  }
  // THE WRONGNESS — finger-shadows on the lit wax, converging on the light
  for (const m of [-1, 1] as const) {
    for (let i = 0; i < 2; i++) {
      ctx.strokeStyle = shade(C.void, 0.45, 0.42 - i * 0.08);
      ctx.lineWidth = HS * (0.06 - 0.014 * i);
      line(
        fx + m * HS * (0.56 + 0.15 * i + rand() * 0.04),
        moundY + HS * (0.035 + 0.03 * i),
        fx + m * HS * 0.18,
        moundY - HS * 0.01,
      );
    }
  }
  ctx.lineCap = "butt";

  // ── 7. the First Flame — a fist-sized stub, molten-crowned ──────────────
  const stubP = new Path2D();
  stubP.moveTo(fx - sr * 0.98, st0);
  stubP.bezierCurveTo(fx - sr * 1.12, st0 + (st1 - st0) * 0.45, fx - sr * 0.94, st1 - HS * 0.03, fx - sr * 0.9, st1);
  stubP.lineTo(fx + sr * 0.92, st1);
  stubP.bezierCurveTo(fx + sr * 1.1, st1 - HS * 0.05, fx + sr * 1.06, st0 + (st1 - st0) * 0.35, fx + sr * 0.98, st0);
  stubP.closePath();
  const stubG = ctx.createLinearGradient(0, st0, 0, st1);
  stubG.addColorStop(0, mix(C.flame, C.parchment, 0.5));
  stubG.addColorStop(0.22, mix(C.flame, C.ember, 0.55));
  stubG.addColorStop(0.55, mix(C.ember, C.ink, 0.5));
  stubG.addColorStop(1, mix(C.ink, C.void, 0.55));
  ctx.fillStyle = stubG;
  ctx.fill(stubP);
  // old drips frozen down the stub's flanks
  ctx.lineCap = "round";
  for (let k = 0; k < 5; k++) {
    const px = fx + (rand() - 0.5) * 2 * sr * 0.8;
    const len = HS * (0.1 + rand() * 0.18);
    ctx.strokeStyle = mix(C.parchment, C.ember, 0.45, 0.35 - k * 0.04);
    ctx.lineWidth = Math.max(1, HS * 0.013);
    line(px, st0 + sr * 0.22, px + (rand() - 0.5) * HS * 0.02, st0 + sr * 0.22 + len);
  }
  ctx.lineCap = "butt";
  // the stub melts into its own pool — no hard edge at the foot
  ctx.save();
  ctx.translate(fx, st1);
  ctx.scale(1, 0.24);
  const foot = ctx.createRadialGradient(0, 0, 0, 0, 0, sr * 1.7);
  foot.addColorStop(0, mix(C.ember, C.flame, 0.3, 0.55));
  foot.addColorStop(0.55, mix(C.ember, C.ink, 0.45, 0.35));
  foot.addColorStop(1, mix(C.ember, C.ink, 0.5, 0));
  ctx.fillStyle = foot;
  ctx.fillRect(-sr * 1.8, -sr * 1.8, sr * 3.6, sr * 3.6);
  ctx.restore();
  // molten crown — the pool where the wick stands
  ctx.fillStyle = mix(C.flame, C.flameHi, 0.45);
  ctx.beginPath();
  ctx.ellipse(fx, st0, sr * 0.98, sr * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(C.flameHi, 1.1, 0.7);
  ctx.lineWidth = Math.max(1, HS * 0.008);
  ctx.beginPath();
  ctx.ellipse(fx, st0, sr * 0.98, sr * 0.3, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  glow(fx, st0 + HS * 0.075, HS * 0.26, mix(C.flame, C.ember, 0.3), 0.3); // wax gone luminous below the crown
  // wick and flame
  ctx.strokeStyle = shade(C.void, 0.8, 0.95);
  ctx.lineWidth = Math.max(1.4, HS * 0.016);
  ctx.beginPath();
  ctx.moveTo(fx, st0 + 1);
  ctx.quadraticCurveTo(fx + HS * 0.006, st0 - HS * 0.03, fx + HS * 0.016, st0 - HS * 0.05);
  ctx.stroke();
  drop(fx, st0, HS * 0.32, HS * 0.062, HS * 0.012, shade(C.flame, 1, 0.96));
  drop(fx, st0 - HS * 0.015, HS * 0.23, HS * 0.042, HS * 0.006, C.flameHi);
  drop(fx, st0 - HS * 0.025, HS * 0.14, HS * 0.024, 0, shade(C.flameHi, 1.7));
  // the First Flame's gilded halo — hers alone among all flames
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.4, 0.12);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(fx, heartY, HS * 0.3, 0, Math.PI * 2);
  ctx.stroke();

  // ── 8–9. HER HANDS — wax-translucent masses cupped around the light ─────
  /** One hand with its forearm melting into darkness. m=-1 near, +1 far. */
  const hand = (m: -1 | 1, lift: number, spread: number, dim: number): void => {
    const wx = fx + m * HS * 0.56 * spread;
    const wy = fy + HS * 0.54 + lift;
    // — forearm: overlapping round strokes sinking toward the frame corner —
    const ex2 = fx + m * HS * 0.82 * spread;
    const ey2 = Math.min(fy + HS * 1.18, h * 0.86);
    ctx.lineCap = "round";
    const armG = ctx.createLinearGradient(wx, wy, ex2, ey2);
    armG.addColorStop(0, mix(mix(C.ink, C.ember, 0.28 * dim), C.void, 0.18));
    armG.addColorStop(0.45, mix(mix(C.ink, C.ember, 0.14 * dim), C.void, 0.42, 0.95));
    armG.addColorStop(0.78, mix(C.ink, C.void, 0.72, 0.55));
    armG.addColorStop(1, shade(C.void, 0.8, 0));
    ctx.strokeStyle = armG;
    ctx.lineWidth = HS * 0.245;
    line(wx, wy, ex2, ey2);
    // warm rim on the flame-facing edge of the wrist
    const ux = ex2 - wx;
    const uy = ey2 - wy;
    const L = Math.hypot(ux, uy) || 1;
    const nx = -uy / L;
    const ny = ux / L;
    const sg = (heartX - wx) * nx + (heartY - wy) * ny > 0 ? 1 : -1;
    ctx.strokeStyle = mix(C.flame, C.ember, 0.55, 0.3 * dim);
    ctx.lineWidth = Math.max(1.2, HS * 0.013);
    line(
      wx + sg * nx * HS * 0.115,
      wy + sg * ny * HS * 0.115,
      wx + ux * 0.35 + sg * nx * HS * 0.125,
      wy + uy * 0.35 + sg * ny * HS * 0.125,
    );
    // frozen drip-lines running down the length of the forearm, into darkness
    for (let k = 0; k < 2; k++) {
      const t0 = 0.05 + rand() * 0.45;
      const lat = (rand() * 1.3 - 0.65) * HS * 0.08;
      const bxp = wx + ux * t0 + nx * lat;
      const byp = wy + uy * t0 + ny * lat;
      const len = HS * (0.14 + rand() * 0.2) * (1 - t0 * 0.5);
      const wobble = (rand() - 0.5) * HS * 0.035;
      ctx.strokeStyle = mix(C.parchmentAged, C.ember, 0.55, (0.22 - t0 * 0.25) * dim);
      ctx.lineWidth = Math.max(1, HS * 0.009);
      ctx.beginPath();
      ctx.moveTo(bxp, byp);
      ctx.quadraticCurveTo(
        bxp + (ux / L) * len * 0.5 + nx * wobble,
        byp + (uy / L) * len * 0.5 + ny * wobble,
        bxp + (ux / L) * len,
        byp + (uy / L) * len,
      );
      ctx.stroke();
    }
    // — the hand mass: palm heel + wrist bridge + four close fingers —
    const massCol = mix(mix(C.ink, C.void, 0.22), C.ember, 0.16 * dim);
    ctx.strokeStyle = massCol;
    ctx.lineWidth = HS * 0.21;
    line(wx, wy, fx + m * HS * 0.36 * spread, fy + HS * 0.4 + lift);
    ctx.save();
    ctx.translate(fx + m * HS * 0.36 * spread, fy + HS * 0.4 + lift);
    ctx.rotate(m * 0.5);
    ctx.fillStyle = massCol;
    ctx.beginPath();
    ctx.ellipse(0, 0, HS * 0.26, HS * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // thumb crossing the stub's face — dark against the glowing wax
    const th: Curve = {
      x0: fx + m * HS * 0.4 * spread,
      y0: fy + HS * 0.48 + lift,
      cx: fx + m * HS * 0.22 * spread,
      cy: fy + HS * 0.46 + lift,
      x1: fx + m * HS * (m > 0 ? 0.16 : 0.06) * spread,
      y1: fy + HS * (m > 0 ? 0.36 : 0.29) + lift,
    };
    strokeCurve(th, HS * 0.1, massCol);
    strokeCurve(toward(qSub(th, 0.25, 0.92), HS * 0.032), Math.max(1.2, HS * 0.012), mix(C.flame, C.flameHi, 0.4, 0.4 * dim));
    // fingers: tight vertical fan hugging the stub, tips beside the flame
    const fingers: Curve[] = [];
    const widths: number[] = [];
    for (let i = 0; i < 4; i++) {
      const fc: Curve = {
        x0: fx + m * HS * (0.16 + 0.088 * i) * spread,
        y0: fy + HS * (0.3 + 0.02 * i) + lift,
        cx: fx + m * HS * (0.21 + 0.1 * i) * spread,
        cy: fy + HS * 0.05 + lift,
        x1: fx + m * HS * (0.1 + 0.082 * i) * spread,
        y1: fy + HS * (-0.16 + 0.068 * i) + lift,
      };
      fingers.push(fc);
      widths.push(HS * (0.102 - 0.008 * i));
    }
    for (let i = 3; i >= 0; i--) {
      // base pass, one shared tone → a single scalloped mass
      strokeCurve(fingers[i] as Curve, widths[i] as number, massCol);
    }
    for (let i = 0; i < 4; i++) {
      const fc = fingers[i] as Curve;
      const w0 = widths[i] as number;
      const q = 1 - 0.22 * i;
      // soft warm modelling toward the flame side
      strokeCurve(toward(fc, w0 * 0.18), w0 * 0.52, mix(C.ink, C.ember, 0.36 + 0.2 * q, 0.5 * dim));
      strokeCurve(toward(qSub(fc, 0.55, 1), w0 * 0.28), w0 * 0.26, mix(C.ember, C.flame, 0.25 + 0.4 * q, 0.5 * dim));
      // the translucent edge — light through the rim of the flesh
      strokeCurve(toward(qSub(fc, 0.5, 1), w0 * 0.4), Math.max(1, w0 * 0.11), mix(C.flame, C.flameHi, 0.45, (0.3 + 0.35 * q) * dim));
      // subsurface glow pooled in the fingertip
      const [tx2, ty2] = qPt(fc, 1);
      glow(tx2, ty2, w0 * 1.2, mix(C.flame, C.flameHi, 0.6), (0.12 + 0.18 * q) * dim);
      ctx.fillStyle = mix(C.flameHi, C.parchment, 0.4, (0.18 + 0.24 * q) * dim);
      ctx.beginPath();
      ctx.arc(tx2, ty2, w0 * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // one faint crease per finger — the light maps it
      const [px2, py2] = qPt(fc, 0.52);
      const [dxT, dyT] = qTan(fc, 0.52);
      ctx.strokeStyle = shade(C.void, 0.7, 0.3 * dim);
      ctx.lineWidth = Math.max(1, w0 * 0.08);
      line(px2 + dyT * w0 * 0.26, py2 - dxT * w0 * 0.26, px2 - dyT * w0 * 0.26, py2 + dxT * w0 * 0.26);
      if (m > 0 && i === 3) {
        // the knowledge-light finds her far knuckle — a cold counter-rim
        strokeCurve(toward(qSub(fc, 0.3, 0.9), -w0 * 0.42), Math.max(1, w0 * 0.1), mix(C.verdigris, C.verdigrisDim, 0.45, 0.16));
      }
    }
    // light bleeding through the seams between fingers
    for (let i = 0; i < 3; i++) {
      const a1 = qPt(fingers[i] as Curve, 1);
      const b1 = qPt(fingers[i + 1] as Curve, 1);
      const a0 = qPt(fingers[i] as Curve, 0.35);
      const b0 = qPt(fingers[i + 1] as Curve, 0.35);
      const sx0 = (a1[0] + b1[0]) / 2;
      const sy0 = (a1[1] + b1[1]) / 2 + HS * 0.015;
      const sx1 = (a0[0] + b0[0]) / 2;
      const sy1 = (a0[1] + b0[1]) / 2;
      const dl = Math.hypot(sx1 - sx0, sy1 - sy0) || 1;
      const seamLen = HS * 0.15;
      ctx.strokeStyle = mix(C.flame, C.flameHi, 0.5, 0.32 * dim);
      ctx.lineWidth = Math.max(1.1, HS * 0.01);
      ctx.lineCap = "round";
      line(sx0, sy0, sx0 + ((sx1 - sx0) / dl) * seamLen, sy0 + ((sy1 - sy0) / dl) * seamLen);
      glow(sx0, sy0, HS * 0.04, shade(C.flame, 1), 0.16 * dim);
    }
    ctx.lineCap = "butt";
  };

  hand(1, -HS * 0.03, 1.1, 0.8); // her far hand, a half-step behind
  hand(-1, 0, 1, 1); // her near hand
  // drips frozen across the back of the near hand
  ctx.lineCap = "round";
  for (let j = 0; j < 2; j++) {
    ctx.strokeStyle = mix(C.parchmentAged, C.ember, 0.5, 0.16);
    ctx.lineWidth = Math.max(1, HS * 0.012);
    const dx0 = fx - HS * (0.3 + 0.09 * j);
    ctx.beginPath();
    ctx.moveTo(dx0, fy + HS * 0.34);
    ctx.quadraticCurveTo(dx0 - HS * 0.02, fy + HS * 0.44, dx0 - HS * 0.035, fy + HS * (0.52 + 0.03 * j));
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // light through the web of the near hand — the thinnest flesh glowing
  glow(fx - HS * 0.16, fy + HS * 0.22, HS * 0.1, mix(C.flame, C.ember, 0.35), 0.22);

  // ── 10. the flame reasserts — core glow kissing the fingertips ──────────
  glow(fx, st0 - HS * 0.12, HS * 0.55, shade(C.flame, 1), 0.2);
  for (let i = 0; i < 3; i++) {
    // sparks rising
    ctx.fillStyle = shade(C.flameHi, 1, 0.35 + rand() * 0.35);
    ctx.beginPath();
    ctx.arc(fx + (rand() - 0.5) * HS * 0.12, st0 - HS * (0.4 + rand() * 0.32), 0.7 + rand() * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // warm motes adrift in her small weather
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = HS * (0.3 + rand() * 1.0);
    ctx.fillStyle = mix(C.flameHi, C.bone, 0.5, 0.05 + rand() * 0.1);
    ctx.beginPath();
    ctx.arc(fx + Math.cos(a) * r, st0 - HS * 0.1 + Math.sin(a) * r * 0.8, 0.5 + rand() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 11. grain, crush, settle, vignette — the plate finish ───────────────
  for (let i = 0; i < 560; i++) {
    const gx2 = rand() * w;
    const gy2 = rand() * h * 0.8;
    ctx.fillStyle = rand() < 0.5 ? shade(C.bone, 1, 0.012 + rand() * 0.022) : shade(C.void, 0.3, 0.03 + rand() * 0.03);
    ctx.fillRect(gx2, gy2, 1, 1);
  }
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.18);
  crush.addColorStop(0, shade(C.void, 0.6, 0.8));
  crush.addColorStop(1, shade(C.void, 0.6, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.18);
  const settle = ctx.createLinearGradient(0, h * 0.7, 0, h);
  settle.addColorStop(0, shade(C.void, 0.55, 0));
  settle.addColorStop(0.55, shade(C.void, 0.55, 0.45));
  settle.addColorStop(1, shade(C.void, 0.55, 0.82));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  const vr = Math.min(w, h) * 0.55;
  for (const [vx, vy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    const v = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    v.addColorStop(0, shade(C.void, 0.5, 0.42));
    v.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}
