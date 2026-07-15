/**
 * DOM overlay plumbing for text-heavy sheets (decided hybrid rendering:
 * Waystone / Epitaph / menus are DOM above the canvas — crisp text, real
 * inputs). Styles use ONLY design token custom properties (tokens.css must
 * be linked by the host page); layout metrics come from 04 §2.3.
 */

let styled = false;

/** Idempotent shared-style injection (sheets call it via openSheet; the
 *  Guildhall calls it directly since it renders before any sheet). */
export function ensureUvStyles(): void {
  injectStyles();
}

function injectStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = `
.uv-backdrop {
  position: absolute; inset: 0; z-index: 10;
  display: flex; align-items: flex-end; justify-content: center;
  background: color-mix(in srgb, var(--void) 82%, transparent);
}
.uv-sheet {
  box-sizing: border-box;
  width: min(440px, 92%);
  max-height: 80%; /* D127: browser chrome clips the embed's bottom rows */
  overflow-y: auto;
  margin-bottom: calc(var(--gutter-mobile) + 28px);
  background: var(--parchment);
  color: var(--ink);
  border: 1px solid var(--ink);
  outline: 1px solid var(--ink);
  outline-offset: 3px; /* double-rule frame for sacred panels (04 §2.3) */
  border-radius: var(--radius);
  padding: var(--pad-component-lg);
  font-family: var(--font-body);
  font-size: var(--size-body);
  line-height: var(--lh-body);
  animation: uv-unroll var(--dur-sheet) var(--ease);
}
@keyframes uv-unroll { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
.uv-sheet h1 {
  font-family: var(--font-display);
  font-size: var(--size-display-2);
  line-height: var(--lh-display);
  letter-spacing: 0.02em;
  margin: 0 0 var(--pad-component) 0;
}
.uv-sheet .uv-cause {
  font-family: var(--font-display);
  font-size: var(--size-display-2);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-align: center;
  margin: var(--pad-component) 0;
}
.uv-rule { border: 0; border-top: 1px solid var(--parchment-aged); margin: var(--pad-component) 0; }
.uv-dim { color: var(--ink-soft); font-size: var(--size-body-sm); }
.uv-gold { color: var(--gold-ink); }
.uv-list { margin: 0; padding: 0; list-style: none; }
.uv-list li { padding: 6px 0; border-bottom: 1px solid var(--parchment-aged); }
.uv-list li::before { content: "◆ "; color: var(--verdigris); }
.uv-seal-btn {
  display: block; margin: var(--pad-component-lg) auto 4px auto;
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--seal); border: none; cursor: pointer;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.25);
}
.uv-seal-btn:active { transform: translateY(1px); filter: brightness(0.88); }
.uv-seal-btn:disabled { background: var(--disproven); cursor: not-allowed; }
.uv-seal-label {
  display: block; text-align: center; margin-bottom: var(--pad-component);
  font-size: var(--size-body-sm); letter-spacing: 0.08em; text-transform: uppercase;
}
.uv-ink-btn {
  display: block; margin: 8px auto; background: none; border: none; cursor: pointer;
  font-family: var(--font-body); font-size: var(--size-body); color: var(--ink);
  text-decoration: underline; text-underline-offset: 4px;
}
.uv-ink-btn:active { text-decoration-thickness: 2px; }
.uv-input {
  box-sizing: border-box;
  width: 100%; padding: var(--pad-component);
  background: transparent; color: var(--ink);
  border: 1px solid var(--ink); border-radius: var(--radius);
  font-family: var(--font-display); font-style: italic; font-size: var(--size-body);
}
.uv-input::placeholder { color: var(--ink-soft); font-style: italic; }
`;
  document.head.appendChild(style);
}

export function openSheet(host: HTMLElement, build: (sheet: HTMLElement) => void): () => void {
  injectStyles();
  const backdrop = document.createElement("div");
  backdrop.className = "uv-backdrop";
  const sheet = document.createElement("div");
  sheet.className = "uv-sheet";
  build(sheet);
  backdrop.appendChild(sheet);
  host.appendChild(backdrop);
  return () => {
    backdrop.remove();
  };
}

export function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className !== "") e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function closeAllSheets(host: HTMLElement): void {
  host.querySelectorAll(".uv-backdrop").forEach((n) => n.remove());
}
