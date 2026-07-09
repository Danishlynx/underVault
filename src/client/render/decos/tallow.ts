/**
 * Tallow Halls deco set — the wax-industry biome. Five bottom-anchored
 * billboard props drawn in the woodcut idiom (flat confident shapes, 2–3
 * stop gradients, thin ink silhouette, candle-light from the RIGHT): a
 * drip-built wax pillar with a dead wick, a slumped melt mound, a cluster
 * of spent votives, a render-barrel crusted with pale wax, and a hardened
 * puddle with two dead stubs. All color derives from COLOR_CSS via
 * shade()/mix(); crand() supplies cosmetic wobble only, never structure.
 */

import type Phaser from "phaser";
import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix, crand, crandSeed, hiBegin, hiEnd } from "../paint.js";

export const TALLOW_DECO_KEYS = [
  "deco-tallow-pillar",
  "deco-tallow-mound",
  "deco-tallow-votives",
  "deco-tallow-barrel",
  "deco-tallow-pool",
] as const;

export function buildTallowDecos(T: Phaser.Textures.TextureManager): void {
  if (T.exists(TALLOW_DECO_KEYS[0])) return;
  crandSeed(0x7a1101);
  const C = COLOR_CSS;
  const INK = shade(C.void, 0.7, 0.9); // the woodcut line

  // Soft contact shadow that seats every prop on its tile.
  const seat = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a = 0.22): void => {
    const g = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, rx);
    g.addColorStop(0, shade(C.void, 0, a));
    g.addColorStop(1, shade(C.void, 0, 0));
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

  // A dead wick: short charred curl above a sunken crater.
  const deadWick = (ctx: CanvasRenderingContext2D, x: number, y: number, s = 1): void => {
    ctx.fillStyle = shade(C.ink, 0.85);
    ctx.beginPath();
    ctx.ellipse(x, y, 2 * s, 0.9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 1.5);
    ctx.lineWidth = 1.1 * s;
    ctx.beginPath();
    ctx.moveTo(x, y - 0.2 * s);
    ctx.quadraticCurveTo(x + 0.9 * s, y - 1.8 * s, x + 0.2 * s, y - 3 * s);
    ctx.stroke();
  };

  // ── deco-tallow-pillar: a stalagmite of centuries of drips ───────────────
  {
    const t = T.createCanvas("deco-tallow-pillar", 34, 52);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 17, 48.5, 12, 3.5);
      // lumpy drip-built silhouette, wide foot to blunt crown
      const trunk = (): void => {
        ctx.beginPath();
        ctx.moveTo(6, 49);
        ctx.quadraticCurveTo(4.5, 44, 7.5, 41);
        ctx.quadraticCurveTo(5.8, 35.5, 9.5, 31.5);
        ctx.quadraticCurveTo(8.2, 25.5, 11.5, 20.5);
        ctx.quadraticCurveTo(10.8, 13.5, 14.5, 9);
        ctx.quadraticCurveTo(15.4, 6.4, 17.6, 6.2);
        ctx.quadraticCurveTo(20.4, 6.8, 21, 10);
        ctx.quadraticCurveTo(23.8, 14.5, 22.8, 20);
        ctx.quadraticCurveTo(26.4, 25.5, 24.8, 31);
        ctx.quadraticCurveTo(28.6, 36.5, 26.8, 42);
        ctx.quadraticCurveTo(29.8, 45.5, 28, 49);
        ctx.closePath();
      };
      const g = ctx.createLinearGradient(5, 0, 29, 0);
      g.addColorStop(0, shade(C.parchmentAged, 0.52));
      g.addColorStop(0.55, shade(C.parchmentAged, 0.82));
      g.addColorStop(1, shade(C.parchment, 1.0));
      ctx.fillStyle = g;
      trunk();
      ctx.fill();
      ctx.save();
      trunk();
      ctx.clip();
      // faint inner warmth near the crown — wax remembering its flame
      const warm = ctx.createRadialGradient(17.5, 12, 1, 17.5, 12, 12);
      warm.addColorStop(0, mix(C.parchment, C.flame, 0.5, 0.4));
      warm.addColorStop(1, mix(C.parchment, C.flame, 0.5, 0));
      ctx.fillStyle = warm;
      ctx.fillRect(5, 2, 26, 22);
      // shadowed drip grooves on the cool (left) flank
      ctx.strokeStyle = shade(C.parchmentAged, 0.42, 0.5);
      ctx.lineWidth = 0.9;
      for (const [x0, y0, y1] of [[10.5, 14, 30], [8.5, 26, 44], [12.5, 33, 47]] as const) {
        const wob = (crand() - 0.5) * 1.2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 - 1.2 + wob, (y0 + y1) / 2, x0 + 0.6, y1);
        ctx.stroke();
      }
      // candle-kissed run down the east edge
      ctx.strokeStyle = shade(C.parchment, 1.08, 0.65);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(20.4, 10.5);
      ctx.quadraticCurveTo(22.6, 22, 24, 32);
      ctx.quadraticCurveTo(25.6, 40, 26.4, 46.5);
      ctx.stroke();
      // shoulder rims where each century of wax stalled
      ctx.strokeStyle = shade(C.parchmentAged, 0.62, 0.55);
      ctx.lineWidth = 0.8;
      for (const [sx, sy, ex] of [[9.8, 31.5, 24.6], [7.8, 41, 26.6]] as const) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(17, sy + 2.4, ex, sy - 0.5);
        ctx.stroke();
      }
      ctx.restore();
      // drip tongues pooled over the foot
      for (const [dx, dw, dh, f] of [[9, 2, 2.8, 0.68], [15.5, 1.8, 3.4, 0.86], [23.5, 2.2, 3, 0.95]] as const) {
        ctx.fillStyle = shade(C.parchmentAged, f);
        ctx.beginPath();
        ctx.ellipse(dx + (crand() - 0.5), 48.6, dw, dh, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // dead black wick at the crown
      deadWick(ctx, 17.6, 6.6, 1);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      trunk();
      ctx.stroke();
      hiEnd(t);
    }
  }

  // ── deco-tallow-mound: a slumped melt, tongues over its base ─────────────
  {
    const t = T.createCanvas("deco-tallow-mound", 36, 24);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 18, 21, 14, 3.2);
      const dome = (): void => {
        ctx.beginPath();
        ctx.moveTo(3.5, 21);
        ctx.bezierCurveTo(4, 13, 9, 7.8, 16.5, 7.4);
        ctx.bezierCurveTo(24.5, 7, 30.5, 11.5, 32.5, 21);
        ctx.quadraticCurveTo(18, 23, 3.5, 21);
        ctx.closePath();
      };
      const g = ctx.createLinearGradient(3, 0, 33, 0);
      g.addColorStop(0, shade(C.parchmentAged, 0.5));
      g.addColorStop(0.55, shade(C.parchmentAged, 0.8));
      g.addColorStop(1, shade(C.parchment, 0.98));
      ctx.fillStyle = g;
      dome();
      ctx.fill();
      ctx.save();
      dome();
      ctx.clip();
      // slump folds sagging toward the cool side
      ctx.strokeStyle = shade(C.parchmentAged, 0.45, 0.45);
      ctx.lineWidth = 0.9;
      for (const [x0, y0, x1] of [[8, 12, 14], [12, 16.5, 21], [20, 11, 27]] as const) {
        const wob = (crand() - 0.5) * 1.4;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo((x0 + x1) / 2 + wob, y0 + 3.2, x1, y0 + 1);
        ctx.stroke();
      }
      // sheen where the candle grazes the east shoulder
      ctx.strokeStyle = shade(C.parchment, 1.1, 0.6);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(24, 8.6);
      ctx.quadraticCurveTo(29.5, 11, 31.6, 17);
      ctx.stroke();
      ctx.restore();
      // drip tongues lapping over the base line
      for (const [dx, dw, dh, f] of [[7.5, 2, 2.6, 0.62], [13, 1.7, 3, 0.82], [21, 2.2, 2.8, 0.92], [28, 1.8, 2.4, 0.72]] as const) {
        ctx.fillStyle = shade(C.parchmentAged, f);
        ctx.beginPath();
        ctx.ellipse(dx + (crand() - 0.5), 21.2, dw, dh, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      dome();
      ctx.stroke();
      hiEnd(t);
    }
  }

  // ── deco-tallow-votives: three spent votives, one leaning ────────────────
  {
    const t = T.createCanvas("deco-tallow-votives", 30, 24);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 15, 21, 12, 3);
      const votive = (cx: number, hgt: number, w: number, lean: number): void => {
        ctx.save();
        ctx.translate(cx, 21.5);
        ctx.rotate(lean);
        const half = w / 2;
        const g = ctx.createLinearGradient(-half, 0, half, 0);
        g.addColorStop(0, shade(C.parchmentAged, 0.58));
        g.addColorStop(0.55, shade(C.parchmentAged, 0.85));
        g.addColorStop(1, shade(C.parchment, 1.0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-half, 0);
        ctx.lineTo(-half + 0.5, -hgt + 1);
        ctx.quadraticCurveTo(0, -hgt - 1, half - 0.5, -hgt + 1);
        ctx.lineTo(half, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.stroke();
        // hardened drip skirt at the foot
        ctx.fillStyle = shade(C.parchmentAged, 0.72);
        ctx.beginPath();
        ctx.ellipse(-half + 0.6, -1, 1.3, 2, 0, 0, Math.PI * 2);
        ctx.ellipse(half - 0.8, -1.4, 1.1, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
        // sunken crater and burnt wick
        deadWick(ctx, 0, -hgt + 0.8, 0.8);
        ctx.restore();
      };
      // back-to-front: tall middle first so the flanks read in front
      votive(15, 15, 6, (crand() - 0.5) * 0.05);
      votive(7, 10.5, 5.4, (crand() - 0.5) * 0.06);
      votive(23.5, 7.5, 5.8, 0.16 + crand() * 0.04); // the leaner
      hiEnd(t);
    }
  }

  // ── deco-tallow-barrel: render-barrel, wax crusted over the rim ──────────
  {
    const t = T.createCanvas("deco-tallow-barrel", 32, 40);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 16, 36.5, 12, 3.5);
      const g = ctx.createLinearGradient(5, 0, 27, 0);
      g.addColorStop(0, shade(C.parchmentAged, 0.38));
      g.addColorStop(0.55, shade(C.parchmentAged, 0.6));
      g.addColorStop(1, shade(C.parchmentAged, 0.86));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(16, 22.5, 11, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      // stave seams
      ctx.strokeStyle = shade(C.void, 1.6, 0.35);
      ctx.lineWidth = 0.7;
      for (const sx of [11.5, 20.5] as const) {
        ctx.beginPath();
        ctx.moveTo(sx, 9.5);
        ctx.quadraticCurveTo(sx + (sx < 16 ? -1.6 : 1.6), 22.5, sx, 36);
        ctx.stroke();
      }
      // iron hoops
      ctx.strokeStyle = shade(C.void, 2);
      ctx.lineWidth = 1.4;
      for (const y of [15, 22.5, 30] as const) {
        ctx.beginPath();
        ctx.ellipse(16, y, 10.4, 3, 0, 0, Math.PI);
        ctx.stroke();
      }
      // open mouth: cooled render inside, ember-warm at its heart
      ctx.fillStyle = shade(C.void, 1.6);
      ctx.beginPath();
      ctx.ellipse(16, 9.5, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mix(C.parchmentAged, C.ember, 0.3, 0.9);
      ctx.beginPath();
      ctx.ellipse(16, 9.8, 6.2, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // pale wax crusted over the rim, lumped heavier on the lit side
      for (const [wx, wy, ww, wh, f] of [
        [9.5, 10.6, 2.4, 1.5, 0.82],
        [14, 12, 2.8, 1.7, 0.92],
        [20.5, 11.4, 3, 1.9, 1.0],
        [23.8, 9.6, 2, 1.4, 0.95],
      ] as const) {
        ctx.fillStyle = shade(C.parchment, f);
        ctx.beginPath();
        ctx.ellipse(wx + (crand() - 0.5) * 0.8, wy, ww, wh, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // one long drip run down the lit stave, swelling to a bead
      ctx.strokeStyle = shade(C.parchment, 0.92);
      ctx.lineWidth = 1.7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(21.8, 12.5);
      ctx.quadraticCurveTo(22.6, 20, 22.2, 28.5);
      ctx.stroke();
      ctx.lineCap = "butt";
      ctx.fillStyle = shade(C.parchment, 0.98);
      ctx.beginPath();
      ctx.ellipse(22.2, 29.8, 1.4, 2.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(C.parchment, 1.1, 0.6);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(22.6, 14);
      ctx.quadraticCurveTo(23.2, 20, 22.9, 27);
      ctx.stroke();
      // ink silhouette
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(16, 22.5, 11, 15, 0, 0, Math.PI * 2);
      ctx.stroke();
      hiEnd(t);
    }
  }

  // ── deco-tallow-pool: hardened puddle, two dead stubs standing in it ─────
  {
    const t = T.createCanvas("deco-tallow-pool", 40, 18);
    if (t !== null) {
      const ctx = hiBegin(t);
      seat(ctx, 20, 14.5, 16, 3, 0.2);
      const puddle = (): void => {
        ctx.beginPath();
        ctx.moveTo(3, 13.5);
        ctx.bezierCurveTo(5, 10, 12, 9, 20, 9.2);
        ctx.bezierCurveTo(29, 9, 35.5, 10.5, 37, 13.5);
        ctx.bezierCurveTo(35.5, 16.5, 28, 17.4, 19, 17.2);
        ctx.bezierCurveTo(10.5, 17.4, 4.5, 16, 3, 13.5);
        ctx.closePath();
      };
      const g = ctx.createLinearGradient(3, 0, 37, 0);
      g.addColorStop(0, shade(C.parchmentAged, 0.55));
      g.addColorStop(0.55, shade(C.parchmentAged, 0.8));
      g.addColorStop(1, shade(C.parchment, 0.95));
      ctx.fillStyle = g;
      puddle();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      puddle();
      ctx.stroke();
      // cooled meniscus catching the light along the east rim
      ctx.strokeStyle = shade(C.parchment, 1.08, 0.6);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(28, 10);
      ctx.quadraticCurveTo(34.5, 11, 36, 13.3);
      ctx.stroke();
      // two dead stubs rooted in the wax
      const stub = (cx: number, hgt: number, w: number): void => {
        const lean = (crand() - 0.5) * 0.06;
        ctx.save();
        ctx.translate(cx, 13.5);
        ctx.rotate(lean);
        const half = w / 2;
        // melt ring where the stub fused with the pool
        ctx.fillStyle = shade(C.parchmentAged, 0.62);
        ctx.beginPath();
        ctx.ellipse(0, 0, half + 1.6, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
        const sg = ctx.createLinearGradient(-half, 0, half, 0);
        sg.addColorStop(0, shade(C.parchmentAged, 0.6));
        sg.addColorStop(1, shade(C.parchment, 1.0));
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(-half, 0.5);
        ctx.lineTo(-half + 0.4, -hgt + 0.8);
        ctx.quadraticCurveTo(0, -hgt - 0.8, half - 0.4, -hgt + 0.8);
        ctx.lineTo(half, 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        deadWick(ctx, 0, -hgt + 0.6, 0.7);
        ctx.restore();
      };
      stub(14, 9, 4.6);
      stub(26.5, 5.5, 4);
      hiEnd(t);
    }
  }
}
