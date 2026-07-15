// src/server/data/echoes.ts — EchoRepo: cosmetic wander-echoes, capped 50/floor (08 §1.10, §3).
//
// uv:echo:{id}          string  b64 keyframes (≤64 × [x,y,candle] @2 Hz ≈ 300 B), 72 h TTL
// uv:echoes:{d}:{floor} zset    member=echoId, score=interest — capped via zRemRangeByRank, 48 h TTL
//
// Echoes are cosmetic only and excluded from replay inputs entirely (08 §1.7).

import { DAY_TTL_S, CORPSE_TTL_S, ECHO_FLOOR_CAP, KEY } from "../core/constants.js";
import type { RedisLike } from "./redis.js";

const ECHO_TTL_S = CORPSE_TTL_S; // 72 h per 08 §3 (same window as corpses)

const kEcho = (id: string): string => `${KEY}echo:${id}`;
const kIndex = (d: number, floor: number): string => `${KEY}echoes:${d}:${floor}`;

export class EchoRepo {
  constructor(private readonly r: RedisLike) {}

  /**
   * set echo:{id} + zAdd index (score = interest) + cap at ECHO_FLOOR_CAP via
   * zRemRangeByRank (lowest-interest members drop; their strings lapse on TTL).
   */
  async put(
    day: number,
    floor: number,
    echoId: string,
    framesB64: string,
    interest: number,
  ): Promise<void> {
    const idx = kIndex(day, floor);
    await this.r.set(kEcho(echoId), framesB64);
    await this.r.expire(kEcho(echoId), ECHO_TTL_S);
    await this.r.zAdd(idx, { member: echoId, score: interest });
    await this.r.zRemRangeByRank(idx, 0, -(ECHO_FLOOR_CAP + 1));
    await this.r.expire(idx, DAY_TTL_S);
  }

  /** Highest-interest first; silently drops ids whose string already expired. */
  async topForFloor(
    day: number,
    floor: number,
    limit: number,
  ): Promise<{ day: number; floor: number; framesB64: string }[]> {
    if (limit <= 0) return [];
    const top = await this.r.zRange(kIndex(day, floor), 0, limit - 1, {
      by: "rank",
      reverse: true,
    });
    if (top.length === 0) return [];
    const frames = await this.r.mGet(top.map((m) => kEcho(m.member)));
    const out: { day: number; floor: number; framesB64: string }[] = [];
    for (const framesB64 of frames) {
      if (framesB64 !== null) out.push({ day, floor, framesB64 });
    }
    return out;
  }
}
