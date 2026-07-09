/**
 * Phaser 4 game bootstrap (WebGL-only, roundPixels — 02 §8).
 * RESIZE scaling: the canvas is every pixel of its container — no
 * letterboxing, no dead margins (operator: Reddit embeds are small; waste
 * nothing). 480×854 remains the DESIGN reference for HUD metrics (04), but
 * the surface adapts to any aspect; HUD re-flows via Hud.layout and the
 * world camera fills the frame via iso.fitZoom. Flagged vs the "decided"
 * fixed internal res in DECISIONS (D62).
 */

import Phaser from "phaser";
import { COLOR } from "../../design/tokens/tokens.js";
import type { GamePorts } from "./net/ports.js";
import { BootScene } from "./scenes/Boot.js";
import { DescentScene } from "./scenes/Descent.js";

export const PORTS_KEY = "uv-ports";

export function createUndervaultGame(parent: HTMLElement, ports: GamePorts): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    backgroundColor: COLOR.void,
    pixelArt: true,
    roundPixels: true, // v4 defaults false — set explicitly (02 §8)
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || 480,
      height: parent.clientHeight || 854,
    },
    scene: [BootScene, DescentScene],
  });
  game.registry.set(PORTS_KEY, ports);
  return game;
}
