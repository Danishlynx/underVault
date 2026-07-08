/**
 * Golden recorder: drives the sim with a deterministic policy bot and mints
 * golden replay files (tests/golden/*.json). Rebaselining is per-golden and
 * manual by design — determinism drift must stay conspicuous in diffs.
 *
 *   npm run replay:record -- --batch            # the standard corpus
 *   npm run replay:record -- --name my-run --seed 20260708 --bot 7 --steps 450
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import { generateFloor } from "../../src/shared/gen/index.js";
import { resolveRuleKey } from "../../src/server/rules/resolve.js";
import { descendState, tickResolving, initState } from "../../src/shared/sim/engine.js";
import { packActions, toB64 } from "../../src/shared/sim/pack.js";
import { splitmix32 } from "../../src/shared/sim/rng.js";
import { Action, Candle, Status, STATE_V, Tile, type SimState } from "../../src/shared/sim/types.js";
import { MAX_FLOOR } from "../../src/shared/sim/constants.js";
import { freshTable, replayRun } from "./runner.js";

const GOLDEN_DIR = path.join(process.cwd(), "tests", "golden");

type BotMode = "explore" | "delver" | "vigil";

/** BFS next-step direction from the player toward the nearest tile of
 *  `target` kind (doors passable, entities ignored — they move). −1 = none. */
function bfsNextDir(s: SimState, target: number): number {
  const w = s.w;
  const n = w * s.h;
  const passable = (t: number): boolean =>
    t === Tile.FLOOR || t === Tile.MOSS || t === Tile.WEBBING || t === Tile.DOOR_OPEN ||
    t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK || t === Tile.ENTRY ||
    t === Tile.STAIRS_DOWN || t === Tile.WAYSTONE || t === Tile.WAX_DRIP ||
    t === Tile.WAX_STUB || t === Tile.WAX_CAKE;
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
  private heading = 1; // E
  constructor(seed: number, private readonly mode: BotMode) {
    this.x = seed >>> 0;
  }
  private draw(n: number): number {
    const [v, nx] = splitmix32(this.x);
    this.x = nx;
    return v % n;
  }
  next(s: SimState): number {
    if (this.mode === "vigil") return Action.WAIT; // burns down to the Dark Grace

    const onStairs = s.tiles[s.py * s.w + s.px] === Tile.STAIRS_DOWN;
    if (onStairs && s.floor < MAX_FLOOR) return Action.DESCEND;

    if (this.mode === "delver" && this.draw(100) < 88) {
      // march toward the stairs (waystone on the bottom floor), opening
      // doors and bump-attacking whatever stands in the way
      const target = s.floor < MAX_FLOOR ? Tile.STAIRS_DOWN : Tile.WAYSTONE;
      const dir = bfsNextDir(s, target);
      if (dir >= 0) {
        const nx = s.px + [0, 1, 0, -1][dir]!;
        const ny = s.py + [-1, 0, 1, 0][dir]!;
        const t = s.tiles[ny * s.w + nx]!;
        const blockedByEntity = s.entities.some((e) => e.x === nx && e.y === ny);
        if (t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK || blockedByEntity) {
          return Action.INTERACT_N + dir;
        }
        return Action.MOVE_N + dir;
      }
    }

    const r = this.draw(100);
    if (r < 58) {
      if (this.draw(10) < 3) this.heading = this.draw(4);
      return Action.MOVE_N + this.heading;
    }
    if (r < 68) return Action.WAIT;
    if (r < 78) return Action.INTERACT_N + this.draw(4);
    if (r < 83) return Action.SALT_N + this.draw(4);
    if (r < 88) return Action.CHALK_MARK;
    if (r < 93) return Action.CUP;
    return s.candle === Candle.SNUFFED ? Action.RELIGHT : Action.SNUFF;
  }
}

function record(name: string, daySeed: number, botSeed: number, maxSteps: number, mode: BotMode): void {
  const table = freshTable();
  const g = generateFloor(daySeed, 1);
  let s = initState(g.floorData, g.rngInit);
  const bot = new Bot(botSeed, mode);
  const actions: number[] = [];

  while (actions.length < maxSteps && s.status !== Status.DEAD && s.status !== Status.EXITED) {
    const op = bot.next(s);
    s = tickResolving(s, op, table, resolveRuleKey).state;
    actions.push(op);
    if (s.status === Status.DESCENDING) {
      const ng = generateFloor(daySeed, s.floor + 1);
      s = descendState(s, ng.floorData, ng.rngInit);
    }
  }

  // Re-run from scratch through the reference runner to mint checkpoints
  const result = replayRun(daySeed, actions);
  if (result.consumed !== actions.length) {
    throw new Error(`recorder drift: consumed ${result.consumed} of ${actions.length}`);
  }

  const golden = {
    goldenV: 1,
    name,
    simVersion: STATE_V,
    daySeed,
    botSeed,
    actionCount: actions.length,
    actionsB64: toB64(packActions(actions)),
    checkpoints: result.checkpoints,
    finalTick: result.finalTick,
    finalH32: result.finalH32,
    finalStatus: result.finalStatus,
    finalWax: result.finalWax,
    finalFloor: result.finalFloor,
  };
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  const file = path.join(GOLDEN_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(golden, null, 2) + "\n", "utf8");
  console.log(
    `golden: ${name} — ${actions.length} actions, ${result.checkpoints.length} checkpoints, ` +
      `floor ${result.finalFloor}, status ${result.finalStatus}, final ${result.finalH32}`,
  );
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv.includes("--batch")) {
  const DEV_SEED = 20260708;
  for (let bot = 1; bot <= 4; bot++) {
    record(`dev-explore-bot${bot}`, DEV_SEED, bot, 500, "explore");
  }
  for (let bot = 1; bot <= 4; bot++) {
    record(`dev-delver-bot${bot}`, DEV_SEED, bot + 10, 500, "delver");
  }
  record("vigil-death", DEV_SEED, 1, 560, "vigil");
  record("alt-seed-delver-1", 11111, 21, 500, "delver");
  record("alt-seed-delver-2", 987654321, 22, 500, "delver");
  record("alt-seed-explore", 987654321, 3, 450, "explore");
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
