/**
 * Main-menu backdrop — "The Vigil."
 *
 * The most-seen image in the game: one breathing scene, the moment before a
 * match is struck. A great tallow pillar-candle — ancient, drip-skirted,
 * UNLIT, bare charred wick — keeps watch on a worn stone ledge in the
 * lower-left third. Beyond it the frame falls away into a colossal buried
 * dark: a rocky spur carries switchback steps and a sparse constellation of
 * other delvers' vigil-lights fading with distance, and far center-right the
 * Great Gate looms half-swallowed by fog — carved rim rings, ridge spokes,
 * rivets, one verdigris breath at its sleeping seam. Ribbed stone vaulting
 * closes the top of frame in two fog stops; gold-ink folio corners close the
 * right and bottom.
 *
 * Painted in the guildhall idiom: flat woodcut masses, fog-stop depth, token
 * colors via shade()/mix() only, a private seeded LCG for jitter. A shade
 * more luminous than gameplay — this is a poster, not fog-of-war — but the
 * two-hue law holds: amber only around candle-points, verdigris only at the
 * Gate seam, everything else cool void and surface stone. Every mass edge
 * either exits the frame or dissolves into atmosphere — nothing terminates
 * mid-air.
 *
 * The caller has DPR-scaled and cleared the context. The engine overlays a
 * live animated flame at the wick tip; paintMenuBackdrop returns that anchor
 * (and a suggested flame height, ~7% of frame height) as fractions of w/h.
 * The warm "response light" on the candle and ledge is painted here, as if
 * the flame were already burning — the overlay alone cannot light the wax.
 * The center-left column (x 0.28–0.62, y 0.30–0.75) stays calm and dark:
 * the DOM menu renders there. A separate glass overlay module paints above
 * this backdrop — no glass effects here.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall's hallRand pattern, own seed) — never Math.random,
// never paint.ts crand (its stream belongs to the world-texture painters).
function vigilRand(seed: number): () => number {
  let s = seed >>> 0 || 0x716c1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const TAU = Math.PI * 2;

/** Wick-tip anchor for the engine's live flame, as fractions of w/h. */
export interface MenuGeom {
  flameX: number;
  flameY: number;
  flameH: number;
}

export function paintMenuBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): MenuGeom {
  const C = COLOR_CSS;
  const rand = vigilRand(0x716117);
  const s = Math.min(w, h);
  const ink = shade(C.void, 0.7, 0.9);

  // ── geometry ─────────────────────────────────────────────────────────────
  // The Gate, far center-right; its crown hides behind the vault in wide
  // frames (colossal), its foot always drowns in the fog stops.
  const gx = w * 0.72;
  const gy = h * 0.4;
  const R = Math.min(s * 0.34, w * 0.24, h * 0.4);
  // The candle, lower-left third, standing on the ledge. (Wick anchor is
  // load-bearing — the live flame sits on it. Do not move.)
  const ledgeY = h * 0.865;
  const cx = w * 0.205;
  const cw = Math.min(h * 0.085, w * 0.1); // thick — nearly a pillar
  const ch = h * 0.26;
  const topY = ledgeY - ch; // crater rim height
  const wickLen = h * 0.021;
  const wickTipX = cx + cw * 0.07; // the wick leans toward the Gate
  const wickTipY = topY - wickLen;
  const FLAME_H = 0.07; // suggested live-flame height (fraction of h)
  // Where the live flame's luminous heart will hover — response light aims here.
  const glowX = wickTipX;
  const glowY = wickTipY - h * FLAME_H * 0.45;
  const breakX = w * 0.425; // where the ledge shears off into the gulf

  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  // ── 1. base void gradient — a faint lift mid-frame, crushed low ──────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, C.void);
  base.addColorStop(0.3, mix(C.void, C.surface, 0.38));
  base.addColorStop(0.55, mix(C.void, C.surface2, 0.42));
  base.addColorStop(0.78, mix(C.void, C.surface, 0.26));
  base.addColorStop(1, shade(C.void, 0.72));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. the buried hall — fog stop 0, a back wall barely there ────────────
  ctx.fillStyle = mix(C.void, C.surface, 0.2, 0.8);
  ctx.fillRect(0, 0, w, h * 0.66);
  const horizon = ctx.createLinearGradient(0, h * 0.44, 0, h * 0.68);
  horizon.addColorStop(0, mix(C.void, C.surface2, 0.6, 0));
  horizon.addColorStop(0.55, mix(C.void, C.surface2, 0.6, 0.28));
  horizon.addColorStop(1, mix(C.void, C.surface2, 0.6, 0));
  ctx.fillStyle = horizon;
  ctx.fillRect(0, h * 0.44, w, h * 0.24);
  // the wall the Gate is set in — a soft presence, so the carvings sit on
  // stone rather than on air
  const wallGlow = ctx.createRadialGradient(gx, gy, R * 0.2, gx, gy, R * 1.75);
  wallGlow.addColorStop(0, mix(C.void, C.surface, 0.52, 0.5));
  wallGlow.addColorStop(0.7, mix(C.void, C.surface, 0.45, 0.22));
  wallGlow.addColorStop(1, mix(C.void, C.surface, 0.45, 0));
  ctx.fillStyle = wallGlow;
  ctx.fillRect(gx - R * 1.8, gy - R * 1.8, R * 3.6, R * 3.6);

  // ── 3. THE GREAT GATE — fog stop 2, carved relief, sleeping ──────────────
  // Every ring is a groove: a shadow pass and a lit pass offset vertically,
  // so the stone reads as cut — never a lone stroke over void.
  const relief = (r: number, lw: number, litA: number, darkA: number): void => {
    ctx.strokeStyle = shade(C.void, 0.55, darkA);
    ctx.lineWidth = lw + 1;
    ctx.beginPath();
    ctx.arc(gx, gy + lw * 0.8, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = mix(C.void, C.bone, 0.32, litA);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(gx, gy - lw * 0.8, r, 0, TAU);
    ctx.stroke();
  };
  // carved stone surround
  ctx.strokeStyle = mix(C.void, C.surface2, 0.62, 0.35);
  ctx.lineWidth = R * 0.045;
  ctx.beginPath();
  ctx.arc(gx, gy, R * 1.07, 0, TAU);
  ctx.stroke();
  relief(R * 1.09, 1.2, 0.16, 0.3);
  relief(R * 1.05, 1, 0.12, 0.25);
  // glyph ticks along the upper arc — every fourth keeps a whisper of gilt
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI + 0.5 + (i / 11) * (Math.PI - 1.0) + (rand() - 0.5) * 0.03;
    const r0 = R * 1.115;
    const r1 = r0 + R * 0.026 + rand() * R * 0.01;
    ctx.strokeStyle = i % 4 === 0 ? shade(C.goldInk, 0.85, 0.18) : shade(C.boneDim, 0.85, 0.11);
    ctx.lineWidth = 1;
    line(gx + Math.cos(a) * r0, gy + Math.sin(a) * r0, gx + Math.cos(a) * r1, gy + Math.sin(a) * r1);
  }
  // the disc — fog-lit stone, barely above the dark but unmistakably solid
  const disc = ctx.createRadialGradient(gx - R * 0.3, gy - R * 0.35, R * 0.1, gx, gy, R);
  disc.addColorStop(0, mix(C.void, C.surface2, 1));
  disc.addColorStop(0.5, mix(C.void, C.surface2, 0.68));
  disc.addColorStop(1, mix(C.void, C.surface, 0.42));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(gx, gy, R, 0, TAU);
  ctx.fill();
  // rim rings, carved
  relief(R - 3, 1.5, 0.34, 0.5);
  relief(R * 0.94, 1, 0.2, 0.38);
  relief(R * 0.68, 1, 0.17, 0.32);
  relief(R * 0.4, 1, 0.13, 0.26);
  // ridge spokes and rivets — quiet; the vigil-lights are too far to kiss them
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + (rand() - 0.5) * 0.03;
    ctx.strokeStyle = shade(C.surface2, 0.78, 0.2);
    ctx.lineWidth = 1;
    line(
      gx + Math.cos(a) * R * 0.7,
      gy + Math.sin(a) * R * 0.7,
      gx + Math.cos(a) * R * 0.93,
      gy + Math.sin(a) * R * 0.93,
    );
    const rx = gx + Math.cos(a + 0.13) * R * 0.85;
    const ry = gy + Math.sin(a + 0.13) * R * 0.85;
    const rr = Math.max(1.2, R * 0.012) + rand() * 0.8;
    ctx.fillStyle = shade(C.void, 0.6, 0.5);
    ctx.beginPath();
    ctx.arc(rx + rr * 0.35, ry + rr * 0.5, rr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mix(C.void, C.surface2, 1, 0.55);
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mix(C.void, C.bone, 0.3, 0.3);
    ctx.beginPath();
    ctx.arc(rx - rr * 0.3, ry - rr * 0.35, rr * 0.45, 0, TAU);
    ctx.fill();
  }
  // the central emblem — a gilt memory, carved like the rest
  ctx.strokeStyle = shade(C.void, 0.55, 0.32);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(gx, gy + 1, R * 0.22, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = mix(C.goldInk, C.void, 0.45, 0.26);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(gx, gy - 0.8, R * 0.22, 0, TAU);
  ctx.stroke();
  // the seam, closed and sleeping — a shadow joint mid-disc, then one
  // verdigris breath confined to it (a glow, never a line across the ring)
  const joint = ctx.createLinearGradient(0, gy - R * 0.5, 0, gy + R * 0.3);
  joint.addColorStop(0, shade(C.void, 0.5, 0));
  joint.addColorStop(0.5, shade(C.void, 0.5, 0.45));
  joint.addColorStop(1, shade(C.void, 0.5, 0));
  ctx.strokeStyle = joint;
  ctx.lineWidth = Math.max(1.5, R * 0.01);
  line(gx, gy - R * 0.5, gx, gy + R * 0.3);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(gx, gy - R * 0.08);
  ctx.scale(1, 2.5);
  const breath = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.14);
  breath.addColorStop(0, mix(C.verdigrisDim, C.verdigris, 0.3, 0.09));
  breath.addColorStop(1, mix(C.verdigrisDim, C.verdigris, 0.3, 0));
  ctx.fillStyle = breath;
  ctx.fillRect(-R * 0.15, -R * 0.15, R * 0.3, R * 0.3);
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.05);
  core.addColorStop(0, mix(C.verdigrisDim, C.verdigris, 0.45, 0.12));
  core.addColorStop(1, mix(C.verdigrisDim, C.verdigris, 0.45, 0));
  ctx.fillStyle = core;
  ctx.fillRect(-R * 0.06, -R * 0.06, R * 0.12, R * 0.12);
  ctx.restore();
  // patina weep below the joint
  ctx.strokeStyle = shade(C.verdigrisDim, 0.9, 0.08);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const dx = gx + (rand() - 0.5) * R * 0.08;
    const dy = gy + R * (0.05 + rand() * 0.15);
    line(dx, dy, dx, dy + R * (0.04 + rand() * 0.06));
  }
  // the Gate sinks — base-colored air rises over its lower half, so no carve
  // terminates mid-void
  const sink = ctx.createLinearGradient(0, gy + R * 0.1, 0, gy + R * 0.95);
  sink.addColorStop(0, mix(C.void, C.surface, 0.3, 0));
  sink.addColorStop(1, mix(C.void, C.surface, 0.3, 0.92));
  ctx.fillStyle = sink;
  ctx.fillRect(gx - R * 1.25, gy + R * 0.1, R * 2.5, R * 0.9);
  // the nearest vigil-lights at the Gate's foot lend its low rim one ember kiss
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const kiss = ctx.createRadialGradient(w * 0.77, h * 0.66, 0, w * 0.77, h * 0.66, s * 0.14);
  kiss.addColorStop(0, shade(C.ember, 0.6, 0.07));
  kiss.addColorStop(1, shade(C.ember, 0.6, 0));
  ctx.fillStyle = kiss;
  ctx.fillRect(w * 0.77 - s * 0.15, h * 0.66 - s * 0.15, s * 0.3, s * 0.3);
  ctx.restore();

  // ── 4. fog stops — the Gate's foot and the far distance drown here ───────
  const fog = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.8);
  fog.addColorStop(0, mix(C.void, C.bone, 0.09, 0));
  fog.addColorStop(0.45, mix(C.void, C.bone, 0.09, 0.16));
  fog.addColorStop(1, mix(C.void, C.bone, 0.09, 0));
  ctx.fillStyle = fog;
  ctx.fillRect(0, h * 0.5, w, h * 0.3);

  // ── 5. the gulf — the ground falls away below the fog ────────────────────
  const gulf = ctx.createLinearGradient(0, h * 0.74, 0, h);
  gulf.addColorStop(0, shade(C.void, 0.6, 0));
  gulf.addColorStop(1, shade(C.void, 0.55, 0.8));
  ctx.fillStyle = gulf;
  ctx.fillRect(0, h * 0.74, w, h * 0.26);

  // ── 6. the spur — continuous ground carrying the descent ─────────────────
  // A rocky tongue reaching from the sheared ledge toward the Gate's foot;
  // the switchback steps are carved into its back, and its far end dissolves
  // into the fog (gradient to nothing — no hard termination).
  const spurEdge = (): void => {
    ctx.moveTo(w * 0.418, h * 0.93);
    ctx.quadraticCurveTo(w * 0.46, h * 0.868, w * 0.508, h * 0.818);
    ctx.quadraticCurveTo(w * 0.565, h * 0.777, w * 0.638, h * 0.758);
    ctx.quadraticCurveTo(w * 0.72, h * 0.732, w * 0.8, h * 0.687);
    ctx.quadraticCurveTo(w * 0.845, h * 0.664, w * 0.885, h * 0.66);
  };
  const spurFade = ctx.createLinearGradient(w * 0.43, 0, w * 0.88, 0);
  spurFade.addColorStop(0, mix(C.void, C.surface, 0.48, 0.95));
  spurFade.addColorStop(0.55, mix(C.void, C.surface, 0.42, 0.6));
  spurFade.addColorStop(1, mix(C.void, C.surface, 0.4, 0));
  ctx.fillStyle = spurFade;
  ctx.beginPath();
  ctx.moveTo(w * 0.408, h);
  ctx.lineTo(w * 0.418, h * 0.93);
  spurEdge();
  ctx.lineTo(w * 0.9, h);
  ctx.closePath();
  ctx.fill();
  // its back catches a hair of the vigils' light, dying toward the Gate
  const spurLit = ctx.createLinearGradient(w * 0.43, 0, w * 0.84, 0);
  spurLit.addColorStop(0, mix(C.void, C.boneDim, 0.5, 0.16));
  spurLit.addColorStop(1, mix(C.void, C.boneDim, 0.5, 0));
  ctx.strokeStyle = spurLit;
  ctx.lineWidth = 1;
  ctx.beginPath();
  spurEdge();
  ctx.stroke();
  // a fallen slab at the stair's foot, half-buried in the gulf
  ctx.fillStyle = mix(C.void, C.surface, 0.4, 0.9);
  ctx.beginPath();
  ctx.moveTo(w * 0.452, h * 0.952);
  ctx.lineTo(w * 0.505, h * 0.938);
  ctx.lineTo(w * 0.512, h * 0.956);
  ctx.lineTo(w * 0.458, h * 0.97);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.45, 0.12);
  ctx.lineWidth = 1;
  line(w * 0.452, h * 0.952, w * 0.505, h * 0.938);

  // ── 7. the descent — switchback flights carved into the spur ─────────────
  // Descending away from the viewer: each flight sits higher in frame,
  // smaller and fainter. A veil of air separates the far runs from the near.
  // Everything stays below y 0.75 or right of x 0.62 — the menu column.
  const drawFlight = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    n: number,
    presence: number,
  ): void => {
    const dx = (x1 - x0) / n;
    const dy = (y1 - y0) / n;
    const th = Math.max(3, s * 0.012) * (0.5 + presence * 0.5);
    ctx.globalAlpha = presence;
    const tread = (): void => {
      ctx.moveTo(x0, y0);
      for (let i = 1; i <= n; i++) {
        ctx.lineTo(x0 + dx * i, y0 + dy * (i - 1));
        ctx.lineTo(x0 + dx * i, y0 + dy * i);
      }
    };
    ctx.fillStyle = shade(C.void, 0.82, 0.95);
    ctx.beginPath();
    tread();
    ctx.lineTo(x1, y1 + th);
    ctx.lineTo(x0, y0 + th);
    ctx.closePath();
    ctx.fill();
    // nosings catch what little light the vigils shed
    ctx.strokeStyle = mix(C.void, C.bone, 0.4, 0.38);
    ctx.lineWidth = Math.max(0.8, s * 0.0016);
    ctx.beginPath();
    tread();
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  type Flight = readonly [number, number, number, number, number, number];
  const flights: readonly Flight[] = [
    // [x0, y0, x1, y1, treads, presence] — near to far
    [0.435, 0.925, 0.56, 0.845, 8, 1],
    [0.61, 0.84, 0.518, 0.796, 6, 0.75],
    [0.5, 0.794, 0.638, 0.75, 6, 0.55],
    [0.654, 0.746, 0.708, 0.71, 5, 0.34],
    [0.714, 0.706, 0.752, 0.68, 4, 0.18],
  ];
  type Landing = readonly [number, number, number, number];
  const landings: readonly Landing[] = [
    [0.56, 0.845, 0.05, 0.85],
    [0.478, 0.796, 0.04, 0.62],
    [0.638, 0.75, 0.034, 0.42],
  ];
  type Vigil = readonly [number, number, number];
  const vigils: readonly Vigil[] = [
    // [x, y, presence] — standing on the spur's treads and landings
    [0.478, 0.898, 1],
    [0.585, 0.842, 0.8],
    [0.492, 0.792, 0.6],
    [0.6, 0.76, 0.48],
    [0.655, 0.742, 0.4],
    [0.695, 0.716, 0.3],
    [0.73, 0.698, 0.22],
    [0.758, 0.678, 0.14],
    [0.8, 0.655, 0.09],
  ];
  const paintLanding = (lx: number, ly: number, lw2: number, p: number): void => {
    const th = Math.max(2.5, s * 0.01) * (0.5 + p * 0.5);
    ctx.globalAlpha = p;
    ctx.fillStyle = shade(C.void, 0.82, 0.95);
    ctx.fillRect(w * lx, h * ly, w * lw2, th);
    ctx.strokeStyle = mix(C.void, C.bone, 0.4, 0.34);
    ctx.lineWidth = Math.max(0.8, s * 0.0016);
    line(w * lx, h * ly, w * (lx + lw2), h * ly);
    ctx.globalAlpha = 1;
  };
  const paintVigil = (vx: number, vy: number, p: number): void => {
    const x = w * vx + (rand() - 0.5) * s * 0.008;
    const y = h * vy + (rand() - 0.5) * s * 0.004;
    const stubH = p > 0.45 ? Math.max(2, s * 0.007 * p) : 0;
    const dotY = y - stubH;
    const hr = s * (0.012 + 0.038 * p);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(x, dotY, 0, x, dotY, hr);
    halo.addColorStop(0, shade(C.flame, 1, 0.1 + 0.24 * p));
    halo.addColorStop(1, shade(C.flame, 1, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - hr, dotY - hr, hr * 2, hr * 2);
    ctx.restore();
    if (stubH > 0) {
      // near enough to read as a candle: a pale stub under the light
      const sw = Math.max(1.2, s * 0.0042 * p);
      ctx.fillStyle = mix(C.bone, C.void, 0.55, 0.9);
      ctx.fillRect(x - sw / 2, y - stubH, sw, stubH);
    }
    ctx.fillStyle = mix(C.flame, C.flameHi, 0.3 + p * 0.55, 0.45 + p * 0.55);
    ctx.beginPath();
    ctx.arc(x, dotY - 0.5, Math.max(0.7, s * (0.0016 + 0.0022 * p)), 0, TAU);
    ctx.fill();
  };
  const NEAR = 0.5;
  // far pass first…
  for (const [fx0, fy0, fx1, fy1, n, p] of flights) {
    if (p < NEAR) drawFlight(w * fx0, h * fy0, w * fx1, h * fy1, n, p);
  }
  for (const [lx, ly, lw2, p] of landings) if (p < NEAR) paintLanding(lx, ly, lw2, p);
  for (const [vx, vy, p] of vigils) if (p < NEAR) paintVigil(vx, vy, p);
  // …then a breath of air between mid-ground and Gate…
  const veil = ctx.createLinearGradient(0, h * 0.54, 0, h * 0.74);
  veil.addColorStop(0, mix(C.void, C.bone, 0.08, 0));
  veil.addColorStop(0.5, mix(C.void, C.bone, 0.08, 0.1));
  veil.addColorStop(1, mix(C.void, C.bone, 0.08, 0));
  ctx.fillStyle = veil;
  ctx.fillRect(0, h * 0.54, w, h * 0.2);
  // …then the near runs, in front of the veil
  for (const [fx0, fy0, fx1, fy1, n, p] of flights) {
    if (p >= NEAR) drawFlight(w * fx0, h * fy0, w * fx1, h * fy1, n, p);
  }
  for (const [lx, ly, lw2, p] of landings) if (p >= NEAR) paintLanding(lx, ly, lw2, p);
  for (const [vx, vy, p] of vigils) if (p >= NEAR) paintVigil(vx, vy, p);

  // ── 8. the vault — ribbed stone closing the top, in two fog stops ────────
  // Both masses span the full frame width and melt upward into the dark:
  // no edge terminates mid-air.
  const farEdge = (): void => {
    ctx.moveTo(0, h * 0.115);
    ctx.quadraticCurveTo(w * 0.3, h * 0.03, w * 0.55, h * 0.075);
    ctx.quadraticCurveTo(w * 0.78, h * 0.11, w, h * 0.045);
  };
  ctx.fillStyle = mix(C.void, C.surface, 0.55);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  farEdge();
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.45, 0.12);
  ctx.lineWidth = 1;
  ctx.beginPath();
  farEdge();
  ctx.stroke();
  // high haze — air between the vault stops
  const highHaze = ctx.createLinearGradient(0, h * 0.05, 0, h * 0.2);
  highHaze.addColorStop(0, mix(C.void, C.bone, 0.07, 0));
  highHaze.addColorStop(0.5, mix(C.void, C.bone, 0.07, 0.09));
  highHaze.addColorStop(1, mix(C.void, C.bone, 0.07, 0));
  ctx.fillStyle = highHaze;
  ctx.fillRect(0, h * 0.05, w, h * 0.15);
  // near vault — two bays springing from a lost pier, exiting both sides
  const nearEdge = (dy: number): void => {
    ctx.moveTo(0, h * (0.24 + dy));
    ctx.quadraticCurveTo(w * 0.13, h * (0.083 + dy), w * 0.3, h * (0.078 + dy));
    ctx.quadraticCurveTo(w * 0.47, h * (0.075 + dy), w * 0.58, h * (0.16 + dy));
    ctx.quadraticCurveTo(w * 0.8, h * (0.028 + dy), w, h * (0.062 + dy));
  };
  const vaultMass = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    nearEdge(0);
    ctx.lineTo(w, 0);
    ctx.closePath();
  };
  vaultMass();
  ctx.fillStyle = shade(C.void, 0.55);
  ctx.fill();
  // interior of the shell, clipped to the mass: a soft band of reflected
  // light along the arc, then rib courses fading upward
  ctx.save();
  vaultMass();
  ctx.clip();
  ctx.strokeStyle = mix(C.void, C.surface2, 0.85, 0.16);
  ctx.lineWidth = Math.max(8, s * 0.026);
  ctx.beginPath();
  nearEdge(0);
  ctx.stroke();
  for (const [off, a] of [
    [-0.032, 0.3],
    [-0.066, 0.19],
    [-0.102, 0.1],
  ] as const) {
    ctx.strokeStyle = mix(C.void, C.surface2, 1, a);
    ctx.lineWidth = Math.max(1, s * 0.0024);
    ctx.beginPath();
    nearEdge(off);
    ctx.stroke();
  }
  // coffer ticks between the courses
  ctx.strokeStyle = mix(C.void, C.surface2, 0.95, 0.18);
  ctx.lineWidth = 1;
  for (const t of [0.07, 0.17, 0.27, 0.4, 0.52, 0.68, 0.8, 0.92] as const) {
    const tx = w * t + (rand() - 0.5) * w * 0.012;
    // approximate edge height at tx, then tick upward between courses
    const ty =
      t < 0.3
        ? h * (0.24 - t * 0.55)
        : t < 0.58
          ? h * (0.078 + (t - 0.3) * 0.29)
          : h * (0.16 - (t - 0.58) * 0.23);
    line(tx, ty - h * 0.01, tx + (rand() - 0.5) * s * 0.008, ty - h * 0.052);
  }
  ctx.restore();
  // edge-light from below — strongest above the candle's glow
  const vaultLit = ctx.createLinearGradient(0, 0, w, 0);
  vaultLit.addColorStop(0, mix(C.void, C.boneDim, 0.5, 0.1));
  vaultLit.addColorStop(0.2, mix(C.void, C.boneDim, 0.55, 0.24));
  vaultLit.addColorStop(0.5, mix(C.void, C.boneDim, 0.5, 0.09));
  vaultLit.addColorStop(1, mix(C.void, C.boneDim, 0.5, 0.14));
  ctx.strokeStyle = vaultLit;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  nearEdge(0);
  ctx.stroke();
  // the pier rib drops from the springing and dissolves — nothing hard
  const pier = ctx.createLinearGradient(0, h * 0.155, 0, h * 0.245);
  pier.addColorStop(0, shade(C.void, 0.5, 0.95));
  pier.addColorStop(1, shade(C.void, 0.5, 0));
  ctx.strokeStyle = pier;
  ctx.lineWidth = Math.max(3, s * 0.008);
  line(w * 0.58, h * 0.152, w * 0.577, h * 0.24);
  const pierLit = ctx.createLinearGradient(0, h * 0.155, 0, h * 0.22);
  pierLit.addColorStop(0, mix(C.void, C.boneDim, 0.45, 0.2));
  pierLit.addColorStop(1, mix(C.void, C.boneDim, 0.45, 0));
  ctx.strokeStyle = pierLit;
  ctx.lineWidth = 1;
  line(w * 0.578 + Math.max(1.5, s * 0.004), h * 0.158, w * 0.5755 + Math.max(1.5, s * 0.004), h * 0.218);
  // both vault stops melt upward into the crown darkness
  const melt = ctx.createLinearGradient(0, 0, 0, h * 0.12);
  melt.addColorStop(0, shade(C.void, 0.8, 0.6));
  melt.addColorStop(1, shade(C.void, 0.8, 0));
  ctx.fillStyle = melt;
  ctx.fillRect(0, 0, w, h * 0.12);

  // ── 9. the ledge — worn stone, sheared off in broken strata ──────────────
  const crest: Array<{ x: number; y: number }> = [];
  const LSTEPS = 14;
  for (let i = 0; i <= LSTEPS; i++) {
    crest.push({ x: (i / LSTEPS) * breakX, y: ledgeY + (rand() - 0.5) * s * 0.005 });
  }
  // strata profile: three beds, each recessed under the one above, the last
  // running off the bottom of frame
  const bedA = ledgeY + h * 0.024;
  const bedB = ledgeY + h * 0.056;
  const bedC = ledgeY + h * 0.092;
  const ledgePath = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, crest[0]?.y ?? ledgeY);
    for (const p of crest) ctx.lineTo(p.x, p.y);
    ctx.lineTo(breakX + w * 0.007, bedA); // bed A face, lipping out
    ctx.lineTo(breakX - w * 0.011, bedA + h * 0.003); // recess
    ctx.lineTo(breakX - w * 0.005, bedB); // bed B face
    ctx.lineTo(breakX - w * 0.024, bedB + h * 0.003); // recess
    ctx.lineTo(breakX - w * 0.017, bedC); // bed C face
    ctx.lineTo(breakX - w * 0.03, h); // exits the frame bottom
    ctx.lineTo(0, h);
    ctx.closePath();
  };
  const ledgeG = ctx.createLinearGradient(0, ledgeY, 0, h);
  ledgeG.addColorStop(0, mix(C.void, C.surface2, 0.85));
  ledgeG.addColorStop(0.4, mix(C.void, C.surface, 0.5));
  ledgeG.addColorStop(1, shade(C.void, 0.78));
  ledgePath();
  ctx.fillStyle = ledgeG;
  ctx.fill();
  // the shear reads as strata: value steps down the broken face
  ctx.save();
  ledgePath();
  ctx.clip();
  const strata: ReadonlyArray<readonly [number, number, string, number]> = [
    // [yTop, yBot, fill, edge-light alpha]
    [ledgeY, bedA, mix(C.void, C.surface2, 0.72, 0.85), 0],
    [bedA, bedB, mix(C.void, C.surface2, 0.5, 0.85), 0.18],
    [bedB, bedC, mix(C.void, C.surface, 0.34, 0.85), 0.1],
  ];
  for (const [y0, y1, fill, litA] of strata) {
    ctx.fillStyle = fill;
    ctx.fillRect(breakX - w * 0.075, y0, w * 0.085, y1 - y0);
    if (litA > 0) {
      // each bed's top edge catches the gulf light, dying leftward
      const bedLit = ctx.createLinearGradient(breakX - w * 0.075, 0, breakX + w * 0.008, 0);
      bedLit.addColorStop(0, mix(C.void, C.boneDim, 0.5, 0));
      bedLit.addColorStop(1, mix(C.void, C.boneDim, 0.5, litA));
      ctx.strokeStyle = bedLit;
      ctx.lineWidth = 1;
      line(breakX - w * 0.075, y0 + 0.5, breakX + w * 0.008, y0 + 0.5);
    }
  }
  // shadow tucked under each overhang
  ctx.strokeStyle = shade(C.void, 0.5, 0.5);
  ctx.lineWidth = Math.max(1, s * 0.0022);
  line(breakX - w * 0.011, bedA + h * 0.004, breakX + w * 0.006, bedA + h * 0.001);
  line(breakX - w * 0.024, bedB + h * 0.004, breakX - w * 0.006, bedB + h * 0.001);
  ctx.restore();
  // crest edge: cool line full length, then a warm overlay near the candle
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.5, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, crest[0]?.y ?? ledgeY);
  for (const p of crest) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.strokeStyle = mix(C.flame, C.bone, 0.5, 0.28);
  line(cx - cw * 1.4, ledgeY, cx + cw * 1.7, ledgeY);
  // face joints and one crack reaching in from the shear
  ctx.strokeStyle = shade(C.surface2, 1.15, 0.14);
  const courseY = ledgeY + h * 0.05;
  line(0, courseY, breakX * 0.88, courseY + (rand() - 0.5) * s * 0.008);
  for (let i = 0; i < 5; i++) {
    const jx = rand() * breakX * 0.82;
    line(jx, rand() < 0.5 ? ledgeY + 2 : courseY, jx, rand() < 0.5 ? courseY : h * 0.97);
  }
  ctx.strokeStyle = shade(C.void, 0.6, 0.45);
  ctx.beginPath();
  ctx.moveTo(breakX - w * 0.008, bedA);
  ctx.lineTo(breakX - w * 0.05, bedA + h * 0.02 + rand() * s * 0.01);
  ctx.lineTo(breakX - w * 0.068, bedB + h * 0.02);
  ctx.stroke();

  // ── 10. THE CANDLE — thick, ancient, drip-skirted, waiting ───────────────
  // contact shadow, then the melted apron it stands in
  ctx.save();
  ctx.translate(cx, ledgeY + ch * 0.012);
  ctx.scale(1, 0.24);
  const contact = ctx.createRadialGradient(0, 0, 0, 0, 0, cw * 1.05);
  contact.addColorStop(0, shade(C.void, 0.55, 0.55));
  contact.addColorStop(1, shade(C.void, 0.55, 0));
  ctx.fillStyle = contact;
  ctx.fillRect(-cw * 1.1, -cw * 1.1, cw * 2.2, cw * 2.2);
  ctx.restore();
  ctx.fillStyle = mix(C.bone, C.boneDim, 0.5);
  ctx.beginPath();
  ctx.ellipse(cx + cw * 0.06, ledgeY + ch * 0.008, cw * 0.85, ch * 0.028, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.7, 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();
  // the body — melted foot, eroded crater rim sagging toward the gutter side
  const cwHalf = cw / 2;
  const spread = cw * 0.09;
  const body = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - cwHalf - spread, ledgeY);
    ctx.bezierCurveTo(
      cx - cwHalf - spread * 0.4,
      ledgeY - ch * 0.3,
      cx - cwHalf + cw * 0.02,
      ledgeY - ch * 0.62,
      cx - cw * 0.43,
      topY + ch * 0.005,
    );
    ctx.quadraticCurveTo(cx - cw * 0.1, topY - ch * 0.012, cx + cw * 0.08, topY + ch * 0.018);
    ctx.quadraticCurveTo(cx + cw * 0.28, topY + ch * 0.035, cx + cw * 0.41, topY + ch * 0.03);
    ctx.bezierCurveTo(
      cx + cwHalf + cw * 0.01,
      ledgeY - ch * 0.6,
      cx + cwHalf + spread * 0.5,
      ledgeY - ch * 0.26,
      cx + cwHalf + spread,
      ledgeY,
    );
    ctx.closePath();
  };
  const bodyG = ctx.createLinearGradient(0, topY, 0, ledgeY);
  bodyG.addColorStop(0, mix(C.parchmentAged, C.flame, 0.22)); // response warmth
  bodyG.addColorStop(0.25, mix(C.parchmentAged, C.bone, 0.35));
  bodyG.addColorStop(0.7, mix(C.bone, C.boneDim, 0.55));
  bodyG.addColorStop(1, mix(C.boneDim, C.void, 0.42));
  body();
  ctx.fillStyle = bodyG;
  ctx.fill();
  // side shade clipped to the wax — round the pillar off
  ctx.save();
  body();
  ctx.clip();
  const sideG = ctx.createLinearGradient(cx - cwHalf, 0, cx + cwHalf, 0);
  sideG.addColorStop(0, shade(C.void, 0.8, 0.3));
  sideG.addColorStop(0.35, shade(C.void, 0.8, 0));
  sideG.addColorStop(0.8, shade(C.void, 0.8, 0));
  sideG.addColorStop(1, shade(C.void, 0.8, 0.16));
  ctx.fillStyle = sideG;
  ctx.fillRect(cx - cw, topY - ch * 0.05, cw * 2, ch * 1.1);
  // tally scratches in the wax — someone counted nights here
  ctx.strokeStyle = shade(C.boneDim, 0.85, 0.35);
  ctx.lineWidth = 1;
  const tallyY = ledgeY - ch * 0.4;
  for (let i = 0; i < 6; i++) {
    const tx = cx - cw * 0.26 + i * cw * 0.09 + (rand() - 0.5) * cw * 0.02;
    line(tx, tallyY + (rand() - 0.5) * ch * 0.01, tx - cw * 0.02, tallyY + ch * 0.045);
  }
  ctx.restore();
  body();
  ctx.strokeStyle = ink; // the woodcut cut-line
  ctx.lineWidth = Math.max(1.5, s * 0.0035);
  ctx.stroke();
  // the crater — a melted well around the wick root
  ctx.fillStyle = mix(C.parchmentAged, C.ink, 0.42);
  ctx.beginPath();
  ctx.ellipse(cx + cw * 0.02, topY + ch * 0.028, cw * 0.27, ch * 0.016, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mix(C.ink, C.void, 0.3, 0.8);
  ctx.beginPath();
  ctx.ellipse(cx + cw * 0.02, topY + ch * 0.03, cw * 0.15, ch * 0.009, 0, 0, TAU);
  ctx.fill();
  // the drip skirt — fresh runs at the rim, old ribbons down the flanks
  const drip = (x: number, yTop: number, len: number, wr: number, top: string, bot: string): void => {
    const g = ctx.createLinearGradient(0, yTop, 0, yTop + len);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - wr, yTop);
    ctx.bezierCurveTo(
      x - wr * 1.06,
      yTop + len * 0.42,
      x - wr * 0.86,
      yTop + len - wr * 1.5,
      x - wr * 0.72,
      yTop + len - wr,
    );
    ctx.arc(x, yTop + len - wr, wr * 0.72, Math.PI, 0, true);
    ctx.bezierCurveTo(x + wr * 0.9, yTop + len - wr * 1.6, x + wr * 1.06, yTop + len * 0.4, x + wr, yTop);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 0.7, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  const freshTop = mix(C.parchment, C.flame, 0.14);
  const freshBot = mix(C.parchmentAged, C.boneDim, 0.4);
  const oldTop = mix(C.parchmentAged, C.bone, 0.4);
  const oldBot = mix(C.boneDim, C.void, 0.3);
  // old long ribbons first (behind the fresh skirt); the great run reaches the apron
  drip(cx - cw * 0.44, topY + ch * 0.05, ch * 0.52, cw * 0.05, oldTop, oldBot);
  drip(cx + cw * 0.44, topY + ch * 0.04, ch * 0.9, cw * 0.06, oldTop, oldBot);
  drip(cx + cw * 0.1, topY + ch * 0.06, ch * 0.44, cw * 0.045, oldTop, oldBot);
  const skirt: ReadonlyArray<readonly [number, number, number]> = [
    // [x offset (cw), length (ch), halfWidth (cw)]
    [-0.36, 0.13, 0.055],
    [-0.18, 0.2, 0.07],
    [0.02, 0.1, 0.05],
    [0.2, 0.28, 0.075],
    [0.38, 0.16, 0.06],
  ];
  for (const [ox, ol, owr] of skirt) {
    drip(cx + cw * ox, topY + ch * (0.02 + rand() * 0.02), ch * ol, cw * owr, freshTop, freshBot);
  }
  // the bare charred wick — the whole scene waits on it
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = mix(C.ink, C.void, 0.45);
  ctx.lineWidth = Math.max(2, h * 0.0045);
  ctx.beginPath();
  ctx.moveTo(cx + cw * 0.01, topY + ch * 0.022);
  ctx.quadraticCurveTo(cx + cw * 0.02, topY - wickLen * 0.55, wickTipX, wickTipY);
  ctx.stroke();
  // char crumb at the tip; one unburnt hair low on the shaft
  ctx.fillStyle = shade(C.void, 0.9);
  ctx.beginPath();
  ctx.arc(wickTipX, wickTipY + 0.5, Math.max(1.4, h * 0.003), 0, TAU);
  ctx.fill();
  ctx.strokeStyle = shade(C.inkSoft, 1.15, 0.6);
  ctx.lineWidth = 1;
  line(cx + cw * 0.012, topY + ch * 0.018, cx + cw * 0.02, topY - wickLen * 0.3);
  ctx.restore();

  // ── 11. response light — painted as if the live flame already burns ──────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // ambient bloom around where the flame's heart will hover
  const ambient = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, h * 0.27);
  ambient.addColorStop(0, shade(C.flame, 0.6, 0.16));
  ambient.addColorStop(0.4, shade(C.ember, 0.55, 0.06));
  ambient.addColorStop(1, shade(C.ember, 0.55, 0));
  ctx.fillStyle = ambient;
  ctx.fillRect(glowX - h * 0.28, glowY - h * 0.28, h * 0.56, h * 0.56);
  // a hotter crown on the crater rim and fresh skirt
  const crown = ctx.createRadialGradient(wickTipX, topY + ch * 0.02, 0, wickTipX, topY + ch * 0.02, cw * 1.2);
  crown.addColorStop(0, shade(C.flameHi, 0.7, 0.2));
  crown.addColorStop(1, shade(C.flameHi, 0.7, 0));
  ctx.fillStyle = crown;
  ctx.fillRect(wickTipX - cw * 1.3, topY - cw * 1.3, cw * 2.6, cw * 2.6);
  // the warm pool on the ledge stone
  ctx.translate(cx + cw * 0.15, ledgeY + ch * 0.02);
  ctx.scale(1, 0.3);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, ch * 0.85);
  pool.addColorStop(0, shade(C.flame, 0.55, 0.13));
  pool.addColorStop(1, shade(C.flame, 0.55, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-ch * 0.9, -ch * 0.9, ch * 1.8, ch * 1.8);
  ctx.restore();
  // dust motes drifting in the candle's light — few, deliberate, amber-bound
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.12 + rand() * 0.6);
    const d = h * (0.05 + rand() * 0.16);
    const mxp = glowX + Math.cos(a) * d * 1.2;
    const myp = glowY + Math.sin(a) * d;
    const fade = 1 - d / (h * 0.24);
    ctx.fillStyle = mix(C.flame, C.bone, 0.45, 0.05 + 0.11 * fade * rand());
    ctx.beginPath();
    ctx.arc(mxp, myp, Math.max(0.6, s * 0.0012 + rand() * s * 0.0011), 0, TAU);
    ctx.fill();
  }

  // ── 12. settle the frame — calm the menu column, crush top and bottom ────
  ctx.save();
  ctx.translate(w * 0.45, h * 0.53);
  ctx.scale(1.6, 1);
  const settleMenu = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.3);
  settleMenu.addColorStop(0, shade(C.void, 0.5, 0.25));
  settleMenu.addColorStop(1, shade(C.void, 0.5, 0));
  ctx.fillStyle = settleMenu;
  ctx.fillRect(-s * 0.32, -s * 0.32, s * 0.64, s * 0.64);
  ctx.restore();
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.14);
  crush.addColorStop(0, shade(C.void, 0.65, 0.7));
  crush.addColorStop(1, shade(C.void, 0.65, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.14);
  const settle = ctx.createLinearGradient(0, h * 0.84, 0, h);
  settle.addColorStop(0, shade(C.void, 0.6, 0));
  settle.addColorStop(1, shade(C.void, 0.6, 0.55));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.84, w, h * 0.16);
  const vr = s * 0.52;
  for (const [vx, vy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    const v = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    v.addColorStop(0, shade(C.void, 0.5, 0.35));
    v.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  // ── 13. the folio closes on two sides — gold-ink rules and corner blooms ─
  // (guildhall iconography; the scene bleeds off the open top-left)
  ctx.strokeStyle = mix(C.void, C.goldInk, 0.55, 0.5);
  ctx.lineWidth = 1;
  line(w - 10.5, 10.5, w - 10.5, h - 10.5);
  line(10.5, h - 10.5, w - 10.5, h - 10.5);
  ctx.strokeStyle = mix(C.void, C.goldInk, 0.55, 0.3);
  line(w - 16.5, 16.5, w - 16.5, h - 16.5);
  line(16.5, h - 16.5, w - 16.5, h - 16.5);
  const bloom = (bx: number, by: number): void => {
    ctx.fillStyle = shade(C.void, 0.5);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-13, -13, 26, 26);
    ctx.fillStyle = mix(C.goldInk, C.void, 0, 0.55);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
    ctx.strokeStyle = mix(C.goldInk, C.bone, 0.3, 0.4);
    ctx.lineWidth = 1.5;
    const sx = bx < w / 2 ? 1 : -1;
    const sy = by < h / 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(bx + sx * 14, by);
    ctx.quadraticCurveTo(bx + sx * 30, by - sy * 4, bx + sx * 42, by + sy * 4);
    ctx.moveTo(bx, by + sy * 14);
    ctx.quadraticCurveTo(bx - sx * 4, by + sy * 30, bx + sx * 4, by + sy * 42);
    ctx.stroke();
  };
  bloom(w - 16, 16);
  bloom(w - 16, h - 16);
  bloom(16, h - 16);
  // folio diamonds at the rule midpoints
  ctx.fillStyle = mix(C.goldInk, C.void, 0, 0.35);
  for (const [dx, dy] of [
    [w - 16, h / 2],
    [w / 2, h - 16],
  ] as const) {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }

  return { flameX: wickTipX / w, flameY: wickTipY / h, flameH: FLAME_H };
}
