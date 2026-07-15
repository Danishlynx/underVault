// CodexRepo — banking, distinct-confirmer counting, transactional first-credit,
// inking at INK_AT, paging (08 §1.10/§3, 02 §4).

import { describe, expect, it } from "vitest";
import { INK_AT } from "../core/constants.js";
import type { RedisLike } from "./redis.js";
import { createMockRedis } from "./redis-mock.js";
import { CodexRepo, ruleHash } from "./codex.js";

const KEY_A = "waxling|touch|self";
const KEY_B = "cinder|throw|door";
const DAY = 7;

const claim = (key: string, effect = 4): { key: string; effect: number } => ({ key, effect });

describe("ruleHash", () => {
  it("is 8 lowercase hex chars and deterministic", () => {
    const h = ruleHash(KEY_A);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
    expect(ruleHash(KEY_A)).toBe(h);
    expect(ruleHash(KEY_B)).not.toBe(h);
  });
});

describe("CodexRepo.bank", () => {
  it("first bank mints the claim row with first-credit and one confirm", async () => {
    const r = createMockRedis();
    const repo = new CodexRepo(r);
    const rows = await repo.bank("t2_ada", DAY, [claim(KEY_A)], []);
    expect(rows).toEqual([
      {
        ruleKey: KEY_A,
        effect: 4,
        status: "true",
        confirms: 1,
        day: DAY,
        discoverer: "t2_ada",
      },
    ]);
  });

  it("status is conditional iff the subject is omen-conditional", async () => {
    const r = createMockRedis();
    const rows = await new CodexRepo(r).bank("t2_ada", DAY, [claim(KEY_A)], ["waxling"]);
    expect(rows[0]?.status).toBe("conditional");
  });

  it("re-bank by the same uid is idempotent — confirms stay at 1, day sticky", async () => {
    const r = createMockRedis();
    const repo = new CodexRepo(r);
    await repo.bank("t2_ada", DAY, [claim(KEY_A)], []);
    const rows = await repo.bank("t2_ada", DAY + 2, [claim(KEY_A)], []);
    expect(rows[0]?.confirms).toBe(1); // zAdd (uid,day) idempotent per uid
    expect(rows[0]?.day).toBe(DAY); // discovery day never moves
    expect(rows[0]?.discoverer).toBe("t2_ada");
  });

  it("distinct uids raise confirms; discoverer stays the first", async () => {
    const r = createMockRedis();
    const repo = new CodexRepo(r);
    await repo.bank("t2_ada", DAY, [claim(KEY_A)], []);
    const rows = await repo.bank("t2_bob", DAY, [claim(KEY_A)], []);
    expect(rows[0]?.confirms).toBe(2);
    expect(rows[0]?.discoverer).toBe("t2_ada");
  });

  it(`inks at ${INK_AT} distinct confirmers and records the ink day once`, async () => {
    const r = createMockRedis();
    const repo = new CodexRepo(r);
    for (let i = 1; i < INK_AT; i++) {
      const rows = await repo.bank(`t2_u${i}`, DAY + i, [claim(KEY_A)], []);
      expect(rows[0]?.status).toBe("true");
    }
    const inkDay = DAY + INK_AT;
    const rows = await repo.bank(`t2_u${INK_AT}`, inkDay, [claim(KEY_A)], []);
    expect(rows[0]?.status).toBe("inked");
    expect(await r.zScore("uv:codex:inked", ruleHash(KEY_A))).toBe(inkDay);
    // a later confirmer must not move the ink day
    await repo.bank("t2_late", inkDay + 5, [claim(KEY_A)], []);
    expect(await r.zScore("uv:codex:inked", ruleHash(KEY_A))).toBe(inkDay);
    expect(await repo.inkedCount()).toBe(1);
  });

  it("dedupes claims by ruleKey within one bank call", async () => {
    const r = createMockRedis();
    const rows = await new CodexRepo(r).bank("t2_ada", DAY, [claim(KEY_A), claim(KEY_A)], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.confirms).toBe(1);
  });

  it("banks multiple distinct claims in order", async () => {
    const r = createMockRedis();
    const rows = await new CodexRepo(r).bank("t2_ada", DAY, [claim(KEY_A), claim(KEY_B, 7)], []);
    expect(rows.map((x) => x.ruleKey)).toEqual([KEY_A, KEY_B]);
    expect(rows[1]?.effect).toBe(7);
  });

  it("the recorded effect is sticky against later divergent claims", async () => {
    const r = createMockRedis();
    const repo = new CodexRepo(r);
    await repo.bank("t2_ada", DAY, [claim(KEY_A, 4)], []);
    const rows = await repo.bank("t2_bob", DAY, [claim(KEY_A, 9)], []);
    expect(rows[0]?.effect).toBe(4); // server-verified first write wins; routes gate claims anyway
  });

  it("lost first-credit race → the rival is the discoverer, confirm still lands", async () => {
    const mock = createMockRedis();
    const byRuleKey = `uv:claims:byRule:${ruleHash(KEY_A)}`;
    let fired = false;
    const raced: RedisLike = {
      ...mock,
      get: async (key: string) => {
        const snapshot = await mock.get(key);
        if (!fired && key === byRuleKey) {
          fired = true;
          await mock.set(key, "t2_rival"); // rival lands between watch and exec
        }
        return snapshot;
      },
    };
    const rows = await new CodexRepo(raced).bank("t2_ada", DAY, [claim(KEY_A)], []);
    expect(rows[0]?.discoverer).toBe("t2_rival");
    expect(rows[0]?.confirms).toBe(1); // ada's confirm counted regardless
    expect(await mock.get(byRuleKey)).toBe("t2_rival");
  });
});

describe("CodexRepo.confirmObserved", () => {
  it("only touches EXISTING rule hashes — unknown keys mint nothing", async () => {
    const r = createMockRedis();
    await new CodexRepo(r).confirmObserved("t2_ada", DAY, [KEY_A]);
    expect(r.dump().size).toBe(0);
  });

  it("adds distinct confirmers and inks at the threshold", async () => {
    const r = createMockRedis();
    const repo = new CodexRepo(r);
    await repo.bank("t2_ada", DAY, [claim(KEY_A)], []);
    for (let i = 2; i <= INK_AT; i++) {
      await repo.confirmObserved(`t2_u${i}`, DAY + i, [KEY_A]);
    }
    const { rows } = await repo.page(0, 10);
    expect(rows[0]?.confirms).toBe(INK_AT);
    expect(rows[0]?.status).toBe("inked");
    expect(await r.zScore("uv:codex:inked", ruleHash(KEY_A))).toBe(DAY + INK_AT);
  });

  it("same-uid re-confirm is idempotent", async () => {
    const r = createMockRedis();
    const repo = new CodexRepo(r);
    await repo.bank("t2_ada", DAY, [claim(KEY_A)], []);
    await repo.confirmObserved("t2_ada", DAY, [KEY_A, KEY_A]);
    const h = ruleHash(KEY_A);
    expect(await r.zCard(`uv:rule:${h}:confirms`)).toBe(1);
    expect(await r.hGet(`uv:claim:${h}`, "confirms")).toBe("1");
  });
});

describe("CodexRepo paging / counts", () => {
  async function inkRule(repo: CodexRepo, key: string, baseDay: number): Promise<void> {
    for (let i = 1; i <= INK_AT; i++) await repo.bank(`t2_u${i}`, baseDay, [claim(key)], []);
  }

  it("page walks the inked ledger with total", async () => {
    const r = createMockRedis();
    const repo = new CodexRepo(r);
    await inkRule(repo, KEY_A, 1);
    await inkRule(repo, KEY_B, 2);
    await inkRule(repo, "moth|burn|brazier", 3);
    const p0 = await repo.page(0, 2);
    expect(p0.total).toBe(3);
    expect(p0.rows).toHaveLength(2);
    expect(p0.rows.map((x) => x.ruleKey)).toEqual([KEY_A, KEY_B]); // score = ink day ordering
    const p1 = await repo.page(1, 2);
    expect(p1.rows.map((x) => x.ruleKey)).toEqual(["moth|burn|brazier"]);
    const p2 = await repo.page(2, 2);
    expect(p2.rows).toEqual([]);
  });

  it("un-inked claims are not paged", async () => {
    const r = createMockRedis();
    const repo = new CodexRepo(r);
    await repo.bank("t2_ada", DAY, [claim(KEY_A)], []);
    expect((await repo.page(0, 10)).total).toBe(0);
    expect(await repo.inkedCount()).toBe(0);
  });

  it("totalRules reads the day-meta ruleTotal for the current day", async () => {
    const r = createMockRedis();
    const repo = new CodexRepo(r);
    expect(await repo.totalRules()).toBe(0); // no day minted
    await r.set("uv:day:current", "7");
    expect(await repo.totalRules()).toBe(0); // meta lacks ruleTotal
    await r.hSet("uv:day:7:meta", { ruleTotal: "64" });
    expect(await repo.totalRules()).toBe(64);
  });
});
