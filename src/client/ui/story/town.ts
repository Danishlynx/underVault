/**
 * Story slide 1 — "There was a town above a door."
 *
 * A huddled hilltop town at dusk, painted as a storybook cross-section: warm
 * candle-lit windows above, and directly beneath the hill — exposed through
 * translucent dark strata — the crown of the colossal circular Great Gate,
 * the largest single shape in frame. Its verdigris seam and keyhole are the
 * cold second light source of the plate (two-hue law: amber above, verdigris
 * below). Foundation piles, roots and glowing cracks physically tie the
 * houses to the door's lintel. Parallax: jagged far ridge, hazy mid ridge,
 * town hill, dark foreground rocks framing the corners. The bottom band
 * (~below 80% height) is crushed calm and dark: caption text renders there.
 * Colors via tokens + shade()/mix() only; all jitter through a private
 * seeded LCG (never Math.random, never paint.ts crand).
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall's hallRand pattern, own seed) — paint.ts crand()'s
// stream is shared with the world-texture painters and must not be touched.
function townRand(seed: number): () => number {
  let s = seed >>> 0 || 0x70b1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const TAU = Math.PI * 2;

export function paintTown(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = townRand(0x70b1);
  const s = Math.min(w, h);
  const ink = shade(C.void, 0.7, 0.9);

  // ── geometry ─────────────────────────────────────────────────────────────
  // Hill crest: gaussian mound, apex ~0.40h. Soil line: where turf becomes
  // cross-section strata. Gate: circle whose crown always surfaces at 0.565h.
  const crestY = (x: number): number => {
    const t = x / w - 0.5;
    return h * 0.535 - h * 0.135 * Math.exp(-(t * t) / (2 * 0.2 * 0.2));
  };
  const soilDrop = s * 0.055;
  const gx = w * 0.5;
  const gateTop = h * 0.565;
  const gr = Math.min(w * 0.46, h * 0.52);
  const gy = gateTop + gr;
  const bossY = gateTop + (h - gateTop) * 0.46; // keyhole — above the caption
  const arcY = (x: number): number => gy - Math.sqrt(Math.max(0, gr * gr - (x - gx) * (x - gx)));
  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  // ── 1. dusk sky — void deepening into a pale dusk band at the horizon ────
  const horizonC = mix(mix(C.void, C.surface2, 0.95), C.bone, 0.09);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, C.void);
  sky.addColorStop(0.24, mix(C.void, C.surface, 0.55));
  sky.addColorStop(0.43, horizonC);
  sky.addColorStop(0.55, mix(C.void, C.surface, 0.4));
  sky.addColorStop(1, shade(C.void, 0.85));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // ── 2. sparse stars, thinning toward the horizon ─────────────────────────
  const mx = w * 0.745;
  const my = h * 0.125;
  const mr = s * 0.048;
  const nStars = Math.round(46 * Math.max(1, w / h));
  for (let i = 0; i < nStars; i++) {
    const sx = rand() * w;
    const sy = rand() * rand() * h * 0.38;
    if (Math.hypot(sx - mx, sy - my) < mr * 4.5) continue;
    const a = 0.1 + rand() * 0.35;
    const r = 0.4 + rand() * 0.8;
    ctx.fillStyle = mix(C.bone, C.parchment, 0.3, a);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, TAU);
    ctx.fill();
    if (rand() < 0.12) {
      // a few four-point glints
      ctx.strokeStyle = mix(C.bone, C.parchment, 0.3, a * 0.5);
      ctx.lineWidth = 0.7;
      line(sx - r * 3, sy, sx + r * 3, sy);
      line(sx, sy - r * 3, sx, sy + r * 3);
    }
  }

  // ── 3. crescent moon, carved by refilling with the sky's own gradient ────
  ctx.fillStyle = mix(C.bone, C.parchment, 0.35);
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = sky;
  ctx.beginPath();
  ctx.arc(mx + mr * 0.38, my - mr * 0.16, mr * 0.92, 0, TAU);
  ctx.fill();
  const moonHalo = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 5.2);
  moonHalo.addColorStop(0, mix(C.void, C.bone, 0.4, 0.14));
  moonHalo.addColorStop(0.4, mix(C.void, C.bone, 0.35, 0.05));
  moonHalo.addColorStop(1, mix(C.void, C.bone, 0.35, 0));
  ctx.fillStyle = moonHalo;
  ctx.fillRect(mx - mr * 5.2, my - mr * 5.2, mr * 10.4, mr * 10.4);

  // ── 4. far mountain ridge — fog stop 1, jagged peaks against the dusk ────
  ctx.fillStyle = mix(C.void, C.surface, 0.85);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.455);
  let px0 = 0;
  while (px0 < w) {
    const peakX = px0 + w * (0.035 + rand() * 0.05);
    const footX = Math.min(peakX + w * (0.035 + rand() * 0.05), w + 8);
    ctx.lineTo(peakX, h * (0.345 + rand() * 0.06));
    ctx.lineTo(footX, h * (0.435 + rand() * 0.02));
    px0 = footX;
  }
  ctx.lineTo(w, h * 0.62);
  ctx.lineTo(0, h * 0.62);
  ctx.closePath();
  ctx.fill();

  // ── 5. mid ridge — fog stop 2, soft land-mass behind the hill flanks ─────
  ctx.fillStyle = mix(C.void, C.surface, 0.5);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.478);
  let rx = 0;
  while (rx < w) {
    const nx = Math.min(rx + w * (0.1 + rand() * 0.12), w);
    const ny = h * (0.462 + rand() * 0.03);
    ctx.quadraticCurveTo((rx + nx) / 2, ny - h * 0.014, nx, ny);
    rx = nx;
  }
  ctx.lineTo(w, h * 0.62);
  ctx.lineTo(0, h * 0.62);
  ctx.closePath();
  ctx.fill();

  // ── 6. mist settling at the hill's base ──────────────────────────────────
  const fog = ctx.createLinearGradient(0, h * 0.44, 0, h * 0.57);
  fog.addColorStop(0, mix(C.void, C.bone, 0.16, 0));
  fog.addColorStop(0.5, mix(C.void, C.bone, 0.16, 0.7));
  fog.addColorStop(1, mix(C.void, C.bone, 0.16, 0));
  ctx.fillStyle = fog;
  ctx.fillRect(0, h * 0.44, w, h * 0.13);

  // ── 7. the hill / earth mass — one dark cut, sampled with jitter ─────────
  const crest: Array<{ x: number; y: number }> = [];
  const STEPS = 36;
  for (let i = 0; i <= STEPS; i++) {
    const x = (i / STEPS) * w;
    crest.push({ x, y: crestY(x) + (rand() - 0.5) * s * 0.006 });
  }
  const earthPath = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, crest[0]?.y ?? h * 0.53);
    for (const p of crest) ctx.lineTo(p.x, p.y);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
  };
  earthPath();
  ctx.fillStyle = mix(C.void, C.surface, 0.22);
  ctx.fill();

  // ── 8. the cutaway underworld — clipped to below the crest ──────────────
  ctx.save();
  earthPath();
  ctx.clip();

  // 8a. below the soil line the turf gives way to deep-earth strata
  ctx.beginPath();
  ctx.moveTo(0, (crest[0]?.y ?? h * 0.53) + soilDrop);
  for (const p of crest) ctx.lineTo(p.x, p.y + soilDrop + (rand() - 0.5) * s * 0.004);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const earthG = ctx.createLinearGradient(0, h * 0.42, 0, h);
  earthG.addColorStop(0, shade(C.void, 0.92));
  earthG.addColorStop(0.5, shade(C.void, 0.68));
  earthG.addColorStop(1, shade(C.void, 0.45));
  ctx.fillStyle = earthG;
  ctx.fill();

  // 8b. soil seam — a pale hairline where turf meets section
  ctx.strokeStyle = mix(C.void, C.boneDim, 0.45, 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, (crest[0]?.y ?? h * 0.53) + soilDrop);
  for (const p of crest) ctx.lineTo(p.x, p.y + soilDrop);
  ctx.stroke();

  // 8c. translucent strata bands — a geologist's section, gently bowed
  for (let i = 0; i < 5; i++) {
    const y0 = crestY(gx) + soilDrop + s * 0.028 + i * (gateTop - crestY(gx) - soilDrop) * 0.36 + i * s * 0.02;
    ctx.strokeStyle = mix(C.void, C.surface2, 0.95, 0.3 - i * 0.04);
    ctx.lineWidth = 1 + rand();
    ctx.beginPath();
    ctx.moveTo(0, y0 + s * 0.012);
    ctx.quadraticCurveTo(w * (0.3 + rand() * 0.4), y0 + s * (0.015 + rand() * 0.02), w, y0 + (rand() - 0.3) * s * 0.03);
    ctx.stroke();
    // sparse buried stones along the stratum
    ctx.fillStyle = mix(C.void, C.surface2, 0.8, 0.3);
    for (let k = 0; k < 5; k++) {
      const bx = rand() * w;
      ctx.beginPath();
      ctx.ellipse(bx, y0 + (rand() - 0.2) * s * 0.02, 1.5 + rand() * 2.5, 1 + rand() * 1.5, rand(), 0, TAU);
      ctx.fill();
    }
  }

  // 8d. foundation piles — tapered stone footings driven from the town's
  // soil down onto the lintel (filled wedges, not poles)
  ctx.fillStyle = mix(C.void, C.boneDim, 0.26, 0.45);
  for (const off of [-0.11, -0.045, 0.03, 0.1] as const) {
    const x = gx + w * off + (rand() - 0.5) * s * 0.01;
    const top = crestY(x) + soilDrop - s * 0.01;
    const bot = arcY(x) - s * 0.003;
    const wTop = s * (0.007 + rand() * 0.003);
    const lean = (rand() - 0.5) * s * 0.008;
    ctx.beginPath();
    ctx.moveTo(x - wTop, top);
    ctx.lineTo(x + wTop, top);
    ctx.lineTo(x + lean + wTop * 0.35, bot);
    ctx.lineTo(x + lean - wTop * 0.35, bot);
    ctx.closePath();
    ctx.fill();
  }

  // ── 9. THE GREAT GATE — buried colossus, the largest shape in frame ─────
  // socket shadow: the dark gap between door and earth
  ctx.strokeStyle = shade(C.void, 0.3, 0.9);
  ctx.lineWidth = s * 0.014;
  ctx.beginPath();
  ctx.arc(gx, gy, gr + s * 0.008, 0, TAU);
  ctx.stroke();

  // the disc — a clear value step above the earth, cold-kissed at the crown
  const disc = ctx.createRadialGradient(gx, gateTop + gr * 0.28, gr * 0.06, gx, gy, gr);
  disc.addColorStop(0, mix(mix(C.void, C.surface2, 1), C.verdigrisDim, 0.2));
  disc.addColorStop(0.45, mix(C.void, C.surface2, 0.85));
  disc.addColorStop(1, mix(C.void, C.surface2, 0.45));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(gx, gy, gr, 0, TAU);
  ctx.fill();

  // relief rings (Gate iconography: concentric rings, spokes, rivets)
  const ring = (r: number, lw: number, color: string): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, TAU);
    ctx.stroke();
  };
  ring(gr - 2, 2, shade(C.surface2, 1.6, 0.6));
  ring(gr - s * 0.02, 1, shade(C.surface2, 1.4, 0.3));
  ring(gr * 0.86, 1.5, shade(C.surface2, 1.5, 0.45));
  ring(gr * 0.68, 1.2, shade(C.surface2, 1.4, 0.32));
  ring(gr * 0.5, 1, shade(C.surface2, 1.4, 0.22));
  // ridge spokes across the outer band, fanned around the visible crown
  ctx.strokeStyle = shade(C.surface2, 1.3, 0.3);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI / 2 + (i - 5) * 0.21;
    line(
      gx + Math.cos(a) * gr * 0.86,
      gy + Math.sin(a) * gr * 0.86,
      gx + Math.cos(a) * (gr - s * 0.02),
      gy + Math.sin(a) * (gr - s * 0.02),
    );
  }
  // rivets along the crown band
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI / 2 + (i - 6) * 0.2 + 0.1;
    ctx.fillStyle = shade(C.surface2, 1.9, 0.65);
    ctx.beginPath();
    ctx.arc(gx + Math.cos(a) * gr * 0.925, gy + Math.sin(a) * gr * 0.925, 1.4 + rand() * 0.8, 0, TAU);
    ctx.fill();
  }
  // carved sigils along the crown — cold, half-legible
  for (let i = 0; i < 17; i++) {
    const a = -Math.PI / 2 + (i - 8) * 0.155 + (rand() - 0.5) * 0.02;
    const r0 = gr * 0.755;
    const r1 = r0 + gr * 0.02 + rand() * gr * 0.025;
    const bright = i % 4 === 0;
    ctx.strokeStyle = bright
      ? mix(C.verdigris, C.verdigrisDim, 0.45, 0.5)
      : mix(C.boneDim, C.verdigrisDim, 0.4, 0.3);
    ctx.lineWidth = bright ? 1.4 : 1;
    line(gx + Math.cos(a) * r0, gy + Math.sin(a) * r0, gx + Math.cos(a) * r1, gy + Math.sin(a) * r1);
    if (rand() < 0.4) {
      ctx.beginPath();
      ctx.arc(gx + Math.cos(a) * (r1 + gr * 0.012), gy + Math.sin(a) * (r1 + gr * 0.012), 1, 0, TAU);
      ctx.stroke();
    }
  }

  // the seam — a verdigris breath down the door's middle, dying before the
  // caption zone; wide soft leak + sharp core over a dark cut
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  line(gx, gateTop + 1, gx, h * 0.86);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(gx, (gateTop + bossY) / 2);
  ctx.scale(0.22, 1);
  const leakR = (bossY - gateTop) * 0.95;
  const leak = ctx.createRadialGradient(0, 0, 0, 0, 0, leakR);
  leak.addColorStop(0, shade(C.verdigrisDim, 1, 0.28));
  leak.addColorStop(1, shade(C.verdigrisDim, 1, 0));
  ctx.fillStyle = leak;
  ctx.fillRect(-leakR, -leakR, leakR * 2, leakR * 2);
  ctx.restore();
  const seam = ctx.createLinearGradient(0, gateTop, 0, h * 0.82);
  seam.addColorStop(0, mix(C.verdigris, C.verdigrisDim, 0.3, 0.75));
  seam.addColorStop(0.55, mix(C.verdigris, C.verdigrisDim, 0.5, 0.4));
  seam.addColorStop(1, mix(C.void, C.verdigrisDim, 0.7, 0));
  ctx.strokeStyle = seam;
  ctx.lineWidth = 1.6;
  line(gx, gateTop + 1, gx, h * 0.82);

  // the keyhole plate — coldest, brightest accent below ground
  const kr = Math.max(8, s * 0.026);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const keyHalo = ctx.createRadialGradient(gx, bossY, 0, gx, bossY, kr * 5);
  keyHalo.addColorStop(0, shade(C.verdigrisDim, 1.1, 0.3));
  keyHalo.addColorStop(1, shade(C.verdigrisDim, 1.1, 0));
  ctx.fillStyle = keyHalo;
  ctx.fillRect(gx - kr * 5, bossY - kr * 5, kr * 10, kr * 10);
  ctx.restore();
  ctx.fillStyle = mix(C.void, C.surface2, 0.95);
  ctx.beginPath();
  ctx.arc(gx, bossY, kr, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = shade(C.surface2, 1.7, 0.6);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(gx, bossY, kr, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.5, 0.35);
  ctx.beginPath();
  ctx.arc(gx, bossY, kr * 0.75, 0, TAU);
  ctx.stroke();
  // the keyhole itself, glowing — light from beyond the door
  ctx.fillStyle = shade(C.verdigris, 1.2, 0.95);
  ctx.beginPath();
  ctx.arc(gx, bossY - kr * 0.18, kr * 0.24, 0, TAU);
  ctx.moveTo(gx - kr * 0.13, bossY - kr * 0.05);
  ctx.lineTo(gx + kr * 0.13, bossY - kr * 0.05);
  ctx.lineTo(gx + kr * 0.24, bossY + kr * 0.5);
  ctx.lineTo(gx - kr * 0.24, bossY + kr * 0.5);
  ctx.closePath();
  ctx.fill();

  // luminous rim along the arch — the thumbnail read
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rimC = mix(C.verdigris, C.verdigrisDim, 0.35);
  ring(gr, s * 0.018, shade(rimC, 1, 0.07));
  ring(gr, s * 0.007, shade(rimC, 1, 0.18));
  ring(gr, 1.6, shade(rimC, 1.1, 0.55));
  // crown pool — cold light gathering where the door meets the strata
  const crownGlow = ctx.createRadialGradient(gx, gateTop + s * 0.01, 0, gx, gateTop + s * 0.01, gr * 0.45);
  crownGlow.addColorStop(0, shade(C.verdigrisDim, 1, 0.11));
  crownGlow.addColorStop(1, shade(C.verdigrisDim, 1, 0));
  ctx.fillStyle = crownGlow;
  ctx.fillRect(gx - gr * 0.45, gateTop - gr * 0.25, gr * 0.9, gr * 0.7);
  // broad cold underglow — fills the once-empty bottom half
  const under = ctx.createRadialGradient(gx, bossY, kr, gx, bossY, Math.max(gr * 1.1, w * 0.42));
  under.addColorStop(0, shade(C.verdigrisDim, 0.9, 0.13));
  under.addColorStop(1, shade(C.verdigrisDim, 0.9, 0));
  ctx.fillStyle = under;
  ctx.fillRect(0, gateTop - s * 0.05, w, h - gateTop + s * 0.05);
  ctx.restore();

  // ── 10. cracks — cold light bleeding up from the lintel toward the town ──
  const crack = (xTop: number, xTilt: number): void => {
    const pts: Array<{ x: number; y: number }> = [];
    const y0 = crestY(xTop) + soilDrop * 0.75;
    const y1 = arcY(xTop + xTilt) - s * 0.006;
    const segs = 5;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      pts.push({
        x: xTop + xTilt * t + (i === 0 || i === segs ? 0 : (rand() - 0.5) * s * 0.022),
        y: y0 + (y1 - y0) * t,
      });
    }
    const trace = (): void => {
      ctx.beginPath();
      ctx.moveTo(pts[0]?.x ?? xTop, pts[0]?.y ?? y0);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = shade(C.verdigrisDim, 1, 0.12);
    ctx.lineWidth = s * 0.007;
    trace();
    ctx.restore();
    ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.55, 0.4);
    ctx.lineWidth = 1.1;
    trace();
    // a hairline side-branch
    const mid = pts[2];
    if (mid !== undefined) {
      ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.7, 0.25);
      line(mid.x, mid.y, mid.x + (rand() - 0.5) * s * 0.05, mid.y + s * 0.03);
    }
  };
  crack(gx - w * 0.155, w * 0.03);
  crack(gx - w * 0.02, -w * 0.012);
  crack(gx + w * 0.125, -w * 0.035);

  ctx.restore(); // end cutaway clip

  // ── 11. the cut of the cross-section — turf rim over an ink line ─────────
  const strokeCrest = (dy: number, style: string, lw: number): void => {
    ctx.strokeStyle = style;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, (crest[0]?.y ?? h * 0.53) + dy);
    for (const p of crest) ctx.lineTo(p.x, p.y + dy);
    ctx.stroke();
  };
  strokeCrest(1.5, ink, 1.5);
  strokeCrest(0, mix(C.void, C.bone, 0.22, 0.5), 1);

  // ── 12. lantern-lit path winding down the western flank ─────────────────
  const pathAt = (t: number): { x: number; y: number } => {
    const x = w * (0.415 - 0.27 * t);
    return { x, y: crestY(x) + s * (0.012 + 0.036 * t) + Math.sin(t * 9) * s * 0.004 };
  };
  ctx.strokeStyle = mix(C.void, C.parchmentAged, 0.3, 0.4);
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 14; i += 2) {
    const a = pathAt(i / 14);
    const b = pathAt((i + 1) / 14);
    line(a.x, a.y, b.x, b.y);
  }
  for (const t of [0.16, 0.52, 0.88] as const) {
    const p = pathAt(t);
    ctx.strokeStyle = shade(C.void, 1.4, 0.8);
    ctx.lineWidth = 1;
    line(p.x, p.y - 1, p.x, p.y - s * 0.009);
    const lg = ctx.createRadialGradient(p.x, p.y - s * 0.011, 0, p.x, p.y - s * 0.011, s * 0.012);
    lg.addColorStop(0, shade(C.flame, 1, 0.3));
    lg.addColorStop(1, shade(C.flame, 1, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(p.x - s * 0.012, p.y - s * 0.023, s * 0.024, s * 0.024);
    ctx.fillStyle = mix(C.flame, C.flameHi, 0.5);
    ctx.fillRect(p.x - 1, p.y - s * 0.012, 2, 2.4);
  }

  // ── 13. fence posts along the crest, flanking the town ──────────────────
  ctx.strokeStyle = shade(C.void, 0.9, 0.9);
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 6; i++) {
      const x = gx + side * (s * 0.31 + i * s * 0.024) + (rand() - 0.5) * s * 0.006;
      if (x < 0 || x > w) continue;
      const y = crestY(x) + s * 0.006;
      line(x, y, x, y - s * (0.008 + rand() * 0.004));
    }
  }

  // ── 14. two bare trees — branchy silhouettes at the town's edges ─────────
  const tree = (tx0: number, hgt: number): void => {
    const base = crestY(tx0) + s * 0.006;
    ctx.strokeStyle = shade(C.void, 0.8, 0.95);
    ctx.lineWidth = Math.max(1.8, s * 0.0045);
    ctx.beginPath();
    ctx.moveTo(tx0, base);
    ctx.quadraticCurveTo(tx0 + hgt * 0.06, base - hgt * 0.6, tx0 - hgt * 0.05, base - hgt);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const t = 0.4 + i * 0.14;
      const by = base - hgt * t;
      const dir = i % 2 === 0 ? 1 : -1;
      const bl = hgt * (0.34 - t * 0.2) * (0.8 + rand() * 0.4);
      ctx.beginPath();
      ctx.moveTo(tx0 + dir * 1, by);
      ctx.quadraticCurveTo(tx0 + dir * bl * 0.6, by - bl * 0.35, tx0 + dir * bl, by - bl * (0.55 + rand() * 0.25));
      ctx.stroke();
    }
  };
  tree(w * 0.5 - s * 0.345, s * 0.055);
  tree(w * 0.5 + s * 0.36, s * 0.048);

  // ── 15. the town — huddled silhouettes; collects windows + chimney tops ──
  const windows: Array<{ x: number; y: number; glow: boolean }> = [];
  const chimneys: Array<{ x: number; y: number }> = [];
  const house = (
    cx: number,
    bw: number,
    bh: number,
    roofH: number,
    opts: { fill: string; outlined?: boolean; lit?: number; chimney?: boolean },
  ): void => {
    const baseY = crestY(cx) + s * 0.008;
    const x0 = cx - bw / 2;
    const peakX = cx + (rand() - 0.5) * bw * 0.16;
    ctx.fillStyle = opts.fill;
    ctx.beginPath();
    ctx.moveTo(x0, baseY);
    ctx.lineTo(x0, baseY - bh);
    ctx.lineTo(x0 - bw * 0.1, baseY - bh); // eave
    ctx.lineTo(peakX, baseY - bh - roofH); // steep peak
    ctx.lineTo(x0 + bw * 1.1, baseY - bh);
    ctx.lineTo(x0 + bw, baseY - bh);
    ctx.lineTo(x0 + bw, baseY);
    ctx.closePath();
    ctx.fill();
    if (opts.outlined === true) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (opts.chimney === true) {
      const chx = cx + bw * (rand() < 0.5 ? -0.3 : 0.26);
      const chw = Math.max(2, bw * 0.09);
      const chTop = baseY - bh - roofH * 0.55;
      ctx.fillRect(chx, chTop, chw, roofH * 0.4);
      chimneys.push({ x: chx + chw / 2, y: chTop });
    }
    const lit = opts.lit ?? 0;
    for (let i = 0; i < lit; i++) {
      windows.push({
        x: cx + (i - (lit - 1) / 2) * bw * 0.3 + (rand() - 0.5) * bw * 0.08,
        y: baseY - bh * (0.35 + rand() * 0.25),
        glow: rand() < 0.4,
      });
    }
  };

  // back row — fog-stop haze, unlit
  const hazy = mix(C.void, C.surface, 0.5);
  for (const off of [-0.2, -0.11, 0.07, 0.17] as const) {
    const cx = w * 0.5 + s * (off + (rand() - 0.5) * 0.015);
    house(cx, s * (0.055 + rand() * 0.02), s * (0.03 + rand() * 0.015), s * (0.035 + rand() * 0.015), {
      fill: hazy,
    });
  }

  // front row — darkest cutouts, candle-lit, varied heights
  const dark = shade(C.void, 0.9);
  const frontRow: Array<{ off: number; lit: number; tall: number }> = [
    { off: -0.235, lit: 3, tall: 0.9 },
    { off: -0.145, lit: 2, tall: 1.25 },
    { off: 0.1, lit: 2, tall: 1.1 },
    { off: 0.185, lit: 3, tall: 0.85 },
    { off: 0.265, lit: 2, tall: 1.15 },
  ];
  for (const spec of frontRow) {
    const cx = w * 0.5 + s * spec.off;
    house(
      cx,
      s * (0.06 + rand() * 0.025),
      s * (0.036 + rand() * 0.018) * spec.tall,
      s * (0.045 + rand() * 0.02),
      { fill: dark, outlined: true, lit: spec.lit, chimney: rand() < 0.75 },
    );
  }

  // the chapel — nave + tower + spire + finial cross, slightly left of center
  const chx = w * 0.5 - s * 0.035;
  house(chx, s * 0.055, s * 0.05, s * 0.05, { fill: dark, outlined: true, lit: 2 });
  const tx = chx + s * 0.042;
  const tw = s * 0.028;
  const th = s * 0.082;
  const spireH = s * 0.13;
  const tBase = crestY(tx) + s * 0.008;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(tx - tw / 2, tBase);
  ctx.lineTo(tx - tw / 2, tBase - th);
  ctx.lineTo(tx - tw * 0.72, tBase - th); // spire eave
  ctx.lineTo(tx, tBase - th - spireH);
  ctx.lineTo(tx + tw * 0.72, tBase - th);
  ctx.lineTo(tx + tw / 2, tBase - th);
  ctx.lineTo(tx + tw / 2, tBase);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.stroke();
  const tipY = tBase - th - spireH;
  ctx.strokeStyle = shade(C.void, 0.95);
  ctx.lineWidth = 1.2;
  line(tx, tipY, tx, tipY - s * 0.014);
  line(tx - s * 0.006, tipY - s * 0.009, tx + s * 0.006, tipY - s * 0.009);
  windows.push({ x: tx, y: tBase - th * 0.55, glow: true }); // the lancet

  // ── 16. hearth-smoke drifting leeward from a few chimneys ───────────────
  let smoked = 0;
  for (const ch of chimneys) {
    if (smoked >= 3 || rand() < 0.3) continue;
    smoked++;
    // little puffs, rising and drifting leeward, thinning as they climb
    let sx = ch.x;
    let sy = ch.y - 2;
    for (let k = 0; k < 4; k++) {
      const pr = s * (0.0035 + k * 0.0022) * (0.8 + rand() * 0.4);
      ctx.fillStyle = mix(C.void, C.bone, 0.4, 0.14 - k * 0.028);
      ctx.beginPath();
      ctx.ellipse(sx, sy, pr * (1.1 + rand() * 0.4), pr, rand() * 0.8 - 0.4, 0, TAU);
      ctx.fill();
      sx -= s * (0.006 + rand() * 0.006 + k * 0.003);
      sy -= s * (0.009 + rand() * 0.004);
    }
  }

  // ── 17. candle-lit windows — the warm half of the color story ────────────
  const ww = Math.max(1.4, s * 0.0055);
  for (const spot of windows) {
    if (spot.glow) {
      const g = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, ww * 6);
      g.addColorStop(0, shade(C.flame, 1, 0.16));
      g.addColorStop(1, shade(C.flame, 1, 0));
      ctx.fillStyle = g;
      ctx.fillRect(spot.x - ww * 6, spot.y - ww * 6, ww * 12, ww * 12);
    }
    ctx.fillStyle = mix(C.flame, C.flameHi, rand() * 0.8);
    ctx.fillRect(spot.x - ww / 2, spot.y - ww * 0.9, ww, ww * 1.8);
  }
  // a soft communal hearth-glow hanging over the rooftops
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const townGlow = ctx.createRadialGradient(gx, crestY(gx) - s * 0.02, 0, gx, crestY(gx) - s * 0.02, s * 0.28);
  townGlow.addColorStop(0, shade(C.ember, 0.8, 0.07));
  townGlow.addColorStop(1, shade(C.ember, 0.8, 0));
  ctx.fillStyle = townGlow;
  ctx.fillRect(gx - s * 0.3, crestY(gx) - s * 0.3, s * 0.6, s * 0.6);
  ctx.restore();

  // ── 18. foreground rocks — darkest cutouts framing the bottom corners ───
  const fgC = shade(C.void, 0.42);
  const rockMass = (side: -1 | 1): void => {
    const edge = side === -1 ? 0 : w;
    const inward = side === -1 ? 1 : -1; // toward frame center
    ctx.fillStyle = fgC;
    ctx.beginPath();
    ctx.moveTo(edge, h);
    ctx.lineTo(edge, h * 0.7);
    let t = 0;
    while (t < 1) {
      const nt = Math.min(t + 0.16 + rand() * 0.14, 1);
      const rxp = edge + inward * w * 0.26 * nt;
      const ryp = h * (0.72 + nt * 0.26 + (rand() - 0.5) * 0.05);
      ctx.lineTo(rxp, Math.min(ryp, h));
      t = nt;
    }
    ctx.lineTo(edge + inward * w * 0.3, h);
    ctx.closePath();
    ctx.fill();
    // one gnarled root reaching inward
    ctx.strokeStyle = fgC;
    ctx.lineWidth = Math.max(2, s * 0.005);
    ctx.beginPath();
    ctx.moveTo(edge, h * 0.86);
    ctx.quadraticCurveTo(edge + inward * w * 0.12, h * (0.8 + rand() * 0.04), edge + inward * w * 0.2, h * 0.94);
    ctx.stroke();
  };
  rockMass(-1);
  rockMass(1);

  // ── 19. crush and vignette — settle the frame, calm the caption zone ────
  const crush = ctx.createLinearGradient(0, h * 0.76, 0, h);
  crush.addColorStop(0, shade(C.void, 0.55, 0));
  crush.addColorStop(0.55, shade(C.void, 0.55, 0.4));
  crush.addColorStop(1, shade(C.void, 0.55, 0.8));
  ctx.fillStyle = crush;
  ctx.fillRect(0, h * 0.76, w, h * 0.24);
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.16);
  top.addColorStop(0, shade(C.void, 0.75, 0.7));
  top.addColorStop(1, shade(C.void, 0.75, 0));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h * 0.16);
  const vr = s * 0.6;
  for (const [vx, vy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    const v = ctx.createRadialGradient(vx, vy, vr * 0.3, vx, vy, vr);
    v.addColorStop(0, shade(C.void, 0.5, 0.28));
    v.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}
