/**
 * World-camera filter stack + game-feel helpers (D75/D77). Every effect is
 * flag-gated so a revert is a one-line flip; the always-on budget is two
 * filter controllers (bloom + vignette), inside 02 §8's "filters ≤ 4".
 *
 * ORDER MATTERS: FilterList executes in add order — bloom must be added
 * BEFORE the vignette so the vignette darkens the bloomed frame, which is
 * why the whole stack is assembled in one place here.
 */

import Phaser from "phaser";
import { COLOR } from "../../../design/tokens/tokens.js";
import { MAX_FLOOR } from "../../shared/sim/constants.js";

export const FX = {
  bloom: true,
  vignette: true,
  snuffGrade: true,
  heatHaze: true,
} as const;

const LOWEND_KEY = "uv-fx-lowend";

export interface WorldFx {
  vignette: Phaser.Filters.Vignette | null;
  bloom: Phaser.Filters.ParallelFilters | null;
}

/** The canonical world-camera stack: bloom first, vignette over it. */
export function setupWorldFilters(
  scene: Phaser.Scene,
  cam: Phaser.Cameras.Scene2D.Camera,
): WorldFx {
  const fx: WorldFx = { vignette: null, bloom: null };

  if (FX.bloom && scene.registry.get(LOWEND_KEY) !== true) {
    // v4 has no Bloom filter; the sanctioned recipe is ParallelFilters:
    // threshold the brights, blur them, ADD back. void's channels (≤0.06)
    // sit far under the 0.55 knee — the near-black provably never lifts,
    // only flame/verdigris sources leak light into the dark (the art law,
    // rendered literally).
    const bloom = cam.filters.internal.addParallelFilters();
    bloom.top.addThreshold(0.55, 0.85);
    bloom.top.addBlur(0, 2, 2, 1.3, 0xffffff, 3); // LOW quality, 3 steps — mobile budget
    bloom.blend.blendMode = Phaser.BlendModes.ADD;
    bloom.blend.amount = 0.4;
    fx.bloom = bloom;

    // self-tuning valve: if a low-end GPU can't hold the line, shed bloom
    // once and remember for the session (scene restarts must not re-add)
    scene.time.delayedCall(3000, () => {
      if (scene.game.loop.actualFps < 50 && fx.bloom !== null) {
        cam.filters.internal.remove(fx.bloom, true);
        fx.bloom = null;
        scene.registry.set(LOWEND_KEY, true);
      }
    });
  }

  if (FX.vignette) {
    // replaces the stretched uv-vignette texture: resolution-independent,
    // biased up off the HUD bar, and it darkens the bloomed frame
    fx.vignette = cam.filters.internal.addVignette(0.5, 0.47, 0.68, 0.4, COLOR.void);
  }

  return fx;
}

/** The dark presses harder the deeper you go (02 §8 depth-scaled dread). */
export function setVignetteDepth(fx: WorldFx, floor: number): void {
  if (fx.vignette === null) return;
  fx.vignette.strength = 0.36 + (floor / MAX_FLOOR) * 0.14;
}

/** Seal-red hurt pulse — the GPU port of the old texture-tint damageFlash. */
export function vignetteHurt(scene: Phaser.Scene, fx: WorldFx, floor: number): void {
  const v = fx.vignette;
  if (v === null) return;
  v.color.setTo(0xa3, 0x3b, 0x2e);
  v.strength = Math.min(0.62, 0.36 + (floor / MAX_FLOOR) * 0.14 + 0.12);
  scene.time.delayedCall(140, () => {
    v.color.setTo((COLOR.void >> 16) & 0xff, (COLOR.void >> 8) & 0xff, COLOR.void & 0xff);
    setVignetteDepth(fx, floor);
  });
}

/**
 * The discovery breath: the dark RECEDES for a moment (vignette dip) — a
 * white flash would wash the near-black; this is the flash, inverted.
 */
export function vignetteBreath(scene: Phaser.Scene, fx: WorldFx, floor: number): void {
  const v = fx.vignette;
  if (v === null) return;
  scene.tweens.add({
    targets: v,
    strength: 0.22,
    duration: 200,
    yoyo: true,
    ease: "Sine.easeOut",
    onComplete: () => setVignetteDepth(fx, floor),
  });
}

/** Snuffed-state grade: the world drains toward the memory view (D77). */
export function addSnuffGrade(cam: Phaser.Cameras.Scene2D.Camera): Phaser.Filters.ColorMatrix | null {
  if (!FX.snuffGrade) return null;
  const grade = cam.filters.internal.addColorMatrix();
  grade.colorMatrix.saturate(-0.55).brightness(0.92, true);
  return grade;
}

export function removeSnuffGrade(
  cam: Phaser.Cameras.Scene2D.Camera,
  grade: Phaser.Filters.ColorMatrix | null,
): void {
  if (grade !== null) cam.filters.internal.remove(grade, true);
}
