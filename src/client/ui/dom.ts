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
/* ── the scrim: the leaf floats in a warm dark — a low ember pool at the
   reader's focus, deepening to near-solid void at the frame's edge (the
   menu's "one candle in the dark" language, ported to the sheets) ─────── */
.uv-backdrop {
  position: absolute; inset: 0; z-index: 10;
  display: flex; align-items: flex-end; justify-content: center;
  background:
    radial-gradient(150% 100% at 50% 82%,
      color-mix(in srgb, var(--ember) 10%, transparent) 0%,
      color-mix(in srgb, var(--void) 66%, transparent) 30%,
      color-mix(in srgb, var(--void) 88%, transparent) 100%);
  animation: uv-scrim var(--dur-sheet) var(--ease);
}
@keyframes uv-scrim { from { opacity: 0; } to { opacity: 1; } }
/* ── the leaf: an illuminated vellum sheet lit warm from its heart, held off
   the void by depth and closed in a gold double-rule folio frame with four
   corner studs. D127 clearance (max-height / margin-bottom / scroll) is kept
   verbatim; the frame is drawn with border/outline/inset-shadow + pinned
   background studs so nothing scrolls out of place inside the reading pane. */
.uv-sheet {
  box-sizing: border-box;
  width: min(440px, 92%);
  max-height: 80%; /* D127: browser chrome clips the embed's bottom rows */
  overflow-y: auto;
  margin-bottom: calc(var(--gutter-mobile) + 28px);
  padding: var(--pad-component-lg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: var(--size-body);
  line-height: var(--lh-body);
  background:
    radial-gradient(circle, color-mix(in srgb, var(--gold-ink) 62%, transparent) 1.4px, transparent 2.4px) no-repeat left 5px top 5px / 22px 22px,
    radial-gradient(circle, color-mix(in srgb, var(--gold-ink) 62%, transparent) 1.4px, transparent 2.4px) no-repeat right 5px top 5px / 22px 22px,
    radial-gradient(circle, color-mix(in srgb, var(--gold-ink) 62%, transparent) 1.4px, transparent 2.4px) no-repeat left 5px bottom 5px / 22px 22px,
    radial-gradient(circle, color-mix(in srgb, var(--gold-ink) 62%, transparent) 1.4px, transparent 2.4px) no-repeat right 5px bottom 5px / 22px 22px,
    linear-gradient(157deg,
      color-mix(in srgb, var(--parchment) 90%, var(--flame-hi)) 0%,
      var(--parchment) 40%,
      var(--parchment-aged) 100%);
  background-color: var(--parchment);
  border: 1px solid color-mix(in srgb, var(--gold-ink) 55%, var(--ink));
  outline: 1px solid color-mix(in srgb, var(--gold-ink) 40%, transparent);
  outline-offset: 4px; /* the outer rule of the folio double-frame (04 §2.3) */
  border-radius: var(--radius);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--parchment) 55%, transparent),
    inset 0 22px 40px -24px color-mix(in srgb, var(--flame-hi) 30%, transparent),
    inset 0 -40px 60px -40px color-mix(in srgb, var(--ink) 40%, transparent),
    0 20px 55px -12px color-mix(in srgb, var(--void) 82%, transparent),
    0 2px 0 color-mix(in srgb, var(--void) 45%, transparent);
  animation: uv-unroll var(--dur-sheet) var(--ease) both;
  animation-delay: 70ms; /* the scrim blooms, then the leaf unrolls (staged) */
}
@keyframes uv-unroll {
  from { transform: translateY(22px) scale(0.985); opacity: 0; }
  to { transform: none; opacity: 1; }
}
/* engraved serif header, raised off the vellum, closed by a gold→verdigris
   hairline that fades to nothing (illuminated-manuscript section rule) */
.uv-sheet h1 {
  position: relative;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: var(--size-display-2);
  line-height: var(--lh-display);
  letter-spacing: 0.06em;
  margin: 0 0 var(--pad-component) 0;
  padding-bottom: 9px;
  color: var(--ink);
  text-shadow:
    0 1px 0 color-mix(in srgb, var(--flame-hi) 55%, transparent),
    0 2px 5px color-mix(in srgb, var(--void) 16%, transparent);
}
.uv-sheet h1::after {
  content: ""; position: absolute; left: 0; bottom: 0; width: 100%; height: 1px;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--gold-ink) 78%, transparent),
    color-mix(in srgb, var(--verdigris) 40%, transparent) 46%,
    transparent 82%);
}
/* the death / victory title: carved caps, gold diamond flankers */
.uv-sheet .uv-cause {
  font-family: var(--font-display);
  font-size: var(--size-display-2);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  text-align: center;
  margin: var(--pad-component) 0;
  color: var(--ink);
  text-shadow:
    0 1px 0 color-mix(in srgb, var(--flame-hi) 45%, transparent),
    0 2px 6px color-mix(in srgb, var(--void) 22%, transparent);
}
.uv-sheet .uv-cause::before, .uv-sheet .uv-cause::after {
  content: "◆"; display: inline-block; margin: 0 0.5em;
  font-size: 0.5em; vertical-align: middle;
  color: color-mix(in srgb, var(--gold-ink) 70%, var(--ink));
  text-shadow: none;
}
/* a gold hairline with a verdigris breath at its heart (menu-rule idiom) */
.uv-rule {
  border: 0; height: 1px; margin: var(--pad-component) 0;
  background: linear-gradient(90deg, transparent,
    color-mix(in srgb, var(--gold-ink) 60%, transparent) 20%,
    color-mix(in srgb, var(--verdigris) 34%, transparent) 50%,
    color-mix(in srgb, var(--gold-ink) 60%, transparent) 80%,
    transparent);
}
.uv-dim { color: var(--ink-soft); font-size: var(--size-body-sm); }
.uv-gold { color: color-mix(in srgb, var(--gold-ink) 62%, var(--ink)); } /* deep, legible gold on vellum */
.uv-list { margin: 0; padding: 0; list-style: none; }
.uv-list li { padding: 6px 0; border-bottom: 1px solid var(--parchment-aged); }
.uv-list li::before { content: "◆ "; color: var(--verdigris); }
/* sheet-scoped list rhythm: more air, a fading verdigris hairline */
.uv-sheet .uv-list li {
  padding: 8px 2px 8px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--parchment-aged) 80%, transparent);
}
.uv-sheet .uv-list li:last-child { border-bottom: 0; }
.uv-sheet .uv-list li::before {
  color: color-mix(in srgb, var(--verdigris) 78%, var(--ink)); margin-right: 2px;
}
.uv-seal-btn {
  display: block; margin: var(--pad-component-lg) auto 4px auto;
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--seal); border: none; cursor: pointer;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.25);
}
.uv-seal-btn:active { transform: translateY(1px); filter: brightness(0.88); }
.uv-seal-btn:disabled { background: var(--disproven); cursor: not-allowed; }
/* ── the wax seal, sheet ceremonies only (the Guildhall's strike keeps its
   own dressing): a struck lozenge of sealing wax lit high-left, stamped with
   a star and pressed into the leaf. Scoped under .uv-backdrop so it never
   reaches the hall's .uv-seal-btn. ────────────────────────────────────── */
.uv-backdrop .uv-seal-btn {
  position: relative;
  width: 66px; height: 66px;
  background:
    radial-gradient(circle at 38% 30%,
      color-mix(in srgb, var(--seal) 55%, var(--flame-hi)) 0%,
      var(--seal) 42%,
      color-mix(in srgb, var(--seal) 62%, var(--void)) 100%);
  box-shadow:
    inset 0 2px 3px color-mix(in srgb, var(--flame-hi) 35%, transparent),
    inset 0 -5px 8px color-mix(in srgb, var(--void) 50%, transparent),
    inset 0 0 0 2px color-mix(in srgb, var(--void) 28%, transparent),
    0 4px 10px color-mix(in srgb, var(--void) 55%, transparent);
  transition: filter var(--dur-micro) var(--ease), box-shadow var(--dur-micro) var(--ease), transform var(--dur-micro) var(--ease);
}
.uv-backdrop .uv-seal-btn::before {
  content: "✦"; position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; line-height: 1; pointer-events: none;
  color: color-mix(in srgb, var(--void) 42%, var(--seal));
  text-shadow: 0 1px 0 color-mix(in srgb, var(--flame-hi) 30%, transparent);
}
.uv-backdrop .uv-seal-btn:hover, .uv-backdrop .uv-seal-btn:focus-visible {
  outline: none;
  filter: brightness(1.07);
  box-shadow:
    inset 0 2px 3px color-mix(in srgb, var(--flame-hi) 45%, transparent),
    inset 0 -5px 8px color-mix(in srgb, var(--void) 50%, transparent),
    inset 0 0 0 2px color-mix(in srgb, var(--gold-ink) 55%, transparent),
    0 4px 14px color-mix(in srgb, var(--ember) 40%, transparent);
}
.uv-backdrop .uv-seal-btn:active { transform: translateY(1px) scale(0.98); filter: brightness(0.9); }
.uv-backdrop .uv-seal-btn:disabled {
  background: radial-gradient(circle at 38% 30%,
    color-mix(in srgb, var(--disproven) 70%, var(--bone)) 0%,
    var(--disproven) 60%,
    color-mix(in srgb, var(--disproven) 60%, var(--void)) 100%);
  cursor: not-allowed; filter: none;
}
.uv-backdrop .uv-seal-btn:disabled::before {
  color: color-mix(in srgb, var(--void) 30%, var(--disproven)); text-shadow: none;
}
.uv-seal-label {
  display: block; text-align: center; margin-bottom: var(--pad-component);
  font-size: var(--size-body-sm); letter-spacing: 0.08em; text-transform: uppercase;
}
/* the seal's caption as a gold letter-spaced eyebrow (sheets only) */
.uv-sheet .uv-seal-label {
  letter-spacing: 0.22em;
  color: color-mix(in srgb, var(--gold-ink) 60%, var(--ink));
  text-shadow: 0 1px 0 color-mix(in srgb, var(--flame-hi) 40%, transparent);
}
.uv-ink-btn {
  display: block; margin: 8px auto; background: none; border: none; cursor: pointer;
  font-family: var(--font-body); font-size: var(--size-body); color: var(--ink);
  text-decoration: underline; text-underline-offset: 4px;
}
.uv-ink-btn:active { text-decoration-thickness: 2px; }
/* sheet ink links warm to gold on hover/focus */
.uv-sheet .uv-ink-btn {
  color: color-mix(in srgb, var(--ink) 82%, var(--gold-ink));
  text-decoration-color: color-mix(in srgb, var(--gold-ink) 55%, transparent);
  transition: color var(--dur-micro) var(--ease), text-decoration-color var(--dur-micro) var(--ease);
}
.uv-sheet .uv-ink-btn:hover, .uv-sheet .uv-ink-btn:focus-visible {
  outline: none;
  color: color-mix(in srgb, var(--gold-ink) 68%, var(--ink));
  text-decoration-color: var(--gold-ink);
}
.uv-input {
  box-sizing: border-box;
  width: 100%; padding: var(--pad-component);
  background: color-mix(in srgb, var(--parchment-aged) 30%, transparent);
  color: var(--ink);
  border: 1px solid color-mix(in srgb, var(--gold-ink) 45%, var(--ink));
  border-radius: var(--radius);
  font-family: var(--font-display); font-style: italic; font-size: var(--size-body);
  box-shadow: inset 0 2px 4px color-mix(in srgb, var(--ink) 14%, transparent);
  transition: border-color var(--dur-micro) var(--ease), box-shadow var(--dur-micro) var(--ease);
}
.uv-input::placeholder { color: var(--ink-soft); font-style: italic; }
.uv-input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--verdigris) 60%, var(--ink));
  box-shadow:
    inset 0 2px 4px color-mix(in srgb, var(--ink) 14%, transparent),
    0 0 0 2px color-mix(in srgb, var(--verdigris) 30%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .uv-backdrop, .uv-sheet { animation: none; }
}
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
