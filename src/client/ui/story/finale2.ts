/**
 * Finale plate 2 — "She Walks Up." The long rescue completes: one hundred
 * delvers each gave their candle's last wax, the First Flame stands restored,
 * and after twenty years the Candlemaid LEAVES. One long stone stair climbs
 * the frame diagonally (the flight grammar of meeting4, grown to fill a
 * plate). She is mid-flight, seen three-quarter from below-behind — hood
 * down (the grey-streaked hair, the long braid singed at the tip, exactly
 * as meeting4 first showed them) — carrying the restored First Flame before
 * her, its light thrown UP the stairs. THE detail that matters (continuity
 * with meeting4 §7): her shadow now falls NORMALLY — long down the steps
 * behind her, like anyone's. Twenty years of wrongness, ended in one plain
 * stripe of dark. Descending to meet her, a ribbon of townsfolk lines the
 * stair edges, each holding a small candle — dozens of warm points coming
 * down like stars walking — and where the two lights meet mid-stair the air
 * is the brightest thing the game has ever painted. Two-hue law holds:
 * amber/white-gold everywhere it counts, the verdigris reduced to a last
 * cold breath under the flight and a wall alphabet going quiet for good.
 * Joy in the same woodcut grammar — never cartoon. Caller has DPR-scaled
 * and cleared; the bottom ~18% stays calm and dark for the caption.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall pattern, own seed) — never Math.random, never
// paint.ts crand (that stream belongs to the world-texture painters).
function slideRand(seed: number): () => number {
  let s = seed >>> 0 || 0xf17e5a;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintFinale2(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = slideRand(0xf17e5a);
  const s = Math.min(w, h);
  const TAU = Math.PI * 2;
  const INK = shade(C.void, 0.7, 0.9);

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

  // ── geometry — one long flight, lower-left depth to upper-right air ──────
  // The run/rise shrink slightly as it climbs: the top is farther away.
  const stepN = 22;
  const shrink = 0.982;
  const sx0 = w * 0.02;
  const sy0 = h * 0.8;
  type Step = { x: number; y: number; run: number; rise: number };
  const steps: Step[] = [];
  {
    let x = sx0;
    let y = sy0;
    let run = w * 0.049;
    let rise = h * 0.037;
    for (let i = 0; i < stepN; i++) {
      steps.push({ x, y, run, rise });
      x += run;
      y -= rise;
      run *= shrink;
      rise *= shrink;
    }
  }
  const last = steps[stepN - 1]!;
  const xTop = last.x + last.run;
  const yTop = last.y - last.rise;
  /** Approximate flight line — for deciding what is wall and what is under. */
  const flightY = (x: number): number => sy0 + ((yTop - sy0) * (x - sx0)) / (xTop - sx0);

  // her step, and where the two lights will meet above her
  const FI = 8;
  const stF = steps[FI]!;
  const fx = stF.x + stF.run * 0.5;
  const fy = stF.y;
  const sH = s * 0.3; // her standing height
  const mX = fx;
  const meetX = w * 0.56; // ≈ step 11 — the air between her flame and theirs
  const meetY = h * 0.4;
  // the carried flame — before her, a little above her folded forearms
  const flX = mX + sH * 0.21;
  const flY = fy - sH * 0.5;

  // ── 1. base void — lifted further than meeting4 ever lifted it ──────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, mix(C.void, C.surface2, 0.55));
  base.addColorStop(0.38, mix(C.void, C.surface2, 0.7));
  base.addColorStop(0.68, mix(C.void, C.surface, 0.55));
  base.addColorStop(1, mix(C.void, C.surface, 0.28));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // a diagonal warm wash climbing with the stair — the plate's whole slope
  // of feeling runs lower-left dark to upper-right light
  const climbWash = ctx.createLinearGradient(w * 0.1, h * 0.9, w * 0.9, h * 0.1);
  climbWash.addColorStop(0, shade(C.ember, 0.7, 0));
  climbWash.addColorStop(0.55, shade(C.ember, 0.75, 0.03));
  climbWash.addColorStop(1, shade(C.ember, 0.85, 0.075));
  ctx.fillStyle = climbWash;
  ctx.fillRect(0, 0, w, h);

  // her flame's ambience — thrown UP the stairs, before her, not around her
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const amb = ctx.createRadialGradient(flX + s * 0.1, flY - s * 0.09, 0, flX + s * 0.1, flY - s * 0.09, s * 1.05);
  amb.addColorStop(0, shade(C.ember, 0.9, 0.24));
  amb.addColorStop(0.45, shade(C.ember, 0.8, 0.1));
  amb.addColorStop(0.75, shade(C.ember, 0.8, 0.045));
  amb.addColorStop(1, shade(C.ember, 0.8, 0.015));
  ctx.fillStyle = amb;
  ctx.fillRect(0, 0, w, h);
  // and the townsfolk's answer — a cooler white-gold breathing down-stair
  const answer = ctx.createRadialGradient(w * 0.78, h * 0.26, 0, w * 0.78, h * 0.26, s * 0.62);
  answer.addColorStop(0, mix(C.flameHi, C.bone, 0.3, 0.11));
  answer.addColorStop(0.55, mix(C.flameHi, C.bone, 0.3, 0.045));
  answer.addColorStop(1, mix(C.flameHi, C.bone, 0.3, 0));
  ctx.fillStyle = answer;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // ── 2. the wall — the deep's alphabet going quiet behind her for good ───
  const pool = ctx.createRadialGradient(w * 0.09, h * 0.3, 0, w * 0.09, h * 0.3, s * 0.32);
  pool.addColorStop(0, shade(C.verdigrisDim, 1.05, 0.055));
  pool.addColorStop(1, shade(C.verdigrisDim, 1, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = "round";
  for (let r = 0; r < 6; r++) {
    const ry = h * (0.13 + r * 0.093);
    const gs = s * 0.0105;
    for (let gx = w * 0.04; gx < w * 0.96; gx += gs * 2.7 * (0.9 + rand() * 0.4)) {
      if (ry > flightY(gx) - s * 0.07) continue; // wall only — never on the flight
      if (Math.hypot(gx - meetX, ry - meetY) < s * 0.24) continue; // the meeting owns its air
      if (Math.hypot(gx - xTop, ry - yTop) < s * 0.12) continue; // and the arch its mouth
      if (rand() < 0.55) continue; // more worn away than any plate before
      const a = 0.035 + rand() * 0.05;
      ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.66, a);
      ctx.lineWidth = Math.max(0.8, gs * 0.22);
      mark(gx, ry + (rand() - 0.5) * gs, gs * (0.8 + rand() * 0.4), Math.floor(rand() * 5));
    }
  }
  ctx.lineCap = "butt";
  // the carved handrail groove climbing with the flight — a worn, human line
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.55, 0.1);
  ctx.lineWidth = Math.max(1, s * 0.0014);
  for (let i = 2; i < stepN - 1; i += 3) {
    const a = steps[i]!;
    const b = steps[Math.min(stepN - 1, i + 2)]!;
    line(a.x + a.run * 0.2, a.y - s * 0.1, b.x + b.run * 0.7, b.y - s * 0.1);
  }

  // ── 3. the flight — meeting4's stair vocabulary, grown to carry a plate ─
  {
    // mass under the flight — and the under-dark keeps the cold hue: the
    // last verdigris in the plate lives below the treads, where she was
    const under = ctx.createLinearGradient(0, h * 0.35, 0, h);
    under.addColorStop(0, mix(C.void, C.surface, 0.52));
    under.addColorStop(0.55, mix(C.void, C.verdigrisDim, 0.075));
    under.addColorStop(1, shade(C.void, 0.72));
    ctx.fillStyle = under;
    ctx.beginPath();
    ctx.moveTo(sx0 - s * 0.012, sy0 + s * 0.004);
    for (const st of steps) {
      ctx.lineTo(st.x + st.run, st.y);
      ctx.lineTo(st.x + st.run, st.y - st.rise);
    }
    ctx.lineTo(xTop + s * 0.02, yTop);
    ctx.lineTo(xTop + s * 0.02, h);
    ctx.lineTo(sx0 - s * 0.012, h);
    ctx.closePath();
    ctx.fill();
    // the deep she is leaving — a cold breath under the lowest steps only
    const left = ctx.createRadialGradient(w * 0.1, h * 0.96, 0, w * 0.1, h * 0.96, s * 0.36);
    left.addColorStop(0, shade(C.verdigrisDim, 1, 0.07));
    left.addColorStop(1, shade(C.verdigrisDim, 1, 0));
    ctx.fillStyle = left;
    ctx.fillRect(0, h * 0.6, w * 0.5, h * 0.4);
    // the flight itself — one stepped zigzag, drawn with a homeward hand
    ctx.strokeStyle = mix(C.void, C.boneDim, 0.6, 0.4);
    ctx.lineWidth = Math.max(1.2, s * 0.0018);
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    for (const st of steps) {
      ctx.lineTo(st.x + st.run, st.y); // tread
      ctx.lineTo(st.x + st.run, st.y - st.rise); // riser
    }
    ctx.stroke();
    // tread returns — depth on each step, fading as it climbs
    for (let i = 1; i < stepN; i++) {
      const st = steps[i]!;
      ctx.strokeStyle = mix(C.void, C.boneDim, 0.5, Math.max(0.05, 0.2 - i * 0.007));
      ctx.lineWidth = 1;
      line(st.x, st.y, st.x - s * 0.013, st.y + s * 0.006);
    }
  }

  // treads lit by the carried flame — the light thrown UP, exactly as told
  for (let i = FI + 1; i <= FI + 5 && i < stepN; i++) {
    const st = steps[i]!;
    const a = 0.58 - (i - FI - 1) * 0.1;
    ctx.strokeStyle = mix(C.flame, C.ember, 0.3, a);
    ctx.lineWidth = Math.max(1.2, s * 0.0022);
    line(st.x + s * 0.003, st.y, st.x + st.run, st.y);
    ctx.strokeStyle = mix(C.ember, C.flame, 0.4, a * 0.4); // riser catch
    ctx.lineWidth = 1;
    line(st.x + st.run, st.y, st.x + st.run, st.y - st.rise);
  }
  // treads lit by the descending candles — whiter gold, softer hand
  for (let i = FI + 6; i < stepN; i++) {
    const st = steps[i]!;
    const a = Math.max(0.08, 0.3 - (i - FI - 6) * 0.028);
    ctx.strokeStyle = mix(C.flameHi, C.parchment, 0.35, a);
    ctx.lineWidth = Math.max(1, s * 0.0016);
    line(st.x + s * 0.003, st.y, st.x + st.run, st.y);
  }
  // light spilling around her body onto her own tread — a warm sliver ahead
  ctx.strokeStyle = mix(C.flame, C.ember, 0.35, 0.5);
  ctx.lineWidth = Math.max(1.2, s * 0.002);
  line(fx + sH * 0.28, fy, stF.x + stF.run, fy);

  // ── 4. HER SHADOW — and it falls NORMALLY, long down the steps behind
  // her, like anyone's (meeting4 §7 made the promise; this keeps it).
  // The light wraps around her sides onto the treads below — and where she
  // stands between it and the stone, one plain lane of dark walks down.
  {
    // beyond its reach the wrapped light lands again — treads past the
    // shadow's head take a dim warmth, so the dark stripe is bounded by
    // light on both of its ends and cannot be mistaken for mere night
    for (let k = FI - 5; k >= Math.max(1, FI - 7); k--) {
      const st = steps[k]!;
      const a = 0.2 - (FI - 5 - k) * 0.06;
      ctx.strokeStyle = mix(C.ember, C.flame, 0.35, a);
      ctx.lineWidth = Math.max(1, s * 0.0018);
      line(st.x + s * 0.003, st.y, st.x + st.run, st.y);
    }
    // the root, pooled at her trailing hem
    ctx.save();
    ctx.translate(mX - sH * 0.12, fy + s * 0.004);
    ctx.scale(1, 0.3);
    const root = ctx.createRadialGradient(0, 0, 0, 0, 0, sH * 0.34);
    root.addColorStop(0, shade(C.void, 0.35, 0.44));
    root.addColorStop(1, shade(C.void, 0.35, 0));
    ctx.fillStyle = root;
    ctx.fillRect(-sH * 0.36, -sH * 0.36, sH * 0.72, sH * 0.72);
    ctx.restore();
    // the stripe itself — four treads of her, each a little fainter, their
    // risers standing in the same shade
    for (let k = FI - 1; k >= FI - 4; k--) {
      const st = steps[k]!;
      const a = 0.46 - (FI - 1 - k) * 0.1;
      ctx.fillStyle = shade(C.void, 0.35, a);
      ctx.fillRect(st.x, st.y - s * 0.0085, st.run, s * 0.0085);
      ctx.strokeStyle = shade(C.void, 0.35, a * 0.7);
      ctx.lineWidth = Math.max(1, s * 0.0016);
      line(st.x + st.run, st.y, st.x + st.run, st.y - st.rise);
    }
    const hb = steps[FI - 5]!; // the head, arrived at the bottom of herself
    ctx.fillStyle = shade(C.void, 0.35, 0.16);
    ctx.beginPath();
    ctx.ellipse(hb.x + hb.run * 0.45, hb.y - s * 0.005, s * 0.021, s * 0.0065, 0, 0, TAU);
    ctx.fill();
  }

  // ── 5. the arch at the top — and through it, the first night sky ────────
  {
    const above = ctx.createRadialGradient(xTop, yTop - s * 0.02, 0, xTop, yTop - s * 0.02, s * 0.085);
    above.addColorStop(0, mix(C.bone, C.flame, 0.3, 0.1));
    above.addColorStop(1, mix(C.bone, C.flame, 0.3, 0));
    ctx.fillStyle = above;
    ctx.fillRect(xTop - s * 0.09, yTop - s * 0.11, s * 0.18, s * 0.18);
    ctx.strokeStyle = mix(C.void, C.bone, 0.42, 0.3); // a worn lintel rim, no more
    ctx.lineWidth = Math.max(1, s * 0.0016);
    ctx.beginPath();
    ctx.arc(xTop, yTop, s * 0.045, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();
    // three specks of actual sky — the game's first stars, quiet as dust
    for (const [dxf, dyf, a] of [
      [-0.018, -0.052, 0.3],
      [0.012, -0.062, 0.22],
      [0.032, -0.038, 0.26],
    ] as const) {
      ctx.fillStyle = mix(C.bone, C.parchment, 0.4, a);
      ctx.fillRect(xTop + dxf * s, yTop + dyf * s, 1, 1);
    }
    // and more candles still coming through — points, not people yet
    for (const [t, a] of [
      [0.0, 0.55],
      [0.3, 0.45],
      [0.55, 0.4],
      [0.8, 0.3],
    ] as const) {
      const px = xTop - s * 0.012 - t * s * 0.05;
      const py = yTop - s * 0.008 - t * s * 0.028;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(px, py, 0, px, py, s * 0.018);
      g.addColorStop(0, mix(C.flameHi, C.parchment, 0.25, a * 0.5));
      g.addColorStop(1, mix(C.flameHi, C.parchment, 0.25, 0));
      ctx.fillStyle = g;
      ctx.fillRect(px - s * 0.02, py - s * 0.02, s * 0.04, s * 0.04);
      ctx.restore();
      ctx.fillStyle = mix(C.flameHi, C.parchment, 0.2, a);
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.7, s * 0.0016), 0, TAU);
      ctx.fill();
    }
  }

  // ── 6. the townsfolk — a ribbon down both stair edges, stars walking ────
  /** One small figure descending, candle offered down-stair (toward her). */
  const folk = (x: number, footY: number, hgt: number, tone: string, rimA: number, kind: number): void => {
    const r = hgt * 0.115;
    const headY = footY - hgt + r;
    if (kind === 2) {
      ctx.strokeStyle = tone; // a walking staff, planted a step below
      ctx.lineWidth = Math.max(1, hgt * 0.045);
      line(x - hgt * 0.2, footY + hgt * 0.06, x - hgt * 0.13, headY + hgt * 0.06);
    }
    // cloak — leaning a breath down-stairs; they are coming DOWN to her
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(x - hgt * 0.19, footY);
    ctx.quadraticCurveTo(x - hgt * 0.19, footY - hgt * 0.5, x - hgt * 0.12, footY - hgt * 0.7);
    ctx.quadraticCurveTo(x - hgt * 0.05, footY - hgt * 0.84, x + hgt * 0.05, footY - hgt * 0.81);
    ctx.quadraticCurveTo(x + hgt * 0.15, footY - hgt * 0.74, x + hgt * 0.17, footY - hgt * 0.46);
    ctx.quadraticCurveTo(x + hgt * 0.2, footY - hgt * 0.18, x + hgt * 0.16, footY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); // bare heads, all of them — nobody hoods a homecoming
    ctx.ellipse(x - hgt * 0.02, headY, r, r * 1.06, kind === 1 ? 0.15 : -0.08, 0, TAU);
    ctx.fill();
    // the candle, held out and a little up — the offered arm
    const cxc = x - hgt * 0.3;
    const cyc = footY - hgt * (kind === 3 ? 0.82 : 0.58);
    ctx.strokeStyle = tone;
    ctx.lineWidth = Math.max(1, hgt * 0.05);
    line(x - hgt * 0.08, footY - hgt * 0.55, cxc + hgt * 0.02, cyc + hgt * 0.05);
    ctx.fillStyle = mix(C.parchmentAged, C.void, 0.35);
    ctx.fillRect(cxc - hgt * 0.016, cyc - hgt * 0.075, hgt * 0.032, hgt * 0.095);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(cxc, cyc - hgt * 0.1, 0, cxc, cyc - hgt * 0.1, hgt * 0.42);
    g.addColorStop(0, mix(C.flameHi, C.parchment, 0.25, 0.3));
    g.addColorStop(1, mix(C.flameHi, C.parchment, 0.25, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cxc - hgt * 0.44, cyc - hgt * 0.54, hgt * 0.88, hgt * 0.88);
    ctx.restore();
    drop(cxc, cyc - hgt * 0.07, hgt * 0.14, hgt * 0.032, 0, mix(C.flameHi, C.parchment, 0.2, 0.95));
    // her light climbing to meet them — warm rim down their fronts
    ctx.strokeStyle = mix(C.ember, C.flame, 0.5, rimA);
    ctx.lineWidth = Math.max(1, hgt * 0.028);
    ctx.beginPath();
    ctx.moveTo(x - hgt * 0.12, footY - hgt * 0.7);
    ctx.quadraticCurveTo(x - hgt * 0.2, footY - hgt * 0.42, x - hgt * 0.17, footY - hgt * 0.06);
    ctx.stroke();
    ctx.beginPath(); // and along the near cheek
    ctx.ellipse(x - hgt * 0.02, headY, r * 0.9, r, -0.08, Math.PI * 0.6, Math.PI * 1.25);
    ctx.stroke();
  };
  // far file first (dimmer, smaller, the other edge), then the near file —
  // top of the flight downward, so the lower folk overlap the higher
  for (let i = stepN - 3; i >= FI + 5; i--) {
    const st = steps[i]!;
    const t = i - (FI + 5);
    const hgt = s * 0.084 * Math.pow(0.93, t);
    if (rand() < 0.75) {
      folk(
        st.x + st.run * 0.78,
        st.y - s * 0.007,
        hgt * 0.82,
        mix(C.void, C.inkSoft, 0.13 + rand() * 0.05),
        Math.max(0.08, 0.3 - t * 0.03),
        Math.floor(rand() * 2) === 0 ? 0 : 3,
      );
    }
    folk(
      st.x + st.run * 0.4,
      st.y,
      hgt * (rand() < 0.22 ? 0.62 : 1), // a child among them, here and there
      mix(C.void, C.inkSoft, 0.24 + rand() * 0.08),
      Math.max(0.14, 0.55 - t * 0.055),
      Math.floor(rand() * 4),
    );
  }
  // the leading pair's shadows fall UP-stair behind them, away from her
  // light — lawful, as everyone's always were
  for (const k of [FI + 5, FI + 6] as const) {
    const st = steps[k]!;
    ctx.fillStyle = shade(C.void, 0.4, 0.16);
    ctx.beginPath();
    ctx.ellipse(st.x + st.run * 0.72, st.y - s * 0.003, s * 0.026, s * 0.006, 0, 0, TAU);
    ctx.fill();
  }

  // ── 7. where the two lights meet — the brightest air in the game ────────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const meet = ctx.createRadialGradient(meetX, meetY, 0, meetX, meetY, s * 0.24);
  meet.addColorStop(0, mix(C.flameHi, C.parchment, 0.35, 0.22));
  meet.addColorStop(0.55, mix(C.flameHi, C.ember, 0.4, 0.09));
  meet.addColorStop(1, mix(C.flameHi, C.ember, 0.4, 0));
  ctx.fillStyle = meet;
  ctx.fillRect(meetX - s * 0.26, meetY - s * 0.26, s * 0.52, s * 0.52);
  const core = ctx.createRadialGradient(meetX, meetY, 0, meetX, meetY, s * 0.1);
  core.addColorStop(0, mix(C.flameHi, C.parchment, 0.5, 0.16));
  core.addColorStop(1, mix(C.flameHi, C.parchment, 0.5, 0));
  ctx.fillStyle = core;
  ctx.fillRect(meetX - s * 0.11, meetY - s * 0.11, s * 0.22, s * 0.22);
  ctx.restore();

  // ── 8. THE CANDLEMAID — mid-flight, three-quarter from below-behind ─────
  const hdX = mX + sH * 0.03;
  const hdY = fy - sH * 0.86;
  const hr = sH * 0.095;
  // robe silhouette — and the hem SWINGS; nothing about her pools anymore
  // (meeting4 gave her melt-bumps at rest; walking, she sheds them)
  const maid = new Path2D();
  maid.moveTo(mX - sH * 0.24, fy + sH * 0.035); // trailing hem, over the step nose
  maid.bezierCurveTo(mX - sH * 0.27, fy - sH * 0.16, mX - sH * 0.2, fy - sH * 0.38, mX - sH * 0.165, fy - sH * 0.56); // her back, climbing
  maid.quadraticCurveTo(mX - sH * 0.13, fy - sH * 0.72, mX - sH * 0.045, fy - sH * 0.78); // shoulder rise
  maid.lineTo(mX - sH * 0.01, fy - sH * 0.8); // nape
  maid.quadraticCurveTo(mX + sH * 0.05, fy - sH * 0.815, mX + sH * 0.075, fy - sH * 0.77); // (head sits over this)
  maid.quadraticCurveTo(mX + sH * 0.14, fy - sH * 0.7, mX + sH * 0.16, fy - sH * 0.6); // leading shoulder
  maid.quadraticCurveTo(mX + sH * 0.23, fy - sH * 0.53, mX + sH * 0.205, fy - sH * 0.44); // forearms, carrying
  maid.quadraticCurveTo(mX + sH * 0.13, fy - sH * 0.4, mX + sH * 0.14, fy - sH * 0.31); // in under the arms
  maid.quadraticCurveTo(mX + sH * 0.225, fy - sH * 0.22, mX + sH * 0.235, fy - sH * 0.12); // the raised knee
  maid.quadraticCurveTo(mX + sH * 0.25, fy - sH * 0.06, mX + sH * 0.28, fy - stF.rise); // shin to the tread above
  maid.lineTo(mX + sH * 0.21, fy - stF.rise); // the leading foot, planted flat
  maid.quadraticCurveTo(mX + sH * 0.14, fy + sH * 0.015, mX + sH * 0.02, fy + sH * 0.01); // hem between the feet
  maid.quadraticCurveTo(mX - sH * 0.13, fy + sH * 0.055, mX - sH * 0.24, fy + sH * 0.035); // the swing behind
  maid.closePath();
  const maidG = ctx.createLinearGradient(mX + sH * 0.24, 0, mX - sH * 0.24, 0);
  maidG.addColorStop(0, mix(C.inkSoft, C.boneDim, 0.42)); // the flame side of her, lit
  maidG.addColorStop(0.5, mix(C.inkSoft, C.void, 0.28));
  maidG.addColorStop(1, mix(C.inkSoft, C.void, 0.6));
  ctx.fillStyle = maidG;
  ctx.fill(maid);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0024);
  ctx.stroke(maid);
  // the trailing heel, lifting — mid-stride, believed
  ctx.fillStyle = mix(C.inkSoft, C.void, 0.4);
  ctx.beginPath();
  ctx.ellipse(mX - sH * 0.03, fy + sH * 0.02, sH * 0.045, sH * 0.018, 0.2, 0, TAU);
  ctx.fill();
  // the hood, down for good — pooled in soft rolls at her shoulders
  ctx.fillStyle = mix(C.inkSoft, C.void, 0.28);
  ctx.beginPath();
  ctx.ellipse(mX - sH * 0.075, fy - sH * 0.68, sH * 0.105, sH * 0.055, 0.3, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(mX - sH * 0.005, fy - sH * 0.735, sH * 0.07, sH * 0.04, 0.15, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.85, 0.45); // gathered crease
  ctx.lineWidth = Math.max(1, s * 0.0016);
  ctx.beginPath();
  ctx.moveTo(mX + sH * 0.04, fy - sH * 0.75);
  ctx.quadraticCurveTo(mX - sH * 0.06, fy - sH * 0.71, mX - sH * 0.15, fy - sH * 0.645);
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.45, 0.4); // spill along the roll
  ctx.lineWidth = Math.max(1.2, s * 0.0018);
  ctx.beginPath();
  ctx.moveTo(mX + sH * 0.055, fy - sH * 0.775);
  ctx.quadraticCurveTo(mX - sH * 0.02, fy - sH * 0.745, mX - sH * 0.09, fy - sH * 0.7);
  ctx.stroke();
  // fold shadows — few, and moving with her
  ctx.strokeStyle = shade(C.void, 0.9, 0.3);
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(mX - sH * 0.06, fy - sH * 0.52);
  ctx.bezierCurveTo(mX - sH * 0.09, fy - sH * 0.36, mX - sH * 0.06, fy - sH * 0.18, mX - sH * 0.1, fy - sH * 0.02);
  ctx.moveTo(mX + sH * 0.06, fy - sH * 0.36);
  ctx.quadraticCurveTo(mX + sH * 0.04, fy - sH * 0.2, mX + sH * 0.08, fy - sH * 0.03);
  ctx.stroke();
  // warm rim down her whole leading edge — she walks straight at her light
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.3, 0.9);
  ctx.lineWidth = Math.max(1.2, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(mX + sH * 0.075, fy - sH * 0.77);
  ctx.quadraticCurveTo(mX + sH * 0.14, fy - sH * 0.7, mX + sH * 0.16, fy - sH * 0.6);
  ctx.quadraticCurveTo(mX + sH * 0.23, fy - sH * 0.53, mX + sH * 0.205, fy - sH * 0.44);
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.5, 0.55);
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.beginPath();
  ctx.moveTo(mX + sH * 0.14, fy - sH * 0.31);
  ctx.quadraticCurveTo(mX + sH * 0.225, fy - sH * 0.22, mX + sH * 0.235, fy - sH * 0.12);
  ctx.quadraticCurveTo(mX + sH * 0.25, fy - sH * 0.06, mX + sH * 0.28, fy - stF.rise);
  ctx.stroke();
  // the deep's claim on her back — almost nothing now, and falling behind
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.65, 0.07);
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.beginPath();
  ctx.moveTo(mX - sH * 0.165, fy - sH * 0.56);
  ctx.bezierCurveTo(mX - sH * 0.2, fy - sH * 0.38, mX - sH * 0.27, fy - sH * 0.16, mX - sH * 0.24, fy + sH * 0.02);
  ctx.stroke();

  // ── 9. her bare head from behind — nearly all hair from back here, one
  // lit sliver of face where the turn allows it; the smile stays hers
  // (meeting4 spent it — this plate only banks it)
  const head = new Path2D();
  head.ellipse(hdX, hdY, hr * 0.84, hr, 0.06, 0, TAU);
  ctx.fillStyle = mix(C.ink, C.boneDim, 0.14); // the whole skull is hair first
  ctx.fill(head);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.stroke(head);
  ctx.save();
  ctx.clip(head);
  // the face strip at the leading edge — warm skin, edge-lit
  const faceG = ctx.createLinearGradient(hdX + hr * 0.35, 0, hdX + hr * 0.9, 0);
  faceG.addColorStop(0, mix(C.bone, C.ink, 0.6, 0));
  faceG.addColorStop(0.45, mix(C.ember, C.parchment, 0.55, 0.55));
  faceG.addColorStop(1, mix(C.flame, C.parchment, 0.5, 0.85));
  ctx.fillStyle = faceG;
  ctx.fillRect(hdX + hr * 0.3, hdY - hr * 1.05, hr * 0.6, hr * 2.1);
  // the combed-back hairline between hair and that sliver
  ctx.strokeStyle = shade(C.ink, 0.8, 0.7);
  ctx.lineWidth = Math.max(1, hr * 0.05);
  ctx.beginPath();
  ctx.moveTo(hdX + hr * 0.42, hdY - hr * 0.78);
  ctx.quadraticCurveTo(hdX + hr * 0.62, hdY - hr * 0.2, hdX + hr * 0.5, hdY + hr * 0.55);
  ctx.stroke();
  // strand work — every line follows the comb, crown back and down toward
  // the nape gather; the grey rides the strands, not patches
  ctx.lineCap = "round";
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const a0 = -Math.PI * 0.42 - t * Math.PI * 0.66; // fan: leading crown → back
    const x0 = hdX + Math.cos(a0) * hr * 0.5;
    const y0 = hdY + Math.sin(a0) * hr * 0.6;
    const silver = i % 3 !== 1;
    ctx.strokeStyle = silver
      ? mix(C.boneDim, C.parchment, 0.25 + rand() * 0.3, 0.34 + rand() * 0.14)
      : shade(C.ink, 0.7, 0.5);
    ctx.lineWidth = Math.max(0.8, hr * (0.02 + rand() * 0.018));
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(
      hdX + Math.cos(a0) * hr * (0.95 + rand() * 0.12),
      hdY + Math.sin(a0) * hr * (0.9 + rand() * 0.1),
      hdX - hr * (0.32 + rand() * 0.12),
      hdY + hr * (0.6 + rand() * 0.16),
    );
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.restore(); // ← end head clip
  ctx.fillStyle = mix(C.flame, C.parchment, 0.45, 0.85); // the small certain nose
  ctx.beginPath();
  ctx.moveTo(hdX + hr * 0.76, hdY - hr * 0.06);
  ctx.quadraticCurveTo(hdX + hr * 1.0, hdY + hr * 0.07, hdX + hr * 0.7, hdY + hr * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.35, 0.8); // lit brow-to-jaw edge
  ctx.lineWidth = Math.max(1, s * 0.0018);
  ctx.beginPath();
  ctx.ellipse(hdX, hdY, hr * 0.84, hr, 0.06, -Math.PI * 0.3, Math.PI * 0.3);
  ctx.stroke();
  // the gather at the nape — twenty years of it, wound and carried out
  ctx.fillStyle = mix(C.ink, C.boneDim, 0.36);
  ctx.beginPath();
  ctx.ellipse(hdX - hr * 0.52, hdY + hr * 0.68, hr * 0.19, hr * 0.15, -0.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = mix(C.boneDim, C.parchment, 0.3, 0.4); // silver on the coil
  ctx.lineWidth = Math.max(0.8, hr * 0.03);
  ctx.beginPath();
  ctx.arc(hdX - hr * 0.52, hdY + hr * 0.68, hr * 0.12, Math.PI * 0.7, Math.PI * 1.8);
  ctx.stroke();
  // firelight along the crown — over the top, from the flame she carries
  ctx.strokeStyle = mix(C.flame, C.flameHi, 0.3, 0.6);
  ctx.lineWidth = Math.max(1, s * 0.0016);
  ctx.beginPath();
  ctx.moveTo(hdX + hr * 0.62, hdY - hr * 0.42);
  ctx.quadraticCurveTo(hdX + hr * 0.4, hdY - hr * 0.98, hdX - hr * 0.15, hdY - hr * 1.04);
  ctx.stroke();
  // flyaways, backlit like filament — the climb's small wind in them
  ctx.strokeStyle = mix(C.flameHi, C.parchment, 0.4, 0.4);
  ctx.lineWidth = Math.max(0.6, s * 0.0008);
  for (const [fa, fl] of [
    [-0.7, 0.2],
    [-0.42, 0.16],
    [-0.12, 0.22],
  ] as const) {
    const bx = hdX + Math.cos(fa * Math.PI) * hr * 0.7;
    const by = hdY + Math.sin(fa * Math.PI) * hr * 0.9;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx - hr * fl * 0.5, by - hr * fl, bx - hr * fl * 0.2, by - hr * fl * 1.5);
    ctx.stroke();
  }

  // ── 10. the braid — out of the gather, over the trailing shoulder and
  // down her back, swinging with the stride; exactly the plait meeting4
  // first let out of the hood, singed tip and all
  const brTop = fy - sH * 0.79;
  const brEnd = fy - sH * 0.37;
  const brP = (t: number): [number, number] => {
    const bx = mX - sH * (0.02 + t * 0.15 + Math.sin(t * Math.PI) * 0.03);
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
  // herringbone — alternating diagonals, the way a plait actually sits
  ctx.lineWidth = Math.max(0.8, sH * 0.004);
  let flip = 1;
  for (let t = 0.07; t < 0.88; t += 0.075) {
    const [bx, by] = brP(t);
    const bw2 = sH * 0.011 * (1 - t * 0.45);
    ctx.strokeStyle = flip > 0 ? mix(C.boneDim, C.parchment, 0.25, 0.4) : shade(C.void, 0.9, 0.4);
    line(bx - bw2 * flip, by - bw2 * 0.8, bx + bw2 * flip, by + bw2 * 0.5);
    flip = -flip;
  }
  // a warm thread down its flame side — the light reaching over her shoulder
  ctx.strokeStyle = mix(C.flame, C.flameHi, 0.4, 0.3);
  ctx.lineWidth = Math.max(1, sH * 0.005);
  ctx.beginPath();
  for (let t = 0.08; t < 0.88; t += 0.05) {
    const [bx, by] = brP(t);
    if (t <= 0.09) ctx.moveTo(bx + sH * 0.009, by);
    else ctx.lineTo(bx + sH * 0.009 * (1 - t * 0.4), by);
  }
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  const [tipX, tipY] = brP(1); // the singe — one ember still thinking
  ctx.fillStyle = mix(C.ember, C.flame, 0.45, 0.85);
  ctx.beginPath();
  ctx.arc(tipX, tipY, Math.max(1, sH * 0.008), 0, TAU);
  ctx.fill();

  // ── 11. THE FIRST FLAME, carried — the whole rescue, held in two hands ──
  // (mostly hidden by her body from back here: the fed stub, a bright head
  // past her shoulder, and the light doing the talking)
  ctx.fillStyle = mix(C.parchmentAged, C.ember, 0.3, 0.95); // the stub, warm through
  ctx.beginPath();
  ctx.moveTo(flX - sH * 0.052, flY);
  ctx.quadraticCurveTo(flX - sH * 0.062, flY + sH * 0.05, flX - sH * 0.055, flY + sH * 0.06);
  ctx.lineTo(flX + sH * 0.056, flY + sH * 0.06);
  ctx.quadraticCurveTo(flX + sH * 0.06, flY + sH * 0.02, flX + sH * 0.052, flY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mix(C.flame, C.flameHi, 0.5, 0.95); // molten crown, brimming still
  ctx.beginPath();
  ctx.ellipse(flX, flY, sH * 0.054, sH * 0.014, 0, 0, TAU);
  ctx.fill();
  // her waxen hand under it — translucent, done shielding, only carrying
  ctx.fillStyle = mix(C.parchment, C.flame, 0.24, 0.8);
  ctx.beginPath();
  ctx.ellipse(flX - sH * 0.008, flY + sH * 0.068, sH * 0.062, sH * 0.016, 0.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = shade(C.parchmentAged, 1.05, 0.6);
  ctx.lineWidth = Math.max(0.8, s * 0.001);
  ctx.stroke();
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.4, 0.16); // the ring of her office
  ctx.lineWidth = Math.max(1, s * 0.0016);
  ctx.beginPath();
  ctx.arc(flX, flY - sH * 0.09, sH * 0.075, 0, TAU);
  ctx.stroke();
  drop(flX, flY, sH * 0.2, sH * 0.045, sH * 0.006, shade(C.flame, 1, 0.95));
  drop(flX, flY - sH * 0.006, sH * 0.145, sH * 0.028, sH * 0.003, C.flameHi);
  drop(flX, flY - sH * 0.01, sH * 0.085, sH * 0.014, 0, shade(C.flameHi, 1.65));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(flX, flY - sH * 0.08, 0, flX, flY - sH * 0.08, s * 0.3);
  halo.addColorStop(0, shade(C.flame, 0.9, 0.5));
  halo.addColorStop(0.5, shade(C.ember, 0.85, 0.18));
  halo.addColorStop(1, shade(C.ember, 0.85, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(flX - s * 0.32, flY - sH * 0.08 - s * 0.32, s * 0.64, s * 0.64);
  // the thrown light — a soft reach up the treads toward the ones coming
  const st14 = steps[FI + 6]!;
  const reach = ctx.createLinearGradient(flX, flY, st14.x, st14.y);
  reach.addColorStop(0, mix(C.flame, C.ember, 0.45, 0.085));
  reach.addColorStop(1, mix(C.flame, C.ember, 0.45, 0));
  ctx.fillStyle = reach;
  ctx.beginPath();
  ctx.moveTo(flX + sH * 0.02, flY - sH * 0.12);
  ctx.lineTo(st14.x + st14.run, st14.y - s * 0.085);
  ctx.lineTo(st14.x + st14.run, st14.y - s * 0.002);
  ctx.lineTo(flX + sH * 0.04, flY + sH * 0.04);
  ctx.closePath();
  ctx.fill();
  // sparks going up-stair ahead of her — scouts of the good news
  for (let i = 0; i < 7; i++) {
    const t = rand();
    const px = flX + s * (0.015 + t * 0.11) + Math.sin(i * 2.3 + t * 5) * s * 0.012;
    const py = flY - sH * 0.24 - t * s * 0.1;
    ctx.fillStyle = mix(C.flameHi, C.flame, rand() * 0.5, 0.7 * (1 - t * 0.75));
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.7, s * 0.0012 * (1.4 - t)), 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // ── 12. air — gold motes riding the whole flight; the cold keeps only
  // its corner under the stairs ─────────────────────────────────────────────
  for (let i = 0; i < 30; i++) {
    const mx2 = rand() * w;
    const my2 = h * 0.08 + rand() * h * 0.72;
    const nearFlight = Math.abs(my2 - flightY(mx2)) < s * 0.3;
    ctx.fillStyle = nearFlight
      ? mix(C.flameHi, C.bone, 0.45, 0.06 + rand() * 0.1)
      : mix(C.bone, C.verdigris, 0.35, 0.025 + rand() * 0.045);
    ctx.beginPath();
    ctx.arc(mx2, my2, 0.5 + rand() * 0.9, 0, TAU);
    ctx.fill();
  }

  // ── 13. grain, crush, and a still floor for the caption ─────────────────
  for (let i = 0; i < 480; i++) {
    const gx = rand() * w;
    const gy = rand() * h * 0.8;
    ctx.fillStyle = rand() < 0.6 ? shade(C.bone, 1, 0.012 + rand() * 0.022) : shade(C.void, 0.35, 0.025 + rand() * 0.025);
    ctx.fillRect(gx, gy, 1, 1);
  }
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.14);
  crush.addColorStop(0, shade(C.void, 0.6, 0.5));
  crush.addColorStop(1, shade(C.void, 0.6, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.14);
  // the bottom ~18% settles fully dark — the caption zone stays calm; the
  // lowest steps sink into it, already yesterday's
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
