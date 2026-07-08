# THE UNDERVAULT — Game Design Document
**Version 1.0 · Reddit "Games with a Hook" Hackathon · Devvit Web + Phaser 4**

> One candle a day. One dungeon shared by everyone. Secrets only a community can solve.

---

## 1. High Concept

The Undervault is a **community knowledge-roguelike**. Every player on Reddit explores the *same* dungeon, regenerated nightly from a shared seed. Each player receives **one life per day**, timed by a burning candle. The dungeon's rules — what kills what, what opens what, what the deep glyphs mean — are **fixed, secret, and never explained**. Nothing has a tooltip.

Character power never increases. The only thing that grows is **what the community knows**, recorded in a shared, auto-verified encyclopedia called the **Codex**. Reading the comments *is* playing the game. Dying well *is* contributing. The subreddit is the skill tree.

**Genre:** turn-based grid roguelike × community ARG × naturalist journal.
**Session:** 8–15 minutes, one per day. **Platform:** Reddit post (Devvit Web), mobile-first.
**Fantasy:** you are one torch-bearer in a thousand-year expedition; your death is a footnote that helps the next delver survive.

---

## 2. Design Pillars

1. **The Candle Is Everything.** One object is simultaneously the timer, the light source, the scarcity, the difficulty curve, the art direction, and the brand. Every system must touch the candle or justify itself.
2. **Knowledge Is the Only Progression.** No XP, no stats, no gear power. A day-one player with the open Codex is near-parity with a veteran. Catch-up mechanic = reading.
3. **The Community Is the Protagonist.** Shared daily layout converts private runs into public intelligence. Individual achievement is framed as contribution (discoveries are *named after you*, forever).
4. **Death Is Content.** Corpses, last words, ghost echoes, lineages. The fail state produces the game's richest artifacts.
5. **Feed-First Polish.** Loads instantly inline, plays one-thumb in portrait, and every screen is screenshot-worthy. (Directly targets the judging criteria: Delightful UX, Polish, Mobile.)

---

## 3. The Player's Day (Core Loop Map)

Five nested clocks. Each one answers "why come back?" at a different timescale.

| Clock | Loop | The pull |
|---|---|---|
| **Seconds** | Move → world ticks → light shrinks → risk/press-on decision | Tension of the dwindling flame |
| **Run (8–15 min)** | Descend → discover → bank at Waystone → push or retreat → die/exit → epitaph | "Bank it or gamble it" |
| **Day** | Read Chronicle → lurk omen scouting → **choose when to spend your candle** → run → discuss | The timing metagame (§7) |
| **Week** | Great Gate collective milestone → new biome opens Sunday | Shared anticipation |
| **Season (8 wks)** | Cipher cracking → Codex completion % → **the Bottom** | The community's grail |

The single most important retention mechanic is the **candle-timing dilemma**: run early and blind for first-discovery immortality, or run late and informed for depth. Not-playing-yet is a strategic state, so players monitor the post all day even before they play.

---

## 4. Fiction & Tone (one paragraph, kept deliberately thin)

Beneath the Guildhall, the Undervault goes down further than anyone has returned to say. The Chandlers' Guild issues each delver one candle a day — wax is rationed, the dark is not. Everything known about the Vault was paid for in last words. *Tone:* hushed, warm-against-black, illuminated-manuscript solemnity with gallows humor supplied by the players themselves. The game never jokes; the community will.

---

## 5. The Candle (Master Mechanic)

The candle is measured in **wax** (integer units). **Wax burns per game tick, not per real second** — the game is fully turn-based ("time moves when you move"), which keeps it deterministic, replay-verifiable, interruption-proof (a phone call can't kill your run), and calm to play one-thumbed. Session length is bounded because actions are bounded.

**Wax economy (tuning v1):**

| Value | Amount |
|---|---|
| Starting wax | **500** |
| Move / wait / basic interact | 1 |
| Force a door | 5 · Place a sign | 5 · Light a brazier | **30** (a gift to everyone) |
| Ritual actions | 5–15 |
| Focus (cone) mode | ×1.5 burn while active |
| Wax dripping pickup | +20 · Candle stub | +50 · Wax cake | +100 |

**Light radius tiers** (drive both rendering and monster behavior):

| Wax remaining | Radius | State |
|---|---|---|
| ≥ 300 | 4 tiles, steady | Bright — rats flee, moths gather |
| 150–299 | 3 tiles | Warm |
| 50–149 | 2 tiles, flicker | Guttering — whisper audio bus fades in |
| 1–49 | 1 tile, violent flicker | Dying — emboldened spawns, heartbeat |
| 0 | — | **The Dark Grace:** 25 ticks of blindness to reach flame or exit, else death: *Taken by the Dark* |

**Candle states — the strategic triangle:**

- **LIT** — normal play.
- **CUPPED** (toggle, free): radius −50%, your flame is hidden from *sight*-hunters, but *heat*-seekers (Wickworms) are drawn to you. Sneaking has a cost.
- **SNUFFED** (deliberate, 2 ticks; relight needs Flint or a flame source, 3 ticks): radius 0; you navigate by your **chalk memory-map** (dithered ghost render, §14), sound, and glowing slime-trails. Wax stops burning. The Lantern-Keeper ignores you. **Cinder Shades can only be fought snuffed.** Some rituals demand offered darkness. Going dark on purpose is the game's signature veteran move — terrifying to attempt, Layer-2 knowledge to master.

**Braziers** are the asynchronous-co-op backbone: lighting one costs you 30 wax but it stays lit *for every player for the rest of the day*, creates a safe zone (burn paused inside its radius), and logs your name on it ("Lit by u/…"). Morning players light the road for evening players.

---

## 6. World Structure

- **Grid:** orthogonal tile grid per floor, 24×24 up to 40×40 by biome. 16 px art at 3× (48 px cells), portrait camera.
- **Tower:** floors 1→25 this season, grouped into biomes of 4; **the Bottom** is floor 25.
- **Daily Reshuffle (00:00 UTC):** entire tower regenerates from the day-seed. *Everyone gets identical layouts.* Layout knowledge expires nightly; rule knowledge never does.
- **Biome ladder** (unlocked weekly by the Great Gate, §11):

| Wk | Floors | Biome | Teaching theme |
|---|---|---|---|
| 1 | 1–4 | **The Tallow Halls** | Core verbs; wax economy; rats/worms/moths |
| 2 | 5–8 | **The Root Cellars** | Spores, slimes, salt, glow-moss, mimics |
| 3 | 9–12 | **The Drowned Stacks** | Water rows, conduction, Drownedkin |
| 4 | 13–16 | **The Glassblack Furnaces** | Heat, gas, fire spread, Cinder Shades |
| 5 | 17–20 | **The Hollow Choir** | Sound tiles, echo-plates, the Choirless |
| 6 | 21–24 | **The Wickless Deep** | Darkness inverted; snuff-mastery required |
| 7–8 | 25 | **The Bottom** | Cipher-instructed finale ritual (§12) |

**Shared vs. private state (critical design decision).** Day-scoped **shared** across all players: braziers, plates & valves, signs, named landmarks, communion doors. **Multi-day shared:** corpses (72 h), Codex, lineage. **Private per run:** monster positions/HP, loose item pickups (the Vault "replenishes what each delver takes" — prevents early players strip-mining the world), triggered traps. This hybrid gives cooperation without griefing.

**Generation guarantees per day:** ≥1 Waystone every 2 floors; brazier density by biome; 1 secret mural room per biome (rule hints in pictograms); cipher inscriptions from floor 9 down; omen-modulated spawn tables; 1 "lesson layout" on floor 1 (a survivable ambush that teaches the day's texture).

---

## 7. Omens (The Daily Mystery)

Every day carries one hidden rule-mutation. **Never announced, only experienced.** Early runners are scouts; their reports shape everyone's decisions; the Chronicle teases tomorrow's cryptically. Detection signature listed = what a good scout learns to check.

| Omen | Effect | Tell |
|---|---|---|
| Verminmoon | Rat packs ×3 | Squeaking on floor 1 before first room |
| Stillair | Sound carries ×2 | Chandler Beast reacts from off-screen |
| Weeping Walls | Wet tiles everywhere; shock chains | Drip audio; glossy floor sheen |
| Hungry Dark | Dark Grace 25→12; whispers louder | Snuff test near entrance |
| Waxfall | Drippings ×2 | Floor 1 littered with wax |
| Mothtide | Vesper Moths swarm braziers | Moth halos on entrance brazier |
| Ironbloom | +Keys, doors need 2 keys | Double keyholes |
| Echofast | Corpse ghosts auto-play at 3 tiles | Ghost shimmer without Mirror Pool |
| Sweltering | Burn ×1.5 | Wax counter visibly fast |
| Kindlenight | Braziers near stairs pre-lit | Warm glow from stairwells |
| Longshadow | All radius tiers −1 | Immediate at spawn |
| Quietfoot | Your steps silent | Chandler ignores stone steps |
| Saltless | No salt spawns | Empty salt niches |
| Doubledeep | 20% stairs descend two floors | Depth counter skips |
| Feastday | Mimic rate ×2 | First chest growls |
| Palefire | Focus cone costs ×1.0 | Cone toggle shows no surcharge |

Omens interact with the Codex: claims can be **conditional** ("true only under a certain sky"), the deepest research layer (§10).

---

## 8. Bestiary (Every Monster Is a Riddle)

Format: **Name (biome · knowledge layer)** — surface behavior → hidden rule(s). L0 learned in 1–3 runs; L1 in days; L2 in weeks.

1. **Tallow Rats (1 · L0)** — flee light radius ≥3, swarm in dark; die to one bump. *L1:* they eat floor drippings — following a rat finds wax caches.
2. **Wickworms (1 · L0/1)** — burrow, dust-plume telegraph, lunge adjacent; fire = instant kill. *L1:* drawn to CUPPED flames (heat), not lit ones.
3. **Vesper Moths (1 · L1)** — orbit your flame; each −1 effective radius; cupping sheds them. *L2:* a moth killed over webbing ignites it.
4. **Gloomcap Slimes (2 · L1)** — immune to bumps, split when struck; blocked by salt lines; thrown salt = instant kill. *L2:* trails glow when you are SNUFFED — free dark-navigation breadcrumbs.
5. **Mirrormaws (2 · L1)** — mimic chests. Knock (interact-without-open) → growl; adjacent Mirror Shard shows fangs in reflection.
6. **Sporewights (2 · L1)** — burst into gas clouds on death; gas ignites; walking through unlit gas = fine, lit = boom. Teaches candle-vs-environment.
7. **The Chandler Beast (biome miniboss · L1/2)** — blind; hunts *sound*; moves 2 when you step on stone, 1 on moss/carpet, 0 when you stand still. Immune to weapons. *Kill:* lure into a lit brazier's radius — its wax body melts (community-lit braziers become traps).
8. **Drownedkin (3 · L1)** — animate only while you occupy a water row; conduct shock along connected water; hate salt bridges.
9. **Bellhung (3 · L2)** — hanged bell-corpses; ring if you pass adjacent while LIT, alerting the floor; pass SNUFFED silently, or cut them down with 2 interacts for a free Bell item.
10. **Cinder Shades (4 · L2)** — *invulnerable while your candle is lit.* Snuff to make them mortal. The single biggest "wait, WHAT" community discovery, positioned week 4.
11. **Gaslights (4 · L1)** — floating flames that mirror your moves in reverse; lead them into gas clouds to detonate.
12. **The Choirless (5 · L1)** — scream on sight (floor-wide alert); silenced while any player-weight rests on an echo-plate that day (asynchronous co-op: morning players mute the floor for everyone).
13. **Rustlings (5 · L1)** — key-stealing scuttlers; drop everything if they cross a chalk line (chalk's hidden second use).
14. **The Lantern-Keeper (roams 8+ · L2)** — elite with a sweeping **cone light** (Phaser 4 showcase). If his cone touches your *lit* flame: relentless pursuit. Ignores SNUFFED delvers entirely. Carries Master Keys; pickpocket only in darkness. *L3 rumor:* he re-lights dead braziers on Kindlenight…

Every entry ships with an **audio tell** (learnable, Codex-able: "the Chandler clicks thrice before charging") because sound is pre-visual information in a light-limited game (§15).

---

## 9. Items (Informational & Tactical Only — Never Stat Power)

Inventory: **6 slots** (choice pressure). Key items: **Flint & Striker** (relight); **Salt Pouch** ×3 (lines/throws); **Mirror Shard** (mimic/echo reveal); **Chalk** (mark tiles — *your* marks persist into *your* future days: personal cartography, and repels Rustlings); **Bell** (throw = sound decoy); **Rope** (safe shaft descent); **Glowmoss Vial** (permanent day-light tile — plantable gift); **Dousing Cap** (instant free snuff); **Keys** (Iron/Bone/Master); **Waystone Shard** (rare single-use remote bank); **Wax Cake** (+100).

**Heirlooms** (lineage slot, §13): one per 3 generations, informational only — *Hummers Locket* (hums near secret rooms), *Widdershins Compass* (spins near cipher walls), *Fever Ring* (warms adjacent to mimics), *Listening Horn* (doubles audio-tell radius), *Smoked Glass* (see 1 tile while snuffed).

---

## 10. Doors, Shrines & the Codex (Knowledge Engine)

**Door taxonomy:** Iron (key) → Sigil (ritual: e.g., *offer darkness* = snuff + wait 3) → Hunger (feed 50 wax) → Choir (ring bell adjacent) → Plate (N same-floor plates; solo puzzle) → **Communion** (3 plates on *different floors* pressed within the same clock-hour — the one hard-sync social puzzle; scheduling threads are the point) → Great Gate (weekly collective, §11) → the Bottom Seal (§12).

**Shrines:** Hollow Shrine (speak a word — free-text input; accepts cipher-decoded words); Tallow Altar (sacrifice 100 wax → floor-map pulse); Mirror Pool (replay the floor's deepest death echo); Nameless Font (effect discovered by the community — deliberately blank here).

### The Codex — structured, auto-verified community knowledge

- A **Claim** is composed from in-game vocabulary, not free text: `[Subject] + [Interaction] + [Object] → [Effect] (+ Condition)`. e.g., `[Salt] [thrown at] [Gloomcap] → [destroyed]`.
- **Vocabulary is earned:** you can only reference entities you've personally encountered (long-press anything → "Unknown ???" added to your journal). Prevents dictionary-spam.
- During a run the client flags **candidate events**; at a **Waystone** you bank up to 3 as formal claims. **Discoveries die with you if unbanked** — carrying knowledge past a Waystone is the run's core gamble; corpse-recovery grants split credit ("Discovered by A, recovered by B").
- The server knows ground truth (§SDD) and labels claims TRUE / FALSE / **CONDITIONAL** (omen-dependent — rendered as "…under a certain sky"). TRUE claims accrue confirmations passively whenever any player's verified event stream matches. At **5 distinct confirmers**, the claim is **INKED**: permanent, named, day-stamped.
- FALSE claims get publicly **Disproven** with the disprover credited — troll-hunting is a leaderboard of its own.
- Codex art matures with confirmations: silhouette (inked) → sketch (25) → full illustration (100). **Codex completion % is the community's season progress bar**, shown in the Guildhall and every Chronicle.
- **Lies live in free text** by design: comment rumors and corpse last-words ("the left door is safe" — it is not). Proof in the Codex, gossip everywhere else. Trust becomes emergent PvP with zero PvP systems.

**Signs (in-world UGC):** 2 per run, 5 wax, day-scoped. **Template-composed** (Dark-Souls style) from `[phrase] + [earned noun]`: "Beware of ___ / Try ___ / ___ ahead / Praise the flame / Liar ahead". Fully moderatable by construction, votable, auto-hidden at −3.

---

## 11. The Great Gate (Weekly Arc)

A biome-sealing door that opens Sundays when the community hits a collective milestone (total floors delved + claims inked, **scaled to active population**: `threshold = max(floor_base, 0.6 × 7day_active_delvers × avg_depth)` — the gate can never stall a small community or trivialize a huge one). A live Gate ticker sits in the Guildhall and every Chronicle. Opening night is an event: scheduled post, first-hour scouts, fresh bestiary pages blank in the Codex.

## 12. The Cipher & the Bottom (Season Arc)

A constructed script: 26 letter-glyphs + 10 numerals, **stable mapping all season** (the community cracks it exactly once; that's the point). Foothold designed in: depth-marker inscriptions sit beside real floor numbers — a Rosetta stone for numerals in week 2. Inscriptions are grammar-assembled (`[VERB][OBJECT][LOCATION][CONDITION]`), so decoded vocabulary compounds. Mural rooms give pictographic hints. Final-biome inscriptions spell the **Bottom ritual** (multi-step, multi-player, omen-conditional). What's at the Bottom is the season finale event; Founders' names and player-voted place-names persist into Season 2. Cipher glyphs render as a Phaser **BitmapText font** — they cast and receive light like everything else.

## 13. Death, Lineage & Identity

**The Epitaph Ceremony** (death is the most beautiful screen in the game): cause-of-death card → **last words** (100 chars, filtered) → choose one item as your **gift** → lineage scroll appends your line. **Corpse persists 72 h** at the fall site holding words, gift, and unbanked discoveries. Anyone may **light a vigil** (one-tap) — vigils and recoveries route to your **native Reddit inbox** via comment replies (§16), the retention ping we don't have to build.

**Lineage:** choose a House name once; delvers auto-number (*Ald I, Ald II…*); heirloom pick at generations 3/6/9; **flair is the visible ladder**: `⚑ House Aldric · D14 · 7✦` (depth best · discoveries). **Streaks with grace:** *Banked Stubs* earned at depth milestones auto-cover a missed day — chronicle framing ("the line endures"), never punishment framing.

**Echoes:** the final 24 s of every run records as keyframes. A corpse's ghost **plays once, faintly, when a living player first steps adjacent** — knowledge transfer as a jump-scare-shaped gift. Mirror Pools replay a floor's deepest death on demand.

## 14. UX / UI Direction

- **Art:** illuminated-manuscript-meets-deep-dark. Surface Guildhall = parchment, ink, wax-seal red accents. Below = near-black, one warm amber (flame) + one verdigris (the strange). Display serif (Codex) + humanist sans (HUD) + the cipher bitmap font. 16 px pixel art with normal maps — *painterly-lit pixel art* is the distinctive look that defeats "AI slop" suspicion.
- **Two entry surfaces** (maps to Devvit inline/expanded): **Guildhall** inline in the feed — instant-loading (<1 s), shows day number, omen rumor strip, Gate ticker, Codex %, your lineage line, and one verb: **STRIKE THE MATCH**. The **Descent** opens in expanded/fullscreen mode.
- **Controls:** tap tile to path-step, tap self to wait, long-press to inspect, swipe-hold for cone aim, two persistent buttons (Cup / Snuff). One thumb, portrait.
- **Onboarding:** 60-second scripted first descent teaching *verbs only* — the world stays unexplained on principle. First-session death is designed to be interesting.
- **The judge path (rehearsed):** open post → Guildhall legible in 5 s → match strike → die interestingly by minute 4 → epitaph → see Codex half-inked → understand the whole game. Every screen survives a screenshot.
- **Accessibility:** radius/shape cues never color-only; reduced-motion setting (kills screen shake/flicker, keeps fades); dyslexia-friendlier HUD sans; all audio-tells have subtle visual twins.
- **Logged-out visitors** (per Reddit guidance, core play ungated): a **Vision** — floors 1–2, no persistence, no credit, ending on "light a true candle" sign-in prompt. Scarcity preserved.

## 15. Audio Design (Constraint-Native)

Autoplay is forbidden until user gesture (platform rule) — so **striking the match is the audio unlock**: diegetic compliance. Mute button always visible; `visibilitychange` hard-mutes (platform rule). Budget ≤3 MB: one 60–90 s ambient loop per biome + one audio-sprite sheet of one-shots (OGG ~96 kbps mono, m4a fallback).

Web Audio graph: `master → [music bus | sfx bus | whisper bus]`. **The mix is a game mechanic:** lowpass on music tied to wax % (world muffles as light dies); whisper bus gain tied to darkness; tiny per-biome convolution reverbs (0.5–1 s IRs); footsteps are material-true (stone/moss/water/carpet) because *sound-hunters make footstep material a survival rule*; every monster's tell is audio-first and Codex-recordable. Candle itself has a five-state sound set (strike, steady, gutter, snuff, the silence after).

## 16. Reddit-Native Systems

- **Daily post** (scheduler, 00:00 UTC): "Day 23 — The Vault Reshuffles," carrying 2 KB postData for instant Guildhall paint.
- **Nightly Chronicle** (scheduler, 00:05, recapping prior day): deepest delve, cruelest death, claims inked (with names), Gate %, cipher fragments recovered, one-line omen tease. Appointment content in the feed — precisely the "recurring content" the Retention award describes.
- **Death cards:** Phaser-rendered PNG → media upload → posted as a comment on the day's post by the app; **"Post my epitaph" opt-in button** posts it *as the user* (platform-compliant consent), making vigil replies land in their Reddit inbox.
- **Flair** as progression ladder (auto-sync, batched). **Founding votes:** weekly comment polls name discovered landmarks. **Join button** (userActions subscribe) after first bank — the moment of earned goodwill.

## 17. Anti-Slop, Originality & Safety Notes

Identity is enforced by specificity: candle-lit normal-mapped pixel art, manuscript UI, a bespoke cipher font, template signs, named-discovery Codex — none of it templateable. All UI fits the viewport at every breakpoint (explicit judging note). Free text exists in exactly two places (last words, house names): both filtered, reportable, cap-limited; signs are template-safe; Codex is structurally spam-proof (vocabulary-gated, server-verified).

## 18. Award Coverage Map (explicit)

| Criterion | Load-bearing features |
|---|---|
| **Hook-y ($15k)** | Candle scarcity; run-timing dilemma; hidden omens; Chronicle appointment; corpse/vigil inbox pings; Gate & Bottom arcs |
| **Retention Mechanics** | Daily seed + daily post; scouting economy; streak stubs; flair ladder; weekly Gate; season mystery |
| **User Contributions** | Verified Codex claims; last words; template signs; founding votes; epitaph comments; the community's own off-app cipher spreadsheets |
| **Phaser** | Cone lights (candle focus + Lantern-Keeper); lighting on tilemaps/BitmapText; filter stacks (Vignette/Noise/GradientMap/Quantize); GPU noise fog; SpriteGPULayer particles; echo ghost playback |
| **Reddit-y** | Comment-section-as-skill-tree; flair identity; community-named world; vigils; asynchronous kindness (braziers, echo-plates) |
| **UX & Polish** | Inline Guildhall <1 s; one-thumb play; epitaph ceremony; judge path rehearsal; mobile-first budgets |

## 19. Open Design Decisions (tracked, not blocking)

1. Warm-footprint co-presence on shared floors — stretch, ship-if-time.
2. Focus-cone default keybinding vs. toggle — playtest.
3. Chronicle "cruelest death" selection heuristic (deepest? most vigils? mod pick?) — start: deepest + most-vigiled.
4. Season 2 hooks (persistent monuments) — design after week 2 telemetry.
