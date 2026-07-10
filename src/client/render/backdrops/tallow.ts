/**
 * Backdrop — THE TALLOW HALLS (floors 1–4, warm-grey masonry biome).
 *
 * The distance layer behind the candle-lit isometric world: a vast vaulted
 * undercroft receding into fog. A ceiling line of shallow brick arches hangs
 * along the top edge (two rows — the far one sagging deeper, barely above
 * void), two colossal column silhouettes run off the left and right edges,
 * slow wax-dripstone mounds rise out of the bottom corners, and one distant
 * row of faint arch openings sleeps on the far wall. Pure stone — no warm
 * accent anywhere. Flat silhouette fills at three fog stops with crisp
 * hairline edges; every tone derived from void/surface/surface2 via shade()/
 * mix(); nothing brighter than surface2. The middle 50% of the frame stays
 * near-pure void — the game world renders on top of it. Private LCG, no
 * Math.random.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../paint.js";

// Private LCG (guildhall's hallRand pattern, own seed) — paint.ts crand()'s
// stream belongs to the world-texture painters and must not be touched.
function tallowRand(seed: number): () => number {
  let s = seed >>> 0 || 0x7a110c;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintTallowBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = tallowRand(0x7a110c);
  const s = Math.min(w, h);

  // Fog stops — far barely above void, near up to (never past) the surface2
  // luminance ceiling. Hairlines are surface2 at low alpha over darker fills,
  // so no composite ever exceeds the ceiling.
  const WALL = mix(C.void, C.surface, 0.55); // far wall, barely above void
  const FARC = mix(C.void, C.surface2, 0.4); // far ceiling row
  const FARM = mix(C.void, C.surface2, 0.42); // far dripstone
  const MIDM = mix(C.void, C.surface2, 0.58); // near dripstone
  const NEARC = mix(C.void, C.surface2, 0.72); // near ceiling row
  const NEARM = mix(C.void, C.surface2, 0.78); // the two great columns
  const EDGE = C.surface2;

  // ── 1. base wash — void, the faintest lift at the very top and bottom ────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, mix(C.void, C.surface, 0.32));
  base.addColorStop(0.22, C.void);
  base.addColorStop(0.76, C.void);
  base.addColorStop(1, mix(C.void, C.surface, 0.2));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. the far wall — a low band barely above void, arch openings punched ─
  const wallTop = h * 0.775;
  const wallFloor = h * 0.868;
  const crown: Array<[number, number]> = [];
  const CSEGS = 14;
  for (let i = 0; i <= CSEGS; i++) {
    crown.push([(i / CSEGS) * (w + 4) - 2, wallTop + (rand() - 0.5) * h * 0.006]);
  }
  const wallG = ctx.createLinearGradient(0, wallTop, 0, h * 0.945);
  wallG.addColorStop(0, WALL);
  wallG.addColorStop(0.6, WALL);
  wallG.addColorStop(1, mix(C.void, C.surface, 0.55, 0)); // floor falls into void
  ctx.fillStyle = wallG;
  ctx.beginPath();
  ctx.moveTo(-2, h * 0.945);
  for (const [px, py] of crown) ctx.lineTo(px, py);
  ctx.lineTo(w + 2, h * 0.945);
  ctx.closePath();
  ctx.fill();
  // hairline along the wall crown
  ctx.strokeStyle = shade(EDGE, 1, 0.13);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(crown[0]![0], crown[0]![1]);
  for (const [px, py] of crown) ctx.lineTo(px, py);
  ctx.stroke();
  // the arcade — faint openings into deeper dark, running edge to edge
  ctx.fillStyle = shade(C.void, 0.72);
  let ax = w * (0.012 + rand() * 0.03);
  while (ax < w) {
    const aw2 = Math.max(3, w * (0.011 + rand() * 0.004)); // half-width
    const ah = h * (0.042 + rand() * 0.013);
    const floorY = wallFloor + (rand() - 0.5) * h * 0.004;
    ctx.beginPath();
    ctx.moveTo(ax - aw2, floorY);
    ctx.lineTo(ax - aw2, floorY - ah + aw2);
    ctx.arc(ax, floorY - ah + aw2, aw2, Math.PI, 0);
    ctx.lineTo(ax + aw2, floorY);
    ctx.closePath();
    ctx.fill();
    ax += w * (0.052 + rand() * 0.02);
  }

  // ── 3. the vaulted ceiling — two rows of shallow brick arches ─────────────
  // Bottom edge is a scallop: arcs rise between springers, masonry points
  // hang down between them. Far row sags deeper and fainter behind the near.
  const archRow = (span: number, yLow: number, yHigh: number, fill: string, edgeA: number, near: boolean): void => {
    const xs: number[] = [];
    let x = -span * (0.25 + rand() * 0.4);
    while (x < w + span) {
      xs.push(x);
      x += span * (0.84 + rand() * 0.32);
    }
    const ctrlY = 2 * yHigh - yLow; // quadratic control so arcs peak at yHigh
    const scallop = new Path2D();
    scallop.moveTo(xs[0]!, yLow);
    for (let i = 1; i < xs.length; i++) {
      scallop.quadraticCurveTo((xs[i - 1]! + xs[i]!) / 2, ctrlY, xs[i]!, yLow);
    }
    const mass = new Path2D(scallop);
    mass.lineTo(xs[xs.length - 1]!, -2);
    mass.lineTo(xs[0]!, -2);
    mass.closePath();
    ctx.fillStyle = fill;
    ctx.fill(mass);
    if (near) {
      // pendant pier tops hanging below each springer
      for (let i = 1; i < xs.length - 1; i++) {
        const nx = xs[i]!;
        const nw = span * 0.055;
        const nd = (yLow - yHigh) * (0.26 + rand() * 0.14);
        ctx.beginPath();
        ctx.moveTo(nx - nw, yLow - 1);
        ctx.lineTo(nx + (rand() - 0.5) * nw * 0.4, yLow + nd);
        ctx.lineTo(nx + nw, yLow - 1);
        ctx.closePath();
        ctx.fill();
      }
    }
    // crisp soffit hairline
    ctx.strokeStyle = shade(EDGE, 1, edgeA);
    ctx.lineWidth = 1;
    ctx.stroke(scallop);
    if (near) {
      // voussoir ticks — short brick joints radiating into the mass
      ctx.strokeStyle = shade(C.void, 1, 0.28);
      ctx.lineWidth = 1;
      for (let i = 1; i < xs.length; i++) {
        const x0 = xs[i - 1]!;
        const x1 = xs[i]!;
        const cxq = (x0 + x1) / 2;
        for (const t of [0.16, 0.32, 0.5, 0.68, 0.84]) {
          const mt = 1 - t;
          const px = mt * mt * x0 + 2 * mt * t * cxq + t * t * x1;
          const py = mt * mt * yLow + 2 * mt * t * ctrlY + t * t * yLow;
          let tx = 2 * mt * (cxq - x0) + 2 * t * (x1 - cxq);
          let ty = 2 * mt * (ctrlY - yLow) + 2 * t * (yLow - ctrlY);
          const tl = Math.hypot(tx, ty) || 1;
          tx /= tl;
          ty /= tl;
          let nx = ty; // normal, pointed up into the masonry
          let ny = -tx;
          if (ny > 0) {
            nx = -nx;
            ny = -ny;
          }
          const len = (yLow - yHigh) * (0.18 + rand() * 0.1);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + nx * len, py + ny * len);
          ctx.stroke();
        }
      }
    }
  };
  archRow(w * 0.105, h * 0.168, h * 0.075, FARC, 0.1, false);
  archRow(w * 0.155, h * 0.104, h * 0.028, NEARC, 0.24, true);

  // ── 4. dripstone in the bottom corners — slow wax forms, two fog stops ───
  const waxField = (mounds: Array<[number, number, number]>, fill: string, edgeA: number, drips: boolean): void => {
    for (const [cx, bw, ty] of mounds) {
      const baseY = h + 3;
      const ht = baseY - ty;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(cx - bw, baseY);
      // slumped left shoulder up to the crown
      ctx.bezierCurveTo(
        cx - bw * 0.95, ty + ht * 0.45,
        cx - bw * 0.72, ty + ht * 0.16,
        cx - bw * (0.3 + rand() * 0.08), ty + ht * 0.05,
      );
      // rounded, slightly leaning crown
      ctx.quadraticCurveTo(cx - bw * 0.12, ty, cx + bw * (0.05 + rand() * 0.06), ty + ht * 0.02);
      // heavier right shoulder
      ctx.bezierCurveTo(
        cx + bw * 0.5, ty + ht * 0.12,
        cx + bw * 0.85, ty + ht * 0.5,
        cx + bw, baseY,
      );
      ctx.closePath();
      ctx.fill();
      if (edgeA > 0) {
        ctx.strokeStyle = shade(EDGE, 1, edgeA);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (drips) {
        // one or two wax seams running down the form
        ctx.strokeStyle = shade(C.void, 1, 0.3);
        ctx.lineWidth = Math.max(1, s * 0.0018);
        const nd = 1 + Math.floor(rand() * 2);
        for (let d = 0; d < nd; d++) {
          const dx0 = cx + (rand() - 0.5) * bw * 0.7;
          ctx.beginPath();
          ctx.moveTo(dx0, ty + ht * (0.1 + rand() * 0.08));
          ctx.bezierCurveTo(
            dx0 + bw * 0.07, ty + ht * 0.36,
            dx0 - bw * 0.06, ty + ht * 0.62,
            dx0 + (rand() - 0.5) * bw * 0.12, h * 0.995,
          );
          ctx.stroke();
        }
      }
    }
  };
  // far layer — a receding chain, barely above the wall band behind it
  const farCx = [-0.012, 0.068, 0.148, 0.228, 0.308];
  const farBw = [0.095, 0.072, 0.06, 0.052, 0.046];
  const farTop = [0.735, 0.762, 0.792, 0.818, 0.845];
  for (const side of [0, 1] as const) {
    const list: Array<[number, number, number]> = [];
    for (let i = 0; i < farCx.length; i++) {
      const cx = farCx[i]! * w + (rand() - 0.5) * w * 0.018;
      list.push([
        side === 0 ? cx : w - cx,
        farBw[i]! * w * (0.9 + rand() * 0.2),
        h * (farTop[i]! + (rand() - 0.5) * 0.014),
      ]);
    }
    waxField(list, FARM, 0, false);
  }
  // near layer — fewer, taller, with seams; hugs the corners
  const nearCx = [-0.02, 0.072, 0.152];
  const nearBw = [0.078, 0.05, 0.038];
  const nearTop = [0.708, 0.756, 0.802];
  for (const side of [0, 1] as const) {
    const list: Array<[number, number, number]> = [];
    for (let i = 0; i < nearCx.length; i++) {
      const cx = nearCx[i]! * w + (rand() - 0.5) * w * 0.014;
      list.push([
        side === 0 ? cx : w - cx,
        nearBw[i]! * w * (0.9 + rand() * 0.2),
        h * (nearTop[i]! + (rand() - 0.5) * 0.012),
      ]);
    }
    waxField(list, MIDM, 0.15, true);
  }

  // ── 5. the two colossal columns — nearest masses, running off both edges ─
  const column = (side: 0 | 1): void => {
    const dir = side === 0 ? 1 : -1;
    const e = side === 0 ? w * 0.135 : w * 0.865; // shaft inner edge
    const offX = side === 0 ? -2 : w + 2;
    const capOut = w * 0.024;
    const yCap0 = h * (0.106 + rand() * 0.008);
    const yCap1 = yCap0 + h * 0.026;
    const yNeck = yCap1 + h * 0.03;
    const yBase0 = h * 0.842;
    const yBase1 = h * 0.888;
    const profile = new Path2D();
    profile.moveTo(e - dir * w * 0.014, -2); // pier above the capital
    profile.lineTo(e - dir * w * 0.014, yCap0 - h * 0.004);
    profile.lineTo(e + dir * capOut, yCap0 + h * 0.002); // abacus chamfer
    profile.lineTo(e + dir * capOut, yCap1); // abacus slab
    profile.quadraticCurveTo(e + dir * capOut * 0.45, yCap1 + h * 0.01, e, yNeck); // echinus
    profile.quadraticCurveTo(e + dir * w * 0.006, h * 0.5, e, yBase0); // entasis
    profile.quadraticCurveTo(e + dir * w * 0.003, yBase1 - h * 0.002, e + dir * w * 0.024, yBase1); // base flare
    profile.lineTo(e + dir * w * 0.024, yBase1 + h * 0.01);
    profile.lineTo(e + dir * w * 0.04, yBase1 + h * 0.01); // plinth step
    profile.lineTo(e + dir * w * 0.04, h + 2);
    const mass = new Path2D(profile);
    mass.lineTo(offX, h + 2);
    mass.lineTo(offX, -2);
    mass.closePath();
    ctx.fillStyle = NEARM;
    ctx.fill(mass);
    // crisp inner-edge hairline
    ctx.strokeStyle = shade(EDGE, 1, 0.25);
    ctx.lineWidth = 1;
    ctx.stroke(profile);
    // shadow under the abacus slab
    ctx.strokeStyle = shade(C.void, 1, 0.38);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(offX, yCap1 + 0.5);
    ctx.lineTo(e + dir * capOut * 0.9, yCap1 + 0.5);
    ctx.stroke();
    // drum joints — the great masonry courses
    ctx.strokeStyle = shade(C.void, 1, 0.32);
    let jy = yNeck + h * 0.055;
    while (jy < yBase0 - h * 0.03) {
      ctx.beginPath();
      ctx.moveTo(offX, jy);
      ctx.lineTo(e - dir * 2, jy + (rand() - 0.5) * 2);
      ctx.stroke();
      jy += h * (0.07 + rand() * 0.028);
    }
  };
  column(0);
  column(1);
}
