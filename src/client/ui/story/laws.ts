/**
 * Story slide 3 — "The Vault changed its terms."
 *
 * A buried hall of law: a wall of carved glyph tablets (the game's
 * inscription stones) recedes into cool fog. Two tablets are visibly
 * REWRITING themselves — old carved dashes fragment and dissolve into a
 * spray of verdigris motes at one edge while new, stranger marks glow
 * faintly at the other. A third tablet has cracked through. The unease
 * slide: verdigris-dominant, almost no warmth — one lone dying candle
 * whispers amber at the flank.
 *
 * Pure 2D-canvas painting (no Phaser, no assets). Colors only via tokens +
 * shade()/mix(); silhouettes closed with thin ink outlines for the woodcut
 * read. The center-bottom third is kept calm and dark for the caption.
 */

import { COLOR_CSS } from "../../../../design/tokens/tokens.js";
import { shade, mix } from "../../render/paint.js";

// Private LCG — same idiom as guildhall's hallRand, own seed. Never
// Math.random, never paint.ts crand() (its stream is shared with the
// world-texture painters).
function lawsRand(seed: number): () => number {
  let s = seed >>> 0 || 0x1a35;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

type TabletMode = "plain" | "rewriteL" | "rewriteR" | "cracked";

export function paintLaws(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const C = COLOR_CSS;
  const rand = lawsRand(0x1a35);

  // ── 1. base void gradient — cool throughout, no warm uplight ─────────────
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, shade(C.void, 0.85));
  base.addColorStop(0.35, mix(C.void, C.surface, 0.45));
  base.addColorStop(0.6, mix(C.void, C.surface, 0.28));
  base.addColorStop(1, shade(C.void, 0.75));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // ── 2. far architecture — fog stop 1, hazy arch masses above the wall ────
  ctx.fillStyle = mix(C.void, C.surface, 0.3);
  for (let i = 0; i < 3; i++) {
    const aw = (0.2 + rand() * 0.14) * w;
    const ax = (0.14 + i * 0.32 + rand() * 0.08) * w - aw / 2;
    const atop = h * (0.01 + rand() * 0.05);
    ctx.beginPath();
    ctx.moveTo(ax, h * 0.3);
    ctx.lineTo(ax, atop + aw / 2);
    ctx.arc(ax + aw / 2, atop + aw / 2, aw / 2, Math.PI, 0);
    ctx.lineTo(ax + aw, h * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  // ── wall geometry: 4 × 3 tablets, all in the upper half ──────────────────
  const wallW = Math.min(w * 0.88, Math.max(320, h * 0.78));
  const wallX = (w - wallW) / 2;
  const wallTop = h * 0.075;
  const wallH = h * 0.5;
  const wallBot = wallTop + wallH;
  const cols = 4;
  const rows = 3;
  const colW = wallW / cols;
  const rowH = wallH / rows;
  const colCx = (c: number): number => wallX + (c + 0.5) * colW;
  const rowCy = (r: number): number => wallTop + (r + 0.5) * rowH;

  // ── 3. cold ambient breath behind the rewriting stones ───────────────────
  const ambient = (cx: number, cy: number, r: number, a: number): void => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, mix(C.void, C.verdigris, 0.5, a));
    g.addColorStop(1, mix(C.void, C.verdigris, 0.5, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  ambient(colCx(1), rowCy(1), wallW * 0.42, 0.14);
  ambient(colCx(2), rowCy(0), wallW * 0.3, 0.1);

  // ── 4. the wall backing panel ─────────────────────────────────────────────
  ctx.fillStyle = mix(C.void, C.surface, 0.55);
  ctx.fillRect(wallX - 10, wallTop - 12, wallW + 20, wallH + 20);
  ctx.strokeStyle = shade(C.void, 0.7, 0.9);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(wallX - 10, wallTop - 12, wallW + 20, wallH + 20);
  // shelf shadows under each rank of stones
  ctx.fillStyle = shade(C.void, 0.75, 0.5);
  for (let r = 1; r <= rows; r++) {
    ctx.fillRect(wallX - 10, wallTop + r * rowH - 2, wallW + 20, 2);
  }

  // ── tablet painters ───────────────────────────────────────────────────────
  const tabletPath = (x: number, y: number, tw: number, th: number): void => {
    const rt = tw * 0.16;
    ctx.beginPath();
    ctx.moveTo(x, y + th);
    ctx.lineTo(x, y + rt);
    ctx.quadraticCurveTo(x, y, x + rt, y);
    ctx.lineTo(x + tw - rt, y);
    ctx.quadraticCurveTo(x + tw, y, x + tw, y + rt);
    ctx.lineTo(x + tw, y + th);
    ctx.closePath();
  };

  // Rows of faint carved dashes; fade(fx∈0..1 across the stone) thins and
  // fragments the old law toward a dissolving edge.
  const carveGlyphs = (
    x: number,
    y: number,
    tw: number,
    th: number,
    fade: (fx: number) => number,
    dim = 1,
  ): void => {
    const padX = tw * 0.13;
    const rowGap = Math.max(8, th * 0.16);
    ctx.lineWidth = 1;
    for (let gy = y + th * 0.2; gy < y + th * 0.88; gy += rowGap) {
      let gx = x + padX;
      while (gx < x + tw - padX) {
        const dw = 2.5 + rand() * 7;
        const a = fade((gx + dw / 2 - x) / tw);
        if (rand() > 0.16 && a > 0.03) {
          const frag = a < 0.55; // the carving breaks apart near the dissolve
          const jy = frag ? (rand() - 0.5) * 3 : 0;
          ctx.strokeStyle = mix(C.surface2, C.bone, 0.42, (0.28 + rand() * 0.3) * a * dim);
          ctx.beginPath();
          ctx.moveTo(gx, gy + jy);
          ctx.lineTo(gx + (frag ? dw * 0.45 : dw), gy + jy);
          ctx.stroke();
          if (!frag && rand() < 0.12) {
            // vertical tick — the stone's punctuation
            ctx.beginPath();
            ctx.moveTo(gx + dw / 2, gy - 3);
            ctx.lineTo(gx + dw / 2, gy);
            ctx.stroke();
          }
        }
        gx += dw + 2.5 + rand() * 4;
      }
    }
  };

  // The new terms: angular marks no delver has read before.
  const strangeMark = (mx: number, my: number, s: number, a: number): void => {
    ctx.strokeStyle = shade(C.verdigris, 1.15, a);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const k = Math.floor(rand() * 4);
    if (k === 0) {
      ctx.moveTo(mx - s, my + s);
      ctx.lineTo(mx + s, my - s);
    } else if (k === 1) {
      ctx.moveTo(mx - s, my + s * 0.7);
      ctx.lineTo(mx, my - s);
      ctx.lineTo(mx + s, my + s * 0.7);
    } else if (k === 2) {
      ctx.moveTo(mx - s, my - s);
      ctx.lineTo(mx + s * 0.6, my - s);
      ctx.lineTo(mx + s * 0.6, my + s);
    } else {
      ctx.moveTo(mx - s, my);
      ctx.lineTo(mx + s, my);
      ctx.moveTo(mx + s * 0.2, my - s);
      ctx.lineTo(mx - s * 0.2, my + s);
    }
    ctx.stroke();
  };

  // Old glyph lines leaving the stone as a spray of motes, dir = ±1 outward.
  const moteSpray = (edgeX: number, yTop: number, th: number, dir: number, tw: number): void => {
    for (let i = 0; i < 42; i++) {
      const reach = Math.pow(rand(), 1.6) * tw * 0.62;
      const lift = reach * (0.4 + rand() * 0.8);
      const mx = edgeX + dir * reach;
      const my = yTop + rand() * th - lift * 0.55;
      const a = Math.max(0, 0.75 * (1 - reach / (tw * 0.62))) * (0.4 + rand() * 0.6);
      const s = 0.7 + rand() * 1.6;
      ctx.fillStyle = rand() < 0.25 ? shade(C.verdigris, 1.25, a) : mix(C.verdigris, C.verdigrisDim, rand(), a);
      ctx.fillRect(mx - s / 2, my - s / 2, s, s);
    }
  };

  const paintTablet = (x: number, y: number, tw: number, th: number, mode: TabletMode): void => {
    // stone body — cool cast, darker toward the base
    const body = ctx.createLinearGradient(0, y, 0, y + th);
    body.addColorStop(0, mix(C.surface2, C.verdigrisDim, 0.06 + rand() * 0.05));
    body.addColorStop(1, shade(C.surface2, 0.78));
    tabletPath(x, y, tw, th);
    ctx.fillStyle = body;
    ctx.fill();
    // woodcut ink outline
    ctx.strokeStyle = shade(C.void, 0.7, 0.9);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // one thin top-light along the crown
    ctx.strokeStyle = mix(C.surface2, C.bone, 0.28, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + tw * 0.16, y + 1.5);
    ctx.lineTo(x + tw * 0.84, y + 1.5);
    ctx.stroke();

    if (mode === "plain") {
      carveGlyphs(x, y, tw, th, () => 1);
      return;
    }

    if (mode === "cracked") {
      carveGlyphs(x, y, tw, th, () => 1, 0.85);
      // a jagged fault from crown to base
      const pts: [number, number][] = [];
      let cx2 = x + tw * (0.36 + rand() * 0.1);
      for (let i = 0; i <= 6; i++) {
        pts.push([cx2, y + (th * i) / 6]);
        cx2 += (rand() - 0.45) * tw * 0.14;
      }
      // the sheared half falls into shadow
      ctx.save();
      tabletPath(x, y, tw, th);
      ctx.clip();
      ctx.beginPath();
      const p0 = pts[0]!;
      ctx.moveTo(p0[0], p0[1]);
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.lineTo(x + tw, y + th);
      ctx.lineTo(x + tw, y);
      ctx.closePath();
      ctx.fillStyle = shade(C.void, 0.8, 0.28);
      ctx.fill();
      // the crack itself: dark gouge, then a verdigris seep inside it
      const strokeCrack = (color: string, lw: number, dx: number): void => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(p0[0] + dx, p0[1]);
        for (const [px, py] of pts) ctx.lineTo(px + dx, py);
        ctx.stroke();
      };
      strokeCrack(shade(C.void, 0.55, 0.95), 2.2, 0);
      strokeCrack(mix(C.verdigris, C.verdigrisDim, 0.4, 0.5), 0.8, 0.9);
      // chips spalling off the fault
      ctx.fillStyle = shade(C.void, 0.6, 0.8);
      for (let i = 1; i < 5; i += 2) {
        const p = pts[i]!;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[0] + 4, p[1] + 2);
        ctx.lineTo(p[0] + 1, p[1] + 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    // rewriting stone: dissolveDir = the edge losing the old law
    const dissolveDir = mode === "rewriteL" ? -1 : 1;
    const fade = (fx: number): number => {
      const d = dissolveDir < 0 ? fx : 1 - fx; // distance in from the dying edge
      return Math.min(1, Math.max(0, (d - 0.04) / 0.42));
    };
    carveGlyphs(x, y, tw, th, fade);
    // faint cold glow where the new terms are surfacing
    const newCx = dissolveDir < 0 ? x + tw * 0.78 : x + tw * 0.22;
    const glow = ctx.createRadialGradient(newCx, y + th * 0.5, 0, newCx, y + th * 0.5, tw * 0.55);
    glow.addColorStop(0, mix(C.void, C.verdigris, 0.6, 0.22));
    glow.addColorStop(1, mix(C.void, C.verdigris, 0.6, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - tw * 0.2, y - th * 0.15, tw * 1.4, th * 1.3);
    // the stranger marks, ranked like the old rows but wrong
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 2; c++) {
        const mx = newCx + (c - 0.5) * tw * 0.18 + (rand() - 0.5) * 3;
        const my = y + th * (0.22 + r * 0.19) + (rand() - 0.5) * 3;
        strangeMark(mx, my, 2.4 + rand() * 1.2, 0.55 + rand() * 0.4);
      }
      // one mark creeping past the middle, dimmer — the rewrite advancing
      if (r === 1 || r === 3) {
        strangeMark(x + tw * 0.5 + (rand() - 0.5) * 6, y + th * (0.22 + r * 0.19), 2.2, 0.22);
      }
    }
    // the old law leaves as motes off the dying edge
    const edgeX = dissolveDir < 0 ? x : x + tw;
    moteSpray(edgeX, y + th * 0.12, th * 0.76, dissolveDir, tw);
  };

  // ── 5. the ranks of law-stones ────────────────────────────────────────────
  const modeAt = (idx: number): TabletMode => {
    if (idx === 5) return "rewriteR"; // focal, center-left — motes spill inward
    if (idx === 2) return "rewriteL"; // upper-right counterpart, also inward
    if (idx === 10) return "cracked";
    return "plain";
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const mode = modeAt(idx);
      const scale = idx === 5 ? 1.08 : 0.94 + rand() * 0.06;
      const tw = colW * 0.82 * scale;
      const th = rowH * 0.84 * scale;
      const x = colCx(c) - tw / 2 + (rand() - 0.5) * 4;
      const y = rowCy(r) - th / 2 + (rand() - 0.5) * 5;
      paintTablet(x, y, tw, th, mode);
    }
  }

  // ── 6. loosed law adrift in the hall air (upper half only) ───────────────
  for (let i = 0; i < 14; i++) {
    const mx = (0.28 + rand() * 0.44) * w;
    const my = h * (0.06 + rand() * 0.38);
    const s = 0.8 + rand() * 1.2;
    ctx.fillStyle = mix(C.verdigris, C.verdigrisDim, rand(), 0.1 + rand() * 0.3);
    ctx.fillRect(mx - s / 2, my - s / 2, s, s);
  }

  // ── 7. cold fog band across the wall's feet — fog stop 2 ─────────────────
  const fogTop = wallBot - rowH * 0.7;
  const fogBot = wallBot + h * 0.06;
  const fog = ctx.createLinearGradient(0, fogTop, 0, fogBot);
  fog.addColorStop(0, mix(C.void, C.verdigris, 0.16, 0));
  fog.addColorStop(0.55, mix(C.void, C.verdigris, 0.16, 0.35));
  fog.addColorStop(1, mix(C.void, C.verdigris, 0.16, 0));
  ctx.fillStyle = fog;
  ctx.fillRect(0, fogTop, w, fogBot - fogTop);

  // ── 8. the floor: a calm dark plane for the caption ──────────────────────
  const floor = ctx.createLinearGradient(0, wallBot, 0, h);
  floor.addColorStop(0, mix(C.void, C.surface, 0.3));
  floor.addColorStop(0.4, shade(C.void, 0.95));
  floor.addColorStop(1, shade(C.void, 0.7));
  ctx.fillStyle = floor;
  ctx.fillRect(0, wallBot, w, h - wallBot);
  ctx.strokeStyle = shade(C.surface2, 1.25, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, wallBot + 0.5);
  ctx.lineTo(w, wallBot + 0.5);
  ctx.stroke();
  // the faintest cold sheen below the focal stone, gone before the caption
  const sheen = ctx.createLinearGradient(0, wallBot + 4, 0, wallBot + h * 0.1);
  sheen.addColorStop(0, mix(C.void, C.verdigris, 0.2, 0.05));
  sheen.addColorStop(1, mix(C.void, C.verdigris, 0.2, 0));
  ctx.fillStyle = sheen;
  ctx.fillRect(colCx(1) - colW, wallBot + 4, colW * 2, h * 0.1);

  // ── 9. near flank pillars — fog stop 3, darkest cutouts ──────────────────
  ctx.fillStyle = shade(C.void, 0.6);
  ctx.fillRect(0, 0, w * 0.09, h);
  ctx.fillRect(w * 0.91, 0, w * 0.09, h);
  for (const px of [w * 0.09, w * 0.91]) {
    const dir = px < w / 2 ? 1 : -1;
    ctx.fillStyle = shade(C.void, 0.6);
    ctx.beginPath();
    ctx.moveTo(px, h * 0.24);
    ctx.lineTo(px + dir * 12, h * 0.26);
    ctx.lineTo(px + dir * 12, h * 0.29);
    ctx.lineTo(px, h * 0.31);
    ctx.closePath();
    ctx.fill();
    // cold rim light off the wall's glow
    ctx.strokeStyle = mix(C.void, C.verdigris, 0.25, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, h * 0.14);
    ctx.lineTo(px, h * 0.66);
    ctx.stroke();
  }

  // ── 10. one whisper of warmth: a lone candle dying at the flank ──────────
  const emX = w * 0.125;
  const emY = h * 0.76;
  const halo = ctx.createRadialGradient(emX, emY, 0, emX, emY, 14);
  halo.addColorStop(0, mix(C.void, C.ember, 0.5, 0.12));
  halo.addColorStop(1, mix(C.void, C.ember, 0.5, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(emX - 14, emY - 14, 28, 28);
  ctx.fillStyle = mix(C.ember, C.flame, 0.4, 0.5);
  ctx.beginPath();
  ctx.arc(emX, emY, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(C.flameHi, 1, 0.4);
  ctx.fillRect(emX - 0.5, emY - 1, 1, 2);

  // ── 11. top crush + corner vignettes ──────────────────────────────────────
  const crush = ctx.createLinearGradient(0, 0, 0, h * 0.16);
  crush.addColorStop(0, shade(C.void, 0.7, 0.8));
  crush.addColorStop(1, shade(C.void, 0.7, 0));
  ctx.fillStyle = crush;
  ctx.fillRect(0, 0, w, h * 0.16);
  const anchor = ctx.createLinearGradient(0, h * 0.78, 0, h);
  anchor.addColorStop(0, shade(C.void, 0.65, 0));
  anchor.addColorStop(1, shade(C.void, 0.65, 0.75));
  ctx.fillStyle = anchor;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  const vr = Math.min(w, h) * 0.45;
  for (const [cx, cy] of [
    [0, 0],
    [w, 0],
  ] as const) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, vr);
    g.addColorStop(0, shade(C.void, 0.5, 0.5));
    g.addColorStop(1, shade(C.void, 0.5, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h * 0.6);
  }
}
