/**
 * Symmetric shadowcasting (Albert Ford's formulation) with INTEGER rational
 * slopes — comparisons via cross-multiplication, never float slopes.
 * Magnitudes: depth ≤ 48, slope numerators ≤ 2·48+1 → products ≤ ~10⁴,
 * far inside exact-integer float range; divisions below are integer-exact
 * truncations `(a/b)|0` with sign-corrected floor/ceil (documented per use).
 *
 * Visibility model (DECISIONS 22/23 + 01 §5):
 *   visible = candleLit(player, r) ∪ (LOS(player) ∩ (brazierGlow ∪ fireGlow))
 * so a snuffed / Dark-Grace delver still sees distant lit braziers and fires
 * they have line of sight to. Own tile always visible.
 */

import { TILE_FLAGS, F_OPAQUE, BRAZIER_RADIUS, FIRE_LIGHT_RADIUS } from "./constants.js";
import { Tile, type SimState } from "./types.js";

// Quadrant transforms: 0=N 1=E 2=S 3=W; (depth, col) → (x, y)
function qx(q: number, ox: number, depth: number, col: number): number {
  if (q === 0 || q === 2) return ox + col;
  return q === 1 ? ox + depth : ox - depth;
}
function qy(q: number, oy: number, depth: number, col: number): number {
  if (q === 1 || q === 3) return oy + col;
  return q === 0 ? oy - depth : oy + depth;
}

/** floor(a/b) for b > 0. `(a/b)|0` truncates toward zero (exact: |a|,b < 2^20). */
function floorDiv(a: number, b: number): number {
  const q = (a / b) | 0;
  return a < 0 && q * b !== a ? q - 1 : q;
}
/** ceil(a/b) for b > 0. */
function ceilDiv(a: number, b: number): number {
  const q = (a / b) | 0;
  return a > 0 && q * b !== a ? q + 1 : q;
}

/**
 * Cast light/sight from (ox, oy) into `out` (w*h bytes, 1 = revealed).
 * radius: integer disc d² ≤ r²+r; radius < 0 = unbounded (LOS mode).
 * Opacity from TILE_FLAGS. Does not clear `out` (callers union into it).
 */
export function shadowcast(
  tiles: Uint8Array,
  w: number,
  h: number,
  ox: number,
  oy: number,
  radius: number,
  out: Uint8Array,
): void {
  out[oy * w + ox] = 1;
  const maxDepth = radius < 0 ? w + h : radius;
  const r2 = radius < 0 ? 0 : Math.imul(radius, radius) + radius;

  const opaqueAt = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    return (TILE_FLAGS[tiles[y * w + x]!]! & F_OPAQUE) !== 0;
  };
  const inDisc = (dx: number, dy: number): boolean =>
    radius < 0 || Math.imul(dx, dx) + Math.imul(dy, dy) <= r2;

  for (let q = 0; q < 4; q++) {
    // Row stack: [depth, startNum, startDen, endNum, endDen] (dens > 0)
    const stack: number[][] = [[1, -1, 1, 1, 1]];
    while (stack.length > 0) {
      const row = stack.pop()!;
      const depth = row[0]!;
      let sn = row[1]!; // start slope: sn/sd — LIVE-updated on wall→floor
      let sd = row[2]!;
      const en = row[3]!;
      const ed = row[4]!;
      if (depth > maxDepth) continue;

      // col range: minCol = roundTiesUp(depth·s) = floor((2·depth·sn + sd) / (2·sd))
      //            maxCol = roundTiesDown(depth·e) = ceil((2·depth·en − ed) / (2·ed))
      const minCol = floorDiv(Math.imul(2 * depth, sn) + sd, 2 * sd);
      const maxCol = ceilDiv(Math.imul(2 * depth, en) - ed, 2 * ed);

      let prevOpaque = -1; // -1 = none yet, 0 = floor, 1 = wall
      for (let col = minCol; col <= maxCol; col++) {
        const x = qx(q, ox, depth, col);
        const y = qy(q, oy, depth, col);
        const isOpaque = opaqueAt(x, y);
        // symmetric check against the LIVE start slope: col ≥ depth·start AND col ≤ depth·end
        const sym =
          Math.imul(col, sd) >= Math.imul(depth, sn) &&
          Math.imul(col, ed) <= Math.imul(depth, en);
        if ((isOpaque || sym) && inDisc(col, depth) && x >= 0 && y >= 0 && x < w && y < h) {
          out[y * w + x] = 1;
        }
        if (prevOpaque === 1 && !isOpaque) {
          // wall → floor: advance start slope to this tile's near edge
          sn = 2 * col - 1;
          sd = 2 * depth;
        }
        if (prevOpaque === 0 && isOpaque) {
          // floor → wall: recurse deeper with end slope at this tile's near edge
          stack.push([depth + 1, sn, sd, 2 * col - 1, 2 * depth]);
        }
        prevOpaque = isOpaque ? 1 : 0;
      }
      if (prevOpaque === 0) {
        stack.push([depth + 1, sn, sd, en, ed]);
      }
    }
  }
}

/**
 * Full visibility for the current state given the player's effective candle
 * radius (engine computes tier − moth drain − cupping). Pure; fresh buffer.
 */
export function computeVisible(s: SimState, candleRadius: number): Uint8Array {
  const n = s.w * s.h;
  const visible = new Uint8Array(n);

  // 1. Candle light
  if (candleRadius > 0) {
    shadowcast(s.tiles, s.w, s.h, s.px, s.py, candleRadius, visible);
  }

  // 2. Static glows (braziers, fire), gated by player LOS
  let hasSource = false;
  const glow = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (s.tiles[i] === Tile.BRAZIER_LIT) {
      shadowcast(s.tiles, s.w, s.h, i % s.w, (i / s.w) | 0, BRAZIER_RADIUS, glow);
      hasSource = true;
    } else if (s.fire[i]! > 0) {
      shadowcast(s.tiles, s.w, s.h, i % s.w, (i / s.w) | 0, FIRE_LIGHT_RADIUS, glow);
      hasSource = true;
    }
  }
  if (hasSource) {
    const los = new Uint8Array(n);
    shadowcast(s.tiles, s.w, s.h, s.px, s.py, -1, los);
    for (let i = 0; i < n; i++) {
      if (glow[i]! === 1 && los[i]! === 1) visible[i] = 1;
    }
  }

  visible[s.py * s.w + s.px] = 1; // own tile always
  return visible;
}
