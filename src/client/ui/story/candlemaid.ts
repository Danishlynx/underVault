/**
 * Story slide 4 — "The Candlemaid went down."
 * The hero still of the intro cinematic: a lone robed figure, small against
 * the towering half-open Great Gate, holding aloft the First Flame. Painted
 * in the guildhall idiom — flat woodcut masses, fog-stop depth, one warm
 * amber, one verdigris, no speckle. Pure 2D canvas; the caller has already
 * DPR-scaled and cleared the context.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall pattern) — never Math.random, never paint.ts crand():
// that stream is shared with the world-texture painters.
function slideRand(seed: number): () => number {
  let s = seed >>> 0 || 0xc41d;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintCandlemaid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = slideRand(0xc41d1e);
  const inkLine = shade(C.void, 0.7, 0.9);

  // ── geometry ─────────────────────────────────────────────────────────────
  const cx = w / 2;
  const R = Math.min(Math.min(w, h) * 0.52, w * 0.44, h * 0.38); // gate radius
  const gateCy = h * 0.4;
  const floorY = gateCy + R * 0.98; // threshold she stands on
  const g = R * 0.13; // half-width of the parted seam
  const fh = R * 0.44; // figure height — small against the door
  const fx = cx;
  const fy = floorY;
  const shoulderY = fy - fh * 0.72;
  const hemW = fh * 0.4;
  const shW = fh * 0.15;
  const headR = fh * 0.075;
  const headCy = fy - fh * 0.86;
  const handX = fx + fh * 0.24;
  const handY = fy - fh * 1.0;
  const flameX = handX + fh * 0.01;
  const flameBaseY = handY - fh * 0.06;
  const flameCy = flameBaseY - fh * 0.15;
  const stepH = Math.max(6, h * 0.03);

  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  const ring = (r: number, lw: number, color: string): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, gateCy, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  /** Flame teardrop: round base, tapered tip with a slight lean. */
  const drop = (x: number, baseY: number, hgt: number, wdt: number, lean: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + lean, baseY - hgt);
    ctx.quadraticCurveTo(x + wdt, baseY - hgt * 0.38, x + wdt * 0.62, baseY - wdt * 0.55);
    ctx.arc(x, baseY - wdt * 0.55, wdt * 0.62, 0, Math.PI);
    ctx.quadraticCurveTo(x - wdt, baseY - hgt * 0.38, x + lean, baseY - hgt);
    ctx.closePath();
    ctx.fill();
  };

  // ── 1. base void gradient ────────────────────────────────────────────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, C.void);
  base.addColorStop(0.35, mix(C.void, C.surface, 0.4));
  base.addColorStop(0.62, mix(C.void, C.surface2, 0.45));
  base.addColorStop(0.8, shade(C.void, 0.95));
  base.addColorStop(1, shade(C.void, 0.8));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. the wall the gate is set in — fog stop 1, flat masonry ───────────
  ctx.fillStyle = mix(C.void, C.surface, 0.28);
  ctx.fillRect(0, 0, w, floorY);
  ctx.lineWidth = 1;
  let courseY = floorY - R * 0.08;
  let prevY = floorY;
  while (courseY > h * 0.04) {
    ctx.strokeStyle = shade(C.surface2, 1.15, 0.07);
    line(0, courseY, w, courseY);
    // staggered vertical joints, faint
    ctx.strokeStyle = shade(C.surface2, 1.1, 0.05);
    const joints = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < joints; j++) {
      const jx = rand() * w;
      line(jx, courseY, jx, prevY);
    }
    prevY = courseY;
    courseY -= R * 0.16 * (0.85 + rand() * 0.3);
  }

  // ── 3. carved stone surround ─────────────────────────────────────────────
  ring(R * 1.08, R * 0.05, mix(C.void, C.surface2, 0.85));
  ring(R * 1.115, 1.2, shade(C.void, 0.75, 0.8));
  ring(R * 1.045, 1, shade(C.surface2, 1.25, 0.35));
  // glyph ticks along the upper arc — every fifth catches a whisper of gilt
  for (let i = 0; i < 24; i++) {
    const a = -Math.PI + 0.32 + (i / 23) * (Math.PI - 0.64) + (rand() - 0.5) * 0.02;
    const r0 = R * 1.125;
    const r1 = r0 + R * 0.03 + rand() * R * 0.012;
    ctx.strokeStyle = i % 5 === 0 ? shade(C.goldInk, 0.9, 0.32) : shade(C.boneDim, 0.9, 0.22);
    ctx.lineWidth = 1;
    line(cx + Math.cos(a) * r0, gateCy + Math.sin(a) * r0, cx + Math.cos(a) * r1, gateCy + Math.sin(a) * r1);
  }

  // ── 4. threshold floor and shallow steps ─────────────────────────────────
  const floorG = ctx.createLinearGradient(0, floorY, 0, h);
  floorG.addColorStop(0, mix(C.void, C.surface2, 0.5));
  floorG.addColorStop(0.35, mix(C.void, C.surface, 0.3));
  floorG.addColorStop(1, shade(C.void, 0.75));
  ctx.fillStyle = floorG;
  ctx.fillRect(0, floorY, w, h - floorY);
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = shade(C.surface2, 1.2, 0.22 - i * 0.08);
    ctx.lineWidth = 1;
    line(0, floorY + stepH * (i + 1), w, floorY + stepH * (i + 1));
  }
  // receding flag joints — very faint, they die out toward the caption zone
  ctx.strokeStyle = shade(C.surface2, 1.1, 0.06);
  for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7;
    const xTop = cx + (t - 0.5) * w * 0.6 * (0.85 + rand() * 0.3);
    const xBot = cx + (t - 0.5) * w * 1.6;
    line(xTop, floorY + stepH * 2, xBot, h);
  }

  // ── 5. THE GREAT GATE — the disc, warm-kissed low where her flame is ────
  const disc = ctx.createRadialGradient(flameX, flameCy, R * 0.05, cx, gateCy, R);
  disc.addColorStop(0, mix(C.surface2, C.ember, 0.18));
  disc.addColorStop(0.4, mix(C.surface, C.surface2, 0.6));
  disc.addColorStop(1, mix(C.void, C.surface, 0.55));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, gateCy, R, 0, Math.PI * 2);
  ctx.fill();
  ring(R - 2, 2, shade(C.surface2, 1.35, 0.8));
  ring(R - 9, 1, shade(C.surface2, 1.35, 0.4));
  ring(R * 0.68, 1, shade(C.surface2, 1.35, 0.4));
  ring(R * 0.4, 1, shade(C.surface2, 1.35, 0.3));
  // ridge spokes + rivets; rivets near her flame catch a warm fleck
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + (rand() - 0.5) * 0.03;
    ctx.strokeStyle = shade(C.surface2, 0.8, 0.35);
    ctx.lineWidth = 1;
    line(
      cx + Math.cos(a) * R * 0.7,
      gateCy + Math.sin(a) * R * 0.7,
      cx + Math.cos(a) * (R - 9),
      gateCy + Math.sin(a) * (R - 9),
    );
    const rx = cx + Math.cos(a + 0.12) * R * 0.85;
    const ry = gateCy + Math.sin(a + 0.12) * R * 0.85;
    ctx.fillStyle = shade(C.surface2, 1.5);
    ctx.beginPath();
    ctx.arc(rx, ry, 2 + rand(), 0, Math.PI * 2);
    ctx.fill();
    if (Math.hypot(rx - flameX, ry - flameCy) < R * 0.85) {
      ctx.fillStyle = mix(C.flame, C.goldInk, 0.4, 0.4);
      ctx.beginPath();
      ctx.arc(rx - 0.5, ry - 0.5, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // the parted central emblem — a gold ring the opening has split in two
  ctx.strokeStyle = mix(C.goldInk, C.void, 0.25, 0.4);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, gateCy, R * 0.22, 0, Math.PI * 2);
  ctx.stroke();

  // ── 6. her light on the door (before the seam is cut — no light beyond) ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const doorGlow = ctx.createRadialGradient(flameX, flameCy, 0, flameX, flameCy, R * 1.05);
  doorGlow.addColorStop(0, shade(C.flame, 0.55, 0.3));
  doorGlow.addColorStop(0.35, shade(C.ember, 0.55, 0.14));
  doorGlow.addColorStop(1, shade(C.ember, 0.5, 0));
  ctx.fillStyle = doorGlow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // ── 7. the seam — half-open, pure dark beyond ────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, gateCy, R, 0, Math.PI * 2);
  ctx.clip();
  const gapG = ctx.createLinearGradient(cx - g, 0, cx + g, 0);
  gapG.addColorStop(0, shade(C.void, 0.55));
  gapG.addColorStop(0.5, shade(C.void, 0.4));
  gapG.addColorStop(1, shade(C.void, 0.55));
  ctx.fillStyle = gapG;
  ctx.fillRect(cx - g, gateCy - R, g * 2, R * 2);
  // leaf inner edges: dark cut + a breath of verdigris patina
  const chord = Math.sqrt(R * R - g * g);
  for (const sx of [-1, 1]) {
    const ex = cx + sx * g;
    ctx.strokeStyle = inkLine;
    ctx.lineWidth = 2;
    line(ex + sx, gateCy - chord, ex + sx, gateCy + chord);
    ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.4, 0.28);
    ctx.lineWidth = 1;
    line(ex, gateCy - chord * 0.96, ex, gateCy + chord * 0.96);
    // patina drips down the leaf faces beside the seam
    ctx.strokeStyle = shade(C.verdigrisDim, 1, 0.12);
    for (let i = 0; i < 3; i++) {
      const dx = ex + sx * (3 + rand() * g * 0.5);
      const dy = gateCy - chord * 0.6 + rand() * chord;
      line(dx, dy, dx, dy + R * (0.05 + rand() * 0.07));
    }
  }
  ctx.restore();

  // ── 8. two faint eye-glints, deep in the dark ────────────────────────────
  const eyeCx = cx + g * 0.18;
  const eyeCy = gateCy - R * 0.24;
  const sep = Math.max(5, g * 0.42);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const eyeHaze = ctx.createRadialGradient(eyeCx, eyeCy, 0, eyeCx, eyeCy, g * 1.1);
  eyeHaze.addColorStop(0, shade(C.verdigrisDim, 0.9, 0.1));
  eyeHaze.addColorStop(1, shade(C.verdigrisDim, 0.9, 0));
  ctx.fillStyle = eyeHaze;
  ctx.fillRect(eyeCx - g * 1.2, eyeCy - g * 1.2, g * 2.4, g * 2.4);
  ctx.restore();
  for (const [ex, ey] of [
    [eyeCx - sep / 2, eyeCy + 1],
    [eyeCx + sep / 2, eyeCy],
  ] as const) {
    ctx.fillStyle = mix(C.verdigris, C.verdigrisDim, 0.3, 0.65);
    ctx.beginPath();
    ctx.ellipse(ex, ey, 2.1, 1.3, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.verdigris, 1.35, 0.85);
    ctx.beginPath();
    ctx.arc(ex + 0.4, ey - 0.2, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 9. threshold mist, hugging the gate's foot behind her ────────────────
  const fog = ctx.createLinearGradient(0, floorY - R * 0.2, 0, floorY + stepH);
  fog.addColorStop(0, mix(C.void, C.bone, 0.12, 0));
  fog.addColorStop(0.55, mix(C.void, C.bone, 0.12, 0.22));
  fog.addColorStop(1, mix(C.void, C.bone, 0.12, 0));
  ctx.fillStyle = fog;
  ctx.fillRect(0, floorY - R * 0.2, w, R * 0.2 + stepH);

  // two guttering candle stubs at the gate's foot — scale for the First Flame
  for (const [sx, so] of [
    [cx - R * 0.78, 0],
    [cx + R * 0.84, 2],
  ] as const) {
    const sy = floorY - 2 - so;
    ctx.fillStyle = mix(C.bone, C.void, 0.55, 0.8);
    ctx.fillRect(sx - 1, sy - 4, 2.5, 4);
    ctx.fillStyle = shade(C.flame, 1, 0.75);
    ctx.beginPath();
    ctx.arc(sx + 0.2, sy - 5.5, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(C.flameHi, 1, 0.7);
    ctx.fillRect(sx - 0.2, sy - 6, 0.8, 1.2);
  }

  // ── 10. warm pool at her feet, then the long shadow toward the viewer ────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(fx, floorY + stepH * 0.8);
  ctx.scale(1, 0.32);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, fh * 1.6);
  pool.addColorStop(0, shade(C.flame, 0.5, 0.2));
  pool.addColorStop(0.5, shade(C.ember, 0.45, 0.08));
  pool.addColorStop(1, shade(C.ember, 0.45, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-fh * 1.7, -fh * 1.7, fh * 3.4, fh * 3.4);
  ctx.restore();
  const shadowG = ctx.createLinearGradient(0, fy, 0, h);
  shadowG.addColorStop(0, shade(C.void, 0.5, 0.7));
  shadowG.addColorStop(1, shade(C.void, 0.6, 0.16));
  ctx.fillStyle = shadowG;
  ctx.beginPath();
  ctx.moveTo(fx - fh * 0.24, fy + 1);
  ctx.lineTo(fx + fh * 0.24, fy + 1);
  ctx.lineTo(fx + w * 0.19, h);
  ctx.lineTo(fx - w * 0.19, h);
  ctx.closePath();
  ctx.fill();

  // ── 11. THE CANDLEMAID — back to us, hood down, framed by the dark seam ──
  const robe = (): void => {
    ctx.beginPath();
    ctx.moveTo(fx - hemW / 2, fy);
    ctx.bezierCurveTo(fx - hemW * 0.42, fy - fh * 0.3, fx - shW * 1.3, fy - fh * 0.55, fx - shW, shoulderY);
    ctx.quadraticCurveTo(fx - shW * 0.6, shoulderY - fh * 0.06, fx, shoulderY - fh * 0.075);
    ctx.quadraticCurveTo(fx + shW * 0.6, shoulderY - fh * 0.06, fx + shW, shoulderY);
    ctx.bezierCurveTo(fx + shW * 1.3, fy - fh * 0.55, fx + hemW * 0.42, fy - fh * 0.3, fx + hemW / 2, fy);
    ctx.closePath();
  };
  const robeG = ctx.createLinearGradient(0, shoulderY - fh * 0.1, 0, fy);
  robeG.addColorStop(0, mix(C.parchment, C.flame, 0.3));
  robeG.addColorStop(0.35, C.parchmentAged);
  robeG.addColorStop(0.75, mix(C.bone, C.void, 0.45));
  robeG.addColorStop(1, mix(C.boneDim, C.void, 0.6));
  robe();
  ctx.fillStyle = robeG;
  ctx.fill();
  ctx.strokeStyle = inkLine; // woodcut cut-line first…
  ctx.lineWidth = 2;
  ctx.stroke();
  robe();
  ctx.strokeStyle = mix(C.goldInk, C.void, 0.15, 0.55); // …gilt thread inside it
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // gold hem band + center-back seam below where the braid ends
  ctx.strokeStyle = mix(C.goldInk, C.void, 0.15, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fx - hemW / 2 + 2, fy - fh * 0.05);
  ctx.quadraticCurveTo(fx, fy - fh * 0.11, fx + hemW / 2 - 2, fy - fh * 0.05);
  ctx.stroke();
  ctx.strokeStyle = mix(C.goldInk, C.void, 0.3, 0.35);
  line(fx, fy - fh * 0.32, fx, fy - fh * 0.13);
  // warm rim-light on her flame side
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.35, 0.45);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(fx + shW, shoulderY);
  ctx.bezierCurveTo(fx + shW * 1.3, fy - fh * 0.55, fx + hemW * 0.4, fy - fh * 0.32, fx + hemW * 0.46, fy - fh * 0.18);
  ctx.stroke();

  // raised arm — sleeve up to the lantern hand
  ctx.beginPath();
  ctx.moveTo(fx + shW * 0.35, shoulderY + fh * 0.03);
  ctx.quadraticCurveTo(fx + fh * 0.1, fy - fh * 0.88, handX - fh * 0.035, handY + fh * 0.02);
  ctx.lineTo(handX + fh * 0.035, handY + fh * 0.06);
  ctx.quadraticCurveTo(fx + fh * 0.16, fy - fh * 0.78, fx + shW * 1.15, shoulderY + fh * 0.12);
  ctx.closePath();
  ctx.fillStyle = mix(C.parchmentAged, C.flame, 0.22);
  ctx.fill();
  ctx.strokeStyle = inkLine;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // hand
  ctx.fillStyle = mix(C.parchment, C.flame, 0.3);
  ctx.beginPath();
  ctx.arc(handX, handY, fh * 0.032, 0, Math.PI * 2);
  ctx.fill();

  // head (hood down) with a warm crown from her own light
  ctx.fillStyle = mix(C.ink, C.void, 0.25);
  ctx.beginPath();
  ctx.arc(fx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = inkLine;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(fx, headCy, headR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = mix(C.ember, C.flame, 0.5, 0.5);
  ctx.beginPath();
  ctx.arc(fx + headR * 0.45, headCy - headR * 0.3, headR * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // the long braid down her back
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = mix(C.ink, C.void, 0.35);
  ctx.lineWidth = Math.max(2, fh * 0.05);
  ctx.beginPath();
  ctx.moveTo(fx + fh * 0.005, headCy + headR * 0.6);
  ctx.bezierCurveTo(fx - fh * 0.03, fy - fh * 0.55, fx + fh * 0.03, fy - fh * 0.45, fx - fh * 0.01, fy - fh * 0.34);
  ctx.stroke();
  ctx.strokeStyle = shade(C.inkSoft, 1.2, 0.5);
  ctx.lineWidth = 1;
  for (const t of [0.3, 0.5, 0.7] as const) {
    const by = headCy + headR * 0.6 + (fy - fh * 0.34 - (headCy + headR * 0.6)) * t;
    line(fx - fh * 0.03, by, fx + fh * 0.025, by - fh * 0.015);
  }
  ctx.restore();
  ctx.fillStyle = mix(C.goldInk, C.void, 0.2, 0.85); // braid tie
  ctx.fillRect(fx - fh * 0.022, fy - fh * 0.35, fh * 0.038, fh * 0.022);

  // ── 12. the lantern and the FIRST FLAME ──────────────────────────────────
  const lanX = handX;
  const lanBaseY = handY - fh * 0.03;
  const cw = fh * 0.06;
  const cageH = fh * 0.17;
  ctx.strokeStyle = mix(C.ink, C.void, 0.3);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(lanX - cw, lanBaseY);
  ctx.quadraticCurveTo(lanX - cw * 1.1, lanBaseY - cageH * 0.6, lanX, lanBaseY - cageH);
  ctx.moveTo(lanX + cw, lanBaseY);
  ctx.quadraticCurveTo(lanX + cw * 1.1, lanBaseY - cageH * 0.6, lanX, lanBaseY - cageH);
  ctx.stroke();
  ctx.lineWidth = 2;
  line(lanX - cw, lanBaseY, lanX + cw, lanBaseY);
  ctx.fillStyle = mix(C.goldInk, C.void, 0.15, 0.8); // finial
  ctx.save();
  ctx.translate(lanX, lanBaseY - cageH - 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-1.8, -1.8, 3.6, 3.6);
  ctx.restore();
  // halo, then the flame itself — larger and whiter than any other flame
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(flameX, flameCy, 0, flameX, flameCy, fh * 0.55);
  halo.addColorStop(0, shade(C.flameHi, 0.8, 0.32));
  halo.addColorStop(1, shade(C.flameHi, 0.8, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(flameX - fh * 0.6, flameCy - fh * 0.6, fh * 1.2, fh * 1.2);
  ctx.restore();
  drop(flameX, flameBaseY, fh * 0.34, fh * 0.085, fh * 0.02, shade(C.flame, 1, 0.9));
  drop(flameX, flameBaseY - fh * 0.01, fh * 0.24, fh * 0.055, fh * 0.012, C.flameHi);
  drop(flameX, flameBaseY - fh * 0.02, fh * 0.14, fh * 0.03, 0, shade(C.flameHi, 1.6));

  // ── 13. near flank pillars — fog stop 3, darkest cutouts ─────────────────
  const pw = w * 0.09;
  ctx.fillStyle = shade(C.void, 0.55);
  ctx.fillRect(0, 0, pw, h);
  ctx.fillRect(w - pw, 0, pw, h);
  for (const px of [pw, w - pw] as const) {
    const dir = px < cx ? 1 : -1;
    ctx.fillStyle = shade(C.void, 0.55);
    ctx.beginPath();
    ctx.moveTo(px, h * 0.26);
    ctx.lineTo(px + dir * 12, h * 0.28);
    ctx.lineTo(px + dir * 12, h * 0.31);
    ctx.lineTo(px, h * 0.33);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(C.void, 0.8, 0.6);
    ctx.lineWidth = 1;
    line(px + dir * 0.5, 0, px + dir * 0.5, h);
  }

  // ── 14. crush and vignette — settle the frame, calm the caption zone ────
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.2);
  crush.addColorStop(0, shade(C.void, 0.65, 0.85));
  crush.addColorStop(1, shade(C.void, 0.65, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.2);
  const settle = ctx.createLinearGradient(0, h * 0.78, 0, h);
  settle.addColorStop(0, shade(C.void, 0.6, 0));
  settle.addColorStop(1, shade(C.void, 0.6, 0.55));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  const vr = Math.min(w, h) * 0.55;
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
}
