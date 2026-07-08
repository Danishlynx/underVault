/**
 * Phaser 4 game bootstrap (WebGL-only, 480×854 portrait, roundPixels — 02 §8).
 * Receives its ports from the caller: the dev harness injects local adapters;
 * the M2 expanded entrypoint will inject real /api ports. This module never
 * imports server code or generators (client never sees the seed).
 */

import Phaser from "phaser";
import { CANVAS, COLOR } from "../../design/tokens/tokens.js";
import type { GamePorts } from "./net/ports.js";
import { BootScene } from "./scenes/Boot.js";
import { DescentScene } from "./scenes/Descent.js";

export const PORTS_KEY = "uv-ports";

export function createUndervaultGame(parent: HTMLElement, ports: GamePorts): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: CANVAS.width,
    height: CANVAS.height,
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
  return game;
}
