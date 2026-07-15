// src/server/data/redis-mock.ts — in-memory RedisLike for vitest (08 §4).
//
// Mock semantics MUST match Devvit: hGetAll of a missing key → {}, zRange by
// score inclusive, exec() → null when a watched key was written between
// watch() and exec(). Type mismatches throw WRONGTYPE like real Redis.
// TTLs are recorded (visible via dump()) but not clock-enforced — tests
// assert the TTL was set, the platform enforces it.

import type { RedisLike, RedisTxnLike, ZMember } from "./redis.js";

type Entry =
  | { type: "string"; value: string }
  | { type: "hash"; value: Map<string, string> }
  | { type: "zset"; value: Map<string, number> };

interface QueuedOp {
  run(): unknown;
}

function wrongType(key: string, want: string, got: string): Error {
  return new Error(
    `WRONGTYPE key ${key} holds ${got}, operation expects ${want} (mock, matches real Redis)`,
  );
}

export function createMockRedis(): RedisLike & { dump(): Map<string, unknown> } {
  const store = new Map<string, Entry>();
  const ttls = new Map<string, number>(); // key → seconds from the last expire()
  const versions = new Map<string, number>(); // bumped on every modification

  function bump(key: string): void {
    versions.set(key, (versions.get(key) ?? 0) + 1);
  }

  function asString(key: string): string | undefined {
    const e = store.get(key);
    if (e === undefined) return undefined;
    if (e.type !== "string") throw wrongType(key, "string", e.type);
    return e.value;
  }

  function asHash(key: string, create: boolean): Map<string, string> | undefined {
    const e = store.get(key);
    if (e === undefined) {
      if (!create) return undefined;
      const value = new Map<string, string>();
      store.set(key, { type: "hash", value });
      return value;
    }
    if (e.type !== "hash") throw wrongType(key, "hash", e.type);
    return e.value;
  }

  function asZset(key: string, create: boolean): Map<string, number> | undefined {
    const e = store.get(key);
    if (e === undefined) {
      if (!create) return undefined;
      const value = new Map<string, number>();
      store.set(key, { type: "zset", value });
      return value;
    }
    if (e.type !== "zset") throw wrongType(key, "zset", e.type);
    return e.value;
  }

  function zSorted(key: string): ZMember[] {
    const z = asZset(key, false);
    if (z === undefined) return [];
    const out: ZMember[] = [];
    for (const [member, score] of z) out.push({ member, score });
    out.sort((a, b) => (a.score - b.score !== 0 ? a.score - b.score : a.member < b.member ? -1 : a.member > b.member ? 1 : 0));
    return out;
  }

  function normRank(i: number, card: number): number {
    return i < 0 ? card + i : i;
  }

  // ── plain (non-txn) command implementations, shared with exec() ──────────

  function doSet(key: string, value: string): void {
    // real Redis SET overwrites regardless of the previous type
    store.set(key, { type: "string", value });
    bump(key);
  }

  function doHSet(key: string, fieldValues: Record<string, string>): number {
    const h = asHash(key, true)!;
    let added = 0;
    for (const [f, v] of Object.entries(fieldValues)) {
      if (!h.has(f)) added++;
      h.set(f, v);
    }
    bump(key);
    return added;
  }

  function doHIncrBy(key: string, field: string, value: number): number {
    const h = asHash(key, true)!;
    const cur = h.get(field);
    const base = cur === undefined ? 0 : Number.parseInt(cur, 10);
    if (Number.isNaN(base)) throw new Error(`hIncrBy on non-integer field ${key}.${field}`);
    const next = base + value;
    h.set(field, String(next));
    bump(key);
    return next;
  }

  function doZAdd(key: string, members: ZMember[]): number {
    const z = asZset(key, true)!;
    let added = 0;
    for (const m of members) {
      if (!z.has(m.member)) added++;
      z.set(m.member, m.score);
    }
    bump(key);
    return added;
  }

  function doExpire(key: string, seconds: number): void {
    if (!store.has(key)) return;
    ttls.set(key, seconds);
    bump(key); // EXPIRE counts as a modification for WATCH purposes
  }

  const mock: RedisLike & { dump(): Map<string, unknown> } = {
    async get(key) {
      return asString(key);
    },

    async set(key, value) {
      doSet(key, value);
    },

    async del(...keys) {
      for (const key of keys) {
        if (store.delete(key)) {
          ttls.delete(key);
          bump(key);
        }
      }
    },

    async exists(...keys) {
      let n = 0;
      for (const key of keys) if (store.has(key)) n++; // double counts dupes, like Devvit
      return n;
    },

    async expire(key, seconds) {
      doExpire(key, seconds);
    },

    async incrBy(key, value) {
      const cur = asString(key);
      const base = cur === undefined ? 0 : Number.parseInt(cur, 10);
      if (Number.isNaN(base)) throw new Error(`incrBy on non-integer key ${key}`);
      const next = base + value;
      doSet(key, String(next));
      return next;
    },

    async mGet(keys) {
      return keys.map((key) => {
        const e = store.get(key);
        return e !== undefined && e.type === "string" ? e.value : null; // MGET: non-string → nil
      });
    },

    async hSet(key, fieldValues) {
      return doHSet(key, fieldValues);
    },

    async hSetNX(key, field, value) {
      const h = asHash(key, true)!;
      if (h.has(field)) return false;
      h.set(field, value);
      bump(key);
      return true;
    },

    async hGet(key, field) {
      return asHash(key, false)?.get(field);
    },

    async hMGet(key, fields) {
      const h = asHash(key, false);
      return fields.map((f) => h?.get(f) ?? null);
    },

    async hGetAll(key) {
      const h = asHash(key, false);
      const out: Record<string, string> = {};
      if (h !== undefined) for (const [f, v] of h) out[f] = v;
      return out; // missing key → {}
    },

    async hDel(key, fields) {
      const h = asHash(key, false);
      if (h === undefined) return 0;
      let removed = 0;
      for (const f of fields) if (h.delete(f)) removed++;
      if (removed > 0) bump(key);
      if (h.size === 0) {
        store.delete(key);
        ttls.delete(key);
      }
      return removed;
    },

    async hIncrBy(key, field, value) {
      return doHIncrBy(key, field, value);
    },

    async zAdd(key, ...members) {
      return doZAdd(key, members);
    },

    async zRange(key, start, stop, opts) {
      const by = opts?.by ?? "rank";
      // Redis REV semantics: the ordering flips FIRST (highest score = rank 0,
      // member reverse-lex tiebreak), THEN rank slicing applies — so
      // zRange(k, 0, n-1, { reverse: true }) is the top-n by score.
      let rows = zSorted(key);
      if (opts?.reverse === true) rows = rows.slice().reverse();
      if (by === "score") {
        // inclusive both bounds; (start, stop) stay (min, max) either direction (Devvit)
        rows = rows.filter((m) => m.score >= start && m.score <= stop);
      } else {
        const card = rows.length;
        const lo = Math.max(0, normRank(start, card));
        const hi = Math.min(card - 1, normRank(stop, card));
        rows = lo > hi ? [] : rows.slice(lo, hi + 1);
      }
      if (opts?.limit !== undefined) {
        rows = rows.slice(opts.limit.offset, opts.limit.offset + opts.limit.count);
      }
      return rows;
    },

    async zRem(key, members) {
      const z = asZset(key, false);
      if (z === undefined) return 0;
      let removed = 0;
      for (const m of members) if (z.delete(m)) removed++;
      if (removed > 0) bump(key);
      if (z.size === 0) {
        store.delete(key);
        ttls.delete(key);
      }
      return removed;
    },

    async zScore(key, member) {
      return asZset(key, false)?.get(member);
    },

    async zCard(key) {
      return asZset(key, false)?.size ?? 0;
    },

    async zIncrBy(key, member, value) {
      const z = asZset(key, true)!;
      const next = (z.get(member) ?? 0) + value;
      z.set(member, next);
      bump(key);
      return next;
    },

    async zRemRangeByRank(key, start, stop) {
      const rows = zSorted(key);
      const card = rows.length;
      const lo = Math.max(0, normRank(start, card));
      const hi = Math.min(card - 1, normRank(stop, card));
      if (lo > hi) return 0;
      const doomed = rows.slice(lo, hi + 1).map((m) => m.member);
      return this.zRem(key, doomed);
    },

    async zRemRangeByScore(key, min, max) {
      const doomed = zSorted(key)
        .filter((m) => m.score >= min && m.score <= max)
        .map((m) => m.member);
      if (doomed.length === 0) return 0;
      return this.zRem(key, doomed);
    },

    async watch(...keys) {
      const snapshot = new Map<string, number>();
      for (const key of keys) snapshot.set(key, versions.get(key) ?? 0);
      let inMulti = false;
      let finished = false;
      let watching = true;
      const queue: QueuedOp[] = [];

      const guardOpen = (): void => {
        if (finished) throw new Error("txn already executed (mock)");
      };

      const txn: RedisTxnLike = {
        async multi() {
          guardOpen();
          inMulti = true;
        },
        async exec() {
          guardOpen();
          finished = true;
          if (watching) {
            for (const [key, ver] of snapshot) {
              if ((versions.get(key) ?? 0) !== ver) return null; // watched key changed
            }
          }
          return queue.map((op) => op.run());
        },
        async unwatch() {
          watching = false;
        },
        async get(key) {
          guardOpen();
          if (inMulti) throw new Error("txn.get is a pre-multi read (08 §4); called after multi()");
          return asString(key);
        },
        async set(key, value) {
          guardOpen();
          if (!inMulti) throw new Error("txn writes must come after multi() (mock)");
          queue.push({ run: () => doSet(key, value) });
        },
        async hSet(key, fieldValues) {
          guardOpen();
          if (!inMulti) throw new Error("txn writes must come after multi() (mock)");
          const copy = { ...fieldValues };
          queue.push({ run: () => doHSet(key, copy) });
        },
        async hIncrBy(key, field, value) {
          guardOpen();
          if (!inMulti) throw new Error("txn writes must come after multi() (mock)");
          queue.push({ run: () => doHIncrBy(key, field, value) });
        },
        async zAdd(key, ...members) {
          guardOpen();
          if (!inMulti) throw new Error("txn writes must come after multi() (mock)");
          const copy = members.map((m) => ({ ...m }));
          queue.push({ run: () => doZAdd(key, copy) });
        },
        async expire(key, seconds) {
          guardOpen();
          if (!inMulti) throw new Error("txn writes must come after multi() (mock)");
          queue.push({ run: () => doExpire(key, seconds) });
        },
      };
      return txn;
    },

    dump() {
      const out = new Map<string, unknown>();
      for (const [key, e] of store) {
        const ttlS = ttls.get(key);
        if (e.type === "string") {
          out.set(key, { type: "string", value: e.value, ...(ttlS !== undefined ? { ttlS } : {}) });
        } else if (e.type === "hash") {
          const value: Record<string, string> = {};
          for (const [f, v] of e.value) value[f] = v;
          out.set(key, { type: "hash", value, ...(ttlS !== undefined ? { ttlS } : {}) });
        } else {
          out.set(key, { type: "zset", value: zSorted(key), ...(ttlS !== undefined ? { ttlS } : {}) });
        }
      }
      return out;
    },
  };

  return mock;
}
