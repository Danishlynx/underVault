/**
 * Main-menu backdrop — "The Vigil."
 *
 * The most-seen image in the game: one breathing scene, the moment before a
 * match is struck. A great tallow pillar-candle — ancient, drip-skirted,
 * UNLIT, bare charred wick — keeps watch on a worn stone ledge in the
 * lower-left third. Beyond it the frame falls away into a colossal buried
 * dark: a rocky spur carries switchback steps and a sparse constellation of
 * other delvers' vigil-lights fading with distance, and far center-right the
 * Great Gate looms half-swallowed by fog — a fog-lit stone disc with carved
 * rim rings, ridge spokes, rivets, a raised central boss with a gilt emblem,
 * and one thin verdigris seam of light at its sleeping center joint. The
 * gate's crown dissolves upward into pure darkness before the top band —
 * the ceiling is too far up to see (D83: the void stays pure); gold-ink
 * folio corners close the right and bottom.
 *
 * Painted in the guildhall idiom: flat woodcut masses, fog-stop depth, token
 * colors via shade()/mix() only, a private seeded LCG for jitter. A shade
 * more luminous than gameplay — this is a poster, not fog-of-war — but the
 * two-hue law holds: amber only around candle-points, verdigris only at the
 * Gate seam, everything else cool void and surface stone. Every mass edge
 * either exits the frame or dissolves into atmosphere — nothing terminates
 * mid-air. Depth ordering by line weight: the near stair nosings are the
 * crispest lines in the frame; the Gate's carvings stay softer and dimmer.
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
  // The Gate, far center-right; its crown dissolves into the vault dark
  // (colossal), its foot always drowns in the fog stops.
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

  // ── 3. THE GREAT GATE — fog stop 2, a stone mass, carved, sleeping ───────
  // The door reads by VALUE first (fog-lit disc against a shadowed socket),
  // lines second. Every ring is a groove: a shadow pass and a lit pass offset
  // vertically, so the stone reads as cut — never a lone stroke over void.
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
  // the socket — a breath of shadow between door-stone and wall, so the
  // disc detaches from the dark instead of dissolving into it
  const socket = ctx.createRadialGradient(gx, gy, R * 1.01, gx, gy, R * 1.45);
  socket.addColorStop(0, shade(C.void, 0.55, 0.42));
  socket.addColorStop(0.4, shade(C.void, 0.55, 0.2));
  socket.addColorStop(1, shade(C.void, 0.55, 0));
  ctx.fillStyle = socket;
  ctx.fillRect(gx - R * 1.5, gy - R * 1.5, R * 3, R * 3);
  // carved stone surround
  ctx.strokeStyle = mix(C.void, C.surface2, 0.72, 0.4);
  ctx.lineWidth = R * 0.045;
  ctx.beginPath();
  ctx.arc(gx, gy, R * 1.07, 0, TAU);
  ctx.stroke();
  relief(R * 1.09, 1.2, 0.14, 0.3);
  relief(R * 1.05, 1, 0.11, 0.25);
  // glyph ticks along the upper arc — every fourth keeps a whisper of gilt
  // (the crown fade in §8 dissolves the apex ones before the top band)
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI + 0.5 + (i / 11) * (Math.PI - 1.0) + (rand() - 0.5) * 0.03;
    const r0 = R * 1.115;
    const r1 = r0 + R * 0.026 + rand() * R * 0.01;
    ctx.strokeStyle = i % 4 === 0 ? shade(C.goldInk, 0.85, 0.14) : mix(C.void, C.boneDim, 0.5, 0.1);
    ctx.lineWidth = 1;
    line(gx + Math.cos(a) * r0, gy + Math.sin(a) * r0, gx + Math.cos(a) * r1, gy + Math.sin(a) * r1);
  }
  // the disc — fog-lit stone. The light rises from the fog at its foot, so
  // the mass is brightest low and dissolves upward into the crown dark:
  // unmistakably solid, unmistakably colossal.
  const disc = ctx.createRadialGradient(gx - R * 0.05, gy + R * 0.45, R * 0.08, gx, gy + R * 0.1, R * 1.5);
  disc.addColorStop(0, mix(C.surface2, C.boneDim, 0.38));
  disc.addColorStop(0.35, shade(C.surface2, 1.5));
  disc.addColorStop(0.7, mix(C.void, C.surface2, 0.7));
  disc.addColorStop(1, mix(C.void, C.surface, 0.4));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(gx, gy, R, 0, TAU);
  ctx.fill();
  // recess shadow just inside the rim — the door sits back in its socket
  ctx.strokeStyle = shade(C.void, 0.5, 0.5);
  ctx.lineWidth = Math.max(2, R * 0.018);
  ctx.beginPath();
  ctx.arc(gx, gy, R - 1, 0, TAU);
  ctx.stroke();
  // the left rim resolves against the hall — a faint fog-lit edge closes
  // the circle (its ends drown in crown dark above and fog below)
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.6, 0.24);
  ctx.lineWidth = Math.max(1.2, R * 0.008);
  ctx.beginPath();
  ctx.arc(gx, gy, R + 1, Math.PI * 0.58, Math.PI * 1.38);
  ctx.stroke();
  // rim rings, carved — kept softer than the stair nosings (depth law)
  relief(R - 4, 1.5, 0.34, 0.55);
  relief(R * 0.94, 1, 0.2, 0.45);
  relief(R * 0.68, 1, 0.17, 0.4);
  relief(R * 0.4, 1, 0.14, 0.32);
  // ridge spokes and rivets — quiet; the vigil-lights are too far to kiss them
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + (rand() - 0.5) * 0.03;
    ctx.strokeStyle = shade(C.surface2, 0.78, 0.18);
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
  // the seam — the center joint of the two leaves, closed and sleeping.
  // A shadow groove, and inside it one THIN verdigris line of light with a
  // narrow tall glow: light leaking through the crack, nothing more.
  const seamTop = gy - R * 0.62;
  const seamBot = gy + R * 0.5;
  const joint = ctx.createLinearGradient(0, seamTop, 0, seamBot);
  joint.addColorStop(0, shade(C.void, 0.5, 0));
  joint.addColorStop(0.5, shade(C.void, 0.5, 0.55));
  joint.addColorStop(1, shade(C.void, 0.5, 0));
  ctx.strokeStyle = joint;
  ctx.lineWidth = Math.max(2, R * 0.014);
  line(gx, seamTop, gx, seamBot);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(gx, gy - R * 0.06);
  ctx.scale(1, 8);
  const leakGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.06);
  leakGlow.addColorStop(0, mix(C.verdigrisDim, C.verdigris, 0.4, 0.22));
  leakGlow.addColorStop(1, mix(C.verdigrisDim, C.verdigris, 0.4, 0));
  ctx.fillStyle = leakGlow;
  ctx.fillRect(-R * 0.07, -R * 0.07, R * 0.14, R * 0.14);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const leak = ctx.createLinearGradient(0, seamTop, 0, seamBot);
  leak.addColorStop(0, mix(C.verdigris, C.verdigrisDim, 0.2, 0));
  leak.addColorStop(0.45, mix(C.verdigris, C.verdigrisDim, 0.2, 0.85));
  leak.addColorStop(1, mix(C.verdigris, C.verdigrisDim, 0.2, 0));
  ctx.strokeStyle = leak;
  ctx.lineWidth = Math.max(1.5, R * 0.0065);
  line(gx, seamTop, gx, seamBot);
  ctx.restore();
  // the central boss — a raised hub bridging the leaves, gilt-emblemed.
  // EVERY hub element shares the exact center (gx, gy): a mason centers his
  // hub, and a zoomed eye checks. Relief comes from paired RADII — never
  // from offset centers.
  const bossHalo = ctx.createRadialGradient(gx, gy, R * 0.125, gx, gy, R * 0.21);
  bossHalo.addColorStop(0, shade(C.void, 0.55, 0.5));
  bossHalo.addColorStop(1, shade(C.void, 0.55, 0));
  ctx.fillStyle = bossHalo;
  ctx.beginPath();
  ctx.arc(gx, gy, R * 0.21, 0, TAU);
  ctx.fill();
  const boss = ctx.createRadialGradient(gx, gy, R * 0.01, gx, gy, R * 0.165);
  boss.addColorStop(0, mix(C.surface2, C.boneDim, 0.45));
  boss.addColorStop(0.65, shade(C.surface2, 1.5));
  boss.addColorStop(1, mix(C.void, C.surface2, 0.75));
  ctx.fillStyle = boss;
  ctx.beginPath();
  ctx.arc(gx, gy, R * 0.14, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = shade(C.void, 0.55, 0.42);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(gx, gy, R * 0.146, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = mix(C.void, C.bone, 0.32, 0.28);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(gx, gy, R * 0.133, 0, TAU);
  ctx.stroke();
  // the gilt emblem — a carved gold ring around the boss, a gilt kernel at
  // its heart (the lantern-finial motif; gold ink, not a third hue)
  ctx.strokeStyle = shade(C.void, 0.55, 0.38);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(gx, gy, R * 0.206, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = mix(C.goldInk, C.void, 0.25, 0.48);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(gx, gy, R * 0.199, 0, TAU);
  ctx.stroke();
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = shade(C.void, 0.6, 0.5); // dark bezel, concentric
  ctx.fillRect(-R * 0.033, -R * 0.033, R * 0.066, R * 0.066);
  ctx.fillStyle = mix(C.goldInk, C.void, 0.2, 0.55);
  ctx.fillRect(-R * 0.027, -R * 0.027, R * 0.054, R * 0.054);
  ctx.restore();
  // the leak faintly lights the carved edges it crosses — small teal
  // catches where the seam meets the inner rings, above and below the boss
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 1;
  for (const [rr, aC] of [
    [R * 0.4, 0.4],
    [R * 0.2, 0.48],
  ] as const) {
    for (const sy of [-1, 1] as const) {
      const cyr = gy + sy * rr;
      if (cyr < seamTop || cyr > seamBot) continue;
      const catchG = ctx.createLinearGradient(gx - R * 0.035, 0, gx + R * 0.035, 0);
      catchG.addColorStop(0, mix(C.verdigris, C.bone, 0.3, 0));
      catchG.addColorStop(0.5, mix(C.verdigris, C.bone, 0.3, aC));
      catchG.addColorStop(1, mix(C.verdigris, C.bone, 0.3, 0));
      ctx.strokeStyle = catchG;
      line(gx - R * 0.035, cyr, gx + R * 0.035, cyr);
    }
  }
  ctx.restore();
  // patina weep below the joint
  ctx.strokeStyle = shade(C.verdigrisDim, 0.9, 0.1);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const dx = gx + (rand() - 0.5) * R * 0.08;
    const dy = gy + R * (0.05 + rand() * 0.15);
    line(dx, dy, dx, dy + R * (0.04 + rand() * 0.06));
  }
  // the Gate sinks — dark air rises over its lower half, then a pale fog
  // bank laps across the lower rim: the scale cue that locks "colossal,
  // behind the midground" in place
  const sink = ctx.createLinearGradient(0, gy + R * 0.1, 0, gy + R * 0.95);
  sink.addColorStop(0, mix(C.void, C.surface, 0.3, 0));
  sink.addColorStop(1, mix(C.void, C.surface, 0.3, 0.85));
  ctx.fillStyle = sink;
  ctx.fillRect(gx - R * 1.25, gy + R * 0.1, R * 2.5, R * 0.9);
  const bank = ctx.createLinearGradient(0, gy + R * 0.5, 0, gy + R * 1.08);
  bank.addColorStop(0, mix(C.void, C.bone, 0.13, 0));
  bank.addColorStop(0.55, mix(C.void, C.bone, 0.13, 0.14));
  bank.addColorStop(1, mix(C.void, C.bone, 0.13, 0.04));
  ctx.fillStyle = bank;
  ctx.fillRect(gx - R * 1.6, gy + R * 0.5, R * 3.2, R * 0.58);

  // ── 4. fog stops — the Gate's foot and the far distance drown here ───────
  const fog = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.8);
  fog.addColorStop(0, mix(C.void, C.bone, 0.09, 0));
  fog.addColorStop(0.45, mix(C.void, C.bone, 0.09, 0.18));
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
  // A rocky tongue reaching from under the sheared ledge toward the Gate's
  // foot; the switchback steps are carved into its back. Its far end stays
  // faintly present where it crosses the Gate's lower rim (the door is
  // BEHIND the ground — the second scale cue) and exits the frame right.
  const spurEdge = (): void => {
    ctx.moveTo(w * 0.405, h * 0.945);
    ctx.quadraticCurveTo(w * 0.445, h * 0.885, w * 0.505, h * 0.822);
    ctx.quadraticCurveTo(w * 0.565, h * 0.777, w * 0.638, h * 0.758);
    ctx.quadraticCurveTo(w * 0.72, h * 0.732, w * 0.8, h * 0.687);
    ctx.quadraticCurveTo(w * 0.86, h * 0.655, w * 0.96, h * 0.648);
    ctx.lineTo(w * 1.02, h * 0.652);
  };
  const spurFade = ctx.createLinearGradient(w * 0.42, 0, w * 0.98, 0);
  spurFade.addColorStop(0, mix(C.void, C.surface, 0.5, 0.98));
  spurFade.addColorStop(0.5, mix(C.void, C.surface, 0.45, 0.75));
  spurFade.addColorStop(1, mix(C.void, C.surface, 0.42, 0.35));
  ctx.fillStyle = spurFade;
  ctx.beginPath();
  ctx.moveTo(w * 0.395, h);
  ctx.lineTo(w * 0.405, h * 0.945);
  spurEdge();
  ctx.lineTo(w * 1.02, h);
  ctx.closePath();
  ctx.fill();
  // its back catches a hair of the vigils' light, dying toward the Gate
  const spurLit = ctx.createLinearGradient(w * 0.42, 0, w * 0.88, 0);
  spurLit.addColorStop(0, mix(C.void, C.boneDim, 0.5, 0.2));
  spurLit.addColorStop(1, mix(C.void, C.boneDim, 0.5, 0));
  ctx.strokeStyle = spurLit;
  ctx.lineWidth = 1;
  ctx.beginPath();
  spurEdge();
  ctx.stroke();
  // rubble at the shear — the spur is fallen ledge; broken blocks pile
  // against the strata face so the two masses read as one ground
  type Slab = readonly [number, number, number, number];
  const rubble: readonly Slab[] = [
    // [x, y, w, h] as fractions — leaning shards at the contact
    [0.426, 0.93, 0.034, 0.014],
    [0.448, 0.947, 0.042, 0.016],
    [0.466, 0.915, 0.026, 0.011],
  ];
  for (const [rx, ry, rw2, rh2] of rubble) {
    const x0 = w * rx;
    const y0 = h * ry;
    const x1 = x0 + w * rw2;
    const y1 = y0 + h * rh2;
    ctx.fillStyle = mix(C.void, C.surface2, 0.55, 0.95);
    ctx.beginPath();
    ctx.moveTo(x0, y0 + (y1 - y0) * 0.4);
    ctx.lineTo(x1 - w * 0.006, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0 + w * 0.004, y1 + h * 0.004);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mix(C.void, C.boneDim, 0.55, 0.22);
    ctx.lineWidth = 1;
    line(x0, y0 + (y1 - y0) * 0.4, x1 - w * 0.006, y0);
  }
  // a fallen slab at the stair's foot — resting against the rubble, its
  // lower edge buried, a shadow tucked beneath it
  ctx.fillStyle = shade(C.void, 0.55, 0.5);
  ctx.beginPath();
  ctx.ellipse(w * 0.482, h * 0.966, w * 0.036, h * 0.006, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mix(C.void, C.surface, 0.4, 0.9);
  ctx.beginPath();
  ctx.moveTo(w * 0.452, h * 0.952);
  ctx.lineTo(w * 0.505, h * 0.938);
  ctx.lineTo(w * 0.512, h * 0.956);
  ctx.lineTo(w * 0.458, h * 0.97);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.45, 0.14);
  ctx.lineWidth = 1;
  line(w * 0.452, h * 0.952, w * 0.505, h * 0.938);
  // a chip leaning on its high side — contact, not levitation
  ctx.fillStyle = mix(C.void, C.surface2, 0.45, 0.9);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.94);
  ctx.lineTo(w * 0.514, h * 0.932);
  ctx.lineTo(w * 0.518, h * 0.947);
  ctx.closePath();
  ctx.fill();

  // ── 7. the descent — switchback flights carved into the spur's back ──────
  // Descending away from the viewer: each flight sits higher in frame,
  // smaller and fainter, and the whole route hugs the spur's silhouette —
  // the last flight runs INTO the fog at the Gate's foot and drowns there.
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
    const th = Math.max(3, s * 0.013) * (0.55 + presence * 0.45);
    const body = th * 2.4; // solid stringer mass under the treads
    ctx.globalAlpha = presence;
    const tread = (): void => {
      ctx.moveTo(x0, y0);
      for (let i = 1; i <= n; i++) {
        ctx.lineTo(x0 + dx * i, y0 + dy * (i - 1));
        ctx.lineTo(x0 + dx * i, y0 + dy * i);
      }
    };
    // the mass — darker than the spur's lit back, so the flight reads as a
    // carved block, not a wire
    ctx.fillStyle = shade(C.void, 0.85, 0.95);
    ctx.beginPath();
    tread();
    ctx.lineTo(x1, y1 + body);
    ctx.lineTo(x0, y0 + body);
    ctx.closePath();
    ctx.fill();
    // nosings catch the vigils' light — the crispest lines in the frame
    // (crisper than any Gate carving: near beats far)
    ctx.strokeStyle = mix(C.void, C.bone, 0.5, 0.55);
    ctx.lineWidth = Math.max(1, s * 0.002);
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
    [0.652, 0.754, 0.702, 0.736, 5, 0.34],
    [0.708, 0.734, 0.742, 0.717, 4, 0.2],
  ];
  type Landing = readonly [number, number, number, number];
  const landings: readonly Landing[] = [
    [0.56, 0.845, 0.05, 0.85],
    [0.478, 0.796, 0.04, 0.62],
    [0.638, 0.75, 0.034, 0.42],
  ];
  type Vigil = readonly [number, number, number];
  const vigils: readonly Vigil[] = [
    // [x, y, presence] — every one SEATED on a tread or landing surface
    [0.451, 0.916, 1], // flight 1, first tread
    [0.582, 0.845, 0.8], // landing 1
    [0.49, 0.796, 0.62], // landing 2
    [0.569, 0.772, 0.5], // flight 3, mid tread
    [0.641, 0.75, 0.4], // landing 3
    [0.672, 0.747, 0.3], // flight 4
    [0.702, 0.737, 0.22], // flight 4, top
    [0.725, 0.726, 0.15], // flight 5
    [0.742, 0.717, 0.09], // flight 5, top — drowning in the Gate-foot fog
  ];
  const paintLanding = (lx: number, ly: number, lw2: number, p: number): void => {
    const th = Math.max(2.5, s * 0.011) * (0.55 + p * 0.45);
    ctx.globalAlpha = p;
    ctx.fillStyle = shade(C.void, 0.85, 0.95);
    ctx.fillRect(w * lx, h * ly, w * lw2, th * 1.6);
    ctx.strokeStyle = mix(C.void, C.bone, 0.5, 0.5);
    ctx.lineWidth = Math.max(1, s * 0.002);
    line(w * lx, h * ly, w * (lx + lw2), h * ly);
    ctx.globalAlpha = 1;
  };
  const paintVigil = (vx: number, vy: number, p: number): void => {
    const x = w * vx + (rand() - 0.5) * s * 0.006;
    const y = h * vy; // seated exactly on the tread — no vertical drift
    const stubH = p > 0.45 ? Math.max(2, s * 0.007 * p) : 0;
    const dotY = y - stubH;
    const hr = s * (0.006 + 0.038 * p * p); // distant halos shrink hard
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(x, dotY, 0, x, dotY, hr);
    halo.addColorStop(0, shade(C.flame, 1, 0.1 + 0.26 * p));
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
    // each light warms the step edge it stands on, dying with distance
    const tw = s * (0.008 + 0.02 * p);
    const warm = ctx.createLinearGradient(x - tw, 0, x + tw, 0);
    warm.addColorStop(0, mix(C.flame, C.bone, 0.45, 0));
    warm.addColorStop(0.5, mix(C.flame, C.bone, 0.45, 0.2 + 0.3 * p));
    warm.addColorStop(1, mix(C.flame, C.bone, 0.45, 0));
    ctx.strokeStyle = warm;
    ctx.lineWidth = 1;
    line(x - tw, y + 1, x + tw, y + 1);
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
  // the farthest vigils gather at the Gate's foot — their gathered warmth
  // gives its lower rim one ember kiss, tying door to ground
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const kiss = ctx.createRadialGradient(w * 0.735, h * 0.705, 0, w * 0.735, h * 0.705, s * 0.1);
  kiss.addColorStop(0, shade(C.ember, 0.6, 0.06));
  kiss.addColorStop(1, shade(C.ember, 0.6, 0));
  ctx.fillStyle = kiss;
  ctx.fillRect(w * 0.735 - s * 0.11, h * 0.705 - s * 0.11, s * 0.22, s * 0.22);
  ctx.restore();

  // ── 8. the crown — pure quiet darkness (D83: the void stays pure) ────────
  // No ceiling is drawn. The dark simply swallows the top of frame — the
  // Gate's upper carvings dissolve BEFORE the top band, so nothing but void
  // remains above. A ceiling too far up to see is more colossal than any
  // drawn one.
  const crownDark = ctx.createLinearGradient(0, 0, 0, h * 0.3);
  crownDark.addColorStop(0, shade(C.void, 0.85, 1));
  crownDark.addColorStop(0.6, shade(C.void, 0.85, 0.93));
  crownDark.addColorStop(0.85, shade(C.void, 0.85, 0.45));
  crownDark.addColorStop(1, shade(C.void, 0.85, 0));
  ctx.fillStyle = crownDark;
  ctx.fillRect(0, 0, w, h * 0.3);

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
  // the shear reads as strata: value steps down the broken face. Their edge
  // lights stay cool and FAINT — the candle is far; only the crest near it
  // earns real warmth (light must have a source).
  ctx.save();
  ledgePath();
  ctx.clip();
  const strata: ReadonlyArray<readonly [number, number, string, number]> = [
    // [yTop, yBot, fill, edge-light alpha]
    [ledgeY, bedA, mix(C.void, C.surface2, 0.72, 0.85), 0],
    [bedA, bedB, mix(C.void, C.surface2, 0.5, 0.85), 0.12],
    [bedB, bedC, mix(C.void, C.surface, 0.34, 0.85), 0.07],
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
  // crest edge: a faint cool line full length…
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.5, 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, crest[0]?.y ?? ledgeY);
  for (const p of crest) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  // …then candle-warmth, brightest beside the wax and falling off with
  // distance in both directions — rim light with a visible source
  const crestWarm = ctx.createLinearGradient(cx - w * 0.17, 0, cx + w * 0.24, 0);
  crestWarm.addColorStop(0, mix(C.flame, C.bone, 0.5, 0));
  crestWarm.addColorStop(0.42, mix(C.flame, C.bone, 0.4, 0.5));
  crestWarm.addColorStop(1, mix(C.flame, C.bone, 0.5, 0));
  ctx.strokeStyle = crestWarm;
  ctx.beginPath();
  ctx.moveTo(0, crest[0]?.y ?? ledgeY);
  for (const p of crest) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  // face joints and one crack reaching in from the shear
  ctx.strokeStyle = shade(C.surface2, 1.15, 0.14);
  const courseY = ledgeY + h * 0.05;
  line(0, courseY, breakX * 0.88, courseY + (rand() - 0.5) * s * 0.008);
  // the course joint nearest the candle catches a whisper of the same warmth
  const courseWarm = ctx.createLinearGradient(cx - w * 0.12, 0, cx + w * 0.16, 0);
  courseWarm.addColorStop(0, mix(C.flame, C.boneDim, 0.5, 0));
  courseWarm.addColorStop(0.45, mix(C.flame, C.boneDim, 0.5, 0.16));
  courseWarm.addColorStop(1, mix(C.flame, C.boneDim, 0.5, 0));
  ctx.strokeStyle = courseWarm;
  line(cx - w * 0.12, courseY + 0.5, cx + w * 0.16, courseY + 0.5);
  ctx.strokeStyle = shade(C.surface2, 1.15, 0.14);
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
  // soft contact shadow first — the candle presses into its own dark
  ctx.save();
  ctx.translate(cx, ledgeY + ch * 0.012);
  ctx.scale(1, 0.22);
  const contact = ctx.createRadialGradient(0, 0, 0, 0, 0, cw * 1.3);
  contact.addColorStop(0, shade(C.void, 0.55, 0.72));
  contact.addColorStop(0.55, shade(C.void, 0.55, 0.4));
  contact.addColorStop(1, shade(C.void, 0.55, 0));
  ctx.fillStyle = contact;
  ctx.fillRect(-cw * 1.35, -cw * 1.35, cw * 2.7, cw * 2.7);
  ctx.restore();
  // and a firmer seat right at the foot — the candle SITS on the stone
  ctx.fillStyle = shade(C.void, 0.55, 0.5);
  ctx.beginPath();
  ctx.ellipse(cx + cw * 0.03, ledgeY + ch * 0.004, cw * 0.68, ch * 0.021, 0, 0, TAU);
  ctx.fill();
  // (no pale apron ellipse here — a bright base under an unlit-bottom candle
  // read as a saucer; the warm pool in §11 grades the light onto the stone)
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
  // lighting logic: the flame lives at the TOP — warm crown, wax cooling
  // and dimming down the shaft, the foot settling into the ledge's dark
  const bodyG = ctx.createLinearGradient(0, topY, 0, ledgeY);
  bodyG.addColorStop(0, mix(C.parchmentAged, C.flame, 0.32)); // response warmth
  bodyG.addColorStop(0.22, mix(C.parchmentAged, C.bone, 0.3));
  bodyG.addColorStop(0.55, mix(C.bone, C.boneDim, 0.5));
  bodyG.addColorStop(1, mix(C.boneDim, C.void, 0.55));
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
  const oldBot = mix(C.boneDim, C.void, 0.45);
  // old long ribbons first (behind the fresh skirt); the great run reaches the foot
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
  // the base settles into shadow — wax and ribbons together, clipped to the
  // silhouette, so the pillar is brightest where the flame will live
  ctx.save();
  body();
  ctx.clip();
  const baseDim = ctx.createLinearGradient(0, ledgeY + 1, 0, ledgeY - ch * 0.6);
  baseDim.addColorStop(0, shade(C.void, 0.7, 0.5));
  baseDim.addColorStop(1, shade(C.void, 0.7, 0));
  ctx.fillStyle = baseDim;
  ctx.fillRect(cx - cw, ledgeY - ch * 0.62, cw * 2, ch * 0.64);
  ctx.restore();
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
  // a hotter crown on the crater rim and fresh skirt — the wax nearest the
  // flame glows; the shaft below has already fallen back to shadow
  const crown = ctx.createRadialGradient(wickTipX, topY + ch * 0.02, 0, wickTipX, topY + ch * 0.02, cw * 1.5);
  crown.addColorStop(0, shade(C.flameHi, 0.7, 0.24));
  crown.addColorStop(1, shade(C.flameHi, 0.7, 0));
  ctx.fillStyle = crown;
  ctx.fillRect(wickTipX - cw * 1.6, topY - cw * 1.6, cw * 3.2, cw * 3.2);
  // the warm pool — a broad soft grade across the ledge stone, no hard edge
  ctx.translate(cx + cw * 0.3, ledgeY + ch * 0.015);
  ctx.scale(1, 0.32);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, ch * 1.4);
  pool.addColorStop(0, shade(C.flame, 0.65, 0.3));
  pool.addColorStop(0.2, shade(C.flame, 0.6, 0.18));
  pool.addColorStop(0.5, shade(C.ember, 0.55, 0.09));
  pool.addColorStop(1, shade(C.ember, 0.55, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-ch * 1.45, -ch * 1.45, ch * 2.9, ch * 2.9);
  ctx.restore();
  // dust motes drifting where flame-light reaches — warm-tinted only
  // (flame/ember hues, never pale-on-dark), hugging the candle glow and the
  // vigil stair. The crown dark above stays truly dark: we are under miles
  // of stone, and a starless black is truer than a starry one.
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * (0.06 + rand() * 0.52);
    const d = h * (0.04 + rand() * 0.11);
    const mxp = glowX + Math.cos(a) * d * 1.25;
    const myp = Math.max(glowY - h * 0.1, glowY + Math.sin(a) * d);
    const fade = Math.max(0, 1 - d / (h * 0.16));
    ctx.fillStyle = mix(C.flame, C.ember, rand() * 0.5, 0.04 + 0.07 * fade * rand());
    ctx.beginPath();
    ctx.arc(mxp, myp, Math.max(0.5, s * 0.001 + rand() * s * 0.0009), 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    // a few embers stirred over the near flights, inside the vigils' reach
    const t = rand();
    const mxp = w * (0.49 + t * 0.13) + (rand() - 0.5) * s * 0.02;
    const myp = h * (0.845 - t * 0.05) + (rand() - 0.5) * s * 0.012;
    ctx.fillStyle = mix(C.flame, C.ember, 0.5, 0.04 + rand() * 0.05);
    ctx.beginPath();
    ctx.arc(mxp, myp, Math.max(0.5, s * 0.0008 + rand() * s * 0.0007), 0, TAU);
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
