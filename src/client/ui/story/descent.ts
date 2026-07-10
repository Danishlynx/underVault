/**
 * Story slide 7 — "She is still down there." The pull-quote slide: the whole
 * journey in one image. A vertical cross-section of the buried tower — six
 * biome strata stacked downward (warm grey masonry → ochre → verdigris
 * slate → charred black with ember cracks → pale bone → near-black), tiny
 * switchback stairs threading between them, one tiny warm candle-dot just
 * setting out on the highest run — and at the very bottom, small but
 * unmistakable, the First Flame: a white-gold point behind a sealed door
 * glyph, faint gold-ink rays reaching up through the dark.
 *
 * Pure 2D-canvas painting in the guildhall idiom: token colors via shade()/
 * mix() only, flat woodcut masses, fog-stop depth, a private LCG for jitter,
 * no speckle. Caller has scaled for DPR and cleared; the center-bottom third
 * stays calm and dark for the caption — only the small door and its quiet
 * light live down there.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall's hallRand pattern, own seed) — never Math.random,
// never paint.ts crand (its stream belongs to the world-texture painters).
function descentRand(seed: number): () => number {
  let s = seed >>> 0 || 0xd35c;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintDescent(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = descentRand(0xd35c);
  const s = Math.min(w, h);
  const INK = shade(C.void, 0.7, 0.9);

  // ── geometry: the shaft, the six strata, the seams between ───────────────
  const xL = w * 0.185;
  const xR = w * 0.815;
  const shaftW = xR - xL;
  const wallT = Math.max(w * 0.045, 10);
  const surfaceY = h * 0.075;
  const seamH = Math.max(4, h * 0.012);
  const FRACS = [0.075, 0.197, 0.319, 0.441, 0.563, 0.685];
  const tops = FRACS.map((f) => h * f);
  const bots = FRACS.map((f, i) => (i < 5 ? h * FRACS[i + 1]! - seamH : h * 0.985));
  const bandCol = [
    mix(mix(C.surface, C.bone, 0.34), C.parchmentAged, 0.14), // 1 warm grey
    mix(mix(C.surface, C.ember, 0.34), C.goldInk, 0.16), // 2 ochre
    mix(C.surface, C.verdigrisDim, 0.52), // 3 verdigris slate
    shade(C.void, 0.82), // 4 charred black
    mix(C.surface2, C.bone, 0.3), // 5 pale bone
    mix(C.void, C.surface, 0.26), // 6 near-black
  ];

  // ── 1. base void gradient ─────────────────────────────────────────────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, shade(C.void, 0.85));
  base.addColorStop(0.07, mix(C.void, C.surface, 0.28));
  base.addColorStop(0.5, mix(C.void, C.surface, 0.35));
  base.addColorStop(0.82, shade(C.void, 0.9));
  base.addColorStop(1, shade(C.void, 0.75));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. the earth beyond the tower — fog stop 1: faint full-width strata ──
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = bandCol[i]!;
    ctx.fillRect(0, tops[i]!, w, bots[i]! - tops[i]!);
  }
  ctx.globalAlpha = 1;
  // roots reaching down from the surface, outside the walls
  ctx.strokeStyle = mix(C.void, C.ink, 0.6, 0.5);
  ctx.lineWidth = Math.max(1, s * 0.0028);
  for (const [rx, dir] of [[w * 0.07, 1], [w * 0.12, -1], [w * 0.9, -1], [w * 0.955, 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(rx, surfaceY);
    ctx.bezierCurveTo(
      rx + dir * w * 0.02, surfaceY + h * (0.05 + rand() * 0.03),
      rx - dir * w * 0.015, surfaceY + h * (0.1 + rand() * 0.04),
      rx + dir * w * 0.01, surfaceY + h * (0.16 + rand() * 0.06),
    );
    ctx.stroke();
  }

  // ── 3. the shaft interior: six strata, each a flat lit band ──────────────
  for (let i = 0; i < 6; i++) {
    const g = ctx.createLinearGradient(0, tops[i]!, 0, bots[i]!);
    g.addColorStop(0, shade(bandCol[i]!, 0.7)); // ceiling shadow
    g.addColorStop(0.25, bandCol[i]!);
    g.addColorStop(0.85, bandCol[i]!);
    g.addColorStop(1, shade(bandCol[i]!, 0.82));
    ctx.fillStyle = g;
    ctx.fillRect(xL, tops[i]!, shaftW, bots[i]! - tops[i]!);
  }

  // ── 4. stratum dressings — small flat woodcut shapes, two-three per band ──
  const clipBand = (i: number): void => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(xL, tops[i]!, shaftW, bots[i]! - tops[i]!);
    ctx.clip();
  };
  // 4a. warm grey: buried masonry — recessed arches under a lintel course
  clipBand(0);
  const b0h = bots[0]! - tops[0]!;
  ctx.fillStyle = shade(bandCol[0]!, 0.72);
  for (const fxr of [0.26, 0.5, 0.74]) {
    const ax = xL + shaftW * fxr;
    const aw2 = shaftW * 0.05;
    const atop = tops[0]! + b0h * 0.36;
    ctx.beginPath();
    ctx.moveTo(ax - aw2, bots[0]!);
    ctx.lineTo(ax - aw2, atop + aw2);
    ctx.arc(ax, atop + aw2, aw2, Math.PI, 0);
    ctx.lineTo(ax + aw2, bots[0]!);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = shade(bandCol[0]!, 1.18, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xL, tops[0]! + b0h * 0.28);
  ctx.lineTo(xR, tops[0]! + b0h * 0.28);
  ctx.stroke();
  ctx.restore();
  // 4b. ochre: dripping stalactites, floor hummocks, one gold-ink vein
  clipBand(1);
  const b1h = bots[1]! - tops[1]!;
  ctx.fillStyle = shade(bandCol[1]!, 0.68);
  for (let i = 0; i < 4; i++) {
    const sx = xL + shaftW * (0.12 + i * 0.24 + rand() * 0.05);
    const sl = b1h * (0.2 + rand() * 0.24);
    ctx.beginPath();
    ctx.moveTo(sx - shaftW * 0.022, tops[1]!);
    ctx.lineTo(sx + shaftW * 0.022, tops[1]!);
    ctx.lineTo(sx, tops[1]! + sl);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = shade(bandCol[1]!, 0.82);
  for (const fxr of [0.2, 0.55, 0.84]) {
    ctx.beginPath();
    ctx.ellipse(xL + shaftW * fxr, bots[1]!, shaftW * (0.07 + rand() * 0.04), b1h * 0.17, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.strokeStyle = mix(C.goldInk, bandCol[1]!, 0.35, 0.55);
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(xL + shaftW * 0.06, tops[1]! + b1h * 0.52);
  ctx.quadraticCurveTo(xL + shaftW * 0.3, tops[1]! + b1h * (0.62 + rand() * 0.1), xL + shaftW * 0.56, tops[1]! + b1h * 0.82);
  ctx.stroke();
  ctx.restore();
  // 4c. verdigris slate: sheared shards, and one micro-waystone still glowing
  clipBand(2);
  const b2h = bots[2]! - tops[2]!;
  ctx.strokeStyle = shade(bandCol[2]!, 0.64, 0.7);
  ctx.lineWidth = Math.max(1, s * 0.0025);
  for (let i = 0; i < 6; i++) {
    const gx = xL + shaftW * (0.1 + i * 0.15 + rand() * 0.04);
    const gy = tops[2]! + b2h * (0.28 + rand() * 0.5);
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + shaftW * 0.065, gy - b2h * 0.2);
    ctx.stroke();
  }
  const mwx = xL + shaftW * 0.14;
  const mwH = b2h * 0.46;
  ctx.fillStyle = mix(C.verdigrisDim, C.verdigris, 0.28);
  ctx.beginPath();
  ctx.moveTo(mwx, bots[2]! - mwH);
  ctx.lineTo(mwx + mwH * 0.22, bots[2]! - mwH * 0.62);
  ctx.lineTo(mwx + mwH * 0.18, bots[2]!);
  ctx.lineTo(mwx - mwH * 0.18, bots[2]!);
  ctx.lineTo(mwx - mwH * 0.22, bots[2]! - mwH * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(C.verdigris, 1.3, 0.3);
  ctx.beginPath();
  ctx.arc(mwx, bots[2]! - mwH * 0.5, Math.max(2.4, mwH * 0.14), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(C.verdigris, 1.8);
  ctx.beginPath();
  ctx.arc(mwx, bots[2]! - mwH * 0.5, Math.max(1, mwH * 0.055), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 4d. charred black: jagged spires and ember cracks — heat under the crust
  clipBand(3);
  const b3h = bots[3]! - tops[3]!;
  ctx.fillStyle = shade(C.void, 0.55);
  for (const [fxr, fh] of [[0.18, 0.5], [0.46, 0.34], [0.78, 0.58]] as const) {
    const px = xL + shaftW * fxr;
    ctx.beginPath();
    ctx.moveTo(px - shaftW * 0.045, bots[3]!);
    ctx.lineTo(px - shaftW * 0.008, bots[3]! - b3h * fh);
    ctx.lineTo(px + shaftW * 0.012, bots[3]! - b3h * fh * 0.72);
    ctx.lineTo(px + shaftW * 0.05, bots[3]!);
    ctx.closePath();
    ctx.fill();
  }
  const crack = (x0: number, y0: number, segs: number, reach: number): void => {
    const pts: Array<[number, number]> = [[x0, y0]];
    for (let i = 1; i <= segs; i++) {
      pts.push([x0 + (reach / segs) * i, y0 + (rand() - 0.5) * b3h * 0.2]);
    }
    for (const [lw, col] of [
      [Math.max(3, s * 0.007), shade(C.ember, 1, 0.2)],
      [Math.max(1, s * 0.0024), mix(C.ember, C.flame, 0.4, 0.85)],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(pts[0]![0], pts[0]![1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
      ctx.stroke();
    }
  };
  crack(xL + shaftW * 0.08, tops[3]! + b3h * 0.6, 6, shaftW * 0.42);
  crack(xL + shaftW * 0.6, tops[3]! + b3h * 0.78, 4, shaftW * 0.3);
  ctx.restore();
  // 4e. pale bone: a half-buried ribcage and a skull dome — something vast died here
  clipBand(4);
  const b4h = bots[4]! - tops[4]!;
  ctx.strokeStyle = mix(C.bone, C.boneDim, 0.3, 0.55);
  ctx.lineWidth = Math.max(1.5, s * 0.0035);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(
      xL + shaftW * (0.58 + i * 0.055), bots[4]!,
      shaftW * (0.15 - i * 0.02), b4h * (0.62 - i * 0.09),
      0.06 * i, Math.PI, Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.fillStyle = mix(C.bone, C.boneDim, 0.45, 0.5);
  ctx.beginPath();
  ctx.arc(xL + shaftW * 0.2, bots[4]!, b4h * 0.3, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(C.void, 0.85, 0.8);
  ctx.beginPath();
  ctx.ellipse(xL + shaftW * 0.225, bots[4]! - b4h * 0.12, b4h * 0.07, b4h * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 5. seams: the rock between floors, each with a lit floor edge ────────
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = shade(C.void, 0.55);
    ctx.fillRect(xL, bots[i]!, shaftW, seamH);
    ctx.strokeStyle = shade(bandCol[i]!, 1.2, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xL, bots[i]! + 0.5);
    ctx.lineTo(xR, bots[i]! + 0.5);
    ctx.stroke();
  }

  // ── 6. the stairs: five switchback runs threading the strata ─────────────
  const runXs: Array<[number, number]> = [
    [xL + shaftW * 0.06, xR - shaftW * 0.1],
    [xR - shaftW * 0.1, xL + shaftW * 0.1],
    [xL + shaftW * 0.1, xR - shaftW * 0.16],
    [xR - shaftW * 0.16, xL + shaftW * 0.14],
    [xL + shaftW * 0.14, w * 0.53],
  ];
  const litCols = [
    mix(bandCol[0]!, C.bone, 0.45, 0.9),
    mix(bandCol[1]!, C.parchmentAged, 0.4, 0.9),
    mix(bandCol[2]!, C.bone, 0.42, 0.9),
    mix(bandCol[3]!, C.boneDim, 0.55, 0.9),
    mix(bandCol[4]!, C.bone, 0.5, 0.9),
  ];
  const slotW = Math.max(4, w * 0.014);
  const drawRun = (x0: number, y0: number, x1: number, y1: number, lit: string, markT = 0.3): { x: number; y: number } => {
    const n = 11 + Math.floor(rand() * 4);
    const dx = (x1 - x0) / n;
    const dy = (y1 - y0) / n;
    const th = Math.max(2.5, s * 0.007);
    const body = new Path2D();
    body.moveTo(x0, y0);
    for (let i = 1; i <= n; i++) {
      body.lineTo(x0 + dx * i, y0 + dy * (i - 1));
      body.lineTo(x0 + dx * i, y0 + dy * i);
    }
    body.lineTo(x1, y1 + th);
    body.lineTo(x0, y0 + th);
    body.closePath();
    ctx.fillStyle = shade(C.void, 0.85, 0.9);
    ctx.fill(body);
    ctx.strokeStyle = lit;
    ctx.lineWidth = Math.max(0.9, s * 0.002);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i <= n; i++) {
      ctx.lineTo(x0 + dx * i, y0 + dy * (i - 1));
      ctx.lineTo(x0 + dx * i, y0 + dy * i);
    }
    ctx.stroke();
    const mi = Math.max(1, Math.round(markT * n));
    return { x: x0 + dx * (mi - 0.4), y: y0 + dy * (mi - 1) };
  };
  let candleAt = { x: 0, y: 0 };
  for (let i = 0; i < 5; i++) {
    const bh = bots[i]! - tops[i]!;
    const y0 = tops[i]! + bh * 0.32;
    const y1 = bots[i]! - 1;
    // the stairwell slot cut down through the seam above this run's start
    const slotTop = i === 0 ? surfaceY : bots[i - 1]! - 2;
    ctx.fillStyle = shade(C.void, 0.5);
    ctx.fillRect(runXs[i]![0] - slotW / 2, slotTop, slotW, y0 - slotTop);
    const p = drawRun(runXs[i]![0], y0, runXs[i]![1], y1, litCols[i]!);
    if (i === 0) candleAt = p;
  }
  // the last slot, into the near-black
  ctx.fillStyle = shade(C.void, 0.5);
  ctx.fillRect(w * 0.53 - slotW / 2, bots[4]! - 2, slotW, seamH + h * 0.012);

  // ── 7. depth fog — the shaft recedes as it drops ──────────────────────────
  const fog = ctx.createLinearGradient(0, tops[0]!, 0, bots[4]!);
  fog.addColorStop(0, shade(C.void, 0.9, 0));
  fog.addColorStop(1, shade(C.void, 0.9, 0.42));
  ctx.fillStyle = fog;
  ctx.fillRect(0, tops[0]!, w, bots[4]! - tops[0]!);

  // ── 8. the delver: a tiny speck and their warm candle-dot, first run down ─
  const fw = Math.max(1.5, s * 0.004);
  const fh = Math.max(3, s * 0.008);
  const dotX = candleAt.x + fw * 1.2;
  const dotY = candleAt.y - fh * 2.1;
  const halo = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, s * 0.045);
  halo.addColorStop(0, shade(C.flame, 1, 0.4));
  halo.addColorStop(0.35, shade(C.flame, 1, 0.14));
  halo.addColorStop(1, shade(C.flame, 1, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(dotX - s * 0.05, dotY - s * 0.05, s * 0.1, s * 0.1);
  ctx.fillStyle = shade(C.void, 0.9);
  ctx.beginPath();
  ctx.ellipse(candleAt.x - fw * 0.6, candleAt.y - fh, fw, fh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.flameHi;
  ctx.beginPath();
  ctx.arc(dotX, dotY, Math.max(1.2, s * 0.003), 0, Math.PI * 2);
  ctx.fill();

  // ── 9. below the last stratum the stairs dissolve into the dark ──────────
  const thread = mix(bandCol[5]!, C.bone, 0.4, 0.9);
  const fade: Array<[number, number, number, number, number]> = [
    [w * 0.53, h * 0.7, w * 0.47, h * 0.724, 0.3],
    [w * 0.47, h * 0.736, w * 0.515, h * 0.758, 0.16],
    [w * 0.515, h * 0.77, w * 0.49, h * 0.788, 0.07],
  ];
  for (const [fx0, fy0, fx1, fy1, fa] of fade) {
    ctx.globalAlpha = fa;
    drawRun(fx0, fy0, fx1, fy1, thread);
  }
  ctx.globalAlpha = 1;

  // ── 10. the tower walls — fog stop 3, darkest cutouts framing the section ─
  for (const wx of [xL - wallT, xR]) {
    const wg = ctx.createLinearGradient(0, surfaceY, 0, h);
    wg.addColorStop(0, shade(C.void, 0.62));
    wg.addColorStop(1, shade(C.void, 0.45));
    ctx.fillStyle = wg;
    ctx.fillRect(wx, surfaceY, wallT, h - surfaceY);
    // great block joints
    ctx.strokeStyle = shade(C.void, 0.3, 0.6);
    ctx.lineWidth = 1;
    for (let j = 1; j < 6; j++) {
      const jy = surfaceY + (h * 0.78 / 6) * j + (rand() - 0.5) * h * 0.01;
      ctx.beginPath();
      ctx.moveTo(wx, jy);
      ctx.lineTo(wx + wallT, jy);
      ctx.stroke();
    }
  }
  // inner edges catch what little light falls down the shaft
  const edge = ctx.createLinearGradient(0, surfaceY, 0, h * 0.7);
  edge.addColorStop(0, mix(C.bone, C.void, 0.3, 0.35));
  edge.addColorStop(1, mix(C.bone, C.void, 0.3, 0));
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  for (const ex of [xL + 0.5, xR - 0.5]) {
    ctx.beginPath();
    ctx.moveTo(ex, surfaceY);
    ctx.lineTo(ex, h * 0.7);
    ctx.stroke();
  }

  // ── 11. the ground line and the town above, tiny against the gloom ───────
  const groundTop = surfaceY - Math.max(6, h * 0.018);
  ctx.fillStyle = mix(C.void, C.surface, 0.6);
  ctx.fillRect(0, groundTop, w, surfaceY - groundTop);
  ctx.strokeStyle = shade(bandCol[0]!, 1.22, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundTop + 0.5);
  ctx.lineTo(w, groundTop + 0.5);
  ctx.stroke();
  // huts on the flanks
  ctx.fillStyle = shade(C.void, 0.62);
  for (const fxr of [0.09, 0.145, 0.83, 0.9]) {
    const hx = w * fxr;
    const hw = w * 0.028;
    const hh = Math.max(5, h * 0.013);
    ctx.fillRect(hx - hw / 2, groundTop - hh, hw, hh);
    ctx.beginPath();
    ctx.moveTo(hx - hw * 0.62, groundTop - hh);
    ctx.lineTo(hx, groundTop - hh - hh * 0.7);
    ctx.lineTo(hx + hw * 0.62, groundTop - hh);
    ctx.closePath();
    ctx.fill();
  }
  // the gatehouse over the stair mouth, two windows still lit
  const gx = runXs[0]![0];
  const gh = Math.max(9, h * 0.026);
  const gw = Math.max(12, w * 0.05);
  ctx.fillStyle = shade(C.void, 0.6);
  ctx.beginPath();
  ctx.moveTo(gx - gw / 2, groundTop);
  ctx.lineTo(gx - gw * 0.34, groundTop - gh);
  ctx.lineTo(gx + gw * 0.34, groundTop - gh);
  ctx.lineTo(gx + gw / 2, groundTop);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(C.void, 0.42);
  ctx.fillRect(gx - slotW / 2, groundTop - gh * 0.42, slotW, gh * 0.42 + (surfaceY - groundTop));
  ctx.fillStyle = mix(C.flame, C.flameHi, 0.4, 0.9);
  for (const wxr of [-0.22, 0.22]) {
    ctx.beginPath();
    ctx.arc(gx + gw * wxr, groundTop - gh * 0.55, Math.max(1, s * 0.0025), 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 12. crush, settle, vignettes — close the folio before the last light ──
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.13);
  crush.addColorStop(0, shade(C.void, 0.7, 0.85));
  crush.addColorStop(1, shade(C.void, 0.7, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.13);
  const settle = ctx.createLinearGradient(0, h * 0.7, 0, h);
  settle.addColorStop(0, shade(C.void, 0.75, 0));
  settle.addColorStop(1, shade(C.void, 0.75, 0.85));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  const vr = s * 0.55;
  for (const [vx, vy] of [[0, 0], [w, 0], [0, h], [w, h]] as const) {
    const vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    vg.addColorStop(0, shade(C.void, 0.5, 0.4));
    vg.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  // ── 13. THE FIRST FLAME — small, at the very bottom, unmistakable ────────
  const dcx = w / 2;
  const doorH = Math.max(h * 0.042, 26);
  const doorW = doorH * 0.72;
  const doorBase = h * 0.938;
  const doorTop = doorBase - doorH;
  const glyphY = doorBase - doorH * 0.52;
  // the buried glow
  const bloom = ctx.createRadialGradient(dcx, glyphY, 0, dcx, glyphY, s * 0.2);
  bloom.addColorStop(0, mix(C.goldInk, C.flameHi, 0.45, 0.16));
  bloom.addColorStop(0.4, shade(C.goldInk, 1, 0.07));
  bloom.addColorStop(1, shade(C.goldInk, 1, 0));
  ctx.fillStyle = bloom;
  ctx.fillRect(dcx - s * 0.22, glyphY - s * 0.22, s * 0.44, s * 0.44);
  // faint gold-ink rays, reaching up through the dark
  const nRays = 13;
  for (let i = 0; i < nRays; i++) {
    const a = Math.PI * (1.06 + (i / (nRays - 1)) * 0.88);
    const r0 = doorW * 0.55;
    const len = s * (0.07 + rand() * 0.15) * (i % 3 === 0 ? 1.7 : 1);
    ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.3, 0.05 + rand() * 0.06);
    ctx.lineWidth = Math.max(0.8, s * 0.0018);
    ctx.beginPath();
    ctx.moveTo(dcx + Math.cos(a) * r0, glyphY + Math.sin(a) * r0);
    ctx.lineTo(dcx + Math.cos(a) * (r0 + len), glyphY + Math.sin(a) * (r0 + len));
    ctx.stroke();
  }
  // threshold steps before the door
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.3, 0.5);
  ctx.lineWidth = 1;
  for (const [sy, sw2] of [[doorBase + 3, doorW * 1.6], [doorBase + 7, doorW * 2.2]] as const) {
    ctx.beginPath();
    ctx.moveTo(dcx - sw2 / 2, sy);
    ctx.lineTo(dcx + sw2 / 2, sy);
    ctx.stroke();
  }
  // the sealed door, black against its own light
  const door = new Path2D();
  door.moveTo(dcx - doorW / 2, doorBase);
  door.lineTo(dcx - doorW / 2, doorTop + doorW / 2);
  door.arc(dcx, doorTop + doorW / 2, doorW / 2, Math.PI, 0);
  door.lineTo(dcx + doorW / 2, doorBase);
  door.closePath();
  ctx.fillStyle = shade(C.void, 0.5);
  ctx.fill(door);
  ctx.strokeStyle = mix(C.goldInk, C.void, 0.3, 0.55);
  ctx.lineWidth = 1;
  ctx.stroke(door);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0022);
  ctx.stroke(door);
  // light leaking through the seam and under the threshold
  ctx.strokeStyle = mix(C.flameHi, C.goldInk, 0.3, 0.28);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(dcx, doorTop + 2);
  ctx.lineTo(dcx, doorBase);
  ctx.stroke();
  ctx.strokeStyle = mix(C.flameHi, C.parchment, 0.45, 0.95);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(dcx, doorTop + 2);
  ctx.lineTo(dcx, doorBase);
  ctx.stroke();
  ctx.strokeStyle = mix(C.flameHi, C.goldInk, 0.4, 0.5);
  ctx.beginPath();
  ctx.moveTo(dcx - doorW * 0.4, doorBase - 0.5);
  ctx.lineTo(dcx + doorW * 0.4, doorBase - 0.5);
  ctx.stroke();
  // the seal glyph: a barred ring
  const gr = doorW * 0.3;
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.25, 0.9);
  ctx.lineWidth = Math.max(1.2, s * 0.0028);
  ctx.beginPath();
  ctx.arc(dcx, glyphY, gr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.25, 0.7);
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(dcx - gr * 1.35, glyphY);
  ctx.lineTo(dcx + gr * 1.35, glyphY);
  ctx.stroke();
  // the white-gold point itself, burning behind the seal
  const pt = ctx.createRadialGradient(dcx, glyphY, 0, dcx, glyphY, doorW * 0.22);
  pt.addColorStop(0, mix(C.flameHi, C.parchment, 0.5, 0.95));
  pt.addColorStop(0.5, shade(C.flameHi, 1, 0.35));
  pt.addColorStop(1, shade(C.flameHi, 1, 0));
  ctx.fillStyle = pt;
  ctx.beginPath();
  ctx.arc(dcx, glyphY, doorW * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(C.parchment, C.flameHi, 0.35);
  ctx.beginPath();
  ctx.arc(dcx, glyphY, Math.max(1.3, s * 0.0032), 0, Math.PI * 2);
  ctx.fill();
  // one hair of flare across the point
  ctx.strokeStyle = shade(C.flameHi, 1, 0.6);
  ctx.lineWidth = Math.max(0.7, s * 0.0014);
  ctx.beginPath();
  ctx.moveTo(dcx - doorW * 0.26, glyphY);
  ctx.lineTo(dcx + doorW * 0.26, glyphY);
  ctx.stroke();
}
