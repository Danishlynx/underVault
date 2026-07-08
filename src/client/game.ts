/**
 * Phaser 4 game bootstrap (WebGL-only, roundPixels — 02 §8).
 * Orientation-aware: portrait uses the decided 480×854 internal res;
 * landscape flips to 854×480 and the HUD re-lays out (03 §4's device
 * matrix covers portrait+landscape web). The swap is live on resize.
 * Receives its ports from the caller: the dev harness injects local
 * adapters; the M2 expanded entrypoint will inject real /api ports.
 */

import Phaser from "phaser";
import { CANVAS, COLOR } from "../../design/tokens/tokens.js";
import type { GamePorts } from "./net/ports.js";
import { BootScene } from "./scenes/Boot.js";
import { DescentScene } from "./scenes/Descent.js";

export const PORTS_KEY = "uv-ports";

function pickSize(parent: HTMLElement): [number, number] {
  const landscape = parent.clientWidth > parent.clientHeight;
  return landscape ? [CANVAS.height, CANVAS.width] : [CANVAS.width, CANVAS.height];
}

export function createUndervaultGame(parent: HTMLElement, ports: GamePorts): Phaser.Game {
  const [w, h] = pickSize(parent);
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: w,
    height: h,
    backgroundColor: COLOR.void,
    pixelArt: true,
    roundPixels: true, // v4 defaults false — set explicitly (02 §8)
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, DescentScene],
  });
  game.registry.set(PORTS_KEY, ports);

  // Live orientation swap: FIT keeps scaling within an orientation; a flip
  // needs a new internal size, which reflows every scene via Scale.RESIZE.
  let current = w > h ? "landscape" : "portrait";
  window.addEventListener("resize", () => {
    const [nw, nh] = pickSize(parent);
    const next = nw > nh ? "landscape" : "portrait";
    if (next !== current) {
      current = next;
      game.scale.setGameSize(nw, nh);
    }
  });

  return game;
}
