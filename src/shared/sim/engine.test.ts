import { describe, expect, test } from "vitest";
import {
  descendState,
  effectiveRadius,
  lightRadiusBase,
  tick,
  tickResolving,
} from "./engine.js";
import { hashState } from "./pack.js";
import { seedAllStreams } from "./rng.js";
import {
  Action,
  Candle,
  DeathCause,
  Effect,
  Ev,
  EntityKind,
  MothState,
  Status,
  Tile,
  WormState,
  isRuleRequest,
} from "./types.js";
import { floorFromAscii, makeState, stubRules, runActions, ent } from "../../../tests/helpers.js";

const NONE = stubRules();

describe("light tiers (01 §5)", () => {
  test("boundaries", () => {
    expect(lightRadiusBase(500, Candle.LIT)).toBe(4);
    expect(lightRadiusBase(300, Candle.LIT)).toBe(4);
    expect(lightRadiusBase(299, Candle.LIT)).toBe(3);
    expect(lightRadiusBase(150, Candle.LIT)).toBe(3);
    expect(lightRadiusBase(149, Candle.LIT)).toBe(2);
    expect(lightRadiusBase(50, Candle.LIT)).toBe(2);
    expect(lightRadiusBase(49, Candle.LIT)).toBe(1);
    expect(lightRadiusBase(1, Candle.LIT)).toBe(1);
    expect(lightRadiusBase(0, Candle.LIT)).toBe(0);
  });
  test("cupped halves (floored, min 1 while lit); snuffed zeroes", () => {
    expect(lightRadiusBase(500, Candle.CUPPED)).toBe(2);
    expect(lightRadiusBase(200, Candle.CUPPED)).toBe(1);
    expect(lightRadiusBase(40, Candle.CUPPED)).toBe(1); // ⚖ D58: never blind while lit
    expect(lightRadiusBase(500, Candle.SNUFFED)).toBe(0);
  });
});

describe("wax economy", () => {
  const fd = floorFromAscii(["#######", "#@..d.#", "#.+x..#", "#..u..#", "#######"]);

  test("move / wait / blocked all cost 1; cup costs a tick but no wax", () => {
    let s = makeState(fd);
    s = runActions(s, [Action.MOVE_E]);
    expect(s.wax).toBe(499);
    expect(s.tick).toBe(1);
    s = runActions(s, [Action.WAIT]);
    expect(s.wax).toBe(498);
    s = runActions(s, [Action.MOVE_N]); // wall bump
    expect(s.wax).toBe(497);
    expect(s.px).toBe(2);
    s = runActions(s, [Action.CUP]);
    expect(s.wax).toBe(497);
    expect(s.candle).toBe(Candle.CUPPED);
    expect(s.tick).toBe(4);
  });

  test("walking into a door opens it (bump-to-open)", () => {
    let s = makeState(fd);
    s = runActions(s, [Action.MOVE_E]); // (2,1), door below at (2,2)
    s = runActions(s, [Action.MOVE_S]); // bump the closed door
    expect(s.tiles[2 * 7 + 2]).toBe(Tile.DOOR_OPEN);
    expect(s.px).toBe(2); // opening costs the turn; you step through next
    expect(s.py).toBe(1);
    expect(s.wax).toBe(498); // −1 move, −1 open
    s = runActions(s, [Action.MOVE_S]);
    expect(s.py).toBe(2); // now through the doorway
  });

  test("door 1, stuck door 5, brazier 30, pickup +20", () => {
    let s = makeState(fd);
    s = runActions(s, [Action.INTERACT_S]); // closed door below (2,2)? player at (1,1): S = (1,2) floor → invalid? no: (1,2) is '.' → invalid interact → wait-demote
    // navigate deliberately instead:
    s = makeState(fd);
    s = runActions(s, [Action.MOVE_E]); // (2,1)
    s = runActions(s, [Action.INTERACT_S]); // door at (2,2)
    expect(s.tiles[2 * 7 + 2]).toBe(Tile.DOOR_OPEN);
    expect(s.wax).toBe(498); // −1 move −1 door
    s = runActions(s, [Action.MOVE_E]); // (3,1)
    s = runActions(s, [Action.INTERACT_S]); // stuck door at (3,2)
    expect(s.tiles[2 * 7 + 3]).toBe(Tile.DOOR_OPEN);
    expect(s.wax).toBe(492); // −1 −5
    s = runActions(s, [Action.MOVE_E]); // (4,1) drip
    expect(s.wax).toBe(511); // −1 then +20
    expect(s.tiles[1 * 7 + 4]).toBe(Tile.FLOOR);
  });

});

describe("brazier aura + grace", () => {
  const fd = floorFromAscii(["######", "#@u..#", "######"]);

  test("light brazier −30; aura pauses base burn; exact-wax grace pauses", () => {
    let s = makeState(fd);
    s = runActions(s, [Action.INTERACT_E]);
    expect(s.tiles[1 * 6 + 2]).toBe(Tile.BRAZIER_LIT);
    expect(s.wax).toBe(470);
    const w = s.wax;
    s = runActions(s, [Action.WAIT]); // inside aura → base burn paused
    expect(s.wax).toBe(w);

    // exact-30 lighting → instant grace, immediately paused by fresh aura
    let s2 = makeState(fd);
    s2.wax = 30;
    s2 = runActions(s2, [Action.INTERACT_E]);
    expect(s2.wax).toBe(0);
    expect(s2.graceLeft).toBe(25);
    expect(s2.status).toBe(Status.ALIVE);
    const g = s2.graceLeft;
    s2 = runActions(s2, [Action.WAIT, Action.WAIT]);
    expect(s2.graceLeft).toBe(g); // paused at the flame
  });
});

describe("the Dark Grace", () => {
  const fd = floorFromAscii(["########", "#@...d.#", "########"]);

  test("burn to zero → 25 ticks → Taken by the Dark", () => {
    let s = makeState(fd);
    s.wax = 2;
    s = runActions(s, [Action.WAIT, Action.WAIT]);
    expect(s.wax).toBe(0);
    expect(s.graceLeft).toBe(25);
    for (let i = 0; i < 24; i++) s = runActions(s, [Action.WAIT]);
    expect(s.graceLeft).toBe(1);
    expect(s.status).toBe(Status.ALIVE);
    s = runActions(s, [Action.WAIT]);
    expect(s.status).toBe(Status.DEAD);
    expect(s.deathCause).toBe(DeathCause.TAKEN_BY_THE_DARK);
  });

  test("pickup rescue relights the candle", () => {
    let s = makeState(fd);
    s.wax = 4;
    s = runActions(s, [Action.MOVE_E, Action.MOVE_E, Action.MOVE_E, Action.WAIT]);
    expect(s.graceLeft).toBeGreaterThan(0);
    s = runActions(s, [Action.MOVE_E]); // onto the drip: +20, then the move burns 1
    expect(s.wax).toBe(19);
    expect(s.graceLeft).toBe(0);
    expect(s.candle).toBe(Candle.LIT);
  });

  test("snuffed at 0 wax still enters grace — no unkillable soft-lock", () => {
    // review finding: damage draining wax to 0 while SNUFFED must still
    // deliver the delver to the dark
    const fdEmpty = floorFromAscii(["#####", "#@..#", "#####"]);
    let s = makeState(fdEmpty);
    s = runActions(s, [Action.SNUFF, Action.SNUFF]);
    expect(s.candle).toBe(Candle.SNUFFED);
    s.wax = 0; // as if bitten down while dark
    s = runActions(s, [Action.WAIT]);
    expect(s.graceLeft).toBe(25);
    for (let i = 0; i < 25; i++) s = runActions(s, [Action.WAIT]);
    expect(s.status).toBe(Status.DEAD);
    expect(s.deathCause).toBe(DeathCause.TAKEN_BY_THE_DARK);
  });

  test("dead state rejects without advancing the tick", () => {
    let s = makeState(fd);
    s.wax = 1;
    s = runActions(s, [Action.WAIT]);
    for (let i = 0; i < 25; i++) s = runActions(s, [Action.WAIT]);
    expect(s.status).toBe(Status.DEAD);
    const t = s.tick;
    const h = hashState(s);
    const r = tick(s, { op: Action.WAIT, arg: 0 }, NONE.table);
    expect(isRuleRequest(r)).toBe(false);
    if (!isRuleRequest(r)) {
      expect(r.state.tick).toBe(t);
      expect(hashState(r.state)).toBe(h);
      expect(r.events[0]!.type).toBe(Ev.REJECTED);
    }
  });
});

describe("candle channels", () => {
  const fd = floorFromAscii(["#####", "#@..#", "#####"]);

  test("snuff takes exactly 2 ticks and burns 1 each; relight 3 ticks, free", () => {
    let s = makeState(fd);
    s = runActions(s, [Action.SNUFF]);
    expect(s.candle).toBe(Candle.LIT);
    expect(s.candleTimer).toBe(1);
    s = runActions(s, [Action.SNUFF]);
    expect(s.candle).toBe(Candle.SNUFFED);
    expect(s.wax).toBe(498);
    // snuffed: wax frozen
    s = runActions(s, [Action.MOVE_E, Action.MOVE_W]);
    expect(s.wax).toBe(498);
    expect(effectiveRadius(s)).toBe(0);
    // relight (flint in slot 0): 3 ticks, burns nothing
    s = runActions(s, [Action.RELIGHT, Action.RELIGHT]);
    expect(s.candle).toBe(Candle.SNUFFED);
    s = runActions(s, [Action.RELIGHT]);
    expect(s.candle).toBe(Candle.LIT);
    expect(s.wax).toBe(498);
  });

  test("SNUFF while already snuffed burns nothing (wax stays frozen)", () => {
    let s = makeState(fd);
    s = runActions(s, [Action.SNUFF, Action.SNUFF]);
    expect(s.candle).toBe(Candle.SNUFFED);
    const w = s.wax;
    s = runActions(s, [Action.SNUFF]); // demoted to wait — must not burn
    expect(s.wax).toBe(w);
    expect(s.candle).toBe(Candle.SNUFFED);
  });

  test("any other verb cancels a channel", () => {
    let s = makeState(fd);
    s = runActions(s, [Action.SNUFF, Action.MOVE_E]);
    expect(s.candleTimer).toBe(0);
    expect(s.candle).toBe(Candle.LIT);
    // restarting requires the full 2 ticks again
    s = runActions(s, [Action.SNUFF]);
    expect(s.candle).toBe(Candle.LIT);
    s = runActions(s, [Action.SNUFF]);
    expect(s.candle).toBe(Candle.SNUFFED);
  });

  test("invalid action demotes to wait: tick+1, wax−1, REJECTED", () => {
    const s0 = makeState(fd);
    const r = tick(s0, { op: Action.RELIGHT, arg: 0 }, NONE.table); // relight while lit = invalid
    expect(isRuleRequest(r)).toBe(false);
    if (!isRuleRequest(r)) {
      expect(r.state.tick).toBe(1);
      expect(r.state.wax).toBe(499);
      expect(r.events.some((e) => e.type === Ev.REJECTED)).toBe(true);
    }
  });
});

describe("secret rules resolution", () => {
  const fdRat = floorFromAscii(["######", "#@...#", "######"], [ent(1, EntityKind.RAT, 2, 1)]);

  test("unknown bump aborts with the rule key; tickResolving converges", () => {
    const s = makeState(fdRat);
    const r = tick(s, { op: Action.MOVE_E, arg: 0 }, NONE.table);
    expect(isRuleRequest(r)).toBe(true);
    if (isRuleRequest(r)) expect(r.needRule).toBe("rat|bump|self|lit");

    const rules = stubRules({ "rat|bump|self|lit": Effect.DIE });
    const done = tickResolving(s, { op: Action.MOVE_E, arg: 0 }, rules.table, rules.resolve);
    expect(done.state.entities.length).toBe(0);
    expect(done.events.some((e) => e.type === Ev.MONSTER_DIED)).toBe(true);
    expect(done.state.px).toBe(1); // bump is not a move
  });

  test("wickworm bumped with lit candle ignites and dies (secret)", () => {
    const fd = floorFromAscii(["######", "#@...#", "######"], [
      ent(1, EntityKind.WICKWORM, 2, 1, 2, WormState.SURFACED),
    ]);
    const s = makeState(fd);
    const rules = stubRules({ "wickworm|bump|self|lit": Effect.IGNITE_DIE });
    const done = tickResolving(s, { op: Action.MOVE_E, arg: 0 }, rules.table, rules.resolve);
    expect(done.state.entities.length).toBe(0);
    expect(done.state.fire[1 * 6 + 2]).toBeGreaterThan(0);
  });

  test("moth killed over webbing ignites it (dies-over rule)", () => {
    const fd = floorFromAscii(["######", "#@w..#", "######"], [
      ent(1, EntityKind.MOTH, 2, 1, 1, MothState.ORBIT),
    ]);
    const s = makeState(fd);
    const rules = stubRules({
      "moth|bump|self|lit": Effect.DIE,
      "moth|dies-over|webbing|-": Effect.IGNITE_TILE,
    });
    const done = tickResolving(s, { op: Action.MOVE_E, arg: 0 }, rules.table, rules.resolve);
    expect(done.state.entities.length).toBe(0);
    expect(done.state.fire[1 * 6 + 2]).toBeGreaterThan(0);
  });

  test("beast melts in a lit brazier's aura (aura pass rule)", () => {
    const fd = floorFromAscii(["#######", "#@.B..#", "#######"], [
      ent(1, EntityKind.BEAST, 5, 1, 99),
    ]);
    const s = makeState(fd);
    const rules = stubRules({ "beast|in-aura|brazier|-": Effect.MELT });
    const done = tickResolving(s, { op: Action.WAIT, arg: 0 }, rules.table, rules.resolve);
    expect(done.state.entities.length).toBe(0);
    expect(done.events.some((e) => e.type === Ev.MONSTER_MELTED)).toBe(true);
  });
});

describe("monster behavior (client-visible dispositions)", () => {
  test("beast follows noise: the BEAST moves on stone steps, freezes on silence", () => {
    const rows = ["##########", "#@.......#", "#........#", "#.......b#", "##########"];
    const fd = floorFromAscii(
      rows.map((r) => r.replace("b", ".")),
      [ent(1, EntityKind.BEAST, 8, 3, 99)],
    );
    let s = makeState(fd);
    const rules = stubRules();
    const beast = (): { x: number; y: number } => ({ x: s.entities[0]!.x, y: s.entities[0]!.y });
    const b0 = beast();
    s = tickResolving(s, { op: Action.MOVE_E, arg: 0 }, rules.table, rules.resolve).state; // stone: noise 2
    const b1 = beast();
    // the beast itself must have moved toward the noise (2 steps on stone)
    expect(Math.abs(b1.x - b0.x) + Math.abs(b1.y - b0.y)).toBe(2);
    expect(b1.x + b1.y).toBeLessThan(b0.x + b0.y); // toward the top-left noise
    s = tickResolving(s, { op: Action.WAIT, arg: 0 }, rules.table, rules.resolve).state; // silence
    const b2 = beast();
    expect(b2.x).toBe(b1.x); // stand still and it is blind to you
    expect(b2.y).toBe(b1.y);
    // moss is quieter: noise 1 → exactly 1 step
    let s2 = makeState(
      floorFromAscii(["##########", "#@m......#", "#........#", "#........#", "##########"], [
        ent(1, EntityKind.BEAST, 8, 3, 99),
      ]),
    );
    const c0 = { x: 8, y: 3 };
    s2 = tickResolving(s2, { op: Action.MOVE_E, arg: 0 }, rules.table, rules.resolve).state; // onto moss
    const c1 = { x: s2.entities[0]!.x, y: s2.entities[0]!.y };
    expect(Math.abs(c1.x - c0.x) + Math.abs(c1.y - c0.y)).toBe(1);
  });

  test("orbiting moths drain effective radius; cupping sheds them", () => {
    const fd = floorFromAscii(["######", "#.@..#", "######"], [
      ent(1, EntityKind.MOTH, 1, 1, 1, MothState.ORBIT),
      ent(2, EntityKind.MOTH, 3, 1, 1, MothState.ORBIT),
    ]);
    const s = makeState(fd);
    expect(lightRadiusBase(s.wax, s.candle)).toBe(4);
    expect(effectiveRadius(s)).toBe(2); // −2 for two orbiters
    const rules = stubRules();
    const after = tickResolving(s, { op: Action.CUP, arg: 0 }, rules.table, rules.resolve).state;
    // cupped: moths scatter this very tick
    expect(after.entities.every((e) => e.state === MothState.SCATTER)).toBe(true);
  });

  test("salt line blocks a swarming rat", () => {
    const fd = floorFromAscii(["#####", "#@..#", "#####"], [ent(1, EntityKind.RAT, 3, 1)]);
    let s = makeState(fd);
    s.wax = 0; // dark → rats swarm (grace starts on the first tick)
    const rules = stubRules();
    s = tickResolving(s, { op: Action.SALT_E, arg: 0 }, rules.table, rules.resolve).state;
    expect(s.salt[1 * 5 + 2]).toBe(1); // thrown 1 east
    s = tickResolving(s, { op: Action.WAIT, arg: 0 }, rules.table, rules.resolve).state;
    // the only approach crosses the salt — the rat is stuck at (3,1)
    expect(s.entities[0]!.x).toBe(3);
    expect(s.entities[0]!.y).toBe(1);
  });
});

describe("descend + fx quarantine + replay stability", () => {
  const f1 = floorFromAscii(["#####", "#@>.#", "#####"]);
  const f2 = floorFromAscii(["#####", "#@.d#", "#####"], [], 2);

  test("descend carries the delver, swaps the floor", () => {
    let s = makeState(f1);
    s = runActions(s, [Action.MOVE_E]); // onto stairs
    const r = tickResolving(s, { op: Action.DESCEND, arg: 0 }, NONE.table, NONE.resolve);
    expect(r.state.status).toBe(Status.DESCENDING);
    expect(r.events.some((e) => e.type === Ev.DESCENDED)).toBe(true);
    const wax = r.state.wax;
    const s2 = descendState(r.state, f2, seedAllStreams(123, 2));
    expect(s2.floor).toBe(2);
    expect(s2.status).toBe(Status.ALIVE);
    expect(s2.wax).toBe(wax);
    expect(s2.tick).toBe(r.state.tick);
    expect(s2.px).toBe(f2.px);
  });

  test("fx scrambling never changes validated hashes over a full run", () => {
    const fd = floorFromAscii(["########", "#@..d..#", "#....u.#", "########"]);
    const script = [
      Action.MOVE_E, Action.MOVE_E, Action.MOVE_E, Action.WAIT, Action.CUP,
      Action.MOVE_E, Action.CUP, Action.MOVE_S, Action.INTERACT_E, Action.WAIT,
      Action.SNUFF, Action.SNUFF, Action.MOVE_W, Action.RELIGHT, Action.RELIGHT,
      Action.RELIGHT, Action.MOVE_W, Action.CHALK_MARK, Action.SALT_E, Action.WAIT,
    ];
    const a = makeState(fd);
    const b = makeState(fd);
    b.rng[16] = 0xdeadbeef;
    b.rng[17] = 1;
    b.rng[18] = 2;
    b.rng[19] = 3;
    const ra = runActions(a, script);
    const rb = runActions(b, script);
    expect(hashState(ra)).toBe(hashState(rb));
  });

  test("identical replays produce identical hashes (module purity)", () => {
    const fd = floorFromAscii(["########", "#@..d..#", "#..m.u.#", "########"], [
      ent(1, EntityKind.RAT, 6, 1),
    ]);
    const script = [
      Action.MOVE_E, Action.MOVE_E, Action.WAIT, Action.MOVE_E, Action.MOVE_E,
      Action.MOVE_E, Action.WAIT, Action.WAIT, Action.MOVE_W, Action.CHALK_MARK,
    ];
    const rules1 = stubRules({ "rat|bump|self|lit": Effect.DIE, "rat|fire|self|-": Effect.DIE });
    const rules2 = stubRules({ "rat|bump|self|lit": Effect.DIE, "rat|fire|self|-": Effect.DIE });
    const ra = runActions(makeState(fd), script, rules1);
    const rb = runActions(makeState(fd), script, rules2);
    expect(hashState(ra)).toBe(hashState(rb));
    expect(Array.from(ra.seen)).toEqual(Array.from(rb.seen));
  });
});
