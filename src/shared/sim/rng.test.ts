import { describe, expect, test } from "vitest";
import { Stream, nextU32, rollInt, seedAllStreams, seedStream, splitmix32 } from "./rng.js";

describe("xoshiro128**", () => {
  test("known-answer vector, seed [1,2,3,4]", () => {
    // Hand-derived from the reference algorithm (Vigna); first three outputs.
    const rng = new Uint32Array(20);
    rng[0] = 1;
    rng[1] = 2;
    rng[2] = 3;
    rng[3] = 4;
    expect(nextU32(rng, Stream.GEN)).toBe(11520);
    expect(nextU32(rng, Stream.GEN)).toBe(0);
    expect(nextU32(rng, Stream.GEN)).toBe(5927040);
  });

  test("substream independence: drawing gen leaves others untouched", () => {
    const a = seedAllStreams(0xdecafbad, 1);
    const b = a.slice();
    for (let i = 0; i < 1000; i++) nextU32(a, Stream.GEN);
    for (let s = Stream.SPAWN; s <= Stream.FX; s++) {
      const o = s << 2;
      expect(Array.from(a.slice(o, o + 4))).toEqual(Array.from(b.slice(o, o + 4)));
      expect(nextU32(a, s)).toBe(nextU32(b, s));
    }
  });

  test("streams differ from each other and across salts", () => {
    const x = seedAllStreams(42, 1);
    const y = seedAllStreams(42, 2);
    expect(nextU32(x, Stream.GEN)).not.toBe(nextU32(x, Stream.SPAWN));
    const x2 = seedAllStreams(42, 1);
    const y2 = seedAllStreams(42, 2);
    expect(nextU32(x2, Stream.GEN)).not.toBe(nextU32(y2, Stream.GEN));
    void y;
  });

  test("all-zero seed guard yields a working stream", () => {
    // Find inputs that would zero out; the guard must prevent a stuck stream.
    const [a, b, c, d] = seedStream(0, 0, 0);
    expect(a | b | c | d).not.toBe(0);
  });

  test("splitmix32 threads state and produces distinct outputs", () => {
    const [o1, s1] = splitmix32(1);
    const [o2, s2] = splitmix32(s1);
    expect(o1).not.toBe(o2);
    expect(s2).not.toBe(s1);
    expect(o1).toBe(splitmix32(1)[0]); // pure
  });
});

describe("rollInt", () => {
  test("bounds hold for assorted n", () => {
    const rng = seedAllStreams(7, 1);
    for (const n of [1, 2, 3, 7, 10, 255, 1000]) {
      for (let i = 0; i < 2000; i++) {
        const r = rollInt(rng, Stream.LOOT, n);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(n);
      }
    }
  });

  test("every residue hit for small n", () => {
    const rng = seedAllStreams(9, 1);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) seen.add(rollInt(rng, Stream.AI, 7));
    expect(seen.size).toBe(7);
  });

  test("deterministic across clones", () => {
    const a = seedAllStreams(11, 3);
    const b = a.slice();
    for (let i = 0; i < 100; i++) {
      expect(rollInt(a, Stream.SPAWN, 13)).toBe(rollInt(b, Stream.SPAWN, 13));
    }
  });
});
