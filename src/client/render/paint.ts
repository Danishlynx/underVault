/**
 * Shared canvas-painting helpers (D71): token-derived color math, the
 * supersampled-authoring pipeline, and the fixed-seed cosmetic LCG. Split
 * out of tilemap.ts so per-biome deco modules (render/decos/*) can import
 * them without a circular dependency. All drawing everywhere goes through
 * these — no foreign hex in drawing code, no Math.random in textures.
 */

import type Phaser from "phaser";

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

// ── Fixed-seed LCG for cosmetic speckle (stable across boots) ──────────────
let lcg = 0x1234567;
export function crandSeed(seed: number): void {
  lcg = seed >>> 0 || 0x1234567;
}
export function crand(): number {
  lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0;
  return lcg / 0xffffffff;
}

// ── Supersampled authoring ─────────────────────────────────────────────────
// Canvas antialiasing at 1× muddies the fine work (0.6–1.2 px strokes,
// mineral speckle, glyph serifs). Every texture is therefore drawn onto a 4×
// offscreen master and filtered down into the contract-size canvas — same
// keys, same geometry, maximum per-pixel sharpness the format allows.
export const SS = 4;
let ssMaster: HTMLCanvasElement | null = null;
export function hiBegin(t: Phaser.Textures.CanvasTexture): CanvasRenderingContext2D {
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
export function hiEnd(t: Phaser.Textures.CanvasTexture, keepHiRes = true): void {
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
