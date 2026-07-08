/**
 * Headless replay runner — the reference implementation of "replay a run
 * from its action log" (02 §3). Used by the recorder, the golden test
 * suite, and (at M2) mirrored by the server validator. Node/test context:
 * may import server rules; shipped client code may NOT.
 *
 * Convention: a checkpoint is taken when state.tick % 32 === 0 AFTER the
 * action fully processes INCLUDING any descend swap.
 */

import { generateFloor } from "../../src/shared/gen/index.js";
import { resolveRuleKey } from "../../src/server/rules/resolve.js";
import { descendState, initState, tickResolving } from "../../src/shared/sim/engine.js";
import { CHECKPOINT_EVERY, hashState } from "../../src/shared/sim/pack.js";
import { Status, type MutableRuleTable, type SimState } from "../../src/shared/sim/types.js";

export interface Checkpoint {
  tick: number;
  h32: string;
}

export interface ReplayResult {
  consumed: number;
  checkpoints: Checkpoint[];
  finalTick: number;
  finalH32: string;
  finalStatus: number;
  finalWax: number;
  finalFloor: number;
  state: SimState;
}

function hex(n: number): string {
  return (n >>> 0).toString(16).padStart(8, "0");
}

export function freshTable(): MutableRuleTable {
  const m = new Map<string, number>();
  return { get: (k) => m.get(k), set: (k, v) => void m.set(k, v) };
}

export function replayRun(daySeed: number, actions: readonly number[]): ReplayResult {
  const table = freshTable();
  const g = generateFloor(daySeed, 1);
  let s = initState(g.floorData, g.rngInit);
  const checkpoints: Checkpoint[] = [];
  let consumed = 0;

  for (const op of actions) {
    if (s.status === Status.DEAD || s.status === Status.EXITED) break;
    s = tickResolving(s, op, table, resolveRuleKey).state;
    consumed++;
    if (s.status === Status.DESCENDING) {
      const ng = generateFloor(daySeed, s.floor + 1);
      s = descendState(s, ng.floorData, ng.rngInit);
    }
    if (s.tick % CHECKPOINT_EVERY === 0) {
      checkpoints.push({ tick: s.tick, h32: hex(hashState(s)) });
    }
  }

  return {
    consumed,
    checkpoints,
    finalTick: s.tick,
    finalH32: hex(hashState(s)),
    finalStatus: s.status,
    finalWax: s.wax,
    finalFloor: s.floor,
    state: s,
  };
}
