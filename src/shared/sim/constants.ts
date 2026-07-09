/**
 * Sim constants v2 — the data file for every gameplay number (01 §5–§10,
 * DECISIONS.md for doc-silent values marked ⚖). No gameplay numbers may
 * live anywhere else.
 *
 * DETERMINISM BAN LIST (invariant 1) — inside src/shared/sim & src/shared/gen:
 *   no floats stored/compared · no `/` (use >> or (a/b)|0 with non-negativity
 *   comment) · no Math.random/Math.floor/Date · every 32-bit multiply through
 *   Math.imul · results normalized >>>0 · no for..in/Object.keys/Map/Set in
 *   logic paths · entities always sorted ascending by id.
 */

import { Tile, EntityKind, Action, Item, TILE_KIND_COUNT } from "./types.js";

// ── Wax economy (01 §5) ────────────────────────────────────────────────────
export const START_WAX = 500;
export const COST_BASIC = 1;
export const COST_FORCE_DOOR = 5;
export const COST_BRAZIER = 30;
export const COST_SIGN = 5;
export const COST_HUNGER_DOOR = 50;
export const COST_ALTAR = 100;
export const PICKUP_WAX: Readonly<Record<number, number>> = {
  [Tile.WAX_DRIP]: 20,
  [Tile.WAX_STUB]: 50,
  [Tile.WAX_CAKE]: 100,
};

// ── Light tiers (01 §5) ────────────────────────────────────────────────────
export const TIER_THRESHOLDS: readonly [number, number][] = [
  [300, 4],
  [150, 3],
  [50, 2],
  [1, 1],
];

// ── Candle ─────────────────────────────────────────────────────────────────
export const SNUFF_TICKS = 2;
export const RELIGHT_TICKS = 3;
export const GRACE_TICKS = 25; // default; omens may mutate (Hungry Dark 12)

// ── Braziers / fire / gas (01 §5, §8; DECISIONS 11/23) ─────────────────────
export const BRAZIER_RADIUS = 3;
export const FIRE_TICKS = 4;
export const FIRE_LIGHT_RADIUS = 2;
export const FIRE_WAX_DAMAGE = 15;
export const GAS_TICKS = 14; // spore clouds linger (⚖)
export const GAS_BOOM_DAMAGE = 45; // lit-candle-in-gas detonation (⚖)
export const GLOWMOSS_RADIUS = 1;
export const SHOCK_DAMAGE = 30; // Drownedkin conduction (⚖)

// ── Sigil ritual (01 §10: offer darkness = snuff + wait 3) ─────────────────
export const SIGIL_WAITS = 3;

// ── Monster contact damage in wax (⚖ DECISIONS 8) ──────────────────────────
export const DMG: Readonly<Record<number, number>> = {
  [EntityKind.RAT]: 4,
  [EntityKind.WICKWORM]: 20,
  [EntityKind.MOTH]: 0,
  [EntityKind.BEAST]: 40,
  [EntityKind.SLIME]: 8,
  [EntityKind.MIMIC]: 25,
  [EntityKind.SPOREWIGHT]: 6,
  [EntityKind.DROWNED]: 0, // hurts via shock, not touch
  [EntityKind.BELLHUNG]: 0, // hurts via the alarm it rings
  [EntityKind.SHADE]: 18,
  [EntityKind.GASLIGHT]: 0, // hurts via detonation
  [EntityKind.CHOIRLESS]: 10,
  [EntityKind.RUSTLING]: 0, // hurts via theft
  [EntityKind.KEEPER]: 30,
};

export const HP: Readonly<Record<number, number>> = {
  [EntityKind.RAT]: 1,
  [EntityKind.WICKWORM]: 2,
  [EntityKind.MOTH]: 1,
  [EntityKind.BEAST]: 99,
  [EntityKind.SLIME]: 4, // splits at half (rule: struck → SPLIT)
  [EntityKind.MIMIC]: 3,
  [EntityKind.SPOREWIGHT]: 1,
  [EntityKind.DROWNED]: 2,
  [EntityKind.BELLHUNG]: 2, // 2 interacts cut it down (01 §8 #9)
  [EntityKind.SHADE]: 2,
  [EntityKind.GASLIGHT]: 1,
  [EntityKind.CHOIRLESS]: 3,
  [EntityKind.RUSTLING]: 1,
  [EntityKind.KEEPER]: 99,
  [EntityKind.CORPSE]: 1,
};

// ── Senses / behavior data (client-visible dispositions, DECISIONS 19) ─────
export const RAT_FLEE_RADIUS = 3;
export const RAT_SWARM_RADIUS = 1;
export const RAT_WAX_SENSE = 8;
export const WORM_HEAT_SENSE = 12;
export const WORM_VIBRATION_SENSE = 3;
export const WORM_SURFACED_TICKS = 2;
export const MOTH_FLAME_SENSE = 10;
export const MOTH_SCATTER_TICKS = 6;
export const BEAST_MAX_STEP = 2;
export const SLIME_SENSE = 6; // slow ooze toward any delver (⚖)
export const SHADE_SENSE = 9; // hunts flames, lit or not (⚖)
export const CHOIRLESS_SIGHT = 7; // screams on sight (01 §8 #12)
export const RUSTLING_SENSE = 8; // smells keys (⚖)
export const KEEPER_CONE = 6; // lit-flame detection range (cone at W4)
export const ALERT_TICKS = 20; // floor-wide aggro duration (⚖)
export const ECHO_KEYFRAMES = 48; // "final 24 s" at 2 Hz (01 §13)

export const NOISE_STONE = 2;
export const NOISE_SOFT = 1;
export const NOISE_INTERACT = 2;
export const NOISE_BELL = 3; // thrown decoy (01 §9)
export const BELL_PEAL_TICKS = 6; // decoy holds the dark's attention this long (⚖ D64)

// ── Items (01 §9; charges ⚖ DECISIONS 15) ──────────────────────────────────
export const START_INVENTORY: readonly [number, number][] = [
  [Item.FLINT, 1],
  [Item.SALT, 3],
  [Item.CHALK, 10],
];
export const SALT_THROW_RANGE = 2;
export const BELL_THROW_RANGE = 4;
/** Chest loot table rolled from the LOOT stream (⚖). */
export const CHEST_LOOT: readonly [number, number][] = [
  // [item, charges]
  [Item.KEY_IRON, 1],
  [Item.SALT, 2],
  [Item.BELL, 1],
  [Item.MIRROR, 1],
  [Item.GLOWVIAL, 1],
  [Item.DOUSE, 1],
  [Item.WSHARD, 1],
];

// ── World / biomes (01 §6 ladder) ──────────────────────────────────────────
export const MAX_FLOOR = 25; // the Bottom
export interface BiomeDef {
  name: string;
  firstFloor: number;
  lastFloor: number;
  size: number; // square grid side
  // terrain feature densities (counts per floor, scaled by gen)
  webbing: number;
  water: number; // water rows
  glowmoss: number;
  chests: number;
  plates: number;
  darkPenalty: number; // Wickless Deep: ambient radius loss (⚖)
}
export const BIOMES: readonly BiomeDef[] = [
  { name: "The Tallow Halls", firstFloor: 1, lastFloor: 4, size: 24, webbing: 0, water: 0, glowmoss: 0, chests: 0, plates: 0, darkPenalty: 0 },
  { name: "The Root Cellars", firstFloor: 5, lastFloor: 8, size: 24, webbing: 3, water: 0, glowmoss: 3, chests: 2, plates: 0, darkPenalty: 0 },
  { name: "The Drowned Stacks", firstFloor: 9, lastFloor: 12, size: 26, webbing: 1, water: 3, glowmoss: 2, chests: 2, plates: 0, darkPenalty: 0 },
  { name: "The Glassblack Furnaces", firstFloor: 13, lastFloor: 16, size: 26, webbing: 4, water: 0, glowmoss: 1, chests: 2, plates: 0, darkPenalty: 0 },
  { name: "The Hollow Choir", firstFloor: 17, lastFloor: 20, size: 28, webbing: 1, water: 1, glowmoss: 2, chests: 2, plates: 3, darkPenalty: 0 },
  { name: "The Wickless Deep", firstFloor: 21, lastFloor: 24, size: 28, webbing: 2, water: 1, glowmoss: 3, chests: 3, plates: 1, darkPenalty: 1 },
  { name: "The Bottom", firstFloor: 25, lastFloor: 25, size: 24, webbing: 0, water: 0, glowmoss: 2, chests: 0, plates: 0, darkPenalty: 1 },
];
export function biomeFor(floor: number): BiomeDef {
  for (let i = 0; i < BIOMES.length; i++) {
    const b = BIOMES[i]!;
    if (floor >= b.firstFloor && floor <= b.lastFloor) return b;
  }
  return BIOMES[BIOMES.length - 1]!;
}

// Spawn tables per biome index (0..6): [kind, min, max] — floor-scaled in gen
export const SPAWN_TABLE: readonly (readonly [number, number, number][])[] = [
  [
    [EntityKind.RAT, 4, 6],
    [EntityKind.MOTH, 1, 2],
    [EntityKind.WICKWORM, 0, 2],
  ],
  [
    [EntityKind.RAT, 2, 4],
    [EntityKind.SLIME, 2, 4],
    [EntityKind.SPOREWIGHT, 2, 3],
    [EntityKind.MIMIC, 1, 1],
    [EntityKind.MOTH, 1, 2],
  ],
  [
    [EntityKind.DROWNED, 3, 4],
    [EntityKind.BELLHUNG, 2, 3],
    [EntityKind.SLIME, 1, 2],
    [EntityKind.RAT, 1, 3],
  ],
  [
    [EntityKind.SHADE, 2, 3],
    [EntityKind.GASLIGHT, 2, 3],
    [EntityKind.SPOREWIGHT, 2, 3],
    [EntityKind.WICKWORM, 1, 2],
  ],
  [
    [EntityKind.CHOIRLESS, 2, 3],
    [EntityKind.RUSTLING, 2, 3],
    [EntityKind.BELLHUNG, 1, 2],
    [EntityKind.SHADE, 1, 2],
  ],
  [
    [EntityKind.SHADE, 2, 4],
    [EntityKind.RUSTLING, 1, 2],
    [EntityKind.GASLIGHT, 1, 2],
    [EntityKind.CHOIRLESS, 1, 2],
  ],
  [
    [EntityKind.SHADE, 2, 2],
    [EntityKind.CHOIRLESS, 1, 1],
  ],
];
/** Miniboss placements: Chandler Beast ends biome 1; the Lantern-Keeper
 *  roams floors 8+ (01 §8 #14) on every 4th floor (⚖). */
export function bossFor(floor: number): number {
  if (floor === 3 || floor === 4) return EntityKind.BEAST;
  if (floor >= 8 && floor % 4 === 0) return EntityKind.KEEPER;
  return 0;
}
export const SPAWN_MIN_DIST_FROM_ENTRY = 6;

// ── Tile flags ─────────────────────────────────────────────────────────────
export const F_WALK = 1;
export const F_OPAQUE = 2;

const FLAGS = new Uint8Array(TILE_KIND_COUNT);
FLAGS[Tile.VOID] = F_OPAQUE;
FLAGS[Tile.WALL] = F_OPAQUE;
FLAGS[Tile.FLOOR] = F_WALK;
FLAGS[Tile.MOSS] = F_WALK;
FLAGS[Tile.WEBBING] = F_WALK;
FLAGS[Tile.DOOR_CLOSED] = F_OPAQUE;
FLAGS[Tile.DOOR_STUCK] = F_OPAQUE;
FLAGS[Tile.DOOR_OPEN] = F_WALK;
FLAGS[Tile.ENTRY] = F_WALK;
FLAGS[Tile.STAIRS_DOWN] = F_WALK;
FLAGS[Tile.WAYSTONE] = F_WALK;
FLAGS[Tile.BRAZIER_UNLIT] = 0;
FLAGS[Tile.BRAZIER_LIT] = 0;
FLAGS[Tile.WAX_DRIP] = F_WALK;
FLAGS[Tile.WAX_STUB] = F_WALK;
FLAGS[Tile.WAX_CAKE] = F_WALK;
FLAGS[Tile.WATER] = F_WALK;
FLAGS[Tile.GLOWMOSS] = F_WALK;
FLAGS[Tile.INSCRIPTION] = F_OPAQUE; // carved wall
FLAGS[Tile.CHEST] = 0; // blocks; interact to knock/open
FLAGS[Tile.DOOR_IRON] = F_OPAQUE;
FLAGS[Tile.DOOR_SIGIL] = F_OPAQUE;
FLAGS[Tile.DOOR_HUNGER] = F_OPAQUE;
FLAGS[Tile.DOOR_CHOIR] = F_OPAQUE;
FLAGS[Tile.PLATE] = F_WALK;
FLAGS[Tile.ALTAR] = 0;
FLAGS[Tile.POOL] = 0;
FLAGS[Tile.FONT] = 0;
FLAGS[Tile.SEAL] = F_OPAQUE;
FLAGS[Tile.KEY_DROP] = F_WALK;
export const TILE_FLAGS: Uint8Array = FLAGS;

// ── Action base costs ──────────────────────────────────────────────────────
const COSTS = new Int8Array(64).fill(COST_BASIC);
COSTS[Action.CUP] = 0;
COSTS[Action.RELIGHT] = 0;
COSTS[Action.SIGN] = COST_SIGN;
export const ACTION_COST: Int8Array = COSTS;

export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

// ── Shared vocabulary (subjects for rule keys; outcomes stay secret) ───────
export const KIND_NAME: readonly string[] = [
  "", "rat", "wickworm", "moth", "beast", "slime", "mimic", "sporewight",
  "drowned", "bellhung", "shade", "gaslight", "choirless", "rustling",
  "keeper", "", "", "", "", "", "corpse",
];
export const CANDLE_NAME: readonly string[] = ["lit", "cupped", "snuffed"];
export const ITEM_NAME: readonly string[] = [
  "", "flint", "salt", "chalk", "mirror-shard", "bell", "glowmoss-vial",
  "dousing-cap", "iron-key", "master-key", "waystone-shard",
];

/** Sign templates (01 §10, verbatim; index 3–4 take no noun). */
export const SIGN_TEMPLATES: readonly string[] = [
  "Beware of ___",
  "Try ___",
  "___ ahead",
  "Praise the flame",
  "Liar ahead",
];
export const SIGNS_PER_RUN = 2;
export const BANK_MAX = 3; // claims per Waystone (01 §10)
