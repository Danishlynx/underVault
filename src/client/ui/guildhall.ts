/**
 * Guildhall — "The Antechamber of the Great Gate" (D76). Full-bleed painted
 * scene replacing 04 §4.1's parchment card (deviation flagged per the
 * conflict rule): the player stands in a colossal buried antechamber before
 * the sealed Gate; near-black woodcut architecture recedes in three fog
 * stops, a field of distant delvers' candles glimmers on the steps, the
 * door's seam breathes verdigris, and a gold-ink folio frame closes the
 * composition. The enlarged match + seal is the single warm focal point —
 * the 450 ms hold visibly KINDLES it (halo blooms over exactly the hold).
 *
 * No Phaser anywhere in this file (invariant 7: splash.html ships without
 * the engine). Two static canvases painted per resize; ambient motion is
 * CSS-only (11 compositor layers, transform/opacity). Colors via tokens +
 * shade()/mix() only. Zones A–F, the openGuildhall contract, hold-to-strike
 * semantics, D64 sheet guards, D66 charge, and day-1 unfold are preserved.
 */

import { el, ensureUvStyles } from "./dom.js";
import { COLOR_CSS } from "../../../design/tokens/tokens.js";
import { shade, mix } from "../render/paint.js";

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
  "V switches the camera: room-at-a-glance, or in close with the flame.",
];

// Private LCG — do NOT use paint.ts crand(): its stream is shared with the
// world-texture painters and a resize repaint mid-session would corrupt it.
function hallRand(seed: number): () => number {
  let s = seed >>> 0 || 0x9a17;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

interface HallGeom {
  doorCx: number;
  doorCy: number;
  doorR: number;
}

// ── The backdrop: the buried antechamber ───────────────────────────────────
function paintHallBackdrop(canvas: HTMLCanvasElement, w: number, h: number): HallGeom {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  const C = COLOR_CSS;
  const doorCx = w / 2;
  const doorCy = h * 0.46;
  const doorR = Math.min(Math.max(Math.min(w, h) * 0.38, 140), 420);
  if (ctx === null) return { doorCx, doorCy, doorR };
  ctx.scale(dpr, dpr);
  const rand = hallRand(0x9a17);

  // 1. base void gradient — faint uplight behind the gate
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, C.void);
  base.addColorStop(0.45, mix(C.void, C.surface, 0.5));
  base.addColorStop(0.62, mix(C.void, C.surface2, 0.55));
  base.addColorStop(1, shade(C.void, 0.9));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // 2. far architecture — fog stop 1, hazy flat arch masses
  ctx.fillStyle = mix(C.void, C.surface, 0.35);
  for (let i = 0; i < 4; i++) {
    const aw = (0.18 + rand() * 0.12) * w;
    const ax = (i / 4) * w + rand() * 0.1 * w - aw / 2;
    const atop = h * (0.1 + rand() * 0.14);
    ctx.beginPath();
    ctx.moveTo(ax, h * 0.62);
    ctx.lineTo(ax, atop + aw / 2);
    ctx.arc(ax + aw / 2, atop + aw / 2, aw / 2, Math.PI, 0);
    ctx.lineTo(ax + aw, h * 0.62);
    ctx.closePath();
    ctx.fill();
  }

  // 3. fog band
  const fog = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.62);
  fog.addColorStop(0, mix(C.void, C.bone, 0.1, 0));
  fog.addColorStop(0.5, mix(C.void, C.bone, 0.1, 0.5));
  fog.addColorStop(1, mix(C.void, C.bone, 0.1, 0));
  ctx.fillStyle = fog;
  ctx.fillRect(0, h * 0.5, w, h * 0.12);

  // 4. THE GREAT GATE
  const disc = ctx.createRadialGradient(doorCx, doorCy - 0.15 * doorR, doorR * 0.1, doorCx, doorCy, doorR);
  disc.addColorStop(0, mix(C.surface, C.surface2, 0.6));
  disc.addColorStop(1, mix(C.void, C.surface, 0.7));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(doorCx, doorCy, doorR, 0, Math.PI * 2);
  ctx.fill();
  // rim rings
  const ring = (r: number, lw: number, a: number): void => {
    ctx.strokeStyle = shade(C.surface2, 1.3, a);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(doorCx, doorCy, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  ring(doorR, 2, 0.9);
  ring(doorR - 6, 1, 0.5);
  ring(doorR * 0.72, 1, 0.5);
  ring(doorR * 0.4, 1, 0.4);
  // ridge spokes + rivets
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.strokeStyle = shade(C.surface2, 0.8, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(doorCx + Math.cos(a) * doorR * 0.72, doorCy + Math.sin(a) * doorR * 0.72);
    ctx.lineTo(doorCx + Math.cos(a) * (doorR - 8), doorCy + Math.sin(a) * (doorR - 8));
    ctx.stroke();
    ctx.fillStyle = shade(C.surface2, 1.45);
    ctx.beginPath();
    ctx.arc(doorCx + Math.cos(a + 0.13) * doorR * 0.86, doorCy + Math.sin(a + 0.13) * doorR * 0.86, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // central boss, one whisper of gilding
  ctx.fillStyle = mix(C.surface2, C.ink, 0.4);
  ctx.beginPath();
  ctx.arc(doorCx, doorCy, doorR * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mix(C.goldInk, C.void, 0, 0.25);
  ctx.lineWidth = 1;
  ctx.stroke();
  // the seam (static base; the DOM layer breathes over it)
  const seamTop = doorCy - doorR + 8;
  const seamBot = doorCy + doorR - 8;
  const seam = (lw: number, color: string): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(doorCx, seamTop);
    ctx.lineTo(doorCx, seamBot);
    ctx.stroke();
  };
  seam(7, mix(C.void, C.verdigrisDim, 0.9, 0.18));
  seam(3, shade(C.verdigrisDim, 1, 0.5));
  seam(1, mix(C.verdigris, C.verdigrisDim, 0.3, 0.8));

  // 5. receding steps
  const stepTop = doorCy + doorR * 0.92;
  const ks = [0.5, 0.4, 0.3, 0.2];
  for (let i = 0; i < 4; i++) {
    const y0 = stepTop + ((h - stepTop) / 4) * i;
    const y1 = stepTop + ((h - stepTop) / 4) * (i + 1);
    ctx.fillStyle = mix(C.void, C.surface, ks[3 - i]!);
    ctx.fillRect(0, y0, w, y1 - y0 + 1);
    ctx.strokeStyle = shade(C.surface2, 1.2, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(w, y0);
    ctx.stroke();
  }

  // 6. candle field on the flanks (the content column owns the center)
  for (let i = 0; i < 26; i++) {
    const flank = rand() < 0.5;
    const x = (flank ? 0.05 + rand() * 0.27 : 0.68 + rand() * 0.27) * w;
    const y = doorCy + 0.5 * doorR + rand() * (h * 0.94 - doorCy - 0.5 * doorR);
    const nearness = (y - (doorCy + 0.5 * doorR)) / (h * 0.94 - doorCy - 0.5 * doorR);
    const hr = 3 + rand() * 2;
    ctx.fillStyle = mix(C.ember, C.flame, rand(), 0.1);
    ctx.beginPath();
    ctx.arc(x, y, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.flameHi, 1, 0.5 + 0.4 * nearness);
    ctx.fillRect(x - 0.5, y - 1, 1, 2);
  }

  // 7. near flank pillars — fog stop 3, darkest cutouts
  ctx.fillStyle = shade(C.void, 0.6);
  ctx.fillRect(0, 0, w * 0.14, h);
  ctx.fillRect(w * 0.86, 0, w * 0.14, h);
  for (const px of [w * 0.14, w * 0.86]) {
    const dir = px < w / 2 ? 1 : -1;
    // carved capital
    ctx.beginPath();
    ctx.moveTo(px, h * 0.28);
    ctx.lineTo(px + dir * 14, h * 0.3);
    ctx.lineTo(px + dir * 14, h * 0.33);
    ctx.lineTo(px, h * 0.35);
    ctx.closePath();
    ctx.fill();
    // hanging chain hint
    ctx.fillStyle = mix(C.void, C.bone, 0.25, 0.4);
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const cx2 = px + dir * (6 + 18 * t);
      const cy2 = h * 0.38 + 40 * t * t;
      ctx.fillRect(cx2, cy2, 2, 2);
    }
    ctx.fillStyle = shade(C.void, 0.6);
  }

  // 8. warm floor breath — the candle field's collective glow
  const breath = ctx.createLinearGradient(0, h * 0.72, 0, h * 0.85);
  breath.addColorStop(0, mix(C.void, C.ember, 0.06, 0));
  breath.addColorStop(0.5, mix(C.void, C.ember, 0.06, 0.6));
  breath.addColorStop(1, mix(C.void, C.ember, 0.06, 0));
  ctx.fillStyle = breath;
  ctx.fillRect(0, h * 0.72, w, h * 0.13);

  // 9. top crush
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.18);
  crush.addColorStop(0, shade(C.void, 0.7, 0.8));
  crush.addColorStop(1, shade(C.void, 0.7, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.18);

  return { doorCx, doorCy, doorR };
}

// ── The foreground: gold-ink folio frame ───────────────────────────────────
function paintHallFrame(canvas: HTMLCanvasElement, w: number, h: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  ctx.scale(dpr, dpr);
  const C = COLOR_CSS;

  // corner vignettes
  const r = Math.min(w, h) * 0.5;
  for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]] as const) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, shade(C.void, 0.5, 0.55));
    g.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // gold double-rule
  ctx.strokeStyle = mix(C.void, C.goldInk, 0.55, 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(10.5, 10.5, w - 21, h - 21);
  ctx.strokeStyle = mix(C.void, C.goldInk, 0.55, 0.3);
  ctx.strokeRect(16.5, 16.5, w - 33, h - 33);

  // corner blooms
  for (const [cx, cy] of [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]] as const) {
    ctx.fillStyle = shade(C.void, 0.5);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-13, -13, 26, 26);
    ctx.fillStyle = mix(C.goldInk, C.void, 0, 0.55);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
    ctx.strokeStyle = mix(C.goldInk, C.bone, 0.3, 0.4);
    ctx.lineWidth = 1.5;
    const sx = cx < w / 2 ? 1 : -1;
    const sy = cy < h / 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(cx + sx * 14, cy);
    ctx.quadraticCurveTo(cx + sx * 30, cy - sy * 4, cx + sx * 42, cy + sy * 4);
    ctx.moveTo(cx, cy + sy * 14);
    ctx.quadraticCurveTo(cx - sx * 4, cy + sy * 30, cx + sx * 4, cy + sy * 42);
    ctx.stroke();
  }

  // folio diamonds
  ctx.fillStyle = mix(C.goldInk, C.void, 0, 0.35);
  for (const [dx, dy] of [[w / 2, 16], [w / 2, h - 16]] as const) {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
}

let styled = false;

function injectStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = `
.uv-hall {
  position: absolute; inset: 0; z-index: 10;
  background: var(--void);
  overflow: hidden;
}
.uv-hall-sky, .uv-hall-fg {
  position: absolute; inset: 0; width: 100%; height: 100%;
}
.uv-hall-fg { pointer-events: none; }
.uv-hall-sky { animation: uv-hall-fade var(--dur-ceremonial) var(--ease) both; }
.uv-hall-fg { animation: uv-hall-fade var(--dur-ceremonial) var(--ease) both; }
@keyframes uv-hall-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes uv-hall-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

/* the door seam, breathing */
.uv-hall-seam {
  position: absolute; width: 8px; pointer-events: none;
  background: linear-gradient(to bottom, transparent,
    color-mix(in srgb, var(--verdigris) 28%, transparent) 20% 80%, transparent);
  box-shadow: 0 0 14px 3px color-mix(in srgb, var(--verdigris) 13%, transparent);
  animation: uv-seam-breathe 4200ms ease-in-out infinite alternate,
             uv-hall-fade var(--dur-ceremonial) var(--ease) var(--dur-standard) both;
}
@keyframes uv-seam-breathe { from { opacity: 0.45; } to { opacity: 0.85; } }

/* embers */
.uv-hall-embers { position: absolute; inset: 0; pointer-events: none;
  animation: uv-hall-fade var(--dur-ceremonial) var(--ease) var(--dur-standard) both; }
.uv-hall-ember {
  position: absolute; bottom: 6%; border-radius: 50%;
  background: var(--flame);
  box-shadow: 0 0 6px 1px color-mix(in srgb, var(--ember) 55%, transparent);
  opacity: 0; will-change: transform, opacity;
  animation: uv-ember-rise 11s linear infinite;
}
@keyframes uv-ember-rise {
  0%   { transform: translate3d(0, 0, 0); opacity: 0; }
  8%   { opacity: 0.7; }
  55%  { transform: translate3d(var(--uv-sway), -38vh, 0); opacity: 0.4; }
  100% { transform: translate3d(calc(var(--uv-sway) * -0.6), -72vh, 0); opacity: 0; }
}

/* content column */
.uv-hall-scroll {
  position: absolute; inset: 0;
  overflow-y: auto;
  display: flex; flex-direction: column; align-items: center;
  padding: 28px var(--gutter-mobile);
  box-sizing: border-box;
  font-family: var(--font-body);
  font-size: var(--size-body);
  line-height: var(--lh-body);
  color: var(--bone);
}
.uv-hall-scroll > * { width: min(440px, 100%); flex-shrink: 0; }
/* the scene is busy behind the words — ink them onto the dark */
.uv-hall-scroll { text-shadow: 0 1px 8px var(--void), 0 0 3px var(--void); }

/* short viewports (landscape phones/laptop embeds): compact the rite so
   the seal and its label stay above the fold */
@media (max-height: 620px) {
  .uv-hall-scroll { padding-top: 12px; }
  .uv-hall-day { font-size: calc(var(--size-display-1) * 1.5); }
  .uv-hall-charge { margin-top: 4px; max-width: 52ch; }
  .uv-hall-stagewrap { height: 96px; }
  .uv-hall-match { height: 88px; width: 12px; }
  .uv-hall-match-head { width: 12px; height: 17px; }
  .uv-hall-match-stick { left: 3.5px; width: 5px; top: 15px; }
  .uv-hall-hero { padding-top: 4px; }
  .uv-hall-hold { width: 58px !important; height: 58px !important; margin-top: 6px; }
  .uv-hall-pulse { margin-top: var(--pad-component); }
  .uv-hall-stat { padding: 8px; }
}

/* zone A — the illuminated day */
.uv-hall-head {
  text-align: center;
  animation: uv-hall-rise var(--dur-sheet) var(--ease) calc(var(--dur-standard) * 2) both;
}
.uv-hall-eyebrow {
  font-family: var(--font-display);
  font-size: var(--size-body-sm);
  letter-spacing: 0.34em; text-transform: uppercase;
  color: var(--gold-ink);
}
.uv-hall-day {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(calc(var(--size-display-1) * 1.7), 10vh, calc(var(--size-display-1) * 3));
  line-height: var(--lh-display);
  font-weight: normal;
  color: var(--parchment);
  display: flex; align-items: center; justify-content: center; gap: 14px;
}
.uv-hall-day::before, .uv-hall-day::after {
  content: ""; height: 1px; flex: 1 1 0; max-width: 90px;
  background: linear-gradient(to right, transparent, color-mix(in srgb, var(--gold-ink) 45%, transparent));
}
.uv-hall-day::after {
  background: linear-gradient(to left, transparent, color-mix(in srgb, var(--gold-ink) 45%, transparent));
}
.uv-hall-moon { color: var(--bone-dim); font-size: var(--size-body-sm); font-style: italic; }

/* the charge */
.uv-hall-charge {
  margin: var(--pad-component) auto 0;
  text-align: center;
  font-family: var(--font-display);
  font-style: italic;
  font-size: var(--size-body);
  color: var(--bone);
  max-width: 40ch;
  animation: uv-hall-rise var(--dur-sheet) var(--ease) calc(var(--dur-standard) * 3) both;
}

/* zone B — the hero */
.uv-hall-hero {
  display: flex; flex-direction: column; align-items: center;
  padding-top: var(--pad-component-lg);
  position: relative;
  animation: uv-hall-rise var(--dur-sheet) var(--ease) calc(var(--dur-standard) * 4) both;
}
.uv-hall-stagewrap { position: relative; height: 168px; display: flex; align-items: flex-end; justify-content: center; }
.uv-hall-halo {
  position: absolute; top: -22px; left: 50%; width: 180px; height: 180px;
  transform: translateX(-50%) scale(0.2); opacity: 0;
  background: radial-gradient(circle,
    color-mix(in srgb, var(--flame-hi) 30%, transparent),
    color-mix(in srgb, var(--flame) 12%, transparent) 45%, transparent 70%);
  transition: transform var(--dur-micro) var(--ease), opacity var(--dur-micro) var(--ease);
  pointer-events: none;
}
.uv-hall-holding .uv-hall-halo {
  transform: translateX(-50%) scale(1.35); opacity: 1;
  transition: transform ${HOLD_MS}ms linear, opacity ${HOLD_MS}ms linear;
}
.uv-hall-match { position: relative; width: 14px; height: 150px; }
.uv-hall-match-head {
  position: absolute; top: 0; left: 0; width: 14px; height: 22px;
  background: color-mix(in srgb, var(--seal) 55%, var(--ink));
  border-radius: 50% 50% 42% 42%;
  transition: background ${HOLD_MS}ms linear;
}
.uv-hall-holding .uv-hall-match-head { background: var(--flame-hi); }
.uv-hall-match-stick {
  box-sizing: border-box;
  position: absolute; top: 20px; bottom: 0; left: 4.5px; width: 5px;
  background: linear-gradient(to right,
    color-mix(in srgb, var(--verdigris) 30%, var(--parchment-aged)),
    var(--parchment-aged) 40%);
  border: 1px solid var(--ink-soft);
  border-radius: var(--radius);
}
.uv-hall-hold {
  position: relative; overflow: hidden;
  touch-action: none; user-select: none; -webkit-user-select: none;
  margin-top: var(--pad-component);
  width: 72px !important; height: 72px !important;
  box-shadow: inset 0 -3px 0 rgba(0,0,0,0.25),
    0 0 0 1px var(--gold-ink),
    0 0 24px color-mix(in srgb, var(--ember) 25%, transparent);
}
.uv-hall-hold-fill {
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
.uv-hall .uv-seal-label { color: var(--parchment); }

/* zone C — engraved plaques */
.uv-hall-pulse {
  display: flex; gap: var(--pad-component);
  text-align: center;
  margin: var(--pad-component-lg) 0 0;
}
.uv-hall-pulse .uv-hall-stat:nth-child(1) { animation: uv-hall-rise var(--dur-sheet) var(--ease) calc(var(--dur-standard) * 5) both; }
.uv-hall-pulse .uv-hall-stat:nth-child(2) { animation: uv-hall-rise var(--dur-sheet) var(--ease) calc(var(--dur-standard) * 5 + var(--dur-micro)) both; }
.uv-hall-pulse .uv-hall-stat:nth-child(3) { animation: uv-hall-rise var(--dur-sheet) var(--ease) calc(var(--dur-standard) * 5 + var(--dur-micro) * 2) both; }
.uv-hall-stat {
  flex: 1 1 0;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  border: 1px solid var(--border-void);
  border-radius: var(--radius);
  padding: var(--pad-component);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--bone) 10%, transparent),
    0 2px 0 color-mix(in srgb, var(--void) 60%, transparent);
}
.uv-hall-stat-value {
  display: block;
  font-family: var(--font-display);
  font-size: var(--size-display-2);
  line-height: var(--lh-display);
  color: var(--parchment);
}
.uv-hall-stat-value.uv-hall-gate { color: var(--flame); }
.uv-hall-stat .uv-dim { display: block; font-size: var(--size-body-sm); font-style: italic; }

/* zones D–F */
.uv-hall-rumor {
  margin: var(--pad-component-lg) 0 0;
  font-family: var(--font-display);
  font-style: italic;
  text-align: center;
  color: color-mix(in srgb, var(--parchment) 72%, var(--verdigris));
  animation: uv-hall-rise var(--dur-sheet) var(--ease) calc(var(--dur-standard) * 6) both;
}
.uv-hall-quill { color: var(--verdigris); font-style: normal; }
.uv-hall-house {
  margin: var(--pad-component) 0 0; text-align: center;
  color: var(--parchment-aged);
  animation: uv-hall-rise var(--dur-sheet) var(--ease) calc(var(--dur-standard) * 6) both;
}
.uv-hall-pennant { color: var(--seal); }
.uv-hall-foot {
  display: flex; justify-content: center; gap: var(--pad-component-lg);
  margin-top: var(--pad-component-lg);
  animation: uv-hall-rise var(--dur-sheet) var(--ease) calc(var(--dur-standard) * 6) both;
}
.uv-hall-foot .uv-ink-btn { margin: 4px 0; }
.uv-hall-how { margin-top: var(--pad-component);
  animation: uv-hall-rise var(--dur-sheet) var(--ease) calc(var(--dur-standard) * 6) both; }

/* hall-scoped shared-class re-inks (dark scene, not parchment card) */
.uv-hall .uv-dim { color: var(--bone); }
.uv-hall .uv-list li { border-bottom-color: var(--border-void); }
.uv-hall .uv-ink-btn {
  color: var(--parchment-aged);
  text-decoration-color: color-mix(in srgb, var(--flame) 55%, transparent);
}

/* reduced motion (04 §5: flicker→steady, unroll→fade, durations halve) */
@media (prefers-reduced-motion: reduce) {
  .uv-hall-ember { display: none; }
  .uv-hall-seam { animation: uv-hall-fade calc(var(--dur-ceremonial) / 2) var(--ease) both; opacity: 0.65; }
  .uv-hall-sky, .uv-hall-fg, .uv-hall-embers { animation-duration: calc(var(--dur-ceremonial) / 2); }
  .uv-hall-head, .uv-hall-charge, .uv-hall-hero, .uv-hall-stat,
  .uv-hall-rumor, .uv-hall-house, .uv-hall-foot, .uv-hall-how {
    animation-name: uv-hall-fade; animation-duration: calc(var(--dur-sheet) / 2);
  }
  .uv-hall-holding .uv-hall-halo {
    transform: translateX(-50%) scale(1.35);
    transition: opacity ${HOLD_MS}ms linear;
  }
}
.uv-hall.uv-reduced .uv-hall-ember { display: none; }
.uv-hall.uv-reduced .uv-hall-seam { animation: uv-hall-fade calc(var(--dur-ceremonial) / 2) var(--ease) both; opacity: 0.65; }
.uv-hall.uv-reduced .uv-hall-head, .uv-hall.uv-reduced .uv-hall-charge,
.uv-hall.uv-reduced .uv-hall-hero, .uv-hall.uv-reduced .uv-hall-stat,
.uv-hall.uv-reduced .uv-hall-rumor, .uv-hall.uv-reduced .uv-hall-house,
.uv-hall.uv-reduced .uv-hall-foot, .uv-hall.uv-reduced .uv-hall-how {
  animation-name: uv-hall-fade; animation-duration: calc(var(--dur-sheet) / 2);
}
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

  // ── the painted scene ──
  const sky = document.createElement("canvas");
  sky.className = "uv-hall-sky";
  backdrop.appendChild(sky);
  const seamEl = el("div", "uv-hall-seam");
  backdrop.appendChild(seamEl);
  const embers = el("div", "uv-hall-embers");
  const emberRand = hallRand(0xe3be5);
  for (let i = 0; i < 9; i++) {
    const em = el("div", "uv-hall-ember");
    const flank = emberRand() < 0.5;
    em.style.left = `${(flank ? 12 + emberRand() * 22 : 66 + emberRand() * 22).toFixed(1)}%`;
    const sz = 2 + emberRand() * 2;
    em.style.width = `${sz.toFixed(1)}px`;
    em.style.height = `${sz.toFixed(1)}px`;
    em.style.setProperty("--uv-sway", `${(emberRand() * 28 - 14).toFixed(1)}px`);
    em.style.animationDuration = `${(9 + emberRand() * 5).toFixed(2)}s`;
    em.style.animationDelay = `${(emberRand() * 9).toFixed(2)}s`;
    embers.appendChild(em);
  }
  backdrop.appendChild(embers);
  const fg = document.createElement("canvas");
  fg.className = "uv-hall-fg";
  backdrop.appendChild(fg);

  const layoutScene = (): void => {
    const rect = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const geom = paintHallBackdrop(sky, w, h);
    paintHallFrame(fg, w, h);
    seamEl.style.left = `${geom.doorCx - 5}px`;
    seamEl.style.top = `${geom.doorCy - geom.doorR + 8}px`;
    seamEl.style.height = `${2 * (geom.doorR - 8)}px`;
  };

  // ── the content column ──
  const scroll = el("div", "uv-hall-scroll");
  backdrop.appendChild(scroll);

  // A — the illuminated day
  const head = el("header", "uv-hall-head");
  head.appendChild(el("div", "uv-hall-eyebrow", "DAY"));
  head.appendChild(el("h1", "uv-hall-day", String(model.day)));
  head.appendChild(el("div", "uv-hall-moon", "☾ the Vault reshuffles at dusk"));
  scroll.appendChild(head);

  // the charge — a player must never wonder what the game is asking (D66)
  scroll.appendChild(
    el(
      "p",
      "uv-hall-charge",
      "One candle a day. Descend the shared Vault, learn its hidden laws, " +
        "and bank them at the waystones — what you learn is all that survives you.",
    ),
  );

  // B — hero: the match above the strike seal, kindled by the hold
  const hero = el("div", "uv-hall-hero");
  const stagewrap = el("div", "uv-hall-stagewrap");
  const halo = el("div", "uv-hall-halo");
  stagewrap.appendChild(halo);
  const match = el("div", "uv-hall-match");
  match.appendChild(el("div", "uv-hall-match-stick"));
  match.appendChild(el("div", "uv-hall-match-head"));
  stagewrap.appendChild(match);
  hero.appendChild(stagewrap);

  const seal = el("button", "uv-seal-btn uv-hall-hold") as HTMLButtonElement;
  seal.type = "button";
  seal.appendChild(el("span", "uv-hall-hold-fill"));
  hero.appendChild(seal);
  hero.appendChild(el("span", "uv-seal-label", "STRIKE THE MATCH"));
  scroll.appendChild(hero);

  let holdTimer: number | undefined;
  const startHold = (): void => {
    if (holdTimer !== undefined) return;
    // a sheet (Codex) above the hall swallows the strike — keyboard focus
    // must not light the match behind an open book (D64)
    if (host.querySelector(".uv-backdrop") !== null) return;
    hero.classList.add("uv-hall-holding");
    holdTimer = window.setTimeout(() => {
      holdTimer = undefined;
      hero.classList.remove("uv-hall-holding");
      onStrike();
    }, HOLD_MS);
  };
  const cancelHold = (): void => {
    if (holdTimer !== undefined) {
      window.clearTimeout(holdTimer);
      holdTimer = undefined;
    }
    hero.classList.remove("uv-hall-holding");
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

  // C — community pulse: three engraved plaques
  const stat = (value: string, label: string, gate = false): HTMLElement => {
    const cell = el("div", "uv-hall-stat");
    cell.appendChild(el("b", `uv-hall-stat-value${gate ? " uv-hall-gate" : ""}`, value));
    cell.appendChild(el("span", "uv-dim", label));
    return cell;
  };
  const pulse = el("div", "uv-hall-pulse");
  pulse.appendChild(stat(`${model.gatePct}%`, "the Great Gate strains", true));
  pulse.appendChild(stat(`${model.codexPct}%`, "of the Codex inked"));
  pulse.appendChild(stat(`${model.fallenToday}`, "delvers have fallen today"));
  scroll.appendChild(pulse);

  // D — rumor strip (empty → the Vault keeps its counsel).
  const rumor = el("p", "uv-hall-rumor");
  rumor.appendChild(el("span", "uv-hall-quill", "❧ "));
  rumor.appendChild(
    document.createTextNode(model.omenRumor === "" ? "The Vault keeps its counsel." : model.omenRumor),
  );
  scroll.appendChild(rumor);

  // E — your line.
  const house = el("p", "uv-hall-house");
  house.appendChild(el("span", "uv-hall-pennant", "⚑ "));
  house.appendChild(document.createTextNode(model.houseLine));
  scroll.appendChild(house);

  // F — footer InkButtons.
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
  scroll.appendChild(foot);
  scroll.appendChild(how);

  host.appendChild(backdrop);
  layoutScene();
  let rafId = 0;
  const ro = new ResizeObserver(() => {
    window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(layoutScene);
  });
  ro.observe(backdrop);

  return () => {
    cancelHold();
    ro.disconnect();
    window.cancelAnimationFrame(rafId);
    backdrop.remove();
  };
}
