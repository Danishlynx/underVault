// src/server/data/codex.ts — CodexRepo: claims, confirms, inking (08 §1.10, §3).
//
// uv:rule:{hash}:confirms zset    member=uid, score=day — zCard = distinct confirmers
// uv:claim:{hash}         hash    CodexRow: ruleKey,effect,status,confirms,day,discoverer
// uv:claims:byRule:{hash} string  discoverer uid — first-credit dedupe pointer (watch/multi)
// uv:codex:inked          zset    member=ruleHash, score=inkDay
//
// Structured entries only — subject/text derive client-side via describeRuleKey (C8).

import { xxhash32 } from "../../shared/sim/pack.js";
import { INK_AT, KEY } from "../core/constants.js";
import type { RedisLike } from "./redis.js";

export interface CodexRow {
  ruleKey: string;
  effect: number;
  status: "conditional" | "true" | "inked" | "disproven";
  confirms: number;
  day: number;
  discoverer: string;
}

const utf8 = new TextEncoder();

export function ruleHash(key: string): string {
  return (xxhash32(utf8.encode(key), 0) >>> 0).toString(16).padStart(8, "0");
}

const kConfirms = (h: string): string => `${KEY}rule:${h}:confirms`;
const kClaim = (h: string): string => `${KEY}claim:${h}`;
const kByRule = (h: string): string => `${KEY}claims:byRule:${h}`;
const kInked = `${KEY}codex:inked`;

function parseStatus(s: string | undefined): CodexRow["status"] {
  return s === "conditional" || s === "inked" || s === "disproven" ? s : "true";
}

function rowFromFields(h: Record<string, string>): CodexRow | null {
  const ruleKey = h.ruleKey;
  if (ruleKey === undefined) return null;
  return {
    ruleKey,
    effect: Number.parseInt(h.effect ?? "0", 10),
    status: parseStatus(h.status),
    confirms: Number.parseInt(h.confirms ?? "0", 10),
    day: Number.parseInt(h.day ?? "0", 10),
    discoverer: h.discoverer ?? "",
  };
}

export class CodexRepo {
  constructor(private readonly r: RedisLike) {}

  /** First-credit via watch/multi on the string pointer (08 §3) — returns the discoverer uid. */
  private async firstCredit(hash: string, uid: string): Promise<string> {
    const key = kByRule(hash);
    const txn = await this.r.watch(key);
    const existing = await this.r.get(key);
    if (existing !== undefined) {
      await txn.unwatch();
      return existing;
    }
    await txn.multi();
    await txn.set(key, uid);
    const res = await txn.exec();
    if (res !== null) return uid;
    return (await this.r.get(key)) ?? uid; // lost the race — the winner's uid is now there
  }

  /** zAdd score=inkDay; guarded so a rule's ink day never moves once set. */
  private async inkOnce(hash: string, day: number): Promise<void> {
    const already = await this.r.zScore(kInked, hash);
    if (already === undefined) await this.r.zAdd(kInked, { member: hash, score: day });
  }

  /**
   * Bank claims (02 §4 transactional first-credit). Per claim: confirm zAdd is
   * (uid, day)-idempotent; confirms = zCard (distinct confirmers); status
   * conditional iff subject ∈ conditionalSubjects else "true"; ink at INK_AT.
   * Single-command atomics only (plus the watch/multi first-credit pointer).
   */
  async bank(
    uid: string,
    day: number,
    claims: { key: string; effect: number }[],
    conditionalSubjects: readonly string[],
  ): Promise<CodexRow[]> {
    const out: CodexRow[] = [];
    const seen = new Set<string>();
    for (const claim of claims) {
      if (seen.has(claim.key)) continue; // dedupe by ruleKey (08 §2)
      seen.add(claim.key);
      const hash = ruleHash(claim.key);

      const discoverer = await this.firstCredit(hash, uid);
      await this.r.zAdd(kConfirms(hash), { member: uid, score: day });
      const confirms = await this.r.zCard(kConfirms(hash));

      const existing = rowFromFields(await this.r.hGetAll(kClaim(hash)));
      const subject = claim.key.split("|")[0] ?? "?";
      const base: CodexRow["status"] = conditionalSubjects.includes(subject)
        ? "conditional"
        : "true";
      const prior = existing?.status ?? base;
      const status: CodexRow["status"] =
        prior === "disproven" ? "disproven" : confirms >= INK_AT ? "inked" : prior;

      const row: CodexRow = {
        ruleKey: claim.key,
        effect: existing?.effect ?? claim.effect,
        status,
        confirms,
        day: existing?.day ?? day, // discovery day is sticky
        discoverer,
      };
      await this.r.hSet(kClaim(hash), {
        ruleKey: row.ruleKey,
        effect: String(row.effect),
        status: row.status,
        confirms: String(row.confirms),
        day: String(row.day),
        discoverer: row.discoverer,
      });
      if (status === "inked") await this.inkOnce(hash, day);
      out.push(row);
    }
    return out;
  }

  /** zAdd confirms only for EXISTING rule hashes (drive-by observations never mint claims). */
  async confirmObserved(uid: string, day: number, keys: string[]): Promise<void> {
    for (const key of keys) {
      const hash = ruleHash(key);
      if ((await this.r.exists(kClaim(hash))) === 0) continue;
      await this.r.zAdd(kConfirms(hash), { member: uid, score: day });
      const confirms = await this.r.zCard(kConfirms(hash));
      const status = parseStatus(await this.r.hGet(kClaim(hash), "status"));
      if (status !== "inked" && status !== "disproven" && confirms >= INK_AT) {
        await this.r.hSet(kClaim(hash), { confirms: String(confirms), status: "inked" });
        await this.inkOnce(hash, day);
      } else {
        await this.r.hSet(kClaim(hash), { confirms: String(confirms) });
      }
    }
  }

  /** Pages the inked ledger (zRange by rank) + claim hashes. */
  async page(page: number, size: number): Promise<{ rows: CodexRow[]; total: number }> {
    const total = await this.r.zCard(kInked);
    const start = page * size;
    const members = await this.r.zRange(kInked, start, start + size - 1);
    const rows: CodexRow[] = [];
    for (const m of members) {
      const row = rowFromFields(await this.r.hGetAll(kClaim(m.member)));
      if (row !== null) rows.push(row);
    }
    return { rows, total };
  }

  async inkedCount(): Promise<number> {
    return this.r.zCard(kInked);
  }

  /** uv:codexcache:{page} — 60 s response cache for GET /api/codex (08 §2/§3). Additive M2 helper. */
  async getCache(page: number): Promise<string | undefined> {
    return this.r.get(`${KEY}codexcache:${page}`);
  }

  /** Store the serialized CodexRes for a page; 60 s TTL per 08 §3. Additive M2 helper. */
  async setCache(page: number, json: string): Promise<void> {
    const key = `${KEY}codexcache:${page}`;
    await this.r.set(key, json);
    await this.r.expire(key, 60);
  }

  /** RULES.length exposed via the day-meta ruleTotal field written at mint (08 §3) — for codexPct. */
  async totalRules(): Promise<number> {
    const cur = await this.r.get(`${KEY}day:current`);
    if (cur === undefined) return 0;
    const total = await this.r.hGet(`${KEY}day:${Number.parseInt(cur, 10)}:meta`, "ruleTotal");
    return total === undefined ? 0 : Number.parseInt(total, 10);
  }
}
