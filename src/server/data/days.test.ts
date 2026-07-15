import { describe, expect, it } from "vitest";
import { DAY_TTL_S } from "../core/constants.js";
import { createMockRedis } from "./redis-mock.js";
import { DayRepo, type DayMeta, type SharedEntry, type SignEntry } from "./days.js";

const META: DayMeta = {
  day: 3,
  seedHi: 0xdeadbeef,
  seedLo: 0x0badf00d,
  omenSeed: 12345,
  postId: "t3_abc",
  createdTs: 1_700_000_000_000,
};

function ttlOf(dump: Map<string, unknown>, key: string): number | undefined {
  return (dump.get(key) as { ttlS?: number } | undefined)?.ttlS;
}

describe("DayRepo meta / one-winner mint", () => {
  it("putMeta wins once and round-trips via getMeta", async () => {
    const r = createMockRedis();
    const repo = new DayRepo(r);
    expect(await repo.putMeta(META)).toBe(true);
    expect(await repo.getMeta(3)).toEqual(META);
  });

  it("second putMeta for the same day loses and does not clobber", async () => {
    const r = createMockRedis();
    const repo = new DayRepo(r);
    await repo.putMeta(META);
    const rival = { ...META, seedHi: 1, seedLo: 2, postId: "t3_rival" };
    expect(await repo.putMeta(rival)).toBe(false);
    expect(await repo.getMeta(3)).toEqual(META); // first writer's row intact
  });

  it("putMeta sets the 48 h TTL on day meta", async () => {
    const r = createMockRedis();
    await new DayRepo(r).putMeta(META);
    expect(ttlOf(r.dump(), "uv:day:3:meta")).toBe(DAY_TTL_S);
  });

  it("putMeta advances uv:day:current, but never backwards", async () => {
    const r = createMockRedis();
    const repo = new DayRepo(r);
    expect(await repo.currentDay()).toBeNull();
    await repo.putMeta({ ...META, day: 5 });
    expect(await repo.currentDay()).toBe(5);
    await repo.putMeta({ ...META, day: 4 });
    expect(await repo.currentDay()).toBe(5); // no rollback
    await repo.putMeta({ ...META, day: 6 });
    expect(await repo.currentDay()).toBe(6);
  });

  it("getMeta of an unminted day is null", async () => {
    const r = createMockRedis();
    expect(await new DayRepo(r).getMeta(99)).toBeNull();
  });

  it("bumpFallen increments the meta counter", async () => {
    const r = createMockRedis();
    const repo = new DayRepo(r);
    await repo.putMeta(META);
    expect(await repo.bumpFallen(3)).toBe(1);
    expect(await repo.bumpFallen(3)).toBe(2);
  });
});

describe("DayRepo shared entries (braziers/glowmoss)", () => {
  const e = (tileIndex: number, kind: 1 | 2, uid: string, ts: number): SharedEntry => ({
    tileIndex,
    kind,
    uid,
    ts,
  });

  it("addShared/getShared round-trips, sorted ascending by tileIndex", async () => {
    const r = createMockRedis();
    const repo = new DayRepo(r);
    await repo.addShared(3, 1, e(42, 1, "t2_a", 111));
    await repo.addShared(3, 1, e(7, 2, "t2_b", 222));
    expect(await repo.getShared(3, 1)).toEqual([e(7, 2, "t2_b", 222), e(42, 1, "t2_a", 111)]);
  });

  it("first writer wins per tile (hSetNX)", async () => {
    const r = createMockRedis();
    const repo = new DayRepo(r);
    await repo.addShared(3, 1, e(42, 1, "t2_first", 100));
    await repo.addShared(3, 1, e(42, 2, "t2_second", 200));
    expect(await repo.getShared(3, 1)).toEqual([e(42, 1, "t2_first", 100)]);
  });

  it("shared hash carries the 48 h TTL", async () => {
    const r = createMockRedis();
    await new DayRepo(r).addShared(3, 2, e(1, 1, "t2_a", 5));
    expect(ttlOf(r.dump(), "uv:day:3:shared:2")).toBe(DAY_TTL_S);
  });

  it("floors and days are isolated keys", async () => {
    const r = createMockRedis();
    const repo = new DayRepo(r);
    await repo.addShared(3, 1, e(1, 1, "t2_a", 5));
    expect(await repo.getShared(3, 2)).toEqual([]);
    expect(await repo.getShared(4, 1)).toEqual([]);
  });
});

describe("DayRepo signs", () => {
  const s = (tileIndex: number, uid: string): SignEntry => ({
    signId: "ignored-on-write",
    tileIndex,
    template: 2,
    noun: 9,
    uid,
    ts: 777,
    votes: 0,
  });

  it("addSign/getSigns round-trips with a synthesized deterministic signId", async () => {
    const r = createMockRedis();
    const repo = new DayRepo(r);
    await repo.addSign(3, 1, s(15, "t2_a"));
    expect(await repo.getSigns(3, 1)).toEqual([
      { signId: "3-1-15", tileIndex: 15, template: 2, noun: 9, uid: "t2_a", ts: 777, votes: 0 },
    ]);
  });

  it("first writer wins per tile and results sort by tileIndex", async () => {
    const r = createMockRedis();
    const repo = new DayRepo(r);
    await repo.addSign(3, 1, s(20, "t2_first"));
    await repo.addSign(3, 1, s(20, "t2_second"));
    await repo.addSign(3, 1, s(4, "t2_c"));
    const signs = await repo.getSigns(3, 1);
    expect(signs.map((x) => x.tileIndex)).toEqual([4, 20]);
    expect(signs[1]?.uid).toBe("t2_first");
  });

  it("signs hash carries the 48 h TTL", async () => {
    const r = createMockRedis();
    await new DayRepo(r).addSign(3, 1, s(1, "t2_a"));
    expect(ttlOf(r.dump(), "uv:day:3:signs:1")).toBe(DAY_TTL_S);
  });
});
