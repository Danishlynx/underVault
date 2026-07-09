// DEV-ONLY: deleted at M2. The Tower X-Ray: press M to see every floor of
// today's seed rendered in the REAL isometric art, fully lit (gallery
// lighting, no fog) — an operator/QA judging tool. It exists only here
// because the production client must never see floors it has not earned
// (02 §4: per-floor delivery); the dev adapter generates locally. It blits
// the live Phaser canvas textures, so what you see is exactly the game's
// art. (Local 2:1 math is a knowing duplication of iso.ts — dev-only file,
// dies with the harness.)

import type Phaser from "phaser";
import { Tile, EntityKind, type FloorData } from "../src/shared/sim/types.js";
import { biomeFor, BIOMES, MAX_FLOOR, TILE_FLAGS, F_OPAQUE } from "../src/shared/sim/constants.js";
import {
  ensureBiomeSkin,
  entityTextureFor,
  groundIndexFor,
  propTextureFor,
  skinSuffix,
  GROUND_SCALE,
  TEX_SCALE,
} from "../src/client/render/tilemap.js";
import { TILE_W, TILE_H, HALF_W, HALF_H, WALL_H } from "../src/client/render/iso.js";
import type { GamePorts } from "../src/client/net/ports.js";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  "XXI", "XXII", "XXIII", "XXIV", "XXV"];

const SCALE = 0.3; // gallery thumbnails

type Src = HTMLCanvasElement | HTMLImageElement;

/** Mirror of Descent.wallTextureAt — identical hashes, identical picks. */
function wallKeyAt(fd: FloorData, x: number, y: number, suf: string): string {
  const open = (xx: number, yy: number): boolean => {
    if (xx < 0 || yy < 0 || xx >= fd.w || yy >= fd.h) return false;
    const t = fd.tiles[yy * fd.w + xx]!;
    return (
      (TILE_FLAGS[t]! & F_OPAQUE) === 0 ||
      t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK || t === Tile.DOOR_IRON ||
      t === Tile.DOOR_HUNGER || t === Tile.DOOR_CHOIR || t === Tile.DOOR_SIGIL
    );
  };
  if (open(x - 1, y) || open(x, y - 1) || open(x - 1, y - 1)) return `iso-wall-cut${suf}`;
  const h = (Math.imul(x, 131) ^ Math.imul(y, 61) ^ Math.imul(fd.floor + 1, 401)) >>> 0;
  const r = h % 100;
  if (open(x + 1, y) || open(x, y + 1) || open(x + 1, y + 1)) {
    const k = r < 36 ? "iso-wall" : r < 58 ? "iso-wall-broken" : r < 72 ? "iso-wall-2" : r < 86 ? "iso-wall-3" : "iso-wall-4";
    return k + suf;
  }
  return (r < 72 ? "iso-wall" : "iso-wall-broken") + suf;
}

function renderFloorIso(fd: FloorData, tex: (key: string) => Src | null, suf: string): HTMLCanvasElement {
  const topPad = WALL_H - HALF_H; // headroom for tall walls on the far rows
  const fullW = (fd.w + fd.h) * HALF_W;
  const fullH = (fd.w + fd.h) * HALF_H + topPad + 30;
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(fullW * SCALE);
  cv.height = Math.ceil(fullH * SCALE);
  const ctx = cv.getContext("2d");
  if (ctx === null) return cv;
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const originX = fd.h * HALF_W; // grid (0, h-1) lands at canvas left edge
  const originY = topPad;
  const sx = (x: number, y: number): number => originX + (x - y) * HALF_W;
  const sy = (x: number, y: number): number => originY + (x + y) * HALF_H;

  const entAt = new Map<number, { kind: number; state: number }>();
  for (const e of fd.entities) entAt.set(e.y * fd.w + e.x, { kind: e.kind, state: e.state });

  const ground = tex(`iso-ground${suf}`);
  // depth order: everything on a tile draws together, back to front
  for (let sum = 0; sum <= fd.w + fd.h - 2; sum++) {
    for (let x = Math.max(0, sum - fd.h + 1); x <= Math.min(sum, fd.w - 1); x++) {
      const y = sum - x;
      const i = y * fd.w + x;
      const t = fd.tiles[i]!;
      if (t === Tile.VOID) continue;
      const cx = sx(x, y);
      const cy = sy(x, y);
      // ground diamond from the strip (authored at GROUND_SCALE×)
      const gi = groundIndexFor(t, x, y);
      if (ground !== null && gi >= 0) {
        const srcTw = TILE_W * GROUND_SCALE;
        ctx.drawImage(ground, gi * srcTw, 0, srcTw, TILE_H * GROUND_SCALE, cx - HALF_W, cy - HALF_H, TILE_W, TILE_H);
      }
      // standing billboard (walls picked exactly like the game)
      const key = t === Tile.WALL ? wallKeyAt(fd, x, y, suf) : propTextureFor(t);
      if (key !== "") {
        const img = tex(key);
        if (img !== null) {
          const w = img.width * TEX_SCALE;
          const h = img.height * TEX_SCALE;
          ctx.drawImage(img, cx - w / 2, cy + HALF_H - h, w, h);
        }
      }
      // creature on this tile
      const e = entAt.get(i);
      if (e !== undefined) {
        const img = tex(entityTextureFor(e.kind, e.state));
        if (img !== null) {
          const w = img.width * TEX_SCALE;
          const h = img.height * TEX_SCALE;
          ctx.drawImage(img, cx - w / 2, cy + HALF_H - 2 - h, w, h);
        }
      }
    }
  }
  return cv;
}

let open = false;

export function toggleTowerView(
  host: HTMLElement,
  ports: GamePorts,
  day: number,
  game: Phaser.Game,
  onPick?: (floor: number) => void,
): void {
  const existing = host.querySelector(".uv-tower");
  if (existing !== null) {
    existing.remove();
    open = false;
    return;
  }
  if (open) return;
  open = true;

  const tex = (key: string): Src | null => {
    if (!game.textures.exists(key)) return null;
    return game.textures.get(key).getSourceImage() as Src;
  };

  const backdrop = document.createElement("div");
  backdrop.className = "uv-tower";
  backdrop.style.cssText =
    "position:absolute;inset:0;z-index:60;overflow-y:auto;background:rgba(10,9,14,.97);" +
    "font-family:var(--font-body,system-ui);color:var(--bone,#b7ae9c);padding:18px;";

  const head = document.createElement("div");
  head.style.cssText = "margin-bottom:14px;";
  head.innerHTML =
    `<b style="font-size:17px;color:var(--parchment,#eae0c9)">THE TOWER — Day ${day}</b> ` +
    `<span style="opacity:.55;font-size:12px">click a floor to teleport there · P closes · M in-game skips a floor · dev x-ray, deleted at M2</span>`;
  backdrop.appendChild(head);

  const grid = document.createElement("div");
  grid.style.cssText = "display:flex;flex-wrap:wrap;gap:26px 30px;justify-content:center;";
  backdrop.appendChild(grid);

  for (let f = 1; f <= MAX_FLOOR; f++) {
    const { floorData } = ports.getFloor(f);
    const bi = BIOMES.indexOf(biomeFor(f));
    ensureBiomeSkin(game.textures, bi);
    const cell = document.createElement("div");
    cell.style.cssText = "text-align:center;cursor:pointer;";
    cell.title = `Teleport to Fl. ${ROMAN[f]}`;
    const floorNo = f;
    cell.addEventListener("click", () => {
      backdrop.remove();
      open = false;
      onPick?.(floorNo);
    });
    const label = document.createElement("div");
    label.style.cssText = "font-size:12px;margin-bottom:4px;color:var(--parchment-aged,#d6c7a3)";
    label.textContent = f === MAX_FLOOR ? `Fl. ${ROMAN[f]} — THE BOTTOM` : `Fl. ${ROMAN[f]} · ${biomeFor(f).name}`;
    const monsters = floorData.entities.filter((e) => e.kind !== EntityKind.CORPSE).length;
    const sub = document.createElement("div");
    sub.style.cssText = "font-size:11px;opacity:.6;margin-top:3px;";
    sub.textContent = `${monsters} creatures wait in the dark`;
    cell.appendChild(label);
    cell.appendChild(renderFloorIso(floorData, tex, skinSuffix(bi)));
    cell.appendChild(sub);
    grid.appendChild(cell);
  }

  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) {
      backdrop.remove();
      open = false;
    }
  });
  host.appendChild(backdrop);
}
