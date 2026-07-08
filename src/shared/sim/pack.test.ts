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
import { Action, EntityKind, type Step } from "./types.js";

const ascii = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

describe("xxhash32", () => {
  test("published known-answer vectors", () => {
    expect(xxhash32(ascii(""), 0)).toBe(0x02cc5d05);
    expect(xxhash32(ascii("abc"), 0)).toBe(0x32d153ff);
    expect(xxhash32(ascii("Nobody inspects the spammish repetition"), 0)).toBe(0xe2293b2f);
  });
});

describe("action codec (logV 2, argumented)", () => {
  test("roundtrip fuzz incl. USE/SIGN/BANK args (seeded)", () => {
    let x = 0xc0ffee;
    const draw = (): number => {
      const [v, nx] = splitmix32(x);
      x = nx;
      return v;
    };
    for (const len of [0, 1, 7, 8, 499, 500]) {
      const steps: Step[] = [];
      for (let i = 0; i < len; i++) {
        const roll = draw() % 10;
        if (roll < 7) steps.push({ op: draw() % 18, arg: 0 });
        else if (roll === 7) steps.push({ op: Action.USE, arg: draw() % 32 });
        else if (roll === 8) steps.push({ op: Action.SIGN, arg: draw() % 256 });
        else steps.push({ op: Action.BANK, arg: draw() % 4 });
      }
      const packed = packActions(steps);
      expect(unpackActions(packed)).toEqual(steps);
      const b64 = toB64(packed);
      expect(Array.from(fromB64(b64))).toEqual(Array.from(packed));
    }
  });

  test("500 argless actions still fit the ≤400 byte budget (02 §3)", () => {
    const steps: Step[] = new Array(500).fill(null).map(() => ({ op: Action.MOVE_E, arg: 0 }));
    expect(packActions(steps).length).toBeLessThanOrEqual(400);
  });

  test("bad version / truncation / unknown opcode throw deterministically", () => {
    const good = packActions([{ op: 1, arg: 0 }, { op: 2, arg: 0 }, { op: 3, arg: 0 }]);
    const badV = good.slice();
    badV[0] = 9;
    expect(() => unpackActions(badV)).toThrow(/logV/);
    expect(() => unpackActions(good.slice(0, 2))).toThrow(/truncated/);
    const badOp = packActions([{ op: 17, arg: 0 }]);
    badOp[3] = 0xff;
    expect(() => unpackActions(badOp)).toThrow(/opcode/);
  });
});

describe("canonical serialization + hash (STATE_V 2)", () => {
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
      (s) => void (s.heirloom = 1),
      (s) => void (s.noiseLevel = 2),
      (s) => void (s.alertTicks = 7),
      (s) => void (s.ritualTile = 12),
      (s) => void (s.ritualCount = 2),
      (s) => void (s.signsLeft = 1),
      (s) => void (s.banked = 3),
      (s) => void (s.mods.graceTicks = 12),
      (s) => void (s.mods.burnBasic = 2),
      (s) => void (s.mods.radiusPenalty = 1),
      (s) => void (s.mods.quietFeet = 1),
      (s) => void (s.mods.beastEar = 2),
      (s) => void (s.mods.echoRadius = 3),
      (s) => void (s.nextEntityId += 1),
      (s) => void (s.entities[0]!.hp -= 1),
      (s) => void (s.entities[1]!.x += 1),
      (s) => void (s.salt[12] = 1),
      (s) => void (s.chalk[12] = 1),
      (s) => void (s.fire[12] = 3),
      (s) => void (s.gas[12] = 5),
      (s) => void (s.signs[12] = 1),
      (s) => void (s.seen[0] = s.seen[0]! === 1 ? 0 : 1),
      (s) => void (s.rng[0] = (s.rng[0]! + 1) >>> 0),
    ];
    for (const probe of probes) {
      const s = makeState(fd);
      probe(s);
      expect(hashState(s), `probe ${probes.indexOf(probe)}`).not.toBe(h0);
    }

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
