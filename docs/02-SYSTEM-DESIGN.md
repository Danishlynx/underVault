# THE UNDERVAULT — Technical System Design
**Version 1.0 · Devvit Web (serverless) · Phaser 4.2 · Redis · verified against reddit/devvit-docs**

---

## 1. Architecture Overview

```
┌─ Reddit Post ────────────────────────────────────────────┐
│  INLINE entry (splash.html)      EXPANDED entry (game.html)
│  ~250 KB: HTML/CSS + postData    Full Phaser 4 bundle
│  "Guildhall" — instant paint     "The Descent"
└──────────────┬───────────────────────────┬───────────────┘
               │ fetch /api/*  (HTTPS, same-origin only)   │ realtime
┌──────────────▼───────────────────────────▼───────────────┐
│  SERVERLESS NODE ENDPOINTS (Hono) — stateless, ≤30 s     │
│  /api/day /api/run/* /api/claim /api/sign /api/vigil ... │
│  Shared deterministic SIM module (src/shared) ← same code │
│  runs on client for play and on server for validation     │
└──────┬───────────────┬──────────────┬────────────────────┘
       │Redis (500 MB) │Scheduler(10) │Reddit API
       │state+indexes  │cron jobs     │posts·comments·flair·media
       └───────────────┴──────────────┴────────────────────┘
```

**Governing principles**

1. **One sim, two homes.** All game logic lives in `src/shared/sim/` — pure, deterministic, integer-only TypeScript. Client runs it for responsiveness; server re-runs it to validate. Divergence = rejected run.
2. **Secrets never ship.** The *hidden rules table* (interaction outcomes, omen effects, ritual recipes) exists **only server-side**. The client sim handles physics/visibility/known-state; unknown interactions resolve via a fast server call masked by animation (§4). Datamining the bundle reveals nothing the community hasn't earned.
3. **Server-authoritative everything that persists.** The client is a renderer + optimistic predictor. Redis is written only by validated server code paths.
4. **Design for the limits, not around them.** Every platform constraint has a named mitigation (§10 compliance matrix).

---

## 2. Repository Layout

```
undervault/
├─ devvit.json                  # entrypoints, permissions, scheduler, triggers, menu
├─ src/
│  ├─ shared/                   # ISOMORPHIC — imported by client AND server
│  │  ├─ sim/                   # tick engine, movement, LOS/light, systems (fire/gas/water)
│  │  │  ├─ engine.ts  rng.ts (xoshiro128** substreams)  fov.ts  systems.ts
│  │  │  └─ types.ts   constants.ts   pack.ts (bit-packed action log codec)
│  │  ├─ gen/                   # floor generator (seed → layout), biome modules
│  │  └─ protocol.ts            # zod schemas for every endpoint payload
│  ├─ server/
│  │  ├─ index.ts               # Hono app, auth middleware, route mounting
│  │  ├─ rules/                 # ★ SECRET rule tables + omen defs + cipher mapping
│  │  ├─ routes/ (day run claim sign vigil codex lineage chronicle internal)
│  │  ├─ jobs/                  # scheduler handlers (reshuffle, chronicle, gc, gate, flair)
│  │  └─ data/                  # redis repositories (one module per aggregate)
│  └─ client/
│     ├─ splash.html/.ts        # INLINE Guildhall (no Phaser; DOM + tiny canvas flame)
│     ├─ game.html/.ts          # EXPANDED bootstrap
│     ├─ scenes/ (Boot Preload Descent Epitaph Codex)
│     ├─ render/ (lights.ts filters.ts tilemap.ts echoes.ts particles.ts)
│     ├─ audio/ (graph.ts sprites.ts tells.ts)
│     └─ net/ (api.ts batcher.ts realtime.ts)
└─ tools/ (atlas build, golden-replay CI, redis byte-math report)
```

---

## 3. Determinism Contract (the foundation everything stands on)

- **RNG:** xoshiro128\*\* seeded from `daySeed`, split into named substreams: `gen`, `spawn`, `ai`, `loot`, `fx-only` (fx stream is *excluded* from validation so juice can't desync logic).
- **Integers only** in sim state — no floats, no `Math.random`, no `Date.now()` inside ticks. Iteration orders sorted; entity IDs deterministic.
- **Tick function:** `tick(state, action) → state'` pure and side-effect-free. World advances exactly one tick per player action ("time moves when you move").
- **Action log:** each run is a bit-packed array of actions (4–6 bits/action typical; ≤500 actions ≈ **≤400 bytes/run**). Client streams checkpoints: every 32 ticks it sends `h32(state)` (xxhash of canonical state serialization).
- **Golden replay corpus:** CI replays 50 recorded runs against every commit; any hash drift fails the build. This is our regression suit for "we changed a rule and broke determinism."

---

## 4. Client⇄Server Protocol

All endpoints under `/api/`, zod-validated, cookie/context auth via Devvit middleware. Payload ceilings (platform: 4 MB req / 10 MB res / 30 s) are never approached — worst response is a floor payload ≈ 8 KB gzipped.

| Endpoint | Method | Purpose / notes |
|---|---|---|
| `/api/day` | GET | Day meta (number, gate %, codex %, chronicle teaser). Backed by postData when possible → often zero calls for inline paint. |
| `/api/run/start` | POST | Idempotent. Checks `runtoken:{uid}:{day}`; consumes the daily candle; returns run token + **floor-1 payload** (tiles, entities, shared-state deltas). Layouts are served *per floor on descent* — the client never holds the seed, killing full-tower foresight. |
| `/api/run/act` | POST | **Batched** action log segment (default flush: 12 actions or 5 s or on unknown-interaction). Server replays segment, checks checkpoint hash, applies **rules resolution** for flagged interactions, returns `events[]` (outcomes) + any shared-state deltas. |
| `/api/run/descend` | POST | Validates stair tile; returns next floor payload. |
| `/api/run/bank` | POST | At Waystone: commits ≤3 claims + discoveries; transactional first-credit resolution. |
| `/api/run/end` | POST | Death/exit. Finalizes run, writes corpse + echo, returns epitaph payload. |
| `/api/claim` `/api/codex` | POST/GET | Claim submission (also via bank); paged codex reads (cached 60 s). |
| `/api/sign` `/api/vigil` | POST | Template-sign placement; vigil (fires comment-reply + realtime). |
| `/api/lineage/me` `/api/lb/:board` | GET | Profile strip; leaderboards (zset ranges). |
| `/internal/*` | POST | Scheduler + menu + trigger targets (Devvit-invoked only). |

**Unknown-interaction resolution (the secret-keeping mechanism).** When the client sim hits an interaction whose outcome isn't in its *session-learned cache* (first bump on a new monster, first ritual attempt, any omen-sensitive event), it: (1) plays a 250–400 ms generic anticipation beat (lunge wind-up, door shudder), (2) flushes the act batch synchronously, (3) receives the outcome event, (4) plays the specific resolution. Latency is hidden inside animation. Resolved rules cache per session, so each secret costs one round-trip per run at most. Everything already-known resolves locally at zero latency.

**Realtime (broadcast-only presence layer).** Channels: `uv-day-{n}` (brazier lit, sign placed, "a delver has fallen on Floor N", gate ticker, communion plate status) and `uv-run-{floorBand}` for co-presence pulses. Client "sends" only via HTTP endpoints (platform shape). Channel names contain no `:` (platform rule). Everything realtime is **cosmetic or advisory** — dropped messages can never desync game state; Redis remains truth.

---

## 5. Redis Data Model (single source of persistent truth)

Rules the schema obeys: **no key listing exists** → every collection maintains its own index (zset/hash); **no Lua** → atomicity via single-command ops (`hIncrBy`, `zIncrBy`, `zAdd`) or `watch/multi/exec` for one-winner races; **sorted sets only** (no plain sets) → membership = zset with score 0 or timestamp; TTLs handle day/corpse expiry; big blobs use `redisCompressed`.

| Key (prefix `uv:`) | Type | Contents / notes | TTL |
|---|---|---|---|
| `day:{d}:meta` | hash | seed (server-only use), omenId, biomeCap, postId | 48 h |
| `day:{d}:shared:{floor}` | hash | braziers, valves, plate states, glowmoss: `x,y → packed(uid,ts,kind)` | 48 h |
| `day:{d}:signs:{floor}` | hash + zset idx | signId → packed(template,noun,x,y,uid,votes) | 48 h |
| `corpse:{id}` | hash | uid, house, gen, day, floor, x, y, words, gift, unbanked[], vigils | 72 h |
| `corpses:{floor}` | zset | score=expiryTs, member=corpseId (spatial-ish index; GC by score) | — |
| `echo:{id}` | string (compressed) | 24 s keyframes @2 Hz: pos+facing+candleState ≈ 300 B | 72 h |
| `echoes:{d}:{floor}` | zset | score=interestScore; **capped 50/floor** via `zRemRangeByRank` | 48 h |
| `run:{uid}:{d}` | hash | token state machine (issued→active→banked→done), startTs, lastHash, wax, pos | 26 h |
| `user:{uid}` | hash | house, gen, bestDepth, streak, stubs, heirlooms, prefs(mute), chalk:{floor} bitset (cap 8 floors, ~200 B ea) | — |
| `rule:{hash}:confirms` | zset | member=uid score=day → distinct-confirmer count = `zCard` | — |
| `claim:{id}` / `claims:byRule:{hash}` | hash / string | triple, discoverer, day, status(pending/inked/disproven/conditional) / dedupe pointer | — |
| `codex:inked` | zset | score=inkDay — the public book, paged reads | — |
| `lb:depth:{d}` `lb:season` `lb:disc` `lb:truth` | zset | daily depth, season depth, discoveries, disprovals | daily: 48 h |
| `gate:{week}` | hash | progress fields, threshold snapshot, openedAt | — |
| `chronicle:{d}` | string(json) | rendered chronicle payload | 14 d |
| `flair:dirty` | zset | uids needing flair sync (batch job drains) | — |

**Byte math @ pessimistic 50 k DAU:** corpses 15 k/day × 250 B × 3 d ≈ 11 MB · echoes 25 floors × 50 × 300 B × 2 d ≈ 0.8 MB · runs 50 k × 300 B ≈ 15 MB (26 h TTL) · users 200 k × 600 B ≈ 120 MB (the only unbounded aggregate — chalk capped, prune inactive-90 d) · codex+claims ≈ 5 MB · day-shared ≈ 2 MB. **Steady state ≈ 150–170 MB of 500 MB.** Headroom 3×. Command rate: ~10 cmd per act-batch → 50 k × 40 batches/day ≈ 23 cmd/s average, spikes ≤ 2 k/s at reset — versus the 40 k/s ceiling.

---

## 6. Scheduler Jobs (≤10 allowed; we use 6)

| Job | Cron (UTC) | Work |
|---|---|---|
| `reshuffle` | 0 0 \* \* \* | Mint daySeed + omen; write `day:{d}:meta`; **submitPost** daily post with 2 KB postData (day n°, gate %, codex %, teaser) |
| `chronicle` | 5 0 \* \* \* | Aggregate prior day (zsets) → render → **submitComment** chronicle on old post + link in new; store `chronicle:{d}` |
| `gc` | 0 \* \* \* \* | Drain expired corpses/echoes by zset score; trim echo caps |
| `gate-tick` | 30 \* \* \* \* | Recompute gate progress vs. population-scaled threshold; realtime ticker |
| `gate-open` | 0 0 \* \* 0 | If met: unlock biome, event post |
| `flair-sync` | 15 \* \* \* \* | Drain `flair:dirty` in batches (Reddit-API rate-friendly) |

All heavy day-end aggregation reads *pre-maintained* zsets — jobs finish in seconds, far inside the 30 s ceiling, and creation/delivery stays under the 60/min scheduler limits.

---

## 7. Anti-Cheat & Integrity

- **Replay validation** (§3) is the wall: outcomes derive only from server replay of the signed action log; checkpoint-hash mismatch → run voided, `integrity:{uid}` incremented, soft-flag at 3.
- **One candle:** `run:{uid}:{d}` state machine, `watch/multi/exec` on start; idempotent retries safe.
- **Wall-clock ceiling:** run token expires 45 min after start (auto-epitaph *"the dark took them while they lingered"*). Prevents day-long camping of a run session.
- **Rate limits:** act-batch ≥1 s spacing per token; sign 2/run; claim 3/bank; vigil 10/day — all cheap zset/hash counters.
- **Claims can't be invented:** only server-verified event stream entries are claimable; the claim UI is a *selector over verified events*, not an input.
- **Free-text safety:** last words + house names pass a denylist filter, are report-wired (Devvit menu action → mod queue), and shadow-hide on threshold. Signs are template-composed → structurally safe.
- **Trust boundary note:** client code and memory are readable by users — that's why *no secret rule ever ships*; the worst a modified client can do is desync and void itself.

---

## 8. Phaser 4 Rendering Plan (fidelity budget included)

**Base:** Phaser 4.2, WebGL-only (Canvas fallback = static "the Vault requires WebGL" card), internal resolution 480×854 portrait, FIT scale, `roundPixels: true`. **Isometric presentation over square-grid logic (decided):** the sim remains an orthogonal grid and never learns iso exists; projection is render-only. 2:1 dimetric — ground diamonds 64×32 art px, wall pieces 64×96 (tall faces carry normal maps so candlelight rakes *up* them); entities are upright billboard sprites (~56 px, anchored bottom-center, E/W flip). Projection `screenX=(x−y)·32, screenY=(x+y)·16−z·16`; input inverts then diamond hit-tests. Depth sort `=(x+y)` + layer bias (ground<corpse<item<entity<wall<fx). **Wall occlusion fade:** walls SE of the player overlapping their sprite tween to 35% alpha in 120 ms. Inspect shows a grid-reference plaque ("Fl. VII · K4") to keep community location-talk precise. **Hybrid client rendering (decided):** the world and per-frame HUD are Phaser; text-heavy sheets (Waystone, Epitaph, Codex, menus — and the Guildhall by nature) are **DOM overlays above the canvas** — crisp text, native `<input>` for last words on mobile keyboards, and direct reuse of design prototypes per `05-DESIGN-HANDOFF.md`.

| Layer | Technique |
|---|---|
| Floors/walls | Ground = standard **isometric TilemapLayer** (native iso orientation + iso culling; TilemapGPULayer is orthographic-only per Phaser docs — not used for the world). Walls = individual y-sorted sprites with vertical-face **normal maps** + occlusion fade |
| Lighting | v4 lights: player candle = point light with wax-driven radius/flicker; **Focus = cone light** (`setCone*`); braziers/glowmoss = warm/verdigris statics; **Lantern-Keeper = sweeping cone**; budget ≤10 active, camera-culled |
| Camera filter stack (≤4) | Vignette (depth-scaled dread) → fine Noise grain → per-biome ColorMatrix grade → omen GradientMap tint. Candle-death = scripted Glow pulse + inverted flash |
| Snuffed "memory view" | Chalk/known tiles re-rendered through **Quantize** (dithered ghost cartography) — signature look |
| Atmosphere | **Noise GO** (GPU simplex) drifting fog over unexplored; **SpriteGPULayer** for dust/embers/spores (thousands, one draw) |
| Systems FX | Fire spread tile anims; conduction = Graphics arcs + Glow filter; gas = cellular-noise clouds |
| Echo ghosts | Keyframe playback → translucent tinted sprite + slight Blur, verdigris rim |
| Text | BitmapText everywhere hot (incl. cipher glyph font — it *receives light*) |

**Performance budget (mid-tier Android, 60 fps):** draw calls <40 · resident textures = 1 UI atlas + 1 biome pack (PCT atlas format, ~90 % smaller manifests) · zero per-frame allocations (pools for entities/FX/events) · filters ≤4 · dt clamped; `visibilitychange` → pause loop + suspend audio. v4's automatic **WebGL context restoration** covers app-backgrounding (a Phaser 3 killer on mobile webviews). Bundle: inline entry ≤300 KB; expanded core ≤1.2 MB + lazy per-biome packs (~200 KB each) loaded at Gate unlocks.

---

## 9. Audio Architecture

`AudioContext` created suspended; **resumed inside the match-strike gesture** (platform-compliant unlock, diegetic). Graph: `master → music (lowpass ← wax%) | sfx (per-biome convolution, material footsteps) | whisper (gain ← darkness)`. Assets: 1 loop/biome + 1 one-shot sprite sheet, OGG+M4A, ≤3 MB total. Monster tells are data-driven (`tells.ts`: entity → cue, radius, cooldown) so audio knowledge is Codex-alignable. Mute preference persists in `user:{uid}` prefs — **never localStorage** (wiped every app update).

---

## 10. Platform Constraint Compliance Matrix

| Platform fact (verified) | Design answer |
|---|---|
| Serverless: no websockets/streaming; 30 s / 4 MB / 10 MB | Turn-based batched HTTP; realtime for broadcast-only cosmetics; largest payload ≈ 8 KB |
| Client CSP: no external fetch; server fetch = allowlist w/ review | **Zero external dependencies.** All assets bundled; all services = Devvit primitives |
| localStorage wiped per update | All persistence in Redis (incl. mute pref, chalk maps) |
| Redis 500 MB / 5 MB req / 40 k cmd/s | Byte-math ≈ 165 MB steady (§5); biggest value = compressed echo ≈ 300 B |
| No key listing / no Lua / sorted-sets-only | Explicit zset indexes per aggregate; atomics + watch/multi/exec; membership-as-zset |
| Scheduler: 10 recurring, 60/min | 6 jobs, second-scale runtimes |
| Realtime: server→client only; no `:` in channels | `uv-day-{n}` naming; advisory-only semantics |
| Audio: no autoplay; mute button; visibilitychange | Match-strike unlock; persistent mute; hard-mute on hide |
| Inline vs expanded modes | Lite DOM Guildhall inline (<1 s) / full Phaser expanded |
| Don't gate logged-out play | Vision mode (floors 1–2, no persistence) |
| userActions: as-user posting needs explicit button; no votes/follows | "Post my epitaph" opt-in; app-account automation for Chronicle/cards |
| Push notifications & Blob storage = gated betas | **Zero dependency**; inbox pings via comment replies; echoes fit Redis. Apply for both as upside |
| Media upload 20 MB / 30 s | Death cards ≈ 60 KB PNGs |
| postData 2 KB | Guildhall header paint without a server call |
| App-account API rate norms | Flair batched hourly; comments consolidated under daily post |

---

## 11. Observability & Ops

Structured logs per endpoint (latency, redis cmd count, validation result); `uv:metrics:{d}` hash of counters (runs, deaths by cause, claims, inks, mean depth) — powers both the Chronicle and our tuning; kill-switches in Devvit settings (`freezeRuns`, `signMute`, `omenOverride`) for live incident response; error taxonomy surfaced to client as in-fiction toasts ("the Vault shudders — try again") with retry-safe idempotency.

## 12. Security & Privacy Summary

No PII beyond Reddit uid/username already in-platform; deleted users render as "A Forgotten Delver"; free-text minimized, filtered, reportable; no external calls; all writes authenticated through Devvit context; secrets (rules/omens/cipher) exist only in server bundle + Redis.