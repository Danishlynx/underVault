// src/server/core/compose.ts — deterministic floor composition (08 §1.7).
//
// Server-side twin of the dev adapter's layering (dev/rules-adapter.ts is the
// REFERENCE — logic copied, never imported; guard-enforced). Composition MUST
// be reproducible for the whole run lifetime, so every input is pinned to the
// run's per-floor entry timestamp:
//
//   - shared entries (braziers, glowmoss) included iff entry.ts <= enteredTs
//   - signs included iff sign.ts <= enteredTs
//   - corpses included iff createdTs <= enteredTs < expiryTs (GC keeps a 1 h
//     grace so anything visible at entry outlives the 45 min run)
//   - caller's own chalk (stable mid-run: persisted only at end/bank)
//   - echoes are cosmetic and excluded from replay inputs entirely
//
// Deterministic ordering: shared entries and signs ascending tileIndex;
// corpses ascending corpse id (string compare) with the dev adapter's
// 13-offset re-seat spiral verbatim; final entities sorted ascending by id.

import { generateFloor } from "../../shared/gen/index.js";
import { EntityKind, Tile, type FloorData } from "../../shared/sim/types.js";
import { HP, TILE_FLAGS, F_WALK } from "../../shared/sim/constants.js";
import type { OmenDay } from "../rules/resolve.js";
import type { SharedEntry, SignEntry } from "../data/days.js";
import type { CorpseRow } from "../data/corpses.js";

export interface ComposeInputs {
  floor: number;
  daySeedFloor: number; // from daySeedForFloor() — the ONLY seed gen ever sees
  omen: OmenDay;
  enteredTs: number; // pin — from RunRow.floorEnteredTs[floor]
  shared: SharedEntry[];
  signs: SignEntry[];
  corpses: CorpseRow[];
  chalk: Uint8Array | null;
}

export interface ComposedFloor {
  floorData: FloorData;
  rngInit: Uint32Array;
  corpseIds: string[];
  signContents: { tileIndex: number; template: number; noun: number }[];
}

export function composeFloor(i: ComposeInputs): ComposedFloor {
  const g = generateFloor(i.daySeedFloor, i.floor, i.omen.gen);
  const fd = g.floorData;
  const n = fd.w * fd.h;

  // shared day-state: braziers lit / glowmoss planted by earlier runs
  const shared = i.shared
    .filter((e) => e.ts <= i.enteredTs)
    .sort((a, b) => a.tileIndex - b.tileIndex);
  for (const e of shared) {
    if (e.tileIndex < 0 || e.tileIndex >= n) continue;
    const t = fd.tiles[e.tileIndex]!;
    if (e.kind === 1) {
      if (t === Tile.BRAZIER_UNLIT) fd.tiles[e.tileIndex] = Tile.BRAZIER_LIT;
    } else if (t === Tile.FLOOR || t === Tile.MOSS) {
      fd.tiles[e.tileIndex] = Tile.GLOWMOSS;
    }
  }

  // day-scoped signs: presence bitmap + contents, ascending tileIndex
  const signs = new Uint8Array(n);
  const signContents: ComposedFloor["signContents"] = [];
  const signRows = i.signs
    .filter((s) => s.ts <= i.enteredTs)
    .sort((a, b) => a.tileIndex - b.tileIndex);
  for (const s of signRows) {
    if (s.tileIndex < 0 || s.tileIndex >= n) continue;
    if (signs[s.tileIndex] !== 0) continue;
    signs[s.tileIndex] = 1;
    signContents.push({ tileIndex: s.tileIndex, template: s.template, noun: s.noun });
  }
  fd.signs = signs;

  // the caller's own persistent chalk (D17)
  if (i.chalk !== null && i.chalk.length === n) fd.chalk = i.chalk.slice();

  // corpses within the pin walk among the entities; a death on bad ground is
  // re-seated on the nearest open tile — the 13-offset spiral, verbatim from
  // the dev adapter (a corpse carries unbanked truths and must never vanish)
  const seatFor = (cx: number, cy: number): { x: number; y: number } | null => {
    const SX = [0, 0, 1, 0, -1, 1, 1, -1, -1, 0, 2, 0, -2];
    const SY = [0, -1, 0, 1, 0, -1, 1, 1, -1, -2, 0, 2, 0];
    for (let k = 0; k < SX.length; k++) {
      const x = cx + SX[k]!;
      const y = cy + SY[k]!;
      if (x < 0 || y < 0 || x >= fd.w || y >= fd.h) continue;
      if ((TILE_FLAGS[fd.tiles[y * fd.w + x]!]! & F_WALK) === 0) continue;
      if (fd.entities.some((e) => e.x === x && e.y === y)) continue;
      if (x === fd.px && y === fd.py) continue;
      return { x, y };
    }
    return null;
  };
  const corpseIds: string[] = [];
  const rows = i.corpses
    .filter(
      (c) => c.floor === i.floor && c.createdTs <= i.enteredTs && i.enteredTs < c.expiryTs,
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const c of rows) {
    const seat = seatFor(c.x, c.y);
    if (seat === null) continue;
    fd.entities.push({
      id: fd.nextEntityId++,
      kind: EntityKind.CORPSE,
      x: seat.x,
      y: seat.y,
      hp: HP[EntityKind.CORPSE]!,
      state: 0,
      data: corpseIds.length, // index into the returned corpseIds array
    });
    corpseIds.push(c.id);
  }
  fd.entities.sort((a, b) => a.id - b.id);

  return { floorData: fd, rngInit: g.rngInit, corpseIds, signContents };
}
