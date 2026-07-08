/**
 * Iso texture factory — "highest placeholder fidelity" pass. Everything is
 * still canvas-generated (invariant 4: no external assets) but shaded like
 * the design language demands: token-derived light ramps, stone texture,
 * brick-coursed wall faces, soft creature shading. Real W4 atlases replace
 * the same keys later with no scene-code change.
 *
 * All colors derive from design tokens via shade()/mix() — no foreign hues.
 * Cosmetic randomness uses a FIXED-seed LCG at texture-build time only
 * (identical textures every boot; the sim's fx quarantine is untouched).
 */

import type Phaser from "phaser";
import { COLOR_CSS } from "../../../design/tokens/tokens.js";
import { Tile } from "../../shared/sim/types.js";
import { TILE_W, TILE_H, WALL_H } from "./iso.js";

const TILE_KINDS = 16;
export const FLOOR_VARIANTS = 3; // strip indices 16, 17 reuse FLOOR look

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

function diamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

/** Stone-textured diamond: base gradient, speckle, NW bevel light, SE shade. */
function stoneDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  base: string,
  speckleLight: string,
  speckleDark: string,
): void {
  const g = ctx.createLinearGradient(cx - TILE_W / 2, cy - TILE_H / 2, cx + TILE_W / 2, cy + TILE_H / 2);
  g.addColorStop(0, shade(base, 1.28));
  g.addColorStop(0.5, base);
  g.addColorStop(1, shade(base, 0.78));
  diamondPath(ctx, cx, cy, TILE_W - 2, TILE_H - 1);
  ctx.fillStyle = g;
  ctx.fill();

  // speckle within the diamond
  ctx.save();
  diamondPath(ctx, cx, cy, TILE_W - 4, TILE_H - 3);
  ctx.clip();
  for (let i = 0; i < 26; i++) {
    const px = cx - TILE_W / 2 + crand() * TILE_W;
    const py = cy - TILE_H / 2 + crand() * TILE_H;
    ctx.fillStyle = crand() < 0.5 ? speckleLight : speckleDark;
    ctx.globalAlpha = 0.12 + crand() * 0.15;
    ctx.fillRect(px, py, 1 + crand() * 2, 1);
  }
  // a hairline crack now and then
  if (crand() < 0.45) {
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = speckleDark;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    let x = cx - 10 + crand() * 20;
    let y = cy - 6 + crand() * 12;
    ctx.moveTo(x, y);
    for (let s = 0; s < 3; s++) {
      x += 4 + crand() * 6;
      y += (crand() - 0.5) * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // bevel: NW edges catch light, SE edges fall dark
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = shade(base, 1.55, 0.8);
  ctx.beginPath();
  ctx.moveTo(cx - (TILE_W - 2) / 2, cy);
  ctx.lineTo(cx, cy - (TILE_H - 1) / 2);
  ctx.lineTo(cx + (TILE_W - 2) / 2, cy);
  ctx.stroke();
  ctx.strokeStyle = shade(base, 0.45, 0.9);
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

  // ── Ground strip: 16 tile kinds + floor variants, 64×32 each ────────────
  const stripW = TILE_W * (TILE_KINDS + FLOOR_VARIANTS - 1);
  const strip = T.createCanvas("iso-ground", stripW, TILE_H);
  if (strip !== null) {
    const ctx = strip.getContext();
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
            ctx.save();
            diamondPath(ctx, cx, cy, TILE_W - 8, TILE_H - 5);
            ctx.clip();
            for (let i = 0; i < 18; i++) {
              const px = cx - 24 + crand() * 48;
              const py = cy - 10 + crand() * 20;
              ctx.fillStyle = mix(C.verdigrisDim, C.verdigris, crand() * 0.6);
              ctx.globalAlpha = 0.35 + crand() * 0.4;
              ctx.beginPath();
              ctx.ellipse(px, py, 2 + crand() * 4, 1 + crand() * 2, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
          }
          case Tile.WEBBING: {
            ctx.strokeStyle = shade(C.boneDim, 1.15, 0.75);
            ctx.lineWidth = 0.9;
            for (let ring = 1; ring <= 3; ring++) {
              diamondPath(ctx, cx, cy, (TILE_W - 10) * (ring / 3), (TILE_H - 7) * (ring / 3));
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(cx - 24, cy);
            ctx.lineTo(cx + 24, cy);
            ctx.moveTo(cx, cy - 12);
            ctx.lineTo(cx, cy + 12);
            ctx.moveTo(cx - 13, cy - 6);
            ctx.lineTo(cx + 13, cy + 6);
            ctx.moveTo(cx - 13, cy + 6);
            ctx.lineTo(cx + 13, cy - 6);
            ctx.stroke();
            break;
          }
          case Tile.ENTRY: {
            diamondPath(ctx, cx, cy, TILE_W - 12, TILE_H - 7);
            ctx.strokeStyle = C.goldInk;
            ctx.lineWidth = 2;
            ctx.stroke();
            diamondPath(ctx, cx, cy, TILE_W - 26, TILE_H - 14);
            ctx.strokeStyle = shade(C.goldInk, 1.3, 0.7);
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = shade(C.goldInk, 1.1, 0.16);
            diamondPath(ctx, cx, cy, TILE_W - 12, TILE_H - 7);
            ctx.fill();
            break;
          }
          case Tile.STAIRS_DOWN: {
            // descending steps into darkness with a warm breath from below
            const hole = ctx.createLinearGradient(cx, cy - 10, cx, cy + 10);
            hole.addColorStop(0, shade(C.void, 1.6));
            hole.addColorStop(1, C.void);
            diamondPath(ctx, cx, cy, TILE_W - 14, TILE_H - 8);
            ctx.fillStyle = hole;
            ctx.fill();
            for (let s = 0; s < 3; s++) {
              diamondPath(ctx, cx + s * 3, cy + s * 2, TILE_W - 22 - s * 12, TILE_H - 12 - s * 6);
              ctx.strokeStyle = mix(C.ember, C.flame, s / 3, 0.55 + s * 0.15);
              ctx.lineWidth = 1.4;
              ctx.stroke();
            }
            break;
          }
          default:
            break;
        }
      });
    }
    // floor variants (indices 16..17): same recipe, different speckle roll
    for (let v = 0; v < FLOOR_VARIANTS - 1; v++) {
      drawAt(TILE_KINDS + v, (cx, cy) => stoneDiamond(ctx, cx, cy, floorBase, C.bone, C.void));
    }
    strip.refresh();
  }

  // ── Wall billboard: coursed stone faces + lit lid ────────────────────────
  const wall = T.createCanvas("iso-wall", TILE_W, WALL_H);
  if (wall !== null) {
    const ctx = wall.getContext();
    const lidCy = TILE_H / 2;
    const faceH = WALL_H - TILE_H;
    const faceBase = mix(C.surface2, C.void, 0.25);

    const face = (leftSide: boolean): void => {
      const x0 = leftSide ? 0 : TILE_W;
      const x1 = TILE_W / 2;
      const yTop0 = lidCy;
      const yTop1 = lidCy + TILE_H / 2;
      const g = ctx.createLinearGradient(0, lidCy, 0, WALL_H);
      const tone = leftSide ? 0.55 : 1.0; // W face in shadow, S face lit
      g.addColorStop(0, shade(faceBase, 1.25 * tone));
      g.addColorStop(1, shade(faceBase, 0.55 * tone));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0, yTop0);
      ctx.lineTo(x1, yTop1);
      ctx.lineTo(x1, yTop1 + faceH);
      ctx.lineTo(x0, yTop0 + faceH);
      ctx.closePath();
      ctx.fill();

      // brick courses following the face slope
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = shade(C.void, 1.4, 0.55);
      ctx.lineWidth = 1;
      for (let course = 1; course < 5; course++) {
        const dy = (faceH / 5) * course;
        ctx.beginPath();
        ctx.moveTo(x0, yTop0 + dy);
        ctx.lineTo(x1, yTop1 + dy);
        ctx.stroke();
        // staggered verticals
        const t0 = course % 2 === 0 ? 0.33 : 0.66;
        const vx = x0 + (x1 - x0) * t0;
        const vy = yTop0 + (yTop1 - yTop0) * t0 + dy;
        ctx.beginPath();
        ctx.moveTo(vx, vy - faceH / 5);
        ctx.lineTo(vx, vy);
        ctx.stroke();
      }
      ctx.restore();
    };
    face(true);
    face(false);

    // lid: stone diamond catching the most light
    const lidBase = mix(C.surface2, C.bone, 0.12);
    stoneDiamond(ctx, TILE_W / 2, lidCy, lidBase, C.bone, C.void);
    // crisp silhouette edges
    ctx.strokeStyle = shade(C.void, 0.8, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, lidCy);
    ctx.lineTo(0, lidCy + faceH);
    ctx.moveTo(TILE_W, lidCy);
    ctx.lineTo(TILE_W, lidCy + faceH);
    ctx.moveTo(TILE_W / 2, lidCy + TILE_H / 2);
    ctx.lineTo(TILE_W / 2, WALL_H);
    ctx.stroke();
    wall.refresh();
  }

  // ── Doors: timber + iron on a stone frame ────────────────────────────────
  const doorTex = (key: string, panel: boolean, stuck: boolean): void => {
    const c = T.createCanvas(key, TILE_W, WALL_H);
    if (c === null) return;
    const ctx = c.getContext();
    const baseY = WALL_H - TILE_H / 2;
    // stone posts with bevel
    const post = (x: number): void => {
      const g = ctx.createLinearGradient(x, 0, x + 9, 0);
      g.addColorStop(0, shade(C.surface2, 1.3));
      g.addColorStop(1, shade(C.surface2, 0.6));
      ctx.fillStyle = g;
      ctx.fillRect(x, baseY - 58, 9, 58);
    };
    post(7);
    post(TILE_W - 16);
    // lintel
    ctx.fillStyle = shade(C.surface2, 0.9);
    ctx.fillRect(7, baseY - 62, TILE_W - 14, 6);
    if (panel) {
      const g = ctx.createLinearGradient(0, baseY - 54, 0, baseY);
      g.addColorStop(0, shade(C.parchmentAged, 0.95));
      g.addColorStop(1, shade(C.parchmentAged, 0.6));
      ctx.fillStyle = g;
      ctx.fillRect(16, baseY - 54, TILE_W - 32, 54);
      // wood grain
      ctx.strokeStyle = shade(C.ink, 1.4, 0.35);
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const x = 20 + i * 7;
        ctx.beginPath();
        ctx.moveTo(x, baseY - 52);
        ctx.lineTo(x, baseY - 2);
        ctx.stroke();
      }
      // iron bands + handle
      ctx.fillStyle = shade(C.void, 1.8);
      ctx.fillRect(16, baseY - 44, TILE_W - 32, 3);
      ctx.fillRect(16, baseY - 16, TILE_W - 32, 3);
      ctx.beginPath();
      ctx.arc(TILE_W - 22, baseY - 28, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (stuck) {
        ctx.strokeStyle = C.seal;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(18, baseY - 50);
        ctx.lineTo(TILE_W - 18, baseY - 6);
        ctx.stroke();
        ctx.fillStyle = C.seal;
        ctx.beginPath();
        ctx.arc(TILE_W / 2, baseY - 28, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(C.seal, 0.7);
        ctx.beginPath();
        ctx.arc(TILE_W / 2, baseY - 28, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    c.refresh();
  };
  doorTex("iso-door-closed", true, false);
  doorTex("iso-door-stuck", true, true);
  doorTex("iso-door-open", false, false);

  // ── Braziers: iron bowl, coals, flame ────────────────────────────────────
  const brazier = (key: string, lit: boolean): void => {
    const c = T.createCanvas(key, 44, 64);
    if (c === null) return;
    const ctx = c.getContext();
    // tripod legs
    ctx.strokeStyle = shade(C.void, 2.2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, 36);
    ctx.lineTo(12, 60);
    ctx.moveTo(22, 36);
    ctx.lineTo(32, 60);
    ctx.moveTo(22, 36);
    ctx.lineTo(22, 58);
    ctx.stroke();
    // bowl
    const bowlG = ctx.createLinearGradient(0, 26, 0, 40);
    bowlG.addColorStop(0, shade(C.inkSoft, 1.4));
    bowlG.addColorStop(1, shade(C.void, 1.6));
    ctx.fillStyle = bowlG;
    ctx.beginPath();
    ctx.ellipse(22, 32, 16, 8, 0, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(22, 32, 16, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = lit ? shade(C.ember, 0.9) : shade(C.void, 2.0);
    ctx.fill();
    if (lit) {
      // layered flame
      const flame = (w: number, h: number, cy: number, color: string, a: number): void => {
        ctx.fillStyle = color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.moveTo(22, cy - h);
        ctx.bezierCurveTo(22 + w, cy - h * 0.45, 22 + w * 0.7, cy, 22, cy);
        ctx.bezierCurveTo(22 - w * 0.7, cy, 22 - w, cy - h * 0.45, 22, cy - h);
        ctx.fill();
      };
      flame(11, 26, 32, C.ember, 0.9);
      flame(8, 20, 31, C.flame, 0.95);
      flame(4.5, 12, 30, C.flameHi, 1);
      ctx.globalAlpha = 1;
    }
    c.refresh();
  };
  brazier("iso-brazier", false);
  brazier("iso-brazier-lit", true);

  // ── Waystone: carved monolith with glowing sigil ─────────────────────────
  const waystone = T.createCanvas("iso-waystone", 40, 68);
  if (waystone !== null) {
    const ctx = waystone.getContext();
    ctx.fillStyle = shade(C.void, 2.0);
    ctx.beginPath();
    ctx.ellipse(20, 62, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(6, 0, 34, 0);
    g.addColorStop(0, shade(C.verdigrisDim, 0.8));
    g.addColorStop(0.45, C.verdigris);
    g.addColorStop(1, shade(C.verdigrisDim, 0.55));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(20, 2);
    ctx.lineTo(31, 16);
    ctx.lineTo(28, 60);
    ctx.lineTo(12, 60);
    ctx.lineTo(9, 16);
    ctx.closePath();
    ctx.fill();
    // carved rune, glowing
    ctx.strokeStyle = shade(C.verdigris, 1.8);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(20, 14);
    ctx.lineTo(20, 40);
    ctx.moveTo(14, 22);
    ctx.lineTo(26, 22);
    ctx.moveTo(15, 34);
    ctx.lineTo(25, 30);
    ctx.stroke();
    waystone.refresh();
  }

  // ── Wax pickups: molten pools with warm cores ────────────────────────────
  const pickup = (key: string, r: number, tall: boolean): void => {
    const c = T.createCanvas(key, 30, 32);
    if (c === null) return;
    const ctx = c.getContext();
    // pooled base
    ctx.fillStyle = shade(C.bone, 0.85);
    ctx.beginPath();
    ctx.ellipse(15, 27, 6 + r, 3 + (r >> 1), 0, 0, Math.PI * 2);
    ctx.fill();
    if (tall) {
      const g = ctx.createLinearGradient(0, 27 - r * 3.4, 0, 27);
      g.addColorStop(0, shade(C.parchment, 1.02));
      g.addColorStop(1, shade(C.bone, 0.8));
      ctx.fillStyle = g;
      ctx.fillRect(15 - r, 27 - r * 3.4, r * 2, r * 3.4);
      // drips
      ctx.beginPath();
      ctx.ellipse(15 - r, 27 - r * 1.4, 1.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const fy = tall ? 27 - r * 3.4 : 24;
    const glow = ctx.createRadialGradient(15, fy - 2, 0, 15, fy - 2, r * 2.4);
    glow.addColorStop(0, shade(C.flameHi, 1.05, 0.9));
    glow.addColorStop(1, shade(C.flameHi, 1, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(15 - r * 2.4, fy - 2 - r * 2.4, r * 4.8, r * 4.8);
    ctx.fillStyle = C.flameHi;
    ctx.beginPath();
    ctx.ellipse(15, fy - 2, 2.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    c.refresh();
  };
  pickup("iso-wax-drip", 3, false);
  pickup("iso-wax-stub", 4, true);
  pickup("iso-wax-cake", 5, true);

  // ── Creatures: shaded, asymmetric (face right = E; setFlipX mirrors) ─────
  const rat = T.createCanvas("iso-ent-1", 34, 26);
  if (rat !== null) {
    const ctx = rat.getContext();
    // tail
    ctx.strokeStyle = shade(C.boneDim, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 18);
    ctx.bezierCurveTo(-2, 16, 0, 24, 5, 22);
    ctx.stroke();
    // body
    const g = ctx.createRadialGradient(18, 14, 2, 18, 16, 12);
    g.addColorStop(0, shade(C.boneDim, 1.35));
    g.addColorStop(1, shade(C.boneDim, 0.6));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(17, 17, 11, 7, -0.15, 0, Math.PI * 2);
    ctx.fill();
    // head + ears
    ctx.beginPath();
    ctx.ellipse(27, 13, 6, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.boneDim, 0.85);
    ctx.beginPath();
    ctx.ellipse(24, 7, 2.6, 3.2, 0, 0, Math.PI * 2);
    ctx.ellipse(28.5, 6.5, 2.6, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // eye catches candlelight
    ctx.fillStyle = C.flameHi;
    ctx.beginPath();
    ctx.arc(30, 12, 1.4, 0, Math.PI * 2);
    ctx.fill();
    rat.refresh();
  }

  const worm = T.createCanvas("iso-ent-2", 40, 38);
  if (worm !== null) {
    const ctx = worm.getContext();
    // dust ring
    ctx.fillStyle = shade(C.boneDim, 0.9, 0.35);
    ctx.beginPath();
    ctx.ellipse(20, 33, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // segmented body rearing right
    const seg = (x: number, y: number, r: number, f: number): void => {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      g.addColorStop(0, shade(C.ember, 1.35 * f));
      g.addColorStop(1, shade(C.ember, 0.55 * f));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    seg(12, 30, 8, 0.8);
    seg(18, 24, 8.5, 0.9);
    seg(25, 17, 8, 1);
    seg(30, 10, 6.5, 1.1);
    // maw
    ctx.fillStyle = shade(C.void, 1.5);
    ctx.beginPath();
    ctx.ellipse(32, 8, 3.4, 2.6, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.flameHi;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(32, 8, 4.6, -0.6, 1.2);
    ctx.stroke();
    worm.refresh();
  }

  // moth: two wing frames for flutter
  const mothFrame = (key: string, spread: number): void => {
    const c = T.createCanvas(key, 32, 30);
    if (c === null) return;
    const ctx = c.getContext();
    const wing = (dir: number): void => {
      const g = ctx.createRadialGradient(16 + dir * 6, 14, 1, 16 + dir * 9, 14, 12);
      g.addColorStop(0, shade(C.parchment, 1.02, 0.95));
      g.addColorStop(1, shade(C.parchmentAged, 0.8, 0.75));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(16 + dir * 8, 13, 8, 4.5 + spread * 6, dir * (0.9 - spread * 0.5), 0, Math.PI * 2);
      ctx.fill();
      // wing eye-spot
      ctx.fillStyle = shade(C.inkSoft, 1, 0.5);
      ctx.beginPath();
      ctx.arc(16 + dir * 10, 12, 1.6, 0, Math.PI * 2);
      ctx.fill();
    };
    wing(-1);
    wing(1);
    // body
    ctx.fillStyle = shade(C.parchmentAged, 0.7);
    ctx.beginPath();
    ctx.ellipse(16, 16, 2.4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.flameHi;
    ctx.beginPath();
    ctx.arc(17.5, 9.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    c.refresh();
  };
  mothFrame("iso-ent-3", 0);
  mothFrame("iso-ent-3b", 1);

  const beast = T.createCanvas("iso-ent-4", 64, 72);
  if (beast !== null) {
    const ctx = beast.getContext();
    // molten wax mound, dripping
    const g = ctx.createRadialGradient(32, 30, 4, 32, 44, 34);
    g.addColorStop(0, shade(C.flame, 1.15));
    g.addColorStop(0.55, shade(C.flame, 0.8));
    g.addColorStop(1, shade(C.ember, 0.5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(32, 6);
    ctx.bezierCurveTo(52, 10, 58, 34, 54, 62);
    ctx.bezierCurveTo(48, 68, 16, 68, 10, 62);
    ctx.bezierCurveTo(6, 34, 12, 10, 32, 6);
    ctx.fill();
    // drips down the flanks
    ctx.fillStyle = shade(C.flame, 0.95);
    for (const [dx, len] of [[-18, 10], [-8, 16], [14, 12], [20, 8]] as const) {
      ctx.beginPath();
      ctx.ellipse(32 + dx, 58 + len / 3, 2.5, len / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // dark eye pits + inner smolder (blind, but something burns in there)
    ctx.fillStyle = shade(C.void, 1.2);
    ctx.beginPath();
    ctx.ellipse(26, 26, 4.5, 6, -0.2, 0, Math.PI * 2);
    ctx.ellipse(42, 25, 4.5, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.ember, 1.3, 0.5);
    ctx.beginPath();
    ctx.arc(27, 28, 1.5, 0, Math.PI * 2);
    ctx.arc(43, 27, 1.5, 0, Math.PI * 2);
    ctx.fill();
    beast.refresh();
  }

  // ── The delver ───────────────────────────────────────────────────────────
  const player = T.createCanvas("iso-player", 36, 56);
  if (player !== null) {
    const ctx = player.getContext();
    // cloak with hood, candle held to the right (E-facing default)
    const g = ctx.createLinearGradient(8, 8, 30, 52);
    g.addColorStop(0, shade(C.inkSoft, 1.5));
    g.addColorStop(1, shade(C.void, 1.6));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(17, 4);
    ctx.bezierCurveTo(27, 6, 28, 16, 27, 24);
    ctx.lineTo(28, 50);
    ctx.bezierCurveTo(20, 54, 12, 54, 7, 50);
    ctx.lineTo(8, 22);
    ctx.bezierCurveTo(7, 10, 11, 5, 17, 4);
    ctx.fill();
    // hood shadow + face sliver lit by candle
    ctx.fillStyle = shade(C.void, 1.1);
    ctx.beginPath();
    ctx.ellipse(18, 13, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.parchmentAged, 0.85, 0.9);
    ctx.beginPath();
    ctx.ellipse(20.5, 13.5, 3, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // arm + candle
    ctx.strokeStyle = shade(C.inkSoft, 1.2);
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(24, 28);
    ctx.lineTo(30, 24);
    ctx.stroke();
    ctx.fillStyle = C.parchment;
    ctx.fillRect(29, 16, 3.5, 9);
    const glow = ctx.createRadialGradient(30.7, 12, 0, 30.7, 12, 8);
    glow.addColorStop(0, shade(C.flameHi, 1, 0.95));
    glow.addColorStop(0.4, shade(C.flame, 1, 0.5));
    glow.addColorStop(1, shade(C.flame, 1, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(22, 4, 18, 18);
    ctx.fillStyle = C.flameHi;
    ctx.beginPath();
    ctx.ellipse(30.7, 12.5, 1.8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    player.refresh();
  }

  // ── Utility sprites ──────────────────────────────────────────────────────
  const dia = T.createCanvas("iso-diamond", TILE_W, TILE_H);
  if (dia !== null) {
    const ctx = dia.getContext();
    diamondPath(ctx, TILE_W / 2, TILE_H / 2, TILE_W - 2, TILE_H - 1);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    dia.refresh();
  }

  const shadow = T.createCanvas("iso-shadow", 48, 24);
  if (shadow !== null) {
    const ctx = shadow.getContext();
    const g = ctx.createRadialGradient(24, 12, 1, 24, 12, 22);
    g.addColorStop(0, "rgba(0,0,0,0.45)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.scale(1, 0.5);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(24, 24, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    shadow.refresh();
  }

  const mote = T.createCanvas("iso-mote", 6, 6);
  if (mote !== null) {
    const ctx = mote.getContext();
    const g = ctx.createRadialGradient(3, 3, 0, 3, 3, 3);
    g.addColorStop(0, shade(C.bone, 1.1, 0.9));
    g.addColorStop(1, shade(C.bone, 1, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 6, 6);
    mote.refresh();
  }

  // ── HUD item icons (24 px grid, woodcut-simple per 04 §2.4) ──────────────
  const iconFlint = T.createCanvas("icon-flint", 28, 28);
  if (iconFlint !== null) {
    const ctx = iconFlint.getContext();
    const g = ctx.createLinearGradient(4, 8, 22, 24);
    g.addColorStop(0, shade(C.boneDim, 1.2));
    g.addColorStop(1, shade(C.boneDim, 0.55));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(5, 20);
    ctx.lineTo(13, 9);
    ctx.lineTo(22, 13);
    ctx.lineTo(18, 23);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.flameHi;
    ctx.lineWidth = 1.4;
    for (const [a, b] of [[-0.4, 0.2], [0.1, 0.7], [0.6, 1.2]] as const) {
      ctx.beginPath();
      ctx.moveTo(22 + Math.cos(a) * 2, 10 + Math.sin(a) * 2);
      ctx.lineTo(22 + Math.cos(b) * 6, 10 + Math.sin(b) * 6);
      ctx.stroke();
    }
    iconFlint.refresh();
  }
  const iconSalt = T.createCanvas("icon-salt", 28, 28);
  if (iconSalt !== null) {
    const ctx = iconSalt.getContext();
    const g = ctx.createLinearGradient(0, 6, 0, 24);
    g.addColorStop(0, shade(C.parchmentAged, 1.05));
    g.addColorStop(1, shade(C.parchmentAged, 0.7));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(14, 6);
    ctx.bezierCurveTo(22, 8, 23, 14, 22, 22);
    ctx.bezierCurveTo(18, 25, 10, 25, 6, 22);
    ctx.bezierCurveTo(5, 14, 6, 8, 14, 6);
    ctx.fill();
    ctx.strokeStyle = shade(C.ink, 1.2, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, 8);
    ctx.lineTo(18, 8);
    ctx.stroke();
    ctx.fillStyle = C.parchment;
    for (const [px, py] of [[10, 16], [14, 18], [18, 15], [12, 21], [16, 21]] as const) {
      ctx.fillRect(px, py, 1.6, 1.6);
    }
    iconSalt.refresh();
  }
  const iconChalk = T.createCanvas("icon-chalk", 28, 28);
  if (iconChalk !== null) {
    const ctx = iconChalk.getContext();
    ctx.save();
    ctx.translate(14, 14);
    ctx.rotate(-0.6);
    const g = ctx.createLinearGradient(-3, 0, 3, 0);
    g.addColorStop(0, C.parchment);
    g.addColorStop(1, shade(C.parchment, 0.75));
    ctx.fillStyle = g;
    ctx.fillRect(-3, -10, 6, 20);
    ctx.restore();
    ctx.strokeStyle = shade(C.parchment, 1, 0.65);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 23);
    ctx.lineTo(13, 20);
    ctx.stroke();
    iconChalk.refresh();
  }

  const vignette = T.createCanvas("uv-vignette", 480, 854);
  if (vignette !== null) {
    const ctx = vignette.getContext();
    const g = ctx.createRadialGradient(240, 400, 170, 240, 427, 560);
    g.addColorStop(0, "rgba(11,10,16,0)"); // --void, transparent core
    g.addColorStop(0.65, "rgba(11,10,16,0.28)");
    g.addColorStop(1, "rgba(11,10,16,0.72)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 480, 854);
    vignette.refresh();
  }

  const grain = T.createCanvas("uv-grain", 128, 128);
  if (grain !== null) {
    const ctx = grain.getContext();
    const img = ctx.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(crand() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 14; // whisper-quiet grain
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
    case Tile.DOOR_CLOSED:
      return "iso-door-closed";
    case Tile.DOOR_STUCK:
      return "iso-door-stuck";
    case Tile.DOOR_OPEN:
      return "iso-door-open";
    case Tile.BRAZIER_UNLIT:
      return "iso-brazier";
    case Tile.BRAZIER_LIT:
      return "iso-brazier-lit";
    case Tile.WAYSTONE:
      return "iso-waystone";
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

export function entityTextureFor(kind: number): string {
  return `iso-ent-${kind}`;
}
