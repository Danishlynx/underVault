/**
 * Per-tile lighting (placeholder for the W4 point-light rig, but a real
 * model): every visible tile gets a light value from the candle, lit
 * braziers, and fires with soft distance falloff; tints lerp from a cool
 * near-dark to a warm candle-white derived from tokens. Remembered tiles
 * render as a dark verdigris ghost (the Quantize memory-view's ancestor).
 * All of this is renderer-side cosmetics — the sim's FOV mask stays the
 * single source of what is visible.
 */

import Phaser from "phaser";
import { COLOR } from "../../../design/tokens/tokens.js";
import { Tile, type SimState } from "../../shared/sim/types.js";
import { BRAZIER_RADIUS, FIRE_LIGHT_RADIUS } from "../../shared/sim/constants.js";
import { gridToScreen, TILE_H, TILE_W } from "./iso.js";

// ── Token-derived tint ramp ────────────────────────────────────────────────
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

const WARM_WHITE = lerpColor(0xffffff, COLOR.flameHi, 0.22); // candle-close
let coolDark = lerpColor(COLOR.void, COLOR.surface2, 0.55); // lit-but-far
export let MEMORY_TINT = lerpColor(COLOR.void, COLOR.verdigrisDim, 0.34); // ghost
// (unseen tiles render at alpha 0 — see Descent.redraw; no tint constant)

/**
 * Per-biome color story (D63): the far/dark end of the light ramp leans
 * into the biome's accent hue, so warm candlelight pops against a cool,
 * place-specific ambient — the two-hue grade every reference shot uses.
 */
export function setBiomeGrade(accent: number): void {
  coolDark = lerpColor(lerpColor(COLOR.void, COLOR.surface2, 0.4), accent, 0.3);
  MEMORY_TINT = lerpColor(COLOR.void, accent, 0.28);
}

/** light 0..1 → multiplicative tint. */
export function tintForLight(light: number): number {
  const t = Math.pow(Math.min(Math.max(light, 0), 1), 0.8); // soft knee
  return lerpColor(coolDark, WARM_WHITE, t);
}

// ── Light field ────────────────────────────────────────────────────────────
/** Per-tile light 0..1 for VISIBLE tiles (0 elsewhere). */
export function computeLightMap(s: SimState, visible: Uint8Array, candleRadius: number): Float32Array {
  const n = s.w * s.h;
  const light = new Float32Array(n);

  interface Src {
    x: number;
    y: number;
    r: number;
    boost: number;
  }
  const sources: Src[] = [];
  if (candleRadius > 0) sources.push({ x: s.px, y: s.py, r: candleRadius, boost: 1 });
  for (let i = 0; i < n; i++) {
    if (s.tiles[i] === Tile.BRAZIER_LIT) {
      sources.push({ x: i % s.w, y: (i / s.w) | 0, r: BRAZIER_RADIUS, boost: 0.95 });
    } else if (s.fire[i]! > 0) {
      sources.push({ x: i % s.w, y: (i / s.w) | 0, r: FIRE_LIGHT_RADIUS, boost: 0.85 });
    }
  }

  for (let i = 0; i < n; i++) {
    if (visible[i]! !== 1) continue;
    const x = i % s.w;
    const y = (i / s.w) | 0;
    let best = 0.2; // ambient floor for anything you can see at all (⚖ was
    // 0.14 — the design-art midtones drowned; preview-parity rebalance)
    for (const src of sources) {
      const dx = x - src.x;
      const dy = y - src.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const l = (1 - d / (src.r + 1.4)) * src.boost;
      if (l > best) best = l;
    }
    light[i] = Math.min(best, 1);
  }
  // you can always FEEL the floor you stand on — at radius 0 the delver
  // otherwise appears to float in void, which playtests read as a glitch
  const pi = s.py * s.w + s.px;
  if (visible[pi]! === 1 && light[pi]! < 0.34) light[pi] = 0.34;
  return light;
}

// ── Candle halo (elliptical for iso) ───────────────────────────────────────
export function positionHalo(halo: Phaser.GameObjects.Image, s: SimState, radius: number): void {
  if (radius <= 0) {
    halo.setVisible(false);
    return;
  }
  halo.setVisible(true);
  const dw = (radius * 2 + 1) * TILE_W * 0.85;
  const dh = (radius * 2 + 1) * TILE_H * 0.85;
  halo.setDisplaySize(dw, dh);
  const c = gridToScreen(s.px, s.py);
  halo.setPosition(c.sx, c.sy);
}

export function flickerHalo(halo: Phaser.GameObjects.Image, radius: number): void {
  if (!halo.visible) return;
  // quieter halo (⚖ was 0.95/0.72): the additive orange wash was drowning
  // the texture detail the design pass added — tiles carry the light now
  if (radius <= 2 && radius > 0) {
    halo.setAlpha(0.42 + Math.random() * 0.2 * (radius === 1 ? 1 : 0.5));
  } else {
    halo.setAlpha(0.55);
  }
}

// ── Source glows: pooled additive halos on braziers and fires ──────────────
export interface GlowPool {
  images: Map<string, Phaser.GameObjects.Image>;
}

export function syncSourceGlows(
  scene: Phaser.Scene,
  pool: GlowPool,
  s: SimState,
  visible: Uint8Array,
  depth: number,
  layer?: Phaser.GameObjects.Layer,
): void {
  const want = new Set<string>();
  const place = (key: string, x: number, y: number, tiles: number, tint: number): void => {
    want.add(key);
    let img = pool.images.get(key);
    if (img === undefined) {
      img = scene.add.image(0, 0, "halo");
      img.setBlendMode(Phaser.BlendModes.ADD);
      img.depth = depth;
      layer?.add(img);
      pool.images.set(key, img);
    }
    const c = gridToScreen(x, y);
    img.setPosition(c.sx, c.sy - 10);
    img.setDisplaySize(tiles * TILE_W, tiles * TILE_H * 1.4);
    img.setTint(tint);
    img.setVisible(true);
  };

  for (let i = 0; i < s.tiles.length; i++) {
    const x = i % s.w;
    const y = (i / s.w) | 0;
    if (s.tiles[i] === Tile.BRAZIER_LIT && visible[i]! === 1) {
      place(`b:${i}`, x, y, 2.6, COLOR.flame);
    } else if (s.fire[i]! > 0 && visible[i]! === 1) {
      place(`f:${i}`, x, y, 1.8, COLOR.ember);
    } else if (s.tiles[i] === Tile.WAYSTONE && visible[i]! === 1) {
      place(`w:${i}`, x, y, 1.3, COLOR.verdigris);
    }
  }
  pool.images.forEach((img, key) => {
    if (!want.has(key)) img.setVisible(false);
  });
}

/** Per-frame breathing of the source glows (cosmetic). */
export function pulseGlows(pool: GlowPool, time: number): void {
  pool.images.forEach((img, key) => {
    if (!img.visible) return;
    const phase = (key.charCodeAt(2) * 131) % 1000;
    const isFire = key.startsWith("f:");
    const speed = isFire ? 90 : 240;
    const amp = isFire ? 0.22 : 0.1;
    img.setAlpha(0.75 + amp * Math.sin((time + phase) / speed));
  });
}
