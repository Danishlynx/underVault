# THE UNDERVAULT — UI/UX Specification
**Version 1.0 · For design & frontend implementation · Companion to 01-GAME-DESIGN §14**
*This document is self-sufficient for UI work: tokens → components → screens → motion → copy.*

---

## 1. Design Language in One Paragraph

Illuminated manuscript meets the deep dark. Above ground (Guildhall, Codex, cards): warm parchment, ink rules, wax-seal accents — a guild's ledger. Below ground (Descent): near-black void where the **candle is the only warmth** and UI whispers at the edges. Two accent temperatures carry all meaning: **amber = life, flame, the known** · **verdigris = the strange, discovery, echoes**. Corners are crisp (2 px), lines are inked (1 px, double-rule for sacred panels), nothing is glossy, nothing bounces. If a screen wouldn't look at home as a woodcut, it's wrong.

---

## 2. Design Tokens

### 2.1 Color (hex, with usage)

| Token | Hex | Use |
|---|---|---|
| `--void` | `#0B0A10` | Descent background, card night zones |
| `--surface` | `#16131C` | Panels over void |
| `--surface-2` | `#1E1A26` | Raised panels, slots |
| `--flame` | `#F5A93F` | Primary accent: CTA, candle, lit states |
| `--flame-hi` | `#FFD98A` | Flame cores, highlights, focus rings |
| `--ember` | `#C9701E` | Pressed states, warnings, low-wax |
| `--verdigris` | `#4FB39A` | Discovery, echoes, ghosts, success |
| `--verdigris-dim` | `#2E6B5C` | Secondary strange accents |
| `--parchment` | `#EAE0C9` | Light surfaces (Guildhall, Codex, sheets) |
| `--parchment-aged` | `#D6C7A3` | Parchment shading, dividers |
| `--ink` | `#2A2520` | Primary text on parchment |
| `--ink-soft` | `#4A443B` | Secondary text on parchment |
| `--bone` | `#B7AE9C` | Primary text on void |
| `--bone-dim` | `#7E786C` | Secondary text on void |
| `--seal` | `#A33B2E` | Wax-seal buttons, danger, death |
| `--gold-ink` | `#C8A24B` | Inked (verified) Codex entries, names of discoverers |
| `--disproven` | `#6E6A63` | Struck-through false claims |

Semantic: success=`verdigris` · warning=`ember` · danger=`seal` · info=`bone`.
Contrast guarantees: `--ink` on `--parchment` ≈ 11:1 · `--bone` on `--void` ≈ 9:1 · `--flame` on `--void` ≈ 8:1. Never set `--ember` text smaller than 14 px on void.

### 2.2 Typography

| Role | Face (DOM) | Face (Phaser bitmap) | Sizes |
|---|---|---|---|
| Display / ceremonial | Old-style serif, Fell-type feel (e.g., *IM Fell English*, fallback *Cormorant*, `serif`) | `serif-12` @3× | DOM 28 / 22 / 18 · game 36 px eff. |
| Body / UI | Humanist sans (*Inter*-class, `system-ui`) | `sans-8` @3× | DOM 15 / 13 · game 24 px eff. |
| Cipher | — | `glyph-12` bitmap font (36 glyphs) | in-world only |
| Numerals | Roman for **depth** (Fl. VII), Arabic for counts | same | — |

Letter-spacing: display +2%; ALL-CAPS labels +8%. Line-height 1.45 body, 1.2 display. No italics in HUD (legibility on flicker); italics allowed on parchment for last-words quotes.

### 2.3 Space, Shape, Depth
4 pt base grid; component padding 12/16; screen gutters 16 (mobile) / 24 (web modal). Radii: **2 px** everywhere except wax-seal circles (full round). Borders: 1 px `--ink` (on parchment) / 1 px `#2E2938` (on void); sacred panels (Epitaph, Bottom) use double-rule (1 px, 3 px gap, 1 px). Elevation = never drop-shadows on parchment (use aged-edge gradient 8 px); on void, elevation = faint amber rim-light top edge (2 px, 20% `--flame`).

### 2.4 Iconography
Single-weight 2 px ink strokes, 24 px grid, woodcut simplicity. Core set: match, candle (5 fill states), cupped-hand, douse-cap, depth-stairs, waystone, sign-post, skull, vigil-flame, quill (claim), book (codex), gate, moth, salt, key, chalk, bell, mirror, rope, eye (inspect), mute/unmute. Every state icon pairs with **shape**, never color alone.

---

## 3. Component Library (anatomy · states)

1. **SealButton (primary CTA)** — wax-seal disc (Ø 64 DOM / 56 game) + ALL-CAPS label beneath. States: default (seal `--seal`, label `--ink`/`--bone`), pressed (seal darkens 12%, dents 1 px down), disabled (seal desaturated `--disproven`, tooltip reason), loading (seal drips animation 600 ms loop). One per screen, max.
2. **InkButton (secondary)** — text + 1 px underline rule; pressed = rule thickens 2 px; on void variant uses `--bone`.
3. **IconToggle (Cup / Snuff)** — 56 px round targets. Cup: instant toggle, filled=cupped. **Snuff: hold-to-confirm 450 ms** with radial ink fill; releasing early cancels (misfire-proof by design).
4. **CandleMeter** — *the* wax display: vertical candle sprite (left edge, 12 px wide safe-zone) that physically shortens through 5 art states; flame halo hue shifts `--flame-hi`→`--ember` under 30%. Long-press reveals numeric wax for 2 s (diegetic-first, numbers on demand).
5. **SlotGrid (inventory ×6)** — 48 px cells, 1 px void-border, occupied = item icon + 1 px amber underline; selected = corner ticks; empty = faint stitch pattern.
6. **ClaimComposer** — three inked slots `[Subject] [Interaction] [Object] → [Effect]` populated by **chips from earned vocabulary** (chips: parchment tabs, 32 px height, drag or tap-to-place); condition slot appears only when server flags omen-sensitivity ("…under a certain sky" chip, verdigris). Submit = quill SealButton "COMMIT TO THE CODEX".
7. **SignComposer** — template dropdown (5 fixed phrases) + noun chip row (earned vocab) + preview plank. Cost badge "−5 wax".
8. **CodexEntryCard** — states: *silhouette* (black shape on aged parchment, "???"), *sketch* (line art + name + discoverer in `--gold-ink`), *illustrated* (full art + all inked claims listed, conditions in verdigris). Disproven claims render struck-through `--disproven` with disprover credit.
9. **ProgressRule** — horizontal inked ruler with wax-drip fill (Gate ticker, Codex %). Label left, % right, milestone notches.
10. **Toast (parchment slip)** — 280 px max, slides from top 200 ms, auto-dismiss 3.5 s, max 2 stacked. Variants: info (ink), discovery (verdigris edge + quill icon), warning (ember edge), death-adjacent (seal edge).
11. **VigilButton** — small flame outline; tapped → fills amber + count increments + 600 ms rising mote.
12. **Sheet/Modal** — parchment scroll unrolls 250 ms from bottom (mobile) / center fade (web); double-rule frame; ink X top-right 44 px.

---

## 4. Screens (layout specs; portrait 480×854 logical unless noted)

### 4.1 Guildhall — inline entry (DOM, height "tall", ~100% width × ~512 px)
Parchment surface. Vertical zones (% of height): **A 12%** header — "DAY 23" display-serif left, small reshuffle moon-mark right, hairline rule. **B 34%** hero — centered unlit match illustration over faint vault-door etching; primary SealButton **STRIKE THE MATCH**. State variants: candle spent → melted candle art + "Your candle is spent. The Vault reshuffles at dusk." + countdown (tabular numerals); run active → "Your flame still burns below — RETURN TO THE DESCENT". **C 14%** community pulse — three inline stats with icons: Gate ProgressRule · Codex % · "17 delvers have fallen today". **D 20%** rumor strip — up to 2 latest inked-claim ticker lines (verdigris quill icon, discoverer in gold-ink) *never omen text (omens are secret)*. **E 12%** your line — house pennant glyph + "House Aldric · Ald III awaits · ⚘⚘ stubs". **F 8%** footer InkButtons: Codex · Chronicle · How to delve. Everything tappable ≥44 px. Total transfer budget ≤300 KB; paints from postData with zero API calls.

### 4.2 Match-Strike transition (expanded boot)
Black screen → user **holds** the match (450 ms) → sparks (SpriteGPULayer) → flame catches → *audio context resumes here* → camera light blooms outward revealing floor 1. Duration 1.6 s, skippable after first ever run (tap to skip). This screen is the audio-unlock and the brand moment.

### 4.3 The Descent — HUD (Phaser)
Void world rendered **isometrically** (2:1 diamonds, tall walls), UI at edges, center 100% board. **Top-left:** depth plaque "Fl. VII" (serif, 1 px ink frame on `--surface`). **Top-right:** mute + menu icons 44 px. **Left edge:** CandleMeter. **Bottom bar (72 px, `--surface` 92% opacity):** Cup toggle — SlotGrid ×6 — Snuff hold-toggle. **Contextual:** tap a floor diamond = path preview dots + move (diamond hit-test, ≥44 px effective target at default zoom); long-press tile/entity = radial with max 2 verbs (Inspect / Sign here) — Inspect includes the grid-reference plaque ("Fl. VII · K4"); tap self = wait (subtle hourglass tick). Selected/hovered diamonds get an ink-line diamond cursor. Walls between camera and player auto-fade (engine-side; mocks should depict one faded wall to set expectation). **Toasts** top-center. Danger legibility rule: when radius ≤2, HUD opacity rises to 100% and gains 1 px ember rim — the UI leans in when the world closes in. *Design deliverable for this screen = mock PNGs over an iso backdrop (painted diamonds + one radial amber glow); the world itself is engine-rendered and out of design scope.*

### 4.4 Waystone Banking (sheet over paused world)
Parchment sheet 88% height: header "WAYSTONE — the Vault listens"; verified-events list (icon + sentence each); pick ≤3 → ClaimComposer inline per pick; footer SealButton COMMIT TO THE CODEX + InkButton "Bank nothing, press on" (deliberately tempting copy).

### 4.5 Epitaph Ceremony (death — the most beautiful screen)
Three beats, auto-advancing with taps: **(1) The Fall** — world desaturates via GradientMap, killer silhouette holds 1.2 s, cause line in display serif ("MELTED BEFORE THE CHANDLER BEAST · Fl. IX · Day 23"). **(2) Last Words** — single input, 100 chars, quill cursor, placeholder "Last words, delver?"; gift picker = inventory row, one selection glows amber. **(3) The Line Endures** — lineage scroll unrolls, new name inks in ("Ald IV will wake at dusk"), streak stubs shown; buttons: SealButton **POST MY EPITAPH** (as-user consent, sublabel "shares your death card as a comment") · InkButton "Rest quietly". Palette here allows the one ceremonial exception: gold-ink flourishes.

### 4.6 Codex (journal)
Parchment spread; tab spine icons: Bestiary · Herbal (items) · Doors & Rites · Glyphs · Places · Chronicle. Grid of CodexEntryCards (2-col mobile); header ProgressRule "The Codex — 34% inked"; search-less by design (browsing is the joy); entry detail = full card + claims list + "first inked by u/… on Day 12" in gold-ink.

### 4.7 Death Card (rendered PNG, 1200×675)
Left 62%: void scene — delver silhouette lit by guttering candle, killer shape looming in verdigris rim. Right 38%: parchment column — house sigil top; "ALD III of House Aldric"; cause line; "Fl. IX · Day 23"; last words in italic quotes; vigil count flame row. Footer strip: "THE UNDERVAULT · one candle a day". Same composition at 1:1 crop-safe center for feed thumbnails.

### 4.8 Vision Mode (logged-out) & Onboarding
Vision: identical Descent, verdigris-tinted vignette + corner ribbon "A VISION — floors 1–2"; on end: sheet "Light a true candle" → Reddit sign-in CTA. Onboarding (first run only): 4 ink-stamp overlays (move · wait · long-press · the candle burns), each dismissed by performing the verb; total ≤60 s; never explains *rules*, only *verbs*.

### 4.9 System / error states
In-fiction toasts: retryable = "The Vault shudders. Try once more." · rate-limited = "The way is barred for now." · offline = "The dark between us is too thick." (auto-retry spinner as dripping wax). Empty states: Codex 0% = "Every page is waiting."; no corpses found = "No delver has fallen here. Yet."

---

## 5. Motion & Feel

Durations: micro 120 ms · standard 200 ms · sheets 250 ms · ceremonial 600 ms · match-strike 1.6 s. Easing `cubic-bezier(0.2, 0.8, 0.2, 1)`; nothing overshoots (no bounce — woodcuts don't bounce). Ambient flicker lives **only** in world light and flame sprites, never on text. Screen shake: 3 px, 120 ms, damage only. `prefers-reduced-motion` / in-game setting: flicker→steady glow, shake→ember flash, unroll→fade; durations halve.

## 6. Responsive & Platform

Inline (Guildhall): fluid width, fixed "tall" height, DOM only. Expanded mobile: full-screen portrait, safe-area insets respected (bottom bar +env(safe-area-inset-bottom)). Desktop web (modal): game canvas letterboxed at 480×854 ×integer scale, parchment gutters with subtle vault-blueprint etching; mouse hover = 1 px amber underline on interactives; keyboard: WASD/arrows move, Space wait, C cup, X hold-snuff, E interact.

## 7. Copy Deck (canonical microcopy)

CTA `STRIKE THE MATCH` · return `RETURN TO THE DESCENT` · spent `Your candle is spent. The Vault reshuffles at dusk.` · bank `COMMIT TO THE CODEX` · skip-bank `Bank nothing, press on` · epitaph prompt `Last words, delver?` · share `POST MY EPITAPH` · vigil `Light a vigil` · join `Join the Guild` · death causes: `Taken by the Dark / Melted before the Chandler Beast / Drowned among the Stacks / Undone by their own flame / The dark took them while they lingered` · claim inked toast `Inked into the Codex — the Guild will remember u/{name}.` · disproven `Struck through. The Codex forgets nothing — least of all liars.` · gate `The Great Gate strains — {pct}%.` Voice rules: second person rare; the Vault is always the subject; never exclamation marks below ground.

## 8. Asset Handoff Checklist (design → build)

- [ ] Palette + type ramp as CSS custom properties file (`tokens.css`) and Phaser constants (`tokens.ts`)
- [ ] Icon set SVG (24 grid) + bitmap-font exports (sans-8, serif-12, glyph-12)
- [ ] Candle sprite: 5 lengths × 3-frame flicker; match-strike 8-frame
- [ ] Component sheet: SealButton (4 states), IconToggles, chips, toasts, sheets — Figma frames named `cmp/{name}/{state}`
- [ ] Screen mocks at 480×854 + Guildhall at 400×512: `scr/{name}/{state}` covering every state listed in §4
- [ ] Death-card template layers (PSD/Fig) with text zones marked for runtime injection
- [ ] Reduced-motion variant notes on any animated frame