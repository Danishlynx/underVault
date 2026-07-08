/**
 * Floor generation entry point: (daySeed, floor) → FloorData + RNG block.
 * This is the ONLY place (besides the server / dev adapter) that ever sees
 * the day seed — it must never end up inside SimState (02 §4).
 *
 * rngInit: the returned 20-word block carries the POST-generation gen/spawn
 * stream states (stream continuity — no correlated reseeds) plus fresh
 * per-floor ai/loot/fx streams.
 */

import { Stream, seedStream, RNG_WORDS } from "../sim/rng.js";
import type { FloorData } from "../sim/types.js";
import { generateTallow } from "./tallow.js";

export interface GenResult {
  floorData: FloorData;
  rngInit: Uint32Array;
}

const MAX_ATTEMPTS = 8;

export function generateFloor(daySeed: number, floor: number): GenResult {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = new Uint32Array(RNG_WORDS);
    const salt = ((floor << 4) | attempt) >>> 0;
    for (let stream = 0; stream < 5; stream++) {
      const [a, b, c, d] = seedStream(daySeed, stream, salt);
      const o = stream << 2;
      rng[o] = a;
      rng[o + 1] = b;
      rng[o + 2] = c;
      rng[o + 3] = d;
    }
    const floorData = generateTallow(rng, floor);
    if (floorData !== null) {
      return { floorData, rngInit: rng };
    }
  }
  // Deterministic failure after bounded retries is a build bug, not a
  // runtime path — the golden corpus pins working (seed, floor) pairs.
  throw new Error(`generateFloor: no valid layout for floor ${floor} after ${MAX_ATTEMPTS} attempts`);
}

export { Stream };
