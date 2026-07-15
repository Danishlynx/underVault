// src/server/data/users.ts — UserRepo: houses, lineage, chalk, integrity (08 §1.10, §3).
//
// uv:user:{uid}      hash    house,gen,bestDepth,streak,stubs,heirloom,mute
//                            + chalk:{floor} b64 fields (≤8 floors, evict lowest first)
// uv:integrity:{uid} string  desync counter (incrBy; soft-flag log at ≥ 3, 02 §7)
// uv:lb:depth:{d}    zset    member=uid, score=depth (GT emulated: read zScore, write if greater)
// uv:flair:dirty     zset    member=uid, score=ts (drained by the M3 flair job)

import { fromB64, toB64 } from "../../shared/sim/pack.js";
import { DAY_TTL_S, KEY } from "../core/constants.js";
import type { RedisLike } from "./redis.js";

export interface UserRow {
  house: string;
  gen: number;
  bestDepth: number;
  streak: number;
  stubs: number;
  heirloom: number;
  mute: number;
}

const CHALK_FLOOR_CAP = 8;

const kUser = (uid: string): string => `${KEY}user:${uid}`;
const kIntegrity = (uid: string): string => `${KEY}integrity:${uid}`;
const kLbDepth = (d: number): string => `${KEY}lb:depth:${d}`;
const kFlairDirty = `${KEY}flair:dirty`;
const chalkField = (floor: number): string => `chalk:${floor}`;

export class UserRepo {
  constructor(private readonly r: RedisLike) {}

  /** Defaults for absent fields; a house starts at generation 1 (dev adapter parity). */
  async get(uid: string): Promise<UserRow> {
    const h = await this.r.hGetAll(kUser(uid));
    return {
      house: h.house ?? "",
      gen: h.gen === undefined ? 1 : Number.parseInt(h.gen, 10),
      bestDepth: Number.parseInt(h.bestDepth ?? "0", 10),
      streak: Number.parseInt(h.streak ?? "0", 10),
      stubs: Number.parseInt(h.stubs ?? "0", 10),
      heirloom: Number.parseInt(h.heirloom ?? "0", 10),
      mute: Number.parseInt(h.mute ?? "0", 10),
    };
  }

  /** hSetNX house — first write wins; returns the house actually on record. */
  async ensureHouse(uid: string, seedName: string): Promise<string> {
    await this.r.hSetNX(kUser(uid), "house", seedName);
    return (await this.r.hGet(kUser(uid), "house")) ?? seedName;
  }

  /** gen++, bestDepth max, zAdd lb:depth:{d} (GT emulated), flair:dirty mark. */
  async onDeath(uid: string, day: number, depth: number): Promise<UserRow> {
    const key = kUser(uid);
    // hIncrBy from an absent field counts from 0, but the default gen is 1
    // (get() above) — first death lands the heir at generation 2. One candle
    // per day ⇒ no concurrent deaths per uid, so the fix-up write is safe.
    const bumped = await this.r.hIncrBy(key, "gen", 1);
    if (bumped === 1) await this.r.hIncrBy(key, "gen", 1);

    const best = Number.parseInt((await this.r.hGet(key, "bestDepth")) ?? "0", 10);
    if (depth > best) await this.r.hSet(key, { bestDepth: String(depth) });

    const lb = kLbDepth(day);
    const prev = await this.r.zScore(lb, uid);
    if (prev === undefined || depth > prev) {
      await this.r.zAdd(lb, { member: uid, score: depth });
      await this.r.expire(lb, DAY_TTL_S);
    }

    await this.r.zAdd(kFlairDirty, { member: uid, score: Date.now() }); // ts metadata, never sim input

    return this.get(uid);
  }

  async getChalk(uid: string, floor: number): Promise<Uint8Array | null> {
    const b64 = await this.r.hGet(kUser(uid), chalkField(floor));
    return b64 === undefined ? null : fromB64(b64);
  }

  /** Cap CHALK_FLOOR_CAP chalk fields per user; evict lowest floor first. */
  async setChalk(uid: string, floor: number, chalk: Uint8Array): Promise<void> {
    const key = kUser(uid);
    await this.r.hSet(key, { [chalkField(floor)]: toB64(chalk) });
    const all = await this.r.hGetAll(key);
    const floors: number[] = [];
    for (const field of Object.keys(all)) {
      if (field.startsWith("chalk:")) floors.push(Number.parseInt(field.slice(6), 10));
    }
    if (floors.length <= CHALK_FLOOR_CAP) return;
    floors.sort((a, b) => a - b);
    const evict = floors.slice(0, floors.length - CHALK_FLOOR_CAP);
    await this.r.hDel(key, evict.map(chalkField));
  }

  /** incrBy integrity:{uid}; soft-flag log at >= 3 (02 §7). */
  async bumpIntegrity(uid: string): Promise<number> {
    const n = await this.r.incrBy(kIntegrity(uid), 1);
    if (n >= 3) {
      console.warn(`[integrity] uid=${uid} desync count ${n} — soft-flagged (02 §7)`);
    }
    return n;
  }
}
