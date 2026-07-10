/**
 * Story slide 6 — "The town's memory." A buried chamber holds a single
 * waystone: the game's verdigris monolith (tapered strata-carved stone,
 * groove-and-glow rune) rendered here as something sacred — the one place
 * the cold green light reads as mercy, not menace. Around its base, the
 * evidence of the dead teaching the living: a slumped hooded delver with a
 * spent candle, chalk workings on the flagstones, a planted wooden sign,
 * two tiny votive flames still lit. Bone-pale ghost script rises off the
 * stone like smoke — carved lines ascending, fading into the dark.
 *
 * Pure canvas painting in the guildhall idiom: token colors via shade()/
 * mix() only, flat woodcut masses, three fog stops, a private LCG for
 * jitter, no speckle. Caller has scaled for DPR and cleared; the center-
 * bottom third stays calm and dark for the caption.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall's hallRand pattern, own seed) — never Math.random,
// never paint.ts crand (its stream belongs to the world-texture painters).
function slideRand(seed: number): () => number {
  let s = seed >>> 0 || 0x57a7e;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintWaystone(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = slideRand(0x57a7e);
  const s = Math.min(w, h);
  const INK = shade(C.void, 0.7, 0.9);

  // stone geometry — center, upper half; floor line above the caption zone
  const cx = w * 0.5;
  const floorY = h * 0.6;
  const topY = h * 0.165;
  const baseY = floorY - h * 0.008;
  const sw = Math.min(Math.max(s * 0.09, 34), 96); // half-width at the shoulder
  const shoulderY = topY + sw * 1.15;
  const runeY = topY + (baseY - topY) * 0.42;

  // 1. base void gradient — cool lift behind the stone, crushed floor
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, C.void);
  base.addColorStop(0.4, mix(C.void, C.surface, 0.5));
  base.addColorStop(0.6, mix(C.void, C.surface2, 0.5));
  base.addColorStop(1, shade(C.void, 0.85));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // 2. the sacred aura — one wide verdigris breath centered on the rune
  const aura = ctx.createRadialGradient(cx, runeY, s * 0.02, cx, runeY, s * 0.62);
  aura.addColorStop(0, shade(C.verdigris, 0.95, 0.16));
  aura.addColorStop(0.45, shade(C.verdigrisDim, 1, 0.08));
  aura.addColorStop(1, shade(C.verdigris, 1, 0));
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, w, h);

  // 3. far architecture — fog stop 1: hazy chamber columns and vault ribs
  ctx.fillStyle = mix(C.void, C.surface, 0.35);
  const farXs = [0.1, 0.28, 0.72, 0.9];
  for (const fx of farXs) {
    const colW = (0.04 + rand() * 0.025) * w;
    const colX = fx * w - colW / 2 + (rand() - 0.5) * 0.03 * w;
    const colTop = h * (0.1 + rand() * 0.06);
    ctx.fillRect(colX, colTop, colW, floorY - colTop);
    // capital flare
    ctx.beginPath();
    ctx.moveTo(colX - colW * 0.3, colTop + h * 0.02);
    ctx.lineTo(colX + colW * 1.3, colTop + h * 0.02);
    ctx.lineTo(colX + colW, colTop + h * 0.045);
    ctx.lineTo(colX, colTop + h * 0.045);
    ctx.closePath();
    ctx.fill();
  }
  // vault ribs sagging between the columns
  ctx.strokeStyle = mix(C.void, C.surface, 0.45, 0.6);
  ctx.lineWidth = Math.max(1, s * 0.004);
  for (let i = 0; i < 3; i++) {
    const y0 = h * (0.06 + i * 0.035);
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(w * (0.3 + rand() * 0.4), y0 + h * (0.05 + rand() * 0.03), w, y0 + (rand() - 0.5) * h * 0.02);
    ctx.stroke();
  }

  // 4. fog band at the horizon — tinted faintly toward the stone's green
  const fog = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.64);
  fog.addColorStop(0, mix(C.void, C.verdigrisDim, 0.16, 0));
  fog.addColorStop(0.5, mix(C.void, C.verdigrisDim, 0.16, 0.45));
  fog.addColorStop(1, mix(C.void, C.verdigrisDim, 0.16, 0));
  ctx.fillStyle = fog;
  ctx.fillRect(0, h * 0.5, w, h * 0.14);

  // 5. floor — flagstone joints receding, fading before the caption zone
  const floor = ctx.createLinearGradient(0, floorY, 0, h);
  floor.addColorStop(0, mix(C.void, C.surface2, 0.5));
  floor.addColorStop(1, shade(C.void, 0.8));
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.strokeStyle = shade(C.surface2, 1.25, 0.28);
  ctx.lineWidth = 1;
  let rowY = floorY + h * 0.012;
  let gap = h * 0.02;
  const rows: number[] = [];
  while (rowY < h * 0.85) {
    rows.push(rowY);
    ctx.globalAlpha = Math.max(0.15, 1 - (rowY - floorY) / (h * 0.32));
    ctx.beginPath();
    ctx.moveTo(0, rowY);
    ctx.lineTo(w, rowY);
    ctx.stroke();
    rowY += gap;
    gap *= 1.5;
  }
  // staggered vertical joints (skip the calm bottom-center)
  for (let i = 0; i < rows.length - 1; i++) {
    const y0 = rows[i]!;
    const y1 = rows[i + 1]!;
    const n = 5 - i;
    for (let j = 0; j < n; j++) {
      const jx = (0.06 + rand() * 0.88) * w;
      if (y0 > h * 0.72 && jx > w * 0.22 && jx < w * 0.78) continue;
      ctx.globalAlpha = Math.max(0.1, 0.3 - i * 0.07);
      ctx.beginPath();
      ctx.moveTo(jx, y0);
      ctx.lineTo(jx + (rand() - 0.5) * 4, y1);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // 6. the rune's pool of light on the floor
  ctx.save();
  ctx.translate(cx, floorY + h * 0.015);
  ctx.scale(1, 0.32);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.34);
  pool.addColorStop(0, shade(C.verdigris, 0.95, 0.16));
  pool.addColorStop(0.6, shade(C.verdigrisDim, 1, 0.07));
  pool.addColorStop(1, shade(C.verdigris, 1, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-s * 0.36, -s * 0.36, s * 0.72, s * 0.72);
  ctx.restore();

  // 7. THE WAYSTONE — the game's monolith read, enlarged and consecrated
  // contact shadow
  ctx.save();
  ctx.translate(cx, baseY + h * 0.006);
  ctx.scale(1, 0.28);
  const cs = ctx.createRadialGradient(0, 0, 0, 0, 0, sw * 1.5);
  cs.addColorStop(0, shade(C.void, 0.55, 0.55));
  cs.addColorStop(1, shade(C.void, 0.55, 0));
  ctx.fillStyle = cs;
  ctx.fillRect(-sw * 1.6, -sw * 1.6, sw * 3.2, sw * 3.2);
  ctx.restore();
  // body — tapered, shouldered, slightly narrower at the foot
  const stone = new Path2D();
  stone.moveTo(cx, topY);
  stone.lineTo(cx + sw, shoulderY);
  stone.lineTo(cx + sw * 0.82, baseY);
  stone.lineTo(cx - sw * 0.82, baseY);
  stone.lineTo(cx - sw, shoulderY);
  stone.closePath();
  const stoneG = ctx.createLinearGradient(cx - sw, 0, cx + sw, 0);
  stoneG.addColorStop(0, shade(C.verdigrisDim, 0.7));
  stoneG.addColorStop(0.42, mix(C.verdigrisDim, C.verdigris, 0.5));
  stoneG.addColorStop(1, shade(C.verdigrisDim, 0.45));
  ctx.fillStyle = stoneG;
  ctx.fill(stone);
  ctx.save();
  ctx.clip(stone);
  // stone strata
  ctx.strokeStyle = shade(C.verdigrisDim, 0.5, 0.42);
  ctx.lineWidth = Math.max(1, sw * 0.022);
  for (let i = 0; i < 7; i++) {
    const y = shoulderY + ((baseY - shoulderY) / 7) * i + rand() * sw * 0.1;
    ctx.beginPath();
    ctx.moveTo(cx - sw, y);
    ctx.quadraticCurveTo(cx, y + (rand() - 0.5) * sw * 0.12, cx + sw, y);
    ctx.stroke();
  }
  // chipped edges
  ctx.fillStyle = shade(C.verdigrisDim, 0.38, 0.7);
  ctx.beginPath();
  ctx.moveTo(cx + sw * 0.92, shoulderY + (baseY - shoulderY) * 0.22);
  ctx.lineTo(cx + sw * 0.74, shoulderY + (baseY - shoulderY) * 0.27);
  ctx.lineTo(cx + sw * 0.9, shoulderY + (baseY - shoulderY) * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - sw * 0.88, shoulderY + (baseY - shoulderY) * 0.6);
  ctx.lineTo(cx - sw * 0.7, shoulderY + (baseY - shoulderY) * 0.65);
  ctx.lineTo(cx - sw * 0.84, shoulderY + (baseY - shoulderY) * 0.7);
  ctx.closePath();
  ctx.fill();
  // moss at the foot
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = mix(C.verdigrisDim, C.verdigris, rand() * 0.5, 0.45);
    ctx.beginPath();
    ctx.ellipse(cx - sw * 0.7 + rand() * sw * 1.4, baseY - rand() * sw * 0.24, sw * 0.13, sw * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // rune halo inside the face
  const halo = ctx.createRadialGradient(cx, runeY, sw * 0.05, cx, runeY, sw * 1.1);
  halo.addColorStop(0, shade(C.verdigris, 1.2, 0.32));
  halo.addColorStop(1, shade(C.verdigris, 1, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - sw * 1.2, runeY - sw * 1.2, sw * 2.4, sw * 2.4);
  ctx.restore();
  // carved rune: dark groove offset, then the glowing core (the game's mark)
  const rune = (ox: number, oy: number, col: string, lw: number): void => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    const rr = sw * 0.52;
    ctx.beginPath();
    ctx.moveTo(cx + ox, runeY - rr + oy);
    ctx.lineTo(cx + ox, runeY + rr + oy);
    ctx.moveTo(cx - rr * 0.62 + ox, runeY - rr * 0.38 + oy);
    ctx.lineTo(cx + rr * 0.62 + ox, runeY - rr * 0.38 + oy);
    ctx.moveTo(cx - rr * 0.52 + ox, runeY + rr * 0.55 + oy);
    ctx.lineTo(cx + rr * 0.52 + ox, runeY + rr * 0.25 + oy);
    ctx.stroke();
  };
  const grooveOff = Math.max(1.2, sw * 0.035);
  rune(grooveOff, grooveOff, shade(C.void, 1.2, 0.7), Math.max(2, sw * 0.075));
  rune(0, 0, shade(C.verdigris, 1.4, 0.3), Math.max(3, sw * 0.13)); // soft bloom
  rune(0, 0, shade(C.verdigris, 1.85), Math.max(1.6, sw * 0.055));
  ctx.lineCap = "butt";
  // ink edge — the woodcut read
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0035);
  ctx.stroke(stone);

  // 8. ghost script rising off the stone like smoke — carved lines ascending
  const glyph = (gx: number, gy: number, gs: number, a: number): void => {
    ctx.strokeStyle = mix(C.bone, C.verdigris, 0.42, a);
    ctx.lineWidth = Math.max(0.8, gs * 0.16);
    ctx.lineCap = "round";
    const kind = Math.floor(rand() * 4);
    ctx.beginPath();
    if (kind === 0) {
      // vertical with crossbar — the rune's child
      ctx.moveTo(gx, gy - gs);
      ctx.lineTo(gx, gy + gs);
      ctx.moveTo(gx - gs * 0.6, gy - gs * 0.3);
      ctx.lineTo(gx + gs * 0.6, gy - gs * 0.3);
    } else if (kind === 1) {
      // chevron
      ctx.moveTo(gx - gs * 0.7, gy + gs * 0.5);
      ctx.lineTo(gx, gy - gs * 0.5);
      ctx.lineTo(gx + gs * 0.7, gy + gs * 0.5);
    } else if (kind === 2) {
      // paired slashes
      ctx.moveTo(gx - gs * 0.6, gy + gs * 0.6);
      ctx.lineTo(gx + gs * 0.2, gy - gs * 0.6);
      ctx.moveTo(gx - gs * 0.1, gy + gs * 0.6);
      ctx.lineTo(gx + gs * 0.7, gy - gs * 0.6);
    } else {
      // small diamond
      ctx.moveTo(gx, gy - gs * 0.7);
      ctx.lineTo(gx + gs * 0.55, gy);
      ctx.lineTo(gx, gy + gs * 0.7);
      ctx.lineTo(gx - gs * 0.55, gy);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.lineCap = "butt";
  };
  // three wavering columns from the shoulders and crown
  const springs: Array<[number, number]> = [
    [cx - sw * 0.55, shoulderY - sw * 0.2],
    [cx, topY - sw * 0.1],
    [cx + sw * 0.6, shoulderY],
  ];
  for (let col = 0; col < springs.length; col++) {
    const [sx, sy] = springs[col]!;
    const nGlyphs = 6 + Math.floor(rand() * 3);
    const drift = (col - 1) * sw * 0.5 + (rand() - 0.5) * sw * 0.4;
    const reach = h * (0.1 + rand() * 0.05);
    // the smoke thread the glyphs ride
    ctx.strokeStyle = shade(C.boneDim, 1.1, 0.14);
    ctx.lineWidth = Math.max(0.8, s * 0.002);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx - sw * 0.4, sy - reach * 0.4, sx + drift + sw * 0.4, sy - reach * 0.7, sx + drift, sy - reach - h * 0.03);
    ctx.stroke();
    for (let i = 0; i < nGlyphs; i++) {
      const t = (i + 1) / (nGlyphs + 1);
      const sway = Math.sin(t * Math.PI * (2 + col * 0.5)) * sw * (0.25 + t * 0.45);
      const gx = sx + drift * t + sway;
      const gy = sy - t * reach - i * sw * 0.12;
      const gs = sw * (0.16 - t * 0.07) * (0.8 + rand() * 0.5);
      glyph(gx, gy, Math.max(2.2, gs), 0.42 * (1 - t * 0.8));
    }
  }

  // 9. the slumped delver at the stone's foot — hood against the stone
  const dw = sw * 1.7; // heap width
  const dx = cx - sw * 0.7 - dw; // left edge; leans on the stone's west foot
  const dy = baseY + h * 0.012; // ground line, just in front of the stone
  const dh = sw * 0.95; // hood peak height
  const heap = new Path2D();
  heap.moveTo(dx, dy);
  heap.bezierCurveTo(dx + dw * 0.05, dy - dh * 0.45, dx + dw * 0.3, dy - dh * 0.6, dx + dw * 0.52, dy - dh * 0.62);
  heap.bezierCurveTo(dx + dw * 0.72, dy - dh * 1.05, dx + dw * 0.95, dy - dh * 0.95, dx + dw, dy - dh * 0.5);
  heap.bezierCurveTo(dx + dw * 1.02, dy - dh * 0.2, dx + dw * 0.95, dy, dx + dw * 0.8, dy);
  heap.bezierCurveTo(dx + dw * 0.5, dy + dh * 0.06, dx + dw * 0.15, dy + dh * 0.06, dx, dy);
  heap.closePath();
  const heapG = ctx.createLinearGradient(dx, 0, dx + dw, 0);
  heapG.addColorStop(0, shade(C.inkSoft, 0.62));
  heapG.addColorStop(0.75, shade(C.inkSoft, 0.95));
  heapG.addColorStop(1, mix(C.inkSoft, C.verdigrisDim, 0.5)); // stone-lit rim
  ctx.fillStyle = heapG;
  ctx.fill(heap);
  ctx.save();
  ctx.clip(heap);
  // collapsed folds
  ctx.strokeStyle = shade(C.void, 1.2, 0.55);
  ctx.lineWidth = Math.max(1, sw * 0.03);
  for (const fx of [0.28, 0.5, 0.68]) {
    ctx.beginPath();
    ctx.moveTo(dx + dw * fx, dy - dh * 0.55);
    ctx.quadraticCurveTo(dx + dw * (fx + 0.06), dy - dh * 0.25, dx + dw * (fx + 0.02), dy);
    ctx.stroke();
  }
  // hood cavity — bowed toward the stone
  ctx.fillStyle = shade(C.void, 0.9);
  ctx.beginPath();
  ctx.ellipse(dx + dw * 0.86, dy - dh * 0.68, dw * 0.1, dh * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // ink silhouette
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.003);
  ctx.stroke(heap);
  // the pale hand, slipped from the cloak toward the chalk
  ctx.fillStyle = mix(C.bone, C.void, 0.25);
  ctx.beginPath();
  ctx.ellipse(dx - dw * 0.06, dy + dh * 0.02, dw * 0.08, dh * 0.05, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 1.3, 0.6);
  ctx.lineWidth = Math.max(0.7, sw * 0.018);
  ctx.beginPath();
  ctx.moveTo(dx - dw * 0.12, dy);
  ctx.lineTo(dx + dw * 0.02, dy + dh * 0.04);
  ctx.stroke();
  // their spent candle: pooled wax, dead wick, one last thread of smoke
  const spx = dx - dw * 0.28;
  const spy = dy + dh * 0.03;
  ctx.fillStyle = shade(C.bone, 0.8);
  ctx.beginPath();
  ctx.ellipse(spx, spy, sw * 0.16, sw * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  const spg = ctx.createLinearGradient(spx - sw * 0.06, 0, spx + sw * 0.06, 0);
  spg.addColorStop(0, shade(C.parchmentAged, 0.95));
  spg.addColorStop(1, shade(C.parchmentAged, 0.6));
  ctx.fillStyle = spg;
  ctx.fillRect(spx - sw * 0.06, spy - sw * 0.26, sw * 0.12, sw * 0.26);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(0.7, sw * 0.02);
  ctx.strokeRect(spx - sw * 0.06, spy - sw * 0.26, sw * 0.12, sw * 0.26);
  ctx.strokeStyle = shade(C.void, 1.5);
  ctx.beginPath();
  ctx.moveTo(spx, spy - sw * 0.26);
  ctx.quadraticCurveTo(spx + sw * 0.025, spy - sw * 0.31, spx + sw * 0.01, sw * 0.02 + spy - sw * 0.35);
  ctx.stroke();
  ctx.strokeStyle = shade(C.boneDim, 1.1, 0.3);
  ctx.lineWidth = Math.max(0.8, sw * 0.022);
  ctx.beginPath();
  ctx.moveTo(spx + sw * 0.01, spy - sw * 0.36);
  ctx.bezierCurveTo(spx - sw * 0.06, spy - sw * 0.5, spx + sw * 0.07, spy - sw * 0.62, spx - sw * 0.02, spy - sw * 0.8);
  ctx.stroke();

  // 10. votive stubs still lit — the warm accent, small against the green
  const votive = (vx: number, vy: number, vh: number): void => {
    const wg = ctx.createRadialGradient(vx, vy - vh, 0, vx, vy - vh, vh * 3.2);
    wg.addColorStop(0, shade(C.flame, 1, 0.2));
    wg.addColorStop(1, shade(C.flame, 1, 0));
    ctx.fillStyle = wg;
    ctx.fillRect(vx - vh * 3.4, vy - vh * 4.6, vh * 6.8, vh * 6.8);
    ctx.fillStyle = shade(C.bone, 0.75);
    ctx.beginPath();
    ctx.ellipse(vx, vy, vh * 0.7, vh * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    const vg = ctx.createLinearGradient(vx - vh * 0.3, 0, vx + vh * 0.3, 0);
    vg.addColorStop(0, shade(C.parchment, 0.92));
    vg.addColorStop(1, shade(C.parchmentAged, 0.62));
    ctx.fillStyle = vg;
    ctx.fillRect(vx - vh * 0.28, vy - vh, vh * 0.56, vh);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(0.7, vh * 0.09);
    ctx.strokeRect(vx - vh * 0.28, vy - vh, vh * 0.56, vh);
    // layered flame
    ctx.fillStyle = mix(C.ember, C.flame, 0.6);
    ctx.beginPath();
    ctx.ellipse(vx, vy - vh * 1.32, vh * 0.22, vh * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.flameHi;
    ctx.beginPath();
    ctx.ellipse(vx, vy - vh * 1.24, vh * 0.1, vh * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  votive(cx + sw * 1.15, baseY + h * 0.018, sw * 0.34);
  votive(cx + sw * 1.55, baseY + h * 0.032, sw * 0.26);

  // 11. the planted sign — timber plank on a post, right of the stone
  const px = cx + sw * 2.35;
  const py = baseY + h * 0.028; // planted a step nearer than the stone
  const postH = Math.max(h * 0.075, sw * 0.9);
  const postW = Math.max(3, sw * 0.11);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-0.045);
  // post
  const postG = ctx.createLinearGradient(-postW / 2, 0, postW / 2, 0);
  postG.addColorStop(0, shade(C.ink, 0.85));
  postG.addColorStop(1, shade(C.inkSoft, 0.9));
  ctx.fillStyle = postG;
  ctx.fillRect(-postW / 2, -postH, postW, postH);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.0028);
  ctx.strokeRect(-postW / 2, -postH, postW, postH);
  // plank
  const plw = sw * 1.5;
  const plh = sw * 0.52;
  const ply = -postH + plh * 0.12;
  const plg = ctx.createLinearGradient(0, ply, 0, ply + plh);
  plg.addColorStop(0, shade(C.inkSoft, 1.05));
  plg.addColorStop(1, shade(C.inkSoft, 0.62));
  ctx.fillStyle = plg;
  ctx.fillRect(-plw / 2, ply, plw, plh);
  // grain
  ctx.strokeStyle = shade(C.void, 1.2, 0.45);
  ctx.lineWidth = Math.max(0.7, sw * 0.02);
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-plw / 2 + 2, ply + (plh / 3) * i + (rand() - 0.5) * 2);
    ctx.quadraticCurveTo(0, ply + (plh / 3) * i + (rand() - 0.5) * 3, plw / 2 - 2, ply + (plh / 3) * i);
    ctx.stroke();
  }
  // carved message — scratches of aged parchment, unreadable at this distance
  ctx.strokeStyle = shade(C.parchmentAged, 0.9, 0.55);
  ctx.lineWidth = Math.max(0.8, sw * 0.026);
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const mx = -plw * 0.36 + (plw * 0.72 / 4) * i + rand() * plw * 0.05;
    const my = ply + plh * (0.3 + rand() * 0.35);
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + plw * (0.07 + rand() * 0.06), my + (rand() - 0.5) * plh * 0.2);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.strokeStyle = INK;
  ctx.strokeRect(-plw / 2, ply, plw, plh);
  ctx.restore();
  // pebbles bracing the post
  ctx.fillStyle = mix(C.void, C.surface2, 0.85);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(px - postW + i * postW * 1.1, py + 1, postW * 0.5, postW * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 12. chalk workings on the flagstones — the dead still teaching
  const chalk = (a: number): void => {
    ctx.strokeStyle = shade(C.parchment, 1.02, a);
    ctx.lineWidth = Math.max(1, s * 0.0032);
    ctx.lineCap = "round";
  };
  // left, by the fallen hand: an arrow toward the stone, and tally marks
  ctx.save();
  ctx.translate(cx - sw * 3.1, floorY + h * 0.052);
  ctx.scale(1, 0.5);
  chalk(0.5);
  ctx.beginPath();
  ctx.moveTo(-sw * 0.9, sw * 0.35);
  ctx.lineTo(sw * 0.55, -sw * 0.3);
  ctx.moveTo(sw * 0.1, -sw * 0.3);
  ctx.lineTo(sw * 0.55, -sw * 0.3);
  ctx.lineTo(sw * 0.42, sw * 0.12);
  ctx.stroke();
  chalk(0.32); // chalky double-pass, slightly off
  ctx.beginPath();
  ctx.moveTo(-sw * 0.86, sw * 0.42);
  ctx.lineTo(sw * 0.5, -sw * 0.24);
  ctx.stroke();
  chalk(0.45);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-sw * 0.7 + i * sw * 0.22, sw * 0.75);
    ctx.lineTo(-sw * 0.78 + i * sw * 0.22, sw * 1.15);
    ctx.stroke();
  }
  ctx.beginPath(); // the strike-through: four, counted done
  ctx.moveTo(-sw * 0.95, sw * 1.05);
  ctx.lineTo(sw * 0.05, sw * 0.8);
  ctx.stroke();
  ctx.restore();
  // right, before the sign: a warded circle and a chevron pointing on
  ctx.save();
  ctx.translate(cx + sw * 3.3, floorY + h * 0.075);
  ctx.scale(1, 0.5);
  chalk(0.48);
  ctx.beginPath();
  ctx.arc(0, 0, sw * 0.55, 0.25, Math.PI * 2 - 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-sw * 0.4, -sw * 0.42);
  ctx.lineTo(sw * 0.44, sw * 0.4);
  ctx.stroke();
  chalk(0.4);
  ctx.beginPath();
  ctx.moveTo(sw * 0.85, -sw * 0.55);
  ctx.lineTo(sw * 1.25, -sw * 0.85);
  ctx.lineTo(sw * 1.25, -sw * 0.35);
  ctx.stroke();
  ctx.restore();
  ctx.lineCap = "butt";

  // 13. near flank pillars — fog stop 3, darkest cutouts framing the scene
  ctx.fillStyle = shade(C.void, 0.55);
  ctx.fillRect(0, 0, w * 0.105, h);
  ctx.fillRect(w * 0.895, 0, w * 0.105, h);
  for (const fpx of [w * 0.105, w * 0.895]) {
    const dir = fpx < w / 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(fpx, h * 0.24);
    ctx.lineTo(fpx + dir * w * 0.028, h * 0.26);
    ctx.lineTo(fpx + dir * w * 0.028, h * 0.29);
    ctx.lineTo(fpx, h * 0.31);
    ctx.closePath();
    ctx.fill();
  }

  // 14. top crush and the calm dark floor for the caption
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.16);
  crush.addColorStop(0, shade(C.void, 0.7, 0.8));
  crush.addColorStop(1, shade(C.void, 0.7, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.16);
  const settle = ctx.createLinearGradient(0, h * 0.72, 0, h);
  settle.addColorStop(0, shade(C.void, 0.75, 0));
  settle.addColorStop(1, shade(C.void, 0.75, 0.82));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  // 15. corner vignettes — close the folio
  const vr = Math.min(w, h) * 0.55;
  for (const [vx, vy] of [[0, 0], [w, 0], [0, h], [w, h]] as const) {
    const vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    vg.addColorStop(0, shade(C.void, 0.5, 0.45));
    vg.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}
