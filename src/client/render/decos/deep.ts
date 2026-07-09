/**
 * Deep-biome deco set — the Wickless Deep and the Bottom, the dark's own
 * country. Near-black basalt and obsidian forms with sparing verdigris and
 * gold accents: a crystal cluster that keeps a faint light of its own, a
 * leaning glyph-cut monolith shard, leathery eggs half-sunk in the floor, a
 * glassy spike, and an offering bowl of gold left by delvers who never
 * climbed back. Woodcut idiom per tilemap.ts: flat confident shapes, 2–3
 * stop gradients, thin ink outlines, light from the right. Every prop is a
 * bottom-anchored billboard seated by a soft contact shadow.
 */

import type Phaser from "phaser";
import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix, crand, crandSeed, hiBegin, hiEnd } from "../paint.js";

export const DEEP_DECO_KEYS = [
  "deco-deep-crystals",
  "deco-deep-monolith",
  "deco-deep-eggs",
  "deco-deep-spike",
  "deco-deep-offering",
] as const;

export function buildDeepDecos(T: Phaser.Textures.TextureManager): void {
  if (T.exists(DEEP_DECO_KEYS[0])) return;
  crandSeed(0xdee9b1);
  const C = COLOR_CSS;
  const INK = shade(C.void, 0.7, 0.9); // the woodcut line

  /** Soft contact shadow that seats a prop on the ground diamond. */
  const seat = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void => {
    ctx.fillStyle = shade(C.void, 0.4, 0.22);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // ── deco-deep-crystals: verdigris cluster, four faceted spears ───────────
  const crystals = T.createCanvas(DEEP_DECO_KEYS[0], 32, 36);
  if (crystals !== null) {
    const ctx = hiBegin(crystals);
    seat(ctx, 16, 33, 11, 3.4);
    // the cluster holds a little light of its own, pooled at its heart
    const glow = ctx.createRadialGradient(16.5, 27, 1, 16.5, 27, 11);
    glow.addColorStop(0, shade(C.verdigris, 1.1, 0.26));
    glow.addColorStop(1, shade(C.verdigris, 1.1, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(16.5, 27, 11.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // spear = elongated kite: cool left facet, lit right facet, bright ridge
    const spear = (tx: number, ty: number, wx: number, wy: number, hw: number, bx: number, by: number): void => {
      const kite = (): void => {
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(wx + hw, wy);
        ctx.lineTo(bx, by);
        ctx.lineTo(wx - hw, wy);
        ctx.closePath();
      };
      const g = ctx.createLinearGradient(wx - hw, 0, wx + hw, 0);
      g.addColorStop(0, shade(C.verdigrisDim, 0.72));
      g.addColorStop(0.55, shade(C.verdigrisDim, 1.15));
      g.addColorStop(1, shade(C.verdigris, 1.02));
      ctx.fillStyle = g;
      kite();
      ctx.fill();
      // the right facet catches what light there is
      ctx.fillStyle = shade(C.verdigris, 1.22, 0.4);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(wx + hw, wy);
      ctx.lineTo(bx, by);
      ctx.closePath();
      ctx.fill();
      // luminous ridge, tip to root — the inner glow leaking out
      ctx.strokeStyle = shade(C.verdigris, 1.5, 0.5);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      kite();
      ctx.stroke();
    };
    const j = (): number => (crand() - 0.5) * 1.6;
    spear(8.5 + j(), 12, 9.5, 26, 3.3, 10.5, 34); // back-left, short
    spear(25 + j(), 13.5, 23, 26.5, 3.1, 22, 34); // back-right, leaning out
    spear(16.5 + j(), 4.5, 16.3, 22, 4.4, 16.5, 35); // the tall heart spear
    spear(11.5 + j(), 20.5, 12.7, 28.5, 2.7, 13.5, 36); // small forward spear
    hiEnd(crystals);
  }

  // ── deco-deep-monolith: a leaning basalt shard, one glyph on its face ────
  const monolith = T.createCanvas(DEEP_DECO_KEYS[1], 28, 50);
  if (monolith !== null) {
    const ctx = hiBegin(monolith);
    seat(ctx, 14, 47, 10.5, 3.4);
    const lean = 3 + crand() * 1.6; // how far the crown drifts left
    const shard = (): void => {
      ctx.beginPath();
      ctx.moveTo(8.5, 50);
      ctx.lineTo(9.8, 24);
      ctx.lineTo(11.5 - lean, 9);
      ctx.lineTo(14.5 - lean, 5);
      ctx.lineTo(18 - lean, 8);
      ctx.lineTo(19.5 - lean * 0.35, 26);
      ctx.lineTo(20.2, 50);
      ctx.closePath();
    };
    // near-black basalt, one warm-kissed edge on the right
    const g = ctx.createLinearGradient(8, 0, 20.5, 0);
    g.addColorStop(0, shade(C.void, 1.35));
    g.addColorStop(0.6, shade(C.surface, 1.2));
    g.addColorStop(1, shade(mix(C.surface2, C.ember, 0.16), 1.55));
    ctx.fillStyle = g;
    shard();
    ctx.fill();
    // beveled crown facet
    ctx.fillStyle = shade(C.surface2, 1.45, 0.75);
    ctx.beginPath();
    ctx.moveTo(11.5 - lean, 9);
    ctx.lineTo(14.5 - lean, 5);
    ctx.lineTo(18 - lean, 8);
    ctx.lineTo(14.3 - lean, 11.5);
    ctx.closePath();
    ctx.fill();
    // thin light along the right arris
    ctx.strokeStyle = mix(C.boneDim, C.flame, 0.3, 0.85);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(18 - lean, 8);
    ctx.lineTo(19.5 - lean * 0.35, 26);
    ctx.lineTo(20.2, 49.5);
    ctx.stroke();
    // ONE glyph stroke, verdigris, cut into the face
    ctx.strokeStyle = shade(C.verdigris, 1.12, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(13.4 - lean * 0.7, 16);
    ctx.quadraticCurveTo(16 - lean * 0.55, 20.5, 13.6 - lean * 0.45, 25.5);
    ctx.quadraticCurveTo(11.8 - lean * 0.3, 30, 14.6 - lean * 0.2, 34);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    shard();
    ctx.stroke();
    // a chip of the same stone at its foot
    ctx.fillStyle = shade(C.surface, 1.15);
    ctx.beginPath();
    ctx.moveTo(21.3, 50);
    ctx.lineTo(23.3, 46.5);
    ctx.lineTo(25.4, 50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    hiEnd(monolith);
  }

  // ── deco-deep-eggs: three leathery eggs half-sunk in the floor ───────────
  const eggs = T.createCanvas(DEEP_DECO_KEYS[2], 30, 22);
  if (eggs !== null) {
    const ctx = hiBegin(eggs);
    seat(ctx, 15, 19, 12.5, 3.2);
    const egg = (cx0: number, gy: number, rx: number, ry: number): void => {
      const cx = cx0 + (crand() - 0.5) * 1.2;
      const dome = (): void => {
        ctx.beginPath();
        ctx.ellipse(cx, gy, rx, ry, 0, Math.PI, Math.PI * 2);
        ctx.closePath();
      };
      const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
      g.addColorStop(0, shade(C.boneDim, 0.88));
      g.addColorStop(0.55, shade(C.bone, 0.92));
      g.addColorStop(1, shade(C.bone, 1.12));
      ctx.fillStyle = g;
      dome();
      ctx.fill();
      // one leathery crease
      ctx.strokeStyle = shade(C.boneDim, 0.72, 0.45);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.55, gy - ry * 0.38);
      ctx.quadraticCurveTo(cx, gy - ry * 0.05, cx + rx * 0.5, gy - ry * 0.5);
      ctx.stroke();
      // faint wet highlight, upper right
      ctx.strokeStyle = shade(C.parchment, 1.12, 0.5);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.ellipse(cx, gy, rx * 0.72, ry * 0.72, 0, -Math.PI * 0.42, -Math.PI * 0.14);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      dome();
      ctx.stroke();
      // the floor's dark lip where it sank
      ctx.fillStyle = shade(C.void, 1.1, 0.32);
      ctx.beginPath();
      ctx.ellipse(cx, gy, rx * 0.96, 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    egg(8.5, 19.5, 5.8, 8.6); // back-left
    egg(21.5, 20, 6.2, 9.4); // back-right, the big one
    egg(15, 21.2, 5.2, 6.8); // small, forward
    hiEnd(eggs);
  }

  // ── deco-deep-spike: an obsidian blade with one lit edge ─────────────────
  const spike = T.createCanvas(DEEP_DECO_KEYS[3], 26, 46);
  if (spike !== null) {
    const ctx = hiBegin(spike);
    seat(ctx, 13, 43, 9.5, 3.3);
    const tilt = (crand() - 0.5) * 2.4;
    // a lesser splinter behind, left
    ctx.fillStyle = shade(C.surface, 0.95);
    ctx.beginPath();
    ctx.moveTo(2.5, 46);
    ctx.lineTo(6 + tilt * 0.4, 30);
    ctx.lineTo(10, 46);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // the spike itself: glassy near-black, sabre-curved
    const blade = (): void => {
      ctx.beginPath();
      ctx.moveTo(5, 46);
      ctx.quadraticCurveTo(9.5, 26, 13.2 + tilt, 3.5);
      ctx.quadraticCurveTo(16.8, 25, 21, 46);
      ctx.closePath();
    };
    const g = ctx.createLinearGradient(5, 0, 21, 0);
    g.addColorStop(0, shade(C.void, 1.3));
    g.addColorStop(0.55, shade(C.surface, 1.15));
    g.addColorStop(1, shade(C.surface2, 1.7));
    ctx.fillStyle = g;
    blade();
    ctx.fill();
    // conchoidal facet shadow down the left
    ctx.strokeStyle = shade(C.void, 1.05, 0.6);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(12.4 + tilt, 6.5);
    ctx.quadraticCurveTo(10, 26, 8.6, 44);
    ctx.stroke();
    // thin light edge on the right — candleglow on glass
    ctx.strokeStyle = mix(C.bone, C.flameHi, 0.4, 0.9);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(13.3 + tilt, 4.5);
    ctx.quadraticCurveTo(16.6, 25, 20.6, 45.5);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    blade();
    ctx.stroke();
    hiEnd(spike);
  }

  // ── deco-deep-offering: a stone bowl of gold nobody dared carry out ──────
  const offering = T.createCanvas(DEEP_DECO_KEYS[4], 28, 18);
  if (offering !== null) {
    const ctx = hiBegin(offering);
    seat(ctx, 14, 15.4, 11, 3);
    // foot
    ctx.fillStyle = shade(C.surface, 0.85);
    ctx.beginPath();
    ctx.ellipse(14, 16.6, 4.6, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // bowl body: dark stone, right side lit
    const g = ctx.createLinearGradient(3.5, 0, 24.5, 0);
    g.addColorStop(0, shade(C.surface, 0.8));
    g.addColorStop(0.55, shade(C.surface2, 1.05));
    g.addColorStop(1, shade(C.surface2, 1.65));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(3.5, 8);
    ctx.bezierCurveTo(4.2, 13.8, 8.6, 16.6, 14, 16.6);
    ctx.bezierCurveTo(19.4, 16.6, 23.8, 13.8, 24.5, 8);
    ctx.ellipse(14, 8, 10.5, 3, 0, 0, Math.PI); // front lip, right → left
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    // the dark mouth
    ctx.fillStyle = shade(C.void, 0.85);
    ctx.beginPath();
    ctx.ellipse(14, 8, 10.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // a low mound of gold
    const mg = ctx.createLinearGradient(6.5, 0, 22, 0);
    mg.addColorStop(0, shade(C.goldInk, 0.66));
    mg.addColorStop(0.6, shade(C.goldInk, 0.95));
    mg.addColorStop(1, shade(C.goldInk, 1.25));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.ellipse(14.3, 7.4, 7.6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // a few pieces proud of the pile
    for (const [px, py, pr] of [[11.2, 6.1, 2.1], [15.6, 5.6, 2.3], [18.6, 6.8, 1.8]] as const) {
      ctx.fillStyle = shade(C.goldInk, 0.95 + crand() * 0.25);
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(C.ink, 1.1, 0.5);
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    // two glints
    ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.75, 0.95);
    ctx.lineWidth = 0.6;
    for (const [gx, gy] of [[17.2, 5.4], [11.6, 6.6]] as const) {
      ctx.beginPath();
      ctx.moveTo(gx - 1.2, gy);
      ctx.lineTo(gx + 1.2, gy);
      ctx.moveTo(gx, gy - 1.2);
      ctx.lineTo(gx, gy + 1.2);
      ctx.stroke();
    }
    // the near rim, in front of the gold
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(14, 8, 10.5, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = shade(C.surface2, 1.6, 0.8);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(14, 8.8, 10.2, 2.7, 0, 0.35, Math.PI - 0.35);
    ctx.stroke();
    hiEnd(offering);
  }
}
