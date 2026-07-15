// UserRepo — houses, lineage (gen/bestDepth/lb GT semantics), chalk cap with
// evict-lowest, integrity counter (08 §1.10/§3).

import { describe, expect, it } from "vitest";
import { DAY_TTL_S } from "../core/constants.js";
import { createMockRedis } from "./redis-mock.js";
import { UserRepo } from "./users.js";

const UID = "t2_hero";

describe("UserRepo.get defaults", () => {
  it("absent user → defaults (a house starts at generation 1)", async () => {
    const r = createMockRedis();
    expect(await new UserRepo(r).get(UID)).toEqual({
      house: "",
      gen: 1,
      bestDepth: 0,
      streak: 0,
      stubs: 0,
      heirloom: 0,
      mute: 0,
    });
  });

  it("parses stored fields", async () => {
    const r = createMockRedis();
    await r.hSet(`uv:user:${UID}`, {
      house: "Vex",
      gen: "4",
      bestDepth: "9",
      streak: "2",
      stubs: "13",
      heirloom: "1",
      mute: "1",
    });
    expect(await new UserRepo(r).get(UID)).toEqual({
      house: "Vex",
      gen: 4,
      bestDepth: 9,
      streak: 2,
      stubs: 13,
      heirloom: 1,
      mute: 1,
    });
  });
});

describe("UserRepo.ensureHouse", () => {
  it("first writer wins (hSetNX), later calls return the recorded house", async () => {
    const r = createMockRedis();
    const repo = new UserRepo(r);
    expect(await repo.ensureHouse(UID, "Vex")).toBe("Vex");
    expect(await repo.ensureHouse(UID, "Moth")).toBe("Vex");
    expect((await repo.get(UID)).house).toBe("Vex");
  });
});

describe("UserRepo.onDeath", () => {
  it("first death: fresh user lands at generation 2, bestDepth recorded", async () => {
    const r = createMockRedis();
    const repo = new UserRepo(r);
    const row = await repo.onDeath(UID, 7, 3);
    expect(row.gen).toBe(2); // gen 1 lineage ended → heir is gen 2
    expect(row.bestDepth).toBe(3);
  });

  it("each death advances the generation", async () => {
    const r = createMockRedis();
    const repo = new UserRepo(r);
    await repo.onDeath(UID, 7, 3);
    const row = await repo.onDeath(UID, 8, 1);
    expect(row.gen).toBe(3);
  });

  it("bestDepth only moves up (GT semantics)", async () => {
    const r = createMockRedis();
    const repo = new UserRepo(r);
    await repo.onDeath(UID, 7, 5);
    expect((await repo.onDeath(UID, 8, 3)).bestDepth).toBe(5);
    expect((await repo.onDeath(UID, 9, 8)).bestDepth).toBe(8);
  });

  it("writes lb:depth:{d} with emulated GT and a 48 h TTL", async () => {
    const r = createMockRedis();
    const repo = new UserRepo(r);
    await repo.onDeath(UID, 7, 5);
    expect(await r.zScore("uv:lb:depth:7", UID)).toBe(5);
    const entry = r.dump().get("uv:lb:depth:7") as { ttlS?: number };
    expect(entry.ttlS).toBe(DAY_TTL_S);
    // same-day deeper attempt from a hypothetical second account state
    await r.zAdd("uv:lb:depth:7", { member: "t2_other", score: 2 });
    await new UserRepo(r).onDeath("t2_other", 7, 1); // shallower → no downgrade
    expect(await r.zScore("uv:lb:depth:7", "t2_other")).toBe(2);
  });

  it("marks the flair dirty queue with the uid", async () => {
    const r = createMockRedis();
    await new UserRepo(r).onDeath(UID, 7, 2);
    expect(await r.zScore("uv:flair:dirty", UID)).toBeTypeOf("number");
  });
});

describe("UserRepo chalk", () => {
  it("set/get round-trips bytes; absent floor → null", async () => {
    const r = createMockRedis();
    const repo = new UserRepo(r);
    const chalk = new Uint8Array([0, 1, 2, 255, 128]);
    await repo.setChalk(UID, 3, chalk);
    expect(await repo.getChalk(UID, 3)).toEqual(chalk);
    expect(await repo.getChalk(UID, 4)).toBeNull();
  });

  it("overwrites in place per floor", async () => {
    const r = createMockRedis();
    const repo = new UserRepo(r);
    await repo.setChalk(UID, 3, new Uint8Array([1]));
    await repo.setChalk(UID, 3, new Uint8Array([2, 3]));
    expect(await repo.getChalk(UID, 3)).toEqual(new Uint8Array([2, 3]));
  });

  it("caps at 8 floors, evicting the lowest floor first", async () => {
    const r = createMockRedis();
    const repo = new UserRepo(r);
    for (let f = 1; f <= 9; f++) await repo.setChalk(UID, f, new Uint8Array([f]));
    expect(await repo.getChalk(UID, 1)).toBeNull(); // evicted
    for (let f = 2; f <= 9; f++) expect(await repo.getChalk(UID, f)).toEqual(new Uint8Array([f]));
  });

  it("eviction never disturbs non-chalk fields", async () => {
    const r = createMockRedis();
    const repo = new UserRepo(r);
    await repo.ensureHouse(UID, "Vex");
    for (let f = 1; f <= 9; f++) await repo.setChalk(UID, f, new Uint8Array([f]));
    expect((await repo.get(UID)).house).toBe("Vex");
  });
});

describe("UserRepo.bumpIntegrity", () => {
  it("increments and returns the desync count", async () => {
    const r = createMockRedis();
    const repo = new UserRepo(r);
    expect(await repo.bumpIntegrity(UID)).toBe(1);
    expect(await repo.bumpIntegrity(UID)).toBe(2);
    expect(await repo.bumpIntegrity(UID)).toBe(3); // soft-flag threshold (02 §7)
    expect(await r.get(`uv:integrity:${UID}`)).toBe("3");
  });
});
