/**
 * xoshiro128** with named substreams (invariant 1).
 * Integer-only: Math.imul + >>>0 everywhere; no floats anywhere.
 * Stream state lives in a Uint32Array(20) = 5 streams × 4 words:
 *   [gen ×4, spawn ×4, ai ×4, loot ×4, fx ×4]
 * The fx slice (words 16..19) is EXCLUDED from canonical serialization —
 * it must never influence validated state (quarantine test enforces).
 */

export const Stream = { GEN: 0, SPAWN: 1, AI: 2, LOOT: 3, FX: 4 } as const;
export type StreamId = (typeof Stream)[keyof typeof Stream];

export const RNG_WORDS = 20;

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** splitmix32 step: returns [output, nextState]. */
export function splitmix32(x: number): [number, number] {
  const nx = (x + 0x9e3779b9) >>> 0;
  let z = nx;
  z = (z ^ (z >>> 16)) >>> 0;
  z = Math.imul(z, 0x21f0aaad) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  z = Math.imul(z, 0x735a2d97) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  return [z, nx];
}

/** Seed one stream's 4 words from (daySeed, streamId, salt). */
export function seedStream(daySeed: number, streamId: number, salt: number): [number, number, number, number] {
  const x0 =
    (daySeed ^ Math.imul(streamId + 1, 0x9e3779b9) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  const [a0, x1] = splitmix32(x0);
  const [b, x2] = splitmix32(x1);
  const [c, x3] = splitmix32(x2);
  const [d] = splitmix32(x3);
  let a = a0;
  if ((a | b | c | d) === 0) a = 0x9e3779b9; // all-zero is a xoshiro fixed point
  return [a, b, c, d];
}

/** Fill a full 20-word block: every stream seeded from (daySeed, salt). */
export function seedAllStreams(daySeed: number, salt: number): Uint32Array {
  const out = new Uint32Array(RNG_WORDS);
  for (let s = 0; s < 5; s++) {
    const [a, b, c, d] = seedStream(daySeed, s, salt);
    const o = s << 2;
    out[o] = a;
    out[o + 1] = b;
    out[o + 2] = c;
    out[o + 3] = d;
  }
  return out;
}

/** Core xoshiro128** draw, operating in place on the stream's 4 words. */
export function nextU32(rng: Uint32Array, stream: number): number {
  const o = stream << 2;
  let s0 = rng[o]! >>> 0;
  let s1 = rng[o + 1]! >>> 0;
  let s2 = rng[o + 2]! >>> 0;
  let s3 = rng[o + 3]! >>> 0;

  const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;

  const t = (s1 << 9) >>> 0;
  s2 = (s2 ^ s0) >>> 0;
  s3 = (s3 ^ s1) >>> 0;
  s1 = (s1 ^ s2) >>> 0;
  s0 = (s0 ^ s3) >>> 0;
  s2 = (s2 ^ t) >>> 0;
  s3 = rotl(s3, 11);

  rng[o] = s0;
  rng[o + 1] = s1;
  rng[o + 2] = s2;
  rng[o + 3] = s3;
  return result;
}

/**
 * Uniform integer in [0, n) without modulo bias (rejection sampling).
 * n must be an integer in [1, 2^31). Threshold form avoids float 2**32.
 */
export function rollInt(rng: Uint32Array, stream: number, n: number): number {
  if (n <= 1) return 0;
  const threshold = (-n >>> 0) % n; // (2^32 - n) % n, integer-only
  let r = nextU32(rng, stream);
  while (r < threshold) r = nextU32(rng, stream);
  return r % n;
}

/** True with probability num/den. */
export function chance(rng: Uint32Array, stream: number, num: number, den: number): boolean {
  return rollInt(rng, stream, den) < num;
}

/** In-place Fisher–Yates over a number array (high-to-low). */
export function shuffle(rng: Uint32Array, stream: number, arr: number[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rollInt(rng, stream, i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}
