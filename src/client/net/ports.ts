/**
 * Client-side ports v2. The client NEVER resolves secret rules, never holds
 * the day seed, and never owns persistence — it asks the ports. Dev slice:
 * dev/rules-adapter.ts (in-memory session, DEV-ONLY). M2: net/api.ts over
 * /api/* with Redis behind it (same shapes).
 */

import type { FloorData, OmenMods, SimState } from "../../shared/sim/types.js";

export interface FloorPayloadLike {
  floorData: FloorData;
  rngInit: Uint32Array;
  /** echoes to ghost-play on this floor (client-side only) */
  echoes: EchoRecord[];
}

export interface LearnedRule {
  key: string;
  effect: number;
}

export interface CorpseGift {
  item: number;
  charges: number;
}

export interface EchoRecord {
  day: number;
  floor: number;
  frames: { x: number; y: number; candle: number }[];
}

export interface CodexEntryRec {
  ruleKey: string;
  subject: string;
  text: string;
  status: "pending" | "true" | "conditional" | "inked" | "disproven";
  confirms: number;
  day: number;
}

export interface GuildhallModelRec {
  day: number;
  omenRumor: string;
  gatePct: number;
  codexPct: number;
  fallenToday: number;
  houseLine: string;
}

export interface DeathReport {
  day: number;
  floor: number;
  x: number;
  y: number;
  cause: number;
  lastWords: string;
  gift: CorpseGift | null;
  unbanked: LearnedRule[];
  echoFrames: { x: number; y: number; candle: number }[];
}

export interface RunSetup {
  mods: OmenMods;
  heirloom: number;
  noSalt: boolean;
}

export interface GamePorts {
  resolveRule(key: string): number;
  getFloor(floor: number): FloorPayloadLike;
  getRunSetup(): RunSetup;
  getGuildhall(): GuildhallModelRec;
  getCodex(): CodexEntryRec[];
  /** bank ≤3 learned rules at a waystone; returns their new codex entries */
  bankClaims(claims: LearnedRule[]): CodexEntryRec[];
  /** passive confirmations: re-observed known rules tick the counters */
  confirmObservations(keys: string[]): void;
  reportDeath(report: DeathReport): void;
  reportExit(): void;
  /** shared day-state writes (braziers gift forward, glowmoss is forever) */
  brazierLit(floor: number, tileIndex: number): void;
  glowmossPlanted(floor: number, tileIndex: number): void;
  signPlaced(floor: number, tileIndex: number, template: number, noun: number): void;
  getSigns(floor: number): { tileIndex: number; template: number; noun: number }[];
  chalkChanged(floor: number, chalk: Uint8Array): void;
  corpseRecovered(corpseRef: number): { unbanked: LearnedRule[]; gift: CorpseGift | null };
  nextDay(): void;
  /** lineage */
  getHouse(): string | null;
  setHouse(name: string): void;
  /** post the run's epitaph as a Reddit comment; resolves true on success.
   *  Optional: only the remote (hosted) ports implement it. */
  shareEpitaph?: () => Promise<boolean>;
  heirloomDue(): boolean;
  pickHeirloom(id: number): void;

  // ---- M2b remote seams (08 §7) — absent in the dev adapter; when a method
  // is missing the driver uses the synchronous path above. The sim never
  // sees these: every async gap lives in the driver between ticks.
  /** unknown rule: flush the act batch, return the server-resolved effect */
  resolveRuleAsync?(key: string): Promise<number>;
  /** speculative next-floor prefetch on stairs touch (idempotent server-side) */
  prefetchFloor?(floor: number): void;
  /** awaited inside the descend fade — serves the prefetch, or fetches now */
  getFloorAsync?(floor: number): Promise<FloorPayloadLike>;
  /** every action applied to the local sim, in order — feeds the act batcher */
  actApplied?(op: number, arg: number, atTick: number): void;
  bankClaimsAsync?(claims: LearnedRule[]): Promise<CodexEntryRec[]>;
  reportDeathAsync?(report: DeathReport): Promise<void>;
  reportExitAsync?(): Promise<void>;
  /**
   * Mid-run resume (mobile webviews die on app-switch; a reload must not
   * void the candle). Non-null when the server replayed a live run for this
   * session: the driver adopts `state` instead of a fresh initState, seeds
   * its rule table with `learned` (all bankable again) and `banked` (keys
   * already committed). CONSUMED ON READ — returns null ever after, so a
   * post-run scene restart can never re-adopt a stale state.
   */
  getResume?(): { state: SimState; floor: FloorPayloadLike; learned: LearnedRule[]; banked: string[] } | null;
}

/** Session-learned rule cache (02 §4). */
export class SessionRules {
  private readonly cache = new Map<string, number>();
  readonly learned: LearnedRule[] = [];
  /**
   * Known rules the sim consulted since the last drain — the "passive
   * re-observation" feed for confirmObservations (a key learned in run 1
   * never re-enters `learned`, so without this the codex could never reach
   * the ink threshold). D64
   */
  private touched = new Set<string>();

  get(key: string): number | undefined {
    const eff = this.cache.get(key);
    if (eff !== undefined) this.touched.add(key);
    return eff;
  }

  set(key: string, effect: number): void {
    if (!this.cache.has(key)) this.learned.push({ key, effect });
    this.cache.set(key, effect);
  }

  /** Keys re-observed since the last call; clears the slate. */
  drainTouched(): string[] {
    const out = [...this.touched].sort();
    this.touched.clear();
    return out;
  }
}
