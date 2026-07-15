/**
 * Story slide 3 — "One dusk, the Vault changed its terms. Its laws now shift
 * with every sunrise. What was safe yesterday kills today."
 *
 * A vast vault-hall of law. The wall of inscription stones recedes in
 * perspective toward a hazy vanishing depth; the last dusk light of
 * *yesterday* rakes in through a high slit and still warms the far tablets,
 * while *today's* cold verdigris rewrite has already claimed the near ones.
 * The focal slab — huge, leaning, nearest the viewer — is caught mid-rewrite:
 * the old warm law flaking off as drifting dust above a searing teal front,
 * strange new marks burning in below it. Mid-floor, beneath a doorway whose
 * ward-rune has turned from calm teal to killing red, a delver lies fallen
 * beside a snuffed lantern. Rune-light pools and reflects across the floor;
 * shattered older tablets litter it.
 *
 * Pure 2D-canvas painting (no Phaser, no assets). Colors only via tokens +
 * shade()/mix(); woodcut ink outlines; three fog stops of depth. The
 * center-bottom of the plate is kept calm and dark for the caption.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG — same idiom as guildhall's hallRand, own seed. Never
// Math.random, never paint.ts crand() (its stream is shared with the
// world-texture painters).
function lawsRand(seed: number): () => number {
  let s = seed >>> 0 || 0x1a35;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

type BayState = "behind" | "shattered" | "struck" | "warmStruck" | "warm";

export function paintLaws(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = lawsRand(0x1a35);
  const inkLine = shade(C.void, 0.7, 0.9);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  const poly = (pts: readonly (readonly [number, number])[]): void => {
    ctx.beginPath();
    const p0 = pts[0]!;
    ctx.moveTo(p0[0], p0[1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
    ctx.closePath();
  };
  /** Angular mark no delver has read before — the Vault's new alphabet. */
  const strangeMark = (mx: number, my: number, s: number, color: string, lw = 1.2): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    const k = Math.floor(rand() * 4);
    if (k === 0) {
      ctx.moveTo(mx - s, my + s);
      ctx.lineTo(mx + s, my - s);
      ctx.moveTo(mx, my - s * 0.4);
      ctx.lineTo(mx + s, my + s * 0.6);
    } else if (k === 1) {
      ctx.moveTo(mx - s, my + s * 0.7);
      ctx.lineTo(mx, my - s);
      ctx.lineTo(mx + s, my + s * 0.7);
    } else if (k === 2) {
      ctx.moveTo(mx - s, my - s);
      ctx.lineTo(mx + s * 0.6, my - s);
      ctx.lineTo(mx + s * 0.6, my + s);
    } else {
      ctx.moveTo(mx - s, my);
      ctx.lineTo(mx + s, my);
      ctx.moveTo(mx + s * 0.2, my - s);
      ctx.lineTo(mx - s * 0.2, my + s);
    }
    ctx.stroke();
  };

  // ── perspective frame ─────────────────────────────────────────────────────
  const vx = w * 0.64; // vanishing point — the hall runs deep to the right
  const vy = h * 0.44;
  const nearX = -w * 0.03;
  const nearTop = -h * 0.14;
  const nearBot = h * 0.85;
  const px = (t: number): number => lerp(nearX, vx, t);
  const pTop = (t: number): number => lerp(nearTop, vy, t);
  const pBot = (t: number): number => lerp(nearBot, vy, t);
  const wallY = (t: number, f: number): number => lerp(pTop(t), pBot(t), f);
  /** 0 = today's cold near wall, 1 = still in yesterday's dusk light. */
  const warmAt = (t: number): number => clamp01((t - 0.42) / 0.3);

  // dusk shaft: a high slit upper-right rakes light down to a floor pool
  const slitX = w * 0.875;
  const poolX = w * 0.628;
  const poolY = h * 0.6;

  // ── 1. base void gradient + a dusk-violet breath in the high right ───────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, shade(C.void, 0.85));
  base.addColorStop(0.42, mix(C.void, C.surface, 0.42));
  base.addColorStop(0.7, mix(C.void, C.surface, 0.2));
  base.addColorStop(1, shade(C.void, 0.72));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const duskAir = ctx.createRadialGradient(slitX, h * 0.05, 0, slitX, h * 0.05, w * 0.42);
  duskAir.addColorStop(0, mix(C.borderVoid, C.ember, 0.35, 0.2));
  duskAir.addColorStop(1, mix(C.borderVoid, C.ember, 0.35, 0));
  ctx.fillStyle = duskAir;
  ctx.fillRect(0, 0, w, h * 0.6);

  // ── 2. deep haze at the vanishing depth — fog stop 1 ─────────────────────
  const deep = ctx.createRadialGradient(vx, vy, 0, vx, vy, w * 0.34);
  deep.addColorStop(0, mix(C.void, C.verdigrisDim, 0.55, 0.2));
  deep.addColorStop(1, mix(C.void, C.verdigrisDim, 0.55, 0));
  ctx.fillStyle = deep;
  ctx.fillRect(vx - w * 0.36, vy - w * 0.36, w * 0.72, w * 0.72);

  // ── 3. the floor plane ────────────────────────────────────────────────────
  const floorG = ctx.createLinearGradient(0, vy, 0, h);
  floorG.addColorStop(0, mix(C.void, C.surface, 0.42));
  floorG.addColorStop(0.34, mix(C.void, C.surface, 0.24));
  floorG.addColorStop(0.72, shade(C.void, 0.88));
  floorG.addColorStop(1, shade(C.void, 0.68));
  ctx.fillStyle = floorG;
  ctx.fillRect(0, vy, w, h - vy);
  // receding flag joints fanning from the depth; they die before the caption
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7;
    const xb = lerp(-w * 0.35, w * 1.45, t);
    ctx.strokeStyle = shade(C.surface2, 1.15, 0.06);
    line(vx, vy + 2, lerp(vx, xb, 0.62), lerp(vy + 2, h * 0.82, 0.62));
  }
  for (const fy of [0.52, 0.62, 0.74] as const) {
    ctx.strokeStyle = shade(C.surface2, 1.12, 0.05);
    line(0, h * fy, w, h * fy);
  }
  // cold mist hugging the far floor
  const mist = ctx.createLinearGradient(0, vy - h * 0.03, 0, vy + h * 0.09);
  mist.addColorStop(0, mix(C.void, C.verdigrisDim, 0.4, 0));
  mist.addColorStop(0.5, mix(C.void, C.verdigrisDim, 0.4, 0.2));
  mist.addColorStop(1, mix(C.void, C.verdigrisDim, 0.4, 0));
  ctx.fillStyle = mist;
  ctx.fillRect(0, vy - h * 0.03, w, h * 0.12);

  // ── 4. far right: sister arches in silhouette, and THE DOORWAY ───────────
  ctx.fillStyle = mix(C.void, C.surface, 0.5);
  for (const [ax, aw2, abase] of [
    [w * 0.795, w * 0.032, h * 0.485],
    [w * 0.9, w * 0.026, h * 0.472],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(ax - aw2, abase);
    ctx.lineTo(ax - aw2, abase - aw2 * 2.1);
    ctx.arc(ax, abase - aw2 * 2.1, aw2, Math.PI, 0);
    ctx.lineTo(ax + aw2, abase);
    ctx.closePath();
    ctx.fill();
  }
  // the doorway that was marked safe: dark opening, ward-rune gone hostile
  const doorX = w * 0.705;
  const doorHw = w * 0.034;
  const doorBase = h * 0.535;
  const doorTop = doorBase - doorHw * 2.4;
  ctx.fillStyle = mix(C.void, C.surface, 0.62);
  ctx.fillRect(doorX - doorHw * 1.6, doorTop - doorHw * 1.9, doorHw * 3.2, doorBase - doorTop + doorHw * 1.9);
  ctx.beginPath();
  ctx.moveTo(doorX - doorHw, doorBase);
  ctx.lineTo(doorX - doorHw, doorTop);
  ctx.arc(doorX, doorTop, doorHw, Math.PI, 0);
  ctx.lineTo(doorX + doorHw, doorBase);
  ctx.closePath();
  ctx.fillStyle = shade(C.void, 0.45);
  ctx.fill();
  ctx.strokeStyle = shade(C.surface2, 1.25, 0.45);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // hostile inner rim breathing out of the dark
  ctx.strokeStyle = mix(C.seal, C.ember, 0.4, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(doorX - doorHw + 2, doorBase);
  ctx.lineTo(doorX - doorHw + 2, doorTop);
  ctx.arc(doorX, doorTop, doorHw - 2, Math.PI, 0);
  ctx.lineTo(doorX + doorHw - 2, doorBase);
  ctx.stroke();
  // the ward-rune: its calm teal ghost still fading, the red truth searing in
  const runeY = doorTop - doorHw * 1.28;
  strangeMark(doorX - doorHw * 0.55, runeY + 1.5, doorHw * 0.3, shade(C.verdigris, 0.95, 0.22));
  const hostile = mix(C.seal, C.ember, 0.45);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const runeGlow = ctx.createRadialGradient(doorX, runeY, 0, doorX, runeY, doorHw * 1.7);
  runeGlow.addColorStop(0, shade(hostile, 0.9, 0.4));
  runeGlow.addColorStop(1, shade(hostile, 0.9, 0));
  ctx.fillStyle = runeGlow;
  ctx.fillRect(doorX - doorHw * 1.8, runeY - doorHw * 1.8, doorHw * 3.6, doorHw * 3.6);
  ctx.restore();
  strangeMark(doorX + doorHw * 0.12, runeY, doorHw * 0.42, shade(hostile, 1.35, 0.95), 1.6);
  // its kill-light spilled down the floor toward the fallen
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const redStreak = ctx.createLinearGradient(0, doorBase, 0, h * 0.685);
  redStreak.addColorStop(0, shade(hostile, 0.85, 0.2));
  redStreak.addColorStop(1, shade(hostile, 0.85, 0));
  ctx.fillStyle = redStreak;
  poly([
    [doorX - doorHw * 0.8, doorBase],
    [doorX + doorHw * 0.8, doorBase],
    [doorX + doorHw * 1.7, h * 0.69],
    [doorX - doorHw * 5.4, h * 0.69],
  ]);
  ctx.fill();
  ctx.restore();

  // ── 5. THE LAW-WALL — receding bays of inscription stones ────────────────
  const tEnd = 0.94;
  const backing = ctx.createLinearGradient(px(0), 0, px(tEnd), 0);
  backing.addColorStop(0, mix(C.void, C.surface, 0.52));
  backing.addColorStop(0.55, mix(C.void, C.surface, 0.44));
  backing.addColorStop(1, mix(C.void, C.surface, 0.3));
  ctx.fillStyle = backing;
  poly([
    [px(0), pTop(0)],
    [px(tEnd), pTop(tEnd)],
    [px(tEnd), pBot(tEnd)],
    [px(0), pBot(0)],
  ]);
  ctx.fill();
  ctx.strokeStyle = inkLine;
  ctx.lineWidth = 1.5;
  line(px(0), pBot(0), px(tEnd), pBot(tEnd));
  ctx.strokeStyle = shade(C.surface2, 1.3, 0.25);
  ctx.lineWidth = 1;
  line(px(0), pBot(0) - 2, px(tEnd), pBot(tEnd) - 1);
  // a high cornice line
  ctx.strokeStyle = shade(C.surface2, 1.2, 0.2);
  line(px(0), wallY(0, 0.06), px(tEnd), wallY(tEnd, 0.06));

  // faint carved dashes along a line — the old law, foreshortened
  const dashRow = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    color: string,
    alpha: number,
    frag: number,
  ): void => {
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 8) return;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    let d = len * 0.07;
    ctx.lineWidth = 1;
    while (d < len * 0.93) {
      const dw = len * (0.035 + rand() * 0.06);
      const isFrag = rand() < frag;
      if (rand() > 0.16) {
        const jy = isFrag ? (rand() - 0.5) * 3 : 0;
        const a = alpha * (0.5 + rand() * 0.5) * (isFrag ? 0.55 : 1);
        ctx.strokeStyle = shade(color, 0.9 + rand() * 0.25, a);
        ctx.beginPath();
        ctx.moveTo(ax + ux * d, ay + uy * d + jy);
        ctx.lineTo(ax + ux * (d + dw * (isFrag ? 0.45 : 1)), ay + uy * (d + dw) + jy);
        ctx.stroke();
      }
      d += dw + len * (0.02 + rand() * 0.03);
    }
  };

  const bays: readonly (readonly [number, number, BayState])[] = [
    [0.03, 0.24, "behind"],
    [0.285, 0.44, "shattered"],
    [0.485, 0.605, "struck"],
    [0.64, 0.73, "warmStruck"],
    [0.758, 0.824, "warm"],
    [0.848, 0.9, "warm"],
  ];

  for (const [ta, tb, state] of bays) {
    const warm = warmAt((ta + tb) / 2);
    const xa = px(ta);
    const xb = px(tb);
    const yTa = wallY(ta, 0.16);
    const yTb = wallY(tb, 0.17);
    const yBa = wallY(ta, 0.83);
    const yBb = wallY(tb, 0.82);
    const peak = (xb - xa) * 0.07;
    const tabletPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(xa, yBa);
      if (state === "shattered") {
        // the crown is gone — a jagged bite where the stone sheared
        ctx.lineTo(xa, yTa + (yBa - yTa) * 0.18);
        const steps = 5;
        for (let i = 1; i <= steps; i++) {
          const f = i / steps;
          const jx = lerp(xa, xb, f);
          const jy = lerp(yTa + (yBa - yTa) * 0.18, yTb + (yBb - yTb) * 0.34, f) + (rand() - 0.5) * (yBa - yTa) * 0.14;
          ctx.lineTo(jx, jy);
        }
      } else {
        ctx.lineTo(xa, yTa);
        ctx.quadraticCurveTo((xa + xb) / 2, (yTa + yTb) / 2 - peak, xb, yTb);
      }
      ctx.lineTo(xb, yBb);
      ctx.closePath();
    };
    // stone body — cold verdigris cast near, yesterday's ember warmth far
    const bodyCold = mix(C.surface2, C.verdigrisDim, 0.09);
    const bodyWarm = mix(C.surface2, C.ember, 0.16);
    const body = ctx.createLinearGradient(0, Math.min(yTa, yTb), 0, Math.max(yBa, yBb));
    body.addColorStop(0, shade(mix(bodyCold, bodyWarm, warm), 0.8));
    body.addColorStop(1, shade(mix(bodyCold, bodyWarm, warm), 0.52));
    tabletPath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = inkLine;
    ctx.lineWidth = Math.max(0.8, 1.8 * (1 - ta));
    ctx.stroke();
    // rim light: dusk kisses the far edge, the rewrite chills the near one
    ctx.lineWidth = 1;
    ctx.strokeStyle = mix(C.flame, C.parchmentAged, 0.4, 0.1 + warm * 0.28);
    line(xb, yTb + 1, xb, yBb - 1);
    if (warm < 0.5) {
      ctx.strokeStyle = shade(C.verdigris, 1.05, 0.3 * (1 - warm));
      line(xa, yTa + 1, xa, yBa - 1);
    }
    if (state === "behind") continue; // mostly hidden behind the focal slab
    // ranked rows of the old law
    const glyphCol = warm > 0.4 ? mix(C.parchmentAged, C.ember, 0.15) : mix(C.bone, C.surface2, 0.25);
    const rowsN = state === "shattered" ? 3 : 4;
    const f0 = state === "shattered" ? 0.46 : 0.3;
    const struckRows: number[] = [];
    for (let r = 0; r < rowsN; r++) {
      const f = f0 + (r * (0.78 - f0)) / rowsN;
      const inset = (xb - xa) * 0.12;
      dashRow(
        xa + inset,
        lerp(wallY(ta, 0.16), wallY(ta, 0.83), f),
        xb - inset,
        lerp(wallY(tb, 0.17), wallY(tb, 0.82), f),
        glyphCol,
        0.46 + warm * 0.18,
        state === "struck" || state === "warmStruck" ? 0.25 : 0.08,
      );
      if ((state === "struck" && (r === 1 || r === 2)) || (state === "warmStruck" && r === 1)) struckRows.push(f);
    }
    // today's law crossing out yesterday's — a searing strike through the rows
    for (const f of struckRows) {
      const sy0 = lerp(wallY(ta, 0.16), wallY(ta, 0.83), f) + 1;
      const sy1 = lerp(wallY(tb, 0.17), wallY(tb, 0.82), f) - 2;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = shade(C.verdigris, 0.9, 0.18);
      ctx.lineWidth = 3.5;
      line(xa + (xb - xa) * 0.06, sy0, xb - (xb - xa) * 0.05, sy1);
      ctx.restore();
      ctx.strokeStyle = shade(C.verdigris, 1.3, 0.7);
      ctx.lineWidth = 1.1;
      line(xa + (xb - xa) * 0.06, sy0, xb - (xb - xa) * 0.05, sy1);
    }
    if (state === "shattered") {
      // spalled shards heaped at its foot
      ctx.fillStyle = shade(C.void, 0.62);
      for (let i = 0; i < 4; i++) {
        const sx = lerp(xa, xb, 0.15 + rand() * 0.7);
        const sy = lerp(yBa, yBb, 0.4) + (rand() - 0.2) * h * 0.02;
        const ss = (xb - xa) * (0.05 + rand() * 0.08);
        poly([
          [sx, sy],
          [sx + ss, sy - ss * 0.5],
          [sx + ss * 1.5, sy + ss * 0.35],
        ]);
        ctx.fill();
      }
      // dust still sifting off the broken crown
      for (let i = 0; i < 12; i++) {
        const mx2 = lerp(xa, xb, rand());
        const my2 = lerp(yTa, yBa, 0.22 + rand() * 0.2) - rand() * h * 0.04;
        ctx.fillStyle = mix(C.bone, C.verdigrisDim, rand() * 0.6, 0.1 + rand() * 0.2);
        ctx.fillRect(mx2, my2, 1 + rand(), 1 + rand());
      }
    }
  }

  // columns between bays, rising past the cornice — silhouette architecture
  for (let i = 0; i < bays.length - 1; i++) {
    const tg0 = bays[i]![1];
    const tg1 = bays[i + 1]![0];
    const rise = (pBot(tg0) - pTop(tg0)) * 0.06;
    ctx.fillStyle = mix(C.void, C.surface, 0.3);
    poly([
      [px(tg0), pTop(tg0) - rise],
      [px(tg1), pTop(tg1) - rise * 0.9],
      [px(tg1), pBot(tg1)],
      [px(tg0), pBot(tg0)],
    ]);
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 0.75, 0.7);
    ctx.lineWidth = 1;
    line(px(tg0), pTop(tg0) - rise, px(tg0), pBot(tg0));
    // capital notch
    ctx.strokeStyle = shade(C.surface2, 1.25, 0.22);
    line(px(tg0), wallY(tg0, 0.1), px(tg1), wallY(tg1, 0.1));
    // the shaft of the column climbs on, fading into the upper dark
    const climb = ctx.createLinearGradient(0, pTop(tg0) - rise, 0, pTop(tg0) - rise * 7);
    climb.addColorStop(0, mix(C.void, C.surface, 0.3, 0.7));
    climb.addColorStop(1, mix(C.void, C.surface, 0.3, 0));
    ctx.fillStyle = climb;
    ctx.fillRect(px(tg0), pTop(tg0) - rise * 7, px(tg1) - px(tg0), rise * 7);
  }

  // yesterday's dusk still rakes the far half of the wall
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const duskWash = ctx.createLinearGradient(px(0.42), 0, px(tEnd), 0);
  duskWash.addColorStop(0, shade(C.ember, 0.6, 0));
  duskWash.addColorStop(0.6, shade(C.ember, 0.6, 0.07));
  duskWash.addColorStop(1, shade(C.flame, 0.6, 0.13));
  ctx.fillStyle = duskWash;
  poly([
    [px(0.42), pTop(0.42) - h * 0.06],
    [px(tEnd), pTop(tEnd) - h * 0.02],
    [px(tEnd), pBot(tEnd)],
    [px(0.42), pBot(0.42)],
  ]);
  ctx.fill();
  ctx.restore();

  // each bay's light kneels onto the floor below it — warm far, teal near
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [ta, tb] of bays) {
    const tm = (ta + tb) / 2;
    const warm = warmAt(tm);
    const rx0 = px(ta) + (px(tb) - px(ta)) * 0.18;
    const rx1 = px(tb) - (px(tb) - px(ta)) * 0.18;
    const ry0 = pBot(tm) + 1;
    const rDepth = h * (0.045 + 0.045 * (1 - tm));
    const rc = warm > 0.4 ? mix(C.ember, C.flame, 0.35) : mix(C.void, C.verdigris, 0.6);
    const rg = ctx.createLinearGradient(0, ry0, 0, ry0 + rDepth);
    rg.addColorStop(0, shade(rc, 0.7, warm > 0.4 ? 0.1 : 0.09));
    rg.addColorStop(1, shade(rc, 0.7, 0));
    ctx.fillStyle = rg;
    poly([
      [rx0, ry0],
      [rx1, ry0],
      [rx1 + (rx1 - rx0) * 0.22, ry0 + rDepth],
      [rx0 - (rx1 - rx0) * 0.22, ry0 + rDepth],
    ]);
    ctx.fill();
  }
  ctx.restore();

  // a fallen tablet, slumped from the wall onto the floor
  const fbx = px(0.475) + w * 0.028;
  const fby = pBot(0.44) + h * 0.018;
  const ftx = px(0.505) - w * 0.004;
  const fty = wallY(0.505, 0.42);
  const fnx = (fty - fby) * 0.06;
  const fny = (fbx - ftx) * 0.14;
  const fallenBody = ctx.createLinearGradient(fbx, fby, ftx, fty);
  fallenBody.addColorStop(0, shade(mix(C.surface2, C.verdigrisDim, 0.08), 0.9));
  fallenBody.addColorStop(1, shade(mix(C.surface2, C.verdigrisDim, 0.08), 0.62));
  poly([
    [fbx - fnx * 3.2, fby - fny * 0.9],
    [ftx - fnx * 2.2, fty - fny * 0.7],
    [ftx + fnx * 2.2, fty + fny * 0.7],
    [fbx + fnx * 3.2, fby + fny * 0.9],
  ]);
  ctx.fillStyle = fallenBody;
  ctx.fill();
  ctx.strokeStyle = inkLine;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  dashRow(fbx - fnx, fby - fny * 0.2, ftx - fnx * 0.6, fty - fny * 0.1, mix(C.bone, C.surface2, 0.4), 0.24, 0.3);
  ctx.fillStyle = shade(C.void, 0.6);
  poly([
    [fbx - fnx * 3.4, fby + fny],
    [fbx + fnx * 4, fby + fny * 1.3],
    [fbx + fnx, fby + fny * 2.6],
  ]);
  ctx.fill();

  // ── 6. THE DUSK SHAFT — yesterday's light, entering for the last time ────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const shaftG = ctx.createLinearGradient(slitX, 0, poolX, poolY);
  shaftG.addColorStop(0, shade(C.flameHi, 0.85, 0.17));
  shaftG.addColorStop(0.45, shade(C.flame, 0.75, 0.1));
  shaftG.addColorStop(0.82, mix(C.ember, C.borderVoid, 0.45, 0.05));
  shaftG.addColorStop(1, mix(C.ember, C.borderVoid, 0.45, 0));
  ctx.fillStyle = shaftG;
  poly([
    [slitX - w * 0.022, -h * 0.02],
    [slitX + w * 0.03, -h * 0.02],
    [poolX + w * 0.1, poolY + h * 0.012],
    [poolX - w * 0.085, poolY],
  ]);
  ctx.fill();
  // inner bright streak
  const shaftCore = ctx.createLinearGradient(slitX, 0, poolX, poolY);
  shaftCore.addColorStop(0, shade(C.flameHi, 1, 0.14));
  shaftCore.addColorStop(1, shade(C.flameHi, 1, 0));
  ctx.fillStyle = shaftCore;
  poly([
    [slitX - w * 0.004, -h * 0.02],
    [slitX + w * 0.012, -h * 0.02],
    [poolX + w * 0.045, poolY],
    [poolX - w * 0.01, poolY - h * 0.004],
  ]);
  ctx.fill();
  // violet fringe on the shaft's shadow side — dusk, not noon
  const fringe = ctx.createLinearGradient(slitX, 0, poolX, poolY);
  fringe.addColorStop(0, mix(C.borderVoid, C.ember, 0.25, 0.1));
  fringe.addColorStop(1, mix(C.borderVoid, C.ember, 0.25, 0));
  ctx.fillStyle = fringe;
  poly([
    [slitX - w * 0.038, -h * 0.02],
    [slitX - w * 0.02, -h * 0.02],
    [poolX - w * 0.082, poolY],
    [poolX - w * 0.11, poolY - h * 0.006],
  ]);
  ctx.fill();
  // striations inside the beam — dust breaking the light into threads
  for (const [off, aa] of [
    [-0.55, 0.09],
    [-0.15, 0.06],
    [0.3, 0.08],
    [0.7, 0.05],
  ] as const) {
    const rg2 = ctx.createLinearGradient(slitX, 0, poolX, poolY);
    rg2.addColorStop(0, shade(C.flameHi, 0.9, aa));
    rg2.addColorStop(0.75, shade(C.flame, 0.8, aa * 0.5));
    rg2.addColorStop(1, shade(C.flame, 0.8, 0));
    ctx.strokeStyle = rg2;
    ctx.lineWidth = 1.4;
    line(slitX + off * w * 0.016, -h * 0.02, poolX + off * w * 0.075, poolY - h * 0.004);
  }
  // warm pool where it lands
  ctx.translate(poolX, poolY);
  ctx.scale(1, 0.3);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.14);
  pool.addColorStop(0, shade(C.flame, 0.68, 0.38));
  pool.addColorStop(0.55, shade(C.ember, 0.6, 0.15));
  pool.addColorStop(1, shade(C.ember, 0.5, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-w * 0.145, -w * 0.145, w * 0.29, w * 0.29);
  ctx.restore();
  // the slit itself, white-hot at the crown of the hall
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const slitHalo = ctx.createRadialGradient(slitX, h * 0.035, 0, slitX, h * 0.035, w * 0.05);
  slitHalo.addColorStop(0, shade(C.flameHi, 0.9, 0.4));
  slitHalo.addColorStop(1, shade(C.flameHi, 0.9, 0));
  ctx.fillStyle = slitHalo;
  ctx.fillRect(slitX - w * 0.055, -w * 0.02, w * 0.11, w * 0.1);
  ctx.restore();
  ctx.fillStyle = shade(C.flameHi, 1.05, 0.9);
  poly([
    [slitX - w * 0.0035, 0],
    [slitX + w * 0.007, 0],
    [slitX - w * 0.001, h * 0.082],
    [slitX - w * 0.009, h * 0.076],
  ]);
  ctx.fill();
  // dust adrift in the beam — the day's last motes
  for (let i = 0; i < 30; i++) {
    const s = Math.pow(rand(), 1.15);
    const lat = (rand() - 0.5) * lerp(w * 0.028, w * 0.16, s);
    const mx2 = lerp(slitX, poolX, s) + lat;
    const my2 = lerp(h * 0.01, poolY, s) + (rand() - 0.5) * h * 0.02;
    const a = (1 - s * 0.55) * (0.12 + rand() * 0.3);
    ctx.fillStyle = rand() < 0.7 ? shade(C.flameHi, 0.95, a) : mix(C.parchmentAged, C.ember, 0.4, a);
    const ms = 0.6 + rand() * 1.5;
    ctx.fillRect(mx2 - ms / 2, my2 - ms / 2, ms, ms);
  }
  // re-punch the doorway through the beam: its dark is deeper than any dusk
  ctx.beginPath();
  ctx.moveTo(doorX - doorHw + 1, doorBase);
  ctx.lineTo(doorX - doorHw + 1, doorTop);
  ctx.arc(doorX, doorTop, doorHw - 1, Math.PI, 0);
  ctx.lineTo(doorX + doorHw - 1, doorBase);
  ctx.closePath();
  ctx.fillStyle = shade(C.void, 0.42);
  ctx.fill();
  const doorHeat = ctx.createLinearGradient(0, doorBase, 0, doorTop - doorHw);
  doorHeat.addColorStop(0, shade(hostile, 0.75, 0.3));
  doorHeat.addColorStop(0.5, shade(hostile, 0.7, 0.08));
  doorHeat.addColorStop(1, shade(hostile, 0.7, 0));
  ctx.fillStyle = doorHeat;
  ctx.fill();
  ctx.strokeStyle = mix(C.seal, C.ember, 0.4, 0.5);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // ── 7. the fallen delver — safe yesterday, dead at the door today ────────
  const ex = w * 0.582;
  const ey = h * 0.652;
  const L = w * 0.085;
  // the light he died in — pooled BEHIND him, toward the door, so his dark
  // silhouette reads against lit floor instead of sitting on the glow
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(ex + L * 0.62, ey - L * 0.12);
  ctx.scale(1, 0.32);
  const deathLit = ctx.createRadialGradient(0, 0, 0, 0, 0, L * 2.05);
  deathLit.addColorStop(0, shade(C.flame, 0.62, 0.38));
  deathLit.addColorStop(0.55, mix(C.ember, hostile, 0.5, 0.15));
  deathLit.addColorStop(1, shade(C.ember, 0.5, 0));
  ctx.fillStyle = deathLit;
  ctx.fillRect(-L * 2.1, -L * 2.1, L * 4.2, L * 4.2);
  ctx.restore();
  // long soft shadow cast away from the pool light
  const shadowG = ctx.createLinearGradient(ex, ey, ex - L * 2.4, ey + h * 0.075);
  shadowG.addColorStop(0, shade(C.void, 0.5, 0.5));
  shadowG.addColorStop(1, shade(C.void, 0.55, 0));
  ctx.fillStyle = shadowG;
  poly([
    [ex - L * 0.5, ey + 2],
    [ex + L * 0.42, ey + 3],
    [ex - L * 1.5, ey + h * 0.085],
    [ex - L * 2.6, ey + h * 0.07],
  ]);
  ctx.fill();
  // the body — prone, one knee still bent from the fall, arm flung toward
  // the doorway that lied
  const silh = mix(C.ink, C.void, 0.55);
  ctx.fillStyle = silh;
  ctx.beginPath();
  ctx.moveTo(ex - L * 0.56, ey + 1); // boot tips
  ctx.quadraticCurveTo(ex - L * 0.47, ey - L * 0.14, ex - L * 0.33, ey - L * 0.16); // bent knee
  ctx.quadraticCurveTo(ex - L * 0.22, ey - L * 0.165, ex - L * 0.13, ey - L * 0.1); // hip
  ctx.quadraticCurveTo(ex - L * 0.04, ey - L * 0.075, ex + L * 0.05, ey - L * 0.12); // waist dip
  ctx.quadraticCurveTo(ex + L * 0.13, ey - L * 0.25, ex + L * 0.3, ey - L * 0.18); // shoulder
  ctx.quadraticCurveTo(ex + L * 0.44, ey - L * 0.12, ex + L * 0.46, ey - L * 0.02);
  ctx.lineTo(ex + L * 0.46, ey + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = inkLine;
  ctx.lineWidth = 1;
  ctx.stroke();
  // the trailing shin, unfolded behind the knee
  ctx.strokeStyle = silh;
  ctx.lineWidth = Math.max(1.6, L * 0.042);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ex - L * 0.36, ey - L * 0.12);
  ctx.quadraticCurveTo(ex - L * 0.5, ey - L * 0.05, ex - L * 0.62, ey - L * 0.01);
  ctx.stroke();
  ctx.lineCap = "butt";
  // head, fallen forward
  ctx.fillStyle = silh;
  ctx.beginPath();
  ctx.arc(ex + L * 0.52, ey - L * 0.055, L * 0.085, 0, Math.PI * 2);
  ctx.fill();
  // outstretched arm and open hand
  ctx.strokeStyle = silh;
  ctx.lineWidth = Math.max(1.6, L * 0.05);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ex + L * 0.34, ey - L * 0.1);
  ctx.quadraticCurveTo(ex + L * 0.62, ey - L * 0.02, ex + L * 0.78, ey);
  ctx.stroke();
  ctx.lineCap = "butt";
  // rim light: warm from the pool above, a red accusation from the door
  ctx.strokeStyle = mix(C.flame, C.parchmentAged, 0.35, 0.8);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(ex + L * 0.02, ey - L * 0.105);
  ctx.quadraticCurveTo(ex + L * 0.13, ey - L * 0.26, ex + L * 0.32, ey - L * 0.17);
  ctx.stroke();
  ctx.beginPath(); // the knee catches it too
  ctx.moveTo(ex - L * 0.45, ey - L * 0.125);
  ctx.quadraticCurveTo(ex - L * 0.33, ey - L * 0.175, ex - L * 0.2, ey - L * 0.15);
  ctx.stroke();
  ctx.strokeStyle = shade(hostile, 1.3, 0.85);
  ctx.beginPath();
  ctx.moveTo(ex + L * 0.42, ey - L * 0.135);
  ctx.quadraticCurveTo(ex + L * 0.56, ey - L * 0.1, ex + L * 0.64, ey - L * 0.03);
  ctx.stroke();
  // the snuffed lantern, rolled from the open hand
  const lx = ex + L * 0.92;
  const ly = ey - L * 0.015;
  ctx.strokeStyle = mix(C.ink, C.void, 0.4);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(lx, ly, L * 0.07, Math.PI * 0.15, Math.PI * 1.6);
  ctx.stroke();
  ctx.fillStyle = shade(C.ember, 0.85, 0.4); // one dying coal inside
  ctx.fillRect(lx - 1, ly + 1, 1.6, 1.6);
  ctx.strokeStyle = shade(C.bone, 0.9, 0.22); // the smoke of a snuffed flame
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lx + 1, ly - L * 0.07);
  ctx.bezierCurveTo(lx - L * 0.06, ly - L * 0.2, lx + L * 0.08, ly - L * 0.28, lx - L * 0.02, ly - L * 0.42);
  ctx.stroke();

  // ── 8. shards of older law scattered across the mid-floor ────────────────
  const shards: readonly (readonly [number, number, number, number])[] = [
    [w * 0.37, h * 0.685, w * 0.022, 0.3],
    [w * 0.475, h * 0.73, w * 0.028, -0.2],
    [w * 0.555, h * 0.66, w * 0.016, 0.7],
    [w * 0.775, h * 0.63, w * 0.02, 0.1],
    [w * 0.31, h * 0.76, w * 0.024, -0.5],
    [w * 0.105, h * 0.79, w * 0.03, 0.45],
    [w * 0.2, h * 0.772, w * 0.025, -0.15],
    [w * 0.665, h * 0.7, w * 0.018, 0.55],
  ];
  for (const [sx, sy, ss, rot] of shards) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.fillStyle = shade(mix(C.surface2, C.void, 0.35), 0.95);
    poly([
      [-ss, ss * 0.28],
      [-ss * 0.3, -ss * 0.4],
      [ss * 0.9, -ss * 0.18],
      [ss * 0.65, ss * 0.34],
    ]);
    ctx.fill();
    ctx.strokeStyle = inkLine;
    ctx.lineWidth = 1;
    ctx.stroke();
    // lit edge: teal where the rewrite reaches, ember where the dusk does
    const warmSide = sx > w * 0.52;
    ctx.strokeStyle = warmSide ? mix(C.ember, C.flame, 0.4, 0.55) : shade(C.verdigris, 1.05, 0.45);
    line(-ss * 0.3, -ss * 0.4, ss * 0.9, -ss * 0.18);
    if (ss > w * 0.018) dashRow(-ss * 0.7, ss * 0.05, ss * 0.6, -ss * 0.08, mix(C.bone, C.surface2, 0.4), 0.2, 0.4);
    ctx.restore();
  }

  // ── 9. THE FOCAL SLAB — the law rewriting itself before your eyes ────────
  const ftw = Math.min(w * 0.27, h * 0.42);
  const fth = ftw * 1.52;
  const fcx = w * 0.185;
  const fbase = h * 0.72;
  ctx.save();
  ctx.translate(fcx, fbase - fth / 2);
  ctx.rotate(-0.05);
  const xL = -ftw / 2;
  const xR = ftw / 2;
  const yT = -fth / 2;
  const yB = fth / 2;
  const slabPath = (): void => {
    ctx.beginPath();
    ctx.moveTo(xL, yB);
    ctx.lineTo(xL, yT + ftw * 0.12);
    ctx.quadraticCurveTo(0, yT - ftw * 0.075, xR, yT + ftw * 0.12);
    ctx.lineTo(xR, yB);
    ctx.closePath();
  };
  const slabBody = ctx.createLinearGradient(0, yT, 0, yB);
  slabBody.addColorStop(0, shade(mix(C.surface2, C.verdigrisDim, 0.11), 0.95));
  slabBody.addColorStop(0.55, shade(mix(C.surface2, C.verdigrisDim, 0.09), 0.78));
  slabBody.addColorStop(1, shade(mix(C.surface2, C.verdigrisDim, 0.07), 0.58));
  slabPath();
  ctx.fillStyle = slabBody;
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.65, 0.95);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // inner bevel + crown light
  ctx.strokeStyle = mix(C.surface2, C.bone, 0.3, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xL + 5, yB - 4);
  ctx.lineTo(xL + 5, yT + ftw * 0.14);
  ctx.quadraticCurveTo(0, yT - ftw * 0.04, xR - 5, yT + ftw * 0.14);
  ctx.stroke();
  // dusk still touches its far shoulder — a last warm kiss
  ctx.strokeStyle = mix(C.flame, C.ember, 0.35, 0.45);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(xR - 1.2, yT + ftw * 0.13);
  ctx.lineTo(xR - 1.2, yT + fth * 0.52);
  ctx.stroke();

  // the searing front, upper-left to mid-right
  const frontPts: [number, number][] = [];
  for (let i = 0; i <= 9; i++) {
    const f = i / 9;
    frontPts.push([
      lerp(xL + ftw * 0.03, xR - ftw * 0.03, f),
      lerp(-fth * 0.085, fth * 0.015, f) + (rand() - 0.5) * ftw * 0.026,
    ]);
  }
  const frontYat = (x: number): number => {
    const f = clamp01((x - (xL + ftw * 0.03)) / (ftw * 0.94));
    const i = Math.min(8, Math.floor(f * 9));
    const p0 = frontPts[i]!;
    const p1 = frontPts[i + 1]!;
    return lerp(p0[1], p1[1], f * 9 - i);
  };

  ctx.save();
  slabPath();
  ctx.clip();
  // yesterday's warmth still remembered in the unrewritten upper stone
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const memory = ctx.createLinearGradient(xR, yT, xL * 0.4, yT + fth * 0.55);
  memory.addColorStop(0, shade(C.ember, 0.6, 0.2));
  memory.addColorStop(1, shade(C.ember, 0.6, 0));
  ctx.fillStyle = memory;
  ctx.fillRect(xL, yT, ftw, fth * 0.62);
  ctx.restore();
  // OLD LAW above the front: warm-boned rows, fraying as they near it
  for (let r = 0; r < 6; r++) {
    const gy = yT + fth * (0.14 + r * 0.075);
    const nearFront = clamp01(1 - (frontYat(0) - gy) / (fth * 0.24));
    dashRow(
      xL + ftw * 0.11,
      gy,
      xR - ftw * 0.11,
      gy,
      mix(C.parchmentAged, C.ember, 0.22),
      0.78 - nearFront * 0.18,
      0.06 + nearFront * 0.4,
    );
  }
  // yesterday's whole decree canceled the way a scribe kills a page — one
  // long diagonal slash and a counter-stroke, a great X over the old rows
  const drawSlash = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    coreA: number,
    waveSeed: number,
  ): void => {
    const slashPts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      slashPts.push([
        lerp(ax, bx, f) + (rand() - 0.5) * 2,
        lerp(ay, by, f) + Math.sin(f * 8.2 + waveSeed) * ftw * 0.009 + (rand() - 0.5) * 2,
      ]);
    }
    const stroke = (lw: number, aa: number, bright: number): void => {
      ctx.lineWidth = lw;
      ctx.strokeStyle = shade(C.verdigris, bright, aa);
      ctx.beginPath();
      ctx.moveTo(slashPts[0]![0], slashPts[0]![1]);
      for (const [qx, qy] of slashPts) ctx.lineTo(qx, qy);
      ctx.stroke();
    };
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    stroke(5, 0.15, 0.9);
    ctx.restore();
    stroke(1.4, coreA, 1.35);
  };
  drawSlash(xL + ftw * 0.09, yT + fth * 0.36, xR - ftw * 0.08, yT + fth * 0.135, 0.8, 1.7);
  drawSlash(xL + ftw * 0.14, yT + fth * 0.15, xR - ftw * 0.16, yT + fth * 0.37, 0.55, 4.1);
  // the law leaving: warm letter-embers lifting off just above the front
  for (let i = 0; i < 30; i++) {
    const fxr = rand();
    const mx2 = lerp(xL + ftw * 0.08, xR - ftw * 0.08, fxr);
    const lift = Math.pow(rand(), 1.6) * fth * 0.2;
    const my2 = frontYat(mx2) - ftw * 0.02 - lift;
    const a = (0.2 + rand() * 0.4) * (1 - lift / (fth * 0.22));
    ctx.fillStyle = mix(C.parchmentAged, C.ember, 0.3, Math.max(0, a));
    if (rand() < 0.45) ctx.fillRect(mx2, my2, 2 + rand() * 3, 1); // letter fragments
    else ctx.fillRect(mx2, my2, 1 + rand(), 1 + rand());
  }
  // the rewritten stone below the front: newer, colder, darker
  ctx.beginPath();
  const fp0 = frontPts[0]!;
  ctx.moveTo(fp0[0] - 4, fp0[1]);
  for (const [fx2, fy2] of frontPts) ctx.lineTo(fx2, fy2);
  ctx.lineTo(xR + 4, frontPts[frontPts.length - 1]![1]);
  ctx.lineTo(xR + 4, yB + 4);
  ctx.lineTo(xL - 4, yB + 4);
  ctx.closePath();
  ctx.fillStyle = mix(shade(C.void, 0.9), C.verdigrisDim, 0.22, 0.42);
  ctx.fill();
  // cold ambient rising from the rewritten half
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rewriteGlow = ctx.createRadialGradient(-ftw * 0.04, fth * 0.2, 0, -ftw * 0.04, fth * 0.2, ftw * 0.72);
  rewriteGlow.addColorStop(0, mix(C.void, C.verdigris, 0.65, 0.14));
  rewriteGlow.addColorStop(1, mix(C.void, C.verdigris, 0.65, 0));
  ctx.fillStyle = rewriteGlow;
  ctx.fillRect(xL, yT, ftw, fth);
  ctx.restore();
  // NEW LAW below the front: strange ranked marks, freshest nearest the seam
  for (let r = 0; r < 5; r++) {
    const gy = fth * (0.13 + r * 0.075) + (rand() - 0.5) * fth * 0.016;
    const fresh = 1 - r / 5;
    for (let c = 0; c < 6; c++) {
      const mx2 = xL + ftw * (0.15 + c * 0.14) + (rand() - 0.5) * ftw * 0.045;
      if (gy < frontYat(mx2) + fth * 0.035) continue;
      const s = ftw * (0.023 + rand() * 0.009);
      if (fresh > 0.6 && rand() < 0.5) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const mg = ctx.createRadialGradient(mx2, gy, 0, mx2, gy, s * 2.5);
        mg.addColorStop(0, shade(C.verdigris, 0.9, 0.15));
        mg.addColorStop(1, shade(C.verdigris, 0.9, 0));
        ctx.fillStyle = mg;
        ctx.fillRect(mx2 - s * 3.2, gy - s * 3.2, s * 6.4, s * 6.4);
        ctx.restore();
      }
      strangeMark(mx2, gy, s, shade(C.verdigris, 0.95 + fresh * 0.4, 0.4 + fresh * 0.5), 1.3);
    }
  }
  // the seam itself: a burning edge eating up the stone
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const f0 = frontPts[0]!;
  for (const [lw2, aa2] of [
    [13, 0.08],
    [6, 0.2],
  ] as const) {
    ctx.strokeStyle = shade(C.verdigris, 0.95, aa2);
    ctx.lineWidth = lw2;
    ctx.beginPath();
    ctx.moveTo(f0[0], f0[1]);
    for (const [fx2, fy2] of frontPts) ctx.lineTo(fx2, fy2);
    ctx.stroke();
  }
  ctx.restore();
  // core of the burn, guttering brighter and dimmer along its length
  ctx.lineWidth = 1.5;
  for (let i = 0; i < frontPts.length - 1; i++) {
    const p0 = frontPts[i]!;
    const p1 = frontPts[i + 1]!;
    ctx.strokeStyle = shade(C.verdigris, 1.3 + rand() * 0.4, 0.55 + rand() * 0.45);
    line(p0[0], p0[1], p1[0], p1[1]);
  }
  // sparks riding the seam
  for (let i = 0; i < 14; i++) {
    const p = frontPts[Math.floor(rand() * frontPts.length)]!;
    ctx.fillStyle = shade(C.verdigris, 1.3 + rand() * 0.4, 0.5 + rand() * 0.5);
    ctx.fillRect(p[0] + (rand() - 0.5) * 8, p[1] + (rand() - 0.5) * 6, 1 + rand(), 1 + rand());
  }
  // a hairline crack from the base — the stone protests the new terms
  let ccx = xL + ftw * 0.34;
  ctx.strokeStyle = shade(C.void, 0.5, 0.9);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(ccx, yB);
  for (let i = 1; i <= 5; i++) {
    ccx += (rand() - 0.42) * ftw * 0.09;
    ctx.lineTo(ccx, yB - (fth * 0.34 * i) / 5);
  }
  ctx.stroke();
  ctx.restore(); // slab clip
  ctx.restore(); // slab transform

  // old law leaving the focal slab as dust on the air, drifting up and right
  for (let i = 0; i < 46; i++) {
    const drift = Math.pow(rand(), 1.4);
    const mx2 = fcx + ftw * (0.1 + drift * 0.85) + (rand() - 0.5) * ftw * 0.3;
    const my2 = fbase - fth * (0.62 + rand() * 0.28) - drift * fth * 0.34;
    const a = (1 - drift) * (0.2 + rand() * 0.45);
    ctx.fillStyle = mix(C.parchmentAged, C.verdigris, clamp01(drift * 1.5), a);
    const ms = 0.7 + rand() * 1.7;
    ctx.fillRect(mx2 - ms / 2, my2 - ms / 2, ms, ms);
  }
  // its cold light kneels on the floor below
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const slabRefl = ctx.createLinearGradient(0, fbase + 3, 0, fbase + h * 0.085);
  slabRefl.addColorStop(0, mix(C.void, C.verdigris, 0.6, 0.13));
  slabRefl.addColorStop(1, mix(C.void, C.verdigris, 0.6, 0));
  ctx.fillStyle = slabRefl;
  ctx.fillRect(fcx - ftw * 0.52, fbase + 3, ftw * 1.04, h * 0.085);
  ctx.restore();
  ctx.strokeStyle = mix(C.void, C.verdigris, 0.5, 0.14);
  ctx.lineWidth = 1;
  for (const [rx, ry, rl] of [
    [fcx - ftw * 0.2, fbase + h * 0.03, ftw * 0.2],
    [fcx + ftw * 0.12, fbase + h * 0.05, ftw * 0.14],
  ] as const) {
    line(rx, ry, rx + rl, ry);
  }

  // ── 10. foreground ruin — darkest cutouts, framing the corners ───────────
  ctx.fillStyle = shade(C.void, 0.48);
  poly([
    [-w * 0.02, h * 1.02],
    [-w * 0.02, h * 0.84],
    [w * 0.075, h * 0.815],
    [w * 0.14, h * 0.875],
    [w * 0.185, h * 1.02],
  ]);
  ctx.fill();
  ctx.strokeStyle = mix(C.void, C.verdigris, 0.4, 0.35);
  ctx.lineWidth = 1;
  line(-w * 0.02, h * 0.845, w * 0.072, h * 0.82);
  ctx.fillStyle = shade(C.void, 0.48);
  poly([
    [w * 0.845, h * 1.02],
    [w * 0.89, h * 0.875],
    [w * 0.965, h * 0.845],
    [w * 1.02, h * 0.86],
    [w * 1.02, h * 1.02],
  ]);
  ctx.fill();
  ctx.strokeStyle = mix(C.void, C.ember, 0.4, 0.3);
  line(w * 0.892, h * 0.878, w * 0.963, h * 0.848);
  // right flank pillar — fog stop 3, its inner edge warmed by the passing beam
  ctx.fillStyle = shade(C.void, 0.55);
  ctx.fillRect(w * 0.968, 0, w * 0.032 + 2, h);
  const pillarKiss = ctx.createLinearGradient(0, 0, 0, h * 0.75);
  pillarKiss.addColorStop(0, mix(C.void, C.flame, 0.55, 0.45));
  pillarKiss.addColorStop(0.45, mix(C.void, C.ember, 0.45, 0.25));
  pillarKiss.addColorStop(1, mix(C.void, C.ember, 0.3, 0));
  ctx.strokeStyle = pillarKiss;
  ctx.lineWidth = 1.4;
  line(w * 0.968, h * 0.01, w * 0.968, h * 0.72);

  // ── 11. loose glyph-dust adrift in the hall air ───────────────────────────
  for (let i = 0; i < 26; i++) {
    const mx2 = (0.28 + rand() * 0.5) * w;
    const my2 = h * (0.08 + rand() * 0.52);
    const cold = mx2 < w * 0.55;
    const ms = 0.7 + rand() * 1.2;
    ctx.fillStyle = cold
      ? mix(C.verdigris, C.verdigrisDim, rand(), 0.08 + rand() * 0.22)
      : mix(C.flame, C.ember, rand(), 0.06 + rand() * 0.16);
    ctx.fillRect(mx2 - ms / 2, my2 - ms / 2, ms, ms);
  }

  // ── 12. crush, anchor, vignette — settle the frame, clear the caption ────
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.16);
  crush.addColorStop(0, shade(C.void, 0.7, 0.8));
  crush.addColorStop(1, shade(C.void, 0.7, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.16);
  const anchor = ctx.createLinearGradient(0, h * 0.77, 0, h);
  anchor.addColorStop(0, shade(C.void, 0.62, 0));
  anchor.addColorStop(1, shade(C.void, 0.62, 0.8));
  ctx.fillStyle = anchor;
  ctx.fillRect(0, h * 0.77, w, h * 0.23);
  const vr = Math.min(w, h) * 0.5;
  for (const [cx2, cy2] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    const g = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, vr);
    g.addColorStop(0, shade(C.void, 0.5, 0.42));
    g.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
