/**
 * Meeting plate 2 — "Her Face."
 * The Candlemaid kneels before what is left of the First Flame — a fist-sized
 * stub cupped in her hands — and has half-turned to the visitor. Hooded,
 * colorless delver's cloth, a long braid singed at the tip. The horror is
 * quiet and twofold: her cupped hands and forearms have gone translucent as
 * wax, drip-lines frozen down them (she is becoming what she keeps); and her
 * eyes hold a reflected flame that cannot be the stub — too tall, upright,
 * a memory of the First Flame whole. Twenty years alone show quietly: tear
 * tracks dried to wax down both cheeks — the weeping went the way of the
 * hands — one fresh tear welling gold at the brighter eye, inner brows
 * lifted a breath, mouth corners weighted. Grief AND relief at the first
 * face since; never melodrama. Her shadow is wrong too: it still
 * kneels on the dead candle-mass beside her, bowed TOWARD the light it
 * should flee — she turned, it did not. Behind her the great mother-candle
 * rises like a melted monument; far above, the Gate seam breathes faint
 * verdigris. Two-hue law: her flame is warm amber/white-gold, the chamber's
 * knowledge-light is verdigris, all else near-void. Nothing screams;
 * everything is two degrees off true. Pure 2D canvas; caller has DPR-scaled
 * and cleared; the bottom stays calm and dark for the caption.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG (guildhall pattern, own seed) — never Math.random, never
// paint.ts crand (that stream belongs to the world-texture painters).
function slideRand(seed: number): () => number {
  let s = seed >>> 0 || 0x9fac2e;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function paintMeeting2(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = slideRand(0x9fac2e);
  const s = Math.min(w, h);
  const INK = shade(C.void, 0.7, 0.9);

  // ── geometry ─────────────────────────────────────────────────────────────
  const glowX = w * 0.485; // the cupped stub — the plate's only warm source
  const handY = h * 0.72;
  const fh = Math.min(h * 0.5, w * 0.62); // head-top → hands span; width-aware
  // so the shadow keeps its strip of wall beside her in portrait
  const headTop = handY - fh;
  const hr = fh * 0.148; // head radius (hood interior scale)
  const fx0 = w * 0.5; // face axis
  const turn = -hr * 0.09; // half-turned to the visitor: features drift left
  const fy0 = headTop + hr * 1.24; // face center
  const shY = headTop + fh * 0.4; // shoulder line
  const shW = fh * 0.3; // shoulder half-width
  const hemY = h * 0.852; // robe pools into the dark before the caption
  const cr = fh * 0.105; // cupped-hands bowl radius
  const monCx = w * 0.54; // the dead mother-candle mass behind her
  const monHW = Math.min(w * 0.47, fh * 0.88);
  const seamY = h * 0.05; // the Gate seam, far above

  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
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

  // ── 1. base void — a cool lift high where the seam breathes, crushed low ─
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, mix(C.void, C.surface, 0.3));
  base.addColorStop(0.34, mix(C.void, C.surface, 0.44));
  base.addColorStop(0.62, mix(C.void, C.surface2, 0.34));
  base.addColorStop(0.84, shade(C.void, 0.85));
  base.addColorStop(1, shade(C.void, 0.6));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. the Gate seam far above — one thin crack, breathing verdigris ────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(w * 0.5, seamY);
  ctx.scale(2.6, 1);
  const seamHalo = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.24);
  seamHalo.addColorStop(0, shade(C.verdigrisDim, 1.1, 0.22));
  seamHalo.addColorStop(0.5, shade(C.verdigrisDim, 1, 0.08));
  seamHalo.addColorStop(1, shade(C.verdigrisDim, 1, 0));
  ctx.fillStyle = seamHalo;
  ctx.fillRect(-w, -h * 0.25, w * 2, h * 0.5);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const breath = ctx.createLinearGradient(0, seamY, 0, h * 0.55);
  breath.addColorStop(0, shade(C.verdigrisDim, 1, 0.1));
  breath.addColorStop(0.5, shade(C.verdigrisDim, 1, 0.035));
  breath.addColorStop(1, shade(C.verdigrisDim, 1, 0));
  ctx.fillStyle = breath;
  ctx.fillRect(0, seamY, w, h * 0.55);
  ctx.restore();
  ctx.strokeStyle = shade(C.verdigrisDim, 1.2, 0.5);
  ctx.lineWidth = Math.max(3, s * 0.008);
  ctx.beginPath();
  ctx.moveTo(w * 0.18, seamY + h * 0.018);
  ctx.quadraticCurveTo(w * 0.52, seamY - h * 0.01, w * 0.84, seamY + h * 0.014);
  ctx.stroke();
  ctx.strokeStyle = shade(C.verdigris, 1.35, 0.9);
  ctx.lineWidth = Math.max(1.2, s * 0.0024);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, seamY + h * 0.016);
  ctx.quadraticCurveTo(w * 0.52, seamY - h * 0.008, w * 0.8, seamY + h * 0.012);
  ctx.stroke();
  // slow cool motes sifting down from the seam
  for (let i = 0; i < 16; i++) {
    const t = rand();
    ctx.fillStyle = mix(C.verdigris, C.bone, 0.4, 0.05 + (1 - t) * 0.12);
    ctx.beginPath();
    ctx.arc(w * (0.3 + rand() * 0.42), seamY + t * h * 0.36, 0.5 + rand() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 3. the great dead candle — a melted monument rising past the frame ──
  const monL = (y: number): number =>
    monCx - monHW * (0.56 + 0.44 * (y / h)) + Math.sin(y * 0.01 + 1.7) * monHW * 0.05;
  const monR = (y: number): number =>
    monCx + monHW * (0.6 + 0.4 * (y / h)) + Math.sin(y * 0.013 + 4.1) * monHW * 0.05;
  const mon = new Path2D();
  mon.moveTo(monL(0), 0);
  for (let y = 0; y <= hemY + 4; y += h * 0.04) mon.lineTo(monL(y), y);
  mon.lineTo(monL(hemY) - monHW * 0.16, hemY + h * 0.02); // melted skirt
  mon.lineTo(monR(hemY) + monHW * 0.14, hemY + h * 0.02);
  for (let y = hemY; y >= 0; y -= h * 0.04) mon.lineTo(monR(y), y);
  mon.closePath();
  const monG = ctx.createLinearGradient(monCx - monHW, 0, monCx + monHW, 0);
  monG.addColorStop(0, mix(C.void, C.surface2, 0.75));
  monG.addColorStop(0.5, mix(C.surface, C.surface2, 0.65));
  monG.addColorStop(1, mix(C.void, C.surface2, 0.65));
  ctx.fillStyle = monG;
  ctx.fill(mon);
  ctx.strokeStyle = shade(C.void, 0.6, 0.5);
  ctx.lineWidth = Math.max(1.5, s * 0.003);
  ctx.stroke(mon);
  ctx.save();
  ctx.clip(mon);
  // vertical wax runs — generations of melt, frozen
  for (let i = 0; i < 30; i++) {
    const rx = monCx + (rand() - 0.5) * monHW * 1.7;
    const ry0 = rand() * h * 0.75;
    const rl = h * (0.07 + rand() * 0.22);
    const rw = Math.max(1.5, monHW * (0.014 + rand() * 0.03));
    ctx.strokeStyle = shade(C.surface2, 1.15 + rand() * 0.3, 0.16 + rand() * 0.12);
    ctx.lineWidth = rw;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(rx, ry0);
    ctx.quadraticCurveTo(rx + (rand() - 0.5) * rw * 2, ry0 + rl * 0.5, rx + (rand() - 0.5) * rw * 3, ry0 + rl);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // melt shelves — sagging horizontal lips where old floods stopped
  for (let i = 0; i < 5; i++) {
    const sy = h * (0.13 + i * 0.15) + rand() * h * 0.04;
    ctx.strokeStyle = shade(C.surface2, 1.55, 0.3);
    ctx.lineWidth = Math.max(1.2, s * 0.0028);
    ctx.beginPath();
    ctx.moveTo(monL(sy), sy);
    ctx.bezierCurveTo(monCx - monHW * 0.2, sy + h * 0.025 * rand(), monCx + monHW * 0.25, sy - h * 0.02 * rand(), monR(sy), sy + h * 0.012);
    ctx.stroke();
    for (let d = 0; d < 3; d++) {
      const dx = monCx + (rand() - 0.5) * monHW * 1.4;
      ctx.strokeStyle = shade(C.surface2, 1.6, 0.3);
      ctx.lineWidth = Math.max(1.5, monHW * 0.02);
      ctx.lineCap = "round";
      line(dx, sy + 2, dx, sy + h * (0.02 + rand() * 0.04));
      ctx.lineCap = "butt";
    }
  }
  // cool knowledge-light brushing the monument's crown
  ctx.globalCompositeOperation = "lighter";
  const crownKiss = ctx.createLinearGradient(0, 0, 0, h * 0.4);
  crownKiss.addColorStop(0, shade(C.verdigrisDim, 1.05, 0.22));
  crownKiss.addColorStop(1, shade(C.verdigrisDim, 1, 0));
  ctx.fillStyle = crownKiss;
  ctx.fillRect(monCx - monHW, 0, monHW * 2, h * 0.4);
  // seam-light tracing the monument's high edges — the crack runs on behind
  ctx.strokeStyle = shade(C.verdigrisDim, 1.45, 0.4);
  ctx.lineWidth = Math.max(1.5, s * 0.0032);
  for (const edge of [monL, monR] as const) {
    ctx.beginPath();
    ctx.moveTo(edge(0) + (edge === monL ? 1 : -1), 0);
    for (let y = 0; y <= h * 0.24; y += h * 0.03) ctx.lineTo(edge(y) + (edge === monL ? 1 : -1), y);
    ctx.stroke();
  }
  // her stub's warmth pooling on the wax behind her — the shadow's screen
  const monWarm = ctx.createRadialGradient(glowX, handY - fh * 0.1, cr, glowX, handY - fh * 0.1, fh * 1.35);
  monWarm.addColorStop(0, shade(C.ember, 0.85, 0.5));
  monWarm.addColorStop(0.5, shade(C.ember, 0.75, 0.24));
  monWarm.addColorStop(1, shade(C.ember, 0.7, 0));
  ctx.fillStyle = monWarm;
  ctx.fillRect(monCx - monHW * 1.3, h * 0.12, monHW * 2.6, h * 0.88);
  ctx.globalCompositeOperation = "source-over";
  // occlusion dark hugging her silhouette, so she stands off the wax
  const occ = ctx.createRadialGradient(fx0, shY + fh * 0.1, fh * 0.1, fx0, shY + fh * 0.1, fh * 0.62);
  occ.addColorStop(0, shade(C.void, 0.5, 0.55));
  occ.addColorStop(1, shade(C.void, 0.5, 0));
  ctx.fillStyle = occ;
  ctx.fillRect(fx0 - fh * 0.7, headTop - fh * 0.1, fh * 1.4, fh * 1.4);

  // ── 4. THE WRONG SHADOW — hers, but it still kneels TOWARD the flame ────
  // She has turned to the visitor; her shadow has not. It bows on the wax
  // beside her, hood dipped, an arm reaching for the light it should flee.
  // her own silhouette — peaked hood, sloped shoulders, kneeling bell —
  // leaned bodily toward the glow, still bowing the way she used to.
  // Placed inside whatever strip of wall the aspect leaves beside her.
  const monEdge = monR(handY);
  const availW = Math.max(fh * 0.3, monEdge - (fx0 + fh * 0.4));
  const sBase = Math.min(fh * 0.74, availW * 1.2);
  const spvX = monEdge - availW * 0.42;
  const spvY = handY - fh * 0.02;
  // a second warmth bedded under the shadow, so the dark shape sits on
  // visibly lit wax and cannot be mistaken for an opening
  ctx.globalCompositeOperation = "lighter";
  const shadowBed = ctx.createRadialGradient(
    spvX - sBase * 0.18,
    spvY - sBase * 0.42,
    0,
    spvX - sBase * 0.18,
    spvY - sBase * 0.42,
    sBase * 1.15,
  );
  shadowBed.addColorStop(0, shade(C.ember, 0.78, 0.34));
  shadowBed.addColorStop(0.6, shade(C.ember, 0.72, 0.16));
  shadowBed.addColorStop(1, shade(C.ember, 0.7, 0));
  ctx.fillStyle = shadowBed;
  ctx.fillRect(spvX - sBase * 1.5, spvY - sBase * 1.7, sBase * 3, sBase * 3);
  ctx.globalCompositeOperation = "source-over";
  const slean = -0.52; // toward the light — the one direction no shadow leans
  const sco = Math.cos(slean);
  const ssi = Math.sin(slean);
  const shadowP = (grow: number): Path2D => {
    const sc = sBase * (1 + grow);
    const pt = (lx: number, ly: number): [number, number] => [
      spvX + (lx * sco - ly * ssi) * sc,
      spvY + (lx * ssi + ly * sco) * sc,
    ];
    const p = new Path2D();
    p.moveTo(...pt(-0.28, 0.04));
    p.quadraticCurveTo(...pt(-0.31, -0.2), ...pt(-0.23, -0.34)); // flame-side flank
    p.quadraticCurveTo(...pt(-0.32, -0.42), ...pt(-0.185, -0.44)); // bowed-arm bump
    p.quadraticCurveTo(...pt(-0.14, -0.46), ...pt(-0.145, -0.5)); // throat dip
    p.quadraticCurveTo(...pt(-0.21, -0.56), ...pt(-0.1, -0.64)); // up the hood
    p.quadraticCurveTo(...pt(-0.005, -0.7), ...pt(0.05, -0.63)); // dome and peak
    p.quadraticCurveTo(...pt(0.085, -0.56), ...pt(0.06, -0.5)); // nape dip
    p.quadraticCurveTo(...pt(0.14, -0.5), ...pt(0.17, -0.44)); // shoulder rise
    p.quadraticCurveTo(...pt(0.28, -0.28), ...pt(0.26, -0.06)); // long back
    p.quadraticCurveTo(...pt(0.26, 0.02), ...pt(0.23, 0.05));
    p.closePath();
    return p;
  };
  ctx.fillStyle = shade(C.void, 0.5, 0.32);
  ctx.fill(shadowP(0.04));
  ctx.fillStyle = shade(C.void, 0.42, 0.62);
  ctx.fill(shadowP(0));
  ctx.fillStyle = shade(C.void, 0.3, 0.65);
  ctx.fill(shadowP(-0.03));
  // the floor-smear that roots it to her knees — a shadow bent where the
  // ground meets the great candle, exactly as an honest one would be
  ctx.save();
  ctx.translate((fx0 + fh * 0.37 + spvX) / 2, handY + fh * 0.07);
  ctx.rotate(0.06);
  ctx.scale(1, 0.32);
  const smear = ctx.createRadialGradient(0, 0, 0, 0, 0, sBase * 0.56);
  smear.addColorStop(0, shade(C.void, 0.45, 0.62));
  smear.addColorStop(1, shade(C.void, 0.45, 0));
  ctx.fillStyle = smear;
  ctx.fillRect(-sBase * 0.6, -sBase * 0.6, sBase * 1.2, sBase * 1.2);
  ctx.restore();
  ctx.restore(); // ← end monument clip

  // ── 5. floor — old wax terraces ringing the place she has always knelt ──
  const floorY = handY + fh * 0.1;
  for (let i = 4; i >= 0; i--) {
    const tr = cr * (2.2 + i * 1.5);
    const ty = floorY + i * fh * 0.028;
    ctx.fillStyle = mix(C.void, C.surface2, 0.62 - i * 0.09, 0.75);
    ctx.beginPath();
    ctx.ellipse(glowX + (rand() - 0.5) * cr * 0.4, ty, tr * (1 + rand() * 0.08), tr * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = mix(C.ember, C.flame, 0.3, Math.max(0.02, 0.13 - i * 0.03));
    ctx.lineWidth = Math.max(1, s * 0.002);
    const a0 = Math.PI * (1.02 + rand() * 0.2);
    ctx.beginPath();
    ctx.ellipse(glowX, ty, tr * (0.94 + rand() * 0.12), tr * 0.25, 0, a0, a0 + Math.PI * (0.4 + rand() * 0.4));
    ctx.stroke();
  }
  // votive stubs left long ago at the monument's foot, all dead
  for (const [tx, thh] of [
    [0.19, 0.034],
    [0.245, 0.052],
    [0.29, 0.026],
    [0.76, 0.042],
    [0.815, 0.028],
  ] as const) {
    const vx = w * tx + (rand() - 0.5) * w * 0.008;
    const vh2 = s * thh;
    const vw2 = Math.max(3, s * 0.011);
    const vy = h * 0.81;
    ctx.fillStyle = shade(C.void, 0.7, 0.5); // melt pool shadow
    ctx.beginPath();
    ctx.ellipse(vx, vy, vw2 * 1.5, vw2 * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(C.parchmentAged, C.void, vx < glowX ? 0.78 : 0.85);
    ctx.fillRect(vx - vw2 / 2, vy - vh2, vw2, vh2);
    ctx.strokeStyle = mix(C.ember, C.parchmentAged, 0.5, 0.18);
    ctx.lineWidth = 1;
    const litSide = vx < glowX ? 1 : -1;
    line(vx + (litSide * vw2) / 2, vy - vh2 + 1, vx + (litSide * vw2) / 2, vy - 1);
    ctx.strokeStyle = shade(C.void, 0.9, 0.8);
    line(vx, vy - vh2, vx + vw2 * 0.2, vy - vh2 - vw2 * 0.5);
  }

  // ── 6. the stub's light — one warm breath rising from her hands ─────────
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pool = ctx.createRadialGradient(glowX, handY + cr * 0.3, cr * 0.2, glowX, handY + cr * 0.3, fh * 0.8);
  pool.addColorStop(0, shade(C.flame, 0.75, 0.5));
  pool.addColorStop(0.4, shade(C.ember, 0.7, 0.22));
  pool.addColorStop(1, shade(C.ember, 0.6, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(glowX - fh, handY - fh, fh * 2, fh * 1.5);
  ctx.restore();

  // ── 7. HER — the kneeling bell of colorless cloth, hood, half-turn ──────
  const robe = new Path2D();
  robe.moveTo(fx0 - fh * 0.44, hemY);
  robe.bezierCurveTo(fx0 - fh * 0.43, hemY - fh * 0.32, fx0 - shW * 1.16, shY + fh * 0.14, fx0 - shW, shY);
  robe.quadraticCurveTo(fx0 - shW * 0.6, shY - hr * 0.7, fx0 - hr * 1.3, fy0 + hr * 0.32);
  // hood — a soft peak, leaning with her turn
  robe.quadraticCurveTo(fx0 - hr * 1.52, fy0 - hr * 0.8, fx0 - hr * 0.45 + turn, fy0 - hr * 1.58);
  robe.quadraticCurveTo(fx0 + hr * 0.6 + turn, fy0 - hr * 1.64, fx0 + hr * 1.26, fy0 - hr * 0.5);
  robe.quadraticCurveTo(fx0 + hr * 1.44, fy0 + hr * 0.42, fx0 + shW * 0.52, shY - hr * 0.52);
  robe.quadraticCurveTo(fx0 + shW * 0.78, shY - hr * 0.2, fx0 + shW * 0.96, shY + hr * 0.12);
  robe.bezierCurveTo(fx0 + shW * 1.2, shY + fh * 0.16, fx0 + fh * 0.44, hemY - fh * 0.3, fx0 + fh * 0.46, hemY);
  robe.closePath();
  const robeG = ctx.createLinearGradient(0, headTop, 0, hemY);
  robeG.addColorStop(0, mix(C.inkSoft, C.surface2, 0.45));
  robeG.addColorStop(0.55, mix(C.inkSoft, C.void, 0.52));
  robeG.addColorStop(1, shade(C.void, 0.72));
  ctx.fillStyle = robeG;
  ctx.fill(robe);
  ctx.save();
  ctx.clip(robe);
  // the stub's warmth climbing her front — chest and the folds around it
  ctx.globalCompositeOperation = "lighter";
  const front = ctx.createRadialGradient(glowX, handY - cr * 0.4, cr * 0.3, glowX, handY - cr * 0.4, fh * 0.66);
  front.addColorStop(0, shade(C.flame, 0.7, 0.5));
  front.addColorStop(0.45, shade(C.ember, 0.65, 0.2));
  front.addColorStop(1, shade(C.ember, 0.6, 0));
  ctx.fillStyle = front;
  ctx.fillRect(fx0 - fh, headTop - hr, fh * 2, fh * 2);
  ctx.globalCompositeOperation = "source-over";
  // the fall of the cloth — creases radiating from the cupped light
  ctx.strokeStyle = shade(C.void, 0.7, 0.3);
  ctx.lineWidth = Math.max(1.2, fh * 0.009);
  for (const [ex, sag] of [
    [-0.36, 0.1],
    [-0.2, 0.04],
    [0.24, 0.05],
    [0.4, 0.12],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(glowX + ex * fh * 0.28, handY + fh * 0.03);
    ctx.quadraticCurveTo(fx0 + ex * fh * 0.7, handY + fh * (0.08 + sag), fx0 + ex * fh * 1.05, hemY + fh * 0.02);
    ctx.stroke();
  }
  // two soft shoulder creases falling toward the bowl
  ctx.strokeStyle = shade(C.void, 0.75, 0.3);
  for (const sx of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(fx0 + sx * shW * 0.66, shY + fh * 0.02);
    ctx.quadraticCurveTo(fx0 + sx * fh * 0.16, (shY + handY) / 2, glowX + sx * cr * 1.3, handY - cr * 1.1);
    ctx.stroke();
  }
  // knee masses pressing the cloth forward at the base
  ctx.fillStyle = shade(C.void, 0.8, 0.15);
  for (const sx of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(fx0 + sx * fh * 0.24, hemY - fh * 0.045, fh * 0.14, fh * 0.06, sx * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.2, s * 0.003);
  ctx.stroke(robe);
  // cool seam-light resting on her hood crown and left shoulder
  ctx.strokeStyle = mix(C.verdigris, C.verdigrisDim, 0.45, 0.5);
  ctx.lineWidth = Math.max(1.2, s * 0.0026);
  ctx.beginPath();
  ctx.moveTo(fx0 - hr * 1.32, fy0 - hr * 0.28);
  ctx.quadraticCurveTo(fx0 - hr * 1.24, fy0 - hr * 1.06, fx0 - hr * 0.42 + turn, fy0 - hr * 1.52);
  ctx.moveTo(fx0 - shW * 0.98, shY + hr * 0.05);
  ctx.quadraticCurveTo(fx0 - shW * 0.62, shY - hr * 0.6, fx0 - hr * 1.34, fy0 + hr * 0.36);
  ctx.stroke();
  // warm rim where the stub's light catches the hood's near edge
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.3, 0.55);
  ctx.lineWidth = Math.max(1.2, s * 0.0024);
  ctx.beginPath();
  ctx.moveTo(fx0 + hr * 1.36, fy0 + hr * 0.34);
  ctx.quadraticCurveTo(fx0 + hr * 1.02, fy0 + hr * 0.8, fx0 + shW * 0.62, shY - hr * 0.4);
  ctx.stroke();
  // a bone-dim thread down her dark flank, so she never melts into the void
  ctx.strokeStyle = shade(C.boneDim, 0.9, 0.2);
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(fx0 - shW * 1.02, shY + fh * 0.02);
  ctx.bezierCurveTo(fx0 - shW * 1.14, shY + fh * 0.14, fx0 - fh * 0.43, hemY - fh * 0.3, fx0 - fh * 0.44, hemY - fh * 0.02);
  ctx.stroke();

  // ── 8. the face — half-lit from below, patience and grief the size of years
  const hoodTilt = (turn / hr) * 0.16;
  const hood = new Path2D();
  hood.ellipse(fx0 + turn * 0.6, fy0 + hr * 0.05, hr * 0.64, hr * 0.86, hoodTilt, 0, Math.PI * 2);
  ctx.fillStyle = shade(C.void, 0.45);
  ctx.fill(hood);
  ctx.save();
  ctx.clip(hood);
  const fcx = fx0 + turn; // feature axis
  // skin base — dim, neither young nor old
  ctx.fillStyle = mix(C.bone, C.ink, 0.62);
  ctx.beginPath();
  ctx.ellipse(fcx, fy0 + hr * 0.08, hr * 0.58, hr * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  // underlight climbing the face from the cupped stub — and dying at the eyes
  const under = ctx.createLinearGradient(0, fy0 + hr * 0.86, 0, fy0 - hr * 0.16);
  under.addColorStop(0, mix(C.flame, C.parchment, 0.35, 1));
  under.addColorStop(0.4, mix(C.ember, C.parchment, 0.45, 0.48));
  under.addColorStop(1, shade(C.ember, 0.8, 0));
  ctx.fillStyle = under;
  ctx.beginPath();
  ctx.ellipse(fcx - hr * 0.02, fy0 + hr * 0.1, hr * 0.56, hr * 0.76, 0, 0, Math.PI * 2);
  ctx.fill();
  // the warmth pooling under her jaw where the hood gathers the light
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const jawGlow = ctx.createRadialGradient(fcx, fy0 + hr * 0.72, 0, fcx, fy0 + hr * 0.72, hr * 0.55);
  jawGlow.addColorStop(0, shade(C.flame, 0.6, 0.34));
  jawGlow.addColorStop(1, shade(C.flame, 0.6, 0));
  ctx.fillStyle = jawGlow;
  ctx.fillRect(fcx - hr * 0.6, fy0 + hr * 0.15, hr * 1.2, hr * 1.1);
  ctx.restore();
  // chin-side rim — the one edge the light traces as she turns to us
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.35, 0.5);
  ctx.lineWidth = Math.max(1, hr * 0.032);
  ctx.beginPath();
  ctx.ellipse(fcx, fy0 + hr * 0.08, hr * 0.53, hr * 0.73, 0, Math.PI * 0.34, Math.PI * 0.62);
  ctx.stroke();
  // the lit underside of the nose — a small plane, nothing more
  ctx.fillStyle = mix(C.flame, C.parchment, 0.42, 0.8);
  ctx.beginPath();
  ctx.moveTo(fcx - hr * 0.1, fy0 + hr * 0.25);
  ctx.quadraticCurveTo(fcx, fy0 + hr * 0.18, fcx + hr * 0.09, fy0 + hr * 0.24);
  ctx.quadraticCurveTo(fcx, fy0 + hr * 0.31, fcx - hr * 0.1, fy0 + hr * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(C.void, 0.8, 0.28); // shadow the nose throws upward
  ctx.beginPath();
  ctx.moveTo(fcx - hr * 0.06, fy0 + hr * 0.2);
  ctx.quadraticCurveTo(fcx, fy0 + hr * 0.1, fcx + hr * 0.055, fy0 + hr * 0.19);
  ctx.quadraticCurveTo(fcx, fy0 + hr * 0.02, fcx - hr * 0.06, fy0 + hr * 0.2);
  ctx.closePath();
  ctx.fill();
  // philtrum shade; the mouth nearly level — corners weighted a breath,
  // grief carried, not performed; lit lower lip, bright chin
  ctx.strokeStyle = shade(C.ink, 0.5, 0.85);
  ctx.lineWidth = Math.max(1, hr * 0.032);
  ctx.beginPath();
  ctx.moveTo(fcx - hr * 0.15, fy0 + hr * 0.474);
  ctx.quadraticCurveTo(fcx, fy0 + hr * 0.455, fcx + hr * 0.14, fy0 + hr * 0.469);
  ctx.stroke();
  ctx.strokeStyle = mix(C.flame, C.parchment, 0.3, 0.7);
  ctx.lineWidth = Math.max(1, hr * 0.028);
  ctx.beginPath();
  ctx.moveTo(fcx - hr * 0.1, fy0 + hr * 0.54);
  ctx.quadraticCurveTo(fcx, fy0 + hr * 0.555, fcx + hr * 0.09, fy0 + hr * 0.535);
  ctx.stroke();
  ctx.fillStyle = mix(C.flame, C.parchment, 0.4, 0.45);
  ctx.beginPath();
  ctx.ellipse(fcx - hr * 0.01, fy0 + hr * 0.68, hr * 0.14, hr * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  // faint warmth finding the cheekbones on its way up
  for (const sx of [-1, 1] as const) {
    ctx.strokeStyle = mix(C.ember, C.parchment, 0.45, sx < 0 ? 0.24 : 0.18);
    ctx.lineWidth = Math.max(1, hr * 0.045);
    ctx.beginPath();
    ctx.arc(fcx + sx * hr * 0.3, fy0 + hr * 0.14, hr * 0.2, Math.PI * 0.3, Math.PI * 0.7);
    ctx.stroke();
  }
  // hood shadow drawn down over the brow — the upper face keeps its dark
  const browShade = ctx.createLinearGradient(0, fy0 - hr * 0.95, 0, fy0 + hr * 0.1);
  browShade.addColorStop(0, shade(C.void, 0.5, 1));
  browShade.addColorStop(0.58, shade(C.void, 0.5, 0.6));
  browShade.addColorStop(1, shade(C.void, 0.5, 0));
  ctx.fillStyle = browShade;
  ctx.fillRect(fcx - hr, fy0 - hr * 1.1, hr * 2, hr * 1.22);
  // ── the eyes: a reflected flame that cannot be the stub ──
  for (const sx of [-1, 1] as const) {
    const ex = fcx + sx * hr * 0.26;
    const ey = fy0 - hr * 0.08;
    // a breath of warm light finds each eye in the shadow
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const eyeGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, hr * 0.2);
    eyeGlow.addColorStop(0, shade(C.ember, 0.8, 0.3));
    eyeGlow.addColorStop(1, shade(C.ember, 0.8, 0));
    ctx.fillStyle = eyeGlow;
    ctx.fillRect(ex - hr * 0.22, ey - hr * 0.22, hr * 0.44, hr * 0.44);
    ctx.restore();
    // white — dim, calm
    ctx.fillStyle = mix(C.bone, C.ink, 0.42, 0.85);
    ctx.beginPath();
    ctx.ellipse(ex, ey, hr * 0.14, hr * 0.068, sx * 0.05, 0, Math.PI * 2);
    ctx.fill();
    // iris
    ctx.fillStyle = shade(C.ink, 0.55);
    ctx.beginPath();
    ctx.arc(ex, ey + hr * 0.004, hr * 0.068, 0, Math.PI * 2);
    ctx.fill();
    // the true glint — where the stub SHOULD reflect: low, small, feeble
    ctx.fillStyle = mix(C.ember, C.flame, 0.5, 0.5);
    ctx.beginPath();
    ctx.arc(ex - sx * hr * 0.018, ey + hr * 0.042, hr * 0.013, 0, Math.PI * 2);
    ctx.fill();
    // the memory — tall, upright, both leaning the same way; it overruns
    // the lid by a hair, as reflections cannot
    drop(ex + hr * 0.01, ey + hr * 0.052, hr * 0.26, hr * 0.028, hr * 0.014, shade(C.flame, 1.05, 0.95));
    drop(ex + hr * 0.01, ey + hr * 0.048, hr * 0.18, hr * 0.017, hr * 0.009, shade(C.flameHi, 1.3));
    // heavy upper lid — patience, not sleep
    ctx.strokeStyle = shade(C.void, 0.75, 0.9);
    ctx.lineWidth = Math.max(1.2, hr * 0.042);
    ctx.beginPath();
    ctx.ellipse(ex, ey + hr * 0.002, hr * 0.14, hr * 0.062, sx * 0.05, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
    // a thread of warm light on the lower lid
    ctx.strokeStyle = mix(C.flame, C.parchment, 0.4, 0.5);
    ctx.lineWidth = Math.max(1, hr * 0.018);
    ctx.beginPath();
    ctx.ellipse(ex, ey + hr * 0.008, hr * 0.126, hr * 0.06, sx * 0.05, Math.PI * 0.22, Math.PI * 0.78);
    ctx.stroke();
    // brow in the hood's dark — the inner end lifted a breath, no more
    ctx.strokeStyle = shade(C.ink, 0.45, 0.55);
    ctx.lineWidth = Math.max(1, hr * 0.035);
    ctx.beginPath();
    ctx.moveTo(ex + sx * hr * 0.15, ey - hr * 0.12);
    ctx.quadraticCurveTo(ex + sx * hr * 0.02, ey - hr * 0.135, ex - sx * hr * 0.11, ey - hr * 0.175);
    ctx.stroke();
    // the stub's light finds the lift's underside, or it would stay unread
    ctx.strokeStyle = mix(C.ember, C.parchment, 0.45, sx < 0 ? 0.22 : 0.16);
    ctx.lineWidth = Math.max(1, hr * 0.014);
    ctx.beginPath();
    ctx.moveTo(ex + sx * hr * 0.05, ey - hr * 0.112);
    ctx.quadraticCurveTo(ex - sx * hr * 0.03, ey - hr * 0.128, ex - sx * hr * 0.1, ey - hr * 0.158);
    ctx.stroke();
  }
  // ── tear tracks dried to wax — years of weeping, kept the way the wax
  // keeps everything; thin translucent ridges down both cheeks, their edges
  // catching more of the stub's light the lower they fall toward it ──
  ctx.lineCap = "round";
  for (const sx of [-1, 1] as const) {
    const tx0 = fcx + sx * hr * 0.27; // just under the lower lid
    const ty0 = fy0 + hr * 0.02;
    const ty1 = fy0 + hr * 0.6; // dies out along the jaw
    // an older, fainter ridge just outboard — these have layered for years
    ctx.strokeStyle = mix(C.parchmentAged, C.bone, 0.4, 0.09);
    ctx.lineWidth = Math.max(1, hr * 0.016);
    ctx.beginPath();
    ctx.moveTo(tx0 + sx * hr * 0.06, ty0 + hr * 0.05);
    ctx.quadraticCurveTo(tx0 + sx * hr * 0.09, fy0 + hr * 0.24, tx0 + sx * hr * 0.05, fy0 + hr * 0.42);
    ctx.stroke();
    // the ridge body — wax gone translucent, one shade off the skin
    ctx.strokeStyle = mix(C.parchmentAged, C.bone, 0.4, sx < 0 ? 0.2 : 0.15);
    ctx.lineWidth = Math.max(1, hr * 0.022);
    ctx.beginPath();
    ctx.moveTo(tx0, ty0);
    ctx.quadraticCurveTo(tx0 + sx * hr * 0.03, fy0 + hr * 0.22, tx0 - sx * hr * 0.02, fy0 + hr * 0.38);
    ctx.quadraticCurveTo(tx0 - sx * hr * 0.05, fy0 + hr * 0.48, tx0 - sx * hr * 0.045, ty1);
    ctx.stroke();
    // the lit edge — a drip-line in miniature, brightening toward the flame
    const trackLit = ctx.createLinearGradient(0, ty0, 0, ty1);
    trackLit.addColorStop(0, mix(C.flame, C.parchment, 0.35, 0.1));
    trackLit.addColorStop(1, mix(C.flame, C.parchment, 0.35, sx < 0 ? 0.42 : 0.32));
    ctx.strokeStyle = trackLit;
    ctx.lineWidth = Math.max(1, hr * 0.011);
    ctx.beginPath();
    ctx.moveTo(tx0 - sx * hr * 0.008, ty0 + hr * 0.03);
    ctx.quadraticCurveTo(tx0 + sx * hr * 0.02, fy0 + hr * 0.22, tx0 - sx * hr * 0.028, fy0 + hr * 0.38);
    ctx.quadraticCurveTo(tx0 - sx * hr * 0.058, fy0 + hr * 0.48, tx0 - sx * hr * 0.052, ty1 - hr * 0.02);
    ctx.stroke();
    // the frozen bead where the last of it stopped — the same mark her
    // forearms carry; she is becoming what she keeps
    ctx.fillStyle = mix(C.parchment, C.flame, 0.28, 0.4);
    ctx.beginPath();
    ctx.arc(tx0 - sx * hr * 0.045, ty1, Math.max(1, hr * 0.018), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineCap = "butt";
  // one fresh tear at the lower lid of the brighter eye — the first face in
  // twenty years; it wells and has not yet learned to fall
  const teX = fcx - hr * 0.28;
  const teY = fy0 - hr * 0.005;
  ctx.fillStyle = mix(C.bone, C.flame, 0.4, 0.28); // the water, barely
  ctx.beginPath();
  ctx.ellipse(teX, teY, hr * 0.022, hr * 0.028, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(C.flameHi, 1.25, 0.95); // a single gold glint
  ctx.beginPath();
  ctx.arc(teX - hr * 0.006, teY + hr * 0.009, Math.max(0.6, hr * 0.009), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore(); // ← end hood-opening clip
  // the hood's inner rim below the chin, catching the light from her hands
  ctx.strokeStyle = mix(C.ember, C.parchment, 0.4, 0.5);
  ctx.lineWidth = Math.max(1.2, s * 0.0022);
  ctx.beginPath();
  ctx.ellipse(fx0 + turn * 0.6, fy0, hr * 0.68, hr * 0.94, hoodTilt, Math.PI * 0.3, Math.PI * 0.74);
  ctx.stroke();

  // ── 9. the braid — falling forward over her shoulder, singed at the tip ─
  const brP = (t: number): [number, number] => {
    const bx = fx0 + hr * (0.62 + Math.sin(t * Math.PI * 1.05) * 0.46 - t * 0.1);
    const by = fy0 + hr * 0.74 + t * (handY - fh * 0.28 - (fy0 + hr * 0.74));
    return [bx, by];
  };
  // one smooth tapered strand — three passes, widest first
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [wk, col] of [
    [1, mix(C.ink, C.boneDim, 0.24)],
    [0.62, mix(C.ink, C.boneDim, 0.34)],
  ] as const) {
    for (let t = 0; t < 0.995; t += 0.05) {
      const [bx, by] = brP(t);
      const [nx, ny] = brP(Math.min(1, t + 0.055));
      ctx.strokeStyle = t > 0.92 ? shade(C.void, 1.2) : col;
      ctx.lineWidth = Math.max(1.4, fh * 0.024 * wk * (1 - t * 0.62));
      line(bx, by, nx, ny);
    }
  }
  // plait knots — small dark pinches, not ladder rungs
  ctx.strokeStyle = shade(C.void, 0.9, 0.55);
  ctx.lineWidth = Math.max(1, fh * 0.005);
  for (let t = 0.07; t < 0.86; t += 0.085) {
    const [bx, by] = brP(t);
    const bw2 = fh * 0.01 * (1 - t * 0.45);
    ctx.beginPath();
    ctx.moveTo(bx - bw2, by - bw2 * 0.6);
    ctx.quadraticCurveTo(bx, by + bw2 * 0.9, bx + bw2, by - bw2 * 0.6);
    ctx.stroke();
  }
  // a thin warm thread down the flame side of the strand
  ctx.strokeStyle = mix(C.ember, C.flame, 0.4, 0.35);
  ctx.lineWidth = Math.max(1, fh * 0.005);
  ctx.beginPath();
  for (let t = 0.1; t < 0.85; t += 0.05) {
    const [bx, by] = brP(t);
    if (t === 0.1) ctx.moveTo(bx - fh * 0.009, by);
    else ctx.lineTo(bx - fh * 0.009, by);
  }
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  // one ember still thinking about the singed tip
  const [tipX, tipY] = brP(1);
  ctx.fillStyle = mix(C.ember, C.flame, 0.45, 0.85);
  ctx.beginPath();
  ctx.arc(tipX, tipY + fh * 0.004, Math.max(1, fh * 0.0055), 0, Math.PI * 2);
  ctx.fill();

  // ── 10. arms and the WAX HANDS — she is becoming what she keeps ─────────
  // wrists a fraction closer than the shipped plate — protective, tired
  const wristL = { x: glowX - cr * 0.9, y: handY - cr * 0.12 };
  const wristR = { x: glowX + cr * 0.93, y: handY - cr * 0.06 };
  ctx.lineCap = "round";
  for (const [sx, wr] of [
    [-1, wristL],
    [1, wristR],
  ] as const) {
    // sleeve: shoulder → elbow, cloth ending mid-forearm — a step lighter
    // than the robe so the arm reads before the wax begins
    ctx.strokeStyle = mix(C.inkSoft, C.surface2, 0.3);
    ctx.lineWidth = fh * 0.074;
    ctx.beginPath();
    ctx.moveTo(fx0 + sx * shW * 0.66, shY + fh * 0.09);
    ctx.quadraticCurveTo(fx0 + sx * fh * 0.13, handY - fh * 0.24, wr.x + sx * cr * 1.15, wr.y - cr * 0.95);
    ctx.stroke();
    // shadow beneath the sleeve, parting it from the robe
    ctx.strokeStyle = shade(C.void, 0.6, 0.3);
    ctx.lineWidth = Math.max(1.2, fh * 0.01);
    ctx.beginPath();
    ctx.moveTo(fx0 + sx * shW * 0.78, shY + fh * 0.13);
    ctx.quadraticCurveTo(fx0 + sx * fh * 0.17, handY - fh * 0.21, wr.x + sx * cr * 1.35, wr.y - cr * 0.8);
    ctx.stroke();
    // warm edge along the sleeve's glow side
    ctx.strokeStyle = mix(C.ember, C.flame, 0.35, 0.4);
    ctx.lineWidth = Math.max(1.2, fh * 0.009);
    ctx.beginPath();
    ctx.moveTo(fx0 + sx * shW * 0.5, shY + fh * 0.12);
    ctx.quadraticCurveTo(fx0 + sx * fh * 0.17, handY - fh * 0.17, wr.x + sx * cr * 1.1, wr.y - cr * 0.72);
    ctx.stroke();
    // the bare forearm past the cuff — gone translucent as wax
    ctx.strokeStyle = mix(C.parchmentAged, C.ember, 0.32, 0.82);
    ctx.lineWidth = fh * 0.038;
    ctx.beginPath();
    ctx.moveTo(wr.x + sx * cr * 1.02, wr.y - cr * 0.72);
    ctx.quadraticCurveTo(wr.x + sx * cr * 0.5, wr.y - cr * 0.32, wr.x, wr.y);
    ctx.stroke();
    // light INSIDE the arm — a warmer core along the same line
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = shade(C.flame, 0.85, 0.55);
    ctx.lineWidth = fh * 0.018;
    ctx.beginPath();
    ctx.moveTo(wr.x + sx * cr * 0.84, wr.y - cr * 0.55);
    ctx.quadraticCurveTo(wr.x + sx * cr * 0.4, wr.y - cr * 0.24, wr.x, wr.y - cr * 0.02);
    ctx.stroke();
    ctx.restore();
    // the cuff line where cloth gives way to what she is becoming
    ctx.strokeStyle = shade(C.void, 0.7, 0.6);
    ctx.lineWidth = Math.max(1.2, fh * 0.008);
    ctx.beginPath();
    ctx.moveTo(wr.x + sx * cr * 1.3, wr.y - cr * 1.05);
    ctx.quadraticCurveTo(wr.x + sx * cr * 1.05, wr.y - cr * 0.85, wr.x + sx * cr * 0.95, wr.y - cr * 0.55);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // the cupped bowl of hands around the stub
  const cup = new Path2D();
  cup.moveTo(wristL.x - cr * 0.2, wristL.y - cr * 0.42);
  cup.bezierCurveTo(glowX - cr * 1.18, handY + cr * 0.36, glowX - cr * 0.55, handY + cr * 0.78, glowX + cr * 0.08, handY + cr * 0.76);
  cup.bezierCurveTo(glowX + cr * 0.66, handY + cr * 0.72, glowX + cr * 1.2, handY + cr * 0.26, wristR.x + cr * 0.18, wristR.y - cr * 0.38);
  // inner rim — fingertips curling up over the light, knuckle by knuckle
  cup.quadraticCurveTo(glowX + cr * 0.86, handY - cr * 0.62, glowX + cr * 0.62, handY - cr * 0.56);
  cup.quadraticCurveTo(glowX + cr * 0.44, handY - cr * 0.78, glowX + cr * 0.2, handY - cr * 0.6);
  cup.quadraticCurveTo(glowX - cr * 0.02, handY - cr * 0.82, glowX - cr * 0.26, handY - cr * 0.62);
  cup.quadraticCurveTo(glowX - cr * 0.5, handY - cr * 0.8, glowX - cr * 0.7, handY - cr * 0.56);
  cup.quadraticCurveTo(glowX - cr * 0.92, handY - cr * 0.62, wristL.x - cr * 0.2, wristL.y - cr * 0.42);
  cup.closePath();
  const cupG = ctx.createLinearGradient(0, handY + cr * 0.8, 0, handY - cr * 0.8);
  cupG.addColorStop(0, mix(C.parchmentAged, C.ink, 0.5));
  cupG.addColorStop(1, mix(C.parchmentAged, C.ember, 0.28));
  ctx.fillStyle = cupG;
  ctx.fill(cup);
  ctx.save();
  ctx.clip(cup);
  // the stub burning inside — its light soaking through the wax of her
  ctx.globalCompositeOperation = "lighter";
  const through = ctx.createRadialGradient(glowX, handY - cr * 0.15, 0, glowX, handY - cr * 0.15, cr * 1.4);
  through.addColorStop(0, shade(C.flame, 1, 0.9));
  through.addColorStop(0.4, shade(C.flame, 0.75, 0.42));
  through.addColorStop(1, shade(C.ember, 0.7, 0));
  ctx.fillStyle = through;
  ctx.fillRect(glowX - cr * 1.5, handY - cr * 1.6, cr * 3, cr * 3.2);
  ctx.globalCompositeOperation = "source-over";
  // finger separations — short dark threads down from the rim
  ctx.strokeStyle = mix(C.ink, C.ember, 0.3, 0.55);
  ctx.lineWidth = Math.max(1, cr * 0.05);
  for (const fsx of [-0.48, -0.03, 0.42] as const) {
    ctx.beginPath();
    ctx.moveTo(glowX + cr * fsx, handY - cr * 0.62);
    ctx.quadraticCurveTo(glowX + cr * fsx * 1.12, handY - cr * 0.2, glowX + cr * fsx * 1.35, handY + cr * 0.3);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = shade(C.ink, 0.7, 0.75);
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.stroke(cup);
  // fingertip rims catching the flame
  ctx.strokeStyle = shade(C.flameHi, 1.1, 0.8);
  ctx.lineWidth = Math.max(1, cr * 0.045);
  for (const [fsx, fw] of [
    [-0.38, 0.2],
    [0.09, 0.22],
    [0.53, 0.18],
  ] as const) {
    ctx.beginPath();
    ctx.arc(glowX + cr * fsx, handY - cr * 0.48, cr * fw, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  // ONE flame — what is left of the First Flame, standing over the rim
  drop(glowX + cr * 0.06, handY - cr * 0.52, cr * 0.72, cr * 0.115, cr * 0.03, shade(C.flame, 1.05, 0.95));
  drop(glowX + cr * 0.06, handY - cr * 0.56, cr * 0.46, cr * 0.07, cr * 0.015, shade(C.flameHi, 1.25));
  // wax run off her hands onto the terrace — hers or the stub's, who knows
  ctx.strokeStyle = mix(C.parchment, C.ember, 0.36, 0.4);
  ctx.lineWidth = Math.max(1, fh * 0.007);
  ctx.lineCap = "round";
  for (const dxr of [-0.55, 0.3] as const) {
    line(glowX + cr * dxr, handY + cr * 0.68, glowX + cr * dxr * 1.06, handY + cr * (0.98 + rand() * 0.22));
  }
  // drip-lines frozen down the wax forearms
  for (const [sx, wr] of [
    [-1, wristL],
    [1, wristR],
  ] as const) {
    ctx.strokeStyle = mix(C.parchment, C.flame, 0.24, 0.45);
    ctx.lineWidth = Math.max(1, fh * 0.006);
    for (let d = 0; d < 2; d++) {
      const t = 0.3 + d * 0.36;
      const dx = wr.x + sx * cr * (0.9 - t * 0.8);
      const dy = wr.y - cr * (0.55 - t * 0.5) + cr * 0.16;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.quadraticCurveTo(dx + sx * cr * 0.03, dy + cr * (0.14 + rand() * 0.1), dx + sx * cr * 0.015, dy + cr * (0.26 + rand() * 0.12));
      ctx.stroke();
      ctx.fillStyle = mix(C.parchment, C.flame, 0.28, 0.5); // the frozen bead
      ctx.beginPath();
      ctx.arc(dx + sx * cr * 0.015, dy + cr * 0.3, Math.max(1, fh * 0.0045), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.lineCap = "butt";
  // one last bloom of light over the hands, under her chin
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const bloom = ctx.createRadialGradient(glowX, handY - cr * 0.5, 0, glowX, handY - cr * 0.5, cr * 2.4);
  bloom.addColorStop(0, shade(C.flameHi, 0.72, 0.32));
  bloom.addColorStop(0.5, shade(C.flame, 0.6, 0.12));
  bloom.addColorStop(1, shade(C.ember, 0.6, 0));
  ctx.fillStyle = bloom;
  ctx.fillRect(glowX - cr * 2.6, handY - cr * 3, cr * 5.2, cr * 5.2);
  ctx.restore();

  // ── 11. warm dust adrift in her light; the rest of the air stands still ─
  for (let i = 0; i < 22; i++) {
    const mx = glowX + (rand() - 0.5) * fh * 0.9;
    const my = handY - rand() * fh * 0.75;
    const near = Math.hypot(mx - glowX, my - handY) < fh * 0.45;
    ctx.fillStyle = near
      ? mix(C.flameHi, C.bone, 0.45, 0.07 + rand() * 0.12)
      : mix(C.bone, C.ember, 0.3, 0.04 + rand() * 0.07);
    ctx.beginPath();
    ctx.arc(mx, my, 0.5 + rand() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 12. grain, crush, settle, vignette — the plate goes quiet ───────────
  for (let i = 0; i < 560; i++) {
    const gx = rand() * w;
    const gy = rand() * h * 0.82;
    ctx.fillStyle = rand() < 0.5 ? shade(C.bone, 1, 0.015 + rand() * 0.025) : shade(C.void, 0.3, 0.03 + rand() * 0.03);
    ctx.fillRect(gx, gy, 1, 1);
  }
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.16);
  crush.addColorStop(0, shade(C.void, 0.6, 0.7));
  crush.addColorStop(1, shade(C.void, 0.6, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.16);
  const settle = ctx.createLinearGradient(0, h * 0.78, 0, h);
  settle.addColorStop(0, shade(C.void, 0.55, 0));
  settle.addColorStop(0.55, shade(C.void, 0.55, 0.55));
  settle.addColorStop(1, shade(C.void, 0.5, 0.88));
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
    v.addColorStop(0, shade(C.void, 0.5, 0.45));
    v.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}
