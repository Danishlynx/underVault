# 08 — M2 Devvit Port: Binding Implementation Contract

**Status: BINDING.** Every M2 implementer codes against this file alone. Where this file and
another doc disagree, the disagreement is flagged in §0.2 — do not silently re-decide.
Sources synthesized: `docs/02-SYSTEM-DESIGN.md`, `docs/03-BUILD-PLAN.md` (Track B / W2 / M2),
`CLAUDE.md` appendix, `DECISIONS.md` (D17, D19, D32, D33, D50, D51, D71), Devvit Web platform
research @ packages 0.13.7 (July 2026), and the live repo state.

**Do not commit anything — the orchestrator commits.**

---

## 0. Scope, authority, conflict flags

### 0.1 M2 scope (03 §1 W2, §2 M2)

Server-validated run E2E: **start → act batches → descend → bank → death/exit** against real
Redis in the playtest sub; **tampered log rejected**. In scope: Hono app + auth middleware; run
state machine; secret rules table v1 (exists); unknown-interaction resolver; Redis repositories
+ indexes; integrity counters; rate limits; `devvit.json` + production vite config + minimal
splash/game shells; typed client fetch layer (`src/client/net/api.ts`); a throwaway wire-probe
harness to drive the E2E exit test. **Out of scope (M3+):** `/api/sign`, `/api/vigil`,
`/api/lineage/*`, `/api/lb/*`, chronicle/gc/gate/flair jobs, realtime channels, kill-switch
settings wiring, the full async client cutover (§7 is design-only).

### 0.2 Conflict flags (per CLAUDE.md conflict rule — flagged, not silently chosen)

| # | Conflict | Resolution in this contract |
|---|---|---|
| C1 | CLAUDE.md appendix shows `logV: 1` in `ActBatchReq`; D50 + shipped sim are at `LOG_V = 2` (`STATE_V = 2`, ARG_BITS payloads). | Protocol ships `logV: z.literal(2)`. Invariant 9 satisfied (codec changed ⇒ version bumped). Appendix literal is superseded. |
| C2 | 02 §2 names the route dir `src/server/routes/`; the orchestrator task mandates `src/server/http/`. | `src/server/http/` is used. Propose a one-line 02 §2 edit in the PR. |
| C3 | 02 §4 references a separate `runtoken:{uid}:{day}` key; 02 §5 puts the token state machine inside `run:{uid}:{d}`. | One key only: `uv:run:{uid}:{d}` hash holds the token + phase. No separate runtoken key. |
| C4 | 02 §5 byte-math sizes a run row at ≈300 B; server-side replay requires storing the full packed action log (≤ ~600 B) + per-floor entry timestamps in the run hash (≈1–1.5 KB total). | Accepted: 50 k runs × 1.5 KB ≈ 75 MB, steady state ≈ 225–245 MB < 300 MB alarm. `tools/byte-report` must add a run-log line item. |
| C5 | D32 mandates ≥2×u32 day seed + server-secret derivation before M2, but `src/shared/gen/` is frozen (`generateFloor(daySeed: number, …)` takes one u32). | Solved without touching gen: master seed is 2×u32 crypto-random (`seedHi`,`seedLo`, server-only); the u32 handed to `generateFloor` is **derived per (day, floor)** via `xxhash32` (§1.9 `seed.ts`). Inverting a floor's `rngInit` recovers only that floor's derived u32 — no cross-floor foresight, no master-seed recovery. `FloorPayload` ships no seed-recoverable material beyond the floor the client already holds. |
| C6 | 03/DECISIONS say the dev adapter is "deleted at M2"; the orchestrator DO-NOT-TOUCH list says `dev/**` stays working. | `dev/**` is untouched and keeps working; **deletion deferred to M2b** (client cutover). Enforcement instead: guard extension (§1.13) bans `dev/` imports from `src/server` too, so nothing shipped can reach it. |
| C7 | Appendix `Claim = { subject, interaction, object, effect, cond? }` (strings); the shipped sim/ports use `LearnedRule = { key: ruleKey-string, effect: number }`. | Wire uses `{ key, effect }` (`zLearnedRuleWire`). Same information — `key` is `subject|verb|object|cond` (`ruleKey()` in `src/shared/sim/systems.ts`). Server splits the key when writing codex rows. Appendix shape superseded. |
| C8 | Codex entry text: dev adapter renders via `describeRuleKey` from `src/client/ui/vocab.ts`; server must not import client code. | Server stores/serves **structured** entries (`ruleKey`, `effect`, `status`, `confirms`, `day`); the client derives `subject`/`text` locally with `describeRuleKey`. `CodexEntryRec.subject/text` are filled client-side (M2b remote-ports adapter). |
| C9 | 02 gate % is computed by M3 jobs; Guildhall needs a number now. | `/api/day` serves `gatePct = min(99, day * 9)` — the same explicit stand-in the dev adapter uses. Marked `// M2 STAND-IN: replaced by gate-tick job at M3`. |

### 0.3 Fixed integer constants (server)

`src/server/core/constants.ts` — all binding:

```ts
export const DAY_TTL_S = 172800;        // 48 h  — day:* keys
export const RUN_TTL_S = 93600;         // 26 h  — run:{uid}:{d}
export const CORPSE_TTL_S = 259200;     // 72 h  — corpse lifetime (scores, not EXPIRE-only)
export const CHRONICLE_TTL_S = 1209600; // 14 d  (M3)
export const RUN_EXPIRY_MS = 2700000;   // 45 min — token expiry after start (02 §7)
export const ACT_MIN_SPACING_MS = 1000; // act-batch rate limit per token
export const GC_GRACE_S = 3600;         // corpses removed only when expiryTs < now - GRACE (§3.1 determinism)
export const ECHO_FLOOR_CAP = 50;       // zRemRangeByRank cap (02 §5)
export const ECHO_SERVE_MAX = 8;        // echoes shipped per floor payload
export const INK_AT = 5;                // distinct confirmers to ink (mirrors dev adapter; 01-table cross-ref in PR)
export const MAX_RUN_STEPS = 4096;      // hard ceiling on total log length per run
export const MAX_SEGMENT_STEPS = 256;   // hard ceiling per act batch
export const KEY = "uv:";               // global key prefix (02 §5)
```

---

## 1. File tree + exact exported signatures

Legend: **NEW** = create, **EXT** = extend existing, **RO** = exists, read-only for M2.
Convention: function bodies are elided (`{ … }` or none shown); every exported *signature*,
*type*, and *zod schema* below is verbatim-binding and mutually consistent. All shared/server
imports use explicit `.js` extensions (repo convention, `moduleResolution: bundler`-safe).

```
devvit.json                          NEW   (§1.1)
vite.devvit.config.ts                NEW   (§1.2)   — production build; root vite.config.ts (dev harness) UNTOUCHED
tsconfig.server.json                 NEW   (§6)
package.json                         EXT   (§5, §6)
src/shared/protocol.ts               NEW   (§1.3)   — zod schemas + wire codecs (client-safe)
src/server/index.ts                  NEW   (§1.4)
src/server/http/env.ts               NEW   (§1.5)
src/server/http/middleware.ts        NEW   (§1.5)
src/server/http/day.ts               NEW   (§1.6)
src/server/http/run.ts               NEW   (§1.6)
src/server/http/codex.ts             NEW   (§1.6)
src/server/http/internal.ts          NEW   (§1.6)
src/server/core/constants.ts         NEW   (§0.3)
src/server/core/compose.ts           NEW   (§1.7)
src/server/core/replay.ts            NEW   (§1.8)
src/server/rules/seed.ts             NEW   (§1.9)   — ★ SECRET (D32)
src/server/rules/table.ts            NEW   (§1.9)
src/server/rules/resolve.ts          RO
src/server/rules/rules.json          RO
src/server/rules/omens.json          RO
src/server/data/redis.ts             NEW   (§4)     — RedisLike + txn contract
src/server/data/redis-devvit.ts      NEW   (§4)
src/server/data/redis-mock.ts        NEW   (§4)
src/server/data/days.ts              NEW   (§1.10)
src/server/data/runs.ts              NEW   (§1.10)
src/server/data/corpses.ts           NEW   (§1.10)
src/server/data/echoes.ts            NEW   (§1.10)
src/server/data/codex.ts             NEW   (§1.10)
src/server/data/users.ts             NEW   (§1.10)
src/server/data/metrics.ts           NEW   (§1.10)
src/client/splash.html               NEW   (§1.11)  — NO Phaser, ≤300 KB (invariant 7)
src/client/splash.ts                 NEW   (§1.11)
src/client/game.html                 NEW   (§1.11)
src/client/boot/wire-probe.ts        NEW   (§1.11)  // M2-ONLY: replaced by real bootstrap at M2b
src/client/net/api.ts                NEW   (§1.12)
tools/no-secret-leak/index.ts        EXT   (§1.13)
tools/byte-report/                   EXT   (§1.13)
```

Nothing under `src/shared/sim/`, `src/shared/gen/`, `dev/`, `src/client/scenes/`,
`src/client/ui/menu/` changes (§8).

### 1.1 `devvit.json` (NEW)

```json
{
  "$schema": "https://developers.reddit.com/schema/config-file.v1.json",
  "name": "the-undervault",
  "post": {
    "dir": "dist/client",
    "entrypoints": {
      "default": { "inline": true, "entry": "splash.html" },
      "game": { "entry": "game.html", "height": "tall" }
    }
  },
  "server": { "dir": "dist/server", "entry": "index.cjs" },
  "permissions": {
    "redis": true,
    "reddit": { "enable": true, "scope": "user" }
  },
  "menu": {
    "items": [
      {
        "label": "Undervault: mint today's descent",
        "description": "Creates the daily post (manual reshuffle)",
        "location": "subreddit",
        "forUserType": "moderator",
        "endpoint": "/internal/menu/mint-day"
      }
    ]
  },
  "scheduler": {
    "tasks": {
      "reshuffle": { "endpoint": "/internal/jobs/reshuffle", "cron": "0 0 * * *" }
    }
  },
  "triggers": { "onAppInstall": "/internal/triggers/on-app-install" },
  "scripts": {
    "build": "vite build -c vite.devvit.config.ts",
    "dev": "vite build --watch -c vite.devvit.config.ts"
  }
}
```

Notes: `name` matches `^[a-z][a-z0-9-]*$`, 14 chars. **Endpoint paths are binding; the
`scheduler`/`menu` field shapes must be validated against the live `config-file.v1` schema at
implementation time** — if the schema differs (e.g. `scheduler.tasks` nesting), adapt the JSON,
never the endpoint paths. `http`/`media`/`realtime`/`payments` permissions stay absent
(invariant 4; realtime lands M3).

### 1.2 `vite.devvit.config.ts` (NEW)

```ts
import { defineConfig } from "vite";
import { devvit } from "@devvit/start/vite";

export default defineConfig({
  plugins: [devvit()],
});
```

The `@devvit/start` plugin reads `devvit.json`: client entry HTMLs resolve from `src/client/`
(multi-entry ESM → `dist/client`), server → single **CJS** `dist/server/index.cjs` (Devvit
runtime does not support ESM server bundles; do not mark server deps external). The existing
root `vite.config.ts` (dev harness, `root: "dev"`) is untouched; the two configs never share
output dirs. **Build acceptance:** the emitted `splash.html` chunk graph must contain no
`phaser` module (invariant 7) — `tools/byte-report` asserts this (§1.13).

### 1.3 `src/shared/protocol.ts` (NEW — client-safe, no secrets, no server imports)

Full binding surface. Imports only zod + client-safe shared modules
(`sim/types.js`, `sim/pack.js`). Compiles under `tsconfig.shared.json` (`types: []`).

```ts
import { z } from "zod";
import type { FloorData, Entity, OutcomeEvent, OmenMods } from "./sim/types.js";
import { toB64, fromB64 } from "./sim/pack.js";

export const PROTOCOL_V = 1;

// ── primitives ─────────────────────────────────────────────────────────────
export const zU8 = z.number().int().min(0).max(255);
export const zU16 = z.number().int().min(0).max(65535);
export const zU32 = z.number().int().min(0).max(4294967295);
export const zI16 = z.number().int().min(-32768).max(32767);
export const zB64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/).max(700000);
export const zHash8 = z.string().regex(/^[0-9a-f]{8}$/);
export const zToken = z.string().min(16).max(64);

// ── errors ─────────────────────────────────────────────────────────────────
export const ErrCode = {
  UNAUTHENTICATED: "UNAUTHENTICATED", // 401 — Vision mode plays locally, no server calls
  NO_DAY: "NO_DAY",                   // 503 — day not minted yet
  CANDLE_SPENT: "CANDLE_SPENT",       // 409 — run already banked/done today (invariant 10)
  NO_RUN: "NO_RUN",                   // 404 — no active run / bad token
  RUN_EXPIRED: "RUN_EXPIRED",         // 409 — 45 min token expiry; server auto-finalized
  RUN_ALIVE: "RUN_ALIVE",             // 409 — /end called while replayed status is ALIVE
  DESYNC: "DESYNC",                   // 422 — checkpoint-hash mismatch; run voided, integrity++
  RATE: "RATE",                       // 429 — act spacing < 1 s, etc.
  BAD_INPUT: "BAD_INPUT",             // 400 — zod reject / malformed log / claim not learned
  CONFLICT: "CONFLICT",               // 409 — watch/multi lost; client may retry
  FROZEN: "FROZEN",                   // 503 — freezeRuns kill switch (wired M3)
} as const;
export type ErrCodeT = (typeof ErrCode)[keyof typeof ErrCode];
export const zErrRes = z.object({
  error: z.enum(Object.keys(ErrCode) as [ErrCodeT, ...ErrCodeT[]]),
  message: z.string().max(200), // in-fiction toast copy per 04; retry-safe (02 §11)
});
export type ErrRes = z.infer<typeof zErrRes>;

// ── shared wire fragments ──────────────────────────────────────────────────
export const zOmenModsWire = z.object({
  graceTicks: zU16, burnBasic: zU8, radiusPenalty: zU8,
  quietFeet: zU8, beastEar: zU8, echoRadius: zU8,
});
export const zRunSetupWire = z.object({
  mods: zOmenModsWire, heirloom: zU8, noSalt: z.boolean(),
}); // == ports.RunSetup, numbers only — WHY stays secret (02 §7)
export type RunSetupWire = z.infer<typeof zRunSetupWire>;

export const zEntityWire = z.object({
  id: zU32, kind: zU8, x: zU16, y: zU16, hp: zI16, state: zU8, data: zU16,
}); // 1:1 with sim Entity
export const zEchoWire = z.object({
  day: zU32, floor: zU8,
  frames: z.array(z.tuple([zU16, zU16, zU8])).max(64), // [x, y, candle] @ 2 Hz — cosmetic only
});
export type EchoWire = z.infer<typeof zEchoWire>;
export const zSignWire = z.object({
  tileIndex: zU32, template: zU8, noun: zU8,
}); // content for tiles already flagged in FloorData.signs bitmap
export type SignWire = z.infer<typeof zSignWire>;
export const zLearnedRuleWire = z.object({ key: z.string().min(7).max(96), effect: zU8 });
export type LearnedRuleWire = z.infer<typeof zLearnedRuleWire>; // == ports.LearnedRule (C7)
export const zGiftWire = z.object({ item: zU8, charges: zU8 }); // == ports.CorpseGift
export const zEventWire = z.object({ tick: zU32, type: zU8, a: zU32, b: zU32, c: zU32 });
export const zCodexEntryWire = z.object({
  ruleKey: z.string().max(96), effect: zU8,
  status: z.enum(["conditional", "true", "inked", "disproven"]),
  confirms: zU16, day: zU32,
}); // structured only — subject/text derived client-side via describeRuleKey (C8)
export type CodexEntryWire = z.infer<typeof zCodexEntryWire>;

export const zFloorWire = z.object({
  floor: zU8, w: zU16, h: zU16,
  tiles: zB64,                       // w*h bytes — braziers/glowmoss already layered in
  px: zU16, py: zU16,
  entities: z.array(zEntityWire).max(512), // sorted ascending by id — corpses injected
  nextEntityId: zU32,
  chalk: zB64.optional(),            // w*h bytes — caller's own persistent chalk (D17)
  signs: zB64.optional(),            // w*h bytes — presence bitmap
  rngInit: zB64,                     // 80 bytes = 20×u32 LE, per-floor derived seed (D32/C5)
  signContents: z.array(zSignWire).max(128),
  echoes: z.array(zEchoWire).max(8),
  corpseIds: z.array(z.string().max(40)).max(64), // corpse entity.data indexes into this
});
export type FloorWire = z.infer<typeof zFloorWire>;

// ── /api/day ───────────────────────────────────────────────────────────────
export const zDayRes = z.object({
  day: zU32, gatePct: zU8, codexPct: zU8, fallenToday: zU16,
  teaser: z.string().max(140),       // omen tellHint fragment — the rumor, never the omen id
  houseLine: z.string().max(120).optional(), // present when authenticated
});
export type DayRes = z.infer<typeof zDayRes>;

// ── /api/run/start ─────────────────────────────────────────────────────────
export const zStartReq = z.object({}).strict();
export const zStartRes = z.object({
  token: zToken, day: zU32, resumed: z.boolean(),
  setup: zRunSetupWire, floor: zFloorWire,
});
export type StartRes = z.infer<typeof zStartRes>;

// ── /api/run/act ───────────────────────────────────────────────────────────
export const zActReq = z.object({
  token: zToken,
  logV: z.literal(2),                // D50 — supersedes appendix logV:1 (C1)
  fromTick: zU32,                    // steps already acked; idempotency key with `actions`
  actions: zB64,                     // pack.ts frame (u8 logV · u16 LE count · bitstream)
  checkHash: zHash8.optional(),      // h32Hex(state) — required when crossing a 32-tick boundary
});
export type ActReq = z.infer<typeof zActReq>;
export const zCorpseYieldWire = z.object({
  entityId: zU32, corpseId: z.string().max(40),
  gift: zGiftWire.nullable(),        // D51: granted server-side, display-only in sim terms
  unbanked: z.array(zLearnedRuleWire).max(8), // joins run.learned server-side
});
export const zActRes = z.object({
  serverTick: zU32,
  events: z.array(zEventWire).max(4096),
  rules: z.array(zLearnedRuleWire).max(64), // every rule consulted this segment (cache fill)
  corpses: z.array(zCorpseYieldWire).max(4),
});
export type ActRes = z.infer<typeof zActRes>;

// ── /api/run/descend ───────────────────────────────────────────────────────
export const zDescendReq = z.object({ token: zToken, toFloor: zU8 });
export const zDescendRes = z.object({ floor: zFloorWire, serverTick: zU32 });
export type DescendRes = z.infer<typeof zDescendRes>;

// ── /api/run/bank ──────────────────────────────────────────────────────────
export const zBankReq = z.object({
  token: zToken,
  claims: z.array(zLearnedRuleWire).max(3),  // BANK_MAX (sim constants)
  confirms: z.array(z.string().max(96)).max(64), // SessionRules.drainTouched() output
});
export type BankReq = z.infer<typeof zBankReq>;
export const zBankRes = z.object({ entries: z.array(zCodexEntryWire).max(3) });
export type BankRes = z.infer<typeof zBankRes>;

// ── /api/run/end ───────────────────────────────────────────────────────────
export const zEndReq = z.object({
  token: zToken,
  lastWords: z.string().max(80),
  echoFrames: z.array(z.tuple([zU16, zU16, zU8])).max(64), // cosmetic; values clamped server-side
});
export type EndReq = z.infer<typeof zEndReq>;
export const zEndRes = z.object({
  day: zU32, floor: zU8, cause: zU8, generation: zU16,
  epitaphLine: z.string().max(140),
  unbanked: z.array(zLearnedRuleWire).max(64), // learned − banked, server-computed (never trusted)
});
export type EndRes = z.infer<typeof zEndRes>;

// ── /api/codex ─────────────────────────────────────────────────────────────
export const zCodexReq = z.object({ page: zU16 }); // query param, default 0
export const zCodexRes = z.object({
  entries: z.array(zCodexEntryWire).max(50), page: zU16, pageCount: zU16,
});
export type CodexRes = z.infer<typeof zCodexRes>;

// ── codecs (both sides use these; the ONLY tiles/rng wire encoding) ────────
export function u32ToB64(words: Uint32Array): string;   // 20 words → 80 bytes LE → b64
export function b64ToU32(s: string): Uint32Array;       // throws unless byteLength % 4 === 0
export interface FloorExtras {
  signContents: SignWire[]; echoes: EchoWire[]; corpseIds: string[];
}
export function floorToWire(fd: FloorData, rngInit: Uint32Array, extras: FloorExtras): FloorWire;
export function floorFromWire(w: FloorWire): {
  floorData: FloorData; rngInit: Uint32Array; extras: FloorExtras;
};
```

`floorToWire`/`floorFromWire` MUST round-trip exactly (unit test): `tiles`/`chalk`/`signs` via
`toB64`/`fromB64` from `sim/pack.js`; entities copied field-for-field; `rngInit` via
`u32ToB64`. No other serialization of `FloorData` may exist.

### 1.4 `src/server/index.ts` (NEW)

```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createServer, getServerPort } from "@devvit/web/server";
import type { UvEnv } from "./http/env.js";
import { dayRoutes } from "./http/day.js";
import { runRoutes } from "./http/run.js";
import { codexRoutes } from "./http/codex.js";
import { internalRoutes } from "./http/internal.js";
import { requireUser, errorBoundary } from "./http/middleware.js";

const app = new Hono<UvEnv>();
app.use("*", errorBoundary);
app.route("/api/day", dayRoutes);          // GET tolerates anonymous (houseLine omitted)
app.use("/api/run/*", requireUser);
app.route("/api/run", runRoutes);
app.route("/api/codex", codexRoutes);      // GET public
app.route("/internal", internalRoutes);    // platform-invoked only (menu/jobs/triggers)

serve({ fetch: app.fetch, createServer, port: getServerPort() });
```

Stateless per invariant 8 — no module-level mutable caches of game state (a memoized
`RecordingRuleTable` per request is fine; the rules JSON itself is immutable module state and
allowed).

### 1.5 `src/server/http/env.ts` + `middleware.ts` (NEW)

```ts
// env.ts
import type { RedisLike } from "../data/redis.js";
export interface UvVars { uid: string | null; redis: RedisLike; now: number }
export type UvEnv = { Variables: UvVars };
export class ApiFailure extends Error {
  constructor(readonly status: number, readonly code: string, message: string);
}
export function fail(status: number, code: string, message: string): never; // throws ApiFailure

// middleware.ts
import type { MiddlewareHandler } from "hono";
import type { UvEnv } from "./env.js";
export const errorBoundary: MiddlewareHandler<UvEnv>;
// binds c.set("redis", bindDevvitRedis()), c.set("uid", context.userId ?? null),
// c.set("now", Date.now()); catches ApiFailure → zErrRes JSON; catches ZodError → 400 BAD_INPUT;
// logs { route, latencyMs, uid, result } per 02 §11.
export const requireUser: MiddlewareHandler<UvEnv>; // 401 UNAUTHENTICATED when uid === null
```

`Date.now()` is legal here — it never enters sim ticks (invariant 1 scopes to `shared/sim`);
timestamps feed only Redis metadata and ts-pinned composition (§1.7).

### 1.6 Route modules (NEW) — all export a `Hono<UvEnv>` sub-app

```ts
// day.ts
export const dayRoutes: Hono<UvEnv>;      // GET /            → zDayRes
// run.ts
export const runRoutes: Hono<UvEnv>;      // POST /start /act /descend /bank /end
// codex.ts
export const codexRoutes: Hono<UvEnv>;    // GET /?page=n     → zCodexRes  (Redis-cached 60 s)
// internal.ts
export const internalRoutes: Hono<UvEnv>; // POST /menu/mint-day /jobs/reshuffle /triggers/on-app-install
export function mintDay(r: RedisLike, now: number): Promise<{ day: number; created: boolean }>;
// mintDay: one-winner via DayRepo.putMeta (hSetNX); mints seedHi/seedLo/omenSeed (§1.9),
// advances uv:day:current, submits the daily post with ≤2 KB postData
// { day, gatePct, codexPct, teaser } via reddit.submitCustomPost (entry "default").
```

Route behavior is fully specified by §2 (endpoint table) — implement exactly that.

### 1.7 `src/server/core/compose.ts` (NEW) — deterministic floor composition

Server-side twin of the dev adapter's layering (`dev/rules-adapter.ts` is the reference —
**copy the logic, never import it**). Composition MUST be reproducible for the whole run
lifetime, so all inputs are **timestamp-pinned** to the run's per-floor entry time:

- shared entries (braziers, glowmoss) included iff `entry.ts <= enteredTs`;
- signs included iff `sign.ts <= enteredTs`;
- corpses included iff `createdTs <= enteredTs < expiryTs` (GC keeps a 1 h grace — §0.3
  `GC_GRACE_S` — so any corpse visible at entry outlives the 45 min run for later replays);
- caller's own chalk read from `user:{uid}` (stable mid-run: chalk persists only at end/bank);
- echoes are cosmetic, excluded from replay inputs entirely.

Deterministic ordering: shared entries and signs applied in ascending `tileIndex`; corpses
injected in ascending corpse id (string compare), `entity.data` = index into the returned
`corpseIds` array; corpse re-seat uses the dev adapter's 13-offset spiral verbatim; final
`fd.entities.sort((a, b) => a.id - b.id)`.

```ts
import type { FloorData } from "../../shared/sim/types.js";
import type { OmenDay } from "../rules/resolve.js";
import type { SharedEntry, SignEntry } from "../data/days.js";
import type { CorpseRow } from "../data/corpses.js";

export interface ComposeInputs {
  floor: number;
  daySeedFloor: number;              // from daySeedForFloor() — the ONLY seed gen ever sees
  omen: OmenDay;
  enteredTs: number;                 // pin — from RunRow.floorEnteredTs[floor]
  shared: SharedEntry[];
  signs: SignEntry[];
  corpses: CorpseRow[];
  chalk: Uint8Array | null;
}
export interface ComposedFloor {
  floorData: FloorData;
  rngInit: Uint32Array;
  corpseIds: string[];
  signContents: { tileIndex: number; template: number; noun: number }[];
}
export function composeFloor(i: ComposeInputs): ComposedFloor;
// calls generateFloor(i.daySeedFloor, i.floor, i.omen.gen) then layers as above
```

### 1.8 `src/server/core/replay.ts` (NEW) — the validator

The run hash stores the **entire packed log**; every act batch reconstructs state by full
replay from tick 0 (pure integer sim, ≤4096 steps, sub-10 ms — fits 30 s trivially). This is
what makes endpoints stateless (invariant 8) and the run row small (C4).

```ts
import type { SimState, Step, OutcomeEvent, RuleTable } from "../../shared/sim/types.js";
import type { InitOptions } from "../../shared/sim/engine.js";
import type { ComposedFloor } from "./compose.js";

export interface FloorSource { get(floor: number): ComposedFloor } // memoize per request
export interface RecordingTable extends RuleTable { readonly consulted: Map<string, number> }
export interface ReplayOut {
  state: SimState;
  events: OutcomeEvent[];            // events from ALL steps, each stamped with its tick
  consulted: Map<string, number>;    // every ruleKey → effect the sim asked for
}
export function replayLog(
  source: FloorSource, setup: InitOptions, steps: readonly Step[], table: RecordingTable,
): ReplayOut;
// initState(source.get(1)…, rngInit, setup); per step: tick(state, step, table) — the server
// table always returns a number, so tick() can never yield RuleRequest server-side; on
// Ev.DESCENDED → descendState(state, source.get(floor+1)…). Throws ApiFailure(400) on
// malformed steps or MAX_RUN_STEPS breach.
export function segmentEvents(all: ReplayOut, fromTick: number): OutcomeEvent[];
// slice of events with tick >= fromTick — what an idempotent /act retry re-returns
```

Hash check: after replay, if the request carried `checkHash`, compare against
`h32Hex(state)` (`sim/pack.js`). Server MUST also self-check at every
`CHECKPOINT_EVERY`(=32)-tick boundary crossed by the segment when the client supplied a hash
for it. Mismatch ⇒ `DESYNC` (§2 error flow): run phase → `done` (voided), `integrity:{uid}`
incremented via `UserRepo.bumpIntegrity`, soft-flag at 3 (02 §7).

### 1.9 `src/server/rules/seed.ts` + `table.ts` (NEW — ★ SECRET dir)

```ts
// seed.ts — D32: master seed is 2×u32 crypto entropy; only derived u32s ever reach gen/wire.
export function mintDaySeed(): { seedHi: number; seedLo: number; omenSeed: number };
// node:crypto randomBytes(12) → three u32s. NOT sim logic — invariant 1 untouched.
export function daySeedForFloor(seedHi: number, seedLo: number, day: number, floor: number): number;
// = xxhash32(LE bytes of [seedHi, seedLo, day, floor], 0x5eed0001) — uses shared sim/pack.js xxhash32.
// Recovering this u32 from a floor's rngInit yields ONLY that floor. Never write seedHi/seedLo
// anywhere but day:{d}:meta; never log them.

// table.ts
import type { RecordingTable } from "../core/replay.js";
export function ruleTableFor(omenId: string): RecordingTable;
// get(key): resolveRuleKey(key, omenId) — always a number (Effect.NONE for unknown);
// records every lookup into .consulted. Fresh instance per request.
export function omenDayFor(meta: { omenSeed: number; day: number }): OmenDay;
// = omenForSeed(meta.omenSeed, meta.day) — resolve.ts untouched
```

The omen pick derives from `omenSeed` (independent u32), not from floor seeds — a client
inverting `rngInit` learns nothing about the omen (02 §7 secrecy).

### 1.10 `src/server/data/*` repositories (NEW)

Every repo is a class over `RedisLike` (§4); **routes never touch Redis directly**. All keys
are built with the `KEY` prefix (§0.3). All row types below are binding.

```ts
// days.ts
export interface DayMeta {
  day: number; seedHi: number; seedLo: number; omenSeed: number;
  postId: string; createdTs: number;
}
export interface SharedEntry { tileIndex: number; kind: 1 | 2; uid: string; ts: number }
// kind: 1 = brazier lit, 2 = glowmoss planted
export interface SignEntry {
  signId: string; tileIndex: number; template: number; noun: number;
  uid: string; ts: number; votes: number;
}
export class DayRepo {
  constructor(r: RedisLike);
  currentDay(): Promise<number | null>;                       // uv:day:current
  putMeta(m: DayMeta): Promise<boolean>;                      // hSetNX one-winner; sets 48 h TTL + advances current
  getMeta(day: number): Promise<DayMeta | null>;
  getShared(day: number, floor: number): Promise<SharedEntry[]>;
  addShared(day: number, floor: number, e: SharedEntry): Promise<void>; // hSetNX per tileIndex — first writer wins
  getSigns(day: number, floor: number): Promise<SignEntry[]>;
  addSign(day: number, floor: number, s: SignEntry): Promise<void>;
  bumpFallen(day: number): Promise<number>;                   // hIncrBy day:{d}:meta fallen 1
}

// runs.ts
export type RunPhase = "active" | "banked" | "done";          // "issued" collapses into the
// start txn — the row is created already-active with its token (C3)
export interface RunRow {
  token: string; phase: RunPhase; day: number;
  startTs: number; lastActTs: number;
  ticks: number;                     // total steps applied
  lastHash: string;                  // h32Hex at last verified checkpoint ("" until first)
  log: string;                       // b64 of ALL packed segments concatenated as raw step
                                     // bitstreams re-framed as ONE pack.ts frame (see note)
  floor: number;
  floorEnteredTs: number[];          // index = floor (1-based; [0] unused = 0)
  learned: { key: string; effect: number }[]; // server-verified from replay.consulted + corpse yields
  bankedKeys: string[];
  wax: number; posX: number; posY: number;    // observability mirror, never an input
  epitaph: string;                   // JSON.stringify(EndRes) once phase === "done", else ""
}
export class RunRepo {
  constructor(r: RedisLike);
  claimStart(uid: string, day: number, row: RunRow): Promise<"new" | "resume" | "spent">;
  // watch/multi/exec on uv:run:{uid}:{d}: absent → write row ("new"); phase active & not
  // expired → "resume" (caller re-issues same token); else "spent". Sets 26 h TTL.
  load(uid: string, day: number): Promise<RunRow | null>;
  save(uid: string, day: number, row: RunRow): Promise<void>;  // full-row hSet (log grows)
  appendLogAndSave(uid: string, day: number, row: RunRow, addedSteps: number): Promise<void>;
  // convenience wrapper: row.ticks += addedSteps then save; single hSet round-trip
}
// Log storage note (BINDING): the run hash stores steps as a canonical pack.ts frame over the
// FULL step list (unpack each incoming segment → concat Step[] → packActions(all) → toB64).
// Never splice bitstreams byte-wise — ARG_BITS payloads are not byte-aligned.

// corpses.ts
export interface CorpseRow {
  id: string;                        // `${day}-${uid}` — one death per user per day
  uid: string; house: string; gen: number; day: number; floor: number;
  x: number; y: number; words: string;
  gift: { item: number; charges: number } | null;
  unbanked: { key: string; effect: number }[];
  vigils: number; recoveredBy: string; // "" until first recovery
  createdTs: number; expiryTs: number; // expiryTs = createdTs + CORPSE_TTL_S*1000
}
export class CorpseRepo {
  constructor(r: RedisLike);
  put(c: CorpseRow): Promise<void>;                            // hash write + zAdd corpses:{floor} score=expiryTs
  get(id: string): Promise<CorpseRow | null>;
  listForFloor(floor: number, pinTs: number): Promise<CorpseRow[]>; // ts-pinned filter (§1.7), sorted by id
  claimRecovery(id: string, uid: string): Promise<boolean>;    // watch/multi on recoveredBy — one winner
  gcExpired(now: number): Promise<number>;                     // removes expiryTs < now − GC_GRACE_S*1000 (job lands M3; method ships now)
}

// echoes.ts
export class EchoRepo {
  constructor(r: RedisLike);
  put(day: number, floor: number, echoId: string, framesB64: string, interest: number): Promise<void>;
  // set echo:{id} + zAdd echoes:{d}:{floor} score=interest + zRemRangeByRank cap at ECHO_FLOOR_CAP + TTLs
  topForFloor(day: number, floor: number, limit: number): Promise<{ day: number; floor: number; framesB64: string }[]>;
}

// codex.ts
export interface CodexRow {
  ruleKey: string; effect: number;
  status: "conditional" | "true" | "inked" | "disproven";
  confirms: number; day: number; discoverer: string;
}
export function ruleHash(key: string): string; // xxhash32(utf8(key), 0).toString(16).padStart(8,"0")
export class CodexRepo {
  constructor(r: RedisLike);
  bank(uid: string, day: number, claims: { key: string; effect: number }[],
       conditionalSubjects: readonly string[]): Promise<CodexRow[]>;
  // per claim: zAdd rule:{hash}:confirms {member: uid, score: day} (idempotent per uid);
  // confirms = zCard; first-credit via hSetNX claims:byRule:{hash} → discoverer (transactional
  // first-credit, 02 §4); status conditional iff subject ∈ conditionalSubjects else "true";
  // ink when confirms >= INK_AT → zAdd codex:inked score=day. Single-command atomics only.
  confirmObserved(uid: string, day: number, keys: string[]): Promise<void>; // zAdd confirms only for EXISTING rule hashes
  page(page: number, size: number): Promise<{ rows: CodexRow[]; total: number }>; // zRange codex:inked + claim hashes
  inkedCount(): Promise<number>;
  totalRules(): Promise<number>;     // static: RULES.length exposed via a server-only count key at mint — for codexPct
}

// users.ts
export interface UserRow {
  house: string; gen: number; bestDepth: number; streak: number;
  stubs: number; heirloom: number; mute: number;
}
export class UserRepo {
  constructor(r: RedisLike);
  get(uid: string): Promise<UserRow>;                          // defaults for absent fields
  ensureHouse(uid: string, seedName: string): Promise<string>; // hSetNX house
  onDeath(uid: string, day: number, depth: number): Promise<UserRow>; // gen++, bestDepth max, zAdd lb:depth:{d}, flair:dirty
  getChalk(uid: string, floor: number): Promise<Uint8Array | null>;   // user hash field chalk:{floor}, b64
  setChalk(uid: string, floor: number, chalk: Uint8Array): Promise<void>; // cap 8 floors, evict lowest floor first
  bumpIntegrity(uid: string): Promise<number>;                 // incrBy integrity:{uid}; log at >= 3
}

// metrics.ts
export class MetricsRepo {
  constructor(r: RedisLike);
  incr(day: number, field: string, by?: number): Promise<void>; // hIncrBy uv:metrics:{d}, 48 h TTL
}
```

### 1.11 Client shells (NEW — minimal, M2)

```ts
// splash.ts — DOM only; importing "phaser" here is a build failure (invariant 7)
import { context, requestExpandedMode } from "@devvit/web/client";
// paints day n° / gate % / codex % / teaser from context.postData (zero API calls when present;
// falls back to GET /api/day); the single button calls requestExpandedMode(e, "game") — this
// user gesture is also where M3 audio unlock will live (invariant 6).

// boot/wire-probe.ts — M2-ONLY: replaced by real bootstrap at M2b (§7)
export async function runWireProbe(root: HTMLElement): Promise<void>;
// drives a real run through net/api.ts: start → local sim ticks via tickResolving with a
// SessionRules-backed table that flushes on RuleRequest → act batches (12 acts / 5 s / on
// unknown) → descend → bank → end; renders a text log. This is the M2 exit-test driver.
// game.html loads ONLY this at M2; it must not import scenes/ or ui/menu/.
```

`game.html` M2 = `<div id="probe">` + `<script type="module" src="./boot/wire-probe.ts">`.
The Phaser bundle joins `game.html` at M2b — not in this milestone.

### 1.12 `src/client/net/api.ts` (NEW) — typed same-origin fetch layer

```ts
import type {
  DayRes, StartRes, ActReq, ActRes, DescendRes, BankReq, BankRes, EndReq, EndRes, CodexRes,
  ErrCodeT,
} from "../../shared/protocol.js";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: ErrCodeT, message: string);
}
export function apiDay(): Promise<DayRes>;
export function apiRunStart(): Promise<StartRes>;                      // POST {}
export function apiRunAct(req: ActReq): Promise<ActRes>;
export function apiRunDescend(token: string, toFloor: number): Promise<DescendRes>;
export function apiRunBank(req: BankReq): Promise<BankRes>;
export function apiRunEnd(req: EndReq): Promise<EndRes>;
export function apiCodex(page: number): Promise<CodexRes>;
```

Rules: same-origin `fetch("/api/…")` only (invariant 4); every response body parsed with the
matching zod schema (`z…Res.parse`) — a malformed response throws, never propagates; non-2xx
parsed as `zErrRes` → `ApiError`. No retry logic here (batcher's job, M2b); `wire-probe` may
retry idempotent calls manually.

### 1.13 Tooling (EXT)

- `tools/no-secret-leak/index.ts`: **add** `src/server` to the scanned roots with a single
  rule for it — any specifier resolving into `dev/` (relative) or matching `/(^|\/)dev\//`
  (bare) fails the build (C6/D33). Existing client/shared rules unchanged.
- `tools/byte-report/`: **add** (a) assertion that the built `dist/client/splash.html` chunk
  graph contains no `phaser` module and its transitive bytes ≤ 300 KB (invariant 7); (b) a
  projected-footprint line item for run rows at 1.5 KB × runs/day (C4).

---

## 2. Endpoint table

All request/response bodies validated with the §1.3 schemas — reject-on-parse-failure → 400
`BAD_INPUT`. Auth = ambient Devvit `context.userId` via `requireUser`; run endpoints
additionally verify `req.token === row.token`. Every mutating endpoint idempotent
(invariant 10). `uid` below = `context.userId`; `d` = current day.

| Route | Method | Req schema | Res schema | Idempotency key / mechanism | Repos called |
|---|---|---|---|---|---|
| `/api/day` | GET | — | `zDayRes` | natural (read) | DayRepo, CodexRepo, UserRepo (houseLine when uid) |
| `/api/run/start` | POST | `zStartReq` | `zStartRes` | `uv:run:{uid}:{d}` existence via `RunRepo.claimStart` watch/multi — "new"→fresh token+floor 1; "resume"→same token + recomposed floor `row.floor` (`resumed: true`); "spent"→409 `CANDLE_SPENT` | RunRepo, DayRepo, UserRepo (chalk, heirloom), CorpseRepo, EchoRepo, CodexRepo(–), MetricsRepo(`runs`) |
| `/api/run/act` | POST | `zActReq` | `zActRes` | `(token, fromTick, actions)` — if `fromTick + count <= row.ticks` AND incoming steps equal the stored log slice at `fromTick` → pure re-replay, re-return `segmentEvents` (no writes); slice mismatch → 422 `DESYNC` void; `fromTick > row.ticks` → 400 `BAD_INPUT` (gap). M2b valve: a segment crossing a 32-step checkpoint without `checkHash` is accepted **iff `count === 1`** (the unknown-rule flush cannot hash a state whose rule effect that very flush fetches); multi-act hash-less crossings stay 400 | RunRepo, DayRepo (shared reads for compose), CorpseRepo (yield + `claimRecovery`), UserRepo (integrity on desync), MetricsRepo |
| `/api/run/descend` | POST | `zDescendReq` | `zDescendRes` | `toFloor <= row.floor` → re-return that floor's payload (recompose, ts-pinned ⇒ byte-identical); advance only when replayed `status === DESCENDING` && `toFloor === floor + 1`, stamping `floorEnteredTs[toFloor] = now` | RunRepo, DayRepo, CorpseRepo, EchoRepo, UserRepo (chalk) |
| `/api/run/bank` | POST | `zBankReq` | `zBankRes` | claims deduped by ruleKey; confirm zAdd is `(uid, day)`-idempotent; keys already in `row.bankedKeys` are skipped and re-returned; claims ⊄ `row.learned` → 400 `BAD_INPUT` ("claims cannot be invented", 02 §7) | RunRepo, CodexRepo, MetricsRepo(`claims`) |
| `/api/run/end` | POST | `zEndReq` | `zEndRes` | `phase === "done"` → re-return stored `row.epitaph`; else finalize once inside phase transition. Replayed `status` must be DEAD/EXITED/VICTORY else 409 `RUN_ALIVE`. Death: corpse `put` (id `${d}-${uid}` — naturally idempotent), echo `put`, `UserRepo.onDeath`, `DayRepo.bumpFallen`. Chalk persisted here (and only here / bank) — §1.7 | RunRepo, CorpseRepo, EchoRepo, UserRepo, DayRepo, MetricsRepo(`deaths:{cause}`) |
| `/api/codex` | GET | `zCodexReq` (query) | `zCodexRes` | natural; response cached in `uv:codexcache:{page}` string, 60 s TTL (02 §4) | CodexRepo |
| `/internal/menu/mint-day` | POST | Devvit UiRequest | Devvit UiResponse (toast) | `mintDay` hSetNX one-winner | DayRepo (+ reddit submit) |
| `/internal/jobs/reshuffle` | POST | Devvit scheduler body | 200 | same `mintDay` path | DayRepo (+ reddit submit) |
| `/internal/triggers/on-app-install` | POST | Devvit trigger body | 200 | `mintDay` (first day) | DayRepo |

**Shared flow rules (binding):**

- **Rate limit:** `/api/run/act` enforces `now - row.lastActTs >= ACT_MIN_SPACING_MS` → else
  429 `RATE` (except pure idempotent re-replays, which are read-only and exempt). Signs 2/run
  and salt/etc. are sim-enforced (`signsLeft`); claims ≤ 3/bank by schema + `BANK_MAX`.
- **Expiry:** any run endpoint hitting `phase === "active"` with
  `now - row.startTs > RUN_EXPIRY_MS` lazily finalizes (auto-epitaph "the dark took them while
  they lingered", cause `TAKEN_BY_THE_DARK`, corpse at last replayed pos) and answers 409
  `RUN_EXPIRED`. No cron needed at M2.
- **Unknown-interaction resolver (02 §4 / D19):** server-side there are no unknowns —
  `ruleTableFor(omenId)` always answers, `tick()` never returns `RuleRequest` on the server.
  The client learns via `ActRes.rules` = every key in `replay.consulted` for the segment
  (superset of new keys; client dedups into `SessionRules`). Each secret costs ≤1 round-trip
  per run; the `fx` stream never touches any of this.
- **Corpse yield (D51):** when segment events contain `CORPSE_RECOVERED`, server maps
  `entityId → corpseIds[entity.data]`, calls `claimRecovery` (one winner); on success appends
  the corpse's `unbanked` to `row.learned` and returns `zCorpseYieldWire`. Gift is
  display/economy metadata — it never mutates `SimState` (would desync replay).
- **Sign placement:** flows through the action log (`Action.SIGN`, template·noun in ARG_BITS)
  — on replayed `SIGN_PLACED` events the server writes `DayRepo.addSign` keyed by the sign's
  tile (first-writer-wins). No separate `/api/sign` endpoint at M2 (that route is the M3
  Guildhall/vigil surface per 02 §4). Same pattern for `BRAZIER_LIT` → `addShared(kind 1)` and
  glowmoss planting (`ITEM_USED` with `a === Item.GLOWVIAL`) → `addShared(kind 2)`.
- **DESYNC flow:** void run (`phase: "done"`, epitaph = voided marker), `bumpIntegrity(uid)`,
  422 with in-fiction copy. Tampered log (unparseable frame, opcode > `ACTION_MAX`, step-count
  breach, hash mismatch, prefix mismatch) all land here or in `BAD_INPUT` — this is the M2
  exit test "tampered log rejected".

**Payload ceilings check:** worst response = `zFloorWire` ≈ 60×60 tiles (3.6 KB → b64 4.8 KB)
+ entities + overlays ≈ 8–12 KB raw, ≈ 8 KB gzipped — platform limits (4 MB/10 MB/30 s) never
approached (invariant 8).

---

## 3. Redis key map

All keys carry the `uv:` prefix. Laws (invariant 5 / 02 §5): **no key scans, no Lua, no plain
Sets** — every collection maintains its own zset/hash index; atomicity via single-command ops
(`hIncrBy`, `zIncrBy`, `zAdd`, `hSetNX`) or `watch/multi/exec` for one-winner races; TTLs via
`expire()` immediately after first write.

| Key pattern | Type | Contents | Index / atomicity | TTL | Owner repo |
|---|---|---|---|---|---|
| `uv:day:current` | string | current day number | set by `mintDay` after meta hSetNX wins | — | DayRepo |
| `uv:day:{d}:meta` | hash | `seedHi`, `seedLo`, `omenSeed` (**server-only — never serialized to any wire type**), `postId`, `createdTs`, `fallen`, `ruleTotal` | `hSetNX` on `seedHi` = mint one-winner; `hIncrBy fallen` | 48 h | DayRepo |
| `uv:day:{d}:shared:{floor}` | hash | field `tileIndex` → `kind,uid,ts` packed csv | `hSetNX` per tile (first writer wins — deterministic under ts-pinning) | 48 h | DayRepo |
| `uv:day:{d}:signs:{floor}` | hash | field `tileIndex` → `template,noun,uid,ts,votes` | `hSetNX` per tile; votes via `hIncrBy` (M3) | 48 h | DayRepo |
| `uv:run:{uid}:{d}` | hash | RunRow fields (§1.10): `token,phase,startTs,lastActTs,ticks,lastHash,log,floor,floorEnteredTs(json),learned(json),bankedKeys(json),wax,posX,posY,epitaph` | `watch/multi/exec` in `claimStart`; thereafter single `hSet` per batch (one writer: the token holder) | 26 h | RunRepo |
| `uv:corpse:{id}` | hash | CorpseRow fields; id = `{day}-{uid}` | `watch/multi` on `recoveredBy` for recovery | del by GC (score-driven, not EXPIRE — index must outlive lazily) | CorpseRepo |
| `uv:corpses:{floor}` | zset | member=corpseId, score=expiryTs | GC: `zRange by score < now − grace` → `zRem` + `del`; **never key-scan** | — | CorpseRepo |
| `uv:echo:{id}` | string | b64 keyframes (≤64 × [x,y,candle] @2 Hz ≈ 300 B) | plain set | 72 h | EchoRepo |
| `uv:echoes:{d}:{floor}` | zset | member=echoId, score=interest | cap 50 via `zRemRangeByRank(0, -(CAP+1))` after `zAdd` | 48 h | EchoRepo |
| `uv:user:{uid}` | hash | `house,gen,bestDepth,streak,stubs,heirloom,mute` + `chalk:{floor}` b64 fields (≤8 floors, ~200 B ea) | `hSetNX house`; `hIncrBy gen`; chalk evict-lowest at cap | — (prune inactive-90d = M3 job) | UserRepo |
| `uv:integrity:{uid}` | string (counter) | desync count | `incrBy` | — | UserRepo |
| `uv:rule:{hash}:confirms` | zset | member=uid, score=day | `zAdd` idempotent per uid; `zCard` = distinct confirmers | — | CodexRepo |
| `uv:claim:{hash}` | hash | CodexRow: `ruleKey,effect,status,confirms,day,discoverer` | status/confirms via plain `hSet` after zCard read (single writer races acceptable — monotonic) | — | CodexRepo |
| `uv:claims:byRule:{hash}` | string | discoverer uid — first-credit dedupe pointer | `hSetNX`-equivalent: `set` guarded by watch/multi (or `setnx` semantics via txn) | — | CodexRepo |
| `uv:codex:inked` | zset | member=ruleHash, score=inkDay | `zAdd`; paged via `zRange` | — | CodexRepo |
| `uv:codexcache:{page}` | string | JSON `CodexRes` | plain set | 60 s | CodexRepo |
| `uv:lb:depth:{d}` | zset | member=uid, score=depth | `zAdd` (GT semantics emulated: read `zScore`, write if greater) | 48 h | UserRepo |
| `uv:flair:dirty` | zset | member=uid, score=ts | `zAdd`; drained by M3 flair job | — | UserRepo |
| `uv:metrics:{d}` | hash | counters: `runs`, `deaths:{cause}`, `claims`, `inks`, `desyncs` | `hIncrBy` | 48 h | MetricsRepo |

Reserved for M3 (do not repurpose): `uv:gate:{week}`, `uv:chronicle:{d}`, `uv:lb:season`,
`uv:lb:disc`, `uv:lb:truth`.

**Byte math delta vs 02 §5 (C4):** runs 50 k × ≤1.5 KB ≈ 75 MB (26 h TTL) replaces the 15 MB
line; steady state ≈ 225–245 MB of 500 MB — still under the 300 MB byte-report alarm.
Command budget: `/act` ≈ 6–10 cmds (run load/save, shared reads memoized per floor, metrics)
— within the ~10/batch envelope, ≈23 cmd/s average @50 k DAU vs 40 k/s ceiling.

---

## 4. `src/server/data/redis.ts` — the RedisLike abstraction (binding)

Repos depend ONLY on this interface. It is **ours and frozen**; `redis-devvit.ts` adapts
`@devvit/redis` to it (absorbing any platform signature drift — e.g. `hSetNX` return type),
`redis-mock.ts` implements it in-memory for vitest. No repo, route, or core module may import
`@devvit/*` directly except `redis-devvit.ts`, `middleware.ts`, and `internal.ts` (reddit
client for submitPost).

```ts
export interface ZMember { member: string; score: number }
export interface ZRangeOpts {
  by?: "rank" | "score";
  reverse?: boolean;
  limit?: { offset: number; count: number };
}

export interface RedisTxnLike {
  multi(): Promise<void>;
  exec(): Promise<unknown[] | null>;   // null ⇒ watched key changed — caller retries or 409s
  unwatch(): Promise<void>;
  get(key: string): Promise<string | undefined>; // pre-multi reads on the watched connection
  set(key: string, value: string): Promise<void>;
  hSet(key: string, fieldValues: Record<string, string>): Promise<void>;
  hIncrBy(key: string, field: string, value: number): Promise<void>;
  zAdd(key: string, ...members: ZMember[]): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
}

export interface RedisLike {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(...keys: string[]): Promise<void>;
  exists(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  incrBy(key: string, value: number): Promise<number>;
  mGet(keys: string[]): Promise<(string | null)[]>;

  hSet(key: string, fieldValues: Record<string, string>): Promise<number>;
  hSetNX(key: string, field: string, value: string): Promise<boolean>;
  hGet(key: string, field: string): Promise<string | undefined>;
  hMGet(key: string, fields: string[]): Promise<(string | null)[]>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hDel(key: string, fields: string[]): Promise<number>;
  hIncrBy(key: string, field: string, value: number): Promise<number>;

  zAdd(key: string, ...members: ZMember[]): Promise<number>;
  zRange(key: string, start: number, stop: number, opts?: ZRangeOpts): Promise<ZMember[]>;
  zRem(key: string, members: string[]): Promise<number>;
  zScore(key: string, member: string): Promise<number | undefined>;
  zCard(key: string): Promise<number>;
  zIncrBy(key: string, member: string, value: number): Promise<number>;
  zRemRangeByRank(key: string, start: number, stop: number): Promise<number>;
  zRemRangeByScore(key: string, min: number, max: number): Promise<number>;

  watch(...keys: string[]): Promise<RedisTxnLike>;
}

// redis-devvit.ts
export function bindDevvitRedis(): RedisLike;   // wraps `redis` from "@devvit/web/server"
// redis-mock.ts (test-only; lives in src/server/data/ so vitest `run src` picks its tests up)
export function createMockRedis(): RedisLike & { dump(): Map<string, unknown> };
// mock semantics MUST match Devvit: hGetAll of missing key → {}, zRange by score inclusive,
// exec() → null when a watched key was written between watch() and exec().
```

Mock + repos give the W2 exit-adjacent unit tests: run state machine transitions, idempotent
retries, one-winner start, bank first-credit, corpse recovery race — all against
`createMockRedis()`; the playtest sub covers real-Redis E2E.

---

## 5. Dependencies (exact)

Add to `package.json` — nothing else; zero packages that phone home (invariant 4):

```json
"dependencies": {
  "@devvit/web": "0.13.7",
  "@hono/node-server": "2.0.8",
  "hono": "4.12.28",
  "phaser": "^4",
  "zod": "^3.25.76"
},
"devDependencies": {
  "@devvit/start": "0.13.7",
  "devvit": "0.13.7"
}
```

Devvit packages pinned in 0.13.7 lockstep (platform requirement). `zod` stays on the v3 line
(v4 migration is a separate decision — do not mix). `engines.node` `>=22` already satisfies
Devvit's `>=22.2.0`. Existing devDeps unchanged. `phaser: "^4"` unchanged (client-only; must
never appear in the server bundle or splash chunk).

---

## 6. `tsconfig.server.json` + npm scripts

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023"],
    "types": ["node"]
  },
  "include": ["src/shared/**/*.ts", "src/server/**/*.ts"],
  "exclude": ["src/shared/**/*.test.ts"]
}
```

Purpose: proves the server tree compiles with **no DOM lib** and node types only (the mirror
of `tsconfig.shared.json`'s purity check). `tsconfig.node.json` keeps its current include list
(tools/tests need `src/server/rules/` types) — double coverage is intentional and harmless.
`tsconfig.client.json` untouched: `src/client/net/api.ts`, `splash.ts`, `boot/` fall under its
existing `src/client/**/*.ts` include; `src/shared/protocol.ts` under `src/shared/**/*.ts` in
all three.

`package.json` script changes (EXT):

```json
"typecheck": "tsc -p tsconfig.shared.json --noEmit && tsc -p tsconfig.server.json --noEmit && tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.client.json --noEmit",
"build:devvit": "vite build -c vite.devvit.config.ts",
"dev:devvit": "devvit playtest"
```

`dev`, `build` (dev-harness), `test:unit` (`vitest run src` — picks up new
`src/server/**/*.test.ts` automatically), `test:replay`, `guard:secrets`, `report:bytes`,
`check` keep their current definitions. Server tests import `createMockRedis` — never
`@devvit/web` (which requires platform runtime).

---

## 7. Async-ports boundary plan (M2b — DESIGN ONLY, no code this milestone)

`GamePorts` (`src/client/net/ports.ts`) is fully synchronous; the network is not. The M2
server shapes above were chosen so M2b needs **zero server changes**:

- **`resolveRule(key)` (the only mid-tick sync dependency)** — already solved by the engine:
  `tick()` returns `RuleRequest` when the table misses, and `tickResolving` is only a dev-slice
  convenience. M2b's driver catches `RuleRequest`, **pauses the tick loop** (async gap lives in
  the driver, never the sim — D19 purity), plays the 250–400 ms anticipation beat, flushes the
  batch via `apiRunAct`, feeds `ActRes.rules` into the session `MutableRuleTable`
  (`SessionRules`), and re-runs the same `tick()`. Server returning *all consulted* rules per
  segment (not just the missing one) makes this race-free.
- **`getFloor(floor)`** — becomes a prefetch: `apiRunDescend(token, floor)` fires when the sim
  emits `STAIRS_TOUCHED`/enters `DESCENDING`; `descend` idempotency (`toFloor <= row.floor`
  re-returns byte-identical payloads) makes speculative prefetch safe. `floorFromWire` yields
  `FloorPayloadLike` directly.
- **`bankClaims` / `reportDeath` / `reportExit`** — Waystone and Epitaph are DOM overlay
  sheets (hybrid rendering decision): the overlay awaits `apiRunBank`/`apiRunEnd` behind a
  spinner state per 04; sync port façade returns after the overlay resolves.
- **Write-behind ports** (`brazierLit`, `glowmossPlanted`, `signPlaced`, `chalkChanged`,
  `confirmObservations`) — no-ops over the wire: shared writes derive server-side from the
  replayed action log (§2); `confirms` ride `zBankReq.confirms`; chalk persists at end/bank.
  The port methods stay sync and only update local session state.
- **Read-model ports** (`getGuildhall`, `getCodex`, `getSigns`, `getHouse`, `heirloomDue`) —
  hydrated once per surface entry (`apiDay`, `apiCodex`, floor payload `signContents`) into a
  local `SessionModel`; ports read that snapshot synchronously.

**Client files that change at M2b (and only then):** NEW `src/client/net/batcher.ts` (12
acts / 5 s / on-unknown flush, ≥1 s spacing, retry-with-idempotency), NEW
`src/client/net/remote-ports.ts` (`createRemotePorts(): Promise<GamePorts>` over `api.ts` +
`SessionModel`), NEW `src/client/main.ts` (game.html bootstrap replacing `wire-probe.ts`,
calling `createUndervaultGame(parent, ports)` exactly as `dev/main.ts` does today), EDIT
`src/client/splash.ts` (wire real Guildhall DOM overlay per 05), DELETE `dev/**` (C6),
EDIT `src/client/net/ports.ts` **only if** a method must grow a Promise — current design
needs none. `GamePorts` consumers (`Descent.ts`, menus) are untouched by design.

---

## 8. DO-NOT-TOUCH (absolute for every M2 implementer)

- `src/client/ui/menu/**` — owned by another workstream right now.
- `src/client/scenes/Descent.ts` — owned by another workstream right now.
- `src/shared/sim/**` — frozen deterministic core (tick order, STATE_V/LOG_V, pack framing,
  golden corpus). If a server need seems to require a sim change, STOP and escalate.
- `src/shared/gen/**` — frozen (D32 handled in `server/rules/seed.ts`, not here — C5).
- `dev/**` — legacy dev adapter stays working untouched (C6); reference its logic by reading,
  never by importing.
- Root `vite.config.ts` — dev harness config; production builds use `vite.devvit.config.ts`.
- `src/server/rules/rules.json`, `omens.json`, `resolve.ts` — content/API stable for M2
  ("secret rules table v1" = what exists).
- **Do not commit** — the orchestrator commits. Leave `npm run check` green
  (`test:replay` golden-identical) at hand-off.

---

## 9. Invariant compliance audit (CLAUDE.md 1–10)

1. **Determinism** — sim untouched; server replays via the same `tick()`; `Date.now()` used
   only outside ticks (Redis metadata, ts-pinning); `fx` stream already hash-excluded and
   never read by any server path; seed *minting* uses `node:crypto` (not sim logic). ✔
2. **Secrets** — rules/omens/seeds only in `src/server/rules/` + `uv:day:{d}:meta`; no wire
   type carries `seedHi/seedLo/omenSeed/omenId`; guard extended (§1.13); unknown interactions
   resolve via synchronous `/api/run/act` flush. ✔
3. **Redis-only persistence** — no client storage anywhere in §1.11/§1.12; mute/chalk in
   `uv:user:{uid}`. ✔
4. **No external network** — client fetches same-origin `/api/*` only; `permissions.http`
   absent; all deps are Devvit/hono/zod (no phone-home). ✔
5. **No key scans / Lua / plain Sets** — §3 uses only hashes + zsets with explicit indexes;
   atomics = single-command or watch/multi/exec; `RedisLike` doesn't even expose scan/Lua. ✔
6. **Audio gesture** — no audio in M2 surfaces; the `requestExpandedMode` gesture is reserved
   as the M3 unlock point (§1.11). ✔
7. **Asymmetric entrypoints** — splash.html no-Phaser + ≤300 KB enforced by byte-report;
   paints from postData; game.html carries the engine (from M2b). ✔
8. **Stateless endpoints, limits** — full-replay design removes server session state; worst
   payload ≈ 8 KB gzipped; no streaming/websockets/long-polls. ✔
9. **zod everywhere + versioned logs** — every §2 body parsed via §1.3; `logV: z.literal(2)`
   matches shipped `LOG_V = 2` (bump already happened at D50 — C1). ✔
10. **One candle per day, idempotent mutations** — `uv:run:{uid}:{d}` watch/multi state
    machine (`active → banked → done`), 26 h TTL, 45 min expiry; per-endpoint idempotency
    keys in §2. ✔
