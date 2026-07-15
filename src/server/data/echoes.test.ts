// EchoRepo — cosmetic echoes: 50/floor cap via zRemRangeByRank, TTLs, top-N (08 §1.10/§3).

import { describe, expect, it } from "vitest";
import { CORPSE_TTL_S, DAY_TTL_S, ECHO_FLOOR_CAP } from "../core/constants.js";
import { createMockRedis } from "./redis-mock.js";
import { EchoRepo } from "./echoes.js";

const DAY = 7;
const FLOOR = 2;
const IDX = `uv:echoes:${DAY}:${FLOOR}`;

function ttlOf(dump: Map<string, unknown>, key: string): number | undefined {
  return (dump.get(key) as { ttlS?: number } | undefined)?.ttlS;
}

describe("EchoRepo put", () => {
  it("stores frames with a 72 h TTL and indexes by interest with a 48 h TTL", async () => {
    const r = createMockRedis();
    await new EchoRepo(r).put(DAY, FLOOR, "e1", "QUJD", 12);
    expect(await r.get("uv:echo:e1")).toBe("QUJD");
    expect(ttlOf(r.dump(), "uv:echo:e1")).toBe(CORPSE_TTL_S); // 72 h
    expect(await r.zScore(IDX, "e1")).toBe(12);
    expect(ttlOf(r.dump(), IDX)).toBe(DAY_TTL_S); // 48 h
  });

  it("re-put of the same echo id updates in place (idempotent)", async () => {
    const r = createMockRedis();
    const repo = new EchoRepo(r);
    await repo.put(DAY, FLOOR, "e1", "AAAA", 5);
    await repo.put(DAY, FLOOR, "e1", "BBBB", 9);
    expect(await r.zCard(IDX)).toBe(1);
    expect(await r.get("uv:echo:e1")).toBe("BBBB");
    expect(await r.zScore(IDX, "e1")).toBe(9);
  });

  it(`caps the index at ECHO_FLOOR_CAP=${ECHO_FLOOR_CAP}, dropping lowest interest`, async () => {
    const r = createMockRedis();
    const repo = new EchoRepo(r);
    for (let i = 1; i <= ECHO_FLOOR_CAP + 5; i++) {
      await repo.put(DAY, FLOOR, `e${i}`, `f${i}`, i);
    }
    expect(await r.zCard(IDX)).toBe(ECHO_FLOOR_CAP);
    // the 5 lowest-interest members are out of the index
    for (let i = 1; i <= 5; i++) expect(await r.zScore(IDX, `e${i}`)).toBeUndefined();
    expect(await r.zScore(IDX, "e6")).toBe(6);
    expect(await r.zScore(IDX, `e${ECHO_FLOOR_CAP + 5}`)).toBe(ECHO_FLOOR_CAP + 5);
  });

  it("day/floor indexes are isolated", async () => {
    const r = createMockRedis();
    const repo = new EchoRepo(r);
    await repo.put(DAY, FLOOR, "e1", "AAAA", 1);
    expect(await r.zCard(`uv:echoes:${DAY}:${FLOOR + 1}`)).toBe(0);
    expect(await r.zCard(`uv:echoes:${DAY + 1}:${FLOOR}`)).toBe(0);
  });
});

describe("EchoRepo topForFloor", () => {
  it("returns highest-interest first, capped at limit", async () => {
    const r = createMockRedis();
    const repo = new EchoRepo(r);
    for (let i = 1; i <= 10; i++) await repo.put(DAY, FLOOR, `e${i}`, `f${i}`, i);
    const top = await repo.topForFloor(DAY, FLOOR, 3);
    expect(top).toEqual([
      { day: DAY, floor: FLOOR, framesB64: "f10" },
      { day: DAY, floor: FLOOR, framesB64: "f9" },
      { day: DAY, floor: FLOOR, framesB64: "f8" },
    ]);
  });

  it("silently drops indexed ids whose frame string already expired", async () => {
    const r = createMockRedis();
    const repo = new EchoRepo(r);
    await repo.put(DAY, FLOOR, "e1", "f1", 1);
    await repo.put(DAY, FLOOR, "e2", "f2", 2);
    await r.del("uv:echo:e2"); // simulate the 72 h string TTL firing before the index
    expect(await repo.topForFloor(DAY, FLOOR, 8)).toEqual([
      { day: DAY, floor: FLOOR, framesB64: "f1" },
    ]);
  });

  it("empty floor or non-positive limit → []", async () => {
    const r = createMockRedis();
    const repo = new EchoRepo(r);
    expect(await repo.topForFloor(DAY, FLOOR, 8)).toEqual([]);
    await repo.put(DAY, FLOOR, "e1", "f1", 1);
    expect(await repo.topForFloor(DAY, FLOOR, 0)).toEqual([]);
  });
});
