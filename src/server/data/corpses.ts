// src/server/data/corpses.ts — CorpseRepo: 72 h corpse lifetime, score-driven GC (08 §1.10, §3).
//
// uv:corpse:{id}     hash  CorpseRow; id = `{day}-{uid}` — one death per user per day
// uv:corpses:{floor} zset  member=corpseId, score=expiryTs
//
// The corpse hash carries NO EXPIRE — the zset index must outlive lazily so
// ts-pinned replays stay reproducible; GC removes rows only when
// expiryTs < now − GC_GRACE_S (08 §1.7/§0.3). Never key-scan: the per-floor
// zset IS the index, and floors are a fixed 1..MAX_FLOOR range.

import { MAX_FLOOR } from "../../shared/sim/constants.js";
import { GC_GRACE_S, KEY } from "../core/constants.js";
import type { RedisLike } from "./redis.js";

export interface CorpseRow {
  id: string; // `${day}-${uid}` — one death per user per day
  uid: string;
  house: string;
  gen: number;
  day: number;
  floor: number;
  x: number;
  y: number;
  words: string;
  gift: { item: number; charges: number } | null;
  unbanked: { key: string; effect: number }[];
  vigils: number;
  recoveredBy: string; // "" until first recovery
  createdTs: number;
  expiryTs: number; // = createdTs + CORPSE_TTL_S*1000
}

const kCorpse = (id: string): string => `${KEY}corpse:${id}`;
const kIndex = (floor: number): string => `${KEY}corpses:${floor}`;

function toFields(c: CorpseRow): Record<string, string> {
  return {
    id: c.id,
    uid: c.uid,
    house: c.house,
    gen: String(c.gen),
    day: String(c.day),
    floor: String(c.floor),
    x: String(c.x),
    y: String(c.y),
    words: c.words,
    gift: JSON.stringify(c.gift),
    unbanked: JSON.stringify(c.unbanked),
    vigils: String(c.vigils),
    recoveredBy: c.recoveredBy,
    createdTs: String(c.createdTs),
    expiryTs: String(c.expiryTs),
  };
}

function fromFields(h: Record<string, string>): CorpseRow | null {
  const id = h.id;
  if (id === undefined) return null;
  return {
    id,
    uid: h.uid ?? "",
    house: h.house ?? "",
    gen: Number.parseInt(h.gen ?? "1", 10),
    day: Number.parseInt(h.day ?? "0", 10),
    floor: Number.parseInt(h.floor ?? "1", 10),
    x: Number.parseInt(h.x ?? "0", 10),
    y: Number.parseInt(h.y ?? "0", 10),
    words: h.words ?? "",
    gift: JSON.parse(h.gift ?? "null") as { item: number; charges: number } | null,
    unbanked: JSON.parse(h.unbanked ?? "[]") as { key: string; effect: number }[],
    vigils: Number.parseInt(h.vigils ?? "0", 10),
    recoveredBy: h.recoveredBy ?? "",
    createdTs: Number.parseInt(h.createdTs ?? "0", 10),
    expiryTs: Number.parseInt(h.expiryTs ?? "0", 10),
  };
}

export class CorpseRepo {
  constructor(private readonly r: RedisLike) {}

  /** Hash write + zAdd index (score = expiryTs). Naturally idempotent per id. */
  async put(c: CorpseRow): Promise<void> {
    await this.r.hSet(kCorpse(c.id), toFields(c));
    await this.r.zAdd(kIndex(c.floor), { member: c.id, score: c.expiryTs });
  }

  async get(id: string): Promise<CorpseRow | null> {
    return fromFields(await this.r.hGetAll(kCorpse(id)));
  }

  /**
   * Ts-pinned visibility (08 §1.7): createdTs <= pinTs < expiryTs, sorted by
   * id (string compare) so composition is deterministic for the run lifetime.
   */
  async listForFloor(floor: number, pinTs: number): Promise<CorpseRow[]> {
    // score = expiryTs; integer ms timestamps ⇒ "> pinTs" == ">= pinTs + 1" (inclusive range)
    const live = await this.r.zRange(kIndex(floor), pinTs + 1, Number.MAX_SAFE_INTEGER, {
      by: "score",
    });
    const out: CorpseRow[] = [];
    for (const m of live) {
      const row = await this.get(m.member);
      if (row !== null && row.createdTs <= pinTs && pinTs < row.expiryTs) out.push(row);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  /** watch/multi on recoveredBy — one winner (D51). Same-uid retry stays true. */
  async claimRecovery(id: string, uid: string): Promise<boolean> {
    const key = kCorpse(id);
    const txn = await this.r.watch(key);
    const current = await this.r.hGet(key, "recoveredBy");
    if (current === undefined) {
      await txn.unwatch();
      return false; // no such corpse
    }
    if (current !== "") {
      await txn.unwatch();
      return current === uid; // idempotent for the winner, false for everyone else
    }
    await txn.multi();
    await txn.hSet(key, { recoveredBy: uid });
    return (await txn.exec()) !== null;
  }

  /** Removes corpses with expiryTs < now − GC_GRACE_S (job lands M3; method ships now). */
  async gcExpired(now: number): Promise<number> {
    const cutoff = now - GC_GRACE_S * 1000;
    let removed = 0;
    for (let floor = 1; floor <= MAX_FLOOR; floor++) {
      const idx = kIndex(floor);
      // strictly-less-than cutoff on integer ms scores ⇒ inclusive stop at cutoff − 1
      const dead = await this.r.zRange(idx, 0, cutoff - 1, { by: "score" });
      if (dead.length === 0) continue;
      const ids = dead.map((m) => m.member);
      await this.r.zRem(idx, ids);
      await this.r.del(...ids.map(kCorpse));
      removed += ids.length;
    }
    return removed;
  }
}
