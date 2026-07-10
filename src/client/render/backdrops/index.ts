/**
 * Per-biome painted cavern backdrops (D82) — the Silksong distance layer.
 * Authored compositions painted by the artist fleet; rendered on a DOM
 * canvas UNDER the transparent game canvas (splash-safe, no Phaser).
 * Index matches BIOMES order; the Bottom is last.
 *
 * choir/bottom are still being painted — inline void stubs keep the game
 * running until they land, then their imports replace the stubs here.
 */

import { paintTallowBackdrop } from "./tallow.js";
import { paintCellarsBackdrop } from "./cellars.js";
import { paintDrownedBackdrop } from "./drowned.js";
import { paintFurnaceBackdrop } from "./furnace.js";
import { paintDeepBackdrop } from "./deep.js";

export type BackdropPainter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** Temporary: plain void until the biome's painting arrives. */
const pendingBackdrop: BackdropPainter = () => {
  /* the void itself */
};

export const BACKDROPS: readonly BackdropPainter[] = [
  paintTallowBackdrop,
  paintCellarsBackdrop,
  paintDrownedBackdrop,
  paintFurnaceBackdrop,
  pendingBackdrop, // choir — painter in flight
  paintDeepBackdrop,
  pendingBackdrop, // bottom — painter in flight
];
