import { describe, expect, test } from "vitest";
import {
  fromB64,
  hashState,
  packActions,
  serializeState,
  toB64,
  unpackActions,
  xxhash32,
} from "./pack.js";
import { splitmix32 } from "./rng.js";
import { floorFromAscii, makeState, ent } from "../../../tests/helpers.js";
import { EntityKind } from "./types.js";

const ascii = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

describe("xxhash32", () => {
  test("published known-answer vectors", () => {
    expect(xxhash32(ascii(""), 0)).toBe(0x02cc5d05);
    expect(xxhash32(ascii("abc"), 0)).toBe(0x32d153ff);
    // >16 bytes exercises the 4-accumulator stripe path (python-xxhash doctest)
    expect(xxhash32(ascii("Nobody inspects the spammish repetition"), 0)).toBe(0xe2293b2f);
  });
});

describe("action codec", () => {
  test("roundtrip fuzz (seeded)", () => {
    let x = 0xc0ffee;
    const draw = (): number => {
      const [v, nx] = splitmix32(x);
      x = nx;
      return v;
    };
    for (const len of [0, 1, 7, 8, 499, 500]) {
      const actions: number[] = [];
      for (let i = 0; i < len; i++) actions.push(draw() % 18);
      const packed = packActions(actions);
      expect(unpackActions(packed)).toEqual(actions);
      const b64 = toB64(packed);
      expect(Array.from(fromB64(b64))).toEqual(Array.from(packed));
    }
  });

  test("500 actions fit the ≤400 byte budget (02 §3)", () => {
    const actions = new Array<number>(500).fill(1);
    expect(packActions(actions).length).toBeLessThanOrEqual(400);
  });

  test("bad version / truncation / unknown opcode throw deterministically", () => {
    const good = packActions([1, 2, 3]);
    const badV = good.slice();
    badV[0] = 9;
    expect(() => unpackActions(badV)).toThrow(/logV/);
    expect(() => unpackActions(good.slice(0, 2))).toThrow(/truncated/);
    const badOp = packActions([63].map(() => 17));
    badOp[3] = 0xff; // forge opcode 63
    expect(() => unpackActions(badOp)).toThrow(/opcode/);
  });
});

describe("canonical serialization + hash", () => {
  const fd = floorFromAscii(
    ["#########", "#@..d...#", "#.w.#.m.#", "#...+..>#", "#########"],
    [ent(1, EntityKind.RAT, 5, 1), ent(2, EntityKind.MOTH, 7, 1)],
  );

  test("field probe: every validated field moves the hash; fx does not", () => {
    const base = makeState(fd);
    const h0 = hashState(base);

    const probes: ((s: ReturnType<typeof makeState>) => void)[] = [
      (s) => void (s.floor += 1),
      (s) => void (s.tick += 1),
      (s) => void (s.tiles[10] = s.tiles[10]! === 2 ? 1 : 2),
      (s) => void (s.px += 1),
      (s) => void (s.wax -= 1),
      (s) => void (s.candle = 1),
      (s) => void (s.candleTimer = 2),
      (s) => void (s.graceLeft = 5),
      (s) => void (s.status = 1),
      (s) => void (s.deathCause = 1),
      (s) => void (s.inv[3] = 2),
      (s) => void (s.invCharges[1] = 9),
      (s) => void (s.noiseLevel = 2),
      (s) => void (s.nextEntityId += 1),
      (s) => void (s.entities[0]!.hp -= 1),
      (s) => void (s.entities[1]!.x += 1),
      (s) => void (s.salt[12] = 1),
      (s) => void (s.chalk[12] = 1),
      (s) => void (s.fire[12] = 3),
      (s) => void (s.seen[0] = s.seen[0]! === 1 ? 0 : 1),
      (s) => void (s.rng[0] = (s.rng[0]! + 1) >>> 0), // gen stream IS hashed
    ];
    for (const probe of probes) {
      const s = makeState(fd);
      probe(s);
      expect(hashState(s), `probe ${probes.indexOf(probe)}`).not.toBe(h0);
    }

    // fx words 16..19 are quarantined — scrambling them must NOT move the hash
    const s = makeState(fd);
    s.rng[16] = 0xdeadbeef;
    s.rng[17] = 0x12345678;
    s.rng[18] = 0;
    s.rng[19] = 0xffffffff;
    expect(hashState(s)).toBe(h0);
  });

  test("serialization is byte-stable across calls", () => {
    const s = makeState(fd);
    expect(Array.from(serializeState(s))).toEqual(Array.from(serializeState(s)));
  });
});
