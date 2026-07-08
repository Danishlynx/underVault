/**
 * ★ SECRET resolvers: rule outcomes + the day's omen. Server-side only
 * (M2: behind /api). In the dev slice these are reached exclusively through
 * dev/rules-adapter.ts (DEV-ONLY). tools/no-secret-leak fails the build if
 * anything under src/client or src/shared imports this module.
 */

import rulesData from "./rules.json";
import omensData from "./omens.json";
import { Effect, DEFAULT_MODS, type OmenMods } from "../../shared/sim/types.js";
import type { GenOptions } from "../../shared/gen/index.js";
import { splitmix32 } from "../../shared/sim/rng.js";

interface RuleJson {
  id: string;
  subject: string;
  interaction: string;
  object: string;
  effect: string;
  condition?: { candle?: string; omen?: string };
  layer: number;
}

const EFFECT_BY_NAME: Record<string, number> = {
  none: Effect.NONE,
  die: Effect.DIE,
  "ignite-die": Effect.IGNITE_DIE,
  immune: Effect.IMMUNE,
  melt: Effect.MELT,
  "ignite-tile": Effect.IGNITE_TILE,
  split: Effect.SPLIT,
  "gas-burst": Effect.GAS_BURST,
  bless: Effect.BLESS,
  recover: Effect.RECOVER,
  alarm: Effect.ALARM,
  steal: Effect.STEAL,
  "pickpocket-ok": Effect.PICKPOCKET_OK,
  hurt: Effect.HURT,
};

const RULES: readonly RuleJson[] = (rulesData as { rules: RuleJson[] }).rules;

export function resolveRuleKey(key: string, omenId = "clearskies"): number {
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
    const wantOmen = rule.condition?.omen;
    if (wantOmen !== undefined && wantOmen !== omenId) continue;
    return EFFECT_BY_NAME[rule.effect] ?? Effect.NONE;
  }
  return Effect.NONE;
}

// ── Omens ──────────────────────────────────────────────────────────────────
interface OmenJson {
  id: string;
  tellHint: string;
  mods: Partial<OmenMods>;
  gen: GenOptions;
  noSalt?: boolean;
  conditionalSubjects: string[];
}

const OMENS: readonly OmenJson[] = (omensData as { omens: OmenJson[] }).omens;

export interface OmenDay {
  id: string;
  tellHint: string;
  mods: OmenMods;
  gen: GenOptions;
  noSalt: boolean;
  conditionalSubjects: readonly string[];
}

/** Deterministic secret omen for a day seed. Day 1 is always clear skies —
 *  the first run teaches verbs, not weather (⚖). */
export function omenForSeed(daySeed: number, day: number): OmenDay {
  let pick = 0;
  if (day > 1) {
    const [r] = splitmix32((daySeed ^ 0x00e5a11) >>> 0);
    pick = 1 + (r % (OMENS.length - 1));
  }
  const o = OMENS[pick]!;
  return {
    id: o.id,
    tellHint: o.tellHint,
    mods: { ...DEFAULT_MODS, ...o.mods },
    gen: o.gen,
    noSalt: o.noSalt === true,
    conditionalSubjects: o.conditionalSubjects,
  };
}
