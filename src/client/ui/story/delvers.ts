/**
 * Story slide 5 — "One candle each." (intro cinematic painted still)
 *
 * The portioning of the First Flame. A guild table under one warm pool of
 * light: at its center the First Flame's stub — an ancient, wax-caked mound
 * on an engraved brass stand (relief rings echo the Great Gate) — and around
 * it the town's delvers, whole bodies, each with their kit. An elder leans
 * in mid-cut, knife parting a fresh segment from the mound, the other hand
 * passing a just-cut stub down into a delver's open palm. A second delver
 * (pick over the shoulder) cradles a stub already caught. The law sits at
 * the table's dark end: a snuffed, smoking stub beside folded gloves nobody
 * will claim. Behind, in receding value steps: a stair-mouth descending to a
 * verdigris deep, a queue of waiting silhouettes, shelves of burnt-out stubs
 * — one per delver who never came back. Rafters, chain, and banner close the
 * top; a near-black shoulder closes the lower right. The bottom band stays
 * calm and dark — caption text renders over it.
 *
 * Painted-still idiom per guildhall.ts: flat woodcut masses, fog-stop depth,
 * token colors through shade()/mix() only, thin ink outlines, no speckle.
 * Two-hue law: amber = flame/warmth, verdigris = the Vault below.
 * Jitter comes from a private LCG (never Math.random, never paint.ts crand).
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall hallRand pattern, own seed) — repaints stay stable.
function slideRand(seed: number): () => number {
  let s = seed >>> 0 || 0x51de5;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintDelvers(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const TAU = Math.PI * 2;
  const u = Math.min(w, h) / 480;
  const rand = slideRand(0x51de5);
  const INK = shade(C.void, 0.7, 0.9);
  const CLOAK = mix(C.void, C.inkSoft, 0.38);
  const ELDERC = mix(C.void, C.inkSoft, 0.52);
  const FIST = mix(C.void, C.inkSoft, 0.55);
  const COOLRIM = mix(C.verdigrisDim, C.void, 0.25, 0.18);

  // ── anchors ──────────────────────────────────────────────────────────────
  const cx = w * 0.5;
  const backY = h * 0.52; // table back edge
  const frontY = h * 0.705; // table front edge — the calm band begins below
  const baseY = h * 0.565; // brass stand foot on the table
  const panY = baseY - 34 * u; // drip pan under the great stub
  const flameF = { x: cx + 1 * u, y: panY - 52 * u }; // First Flame
  const dl = { x: cx - 130 * u, shY: h * 0.418, headY: h * 0.364 }; // rope+pack, receiving
  const el = { x: cx + 72 * u, shY: h * 0.338, headY: h * 0.272 }; // the elder, cutting
  const dr = { x: cx + 205 * u, shY: h * 0.42, headY: h * 0.364 }; // pick, stub just lit
  const P = { x: cx - 83 * u, y: baseY - 22 * u }; // the hand-over point — low, lit, clear of the mound
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ── shared shape helpers ─────────────────────────────────────────────────
  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  const capsulePath = (x0: number, y0: number, x1: number, y1: number, r: number): void => {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.arc(x0, y0, r, a + Math.PI / 2, a - Math.PI / 2);
    ctx.arc(x1, y1, r, a - Math.PI / 2, a + Math.PI / 2);
    ctx.closePath();
  };
  const limb = (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, fill: string): void => {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.arc(x0, y0, r0, a + Math.PI / 2, a - Math.PI / 2);
    ctx.arc(x1, y1, r1, a - Math.PI / 2, a + Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.1 * u;
    ctx.stroke();
  };
  // warm rim along whichever long edge of a limb faces the light at (lx,ly)
  const limbRim = (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, lx: number, ly: number): void => {
    const a = Math.atan2(y1 - y0, x1 - x0);
    const px = -Math.sin(a);
    const py = Math.cos(a);
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const rm = (r0 + r1) / 2;
    const dA = (mx + px * rm - lx) ** 2 + (my + py * rm - ly) ** 2;
    const dB = (mx - px * rm - lx) ** 2 + (my - py * rm - ly) ** 2;
    const s = dA < dB ? 1 : -1;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, mix(C.ember, C.flame, 0.4, 0));
    g.addColorStop(1, mix(C.ember, C.flame, 0.45, 0.55));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.moveTo(x0 + s * px * (r0 - 0.8 * u), y0 + s * py * (r0 - 0.8 * u));
    ctx.lineTo(x1 + s * px * (r1 - 0.8 * u), y1 + s * py * (r1 - 0.8 * u));
    ctx.stroke();
  };
  // fill-only disc over a limb joint — erases the capsule seam (no mannequin elbows)
  const joint = (x: number, y: number, r: number, fill: string): void => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };
  // small layered flame (halo + three tongues), lean skews the tip
  const kindle = (x: number, y: number, s: number, lean: number): void => {
    const halo = ctx.createRadialGradient(x, y - s, 0, x, y - s, s * 3.4);
    halo.addColorStop(0, shade(C.flame, 1, 0.4));
    halo.addColorStop(0.55, shade(C.flame, 1, 0.13));
    halo.addColorStop(1, shade(C.flame, 1, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - s * 3.4, y - s - s * 3.4, s * 6.8, s * 6.8);
    const tongue = (tw: number, th: number, color: string, a: number): void => {
      ctx.fillStyle = color;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(x + lean * th, y - th);
      ctx.bezierCurveTo(x + tw, y - th * 0.42, x + tw * 0.66, y, x, y);
      ctx.bezierCurveTo(x - tw * 0.66, y, x - tw + lean * th * 0.3, y - th * 0.42, x + lean * th, y - th);
      ctx.fill();
    };
    tongue(s * 0.95, s * 2.1, C.ember, 0.9);
    tongue(s * 0.7, s * 1.6, C.flame, 0.95);
    tongue(s * 0.4, s * 1.0, C.flameHi, 1);
    ctx.globalAlpha = 1;
  };
  const tableShadow = (x: number, y: number, rx: number, ry: number, a: number): void => {
    ctx.fillStyle = shade(C.void, 0.6, a);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  };
  // curling smoke — two offset strokes, tapering alpha
  const wisp = (x: number, y: number, len: number, drift: number, lw: number, a: number): void => {
    for (const [ox, oa] of [[0, a], [1.6 * u, a * 0.45]] as const) {
      ctx.strokeStyle = mix(C.boneDim, C.void, 0.25, oa);
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x + ox, y);
      ctx.bezierCurveTo(x + drift + ox, y - len * 0.3, x - drift + ox, y - len * 0.62, x + drift * 0.7 + ox, y - len);
      ctx.stroke();
    }
  };
  // hooded head, sprite-consistent: dome, void cavity, rim catching flame
  const hood = (x: number, y: number, r: number, dir: 1 | -1, fill: string): void => {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.06, dir * 0.06, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2 * u;
    ctx.stroke();
    ctx.fillStyle = shade(C.void, 0.55);
    ctx.beginPath();
    ctx.ellipse(x + dir * r * 0.4, y + r * 0.1, r * 0.46, r * 0.6, dir * 0.14, 0, TAU);
    ctx.fill();
    // warm sliver where light licks the cowl's inner far wall
    ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.4);
    ctx.lineWidth = 1 * u;
    ctx.beginPath();
    if (dir === 1) ctx.ellipse(x + r * 0.4, y + r * 0.1, r * 0.46, r * 0.6, 0.14, 0.55, 1.6);
    else ctx.ellipse(x - r * 0.4, y + r * 0.1, r * 0.46, r * 0.6, -0.14, Math.PI - 1.6, Math.PI - 0.55);
    ctx.stroke();
    // crown rim toward the flame
    ctx.strokeStyle = mix(C.inkSoft, C.flame, 0.55, 0.78);
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    if (dir === 1) ctx.ellipse(x, y, r * 0.94, r, 0.06, -1.35, 0.5);
    else ctx.ellipse(x, y, r * 0.94, r, -0.06, Math.PI - 0.5, Math.PI + 1.35);
    ctx.stroke();
    // cool counter-rim on the void side
    ctx.strokeStyle = COOLRIM;
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    if (dir === 1) ctx.ellipse(x, y, r * 0.94, r, 0.06, Math.PI - 0.4, Math.PI + 0.9);
    else ctx.ellipse(x, y, r * 0.94, r, -0.06, -0.9, 0.4);
    ctx.stroke();
  };

  // ── 1. void base ─────────────────────────────────────────────────────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, C.void);
  base.addColorStop(0.45, mix(C.void, C.surface, 0.4));
  base.addColorStop(0.62, mix(C.void, C.surface, 0.25));
  base.addColorStop(1, shade(C.void, 0.85));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. back wall — fog stop 1, faint stone courses, cold breath on top ──
  const wall = ctx.createLinearGradient(0, 0, 0, backY);
  wall.addColorStop(0, mix(C.void, C.surface, 0.3));
  wall.addColorStop(1, mix(C.void, C.surface2, 0.75));
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, backY);
  ctx.lineWidth = 1;
  let courseY = backY - 14 * u;
  while (courseY > h * 0.08) {
    ctx.strokeStyle = shade(C.surface2, 1.15, 0.06);
    ctx.beginPath();
    ctx.moveTo(0, courseY);
    ctx.lineTo(w, courseY);
    ctx.stroke();
    ctx.strokeStyle = shade(C.surface2, 1.1, 0.04);
    for (let j = 0; j < 3; j++) {
      const jx = rand() * w;
      line(jx, courseY, jx, courseY + 10 * u);
    }
    courseY -= 24 * u * (0.85 + rand() * 0.3);
  }
  const cold = ctx.createLinearGradient(0, 0, 0, h * 0.22);
  cold.addColorStop(0, mix(C.void, C.verdigrisDim, 0.18, 0.3));
  cold.addColorStop(1, mix(C.void, C.verdigrisDim, 0.18, 0));
  ctx.fillStyle = cold;
  ctx.fillRect(0, 0, w, h * 0.22);

  // ── 3. the stair-mouth — mid-depth, the descent the delvers are sent to ─
  const dwx = w * 0.145; // doorway center
  const dww = Math.min(w * 0.055, 40 * u); // half-width
  const dwTop = h * 0.175;
  ctx.fillStyle = shade(C.void, 0.5);
  ctx.beginPath();
  ctx.moveTo(dwx - dww, backY);
  ctx.lineTo(dwx - dww, dwTop + dww * 0.9);
  ctx.quadraticCurveTo(dwx, dwTop - dww * 0.35, dwx + dww, dwTop + dww * 0.9);
  ctx.lineTo(dwx + dww, backY);
  ctx.closePath();
  ctx.fill();
  // verdigris breath rising from the deep
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dwx - dww, backY);
  ctx.lineTo(dwx - dww, dwTop + dww * 0.9);
  ctx.quadraticCurveTo(dwx, dwTop - dww * 0.35, dwx + dww, dwTop + dww * 0.9);
  ctx.lineTo(dwx + dww, backY);
  ctx.closePath();
  ctx.clip();
  const deep = ctx.createRadialGradient(dwx, backY + 6 * u, 0, dwx, backY + 6 * u, dww * 2.6);
  deep.addColorStop(0, mix(C.void, C.verdigrisDim, 0.5, 0.4));
  deep.addColorStop(0.55, mix(C.void, C.verdigrisDim, 0.4, 0.16));
  deep.addColorStop(1, mix(C.void, C.verdigrisDim, 0.4, 0));
  ctx.fillStyle = deep;
  ctx.fillRect(dwx - dww * 2.6, backY - dww * 2.6, dww * 5.2, dww * 5.2);
  // treads falling away into it
  for (let i = 0; i < 4; i++) {
    const ty = backY - (3 + i * 5) * u;
    const tw2 = dww * (0.92 - i * 0.16);
    ctx.strokeStyle = mix(C.verdigrisDim, C.void, 0.35, 0.4 - i * 0.09);
    ctx.lineWidth = 1.1 * u;
    line(dwx - tw2, ty, dwx + tw2, ty);
  }
  ctx.restore();
  // jambs: stone edge, warm kiss on the flame-side jamb
  ctx.strokeStyle = shade(C.surface2, 1.35, 0.4);
  ctx.lineWidth = 1.3 * u;
  ctx.beginPath();
  ctx.moveTo(dwx - dww, backY);
  ctx.lineTo(dwx - dww, dwTop + dww * 0.9);
  ctx.quadraticCurveTo(dwx, dwTop - dww * 0.35, dwx + dww, dwTop + dww * 0.9);
  ctx.lineTo(dwx + dww, backY);
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.35, 0.18);
  line(dwx + dww - 0.8 * u, dwTop + dww, dwx + dww - 0.8 * u, backY - 2 * u);

  // ── 4. the waiting queue — value steps toward the door ──────────────────
  const waiting = (x: number, headY: number, tone: string, rimA: number, kit: 0 | 1 | 2): void => {
    const footY = backY + 4 * u;
    const hgt = footY - headY;
    const r = hgt * 0.15;
    if (kit === 1) {
      // pack hump behind the shoulder
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.ellipse(x - hgt * 0.2, headY + hgt * 0.42, hgt * 0.13, hgt * 0.19, 0.2, 0, TAU);
      ctx.fill();
    }
    if (kit === 2) {
      // walking staff
      ctx.strokeStyle = tone;
      ctx.lineWidth = 2 * u;
      line(x + hgt * 0.18, footY, x + hgt * 0.14, headY - hgt * 0.08);
    }
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(x - hgt * 0.21, footY);
    ctx.quadraticCurveTo(x - hgt * 0.17, headY + hgt * 0.5, x - hgt * 0.14, headY + hgt * 0.26);
    ctx.quadraticCurveTo(x - hgt * 0.06, headY + hgt * 0.14, x + hgt * 0.02, headY + hgt * 0.16);
    ctx.quadraticCurveTo(x + hgt * 0.13, headY + hgt * 0.2, x + hgt * 0.16, headY + hgt * 0.42);
    ctx.quadraticCurveTo(x + hgt * 0.2, headY + hgt * 0.66, x + hgt * 0.18, footY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, headY + r, r, r * 1.08, 0.05, 0, TAU);
    ctx.fill();
    // warm rim on the flame side (right)
    ctx.strokeStyle = mix(C.ember, C.flame, 0.4, rimA);
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    ctx.ellipse(x, headY + r, r * 0.92, r, 0.05, -1.2, 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + hgt * 0.15, headY + hgt * 0.4);
    ctx.quadraticCurveTo(x + hgt * 0.19, headY + hgt * 0.66, x + hgt * 0.17, footY - 2 * u);
    ctx.stroke();
  };
  waiting(w * 0.185, h * 0.375, mix(C.void, C.inkSoft, 0.1), 0.14, 0); // at the door
  waiting(w * 0.225, h * 0.355, mix(C.void, C.inkSoft, 0.16), 0.24, 2);
  waiting(w * 0.27, h * 0.335, mix(C.void, C.inkSoft, 0.22), 0.38, 1); // next to be called

  // ── 5. the tally shelves — a dead stub for every delver who stayed down ─
  const deadStub = (x: number, y: number, hgt: number, a: number): void => {
    const sw = Math.max(3 * u, hgt * 0.42);
    ctx.fillStyle = mix(C.boneDim, C.void, 0.58, a);
    ctx.beginPath();
    ctx.moveTo(x - sw / 2, y);
    ctx.lineTo(x - sw / 2 + 0.4 * u, y - hgt + 1.5 * u);
    ctx.quadraticCurveTo(x - sw * 0.1, y - hgt - 1.2 * u, x + sw / 2 - 0.3 * u, y - hgt + 1 * u);
    ctx.lineTo(x + sw / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mix(C.ember, C.flame, 0.35, a * 0.5);
    ctx.lineWidth = 1 * u;
    line(x - sw / 2 + 0.4 * u, y - hgt + 2 * u, x - sw / 2, y - u);
  };
  for (const [sy, n] of [[h * 0.195, 10], [h * 0.275, 9]] as const) {
    const sx0 = w * 0.715;
    const sx1 = w * 0.965;
    ctx.strokeStyle = shade(C.void, 0.85, 0.9);
    ctx.lineWidth = 3 * u;
    line(sx0, sy + 1.5 * u, sx1, sy + 1.5 * u);
    ctx.strokeStyle = mix(C.ember, C.goldInk, 0.5, 0.14);
    ctx.lineWidth = 1 * u;
    line(sx0, sy - 0.5 * u, sx1, sy - 0.5 * u);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      deadStub(sx0 + (sx1 - sx0) * t + (rand() - 0.5) * 6 * u, sy - u, (6 + rand() * 8) * u, 0.75 - t * 0.2);
    }
  }

  // ── 6. the flame's air — one warm heart lighting wall, queue, shelves ───
  const air = ctx.createRadialGradient(cx, panY - 6 * u, 0, cx, panY - 6 * u, 320 * u);
  air.addColorStop(0, mix(C.void, C.ember, 0.32, 0.5));
  air.addColorStop(0.5, mix(C.void, C.ember, 0.3, 0.2));
  air.addColorStop(1, mix(C.void, C.ember, 0.3, 0));
  ctx.fillStyle = air;
  ctx.fillRect(cx - 320 * u, panY - 326 * u, 640 * u, 640 * u);
  const airCore = ctx.createRadialGradient(cx, panY - 14 * u, 0, cx, panY - 14 * u, 145 * u);
  airCore.addColorStop(0, mix(C.void, C.flame, 0.4, 0.38));
  airCore.addColorStop(1, mix(C.void, C.flame, 0.4, 0));
  ctx.fillStyle = airCore;
  ctx.fillRect(cx - 145 * u, panY - 159 * u, 290 * u, 290 * u);

  // ── 7. rafters, brace, chains, banner — near-black plane over everything ─
  const beamTone = shade(C.void, 0.6);
  ctx.fillStyle = beamTone;
  ctx.fillRect(0, h * 0.045, w, 11 * u);
  ctx.fillRect(w * 0.3, h * 0.125, w * 0.7, 8 * u);
  ctx.beginPath(); // corner brace, upper-left
  ctx.moveTo(w * 0.2, h * 0.045 + 4 * u);
  ctx.lineTo(w * 0.02, h * 0.19);
  ctx.lineTo(w * 0.02, h * 0.19 + 7 * u);
  ctx.lineTo(w * 0.2, h * 0.045 + 11 * u);
  ctx.closePath();
  ctx.fill();
  // warm underside glint on the main beam, brightest over the flame
  const beamGlint = ctx.createLinearGradient(cx - 260 * u, 0, cx + 260 * u, 0);
  beamGlint.addColorStop(0, mix(C.ember, C.flame, 0.4, 0));
  beamGlint.addColorStop(0.5, mix(C.ember, C.flame, 0.4, 0.22));
  beamGlint.addColorStop(1, mix(C.ember, C.flame, 0.4, 0));
  ctx.strokeStyle = beamGlint;
  ctx.lineWidth = 1.3 * u;
  line(cx - 260 * u, h * 0.045 + 11 * u, cx + 260 * u, h * 0.045 + 11 * u);
  // chains: one bare hook, one holding a dark lantern (unlit — off duty)
  const chain = (x: number, y0: number, y1: number): void => {
    ctx.strokeStyle = mix(C.void, C.inkSoft, 0.28);
    ctx.lineWidth = 1.2 * u;
    let ly = y0;
    let odd = false;
    while (ly < y1) {
      ctx.beginPath();
      ctx.ellipse(x, ly + 3 * u, odd ? 1.6 * u : 2.4 * u, 3.2 * u, 0, 0, TAU);
      ctx.stroke();
      ly += 5.6 * u;
      odd = !odd;
    }
  };
  chain(w * 0.36, h * 0.045 + 11 * u, h * 0.205);
  chain(w * 0.6, h * 0.045 + 11 * u, h * 0.14);
  ctx.strokeStyle = mix(C.void, C.inkSoft, 0.28);
  ctx.lineWidth = 1.4 * u;
  ctx.beginPath();
  ctx.arc(w * 0.6, h * 0.145 + 3 * u, 3 * u, -0.2, Math.PI + 0.2);
  ctx.stroke();
  // the hanging lantern, cold iron, one warm lick on its lower edge
  const lnx = w * 0.36;
  const lny = h * 0.215;
  ctx.fillStyle = mix(C.void, C.ink, 0.55);
  ctx.beginPath();
  ctx.moveTo(lnx - 6.5 * u, lny);
  ctx.lineTo(lnx + 6.5 * u, lny);
  ctx.lineTo(lnx + 4.5 * u, lny + 15 * u);
  ctx.lineTo(lnx - 4.5 * u, lny + 15 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = mix(C.void, C.inkSoft, 0.4);
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(lnx, lny - 2 * u, 4 * u, 2 * u, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.3);
  line(lnx - 3.5 * u, lny + 14.6 * u, lnx + 3.8 * u, lny + 14.6 * u);
  // guild banner in the upper-left corner — a candle sigil in faded gilt
  const bx0 = w * 0.03;
  const bx1 = w * 0.095;
  ctx.fillStyle = mix(C.void, C.ink, 0.4);
  ctx.beginPath();
  ctx.moveTo(bx0, h * 0.045 + 9 * u);
  ctx.lineTo(bx1, h * 0.045 + 9 * u);
  ctx.lineTo(bx1 - 2 * u, h * 0.2);
  ctx.lineTo((bx0 + bx1) / 2, h * 0.235);
  ctx.lineTo(bx0 + 2 * u, h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.85, 0.8);
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  ctx.strokeStyle = mix(C.goldInk, C.void, 0.3, 0.3);
  ctx.lineWidth = 1.2 * u;
  const sgx = (bx0 + bx1) / 2;
  line(sgx, h * 0.115, sgx, h * 0.155);
  ctx.beginPath();
  ctx.ellipse(sgx, h * 0.104, 2 * u, 3 * u, 0, 0, TAU);
  ctx.stroke();

  // ── 8. far-side bodies (the table will clip their laps) ─────────────────
  // left delver: pack first (behind), then torso, rope coil, hood
  ctx.fillStyle = mix(C.void, C.inkSoft, 0.26);
  ctx.beginPath();
  ctx.ellipse(dl.x - 36 * u, h * 0.42, 17 * u, 23 * u, 0.25, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1 * u;
  ctx.stroke();
  ctx.strokeStyle = mix(C.void, C.inkSoft, 0.5);
  ctx.lineWidth = 1 * u;
  ctx.beginPath(); // pack flap
  ctx.moveTo(dl.x - 48 * u, h * 0.408);
  ctx.quadraticCurveTo(dl.x - 34 * u, h * 0.398, dl.x - 23 * u, h * 0.412);
  ctx.stroke();
  ctx.beginPath(); // torso
  ctx.moveTo(dl.x - 44 * u, backY + 12 * u);
  ctx.bezierCurveTo(dl.x - 42 * u, h * 0.46, dl.x - 34 * u, dl.shY + 6 * u, dl.x - 25 * u, dl.shY);
  ctx.quadraticCurveTo(dl.x - 8 * u, dl.shY - 9 * u, dl.x + 8 * u, dl.shY - 6 * u);
  ctx.quadraticCurveTo(dl.x + 20 * u, dl.shY - 3 * u, dl.x + 25 * u, dl.shY + 4 * u);
  ctx.bezierCurveTo(dl.x + 36 * u, h * 0.47, dl.x + 38 * u, h * 0.5, dl.x + 37 * u, backY + 12 * u);
  ctx.closePath();
  ctx.fillStyle = CLOAK;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3 * u;
  ctx.stroke();
  // warm rim down the flame side, cool whisper on the pack side
  ctx.strokeStyle = mix(C.inkSoft, C.flame, 0.5, 0.55);
  ctx.lineWidth = 1.5 * u;
  ctx.beginPath();
  ctx.moveTo(dl.x + 24 * u, dl.shY + 5 * u);
  ctx.bezierCurveTo(dl.x + 35 * u, h * 0.47, dl.x + 37 * u, h * 0.5, dl.x + 36 * u, backY + 8 * u);
  ctx.stroke();
  ctx.strokeStyle = COOLRIM;
  ctx.beginPath();
  ctx.moveTo(dl.x - 26 * u, dl.shY + 2 * u);
  ctx.bezierCurveTo(dl.x - 36 * u, h * 0.46, dl.x - 43 * u, h * 0.48, dl.x - 43 * u, backY + 8 * u);
  ctx.stroke();
  // coiled rope lashed at the pack's side — a solid bundle, not a floating hoop
  ctx.fillStyle = mix(C.void, C.boneDim, 0.22);
  ctx.beginPath();
  ctx.ellipse(dl.x - 27 * u, h * 0.455, 11 * u, 12.5 * u, -0.3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1 * u;
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = mix(C.void, C.boneDim, 0.4 - i * 0.07);
    ctx.lineWidth = 2.2 * u;
    ctx.beginPath();
    ctx.ellipse(dl.x - 27 * u, h * 0.455, (4 + i * 3) * u, (5 + i * 3.4) * u, -0.3, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = mix(C.boneDim, C.flame, 0.4, 0.45);
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.ellipse(dl.x - 27 * u, h * 0.455, 10 * u, 11.4 * u, -0.3, -1.3, 0.1);
  ctx.stroke();
  // strap
  ctx.strokeStyle = shade(C.void, 0.8, 0.7);
  ctx.lineWidth = 3 * u;
  line(dl.x + 12 * u, dl.shY - 2 * u, dl.x - 26 * u, h * 0.465);
  hood(dl.x + 2 * u, dl.headY, 14 * u, 1, CLOAK);

  // the elder: taller, peaked cowl, gilt-trimmed keeper's stole
  ctx.beginPath();
  ctx.moveTo(el.x - 52 * u, backY + 12 * u);
  ctx.bezierCurveTo(el.x - 50 * u, h * 0.44, el.x - 40 * u, el.shY + 10 * u, el.x - 30 * u, el.shY);
  ctx.quadraticCurveTo(el.x - 22 * u, el.shY - 8 * u, el.x - 12 * u, el.shY - 9 * u);
  ctx.quadraticCurveTo(el.x + 12 * u, el.shY - 9 * u, el.x + 24 * u, el.shY + 2 * u);
  ctx.bezierCurveTo(el.x + 42 * u, h * 0.42, el.x + 54 * u, h * 0.48, el.x + 56 * u, backY + 12 * u);
  ctx.closePath();
  ctx.fillStyle = ELDERC;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3 * u;
  ctx.stroke();
  // fold shadows, gilt stole, warm rim toward the flame (his left)
  ctx.strokeStyle = shade(C.void, 0.8, 0.5);
  ctx.lineWidth = 1.1 * u;
  for (const fx0 of [el.x - 18 * u, el.x + 6 * u, el.x + 30 * u]) {
    ctx.beginPath();
    ctx.moveTo(fx0, el.shY + 24 * u + (rand() - 0.5) * 6 * u);
    ctx.quadraticCurveTo(fx0 - 5 * u, h * 0.45, fx0 - 2 * u, backY + 8 * u);
    ctx.stroke();
  }
  ctx.strokeStyle = mix(C.goldInk, C.void, 0.25, 0.4);
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.moveTo(el.x - 12 * u, el.shY - 2 * u);
  ctx.quadraticCurveTo(el.x - 16 * u, h * 0.44, el.x - 13 * u, backY + 8 * u);
  ctx.stroke();
  ctx.strokeStyle = mix(C.inkSoft, C.flame, 0.55, 0.6);
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.moveTo(el.x - 30 * u, el.shY + 2 * u);
  ctx.bezierCurveTo(el.x - 44 * u, h * 0.42, el.x - 50 * u, h * 0.46, el.x - 51 * u, backY + 8 * u);
  ctx.stroke();
  ctx.strokeStyle = COOLRIM;
  ctx.beginPath();
  ctx.moveTo(el.x + 25 * u, el.shY + 4 * u);
  ctx.bezierCurveTo(el.x + 44 * u, h * 0.43, el.x + 55 * u, h * 0.48, el.x + 55 * u, backY + 8 * u);
  ctx.stroke();
  // peaked hood, leaning toward the work
  ctx.beginPath();
  ctx.moveTo(el.x - 26 * u, el.headY + 26 * u);
  ctx.quadraticCurveTo(el.x - 26 * u, el.headY - 8 * u, el.x - 10 * u, el.headY - 13 * u);
  ctx.quadraticCurveTo(el.x + 8 * u, el.headY - 18 * u, el.x + 17 * u, el.headY - 6 * u);
  ctx.quadraticCurveTo(el.x + 22 * u, el.headY + 6 * u, el.x + 17 * u, el.headY + 26 * u);
  ctx.closePath();
  ctx.fillStyle = ELDERC;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2 * u;
  ctx.stroke();
  ctx.fillStyle = shade(C.void, 0.55); // cowl cavity, bowed to the flame
  ctx.beginPath();
  ctx.ellipse(el.x - 13 * u, el.headY + 3 * u, 7.5 * u, 9 * u, -0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.45, 0.5); // half-lit cowl edge
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.ellipse(el.x - 13 * u, el.headY + 3 * u, 7.5 * u, 9 * u, -0.2, Math.PI - 1.5, Math.PI - 0.3);
  ctx.stroke();
  ctx.strokeStyle = mix(C.inkSoft, C.flame, 0.55, 0.75);
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.moveTo(el.x - 25 * u, el.headY + 10 * u);
  ctx.quadraticCurveTo(el.x - 26 * u, el.headY - 6 * u, el.x - 10 * u, el.headY - 12 * u);
  ctx.stroke();

  // right delver: pick behind the shoulder first, then torso and hood
  ctx.strokeStyle = mix(C.void, C.inkSoft, 0.45);
  ctx.lineWidth = 5 * u;
  line(dr.x + 10 * u, h * 0.455, dr.x + 46 * u, h * 0.33);
  ctx.fillStyle = mix(C.void, C.inkSoft, 0.55);
  ctx.beginPath(); // pick head — a full crescent, clear of the tally shelves
  ctx.moveTo(dr.x + 20 * u, h * 0.345);
  ctx.quadraticCurveTo(dr.x + 46 * u, h * 0.29, dr.x + 72 * u, h * 0.345);
  ctx.quadraticCurveTo(dr.x + 46 * u, h * 0.314, dr.x + 20 * u, h * 0.345);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.45);
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.moveTo(dr.x + 23 * u, h * 0.342);
  ctx.quadraticCurveTo(dr.x + 42 * u, h * 0.305, dr.x + 58 * u, h * 0.315);
  ctx.stroke();
  ctx.beginPath(); // torso
  ctx.moveTo(dr.x - 40 * u, backY + 12 * u);
  ctx.bezierCurveTo(dr.x - 40 * u, h * 0.47, dr.x - 32 * u, dr.shY + 6 * u, dr.x - 24 * u, dr.shY);
  ctx.quadraticCurveTo(dr.x - 10 * u, dr.shY - 8 * u, dr.x + 6 * u, dr.shY - 6 * u);
  ctx.quadraticCurveTo(dr.x + 20 * u, dr.shY - 4 * u, dr.x + 26 * u, dr.shY + 4 * u);
  ctx.bezierCurveTo(dr.x + 40 * u, h * 0.47, dr.x + 42 * u, h * 0.5, dr.x + 41 * u, backY + 12 * u);
  ctx.closePath();
  ctx.fillStyle = CLOAK;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3 * u;
  ctx.stroke();
  ctx.strokeStyle = mix(C.inkSoft, C.flame, 0.5, 0.55);
  ctx.lineWidth = 1.5 * u;
  ctx.beginPath();
  ctx.moveTo(dr.x - 24 * u, dr.shY + 2 * u);
  ctx.bezierCurveTo(dr.x - 34 * u, h * 0.47, dr.x - 39 * u, h * 0.49, dr.x - 39 * u, backY + 8 * u);
  ctx.stroke();
  ctx.strokeStyle = COOLRIM;
  ctx.beginPath();
  ctx.moveTo(dr.x + 26 * u, dr.shY + 6 * u);
  ctx.bezierCurveTo(dr.x + 39 * u, h * 0.47, dr.x + 41 * u, h * 0.49, dr.x + 40 * u, backY + 8 * u);
  ctx.stroke();
  // bandolier strap with two little pouches
  ctx.strokeStyle = shade(C.void, 0.8, 0.7);
  ctx.lineWidth = 3 * u;
  line(dr.x - 14 * u, dr.shY - 2 * u, dr.x + 26 * u, h * 0.47);
  ctx.fillStyle = mix(C.void, C.inkSoft, 0.5);
  for (const [px2, py2] of [[dr.x + 2 * u, h * 0.446], [dr.x + 14 * u, h * 0.458]] as const) {
    ctx.beginPath();
    ctx.ellipse(px2, py2, 3.5 * u, 4 * u, 0.2, 0, TAU);
    ctx.fill();
  }
  hood(dr.x - 2 * u, dr.headY, 13.5 * u, -1, CLOAK);

  // ── 9. the table: rough planks under the one pool of light ──────────────
  const tablePath = (): void => {
    ctx.beginPath();
    ctx.moveTo(0.04 * w, backY);
    ctx.lineTo(0.96 * w, backY);
    ctx.lineTo(1.06 * w, frontY);
    ctx.lineTo(-0.06 * w, frontY);
    ctx.closePath();
  };
  tablePath();
  ctx.fillStyle = mix(C.void, C.ink, 0.28);
  ctx.fill();
  ctx.save();
  tablePath();
  ctx.clip();
  ctx.save();
  ctx.translate(cx, baseY + 4 * u);
  ctx.scale(1, 0.38);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 230 * u);
  pool.addColorStop(0, mix(C.ember, C.flame, 0.3, 0.44));
  pool.addColorStop(0.55, mix(C.ember, C.flame, 0.3, 0.15));
  pool.addColorStop(1, mix(C.ember, C.flame, 0.3, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-240 * u, -240 * u, 480 * u, 480 * u);
  const core = ctx.createRadialGradient(0, -10 * u, 0, 0, -10 * u, 95 * u);
  core.addColorStop(0, mix(C.flame, C.flameHi, 0.25, 0.38));
  core.addColorStop(1, mix(C.flame, C.flameHi, 0.25, 0));
  ctx.fillStyle = core;
  ctx.fillRect(-100 * u, -110 * u, 200 * u, 200 * u);
  ctx.restore();
  // plank seams with butt joints, a little grain, no speckle
  ctx.strokeStyle = shade(C.void, 0.75, 0.85);
  ctx.lineWidth = 1.2 * u;
  for (const t of [0.3, 0.56, 0.8] as const) {
    const y = backY + (frontY - backY) * t + (rand() - 0.5) * 3 * u;
    const xl = 0.04 * w + (-0.1 * w) * t;
    const xr = 0.96 * w + 0.1 * w * t;
    ctx.beginPath();
    ctx.moveTo(xl, y);
    ctx.quadraticCurveTo((xl + xr) / 2, y + (rand() - 0.5) * 3 * u, xr, y);
    ctx.stroke();
    const jx = cx + (rand() - 0.5) * 0.5 * w;
    line(jx, y - 4.5 * u, jx + (rand() - 0.5) * 2 * u, y);
  }
  ctx.strokeStyle = mix(C.ink, C.ember, 0.25, 0.22);
  ctx.lineWidth = 1 * u;
  for (let i = 0; i < 5; i++) {
    const gy = backY + (frontY - backY) * (0.15 + rand() * 0.72);
    const gx = cx + (rand() - 0.5) * 220 * u;
    const gl = (50 + rand() * 110) * u;
    ctx.beginPath();
    ctx.moveTo(gx - gl / 2, gy);
    ctx.quadraticCurveTo(gx, gy + (rand() - 0.5) * 4 * u, gx + gl / 2, gy);
    ctx.stroke();
  }
  ctx.restore();
  // nicked back edge + a glint where the pool spills over it
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2 * u;
  line(0.04 * w, backY, 0.96 * w, backY);
  for (let i = 0; i < 3; i++) {
    const nx = w * (0.18 + rand() * 0.64);
    line(nx, backY, nx + 3 * u, backY + 2 * u);
  }
  const glint = ctx.createLinearGradient(cx - 180 * u, 0, cx + 180 * u, 0);
  glint.addColorStop(0, mix(C.ember, C.flame, 0.35, 0));
  glint.addColorStop(0.5, mix(C.ember, C.flame, 0.35, 0.4));
  glint.addColorStop(1, mix(C.ember, C.flame, 0.35, 0));
  ctx.strokeStyle = glint;
  ctx.lineWidth = 1.6 * u;
  line(cx - 180 * u, backY + u, cx + 180 * u, backY + u);
  // table front falls into the dark — the caption's calm ground
  const front = ctx.createLinearGradient(0, frontY, 0, frontY + h * 0.14);
  front.addColorStop(0, mix(C.void, C.ink, 0.22));
  front.addColorStop(1, C.void);
  ctx.fillStyle = front;
  ctx.fillRect(0, frontY, w, h - frontY);
  const lip = ctx.createLinearGradient(cx - 130 * u, 0, cx + 130 * u, 0);
  lip.addColorStop(0, mix(C.ember, C.goldInk, 0.4, 0));
  lip.addColorStop(0.5, mix(C.ember, C.goldInk, 0.4, 0.22));
  lip.addColorStop(1, mix(C.ember, C.goldInk, 0.4, 0));
  ctx.strokeStyle = lip;
  ctx.lineWidth = 1.2 * u;
  line(cx - 130 * u, frontY + 0.5 * u, cx + 130 * u, frontY + 0.5 * u);

  // ── 10. tabletop still-life ──────────────────────────────────────────────
  // THE LAW, stated quietly: a snuffed stub, folded gloves, no owner.
  const gx0 = w * 0.14;
  const gy0 = baseY + 18 * u;
  tableShadow(gx0 + 2 * u, gy0 + 3 * u, 10 * u, 3.5 * u, 0.4);
  ctx.fillStyle = mix(C.boneDim, C.void, 0.5);
  ctx.beginPath(); // the dead stub — burnt low, bowed
  ctx.moveTo(gx0 - 4.5 * u, gy0);
  ctx.lineTo(gx0 - 3.8 * u, gy0 - 10 * u);
  ctx.quadraticCurveTo(gx0 - 1 * u, gy0 - 13.5 * u, gx0 + 3.6 * u, gy0 - 9 * u);
  ctx.lineTo(gx0 + 4.5 * u, gy0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  ctx.strokeStyle = mix(C.boneDim, C.bone, 0.4, 0.5);
  line(gx0 - 3.8 * u, gy0 - 9 * u, gx0 - 4.3 * u, gy0 - u);
  ctx.strokeStyle = shade(C.void, 0.9, 0.95); // dead curled wick
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.moveTo(gx0, gy0 - 11.5 * u);
  ctx.quadraticCurveTo(gx0 + 2.5 * u, gy0 - 15 * u, gx0 + 0.5 * u, gy0 - 16 * u);
  ctx.stroke();
  wisp(gx0 + 0.5 * u, gy0 - 16 * u, h * 0.2, 9 * u, 1.6 * u, 0.4);
  // folded gloves beside it
  const glx = gx0 + 34 * u;
  const gly = gy0 + 6 * u;
  tableShadow(glx + 2 * u, gly + 4 * u, 16 * u, 4.5 * u, 0.4);
  for (const [ox, oy, rot] of [[3 * u, 2 * u, 0.34], [0, 0, 0.12]] as const) {
    ctx.fillStyle = mix(C.void, C.inkSoft, 0.42);
    ctx.beginPath();
    ctx.ellipse(glx + ox, gly + oy, 14 * u, 5.5 * u, rot, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1 * u;
    ctx.stroke();
    ctx.strokeStyle = shade(C.void, 0.8, 0.6);
    line(glx + ox - 4 * u, gly + oy - 2 * u, glx + ox + 7 * u, gly + oy + u);
  }
  ctx.strokeStyle = mix(C.inkSoft, C.ember, 0.45, 0.55); // cuff catching light
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.ellipse(glx - 9 * u, gly - u, 4.5 * u, 3 * u, 0.5, -2.4, -0.2);
  ctx.stroke();
  // fresh-cut stubs standing ready — one candle each, for the queue outside
  for (let i = 0; i < 3; i++) {
    const fx2 = el.x + 46 * u + i * 16 * u;
    const fy2 = baseY + 12 * u + i * 2.5 * u;
    const fh2 = (15 - i) * u;
    tableShadow(fx2 + 2 * u, fy2 + 2 * u, 6.5 * u, 2.5 * u, 0.4);
    const fw2 = ctx.createLinearGradient(fx2 - 4 * u, 0, fx2 + 4 * u, 0);
    fw2.addColorStop(0, mix(C.parchment, C.flameHi, 0.3));
    fw2.addColorStop(1, shade(C.parchmentAged, 0.6));
    ctx.fillStyle = fw2;
    ctx.beginPath();
    ctx.moveTo(fx2 - 4 * u, fy2);
    ctx.lineTo(fx2 - 3.6 * u, fy2 - fh2);
    ctx.quadraticCurveTo(fx2, fy2 - fh2 - 1.5 * u, fx2 + 3.6 * u, fy2 - fh2 + 0.5 * u);
    ctx.lineTo(fx2 + 4 * u, fy2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9 * u;
    ctx.stroke();
    ctx.strokeStyle = INK;
    line(fx2, fy2 - fh2 - u, fx2 + 0.6 * u, fy2 - fh2 - 4 * u);
  }
  // wax shavings where the knife has been working
  ctx.strokeStyle = mix(C.parchmentAged, C.flameHi, 0.25, 0.85);
  ctx.lineWidth = 1.5 * u;
  for (let i = 0; i < 4; i++) {
    const sx2 = cx + (38 + rand() * 34) * u;
    const sy2 = baseY + (4 + rand() * 12) * u;
    ctx.beginPath();
    ctx.arc(sx2, sy2, (2.2 + rand() * 2.4) * u, rand() * 2, rand() * 2 + 2.6);
    ctx.stroke();
  }
  // spilled wax freckles near the stand
  ctx.fillStyle = shade(C.parchmentAged, 0.55, 0.5);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx + (rand() - 0.5) * 90 * u, baseY + (rand() - 0.2) * 14 * u, (2.5 + rand() * 3) * u, (1 + rand()) * u, 0, 0, TAU);
    ctx.fill();
  }

  // ── 11. the First Flame's stub — ancient, caked, portioned out ──────────
  // elder's passing arm goes down FIRST so the stand occludes it — the reach
  // reads as passing behind the candlestick, never crossing the flame
  limb(el.x - 24 * u, el.shY + 6 * u, el.x - 39 * u, baseY - 11 * u, 7.5 * u, 6 * u, ELDERC);
  limb(el.x - 39 * u, baseY - 11 * u, P.x + 16 * u, P.y + 3 * u, 6 * u, 5 * u, ELDERC);
  joint(el.x - 39 * u, baseY - 11 * u, 5.4 * u, ELDERC);
  limbRim(el.x - 39 * u, baseY - 11 * u, P.x + 16 * u, P.y + 3 * u, 6 * u, 5 * u, flameF.x, flameF.y);
  tableShadow(cx, baseY + 4 * u, 48 * u, 11 * u, 0.5);
  const brass = ctx.createLinearGradient(cx - 26 * u, 0, cx + 26 * u, 0);
  brass.addColorStop(0, mix(C.goldInk, C.ink, 0.55));
  brass.addColorStop(0.45, mix(C.goldInk, C.ember, 0.25));
  brass.addColorStop(1, mix(C.goldInk, C.ink, 0.7));
  ctx.fillStyle = brass;
  ctx.beginPath(); // wide engraved foot — relief rings, an echo of the Gate
  ctx.ellipse(cx, baseY, 34 * u, 10 * u, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1 * u;
  ctx.stroke();
  for (const [rr, aa] of [[27, 0.35], [19, 0.25]] as const) {
    ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.3, aa);
    ctx.lineWidth = 1 * u;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - u, rr * u, rr * 0.3 * u, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = brass;
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 6 * u, 17 * u, 5 * u, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath(); // thick stem with knop
  ctx.moveTo(cx - 6 * u, baseY - 7 * u);
  ctx.quadraticCurveTo(cx - 7 * u, (baseY + panY) / 2, cx - 4.5 * u, panY + 2 * u);
  ctx.lineTo(cx + 4.5 * u, panY + 2 * u);
  ctx.quadraticCurveTo(cx + 7 * u, (baseY + panY) / 2, cx + 6 * u, baseY - 7 * u);
  ctx.closePath();
  ctx.fillStyle = brass;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, (baseY + panY) / 2, 8.5 * u, 5.5 * u, 0, 0, TAU);
  ctx.fillStyle = brass;
  ctx.fill();
  ctx.stroke();
  // verdigris in the grooves — the stand is older than the town
  ctx.strokeStyle = mix(C.verdigris, C.ink, 0.5, 0.55);
  ctx.lineWidth = 1.1 * u;
  for (const dx of [-3.4, 2.2] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * u, panY + (4 + rand() * 4) * u);
    ctx.quadraticCurveTo(cx + (dx + 1.2) * u, (baseY + panY) / 2, cx + dx * 0.6 * u, baseY - (8 + rand() * 3) * u);
    ctx.stroke();
  }
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.4, 0.55);
  ctx.lineWidth = 1.2 * u;
  line(cx - 2 * u, panY + 4 * u, cx - 3 * u, baseY - 10 * u);
  // drip pan
  ctx.fillStyle = brass;
  ctx.beginPath();
  ctx.ellipse(cx, panY, 30 * u, 8 * u, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1 * u;
  ctx.stroke();
  // THE MOUND — generations of pours, layer on layer
  ctx.save();
  ctx.translate(cx, panY - u);
  const rWax = ctx.createLinearGradient(8 * u, -52 * u, -12 * u, 6 * u);
  rWax.addColorStop(0, mix(C.parchment, C.flame, 0.3));
  rWax.addColorStop(0.5, shade(mix(C.parchment, C.ember, 0.25), 0.82));
  rWax.addColorStop(1, shade(C.parchmentAged, 0.42));
  ctx.fillStyle = rWax;
  ctx.beginPath();
  ctx.moveTo(-34 * u, 3 * u);
  ctx.quadraticCurveTo(-38 * u, -10 * u, -29 * u, -16 * u); // first shelf of old wax
  ctx.quadraticCurveTo(-31 * u, -26 * u, -20 * u, -31 * u); // second pour
  ctx.quadraticCurveTo(-20 * u, -41 * u, -10 * u, -46 * u); // shoulder
  ctx.quadraticCurveTo(-4 * u, -51 * u, 4 * u, -50 * u); // crater lip
  ctx.quadraticCurveTo(12 * u, -47 * u, 15 * u, -39 * u);
  ctx.lineTo(20 * u, -36 * u); // top of the cut facet
  ctx.lineTo(24 * u, -19 * u); // bottom of the cut facet
  ctx.quadraticCurveTo(31 * u, -11 * u, 33 * u, 3 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1 * u;
  ctx.stroke();
  // layer seams — old pours, slightly sagging
  ctx.strokeStyle = shade(C.parchmentAged, 0.45, 0.55);
  ctx.lineWidth = 1 * u;
  for (const [ly2, lw2] of [[-16, 28], [-31, 20], [-41, 12]] as const) {
    ctx.beginPath();
    ctx.moveTo(-lw2 * u, ly2 * u);
    ctx.quadraticCurveTo(0, (ly2 + 2.5) * u, lw2 * 0.8 * u, ly2 * u);
    ctx.stroke();
  }
  // old runs frozen down the flanks — break the pour bands vertically
  ctx.strokeStyle = shade(C.parchmentAged, 0.55, 0.5);
  ctx.lineWidth = 1.1 * u;
  for (const [dx3, y0d, y1d] of [[-26, -14, 1], [-14, -29, -13], [-2, -44, -29], [8, -46, -36], [18, -16, 0], [26, -9, 2]] as const) {
    ctx.beginPath();
    ctx.moveTo(dx3 * u, y0d * u);
    ctx.quadraticCurveTo((dx3 + 1.2) * u, ((y0d + y1d) / 2) * u, dx3 * 0.94 * u, y1d * u);
    ctx.stroke();
  }
  // molten lip glowing around the crater, brightest toward the flame
  ctx.strokeStyle = mix(C.flame, C.flameHi, 0.5, 0.7);
  ctx.lineWidth = 1.4 * u;
  ctx.beginPath();
  ctx.moveTo(-4 * u, -50.5 * u);
  ctx.quadraticCurveTo(4 * u, -52 * u, 12 * u, -47.5 * u);
  ctx.stroke();
  // the fresh cut — bright clean wax where the knife is parting a segment
  ctx.fillStyle = mix(C.parchment, C.flameHi, 0.55);
  ctx.beginPath();
  ctx.moveTo(19.3 * u, -35.3 * u);
  ctx.lineTo(23.2 * u, -19.6 * u);
  ctx.lineTo(17.6 * u, -17.6 * u);
  ctx.lineTo(14.4 * u, -32.6 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(C.parchmentAged, 0.5, 0.7);
  ctx.lineWidth = 0.9 * u;
  ctx.stroke();
  // drip fingers over the pan lip, one long run reaching the table
  ctx.fillStyle = rWax;
  for (const [dx2, dl2] of [[-25, 10], [-11, 7], [17, 8.5], [27, 6]] as const) {
    capsulePath(dx2 * u, 0, dx2 * u * 0.94, dl2 * u, 1.8 * u);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(dx2 * u * 0.94, dl2 * u + u, 2.2 * u, 2.6 * u, 0, 0, TAU);
    ctx.fill();
  }
  capsulePath(-18 * u, 2 * u, -20 * u, 33 * u, 1.4 * u);
  ctx.fillStyle = shade(C.parchmentAged, 0.8, 0.85);
  ctx.fill();
  capsulePath(10 * u, 2 * u, 12 * u, 30 * u, 1.2 * u);
  ctx.fill();
  ctx.restore();
  // the flame — old, broad, patient
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5 * u;
  line(cx + u, panY - 50 * u, flameF.x, flameF.y);
  kindle(flameF.x, flameF.y, 10.5 * u, -0.22);
  wisp(flameF.x - 3 * u, flameF.y - 19 * u, h * 0.3, 14 * u, 2 * u, 0.22);

  // the cut segment tilting free of the mound
  const segTilt = 1.15; // lying flat on the table beside the shavings
  ctx.save();
  ctx.translate(cx + 50 * u, baseY - 5 * u);
  ctx.rotate(segTilt);
  const segG = ctx.createLinearGradient(0, -8 * u, 0, 8 * u);
  segG.addColorStop(0, mix(C.parchment, C.flameHi, 0.5));
  segG.addColorStop(1, shade(C.parchmentAged, 0.62));
  capsulePath(0, -6 * u, 0, 6 * u, 4.2 * u);
  ctx.fillStyle = segG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9 * u;
  ctx.stroke();
  ctx.fillStyle = mix(C.parchment, C.flameHi, 0.6); // bright cut face
  ctx.beginPath();
  ctx.ellipse(0, -6 * u, 4 * u, 2 * u, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // ── 12. the hands of the rite ────────────────────────────────────────────
  // elder's knife arm — shoulder, elbow, fist at the cut
  const kHx = cx + 36 * u;
  const kHy = panY - 26 * u;
  limb(el.x + 12 * u, el.shY + 2 * u, el.x - 2 * u, h * 0.43, 8 * u, 6.5 * u, ELDERC);
  limb(el.x - 2 * u, h * 0.43, kHx + 6 * u, kHy + 6 * u, 6.5 * u, 5.5 * u, ELDERC);
  joint(el.x - 2 * u, h * 0.43, 5.8 * u, ELDERC);
  limbRim(el.x - 2 * u, h * 0.43, kHx + 6 * u, kHy + 6 * u, 6.5 * u, 5.5 * u, flameF.x, flameF.y);
  // the knife: dark grip in the fist, bright blade buried in the notch
  ctx.fillStyle = mix(C.bone, C.parchment, 0.5);
  ctx.beginPath();
  ctx.moveTo(kHx - u, kHy - 4 * u);
  ctx.lineTo(cx + 17 * u, panY - 36.5 * u);
  ctx.lineTo(cx + 20.5 * u, panY - 30 * u);
  ctx.lineTo(kHx - u, kHy + 2.5 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9 * u;
  ctx.stroke();
  ctx.strokeStyle = mix(C.flameHi, C.parchment, 0.3, 0.95);
  ctx.lineWidth = 1.2 * u;
  line(kHx - 2 * u, kHy - 3 * u, cx + 18 * u, panY - 34.5 * u);
  // shavings curling off the fresh facet, mid-fall
  ctx.strokeStyle = mix(C.parchmentAged, C.flameHi, 0.3, 0.9);
  ctx.lineWidth = 1.4 * u;
  for (const [cx2, cy2, cr2] of [[cx + 27 * u, panY - 14 * u, 2.6], [cx + 31 * u, panY - 6 * u, 2.1]] as const) {
    ctx.beginPath();
    ctx.arc(cx2, cy2, cr2 * u, 0.6, 4.4);
    ctx.stroke();
  }
  capsulePath(kHx + 8 * u, kHy + 3 * u, kHx + u, kHy - u, 3.4 * u); // grip
  ctx.fillStyle = mix(C.void, C.ink, 0.6);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = FIST; // fist over the grip
  ctx.beginPath();
  ctx.ellipse(kHx + 5 * u, kHy + 2 * u, 7 * u, 6 * u, 0.35, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.5, 0.5);
  ctx.lineWidth = 1.1 * u;
  ctx.beginPath();
  ctx.ellipse(kHx + 5 * u, kHy + 2 * u, 7 * u, 6 * u, 0.35, -2.6, -0.9);
  ctx.stroke();
  for (let i = 0; i < 2; i++) { // knuckle creases
    ctx.strokeStyle = shade(C.void, 0.8, 0.5);
    ctx.lineWidth = 0.9 * u;
    line(kHx + (1 + i * 3.4) * u, kHy - 2 * u, kHx + (2 + i * 3.4) * u, kHy + 4.5 * u);
  }

  // the receiving palm first (under), then the elder's passing hand (over)
  const palmX = P.x - 4 * u;
  const palmY = P.y + 20 * u;
  const rEl = { x: (dl.x + 20 * u + palmX) / 2 + 6 * u, y: (h * 0.425 + palmY) / 2 + 8 * u };
  limb(dl.x + 20 * u, h * 0.425, rEl.x, rEl.y, 7.5 * u, 6.5 * u, CLOAK);
  limb(rEl.x, rEl.y, palmX - 6 * u, palmY, 6.5 * u, 5.2 * u, CLOAK);
  joint(rEl.x, rEl.y, 5.8 * u, CLOAK);
  limbRim(rEl.x, rEl.y, palmX - 6 * u, palmY, 6.5 * u, 5.2 * u, flameF.x, flameF.y);
  ctx.fillStyle = mix(C.void, C.inkSoft, 0.48); // cupped hand, mostly shadow
  ctx.beginPath();
  ctx.ellipse(palmX, palmY, 8 * u, 5.2 * u, -0.22, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  ctx.strokeStyle = mix(C.flame, C.flameHi, 0.4, 0.55); // light in the cupped palm
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.ellipse(palmX, palmY - u, 6 * u, 3.2 * u, -0.22, -2.8, -0.3);
  ctx.stroke();
  // the just-cut stub, descending into the open palm (arm drawn behind stand)
  const stubG = ctx.createLinearGradient(P.x - 4 * u, 0, P.x + 4 * u, 0);
  stubG.addColorStop(0, mix(C.parchment, C.flameHi, 0.45));
  stubG.addColorStop(1, shade(C.parchmentAged, 0.62));
  capsulePath(P.x, P.y - 7 * u, P.x + 0.6 * u, P.y + 10 * u, 4.4 * u);
  ctx.fillStyle = stubG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  ctx.strokeStyle = mix(C.boneDim, C.void, 0.55, 0.9); // its wick, not yet lit
  ctx.lineWidth = 1.1 * u;
  ctx.beginPath();
  ctx.moveTo(P.x - u, P.y - 10 * u);
  ctx.quadraticCurveTo(P.x - 2.5 * u, P.y - 13 * u, P.x - 1.5 * u, P.y - 15 * u);
  ctx.stroke();
  for (const [f0x, f0y, f1x, f1y] of [
    [P.x + 15 * u, P.y - 1 * u, P.x + 2 * u, P.y - 9 * u],
    [P.x + 16 * u, P.y + 5 * u, P.x + 4 * u, P.y - 3 * u],
  ] as const) { // pinching fingers steadying the stub's crown — dark on bright wax
    capsulePath(f0x, f0y, f1x, f1y, 2.4 * u);
    ctx.fillStyle = mix(C.void, C.inkSoft, 0.55);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9 * u;
    ctx.stroke();
  }
  for (let i = 0; i < 2; i++) { // fingers closing around the gift's foot
    capsulePath(palmX - 7 * u, palmY - (4 - i * 3.6) * u, palmX + 8.5 * u, palmY - (3 - i * 3.8) * u, 1.9 * u);
    ctx.fillStyle = mix(C.void, C.inkSoft, 0.55 - i * 0.08);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8 * u;
    ctx.stroke();
  }

  // right delver's stub, already caught — held close, guarded
  const hSx = dr.x - 55 * u;
  const hSy = h * 0.437;
  limb(dr.x - 24 * u, dr.shY + 4 * u, dr.x - 46 * u, h * 0.472, 7.5 * u, 6 * u, CLOAK);
  limb(dr.x - 46 * u, h * 0.472, hSx + 6 * u, hSy + 10 * u, 6 * u, 5.2 * u, CLOAK);
  joint(dr.x - 46 * u, h * 0.472, 5.4 * u, CLOAK);
  limbRim(dr.x - 46 * u, h * 0.472, hSx + 6 * u, hSy + 10 * u, 6 * u, 5.2 * u, flameF.x, flameF.y);
  ctx.fillStyle = FIST; // fist around the wax
  ctx.beginPath();
  ctx.ellipse(hSx + 2 * u, hSy + 8 * u, 8 * u, 6.5 * u, -0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  const hwG = ctx.createLinearGradient(hSx - 4 * u, 0, hSx + 4 * u, 0);
  hwG.addColorStop(0, mix(C.parchment, C.flameHi, 0.35));
  hwG.addColorStop(1, shade(C.parchmentAged, 0.55));
  capsulePath(hSx, hSy + 4 * u, hSx + u, hSy - 8 * u, 4 * u);
  ctx.fillStyle = hwG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9 * u;
  ctx.stroke();
  kindle(hSx + 1.5 * u, hSy - 13 * u, 4.6 * u, 0.08);
  for (let i = 0; i < 2; i++) { // fingers wrapping the front
    capsulePath(hSx - 6 * u, hSy + (2 - i * 4) * u, hSx + 8 * u, hSy + (3 - i * 4) * u, 2.1 * u);
    ctx.fillStyle = mix(C.inkSoft, C.ember, 0.3 - i * 0.06);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8 * u;
    ctx.stroke();
  }
  // his other hand shields the new flame
  limb(dr.x + 22 * u, dr.shY + 6 * u, hSx + 22 * u, hSy - 12 * u, 7 * u, 5.5 * u, CLOAK);
  limbRim(dr.x + 22 * u, dr.shY + 6 * u, hSx + 22 * u, hSy - 12 * u, 8 * u, 6 * u, hSx, hSy - 13 * u);
  ctx.strokeStyle = FIST;
  ctx.lineWidth = 7 * u;
  ctx.beginPath();
  ctx.arc(hSx + 1.5 * u, hSy - 13 * u, 11 * u, -0.5 * Math.PI, 0.42 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = mix(C.flame, C.flameHi, 0.5, 0.75);
  ctx.lineWidth = 1.4 * u;
  ctx.beginPath();
  ctx.arc(hSx + 1.5 * u, hSy - 13 * u, 7.6 * u, -0.5 * Math.PI, 0.42 * Math.PI);
  ctx.stroke();

  // ── 13. motes rising off the flames ──────────────────────────────────────
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = mix(C.ember, C.flame, rand(), 0.25 + rand() * 0.45);
    ctx.beginPath();
    ctx.arc(flameF.x + (rand() - 0.5) * 60 * u, flameF.y - 12 * u - rand() * 70 * u, (0.9 + rand() * 0.9) * u, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = mix(C.ember, C.flame, rand(), 0.3);
    ctx.beginPath();
    ctx.arc(hSx + (rand() - 0.5) * 16 * u, hSy - 20 * u - rand() * 18 * u, 0.9 * u, 0, TAU);
    ctx.fill();
  }

  // ── 14. foreground occluder — a delver's shoulder breaks the frame edge ─
  ctx.beginPath();
  ctx.moveTo(w, h * 0.55);
  ctx.quadraticCurveTo(w * 0.93, h * 0.585, w * 0.888, h * 0.685);
  ctx.quadraticCurveTo(w * 0.862, h * 0.77, w * 0.805, h * 0.845);
  ctx.quadraticCurveTo(w * 0.762, h * 0.9, w * 0.755, h);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = mix(C.void, C.ink, 0.3);
  ctx.fill();
  ctx.strokeStyle = mix(C.void, C.ember, 0.35, 0.45); // one soft warm edge
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(w * 0.985, h * 0.562);
  ctx.quadraticCurveTo(w * 0.928, h * 0.59, w * 0.888, h * 0.687);
  ctx.quadraticCurveTo(w * 0.863, h * 0.767, w * 0.807, h * 0.843);
  ctx.stroke();
  // lantern-harness ring at the shoulder, barely there
  ctx.strokeStyle = mix(C.void, C.inkSoft, 0.6);
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.arc(w * 0.875, h * 0.73, 6 * u, -2.4, 0.6);
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.3);
  ctx.lineWidth = 1 * u;
  ctx.beginPath();
  ctx.arc(w * 0.875, h * 0.73, 6 * u, -2.2, -1.1);
  ctx.stroke();

  // ── 15. closing darkness: calm bottom, crushed top, corner vignettes ────
  const calm = ctx.createLinearGradient(0, h * 0.66, 0, h);
  calm.addColorStop(0, shade(C.void, 0.55, 0));
  calm.addColorStop(0.55, shade(C.void, 0.55, 0.55));
  calm.addColorStop(1, shade(C.void, 0.5, 0.92));
  ctx.fillStyle = calm;
  ctx.fillRect(0, h * 0.66, w, h * 0.34);
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.16);
  crush.addColorStop(0, shade(C.void, 0.6, 0.8));
  crush.addColorStop(1, shade(C.void, 0.6, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.16);
  const vr = Math.min(w, h) * 0.48;
  for (const [vx, vy, va] of [[0, 0, 0.45], [w, 0, 0.45], [0, h, 0.6], [w, h, 0.55]] as const) {
    const v = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    v.addColorStop(0, shade(C.void, 0.5, va));
    v.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}
