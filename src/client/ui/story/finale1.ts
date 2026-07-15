/**
 * Finale plate 1 — "The Gate Unlocks." The long rescue, paid in one hundred
 * candle-ends, arrives. Seen from the antechamber: the Great Gate's two
 * colossal halves stand parted a body's width, and the first dawn the
 * underground has ever owned pours OUT through the widening seam — a wall
 * of warm white-gold falling across the threshold and running long down the
 * steps toward the viewer. The candle-field on the flanking treads blazes
 * in answer, and every stub throws its own thin shadow outward, sundials
 * that finally have a sun. High at the top edge, townsfolk stand frozen
 * mid-step on the wall-stairs — small dark silhouettes backlit by their own
 * little flames, front-rimmed gold by the thing they came down to witness.
 * Nobody stands inside the light yet: the plate IS the light arriving.
 * Same monument vocabulary as the Guildhall painting (socket, rim rings,
 * ridge spokes, rivets, rune ticks, the gold-ringed boss) — but the
 * verdigris seam is gone, replaced by the open blaze; verdigris keeps only
 * its accents, patina and cold crown arcs, the two-hue law bent as far
 * toward warmth as it will ever go. Joy in the same quiet woodcut grammar.
 * Caller has DPR-scaled and cleared; the bottom ~18% settles calm and dark
 * for the caption.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall pattern, own seed) — never Math.random, never
// paint.ts crand (that stream belongs to the world-texture painters).
function slideRand(seed: number): () => number {
  let s = seed >>> 0 || 0x1f1a7e01;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintFinale1(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = slideRand(0x1f1a7e01);
  const s = Math.min(w, h);
  const cx = w * 0.5;
  const INK = shade(C.void, 0.6, 0.9);

  // ── geometry — the Guildhall's monument, remeasured for this hour ────────
  const baseY = h * 0.62; // Gate base = top of the steps
  const R = Math.min(w * 0.42, baseY * 0.72); // Gate radius
  const gcy = baseY - R;
  const gap = Math.max(s * 0.024, R * 0.062); // parted a body's width
  const gapL = cx - gap / 2;
  const gapR = cx + gap / 2;
  const lightTop = Math.max(gcy - R * 0.985, -s * 0.02);

  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  const ring = (r: number, lw: number, col: string, a0 = 0, a1 = Math.PI * 2): void => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, gcy, r, a0, a1);
    ctx.stroke();
  };

  // ── 1. base void — lifted; the dark already knows it has lost ────────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, shade(C.void, 0.85));
  base.addColorStop(0.35, mix(C.void, C.surface, 0.3));
  base.addColorStop(Math.min(0.99, baseY / h), mix(C.void, C.surface2, 0.55));
  base.addColorStop(1, shade(C.void, 0.7));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // the arriving light's ambience — laid over the whole hall before anything
  // stands in it; the farthest reach of any image save the epilogue
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const amb = ctx.createRadialGradient(cx, gcy, 0, cx, gcy, s * 1.2);
  amb.addColorStop(0, shade(C.ember, 0.9, 0.2));
  amb.addColorStop(0.45, shade(C.ember, 0.8, 0.09));
  amb.addColorStop(1, shade(C.ember, 0.8, 0.012));
  ctx.fillStyle = amb;
  ctx.fillRect(0, 0, w, h);
  const amb2 = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, s * 0.85);
  amb2.addColorStop(0, shade(C.flame, 0.7, 0.14));
  amb2.addColorStop(1, shade(C.flame, 0.7, 0));
  ctx.fillStyle = amb2;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // ── 2. far-wall lift + three fog stops of receding arches ────────────────
  const wall = ctx.createRadialGradient(cx, baseY - R * 0.3, R * 0.15, cx, baseY - R * 0.3, R * 2.1);
  wall.addColorStop(0, mix(C.void, C.surface, 0.66, 1));
  wall.addColorStop(0.55, mix(C.void, C.surface, 0.3, 1));
  wall.addColorStop(1, shade(C.void, 0.9, 1));
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 3; i++) {
    // i = 0 farthest (hazy, tight to the Gate) … 2 nearest (dark, wide)
    const Ri = R * (1.26 + i * 0.36);
    const bw = R * (0.08 + i * 0.055);
    const tone = mix(C.void, C.surface, 0.46 - i * 0.15, 1);
    const floorI = baseY + (h - baseY) * (0.16 + i * 0.3);
    ctx.strokeStyle = tone;
    ctx.lineWidth = bw;
    ctx.beginPath();
    ctx.arc(cx, baseY, Ri, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
    ctx.fillStyle = tone; // jambs dropping to each arch's own floor line
    ctx.fillRect(cx - Ri - bw / 2, baseY - Ri * 0.05, bw, floorI - baseY + Ri * 0.05);
    ctx.fillRect(cx + Ri - bw / 2, baseY - Ri * 0.05, bw, floorI - baseY + Ri * 0.05);
    // crisp woodcut edge on each inner rim — and today the rim is WARM;
    // stone that only ever knew verdigris learning the other hue
    ctx.strokeStyle = mix(C.surface2, C.ember, 0.45 - i * 0.1, 0.5 - i * 0.12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, baseY, Ri - bw / 2, Math.PI * 1.04, Math.PI * 1.96);
    ctx.stroke();
  }

  // ── 3. carved surround + glyph ticks — the socket the doors woke up in ──
  ring(R * 1.075, R * 0.05, mix(C.void, C.surface2, 0.9));
  ring(R * 1.11, Math.max(1, R * 0.007), shade(C.void, 0.7, 0.8));
  ring(R * 1.042, 1, shade(C.surface2, 1.45, 0.45));
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + (rand() - 0.5) * 0.02;
    const r0 = R * 1.125;
    const r1 = r0 + R * 0.028 + rand() * R * 0.012;
    // more of the gilt ticks awake tonight than the Guildhall ever showed
    ctx.strokeStyle = i % 3 === 0 ? shade(C.goldInk, 1.05, 0.5) : shade(C.bone, 0.68, 0.24);
    ctx.lineWidth = 1;
    line(cx + Math.cos(a) * r0, gcy + Math.sin(a) * r0, cx + Math.cos(a) * r1, gcy + Math.sin(a) * r1);
  }
  ctx.strokeStyle = shade(C.void, 0.3, 0.9); // socket shadow
  ctx.lineWidth = Math.max(3, R * 0.02);
  ctx.beginPath();
  ctx.arc(cx, gcy, R + R * 0.012, 0, Math.PI * 2);
  ctx.stroke();

  // ── 4. THE HALVES — the sealed disc, unsealed; same vocabulary, twice ────
  for (const side of [-1, 1] as const) {
    ctx.save();
    ctx.beginPath();
    if (side < 0) ctx.rect(-2, -2, gapL + 2, h + 4);
    else ctx.rect(gapR, -2, w - gapR + 4, h + 4);
    ctx.clip();
    ctx.translate((side * gap) / 2, 0);
    // the half-disc face
    const disc = ctx.createRadialGradient(cx, baseY - R * 0.26, R * 0.05, cx, gcy, R * 1.02);
    disc.addColorStop(0, mix(C.surface2, C.ember, 0.38, 1));
    disc.addColorStop(0.38, mix(C.surface, C.surface2, 0.85, 1));
    disc.addColorStop(1, mix(C.void, C.surface, 0.42, 1));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(cx, gcy, R, 0, Math.PI * 2);
    ctx.fill();
    // the wall of light lying on the door face, strongest at the cut
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, gcy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    const washW = R * 0.62;
    const wg = ctx.createLinearGradient(cx, 0, cx + side * washW, 0);
    wg.addColorStop(0, shade(C.flame, 0.85, 0.36));
    wg.addColorStop(0.4, shade(C.ember, 0.8, 0.13));
    wg.addColorStop(1, shade(C.ember, 0.8, 0));
    ctx.fillStyle = wg;
    ctx.fillRect(side < 0 ? cx - washW : cx, gcy - R, washW, R * 2);
    ctx.restore();
    // rim rings + the cool crown arc — verdigris keeping its high ground
    ring(R - Math.max(1.5, R * 0.008), Math.max(2, R * 0.014), shade(C.surface2, 2.0, 0.95));
    ring(R * 0.962, 1, shade(C.surface2, 1.4, 0.45));
    ring(R * 0.86, Math.max(1, R * 0.007), shade(C.surface2, 1.5, 0.5));
    ring(R * 0.6, 1, shade(C.surface2, 1.4, 0.35));
    ring(R - Math.max(1.5, R * 0.008), Math.max(1.4, R * 0.009), mix(C.surface2, C.verdigrisDim, 0.65, 0.7), -Math.PI * 0.82, -Math.PI * 0.18);
    // ridge spokes (skip where the seam ran) — dark groove + lit edge
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.PI / 16 + (rand() - 0.5) * 0.02;
      if (Math.abs(Math.cos(a)) < 0.14) continue;
      const x0 = cx + Math.cos(a) * R * 0.33;
      const y0 = gcy + Math.sin(a) * R * 0.33;
      const x1 = cx + Math.cos(a) * R * 0.85;
      const y1 = gcy + Math.sin(a) * R * 0.85;
      ctx.strokeStyle = shade(C.void, 0.8, 0.8);
      ctx.lineWidth = Math.max(1.2, R * 0.011);
      line(x0, y0, x1, y1);
      const off = Math.max(1, R * 0.008);
      // the lit edge now answers the seam, not just the candle field
      ctx.strokeStyle = Math.cos(a) * side < 0
        ? mix(C.surface2, C.flame, 0.5, 0.55)
        : shade(C.surface2, 1.55, Math.sin(a) > 0 ? 0.6 : 0.3);
      ctx.lineWidth = 1;
      line(x0 + off * Math.cos(a + Math.PI / 2), y0 + off * Math.sin(a + Math.PI / 2), x1 + off * Math.cos(a + Math.PI / 2), y1 + off * Math.sin(a + Math.PI / 2));
    }
    // rivets on the outer band — the near-seam ones catch the new dawn
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + (rand() - 0.5) * 0.03;
      const rx = cx + Math.cos(a) * R * 0.925;
      const ry = gcy + Math.sin(a) * R * 0.925;
      ctx.fillStyle = shade(C.surface2, 1.5, 0.9);
      ctx.beginPath();
      ctx.arc(rx, ry, Math.max(1.2, R * 0.011), 0, Math.PI * 2);
      ctx.fill();
      if (Math.sin(a) > 0.25 || Math.abs(Math.cos(a)) < 0.35) {
        ctx.fillStyle = mix(C.flame, C.flameHi, 0.5, 0.6);
        ctx.beginPath();
        ctx.arc(rx - Math.sign(rx - cx) * Math.max(0.6, R * 0.004), ry + Math.max(0.4, R * 0.003), Math.max(0.6, R * 0.005), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // rune tick rings — carved sigils, the gilt ones fully lit at last
    for (const [rr, n] of [
      [0.74, 34],
      [0.5, 22],
    ] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.03;
        if (Math.abs(Math.cos(a)) < 0.1) continue;
        const r0 = R * rr;
        const r1 = r0 + R * 0.022 + rand() * R * 0.018;
        const gilt = i % 4 === 0;
        ctx.strokeStyle = gilt ? mix(C.goldInk, C.flameHi, 0.35, 0.5) : mix(C.bone, C.verdigrisDim, 0.45, 0.18);
        ctx.lineWidth = gilt ? 1.3 : 1;
        line(cx + Math.cos(a) * r0, gcy + Math.sin(a) * r0, cx + Math.cos(a) * r1, gcy + Math.sin(a) * r1);
      }
    }
    // the gold-ringed boss — split down its heart, each half at its cut edge
    const bossR = R * 0.16;
    ctx.fillStyle = mix(C.ember, C.void, 0.55, 1);
    ctx.beginPath();
    ctx.arc(cx, gcy, bossR * 0.66, 0, Math.PI * 2);
    ctx.fill();
    ring(bossR, Math.max(1.5, R * 0.013), mix(C.goldInk, C.flameHi, 0.45, 0.95));
    ring(bossR * 1.1, 1, shade(C.void, 0.5, 0.5));
    ring(bossR * 0.66, 1, shade(C.goldInk, 0.9, 0.55));
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
      if (Math.abs(Math.sin(a)) > 0.82) continue; // the seam ate the verticals
      ctx.strokeStyle = mix(C.goldInk, C.void, 0.3, 0.55);
      ctx.lineWidth = 1.4;
      line(cx + Math.cos(a) * bossR * 0.7, gcy + Math.sin(a) * bossR * 0.7, cx + Math.cos(a) * bossR * 0.95, gcy + Math.sin(a) * bossR * 0.95);
    }
    // last patina beside the cut — twenty years of verdigris, being unsaid
    for (let i = 0; i < 5; i++) {
      const px = cx + side * (R * 0.03 + rand() * R * 0.06);
      const py = gcy - R * 0.6 + rand() * R * 1.35;
      ctx.strokeStyle = shade(C.verdigrisDim, 0.9 + rand() * 0.4, 0.1 + rand() * 0.12);
      ctx.lineWidth = 1;
      line(px, py, px, py + R * (0.025 + rand() * 0.05));
    }
    // the cut face itself — door-thickness, blown white by what's behind it
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, gcy, R, 0, Math.PI * 2);
    ctx.clip();
    const edgeT = Math.max(1.5, R * 0.02);
    const eg = ctx.createLinearGradient(0, gcy - R, 0, baseY);
    eg.addColorStop(0, shade(C.flameHi, 1.5, 0.55));
    eg.addColorStop(0.5, shade(C.flameHi, 1.75, 0.95));
    eg.addColorStop(1, shade(C.flameHi, 1.4, 0.7));
    ctx.fillStyle = eg;
    ctx.fillRect(side < 0 ? cx - edgeT : cx, gcy - R, edgeT, R * 2);
    ctx.restore();
    ctx.restore();
  }

  // ── 5. THE WALL OF LIGHT — dawn breaking underground, nobody in it yet ──
  // the open seam: a blade of white-gold the full height of the doors
  const bar = ctx.createLinearGradient(0, lightTop, 0, baseY);
  bar.addColorStop(0, shade(C.flameHi, 1.45, 0.85));
  bar.addColorStop(0.45, shade(C.flameHi, 1.8, 1));
  bar.addColorStop(1, shade(C.flameHi, 1.6, 0.98));
  ctx.fillStyle = bar;
  ctx.fillRect(gapL, lightTop, gap, baseY - lightTop);
  // bloom — wide and quiet, then close and certain
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [bwF, aF] of [
    [0.55, 0.16],
    [0.22, 0.3],
    [0.08, 0.5],
  ] as const) {
    const bW = R * bwF;
    const bg = ctx.createLinearGradient(cx - bW, 0, cx + bW, 0);
    bg.addColorStop(0, shade(C.flame, 0.9, 0));
    bg.addColorStop(0.5, shade(C.flame, 0.95, aF));
    bg.addColorStop(1, shade(C.flame, 0.9, 0));
    ctx.fillStyle = bg;
    ctx.fillRect(cx - bW, lightTop, bW * 2, baseY - lightTop);
  }
  // the burst where the light meets the threshold — dawn's first footprint
  ctx.save();
  ctx.translate(cx, baseY + s * 0.004);
  ctx.scale(1, 0.3);
  const burst = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.75);
  burst.addColorStop(0, shade(C.flameHi, 1.5, 0.5));
  burst.addColorStop(0.4, shade(C.flame, 0.9, 0.22));
  burst.addColorStop(1, shade(C.flame, 0.9, 0));
  ctx.fillStyle = burst;
  ctx.fillRect(-R * 0.8, -R * 0.8, R * 1.6, R * 1.6);
  ctx.restore();
  ctx.restore();
  // motes crossing the blade — dust that has waited twenty years to shine
  for (let i = 0; i < 9; i++) {
    const my = lightTop + rand() * (baseY - lightTop);
    const mxx = cx + (rand() - 0.5) * gap * 2.6;
    ctx.fillStyle = shade(C.flameHi, 1.4, 0.25 + rand() * 0.4);
    ctx.beginPath();
    ctx.arc(mxx, my, 0.5 + rand() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 6. four receding steps + the candle field, blazing ──────────────────
  const stepFr: readonly number[] = [0.13, 0.16, 0.21, 0.28];
  interface Step {
    top: number;
    bh: number;
    hw: number;
  }
  const steps: Step[] = [];
  let sy0 = baseY;
  for (let k = 0; k < 4; k++) {
    const bh = (h - baseY) * (stepFr[k] ?? 0.25);
    const hw = Math.min(w * 0.54, R * 1.14 + (k + 1) * w * 0.075);
    steps.push({ top: sy0, bh, hw });
    const riser = ctx.createLinearGradient(0, sy0, 0, sy0 + bh);
    riser.addColorStop(0, mix(C.void, C.surface2, 0.56 - k * 0.07, 1));
    riser.addColorStop(1, mix(C.void, C.surface2, 0.18 - k * 0.03, 1));
    ctx.fillStyle = riser;
    ctx.fillRect(cx - hw, sy0, hw * 2, bh + 1);
    for (const sideX of [-1, 1] as const) {
      const fl = ctx.createLinearGradient(cx + sideX * hw * 0.82, 0, cx + sideX * hw * 1.12, 0);
      fl.addColorStop(0, shade(C.void, 0.7, 0));
      fl.addColorStop(1, shade(C.void, 0.7, 1));
      ctx.fillStyle = fl;
      const x0 = sideX < 0 ? 0 : cx + hw * 0.82;
      ctx.fillRect(x0, sy0, sideX < 0 ? cx - hw * 0.82 : w - x0, bh + 1);
    }
    // lit tread top — no longer a thin warm surface; the light LIVES here
    const tread = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
    tread.addColorStop(0, shade(C.ember, 0.6, 0));
    tread.addColorStop(0.5, mix(C.ember, C.flame, 0.45, 0.24 - k * 0.03));
    tread.addColorStop(1, shade(C.ember, 0.6, 0));
    ctx.fillStyle = tread;
    ctx.fillRect(cx - hw, sy0 + 1, hw * 2, Math.max(2, s * 0.006));
    const edge = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
    edge.addColorStop(0, shade(C.ember, 0.7, 0));
    edge.addColorStop(0.5, mix(C.flame, C.flameHi, 0.35, 0.78 - k * 0.09));
    edge.addColorStop(1, shade(C.ember, 0.7, 0));
    ctx.strokeStyle = edge;
    ctx.lineWidth = k < 2 ? Math.max(1, s * 0.002) : Math.max(1.2, s * 0.0028);
    line(cx - hw, sy0, cx + hw, sy0);
    ctx.strokeStyle = shade(C.void, 0.3, 0.5); // shadow tucked under the edge
    ctx.lineWidth = Math.max(1, s * 0.0016);
    line(cx - hw, sy0 + Math.max(1.4, s * 0.003), cx + hw, sy0 + Math.max(1.4, s * 0.003));
    sy0 += bh;
  }
  // below the last tread the foreground still falls dark — the caption floor
  const fore = ctx.createLinearGradient(0, sy0 - 2, 0, h);
  fore.addColorStop(0, shade(C.void, 0.6, 0));
  fore.addColorStop(1, shade(C.void, 0.55, 0.85));
  ctx.fillStyle = fore;
  ctx.fillRect(0, sy0 - 2, w, h - sy0 + 2);

  // ── 7. the light down the steps — rays long across the floor ────────────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // the processional path, gold at last where the seam's ghost used to lie
  const pathW = Math.max(10, R * 0.24);
  const path = ctx.createLinearGradient(0, baseY, 0, h);
  path.addColorStop(0, shade(C.flameHi, 0.95, 0.32));
  path.addColorStop(0.55, shade(C.ember, 0.85, 0.1));
  path.addColorStop(1, shade(C.ember, 0.85, 0));
  ctx.fillStyle = path;
  ctx.fillRect(cx - pathW / 2, baseY, pathW, h - baseY);
  // long rays fanning from the open seam toward the viewer
  for (const [txf, wf, af] of [
    [-0.44, 0.055, 0.09],
    [-0.21, 0.075, 0.12],
    [0.02, 0.09, 0.16],
    [0.25, 0.075, 0.12],
    [0.47, 0.055, 0.09],
  ] as const) {
    const tx = cx + txf * w;
    const ty = h * (0.9 + rand() * 0.05);
    const rayG = ctx.createLinearGradient(cx, baseY, tx, ty);
    rayG.addColorStop(0, mix(C.flame, C.flameHi, 0.45, af));
    rayG.addColorStop(1, mix(C.flame, C.flameHi, 0.45, 0));
    ctx.fillStyle = rayG;
    ctx.beginPath();
    ctx.moveTo(gapL, baseY);
    ctx.lineTo(tx - wf * w * 0.5, ty);
    ctx.lineTo(tx + wf * w * 0.5, ty);
    ctx.lineTo(gapR, baseY);
    ctx.closePath();
    ctx.fill();
  }
  // a warm breath over the whole candle field — the treads answer in kind
  const fieldG = ctx.createRadialGradient(cx, baseY + (h - baseY) * 0.35, 0, cx, baseY + (h - baseY) * 0.35, w * 0.52);
  fieldG.addColorStop(0, shade(C.ember, 0.75, 0.12));
  fieldG.addColorStop(1, shade(C.ember, 0.75, 0));
  ctx.fillStyle = fieldG;
  ctx.fillRect(0, baseY - s * 0.02, w, h - baseY + s * 0.02);
  ctx.restore();

  // ── 8. the candles — the field blazing, every stub given a shadow ───────
  const rowCounts: readonly number[] = [9, 8, 8, 7];
  for (let k = 0; k < 4; k++) {
    const st = steps[k];
    if (st === undefined) continue;
    const n = rowCounts[k] ?? 7;
    const clear = R * 0.3; // the light owns the processional center
    const span = Math.min(st.hw * 0.92, w * 0.47) - clear;
    for (let i = 0; i < n; i++) {
      const sideC = i % 2 === 0 ? -1 : 1;
      const tt = (Math.floor(i / 2) + 0.5) / Math.ceil(n / 2);
      const dist = Math.max(0, Math.min(Math.max(10, span), tt * Math.max(10, span) + (rand() - 0.5) * span * 0.22));
      const vx = cx + sideC * (clear + dist);
      const vy = st.top + st.bh * (0.08 + rand() * 0.16) + Math.max(2, s * 0.006);
      const sc = 0.75 + k * 0.35 + rand() * 0.3;
      const stubH = Math.max(2, s * 0.009 * sc);
      const flameR = Math.max(0.9, s * 0.0029 * sc);
      // the long shadow first — thrown OUTWARD from the seam, not the void's
      // doing but the light's: proof of a single sun where none ever was
      const sdx = vx - cx;
      const sdy = vy - baseY;
      const sl = Math.hypot(sdx, sdy) || 1;
      const ux = sdx / sl;
      const uy = Math.max(0.1, sdy / sl);
      const shLen = s * (0.02 + rand() * 0.02) * (0.7 + k * 0.22);
      ctx.fillStyle = shade(C.void, 0.4, 0.32);
      ctx.beginPath();
      ctx.moveTo(vx - Math.max(0.8, s * 0.0016 * sc), vy + 0.5);
      ctx.lineTo(vx + Math.max(0.8, s * 0.0016 * sc), vy + 0.5);
      ctx.lineTo(vx + ux * shLen + 0.6, vy + uy * shLen);
      ctx.lineTo(vx + ux * shLen - 0.6, vy + uy * shLen);
      ctx.closePath();
      ctx.fill();
      // halo — wider than the vigil ever allowed itself
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const chr = Math.max(4, s * 0.015) * sc;
      const halo = ctx.createRadialGradient(vx, vy - stubH, 0, vx, vy - stubH, chr);
      halo.addColorStop(0, shade(C.flame, 0.95, 0.45));
      halo.addColorStop(1, shade(C.flame, 0.95, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(vx - chr, vy - stubH - chr, chr * 2, chr * 2);
      const gl = ctx.createRadialGradient(vx, vy + 1, 0, vx, vy + 1, chr * 0.8);
      gl.addColorStop(0, shade(C.ember, 0.95, 0.22));
      gl.addColorStop(1, shade(C.ember, 0.95, 0));
      ctx.fillStyle = gl;
      ctx.save();
      ctx.translate(vx, vy + 1);
      ctx.scale(1, 0.32);
      ctx.fillRect(-chr, -chr, chr * 2, chr * 2);
      ctx.restore();
      ctx.restore();
      // wax stub, then the flame: warm body + hot core
      ctx.fillStyle = shade(C.parchmentAged, 0.66, 0.9);
      ctx.fillRect(vx - Math.max(0.6, s * 0.0015 * sc), vy - stubH, Math.max(1.2, s * 0.003 * sc), stubH);
      ctx.fillStyle = mix(C.flame, C.ember, 0.22, 0.95);
      ctx.beginPath();
      ctx.ellipse(vx, vy - stubH - flameR * 0.9, flameR * 0.78, flameR * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(C.flameHi, 1.2, 0.95);
      ctx.beginPath();
      ctx.ellipse(vx, vy - stubH - flameR * 0.75, flameR * 0.4, flameR * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // mist at the threshold — gone warm, lifted by the light behind it
  const mist = ctx.createLinearGradient(0, baseY - R * 0.14, 0, baseY + R * 0.05);
  mist.addColorStop(0, mix(C.bone, C.flameHi, 0.35, 0));
  mist.addColorStop(0.6, mix(C.bone, C.flameHi, 0.35, 0.13));
  mist.addColorStop(1, mix(C.bone, C.flameHi, 0.35, 0));
  ctx.fillStyle = mist;
  ctx.fillRect(0, baseY - R * 0.14, w, R * 0.19);

  // ── 9. near pillars — the darkest fog stop still frames the joy ─────────
  const pw = Math.max(w * 0.055, s * 0.05);
  ctx.fillStyle = shade(C.void, 0.45);
  ctx.fillRect(0, 0, pw, h);
  ctx.fillRect(w - pw, 0, pw, h);
  for (const px of [pw, w - pw] as const) {
    const dir = px < cx ? 1 : -1;
    ctx.fillStyle = shade(C.void, 0.45);
    ctx.beginPath(); // capital wedge
    ctx.moveTo(px, h * 0.2);
    ctx.lineTo(px + dir * Math.max(6, w * 0.014), h * 0.23);
    ctx.lineTo(px + dir * Math.max(6, w * 0.014), h * 0.27);
    ctx.lineTo(px, h * 0.29);
    ctx.closePath();
    ctx.fill();
    // inner edge — cold above, and below, gold the whole way down
    const edgeG = ctx.createLinearGradient(0, 0, 0, h);
    edgeG.addColorStop(0, mix(C.void, C.surface2, 0.7, 0.2));
    edgeG.addColorStop(0.4, mix(C.surface2, C.ember, 0.35, 0.45));
    edgeG.addColorStop(0.75, mix(C.ember, C.flame, 0.45, 0.6));
    edgeG.addColorStop(1, mix(C.ember, C.flame, 0.6, 0.7));
    ctx.strokeStyle = edgeG;
    ctx.lineWidth = Math.max(1, s * 0.0022);
    line(px + dir, h * 0.03, px + dir, h);
  }

  // ── 10. air — gold motes nearly everywhere; the cool keeps the corners ──
  for (let i = 0; i < 30; i++) {
    const mxx = rand() * w;
    const myy = h * 0.06 + rand() * (baseY - h * 0.06);
    const warmAir = Math.abs(mxx - cx) < R * 0.9;
    ctx.fillStyle = warmAir
      ? mix(C.flameHi, C.bone, 0.4, 0.06 + rand() * 0.11)
      : mix(C.bone, C.verdigris, 0.4, 0.03 + rand() * 0.05);
    ctx.beginPath();
    ctx.arc(mxx, myy, 0.5 + rand() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 11. grain, then the frame's weather: crush, vignette, caption calm ──
  for (let i = 0; i < 460; i++) {
    const gx = rand() * w;
    const gy = rand() * h * 0.82;
    ctx.fillStyle = rand() < 0.6 ? shade(C.bone, 1, 0.012 + rand() * 0.022) : shade(C.void, 0.35, 0.025 + rand() * 0.025);
    ctx.fillRect(gx, gy, 1, 1);
  }
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.26);
  crush.addColorStop(0, shade(C.void, 0.55, 0.6));
  crush.addColorStop(1, shade(C.void, 0.55, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.26);
  const vr = s * 0.6;
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
  // the blade must survive the crush — light does not defer to weather
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rev = ctx.createLinearGradient(0, lightTop, 0, h * 0.34);
  rev.addColorStop(0, shade(C.flameHi, 1.3, 0.45));
  rev.addColorStop(1, shade(C.flameHi, 1.3, 0));
  ctx.fillStyle = rev;
  ctx.fillRect(cx - gap * 0.7, lightTop, gap * 1.4, h * 0.34 - lightTop);
  ctx.restore();
  // bottom ~18% settles fully dark — the caption arrives to a still floor
  const settle = ctx.createLinearGradient(0, h * 0.74, 0, h);
  settle.addColorStop(0, shade(C.void, 0.55, 0));
  settle.addColorStop(0.45, shade(C.void, 0.55, 0.5));
  settle.addColorStop(1, shade(C.void, 0.5, 0.85));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.74, w, h * 0.26);

  // ── 12. THE TOWNSFOLK — at the top edge, frozen mid-step ────────────────
  // They came down the wall-stairs with their own little flames, and the
  // Gate opened while they were still walking. Drawn last so nothing dims
  // them: small dark silhouettes, backlit by what they carry, front-rimmed
  // by what they came to see.
  const folk = (fx: number, fy: number, fh: number, dir: number, raise: boolean): void => {
    const fw = fh * 0.36;
    // their own little flame, trailing — the halo they half-eclipse
    const lx = fx - dir * fw * 1.05;
    const ly = fy - fh * 0.38;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(lx, ly, 0, lx, ly, fh * 0.85);
    halo.addColorStop(0, shade(C.flame, 0.9, 0.42));
    halo.addColorStop(1, shade(C.flame, 0.9, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(lx - fh, ly - fh, fh * 2, fh * 2);
    ctx.restore();
    ctx.strokeStyle = shade(C.void, 0.5, 0.9); // the held stub
    ctx.lineWidth = Math.max(0.8, fh * 0.045);
    line(lx, ly, lx, ly + fh * 0.12);
    ctx.fillStyle = mix(C.flame, C.ember, 0.25, 0.95);
    ctx.beginPath();
    ctx.ellipse(lx, ly - fh * 0.05, fh * 0.034, fh * 0.058, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.flameHi, 1.2, 0.95);
    ctx.beginPath();
    ctx.ellipse(lx, ly - fh * 0.045, fh * 0.017, fh * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    // silhouette — cloak, head, the stride the light interrupted
    const hx = fx - dir * fw * 0.1;
    const hy = fy - fh * 0.87;
    const hr2 = fh * 0.13;
    const bod = new Path2D();
    bod.moveTo(fx - dir * fw * 0.62, fy - fh * 0.16); // trailing hem
    bod.quadraticCurveTo(fx - dir * fw * 0.52, fy - fh * 0.52, hx - dir * fw * 0.38, fy - fh * 0.7);
    bod.quadraticCurveTo(hx - dir * fw * 0.08, fy - fh * 0.8, hx + dir * fw * 0.3, fy - fh * 0.74);
    bod.quadraticCurveTo(fx + dir * fw * 0.54, fy - fh * 0.5, fx + dir * fw * 0.5, fy - fh * 0.2);
    bod.quadraticCurveTo(fx + dir * fw * 0.1, fy - fh * 0.1, fx - dir * fw * 0.62, fy - fh * 0.16);
    bod.closePath();
    ctx.fillStyle = INK;
    ctx.fill(bod);
    ctx.fillStyle = INK; // head
    ctx.beginPath();
    ctx.arc(hx, hy, hr2, 0, Math.PI * 2);
    ctx.fill();
    // legs — front foot committed, back heel lifted; frozen between steps
    ctx.strokeStyle = INK;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, fh * 0.07);
    line(fx + dir * fw * 0.12, fy - fh * 0.22, fx + dir * fw * 0.42, fy);
    line(fx - dir * fw * 0.08, fy - fh * 0.2, fx - dir * fw * 0.5, fy - fh * 0.07);
    if (raise) {
      // one hand up against a brightness nobody alive has seen before
      ctx.lineWidth = Math.max(0.8, fh * 0.055);
      line(hx + dir * fw * 0.22, fy - fh * 0.66, hx + dir * fw * 0.62, hy - fh * 0.02);
    }
    ctx.lineCap = "butt";
    // the Gate's rim on their front edge — the light claims them gently
    ctx.strokeStyle = mix(C.flameHi, C.parchment, 0.3, 0.6);
    ctx.lineWidth = Math.max(0.8, fh * 0.03);
    ctx.beginPath();
    ctx.moveTo(fx + dir * fw * 0.5, fy - fh * 0.2);
    ctx.quadraticCurveTo(fx + dir * fw * 0.54, fy - fh * 0.5, hx + dir * fw * 0.3, fy - fh * 0.74);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy, hr2 + 0.2, dir > 0 ? -Math.PI * 0.35 : Math.PI * 0.65, dir > 0 ? Math.PI * 0.35 : Math.PI * 1.35);
    ctx.stroke();
  };
  {
    // the left wall-stair, descending in from behind the near pillar
    const ly0 = h * 0.078;
    const lx1 = w * 0.335;
    const ly1 = h * 0.156;
    ctx.fillStyle = mix(C.void, C.surface, 0.42);
    ctx.beginPath();
    ctx.moveTo(0, ly0);
    ctx.lineTo(lx1, ly1);
    ctx.lineTo(lx1, ly1 + s * 0.03);
    ctx.lineTo(0, ly0 + s * 0.046);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.22); // candle-caught lip
    ctx.lineWidth = Math.max(1, s * 0.0016);
    line(0, ly0, lx1, ly1);
    for (let i = 1; i < 5; i++) {
      // tread notches down the flight
      const t = i / 5;
      ctx.strokeStyle = shade(C.void, 0.8, 0.45);
      ctx.lineWidth = 1;
      line(lx1 * t, ly0 + (ly1 - ly0) * t, lx1 * t, ly0 + (ly1 - ly0) * t + s * 0.009);
    }
    const stairY = (t: number): number => ly0 + (ly1 - ly0) * t;
    folk(lx1 * 0.3, stairY(0.3), s * 0.052, 1, false);
    folk(lx1 * 0.58, stairY(0.58), s * 0.052, 1, true);
    folk(lx1 * 0.88, stairY(0.88), s * 0.054, 1, false);
  }
  {
    // the right gallery ledge — two more, stopped at the very lip
    const ry0 = h * 0.098;
    const rx0 = w * 0.72;
    ctx.fillStyle = mix(C.void, C.surface, 0.42);
    ctx.fillRect(rx0, ry0, w - rx0, s * 0.028);
    ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.2);
    ctx.lineWidth = Math.max(1, s * 0.0016);
    line(rx0, ry0, w, ry0);
    folk(w * 0.9, ry0, s * 0.048, -1, false);
    folk(w * 0.805, ry0, s * 0.048, -1, true);
  }
}
