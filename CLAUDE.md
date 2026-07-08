# CLAUDE.md — The Undervault (agent brief)

You are building **The Undervault**: a community knowledge-roguelike Reddit game on **Devvit Web** (serverless) with **Phaser 4.2**. One shared daily dungeon, one life per player per day, hidden rules discovered communally via a server-verified Codex. Read this file fully before any task.

## Document map (authoritative order)

| Doc | Governs | Read when |
|---|---|---|
| `docs/02-SYSTEM-DESIGN.md` | Architecture, protocol, Redis schema, determinism, anti-cheat, perf budgets, platform limits | **Always first** for any code task |
| `docs/01-GAME-DESIGN.md` | Mechanics, numbers, bestiary/items/omens/doors content tables, loops, award mapping | Any gameplay/content task |
| `docs/04-UI-SPEC.md` | Tokens, components, every screen layout/state, motion, copy | Any client-visible task |
| `docs/05-DESIGN-HANDOFF.md` | How `design/` deliverables are consumed; DOM-overlay vs Phaser split | Any task touching `design/` or UI screens |
| `docs/03-BUILD-PLAN.md` | Milestone order, exit tests, risk valves | Planning/estimation |

Conflict rule: 02 wins on *how*, 01 wins on *what/values*, 04 wins on *appearance/copy*. If two docs disagree, flag it in the PR description — do not silently pick.

## HARD INVARIANTS (violating any of these = broken build, no exceptions)

1. **Determinism:** all game logic in `src/shared/sim/` — pure functions, **integers only**, no `Math.random`, no `Date.now()` inside ticks, sorted iteration, RNG = seeded xoshiro128** with named substreams (`gen|spawn|ai|loot|fx`); `fx` stream must never influence validated state.
2. **Secrets never reach the client.** Hidden rule outcomes, omen definitions, cipher mapping live only in `src/server/rules/` and Redis. A build guard (`tools/no-secret-leak`) must fail if `server/rules` is imported from `client/` or `shared/`. Unknown interactions resolve via `/api/run/act` synchronous flush (see 02 §4).
3. **Redis is the only persistence.** Never `localStorage`/`sessionStorage`/IndexedDB (platform wipes them per release). User prefs (incl. mute) live in `user:{uid}` hash.
4. **No external network anywhere.** Client fetches same-origin `/api/*` only; server uses zero fetch domains. Do not add any dependency that phones home.
5. **No key scans, no Lua, no plain Sets** in Redis code — every collection maintains its own zset/hash index per 02 §5; atomicity via single-command ops or `watch/multi/exec`.
6. **Audio starts only inside the match-strike gesture**; `visibilitychange` must hard-mute; a mute control is always visible.
7. **Two entrypoints stay asymmetric:** `splash.html` (Guildhall) ships **no Phaser**, ≤300 KB, paints from postData; `game.html` carries the engine.
8. **Server endpoints are stateless** and must comfortably clear 30 s / 4 MB / 10 MB; no streaming, no websockets, no long polls > limits.
9. **All endpoint payloads validated with zod** (`src/shared/protocol.ts`); action logs are versioned (`logV` field) — never change the codec without bumping.
10. **One candle per user per day** enforced server-side via `run:{uid}:{day}` state machine; every mutating endpoint idempotent.

## Conventions

TypeScript strict; Hono on server; repository pattern per aggregate in `src/server/data/` (routes never touch redis directly). File layout mirrors 02 §2 exactly. Phaser: WebGL-only, `roundPixels: true`, prefer built-in **Filters** over custom render nodes; consult the `skills/` folder in the phaser repo for v4 APIs before inventing. UI values come from `tokens.ts`/`tokens.css` generated per 04 §2 — never hardcode hex/px in components. Commit style: `area: change` (`sim: fov shadowcast`, `server: bank transaction`).

## Definition of Done (every PR)

- [ ] `npm run test:replay` — golden corpus hash-identical (add a new golden when touching sim)
- [ ] `npm run test:unit` + lint + typecheck clean
- [ ] `tools/no-secret-leak` and `tools/byte-report` pass (byte deltas justified in PR text)
- [ ] Touched screens match 04 states (attach screenshot in PR)
- [ ] Any new tuning value cross-referenced to 01 table (or proposed there)

## Decided vs. Open

**Decided (do not relitigate):** per-tick wax burn (not real-time); per-floor layout delivery (client never sees seed); server-resolved unknown interactions; template-composed signs; corpse TTL 72 h; echo cap 50/floor; flair format `⚑ House {name} · D{n} · {k}✦`; 480×854 portrait internal res; Phaser 4 (not 3); **isometric 2:1 dimetric presentation over unchanged square-grid logic** — sim never learns iso exists (projection in `src/client/render/iso.ts` only); ground = standard isometric TilemapLayer (TilemapGPULayer is orthographic-only — never use it for the world); 64×32 ground diamonds, 64×96 walls, upright billboard entities with E/W flip; depth `=(x+y)`+layer bias; wall occlusion fade (35% alpha, 120 ms); inspect shows grid-reference plaque; **hybrid client rendering** — world + HUD are pure Phaser, text-heavy sheets (Guildhall, Waystone, Epitaph, Codex, menus) are DOM overlays above the canvas (real inputs, crisp text); `design/` is read-only input consumed per `05-DESIGN-HANDOFF.md` (adapt prototypes for DOM surfaces, treat mocks as visual targets for Phaser surfaces, import tokens — never hardcode).
**Open (ask or propose, don't assume):** GDD §19 items; exact monster tuning numbers beyond listed; chronicle "cruelest death" heuristic weights; biome 5–6 generator specifics.

## When to ask vs. decide

Decide freely: implementation details inside invariants, refactors, test additions, content *proposals* (put numbers in PR description). Ask first: anything touching an invariant, schema key shape changes, new dependencies, new endpoints, scope beyond current milestone. Milestone ordering: Track A (03 §2, M1→M3 sequential) **or Track B (03 §2 "Playable-First", VS first)** — whichever the operator invoked; VS relaxes *sequencing only*, never the invariants above (dev-only adapters must be labeled `// DEV-ONLY: deleted at M2`).

## Appendix — data file shapes (server `rules/` unless noted)

```ts
// rules.json — the secret table
type Rule = { id: string; subject: EntityId; interaction: Verb; object: EntityId | ItemId | 'self';
  effect: EffectId; condition?: { omen?: OmenId; candle?: 'lit'|'cupped'|'snuffed'; tile?: TileTag };
  layer: 0|1|2|3 };            // layer = intended discovery depth, drives playtest QA
// omens.json
type Omen = { id: OmenId; mutations: Partial<SimConstants>; spawnMods?: Record<EntityId, number>;
  tellHint: string /* chronicle teaser fragment */ };
// tells.json (client-safe)
type Tell = { entity: EntityId; cue: AudioCueId; radius: number; cooldownTicks: number };
// shared/protocol.ts (client-visible)
type FloorPayload = { floor: number; w: number; h: number; tiles: Uint8Array /* b64 */;
  entities: PackedEntity[]; shared: SharedDelta[]; waystones: XY[] };
type ActBatchReq = { token: string; logV: 1; fromTick: number; actions: string /* bitpacked b64 */;
  checkHash?: string };
type ActBatchRes = { events: OutcomeEvent[]; shared: SharedDelta[]; serverTick: number };
type Claim = { subject: string; interaction: string; object: string; effect: string; cond?: string };
```

Start every session by running the replay suite; end every session leaving it green.
