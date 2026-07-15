/**
 * Story slide 4 — "The Candlemaid went down."
 * The Great Gate's two colossal leaves are almost shut — stone teeth meshing,
 * bolts sliding home, the hub seal split where she passed. Through the last
 * thin seam of warm light: broad steps dropping away into black, and the
 * Candlemaid small upon them, back turned, mid-step, her First Flame held
 * high on a lantern-staff. Votives left by the waiting gutter at the door's
 * foot; footprints stop at the threshold. Three fog-stop planes: framing arch
 * and pillars, the detailed door, the deep dark beyond (where eyes watch).
 * Pure 2D canvas; the caller has already DPR-scaled and cleared the context.
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
  const R = Math.min(w * 0.38, h * 0.325); // gate radius
  const floorY = h * 0.7; // threshold — door base meets our floor
  const gateCy = floorY - R * 0.98;
  const g = Math.max(12, R * 0.115); // seam half-width (thin — nearly shut)
  const chord = Math.sqrt(R * R - g * g);
  const seamTop = gateCy - chord;
  // stair treads beyond the threshold: each deeper step compresses upward
  // (looking down the well) while her light dies with depth
  const d0 = R * 0.058;
  const yF = floorY - (d0 + d0 * 0.82); // her trailing foot's tread
  const yLead = yF - d0 * 0.82 * 0.82; // the next tread down, mid-step
  const fh = R * 0.6; // figure height
  const fx = cx - g * 0.08;
  const staffX = cx + fh * 0.15;
  const yHand = yF - fh * 0.66;
  const flameBaseY = yF - fh * 1.18;
  const flameH = fh * 0.26;
  const flameCy = flameBaseY - flameH * 0.55;
  const shW = fh * 0.155; // shoulder half-width
  const hemW = fh * 0.19; // hem half-width (just inside the seam — whole silhouette reads)
  const headR = fh * 0.09;

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
  /** A pair of watching eyes in the dark — verdigris, dimmer with depth. */
  const eyes = (ex: number, ey: number, sep: number, sc: number, a: number): void => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const hz = ctx.createRadialGradient(ex, ey, 0, ex, ey, sep * 2.4);
    hz.addColorStop(0, shade(C.verdigrisDim, 0.9, 0.12 * a));
    hz.addColorStop(1, shade(C.verdigrisDim, 0.9, 0));
    ctx.fillStyle = hz;
    ctx.fillRect(ex - sep * 2.5, ey - sep * 2.5, sep * 5, sep * 5);
    ctx.restore();
    for (const sx of [-1, 1] as const) {
      const px = ex + (sx * sep) / 2;
      const py = ey + (sx < 0 ? sc * 0.4 : 0);
      ctx.fillStyle = mix(C.verdigris, C.verdigrisDim, 0.3, 0.7 * a);
      ctx.beginPath();
      ctx.ellipse(px, py, 2.1 * sc, 1.3 * sc, 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(C.verdigris, 1.35, 0.9 * a);
      ctx.beginPath();
      ctx.arc(px + 0.4 * sc, py - 0.2 * sc, 0.7 * sc, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ── 1. base void gradient (background depth plane) ───────────────────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, shade(C.void, 0.85));
  base.addColorStop(0.4, mix(C.void, C.surface, 0.3));
  base.addColorStop(0.66, mix(C.void, C.surface2, 0.35));
  base.addColorStop(0.82, shade(C.void, 0.9));
  base.addColorStop(1, shade(C.void, 0.7));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. the wall the gate is set in — darker than the door, for contrast ──
  ctx.fillStyle = mix(C.void, C.surface, 0.16);
  ctx.fillRect(0, 0, w, floorY);
  ctx.lineWidth = 1;
  let courseY = floorY - R * 0.08;
  let prevY = floorY;
  while (courseY > h * 0.04) {
    ctx.strokeStyle = shade(C.surface2, 1.1, 0.05);
    line(0, courseY, w, courseY);
    ctx.strokeStyle = shade(C.surface2, 1.05, 0.04);
    const joints = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < joints; j++) {
      const jx = rand() * w;
      line(jx, courseY, jx, prevY);
    }
    prevY = courseY;
    courseY -= R * 0.16 * (0.85 + rand() * 0.3);
  }
  // low mist band behind the door's foot — lifts the votives and her wedge
  const mist = ctx.createLinearGradient(0, floorY - R * 0.22, 0, floorY + 2);
  mist.addColorStop(0, mix(C.void, C.bone, 0.12, 0));
  mist.addColorStop(0.6, mix(C.void, C.bone, 0.12, 0.16));
  mist.addColorStop(1, mix(C.void, C.bone, 0.12, 0));
  ctx.fillStyle = mist;
  ctx.fillRect(0, floorY - R * 0.22, w, R * 0.22 + 2);

  // ── 3. carved stone surround + glyph ticks ───────────────────────────────
  ring(R * 1.08, R * 0.05, mix(C.void, C.surface2, 0.8));
  ring(R * 1.115, 1.2, shade(C.void, 0.75, 0.8));
  ring(R * 1.045, 1, shade(C.surface2, 1.3, 0.4));
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI + 0.3 + (i / 25) * (Math.PI - 0.6) + (rand() - 0.5) * 0.02;
    const r0 = R * 1.125;
    const r1 = r0 + R * 0.03 + rand() * R * 0.012;
    ctx.strokeStyle = i % 5 === 0 ? shade(C.goldInk, 0.9, 0.35) : shade(C.boneDim, 0.9, 0.22);
    ctx.lineWidth = 1;
    line(cx + Math.cos(a) * r0, gateCy + Math.sin(a) * r0, cx + Math.cos(a) * r1, gateCy + Math.sin(a) * r1);
  }

  // ── 4. threshold floor ───────────────────────────────────────────────────
  const floorG = ctx.createLinearGradient(0, floorY, 0, h);
  floorG.addColorStop(0, mix(C.void, C.surface2, 0.5));
  floorG.addColorStop(0.35, mix(C.void, C.surface, 0.28));
  floorG.addColorStop(1, shade(C.void, 0.7));
  ctx.fillStyle = floorG;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.strokeStyle = shade(C.surface2, 1.2, 0.2);
  ctx.lineWidth = 1;
  line(0, floorY + Math.max(5, h * 0.025), w, floorY + Math.max(5, h * 0.025));
  ctx.strokeStyle = shade(C.surface2, 1.1, 0.06);
  for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7;
    const xTop = cx + (t - 0.5) * w * 0.6 * (0.85 + rand() * 0.3);
    const xBot = cx + (t - 0.5) * w * 1.6;
    line(xTop, floorY + h * 0.03, xBot, h);
  }

  // ── 5. THE GREAT GATE — high-contrast disc, warm-kissed at the seam ─────
  ctx.strokeStyle = shade(C.void, 0.35, 0.9); // socket shadow (iconography)
  ctx.lineWidth = Math.max(3, R * 0.022);
  ctx.beginPath();
  ctx.arc(cx, gateCy, R + R * 0.014, 0, Math.PI * 2);
  ctx.stroke();
  const disc = ctx.createRadialGradient(staffX, flameCy, R * 0.05, cx, gateCy, R);
  disc.addColorStop(0, mix(C.surface2, C.ember, 0.24));
  disc.addColorStop(0.35, mix(C.surface, C.surface2, 0.8));
  disc.addColorStop(1, mix(C.void, C.surface, 0.55));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, gateCy, R, 0, Math.PI * 2);
  ctx.fill();
  // relief rings + cool crown rim (Gate iconography)
  ring(R - 2, 2.5, shade(C.surface2, 1.6, 0.9));
  ring(R - 9, 1, shade(C.surface2, 1.35, 0.4));
  ring(R * 0.68, 1.2, shade(C.surface2, 1.35, 0.42));
  ring(R * 0.4, 1, shade(C.surface2, 1.35, 0.3));
  ctx.strokeStyle = mix(C.surface2, C.verdigrisDim, 0.35, 0.55);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, gateCy, R - 2, -Math.PI * 0.78, -Math.PI * 0.22);
  ctx.stroke();
  // ridge spokes + rivets; those near her flame catch a warm fleck
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
    ctx.fillStyle = shade(C.surface2, 1.6, 0.8);
    ctx.beginPath();
    ctx.arc(rx, ry, 2 + rand(), 0, Math.PI * 2);
    ctx.fill();
    if (Math.hypot(rx - staffX, ry - flameCy) < R * 0.9) {
      ctx.fillStyle = mix(C.flame, C.goldInk, 0.4, 0.4);
      ctx.beginPath();
      ctx.arc(rx - 0.5, ry - 0.5, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // rune rings — carved sigil ticks at two radii, every fourth gilt
  for (const [rr, n] of [
    [0.76, 30],
    [0.5, 20],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.03;
      const r0 = R * rr;
      const r1 = r0 + R * 0.022 + rand() * R * 0.02;
      const gilt = i % 4 === 0;
      ctx.strokeStyle = gilt ? shade(C.goldInk, 0.85, 0.3) : mix(C.boneDim, C.verdigrisDim, 0.4, 0.2);
      ctx.lineWidth = gilt ? 1.3 : 1;
      line(cx + Math.cos(a) * r0, gateCy + Math.sin(a) * r0, cx + Math.cos(a) * r1, gateCy + Math.sin(a) * r1);
      if (rand() < 0.3) {
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * (r1 + R * 0.014), gateCy + Math.sin(a) * (r1 + R * 0.014), 1, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ── 6. the hub SEAL — a great wax-and-gold emblem, split by her passing ──
  // gilt, not dark: her flame sits at hub height, so the arcs read backlit
  ring(R * 0.165, Math.max(2.5, R * 0.02), mix(C.goldInk, C.ember, 0.35, 0.8));
  ring(R * 0.18, 1, shade(C.void, 0.5, 0.45));
  ctx.fillStyle = mix(C.ember, C.void, 0.62);
  ctx.beginPath();
  ctx.arc(cx, gateCy, R * 0.105, 0, Math.PI * 2);
  ctx.fill();
  ring(R * 0.105, 1, shade(C.goldInk, 0.7, 0.45));
  // sunburst spokes of the seal — the flame-sigil of her order
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) > 0.82) continue; // the seam ate the verticals
    ctx.strokeStyle = mix(C.goldInk, C.void, 0.35, 0.5);
    ctx.lineWidth = 1.4;
    line(
      cx + Math.cos(a) * R * 0.115,
      gateCy + Math.sin(a) * R * 0.115,
      cx + Math.cos(a) * R * 0.155,
      gateCy + Math.sin(a) * R * 0.155,
    );
  }
  // crack lines where the wax broke when the Gate let her in
  ctx.strokeStyle = shade(C.void, 0.6, 0.6);
  ctx.lineWidth = 1;
  for (const sx of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * g * 1.05, gateCy - R * 0.08);
    ctx.lineTo(cx + sx * (g + R * 0.035), gateCy - R * 0.03);
    ctx.lineTo(cx + sx * (g + R * 0.02), gateCy + R * 0.045);
    ctx.lineTo(cx + sx * (g + R * 0.06), gateCy + R * 0.09);
    ctx.stroke();
  }

  // ── 7. her light kissing the leaf faces around the seam ─────────────────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const doorGlow = ctx.createRadialGradient(cx, floorY - R * 0.4, 0, cx, floorY - R * 0.4, R * 0.85);
  doorGlow.addColorStop(0, shade(C.flame, 0.5, 0.3));
  doorGlow.addColorStop(0.4, shade(C.ember, 0.5, 0.14));
  doorGlow.addColorStop(1, shade(C.ember, 0.5, 0));
  ctx.fillStyle = doorGlow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // ── 8. the seam — carved open, the stair down, the watchers, HER ─────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - g, seamTop + 1, g * 2, floorY - seamTop - 1);
  ctx.clip();
  // interior dark: pitch above, faint warmth pooling low where she walks
  const gapG = ctx.createLinearGradient(0, seamTop, 0, floorY);
  gapG.addColorStop(0, shade(C.void, 0.3));
  gapG.addColorStop(0.5, shade(C.void, 0.5));
  gapG.addColorStop(0.78, mix(C.void, C.ember, 0.18));
  gapG.addColorStop(1, mix(C.void, C.ember, 0.34));
  ctx.fillStyle = gapG;
  ctx.fillRect(cx - g, seamTop, g * 2, floorY - seamTop);
  // broad stone steps dropping away — lit tread tops compress with depth,
  // her candle-pool dying on each one further down
  {
    let ty = floorY;
    let d = d0;
    for (let k = 0; k < 7; k++) {
      const hw = g * (1 - k * 0.055);
      const sink = Math.min(1, k * 0.17);
      ctx.fillStyle = mix(mix(C.ember, C.flame, 0.35), C.void, sink, Math.max(0.12, 0.55 - k * 0.06));
      ctx.fillRect(cx - hw, ty - d, hw * 2, d);
      const glowK = Math.max(0, 0.95 - k * 0.13);
      ctx.strokeStyle = mix(C.flame, C.ember, Math.min(1, k / 5), glowK);
      ctx.lineWidth = k < 2 ? 2 : 1.2;
      line(cx - hw, ty, cx + hw, ty);
      // shadow tucked under each edge — the "looking down the well" signature
      ctx.strokeStyle = shade(C.void, 0.25, 0.55);
      ctx.lineWidth = 1;
      line(cx - hw, ty + 1.2, cx + hw, ty + 1.2);
      ty -= d;
      d *= 0.82;
    }
  }
  // her pool of light inside the well — backlights her hood and shoulders
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const wellGlow = ctx.createRadialGradient(staffX, yF - fh * 0.55, 0, staffX, yF - fh * 0.55, fh * 1.6);
  wellGlow.addColorStop(0, shade(C.flame, 0.6, 0.48));
  wellGlow.addColorStop(0.45, shade(C.ember, 0.55, 0.2));
  wellGlow.addColorStop(1, shade(C.ember, 0.5, 0));
  ctx.fillStyle = wellGlow;
  ctx.fillRect(cx - g, seamTop, g * 2, floorY - seamTop);
  ctx.restore();
  // stone teeth meshing from both leaves — the seal closing, light pinched
  for (const sx of [-1, 1] as const) {
    let toothY = gateCy - R * (sx < 0 ? 0.9 : 0.83);
    while (toothY < gateCy - R * 0.12) {
      const th = R * 0.045;
      const xe = cx + sx * g;
      const xt = cx + sx * g * 0.42;
      ctx.fillStyle = mix(C.void, C.surface2, 0.6);
      ctx.beginPath();
      ctx.moveTo(xe, toothY - th);
      ctx.lineTo(xt, toothY - th * 0.4);
      ctx.lineTo(xt, toothY + th * 0.4);
      ctx.lineTo(xe, toothY + th);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(C.surface2, 1.4, 0.25);
      ctx.lineWidth = 1;
      line(xe, toothY - th, xt, toothY - th * 0.4);
      toothY += R * 0.14 * (0.9 + rand() * 0.2);
    }
  }
  // the watchers — one near her light, more pairs deeper in the dark
  eyes(cx + g * 0.2, gateCy - R * 0.1, Math.max(6, g * 0.42), 1.15, 1);
  eyes(cx - g * 0.25, gateCy - R * 0.26, Math.max(5, g * 0.3), 0.8, 0.62);
  eyes(cx + g * 0.3, gateCy - R * 0.52, Math.max(4, g * 0.22), 0.6, 0.4);
  eyes(cx - g * 0.12, gateCy - R * 0.78, Math.max(3, g * 0.18), 0.5, 0.26);
  // warm dust drifting in her light shaft
  for (let i = 0; i < 14; i++) {
    const mxx = cx + (rand() - 0.5) * g * 1.8;
    const myy = yF - fh * 1.4 + rand() * fh * 1.5;
    ctx.fillStyle = mix(C.flameHi, C.bone, 0.5, 0.06 + rand() * 0.12);
    ctx.beginPath();
    ctx.arc(mxx, myy, 0.5 + rand() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 9. THE CANDLEMAID — hooded, back turned, mid-step down ──────────────
  // backlight first: her flame's glow thrown on the well air behind her,
  // so the hooded silhouette reads dark against warmth
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const backLit = ctx.createRadialGradient(fx, yF - fh * 0.6, fh * 0.04, fx, yF - fh * 0.6, fh * 1.05);
  backLit.addColorStop(0, mix(C.flame, C.ember, 0.4, 0.4));
  backLit.addColorStop(0.55, shade(C.ember, 0.8, 0.17));
  backLit.addColorStop(1, shade(C.ember, 0.8, 0));
  ctx.fillStyle = backLit;
  ctx.fillRect(cx - g, seamTop, g * 2, floorY - seamTop);
  ctx.restore();
  // boots first: trailing heel on her tread, leading toe on the next one down
  ctx.fillStyle = shade(C.void, 0.55);
  ctx.beginPath();
  ctx.ellipse(fx - hemW * 0.38, yF - 1, fh * 0.05, fh * 0.022, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(fx + hemW * 0.42, yLead - 1, fh * 0.05, fh * 0.022, 0, 0, Math.PI * 2);
  ctx.fill();
  const hemLift = fh * 0.07; // leading side of the hem swings up mid-step
  const robePath = (): void => {
    ctx.beginPath();
    ctx.moveTo(fx - hemW, yF);
    ctx.bezierCurveTo(fx - hemW * 0.92, yF - fh * 0.34, fx - shW * 1.3, yF - fh * 0.6, fx - shW, yF - fh * 0.78);
    ctx.quadraticCurveTo(fx - shW * 0.85, yF - fh * 0.9, fx - headR * 1.2, yF - fh * 0.93);
    ctx.quadraticCurveTo(fx - headR * 0.4, yF - fh * 1.06, fx + headR * 0.5, yF - fh * 1.0); // hood peak
    ctx.quadraticCurveTo(fx + headR * 1.15, yF - fh * 0.95, fx + shW * 0.9, yF - fh * 0.85);
    // raised right arm reaching to the staff
    ctx.quadraticCurveTo(fx + shW * 1.7, yF - fh * 0.78, staffX + fh * 0.02, yHand);
    ctx.quadraticCurveTo(staffX - fh * 0.02, yHand + fh * 0.09, fx + shW * 1.15, yF - fh * 0.55);
    ctx.bezierCurveTo(fx + hemW * 1.1, yF - fh * 0.3, fx + hemW, yF - fh * 0.16, fx + hemW * 0.92, yF - hemLift);
    // wax-drip hem, right → left
    let px0 = fx + hemW * 0.92;
    for (const [t, dpt] of [
      [0.66, 0.05],
      [0.4, 0.085],
      [0.16, 0.04],
      [-0.1, 0.07],
      [-0.38, 0.035],
      [-0.62, 0.08],
      [-0.86, 0.045],
    ] as const) {
      const nx = fx + hemW * t;
      const bY = yF - (hemLift * (t + 1)) / 2;
      ctx.quadraticCurveTo((px0 + nx) / 2, bY + dpt * fh, nx, bY);
      px0 = nx;
    }
    ctx.closePath();
  };
  const robeG = ctx.createLinearGradient(0, yF - fh, 0, yF + fh * 0.05);
  robeG.addColorStop(0, mix(C.ink, C.void, 0.62));
  robeG.addColorStop(0.7, mix(C.ink, C.void, 0.5));
  robeG.addColorStop(1, mix(C.ink, C.ember, 0.28));
  robePath();
  ctx.fillStyle = robeG;
  ctx.fill();
  ctx.strokeStyle = inkLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // warm rim from her own flame: right flank, hood crest, hem drips
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.3, 0.85);
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(fx + shW * 0.9, yF - fh * 0.85);
  ctx.quadraticCurveTo(fx + shW * 1.7, yF - fh * 0.78, staffX + fh * 0.015, yHand + fh * 0.01);
  ctx.moveTo(fx + shW * 1.15, yF - fh * 0.55);
  ctx.bezierCurveTo(fx + hemW * 1.1, yF - fh * 0.3, fx + hemW, yF - fh * 0.16, fx + hemW * 0.92, yF - hemLift);
  ctx.stroke();
  ctx.strokeStyle = mix(C.flame, C.flameHi, 0.3, 0.5);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(fx - headR * 0.3, yF - fh * 1.055);
  ctx.quadraticCurveTo(fx + headR * 0.6, yF - fh * 1.005, fx + headR * 1.1, yF - fh * 0.95);
  ctx.stroke();
  ctx.strokeStyle = mix(C.ember, C.flame, 0.5, 0.4);
  ctx.lineWidth = 1;
  {
    let px1 = fx + hemW * 0.92;
    ctx.beginPath();
    ctx.moveTo(px1, yF - hemLift);
    for (const [t, dpt] of [
      [0.66, 0.05],
      [0.4, 0.085],
      [0.16, 0.04],
      [-0.1, 0.07],
    ] as const) {
      const nx = fx + hemW * t;
      const bY = yF - (hemLift * (t + 1)) / 2;
      ctx.quadraticCurveTo((px1 + nx) / 2, bY + dpt * fh, nx, bY);
      px1 = nx;
    }
    ctx.stroke();
  }
  // a cold verdigris kiss on her deep-side flank — the Vault ahead of her
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.5, 0.5);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(fx - hemW * 0.96, yF - fh * 0.06);
  ctx.bezierCurveTo(fx - hemW * 0.9, yF - fh * 0.34, fx - shW * 1.26, yF - fh * 0.6, fx - shW * 0.97, yF - fh * 0.78);
  ctx.stroke();
  // the trailing wick-ribbon of her office, drifting behind her descent
  ctx.strokeStyle = mix(C.parchmentAged, C.ember, 0.35, 0.65);
  ctx.lineWidth = Math.max(1, fh * 0.014);
  ctx.beginPath();
  ctx.moveTo(fx - headR * 1.1, yF - fh * 0.92);
  ctx.bezierCurveTo(fx - fh * 0.14, yF - fh * 0.98, fx - fh * 0.17, yF - fh * 0.8, fx - fh * 0.09, yF - fh * 0.72);
  ctx.stroke();

  // ── 10. the lantern-staff and the FIRST FLAME ────────────────────────────
  ctx.strokeStyle = mix(C.ink, C.void, 0.25);
  ctx.lineWidth = Math.max(2, fh * 0.032);
  line(staffX, yF, staffX, flameBaseY + fh * 0.03);
  ctx.strokeStyle = mix(C.ember, C.flame, 0.5, 0.5);
  ctx.lineWidth = 1;
  line(staffX + 1, yHand - fh * 0.05, staffX + 1, flameBaseY + fh * 0.05);
  ctx.fillStyle = mix(C.ink, C.void, 0.45);
  ctx.beginPath();
  ctx.arc(staffX, yHand, fh * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.3, 0.5);
  ctx.beginPath();
  ctx.arc(staffX, yHand, fh * 0.035, -Math.PI * 0.4, Math.PI * 0.3);
  ctx.stroke();
  // gilt cage cradling the flame
  const cw = fh * 0.055;
  const cageH = fh * 0.2;
  ctx.strokeStyle = mix(C.goldInk, C.void, 0.3, 0.8);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(staffX - cw, flameBaseY + fh * 0.02);
  ctx.quadraticCurveTo(staffX - cw * 1.1, flameBaseY - cageH * 0.6, staffX, flameBaseY - cageH);
  ctx.moveTo(staffX + cw, flameBaseY + fh * 0.02);
  ctx.quadraticCurveTo(staffX + cw * 1.1, flameBaseY - cageH * 0.6, staffX, flameBaseY - cageH);
  ctx.stroke();
  ctx.lineWidth = 2;
  line(staffX - cw, flameBaseY + fh * 0.02, staffX + cw, flameBaseY + fh * 0.02);
  ctx.fillStyle = mix(C.goldInk, C.void, 0.15, 0.85);
  ctx.save();
  ctx.translate(staffX, flameBaseY - cageH - 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-1.8, -1.8, 3.6, 3.6);
  ctx.restore();
  ctx.restore(); // ← end seam clip

  // leaf inner edges: amber rim strongest at her height, pinched out above
  for (const sx of [-1, 1] as const) {
    const ex = cx + sx * g;
    ctx.strokeStyle = inkLine;
    ctx.lineWidth = 2;
    line(ex + sx, seamTop + 2, ex + sx, floorY);
    const rim = ctx.createLinearGradient(0, seamTop, 0, floorY);
    rim.addColorStop(0, shade(C.ember, 0.6, 0));
    rim.addColorStop(0.5, shade(C.ember, 0.9, 0.25));
    rim.addColorStop(0.86, mix(C.flame, C.flameHi, 0.3, 0.85));
    rim.addColorStop(1, mix(C.flame, C.flameHi, 0.3, 0.9));
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.6;
    line(ex, seamTop + 4, ex, floorY);
    // verdigris patina beside the cut (Gate iconography) + drips
    ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.4, 0.26);
    ctx.lineWidth = 1;
    line(ex + sx * 2.5, seamTop + R * 0.06, ex + sx * 2.5, floorY - R * 0.3);
    ctx.strokeStyle = shade(C.verdigrisDim, 1, 0.14);
    for (let i = 0; i < 3; i++) {
      const dx = ex + sx * (4 + rand() * g * 0.6);
      const dy = gateCy - chord * 0.6 + rand() * chord;
      line(dx, dy, dx, dy + R * (0.05 + rand() * 0.07));
    }
  }

  // ── 11. closing hardware — bolts sliding home across the seam ───────────
  for (const [sx, byR] of [
    [-1, 0.62],
    [1, 0.34],
  ] as const) {
    const by = gateCy - R * byR;
    const hx = cx + sx * (g + R * 0.05);
    const hw2 = R * 0.14;
    const hh = R * 0.034;
    ctx.fillStyle = mix(C.void, C.surface2, 0.95);
    ctx.fillRect(Math.min(hx, hx + sx * hw2), by - hh, hw2, hh * 2);
    ctx.strokeStyle = inkLine;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(Math.min(hx, hx + sx * hw2), by - hh, hw2, hh * 2);
    for (const [dx, dy] of [
      [0.12, -0.55],
      [0.88, -0.55],
      [0.12, 0.55],
      [0.88, 0.55],
    ] as const) {
      ctx.fillStyle = shade(C.goldInk, 0.75, 0.55);
      ctx.beginPath();
      ctx.arc(Math.min(hx, hx + sx * hw2) + hw2 * dx, by + hh * dy, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    // the bolt tongue, thrust across the gap toward its catch
    ctx.fillStyle = shade(C.surface2, 1.15);
    const tx0 = Math.min(hx, cx - sx * g * 0.35);
    ctx.fillRect(tx0, by - hh * 0.42, Math.abs(hx - (cx - sx * g * 0.35)), hh * 0.84);
    ctx.strokeStyle = shade(C.void, 0.5, 0.7);
    ctx.lineWidth = 1;
    line(tx0, by + hh * 0.45, tx0 + Math.abs(hx - (cx - sx * g * 0.35)), by + hh * 0.45);
    ctx.fillStyle = mix(C.goldInk, C.void, 0.2, 0.8);
    ctx.fillRect(cx - sx * g * 0.35 - 1.5, by - hh * 0.5, 3, hh);
    // catch plate on the far leaf, waiting for the tongue
    const cpx = Math.min(cx - sx * g, cx - sx * (g + R * 0.03)) - sx;
    ctx.fillStyle = mix(C.void, C.surface2, 0.85);
    ctx.fillRect(cpx, by - hh * 0.7, R * 0.03, hh * 1.4);
    ctx.strokeStyle = inkLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(cpx, by - hh * 0.7, R * 0.03, hh * 1.4);
  }
  // a hanging chain from the lower housing — the last rites of closing
  ctx.strokeStyle = mix(C.goldInk, C.void, 0.45, 0.5);
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 4; i++) {
    const lx = cx - (g + R * 0.1) + Math.sin(i * 1.3) * R * 0.008;
    const ly = gateCy - R * 0.585 + R * 0.036 + i * R * 0.026;
    ctx.beginPath();
    ctx.ellipse(lx, ly, R * 0.008, R * 0.013, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── 12. the First Flame's gilded halo — unique among all flames ─────────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(staffX, flameCy, 0, staffX, flameCy, fh * 0.55);
  halo.addColorStop(0, shade(C.flameHi, 0.8, 0.35));
  halo.addColorStop(1, shade(C.flameHi, 0.8, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(staffX - fh * 0.6, flameCy - fh * 0.6, fh * 1.2, fh * 1.2);
  ctx.restore();
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.35, 0.45);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(staffX, flameCy, fh * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = mix(C.goldInk, C.flameHi, 0.3, 0.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(staffX, flameCy, fh * 0.47, 0, Math.PI * 2);
  ctx.stroke();
  drop(staffX, flameBaseY, flameH * 1.3, fh * 0.075, fh * 0.015, shade(C.flame, 1, 0.95));
  drop(staffX, flameBaseY - fh * 0.012, flameH * 0.95, fh * 0.05, fh * 0.008, C.flameHi);
  drop(staffX, flameBaseY - fh * 0.022, flameH * 0.6, fh * 0.028, 0, shade(C.flameHi, 1.65));

  // ── 13. the last light escaping under the door — wedge, sill, footprints ─
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const wedgeBot = h * 0.79;
  const wedge = ctx.createLinearGradient(0, floorY, 0, wedgeBot);
  wedge.addColorStop(0, mix(C.flame, C.ember, 0.35, 0.22));
  wedge.addColorStop(0.55, mix(C.ember, C.void, 0.25, 0.08));
  wedge.addColorStop(1, shade(C.ember, 0.6, 0));
  ctx.fillStyle = wedge;
  ctx.beginPath();
  ctx.moveTo(cx - g * 1.05, floorY);
  ctx.lineTo(cx + g * 1.05, floorY);
  ctx.lineTo(cx + g * 3.4, wedgeBot);
  ctx.lineTo(cx - g * 3.4, wedgeBot);
  ctx.closePath();
  ctx.fill();
  const sillPool = ctx.createRadialGradient(cx, floorY, 0, cx, floorY, g * 2.6);
  sillPool.addColorStop(0, shade(C.flame, 0.8, 0.3));
  sillPool.addColorStop(1, shade(C.flame, 0.8, 0));
  ctx.fillStyle = sillPool;
  ctx.fillRect(cx - g * 2.8, floorY - g * 2.8, g * 5.6, g * 5.6);
  ctx.restore();
  ctx.strokeStyle = shade(C.flameHi, 1, 0.85);
  ctx.lineWidth = 2;
  line(cx - g, floorY, cx + g, floorY);
  // her footprints, crossing the light and stopping at the threshold
  ctx.fillStyle = shade(C.void, 0.35, 0.4);
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const py = floorY + R * 0.035 + t * (h * 0.775 - floorY - R * 0.035);
    const sway = Math.sin(i * 1.9) * R * 0.012;
    for (const sxp of [-1, 1] as const) {
      ctx.beginPath();
      ctx.ellipse(
        cx + sway + sxp * R * (0.016 + t * 0.008),
        py + (sxp < 0 ? R * 0.008 : 0),
        R * 0.014 * (1 + t * 0.3),
        R * 0.007 * (1 + t * 0.3),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // ── 14. votives left by those who waited — stubs, two snuffed, three lit ─
  for (const [tx, hR, state] of [
    [-0.82, 0.03, 1],
    [-0.64, 0.052, 2],
    [-0.48, 0.026, 1],
    [-0.34, 0.058, 0],
    [-0.21, 0.022, 1],
    [-0.13, 0.038, 1],
    [0.14, 0.048, 0],
    [0.24, 0.024, 1],
    [0.37, 0.055, 2],
    [0.53, 0.028, 1],
    [0.7, 0.05, 0],
    [0.85, 0.033, 1],
  ] as const) {
    const vx = cx + tx * R + (rand() - 0.5) * R * 0.02;
    const wd = R * (0.018 + rand() * 0.012);
    const hgt = hR * R * (0.9 + rand() * 0.2);
    const topY = floorY - hgt;
    ctx.fillStyle = shade(C.boneDim, 0.9, 0.25); // melt pool
    ctx.beginPath();
    ctx.ellipse(vx, floorY, wd * 1.6, wd * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(C.parchmentAged, C.void, 0.5);
    ctx.fillRect(vx - wd / 2, topY, wd, hgt);
    ctx.strokeStyle = mix(C.parchment, C.flame, 0.25, 0.45); // seam-lit edge
    ctx.lineWidth = 1;
    const litSide = vx < cx ? 1 : -1;
    line(vx + (litSide * wd) / 2 - litSide, topY + 1, vx + (litSide * wd) / 2 - litSide, floorY - 1);
    ctx.strokeStyle = mix(C.parchment, C.void, 0.3, 0.3); // wax drip
    line(vx - wd * 0.2, topY + 1, vx - wd * 0.2, topY + hgt * 0.5);
    if (state === 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const vg = ctx.createRadialGradient(vx, topY - wd, 0, vx, topY - wd, hgt * 2.2);
      vg.addColorStop(0, shade(C.flame, 0.7, 0.14));
      vg.addColorStop(1, shade(C.flame, 0.7, 0));
      ctx.fillStyle = vg;
      ctx.fillRect(vx - hgt * 2.3, topY - wd - hgt * 2.3, hgt * 4.6, hgt * 4.6);
      ctx.restore();
      drop(vx, topY - wd * 0.15, wd * 1.7, wd * 0.4, wd * 0.08, shade(C.flame, 1, 0.85));
      drop(vx, topY - wd * 0.2, wd * 1.1, wd * 0.24, 0, shade(C.flameHi, 1.2, 0.9));
    } else {
      ctx.strokeStyle = shade(C.void, 0.8, 0.8); // dead wick
      ctx.lineWidth = 1;
      line(vx, topY, vx + wd * 0.15, topY - wd * 0.55);
      if (state === 2) {
        // a thread of smoke still rising — someone was here not long ago
        ctx.strokeStyle = shade(C.bone, 0.9, 0.2);
        ctx.lineWidth = 1;
        const sy = topY - wd * 0.6;
        ctx.beginPath();
        ctx.moveTo(vx + wd * 0.15, sy);
        ctx.bezierCurveTo(vx + wd, sy - R * 0.05, vx - wd, sy - R * 0.1, vx + wd * 0.6, sy - R * 0.15);
        ctx.quadraticCurveTo(vx + wd * 1.7, sy - R * 0.19, vx + wd * 0.5, sy - R * 0.23);
        ctx.stroke();
      }
    }
  }

  // ── 15. drifting dust motes about the door (midground air) ───────────────
  for (let i = 0; i < 40; i++) {
    const mx = cx + (rand() - 0.5) * R * 2.6;
    const my = seamTop - R * 0.05 + rand() * (floorY - seamTop);
    const nearSeam = Math.abs(mx - cx) < g * 3 && my > gateCy;
    ctx.fillStyle = nearSeam
      ? mix(C.flameHi, C.bone, 0.5, 0.05 + rand() * 0.09)
      : mix(C.bone, C.verdigris, 0.25, 0.03 + rand() * 0.06);
    ctx.beginPath();
    ctx.arc(mx, my, 0.5 + rand() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 16. foreground plane — arch and pillars framing the plate ───────────
  const pw = w * 0.11;
  ctx.fillStyle = shade(C.void, 0.45);
  ctx.beginPath(); // the arch overhead
  ctx.moveTo(0, 0);
  ctx.lineTo(0, h * 0.16);
  ctx.quadraticCurveTo(cx, h * 0.0, w, h * 0.16);
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(0, 0, pw, h);
  ctx.fillRect(w - pw, 0, pw, h);
  ctx.fillRect(0, h * 0.78, pw * 1.3, h * 0.22); // plinths
  ctx.fillRect(w - pw * 1.3, h * 0.78, pw * 1.3, h * 0.22);
  for (const px of [pw, w - pw] as const) {
    const dir = px < cx ? 1 : -1;
    ctx.fillStyle = shade(C.void, 0.45);
    ctx.beginPath(); // capital wedge
    ctx.moveTo(px, h * 0.24);
    ctx.lineTo(px + dir * Math.max(8, w * 0.012), h * 0.26);
    ctx.lineTo(px + dir * Math.max(8, w * 0.012), h * 0.3);
    ctx.lineTo(px, h * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mix(C.void, C.surface2, 0.7, 0.55);
    ctx.lineWidth = 1;
    line(px + dir * 0.5, h * 0.05, px + dir * 0.5, h * 0.78);
    ctx.strokeStyle = shade(C.void, 0.85, 0.5); // hairline cracks
    for (let i = 0; i < 2; i++) {
      const cy0 = h * (0.3 + rand() * 0.35);
      ctx.beginPath();
      ctx.moveTo(px - dir * pw * (0.2 + rand() * 0.5), cy0);
      ctx.lineTo(px - dir * pw * (0.1 + rand() * 0.3), cy0 + h * 0.04);
      ctx.stroke();
    }
  }

  // ── 17. grain over the darks, then crush / settle / vignette ────────────
  for (let i = 0; i < 620; i++) {
    const gx2 = rand() * w;
    const gy2 = rand() * h * 0.8;
    ctx.fillStyle = rand() < 0.5 ? shade(C.bone, 1, 0.015 + rand() * 0.025) : shade(C.void, 0.3, 0.03 + rand() * 0.03);
    ctx.fillRect(gx2, gy2, 1, 1);
  }
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.2);
  crush.addColorStop(0, shade(C.void, 0.65, 0.85));
  crush.addColorStop(1, shade(C.void, 0.65, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.2);
  const settle = ctx.createLinearGradient(0, h * 0.76, 0, h);
  settle.addColorStop(0, shade(C.void, 0.6, 0));
  settle.addColorStop(1, shade(C.void, 0.6, 0.6));
  ctx.fillStyle = settle;
  ctx.fillRect(0, h * 0.76, w, h * 0.24);
  const vr = Math.min(w, h) * 0.55;
  for (const [vx, vy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    const v = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    v.addColorStop(0, shade(C.void, 0.5, 0.45));
    v.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}
