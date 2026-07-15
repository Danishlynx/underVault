/**
 * Finale plate 3 — "The Festival of Wicks." The season's last image, and the
 * warmest, most peopled plate in the whole game: the town above at night,
 * transformed. The restored First Flame stands installed on a stone plinth
 * in the square's center, burning tall and calm, and EVERY window in town
 * carries two small candle points — one for the day, one for her. Small warm
 * figures ring the plinth: a child on tiptoe lighting a wick from the Flame,
 * others with lanterns — and among them, HER, small and unhooded, at ease,
 * part of the crowd at last (grey-streaked hair, the long singed braid,
 * exactly the head meeting plate 4 first showed). Far on the hill edge the
 * old door to the Vault stands small and dark — present, not threatening —
 * one faint verdigris breath at its seam; season two sleeps there. Joy in
 * the same quiet woodcut grammar, never cartoon; the two-hue law holds with
 * warm carrying nearly all of it. Caller has DPR-scaled and cleared; the
 * bottom ~20% stays calm and dark for the caption.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall pattern, own seed) — never Math.random, never
// paint.ts crand (that stream belongs to the world-texture painters).
function festRand(seed: number): () => number {
  let s = seed >>> 0 || 0xfe57a1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const TAU = Math.PI * 2;

/** One townsperson around the Flame — placed first so shadows can be laid
 *  for the whole crowd before anyone stands in the light. */
type Folk = {
  x: number;
  base: number;
  hgt: number;
  lantern?: boolean;
  candle?: boolean;
  cap?: boolean;
  lean?: number;
  fill?: string;
};

export function paintFinale3(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = festRand(0xfe57a1);
  const s = Math.min(w, h);
  const INK = shade(C.void, 0.7, 0.9);

  // ── geometry ─────────────────────────────────────────────────────────────
  const cx = w * 0.5;
  // the hill edge behind the town — season two sleeps out there
  const ridge = (x: number): number =>
    h * (0.318 + 0.02 * Math.sin((x / w) * 4.6 + 0.7) + 0.011 * Math.sin((x / w) * 11.3 + 2.1));
  const squareY = h * 0.545; // where the far facades meet the square
  const plinthBase = h * 0.665;
  const pHalf = s * 0.024; // plinth shaft half-width
  const plinthH = s * 0.055;
  const plinthTop = plinthBase - plinthH;
  const stubW = s * 0.016; // the First Flame's fed stub, installed at last
  const stubH = s * 0.038;
  const stubTop = plinthTop - stubH - s * 0.004;
  const flameH = s * 0.115;
  const flameCy = stubTop - flameH * 0.5;
  // the crowd — laid out up front so their shadows can be painted together
  const backFolk: Folk[] = [
    { x: cx - s * 0.30, base: h * 0.601, hgt: s * 0.046, cap: true },
    { x: cx - s * 0.16, base: h * 0.618, hgt: s * 0.058, cap: true },
    { x: cx - s * 0.088, base: h * 0.627, hgt: s * 0.064, candle: true },
    { x: cx + s * 0.052, base: h * 0.621, hgt: s * 0.06, cap: true },
    { x: cx + s * 0.128, base: h * 0.618, hgt: s * 0.057, lantern: true },
    { x: cx + s * 0.196, base: h * 0.63, hgt: s * 0.062, candle: true },
    { x: cx + s * 0.315, base: h * 0.606, hgt: s * 0.048 },
  ];
  const nearFolk: Folk[] = [
    { x: cx - s * 0.215, base: h * 0.703, hgt: s * 0.096, lantern: true, cap: true },
    { x: cx - s * 0.108, base: h * 0.697, hgt: s * 0.1, lean: 0.028 }, // the parent
    { x: cx + s * 0.205, base: h * 0.704, hgt: s * 0.098, cap: true }, // hand in hand —
    { x: cx + s * 0.252, base: h * 0.707, hgt: s * 0.06, candle: true }, // — with their small one
  ];
  const childX = cx - s * 0.054; // the child on tiptoe, lighting a wick
  const childBase = h * 0.688;
  const childH = s * 0.064;
  const maidX = cx + s * 0.104; // HER — in the crowd, not above it
  const maidBase = h * 0.692;
  const maidH = s * 0.105;

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
  /** A soft additive pool of firelight. */
  const glowAt = (x: number, y: number, r: number, a: number): void => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, shade(C.flame, 0.95, a));
    g.addColorStop(1, shade(C.flame, 0.95, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };
  /** A carried lantern — box, cap, hanger, and the light it is proud of. */
  const lanternAt = (lx: number, ly: number, sc: number): void => {
    glowAt(lx, ly, sc * 3.6, 0.3);
    ctx.fillStyle = shade(C.void, 1.0, 0.92);
    ctx.fillRect(lx - sc * 0.62, ly - sc * 0.85, sc * 1.24, sc * 1.7);
    ctx.fillStyle = mix(C.flame, C.flameHi, 0.5, 0.96);
    ctx.fillRect(lx - sc * 0.3, ly - sc * 0.45, sc * 0.6, sc * 0.95);
    ctx.strokeStyle = shade(C.void, 1.3, 0.9);
    ctx.lineWidth = 1;
    line(lx - sc * 0.78, ly - sc * 0.85, lx + sc * 0.78, ly - sc * 0.85);
    line(lx, ly - sc * 1.35, lx, ly - sc * 0.85);
  };
  /** Everyone's shadow falls away from the light — hers too, now. */
  const shadowOf = (x: number, base: number, hgt: number): void => {
    const dir = x >= cx ? 1 : -1;
    const len = hgt * (0.9 + Math.min(1, Math.abs(x - cx) / (s * 0.3)) * 0.7);
    const g = ctx.createLinearGradient(x, 0, x + dir * len, 0);
    g.addColorStop(0, shade(C.void, 0.4, 0.26));
    g.addColorStop(1, shade(C.void, 0.4, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - dir * hgt * 0.12, base - s * 0.002);
    ctx.quadraticCurveTo(x + dir * len * 0.5, base + hgt * 0.1, x + dir * len, base + hgt * 0.05);
    ctx.lineTo(x + dir * len, base - hgt * 0.02);
    ctx.quadraticCurveTo(x + dir * len * 0.5, base - hgt * 0.02, x - dir * hgt * 0.12, base - s * 0.006);
    ctx.closePath();
    ctx.fill();
  };
  /** A townsperson in woodcut: bell silhouette, small head, firelit rim. */
  const folkFig = (f: Folk): void => {
    const toward = f.x < cx ? 1 : -1; // which side of them the Flame is on
    const hgt = f.hgt;
    const wdt = hgt * 0.3;
    const hr2 = hgt * 0.125;
    const hxx = f.x + (f.lean ?? 0) * toward * hgt;
    const shY = f.base - hgt + hr2 * 2.05; // shoulder line
    const hy = f.base - hgt + hr2; // head center
    const bodyFill = f.fill ?? mix(C.inkSoft, C.void, 0.28 + rand() * 0.22);
    ctx.fillStyle = bodyFill;
    ctx.beginPath();
    ctx.moveTo(f.x - wdt, f.base);
    ctx.quadraticCurveTo(f.x - wdt * 0.98, f.base - hgt * 0.58, hxx - hr2 * 0.92, shY);
    ctx.quadraticCurveTo(hxx, shY - hr2 * 0.7, hxx + hr2 * 0.92, shY);
    ctx.quadraticCurveTo(f.x + wdt * 0.98, f.base - hgt * 0.58, f.x + wdt, f.base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s * 0.0014);
    ctx.stroke();
    // head
    ctx.fillStyle = mix(C.bone, C.ink, 0.64 + rand() * 0.1);
    ctx.beginPath();
    ctx.arc(hxx, hy, hr2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(0.8, s * 0.001);
    ctx.stroke();
    if (f.cap === true) {
      // a soft workman's cap, brim toward the light
      ctx.fillStyle = mix(C.ink, C.void, 0.3);
      ctx.beginPath();
      ctx.arc(hxx, hy - hr2 * 0.12, hr2 * 1.04, Math.PI * 0.95, Math.PI * 2.05);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(C.void, 1.1, 0.5);
      ctx.lineWidth = 1;
      line(hxx - hr2 * 1.05, hy - hr2 * 0.06, hxx + hr2 * 1.05, hy - hr2 * 0.06);
    }
    // firelight rim on the flame side — how the whole crowd is painted warm
    const rimA = Math.max(0.22, 0.62 - (Math.abs(f.x - cx) / s) * 1.1);
    ctx.strokeStyle = mix(C.flame, C.parchment, 0.32, rimA);
    ctx.lineWidth = Math.max(1, s * 0.0016);
    ctx.beginPath();
    ctx.moveTo(f.x + toward * wdt, f.base - hgt * 0.03);
    ctx.quadraticCurveTo(f.x + toward * wdt * 0.98, f.base - hgt * 0.58, hxx + toward * hr2 * 0.92, shY);
    ctx.stroke();
    ctx.beginPath(); // and along the near cheek
    if (toward === 1) ctx.arc(hxx, hy, hr2, -Math.PI * 0.35, Math.PI * 0.35);
    else ctx.arc(hxx, hy, hr2, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();
    if (f.lantern === true) {
      // lantern raised on a short pole, held out over the crowd
      const lx = hxx + toward * wdt * 1.35;
      const ly = f.base - hgt * (1.02 + rand() * 0.08);
      ctx.strokeStyle = bodyFill;
      ctx.lineWidth = Math.max(1.2, hgt * 0.07);
      ctx.lineCap = "round";
      line(hxx + toward * hr2 * 0.7, shY + hgt * 0.12, lx, ly + hgt * 0.2);
      ctx.lineCap = "butt";
      ctx.strokeStyle = shade(C.void, 1.2, 0.8);
      ctx.lineWidth = 1;
      line(lx, ly + hgt * 0.2, lx, ly);
      lanternAt(lx, ly, hgt * 0.1);
    }
    if (f.candle === true) {
      // a hand candle at the chest — every wick tonight was lit from hers
      const kx = hxx + toward * wdt * 0.5;
      const ky = f.base - hgt * 0.52;
      ctx.fillStyle = mix(C.parchment, C.void, 0.3);
      ctx.fillRect(kx - Math.max(0.8, s * 0.0016), ky, Math.max(1.6, s * 0.0032), hgt * 0.1);
      drop(kx, ky + s * 0.001, hgt * 0.16, Math.max(1, hgt * 0.035), 0, mix(C.flame, C.flameHi, 0.55, 0.95));
      glowAt(kx, ky - hgt * 0.06, hgt * 0.24, 0.22);
    }
  };

  // ── 1. night sky — void above, and a dusk of embers where the town is ────
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, C.void);
  sky.addColorStop(0.26, mix(C.void, C.surface, 0.55));
  sky.addColorStop(0.46, mix(mix(C.void, C.surface2, 0.95), C.ember, 0.11));
  sky.addColorStop(0.6, mix(mix(C.void, C.surface, 0.5), C.ember, 0.05));
  sky.addColorStop(1, shade(C.void, 0.85));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // ── 2. stars — the same sky as the first plate, keeping its distance ─────
  const mx = w * 0.205;
  const my = h * 0.088;
  const mr = s * 0.034;
  const nStars = Math.round(40 * Math.max(1, w / h));
  for (let i = 0; i < nStars; i++) {
    const sx = rand() * w;
    const sy = rand() * rand() * h * 0.26;
    if (Math.hypot(sx - mx, sy - my) < mr * 4) continue;
    const a = 0.08 + rand() * 0.3;
    const r = 0.4 + rand() * 0.8;
    ctx.fillStyle = mix(C.bone, C.parchment, 0.3, a);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, TAU);
    ctx.fill();
    if (rand() < 0.1) {
      ctx.strokeStyle = mix(C.bone, C.parchment, 0.3, a * 0.5);
      ctx.lineWidth = 0.7;
      line(sx - r * 3, sy, sx + r * 3, sy);
      line(sx, sy - r * 3, sx, sy + r * 3);
    }
  }

  // ── 3. crescent moon — smaller tonight; the town outshines it at last ────
  ctx.fillStyle = mix(C.bone, C.parchment, 0.35);
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = sky;
  ctx.beginPath();
  ctx.arc(mx + mr * 0.38, my - mr * 0.16, mr * 0.92, 0, TAU);
  ctx.fill();
  const moonHalo = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 4.4);
  moonHalo.addColorStop(0, mix(C.void, C.bone, 0.4, 0.12));
  moonHalo.addColorStop(1, mix(C.void, C.bone, 0.35, 0));
  ctx.fillStyle = moonHalo;
  ctx.fillRect(mx - mr * 4.4, my - mr * 4.4, mr * 8.8, mr * 8.8);

  // ── 4. the hill edge — and on it, small and dark, the old door ───────────
  ctx.fillStyle = mix(C.void, C.surface, 0.38);
  ctx.beginPath();
  ctx.moveTo(0, ridge(0));
  for (let x = 0; x <= w; x += w / 48) ctx.lineTo(x, ridge(x));
  ctx.lineTo(w, squareY + s * 0.02);
  ctx.lineTo(0, squareY + s * 0.02);
  ctx.closePath();
  ctx.fill();
  {
    // the door to the Vault — present, not threatening; it can wait
    const dX = w * 0.795;
    const dBase = ridge(dX) + s * 0.004;
    const dW = s * 0.011; // half-width
    const dH = s * 0.032;
    ctx.fillStyle = shade(C.void, 0.5);
    ctx.beginPath();
    ctx.moveTo(dX - dW, dBase);
    ctx.lineTo(dX - dW, dBase - dH + dW);
    ctx.arc(dX, dBase - dH + dW, dW, Math.PI, TAU);
    ctx.lineTo(dX + dW, dBase);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mix(C.void, C.boneDim, 0.3, 0.3);
    ctx.lineWidth = 1;
    ctx.stroke();
    // two leaning marker stones, keeping it company
    ctx.fillStyle = shade(C.void, 0.55);
    ctx.beginPath();
    ctx.moveTo(dX - dW * 2.6, dBase);
    ctx.lineTo(dX - dW * 2.1, dBase - dH * 0.34);
    ctx.lineTo(dX - dW * 1.7, dBase);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(dX + dW * 1.8, dBase);
    ctx.lineTo(dX + dW * 2.3, dBase - dH * 0.26);
    ctx.lineTo(dX + dW * 2.7, dBase);
    ctx.closePath();
    ctx.fill();
    // one faint verdigris breath at the seam — season two, asleep
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const breath = ctx.createRadialGradient(dX, dBase - dH * 0.45, 0, dX, dBase - dH * 0.45, s * 0.026);
    breath.addColorStop(0, shade(C.verdigrisDim, 1, 0.16));
    breath.addColorStop(1, shade(C.verdigrisDim, 1, 0));
    ctx.fillStyle = breath;
    ctx.fillRect(dX - s * 0.026, dBase - dH * 0.45 - s * 0.026, s * 0.052, s * 0.052);
    ctx.restore();
    ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.5, 0.45);
    ctx.lineWidth = 1;
    line(dX, dBase - dH + dW * 0.4, dX, dBase - s * 0.002);
    // the worn path down toward town — walked once, both ways
    ctx.strokeStyle = mix(C.void, C.boneDim, 0.3, 0.2);
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      const px0 = dX - w * 0.028 - t * w * 0.075;
      const py0 = ridge(px0) + s * (0.012 + t * 0.02);
      line(px0, py0, px0 - w * 0.012, py0 + s * 0.004);
    }
  }

  // ── 5. the town — same roofline vocabulary as the first plate, but every
  // window doubled; the whole crowd of houses collects its wick-pairs here
  const pairs: Array<{ x: number; y: number; sill: boolean }> = [];
  const chimneys: Array<{ x: number; y: number }> = [];
  const house = (
    hx0: number,
    baseY: number,
    bw: number,
    bh: number,
    roofH: number,
    opts: { fill: string; outlined?: boolean; lit?: number; chimney?: boolean },
  ): void => {
    const x0 = hx0 - bw / 2;
    const peakX = hx0 + (rand() - 0.5) * bw * 0.16;
    ctx.fillStyle = opts.fill;
    ctx.beginPath();
    ctx.moveTo(x0, baseY);
    ctx.lineTo(x0, baseY - bh);
    ctx.lineTo(x0 - bw * 0.1, baseY - bh); // eave
    ctx.lineTo(peakX, baseY - bh - roofH); // steep peak
    ctx.lineTo(x0 + bw * 1.1, baseY - bh);
    ctx.lineTo(x0 + bw, baseY - bh);
    ctx.lineTo(x0 + bw, baseY);
    ctx.closePath();
    ctx.fill();
    if (opts.outlined === true) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (opts.chimney === true) {
      const chx = hx0 + bw * (rand() < 0.5 ? -0.3 : 0.26);
      const chw = Math.max(2, bw * 0.09);
      const chTop = baseY - bh - roofH * 0.55;
      ctx.fillRect(chx, chTop, chw, roofH * 0.4);
      chimneys.push({ x: chx + chw / 2, y: chTop });
    }
    const lit = opts.lit ?? 0;
    for (let i = 0; i < lit; i++) {
      pairs.push({
        x: hx0 + (i - (lit - 1) / 2) * bw * 0.34 + (rand() - 0.5) * bw * 0.06,
        y: baseY - bh * (0.35 + rand() * 0.25),
        sill: true,
      });
    }
  };

  // back row — fog-stop haze against the hill, its pairs tiny and far
  const hazy = mix(C.void, C.surface, 0.62);
  for (const off of [-0.27, -0.19, -0.02, 0.115, 0.21] as const) {
    const hx0 = cx + s * (off + (rand() - 0.5) * 0.012);
    house(hx0, h * 0.516 + (rand() - 0.5) * s * 0.006, s * (0.05 + rand() * 0.018), s * (0.028 + rand() * 0.012), s * (0.032 + rand() * 0.014), {
      fill: hazy,
      lit: 1,
    });
  }
  // strip the haze row's pairs of their sills — too far to read them
  for (const p of pairs) p.sill = false;

  // front row — the square's far side, darkest cutouts, well peopled with light
  const dark = shade(C.void, 0.9);
  const frontRow: Array<{ off: number; lit: number; tall: number }> = [
    { off: -0.345, lit: 2, tall: 1.0 },
    { off: -0.25, lit: 2, tall: 1.2 },
    { off: -0.05, lit: 2, tall: 0.95 },
    { off: 0.06, lit: 2, tall: 1.15 },
    { off: 0.16, lit: 2, tall: 0.9 },
    { off: 0.255, lit: 2, tall: 1.1 },
    { off: 0.35, lit: 2, tall: 0.95 },
  ];
  for (const spec of frontRow) {
    const hx0 = cx + s * spec.off;
    house(
      hx0,
      squareY + s * 0.002,
      s * (0.062 + rand() * 0.02),
      s * (0.04 + rand() * 0.016) * spec.tall,
      s * (0.042 + rand() * 0.018),
      { fill: dark, outlined: true, lit: spec.lit, chimney: rand() < 0.7 },
    );
  }
  // the chapel — nave, tower, spire, finial; its lancet gets a pair too
  const chapX = cx - s * 0.155;
  house(chapX, squareY + s * 0.002, s * 0.052, s * 0.048, s * 0.046, { fill: dark, outlined: true, lit: 1 });
  {
    const tx = chapX + s * 0.04;
    const tw = s * 0.026;
    const th = s * 0.078;
    const spireH = s * 0.12;
    const tBase = squareY + s * 0.002;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(tx - tw / 2, tBase);
    ctx.lineTo(tx - tw / 2, tBase - th);
    ctx.lineTo(tx - tw * 0.72, tBase - th);
    ctx.lineTo(tx, tBase - th - spireH);
    ctx.lineTo(tx + tw * 0.72, tBase - th);
    ctx.lineTo(tx + tw / 2, tBase - th);
    ctx.lineTo(tx + tw / 2, tBase);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    const tipY = tBase - th - spireH;
    ctx.strokeStyle = shade(C.void, 0.95);
    ctx.lineWidth = 1.2;
    line(tx, tipY, tx, tipY - s * 0.013);
    line(tx - s * 0.0055, tipY - s * 0.0085, tx + s * 0.0055, tipY - s * 0.0085);
    pairs.push({ x: tx, y: tBase - th * 0.55, sill: true });
  }

  // ── 6. hearth-smoke — every hearth lit tonight; two or three admit it ────
  let smoked = 0;
  for (const ch of chimneys) {
    if (smoked >= 3 || rand() < 0.35) continue;
    smoked++;
    let sx = ch.x;
    let sy = ch.y - 2;
    for (let k = 0; k < 4; k++) {
      const pr = s * (0.0032 + k * 0.002) * (0.8 + rand() * 0.4);
      ctx.fillStyle = mix(C.void, C.bone, 0.4, 0.13 - k * 0.026);
      ctx.beginPath();
      ctx.ellipse(sx, sy, pr * (1.1 + rand() * 0.4), pr, rand() * 0.8 - 0.4, 0, TAU);
      ctx.fill();
      sx -= s * (0.005 + rand() * 0.005 + k * 0.0025);
      sy -= s * (0.008 + rand() * 0.004);
    }
  }

  // ── 7. the wick-pairs — TWO points in every window: one for the day, one
  // for her; near sills carry a lit lip so the pairing reads plainly
  const ww = Math.max(1.2, s * 0.0045);
  for (const p of pairs) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, ww * 6.5);
    g.addColorStop(0, shade(C.flame, 1, p.sill ? 0.17 : 0.11));
    g.addColorStop(1, shade(C.flame, 1, 0));
    ctx.fillStyle = g;
    ctx.fillRect(p.x - ww * 6.5, p.y - ww * 6.5, ww * 13, ww * 13);
    for (const k of [-1, 1] as const) {
      ctx.fillStyle = mix(C.flame, C.flameHi, rand() * 0.8);
      ctx.fillRect(p.x + k * ww * 1.1 - ww / 2, p.y - ww * (k < 0 ? 1.8 : 1.5), ww, ww * (k < 0 ? 1.8 : 1.5));
    }
    if (p.sill) {
      ctx.strokeStyle = mix(C.ember, C.flame, 0.3, 0.3);
      ctx.lineWidth = 1;
      line(p.x - ww * 2.7, p.y + 0.5, p.x + ww * 2.7, p.y + 0.5);
    }
  }

  // ── 8. the festival's own light in the air — the warmest sky in the game ─
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const bloom = ctx.createRadialGradient(cx, h * 0.52, 0, cx, h * 0.52, s * 0.82);
  bloom.addColorStop(0, shade(C.ember, 0.85, 0.17));
  bloom.addColorStop(0.55, shade(C.ember, 0.8, 0.08));
  bloom.addColorStop(1, shade(C.ember, 0.8, 0));
  ctx.fillStyle = bloom;
  ctx.fillRect(cx - s * 0.84, h * 0.52 - s * 0.84, s * 1.68, s * 1.68);
  const roofG = ctx.createRadialGradient(cx, squareY - s * 0.05, 0, cx, squareY - s * 0.05, s * 0.34);
  roofG.addColorStop(0, shade(C.ember, 0.85, 0.12));
  roofG.addColorStop(1, shade(C.ember, 0.85, 0));
  ctx.fillStyle = roofG;
  ctx.fillRect(cx - s * 0.36, squareY - s * 0.41, s * 0.72, s * 0.72);
  ctx.restore();

  // ── 9. wick-lines strung across the square — the festival, plainly said ──
  const swag = (x0: number, y0: number, x1: number, y1: number, sag: number, n: number): void => {
    const cxx = (x0 + x1) / 2;
    const cyy = (y0 + y1) / 2 + sag * 2;
    ctx.strokeStyle = mix(C.void, C.bone, 0.35, 0.28);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cxx, cyy, x1, y1);
    ctx.stroke();
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const it = 1 - t;
      const px0 = it * it * x0 + 2 * it * t * cxx + t * t * x1;
      const py0 = it * it * y0 + 2 * it * t * cyy + t * t * y1;
      if (i % 2 === 0) {
        // a little paper shade between the open wicks
        ctx.fillStyle = mix(C.parchmentAged, C.flame, 0.35, 0.5);
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        ctx.lineTo(px0 + s * 0.004, py0 + s * 0.006);
        ctx.lineTo(px0, py0 + s * 0.011);
        ctx.lineTo(px0 - s * 0.004, py0 + s * 0.006);
        ctx.closePath();
        ctx.fill();
      } else {
        glowAt(px0, py0 + s * 0.004, s * 0.011, 0.28);
        ctx.fillStyle = mix(C.flame, C.flameHi, 0.6, 0.95);
        ctx.fillRect(px0 - 0.7, py0 + s * 0.001, 1.4, Math.max(1.6, s * 0.005));
      }
    }
  };
  swag(w * 0.135, h * 0.402, w * 0.865, h * 0.396, s * 0.042, 13);
  swag(w * 0.235, h * 0.442, w * 0.765, h * 0.438, s * 0.028, 9);

  // ── 10. the square — stone that has forgotten how to be cold ────────────
  const floorG = ctx.createLinearGradient(0, squareY, 0, h);
  floorG.addColorStop(0, mix(mix(C.void, C.surface2, 0.78), C.ember, 0.06));
  floorG.addColorStop(0.35, mix(mix(C.void, C.surface, 0.56), C.ember, 0.03));
  floorG.addColorStop(1, shade(C.void, 0.6));
  ctx.fillStyle = floorG;
  ctx.fillRect(0, squareY, w, h - squareY);
  // firelight raking the far facades' feet
  ctx.strokeStyle = mix(C.ember, C.flame, 0.35, 0.18);
  ctx.lineWidth = 1;
  line(w * 0.17, squareY + 1, w * 0.44, squareY + 1);
  line(w * 0.56, squareY + 1, w * 0.83, squareY + 1);
  // the warm pool the plinth stands in
  ctx.save();
  ctx.translate(cx, plinthBase + s * 0.01);
  ctx.scale(1, 0.34);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.6);
  pool.addColorStop(0, mix(C.ember, C.flame, 0.5, 0.42));
  pool.addColorStop(0.5, shade(C.ember, 0.75, 0.17));
  pool.addColorStop(1, shade(C.ember, 0.75, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-s * 0.62, -s * 0.62, s * 1.24, s * 1.24);
  ctx.restore();
  glowAt(cx, plinthTop, s * 0.62, 0.18); // and the whole square, generously
  // cobble courses — a few quiet arcs around the Flame, nothing below the
  // caption's floor
  ctx.save();
  ctx.translate(cx, plinthBase + s * 0.012);
  ctx.scale(1, 0.34);
  for (const rr of [0.13, 0.205, 0.285] as const) {
    ctx.strokeStyle = shade(C.surface2, 1.45, 0.17 - rr * 0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, s * rr, Math.PI * (0.06 + rand() * 0.05), Math.PI * (0.94 - rand() * 0.05));
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (0.15 + rand() * 0.7);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * rr, Math.sin(a) * s * rr);
      ctx.lineTo(Math.cos(a) * s * (rr + 0.028), Math.sin(a) * s * (rr + 0.028));
      ctx.stroke();
    }
  }
  ctx.restore();

  // ── 11. shadows — all of them lawful, all falling away from her light ────
  for (const f of backFolk) shadowOf(f.x, f.base, f.hgt);
  for (const f of nearFolk) shadowOf(f.x, f.base, f.hgt);
  shadowOf(childX, childBase, childH);
  shadowOf(maidX, maidBase, maidH);

  // ── 12. the far ring of the crowd, behind the plinth ────────────────────
  for (const f of backFolk) folkFig(f);

  // ── 13. the plinth — stone raised by the town, tallied with the hundred ──
  ctx.fillStyle = mix(C.void, C.boneDim, 0.24);
  ctx.fillRect(cx - pHalf * 1.45, plinthBase - s * 0.012, pHalf * 2.9, s * 0.014); // base slab
  ctx.fillStyle = mix(C.void, C.boneDim, 0.3);
  ctx.fillRect(cx - pHalf, plinthTop + s * 0.008, pHalf * 2, plinthH - s * 0.018); // shaft
  ctx.fillStyle = mix(C.void, C.boneDim, 0.38);
  ctx.fillRect(cx - pHalf * 1.2, plinthTop, pHalf * 2.4, s * 0.01); // cap slab
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - pHalf * 1.45, plinthBase - s * 0.012, pHalf * 2.9, s * 0.014);
  ctx.strokeRect(cx - pHalf, plinthTop + s * 0.008, pHalf * 2, plinthH - s * 0.018);
  ctx.strokeRect(cx - pHalf * 1.2, plinthTop, pHalf * 2.4, s * 0.01);
  // firelight on the cap's lip
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.3, 0.55);
  line(cx - pHalf * 1.2, plinthTop, cx + pHalf * 1.2, plinthTop);
  // one hundred small marks on the shaft face — one per candle given
  ctx.strokeStyle = mix(C.goldInk, C.flame, 0.3, 0.28);
  ctx.lineWidth = Math.max(0.6, s * 0.0008);
  for (const [rowY, nT] of [
    [plinthTop + s * 0.019, 9],
    [plinthTop + s * 0.03, 8],
  ] as const) {
    for (let i = 0; i < nT; i++) {
      const tx = cx - pHalf * 0.82 + (i + 0.5) * ((pHalf * 1.64) / nT);
      line(tx, rowY - s * 0.0028, tx, rowY + s * 0.0028);
    }
  }
  // the gilded ring of her office, laid flat around the stub at last
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.4, 0.6);
  ctx.lineWidth = Math.max(1, s * 0.0014);
  ctx.beginPath();
  ctx.ellipse(cx, plinthTop + s * 0.003, stubW * 2.1, stubW * 0.55, 0, 0, TAU);
  ctx.stroke();

  // ── 14. THE FIRST FLAME — fed by a hundred candles, tall and calm ───────
  // the stub — mother-wax with a melted skirt, warm to the crown
  const stubBase = plinthTop + s * 0.002;
  const stub = new Path2D();
  stub.moveTo(cx - stubW, stubTop + s * 0.003);
  stub.bezierCurveTo(cx - stubW * 1.15, stubBase - stubH * 0.5, cx - stubW * 1.3, stubBase - stubH * 0.2, cx - stubW * 1.45, stubBase);
  stub.quadraticCurveTo(cx - stubW * 0.5, stubBase + s * 0.004, cx + stubW * 0.3, stubBase + s * 0.002);
  stub.quadraticCurveTo(cx + stubW * 0.9, stubBase + s * 0.005, cx + stubW * 1.4, stubBase);
  stub.bezierCurveTo(cx + stubW * 1.25, stubBase - stubH * 0.3, cx + stubW * 1.1, stubBase - stubH * 0.55, cx + stubW, stubTop + s * 0.003);
  stub.closePath();
  const stubG = ctx.createLinearGradient(0, stubTop, 0, stubBase);
  stubG.addColorStop(0, mix(C.parchment, C.flame, 0.35, 0.98));
  stubG.addColorStop(0.45, mix(C.parchmentAged, C.ember, 0.3));
  stubG.addColorStop(1, mix(C.parchmentAged, C.void, 0.4));
  ctx.fillStyle = stubG;
  ctx.fill(stub);
  ctx.strokeStyle = shade(C.void, 0.9, 0.4);
  ctx.lineWidth = 1;
  ctx.stroke(stub);
  ctx.strokeStyle = mix(C.parchment, C.flame, 0.25, 0.4); // two set drips
  for (const dxf of [-0.55, 0.5] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + stubW * dxf, stubTop + s * 0.005);
    ctx.quadraticCurveTo(cx + stubW * (dxf - 0.1), stubTop + stubH * 0.55, cx + stubW * (dxf + 0.08), stubBase - s * 0.003);
    ctx.stroke();
  }
  ctx.fillStyle = mix(C.flame, C.flameHi, 0.5, 0.98); // molten crown, brimming
  ctx.beginPath();
  ctx.ellipse(cx, stubTop, stubW * 0.85, stubW * 0.3, 0, 0, TAU);
  ctx.fill();
  // the flame itself — tall, calm, past all argument
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(cx, flameCy, 0, cx, flameCy, s * 0.34);
  halo.addColorStop(0, shade(C.flame, 0.9, 0.48));
  halo.addColorStop(0.5, shade(C.ember, 0.85, 0.18));
  halo.addColorStop(1, shade(C.ember, 0.85, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - s * 0.36, flameCy - s * 0.36, s * 0.72, s * 0.72);
  ctx.restore();
  drop(cx, stubTop + s * 0.002, flameH * 1.15, s * 0.016, s * 0.002, shade(C.flame, 1, 0.95));
  drop(cx, stubTop - s * 0.002, flameH * 0.85, s * 0.0102, s * 0.0012, C.flameHi);
  drop(cx, stubTop - s * 0.004, flameH * 0.5, s * 0.0056, 0, shade(C.flameHi, 1.6));
  // its light breathing up into the night — round-shouldered, no beam edges
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.save();
  ctx.translate(cx, stubTop - flameH * 1.3);
  ctx.scale(0.5, 1);
  const breathUp = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.24);
  breathUp.addColorStop(0, shade(C.flame, 0.8, 0.09));
  breathUp.addColorStop(1, shade(C.ember, 0.75, 0));
  ctx.fillStyle = breathUp;
  ctx.fillRect(-h * 0.26, -h * 0.26, h * 0.52, h * 0.52);
  ctx.restore(); // back to page space; "lighter" still holds for the sparks
  for (let i = 0; i < 9; i++) {
    const t = rand();
    const sy = stubTop - flameH * 1.05 - t * h * 0.26;
    const sx = cx + Math.sin(i * 2.3 + t * 5.5) * s * (0.01 + t * 0.03);
    ctx.fillStyle = mix(C.flameHi, C.flame, rand() * 0.5, 0.65 * (1 - t * 0.8));
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(0.6, s * 0.0011 * (1.3 - t)), 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // ── 15. the near ring — the town standing easy around its light ─────────
  for (const f of nearFolk) folkFig(f);
  {
    // the hands between the pair on the right — a small thing, held anyway
    const a = nearFolk[2];
    const b = nearFolk[3];
    if (a !== undefined && b !== undefined) {
      ctx.strokeStyle = mix(C.inkSoft, C.void, 0.32);
      ctx.lineWidth = Math.max(1.2, s * 0.003);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x + a.hgt * 0.22, a.base - a.hgt * 0.4);
      ctx.quadraticCurveTo((a.x + b.x) / 2, a.base - a.hgt * 0.26, b.x - b.hgt * 0.24, b.base - b.hgt * 0.5);
      ctx.stroke();
      ctx.lineCap = "butt";
    }
  }

  // ── 16. the child on tiptoe — lighting tomorrow's wick from the Flame ───
  {
    const hgt = childH;
    const wdt = hgt * 0.26;
    const hr2 = hgt * 0.135;
    const shY = childBase - hgt + hr2 * 2.0;
    const hy = childBase - hgt + hr2;
    const fill = mix(C.inkSoft, C.void, 0.34);
    // the hem rides up — heels off the stone, toes doing all the believing
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(childX - wdt, childBase - hgt * 0.07);
    ctx.quadraticCurveTo(childX - wdt * 0.95, childBase - hgt * 0.6, childX - hr2 * 0.85, shY);
    ctx.quadraticCurveTo(childX + hr2 * 0.1, shY - hr2 * 0.6, childX + hr2 * 0.95, shY + hgt * 0.02);
    ctx.quadraticCurveTo(childX + wdt * 0.95, childBase - hgt * 0.58, childX + wdt * 0.9, childBase - hgt * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s * 0.0014);
    ctx.stroke();
    // legs on tiptoe — heels high, only the toes touching
    ctx.strokeStyle = shade(C.void, 1.0, 0.9);
    ctx.lineWidth = Math.max(1.2, hgt * 0.055);
    ctx.lineCap = "round";
    line(childX - wdt * 0.34, childBase - hgt * 0.07, childX - wdt * 0.22, childBase - s * 0.001);
    line(childX + wdt * 0.28, childBase - hgt * 0.075, childX + wdt * 0.42, childBase - s * 0.001);
    ctx.lineCap = "butt";
    // head tipped back to watch the wick catch
    ctx.fillStyle = mix(C.bone, C.ink, 0.6);
    ctx.beginPath();
    ctx.arc(childX + hr2 * 0.2, hy - hr2 * 0.12, hr2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(0.8, s * 0.001);
    ctx.stroke();
    // the whole face given to the light
    ctx.strokeStyle = mix(C.flame, C.parchment, 0.35, 0.75);
    ctx.lineWidth = Math.max(1, s * 0.0016);
    ctx.beginPath();
    ctx.arc(childX + hr2 * 0.2, hy - hr2 * 0.12, hr2, -Math.PI * 0.45, Math.PI * 0.4);
    ctx.stroke();
    // the reaching arm, up and toward the Flame
    const handX = cx - s * 0.036;
    const handY = plinthTop - s * 0.004;
    ctx.strokeStyle = fill;
    ctx.lineWidth = Math.max(1.4, hgt * 0.09);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(childX + hr2 * 0.7, shY + hgt * 0.06);
    ctx.quadraticCurveTo(childX + hgt * 0.34, shY - hgt * 0.14, handX, handY);
    ctx.stroke();
    ctx.lineCap = "butt";
    // the taper — and the catch at the crown's edge, clear of the great
    // flame's glare: the season's smallest, newest light
    ctx.strokeStyle = mix(C.parchmentAged, C.parchment, 0.6, 0.95);
    ctx.lineWidth = Math.max(1, s * 0.0015);
    line(handX, handY, cx - s * 0.0185, stubTop + s * 0.004);
    glowAt(cx - s * 0.0185, stubTop - s * 0.004, s * 0.02, 0.42);
    drop(cx - s * 0.0185, stubTop + s * 0.004, s * 0.016, s * 0.0034, -s * 0.0008, shade(C.flameHi, 1.3, 0.98));
  }
  {
    // the parent's hand finding the small shoulder — steadying, not stopping
    const par = nearFolk[1];
    if (par !== undefined) {
      ctx.strokeStyle = mix(C.inkSoft, C.void, 0.3);
      ctx.lineWidth = Math.max(1.4, par.hgt * 0.07);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(par.x + par.hgt * 0.2, par.base - par.hgt * 0.66);
      ctx.quadraticCurveTo((par.x + childX) / 2, par.base - par.hgt * 0.6, childX - childH * 0.2, childBase - childH * 0.78);
      ctx.stroke();
      ctx.lineCap = "butt";
    }
  }

  // ── 17. HER — small, unhooded, at ease; part of the crowd at last ───────
  {
    const mH = maidH;
    const wdt = mH * 0.29;
    const hr2 = mH * 0.125;
    const hxx = maidX - mH * 0.015; // the faintest lean toward her flame
    const shY = maidBase - mH + hr2 * 2.05;
    const hy = maidBase - mH + hr2;
    // the robe — the same quiet bell as everyone else's tonight, but the
    // hem still remembers the melt (meeting plate 4's wax bumps, small)
    ctx.fillStyle = mix(C.inkSoft, C.void, 0.26);
    ctx.beginPath();
    ctx.moveTo(maidX - wdt, maidBase);
    ctx.quadraticCurveTo(maidX - wdt * 0.98, maidBase - mH * 0.58, hxx - hr2 * 0.92, shY);
    ctx.quadraticCurveTo(hxx, shY - hr2 * 0.7, hxx + hr2 * 0.92, shY);
    ctx.quadraticCurveTo(maidX + wdt * 0.98, maidBase - mH * 0.58, maidX + wdt, maidBase);
    ctx.quadraticCurveTo(maidX + wdt * 0.5, maidBase + mH * 0.022, maidX + wdt * 0.15, maidBase + mH * 0.004);
    ctx.quadraticCurveTo(maidX - wdt * 0.25, maidBase + mH * 0.026, maidX - wdt * 0.6, maidBase + mH * 0.006);
    ctx.quadraticCurveTo(maidX - wdt * 0.85, maidBase + mH * 0.016, maidX - wdt, maidBase);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s * 0.0016);
    ctx.stroke();
    // the hood, down for good — pooled in a soft roll at her shoulders
    ctx.fillStyle = mix(C.inkSoft, C.void, 0.16);
    ctx.beginPath();
    ctx.ellipse(hxx + hr2 * 0.5, shY + hr2 * 0.25, hr2 * 1.05, hr2 * 0.48, -0.25, 0, TAU);
    ctx.fill();
    // her hands, folded loose in front — done holding anything up
    ctx.fillStyle = mix(C.parchment, C.flame, 0.24, 0.55);
    ctx.beginPath();
    ctx.ellipse(maidX - wdt * 0.18, maidBase - mH * 0.44, hr2 * 0.42, hr2 * 0.3, 0.2, 0, TAU);
    ctx.fill();
    // head — bare, the first crowd that has ever seen it
    ctx.fillStyle = mix(C.bone, C.ink, 0.58);
    ctx.beginPath();
    ctx.arc(hxx, hy, hr2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(0.8, s * 0.001);
    ctx.stroke();
    // grey-streaked hair, combed back to the gather at her nape (plate 4's
    // head exactly, at festival distance) — the one bright bare head here
    ctx.fillStyle = mix(C.ink, C.boneDim, 0.46);
    ctx.beginPath();
    ctx.arc(hxx, hy - hr2 * 0.08, hr2 * 1.08, Math.PI * 0.88, Math.PI * 2.16);
    ctx.quadraticCurveTo(hxx + hr2 * 1.05, hy + hr2 * 0.35, hxx + hr2 * 0.75, hy + hr2 * 0.62);
    ctx.quadraticCurveTo(hxx + hr2 * 0.3, hy + hr2 * 0.1, hxx - hr2 * 0.9, hy + hr2 * 0.28);
    ctx.closePath();
    ctx.fill();
    // the silver riding the comb-lines
    ctx.strokeStyle = mix(C.boneDim, C.parchment, 0.4, 0.75);
    ctx.lineWidth = Math.max(0.8, hr2 * 0.11);
    ctx.beginPath();
    ctx.moveTo(hxx - hr2 * 0.75, hy - hr2 * 0.55);
    ctx.quadraticCurveTo(hxx + hr2 * 0.2, hy - hr2 * 1.15, hxx + hr2 * 0.72, hy + hr2 * 0.3);
    ctx.moveTo(hxx - hr2 * 0.35, hy - hr2 * 0.9);
    ctx.quadraticCurveTo(hxx + hr2 * 0.45, hy - hr2 * 0.85, hxx + hr2 * 0.68, hy + hr2 * 0.5);
    ctx.stroke();
    // the gather at the nape, and its coil of silver
    ctx.fillStyle = mix(C.ink, C.boneDim, 0.36);
    ctx.beginPath();
    ctx.ellipse(hxx + hr2 * 0.72, hy + hr2 * 0.52, hr2 * 0.3, hr2 * 0.24, 0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = mix(C.boneDim, C.parchment, 0.3, 0.45);
    ctx.lineWidth = Math.max(0.7, hr2 * 0.08);
    ctx.beginPath();
    ctx.arc(hxx + hr2 * 0.72, hy + hr2 * 0.52, hr2 * 0.17, -Math.PI * 0.8, Math.PI * 0.3);
    ctx.stroke();
    // the long braid over her front shoulder, singed at the tip — hers,
    // unmistakably, even this small
    const brTop = hy + hr2 * 0.85;
    const brEnd = hy + hr2 * 4.1;
    const brP = (t: number): [number, number] => [
      hxx - hr2 * (0.5 + t * 0.55) + Math.sin(t * 2.9) * hr2 * 0.16,
      brTop + t * (brEnd - brTop),
    ];
    ctx.lineCap = "round";
    for (const [wk, colr] of [
      [1, mix(C.ink, C.boneDim, 0.38)],
      [0.55, mix(C.ink, C.boneDim, 0.68)], // the grey heart of the plait
    ] as const) {
      for (let t = 0; t < 0.99; t += 0.09) {
        const [bx, by] = brP(t);
        const [nx, ny] = brP(Math.min(1, t + 0.1));
        ctx.strokeStyle = t > 0.88 ? shade(C.void, 1.2) : colr;
        ctx.lineWidth = Math.max(1, hr2 * 0.38 * wk * (1 - t * 0.5));
        line(bx, by, nx, ny);
      }
    }
    // herringbone — three little diagonals, the way a plait actually sits
    ctx.lineWidth = Math.max(0.6, hr2 * 0.07);
    let flip = 1;
    for (let t = 0.14; t < 0.8; t += 0.22) {
      const [bx, by] = brP(t);
      const bw2 = hr2 * 0.17 * (1 - t * 0.4);
      ctx.strokeStyle = flip > 0 ? mix(C.boneDim, C.parchment, 0.25, 0.45) : shade(C.void, 0.9, 0.45);
      line(bx - bw2 * flip, by - bw2 * 0.8, bx + bw2 * flip, by + bw2 * 0.5);
      flip = -flip;
    }
    ctx.lineCap = "butt";
    const [tipX, tipY] = brP(1); // the singe, and its one thinking ember
    ctx.fillStyle = mix(C.ember, C.flame, 0.45, 0.88);
    ctx.beginPath();
    ctx.arc(tipX, tipY, Math.max(0.8, hr2 * 0.14), 0, TAU);
    ctx.fill();
    // firelight along her crown — bare hair holding the light, plate 4's gift
    ctx.strokeStyle = mix(C.flame, C.flameHi, 0.3, 0.5);
    ctx.lineWidth = Math.max(0.8, s * 0.001);
    ctx.beginPath();
    ctx.arc(hxx, hy - hr2 * 0.08, hr2 * 1.06, Math.PI * 0.98, Math.PI * 1.55);
    ctx.stroke();
    // firelight down her whole front — she is facing her light, in company
    ctx.strokeStyle = mix(C.flame, C.parchment, 0.32, 0.7);
    ctx.lineWidth = Math.max(1, s * 0.0016);
    ctx.beginPath();
    ctx.moveTo(maidX - wdt, maidBase - mH * 0.03);
    ctx.quadraticCurveTo(maidX - wdt * 0.98, maidBase - mH * 0.58, hxx - hr2 * 0.92, shY);
    ctx.stroke();
    ctx.beginPath(); // the lit cheek — and nothing asked of it
    ctx.arc(hxx, hy, hr2, Math.PI * 0.62, Math.PI * 1.38);
    ctx.stroke();
  }

  // ── 18. the near houses flanking the square — their sills carry the pairs
  // plainly: one for the day, one for her
  const sillWindow = (x: number, y: number, wdt: number): void => {
    const hgt2 = wdt * 1.26;
    ctx.fillStyle = mix(C.void, C.ember, 0.28); // a hearth somewhere inside
    ctx.fillRect(x - wdt / 2, y - hgt2, wdt, hgt2);
    ctx.strokeStyle = shade(C.void, 1.3, 0.8);
    ctx.lineWidth = 1;
    ctx.strokeRect(x - wdt / 2, y - hgt2, wdt, hgt2);
    line(x, y - hgt2 + 1, x, y - 1); // mullion, one pane for each point
    ctx.fillStyle = mix(C.ember, C.flame, 0.5, 0.5); // the lit sill lip
    ctx.fillRect(x - wdt * 0.62, y, wdt * 1.24, Math.max(1.2, s * 0.0026));
    for (const k of [-1, 1] as const) {
      const kx = x + k * wdt * 0.24;
      const stH = s * (k < 0 ? 0.013 : 0.01); // hand-set, not minted — uneven
      ctx.fillStyle = mix(C.parchment, C.void, 0.25);
      ctx.fillRect(kx - Math.max(1, s * 0.0022), y - stH, Math.max(2, s * 0.0044), stH);
      glowAt(kx, y - stH - s * 0.006, s * 0.016, 0.3);
      drop(kx, y - stH + s * 0.001, s * 0.0135, s * 0.0032, k * s * 0.0006, mix(C.flame, C.flameHi, 0.55, 0.98));
    }
  };
  for (const side of [-1, 1] as const) {
    const edge = side === -1 ? 0 : w;
    const inward = side === -1 ? 1 : -1;
    const topY = h * 0.3 + (side === 1 ? h * 0.014 : 0);
    ctx.fillStyle = shade(C.void, 0.82);
    ctx.beginPath();
    ctx.moveTo(edge, h * 0.84);
    ctx.lineTo(edge, topY - s * 0.055);
    ctx.lineTo(edge + inward * w * 0.135, topY + s * 0.006); // roof to eave tip
    ctx.lineTo(edge + inward * w * 0.125, topY + s * 0.018); // tuck under it
    ctx.lineTo(edge + inward * w * 0.125, h * 0.84);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    // the Flame's light raking the inner jamb
    const rake = ctx.createLinearGradient(0, topY + s * 0.05, 0, h * 0.74);
    rake.addColorStop(0, mix(C.ember, C.flame, 0.4, 0.1));
    rake.addColorStop(0.55, mix(C.ember, C.flame, 0.4, 0.34));
    rake.addColorStop(1, mix(C.ember, C.flame, 0.4, 0.05));
    ctx.strokeStyle = rake;
    ctx.lineWidth = Math.max(1.2, s * 0.0018);
    line(edge + inward * w * 0.125, topY + s * 0.03, edge + inward * w * 0.125, h * 0.76);
    // two sills each — the pairing the whole plate keeps its word with
    const wx = edge + inward * w * 0.067;
    sillWindow(wx, h * (side === -1 ? 0.455 : 0.443), s * 0.048);
    sillWindow(wx, h * (side === -1 ? 0.607 : 0.588), s * 0.052);
  }

  // ── 19. air — gold motes over the whole square; the night keeps only its
  // far corner cold, and even that is just asleep
  for (let i = 0; i < 26; i++) {
    const ax = rand() * w;
    const ay = h * 0.3 + rand() * (h * 0.42);
    ctx.fillStyle = mix(C.flameHi, C.bone, 0.45, 0.05 + rand() * 0.08);
    ctx.beginPath();
    ctx.arc(ax, ay, 0.5 + rand() * 0.9, 0, TAU);
    ctx.fill();
  }

  // ── 20. grain, crush, vignette — the caption zone stays festival-calm ────
  for (let i = 0; i < 460; i++) {
    const gx = rand() * w;
    const gy = rand() * h * 0.8;
    ctx.fillStyle = rand() < 0.6 ? shade(C.bone, 1, 0.012 + rand() * 0.02) : shade(C.void, 0.35, 0.025 + rand() * 0.025);
    ctx.fillRect(gx, gy, 1, 1);
  }
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.15);
  top.addColorStop(0, shade(C.void, 0.6, 0.55));
  top.addColorStop(1, shade(C.void, 0.6, 0));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h * 0.15);
  const settle = ctx.createLinearGradient(0, h * 0.735, 0, h);
  settle.addColorStop(0, shade(C.void, 0.55, 0));
  settle.addColorStop(0.5, shade(C.void, 0.55, 0.45));
  settle.addColorStop(1, shade(C.void, 0.5, 0.82));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.735, w, h * 0.265);
  const vr = s * 0.6;
  for (const [vx, vy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    const v = ctx.createRadialGradient(vx, vy, vr * 0.3, vx, vy, vr);
    v.addColorStop(0, shade(C.void, 0.5, 0.26));
    v.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}
