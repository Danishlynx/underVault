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
  parchment: "#eae0c9",
  parchmentAged: "#d6c7a3",
  bone: "#b7ae9c",
  boneDim: "#7e786c",
  ink: "#2a2520",
  inkSoft: "#4a443b",
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

// ── the vigil candle (backdrop.ts "The Vigil" vocabulary, phaser-free) ──────
// A LIT tallow candle in the guildhall idiom: soft contact shadow, a firm
// seat on the stone, a lobed wax pool with a woodcut rim + glossy lip, a
// tapered drip-skirted body carrying an ink cut-line, a melted crater, a
// charred wick and a painted teardrop flame. This is the splash's warm
// foreground anchor — the amber half of the two-hue law made flesh. Returns
// the flame's luminous heart so the caller can lay its response light.
const TAU = Math.PI * 2;
function paintCandle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  ledgeY: number,
  ch: number,
  cw: number,
  s: number,
  rand: () => number,
): { wx: number; wy: number; fr: number } {
  const ink = shade(C.void, 0.62, 0.9);
  const topY = ledgeY - ch;
  const cwHalf = cw / 2;
  const spread = cw * 0.09;
  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  // soft contact shadow — the candle presses into its own dark
  ctx.save();
  ctx.translate(cx, ledgeY + ch * 0.012);
  ctx.scale(1, 0.22);
  const contact = ctx.createRadialGradient(0, 0, 0, 0, 0, cw * 1.5);
  contact.addColorStop(0, shade(C.void, 0.5, 0.72));
  contact.addColorStop(0.55, shade(C.void, 0.5, 0.4));
  contact.addColorStop(1, shade(C.void, 0.5, 0));
  ctx.fillStyle = contact;
  ctx.fillRect(-cw * 1.5, -cw * 1.5, cw * 3, cw * 3);
  ctx.restore();
  // and a firmer seat right at the foot — the candle SITS on the stone
  ctx.fillStyle = shade(C.void, 0.5, 0.5);
  ctx.beginPath();
  ctx.ellipse(cx + cw * 0.03, ledgeY + ch * 0.004, cw * 0.66, ch * 0.02, 0, 0, TAU);
  ctx.fill();

  // the wax pool — the day's tide-mark, a lobed blob smoothed through midpoints
  const poolR = cw * 0.86;
  const poolRy = poolR * 0.2;
  const poolCx = cx + cw * 0.05;
  const poolCy = ledgeY + poolRy * 0.2;
  ctx.save();
  ctx.translate(poolCx, poolCy);
  ctx.scale(1, poolRy / poolR);
  const PN = 9;
  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i < PN; i++) {
    const a = (i / PN) * TAU;
    const r = poolR * (0.9 + rand() * 0.18);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const poolPath = (): void => {
    const mid = (i: number): readonly [number, number] => {
      const p = pts[i % PN]!;
      const q = pts[(i + 1) % PN]!;
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    };
    ctx.beginPath();
    const m0 = mid(0);
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 1; i <= PN; i++) {
      const p = pts[i % PN]!;
      const m = mid(i);
      ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    ctx.closePath();
  };
  const poolG = ctx.createRadialGradient(-poolR * 0.2, -poolR * 0.25, poolR * 0.06, 0, 0, poolR);
  poolG.addColorStop(0, mix(C.parchmentAged, C.flame, 0.22, 0.9));
  poolG.addColorStop(0.55, mix(C.parchmentAged, C.boneDim, 0.5, 0.62));
  poolG.addColorStop(1, mix(C.boneDim, C.void, 0.55, 0.3));
  poolPath();
  ctx.fillStyle = poolG;
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.7, 0.28); // woodcut rim
  ctx.lineWidth = 1.2;
  poolPath();
  ctx.stroke();
  ctx.save(); // glossy inner lip where the low light lies on the fresh wax
  ctx.scale(0.94, 0.94);
  poolPath();
  ctx.strokeStyle = mix(C.parchment, C.flameHi, 0.35, 0.16);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // the body — melted foot, eroded crater rim; the flame lives at the TOP so
  // the wax warms toward the crown and cools into the ledge's dark at the foot
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - cwHalf - spread, ledgeY);
    ctx.bezierCurveTo(cx - cwHalf - spread * 0.4, ledgeY - ch * 0.3, cx - cwHalf + cw * 0.02, ledgeY - ch * 0.62, cx - cw * 0.43, topY + ch * 0.02);
    ctx.quadraticCurveTo(cx - cw * 0.1, topY - ch * 0.012, cx + cw * 0.08, topY + ch * 0.02);
    ctx.quadraticCurveTo(cx + cw * 0.28, topY + ch * 0.04, cx + cw * 0.41, topY + ch * 0.035);
    ctx.bezierCurveTo(cx + cwHalf + cw * 0.01, ledgeY - ch * 0.6, cx + cwHalf + spread * 0.5, ledgeY - ch * 0.26, cx + cwHalf + spread, ledgeY);
    ctx.closePath();
  };
  const bodyG = ctx.createLinearGradient(0, topY, 0, ledgeY);
  bodyG.addColorStop(0, mix(C.parchment, C.flame, 0.3)); // crown warmed by the flame
  bodyG.addColorStop(0.18, mix(C.parchmentAged, C.flame, 0.12));
  bodyG.addColorStop(0.5, mix(C.bone, C.boneDim, 0.45));
  bodyG.addColorStop(1, mix(C.boneDim, C.void, 0.55));
  body();
  ctx.fillStyle = bodyG;
  ctx.fill();
  ctx.save(); // side shade clipped to the wax — round the pillar off
  body();
  ctx.clip();
  const sideG = ctx.createLinearGradient(cx - cwHalf, 0, cx + cwHalf, 0);
  sideG.addColorStop(0, shade(C.void, 0.8, 0.32));
  sideG.addColorStop(0.35, shade(C.void, 0.8, 0));
  sideG.addColorStop(0.8, shade(C.void, 0.8, 0));
  sideG.addColorStop(1, shade(C.void, 0.8, 0.18));
  ctx.fillStyle = sideG;
  ctx.fillRect(cx - cw, topY - ch * 0.05, cw * 2, ch * 1.1);
  ctx.strokeStyle = shade(C.boneDim, 0.85, 0.3); // tally scratches
  ctx.lineWidth = 1;
  const tallyY = ledgeY - ch * 0.42;
  for (let i = 0; i < 5; i++) {
    const tx = cx - cw * 0.24 + i * cw * 0.1;
    line(tx, tallyY, tx - cw * 0.02, tallyY + ch * 0.045);
  }
  ctx.restore();
  body();
  ctx.strokeStyle = ink; // the woodcut cut-line
  ctx.lineWidth = Math.max(1.4, s * 0.0032);
  ctx.stroke();

  // the crater — a melted well around the wick root
  const craterCx = cx + cw * 0.03;
  const craterY = topY + ch * 0.03;
  ctx.fillStyle = mix(C.parchmentAged, C.ink, 0.42);
  ctx.beginPath();
  ctx.ellipse(craterCx, craterY, cw * 0.28, ch * 0.02, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mix(C.ink, C.void, 0.3, 0.8);
  ctx.beginPath();
  ctx.ellipse(craterCx, craterY + ch * 0.002, cw * 0.15, ch * 0.011, 0, 0, TAU);
  ctx.fill();

  // the drip skirt — old ribbons behind, fresh rim-runs in front
  const drip = (x: number, yTop: number, len: number, wr: number, top: string, bot: string): void => {
    const g = ctx.createLinearGradient(0, yTop, 0, yTop + len);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - wr, yTop);
    ctx.bezierCurveTo(x - wr * 1.06, yTop + len * 0.42, x - wr * 0.86, yTop + len - wr * 1.5, x - wr * 0.72, yTop + len - wr);
    ctx.arc(x, yTop + len - wr, wr * 0.72, Math.PI, 0, true);
    ctx.bezierCurveTo(x + wr * 0.9, yTop + len - wr * 1.6, x + wr * 1.06, yTop + len * 0.4, x + wr, yTop);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 0.7, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  const freshTop = mix(C.parchment, C.flame, 0.16);
  const freshBot = mix(C.parchmentAged, C.boneDim, 0.4);
  const oldTop = mix(C.parchmentAged, C.bone, 0.4);
  const oldBot = mix(C.boneDim, C.void, 0.45);
  drip(cx - cw * 0.44, topY + ch * 0.05, ch * 0.5, cw * 0.05, oldTop, oldBot);
  drip(cx + cw * 0.44, topY + ch * 0.04, ch * 0.62, cw * 0.06, oldTop, oldBot);
  const skirt: ReadonlyArray<readonly [number, number, number]> = [
    [-0.34, 0.14, 0.055],
    [-0.16, 0.2, 0.07],
    [0.04, 0.1, 0.05],
    [0.22, 0.26, 0.075],
    [0.4, 0.16, 0.06],
  ];
  for (const [ox, ol, owr] of skirt) {
    drip(cx + cw * ox, topY + ch * (0.02 + rand() * 0.02), ch * ol, cw * owr, freshTop, freshBot);
  }

  // the charred wick — the flame itself is a CSS-animated div overlaid at the
  // wick tip (splash.html), so it truly LIVES, matching the loader/menu flame.
  // The painter's job ends at the wick; the caller lays the response glow and
  // exposes this anchor. (A short lit wick-stub reads warm under the div.)
  const wickLen = ch * 0.085;
  const wickTipX = cx + cw * 0.05;
  const wickTipY = topY - wickLen;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = mix(C.ink, C.flame, 0.35);
  ctx.lineWidth = Math.max(1.6, s * 0.003);
  ctx.beginPath();
  ctx.moveTo(craterCx, craterY - ch * 0.004);
  ctx.quadraticCurveTo(cx + cw * 0.02, topY - wickLen * 0.55, wickTipX, wickTipY);
  ctx.stroke();
  ctx.restore();
  // flame scale follows the candle's girth, so the stub burns a smaller flame
  return { wx: wickTipX, wy: wickTipY, fr: Math.max(3, cw * 0.28) };
}

// ── THE ANTECHAMBER OF THE GREAT GATE ──────────────────────────────────────
interface SeamGeom {
  x: number;
  top: number;
  h: number;
  w: number;
}
// Where the living CSS flames sit — wick tip (x,y) and a flame scale (s), all
// in CSS px. splash.html positions its animated flame divs from these.
interface FlameGeom {
  x: number;
  y: number;
  s: number;
}
interface SceneGeom {
  seam: SeamGeom;
  flames: readonly FlameGeom[];
}

function paintScene(ctx: CanvasRenderingContext2D, w: number, h: number): SceneGeom {
  const rand = splashRand(0x6a7e0517);
  const cx = w / 2;
  const s = Math.min(w, h);
  // 0 = tall portrait … 1 = wide feed strip; drives where the Gate sits
  const wide = Math.min(1, Math.max(0, (w / h - 0.6) / 1.15));
  const baseY = h * (0.6 + 0.2 * wide); // Gate base = top of the steps
  const R = Math.min(w * 0.4, baseY * 0.7); // Gate radius (top crushes off-frame)
  const gcy = baseY - R;

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
  // a soft tall column of leaked light behind the seam — the crack breathes
  // (the cool half of the two-hue law, kept to the Gate center only)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(cx, gcy);
  ctx.scale(1, 6);
  const leakGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.17);
  leakGlow.addColorStop(0, mix(C.verdigrisDim, C.verdigris, 0.5, 0.2));
  leakGlow.addColorStop(1, mix(C.verdigrisDim, C.verdigris, 0.5, 0));
  ctx.fillStyle = leakGlow;
  ctx.fillRect(-R * 0.2, -R * 0.2, R * 0.4, R * 0.4);
  ctx.restore();
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

  // ── 15. THE FOREGROUND VIGIL — a delver's candle at the antechamber's edge
  // Painted last so it keeps its warmth above the crush and vignette: the
  // scene's nearest object and its warm anchor, seated on a broken shelf in
  // the lower-left (the Gate's cold symmetry answered by one hand-lit flame).
  const vch = h * (0.2 - wide * 0.06);
  const vcw = Math.min(vch * 0.34, w * 0.08);
  const vcx = w * (0.14 + wide * 0.02);
  const vLedgeY = h * (0.9 - wide * 0.02);
  // the worn stone shelf it stands on — jutting from the left, lip warm-lit
  const shelfR = vcx + vcw * 3.4;
  const shelfG = ctx.createLinearGradient(0, vLedgeY - s * 0.01, 0, h);
  shelfG.addColorStop(0, mix(C.void, C.surface2, 0.55, 0.97));
  shelfG.addColorStop(0.45, mix(C.void, C.surface, 0.3, 0.98));
  shelfG.addColorStop(1, shade(C.void, 0.72, 1));
  ctx.fillStyle = shelfG;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, vLedgeY + s * 0.01);
  ctx.quadraticCurveTo(vcx, vLedgeY - s * 0.006, shelfR, vLedgeY + s * 0.012);
  ctx.lineTo(shelfR + s * 0.01, h);
  ctx.closePath();
  ctx.fill();
  const crestWarm = ctx.createLinearGradient(vcx - vcw * 2.4, 0, shelfR, 0);
  crestWarm.addColorStop(0, mix(C.flame, C.bone, 0.5, 0));
  crestWarm.addColorStop(0.42, mix(C.flame, C.bone, 0.42, 0.45));
  crestWarm.addColorStop(1, mix(C.flame, C.bone, 0.5, 0));
  ctx.strokeStyle = crestWarm;
  ctx.lineWidth = Math.max(1, s * 0.0022);
  ctx.beginPath();
  ctx.moveTo(0, vLedgeY + s * 0.01);
  ctx.quadraticCurveTo(vcx, vLedgeY - s * 0.006, shelfR, vLedgeY + s * 0.012);
  ctx.stroke();
  // the cluster: a tall vigil and a squat stub set a little forward
  const main = paintCandle(ctx, vcx, vLedgeY, vch, vcw, s, rand);
  const stub = paintCandle(ctx, vcx + vcw * 1.75, vLedgeY + s * 0.004, vch * 0.44, vcw * 0.64, s, rand);
  // response light — as if both flames already burn (lighter composite). The
  // heart hovers a flame-scale above the wick, where the CSS flame div sits.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [c, k] of [
    [main, 1],
    [stub, 0.5],
  ] as const) {
    const fx = c.wx;
    const fy = c.wy - c.fr;
    const rr = vch * 1.5 * (0.6 + 0.4 * k);
    const amb = ctx.createRadialGradient(fx, fy, 0, fx, fy, rr);
    amb.addColorStop(0, shade(C.flame, 0.6, 0.24 * k));
    amb.addColorStop(0.4, shade(C.ember, 0.55, 0.08 * k));
    amb.addColorStop(1, shade(C.ember, 0.55, 0));
    ctx.fillStyle = amb;
    ctx.fillRect(fx - rr, fy - rr, rr * 2, rr * 2);
    const mr = vch * 0.66 * (0.6 + 0.4 * k); // a medium bathe over the wax
    const med = ctx.createRadialGradient(fx, fy, 0, fx, fy, mr);
    med.addColorStop(0, shade(C.flame, 0.65, 0.22 * k));
    med.addColorStop(0.5, shade(C.ember, 0.55, 0.07 * k));
    med.addColorStop(1, shade(C.ember, 0.55, 0));
    ctx.fillStyle = med;
    ctx.fillRect(fx - mr, fy - mr, mr * 2, mr * 2);
    const hr = c.fr * 3.6;
    const hot = ctx.createRadialGradient(fx, fy, 0, fx, fy, hr);
    hot.addColorStop(0, shade(C.flameHi, 1, 0.5 * k));
    hot.addColorStop(0.45, shade(C.flame, 0.9, 0.16 * k));
    hot.addColorStop(1, shade(C.flame, 0.9, 0));
    ctx.fillStyle = hot;
    ctx.fillRect(fx - hr, fy - hr, hr * 2, hr * 2);
  }
  // a broad warm pool laid across the shelf stone, reaching out into the
  // antechamber floor — no hard edge
  ctx.translate(vcx + vcw * 0.9, vLedgeY + s * 0.004);
  ctx.scale(1, 0.3);
  const poolR2 = vch * 1.75;
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, poolR2);
  pool.addColorStop(0, shade(C.flame, 0.65, 0.3));
  pool.addColorStop(0.22, shade(C.flame, 0.6, 0.16));
  pool.addColorStop(0.5, shade(C.ember, 0.55, 0.08));
  pool.addColorStop(1, shade(C.ember, 0.55, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-poolR2, -poolR2, poolR2 * 2, poolR2 * 2);
  ctx.restore();

  // ── 16. THE FOLIO — gold-ink corner brackets close the leaf (guildhall
  // iconography): the feed card read as a page torn from the Codex ─────────
  const m = Math.max(9, s * 0.022);
  const armX = Math.max(22, w * 0.1);
  const armY = Math.max(22, h * 0.072);
  const corners: ReadonlyArray<readonly [number, number, number, number]> = [
    [m, m, 1, 1],
    [w - m, m, -1, 1],
    [m, h - m, 1, -1],
    [w - m, h - m, -1, -1],
  ];
  for (const [bx, by, dx, dy] of corners) {
    ctx.strokeStyle = mix(C.void, C.goldInk, 0.55, 0.5);
    ctx.lineWidth = 1;
    line(bx, by, bx + dx * armX, by);
    line(bx, by, bx, by + dy * armY);
    const o = Math.max(4, s * 0.009);
    ctx.strokeStyle = mix(C.void, C.goldInk, 0.6, 0.26);
    line(bx + dx * o, by + dy * o, bx + dx * armX * 0.66, by + dy * o);
    line(bx + dx * o, by + dy * o, bx + dx * o, by + dy * armY * 0.66);
    ctx.save(); // corner diamond bloom
    ctx.translate(bx, by);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = shade(C.void, 0.5, 0.9);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = mix(C.goldInk, C.void, 0, 0.55);
    ctx.fillRect(-3.2, -3.2, 6.4, 6.4);
    ctx.restore();
    ctx.strokeStyle = mix(C.goldInk, C.bone, 0.3, 0.42); // inward flourish curl
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bx + dx * 12, by);
    ctx.quadraticCurveTo(bx + dx * 27, by - dy * 4, bx + dx * 42, by + dy * 5);
    ctx.stroke();
  }
  // folio diamonds at the edge midpoints
  ctx.fillStyle = mix(C.goldInk, C.void, 0, 0.3);
  for (const [dx2, dy2] of [
    [w / 2, m],
    [w / 2, h - m],
    [m, h / 2],
    [w - m, h / 2],
  ] as const) {
    ctx.save();
    ctx.translate(dx2, dy2);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }

  return {
    seam: { x: cx, top: seamTop, h: baseY - seamTop, w: Math.max(16, R * 0.16) },
    flames: [
      { x: main.wx, y: main.wy, s: main.fr },
      { x: stub.wx, y: stub.wy, s: stub.fr },
    ],
  };
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
    const geom = paintScene(ctx, cw, ch);
    const seam = geom.seam;
    root.style.setProperty("--seam-x", `${seam.x}px`);
    root.style.setProperty("--seam-top", `${seam.top}px`);
    root.style.setProperty("--seam-h", `${seam.h}px`);
    root.style.setProperty("--seam-w", `${seam.w}px`);
    geom.flames.forEach((f, i) => {
      const n = i + 1;
      root.style.setProperty(`--f${n}-x`, `${f.x}px`);
      root.style.setProperty(`--f${n}-y`, `${f.y}px`);
      root.style.setProperty(`--f${n}-s`, `${f.s}px`);
    });
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
