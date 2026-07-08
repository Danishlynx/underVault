/**
 * Boot: builds the token-conformant placeholder textures (Track B: no real
 * art yet — programmatic placeholders per 05 §5), then starts the Descent.
 * Real atlases replace these at W4 with no scene-code change: same keys.
 */

import Phaser from "phaser";
import { COLOR_CSS } from "../../../design/tokens/tokens.js";
import { makeIsoTextures } from "../render/tilemap.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    makeIsoTextures(this);
    // Radial light halo (candle glow) — canvas gradient, tinted at use site.
    const size = 256;
    const canvas = this.textures.createCanvas("halo", size, size);
    if (canvas !== null) {
      const ctx = canvas.getContext();
      const g = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
      g.addColorStop(0, "rgba(255, 217, 138, 0.55)"); // --flame-hi core
      g.addColorStop(0.55, "rgba(245, 169, 63, 0.22)"); // --flame falloff
      g.addColorStop(1, "rgba(245, 169, 63, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      canvas.refresh();
    }

    // 1×1 white pixel for tinted rectangles (fills, bars, fog cells).
    const px = this.textures.createCanvas("px", 2, 2);
    if (px !== null) {
      const ctx = px.getContext();
      ctx.fillStyle = COLOR_CSS.parchment;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 2, 2);
      px.refresh();
    }

    this.scene.start("Descent");
  }
}
