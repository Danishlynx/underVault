/**
 * Cellars deco set — "The Root Cellars": an abandoned larder the earth is
 * quietly reclaiming. Five bottom-anchored billboard props in the vault
 * woodcut style — flat confident shapes, 2–3 stop gradients, a thin INK
 * silhouette line, candle-key light from the RIGHT (warm edge right, cool
 * core left). Palette leans ochre/goldInk: toadstools gone gold, thrown
 * clay, burlap, root-wood, and one small rack of drying herbs. Everything
 * derives from COLOR_CSS via shade()/mix() (invariant 4: no image assets,
 * no foreign hex); crand() supplies cosmetic tilt only, never structure.
 */

import type Phaser from "phaser";
import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix, crand, crandSeed, hiBegin, hiEnd } from "../paint.js";

export const CELLAR_DECO_KEYS = [
  "deco-cellar-shrooms",
  "deco-cellar-urn",
  "deco-cellar-sack",
  "deco-cellar-roots",
  "deco-cellar-rack",
] as const;

export function buildCellarDecos(T: Phaser.Textures.TextureManager): void {
  if (T.exists(CELLAR_DECO_KEYS[0])) return;
  crandSeed(0xce11a2);
  const C = COLOR_CSS;
  const INK = shade(C.void, 0.7, 0.9); // the woodcut line

  // Soft contact shadow that seats every prop on its tile.
  const seat = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void => {
    ctx.fillStyle = shade(C.void, 0.6, 0.22);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // ── deco-cellar-shrooms: four toadstools, caps of aged gold ──────────────
  {
    const t = T.createCanvas("deco-cellar-shrooms", 32, 28);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 16, 25.5, 11, 3.2);
      const cap = mix(C.parchmentAged, C.goldInk, 0.55);
      const stem = mix(C.bone, C.parchment, 0.5);
      // fixed cluster: (x, height, cap rx, cap ry) — crand tilts only
      for (const [x, h, rx, ry] of [
        [13, 17, 6, 4.4],
        [21, 12, 5, 3.8],
        [7, 9, 4.2, 3.2],
        [26, 6.5, 3.2, 2.6],
      ] as const) {
        ctx.save();
        ctx.translate(x, 28);
        ctx.rotate((crand() - 0.5) * 0.14);
        const sw = rx * 0.42; // stem half-width follows the cap
        const sg = ctx.createLinearGradient(-sw, 0, sw, 0);
        sg.addColorStop(0, shade(stem, 0.66));
        sg.addColorStop(1, shade(stem, 1.06));
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(-sw - 0.5, 0);
        ctx.lineTo(-sw + 0.4, -h);
        ctx.lineTo(sw - 0.4, -h);
        ctx.lineTo(sw + 0.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // cap dome — cool core left, warm candle edge right
        const cg = ctx.createLinearGradient(-rx, 0, rx, 0);
        cg.addColorStop(0, shade(cap, 0.58));
        cg.addColorStop(0.55, shade(cap, 0.92));
        cg.addColorStop(1, shade(mix(cap, C.ember, 0.22), 1.22));
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(0, -h, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.stroke();
        // gill shadow tucked under the brim
        ctx.fillStyle = shade(cap, 0.4);
        ctx.beginPath();
        ctx.ellipse(0, -h + ry * 0.55, rx * 0.78, ry * 0.5, 0, 0, Math.PI);
        ctx.fill();
        ctx.restore();
      }
      hiEnd(t);
    }
  }

  // ── deco-cellar-urn: thrown clay, one confident crack, chipped lip ───────
  {
    const t = T.createCanvas("deco-cellar-urn", 30, 38);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 15, 35.5, 10, 3.4);
      const clay = mix(C.goldInk, C.inkSoft, 0.4);
      ctx.save();
      ctx.translate(15, 37);
      ctx.rotate((crand() - 0.5) * 0.05);
      ctx.translate(-15, -37);
      // belly swelling from a narrow foot, closing to the neck
      const body = (): void => {
        ctx.beginPath();
        ctx.moveTo(9.5, 8);
        ctx.bezierCurveTo(5.5, 12, 3.5, 16.5, 3.5, 22);
        ctx.bezierCurveTo(3.5, 29, 7, 34.5, 10, 37);
        ctx.lineTo(20, 37);
        ctx.bezierCurveTo(23, 34.5, 26.5, 29, 26.5, 22);
        ctx.bezierCurveTo(26.5, 16.5, 24.5, 12, 20.5, 8);
        ctx.closePath();
      };
      const g = ctx.createLinearGradient(3.5, 0, 26.5, 0);
      g.addColorStop(0, shade(clay, 0.5));
      g.addColorStop(0.5, shade(clay, 0.82));
      g.addColorStop(1, shade(mix(clay, C.ember, 0.22), 1.18));
      ctx.fillStyle = g;
      body();
      ctx.fill();
      // thrown-clay ridges
      ctx.strokeStyle = shade(clay, 0.55, 0.75);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(15, 13, 9, 2.2, 0, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(15, 28, 10.4, 2.6, 0, 0, Math.PI);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      body();
      ctx.stroke();
      // flared lip over a dark mouth
      const lipG = ctx.createLinearGradient(6.5, 0, 23.5, 0);
      lipG.addColorStop(0, shade(clay, 0.62));
      lipG.addColorStop(1, shade(mix(clay, C.ember, 0.18), 1.15));
      ctx.fillStyle = lipG;
      ctx.beginPath();
      ctx.ellipse(15, 7, 8.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = shade(C.void, 1.5);
      ctx.beginPath();
      ctx.ellipse(15, 7, 5.6, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // the chip knocked from the cool-side rim
      ctx.beginPath();
      ctx.moveTo(7.2, 6.2);
      ctx.lineTo(10.4, 5.6);
      ctx.lineTo(9.4, 8.4);
      ctx.closePath();
      ctx.fill();
      // one confident crack down the shoulder
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(21, 11.5);
      ctx.lineTo(19.2, 15.5);
      ctx.lineTo(20.8, 18.5);
      ctx.lineTo(18.6, 23.5);
      ctx.stroke();
      ctx.restore();
      hiEnd(t);
    }
  }

  // ── deco-cellar-sack: slumped burlap, neck flopped, grain seeping ────────
  {
    const t = T.createCanvas("deco-cellar-sack", 32, 28);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 16, 25.8, 12, 3.2);
      const burlap = C.parchmentAged;
      // body settled wide, shoulders sagging
      const body = (): void => {
        ctx.beginPath();
        ctx.moveTo(4, 27);
        ctx.bezierCurveTo(3.2, 19, 6, 12, 12, 10);
        ctx.quadraticCurveTo(15, 9.2, 18, 10.4);
        ctx.bezierCurveTo(24, 12, 27.6, 19, 28, 27);
        ctx.closePath();
      };
      const g = ctx.createLinearGradient(4, 0, 28, 0);
      g.addColorStop(0, shade(burlap, 0.5));
      g.addColorStop(0.55, shade(burlap, 0.78));
      g.addColorStop(1, shade(mix(burlap, C.ember, 0.16), 1.06));
      ctx.fillStyle = g;
      body();
      ctx.fill();
      // settle folds fanning from the neck
      ctx.strokeStyle = shade(C.ink, 1.3, 0.35);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(13.5, 11.5);
      ctx.quadraticCurveTo(10.5, 16, 9.5, 22);
      ctx.moveTo(16.5, 11.5);
      ctx.quadraticCurveTo(18.5, 16, 19.5, 22);
      ctx.moveTo(15, 12);
      ctx.quadraticCurveTo(14.2, 16, 13.6, 20);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      body();
      ctx.stroke();
      // cinched neck, flopped over toward the candle
      ctx.fillStyle = shade(burlap, 0.62);
      ctx.beginPath();
      ctx.moveTo(13, 10.4);
      ctx.bezierCurveTo(12.8, 7.4, 14.6, 5.6, 16.8, 6);
      ctx.bezierCurveTo(19.4, 6.5, 20.4, 8.4, 19, 9.8);
      ctx.bezierCurveTo(17.6, 9, 15.6, 9.4, 14.8, 10.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      // twine cinch
      ctx.strokeStyle = mix(C.goldInk, C.inkSoft, 0.3);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(13.2, 9.2);
      ctx.quadraticCurveTo(14.4, 10.2, 15.8, 9.6);
      ctx.stroke();
      // grain seeped from a worn seam, pooled at the warm side
      ctx.fillStyle = mix(C.parchment, C.goldInk, 0.35);
      ctx.beginPath();
      ctx.ellipse(25.5, 26.6, 3.4, 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(C.parchment, 1.02);
      for (const [gx, gy] of [
        [22.5, 26.8],
        [24.5, 25.9],
        [27, 26.6],
        [29.2, 26],
        [26, 25.2],
      ] as const) {
        ctx.fillRect(gx + (crand() - 0.5) * 0.8, gy + (crand() - 0.5) * 0.6, 1.2, 1.2);
      }
      hiEnd(t);
    }
  }

  // ── deco-cellar-roots: three arcs breaching the floor and diving back ────
  {
    const t = T.createCanvas("deco-cellar-roots", 40, 26);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 20, 24, 15, 2.8);
      const root = mix(C.inkSoft, C.goldInk, 0.4);
      const rootHi = shade(mix(root, C.ember, 0.2), 1.32, 0.9);
      const bodyG = ctx.createLinearGradient(2, 0, 38, 0);
      bodyG.addColorStop(0, shade(root, 0.62));
      bodyG.addColorStop(0.55, shade(root, 0.95));
      bodyG.addColorStop(1, shade(mix(root, C.ember, 0.18), 1.2));
      ctx.lineCap = "round";
      // fixed arcs: [x0,y0, c1x,c1y, c2x,c2y, x1,y1, girth]
      for (const [x0, y0, c1x, c1y, c2x, c2y, x1, y1, wgt] of [
        [4, 25.5, 8, 9, 22, 7.5, 27, 25, 4],
        [16, 25.5, 21, 13.5, 31, 11.5, 36, 24.5, 3.1],
        [8, 25.5, 11.5, 17.5, 16.5, 17.5, 19.5, 25, 2.3],
      ] as const) {
        const j = (crand() - 0.5) * 1.2; // cosmetic wobble on the crown only
        const arc = (): void => {
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.bezierCurveTo(c1x + j, c1y, c2x + j, c2y, x1, y1);
        };
        ctx.strokeStyle = INK;
        ctx.lineWidth = wgt + 1.7;
        arc();
        ctx.stroke();
        ctx.strokeStyle = bodyG;
        ctx.lineWidth = wgt;
        arc();
        ctx.stroke();
        // warm light along the upper-right of the crown
        ctx.save();
        ctx.translate(0.4, -wgt * 0.3);
        ctx.strokeStyle = rootHi;
        ctx.lineWidth = wgt * 0.38;
        arc();
        ctx.stroke();
        ctx.restore();
      }
      // one small fork off the big root
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(24.5, 13);
      ctx.quadraticCurveTo(28.5, 15.5, 30, 20);
      ctx.stroke();
      ctx.strokeStyle = bodyG;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(24.5, 13);
      ctx.quadraticCurveTo(28.5, 15.5, 30, 20);
      ctx.stroke();
      // heaved soil where each root enters or leaves the floor
      ctx.fillStyle = shade(C.surface2, 1.5);
      for (const [mx, mw] of [
        [4, 3.4],
        [27, 3.6],
        [16, 3],
        [36, 3.2],
        [8, 2.6],
        [19.5, 2.6],
      ] as const) {
        ctx.beginPath();
        ctx.ellipse(mx, 25.2, mw, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      hiEnd(t);
    }
  }

  // ── deco-cellar-rack: a drying frame, two herb bundles hung head-down ────
  {
    const t = T.createCanvas("deco-cellar-rack", 34, 44);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 17, 41.6, 12, 3);
      const wood = shade(C.parchmentAged, 0.55);
      ctx.save();
      ctx.translate(17, 42);
      ctx.rotate((crand() - 0.5) * 0.04);
      ctx.translate(-17, -42);
      // uprights, feet planted on the base line, leaning slightly inward
      const post = (bx: number, tx: number): void => {
        const pg = ctx.createLinearGradient(Math.min(bx, tx) - 1.5, 0, Math.max(bx, tx) + 1.5, 0);
        pg.addColorStop(0, shade(wood, 0.72));
        pg.addColorStop(1, shade(wood, 1.28));
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.moveTo(bx - 1.5, 42);
        ctx.lineTo(tx - 1.2, 8);
        ctx.lineTo(tx + 1.2, 8);
        ctx.lineTo(bx + 1.5, 42);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      };
      post(6.5, 8);
      post(27.5, 26);
      // stretcher keeping the frame honest
      ctx.fillStyle = shade(wood, 0.8);
      ctx.fillRect(7.5, 34, 19, 1.8);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(7.5, 34, 19, 1.8);
      // crossbar with proud ends, lit from above-right
      const barG = ctx.createLinearGradient(0, 7.4, 0, 10.4);
      barG.addColorStop(0, shade(wood, 1.25));
      barG.addColorStop(1, shade(wood, 0.68));
      ctx.fillStyle = barG;
      ctx.fillRect(4, 7.4, 26, 3);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 7.4, 26, 3);
      // two herb bundles drying stems-up
      for (const [bx, s] of [
        [12.5, 1],
        [21.5, 0.88],
      ] as const) {
        ctx.save();
        ctx.translate(bx, 10.4);
        ctx.rotate((crand() - 0.5) * 0.1);
        ctx.strokeStyle = shade(C.bone, 0.85);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 3.4);
        ctx.stroke();
        ctx.translate(0, 3.4);
        ctx.scale(s, s);
        const herb = C.verdigrisDim;
        const hg = ctx.createLinearGradient(-4.6, 0, 4.6, 0);
        hg.addColorStop(0, shade(herb, 0.6));
        hg.addColorStop(1, shade(mix(herb, C.verdigris, 0.35), 1.2));
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-4, 2.6, -4.8, 7.5, -3.4, 10.5);
        ctx.lineTo(-2.1, 13);
        ctx.lineTo(-1.2, 10.8);
        ctx.lineTo(0, 13.8);
        ctx.lineTo(1.2, 10.8);
        ctx.lineTo(2.1, 13);
        ctx.lineTo(3.4, 10.5);
        ctx.bezierCurveTo(4.8, 7.5, 4, 2.6, 0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        // stem and side veins
        ctx.strokeStyle = shade(herb, 0.45, 0.8);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, 1.6);
        ctx.lineTo(0, 10.5);
        ctx.moveTo(-0.2, 4);
        ctx.lineTo(-2.4, 7.5);
        ctx.moveTo(0.2, 4.6);
        ctx.lineTo(2.4, 8);
        ctx.stroke();
        // twine wraps at the tie
        ctx.strokeStyle = mix(C.goldInk, C.inkSoft, 0.25);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-1.5, 0.9);
        ctx.lineTo(1.5, 0.9);
        ctx.moveTo(-1.3, 1.9);
        ctx.lineTo(1.3, 1.9);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      hiEnd(t);
    }
  }
}
