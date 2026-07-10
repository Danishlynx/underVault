/**
 * Per-biome painted cavern backdrops (D82) — the Silksong distance layer.
 * Authored compositions painted by the artist fleet; rendered on a DOM
 * canvas UNDER the transparent game canvas (splash-safe, no Phaser).
 * Index matches BIOMES order; the Bottom is last.
 */

import { paintTallowBackdrop } from "./tallow.js";
import { paintCellarsBackdrop } from "./cellars.js";
import { paintDrownedBackdrop } from "./drowned.js";
import { paintFurnaceBackdrop } from "./furnace.js";
import { paintChoirBackdrop } from "./choir.js";
import { paintDeepBackdrop } from "./deep.js";
import { paintBottomBackdrop } from "./bottom.js";

export type BackdropPainter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export const BACKDROPS: readonly BackdropPainter[] = [
  paintTallowBackdrop,
  paintCellarsBackdrop,
  paintDrownedBackdrop,
  paintFurnaceBackdrop,
  paintChoirBackdrop,
  paintDeepBackdrop,
  paintBottomBackdrop,
];
