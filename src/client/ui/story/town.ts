/**
 * Story slide 1 — "There was a town above a door."
 *
 * A huddled hilltop town at dusk in the guildhall's painted-woodcut idiom:
 * flat confident silhouette masses, fog-stop depth, no speckle. A dozen-odd
 * candle-lit windows are the only warmth in the frame. Below the hill,
 * exposed like a geological cross-section, the colossal circular outline of
 * the Great Gate sleeps in the earth — surface2 rings barely lighter than
 * void, dwarfing everything above it. The center-bottom third stays calm and
 * dark: caption text renders over it. Colors via tokens + shade()/mix() only;
 * all jitter through a private seeded LCG (never Math.random, never crand).
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

  // The hill crest — the ground line of the cross-section. Gaussian bump so
  // the town sits centered on a mound at any aspect ratio.
  const crestY = (x: number): number => {
    const t = x / w - 0.5;
    return h * 0.535 - h * 0.135 * Math.exp(-(t * t) / (2 * 0.2 * 0.2));
  };

  // 1. dusk sky — void deepening into a cool surface2 band at the horizon
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, C.void);
  sky.addColorStop(0.28, mix(C.void, C.surface, 0.5));
  sky.addColorStop(0.46, mix(C.void, C.surface2, 0.75));
  sky.addColorStop(0.56, mix(C.void, C.surface, 0.4));
  sky.addColorStop(1, shade(C.void, 0.85));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 2. thin pale bone moon — disc carved to a crescent by refilling with the
  // sky's own gradient (canvas-absolute stops, so the carve matches exactly)
  const mx = w * 0.745;
  const my = h * 0.125;
  const mr = s * 0.046;
  ctx.fillStyle = mix(C.bone, C.parchment, 0.35);
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = sky;
  ctx.beginPath();
  ctx.arc(mx + mr * 0.38, my - mr * 0.16, mr * 0.92, 0, TAU);
  ctx.fill();
  const moonHalo = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.6);
  moonHalo.addColorStop(0, mix(C.void, C.bone, 0.35, 0.1));
  moonHalo.addColorStop(1, mix(C.void, C.bone, 0.35, 0));
  ctx.fillStyle = moonHalo;
  ctx.fillRect(mx - mr * 3.6, my - mr * 3.6, mr * 7.2, mr * 7.2);

  // 3. far ridge — fog stop 1, a hazy flat land-mass behind the hill flanks
  ctx.fillStyle = mix(C.void, C.surface, 0.6);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.478);
  let rx = 0;
  while (rx < w) {
    const nx = Math.min(rx + w * (0.1 + rand() * 0.12), w);
    const ny = h * (0.465 + rand() * 0.03);
    ctx.quadraticCurveTo((rx + nx) / 2, ny - h * 0.012, nx, ny);
    rx = nx;
  }
  ctx.lineTo(w, h * 0.62);
  ctx.lineTo(0, h * 0.62);
  ctx.closePath();
  ctx.fill();

  // 4. fog band settling in the valley
  const fog = ctx.createLinearGradient(0, h * 0.45, 0, h * 0.57);
  fog.addColorStop(0, mix(C.void, C.bone, 0.1, 0));
  fog.addColorStop(0.5, mix(C.void, C.bone, 0.1, 0.5));
  fog.addColorStop(1, mix(C.void, C.bone, 0.1, 0));
  ctx.fillStyle = fog;
  ctx.fillRect(0, h * 0.45, w, h * 0.12);

  // 5. the hill / earth mass — one dark cut, sampled with hand-cut jitter
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
  ctx.fillStyle = mix(C.void, C.surface, 0.26);
  ctx.fill();

  // 6. the cutaway underworld — clipped to below the crest
  ctx.save();
  earthPath();
  ctx.clip();

  // depth falloff — earth crushes toward void
  const depth = ctx.createLinearGradient(0, h * 0.4, 0, h);
  depth.addColorStop(0, shade(C.void, 0.75, 0));
  depth.addColorStop(1, shade(C.void, 0.75, 0.55));
  ctx.fillStyle = depth;
  ctx.fillRect(0, h * 0.4, w, h * 0.6);

  // faint strata — a geologist's section, gently bowed
  for (let i = 0; i < 4; i++) {
    const y0 = h * (0.585 + i * 0.085) + (rand() - 0.5) * s * 0.01;
    ctx.strokeStyle = mix(C.void, C.surface2, 0.85, 0.16 - i * 0.025);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(
      w * (0.3 + rand() * 0.4),
      y0 + s * (0.01 + rand() * 0.02),
      w,
      y0 + (rand() - 0.5) * s * 0.02,
    );
    ctx.stroke();
  }

  // THE GREAT GATE — buried colossus, barely lighter than void
  const gx = w * 0.5;
  const gy = h * 1.08;
  const gr = h * 0.58;
  // soft rim presence under the outer ring
  const rim = ctx.createRadialGradient(gx, gy, gr * 0.55, gx, gy, gr);
  rim.addColorStop(0, mix(C.void, C.surface2, 0.7, 0));
  rim.addColorStop(0.9, mix(C.void, C.surface2, 0.7, 0.1));
  rim.addColorStop(1, mix(C.void, C.surface2, 0.7, 0));
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(gx, gy, gr, 0, TAU);
  ctx.fill();
  // concentric rings
  const ring = (r: number, lw: number, a: number): void => {
    ctx.strokeStyle = mix(C.void, C.surface2, 0.9, a);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, TAU);
    ctx.stroke();
  };
  ring(gr, 2.5, 0.5);
  ring(gr - s * 0.02, 1, 0.28);
  ring(gr * 0.82, 1.5, 0.34);
  ring(gr * 0.6, 1, 0.24);
  ring(gr * 0.38, 1, 0.18);
  // ridge spokes across the outer band, fanned around the visible crown
  ctx.strokeStyle = mix(C.void, C.surface2, 0.8, 0.14);
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.26;
    ctx.beginPath();
    ctx.moveTo(gx + Math.cos(a) * gr * 0.82, gy + Math.sin(a) * gr * 0.82);
    ctx.lineTo(gx + Math.cos(a) * (gr - s * 0.02), gy + Math.sin(a) * (gr - s * 0.02));
    ctx.stroke();
  }
  // rivets along the crown
  ctx.fillStyle = mix(C.void, C.surface2, 1, 0.25);
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI / 2 + (i - 5) * 0.24 + 0.12;
    ctx.beginPath();
    ctx.arc(gx + Math.cos(a) * gr * 0.91, gy + Math.sin(a) * gr * 0.91, 1.4, 0, TAU);
    ctx.fill();
  }
  // the seam, sleeping — a verdigris whisper on the crown only, fading out
  // well above the caption zone
  const gateTop = gy - gr;
  const seam = ctx.createLinearGradient(0, gateTop + s * 0.01, 0, h * 0.64);
  seam.addColorStop(0, mix(C.void, C.verdigrisDim, 0.7, 0));
  seam.addColorStop(0.35, mix(C.void, C.verdigrisDim, 0.7, 0.28));
  seam.addColorStop(1, mix(C.void, C.verdigrisDim, 0.7, 0));
  ctx.strokeStyle = seam;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(gx, gateTop + s * 0.01);
  ctx.lineTo(gx, h * 0.64);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();

  // 7. the cut of the cross-section — turf rim over an ink line
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

  // 8. the town — huddled silhouettes; front row collects lit-window spots
  const windows: Array<{ x: number; y: number; glow: boolean }> = [];
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
      ctx.fillRect(
        cx + bw * (rand() < 0.5 ? -0.3 : 0.26),
        baseY - bh - roofH * 0.55,
        Math.max(2, bw * 0.09),
        roofH * 0.4,
      );
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

  // back row — fog stop 2, hazier and unlit
  const hazy = mix(C.void, C.surface, 0.5);
  for (const off of [-0.2, -0.11, 0.07, 0.17]) {
    const cx = w * 0.5 + s * (off + (rand() - 0.5) * 0.015);
    house(cx, s * (0.055 + rand() * 0.02), s * (0.03 + rand() * 0.015), s * (0.035 + rand() * 0.015), {
      fill: hazy,
    });
  }

  // front row — darkest cutouts, candle-lit (12–18 windows total; this
  // arrangement yields 15: 3+2+2+3+2 houses + 2 nave + 1 lancet)
  const dark = shade(C.void, 0.9);
  const frontRow: Array<{ off: number; lit: number }> = [
    { off: -0.23, lit: 3 },
    { off: -0.14, lit: 2 },
    { off: 0.1, lit: 2 },
    { off: 0.185, lit: 3 },
    { off: 0.26, lit: 2 },
  ];
  for (const spec of frontRow) {
    const cx = w * 0.5 + s * spec.off;
    house(cx, s * (0.062 + rand() * 0.025), s * (0.038 + rand() * 0.02), s * (0.045 + rand() * 0.02), {
      fill: dark,
      outlined: true,
      lit: spec.lit,
      chimney: rand() < 0.6,
    });
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
  ctx.beginPath();
  ctx.moveTo(tx, tipY);
  ctx.lineTo(tx, tipY - s * 0.014);
  ctx.moveTo(tx - s * 0.006, tipY - s * 0.009);
  ctx.lineTo(tx + s * 0.006, tipY - s * 0.009);
  ctx.stroke();
  windows.push({ x: tx, y: tBase - th * 0.55, glow: true }); // the lancet

  // 9. candle-lit windows — the only warmth in the frame
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

  // 10. bottom crush — calm dark ground for the caption
  const crush = ctx.createLinearGradient(0, h * 0.62, 0, h);
  crush.addColorStop(0, shade(C.void, 0.6, 0));
  crush.addColorStop(0.55, shade(C.void, 0.6, 0.35));
  crush.addColorStop(1, shade(C.void, 0.6, 0.7));
  ctx.fillStyle = crush;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  // 11. top crush
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.16);
  top.addColorStop(0, shade(C.void, 0.75, 0.7));
  top.addColorStop(1, shade(C.void, 0.75, 0));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h * 0.16);
}
