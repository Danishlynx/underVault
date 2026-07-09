/**
 * Guildhall — the above-ground entry surface (04 §4.1, condensed for the
 * dev slice). Full-screen DOM overlay per the hybrid-rendering decision:
 * a void backdrop covering the host with a centered parchment panel,
 * zones A–F. The STRIKE seal is hold-to-confirm (450 ms, mirroring the
 * match-strike hold of 04 §4.2 / the Snuff pattern of 04 §3.3) so the
 * candle cannot be lit by a stray tap. Styles use ONLY tokens.css vars.
 */

import { el, ensureUvStyles } from "./dom.js";

export interface GuildhallModel {
  day: number;
  omenRumor: string;
  gatePct: number;
  codexPct: number;
  fallenToday: number;
  houseLine: string;
}

/** 04 §3.3 / §4.2 hold-to-confirm duration — no motion token covers 450 ms. */
const HOLD_MS = 450;

const HOW_LINES = [
  "Tap a floor tile to walk; tap yourself to wait.",
  "Long-press a tile or creature to inspect, or to plant a sign.",
  "Cup the flame to hide it; hold Snuff to put it out.",
  "The candle burns with every step. It is your life.",
  "Keys: WASD move · Space wait · C cup · X snuff (hold) · E interact.",
];

let styled = false;

function injectStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = `
.uv-hall {
  position: absolute; inset: 0; z-index: 10;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--void) 82%, transparent);
}
.uv-hall-panel {
  box-sizing: border-box;
  width: min(440px, 92%);
  max-width: 440px;
  max-height: 92%;
  overflow-y: auto;
  background: var(--parchment);
  color: var(--ink);
  border: 1px solid var(--ink);
  outline: 1px solid var(--ink);
  outline-offset: 3px; /* double-rule frame (04 §2.3) */
  border-radius: var(--radius);
  padding: var(--pad-component-lg);
  font-family: var(--font-body);
  font-size: var(--size-body);
  line-height: var(--lh-body);
  animation: uv-hall-in var(--dur-sheet) var(--ease);
}
@keyframes uv-hall-in { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }
.uv-hall-head { display: flex; justify-content: space-between; align-items: baseline; }
.uv-hall-day {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--size-display-1);
  line-height: var(--lh-display);
  letter-spacing: 0.02em;
  font-weight: normal;
}
.uv-hall-hero {
  display: flex; flex-direction: column; align-items: center;
  padding-top: var(--pad-component);
}
.uv-hall-stage {
  position: relative;
  width: 128px; height: 128px;
  display: flex; align-items: center; justify-content: center;
}
.uv-hall-etch { /* faint vault-door etching behind the match (04 §4.1 B) */
  position: absolute; inset: 0;
  border: 1px solid var(--parchment-aged);
  border-radius: 50%;
}
.uv-hall-etch-seam {
  position: absolute; top: 6px; bottom: 6px; left: 50%; width: 0;
  border-left: 1px solid var(--parchment-aged);
}
.uv-hall-match { position: relative; width: 10px; height: 104px; }
.uv-hall-match-head { /* unlit: seal-red quenched toward ink */
  position: absolute; top: 0; left: 0; width: 10px; height: 18px;
  background: color-mix(in srgb, var(--seal) 55%, var(--ink));
  border-radius: 50% 50% 42% 42%;
}
.uv-hall-match-stick {
  box-sizing: border-box;
  position: absolute; top: 16px; bottom: 0; left: 3px; width: 4px;
  background: var(--parchment-aged);
  border: 1px solid var(--ink-soft);
  border-radius: var(--radius);
}
.uv-hall-hold {
  position: relative; overflow: hidden;
  touch-action: none; user-select: none; -webkit-user-select: none;
}
.uv-hall-hold-fill { /* radial fill while holding; snaps back on release */
  position: absolute; inset: 0; border-radius: 50%;
  background: var(--flame);
  transform: scale(0);
  transition: transform var(--dur-micro) var(--ease);
  pointer-events: none;
}
.uv-hall-holding .uv-hall-hold-fill {
  transform: scale(1);
  transition: transform ${HOLD_MS}ms linear;
}
.uv-hall-pulse {
  display: flex; gap: var(--pad-component);
  text-align: center;
  margin: var(--pad-component) 0;
}
.uv-hall-stat { flex: 1 1 0; }
.uv-hall-stat-value {
  display: block;
  font-family: var(--font-display);
  font-size: var(--size-display-3);
  line-height: var(--lh-display);
}
.uv-hall-stat .uv-dim { display: block; }
.uv-hall-charge {
  margin: var(--pad-component) 0 0;
  text-align: center;
  font-family: var(--font-display);
  font-style: italic;
  font-size: var(--size-body-sm);
  color: var(--bone);
}
.uv-hall-rumor {
  margin: var(--pad-component) 0;
  padding: var(--pad-component) 0;
  border-top: 1px solid var(--parchment-aged);
  border-bottom: 1px solid var(--parchment-aged);
  font-family: var(--font-display);
  font-style: italic;
  text-align: center;
}
.uv-hall-quill { color: var(--verdigris); font-style: normal; }
.uv-hall-house { margin: var(--pad-component) 0; text-align: center; }
.uv-hall-pennant { color: var(--seal); }
.uv-hall-foot { display: flex; justify-content: center; gap: var(--pad-component-lg); }
.uv-hall-foot .uv-ink-btn { margin: 4px 0; }
.uv-hall-how { margin-top: var(--pad-component); }
`;
  document.head.appendChild(style);
}

export function openGuildhall(
  host: HTMLElement,
  model: GuildhallModel,
  onStrike: () => void,
  onCodex: () => void,
): () => void {
  injectStyles();
  ensureUvStyles(); // shared seal/ink button styles (dom.ts) before any sheet
  const backdrop = el("div", "uv-hall");
  const panel = el("div", "uv-hall-panel");
  backdrop.appendChild(panel);

  // A — header: day + reshuffle moon-mark, hairline rule.
  const head = el("header", "uv-hall-head");
  head.appendChild(el("h1", "uv-hall-day", `DAY ${model.day}`));
  head.appendChild(el("span", "uv-dim", "☾ reshuffles at dusk"));
  panel.appendChild(head);
  panel.appendChild(el("hr", "uv-rule"));

  // the charge — a player must never wonder what the game is asking (D66)
  panel.appendChild(
    el(
      "p",
      "uv-hall-charge",
      "One candle a day. Descend the shared Vault, learn its hidden laws, " +
        "and bank them at the waystones — what you learn is all that survives you.",
    ),
  );

  // B — hero: unlit match over the vault-door etching + hold-to-strike seal.
  const hero = el("div", "uv-hall-hero");
  const stage = el("div", "uv-hall-stage");
  const etch = el("div", "uv-hall-etch");
  etch.appendChild(el("div", "uv-hall-etch-seam"));
  stage.appendChild(etch);
  const match = el("div", "uv-hall-match");
  match.appendChild(el("div", "uv-hall-match-stick"));
  match.appendChild(el("div", "uv-hall-match-head"));
  stage.appendChild(match);
  hero.appendChild(stage);

  const seal = el("button", "uv-seal-btn uv-hall-hold") as HTMLButtonElement;
  seal.type = "button";
  seal.appendChild(el("span", "uv-hall-hold-fill"));
  hero.appendChild(seal);
  hero.appendChild(el("span", "uv-seal-label", "STRIKE THE MATCH"));
  panel.appendChild(hero);

  let holdTimer: number | undefined;
  const startHold = (): void => {
    if (holdTimer !== undefined) return;
    // a sheet (Codex) above the hall swallows the strike — keyboard focus
    // must not light the match behind an open book (D64)
    if (host.querySelector(".uv-backdrop") !== null) return;
    seal.classList.add("uv-hall-holding");
    holdTimer = window.setTimeout(() => {
      holdTimer = undefined;
      seal.classList.remove("uv-hall-holding");
      onStrike();
    }, HOLD_MS);
  };
  const cancelHold = (): void => {
    if (holdTimer !== undefined) {
      window.clearTimeout(holdTimer);
      holdTimer = undefined;
    }
    seal.classList.remove("uv-hall-holding");
  };
  seal.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    startHold();
  });
  seal.addEventListener("pointerup", cancelHold);
  seal.addEventListener("pointercancel", cancelHold);
  seal.addEventListener("pointerleave", cancelHold);
  seal.addEventListener("contextmenu", (ev) => ev.preventDefault());
  seal.addEventListener("keydown", (ev) => {
    if (ev.repeat || (ev.key !== " " && ev.key !== "Enter")) return;
    ev.preventDefault();
    startHold();
  });
  seal.addEventListener("keyup", cancelHold);
  seal.addEventListener("blur", cancelHold);

  // C — community pulse: three inline stats.
  const stat = (value: string, label: string): HTMLElement => {
    const cell = el("div", "uv-hall-stat");
    cell.appendChild(el("b", "uv-hall-stat-value", value));
    cell.appendChild(el("span", "uv-dim", label));
    return cell;
  };
  const pulse = el("div", "uv-hall-pulse");
  pulse.appendChild(stat(`${model.gatePct}%`, "the Great Gate strains"));
  pulse.appendChild(stat(`${model.codexPct}%`, "of the Codex inked"));
  pulse.appendChild(stat(`${model.fallenToday}`, "delvers have fallen today"));
  panel.appendChild(pulse);

  // D — rumor strip (empty → the Vault keeps its counsel).
  const rumor = el("p", "uv-hall-rumor");
  rumor.appendChild(el("span", "uv-hall-quill", "❧ "));
  rumor.appendChild(
    document.createTextNode(model.omenRumor === "" ? "The Vault keeps its counsel." : model.omenRumor),
  );
  panel.appendChild(rumor);

  // E — your line.
  const house = el("p", "uv-hall-house");
  house.appendChild(el("span", "uv-hall-pennant", "⚑ "));
  house.appendChild(document.createTextNode(model.houseLine));
  panel.appendChild(house);

  // F — footer InkButtons.
  panel.appendChild(el("hr", "uv-rule"));
  const foot = el("footer", "uv-hall-foot");
  const codexBtn = el("button", "uv-ink-btn", "Codex") as HTMLButtonElement;
  codexBtn.type = "button";
  codexBtn.addEventListener("click", () => {
    codexBtn.blur(); // keyboard Enter must not stack a second book (D64)
    if (host.querySelector(".uv-backdrop") !== null) return;
    onCodex();
  });
  foot.appendChild(codexBtn);
  const how = el("ul", "uv-list uv-hall-how");
  how.hidden = model.day !== 1; // first dawn: the controls are on the table (D66)
  for (const line of HOW_LINES) how.appendChild(el("li", "uv-dim", line));
  const howBtn = el("button", "uv-ink-btn", "How to delve") as HTMLButtonElement;
  howBtn.type = "button";
  howBtn.addEventListener("click", () => {
    how.hidden = !how.hidden;
  });
  foot.appendChild(howBtn);
  panel.appendChild(foot);
  panel.appendChild(how);

  host.appendChild(backdrop);
  return () => {
    cancelHold();
    backdrop.remove();
  };
}
