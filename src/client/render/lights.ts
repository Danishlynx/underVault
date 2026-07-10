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
export function lerpColor(a: number, b: number, t: number): number {
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

// ── Feature glow tints (D69) ───────────────────────────────────────────────
// The reference dioramas pool COLORED light around every archway. Special
// doors and shrines are already visible tile types (no secret leaks), so
// each stains the nearby floor with its own palette-safe hue. Renderer
// cosmetics only; sources tint nothing until their tile enters FOV.
interface FeatureGlowDef {
  color: number;
  radius: number;
  strength: number;
}
const FEATURE_GLOWS: Record<number, FeatureGlowDef> = {
  [Tile.DOOR_HUNGER]: { color: COLOR.ember, radius: 3, strength: 0.5 },
  [Tile.DOOR_CHOIR]: { color: COLOR.verdigris, radius: 3, strength: 0.45 },
  [Tile.DOOR_SIGIL]: { color: COLOR.seal, radius: 3, strength: 0.5 },
  [Tile.DOOR_IRON]: { color: COLOR.boneDim, radius: 2, strength: 0.4 },
  [Tile.ALTAR]: { color: COLOR.goldInk, radius: 3, strength: 0.5 },
  [Tile.POOL]: { color: COLOR.verdigrisDim, radius: 3, strength: 0.5 },
  [Tile.FONT]: { color: COLOR.parchment, radius: 2, strength: 0.35 },
  [Tile.SEAL]: { color: COLOR.goldInk, radius: 4, strength: 0.6 },
  [Tile.WAYSTONE]: { color: COLOR.verdigris, radius: 3, strength: 0.45 },
  [Tile.GLOWMOSS]: { color: COLOR.verdigris, radius: 2, strength: 0.5 },
  [Tile.INSCRIPTION]: { color: COLOR.verdigrisDim, radius: 2, strength: 0.3 },
};

/** Per-tile hue stain from visible glowing features: index → lerp target. */
export function computeGlowTints(s: SimState, visible: Uint8Array): Map<number, { color: number; t: number }> {
  const out = new Map<number, { color: number; t: number }>();
  for (let i = 0; i < s.tiles.length; i++) {
    const def = FEATURE_GLOWS[s.tiles[i]!];
    if (def === undefined || visible[i]! !== 1) continue;
    const gx = i % s.w;
    const gy = (i / s.w) | 0;
    for (let dy = -def.radius; dy <= def.radius; dy++) {
      for (let dx = -def.radius; dx <= def.radius; dx++) {
        const x = gx + dx;
        const y = gy + dy;
        if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        const t = def.strength * Math.max(0, 1 - d / (def.radius + 0.6));
        if (t <= 0.02) continue;
        const ti = y * s.w + x;
        const prev = out.get(ti);
        if (prev === undefined || prev.t < t) out.set(ti, { color: def.color, t });
      }
    }
  }
  return out;
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
  // hug the lit tiles (D81): the old 0.85 factor left a wide warm tail
  // glowing over pure void — light with nothing to catch it reads as fog
  const dw = (radius * 2 + 1) * TILE_W * 0.7;
  const dh = (radius * 2 + 1) * TILE_H * 0.7;
  halo.setDisplaySize(dw, dh);
  const c = gridToScreen(s.px, s.py);
  halo.setPosition(c.sx, c.sy);
}

export function flickerHalo(halo: Phaser.GameObjects.Image, radius: number): void {
  if (!halo.visible) return;
  // quieter halo (⚖ was 0.95/0.72): the additive orange wash was drowning
  // the texture detail the design pass added — tiles carry the light now
  if (radius <= 2 && radius > 0) {
    halo.setAlpha(0.36 + Math.random() * 0.18 * (radius === 1 ? 1 : 0.5));
  } else {
    halo.setAlpha(0.46);
  }
}

// ── Source glows: pooled additive halos on braziers and fires ──────────────
export interface GlowPool {
  images: Map<string, Phaser.GameObjects.Image>;
}

// furnace heat-haze controllers, keyed by glow image (D77)
const hazeMap = new WeakMap<Phaser.GameObjects.Image, Phaser.Filters.Displacement>();

export function syncSourceGlows(
  scene: Phaser.Scene,
  pool: GlowPool,
  s: SimState,
  visible: Uint8Array,
  depth: number,
  layer?: Phaser.GameObjects.Layer,
  haze = false,
): void {
  const want = new Set<string>();
  const flames: { img: Phaser.GameObjects.Image; d: number }[] = [];
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

  // colored feature halos (D69): every glowing archway/shrine gets a soft
  // additive pool, like the reference dioramas — visible tiles only
  const FEATURE_HALO: Record<number, [number, number]> = {
    [Tile.BRAZIER_LIT]: [2.6, COLOR.flame],
    [Tile.WAYSTONE]: [1.3, COLOR.verdigris],
    [Tile.DOOR_HUNGER]: [1.7, COLOR.ember],
    [Tile.DOOR_CHOIR]: [1.7, COLOR.verdigris],
    [Tile.DOOR_SIGIL]: [1.7, COLOR.seal],
    [Tile.ALTAR]: [1.9, COLOR.goldInk],
    [Tile.POOL]: [1.8, COLOR.verdigrisDim],
    [Tile.SEAL]: [2.4, COLOR.goldInk],
    [Tile.GLOWMOSS]: [1.4, COLOR.verdigris],
  };
  for (let i = 0; i < s.tiles.length; i++) {
    if (visible[i]! !== 1) continue;
    const x = i % s.w;
    const y = (i / s.w) | 0;
    const t = s.tiles[i]!;
    if (t === Tile.BRAZIER_LIT) {
      place(`b:${i}`, x, y, 2.6, COLOR.flame);
      if (haze) {
        const img = pool.images.get(`b:${i}`);
        if (img !== undefined) flames.push({ img, d: Math.abs(x - s.px) + Math.abs(y - s.py) });
      }
    } else if (s.fire[i]! > 0) {
      place(`f:${i}`, x, y, 1.8, COLOR.ember);
      if (haze) {
        const img = pool.images.get(`f:${i}`);
        if (img !== undefined) flames.push({ img, d: Math.abs(x - s.px) + Math.abs(y - s.py) });
      }
    } else if (t === Tile.WAYSTONE) place(`w:${i}`, x, y, 1.3, COLOR.verdigris);
    else if (FEATURE_HALO[t] !== undefined) {
      const [tiles, tint] = FEATURE_HALO[t];
      place(`d:${i}`, x, y, tiles, tint);
    }
  }
  pool.images.forEach((img, key) => {
    if (!want.has(key)) img.setVisible(false);
  });

  // furnace heat-haze (D77): OBJECT-scoped displacement — small render
  // targets, never full-screen. Only the 3 nearest visible flames shimmer.
  if (haze) {
    flames.sort((a, b) => a.d - b.d);
    flames.forEach(({ img }, idx) => {
      const existing = hazeMap.get(img);
      if (idx < 3 && existing === undefined) {
        img.enableFilters();
        const disp = img.filters?.internal.addDisplacement("uv-grain", 0.004, 0.01);
        if (disp !== undefined) hazeMap.set(img, disp);
      } else if (idx >= 3 && existing !== undefined) {
        img.filters?.internal.remove(existing, true);
        hazeMap.delete(img);
      }
    });
  }
}

/** Per-frame breathing of the source glows (cosmetic). */
export function pulseGlows(pool: GlowPool, time: number): void {
  pool.images.forEach((img, key) => {
    if (!img.visible) return;
    const phase = (key.charCodeAt(2) * 131) % 1000;
    const isFire = key.startsWith("f:");
    const isFeature = key.startsWith("d:"); // quieter than open flame (D69)
    const speed = isFire ? 90 : isFeature ? 340 : 240;
    const amp = isFire ? 0.22 : isFeature ? 0.07 : 0.1;
    const base = isFeature ? 0.42 : 0.75;
    img.setAlpha(base + amp * Math.sin((time + phase) / speed));
    // heat shimmer rides the same clock (D77)
    const disp = hazeMap.get(img);
    if (disp !== undefined) {
      disp.y = 0.008 + 0.004 * Math.sin((time + phase) / 170);
      disp.x = 0.003 * Math.sin((time + phase) / 230);
    }
  });
}
