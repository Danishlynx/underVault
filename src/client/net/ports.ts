/**
 * Client-side ports v2. The client NEVER resolves secret rules, never holds
 * the day seed, and never owns persistence — it asks the ports. Dev slice:
 * dev/rules-adapter.ts (in-memory session, DEV-ONLY). M2: net/api.ts over
 * /api/* with Redis behind it (same shapes).
 */

import type { FloorData, OmenMods } from "../../shared/sim/types.js";

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
  heirloomDue(): boolean;
  pickHeirloom(id: number): void;
}

/** Session-learned rule cache (02 §4). */
export class SessionRules {
  private readonly cache = new Map<string, number>();
  readonly learned: LearnedRule[] = [];

  get(key: string): number | undefined {
    return this.cache.get(key);
  }

  set(key: string, effect: number): void {
    if (!this.cache.has(key)) this.learned.push({ key, effect });
    this.cache.set(key, effect);
  }
}
