/**
 * Story slide 2 — "The Tithe." Interior of the town's Tithe-hall at night,
 * painted in the guildhall idiom (woodcut flats, three fog stops, one warm
 * amber, one verdigris, no speckle). A procession of small hooded figures
 * carries candles down toward the great stone mouth in the floor; inside it
 * a river of faint amber light drains into blackness. An elder stands aside,
 * watching. The center-bottom third is kept calm and dark for caption text.
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

/**
 * One hooded silhouette (flat woodcut robe + hood), facing f = +1 right /
 * -1 left. Fills `tone`, then closes the shape with a thin ink outline.
 */
function hoodedBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  footY: number,
  ht: number,
  f: number,
  tone: string,
): void {
  const bw = ht * 0.46;
  const lean = ht * 0.07;
  const X = (o: number): number => x + f * o;
  ctx.beginPath();
  ctx.moveTo(X(-bw * 0.5), footY); // back hem
  ctx.quadraticCurveTo(X(-bw * 0.46 + lean * 0.4), footY - ht * 0.42, X(-bw * 0.26 + lean), footY - ht * 0.66);
  ctx.quadraticCurveTo(X(-bw * 0.3 + lean), footY - ht * 0.94, X(lean * 1.15), footY - ht); // crown
  ctx.quadraticCurveTo(X(bw * 0.42 + lean), footY - ht * 0.96, X(bw * 0.3 + lean), footY - ht * 0.7); // hood front
  ctx.quadraticCurveTo(X(bw * 0.5 + lean * 0.4), footY - ht * 0.38, X(bw * 0.5), footY); // front hem
  ctx.closePath();
  ctx.fillStyle = tone;
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.7, 0.9);
  ctx.lineWidth = 1;
  ctx.stroke();
  // the hollow of the hood
  ctx.fillStyle = shade(C.void, 0.85);
  ctx.beginPath();
  ctx.ellipse(X(bw * 0.13 + lean * 0.6), footY - ht * 0.82, bw * 0.15, ht * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Candle point: soft glow disc, a sliver of stick, flame core + hi spark. */
function candle(ctx: CanvasRenderingContext2D, cx: number, cy: number, ht: number): void {
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, ht * 0.55);
  glow.addColorStop(0, shade(C.flame, 1, 0.3));
  glow.addColorStop(0.45, shade(C.ember, 1, 0.11));
  glow.addColorStop(1, shade(C.ember, 1, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, ht * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(C.parchmentAged, C.void, 0.35, 0.8);
  ctx.fillRect(cx - 0.75, cy + 1.5, 1.5, ht * 0.08);
  ctx.fillStyle = shade(C.flame, 1, 0.9);
  ctx.beginPath();
  ctx.arc(cx, cy, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.flameHi;
  ctx.fillRect(cx - 0.6, cy - 1.6, 1.2, 2.6);
}

export function paintTithe(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const rand = titheRand(0x7f7e3);
  const floorY = h * 0.635;
  const wallTop = h * 0.07;
  // the stone mouth in the floor
  const mx = w * 0.555;
  const my = h * 0.575;
  const rx = Math.max(Math.min(w * 0.21, h * 0.26, 190), 60);
  const ry = rx * 0.42;

  // 1. base void gradient — the hall breathes faint warmth at mid-height
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, C.void);
  base.addColorStop(0.42, mix(C.void, C.surface, 0.42));
  base.addColorStop(0.62, mix(C.void, C.surface2, 0.4));
  base.addColorStop(1, shade(C.void, 0.82));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // 2. far wall — fog stop 1: flat masonry with tall lancet recesses
  ctx.fillStyle = mix(C.void, C.surface, 0.3);
  ctx.fillRect(0, wallTop, w, floorY - wallTop);
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue; // the center bay is kept blank for the emblem
    const aw = w * (0.075 + rand() * 0.025);
    const ax = ((i + 0.5) / 5) * w + (rand() - 0.5) * 0.03 * w - aw / 2;
    const atop = wallTop + h * (0.055 + rand() * 0.03);
    ctx.fillStyle = mix(C.void, C.surface, 0.12);
    ctx.beginPath();
    ctx.moveTo(ax, floorY - h * 0.015);
    ctx.lineTo(ax, atop + aw / 2);
    ctx.arc(ax + aw / 2, atop + aw / 2, aw / 2, Math.PI, 0);
    ctx.lineTo(ax + aw, floorY - h * 0.015);
    ctx.closePath();
    ctx.fill();
    // pilaster edge catching what little light there is
    ctx.strokeStyle = mix(C.void, C.surface, 0.5, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax - 2, floorY - h * 0.015);
    ctx.lineTo(ax - 2, atop + aw * 0.3);
    ctx.stroke();
  }
  // frieze line
  ctx.strokeStyle = shade(C.surface2, 1.25, 0.25);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, wallTop + h * 0.022);
  ctx.lineTo(w, wallTop + h * 0.022);
  ctx.stroke();

  // 2b. carved emblem on the center bay — a dim echo of the Great Gate
  const er = Math.min(w * 0.115, h * 0.085);
  const ey = h * 0.295;
  ctx.strokeStyle = shade(C.surface2, 1.3, 0.3);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mx, ey, er, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mx, ey, er * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = mix(C.verdigrisDim, C.void, 0.35, 0.35);
  ctx.beginPath();
  ctx.moveTo(mx, ey - er * 0.9);
  ctx.lineTo(mx, ey + er * 0.9);
  ctx.stroke();

  // 3. hanging censer chains — faint dotted verticals from the dark above
  for (const chx of [w * 0.16, w * 0.84]) {
    ctx.fillStyle = mix(C.void, C.bone, 0.22, 0.4);
    const links = 9;
    for (let i = 0; i < links; i++) {
      const t = i / (links - 1);
      ctx.fillRect(chx + Math.sin(t * 5) * 1.5, h * 0.005 + t * h * 0.15, 2, 2);
    }
    ctx.save();
    ctx.translate(chx, h * 0.165);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = mix(C.void, C.surface2, 0.85);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
    ctx.fillStyle = shade(C.ember, 1, 0.45);
    ctx.fillRect(chx - 1, h * 0.163, 2, 2);
  }

  // 4. fog band along the wall base — fog stop 2
  const fog = ctx.createLinearGradient(0, floorY - h * 0.07, 0, floorY + h * 0.02);
  fog.addColorStop(0, mix(C.void, C.bone, 0.09, 0));
  fog.addColorStop(0.55, mix(C.void, C.bone, 0.09, 0.5));
  fog.addColorStop(1, mix(C.void, C.bone, 0.09, 0));
  ctx.fillStyle = fog;
  ctx.fillRect(0, floorY - h * 0.07, w, h * 0.09);

  // 5. floor — flagstones receding, darkening toward the viewer
  const floor = ctx.createLinearGradient(0, floorY, 0, h);
  floor.addColorStop(0, mix(C.void, C.surface, 0.34));
  floor.addColorStop(0.45, mix(C.void, C.surface, 0.18));
  floor.addColorStop(1, shade(C.void, 0.75));
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, w, h - floorY);
  for (const k of [0.1, 0.24, 0.42, 0.65]) {
    ctx.strokeStyle = shade(C.surface2, 1.1, Math.max(0.06, 0.2 - k * 0.14));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, floorY + (h - floorY) * k + (rand() - 0.5) * 2);
    ctx.lineTo(w, floorY + (h - floorY) * k + (rand() - 0.5) * 2);
    ctx.stroke();
  }

  // 6. amber uplight breathing out of the mouth
  const up = ctx.createRadialGradient(mx, my - ry * 0.8, 0, mx, my - ry * 0.8, rx * 1.7);
  up.addColorStop(0, shade(C.ember, 1, 0.12));
  up.addColorStop(1, shade(C.ember, 1, 0));
  ctx.fillStyle = up;
  ctx.fillRect(mx - rx * 1.8, my - ry * 0.8 - rx * 1.7, rx * 3.6, rx * 2.4);

  // 7. the great stone mouth — carved rim ring
  const rxO = rx * 1.25;
  const ryO = ry * 1.35;
  const rim = ctx.createLinearGradient(0, my - ryO, 0, my + ryO);
  rim.addColorStop(0, mix(C.void, C.surface2, 0.65));
  rim.addColorStop(1, mix(C.void, C.surface2, 0.95));
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(mx, my, rxO, ryO, 0, 0, Math.PI * 2);
  ctx.fill();
  // carved tooth-notches around the ring
  ctx.strokeStyle = shade(C.void, 0.75, 0.5);
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rand() * 0.06;
    ctx.beginPath();
    ctx.moveTo(mx + Math.cos(a) * rx * 1.03, my + Math.sin(a) * ry * 1.05);
    ctx.lineTo(mx + Math.cos(a) * rxO * 0.97, my + Math.sin(a) * ryO * 0.95);
    ctx.stroke();
  }

  // 8. down the chute — the river of light draining into blackness
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = shade(C.void, 0.55);
  ctx.fillRect(mx - rx, my - ry, rx * 2, ry * 2);
  // amber wash on the far inner wall
  const wash = ctx.createLinearGradient(0, my - ry, 0, my + ry * 0.5);
  wash.addColorStop(0, mix(C.ember, C.flame, 0.35, 0.3));
  wash.addColorStop(0.55, shade(C.ember, 0.8, 0.1));
  wash.addColorStop(1, shade(C.ember, 0.8, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(mx - rx, my - ry, rx * 2, ry * 2);
  // draining streaks — the river runs down and dims
  for (let i = 0; i < 12; i++) {
    const t = rand() * 2 - 1;
    const sx = mx + t * rx * 0.8;
    const syTop = my - ry * Math.sqrt(Math.max(0, 1 - t * t)) + 1;
    const len = ry * (1.1 + rand() * 0.8);
    const bright = i % 4 === 0;
    const g = ctx.createLinearGradient(sx, syTop, sx, syTop + len);
    g.addColorStop(0, bright ? shade(C.flameHi, 1, 0.5) : mix(C.flame, C.ember, 0.3, 0.45));
    g.addColorStop(1, shade(C.ember, 1, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 0.8 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(sx, syTop);
    ctx.lineTo(sx + (mx - sx) * 0.18, syTop + len);
    ctx.stroke();
  }
  // candles already tithed, sinking — dimming with depth
  for (let i = 0; i < 5; i++) {
    const fx = mx + (rand() * 2 - 1) * rx * 0.5;
    const fy = my - ry * 0.5 + rand() * ry * 1.1;
    const dpt = (fy - (my - ry)) / (2 * ry);
    const a = Math.max(0.12, 0.7 * (1 - dpt));
    ctx.fillStyle = mix(C.flame, C.ember, dpt, a * 0.35);
    ctx.beginPath();
    ctx.arc(fx, fy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(C.flame, C.ember, dpt, a);
    ctx.beginPath();
    ctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // the blackness below swallows it all
  const abyss = ctx.createRadialGradient(mx, my + ry * 0.45, 0, mx, my + ry * 0.45, rx * 0.9);
  abyss.addColorStop(0, shade(C.void, 0.5, 0.95));
  abyss.addColorStop(0.6, shade(C.void, 0.5, 0.55));
  abyss.addColorStop(1, shade(C.void, 0.5, 0));
  ctx.fillStyle = abyss;
  ctx.fillRect(mx - rx, my - ry, rx * 2, ry * 2);
  ctx.restore();

  // 9. rim light + verdigris seep at the stone lip
  ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(mx, my, rx, ry, 0, -Math.PI * 0.85, -Math.PI * 0.15);
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.14);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(mx, my, rx, ry, 0, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  // ink outlines close the woodcut
  ctx.strokeStyle = shade(C.void, 0.7, 0.9);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(mx, my, rxO, ryO, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  // the seep, in two broken arcs — never a full neon ring
  const seepArc = (a0: number, a1: number, lw: number, color: string): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(mx, my, rx * 1.04, ry * 1.1, 0, a0, a1);
    ctx.stroke();
  };
  seepArc(Math.PI * 0.62, Math.PI * 1.12, 4, shade(C.verdigrisDim, 1, 0.18));
  seepArc(Math.PI * 0.68, Math.PI * 1.02, 1.5, mix(C.verdigris, C.verdigrisDim, 0.4, 0.4));
  seepArc(-Math.PI * 0.28, Math.PI * 0.18, 3, shade(C.verdigrisDim, 1, 0.15));
  seepArc(-Math.PI * 0.2, Math.PI * 0.1, 1, mix(C.verdigris, C.verdigrisDim, 0.35, 0.35));
  // small seep pools on the ring stone
  for (const pa of [Math.PI * 0.8, Math.PI * 1.06, -Math.PI * 0.1]) {
    ctx.fillStyle = mix(C.verdigrisDim, C.void, 0.3, 0.22);
    ctx.beginPath();
    ctx.ellipse(
      mx + Math.cos(pa) * rx * 1.13,
      my + Math.sin(pa) * ry * 1.2,
      3.5 + rand() * 2.5,
      1.6,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // 10. the procession — six hooded bearers, back-to-front, candles warm
  const startX = w * 0.1;
  const endX = mx - rx * 1.18;
  for (let i = 5; i >= 0; i--) {
    const t = Math.min(1, Math.max(0, i / 5 + (rand() - 0.5) * 0.06));
    const px = lerp(startX, endX, t);
    const footY = lerp(h * 0.655, my + ry * 0.15, t);
    const ht = lerp(h * 0.104, h * 0.072, t);
    const bw = ht * 0.46;
    const tone = mix(C.void, C.boneDim, 0.28 + rand() * 0.09);
    const lead = i === 5;
    const cx = px + bw * (lead ? 0.85 : 0.62);
    const cy = footY - ht * (lead ? 0.42 : 0.5);
    candle(ctx, cx, cy, ht); // glow first, so the body cuts into it
    hoodedBody(ctx, px, footY, ht, 1, tone);
    // front contour catches the flame
    ctx.strokeStyle = mix(C.ember, C.flame, 0.5, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + bw * 0.37, footY - ht * 0.7);
    ctx.quadraticCurveTo(px + bw * 0.53, footY - ht * 0.38, px + bw * 0.5, footY - ht * 0.06);
    ctx.stroke();
    ctx.fillStyle = shade(C.flame, 1, 0.9);
    ctx.beginPath();
    ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.flameHi;
    ctx.fillRect(cx - 0.5, cy - 1.4, 1, 2.2);
    if (lead) {
      // the lead bearer tips the flame — three sparks arc toward the mouth
      for (let s = 0; s < 3; s++) {
        const st = (s + 1) / 3;
        ctx.fillStyle = mix(C.flameHi, C.ember, st, 0.7 - st * 0.4);
        ctx.beginPath();
        ctx.arc(cx + st * (mx - rx * 0.6 - cx) * 0.5, cy + st * st * ry * 1.4, 1.2 - st * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 11. the elder, standing aside — taller, unlit, leaning on a staff
  const ex = Math.min(mx + rx * 1.5, w * 0.86);
  const eht = h * 0.125;
  const efoot = my + ry * 0.35;
  hoodedBody(ctx, ex, efoot, eht, -1, mix(C.void, C.boneDim, 0.2));
  const ebw = eht * 0.46;
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.45, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ex - ebw * 0.62, efoot);
  ctx.lineTo(ex - ebw * 0.58, efoot - eht * 1.1);
  ctx.stroke();
  ctx.fillStyle = mix(C.void, C.boneDim, 0.5);
  ctx.beginPath();
  ctx.arc(ex - ebw * 0.58, efoot - eht * 1.1, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // the mouth's seep tinges his facing edge
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.5, 0.28);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ex - ebw * 0.37, efoot - eht * 0.7);
  ctx.quadraticCurveTo(ex - ebw * 0.53, efoot - eht * 0.38, ex - ebw * 0.5, efoot - eht * 0.06);
  ctx.stroke();

  // 12. near flank pillars — fog stop 3, darkest cutouts
  ctx.fillStyle = shade(C.void, 0.6);
  ctx.fillRect(0, 0, w * 0.075, h);
  ctx.fillRect(w * 0.94, 0, w * 0.06, h);
  for (const [px, dir] of [
    [w * 0.075, 1],
    [w * 0.94, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(px, h * 0.3);
    ctx.lineTo(px + dir * 12, h * 0.32);
    ctx.lineTo(px + dir * 12, h * 0.35);
    ctx.lineTo(px, h * 0.37);
    ctx.closePath();
    ctx.fill();
  }

  // 13. bottom crush — the caption's quiet ground
  const crushB = ctx.createLinearGradient(0, h * 0.68, 0, h);
  crushB.addColorStop(0, shade(C.void, 0.55, 0));
  crushB.addColorStop(1, shade(C.void, 0.55, 0.88));
  ctx.fillStyle = crushB;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);

  // 14. top crush
  const crushT = ctx.createLinearGradient(0, 0, 0, h * 0.16);
  crushT.addColorStop(0, shade(C.void, 0.7, 0.8));
  crushT.addColorStop(1, shade(C.void, 0.7, 0));
  ctx.fillStyle = crushT;
  ctx.fillRect(0, 0, w, h * 0.16);
}
