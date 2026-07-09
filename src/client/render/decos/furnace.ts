/**
 * Furnace biome decos — the Glassblack Furnaces. A dead glassworks: the
 * fires went out an age ago but the heat never quite left the things it
 * touched. Charred iron, clinker heaps, standing shards of black glass,
 * coals that still hold one dim eye, and a crucible tipped mid-pour with
 * its gold frozen where it ran. Palette is char (ink/void/surface2) with
 * sparing ember accents; light is the delver's candle, warm from the
 * right, cool core to the left. Woodcut idiom per tilemap.ts: flat
 * confident shapes, 2–3 stop gradients, thin ink outline, no speckle.
 */

import type Phaser from "phaser";
import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix, crand, crandSeed, hiBegin, hiEnd } from "../paint.js";

export const FURNACE_DECO_KEYS = [
  "deco-furnace-anvil",
  "deco-furnace-slag",
  "deco-furnace-glass",
  "deco-furnace-coals",
  "deco-furnace-mold",
] as const;

export function buildFurnaceDecos(T: Phaser.Textures.TextureManager): void {
  if (T.exists(FURNACE_DECO_KEYS[0])) return;
  crandSeed(0xf42a5e);
  const C = COLOR_CSS;
  const INK = shade(C.void, 0.7, 0.9); // the woodcut line

  const deco = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void => {
    const t = T.createCanvas(key, w, h);
    if (t === null) return;
    const ctx = hiBegin(t);
    draw(ctx);
    hiEnd(t);
  };

  /** Soft contact shadow — seats a bottom-anchored prop on the ground. */
  const shadow = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a = 0.22): void => {
    const g = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, rx);
    g.addColorStop(0, shade(C.void, 0.15, a));
    g.addColorStop(1, shade(C.void, 0.15, 0));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /** Char-iron ramp: cool near-black left, faint ember warmth right. */
  const charRamp = (
    ctx: CanvasRenderingContext2D, x0: number, x1: number, base: string, warmth: number, lift = 1,
  ): CanvasGradient => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, shade(base, 0.5 * lift));
    g.addColorStop(0.55, shade(base, 0.85 * lift));
    g.addColorStop(1, shade(mix(base, C.ember, warmth), 1.15 * lift));
    return g;
  };

  // ── deco-furnace-anvil: squat anvil on a scorched stump ──────────────────
  deco("deco-furnace-anvil", 34, 28, (ctx) => {
    shadow(ctx, 17, 25.6, 12.5, 3.4);
    ctx.save();
    ctx.translate(17, 28);
    ctx.rotate((crand() - 0.5) * 0.05);
    ctx.translate(-17, -28);
    // scorched stump pedestal
    ctx.fillStyle = charRamp(ctx, 8, 26, C.ink, 0.22);
    ctx.beginPath();
    ctx.moveTo(8, 21);
    ctx.lineTo(8.6, 28);
    ctx.lineTo(25.4, 28);
    ctx.lineTo(26, 21);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(C.ink, 0.42); // char-blackened top ring
    ctx.beginPath();
    ctx.ellipse(17, 21, 9, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 0.8, 0.8); // drying checks in the wood
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(12.5, 23.2);
    ctx.lineTo(12.1, 27.4);
    ctx.moveTo(21.6, 23.6);
    ctx.lineTo(22, 27.6);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, 21);
    ctx.lineTo(8.6, 28);
    ctx.moveTo(26, 21);
    ctx.lineTo(25.4, 28);
    ctx.stroke();
    // anvil foot flare
    ctx.fillStyle = charRamp(ctx, 9.4, 24.6, C.surface2, 0.24, 1.1);
    ctx.beginPath();
    ctx.moveTo(11, 18.2);
    ctx.lineTo(23, 18.2);
    ctx.lineTo(24.6, 21.6);
    ctx.lineTo(9.4, 21.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();
    // waisted throat
    ctx.fillStyle = charRamp(ctx, 12, 22, C.surface2, 0.24, 1.1);
    ctx.beginPath();
    ctx.moveTo(13, 11.8);
    ctx.lineTo(21, 11.8);
    ctx.quadraticCurveTo(19.6, 15.2, 21.8, 18.4);
    ctx.lineTo(12.2, 18.4);
    ctx.quadraticCurveTo(14.4, 15.2, 13, 11.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // face slab with the horn out to the left
    ctx.fillStyle = charRamp(ctx, 3, 30, C.surface2, 0.28, 1.15);
    ctx.beginPath();
    ctx.moveTo(3, 9.4); // horn tip
    ctx.lineTo(8, 6.6);
    ctx.lineTo(29, 6.6); // working face
    ctx.lineTo(30, 8.6); // heel
    ctx.lineTo(28.6, 12);
    ctx.lineTo(8.8, 12);
    ctx.lineTo(7.2, 10.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // hardy hole, a square of true dark on the heel
    ctx.fillStyle = shade(C.void, 0.7);
    ctx.fillRect(24.6, 7.5, 1.6, 1.2);
    // worn top edge, polished by hammers, still warm to look at
    const worn = ctx.createLinearGradient(8, 0, 29, 0);
    worn.addColorStop(0, shade(C.ember, 0.9, 0.35));
    worn.addColorStop(1, mix(C.ember, C.flameHi, 0.55, 0.9));
    ctx.strokeStyle = worn;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(8.4, 6.7);
    ctx.lineTo(28.8, 6.7);
    ctx.stroke();
    ctx.restore();
  });

  // ── deco-furnace-slag: clinker heap, heat trapped in two cracks ──────────
  deco("deco-furnace-slag", 36, 24, (ctx) => {
    shadow(ctx, 18, 21.8, 14, 3.4);
    ctx.save();
    ctx.translate((crand() - 0.5) * 0.8, 0);
    const rim = [
      [2.5, 24], [5.5, 17.5], [9.5, 13.5], [13.5, 15.5], [17, 10.5],
      [22, 12.5], [26, 16], [30, 15], [33.5, 24],
    ] as const;
    const trace = (): void => {
      ctx.beginPath();
      let first = true;
      for (const [px, py] of rim) {
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
    };
    trace();
    ctx.closePath();
    ctx.fillStyle = charRamp(ctx, 2.5, 33.5, C.ink, 0.26, 0.9);
    ctx.fill();
    // seams dividing the lumps
    ctx.strokeStyle = shade(C.void, 0.8, 0.85);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(9.5, 13.5);
    ctx.lineTo(8.8, 24);
    ctx.moveTo(22, 12.5);
    ctx.lineTo(21.2, 24);
    ctx.moveTo(30, 15);
    ctx.lineTo(29.2, 19.5);
    ctx.stroke();
    // candle catches the right faces of the lumps
    ctx.strokeStyle = mix(C.ink, C.ember, 0.45, 0.65);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(17.6, 11.2);
    ctx.lineTo(21.4, 12.8);
    ctx.moveTo(30.4, 15.8);
    ctx.lineTo(33, 22);
    ctx.stroke();
    // two thin ember-glow cracks between the lumps
    const cracks = [
      [[13.6, 16.2], [12.9, 18.6], [13.8, 20.8], [13.1, 24]],
      [[26.2, 17], [27.2, 19.4], [26.4, 21.6], [27.3, 24]],
    ] as const;
    for (const crack of cracks) {
      ctx.beginPath();
      let first = true;
      for (const [px, py] of crack) {
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = shade(C.ember, 1, 0.3); // soft heat bloom
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.strokeStyle = shade(C.ember, 1.15, 0.9); // the live seam
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    trace(); // ink the silhouette (top edge only)
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  });

  // ── deco-furnace-glass: three black-glass shards standing in a drift ─────
  deco("deco-furnace-glass", 32, 30, (ctx) => {
    shadow(ctx, 16, 27.6, 12, 3.2);
    const shard = (
      pts: readonly (readonly [number, number])[], x0: number, x1: number,
      gloss: readonly [number, number, number, number],
    ): void => {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, shade(C.void, 1.35));
      g.addColorStop(0.6, shade(C.surface2, 1.05));
      g.addColorStop(1, shade(mix(C.surface2, C.ember, 0.12), 1.5));
      ctx.fillStyle = g;
      ctx.beginPath();
      let first = true;
      for (const [px, py] of pts) {
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
      // the one glossy thing in the vault: a specular line down the edge
      ctx.strokeStyle = shade(mix(C.bone, C.flameHi, 0.45), 1.15, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gloss[0], gloss[1]);
      ctx.lineTo(gloss[2], gloss[3]);
      ctx.stroke();
    };
    // tall shard behind, two leaners in front
    shard(
      [[13.5, 28], [14.8, 13], [13.9, 11], [16.8, 4], [19.2, 12.5], [18.3, 14.5], [19.9, 28]],
      13.5, 19.9, [16.9, 4.8, 19, 12.2],
    );
    ctx.strokeStyle = shade(mix(C.bone, C.flameHi, 0.45), 1.15, 0.4); // faint inner reflection
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(18.4, 15);
    ctx.lineTo(19.4, 26);
    ctx.stroke();
    shard(
      [[5.5, 29], [6.2, 17], [7.8, 10.5], [10.4, 16], [9.6, 20], [10.8, 29]],
      5.5, 10.8, [8, 11.2, 10.2, 15.8],
    );
    shard(
      [[20.8, 29], [23.2, 18], [25.6, 12], [27.4, 19], [26.6, 29]],
      20.8, 27.4, [25.7, 12.6, 27.1, 18.6],
    );
    // drift of glass fines banked around their feet
    ctx.fillStyle = charRamp(ctx, 2.5, 30, C.ink, 0.2, 0.85);
    ctx.beginPath();
    ctx.moveTo(2.5, 30);
    ctx.lineTo(6, 26.8);
    ctx.lineTo(11, 25.4);
    ctx.lineTo(16, 24.8);
    ctx.lineTo(22, 25.6);
    ctx.lineTo(27, 26.6);
    ctx.lineTo(30, 30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2.5, 30);
    ctx.lineTo(6, 26.8);
    ctx.lineTo(11, 25.4);
    ctx.lineTo(16, 24.8);
    ctx.lineTo(22, 25.6);
    ctx.lineTo(27, 26.6);
    ctx.lineTo(30, 30);
    ctx.stroke();
    // two chips catching light on the drift
    ctx.strokeStyle = shade(mix(C.bone, C.flameHi, 0.4), 1.05, 0.6);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(12.6, 26.6);
    ctx.lineTo(14, 26.2);
    ctx.moveTo(23.6, 27);
    ctx.lineTo(24.8, 27.4);
    ctx.stroke();
  });

  // ── deco-furnace-coals: faceted dead coals, one eye still open ───────────
  deco("deco-furnace-coals", 32, 18, (ctx) => {
    shadow(ctx, 16, 15.8, 12.5, 3, 0.2);
    ctx.save();
    ctx.translate((crand() - 0.5) * 0.6, 0);
    // pile silhouette
    ctx.fillStyle = charRamp(ctx, 3.5, 29.5, C.ink, 0.24, 0.8);
    ctx.beginPath();
    ctx.moveTo(3.5, 18);
    ctx.lineTo(6.5, 12.5);
    ctx.lineTo(11, 9.5);
    ctx.lineTo(16.5, 8);
    ctx.lineTo(21.5, 10);
    ctx.lineTo(26.5, 12.5);
    ctx.lineTo(29.5, 18);
    ctx.closePath();
    ctx.fill();
    // individual lumps, each a flat facet with a warm right face
    const lumps = [
      [[5.5, 17.5], [6.8, 13.4], [10, 12], [12, 14.5], [11.2, 17.5]],
      [[10.5, 13], [12.6, 9.8], [16, 9], [17.4, 12], [15.2, 14.6], [11.8, 14.8]],
      [[16, 15.8], [17.6, 12.6], [20.6, 11.4], [23, 13.6], [22, 17.5], [17, 17.5]],
      [[22.5, 12.2], [25.4, 11.6], [27.6, 14], [26.8, 17.5], [23, 17.5]],
      [[12, 17.6], [13, 15.2], [16, 14.8], [17, 17.6]],
    ] as const;
    let li = 0;
    for (const lump of lumps) {
      let x0 = 32;
      let x1 = 0;
      for (const [px] of lump) {
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
      }
      ctx.fillStyle = charRamp(ctx, x0, x1, C.ink, 0.22 + (li % 2) * 0.08, 0.9 + (li % 3) * 0.12);
      ctx.beginPath();
      let first = true;
      for (const [px, py] of lump) {
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(C.void, 0.85, 0.9);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      li++;
    }
    // one faint ember eye, low in a seam between coals
    const eye = ctx.createRadialGradient(17.6, 12.6, 0.2, 17.6, 12.6, 2.4);
    eye.addColorStop(0, mix(C.flame, C.ember, 0.35, 0.8));
    eye.addColorStop(0.45, shade(C.ember, 1, 0.45));
    eye.addColorStop(1, shade(C.ember, 1, 0));
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(17.6, 12.6, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(C.flame, C.flameHi, 0.4, 0.85);
    ctx.beginPath();
    ctx.arc(17.6, 12.6, 0.55, 0, Math.PI * 2);
    ctx.fill();
    // ink the pile rim
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(3.5, 18);
    ctx.lineTo(6.5, 12.5);
    ctx.lineTo(11, 9.5);
    ctx.lineTo(16.5, 8);
    ctx.lineTo(21.5, 10);
    ctx.lineTo(26.5, 12.5);
    ctx.lineTo(29.5, 18);
    ctx.stroke();
    ctx.restore();
  });

  // ── deco-furnace-mold: tipped crucible, its last pour frozen gold ────────
  deco("deco-furnace-mold", 30, 30, (ctx) => {
    shadow(ctx, 15, 27.6, 11.5, 3.4);
    // the puddle it never finished pouring
    const pg = ctx.createLinearGradient(13.5, 0, 25.5, 0);
    pg.addColorStop(0, shade(mix(C.goldInk, C.ember, 0.35), 0.85));
    pg.addColorStop(0.6, shade(C.goldInk, 1.05));
    pg.addColorStop(1, shade(mix(C.goldInk, C.flameHi, 0.3), 1.1));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(19.5, 27.8, 6.2, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // the crucible, tipped onto its shoulder
    ctx.save();
    ctx.translate(12.5, 25.8);
    ctx.rotate(0.85 + (crand() - 0.5) * 0.08);
    const bg = ctx.createLinearGradient(-6, 0, 6, 0);
    bg.addColorStop(0, shade(C.surface2, 0.55));
    bg.addColorStop(0.55, shade(C.ink, 0.85));
    bg.addColorStop(1, shade(mix(C.ink, C.ember, 0.28), 1.1));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(-5.4, -6, -6, -14);
    ctx.lineTo(6, -14);
    ctx.quadraticCurveTo(5.4, -6, 4, 0);
    ctx.quadraticCurveTo(0, 2.2, -4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    // the crack that retired it
    ctx.strokeStyle = shade(C.void, 0.75, 0.95);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-2.2, -1);
    ctx.lineTo(0.4, -4.4);
    ctx.lineTo(-0.8, -7);
    ctx.lineTo(1.8, -10.6);
    ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0.4, -4.4);
    ctx.lineTo(2.2, -5.2);
    ctx.stroke();
    ctx.strokeStyle = mix(C.goldInk, C.ember, 0.4, 0.75); // gold seeped into the seam
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-1.6, -1.8);
    ctx.lineTo(0.2, -4.2);
    ctx.stroke();
    // mouth: rim, dark throat, and the skin of gold left inside
    ctx.fillStyle = shade(C.ink, 1.15);
    ctx.beginPath();
    ctx.ellipse(0, -14, 6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = shade(C.void, 0.9);
    ctx.beginPath();
    ctx.ellipse(0, -14.05, 4.9, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(C.goldInk, C.ember, 0.45, 0.95);
    ctx.beginPath();
    ctx.ellipse(0.9, -13.7, 3.3, 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // the frozen runnel from lip to puddle
    const rg = ctx.createLinearGradient(26, 19, 23, 27);
    rg.addColorStop(0, mix(C.goldInk, C.ember, 0.4));
    rg.addColorStop(1, shade(C.goldInk, 1.1));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(25, 19.2);
    ctx.quadraticCurveTo(27.8, 22.6, 25.6, 25.2);
    ctx.lineTo(23.2, 27.6);
    ctx.lineTo(22.2, 26.6);
    ctx.quadraticCurveTo(25.2, 23.4, 23.6, 20.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.55, 0.85); // candle glint on the run
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(25.3, 19.6);
    ctx.quadraticCurveTo(27.4, 22.5, 25.4, 25);
    ctx.stroke();
    // glint along the puddle's lit rim
    ctx.beginPath();
    ctx.ellipse(19.5, 27.8, 6.2, 2, 0, -Math.PI * 0.35, Math.PI * 0.25);
    ctx.stroke();
  });
}
