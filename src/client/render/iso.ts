/**
 * THE single owner of the isometric projection (02 §8, 03 §5 risk register:
 * "single depth formula `(x+y)+bias` owned by iso.ts, never ad-hoc").
 * The sim NEVER learns iso exists — everything here is render/input-side.
 *
 * 2:1 dimetric: screenX=(x−y)·32 · screenY=(x+y)·16 (z-lift unused in slice).
 * `calibrate()` absorbs whatever origin convention the Phaser isometric
 * TilemapLayer uses so sprites and ground diamonds can never drift apart.
 */

export const TILE_W = 64; // ground diamond art px (decided)
export const TILE_H = 32;
export const WALL_H = 96; // tall wall pieces (decided)
export const HALF_W = TILE_W >> 1;
export const HALF_H = TILE_H >> 1;

/** Layer bias (decided order): ground<corpse<item<entity<wall<fx. */
export const Layer = {
  GROUND: 0,
  CORPSE: 1,
  ITEM: 2,
  ENTITY: 3,
  WALL: 4,
  FX: 5,
} as const;

let originX = 0;
let originY = 0;

/** Align this module to the TilemapLayer's world position for tile (0,0)
 *  center. Call once per floor build. */
export function calibrate(worldCenterX0: number, worldCenterY0: number): void {
  originX = worldCenterX0;
  originY = worldCenterY0;
}

/** Grid → world coords of the DIAMOND CENTER of tile (x, y). */
export function gridToScreen(x: number, y: number): { sx: number; sy: number } {
  return {
    sx: originX + (x - y) * HALF_W,
    sy: originY + (x + y) * HALF_H,
  };
}

/** World point → grid tile (diamond hit-test exact). Returns null off-grid. */
export function screenToGrid(
  wx: number,
  wy: number,
  w: number,
  h: number,
): { x: number; y: number } | null {
  const fx = (wx - originX) / HALF_W;
  const fy = (wy - originY) / HALF_H;
  const gx = Math.round((fx + fy) / 2);
  const gy = Math.round((fy - fx) / 2);
  if (gx < 0 || gy < 0 || gx >= w || gy >= h) return null;
  // exact diamond membership: |dx|/HALF_W + |dy|/HALF_H ≤ 1
  const c = gridToScreen(gx, gy);
  const dx = Math.abs(wx - c.sx) / HALF_W;
  const dy = Math.abs(wy - c.sy) / HALF_H;
  if (dx + dy > 1.05) return null; // 5% grace keeps ≥44px effective targets
  return { x: gx, y: gy };
}

/** THE depth formula. Never compute depth anywhere else. */
export function depthOf(x: number, y: number, layer: number): number {
  return (x + y) * 10 + layer;
}

/**
 * Wall occlusion test (decided: walls SE of the player overlapping their
 * sprite fade to 35% alpha in 120 ms). A wall at (wx,wy) occludes the
 * player at (px,py) when it sorts in front AND its screen footprint
 * overlaps the player's upright billboard.
 */
export function occludes(px: number, py: number, wx: number, wy: number): boolean {
  if (wx + wy <= px + py) return false; // not in front
  const p = gridToScreen(px, py);
  const w = gridToScreen(wx, wy);
  const dx = Math.abs(w.sx - p.sx);
  const dyDown = w.sy - p.sy; // wall base below player base on screen
  return dx < TILE_W * 0.75 && dyDown > 0 && dyDown <= WALL_H + TILE_H;
}

export const OCCLUDED_ALPHA = 0.35;
export const OCCLUSION_FADE_MS = 120;

/** Grid reference for the inspect plaque ("Fl. VII · K4"): column letter,
 *  1-based row (01 §6). */
export function gridRef(x: number, y: number): string {
  return `${String.fromCharCode(65 + x)}${y + 1}`;
}

/** World-extent helpers for camera bounds. MARGIN keeps the clamped camera
 *  from fighting zoom-to-fit centering on small floors / zoomed-out views. */
const BOUNDS_MARGIN = 320;
export function worldBounds(w: number, h: number): { x: number; y: number; width: number; height: number } {
  const left = gridToScreen(0, h - 1).sx - HALF_W - BOUNDS_MARGIN;
  const right = gridToScreen(w - 1, 0).sx + HALF_W + BOUNDS_MARGIN;
  const top = gridToScreen(0, 0).sy - HALF_H - WALL_H - BOUNDS_MARGIN;
  const bottom = gridToScreen(w - 1, h - 1).sy + HALF_H + TILE_H + BOUNDS_MARGIN;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Camera zoom that FILLS the frame with world (D62 — the earlier
 * fit-the-whole-pool version zoomed out into a lifeless miniature).
 * Portrait: ~7 diamonds across the width — close and immersive; the pool
 * edge cropping offscreen is normal game framing. Landscape: ~12 across,
 * bounded by vertical room so walls keep headroom. Clamped ≥1 so the world
 * never shrinks below native, ≤1.6 so huge desktop windows stay tactical.
 */
export function fitZoom(viewW: number, viewH: number): number {
  const portrait = viewH >= viewW;
  const target = portrait
    ? viewW / (7 * TILE_W)
    : Math.min(viewW / (12 * TILE_W), (viewH - 160) / (8 * TILE_H));
  return Math.min(1.6, Math.max(1, target));
}
