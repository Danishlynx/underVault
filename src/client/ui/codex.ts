/**
 * The Codex sheet (04 §4.6, simplified to a grouped claims list for the
 * dev slice): header with % inked, entries grouped by subject, status
 * chips colored per 04 §2.1/§3.8 (inked=gold, true=verdigris,
 * conditional=verdigris-dim "…under a certain sky", disproven struck
 * through). Empty state copy from 04 §4.9. DOM overlay; tokens only.
 */

import { el, openSheet } from "./dom.js";

export interface CodexEntry {
  subject: string;
  text: string;
  status: "pending" | "true" | "conditional" | "inked" | "disproven";
  confirms: number;
  day: number;
}

const CONDITIONAL_SUFFIX = ", under a certain sky";

let styled = false;

function injectStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = `
.uv-codex-subject {
  margin: var(--pad-component-lg) 0 4px 0;
  font-family: var(--font-display);
  font-size: var(--size-display-3);
  line-height: var(--lh-display);
  letter-spacing: 0.02em;
  font-weight: normal;
}
.uv-codex-entry { padding: 6px 0; border-bottom: 1px solid var(--parchment-aged); }
.uv-codex-chip {
  display: inline-block;
  margin-right: 8px;
  padding: 1px 6px;
  border: 1px solid currentColor;
  border-radius: var(--radius);
  font-size: var(--size-body-sm);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.uv-codex-meta { display: block; margin-top: 2px; }
.uv-codex-pending .uv-codex-chip { color: var(--ink-soft); }
.uv-codex-true .uv-codex-chip { color: var(--verdigris); }
.uv-codex-conditional .uv-codex-chip { color: var(--verdigris-dim); }
.uv-codex-inked .uv-codex-chip { color: var(--gold-ink); }
.uv-codex-disproven .uv-codex-chip { color: var(--disproven); }
.uv-codex-disproven .uv-codex-text { color: var(--disproven); text-decoration: line-through; }
.uv-codex-cond { color: var(--verdigris-dim); font-style: italic; }
.uv-codex-empty { text-align: center; padding: var(--pad-component-lg) 0; }
`;
  document.head.appendChild(style);
}

function renderEntry(entry: CodexEntry): HTMLElement {
  const row = el("div", `uv-codex-entry uv-codex-${entry.status}`);
  row.appendChild(el("span", "uv-codex-chip", entry.status));
  row.appendChild(el("span", "uv-codex-text", entry.text));
  if (entry.status === "conditional") {
    row.appendChild(el("span", "uv-codex-cond", CONDITIONAL_SUFFIX));
  }
  row.appendChild(
    el(
      "span",
      "uv-dim uv-codex-meta",
      `Day ${entry.day} · confirmed by ${entry.confirms} delver${entry.confirms === 1 ? "" : "s"}`,
    ),
  );
  return row;
}

export function openCodexSheet(
  host: HTMLElement,
  entries: CodexEntry[],
  onClose: () => void,
): () => void {
  injectStyles();
  const close = openSheet(host, (sheet) => {
    const inked = entries.filter((e) => e.status === "inked").length;
    const pct = entries.length === 0 ? 0 : Math.round((inked / entries.length) * 100);
    sheet.appendChild(el("h1", "", `THE CODEX, ${pct}% inked`));
    sheet.appendChild(el("hr", "uv-rule"));

    if (entries.length === 0) {
      sheet.appendChild(el("p", "uv-dim uv-codex-empty", "Every page is waiting."));
    } else {
      // Group by subject, first-seen order preserved.
      const groups = new Map<string, CodexEntry[]>();
      for (const entry of entries) {
        const bucket = groups.get(entry.subject);
        if (bucket === undefined) groups.set(entry.subject, [entry]);
        else bucket.push(entry);
      }
      for (const [subject, group] of groups) {
        sheet.appendChild(el("h2", "uv-codex-subject", subject));
        for (const entry of group) sheet.appendChild(renderEntry(entry));
      }
    }

    sheet.appendChild(el("hr", "uv-rule"));
    const closeBtn = el("button", "uv-ink-btn", "Close the book") as HTMLButtonElement;
    closeBtn.type = "button";
    closeBtn.addEventListener("click", () => {
      close();
      onClose();
    });
    sheet.appendChild(closeBtn);
  });
  return close;
}
