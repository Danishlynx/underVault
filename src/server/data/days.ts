// src/server/data/days.ts — DayRepo (08 §1.10, keys per §3).
//
// uv:day:current            string  current day number
// uv:day:{d}:meta           hash    seedHi,seedLo,omenSeed (server-only), postId, createdTs, fallen, ruleTotal
// uv:day:{d}:shared:{floor} hash    field tileIndex → "kind,uid,ts" (hSetNX — first writer wins)
// uv:day:{d}:signs:{floor}  hash    field tileIndex → "template,noun,uid,ts,votes" (hSetNX)

import { DAY_TTL_S, KEY } from "../core/constants.js";
import type { RedisLike } from "./redis.js";

export interface DayMeta {
  day: number;
  seedHi: number;
  seedLo: number;
  omenSeed: number;
  postId: string;
  createdTs: number;
}

export interface SharedEntry {
  tileIndex: number;
  kind: 1 | 2; // 1 = brazier lit, 2 = glowmoss planted
  uid: string;
  ts: number;
}

export interface SignEntry {
  signId: string;
  tileIndex: number;
  template: number;
  noun: number;
  uid: string;
  ts: number;
  votes: number;
}

const kCurrent = `${KEY}day:current`;
const kSeason = `${KEY}season`; // permanent hash — the Long Rescue outlives every day (D105)
const kMeta = (d: number): string => `${KEY}day:${d}:meta`;
const kShared = (d: number, f: number): string => `${KEY}day:${d}:shared:${f}`;
const kSigns = (d: number, f: number): string => `${KEY}day:${d}:signs:${f}`;

export class DayRepo {
  constructor(private readonly r: RedisLike) {}

  async currentDay(): Promise<number | null> {
    const v = await this.r.get(kCurrent);
    return v === undefined ? null : Number.parseInt(v, 10);
  }

  /** hSetNX one-winner on seedHi; winner fills the row, sets 48 h TTL and advances uv:day:current. */
  async putMeta(m: DayMeta): Promise<boolean> {
    const key = kMeta(m.day);
    const won = await this.r.hSetNX(key, "seedHi", String(m.seedHi));
    if (!won) return false;
    await this.r.hSet(key, {
      day: String(m.day),
      seedLo: String(m.seedLo),
      omenSeed: String(m.omenSeed),
      postId: m.postId,
      createdTs: String(m.createdTs),
    });
    await this.r.expire(key, DAY_TTL_S);
    const cur = await this.r.get(kCurrent);
    if (cur === undefined || m.day > Number.parseInt(cur, 10)) {
      await this.r.set(kCurrent, String(m.day));
    }
    return true;
  }

  async getMeta(day: number): Promise<DayMeta | null> {
    const h = await this.r.hGetAll(kMeta(day));
    if (h.seedHi === undefined) return null;
    return {
      day,
      seedHi: Number.parseInt(h.seedHi, 10),
      seedLo: Number.parseInt(h.seedLo ?? "0", 10),
      omenSeed: Number.parseInt(h.omenSeed ?? "0", 10),
      postId: h.postId ?? "",
      createdTs: Number.parseInt(h.createdTs ?? "0", 10),
    };
  }

  async getShared(day: number, floor: number): Promise<SharedEntry[]> {
    const h = await this.r.hGetAll(kShared(day, floor));
    const out: SharedEntry[] = [];
    for (const [field, packed] of Object.entries(h)) {
      const [kind, uid, ts] = packed.split(",");
      out.push({
        tileIndex: Number.parseInt(field, 10),
        kind: Number.parseInt(kind ?? "1", 10) === 2 ? 2 : 1,
        uid: uid ?? "",
        ts: Number.parseInt(ts ?? "0", 10),
      });
    }
    out.sort((a, b) => a.tileIndex - b.tileIndex); // deterministic composition order (08 §1.7)
    return out;
  }

  /** hSetNX per tileIndex — first writer wins (deterministic under ts-pinning). */
  async addShared(day: number, floor: number, e: SharedEntry): Promise<void> {
    const key = kShared(day, floor);
    const won = await this.r.hSetNX(key, String(e.tileIndex), `${e.kind},${e.uid},${e.ts}`);
    if (won) await this.r.expire(key, DAY_TTL_S);
  }

  async getSigns(day: number, floor: number): Promise<SignEntry[]> {
    const h = await this.r.hGetAll(kSigns(day, floor));
    const out: SignEntry[] = [];
    for (const [field, packed] of Object.entries(h)) {
      const [template, noun, uid, ts, votes] = packed.split(",");
      const tileIndex = Number.parseInt(field, 10);
      out.push({
        // §3 stores no signId per field — it is synthesized deterministically
        signId: `${day}-${floor}-${tileIndex}`,
        tileIndex,
        template: Number.parseInt(template ?? "0", 10),
        noun: Number.parseInt(noun ?? "0", 10),
        uid: uid ?? "",
        ts: Number.parseInt(ts ?? "0", 10),
        votes: Number.parseInt(votes ?? "0", 10),
      });
    }
    out.sort((a, b) => a.tileIndex - b.tileIndex);
    return out;
  }

  /** hSetNX per tile — first writer wins; votes bump via hIncrBy lands M3. */
  async addSign(day: number, floor: number, s: SignEntry): Promise<void> {
    const key = kSigns(day, floor);
    const won = await this.r.hSetNX(
      key,
      String(s.tileIndex),
      `${s.template},${s.noun},${s.uid},${s.ts},${s.votes}`,
    );
    if (won) await this.r.expire(key, DAY_TTL_S);
  }

  async bumpFallen(day: number): Promise<number> {
    return this.r.hIncrBy(kMeta(day), "fallen", 1);
  }

  // ── The Long Rescue (D105): every victory = one candle given to her ──────

  /** Idempotency rides the caller: finalizeRun's phase transition fires once. */
  async addGift(): Promise<number> {
    return this.r.hIncrBy(kSeason, "gifts", 1);
  }

  /** Candles given this season (0 when unset). Never expires, never resets. */
  async giftCount(): Promise<number> {
    const v = await this.r.hGet(kSeason, "gifts");
    return v === undefined ? 0 : Number.parseInt(v, 10);
  }

  // ── additive M2 readers/writers (http routes need them; 08 §1.10 lists no
  //    reader for the meta `fallen`/`ruleTotal`/`postId` fields — flagged in PR) ──

  /** Today's death toll — the meta hash `fallen` counter (0 when unset). */
  async getFallen(day: number): Promise<number> {
    const v = await this.r.hGet(kMeta(day), "fallen");
    return v === undefined ? 0 : Number.parseInt(v, 10);
  }

  /** RULES.length exposed server-only at mint (08 §3 meta.ruleTotal — for codexPct). */
  async setRuleTotal(day: number, total: number): Promise<void> {
    await this.r.hSet(kMeta(day), { ruleTotal: String(total) });
  }

  /** Post id write-back after the mint winner submits the daily post. */
  async setPostId(day: number, postId: string): Promise<void> {
    await this.r.hSet(kMeta(day), { postId });
  }
}
