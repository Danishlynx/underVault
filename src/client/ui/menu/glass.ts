/**
 * The pane (D86) — the Crysis-menu grammar translated into our fiction:
 * the vigil is seen through the Guildhall's old window glass. Painted
 * once per resize ABOVE the backdrop and the live flame, BELOW the type:
 * beads of damp with light-facing glints, run-lines where beads let go,
 * a breath of grime in the corners, hairline scratches, and a broad
 * specular sheen. Subtle by law (04 §5): the pane reads at second glance
 * and thins out over the menu column so it never fights the text.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";
import type { MenuGeom } from "./backdrop.js";

// Private LCG (same law as the hall/menu: never touch paint.ts crand()).
function glassRand(seed: number): () => number {
  let s = seed >>> 0 || 0x61a5;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** The calm column reserved for the menu list — beads mostly skip it. */
function inColumn(x: number, y: number, w: number, h: number): boolean {
  return x > w * 0.28 && x < w * 0.72 && y > h * 0.18 && y < h * 0.8;
}

export function paintGlassOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  geom: MenuGeom,
): void {
  const C = COLOR_CSS;
  const rand = glassRand(0x61a5);
  const lightX = geom.flameX * w;
  const lightY = geom.flameY * h;
  const m = Math.min(w, h);

  // ── 1. corner grime — condensation breathing in from the frame ────────
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ];
  for (const [cx, cy] of corners) {
    const r = m * (0.42 + rand() * 0.14);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, shade(C.surface, 0.55, 0.2));
    g.addColorStop(0.6, shade(C.surface, 0.55, 0.07));
    g.addColorStop(1, shade(C.surface, 0.55, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // frost fleck hugging the corner — kept dim and tight: pale specks in
    // the crown dark read as STARS, and we are under miles of stone
    for (let i = 0; i < 8; i++) {
      const a = rand() * Math.PI * 2;
      const d = rand() * rand() * r * 0.38;
      ctx.fillStyle = shade(C.boneDim, 1, 0.02 + rand() * 0.03);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.4 + rand() * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 2. specular sheen — light lying on the pane at an angle ───────────
  const sheen = (x0: number, tilt: number, span: number, color: string, a: number): void => {
    ctx.save();
    ctx.translate(x0, 0);
    ctx.rotate(tilt);
    const g = ctx.createLinearGradient(0, 0, span, 0);
    g.addColorStop(0, shade(color, 1, 0));
    g.addColorStop(0.5, shade(color, 1, a));
    g.addColorStop(1, shade(color, 1, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-span, -h, span * 3, h * 3);
    ctx.restore();
  };
  sheen(w * 0.3, -0.3, m * 0.34, C.parchment, 0.028);
  sheen(w * 0.72, -0.26, m * 0.2, C.parchment, 0.02);
  // a warmer breath where the flame meets the glass
  sheen(lightX + m * 0.06, -0.34, m * 0.16, mix(C.flameHi, C.parchment, 0.5), 0.022);

  // ── 3. wipe streaks — old cleaning smears near (never ON) the edges:
  // a streak flush with the frame reads as a second frame rule ──────────
  for (let i = 0; i < 9; i++) {
    const edgeBias = rand() < 0.7;
    const x = edgeBias
      ? rand() < 0.5
        ? w * (0.06 + rand() * 0.18)
        : w * (0.94 - rand() * 0.18)
      : rand() * w;
    const sw = 5 + rand() * 16;
    const sh = h * (0.25 + rand() * 0.5);
    const y0 = rand() * (h - sh);
    const g = ctx.createLinearGradient(x, y0, x, y0 + sh);
    g.addColorStop(0, shade(C.parchment, 1, 0));
    g.addColorStop(0.5, shade(C.parchment, 1, 0.012 + rand() * 0.02));
    g.addColorStop(1, shade(C.parchment, 1, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - sw / 2, y0, sw, sh);
  }

  // ── 4. beads of damp — the Crysis droplets, candle-lit ────────────────
  const count = Math.max(60, Math.min(140, Math.round((w * h) / 9000)));
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    if (inColumn(x, y, w, h) && rand() < 0.8) continue;
    // the crown stays DARK — no beads at all in the top band (audit:
    // any bright point over black up there sky-reads as a star)
    if (y < h * 0.3) continue;
    // beads cluster where they have context — near the frame edges and
    // the lower pane, over grime and folio, not floating in open void
    // (audit: an isolated bead in darkness read as "a tenth vigil light")
    const nearEdge = x < w * 0.2 || x > w * 0.8 || y > h * 0.78;
    if (!nearEdge && rand() < 0.75) continue;
    const big = rand() < 0.14;
    const r = 0.8 + rand() * 2 + (big ? 1.5 + rand() * 2.5 : 0);
    const dx = lightX - x;
    const dy = lightY - y;
    const dist = Math.hypot(dx, dy) || 1;
    const lx = dx / dist;
    const ly = dy / dist;

    // a few heavy beads have let go — runs only inside the candle's
    // glow context, where a wet streak has something to catch
    if (big && rand() < 0.5 && y > h * 0.5 && x < w * 0.45) {
      const run = r * (4 + rand() * 6);
      const g = ctx.createLinearGradient(x, y, x + r * 0.3, y + run);
      g.addColorStop(0, shade(C.parchment, 1, 0.04));
      g.addColorStop(1, shade(C.parchment, 1, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(0.6, r * 0.35);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + r * (rand() - 0.5), y + run * 0.6, x + r * 0.3, y + run);
      ctx.stroke();
    }

    // lens body — a breath lighter than whatever is behind it
    ctx.fillStyle = shade(C.surface, 1.6, 0.12 + rand() * 0.06);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // shadowed rim on the side away from the light
    ctx.strokeStyle = shade(C.void, 0.6, 0.22);
    ctx.lineWidth = Math.max(0.5, r * 0.18);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.82, Math.atan2(-ly, -lx) - 1.1, Math.atan2(-ly, -lx) + 1.1);
    ctx.stroke();
    // the glint, facing the flame — modest, so no bead impersonates a
    // vigil light in the dark
    const glintWarm = dist < m * 0.42;
    ctx.fillStyle = glintWarm
      ? shade(C.flameHi, 1, 0.22 + rand() * 0.16)
      : shade(C.parchment, 1, 0.16 + rand() * 0.14);
    ctx.beginPath();
    ctx.arc(x + lx * r * 0.38, y + ly * r * 0.38, Math.max(0.5, r * 0.26), 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 5. hairline scratches — the pane has been wiped for generations.
  // Lower half only: a lone stroke in the crown dark reads as a stray. ──
  for (let i = 0; i < 4; i++) {
    const x0 = rand() * w;
    const y0 = h * (0.45 + rand() * 0.5);
    const len = m * (0.12 + rand() * 0.22);
    const a = rand() * Math.PI;
    ctx.strokeStyle = shade(C.boneDim, 1, 0.03 + rand() * 0.03);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(
      x0 + Math.cos(a + 0.2) * len * 0.5,
      y0 + Math.sin(a + 0.2) * len * 0.5,
      x0 + Math.cos(a) * len,
      y0 + Math.sin(a) * len,
    );
    ctx.stroke();
  }
}
