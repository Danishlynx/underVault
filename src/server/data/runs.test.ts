// RunRepo — the one-candle-per-day state machine (invariant 10, 08 §1.10/§2).

import { describe, expect, it } from "vitest";
import { RUN_EXPIRY_MS, RUN_TTL_S } from "../core/constants.js";
import type { RedisLike } from "./redis.js";
import { createMockRedis } from "./redis-mock.js";
import { RunRepo, type RunRow } from "./runs.js";

const UID = "t2_hero";
const DAY = 7;
const NOW = 1_800_000_000_000;

function freshRow(over: Partial<RunRow> = {}): RunRow {
  return {
    token: "tok_0123456789abcdef",
    phase: "active",
    day: DAY,
    startTs: NOW,
    lastActTs: NOW,
    ticks: 0,
    lastHash: "",
    log: "",
    floor: 1,
    floorEnteredTs: [0, NOW],
    learned: [],
    bankedKeys: [],
    wax: 100,
    posX: 3,
    posY: 4,
    epitaph: "",
    ...over,
  };
}

describe("RunRepo claimStart — one candle per user per day", () => {
  it("absent row → 'new' and the row is persisted with a 26 h TTL", async () => {
    const r = createMockRedis();
    const repo = new RunRepo(r);
    expect(await repo.claimStart(UID, DAY, freshRow())).toBe("new");
    expect(await repo.load(UID, DAY)).toEqual(freshRow());
    const entry = r.dump().get(`uv:run:${UID}:${DAY}`) as { ttlS?: number };
    expect(entry.ttlS).toBe(RUN_TTL_S);
  });

  it("active, unexpired row → 'resume' and the stored row is untouched", async () => {
    const r = createMockRedis();
    const repo = new RunRepo(r);
    await repo.claimStart(UID, DAY, freshRow());
    const retry = freshRow({ token: "tok_DIFFERENT_00000", startTs: NOW + 60_000 });
    expect(await repo.claimStart(UID, DAY, retry)).toBe("resume");
    expect((await repo.load(UID, DAY))?.token).toBe("tok_0123456789abcdef"); // caller re-issues stored token
  });

  it("active but expired (45 min) row → 'spent'", async () => {
    const r = createMockRedis();
    const repo = new RunRepo(r);
    await repo.claimStart(UID, DAY, freshRow());
    const late = freshRow({ startTs: NOW + RUN_EXPIRY_MS + 1 });
    expect(await repo.claimStart(UID, DAY, late)).toBe("spent");
  });

  it("boundary: exactly RUN_EXPIRY_MS old still resumes", async () => {
    const r = createMockRedis();
    const repo = new RunRepo(r);
    await repo.claimStart(UID, DAY, freshRow());
    const edge = freshRow({ startTs: NOW + RUN_EXPIRY_MS });
    expect(await repo.claimStart(UID, DAY, edge)).toBe("resume");
  });

  it("banked/done phases → 'spent' (CANDLE_SPENT)", async () => {
    for (const phase of ["banked", "done"] as const) {
      const r = createMockRedis();
      const repo = new RunRepo(r);
      await repo.claimStart(UID, DAY, freshRow());
      const row = (await repo.load(UID, DAY))!;
      row.phase = phase;
      await repo.save(UID, DAY, row);
      expect(await repo.claimStart(UID, DAY, freshRow({ startTs: NOW + 1000 }))).toBe("spent");
    }
  });

  it("days are independent candles", async () => {
    const r = createMockRedis();
    const repo = new RunRepo(r);
    await repo.claimStart(UID, DAY, freshRow());
    expect(await repo.claimStart(UID, DAY + 1, freshRow({ day: DAY + 1 }))).toBe("new");
  });

  it("lost watch/multi race → falls through to 'resume' on the winner's row", async () => {
    const mock = createMockRedis();
    const runKey = `uv:run:${UID}:${DAY}`;
    const winner = freshRow({ token: "tok_WINNER_000000000" });
    let fired = false;
    // Interleave: our claimStart watches, reads {} — then the rival's row lands
    // before exec. exec() must return null and claimStart must re-read → resume.
    const raced: RedisLike = {
      ...mock,
      hGetAll: async (key: string) => {
        const snapshot = await mock.hGetAll(key);
        if (!fired && key === runKey) {
          fired = true;
          await new RunRepo(mock).save(UID, DAY, winner);
        }
        return snapshot;
      },
    };
    const verdict = await new RunRepo(raced).claimStart(UID, DAY, freshRow());
    expect(verdict).toBe("resume");
    expect((await new RunRepo(mock).load(UID, DAY))?.token).toBe("tok_WINNER_000000000");
  });
});

describe("RunRepo load/save", () => {
  it("load of an absent run is null", async () => {
    const r = createMockRedis();
    expect(await new RunRepo(r).load(UID, DAY)).toBeNull();
  });

  it("save round-trips every field including JSON arrays", async () => {
    const r = createMockRedis();
    const repo = new RunRepo(r);
    const row = freshRow({
      phase: "banked",
      ticks: 123,
      lastHash: "a1b2c3d4",
      log: "AAECAw==",
      floor: 3,
      floorEnteredTs: [0, NOW, NOW + 9000, NOW + 22_000],
      learned: [
        { key: "waxling|touch|self", effect: 4 },
        { key: "cinder|throw|door", effect: 7 },
      ],
      bankedKeys: ["waxling|touch|self"],
      wax: 41,
      posX: 17,
      posY: 22,
      epitaph: '{"day":7}',
    });
    await repo.save(UID, DAY, row);
    expect(await repo.load(UID, DAY)).toEqual(row);
  });

  it("save is idempotent (full-row hSet)", async () => {
    const r = createMockRedis();
    const repo = new RunRepo(r);
    const row = freshRow();
    await repo.save(UID, DAY, row);
    await repo.save(UID, DAY, row);
    expect(await repo.load(UID, DAY)).toEqual(row);
  });

  it("appendLogAndSave bumps ticks by addedSteps and persists in one write", async () => {
    const r = createMockRedis();
    const repo = new RunRepo(r);
    const row = freshRow({ ticks: 10 });
    await repo.claimStart(UID, DAY, row);
    row.log = "BBBB";
    await repo.appendLogAndSave(UID, DAY, row, 32);
    expect(row.ticks).toBe(42);
    const loaded = await repo.load(UID, DAY);
    expect(loaded?.ticks).toBe(42);
    expect(loaded?.log).toBe("BBBB");
  });
});
