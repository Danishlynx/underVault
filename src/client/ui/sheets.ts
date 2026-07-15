/**
 * DOM ceremony sheets v2: Waystone banking (pick ≤3 — 01 §10), the Epitaph
 * (04 §4.5: cause · last words · gift · lineage), heirloom pick (gen 3),
 * exit and victory sheets. Copy from the 04 §7 deck.
 */

import { el, openSheet } from "./dom.js";
import type { CorpseGift, LearnedRule } from "../net/ports.js";
import { describeRuleKey } from "./vocab.js";
import { DeathCause, Effect, Heirloom, Item, type SimState } from "../../shared/sim/types.js";
import { ITEM_NAME, BANK_MAX } from "../../shared/sim/constants.js";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  "XXI", "XXII", "XXIII", "XXIV", "XXV"];

const CAUSE_LINE: Record<number, string> = {
  [DeathCause.TAKEN_BY_THE_DARK]: "TAKEN BY THE DARK",
  [DeathCause.OWN_FLAME]: "UNDONE BY THEIR OWN FLAME",
  [DeathCause.MELTED_BEFORE_BEAST]: "MELTED BEFORE THE CHANDLER BEAST",
  [DeathCause.DROWNED]: "DROWNED AMONG THE STACKS",
};

export interface RunSummary {
  ticks: number;
  discoveries: number;
  floor: number;
  day: number;
}

// ── Waystone banking (04 §4.4) ─────────────────────────────────────────────
export function openWaystoneSheet(
  host: HTMLElement,
  bankable: readonly LearnedRule[],
  banksLeftHint: string,
  onCommit: (picked: LearnedRule[]) => void,
  onClose: () => void,
): () => void {
  const close = openSheet(host, (sheet) => {
    sheet.appendChild(el("h1", "", "WAYSTONE: the Vault listens"));
    const meaningful = bankable.filter((r) => r.effect !== Effect.NONE);
    const picked = new Set<string>();
    let seal: HTMLButtonElement | null = null;

    if (meaningful.length === 0) {
      sheet.appendChild(el("p", "uv-dim", "You have nothing new to tell it. Yet."));
    } else {
      sheet.appendChild(el("p", "uv-dim", `Choose up to ${BANK_MAX} truths to commit. ${banksLeftHint}`));
      const list = el("ul", "uv-list");
      for (const r of meaningful) {
        const li = el("li", "", "");
        const label = el("label", "", "");
        const box = el("input", "") as HTMLInputElement;
        box.type = "checkbox";
        box.style.marginRight = "8px";
        box.addEventListener("change", () => {
          if (box.checked) {
            if (picked.size >= BANK_MAX) {
              box.checked = false;
              return;
            }
            picked.add(r.key);
          } else {
            picked.delete(r.key);
          }
          if (seal !== null) seal.disabled = picked.size === 0;
        });
        label.appendChild(box);
        label.appendChild(document.createTextNode(describeRuleKey(r.key, r.effect).text));
        li.appendChild(label);
        list.appendChild(li);
      }
      sheet.appendChild(list);
    }

    sheet.appendChild(el("hr", "uv-rule"));
    seal = el("button", "uv-seal-btn") as HTMLButtonElement;
    seal.disabled = true;
    seal.addEventListener("click", () => {
      const chosen = meaningful.filter((r) => picked.has(r.key));
      close();
      onCommit(chosen);
    });
    sheet.appendChild(seal);
    sheet.appendChild(el("span", "uv-seal-label", "COMMIT TO THE CODEX"));
    const press = el("button", "uv-ink-btn", "Bank nothing, press on") as HTMLButtonElement;
    press.addEventListener("click", () => {
      close();
      onClose();
    });
    sheet.appendChild(press);
  });
  return close;
}

// ── Epitaph (04 §4.5) ──────────────────────────────────────────────────────
export interface EpitaphResult {
  lastWords: string;
  gift: CorpseGift | null;
  houseName: string | null;
}

/** The Zeigarnik panel (D78): what died incomplete, tomorrow's pull. */
export interface UnfinishedBusiness {
  /** unbanked truths, already worded */
  truths: string[];
  /** codex claims one breath from inking ("…, 4/5 confirmations") */
  nearClaims: string[];
  /** the near-miss line ("The stairs down were 4 steps away."), if cruel */
  nearMiss: string | null;
}

export function openEpitaphSheet(
  host: HTMLElement,
  state: SimState,
  summary: RunSummary,
  house: string | null,
  generation: number,
  onDone: (result: EpitaphResult, restAtDusk: boolean) => void,
  unfinished?: UnfinishedBusiness,
  killer?: string,
  onShare?: () => Promise<boolean>,
): () => void {
  const close = openSheet(host, (sheet) => {
    // the death screen NAMES the killer (D98): deaths are the teachers in
    // a knowledge game, "taken by the dark" taught nothing
    const cause =
      state.deathCause === DeathCause.TAKEN_BY_THE_DARK && killer !== undefined
        ? `TAKEN BY ${killer.toUpperCase()}`
        : CAUSE_LINE[state.deathCause] ?? "TAKEN BY THE DARK";
    sheet.appendChild(
      el("div", "uv-cause", `${cause} · FL. ${ROMAN[summary.floor] ?? summary.floor} · DAY ${summary.day}`),
    );
    sheet.appendChild(el("hr", "uv-rule"));
    sheet.appendChild(
      el(
        "p",
        "uv-dim",
        `The candle lasted ${summary.ticks} steps. ${summary.discoveries} unbanked truth${summary.discoveries === 1 ? " lies" : "s lie"} with the body.`,
      ),
    );

    // ── LEFT UNFINISHED (D78): interrupted business outlives the run —
    // research says the open loop, named explicitly, is tomorrow's trigger
    if (
      unfinished !== undefined &&
      (unfinished.truths.length > 0 || unfinished.nearClaims.length > 0 || unfinished.nearMiss !== null)
    ) {
      const head = el("p", "uv-gold", "LEFT UNFINISHED");
      head.style.letterSpacing = "0.18em";
      head.style.fontSize = "12px";
      head.style.marginBottom = "2px";
      sheet.appendChild(head);
      const list = el("ul", "uv-list");
      for (const t of unfinished.truths.slice(0, 3)) {
        list.appendChild(el("li", "uv-dim", `${t}. It lies with your corpse for 72 hours.`));
      }
      for (const c of unfinished.nearClaims.slice(0, 2)) {
        list.appendChild(el("li", "uv-dim", c));
      }
      if (unfinished.nearMiss !== null) {
        const miss = el("li", "", unfinished.nearMiss);
        miss.style.color = "var(--seal)";
        miss.style.fontStyle = "italic";
        list.appendChild(miss);
      }
      sheet.appendChild(list);
    }

    const words = el("input", "uv-input") as HTMLInputElement;
    words.maxLength = 100;
    words.placeholder = "Last words, delver?";
    sheet.appendChild(words);

    // the gift: one carried thing left for whoever finds you (01 §13)
    let gift: CorpseGift | null = null;
    const carried: { item: number; charges: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const item = state.inv[i]!;
      if (item !== Item.NONE && item !== Item.FLINT && state.invCharges[i]! > 0) {
        carried.push({ item, charges: state.invCharges[i]! });
      }
    }
    if (carried.length > 0) {
      sheet.appendChild(el("p", "uv-dim", "Leave a gift on the body:"));
      const row = el("div", "", "");
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.flexWrap = "wrap";
      const buttons: HTMLButtonElement[] = [];
      for (const c of carried) {
        const b = el("button", "uv-ink-btn", ITEM_NAME[c.item] ?? "?") as HTMLButtonElement;
        b.style.display = "inline";
        b.addEventListener("click", () => {
          gift = { item: c.item, charges: c.charges };
          for (const other of buttons) other.style.fontWeight = "normal";
          b.style.fontWeight = "bold";
        });
        row.appendChild(b);
        buttons.push(b);
      }
      sheet.appendChild(row);
    }

    let houseInput: HTMLInputElement | null = null;
    sheet.appendChild(el("hr", "uv-rule"));
    if (house === null) {
      sheet.appendChild(el("p", "", "The Guild asks: what house shall remember you?"));
      houseInput = el("input", "uv-input") as HTMLInputElement;
      houseInput.maxLength = 20;
      houseInput.placeholder = "House name (chosen once, forever)";
      sheet.appendChild(houseInput);
    } else {
      sheet.appendChild(
        el("p", "uv-gold", `The line endures. ${house} ${ROMAN[generation + 1] ?? generation + 1} will wake at dusk.`),
      );
    }

    const finish = (rest: boolean): void => {
      close();
      onDone(
        {
          lastWords: words.value.trim(),
          gift,
          houseName: houseInput !== null && houseInput.value.trim() !== "" ? houseInput.value.trim() : null,
        },
        rest,
      );
    };
    const seal = el("button", "uv-seal-btn") as HTMLButtonElement;
    seal.addEventListener("click", () => finish(true));
    sheet.appendChild(seal);
    sheet.appendChild(el("span", "uv-seal-label", "REST UNTIL DUSK"));
    // the law, stated PLAINLY once (D98): "rest until dusk" alone reads
    // as "back to menu", players must leave knowing the day is spent
    sheet.appendChild(
      el("p", "uv-dim", "One candle a day. Yours is spent. A new candle is cut at dusk, and the Vault deals new laws."),
    );
    // the Reddit hook: post this epitaph as a comment so the fall is shared
    if (onShare !== undefined) {
      const share = el("button", "uv-ink-btn", "Post my epitaph to the feed") as HTMLButtonElement;
      share.addEventListener("click", () => {
        share.disabled = true;
        share.textContent = "Posting…";
        void onShare().then((ok) => {
          share.textContent = ok ? "Posted to the vault's feed ✦" : "Could not reach the feed";
        });
      });
      sheet.appendChild(share);
    }
    const again = el("button", "uv-ink-btn", "Delve again today (dev candle)") as HTMLButtonElement;
    again.addEventListener("click", () => finish(false));
    sheet.appendChild(again);
  });
  return close;
}

// ── Exit / Victory ─────────────────────────────────────────────────────────
export function openExitSheet(
  host: HTMLElement,
  state: SimState,
  summary: RunSummary,
  onDone: (restAtDusk: boolean) => void,
): () => void {
  const close = openSheet(host, (sheet) => {
    sheet.appendChild(el("div", "uv-cause", `INTO THE LIGHT · FL. ${ROMAN[summary.floor] ?? summary.floor} · DAY ${summary.day}`));
    sheet.appendChild(el("hr", "uv-rule"));
    sheet.appendChild(
      el(
        "p",
        "",
        `You climb back to the Guildhall with ${state.wax} wax to spare, ${state.banked} truth${state.banked === 1 ? "" : "s"} banked and ${summary.discoveries} untold.`,
      ),
    );
    const seal = el("button", "uv-seal-btn") as HTMLButtonElement;
    seal.addEventListener("click", () => {
      close();
      onDone(true);
    });
    sheet.appendChild(seal);
    sheet.appendChild(el("span", "uv-seal-label", "REST UNTIL DUSK"));
    const again = el("button", "uv-ink-btn", "Delve again today (dev candle)") as HTMLButtonElement;
    again.addEventListener("click", () => {
      close();
      onDone(false);
    });
    sheet.appendChild(again);
  });
  return close;
}

function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  const u = n % 10;
  return `${n}${u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"}`;
}

export function openVictorySheet(
  host: HTMLElement,
  summary: RunSummary,
  onDone: () => void,
  giftNo?: number,
  finale = false,
): () => void {
  const close = openSheet(host, (sheet) => {
    if (finale) {
      // the hundredth candle (D106): the Long Rescue completes on this sheet
      sheet.appendChild(el("div", "uv-cause", "THE GATE IS OPEN"));
      sheet.appendChild(el("hr", "uv-rule"));
      sheet.appendChild(
        el(
          "p",
          "uv-gold",
          `Floor XXV. Day ${summary.day}. The hundredth candle was yours. The Gate needed no key, only warmth, and the town gave it a hundred times.`,
        ),
      );
      sheet.appendChild(
        el(
          "p",
          "uv-dim",
          "She walks home by your light. Behind her, for the first time in twenty years, the Bottom is dark, and calm.",
        ),
      );
      sheet.appendChild(
        el(
          "p",
          "uv-gold",
          "At dusk, the Festival of Wicks: two candles for every hearth. Her flame stands in the square now, and every house that gave is carved beneath it.",
        ),
      );
      // what happens now (D109): the rescue ends her wait, not the game
      sheet.appendChild(
        el(
          "p",
          "uv-dim",
          "The descent does not end. The Vault still shifts its laws at dusk, and the Codex is not yet full. She asks only this: keep going down. Learn it all, so the door she kept never needs a keeper again.",
        ),
      );
    } else {
      sheet.appendChild(el("div", "uv-cause", "THE FIRST FLAME IS FED"));
      sheet.appendChild(el("hr", "uv-rule"));
      sheet.appendChild(
        el(
          "p",
          "uv-gold",
          `Floor XXV. Day ${summary.day}. Five truths opened the Seal; your candle's last wax went to hers. The Vault goes no deeper, and she keeps the flame your town still lights its wicks from.`,
        ),
      );
      sheet.appendChild(el("p", "uv-dim", "She stayed. Someone had to. The town will remember who reached her first."));
      // the Long Rescue (D105): the ending recruits — one victory is one candle
      // toward the hundred that open the Gate from the inside
      sheet.appendChild(
        el(
          "p",
          "uv-gold",
          `${giftNo !== undefined ? `Yours is the ${ordinal(giftNo)} candle given. ` : ""}When one hundred burn beside her, the Gate opens from the inside, and she walks home.`,
        ),
      );
    }
    const seal = el("button", "uv-seal-btn") as HTMLButtonElement;
    seal.addEventListener("click", () => {
      close();
      onDone();
    });
    sheet.appendChild(seal);
    sheet.appendChild(el("span", "uv-seal-label", finale ? "WALK UP BESIDE HER" : "RETURN TO THE LIGHT"));
  });
  return close;
}

// ── Heirloom pick (generations 3/6/9 — 01 §13) ─────────────────────────────
export function openHeirloomSheet(host: HTMLElement, onPick: (id: number) => void): () => void {
  const OPTIONS: { id: number; name: string; blurb: string }[] = [
    { id: Heirloom.SMOKED_GLASS, name: "Smoked Glass", blurb: "see one tile while snuffed" },
    { id: Heirloom.FEVER_RING, name: "Fever Ring", blurb: "warms beside things that lie" },
    { id: Heirloom.LISTENING_HORN, name: "Listening Horn", blurb: "the tells carry farther" },
    { id: Heirloom.WIDDERSHINS, name: "Widdershins Compass", blurb: "spins near cipher walls" },
    { id: Heirloom.LOCKET, name: "Hummer's Locket", blurb: "hums near hidden places" },
  ];
  const close = openSheet(host, (sheet) => {
    sheet.appendChild(el("h1", "", "THE LINE ENDURES"));
    sheet.appendChild(el("p", "uv-dim", "Three generations gone. The Guild grants one heirloom. Choose."));
    const list = el("ul", "uv-list");
    for (const o of OPTIONS) {
      const li = el("li", "", "");
      const b = el("button", "uv-ink-btn", `${o.name}, ${o.blurb}`) as HTMLButtonElement;
      b.style.display = "inline";
      b.addEventListener("click", () => {
        close();
        onPick(o.id);
      });
      li.appendChild(b);
      list.appendChild(li);
    }
    sheet.appendChild(list);
  });
  return close;
}
