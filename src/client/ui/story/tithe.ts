/**
 * Story slide 2 — "The Tithe." The town's Tithe-hall at night. Through the
 * background arches the hearths of the town glow, and threads of their light
 * drift down toward the great stone mouth in the floor — every hearth pays.
 * A queue of townsfolk (an elder on a cane, a porter with a bundle, a parent
 * with a child, a lantern-bearer) waits while the lead pilgrim tips a brass
 * vessel and a bright ribbon of liquid flame pours into the pit; far below,
 * rimlit by the falling light, the barest curve of an immense closed eye
 * sleeps on under ribbed vault rings. The rim is crusted with generations of
 * wax, carved with covenant runes, and bound by a crisp verdigris warding
 * ring; a tall warden beckons the line forward. Guildhall idiom: woodcut
 * flats, three fog stops, amber = flame / verdigris = Vault, bottom quarter
 * kept calm and dark for the caption.
 *
 * Pure 2D canvas — no Phaser, no assets. Colors only via tokens + shade/mix;
 * jitter via a private LCG (never Math.random, never paint.ts crand).
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

const C = COLOR_CSS;

// Private LCG — same recipe as guildhall's hallRand, own seed stream.
function titheRand(seed: number): () => number {
  let s = seed >>> 0 || 0x717e;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Indigo-stone value ramp: 0 = void, 0.5 = borderVoid, 1 = pale bone-haze. */
function stoneTone(v: number, a = 1): string {
  if (v < 0.5) return mix(C.void, C.borderVoid, v * 2, a);
  return mix(C.borderVoid, mix(C.borderVoid, C.bone, 0.6), (v - 0.5) * 2, a);
}

/** Additive glow disc. */
function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  a: number,
): void {
  if (r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, shade(color, 1, a));
  g.addColorStop(1, shade(color, 1, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Flame teardrop (same silhouette as the candlemaid's First Flame). */
function drop(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  hgt: number,
  wdt: number,
  lean: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + lean, baseY - hgt);
  ctx.quadraticCurveTo(x + wdt, baseY - hgt * 0.38, x + wdt * 0.62, baseY - wdt * 0.55);
  ctx.arc(x, baseY - wdt * 0.55, wdt * 0.62, 0, Math.PI);
  ctx.quadraticCurveTo(x - wdt, baseY - hgt * 0.38, x + lean, baseY - hgt);
  ctx.closePath();
  ctx.fill();
}

/** A held taper: stub, teardrop flame, warm halo. `s` = flame height. */
function heldCandle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  glow(ctx, x, y - s * 0.5, s * 3.4, C.ember, 0.3);
  ctx.fillStyle = mix(C.parchmentAged, C.void, 0.32, 0.9);
  ctx.fillRect(x - 1, y, 2, s * 0.85);
  drop(ctx, x, y, s, s * 0.34, s * 0.05, shade(C.flame, 1, 0.95));
  drop(ctx, x, y - s * 0.06, s * 0.6, s * 0.2, s * 0.03, C.flameHi);
}

type FigOpts = {
  f: 1 | -1; // facing: +1 right, -1 left
  lean?: number; // 0..0.35 of ht, toward facing
  hunch?: number; // 0..1 — rounds the back, drops the crown
  tone: string;
  rim?: string; // facing-side contour rim light
};

/** One robed townsfolk silhouette — flat woodcut mass, hood, cloak folds. */
function robed(
  ctx: CanvasRenderingContext2D,
  x: number,
  foot: number,
  ht: number,
  o: FigOpts,
): void {
  const f = o.f;
  const lean = (o.lean ?? 0.08) * ht;
  const hunch = o.hunch ?? 0;
  const bw = ht * (0.44 + hunch * 0.12);
  const X = (dx: number): number => x + f * dx;
  const crownY = foot - ht * (1 - hunch * 0.16);
  ctx.beginPath();
  ctx.moveTo(X(-bw * 0.54), foot);
  ctx.bezierCurveTo(
    X(-bw * (0.62 + hunch * 0.34)),
    foot - ht * 0.42,
    X(-bw * 0.42 + lean * 0.4),
    foot - ht * 0.8,
    X(lean),
    crownY,
  );
  ctx.quadraticCurveTo(X(bw * 0.4 + lean), crownY + ht * 0.06, X(bw * 0.32 + lean * 0.8), foot - ht * 0.68);
  ctx.quadraticCurveTo(X(bw * 0.52 + lean * 0.3), foot - ht * 0.36, X(bw * 0.5), foot);
  ctx.closePath();
  ctx.fillStyle = o.tone;
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.7, 0.9);
  ctx.lineWidth = 1;
  ctx.stroke();
  // the hollow of the hood
  ctx.fillStyle = shade(C.void, 0.8, 0.95);
  ctx.beginPath();
  ctx.ellipse(
    X(bw * 0.14 + lean * 0.7),
    foot - ht * 0.8 + hunch * ht * 0.08,
    bw * 0.16,
    ht * 0.085,
    f * 0.15,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  // cloak folds falling from the shoulders
  ctx.strokeStyle = shade(C.void, 0.75, 0.35);
  ctx.lineWidth = 1;
  for (const fo of [-0.2, 0.02, 0.22]) {
    ctx.beginPath();
    ctx.moveTo(X(bw * fo), foot - 1);
    ctx.quadraticCurveTo(X(bw * fo + lean * 0.3), foot - ht * 0.3, X(bw * (fo + 0.07) + lean * 0.5), foot - ht * 0.52);
    ctx.stroke();
  }
  if (o.rim !== undefined) {
    ctx.strokeStyle = o.rim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(X(bw * 0.34 + lean * 0.8), foot - ht * 0.66);
    ctx.quadraticCurveTo(X(bw * 0.53 + lean * 0.3), foot - ht * 0.35, X(bw * 0.5), foot - ht * 0.05);
    ctx.stroke();
  }
}

export function paintTithe(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const rand = titheRand(0x7f7e3);
  const inkLine = shade(C.void, 0.7, 0.9);
  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  // ── geometry ─────────────────────────────────────────────────────────────
  const wallTop = h * 0.05;
  const floorY = h * 0.555;
  const mx = w * 0.55; // the stone mouth
  const my = h * 0.635;
  const rx = Math.max(Math.min(w * 0.2, h * 0.265), 56);
  const ry = rx * 0.375;
  const rxO = rx * 1.24; // carved curb, outer edge
  const ryO = ry * 1.28;

  // ── 1. base gradient — indigo night, never crushed to pure black ─────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, stoneTone(0.16));
  base.addColorStop(0.4, stoneTone(0.34));
  base.addColorStop(0.62, stoneTone(0.3));
  base.addColorStop(1, stoneTone(0.1));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. mid wall — fog stop 2: masonry with arched openings ───────────────
  const wallG = ctx.createLinearGradient(0, wallTop, 0, floorY);
  wallG.addColorStop(0, stoneTone(0.3));
  wallG.addColorStop(0.7, stoneTone(0.44));
  wallG.addColorStop(1, stoneTone(0.36));
  ctx.fillStyle = wallG;
  ctx.fillRect(0, wallTop, w, floorY - wallTop);
  // masonry courses
  ctx.lineWidth = 1;
  for (let cy = floorY - h * 0.045; cy > wallTop + h * 0.04; cy -= h * (0.045 + rand() * 0.02)) {
    ctx.strokeStyle = stoneTone(0.2, 0.35);
    line(0, cy, w, cy);
    ctx.strokeStyle = stoneTone(0.58, 0.12);
    line(0, cy + 1, w, cy + 1);
  }

  // ── 3. the arches — each opens on the pale hazy town, hearths alight ─────
  const hearths: Array<[number, number]> = [];
  const bays = [0, 1, 3, 4];
  for (const i of bays) {
    const aw = w * (0.105 + rand() * 0.02);
    const ax = ((i + 0.5) / 5) * w + (rand() - 0.5) * 0.02 * w - aw / 2;
    const atop = wallTop + h * (0.075 + rand() * 0.025);
    const abase = floorY - h * 0.012;
    const arch = (): void => {
      ctx.beginPath();
      ctx.moveTo(ax, abase);
      ctx.lineTo(ax, atop + aw / 2);
      ctx.arc(ax + aw / 2, atop + aw / 2, aw / 2, Math.PI, 0);
      ctx.lineTo(ax + aw, abase);
      ctx.closePath();
    };
    ctx.save();
    arch();
    ctx.clip();
    // fog stop 1 — the far town, palest value in the frame
    const hz = ctx.createLinearGradient(0, atop, 0, abase);
    hz.addColorStop(0, stoneTone(0.42));
    hz.addColorStop(0.55, stoneTone(0.62));
    hz.addColorStop(1, stoneTone(0.78));
    ctx.fillStyle = hz;
    ctx.fillRect(ax, atop, aw, abase - atop);
    // two rooflines — far pale, near darker; low gables, flat runs, chimneys
    const roofRow = (gy: number, gh: number, tone: string): void => {
      const chimneys: Array<[number, number]> = [];
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.moveTo(ax - 2, abase + 2);
      ctx.lineTo(ax - 2, gy);
      let gx = ax - 2 + rand() * aw * 0.08;
      while (gx < ax + aw + 2) {
        if (rand() > 0.6) {
          // a flat wall stretch between houses
          gx += aw * (0.08 + rand() * 0.1);
          ctx.lineTo(gx, gy - rand() * gh * 0.2);
          continue;
        }
        const gw = aw * (0.24 + rand() * 0.24);
        const ph = gh * (0.5 + rand() * 0.7);
        ctx.lineTo(gx + gw * (0.35 + rand() * 0.3), gy - ph);
        ctx.lineTo(gx + gw, gy - rand() * gh * 0.15);
        if (rand() > 0.55) chimneys.push([gx + gw * (0.15 + rand() * 0.6), gy - ph * 0.55]);
        gx += gw;
      }
      ctx.lineTo(ax + aw + 2, abase + 2);
      ctx.closePath();
      ctx.fill();
      for (const [chx0, chy0] of chimneys) {
        ctx.fillRect(chx0, chy0 - gh * 0.55, 2.4, gh * 0.6);
      }
    };
    roofRow(atop + (abase - atop) * 0.52, h * 0.022, stoneTone(0.5));
    roofRow(atop + (abase - atop) * 0.74, h * 0.027, stoneTone(0.36));
    // hearth windows — tiny warm lights in the dark houses
    const nw = 3;
    for (let k = 0; k < nw; k++) {
      const wx = ax + aw * (0.14 + 0.72 * ((k + rand() * 0.6) / nw));
      const wy = atop + (abase - atop) * (0.56 + rand() * 0.3);
      glow(ctx, wx, wy, 7, C.ember, 0.5);
      ctx.fillStyle = mix(C.flame, C.flameHi, 0.4, 0.95);
      ctx.fillRect(wx - 1.4, wy - 2, 2.8, 4);
      hearths.push([wx, wy]);
    }
    // ground haze rises over the roofs
    const gh2 = ctx.createLinearGradient(0, abase - (abase - atop) * 0.3, 0, abase);
    gh2.addColorStop(0, stoneTone(0.7, 0));
    gh2.addColorStop(1, stoneTone(0.7, 0.5));
    ctx.fillStyle = gh2;
    ctx.fillRect(ax, atop, aw, abase - atop);
    ctx.restore();
    // arch reveal — lit inner edge + ink cut
    arch();
    ctx.strokeStyle = stoneTone(0.66, 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();
    arch();
    ctx.strokeStyle = inkLine;
    ctx.lineWidth = 1;
    ctx.stroke();
    // pilaster edge beside the bay
    ctx.strokeStyle = stoneTone(0.6, 0.4);
    line(ax - 4, abase, ax - 4, atop + aw * 0.25);
  }
  // frieze line above the arches
  ctx.strokeStyle = stoneTone(0.55, 0.3);
  ctx.lineWidth = 1;
  line(0, wallTop + h * 0.028, w, wallTop + h * 0.028);

  // ── 4. carved emblem — a dim echo of the Great Gate, rings + hub boss ────
  const er = Math.min(w * 0.068, h * 0.09);
  const eyE = h * 0.215;
  ctx.fillStyle = stoneTone(0.38);
  ctx.beginPath();
  ctx.arc(mx, eyE, er, 0, Math.PI * 2);
  ctx.fill();
  for (const [rr, lw, v] of [
    [1, 2, 0.62],
    [0.74, 1.2, 0.56],
    [0.48, 1, 0.52],
  ] as const) {
    ctx.strokeStyle = stoneTone(v, 0.7);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(mx, eyE, er * rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  // radial relief ticks between the rings
  ctx.strokeStyle = stoneTone(0.5, 0.4);
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    line(
      mx + Math.cos(a) * er * 0.5,
      eyE + Math.sin(a) * er * 0.5,
      mx + Math.cos(a) * er * 0.72,
      eyE + Math.sin(a) * er * 0.72,
    );
  }
  // hub boss + the verdigris seam — the Vault's own sigil
  ctx.fillStyle = stoneTone(0.55);
  ctx.beginPath();
  ctx.arc(mx, eyE, er * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = inkLine;
  ctx.stroke();
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.45, 0.55);
  ctx.lineWidth = 1.2;
  line(mx, eyE - er * 0.92, mx, eyE + er * 0.92);
  // warm kiss on the emblem's underside from the pit far below
  ctx.strokeStyle = mix(C.ember, C.void, 0.25, 0.3);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(mx, eyE, er * 0.99, Math.PI * 0.25, Math.PI * 0.75);
  ctx.stroke();

  // god-ray — a soft cold shaft from the sigil down to the mouth
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rayG = ctx.createLinearGradient(0, eyE + er, 0, my - ry * 0.4);
  rayG.addColorStop(0, mix(C.bone, C.verdigris, 0.35, 0.07));
  rayG.addColorStop(1, mix(C.bone, C.verdigris, 0.35, 0));
  ctx.fillStyle = rayG;
  ctx.beginPath();
  ctx.moveTo(mx - er * 0.5, eyE + er * 0.8);
  ctx.lineTo(mx + er * 0.5, eyE + er * 0.8);
  ctx.lineTo(mx + rx * 0.62, my - ry * 0.4);
  ctx.lineTo(mx - rx * 0.62, my - ry * 0.4);
  ctx.closePath();
  ctx.fill();
  // dust motes drifting in the shaft
  for (let i = 0; i < 9; i++) {
    const t = rand();
    const spread = lerp(er * 0.45, rx * 0.55, t);
    ctx.fillStyle = mix(C.bone, C.verdigris, 0.3, 0.1 + rand() * 0.12);
    ctx.fillRect(mx + (rand() * 2 - 1) * spread, lerp(eyE + er, my - ry * 0.5, t), 1.4, 1.4);
  }
  ctx.restore();

  // ── 5. every hearth pays — threads of light drift down toward the mouth ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let hi = 0; hi < hearths.length; hi++) {
    const hearth = hearths[hi];
    if (hearth === undefined) continue;
    const [hx, hy] = hearth;
    const tx = mx + (rand() * 2 - 1) * rx * 0.55;
    const ty = my - ry * 0.85;
    const cpx = lerp(hx, tx, 0.45) + (rand() - 0.5) * w * 0.05;
    const cpy = lerp(hy, ty, 0.3) + h * (0.05 + rand() * 0.06);
    // the thread itself — one thin luminous drift-line, hearth to mouth,
    // brightening as it nears the pit so the payment visibly arrives
    const tg = ctx.createLinearGradient(hx, hy, tx, ty);
    tg.addColorStop(0, mix(C.flame, C.ember, 0.5, 0.05));
    tg.addColorStop(0.55, mix(C.flame, C.ember, 0.35, 0.15));
    tg.addColorStop(1, mix(C.flame, C.flameHi, 0.3, 0.34));
    ctx.strokeStyle = tg;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.quadraticCurveTo(cpx, cpy, tx, ty);
    ctx.stroke();
    // beads of light riding the thread down
    const dots = 7;
    for (let d = 1; d <= dots; d++) {
      const t = (d + rand() * 0.5) / (dots + 1);
      const u = 1 - t;
      const px = u * u * hx + 2 * u * t * cpx + t * t * tx;
      const py = u * u * hy + 2 * u * t * cpy + t * t * ty;
      ctx.fillStyle = mix(C.flame, C.ember, 0.4, 0.1 + t * 0.3);
      ctx.beginPath();
      ctx.arc(px, py, 0.7 + t * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // ── 6. fog band along the wall base ──────────────────────────────────────
  const fog = ctx.createLinearGradient(0, floorY - h * 0.08, 0, floorY + h * 0.02);
  fog.addColorStop(0, mix(C.void, C.bone, 0.14, 0));
  fog.addColorStop(0.55, mix(C.void, C.bone, 0.14, 0.42));
  fog.addColorStop(1, mix(C.void, C.bone, 0.14, 0));
  ctx.fillStyle = fog;
  ctx.fillRect(0, floorY - h * 0.08, w, h * 0.1);

  // ── 7. floor — flagstones, warm near the mouth, dark toward the caption ──
  const floor = ctx.createLinearGradient(0, floorY, 0, h);
  floor.addColorStop(0, stoneTone(0.4));
  floor.addColorStop(0.4, stoneTone(0.26));
  floor.addColorStop(1, stoneTone(0.08));
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, w, h - floorY);
  for (const k of [0.1, 0.24, 0.42, 0.65]) {
    ctx.strokeStyle = stoneTone(0.55, Math.max(0.05, 0.2 - k * 0.16));
    ctx.lineWidth = 1;
    const jy = floorY + (h - floorY) * k;
    line(0, jy + (rand() - 0.5) * 2, w, jy + (rand() - 0.5) * 2);
  }
  // radiating flag joints, dying toward the caption zone
  ctx.strokeStyle = stoneTone(0.5, 0.08);
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    line(mx + (t - 0.5) * w * 0.7, floorY + 2, mx + (t - 0.5) * w * 1.7, h * 0.86);
  }
  // warm breath of the mouth across the nearby floor
  ctx.save();
  ctx.translate(mx, my);
  ctx.scale(1, 0.4);
  const fw = ctx.createRadialGradient(0, 0, rx * 0.6, 0, 0, rx * 2.4);
  fw.addColorStop(0, shade(C.ember, 1, 0.14));
  fw.addColorStop(1, shade(C.ember, 1, 0));
  ctx.fillStyle = fw;
  ctx.fillRect(-rx * 2.5, -rx * 2.5, rx * 5, rx * 5);
  ctx.restore();

  // ── 8. worn descending steps ringing the near approach ───────────────────
  for (const [sk, sv] of [
    [1.14, 0.5],
    [1.3, 0.38],
  ] as const) {
    ctx.strokeStyle = stoneTone(sv, 0.5);
    ctx.lineWidth = 1.6;
    for (const [a0, a1] of [
      [Math.PI * 0.12, Math.PI * 0.44],
      [Math.PI * 0.52, Math.PI * 0.88],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(mx, my, rxO * sk, ryO * sk, 0, a0 + rand() * 0.05, a1 - rand() * 0.05);
      ctx.stroke();
    }
    ctx.strokeStyle = shade(C.void, 0.7, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(mx, my, rxO * sk, ryO * sk + 3, 0, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }

  // ── 9. the carved curb — generations of stone around the mouth ───────────
  const curbG = ctx.createLinearGradient(0, my - ryO, 0, my + ryO);
  curbG.addColorStop(0, stoneTone(0.34));
  curbG.addColorStop(0.5, stoneTone(0.52));
  curbG.addColorStop(1, stoneTone(0.62));
  ctx.fillStyle = curbG;
  ctx.beginPath();
  ctx.ellipse(mx, my, rxO, ryO, 0, 0, Math.PI * 2);
  ctx.fill();
  // radial tooth-notches
  ctx.strokeStyle = shade(C.void, 0.75, 0.45);
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + rand() * 0.05;
    line(
      mx + Math.cos(a) * rx * 1.02,
      my + Math.sin(a) * ry * 1.04,
      mx + Math.cos(a) * rxO * 0.97,
      my + Math.sin(a) * ryO * 0.95,
    );
  }
  // covenant runes carved into the curb — worn, a few flecked verdigris
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.22;
    if (a > Math.PI * 0.6 && a < Math.PI * 0.98) continue; // the pourer stands here
    const gx = mx + Math.cos(a) * rx * 1.12;
    const gy = my + Math.sin(a) * ry * 1.15;
    const gs = 2.4 + rand() * 2;
    ctx.strokeStyle = i % 4 === 0 ? mix(C.verdigrisDim, C.void, 0.25, 0.5) : shade(C.void, 0.75, 0.55);
    ctx.lineWidth = 1;
    line(gx - gs, gy + gs * 0.4, gx - gs, gy - gs * 0.5);
    line(gx - gs, gy - gs * 0.5, gx + gs * 0.7, gy - gs * 0.1 + rand() * gs * 0.4);
    if (rand() > 0.5) line(gx - gs, gy, gx + gs * 0.5, gy + gs * 0.3);
  }
  // chipped lip — three dark bites out of the inner edge
  for (const ca of [Math.PI * 0.3, Math.PI * 1.22, Math.PI * 1.7]) {
    ctx.fillStyle = shade(C.void, 0.65, 0.7);
    ctx.beginPath();
    const bx0 = mx + Math.cos(ca) * rx;
    const by0 = my + Math.sin(ca) * ry;
    ctx.moveTo(bx0 - 4, by0);
    ctx.lineTo(bx0 + 3, by0 - 2.5);
    ctx.lineTo(bx0 + 5, by0 + 2);
    ctx.closePath();
    ctx.fill();
  }

  // ── 10. the mouth itself — a deep warm shaft, and the sleeper below ──────
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  // deep warm gradient — never flat black-on-orange
  const deep = ctx.createLinearGradient(0, my - ry, 0, my + ry);
  deep.addColorStop(0, mix(C.ember, C.flame, 0.35));
  deep.addColorStop(0.35, shade(C.ember, 0.62));
  deep.addColorStop(0.75, mix(C.void, C.ember, 0.3));
  deep.addColorStop(1, mix(C.void, C.ember, 0.18));
  ctx.fillStyle = deep;
  ctx.fillRect(mx - rx, my - ry, rx * 2, ry * 2);
  // ribbed vault rings receding down the shaft — kin to the Gate's relief
  for (const k of [0.86, 0.68, 0.52]) {
    ctx.strokeStyle = mix(C.ember, C.void, 0.5, 0.4);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(mx, my + ry * 0.16 * (1 - k), rx * k, ry * k, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = mix(C.flame, C.ember, 0.5, 0.2);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(mx, my + ry * 0.16 * (1 - k) - 1.5, rx * k, ry * k, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  // light draining down the far wall — thin gold runnels
  for (let i = 0; i < 9; i++) {
    const t = rand() * 1.7 - 0.85;
    const sx0 = mx + t * rx * 0.85;
    const syTop = my - ry * Math.sqrt(Math.max(0, 1 - t * t)) + 1;
    const len = ry * (0.5 + rand() * 0.7);
    const g = ctx.createLinearGradient(sx0, syTop, sx0, syTop + len);
    g.addColorStop(0, i % 3 === 0 ? shade(C.flameHi, 1, 0.6) : mix(C.flame, C.ember, 0.35, 0.4));
    g.addColorStop(1, shade(C.ember, 1, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 0.8 + rand() * 1;
    ctx.beginPath();
    ctx.moveTo(sx0, syTop);
    ctx.lineTo(sx0 + (mx - sx0) * 0.12, syTop + len);
    ctx.stroke();
  }
  // THE SLEEPER — one immense closed eye, rimlit by the falling tithe.
  // The lid is a broad warm-lit dome; the closed seam is a dark curve with
  // lashes; the cheek below fades into the deep.
  const domeL = mx - rx * 0.96;
  const domeR = mx + rx * 0.98;
  const domeApexX = mx + rx * 0.06;
  const domeApexY = my + ry * 0.02;
  const domePath = (): void => {
    ctx.beginPath();
    ctx.moveTo(domeL, my + ry * 0.62);
    ctx.quadraticCurveTo(domeApexX, domeApexY, domeR, my + ry * 0.56);
    ctx.lineTo(mx + rx, my + ry);
    ctx.lineTo(mx - rx, my + ry);
    ctx.closePath();
  };
  // warm updraft BEHIND the brow — the dark mass silhouettes against it
  glow(ctx, domeApexX - rx * 0.3, domeApexY - ry * 0.1, rx * 0.5, C.flame, 0.3);
  glow(ctx, domeApexX + rx * 0.34, domeApexY + ry * 0.02, rx * 0.44, C.ember, 0.4);
  glow(ctx, domeApexX, domeApexY - ry * 0.16, rx * 0.62, C.ember, 0.3);
  const domeG = ctx.createLinearGradient(0, domeApexY, 0, my + ry);
  domeG.addColorStop(0, mix(C.void, C.ember, 0.22, 0.98));
  domeG.addColorStop(0.45, mix(C.void, C.ember, 0.12));
  domeG.addColorStop(1, mix(C.void, C.ember, 0.07));
  domePath();
  ctx.fillStyle = domeG;
  ctx.fill();
  // rim light along the brow's crown — the falling tithe catches it
  ctx.strokeStyle = mix(C.flameHi, C.flame, 0.35, 0.85);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(domeL, my + ry * 0.62);
  ctx.quadraticCurveTo(domeApexX, domeApexY, domeR, my + ry * 0.56);
  ctx.stroke();
  glow(ctx, domeApexX, domeApexY + 2, rx * 0.3, C.flame, 0.22);
  // brow-ridge ribs — the sheer scale of the thing, arcing with the crest
  ctx.strokeStyle = mix(C.ember, C.void, 0.45, 0.4);
  ctx.lineWidth = 1.2;
  for (const off of [0.1, 0.2] as const) {
    ctx.beginPath();
    ctx.moveTo(domeL + rx * 0.1, my + ry * (0.62 + off * 0.5));
    ctx.quadraticCurveTo(domeApexX, domeApexY + ry * off, domeR - rx * 0.08, my + ry * (0.56 + off * 0.5));
    ctx.stroke();
  }
  // THE CLOSED EYE — a warm slit of light across the dark brow, lashes down
  const eyeL = mx - rx * 0.46;
  const eyeR = mx + rx * 0.58;
  const eyeCx = mx + rx * 0.07;
  const eyeTopY = my + ry * 0.36;
  const eyeDipY = my + ry * 0.58;
  glow(ctx, eyeCx, my + ry * 0.48, rx * 0.36, C.ember, 0.3);
  ctx.lineCap = "round";
  // light seeping from under the lid — the fire it dreams on
  ctx.strokeStyle = shade(C.flameHi, 1.1, 0.45);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(eyeL + rx * 0.04, eyeTopY + 2.5);
  ctx.quadraticCurveTo(eyeCx, eyeDipY + 3, eyeR - rx * 0.04, eyeTopY - ry * 0.02 + 2.5);
  ctx.stroke();
  ctx.strokeStyle = mix(C.flame, C.ember, 0.25, 0.9);
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(eyeL, eyeTopY);
  ctx.quadraticCurveTo(eyeCx, eyeDipY, eyeR, eyeTopY - ry * 0.02);
  ctx.stroke();
  // upturned corners of the closed lids
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(eyeL, eyeTopY);
  ctx.quadraticCurveTo(eyeL - rx * 0.05, eyeTopY - ry * 0.05, eyeL - rx * 0.08, eyeTopY - ry * 0.12);
  ctx.moveTo(eyeR, eyeTopY - ry * 0.02);
  ctx.quadraticCurveTo(eyeR + rx * 0.05, eyeTopY - ry * 0.07, eyeR + rx * 0.08, eyeTopY - ry * 0.15);
  ctx.stroke();
  // lashes, drooping with sleep — long, curved, swept toward the eye's dip
  ctx.strokeStyle = mix(C.flame, C.ember, 0.45, 0.65);
  for (let i = 0; i < 6; i++) {
    const t = 0.12 + (i / 5) * 0.76;
    const u = 1 - t;
    const px = u * u * eyeL + 2 * u * t * eyeCx + t * t * eyeR;
    const py = u * u * eyeTopY + 2 * u * t * eyeDipY + t * t * (eyeTopY - ry * 0.02);
    const sweep = (t - 0.5) * rx * 0.09; // splay outward from center
    const len = ry * (0.13 + 0.07 * Math.sin(t * Math.PI));
    ctx.lineWidth = 1.7 - Math.abs(t - 0.5);
    ctx.beginPath();
    ctx.moveTo(px, py + 1.5);
    ctx.quadraticCurveTo(px + sweep * 0.3, py + len * 0.6, px + sweep, py + len);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // tithed lights still sinking, dimming with depth
  for (let i = 0; i < 4; i++) {
    const fx0 = mx + (rand() * 2 - 1) * rx * 0.5;
    const fy0 = my - ry * 0.55 + rand() * ry * 0.75;
    const dpt = (fy0 - (my - ry)) / (2 * ry);
    const a = Math.max(0.15, 0.75 * (1 - dpt));
    glow(ctx, fx0, fy0, 5, C.ember, a * 0.5);
    ctx.fillStyle = mix(C.flame, C.ember, dpt, a);
    ctx.beginPath();
    ctx.arc(fx0, fy0, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // wax stalactites — generations of tithes hang from the far lip
  for (let i = 0; i < 8; i++) {
    const t = -0.78 + (i / 7) * 1.56;
    const wx0 = mx + t * rx * 0.94;
    const wy0 = my - ry * Math.sqrt(Math.max(0, 1 - t * t)) - 1;
    const wl = ry * (0.14 + rand() * 0.26);
    const ww = 2 + rand() * 2.4;
    ctx.fillStyle = mix(C.parchmentAged, C.ember, 0.42, 0.95);
    ctx.beginPath();
    ctx.moveTo(wx0 - ww, wy0);
    ctx.quadraticCurveTo(wx0 - ww * 0.4, wy0 + wl * 0.6, wx0, wy0 + wl);
    ctx.quadraticCurveTo(wx0 + ww * 0.4, wy0 + wl * 0.6, wx0 + ww, wy0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mix(C.flameHi, C.flame, 0.4, 0.5);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(wx0 - ww * 0.5, wy0 + 1);
    ctx.quadraticCurveTo(wx0 - ww * 0.2, wy0 + wl * 0.5, wx0, wy0 + wl - 1);
    ctx.stroke();
  }
  // near lip casts its shadow into the bowl — soft, never crushing the eye
  const nsh = ctx.createLinearGradient(0, my + ry * 0.68, 0, my + ry);
  nsh.addColorStop(0, shade(C.void, 0.6, 0));
  nsh.addColorStop(1, shade(C.void, 0.6, 0.5));
  ctx.fillStyle = nsh;
  ctx.fillRect(mx - rx, my + ry * 0.68, rx * 2, ry * 0.32);
  ctx.restore();

  // ── 11. ink cuts + the warding ring — crisp, ancient, verdigris ──────────
  ctx.strokeStyle = inkLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(mx, my, rxO, ryO, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  // warm rim light where the shaft-glow kisses the far lip
  ctx.strokeStyle = mix(C.ember, C.flame, 0.45, 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(mx, my, rx, ry, 0, -Math.PI * 0.88, -Math.PI * 0.12);
  ctx.stroke();
  // the warding ring proper — crisp but ancient: worn through in places
  const wardArcs: Array<[number, number]> = [
    [0.06, 1.48],
    [1.62, 2.94],
    [3.12, 4.4],
    [4.55, 6.14],
  ];
  for (const [a0, a1] of wardArcs) {
    ctx.beginPath();
    ctx.ellipse(mx, my, rx * 1.11, ry * 1.14, 0, a0, a1);
    ctx.strokeStyle = shade(C.verdigrisDim, 1, 0.14);
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(mx, my, rx * 1.11, ry * 1.14, 0, a0, a1);
    ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.5, 0.55);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // rune ticks crossing the ring
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.55, 0.42);
  ctx.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.13;
    line(
      mx + Math.cos(a) * rx * 1.08,
      my + Math.sin(a) * ry * 1.11,
      mx + Math.cos(a) * rx * 1.14,
      my + Math.sin(a) * ry * 1.17,
    );
  }

  // ── 12. wax of a thousand years — pooled lumps on the curb stone ─────────
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.05 + rand() * 0.9); // front half of the ring
    const px = mx + Math.cos(a) * rx * (1.14 + rand() * 0.1);
    const py = my + Math.sin(a) * ry * (1.16 + rand() * 0.12);
    const pr = 3 + rand() * 4;
    ctx.fillStyle = mix(C.parchmentAged, C.ember, 0.3, 0.55);
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      ctx.ellipse(px + (rand() - 0.5) * pr, py + (rand() - 0.5) * pr * 0.5, pr * (0.5 + rand() * 0.5), pr * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = mix(C.flameHi, C.parchment, 0.5, 0.35);
    ctx.fillRect(px - 0.8, py - pr * 0.32, 1.6, 1.2);
  }

  // ── 13. the queue — townsfolk of every stripe, each with their flame ─────
  const rimAmber = mix(C.ember, C.flame, 0.5, 0.4);
  const pool = (px: number, py: number, r: number, a: number): void => {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, 0.32);
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    pg.addColorStop(0, shade(C.flame, 0.6, a));
    pg.addColorStop(1, shade(C.ember, 0.5, 0));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = pg;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.restore();
  };
  const shadowWedge = (px: number, py: number, ln: number, wd: number): void => {
    ctx.fillStyle = shade(C.void, 0.6, 0.28);
    ctx.beginPath();
    ctx.moveTo(px - wd * 0.4, py);
    ctx.lineTo(px + wd * 0.4, py);
    ctx.lineTo(px - ln * 0.8 + wd, py + ln * 0.28);
    ctx.lineTo(px - ln * 0.8 - wd, py + ln * 0.22);
    ctx.closePath();
    ctx.fill();
  };

  // 13a. bent elder on a cane — furthest back
  {
    const x = w * 0.095;
    const foot = h * 0.6;
    const ht = h * 0.072;
    pool(x + ht * 0.3, foot + 2, ht * 1.1, 0.12);
    shadowWedge(x, foot + 1, ht * 0.5, ht * 0.2);
    robed(ctx, x, foot, ht, { f: 1, lean: 0.22, hunch: 0.68, tone: mix(C.void, C.boneDim, 0.3), rim: rimAmber });
    ctx.strokeStyle = mix(C.void, C.boneDim, 0.68, 0.95);
    ctx.lineWidth = 1.8;
    line(x + ht * 0.42, foot, x + ht * 0.3, foot - ht * 0.52);
    heldCandle(ctx, x + ht * 0.3, foot - ht * 0.62, ht * 0.13);
  }
  // 13b. porter with a bundle roped to the back
  {
    const x = w * 0.16;
    const foot = h * 0.615;
    const ht = h * 0.082;
    pool(x + ht * 0.32, foot + 2, ht * 1.1, 0.12);
    shadowWedge(x, foot + 1, ht * 0.55, ht * 0.2);
    ctx.fillStyle = mix(C.void, C.inkSoft, 0.55);
    ctx.beginPath();
    ctx.ellipse(x - ht * 0.3, foot - ht * 0.72, ht * 0.26, ht * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = inkLine;
    ctx.lineWidth = 1;
    ctx.stroke();
    robed(ctx, x, foot, ht, { f: 1, lean: 0.16, hunch: 0.35, tone: mix(C.void, C.boneDim, 0.36), rim: rimAmber });
    heldCandle(ctx, x + ht * 0.34, foot - ht * 0.56, ht * 0.13);
  }
  // 13c. parent and child, hand in hand — the child carries the stub
  {
    const x = w * 0.235;
    const foot = h * 0.63;
    const ht = h * 0.09;
    pool(x + ht * 0.4, foot + 2, ht * 1.2, 0.13);
    shadowWedge(x, foot + 1, ht * 0.6, ht * 0.22);
    robed(ctx, x, foot, ht, { f: 1, lean: 0.1, tone: mix(C.void, C.boneDim, 0.42), rim: rimAmber });
    const cht = ht * 0.48;
    const cx0 = x + ht * 0.42;
    robed(ctx, cx0, foot + 2, cht, { f: 1, lean: 0.06, tone: mix(C.void, C.boneDim, 0.5), rim: rimAmber });
    // the shared grip between them
    ctx.strokeStyle = mix(C.void, C.boneDim, 0.55, 0.8);
    ctx.lineWidth = 1.4;
    line(x + ht * 0.24, foot - ht * 0.42, cx0 - cht * 0.1, foot - cht * 0.62);
    heldCandle(ctx, cx0 + cht * 0.34, foot + 2 - cht * 0.6, cht * 0.22);
  }
  // 13d. lantern-bearer — the light swings from a shoulder pole
  {
    const x = w * 0.315;
    const foot = h * 0.645;
    const ht = h * 0.096;
    pool(x + ht * 0.7, foot + 2, ht * 1.3, 0.13);
    shadowWedge(x, foot + 1, ht * 0.65, ht * 0.24);
    robed(ctx, x, foot, ht, { f: 1, lean: 0.14, tone: mix(C.void, C.boneDim, 0.33), rim: rimAmber });
    const poleX = x + ht * 0.72;
    ctx.strokeStyle = mix(C.void, C.inkSoft, 0.7, 0.9);
    ctx.lineWidth = 1.6;
    line(x + ht * 0.1, foot - ht * 0.82, poleX, foot - ht * 0.98);
    line(poleX, foot - ht * 0.98, poleX, foot - ht * 0.84);
    // little cage lantern
    const ly = foot - ht * 0.76;
    glow(ctx, poleX, ly, ht * 0.34, C.ember, 0.4);
    ctx.strokeStyle = mix(C.ink, C.void, 0.25, 0.95);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(poleX - ht * 0.07, ly + ht * 0.06);
    ctx.quadraticCurveTo(poleX - ht * 0.09, ly - ht * 0.06, poleX, ly - ht * 0.09);
    ctx.quadraticCurveTo(poleX + ht * 0.09, ly - ht * 0.06, poleX + ht * 0.07, ly + ht * 0.06);
    ctx.closePath();
    ctx.stroke();
    drop(ctx, poleX, ly + ht * 0.05, ht * 0.11, ht * 0.036, 0, shade(C.flame, 1, 0.95));
    drop(ctx, poleX, ly + ht * 0.04, ht * 0.065, ht * 0.02, 0, C.flameHi);
  }
  // 13e. the next in line, head bowed, candle guarded at the chest
  {
    const x = w * 0.36;
    const foot = h * 0.66;
    const ht = h * 0.1;
    pool(x + ht * 0.34, foot + 2, ht * 1.2, 0.12);
    shadowWedge(x, foot + 1, ht * 0.7, ht * 0.24);
    robed(ctx, x, foot, ht, { f: 1, lean: 0.18, hunch: 0.22, tone: mix(C.void, C.boneDim, 0.38), rim: rimAmber });
    heldCandle(ctx, x + ht * 0.36, foot - ht * 0.52, ht * 0.13);
  }

  // ── 14. THE OFFERING — the lead pilgrim tips the vessel over the rim ─────
  const pfx = mx - rxO + rx * 0.1;
  const pfoot = my + ry * 0.52;
  const pht = h * 0.108;
  shadowWedge(pfx - 4, pfoot + 1, pht * 0.7, pht * 0.26);
  pool(pfx + pht * 0.5, pfoot + 3, pht * 1.5, 0.16);
  robed(ctx, pfx, pfoot, pht, {
    f: 1,
    lean: 0.3,
    hunch: 0.3,
    tone: mix(C.void, C.boneDim, 0.4),
  });
  // both sleeves reach out over the mouth
  const bx = pfx + pht * 0.68;
  const by = pfoot - pht * 0.84;
  ctx.beginPath();
  ctx.moveTo(pfx + pht * 0.16, pfoot - pht * 0.62);
  ctx.quadraticCurveTo(pfx + pht * 0.42, pfoot - pht * 0.9, bx - pht * 0.05, by + pht * 0.03);
  ctx.lineTo(bx + pht * 0.02, by + pht * 0.1);
  ctx.quadraticCurveTo(pfx + pht * 0.44, pfoot - pht * 0.66, pfx + pht * 0.2, pfoot - pht * 0.42);
  ctx.closePath();
  ctx.fillStyle = mix(C.void, C.boneDim, 0.48);
  ctx.fill();
  ctx.strokeStyle = inkLine;
  ctx.lineWidth = 1;
  ctx.stroke();
  // hands, lit hard by what they pour
  ctx.fillStyle = mix(C.parchment, C.flame, 0.4);
  ctx.beginPath();
  ctx.arc(bx - 1, by + 2, pht * 0.035, 0, Math.PI * 2);
  ctx.arc(bx + 3, by + 5, pht * 0.032, 0, Math.PI * 2);
  ctx.fill();
  // the tipped vessel — a small brass bowl, mouth down-right
  ctx.save();
  ctx.translate(bx + pht * 0.06, by);
  ctx.rotate(0.7);
  ctx.fillStyle = mix(C.goldInk, C.void, 0.35);
  ctx.beginPath();
  ctx.arc(0, 0, pht * 0.09, Math.PI * 0.05, Math.PI * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = inkLine;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.45, 0.8);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, pht * 0.085, Math.PI * 0.08, Math.PI * 0.5);
  ctx.stroke();
  ctx.restore();
  // front of the robe catches the pour
  ctx.strokeStyle = mix(C.flame, C.flameHi, 0.25, 0.55);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pfx + pht * 0.4, pfoot - pht * 0.6);
  ctx.quadraticCurveTo(pfx + pht * 0.56, pfoot - pht * 0.32, pfx + pht * 0.5, pfoot - pht * 0.04);
  ctx.stroke();
  // face of the hood, underlit
  ctx.fillStyle = mix(C.ember, C.flame, 0.5, 0.35);
  ctx.beginPath();
  ctx.ellipse(pfx + pht * 0.24, pfoot - pht * 0.74, pht * 0.055, pht * 0.035, 0.2, 0, Math.PI);
  ctx.fill();

  // THE RIBBON OF LIGHT — brightest thing in the frame
  const spx = bx + pht * 0.46; // splash point, on the sleeper's lid
  const spy = my + ry * 0.42;
  const ribbon = (dx: number): void => {
    ctx.beginPath();
    ctx.moveTo(bx + pht * 0.1 + dx, by + 3);
    ctx.bezierCurveTo(bx + pht * 0.3 + dx, by + (spy - by) * 0.22, spx + dx * 0.4, spy - (spy - by) * 0.4, spx, spy);
  };
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.strokeStyle = shade(C.ember, 1, 0.3);
  ctx.lineWidth = 10;
  ribbon(0);
  ctx.stroke();
  ctx.strokeStyle = shade(C.flame, 1, 0.5);
  ctx.lineWidth = 5;
  ribbon(0);
  ctx.stroke();
  ctx.restore();
  ctx.lineCap = "round";
  ctx.strokeStyle = mix(C.flame, C.flameHi, 0.55, 0.95);
  ctx.lineWidth = 2.6;
  ribbon(0);
  ctx.stroke();
  ctx.strokeStyle = shade(C.flameHi, 1.3, 0.95);
  ctx.lineWidth = 1.1;
  ribbon(1);
  ctx.stroke();
  ctx.lineCap = "butt";
  // droplets shed from the stream
  for (let i = 0; i < 5; i++) {
    const t = 0.35 + rand() * 0.6;
    const dx0 = lerp(bx + pht * 0.1, spx, t) + (rand() - 0.5) * 7;
    const dy0 = lerp(by + 3, spy, t * t) + rand() * 5;
    ctx.fillStyle = mix(C.flameHi, C.flame, rand() * 0.5, 0.85);
    ctx.beginPath();
    ctx.arc(dx0, dy0, 0.8 + rand() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // the splash where the tithe meets the sleeper
  glow(ctx, spx, spy, rx * 0.27, C.flame, 0.6);
  glow(ctx, spx, spy, rx * 0.11, C.flameHi, 0.75);
  ctx.fillStyle = shade(C.flameHi, 1.2, 0.6);
  ctx.beginPath();
  ctx.ellipse(spx, spy, 8, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(C.flameHi, 1, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(spx - 6, spy - 1);
  ctx.quadraticCurveTo(spx - 10, spy - 5, spx - 12, spy - 4);
  ctx.moveTo(spx + 6, spy - 1);
  ctx.quadraticCurveTo(spx + 10, spy - 6, spx + 13, spy - 4);
  ctx.stroke();
  // the pour lights the pourer
  glow(ctx, bx, by + 6, pht * 0.65, C.flame, 0.22);

  // ── 15. the warden of the mouth — tall, still, beckoning the line on ─────
  const wx = Math.min(mx + rxO + w * 0.026, w * 0.88);
  const wht = h * 0.138;
  const wfoot = my + ry * 0.42;
  shadowWedge(wx + 6, wfoot + 1, wht * 0.6, wht * 0.24);
  robed(ctx, wx, wfoot, wht, { f: -1, lean: 0.05, tone: mix(C.void, C.boneDim, 0.24) });
  // the tall split cowl — his silhouette is like no pilgrim's
  ctx.fillStyle = mix(C.void, C.boneDim, 0.24);
  ctx.beginPath();
  ctx.moveTo(wx - wht * 0.16, wfoot - wht * 0.9);
  ctx.quadraticCurveTo(wx - wht * 0.1, wfoot - wht * 1.18, wx - wht * 0.19, wfoot - wht * 1.3);
  ctx.quadraticCurveTo(wx + wht * 0.02, wfoot - wht * 1.16, wx + wht * 0.09, wfoot - wht * 0.92);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = inkLine;
  ctx.lineWidth = 1;
  ctx.stroke();
  // beckoning sleeve, swept toward the queue
  ctx.beginPath();
  ctx.moveTo(wx - wht * 0.1, wfoot - wht * 0.66);
  ctx.quadraticCurveTo(wx - wht * 0.42, wfoot - wht * 0.78, wx - wht * 0.58, wfoot - wht * 0.6);
  ctx.quadraticCurveTo(wx - wht * 0.44, wfoot - wht * 0.52, wx - wht * 0.24, wfoot - wht * 0.4);
  ctx.closePath();
  ctx.fillStyle = mix(C.void, C.boneDim, 0.3);
  ctx.fill();
  ctx.strokeStyle = inkLine;
  ctx.stroke();
  ctx.fillStyle = mix(C.parchmentAged, C.ember, 0.3, 0.9);
  ctx.beginPath();
  ctx.arc(wx - wht * 0.57, wfoot - wht * 0.59, wht * 0.028, 0, Math.PI * 2);
  ctx.fill();
  // his staff — crook and cold verdigris lamp: the Vault's own light
  const stx = wx + wht * 0.34;
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.5, 0.95);
  ctx.lineWidth = 2;
  line(stx, wfoot, stx, wfoot - wht * 1.24);
  ctx.beginPath();
  ctx.arc(stx - wht * 0.05, wfoot - wht * 1.24, wht * 0.05, -Math.PI * 0.1, Math.PI * 1.05);
  ctx.stroke();
  const lampY = wfoot - wht * 1.14;
  glow(ctx, stx - wht * 0.1, lampY, wht * 0.22, C.verdigrisDim, 0.55);
  ctx.fillStyle = mix(C.verdigris, C.verdigrisDim, 0.35, 0.9);
  ctx.beginPath();
  ctx.arc(stx - wht * 0.1, lampY, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(C.verdigris, 1.4, 0.9);
  ctx.fillRect(stx - wht * 0.1 - 0.7, lampY - 0.7, 1.4, 1.4);
  // verdigris edge on his mouth-side contour; keys of office at the belt
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.5, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(wx + wht * 0.3, wfoot - wht * 0.62);
  ctx.quadraticCurveTo(wx + wht * 0.46, wfoot - wht * 0.3, wx + wht * 0.44, wfoot - wht * 0.04);
  ctx.stroke();
  ctx.fillStyle = mix(C.goldInk, C.void, 0.3, 0.7);
  for (let i = 0; i < 3; i++) ctx.fillRect(wx - wht * 0.06 + i * 4, wfoot - wht * 0.4, 1.6, 4 + (i % 2) * 2);

  // ── 16. embers and motes rise where the tithe goes down ──────────────────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 14; i++) {
    const t = rand();
    const ex0 = mx + (rand() * 2 - 1) * rx * (0.25 + t * 0.55);
    const ey0 = my - ry - t * h * 0.24;
    const a = (1 - t) * 0.55 + 0.1;
    ctx.fillStyle = mix(C.flame, C.ember, rand() * 0.6, a);
    const r = 0.7 + (1 - t) * 1;
    ctx.beginPath();
    ctx.arc(ex0, ey0, r, 0, Math.PI * 2);
    ctx.fill();
    if (i % 5 === 0) {
      const tg = ctx.createLinearGradient(ex0, ey0, ex0, ey0 + 9);
      tg.addColorStop(0, shade(C.ember, 1, a * 0.7));
      tg.addColorStop(1, shade(C.ember, 1, 0));
      ctx.strokeStyle = tg;
      ctx.lineWidth = 1;
      line(ex0, ey0 + 1, ex0 + 1, ey0 + 9);
    }
  }
  ctx.restore();

  // ── 17. foreground frame — fog stop 3, darkest cutouts ───────────────────
  // left: a great column edge
  const colW = w * 0.062;
  const colG = ctx.createLinearGradient(0, 0, colW * 1.3, 0);
  colG.addColorStop(0, shade(C.void, 0.55));
  colG.addColorStop(1, shade(C.void, 0.8));
  ctx.fillStyle = colG;
  ctx.fillRect(0, 0, colW, h);
  ctx.strokeStyle = stoneTone(0.42, 0.5);
  ctx.lineWidth = 1.4;
  line(colW - 1, 0, colW - 1, h);
  // right: a censer chain hangs into frame
  const chx = w * 0.925;
  ctx.fillStyle = mix(C.void, C.bone, 0.32, 0.7);
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    ctx.fillRect(chx + Math.sin(t * 6) * 2, t * h * 0.24, 2.2, 2.2);
  }
  ctx.save();
  ctx.translate(chx + 1, h * 0.255);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = shade(C.void, 0.85);
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();
  glow(ctx, chx + 1, h * 0.252, 6, C.ember, 0.5);
  ctx.fillStyle = shade(C.flame, 1, 0.8);
  ctx.fillRect(chx, h * 0.248, 2, 2);
  // right sliver of dark wall
  ctx.fillStyle = shade(C.void, 0.6, 0.85);
  ctx.fillRect(w * 0.965, 0, w * 0.035, h);

  // ── 18. crush and vignette — settle the frame, calm the caption zone ─────
  const crushT = ctx.createLinearGradient(0, 0, 0, h * 0.14);
  crushT.addColorStop(0, shade(C.void, 0.7, 0.75));
  crushT.addColorStop(1, shade(C.void, 0.7, 0));
  ctx.fillStyle = crushT;
  ctx.fillRect(0, 0, w, h * 0.14);
  const crushB = ctx.createLinearGradient(0, h * 0.72, 0, h);
  crushB.addColorStop(0, shade(C.void, 0.55, 0));
  crushB.addColorStop(0.55, shade(C.void, 0.55, 0.55));
  crushB.addColorStop(1, shade(C.void, 0.55, 0.9));
  ctx.fillStyle = crushB;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  const vr = Math.min(w, h) * 0.5;
  for (const [vx, vy] of [
    [0, 0],
    [w, 0],
  ] as const) {
    const v = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    v.addColorStop(0, shade(C.void, 0.5, 0.35));
    v.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}
