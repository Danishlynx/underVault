/**
 * Golden recorder v2 (Steps). Deterministic policy bots mint golden replay
 * files (tests/golden/*.json). Rebaselining stays per-golden and manual.
 *
 *   npm run replay:record -- --batch
 *   npm run replay:record -- --name my-run --seed 20260708 --bot 7 --steps 450 --mode delver
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import { generateFloor } from "../../src/shared/gen/index.js";
import { resolveRuleKey } from "../../src/server/rules/resolve.js";
import { descendState, tickResolving, initState } from "../../src/shared/sim/engine.js";
import { packActions, toB64 } from "../../src/shared/sim/pack.js";
import { splitmix32 } from "../../src/shared/sim/rng.js";
import { Action, Candle, Status, STATE_V, Tile, type SimState, type Step } from "../../src/shared/sim/types.js";
import { MAX_FLOOR } from "../../src/shared/sim/constants.js";
import { freshTable, replayRun } from "./runner.js";

const GOLDEN_DIR = path.join(process.cwd(), "tests", "golden");

type BotMode = "explore" | "delver" | "vigil";

function bfsNextDir(s: SimState, target: number): number {
  const w = s.w;
  const n = w * s.h;
  const passable = (t: number): boolean =>
    t === Tile.FLOOR || t === Tile.MOSS || t === Tile.WEBBING || t === Tile.WATER ||
    t === Tile.GLOWMOSS || t === Tile.PLATE || t === Tile.DOOR_OPEN ||
    t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK || t === Tile.ENTRY ||
    t === Tile.STAIRS_DOWN || t === Tile.WAYSTONE || t === Tile.WAX_DRIP ||
    t === Tile.WAX_STUB || t === Tile.WAX_CAKE || t === Tile.KEY_DROP;
  const prev = new Int32Array(n).fill(-2);
  const start = s.py * w + s.px;
  prev[start] = -1;
  const q = [start];
  let qi = 0;
  let found = -1;
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  while (qi < q.length && found < 0) {
    const i = q[qi++]!;
    for (let d = 0; d < 4; d++) {
      const nx = (i % w) + DX[d]!;
      const ny = ((i / w) | 0) + DY[d]!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= s.h) continue;
      const ni = ny * w + nx;
      if (prev[ni]! !== -2 || !passable(s.tiles[ni]!)) continue;
      prev[ni] = i;
      if (s.tiles[ni] === target) {
        found = ni;
        break;
      }
      q.push(ni);
    }
  }
  if (found < 0) return -1;
  let cur = found;
  while (prev[cur]! !== start && prev[cur]! !== -1) cur = prev[cur]!;
  if (prev[cur]! === -1) return -1;
  const dx = (cur % w) - s.px;
  const dy = ((cur / w) | 0) - s.py;
  return dy === -1 ? 0 : dx === 1 ? 1 : dy === 1 ? 2 : 3;
}

class Bot {
  private x: number;
  private heading = 1;
  constructor(seed: number, private readonly mode: BotMode) {
    this.x = seed >>> 0;
  }
  private draw(n: number): number {
    const [v, nx] = splitmix32(this.x);
    this.x = nx;
    return v % n;
  }
  next(s: SimState): Step {
    if (this.mode === "vigil") return { op: Action.WAIT, arg: 0 };

    const onStairs = s.tiles[s.py * s.w + s.px] === Tile.STAIRS_DOWN;
    if (onStairs && s.floor < MAX_FLOOR) return { op: Action.DESCEND, arg: 0 };

    if (this.mode === "delver" && this.draw(100) < 88) {
      const dir = bfsNextDir(s, Tile.STAIRS_DOWN);
      if (dir >= 0) {
        const nx = s.px + [0, 1, 0, -1][dir]!;
        const ny = s.py + [-1, 0, 1, 0][dir]!;
        const t = s.tiles[ny * s.w + nx]!;
        const blockedByEntity = s.entities.some((e) => e.x === nx && e.y === ny);
        if (t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK || blockedByEntity) {
          return { op: Action.INTERACT_N + dir, arg: 0 };
        }
        return { op: Action.MOVE_N + dir, arg: 0 };
      }
    }

    const r = this.draw(100);
    if (r < 56) {
      if (this.draw(10) < 3) this.heading = this.draw(4);
      return { op: Action.MOVE_N + this.heading, arg: 0 };
    }
    if (r < 66) return { op: Action.WAIT, arg: 0 };
    if (r < 76) return { op: Action.INTERACT_N + this.draw(4), arg: 0 };
    if (r < 81) return { op: Action.SALT_N + this.draw(4), arg: 0 };
    if (r < 85) return { op: Action.CHALK_MARK, arg: 0 };
    if (r < 89) return { op: Action.USE, arg: ((this.draw(6) & 7) << 2) | this.draw(4) };
    if (r < 93) return { op: Action.CUP, arg: 0 };
    if (r < 96 && s.tiles[s.py * s.w + s.px] === Tile.WAYSTONE) {
      return { op: Action.BANK, arg: 1 + this.draw(3) };
    }
    return s.candle === Candle.SNUFFED ? { op: Action.RELIGHT, arg: 0 } : { op: Action.SNUFF, arg: 0 };
  }
}

function record(name: string, daySeed: number, botSeed: number, maxSteps: number, mode: BotMode): void {
  const table = freshTable();
  const g = generateFloor(daySeed, 1);
  let s = initState(g.floorData, g.rngInit);
  const bot = new Bot(botSeed, mode);
  const steps: Step[] = [];

  while (steps.length < maxSteps && s.status === Status.ALIVE) {
    const step = bot.next(s);
    s = tickResolving(s, step, table, (key) => resolveRuleKey(key)).state;
    steps.push(step);
    if (s.status === Status.DESCENDING) {
      const ng = generateFloor(daySeed, s.floor + 1);
      s = descendState(s, ng.floorData, ng.rngInit);
    }
  }

  const result = replayRun(daySeed, steps);
  if (result.consumed !== steps.length) {
    throw new Error(`recorder drift: consumed ${result.consumed} of ${steps.length}`);
  }

  const golden = {
    goldenV: 2,
    name,
    simVersion: STATE_V,
    daySeed,
    botSeed,
    actionCount: steps.length,
    actionsB64: toB64(packActions(steps)),
    checkpoints: result.checkpoints,
    finalTick: result.finalTick,
    finalH32: result.finalH32,
    finalStatus: result.finalStatus,
    finalWax: result.finalWax,
    finalFloor: result.finalFloor,
  };
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  fs.writeFileSync(path.join(GOLDEN_DIR, `${name}.json`), JSON.stringify(golden, null, 2) + "\n", "utf8");
  console.log(
    `golden: ${name} — ${steps.length} steps, ${result.checkpoints.length} checkpoints, ` +
      `floor ${result.finalFloor}, status ${result.finalStatus}, final ${result.finalH32}`,
  );
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv.includes("--batch")) {
  const DEV_SEED = 20260708;
  for (let bot = 1; bot <= 3; bot++) {
    record(`dev-explore-bot${bot}`, DEV_SEED, bot, 500, "explore");
  }
  for (let bot = 1; bot <= 4; bot++) {
    record(`dev-delver-bot${bot}`, DEV_SEED, bot + 10, 500, "delver");
  }
  record("vigil-death", DEV_SEED, 1, 560, "vigil");
  record("alt-seed-delver-1", 11111, 21, 500, "delver");
  record("alt-seed-delver-2", 987654321, 22, 500, "delver");
  record("alt-seed-explore-1", 987654321, 3, 450, "explore");
  record("alt-seed-explore-2", 424242, 4, 450, "explore");
} else {
  const name = arg("--name") ?? "adhoc";
  record(
    name,
    Number(arg("--seed") ?? "20260708"),
    Number(arg("--bot") ?? "1"),
    Number(arg("--steps") ?? "450"),
    (arg("--mode") as BotMode | undefined) ?? "explore",
  );
}
