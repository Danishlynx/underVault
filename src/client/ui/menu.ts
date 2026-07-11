/**
 * The Main Menu — "The Vigil" (D84). The first screen of every session:
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

export interface MenuModel {
  day: number;
}

/** Structural slice of AudioGraph the menu needs (keeps this file decoupled). */
export interface MenuAudio {
  unlock(): void;
  startMenuTheme(): void;
  stopMenuTheme(): void;
  play(cue: "inspect" | "sheet"): void;
  setMuted(m: boolean): void;
  readonly muted: boolean;
}

export interface MenuHandlers {
  onBegin: () => void;
  /** Replay the telling; call `done` when the story closes. */
  onTelling: (done: () => void) => void;
  onCodex: () => void;
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
.uv-menu-day {
  margin-top: 4px;
  font-family: var(--font-body); font-size: var(--size-body-sm);
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--bone-dim);
  text-shadow: 0 1px 8px var(--void);
}
.uv-menu-items {
  margin-top: clamp(18px, 5vh, 44px);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
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
.uv-menu-foot {
  position: absolute; left: 0; right: 0; bottom: 14px;
  text-align: center;
  font-family: var(--font-body); font-size: var(--size-body-sm);
  color: var(--bone-dim); opacity: 0.8;
  text-shadow: 0 1px 6px var(--void);
}
/* entry stagger: elements rise into place once mounted */
.uv-menu-stage { opacity: 0; transform: translateY(8px);
  transition: opacity var(--dur-ceremonial) var(--ease), transform var(--dur-ceremonial) var(--ease); }
.uv-menu-stage.uv-menu-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .uv-menu-ember { display: none; }
  .uv-menu-glow { animation: none; opacity: 0.6; }
  .uv-menu-stage { transition-duration: calc(var(--dur-ceremonial) / 2); transform: none; }
}
`;
  document.head.appendChild(style);
}

const REDUCED = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The live flame: a small rAF canvas whose wick tip sits exactly on the
 * backdrop's returned geometry. Composed of additive radial layers —
 * halo, ember base, flame body, bright tip, cream core, and a verdigris
 * root (the First Flame remembers the Gate). Sway = two incommensurate
 * sines + an occasional gust.
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
  const s = sway * F * 0.16;
  ctx.globalCompositeOperation = "lighter";
  const blob = (cx: number, cy: number, r: number, color: string, a: number): void => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
    g.addColorStop(0, shade(color, 1, a));
    g.addColorStop(1, shade(color, 1, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  // every radius stays inside the canvas — a clipped halo reads as a box
  blob(wickX + s * 0.4, wickY - F * 0.45, F * 0.85, C.flame, 0.15); // halo
  blob(wickX + s * 0.3, wickY - F * 0.28, F * 0.4, C.ember, 0.5); // base
  blob(wickX + s * 0.6, wickY - F * 0.5, F * 0.33, C.flame, 0.8); // body
  blob(wickX + s + Math.sin(t * 11.3) * F * 0.03, wickY - F * 0.76, F * 0.19, C.flameHi, 0.9); // tip
  blob(wickX + s * 0.5, wickY - F * 0.34, F * 0.12, mix(C.flameHi, C.parchment, 0.6), 0.95); // core
  blob(wickX, wickY - F * 0.04, F * 0.07, C.verdigris, 0.3); // root
  ctx.globalCompositeOperation = "source-over";
}

export function openMainMenu(
  host: HTMLElement,
  model: MenuModel,
  audio: MenuAudio,
  handlers: MenuHandlers,
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

  // ── type column ───────────────────────────────────────────────────────
  const col = el("div", "uv-menu-col");
  const eyebrow = el("div", "uv-menu-eyebrow uv-menu-stage", "One door · one candle · one day");
  const title = el("h1", "uv-menu-title uv-menu-stage", "The Undervault");
  const rule = el("div", "uv-menu-rule uv-menu-stage", "◆");
  const tagline = el("div", "uv-menu-tagline uv-menu-stage", "She is still down there.");
  const dayLine = el(
    "div",
    "uv-menu-day uv-menu-stage",
    `Day ${model.day} — the laws have shifted`,
  );
  col.appendChild(eyebrow);
  col.appendChild(title);
  col.appendChild(rule);
  col.appendChild(tagline);
  col.appendChild(dayLine);

  const items = el("div", "uv-menu-items");
  const mkItem = (label: string, primary: boolean): HTMLButtonElement => {
    const b = el("button", `uv-menu-item${primary ? " uv-menu-primary" : ""} uv-menu-stage`, label) as HTMLButtonElement;
    b.type = "button";
    items.appendChild(b);
    return b;
  };
  const beginBtn = mkItem("Begin the Descent", true);
  beginBtn.classList.add("uv-menu-begin"); // harness hook
  const tellingBtn = mkItem("The Telling", false);
  const codexBtn = mkItem("The Codex", false);
  const soundBtn = mkItem(`Sound — ${audio.muted ? "off" : "on"}`, false);
  col.appendChild(items);
  root.appendChild(col);

  const foot = el(
    "div",
    "uv-menu-foot uv-menu-stage",
    "One candle per delver. What you learn outlives you.",
  );
  root.appendChild(foot);

  // ── embers rise near the candle (positions set once geometry is known) ──
  const embers: HTMLElement[] = [];
  for (let i = 0; i < 7; i++) {
    const e = el("span", "uv-menu-ember");
    embers.push(e);
    root.appendChild(e);
  }

  // ── paint + layout ────────────────────────────────────────────────────
  let geom: MenuGeom = { flameX: 0.24, flameY: 0.58, flameH: 0.09 };
  let flamePx = 40; // geom.flameH in px, kept current by layout()
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
      geom = paintMenuBackdrop(ctx, w, h);
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
    // breathing warm pool behind the flame
    const gr = Math.round(Math.min(w, h) * 0.42);
    glow.style.width = `${gr * 2}px`;
    glow.style.height = `${gr * 2}px`;
    glow.style.left = `${Math.round(geom.flameX * w - gr)}px`;
    glow.style.top = `${Math.round(geom.flameY * h - gr * 1.06)}px`;
    glow.style.background = `radial-gradient(circle, ${shade(C.flame, 1, 0.16)} 0%, ${shade(C.ember, 1, 0.07)} 42%, transparent 68%)`;
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

  // ── the living flame ──────────────────────────────────────────────────
  let flameRaf = 0;
  let gust = 0;
  let gustTarget = 0;
  let nextGustAt = 1.5;
  const t0 = performance.now();
  const tick = (): void => {
    if (closed) return;
    flameRaf = window.requestAnimationFrame(tick);
    if (document.hidden) return;
    const t = (performance.now() - t0) / 1000;
    if (t > nextGustAt) {
      gustTarget = (Math.random() - 0.5) * 1.6;
      nextGustAt = t + 1.2 + Math.random() * 3.4;
    }
    gust += (gustTarget - gust) * 0.03;
    gustTarget *= 0.995;
    const sway = Math.sin(t * 2.3) * 0.35 + Math.sin(t * 5.1 + 1.7) * 0.22 + gust;
    const flick = 1 + Math.sin(t * 9.7) * 0.04 + Math.sin(t * 13.3 + 0.6) * 0.05;
    const fctx = flame.getContext("2d");
    if (fctx === null) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    drawFlame(fctx, flame.width / dpr, flame.height / dpr, flamePx, t, sway, flick);
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
      soundBtn.textContent = `Sound — ${audio.muted ? "off" : "on"}`;
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
    [title, 500],
    [eyebrow, 750],
    [rule, 800],
    [tagline, 950],
    [dayLine, 1050],
    [foot, 1500],
  ];
  list.forEach((b, bi) => staged.push([b, 1150 + bi * 90]));
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
    audio.stopMenuTheme();
    window.cancelAnimationFrame(flameRaf);
    window.cancelAnimationFrame(resizeRaf);
    ro.disconnect();
    window.removeEventListener("keydown", onKey);
    root.remove();
  };
}
