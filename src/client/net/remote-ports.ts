/**
 * src/client/net/remote-ports.ts — GamePorts over /api/* (M2b, 08 §7).
 *
 * Hydration: apiDay → apiRunStart → apiCodex. Sync ports answer from the
 * hydrated SessionModel + cached floor payloads; the optional async seams
 * carry every network gap (the sim never sees a Promise — D19 purity).
 *
 * Rule resolution (02 §4 / D19): the driver pushes the act that hit the
 * unknown rule via actApplied, then awaits resolveRuleAsync — the flush
 * carries that act, the server replay consults its always-answering table,
 * and ActRes.rules (every key consulted this run) fills the local cache.
 * Subsequent sync resolveRule(key) calls answer from that cache without a
 * round-trip.
 *
 * The shadow sim: /api/run/act demands `checkHash` (h32Hex of the replayed
 * state) whenever a segment crosses a 32-step checkpoint boundary, but the
 * ports surface never hands us SimState — so this module replays its own
 * shadow copy of the run (same initState/tick/descendState the server replay
 * uses, same wire-decoded floors, same rule effects) purely to mint those
 * hashes. It is derived bookkeeping, not authority: the driver's sim and the
 * server's replay stay the only two states that matter.
 */

import {
  floorFromWire,
  type ActRes,
  type CodexEntryWire,
  type CorpseYieldWire,
  type FloorWire,
} from "../../shared/protocol.js";
import { descendState, initState, tick, type InitOptions } from "../../shared/sim/engine.js";
import { fromB64, h32Hex, unpackActions } from "../../shared/sim/pack.js";
import {
  Status,
  cloneState,
  isRuleRequest,
  type FloorData,
  type RuleTable,
  type SimState,
  type Step,
} from "../../shared/sim/types.js";
import {
  apiCodex,
  apiDay,
  apiRunAct,
  apiRunBank,
  apiRunDescend,
  apiRunEnd,
  apiRunStart,
  apiSetHouse,
  apiShare,
} from "./api.js";
import { ActBatcher } from "./batcher.js";
import type {
  CodexEntryRec,
  CorpseGift,
  DeathReport,
  FloorPayloadLike,
  GamePorts,
  LearnedRule,
  RunSetup,
} from "./ports.js";
import { SessionModel } from "./session-model.js";

/** Boot-time refusal with player-readable copy (rendered by main.ts). */
export class VaultRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultRefusal";
  }
}

const CODEX_PAGE_CAP = 8; // 8 × 50 entries — far beyond the v1 rules table

function clampU8(v: number): number {
  return Math.max(0, Math.min(Math.trunc(v), 255));
}

function clampU16(v: number): number {
  return Math.max(0, Math.min(Math.trunc(v), 65535));
}

interface DecodedFloor {
  floorData: FloorData;
  rngInit: Uint32Array;
}

/** Fresh decode per caller — nobody ever mutates a shared FloorData. */
function decodePayload(wire: FloorWire): FloorPayloadLike {
  const { floorData, rngInit, extras } = floorFromWire(wire);
  return {
    floorData,
    rngInit,
    echoes: extras.echoes.map((e) => ({
      day: e.day,
      floor: e.floor,
      frames: e.frames.map(([x, y, candle]) => ({ x, y, candle })),
    })),
  };
}

/**
 * Client twin of the server replay (src/server/core/replay.ts semantics —
 * read, never imported): apply every logged act in order; cross a floor
 * lazily (only when a further act must run on the new layout); record
 * h32Hex after each applied act. Catch-up pauses on an unknown rule or an
 * unfetched floor and resumes once the cache fills.
 */
class ShadowSim {
  private state: SimState;
  private readonly queue: Step[] = [];
  private applied = 0;
  private readonly hashes: (string | null)[] = [];

  constructor(
    first: DecodedFloor,
    setup: InitOptions,
    private readonly rules: RuleTable,
    private readonly floorFor: (floor: number) => DecodedFloor | null,
  ) {
    this.state = initState(first.floorData, first.rngInit, setup);
  }

  /** Current shadow floor — corpseRef → corpseId mapping needs it. */
  get floor(): number {
    return this.state.floor;
  }

  /** Queue an applied act; returns its global step index. */
  push(op: number, arg: number): number {
    const index = this.hashes.length;
    this.hashes.push(null);
    this.queue.push({ op, arg });
    this.catchUp();
    return index;
  }

  /** State hash AFTER step `index`, or null while not yet computable. */
  hashAt(index: number): string | null {
    this.catchUp();
    return this.hashes[index] ?? null;
  }

  /** Steps queued but not yet shadow-applied (0 after a healthy catch-up). */
  get pending(): number {
    return this.queue.length;
  }

  /** Deep copy of the current shadow state (resume adoption). */
  snapshot(): SimState {
    this.catchUp();
    return cloneState(this.state);
  }

  catchUp(): void {
    while (this.queue.length > 0) {
      if (this.state.status === Status.DESCENDING) {
        const next = this.floorFor(this.state.floor + 1);
        if (next === null) return; // resumes once getFloorAsync caches the floor
        this.state = descendState(this.state, next.floorData, next.rngInit);
      }
      const r = tick(this.state, this.queue[0]!, this.rules);
      if (isRuleRequest(r)) return; // resumes once a flush fills the rule cache
      this.queue.shift();
      this.state = r.state;
      this.hashes[this.applied] = h32Hex(this.state);
      this.applied++;
    }
  }
}

export async function createRemotePorts(): Promise<GamePorts> {
  const day = await apiDay();
  const start = await apiRunStart();

  // Mid-run resume (M2b): a live run returns its full packed log + current
  // floor + learned/banked; we replay the log locally (mobile webviews die on
  // app-switch — a reload must not void the candle). A resumed response
  // without the payload should not happen; refuse cleanly rather than risk a
  // DESYNC void.
  const resumeWire = start.resumed ? start.resume : undefined;
  if (start.resumed && resumeWire === undefined) {
    throw new VaultRefusal(
      "Your candle already burns beyond recall. The vault would not retrace " +
        "its steps. Return with tomorrow's flame.",
    );
  }
  const resumeSteps: Step[] =
    resumeWire === undefined || resumeWire.log === ""
      ? []
      : unpackActions(fromB64(resumeWire.log));

  const codexWire: CodexEntryWire[] = [];
  {
    const first = await apiCodex(0);
    codexWire.push(...first.entries);
    const pages = Math.min(first.pageCount, CODEX_PAGE_CAP);
    for (let p = 1; p < pages; p++) codexWire.push(...(await apiCodex(p)).entries);
  }

  const token = start.token;
  const setup: RunSetup = {
    mods: { ...start.setup.mods },
    heirloom: start.setup.heirloom,
    noSalt: start.setup.noSalt,
  };
  const model = new SessionModel(day, codexWire);

  /** Validated wire payloads by floor — floor 1 arrives with /start. */
  const floors = new Map<number, FloorWire>();
  floors.set(start.floor.floor, start.floor);
  const floorFetches = new Map<number, Promise<FloorPayloadLike>>();

  /** Every rule effect the server has revealed (ActRes.rules ∪ corpse yields ∪ resume.learned). */
  const ruleCache = new Map<string, number>();
  /** Corpse yields by corpseId (D51 — granted server-side on the act flush). */
  const yields = new Map<string, CorpseYieldWire>();

  // resume hydration, phase 1: the run's learned rules (so the replay never
  // hits an unresolvable key) and every entered floor via the idempotent
  // /descend re-serve (ts-pinned ⇒ byte-identical composition)
  if (resumeWire !== undefined) {
    for (const r of resumeWire.learned) {
      if (!ruleCache.has(r.key)) ruleCache.set(r.key, r.effect);
    }
    for (let f = 1; f <= resumeWire.floor; f++) {
      if (floors.has(f)) continue;
      const served = await apiRunDescend(token, f);
      floors.set(f, served.floor);
    }
  }

  const shadowTable: RuleTable = { get: (key) => ruleCache.get(key) };
  const shadowFloorFor = (floor: number): DecodedFloor | null => {
    const wire = floors.get(floor);
    if (wire === undefined) return null;
    const { floorData, rngInit } = floorFromWire(wire);
    return { floorData, rngInit };
  };
  // the shadow always replays from floor 1 — on resume, floors 1..floor were
  // just hydrated above; on a fresh run, floor 1 arrived with /start
  const shadow = new ShadowSim(shadowFloorFor(1)!, setup, shadowTable, shadowFloorFor);

  const absorb = (res: ActRes): void => {
    for (const r of res.rules) {
      if (!ruleCache.has(r.key)) ruleCache.set(r.key, r.effect);
    }
    for (const y of res.corpses) {
      yields.set(y.corpseId, y);
      for (const u of y.unbanked) {
        if (!ruleCache.has(u.key)) ruleCache.set(u.key, u.effect);
      }
    }
    shadow.catchUp(); // new rules may unblock queued shadow steps
  };

  const batcher = new ActBatcher({
    token,
    send: apiRunAct,
    onResult: absorb,
    fromTick: resumeSteps.length, // the server already holds the resumed log
  });

  // resume hydration, phase 2: replay the log through the shadow (same
  // initState/tick/lazy-descendState as the server replay) and stage the
  // adoption payload for getResume
  let resumeAdoption: {
    state: SimState;
    floor: number;
    learned: LearnedRule[];
    banked: string[];
  } | null = null;
  if (resumeWire !== undefined && resumeSteps.length > 0) {
    for (const s of resumeSteps) shadow.push(s.op, s.arg);
    if (shadow.pending > 0) {
      // resume.learned covers every consulted key and floors 1..floor are
      // cached, so a stall means ledger/client disagreement — refuse cleanly
      throw new VaultRefusal(
        "The vault's ledger and your candle disagree. This descent cannot " +
          "be retraced. Return with tomorrow's flame.",
      );
    }
    let state = shadow.snapshot();
    // resolve a descend the server already acknowledged (log ends DESCENDING
    // with row.floor advanced) so the driver adopts a state on the floor it
    // will render; the shadow itself stays lazy — it crosses before its next
    // queued act, exactly like the server replay
    if (state.status === Status.DESCENDING && resumeWire.floor === state.floor + 1) {
      const next = shadowFloorFor(state.floor + 1);
      if (next !== null) state = descendState(state, next.floorData, next.rngInit);
    }
    resumeAdoption = {
      state,
      floor: state.floor,
      learned: resumeWire.learned.map((l) => ({ key: l.key, effect: l.effect })),
      banked: [...resumeWire.banked],
    };
  }

  const fetchFloor = async (floor: number): Promise<FloorPayloadLike> => {
    // the DESCEND act must be in the server log before /descend can advance
    await batcher.flush();
    const res = await apiRunDescend(token, floor);
    floors.set(floor, res.floor);
    shadow.catchUp(); // a descend-blocked shadow can now cross
    return decodePayload(res.floor);
  };

  const getFloorAsync = async (floor: number): Promise<FloorPayloadLike> => {
    const cached = floors.get(floor);
    if (cached !== undefined) return decodePayload(cached);
    const inflight = floorFetches.get(floor);
    if (inflight !== undefined) {
      try {
        return await inflight;
      } catch {
        // a speculative prefetch raced ahead of the DESCEND flush — refetch
      } finally {
        floorFetches.delete(floor);
      }
    }
    const p = fetchFloor(floor);
    floorFetches.set(floor, p);
    try {
      return await p;
    } finally {
      floorFetches.delete(floor);
    }
  };

  const bankAsync = async (claims: LearnedRule[]): Promise<CodexEntryRec[]> => {
    await batcher.flush(); // the BANK act rides ahead of the claims
    const wireClaims = claims.slice(0, 3).map((c) => ({
      key: c.key,
      effect: clampU8(ruleCache.get(c.key) ?? c.effect),
    }));
    const res = await apiRunBank({
      token,
      claims: wireClaims,
      confirms: model.drainConfirms(),
    });
    return res.entries.map((e) => model.absorbBanked(e));
  };

  const endRun = async (
    lastWords: string,
    frames: DeathReport["echoFrames"],
  ): Promise<void> => {
    await batcher.flush(); // the fatal/exit act must be replayable server-side
    const echoFrames = frames
      .slice(0, 64)
      .map(
        (f) =>
          [clampU16(f.x), clampU16(f.y), Math.max(0, Math.min(f.candle, 2))] as [
            number,
            number,
            number,
          ],
      );
    const res = await apiRunEnd({ token, lastWords: lastWords.slice(0, 80), echoFrames });
    model.noteEnd(res);
  };

  const ports: GamePorts = {
    resolveRule(key: string): number {
      const effect = ruleCache.get(key);
      if (effect === undefined) {
        throw new Error(
          `rule "${key}" not in the session cache — the driver must await resolveRuleAsync first`,
        );
      }
      return effect;
    },

    getFloor(floor: number): FloorPayloadLike {
      const wire = floors.get(floor);
      if (wire === undefined) {
        throw new Error(
          `floor ${floor} not hydrated — await getFloorAsync/prefetchFloor first (08 §7)`,
        );
      }
      return decodePayload(wire);
    },

    getRunSetup(): RunSetup {
      return { mods: { ...setup.mods }, heirloom: setup.heirloom, noSalt: setup.noSalt };
    },

    getGuildhall() {
      return model.guildhall();
    },

    getCodex(): CodexEntryRec[] {
      return model.codexList();
    },

    bankClaims(claims: LearnedRule[]): CodexEntryRec[] {
      // sync façade: optimistic "pending" rows now, server truth via the
      // fire-and-forget async path (idempotent alongside bankClaimsAsync)
      const recs = model.optimisticBank(claims);
      void bankAsync(claims).catch(() => undefined);
      return recs;
    },

    confirmObservations(keys: string[]): void {
      model.queueConfirms(keys); // drained into zBankReq.confirms at bank (08 §7)
    },

    reportDeath(report: DeathReport): void {
      void endRun(report.lastWords, report.echoFrames).catch(() => undefined);
    },

    reportExit(): void {
      void endRun("", []).catch(() => undefined);
    },

    // write-behind ports: local model only — the server derives shared state
    // from the replayed action log (08 §2), chalk persists from the replayed
    // sim state at end/bank
    brazierLit(floor: number, tileIndex: number): void {
      model.noteBrazier(floor, tileIndex);
    },

    glowmossPlanted(floor: number, tileIndex: number): void {
      model.noteGlowmoss(floor, tileIndex);
    },

    signPlaced(floor: number, tileIndex: number, template: number, noun: number): void {
      model.addLocalSign(floor, { tileIndex, template, noun });
    },

    getSigns(floor: number): { tileIndex: number; template: number; noun: number }[] {
      const payloadSigns = floors.get(floor)?.signContents ?? [];
      return model.signsFor(floor, payloadSigns);
    },

    chalkChanged(floor: number, chalk: Uint8Array): void {
      model.setChalk(floor, chalk);
    },

    corpseRecovered(corpseRef: number): { unbanked: LearnedRule[]; gift: CorpseGift | null } {
      const wire = floors.get(shadow.floor);
      const corpseId = wire?.corpseIds[corpseRef];
      const y = corpseId !== undefined ? yields.get(corpseId) : undefined;
      if (y === undefined) {
        // the recovery act hasn't flushed yet — hurry the D51 yield along;
        // the server appends the corpse's unbanked truths to run.learned on
        // that flush regardless, so nothing is lost server-side
        void batcher.flush().catch(() => undefined);
        return { unbanked: [], gift: null };
      }
      return {
        unbanked: y.unbanked.map((u) => ({ key: u.key, effect: u.effect })),
        gift: y.gift === null ? null : { item: y.gift.item, charges: y.gift.charges },
      };
    },

    nextDay(): void {
      // one candle per user per day (invariant 10) — the remote client never
      // re-runs the same day; tomorrow is a fresh boot
    },

    getHouse(): string | null {
      return model.getHouse();
    },

    setHouse(name: string): void {
      model.setHouse(name); // local immediacy for the epitaph flow
      void apiSetHouse(name).catch(() => undefined); // persist server-side (D130): the house survives reload
    },

    shareEpitaph(): Promise<boolean> {
      return apiShare(token).then((r) => r.ok).catch(() => false);
    },

    heirloomDue(): boolean {
      return false; // heirloom picking is the M3 lineage surface; the run's
      // active heirloom arrives server-chosen in StartRes.setup
    },

    pickHeirloom(): void {
      // no lineage endpoint at M2b — see heirloomDue
    },

    // ── M2b remote seams (08 §7) ───────────────────────────────────────────

    async resolveRuleAsync(key: string): Promise<number> {
      const hit = ruleCache.get(key);
      if (hit !== undefined) return hit;
      // the pending batch INCLUDES the act that hit the unknown rule (the
      // driver pushes it via actApplied before awaiting) — the server replay
      // consults the rule and returns it in ActRes.rules.
      // ROBUSTNESS (D124): on the live server a single flush can blip
      // (transient rate/network) — retrying instead of throwing keeps the run
      // fluid. A failed flush used to strand the rule and freeze the world with
      // repeated "the Vault did not answer" toasts.
      for (let attempt = 0; attempt < 5; attempt++) {
        let flushOk = false;
        try {
          await batcher.flush();
          flushOk = true;
        } catch {
          // transient (rate/network) — retry after a backoff below
        }
        const effect = ruleCache.get(key);
        if (effect !== undefined) return effect;
        // a SUCCESSFUL flush that still didn't reveal the key means the server
        // genuinely never consulted it — retrying cannot help, fail fast.
        if (flushOk) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 250 + attempt * 250));
        const late = ruleCache.get(key);
        if (late !== undefined) return late;
      }
      throw new Error(`the vault did not reveal "${key}"`);
    },

    prefetchFloor(floor: number): void {
      if (floors.has(floor) || floorFetches.has(floor)) return;
      const p = fetchFloor(floor);
      floorFetches.set(floor, p);
      p.catch(() => {
        // speculative miss ("not upon the stairs" yet) — the awaited
        // getFloorAsync retries after the DESCEND act flushes
        floorFetches.delete(floor);
      });
    },

    getFloorAsync,

    actApplied(op: number, arg: number, atTick: number): void {
      const index = shadow.push(op, arg);
      batcher.push(op, arg, atTick, () => shadow.hashAt(index));
    },

    bankClaimsAsync: bankAsync,

    reportDeathAsync(report: DeathReport): Promise<void> {
      return endRun(report.lastWords, report.echoFrames);
    },

    reportExitAsync(): Promise<void> {
      return endRun("", []);
    },

    getResume() {
      if (resumeAdoption === null) return null;
      const out = resumeAdoption;
      resumeAdoption = null; // CONSUME-ONCE: a scene restart never re-adopts
      const wire = floors.get(out.floor);
      if (wire === undefined) return null; // defensive — floors 1..resume.floor hydrated
      return {
        state: out.state,
        floor: decodePayload(wire),
        learned: out.learned,
        banked: out.banked,
      };
    },
  };
  return ports;
}
