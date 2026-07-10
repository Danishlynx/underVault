# Retention & Replayability Research (D78 sprint, 2026-07-10)

Four research lenses (hook models, daily-game case studies, roguelike replayability, game-feel canon) synthesized against The Undervault's systems. Full per-lens findings with sources live in the sprint workflow archive.

## Synthesis

Across all four lenses, one model keeps re-emerging. Addictive, replayable games are appointment rituals wrapped around variable-ratio knowledge jackpots, fueled by loss aversion with pressure valves, and made trustworthy by legibility at the moment of failure. The daily ration (Wordle, Spelunky dailies) does the heavy lifting: scarcity converts play into a valued ritual, a hard stop creates anticipation instead of exhaustion, and a shared seed makes conversation itself the retention mechanic — everyone is standing in the same dungeon, so every corpse and claim has a common referent. Inside that fixed appointment, the payout must be variable: hidden-rule discovery is a naturally ethical variable-ratio schedule where the jackpot is a mintable truth, not a purchasable drop. The return engine is the Hook/Zeigarnik loop: every session must END by planting visible unfinished business — a claim at 3/5, truths lost to a corpse, a brazier warming strangers — and the next morning must RESOLVE it, because interrupted tasks dominate memory (~90% vs ~30% recall) and investment without a next-session payoff is dead weight. Loss aversion (losses weigh ~2x gains) is the strongest emotion available, but it churns players without forgiveness valves and works best when YOUR loss becomes SOMEONE ELSE's quest. Finally, knowledge-as-progression only survives if failure is attributable: near-misses motivate through self-efficacy ("my approach almost worked"), so an unexplained death converts near-miss dopamine directly into churn; curiosity requires the gap be visible and feel closable (inverted-U — show partial knowledge, never zero, never total); and juice is a signaling channel that must be budgeted by rarity, with effects that double as evidence.

The Undervault's bones are exceptionally strong against this model — one candle/day, shared reshuffle, server-verified Codex, corpses-as-quests, lineage-as-streak-with-grace are all textbook-correct, sometimes stronger than the canonical examples. The three biggest gaps are all in the connective tissue, not the bones.

Gap 1: The daily open loop is designed but not rendered. The structure creates Zeigarnik tension (unbanked truths, 3/5 claims, the cipher) but the surfaces don't display it or resolve it. The Epitaph (D27) shows what you achieved, not what you left unfinished; the Guildhall greets a returning player with the day header, not with what happened overnight to THEIR investments — was my corpse recovered? Did my claim ink? Did my brazier warm anyone? Eyal's model says the investment step must load tomorrow's trigger; right now banking, braziers, and vigils invest into a void. This is the single highest-leverage fix and it is almost entirely UI/adapter work.

Gap 2: Hidden-rule deaths are not yet guaranteed to read as clues. The near-miss literature is unambiguous: in skill contexts, motivation runs through attribution — Spelunky deaths work because they're comprehensible and closural. A death to an undiscovered Layer-2 rule currently risks reading as a slot-machine loss ("something killed me in the dark"). The tells exist in the data (tells.json, tellHint), but the death moment doesn't surface them, and the Codex doesn't render the information gap — there are no silhouettes, no "2 of 4 laws known," nothing that says the unknown is specific, bounded, and closable. Loewenstein's finding that partial knowledge maximizes curiosity means the Codex UI showing blanks IS the retention mechanic, not decoration.

Gap 3: Contribution is generous but illegible. The game's altruism systems (braziers, echo-plates, corpse recovery, the Great Gate) currently pay out in warm feelings, not receipts. Helldivers 2 documents the failure mode precisely: collective goals without per-player contribution legibility, late-joiner orientation, and an individual payout track breed confusion, not community. "Lit by u/X" exists; "your brazier warmed 14 delvers" does not. There is also no compact, spoiler-free share artifact — the Wordle-grid-shaped object that lets a run provoke curiosity in the comments without leaking rules. For a game whose acquisition channel is literally the comment section of its own post, this is the growth loop left unbuilt.

Everything in the backlog below attacks these three gaps using the game's unique assets — communal knowledge, the daily reshuffle, and death-as-content — and nearly all of it ships client/adapter-side without touching the deterministic sim, because the sim already emits the right events; the game just isn't telling players what those events meant to everyone else.

## Ranked backlog

1. **Unfinished Business panel on the Epitaph: after the cause-of-death card, a second beat lists exactly what died incomplete — each unbanked truth by name ('[Moth] over [Webbing] → ??? — lies with your corpse, Fl.6 K4, 72h'), your claims sitting at k/5 confirmations, and the heir line ('Ald III takes the candle tomorrow'). One-tap 'mark my corpse in the Chronicle'.**
   - Principle: Zeigarnik open loops across the daily boundary — the death screen must display unfinished business, not just achievements; interrupted tasks are recalled ~90% vs ~30%.
   - Fit: Extends the existing Epitaph DOM sheet (D27, 04 §7) and the corpse/claim data the adapter already tracks (D51, D64 codex commits on Ev.BANKED); grid-ref plaques (D39) give the citation format for the corpse location.
   - Effort: hours · touches sim: False

2. **Overnight Ledger in the Guildhall: on your first visit each day, a short scroll of what happened to YOUR investments while you were gone — 'u/Marrow recovered your corpse (split credit: 2 truths inked)', 'your claim [Salt][thrown at][Gloomcap] gained its 4th confirmation', 'your brazier on Fl.3 warmed 14 delvers', '2 vigils lit at your fall site'. Empty-state shows the omen rumor alone.**
   - Principle: Hook model: the investment step must load tomorrow's trigger — every banked claim, brazier, and sign should have a visible next-session payoff.
   - Fit: Extends the Guildhall splash (no-Phaser, paints from postData ≤2KB — ledger is a few strings) plus per-user Redis keys the repositories already own (corpse state, claim confirmations, brazier lighter names per 01 §5); pairs with the vigil→Reddit-inbox pings of 01 §13.
   - Effort: days · touches sim: False

3. **Death-as-clue reveal: when a hidden rule or monster kills you, the Epitaph adds one clue line generated from the rule's tell data ('the dust plumed twice before it struck — something below was listening for heat') and offers 'record as a suspicion' — a one-tap candidate claim attached to your corpse for the recoverer, with split credit if it proves true.**
   - Principle: Near-miss attribution: in skill contexts motivation runs through self-efficacy — a death to an undiscovered rule must retroactively read as a CLUE ('you died to something knowable'), or it reads as a slot-machine loss and churns.
   - Fit: tells.json is already client-safe and omens carry tellHint fragments; the Epitaph copy system (04 §7 canonical causes, D27) gains one templated line; suspicion-claims at death reuse the existing candidate-event → corpse pipeline (01 §10, D51).
   - Effort: day · touches sim: False

4. **Codex gap rendering: every encountered entity's Codex page shows silhouette slots for its undiscovered laws ('Tallow Rat — 2 of 4 laws inked'), a per-biome completion ring, and 'nearest to inking' claims (4/5) pinned to the top of the Guildhall Codex button. Server exposes only per-subject rule COUNTS, never contents.**
   - Principle: Loewenstein's information gap: curiosity peaks at partial knowledge and requires confidence the gap is closable — always show blanks, never zero and never total.
   - Fit: Extends the existing Codex DOM overlay and session-codex inking (D49, 01 §10); rules.json already has per-subject entries and a layer field, so a counts endpoint is a repository one-liner, and counts leak no rule content (no-secret-leak stays honest).
   - Effort: day · touches sim: False

5. **Celebration hierarchy pass with truth-minting at the top: banking a claim gets the full stack (120ms hit-stop, ink-spread flourish, layered chime, glyph flare); an INKED notification outranks everything including kills; kills get 60-90ms hitstop + victim-sprite shake; routine steps stay near-silent. Reduced-motion toggle honored throughout.**
   - Principle: Juice budgeted by rarity signals event importance — uniform juice signals nothing; in a knowledge-roguelike the discovery, not the kill, must be the juiciest moment in the game.
   - Fit: Pure render/audio layer over existing events (Ev.BANKED, discovery toasts D34, the 30-cue synthesized AudioGraph D49/D72); hit-stop is nearly free in a turn-based presentation and never touches validated state (fx quarantine, D6).
   - Effort: days · touches sim: False

6. **Delve Card share artifact: a compact, spoiler-free glyph strip rendered at run end — day number, depth glyph per floor reached, ✦ per truth banked, a cause-of-death icon, omen glyph (undecoded), House flair line — copyable as text/emoji for comments and auto-included on the opt-in epitaph comment. Never names rules or omens in plaintext.**
   - Principle: Identity-expressive, spoiler-safe share artifacts are the acquisition loop — Wordle's emoji grid provoked curiosity in non-players while spoiling nothing.
   - Fit: Extends the existing death-card PNG + 'Post my epitaph' opt-in flow (01 §16) and the flair vocabulary (⚑ House · D{n} · {k}✦); the cipher bitmap font gives it an untemplatable visual identity per 01 §17.
   - Effort: day · touches sim: False

7. **Contribution receipts on shared objects: braziers, echo-plates, glowmoss, and signs accumulate a beneficiary count ('warmed 14 delvers', 'muted the Choirless for 9', sign upvotes) shown on inspect and totaled in your Overnight Ledger and the Chronicle ('kindest light: u/X'). Recovering a corpse pings the original owner's inbox with what got inked.**
   - Principle: Clash-of-Clans donate loop: appointment mechanics stick when peers create soft social obligation and every altruistic act gets visible feedback.
   - Fit: Braziers already log 'Lit by u/…' (01 §5) and are day-scoped shared state in Redis; a counter increment when a player first enters an aura is an adapter/repository change with its own zset index per 02 §5; Chronicle (01 §16) gains one line.
   - Effort: day · touches sim: False

8. **Corpse bounties + heir's intuition: the daily post and Chronicle list unrecovered corpses holding truths ('3 unclaimed truths lie below Fl.6 — 41h remain'), sorted by TTL urgency; your heir starts with a directional hint toward your own ancestor's corpse (a compass-line on the floor-entry plaque, not a map reveal).**
   - Principle: Corpse-run loss aversion needs pressure valves, and making OTHER players the rescuers turns your loss into someone else's quest (Hollow Knight's Jiji valve; Dark Souls bloodstain economy).
   - Fit: Corpses with 72h TTL, unbanked truths, and split credit all exist (01 §13, D51, D64 corpse re-seating); this is a Redis zset scan by TTL for the post/Chronicle plus one client plaque for the heir hint.
   - Effort: day · touches sim: False

9. **Great Gate legibility kit: always-visible Gate bar in the Guildhall seeded with the honest week-start endowment ('the Founders' work carries you to 12%'), a per-run receipt on the Epitaph ('your delve moved the Gate 0.4%'), a one-glance catch-up strip for lapsed players ('while you were away: biome 3 opened, 6 claims inked'), and a small personal payout (cosmetic wax-seal on your lineage scroll) that lands even if the community misses the milestone.**
   - Principle: Endowed progress (pre-filled cards hit 34% vs 19% completion) plus Helldivers' documented fix: collective goals need legible individual contribution, late-joiner orientation, and a personal track that pays out on communal failure.
   - Fit: The Gate threshold formula and ticker already exist (01 §11); receipts derive from the same per-run depth/claims data the flair sync batches; all splash/DOM surface work.
   - Effort: day · touches sim: False

10. **Rule-effect signatures — juice as evidence: every server-resolved secret outcome (EffectId) gets a unique, nameable audiovisual signature (salt-kill = white crystalline burst + dry crack; ignite = ember bloom; melt = sagging wax shimmer) so players can cite what they saw when composing claims; the Codex claim composer shows the matching effect glyph next to each Effect option.**
   - Principle: Juice as information (Cogmind, Into the Breach): on a tactics grid every effect must disambiguate what happened — in a knowledge game, the effect IS the evidence players bank.
   - Fit: OutcomeEvents already carry EffectId through /api/run/act (02 §4); this keys the existing particle/audio systems (D44, D72) by effect and reuses the earned-vocabulary claim composer (01 §10).
   - Effort: day · touches sim: False

11. **Ember visits — a 3-minute no-candle loop: on days (or hours) you don't delve, the Guildhall offers candle-free actions — read the Chronicle, check your Ledger, light a vigil, vote on signs and founding names, inspect the corpse-bounty board. Framed as 'tending the hall'; never grants wax, truths, or confirmations, so the one-candle scarcity stays inviolate.**
   - Principle: Habit automaticity needs a small consistent action in a stable context — enduring daily games offer a low-effort engagement mode for days a full session doesn't fit, without diluting the ration.
   - Fit: Every listed verb already exists as a Reddit-native or splash feature (vigils, sign votes, founding polls, Chronicle per 01 §16); this bundles them into one legible surface on the ≤300KB no-Phaser splash — zero new game systems.
   - Effort: days · touches sim: False

12. **Forgiveness layer at the input envelope: buffer the next tap/held-step during resolution and fire it on the first legal tick; instant tap acknowledgment (tile pulse + input SFX at touch time, resolution lands a beat later); a confirm-gate before stepping into visibly lethal state (burning tile, adjacent telegraphed wickworm lunge, feeding a Hunger door your last wax) — intent interpretation, never undo.**
   - Principle: Forgiveness IS feel (Celeste's invisible leniencies, NecroDancer's 100% beat leeway): in a one-life-per-day game, permadeath must feel earned, not clumsy — widen every intent window in the player's favor.
   - Fit: Extends the existing input queue (D64 already drops stale queued moves on sheet commits; D73 tuned glide vs drain timing); the lethal-confirm reads the same client-visible sim data (fire tiles, telegraph state D21) the renderer already draws. Sim unchanged — actions are simply withheld until confirmed.
   - Effort: day · touches sim: False

13. **Wax-trail permanence: render-only accumulating marks — wax drips along your walked path (density scales with burn rate), scorch on tiles fire crossed, salt residue, a faint melt-ring where a Chandler Beast died — persisting for the rest of the run and echoed under ghost replays, so the floor reads as a history of the delve.**
   - Principle: Vlambeer permanence: marks that outlast the impact frame make each turn feel consequential and the space feel simulated — and here they double as navigation memory in a fog game.
   - Fit: Extends the deterministic deco/overlay system (D63 set dressing, D41 lighting): a render-side per-tile mark buffer fed by events the client already sees (moves, fire ticks, deaths); same pattern as the existing chalk/salt overlays, zero sim or Redis surface.
   - Effort: hours · touches sim: False

