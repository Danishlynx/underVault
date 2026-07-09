/**
 * Boot: builds the token-conformant placeholder textures (Track B: no real
 * art yet — programmatic placeholders per 05 §5), then starts the Descent.
 * Real atlases replace these at W4 with no scene-code change: same keys.
 */

import Phaser from "phaser";
import { COLOR_CSS } from "../../../design/tokens/tokens.js";
import { ensureBiomeSkin, makeIsoTextures } from "../render/tilemap.js";
import { BIOMES } from "../../shared/sim/constants.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    makeIsoTextures(this);
    // Radial light halo (candle glow) — high-res gradient with dense stops
    // so FIT upscaling doesn't band into visible rings.
    const size = 512;
    const canvas = this.textures.createCanvas("halo", size, size);
    if (canvas !== null) {
      const ctx = canvas.getContext();
      const g = ctx.createRadialGradient(size / 2, size / 2, 12, size / 2, size / 2, size / 2);
      g.addColorStop(0, "rgba(255, 217, 138, 0.5)"); // --flame-hi core
      g.addColorStop(0.25, "rgba(250, 193, 100, 0.34)");
      g.addColorStop(0.5, "rgba(245, 169, 63, 0.2)"); // --flame falloff
      g.addColorStop(0.72, "rgba(245, 169, 63, 0.09)");
      g.addColorStop(0.88, "rgba(245, 169, 63, 0.03)");
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

    // pre-warm the deeper biome skins (D70) in idle time so descending
    // never pays the texture-build hitch; ensureBiomeSkin is idempotent
    for (let bi = 1; bi < BIOMES.length; bi++) {
      setTimeout(() => ensureBiomeSkin(this.textures, bi), 400 * bi);
    }
  }
}
