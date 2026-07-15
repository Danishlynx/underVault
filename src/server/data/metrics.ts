// src/server/data/metrics.ts — MetricsRepo (08 §1.10, §3).
//
// uv:metrics:{d}  hash  counters: runs, deaths:{cause}, claims, inks, desyncs — 48 h TTL

import { DAY_TTL_S, KEY } from "../core/constants.js";
import type { RedisLike } from "./redis.js";

const kMetrics = (d: number): string => `${KEY}metrics:${d}`;

export class MetricsRepo {
  constructor(private readonly r: RedisLike) {}

  /** hIncrBy uv:metrics:{d}; TTL stamped on the hash's first write. */
  async incr(day: number, field: string, by = 1): Promise<void> {
    const key = kMetrics(day);
    const next = await this.r.hIncrBy(key, field, by);
    // first write to this field ⇒ possibly a fresh hash — (re)stamp the 48 h TTL
    if (next === by) await this.r.expire(key, DAY_TTL_S);
  }
}
