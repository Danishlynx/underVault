// DEV-ONLY: deleted at M2. The Tower X-Ray: press M to see every floor of
// today's seed as a minimap grid — an operator/QA judging tool. It exists
// only here because the production client must never see floors it has not
// earned (02 §4: per-floor delivery); the dev adapter generates locally.

import { COLOR_CSS } from "../design/tokens/tokens.js";
import { Tile, EntityKind, type FloorData } from "../src/shared/sim/types.js";
import { biomeFor, MAX_FLOOR } from "../src/shared/sim/constants.js";
import type { GamePorts } from "../src/client/net/ports.js";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  "XXI", "XXII", "XXIII", "XXIV", "XXV"];

const PX = 5; // pixels per tile

const TILE_FILL: Record<number, string> = {
  [Tile.VOID]: "transparent",
  [Tile.WALL]: COLOR_CSS.surface2,
  [Tile.FLOOR]: "#3d3849",
  [Tile.MOSS]: "#2f4a3a",
  [Tile.WEBBING]: "#4a4438",
  [Tile.WATER]: "#243b4a",
  [Tile.GLOWMOSS]: COLOR_CSS.verdigris,
  [Tile.DOOR_CLOSED]: "#7a5b33",
  [Tile.DOOR_STUCK]: "#6b4f2c",
  [Tile.DOOR_OPEN]: "#8a6b3f",
  [Tile.DOOR_IRON]: COLOR_CSS.boneDim,
  [Tile.DOOR_HUNGER]: COLOR_CSS.ember,
  [Tile.DOOR_CHOIR]: COLOR_CSS.verdigrisDim,
  [Tile.DOOR_SIGIL]: COLOR_CSS.seal,
  [Tile.ENTRY]: COLOR_CSS.parchment,
  [Tile.STAIRS_DOWN]: COLOR_CSS.goldInk,
  [Tile.WAYSTONE]: COLOR_CSS.verdigris,
  [Tile.BRAZIER_UNLIT]: "#54483a",
  [Tile.BRAZIER_LIT]: COLOR_CSS.flame,
  [Tile.WAX_DRIP]: "#5c5342",
  [Tile.WAX_STUB]: "#5c5342",
  [Tile.WAX_CAKE]: "#6b6049",
  [Tile.INSCRIPTION]: COLOR_CSS.verdigrisDim,
  [Tile.CHEST]: COLOR_CSS.goldInk,
  [Tile.PLATE]: "#4a4456",
  [Tile.ALTAR]: COLOR_CSS.parchmentAged,
  [Tile.POOL]: "#2c4a54",
  [Tile.FONT]: COLOR_CSS.bone,
  [Tile.SEAL]: COLOR_CSS.goldInk,
  [Tile.KEY_DROP]: COLOR_CSS.goldInk,
};

function drawFloor(fd: FloorData): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = fd.w * PX;
  cv.height = fd.h * PX;
  const ctx = cv.getContext("2d");
  if (ctx === null) return cv;
  for (let y = 0; y < fd.h; y++) {
    for (let x = 0; x < fd.w; x++) {
      const t = fd.tiles[y * fd.w + x]!;
      const fill = TILE_FILL[t] ?? "#555";
      if (fill === "transparent") continue;
      ctx.fillStyle = fill;
      ctx.fillRect(x * PX, y * PX, PX - 0.5, PX - 0.5);
    }
  }
  // entities: red = hostile, gold ring = Keeper, pale = corpse
  for (const e of fd.entities) {
    ctx.fillStyle =
      e.kind === EntityKind.CORPSE ? COLOR_CSS.bone :
      e.kind === EntityKind.KEEPER ? COLOR_CSS.goldInk : COLOR_CSS.seal;
    ctx.beginPath();
    ctx.arc(e.x * PX + PX / 2, e.y * PX + PX / 2, PX * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  // the delver's entry
  ctx.strokeStyle = COLOR_CSS.parchment;
  ctx.lineWidth = 1;
  ctx.strokeRect(fd.px * PX - 1, fd.py * PX - 1, PX + 2, PX + 2);
  return cv;
}

let open = false;

export function toggleTowerView(host: HTMLElement, ports: GamePorts, day: number): void {
  const existing = host.querySelector(".uv-tower");
  if (existing !== null) {
    existing.remove();
    open = false;
    return;
  }
  if (open) return;
  open = true;

  const backdrop = document.createElement("div");
  backdrop.className = "uv-tower";
  backdrop.style.cssText =
    "position:absolute;inset:0;z-index:60;overflow-y:auto;background:rgba(10,9,14,.96);" +
    "font-family:var(--font-body,system-ui);color:var(--bone,#b7ae9c);padding:18px;";

  const head = document.createElement("div");
  head.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;";
  head.innerHTML =
    `<b style="font-size:17px;color:var(--parchment,#eae0c9)">THE TOWER — Day ${day} <span style="opacity:.55;font-size:12px">(dev x-ray · M closes · deleted at M2)</span></b>`;
  const legend = document.createElement("div");
  legend.style.cssText = "font-size:11px;opacity:.75;margin-bottom:14px;line-height:1.7;";
  legend.textContent =
    "◼ walls · dim purple floor · green moss · blue water · gold stairs/chests/keys · " +
    "teal waystones/glowmoss · brown doors (grey iron · ember hunger · teal choir · red sigil) · " +
    "red dots monsters · gold dot the Keeper · pale dots corpses · white square your entry";
  backdrop.appendChild(head);
  backdrop.appendChild(legend);

  const grid = document.createElement("div");
  grid.style.cssText = "display:flex;flex-wrap:wrap;gap:16px;justify-content:center;";
  backdrop.appendChild(grid);

  for (let f = 1; f <= MAX_FLOOR; f++) {
    const { floorData } = ports.getFloor(f);
    const cell = document.createElement("div");
    cell.style.cssText = "text-align:center;";
    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;margin-bottom:3px;color:var(--bone-dim,#7e786c)";
    label.textContent = f === MAX_FLOOR ? `Fl. ${ROMAN[f]} — THE BOTTOM` : `Fl. ${ROMAN[f]} · ${biomeFor(f).name}`;
    const monsters = floorData.entities.filter((e) => e.kind !== EntityKind.CORPSE).length;
    const sub = document.createElement("div");
    sub.style.cssText = "font-size:10px;opacity:.6;margin-top:2px;";
    sub.textContent = `${monsters} creatures`;
    cell.appendChild(label);
    cell.appendChild(drawFloor(floorData));
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
  open = true;
}
