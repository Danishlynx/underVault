/**
 * World terrain + overlay drawing (placeholder art, token-conformant).
 * Redrawn once per TURN (turn-based), not per frame — a full 24×24 Graphics
 * pass is far under budget. Real tile atlases replace this at W4.
 * All colors come from design tokens — no hardcoded hex (CLAUDE.md).
 */

import type Phaser from "phaser";
import { COLOR, CANVAS } from "../../../design/tokens/tokens.js";
import { Tile, type SimState } from "../../shared/sim/types.js";

const C = CANVAS.cellPx; // 48

export function drawTerrain(g: Phaser.GameObjects.Graphics, s: SimState): void {
  g.clear();
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const t = s.tiles[y * s.w + x]!;
      const px = x * C;
      const py = y * C;

      // base
      switch (t) {
        case Tile.VOID:
          g.fillStyle(COLOR.void, 1);
          break;
        case Tile.WALL:
          g.fillStyle(COLOR.surface2, 1);
          break;
        default:
          g.fillStyle(COLOR.surface, 1);
          break;
      }
      g.fillRect(px, py, C, C);

      switch (t) {
        case Tile.WALL: // inked top edge for relief
          g.fillStyle(COLOR.borderVoid, 1);
          g.fillRect(px, py, C, 4);
          break;
        case Tile.MOSS:
          g.fillStyle(COLOR.verdigrisDim, 0.45);
          g.fillRect(px + 4, py + 4, C - 8, C - 8);
          break;
        case Tile.WEBBING:
          g.lineStyle(2, COLOR.boneDim, 0.7);
          g.lineBetween(px + 6, py + 6, px + C - 6, py + C - 6);
          g.lineBetween(px + C - 6, py + 6, px + 6, py + C - 6);
          g.lineBetween(px + 6, py + (C >> 1), px + C - 6, py + (C >> 1));
          break;
        case Tile.DOOR_CLOSED:
          g.fillStyle(COLOR.parchmentAged, 1);
          g.fillRect(px + 6, py + 4, C - 12, C - 8);
          g.lineStyle(2, COLOR.ink, 1);
          g.strokeRect(px + 6, py + 4, C - 12, C - 8);
          break;
        case Tile.DOOR_STUCK:
          g.fillStyle(COLOR.parchmentAged, 1);
          g.fillRect(px + 6, py + 4, C - 12, C - 8);
          g.lineStyle(3, COLOR.seal, 1);
          g.lineBetween(px + 6, py + 4, px + C - 6, py + C - 4);
          g.lineStyle(2, COLOR.ink, 1);
          g.strokeRect(px + 6, py + 4, C - 12, C - 8);
          break;
        case Tile.DOOR_OPEN:
          g.fillStyle(COLOR.parchmentAged, 0.9);
          g.fillRect(px, py + 4, 6, C - 8);
          g.fillRect(px + C - 6, py + 4, 6, C - 8);
          break;
        case Tile.ENTRY:
          g.lineStyle(3, COLOR.goldInk, 0.9);
          g.strokeRect(px + 5, py + 5, C - 10, C - 10);
          g.lineStyle(1, COLOR.goldInk, 0.5);
          g.strokeRect(px + 10, py + 10, C - 20, C - 20);
          break;
        case Tile.STAIRS_DOWN:
          g.fillStyle(COLOR.flame, 0.85);
          g.fillRect(px + 8, py + 10, C - 16, 6);
          g.fillRect(px + 12, py + 21, C - 24, 6);
          g.fillRect(px + 16, py + 32, C - 32, 6);
          break;
        case Tile.WAYSTONE:
          g.fillStyle(COLOR.verdigris, 0.95);
          g.fillRect(px + 18, py + 6, C - 36, C - 12);
          g.fillStyle(COLOR.verdigrisDim, 1);
          g.fillRect(px + 12, py + C - 12, C - 24, 6);
          break;
        case Tile.BRAZIER_UNLIT:
          g.fillStyle(COLOR.inkSoft, 1);
          g.fillCircle(px + (C >> 1), py + (C >> 1), 12);
          g.lineStyle(2, COLOR.boneDim, 0.8);
          g.strokeCircle(px + (C >> 1), py + (C >> 1), 12);
          break;
        case Tile.BRAZIER_LIT:
          g.fillStyle(COLOR.inkSoft, 1);
          g.fillCircle(px + (C >> 1), py + (C >> 1), 12);
          g.fillStyle(COLOR.flame, 1);
          g.fillCircle(px + (C >> 1), py + (C >> 1) - 2, 8);
          g.fillStyle(COLOR.flameHi, 1);
          g.fillCircle(px + (C >> 1), py + (C >> 1) - 4, 4);
          break;
        case Tile.WAX_DRIP:
          g.fillStyle(COLOR.flameHi, 0.9);
          g.fillCircle(px + (C >> 1), py + (C >> 1), 4);
          break;
        case Tile.WAX_STUB:
          g.fillStyle(COLOR.bone, 1);
          g.fillRect(px + 19, py + 20, 10, 14);
          g.fillStyle(COLOR.flameHi, 1);
          g.fillCircle(px + 24, py + 18, 4);
          break;
        case Tile.WAX_CAKE:
          g.fillStyle(COLOR.bone, 1);
          g.fillRect(px + 12, py + 22, 24, 14);
          g.fillStyle(COLOR.flameHi, 1);
          g.fillCircle(px + 24, py + 18, 5);
          break;
      }

      // overlays: salt line, chalk mark, fire
      const i = y * s.w + x;
      if (s.salt[i]! !== 0) {
        g.fillStyle(COLOR.parchment, 0.95);
        for (let d = 0; d < 4; d++) {
          g.fillCircle(px + 10 + d * 9, py + (C >> 1) + ((d & 1) === 0 ? -4 : 4), 3);
        }
      }
      if (s.chalk[i]! !== 0) {
        g.lineStyle(3, COLOR.parchment, 0.9);
        g.lineBetween(px + 14, py + 14, px + C - 14, py + C - 14);
        g.lineBetween(px + C - 14, py + 14, px + 14, py + C - 14);
      }
      if (s.fire[i]! > 0) {
        g.fillStyle(COLOR.ember, 0.75);
        g.fillRect(px + 4, py + 4, C - 8, C - 8);
        g.fillStyle(COLOR.flame, 0.9);
        g.fillRect(px + 12, py + 10, C - 24, C - 20);
        g.fillStyle(COLOR.flameHi, 0.95);
        g.fillCircle(px + (C >> 1), py + (C >> 1), 6);
      }
    }
  }
}

export interface EntityStyle {
  size: number;
  color: number;
  core: number;
}

export function entityStyle(kind: number): EntityStyle {
  switch (kind) {
    case 1: // Tallow Rat
      return { size: 18, color: COLOR.boneDim, core: COLOR.bone };
    case 2: // Wickworm
      return { size: 24, color: COLOR.ember, core: COLOR.flameHi };
    case 3: // Vesper Moth
      return { size: 16, color: COLOR.parchmentAged, core: COLOR.parchment };
    case 4: // Chandler Beast
      return { size: 40, color: COLOR.flame, core: COLOR.ink };
    default:
      return { size: 20, color: COLOR.bone, core: COLOR.ink };
  }
}
