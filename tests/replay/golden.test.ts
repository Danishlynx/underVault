/**
 * The golden replay gate (02 §3, CLAUDE.md DoD): every golden must replay
 * hash-identical, checkpoint by checkpoint. Drift fails the build. The W1
 * exit test ("recorded runs replay hash-identical") lives here as
 * MIN_GOLDENS. Add a golden whenever the sim changes (npm run replay:record).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, test } from "vitest";
import { fromB64, unpackActions } from "../../src/shared/sim/pack.js";
import { STATE_V } from "../../src/shared/sim/types.js";
import { replayRun, type Checkpoint } from "../../tools/replay/runner.js";

const MIN_GOLDENS = 3;

interface Golden {
  goldenV: number;
  name: string;
  simVersion: number;
  daySeed: number;
  actionCount: number;
  actionsB64: string;
  checkpoints: Checkpoint[];
  finalTick: number;
  finalH32: string;
  finalStatus: number;
  finalWax: number;
  finalFloor: number;
}
// goldenV 2 = Step-based logs (logV 2, argumented opcodes)

const dir = path.join(process.cwd(), "tests", "golden");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];

describe("golden replay corpus", () => {
  test(`corpus holds at least ${MIN_GOLDENS} goldens (W1 exit test)`, () => {
    expect(files.length).toBeGreaterThanOrEqual(MIN_GOLDENS);
  });

  for (const file of files) {
    const golden = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as Golden;

    test(`${golden.name}: hash-identical replay`, () => {
      expect(golden.simVersion).toBe(STATE_V); // version bump ⇒ regenerate corpus
      const actions = unpackActions(fromB64(golden.actionsB64));
      expect(actions.length).toBe(golden.actionCount);

      const r = replayRun(golden.daySeed, actions);
      expect(r.consumed).toBe(golden.actionCount);
      expect(r.checkpoints.length).toBe(golden.checkpoints.length);
      for (let i = 0; i < golden.checkpoints.length; i++) {
        expect(r.checkpoints[i]!.tick, `${golden.name} checkpoint ${i}`).toBe(golden.checkpoints[i]!.tick);
        expect(r.checkpoints[i]!.h32, `${golden.name} checkpoint ${i}`).toBe(golden.checkpoints[i]!.h32);
      }
      expect(r.finalTick).toBe(golden.finalTick);
      expect(r.finalH32).toBe(golden.finalH32);
      expect(r.finalStatus).toBe(golden.finalStatus);
      expect(r.finalWax).toBe(golden.finalWax);
      expect(r.finalFloor).toBe(golden.finalFloor);

      // double-run identity: catches hidden module-level state
      expect(replayRun(golden.daySeed, actions).finalH32).toBe(golden.finalH32);
    });
  }
});
