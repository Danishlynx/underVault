/**
 * Meeting plate 4 — "What She Kept." The epilogue, and the lightest image
 * in the whole game. The First Flame stands TALL, fed — the warmest,
 * farthest-reaching light of any plate; the chamber is genuinely lifted,
 * its shadows soft instead of hard. SHE HAS PUT HER HOOD DOWN — the first
 * time it is ever seen: grey-streaked hair, the long braid singed at the
 * tip over one shoulder. She sits (not kneels) beside the flame, shoulders
 * finally loose; eyes half-closed, wax-dried tear tracks glinting warm,
 * and an almost-smile — relief the size of twenty years, never melodrama.
 * The translucent hands rest open in her lap, done holding. Behind her the
 * stairs UP are clearly visible for the first time, their lowest steps
 * warmly lit — an open invitation. The verdigris glyphs on the far walls
 * are DIMMING — the Vault calming, not threatening — and her shadow
 * finally, faintly, falls away from the light like everyone else's.
 * Two-hue law holds, but warm dominates for once. Caller has DPR-scaled
 * and cleared; the bottom ~18% stays calm and dark — this caption is the
 * longest in the game.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall pattern, own seed) — never Math.random, never
// paint.ts crand (that stream belongs to the world-texture painters).
function slideRand(seed: number): () => number {
  let s = seed >>> 0 || 0xa7e4f1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintMeeting4(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = slideRand(0xa7e4f1);
  const s = Math.min(w, h);
  const INK = shade(C.void, 0.7, 0.9);

  // ── geometry ─────────────────────────────────────────────────────────────
  const cx = w * 0.5;
  const floorY = h * 0.645;
  const flx = cx - s * 0.19; // flame axis — she gets the other half
  const daisY = floorY + s * 0.018;
  const stubW = s * 0.033;
  const stubH = s * 0.058;
  const stubTop = daisY - stubH;
  const flameH = s * 0.205; // the tallest the game will ever show it
  const flameCy = stubTop - flameH * 0.55;
  const sH = s * 0.375; // her seated scale (crown height above the base)
  const mX = cx + s * 0.07; // her torso axis
  const baseM = floorY + s * 0.034; // she sits a step nearer than the dais
  const hdX = mX + sH * 0.005; // head center
  const hdY = baseM - sH * 0.795;
  const hr = sH * 0.128; // head radius
  // the stairs up — behind her, finally lit enough to be believed
  const sx0 = cx + s * 0.225;
  const sy0 = floorY - s * 0.025;
  const stepN = 8;
  const run = s * 0.026;
  const rise = s * 0.036;

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

  // ── 1. base void — but lifted; the dark has lost its argument ───────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, mix(C.void, C.surface, 0.58));
  base.addColorStop(0.4, mix(C.void, C.surface2, 0.72));
  base.addColorStop(0.66, mix(C.void, C.surface2, 0.6));
  base.addColorStop(0.85, mix(C.void, C.surface, 0.5));
  base.addColorStop(1, mix(C.void, C.surface, 0.3));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // the fed flame's ambience — the farthest-reaching light of any plate,
  // laid over the whole chamber before anything else stands in it
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const amb = ctx.createRadialGradient(flx, flameCy, 0, flx, flameCy, s * 1.18);
  amb.addColorStop(0, shade(C.ember, 0.9, 0.22));
  amb.addColorStop(0.45, shade(C.ember, 0.8, 0.1));
  amb.addColorStop(1, shade(C.ember, 0.8, 0.015));
  ctx.fillStyle = amb;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // ── 2. the knowledge-light, dimming — the Vault calming, not threatening ─
  for (const [kx, ky] of [
    [w * 0.13, h * 0.36],
    [w * 0.88, h * 0.34],
  ] as const) {
    const pool = ctx.createRadialGradient(kx, ky, 0, kx, ky, s * 0.38);
    pool.addColorStop(0, shade(C.verdigrisDim, 1.15, 0.085));
    pool.addColorStop(0.6, shade(C.verdigrisDim, 1, 0.04));
    pool.addColorStop(1, shade(C.verdigrisDim, 1, 0));
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, w, h);
  }
  // glyph rows going quiet — more of them worn away than lit, and what
  // remains barely holds its color against the warmth
  ctx.lineCap = "round";
  for (let r = 0; r < 6; r++) {
    const ry = h * 0.19 + (floorY - s * 0.06 - h * 0.19) * (r / 5);
    const gs = s * 0.011;
    for (let gx = w * 0.045; gx < w * 0.955; gx += gs * 2.6 * (0.9 + rand() * 0.4)) {
      if (Math.abs(gx - flx) < s * (0.15 + rand() * 0.06)) continue; // the flame owns its column
      if (rand() < 0.46) continue; // more weathering than plate three ever showed
      const dl = Math.min(Math.hypot(gx - w * 0.13, ry - h * 0.36), Math.hypot(gx - w * 0.88, ry - h * 0.34));
      const a = Math.max(0.03, 0.14 - (dl / s) * 0.16);
      ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.62, a);
      ctx.lineWidth = Math.max(0.8, gs * 0.22);
      mark(gx, ry + (rand() - 0.5) * gs, gs * (0.8 + rand() * 0.4), Math.floor(rand() * 5));
    }
  }
  ctx.lineCap = "butt";
  // flanking pillars — the near one warm-kissed for the first time
  for (const [px, warm] of [
    [w * 0.075, 0.4],
    [w * 0.925, 0.16],
  ] as const) {
    const colW = Math.max(w * 0.032, s * 0.03);
    ctx.fillStyle = mix(C.void, C.surface, 0.7);
    ctx.fillRect(px - colW / 2, h * 0.07, colW, floorY - h * 0.07 + s * 0.015);
    ctx.beginPath(); // capital wedge
    ctx.moveTo(px - colW * 0.75, h * 0.125);
    ctx.lineTo(px + colW * 0.75, h * 0.125);
    ctx.lineTo(px + colW * 0.52, h * 0.155);
    ctx.lineTo(px - colW * 0.52, h * 0.155);
    ctx.closePath();
    ctx.fill();
    // firelight finds the flame-facing flute — stone learning to be warm
    const fluteX = px > flx ? px - colW * 0.5 : px + colW * 0.5;
    ctx.strokeStyle = mix(C.ember, C.flame, 0.4, warm);
    ctx.lineWidth = 1;
    line(fluteX, h * 0.16, fluteX, floorY);
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const gy = h * 0.22 + i * s * 0.062;
      if (gy > floorY - s * 0.06) break;
      ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.6, 0.07 + rand() * 0.05);
      ctx.lineWidth = 1;
      mark(px, gy, s * 0.011, Math.floor(rand() * 5));
    }
    ctx.lineCap = "butt";
  }

  // ── 3. the stairs UP — clearly visible at last, the lowest steps lit ────
  {
    // mass under the flight, grounded all the way to the floor
    ctx.fillStyle = shade(C.void, 0.75, 0.5);
    ctx.beginPath();
    ctx.moveTo(sx0 - s * 0.014, floorY + s * 0.006);
    ctx.lineTo(sx0 - s * 0.014, sy0 + s * 0.002);
    ctx.lineTo(sx0 + run * stepN + s * 0.02, sy0 - rise * stepN + s * 0.012);
    ctx.lineTo(sx0 + run * stepN + s * 0.02, floorY + s * 0.006);
    ctx.closePath();
    ctx.fill();
    // a breath of somewhere-above inside the arch — not void, for once
    const archX = sx0 + run * stepN + s * 0.012;
    const archY = sy0 - rise * stepN + s * 0.002;
    const above = ctx.createRadialGradient(archX, archY - s * 0.02, 0, archX, archY - s * 0.02, s * 0.055);
    above.addColorStop(0, mix(C.bone, C.flame, 0.3, 0.07));
    above.addColorStop(1, mix(C.bone, C.flame, 0.3, 0));
    ctx.fillStyle = above;
    ctx.fillRect(archX - s * 0.06, archY - s * 0.08, s * 0.12, s * 0.12);
    // the flight — one stepped zigzag, drawn with a surer hand than before
    ctx.strokeStyle = mix(C.void, C.boneDim, 0.6, 0.42);
    ctx.lineWidth = Math.max(1.2, s * 0.0018);
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    for (let i = 0; i < stepN; i++) {
      ctx.lineTo(sx0 + run * (i + 1), sy0 - rise * i); // tread
      ctx.lineTo(sx0 + run * (i + 1), sy0 - rise * (i + 1)); // riser
    }
    ctx.stroke();
    for (let i = 1; i < stepN; i++) {
      // tread returns — depth on each step, fading as it climbs
      ctx.strokeStyle = mix(C.void, C.boneDim, 0.5, 0.2 - i * 0.016);
      ctx.lineWidth = 1;
      line(sx0 + run * i, sy0 - rise * i, sx0 + run * i - s * 0.015, sy0 - rise * i + s * 0.007);
    }
    // firelight on the lowest treads — the invitation, plainly worded
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = mix(C.flame, C.ember, 0.3, 0.6 - i * 0.13);
      ctx.lineWidth = Math.max(1.2, s * 0.0022);
      line(sx0 + run * i + s * 0.003, sy0 - rise * i, sx0 + run * (i + 1), sy0 - rise * i);
      ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.2 - i * 0.045); // riser catch
      ctx.lineWidth = 1;
      line(sx0 + run * (i + 1), sy0 - rise * i, sx0 + run * (i + 1), sy0 - rise * (i + 1));
    }
    ctx.save(); // warmth pooling at the flight's foot
    ctx.globalCompositeOperation = "lighter";
    const foot = ctx.createRadialGradient(sx0 + run, sy0, 0, sx0 + run, sy0, s * 0.15);
    foot.addColorStop(0, shade(C.ember, 0.85, 0.17));
    foot.addColorStop(1, shade(C.ember, 0.85, 0));
    ctx.fillStyle = foot;
    ctx.fillRect(sx0 - s * 0.13, sy0 - s * 0.15, s * 0.32, s * 0.19);
    ctx.restore();
    // the mouth at the top — an arch you could simply walk into
    ctx.strokeStyle = mix(C.void, C.bone, 0.42, 0.4);
    ctx.lineWidth = Math.max(1, s * 0.0016);
    ctx.beginPath();
    ctx.arc(archX, archY, s * 0.047, Math.PI * 0.98, Math.PI * 1.92);
    ctx.stroke();
  }

  // ── 4. the melted monument — centuries of mother-wax, warm to the crest ─
  const mon = new Path2D();
  mon.moveTo(flx - s * 0.27, floorY + s * 0.01);
  mon.bezierCurveTo(flx - s * 0.25, floorY - s * 0.08, flx - s * 0.19, floorY - s * 0.11, flx - s * 0.16, floorY - s * 0.18);
  mon.bezierCurveTo(flx - s * 0.13, floorY - s * 0.25, flx - s * 0.08, floorY - s * 0.24, flx - s * 0.06, floorY - s * 0.29);
  mon.quadraticCurveTo(flx - s * 0.02, floorY - s * 0.345, flx + s * 0.025, floorY - s * 0.325);
  mon.bezierCurveTo(flx + s * 0.07, floorY - s * 0.31, flx + s * 0.085, floorY - s * 0.25, flx + s * 0.12, floorY - s * 0.215);
  mon.bezierCurveTo(flx + s * 0.16, floorY - s * 0.18, flx + s * 0.185, floorY - s * 0.1, flx + s * 0.235, floorY - s * 0.065);
  mon.quadraticCurveTo(flx + s * 0.26, floorY - s * 0.035, flx + s * 0.265, floorY + s * 0.01);
  mon.closePath();
  const monG = ctx.createLinearGradient(0, floorY - s * 0.35, 0, floorY + s * 0.01);
  monG.addColorStop(0, mix(C.void, C.parchmentAged, 0.1));
  monG.addColorStop(1, mix(C.void, C.parchmentAged, 0.16));
  ctx.fillStyle = monG;
  ctx.fill(mon);
  ctx.save();
  ctx.clip(mon);
  // the tall light lying full on it — no longer a climb, an arrival
  ctx.globalCompositeOperation = "lighter";
  const climb = ctx.createRadialGradient(flx, stubTop - flameH * 0.3, s * 0.02, flx, stubTop - flameH * 0.3, s * 0.36);
  climb.addColorStop(0, shade(C.flame, 0.6, 0.32));
  climb.addColorStop(0.5, shade(C.ember, 0.6, 0.13));
  climb.addColorStop(1, shade(C.ember, 0.6, 0));
  ctx.fillStyle = climb;
  ctx.fill(mon);
  ctx.globalCompositeOperation = "source-over";
  // frozen drip runnels, most of them warm now
  for (let i = 0; i < 11; i++) {
    const dx = flx + (rand() - 0.5) * s * 0.44;
    const near = Math.max(0, 1 - Math.abs(dx - flx) / (s * 0.2));
    const dTop = floorY - s * (0.05 + rand() * 0.22) * (0.4 + near * 0.6);
    const dLen = s * (0.05 + rand() * 0.1);
    ctx.strokeStyle = mix(C.parchmentAged, C.flame, 0.3 + near * 0.3, 0.07 + near * 0.18);
    ctx.lineWidth = Math.max(1, s * (0.0014 + rand() * 0.0018));
    ctx.beginPath();
    ctx.moveTo(dx, dTop);
    ctx.bezierCurveTo(dx + s * 0.004, dTop + dLen * 0.35, dx - s * 0.004, dTop + dLen * 0.65, dx + (rand() - 0.5) * s * 0.006, dTop + dLen);
    ctx.stroke();
  }
  // sag tiers — soft ghosts; even these read gentler in the fuller light
  ctx.strokeStyle = shade(C.void, 0.85, 0.16);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const ry = floorY - s * (0.07 + i * 0.08);
    ctx.beginPath();
    ctx.moveTo(flx - s * 0.27, ry);
    ctx.quadraticCurveTo(flx + (rand() - 0.5) * s * 0.1, ry + s * (0.014 + rand() * 0.02), flx + s * 0.27, ry - s * 0.012);
    ctx.stroke();
  }
  ctx.restore();
  // crown rim in full light
  ctx.strokeStyle = mix(C.ember, C.flame, 0.55, 0.5);
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.beginPath();
  ctx.moveTo(flx - s * 0.06, floorY - s * 0.29);
  ctx.quadraticCurveTo(flx - s * 0.02, floorY - s * 0.345, flx + s * 0.025, floorY - s * 0.325);
  ctx.stroke();

  // ── 5. floor — the light no longer thrown, simply everywhere ────────────
  const floorG = ctx.createLinearGradient(0, floorY, 0, h);
  floorG.addColorStop(0, mix(C.void, C.surface2, 0.62));
  floorG.addColorStop(0.4, mix(C.void, C.surface, 0.44));
  floorG.addColorStop(1, shade(C.void, 0.8));
  ctx.fillStyle = floorG;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.strokeStyle = shade(C.surface2, 1.25, 0.12);
  ctx.lineWidth = 1;
  line(0, floorY + s * 0.05, flx - s * 0.22, floorY + s * 0.05);
  line(mX + sH * 0.4, floorY + s * 0.05, w, floorY + s * 0.05);
  ctx.strokeStyle = shade(C.surface2, 1.2, 0.06);
  line(0, floorY + s * 0.1, flx - s * 0.27, floorY + s * 0.1);
  line(mX + sH * 0.48, floorY + s * 0.1, w, floorY + s * 0.1);
  // the warm pool — wider than plate three's dawn, and calmer
  ctx.save();
  ctx.translate(flx, daisY + s * 0.006);
  ctx.scale(1, 0.32);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.64);
  pool.addColorStop(0, mix(C.ember, C.flame, 0.5, 0.4));
  pool.addColorStop(0.5, shade(C.ember, 0.75, 0.17));
  pool.addColorStop(1, shade(C.ember, 0.75, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-s * 0.68, -s * 0.68, s * 1.36, s * 1.36);
  ctx.restore();
  // three soft reaches, not spokes — the widest one finds the stairs
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [txf, tyf, hwf, af] of [
    [-0.42, 0.09, 0.04, 0.09],
    [0.06, 0.13, 0.05, 0.08],
    [0.52, 0.055, 0.045, 0.12], // toward the flight's foot — the invitation
  ] as const) {
    const tx = flx + txf * w;
    const ty = floorY + tyf * (h - floorY) * 0.9;
    const rayG = ctx.createLinearGradient(flx, daisY, tx, ty);
    rayG.addColorStop(0, mix(C.flame, C.ember, 0.45, af));
    rayG.addColorStop(1, mix(C.flame, C.ember, 0.45, 0));
    ctx.fillStyle = rayG;
    ctx.beginPath();
    ctx.moveTo(flx, daisY + s * 0.004);
    ctx.lineTo(tx, ty - hwf * s);
    ctx.lineTo(tx, ty + hwf * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // ── 6. spent votives — their shadows lawful, as they always were ────────
  for (const [vxf, vyf, vhf] of [
    [-0.235, 0.012, 0.03],
    [-0.198, 0.022, 0.017],
  ] as const) {
    const vx = flx + vxf * s;
    const vy = floorY + vyf * s;
    const vh2 = vhf * s;
    const vw2 = s * 0.008;
    ctx.fillStyle = shade(C.void, 0.5, 0.2);
    ctx.beginPath();
    ctx.moveTo(vx, vy + 1);
    ctx.lineTo(vx - s * (0.036 + rand() * 0.02), vy + s * 0.009);
    ctx.lineTo(vx - s * (0.036 + rand() * 0.02), vy + s * 0.013);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(C.parchmentAged, C.void, 0.48);
    ctx.fillRect(vx - vw2, vy - vh2, vw2 * 2, vh2);
    ctx.strokeStyle = mix(C.parchment, C.flame, 0.3, 0.45);
    ctx.lineWidth = 1;
    line(vx + vw2, vy - vh2 + 1, vx + vw2, vy - 1);
    ctx.strokeStyle = shade(C.void, 0.9, 0.65);
    line(vx, vy - vh2, vx + vw2 * 0.3, vy - vh2 - vw2 * 0.6);
  }

  // ── 7. her shadow — and for the first time it falls AWAY from the light,
  // like everyone else's; soft-edged, because every shadow here is soft now
  {
    const g1 = ctx.createLinearGradient(mX, 0, mX + s * 0.36, 0);
    g1.addColorStop(0, shade(C.void, 0.35, 0.3));
    g1.addColorStop(0.6, shade(C.void, 0.35, 0.16));
    g1.addColorStop(1, shade(C.void, 0.35, 0));
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.moveTo(mX - sH * 0.1, baseM + s * 0.004);
    ctx.quadraticCurveTo(mX + s * 0.1, baseM + s * 0.052, mX + s * 0.36, baseM + s * 0.046);
    ctx.lineTo(mX + s * 0.36, baseM + s * 0.016);
    ctx.quadraticCurveTo(mX + s * 0.1, baseM + s * 0.002, mX - sH * 0.1, baseM - s * 0.002);
    ctx.closePath();
    ctx.fill();
  }

  // ── 8. the dais and the fed stub ─────────────────────────────────────────
  ctx.fillStyle = mix(C.parchmentAged, C.void, 0.56);
  ctx.beginPath();
  ctx.ellipse(flx, daisY + s * 0.004, s * 0.115, s * 0.026, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(C.parchmentAged, C.void, 0.38);
  ctx.beginPath();
  ctx.ellipse(flx, daisY, s * 0.082, s * 0.02, 0, 0, Math.PI * 2);
  ctx.fill();
  const stub = new Path2D(); // squat body with a melted skirt
  stub.moveTo(flx - stubW, stubTop + s * 0.004);
  stub.bezierCurveTo(flx - stubW * 1.12, daisY - stubH * 0.5, flx - stubW * 1.3, daisY - stubH * 0.22, flx - stubW * 1.5, daisY);
  for (const [t, dpt] of [
    [-0.9, 0.3],
    [-0.4, 0.12],
    [0.15, 0.34],
    [0.7, 0.1],
    [1.5, 0.28],
  ] as const) {
    stub.quadraticCurveTo(flx + stubW * (t - 0.28), daisY + s * 0.012 * dpt * 2, flx + stubW * t, daisY + s * 0.008 * dpt);
  }
  stub.bezierCurveTo(flx + stubW * 1.3, daisY - stubH * 0.3, flx + stubW * 1.1, daisY - stubH * 0.55, flx + stubW, stubTop + s * 0.004);
  stub.closePath();
  const stubG = ctx.createLinearGradient(0, stubTop, 0, daisY);
  stubG.addColorStop(0, mix(C.parchment, C.flame, 0.35, 0.98));
  stubG.addColorStop(0.4, mix(C.parchmentAged, C.ember, 0.3));
  stubG.addColorStop(1, mix(C.parchmentAged, C.void, 0.42));
  ctx.fillStyle = stubG;
  ctx.fill(stub);
  ctx.strokeStyle = shade(C.void, 0.9, 0.4);
  ctx.lineWidth = 1;
  ctx.stroke(stub);
  ctx.strokeStyle = mix(C.parchment, C.flame, 0.25, 0.45);
  for (const dxf of [-0.62, -0.15, 0.42, 0.8] as const) {
    ctx.beginPath();
    ctx.moveTo(flx + stubW * dxf, stubTop + s * 0.006);
    ctx.quadraticCurveTo(flx + stubW * (dxf - 0.1), stubTop + stubH * 0.55, flx + stubW * (dxf + 0.08), daisY - s * 0.004);
    ctx.stroke();
  }
  // molten crown, brimming — the gift is still in it
  ctx.fillStyle = mix(C.flame, C.flameHi, 0.5, 0.98);
  ctx.beginPath();
  ctx.ellipse(flx, stubTop, stubW * 0.9, stubW * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(C.flameHi, 1.2, 0.85);
  ctx.lineWidth = Math.max(1, s * 0.0016);
  ctx.beginPath();
  ctx.ellipse(flx, stubTop, stubW * 0.9, stubW * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // ── 9. THE CANDLEMAID — seated beside what she kept, shoulders loose ────
  // robe silhouette (head bare above it — the hood is DOWN, first time seen)
  const maid = new Path2D();
  maid.moveTo(mX - sH * 0.295, baseM); // front hem, toward the flame
  maid.bezierCurveTo(mX - sH * 0.315, baseM - sH * 0.1, mX - sH * 0.3, baseM - sH * 0.2, mX - sH * 0.225, baseM - sH * 0.265); // knee tent
  maid.quadraticCurveTo(mX - sH * 0.155, baseM - sH * 0.315, mX - sH * 0.06, baseM - sH * 0.31); // the lap valley
  maid.bezierCurveTo(mX - sH * 0.1, baseM - sH * 0.38, mX - sH * 0.125, baseM - sH * 0.46, mX - sH * 0.105, baseM - sH * 0.545); // chest
  maid.quadraticCurveTo(mX - sH * 0.085, baseM - sH * 0.62, mX - sH * 0.035, baseM - sH * 0.665); // throat
  maid.lineTo(mX - sH * 0.03, baseM - sH * 0.71); // neck front
  maid.quadraticCurveTo(mX + sH * 0.01, baseM - sH * 0.725, mX + sH * 0.05, baseM - sH * 0.715); // (head sits over this)
  maid.quadraticCurveTo(mX + sH * 0.075, baseM - sH * 0.685, mX + sH * 0.1, baseM - sH * 0.655); // nape
  maid.quadraticCurveTo(mX + sH * 0.17, baseM - sH * 0.625, mX + sH * 0.215, baseM - sH * 0.565); // the loosened shoulder
  maid.bezierCurveTo(mX + sH * 0.29, baseM - sH * 0.42, mX + sH * 0.325, baseM - sH * 0.22, mX + sH * 0.325, baseM); // relaxed back
  maid.closePath();
  const maidG = ctx.createLinearGradient(mX - sH * 0.315, 0, mX + sH * 0.325, 0);
  maidG.addColorStop(0, mix(C.inkSoft, C.boneDim, 0.45)); // the flame side of her, lit
  maidG.addColorStop(0.55, mix(C.inkSoft, C.void, 0.22));
  maidG.addColorStop(1, mix(C.inkSoft, C.void, 0.5));
  ctx.fillStyle = maidG;
  ctx.fill(maid);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0024);
  ctx.stroke(maid);
  // melt-bumps where her hem meets the stone — quieter now, but still hers
  ctx.fillStyle = mix(C.inkSoft, C.void, 0.42);
  ctx.beginPath();
  ctx.moveTo(mX - sH * 0.295, baseM);
  ctx.quadraticCurveTo(mX - sH * 0.2, baseM + sH * 0.028, mX - sH * 0.08, baseM + sH * 0.008);
  ctx.quadraticCurveTo(mX + sH * 0.05, baseM + sH * 0.032, mX + sH * 0.17, baseM + sH * 0.01);
  ctx.quadraticCurveTo(mX + sH * 0.26, baseM + sH * 0.024, mX + sH * 0.325, baseM);
  ctx.closePath();
  ctx.fill();
  // the hood, down at last — pooled in soft rolls at her shoulders
  ctx.fillStyle = mix(C.inkSoft, C.void, 0.28);
  ctx.beginPath();
  ctx.ellipse(mX + sH * 0.125, baseM - sH * 0.6, sH * 0.115, sH * 0.062, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(mX + sH * 0.05, baseM - sH * 0.645, sH * 0.075, sH * 0.045, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.85, 0.45); // gathered crease
  ctx.lineWidth = Math.max(1, s * 0.0016);
  ctx.beginPath();
  ctx.moveTo(mX + sH * 0.005, baseM - sH * 0.655);
  ctx.quadraticCurveTo(mX + sH * 0.12, baseM - sH * 0.62, mX + sH * 0.21, baseM - sH * 0.555);
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.45, 0.6); // firelight along the roll
  ctx.lineWidth = Math.max(1.2, s * 0.0018);
  ctx.beginPath();
  ctx.moveTo(mX + sH * 0.0, baseM - sH * 0.685);
  ctx.quadraticCurveTo(mX + sH * 0.09, baseM - sH * 0.665, mX + sH * 0.165, baseM - sH * 0.61);
  ctx.stroke();
  ctx.strokeStyle = shade(C.void, 0.85, 0.35); // a second lazy fold in the pool
  ctx.lineWidth = Math.max(1, s * 0.0014);
  ctx.beginPath();
  ctx.moveTo(mX + sH * 0.06, baseM - sH * 0.6);
  ctx.quadraticCurveTo(mX + sH * 0.15, baseM - sH * 0.575, mX + sH * 0.205, baseM - sH * 0.525);
  ctx.stroke();
  // fold shadows down the robe — fewer than she has ever carried
  ctx.strokeStyle = shade(C.void, 0.9, 0.32);
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(mX - sH * 0.045, baseM - sH * 0.29);
  ctx.bezierCurveTo(mX - sH * 0.025, baseM - sH * 0.2, mX - sH * 0.05, baseM - sH * 0.1, mX - sH * 0.09, baseM - sH * 0.02);
  ctx.moveTo(mX + sH * 0.1, baseM - sH * 0.4);
  ctx.bezierCurveTo(mX + sH * 0.12, baseM - sH * 0.26, mX + sH * 0.09, baseM - sH * 0.12, mX + sH * 0.11, baseM - sH * 0.02);
  ctx.stroke();
  // warm rim down her whole front — she is facing her light, all of it
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.3, 0.85);
  ctx.lineWidth = Math.max(1.2, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(mX - sH * 0.035, baseM - sH * 0.665);
  ctx.quadraticCurveTo(mX - sH * 0.085, baseM - sH * 0.62, mX - sH * 0.105, baseM - sH * 0.545);
  ctx.bezierCurveTo(mX - sH * 0.125, baseM - sH * 0.46, mX - sH * 0.1, baseM - sH * 0.38, mX - sH * 0.06, baseM - sH * 0.31);
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.5, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mX - sH * 0.225, baseM - sH * 0.265);
  ctx.bezierCurveTo(mX - sH * 0.3, baseM - sH * 0.2, mX - sH * 0.315, baseM - sH * 0.1, mX - sH * 0.295, baseM);
  ctx.stroke();
  // knee crest catching the light
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.35, 0.55);
  ctx.beginPath();
  ctx.moveTo(mX - sH * 0.26, baseM - sH * 0.235);
  ctx.quadraticCurveTo(mX - sH * 0.2, baseM - sH * 0.29, mX - sH * 0.13, baseM - sH * 0.305);
  ctx.stroke();
  // the chamber's claim on her back — nearly let go
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.6, 0.12);
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.beginPath();
  ctx.moveTo(mX + sH * 0.215, baseM - sH * 0.565);
  ctx.bezierCurveTo(mX + sH * 0.29, baseM - sH * 0.42, mX + sH * 0.325, baseM - sH * 0.22, mX + sH * 0.325, baseM - sH * 0.02);
  ctx.stroke();

  // ── 10. her bare head — grey-streaked, unbowed, warm along the brow ─────
  // neck
  ctx.fillStyle = mix(C.bone, C.ink, 0.6);
  ctx.beginPath();
  ctx.moveTo(mX - sH * 0.032, baseM - sH * 0.66);
  ctx.lineTo(mX - sH * 0.028, baseM - sH * 0.74);
  ctx.lineTo(mX + sH * 0.055, baseM - sH * 0.75);
  ctx.quadraticCurveTo(mX + sH * 0.055, baseM - sH * 0.69, mX + sH * 0.07, baseM - sH * 0.66);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.35, 0.5); // lit throat edge
  ctx.lineWidth = 1;
  line(mX - sH * 0.032, baseM - sH * 0.66, mX - sH * 0.028, baseM - sH * 0.74);
  // skull
  const head = new Path2D();
  head.ellipse(hdX, hdY, hr * 0.82, hr, -0.05, 0, Math.PI * 2);
  ctx.fillStyle = mix(C.bone, C.ink, 0.55);
  ctx.fill(head);
  ctx.save();
  ctx.clip(head);
  // firelight owning the flame side of her face, dusk keeping the far side
  const faceG = ctx.createLinearGradient(hdX - hr, 0, hdX + hr * 0.9, 0);
  faceG.addColorStop(0, mix(C.flame, C.parchment, 0.45, 0.5));
  faceG.addColorStop(0.45, mix(C.ember, C.parchment, 0.5, 0.16));
  faceG.addColorStop(1, shade(C.void, 0.8, 0.28));
  ctx.fillStyle = faceG;
  ctx.fillRect(hdX - hr, hdY - hr * 1.05, hr * 2, hr * 2.1);
  // warmth resting on the near cheekbone
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cheek = ctx.createRadialGradient(hdX - hr * 0.38, hdY + hr * 0.2, 0, hdX - hr * 0.38, hdY + hr * 0.2, hr * 0.5);
  cheek.addColorStop(0, shade(C.flame, 0.6, 0.22));
  cheek.addColorStop(1, shade(C.flame, 0.6, 0));
  ctx.fillStyle = cheek;
  ctx.fillRect(hdX - hr, hdY - hr * 0.4, hr * 1.4, hr * 1.3);
  ctx.restore();
  // brows — level, unknotted; twenty years of bracing, set down
  ctx.strokeStyle = shade(C.ink, 0.7, 0.3);
  ctx.lineWidth = Math.max(1, hr * 0.04);
  ctx.beginPath();
  ctx.moveTo(hdX - hr * 0.62, hdY - hr * 0.26);
  ctx.quadraticCurveTo(hdX - hr * 0.48, hdY - hr * 0.31, hdX - hr * 0.36, hdY - hr * 0.28);
  ctx.moveTo(hdX - hr * 0.22, hdY - hr * 0.28);
  ctx.quadraticCurveTo(hdX - hr * 0.08, hdY - hr * 0.31, hdX + hr * 0.03, hdY - hr * 0.26);
  ctx.stroke();
  // ── the eyes, half-closed — and still holding a flame they should not ──
  // the lid line carries the weight; the light under it is only a sliver
  for (const [ex, rx, near] of [
    [hdX - hr * 0.5, hr * 0.09, 0],
    [hdX - hr * 0.12, hr * 0.12, 1],
  ] as const) {
    const eyY = hdY - hr * 0.05;
    // the warm sliver still showing under the lid
    ctx.fillStyle = mix(C.flame, C.flameHi, 0.5, 0.5);
    ctx.beginPath();
    ctx.ellipse(ex, eyY + hr * 0.03, rx * 0.55, Math.max(0.6, hr * 0.02), 0, 0, Math.PI * 2);
    ctx.fill();
    // the reflection that should not be there — taller than any slit could hold
    drop(ex, eyY + hr * 0.05, hr * (0.065 + near * 0.02), hr * 0.013, 0, shade(C.flameHi, 1.3, 0.75));
    // the half-closed upper lid — rest, not sleep; nearly a smile itself
    ctx.strokeStyle = shade(C.void, 0.7, 0.9);
    ctx.lineWidth = Math.max(1.4, hr * 0.07);
    ctx.beginPath();
    ctx.moveTo(ex - rx, eyY);
    ctx.quadraticCurveTo(ex, eyY + hr * 0.05, ex + rx, eyY - hr * 0.01);
    ctx.stroke();
    // a thread of light along the lower lid
    ctx.strokeStyle = mix(C.flame, C.parchment, 0.4, 0.35);
    ctx.lineWidth = Math.max(0.8, hr * 0.018);
    ctx.beginPath();
    ctx.moveTo(ex - rx * 0.75, eyY + hr * 0.06);
    ctx.quadraticCurveTo(ex, eyY + hr * 0.085, ex + rx * 0.75, eyY + hr * 0.055);
    ctx.stroke();
  }
  // wax-dried tear tracks — grief and relief in the same line, glinting
  // warm where they caught the light and set
  for (const [tx0, ty0, tx1, ty1, bend] of [
    [hdX - hr * 0.14, hdY + hr * 0.08, hdX - hr * 0.2, hdY + hr * 0.58, hr * 0.06],
    [hdX - hr * 0.54, hdY + hr * 0.08, hdX - hr * 0.59, hdY + hr * 0.44, hr * 0.03],
  ] as const) {
    ctx.strokeStyle = shade(C.void, 0.8, 0.22); // the tiny ridge shadow of dried wax
    ctx.lineWidth = Math.max(0.8, hr * 0.026);
    ctx.beginPath();
    ctx.moveTo(tx0 + 1, ty0);
    ctx.quadraticCurveTo(tx0 - bend + 1, (ty0 + ty1) / 2, tx1 + 1, ty1);
    ctx.stroke();
    ctx.strokeStyle = mix(C.parchment, C.flameHi, 0.4, 0.55); // the glint
    ctx.lineWidth = Math.max(0.8, hr * 0.02);
    ctx.beginPath();
    ctx.moveTo(tx0, ty0);
    ctx.quadraticCurveTo(tx0 - bend, (ty0 + ty1) / 2, tx1, ty1);
    ctx.stroke();
    ctx.fillStyle = shade(C.flameHi, 1.2, 0.75); // the bead where it stopped
    ctx.beginPath();
    ctx.arc(tx1, ty1, Math.max(0.8, hr * 0.028), 0, Math.PI * 2);
    ctx.fill();
  }
  // the almost-smile — corners lifted a breath, no more; twenty years wide
  ctx.strokeStyle = shade(C.ink, 0.45, 0.95);
  ctx.lineWidth = Math.max(1.2, hr * 0.05);
  ctx.beginPath();
  ctx.moveTo(hdX - hr * 0.48, hdY + hr * 0.42);
  ctx.quadraticCurveTo(hdX - hr * 0.28, hdY + hr * 0.485, hdX - hr * 0.08, hdY + hr * 0.415);
  ctx.stroke();
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.35, 0.55); // lit lower lip
  ctx.lineWidth = Math.max(1, hr * 0.035);
  ctx.beginPath();
  ctx.moveTo(hdX - hr * 0.4, hdY + hr * 0.53);
  ctx.quadraticCurveTo(hdX - hr * 0.27, hdY + hr * 0.565, hdX - hr * 0.14, hdY + hr * 0.525);
  ctx.stroke();
  ctx.restore(); // ← end head clip
  // the profile the light draws — brow, and the small certain nose
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.32, 0.85);
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.beginPath();
  ctx.ellipse(hdX, hdY, hr * 0.82, hr, -0.05, Math.PI * 0.72, Math.PI * 1.22);
  ctx.stroke();
  ctx.fillStyle = mix(C.flame, C.parchment, 0.45, 0.85);
  ctx.beginPath();
  ctx.moveTo(hdX - hr * 0.68, hdY - hr * 0.04);
  ctx.quadraticCurveTo(hdX - hr * 0.92, hdY + hr * 0.09, hdX - hr * 0.62, hdY + hr * 0.2);
  ctx.closePath();
  ctx.fill();

  // ── 11. her hair, hood-hidden for twenty years — grey-streaked, combed
  // back to a gather at the nape; it must read as hair, never as cloth
  const hair = new Path2D();
  hair.moveTo(hdX - hr * 0.66, hdY - hr * 0.34);
  hair.quadraticCurveTo(hdX - hr * 0.72, hdY - hr * 0.82, hdX - hr * 0.08, hdY - hr * 1.06);
  hair.quadraticCurveTo(hdX + hr * 0.66, hdY - hr * 0.98, hdX + hr * 0.84, hdY - hr * 0.1);
  hair.quadraticCurveTo(hdX + hr * 0.88, hdY + hr * 0.42, hdX + hr * 0.6, hdY + hr * 0.6); // to the gather
  hair.quadraticCurveTo(hdX + hr * 0.52, hdY + hr * 0.18, hdX + hr * 0.4, hdY - hr * 0.2); // behind the ear
  hair.quadraticCurveTo(hdX + hr * 0.08, hdY - hr * 0.5, hdX - hr * 0.38, hdY - hr * 0.46); // the hairline
  hair.quadraticCurveTo(hdX - hr * 0.54, hdY - hr * 0.42, hdX - hr * 0.66, hdY - hr * 0.34);
  hair.closePath();
  ctx.fillStyle = mix(C.ink, C.boneDim, 0.14);
  ctx.fill(hair);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.stroke(hair);
  // strand work over the whole mass — every line follows the comb, from
  // hairline back and down to the gather; the grey rides these, not patches
  ctx.save();
  ctx.clip(hair);
  ctx.lineCap = "round";
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const a0 = -Math.PI * 0.92 + t * Math.PI * 0.66; // fan around the skull
    const x0 = hdX + Math.cos(a0) * hr * 0.62;
    const y0 = hdY + Math.sin(a0) * hr * 0.72;
    const silver = i % 3 !== 1;
    ctx.strokeStyle = silver
      ? mix(C.boneDim, C.parchment, 0.25 + rand() * 0.3, 0.34 + rand() * 0.14)
      : shade(C.ink, 0.7, 0.5);
    ctx.lineWidth = Math.max(0.8, hr * (0.02 + rand() * 0.018));
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(
      hdX + Math.cos(a0 * 0.55) * hr * (0.95 + rand() * 0.12),
      hdY + Math.sin(a0 * 0.55) * hr * (1.0 + rand() * 0.1),
      hdX + hr * 0.58,
      hdY + hr * (0.44 + rand() * 0.14),
    );
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.restore();
  // the gather at the nape — where twenty years of it is wound
  ctx.fillStyle = mix(C.ink, C.boneDim, 0.36);
  ctx.beginPath();
  ctx.ellipse(hdX + hr * 0.6, hdY + hr * 0.58, hr * 0.17, hr * 0.14, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mix(C.boneDim, C.parchment, 0.3, 0.4); // silver catching on the coil
  ctx.lineWidth = Math.max(0.8, hr * 0.03);
  ctx.beginPath();
  ctx.arc(hdX + hr * 0.6, hdY + hr * 0.58, hr * 0.11, -Math.PI * 0.8, Math.PI * 0.3);
  ctx.stroke();
  // firelight along the crown — the first light her bare hair has ever held
  ctx.strokeStyle = mix(C.flame, C.flameHi, 0.3, 0.55);
  ctx.lineWidth = Math.max(1, s * 0.0016);
  ctx.beginPath();
  ctx.moveTo(hdX - hr * 0.64, hdY - hr * 0.46);
  ctx.quadraticCurveTo(hdX - hr * 0.52, hdY - hr * 0.86, hdX - hr * 0.04, hdY - hr * 1.02);
  ctx.stroke();
  // flyaway hairs the comb no longer argues with, lit like filament
  ctx.strokeStyle = mix(C.flameHi, C.parchment, 0.4, 0.3);
  ctx.lineWidth = Math.max(0.6, s * 0.0008);
  for (const [fa, fl] of [
    [-0.75, 0.2],
    [-0.45, 0.16],
    [-0.15, 0.22],
  ] as const) {
    const bx = hdX + Math.cos(fa * Math.PI) * hr * 0.72;
    const by = hdY + Math.sin(fa * Math.PI) * hr * 0.92;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx - hr * fl * 0.4, by - hr * fl, bx + hr * fl * 0.5, by - hr * fl * 1.5);
    ctx.stroke();
  }

  // ── 12. the braid — over one shoulder, down her front, singed at the tip ─
  const brTop = hdY + hr * 0.72;
  const brEnd = baseM - sH * 0.41; // the tip hangs clear above her open hands
  const brP = (t: number): [number, number] => {
    const bx = mX + sH * (0.048 + Math.sin(t * Math.PI * 0.85) * 0.03 - t * 0.02);
    const by = brTop + t * (brEnd - brTop);
    return [bx, by];
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [wk, col] of [
    [1, mix(C.ink, C.boneDim, 0.3)],
    [0.55, mix(C.ink, C.boneDim, 0.58)], // grey heart of the plait
  ] as const) {
    for (let t = 0; t < 0.995; t += 0.05) {
      const [bx, by] = brP(t);
      const [nx, ny] = brP(Math.min(1, t + 0.055));
      ctx.strokeStyle = t > 0.9 ? shade(C.void, 1.2) : col;
      ctx.lineWidth = Math.max(1.2, sH * 0.024 * wk * (1 - t * 0.5));
      line(bx, by, nx, ny);
    }
  }
  // herringbone — alternating little diagonals, the way a plait actually sits
  ctx.lineWidth = Math.max(0.8, sH * 0.004);
  let flip = 1;
  for (let t = 0.07; t < 0.88; t += 0.075) {
    const [bx, by] = brP(t);
    const bw2 = sH * 0.011 * (1 - t * 0.45);
    ctx.strokeStyle = flip > 0 ? mix(C.boneDim, C.parchment, 0.25, 0.4) : shade(C.void, 0.9, 0.4);
    line(bx - bw2 * flip, by - bw2 * 0.8, bx + bw2 * flip, by + bw2 * 0.5);
    flip = -flip;
  }
  // a warm thread down its flame side
  ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.3);
  ctx.lineWidth = Math.max(1, sH * 0.005);
  ctx.beginPath();
  for (let t = 0.08; t < 0.88; t += 0.05) {
    const [bx, by] = brP(t);
    if (t <= 0.09) ctx.moveTo(bx - sH * 0.009, by);
    else ctx.lineTo(bx - sH * 0.009 * (1 - t * 0.4), by);
  }
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  // the singe — char, and one ember still thinking, above her open hands
  const [tipX, tipY] = brP(1);
  ctx.fillStyle = mix(C.ember, C.flame, 0.45, 0.85);
  ctx.beginPath();
  ctx.arc(tipX, tipY, Math.max(1, sH * 0.008), 0, Math.PI * 2);
  ctx.fill();

  // ── 13. her hands — open in her lap, palms up, done holding ─────────────
  const lapX = mX - sH * 0.06;
  const lapY = baseM - sH * 0.315;
  const waxFill = mix(C.parchment, C.flame, 0.24, 0.42);
  const waxEdge = shade(C.parchmentAged, 1.05, 0.75);
  // sleeves in from either side, each ending at a dark cuff
  for (const [ux0, uy0, ux1, uy1] of [
    [mX - sH * 0.075, baseM - sH * 0.46, mX - sH * 0.15, baseM - sH * 0.37],
    [mX + sH * 0.155, baseM - sH * 0.47, mX + sH * 0.045, baseM - sH * 0.36],
  ] as const) {
    capsulePath(ux0, uy0, ux1, uy1, s * 0.0125, s * 0.0105);
    ctx.fillStyle = mix(C.inkSoft, C.boneDim, 0.34);
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 0.8, 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = mix(C.inkSoft, C.void, 0.3);
    ctx.beginPath();
    ctx.ellipse(ux1, uy1, s * 0.012, s * 0.0145, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // translucent forearms out of the cuffs — the drip-lines long since still
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
    // two frozen drips, quiet — nothing new has run for a long time
    const a = Math.atan2(y1 - y0, x1 - x0);
    const px = -Math.sin(a);
    const py = Math.cos(a);
    ctx.strokeStyle = shade(C.parchmentAged, 1.1, 0.75);
    ctx.lineWidth = 1;
    for (const t of [0.4, 0.75] as const) {
      const dx = x0 + (x1 - x0) * t + px * (r0 + (r1 - r0) * t) * 0.8;
      const dy = y0 + (y1 - y0) * t + py * (r0 + (r1 - r0) * t) * 0.8;
      const dl = s * (0.006 + rand() * 0.006);
      line(dx, dy, dx + (rand() - 0.5) * 2, dy + dl);
      ctx.fillStyle = shade(C.parchmentAged, 1.15, 0.85);
      ctx.beginPath();
      ctx.arc(dx + (rand() - 0.5) * 2, dy + dl, Math.max(1, s * 0.0016), 0, Math.PI * 2);
      ctx.fill();
    }
  };
  waxLimb(mX - sH * 0.155, baseM - sH * 0.375, lapX - s * 0.006, lapY - s * 0.002, s * 0.009, s * 0.007);
  waxLimb(mX + sH * 0.045, baseM - sH * 0.36, lapX + s * 0.022, lapY + s * 0.004, s * 0.009, s * 0.007);
  // the open palms — cupping nothing, and the light pools in them anyway
  for (const [hx, hy, hrx, rot] of [
    [lapX - s * 0.002, lapY + s * 0.004, s * 0.0148, -0.28],
    [lapX + s * 0.026, lapY + s * 0.009, s * 0.014, 0.18],
  ] as const) {
    ctx.fillStyle = waxFill;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hrx, hrx * 0.68, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = waxEdge;
    ctx.lineWidth = Math.max(1, s * 0.0014);
    ctx.stroke();
    // slack fingers — three to a hand, all lying the same way, barely
    // curled toward the flame they no longer need to shield
    for (const ft of [-0.4, 0, 0.4] as const) {
      const fx0 = hx - Math.cos(rot) * hrx * 0.55 + Math.sin(rot) * hrx * ft;
      const fy0 = hy - Math.sin(rot) * hrx * 0.55 + Math.cos(rot) * hrx * ft * 0.6;
      const fl = s * (0.011 - Math.abs(ft) * 0.006);
      capsulePath(fx0, fy0, fx0 - fl, fy0 + fl * 0.28, s * 0.0032, s * 0.0024);
      ctx.fillStyle = waxFill;
      ctx.fill();
      ctx.strokeStyle = shade(C.parchmentAged, 1.0, 0.4);
      ctx.lineWidth = Math.max(0.6, s * 0.001);
      ctx.stroke();
    }
    ctx.save(); // subsurface glow — what she is made of now
    ctx.globalCompositeOperation = "lighter";
    const sub = ctx.createRadialGradient(hx, hy, 0, hx, hy, hrx * 2);
    sub.addColorStop(0, mix(C.flameHi, C.flame, 0.4, 0.17));
    sub.addColorStop(1, mix(C.flameHi, C.flame, 0.4, 0));
    ctx.fillStyle = sub;
    ctx.fillRect(hx - hrx * 2, hy - hrx * 2, hrx * 4, hrx * 4);
    ctx.restore();
  }

  // ── 14. THE FIRST FLAME — tall, fed, the whole reason ───────────────────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(flx, flameCy, 0, flx, flameCy, s * 0.42);
  halo.addColorStop(0, shade(C.flame, 0.9, 0.45));
  halo.addColorStop(0.5, shade(C.ember, 0.85, 0.18));
  halo.addColorStop(1, shade(C.ember, 0.85, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(flx - s * 0.44, flameCy - s * 0.44, s * 0.88, s * 0.88);
  ctx.restore();
  // the gilded rings of her office, bright as they were always meant to be
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.4, 0.55);
  ctx.lineWidth = Math.max(1.2, s * 0.0018);
  ctx.beginPath();
  ctx.arc(flx, flameCy, s * 0.088, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.32, 0.24);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(flx, flameCy, s * 0.122, 0, Math.PI * 2);
  ctx.stroke();
  drop(flx, stubTop + s * 0.002, flameH * 1.32, s * 0.021, s * 0.0035, shade(C.flame, 1, 0.95));
  drop(flx, stubTop - s * 0.003, flameH * 1.0, s * 0.0135, s * 0.002, C.flameHi);
  drop(flx, stubTop - s * 0.006, flameH * 0.62, s * 0.0072, 0, shade(C.flameHi, 1.65));
  // the dawn column — all the way to the ceiling now, and past caring
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const col = ctx.createLinearGradient(0, stubTop - flameH * 0.8, 0, h * 0.02);
  col.addColorStop(0, shade(C.flame, 0.8, 0.11));
  col.addColorStop(0.55, shade(C.ember, 0.75, 0.055));
  col.addColorStop(1, shade(C.ember, 0.75, 0.015));
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(flx - s * 0.055, stubTop - flameH * 0.7);
  ctx.lineTo(flx - s * 0.48, h * 0.015);
  ctx.lineTo(flx + s * 0.48, h * 0.015);
  ctx.lineTo(flx + s * 0.055, stubTop - flameH * 0.7);
  ctx.closePath();
  ctx.fill();
  const kiss = ctx.createRadialGradient(flx, h * 0.05, 0, flx, h * 0.05, s * 0.36);
  kiss.addColorStop(0, shade(C.ember, 0.75, 0.08));
  kiss.addColorStop(1, shade(C.ember, 0.75, 0));
  ctx.fillStyle = kiss;
  ctx.fillRect(flx - s * 0.38, h * 0.05 - s * 0.38, s * 0.76, s * 0.76);
  // sparks going up like the first birds — more of them, unhurried
  for (let i = 0; i < 12; i++) {
    const t = rand();
    const sy = stubTop - flameH * 1.15 - t * (stubTop - flameH * 1.15 - h * 0.1);
    const sx = flx + Math.sin(i * 2.1 + t * 5) * s * (0.012 + t * 0.034);
    ctx.fillStyle = mix(C.flameHi, C.flame, rand() * 0.5, 0.7 * (1 - t * 0.75));
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(0.7, s * 0.0012 * (1.4 - t)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ── 15. air — gold motes almost everywhere; the verdigris keeps its edge ─
  for (let i = 0; i < 30; i++) {
    const mx = rand() * w;
    const my = h * 0.1 + rand() * (floorY - h * 0.1);
    const warmAir = Math.abs(mx - flx) < s * 0.42;
    ctx.fillStyle = warmAir
      ? mix(C.flameHi, C.bone, 0.45, 0.06 + rand() * 0.1)
      : mix(C.bone, C.verdigris, 0.35, 0.03 + rand() * 0.05);
    ctx.beginPath();
    ctx.arc(mx, my, 0.5 + rand() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 16. grain, a light hand on the crush, deep calm for the caption ─────
  for (let i = 0; i < 480; i++) {
    const gx = rand() * w;
    const gy = rand() * h * 0.8;
    ctx.fillStyle = rand() < 0.6 ? shade(C.bone, 1, 0.012 + rand() * 0.022) : shade(C.void, 0.35, 0.025 + rand() * 0.025);
    ctx.fillRect(gx, gy, 1, 1);
  }
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.15);
  crush.addColorStop(0, shade(C.void, 0.6, 0.55));
  crush.addColorStop(1, shade(C.void, 0.6, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.15);
  // the bottom ~18% settles fully dark — the longest caption in the game
  // needs the stillest floor in the game
  const settle = ctx.createLinearGradient(0, h * 0.73, 0, h);
  settle.addColorStop(0, shade(C.void, 0.55, 0));
  settle.addColorStop(0.45, shade(C.void, 0.55, 0.48));
  settle.addColorStop(1, shade(C.void, 0.5, 0.82));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.73, w, h * 0.27);
  const vr = Math.min(w, h) * 0.62;
  for (const [vx, vy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    const v = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    v.addColorStop(0, shade(C.void, 0.5, 0.3));
    v.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}
