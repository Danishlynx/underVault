/**
 * Biome deco registry (D71): six artist-drawn prop sets, one per biome,
 * mixed with a few shared fillers. The scatter in floorDecoFor picks from
 * the biome's list — repetition in a list is deliberate weighting.
 */

import type Phaser from "phaser";
import { buildTallowDecos } from "./tallow.js";
import { buildCellarDecos } from "./cellars.js";
import { buildDrownedDecos } from "./drowned.js";
import { buildFurnaceDecos } from "./furnace.js";
import { buildChoirDecos } from "./choir.js";
import { buildDeepDecos } from "./deep.js";

export function buildAllDecoSets(T: Phaser.Textures.TextureManager): void {
  buildTallowDecos(T);
  buildCellarDecos(T);
  buildDrownedDecos(T);
  buildFurnaceDecos(T);
  buildChoirDecos(T);
  buildDeepDecos(T);
}

/** Scatter lists per biome index (BIOMES order; last = the Bottom). */
export const DECO_SETS: readonly (readonly string[])[] = [
  // 1–4 The Tallow Halls — the wax industry's leavings
  ["deco-tallow-pillar", "deco-tallow-mound", "deco-tallow-votives", "deco-tallow-barrel", "deco-tallow-pool", "deco-stubs", "deco-crate", "deco-rubble"],
  // 5–8 The Root Cellars — a larder the earth is taking back
  ["deco-cellar-shrooms", "deco-cellar-urn", "deco-cellar-sack", "deco-cellar-roots", "deco-cellar-rack", "deco-barrel", "deco-crate", "deco-rubble"],
  // 9–12 The Drowned Stacks — the library the water took
  ["deco-drowned-books", "deco-drowned-shelf", "deco-drowned-kelp", "deco-drowned-rock", "deco-drowned-lantern", "deco-drowned-books", "deco-rubble"],
  // 13–16 The Glassblack Furnaces — a dead glassworks
  ["deco-furnace-anvil", "deco-furnace-slag", "deco-furnace-glass", "deco-furnace-coals", "deco-furnace-mold", "deco-furnace-slag", "deco-rubble"],
  // 17–20 The Hollow Choir — a cathedral fallen mid-ceremony
  ["deco-choir-column", "deco-choir-bell", "deco-choir-lectern", "deco-choir-candelabrum", "deco-choir-tablet", "deco-bones", "deco-rubble"],
  // 21–24 The Wickless Deep — the dark's own country
  ["deco-deep-crystals", "deco-deep-monolith", "deco-deep-eggs", "deco-deep-spike", "deco-deep-crystals", "deco-shard", "deco-bones"],
  // 25 The Bottom — an offering place
  ["deco-deep-offering", "deco-deep-monolith", "deco-deep-crystals", "deco-deep-offering", "deco-deep-spike", "deco-shard"],
];
