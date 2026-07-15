// src/server/data/redis-devvit.ts — adapts @devvit/redis to RedisLike (08 §4).
//
// The ONLY data-layer module allowed to import `@devvit/*`. It absorbs
// platform signature drift (hSetNX number → boolean, exec conflict behavior,
// undefined/null coercions) so repos see one stable contract.

import { redis } from "@devvit/web/server";
import type { RedisLike, RedisTxnLike, ZMember, ZRangeOpts } from "./redis.js";

type DevvitTxn = Awaited<ReturnType<typeof redis.watch>>;

function bindTxn(tx: DevvitTxn): RedisTxnLike {
  return {
    async multi() {
      await tx.multi();
    },
    async exec() {
      // Devvit types exec() as Promise<any[]>; a lost watch surfaces as a
      // null/undefined result or a rejected promise depending on platform
      // version — normalize every conflict shape to null (08 §4 contract).
      try {
        const res = (await tx.exec()) as unknown[] | null | undefined;
        return res ?? null;
      } catch {
        return null;
      }
    },
    async unwatch() {
      await tx.unwatch();
    },
    async get(key) {
      // pre-multi read; Devvit's tx client queues reads, so serve them from
      // the main client — same connection semantics, watch still guards exec.
      return redis.get(key);
    },
    async set(key, value) {
      await tx.set(key, value);
    },
    async hSet(key, fieldValues) {
      await tx.hSet(key, fieldValues);
    },
    async hIncrBy(key, field, value) {
      await tx.hIncrBy(key, field, value);
    },
    async zAdd(key, ...members: ZMember[]) {
      await tx.zAdd(key, ...members);
    },
    async expire(key, seconds) {
      await tx.expire(key, seconds);
    },
  };
}

export function bindDevvitRedis(): RedisLike {
  return {
    async get(key) {
      return redis.get(key);
    },
    async set(key, value) {
      await redis.set(key, value);
    },
    async del(...keys) {
      await redis.del(...keys);
    },
    async exists(...keys) {
      return redis.exists(...keys);
    },
    async expire(key, seconds) {
      await redis.expire(key, seconds);
    },
    async incrBy(key, value) {
      return redis.incrBy(key, value);
    },
    async mGet(keys) {
      const vals = await redis.mGet(keys);
      return vals.map((v) => v ?? null);
    },

    async hSet(key, fieldValues) {
      return redis.hSet(key, fieldValues);
    },
    async hSetNX(key, field, value) {
      return (await redis.hSetNX(key, field, value)) !== 0;
    },
    async hGet(key, field) {
      return redis.hGet(key, field);
    },
    async hMGet(key, fields) {
      const vals = await redis.hMGet(key, fields);
      return vals.map((v) => v ?? null);
    },
    async hGetAll(key) {
      return (await redis.hGetAll(key)) ?? {};
    },
    async hDel(key, fields) {
      return redis.hDel(key, fields);
    },
    async hIncrBy(key, field, value) {
      return redis.hIncrBy(key, field, value);
    },

    async zAdd(key, ...members: ZMember[]) {
      return redis.zAdd(key, ...members);
    },
    async zRange(key, start, stop, opts?: ZRangeOpts) {
      const rows = await redis.zRange(key, start, stop, {
        by: opts?.by ?? "rank",
        ...(opts?.reverse !== undefined ? { reverse: opts.reverse } : {}),
        ...(opts?.limit !== undefined ? { limit: opts.limit } : {}),
      });
      return rows.map((r) => ({ member: r.member, score: r.score }));
    },
    async zRem(key, members) {
      return redis.zRem(key, members);
    },
    async zScore(key, member) {
      return redis.zScore(key, member);
    },
    async zCard(key) {
      return redis.zCard(key);
    },
    async zIncrBy(key, member, value) {
      return redis.zIncrBy(key, member, value);
    },
    async zRemRangeByRank(key, start, stop) {
      return redis.zRemRangeByRank(key, start, stop);
    },
    async zRemRangeByScore(key, min, max) {
      return redis.zRemRangeByScore(key, min, max);
    },

    async watch(...keys) {
      return bindTxn(await redis.watch(...keys));
    },
  };
}
