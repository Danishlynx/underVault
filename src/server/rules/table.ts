// src/server/rules/table.ts — ★ SECRET (08 §1.9).
//
// Server-side there are no unknowns: the table ALWAYS answers (Effect.NONE
// for unmatched keys), so tick() can never yield RuleRequest during replay.
// Every lookup is recorded into .consulted — that map becomes ActRes.rules
// (the client's cache fill, 02 §4 unknown-interaction resolver).

import rulesData from "./rules.json";
import { resolveRuleKey, omenForSeed, type OmenDay } from "./resolve.js";
import type { RecordingTable } from "../core/replay.js";

/** Static rule count — exposed via the day-meta `ruleTotal` field at mint (for codexPct). */
export const RULE_TOTAL: number = (rulesData as { rules: unknown[] }).rules.length;

/** Fresh instance per request (invariant 8 — no cross-request state). */
export function ruleTableFor(omenId: string): RecordingTable {
  const consulted = new Map<string, number>();
  return {
    consulted,
    get(key: string): number {
      const effect = resolveRuleKey(key, omenId);
      consulted.set(key, effect);
      return effect;
    },
  };
}

/** The omen derives from the independent omenSeed — floor rngInit reveals nothing (02 §7). */
export function omenDayFor(meta: { omenSeed: number; day: number }): OmenDay {
  return omenForSeed(meta.omenSeed, meta.day);
}
