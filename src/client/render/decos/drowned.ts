/**
 * Drowned Stacks deco set (render-only floor props): the library the water
 * took. Five bottom-anchored billboards in the biome's cold verdigris-stained
 * palette — a pile of swollen books, a collapsed half-shelf, a kelp tuft, a
 * barnacled rock, and a dead ship lantern on its side. Same woodcut idiom as
 * the tilemap.ts deco-* set: flat confident shapes, 2–3 stop gradients, thin
 * ink silhouette line, light from the right (warm edge right, cool core left).
 */

import type Phaser from "phaser";
import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix, crand, crandSeed, hiBegin, hiEnd } from "../paint.js";

export const DROWNED_DECO_KEYS = [
  "deco-drowned-books",
  "deco-drowned-shelf",
  "deco-drowned-kelp",
  "deco-drowned-rock",
  "deco-drowned-lantern",
] as const;

export function buildDrownedDecos(T: Phaser.Textures.TextureManager): void {
  if (T.exists(DROWNED_DECO_KEYS[0])) return;
  crandSeed(0xd407ed);
  const C = COLOR_CSS;
  const INK = shade(C.void, 0.7, 0.9); // the woodcut line

  // waterlogged shelving wood — parchment gone green in the flood
  const WOOD = mix(C.parchmentAged, C.verdigrisDim, 0.45);

  // soft contact shadow that seats every prop on the ground
  const seat = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry = 3.2): void => {
    ctx.fillStyle = shade(C.void, 0.5, 0.22);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // ── deco-drowned-books: a pile of five waterlogged books ─────────────────
  {
    const t = T.createCanvas(DROWNED_DECO_KEYS[0], 36, 24);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 18, 21.5, 13, 3);
      // one flat swollen book: covers bow outward, page block right (light
      // side), spine end drowned in verdigris on the left
      const flat = (x: number, y: number, w: number, h: number, base: string, rot: number): void => {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(rot);
        const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
        g.addColorStop(0, mix(shade(base, 0.55), C.verdigrisDim, 0.35)); // cool core left
        g.addColorStop(0.55, shade(base, 0.72));
        g.addColorStop(1, shade(base, 0.95)); // warm edge right
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2 + 0.6);
        ctx.quadraticCurveTo(0, -h / 2 - 1.1, w / 2, -h / 2 + 0.6); // swollen top cover
        ctx.lineTo(w / 2, h / 2 - 0.6);
        ctx.quadraticCurveTo(0, h / 2 + 1.1, -w / 2, h / 2 - 0.6); // swollen bottom cover
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.stroke();
        // page block peeking out the right end, its lip gone green
        ctx.fillStyle = mix(C.parchment, C.verdigris, 0.22);
        ctx.fillRect(w / 2 - 2.2, -h / 2 + 1.3, 1.5, h - 2.6);
        // verdigris eating the spine end
        ctx.fillStyle = mix(base, C.verdigris, 0.55, 0.9);
        ctx.fillRect(-w / 2 + 0.4, -h / 2 + 0.9, 1.8, h - 1.8);
        ctx.restore();
      };
      // the stack, bottom to top, each a touch off-square
      flat(5, 18, 25, 4.8, C.parchmentAged, (crand() - 0.5) * 0.05);
      flat(7.5, 13.8, 21, 4.4, C.boneDim, (crand() - 0.5) * 0.07);
      flat(6.5, 9.8, 18, 4.2, C.parchmentAged, (crand() - 0.5) * 0.06);
      // the fourth leans against the pile's right flank
      {
        ctx.save();
        ctx.translate(28.6, 22.4);
        ctx.rotate(0.34 + (crand() - 0.5) * 0.04);
        const g = ctx.createLinearGradient(-2.1, 0, 2.1, 0);
        g.addColorStop(0, mix(shade(C.boneDim, 0.55), C.verdigrisDim, 0.4));
        g.addColorStop(1, shade(C.boneDim, 1.0));
        ctx.fillStyle = g;
        ctx.fillRect(-2.1, -12.5, 4.2, 12.5);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.strokeRect(-2.1, -12.5, 4.2, 12.5);
        // verdigris crept up from the tail that sat in the water
        ctx.fillStyle = mix(C.boneDim, C.verdigris, 0.55, 0.9);
        ctx.fillRect(-2.1, -3.2, 4.2, 3.2);
        ctx.restore();
      }
      // the fifth fell open-side-down in front
      flat(2.5, 19.6, 12, 3.6, C.boneDim, -0.06 + (crand() - 0.5) * 0.03);
      hiEnd(t);
    }
  }

  // ── deco-drowned-shelf: a collapsed half-shelf, leaning, books spilled ───
  {
    const t = T.createCanvas(DROWNED_DECO_KEYS[1], 40, 48);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 20, 44.5, 15, 3.4);
      ctx.save();
      ctx.translate(20, 46);
      ctx.rotate(-0.13 + (crand() - 0.5) * 0.03); // the whole case lists left
      // the dark of the case behind everything
      ctx.fillStyle = shade(C.surface, 0.8);
      ctx.fillRect(-10.5, -35.5, 21, 33);
      // books still shelved — upper compartment (three standing, one tilted)
      const spine = (x: number, y: number, w: number, h: number, col: string, rot: number): void => {
        ctx.save();
        ctx.translate(x + w / 2, y + h);
        ctx.rotate(rot);
        const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
        g.addColorStop(0, shade(col, 0.6));
        g.addColorStop(1, shade(col, 1.05));
        ctx.fillStyle = g;
        ctx.fillRect(-w / 2, -h, w, h);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.9;
        ctx.strokeRect(-w / 2, -h, w, h);
        // top edge gone green where the water stood
        ctx.fillStyle = mix(col, C.verdigris, 0.5, 0.85);
        ctx.fillRect(-w / 2, -h, w, 1.6);
        ctx.restore();
      };
      spine(-8.5, -33, 3.6, 8, mix(C.boneDim, C.verdigris, 0.3), 0);
      spine(-4.6, -33.4, 3.2, 8.4, mix(C.seal, C.verdigrisDim, 0.45), 0);
      spine(-0.5, -32.6, 3.4, 7.6, shade(C.parchmentAged, 0.62), 0.16);
      // mid compartment: one leaning, one fallen flat on the shelf
      spine(2.4, -21.8, 3.4, 7.8, mix(C.boneDim, C.verdigris, 0.35), 0.3);
      spine(-8.8, -17.4, 9, 3.2, shade(C.parchmentAged, 0.58), 0);
      // frame over the books: uprights, top board, two shelves
      const wg = ctx.createLinearGradient(-12, 0, 12, 0);
      wg.addColorStop(0, shade(WOOD, 0.5)); // cool core left
      wg.addColorStop(0.6, shade(WOOD, 0.72));
      wg.addColorStop(1, shade(WOOD, 1.02)); // warm edge right
      ctx.fillStyle = wg;
      ctx.fillRect(9, -37, 3, 37); // right upright, still bearing the load
      ctx.fillRect(-12, -37, 3, 30); // left upright, snapped short
      ctx.fillRect(-12, -37, 24, 3); // top board
      ctx.fillRect(-10.5, -14, 21, 2.4); // lower shelf
      ctx.fillRect(-10.5, -25, 21, 2.4); // upper shelf
      // the splintered break at the left upright's foot
      ctx.fillStyle = shade(WOOD, 0.5);
      ctx.beginPath();
      ctx.moveTo(-12, -7);
      ctx.lineTo(-10.9, -4.2);
      ctx.lineTo(-9.9, -6.4);
      ctx.lineTo(-9, -4.8);
      ctx.lineTo(-9, -7);
      ctx.closePath();
      ctx.fill();
      // ink over the frame
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.strokeRect(9, -37, 3, 37);
      ctx.strokeRect(-12, -37, 24, 3);
      ctx.beginPath();
      ctx.moveTo(-12, -34);
      ctx.lineTo(-12, -7);
      ctx.lineTo(-10.9, -4.2);
      ctx.lineTo(-9.9, -6.4);
      ctx.lineTo(-9, -4.8);
      ctx.lineTo(-9, -34);
      ctx.stroke();
      for (const sy of [-14, -25] as const) {
        ctx.beginPath();
        ctx.moveTo(-10.5, sy);
        ctx.lineTo(10.5, sy);
        ctx.moveTo(-10.5, sy + 2.4);
        ctx.lineTo(10.5, sy + 2.4);
        ctx.stroke();
      }
      // verdigris tide stain across the lower case
      ctx.fillStyle = mix(WOOD, C.verdigris, 0.5, 0.35);
      ctx.fillRect(-12, -9, 24, 9);
      ctx.restore();
      // spilled books at the foot — one props the lifted right corner
      const spill = (x: number, y: number, w: number, h: number, col: string, rot: number): void => {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(rot);
        const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
        g.addColorStop(0, mix(shade(col, 0.55), C.verdigrisDim, 0.35));
        g.addColorStop(1, shade(col, 0.92));
        ctx.fillStyle = g;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.9;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = mix(C.parchment, C.verdigris, 0.25);
        ctx.fillRect(w / 2 - 1.8, -h / 2 + 1, 1.2, h - 2);
        ctx.restore();
      };
      spill(25, 44.2, 11, 3.4, C.parchmentAged, 0.05 + (crand() - 0.5) * 0.04);
      spill(3.5, 43.6, 10, 3.2, C.boneDim, -0.12 + (crand() - 0.5) * 0.04);
      spill(8, 40.2, 9, 3, mix(C.seal, C.verdigrisDim, 0.5), 0.08);
      hiEnd(t);
    }
  }

  // ── deco-drowned-kelp: three ribbons all swaying the same way ────────────
  {
    const t = T.createCanvas(DROWNED_DECO_KEYS[2], 26, 40);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 13, 37, 8, 2.8);
      // a tapered ribbon: two bezier edges pinched to a tip, midrib, ink edge
      const ribbon = (
        bx: number, tipX: number, tipY: number,
        c1x: number, c1y: number, c2x: number, c2y: number,
        w0: number, tone: number,
      ): void => {
        const col = mix(C.verdigrisDim, C.verdigris, tone);
        const g = ctx.createLinearGradient(0, 38.5, 0, tipY);
        g.addColorStop(0, shade(col, 0.6)); // rooted in the dark
        g.addColorStop(1, shade(col, 1.08)); // pale toward the tip
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx - w0, 38.5);
        ctx.bezierCurveTo(c1x - w0 * 0.8, c1y, c2x - w0 * 0.45, c2y, tipX, tipY);
        ctx.bezierCurveTo(c2x + w0 * 0.45, c2y, c1x + w0 * 0.8, c1y, bx + w0, 38.5);
        ctx.closePath();
        ctx.fill();
        // midrib
        ctx.strokeStyle = shade(col, 0.45, 0.55);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(bx, 38.5);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tipX, tipY);
        ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(bx - w0, 38.5);
        ctx.bezierCurveTo(c1x - w0 * 0.8, c1y, c2x - w0 * 0.45, c2y, tipX, tipY);
        ctx.bezierCurveTo(c2x + w0 * 0.45, c2y, c1x + w0 * 0.8, c1y, bx + w0, 38.5);
        ctx.closePath();
        ctx.stroke();
      };
      const sway = (crand() - 0.5) * 1.4; // the whole tuft leans together
      ribbon(11, 20.5 + sway, 4.5, 7.5, 27, 17 + sway, 12, 2.2, 0.3); // back, tallest
      ribbon(15, 23.5 + sway, 11, 12.5, 29, 21.5 + sway, 18, 2.0, 0.55); // mid
      ribbon(8.5, 16.5 + sway, 17, 5.5, 30, 13 + sway, 22, 1.8, 0.8); // front, brightest
      // the holdfast gripping the floor
      ctx.fillStyle = mix(C.surface2, C.verdigrisDim, 0.45);
      ctx.beginPath();
      ctx.ellipse(12.5, 38.3, 5.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      hiEnd(t);
    }
  }

  // ── deco-drowned-rock: a barnacled boulder with a tide line ──────────────
  {
    const t = T.createCanvas(DROWNED_DECO_KEYS[3], 32, 24);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 16, 21.5, 12, 3);
      const g = ctx.createLinearGradient(3, 0, 29, 0);
      g.addColorStop(0, shade(mix(C.surface2, C.verdigrisDim, 0.28), 0.85)); // cool core left
      g.addColorStop(0.55, shade(C.surface2, 1.5));
      g.addColorStop(1, mix(shade(C.surface2, 2.1), C.boneDim, 0.3)); // warm edge right
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(4, 21);
      ctx.lineTo(3, 13.5);
      ctx.lineTo(8.5, 7.5);
      ctx.lineTo(17, 5.5);
      ctx.lineTo(25, 8);
      ctx.lineTo(28.5, 14.5);
      ctx.lineTo(27, 21);
      ctx.closePath();
      ctx.fill();
      // where the water used to stand
      ctx.fillStyle = mix(C.surface2, C.verdigris, 0.4, 0.4);
      ctx.beginPath();
      ctx.moveTo(3.6, 16.5);
      ctx.quadraticCurveTo(16, 14.2, 28.2, 16.8);
      ctx.lineTo(27, 21);
      ctx.lineTo(4, 21);
      ctx.closePath();
      ctx.fill();
      // one facet crease keeps it a boulder, not a blob
      ctx.strokeStyle = shade(C.void, 1.3, 0.5);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(17, 5.5);
      ctx.lineTo(13.5, 13);
      ctx.lineTo(14.5, 21);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(4, 21);
      ctx.lineTo(3, 13.5);
      ctx.lineTo(8.5, 7.5);
      ctx.lineTo(17, 5.5);
      ctx.lineTo(25, 8);
      ctx.lineTo(28.5, 14.5);
      ctx.lineTo(27, 21);
      ctx.closePath();
      ctx.stroke();
      // barnacles: large deliberate rings, clustered toward the light
      const barn = (x: number, y: number, r: number): void => {
        const bx = x + (crand() - 0.5) * 0.8;
        const by = y + (crand() - 0.5) * 0.8;
        ctx.fillStyle = shade(C.bone, 0.95);
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = shade(C.void, 1.2, 0.8);
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = mix(C.surface2, C.bone, 0.25); // the dark throat
        ctx.beginPath();
        ctx.arc(bx - r * 0.15, by + r * 0.1, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
      };
      barn(20.5, 9.5, 2.4);
      barn(24, 13, 2.0);
      barn(17.5, 13.8, 1.7);
      barn(11.5, 10.8, 2.1);
      barn(24.8, 17.5, 1.5);
      hiEnd(t);
    }
  }

  // ── deco-drowned-lantern: a dead ship lantern on its side ────────────────
  {
    const t = T.createCanvas(DROWNED_DECO_KEYS[4], 30, 22);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 15, 19.8, 11, 2.5);
      ctx.save();
      ctx.translate(13.5, 21);
      ctx.rotate((crand() - 0.5) * 0.05); // settled slightly askew
      // dark glass — the flame long gone
      const gg = ctx.createLinearGradient(-8, 0, 6.5, 0);
      gg.addColorStop(0, shade(C.void, 1.5));
      gg.addColorStop(1, mix(shade(C.void, 2.2), C.verdigrisDim, 0.35)); // cold reflection right
      ctx.fillStyle = gg;
      ctx.fillRect(-8, -9.2, 14.5, 8.4);
      // one thin glint across the pane
      ctx.strokeStyle = shade(C.boneDim, 1.3, 0.3);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-3.2, -8.6);
      ctx.lineTo(0.6, -1.6);
      ctx.stroke();
      // iron frame: rails, mid strap, end caps — boneDim, lit from the right
      const fg = ctx.createLinearGradient(-11.5, 0, 9.5, 0);
      fg.addColorStop(0, shade(C.boneDim, 0.55));
      fg.addColorStop(0.6, shade(C.boneDim, 0.8));
      fg.addColorStop(1, shade(C.boneDim, 1.15));
      ctx.fillStyle = fg;
      ctx.fillRect(-9, -10.4, 16.5, 1.6); // upper rail (was a side, now the top)
      ctx.fillRect(-9, -1.6, 16.5, 1.6); // lower rail, in the ground's grip
      ctx.fillRect(-2.2, -10, 2, 9.4); // mid strap
      ctx.fillRect(-11.5, -10.8, 3.2, 10.6); // base disc, now a wall
      ctx.fillRect(6, -10.8, 3.2, 10.6); // collar at the chimney end
      // chimney dome pointing along the ground, and the hanging ring
      ctx.beginPath();
      ctx.arc(9.2, -5.5, 2.8, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(C.boneDim, 0.75);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(13.2, -5.5, 1.8, 0, Math.PI * 2);
      ctx.stroke();
      // ink around the ironwork
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.strokeRect(-11.5, -10.8, 3.2, 10.6);
      ctx.strokeRect(6, -10.8, 3.2, 10.6);
      ctx.beginPath();
      ctx.moveTo(-8.3, -10.4);
      ctx.lineTo(6, -10.4);
      ctx.moveTo(-8.3, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(9.2, -5.5, 2.8, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      // verdigris corrosion blooming on the iron
      ctx.fillStyle = mix(C.boneDim, C.verdigris, 0.7, 0.9);
      ctx.beginPath();
      ctx.ellipse(-10, -2.6, 1.6, 2.2, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-1.2, -1, 2.4, 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(7.4, -9.6, 1.4, 1, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      hiEnd(t);
    }
  }
}
