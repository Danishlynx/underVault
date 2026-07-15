/**
 * "The Last Wick" — the intro cinematic (D79). Silksong-grammar painted
 * stills + sparse text, built entirely from the game's own procedural
 * painters (no Phaser, no assets — splash-safe per invariant 7). Shown
 * once per session before the first Guildhall; tap/click/Enter advances,
 * Skip always visible, auto-advances gently. Reduced motion: fades halve,
 * no drift.
 */

import { el } from "./dom.js";
import { paintTown } from "./story/town.js";
import { paintTithe } from "./story/tithe.js";
import { paintLaws } from "./story/laws.js";
import { paintCandlemaid } from "./story/candlemaid.js";
import { paintDelvers } from "./story/delvers.js";
import { paintWaystone } from "./story/waystone.js";
import { paintDescent } from "./story/descent.js";
import { paintMeeting1 } from "./story/meeting1.js";
import { paintMeeting2 } from "./story/meeting2.js";
import { paintMeeting3 } from "./story/meeting3.js";
import { paintMeeting4 } from "./story/meeting4.js";
import { paintFinale1 } from "./story/finale1.js";
import { paintFinale2 } from "./story/finale2.js";
import { paintFinale3 } from "./story/finale3.js";

interface Slide {
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  caption: string;
}

const SLIDES: Slide[] = [
  { paint: paintTown, caption: "There was a town above a door." },
  {
    paint: paintTithe,
    caption:
      "The Vault below slept, so long as it was fed. Every hearth paid the Tithe of light downward. The bargain was old, and it held.",
  },
  {
    paint: paintLaws,
    caption:
      "One dusk, the Vault changed its terms. Its laws now shift with every sunrise. What was safe yesterday kills today.",
  },
  {
    paint: paintCandlemaid,
    caption:
      "The Candlemaid — keeper of the First Flame — went down to ask why. The door sealed behind her. She has not come back.",
  },
  {
    paint: paintDelvers,
    caption:
      "Now the town sends delvers. One candle each, cut from the First Flame's stub. When your candle dies, so do you. That law has never changed.",
  },
  {
    paint: paintWaystone,
    caption:
      "What you learn below outlives you only if you carve it into the waystones. Page by page, death by death, the town is learning the way down.",
  },
  {
    paint: paintDescent,
    caption: "Twenty-five floors. Five truths open the Seal. She is still down there.\nThe Vault is listening.",
  },
];

const HOLD_MS = 6500; // gentle auto-advance; any tap moves on sooner

// The Meeting — what waits behind the Seal (D101, emotional arc D104).
// No skip: this is the game's answer, and the player broke twenty-five
// floors to hear it. Four beats: homesick question → confession in tears
// → the gift → what the Vault is, and the first smile under the earth.
const MEETING: Slide[] = [
  {
    paint: paintMeeting1,
    caption:
      "She does not turn.\n“Do they still cut their candles from mine? Do they still sing, up there, when the wicks catch?”",
  },
  {
    paint: paintMeeting2,
    caption:
      "“Every dusk I fed it my flame so it would sleep. Every dusk it dreamed new laws. I could not leave — it would have followed me up.”\nHer tears dried to wax years ago. They shine anyway.",
  },
  {
    paint: paintMeeting3,
    caption:
      "“Give me what is left of yours.”\nYour candle tips; the last of your wax runs from your hands into hers. The First Flame stands tall for the first time in living memory.",
  },
  {
    paint: paintMeeting4,
    caption:
      "“You ask what I kept. The Vault is the cold the world was made from. It was never hungry, little flame — only unlit.”\nShe smiles like a door unlocking. “One candle warms a night. A hundred will warm the Gate open. Go up and tell them I am here — the dark can be warmed, and the way up is shorter than it was.”",
  },
];

let styled = false;
function injectStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = `
.uv-story {
  position: absolute; inset: 0; z-index: 20;
  background: var(--void);
  overflow: hidden; cursor: pointer;
  user-select: none; -webkit-user-select: none;
}
.uv-story canvas {
  position: absolute; inset: 0; width: 100%; height: 100%;
  opacity: 0;
  transition: opacity var(--dur-ceremonial) var(--ease);
}
.uv-story canvas.uv-story-show { opacity: 1; }
.uv-story-caption {
  position: absolute; left: 50%; bottom: 12%;
  transform: translateX(-50%);
  width: min(560px, 86%);
  text-align: center;
  font-family: var(--font-display);
  font-style: italic;
  font-size: calc(var(--size-body) * 1.15);
  line-height: 1.6;
  color: var(--parchment);
  text-shadow: 0 1px 10px var(--void), 0 0 4px var(--void);
  white-space: pre-line;
  opacity: 0;
  transition: opacity var(--dur-ceremonial) var(--ease);
}
.uv-story-caption.uv-story-show { opacity: 1; }
.uv-story-skip {
  position: absolute; top: 14px; right: 18px;
  font-family: var(--font-body); font-size: var(--size-body-sm);
  color: var(--bone-dim);
  background: none; border: none; cursor: pointer;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--flame) 45%, transparent);
  padding: 8px;
}
.uv-story-skip:hover { color: var(--bone); }
.uv-story-dots {
  position: absolute; left: 50%; bottom: 5%;
  transform: translateX(-50%);
  display: flex; gap: 8px;
}
.uv-story-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--bone-dim); opacity: 0.4;
  transform: rotate(45deg); border-radius: 1px;
}
.uv-story-dot.uv-story-on { background: var(--gold-ink); opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .uv-story canvas, .uv-story-caption { transition-duration: calc(var(--dur-ceremonial) / 2); }
}
`;
  document.head.appendChild(style);
}

function openSlideshow(
  host: HTMLElement,
  slides: Slide[],
  opts: { skipLabel: string | null; holdMs: number },
  onDone: () => void,
  audio?: { play(cue: "sheet"): void },
): () => void {
  injectStyles();
  const root = el("div", "uv-story");

  // two stacked canvases crossfade between slides
  const canvases = [document.createElement("canvas"), document.createElement("canvas")];
  for (const c of canvases) root.appendChild(c);
  const caption = el("div", "uv-story-caption");
  root.appendChild(caption);
  const dots = el("div", "uv-story-dots");
  const dotEls: HTMLElement[] = [];
  for (let i = 0; i < slides.length; i++) {
    const d = el("span", "uv-story-dot");
    dotEls.push(d);
    dots.appendChild(d);
  }
  root.appendChild(dots);
  const skip = el("button", "uv-story-skip", opts.skipLabel ?? "") as HTMLButtonElement;
  skip.type = "button";
  if (opts.skipLabel === null) skip.style.display = "none";
  root.appendChild(skip);

  let index = -1;
  let front = 0; // which canvas is on top
  let timer = 0;
  let closed = false;

  const paintSlide = (canvas: HTMLCanvasElement, slide: Slide): void => {
    const rect = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.scale(dpr, dpr);
    slide.paint(ctx, w, h);
  };

  const finish = (): void => {
    if (closed) return;
    closed = true;
    window.clearTimeout(timer);
    root.remove();
    onDone();
  };

  const show = (i: number): void => {
    if (closed) return;
    if (i >= slides.length) {
      finish();
      return;
    }
    index = i;
    if (i > 0) audio?.play("sheet"); // a page turns in the telling (D90)
    const slide = slides[i]!;
    const back = 1 - front;
    paintSlide(canvases[back]!, slide);
    canvases[back]!.classList.add("uv-story-show");
    canvases[front]!.classList.remove("uv-story-show");
    front = back;
    caption.classList.remove("uv-story-show");
    window.setTimeout(() => {
      caption.textContent = slide.caption;
      caption.classList.add("uv-story-show");
    }, 220);
    dotEls.forEach((d, di) => d.classList.toggle("uv-story-on", di === i));
    window.clearTimeout(timer);
    // holdMs 0 = tap-paced only. The Meeting never auto-advances: the last
    // thing an ending may do is turn its own page while someone is reading.
    if (opts.holdMs > 0) timer = window.setTimeout(() => show(index + 1), opts.holdMs);
  };

  root.addEventListener("pointerup", (ev) => {
    if (ev.target === skip) return;
    show(index + 1);
  });
  skip.addEventListener("click", finish);
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === "Enter" || ev.key === " ") show(index + 1);
    if (ev.key === "Escape") finish();
  };
  window.addEventListener("keydown", onKey);

  host.appendChild(root);
  show(0);

  return () => {
    window.removeEventListener("keydown", onKey);
    finish();
  };
}

export function openStoryIntro(
  host: HTMLElement,
  onDone: () => void,
  audio?: { play(cue: "sheet"): void },
): () => void {
  return openSlideshow(host, SLIDES, { skipLabel: "Skip the telling", holdMs: HOLD_MS }, onDone, audio);
}

// The Rescue finale (D106): three more plates after the Meeting when the
// hundredth candle is given — the Long Rescue completes on screen.
const FINALE: Slide[] = [
  {
    paint: paintFinale1,
    caption:
      "On the hundredth candle, the Gate does not break. It unlocks — from the inside.\nIt was only ever waiting to be warm enough.",
  },
  {
    paint: paintFinale2,
    caption:
      "Twenty years of stairs. The whole town's light comes down the steps to meet her —\nand her shadow falls behind her, long and ordinary, like anyone's.",
  },
  {
    paint: paintFinale3,
    caption:
      "The First Flame stands in the square now. Two candles on every sill — one for the day, one for her.\nShe looks back only once, at the small dark door on the hill.\n“The Vault has a bottom. The cold does not.”",
  },
];

/** The ending behind the Seal — no skip, no clock; Escape still releases it.
 *  `finale` appends the Long Rescue's completion (the hundredth candle). */
export function openMeeting(
  host: HTMLElement,
  onDone: () => void,
  audio?: { play(cue: "sheet"): void },
  finale = false,
): () => void {
  const slides = finale ? [...MEETING, ...FINALE] : MEETING;
  return openSlideshow(host, slides, { skipLabel: null, holdMs: 0 }, onDone, audio);
}
