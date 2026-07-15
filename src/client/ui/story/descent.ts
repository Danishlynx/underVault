/**
 * Story slide 7 — "Twenty-five floors. Five truths open the Seal. She is
 * still down there. The Vault is listening."
 *
 * A vertical cross-section of the buried tower, its shaft tapering with
 * depth. Five biome strata (warm masonry → ochre caverns → verdigris slate →
 * charred dark → mauve bone-fields), each scored by four faint ledger lines
 * — five floors a stratum, twenty-five in all, counted again by twenty-five
 * notch-marks down the left wall. Switchback stairs thread the strata and
 * repeat at diminishing scale into haze, arriving at the SEAL: a colossal
 * ringed stone door in the candlemaid-Gate idiom (relief rings, hub boss,
 * verdigris seam) with five sigil sockets — one dimly lit. Before it, dwarfed,
 * a small braided silhouette with a white-gold flame: she is still down
 * there. Verdigris sound-ripples climb the shaft from the door, and paired
 * eye-glints and carved ear-spirals wait in the wall shadows — the Vault is
 * listening.
 *
 * Pure 2D-canvas painting in the guildhall idiom: token colors via shade()/
 * mix() only, flat woodcut masses, fog-stop depth, a private LCG for jitter.
 * Caller has scaled for DPR and cleared; the bottom-center caption band
 * (~bottom 5–18%) holds only the Seal's dark lower stone and her shadow.
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
  const cx = w / 2;

  // ── geometry: a shaft that narrows as it drops ────────────────────────────
  const surfaceY = h * 0.07;
  const taperY1 = h * 0.88;
  const halfTop = Math.min(w * 0.36, h * 0.62);
  const halfBot = Math.min(w * 0.148, h * 0.26);
  const halfAt = (y: number): number =>
    halfTop + ((halfBot - halfTop) * (y - surfaceY)) / (taperY1 - surfaceY);
  const eL = (y: number): number => cx - halfAt(y);
  const eR = (y: number): number => cx + halfAt(y);
  const seamH = Math.max(3, h * 0.009);
  const BF = [0.07, 0.162, 0.254, 0.346, 0.438, 0.53];
  const tops: number[] = [];
  const bots: number[] = [];
  for (let i = 0; i < 5; i++) {
    tops.push(h * BF[i]!);
    bots.push(h * BF[i + 1]! - seamH);
  }
  const bandCol = [
    mix(mix(C.surface, C.bone, 0.4), C.parchmentAged, 0.16), // 1 warm grey masonry
    shade(mix(mix(C.surface, C.ember, 0.32), C.goldInk, 0.12), 0.94), // 2 ochre caverns
    shade(mix(C.surface, C.verdigrisDim, 0.46), 0.86), // 3 verdigris slate
    shade(mix(C.void, C.surface2, 0.6), 0.9), // 4 charred dark
    shade(mix(C.surface2, C.boneDim, 0.3), 0.78), // 5 mauve bone-fields, darkest
  ];
  const shaft = new Path2D();
  shaft.moveTo(eL(surfaceY), surfaceY);
  shaft.lineTo(eR(surfaceY), surfaceY);
  shaft.lineTo(eR(h), h);
  shaft.lineTo(eL(h), h);
  shaft.closePath();
  const sealCy = h * 0.7;
  const sealR = Math.min(h * 0.155, halfAt(sealCy) * 0.62);

  // ── 1. base void gradient ─────────────────────────────────────────────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, shade(C.void, 0.85));
  base.addColorStop(0.07, mix(C.void, C.surface, 0.28));
  base.addColorStop(0.42, mix(C.void, C.surface, 0.32));
  base.addColorStop(0.78, shade(C.void, 0.85));
  base.addColorStop(1, shade(C.void, 0.7));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. the earth beyond the tower — faint full-width strata + roots ──────
  ctx.globalAlpha = 0.13;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = bandCol[i]!;
    ctx.fillRect(0, tops[i]!, w, bots[i]! - tops[i]!);
  }
  ctx.fillStyle = shade(bandCol[4]!, 0.7);
  ctx.fillRect(0, h * 0.53, w, h * 0.16);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = mix(C.void, C.ink, 0.6, 0.5);
  ctx.lineWidth = Math.max(1, s * 0.0028);
  for (const [rx, dir] of [[w * 0.05, 1], [w * 0.1, -1], [w * 0.92, -1], [w * 0.965, 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(rx, surfaceY);
    ctx.bezierCurveTo(
      rx + dir * w * 0.02, surfaceY + h * (0.05 + rand() * 0.03),
      rx - dir * w * 0.015, surfaceY + h * (0.1 + rand() * 0.04),
      rx + dir * w * 0.01, surfaceY + h * (0.16 + rand() * 0.06),
    );
    ctx.stroke();
  }

  // ── 3. shaft interior: five strata + four ledger lines each (5×5 = 25) ───
  ctx.save();
  ctx.clip(shaft);
  for (let i = 0; i < 5; i++) {
    const g = ctx.createLinearGradient(0, tops[i]!, 0, bots[i]!);
    g.addColorStop(0, shade(bandCol[i]!, 0.68)); // ceiling shadow
    g.addColorStop(0.25, bandCol[i]!);
    g.addColorStop(0.85, bandCol[i]!);
    g.addColorStop(1, shade(bandCol[i]!, 0.8));
    ctx.fillStyle = g;
    ctx.fillRect(0, tops[i]!, w, bots[i]! - tops[i]!);
    // sub-floor ledger lines — each stratum reads as five stacked floors
    const bh = bots[i]! - tops[i]!;
    ctx.strokeStyle = i < 3 ? shade(bandCol[i]!, 0.58, 0.3) : shade(bandCol[i]!, 2.4, 0.34);
    ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) {
      const y = Math.round(tops[i]! + (bh * k) / 5) + 0.5;
      ctx.beginPath();
      ctx.moveTo(eL(y) + 1, y);
      ctx.lineTo(eR(y) - 1, y);
      ctx.stroke();
    }
  }
  // seams: the rock between strata, lit floor edge on top
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = shade(C.void, 0.55);
    ctx.fillRect(0, bots[i]!, w, seamH);
    ctx.strokeStyle = shade(bandCol[i]!, 1.25, 0.42);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(eL(bots[i]!), bots[i]! + 0.5);
    ctx.lineTo(eR(bots[i]!), bots[i]! + 0.5);
    ctx.stroke();
  }
  ctx.restore();

  // ── 4. stratum vignettes — back haze / mid props / dark foreground ───────
  const clipBand = (i: number): void => {
    ctx.save();
    ctx.clip(shaft);
    ctx.beginPath();
    ctx.rect(0, tops[i]!, w, bots[i]! - tops[i]!);
    ctx.clip();
  };
  // 4a. warm grey: pale colonnade haze, recessed arches, rubble, a light shaft
  clipBand(0);
  {
    const bt = tops[0]!, bb = bots[0]!, bh = bb - bt, bm = (bt + bb) / 2;
    const bL = eL(bm), bw = eR(bm) - bL;
    ctx.fillStyle = shade(bandCol[0]!, 1.12, 0.3); // background colonnade
    for (const fxr of [0.14, 0.28, 0.42, 0.56, 0.7, 0.84]) {
      ctx.fillRect(bL + bw * fxr - bw * 0.006, bt + bh * 0.2, bw * 0.012, bh * 0.8);
    }
    ctx.fillStyle = shade(bandCol[0]!, 0.64); // recessed arches
    for (const fxr of [0.24, 0.5, 0.76]) {
      const ax = bL + bw * fxr;
      const aw2 = bw * 0.042;
      const atop = bt + bh * 0.4;
      ctx.beginPath();
      ctx.moveTo(ax - aw2, bb);
      ctx.lineTo(ax - aw2, atop + aw2);
      ctx.arc(ax, atop + aw2, aw2, Math.PI, 0);
      ctx.lineTo(ax + aw2, bb);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = shade(bandCol[0]!, 1.2, 0.4); // lintel course
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(eL(bt + bh * 0.32), bt + bh * 0.32);
    ctx.lineTo(eR(bt + bh * 0.32), bt + bh * 0.32);
    ctx.stroke();
    ctx.fillStyle = shade(bandCol[0]!, 0.46); // foreground rubble
    for (const fxr of [0.1, 0.36, 0.63, 0.9]) {
      ctx.beginPath();
      ctx.ellipse(bL + bw * fxr, bb, bw * (0.045 + rand() * 0.03), bh * (0.09 + rand() * 0.08), 0, Math.PI, 0);
      ctx.fill();
    }
    // a light shaft with dust motes, falling from a ceiling crack
    const beamX = bL + bw * 0.635;
    const beam = ctx.createLinearGradient(0, bt, 0, bb);
    beam.addColorStop(0, mix(C.parchment, C.bone, 0.4, 0.17));
    beam.addColorStop(1, mix(C.parchment, C.bone, 0.4, 0.01));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(beamX - bw * 0.006, bt);
    ctx.lineTo(beamX + bw * 0.006, bt);
    ctx.lineTo(beamX + bw * 0.028, bb);
    ctx.lineTo(beamX - bw * 0.028, bb);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(C.parchment, C.bone, 0.3, 0.4);
    for (let i = 0; i < 9; i++) {
      const t = rand();
      ctx.beginPath();
      ctx.arc(beamX + (rand() - 0.5) * bw * 0.05 * (0.3 + t), bt + t * bh, 0.5 + rand() * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  // 4b. ochre: hazy back-mounds, stalactites, gold vein, dark fore-mounds
  clipBand(1);
  {
    const bt = tops[1]!, bb = bots[1]!, bh = bb - bt, bm = (bt + bb) / 2;
    const bL = eL(bm), bw = eR(bm) - bL;
    ctx.fillStyle = shade(bandCol[1]!, 1.24, 0.4); // background mound haze
    for (const fxr of [0.22, 0.52, 0.8]) {
      ctx.beginPath();
      ctx.ellipse(bL + bw * fxr, bb, bw * (0.12 + rand() * 0.05), bh * 0.3, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = shade(bandCol[1]!, 0.58); // stalactites
    for (let i = 0; i < 5; i++) {
      const sx = bL + bw * (0.1 + i * 0.19 + rand() * 0.05);
      const sl = bh * (0.18 + rand() * 0.26);
      ctx.beginPath();
      ctx.moveTo(sx - bw * 0.016, bt);
      ctx.lineTo(sx + bw * 0.016, bt);
      ctx.lineTo(sx, bt + sl);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = mix(C.goldInk, bandCol[1]!, 0.3, 0.5); // gold-ink vein
    ctx.lineWidth = Math.max(1, s * 0.002);
    ctx.beginPath();
    ctx.moveTo(bL + bw * 0.05, bt + bh * 0.5);
    ctx.quadraticCurveTo(bL + bw * 0.32, bt + bh * (0.6 + rand() * 0.1), bL + bw * 0.6, bt + bh * 0.84);
    ctx.stroke();
    ctx.fillStyle = shade(bandCol[1]!, 0.44); // foreground mounds
    for (const fxr of [0.16, 0.48, 0.86]) {
      ctx.beginPath();
      ctx.ellipse(bL + bw * fxr, bb, bw * (0.06 + rand() * 0.035), bh * (0.12 + rand() * 0.07), 0, Math.PI, 0);
      ctx.fill();
    }
  }
  ctx.restore();
  // 4c. verdigris slate: hazy shards, glowing waystone, fungal cluster
  clipBand(2);
  {
    const bt = tops[2]!, bb = bots[2]!, bh = bb - bt, bm = (bt + bb) / 2;
    const bL = eL(bm), bw = eR(bm) - bL;
    ctx.strokeStyle = shade(bandCol[2]!, 1.3, 0.3); // background shard haze
    ctx.lineWidth = Math.max(1, s * 0.002);
    for (let i = 0; i < 6; i++) {
      const gx = bL + bw * (0.08 + i * 0.15 + rand() * 0.04);
      const gy = bt + bh * (0.24 + rand() * 0.4);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + bw * 0.06, gy - bh * 0.18);
      ctx.stroke();
    }
    // faint cold beam over the waystone
    const mwx = bL + bw * 0.17;
    const cold = ctx.createLinearGradient(0, bt, 0, bb);
    cold.addColorStop(0, shade(C.verdigrisDim, 1.1, 0.09));
    cold.addColorStop(1, shade(C.verdigrisDim, 1.1, 0));
    ctx.fillStyle = cold;
    ctx.beginPath();
    ctx.moveTo(mwx - bw * 0.005, bt);
    ctx.lineTo(mwx + bw * 0.005, bt);
    ctx.lineTo(mwx + bw * 0.024, bb);
    ctx.lineTo(mwx - bw * 0.024, bb);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(C.verdigris, C.verdigrisDim, 0.6, 0.5);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(mwx + (rand() - 0.5) * bw * 0.03, bt + rand() * bh, 0.5 + rand() * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // the waystone, still glowing
    const mwH = bh * 0.48;
    ctx.fillStyle = mix(C.verdigrisDim, C.verdigris, 0.28);
    ctx.beginPath();
    ctx.moveTo(mwx, bb - mwH);
    ctx.lineTo(mwx + mwH * 0.22, bb - mwH * 0.62);
    ctx.lineTo(mwx + mwH * 0.18, bb);
    ctx.lineTo(mwx - mwH * 0.18, bb);
    ctx.lineTo(mwx - mwH * 0.22, bb - mwH * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(C.verdigris, 1.3, 0.3);
    ctx.beginPath();
    ctx.arc(mwx, bb - mwH * 0.5, Math.max(2.4, mwH * 0.14), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.verdigris, 1.8);
    ctx.beginPath();
    ctx.arc(mwx, bb - mwH * 0.5, Math.max(1, mwH * 0.055), 0, Math.PI * 2);
    ctx.fill();
    // fungal cluster, caps rim-lit verdigris
    for (const [fxr, fr] of [[0.68, 0.11], [0.75, 0.16], [0.83, 0.09]] as const) {
      const fx = bL + bw * fxr;
      const frr = bh * fr;
      ctx.strokeStyle = shade(bandCol[2]!, 0.6, 0.8);
      ctx.lineWidth = Math.max(1, frr * 0.16);
      ctx.beginPath();
      ctx.moveTo(fx, bb);
      ctx.lineTo(fx, bb - frr * 1.3);
      ctx.stroke();
      ctx.fillStyle = shade(bandCol[2]!, 0.55);
      ctx.beginPath();
      ctx.ellipse(fx, bb - frr * 1.3, frr, frr * 0.55, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = mix(C.verdigris, bandCol[2]!, 0.35, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(fx, bb - frr * 1.3, frr, frr * 0.55, 0, Math.PI, Math.PI * 1.6);
      ctx.stroke();
      ctx.fillStyle = shade(C.verdigris, 1.2, 0.5);
      ctx.beginPath();
      ctx.arc(fx + frr * 0.2, bb - frr * 1.55, Math.max(0.7, frr * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = shade(bandCol[2]!, 0.45); // foreground shards
    for (const fxr of [0.36, 0.55, 0.93]) {
      const px = bL + bw * fxr;
      const ph = bh * (0.14 + rand() * 0.1);
      ctx.beginPath();
      ctx.moveTo(px - bw * 0.03, bb);
      ctx.lineTo(px + bw * 0.004, bb - ph);
      ctx.lineTo(px + bw * 0.032, bb);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  // 4d. charred dark: ember haze, hanging chains, spires, cooling cracks
  clipBand(3);
  {
    const bt = tops[3]!, bb = bots[3]!, bh = bb - bt, bm = (bt + bb) / 2;
    const bL = eL(bm), bw = eR(bm) - bL;
    for (const fxr of [0.3, 0.72]) { // background ember haze
      const gx = bL + bw * fxr;
      const eg = ctx.createRadialGradient(gx, bb, 0, gx, bb, bh * 0.5);
      eg.addColorStop(0, shade(C.ember, 0.8, 0.08));
      eg.addColorStop(1, shade(C.ember, 0.8, 0));
      ctx.fillStyle = eg;
      ctx.fillRect(gx - bh * 0.5, bb - bh * 0.5, bh, bh * 0.5);
    }
    // chains from the ceiling
    for (const [fxr, fl] of [[0.28, 0.5], [0.47, 0.34], [0.66, 0.6]] as const) {
      const chx = bL + bw * fxr;
      const len = bh * fl;
      ctx.strokeStyle = shade(bandCol[3]!, 2.3, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chx, bt);
      ctx.lineTo(chx, bt + len);
      ctx.stroke();
      const step = Math.max(3, bh * 0.075);
      for (let y = bt + step; y < bt + len; y += step) {
        ctx.beginPath();
        ctx.moveTo(chx - 1.5, y);
        ctx.lineTo(chx + 1.5, y);
        ctx.stroke();
      }
      ctx.beginPath(); // hook
      ctx.arc(chx + 1, bt + len + 2, 2, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = shade(C.void, 0.6); // mid spires
    for (const [fxr, fh] of [[0.16, 0.46], [0.55, 0.3], [0.9, 0.4]] as const) {
      const px = bL + bw * fxr;
      ctx.beginPath();
      ctx.moveTo(px - bw * 0.04, bb);
      ctx.lineTo(px - bw * 0.006, bb - bh * fh);
      ctx.lineTo(px + bw * 0.01, bb - bh * fh * 0.72);
      ctx.lineTo(px + bw * 0.044, bb);
      ctx.closePath();
      ctx.fill();
    }
    const crack = (x0: number, segs: number, reach: number): void => {
      // a cooling fissure in the floor itself — jagged, ember-lit from below
      const pts: Array<[number, number]> = [[x0, bb - 1]];
      for (let i = 1; i <= segs; i++) {
        pts.push([x0 + (reach / segs) * i, bb - 1 - rand() * bh * 0.09]);
      }
      for (const [lw, col] of [
        [Math.max(2.5, s * 0.005), shade(C.ember, 1, 0.18)],
        [Math.max(1, s * 0.002), mix(C.ember, C.flame, 0.35, 0.75)],
      ] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(pts[0]![0], pts[0]![1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
        ctx.stroke();
      }
      ctx.fillStyle = mix(C.ember, C.flame, 0.5, 0.8); // embers pooled in the cut
      for (let i = 1; i < pts.length; i += 2) {
        ctx.beginPath();
        ctx.arc(pts[i]![0], pts[i]![1] + 0.5, Math.max(0.7, s * 0.0014), 0, Math.PI * 2);
        ctx.fill();
      }
    };
    crack(bL + bw * 0.1, 7, bw * 0.32);
    crack(bL + bw * 0.6, 5, bw * 0.26);
    ctx.fillStyle = shade(C.void, 0.42); // foreground spires, darkest
    for (const fxr of [0.4, 0.78]) {
      const px = bL + bw * fxr;
      ctx.beginPath();
      ctx.moveTo(px - bw * 0.05, bb);
      ctx.lineTo(px, bb - bh * (0.2 + rand() * 0.12));
      ctx.lineTo(px + bw * 0.05, bb);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  // 4e. mauve bone-fields: fallen colossus haze, ribcage, skull, rubble
  clipBand(4);
  {
    const bt = tops[4]!, bb = bots[4]!, bh = bb - bt, bm = (bt + bb) / 2;
    const bL = eL(bm), bw = eR(bm) - bL;
    // background: the fallen colossus head + a toppled pillar, hazier/lighter
    ctx.fillStyle = shade(bandCol[4]!, 1.55, 0.45);
    const hx = bL + bw * 0.72;
    const hr = bh * 0.32;
    ctx.beginPath();
    ctx.arc(hx, bb - hr * 0.6, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); // its broken nose-ridge
    ctx.moveTo(hx + hr * 0.85, bb - hr * 0.85);
    ctx.lineTo(hx + hr * 1.2, bb - hr * 0.5);
    ctx.lineTo(hx + hr * 0.8, bb - hr * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(bandCol[4]!, 0.7, 0.8); // hollow eye of the colossus
    ctx.beginPath();
    ctx.ellipse(hx + hr * 0.4, bb - hr * 0.8, hr * 0.16, hr * 0.22, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(bandCol[4]!, 1.4, 0.35);
    ctx.beginPath(); // toppled pillar
    ctx.moveTo(bL + bw * 0.06, bb - bh * 0.34);
    ctx.lineTo(bL + bw * 0.34, bb - bh * 0.12);
    ctx.lineTo(bL + bw * 0.335, bb - bh * 0.03);
    ctx.lineTo(bL + bw * 0.05, bb - bh * 0.24);
    ctx.closePath();
    ctx.fill();
    // mid: ribcage arcs + skull dome
    ctx.strokeStyle = mix(C.bone, C.boneDim, 0.35, 0.4);
    ctx.lineWidth = Math.max(1.2, s * 0.0028);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(
        bL + bw * (0.46 + i * 0.045), bb,
        bw * (0.11 - i * 0.016), bh * (0.52 - i * 0.08),
        0.05 * i, Math.PI, Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.fillStyle = mix(C.bone, C.boneDim, 0.5, 0.42);
    ctx.beginPath();
    ctx.arc(bL + bw * 0.18, bb, bh * 0.24, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(C.void, 0.8, 0.8);
    ctx.beginPath();
    ctx.ellipse(bL + bw * 0.2, bb - bh * 0.1, bh * 0.055, bh * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(bandCol[4]!, 0.5); // foreground rubble
    for (const fxr of [0.32, 0.58, 0.94]) {
      ctx.beginPath();
      ctx.ellipse(bL + bw * fxr, bb, bw * (0.05 + rand() * 0.03), bh * (0.08 + rand() * 0.06), 0, Math.PI, 0);
      ctx.fill();
    }
  }
  ctx.restore();

  // ── 5. the stairs: five switchback runs threading the strata ─────────────
  const litCols = [
    mix(bandCol[0]!, C.bone, 0.5, 0.9),
    mix(bandCol[1]!, C.parchmentAged, 0.42, 0.85),
    mix(bandCol[2]!, C.bone, 0.42, 0.8),
    mix(bandCol[3]!, C.boneDim, 0.6, 0.75),
    mix(bandCol[4]!, C.boneDim, 0.65, 0.7),
  ];
  const drawRun = (
    x0: number, y0: number, x1: number, y1: number,
    lit: string, th: number, markT = 0.3,
  ): { x: number; y: number } => {
    const n = 11 + Math.floor(rand() * 4);
    const dx = (x1 - x0) / n;
    const dy = (y1 - y0) / n;
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
  let gateX = 0;
  ctx.save();
  ctx.clip(shaft);
  for (let i = 0; i < 5; i++) {
    const y0 = tops[i]! + (bots[i]! - tops[i]!) * 0.34;
    const y1 = bots[i]! - 1;
    const fromLeft = i % 2 === 0;
    const x0 = fromLeft ? eL(y0) + halfAt(y0) * 0.1 : eR(y0) - halfAt(y0) * 0.1;
    const x1 = fromLeft ? eR(y1) - halfAt(y1) * 0.13 : eL(y1) + halfAt(y1) * 0.13;
    const slotW = Math.max(3, halfAt(y0) * 0.05);
    const slotTop = i === 0 ? surfaceY : bots[i - 1]! - 1;
    ctx.fillStyle = shade(C.void, 0.5);
    ctx.fillRect(x0 - slotW / 2, slotTop, slotW, y0 - slotTop);
    const th = Math.max(2, s * 0.007 * (1 - i * 0.09));
    const p = drawRun(x0, y0, x1, y1, litCols[i]!, th, 0.24);
    if (i === 0) {
      candleAt = p;
      gateX = x0;
    }
  }
  ctx.restore();

  // ── 6. depth fog — values sink as the shaft drops ─────────────────────────
  ctx.save();
  ctx.clip(shaft);
  const fog = ctx.createLinearGradient(0, tops[0]!, 0, h * 0.62);
  fog.addColorStop(0, shade(C.void, 0.9, 0));
  fog.addColorStop(1, shade(C.void, 0.9, 0.32));
  ctx.fillStyle = fog;
  ctx.fillRect(0, tops[0]!, w, h * 0.62 - tops[0]!);

  // ── 7. below the strata: the switchbacks repeat, diminishing into haze ───
  const thread = mix(bandCol[4]!, C.boneDim, 0.7, 0.85);
  const hazeRuns: Array<[number, number, number, number, number]> = [
    [eR(h * 0.535) - halfAt(h * 0.535) * 0.17, h * 0.535, eL(h * 0.552) + halfAt(h * 0.552) * 0.26, h * 0.552, 0.42],
    [eL(h * 0.557) + halfAt(h * 0.557) * 0.27, h * 0.557, eR(h * 0.573) - halfAt(h * 0.573) * 0.36, h * 0.573, 0.28],
    [eR(h * 0.577) - halfAt(h * 0.577) * 0.37, h * 0.577, cx - sealR * 0.35, h * 0.593, 0.16],
  ];
  for (const [fx0, fy0, fx1, fy1, fa] of hazeRuns) {
    ctx.globalAlpha = fa;
    drawRun(fx0, fy0, fx1, fy1, thread, Math.max(1.5, s * 0.0038));
  }
  ctx.globalAlpha = 1;

  // ── 8. THE VAULT IS LISTENING — sound-ripples climb from the Seal ────────
  ctx.setLineDash([s * 0.018, s * 0.011]);
  const ripples: Array<[number, number]> = [[1.3, 0.44], [1.75, 0.34], [2.3, 0.24], [2.95, 0.15], [3.65, 0.09]];
  for (const [k, a] of ripples) {
    ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.3, a);
    ctx.lineWidth = Math.max(1, s * 0.0022);
    ctx.beginPath();
    ctx.arc(cx, sealCy, sealR * k, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // ── 9. the Seal's gold rim-light bleeds up the shaft ──────────────────────
  ctx.globalCompositeOperation = "lighter";
  const bleed = ctx.createRadialGradient(cx, sealCy, sealR * 0.5, cx, sealCy, sealR * 2.7);
  bleed.addColorStop(0, mix(C.goldInk, C.flameHi, 0.35, 0.15));
  bleed.addColorStop(0.45, mix(C.goldInk, C.flameHi, 0.35, 0.05));
  bleed.addColorStop(1, mix(C.goldInk, C.flameHi, 0.35, 0));
  ctx.fillStyle = bleed;
  ctx.fillRect(cx - sealR * 2.8, sealCy - sealR * 2.8, sealR * 5.6, sealR * 2.8);
  // gilded dust hanging in the Seal's updraft — the shaft breathes gold here
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = mix(C.goldInk, C.flameHi, 0.5, 0.1 + rand() * 0.16);
    ctx.beginPath();
    ctx.arc(
      cx + (rand() - 0.5) * sealR * 2.2,
      sealCy - sealR * (0.95 + rand() * 1.4),
      0.5 + rand() * 0.8, 0, Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore(); // end shaft clip

  // ── 10. THE SEAL — the Gate's iconography, sunk at the shaft's base ──────
  const ring = (r: number, lw: number, color: string, a0 = 0, a1 = Math.PI * 2): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, sealCy, r, a0, a1);
    ctx.stroke();
  };
  const disc = ctx.createRadialGradient(cx, sealCy - sealR * 0.45, sealR * 0.08, cx, sealCy, sealR);
  disc.addColorStop(0, mix(C.surface2, C.goldInk, 0.13));
  disc.addColorStop(0.55, mix(C.void, C.surface2, 0.6));
  disc.addColorStop(1, shade(C.void, 0.72));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, sealCy, sealR, 0, Math.PI * 2);
  ctx.fill();
  // relief rings and ridge spokes, as on the Great Gate above
  ring(sealR * 0.985, Math.max(1.5, sealR * 0.03), shade(C.void, 0.55));
  ring(sealR * 0.8, 1, shade(C.surface2, 1.35, 0.4));
  ring(sealR * 0.62, 1, shade(C.surface2, 1.35, 0.35));
  ring(sealR * 0.42, 1, shade(C.surface2, 1.35, 0.3));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + (rand() - 0.5) * 0.04;
    ctx.strokeStyle = shade(C.surface2, 0.78, 0.32);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * sealR * 0.44, sealCy + Math.sin(a) * sealR * 0.44);
    ctx.lineTo(cx + Math.cos(a) * sealR * 0.78, sealCy + Math.sin(a) * sealR * 0.78);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) { // rivets; those near the crown catch gilt
    const a = (i / 8) * Math.PI * 2 + 0.28;
    const rx = cx + Math.cos(a) * sealR * 0.89;
    const ry = sealCy + Math.sin(a) * sealR * 0.89;
    ctx.fillStyle = Math.sin(a) < -0.3
      ? mix(C.goldInk, C.surface2, 0.45, 0.7)
      : shade(C.surface2, 1.5, 0.55);
    ctx.beginPath();
    ctx.arc(rx, ry, Math.max(1, sealR * 0.016), 0, Math.PI * 2);
    ctx.fill();
  }
  // the closed verdigris seam, top to bottom
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, sealCy - sealR + 2);
  ctx.lineTo(cx, sealCy + sealR - 2);
  ctx.stroke();
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.4, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, sealCy - sealR * 0.92);
  ctx.lineTo(cx, sealCy + sealR * 0.92);
  ctx.stroke();
  ctx.strokeStyle = shade(C.verdigrisDim, 1, 0.16); // patina drips off the seam
  for (let i = 0; i < 3; i++) {
    const dxp = cx + (rand() - 0.5) * sealR * 0.24;
    const dyp = sealCy - sealR * 0.5 + rand() * sealR * 0.8;
    ctx.beginPath();
    ctx.moveTo(dxp, dyp);
    ctx.lineTo(dxp, dyp + sealR * (0.06 + rand() * 0.08));
    ctx.stroke();
  }
  // hub boss
  const hub = ctx.createRadialGradient(cx - sealR * 0.04, sealCy - sealR * 0.06, 0, cx, sealCy, sealR * 0.17);
  hub.addColorStop(0, mix(C.surface2, C.goldInk, 0.2));
  hub.addColorStop(1, shade(C.void, 0.85));
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(cx, sealCy, sealR * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ring(sealR * 0.16, 1, mix(C.goldInk, C.void, 0.3, 0.4));
  // gold rim-light along the crown — the only warmth at this depth
  ring(sealR * 0.985, Math.max(2.5, sealR * 0.05), mix(C.goldInk, C.flameHi, 0.3, 0.2), Math.PI * 1.06, Math.PI * 1.94);
  ring(sealR, Math.max(1.2, sealR * 0.018), mix(C.goldInk, C.flameHi, 0.45, 0.8), Math.PI * 1.06, Math.PI * 1.94);
  // FIVE sigil sockets — five truths; one already dimly answers
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (1.12 + 0.19 * i);
    const sx = cx + Math.cos(a) * sealR * 0.62;
    const sy = sealCy + Math.sin(a) * sealR * 0.62;
    const sr = Math.max(3, sealR * 0.085);
    ctx.fillStyle = shade(C.void, 0.62);
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = mix(C.goldInk, C.void, 0.3, 0.6);
    ctx.lineWidth = Math.max(1, sealR * 0.014);
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.stroke();
    if (i === 2) { // the found truth, dimly lit at the crown
      ctx.globalCompositeOperation = "lighter";
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.6);
      sg.addColorStop(0, mix(C.goldInk, C.flameHi, 0.5, 0.3));
      sg.addColorStop(1, mix(C.goldInk, C.flameHi, 0.5, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(sx - sr * 2.6, sy - sr * 2.6, sr * 5.2, sr * 5.2);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = mix(C.flameHi, C.goldInk, 0.35, 0.9);
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else { // dark sockets, each cut with its own waiting glyph
      ctx.strokeStyle = mix(C.goldInk, C.void, 0.4, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (i === 0) {
        ctx.moveTo(sx - sr * 0.45, sy);
        ctx.lineTo(sx + sr * 0.45, sy);
      } else if (i === 1) {
        ctx.moveTo(sx - sr * 0.4, sy - sr * 0.3);
        ctx.lineTo(sx, sy + sr * 0.4);
        ctx.lineTo(sx + sr * 0.4, sy - sr * 0.3);
      } else if (i === 3) {
        ctx.arc(sx, sy, sr * 0.36, 0, Math.PI * 2);
      } else {
        ctx.moveTo(sx - sr * 0.35, sy - sr * 0.35);
        ctx.lineTo(sx + sr * 0.35, sy + sr * 0.35);
        ctx.moveTo(sx + sr * 0.35, sy - sr * 0.35);
        ctx.lineTo(sx - sr * 0.35, sy + sr * 0.35);
      }
      ctx.stroke();
    }
  }

  // ── 11. SHE IS STILL DOWN THERE — a small braided figure before the door ─
  const floorY2 = sealCy + sealR * 0.56;
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.35, 0.45); // threshold steps
  ctx.lineWidth = 1;
  for (const [sy, sw2] of [[floorY2 + 2, sealR * 1.5], [floorY2 + 5, sealR * 2.1]] as const) {
    ctx.beginPath();
    ctx.moveTo(cx - sw2 / 2, sy);
    ctx.lineTo(cx + sw2 / 2, sy);
    ctx.stroke();
  }
  const fh2 = Math.max(10, h * 0.044);
  const fx2 = cx - sealR * 0.2;
  const fy2 = floorY2 + 1;
  // her light thrown up the door face, so her shape reads black against it
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const herGlow = ctx.createRadialGradient(fx2, fy2 - fh2 * 0.7, 0, fx2, fy2 - fh2 * 0.7, sealR * 0.6);
  herGlow.addColorStop(0, mix(C.flameHi, C.parchment, 0.4, 0.3));
  herGlow.addColorStop(0.5, mix(C.flameHi, C.parchment, 0.4, 0.1));
  herGlow.addColorStop(1, mix(C.flameHi, C.parchment, 0.4, 0));
  ctx.fillStyle = herGlow;
  ctx.fillRect(fx2 - sealR * 0.65, fy2 - fh2 * 0.7 - sealR * 0.65, sealR * 1.3, sealR * 1.3);
  ctx.translate(fx2, fy2 + 1); // pool at her feet
  ctx.scale(1, 0.3);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, fh2 * 1.3);
  pool.addColorStop(0, mix(C.flameHi, C.parchment, 0.4, 0.22));
  pool.addColorStop(1, mix(C.flameHi, C.parchment, 0.4, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-fh2 * 1.4, -fh2 * 1.4, fh2 * 2.8, fh2 * 2.8);
  ctx.restore();
  // her long shadow, falling toward the viewer into the dark
  const shG = ctx.createLinearGradient(0, fy2, 0, h * 0.87);
  shG.addColorStop(0, shade(C.void, 0.4, 0.5));
  shG.addColorStop(1, shade(C.void, 0.4, 0));
  ctx.fillStyle = shG;
  ctx.beginPath();
  ctx.moveTo(fx2 - fh2 * 0.16, fy2);
  ctx.lineTo(fx2 + fh2 * 0.16, fy2);
  ctx.lineTo(fx2 + fh2 * 0.5, h * 0.87);
  ctx.lineTo(fx2 - fh2 * 0.5, h * 0.87);
  ctx.closePath();
  ctx.fill();
  // the silhouette — narrow shoulders, long dress-hem, braid down her back
  const her = new Path2D();
  her.moveTo(fx2 - fh2 * 0.17, fy2);
  her.bezierCurveTo(fx2 - fh2 * 0.13, fy2 - fh2 * 0.34, fx2 - fh2 * 0.09, fy2 - fh2 * 0.55, fx2 - fh2 * 0.07, fy2 - fh2 * 0.7);
  her.quadraticCurveTo(fx2, fy2 - fh2 * 0.78, fx2 + fh2 * 0.07, fy2 - fh2 * 0.7);
  her.bezierCurveTo(fx2 + fh2 * 0.09, fy2 - fh2 * 0.55, fx2 + fh2 * 0.13, fy2 - fh2 * 0.34, fx2 + fh2 * 0.17, fy2);
  her.closePath();
  ctx.fillStyle = shade(C.void, 0.45);
  ctx.fill(her);
  ctx.beginPath(); // head
  ctx.arc(fx2, fy2 - fh2 * 0.84, fh2 * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.45); // braid, swung off her left shoulder
  ctx.lineWidth = Math.max(1, fh2 * 0.05);
  ctx.beginPath();
  ctx.moveTo(fx2 - fh2 * 0.05, fy2 - fh2 * 0.8);
  ctx.bezierCurveTo(fx2 - fh2 * 0.14, fy2 - fh2 * 0.62, fx2 - fh2 * 0.1, fy2 - fh2 * 0.5, fx2 - fh2 * 0.15, fy2 - fh2 * 0.36);
  ctx.stroke();
  ctx.beginPath(); // raised arm toward the seam
  ctx.moveTo(fx2 + fh2 * 0.05, fy2 - fh2 * 0.62);
  ctx.lineTo(fx2 + fh2 * 0.3, fy2 - fh2 * 0.92);
  ctx.stroke();
  ctx.strokeStyle = mix(C.flameHi, C.goldInk, 0.4, 0.5); // rim-light, flame side
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fx2 + fh2 * 0.07, fy2 - fh2 * 0.68);
  ctx.bezierCurveTo(fx2 + fh2 * 0.09, fy2 - fh2 * 0.52, fx2 + fh2 * 0.13, fy2 - fh2 * 0.3, fx2 + fh2 * 0.16, fy2 - fh2 * 0.04);
  ctx.stroke();
  // HER flame — white-gold, unlike the amber candle far above
  const hfx = fx2 + fh2 * 0.32;
  const hfy = fy2 - fh2 * 0.98;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const hHalo = ctx.createRadialGradient(hfx, hfy, 0, hfx, hfy, fh2 * 0.6);
  hHalo.addColorStop(0, shade(C.flameHi, 0.9, 0.45));
  hHalo.addColorStop(1, shade(C.flameHi, 0.9, 0));
  ctx.fillStyle = hHalo;
  ctx.fillRect(hfx - fh2 * 0.65, hfy - fh2 * 0.65, fh2 * 1.3, fh2 * 1.3);
  ctx.restore();
  ctx.fillStyle = mix(C.flameHi, C.parchment, 0.35);
  ctx.beginPath();
  ctx.ellipse(hfx, hfy, Math.max(1, fh2 * 0.045), Math.max(1.8, fh2 * 0.085), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(C.parchment, C.flameHi, 0.2);
  ctx.beginPath();
  ctx.arc(hfx, hfy + fh2 * 0.02, Math.max(0.7, fh2 * 0.028), 0, Math.PI * 2);
  ctx.fill();

  // ── 12. the tower walls — darkest cutouts, tapering with the shaft ───────
  const wT = (y: number): number =>
    Math.max(8, w * 0.052 - (w * 0.052 - w * 0.024) * ((y - surfaceY) / (taperY1 - surfaceY)));
  for (const side of [-1, 1] as const) {
    const eIn = (y: number): number => (side < 0 ? eL(y) : eR(y));
    const wg = ctx.createLinearGradient(0, surfaceY, 0, h);
    wg.addColorStop(0, shade(C.void, 0.62));
    wg.addColorStop(1, shade(C.void, 0.42));
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(eIn(surfaceY) + side * wT(surfaceY), surfaceY);
    ctx.lineTo(eIn(surfaceY), surfaceY);
    ctx.lineTo(eIn(h), h);
    ctx.lineTo(eIn(h) + side * wT(h), h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 0.3, 0.6); // great block joints
    ctx.lineWidth = 1;
    for (let j = 1; j < 8; j++) {
      const jy = surfaceY + ((h - surfaceY) * j) / 8.2 + (rand() - 0.5) * h * 0.008;
      ctx.beginPath();
      ctx.moveTo(eIn(jy), jy);
      ctx.lineTo(eIn(jy) + side * wT(jy), jy);
      ctx.stroke();
    }
    // inner edge catches what light falls down the shaft
    const edge = ctx.createLinearGradient(0, surfaceY, 0, h * 0.64);
    edge.addColorStop(0, mix(C.bone, C.void, 0.3, 0.35));
    edge.addColorStop(1, mix(C.bone, C.void, 0.3, 0));
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(eIn(surfaceY), surfaceY);
    ctx.lineTo(eIn(h * 0.64), h * 0.64);
    ctx.stroke();
  }

  // ── 13. twenty-five floor-notches scored down the left wall edge ─────────
  for (let i = 0; i < 25; i++) {
    const ny = h * (0.095 + i * 0.020417);
    const gold = i % 5 === 4;
    const len = Math.max(4, s * (gold ? 0.013 : 0.008));
    ctx.strokeStyle = gold ? mix(C.goldInk, C.void, 0.22, 0.8) : shade(C.bone, 0.95, 0.5);
    ctx.lineWidth = gold ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(eL(ny) + 1, ny);
    ctx.lineTo(eL(ny) + 1 + len, ny);
    ctx.stroke();
    if (gold) { // a stratum-lamp at each fifth notch, dimming with depth
      ctx.fillStyle = mix(C.goldInk, C.flameHi, 0.35, 0.9 - i * 0.02);
      ctx.beginPath();
      ctx.arc(eL(ny) + 2 + len, ny, Math.max(1, s * 0.0018), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 14. the Vault's attention: eye-glints and carved ear-spirals ─────────
  const eyes = (ex0: number, ey0: number, sc: number, a: number): void => {
    const sep = Math.max(4, s * 0.012) * sc;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const hz = ctx.createRadialGradient(ex0, ey0, 0, ex0, ey0, sep * 2.2);
    hz.addColorStop(0, shade(C.verdigrisDim, 0.9, 0.12 * a));
    hz.addColorStop(1, shade(C.verdigrisDim, 0.9, 0));
    ctx.fillStyle = hz;
    ctx.fillRect(ex0 - sep * 2.4, ey0 - sep * 2.4, sep * 4.8, sep * 4.8);
    ctx.restore();
    for (const [ex, ey] of [[ex0 - sep / 2, ey0 + 1], [ex0 + sep / 2, ey0]] as const) {
      ctx.fillStyle = mix(C.verdigris, C.verdigrisDim, 0.3, 0.65 * a);
      ctx.beginPath();
      ctx.ellipse(ex, ey, Math.max(1.6, s * 0.003) * sc, Math.max(1, s * 0.0019) * sc, 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(C.verdigris, 1.35, 0.85 * a);
      ctx.beginPath();
      ctx.arc(ex + 0.4, ey - 0.2, Math.max(0.6, s * 0.0011) * sc, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  eyes(eR(tops[1]! + 8) - halfAt(tops[1]!) * 0.06, (tops[1]! + bots[1]!) / 2, 1.15, 1);
  eyes(eL(tops[3]! + 8) + halfAt(tops[3]!) * 0.07, (tops[3]! + bots[3]!) / 2, 1, 0.9);
  eyes(eR(tops[4]! + 8) - halfAt(tops[4]!) * 0.08, tops[4]! + (bots[4]! - tops[4]!) * 0.32, 0.75, 0.6);
  const spiral = (px: number, py: number, r: number, a: number): void => {
    ctx.strokeStyle = shade(C.boneDim, 1, a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const ang = t * Math.PI * 3.8;
      const rr = r * t;
      const x = px + Math.cos(ang) * rr;
      const y = py + Math.sin(ang) * rr * 1.15;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  spiral(eR((tops[2]! + bots[2]!) / 2) + wT((tops[2]! + bots[2]!) / 2) * 0.5, (tops[2]! + bots[2]!) / 2, Math.max(5, s * 0.013), 0.6);
  spiral(eL((tops[4]! + bots[4]!) / 2) - wT((tops[4]! + bots[4]!) / 2) * 0.5, (tops[4]! + bots[4]!) / 2, Math.max(4, s * 0.011), 0.45);

  // ── 15. the ground line and the town above, tiny against the gloom ───────
  const groundTop = surfaceY - Math.max(5, h * 0.016);
  ctx.fillStyle = mix(C.void, C.surface, 0.6);
  ctx.fillRect(0, groundTop, w, surfaceY - groundTop);
  ctx.strokeStyle = shade(bandCol[0]!, 1.22, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundTop + 0.5);
  ctx.lineTo(w, groundTop + 0.5);
  ctx.stroke();
  ctx.fillStyle = shade(C.void, 0.62); // huts on the flanks
  for (const fxr of [0.05, 0.1, 0.88, 0.94]) {
    const hx = w * fxr;
    const hw = w * 0.026;
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
  const gh = Math.max(9, h * 0.026);
  const gw = Math.max(12, w * 0.05);
  ctx.fillStyle = shade(C.void, 0.6);
  ctx.beginPath();
  ctx.moveTo(gateX - gw / 2, groundTop);
  ctx.lineTo(gateX - gw * 0.34, groundTop - gh);
  ctx.lineTo(gateX + gw * 0.34, groundTop - gh);
  ctx.lineTo(gateX + gw / 2, groundTop);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(C.void, 0.42);
  ctx.fillRect(gateX - Math.max(3, w * 0.006), groundTop - gh * 0.42, Math.max(6, w * 0.012), gh * 0.42 + (surfaceY - groundTop));
  ctx.fillStyle = mix(C.flame, C.flameHi, 0.4, 0.9);
  for (const wxr of [-0.22, 0.22]) {
    ctx.beginPath();
    ctx.arc(gateX + gw * wxr, groundTop - gh * 0.55, Math.max(1, s * 0.0025), 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 16. the delver setting out — an amber candle, first run down ─────────
  const fw = Math.max(1.8, s * 0.0045);
  const fhF = Math.max(4, s * 0.009);
  const dotX = candleAt.x + fw * 1.6;
  const dotY = candleAt.y - fhF * 1.9;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, s * 0.055);
  halo.addColorStop(0, shade(C.flame, 1, 0.45));
  halo.addColorStop(0.35, shade(C.flame, 1, 0.16));
  halo.addColorStop(1, shade(C.flame, 1, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(dotX - s * 0.06, dotY - s * 0.06, s * 0.12, s * 0.12);
  ctx.restore();
  ctx.fillStyle = shade(C.void, 0.9);
  ctx.beginPath();
  ctx.ellipse(candleAt.x - fw * 0.6, candleAt.y - fhF, fw, fhF, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(candleAt.x - fw * 0.6, candleAt.y - fhF * 2.05, fw * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.flame;
  ctx.beginPath();
  ctx.arc(dotX, dotY, Math.max(1.4, s * 0.0032), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(C.flame, C.flameHi, 0.6);
  ctx.beginPath();
  ctx.arc(dotX, dotY - 0.4, Math.max(0.7, s * 0.0016), 0, Math.PI * 2);
  ctx.fill();

  // ── 17. grain, then crush / settle / vignettes — close the folio ─────────
  for (let i = 0; i < 560; i++) {
    const gx2 = rand() * w;
    const gy2 = rand() * h * 0.78; // stay clear of the caption band
    ctx.fillStyle = rand() < 0.5
      ? shade(C.bone, 1, 0.015 + rand() * 0.025)
      : shade(C.void, 0.3, 0.03 + rand() * 0.03);
    ctx.fillRect(gx2, gy2, 1, 1);
  }
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.13);
  crush.addColorStop(0, shade(C.void, 0.7, 0.85));
  crush.addColorStop(1, shade(C.void, 0.7, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.13);
  const settle = ctx.createLinearGradient(0, h * 0.76, 0, h);
  settle.addColorStop(0, shade(C.void, 0.7, 0));
  settle.addColorStop(1, shade(C.void, 0.7, 0.85));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.76, w, h * 0.24);
  const vr = s * 0.55;
  for (const [vx, vy] of [[0, 0], [w, 0], [0, h], [w, h]] as const) {
    const vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    vg.addColorStop(0, shade(C.void, 0.5, 0.4));
    vg.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}
