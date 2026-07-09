/**
 * Deco set — "The Hollow Choir" (biome: Choir). A cathedral level in pale
 * carved limestone, everything abandoned mid-ceremony: a sheared column
 * stump, a bell fallen from its yoke, an empty lectern, a candelabrum
 * knocked to the floor with its candles rolled loose, and a hymn tablet
 * leaning where the singers left it. Woodcut style per tilemap.ts decos:
 * flat confident shapes, 2–3 stop gradients, thin ink outline, light from
 * the right. Bottom-anchored billboards (base on canvas bottom edge).
 */

import type Phaser from "phaser";
import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix, crand, crandSeed, hiBegin, hiEnd } from "../paint.js";

export const CHOIR_DECO_KEYS = [
  "deco-choir-column",
  "deco-choir-bell",
  "deco-choir-lectern",
  "deco-choir-candelabrum",
  "deco-choir-tablet",
] as const;

export function buildChoirDecos(T: Phaser.Textures.TextureManager): void {
  if (T.exists(CHOIR_DECO_KEYS[0])) return;
  crandSeed(0xc4014e);
  const C = COLOR_CSS;
  const INK = shade(C.void, 0.7, 0.9); // the woodcut line
  const STONE = mix(C.bone, C.parchment, 0.28); // pale carved limestone
  const BRONZE = mix(C.goldInk, C.boneDim, 0.35); // bell metal, aged toward bone
  const GOLD = mix(C.goldInk, C.boneDim, 0.18); // candelabrum frame, less weathered

  // soft contact shadow that seats every prop on the ground
  const seat = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void => {
    ctx.fillStyle = shade(C.void, 0.6, 0.22);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // ── broken fluted column stump ─────────────────────────────────────────
  {
    const t = T.createCanvas("deco-choir-column", 34, 44);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 17, 40.5, 13, 3.6);
      // plinth block
      const pg = ctx.createLinearGradient(5, 0, 29, 0);
      pg.addColorStop(0, shade(STONE, 0.5));
      pg.addColorStop(0.55, shade(STONE, 0.72));
      pg.addColorStop(1, shade(STONE, 0.98));
      ctx.fillStyle = pg;
      ctx.fillRect(5, 37.5, 24, 6.5);
      ctx.fillStyle = shade(STONE, 1.06);
      ctx.fillRect(4.4, 36, 25.2, 1.8);
      // shaft with a jagged sheared top
      const shaft = (): void => {
        ctx.beginPath();
        ctx.moveTo(9, 15);
        ctx.lineTo(11, 8);
        ctx.lineTo(14, 12);
        ctx.lineTo(17, 6);
        ctx.lineTo(20.5, 10.5);
        ctx.lineTo(23, 7.5);
        ctx.lineTo(25, 13);
        ctx.lineTo(25, 36);
        ctx.lineTo(9, 36);
        ctx.closePath();
      };
      const sg = ctx.createLinearGradient(9, 0, 25, 0);
      sg.addColorStop(0, shade(STONE, 0.55));
      sg.addColorStop(0.5, shade(STONE, 0.8));
      sg.addColorStop(1, shade(STONE, 1.06));
      ctx.fillStyle = sg;
      shaft();
      ctx.fill();
      // raw break: a lighter facet band just under the shear line
      ctx.fillStyle = shade(STONE, 1.16, 0.9);
      ctx.beginPath();
      ctx.moveTo(9, 15);
      ctx.lineTo(11, 8);
      ctx.lineTo(14, 12);
      ctx.lineTo(17, 6);
      ctx.lineTo(20.5, 10.5);
      ctx.lineTo(23, 7.5);
      ctx.lineTo(25, 13);
      ctx.lineTo(25, 15.5);
      ctx.lineTo(23, 10.2);
      ctx.lineTo(20.5, 13.2);
      ctx.lineTo(17, 9);
      ctx.lineTo(14, 14.6);
      ctx.lineTo(11, 10.8);
      ctx.lineTo(9, 17.4);
      ctx.closePath();
      ctx.fill();
      // three vertical flutes, groove dark with a lit right lip
      ctx.lineCap = "round";
      for (const [fx, fy] of [[12.5, 17], [17, 13.5], [21.5, 15]] as const) {
        ctx.strokeStyle = shade(STONE, 0.42, 0.9);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx, 34.5);
        ctx.stroke();
        ctx.strokeStyle = shade(STONE, 1.18, 0.8);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(fx + 1.3, fy + 1);
        ctx.lineTo(fx + 1.3, 34.5);
        ctx.stroke();
      }
      // ink
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      shaft();
      ctx.stroke();
      ctx.strokeRect(4.4, 36, 25.2, 8);
      hiEnd(t);
    }
  }

  // ── fallen bronze bell, on its side ────────────────────────────────────
  {
    const t = T.createCanvas("deco-choir-bell", 36, 30);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 17, 27.5, 13.5, 3.2);
      // body: crown left, mouth right
      const body = (): void => {
        ctx.beginPath();
        ctx.moveTo(25.5, 8);
        ctx.bezierCurveTo(17, 6.8, 11, 9.5, 9, 13);
        ctx.quadraticCurveTo(6.8, 17.6, 9, 21.6);
        ctx.bezierCurveTo(11, 25.4, 17, 27.8, 25.5, 27);
        ctx.ellipse(25.5, 17.5, 3.3, 9.5, 0, Math.PI / 2, -Math.PI / 2, true);
        ctx.closePath();
      };
      const bg = ctx.createLinearGradient(7, 0, 29, 0);
      bg.addColorStop(0, shade(BRONZE, 0.5));
      bg.addColorStop(0.55, shade(BRONZE, 0.85));
      bg.addColorStop(1, shade(BRONZE, 1.18));
      ctx.fillStyle = bg;
      body();
      ctx.fill();
      // cast hoop bands across the waist
      ctx.strokeStyle = shade(BRONZE, 0.45, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(13.5, 17.5, 1.6, 6.6, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(19.5, 17.5, 1.6, 8.2, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      // the crack that silenced it
      ctx.strokeStyle = shade(C.void, 1.3, 0.85);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(23.5, 23);
      ctx.lineTo(21, 20);
      ctx.lineTo(22.2, 17.6);
      ctx.lineTo(19.8, 14.8);
      ctx.stroke();
      // dark mouth with a lit rim
      ctx.fillStyle = shade(C.void, 1.5);
      ctx.beginPath();
      ctx.ellipse(25.5, 17.5, 2.2, 8.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(BRONZE, 1.35, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(25.5, 17.5, 3, 9, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      // crown loop, seen side-on
      ctx.fillStyle = shade(BRONZE, 0.65);
      ctx.beginPath();
      ctx.arc(6, 17.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(C.void, 1.2);
      ctx.beginPath();
      ctx.arc(5.7, 17.5, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(6, 17.5, 2.4, 0, Math.PI * 2);
      ctx.stroke();
      // clapper spilled out the mouth
      ctx.strokeStyle = shade(BRONZE, 0.6);
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(27.5, 24);
      ctx.lineTo(31.5, 26.2);
      ctx.stroke();
      ctx.fillStyle = shade(BRONZE, 0.9);
      ctx.beginPath();
      ctx.arc(32.6, 26.4, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(BRONZE, 1.4, 0.9);
      ctx.beginPath();
      ctx.arc(33.3, 25.8, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(32.6, 26.4, 2.3, 0, Math.PI * 2);
      ctx.stroke();
      body();
      ctx.stroke();
      hiEnd(t);
    }
  }

  // ── stone lectern, book-rest empty ─────────────────────────────────────
  {
    const t = T.createCanvas("deco-choir-lectern", 28, 42);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 14, 39.5, 10, 3.2);
      // foot block
      const fg = ctx.createLinearGradient(6.5, 0, 21.5, 0);
      fg.addColorStop(0, shade(STONE, 0.5));
      fg.addColorStop(1, shade(STONE, 0.95));
      ctx.fillStyle = fg;
      ctx.fillRect(6.5, 37, 15, 5);
      ctx.fillStyle = shade(STONE, 1.06);
      ctx.fillRect(5.8, 35.4, 16.4, 1.8);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.strokeRect(5.8, 35.4, 16.4, 6.6);
      // tapered stem
      const stem = (): void => {
        ctx.beginPath();
        ctx.moveTo(11, 35.4);
        ctx.lineTo(12, 19.8);
        ctx.lineTo(16.6, 19.8);
        ctx.lineTo(17.6, 35.4);
        ctx.closePath();
      };
      const sg = ctx.createLinearGradient(11, 0, 17.6, 0);
      sg.addColorStop(0, shade(STONE, 0.52));
      sg.addColorStop(1, shade(STONE, 1.02));
      ctx.fillStyle = sg;
      stem();
      ctx.fill();
      ctx.strokeStyle = shade(STONE, 0.45, 0.7);
      ctx.lineWidth = 0.9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(13.5, 22);
      ctx.lineTo(13.8, 34.2);
      ctx.moveTo(15.2, 22);
      ctx.lineTo(15.4, 34.2);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      stem();
      ctx.stroke();
      // collar under the desk
      ctx.fillStyle = shade(STONE, 0.88);
      ctx.fillRect(10, 18, 8.4, 2.6);
      ctx.strokeRect(10, 18, 8.4, 2.6);
      // slanted book-rest: top face + thickness strips
      const tg = ctx.createLinearGradient(4.5, 0, 23.5, 0);
      tg.addColorStop(0, shade(STONE, 0.85));
      tg.addColorStop(1, shade(STONE, 1.2));
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(4.5, 13.5);
      ctx.lineTo(19.5, 6.5);
      ctx.lineTo(23.5, 10.5);
      ctx.lineTo(8.5, 17.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(STONE, 0.55);
      ctx.beginPath();
      ctx.moveTo(8.5, 17.5);
      ctx.lineTo(23.5, 10.5);
      ctx.lineTo(23.5, 13.2);
      ctx.lineTo(8.5, 20.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(STONE, 0.45);
      ctx.beginPath();
      ctx.moveTo(4.5, 13.5);
      ctx.lineTo(8.5, 17.5);
      ctx.lineTo(8.5, 20.2);
      ctx.lineTo(4.5, 16.2);
      ctx.closePath();
      ctx.fill();
      // the lip a hymnal would rest against
      ctx.strokeStyle = shade(STONE, 1.25, 0.95);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(9.3, 17.2);
      ctx.lineTo(22.8, 10.9);
      ctx.stroke();
      // ink around the whole desk silhouette
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(4.5, 13.5);
      ctx.lineTo(19.5, 6.5);
      ctx.lineTo(23.5, 10.5);
      ctx.lineTo(23.5, 13.2);
      ctx.lineTo(8.5, 20.2);
      ctx.lineTo(4.5, 16.2);
      ctx.closePath();
      ctx.stroke();
      hiEnd(t);
    }
  }

  // ── toppled three-arm candelabrum ──────────────────────────────────────
  {
    const t = T.createCanvas("deco-choir-candelabrum", 40, 26);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 20, 23.6, 15.5, 3);
      ctx.lineCap = "round";
      // gilded rod: dark underlay + lit top edge
      const rod = (draw: (c: CanvasRenderingContext2D) => void): void => {
        ctx.strokeStyle = shade(GOLD, 0.5);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        draw(ctx);
        ctx.stroke();
        ctx.save();
        ctx.translate(0.35, -0.55);
        ctx.strokeStyle = shade(GOLD, 1.15);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        draw(ctx);
        ctx.stroke();
        ctx.restore();
      };
      // base plate on its edge, left
      ctx.fillStyle = shade(GOLD, 0.7);
      ctx.beginPath();
      ctx.ellipse(7, 20.5, 2.3, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(GOLD, 1.2, 0.9);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(7, 20.5, 2.3, 4.6, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(7, 20.5, 2.3, 4.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      // main stem, nearly flat on the floor
      rod((c) => {
        c.moveTo(9, 20.2);
        c.lineTo(32, 16.5);
      });
      // three arms, flung in different directions
      rod((c) => {
        c.moveTo(15, 19.3);
        c.quadraticCurveTo(12, 13, 16, 10.8);
      });
      rod((c) => {
        c.moveTo(21, 18.4);
        c.quadraticCurveTo(24.5, 12.5, 27, 11.2);
      });
      rod((c) => {
        c.moveTo(26, 17.6);
        c.quadraticCurveTo(28, 22.5, 31.5, 22.8);
      });
      // finial knob at the stem head
      ctx.fillStyle = shade(GOLD, 0.85);
      ctx.beginPath();
      ctx.arc(32.8, 16.2, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
      // drip pans, sockets empty
      for (const [px, py] of [[16.4, 10.2], [27.5, 10.7], [32.4, 22.7]] as const) {
        ctx.fillStyle = shade(GOLD, 0.8);
        ctx.beginPath();
        ctx.ellipse(px, py, 2.4, 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = shade(GOLD, 1.3, 0.9);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.ellipse(px, py - 0.2, 2.2, 0.9, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = shade(C.void, 1.4);
        ctx.beginPath();
        ctx.ellipse(px, py, 0.9, 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // candles rolled loose, unlit — wax pale, wicks dead
      for (const [cx, cy, len, rot] of [
        [12.5, 23.8, 8, 0.22 + crand() * 0.1],
        [24.5, 24, 7, 0.04 + crand() * 0.08],
        [35, 22.6, 6, -0.18 + crand() * 0.08],
      ] as const) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        const wg = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
        wg.addColorStop(0, shade(C.parchment, 0.62));
        wg.addColorStop(1, shade(C.parchment, 0.95));
        ctx.fillStyle = wg;
        ctx.fillRect(-len / 2, -1.5, len, 3);
        ctx.fillStyle = shade(C.parchment, 1.02);
        ctx.beginPath();
        ctx.ellipse(len / 2, 0, 1, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = shade(C.void, 1.6);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(len / 2 + 0.6, 0);
        ctx.lineTo(len / 2 + 1.7, -0.5);
        ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.strokeRect(-len / 2, -1.5, len, 3);
        ctx.restore();
      }
      hiEnd(t);
    }
  }

  // ── leaning hymn tablet ────────────────────────────────────────────────
  {
    const t = T.createCanvas("deco-choir-tablet", 28, 36);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 14, 33.5, 10, 3.2);
      ctx.save();
      ctx.translate(14, 34);
      ctx.rotate(-0.1 + crand() * 0.06);
      // round-topped slab, one corner chipped
      const slab = (): void => {
        ctx.beginPath();
        ctx.moveTo(-6.2, 0);
        ctx.lineTo(-8.2, -2.6);
        ctx.lineTo(-8.2, -21);
        ctx.bezierCurveTo(-8.2, -26.5, -4.5, -29, 0, -29);
        ctx.bezierCurveTo(4.5, -29, 8.2, -26.5, 8.2, -21);
        ctx.lineTo(8.2, 0);
        ctx.closePath();
      };
      const g = ctx.createLinearGradient(-8.2, 0, 8.2, 0);
      g.addColorStop(0, shade(STONE, 0.58));
      g.addColorStop(0.55, shade(STONE, 0.82));
      g.addColorStop(1, shade(STONE, 1.1));
      ctx.fillStyle = g;
      slab();
      ctx.fill();
      // lit bevel on the right edge
      ctx.strokeStyle = shade(STONE, 1.22, 0.85);
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(7.1, -1.5);
      ctx.lineTo(7.1, -21.5);
      ctx.stroke();
      // four faint carved hymn lines, worn to dashes
      ctx.strokeStyle = shade(C.inkSoft, 1.05, 0.8);
      ctx.lineWidth = 1;
      for (const row of [-24.5, -20, -15.5, -11] as const) {
        let x = -5.4;
        ctx.beginPath();
        while (x < 4) {
          const len = 1.6 + crand() * 2.2;
          ctx.moveTo(x, row);
          ctx.lineTo(Math.min(x + len, 5.4), row);
          x += len + 1.1 + crand() * 0.7;
        }
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      slab();
      ctx.stroke();
      ctx.restore();
      hiEnd(t);
    }
  }
}
