/**
 * DEV-ONLY sim probe: runs scripted actions on the real dev-seed floor and
 * traces entity behavior tick by tick — fast way to see what the AI is
 * actually doing without driving the browser.
 */

import { generateFloor } from "../../src/shared/gen/index.js";
import { resolveRuleKey } from "../../src/server/rules/resolve.js";
import { initState, tickResolving, effectiveRadius } from "../../src/shared/sim/engine.js";
import { Action, type SimState } from "../../src/shared/sim/types.js";
import { freshTable } from "../replay/runner.js";

const KIND = ["?", "rat", "worm", "moth", "beast"];
const DAY_SEED = 20260708;

function snapshot(s: SimState, label: string): void {
  const ents = s.entities
    .map((e) => `${KIND[e.kind]}#${e.id}@(${e.x},${e.y})s${e.state}`)
    .join(" ");
  console.log(
    `${label} tick=${s.tick} p=(${s.px},${s.py}) wax=${s.wax} r=${effectiveRadius(s)} | ${ents}`,
  );
}

const g = generateFloor(DAY_SEED, 1);
let s = initState(g.floorData, g.rngInit);
const table = freshTable();
snapshot(s, "start");

// wait 10 ticks in place — do idle monsters move at all?
for (let i = 0; i < 10; i++) {
  s = tickResolving(s, Action.WAIT, table, resolveRuleKey).state;
}
snapshot(s, "after 10 WAIT");

// walk east 8, south 8 — do rats react to the light? does anything approach?
for (let i = 0; i < 8; i++) s = tickResolving(s, Action.MOVE_E, table, resolveRuleKey).state;
snapshot(s, "after 8 E");
for (let i = 0; i < 8; i++) s = tickResolving(s, Action.MOVE_S, table, resolveRuleKey).state;
snapshot(s, "after 8 S");

// dim the candle to guttering and wait — do rats swarm?
s.wax = 40; // radius 1
for (let i = 0; i < 12; i++) {
  s = tickResolving(s, Action.WAIT, table, resolveRuleKey).state;
  if (i % 4 === 3) snapshot(s, `dark wait ${i + 1}`);
}
console.log(`final wax=${s.wax} grace=${s.graceLeft} status=${s.status}`);
