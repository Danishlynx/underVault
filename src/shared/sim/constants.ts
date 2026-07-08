/**
 * Sim constants — the data file for every gameplay number (CLAUDE.md: no
 * hardcoded gameplay values outside data files; tuning sources: 01 §5–§8,
 * DECISIONS.md for doc-silent values marked there).
 *
 * DETERMINISM BAN LIST (invariant 1) — inside src/shared/sim & src/shared/gen:
 *   no floats stored or compared · no `/` division (use >> or (a/b)|0 with a
 *   non-negativity comment) · no Math.random / Math.floor / Math.* numerics ·
 *   no Date / Date.now · no BigInt · every 32-bit multiply through Math.imul ·
 *   every 32-bit result normalized `>>> 0` · no for..in / Object.keys / Map /
 *   Set iteration in logic paths · entities always sorted ascending by id.
 */

import { Tile, EntityKind, Action, Item } from "./types.js";

// ── Wax economy (01 §5, tuning v1) ─────────────────────────────────────────
export const START_WAX = 500;
export const COST_BASIC = 1; // move / wait / basic interact
export const COST_FORCE_DOOR = 5;
export const COST_BRAZIER = 30;
export const PICKUP_WAX: Readonly<Record<number, number>> = {
  [Tile.WAX_DRIP]: 20,
  [Tile.WAX_STUB]: 50,
  [Tile.WAX_CAKE]: 100,
};

// ── Light radius tiers (01 §5) ─────────────────────────────────────────────
// wax ≥300 → 4 · 150–299 → 3 · 50–149 → 2 · 1–49 → 1 · 0 → 0 (Dark Grace)
export const TIER_THRESHOLDS: readonly [number, number][] = [
  [300, 4],
  [150, 3],
  [50, 2],
  [1, 1],
];

// ── Candle (01 §5) ─────────────────────────────────────────────────────────
export const SNUFF_TICKS = 2;
export const RELIGHT_TICKS = 3;
export const GRACE_TICKS = 25; // The Dark Grace

// ── Braziers / fire (01 §5, DECISIONS 11/23) ───────────────────────────────
export const BRAZIER_RADIUS = 3; // aura: burn paused, integer disc d² ≤ r²+r
export const FIRE_TICKS = 4; // burn duration per tile
export const FIRE_LIGHT_RADIUS = 2;
export const FIRE_WAX_DAMAGE = 15; // player standing in fire, per tick

// ── Monster contact damage, in wax (DECISIONS 8) ───────────────────────────
export const DMG: Readonly<Record<number, number>> = {
  [EntityKind.RAT]: 4,
  [EntityKind.WICKWORM]: 20,
  [EntityKind.MOTH]: 0,
  [EntityKind.BEAST]: 40,
};

// ── Species behavior data (client-visible AI dispositions, DECISIONS 19) ───
export const RAT_FLEE_RADIUS = 3; // flees when light radius ≥ this (01 §8)
export const RAT_SWARM_RADIUS = 1; // swarms when effective radius ≤ this
export const RAT_WAX_SENSE = 8; // drifts toward pickups within this range
export const WORM_HEAT_SENSE = 12; // senses CUPPED flames within this (01 §8 L1)
export const WORM_VIBRATION_SENSE = 3; // senses any player within this
export const WORM_SURFACED_TICKS = 2; // vulnerable window after lunge
export const MOTH_FLAME_SENSE = 8; // seeks LIT flames within this
export const MOTH_SCATTER_TICKS = 6; // wander duration after cupping sheds it
export const BEAST_MAX_STEP = 2; // moves min(noise, 2) — 01 §8 #7

// Noise per action-context (DECISIONS 18): the Beast is blind, hunts sound.
export const NOISE_STONE = 2;
export const NOISE_SOFT = 1; // moss / webbing
export const NOISE_INTERACT = 2;

// ── Items (01 §9; charges: DECISIONS 15) ───────────────────────────────────
export const START_INVENTORY: readonly [number, number][] = [
  [Item.FLINT, 1],
  [Item.SALT, 3],
  [Item.CHALK, 10],
];
export const SALT_THROW_RANGE = 2;

// ── World / slice scope (01 §6; DECISIONS 24) ──────────────────────────────
export const FLOOR_W = 24;
export const FLOOR_H = 24;
export const MAX_FLOOR = 3; // slice: floor 3 has no stairs down

// Spawn tables per floor (DECISIONS 20): [kind, min, max]
export const SPAWN_TABLE: Readonly<Record<number, readonly [number, number, number][]>> = {
  1: [
    [EntityKind.RAT, 4, 6],
    [EntityKind.MOTH, 1, 2],
  ],
  2: [
    [EntityKind.RAT, 3, 5],
    [EntityKind.WICKWORM, 2, 3],
    [EntityKind.MOTH, 2, 3],
  ],
  3: [
    [EntityKind.RAT, 2, 4],
    [EntityKind.WICKWORM, 2, 2],
    [EntityKind.MOTH, 2, 2],
    [EntityKind.BEAST, 1, 1],
  ],
};
export const SPAWN_MIN_DIST_FROM_ENTRY = 6;

export const HP: Readonly<Record<number, number>> = {
  [EntityKind.RAT]: 1, // dies to one bump (01 §8) — via rules table
  [EntityKind.WICKWORM]: 2,
  [EntityKind.MOTH]: 1,
  [EntityKind.BEAST]: 99, // immune to weapons — via rules table
};

// ── Tile flags ─────────────────────────────────────────────────────────────
export const F_WALK = 1;
export const F_OPAQUE = 2;

const FLAGS = new Uint8Array(16);
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
FLAGS[Tile.BRAZIER_UNLIT] = 0; // blocks movement, transparent to sight
FLAGS[Tile.BRAZIER_LIT] = 0;
FLAGS[Tile.WAX_DRIP] = F_WALK;
FLAGS[Tile.WAX_STUB] = F_WALK;
FLAGS[Tile.WAX_CAKE] = F_WALK;
export const TILE_FLAGS: Uint8Array = FLAGS;

// ── Action costs (wax), indexed by opcode; -1 = context-dependent ──────────
const COSTS = new Int8Array(64).fill(COST_BASIC);
COSTS[Action.CUP] = 0;
COSTS[Action.RELIGHT] = 0; // relight channel burns nothing (candle is out)
export const ACTION_COST: Int8Array = COSTS;

// Directions: N, E, S, W (screen-space, y-down). Sorted, fixed order.
export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

// Rule-query subject names by EntityKind (shared vocabulary; outcomes secret)
export const KIND_NAME: readonly string[] = ["", "rat", "wickworm", "moth", "beast"];
export const CANDLE_NAME: readonly string[] = ["lit", "cupped", "snuffed"];
