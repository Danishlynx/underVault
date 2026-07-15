// src/server/http/run.ts — POST /api/run/{start,act,descend,bank,end} (08 §1.6, §2).
//
// The one-candle state machine (invariant 10): uv:run:{uid}:{d} claims via
// watch/multi in RunRepo.claimStart; every mutating endpoint is idempotent —
// /act re-replays retried segments read-only, /descend re-serves ts-pinned
// (byte-identical) floors, /bank confirms are (uid, day)-idempotent, /end
// re-returns the stored epitaph.
//
// The act-batch flush IS the unknown-interaction resolver (02 §4 / D19):
// server-side the rule table always answers, tick() never yields RuleRequest,
// and ActRes.rules returns every consulted key — the client's cache fill.
// Endpoints stay stateless (invariant 8): each act batch replays the FULL
// packed log from tick 0 (pure integer sim, ≤4096 steps).

import { randomBytes } from "node:crypto";
import { Hono, type Context } from "hono";
import {
  ErrCode,
  floorToWire,
  zActReq,
  zBankReq,
  zDescendReq,
  zEndReq,
  zEndRes,
  zStartReq,
  type BankRes,
  type CorpseYieldWire,
  type DescendRes,
  type EchoWire,
  type EndRes,
  type FloorWire,
  type RunSetupWire,
  type StartRes,
} from "../../shared/protocol.js";
import type { InitOptions } from "../../shared/sim/engine.js";
import {
  CHECKPOINT_EVERY,
  fromB64,
  h32Hex,
  packActions,
  toB64,
  unpackActions,
} from "../../shared/sim/pack.js";
import { START_WAX } from "../../shared/sim/constants.js";
import {
  DeathCause,
  Item,
  Status,
  type SimState,
  type Step,
} from "../../shared/sim/types.js";
import {
  ACT_MIN_SPACING_MS,
  CORPSE_TTL_S,
  ECHO_SERVE_MAX,
  MAX_RUN_STEPS,
  MAX_SEGMENT_STEPS,
  RUN_EXPIRY_MS,
} from "../core/constants.js";
import { composeFloor, type ComposeInputs, type ComposedFloor } from "../core/compose.js";
import { replayLog, segmentEvents, type FloorSource, type ReplayOut } from "../core/replay.js";
import { CodexRepo } from "../data/codex.js";
import { CorpseRepo } from "../data/corpses.js";
import { DayRepo, type DayMeta } from "../data/days.js";
import { EchoRepo } from "../data/echoes.js";
import { MetricsRepo } from "../data/metrics.js";
import type { RedisLike } from "../data/redis.js";
import { RunRepo, type RunRow } from "../data/runs.js";
import { UserRepo } from "../data/users.js";
import type { OmenDay } from "../rules/resolve.js";
import { daySeedForFloor } from "../rules/seed.js";
import { omenDayFor, ruleTableFor } from "../rules/table.js";
import { codexEntryToWire } from "./codex.js";
import { requireDayMeta } from "./day.js";
import { fail, type UvEnv } from "./env.js";

const U8_MAX = 255;
const U16_MAX = 65535;
const EVENTS_MAX = 4096; // zActRes.events ceiling
const RULES_MAX = 64; // zActRes.rules ceiling
const YIELDS_MAX = 4; // zActRes.corpses ceiling
const UNBANKED_MAX = 64; // zEndRes.unbanked ceiling
const YIELD_UNBANKED_MAX = 8; // zCorpseYieldWire.unbanked ceiling
const ECHO_FRAME_BYTES = 5; // u16 x LE · u16 y LE · u8 candle

// ── per-request dependency bundle (stateless — invariant 8) ────────────────
interface Deps {
  r: RedisLike;
  uid: string;
  now: number;
  days: DayRepo;
  runs: RunRepo;
  corpses: CorpseRepo;
  echoes: EchoRepo;
  codex: CodexRepo;
  users: UserRepo;
  metrics: MetricsRepo;
}

function deps(c: Context<UvEnv>): Deps {
  const r = c.get("redis");
  const uid = c.get("uid");
  if (uid === null) {
    // requireUser guards /api/run/* upstream; this is defense in depth
    fail(401, ErrCode.UNAUTHENTICATED, "the Guildhall does not know your face");
  }
  return {
    r,
    uid,
    now: c.get("now"),
    days: new DayRepo(r),
    runs: new RunRepo(r),
    corpses: new CorpseRepo(r),
    echoes: new EchoRepo(r),
    codex: new CodexRepo(r),
    users: new UserRepo(r),
    metrics: new MetricsRepo(r),
  };
}

async function dayCtx(d: Deps): Promise<{ meta: DayMeta; omen: OmenDay }> {
  const meta = await requireDayMeta(d.days);
  return { meta, omen: omenDayFor(meta) };
}

async function jsonBody(c: Context<UvEnv>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    fail(400, ErrCode.BAD_INPUT, "the ledger rejects this page");
  }
}

async function setupFor(d: Deps, omen: OmenDay): Promise<InitOptions & RunSetupWire> {
  const user = await d.users.get(d.uid);
  return {
    mods: { ...omen.mods },
    heirloom: Math.min(user.heirloom, U8_MAX),
    noSalt: omen.noSalt,
  };
}

// ── log / frame codecs ─────────────────────────────────────────────────────
function decodeSegment(b64: string): Step[] {
  try {
    return unpackActions(fromB64(b64));
  } catch {
    fail(400, ErrCode.BAD_INPUT, "the ledger cannot read this hand");
  }
}

/** The stored log is server-written and trusted; "" = zero steps. */
function decodeLog(log: string): Step[] {
  return log === "" ? [] : unpackActions(fromB64(log));
}

function framesToB64(frames: readonly (readonly [number, number, number])[]): string {
  const m = Math.min(frames.length, 64);
  const bytes = new Uint8Array(m * ECHO_FRAME_BYTES);
  for (let i = 0; i < m; i++) {
    const [fx, fy, fc] = frames[i]!;
    const x = Math.max(0, Math.min(fx, U16_MAX));
    const y = Math.max(0, Math.min(fy, U16_MAX));
    const cand = Math.max(0, Math.min(fc, 2));
    const o = i * ECHO_FRAME_BYTES;
    bytes[o] = x & 0xff;
    bytes[o + 1] = (x >>> 8) & 0xff;
    bytes[o + 2] = y & 0xff;
    bytes[o + 3] = (y >>> 8) & 0xff;
    bytes[o + 4] = cand;
  }
  return toB64(bytes);
}

function b64ToFrames(s: string): [number, number, number][] {
  try {
    const bytes = fromB64(s);
    const m = Math.min(64, Math.floor(bytes.length / ECHO_FRAME_BYTES));
    const out: [number, number, number][] = [];
    for (let i = 0; i < m; i++) {
      const o = i * ECHO_FRAME_BYTES;
      out.push([
        bytes[o]! | (bytes[o + 1]! << 8),
        bytes[o + 2]! | (bytes[o + 3]! << 8),
        Math.min(bytes[o + 4]!, 2),
      ]);
    }
    return out;
  } catch {
    return []; // a corrupt echo is cosmetic — never fatal
  }
}

// ── composition plumbing (ts-pinned — 08 §1.7) ─────────────────────────────
async function composeInputsFor(
  d: Deps,
  meta: DayMeta,
  omen: OmenDay,
  floor: number,
  enteredTs: number,
): Promise<ComposeInputs> {
  return {
    floor,
    daySeedFloor: daySeedForFloor(meta.seedHi, meta.seedLo, meta.day, floor),
    omen,
    enteredTs,
    shared: await d.days.getShared(meta.day, floor),
    signs: await d.days.getSigns(meta.day, floor),
    corpses: await d.corpses.listForFloor(floor, enteredTs),
    chalk: await d.users.getChalk(d.uid, floor),
  };
}

/** Prefetches every stamped floor's inputs, then serves synchronous composition (memoized). */
async function buildSource(
  d: Deps,
  meta: DayMeta,
  omen: OmenDay,
  row: RunRow,
): Promise<FloorSource> {
  const inputs = new Map<number, ComposeInputs>();
  for (let f = 1; f < row.floorEnteredTs.length; f++) {
    const ts = row.floorEnteredTs[f];
    if (ts === undefined || ts <= 0) continue;
    inputs.set(f, await composeInputsFor(d, meta, omen, f, ts));
  }
  const memo = new Map<number, ComposedFloor>();
  return {
    get(floor: number): ComposedFloor {
      const hit = memo.get(floor);
      if (hit !== undefined) return hit;
      const inp = inputs.get(floor);
      if (inp === undefined) {
        // steps beyond a DESCEND the server never acknowledged (08 §2 gap rule)
        fail(400, ErrCode.BAD_INPUT, "the steps outrun the stairs");
      }
      const composed = composeFloor(inp);
      memo.set(floor, composed);
      return composed;
    },
  };
}

async function floorWireFor(d: Deps, meta: DayMeta, composed: ComposedFloor): Promise<FloorWire> {
  const raw = await d.echoes.topForFloor(meta.day, composed.floorData.floor, ECHO_SERVE_MAX);
  const echoes: EchoWire[] = raw.map((e) => ({
    day: e.day,
    floor: e.floor,
    frames: b64ToFrames(e.framesB64),
  }));
  return floorToWire(composed.floorData, composed.rngInit, {
    signContents: composed.signContents,
    echoes,
    corpseIds: composed.corpseIds,
  });
}

// ── run row plumbing ───────────────────────────────────────────────────────
async function loadRow(d: Deps, meta: DayMeta, token: string): Promise<RunRow> {
  const row = await d.runs.load(d.uid, meta.day);
  if (row === null || row.token !== token) {
    fail(404, ErrCode.NO_RUN, "no candle burns under that name");
  }
  return row;
}

function requireActive(row: RunRow): void {
  if (row.phase !== "active") fail(404, ErrCode.NO_RUN, "that descent has already ended");
}

function mergeLearnedList(row: RunRow, list: readonly { key: string; effect: number }[]): void {
  const known = new Set(row.learned.map((l) => l.key));
  for (const l of list) {
    if (known.has(l.key)) continue;
    known.add(l.key);
    row.learned.push({ key: l.key, effect: l.effect });
  }
}

function mergeConsulted(row: RunRow, consulted: ReadonlyMap<string, number>): void {
  const known = new Set(row.learned.map((l) => l.key));
  for (const [key, effect] of consulted) {
    if (known.has(key)) continue;
    known.add(key);
    row.learned.push({ key, effect });
  }
}

// ── finalization (death / exit / expiry / desync) ──────────────────────────
const EPITAPH_BY_CAUSE: Record<number, string> = {
  [DeathCause.TAKEN_BY_THE_DARK]: "The dark took them.",
  [DeathCause.OWN_FLAME]: "Undone by their own flame.",
  [DeathCause.MELTED_BEFORE_BEAST]: "Melted before the Beast.",
  [DeathCause.DROWNED]: "Drowned among the Stacks.",
};
const EPITAPH_EXPIRED = "the dark took them while they lingered"; // 08 §2 copy
const EPITAPH_EXITED = "Climbed back into the lantern-light.";
const EPITAPH_VICTORY = "They found the Bottom.";
const EPITAPH_VOID = "The Ledger burns this page — the descent is void.";

/** D51: a corpse's gift is granted server-side — first held item with charges. */
function giftFrom(state: SimState): { item: number; charges: number } | null {
  for (let i = 0; i < 6; i++) {
    const item = state.inv[i]!;
    const charges = state.invCharges[i]!;
    if (item !== Item.NONE && charges > 0) return { item, charges: Math.min(charges, U8_MAX) };
  }
  return null;
}

async function finalizeRun(
  d: Deps,
  meta: DayMeta,
  row: RunRow,
  replay: ReplayOut,
  args: { lastWords: string; echoFrames: readonly (readonly [number, number, number])[] },
  expired: boolean,
): Promise<EndRes> {
  const state = replay.state;

  let cause: number;
  let line: string;
  if (state.status === Status.DEAD) {
    cause = state.deathCause;
    line = EPITAPH_BY_CAUSE[cause] ?? "They fell.";
  } else if (state.status === Status.EXITED) {
    cause = DeathCause.NONE;
    line = EPITAPH_EXITED;
  } else if (state.status === Status.VICTORY) {
    cause = DeathCause.NONE;
    line = EPITAPH_VICTORY;
  } else {
    // only reachable via the 45 min expiry (08 §2): finalize at last replayed pos
    cause = DeathCause.TAKEN_BY_THE_DARK;
    line = EPITAPH_EXPIRED;
  }
  const isDeath = state.status === Status.DEAD || (expired && cause === DeathCause.TAKEN_BY_THE_DARK && state.status !== Status.EXITED && state.status !== Status.VICTORY);

  const bankedSet = new Set(row.bankedKeys);
  const unbankedAll = row.learned.filter((l) => !bankedSet.has(l.key));

  let generation: number;
  if (isDeath) {
    const user = await d.users.get(d.uid);
    await d.corpses.put({
      id: `${meta.day}-${d.uid}`, // one death per user per day — naturally idempotent
      uid: d.uid,
      house: user.house,
      gen: user.gen,
      day: meta.day,
      floor: state.floor,
      x: state.px,
      y: state.py,
      words: args.lastWords.slice(0, 80),
      gift: giftFrom(state),
      unbanked: unbankedAll,
      vigils: 0,
      recoveredBy: "",
      createdTs: d.now,
      expiryTs: d.now + CORPSE_TTL_S * 1000,
    });
    if (args.echoFrames.length > 0) {
      await d.echoes.put(
        meta.day,
        state.floor,
        `${meta.day}-${d.uid}`,
        framesToB64(args.echoFrames),
        state.floor * 1000 + args.echoFrames.length, // deeper echoes are more interesting
      );
    }
    generation = (await d.users.onDeath(d.uid, meta.day, state.floor)).gen;
    await d.days.bumpFallen(meta.day);
    await d.metrics.incr(meta.day, `deaths:${cause}`);
  } else {
    generation = (await d.users.get(d.uid)).gen;
  }
  if (state.status === Status.VICTORY) {
    // the Long Rescue (D105): her flame grows by one candle, forever —
    // once-only because finalizeRun only runs inside the phase transition
    await d.days.addGift();
    await d.metrics.incr(meta.day, "victories");
  }

  // chalk persists here and at bank only (08 §1.7 / D17) — final floor's marks
  if (state.chalk.some((v) => v !== 0)) {
    await d.users.setChalk(d.uid, state.floor, state.chalk);
  }

  const endRes: EndRes = {
    day: meta.day,
    floor: state.floor,
    cause,
    generation: Math.min(generation, U16_MAX),
    epitaphLine: line.slice(0, 140),
    unbanked: unbankedAll.slice(0, UNBANKED_MAX),
  };
  row.phase = "done";
  row.epitaph = JSON.stringify(endRes);
  row.floor = state.floor;
  row.wax = state.wax;
  row.posX = state.px;
  row.posY = state.py;
  await d.runs.save(d.uid, meta.day, row);
  return endRes;
}

/** 45 min token expiry (08 §2): lazily finalize, answer 409 RUN_EXPIRED. */
async function guardExpiry(d: Deps, meta: DayMeta, omen: OmenDay, row: RunRow): Promise<void> {
  if (row.phase !== "active") return;
  if (d.now - row.startTs <= RUN_EXPIRY_MS) return;
  const source = await buildSource(d, meta, omen, row);
  const replay = replayLog(source, await setupFor(d, omen), decodeLog(row.log), ruleTableFor(omen.id));
  await finalizeRun(d, meta, row, replay, { lastWords: "", echoFrames: [] }, true);
  fail(409, ErrCode.RUN_EXPIRED, EPITAPH_EXPIRED);
}

/** DESYNC flow (08 §2): void the run, bump integrity, 422 with in-fiction copy. */
async function voidRun(d: Deps, meta: DayMeta, row: RunRow): Promise<never> {
  const user = await d.users.get(d.uid);
  const endRes: EndRes = {
    day: meta.day,
    floor: row.floor,
    cause: DeathCause.NONE,
    generation: Math.min(user.gen, U16_MAX),
    epitaphLine: EPITAPH_VOID,
    unbanked: [],
  };
  row.phase = "done";
  row.epitaph = JSON.stringify(endRes);
  await d.runs.save(d.uid, meta.day, row);
  await d.users.bumpIntegrity(d.uid);
  await d.metrics.incr(meta.day, "desyncs");
  fail(422, ErrCode.DESYNC, "the Ledger disagrees — this descent is void");
}

// ── act helpers ────────────────────────────────────────────────────────────
async function corpseYields(
  d: Deps,
  source: FloorSource,
  replay: ReplayOut,
  fromTick: number,
  row: RunRow,
): Promise<CorpseYieldWire[]> {
  const out: CorpseYieldWire[] = [];
  for (const rec of replay.recoveries) {
    if (rec.step < fromTick) continue;
    const corpseId = source.get(rec.floor).corpseIds[rec.corpseRef];
    if (corpseId === undefined) continue;
    const won = await d.corpses.claimRecovery(corpseId, d.uid); // one winner; same-uid retry stays true
    if (!won) {
      out.push({ entityId: rec.entityId, corpseId, gift: null, unbanked: [] });
      continue;
    }
    const corpse = await d.corpses.get(corpseId);
    if (corpse === null) {
      out.push({ entityId: rec.entityId, corpseId, gift: null, unbanked: [] });
      continue;
    }
    mergeLearnedList(row, corpse.unbanked); // joins run.learned server-side (D51)
    out.push({
      entityId: rec.entityId,
      corpseId,
      gift: corpse.gift,
      unbanked: corpse.unbanked.slice(0, YIELD_UNBANKED_MAX),
    });
  }
  return out.slice(0, YIELDS_MAX);
}

/** Shared-world writes derived from the replayed log (08 §2 — no /api/sign at M2). */
async function applyWorldWrites(
  d: Deps,
  meta: DayMeta,
  replay: ReplayOut,
  fromTick: number,
): Promise<void> {
  for (const w of replay.writes) {
    if (w.step < fromTick) continue;
    if (w.kind === 3) {
      await d.days.addSign(meta.day, w.floor, {
        signId: `${meta.day}-${w.floor}-${w.tileIndex}`,
        tileIndex: w.tileIndex,
        template: w.template,
        noun: w.noun,
        uid: d.uid,
        ts: d.now,
        votes: 0,
      });
    } else {
      await d.days.addShared(meta.day, w.floor, {
        tileIndex: w.tileIndex,
        kind: w.kind,
        uid: d.uid,
        ts: d.now,
      });
    }
  }
}

function buildActRes(
  replay: ReplayOut,
  fromTick: number,
  serverTick: number,
  corpses: CorpseYieldWire[],
): { serverTick: number; events: { tick: number; type: number; a: number; b: number; c: number }[]; rules: { key: string; effect: number }[]; corpses: CorpseYieldWire[] } {
  const events = segmentEvents(replay, fromTick)
    .slice(0, EVENTS_MAX)
    .map((e) => ({ tick: e.tick >>> 0, type: e.type & 0xff, a: e.a >>> 0, b: e.b >>> 0, c: e.c >>> 0 }));
  const rules = [...replay.consulted.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, RULES_MAX)
    .map(([key, effect]) => ({ key, effect: Math.min(effect, U8_MAX) }));
  return { serverTick, events, rules, corpses };
}

// ── routes ─────────────────────────────────────────────────────────────────
export const runRoutes = new Hono<UvEnv>();

// ⚠ DEV-ONLY (D122) — REMOVE BEFORE PUBLIC LAUNCH. Wipes the caller's own run
// for the current day so they can replay in-webview (the in-game "Play again
// (dev)" button). This deliberately defeats the one-candle-a-day law and is
// only tolerable on the private playtest sub. Tracked in docs/09 handoff.
runRoutes.post("/reset-dev", async (c) => {
  const uid = c.get("uid");
  if (uid === null) fail(401, ErrCode.UNAUTHENTICATED, "the Guildhall does not know your face");
  const r = c.get("redis");
  const day = await new DayRepo(r).currentDay();
  if (day !== null) await new RunRepo(r).clearRun(uid, day);
  return c.json({ ok: true, day: day ?? 0 });
});

runRoutes.post("/start", async (c) => {
  const d = deps(c);
  zStartReq.parse(await c.req.json().catch(() => ({}))); // empty body tolerated, extra keys rejected
  const { meta, omen } = await dayCtx(d);
  const setup = await setupFor(d, omen);

  const row: RunRow = {
    token: randomBytes(16).toString("hex"),
    phase: "active",
    day: meta.day,
    startTs: d.now,
    lastActTs: 0,
    ticks: 0,
    lastHash: "",
    log: "",
    floor: 1,
    floorEnteredTs: [0, d.now],
    learned: [],
    bankedKeys: [],
    wax: START_WAX,
    posX: 0,
    posY: 0,
    epitaph: "",
  };
  const verdict = await d.runs.claimStart(d.uid, meta.day, row);

  if (verdict === "spent") {
    const stored = await d.runs.load(d.uid, meta.day);
    if (stored !== null && stored.phase === "active") {
      await guardExpiry(d, meta, omen, stored); // active+expired → finalize → 409 RUN_EXPIRED
    }
    fail(409, ErrCode.CANDLE_SPENT, "the candle is spent — return with tomorrow's flame");
  }

  if (verdict === "resume") {
    const stored = await d.runs.load(d.uid, meta.day);
    if (stored === null) fail(404, ErrCode.NO_RUN, "no candle burns under that name");
    const enteredTs = stored.floorEnteredTs[stored.floor] ?? stored.startTs;
    const composed = composeFloor(await composeInputsFor(d, meta, omen, stored.floor, enteredTs));
    const res: StartRes = {
      token: stored.token,
      day: meta.day,
      resumed: true,
      setup: { mods: setup.mods, heirloom: setup.heirloom, noSalt: setup.noSalt },
      floor: await floorWireFor(d, meta, composed),
      // Mid-run resume (M2b): the full packed log + current floor + every
      // rule this run already consulted (run.learned). The client replays the
      // log over the descend-re-served floors (ts-pinned ⇒ byte-identical)
      // instead of voiding the candle on an innocent reload. Leak-safe: each
      // learned rule already reached this player via earlier ActRes.rules.
      resume: {
        log: stored.log,
        floor: Math.min(stored.floor, U8_MAX),
        learned: stored.learned
          .slice(0, 1024)
          .map((l) => ({ key: l.key, effect: Math.min(l.effect, U8_MAX) })),
        banked: stored.bankedKeys.slice(0, 256),
      },
    };
    return c.json(res);
  }

  await d.metrics.incr(meta.day, "runs");
  const composed = composeFloor(await composeInputsFor(d, meta, omen, 1, d.now));
  row.posX = composed.floorData.px;
  row.posY = composed.floorData.py;
  await d.runs.save(d.uid, meta.day, row); // observability mirror; single writer (the token holder)
  const res: StartRes = {
    token: row.token,
    day: meta.day,
    resumed: false,
    setup: { mods: setup.mods, heirloom: setup.heirloom, noSalt: setup.noSalt },
    floor: await floorWireFor(d, meta, composed),
  };
  return c.json(res);
});

runRoutes.post("/act", async (c) => {
  const d = deps(c);
  const req = zActReq.parse(await jsonBody(c));
  const { meta, omen } = await dayCtx(d);
  const row = await loadRow(d, meta, req.token);
  requireActive(row);
  await guardExpiry(d, meta, omen, row);

  const incoming = decodeSegment(req.actions);
  const count = incoming.length;
  if (count === 0) fail(400, ErrCode.BAD_INPUT, "an empty page earns no ink");
  if (count > MAX_SEGMENT_STEPS) fail(400, ErrCode.BAD_INPUT, "too many steps in one breath");
  if (req.fromTick > row.ticks) fail(400, ErrCode.BAD_INPUT, "the ledger has a gap");

  const stored = decodeLog(row.log);

  if (req.fromTick < row.ticks) {
    // idempotency: exact re-send of an acked slice → pure re-replay, no writes
    if (req.fromTick + count > row.ticks) await voidRun(d, meta, row);
    for (let i = 0; i < count; i++) {
      const a = stored[req.fromTick + i]!;
      const b = incoming[i]!;
      if (a.op !== b.op || a.arg !== b.arg) await voidRun(d, meta, row);
    }
    const source = await buildSource(d, meta, omen, row);
    const replay = replayLog(source, await setupFor(d, omen), stored, ruleTableFor(omen.id));
    if (
      req.checkHash !== undefined &&
      req.fromTick + count === row.ticks &&
      req.checkHash !== h32Hex(replay.state)
    ) {
      await voidRun(d, meta, row);
    }
    const yields = await corpseYields(d, source, replay, req.fromTick, row);
    return c.json(buildActRes(replay, req.fromTick, row.ticks, yields));
  }

  // append path (fromTick === row.ticks)
  if (d.now - row.lastActTs < ACT_MIN_SPACING_MS) {
    fail(429, ErrCode.RATE, "the vault ignores a rushed hand");
  }
  const crossing =
    Math.floor((req.fromTick + count) / CHECKPOINT_EVERY) >
    Math.floor(req.fromTick / CHECKPOINT_EVERY);
  // Valve (M2b): a SINGLE-act crossing may go hash-less. This is exactly the
  // unknown-rule deadlock: when the act that consults an unlearned rule
  // itself completes a 32-step block, the client cannot hash a state whose
  // rule effect it has not learned — and this very flush is how it learns it
  // (ActRes.rules). Multi-act crossings still require the seal; the honest
  // client hashes again at the next boundary, so coverage resumes there.
  if (crossing && req.checkHash === undefined && count !== 1) {
    fail(400, ErrCode.BAD_INPUT, "a checkpoint seal is required past the 32nd step");
  }
  const all = stored.concat(incoming);
  if (all.length > MAX_RUN_STEPS) fail(400, ErrCode.BAD_INPUT, "the ledger holds no more pages");

  const source = await buildSource(d, meta, omen, row);
  const replay = replayLog(source, await setupFor(d, omen), all, ruleTableFor(omen.id));
  if (req.checkHash !== undefined && req.checkHash !== h32Hex(replay.state)) {
    await voidRun(d, meta, row); // 422 DESYNC — the M2 "tampered log rejected" exit test
  }

  const yields = await corpseYields(d, source, replay, req.fromTick, row);
  mergeConsulted(row, replay.consulted);

  row.log = toB64(packActions(all)); // canonical single frame — never byte-spliced (§1.10 note)
  row.lastActTs = d.now;
  if (req.checkHash !== undefined) row.lastHash = req.checkHash;
  row.floor = replay.state.floor;
  row.wax = replay.state.wax;
  row.posX = replay.state.px;
  row.posY = replay.state.py;
  await d.runs.appendLogAndSave(d.uid, meta.day, row, count);

  await applyWorldWrites(d, meta, replay, req.fromTick);
  return c.json(buildActRes(replay, req.fromTick, row.ticks, yields));
});

runRoutes.post("/descend", async (c) => {
  const d = deps(c);
  const req = zDescendReq.parse(await jsonBody(c));
  const { meta, omen } = await dayCtx(d);
  const row = await loadRow(d, meta, req.token);
  requireActive(row);
  await guardExpiry(d, meta, omen, row);

  if (req.toFloor < 1) fail(400, ErrCode.BAD_INPUT, "there is no floor above the first");

  if (req.toFloor <= row.floor) {
    // idempotent re-serve: ts-pinned recomposition is byte-identical (08 §2)
    const ts = row.floorEnteredTs[req.toFloor];
    if (ts === undefined || ts <= 0) fail(400, ErrCode.BAD_INPUT, "that floor was never entered");
    const composed = composeFloor(await composeInputsFor(d, meta, omen, req.toFloor, ts));
    const res: DescendRes = { floor: await floorWireFor(d, meta, composed), serverTick: row.ticks };
    return c.json(res);
  }
  if (req.toFloor !== row.floor + 1) {
    fail(400, ErrCode.BAD_INPUT, "the stairs go one floor at a time");
  }

  const source = await buildSource(d, meta, omen, row);
  const replay = replayLog(source, await setupFor(d, omen), decodeLog(row.log), ruleTableFor(omen.id));
  if (replay.state.status !== Status.DESCENDING || replay.state.floor !== row.floor) {
    fail(400, ErrCode.BAD_INPUT, "the delver is not upon the stairs");
  }

  while (row.floorEnteredTs.length <= req.toFloor) row.floorEnteredTs.push(0);
  row.floorEnteredTs[req.toFloor] = d.now; // the pin every later replay composes against
  row.floor = req.toFloor;
  await d.runs.save(d.uid, meta.day, row);

  const composed = composeFloor(await composeInputsFor(d, meta, omen, req.toFloor, d.now));
  const res: DescendRes = { floor: await floorWireFor(d, meta, composed), serverTick: row.ticks };
  return c.json(res);
});

runRoutes.post("/bank", async (c) => {
  const d = deps(c);
  const req = zBankReq.parse(await jsonBody(c));
  const { meta, omen } = await dayCtx(d);
  const row = await loadRow(d, meta, req.token);
  requireActive(row);
  await guardExpiry(d, meta, omen, row);

  // claims ⊆ row.learned — "claims cannot be invented" (02 §7); effects come
  // from the server's own learned record, never from the client
  const known = new Map(row.learned.map((l) => [l.key, l.effect]));
  const seen = new Set<string>();
  const verified: { key: string; effect: number }[] = [];
  for (const claim of req.claims) {
    if (seen.has(claim.key)) continue; // deduped by ruleKey (08 §2)
    seen.add(claim.key);
    const effect = known.get(claim.key);
    if (effect === undefined) fail(400, ErrCode.BAD_INPUT, "claims cannot be invented");
    verified.push({ key: claim.key, effect });
  }

  const entries = await d.codex.bank(d.uid, meta.day, verified, omen.conditionalSubjects);

  // drive-by confirms: only keys this run actually consulted may confirm
  const confirmable = req.confirms.filter((k) => known.has(k));
  if (confirmable.length > 0) await d.codex.confirmObserved(d.uid, meta.day, confirmable);

  const bankedSet = new Set(row.bankedKeys);
  for (const v of verified) {
    if (!bankedSet.has(v.key)) row.bankedKeys.push(v.key);
  }
  await d.runs.save(d.uid, meta.day, row);
  if (verified.length > 0) await d.metrics.incr(meta.day, "claims", verified.length);

  const res: BankRes = { entries: entries.slice(0, 3).map(codexEntryToWire) };
  return c.json(res);
});

runRoutes.post("/end", async (c) => {
  const d = deps(c);
  const req = zEndReq.parse(await jsonBody(c));
  const { meta, omen } = await dayCtx(d);
  const row = await loadRow(d, meta, req.token);

  if (row.phase === "done" && row.epitaph !== "") {
    return c.json(zEndRes.parse(JSON.parse(row.epitaph))); // idempotent re-return (08 §2)
  }
  requireActive(row);
  await guardExpiry(d, meta, omen, row);

  const source = await buildSource(d, meta, omen, row);
  const replay = replayLog(source, await setupFor(d, omen), decodeLog(row.log), ruleTableFor(omen.id));
  const status = replay.state.status;
  if (status !== Status.DEAD && status !== Status.EXITED && status !== Status.VICTORY) {
    fail(409, ErrCode.RUN_ALIVE, "the candle still burns — there is nothing to mourn");
  }

  const endRes = await finalizeRun(
    d,
    meta,
    row,
    replay,
    { lastWords: req.lastWords, echoFrames: req.echoFrames },
    false,
  );
  return c.json(endRes);
});
