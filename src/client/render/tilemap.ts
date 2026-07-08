/**
 * Iso placeholder textures (token-conformant, canvas-generated). The real
 * atlas-packed diamond sets / wall kits with normal maps land at W4 with the
 * same keys — no scene-code change. Ground diamonds are packed into ONE
 * tileset strip ("iso-ground", index = TileId) consumed by the isometric
 * TilemapLayer; everything tall is an upright billboard sprite.
 */

import type Phaser from "phaser";
import { COLOR_CSS } from "../../../design/tokens/tokens.js";
import { Tile } from "../../shared/sim/types.js";
import { TILE_W, TILE_H, WALL_H } from "./iso.js";

const TILE_KINDS = 16;

function diamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

export function makeIsoTextures(scene: Phaser.Scene): void {
  const T = scene.textures;
  if (T.exists("iso-ground")) return; // Boot runs once, but be restart-safe

  // ── Ground tileset strip: TILE_KINDS diamonds of 64×32, index = TileId ──
  const strip = T.createCanvas("iso-ground", TILE_W * TILE_KINDS, TILE_H);
  if (strip !== null) {
    const ctx = strip.getContext();
    for (let t = 0; t < TILE_KINDS; t++) {
      const cx = t * TILE_W + TILE_W / 2;
      const cy = TILE_H / 2;
      if (t === Tile.VOID) continue; // transparent

      // base diamond: floor-ish for everything (walls/props get dark lids)
      const base =
        t === Tile.WALL ? COLOR_CSS.void : COLOR_CSS.surface;
      diamondPath(ctx, cx, cy, TILE_W - 2, TILE_H - 1);
      ctx.fillStyle = base;
      ctx.fill();
      ctx.strokeStyle = COLOR_CSS.borderVoid;
      ctx.lineWidth = 1;
      ctx.stroke();

      switch (t) {
        case Tile.MOSS:
          diamondPath(ctx, cx, cy, TILE_W - 22, TILE_H - 12);
          ctx.fillStyle = COLOR_CSS.verdigrisDim;
          ctx.globalAlpha = 0.55;
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        case Tile.WEBBING:
          ctx.strokeStyle = COLOR_CSS.boneDim;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx - 18, cy);
          ctx.lineTo(cx + 18, cy);
          ctx.moveTo(cx - 9, cy - 6);
          ctx.lineTo(cx + 9, cy + 6);
          ctx.moveTo(cx - 9, cy + 6);
          ctx.lineTo(cx + 9, cy - 6);
          ctx.stroke();
          break;
        case Tile.ENTRY:
          diamondPath(ctx, cx, cy, TILE_W - 14, TILE_H - 8);
          ctx.strokeStyle = COLOR_CSS.goldInk;
          ctx.lineWidth = 2;
          ctx.stroke();
          diamondPath(ctx, cx, cy, TILE_W - 28, TILE_H - 15);
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        case Tile.STAIRS_DOWN: {
          ctx.fillStyle = COLOR_CSS.flame;
          for (let s = 0; s < 3; s++) {
            diamondPath(ctx, cx, cy, TILE_W - 20 - s * 14, TILE_H - 12 - s * 7);
            ctx.globalAlpha = 0.45 + s * 0.25;
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          break;
        }
        default:
          break;
      }
    }
    strip.refresh();
  }

  // ── Wall billboard 64×96: lid diamond + two shaded faces ────────────────
  const wall = T.createCanvas("iso-wall", TILE_W, WALL_H);
  if (wall !== null) {
    const ctx = wall.getContext();
    const lidCy = TILE_H / 2;
    const faceH = WALL_H - TILE_H;
    // left (W) face — darker
    ctx.fillStyle = COLOR_CSS.void;
    ctx.beginPath();
    ctx.moveTo(0, lidCy);
    ctx.lineTo(TILE_W / 2, lidCy + TILE_H / 2);
    ctx.lineTo(TILE_W / 2, lidCy + TILE_H / 2 + faceH);
    ctx.lineTo(0, lidCy + faceH);
    ctx.closePath();
    ctx.fill();
    // right (S) face — lighter
    ctx.fillStyle = COLOR_CSS.surface2;
    ctx.beginPath();
    ctx.moveTo(TILE_W, lidCy);
    ctx.lineTo(TILE_W / 2, lidCy + TILE_H / 2);
    ctx.lineTo(TILE_W / 2, lidCy + TILE_H / 2 + faceH);
    ctx.lineTo(TILE_W, lidCy + faceH);
    ctx.closePath();
    ctx.fill();
    // lid
    diamondPath(ctx, TILE_W / 2, lidCy, TILE_W, TILE_H);
    ctx.fillStyle = COLOR_CSS.surface2;
    ctx.fill();
    ctx.strokeStyle = COLOR_CSS.borderVoid;
    ctx.lineWidth = 1;
    ctx.stroke();
    // face seam + edge ink
    ctx.strokeStyle = COLOR_CSS.borderVoid;
    ctx.beginPath();
    ctx.moveTo(TILE_W / 2, lidCy + TILE_H / 2);
    ctx.lineTo(TILE_W / 2, WALL_H);
    ctx.stroke();
    wall.refresh();
  }

  // ── Doors (closed / stuck / open) 64×96 ─────────────────────────────────
  const doorTex = (key: string, panel: boolean, stuck: boolean): void => {
    const c = T.createCanvas(key, TILE_W, WALL_H);
    if (c === null) return;
    const ctx = c.getContext();
    const baseY = WALL_H - TILE_H / 2;
    // posts
    ctx.fillStyle = COLOR_CSS.inkSoft;
    ctx.fillRect(8, baseY - 56, 8, 56);
    ctx.fillRect(TILE_W - 16, baseY - 56, 8, 56);
    if (panel) {
      ctx.fillStyle = COLOR_CSS.parchmentAged;
      ctx.fillRect(14, baseY - 52, TILE_W - 28, 52);
      ctx.strokeStyle = COLOR_CSS.ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(14, baseY - 52, TILE_W - 28, 52);
      if (stuck) {
        ctx.strokeStyle = COLOR_CSS.seal;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(16, baseY - 50);
        ctx.lineTo(TILE_W - 16, baseY - 4);
        ctx.stroke();
      }
    }
    c.refresh();
  };
  doorTex("iso-door-closed", true, false);
  doorTex("iso-door-stuck", true, true);
  doorTex("iso-door-open", false, false);

  // ── Props ────────────────────────────────────────────────────────────────
  const brazier = (key: string, lit: boolean): void => {
    const c = T.createCanvas(key, 40, 56);
    if (c === null) return;
    const ctx = c.getContext();
    ctx.fillStyle = COLOR_CSS.inkSoft;
    ctx.fillRect(17, 30, 6, 22); // pedestal
    ctx.beginPath();
    ctx.ellipse(20, 28, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLOR_CSS.boneDim;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (lit) {
      ctx.fillStyle = COLOR_CSS.flame;
      ctx.beginPath();
      ctx.ellipse(20, 18, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLOR_CSS.flameHi;
      ctx.beginPath();
      ctx.ellipse(20, 20, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    c.refresh();
  };
  brazier("iso-brazier", false);
  brazier("iso-brazier-lit", true);

  const waystone = T.createCanvas("iso-waystone", 36, 60);
  if (waystone !== null) {
    const ctx = waystone.getContext();
    ctx.fillStyle = COLOR_CSS.verdigrisDim;
    ctx.fillRect(10, 46, 16, 8);
    ctx.fillStyle = COLOR_CSS.verdigris;
    ctx.beginPath();
    ctx.moveTo(18, 2);
    ctx.lineTo(28, 14);
    ctx.lineTo(26, 50);
    ctx.lineTo(10, 50);
    ctx.lineTo(8, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLOR_CSS.verdigrisDim;
    ctx.stroke();
    waystone.refresh();
  }

  const pickup = (key: string, r: number, tall: boolean): void => {
    const c = T.createCanvas(key, 28, 30);
    if (c === null) return;
    const ctx = c.getContext();
    if (tall) {
      ctx.fillStyle = COLOR_CSS.bone;
      ctx.fillRect(14 - r / 2, 26 - r * 2, r, r * 2);
    }
    ctx.fillStyle = COLOR_CSS.flameHi;
    ctx.beginPath();
    ctx.arc(14, tall ? 26 - r * 2 : 24, r, 0, Math.PI * 2);
    ctx.fill();
    c.refresh();
  };
  pickup("iso-wax-drip", 3, false);
  pickup("iso-wax-stub", 4, true);
  pickup("iso-wax-cake", 5, true);

  // ── Entities (upright billboards ~56 px, bottom-center anchor, E/W flip) —
  // deliberately asymmetric (snout/eye offset right) so setFlipX reads.
  const ent = (key: string, wpx: number, hpx: number, body: string, core: string): void => {
    const c = T.createCanvas(key, wpx, hpx);
    if (c === null) return;
    const ctx = c.getContext();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(wpx / 2, hpx * 0.62, wpx * 0.36, hpx * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); // head, offset right = facing E by default
    ctx.ellipse(wpx * 0.68, hpx * 0.32, wpx * 0.22, hpx * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(wpx * 0.74, hpx * 0.3, Math.max(2, wpx * 0.06), 0, Math.PI * 2);
    ctx.fill();
    c.refresh();
  };
  ent("iso-ent-1", 30, 24, COLOR_CSS.boneDim, COLOR_CSS.bone); // Tallow Rat
  ent("iso-ent-2", 36, 34, COLOR_CSS.ember, COLOR_CSS.flameHi); // Wickworm
  ent("iso-ent-3", 26, 26, COLOR_CSS.parchmentAged, COLOR_CSS.parchment); // Vesper Moth
  ent("iso-ent-4", 56, 62, COLOR_CSS.flame, COLOR_CSS.ink); // Chandler Beast

  const player = T.createCanvas("iso-player", 32, 52);
  if (player !== null) {
    const ctx = player.getContext();
    ctx.fillStyle = COLOR_CSS.inkSoft; // hooded delver silhouette
    ctx.beginPath();
    ctx.moveTo(16, 6);
    ctx.lineTo(26, 20);
    ctx.lineTo(24, 50);
    ctx.lineTo(8, 50);
    ctx.lineTo(6, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLOR_CSS.flame; // held candle, offset right (E default)
    ctx.fillRect(26, 22, 3, 12);
    ctx.fillStyle = COLOR_CSS.flameHi;
    ctx.beginPath();
    ctx.arc(27.5, 19, 3.5, 0, Math.PI * 2);
    ctx.fill();
    player.refresh();
  }

  // unit diamond for overlays (salt/chalk/fire tints, fog is Graphics)
  const dia = T.createCanvas("iso-diamond", TILE_W, TILE_H);
  if (dia !== null) {
    const ctx = dia.getContext();
    diamondPath(ctx, TILE_W / 2, TILE_H / 2, TILE_W - 2, TILE_H - 1);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    dia.refresh();
  }
}

/** Ground tileset index for a sim tile (props/walls ride on billboards). */
export function groundIndexFor(t: number): number {
  switch (t) {
    case Tile.VOID:
      return -1;
    case Tile.MOSS:
    case Tile.WEBBING:
    case Tile.ENTRY:
    case Tile.STAIRS_DOWN:
    case Tile.WALL:
      return t;
    default:
      return Tile.FLOOR; // features stand on plain floor diamonds
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
