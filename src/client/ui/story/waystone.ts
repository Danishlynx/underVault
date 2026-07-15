/**
 * Story slide 6 — "The town's memory." A buried chamber holds the great
 * waystone: the game's verdigris monolith, its lower two-thirds densely
 * carved with generations of glyph-rows — one fresh bright line still being
 * cut, older lines fading beneath it, the base worn to ghost scratches.
 * Around it, the town at work: a carver mid-strike with chisel and mallet,
 * a mourner cupping a lit candle over a shrouded body, a reader crouched
 * at the oldest lines. A row of snuffed candle stubs and a second bundle
 * mark the cost. Behind and to the right, a dark stair mouth descends —
 * chalk trails, tallies and a crude map fragment lead across the floor
 * toward it, and the planted signpost points the same way. Smaller
 * waystones recede into fog; stalactites frame the ceiling; a cool shaft
 * of light falls through drifting motes onto the stone.
 *
 * Pure canvas painting in the guildhall idiom: token colors via shade()/
 * mix() only, flat woodcut masses, fog-stop depth, a private LCG for
 * jitter, no speckle. Two-hue law: amber = flame/warmth, verdigris =
 * Vault/knowledge. Caller has scaled for DPR and cleared; the center-
 * bottom stays calm and dark for the caption.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall's hallRand pattern, own seed) — never Math.random,
// never paint.ts crand (its stream belongs to the world-texture painters).
function slideRand(seed: number): () => number {
  let s = seed >>> 0 || 0x57a7e;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintWaystone(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = slideRand(0x57a7e);
  const s = Math.min(w, h);
  const INK = shade(C.void, 0.7, 0.9);

  // ── geometry ──────────────────────────────────────────────────────────
  const cx = w * 0.42; // stone sits left of center; the descent owns the right
  const floorY = h * 0.62;
  const topY = h * 0.15;
  const baseY = floorY - h * 0.008;
  const sw = Math.min(Math.max(s * 0.095, 34), 100); // half-width at the shoulder
  const shoulderY = topY + sw * 1.15;
  const stoneH = baseY - topY;
  const runeY = topY + stoneH * 0.26;
  const bandTop = topY + stoneH * 0.4; // carved-rows band: lower ~60% of the face
  // the descent — an arched stair mouth in the back wall, right of the stone
  const pxc = w * 0.72;
  const pw2 = Math.max(w * 0.052, sw * 0.85);
  const archTop = floorY - h * 0.21;
  // where the chisel is cutting today's line
  const chiselTip = { x: cx + sw * 0.55, y: bandTop + sw * 0.05 };

  /** Stone face half-width at height y (the monolith tapers to the foot). */
  const faceHalf = (y: number): number =>
    sw * (1 - 0.18 * Math.max(0, (y - shoulderY) / (baseY - shoulderY)));

  /** One small carved mark; caller sets strokeStyle/lineWidth. */
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

  // ── 1. base void gradient — cool lift behind the stone, crushed floor ──
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, C.void);
  base.addColorStop(0.4, mix(C.void, C.surface, 0.5));
  base.addColorStop(0.62, mix(C.void, C.surface2, 0.5));
  base.addColorStop(1, shade(C.void, 0.85));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. sacred aura — one wide verdigris breath centered on the rune ────
  const aura = ctx.createRadialGradient(cx, runeY, s * 0.02, cx, runeY, s * 0.6);
  aura.addColorStop(0, shade(C.verdigris, 0.95, 0.14));
  aura.addColorStop(0.45, shade(C.verdigrisDim, 1, 0.07));
  aura.addColorStop(1, shade(C.verdigris, 1, 0));
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, w, h);

  // ── 3. far architecture — fog stop 1: hazy columns and vault ribs ──────
  ctx.fillStyle = mix(C.void, C.surface, 0.35);
  for (const fx of [0.155, 0.865]) {
    const colW = (0.04 + rand() * 0.02) * w;
    const colX = fx * w - colW / 2 + (rand() - 0.5) * 0.02 * w;
    const colTop = h * (0.1 + rand() * 0.05);
    ctx.fillRect(colX, colTop, colW, floorY - colTop);
    ctx.beginPath();
    ctx.moveTo(colX - colW * 0.3, colTop + h * 0.02);
    ctx.lineTo(colX + colW * 1.3, colTop + h * 0.02);
    ctx.lineTo(colX + colW, colTop + h * 0.045);
    ctx.lineTo(colX, colTop + h * 0.045);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = mix(C.void, C.surface, 0.45, 0.6);
  ctx.lineWidth = Math.max(1, s * 0.004);
  for (let i = 0; i < 3; i++) {
    const y0 = h * (0.055 + i * 0.035);
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(w * (0.3 + rand() * 0.4), y0 + h * (0.05 + rand() * 0.03), w, y0 + (rand() - 0.5) * h * 0.02);
    ctx.stroke();
  }

  // ── 4. background waystones — two fog planes, each with a dim rune ─────
  const farStone = (fx: number, fy: number, fh2: number, tone: string, runeA: number, lean: number): void => {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(fx + lean * fh2, fy - fh2);
    ctx.lineTo(fx + fh2 * 0.3 + lean * fh2 * 0.7, fy - fh2 * 0.72);
    ctx.lineTo(fx + fh2 * 0.24, fy);
    ctx.lineTo(fx - fh2 * 0.24, fy);
    ctx.lineTo(fx - fh2 * 0.3 + lean * fh2 * 0.7, fy - fh2 * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(C.verdigris, 0.95, runeA);
    ctx.lineWidth = Math.max(1, fh2 * 0.05);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fx + lean * fh2 * 0.4, fy - fh2 * 0.64);
    ctx.lineTo(fx + lean * fh2 * 0.4, fy - fh2 * 0.34);
    ctx.moveTo(fx - fh2 * 0.1 + lean * fh2 * 0.4, fy - fh2 * 0.53);
    ctx.lineTo(fx + fh2 * 0.1 + lean * fh2 * 0.4, fy - fh2 * 0.53);
    ctx.stroke();
    ctx.lineCap = "butt";
  };
  // plane A — farthest, faintest
  farStone(w * 0.185, floorY - h * 0.015, h * 0.085, mix(C.void, C.surface, 0.55), 0.22, -0.04);
  farStone(w * 0.545, floorY - h * 0.01, h * 0.075, mix(C.void, C.surface, 0.5), 0.18, 0.05);

  // ── 5. fog band at the horizon, tinted toward the stone's green ────────
  const fog = ctx.createLinearGradient(0, h * 0.52, 0, h * 0.66);
  fog.addColorStop(0, mix(C.void, C.verdigrisDim, 0.16, 0));
  fog.addColorStop(0.5, mix(C.void, C.verdigrisDim, 0.16, 0.45));
  fog.addColorStop(1, mix(C.void, C.verdigrisDim, 0.16, 0));
  ctx.fillStyle = fog;
  ctx.fillRect(0, h * 0.52, w, h * 0.14);

  // plane B — nearer silhouettes standing out of the fog
  farStone(w * 0.135, floorY, h * 0.115, mix(C.void, C.surface2, 0.75), 0.34, 0.05);
  farStone(w * 0.85, floorY, h * 0.1, mix(C.void, C.surface2, 0.7), 0.3, -0.06);

  // ── 6. floor — flagstone joints receding, fading before the caption ────
  const floor = ctx.createLinearGradient(0, floorY, 0, h);
  floor.addColorStop(0, mix(C.void, C.surface2, 0.5));
  floor.addColorStop(1, shade(C.void, 0.8));
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.strokeStyle = shade(C.surface2, 1.25, 0.28);
  ctx.lineWidth = 1;
  let rowY = floorY + h * 0.012;
  let gap = h * 0.02;
  const rows: number[] = [];
  while (rowY < h * 0.85) {
    rows.push(rowY);
    ctx.globalAlpha = Math.max(0.15, 1 - (rowY - floorY) / (h * 0.32));
    ctx.beginPath();
    ctx.moveTo(0, rowY);
    ctx.lineTo(w, rowY);
    ctx.stroke();
    rowY += gap;
    gap *= 1.5;
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const y0 = rows[i]!;
    const y1 = rows[i + 1]!;
    const n = 5 - i;
    for (let j = 0; j < n; j++) {
      const jx = (0.06 + rand() * 0.88) * w;
      if (y0 > h * 0.72 && jx > w * 0.22 && jx < w * 0.78) continue;
      ctx.globalAlpha = Math.max(0.1, 0.3 - i * 0.07);
      ctx.beginPath();
      ctx.moveTo(jx, y0);
      ctx.lineTo(jx + (rand() - 0.5) * 4, y1);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // ── 7. THE DESCENT — arched stair mouth, steps fading into black ───────
  // jamb frame, a shade lighter than the wall
  ctx.fillStyle = mix(C.void, C.surface2, 0.8);
  ctx.beginPath();
  ctx.moveTo(pxc - pw2 * 1.22, floorY + h * 0.004);
  ctx.lineTo(pxc - pw2 * 1.22, archTop + pw2 * 0.7 - pw2 * 0.25);
  ctx.quadraticCurveTo(pxc - pw2 * 1.15, archTop - pw2 * 0.28, pxc, archTop - pw2 * 0.3);
  ctx.quadraticCurveTo(pxc + pw2 * 1.15, archTop - pw2 * 0.28, pxc + pw2 * 1.22, archTop + pw2 * 0.45);
  ctx.lineTo(pxc + pw2 * 1.22, floorY + h * 0.004);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.85, 0.55);
  ctx.lineWidth = Math.max(1, s * 0.0028);
  ctx.stroke();
  // jamb block joints
  ctx.strokeStyle = shade(C.surface2, 1.25, 0.3);
  ctx.lineWidth = 1;
  for (const sx of [-1, 1]) {
    for (let i = 1; i < 4; i++) {
      const jy = floorY - (floorY - archTop) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(pxc + sx * pw2, jy);
      ctx.lineTo(pxc + sx * pw2 * 1.22, jy - pw2 * 0.06);
      ctx.stroke();
    }
  }
  // interior — near-black throat
  const inner = new Path2D();
  inner.moveTo(pxc - pw2, floorY + h * 0.004);
  inner.lineTo(pxc - pw2, archTop + pw2 * 0.7);
  inner.quadraticCurveTo(pxc - pw2 * 0.92, archTop, pxc, archTop);
  inner.quadraticCurveTo(pxc + pw2 * 0.92, archTop, pxc + pw2, archTop + pw2 * 0.7);
  inner.lineTo(pxc + pw2, floorY + h * 0.004);
  inner.closePath();
  const throat = ctx.createLinearGradient(0, archTop, 0, floorY);
  throat.addColorStop(0, shade(C.void, 0.3));
  throat.addColorStop(0.72, shade(C.void, 0.42));
  throat.addColorStop(1, shade(C.void, 0.6));
  ctx.fillStyle = throat;
  ctx.fill(inner);
  // steps descending away — dark risers, thin lit tread edges compressing
  // into the pitch (the "looking down the well" signature of these plates)
  ctx.save();
  ctx.clip(inner);
  let prevTy = floorY + h * 0.004;
  let treadDrop = h * 0.02;
  for (let i = 0; i < 5; i++) {
    const ty = prevTy - treadDrop;
    const tw = pw2 * (0.97 - i * 0.13);
    ctx.fillStyle = mix(C.void, C.verdigrisDim, Math.max(0.02, 0.11 - i * 0.022));
    ctx.fillRect(pxc - tw, ty, tw * 2, prevTy - ty);
    ctx.strokeStyle = shade(C.verdigris, 0.9, Math.max(0.05, 0.36 - i * 0.075));
    ctx.lineWidth = i < 2 ? Math.max(1.2, s * 0.0024) : Math.max(1, s * 0.0018);
    ctx.beginPath();
    ctx.moveTo(pxc - tw, ty);
    ctx.lineTo(pxc + tw, ty);
    ctx.stroke();
    ctx.strokeStyle = shade(C.void, 0.25, 0.6); // shadow tucked under the edge
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pxc - tw, ty + 1.2);
    ctx.lineTo(pxc + tw, ty + 1.2);
    ctx.stroke();
    prevTy = ty;
    treadDrop *= 0.78;
  }
  // a pair of eyes watching from the dark — the Vault looking back up
  const eyeX = pxc + pw2 * 0.2;
  const eyeY = archTop + (floorY - archTop) * 0.36;
  const eyeHalo = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, pw2 * 0.5);
  eyeHalo.addColorStop(0, shade(C.verdigrisDim, 0.9, 0.1));
  eyeHalo.addColorStop(1, shade(C.verdigrisDim, 0.9, 0));
  ctx.fillStyle = eyeHalo;
  ctx.fillRect(eyeX - pw2 * 0.5, eyeY - pw2 * 0.5, pw2, pw2);
  for (const sx of [-1, 1] as const) {
    ctx.fillStyle = mix(C.verdigris, C.verdigrisDim, 0.3, 0.5);
    ctx.beginPath();
    ctx.ellipse(eyeX + sx * pw2 * 0.085, eyeY + (sx < 0 ? pw2 * 0.012 : 0), pw2 * 0.034, pw2 * 0.021, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.verdigris, 1.35, 0.7);
    ctx.beginPath();
    ctx.arc(eyeX + sx * pw2 * 0.085 + pw2 * 0.006, eyeY - pw2 * 0.004, pw2 * 0.011, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0032);
  ctx.stroke(inner);
  // cool spill on the threshold slab in front
  ctx.save();
  ctx.translate(pxc, floorY + h * 0.012);
  ctx.scale(1, 0.3);
  const spill = ctx.createRadialGradient(0, 0, 0, 0, 0, pw2 * 1.5);
  spill.addColorStop(0, shade(C.verdigrisDim, 1.1, 0.08));
  spill.addColorStop(1, shade(C.verdigrisDim, 1, 0));
  ctx.fillStyle = spill;
  ctx.fillRect(-pw2 * 1.6, -pw2 * 1.6, pw2 * 3.2, pw2 * 3.2);
  ctx.restore();

  // ── 8. chalk workings — a trail of communal notes leading to the stair ─
  const chalk = (a: number): void => {
    ctx.strokeStyle = shade(C.parchment, 1.02, a);
    ctx.lineWidth = Math.max(1, s * 0.0032);
    ctx.lineCap = "round";
  };
  // tallies by the corpse — many counted, struck through
  ctx.save();
  ctx.translate(cx - sw * 2.7, floorY + h * 0.055);
  ctx.scale(1, 0.5);
  chalk(0.45);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(-sw * 0.7 + i * sw * 0.2, -sw * 0.2);
    ctx.lineTo(-sw * 0.78 + i * sw * 0.2, sw * 0.2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-sw * 0.9, sw * 0.1);
  ctx.lineTo(sw * 0.5, -sw * 0.15);
  ctx.stroke();
  ctx.restore();
  // a crossed-out route — the way that failed
  ctx.save();
  ctx.translate(cx + sw * 0.35, floorY + h * 0.052);
  ctx.scale(1, 0.5);
  chalk(0.4);
  ctx.beginPath();
  ctx.moveTo(-sw * 0.8, sw * 0.3);
  ctx.quadraticCurveTo(-sw * 0.1, -sw * 0.5, sw * 0.7, -sw * 0.1);
  ctx.stroke();
  chalk(0.5);
  ctx.beginPath();
  ctx.moveTo(sw * 0.35, -sw * 0.5);
  ctx.lineTo(sw * 1.0, sw * 0.25);
  ctx.moveTo(sw * 1.0, -sw * 0.5);
  ctx.lineTo(sw * 0.35, sw * 0.25);
  ctx.stroke();
  ctx.restore();
  // dashed trail arrowing into the descent
  ctx.save();
  ctx.scale(1, 1);
  chalk(0.48);
  const tx0 = w * 0.5;
  const ty0 = h * 0.685;
  const tx1 = pxc - pw2 * 0.4;
  const ty1 = floorY + h * 0.016;
  for (let i = 0; i < 5; i++) {
    const t0 = i / 5;
    const t1 = t0 + 0.55 / 5;
    ctx.beginPath();
    ctx.moveTo(tx0 + (tx1 - tx0) * t0, ty0 + (ty1 - ty0) * t0);
    ctx.lineTo(tx0 + (tx1 - tx0) * t1, ty0 + (ty1 - ty0) * t1);
    ctx.stroke();
  }
  // arrowhead at the threshold
  ctx.beginPath();
  ctx.moveTo(tx1 - sw * 0.28, ty1 + sw * 0.16);
  ctx.lineTo(tx1, ty1);
  ctx.lineTo(tx1 - sw * 0.3, ty1 - sw * 0.1);
  ctx.stroke();
  ctx.restore();
  // crude map fragment near the signpost — a box, a route, an X, a check
  ctx.save();
  ctx.translate(w * 0.585, h * 0.672);
  ctx.scale(1, 0.5);
  chalk(0.38);
  ctx.strokeRect(-sw * 0.65, -sw * 0.55, sw * 1.3, sw * 1.1);
  ctx.beginPath();
  ctx.moveTo(-sw * 0.5, sw * 0.35);
  ctx.quadraticCurveTo(-sw * 0.1, -sw * 0.15, sw * 0.2, sw * 0.05);
  ctx.lineTo(sw * 0.45, -sw * 0.3);
  ctx.stroke();
  chalk(0.46);
  ctx.beginPath();
  ctx.moveTo(sw * 0.32, -sw * 0.42);
  ctx.lineTo(sw * 0.58, -sw * 0.18);
  ctx.moveTo(sw * 0.58, -sw * 0.42);
  ctx.lineTo(sw * 0.32, -sw * 0.18);
  ctx.stroke();
  ctx.beginPath(); // a small check beside — someone survived this line
  ctx.moveTo(sw * 0.85, sw * 0.5);
  ctx.lineTo(sw * 0.98, sw * 0.7);
  ctx.lineTo(sw * 1.25, sw * 0.2);
  ctx.stroke();
  ctx.restore();
  // chalk chevron on the stair jamb, pointing down
  ctx.strokeStyle = shade(C.parchment, 1, 0.3);
  ctx.lineWidth = Math.max(1, s * 0.0028);
  ctx.beginPath();
  ctx.moveTo(pxc - pw2 * 1.11 - sw * 0.14, floorY - h * 0.085);
  ctx.lineTo(pxc - pw2 * 1.11, floorY - h * 0.07);
  ctx.lineTo(pxc - pw2 * 1.11 + sw * 0.14, floorY - h * 0.085);
  ctx.stroke();
  ctx.lineCap = "butt";

  // ── 9. cool light shaft from above onto the stone, with dust motes ─────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const shaftP = new Path2D();
  shaftP.moveTo(cx - sw * 1.3, 0);
  shaftP.lineTo(cx + sw * 2.1, 0);
  shaftP.lineTo(cx + sw * 2.9, floorY);
  shaftP.lineTo(cx - sw * 2.5, floorY);
  shaftP.closePath();
  const shaftG = ctx.createLinearGradient(0, 0, 0, floorY);
  shaftG.addColorStop(0, shade(C.verdigris, 0.75, 0.1));
  shaftG.addColorStop(0.7, shade(C.verdigrisDim, 0.95, 0.05));
  shaftG.addColorStop(1, shade(C.verdigrisDim, 1, 0));
  ctx.fillStyle = shaftG;
  ctx.fill(shaftP);
  // motes drifting in the shaft
  for (let i = 0; i < 26; i++) {
    const t = rand();
    const my = t * floorY;
    const halfw = sw * (1.5 + t * 1.1);
    const mx = cx + sw * 0.35 * (1 - t) + (rand() - 0.5) * 2 * halfw * 0.85;
    ctx.fillStyle = mix(C.bone, C.verdigris, 0.55, 0.06 + rand() * 0.15);
    ctx.beginPath();
    ctx.arc(mx, my, s * (0.0012 + rand() * 0.0016), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ── 10. the rune's pool of light on the floor ──────────────────────────
  ctx.save();
  ctx.translate(cx, floorY + h * 0.015);
  ctx.scale(1, 0.32);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.34);
  pool.addColorStop(0, shade(C.verdigris, 0.95, 0.15));
  pool.addColorStop(0.6, shade(C.verdigrisDim, 1, 0.07));
  pool.addColorStop(1, shade(C.verdigris, 1, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-s * 0.36, -s * 0.36, s * 0.72, s * 0.72);
  ctx.restore();

  // ── 11. THE WAYSTONE — page by page, the carved face of the town ───────
  ctx.save();
  ctx.translate(cx, baseY + h * 0.006);
  ctx.scale(1, 0.28);
  const cs = ctx.createRadialGradient(0, 0, 0, 0, 0, sw * 1.5);
  cs.addColorStop(0, shade(C.void, 0.55, 0.55));
  cs.addColorStop(1, shade(C.void, 0.55, 0));
  ctx.fillStyle = cs;
  ctx.fillRect(-sw * 1.6, -sw * 1.6, sw * 3.2, sw * 3.2);
  ctx.restore();
  const stone = new Path2D();
  stone.moveTo(cx, topY);
  stone.lineTo(cx + sw, shoulderY);
  stone.lineTo(cx + sw * 0.82, baseY);
  stone.lineTo(cx - sw * 0.82, baseY);
  stone.lineTo(cx - sw, shoulderY);
  stone.closePath();
  const stoneG = ctx.createLinearGradient(cx - sw, 0, cx + sw, 0);
  stoneG.addColorStop(0, shade(C.verdigrisDim, 0.7));
  stoneG.addColorStop(0.42, mix(C.verdigrisDim, C.verdigris, 0.5));
  stoneG.addColorStop(1, shade(C.verdigrisDim, 0.45));
  ctx.fillStyle = stoneG;
  ctx.fill(stone);
  ctx.save();
  ctx.clip(stone);
  // faint strata above the carved band only
  ctx.strokeStyle = shade(C.verdigrisDim, 0.5, 0.32);
  ctx.lineWidth = Math.max(1, sw * 0.02);
  for (let i = 0; i < 3; i++) {
    const y = shoulderY + ((bandTop - shoulderY) / 3) * i + rand() * sw * 0.08;
    ctx.beginPath();
    ctx.moveTo(cx - sw, y);
    ctx.quadraticCurveTo(cx, y + (rand() - 0.5) * sw * 0.1, cx + sw, y);
    ctx.stroke();
  }
  // rune halo inside the face
  const halo = ctx.createRadialGradient(cx, runeY, sw * 0.05, cx, runeY, sw * 1.1);
  halo.addColorStop(0, shade(C.verdigris, 1.2, 0.32));
  halo.addColorStop(1, shade(C.verdigris, 1, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - sw * 1.2, runeY - sw * 1.2, sw * 2.4, sw * 2.4);
  // ── the pages: rows of glyphs in visibly different ages ──
  const nRows = 8;
  const bandBot = baseY - sw * 0.16;
  ctx.lineCap = "round";
  for (let r = 0; r < nRows; r++) {
    const age = r / (nRows - 1); // 0 = cut this morning, 1 = older than memory
    const ry2 = bandTop + (bandBot - bandTop) * (r / (nRows - 1));
    const hw = faceHalf(ry2) * 0.78;
    const gsz = sw * (0.105 - age * 0.02);
    const step = gsz * 2.2;
    const fresh = r === 0;
    for (let gx = cx - hw; gx <= cx + hw; gx += step * (0.9 + rand() * 0.35)) {
      if (fresh && gx > chiselTip.x - gsz * 1.2) break; // today's line stops at the chisel
      if (!fresh && rand() < age * 0.38) continue; // weathering eats old marks
      const kind = Math.floor(rand() * 5);
      const jy = ry2 + (rand() - 0.5) * gsz * 0.5 * age;
      if (fresh) {
        ctx.strokeStyle = shade(C.verdigris, 1.25, 0.3); // glow understroke
        ctx.lineWidth = Math.max(2, gsz * 0.55);
        mark(gx, jy, gsz, kind);
        ctx.strokeStyle = shade(C.verdigris, 1.8, 0.95);
        ctx.lineWidth = Math.max(1, gsz * 0.22);
        mark(gx, jy, gsz, kind);
      } else if (r <= 2) {
        ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.2 + age * 0.4, 0.72 - age * 0.2);
        ctx.lineWidth = Math.max(0.9, gsz * 0.2);
        mark(gx, jy, gsz, kind);
      } else if (r <= 5) {
        ctx.strokeStyle = shade(C.verdigrisDim, 1.45, 0.52 - age * 0.18);
        ctx.lineWidth = Math.max(0.8, gsz * 0.18);
        mark(gx, jy, gsz, kind);
      } else {
        ctx.strokeStyle = mix(C.verdigrisDim, C.boneDim, 0.5, 0.42 - age * 0.2);
        ctx.lineWidth = Math.max(0.7, gsz * 0.16);
        mark(gx, jy, gsz, kind);
      }
    }
    // groove shadow under each of the newer lines — carved, not painted
    if (r <= 3) {
      ctx.strokeStyle = shade(C.void, 1.1, 0.2 - r * 0.04);
      ctx.lineWidth = Math.max(0.8, sw * 0.02);
      ctx.beginPath();
      ctx.moveTo(cx - hw, ry2 + gsz * 1.05);
      ctx.lineTo(cx + (fresh ? chiselTip.x - cx - gsz : hw), ry2 + gsz * 1.05);
      ctx.stroke();
    }
  }
  ctx.lineCap = "butt";
  // chipped edges
  ctx.fillStyle = shade(C.verdigrisDim, 0.38, 0.7);
  ctx.beginPath();
  ctx.moveTo(cx + sw * 0.92, shoulderY + (baseY - shoulderY) * 0.18);
  ctx.lineTo(cx + sw * 0.74, shoulderY + (baseY - shoulderY) * 0.23);
  ctx.lineTo(cx + sw * 0.9, shoulderY + (baseY - shoulderY) * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - sw * 0.88, shoulderY + (baseY - shoulderY) * 0.6);
  ctx.lineTo(cx - sw * 0.7, shoulderY + (baseY - shoulderY) * 0.65);
  ctx.lineTo(cx - sw * 0.84, shoulderY + (baseY - shoulderY) * 0.7);
  ctx.closePath();
  ctx.fill();
  // moss at the foot
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = mix(C.verdigrisDim, C.verdigris, rand() * 0.5, 0.45);
    ctx.beginPath();
    ctx.ellipse(cx - sw * 0.7 + rand() * sw * 1.4, baseY - rand() * sw * 0.2, sw * 0.13, sw * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // the master rune above the pages — dark groove offset, then glowing core
  const rune = (ox: number, oy: number, col: string, lw: number): void => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    const rr = sw * 0.44;
    ctx.beginPath();
    ctx.moveTo(cx + ox, runeY - rr + oy);
    ctx.lineTo(cx + ox, runeY + rr + oy);
    ctx.moveTo(cx - rr * 0.62 + ox, runeY - rr * 0.38 + oy);
    ctx.lineTo(cx + rr * 0.62 + ox, runeY - rr * 0.38 + oy);
    ctx.moveTo(cx - rr * 0.52 + ox, runeY + rr * 0.55 + oy);
    ctx.lineTo(cx + rr * 0.52 + ox, runeY + rr * 0.25 + oy);
    ctx.stroke();
  };
  const grooveOff = Math.max(1.2, sw * 0.035);
  rune(grooveOff, grooveOff, shade(C.void, 1.2, 0.7), Math.max(2, sw * 0.075));
  rune(0, 0, shade(C.verdigris, 1.4, 0.3), Math.max(3, sw * 0.13));
  rune(0, 0, shade(C.verdigris, 1.85), Math.max(1.6, sw * 0.055));
  ctx.lineCap = "butt";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0035);
  ctx.stroke(stone);
  // amber kiss on the stone's lower corners from the votives below
  ctx.save();
  ctx.clip(stone);
  ctx.globalCompositeOperation = "lighter";
  for (const [kx, ky] of [
    [cx - sw * 0.95, baseY + sw * 0.1],
    [cx + sw * 1.0, baseY + sw * 0.15],
  ] as const) {
    const warmK = ctx.createRadialGradient(kx, ky, 0, kx, ky, sw * 0.9);
    warmK.addColorStop(0, shade(C.ember, 0.65, 0.22));
    warmK.addColorStop(1, shade(C.ember, 0.65, 0));
    ctx.fillStyle = warmK;
    ctx.fillRect(kx - sw, ky - sw, sw * 2, sw * 2);
  }
  ctx.restore();

  // ── 12. ghost script rising off the crown — the pages ascending ────────
  const springs: Array<[number, number]> = [
    [cx, topY - sw * 0.1],
    [cx + sw * 0.55, shoulderY - sw * 0.15],
  ];
  for (let col = 0; col < springs.length; col++) {
    const [gx0, gy0] = springs[col]!;
    const nGlyphs = 5;
    const drift = (col === 0 ? -1 : 1) * sw * 0.5 + (rand() - 0.5) * sw * 0.3;
    const reach = h * (0.08 + rand() * 0.04);
    ctx.strokeStyle = shade(C.boneDim, 1.1, 0.11);
    ctx.lineWidth = Math.max(0.8, s * 0.002);
    ctx.beginPath();
    ctx.moveTo(gx0, gy0);
    ctx.bezierCurveTo(gx0 - sw * 0.4, gy0 - reach * 0.4, gx0 + drift + sw * 0.4, gy0 - reach * 0.7, gx0 + drift, gy0 - reach - h * 0.02);
    ctx.stroke();
    ctx.lineCap = "round";
    for (let i = 0; i < nGlyphs; i++) {
      const t = (i + 1) / (nGlyphs + 1);
      const sway = Math.sin(t * Math.PI * (2 + col * 0.5)) * sw * (0.25 + t * 0.4);
      const ggx = gx0 + drift * t + sway;
      const ggy = gy0 - t * reach - i * sw * 0.1;
      const ggs = Math.max(2.2, sw * (0.14 - t * 0.06) * (0.8 + rand() * 0.5));
      ctx.strokeStyle = mix(C.bone, C.verdigris, 0.42, 0.3 * (1 - t * 0.8));
      ctx.lineWidth = Math.max(0.8, ggs * 0.16);
      mark(ggx, ggy, ggs, Math.floor(rand() * 4));
    }
    ctx.lineCap = "butt";
  }

  // ── 13. death by death — the row of spent candle stubs at the base ─────
  const stubXs = [-0.95, -0.55, -0.18, 0.14, 0.44, 0.72, 0.98];
  for (let i = 0; i < stubXs.length; i++) {
    const bx = cx + stubXs[i]! * sw + (rand() - 0.5) * sw * 0.05;
    const by = baseY + h * 0.015 + rand() * h * 0.006;
    const bh = sw * (0.13 + rand() * 0.22);
    const bw2 = sw * 0.062;
    ctx.fillStyle = shade(C.bone, 0.62);
    ctx.beginPath();
    ctx.ellipse(bx, by, bw2 * 2.0, bw2 * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const bg = ctx.createLinearGradient(bx - bw2, 0, bx + bw2, 0);
    bg.addColorStop(0, shade(C.parchmentAged, 0.82));
    bg.addColorStop(1, shade(C.parchmentAged, 0.5));
    ctx.fillStyle = bg;
    ctx.fillRect(bx - bw2, by - bh, bw2 * 2, bh);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(0.7, sw * 0.016);
    ctx.strokeRect(bx - bw2, by - bh, bw2 * 2, bh);
    // drip of wax down one side
    ctx.strokeStyle = shade(C.parchmentAged, 0.95, 0.6);
    ctx.lineWidth = Math.max(0.8, sw * 0.02);
    ctx.beginPath();
    ctx.moveTo(bx - bw2 * 0.5, by - bh);
    ctx.lineTo(bx - bw2 * 0.5, by - bh * (0.3 + rand() * 0.4));
    ctx.stroke();
    // dead wick
    ctx.strokeStyle = shade(C.void, 1.5);
    ctx.lineWidth = Math.max(0.8, sw * 0.018);
    ctx.beginPath();
    ctx.moveTo(bx, by - bh);
    ctx.quadraticCurveTo(bx + bw2 * 0.4, by - bh - bw2 * 0.9, bx + bw2 * 0.15, by - bh - bw2 * 1.5);
    ctx.stroke();
    if (i === 2) {
      // one still smoking — the newest name on the stone
      ctx.strokeStyle = shade(C.boneDim, 1.25, 0.4);
      ctx.lineWidth = Math.max(1, sw * 0.024);
      ctx.beginPath();
      ctx.moveTo(bx + bw2 * 0.15, by - bh - bw2 * 1.6);
      ctx.bezierCurveTo(bx - sw * 0.09, by - bh - sw * 0.3, bx + sw * 0.1, by - bh - sw * 0.48, bx - sw * 0.03, by - bh - sw * 0.72);
      ctx.stroke();
    }
  }

  // ── 14. the reader — kneeling at the oldest lines, rim-lit by the rune ─
  const rdX = cx - sw * 1.42;
  const rdBase = baseY + h * 0.016;
  const rdH = sw * 1.35;
  const readerP = new Path2D();
  // tucked knees rise over a rounded back to a neck dip, then a small hood
  // bowed toward the stone — the dip is what makes the head read as a head
  readerP.moveTo(rdX + rdH * 0.34, rdBase);
  readerP.lineTo(rdX - rdH * 0.42, rdBase);
  readerP.bezierCurveTo(rdX - rdH * 0.54, rdBase - rdH * 0.26, rdX - rdH * 0.44, rdBase - rdH * 0.5, rdX - rdH * 0.26, rdBase - rdH * 0.6);
  readerP.quadraticCurveTo(rdX - rdH * 0.14, rdBase - rdH * 0.66, rdX - rdH * 0.08, rdBase - rdH * 0.63);
  readerP.quadraticCurveTo(rdX - rdH * 0.14, rdBase - rdH * 0.8, rdX + rdH * 0.03, rdBase - rdH * 0.86);
  readerP.quadraticCurveTo(rdX + rdH * 0.17, rdBase - rdH * 0.9, rdX + rdH * 0.22, rdBase - rdH * 0.76);
  readerP.quadraticCurveTo(rdX + rdH * 0.25, rdBase - rdH * 0.66, rdX + rdH * 0.18, rdBase - rdH * 0.58);
  readerP.bezierCurveTo(rdX + rdH * 0.3, rdBase - rdH * 0.4, rdX + rdH * 0.37, rdBase - rdH * 0.18, rdX + rdH * 0.34, rdBase);
  readerP.closePath();
  const rdG = ctx.createLinearGradient(rdX - rdH * 0.5, 0, rdX + rdH * 0.4, 0);
  rdG.addColorStop(0, shade(C.inkSoft, 0.5));
  rdG.addColorStop(1, mix(C.inkSoft, C.verdigrisDim, 0.62));
  ctx.fillStyle = rdG;
  ctx.fill(readerP);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0028);
  ctx.stroke(readerP);
  // cyan rim on the stone-facing contour
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.35, 0.55);
  ctx.lineWidth = Math.max(1, s * 0.0022);
  ctx.beginPath();
  ctx.moveTo(rdX + rdH * 0.18, rdBase - rdH * 0.58);
  ctx.bezierCurveTo(rdX + rdH * 0.3, rdBase - rdH * 0.4, rdX + rdH * 0.37, rdBase - rdH * 0.18, rdX + rdH * 0.34, rdBase);
  ctx.stroke();
  // shadowed face under the bowed hood — a soft crescent, not a hole
  ctx.fillStyle = shade(C.void, 1.1, 0.5);
  ctx.beginPath();
  ctx.ellipse(rdX + rdH * 0.13, rdBase - rdH * 0.7, rdH * 0.065, rdH * 0.095, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // cyan glint along the hood crown, separating them from the fallen behind
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.3, 0.5);
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(rdX + rdH * 0.03, rdBase - rdH * 0.86);
  ctx.quadraticCurveTo(rdX + rdH * 0.17, rdBase - rdH * 0.9, rdX + rdH * 0.22, rdBase - rdH * 0.76);
  ctx.stroke();
  // arm reaching out, hand tracing the near-invisible line
  ctx.strokeStyle = mix(C.inkSoft, C.verdigrisDim, 0.5);
  ctx.lineWidth = Math.max(2.5, sw * 0.1);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(rdX + rdH * 0.16, rdBase - rdH * 0.46);
  ctx.quadraticCurveTo(rdX + rdH * 0.5, rdBase - rdH * 0.44, cx - sw * 0.72, baseY - sw * 0.32);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = mix(C.bone, C.verdigris, 0.25, 0.9);
  ctx.beginPath();
  ctx.ellipse(cx - sw * 0.7, baseY - sw * 0.32, sw * 0.075, sw * 0.055, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // ── 15. midground losses — a cairn and a second shrouded bundle ────────
  // cairn, far left midground
  const cnX = w * 0.165;
  const cnY = floorY - h * 0.018;
  ctx.fillStyle = mix(C.void, C.surface2, 0.9);
  for (const [ox, oy, cr] of [
    [-0.42, 0, 0.42],
    [0.38, -0.04, 0.36],
    [0, -0.46, 0.32],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(cnX + ox * sw * 0.34, cnY + oy * sw * 0.34, cr * sw * 0.36, cr * sw * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // second bundle, right midground, on the path to the stair
  const b2x = w * 0.575;
  const b2y = floorY + h * 0.004;
  const b2w = sw * 0.95;
  ctx.fillStyle = shade(C.inkSoft, 0.42);
  ctx.beginPath();
  ctx.moveTo(b2x - b2w * 0.5, b2y);
  ctx.bezierCurveTo(b2x - b2w * 0.42, b2y - b2w * 0.34, b2x + b2w * 0.05, b2y - b2w * 0.44, b2x + b2w * 0.32, b2y - b2w * 0.28);
  ctx.bezierCurveTo(b2x + b2w * 0.52, b2y - b2w * 0.14, b2x + b2w * 0.45, b2y, b2x + b2w * 0.3, b2y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.8, 0.7);
  ctx.lineWidth = Math.max(1, s * 0.0022);
  ctx.stroke();
  // cool rim on its stone side, binding cord shadows
  ctx.strokeStyle = mix(C.inkSoft, C.verdigrisDim, 0.55, 0.5);
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(b2x - b2w * 0.42, b2y - b2w * 0.3);
  ctx.quadraticCurveTo(b2x - b2w * 0.1, b2y - b2w * 0.46, b2x + b2w * 0.28, b2y - b2w * 0.3);
  ctx.stroke();
  ctx.strokeStyle = shade(C.void, 1.1, 0.5);
  for (const bt of [0.12, 0.55]) {
    ctx.beginPath();
    ctx.moveTo(b2x - b2w * 0.5 + b2w * bt, b2y - b2w * 0.42);
    ctx.quadraticCurveTo(b2x - b2w * 0.45 + b2w * bt, b2y - b2w * 0.2, b2x - b2w * 0.48 + b2w * bt, b2y);
    ctx.stroke();
  }
  // its own dead stub beside it
  ctx.fillStyle = shade(C.parchmentAged, 0.55);
  ctx.fillRect(b2x + b2w * 0.5, b2y - sw * 0.09, sw * 0.06, sw * 0.09);

  // ── 16. the mourner — cupping a lit candle over the fallen ─────────────
  const cupX = cx - sw * 3.6;
  const cupBase = floorY - h * 0.002;
  const cupH = sw * 2.05;
  const cupP = new Path2D();
  cupP.moveTo(cupX - cupH * 0.2, cupBase);
  cupP.bezierCurveTo(cupX - cupH * 0.19, cupBase - cupH * 0.48, cupX - cupH * 0.15, cupBase - cupH * 0.7, cupX - cupH * 0.12, cupBase - cupH * 0.79);
  // hood: a distinct dome, dipped forward toward the fallen
  cupP.quadraticCurveTo(cupX - cupH * 0.13, cupBase - cupH * 0.96, cupX + cupH * 0.02, cupBase - cupH * 0.96);
  cupP.quadraticCurveTo(cupX + cupH * 0.14, cupBase - cupH * 0.94, cupX + cupH * 0.11, cupBase - cupH * 0.79);
  // shoulder, then the bulge of arms folded to the chest
  cupP.bezierCurveTo(cupX + cupH * 0.2, cupBase - cupH * 0.64, cupX + cupH * 0.24, cupBase - cupH * 0.4, cupX + cupH * 0.21, cupBase);
  cupP.closePath();
  ctx.fillStyle = mix(C.ink, C.void, 0.35);
  ctx.fill(cupP);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0028);
  ctx.stroke(cupP);
  // warm light blooming in the cupped hands, catching chest and hood rim
  const chX = cupX + cupH * 0.11;
  const chY = cupBase - cupH * 0.52;
  ctx.save();
  ctx.clip(cupP);
  const chestG = ctx.createRadialGradient(chX, chY, 0, chX, chY, cupH * 0.5);
  chestG.addColorStop(0, shade(C.flame, 0.85, 0.4));
  chestG.addColorStop(0.55, shade(C.ember, 0.8, 0.16));
  chestG.addColorStop(1, shade(C.ember, 0.8, 0));
  ctx.fillStyle = chestG;
  ctx.fillRect(cupX - cupH, cupBase - cupH * 1.1, cupH * 2, cupH * 1.2);
  // underlit chin inside the hood, and the hood's shadow line above it
  ctx.fillStyle = mix(C.ember, C.flame, 0.45, 0.4);
  ctx.beginPath();
  ctx.ellipse(cupX + cupH * 0.045, cupBase - cupH * 0.8, cupH * 0.055, cupH * 0.035, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 1.1, 0.6);
  ctx.lineWidth = Math.max(1, s * 0.0026);
  ctx.beginPath();
  ctx.moveTo(cupX - cupH * 0.1, cupBase - cupH * 0.84);
  ctx.quadraticCurveTo(cupX + cupH * 0.02, cupBase - cupH * 0.88, cupX + cupH * 0.1, cupBase - cupH * 0.82);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cupHalo = ctx.createRadialGradient(chX, chY, 0, chX, chY, cupH * 0.34);
  cupHalo.addColorStop(0, shade(C.flame, 0.7, 0.28));
  cupHalo.addColorStop(1, shade(C.flame, 0.7, 0));
  ctx.fillStyle = cupHalo;
  ctx.fillRect(chX - cupH * 0.4, chY - cupH * 0.4, cupH * 0.8, cupH * 0.8);
  ctx.restore();
  // the small candle they shelter, hands cupped around its base
  const cdlG = ctx.createLinearGradient(chX - cupH * 0.022, 0, chX + cupH * 0.022, 0);
  cdlG.addColorStop(0, shade(C.parchment, 0.9));
  cdlG.addColorStop(1, shade(C.parchmentAged, 0.6));
  ctx.fillStyle = cdlG;
  ctx.fillRect(chX - cupH * 0.022, chY - cupH * 0.05, cupH * 0.044, cupH * 0.1);
  ctx.fillStyle = mix(C.bone, C.flame, 0.35);
  ctx.beginPath();
  ctx.ellipse(chX - cupH * 0.05, chY + cupH * 0.045, cupH * 0.07, cupH * 0.045, -0.3, 0, Math.PI * 2);
  ctx.ellipse(chX + cupH * 0.06, chY + cupH * 0.05, cupH * 0.07, cupH * 0.045, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(C.ember, C.flame, 0.6);
  ctx.beginPath();
  ctx.ellipse(chX, chY - cupH * 0.095, cupH * 0.028, cupH * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.flameHi;
  ctx.beginPath();
  ctx.ellipse(chX, chY - cupH * 0.085, cupH * 0.013, cupH * 0.028, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 17. the fallen — shrouded at the mourner's feet, spent candle ──────
  const dw = sw * 1.55;
  const dx = cx - sw * 3.35; // left edge of the heap
  const dy = baseY + h * 0.018;
  const dh = sw * 0.8;
  const heap = new Path2D();
  heap.moveTo(dx, dy);
  heap.bezierCurveTo(dx + dw * 0.05, dy - dh * 0.45, dx + dw * 0.3, dy - dh * 0.6, dx + dw * 0.52, dy - dh * 0.62);
  heap.bezierCurveTo(dx + dw * 0.72, dy - dh * 1.05, dx + dw * 0.95, dy - dh * 0.95, dx + dw, dy - dh * 0.5);
  heap.bezierCurveTo(dx + dw * 1.02, dy - dh * 0.2, dx + dw * 0.95, dy, dx + dw * 0.8, dy);
  heap.bezierCurveTo(dx + dw * 0.5, dy + dh * 0.06, dx + dw * 0.15, dy + dh * 0.06, dx, dy);
  heap.closePath();
  const heapG = ctx.createLinearGradient(dx, 0, dx + dw, 0);
  heapG.addColorStop(0, mix(C.inkSoft, C.ember, 0.28, 1)); // warm-kissed by the vigil candle
  heapG.addColorStop(0.5, shade(C.inkSoft, 0.8));
  heapG.addColorStop(1, mix(C.inkSoft, C.verdigrisDim, 0.55)); // stone-lit rim
  ctx.fillStyle = heapG;
  ctx.fill(heap);
  ctx.save();
  ctx.clip(heap);
  ctx.strokeStyle = shade(C.void, 1.2, 0.55);
  ctx.lineWidth = Math.max(1, sw * 0.03);
  for (const fx of [0.28, 0.5, 0.68]) {
    ctx.beginPath();
    ctx.moveTo(dx + dw * fx, dy - dh * 0.55);
    ctx.quadraticCurveTo(dx + dw * (fx + 0.06), dy - dh * 0.25, dx + dw * (fx + 0.02), dy);
    ctx.stroke();
  }
  ctx.fillStyle = shade(C.void, 1.0, 0.55);
  ctx.beginPath();
  ctx.ellipse(dx + dw * 0.86, dy - dh * 0.66, dw * 0.07, dh * 0.11, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.003);
  ctx.stroke(heap);
  // the pale hand, slipped from the cloak toward the tallies
  ctx.fillStyle = mix(C.bone, C.void, 0.25);
  ctx.beginPath();
  ctx.ellipse(dx + dw * 0.02, dy + dh * 0.05, dw * 0.08, dh * 0.05, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // their spent candle: pooled wax, dead wick, one last thread of smoke
  const spx = dx - dw * 0.16;
  const spy = dy + dh * 0.02;
  ctx.fillStyle = shade(C.bone, 0.8);
  ctx.beginPath();
  ctx.ellipse(spx, spy, sw * 0.15, sw * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();
  const spg = ctx.createLinearGradient(spx - sw * 0.055, 0, spx + sw * 0.055, 0);
  spg.addColorStop(0, shade(C.parchmentAged, 0.95));
  spg.addColorStop(1, shade(C.parchmentAged, 0.6));
  ctx.fillStyle = spg;
  ctx.fillRect(spx - sw * 0.055, spy - sw * 0.22, sw * 0.11, sw * 0.22);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(0.7, sw * 0.02);
  ctx.strokeRect(spx - sw * 0.055, spy - sw * 0.22, sw * 0.11, sw * 0.22);
  ctx.strokeStyle = shade(C.void, 1.5);
  ctx.beginPath();
  ctx.moveTo(spx, spy - sw * 0.22);
  ctx.quadraticCurveTo(spx + sw * 0.02, spy - sw * 0.27, spx + sw * 0.01, spy - sw * 0.3);
  ctx.stroke();
  ctx.strokeStyle = shade(C.boneDim, 1.1, 0.3);
  ctx.lineWidth = Math.max(0.8, sw * 0.02);
  ctx.beginPath();
  ctx.moveTo(spx + sw * 0.01, spy - sw * 0.31);
  ctx.bezierCurveTo(spx - sw * 0.05, spy - sw * 0.44, spx + sw * 0.06, spy - sw * 0.55, spx - sw * 0.02, spy - sw * 0.7);
  ctx.stroke();

  // ── 18. lit votives — the warm counterpoint, small against the green ───
  const votive = (vx: number, vy: number, vh: number): void => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const wg = ctx.createRadialGradient(vx, vy - vh, 0, vx, vy - vh, vh * 3.2);
    wg.addColorStop(0, shade(C.flame, 0.9, 0.2));
    wg.addColorStop(1, shade(C.flame, 0.9, 0));
    ctx.fillStyle = wg;
    ctx.fillRect(vx - vh * 3.4, vy - vh * 4.6, vh * 6.8, vh * 6.8);
    ctx.translate(vx, vy + vh * 0.3);
    ctx.scale(1, 0.3);
    const wp = ctx.createRadialGradient(0, 0, 0, 0, 0, vh * 3.4);
    wp.addColorStop(0, shade(C.ember, 0.7, 0.16));
    wp.addColorStop(1, shade(C.ember, 0.7, 0));
    ctx.fillStyle = wp;
    ctx.fillRect(-vh * 3.5, -vh * 3.5, vh * 7, vh * 7);
    ctx.restore();
    ctx.fillStyle = shade(C.bone, 0.75);
    ctx.beginPath();
    ctx.ellipse(vx, vy, vh * 0.7, vh * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    const vg = ctx.createLinearGradient(vx - vh * 0.3, 0, vx + vh * 0.3, 0);
    vg.addColorStop(0, shade(C.parchment, 0.92));
    vg.addColorStop(1, shade(C.parchmentAged, 0.62));
    ctx.fillStyle = vg;
    ctx.fillRect(vx - vh * 0.28, vy - vh, vh * 0.56, vh);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(0.7, vh * 0.09);
    ctx.strokeRect(vx - vh * 0.28, vy - vh, vh * 0.56, vh);
    ctx.fillStyle = mix(C.ember, C.flame, 0.6);
    ctx.beginPath();
    ctx.ellipse(vx, vy - vh * 1.32, vh * 0.22, vh * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.flameHi;
    ctx.beginPath();
    ctx.ellipse(vx, vy - vh * 1.24, vh * 0.1, vh * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  votive(cx - sw * 2.05, baseY + h * 0.026, sw * 0.3);
  votive(cx + sw * 1.78, baseY + h * 0.03, sw * 0.32);

  // ── 19. the carver — mid-strike on today's line, lit from both hues ────
  const kvX = cx + sw * 1.52;
  const kvGround = floorY + h * 0.012;
  // the stepping slab they stand on to reach the fresh line
  const blkW = sw * 0.85;
  const blkH = sw * 0.26;
  ctx.fillStyle = mix(C.void, C.surface2, 1.35);
  ctx.fillRect(kvX - blkW / 2, kvGround - blkH, blkW, blkH * 0.45);
  ctx.fillStyle = mix(C.void, C.surface2, 0.75);
  ctx.fillRect(kvX - blkW / 2, kvGround - blkH * 0.55, blkW, blkH * 0.55);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0026);
  ctx.strokeRect(kvX - blkW / 2, kvGround - blkH, blkW, blkH);
  const kvY = kvGround - blkH; // feet
  const kvH = sw * 2.25;
  // lean profile silhouette, leaning into the work
  const carverP = new Path2D();
  carverP.moveTo(kvX - sw * 0.28, kvY);
  carverP.bezierCurveTo(kvX - sw * 0.26, kvY - kvH * 0.35, kvX - sw * 0.36, kvY - kvH * 0.52, kvX - sw * 0.33, kvY - kvH * 0.66);
  carverP.quadraticCurveTo(kvX - sw * 0.4, kvY - kvH * 0.84, kvX - sw * 0.27, kvY - kvH * 0.92);
  carverP.quadraticCurveTo(kvX - sw * 0.14, kvY - kvH * 1.0, kvX + sw * 0.06, kvY - kvH * 0.93);
  carverP.quadraticCurveTo(kvX + sw * 0.17, kvY - kvH * 0.87, kvX + sw * 0.12, kvY - kvH * 0.73);
  carverP.bezierCurveTo(kvX + sw * 0.25, kvY - kvH * 0.48, kvX + sw * 0.31, kvY - kvH * 0.24, kvX + sw * 0.29, kvY);
  carverP.closePath();
  const kvG = ctx.createLinearGradient(kvX - sw * 0.4, 0, kvX + sw * 0.32, 0);
  kvG.addColorStop(0, mix(C.inkSoft, C.verdigrisDim, 0.6)); // rune-lit front
  kvG.addColorStop(0.55, mix(C.ink, C.void, 0.25));
  kvG.addColorStop(1, mix(C.ink, C.ember, 0.28)); // votive warmth at the back
  ctx.fillStyle = kvG;
  ctx.fill(carverP);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0028);
  ctx.stroke(carverP);
  // cyan rim on the stone side
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.3, 0.55);
  ctx.lineWidth = Math.max(1, s * 0.0024);
  ctx.beginPath();
  ctx.moveTo(kvX - sw * 0.28, kvY);
  ctx.bezierCurveTo(kvX - sw * 0.26, kvY - kvH * 0.35, kvX - sw * 0.36, kvY - kvH * 0.52, kvX - sw * 0.33, kvY - kvH * 0.66);
  ctx.stroke();
  // shadowed face turned to the work
  ctx.fillStyle = shade(C.void, 1.0, 0.55);
  ctx.beginPath();
  ctx.ellipse(kvX - sw * 0.2, kvY - kvH * 0.86, sw * 0.07, sw * 0.09, -0.35, 0, Math.PI * 2);
  ctx.fill();
  // front arm — one full sleeve-stroke from shoulder to the chisel hand
  const hndX = chiselTip.x + sw * 0.26;
  const hndY = chiselTip.y + sw * 0.18;
  ctx.strokeStyle = mix(C.inkSoft, C.verdigrisDim, 0.5);
  ctx.lineWidth = Math.max(3, sw * 0.13);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(kvX - sw * 0.14, kvY - kvH * 0.74);
  ctx.quadraticCurveTo(kvX - sw * 0.62, kvY - kvH * 0.86, hndX, hndY);
  ctx.stroke();
  ctx.lineCap = "butt";
  // hand on the chisel
  ctx.fillStyle = mix(C.bone, C.verdigris, 0.3, 0.95);
  ctx.beginPath();
  ctx.ellipse(hndX, hndY, sw * 0.07, sw * 0.055, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // the chisel itself, tip on the fresh line
  ctx.strokeStyle = shade(C.boneDim, 0.9);
  ctx.lineWidth = Math.max(2, sw * 0.055);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hndX - sw * 0.02, hndY - sw * 0.02);
  ctx.lineTo(chiselTip.x, chiselTip.y);
  ctx.stroke();
  ctx.lineCap = "butt";
  // back arm raised with the mallet, mid-swing
  ctx.strokeStyle = mix(C.ink, C.void, 0.2);
  ctx.lineWidth = Math.max(2.5, sw * 0.11);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(kvX + sw * 0.02, kvY - kvH * 0.72);
  ctx.quadraticCurveTo(kvX + sw * 0.26, kvY - kvH * 0.92, kvX + sw * 0.32, kvY - kvH * 1.04);
  ctx.stroke();
  ctx.lineCap = "butt";
  const mlX = kvX + sw * 0.32;
  const mlY = kvY - kvH * 1.04;
  ctx.save();
  ctx.translate(mlX, mlY);
  ctx.rotate(-0.6);
  ctx.fillStyle = shade(C.inkSoft, 0.85);
  ctx.fillRect(-sw * 0.14, -sw * 0.22, sw * 0.28, sw * 0.22);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(0.8, sw * 0.02);
  ctx.strokeRect(-sw * 0.14, -sw * 0.22, sw * 0.28, sw * 0.22);
  ctx.strokeStyle = shade(C.boneDim, 0.7);
  ctx.lineWidth = Math.max(1.5, sw * 0.04);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(sw * 0.05, sw * 0.2);
  ctx.stroke();
  ctx.restore();
  // strike flecks — bright chips flying off today's line
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const fa = -0.4 - rand() * 1.8;
    const fr = sw * (0.1 + rand() * 0.3);
    ctx.fillStyle = shade(C.verdigris, 1.6 + rand() * 0.4, 0.45 + rand() * 0.4);
    ctx.beginPath();
    ctx.arc(chiselTip.x + Math.cos(fa) * fr, chiselTip.y + Math.sin(fa) * fr, s * (0.001 + rand() * 0.0014), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // two stone chips falling
  ctx.fillStyle = shade(C.bone, 0.85, 0.55);
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.arc(chiselTip.x - sw * (0.05 + rand() * 0.1), chiselTip.y + sw * (0.3 + rand() * 0.4), s * 0.0013, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 20. the planted sign — arrow plank pointing into the descent ───────
  const px = w * 0.645;
  const py = floorY + h * 0.022;
  const postH = Math.max(h * 0.085, sw * 1.0);
  const postW = Math.max(3, sw * 0.1);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(0.05);
  const postG = ctx.createLinearGradient(-postW / 2, 0, postW / 2, 0);
  postG.addColorStop(0, shade(C.ink, 0.85));
  postG.addColorStop(1, shade(C.inkSoft, 0.9));
  ctx.fillStyle = postG;
  ctx.fillRect(-postW / 2, -postH, postW, postH);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0028);
  ctx.strokeRect(-postW / 2, -postH, postW, postH);
  // arrow plank — its point aimed at the stair mouth
  const plw = sw * 1.5;
  const plh = sw * 0.48;
  const ply = -postH + plh * 0.1;
  const tip = plh * 0.62;
  const plank = new Path2D();
  plank.moveTo(-plw / 2, ply);
  plank.lineTo(plw / 2 - tip, ply);
  plank.lineTo(plw / 2, ply + plh / 2);
  plank.lineTo(plw / 2 - tip, ply + plh);
  plank.lineTo(-plw / 2, ply + plh);
  plank.closePath();
  const plg = ctx.createLinearGradient(0, ply, 0, ply + plh);
  plg.addColorStop(0, shade(C.inkSoft, 1.05));
  plg.addColorStop(1, shade(C.inkSoft, 0.62));
  ctx.fillStyle = plg;
  ctx.fill(plank);
  ctx.strokeStyle = shade(C.void, 1.2, 0.45);
  ctx.lineWidth = Math.max(0.7, sw * 0.02);
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-plw / 2 + 2, ply + (plh / 3) * i + (rand() - 0.5) * 2);
    ctx.quadraticCurveTo(0, ply + (plh / 3) * i + (rand() - 0.5) * 3, plw / 2 - tip, ply + (plh / 3) * i);
    ctx.stroke();
  }
  // scratched warning, unreadable at this distance
  ctx.strokeStyle = shade(C.parchmentAged, 0.9, 0.55);
  ctx.lineWidth = Math.max(0.8, sw * 0.026);
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const mx = -plw * 0.4 + ((plw * 0.62) / 4) * i + rand() * plw * 0.04;
    const my = ply + plh * (0.3 + rand() * 0.35);
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + plw * (0.06 + rand() * 0.05), my + (rand() - 0.5) * plh * 0.2);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.strokeStyle = INK;
  ctx.stroke(plank);
  ctx.restore();
  // pebbles bracing the post
  ctx.fillStyle = mix(C.void, C.surface2, 0.85);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(px - postW + i * postW * 1.1, py + 1, postW * 0.5, postW * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 21. near flank pillars — fog stop 3, darkest cutouts ───────────────
  ctx.fillStyle = shade(C.void, 0.55);
  ctx.fillRect(0, 0, w * 0.105, h);
  ctx.fillRect(w * 0.895, 0, w * 0.105, h);
  for (const fpx of [w * 0.105, w * 0.895]) {
    const dir = fpx < w / 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(fpx, h * 0.24);
    ctx.lineTo(fpx + dir * w * 0.028, h * 0.26);
    ctx.lineTo(fpx + dir * w * 0.028, h * 0.29);
    ctx.lineTo(fpx, h * 0.31);
    ctx.closePath();
    ctx.fill();
  }

  // ── 22. cavern ceiling — stalactites and hanging roots frame the top ───
  for (let i = 0; i < 9; i++) {
    const tx = ((i + 0.5) / 9) * w + (rand() - 0.5) * w * 0.05;
    const len = h * (0.035 + rand() * 0.08);
    const wd = w * (0.012 + rand() * 0.017);
    ctx.fillStyle = shade(C.void, 0.55);
    ctx.beginPath();
    ctx.moveTo(tx - wd, 0);
    ctx.quadraticCurveTo(tx - wd * 0.2, len * 0.55, tx, len);
    ctx.quadraticCurveTo(tx + wd * 0.2, len * 0.5, tx + wd, 0);
    ctx.closePath();
    ctx.fill();
    // faint verdigris catch on the shaft-facing edge
    if (Math.abs(tx - cx) < w * 0.2) {
      ctx.strokeStyle = shade(C.verdigrisDim, 1.2, 0.18);
      ctx.lineWidth = Math.max(1, s * 0.002);
      ctx.beginPath();
      ctx.moveTo(tx + wd * 0.5, len * 0.3);
      ctx.quadraticCurveTo(tx + wd * 0.15, len * 0.6, tx, len * 0.96);
      ctx.stroke();
    }
  }
  // two thin roots, swaying
  ctx.strokeStyle = mix(C.void, C.inkSoft, 0.55, 0.9);
  ctx.lineWidth = Math.max(1, s * 0.0032);
  for (const rx of [0.3, 0.77]) {
    const rx0 = rx * w + (rand() - 0.5) * w * 0.02;
    const rl = h * (0.1 + rand() * 0.07);
    ctx.beginPath();
    ctx.moveTo(rx0, 0);
    ctx.bezierCurveTo(rx0 + w * 0.012, rl * 0.35, rx0 - w * 0.014, rl * 0.65, rx0 + w * 0.006, rl);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rx0 - w * 0.004, rl * 0.55);
    ctx.quadraticCurveTo(rx0 - w * 0.016, rl * 0.7, rx0 - w * 0.014, rl * 0.82);
    ctx.stroke();
  }

  // ── 23. top crush and the calm dark floor for the caption ──────────────
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.15);
  crush.addColorStop(0, shade(C.void, 0.7, 0.75));
  crush.addColorStop(1, shade(C.void, 0.7, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.15);
  const settle = ctx.createLinearGradient(0, h * 0.72, 0, h);
  settle.addColorStop(0, shade(C.void, 0.75, 0));
  settle.addColorStop(1, shade(C.void, 0.75, 0.85));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  // ── 24. corner vignettes — close the folio ─────────────────────────────
  const vr = Math.min(w, h) * 0.55;
  for (const [vx, vy] of [[0, 0], [w, 0], [0, h], [w, h]] as const) {
    const vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    vg.addColorStop(0, shade(C.void, 0.5, 0.45));
    vg.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}
