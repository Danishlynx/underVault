/**
 * Iso texture factory — "vault fidelity" pass. Everything is still
 * canvas-generated (invariant 4: no external assets) but painted like the
 * design bible demands: illuminated-manuscript-meets-the-deep-dark. Every
 * sprite is modelled with a candle-key light (warm, from the player's side),
 * a cool core shadow, a woodcut ink outline, and ambient occlusion where
 * things meet the ground. Wax glows from within (fake subsurface scatter);
 * stone is flagged and cracked; iron is hammered; nothing is glossy.
 *
 * All colors derive from design tokens via shade()/mix() — no foreign hues.
 * Cosmetic randomness uses a FIXED-seed LCG at texture-build time only
 * (identical textures every boot; the sim's fx quarantine is untouched).
 */

import type Phaser from "phaser";
import { COLOR_CSS } from "../../../design/tokens/tokens.js";
import { Tile, TILE_KIND_COUNT, EntityKind } from "../../shared/sim/types.js";
import { TILE_W, TILE_H, WALL_H } from "./iso.js";

const TILE_KINDS = TILE_KIND_COUNT; // 30 slots, index = TileId
export const FLOOR_VARIANTS = 3; // extra floor looks appended after the slots

// ── Token-derived color math ───────────────────────────────────────────────
// shade()/mix() outputs must be composable (shade(mix(...)) is common), so
// the parser accepts both "#rrggbb" tokens and its own "rgba(...)" output.
function parseColor(c: string): [number, number, number] {
  if (c.startsWith("#")) {
    const h = c.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = /rgba?\(([\d.]+),([\d.]+),([\d.]+)/.exec(c.replace(/\s/g, ""));
  if (m !== null) return [Number(m[1]), Number(m[2]), Number(m[3])];
  throw new Error(`unparseable color: ${c}`);
}
function rgbToCss(r: number, g: number, b: number, a = 1): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}
/** Lighten (f>1) / darken (f<1) a token-derived color. */
export function shade(color: string, f: number, a = 1): string {
  const [r, g, b] = parseColor(color);
  return rgbToCss(Math.min(255, r * f), Math.min(255, g * f), Math.min(255, b * f), a);
}
/** Blend token-derived color a → b by t. */
export function mix(colorA: string, colorB: string, t: number, alpha = 1): string {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  return rgbToCss(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, alpha);
}

// Fixed-seed LCG for cosmetic speckle (stable across boots)
let lcg = 0x1234567;
function crand(): number {
  lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0;
  return lcg / 0xffffffff;
}

// ── Supersampled authoring ─────────────────────────────────────────────────
// Canvas antialiasing at 1× muddies the fine work (0.6–1.2 px strokes,
// mineral speckle, glyph serifs). Every texture is therefore drawn onto a 4×
// offscreen master and filtered down into the contract-size canvas — same
// keys, same geometry, maximum per-pixel sharpness the format allows.
const SS = 4;
let ssMaster: HTMLCanvasElement | null = null;
function hiBegin(t: Phaser.Textures.CanvasTexture): CanvasRenderingContext2D {
  ssMaster = document.createElement("canvas");
  ssMaster.width = t.width * SS;
  ssMaster.height = t.height * SS;
  const ctx = ssMaster.getContext("2d");
  if (ctx === null) throw new Error("no 2d context for supersampled master");
  ctx.scale(SS, SS);
  return ctx;
}
/** Billboards RETAIN their 4× master (render at TEX_SCALE — D56's crispness
 *  upgrade); pass keepHiRes=false to downsample to contract size (the ground
 *  strip must stay 64×32 cells for the iso TilemapLayer; soft utility
 *  sprites gain nothing from resolution). */
export const TEX_SCALE = 1 / SS;
function hiEnd(t: Phaser.Textures.CanvasTexture, keepHiRes = true): void {
  if (ssMaster !== null && keepHiRes) {
    t.setSize(ssMaster.width, ssMaster.height);
    const ctx = t.getContext();
    ctx.clearRect(0, 0, t.width, t.height);
    ctx.drawImage(ssMaster, 0, 0);
    ssMaster = null;
    t.refresh();
    return;
  }
  const ctx = t.getContext();
  if (ssMaster !== null) {
    ctx.clearRect(0, 0, t.width, t.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(ssMaster, 0, 0, ssMaster.width, ssMaster.height, 0, 0, t.width, t.height);
    ssMaster = null;
  }
  t.refresh();
}

function diamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

// ── Shared modelling helpers ───────────────────────────────────────────────

/**
 * Volumetric billboard shading. Fills a silhouette with a candle-key radial
 * (highlight upper-third, cool falloff), then clips it and adds a warm rim
 * down the EAST edge (creatures face right; the candle is the world's only
 * sun), a grounding shadow across the base, and a woodcut ink outline.
 */
function moldBody(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  hi: string,
  lo: string,
  rim: string,
  ink: string,
): void {
  const g = ctx.createRadialGradient(x + w * 0.4, y + h * 0.28, w * 0.05, x + w * 0.5, y + h * 0.6, w * 0.85);
  g.addColorStop(0, hi);
  g.addColorStop(0.55, base);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const rg = ctx.createLinearGradient(x + w * 0.55, 0, x + w, 0);
  rg.addColorStop(0, shade(rim, 1, 0));
  rg.addColorStop(1, shade(rim, 1.05, 0.45));
  ctx.fillStyle = rg;
  ctx.fillRect(x, y, w, h);
  const ag = ctx.createLinearGradient(0, y + h * 0.68, 0, y + h);
  ag.addColorStop(0, shade(lo, 1, 0));
  ag.addColorStop(1, shade(lo, 0.55, 0.55));
  ctx.fillStyle = ag;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.1;
  ctx.stroke(path);
}

/** Layered candle flame with halo — the game's leitmotif, drawn everywhere. */
function flameAt(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  s: number,
  emberC: string,
  flameC: string,
  hiC: string,
): void {
  const halo = ctx.createRadialGradient(fx, fy - s * 0.6, 0, fx, fy - s * 0.6, s * 3.2);
  halo.addColorStop(0, shade(flameC, 1, 0.5));
  halo.addColorStop(0.55, shade(flameC, 1, 0.16));
  halo.addColorStop(1, shade(flameC, 1, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(fx - s * 3.2, fy - s * 0.6 - s * 3.2, s * 6.4, s * 6.4);
  const tongue = (w: number, h: number, color: string, a: number): void => {
    ctx.fillStyle = color;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(fx, fy - h);
    ctx.bezierCurveTo(fx + w, fy - h * 0.42, fx + w * 0.66, fy, fx, fy);
    ctx.bezierCurveTo(fx - w * 0.66, fy, fx - w, fy - h * 0.42, fx, fy - h);
    ctx.fill();
  };
  tongue(s * 0.95, s * 2.1, emberC, 0.9);
  tongue(s * 0.7, s * 1.6, flameC, 0.95);
  tongue(s * 0.4, s * 1.0, hiC, 1);
  ctx.globalAlpha = 1;
}

/** Soft elliptical contact shadow — grounds standing props. */
function contactShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a: number): void {
  const g = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Flagged-stone diamond: base light ramp, mortar seams with bevels, tonal
 * blotches, mineral speckle, pebbles, occasional multi-branch crack, then a
 * NW light bevel and SE fall-off with soft interior AO. Reads as worn slabs
 * a thousand delvers have crossed.
 */
function stoneDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  base: string,
  speckleLight: string,
  speckleDark: string,
): void {
  const g = ctx.createLinearGradient(cx - TILE_W / 2, cy - TILE_H / 2, cx + TILE_W / 2, cy + TILE_H / 2);
  g.addColorStop(0, shade(base, 1.34));
  g.addColorStop(0.48, base);
  g.addColorStop(1, shade(base, 0.72));
  diamondPath(ctx, cx, cy, TILE_W - 2, TILE_H - 1);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.save();
  diamondPath(ctx, cx, cy, TILE_W - 4, TILE_H - 3);
  ctx.clip();

  // tonal blotches — big, quiet variation so no two slabs read identical
  for (let i = 0; i < 3; i++) {
    const bx = cx - 20 + crand() * 40;
    const by = cy - 8 + crand() * 16;
    ctx.fillStyle = crand() < 0.5 ? mix(base, speckleLight, 0.35) : mix(base, speckleDark, 0.4);
    ctx.globalAlpha = 0.08 + crand() * 0.08;
    ctx.beginPath();
    ctx.ellipse(bx, by, 8 + crand() * 10, 4 + crand() * 4, crand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // CLEAN PASS (⚖ D60, operator direction "clean like Silksong"): the
  // mortar seams, 34-dot mineral speckle, pebbles and forked cracks read as
  // rubble at game scale. Surfaces stay smooth; big quiet blotches + bevels
  // + AO carry all the variation. A whisper of speckle remains for tooth.
  for (let i = 0; i < 6; i++) {
    const px = cx - TILE_W / 2 + crand() * TILE_W;
    const py = cy - TILE_H / 2 + crand() * TILE_H;
    ctx.fillStyle = crand() < 0.5 ? speckleLight : speckleDark;
    ctx.globalAlpha = 0.05 + crand() * 0.05;
    ctx.fillRect(px, py, 1.2, 1);
  }
  ctx.globalAlpha = 1;

  // interior AO hugging the SE edges
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = shade(speckleDark, 0.8);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx + (TILE_W - 6) / 2, cy);
  ctx.lineTo(cx, cy + (TILE_H - 4) / 2);
  ctx.lineTo(cx - (TILE_W - 6) / 2, cy);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;

  // bevel: NW edges catch light, SE edges fall dark
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = shade(base, 1.6, 0.85);
  ctx.beginPath();
  ctx.moveTo(cx - (TILE_W - 2) / 2, cy);
  ctx.lineTo(cx, cy - (TILE_H - 1) / 2);
  ctx.lineTo(cx + (TILE_W - 2) / 2, cy);
  ctx.stroke();
  ctx.strokeStyle = shade(base, 0.4, 0.9);
  ctx.beginPath();
  ctx.moveTo(cx + (TILE_W - 2) / 2, cy);
  ctx.lineTo(cx, cy + (TILE_H - 1) / 2);
  ctx.lineTo(cx - (TILE_W - 2) / 2, cy);
  ctx.stroke();
}

export function makeIsoTextures(scene: Phaser.Scene): void {
  const T = scene.textures;
  if (T.exists("iso-ground")) return;
  const C = COLOR_CSS;
  const INK = shade(C.void, 0.7, 0.9); // the woodcut line

  // ── Ground strip: tile kinds + floor variants, 64×32 each ───────────────
  const stripW = TILE_W * (TILE_KINDS + FLOOR_VARIANTS - 1);
  const strip = T.createCanvas("iso-ground", stripW, TILE_H);
  if (strip !== null) {
    const ctx = hiBegin(strip);
    const drawAt = (index: number, draw: (cx: number, cy: number) => void): void => {
      draw(index * TILE_W + TILE_W / 2, TILE_H / 2);
    };
    const floorBase = mix(C.surface, C.surface2, 0.4);

    for (let t = 0; t < TILE_KINDS; t++) {
      if (t === Tile.VOID) continue;
      drawAt(t, (cx, cy) => {
        if (t === Tile.WALL) {
          diamondPath(ctx, cx, cy, TILE_W - 2, TILE_H - 1);
          ctx.fillStyle = C.void;
          ctx.fill();
          return;
        }
        stoneDiamond(ctx, cx, cy, floorBase, C.bone, C.void);
        switch (t) {
          case Tile.MOSS: {
            // quiet floor: cushioned moss patches, each with a shadowed rim
            ctx.save();
            diamondPath(ctx, cx, cy, TILE_W - 8, TILE_H - 5);
            ctx.clip();
            for (let i = 0; i < 14; i++) {
              const px = cx - 24 + crand() * 48;
              const py = cy - 10 + crand() * 20;
              const rx = 2.5 + crand() * 4.5;
              const ry = 1.2 + crand() * 2.2;
              ctx.globalAlpha = 0.3 + crand() * 0.35;
              ctx.fillStyle = shade(C.verdigrisDim, 0.55);
              ctx.beginPath();
              ctx.ellipse(px + 0.7, py + 0.7, rx, ry, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = mix(C.verdigrisDim, C.verdigris, crand() * 0.55);
              ctx.beginPath();
              ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = mix(C.verdigris, C.bone, 0.3, 0.5);
              ctx.beginPath();
              ctx.ellipse(px - rx * 0.3, py - ry * 0.35, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            // tiny fronds
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = mix(C.verdigris, C.bone, 0.2);
            ctx.lineWidth = 0.7;
            for (let i = 0; i < 5; i++) {
              const px = cx - 18 + crand() * 36;
              const py = cy - 6 + crand() * 12;
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.quadraticCurveTo(px + 1, py - 2.5, px + 2.2, py - 3.5);
              ctx.stroke();
            }
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
          }
          case Tile.WEBBING: {
            // flammable floor: an old orb-web sagging across the slab
            ctx.save();
            diamondPath(ctx, cx, cy, TILE_W - 6, TILE_H - 4);
            ctx.clip();
            const wcol = shade(C.boneDim, 1.3, 0.6);
            ctx.strokeStyle = wcol;
            ctx.lineWidth = 0.8;
            // radial spokes
            for (let sp = 0; sp < 7; sp++) {
              const a = (sp / 7) * Math.PI * 2 + 0.2;
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 13);
              ctx.stroke();
            }
            // sagging concentric threads
            for (let ring = 1; ring <= 4; ring++) {
              const rr = ring / 4;
              ctx.globalAlpha = 0.75 - ring * 0.1;
              ctx.beginPath();
              for (let sp = 0; sp <= 7; sp++) {
                const a0 = ((sp - 1) / 7) * Math.PI * 2 + 0.2;
                const a1 = (sp / 7) * Math.PI * 2 + 0.2;
                const x1 = cx + Math.cos(a1) * 26 * rr;
                const y1 = cy + Math.sin(a1) * 13 * rr;
                if (sp === 0) ctx.moveTo(x1, y1);
                else {
                  const mx = cx + Math.cos((a0 + a1) / 2) * 26 * rr * 0.82;
                  const my = cy + Math.sin((a0 + a1) / 2) * 13 * rr * 0.82 + 1.2;
                  ctx.quadraticCurveTo(mx, my, x1, y1);
                }
              }
              ctx.stroke();
            }
            // silk clumps + husks
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = shade(C.bone, 1.05, 0.7);
            for (let i = 0; i < 4; i++) {
              ctx.beginPath();
              ctx.ellipse(cx - 16 + crand() * 32, cy - 6 + crand() * 12, 1.6 + crand(), 1, crand(), 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
          }
          case Tile.ENTRY: {
            // gold-inlaid threshold, softly lit from within
            ctx.fillStyle = shade(C.goldInk, 1.1, 0.14);
            diamondPath(ctx, cx, cy, TILE_W - 12, TILE_H - 7);
            ctx.fill();
            diamondPath(ctx, cx, cy, TILE_W - 12, TILE_H - 7);
            ctx.strokeStyle = C.goldInk;
            ctx.lineWidth = 2;
            ctx.stroke();
            diamondPath(ctx, cx, cy, TILE_W - 26, TILE_H - 14);
            ctx.strokeStyle = shade(C.goldInk, 1.35, 0.75);
            ctx.lineWidth = 1;
            ctx.stroke();
            // corner sigil ticks
            ctx.strokeStyle = shade(C.goldInk, 1.5, 0.9);
            ctx.lineWidth = 1.2;
            for (const [dx, dy] of [[0, -9], [22, 0], [0, 9], [-22, 0]] as const) {
              ctx.beginPath();
              ctx.moveTo(cx + dx - 2, cy + dy);
              ctx.lineTo(cx + dx + 2, cy + dy);
              ctx.stroke();
            }
            const gg = ctx.createRadialGradient(cx, cy, 1, cx, cy, 16);
            gg.addColorStop(0, shade(C.goldInk, 1.4, 0.22));
            gg.addColorStop(1, shade(C.goldInk, 1, 0));
            ctx.fillStyle = gg;
            ctx.fillRect(cx - 16, cy - 16, 32, 32);
            break;
          }
          case Tile.STAIRS_DOWN: {
            // descending steps into darkness with a warm breath from below
            const hole = ctx.createLinearGradient(cx, cy - 10, cx, cy + 10);
            hole.addColorStop(0, shade(C.void, 1.7));
            hole.addColorStop(1, shade(C.void, 0.6));
            diamondPath(ctx, cx, cy, TILE_W - 14, TILE_H - 8);
            ctx.fillStyle = hole;
            ctx.fill();
            // three treads: lit lip, dark riser
            for (let s = 0; s < 3; s++) {
              const w = TILE_W - 22 - s * 12;
              const h = TILE_H - 12 - s * 6;
              const sx = cx + s * 3;
              const sy = cy + s * 2;
              diamondPath(ctx, sx, sy, w, h);
              ctx.strokeStyle = shade(floorBase, 1.5 - s * 0.25, 0.9);
              ctx.lineWidth = 1.3;
              ctx.stroke();
              diamondPath(ctx, sx + 0.8, sy + 1, w, h);
              ctx.strokeStyle = shade(C.void, 0.8, 0.8);
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            // warm breath rising from the depth
            const breath = ctx.createRadialGradient(cx + 6, cy + 4, 0, cx + 6, cy + 4, 13);
            breath.addColorStop(0, shade(C.ember, 1.1, 0.4));
            breath.addColorStop(0.6, shade(C.ember, 1, 0.14));
            breath.addColorStop(1, shade(C.ember, 1, 0));
            ctx.fillStyle = breath;
            ctx.fillRect(cx - 7, cy - 9, 26, 26);
            break;
          }
          case Tile.WATER: {
            // still black-green water sunk below a stone lip
            diamondPath(ctx, cx, cy, TILE_W - 4, TILE_H - 2);
            const wg = ctx.createLinearGradient(cx - 24, cy - 10, cx + 24, cy + 10);
            wg.addColorStop(0, mix(C.void, C.verdigrisDim, 0.5));
            wg.addColorStop(0.5, mix(C.void, C.verdigrisDim, 0.22));
            wg.addColorStop(1, mix(C.void, C.verdigrisDim, 0.38));
            ctx.fillStyle = wg;
            ctx.fill();
            ctx.save();
            diamondPath(ctx, cx, cy, TILE_W - 4, TILE_H - 2);
            ctx.clip();
            // depth pool at center
            const deep = ctx.createRadialGradient(cx, cy + 1, 1, cx, cy + 1, 18);
            deep.addColorStop(0, shade(C.void, 0.6, 0.85));
            deep.addColorStop(1, shade(C.void, 1, 0));
            ctx.fillStyle = deep;
            ctx.fillRect(cx - 20, cy - 12, 40, 24);
            // ripple threads
            ctx.strokeStyle = mix(C.verdigris, C.bone, 0.3, 0.45);
            ctx.lineWidth = 0.9;
            for (let r = 0; r < 3; r++) {
              const yy = cy - 5 + r * 5;
              ctx.beginPath();
              ctx.moveTo(cx - 16 + r * 4, yy);
              ctx.bezierCurveTo(cx - 6, yy - 2, cx + 6, yy + 2, cx + 16 - r * 4, yy);
              ctx.stroke();
            }
            // a wobbling reflected flame — somebody's candle, somewhere
            ctx.strokeStyle = shade(C.flame, 1, 0.3);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(cx + 8, cy - 5);
            ctx.bezierCurveTo(cx + 6.5, cy - 2, cx + 9.5, cy + 1, cx + 8, cy + 5);
            ctx.stroke();
            ctx.restore();
            // submerged stone lip on the lit side
            ctx.strokeStyle = shade(floorBase, 1.5, 0.6);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx - (TILE_W - 8) / 2, cy);
            ctx.lineTo(cx, cy - (TILE_H - 5) / 2);
            ctx.lineTo(cx + (TILE_W - 8) / 2, cy);
            ctx.stroke();
            break;
          }
          case Tile.GLOWMOSS: {
            // bioluminescent colonies: halo, cluster, bright cores, stems
            ctx.save();
            diamondPath(ctx, cx, cy, TILE_W - 6, TILE_H - 4);
            ctx.clip();
            const tint = ctx.createRadialGradient(cx, cy, 2, cx, cy, 24);
            tint.addColorStop(0, shade(C.verdigrisDim, 1, 0.22));
            tint.addColorStop(1, shade(C.verdigrisDim, 1, 0));
            ctx.fillStyle = tint;
            ctx.fillRect(cx - 26, cy - 13, 52, 26);
            for (let g2 = 0; g2 < 7; g2++) {
              const gx = cx - 16 + crand() * 32;
              const gy = cy - 7 + crand() * 14;
              const rr = 1.4 + crand() * 2.4;
              const rad = ctx.createRadialGradient(gx, gy, 0, gx, gy, rr * 3.4);
              rad.addColorStop(0, shade(C.verdigris, 1.4, 0.95));
              rad.addColorStop(0.4, shade(C.verdigris, 1.1, 0.4));
              rad.addColorStop(1, shade(C.verdigris, 1, 0));
              ctx.fillStyle = rad;
              ctx.fillRect(gx - rr * 3.4, gy - rr * 3.4, rr * 6.8, rr * 6.8);
              ctx.fillStyle = mix(C.verdigris, C.parchment, 0.45);
              ctx.beginPath();
              ctx.arc(gx, gy, rr * 0.55, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
            break;
          }
          case Tile.PLATE: {
            // echo-plate: a machined disc set flush, hairline gold ring
            diamondPath(ctx, cx, cy, TILE_W - 22, TILE_H - 12);
            const pg = ctx.createLinearGradient(cx - 14, cy - 7, cx + 14, cy + 7);
            pg.addColorStop(0, shade(C.surface2, 1.45));
            pg.addColorStop(1, shade(C.surface2, 0.85));
            ctx.fillStyle = pg;
            ctx.fill();
            diamondPath(ctx, cx, cy, TILE_W - 22, TILE_H - 12);
            ctx.strokeStyle = shade(C.boneDim, 1.15);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            diamondPath(ctx, cx + 1, cy + 1.2, TILE_W - 24, TILE_H - 13);
            ctx.strokeStyle = shade(C.void, 0.9, 0.8);
            ctx.lineWidth = 1;
            ctx.stroke();
            // concentric resonance ring
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1, 0.5);
            ctx.strokeStyle = shade(C.goldInk, 1, 0.55);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case Tile.KEY_DROP: {
            // an iron key dropped on the slab, gold catching the flame
            contactShadow(ctx, cx + 1, cy + 2, 10, 4, 0.3);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-0.35);
            const kg = ctx.createLinearGradient(-9, -2, 11, 2);
            kg.addColorStop(0, shade(C.goldInk, 1.35));
            kg.addColorStop(1, shade(C.goldInk, 0.75));
            ctx.strokeStyle = kg;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(-6, 0, 3.4, 0, Math.PI * 2);
            ctx.moveTo(-2.5, 0);
            ctx.lineTo(9, 0);
            ctx.moveTo(5, 0);
            ctx.lineTo(5, 3.5);
            ctx.moveTo(9, 0);
            ctx.lineTo(9, 3.5);
            ctx.stroke();
            // glint
            ctx.fillStyle = shade(C.flameHi, 1.05, 0.95);
            ctx.fillRect(-7.4, -3.6, 1.6, 1.2);
            ctx.restore();
            break;
          }
          default:
            break;
        }
      });
    }
    // floor variants: same recipe, fresh speckle/seam/crack rolls
    for (let v = 0; v < FLOOR_VARIANTS - 1; v++) {
      drawAt(TILE_KINDS + v, (cx, cy) => stoneDiamond(ctx, cx, cy, floorBase, C.bone, C.void));
    }
    hiEnd(strip, false);
  }

  // ── Wall billboard: per-brick coursed masonry + lit lid ──────────────────
  const wall = T.createCanvas("iso-wall", TILE_W, WALL_H);
  if (wall !== null) {
    const ctx = hiBegin(wall);
    const lidCy = TILE_H / 2;
    const faceH = WALL_H - TILE_H;
    const faceBase = mix(C.surface2, C.void, 0.25);

    const face = (leftSide: boolean): void => {
      const x0 = leftSide ? 0 : TILE_W;
      const x1 = TILE_W / 2;
      const yAt = (u: number): number => lidCy + u * (TILE_H / 2); // top edge along slope
      const xAt = (u: number): number => x0 + (x1 - x0) * u;
      const tone = leftSide ? 0.52 : 1.0; // W face in shadow, S face candle-lit

      // base wash
      const g = ctx.createLinearGradient(0, lidCy, 0, WALL_H);
      g.addColorStop(0, shade(faceBase, 1.3 * tone));
      g.addColorStop(1, shade(faceBase, 0.45 * tone));
      ctx.beginPath();
      ctx.moveTo(x0, yAt(0));
      ctx.lineTo(x1, yAt(1));
      ctx.lineTo(x1, yAt(1) + faceH);
      ctx.lineTo(x0, yAt(0) + faceH);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();

      ctx.save();
      ctx.clip();

      // per-brick masonry following the face slope
      const courses = 5;
      const ch = faceH / courses;
      for (let c = 0; c < courses; c++) {
        const y0 = c * ch;
        const y1 = y0 + ch;
        const cuts = c % 2 === 0 ? [0, 0.5, 1] : [0, 0.28, 0.72, 1];
        for (let b = 0; b < cuts.length - 1; b++) {
          const u0 = cuts[b] ?? 0;
          const u1 = cuts[b + 1] ?? 1;
          const depthFade = 1 - c * 0.055; // lower courses sink into gloom
          const jitter = 0.97 + crand() * 0.06; // clean pass: near-uniform bricks
          ctx.fillStyle = shade(faceBase, tone * depthFade * jitter);
          ctx.beginPath();
          ctx.moveTo(xAt(u0) + 0.5, yAt(u0) + y0 + 0.5);
          ctx.lineTo(xAt(u1) - 0.5, yAt(u1) + y0 + 0.5);
          ctx.lineTo(xAt(u1) - 0.5, yAt(u1) + y1 - 0.5);
          ctx.lineTo(xAt(u0) + 0.5, yAt(u0) + y1 - 0.5);
          ctx.closePath();
          ctx.fill();
          // top lip of each brick catches light
          ctx.strokeStyle = shade(faceBase, 1.55 * tone, 0.5);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(xAt(u0) + 1, yAt(u0) + y0 + 1);
          ctx.lineTo(xAt(u1) - 1, yAt(u1) + y0 + 1);
          ctx.stroke();
          // chips removed — clean pass (D60)
        }
        // mortar line under the course
        ctx.strokeStyle = shade(C.void, 1.3, 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, yAt(0) + y1);
        ctx.lineTo(x1, yAt(1) + y1);
        ctx.stroke();
      }

      // clean pass (D60): drip stains removed; one quiet moss tuft at most
      ctx.globalAlpha = 1;
      if (crand() < 0.3) {
        const u = 0.2 + crand() * 0.6;
        ctx.fillStyle = mix(C.verdigrisDim, C.verdigris, 0.3, 0.3);
        ctx.beginPath();
        ctx.ellipse(xAt(u), yAt(u) + faceH - 4, 3, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // base sinks into darkness
      const ao = ctx.createLinearGradient(0, WALL_H - 16, 0, WALL_H);
      ao.addColorStop(0, shade(C.void, 1, 0));
      ao.addColorStop(1, shade(C.void, 0.8, 0.6));
      ctx.fillStyle = ao;
      ctx.fillRect(0, WALL_H - 16, TILE_W, 16);
      ctx.restore();
    };
    face(true);
    face(false);

    // lid: stone diamond catching the most light
    const lidBase = mix(C.surface2, C.bone, 0.14);
    stoneDiamond(ctx, TILE_W / 2, lidCy, lidBase, C.bone, C.void);

    // crisp silhouette edges — the woodcut line
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0.5, lidCy);
    ctx.lineTo(0.5, lidCy + faceH);
    ctx.moveTo(TILE_W - 0.5, lidCy);
    ctx.lineTo(TILE_W - 0.5, lidCy + faceH);
    ctx.moveTo(TILE_W / 2, lidCy + TILE_H / 2);
    ctx.lineTo(TILE_W / 2, WALL_H);
    ctx.stroke();
    hiEnd(wall);
  }

  // ── Doors: timber + iron in a dressed-stone arch ─────────────────────────
  const doorTex = (key: string, panel: boolean, stuck: boolean): void => {
    const c = T.createCanvas(key, TILE_W, WALL_H);
    if (c === null) return;
    const ctx = hiBegin(c);
    const baseY = WALL_H - TILE_H / 2;

    // dressed stone posts, block joints, keystone lintel
    const post = (x: number): void => {
      const g = ctx.createLinearGradient(x, 0, x + 9, 0);
      g.addColorStop(0, shade(C.surface2, 1.4));
      g.addColorStop(1, shade(C.surface2, 0.55));
      ctx.fillStyle = g;
      ctx.fillRect(x, baseY - 58, 9, 58);
      ctx.strokeStyle = shade(C.void, 1.2, 0.6);
      ctx.lineWidth = 1;
      for (let j = 1; j < 4; j++) {
        ctx.beginPath();
        ctx.moveTo(x, baseY - 58 + j * 15);
        ctx.lineTo(x + 9, baseY - 58 + j * 15);
        ctx.stroke();
      }
      ctx.strokeStyle = shade(C.surface2, 1.7, 0.6);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, baseY - 58);
      ctx.lineTo(x + 0.5, baseY);
      ctx.stroke();
    };
    post(7);
    post(TILE_W - 16);
    const lg = ctx.createLinearGradient(0, baseY - 64, 0, baseY - 56);
    lg.addColorStop(0, shade(C.surface2, 1.35));
    lg.addColorStop(1, shade(C.surface2, 0.8));
    ctx.fillStyle = lg;
    ctx.fillRect(7, baseY - 63, TILE_W - 14, 7);
    // keystone
    ctx.fillStyle = shade(C.surface2, 1.55);
    ctx.beginPath();
    ctx.moveTo(TILE_W / 2 - 4, baseY - 63);
    ctx.lineTo(TILE_W / 2 + 4, baseY - 63);
    ctx.lineTo(TILE_W / 2 + 2.5, baseY - 56);
    ctx.lineTo(TILE_W / 2 - 2.5, baseY - 56);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 1.2, 0.6);
    ctx.stroke();

    if (panel) {
      // timber: vertical planks, curved grain, candle sheen mid-right
      const g = ctx.createLinearGradient(0, baseY - 54, 0, baseY);
      g.addColorStop(0, shade(C.parchmentAged, 0.92));
      g.addColorStop(1, shade(C.parchmentAged, 0.5));
      ctx.fillStyle = g;
      ctx.fillRect(16, baseY - 54, TILE_W - 32, 54);
      const sheen = ctx.createRadialGradient(TILE_W / 2 + 6, baseY - 26, 2, TILE_W / 2 + 6, baseY - 26, 22);
      sheen.addColorStop(0, shade(C.flame, 1, 0.13));
      sheen.addColorStop(1, shade(C.flame, 1, 0));
      ctx.fillStyle = sheen;
      ctx.fillRect(16, baseY - 54, TILE_W - 32, 54);
      // plank seams + curved grain + a knot
      ctx.strokeStyle = shade(C.ink, 1.15, 0.55);
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const x = 16 + i * ((TILE_W - 32) / 4);
        ctx.beginPath();
        ctx.moveTo(x, baseY - 54);
        ctx.lineTo(x, baseY);
        ctx.stroke();
      }
      ctx.strokeStyle = shade(C.ink, 1.5, 0.3);
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        const x = 20 + i * 8;
        ctx.beginPath();
        ctx.moveTo(x, baseY - 52);
        ctx.bezierCurveTo(x + 1.5, baseY - 38, x - 1.5, baseY - 18, x + 0.5, baseY - 2);
        ctx.stroke();
      }
      ctx.strokeStyle = shade(C.ink, 1.3, 0.5);
      ctx.beginPath();
      ctx.ellipse(24, baseY - 33, 2.2, 3.2, 0.2, 0, Math.PI * 2);
      ctx.stroke();
      // iron bands, studded, with worn highlights
      const band = (y: number): void => {
        const bg = ctx.createLinearGradient(0, y, 0, y + 4);
        bg.addColorStop(0, shade(C.inkSoft, 1.15));
        bg.addColorStop(1, shade(C.void, 1.5));
        ctx.fillStyle = bg;
        ctx.fillRect(16, y, TILE_W - 32, 4);
        ctx.fillStyle = shade(C.bone, 1.15, 0.85);
        for (let s2 = 0; s2 < 4; s2++) ctx.fillRect(20 + s2 * 8, y + 1, 1.4, 1.4);
      };
      band(baseY - 45);
      band(baseY - 17);
      // ring handle, shadowed
      ctx.strokeStyle = shade(C.void, 2.2);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(TILE_W - 23, baseY - 27, 3, 0.3, Math.PI * 2 + 0.3);
      ctx.stroke();
      ctx.strokeStyle = shade(C.bone, 0.9, 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(TILE_W - 23, baseY - 27.6, 3, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      // threshold shadow
      const th = ctx.createLinearGradient(0, baseY - 8, 0, baseY);
      th.addColorStop(0, shade(C.void, 1, 0));
      th.addColorStop(1, shade(C.void, 0.7, 0.5));
      ctx.fillStyle = th;
      ctx.fillRect(16, baseY - 8, TILE_W - 32, 8);
      if (stuck) {
        // sealed shut: a wax-red bar and a dripping seal boss
        ctx.strokeStyle = shade(C.seal, 0.9);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(18, baseY - 50);
        ctx.lineTo(TILE_W - 18, baseY - 6);
        ctx.stroke();
        ctx.strokeStyle = shade(C.seal, 1.35, 0.8);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(18, baseY - 51.4);
        ctx.lineTo(TILE_W - 18, baseY - 7.4);
        ctx.stroke();
        const sg = ctx.createRadialGradient(TILE_W / 2 - 2, baseY - 30, 1, TILE_W / 2, baseY - 28, 7);
        sg.addColorStop(0, shade(C.seal, 1.45));
        sg.addColorStop(1, shade(C.seal, 0.65));
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(TILE_W / 2, baseY - 28, 6.4, 0, Math.PI * 2);
        ctx.fill();
        // seal drips
        for (const [dx, len] of [[-3, 5], [2, 8]] as const) {
          ctx.beginPath();
          ctx.ellipse(TILE_W / 2 + dx, baseY - 22 + len / 2, 1.3, len / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // stamped ring
        ctx.strokeStyle = shade(C.seal, 0.55);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(TILE_W / 2, baseY - 28, 3.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // open: darkness beyond, a faint light spill on the threshold
      const dark = ctx.createLinearGradient(0, baseY - 56, 0, baseY);
      dark.addColorStop(0, shade(C.void, 0.5));
      dark.addColorStop(0.8, shade(C.void, 1.1));
      dark.addColorStop(1, shade(C.void, 1.6));
      ctx.fillStyle = dark;
      ctx.fillRect(16, baseY - 56, TILE_W - 32, 56);
      const spill = ctx.createRadialGradient(TILE_W / 2, baseY, 1, TILE_W / 2, baseY, 14);
      spill.addColorStop(0, shade(C.flame, 1, 0.14));
      spill.addColorStop(1, shade(C.flame, 1, 0));
      ctx.fillStyle = spill;
      ctx.fillRect(16, baseY - 14, TILE_W - 32, 14);
    }
    hiEnd(c);
  };
  doorTex("iso-door-closed", true, false);
  doorTex("iso-door-stuck", true, true);
  doorTex("iso-door-open", false, false);

  // ── Braziers: hammered iron bowl, coals, layered flame ───────────────────
  const brazier = (key: string, lit: boolean): void => {
    const c = T.createCanvas(key, 44, 64);
    if (c === null) return;
    const ctx = hiBegin(c);
    contactShadow(ctx, 22, 59, 13, 4, 0.35);
    // tripod legs with foot flares
    ctx.strokeStyle = shade(C.void, 2.2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, 36);
    ctx.lineTo(12, 58);
    ctx.moveTo(22, 36);
    ctx.lineTo(32, 58);
    ctx.moveTo(22, 36);
    ctx.lineTo(22, 57);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 59);
    ctx.lineTo(14, 59);
    ctx.moveTo(30, 59);
    ctx.lineTo(34, 59);
    ctx.moveTo(20, 58);
    ctx.lineTo(24, 58);
    ctx.stroke();
    // bowl: hammered iron with fire-warmed rim when lit
    const bowlG = ctx.createLinearGradient(0, 24, 0, 40);
    bowlG.addColorStop(0, shade(C.inkSoft, lit ? 1.6 : 1.35));
    bowlG.addColorStop(1, shade(C.void, 1.5));
    ctx.fillStyle = bowlG;
    ctx.beginPath();
    ctx.ellipse(22, 32, 16, 8, 0, 0, Math.PI);
    ctx.fill();
    // hammer-marks
    ctx.strokeStyle = shade(C.inkSoft, lit ? 2.0 : 1.7, 0.35);
    ctx.lineWidth = 0.8;
    for (let hm = 0; hm < 5; hm++) {
      ctx.beginPath();
      ctx.arc(12 + hm * 5, 34 + (hm % 2), 1.6, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
    // interior: coals or cold ash
    ctx.beginPath();
    ctx.ellipse(22, 32, 16, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = lit ? shade(C.ember, 0.7) : shade(C.void, 1.9);
    ctx.fill();
    // rim highlight
    ctx.strokeStyle = lit ? shade(C.flame, 1.1, 0.8) : shade(C.boneDim, 0.9, 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(22, 32, 16, 5, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    if (lit) {
      // glowing coals
      for (const [cx2, cy2, r2] of [[16, 31, 2.2], [22, 30, 2.6], [28, 31.5, 2]] as const) {
        ctx.fillStyle = shade(C.ember, 1.15);
        ctx.beginPath();
        ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(C.flameHi, 1, 0.9);
        ctx.beginPath();
        ctx.arc(cx2 + 0.4, cy2 - 0.5, r2 * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      flameAt(ctx, 22, 30, 11, C.ember, C.flame, C.flameHi);
      // stray sparks
      ctx.fillStyle = shade(C.flameHi, 1, 0.9);
      ctx.fillRect(15, 12, 1.2, 1.2);
      ctx.fillRect(29, 8, 1, 1);
      ctx.fillRect(24, 4, 0.9, 0.9);
    } else {
      // ash dusting on dead coals
      ctx.fillStyle = shade(C.boneDim, 0.9, 0.5);
      for (let a2 = 0; a2 < 6; a2++) {
        ctx.fillRect(13 + crand() * 18, 29.5 + crand() * 4, 1.4, 0.9);
      }
    }
    hiEnd(c);
  };
  brazier("iso-brazier", false);
  brazier("iso-brazier-lit", true);

  // ── Waystone: strata-carved monolith, rune breathing verdigris ───────────
  const waystone = T.createCanvas("iso-waystone", 40, 68);
  if (waystone !== null) {
    const ctx = hiBegin(waystone);
    contactShadow(ctx, 20, 62, 15, 4.5, 0.4);
    const g = ctx.createLinearGradient(6, 0, 34, 0);
    g.addColorStop(0, shade(C.verdigrisDim, 0.72));
    g.addColorStop(0.42, mix(C.verdigrisDim, C.verdigris, 0.55));
    g.addColorStop(1, shade(C.verdigrisDim, 0.5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(20, 2);
    ctx.lineTo(31, 16);
    ctx.lineTo(28, 60);
    ctx.lineTo(12, 60);
    ctx.lineTo(9, 16);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    // stone strata
    ctx.strokeStyle = shade(C.verdigrisDim, 0.55, 0.4);
    ctx.lineWidth = 0.8;
    for (let s = 0; s < 5; s++) {
      const y = 12 + s * 10 + crand() * 4;
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.quadraticCurveTo(20, y + (crand() - 0.5) * 3, 32, y);
      ctx.stroke();
    }
    // chipped edges
    ctx.fillStyle = shade(C.verdigrisDim, 0.4, 0.7);
    ctx.beginPath();
    ctx.moveTo(30, 22);
    ctx.lineTo(27.5, 24);
    ctx.lineTo(30, 26);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, 40);
    ctx.lineTo(12.5, 42);
    ctx.lineTo(10.5, 44);
    ctx.fill();
    // moss at the foot
    for (let m2 = 0; m2 < 3; m2++) {
      ctx.fillStyle = mix(C.verdigrisDim, C.verdigris, crand() * 0.5, 0.45);
      ctx.beginPath();
      ctx.ellipse(13 + crand() * 14, 57 - crand() * 4, 2.4, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // rune halo
    const halo = ctx.createRadialGradient(20, 27, 1, 20, 27, 16);
    halo.addColorStop(0, shade(C.verdigris, 1.2, 0.3));
    halo.addColorStop(1, shade(C.verdigris, 1, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(4, 11, 32, 32);
    ctx.restore();
    // carved rune: dark groove + glowing core
    const rune = (ox: number, oy: number, col: string, lw: number): void => {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(20 + ox, 14 + oy);
      ctx.lineTo(20 + ox, 40 + oy);
      ctx.moveTo(14 + ox, 22 + oy);
      ctx.lineTo(26 + ox, 22 + oy);
      ctx.moveTo(15 + ox, 34 + oy);
      ctx.lineTo(25 + ox, 30 + oy);
      ctx.stroke();
    };
    rune(0.8, 0.8, shade(C.void, 1.2, 0.7), 2);
    rune(0, 0, shade(C.verdigris, 1.85), 1.6);
    // ink edge
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 2);
    ctx.lineTo(31, 16);
    ctx.lineTo(28, 60);
    ctx.moveTo(20, 2);
    ctx.lineTo(9, 16);
    ctx.lineTo(12, 60);
    ctx.stroke();
    hiEnd(waystone);
  }

  // ── Wax pickups: candle-stubs glowing from within ────────────────────────
  const pickup = (key: string, r: number, tall: boolean): void => {
    const c = T.createCanvas(key, 30, 32);
    if (c === null) return;
    const ctx = hiBegin(c);
    contactShadow(ctx, 15, 28, 8 + r, 3, 0.3);
    // pooled base with translucent skirt
    const pool = ctx.createRadialGradient(15, 27, 1, 15, 27, 7 + r);
    pool.addColorStop(0, shade(C.parchment, 0.95));
    pool.addColorStop(1, shade(C.bone, 0.7));
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(15, 27, 6 + r, 3 + (r >> 1), 0, 0, Math.PI * 2);
    ctx.fill();
    const fy = tall ? 27 - r * 3.4 : 24;
    if (tall) {
      // the stub: subsurface warmth near the flame, cool at the base
      const g = ctx.createLinearGradient(0, fy, 0, 27);
      g.addColorStop(0, mix(C.parchment, C.flameHi, 0.35));
      g.addColorStop(0.4, shade(C.parchment, 0.98));
      g.addColorStop(1, shade(C.bone, 0.78));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(15 - r, 27);
      ctx.lineTo(15 - r + 0.6, fy + 1);
      ctx.quadraticCurveTo(15, fy - 1, 15 + r - 0.6, fy + 1);
      ctx.lineTo(15 + r, 27);
      ctx.closePath();
      ctx.fill();
      // rolled drips
      ctx.fillStyle = shade(C.parchment, 0.88);
      ctx.beginPath();
      ctx.ellipse(15 - r + 0.5, fy + (27 - fy) * 0.45, 1.4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(15 + r - 1, fy + (27 - fy) * 0.7, 1.1, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // east rim kiss
      ctx.strokeStyle = shade(C.flameHi, 1, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(15 + r - 0.6, fy + 2);
      ctx.lineTo(15 + r - 0.2, 26);
      ctx.stroke();
    }
    flameAt(ctx, 15, fy - 0.5, 3.2 + r * 0.3, C.ember, C.flame, C.flameHi);
    hiEnd(c);
  };
  pickup("iso-wax-drip", 3, false);
  pickup("iso-wax-stub", 4, true);
  pickup("iso-wax-cake", 5, true);

  // ── Creatures (upright billboards, right-facing; setFlipX mirrors) ───────

  // Tallow Rat: waxy-grey, dripping coat, one eye catching the light
  const rat = T.createCanvas("iso-ent-1", 34, 26);
  if (rat !== null) {
    const ctx = hiBegin(rat);
    // tail
    ctx.strokeStyle = shade(C.boneDim, 0.75);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 18);
    ctx.bezierCurveTo(-2, 15, -1, 24, 5, 22);
    ctx.stroke();
    const body = new Path2D();
    body.moveTo(7, 19);
    body.bezierCurveTo(6, 11, 14, 7, 21, 9);
    body.bezierCurveTo(26, 7, 31, 9, 32.5, 13);
    body.bezierCurveTo(33.5, 17, 30, 20, 26, 21);
    body.bezierCurveTo(20, 25, 10, 24, 7, 19);
    moldBody(ctx, body, 5, 6, 29, 19, shade(C.boneDim, 0.95), mix(C.boneDim, C.parchment, 0.4), shade(C.boneDim, 0.45), C.flame, INK);
    // ears, lit from the east
    ctx.fillStyle = shade(C.boneDim, 0.8);
    ctx.beginPath();
    ctx.ellipse(23, 6.5, 2.4, 3, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.boneDim, 1.1);
    ctx.beginPath();
    ctx.ellipse(27.5, 6, 2.4, 3, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(C.boneDim, C.seal, 0.3, 0.6);
    ctx.beginPath();
    ctx.ellipse(27.7, 6.4, 1.1, 1.6, 0.15, 0, Math.PI * 2);
    ctx.fill();
    // wax drips sliding off the coat
    ctx.fillStyle = mix(C.bone, C.parchment, 0.5, 0.8);
    for (const [dx, dy, len] of [[12, 12, 4], [17, 10, 5], [22, 12, 3.5]] as const) {
      ctx.beginPath();
      ctx.ellipse(dx, dy + len / 2, 1.1, len / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // whiskers
    ctx.strokeStyle = shade(C.bone, 1.1, 0.5);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(31, 15);
    ctx.lineTo(34, 13.5);
    ctx.moveTo(31, 16);
    ctx.lineTo(34, 16.5);
    ctx.stroke();
    // the eye catches candlelight
    ctx.fillStyle = shade(C.flameHi, 1.05);
    ctx.beginPath();
    ctx.arc(29, 12, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.void, 1);
    ctx.beginPath();
    ctx.arc(29.4, 12.2, 0.6, 0, Math.PI * 2);
    ctx.fill();
    hiEnd(rat);
  }

  // Wickworm: segmented ochre, bursting from dust, rearing east
  const worm = T.createCanvas("iso-ent-2", 40, 38);
  if (worm !== null) {
    const ctx = hiBegin(worm);
    // dust burst
    ctx.fillStyle = shade(C.boneDim, 0.9, 0.3);
    ctx.beginPath();
    ctx.ellipse(20, 33, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.boneDim, 1.1, 0.4);
    for (let d = 0; d < 6; d++) {
      const a = crand() * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(20 + Math.cos(a) * (10 + crand() * 6), 32 + Math.sin(a) * 3, 1.5 + crand(), 0.9, a, 0, Math.PI * 2);
      ctx.fill();
    }
    // segments with ring shading and an east sheen
    const seg = (x: number, y: number, r: number, f: number): void => {
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
      g.addColorStop(0, shade(C.ember, 1.4 * f));
      g.addColorStop(0.7, shade(C.ember, 0.85 * f));
      g.addColorStop(1, shade(C.ember, 0.45 * f));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // chitin ring
      ctx.strokeStyle = shade(C.ember, 0.4, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r - 0.8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      // rim kiss
      ctx.strokeStyle = shade(C.flame, 1.1, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r - 0.6, -Math.PI * 0.35, Math.PI * 0.2);
      ctx.stroke();
    };
    seg(11, 30, 8, 0.75);
    seg(17, 24, 8.5, 0.85);
    seg(24, 17, 8, 1);
    seg(30, 10, 6.5, 1.1);
    // maw: dark throat ringed with pale hooks
    ctx.fillStyle = shade(C.void, 1.4);
    ctx.beginPath();
    ctx.ellipse(32.5, 8, 3.6, 2.8, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(C.parchment, C.ember, 0.25);
    for (let t2 = 0; t2 < 5; t2++) {
      const a = 0.5 + (t2 / 5) * Math.PI * 2;
      const tx = 32.5 + Math.cos(a) * 3.6;
      const ty = 8 + Math.sin(a) * 2.8;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.cos(a) * 1.8 - 0.5, ty + Math.sin(a) * 1.8);
      ctx.lineTo(tx + Math.cos(a) * 1.8 + 0.5, ty + Math.sin(a) * 1.8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = shade(C.flameHi, 1, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(32.5, 8, 4.8, -0.6, 1.2);
    ctx.stroke();
    hiEnd(worm);
  }

  // Vesper Moth: parchment wings, manuscript veins, two flutter frames
  const mothFrame = (key: string, spread: number): void => {
    const c = T.createCanvas(key, 32, 30);
    if (c === null) return;
    const ctx = hiBegin(c);
    const wing = (dir: number): void => {
      const wx = 16 + dir * 8;
      const tilt = dir * (0.9 - spread * 0.5);
      const ry = 4.5 + spread * 6;
      const g = ctx.createRadialGradient(16 + dir * 5, 13, 1, wx, 13, 12);
      g.addColorStop(0, mix(C.parchment, C.flameHi, 0.15, 0.95));
      g.addColorStop(0.7, shade(C.parchmentAged, 0.95, 0.9));
      g.addColorStop(1, shade(C.parchmentAged, 0.65, 0.75));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(wx, 13, 8, ry, tilt, 0, Math.PI * 2);
      ctx.fill();
      // vein tracery, like ruled manuscript lines
      ctx.save();
      ctx.translate(wx, 13);
      ctx.rotate(tilt);
      ctx.strokeStyle = shade(C.ink, 1.6, 0.3);
      ctx.lineWidth = 0.6;
      for (let v = -1; v <= 1; v++) {
        ctx.beginPath();
        ctx.moveTo(-dir * 7, v * ry * 0.35);
        ctx.quadraticCurveTo(0, v * ry * 0.55, dir * 6.5, v * ry * 0.7);
        ctx.stroke();
      }
      ctx.restore();
      // eye-spot: ringed like an illuminated initial
      ctx.strokeStyle = shade(C.inkSoft, 0.9, 0.7);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(16 + dir * 10, 12, 2.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = shade(C.inkSoft, 0.7, 0.75);
      ctx.beginPath();
      ctx.arc(16 + dir * 10, 12, 1, 0, Math.PI * 2);
      ctx.fill();
      // ragged trailing edge
      ctx.strokeStyle = shade(C.parchmentAged, 0.6, 0.5);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(wx, 13, 7.6, tilt + 0.8, tilt + 2.0);
      ctx.stroke();
    };
    wing(-1);
    wing(1);
    // furred body
    const bg = ctx.createLinearGradient(13, 9, 19, 23);
    bg.addColorStop(0, shade(C.parchmentAged, 0.85));
    bg.addColorStop(1, shade(C.parchmentAged, 0.5));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(16, 16, 2.4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(C.parchmentAged, 0.55, 0.6);
    ctx.lineWidth = 0.6;
    for (let s = 0; s < 3; s++) {
      ctx.beginPath();
      ctx.moveTo(14, 13 + s * 3);
      ctx.lineTo(18, 13.6 + s * 3);
      ctx.stroke();
    }
    // antennae
    ctx.strokeStyle = shade(C.parchmentAged, 0.7, 0.8);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(16.5, 9.5);
    ctx.quadraticCurveTo(18.5, 6, 20.5, 5);
    ctx.moveTo(15.5, 9.5);
    ctx.quadraticCurveTo(14.5, 6.5, 12.5, 5.5);
    ctx.stroke();
    // eye toward the flame
    ctx.fillStyle = shade(C.flameHi, 1);
    ctx.beginPath();
    ctx.arc(17.6, 9.8, 1.1, 0, Math.PI * 2);
    ctx.fill();
    hiEnd(c);
  };
  mothFrame("iso-ent-3", 0);
  mothFrame("iso-ent-3b", 1);

  // The Chandler Beast: a dripping mound of molten wax, lit from within
  const beast = T.createCanvas("iso-ent-4", 64, 72);
  if (beast !== null) {
    const ctx = hiBegin(beast);
    const mound = new Path2D();
    mound.moveTo(32, 6);
    mound.bezierCurveTo(46, 8, 54, 20, 55, 38);
    mound.bezierCurveTo(56, 50, 55, 60, 52, 64);
    mound.bezierCurveTo(44, 68, 20, 68, 12, 64);
    mound.bezierCurveTo(9, 58, 8, 48, 9, 38);
    mound.bezierCurveTo(10, 20, 18, 8, 32, 6);
    // body: wax fired from inside — subsurface ember core
    const g = ctx.createRadialGradient(32, 44, 4, 32, 42, 34);
    g.addColorStop(0, shade(C.flame, 1.2));
    g.addColorStop(0.5, shade(C.flame, 0.85));
    g.addColorStop(1, shade(C.ember, 0.42));
    ctx.fillStyle = g;
    ctx.fill(mound);
    ctx.save();
    ctx.clip(mound);
    // inner smolder bleeding through the skin
    const core = ctx.createRadialGradient(32, 40, 1, 32, 40, 16);
    core.addColorStop(0, shade(C.flameHi, 0.95, 0.5));
    core.addColorStop(1, shade(C.flameHi, 1, 0));
    ctx.fillStyle = core;
    ctx.fillRect(12, 22, 40, 40);
    // rivulets of wax running down, each with a specular thread
    for (const [dx, y0, len, w] of [[-16, 26, 34, 4], [-6, 20, 44, 5], [6, 22, 42, 4.5], [16, 28, 30, 3.5]] as const) {
      ctx.fillStyle = shade(C.flame, 1.05, 0.8);
      ctx.beginPath();
      ctx.moveTo(32 + dx - w / 2, y0);
      ctx.quadraticCurveTo(32 + dx - w / 2 - 1, y0 + len * 0.6, 32 + dx - w * 0.35, y0 + len);
      ctx.quadraticCurveTo(32 + dx, y0 + len + 3, 32 + dx + w * 0.35, y0 + len);
      ctx.quadraticCurveTo(32 + dx + w / 2 + 1, y0 + len * 0.6, 32 + dx + w / 2, y0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(C.flameHi, 1, 0.55);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(32 + dx + w * 0.28, y0 + 3);
      ctx.quadraticCurveTo(32 + dx + w * 0.38, y0 + len * 0.55, 32 + dx + w * 0.18, y0 + len - 2);
      ctx.stroke();
    }
    // sagging shelf-folds — broken, irregular, half-melted
    ctx.strokeStyle = shade(C.ember, 0.6, 0.3);
    ctx.lineWidth = 1.2;
    for (const [x0, x1, yy, sag] of [[13, 30, 40, 3], [36, 51, 44, 4], [17, 46, 56, 5]] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.quadraticCurveTo((x0 + x1) / 2, yy + sag, x1, yy);
      ctx.stroke();
    }
    // base heat pooling
    const hp = ctx.createLinearGradient(0, 58, 0, 68);
    hp.addColorStop(0, shade(C.ember, 1, 0));
    hp.addColorStop(1, shade(C.ember, 1.3, 0.5));
    ctx.fillStyle = hp;
    ctx.fillRect(8, 58, 48, 10);
    ctx.restore();
    // guttered wick stubs on the crown
    ctx.strokeStyle = shade(C.void, 1.6);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(27, 8);
    ctx.quadraticCurveTo(26, 4, 28, 2.5);
    ctx.moveTo(37, 8);
    ctx.quadraticCurveTo(39, 5, 38, 3);
    ctx.stroke();
    ctx.fillStyle = shade(C.ember, 1.4, 0.9);
    ctx.fillRect(27.4, 2, 1.3, 1.3);
    ctx.fillRect(37.2, 2.4, 1.2, 1.2);
    // dark eye pits + inner smolder (blind, but something burns in there)
    // narrow, sunken, asymmetric — sockets melted half-shut, not cartoon eyes
    for (const [ex, ey, rx2, ry2, rot] of [[25, 26, 2.6, 3.6, -0.35], [40, 24.5, 2.4, 4.2, 0.3]] as const) {
      const pit = ctx.createRadialGradient(ex, ey + 1, 0.5, ex, ey, 5);
      pit.addColorStop(0, shade(C.void, 0.7));
      pit.addColorStop(1, shade(C.void, 1.6, 0.9));
      ctx.fillStyle = pit;
      ctx.beginPath();
      ctx.ellipse(ex, ey, rx2, ry2, rot, 0, Math.PI * 2);
      ctx.fill();
      // sagging lower lid of wax
      ctx.strokeStyle = shade(C.flame, 1.15, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(ex, ey + 1, rx2 + 0.8, ry2 * 0.7, rot, 0.3, Math.PI - 0.3);
      ctx.stroke();
      ctx.fillStyle = shade(C.ember, 1.35, 0.55);
      ctx.beginPath();
      ctx.arc(ex + 0.6, ey + 1.6, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // ink silhouette
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke(mound);
    hiEnd(beast);
  }

  // ── The delver: hooded, one candle against the dark ─────────────────────
  const player = T.createCanvas("iso-player", 36, 56);
  if (player !== null) {
    const ctx = hiBegin(player);
    const cloak = new Path2D();
    cloak.moveTo(17, 4);
    cloak.bezierCurveTo(26, 5, 28, 14, 27, 23);
    cloak.bezierCurveTo(28, 33, 29, 42, 28, 50);
    cloak.bezierCurveTo(21, 54, 12, 54, 7, 50);
    cloak.bezierCurveTo(6.5, 40, 7.5, 30, 8, 22);
    cloak.bezierCurveTo(7, 10, 11, 5, 17, 4);
    moldBody(ctx, cloak, 6, 4, 23, 50, shade(C.inkSoft, 1.05), shade(C.inkSoft, 1.6), shade(C.void, 1.3), C.flame, INK);
    // fold shadows down the cloak
    ctx.save();
    ctx.clip(cloak);
    ctx.strokeStyle = shade(C.void, 1.3, 0.55);
    ctx.lineWidth = 1.3;
    for (const [x0, c1, c2] of [[12, 30, 46], [17, 28, 50], [23, 32, 48]] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, c1 - 6);
      ctx.quadraticCurveTo(x0 - 1.5, c1 + 8, x0 + 0.5, c2);
      ctx.stroke();
    }
    // frayed hem
    ctx.strokeStyle = shade(C.void, 1.6, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, 50);
    for (let hx = 10; hx <= 28; hx += 3) ctx.lineTo(hx, 50 + (hx % 2 === 0 ? 2 : 0.5));
    ctx.stroke();
    ctx.restore();
    // hood cavity + candle-lit face sliver
    ctx.fillStyle = shade(C.void, 1.05);
    ctx.beginPath();
    ctx.ellipse(18, 13, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const fg = ctx.createLinearGradient(18, 8, 24, 18);
    fg.addColorStop(0, mix(C.parchmentAged, C.flameHi, 0.3, 0.95));
    fg.addColorStop(1, shade(C.parchmentAged, 0.6, 0.85));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(20.5, 13.5, 2.8, 4.8, 0.22, 0, Math.PI * 2);
    ctx.fill();
    // nose shadow — enough face to read human, not enough to know them
    ctx.strokeStyle = shade(C.ink, 0.8, 0.6);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(21.5, 13);
    ctx.lineTo(20.8, 15);
    ctx.stroke();
    // hood rim catching flame
    ctx.strokeStyle = mix(C.inkSoft, C.flame, 0.55, 0.8);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(18, 13, 6.5, -0.7, 0.9);
    ctx.stroke();
    // arm + wrapped hand
    ctx.strokeStyle = shade(C.inkSoft, 1.25);
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(24, 29);
    ctx.quadraticCurveTo(28, 27, 30, 24.5);
    ctx.stroke();
    ctx.fillStyle = shade(C.parchmentAged, 0.75);
    ctx.beginPath();
    ctx.arc(30.4, 24, 2, 0, Math.PI * 2);
    ctx.fill();
    // the candle: wax with drip, wick, layered flame
    const wg = ctx.createLinearGradient(29, 15, 33, 15);
    wg.addColorStop(0, shade(C.parchment, 1.02));
    wg.addColorStop(1, shade(C.parchment, 0.72));
    ctx.fillStyle = wg;
    ctx.fillRect(29, 15.5, 3.5, 8.5);
    ctx.beginPath();
    ctx.ellipse(29.4, 19, 0.9, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 1.4);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(30.7, 15.5);
    ctx.lineTo(30.7, 14);
    ctx.stroke();
    flameAt(ctx, 30.7, 14, 3.4, C.ember, C.flame, C.flameHi);
    hiEnd(player);
  }

  // ── Utility sprites ──────────────────────────────────────────────────────
  const dia = T.createCanvas("iso-diamond", TILE_W, TILE_H);
  if (dia !== null) {
    const ctx = hiBegin(dia);
    diamondPath(ctx, TILE_W / 2, TILE_H / 2, TILE_W - 2, TILE_H - 1);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    hiEnd(dia, false);
  }

  const shadow = T.createCanvas("iso-shadow", 48, 24);
  if (shadow !== null) {
    const ctx = hiBegin(shadow);
    const g = ctx.createRadialGradient(24, 12, 1, 24, 12, 22);
    g.addColorStop(0, "rgba(0,0,0,0.45)");
    g.addColorStop(0.6, "rgba(0,0,0,0.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.scale(1, 0.5);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(24, 24, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    hiEnd(shadow, false);
  }

  const mote = T.createCanvas("iso-mote", 6, 6);
  if (mote !== null) {
    const ctx = hiBegin(mote);
    const g = ctx.createRadialGradient(3, 3, 0, 3, 3, 3);
    g.addColorStop(0, shade(C.bone, 1.2, 0.95));
    g.addColorStop(0.5, shade(C.bone, 1.05, 0.4));
    g.addColorStop(1, shade(C.bone, 1, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 6, 6);
    hiEnd(mote, false);
  }

  // ── Special doors, inscription, seal: dressed stone + a single motif ─────
  const stoneDoor = (key: string, decorate: (ctx: CanvasRenderingContext2D, baseY: number) => void): void => {
    const c = T.createCanvas(key, TILE_W, WALL_H);
    if (c === null) return;
    const ctx = hiBegin(c);
    const baseY = WALL_H - TILE_H / 2;
    const g = ctx.createLinearGradient(0, baseY - 60, 0, baseY);
    g.addColorStop(0, shade(C.surface2, 1.35));
    g.addColorStop(1, shade(C.surface2, 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(8, baseY - 60, TILE_W - 16, 60);
    // block joints
    ctx.strokeStyle = shade(C.void, 1.15, 0.5);
    ctx.lineWidth = 1;
    for (let j = 1; j < 4; j++) {
      ctx.beginPath();
      ctx.moveTo(8, baseY - 60 + j * 15);
      ctx.lineTo(TILE_W - 8, baseY - 60 + j * 15);
      ctx.stroke();
    }
    // lit west edge, dark east edge, ink frame
    ctx.strokeStyle = shade(C.surface2, 1.8, 0.7);
    ctx.beginPath();
    ctx.moveTo(8.5, baseY - 60);
    ctx.lineTo(8.5, baseY);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.strokeRect(8, baseY - 60, TILE_W - 16, 60);
    // threshold shadow
    const th = ctx.createLinearGradient(0, baseY - 7, 0, baseY);
    th.addColorStop(0, shade(C.void, 1, 0));
    th.addColorStop(1, shade(C.void, 0.7, 0.45));
    ctx.fillStyle = th;
    ctx.fillRect(8, baseY - 7, TILE_W - 16, 7);
    decorate(ctx, baseY);
    hiEnd(c);
  };
  stoneDoor("iso-door-iron", (ctx, baseY) => {
    // riveted iron slab, gold escutcheon
    const ig = ctx.createLinearGradient(14, 0, TILE_W - 14, 0);
    ig.addColorStop(0, shade(C.inkSoft, 0.95));
    ig.addColorStop(0.5, shade(C.void, 2.4));
    ig.addColorStop(1, shade(C.void, 1.5));
    ctx.fillStyle = ig;
    ctx.fillRect(14, baseY - 54, TILE_W - 28, 48);
    // plate seams + rivets
    ctx.strokeStyle = shade(C.void, 0.8, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(TILE_W / 2, baseY - 54);
    ctx.lineTo(TILE_W / 2, baseY - 6);
    ctx.stroke();
    ctx.fillStyle = shade(C.inkSoft, 1.5);
    for (let ry = 0; ry < 5; ry++) {
      ctx.beginPath();
      ctx.arc(17, baseY - 50 + ry * 11, 1.1, 0, Math.PI * 2);
      ctx.arc(TILE_W - 17, baseY - 50 + ry * 11, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // escutcheon + keyhole
    const eg = ctx.createRadialGradient(TILE_W / 2 - 1, baseY - 31, 1, TILE_W / 2, baseY - 30, 8);
    eg.addColorStop(0, shade(C.goldInk, 1.35));
    eg.addColorStop(1, shade(C.goldInk, 0.7));
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(TILE_W / 2, baseY - 30, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.void, 0.8);
    ctx.beginPath();
    ctx.arc(TILE_W / 2, baseY - 32, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(TILE_W / 2 - 1.4, baseY - 31);
    ctx.lineTo(TILE_W / 2 + 1.4, baseY - 31);
    ctx.lineTo(TILE_W / 2 + 2, baseY - 25);
    ctx.lineTo(TILE_W / 2 - 2, baseY - 25);
    ctx.closePath();
    ctx.fill();
  });
  stoneDoor("iso-door-hunger", (ctx, baseY) => {
    // a maw in the stone: gullet gradient, twin fang rows, drool of wax
    const maw = new Path2D();
    maw.moveTo(15, baseY - 42);
    maw.bezierCurveTo(TILE_W / 2, baseY - 60, TILE_W - 15, baseY - 42, TILE_W - 16, baseY - 26);
    maw.bezierCurveTo(TILE_W / 2, baseY - 6, 16, baseY - 6, 15, baseY - 26);
    const gg = ctx.createRadialGradient(TILE_W / 2, baseY - 28, 2, TILE_W / 2, baseY - 28, 24);
    gg.addColorStop(0, shade(C.void, 0.4));
    gg.addColorStop(0.7, shade(C.void, 1.1));
    gg.addColorStop(1, shade(C.void, 1.9));
    ctx.fillStyle = gg;
    ctx.fill(maw);
    // upper fangs
    ctx.fillStyle = shade(C.parchmentAged, 1.05);
    for (let t2 = 0; t2 < 5; t2++) {
      const fx = 19 + t2 * 6.5;
      ctx.beginPath();
      ctx.moveTo(fx, baseY - 44 + Math.abs(t2 - 2) * 2);
      ctx.lineTo(fx + 2.5, baseY - 32 + Math.abs(t2 - 2) * 2);
      ctx.lineTo(fx + 5, baseY - 44 + Math.abs(t2 - 2) * 2);
      ctx.closePath();
      ctx.fill();
    }
    // lower fangs
    ctx.fillStyle = shade(C.parchmentAged, 0.8);
    for (let t2 = 0; t2 < 4; t2++) {
      const fx = 22 + t2 * 6.5;
      ctx.beginPath();
      ctx.moveTo(fx, baseY - 10 - Math.abs(t2 - 1.5) * 1.5);
      ctx.lineTo(fx + 2.5, baseY - 20 - Math.abs(t2 - 1.5) * 1.5);
      ctx.lineTo(fx + 5, baseY - 10 - Math.abs(t2 - 1.5) * 1.5);
      ctx.closePath();
      ctx.fill();
    }
    // wax drool between fangs
    ctx.strokeStyle = mix(C.parchment, C.bone, 0.4, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(TILE_W / 2 - 3, baseY - 33);
    ctx.lineTo(TILE_W / 2 - 3.5, baseY - 22);
    ctx.stroke();
    ctx.stroke(maw);
  });
  stoneDoor("iso-door-choir", (ctx, baseY) => {
    // hanging bell-pulls of graded length, and the ring below
    for (let p = 0; p < 4; p++) {
      const px = 18 + p * 9;
      const len = baseY - 14 - p * 4;
      ctx.strokeStyle = mix(C.verdigrisDim, C.verdigris, 0.5);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px, baseY - 52);
      ctx.lineTo(px, len);
      ctx.stroke();
      // small bell at each cord's end
      const bg = ctx.createLinearGradient(px - 3, len, px + 3, len + 5);
      bg.addColorStop(0, mix(C.goldInk, C.verdigris, 0.3, 1));
      bg.addColorStop(1, mix(C.goldInk, C.void, 0.5, 1));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(px - 3, len + 5);
      ctx.quadraticCurveTo(px - 3, len, px, len);
      ctx.quadraticCurveTo(px + 3, len, px + 3, len + 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(C.void, 1.4);
      ctx.fillRect(px - 0.6, len + 5, 1.2, 1.6);
    }
    // the answering ring
    ctx.strokeStyle = shade(C.verdigris, 1.2);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(TILE_W / 2, baseY - 7, 4, 0, Math.PI * 2);
    ctx.stroke();
  });
  stoneDoor("iso-door-sigil", (ctx, baseY) => {
    // the offering circle — it drinks the light
    const dark = ctx.createRadialGradient(TILE_W / 2, baseY - 30, 2, TILE_W / 2, baseY - 30, 20);
    dark.addColorStop(0, shade(C.void, 0.5, 0.9));
    dark.addColorStop(1, shade(C.void, 1, 0));
    ctx.fillStyle = dark;
    ctx.fillRect(TILE_W / 2 - 20, baseY - 50, 40, 40);
    ctx.strokeStyle = mix(C.verdigrisDim, C.verdigris, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(TILE_W / 2, baseY - 30, 14, 0, Math.PI * 2);
    ctx.moveTo(TILE_W / 2 - 14, baseY - 30);
    ctx.lineTo(TILE_W / 2 + 14, baseY - 30);
    ctx.moveTo(TILE_W / 2, baseY - 44);
    ctx.lineTo(TILE_W / 2, baseY - 16);
    ctx.stroke();
    // faint glow along the carving
    ctx.strokeStyle = shade(C.verdigris, 1.4, 0.35);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(TILE_W / 2, baseY - 30, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = shade(C.void, 1.2);
    ctx.beginPath();
    ctx.arc(TILE_W / 2, baseY - 30, 6, 0, Math.PI * 2);
    ctx.fill();
    // tick marks — three waits
    ctx.strokeStyle = mix(C.verdigris, C.bone, 0.3, 0.8);
    ctx.lineWidth = 1;
    for (let t2 = 0; t2 < 3; t2++) {
      const a = -Math.PI / 2 + t2 * 0.5;
      ctx.beginPath();
      ctx.moveTo(TILE_W / 2 + Math.cos(a) * 11, baseY - 30 + Math.sin(a) * 11);
      ctx.lineTo(TILE_W / 2 + Math.cos(a) * 14, baseY - 30 + Math.sin(a) * 14);
      ctx.stroke();
    }
  });
  stoneDoor("iso-inscription", (ctx, baseY) => {
    // gold cipher glyphs on a rubbed panel, gently lamplit
    ctx.fillStyle = shade(C.void, 1.3, 0.4);
    ctx.fillRect(11, baseY - 53, TILE_W - 22, 48);
    const lit = ctx.createRadialGradient(TILE_W / 2, baseY - 30, 2, TILE_W / 2, baseY - 30, 26);
    lit.addColorStop(0, shade(C.goldInk, 1, 0.14));
    lit.addColorStop(1, shade(C.goldInk, 1, 0));
    ctx.fillStyle = lit;
    ctx.fillRect(11, baseY - 53, TILE_W - 22, 48);
    ctx.lineWidth = 1.4;
    // cipher glyph gibberish (the mapping is the season's secret)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const gx = 14 + col * 10;
        const gy = baseY - 48 + row * 14;
        // carved shadow pass then gold pass
        for (const [ox, oy, col2] of [[0.7, 0.7, shade(C.void, 1.2, 0.8)], [0, 0, C.goldInk]] as const) {
          ctx.strokeStyle = col2;
          ctx.beginPath();
          const v = (Math.imul(row + 1, col + 3) + row) % 4;
          if (v === 0) {
            ctx.moveTo(gx + ox, gy + oy);
            ctx.lineTo(gx + 6 + ox, gy + 8 + oy);
            ctx.moveTo(gx + 6 + ox, gy + oy);
            ctx.lineTo(gx + ox, gy + 8 + oy);
          } else if (v === 1) {
            ctx.arc(gx + 3 + ox, gy + 4 + oy, 3.4, 0, Math.PI * 1.5);
          } else if (v === 2) {
            ctx.moveTo(gx + ox, gy + 8 + oy);
            ctx.lineTo(gx + 3 + ox, gy + oy);
            ctx.lineTo(gx + 6 + ox, gy + 8 + oy);
          } else {
            ctx.moveTo(gx + ox, gy + 4 + oy);
            ctx.lineTo(gx + 6 + ox, gy + 4 + oy);
            ctx.moveTo(gx + 3 + ox, gy + oy);
            ctx.lineTo(gx + 3 + ox, gy + 8 + oy);
          }
          ctx.stroke();
        }
      }
    }
  });
  stoneDoor("iso-seal", (ctx, baseY) => {
    // the Bottom Seal: triple gold ring, wax boss, stress cracks
    ctx.strokeStyle = shade(C.void, 1.1, 0.6);
    ctx.lineWidth = 0.9;
    for (const [a1, a2] of [[0.3, 0.9], [2.2, 2.9], [4.1, 4.7]] as const) {
      ctx.beginPath();
      ctx.moveTo(TILE_W / 2 + Math.cos(a1) * 19, baseY - 30 + Math.sin(a1) * 19);
      ctx.lineTo(TILE_W / 2 + Math.cos(a2) * 27, baseY - 30 + Math.sin(a2) * 27);
      ctx.stroke();
    }
    for (let ring = 0; ring < 3; ring++) {
      const rr = 18 - ring * 6;
      ctx.strokeStyle = ring === 1 ? shade(C.goldInk, 1.3) : C.goldInk;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(TILE_W / 2, baseY - 30, rr, 0, Math.PI * 2);
      ctx.stroke();
      // lit upper arc
      ctx.strokeStyle = shade(C.goldInk, 1.6, 0.7);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(TILE_W / 2, baseY - 30, rr, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    const sg = ctx.createRadialGradient(TILE_W / 2 - 1, baseY - 31, 0.5, TILE_W / 2, baseY - 30, 5);
    sg.addColorStop(0, shade(C.seal, 1.5));
    sg.addColorStop(1, shade(C.seal, 0.7));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(TILE_W / 2, baseY - 30, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(C.seal, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(TILE_W / 2, baseY - 30, 2.4, 0, Math.PI * 2);
    ctx.stroke();
  });

  // ── Chest: banded timber casket (also the Mirrormaw's disguise) ──────────
  const chest = T.createCanvas("iso-chest", 44, 40);
  if (chest !== null) {
    const ctx = hiBegin(chest);
    contactShadow(ctx, 22, 36, 17, 4.5, 0.35);
    // body: planked timber
    const g = ctx.createLinearGradient(0, 14, 0, 34);
    g.addColorStop(0, shade(C.parchmentAged, 0.92));
    g.addColorStop(1, shade(C.parchmentAged, 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(6, 14, 32, 20);
    ctx.strokeStyle = shade(C.ink, 1.2, 0.4);
    ctx.lineWidth = 0.8;
    for (let p = 1; p < 3; p++) {
      ctx.beginPath();
      ctx.moveTo(6, 14 + p * 7);
      ctx.lineTo(38, 14 + p * 7);
      ctx.stroke();
    }
    // domed lid with stave arcs
    const lidg = ctx.createLinearGradient(0, 4, 0, 15);
    lidg.addColorStop(0, shade(C.parchmentAged, 1.12));
    lidg.addColorStop(1, shade(C.parchmentAged, 0.78));
    ctx.fillStyle = lidg;
    ctx.beginPath();
    ctx.moveTo(6, 14);
    ctx.bezierCurveTo(10, 4, 34, 4, 38, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(C.ink, 1.2, 0.35);
    for (let a = 1; a < 3; a++) {
      ctx.beginPath();
      ctx.moveTo(6 + a * 2, 14);
      ctx.bezierCurveTo(10 + a * 1.5, 5.5 + a, 34 - a * 1.5, 5.5 + a, 38 - a * 2, 14);
      ctx.stroke();
    }
    // candle sheen on the lid's east shoulder
    const sheen = ctx.createRadialGradient(31, 9, 1, 31, 9, 9);
    sheen.addColorStop(0, shade(C.flame, 1, 0.2));
    sheen.addColorStop(1, shade(C.flame, 1, 0));
    ctx.fillStyle = sheen;
    ctx.fillRect(22, 3, 18, 12);
    // iron bands + corner brackets, studded
    const band = (x: number): void => {
      const bg = ctx.createLinearGradient(x, 0, x + 4, 0);
      bg.addColorStop(0, shade(C.inkSoft, 1.1));
      bg.addColorStop(1, shade(C.void, 1.6));
      ctx.fillStyle = bg;
      ctx.fillRect(x, 6.5, 4, 27.5);
      ctx.fillStyle = shade(C.bone, 1.1, 0.85);
      ctx.fillRect(x + 1.2, 10, 1.2, 1.2);
      ctx.fillRect(x + 1.2, 28, 1.2, 1.2);
    };
    band(11);
    band(29);
    ctx.fillStyle = shade(C.void, 1.7);
    ctx.fillRect(6, 20, 32, 3);
    // lock plate: gold with keyhole
    const lp = ctx.createLinearGradient(19, 17, 25, 26);
    lp.addColorStop(0, shade(C.goldInk, 1.3));
    lp.addColorStop(1, shade(C.goldInk, 0.7));
    ctx.fillStyle = lp;
    ctx.fillRect(19.5, 17.5, 5, 8);
    ctx.fillStyle = shade(C.void, 0.9);
    ctx.beginPath();
    ctx.arc(22, 20.5, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(21.5, 21, 1, 2.6);
    // ink outline
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.strokeRect(6, 14, 32, 20);
    ctx.beginPath();
    ctx.moveTo(6, 14);
    ctx.bezierCurveTo(10, 4, 34, 4, 38, 14);
    ctx.stroke();
    hiEnd(chest);
  }

  // Mirrormaw revealed: the casket splits into a fanged grin
  const mimicFangs = T.createCanvas("iso-mimic-revealed", 44, 42);
  if (mimicFangs !== null) {
    const ctx = hiBegin(mimicFangs);
    contactShadow(ctx, 22, 38, 17, 4.5, 0.35);
    // body (as the chest, but strained)
    const g = ctx.createLinearGradient(0, 16, 0, 38);
    g.addColorStop(0, shade(C.parchmentAged, 0.85));
    g.addColorStop(1, shade(C.parchmentAged, 0.45));
    ctx.fillStyle = g;
    ctx.fillRect(6, 18, 32, 18);
    ctx.strokeStyle = shade(C.ink, 1.2, 0.4);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(6, 27);
    ctx.lineTo(38, 27);
    ctx.stroke();
    // snapped iron bands curl away
    ctx.strokeStyle = shade(C.void, 1.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(12, 18);
    ctx.quadraticCurveTo(10, 14, 12.5, 11);
    ctx.moveTo(31, 18);
    ctx.quadraticCurveTo(34, 15, 32.5, 11);
    ctx.stroke();
    // gullet: lid thrown open
    const gullet = ctx.createRadialGradient(22, 12, 1, 22, 12, 16);
    gullet.addColorStop(0, shade(C.seal, 0.4));
    gullet.addColorStop(0.65, shade(C.void, 1));
    gullet.addColorStop(1, shade(C.void, 1.7));
    ctx.fillStyle = gullet;
    ctx.beginPath();
    ctx.moveTo(5, 17);
    ctx.bezierCurveTo(10, 1, 34, 1, 39, 17);
    ctx.bezierCurveTo(34, 21, 10, 21, 5, 17);
    ctx.fill();
    // fangs: uppers hang, lowers jut
    ctx.fillStyle = mix(C.parchment, C.bone, 0.25);
    for (let f = 0; f < 6; f++) {
      const fx = 8.5 + f * 5;
      const sag = Math.abs(f - 2.5) * 1.1;
      ctx.beginPath();
      ctx.moveTo(fx, 6 + sag);
      ctx.lineTo(fx + 2.2, 14 + sag);
      ctx.lineTo(fx + 4.4, 6 + sag);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = mix(C.parchment, C.bone, 0.45);
    for (let f = 0; f < 5; f++) {
      const fx = 11 + f * 5;
      ctx.beginPath();
      ctx.moveTo(fx, 19.5);
      ctx.lineTo(fx + 2.2, 13.5);
      ctx.lineTo(fx + 4.4, 19.5);
      ctx.closePath();
      ctx.fill();
    }
    // seal-red eyes, glowing
    for (const ex of [15, 29] as const) {
      const eg = ctx.createRadialGradient(ex, 5, 0.3, ex, 5, 4);
      eg.addColorStop(0, shade(C.seal, 1.6, 0.9));
      eg.addColorStop(1, shade(C.seal, 1, 0));
      ctx.fillStyle = eg;
      ctx.fillRect(ex - 4, 1, 8, 8);
      ctx.fillStyle = shade(C.seal, 1.4);
      ctx.beginPath();
      ctx.arc(ex, 5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // ink outline on the body
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.strokeRect(6, 18, 32, 18);
    hiEnd(mimicFangs);
  }

  // ── Shrines ──────────────────────────────────────────────────────────────
  const shrine = (key: string, draw: (ctx: CanvasRenderingContext2D) => void): void => {
    const c = T.createCanvas(key, 44, 60);
    if (c === null) return;
    const ctx = hiBegin(c);
    contactShadow(ctx, 22, 55, 16, 4.5, 0.4);
    draw(ctx);
    hiEnd(c);
  };
  shrine("iso-altar", (ctx) => {
    // Tallow Altar: stone table drowned in generations of wax
    const g = ctx.createLinearGradient(0, 22, 0, 54);
    g.addColorStop(0, shade(C.surface2, 1.4));
    g.addColorStop(1, shade(C.surface2, 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(9, 32, 26, 22);
    ctx.fillRect(5, 25, 34, 8);
    // slab edge lit
    ctx.strokeStyle = shade(C.surface2, 1.9, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(5, 25.5);
    ctx.lineTo(39, 25.5);
    ctx.stroke();
    // wax sheet flowing over the lip, with drips
    const wx = ctx.createLinearGradient(0, 18, 0, 34);
    wx.addColorStop(0, shade(C.parchment, 1.02));
    wx.addColorStop(1, shade(C.bone, 0.8));
    ctx.fillStyle = wx;
    ctx.beginPath();
    ctx.ellipse(22, 24, 13, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, len] of [[-10, 7], [-4, 11], [3, 8], [9, 12]] as const) {
      ctx.beginPath();
      ctx.ellipse(22 + dx, 27 + len / 2, 1.6, len / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // subsurface warmth where the flame stands
    const warm = ctx.createRadialGradient(22, 21, 1, 22, 22, 9);
    warm.addColorStop(0, shade(C.flameHi, 1, 0.35));
    warm.addColorStop(1, shade(C.flameHi, 1, 0));
    ctx.fillStyle = warm;
    ctx.fillRect(13, 13, 18, 18);
    flameAt(ctx, 22, 20, 3.6, C.ember, C.flame, C.flameHi);
  });
  shrine("iso-pool", (ctx) => {
    // Mirror Pool: a stone lip around still, remembering water
    const rim = ctx.createLinearGradient(0, 36, 0, 56);
    rim.addColorStop(0, shade(C.surface2, 1.5));
    rim.addColorStop(1, shade(C.surface2, 0.7));
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.ellipse(22, 46, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(C.surface2, 1.9, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(22, 44.5, 17, 8, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // the water: verdigris memory, banded reflection
    const wg = ctx.createRadialGradient(22, 45, 1, 22, 46, 14);
    wg.addColorStop(0, mix(C.verdigris, C.bone, 0.45));
    wg.addColorStop(0.6, mix(C.verdigrisDim, C.void, 0.3));
    wg.addColorStop(1, mix(C.void, C.verdigrisDim, 0.4));
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(22, 46, 14, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // reflection streaks — someone else's flame, upside down
    ctx.strokeStyle = shade(C.flame, 1, 0.3);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(26, 43);
    ctx.bezierCurveTo(25, 45, 27.5, 47, 26.5, 49.5);
    ctx.stroke();
    ctx.strokeStyle = mix(C.verdigris, C.bone, 0.55, 0.5);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(22, 46, 9, 3.8, 0, 0.4, 2.2);
    ctx.stroke();
  });
  shrine("iso-font", (ctx) => {
    // Nameless Font: a blank pedestal cup of black water
    const g = ctx.createLinearGradient(0, 10, 0, 54);
    g.addColorStop(0, shade(C.boneDim, 1.25));
    g.addColorStop(1, shade(C.boneDim, 0.42));
    ctx.fillStyle = g;
    // fluted stem
    ctx.beginPath();
    ctx.moveTo(17, 26);
    ctx.quadraticCurveTo(19, 38, 15, 54);
    ctx.lineTo(29, 54);
    ctx.quadraticCurveTo(25, 38, 27, 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(C.boneDim, 0.55, 0.5);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(20, 28);
    ctx.quadraticCurveTo(21.5, 40, 18.5, 52);
    ctx.moveTo(24, 28);
    ctx.quadraticCurveTo(23, 40, 25.5, 52);
    ctx.stroke();
    // basin
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(22, 24, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(C.boneDim, 1.6, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(22, 22.5, 14, 5.2, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // black water — utterly still, no reflection at all
    ctx.fillStyle = shade(C.void, 0.75);
    ctx.beginPath();
    ctx.ellipse(22, 23, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 2.2, 0.5);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(22, 23, 11, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // ── The rest of the bestiary ─────────────────────────────────────────────

  // Gloomcap Slime: a verdigris mushroom-cap over translucent ooze
  const slime = T.createCanvas(`iso-ent-${EntityKind.SLIME}`, 32, 28);
  if (slime !== null) {
    const ctx = hiBegin(slime);
    // ooze body
    const body = new Path2D();
    body.moveTo(4, 22);
    body.bezierCurveTo(3, 15, 9, 11, 16, 11);
    body.bezierCurveTo(23, 11, 29, 15, 28, 22);
    body.bezierCurveTo(26, 26.5, 6, 26.5, 4, 22);
    moldBody(ctx, body, 3, 10, 26, 17, shade(C.verdigrisDim, 0.9), mix(C.verdigrisDim, C.verdigris, 0.7), shade(C.verdigrisDim, 0.45), C.flame, INK);
    // suspended motes inside the ooze
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = shade(C.verdigris, 1.3, 0.45);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(8 + crand() * 16, 15 + crand() * 8, 0.8 + crand() * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // the cap: gilled underside, gleaming dome
    ctx.fillStyle = shade(C.verdigrisDim, 0.55);
    ctx.beginPath();
    ctx.ellipse(16, 10.5, 10.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // gills
    ctx.strokeStyle = shade(C.verdigrisDim, 0.4, 0.7);
    ctx.lineWidth = 0.7;
    for (let g2 = -3; g2 <= 3; g2++) {
      ctx.beginPath();
      ctx.moveTo(16, 10.5);
      ctx.lineTo(16 + g2 * 3, 12.2);
      ctx.stroke();
    }
    const capg = ctx.createRadialGradient(13, 5, 1, 16, 7, 11);
    capg.addColorStop(0, shade(C.verdigris, 1.35));
    capg.addColorStop(0.7, shade(C.verdigris, 0.85));
    capg.addColorStop(1, shade(C.verdigrisDim, 0.6));
    ctx.fillStyle = capg;
    ctx.beginPath();
    ctx.ellipse(16, 8, 10.5, 5, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    // cap speckles + wet gleam
    ctx.fillStyle = mix(C.verdigris, C.parchment, 0.5, 0.6);
    for (const [sx, sy] of [[11, 5.5], [18, 4], [22, 6.5]] as const) {
      ctx.beginPath();
      ctx.arc(sx, sy, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = shade(C.flameHi, 1, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(16, 8, 9.5, -0.5, 0.35);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(16, 8, 10.5, 5, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    hiEnd(slime);
  }

  // Sporewight: a puffball corpse-shape, leaking spores
  const wight = T.createCanvas(`iso-ent-${EntityKind.SPOREWIGHT}`, 34, 36);
  if (wight !== null) {
    const ctx = hiBegin(wight);
    const body = new Path2D();
    body.moveTo(17, 6);
    body.bezierCurveTo(25, 6, 30, 13, 29, 21);
    body.bezierCurveTo(30, 28, 26, 33, 17, 33);
    body.bezierCurveTo(8, 33, 4, 28, 5, 21);
    body.bezierCurveTo(4, 13, 9, 6, 17, 6);
    moldBody(ctx, body, 4, 5, 27, 29, mix(C.verdigrisDim, C.boneDim, 0.5), mix(C.verdigris, C.parchment, 0.45), mix(C.verdigrisDim, C.void, 0.5), C.flame, INK);
    ctx.save();
    ctx.clip(body);
    // pocked craters
    for (const [px, py, r] of [[11, 14, 2.2], [21, 12, 1.8], [16, 22, 2.6], [24, 24, 1.9]] as const) {
      ctx.fillStyle = shade(C.verdigrisDim, 0.45, 0.8);
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.7, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = mix(C.verdigris, C.bone, 0.4, 0.5);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(px, py - r * 0.5, r * 0.8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.restore();
    // drifting spores with faint halos
    for (const [px, py] of [[7, 6], [26, 4], [30, 14], [3, 18], [29, 30]] as const) {
      const sg = ctx.createRadialGradient(px, py, 0, px, py, 2.6);
      sg.addColorStop(0, shade(C.verdigris, 1.3, 0.8));
      sg.addColorStop(1, shade(C.verdigris, 1, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(px - 2.6, py - 2.6, 5.2, 5.2);
      ctx.fillStyle = mix(C.verdigris, C.parchment, 0.5);
      ctx.fillRect(px - 0.5, py - 0.5, 1, 1);
    }
    // a sunken almost-face
    ctx.fillStyle = shade(C.verdigrisDim, 0.35, 0.7);
    ctx.beginPath();
    ctx.ellipse(20, 15, 1.5, 2.2, 0.1, 0, Math.PI * 2);
    ctx.fill();
    hiEnd(wight);
  }

  // Drownedkin: waterlogged, sagging, one verdigris eye
  const drowned = T.createCanvas(`iso-ent-${EntityKind.DROWNED}`, 30, 46);
  if (drowned !== null) {
    const ctx = hiBegin(drowned);
    const body = new Path2D();
    body.moveTo(16, 8);
    body.bezierCurveTo(22, 9, 24, 16, 23, 24);
    body.bezierCurveTo(25, 33, 26, 40, 24, 43);
    body.bezierCurveTo(17, 45.5, 9, 45, 6, 42);
    body.bezierCurveTo(5, 34, 7, 26, 8, 20);
    body.bezierCurveTo(8, 12, 11, 8, 16, 8);
    moldBody(ctx, body, 5, 7, 21, 39, mix(C.void, C.verdigrisDim, 0.55), mix(C.verdigrisDim, C.verdigris, 0.5), mix(C.void, C.verdigrisDim, 0.25), C.flame, INK);
    // hunched head, hanging
    ctx.fillStyle = mix(C.void, C.verdigrisDim, 0.7);
    ctx.beginPath();
    ctx.ellipse(19, 12, 5.5, 6.5, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(19, 12, 5.5, 6.5, 0.25, 0, Math.PI * 2);
    ctx.stroke();
    // lank hair pasted down
    ctx.strokeStyle = shade(C.void, 1.5, 0.8);
    ctx.lineWidth = 1;
    for (const dx of [-3, -1, 1.5] as const) {
      ctx.beginPath();
      ctx.moveTo(19 + dx, 7);
      ctx.quadraticCurveTo(18.5 + dx, 12, 19.5 + dx, 16);
      ctx.stroke();
    }
    // trailing arm, fingers dripping
    ctx.strokeStyle = mix(C.void, C.verdigrisDim, 0.65);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(22, 24);
    ctx.quadraticCurveTo(26, 30, 25, 37);
    ctx.stroke();
    // water lines shedding off
    ctx.strokeStyle = mix(C.verdigris, C.bone, 0.35, 0.55);
    ctx.lineWidth = 0.8;
    for (const [dx, y0, len] of [[-4, 26, 5], [2, 30, 6], [7, 34, 4]] as const) {
      ctx.beginPath();
      ctx.moveTo(15 + dx, y0);
      ctx.lineTo(15 + dx, y0 + len);
      ctx.stroke();
    }
    // drips falling free
    ctx.fillStyle = mix(C.verdigris, C.bone, 0.4, 0.7);
    ctx.beginPath();
    ctx.ellipse(25, 41, 0.8, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // the eye: verdigris, wrong
    const eg = ctx.createRadialGradient(21.5, 11.5, 0.2, 21.5, 11.5, 3);
    eg.addColorStop(0, shade(C.verdigris, 1.5, 0.9));
    eg.addColorStop(1, shade(C.verdigris, 1, 0));
    ctx.fillStyle = eg;
    ctx.fillRect(18.5, 8.5, 6, 6);
    ctx.fillStyle = shade(C.verdigris, 1.6);
    ctx.beginPath();
    ctx.arc(21.5, 11.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    hiEnd(drowned);
  }

  // Bellhung: a corpse hanged inside its own bell — legs for a clapper
  const bellhung = T.createCanvas(`iso-ent-${EntityKind.BELLHUNG}`, 34, 54);
  if (bellhung !== null) {
    const ctx = hiBegin(bellhung);
    // the rope, knotted
    ctx.strokeStyle = shade(C.boneDim, 0.85);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(17, 9);
    ctx.stroke();
    ctx.fillStyle = shade(C.boneDim, 0.7);
    ctx.beginPath();
    ctx.arc(17, 8, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // the bell: old bronze, verdigris-stained
    const bell = new Path2D();
    bell.moveTo(17, 9);
    bell.bezierCurveTo(23, 9.5, 25, 15, 25.5, 23);
    bell.bezierCurveTo(26, 29, 28.5, 32, 30, 34);
    bell.lineTo(4, 34);
    bell.bezierCurveTo(5.5, 32, 8, 29, 8.5, 23);
    bell.bezierCurveTo(9, 15, 11, 9.5, 17, 9);
    const bronze = mix(C.goldInk, C.ink, 0.45);
    moldBody(ctx, bell, 3, 8, 28, 27, bronze, mix(C.goldInk, C.parchment, 0.25), mix(bronze, C.void, 0.55), C.flame, INK);
    ctx.save();
    ctx.clip(bell);
    // patina blooms
    for (const [px, py, r] of [[10, 20, 3], [22, 26, 3.5], [15, 30, 2.5]] as const) {
      ctx.fillStyle = mix(bronze, C.verdigris, 0.55, 0.5);
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.7, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // shoulder bands
    ctx.strokeStyle = shade(bronze, 0.55, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(9, 22);
    ctx.quadraticCurveTo(17, 23.5, 25, 22);
    ctx.moveTo(6, 30);
    ctx.quadraticCurveTo(17, 32, 28, 30);
    ctx.stroke();
    ctx.restore();
    // bell mouth: dark interior
    ctx.fillStyle = shade(C.void, 1.1);
    ctx.beginPath();
    ctx.ellipse(17, 34, 13, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(bronze, 1.3, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(17, 34, 13, 3, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    // the clapper: pale legs, hanging still
    const lg2 = ctx.createLinearGradient(0, 34, 0, 50);
    lg2.addColorStop(0, shade(C.void, 1.2));
    lg2.addColorStop(0.4, mix(C.bone, C.void, 0.35));
    lg2.addColorStop(1, mix(C.bone, C.void, 0.15));
    ctx.fillStyle = lg2;
    ctx.fillRect(14, 32, 2.6, 15);
    ctx.fillRect(17.8, 32, 2.6, 16.5);
    // feet
    ctx.fillStyle = mix(C.bone, C.void, 0.25);
    ctx.beginPath();
    ctx.ellipse(15.6, 47.5, 1.8, 1, -0.3, 0, Math.PI * 2);
    ctx.ellipse(19.6, 49, 1.8, 1, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(14, 32, 2.6, 15);
    ctx.strokeRect(17.8, 32, 2.6, 16.5);
    hiEnd(bellhung);
  }

  // Cinder Shade: a guttering black silhouette with ember eyes
  const shadeTex = T.createCanvas(`iso-ent-${EntityKind.SHADE}`, 34, 52);
  if (shadeTex !== null) {
    const ctx = hiBegin(shadeTex);
    // wisp trails first, behind the body
    ctx.strokeStyle = shade(C.void, 2.2, 0.4);
    ctx.lineWidth = 1.6;
    for (const [x0, y0] of [[8, 20], [27, 26]] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 - 4, y0 - 6, x0 - 2, y0 - 12);
      ctx.stroke();
    }
    const body = new Path2D();
    // guttering top edge, like a flame starved of air
    body.moveTo(17, 3);
    body.bezierCurveTo(21, 6, 19, 10, 23, 12);
    body.bezierCurveTo(27, 15, 26, 30, 28, 50);
    body.bezierCurveTo(23, 46.5, 20, 49, 17, 47);
    body.bezierCurveTo(14, 49, 10, 46.5, 6, 50);
    body.bezierCurveTo(8, 30, 7, 15, 11, 12);
    body.bezierCurveTo(15, 10, 13, 6, 17, 3);
    const g = ctx.createLinearGradient(0, 0, 0, 52);
    g.addColorStop(0, shade(C.void, 3.0, 0.95));
    g.addColorStop(0.55, shade(C.void, 1.6, 0.85));
    g.addColorStop(1, shade(C.void, 1.1, 0.35));
    ctx.fillStyle = g;
    ctx.fill(body);
    // interior: even darker heart
    ctx.save();
    ctx.clip(body);
    const heart = ctx.createRadialGradient(17, 26, 1, 17, 26, 14);
    heart.addColorStop(0, shade(C.void, 0.4, 0.9));
    heart.addColorStop(1, shade(C.void, 1, 0));
    ctx.fillStyle = heart;
    ctx.fillRect(3, 12, 28, 30);
    // a starved warm rim — the last light it stole
    const rg = ctx.createLinearGradient(22, 0, 30, 0);
    rg.addColorStop(0, shade(C.ember, 1, 0));
    rg.addColorStop(1, shade(C.ember, 0.9, 0.3));
    ctx.fillStyle = rg;
    ctx.fillRect(20, 4, 10, 46);
    ctx.restore();
    // ember eyes with heat halos
    for (const [ex, ey] of [[13.5, 16], [21, 15]] as const) {
      const eg = ctx.createRadialGradient(ex, ey, 0.2, ex, ey, 4);
      eg.addColorStop(0, shade(C.ember, 1.4, 0.7));
      eg.addColorStop(1, shade(C.ember, 1, 0));
      ctx.fillStyle = eg;
      ctx.fillRect(ex - 4, ey - 4, 8, 8);
      ctx.fillStyle = shade(C.ember, 1.5);
      ctx.beginPath();
      ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(C.flameHi, 1, 0.9);
      ctx.beginPath();
      ctx.arc(ex + 0.4, ey - 0.4, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    hiEnd(shadeTex);
  }

  // Gaslight: a wisp of verdigris-tinged flame, barely there
  const gaslight = T.createCanvas(`iso-ent-${EntityKind.GASLIGHT}`, 26, 36);
  if (gaslight !== null) {
    const ctx = hiBegin(gaslight);
    // ambient halo
    const halo = ctx.createRadialGradient(13, 20, 1, 13, 20, 13);
    halo.addColorStop(0, mix(C.verdigris, C.flame, 0.3, 0.28));
    halo.addColorStop(1, mix(C.verdigris, C.flame, 0.3, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 7, 26, 26);
    const tongue = (w3: number, h3: number, lean: number, color: string, a: number): void => {
      ctx.fillStyle = color;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(13 + lean, 30 - h3);
      ctx.bezierCurveTo(13 + w3, 30 - h3 * 0.4, 13 + w3 * 0.6, 30, 13, 30);
      ctx.bezierCurveTo(13 - w3 * 0.6, 30, 13 - w3, 30 - h3 * 0.4, 13 + lean, 30 - h3);
      ctx.fill();
    };
    tongue(9, 25, 2.5, mix(C.verdigris, C.flame, 0.3), 0.8);
    tongue(6, 18, 1.5, mix(C.verdigris, C.flame, 0.45), 0.9);
    tongue(3.2, 11, 0.5, mix(C.verdigris, C.flameHi, 0.5), 1);
    ctx.globalAlpha = 1;
    // detached embers drifting off it
    for (const [px, py, r] of [[19, 12, 1.1], [9, 8, 0.8], [16, 4, 0.7]] as const) {
      const sg = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
      sg.addColorStop(0, mix(C.verdigris, C.flameHi, 0.5, 0.9));
      sg.addColorStop(1, mix(C.verdigris, C.flameHi, 0.5, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(px - r * 3, py - r * 3, r * 6, r * 6);
    }
    // no core, no body: a hole where the source should be
    ctx.fillStyle = shade(C.void, 1, 0.5);
    ctx.beginPath();
    ctx.ellipse(13, 24, 2.2, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    hiEnd(gaslight);
  }

  // The Choirless: pale, robed, mouth forever open
  const choirless = T.createCanvas(`iso-ent-${EntityKind.CHOIRLESS}`, 30, 50);
  if (choirless !== null) {
    const ctx = hiBegin(choirless);
    const body = new Path2D();
    body.moveTo(15, 3);
    body.bezierCurveTo(21, 4, 23, 10, 22, 17);
    body.bezierCurveTo(24, 28, 25, 40, 24, 47);
    body.bezierCurveTo(18, 49.5, 11, 49.5, 6, 47);
    body.bezierCurveTo(5, 40, 6, 28, 8, 17);
    body.bezierCurveTo(7, 10, 9, 4, 15, 3);
    moldBody(ctx, body, 5, 2, 20, 46, mix(C.bone, C.void, 0.4), mix(C.parchment, C.bone, 0.45), mix(C.bone, C.void, 0.68), C.flame, INK);
    ctx.save();
    ctx.clip(body);
    // robe folds, straight and liturgical
    ctx.strokeStyle = mix(C.bone, C.void, 0.72, 0.55);
    ctx.lineWidth = 1.1;
    for (const dx of [-4.5, 0, 4.5] as const) {
      ctx.beginPath();
      ctx.moveTo(15 + dx, 22);
      ctx.lineTo(15 + dx * 1.3, 47);
      ctx.stroke();
    }
    ctx.restore();
    // hollow eyes: upcast, unseeing
    ctx.fillStyle = shade(C.void, 1.1, 0.85);
    ctx.beginPath();
    ctx.ellipse(12.5, 9.5, 1.4, 1.9, 0, 0, Math.PI * 2);
    ctx.ellipse(18.5, 9.5, 1.4, 1.9, 0, 0, Math.PI * 2);
    ctx.fill();
    // the mouth, forever open — jaw strain lines around it
    const mg = ctx.createRadialGradient(16, 15.5, 0.5, 16, 15.5, 6);
    mg.addColorStop(0, shade(C.void, 0.5));
    mg.addColorStop(1, shade(C.void, 1.4));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.ellipse(16, 15.5, 3.6, 5.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = mix(C.bone, C.void, 0.6, 0.7);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(11.5, 14);
    ctx.quadraticCurveTo(11, 16, 12, 18.5);
    ctx.moveTo(20.5, 14);
    ctx.quadraticCurveTo(21, 16, 20, 18.5);
    ctx.stroke();
    hiEnd(choirless);
  }

  // Rustling: a scuttling key-thief, all twigs and stolen glint
  const rustling = T.createCanvas(`iso-ent-${EntityKind.RUSTLING}`, 24, 18);
  if (rustling !== null) {
    const ctx = hiBegin(rustling);
    // twig legs first (behind)
    ctx.strokeStyle = shade(C.boneDim, 0.55);
    ctx.lineWidth = 1.1;
    for (let leg = 0; leg < 4; leg++) {
      const lx = 5 + leg * 4.5;
      ctx.beginPath();
      ctx.moveTo(lx, 12);
      ctx.lineTo(lx - 1.5, 15);
      ctx.lineTo(lx - 0.5, 17.5);
      ctx.stroke();
    }
    const body = new Path2D();
    body.moveTo(3, 11);
    body.bezierCurveTo(4, 6, 10, 4.5, 15, 5.5);
    body.bezierCurveTo(19, 4, 22, 6.5, 21.5, 9.5);
    body.bezierCurveTo(21, 12.5, 16, 14, 10, 13.5);
    body.bezierCurveTo(6, 13.5, 3.5, 12.5, 3, 11);
    moldBody(ctx, body, 2, 4, 20, 10, shade(C.boneDim, 0.72), shade(C.bone, 0.95), shade(C.boneDim, 0.4), C.flame, INK);
    // bristle tufts along the back
    ctx.strokeStyle = shade(C.boneDim, 0.5, 0.8);
    ctx.lineWidth = 0.7;
    for (let b = 0; b < 5; b++) {
      const bx = 6 + b * 3;
      ctx.beginPath();
      ctx.moveTo(bx, 6);
      ctx.lineTo(bx - 1, 3.6);
      ctx.stroke();
    }
    // the stolen key, clutched under the chin
    ctx.strokeStyle = shade(C.goldInk, 1.2);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(19, 12.5, 1.6, 0, Math.PI * 2);
    ctx.moveTo(20.5, 12.5);
    ctx.lineTo(23.5, 12.5);
    ctx.moveTo(22.5, 12.5);
    ctx.lineTo(22.5, 14);
    ctx.stroke();
    // bright thief eye
    ctx.fillStyle = shade(C.flameHi, 1.05);
    ctx.beginPath();
    ctx.arc(19.5, 7.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.void, 1);
    ctx.beginPath();
    ctx.arc(19.9, 7.7, 0.5, 0, Math.PI * 2);
    ctx.fill();
    hiEnd(rustling);
  }

  // The Lantern-Keeper: tall warden, lantern held out into the dark
  const keeper = T.createCanvas(`iso-ent-${EntityKind.KEEPER}`, 40, 74);
  if (keeper !== null) {
    const ctx = hiBegin(keeper);
    const robe = new Path2D();
    robe.moveTo(19, 3);
    robe.bezierCurveTo(27, 6, 29, 18, 28, 34);
    robe.bezierCurveTo(30, 48, 31, 60, 30, 68);
    robe.bezierCurveTo(22, 72, 13, 72, 8, 68);
    robe.bezierCurveTo(7, 56, 9, 40, 10, 26);
    robe.bezierCurveTo(9, 12, 13, 5, 19, 3);
    moldBody(ctx, robe, 7, 3, 24, 69, shade(C.inkSoft, 1.0), shade(C.inkSoft, 1.5), shade(C.void, 1.35), C.flame, INK);
    ctx.save();
    ctx.clip(robe);
    // long liturgical folds
    ctx.strokeStyle = shade(C.void, 1.3, 0.5);
    ctx.lineWidth = 1.4;
    for (const [dx, sway] of [[-5, 2], [0, -1.5], [5.5, 1]] as const) {
      ctx.beginPath();
      ctx.moveTo(19 + dx, 26);
      ctx.quadraticCurveTo(19 + dx + sway, 46, 19 + dx * 1.25, 68);
      ctx.stroke();
    }
    // ragged hem
    ctx.strokeStyle = shade(C.void, 1.6, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, 68);
    for (let hx = 10; hx <= 30; hx += 3.4) ctx.lineTo(hx, 68 + (Math.floor(hx) % 2 === 0 ? 2.4 : 0.6));
    ctx.stroke();
    ctx.restore();
    // deep cowl — no face at all
    ctx.fillStyle = shade(C.void, 0.8);
    ctx.beginPath();
    ctx.ellipse(19.5, 11, 5.5, 6.5, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // cowl rim kissed by lantern-light
    ctx.strokeStyle = mix(C.inkSoft, C.flame, 0.5, 0.8);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(20, 11, 6.2, -0.6, 1.0);
    ctx.stroke();
    // arm out east, sleeve hanging
    ctx.strokeStyle = shade(C.inkSoft, 1.3);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(26, 30);
    ctx.quadraticCurveTo(31, 27, 34, 25);
    ctx.stroke();
    ctx.strokeStyle = shade(C.void, 1.4, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(29, 31);
    ctx.lineTo(32, 28);
    ctx.stroke();
    // the lantern: chain, iron cage, warm heart
    ctx.strokeStyle = shade(C.inkSoft, 1.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(34.5, 25.5);
    ctx.lineTo(36.5, 28);
    ctx.stroke();
    const lg3 = ctx.createRadialGradient(37, 33, 0.5, 37, 33, 11);
    lg3.addColorStop(0, shade(C.flameHi, 1.05, 0.95));
    lg3.addColorStop(0.45, shade(C.flame, 1, 0.5));
    lg3.addColorStop(1, shade(C.flame, 1, 0));
    ctx.fillStyle = lg3;
    ctx.fillRect(26, 22, 22, 22);
    // cage
    ctx.strokeStyle = shade(C.void, 2.2);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(33.5, 28.5);
    ctx.lineTo(40.5, 28.5);
    ctx.lineTo(40, 38);
    ctx.lineTo(34, 38);
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(35.8, 28.5);
    ctx.lineTo(35.9, 38);
    ctx.moveTo(38.2, 28.5);
    ctx.lineTo(38.1, 38);
    ctx.stroke();
    // tiny flame inside
    ctx.fillStyle = shade(C.flameHi, 1.05);
    ctx.beginPath();
    ctx.ellipse(37, 34, 1.2, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    hiEnd(keeper);
  }

  // A fallen delver: slumped cloak, a spent candle beside them
  const corpse = T.createCanvas(`iso-ent-${EntityKind.CORPSE}`, 40, 26);
  if (corpse !== null) {
    const ctx = hiBegin(corpse);
    contactShadow(ctx, 20, 23, 16, 4, 0.3);
    const heap = new Path2D();
    heap.moveTo(5, 22);
    heap.bezierCurveTo(7, 13, 13, 9, 19, 9.5);
    heap.bezierCurveTo(26, 8, 33, 12, 35, 17);
    heap.bezierCurveTo(36.5, 20, 35, 22.5, 32, 23);
    heap.bezierCurveTo(23, 24.5, 10, 24.5, 5, 22);
    moldBody(ctx, heap, 4, 8, 33, 17, shade(C.inkSoft, 0.85), shade(C.inkSoft, 1.25), shade(C.void, 1.25), C.flame, INK);
    ctx.save();
    ctx.clip(heap);
    // collapsed folds
    ctx.strokeStyle = shade(C.void, 1.25, 0.55);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(12, 12);
    ctx.quadraticCurveTo(15, 17, 13, 22);
    ctx.moveTo(21, 10);
    ctx.quadraticCurveTo(23, 16, 22, 22);
    ctx.moveTo(28, 13);
    ctx.quadraticCurveTo(30, 17, 29, 22);
    ctx.stroke();
    ctx.restore();
    // a pale hand slipped from the cloak
    ctx.fillStyle = mix(C.bone, C.void, 0.25);
    ctx.beginPath();
    ctx.ellipse(8.5, 21.5, 2.6, 1.3, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 1.3, 0.6);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(7, 21);
    ctx.lineTo(10.5, 21.8);
    ctx.stroke();
    // the spent candle beside them, wax pooled, wick dead
    ctx.fillStyle = shade(C.bone, 0.8);
    ctx.beginPath();
    ctx.ellipse(34, 22.5, 4, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    const cg = ctx.createLinearGradient(32, 15, 36, 15);
    cg.addColorStop(0, shade(C.parchmentAged, 0.95));
    cg.addColorStop(1, shade(C.parchmentAged, 0.6));
    ctx.fillStyle = cg;
    ctx.fillRect(32.4, 16, 3.2, 6.5);
    ctx.strokeStyle = shade(C.void, 1.5);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(34, 16);
    ctx.quadraticCurveTo(34.6, 14.8, 34.2, 14);
    ctx.stroke();
    // one last thread of smoke
    ctx.strokeStyle = shade(C.boneDim, 1.1, 0.35);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(34.2, 13.5);
    ctx.bezierCurveTo(33.4, 11.5, 35.2, 10, 34.4, 7.5);
    ctx.stroke();
    hiEnd(corpse);
  }

  // ── HUD item icons (28 px, woodcut-simple per 04 §2.4) ───────────────────
  const iconFlint = T.createCanvas("icon-flint", 28, 28);
  if (iconFlint !== null) {
    const ctx = hiBegin(iconFlint);
    // knapped flint: faceted, with strike sparks
    const g = ctx.createLinearGradient(4, 8, 22, 24);
    g.addColorStop(0, shade(C.boneDim, 1.3));
    g.addColorStop(1, shade(C.boneDim, 0.5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(5, 20);
    ctx.lineTo(13, 9);
    ctx.lineTo(22, 13);
    ctx.lineTo(18, 23);
    ctx.closePath();
    ctx.fill();
    // facet lines
    ctx.strokeStyle = shade(C.boneDim, 0.5, 0.7);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(13, 9);
    ctx.lineTo(14, 20);
    ctx.moveTo(22, 13);
    ctx.lineTo(14, 20);
    ctx.moveTo(5, 20);
    ctx.lineTo(14, 20);
    ctx.stroke();
    ctx.strokeStyle = shade(C.boneDim, 1.7, 0.8);
    ctx.beginPath();
    ctx.moveTo(5, 20);
    ctx.lineTo(13, 9);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(5, 20);
    ctx.lineTo(13, 9);
    ctx.lineTo(22, 13);
    ctx.lineTo(18, 23);
    ctx.closePath();
    ctx.stroke();
    // sparks
    ctx.strokeStyle = shade(C.flameHi, 1.05);
    ctx.lineWidth = 1.4;
    for (const [a, b] of [[-0.4, 0.2], [0.1, 0.7], [0.6, 1.2]] as const) {
      ctx.beginPath();
      ctx.moveTo(22 + Math.cos(a) * 2, 10 + Math.sin(a) * 2);
      ctx.lineTo(22 + Math.cos(b) * 6, 10 + Math.sin(b) * 6);
      ctx.stroke();
    }
    ctx.fillStyle = shade(C.flameHi, 1.1);
    ctx.fillRect(23.5, 8, 1.2, 1.2);
    hiEnd(iconFlint);
  }
  const iconSalt = T.createCanvas("icon-salt", 28, 28);
  if (iconSalt !== null) {
    const ctx = hiBegin(iconSalt);
    // drawstring pouch, spilling
    const g = ctx.createLinearGradient(0, 6, 0, 24);
    g.addColorStop(0, shade(C.parchmentAged, 1.08));
    g.addColorStop(1, shade(C.parchmentAged, 0.62));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(14, 7);
    ctx.bezierCurveTo(21, 9, 23, 14, 22, 21);
    ctx.bezierCurveTo(18, 24.5, 10, 24.5, 6, 21);
    ctx.bezierCurveTo(5, 14, 7, 9, 14, 7);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    // cinch + tie
    ctx.strokeStyle = shade(C.ink, 1.2, 0.85);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(10, 8.5);
    ctx.quadraticCurveTo(14, 10, 18, 8.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(13, 7.5);
    ctx.lineTo(11, 4.5);
    ctx.moveTo(15, 7.5);
    ctx.lineTo(17.5, 5);
    ctx.stroke();
    // gather folds
    ctx.strokeStyle = shade(C.ink, 1.4, 0.4);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(11, 10);
    ctx.quadraticCurveTo(10, 15, 10.5, 20);
    ctx.moveTo(17, 10);
    ctx.quadraticCurveTo(18, 15, 17.5, 20);
    ctx.stroke();
    // spilled grains, lit
    ctx.fillStyle = shade(C.parchment, 1.05);
    for (const [px, py] of [[9, 25.5], [13, 26], [17, 25.2], [21, 26], [24, 24.5]] as const) {
      ctx.fillRect(px, py, 1.5, 1.5);
    }
    hiEnd(iconSalt);
  }
  const iconChalk = T.createCanvas("icon-chalk", 28, 28);
  if (iconChalk !== null) {
    const ctx = hiBegin(iconChalk);
    ctx.save();
    ctx.translate(14, 13);
    ctx.rotate(-0.6);
    const g = ctx.createLinearGradient(-3, 0, 3, 0);
    g.addColorStop(0, shade(C.parchment, 1.06));
    g.addColorStop(1, shade(C.parchment, 0.7));
    ctx.fillStyle = g;
    ctx.fillRect(-3, -10, 6, 20);
    // worn tip
    ctx.fillStyle = shade(C.parchment, 0.88);
    ctx.beginPath();
    ctx.moveTo(-3, 10);
    ctx.lineTo(0, 12.5);
    ctx.lineTo(3, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, -10, 6, 20);
    // wear striations
    ctx.strokeStyle = shade(C.parchment, 0.65, 0.5);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-1, -9);
    ctx.lineTo(-1, 9);
    ctx.moveTo(1.4, -9);
    ctx.lineTo(1.4, 9);
    ctx.stroke();
    ctx.restore();
    // the drawn mark it leaves
    ctx.strokeStyle = shade(C.parchment, 1, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, 24);
    ctx.quadraticCurveTo(9, 22, 13, 21);
    ctx.stroke();
    hiEnd(iconChalk);
  }

  // ── Screen-space atmosphere ──────────────────────────────────────────────
  const vignette = T.createCanvas("uv-vignette", 480, 854);
  if (vignette !== null) {
    const ctx = hiBegin(vignette);
    const g = ctx.createRadialGradient(240, 400, 170, 240, 427, 560);
    g.addColorStop(0, shade(C.void, 1, 0));
    g.addColorStop(0.65, shade(C.void, 1, 0.28));
    g.addColorStop(1, shade(C.void, 1, 0.72));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 480, 854);
    hiEnd(vignette, false);
  }

  const grain = T.createCanvas("uv-grain", 128, 128);
  if (grain !== null) {
    const ctx = grain.getContext(); // putImageData ignores transforms — author at 1×
    const img = ctx.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(crand() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      // truly whisper-quiet: most pixels carry no grain at all
      img.data[i + 3] = crand() < 0.35 ? 7 : 0;
    }
    ctx.putImageData(img, 0, 0);
    grain.refresh();
  }
}

/** Ground tileset index; plain floors get positional variants. */
export function groundIndexFor(t: number, x: number, y: number): number {
  switch (t) {
    case Tile.VOID:
      return -1;
    case Tile.MOSS:
    case Tile.WEBBING:
    case Tile.ENTRY:
    case Tile.STAIRS_DOWN:
    case Tile.WALL:
    case Tile.WATER:
    case Tile.GLOWMOSS:
    case Tile.PLATE:
    case Tile.KEY_DROP:
      return t;
    default: {
      const v = (Math.imul(x, 31) + Math.imul(y, 17)) % FLOOR_VARIANTS;
      return v === 0 ? Tile.FLOOR : TILE_KINDS + v - 1;
    }
  }
}

/** Billboard texture for tall/standing things on a tile ('' = none). */
export function propTextureFor(t: number): string {
  switch (t) {
    case Tile.WALL:
      return "iso-wall";
    case Tile.INSCRIPTION:
      return "iso-inscription";
    case Tile.DOOR_CLOSED:
      return "iso-door-closed";
    case Tile.DOOR_STUCK:
      return "iso-door-stuck";
    case Tile.DOOR_OPEN:
      return "iso-door-open";
    case Tile.DOOR_IRON:
      return "iso-door-iron";
    case Tile.DOOR_HUNGER:
      return "iso-door-hunger";
    case Tile.DOOR_CHOIR:
      return "iso-door-choir";
    case Tile.DOOR_SIGIL:
      return "iso-door-sigil";
    case Tile.SEAL:
      return "iso-seal";
    case Tile.BRAZIER_UNLIT:
      return "iso-brazier";
    case Tile.BRAZIER_LIT:
      return "iso-brazier-lit";
    case Tile.WAYSTONE:
      return "iso-waystone";
    case Tile.CHEST:
      return "iso-chest";
    case Tile.ALTAR:
      return "iso-altar";
    case Tile.POOL:
      return "iso-pool";
    case Tile.FONT:
      return "iso-font";
    case Tile.WAX_DRIP:
      return "iso-wax-drip";
    case Tile.WAX_STUB:
      return "iso-wax-stub";
    case Tile.WAX_CAKE:
      return "iso-wax-cake";
    default:
      return "";
  }
}

/** Entity billboard textures; mimics wear the chest's face until revealed. */
export function entityTextureFor(kind: number, state = 0): string {
  if (kind === EntityKind.MIMIC) {
    return state === 2 ? "iso-mimic-revealed" : "iso-chest";
  }
  return `iso-ent-${kind}`;
}

/** True when this tile type is opaque-tall and can occlude the player. */
export function isWallishTile(t: number): boolean {
  return (
    t === Tile.WALL || t === Tile.INSCRIPTION || t === Tile.DOOR_CLOSED ||
    t === Tile.DOOR_STUCK || t === Tile.DOOR_IRON || t === Tile.DOOR_HUNGER ||
    t === Tile.DOOR_CHOIR || t === Tile.DOOR_SIGIL || t === Tile.SEAL
  );
}
