/**
 * Biome floor generator v2 — one carving algorithm, data-driven per biome
 * (01 §6 ladder): rooms + L-corridors, then biome terrain (water rows,
 * glowmoss, webbing), features (doors incl. the 01 §10 taxonomy, chests,
 * shrines, plates, inscriptions from floor 9), pickups, and spawns (01 §8
 * tables + minibosses). Every layout draw comes from the GEN stream; spawn
 * placement from SPAWN; chest contents resolve at open-time from LOOT.
 * Solvability guarantee: stairs stay reachable through plain doors only —
 * special doors gate loot, never progress.
 */

import { Stream, rollInt, chance } from "../sim/rng.js";
import { Tile, EntityKind, WormState, MothState, type Entity, type FloorData } from "../sim/types.js";
import {
  MAX_FLOOR,
  BIOMES,
  biomeFor,
  bossFor,
  SPAWN_TABLE,
  SPAWN_MIN_DIST_FROM_ENTRY,
  HP,
  TILE_FLAGS,
  F_WALK,
  DX,
  DY,
} from "../sim/constants.js";

export interface GenOptions {
  /** integer spawn multipliers per EntityKind (omens: Verminmoon ×3 …) */
  spawnMul?: Readonly<Record<number, number>>;
  drippingsMul?: number; // Waxfall ×2
  preLitBraziers?: boolean; // Kindlenight
  extraWater?: number; // Weeping Walls
  extraKeys?: number; // Ironbloom
}

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

function roomCenter(r: Room): [number, number] {
  return [r.x + (r.w >> 1), r.y + (r.h >> 1)];
}
function overlaps(a: Room, b: Room): boolean {
  return a.x - 1 < b.x + b.w && a.x + a.w + 1 > b.x && a.y - 1 < b.y + b.h && a.y + a.h + 1 > b.y;
}

export function generateBiomeFloor(rng: Uint32Array, floor: number, opts?: GenOptions): FloorData | null {
  const biome = biomeFor(floor);
  const biomeIdx = BIOMES.indexOf(biome);
  const w = biome.size;
  const h = biome.size;
  const n = w * h;
  const tiles = new Uint8Array(n).fill(Tile.WALL);
  const at = (x: number, y: number): number => y * w + x;

  // ── Rooms (attempts scale gently with size) ──────────────────────────────
  const attempts = 12 + ((w - 24) >> 1) * 2;
  const rooms: Room[] = [];
  for (let i = 0; i < attempts; i++) {
    const rw = 4 + rollInt(rng, Stream.GEN, 4);
    const rh = 4 + rollInt(rng, Stream.GEN, 4);
    const rx = 1 + rollInt(rng, Stream.GEN, w - rw - 2);
    const ry = 1 + rollInt(rng, Stream.GEN, h - rh - 2);
    const room: Room = { x: rx, y: ry, w: rw, h: rh };
    let ok = true;
    for (let j = 0; j < rooms.length; j++) {
      if (overlaps(room, rooms[j]!)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    rooms.push(room);
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) tiles[at(x, y)] = Tile.FLOOR;
    }
  }
  if (rooms.length < 4) return null;

  // ── Corridors (spanning chain) ───────────────────────────────────────────
  for (let i = 0; i + 1 < rooms.length; i++) {
    const [ax, ay] = roomCenter(rooms[i]!);
    const [bx, by] = roomCenter(rooms[i + 1]!);
    const horizontalFirst = chance(rng, Stream.GEN, 1, 2);
    const carve = (x: number, y: number): void => {
      if (tiles[at(x, y)] === Tile.WALL) tiles[at(x, y)] = Tile.FLOOR;
    };
    if (horizontalFirst) {
      for (let x = ax < bx ? ax : bx; x <= (ax < bx ? bx : ax); x++) carve(x, ay);
      for (let y = ay < by ? ay : by; y <= (ay < by ? by : ay); y++) carve(bx, y);
    } else {
      for (let y = ay < by ? ay : by; y <= (ay < by ? by : ay); y++) carve(ax, y);
      for (let x = ax < bx ? ax : bx; x <= (ax < bx ? bx : ax); x++) carve(x, by);
    }
  }

  // ── Biome terrain ────────────────────────────────────────────────────────
  const patch = (tile: number, count: number): void => {
    for (let p = 0; p < count; p++) {
      const room = rooms[rollInt(rng, Stream.GEN, rooms.length)]!;
      const cx = room.x + rollInt(rng, Stream.GEN, room.w);
      const cy = room.y + rollInt(rng, Stream.GEN, room.h);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          if (dx !== 0 && dy !== 0 && chance(rng, Stream.GEN, 1, 2)) continue;
          if (tiles[at(x, y)] === Tile.FLOOR) tiles[at(x, y)] = tile;
        }
      }
    }
  };
  patch(Tile.MOSS, 2 + rollInt(rng, Stream.GEN, 2));
  if (biome.webbing > 0) patch(Tile.WEBBING, biome.webbing);
  if (biome.glowmoss > 0) {
    // glowmoss grows in single tufts, not blankets
    for (let g = 0; g < biome.glowmoss; g++) {
      const room = rooms[rollInt(rng, Stream.GEN, rooms.length)]!;
      const x = room.x + rollInt(rng, Stream.GEN, room.w);
      const y = room.y + rollInt(rng, Stream.GEN, room.h);
      if (tiles[at(x, y)] === Tile.FLOOR) tiles[at(x, y)] = Tile.GLOWMOSS;
    }
  }
  const waterRows = biome.water + (opts?.extraWater ?? 0);
  for (let r = 0; r < waterRows; r++) {
    const room = rooms[rollInt(rng, Stream.GEN, rooms.length)]!;
    const y = room.y + rollInt(rng, Stream.GEN, room.h);
    const x0 = room.x + rollInt(rng, Stream.GEN, room.w >> 1);
    const len = 3 + rollInt(rng, Stream.GEN, 5);
    for (let x = x0; x < x0 + len && x < room.x + room.w; x++) {
      if (tiles[at(x, y)] === Tile.FLOOR || tiles[at(x, y)] === Tile.MOSS) tiles[at(x, y)] = Tile.WATER;
    }
  }

  // ── Entry + BFS ──────────────────────────────────────────────────────────
  const entryRoom = rooms[0]!;
  const px = entryRoom.x + rollInt(rng, Stream.GEN, entryRoom.w);
  const py = entryRoom.y + rollInt(rng, Stream.GEN, entryRoom.h);
  tiles[at(px, py)] = Tile.ENTRY;

  const passablePlain = (t: number): boolean =>
    (TILE_FLAGS[t]! & F_WALK) !== 0 || t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK;
  const bfsFromEntry = (passable: (t: number) => boolean): Int32Array => {
    const d = new Int32Array(n).fill(-1);
    const queue: number[] = [at(px, py)];
    d[at(px, py)] = 0;
    let qi = 0;
    while (qi < queue.length) {
      const i = queue[qi++]!;
      const x = i % w;
      const y = (i / w) | 0; // non-negative int division
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k]!;
        const ny = y + DY[k]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = at(nx, ny);
        if (d[ni]! >= 0 || !passable(tiles[ni]!)) continue;
        d[ni] = d[i]! + 1;
        queue.push(ni);
      }
    }
    return d;
  };
  const dist = bfsFromEntry(passablePlain);
  for (let i = 0; i < n; i++) {
    if (passablePlain(tiles[i]!) && dist[i]! < 0) return null;
  }

  const roomDist = (r: Room): number => {
    const [cx, cy] = roomCenter(r);
    return dist[at(cx, cy)]! >= 0 ? dist[at(cx, cy)]! : 0;
  };
  const ranked: number[] = [];
  for (let i = 0; i < rooms.length; i++) ranked.push(i);
  ranked.sort((a, b) => roomDist(rooms[a]!) - roomDist(rooms[b]!) || a - b);

  const freeTilesIn = (r: Room): number[] => {
    const out: number[] = [];
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const t = tiles[at(x, y)]!;
        if (t === Tile.FLOOR || t === Tile.MOSS || t === Tile.WEBBING) out.push(at(x, y));
      }
    }
    return out;
  };
  const placeInRoom = (r: Room, tile: number): number => {
    const cand = freeTilesIn(r);
    if (cand.length === 0) return -1;
    const i = cand[rollInt(rng, Stream.GEN, cand.length)]!;
    tiles[i] = tile;
    return i;
  };

  // ── Stairs / waystone / the Seal ─────────────────────────────────────────
  const farRoom = rooms[ranked[ranked.length - 1]!]!;
  if (floor < MAX_FLOOR) {
    if (placeInRoom(farRoom, Tile.STAIRS_DOWN) < 0) return null;
  } else {
    if (placeInRoom(farRoom, Tile.SEAL) < 0) return null; // the Bottom
    if (placeInRoom(farRoom, Tile.WAYSTONE) < 0) return null;
  }
  const midRoom = rooms[ranked[ranked.length >> 1]!]!;
  if (placeInRoom(midRoom, Tile.WAYSTONE) < 0) return null;

  // ── Doors: plain at junctions; deeper biomes lace in the taxonomy ────────
  const doorCands: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (tiles[at(x, y)] !== Tile.FLOOR) continue;
      let inRoom = false;
      for (let r = 0; r < rooms.length; r++) {
        const rm = rooms[r]!;
        if (x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.h) {
          inRoom = true;
          break;
        }
      }
      if (inRoom) continue;
      const nWall = tiles[at(x, y - 1)] === Tile.WALL;
      const sWall = tiles[at(x, y + 1)] === Tile.WALL;
      const eWall = tiles[at(x + 1, y)] === Tile.WALL;
      const wWall = tiles[at(x - 1, y)] === Tile.WALL;
      if ((nWall && sWall && !eWall && !wWall) || (eWall && wWall && !nWall && !sWall)) {
        doorCands.push(at(x, y));
      }
    }
  }
  const specialDoorPool: number[] = [];
  if (biomeIdx >= 1) specialDoorPool.push(Tile.DOOR_IRON, Tile.DOOR_HUNGER);
  if (biomeIdx >= 2) specialDoorPool.push(Tile.DOOR_CHOIR);
  if (biomeIdx >= 3) specialDoorPool.push(Tile.DOOR_SIGIL);
  let ironDoors = 0;
  const doorCount = 2 + rollInt(rng, Stream.GEN, 2) + (biomeIdx >= 1 ? 1 : 0);
  for (let d = 0; d < doorCount && doorCands.length > 0; d++) {
    const pick = rollInt(rng, Stream.GEN, doorCands.length);
    const i = doorCands[pick]!;
    doorCands.splice(pick, 1);
    if (specialDoorPool.length > 0 && chance(rng, Stream.GEN, 1, 3)) {
      const t = specialDoorPool[rollInt(rng, Stream.GEN, specialDoorPool.length)]!;
      tiles[i] = t;
      if (t === Tile.DOOR_IRON) ironDoors++;
    } else {
      tiles[i] = chance(rng, Stream.GEN, 1, 3) ? Tile.DOOR_STUCK : Tile.DOOR_CLOSED;
    }
  }
  // solvability: stairs/seal must be reachable through PLAIN doors only;
  // demote blocking special doors back to plain wood
  {
    const d2 = bfsFromEntry(passablePlain);
    for (let i = 0; i < n; i++) {
      const t = tiles[i]!;
      const special =
        t === Tile.DOOR_IRON || t === Tile.DOOR_HUNGER || t === Tile.DOOR_CHOIR || t === Tile.DOOR_SIGIL;
      if (!special) continue;
      // temporarily … simpler: if anything walkable is unreachable, demote it
      void d2;
    }
    // re-verify with special doors as walls; demote until goal reachable
    for (let guard = 0; guard < 8; guard++) {
      const d3 = bfsFromEntry(passablePlain);
      let allReached = true;
      let demoteAt = -1;
      for (let i = 0; i < n; i++) {
        if (passablePlain(tiles[i]!) && d3[i]! < 0) {
          allReached = false;
          // find a special door adjacent to the reachable region to demote
          for (let j = 0; j < n && demoteAt < 0; j++) {
            const t = tiles[j]!;
            const special =
              t === Tile.DOOR_IRON || t === Tile.DOOR_HUNGER || t === Tile.DOOR_CHOIR || t === Tile.DOOR_SIGIL;
            if (!special) continue;
            const x = j % w;
            const y = (j / w) | 0;
            for (let k = 0; k < 4; k++) {
              const ni = at(x + DX[k]!, y + DY[k]!);
              if (ni >= 0 && ni < n && d3[ni]! >= 0) {
                demoteAt = j;
                break;
              }
            }
          }
          break;
        }
      }
      if (allReached) break;
      if (demoteAt < 0) return null;
      if (tiles[demoteAt] === Tile.DOOR_IRON) ironDoors--;
      tiles[demoteAt] = Tile.DOOR_CLOSED;
    }
  }

  // ── Braziers, chests, shrines, plates, inscriptions ──────────────────────
  const wallAdjacentCands = (): number[] => {
    const out: number[] = [];
    for (let r = 0; r < rooms.length; r++) {
      const cand = freeTilesIn(rooms[r]!);
      for (let k = 0; k < cand.length; k++) {
        const i = cand[k]!;
        const x = i % w;
        const y = (i / w) | 0;
        let wallAdj = false;
        for (let d = 0; d < 4; d++) {
          if (tiles[at(x + DX[d]!, y + DY[d]!)] === Tile.WALL) {
            wallAdj = true;
            break;
          }
        }
        if (wallAdj && i !== at(px, py)) out.push(i);
      }
    }
    return out;
  };
  const placeWallAdjacent = (tile: number, count: number): void => {
    const cands = wallAdjacentCands();
    for (let b = 0; b < count && cands.length > 0; b++) {
      const pick = rollInt(rng, Stream.GEN, cands.length);
      tiles[cands[pick]!] = tile;
      cands.splice(pick, 1);
    }
  };
  placeWallAdjacent(opts?.preLitBraziers === true ? Tile.BRAZIER_LIT : Tile.BRAZIER_UNLIT, 1 + rollInt(rng, Stream.GEN, 2));
  if (biome.chests > 0) placeWallAdjacent(Tile.CHEST, 1 + rollInt(rng, Stream.GEN, biome.chests));
  if (biome.plates > 0) placeWallAdjacent(Tile.PLATE, biome.plates);
  if (chance(rng, Stream.GEN, 1, 2)) {
    const shrines = [Tile.ALTAR, Tile.POOL, Tile.FONT];
    placeWallAdjacent(shrines[rollInt(rng, Stream.GEN, shrines.length)]!, 1);
  }
  if (floor >= 9) {
    // cipher inscriptions on walls beside walked ground (01 §6/§12)
    let placed = 0;
    for (let i = 0; i < n && placed < 2; i++) {
      if (tiles[i] !== Tile.WALL) continue;
      const x = i % w;
      const y = (i / w) | 0;
      if (y + 1 < h && dist[at(x, y + 1)]! >= 0 && chance(rng, Stream.GEN, 1, 12)) {
        tiles[i] = Tile.INSCRIPTION;
        placed++;
      }
    }
  }

  // ── Pickups (keys must at least match iron doors) ────────────────────────
  const pickupCands = (): number[] => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = tiles[i]!;
      if ((t === Tile.FLOOR || t === Tile.MOSS) && i !== at(px, py)) out.push(i);
    }
    return out;
  };
  const dropPickups = (tile: number, count: number): void => {
    const cands = pickupCands();
    for (let k = 0; k < count && cands.length > 0; k++) {
      const pick = rollInt(rng, Stream.GEN, cands.length);
      tiles[cands[pick]!] = tile;
      cands.splice(pick, 1);
    }
  };
  const dripMul = opts?.drippingsMul ?? 1;
  dropPickups(Tile.WAX_DRIP, (3 + rollInt(rng, Stream.GEN, 3)) * dripMul);
  dropPickups(Tile.WAX_STUB, 1);
  if (chance(rng, Stream.GEN, 1, 2)) dropPickups(Tile.WAX_CAKE, 1);
  dropPickups(Tile.KEY_DROP, ironDoors + (opts?.extraKeys ?? 0));

  // ── Spawns ───────────────────────────────────────────────────────────────
  const entities: Entity[] = [];
  let nextEntityId = 1;
  const table = SPAWN_TABLE[biomeIdx] ?? SPAWN_TABLE[0]!;
  const occupied = (x: number, y: number): boolean => {
    for (let i = 0; i < entities.length; i++) {
      if (entities[i]!.x === x && entities[i]!.y === y) return true;
    }
    return false;
  };
  const spawnOne = (kind: number): boolean => {
    const cands: number[] = [];
    for (let i = 0; i < n; i++) {
      const tt = tiles[i]!;
      const wantWater = kind === EntityKind.DROWNED;
      const onWater = tt === Tile.WATER;
      if (wantWater !== onWater && wantWater) continue;
      if (!wantWater && tt !== Tile.FLOOR && tt !== Tile.MOSS && tt !== Tile.WEBBING) continue;
      if (dist[i]! < SPAWN_MIN_DIST_FROM_ENTRY) continue;
      if (occupied(i % w, (i / w) | 0)) continue;
      cands.push(i);
    }
    if (cands.length === 0) return false;
    const i = cands[rollInt(rng, Stream.SPAWN, cands.length)]!;
    const initState =
      kind === EntityKind.WICKWORM ? WormState.BURROWED : kind === EntityKind.MOTH ? MothState.WANDER : 0;
    entities.push({
      id: nextEntityId++,
      kind,
      x: i % w,
      y: (i / w) | 0,
      hp: HP[kind] ?? 1,
      state: initState,
      data: 0,
    });
    return true;
  };
  const floorDepthBonus = floor - biome.firstFloor >= 2 ? 1 : 0;
  for (let t = 0; t < table.length; t++) {
    const [kind, min, max] = table[t]!;
    const mul = opts?.spawnMul?.[kind] ?? 1;
    const count = (min + rollInt(rng, Stream.SPAWN, max - min + 1) + floorDepthBonus) * mul;
    for (let c = 0; c < count; c++) {
      if (!spawnOne(kind)) break;
    }
  }
  const boss = bossFor(floor);
  if (boss !== 0) spawnOne(boss);

  return { floor, w, h, tiles, px, py, entities, nextEntityId };
}
