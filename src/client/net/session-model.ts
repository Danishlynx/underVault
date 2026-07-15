/**
 * src/client/net/session-model.ts — the local hydrated read model (08 §7).
 *
 * Read-model ports (getGuildhall, getCodex, getSigns, getHouse) are hydrated
 * once per surface entry (apiDay, apiCodex, floor payload signContents) and
 * then answered synchronously from this snapshot. Write-behind ports
 * (brazierLit, glowmossPlanted, signPlaced, chalkChanged,
 * confirmObservations) only update this model — the server derives all
 * shared state from the replayed action log (08 §2) and persists chalk at
 * end/bank from the replayed sim state, so nothing here goes over the wire
 * except the confirm queue (drained into zBankReq.confirms).
 *
 * Codex entries arrive structured ({ruleKey, effect, status, confirms, day})
 * and are prettified locally via describeRuleKey (08 C8).
 */

import type { CodexEntryWire, DayRes, EndRes } from "../../shared/protocol.js";
import { DeathCause } from "../../shared/sim/types.js";
import { describeRuleKey } from "../ui/vocab.js";
import type { CodexEntryRec, GuildhallModelRec, LearnedRule } from "./ports.js";

export interface SignRec {
  tileIndex: number;
  template: number;
  noun: number;
}

const NO_HOUSE_LINE = "No house sworn yet — die once to found one.";
/** Server houseLine shape: `⚑ House {name} · {name} {roman} awaits` (day.ts). */
const HOUSE_LINE_RE = /^⚑ House (.+?) · /u;

export function codexWireToRec(e: CodexEntryWire): CodexEntryRec {
  const { subject, text } = describeRuleKey(e.ruleKey, e.effect);
  return {
    ruleKey: e.ruleKey,
    subject,
    text,
    status: e.status,
    confirms: e.confirms,
    day: e.day,
  };
}

export class SessionModel {
  private readonly day: number;
  private readonly teaser: string;
  private readonly gatePct: number;
  private readonly codexPct: number;
  private fallenToday: number;
  private houseLine: string;
  private house: string | null;

  private readonly codex = new Map<string, CodexEntryRec>();
  private readonly confirmQueue = new Set<string>();
  private readonly localSigns = new Map<number, SignRec[]>();
  private readonly chalkByFloor = new Map<number, Uint8Array>();
  private readonly brazierByFloor = new Map<number, Set<number>>();
  private readonly glowmossByFloor = new Map<number, Set<number>>();

  constructor(day: DayRes, codexEntries: readonly CodexEntryWire[]) {
    this.day = day.day;
    this.teaser = day.teaser;
    this.gatePct = day.gatePct;
    this.codexPct = day.codexPct;
    this.fallenToday = day.fallenToday;
    this.houseLine = day.houseLine ?? NO_HOUSE_LINE;
    const m = HOUSE_LINE_RE.exec(this.houseLine);
    this.house = m?.[1] ?? null;
    for (const e of codexEntries) this.codex.set(e.ruleKey, codexWireToRec(e));
  }

  get currentDay(): number {
    return this.day;
  }

  guildhall(): GuildhallModelRec {
    return {
      day: this.day,
      omenRumor: this.teaser,
      gatePct: this.gatePct,
      codexPct: this.codexPct,
      fallenToday: this.fallenToday,
      houseLine: this.houseLine,
    };
  }

  codexList(): CodexEntryRec[] {
    return [...this.codex.values()].map((c) => ({ ...c }));
  }

  /** Server truth from a BankRes entry — overwrites any optimistic row. */
  absorbBanked(e: CodexEntryWire): CodexEntryRec {
    const rec = codexWireToRec(e);
    this.codex.set(rec.ruleKey, rec);
    return { ...rec };
  }

  /**
   * Sync bankClaims façade: show the claim immediately as "pending"; the
   * awaited BankRes (bankClaimsAsync) replaces it with server truth.
   */
  optimisticBank(claims: readonly LearnedRule[]): CodexEntryRec[] {
    const out: CodexEntryRec[] = [];
    for (const claim of claims.slice(0, 3)) {
      const existing = this.codex.get(claim.key);
      if (existing !== undefined) {
        out.push({ ...existing });
        continue;
      }
      const { subject, text } = describeRuleKey(claim.key, claim.effect);
      const rec: CodexEntryRec = {
        ruleKey: claim.key,
        subject,
        text,
        status: "pending",
        confirms: 1,
        day: this.day,
      };
      this.codex.set(claim.key, rec);
      out.push({ ...rec });
    }
    return out;
  }

  queueConfirms(keys: readonly string[]): void {
    for (const k of keys) this.confirmQueue.add(k);
  }

  /** Sorted drain for zBankReq.confirms (max 64 — schema cap). */
  drainConfirms(): string[] {
    const out = [...this.confirmQueue].sort().slice(0, 64);
    this.confirmQueue.clear();
    return out;
  }

  addLocalSign(floor: number, sign: SignRec): void {
    const arr = this.localSigns.get(floor) ?? [];
    arr.push(sign);
    this.localSigns.set(floor, arr);
  }

  /** Floor payload signContents merged with signs placed this session. */
  signsFor(floor: number, fromPayload: readonly SignRec[]): SignRec[] {
    const local = this.localSigns.get(floor) ?? [];
    const seen = new Set<number>();
    const out: SignRec[] = [];
    for (const s of [...fromPayload, ...local]) {
      if (seen.has(s.tileIndex)) continue;
      seen.add(s.tileIndex);
      out.push({ ...s });
    }
    return out;
  }

  setChalk(floor: number, chalk: Uint8Array): void {
    this.chalkByFloor.set(floor, chalk.slice());
  }

  noteBrazier(floor: number, tileIndex: number): void {
    const set = this.brazierByFloor.get(floor) ?? new Set<number>();
    set.add(tileIndex);
    this.brazierByFloor.set(floor, set);
  }

  noteGlowmoss(floor: number, tileIndex: number): void {
    const set = this.glowmossByFloor.get(floor) ?? new Set<number>();
    set.add(tileIndex);
    this.glowmossByFloor.set(floor, set);
  }

  getHouse(): string | null {
    return this.house;
  }

  /**
   * Local only at M2b: no lineage endpoint exists yet (M3 /api/lineage/*).
   * The server keeps its own house record; this satisfies the sync port so
   * the epitaph flow stays coherent within the session.
   */
  setHouse(name: string): void {
    const trimmed = name.trim().slice(0, 20);
    if (this.house === null && trimmed !== "") this.house = trimmed;
  }

  noteEnd(res: EndRes): void {
    if (res.cause !== DeathCause.NONE) this.fallenToday = Math.min(this.fallenToday + 1, 65535);
  }
}
