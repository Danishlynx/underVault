/**
 * Earned-vocabulary rendering (client-safe): subjects, verbs, and effect
 * phrasings are public words — only the MAPPING between them is secret.
 */

import { Effect } from "../../shared/sim/types.js";

export const EFFECT_TEXT: Record<number, string> = {
  [Effect.NONE]: "nothing happened",
  [Effect.DIE]: "it died",
  [Effect.IGNITE_DIE]: "it burst into flame and died",
  [Effect.IMMUNE]: "it did not care",
  [Effect.MELT]: "it melted away",
  [Effect.IGNITE_TILE]: "the ground caught fire",
  [Effect.SPLIT]: "it split in two",
  [Effect.GAS_BURST]: "it burst into spore-gas",
  [Effect.BLESS]: "the wax was replenished",
  [Effect.RECOVER]: "their truths were recovered",
  [Effect.ALARM]: "the floor was alerted",
  [Effect.STEAL]: "it snatched from your pack",
  [Effect.PICKPOCKET_OK]: "his key came away silently",
  [Effect.HURT]: "it was wounded",
};

export const VERB_TEXT: Record<string, string> = {
  bump: "struck",
  fire: "touched by fire",
  "in-aura": "bathed in brazier-light",
  "dies-over": "slain over webbing",
  dies: "on dying",
  reaches: "reaching you",
  pickpocket: "picked at",
  touch: "touched",
};

const PRETTY: Record<string, string> = {
  rat: "a Tallow Rat",
  wickworm: "a Wickworm",
  moth: "a Vesper Moth",
  beast: "the Chandler Beast",
  slime: "a Gloomcap Slime",
  mimic: "a Mirrormaw",
  sporewight: "a Sporewight",
  drowned: "one of the Drownedkin",
  bellhung: "a Bellhung",
  shade: "a Cinder Shade",
  gaslight: "a Gaslight",
  choirless: "one of the Choirless",
  rustling: "a Rustling",
  keeper: "the Lantern-Keeper",
  corpse: "a fallen delver",
  font: "the Nameless Font",
};

export function subjectName(subject: string): string {
  return PRETTY[subject] ?? subject;
}

export function describeRuleKey(key: string, effect: number): { subject: string; text: string } {
  const parts = key.split("|");
  const subject = parts[0] ?? "?";
  const verb = VERB_TEXT[parts[1] ?? ""] ?? parts[1] ?? "?";
  const cond =
    parts[3] === "cupped" ? ", flame cupped" : parts[3] === "snuffed" ? ", in darkness" : "";
  return {
    subject: subjectName(subject),
    text: `${subjectName(subject)}, ${verb}${cond} → ${EFFECT_TEXT[effect] ?? "…"}`,
  };
}

/** Noun list for the sign composer — only what this session has met. */
export function earnedNouns(learnedKeys: readonly string[]): string[] {
  const seen: string[] = [];
  for (const key of learnedKeys) {
    const subject = key.split("|")[0] ?? "";
    const name = PRETTY[subject];
    if (name !== undefined && !seen.includes(name)) seen.push(name);
  }
  return seen;
}
