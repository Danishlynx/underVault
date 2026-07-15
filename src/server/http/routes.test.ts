// Route tests (08 §2) — in-memory RedisLike mock + hono test client.
//
// Coverage per the M2 brief: happy path per endpoint, invalid-payload 400s,
// idempotent replay (act re-send, end re-return, descend re-serve, bank
// re-bank), candle-already-spent rejection, tampered-log DESYNC void, 45 min
// expiry, rate limiting, checkpoint-hash enforcement, corpse recovery yield.
//
// The "client" here is the real sim driven locally (initState/tick over the
// wire floor payload) — exactly what the server replays, so hashes must agree.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  floorFromWire,
  zActRes,
  zBankRes,
  zCodexRes,
  zDayRes,
  zEndRes,
  zErrRes,
  zStartRes,
  type StartRes,
} from "../../shared/protocol.js";
import { initState, tick } from "../../shared/sim/engine.js";
import { fromB64, h32Hex, packActions, toB64, unpackActions } from "../../shared/sim/pack.js";
import {
  Action,
  DeathCause,
  EntityKind,
  Ev,
  Item,
  Status,
  isRuleRequest,
  type SimState,
  type Step,
} from "../../shared/sim/types.js";
import { ACT_MIN_SPACING_MS, RUN_EXPIRY_MS } from "../core/constants.js";
import { CodexRepo } from "../data/codex.js";
import { CorpseRepo } from "../data/corpses.js";
import { DayRepo } from "../data/days.js";
import { createMockRedis } from "../data/redis-mock.js";
import type { RedisLike } from "../data/redis.js";
import { omenDayFor, ruleTableFor, RULE_TOTAL } from "../rules/table.js";
import { codexRoutes } from "./codex.js";
import { dayRoutes } from "./day.js";
import type { UvEnv } from "./env.js";
import { internalRoutes } from "./internal.js";
import { errorBoundary, requireUser } from "./middleware.js";
import { runRoutes } from "./run.js";

const DAY = 1;
const SEED_HI = 0x1a2b3c4d;
const SEED_LO = 0x5e6f7081;
const OMEN_SEED = 42; // day 1 is always clearskies regardless (omenForSeed)
const NOW0 = 1_800_000_000_000;

interface Env {
  uid: string | null;
  now: number;
}

/** Mirrors src/server/index.ts wiring, with the test env injected ahead of errorBoundary. */
function makeApp(mock: RedisLike, env: Env): Hono<UvEnv> {
  const app = new Hono<UvEnv>();
  app.use("*", async (c, next) => {
    c.set("redis", mock);
    c.set("uid", env.uid);
    c.set("now", env.now);
    await next();
  });
  app.use("*", errorBoundary);
  app.route("/api/day", dayRoutes);
  app.use("/api/run/*", requireUser);
  app.route("/api/run", runRoutes);
  app.route("/api/codex", codexRoutes);
  app.route("/internal", internalRoutes);
  return app;
}

async function mintTestDay(mock: RedisLike): Promise<void> {
  const days = new DayRepo(mock);
  const ok = await days.putMeta({
    day: DAY,
    seedHi: SEED_HI,
    seedLo: SEED_LO,
    omenSeed: OMEN_SEED,
    postId: "t3_test",
    createdTs: NOW0,
  });
  expect(ok).toBe(true);
  await days.setRuleTotal(DAY, RULE_TOTAL);
}

function fixture(): { mock: RedisLike & { dump(): Map<string, unknown> }; env: Env; app: Hono<UvEnv> } {
  const mock = createMockRedis();
  const env: Env = { uid: "t2_alpha", now: NOW0 };
  return { mock, env, app: makeApp(mock, env) };
}

async function post(app: Hono<UvEnv>, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function startRun(app: Hono<UvEnv>): Promise<StartRes> {
  const res = await post(app, "/api/run/start", {});
  expect(res.status).toBe(200);
  return zStartRes.parse(await res.json());
}

// ── a local "honest client": the real sim over the wire payload ────────────
interface Sim {
  readonly state: SimState;
  readonly steps: Step[];
  apply(op: number, arg?: number): { type: number; a: number; b: number; c: number }[];
}

function clientSim(start: StartRes): Sim {
  const { floorData, rngInit } = floorFromWire(start.floor);
  const omen = omenDayFor({ omenSeed: OMEN_SEED, day: DAY });
  const table = ruleTableFor(omen.id); // server import is legal in server tests
  let state = initState(floorData, rngInit, {
    mods: start.setup.mods,
    heirloom: start.setup.heirloom,
    noSalt: start.setup.noSalt,
  });
  const steps: Step[] = [];
  return {
    get state() {
      return state;
    },
    steps,
    apply(op, arg = 0) {
      const r = tick(state, { op, arg }, table);
      if (isRuleRequest(r)) throw new Error(`unexpected RuleRequest: ${r.needRule}`);
      state = r.state;
      steps.push({ op, arg });
      return r.events;
    },
  };
}

interface Batch {
  fromTick: number;
  steps: Step[];
  hash: string; // h32Hex at the batch boundary — checkpoint seal
}

/**
 * Wait until the candle melts away and the Dark Grace runs out — a
 * map-independent death (grace starts only at wax 0; ~525 WAIT ticks).
 * Steps are chunked into ≤200-step batches with the client hash captured at
 * each boundary, exactly like the M2b batcher will.
 */
function driveToDeath(sim: Sim): Batch[] {
  const batches: Batch[] = [];
  let from = 0;
  let guard = 0;
  while (sim.state.status === Status.ALIVE && guard++ < 8) {
    for (let i = 0; i < 200 && sim.state.status === Status.ALIVE; i++) sim.apply(Action.WAIT);
    batches.push({ fromTick: from, steps: sim.steps.slice(from), hash: h32Hex(sim.state) });
    from = sim.steps.length;
  }
  expect(sim.state.status).toBe(Status.DEAD);
  return batches;
}

/** Push every batch over the wire, advancing the clock past the rate limit. */
async function sendBatches(
  app: Hono<UvEnv>,
  env: Env,
  token: string,
  batches: readonly Batch[],
): Promise<void> {
  for (const b of batches) {
    env.now += ACT_MIN_SPACING_MS;
    const res = await post(app, "/api/run/act", actBody(token, b.fromTick, b.steps, b.hash));
    expect(res.status).toBe(200);
  }
}

function actBody(
  token: string,
  fromTick: number,
  steps: readonly Step[],
  checkHash?: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    token,
    logV: 2,
    fromTick,
    actions: toB64(packActions(steps)),
  };
  if (checkHash !== undefined) body.checkHash = checkHash;
  return body;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/day", () => {
  it("503 NO_DAY before any mint", async () => {
    const { app } = fixture();
    const res = await app.request("/api/day");
    expect(res.status).toBe(503);
    expect(zErrRes.parse(await res.json()).error).toBe("NO_DAY");
  });

  it("serves zDayRes; houseLine only when authenticated", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);

    env.uid = null;
    const anon = zDayRes.parse(await (await app.request("/api/day")).json());
    expect(anon.day).toBe(DAY);
    expect(anon.gatePct).toBe(9); // min(99, day*9) stand-in (C9)
    expect(anon.fallenToday).toBe(0);
    expect(anon.houseLine).toBeUndefined();

    env.uid = "t2_alpha";
    const auth = zDayRes.parse(await (await app.request("/api/day")).json());
    expect(auth.houseLine).toContain("No house sworn yet");
  });
});

describe("POST /api/run/start", () => {
  it("401 UNAUTHENTICATED without a user", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);
    env.uid = null;
    const res = await post(app, "/api/run/start", {});
    expect(res.status).toBe(401);
    expect(zErrRes.parse(await res.json()).error).toBe("UNAUTHENTICATED");
  });

  it("503 NO_DAY before the mint", async () => {
    const { app } = fixture();
    const res = await post(app, "/api/run/start", {});
    expect(res.status).toBe(503);
  });

  it("400 on a non-strict body", async () => {
    const { mock, app } = fixture();
    await mintTestDay(mock);
    const res = await post(app, "/api/run/start", { cheat: true });
    expect(res.status).toBe(400);
    expect(zErrRes.parse(await res.json()).error).toBe("BAD_INPUT");
  });

  it("issues a fresh run; a second start resumes the SAME token", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);
    const first = await startRun(app);
    expect(first.resumed).toBe(false);
    expect(first.day).toBe(DAY);
    expect(first.floor.floor).toBe(1);
    expect(first.floor.entities.length).toBeGreaterThan(0);
    // wire → sim → wire round-trip sanity
    const rt = floorFromWire(first.floor);
    expect(rt.floorData.w * rt.floorData.h).toBe(rt.floorData.tiles.length);

    env.now += 5_000;
    const again = await startRun(app);
    expect(again.resumed).toBe(true);
    expect(again.token).toBe(first.token);
    // ts-pinned recomposition is byte-identical
    expect(again.floor).toEqual(first.floor);
  });
});

describe("full run lifecycle: act → death → end (one candle per day)", () => {
  it("replays batches, records the death, spends the candle", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);
    env.uid = "t2_alpha";

    const start = await startRun(app);
    const sim = clientSim(start);
    const batches = driveToDeath(sim);
    const total = sim.steps.length;
    expect(total).toBeGreaterThan(200); // the candle burns for hundreds of ticks

    // send all but the last batch
    await sendBatches(app, env, start.token, batches.slice(0, -1));

    // final batch — crosses checkpoints ⇒ hash required and verified
    const last = batches[batches.length - 1]!;
    env.now += ACT_MIN_SPACING_MS;
    const r2 = await post(app, "/api/run/act", actBody(start.token, last.fromTick, last.steps, last.hash));
    expect(r2.status).toBe(200);
    const a2 = zActRes.parse(await r2.json());
    expect(a2.serverTick).toBe(total);
    expect(a2.events.some((e) => e.type === Ev.DIED)).toBe(true);

    // idempotent re-send of the final batch — read-only, rate-limit exempt (same clock)
    const r2b = await post(app, "/api/run/act", actBody(start.token, last.fromTick, last.steps, last.hash));
    expect(r2b.status).toBe(200);
    const a2b = zActRes.parse(await r2b.json());
    expect(a2b).toEqual(a2);

    // end — the epitaph
    const e1 = await post(app, "/api/run/end", {
      token: start.token,
      lastWords: "the dark was patient",
      echoFrames: [[sim.state.px, sim.state.py, 2]],
    });
    expect(e1.status).toBe(200);
    const end1 = zEndRes.parse(await e1.json());
    expect(end1.day).toBe(DAY);
    expect(end1.floor).toBe(1);
    expect(end1.cause).toBe(sim.state.deathCause); // client and server agree on the death
    expect(end1.cause).toBeGreaterThan(0);
    expect(end1.generation).toBe(2); // first death founds generation II
    expect(end1.epitaphLine.length).toBeGreaterThan(0);

    // corpse row exists, naturally idempotent id {day}-{uid}
    const corpse = await new CorpseRepo(mock).get(`${DAY}-t2_alpha`);
    expect(corpse).not.toBeNull();
    expect(corpse!.words).toBe("the dark was patient");
    expect(corpse!.floor).toBe(1);

    // idempotent /end re-return
    const e2 = await post(app, "/api/run/end", { token: start.token, lastWords: "x", echoFrames: [] });
    expect(e2.status).toBe(200);
    expect(zEndRes.parse(await e2.json())).toEqual(end1);

    // the run is done — further acts find no active run
    env.now += ACT_MIN_SPACING_MS;
    const r3 = await post(app, "/api/run/act", actBody(start.token, total, [{ op: Action.WAIT, arg: 0 }]));
    expect(r3.status).toBe(404);
    expect(zErrRes.parse(await r3.json()).error).toBe("NO_RUN");

    // candle spent — no second run today (invariant 10)
    const s2 = await post(app, "/api/run/start", {});
    expect(s2.status).toBe(409);
    expect(zErrRes.parse(await s2.json()).error).toBe("CANDLE_SPENT");

    // the toll shows on the Guildhall
    const day = zDayRes.parse(await (await app.request("/api/day")).json());
    expect(day.fallenToday).toBe(1);
  });
});

describe("corpse recovery, sign placement, banking (second delver)", () => {
  it("yields the fallen delver's gift, learns the rule, banks it", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);

    // delver A dies at the spawn
    env.uid = "t2_alpha";
    const sa = await startRun(app);
    const simA = clientSim(sa);
    await sendBatches(app, env, sa.token, driveToDeath(simA));
    let res = await post(app, "/api/run/end", { token: sa.token, lastWords: "beware", echoFrames: [[1, 2, 0]] });
    expect(res.status).toBe(200);

    // delver B enters after the death and finds the corpse composed in
    env.uid = "t2_beta";
    env.now += 60_000;
    const sb = await startRun(app);
    expect(sb.floor.corpseIds).toEqual([`${DAY}-t2_alpha`]);
    expect(sb.floor.echoes.length).toBeGreaterThan(0); // A's echo replays
    const corpseEnt = sb.floor.entities.find((e) => e.kind === EntityKind.CORPSE);
    expect(corpseEnt).toBeDefined();

    // B bumps the corpse (re-seated adjacent to the shared spawn) + signs the tile
    const simB = clientSim(sb);
    const dx = corpseEnt!.x - simB.state.px;
    const dy = corpseEnt!.y - simB.state.py;
    expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
    const move =
      dx === 1 ? Action.MOVE_E : dx === -1 ? Action.MOVE_W : dy === 1 ? Action.MOVE_S : Action.MOVE_N;
    const bumpEvents = simB.apply(move);
    expect(bumpEvents.some((e) => e.type === 52 /* Ev.CORPSE_RECOVERED */)).toBe(true);
    const signArg = (3 << 5) | 7; // template 3 · noun 7
    simB.apply(Action.SIGN, signArg);

    env.now += ACT_MIN_SPACING_MS;
    res = await post(app, "/api/run/act", actBody(sb.token, 0, simB.steps, h32Hex(simB.state)));
    expect(res.status).toBe(200);
    const act = zActRes.parse(await res.json());

    // D51 corpse yield: the gift is A's first held item (starting flint)
    expect(act.corpses).toHaveLength(1);
    expect(act.corpses[0]!.corpseId).toBe(`${DAY}-t2_alpha`);
    expect(act.corpses[0]!.gift).toEqual({ item: Item.FLINT, charges: 1 });
    // the consulted rule reaches the client cache
    const learnedKey = "corpse|bump|self|lit";
    expect(act.rules.some((r) => r.key === learnedKey && r.effect === 9 /* Effect.RECOVER */)).toBe(true);

    // the sign was derived from the replayed log (no /api/sign at M2)
    const signs = await new DayRepo(mock).getSigns(DAY, 1);
    expect(signs).toHaveLength(1);
    expect(signs[0]!.template).toBe(3);
    expect(signs[0]!.noun).toBe(7);
    expect(signs[0]!.uid).toBe("t2_beta");

    // bank the learned rule
    res = await post(app, "/api/run/bank", {
      token: sb.token,
      claims: [{ key: learnedKey, effect: 9 }],
      confirms: [],
    });
    expect(res.status).toBe(200);
    const bank = zBankRes.parse(await res.json());
    expect(bank.entries).toHaveLength(1);
    expect(bank.entries[0]!.ruleKey).toBe(learnedKey);
    expect(bank.entries[0]!.status).toBe("true"); // clearskies has no conditional subjects
    expect(bank.entries[0]!.confirms).toBe(1);

    // idempotent re-bank: same entry, confirms still 1 (zAdd per uid)
    res = await post(app, "/api/run/bank", {
      token: sb.token,
      claims: [{ key: learnedKey, effect: 9 }],
      confirms: [],
    });
    expect(res.status).toBe(200);
    expect(zBankRes.parse(await res.json()).entries[0]!.confirms).toBe(1);

    // claims cannot be invented (02 §7)
    res = await post(app, "/api/run/bank", {
      token: sb.token,
      claims: [{ key: "beast|bump|self|lit", effect: 1 }],
      confirms: [],
    });
    expect(res.status).toBe(400);
    expect(zErrRes.parse(await res.json()).error).toBe("BAD_INPUT");
  });
});

describe("mid-run resume payload (M2b)", () => {
  it("start on a live run returns log + floor + learned + banked; dead runs stay CANDLE_SPENT", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);

    // delver A dies and ends — the spent path must NOT grow a resume payload
    env.uid = "t2_alpha";
    const sa = await startRun(app);
    await sendBatches(app, env, sa.token, driveToDeath(clientSim(sa)));
    let res = await post(app, "/api/run/end", { token: sa.token, lastWords: "gone", echoFrames: [] });
    expect(res.status).toBe(200);
    res = await post(app, "/api/run/start", {});
    expect(res.status).toBe(409);
    expect(zErrRes.parse(await res.json()).error).toBe("CANDLE_SPENT");

    // delver B recovers A's corpse (learns corpse|bump|self|lit) and banks it
    env.uid = "t2_beta";
    env.now += 60_000;
    const sb = await startRun(app);
    expect(sb.resumed).toBe(false);
    expect(sb.resume).toBeUndefined(); // fresh runs carry no resume payload
    const simB = clientSim(sb);
    const corpseEnt = sb.floor.entities.find((e) => e.kind === EntityKind.CORPSE);
    expect(corpseEnt).toBeDefined();
    const dx = corpseEnt!.x - simB.state.px;
    const dy = corpseEnt!.y - simB.state.py;
    const move =
      dx === 1 ? Action.MOVE_E : dx === -1 ? Action.MOVE_W : dy === 1 ? Action.MOVE_S : Action.MOVE_N;
    simB.apply(move);
    env.now += ACT_MIN_SPACING_MS;
    res = await post(app, "/api/run/act", actBody(sb.token, 0, simB.steps, h32Hex(simB.state)));
    expect(res.status).toBe(200);
    const learnedKey = "corpse|bump|self|lit";
    res = await post(app, "/api/run/bank", {
      token: sb.token,
      claims: [{ key: learnedKey, effect: 9 }],
      confirms: [],
    });
    expect(res.status).toBe(200);

    // the reload: same token; resume carries the exact log, floor, learned, banked
    env.now += 5_000;
    const again = await startRun(app);
    expect(again.resumed).toBe(true);
    expect(again.token).toBe(sb.token);
    expect(again.resume).toBeDefined();
    expect(again.resume!.floor).toBe(1);
    expect(unpackActions(fromB64(again.resume!.log))).toEqual(simB.steps);
    expect(
      again.resume!.learned.some((l) => l.key === learnedKey && l.effect === 9 /* Effect.RECOVER */),
    ).toBe(true);
    expect(again.resume!.banked).toEqual([learnedKey]);
  });
});

describe("POST /api/run/descend", () => {
  it("re-serves entered floors byte-identically; rejects gaps and non-stairs advances", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);
    env.uid = "t2_gamma";
    const start = await startRun(app);

    // idempotent re-serve of floor 1 — byte-identical to the start payload
    let res = await post(app, "/api/run/descend", { token: start.token, toFloor: 1 });
    expect(res.status).toBe(200);
    const body = await res.json() as { floor: unknown; serverTick: number };
    expect(body.floor).toEqual(start.floor);
    expect(body.serverTick).toBe(0);

    // not standing on the stairs → no advance
    res = await post(app, "/api/run/descend", { token: start.token, toFloor: 2 });
    expect(res.status).toBe(400);

    // skipping floors is a gap
    res = await post(app, "/api/run/descend", { token: start.token, toFloor: 3 });
    expect(res.status).toBe(400);

    // wrong token finds no run
    res = await post(app, "/api/run/descend", { token: "0123456789abcdef0123456789abcdef", toFloor: 1 });
    expect(res.status).toBe(404);
  });
});

describe("tampering and integrity (the M2 exit test)", () => {
  it("rejects malformed payloads with 400", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);
    env.uid = "t2_delta";
    const start = await startRun(app);
    env.now += ACT_MIN_SPACING_MS;

    // wrong log version (zod literal)
    let res = await post(app, "/api/run/act", { token: start.token, logV: 1, fromTick: 0, actions: "AAAA" });
    expect(res.status).toBe(400);

    // not base64
    res = await post(app, "/api/run/act", { token: start.token, logV: 2, fromTick: 0, actions: "!!!" });
    expect(res.status).toBe(400);

    // valid base64, garbage frame (logV byte 9)
    res = await post(app, "/api/run/act", actBody(start.token, 0, []));
    expect(res.status).toBe(400); // empty batch
    res = await post(app, "/api/run/act", { token: start.token, logV: 2, fromTick: 0, actions: toB64(new Uint8Array([9, 1, 0, 255])) });
    expect(res.status).toBe(400);

    // fromTick beyond the acked log is a gap
    res = await post(app, "/api/run/act", actBody(start.token, 5, [{ op: Action.WAIT, arg: 0 }]));
    expect(res.status).toBe(400);

    // crossing the 32-tick checkpoint without a hash
    const waits: Step[] = Array.from({ length: 33 }, () => ({ op: Action.WAIT, arg: 0 }));
    res = await post(app, "/api/run/act", actBody(start.token, 0, waits));
    expect(res.status).toBe(400);
    expect(zErrRes.parse(await res.json()).error).toBe("BAD_INPUT");
  });

  it("voids the run on a checkpoint-hash mismatch (422 DESYNC, integrity++)", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);
    env.uid = "t2_evil";
    const start = await startRun(app);
    env.now += ACT_MIN_SPACING_MS;

    const res = await post(
      app,
      "/api/run/act",
      actBody(start.token, 0, [{ op: Action.WAIT, arg: 0 }], "00000000"),
    );
    expect(res.status).toBe(422);
    expect(zErrRes.parse(await res.json()).error).toBe("DESYNC");
    expect(await mock.get("uv:integrity:t2_evil")).toBe("1");

    // the run is void — and the candle stays spent
    env.now += ACT_MIN_SPACING_MS;
    const r2 = await post(app, "/api/run/act", actBody(start.token, 0, [{ op: Action.WAIT, arg: 0 }]));
    expect(r2.status).toBe(404);
    const s2 = await post(app, "/api/run/start", {});
    expect(s2.status).toBe(409);
    expect(zErrRes.parse(await s2.json()).error).toBe("CANDLE_SPENT");
  });

  it("voids the run when a retried slice does not match the stored log", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);
    env.uid = "t2_forger";
    const start = await startRun(app);
    env.now += ACT_MIN_SPACING_MS;

    let res = await post(app, "/api/run/act", actBody(start.token, 0, [{ op: Action.WAIT, arg: 0 }, { op: Action.WAIT, arg: 0 }]));
    expect(res.status).toBe(200);

    // "retry" of tick 0..2 with different contents — history rewrite attempt
    res = await post(app, "/api/run/act", actBody(start.token, 0, [{ op: Action.CUP, arg: 0 }, { op: Action.WAIT, arg: 0 }]));
    expect(res.status).toBe(422);
    expect(zErrRes.parse(await res.json()).error).toBe("DESYNC");
  });

  it("enforces the 1 s act spacing (429 RATE)", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);
    env.uid = "t2_hasty";
    const start = await startRun(app);
    env.now += ACT_MIN_SPACING_MS;

    let res = await post(app, "/api/run/act", actBody(start.token, 0, [{ op: Action.WAIT, arg: 0 }]));
    expect(res.status).toBe(200);
    res = await post(app, "/api/run/act", actBody(start.token, 1, [{ op: Action.WAIT, arg: 0 }]));
    expect(res.status).toBe(429);
    expect(zErrRes.parse(await res.json()).error).toBe("RATE");

    env.now += ACT_MIN_SPACING_MS;
    res = await post(app, "/api/run/act", actBody(start.token, 1, [{ op: Action.WAIT, arg: 0 }]));
    expect(res.status).toBe(200);
  });
});

describe("checkpoint valve (single-act hash-less crossing)", () => {
  it("accepts a lone hash-less act across the 32-step boundary; multi-act stays rejected", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);
    env.uid = "t2_valve";
    const start = await startRun(app);
    const sim = clientSim(start);

    // 31 steps: no boundary crossed, no hash needed
    for (let i = 0; i < 31; i++) sim.apply(Action.WAIT);
    env.now += ACT_MIN_SPACING_MS;
    let res = await post(app, "/api/run/act", actBody(start.token, 0, sim.steps.slice(0, 31)));
    expect(res.status).toBe(200);

    // a hash-less MULTI-act crossing is still a tampering reject
    env.now += ACT_MIN_SPACING_MS;
    res = await post(
      app,
      "/api/run/act",
      actBody(start.token, 31, [{ op: Action.WAIT, arg: 0 }, { op: Action.WAIT, arg: 0 }]),
    );
    expect(res.status).toBe(400);
    expect(zErrRes.parse(await res.json()).error).toBe("BAD_INPUT");

    // the valve: exactly one act may cross hash-less — the unknown-rule
    // deadlock case (the client cannot hash a state whose rule effect this
    // very flush is fetching)
    sim.apply(Action.WAIT); // step 32
    env.now += ACT_MIN_SPACING_MS;
    res = await post(app, "/api/run/act", actBody(start.token, 31, sim.steps.slice(31, 32)));
    expect(res.status).toBe(200);
    expect(zActRes.parse(await res.json()).serverTick).toBe(32);

    // integrity coverage resumes: the next hashed crossing is still verified
    for (let i = 0; i < 32; i++) sim.apply(Action.WAIT); // steps 33..64
    env.now += ACT_MIN_SPACING_MS;
    res = await post(
      app,
      "/api/run/act",
      actBody(start.token, 32, sim.steps.slice(32), h32Hex(sim.state)),
    );
    expect(res.status).toBe(200);
    expect(zActRes.parse(await res.json()).serverTick).toBe(64);
  });
});

describe("45 min expiry", () => {
  it("lazily finalizes the run and answers RUN_EXPIRED; the candle is spent", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);
    env.uid = "t2_lingerer";
    const start = await startRun(app);

    env.now += RUN_EXPIRY_MS + 1;
    const res = await post(app, "/api/run/act", actBody(start.token, 0, [{ op: Action.WAIT, arg: 0 }]));
    expect(res.status).toBe(409);
    expect(zErrRes.parse(await res.json()).error).toBe("RUN_EXPIRED");

    // auto-finalized: corpse at the last replayed position, candle spent
    const corpse = await new CorpseRepo(mock).get(`${DAY}-t2_lingerer`);
    expect(corpse).not.toBeNull();
    const s2 = await post(app, "/api/run/start", {});
    expect(s2.status).toBe(409);
    expect(zErrRes.parse(await s2.json()).error).toBe("CANDLE_SPENT");

    // /end after expiry re-returns the auto-epitaph
    const e = await post(app, "/api/run/end", { token: start.token, lastWords: "", echoFrames: [] });
    expect(e.status).toBe(200);
    const end = zEndRes.parse(await e.json());
    expect(end.cause).toBe(DeathCause.TAKEN_BY_THE_DARK);
    expect(end.epitaphLine).toContain("lingered");
  });

  it("RUN_ALIVE guards /end while the replayed delver still stands", async () => {
    const { mock, env, app } = fixture();
    await mintTestDay(mock);
    env.uid = "t2_quitter";
    const start = await startRun(app);
    const res = await post(app, "/api/run/end", { token: start.token, lastWords: "bye", echoFrames: [] });
    expect(res.status).toBe(409);
    expect(zErrRes.parse(await res.json()).error).toBe("RUN_ALIVE");
  });
});

describe("GET /api/codex", () => {
  it("400 on a non-numeric page", async () => {
    const { mock, app } = fixture();
    await mintTestDay(mock);
    const res = await app.request("/api/codex?page=abc");
    expect(res.status).toBe(400);
  });

  it("pages the inked ledger (structured entries only) and caches", async () => {
    const { mock, app } = fixture();
    await mintTestDay(mock);

    // five distinct confirmers ink a rule (INK_AT = 5)
    const codex = new CodexRepo(mock);
    for (let i = 0; i < 5; i++) {
      await codex.bank(`t2_u${i}`, DAY, [{ key: "rat|touch|salt-line|lit", effect: 4 }], []);
    }

    const res = await app.request("/api/codex?page=0");
    expect(res.status).toBe(200);
    const page = zCodexRes.parse(await res.json());
    expect(page.pageCount).toBe(1);
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]!.status).toBe("inked");
    expect(page.entries[0]!.confirms).toBe(5);

    // cached: a sixth confirmer does not change the served page within the TTL
    await codex.bank("t2_u5", DAY, [{ key: "rat|touch|salt-line|lit", effect: 4 }], []);
    const res2 = await app.request("/api/codex?page=0");
    expect(zCodexRes.parse(await res2.json())).toEqual(page);
  });
});

describe("internal endpoints (mint one-winner)", () => {
  it("menu mint creates day 1; reshuffle advances; install trigger respects a standing day", async () => {
    const { mock, app } = fixture();

    let res = await post(app, "/internal/menu/mint-day", {});
    expect(res.status).toBe(200);
    expect(((await res.json()) as { showToast: string }).showToast).toContain("Day 1");
    const days = new DayRepo(mock);
    expect(await days.currentDay()).toBe(1);
    const meta = await days.getMeta(1);
    expect(meta).not.toBeNull();
    expect(meta!.seedHi).not.toBe(0);

    // the Guildhall opens
    const dayRes = await app.request("/api/day");
    expect(dayRes.status).toBe(200);
    expect(zDayRes.parse(await dayRes.json()).day).toBe(1);

    // nightly reshuffle mints the next day
    res = await post(app, "/internal/jobs/reshuffle", {});
    expect(res.status).toBe(200);
    expect(await days.currentDay()).toBe(2);

    // a re-fired install trigger leaves the standing day alone
    res = await post(app, "/internal/triggers/on-app-install", {});
    expect(res.status).toBe(200);
    expect(await days.currentDay()).toBe(2);
  });
});
