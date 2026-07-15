// splash.ts — Guildhall feed card (08-M2-PORT-CONTRACT §1.11). DOM + one
// static <canvas>; importing "phaser" here is a build failure (invariant 7 —
// tools/byte-report asserts the splash chunk graph carries no phaser module
// and stays <= 300 KB). render/paint.ts is likewise off-limits (its module
// graph references phaser), so tiny local shade/mix helpers live here.
// Paints day / gate % / codex % / teaser from context.postData (zero API calls
// when present); falls back to GET /api/day. The single descend button calls
// requestExpandedMode(e, "game") — this trusted user gesture is also where the
// M3 audio unlock will live (invariant 6).
//
// The painting: "The Antechamber of the Great Gate" — a colossal buried hall
// in woodcut masses, three fog stops of receding arches, the sealed Gate as
// the central monument (rim rings, ridge spokes, rivets, gold boss, verdigris
// seam), four steps dotted with distant candles, near pillars framing.
// Repainted once per resize (dpr-aware, ResizeObserver + rAF debounce);
// deterministic via a private LCG. Ambient motion is CSS-only (splash.html).
import { context, requestExpandedMode } from "@devvit/web/client";

// ── token subset (mirrors design/tokens/tokens.css §2.1; splash.html inlines
// the same values — keep the three in sync) ────────────────────────────────
const C = {
  void: "#0b0a10",
  surface: "#16131c",
  surface2: "#1e1a26",
  flame: "#f5a93f",
  flameHi: "#ffd98a",
  ember: "#c9701e",
  verdigris: "#4fb39a",
  verdigrisDim: "#2e6b5c",
  parchmentAged: "#d6c7a3",
  bone: "#b7ae9c",
  goldInk: "#c8a24b",
} as const;

// ── tiny local color math (paint.ts pattern, phaser-free) ──────────────────
function parseColor(c: string): [number, number, number] {
  if (c.startsWith("#")) {
    const x = c.slice(1);
    return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
  }
  const m = /rgba?\(([\d.]+),([\d.]+),([\d.]+)/.exec(c.replace(/\s/g, ""));
  if (m !== null) return [Number(m[1]), Number(m[2]), Number(m[3])];
  throw new Error(`splash: unparseable color ${c}`);
}
function shade(color: string, f: number, a = 1): string {
  const [r, g, b] = parseColor(color);
  return `rgba(${Math.round(Math.min(255, r * f))},${Math.round(Math.min(255, g * f))},${Math.round(Math.min(255, b * f))},${a})`;
}
function mix(colorA: string, colorB: string, t: number, a = 1): string {
  const p = parseColor(colorA);
  const q = parseColor(colorB);
  return `rgba(${Math.round(p[0] + (q[0] - p[0]) * t)},${Math.round(p[1] + (q[1] - p[1]) * t)},${Math.round(p[2] + (q[2] - p[2]) * t)},${a})`;
}

// Private LCG (guildhall pattern, own seed) — never Math.random, so every
// repaint of the same size is pixel-identical.
function splashRand(seed: number): () => number {
  let s = seed >>> 0 || 0x6a7e;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ── THE ANTECHAMBER OF THE GREAT GATE ──────────────────────────────────────
interface SeamGeom {
  x: number;
  top: number;
  h: number;
  w: number;
}

function paintScene(ctx: CanvasRenderingContext2D, w: number, h: number): SeamGeom {
  const rand = splashRand(0x6a7e0517);
  const cx = w / 2;
  const s = Math.min(w, h);
  // 0 = tall portrait … 1 = wide feed strip; drives where the Gate sits
  const wide = Math.min(1, Math.max(0, (w / h - 0.6) / 1.15));
  const baseY = h * (0.6 + 0.2 * wide); // Gate base = top of the steps
  const R = Math.min(w * 0.4, baseY * 0.7); // Gate radius (top crushes off-frame)
  const gcy = baseY - R;
  const INK = shade(C.void, 0.6, 0.9);

  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  const ring = (r: number, lw: number, col: string, a0 = 0, a1 = Math.PI * 2): void => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, gcy, r, a0, a1);
    ctx.stroke();
  };

  // ── 1. base void — near-black, a breath of lift toward the threshold ────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, shade(C.void, 0.75));
  base.addColorStop(0.45, C.void);
  base.addColorStop(Math.min(0.99, baseY / h), mix(C.void, C.surface, 0.35));
  base.addColorStop(1, shade(C.void, 0.85));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. far-wall lift — the candle field's glow caught on the Gate wall ──
  const wall = ctx.createRadialGradient(cx, baseY - R * 0.3, R * 0.15, cx, baseY - R * 0.3, R * 2.1);
  wall.addColorStop(0, mix(C.void, C.surface, 0.6, 1));
  wall.addColorStop(0.55, mix(C.void, C.surface, 0.28, 1));
  wall.addColorStop(1, shade(C.void, 0.88, 1));
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  // ── 3. three fog stops of receding arches (nearer = darker silhouette) ──
  for (let i = 0; i < 3; i++) {
    // i = 0 farthest (hazy, tight to the Gate) … 2 nearest (dark, wide)
    const Ri = R * (1.26 + i * 0.36);
    const bw = R * (0.08 + i * 0.055);
    const tone = mix(C.void, C.surface, 0.46 - i * 0.15, 1);
    const floorI = baseY + (h - baseY) * (0.16 + i * 0.3);
    ctx.strokeStyle = tone;
    ctx.lineWidth = bw;
    ctx.beginPath();
    ctx.arc(cx, baseY, Ri, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
    // jambs dropping to each arch's own floor line
    ctx.fillStyle = tone;
    ctx.fillRect(cx - Ri - bw / 2, baseY - Ri * 0.05, bw, floorI - baseY + Ri * 0.05);
    ctx.fillRect(cx + Ri - bw / 2, baseY - Ri * 0.05, bw, floorI - baseY + Ri * 0.05);
    // crisp woodcut edge on each arch's inner rim — the shape must read
    ctx.strokeStyle = mix(C.surface, C.surface2, 1, 0.5 - i * 0.13);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, baseY, Ri - bw / 2, Math.PI * 1.04, Math.PI * 1.96);
    ctx.stroke();
  }

  // ── 4. carved stone surround + glyph ticks (Gate iconography) ───────────
  ring(R * 1.075, R * 0.05, mix(C.void, C.surface2, 0.85));
  ring(R * 1.11, Math.max(1, R * 0.007), shade(C.void, 0.7, 0.8));
  ring(R * 1.042, 1, shade(C.surface2, 1.35, 0.4));
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + (rand() - 0.5) * 0.02;
    const r0 = R * 1.125;
    const r1 = r0 + R * 0.028 + rand() * R * 0.012;
    ctx.strokeStyle = i % 5 === 0 ? shade(C.goldInk, 0.9, 0.4) : shade(C.bone, 0.62, 0.22);
    ctx.lineWidth = 1;
    line(cx + Math.cos(a) * r0, gcy + Math.sin(a) * r0, cx + Math.cos(a) * r1, gcy + Math.sin(a) * r1);
  }

  // ── 5. THE GREAT GATE — the sealed disc ─────────────────────────────────
  ctx.strokeStyle = shade(C.void, 0.3, 0.9); // socket shadow
  ctx.lineWidth = Math.max(3, R * 0.02);
  ctx.beginPath();
  ctx.arc(cx, gcy, R + R * 0.012, 0, Math.PI * 2);
  ctx.stroke();
  const disc = ctx.createRadialGradient(cx, baseY - R * 0.26, R * 0.05, cx, gcy, R * 1.02);
  disc.addColorStop(0, mix(C.surface2, C.ember, 0.32, 1));
  disc.addColorStop(0.38, mix(C.surface, C.surface2, 0.85, 1));
  disc.addColorStop(1, mix(C.void, C.surface, 0.42, 1));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, gcy, R, 0, Math.PI * 2);
  ctx.fill();

  // rim rings + a cool crown arc so the monument survives the top crush
  ring(R - Math.max(1.5, R * 0.008), Math.max(2, R * 0.014), shade(C.surface2, 2.0, 0.95));
  ring(R * 0.962, 1, shade(C.surface2, 1.4, 0.45));
  ring(R * 0.86, Math.max(1, R * 0.007), shade(C.surface2, 1.5, 0.5));
  ring(R * 0.6, 1, shade(C.surface2, 1.4, 0.35));
  ring(R - Math.max(1.5, R * 0.008), Math.max(1.4, R * 0.009), mix(C.surface2, C.verdigrisDim, 0.65, 0.75), -Math.PI * 0.82, -Math.PI * 0.18);

  // ridge spokes (skip where the seam runs) — dark groove + lit edge
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16 + (rand() - 0.5) * 0.02;
    if (Math.abs(Math.cos(a)) < 0.14) continue;
    const x0 = cx + Math.cos(a) * R * 0.33;
    const y0 = gcy + Math.sin(a) * R * 0.33;
    const x1 = cx + Math.cos(a) * R * 0.85;
    const y1 = gcy + Math.sin(a) * R * 0.85;
    ctx.strokeStyle = shade(C.void, 0.8, 0.8);
    ctx.lineWidth = Math.max(1.2, R * 0.011);
    line(x0, y0, x1, y1);
    const off = Math.max(1, R * 0.008);
    ctx.strokeStyle = shade(C.surface2, 1.55, Math.sin(a) > 0 ? 0.6 : 0.3);
    ctx.lineWidth = 1;
    line(x0 + off * Math.cos(a + Math.PI / 2), y0 + off * Math.sin(a + Math.PI / 2), x1 + off * Math.cos(a + Math.PI / 2), y1 + off * Math.sin(a + Math.PI / 2));
  }

  // rivets on the outer band — the lower ones catch the candlelight
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + (rand() - 0.5) * 0.03;
    const rx = cx + Math.cos(a) * R * 0.925;
    const ry = gcy + Math.sin(a) * R * 0.925;
    ctx.fillStyle = shade(C.surface2, 1.5, 0.9);
    ctx.beginPath();
    ctx.arc(rx, ry, Math.max(1.2, R * 0.011), 0, Math.PI * 2);
    ctx.fill();
    if (Math.sin(a) > 0.25) {
      ctx.fillStyle = mix(C.flame, C.goldInk, 0.4, 0.5);
      ctx.beginPath();
      ctx.arc(rx, ry + Math.max(0.6, R * 0.004), Math.max(0.6, R * 0.005), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // rune tick rings — carved sigils, every fourth gilt
  for (const [rr, n] of [
    [0.74, 34],
    [0.5, 22],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.03;
      if (Math.abs(Math.cos(a)) < 0.1) continue;
      const r0 = R * rr;
      const r1 = r0 + R * 0.022 + rand() * R * 0.018;
      const gilt = i % 4 === 0;
      ctx.strokeStyle = gilt ? shade(C.goldInk, 0.85, 0.32) : mix(C.bone, C.verdigrisDim, 0.45, 0.18);
      ctx.lineWidth = gilt ? 1.3 : 1;
      line(cx + Math.cos(a) * r0, gcy + Math.sin(a) * r0, cx + Math.cos(a) * r1, gcy + Math.sin(a) * r1);
    }
  }

  // ── 6. the gold-ringed boss, split by the seam ───────────────────────────
  const bossR = R * 0.16;
  ctx.fillStyle = mix(C.ember, C.void, 0.68, 1);
  ctx.beginPath();
  ctx.arc(cx, gcy, bossR * 0.66, 0, Math.PI * 2);
  ctx.fill();
  ring(bossR, Math.max(1.5, R * 0.013), mix(C.goldInk, C.ember, 0.3, 0.9));
  ring(bossR * 1.1, 1, shade(C.void, 0.5, 0.5));
  ring(bossR * 0.66, 1, shade(C.goldInk, 0.7, 0.5));
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) > 0.82) continue; // the seam ate the verticals
    ctx.strokeStyle = mix(C.goldInk, C.void, 0.3, 0.55);
    ctx.lineWidth = 1.4;
    line(cx + Math.cos(a) * bossR * 0.7, gcy + Math.sin(a) * bossR * 0.7, cx + Math.cos(a) * bossR * 0.95, gcy + Math.sin(a) * bossR * 0.95);
  }

  // ── 7. warm kiss — candle field glow licking the Gate's lower face ──────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const kiss = ctx.createRadialGradient(cx, baseY + h * 0.02, 0, cx, baseY + h * 0.02, R * 1.15);
  kiss.addColorStop(0, shade(C.flame, 0.55, 0.16));
  kiss.addColorStop(0.55, shade(C.ember, 0.55, 0.07));
  kiss.addColorStop(1, shade(C.ember, 0.55, 0));
  ctx.fillStyle = kiss;
  ctx.fillRect(cx - R * 1.2, baseY - R * 1.2, R * 2.4, R * 1.3);
  ctx.restore();

  // ── 8. THE SEAM — verdigris breath down the Gate's center ───────────────
  const seamTop = Math.max(gcy - R * 0.9, h * 0.16);
  const seamGrad = (aTop: number, aMid: number, aBot: number, col: string): CanvasGradient => {
    const g = ctx.createLinearGradient(0, seamTop, 0, baseY);
    const midT = Math.min(0.9, Math.max(0.1, (gcy - seamTop) / (baseY - seamTop)));
    g.addColorStop(0, shade(col, 1, 0));
    g.addColorStop(0.12, shade(col, 1, aTop));
    g.addColorStop(midT, shade(col, 1, aMid));
    g.addColorStop(1, shade(col, 1, aBot));
    return g;
  };
  ctx.strokeStyle = seamGrad(0.03, 0.13, 0.07, C.verdigrisDim);
  ctx.lineWidth = Math.max(4, R * 0.055);
  line(cx, seamTop, cx, baseY);
  ctx.strokeStyle = seamGrad(0.08, 0.42, 0.26, C.verdigris);
  ctx.lineWidth = Math.max(1.4, R * 0.013);
  line(cx, seamTop, cx, baseY);
  ctx.strokeStyle = seamGrad(0.14, 0.7, 0.48, shade(C.verdigris, 1.45));
  ctx.lineWidth = Math.max(1, R * 0.005);
  line(cx, seamTop, cx, baseY);
  // patina drips beside the seam
  for (let i = 0; i < 9; i++) {
    const sx = cx + (rand() < 0.5 ? -1 : 1) * (R * 0.018 + rand() * R * 0.05);
    const sy = seamTop + rand() * (baseY - seamTop) * 0.9;
    ctx.strokeStyle = shade(C.verdigrisDim, 0.9 + rand() * 0.4, 0.16 + rand() * 0.18);
    ctx.lineWidth = 1;
    line(sx, sy, sx, sy + R * (0.03 + rand() * 0.06));
  }
  // seam spill onto the threshold
  ctx.save();
  ctx.translate(cx, baseY + 1);
  ctx.scale(1, 0.3);
  const spill = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.35);
  spill.addColorStop(0, shade(C.verdigris, 1, 0.12));
  spill.addColorStop(1, shade(C.verdigris, 1, 0));
  ctx.fillStyle = spill;
  ctx.fillRect(-R * 0.4, -R * 0.4, R * 0.8, R * 0.8);
  ctx.restore();

  // ── 9. mist at the threshold — lifts the Gate base off the steps ────────
  const mist = ctx.createLinearGradient(0, baseY - R * 0.14, 0, baseY + R * 0.05);
  mist.addColorStop(0, mix(C.void, C.bone, 0.14, 0));
  mist.addColorStop(0.6, mix(C.void, C.bone, 0.14, 0.12));
  mist.addColorStop(1, mix(C.void, C.bone, 0.14, 0));
  ctx.fillStyle = mist;
  ctx.fillRect(0, baseY - R * 0.14, w, R * 0.19);

  // ── 10. four receding steps + the field of distant candles ──────────────
  // Each step: riser falling into shadow, a crisp warm tread edge, and a
  // loose row of candles standing just behind that edge — order, not fireflies.
  const stepFr = [0.13, 0.16, 0.21, 0.28]; // ~0.78 — the rest falls to dark
  interface Step {
    top: number;
    bh: number;
    hw: number;
  }
  const steps: Step[] = [];
  let sy0 = baseY;
  for (let k = 0; k < 4; k++) {
    const bh = (h - baseY) * (stepFr[k] ?? 0.25);
    const hw = Math.min(w * 0.54, R * 1.14 + (k + 1) * w * 0.075);
    steps.push({ top: sy0, bh, hw });
    // riser: lit faintly at the tread, falling to black at its foot
    const riser = ctx.createLinearGradient(0, sy0, 0, sy0 + bh);
    riser.addColorStop(0, mix(C.void, C.surface2, 0.5 - k * 0.07, 1));
    riser.addColorStop(1, mix(C.void, C.surface2, 0.16 - k * 0.03, 1));
    ctx.fillStyle = riser;
    ctx.fillRect(cx - hw, sy0, hw * 2, bh + 1);
    // beyond the step's ends the dark swallows the stair, softly
    for (const sideX of [-1, 1] as const) {
      const fl = ctx.createLinearGradient(cx + sideX * hw * 0.82, 0, cx + sideX * hw * 1.12, 0);
      fl.addColorStop(0, shade(C.void, 0.7, 0));
      fl.addColorStop(1, shade(C.void, 0.7, 1));
      ctx.fillStyle = fl;
      const x0 = sideX < 0 ? 0 : cx + hw * 0.82;
      ctx.fillRect(x0, sy0, sideX < 0 ? cx - hw * 0.82 : w - x0, bh + 1);
    }
    // lit tread top — a thin warm surface below the edge
    const tread = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
    tread.addColorStop(0, shade(C.ember, 0.6, 0));
    tread.addColorStop(0.5, mix(C.ember, C.flame, 0.3, 0.14 - k * 0.02));
    tread.addColorStop(1, shade(C.ember, 0.6, 0));
    ctx.fillStyle = tread;
    ctx.fillRect(cx - hw, sy0 + 1, hw * 2, Math.max(2, s * 0.006));
    // lit tread edge — warm at center, dying toward the dark flanks
    const edge = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
    edge.addColorStop(0, shade(C.ember, 0.7, 0));
    edge.addColorStop(0.5, mix(C.ember, C.flame, 0.55, 0.6 - k * 0.08));
    edge.addColorStop(1, shade(C.ember, 0.7, 0));
    ctx.strokeStyle = edge;
    ctx.lineWidth = k < 2 ? Math.max(1, s * 0.002) : Math.max(1.2, s * 0.0028);
    line(cx - hw, sy0, cx + hw, sy0);
    // shadow tucked under the edge
    ctx.strokeStyle = shade(C.void, 0.3, 0.55);
    ctx.lineWidth = Math.max(1, s * 0.0016);
    line(cx - hw, sy0 + Math.max(1.4, s * 0.003), cx + hw, sy0 + Math.max(1.4, s * 0.003));
    sy0 += bh;
  }
  // below the last tread the foreground falls out of the light
  const fore = ctx.createLinearGradient(0, sy0 - 2, 0, h);
  fore.addColorStop(0, shade(C.void, 0.6, 0));
  fore.addColorStop(1, shade(C.void, 0.55, 0.85));
  ctx.fillStyle = fore;
  ctx.fillRect(0, sy0 - 2, w, h - sy0 + 2);

  // the candles — 26 points of flame in loose rows along the treads,
  // the processional center column kept clear
  const rowCounts = [7, 7, 6, 6];
  for (let k = 0; k < 4; k++) {
    const st = steps[k];
    if (st === undefined) continue;
    const n = rowCounts[k] ?? 6;
    const clear = R * 0.28;
    const span = Math.min(st.hw * 0.92, w * 0.47) - clear;
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const tt = (Math.floor(i / 2) + 0.5) / Math.ceil(n / 2);
      const dist = Math.max(0, Math.min(Math.max(10, span), tt * Math.max(10, span) + (rand() - 0.5) * span * 0.22));
      const vx = cx + side * (clear + dist);
      const vy = st.top + st.bh * (0.08 + rand() * 0.16) + Math.max(2, s * 0.006);
      const sc = 0.66 + k * 0.34 + rand() * 0.25;
      const stubH = Math.max(2, s * 0.0085 * sc);
      const flameR = Math.max(0.8, s * 0.0026 * sc);
      // halo — tight, so the point reads as a flame not a firefly
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const hr = Math.max(3.5, s * 0.012) * sc;
      const halo = ctx.createRadialGradient(vx, vy - stubH, 0, vx, vy - stubH, hr);
      halo.addColorStop(0, shade(C.flame, 0.9, 0.4));
      halo.addColorStop(1, shade(C.flame, 0.9, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(vx - hr, vy - stubH - hr, hr * 2, hr * 2);
      // glint pooled on the tread beneath the stub
      const gl = ctx.createRadialGradient(vx, vy + 1, 0, vx, vy + 1, hr * 0.8);
      gl.addColorStop(0, shade(C.ember, 0.9, 0.2));
      gl.addColorStop(1, shade(C.ember, 0.9, 0));
      ctx.fillStyle = gl;
      ctx.save();
      ctx.translate(vx, vy + 1);
      ctx.scale(1, 0.32);
      ctx.fillRect(-hr, -hr, hr * 2, hr * 2);
      ctx.restore();
      ctx.restore();
      // wax stub, then the flame: warm body + hot core
      ctx.fillStyle = shade(C.parchmentAged, 0.62, 0.85);
      ctx.fillRect(vx - Math.max(0.6, s * 0.0015 * sc), vy - stubH, Math.max(1.2, s * 0.003 * sc), stubH);
      ctx.fillStyle = mix(C.flame, C.ember, 0.25, 0.95);
      ctx.beginPath();
      ctx.ellipse(vx, vy - stubH - flameR * 0.9, flameR * 0.75, flameR * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(C.flameHi, 1.15, 0.95);
      ctx.beginPath();
      ctx.ellipse(vx, vy - stubH - flameR * 0.75, flameR * 0.38, flameR * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 11. the processional path — the seam's ghost down the center steps ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const path = ctx.createLinearGradient(0, baseY, 0, h);
  path.addColorStop(0, shade(C.verdigris, 0.9, 0.11));
  path.addColorStop(0.55, shade(C.verdigrisDim, 1, 0.05));
  path.addColorStop(1, shade(C.verdigrisDim, 1, 0));
  ctx.fillStyle = path;
  const pathW = Math.max(8, R * 0.09);
  ctx.fillRect(cx - pathW / 2, baseY, pathW, h - baseY);
  ctx.restore();

  // ── 11b. warm floor breath, low center ───────────────────────────────────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const breath = ctx.createRadialGradient(cx, h * 1.05, 0, cx, h * 1.05, Math.max(w * 0.46, h * 0.44));
  breath.addColorStop(0, shade(C.flame, 0.6, 0.26));
  breath.addColorStop(0.55, shade(C.ember, 0.6, 0.09));
  breath.addColorStop(1, shade(C.ember, 0.6, 0));
  ctx.fillStyle = breath;
  ctx.fillRect(0, baseY - R * 0.2, w, h - baseY + R * 0.2);
  ctx.restore();

  // ── 12. near pillars — the darkest fog stop, framing left and right ─────
  const pw = Math.max(w * 0.055, s * 0.05);
  const plinthY = h * 0.84;
  ctx.fillStyle = shade(C.void, 0.45);
  ctx.fillRect(0, 0, pw, h);
  ctx.fillRect(w - pw, 0, pw, h);
  if (wide > 0.4) {
    ctx.fillRect(0, plinthY, pw * 1.55, h - plinthY); // plinths
    ctx.fillRect(w - pw * 1.55, plinthY, pw * 1.55, h - plinthY);
  }
  for (const px of [pw, w - pw] as const) {
    const dir = px < cx ? 1 : -1;
    ctx.fillStyle = shade(C.void, 0.45);
    ctx.beginPath(); // capital wedge
    ctx.moveTo(px, h * 0.2);
    ctx.lineTo(px + dir * Math.max(6, w * 0.014), h * 0.23);
    ctx.lineTo(px + dir * Math.max(6, w * 0.014), h * 0.27);
    ctx.lineTo(px, h * 0.29);
    ctx.closePath();
    ctx.fill();
    // inner edge — cold above, kissed warm where the candle field reaches
    const edgeG = ctx.createLinearGradient(0, 0, 0, h);
    edgeG.addColorStop(0, mix(C.void, C.surface2, 0.7, 0.2));
    edgeG.addColorStop(0.45, mix(C.void, C.surface2, 0.8, 0.5));
    edgeG.addColorStop(0.8, mix(C.surface2, C.ember, 0.4, 0.5));
    edgeG.addColorStop(1, mix(C.surface2, C.ember, 0.55, 0.65));
    ctx.strokeStyle = edgeG;
    ctx.lineWidth = Math.max(1, s * 0.0022);
    line(px + dir, h * 0.03, px + dir, wide > 0.4 ? plinthY : h);
  }

  // ── 13. grain over the darks ─────────────────────────────────────────────
  for (let i = 0; i < 300; i++) {
    const gx = rand() * w;
    const gy = rand() * h;
    ctx.fillStyle = rand() < 0.5 ? shade(C.bone, 1, 0.015 + rand() * 0.02) : shade(C.void, 0.3, 0.03 + rand() * 0.03);
    ctx.fillRect(gx, gy, 1, 1);
  }

  // ── 14. heavy top crush + corner vignette ────────────────────────────────
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.34);
  crush.addColorStop(0, shade(C.void, 0.55, 0.94));
  crush.addColorStop(1, shade(C.void, 0.55, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.34);
  const vr = s * 0.6;
  for (const [vx, vy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    const v = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    v.addColorStop(0, shade(C.void, 0.5, 0.4));
    v.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  return { x: cx, top: seamTop, h: baseY - seamTop, w: Math.max(16, R * 0.16) };
}

// ── scene mount: dpr-aware, ResizeObserver + rAF debounce, painted once ────
function mountScene(): void {
  const cv = document.getElementById("uv-scene");
  if (!(cv instanceof HTMLCanvasElement)) return;
  const root = document.documentElement;
  let raf = 0;
  const repaint = (): void => {
    raf = 0;
    const cw = cv.clientWidth;
    const ch = cv.clientHeight;
    if (cw === 0 || ch === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
    const ctx = cv.getContext("2d");
    if (ctx === null) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const seam = paintScene(ctx, cw, ch);
    root.style.setProperty("--seam-x", `${seam.x}px`);
    root.style.setProperty("--seam-top", `${seam.top}px`);
    root.style.setProperty("--seam-h", `${seam.h}px`);
    root.style.setProperty("--seam-w", `${seam.w}px`);
    document.body.classList.add("uv-ready");
  };
  const queue = (): void => {
    if (raf !== 0) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(repaint);
  };
  new ResizeObserver(queue).observe(cv);
  queue();
}

// ── data plumbing (unchanged contract) ─────────────────────────────────────
interface SplashData {
  day: number;
  gatePct: number;
  codexPct: number;
  teaser: string;
  houseLine?: string;
}

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function parseSplash(raw: unknown): SplashData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const day = asNum(r["day"]);
  const gatePct = asNum(r["gatePct"]);
  const codexPct = asNum(r["codexPct"]);
  const teaser = asStr(r["teaser"]);
  if (day === null || gatePct === null || codexPct === null || teaser === null) return null;
  const houseLine = asStr(r["houseLine"]);
  return houseLine === null
    ? { day, gatePct, codexPct, teaser }
    : { day, gatePct, codexPct, teaser, houseLine };
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`splash: missing #${id}`);
  return node;
}

function paint(d: SplashData): void {
  el("uv-day").textContent = String(d.day);
  el("uv-gate").textContent = String(d.gatePct);
  el("uv-codex").textContent = String(d.codexPct);
  el("uv-teaser").textContent = d.teaser;
  if (d.houseLine !== undefined) el("uv-house").textContent = d.houseLine;
}

async function fetchDay(): Promise<SplashData | null> {
  try {
    const res = await fetch("/api/day"); // same-origin only (invariant 4)
    if (!res.ok) return null;
    return parseSplash((await res.json()) as unknown);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  mountScene();
  el("uv-descend").addEventListener("click", (e: MouseEvent) => {
    requestExpandedMode(e, "game");
  });

  const data = parseSplash(context.postData) ?? (await fetchDay());
  if (data !== null) {
    paint(data);
  } else {
    document.body.classList.add("uv-unopened");
    el("uv-day").textContent = "The gate is not yet open.";
    el("uv-teaser").textContent = "No descent has been minted today.";
    el("uv-gate").textContent = "–";
    el("uv-codex").textContent = "–";
  }
}

void main();
