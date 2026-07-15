// src/server/data/runs.ts — RunRepo: the one-candle-per-day state machine (08 §1.10, §3).
//
// uv:run:{uid}:{d}  hash  token,phase,day,startTs,lastActTs,ticks,lastHash,log,floor,
//                         floorEnteredTs(json),learned(json),bankedKeys(json),wax,posX,posY,epitaph
//
// Atomicity: watch/multi/exec in claimStart (one-winner creation); thereafter a
// single hSet per batch — the token holder is the only writer (invariant 10).

import { RUN_EXPIRY_MS, RUN_TTL_S, KEY } from "../core/constants.js";
import type { RedisLike } from "./redis.js";

export type RunPhase = "active" | "banked" | "done"; // "issued" collapses into the start txn (C3)

export interface RunRow {
  token: string;
  phase: RunPhase;
  day: number;
  startTs: number;
  lastActTs: number;
  ticks: number; // total steps applied
  lastHash: string; // h32Hex at last verified checkpoint ("" until first)
  log: string; // b64 of ALL packed segments re-framed as ONE pack.ts frame (§1.10 log note)
  floor: number;
  floorEnteredTs: number[]; // index = floor (1-based; [0] unused = 0)
  learned: { key: string; effect: number }[]; // server-verified from replay.consulted + corpse yields
  bankedKeys: string[];
  wax: number;
  posX: number;
  posY: number; // observability mirror, never an input
  epitaph: string; // JSON.stringify(EndRes) once phase === "done", else ""
}

const kRun = (uid: string, d: number): string => `${KEY}run:${uid}:${d}`;

function toFields(row: RunRow): Record<string, string> {
  return {
    token: row.token,
    phase: row.phase,
    day: String(row.day),
    startTs: String(row.startTs),
    lastActTs: String(row.lastActTs),
    ticks: String(row.ticks),
    lastHash: row.lastHash,
    log: row.log,
    floor: String(row.floor),
    floorEnteredTs: JSON.stringify(row.floorEnteredTs),
    learned: JSON.stringify(row.learned),
    bankedKeys: JSON.stringify(row.bankedKeys),
    wax: String(row.wax),
    posX: String(row.posX),
    posY: String(row.posY),
    epitaph: row.epitaph,
  };
}

function fromFields(h: Record<string, string>): RunRow | null {
  const token = h.token;
  if (token === undefined) return null;
  const phase = h.phase;
  return {
    token,
    phase: phase === "banked" || phase === "done" ? phase : "active",
    day: Number.parseInt(h.day ?? "0", 10),
    startTs: Number.parseInt(h.startTs ?? "0", 10),
    lastActTs: Number.parseInt(h.lastActTs ?? "0", 10),
    ticks: Number.parseInt(h.ticks ?? "0", 10),
    lastHash: h.lastHash ?? "",
    log: h.log ?? "",
    floor: Number.parseInt(h.floor ?? "1", 10),
    floorEnteredTs: JSON.parse(h.floorEnteredTs ?? "[0]") as number[],
    learned: JSON.parse(h.learned ?? "[]") as { key: string; effect: number }[],
    bankedKeys: JSON.parse(h.bankedKeys ?? "[]") as string[],
    wax: Number.parseInt(h.wax ?? "0", 10),
    posX: Number.parseInt(h.posX ?? "0", 10),
    posY: Number.parseInt(h.posY ?? "0", 10),
    epitaph: h.epitaph ?? "",
  };
}

export class RunRepo {
  constructor(private readonly r: RedisLike) {}

  /**
   * One-candle-per-day claim (invariant 10). watch/multi/exec on uv:run:{uid}:{d}:
   * absent → write `row` ("new"); existing phase active & not expired → "resume"
   * (caller re-issues the STORED token via load()); else "spent". Sets 26 h TTL.
   * `row.startTs` doubles as "now" for the expiry check.
   */
  async claimStart(uid: string, day: number, row: RunRow): Promise<"new" | "resume" | "spent"> {
    const key = kRun(uid, day);
    const txn = await this.r.watch(key);
    const existing = await this.r.hGetAll(key); // read on the watched connection (pre-multi)
    if (existing.token !== undefined) {
      await txn.unwatch();
      return this.verdict(existing, row.startTs);
    }
    await txn.multi();
    await txn.hSet(key, toFields(row));
    await txn.expire(key, RUN_TTL_S);
    const res = await txn.exec();
    if (res === null) {
      // lost the one-winner race — the concurrent writer's row now exists
      const after = await this.r.hGetAll(key);
      if (after.token === undefined) return "spent"; // defensive; cannot happen at M2
      return this.verdict(after, row.startTs);
    }
    return "new";
  }

  private verdict(h: Record<string, string>, now: number): "resume" | "spent" {
    const active = h.phase === "active";
    const fresh = now - Number.parseInt(h.startTs ?? "0", 10) <= RUN_EXPIRY_MS;
    return active && fresh ? "resume" : "spent";
  }

  async load(uid: string, day: number): Promise<RunRow | null> {
    return fromFields(await this.r.hGetAll(kRun(uid, day)));
  }

  /** Full-row hSet (the log grows monotonically; single writer = token holder). */
  async save(uid: string, day: number, row: RunRow): Promise<void> {
    await this.r.hSet(kRun(uid, day), toFields(row));
  }

  /** Wipe a user's run for a day so the one-candle claim starts fresh — the
   *  moderator "reset my candle" dev tool (D120). The corpse/fallen count are
   *  left as-is; only the candle gate (this key) is cleared. */
  async clearRun(uid: string, day: number): Promise<void> {
    await this.r.del(kRun(uid, day));
  }

  /** Convenience: row.ticks += addedSteps then save — single hSet round-trip. */
  async appendLogAndSave(uid: string, day: number, row: RunRow, addedSteps: number): Promise<void> {
    row.ticks += addedSteps;
    await this.save(uid, day, row);
  }
}
