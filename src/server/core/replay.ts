// src/server/core/replay.ts — the validator (08 §1.8).
//
// The run hash stores the ENTIRE packed log; every act batch reconstructs
// state by full replay from tick 0 (pure integer sim, ≤4096 steps, sub-10 ms).
// This is what keeps endpoints stateless (invariant 8) and run rows small (C4).
//
// Event stamping: events are re-stamped with their STEP INDEX (0-based), so
// `segmentEvents(all, fromTick)` — fromTick = steps already acked — slices
// exactly the retried segment. (Sim-internal tick numbers freeze on death
// while REJECTED events keep flowing; the step index stays monotonic.)

import {
  ACTION_MAX,
  Ev,
  Item,
  Status,
  isRuleRequest,
  type OutcomeEvent,
  type RuleTable,
  type SimState,
  type Step,
} from "../../shared/sim/types.js";
import { initState, descendState, tick, type InitOptions } from "../../shared/sim/engine.js";
import { ErrCode } from "../../shared/protocol.js";
import { ApiFailure } from "../http/env.js";
import { MAX_RUN_STEPS } from "./constants.js";
import type { ComposedFloor } from "./compose.js";

export interface FloorSource {
  get(floor: number): ComposedFloor; // memoize per request
}

export interface RecordingTable extends RuleTable {
  readonly consulted: Map<string, number>;
}

/** A shared-world write derived from the replayed log (02 §4: no /api/sign at M2). */
export interface WorldWrite {
  step: number; // step index that produced it
  floor: number;
  tileIndex: number;
  kind: 1 | 2 | 3; // 1 = brazier lit, 2 = glowmoss planted, 3 = sign placed
  template: number; // sign only
  noun: number; // sign only
}

/** A corpse recovery derived from the replayed log (D51). */
export interface RecoveryHit {
  step: number;
  floor: number;
  entityId: number;
  corpseRef: number; // entity.data — index into that floor's corpseIds
}

export interface ReplayOut {
  state: SimState;
  events: OutcomeEvent[]; // events from ALL steps, each stamped with its step index
  consulted: Map<string, number>; // every ruleKey → effect the sim asked for
  writes: WorldWrite[]; // additive to 08 §1.8 — see PR note
  recoveries: RecoveryHit[]; // additive to 08 §1.8 — see PR note
}

function bad(message: string): never {
  throw new ApiFailure(400, ErrCode.BAD_INPUT, message);
}

export function replayLog(
  source: FloorSource,
  setup: InitOptions,
  steps: readonly Step[],
  table: RecordingTable,
): ReplayOut {
  if (steps.length > MAX_RUN_STEPS) bad("the ledger holds no more pages for this descent");

  const first = source.get(1);
  let state = initState(first.floorData, first.rngInit, setup);
  const events: OutcomeEvent[] = [];
  const writes: WorldWrite[] = [];
  const recoveries: RecoveryHit[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (
      !Number.isInteger(step.op) ||
      step.op < 0 ||
      step.op > ACTION_MAX ||
      !Number.isInteger(step.arg) ||
      step.arg < 0
    ) {
      bad("the ledger cannot read this hand");
    }
    const r = tick(state, step, table);
    if (isRuleRequest(r)) {
      // impossible: the server table always answers (08 §2 resolver rule)
      throw new ApiFailure(500, ErrCode.BAD_INPUT, "the vault lost its own law");
    }
    state = r.state;
    for (const e of r.events) {
      events.push({ tick: i, type: e.type, a: e.a, b: e.b, c: e.c });
      if (e.type === Ev.BRAZIER_LIT) {
        writes.push({
          step: i,
          floor: state.floor,
          tileIndex: e.b * state.w + e.a, // event carries x, y
          kind: 1,
          template: 0,
          noun: 0,
        });
      } else if (e.type === Ev.ITEM_USED && e.a === Item.GLOWVIAL) {
        // glowvial plants at the player's feet (engine USE handler)
        writes.push({
          step: i,
          floor: state.floor,
          tileIndex: state.py * state.w + state.px,
          kind: 2,
          template: 0,
          noun: 0,
        });
      } else if (e.type === Ev.SIGN_PLACED) {
        // sign lands at the player's feet; event carries template, noun
        writes.push({
          step: i,
          floor: state.floor,
          tileIndex: state.py * state.w + state.px,
          kind: 3,
          template: e.a,
          noun: e.b,
        });
      } else if (e.type === Ev.CORPSE_RECOVERED) {
        recoveries.push({ step: i, floor: state.floor, entityId: e.a, corpseRef: e.b });
      }
    }
    // Cross the floor only when further steps must run on the new layout;
    // when DESCEND is the log's last step the state stays DESCENDING so
    // /api/run/descend can verify it (08 §2 descend row).
    if (state.status === Status.DESCENDING && i < steps.length - 1) {
      const next = source.get(state.floor + 1);
      state = descendState(state, next.floorData, next.rngInit);
    }
  }

  return { state, events, consulted: table.consulted, writes, recoveries };
}

/** Slice of events with step index >= fromTick — what an idempotent /act retry re-returns. */
export function segmentEvents(all: ReplayOut, fromTick: number): OutcomeEvent[] {
  return all.events.filter((e) => e.tick >= fromTick);
}
