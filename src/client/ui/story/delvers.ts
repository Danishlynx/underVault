/**
 * Story slide 5 — "One candle each." (intro cinematic painted still)
 *
 * Close and intimate: a rough plank table under a single warm pool of light,
 * and three pairs of delver hands taking short stub-candles from the First
 * Flame's guttering remnant on its brass stand. Every taken candle has just
 * caught — small new flames against the void. Faces stay unseen: one body
 * crops above the frame (sleeves descending from the top edge), one is a
 * back-of-hood foreground mass at the lower left, and one hooded figure at
 * the right edge echoes the delver sprite's cowl (rounded crown, void-dark
 * cavity, rim catching flame). The one law: warm pool on the table, void
 * everywhere else. The center-bottom third is kept calm and dark — caption
 * text renders over it.
 *
 * Painted-still idiom per guildhall.ts: flat woodcut masses, fog-stop depth,
 * token colors through shade()/mix() only, thin ink outlines, no speckle.
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
  const FIST = mix(C.void, C.inkSoft, 0.55);

  // ── anchors ──────────────────────────────────────────────────────────────
  const cx = w * 0.5;
  const backY = h * 0.5; // table back edge
  const frontY = h * 0.665; // table front edge — the calm third begins here
  const baseY = h * 0.545; // brass stand foot on the table
  const panY = baseY - 92 * u; // drip pan under the remnant
  const flameF = { x: cx + 1.5 * u, y: panY - 25 * u }; // remnant flame base
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ── shared shape helpers ─────────────────────────────────────────────────
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
  // fist + wax stub + new flame + wrapping fingers; returns the flame base
  const heldCandle = (x: number, y: number, ang: number, bh: number, fs: number, lean: number): { x: number; y: number } => {
    const bw = 11 * u;
    const hw = bw / 2;
    // fist behind the wax
    ctx.save();
    ctx.translate(x, y + 1.5 * u);
    ctx.rotate(ang * 0.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, 9.5 * u, 7.8 * u, 0, 0, TAU);
    ctx.fillStyle = FIST;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.1 * u;
    ctx.stroke();
    ctx.strokeStyle = mix(C.ember, C.flame, 0.5, 0.4);
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9.5 * u, 7.8 * u, 0, -2.5, -0.7);
    ctx.stroke();
    ctx.restore();
    // the stub — melted lip, one drip run, short wick
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const wax = ctx.createLinearGradient(0, -bh, 0, 0);
    wax.addColorStop(0, mix(C.parchment, C.flameHi, 0.28));
    wax.addColorStop(0.55, shade(C.parchment, 0.8));
    wax.addColorStop(1, shade(C.parchmentAged, 0.52));
    ctx.beginPath();
    ctx.moveTo(-hw + 0.6 * u, 0);
    ctx.lineTo(-hw, -bh + 3 * u);
    ctx.quadraticCurveTo(-hw, -bh + 0.5 * u, -hw + 2.6 * u, -bh + 1.2 * u);
    ctx.lineTo(hw - 2.2 * u, -bh - 1.6 * u);
    ctx.quadraticCurveTo(hw, -bh - u, hw, -bh + 2.4 * u);
    ctx.lineTo(hw - 0.6 * u, 0);
    ctx.closePath();
    ctx.fillStyle = wax;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1 * u;
    ctx.stroke();
    ctx.fillStyle = shade(C.parchment, 0.9, 0.9);
    ctx.beginPath();
    ctx.ellipse(-hw + 1.6 * u, -bh + 4.4 * u, 1.2 * u, 2.6 * u, 0.08, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    ctx.moveTo(0.5 * u, -bh);
    ctx.lineTo(0.9 * u, -bh - 3.6 * u);
    ctx.stroke();
    ctx.restore();
    // the new flame rises in world space, whatever the candle's tilt
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const lx = 0.8 * u;
    const ly = -bh - 3.2 * u;
    const tip = { x: x + lx * ca - ly * sa, y: y + lx * sa + ly * ca };
    kindle(tip.x, tip.y, fs, lean);
    // fingers wrap in front of the wax; thumb up the near side
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    for (let i = 0; i < 3; i++) {
      const fy = -2.8 * u - i * 4.4 * u;
      const sway = (rand() - 0.5) * 1.4 * u;
      capsulePath(-hw - 2 * u, fy + sway, hw + 2 * u, fy, 2.2 * u);
      ctx.fillStyle = mix(C.inkSoft, C.ember, 0.3 - i * 0.07);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.9 * u;
      ctx.stroke();
      ctx.strokeStyle = mix(C.flame, C.flameHi, 0.35, 0.5);
      ctx.lineWidth = 0.9 * u;
      ctx.beginPath();
      ctx.moveTo(-hw - 1.2 * u, fy + sway - 2 * u);
      ctx.lineTo(hw + 1.2 * u, fy - 2 * u);
      ctx.stroke();
    }
    capsulePath(-hw - 2.6 * u, 1.5 * u, -hw + 0.4 * u, -7.5 * u, 2.5 * u);
    ctx.fillStyle = mix(C.inkSoft, C.ember, 0.14);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9 * u;
    ctx.stroke();
    ctx.restore();
    return tip;
  };
  // second hand of a pair: a palm cupped around the new flame, inner edge lit
  const cupHand = (fx: number, fy: number, side: 1 | -1, wx: number, wy: number): void => {
    const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, 16 * u);
    glow.addColorStop(0, mix(C.flame, C.flameHi, 0.4, 0.28));
    glow.addColorStop(1, mix(C.flame, C.flameHi, 0.4, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(fx - 16 * u, fy - 16 * u, 32 * u, 32 * u);
    limb(wx, wy, fx + side * 11 * u, fy + 11 * u, 8.5 * u, 6 * u, FIST);
    limbRim(wx, wy, fx + side * 11 * u, fy + 11 * u, 8.5 * u, 6 * u, fx, fy);
    const a0 = side === 1 ? -0.42 * Math.PI : 0.58 * Math.PI;
    const a1 = side === 1 ? 0.42 * Math.PI : 1.42 * Math.PI;
    ctx.beginPath();
    ctx.arc(fx, fy, 12 * u, a0, a1);
    ctx.strokeStyle = FIST;
    ctx.lineWidth = 8 * u;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(fx, fy, 16 * u, a0, a1);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1 * u;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(fx, fy, 8.2 * u, a0, a1);
    ctx.strokeStyle = mix(C.flame, C.flameHi, 0.5, 0.8);
    ctx.lineWidth = 1.6 * u;
    ctx.stroke();
    ctx.strokeStyle = shade(C.void, 0.7, 0.55);
    ctx.lineWidth = 1 * u;
    for (const t of [0.35, 0.65] as const) {
      const ga = a0 + (a1 - a0) * t;
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(ga) * 8.8 * u, fy + Math.sin(ga) * 8.8 * u);
      ctx.lineTo(fx + Math.cos(ga) * 15.4 * u, fy + Math.sin(ga) * 15.4 * u);
      ctx.stroke();
    }
  };
  const tableShadow = (x: number, y: number, rx: number, ry: number, a: number): void => {
    ctx.fillStyle = shade(C.void, 0.6, a);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  };

  // ── 1. void base + the pool's airborne glow ──────────────────────────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, C.void);
  base.addColorStop(0.42, mix(C.void, C.surface, 0.35));
  base.addColorStop(0.6, mix(C.void, C.surface, 0.2));
  base.addColorStop(1, shade(C.void, 0.85));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const air = ctx.createRadialGradient(cx, panY + 10 * u, 0, cx, panY + 10 * u, 300 * u);
  air.addColorStop(0, mix(C.void, C.ember, 0.3, 0.5));
  air.addColorStop(0.55, mix(C.void, C.ember, 0.3, 0.18));
  air.addColorStop(1, mix(C.void, C.ember, 0.3, 0));
  ctx.fillStyle = air;
  ctx.fillRect(cx - 300 * u, panY - 290 * u, 600 * u, 600 * u);
  const airCore = ctx.createRadialGradient(cx, panY, 0, cx, panY, 150 * u);
  airCore.addColorStop(0, mix(C.void, C.flame, 0.4, 0.32));
  airCore.addColorStop(1, mix(C.void, C.flame, 0.4, 0));
  ctx.fillStyle = airCore;
  ctx.fillRect(cx - 150 * u, panY - 150 * u, 300 * u, 300 * u);

  // ── 2. fog stops: cold breath above, warm haze behind the table ─────────
  const cold = ctx.createLinearGradient(0, 0, 0, h * 0.2);
  cold.addColorStop(0, mix(C.void, C.verdigrisDim, 0.16, 0.3));
  cold.addColorStop(1, mix(C.void, C.verdigrisDim, 0.16, 0));
  ctx.fillStyle = cold;
  ctx.fillRect(0, 0, w, h * 0.2);
  const haze = ctx.createLinearGradient(0, panY - 64 * u, 0, panY + 50 * u);
  haze.addColorStop(0, mix(C.void, C.ember, 0.09, 0));
  haze.addColorStop(0.5, mix(C.void, C.ember, 0.09, 0.4));
  haze.addColorStop(1, mix(C.void, C.ember, 0.09, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, panY - 64 * u, w, 114 * u);

  // ── 3. the hooded delver at the frame's edge (echo of the sprite) ───────
  const hx = Math.min(cx + 205 * u, w - 30 * u);
  const hy = h * 0.285;
  ctx.beginPath();
  ctx.moveTo(hx - 46 * u, backY + 30 * u);
  ctx.quadraticCurveTo(hx - 52 * u, hy + 90 * u, hx - 40 * u, hy + 40 * u);
  ctx.quadraticCurveTo(hx - 36 * u, hy + 26 * u, hx - 30 * u, hy + 12 * u);
  ctx.quadraticCurveTo(hx - 38 * u, hy - 10 * u, hx - 24 * u, hy - 28 * u);
  ctx.quadraticCurveTo(hx - 10 * u, hy - 44 * u, hx + 12 * u, hy - 40 * u);
  ctx.quadraticCurveTo(hx + 34 * u, hy - 30 * u, hx + 36 * u, hy - 2 * u);
  ctx.quadraticCurveTo(hx + 44 * u, hy + 30 * u, hx + 40 * u, hy + 70 * u);
  ctx.quadraticCurveTo(hx + 46 * u, hy + 130 * u, hx + 38 * u, backY + 30 * u);
  ctx.closePath();
  ctx.fillStyle = CLOAK;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3 * u;
  ctx.stroke();
  // fold shadows down the cloak
  ctx.strokeStyle = shade(C.void, 0.8, 0.5);
  ctx.lineWidth = 1.2 * u;
  for (const [fx0, sag] of [[hx - 20 * u, 8 * u], [hx + 4 * u, 12 * u], [hx + 24 * u, 6 * u]] as const) {
    ctx.beginPath();
    ctx.moveTo(fx0, hy + 34 * u + (rand() - 0.5) * 6 * u);
    ctx.quadraticCurveTo(fx0 - sag, hy + 90 * u, fx0 - sag * 0.4, backY + 24 * u);
    ctx.stroke();
  }
  // hood cavity — no face; the dark keeps them anonymous
  ctx.fillStyle = shade(C.void, 0.6);
  ctx.beginPath();
  ctx.ellipse(hx - 18 * u, hy - 2 * u, 9 * u, 12 * u, -0.15, 0, TAU);
  ctx.fill();
  // hood rim catching flame — same recipe as the player sprite
  ctx.strokeStyle = mix(C.inkSoft, C.flame, 0.55, 0.75);
  ctx.lineWidth = 1.5 * u;
  ctx.beginPath();
  ctx.ellipse(hx - 16 * u, hy - 4 * u, 12 * u, 15 * u, -0.12, 0.6 * Math.PI, 1.35 * Math.PI);
  ctx.stroke();

  // ── 4. the table: rough planks under the one pool of light ──────────────
  const tablePath = (): void => {
    ctx.beginPath();
    ctx.moveTo(0.06 * w, backY);
    ctx.lineTo(0.94 * w, backY);
    ctx.lineTo(1.05 * w, frontY);
    ctx.lineTo(-0.05 * w, frontY);
    ctx.closePath();
  };
  tablePath();
  ctx.fillStyle = mix(C.void, C.ink, 0.28);
  ctx.fill();
  ctx.save();
  tablePath();
  ctx.clip();
  // the pool — wide wash plus a hot core, squashed to the table plane
  ctx.save();
  ctx.translate(cx, baseY + 4 * u);
  ctx.scale(1, 0.38);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 220 * u);
  pool.addColorStop(0, mix(C.ember, C.flame, 0.3, 0.34));
  pool.addColorStop(0.55, mix(C.ember, C.flame, 0.3, 0.14));
  pool.addColorStop(1, mix(C.ember, C.flame, 0.3, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-230 * u, -230 * u, 460 * u, 460 * u);
  const core = ctx.createRadialGradient(0, -10 * u, 0, 0, -10 * u, 95 * u);
  core.addColorStop(0, mix(C.flame, C.flameHi, 0.25, 0.3));
  core.addColorStop(1, mix(C.flame, C.flameHi, 0.25, 0));
  ctx.fillStyle = core;
  ctx.fillRect(-100 * u, -110 * u, 200 * u, 200 * u);
  ctx.restore();
  // plank seams with butt joints, a little grain, no speckle
  ctx.strokeStyle = shade(C.void, 0.75, 0.85);
  ctx.lineWidth = 1.2 * u;
  for (const t of [0.3, 0.56, 0.8] as const) {
    const y = backY + (frontY - backY) * t + (rand() - 0.5) * 3 * u;
    const xl = 0.06 * w + (-0.11 * w) * t;
    const xr = 0.94 * w + 0.11 * w * t;
    ctx.beginPath();
    ctx.moveTo(xl, y);
    ctx.quadraticCurveTo((xl + xr) / 2, y + (rand() - 0.5) * 3 * u, xr, y);
    ctx.stroke();
    ctx.beginPath();
    const jx = cx + (rand() - 0.5) * 0.5 * w;
    ctx.moveTo(jx, y - 4.5 * u);
    ctx.lineTo(jx + (rand() - 0.5) * 2 * u, y);
    ctx.stroke();
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
  ctx.beginPath();
  ctx.moveTo(0.06 * w, backY);
  ctx.lineTo(0.94 * w, backY);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const nx = w * (0.18 + rand() * 0.64);
    ctx.beginPath();
    ctx.moveTo(nx, backY);
    ctx.lineTo(nx + 3 * u, backY + 2 * u);
    ctx.stroke();
  }
  const glint = ctx.createLinearGradient(cx - 170 * u, 0, cx + 170 * u, 0);
  glint.addColorStop(0, mix(C.ember, C.flame, 0.35, 0));
  glint.addColorStop(0.5, mix(C.ember, C.flame, 0.35, 0.4));
  glint.addColorStop(1, mix(C.ember, C.flame, 0.35, 0));
  ctx.strokeStyle = glint;
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.moveTo(cx - 170 * u, backY + u);
  ctx.lineTo(cx + 170 * u, backY + u);
  ctx.stroke();
  // table front falls into the dark — the caption's calm ground
  const front = ctx.createLinearGradient(0, frontY, 0, frontY + h * 0.14);
  front.addColorStop(0, mix(C.void, C.ink, 0.22));
  front.addColorStop(1, C.void);
  ctx.fillStyle = front;
  ctx.fillRect(0, frontY, w, h - frontY);
  const lip = ctx.createLinearGradient(cx - 120 * u, 0, cx + 120 * u, 0);
  lip.addColorStop(0, mix(C.ember, C.goldInk, 0.4, 0));
  lip.addColorStop(0.5, mix(C.ember, C.goldInk, 0.4, 0.22));
  lip.addColorStop(1, mix(C.ember, C.goldInk, 0.4, 0));
  ctx.strokeStyle = lip;
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.moveTo(cx - 120 * u, frontY + 0.5 * u);
  ctx.lineTo(cx + 120 * u, frontY + 0.5 * u);
  ctx.stroke();

  // ── 5. foreground delver, back to us at the lower left ──────────────────
  const fgx = cx - 178 * u;
  const fgy = baseY - 8 * u;
  ctx.fillStyle = mix(C.void, C.inkSoft, 0.3);
  ctx.beginPath();
  ctx.ellipse(fgx - 6 * u, fgy + 52 * u, 58 * u, 34 * u, 0.1, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(fgx, fgy, 26 * u, 24 * u, -0.12, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2 * u;
  ctx.stroke();
  // cowl ridge + rim light on the flame side of the hood
  ctx.strokeStyle = shade(C.void, 0.8, 0.5);
  ctx.lineWidth = 1.1 * u;
  ctx.beginPath();
  ctx.moveTo(fgx - 4 * u, fgy - 22 * u);
  ctx.quadraticCurveTo(fgx + 2 * u, fgy, fgx - 2 * u, fgy + 20 * u);
  ctx.stroke();
  ctx.strokeStyle = mix(C.inkSoft, C.flame, 0.5, 0.6);
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.ellipse(fgx, fgy, 26 * u, 24 * u, -0.12, -0.85, 0.55);
  ctx.stroke();

  // ── 6. contact shadows, loose stubs, spilled wax ─────────────────────────
  tableShadow(cx, baseY + 3 * u, 34 * u, 8 * u, 0.5);
  tableShadow(cx - 108 * u, baseY - 12 * u, 20 * u, 5 * u, 0.35);
  tableShadow(hx - 108 * u, baseY - 4 * u, 20 * u, 5 * u, 0.35);
  tableShadow(cx - 20 * u, baseY - 26 * u, 16 * u, 4 * u, 0.25);
  ctx.fillStyle = shade(C.parchmentAged, 0.55, 0.5);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx + (rand() - 0.5) * 80 * u, baseY + (rand() - 0.3) * 16 * u, (2.5 + rand() * 3) * u, (1 + rand()) * u, 0, 0, TAU);
    ctx.fill();
  }
  // unclaimed stubs waiting by the stand
  const lyingStub = (x: number, y: number, ang: number, len: number): void => {
    tableShadow(x, y + 5 * u, len * 0.7, 3 * u, 0.3);
    capsulePath(x - Math.cos(ang) * len * 0.5, y - Math.sin(ang) * len * 0.5, x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5, 5 * u);
    ctx.fillStyle = mix(C.parchmentAged, C.ember, 0.15);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1 * u;
    ctx.stroke();
    const ex2 = x + Math.cos(ang) * len * 0.5;
    const ey2 = y + Math.sin(ang) * len * 0.5;
    ctx.fillStyle = shade(C.parchment, 0.88);
    ctx.beginPath();
    ctx.ellipse(ex2, ey2, 2 * u, 4.6 * u, ang, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9 * u;
    ctx.beginPath();
    ctx.moveTo(ex2, ey2);
    ctx.lineTo(ex2 + 3 * u, ey2 - 1.5 * u);
    ctx.stroke();
  };
  lyingStub(cx + 41 * u, baseY - 21 * u, 0.18, 19 * u);
  lyingStub(cx - 43 * u, baseY + u, -0.25, 17 * u);

  // ── 7. the brass stand and the First Flame's remnant ─────────────────────
  const brass = ctx.createLinearGradient(cx - 20 * u, 0, cx + 20 * u, 0);
  brass.addColorStop(0, mix(C.goldInk, C.ink, 0.55));
  brass.addColorStop(0.45, mix(C.goldInk, C.ember, 0.25));
  brass.addColorStop(1, mix(C.goldInk, C.ink, 0.7));
  ctx.fillStyle = brass;
  ctx.beginPath();
  ctx.ellipse(cx, baseY, 26 * u, 8 * u, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1 * u;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 5 * u, 14 * u, 4.5 * u, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // tapered column with a knop
  ctx.beginPath();
  ctx.moveTo(cx - 4.5 * u, baseY - 6 * u);
  ctx.quadraticCurveTo(cx - 5.5 * u, (baseY + panY) / 2, cx - 3 * u, panY + 2 * u);
  ctx.lineTo(cx + 3 * u, panY + 2 * u);
  ctx.quadraticCurveTo(cx + 5.5 * u, (baseY + panY) / 2, cx + 4.5 * u, baseY - 6 * u);
  ctx.closePath();
  ctx.fillStyle = brass;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 42 * u, 6.5 * u, 5 * u, 0, 0, TAU);
  ctx.fillStyle = brass;
  ctx.fill();
  ctx.stroke();
  // candlelight down the shaft, and old verdigris in the grooves
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.4, 0.55);
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.moveTo(cx - 1.5 * u, panY + 4 * u);
  ctx.lineTo(cx - 2.5 * u, baseY - 10 * u);
  ctx.stroke();
  ctx.strokeStyle = mix(C.verdigris, C.ink, 0.5, 0.55);
  ctx.lineWidth = 1.1 * u;
  for (const dx of [-2.8, 1.6] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * u, baseY - (34 + rand() * 6) * u);
    ctx.quadraticCurveTo(cx + (dx + 1) * u, baseY - 20 * u, cx + dx * 0.6 * u, baseY - (6 + rand() * 4) * u);
    ctx.stroke();
  }
  // drip pan
  ctx.fillStyle = brass;
  ctx.beginPath();
  ctx.ellipse(cx, panY, 19 * u, 6 * u, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1 * u;
  ctx.stroke();
  ctx.fillStyle = mix(C.goldInk, C.ink, 0.75);
  ctx.beginPath();
  ctx.ellipse(cx, panY - u, 15 * u, 4.2 * u, 0, 0, TAU);
  ctx.fill();
  // the remnant: a melted mound, drip fingers over the lip, one long run
  ctx.save();
  ctx.translate(cx, panY - 2 * u);
  const rWax = ctx.createLinearGradient(0, -19 * u, 0, 8 * u);
  rWax.addColorStop(0, mix(C.parchment, C.flameHi, 0.35));
  rWax.addColorStop(1, shade(C.parchmentAged, 0.55));
  ctx.fillStyle = rWax;
  ctx.beginPath();
  ctx.moveTo(-15 * u, u);
  ctx.quadraticCurveTo(-17 * u, -8 * u, -10 * u, -13 * u);
  ctx.quadraticCurveTo(-5 * u, -19 * u, 2 * u, -18.5 * u);
  ctx.quadraticCurveTo(8 * u, -18 * u, 11 * u, -11 * u);
  ctx.quadraticCurveTo(15 * u, -5 * u, 14 * u, u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  ctx.fillStyle = rWax;
  for (const [dx2, dl] of [[-9, 8], [10, 5.5]] as const) {
    capsulePath(dx2 * u, 0, dx2 * u * 0.94, dl * u, 1.6 * u);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(dx2 * u * 0.94, dl * u + u, 2 * u, 2.4 * u, 0, 0, TAU);
    ctx.fill();
  }
  capsulePath(3 * u, u, 2 * u, 26 * u, 1.2 * u);
  ctx.fillStyle = shade(C.parchmentAged, 0.8, 0.85);
  ctx.fill();
  ctx.restore();
  // the guttering flame — leaning, sputtering, almost done
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4 * u;
  ctx.beginPath();
  ctx.moveTo(cx + u, panY - 20.5 * u);
  ctx.lineTo(flameF.x, flameF.y);
  ctx.stroke();
  kindle(flameF.x, flameF.y, 7.5 * u, -0.3);
  ctx.fillStyle = shade(C.ember, 1, 0.8);
  ctx.beginPath();
  ctx.moveTo(flameF.x - 4 * u, flameF.y + 2 * u);
  ctx.quadraticCurveTo(flameF.x - 8 * u, flameF.y - 3 * u, flameF.x - 5 * u, flameF.y - 6 * u);
  ctx.quadraticCurveTo(flameF.x - 3.5 * u, flameF.y - 2 * u, flameF.x - 4 * u, flameF.y + 2 * u);
  ctx.fill();
  ctx.strokeStyle = mix(C.boneDim, C.void, 0.2, 0.22);
  ctx.lineWidth = 1.8 * u;
  ctx.beginPath();
  ctx.moveTo(flameF.x - 6 * u, flameF.y - 16 * u);
  ctx.bezierCurveTo(flameF.x - 14 * u, flameF.y - 30 * u, flameF.x + 2 * u, flameF.y - 38 * u, flameF.x - 6 * u, flameF.y - 54 * u);
  ctx.stroke();

  // ── 8. left pair — the foreground delver's hands ─────────────────────────
  const lFx = cx - 108 * u;
  const lFy = baseY - 70 * u;
  const lmx = (fgx + 20 * u + lFx) / 2 + 6 * u;
  const lmy = (fgy + 16 * u + lFy) / 2 + 6 * u;
  limb(fgx + 20 * u, fgy + 16 * u, lmx, lmy, 9.5 * u, 8 * u, CLOAK);
  limb(lmx, lmy, lFx, lFy + 4 * u, 8 * u, 6.8 * u, CLOAK);
  limbRim(lmx, lmy, lFx, lFy + 4 * u, 8 * u, 6.8 * u, lFx, lFy - 24 * u);
  const tipL = heldCandle(lFx, lFy, -0.1, 20 * u, 5.5 * u, 0.06);
  cupHand(tipL.x, tipL.y - 5 * u, -1, fgx - 6 * u, fgy + 34 * u);

  // ── 9. right pair — the edge figure reaches in ───────────────────────────
  const rFx = hx - 108 * u;
  const rFy = baseY - 59 * u;
  const rmx = (hx - 36 * u + rFx) / 2 + 4 * u;
  const rmy = (hy + 50 * u + rFy) / 2 + 12 * u;
  limb(hx - 36 * u, hy + 50 * u, rmx, rmy, 9 * u, 7.5 * u, CLOAK);
  limb(rmx, rmy, rFx, rFy + 4 * u, 7.5 * u, 6.5 * u, CLOAK);
  limbRim(rmx, rmy, rFx, rFy + 4 * u, 7.5 * u, 6.5 * u, rFx, rFy - 22 * u);
  const tipR = heldCandle(rFx, rFy, -0.14, 18 * u, 5.5 * u, -0.05);
  cupHand(tipR.x, tipR.y - 5 * u, 1, hx - 30 * u, hy + 84 * u);

  // ── 10. top pair — sleeves from above the frame, candle dipped to kindle ─
  const kFx = cx - 26 * u;
  const kFy = panY - 57 * u;
  limb(kFx - 40 * u, -20 * u, kFx - 20 * u, kFy * 0.45, 16 * u, 12 * u, CLOAK);
  limb(kFx - 20 * u, kFy * 0.45, kFx - 5 * u, kFy - 12 * u, 12 * u, 8 * u, CLOAK);
  limbRim(kFx - 20 * u, kFy * 0.45, kFx - 5 * u, kFy - 12 * u, 12 * u, 8 * u, flameF.x, flameF.y);
  limb(kFx + 52 * u, -20 * u, kFx + 42 * u, kFy * 0.4, 15 * u, 11 * u, CLOAK);
  limb(kFx + 42 * u, kFy * 0.4, kFx + 30 * u, kFy - 62 * u, 11 * u, 7.5 * u, CLOAK);
  limbRim(kFx + 42 * u, kFy * 0.4, kFx + 30 * u, kFy - 62 * u, 11 * u, 7.5 * u, flameF.x, flameF.y);
  const tipK = heldCandle(kFx, kFy, 1.35, 16 * u, 4.5 * u, 0.1);
  // fire passing fire: a shared bloom between the old flame and the new
  const pass = ctx.createRadialGradient((tipK.x + flameF.x) / 2, (tipK.y + flameF.y) / 2, 0, (tipK.x + flameF.x) / 2, (tipK.y + flameF.y) / 2, 22 * u);
  pass.addColorStop(0, mix(C.flame, C.flameHi, 0.5, 0.22));
  pass.addColorStop(1, mix(C.flame, C.flameHi, 0.5, 0));
  ctx.fillStyle = pass;
  ctx.fillRect((tipK.x + flameF.x) / 2 - 22 * u, (tipK.y + flameF.y) / 2 - 22 * u, 44 * u, 44 * u);
  // the steadying hand hovers, fingers half-curled over the kindling
  const gbx = kFx + 30 * u;
  const gby = kFy - 58 * u;
  ctx.fillStyle = FIST;
  ctx.beginPath();
  ctx.ellipse(gbx, gby, 7.5 * u, 6.5 * u, 0.3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  for (const [f0, f1, f2, f3] of [[-2, 5, -6, 16], [4, 5, 2, 17]] as const) {
    capsulePath(gbx + f0 * u, gby + f1 * u, gbx + f2 * u, gby + f3 * u, 2.4 * u);
    ctx.fillStyle = mix(C.inkSoft, C.ember, 0.1);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9 * u;
    ctx.stroke();
  }

  // ── 11. motes rising off the remnant ─────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = mix(C.ember, C.flame, rand(), 0.25 + rand() * 0.45);
    ctx.beginPath();
    ctx.arc(flameF.x + (rand() - 0.5) * 52 * u, flameF.y - 10 * u - rand() * 60 * u, (0.9 + rand() * 0.9) * u, 0, TAU);
    ctx.fill();
  }

  // ── 12. closing darkness: calm bottom, crushed top, corner vignettes ─────
  const calm = ctx.createLinearGradient(0, h * 0.62, 0, h);
  calm.addColorStop(0, shade(C.void, 0.55, 0));
  calm.addColorStop(0.55, shade(C.void, 0.55, 0.5));
  calm.addColorStop(1, shade(C.void, 0.5, 0.92));
  ctx.fillStyle = calm;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.15);
  crush.addColorStop(0, shade(C.void, 0.6, 0.85));
  crush.addColorStop(1, shade(C.void, 0.6, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.15);
  const vr = Math.min(w, h) * 0.48;
  for (const [vx, vy, va] of [[0, 0, 0.45], [w, 0, 0.45], [0, h, 0.6], [w, h, 0.6]] as const) {
    const v = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    v.addColorStop(0, shade(C.void, 0.5, va));
    v.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}
