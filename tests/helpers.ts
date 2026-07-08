/**
 * Test fixtures: ASCII floor builder, stub rule tables, tick-run helpers.
 * Legend: # wall · . floor · m moss · w webbing · + door · x stuck door ·
 * o open door · E entry · > stairs · Y waystone · u brazier · B lit brazier ·
 * d drip · s stub · k cake · @ player-start floor tile
 */

import {
  Tile,
  Status,
  type Entity,
  type FloorData,
  type MutableRuleTable,
  type SimState,
} from "../src/shared/sim/types.js";
import { initState, tickResolving } from "../src/shared/sim/engine.js";
import { seedAllStreams } from "../src/shared/sim/rng.js";
import { Effect } from "../src/shared/sim/types.js";

const CHAR_TILE: Record<string, number> = {
  "#": Tile.WALL,
  ".": Tile.FLOOR,
  m: Tile.MOSS,
  w: Tile.WEBBING,
  "+": Tile.DOOR_CLOSED,
  x: Tile.DOOR_STUCK,
  o: Tile.DOOR_OPEN,
  E: Tile.ENTRY,
  ">": Tile.STAIRS_DOWN,
  Y: Tile.WAYSTONE,
  u: Tile.BRAZIER_UNLIT,
  B: Tile.BRAZIER_LIT,
  d: Tile.WAX_DRIP,
  s: Tile.WAX_STUB,
  k: Tile.WAX_CAKE,
  "@": Tile.FLOOR,
};

export function floorFromAscii(rows: string[], entities: Entity[] = [], floor = 1): FloorData {
  const h = rows.length;
  const w = rows[0]!.length;
  const tiles = new Uint8Array(w * h);
  let px = 1;
  let py = 1;
  for (let y = 0; y < h; y++) {
    const row = rows[y]!;
    for (let x = 0; x < w; x++) {
      const ch = row[x]!;
      const t = CHAR_TILE[ch];
      if (t === undefined) throw new Error(`unknown map char '${ch}'`);
      tiles[y * w + x] = t;
      if (ch === "@") {
        px = x;
        py = y;
      }
    }
  }
  let maxId = 0;
  for (const e of entities) maxId = e.id > maxId ? e.id : maxId;
  return { floor, w, h, tiles, px, py, entities, nextEntityId: maxId + 1 };
}

export function makeState(fd: FloorData, daySeed = 123): SimState {
  return initState(fd, seedAllStreams(daySeed, fd.floor));
}

/** Rule table backed by a literal record; missing keys resolve to a default. */
export function stubRules(entries: Record<string, number> = {}, fallback = Effect.NONE): {
  table: MutableRuleTable;
  resolve: (key: string) => number;
} {
  const cache = new Map<string, number>();
  return {
    table: {
      get: (k) => cache.get(k),
      set: (k, v) => {
        cache.set(k, v);
      },
    },
    resolve: (k) => entries[k] ?? fallback,
  };
}

export function runActions(
  state: SimState,
  actions: readonly (number | { op: number; arg: number })[],
  rules?: { table: MutableRuleTable; resolve: (key: string) => number },
): SimState {
  const r = rules ?? stubRules();
  let s = state;
  for (const a of actions) {
    if (s.status !== Status.ALIVE) break;
    const step = typeof a === "number" ? { op: a, arg: 0 } : a;
    s = tickResolving(s, step, r.table, r.resolve).state;
  }
  return s;
}

export function ent(id: number, kind: number, x: number, y: number, hp = 1, state = 0): Entity {
  return { id, kind, x, y, hp, state, data: 0 };
}
