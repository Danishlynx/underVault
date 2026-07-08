/**
 * GENERATED from docs/04-UI-SPEC.md §2 (design-owned values).
 * Created by Code because design/ was absent at Track B start — see DECISIONS.md.
 * Phaser-facing constants: colors as 0xRRGGBB numbers plus CSS strings.
 * Do not hand-tune values here without updating 04 §2.
 */

export const COLOR = {
  void: 0x0b0a10,
  surface: 0x16131c,
  surface2: 0x1e1a26,
  flame: 0xf5a93f,
  flameHi: 0xffd98a,
  ember: 0xc9701e,
  verdigris: 0x4fb39a,
  verdigrisDim: 0x2e6b5c,
  parchment: 0xeae0c9,
  parchmentAged: 0xd6c7a3,
  ink: 0x2a2520,
  inkSoft: 0x4a443b,
  bone: 0xb7ae9c,
  boneDim: 0x7e786c,
  seal: 0xa33b2e,
  goldInk: 0xc8a24b,
  disproven: 0x6e6a63,
  borderVoid: 0x2e2938,
} as const;

export const COLOR_CSS = {
  void: "#0b0a10",
  surface: "#16131c",
  surface2: "#1e1a26",
  flame: "#f5a93f",
  flameHi: "#ffd98a",
  ember: "#c9701e",
  verdigris: "#4fb39a",
  verdigrisDim: "#2e6b5c",
  parchment: "#eae0c9",
  parchmentAged: "#d6c7a3",
  ink: "#2a2520",
  inkSoft: "#4a443b",
  bone: "#b7ae9c",
  boneDim: "#7e786c",
  seal: "#a33b2e",
  goldInk: "#c8a24b",
  disproven: "#6e6a63",
  borderVoid: "#2e2938",
} as const;

/** §2.3 Space, Shape (px, on the 480×854 logical canvas) */
export const SPACE = {
  grid: 4,
  padComponent: 12,
  padComponentLg: 16,
  gutterMobile: 16,
  gutterWeb: 24,
  radius: 2,
} as const;

/** §4.3 HUD metrics */
export const HUD = {
  bottomBarH: 72,
  bottomBarAlpha: 0.92,
  touchTarget: 44,
  iconToggle: 56,
  slotCell: 48,
  candleMeterW: 12,
  snuffHoldMs: 450,
} as const;

/** §5 Motion durations (ms) */
export const MOTION = {
  micro: 120,
  standard: 200,
  sheet: 250,
  ceremonial: 600,
  matchStrike: 1600,
  ease: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

/** 02 §8 canvas */
export const CANVAS = {
  width: 480,
  height: 854,
  tilePx: 16,
  zoom: 3,
  cellPx: 48,
} as const;
