// src/server/rules/seed.ts — ★ SECRET (D32, 08 §1.9).
//
// The master day seed is 2×u32 crypto entropy plus an independent omen seed;
// only DERIVED u32s ever reach gen or the wire. Inverting a floor's rngInit
// recovers only that floor's derived u32 — no cross-floor foresight, no
// master-seed recovery. Never write seedHi/seedLo anywhere but day:{d}:meta;
// never log them.
//
// NOT sim logic — invariant 1 (determinism) scopes to src/shared/sim; crypto
// randomness here only MINTS the day, it never runs inside a tick.

import { randomBytes } from "node:crypto";
import { xxhash32 } from "../../shared/sim/pack.js";

const DERIVE_SEED = 0x5eed0001;

/** node:crypto randomBytes(12) → three u32s (LE). */
export function mintDaySeed(): { seedHi: number; seedLo: number; omenSeed: number } {
  const b = randomBytes(12);
  return {
    seedHi: b.readUInt32LE(0),
    seedLo: b.readUInt32LE(4),
    omenSeed: b.readUInt32LE(8),
  };
}

/**
 * The ONLY u32 `generateFloor` ever sees (C5): derived per (day, floor) via
 * xxhash32 over the LE bytes of [seedHi, seedLo, day, floor].
 */
export function daySeedForFloor(
  seedHi: number,
  seedLo: number,
  day: number,
  floor: number,
): number {
  const bytes = new Uint8Array(16);
  const words = [seedHi >>> 0, seedLo >>> 0, day >>> 0, floor >>> 0];
  for (let i = 0; i < 4; i++) {
    const v = words[i]!;
    const o = i * 4;
    bytes[o] = v & 0xff;
    bytes[o + 1] = (v >>> 8) & 0xff;
    bytes[o + 2] = (v >>> 16) & 0xff;
    bytes[o + 3] = (v >>> 24) & 0xff;
  }
  return xxhash32(bytes, DERIVE_SEED) >>> 0;
}
