// CorpseRepo — 72 h corpse lifetime, ts-pinned visibility, one-winner recovery,
// score-driven GC with the 1 h grace (08 §1.7/§1.10/§3).

import { describe, expect, it } from "vitest";
import { CORPSE_TTL_S, GC_GRACE_S } from "../core/constants.js";
import type { RedisLike } from "./redis.js";
import { createMockRedis } from "./redis-mock.js";
import { CorpseRepo, type CorpseRow } from "./corpses.js";

const NOW = 1_800_000_000_000;

function corpse(over: Partial<CorpseRow> = {}): CorpseRow {
  const createdTs = over.createdTs ?? NOW;
  return {
    id: "7-t2_hero",
    uid: "t2_hero",
    house: "Vex",
    gen: 2,
    day: 7,
    floor: 2,
    x: 11,
    y: 12,
    words: "the moss lied",
    gift: { item: 3, charges: 2 },
    unbanked: [{ key: "waxling|touch|self", effect: 4 }],
    vigils: 0,
    recoveredBy: "",
    createdTs,
    expiryTs: createdTs + CORPSE_TTL_S * 1000,
    ...over,
  };
}

describe("CorpseRepo put/get", () => {
  it("round-trips a full row (gift present)", async () => {
    const r = createMockRedis();
    const repo = new CorpseRepo(r);
    const c = corpse();
    await repo.put(c);
    expect(await repo.get(c.id)).toEqual(c);
  });

  it("round-trips a null gift and empty unbanked", async () => {
    const r = createMockRedis();
    const repo = new CorpseRepo(r);
    const c = corpse({ gift: null, unbanked: [] });
    await repo.put(c);
    expect(await repo.get(c.id)).toEqual(c);
  });

  it("get of a missing corpse is null", async () => {
    const r = createMockRedis();
    expect(await new CorpseRepo(r).get("nope")).toBeNull();
  });

  it("put is idempotent and maintains the floor index with score=expiryTs", async () => {
    const r = createMockRedis();
    const repo = new CorpseRepo(r);
    const c = corpse();
    await repo.put(c);
    await repo.put(c);
    expect(await r.zCard("uv:corpses:2")).toBe(1);
    expect(await r.zScore("uv:corpses:2", c.id)).toBe(c.expiryTs);
  });

  it("corpse hash carries NO EXPIRE — lifetime is score-driven (08 §3)", async () => {
    const r = createMockRedis();
    await new CorpseRepo(r).put(corpse());
    const entry = r.dump().get("uv:corpse:7-t2_hero") as { ttlS?: number };
    expect(entry.ttlS).toBeUndefined();
  });
});

describe("CorpseRepo listForFloor — ts-pinned (createdTs <= pin < expiryTs)", () => {
  it("filters by the pin on both edges", async () => {
    const r = createMockRedis();
    const repo = new CorpseRepo(r);
    const c = corpse({ createdTs: 1000, expiryTs: 2000 });
    await repo.put(c);
    expect((await repo.listForFloor(2, 1500)).map((x) => x.id)).toEqual([c.id]);
    expect(await repo.listForFloor(2, 999)).toEqual([]); // created after pin
    expect((await repo.listForFloor(2, 1000)).map((x) => x.id)).toEqual([c.id]); // created == pin included
    expect(await repo.listForFloor(2, 2000)).toEqual([]); // pin == expiry excluded (strict <)
    expect(await repo.listForFloor(2, 1999)).not.toEqual([]);
  });

  it("returns corpses sorted by id (string compare) for deterministic composition", async () => {
    const r = createMockRedis();
    const repo = new CorpseRepo(r);
    await repo.put(corpse({ id: "7-t2_bbb", uid: "t2_bbb", createdTs: 1000, expiryTs: 9000 }));
    await repo.put(corpse({ id: "7-t2_aaa", uid: "t2_aaa", createdTs: 1500, expiryTs: 8000 }));
    await repo.put(corpse({ id: "6-t2_zzz", uid: "t2_zzz", createdTs: 500, expiryTs: 7000 }));
    const ids = (await repo.listForFloor(2, 2000)).map((x) => x.id);
    expect(ids).toEqual(["6-t2_zzz", "7-t2_aaa", "7-t2_bbb"]);
  });

  it("scopes to the floor index", async () => {
    const r = createMockRedis();
    const repo = new CorpseRepo(r);
    await repo.put(corpse({ floor: 3 }));
    expect(await repo.listForFloor(2, NOW)).toEqual([]);
    expect((await repo.listForFloor(3, NOW)).map((x) => x.id)).toEqual(["7-t2_hero"]);
  });
});

describe("CorpseRepo claimRecovery — one winner (D51)", () => {
  it("first claimant wins, rivals lose, winner's retry stays true", async () => {
    const r = createMockRedis();
    const repo = new CorpseRepo(r);
    await repo.put(corpse());
    expect(await repo.claimRecovery("7-t2_hero", "t2_finder")).toBe(true);
    expect(await repo.claimRecovery("7-t2_hero", "t2_rival")).toBe(false);
    expect(await repo.claimRecovery("7-t2_hero", "t2_finder")).toBe(true); // idempotent retry
    expect((await repo.get("7-t2_hero"))?.recoveredBy).toBe("t2_finder");
  });

  it("claiming a missing corpse is false", async () => {
    const r = createMockRedis();
    expect(await new CorpseRepo(r).claimRecovery("ghost", "t2_a")).toBe(false);
  });

  it("lost watch/multi race → false, rival's claim stands", async () => {
    const mock = createMockRedis();
    const repo0 = new CorpseRepo(mock);
    await repo0.put(corpse());
    let fired = false;
    const raced: RedisLike = {
      ...mock,
      hGet: async (key: string, field: string) => {
        const snapshot = await mock.hGet(key, field);
        if (!fired && field === "recoveredBy") {
          fired = true;
          await mock.hSet(key, { recoveredBy: "t2_rival" }); // rival lands between watch and exec
        }
        return snapshot;
      },
    };
    expect(await new CorpseRepo(raced).claimRecovery("7-t2_hero", "t2_finder")).toBe(false);
    expect((await repo0.get("7-t2_hero"))?.recoveredBy).toBe("t2_rival");
  });
});

describe("CorpseRepo gcExpired — strict cutoff with 1 h grace", () => {
  it("removes hash + index entry only when expiryTs < now - grace", async () => {
    const r = createMockRedis();
    const repo = new CorpseRepo(r);
    const graceMs = GC_GRACE_S * 1000;
    const dead = corpse({ id: "1-t2_dead", uid: "t2_dead", createdTs: 0, expiryTs: NOW - graceMs - 1 });
    const boundary = corpse({ id: "1-t2_edge", uid: "t2_edge", createdTs: 0, expiryTs: NOW - graceMs });
    const alive = corpse({ id: "7-t2_live", uid: "t2_live", createdTs: NOW, expiryTs: NOW + 1000 });
    await repo.put(dead);
    await repo.put(boundary);
    await repo.put(alive);

    expect(await repo.gcExpired(NOW)).toBe(1);
    expect(await repo.get("1-t2_dead")).toBeNull();
    expect(await r.zScore("uv:corpses:2", "1-t2_dead")).toBeUndefined();
    // boundary (== cutoff) survives — strict less-than (08 §0.3 GC_GRACE_S)
    expect(await repo.get("1-t2_edge")).not.toBeNull();
    expect(await repo.get("7-t2_live")).not.toBeNull();
  });

  it("sweeps every floor index without key scans and reports the count", async () => {
    const r = createMockRedis();
    const repo = new CorpseRepo(r);
    for (let f = 1; f <= 4; f++) {
      await repo.put(
        corpse({ id: `1-t2_f${f}`, uid: `t2_f${f}`, floor: f, createdTs: 0, expiryTs: 1 }),
      );
    }
    expect(await repo.gcExpired(NOW)).toBe(4);
    for (let f = 1; f <= 4; f++) expect(await r.zCard(`uv:corpses:${f}`)).toBe(0);
  });

  it("is a no-op when nothing is expired", async () => {
    const r = createMockRedis();
    const repo = new CorpseRepo(r);
    await repo.put(corpse());
    expect(await repo.gcExpired(NOW)).toBe(0);
    expect(await repo.get("7-t2_hero")).not.toBeNull();
  });
});
