import { describe, expect, test } from "vitest";
import { generateFloor } from "./index.js";
import { serializeState } from "../sim/pack.js";
import { initState } from "../sim/engine.js";
import { Tile, EntityKind } from "../sim/types.js";
import { TILE_FLAGS, F_WALK, MAX_FLOOR, SPAWN_MIN_DIST_FROM_ENTRY } from "../sim/constants.js";

const SEEDS = [20260708, 1, 42, 11111, 987654321, 0xdecafbad, 7777, 31337, 2, 999999];

function bfsReachable(tiles: Uint8Array, w: number, h: number, sx: number, sy: number): Int32Array {
  const dist = new Int32Array(w * h).fill(-1);
  const passable = (t: number): boolean =>
    (TILE_FLAGS[t]! & F_WALK) !== 0 || t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK;
  const q = [sy * w + sx];
  dist[sy * w + sx] = 0;
  let qi = 0;
  while (qi < q.length) {
    const i = q[qi++]!;
    const x = i % w;
    const y = (i / w) | 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (dist[ni]! >= 0 || !passable(tiles[ni]!)) continue;
      dist[ni] = dist[i]! + 1;
      q.push(ni);
    }
  }
  return dist;
}

describe("Tallow Halls generator", () => {
  for (const seed of SEEDS) {
    for (let floor = 1; floor <= 3; floor++) {
      test(`seed ${seed} floor ${floor}: connected, featured, deterministic`, () => {
        const { floorData } = generateFloor(seed, floor);
        const { tiles, w, h, px, py } = floorData;

        // full connectivity from entry
        const dist = bfsReachable(tiles, w, h, px, py);
        let entries = 0;
        let stairs = 0;
        let waystones = 0;
        let braziers = 0;
        for (let i = 0; i < tiles.length; i++) {
          const t = tiles[i]!;
          const passable = (TILE_FLAGS[t]! & F_WALK) !== 0 || t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK;
          if (passable) expect(dist[i], `tile ${i % w},${(i / w) | 0} unreachable`).toBeGreaterThanOrEqual(0);
          if (t === Tile.ENTRY) entries++;
          if (t === Tile.STAIRS_DOWN) stairs++;
          if (t === Tile.WAYSTONE) waystones++;
          if (t === Tile.BRAZIER_UNLIT || t === Tile.BRAZIER_LIT) braziers++;
        }
        expect(entries).toBe(1);
        expect(stairs).toBe(floor < MAX_FLOOR ? 1 : 0); // slice: floor 3 is the bottom
        expect(waystones).toBe(1);
        expect(braziers).toBeGreaterThanOrEqual(1);
        expect(braziers).toBeLessThanOrEqual(2);

        // webbing only from floor 2 down
        const hasWebbing = tiles.some((t) => t === Tile.WEBBING);
        if (floor === 1) expect(hasWebbing).toBe(false);

        // spawns: on walkable tiles, min distance honored, ids ascending
        let lastId = 0;
        for (const e of floorData.entities) {
          expect(e.id).toBeGreaterThan(lastId);
          lastId = e.id;
          expect((TILE_FLAGS[tiles[e.y * w + e.x]!]! & F_WALK) !== 0).toBe(true);
          expect(dist[e.y * w + e.x]!).toBeGreaterThanOrEqual(SPAWN_MIN_DIST_FROM_ENTRY);
        }
        const beasts = floorData.entities.filter((e) => e.kind === EntityKind.BEAST).length;
        expect(beasts).toBe(floor === 3 ? 1 : 0);

        // byte-identical regeneration (incl. downstream initState)
        const again = generateFloor(seed, floor);
        expect(Array.from(again.floorData.tiles)).toEqual(Array.from(tiles));
        expect(again.floorData.entities).toEqual(floorData.entities);
        expect(Array.from(again.rngInit)).toEqual(Array.from(generateFloor(seed, floor).rngInit));
        const s1 = serializeState(initState(floorData, generateFloor(seed, floor).rngInit));
        const s2 = serializeState(initState(again.floorData, again.rngInit));
        expect(Array.from(s1)).toEqual(Array.from(s2));
      });
    }
  }
});
