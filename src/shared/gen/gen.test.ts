import { describe, expect, test } from "vitest";
import { generateFloor } from "./index.js";
import { serializeState } from "../sim/pack.js";
import { initState } from "../sim/engine.js";
import { Tile, EntityKind } from "../sim/types.js";
import { TILE_FLAGS, F_WALK, MAX_FLOOR, SPAWN_MIN_DIST_FROM_ENTRY, biomeFor } from "../sim/constants.js";

const SEEDS = [20260708, 1, 42, 11111, 987654321];
const FLOORS = [1, 2, 3, 5, 9, 13, 17, 21, 25];

function bfsReachable(tiles: Uint8Array, w: number, h: number, sx: number, sy: number): Int32Array {
  const dist = new Int32Array(w * h).fill(-1);
  // plain doors open; special doors gate loot, never progress
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

describe("biome generator (floors 1–25)", () => {
  for (const seed of SEEDS) {
    for (const floor of FLOORS) {
      test(`seed ${seed} floor ${floor} (${biomeFor(floor).name}): solvable, featured, deterministic`, () => {
        const { floorData } = generateFloor(seed, floor);
        const { tiles, w, h, px, py } = floorData;
        expect(w).toBe(biomeFor(floor).size);

        const dist = bfsReachable(tiles, w, h, px, py);
        let entries = 0;
        let stairs = 0;
        let waystones = 0;
        let seals = 0;
        for (let i = 0; i < tiles.length; i++) {
          const t = tiles[i]!;
          if (t === Tile.ENTRY) entries++;
          if (t === Tile.STAIRS_DOWN) {
            stairs++;
            expect(dist[i]!, "stairs must be reachable through plain doors").toBeGreaterThanOrEqual(0);
          }
          if (t === Tile.WAYSTONE) waystones++;
          if (t === Tile.SEAL) seals++;
        }
        expect(entries).toBe(1);
        expect(stairs).toBe(floor < MAX_FLOOR ? 1 : 0);
        expect(seals).toBe(floor === MAX_FLOOR ? 1 : 0);
        expect(waystones).toBeGreaterThanOrEqual(1);

        // iron doors never outnumber reachable keys ON this floor
        let ironDoors = 0;
        let keys = 0;
        for (let i = 0; i < tiles.length; i++) {
          if (tiles[i] === Tile.DOOR_IRON) ironDoors++;
          if (tiles[i] === Tile.KEY_DROP && dist[i]! >= 0) keys++;
        }
        expect(keys).toBeGreaterThanOrEqual(ironDoors);

        // spawns: sane positions, ids ascending, minibosses where promised
        let lastId = 0;
        for (const e of floorData.entities) {
          expect(e.id).toBeGreaterThan(lastId);
          lastId = e.id;
          expect((TILE_FLAGS[tiles[e.y * w + e.x]!]! & F_WALK) !== 0).toBe(true);
          expect(dist[e.y * w + e.x]!).toBeGreaterThanOrEqual(SPAWN_MIN_DIST_FROM_ENTRY);
        }
        const beasts = floorData.entities.filter((e) => e.kind === EntityKind.BEAST).length;
        if (floor === 3 || floor === 4) expect(beasts).toBe(1);
        const keepers = floorData.entities.filter((e) => e.kind === EntityKind.KEEPER).length;
        if (floor >= 8 && floor % 4 === 0) expect(keepers).toBe(1);

        // byte-identical regeneration incl. downstream initState
        const again = generateFloor(seed, floor);
        expect(Array.from(again.floorData.tiles)).toEqual(Array.from(tiles));
        expect(again.floorData.entities).toEqual(floorData.entities);
        const s1 = serializeState(initState(floorData, generateFloor(seed, floor).rngInit));
        const s2 = serializeState(initState(again.floorData, again.rngInit));
        expect(Array.from(s1)).toEqual(Array.from(s2));
      });
    }
  }

  test("omen gen options mutate layouts deterministically", () => {
    const plain = generateFloor(777, 1);
    const vermin = generateFloor(777, 1, { spawnMul: { [EntityKind.RAT]: 3 } });
    const plainRats = plain.floorData.entities.filter((e) => e.kind === EntityKind.RAT).length;
    const verminRats = vermin.floorData.entities.filter((e) => e.kind === EntityKind.RAT).length;
    expect(verminRats).toBeGreaterThan(plainRats);
    const again = generateFloor(777, 1, { spawnMul: { [EntityKind.RAT]: 3 } });
    expect(again.floorData.entities).toEqual(vermin.floorData.entities);
  });

  // D64 regression sweep: braziers/chests/shrines placed after the door
  // check used to seal ~1.8% of floors — a per-pair sample this small never
  // tripped it. 1500 floors would have expected ~27 hits before the fix.
  test("broad sweep: no floor is sealed by blocking features (60 seeds × 25 floors)", () => {
    const passable = (t: number): boolean =>
      (TILE_FLAGS[t]! & F_WALK) !== 0 || t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK;
    for (let seed = 5000; seed < 5060; seed++) {
      for (let floor = 1; floor <= MAX_FLOOR; floor++) {
        const { floorData } = generateFloor(seed, floor);
        const { tiles, w, h, px, py } = floorData;
        const dist = bfsReachable(tiles, w, h, px, py);
        for (let i = 0; i < tiles.length; i++) {
          if (passable(tiles[i]!) && dist[i]! < 0) {
            expect.fail(`seed ${seed} floor ${floor}: walkable (${i % w},${(i / w) | 0}) sealed off`);
          }
        }
      }
    }
  });
});
