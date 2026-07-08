/**
 * The slice's DOM sheets: Waystone banking (stub — 04 §4.4), Epitaph
 * ceremony (04 §4.5, condensed), and the retreat/exit sheet. Copy from the
 * 04 §7 deck. Claim engine is M4 scope; the COMMIT seal stays sealed.
 */

import { el, openSheet } from "./dom.js";
import type { LearnedRule } from "../net/ports.js";
import { DeathCause, Effect, type SimState } from "../../shared/sim/types.js";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const SUBJECT_NAME: Record<string, string> = {
  rat: "a Tallow Rat",
  wickworm: "a Wickworm",
  moth: "a Vesper Moth",
  beast: "the Chandler Beast",
};
const VERB_NAME: Record<string, string> = {
  bump: "struck",
  fire: "touched by fire",
  "in-aura": "bathed in brazier-light",
  "dies-over": "slain over webbing",
};
const EFFECT_NAME: Record<number, string> = {
  [Effect.NONE]: "nothing happened",
  [Effect.DIE]: "it died",
  [Effect.IGNITE_DIE]: "it burst into flame and died",
  [Effect.IMMUNE]: "it did not care",
  [Effect.MELT]: "it melted away",
  [Effect.IGNITE_TILE]: "the ground caught fire",
};

export function describeRule(r: LearnedRule): string {
  const parts = r.key.split("|");
  const subject = SUBJECT_NAME[parts[0] ?? ""] ?? parts[0] ?? "something";
  const verb = VERB_NAME[parts[1] ?? ""] ?? parts[1] ?? "touched";
  const cond = parts[3] === "cupped" ? ", flame cupped" : parts[3] === "snuffed" ? ", in darkness" : "";
  return `${subject} — ${verb}${cond} → ${EFFECT_NAME[r.effect] ?? "…"}`;
}

const CAUSE_LINE: Record<number, string> = {
  [DeathCause.TAKEN_BY_THE_DARK]: "TAKEN BY THE DARK",
  [DeathCause.OWN_FLAME]: "UNDONE BY THEIR OWN FLAME",
  [DeathCause.MELTED_BEFORE_BEAST]: "MELTED BEFORE THE CHANDLER BEAST",
};

export function openWaystoneSheet(
  host: HTMLElement,
  learned: readonly LearnedRule[],
  onClose: () => void,
): () => void {
  const close = openSheet(host, (sheet) => {
    sheet.appendChild(el("h1", "", "WAYSTONE — the Vault listens"));
    const meaningful = learned.filter((r) => r.effect !== Effect.NONE);
    if (meaningful.length === 0) {
      sheet.appendChild(el("p", "uv-dim", "You have nothing new to tell it. Yet."));
    } else {
      const list = el("ul", "uv-list");
      for (const r of meaningful) {
        list.appendChild(el("li", "", describeRule(r)));
      }
      sheet.appendChild(list);
    }
    sheet.appendChild(el("hr", "uv-rule"));
    const seal = el("button", "uv-seal-btn") as HTMLButtonElement;
    seal.disabled = true;
    seal.title = "The Codex opens at M4";
    sheet.appendChild(seal);
    sheet.appendChild(el("span", "uv-seal-label uv-dim", "COMMIT TO THE CODEX"));
    const press = el("button", "uv-ink-btn", "Bank nothing, press on") as HTMLButtonElement;
    press.addEventListener("click", () => {
      close();
      onClose();
    });
    sheet.appendChild(press);
  });
  return close;
}

export interface RunSummary {
  ticks: number;
  discoveries: number;
  floor: number;
  day: number;
}

export function openEpitaphSheet(
  host: HTMLElement,
  state: SimState,
  summary: RunSummary,
  onRestart: () => void,
): () => void {
  const close = openSheet(host, (sheet) => {
    const cause = CAUSE_LINE[state.deathCause] ?? "TAKEN BY THE DARK";
    sheet.appendChild(
      el("div", "uv-cause", `${cause} · FL. ${ROMAN[summary.floor] ?? summary.floor} · DAY ${summary.day}`),
    );
    sheet.appendChild(el("hr", "uv-rule"));
    sheet.appendChild(
      el(
        "p",
        "uv-dim",
        `The candle lasted ${summary.ticks} steps. ${summary.discoveries} truth${summary.discoveries === 1 ? "" : "s"} died unbanked with you.`,
      ),
    );
    const input = el("input", "uv-input") as HTMLInputElement;
    input.maxLength = 100;
    input.placeholder = "Last words, delver?";
    sheet.appendChild(input);
    sheet.appendChild(el("hr", "uv-rule"));
    const seal = el("button", "uv-seal-btn") as HTMLButtonElement;
    seal.addEventListener("click", () => {
      close();
      onRestart();
    });
    sheet.appendChild(seal);
    sheet.appendChild(el("span", "uv-seal-label", "DELVE AGAIN"));
    sheet.appendChild(el("p", "uv-dim", "The Vault reshuffles at dusk. (dev: the same day repeats — fixed seed)"));
  });
  return close;
}

export function openExitSheet(
  host: HTMLElement,
  state: SimState,
  summary: RunSummary,
  onRestart: () => void,
): () => void {
  const close = openSheet(host, (sheet) => {
    sheet.appendChild(el("div", "uv-cause", `INTO THE LIGHT · FL. ${ROMAN[summary.floor] ?? summary.floor} · DAY ${summary.day}`));
    sheet.appendChild(el("hr", "uv-rule"));
    sheet.appendChild(
      el(
        "p",
        "",
        `You climb back to the Guildhall with ${state.wax} wax to spare and ${summary.discoveries} truth${summary.discoveries === 1 ? "" : "s"} worth telling.`,
      ),
    );
    sheet.appendChild(el("p", "uv-dim", "Banking claims opens with the Codex (M4)."));
    const seal = el("button", "uv-seal-btn") as HTMLButtonElement;
    seal.addEventListener("click", () => {
      close();
      onRestart();
    });
    sheet.appendChild(seal);
    sheet.appendChild(el("span", "uv-seal-label", "DELVE AGAIN"));
  });
  return close;
}
