/**
 * Sign composer (04 §3.7): five fixed templates, noun chips drawn from
 * the delver's earned vocabulary, a live preview plank, and the "−5 wax"
 * cost badge. Templates are the only sentences a delver may leave —
 * composition, never chat. DOM sheet per the hybrid-rendering decision;
 * styles use ONLY tokens.css vars.
 */

import { el, openSheet } from "./dom.js";

interface SignTemplate {
  text: string;
  takesNoun: boolean;
}

const TEMPLATES: readonly SignTemplate[] = [
  { text: "Beware of ___", takesNoun: true },
  { text: "Try ___", takesNoun: true },
  { text: "___ ahead", takesNoun: true },
  { text: "Praise the flame", takesNoun: false },
  { text: "Liar ahead", takesNoun: false },
];

let styled = false;

function injectStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = `
.uv-sign-cost {
  display: inline-block;
  margin-left: var(--pad-component);
  padding: 1px 6px;
  vertical-align: middle;
  border: 1px solid var(--ember);
  border-radius: var(--radius);
  color: var(--ember);
  font-family: var(--font-body);
  font-size: var(--size-body-sm);
  letter-spacing: 0.02em;
}
.uv-sign-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 var(--pad-component) 0; }
.uv-sign-chip { /* parchment tab, 32 px height (04 §3.6) */
  box-sizing: border-box;
  height: 32px;
  padding: 0 var(--pad-component);
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--ink);
  border-radius: var(--radius);
  font-family: var(--font-body);
  font-size: var(--size-body-sm);
  cursor: pointer;
}
.uv-sign-chip[aria-pressed="true"] { /* selected = amber underline (04 §3.5) */
  background: var(--parchment-aged);
  box-shadow: inset 0 -2px 0 var(--flame);
}
.uv-sign-chip:disabled {
  color: var(--disproven);
  border-color: var(--disproven);
  background: transparent;
  box-shadow: none;
  cursor: not-allowed;
}
.uv-sign-plank {
  margin: var(--pad-component) 0;
  padding: var(--pad-component) var(--pad-component-lg);
  background: var(--parchment-aged);
  border: 1px solid var(--ink);
  border-radius: var(--radius);
  font-family: var(--font-display);
  font-size: var(--size-display-3);
  line-height: var(--lh-display);
  letter-spacing: 0.02em;
  text-align: center;
}
.uv-sign-plank-empty { color: var(--ink-soft); font-style: italic; }
`;
  document.head.appendChild(style);
}

export function openSignComposer(
  host: HTMLElement,
  nouns: string[],
  onPlace: (template: string, noun: string) => void,
  onCancel: () => void,
): () => void {
  injectStyles();
  const close = openSheet(host, (sheet) => {
    let template: SignTemplate | undefined;
    let noun: string | undefined;

    const head = el("h1", "", "PLANT A SIGN");
    head.appendChild(el("span", "uv-sign-cost", "−5 wax"));
    sheet.appendChild(head);
    sheet.appendChild(el("hr", "uv-rule"));

    // Template chips (the five fixed phrases).
    sheet.appendChild(el("p", "uv-dim", "The words you may use"));
    const tplRow = el("div", "uv-sign-chips");
    const tplPairs: [HTMLButtonElement, SignTemplate][] = [];
    // Noun chips (earned vocabulary).
    sheet.appendChild(tplRow);
    sheet.appendChild(el("p", "uv-dim", "The names you have earned"));
    const nounRow = el("div", "uv-sign-chips");
    const nounPairs: [HTMLButtonElement, string][] = [];
    sheet.appendChild(nounRow);
    // Live preview plank.
    const plank = el("div", "uv-sign-plank");
    sheet.appendChild(plank);
    sheet.appendChild(el("hr", "uv-rule"));
    // Seal + cancel.
    const seal = el("button", "uv-seal-btn") as HTMLButtonElement;
    seal.type = "button";
    seal.disabled = true;

    const sync = (): void => {
      for (const [b, t] of tplPairs) b.setAttribute("aria-pressed", String(t === template));
      const nounsOff = template === undefined || !template.takesNoun;
      for (const [b, n] of nounPairs) {
        b.disabled = nounsOff;
        b.setAttribute("aria-pressed", String(!nounsOff && n === noun));
      }
      if (template === undefined) {
        plank.textContent = "Choose your words.";
      } else if (template.takesNoun) {
        plank.textContent = template.text.replace("___", noun ?? "___");
      } else {
        plank.textContent = template.text;
      }
      plank.classList.toggle("uv-sign-plank-empty", template === undefined);
      seal.disabled = template === undefined || (template.takesNoun && noun === undefined);
    };

    for (const t of TEMPLATES) {
      const b = el("button", "uv-sign-chip", t.text) as HTMLButtonElement;
      b.type = "button";
      b.addEventListener("click", () => {
        template = t;
        if (!t.takesNoun) noun = undefined;
        sync();
      });
      tplPairs.push([b, t]);
      tplRow.appendChild(b);
    }
    if (nouns.length === 0) {
      nounRow.appendChild(el("span", "uv-dim", "You have earned no names yet."));
    } else {
      for (const n of nouns) {
        const b = el("button", "uv-sign-chip", n) as HTMLButtonElement;
        b.type = "button";
        b.addEventListener("click", () => {
          noun = n;
          sync();
        });
        nounPairs.push([b, n]);
        nounRow.appendChild(b);
      }
    }

    seal.addEventListener("click", () => {
      const t = template;
      const n = noun;
      if (t === undefined || (t.takesNoun && n === undefined)) return;
      close();
      onPlace(t.text, t.takesNoun && n !== undefined ? n : "");
    });
    sheet.appendChild(seal);
    sheet.appendChild(el("span", "uv-seal-label", "PLANT THE SIGN"));
    const cancelBtn = el("button", "uv-ink-btn", "Never mind") as HTMLButtonElement;
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", () => {
      close();
      onCancel();
    });
    sheet.appendChild(cancelBtn);

    // Escape cancels (D97): the composer was pointer-only to leave, which
    // stranded keyboard players who opened it with B
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") {
        window.removeEventListener("keydown", onKey);
        close();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    cancelBtn.addEventListener("click", () => window.removeEventListener("keydown", onKey));
    seal.addEventListener("click", () => window.removeEventListener("keydown", onKey));

    sync();
  });
  return close;
}
