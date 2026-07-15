/**
 * Meeting plate 3 — "The Gift." The Candlemaid kneels before the First
 * Flame, now a fist-sized stub atop the melted mother-monument. A visitor
 * kneels opposite and tips their delver candle's last wax into the stub;
 * her hands — gone translucent as wax from years of cupping the flame,
 * drip-lines frozen down the forearms — steady the visitor's hands. Four
 * hands, two kinds of flesh. The fed flame stands visibly taller than in
 * any other plate, throwing dawn-long light across the chamber floor and
 * up the monument. Her shadow faces the flame instead of fleeing it; her
 * eyes hold a reflected flame; nothing screams — everything is two
 * degrees off true. Far behind, faintest of all, stairs lead up, lit by
 * nothing yet. Two-hue law: warm amber/white-gold belongs to her flame;
 * verdigris is the chamber's carved knowledge-light; all else near-void.
 * Caller has DPR-scaled and cleared; the bottom band stays calm and dark
 * for the caption: "The way up is shorter than the way down."
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall pattern, own seed) — never Math.random, never
// paint.ts crand (that stream belongs to the world-texture painters).
function slideRand(seed: number): () => number {
  let s = seed >>> 0 || 0x91f7;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintMeeting3(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = slideRand(0x91f7c3);
  const s = Math.min(w, h);
  const INK = shade(C.void, 0.7, 0.9);

  // ── geometry ─────────────────────────────────────────────────────────────
  const cx = w * 0.5;
  const floorY = h * 0.66;
  const daisY = floorY + s * 0.022; // the stub stands a step nearer than the wall
  const stubW = s * 0.032; // fist-sized — half-width of the mother-candle stub
  const stubH = s * 0.055;
  const stubTop = daisY - stubH;
  const flx = cx - s * 0.006; // wick axis
  const flameH = s * 0.165; // VISIBLY taller than in the other plates
  const flameCy = stubTop - flameH * 0.6;
  const kH = s * 0.27; // her kneeling height
  const kV = s * 0.255; // the visitor kneels a little smaller
  const mX = cx - s * 0.115; // her knees' anchor — she leans close
  const vX = cx + s * 0.125;
  const baseM = floorY + s * 0.012;
  const baseV = floorY + s * 0.018;
  // the exchange — where the gift falls, and the tipped candle above it
  const exX = cx + s * 0.02;
  const tip = { x: exX + s * 0.002, y: stubTop - s * 0.03 };
  const butt = { x: exX + s * 0.054, y: stubTop - s * 0.102 }; // steep — mid-pour

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
  /** One small carved mark (waystone alphabet); caller sets stroke state. */
  const mark = (gx: number, gy: number, gs: number, kind: number): void => {
    ctx.beginPath();
    if (kind === 0) {
      ctx.moveTo(gx, gy - gs);
      ctx.lineTo(gx, gy + gs);
      ctx.moveTo(gx - gs * 0.55, gy - gs * 0.25);
      ctx.lineTo(gx + gs * 0.55, gy - gs * 0.25);
    } else if (kind === 1) {
      ctx.moveTo(gx - gs * 0.65, gy + gs * 0.55);
      ctx.lineTo(gx, gy - gs * 0.55);
      ctx.lineTo(gx + gs * 0.65, gy + gs * 0.55);
    } else if (kind === 2) {
      ctx.moveTo(gx - gs * 0.55, gy + gs * 0.6);
      ctx.lineTo(gx + gs * 0.2, gy - gs * 0.6);
      ctx.moveTo(gx - gs * 0.05, gy + gs * 0.6);
      ctx.lineTo(gx + gs * 0.65, gy - gs * 0.6);
    } else if (kind === 3) {
      ctx.moveTo(gx, gy - gs * 0.65);
      ctx.lineTo(gx + gs * 0.5, gy);
      ctx.lineTo(gx, gy + gs * 0.65);
      ctx.lineTo(gx - gs * 0.5, gy);
      ctx.closePath();
    } else {
      ctx.moveTo(gx - gs * 0.55, gy);
      ctx.lineTo(gx + gs * 0.55, gy);
      ctx.moveTo(gx + gs * 0.15, gy - gs * 0.5);
      ctx.lineTo(gx + gs * 0.55, gy);
      ctx.lineTo(gx + gs * 0.15, gy + gs * 0.5);
    }
    ctx.stroke();
  };
  /** A capsule between two circle ends — limbs, sleeves. */
  const capsulePath = (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number): void => {
    const a = Math.atan2(y1 - y0, x1 - x0);
    const px = -Math.sin(a);
    const py = Math.cos(a);
    ctx.beginPath();
    ctx.moveTo(x0 + px * r0, y0 + py * r0);
    ctx.lineTo(x1 + px * r1, y1 + py * r1);
    ctx.arc(x1, y1, r1, a + Math.PI / 2, a - Math.PI / 2, true);
    ctx.lineTo(x0 - px * r0, y0 - py * r0);
    ctx.arc(x0, y0, r0, a - Math.PI / 2, a + Math.PI / 2, true);
    ctx.closePath();
  };

  // ── 1. base void — a chamber that has never seen the sky ────────────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, shade(C.void, 0.8));
  base.addColorStop(0.42, mix(C.void, C.surface, 0.42));
  base.addColorStop(0.66, mix(C.void, C.surface2, 0.38));
  base.addColorStop(0.84, shade(C.void, 0.85));
  base.addColorStop(1, shade(C.void, 0.65));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. the chamber's knowledge-light — verdigris pooling off the script ──
  for (const [kx, ky] of [
    [w * 0.15, h * 0.38],
    [w * 0.85, h * 0.36],
  ] as const) {
    const pool = ctx.createRadialGradient(kx, ky, 0, kx, ky, s * 0.42);
    pool.addColorStop(0, shade(C.verdigrisDim, 1, 0.11));
    pool.addColorStop(0.6, shade(C.verdigrisDim, 0.9, 0.05));
    pool.addColorStop(1, shade(C.verdigrisDim, 1, 0));
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, w, h);
  }
  // carved glyph rows on the back wall — generations of it, worn with age
  ctx.lineCap = "round";
  for (let r = 0; r < 7; r++) {
    const ry = h * 0.2 + (floorY - s * 0.05 - h * 0.2) * (r / 6);
    const gs = s * 0.011;
    for (let gx = w * 0.045; gx < w * 0.955; gx += gs * 2.6 * (0.9 + rand() * 0.4)) {
      if (Math.abs(gx - cx) < s * (0.16 + rand() * 0.07)) continue; // her light owns the center
      if (rand() < 0.3) continue; // weathering
      const dl = Math.min(Math.hypot(gx - w * 0.15, ry - h * 0.38), Math.hypot(gx - w * 0.85, ry - h * 0.36));
      const a = Math.max(0.035, 0.2 - (dl / s) * 0.28);
      ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.55, a);
      ctx.lineWidth = Math.max(0.8, gs * 0.22);
      mark(gx, ry + (rand() - 0.5) * gs, gs * (0.8 + rand() * 0.4), Math.floor(rand() * 5));
    }
  }
  ctx.lineCap = "butt";
  // flanking pillars, each with a dim rune column — fog-stop framing
  for (const px of [w * 0.075, w * 0.925] as const) {
    const colW = Math.max(w * 0.032, s * 0.03);
    ctx.fillStyle = mix(C.void, C.surface, 0.62);
    ctx.fillRect(px - colW / 2, h * 0.07, colW, floorY - h * 0.07 + s * 0.015);
    ctx.beginPath(); // capital wedge
    ctx.moveTo(px - colW * 0.75, h * 0.125);
    ctx.lineTo(px + colW * 0.75, h * 0.125);
    ctx.lineTo(px + colW * 0.52, h * 0.155);
    ctx.lineTo(px - colW * 0.52, h * 0.155);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(C.surface2, 1.25, 0.3);
    ctx.lineWidth = 1;
    line(px + colW * 0.5, h * 0.16, px + colW * 0.5, floorY);
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const gy = h * 0.22 + i * s * 0.062;
      if (gy > floorY - s * 0.06) break;
      ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.45, 0.16 + rand() * 0.08);
      ctx.lineWidth = 1;
      mark(px, gy, s * 0.011, Math.floor(rand() * 5));
    }
    ctx.lineCap = "butt";
  }

  // ── 3. far background — the stairs UP, lit by nothing yet ───────────────
  {
    const sx0 = w * 0.78;
    const sy0 = floorY - s * 0.035;
    const stepN = 7;
    const run = s * 0.021;
    const rise = s * 0.032;
    // mass under the flight — a wedge of deeper dark, soft-edged
    ctx.fillStyle = shade(C.void, 0.75, 0.22);
    ctx.beginPath();
    ctx.moveTo(sx0 - s * 0.012, sy0 + s * 0.012);
    ctx.lineTo(sx0 + run * stepN + s * 0.02, sy0 - rise * stepN + s * 0.012);
    ctx.lineTo(sx0 + run * stepN + s * 0.02, sy0 + s * 0.012);
    ctx.closePath();
    ctx.fill();
    // the flight itself: one stepped zigzag, fading as it climbs
    ctx.strokeStyle = mix(C.void, C.boneDim, 0.48, 0.24);
    ctx.lineWidth = Math.max(1.2, s * 0.0016);
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    for (let i = 0; i < stepN; i++) {
      ctx.lineTo(sx0 + run * (i + 1), sy0 - rise * i); // tread
      ctx.lineTo(sx0 + run * (i + 1), sy0 - rise * (i + 1)); // riser
    }
    ctx.stroke();
    for (let i = 1; i < stepN; i++) {
      // tread returns — a hint of depth on each step
      ctx.strokeStyle = mix(C.void, C.boneDim, 0.42, 0.14 - i * 0.012);
      ctx.lineWidth = 1;
      line(sx0 + run * i, sy0 - rise * i, sx0 + run * i - s * 0.014, sy0 - rise * i + s * 0.006);
    }
    // the mouth at the top — an arch of nothing, barely there
    ctx.strokeStyle = mix(C.void, C.surface, 0.95, 0.4);
    ctx.lineWidth = Math.max(1, s * 0.0014);
    ctx.beginPath();
    ctx.arc(sx0 + run * stepN + s * 0.012, sy0 - rise * stepN + s * 0.004, s * 0.045, Math.PI * 0.98, Math.PI * 1.92);
    ctx.stroke();
  }

  // ── 4. the melted monument — the mother-candle's spent centuries ────────
  const mon = new Path2D();
  mon.moveTo(cx - s * 0.31, floorY + s * 0.01);
  mon.bezierCurveTo(cx - s * 0.29, floorY - s * 0.09, cx - s * 0.22, floorY - s * 0.12, cx - s * 0.19, floorY - s * 0.19);
  mon.bezierCurveTo(cx - s * 0.16, floorY - s * 0.26, cx - s * 0.1, floorY - s * 0.25, cx - s * 0.075, floorY - s * 0.3);
  mon.quadraticCurveTo(cx - s * 0.03, floorY - s * 0.355, cx + s * 0.02, floorY - s * 0.335);
  mon.bezierCurveTo(cx + s * 0.07, floorY - s * 0.32, cx + s * 0.09, floorY - s * 0.26, cx + s * 0.13, floorY - s * 0.225);
  mon.bezierCurveTo(cx + s * 0.18, floorY - s * 0.19, cx + s * 0.21, floorY - s * 0.11, cx + s * 0.27, floorY - s * 0.075);
  mon.quadraticCurveTo(cx + s * 0.3, floorY - s * 0.04, cx + s * 0.305, floorY + s * 0.01);
  mon.closePath();
  const monG = ctx.createLinearGradient(0, floorY - s * 0.36, 0, floorY + s * 0.01);
  monG.addColorStop(0, mix(C.void, C.parchmentAged, 0.055));
  monG.addColorStop(1, mix(C.void, C.parchmentAged, 0.115));
  ctx.fillStyle = monG;
  ctx.fill(mon);
  ctx.save();
  ctx.clip(mon);
  // the new long light climbing it — dawn happening underground
  ctx.globalCompositeOperation = "lighter";
  const climb = ctx.createRadialGradient(flx, stubTop - flameH * 0.3, s * 0.02, flx, stubTop - flameH * 0.3, s * 0.34);
  climb.addColorStop(0, shade(C.flame, 0.55, 0.26));
  climb.addColorStop(0.5, shade(C.ember, 0.55, 0.1));
  climb.addColorStop(1, shade(C.ember, 0.55, 0));
  ctx.fillStyle = climb;
  ctx.fill(mon);
  ctx.globalCompositeOperation = "source-over";
  // frozen drip runnels catching the rise, brighter near the stub
  for (let i = 0; i < 12; i++) {
    const dx = cx + (rand() - 0.5) * s * 0.5;
    const near = Math.max(0, 1 - Math.abs(dx - cx) / (s * 0.22));
    const dTop = floorY - s * (0.05 + rand() * 0.24) * (0.4 + near * 0.6);
    const dLen = s * (0.05 + rand() * 0.11);
    ctx.strokeStyle = mix(C.parchmentAged, C.flame, 0.25 + near * 0.3, 0.05 + near * 0.17);
    ctx.lineWidth = Math.max(1, s * (0.0014 + rand() * 0.0018));
    ctx.beginPath();
    ctx.moveTo(dx, dTop);
    ctx.bezierCurveTo(dx + s * 0.004, dTop + dLen * 0.35, dx - s * 0.004, dTop + dLen * 0.65, dx + (rand() - 0.5) * s * 0.006, dTop + dLen);
    ctx.stroke();
  }
  // sag tiers — the melt settled in waves, only ghosts of lines
  ctx.strokeStyle = shade(C.void, 0.85, 0.22);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const ry = floorY - s * (0.08 + i * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.31, ry);
    ctx.quadraticCurveTo(cx + (rand() - 0.5) * s * 0.1, ry + s * (0.014 + rand() * 0.02), cx + s * 0.31, ry - s * 0.012);
    ctx.stroke();
  }
  ctx.restore();
  // crown rim — the crest catching the newly-risen light
  ctx.strokeStyle = mix(C.ember, C.flame, 0.45, 0.4);
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.075, floorY - s * 0.3);
  ctx.quadraticCurveTo(cx - s * 0.03, floorY - s * 0.355, cx + s * 0.02, floorY - s * 0.335);
  ctx.stroke();
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.5, 0.1); // far shoulder, cold
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.29, floorY - s * 0.1);
  ctx.bezierCurveTo(cx - s * 0.27, floorY - s * 0.14, cx - s * 0.22, floorY - s * 0.14, cx - s * 0.19, floorY - s * 0.19);
  ctx.stroke();

  // ── 5. floor — the new light lying long across it ───────────────────────
  const floorG = ctx.createLinearGradient(0, floorY, 0, h);
  floorG.addColorStop(0, mix(C.void, C.surface2, 0.42));
  floorG.addColorStop(0.4, mix(C.void, C.surface, 0.26));
  floorG.addColorStop(1, shade(C.void, 0.6));
  ctx.fillStyle = floorG;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.strokeStyle = shade(C.surface2, 1.2, 0.1);
  ctx.lineWidth = 1;
  line(0, floorY + s * 0.05, cx - s * 0.2, floorY + s * 0.05);
  line(cx + s * 0.2, floorY + s * 0.05, w, floorY + s * 0.05);
  ctx.strokeStyle = shade(C.surface2, 1.15, 0.05);
  line(0, floorY + s * 0.1, cx - s * 0.26, floorY + s * 0.1);
  line(cx + s * 0.26, floorY + s * 0.1, w, floorY + s * 0.1);
  // the warm pool at the dais, squashed to the floor plane
  ctx.save();
  ctx.translate(cx, daisY + s * 0.006);
  ctx.scale(1, 0.3);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.42);
  pool.addColorStop(0, mix(C.ember, C.flame, 0.5, 0.32));
  pool.addColorStop(0.5, shade(C.ember, 0.7, 0.13));
  pool.addColorStop(1, shade(C.ember, 0.7, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-s * 0.45, -s * 0.45, s * 0.9, s * 0.9);
  ctx.restore();
  // long rays — dawn spokes thrown flat across the flags
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [txf, tyf, hwf] of [
    [-0.46, 0.075, 0.03],
    [-0.29, 0.105, 0.022],
    [-0.13, 0.125, 0.015],
    [0.11, 0.125, 0.015],
    [0.27, 0.1, 0.022],
    [0.45, 0.07, 0.03],
  ] as const) {
    const tx = cx + txf * w;
    const ty = floorY + tyf * (h - floorY) * 0.9;
    const rayG = ctx.createLinearGradient(cx, daisY, tx, ty);
    rayG.addColorStop(0, mix(C.flame, C.ember, 0.45, 0.16));
    rayG.addColorStop(1, mix(C.flame, C.ember, 0.45, 0));
    ctx.fillStyle = rayG;
    ctx.beginPath();
    ctx.moveTo(cx, daisY + s * 0.004);
    ctx.lineTo(tx, ty - hwf * s);
    ctx.lineTo(tx, ty + hwf * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // ── 6. spent votives at the monument's feet — their shadows obey ────────
  for (const [vxf, vyf, vhf] of [
    [-0.375, 0.012, 0.032],
    [-0.345, 0.02, 0.018],
    [0.345, 0.008, 0.026],
    [0.385, 0.018, 0.038],
  ] as const) {
    const vx = cx + vxf * s;
    const vy = floorY + vyf * s;
    const vh2 = vhf * s;
    const vw2 = s * 0.008;
    const away = vxf < 0 ? -1 : 1; // shadows flee the flame, as shadows should
    ctx.fillStyle = shade(C.void, 0.45, 0.24);
    ctx.beginPath();
    ctx.moveTo(vx, vy + 1);
    ctx.lineTo(vx + away * s * (0.038 + rand() * 0.02), vy + s * 0.009);
    ctx.lineTo(vx + away * s * (0.038 + rand() * 0.02), vy + s * 0.013);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(C.parchmentAged, C.void, 0.55);
    ctx.fillRect(vx - vw2, vy - vh2, vw2 * 2, vh2);
    ctx.strokeStyle = mix(C.parchment, C.flame, 0.3, 0.4);
    ctx.lineWidth = 1;
    line(vx - away * vw2, vy - vh2 + 1, vx - away * vw2, vy - 1);
    ctx.strokeStyle = shade(C.void, 0.9, 0.7);
    line(vx, vy - vh2, vx + vw2 * 0.3, vy - vh2 - vw2 * 0.6);
  }

  // ── 7. shadows of the two kneelers — his flees the flame; HERS DOES NOT ─
  // the visitor's, long and lawful, running away to the right
  {
    const g0 = ctx.createLinearGradient(vX, 0, vX + s * 0.55, 0);
    g0.addColorStop(0, shade(C.void, 0.3, 0.5));
    g0.addColorStop(1, shade(C.void, 0.3, 0));
    ctx.fillStyle = g0;
    ctx.beginPath();
    ctx.moveTo(vX - kV * 0.2, baseV + s * 0.004);
    ctx.quadraticCurveTo(vX + s * 0.2, baseV + s * 0.055, vX + s * 0.55, baseV + s * 0.05);
    ctx.lineTo(vX + s * 0.55, baseV + s * 0.018);
    ctx.quadraticCurveTo(vX + s * 0.2, baseV + s * 0.004, vX - kV * 0.2, baseV);
    ctx.closePath();
    ctx.fill();
  }
  // hers — turned wrong, a soft reach TOWARD the flame across the lit floor
  {
    const sh0x = mX - kH * 0.16;
    const sh1x = cx - stubW * 1.15;
    const g1 = ctx.createLinearGradient(sh0x, 0, sh1x, 0);
    g1.addColorStop(0, shade(C.void, 0.28, 0.68));
    g1.addColorStop(0.75, shade(C.void, 0.28, 0.4));
    g1.addColorStop(1, shade(C.void, 0.28, 0.05));
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.moveTo(sh0x, baseM + s * 0.008);
    ctx.quadraticCurveTo(sh0x - s * 0.035, baseM + s * 0.04, sh0x + s * 0.02, baseM + s * 0.062);
    ctx.quadraticCurveTo((sh0x + sh1x) / 2, baseM + s * 0.062, sh1x, daisY + s * 0.014);
    ctx.quadraticCurveTo((sh0x + sh1x) / 2, baseM + s * 0.012, sh0x, baseM + s * 0.008);
    ctx.closePath();
    ctx.fill();
  }

  // ── 8. THE CANDLEMAID — kneeling close, leaning into what she keeps ─────
  // body silhouette without arms (the sleeves ride on top later, so the
  // kneeling profile stays legible: rump on heels, forward spine, hood)
  const maid = new Path2D();
  maid.moveTo(mX - kH * 0.22, baseM); // hem behind the heels
  maid.bezierCurveTo(mX - kH * 0.26, baseM - kH * 0.16, mX - kH * 0.2, baseM - kH * 0.28, mX - kH * 0.17, baseM - kH * 0.36);
  // spine leaning toward the flame
  maid.bezierCurveTo(mX - kH * 0.13, baseM - kH * 0.54, mX - kH * 0.07, baseM - kH * 0.68, mX, baseM - kH * 0.79);
  maid.quadraticCurveTo(mX + kH * 0.005, baseM - kH * 0.815, mX + kH * 0.02, baseM - kH * 0.825); // neck dip
  maid.quadraticCurveTo(mX, baseM - kH * 0.925, mX + kH * 0.1, baseM - kH * 0.935); // hood dome
  maid.quadraticCurveTo(mX + kH * 0.2, baseM - kH * 0.915, mX + kH * 0.215, baseM - kH * 0.8);
  maid.quadraticCurveTo(mX + kH * 0.22, baseM - kH * 0.75, mX + kH * 0.17, baseM - kH * 0.71); // hood mouth
  maid.bezierCurveTo(mX + kH * 0.19, baseM - kH * 0.62, mX + kH * 0.18, baseM - kH * 0.56, mX + kH * 0.165, baseM - kH * 0.5); // chest
  maid.bezierCurveTo(mX + kH * 0.17, baseM - kH * 0.32, mX + kH * 0.13, baseM - kH * 0.16, mX + kH * 0.09, baseM - kH * 0.03); // thigh
  maid.quadraticCurveTo(mX + kH * 0.085, baseM, mX + kH * 0.07, baseM);
  maid.closePath();
  const maidG = ctx.createLinearGradient(mX - kH * 0.26, 0, mX + kH * 0.22, 0);
  maidG.addColorStop(0, mix(C.inkSoft, C.void, 0.66));
  maidG.addColorStop(0.6, mix(C.inkSoft, C.void, 0.28));
  maidG.addColorStop(1, mix(C.inkSoft, C.boneDim, 0.4));
  ctx.fillStyle = maidG;
  ctx.fill(maid);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0024);
  ctx.stroke(maid);
  // small melt-bumps where her hem meets the stone — becoming what she keeps
  ctx.fillStyle = mix(C.inkSoft, C.void, 0.52);
  ctx.beginPath();
  ctx.moveTo(mX - kH * 0.22, baseM);
  ctx.quadraticCurveTo(mX - kH * 0.16, baseM + kH * 0.032, mX - kH * 0.09, baseM + kH * 0.01);
  ctx.quadraticCurveTo(mX - kH * 0.01, baseM + kH * 0.036, mX + kH * 0.03, baseM + kH * 0.012);
  ctx.quadraticCurveTo(mX + kH * 0.055, baseM + kH * 0.026, mX + kH * 0.07, baseM);
  ctx.closePath();
  ctx.fill();
  // fold shadows down the robe, and the hood's occlusion on her chest
  ctx.strokeStyle = shade(C.void, 0.9, 0.4);
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(mX - kH * 0.06, baseM - kH * 0.6);
  ctx.bezierCurveTo(mX - kH * 0.04, baseM - kH * 0.4, mX - kH * 0.06, baseM - kH * 0.2, mX - kH * 0.1, baseM - kH * 0.02);
  ctx.moveTo(mX + kH * 0.03, baseM - kH * 0.52);
  ctx.bezierCurveTo(mX + kH * 0.05, baseM - kH * 0.36, mX + kH * 0.02, baseM - kH * 0.18, mX - kH * 0.02, baseM - kH * 0.03);
  ctx.stroke();
  ctx.fillStyle = shade(C.void, 0.9, 0.35); // under-hood shadow
  ctx.beginPath();
  ctx.ellipse(mX + kH * 0.13, baseM - kH * 0.67, kH * 0.075, kH * 0.028, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // warm rim: brow, chin, chest, thigh — the flame side of her
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.3, 0.8);
  ctx.lineWidth = Math.max(1.2, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(mX + kH * 0.215, baseM - kH * 0.8);
  ctx.quadraticCurveTo(mX + kH * 0.22, baseM - kH * 0.75, mX + kH * 0.17, baseM - kH * 0.71);
  ctx.bezierCurveTo(mX + kH * 0.19, baseM - kH * 0.62, mX + kH * 0.18, baseM - kH * 0.56, mX + kH * 0.165, baseM - kH * 0.5);
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.5, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mX + kH * 0.17, baseM - kH * 0.32);
  ctx.quadraticCurveTo(mX + kH * 0.15, baseM - kH * 0.16, mX + kH * 0.09, baseM - kH * 0.03);
  ctx.stroke();
  // hood crest catching the risen light
  ctx.strokeStyle = mix(C.flame, C.flameHi, 0.3, 0.4);
  ctx.lineWidth = Math.max(1, s * 0.0016);
  ctx.beginPath();
  ctx.moveTo(mX + kH * 0.03, baseM - kH * 0.918);
  ctx.quadraticCurveTo(mX + kH * 0.11, baseM - kH * 0.938, mX + kH * 0.19, baseM - kH * 0.87);
  ctx.stroke();
  // verdigris whisper along her back — the chamber's claim on her
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.5, 0.3);
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.beginPath();
  ctx.moveTo(mX - kH * 0.17, baseM - kH * 0.36);
  ctx.bezierCurveTo(mX - kH * 0.13, baseM - kH * 0.54, mX - kH * 0.07, baseM - kH * 0.68, mX, baseM - kH * 0.79);
  ctx.stroke();
  // the braid — swung off her back into the open air, tip singed to char
  ctx.strokeStyle = mix(C.boneDim, C.inkSoft, 0.55);
  ctx.lineWidth = Math.max(1.6, kH * 0.026);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(mX - kH * 0.005, baseM - kH * 0.8);
  ctx.bezierCurveTo(mX - kH * 0.13, baseM - kH * 0.72, mX - kH * 0.19, baseM - kH * 0.6, mX - kH * 0.175, baseM - kH * 0.42);
  ctx.stroke();
  ctx.strokeStyle = shade(C.inkSoft, 1.45, 0.55); // plaited glints
  ctx.lineWidth = 1;
  for (const bt of [0.25, 0.5, 0.75] as const) {
    const bx = mX - kH * (0.005 + 0.17 * bt);
    const by = baseM - kH * (0.8 - 0.37 * bt);
    line(bx - kH * 0.014, by - kH * 0.008, bx + kH * 0.014, by + kH * 0.008);
  }
  ctx.strokeStyle = shade(C.void, 1.3, 0.95); // char
  ctx.lineWidth = Math.max(1.6, kH * 0.028);
  ctx.beginPath();
  ctx.moveTo(mX - kH * 0.177, baseM - kH * 0.44);
  ctx.quadraticCurveTo(mX - kH * 0.17, baseM - kH * 0.4, mX - kH * 0.178, baseM - kH * 0.37);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = mix(C.ember, C.flame, 0.45, 0.8); // one ember still thinking
  ctx.beginPath();
  ctx.arc(mX - kH * 0.177, baseM - kH * 0.37, Math.max(1, kH * 0.008), 0, Math.PI * 2);
  ctx.fill();
  // hood cavity — and the reflected flame that should not be this bright
  ctx.fillStyle = shade(C.void, 0.75, 0.95);
  ctx.beginPath();
  ctx.ellipse(mX + kH * 0.15, baseM - kH * 0.795, kH * 0.048, kH * 0.06, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.35, 0.5); // lit profile edge
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mX + kH * 0.195, baseM - kH * 0.835);
  ctx.quadraticCurveTo(mX + kH * 0.21, baseM - kH * 0.795, mX + kH * 0.19, baseM - kH * 0.755);
  ctx.stroke();
  for (const gx of [mX + kH * 0.132, mX + kH * 0.168] as const) {
    ctx.fillStyle = shade(C.flame, 1, 0.28);
    ctx.beginPath();
    ctx.arc(gx, baseM - kH * 0.8, Math.max(1.8, kH * 0.015), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.flameHi, 1.25, 0.95);
    ctx.beginPath();
    ctx.arc(gx, baseM - kH * 0.8, Math.max(0.9, kH * 0.008), 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 9. THE VISITOR — a delver kneeling opposite, pack still on ──────────
  const vis = new Path2D();
  vis.moveTo(vX + kV * 0.24, baseV); // hem behind the heels
  vis.bezierCurveTo(vX + kV * 0.28, baseV - kV * 0.16, vX + kV * 0.22, baseV - kV * 0.28, vX + kV * 0.19, baseV - kV * 0.36);
  // spine rising through the pack hump, leaning toward the gift
  vis.bezierCurveTo(vX + kV * 0.24, baseV - kV * 0.5, vX + kV * 0.2, baseV - kV * 0.64, vX + kV * 0.08, baseV - kV * 0.72);
  vis.quadraticCurveTo(vX + kV * 0.045, baseV - kV * 0.77, vX + kV * 0.03, baseV - kV * 0.8); // neck dip
  vis.quadraticCurveTo(vX + kV * 0.04, baseV - kV * 0.9, vX - kV * 0.06, baseV - kV * 0.91); // hood dome
  vis.quadraticCurveTo(vX - kV * 0.16, baseV - kV * 0.89, vX - kV * 0.18, baseV - kV * 0.78);
  vis.quadraticCurveTo(vX - kV * 0.185, baseV - kV * 0.73, vX - kV * 0.14, baseV - kV * 0.7); // hood mouth
  vis.bezierCurveTo(vX - kV * 0.155, baseV - kV * 0.62, vX - kV * 0.15, baseV - kV * 0.56, vX - kV * 0.14, baseV - kV * 0.5); // chest
  vis.bezierCurveTo(vX - kV * 0.145, baseV - kV * 0.32, vX - kV * 0.11, baseV - kV * 0.16, vX - kV * 0.08, baseV - kV * 0.03); // thigh
  vis.quadraticCurveTo(vX - kV * 0.075, baseV, vX - kV * 0.06, baseV);
  vis.closePath();
  const visG = ctx.createLinearGradient(vX - kV * 0.185, 0, vX + kV * 0.28, 0);
  visG.addColorStop(0, mix(C.ink, C.ember, 0.2));
  visG.addColorStop(0.5, mix(C.ink, C.void, 0.32));
  visG.addColorStop(1, shade(C.void, 1.35));
  ctx.fillStyle = visG;
  ctx.fill(vis);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0024);
  ctx.stroke(vis);
  // hood crest against the dark — so his head parts from the monument
  ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.5);
  ctx.lineWidth = Math.max(1, s * 0.0016);
  ctx.beginPath();
  ctx.moveTo(vX + kV * 0.02, baseV - kV * 0.885);
  ctx.quadraticCurveTo(vX - kV * 0.06, baseV - kV * 0.915, vX - kV * 0.14, baseV - kV * 0.85);
  ctx.stroke();
  // fold shadows down the cloak
  ctx.strokeStyle = shade(C.void, 0.7, 0.5);
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(vX + kV * 0.04, baseV - kV * 0.56);
  ctx.bezierCurveTo(vX + kV * 0.06, baseV - kV * 0.38, vX + kV * 0.03, baseV - kV * 0.18, vX + kV * 0.07, baseV - kV * 0.02);
  ctx.stroke();
  // bedroll strap across the pack
  ctx.strokeStyle = shade(C.void, 0.9, 0.6);
  ctx.lineWidth = Math.max(1, s * 0.0022);
  ctx.beginPath();
  ctx.moveTo(vX + kV * 0.0, baseV - kV * 0.68);
  ctx.quadraticCurveTo(vX + kV * 0.12, baseV - kV * 0.6, vX + kV * 0.18, baseV - kV * 0.44);
  ctx.stroke();
  // warm rim on the flame-facing contour — brow, chest, knee
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.3, 0.7);
  ctx.lineWidth = Math.max(1.2, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(vX - kV * 0.18, baseV - kV * 0.78);
  ctx.quadraticCurveTo(vX - kV * 0.185, baseV - kV * 0.73, vX - kV * 0.14, baseV - kV * 0.7);
  ctx.bezierCurveTo(vX - kV * 0.155, baseV - kV * 0.62, vX - kV * 0.15, baseV - kV * 0.56, vX - kV * 0.14, baseV - kV * 0.5);
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.5, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(vX - kV * 0.145, baseV - kV * 0.32);
  ctx.quadraticCurveTo(vX - kV * 0.11, baseV - kV * 0.16, vX - kV * 0.08, baseV - kV * 0.03);
  ctx.stroke();
  // hood cavity bowed toward the gift — this face keeps its shadows,
  // save for a breath of firelight along the jaw
  ctx.fillStyle = shade(C.void, 0.65, 0.8);
  ctx.beginPath();
  ctx.ellipse(vX - kV * 0.135, baseV - kV * 0.79, kV * 0.032, kV * 0.046, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.5, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(vX - kV * 0.135, baseV - kV * 0.775, kV * 0.034, Math.PI * 0.35, Math.PI * 0.85);
  ctx.stroke();
  // verdigris kiss along the pack — the way back down is behind him
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.5, 0.22);
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.beginPath();
  ctx.moveTo(vX + kV * 0.19, baseV - kV * 0.36);
  ctx.bezierCurveTo(vX + kV * 0.24, baseV - kV * 0.5, vX + kV * 0.2, baseV - kV * 0.64, vX + kV * 0.08, baseV - kV * 0.72);
  ctx.stroke();

  // ── 10. the dais and the fist-sized stub of the First Flame ─────────────
  ctx.fillStyle = mix(C.parchmentAged, C.void, 0.62);
  ctx.beginPath();
  ctx.ellipse(cx, daisY + s * 0.004, s * 0.115, s * 0.026, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(C.parchmentAged, C.void, 0.45);
  ctx.beginPath();
  ctx.ellipse(cx, daisY, s * 0.082, s * 0.02, 0, 0, Math.PI * 2);
  ctx.fill();
  const stub = new Path2D(); // squat body with a melted skirt
  stub.moveTo(cx - stubW, stubTop + s * 0.004);
  stub.bezierCurveTo(cx - stubW * 1.12, daisY - stubH * 0.5, cx - stubW * 1.3, daisY - stubH * 0.22, cx - stubW * 1.5, daisY);
  for (const [t, dpt] of [
    [-0.9, 0.3],
    [-0.4, 0.12],
    [0.15, 0.34],
    [0.7, 0.1],
    [1.5, 0.28],
  ] as const) {
    stub.quadraticCurveTo(cx + stubW * (t - 0.28), daisY + s * 0.012 * dpt * 2, cx + stubW * t, daisY + s * 0.008 * dpt);
  }
  stub.bezierCurveTo(cx + stubW * 1.3, daisY - stubH * 0.3, cx + stubW * 1.1, daisY - stubH * 0.55, cx + stubW, stubTop + s * 0.004);
  stub.closePath();
  const stubG = ctx.createLinearGradient(0, stubTop, 0, daisY);
  stubG.addColorStop(0, mix(C.parchment, C.flame, 0.35, 0.95));
  stubG.addColorStop(0.4, mix(C.parchmentAged, C.ember, 0.25));
  stubG.addColorStop(1, mix(C.parchmentAged, C.void, 0.5));
  ctx.fillStyle = stubG;
  ctx.fill(stub);
  ctx.strokeStyle = shade(C.void, 0.9, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke(stub);
  // drip ribs down the body
  ctx.strokeStyle = mix(C.parchment, C.flame, 0.25, 0.4);
  for (const dxf of [-0.62, -0.15, 0.42, 0.8] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + stubW * dxf, stubTop + s * 0.006);
    ctx.quadraticCurveTo(cx + stubW * (dxf - 0.1), stubTop + stubH * 0.55, cx + stubW * (dxf + 0.08), daisY - s * 0.004);
    ctx.stroke();
  }
  // molten crown — the mouth that has just been fed
  ctx.fillStyle = mix(C.flame, C.flameHi, 0.45, 0.95);
  ctx.beginPath();
  ctx.ellipse(cx, stubTop, stubW * 0.88, stubW * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(C.flameHi, 1.2, 0.8);
  ctx.lineWidth = Math.max(1, s * 0.0016);
  ctx.beginPath();
  ctx.ellipse(cx, stubTop, stubW * 0.88, stubW * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // ── 11. the exchange — four hands, two kinds of flesh ───────────────────
  const candAng = Math.atan2(butt.y - tip.y, butt.x - tip.x);
  const handC = { x: tip.x + (butt.x - tip.x) * 0.44, y: tip.y + (butt.y - tip.y) * 0.44 };
  const handD = { x: tip.x + (butt.x - tip.x) * 0.8, y: tip.y + (butt.y - tip.y) * 0.8 };
  const flesh = mix(C.bone, C.ink, 0.42);
  // her sleeves first — robe-grey cloth reaching out of the lean, each
  // ending in a dark cuff where the cloth stops and the change begins
  for (const [ux0, uy0, ux1, uy1] of [
    [mX + kH * 0.1, baseM - kH * 0.56, mX + kH * 0.32, baseM - kH * 0.46],
    [mX + kH * 0.08, baseM - kH * 0.44, mX + kH * 0.24, baseM - kH * 0.26],
  ] as const) {
    capsulePath(ux0, uy0, ux1, uy1, s * 0.016, s * 0.012);
    ctx.fillStyle = mix(C.inkSoft, C.boneDim, 0.3);
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 0.8, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = mix(C.inkSoft, C.void, 0.3);
    ctx.beginPath();
    ctx.ellipse(ux1, uy1, s * 0.0125, s * 0.0155, -0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  // the visitor's sleeves and bare wrists in from the right
  for (const [ux0, uy0, ux1, uy1, hx, hy] of [
    [vX - kV * 0.06, baseV - kV * 0.58, vX - kV * 0.18, baseV - kV * 0.52, handD.x, handD.y],
    [vX - kV * 0.09, baseV - kV * 0.48, vX - kV * 0.21, baseV - kV * 0.42, handC.x, handC.y],
  ] as const) {
    capsulePath(ux0, uy0, ux1, uy1, s * 0.0145, s * 0.0115);
    ctx.fillStyle = mix(C.ink, C.void, 0.26);
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 0.75, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.35); // firelight underside
    line(ux1, uy1 + s * 0.012, ux0, uy0 + s * 0.015);
    capsulePath(ux1, uy1, hx + (ux1 - hx) * 0.3, hy + (uy1 - hy) * 0.3, s * 0.0085, s * 0.0068);
    ctx.fillStyle = flesh;
    ctx.fill();
  }
  // the delver candle, tipped — the game's own candle, giving itself away
  {
    const cl = Math.hypot(butt.x - tip.x, butt.y - tip.y);
    const cw = s * 0.0105;
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(candAng);
    const cg = ctx.createLinearGradient(0, -cw, 0, cw);
    cg.addColorStop(0, shade(C.parchment, 1.0));
    cg.addColorStop(1, shade(C.parchmentAged, 0.6));
    ctx.fillStyle = cg;
    ctx.fillRect(0, -cw, cl, cw * 2);
    ctx.strokeStyle = shade(C.void, 0.8, 0.7);
    ctx.lineWidth = 1;
    ctx.strokeRect(0, -cw, cl, cw * 2);
    ctx.fillStyle = shade(C.parchmentAged, 0.72); // butt cap
    ctx.beginPath();
    ctx.ellipse(cl, 0, cw * 0.5, cw, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(C.flameHi, C.flame, 0.35, 0.95); // molten mouth
    ctx.beginPath();
    ctx.ellipse(0, 0, cw * 0.55, cw * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // the ember warmth of its spent mouth — its own flame already given
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const tipGlow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, s * 0.02);
    tipGlow.addColorStop(0, shade(C.flame, 0.9, 0.4));
    tipGlow.addColorStop(1, shade(C.flame, 0.9, 0));
    ctx.fillStyle = tipGlow;
    ctx.fillRect(tip.x - s * 0.022, tip.y - s * 0.022, s * 0.044, s * 0.044);
    ctx.restore();
    // the gift itself — a thread of molten wax falling into the stub
    ctx.strokeStyle = mix(C.flameHi, C.flame, 0.2, 0.92);
    ctx.lineWidth = Math.max(1.2, s * 0.0028);
    line(tip.x + s * 0.003, tip.y + s * 0.008, tip.x + s * 0.005, stubTop - s * 0.002);
    ctx.fillStyle = shade(C.flameHi, 1.35, 0.95);
    ctx.beginPath();
    ctx.arc(tip.x + s * 0.005, stubTop - s * 0.001, Math.max(1.2, s * 0.0032), 0, Math.PI * 2);
    ctx.fill();
  }
  // the visitor's bare hands gripping the candle — opaque, ordinary
  for (const [hx, hy, hr] of [
    [handC.x, handC.y, s * 0.0115],
    [handD.x, handD.y, s * 0.0105],
  ] as const) {
    ctx.fillStyle = flesh;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr, hr * 0.74, candAng, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 0.8, 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = mix(C.flame, C.bone, 0.45, 0.7); // firelight on knuckles
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr, hr * 0.74, candAng, Math.PI * 0.6, Math.PI * 1.45);
    ctx.stroke();
  }
  // HER forearms and hands — translucent as wax, lit from within
  const waxFill = mix(C.parchment, C.flame, 0.24, 0.42);
  const waxEdge = shade(C.parchmentAged, 1.05, 0.75);
  const waxLimb = (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number): void => {
    capsulePath(x0, y0, x1, y1, r0, r1);
    ctx.fillStyle = waxFill;
    ctx.fill();
    ctx.strokeStyle = waxEdge;
    ctx.lineWidth = Math.max(1, s * 0.0014);
    ctx.stroke();
    ctx.save(); // the flame showing through the meat of the arm
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = mix(C.flameHi, C.parchment, 0.35, 0.24);
    ctx.lineWidth = Math.max(1.5, (r0 + r1) * 0.66);
    ctx.lineCap = "round";
    line(x0, y0, x1, y1);
    ctx.restore();
    ctx.lineCap = "butt";
    // drip-lines frozen down the underside, each ending in a bead
    const a = Math.atan2(y1 - y0, x1 - x0);
    const px = -Math.sin(a);
    const py = Math.cos(a);
    ctx.strokeStyle = shade(C.parchmentAged, 1.1, 0.85);
    ctx.lineWidth = 1;
    for (const t of [0.35, 0.62, 0.85] as const) {
      const dx = x0 + (x1 - x0) * t + px * (r0 + (r1 - r0) * t) * 0.8;
      const dy = y0 + (y1 - y0) * t + py * (r0 + (r1 - r0) * t) * 0.8;
      const dl = s * (0.007 + rand() * 0.007);
      line(dx, dy, dx + (rand() - 0.5) * 2, dy + dl);
      ctx.fillStyle = shade(C.parchmentAged, 1.15, 0.9);
      ctx.beginPath();
      ctx.arc(dx + (rand() - 0.5) * 2, dy + dl, Math.max(1, s * 0.0018), 0, Math.PI * 2);
      ctx.fill();
    }
  };
  // bare translucent forearms out of the cuffs, cradling the exchange
  waxLimb(mX + kH * 0.32, baseM - kH * 0.46, exX + s * 0.024, stubTop - s * 0.048, s * 0.0088, s * 0.007);
  waxLimb(mX + kH * 0.24, baseM - kH * 0.26, cx - s * 0.004, stubTop + s * 0.006, s * 0.0088, s * 0.007);
  // her cupped hands — one cradling the stub itself, one steadying his grip
  for (const [hx, hy, hr, rot] of [
    [cx - s * 0.001, stubTop + s * 0.01, s * 0.013, -0.2],
    [exX + s * 0.028, stubTop - s * 0.049, s * 0.0125, -0.8],
  ] as const) {
    ctx.fillStyle = waxFill;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr, hr * 0.7, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = waxEdge;
    ctx.lineWidth = Math.max(1, s * 0.0014);
    ctx.stroke();
    ctx.strokeStyle = shade(C.parchmentAged, 1.05, 0.55); // finger seams
    ctx.lineWidth = 1;
    for (const ft of [-0.3, 0.15, 0.55] as const) {
      line(
        hx + Math.cos(rot) * hr * ft,
        hy + Math.sin(rot) * hr * ft - hr * 0.45,
        hx + Math.cos(rot) * hr * (ft + 0.12),
        hy + Math.sin(rot) * hr * (ft + 0.12) + hr * 0.45,
      );
    }
    ctx.save(); // subsurface glow — she is closest to what she keeps
    ctx.globalCompositeOperation = "lighter";
    const sub = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr * 2);
    sub.addColorStop(0, mix(C.flameHi, C.flame, 0.4, 0.2));
    sub.addColorStop(1, mix(C.flameHi, C.flame, 0.4, 0));
    ctx.fillStyle = sub;
    ctx.fillRect(hx - hr * 2, hy - hr * 2, hr * 4, hr * 4);
    ctx.restore();
  }

  // ── 12. THE FIRST FLAME — fed, and taller than any plate has shown it ───
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(flx, flameCy, 0, flx, flameCy, s * 0.34);
  halo.addColorStop(0, shade(C.flame, 0.85, 0.4));
  halo.addColorStop(0.5, shade(C.ember, 0.8, 0.16));
  halo.addColorStop(1, shade(C.ember, 0.8, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(flx - s * 0.36, flameCy - s * 0.36, s * 0.72, s * 0.72);
  ctx.restore();
  // the gilded rings of her office — the First Flame's iconography
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.35, 0.5);
  ctx.lineWidth = Math.max(1.2, s * 0.0018);
  ctx.beginPath();
  ctx.arc(flx, flameCy, s * 0.078, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.3, 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(flx, flameCy, s * 0.108, 0, Math.PI * 2);
  ctx.stroke();
  drop(flx, stubTop + s * 0.002, flameH * 1.32, s * 0.019, s * 0.0035, shade(C.flame, 1, 0.95));
  drop(flx, stubTop - s * 0.003, flameH * 1.0, s * 0.0125, s * 0.002, C.flameHi);
  drop(flx, stubTop - s * 0.006, flameH * 0.62, s * 0.0068, 0, shade(C.flameHi, 1.65));
  // rising light — a slow dawn column reaching for the ceiling it forgot
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const col = ctx.createLinearGradient(0, stubTop - flameH * 0.8, 0, h * 0.04);
  col.addColorStop(0, shade(C.flame, 0.75, 0.09));
  col.addColorStop(0.55, shade(C.ember, 0.7, 0.04));
  col.addColorStop(1, shade(C.ember, 0.7, 0));
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(flx - s * 0.05, stubTop - flameH * 0.7);
  ctx.lineTo(flx - s * 0.45, h * 0.02);
  ctx.lineTo(flx + s * 0.45, h * 0.02);
  ctx.lineTo(flx + s * 0.05, stubTop - flameH * 0.7);
  ctx.closePath();
  ctx.fill();
  const kiss = ctx.createRadialGradient(flx, h * 0.06, 0, flx, h * 0.06, s * 0.32);
  kiss.addColorStop(0, shade(C.ember, 0.7, 0.06));
  kiss.addColorStop(1, shade(C.ember, 0.7, 0));
  ctx.fillStyle = kiss;
  ctx.fillRect(flx - s * 0.34, h * 0.06 - s * 0.34, s * 0.68, s * 0.68);
  // sparks going up like the first birds
  for (let i = 0; i < 9; i++) {
    const t = rand();
    const sy = stubTop - flameH * 1.1 - t * (stubTop - flameH * 1.1 - h * 0.12);
    const sx = flx + Math.sin(i * 2.1 + t * 5) * s * (0.01 + t * 0.03);
    ctx.fillStyle = mix(C.flameHi, C.flame, rand() * 0.5, 0.7 * (1 - t * 0.8));
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(0.7, s * 0.0012 * (1.4 - t)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ── 13. air — warm motes near the gift, verdigris motes by the script ───
  for (let i = 0; i < 30; i++) {
    const mx = rand() * w;
    const my = h * 0.12 + rand() * (floorY - h * 0.12);
    const nearFlame = Math.abs(mx - cx) < s * 0.22;
    ctx.fillStyle = nearFlame
      ? mix(C.flameHi, C.bone, 0.5, 0.05 + rand() * 0.1)
      : mix(C.bone, C.verdigris, 0.4, 0.03 + rand() * 0.06);
    ctx.beginPath();
    ctx.arc(mx, my, 0.5 + rand() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 14. grain, crush, settle, vignette — and a calm floor for the words ─
  for (let i = 0; i < 560; i++) {
    const gx = rand() * w;
    const gy = rand() * h * 0.82;
    ctx.fillStyle = rand() < 0.5 ? shade(C.bone, 1, 0.014 + rand() * 0.024) : shade(C.void, 0.3, 0.03 + rand() * 0.03);
    ctx.fillRect(gx, gy, 1, 1);
  }
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.18);
  crush.addColorStop(0, shade(C.void, 0.6, 0.8));
  crush.addColorStop(1, shade(C.void, 0.6, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.18);
  const settle = ctx.createLinearGradient(0, h * 0.76, 0, h);
  settle.addColorStop(0, shade(C.void, 0.55, 0));
  settle.addColorStop(0.6, shade(C.void, 0.55, 0.5));
  settle.addColorStop(1, shade(C.void, 0.5, 0.78));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.76, w, h * 0.24);
  const vr = Math.min(w, h) * 0.6;
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
