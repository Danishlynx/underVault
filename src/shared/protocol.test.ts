import { describe, expect, test } from "vitest";
import {
  ErrCode,
  b64ToU32,
  floorFromWire,
  floorToWire,
  u32ToB64,
  zActReq,
  zBankReq,
  zEchoWire,
  zEndReq,
  zErrRes,
  zFloorWire,
  zHash8,
  zI16,
  zStartReq,
  zU8,
  zU16,
  zU32,
  type FloorExtras,
} from "./protocol.js";
import { packActions, toB64 } from "./sim/pack.js";
import { Action, EntityKind, type FloorData, type Step } from "./sim/types.js";

// Seeded LCG — deterministic test fixtures, no Math.random.
const lcg = (seed: number) => {
  let x = seed >>> 0;
  return (): number => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x;
  };
};

function makeFloor(withOverlays: boolean): FloorData {
  const w = 24, h = 18;
  const draw = lcg(0xf100f);
  const tiles = new Uint8Array(w * h);
  for (let i = 0; i < tiles.length; i++) tiles[i] = draw() % 30;
  const fd: FloorData = {
    floor: 3, w, h, tiles, px: 5, py: 7,
    entities: [
      { id: 1, kind: EntityKind.RAT, x: 3, y: 4, hp: 2, state: 0, data: 0 },
      { id: 7, kind: EntityKind.MIMIC, x: 10, y: 11, hp: 4, state: 1, data: 9 },
      { id: 42, kind: EntityKind.CORPSE, x: 20, y: 2, hp: -1, state: 0, data: 1 },
    ],
    nextEntityId: 43,
  };
  if (withOverlays) {
    const chalk = new Uint8Array(w * h);
    const signs = new Uint8Array(w * h);
    chalk[17] = 1; chalk[200] = 3;
    signs[55] = 1; signs[301] = 1;
    fd.chalk = chalk;
    fd.signs = signs;
  }
  return fd;
}

function makeRng(): Uint32Array {
  const draw = lcg(0x5eed);
  const words = new Uint32Array(20);
  for (let i = 0; i < 20; i++) words[i] = draw();
  words[0] = 0;
  words[19] = 0xffffffff;
  return words;
}

const extras: FloorExtras = {
  signContents: [
    { tileIndex: 55, template: 2, noun: 17 },
    { tileIndex: 301, template: 0, noun: 4 },
  ],
  echoes: [
    { day: 12, floor: 3, frames: [[5, 7, 0], [6, 7, 0], [6, 8, 2]] },
    { day: 11, floor: 3, frames: [] },
  ],
  corpseIds: ["12-t2_abc", "11-t2_zzz"],
};

describe("u32 codec", () => {
  test("round-trips 20 words incl. 0 and 0xffffffff", () => {
    const words = makeRng();
    const b = u32ToB64(words);
    expect(b64ToU32(b)).toEqual(words);
  });

  test("little-endian byte order", () => {
    expect(u32ToB64(Uint32Array.of(0x04030201))).toBe(toB64(Uint8Array.of(1, 2, 3, 4)));
  });

  test("20 words -> 80 bytes -> 108 b64 chars", () => {
    expect(u32ToB64(makeRng())).toHaveLength(108);
  });

  test("throws unless byteLength % 4 === 0", () => {
    expect(() => b64ToU32(toB64(new Uint8Array(3)))).toThrow(/word-aligned/);
    expect(() => b64ToU32(toB64(new Uint8Array(5)))).toThrow(/word-aligned/);
    expect(b64ToU32(toB64(new Uint8Array(0)))).toEqual(new Uint32Array(0));
  });
});

describe("floorToWire / floorFromWire", () => {
  test("exact round-trip with chalk, signs, extras", () => {
    const fd = makeFloor(true);
    const rng = makeRng();
    const wire = floorToWire(fd, rng, extras);
    const back = floorFromWire(wire);
    expect(back.floorData).toEqual(fd);
    expect(back.rngInit).toEqual(rng);
    expect(back.extras).toEqual(extras);
  });

  test("exact round-trip without optional overlays (keys absent, not undefined)", () => {
    const fd = makeFloor(false);
    const wire = floorToWire(fd, makeRng(), extras);
    expect("chalk" in wire).toBe(false);
    expect("signs" in wire).toBe(false);
    const back = floorFromWire(wire);
    expect(back.floorData).toEqual(fd);
    expect("chalk" in back.floorData).toBe(false);
    expect("signs" in back.floorData).toBe(false);
  });

  test("tiles/chalk/signs are encoded via sim/pack toB64 (byte-identical)", () => {
    const fd = makeFloor(true);
    const wire = floorToWire(fd, makeRng(), extras);
    expect(wire.tiles).toBe(toB64(fd.tiles));
    expect(wire.chalk).toBe(toB64(fd.chalk!));
    expect(wire.signs).toBe(toB64(fd.signs!));
  });

  test("wire validates against zFloorWire and re-encoding is deterministic", () => {
    const fd = makeFloor(true);
    const rng = makeRng();
    const wire = zFloorWire.parse(floorToWire(fd, rng, extras));
    const again = floorToWire(fd, rng, extras);
    expect(JSON.stringify(again)).toBe(JSON.stringify(floorToWire(fd, rng, extras)));
    // full loop: wire -> data -> wire is byte-identical
    const back = floorFromWire(wire);
    expect(JSON.stringify(floorToWire(back.floorData, back.rngInit, back.extras)))
      .toBe(JSON.stringify(again));
  });

  test("codec copies, never aliases, caller buffers", () => {
    const fd = makeFloor(true);
    const wire = floorToWire(fd, makeRng(), extras);
    const back = floorFromWire(wire);
    expect(back.floorData.tiles).not.toBe(fd.tiles);
    expect(back.floorData.entities[0]).not.toBe(fd.entities[0]);
    expect(back.extras.corpseIds).not.toBe(extras.corpseIds);
    expect(back.extras.echoes[0]!.frames).not.toBe(extras.echoes[0]!.frames);
  });
});

describe("schema gates", () => {
  test("primitive bounds", () => {
    expect(zU8.safeParse(255).success).toBe(true);
    expect(zU8.safeParse(256).success).toBe(false);
    expect(zU8.safeParse(-1).success).toBe(false);
    expect(zU8.safeParse(1.5).success).toBe(false);
    expect(zU16.safeParse(65535).success).toBe(true);
    expect(zU16.safeParse(65536).success).toBe(false);
    expect(zU32.safeParse(4294967295).success).toBe(true);
    expect(zU32.safeParse(4294967296).success).toBe(false);
    expect(zI16.safeParse(-32768).success).toBe(true);
    expect(zI16.safeParse(-32769).success).toBe(false);
  });

  test("zHash8: exactly 8 lowercase hex chars", () => {
    expect(zHash8.safeParse("deadbeef").success).toBe(true);
    expect(zHash8.safeParse("DEADBEEF").success).toBe(false);
    expect(zHash8.safeParse("deadbee").success).toBe(false);
    expect(zHash8.safeParse("deadbeef0").success).toBe(false);
  });

  test("zActReq accepts a real packed logV-2 frame; rejects logV 1 (C1)", () => {
    const steps: Step[] = [
      { op: Action.MOVE_E, arg: 0 },
      { op: Action.USE, arg: 0b01001 },
      { op: Action.SIGN, arg: 0b010_10001 },
    ];
    const req = {
      token: "a".repeat(32),
      logV: 2,
      fromTick: 0,
      actions: toB64(packActions(steps)),
    };
    expect(zActReq.safeParse(req).success).toBe(true);
    expect(zActReq.safeParse({ ...req, checkHash: "0123abcd" }).success).toBe(true);
    expect(zActReq.safeParse({ ...req, logV: 1 }).success).toBe(false);
    expect(zActReq.safeParse({ ...req, actions: "not-b64!*" }).success).toBe(false);
    expect(zActReq.safeParse({ ...req, token: "short" }).success).toBe(false);
  });

  test("zStartReq is strict — extra keys rejected", () => {
    expect(zStartReq.safeParse({}).success).toBe(true);
    expect(zStartReq.safeParse({ seed: 1 }).success).toBe(false);
  });

  test("zErrRes enum tracks ErrCode exactly", () => {
    for (const code of Object.keys(ErrCode)) {
      expect(zErrRes.safeParse({ error: code, message: "the dark refuses" }).success).toBe(true);
    }
    expect(zErrRes.safeParse({ error: "NOT_A_CODE", message: "" }).success).toBe(false);
    expect(zErrRes.safeParse({ error: "DESYNC", message: "x".repeat(201) }).success).toBe(false);
  });

  test("zBankReq caps claims at 3 (BANK_MAX)", () => {
    const claim = { key: "rat|touch|self|", effect: 1 };
    const base = { token: "a".repeat(32), confirms: [] };
    expect(zBankReq.safeParse({ ...base, claims: [claim, claim, claim] }).success).toBe(true);
    expect(zBankReq.safeParse({ ...base, claims: [claim, claim, claim, claim] }).success)
      .toBe(false);
    expect(zBankReq.safeParse({ ...base, claims: [{ key: "short", effect: 1 }] }).success)
      .toBe(false); // key min 7
  });

  test("zEchoWire caps frames at 64", () => {
    const mk = (n: number) => ({
      day: 1, floor: 1,
      frames: Array.from({ length: n }, () => [0, 0, 0] as [number, number, number]),
    });
    expect(zEchoWire.safeParse(mk(64)).success).toBe(true);
    expect(zEchoWire.safeParse(mk(65)).success).toBe(false);
  });

  test("zEndReq caps lastWords at 80", () => {
    const base = { token: "a".repeat(32), echoFrames: [] };
    expect(zEndReq.safeParse({ ...base, lastWords: "w".repeat(80) }).success).toBe(true);
    expect(zEndReq.safeParse({ ...base, lastWords: "w".repeat(81) }).success).toBe(false);
  });
});
