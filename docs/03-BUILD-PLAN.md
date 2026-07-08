# THE UNDERVAULT — Build Plan & Execution
**Version 1.0 · workstreams, milestones, assets, tests, risks, submission**

---

## 1. Workstreams (dependency-ordered, each independently shippable)

**W1 — Deterministic Core (everything depends on this)**
Sim engine (tick, grid, FOV/light tiers, candle states), xoshiro substreams, bit-packed action codec, floor generator v1 (Tallow Halls), golden-replay harness. *Exit test:* 3 recorded runs replay hash-identical on client and server builds.

**W2 — Server & Data**
Hono app + auth middleware, run state machine (start/act/descend/bank/end), secret rules table v1, unknown-interaction resolver, Redis repositories + indexes, integrity counters, rate limits. *Exit:* full run E2E against real Redis in playtest sub; tampered log rejected.

**W3 — Reddit Loops**
Scheduler jobs (reshuffle+daily post, chronicle, gc, gate, flair), postData Guildhall paint, death-card render→media→comment, "Post my epitaph" as-user flow, vigil→reply→inbox, join button, founding-vote scaffolding. *Exit:* two consecutive automated days observed live (post at 00:00, chronicle at 00:05, flair updates).

**W4 — Presentation (Phaser 4)**
Boot/Preload/Descent scenes; TilemapGPULayer + normal-mapped walls; light rig (point/cone/statics); filter stacks; snuffed Quantize memory-view; Noise fog; SpriteGPULayer particles; echo ghost playback; Epitaph ceremony screen; Codex UI (silhouette→sketch→illustration states). *Exit:* 60 fps on a mid Android + iPhone in the actual Reddit app, both view modes.

**W5 — Content & Systems Data**
Bestiary ×14 with audio tells, items ×16 + heirlooms, doors/shrines/rituals, omens ×16 with signatures, claim vocabulary + grammar, cipher font + inscription grammar + Rosetta placements, biome generators 2–6, Bottom ritual spec, mural hint art. *Exit:* content review vs. GDD tables; every hidden rule has ≥1 discovery path and ≥1 Codex triple.

**W6 — Audio**
WebAudio graph, match-strike unlock, wax-lowpass + whisper bus, biome loops + one-shot sprite sheet, material footsteps, tells wired to data, visibilitychange handling, mute persistence. *Exit:* full run with eyes closed still communicates threat.

**W7 — Hardening & Judge Path**
Onboarding 60-sec script, Vision (logged-out) mode, accessibility pass, error-toast taxonomy, kill-switches, load/perf budget audit, copy pass, README, demo-subreddit dressing (pinned how-to, flair styles), rehearsed judge path.

## 2. Milestones (definition of done)

| M | Deliverable | Done means |
|---|---|---|
| M1 | Walkable lit floor, local | Move/wait/interact; candle tiers; FOV; deterministic replay green |
| M2 | Server-validated run E2E | start→act batches→bank→death on live playtest; hashes verified |
| M3 | Death loop complete | Corpse persists, gift/recovery, echo records+plays, epitaph screen |
| M4 | Knowledge engine live | Claims from verified events; confirm counters; ink at 5; Codex renders states; disproval path |
| M5 | Living days | Reshuffle + daily post + chronicle automated; omens active; signs; braziers shared |
| M6 | Full content | Biomes 1–3 playable deep; bestiary/items/doors data-complete; cipher discoverable |
| M7 | Fidelity | Filter stacks, GPU fog/particles, audio graph, 60 fps budgets met |
| M8 | Submission pack | Judge path rehearsed ×5 fresh accounts; README; demo post pinned; survey done |

Sequencing rule: **M1–M3 are sacred and sequential**; W4/W5/W6 parallelize after M2; scope valves (§5) act only on W4/W5 breadth, never on M1–M5 depth.

## 3. Asset Manifest

**Art (16 px, atlas-packed as PCT + PNG):** tileset per biome (~80 tiles) + matching **normal-map atlas**; entity sheets (14 monsters × 4–6 frames, player × 8, props); UI parchment kit (frames, seals, ink strokes); Codex illustration set (3 states × ~40 entries — silhouette auto-derived from sketch); cipher glyph bitmap font (36 glyphs); HUD sans + display serif bitmap fonts; death-card frame; splash flame (tiny sprite for inline). 
**Audio (≤3 MB):** 6 biome loops (60–90 s, OGG+M4A), one-shot sprite sheet (~45 cues: 5 candle states, 14 tells, UI ink/parchment, deaths, rituals), 3 micro-IRs.
**Data:** rules.json (server-only), omens.json, tells.json, claims-vocab.json, cipher-map.json (server-only), inscription-grammar.json.

## 4. Test Strategy

- **Determinism CI:** golden-replay corpus (grows every playtest); client-vs-server hash equality per commit.
- **Sim property tests:** wax never negative; FOV symmetry; no walk-through-walls across 10 k fuzzed logs.
- **Redis math check:** `tools/byte-report` renders projected footprint from live counters; alarm at 300 MB.
- **Load sanity:** synthetic act-batch storm (script) — assert cmd/s and endpoint latency at 100× current playtest population.
- **Device matrix:** iPhone (Reddit app), mid Android (Reddit app), desktop web, old.reddit web — both entrypoints, portrait+landscape web.
- **Content QA:** per hidden rule — discoverability walkthrough + claim-triple existence + false-claim disprovability.
- **Judge-path drill:** fresh account, cold cache, 5-minute script; screenshot every screen; fix anything illegible.

## 5. Risk Register & Scope Valves

| Risk | L×I | Mitigation / valve |
|---|---|---|
| Determinism drift (client vs server) | M×**Critical** | Integer-only sim, fx-RNG quarantined, golden CI from week 1; drift blocks merge |
| Unknown-interaction latency feels laggy | M×H | 250–400 ms anticipation animations; session rule-cache; batch pre-flush on approach heuristics |
| Cold-start (empty world for judges) | H×H | Founding Week: we + testers legitimately play daily from M5; Chronicle makes small days feel storied; solo baseline is a real roguelike (no fake players, ever) |
| Content underrun | M×H | Valve order: biomes 6→5→4 ship-later behind Gate (Gate pacing hides cuts); bestiary floor = 10; omens floor = 10 |
| Perf on low-end Android | M×M | GPULayer-first rendering; filter stack degrade switch (drops Noise+GradientMap); measured every milestone |
| Redis creep (users aggregate) | L×M | Chalk cap, inactive-90 d prune job ready, byte-report alarm |
| Free-text abuse | M×M | Filter+report+shadow-hide day one; signs template-only; kill-switch `signMute` |
| Beta features unavailable (push/blob) | H×L | Zero dependency by design; applications submitted as pure upside |
| Phaser 4 API surprises | M×M | Repo `skills/` folder is our reference; render nodes avoided (Filters suffice); spike each novel feature in isolation first |

## 6. Playtest & Tuning Plan

Private sub from M2; daily runs by the team; tuning journal tracks: median depth, death causes, wax at death, claim rate, D1 return. Targets: first-day median depth 2–3; day-7 veteran depth 6–8; ≥1 ink/day at 20 DAU; 40 %+ of runners read comments pre-run (poll). Omen difficulty tuned so scouts die *informatively*.

## 7. Submission Checklist (hackathon requirements)

- [ ] App listing at developer.reddit.com/apps/undervault — README: what it is, how to play, fetch-domains section (**none**), screenshots
- [ ] Public demo subreddit: pinned daily post live, how-to-play pinned comment, flair styles visible, ≥7 days of Chronicles in history
- [ ] Demo post self-explanatory: Guildhall communicates in 5 s; Vision mode covers logged-out judges
- [ ] Devvit Rules compliance pass (UGC reporting flow, userActions consent wording, no gated core play)
- [ ] Feedback survey submitted (Feedback award); Discord office-hours attendance logged (Devvit Helper award eligibility)
- [ ] 90-sec capture: match-strike → discovery → death → vigil → Chronicle (for listing/socials)
- [ ] Category pitch lines written: Hook / Retention / UGC / **Phaser** (name the v4 features explicitly: cone lights, unified filters, GPU noise, TilemapGPULayer, SpriteGPULayer)

## 8. Post-Jam Line of Sight (signals commitment; judges value launch-ready)

Season 2 seeded by Season 1 monuments; push-notification & blob-storage betas integrated when granted; Developer Funds eligibility path; mod tools for community-run subreddits.
