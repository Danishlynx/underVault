// Mock semantics must match Devvit (08 §4): hGetAll missing → {}, zRange by
// score inclusive, exec() → null when a watched key changed, WRONGTYPE throws.

import { describe, expect, it } from "vitest";
import { createMockRedis } from "./redis-mock.js";

describe("redis-mock strings", () => {
  it("get returns undefined for a missing key", async () => {
    const r = createMockRedis();
    expect(await r.get("nope")).toBeUndefined();
  });

  it("set/get round-trips and overwrites", async () => {
    const r = createMockRedis();
    await r.set("k", "a");
    await r.set("k", "b");
    expect(await r.get("k")).toBe("b");
  });

  it("set overwrites a key of another type (real Redis SET semantics)", async () => {
    const r = createMockRedis();
    await r.hSet("k", { f: "1" });
    await r.set("k", "s");
    expect(await r.get("k")).toBe("s");
  });

  it("incrBy counts from 0 and returns the new value", async () => {
    const r = createMockRedis();
    expect(await r.incrBy("n", 5)).toBe(5);
    expect(await r.incrBy("n", -2)).toBe(3);
  });

  it("incrBy throws on a non-integer value", async () => {
    const r = createMockRedis();
    await r.set("n", "abc");
    await expect(r.incrBy("n", 1)).rejects.toThrow(/non-integer/);
  });

  it("mGet returns null for missing and non-string keys", async () => {
    const r = createMockRedis();
    await r.set("a", "1");
    await r.hSet("h", { f: "x" });
    expect(await r.mGet(["a", "missing", "h"])).toEqual(["1", null, null]);
  });

  it("exists counts and double-counts duplicates like Devvit", async () => {
    const r = createMockRedis();
    await r.set("a", "1");
    expect(await r.exists("a", "a", "b")).toBe(2);
  });

  it("del removes keys and their ttls", async () => {
    const r = createMockRedis();
    await r.set("a", "1");
    await r.expire("a", 60);
    await r.del("a", "ghost");
    expect(await r.get("a")).toBeUndefined();
    expect(r.dump().has("a")).toBe(false);
  });

  it("get on a hash key throws WRONGTYPE", async () => {
    const r = createMockRedis();
    await r.hSet("h", { f: "1" });
    await expect(r.get("h")).rejects.toThrow(/WRONGTYPE/);
  });
});

describe("redis-mock hashes", () => {
  it("hGetAll of a missing key returns {}", async () => {
    const r = createMockRedis();
    expect(await r.hGetAll("missing")).toEqual({});
  });

  it("hSet returns the number of NEW fields", async () => {
    const r = createMockRedis();
    expect(await r.hSet("h", { a: "1", b: "2" })).toBe(2);
    expect(await r.hSet("h", { b: "3", c: "4" })).toBe(1);
    expect(await r.hGetAll("h")).toEqual({ a: "1", b: "3", c: "4" });
  });

  it("hSetNX sets only when absent", async () => {
    const r = createMockRedis();
    expect(await r.hSetNX("h", "f", "first")).toBe(true);
    expect(await r.hSetNX("h", "f", "second")).toBe(false);
    expect(await r.hGet("h", "f")).toBe("first");
  });

  it("hMGet aligns with the requested field order, null for gaps", async () => {
    const r = createMockRedis();
    await r.hSet("h", { a: "1", c: "3" });
    expect(await r.hMGet("h", ["a", "b", "c"])).toEqual(["1", null, "3"]);
    expect(await r.hMGet("missing", ["x"])).toEqual([null]);
  });

  it("hDel returns removed count and drops the empty hash", async () => {
    const r = createMockRedis();
    await r.hSet("h", { a: "1", b: "2" });
    expect(await r.hDel("h", ["a", "ghost"])).toBe(1);
    expect(await r.hDel("h", ["b"])).toBe(1);
    expect(await r.exists("h")).toBe(0);
  });

  it("hIncrBy counts from 0 on absent fields", async () => {
    const r = createMockRedis();
    expect(await r.hIncrBy("h", "n", 3)).toBe(3);
    expect(await r.hIncrBy("h", "n", 4)).toBe(7);
  });

  it("hSet on a string key throws WRONGTYPE", async () => {
    const r = createMockRedis();
    await r.set("s", "x");
    await expect(r.hSet("s", { f: "1" })).rejects.toThrow(/WRONGTYPE/);
  });
});

describe("redis-mock zsets", () => {
  it("zAdd returns count of NEW members; score updates don't count", async () => {
    const r = createMockRedis();
    expect(await r.zAdd("z", { member: "a", score: 1 }, { member: "b", score: 2 })).toBe(2);
    expect(await r.zAdd("z", { member: "a", score: 9 })).toBe(0);
    expect(await r.zScore("z", "a")).toBe(9);
  });

  it("zRange by rank sorts score-asc, member-lex tiebreak", async () => {
    const r = createMockRedis();
    await r.zAdd("z", { member: "b", score: 2 }, { member: "a", score: 2 }, { member: "c", score: 1 });
    expect((await r.zRange("z", 0, -1)).map((m) => m.member)).toEqual(["c", "a", "b"]);
  });

  it("zRange by rank supports negative indices and reverse", async () => {
    const r = createMockRedis();
    await r.zAdd("z", { member: "a", score: 1 }, { member: "b", score: 2 }, { member: "c", score: 3 });
    expect((await r.zRange("z", -2, -1)).map((m) => m.member)).toEqual(["b", "c"]);
    expect((await r.zRange("z", 0, -1, { reverse: true })).map((m) => m.member)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("zRange by score is INCLUSIVE on both bounds", async () => {
    const r = createMockRedis();
    await r.zAdd("z", { member: "a", score: 10 }, { member: "b", score: 20 }, { member: "c", score: 30 });
    expect((await r.zRange("z", 10, 20, { by: "score" })).map((m) => m.member)).toEqual(["a", "b"]);
    expect((await r.zRange("z", 30, 30, { by: "score" })).map((m) => m.member)).toEqual(["c"]);
  });

  it("zRange reverse ranks from the HIGHEST score (Redis REV semantics)", async () => {
    const r = createMockRedis();
    await r.zAdd("z", { member: "a", score: 1 }, { member: "b", score: 2 }, { member: "c", score: 3 });
    // partial range — the top-N shape EchoRepo.topForFloor relies on
    expect((await r.zRange("z", 0, 1, { reverse: true })).map((m) => m.member)).toEqual(["c", "b"]);
    expect((await r.zRange("z", -1, -1, { reverse: true })).map((m) => m.member)).toEqual(["a"]);
  });

  it("zRange applies limit after ordering", async () => {
    const r = createMockRedis();
    await r.zAdd("z", { member: "a", score: 1 }, { member: "b", score: 2 }, { member: "c", score: 3 });
    const rows = await r.zRange("z", 0, -1, { reverse: true, limit: { offset: 1, count: 1 } });
    expect(rows.map((m) => m.member)).toEqual(["b"]);
  });

  it("zRem removes and drops the empty zset key", async () => {
    const r = createMockRedis();
    await r.zAdd("z", { member: "a", score: 1 });
    expect(await r.zRem("z", ["a", "ghost"])).toBe(1);
    expect(await r.exists("z")).toBe(0);
    expect(await r.zCard("z")).toBe(0);
  });

  it("zRemRangeByRank handles the negative cap window (0, -(cap+1))", async () => {
    const r = createMockRedis();
    for (let i = 1; i <= 5; i++) await r.zAdd("z", { member: `m${i}`, score: i });
    // keep top 3 by score
    expect(await r.zRemRangeByRank("z", 0, -4)).toBe(2);
    expect((await r.zRange("z", 0, -1)).map((m) => m.member)).toEqual(["m3", "m4", "m5"]);
    // already at cap → no-op
    expect(await r.zRemRangeByRank("z", 0, -4)).toBe(0);
  });

  it("zRemRangeByScore is inclusive", async () => {
    const r = createMockRedis();
    await r.zAdd("z", { member: "a", score: 1 }, { member: "b", score: 2 }, { member: "c", score: 3 });
    expect(await r.zRemRangeByScore("z", 1, 2)).toBe(2);
    expect((await r.zRange("z", 0, -1)).map((m) => m.member)).toEqual(["c"]);
  });

  it("zIncrBy creates from 0 and returns the new score", async () => {
    const r = createMockRedis();
    expect(await r.zIncrBy("z", "a", 3)).toBe(3);
    expect(await r.zIncrBy("z", "a", -1)).toBe(2);
  });

  it("zAdd on a string key throws WRONGTYPE", async () => {
    const r = createMockRedis();
    await r.set("s", "x");
    await expect(r.zAdd("s", { member: "a", score: 1 })).rejects.toThrow(/WRONGTYPE/);
  });
});

describe("redis-mock watch/multi/exec", () => {
  it("exec applies queued writes atomically and returns a result array", async () => {
    const r = createMockRedis();
    const txn = await r.watch("k");
    await txn.multi();
    await txn.set("k", "v");
    await txn.hSet("h", { f: "1" });
    await txn.zAdd("z", { member: "a", score: 1 });
    await txn.expire("k", 60);
    const res = await txn.exec();
    expect(res).not.toBeNull();
    expect(res).toHaveLength(4);
    expect(await r.get("k")).toBe("v");
    expect(await r.hGet("h", "f")).toBe("1");
    expect(await r.zScore("z", "a")).toBe(1);
  });

  it("exec returns null when a watched key was written between watch and exec", async () => {
    const r = createMockRedis();
    const txn = await r.watch("k");
    await r.set("k", "intruder");
    await txn.multi();
    await txn.set("k", "mine");
    expect(await txn.exec()).toBeNull();
    expect(await r.get("k")).toBe("intruder"); // queued writes discarded
  });

  it("watch detects hash-field writes and expire touches", async () => {
    const r = createMockRedis();
    await r.hSet("h", { f: "1" });
    const t1 = await r.watch("h");
    await r.hSetNX("h", "g", "2");
    await t1.multi();
    await t1.hSet("h", { f: "9" });
    expect(await t1.exec()).toBeNull();

    const t2 = await r.watch("h");
    await r.expire("h", 30);
    await t2.multi();
    await t2.hSet("h", { f: "9" });
    expect(await t2.exec()).toBeNull();
  });

  it("unwatch lifts the guard — exec applies despite a concurrent write", async () => {
    const r = createMockRedis();
    const txn = await r.watch("k");
    await r.set("k", "other");
    await txn.unwatch();
    await txn.multi();
    await txn.set("k", "mine");
    expect(await txn.exec()).not.toBeNull();
    expect(await r.get("k")).toBe("mine");
  });

  it("pre-multi txn.get reads current state; post-multi get throws", async () => {
    const r = createMockRedis();
    await r.set("k", "v");
    const txn = await r.watch("k");
    expect(await txn.get("k")).toBe("v");
    await txn.multi();
    await expect(txn.get("k")).rejects.toThrow(/pre-multi/);
  });

  it("txn writes before multi() throw (queue discipline)", async () => {
    const r = createMockRedis();
    const txn = await r.watch("k");
    await expect(txn.set("k", "v")).rejects.toThrow(/multi/);
  });

  it("exec is single-shot", async () => {
    const r = createMockRedis();
    const txn = await r.watch("k");
    await txn.multi();
    await txn.exec();
    await expect(txn.exec()).rejects.toThrow(/already/);
  });

  it("an unrelated key write does not abort the txn", async () => {
    const r = createMockRedis();
    const txn = await r.watch("k");
    await r.set("unrelated", "x");
    await txn.multi();
    await txn.set("k", "v");
    expect(await txn.exec()).not.toBeNull();
  });
});

describe("redis-mock dump/ttl bookkeeping", () => {
  it("dump exposes type, value and recorded ttlS", async () => {
    const r = createMockRedis();
    await r.set("s", "v");
    await r.expire("s", 120);
    await r.hSet("h", { a: "1" });
    await r.zAdd("z", { member: "m", score: 7 });
    const d = r.dump();
    expect(d.get("s")).toEqual({ type: "string", value: "v", ttlS: 120 });
    expect(d.get("h")).toEqual({ type: "hash", value: { a: "1" } });
    expect(d.get("z")).toEqual({ type: "zset", value: [{ member: "m", score: 7 }] });
  });

  it("expire on a missing key records nothing", async () => {
    const r = createMockRedis();
    await r.expire("ghost", 10);
    expect(r.dump().has("ghost")).toBe(false);
  });
});
