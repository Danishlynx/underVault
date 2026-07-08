/**
 * ★ SECRET rule resolver. Server-side only (M2: behind /api/run/act).
 * In the dev slice it is reached exclusively through dev/rules-adapter.ts
 * (marked DEV-ONLY). tools/no-secret-leak fails the build if anything under
 * src/client or src/shared imports this module.
 */

import rulesData from "./rules.json";
import { Effect } from "../../shared/sim/types.js";

interface RuleJson {
  id: string;
  subject: string;
  interaction: string;
  object: string;
  effect: string;
  condition?: { candle?: string };
  layer: number;
}

const EFFECT_BY_NAME: Record<string, number> = {
  none: Effect.NONE,
  die: Effect.DIE,
  "ignite-die": Effect.IGNITE_DIE,
  immune: Effect.IMMUNE,
  melt: Effect.MELT,
  "ignite-tile": Effect.IGNITE_TILE,
};

const RULES: readonly RuleJson[] = (rulesData as { rules: RuleJson[] }).rules;

/**
 * Resolve a sim rule query key `subject|verb|object|cond` to an effect id.
 * First matching rule wins (condition-specific rules are listed before
 * wildcards in rules.json). Unknown interactions resolve to NONE — "the
 * Vault does not answer".
 */
export function resolveRuleKey(key: string): number {
  const parts = key.split("|");
  if (parts.length !== 4) return Effect.NONE;
  const subject = parts[0]!;
  const verb = parts[1]!;
  const object = parts[2]!;
  const cond = parts[3]!;
  for (const rule of RULES) {
    if (rule.subject !== subject || rule.interaction !== verb || rule.object !== object) continue;
    const wantCandle = rule.condition?.candle;
    if (wantCandle !== undefined && wantCandle !== cond) continue;
    return EFFECT_BY_NAME[rule.effect] ?? Effect.NONE;
  }
  return Effect.NONE;
}
