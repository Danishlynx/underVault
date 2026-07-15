// src/server/data/redis.ts — the RedisLike abstraction (08 §4, binding, frozen).
//
// Repos depend ONLY on this interface. `redis-devvit.ts` adapts @devvit/redis to
// it (absorbing platform signature drift); `redis-mock.ts` implements it
// in-memory for vitest. No repo, route, or core module may import `@devvit/*`
// directly except `redis-devvit.ts`, `middleware.ts`, and `internal.ts`.
//
// The law (invariant 5 / 02 §5): no key scans, no Lua, no plain Sets — this
// interface deliberately exposes none of SCAN/KEYS/EVAL/S*; every collection
// maintains its own zset/hash index; atomicity via single-command ops or
// watch/multi/exec.

export interface ZMember {
  member: string;
  score: number;
}

export interface ZRangeOpts {
  by?: "rank" | "score";
  reverse?: boolean;
  limit?: { offset: number; count: number };
}

export interface RedisTxnLike {
  multi(): Promise<void>;
  exec(): Promise<unknown[] | null>; // null ⇒ watched key changed — caller retries or 409s
  unwatch(): Promise<void>;
  get(key: string): Promise<string | undefined>; // pre-multi reads on the watched connection
  set(key: string, value: string): Promise<void>;
  hSet(key: string, fieldValues: Record<string, string>): Promise<void>;
  hIncrBy(key: string, field: string, value: number): Promise<void>;
  zAdd(key: string, ...members: ZMember[]): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
}

export interface RedisLike {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(...keys: string[]): Promise<void>;
  exists(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  incrBy(key: string, value: number): Promise<number>;
  mGet(keys: string[]): Promise<(string | null)[]>;

  hSet(key: string, fieldValues: Record<string, string>): Promise<number>;
  hSetNX(key: string, field: string, value: string): Promise<boolean>;
  hGet(key: string, field: string): Promise<string | undefined>;
  hMGet(key: string, fields: string[]): Promise<(string | null)[]>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hDel(key: string, fields: string[]): Promise<number>;
  hIncrBy(key: string, field: string, value: number): Promise<number>;

  zAdd(key: string, ...members: ZMember[]): Promise<number>;
  zRange(key: string, start: number, stop: number, opts?: ZRangeOpts): Promise<ZMember[]>;
  zRem(key: string, members: string[]): Promise<number>;
  zScore(key: string, member: string): Promise<number | undefined>;
  zCard(key: string): Promise<number>;
  zIncrBy(key: string, member: string, value: number): Promise<number>;
  zRemRangeByRank(key: string, start: number, stop: number): Promise<number>;
  zRemRangeByScore(key: string, min: number, max: number): Promise<number>;

  watch(...keys: string[]): Promise<RedisTxnLike>;
}
