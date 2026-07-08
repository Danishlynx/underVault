/**
 * Floor generation entry point: (daySeed, floor, opts) → FloorData + RNG
 * block. This — plus the server/dev adapter — is the ONLY place that ever
 * sees the day seed (02 §4). GenOptions carry omen-driven mutations
 * (spawn multipliers, pre-lit braziers…) WITHOUT telling the sim why.
 */

import { Stream, seedStream, RNG_WORDS } from "../sim/rng.js";
import type { FloorData } from "../sim/types.js";
import { generateBiomeFloor, type GenOptions } from "./tallow.js";

export interface GenResult {
  floorData: FloorData;
  rngInit: Uint32Array;
}

const MAX_ATTEMPTS = 8;

export function generateFloor(daySeed: number, floor: number, opts?: GenOptions): GenResult {
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
    const floorData = generateBiomeFloor(rng, floor, opts);
    if (floorData !== null) {
      return { floorData, rngInit: rng };
    }
  }
  throw new Error(`generateFloor: no valid layout for floor ${floor} after ${MAX_ATTEMPTS} attempts`);
}

export { Stream };
export type { GenOptions };
