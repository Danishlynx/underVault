# The Undervault — Graphics Handoff Brief (for Claude Design)

Copy this whole file, plus the files it names, into your session. Your job:
make the game beautiful. You cannot break gameplay from these files — they
are render-only by architecture.

## Art direction addendum (operator, 2026-07-09)

**CLEAN over textured.** Reference: Hollow Knight / Silksong — flat confident
shapes, smooth 2–3 stop gradients, strong silhouettes, minimal surface
marks. NO mineral speckle storms, mortar seams, cracks, chips, or drip
stains — at game scale they read as dirt. Variation comes from large quiet
tonal blotches, bevels, and the lighting, never from high-frequency noise.

## What the game is

A community knowledge-roguelike set in a candle-lit vault. One shared daily
dungeon; each player gets one candle a day — the candle is the timer, the
light source, and the life bar. The world is a square-grid simulation
**presented isometrically** (2:1 dimetric). Art direction, verbatim from the
design bible: *"illuminated-manuscript-meets-the-deep-dark… near-black, one
warm amber (flame) + one verdigris (the strange)… If a screen wouldn't look
at home as a woodcut, it's wrong."* Nothing glossy, nothing bounces.

## The files you may edit

1. **`src/client/render/tilemap.ts`** — the texture factory. Every sprite in
   the game is procedurally drawn here with canvas 2D (no image assets are
   allowed — platform CSP forbids external fetches, so everything is code).
   Rework any function's drawing freely: stone floors, tall walls, doors,
   the 14 creatures, the hooded player, shrines, chests, HUD icons.
2. **`design/tokens/tokens.css` + `design/tokens/tokens.ts`** — the palette
   (from the UI spec §2). Change values here and BOTH the canvas world and
   the DOM screens re-theme. Keep the two files in sync.
3. **`src/client/render/lights.ts`** — mood constants: the candlelight tint
   ramp (cool-dark → warm-white), the verdigris "memory ghost" for
   remembered-but-dark tiles, glow pulse speeds.
4. **`src/client/ui/*.ts` style blocks** — the parchment DOM screens
   (Guildhall, Codex, Epitaph, sign composer). Pure CSS-in-TS using ONLY
   `var(--token)` custom properties.

## Hard contracts (break these and the game won't run)

- **Do not change any exported function signature or texture key** (the
  strings passed to `createCanvas` / returned by `propTextureFor` /
  `entityTextureFor` / `groundIndexFor`). The game engine looks sprites up
  by these names.
- **Geometry**: ground diamonds are 64×32 px; wall/door billboards 64×96
  (their base must sit at the bottom of the canvas); creatures are upright
  billboards, bottom-anchored, drawn FACING RIGHT (the engine mirrors them
  with flipX for left-facing — keep a visible left/right asymmetry).
- **The ground tileset strip**: one 64×32 slot per tile id, index = TileId
  (30 slots + floor variants appended). Don't reorder.
- **Colors come from tokens only.** Use the `shade(color, factor)` and
  `mix(a, b, t)` helpers on `COLOR_CSS` values — never introduce foreign hex
  literals in drawing code (derived shades/tints via the helpers are fine).
- **No external assets, no fetch, no fonts from the network.** Canvas
  drawing, gradients, and CSS only.
- Cosmetic randomness in textures must use the file's seeded `crand()` (so
  textures are identical every boot) — never `Math.random()` in this file.

## Who's who (so the creatures read right)

Tallow Rats (small, waxy-grey, eyes catch light) · Wickworms (segmented
ochre, burst from dust) · Vesper Moths (parchment wings, two flutter
frames: `iso-ent-3` / `iso-ent-3b`) · Gloomcap Slimes (verdigris caps) ·
Mirrormaws (wear the chest texture until revealed → `iso-mimic-revealed`
fangs) · Sporewights (puffy, spore-flecked) · the Chandler Beast (a dripping
mound of molten wax, dark eye pits, biome-1 miniboss) · Drownedkin (teal,
waterlogged) · Bellhung (hanged bell-corpses — currently reuses a blob, a
good one to redesign) · Cinder Shades (guttering black silhouettes, ember
eyes) · Gaslights (wisps of verdigris-tinged flame) · the Choirless (pale,
mouths forever open) · Rustlings (scuttling key-thieves) · the
Lantern-Keeper (tall warden, lantern held out) · fallen delvers (slumped
cloaks, a spent candle beside them).

## How your work gets verified

Return the edited file(s) whole. The engineering side runs
`npx tsc -p tsconfig.client.json --noEmit` and `npx eslint src`, then
screenshots the running game in both orientations. TypeScript strict mode is
on (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) — index typed
arrays with `!` where the file already does.
