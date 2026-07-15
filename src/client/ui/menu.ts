/**
 * The Main Menu, "The Vigil" (D84). The first screen of every session:
 * one great unlit candle before the buried Gate (painted hero backdrop),
 * a LIVE flame rendered per-frame at its wick, drifting embers, and the
 * wordmark over a Crysis-grade quiet menu. The essence of the game in one
 * breathing image: one door, one candle, one day.
 *
 * No Phaser anywhere in this file (invariant 7 discipline — DOM overlay
 * like the story and the Antechamber). Colors via tokens + shade()/mix()
 * only. Audio: the screen opens SILENT; the first pointer/key gesture on
 * it unlocks the context and fades in the vigil theme (operator-directed
 * extension of invariant 6 — a mute control sits right in the menu list).
 */

import { el, ensureUvStyles } from "./dom.js";
import { COLOR_CSS } from "../../../design/tokens/tokens.js";
import { shade, mix } from "../render/paint.js";
import { paintMenuBackdrop, type MenuGeom } from "./menu/backdrop.js";
import { paintGlassOverlay } from "./menu/glass.js";

/** The DAY as burn fraction 0..1 (D99): the menu candle is the world's
 *  clock — cut fresh at dusk, a weeping stub by the last hour. Dev dusk =
 *  local midnight; the port anchors it to the server's day boundary.
 *  Debug: ?burn=0.95 overrides. */
function dayBurn(): number {
  const o = new URLSearchParams(window.location.search).get("burn");
  if (o !== null) return Math.min(1, Math.max(0, Number(o) || 0));
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return (now.getTime() - dayStart) / 86_400_000;
}

/** Extended geometry the burn-aware backdrop returns (candle body box,
 *  fractions of w/h) — optional until the painter ships it. */
type BurnGeom = MenuGeom & {
  candle?: { left: number; right: number; top: number; base: number };
};
type BurnPainter = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  burn?: number,
  rescued?: boolean,
) => BurnGeom;

/** The Long Rescue completed (D108): the menu keeps the changed world.
 *  Debug: ?rescued=1 overrides. */
function isRescued(vitals?: MenuVitals): boolean {
  const o = new URLSearchParams(window.location.search).get("rescued");
  if (o !== null) return o !== "0";
  return vitals?.rescued === true;
}

/** Structural slice of AudioGraph the menu needs (keeps this file decoupled). */
export interface MenuAudio {
  unlock(): void;
  startMenuTheme(): void;
  stopMenuTheme(): void;
  play(cue: "inspect" | "sheet" | "relight"): void;
  setMuted(m: boolean): void;
  readonly muted: boolean;
}

export interface MenuHandlers {
  onBegin: () => void;
  /** Replay the telling; call `done` when the story closes. */
  onTelling: (done: () => void) => void;
  onCodex: () => void;
}

/** The daily pulse — the soul of the retired hall screen (D91): one rumor
 *  whisper and one engraved line of communal state. */
export interface MenuVitals {
  day: number;
  gatePct: number;
  codexPct: number;
  fallenToday: number;
  rumor: string;
  /** today's candle already burned (one per day), BEGIN goes dark (D98).
   *  Dev adapter never sets it; the server port flips it for real. */
  spent?: boolean;
  /** the Long Rescue is complete — she is home; the menu changes forever (D108) */
  rescued?: boolean;
}

// Private LCG (same law as the hall: never touch paint.ts crand()).
function menuRand(seed: number): () => number {
  let s = seed >>> 0 || 0x51ab;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

let styled = false;
function injectStyles(): void {
  if (styled) return;
  styled = true;
  const C = COLOR_CSS;
  const style = document.createElement("style");
  style.textContent = `
.uv-menu {
  position: absolute; inset: 0; z-index: 9;
  background: var(--void);
  overflow: hidden; user-select: none; -webkit-user-select: none;
}
.uv-menu-bg { position: absolute; inset: 0; width: 100%; height: 100%; }
.uv-menu-flame { position: absolute; pointer-events: none; }
.uv-menu-glass {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 1;
}
.uv-menu-sheen {
  position: absolute; top: -12%; left: -25%; width: 60%; height: 124%;
  pointer-events: none; z-index: 1; mix-blend-mode: screen;
  background: linear-gradient(100deg, transparent 32%, ${shade(C.parchment, 1, 0.045)} 50%, transparent 68%);
  animation: uv-menu-sheendrift 46s ease-in-out infinite alternate;
}
@keyframes uv-menu-sheendrift {
  from { transform: translateX(0); }
  to { transform: translateX(160%); }
}
.uv-menu-glow {
  position: absolute; pointer-events: none; border-radius: 50%;
  mix-blend-mode: screen;
  animation: uv-menu-breathe 4.4s ease-in-out infinite;
}
@keyframes uv-menu-breathe {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.78; transform: scale(1.06); }
}
.uv-menu-ember {
  position: absolute; width: 3px; height: 3px; border-radius: 50%;
  background: ${C.flame}; opacity: 0; pointer-events: none;
  animation: uv-menu-ember linear infinite;
}
@keyframes uv-menu-ember {
  0% { transform: translate(0, 0); opacity: 0; }
  8% { opacity: 0.55; }
  60% { opacity: 0.26; }
  100% { transform: translate(16px, -46vh); opacity: 0; }
}
.uv-menu-col {
  position: absolute; left: 50%; top: 0; bottom: 0;
  transform: translateX(-50%);
  z-index: 2; /* the type reads OVER the pane */
  width: min(560px, 92%);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center; gap: 2px;
}
.uv-menu-eyebrow {
  font-family: var(--font-body); font-size: var(--size-body-sm);
  letter-spacing: 0.34em; text-transform: uppercase;
  color: var(--gold-ink);
  text-shadow: 0 1px 8px var(--void);
}
.uv-menu-title {
  margin: 10px 0 4px 0;
  font-family: var(--font-display); font-weight: 400;
  font-size: clamp(34px, 9vw, 66px);
  letter-spacing: 0.13em; text-transform: uppercase;
  line-height: 1.05;
  color: var(--parchment);
  text-shadow:
    0 0 26px ${shade(C.flame, 1, 0.28)},
    0 2px 0 ${shade(C.goldInk, 0.5, 0.85)},
    0 3px 18px var(--void);
}
.uv-menu-rule {
  display: flex; align-items: center; gap: 10px;
  color: var(--gold-ink); font-size: 10px;
  width: min(300px, 62%);
}
.uv-menu-rule::before, .uv-menu-rule::after {
  content: ""; flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, ${shade(C.goldInk, 1, 0.75)});
}
.uv-menu-rule::after {
  background: linear-gradient(90deg, ${shade(C.goldInk, 1, 0.75)}, transparent);
}
.uv-menu-tagline {
  margin-top: 12px;
  font-family: var(--font-display); font-style: italic;
  font-size: calc(var(--size-body) * 1.12);
  color: var(--bone);
  text-shadow: 0 1px 10px var(--void);
}
.uv-menu-items {
  margin-top: clamp(18px, 5vh, 44px);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.uv-menu-spent, .uv-menu-spent:hover, .uv-menu-spent:focus-visible {
  color: var(--disproven); cursor: default; text-shadow: 0 1px 8px var(--void);
}
.uv-menu-spent::before, .uv-menu-spent::after { display: none; }
.uv-menu-dusk {
  font-family: var(--font-display); font-style: italic;
  font-size: var(--size-body-sm); color: var(--bone-dim);
  text-shadow: 0 1px 6px var(--void);
}
.uv-menu-rumor {
  margin-top: clamp(14px, 3.5vh, 30px);
  font-family: var(--font-display); font-style: italic;
  font-size: var(--size-body-sm);
  color: var(--bone); opacity: 0.85;
  text-shadow: 0 1px 8px var(--void);
}
.uv-menu-vitals {
  margin-top: 6px;
  font-family: var(--font-body); font-size: 11px;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--bone-dim);
  text-shadow: 0 1px 6px var(--void);
}
.uv-menu-item {
  position: relative;
  background: none; border: none; cursor: pointer;
  padding: 10px 34px; min-height: 44px;
  font-family: var(--font-display);
  font-size: clamp(14px, 2.4vw, 18px);
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--bone-dim);
  text-shadow: 0 1px 8px var(--void);
  transition: color var(--dur-micro) var(--ease), text-shadow var(--dur-micro) var(--ease);
}
.uv-menu-item::before, .uv-menu-item::after {
  content: "◆"; position: absolute; top: 50%;
  font-size: 8px; color: var(--gold-ink);
  opacity: 0; transform: translateY(-50%) scale(0.5);
  transition: opacity var(--dur-micro) var(--ease), transform var(--dur-micro) var(--ease);
}
.uv-menu-item::before { left: 10px; }
.uv-menu-item::after { right: 10px; }
.uv-menu-item.uv-menu-hot, .uv-menu-item:hover, .uv-menu-item:focus-visible {
  color: var(--flame-hi);
  text-shadow: 0 0 14px ${shade(C.flame, 1, 0.55)}, 0 1px 8px var(--void);
  outline: none;
}
.uv-menu-item.uv-menu-hot::before, .uv-menu-item.uv-menu-hot::after,
.uv-menu-item:hover::before, .uv-menu-item:hover::after,
.uv-menu-item:focus-visible::before, .uv-menu-item:focus-visible::after {
  opacity: 1; transform: translateY(-50%) scale(1);
}
.uv-menu-primary {
  font-size: clamp(19px, 3.4vw, 25px);
  letter-spacing: 0.2em;
  color: var(--parchment);
  margin-bottom: 8px;
}
/* entry stagger: elements rise into place once mounted */
.uv-menu-stage { opacity: 0; transform: translateY(8px);
  transition: opacity var(--dur-ceremonial) var(--ease), transform var(--dur-ceremonial) var(--ease); }
.uv-menu-stage.uv-menu-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .uv-menu-ember { display: none; }
  .uv-menu-glow { animation: none; opacity: 0.6; }
  .uv-menu-sheen { animation: none; opacity: 0.5; }
  .uv-menu-stage { transition-duration: calc(var(--dur-ceremonial) / 2); transform: none; }
}
`;
  document.head.appendChild(style);
}

const REDUCED = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The live flame: a small rAF canvas whose wick tip sits exactly on the
 * backdrop's returned geometry. One TEARDROP rooted on the wick (the
 * blind panel read the old layered blobs as "two stacked glowing balls,
 * not a flame"), a bezier flame body with a vertical heat gradient, a
 * hot inner core, and a single attached glow. Sway leans the tip; the
 * root never leaves the wick.
 */
function drawFlame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fH: number, // nominal flame height in canvas px (geom.flameH of the frame)
  t: number,
  sway: number,
  flick: number,
): void {
  const C = COLOR_CSS;
  ctx.clearRect(0, 0, w, h);
  const wickX = w / 2;
  const wickY = h - fH * 0.35; // seat: room below the anchor for base glow
  const F = fH * 1.05 * flick;
  const s = sway * F * 0.14; // lateral lean, applied strongest at the tip
  ctx.globalCompositeOperation = "lighter";

  // one glow, attached, centered on the flame's belly, not floating above
  const gx = wickX + s * 0.35;
  const gy = wickY - F * 0.42;
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, F * 0.95);
  glow.addColorStop(0, shade(C.flame, 1, 0.18));
  glow.addColorStop(1, shade(C.flame, 1, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(gx - F, gy - F, F * 2, F * 2);

  // the flame body: a teardrop whose root sits ON the wick
  const tear = (height: number, width: number, lean: number, fill: CanvasGradient): void => {
    const tipX = wickX + lean;
    const tipY = wickY - height;
    const wobble = Math.sin(t * 11.3) * width * 0.12;
    ctx.beginPath();
    ctx.moveTo(wickX, wickY + F * 0.02);
    ctx.bezierCurveTo(
      wickX - width, wickY - height * 0.3,
      wickX - width * 0.42 + lean * 0.6 + wobble, wickY - height * 0.74,
      tipX, tipY,
    );
    ctx.bezierCurveTo(
      wickX + width * 0.42 + lean * 0.6 + wobble, wickY - height * 0.74,
      wickX + width, wickY - height * 0.3,
      wickX, wickY + F * 0.02,
    );
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const body = ctx.createLinearGradient(wickX, wickY + 2, wickX, wickY - F);
  body.addColorStop(0, shade(C.ember, 1, 0.7));
  body.addColorStop(0.42, shade(C.flame, 1, 0.9));
  body.addColorStop(1, shade(C.flameHi, 1, 0.92));
  tear(F, F * 0.32, s, body);

  // hot core — a smaller teardrop inside, cream-bright at the heart
  const core = ctx.createLinearGradient(wickX, wickY, wickX, wickY - F * 0.62);
  core.addColorStop(0, shade(C.flame, 1, 0.5));
  core.addColorStop(0.5, shade(C.flameHi, 1, 0.9));
  core.addColorStop(1, mix(C.flameHi, C.parchment, 0.6, 0.95));
  tear(F * 0.62, F * 0.16, s * 0.8, core);

  ctx.globalCompositeOperation = "source-over";
}

export function openMainMenu(
  host: HTMLElement,
  audio: MenuAudio,
  handlers: MenuHandlers,
  vitals?: MenuVitals,
): () => void {
  ensureUvStyles();
  injectStyles();
  const C = COLOR_CSS;
  const rand = menuRand(0x51ab);
  const root = el("div", "uv-menu");

  // ── layers ────────────────────────────────────────────────────────────
  const bg = document.createElement("canvas");
  bg.className = "uv-menu-bg uv-menu-stage";
  root.appendChild(bg);

  const glow = el("div", "uv-menu-glow uv-menu-stage");
  root.appendChild(glow);

  const flame = document.createElement("canvas");
  flame.className = "uv-menu-flame uv-menu-stage";
  root.appendChild(flame);

  // her flame (D109) — the First Flame breathes live too, once she is home
  const herFlame = document.createElement("canvas");
  herFlame.className = "uv-menu-flame uv-menu-stage";
  herFlame.style.display = "none";
  root.appendChild(herFlame);

  // the wax weeps in real time (D99), drips crawl the candle's flank
  const melt = document.createElement("canvas");
  melt.className = "uv-menu-flame uv-menu-stage";
  root.appendChild(melt);

  // the pane (D86): glass between the viewer and the vigil — above the
  // scene and the flame, below the type
  const pane = document.createElement("canvas");
  pane.className = "uv-menu-glass uv-menu-stage";
  root.appendChild(pane);
  const sheenDrift = el("div", "uv-menu-sheen uv-menu-stage");
  root.appendChild(sheenDrift);

  // ── type column ───────────────────────────────────────────────────────
  const col = el("div", "uv-menu-col");
  const eyebrow = el("div", "uv-menu-eyebrow uv-menu-stage", "One door · one candle · one day");
  const title = el("h1", "uv-menu-title uv-menu-stage", "The Undervault");
  const rule = el("div", "uv-menu-rule uv-menu-stage", "◆");
  // one whisper only — the day/lore lines belonged to the hall, not here
  // (operator: "too many text makes it messy")
  const rescued = isRescued(vitals);
  const tagline = el(
    "div",
    "uv-menu-tagline uv-menu-stage",
    rescued ? "She is home. The dark can be warmed." : "She is still down there.",
  );
  col.appendChild(eyebrow);
  col.appendChild(title);
  col.appendChild(rule);
  col.appendChild(tagline);

  const items = el("div", "uv-menu-items");
  const mkItem = (label: string, primary: boolean): HTMLButtonElement => {
    const b = el("button", `uv-menu-item${primary ? " uv-menu-primary" : ""} uv-menu-stage`, label) as HTMLButtonElement;
    b.type = "button";
    items.appendChild(b);
    return b;
  };
  const spent = vitals?.spent === true;
  const beginBtn = mkItem(spent ? "The candle is spent" : "Begin the Descent", true);
  beginBtn.classList.add("uv-menu-begin"); // harness hook
  if (spent) {
    beginBtn.disabled = true;
    beginBtn.classList.add("uv-menu-spent");
    const dusk = el("div", "uv-menu-dusk uv-menu-stage", "One candle a day. The next is cut at dusk.");
    items.appendChild(dusk);
  }
  const tellingBtn = mkItem("The Telling", false);
  const codexBtn = mkItem("The Codex", false);
  const soundBtn = mkItem(`Sound: ${audio.muted ? "off" : "on"}`, false);
  col.appendChild(items);

  // the daily pulse (D91) — two quiet lines, all that remains of the hall
  let rumorEl: HTMLElement | null = null;
  let vitalsEl: HTMLElement | null = null;
  if (vitals !== undefined) {
    rumorEl = el("div", "uv-menu-rumor uv-menu-stage", vitals.rumor);
    vitalsEl = el(
      "div",
      "uv-menu-vitals uv-menu-stage",
      rescued
        ? `Day ${vitals.day} · the Gate stands open · Codex ${vitals.codexPct}% · ${vitals.fallenToday} fallen today`
        : `Day ${vitals.day} · the Gate strains ${vitals.gatePct}% · Codex ${vitals.codexPct}% · ${vitals.fallenToday} fallen today`,
    );
    col.appendChild(rumorEl);
    col.appendChild(vitalsEl);
  }
  root.appendChild(col);

  // ── embers rise near the candle (positions set once geometry is known) ──
  const embers: HTMLElement[] = [];
  for (let i = 0; i < 7; i++) {
    const e = el("span", "uv-menu-ember");
    embers.push(e);
    root.appendChild(e);
  }

  // ── paint + layout ────────────────────────────────────────────────────
  let geom: BurnGeom = { flameX: 0.24, flameY: 0.58, flameH: 0.09 };
  let flamePx = 40; // geom.flameH in px, kept current by layout()
  let herFlamePx = 40; // geom.mother.flameH in px (D109)
  let burn = dayBurn(); // the candle IS the day (D99)
  let meltBox = { x: 0, y: 0, w: 0, h: 0 };
  let closed = false;

  const layout = (): void => {
    const rect = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    bg.width = Math.round(w * dpr);
    bg.height = Math.round(h * dpr);
    const ctx = bg.getContext("2d");
    if (ctx !== null) {
      ctx.scale(dpr, dpr);
      geom = (paintMenuBackdrop as BurnPainter)(ctx, w, h, burn, rescued);
    }
    // live-flame canvas hugs the wick tip
    const fH = geom.flameH * h;
    flamePx = fH;
    const cw = Math.max(24, Math.round(fH * 2.2));
    const ch = Math.max(32, Math.round(fH * 2.6));
    flame.width = Math.round(cw * dpr);
    flame.height = Math.round(ch * dpr);
    flame.style.width = `${cw}px`;
    flame.style.height = `${ch}px`;
    flame.style.left = `${Math.round(geom.flameX * w - cw / 2)}px`;
    // drawFlame's wick anchor sits fH*0.35 above the canvas bottom; the
    // extra fH*0.06 seats the flame INTO the painted crater rim
    flame.style.top = `${Math.round(geom.flameY * h - (ch - fH * 0.35) + fH * 0.06)}px`;
    const fctx = flame.getContext("2d");
    fctx?.scale(dpr, dpr);
    // her flame hugs the mother-wick the painter left anchored (D109);
    // geom.mother.flameY is the flame's HEART, the base sits ~0.48 fH below
    if (geom.mother !== undefined) {
      const mfH = geom.mother.flameH * h;
      herFlamePx = mfH;
      const mw2 = Math.max(24, Math.round(mfH * 2.2));
      const mh2 = Math.max(32, Math.round(mfH * 2.6));
      herFlame.width = Math.round(mw2 * dpr);
      herFlame.height = Math.round(mh2 * dpr);
      herFlame.style.width = `${mw2}px`;
      herFlame.style.height = `${mh2}px`;
      herFlame.style.left = `${Math.round(geom.mother.flameX * w - mw2 / 2)}px`;
      const wickY = geom.mother.flameY * h + mfH * 0.48;
      herFlame.style.top = `${Math.round(wickY - (mh2 - mfH * 0.35) + mfH * 0.02)}px`;
      const hctx0 = herFlame.getContext("2d");
      hctx0?.scale(dpr, dpr);
      herFlame.style.display = "";
      if (REDUCED() && hctx0 !== null && hctx0 !== undefined) drawFlame(hctx0, mw2, mh2, mfH, 0.4, 0, 1);
    } else {
      herFlame.style.display = "none";
    }
    // breathing warm pool behind the flame
    const gr = Math.round(Math.min(w, h) * 0.42);
    glow.style.width = `${gr * 2}px`;
    glow.style.height = `${gr * 2}px`;
    glow.style.left = `${Math.round(geom.flameX * w - gr)}px`;
    glow.style.top = `${Math.round(geom.flameY * h - gr * 1.06)}px`;
    glow.style.background = `radial-gradient(circle, ${shade(C.flame, 1, 0.16)} 0%, ${shade(C.ember, 1, 0.07)} 42%, transparent 68%)`;
    // the melt layer hugs the candle's body (lives once the painter
    // ships the candle box; hidden until then)
    if (geom.candle !== undefined) {
      const cb = geom.candle;
      meltBox = {
        x: Math.round(cb.left * w) - 14,
        y: Math.round(cb.top * h) - 10,
        w: Math.round((cb.right - cb.left) * w) + 28,
        h: Math.round((cb.base - cb.top) * h) + 24,
      };
      melt.width = Math.round(meltBox.w * dpr);
      melt.height = Math.round(meltBox.h * dpr);
      melt.style.width = `${meltBox.w}px`;
      melt.style.height = `${meltBox.h}px`;
      melt.style.left = `${meltBox.x}px`;
      melt.style.top = `${meltBox.y}px`;
      melt.getContext("2d")?.scale(dpr, dpr);
      melt.style.display = "";
    } else {
      melt.style.display = "none";
    }
    // the pane covers the full frame; repainted with the backdrop
    pane.width = Math.round(w * dpr);
    pane.height = Math.round(h * dpr);
    const pctx = pane.getContext("2d");
    if (pctx !== null) {
      pctx.scale(dpr, dpr);
      paintGlassOverlay(pctx, w, h, geom);
    }
    if (REDUCED() && fctx !== null) drawFlame(fctx, cw, ch, fH, 0.4, 0, 1);
  };
  layout();

  // ember field around the candle (fractions of the frame — resize-safe)
  for (const e of embers) {
    e.style.left = `${((geom.flameX + (rand() - 0.5) * 0.22) * 100).toFixed(1)}%`;
    e.style.top = `${((geom.flameY - 0.02 + rand() * 0.1) * 100).toFixed(1)}%`;
    e.style.animationDuration = `${(9 + rand() * 7).toFixed(1)}s`;
    e.style.animationDelay = `${(rand() * 9).toFixed(1)}s`;
    if (rand() < 0.4) e.style.background = C.flameHi;
  }

  let resizeRaf = 0;
  const ro = new ResizeObserver(() => {
    window.cancelAnimationFrame(resizeRaf);
    resizeRaf = window.requestAnimationFrame(layout);
  });
  ro.observe(host);

  // ── the living flame, the weeping wax, the turning of the day (D99) ────
  let flameRaf = 0;
  let gust = 0;
  let gustTarget = 0;
  let nextGustAt = 1.5;
  interface Drip { u: number; y: number; v: number; r: number }
  const drips: Drip[] = [];
  let nextDripAt = 4 + Math.random() * 6;
  let phase: "alive" | "dying" | "dark" | "reborn" = "alive";
  let phaseAt = 0;
  let lastClock = 0;
  const t0 = performance.now();
  const tick = (): void => {
    if (closed) return;
    flameRaf = window.requestAnimationFrame(tick);
    if (document.hidden) return;
    const t = (performance.now() - t0) / 1000;

    // the world clock: burn creeps with real time; past dusk the candle
    // dies, the dark holds its breath, and a fresh one is cut
    if (phase === "alive" && t - lastClock > 20) {
      lastClock = t;
      const nb = dayBurn();
      if (nb < burn - 0.5) {
        phase = "dying";
        phaseAt = t;
      } else if (Math.abs(nb - burn) > 0.004) {
        burn = nb;
        layout();
      }
    }

    if (t > nextGustAt) {
      gustTarget = (Math.random() - 0.5) * 1.6;
      nextGustAt = t + 1.2 + Math.random() * 3.4;
    }
    gust += (gustTarget - gust) * 0.03;
    gustTarget *= 0.995;
    const sway = Math.sin(t * 2.3) * 0.35 + Math.sin(t * 5.1 + 1.7) * 0.22 + gust;
    // in its final hours the flame gutters — smaller, more anxious
    const g = Math.min(1, Math.max(0, (burn - 0.85) / 0.15));
    const flick = 1 + Math.sin(t * 9.7) * 0.04 + Math.sin(t * 13.3 + 0.6) * 0.05 + Math.sin(t * 23.7) * 0.08 * g;
    let scale = 1 - 0.28 * g;
    if (phase === "dying") {
      const p = Math.min(1, (t - phaseAt) / 0.7);
      scale *= 1 - p;
      if (p >= 1) {
        phase = "dark";
        phaseAt = t;
      }
    } else if (phase === "dark") {
      scale = 0;
      if (t - phaseAt > 1.4) {
        burn = dayBurn();
        layout();
        phase = "reborn";
        phaseAt = t;
        if (woken) audio.play("relight");
      }
    } else if (phase === "reborn") {
      const p = Math.min(1, (t - phaseAt) / 0.8);
      scale = p < 0.7 ? (p / 0.7) * 1.15 : 1.15 - 0.15 * ((p - 0.7) / 0.3);
      if (p >= 1) phase = "alive";
    }

    const fctx = flame.getContext("2d");
    if (fctx === null) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const fw = flame.width / dpr;
    const fh = flame.height / dpr;
    if (scale <= 0.01) {
      // only a thread of smoke where the flame stood
      fctx.clearRect(0, 0, fw, fh);
      const sp = Math.min(1, (t - phaseAt) / 1.4);
      const sx = fw / 2;
      const sy = fh - flamePx * 0.35;
      fctx.strokeStyle = shade(C.boneDim, 1, 0.28 * (1 - sp));
      fctx.lineWidth = 1.4;
      fctx.beginPath();
      fctx.moveTo(sx, sy);
      fctx.bezierCurveTo(sx + 3, sy - 14 - sp * 22, sx - 4, sy - 26 - sp * 30, sx + 2, sy - 38 - sp * 40);
      fctx.stroke();
    } else {
      drawFlame(fctx, fw, fh, flamePx * scale, t, sway, flick);
    }

    // her flame: the same breath, calmer — restored, it neither gutters nor
    // dies with the day; a slow certain burn beside the anxious daily one
    if (geom.mother !== undefined && herFlame.style.display !== "none") {
      const hctx = herFlame.getContext("2d");
      if (hctx !== null) {
        const hw2 = herFlame.width / dpr;
        const hh2 = herFlame.height / dpr;
        const hFlick = 1 + Math.sin(t * 5.3) * 0.018 + Math.sin(t * 8.9 + 1.7) * 0.022;
        const hSway = Math.sin(t * 1.4) * 0.16 + Math.sin(t * 3.1 + 0.8) * 0.09;
        drawFlame(hctx, hw2, hh2, herFlamePx * hFlick, t * 0.8 + 3.1, hSway, hFlick);
      }
    }

    // the wax weeps: beads crawl the flank, faster as dusk nears
    const mctx = melt.getContext("2d");
    if (mctx !== null && geom.candle !== undefined && melt.style.display !== "none") {
      const mw = meltBox.w;
      const mh = meltBox.h;
      mctx.clearRect(0, 0, mw, mh);
      if (phase === "alive" && t > nextDripAt && drips.length < 3) {
        const side = Math.random() < 0.5;
        drips.push({
          u: side ? 0.12 + Math.random() * 0.14 : 0.74 + Math.random() * 0.14,
          y: 10,
          v: 5 + Math.random() * 8,
          r: 1.6 + Math.random() * 1.3,
        });
        nextDripAt = t + (g > 0 ? 2.5 + Math.random() * 3 : 6 + Math.random() * 8);
      }
      for (let i = drips.length - 1; i >= 0; i--) {
        const d = drips[i]!;
        d.y += d.v * (1 / 60) * (0.6 + 0.4 * Math.sin(t * 1.7 + d.u * 9) ** 2);
        const dx = (d.u + Math.sin(d.y * 0.05 + d.u * 20) * 0.012) * mw;
        const trail = mctx.createLinearGradient(dx, d.y - 34, dx, d.y);
        trail.addColorStop(0, shade(C.parchment, 1, 0));
        trail.addColorStop(1, shade(C.parchment, 1.06, 0.28));
        mctx.strokeStyle = trail;
        mctx.lineWidth = d.r * 1.5;
        mctx.beginPath();
        mctx.moveTo(dx, Math.max(6, d.y - 34));
        mctx.lineTo(dx, d.y);
        mctx.stroke();
        const bead = mctx.createRadialGradient(dx - d.r * 0.3, d.y - d.r * 0.3, 0, dx, d.y, d.r * 1.8);
        bead.addColorStop(0, mix(C.parchment, C.flameHi, 0.4, 0.95));
        bead.addColorStop(0.7, shade(C.parchment, 0.9, 0.75));
        bead.addColorStop(1, shade(C.parchment, 0.7, 0));
        mctx.fillStyle = bead;
        mctx.beginPath();
        mctx.ellipse(dx, d.y, d.r, d.r * 1.5, 0, 0, Math.PI * 2);
        mctx.fill();
        if (d.y > mh - 12) drips.splice(i, 1);
      }
    }
  };
  if (!REDUCED()) tick();

  // ── audio: silent until the first gesture wakes the vigil ─────────────
  let woken = false;
  const wake = (): void => {
    if (woken || closed) return;
    woken = true;
    audio.unlock();
    audio.startMenuTheme();
  };
  root.addEventListener("pointerdown", wake, { capture: true });

  const hoverTick = (): void => {
    if (woken) audio.play("inspect");
  };
  for (const b of [beginBtn, tellingBtn, codexBtn, soundBtn]) {
    b.addEventListener("mouseenter", hoverTick);
  }

  // ── selection: pointer + keyboard over the same hot state ─────────────
  const list = [beginBtn, tellingBtn, codexBtn, soundBtn];
  let hot = 0;
  let keysSuspended = false; // while the telling replays above us
  const setHot = (i: number): void => {
    hot = (i + list.length) % list.length;
    list.forEach((b, bi) => b.classList.toggle("uv-menu-hot", bi === hot));
  };
  setHot(0);
  list.forEach((b, bi) => b.addEventListener("mouseenter", () => setHot(bi)));

  const activate = (b: HTMLButtonElement): void => {
    if (closed) return;
    if (b === beginBtn) {
      if (spent) return; // the day is over — the keyboard obeys too (D98)
      handlers.onBegin();
      return;
    }
    if (woken) audio.play("sheet");
    if (b === tellingBtn) {
      keysSuspended = true;
      handlers.onTelling(() => {
        keysSuspended = false;
      });
    } else if (b === codexBtn) {
      handlers.onCodex();
    } else {
      audio.setMuted(!audio.muted);
      soundBtn.textContent = `Sound: ${audio.muted ? "off" : "on"}`;
    }
  };
  list.forEach((b) => b.addEventListener("click", () => activate(b)));

  const onKey = (ev: KeyboardEvent): void => {
    if (closed || keysSuspended) return;
    wake();
    if (ev.key === "ArrowUp" || ev.key === "w") setHot(hot - 1);
    else if (ev.key === "ArrowDown" || ev.key === "s") setHot(hot + 1);
    else if (ev.key === "Enter" || ev.key === " ") activate(list[hot]!);
  };
  window.addEventListener("keydown", onKey);

  // ── entry: the vigil assembles itself ─────────────────────────────────
  host.appendChild(root);
  const staged: [HTMLElement, number][] = [
    [bg, 0],
    [glow, 350],
    [flame, 350],
    [herFlame, 350], // hers rises with the daily flame (D109)
    [melt, 350],
    [pane, 420],
    [sheenDrift, 420],
    [title, 500],
    [eyebrow, 750],
    [rule, 800],
    [tagline, 950],
  ];
  list.forEach((b, bi) => staged.push([b, 1100 + bi * 90]));
  if (rumorEl !== null) staged.push([rumorEl, 1520]);
  if (vitalsEl !== null) staged.push([vitalsEl, 1580]);
  const reduced = REDUCED();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      for (const [node, delay] of staged) {
        node.style.transitionDelay = reduced ? "0ms" : `${delay}ms`;
        node.classList.add("uv-menu-in");
      }
    });
  });

  return () => {
    if (closed) return;
    closed = true;
    // the vigil theme is NOT stopped here — it scores the telling that
    // follows Begin; the Descent scene fades it when the hall opens (D90)
    window.cancelAnimationFrame(flameRaf);
    window.cancelAnimationFrame(resizeRaf);
    ro.disconnect();
    window.removeEventListener("keydown", onKey);
    root.remove();
  };
}
