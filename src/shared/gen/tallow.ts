/**
 * The Tallow Halls (biome 1, floors 1–4 per 01 §6) — generator v1.
 * Rooms + L-corridors (spanning tree by construction), flood-fill verified
 * anyway. Every layout draw comes from the GEN stream; spawn placement from
 * the SPAWN stream. All candidate lists are built by row-major scan and
 * picked via rollInt — no unsorted iteration anywhere (invariant 1).
 */

import { Stream, rollInt, chance } from "../sim/rng.js";
import { Tile, EntityKind, WormState, MothState, type Entity, type FloorData } from "../sim/types.js";
import {
  FLOOR_W,
  FLOOR_H,
  MAX_FLOOR,
  SPAWN_TABLE,
  SPAWN_MIN_DIST_FROM_ENTRY,
  HP,
  TILE_FLAGS,
  F_WALK,
  DX,
  DY,
} from "../sim/constants.js";

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
  // 1-tile margin so rooms never share walls
  return a.x - 1 < b.x + b.w && a.x + a.w + 1 > b.x && a.y - 1 < b.y + b.h && a.y + a.h + 1 > b.y;
}

/** Returns null when the attempt produced an unusable layout (caller reseeds). */
export function generateTallow(rng: Uint32Array, floor: number): FloorData | null {
  const w = FLOOR_W;
  const h = FLOOR_H;
  const n = w * h;
  const tiles = new Uint8Array(n).fill(Tile.WALL);
  const at = (x: number, y: number): number => y * w + x;

  // ── Rooms: exactly 12 placement attempts (fixed draw count) ──────────────
  const rooms: Room[] = [];
  for (let i = 0; i < 12; i++) {
    const rw = 4 + rollInt(rng, Stream.GEN, 4); // 4–7
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

  // ── Corridors: chain rooms in acceptance order (spanning tree) ───────────
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

  // ── Terrain patches: moss (quiet) everywhere, webbing floors 2+ ──────────
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
          if (dx !== 0 && dy !== 0 && chance(rng, Stream.GEN, 1, 2)) continue; // ragged corners
          if (tiles[at(x, y)] === Tile.FLOOR) tiles[at(x, y)] = tile;
        }
      }
    }
  };
  patch(Tile.MOSS, 2 + rollInt(rng, Stream.GEN, 2));
  if (floor >= 2) patch(Tile.WEBBING, 2 + rollInt(rng, Stream.GEN, 2));

  // ── Entry ────────────────────────────────────────────────────────────────
  const entryRoom = rooms[0]!;
  const px = entryRoom.x + rollInt(rng, Stream.GEN, entryRoom.w);
  const py = entryRoom.y + rollInt(rng, Stream.GEN, entryRoom.h);
  tiles[at(px, py)] = Tile.ENTRY;

  // ── BFS distance map from entry (doors count as passable — they open) ────
  const dist = new Int32Array(n).fill(-1);
  const queue: number[] = [at(px, py)];
  dist[at(px, py)] = 0;
  let qi = 0;
  const passable = (t: number): boolean =>
    (TILE_FLAGS[t]! & F_WALK) !== 0 || t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK;
  while (qi < queue.length) {
    const i = queue[qi++]!;
    const x = i % w;
    const y = (i / w) | 0; // non-negative int division
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]!;
      const ny = y + DY[d]!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = at(nx, ny);
      if (dist[ni]! >= 0 || !passable(tiles[ni]!)) continue;
      dist[ni] = dist[i]! + 1;
      queue.push(ni);
    }
  }

  // Connectivity: every carved tile must be reachable (spanning tree should
  // guarantee it; verify anyway — this guard survives future biome variants)
  for (let i = 0; i < n; i++) {
    if (passable(tiles[i]!) && dist[i]! < 0) return null;
  }

  // ── Feature placement helpers ────────────────────────────────────────────
  const roomDist = (r: Room): number => {
    const [cx, cy] = roomCenter(r);
    return dist[at(cx, cy)]! >= 0 ? dist[at(cx, cy)]! : 0;
  };
  /** Rooms ranked by BFS distance from entry (ties → lower index). */
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

  // ── Stairs (not on the last slice floor), waystone every floor ───────────
  if (floor < MAX_FLOOR) {
    const farRoom = rooms[ranked[ranked.length - 1]!]!;
    if (placeInRoom(farRoom, Tile.STAIRS_DOWN) < 0) return null;
  }
  const midRoom = rooms[ranked[ranked.length >> 1]!]!;
  if (placeInRoom(midRoom, Tile.WAYSTONE) < 0) return null;

  // ── Doors at corridor↔room junctions ─────────────────────────────────────
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
      if (inRoom) continue; // corridor tiles only
      const nWall = tiles[at(x, y - 1)] === Tile.WALL;
      const sWall = tiles[at(x, y + 1)] === Tile.WALL;
      const eWall = tiles[at(x + 1, y)] === Tile.WALL;
      const wWall = tiles[at(x - 1, y)] === Tile.WALL;
      if ((nWall && sWall && !eWall && !wWall) || (eWall && wWall && !nWall && !sWall)) {
        doorCands.push(at(x, y));
      }
    }
  }
  const doorCount = 2 + rollInt(rng, Stream.GEN, 2); // 2–3
  for (let d = 0; d < doorCount && doorCands.length > 0; d++) {
    const pick = rollInt(rng, Stream.GEN, doorCands.length);
    const i = doorCands[pick]!;
    doorCands.splice(pick, 1);
    tiles[i] = chance(rng, Stream.GEN, 1, 3) ? Tile.DOOR_STUCK : Tile.DOOR_CLOSED;
  }

  // ── Braziers: wall-adjacent room tiles ───────────────────────────────────
  const brazierCands: number[] = [];
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
      if (wallAdj && i !== at(px, py)) brazierCands.push(i);
    }
  }
  const brazierCount = 1 + rollInt(rng, Stream.GEN, 2); // 1–2
  for (let b = 0; b < brazierCount && brazierCands.length > 0; b++) {
    const pick = rollInt(rng, Stream.GEN, brazierCands.length);
    const i = brazierCands[pick]!;
    brazierCands.splice(pick, 1);
    tiles[i] = Tile.BRAZIER_UNLIT;
  }

  // ── Wax pickups ──────────────────────────────────────────────────────────
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
  dropPickups(Tile.WAX_DRIP, 3 + rollInt(rng, Stream.GEN, 3)); // 3–5
  dropPickups(Tile.WAX_STUB, 1);
  if (chance(rng, Stream.GEN, 1, 2)) dropPickups(Tile.WAX_CAKE, 1);

  // ── Spawns (SPAWN stream; ≥ min distance from entry) ─────────────────────
  const entities: Entity[] = [];
  let nextEntityId = 1;
  const spawnTable = SPAWN_TABLE[floor] ?? SPAWN_TABLE[3]!;
  const occupied = (x: number, y: number): boolean => {
    for (let i = 0; i < entities.length; i++) {
      if (entities[i]!.x === x && entities[i]!.y === y) return true;
    }
    return false;
  };
  for (let t = 0; t < spawnTable.length; t++) {
    const [kind, min, max] = spawnTable[t]!;
    const count = min + rollInt(rng, Stream.SPAWN, max - min + 1);
    for (let c = 0; c < count; c++) {
      const cands: number[] = [];
      for (let i = 0; i < n; i++) {
        const tt = tiles[i]!;
        if (tt !== Tile.FLOOR && tt !== Tile.MOSS && tt !== Tile.WEBBING) continue;
        if (dist[i]! < SPAWN_MIN_DIST_FROM_ENTRY) continue;
        if (occupied(i % w, (i / w) | 0)) continue;
        cands.push(i);
      }
      if (cands.length === 0) return null;
      const i = cands[rollInt(rng, Stream.SPAWN, cands.length)]!;
      entities.push({
        id: nextEntityId++,
        kind,
        x: i % w,
        y: (i / w) | 0,
        hp: HP[kind]!,
        state: kind === EntityKind.WICKWORM ? WormState.BURROWED : MothState.WANDER,
        data: 0,
      });
    }
  }

  return { floor, w, h, tiles, px, py, entities, nextEntityId };
}
