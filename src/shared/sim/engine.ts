/**
 * tick(state, action, rules) → TickResult | RuleRequest — pure, integer-only.
 * One world tick per player action ("time moves when you move", 01 §5).
 *
 * FROZEN tick order (changing it = determinism break = regenerate goldens):
 *   0  dead-state guard (no tick advance)
 *   1  clone
 *   2  tick + 1
 *   3  channel cancel (non-channel verb while snuff/relight in progress)
 *   4  apply verb (invalid verbs DEMOTE TO WAIT — tick 4 of DECISIONS 13)
 *   5  wax burn (snuffed = frozen; brazier aura zeroes cost-1 only)
 *   6  effective radius (tier − cupping − orbiting moths)
 *   7  AI pass (may abort on unknown rule)
 *   8  fire pass (damage → spread → decay; may abort)
 *   9  brazier aura pass (melt checks; may abort)
 *  10  Dark Grace bookkeeping (rescue / pause / decrement / death)
 *  11  tier event, FOV, seen |= visible
 *
 * engine.ts NEVER imports gen/ — (seed, floor) → FloorData composition
 * happens in the harness (dev) or on the server (M2): the client never
 * holds the day seed (02 §4).
 */

import {
  Action,
  Candle,
  DeathCause,
  Ev,
  Item,
  Status,
  STATE_V,
  Tile,
  cloneState,
  isRuleRequest,
  type FloorData,
  type OutcomeEvent,
  type RuleRequest,
  type RuleTable,
  type SimState,
  type TickResult,
} from "./types.js";
import {
  ACTION_COST,
  COST_BASIC,
  DX,
  DY,
  GRACE_TICKS,
  NOISE_INTERACT,
  NOISE_SOFT,
  NOISE_STONE,
  RELIGHT_TICKS,
  SALT_THROW_RANGE,
  SNUFF_TICKS,
  START_INVENTORY,
  START_WAX,
  TIER_THRESHOLDS,
  TILE_FLAGS,
  F_WALK,
} from "./constants.js";
import { computeVisible } from "./fov.js";
import {
  bumpEntity,
  collectWax,
  consumeCharge,
  entityAt,
  ev,
  flameAdjacent,
  firePass,
  hasItem,
  idx,
  inBounds,
  inBrazierAura,
  interactTile,
  aiPass,
  auraPass,
  orbitingMoths,
  walkable,
  type Ctx,
} from "./systems.js";

// ── Light ──────────────────────────────────────────────────────────────────
export function lightRadiusBase(wax: number, candle: number): number {
  if (candle === Candle.SNUFFED) return 0;
  let base = 0;
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    const t = TIER_THRESHOLDS[i]!;
    if (wax >= t[0]) {
      base = t[1];
      break;
    }
  }
  if (candle === Candle.CUPPED) base = base >> 1; // −50%, floor (DECISIONS 10)
  return base;
}

/** Tier − orbiting Vesper Moths (01 §8 #3), clamped ≥ 0. */
export function effectiveRadius(s: SimState): number {
  const base = lightRadiusBase(s.wax, s.candle);
  const drained = base - orbitingMoths(s);
  return drained > 0 ? drained : 0;
}

export function visibleFor(s: SimState): Uint8Array {
  return computeVisible(s, effectiveRadius(s));
}

// ── State construction ─────────────────────────────────────────────────────
export function initState(floorData: FloorData, rngInit: Uint32Array): SimState {
  const n = floorData.w * floorData.h;
  const inv = new Uint8Array(6);
  const invCharges = new Uint8Array(6);
  for (let i = 0; i < START_INVENTORY.length; i++) {
    inv[i] = START_INVENTORY[i]![0];
    invCharges[i] = START_INVENTORY[i]![1];
  }
  const s: SimState = {
    stateV: STATE_V,
    floor: floorData.floor,
    tick: 0,
    w: floorData.w,
    h: floorData.h,
    tiles: floorData.tiles.slice(),
    px: floorData.px,
    py: floorData.py,
    wax: START_WAX,
    candle: Candle.LIT,
    candleTimer: 0,
    candlePending: Candle.LIT,
    graceLeft: 0,
    status: Status.ALIVE,
    deathCause: DeathCause.NONE,
    inv,
    invCharges,
    noiseX: floorData.px,
    noiseY: floorData.py,
    noiseLevel: 0,
    entities: floorData.entities.map((e) => ({ ...e })),
    nextEntityId: floorData.nextEntityId,
    salt: new Uint8Array(n),
    chalk: new Uint8Array(n),
    fire: new Uint8Array(n),
    seen: new Uint8Array(n),
    rng: rngInit.slice(),
  };
  markSeen(s);
  return s;
}

/** Floor transition. Carries the delver (wax/candle/grace/inventory), resets
 *  per-floor world state, swaps RNG to the new floor's block (independent
 *  per-floor generation — 02 §4). */
export function descendState(s: SimState, floorData: FloorData, rngInit: Uint32Array): SimState {
  if (s.status !== Status.DESCENDING) throw new Error("descendState: not descending");
  const n = floorData.w * floorData.h;
  const next: SimState = {
    ...cloneState(s),
    floor: floorData.floor,
    w: floorData.w,
    h: floorData.h,
    tiles: floorData.tiles.slice(),
    px: floorData.px,
    py: floorData.py,
    status: Status.ALIVE,
    noiseX: floorData.px,
    noiseY: floorData.py,
    noiseLevel: 0,
    entities: floorData.entities.map((e) => ({ ...e })),
    nextEntityId: floorData.nextEntityId,
    salt: new Uint8Array(n),
    chalk: new Uint8Array(n),
    fire: new Uint8Array(n),
    seen: new Uint8Array(n),
    rng: rngInit.slice(),
  };
  markSeen(next);
  return next;
}

function markSeen(s: SimState): void {
  const vis = visibleFor(s);
  for (let i = 0; i < vis.length; i++) {
    if (vis[i]! === 1) s.seen[i] = 1;
  }
}

// ── The tick ───────────────────────────────────────────────────────────────
export function tick(state: SimState, action: number, rules: RuleTable): TickResult | RuleRequest {
  // 0. Terminal guard: dead/exited states reject without advancing
  if (state.status !== Status.ALIVE) {
    const events: OutcomeEvent[] = [{ tick: state.tick, type: Ev.REJECTED, a: action, b: 0, c: 0 }];
    return { state, events, visible: visibleFor(state) };
  }

  const s = cloneState(state);
  const events: OutcomeEvent[] = [];
  const ctx: Ctx = { s, events, rules };
  s.tick = (s.tick + 1) >>> 0;

  const radiusBefore = effectiveRadius(s);

  // 3. Channel cancel: any verb other than the pending channel verb cancels
  if (s.candleTimer > 0) {
    const continues =
      (action === Action.SNUFF && s.candlePending === Candle.SNUFFED) ||
      (action === Action.RELIGHT && s.candlePending === Candle.LIT);
    if (!continues) {
      s.candleTimer = 0;
      ev(ctx, Ev.CANDLE_CANCEL);
    }
  }

  // 4. Apply verb. `cost` in wax; `noise` feeds the Beast next pass.
  let cost: number = ACTION_COST[action] ?? COST_BASIC;
  let noise = 0;
  let demoted = false;

  const demote = (): void => {
    demoted = true;
    cost = COST_BASIC;
    noise = 0;
    ev(ctx, Ev.REJECTED, action);
  };

  switch (action) {
    case Action.WAIT:
      break;

    case Action.MOVE_N:
    case Action.MOVE_E:
    case Action.MOVE_S:
    case Action.MOVE_W: {
      const d = action - Action.MOVE_N;
      const nx = s.px + DX[d]!;
      const ny = s.py + DY[d]!;
      const target = inBounds(s, nx, ny) ? entityAt(s, nx, ny) : undefined;
      if (target !== undefined) {
        const abort = bumpEntity(ctx, target); // outcome is SECRET
        if (abort !== null) return { needRule: abort };
        noise = NOISE_INTERACT;
      } else if (walkable(s, nx, ny)) {
        s.px = nx;
        s.py = ny;
        ev(ctx, Ev.MOVED, nx, ny);
        collectWax(ctx);
        const t = s.tiles[idx(s, nx, ny)]!;
        noise = t === Tile.MOSS || t === Tile.WEBBING ? NOISE_SOFT : NOISE_STONE;
      } else {
        ev(ctx, Ev.BLOCKED, nx, ny);
      }
      break;
    }

    case Action.INTERACT_N:
    case Action.INTERACT_E:
    case Action.INTERACT_S:
    case Action.INTERACT_W: {
      const d = action - Action.INTERACT_N;
      const nx = s.px + DX[d]!;
      const ny = s.py + DY[d]!;
      const target = inBounds(s, nx, ny) ? entityAt(s, nx, ny) : undefined;
      if (target !== undefined) {
        const abort = bumpEntity(ctx, target);
        if (abort !== null) return { needRule: abort };
        noise = NOISE_INTERACT;
      } else {
        const out = interactTile(ctx, nx, ny);
        if (out === "invalid") {
          demote();
        } else {
          cost = out.cost;
          noise = NOISE_INTERACT;
          if (out.exited) s.status = Status.EXITED;
        }
      }
      break;
    }

    case Action.CUP: {
      if (s.candle === Candle.LIT) s.candle = Candle.CUPPED;
      else if (s.candle === Candle.CUPPED) s.candle = Candle.LIT;
      else {
        demote();
        break;
      }
      ev(ctx, Ev.CANDLE_STATE, s.candle);
      break;
    }

    case Action.SNUFF: {
      if (s.candle === Candle.SNUFFED) {
        demote();
        break;
      }
      if (s.candleTimer === 0) {
        s.candleTimer = SNUFF_TICKS;
        s.candlePending = Candle.SNUFFED;
      }
      s.candleTimer--;
      if (s.candleTimer === 0) {
        s.candle = Candle.SNUFFED;
        ev(ctx, Ev.CANDLE_STATE, s.candle);
      }
      break; // snuff-channel ticks still burn 1 (candle alight until done)
    }

    case Action.RELIGHT: {
      const canRelight =
        s.candle === Candle.SNUFFED &&
        s.wax > 0 &&
        (hasItem(s, Item.FLINT) || flameAdjacent(s, s.px, s.py));
      if (!canRelight) {
        demote();
        break;
      }
      if (s.candleTimer === 0) {
        s.candleTimer = RELIGHT_TICKS;
        s.candlePending = Candle.LIT;
      }
      s.candleTimer--;
      if (s.candleTimer === 0) {
        s.candle = Candle.LIT;
        ev(ctx, Ev.CANDLE_STATE, s.candle);
      }
      break;
    }

    case Action.SALT_N:
    case Action.SALT_E:
    case Action.SALT_S:
    case Action.SALT_W: {
      const d = action - Action.SALT_N;
      if (!hasItem(s, Item.SALT)) {
        demote();
        break;
      }
      let placed = false;
      for (let r = 1; r <= SALT_THROW_RANGE; r++) {
        const nx = s.px + DX[d]! * r;
        const ny = s.py + DY[d]! * r;
        if (!inBounds(s, nx, ny)) break;
        const i = idx(s, nx, ny);
        if ((TILE_FLAGS[s.tiles[i]!]! & F_WALK) === 0) break; // wall/brazier stops the throw
        if (entityAt(s, nx, ny) !== undefined) break; // bounces off a body
        if (s.salt[i]! === 0) {
          s.salt[i] = 1;
          consumeCharge(s, Item.SALT);
          ev(ctx, Ev.SALT_PLACED, nx, ny);
          placed = true;
          noise = NOISE_SOFT;
          break;
        }
      }
      if (!placed) demote();
      break;
    }

    case Action.CHALK_MARK: {
      const i = idx(s, s.px, s.py);
      if (!hasItem(s, Item.CHALK) || s.chalk[i]! !== 0) {
        demote();
        break;
      }
      s.chalk[i] = 1;
      consumeCharge(s, Item.CHALK);
      ev(ctx, Ev.CHALK_MARKED, s.px, s.py);
      break;
    }

    case Action.DESCEND: {
      if (s.tiles[idx(s, s.px, s.py)] !== Tile.STAIRS_DOWN) {
        demote();
        break;
      }
      s.status = Status.DESCENDING;
      ev(ctx, Ev.DESCENDED, s.floor + 1);
      noise = NOISE_STONE;
      break;
    }

    default:
      demote();
  }
  void demoted;

  // 4b. Sound: the last noise event feeds the (blind) Beast this same tick
  if (noise > 0) {
    s.noiseX = s.px;
    s.noiseY = s.py;
    s.noiseLevel = noise;
  } else {
    s.noiseLevel = 0;
  }

  // 5. Wax burn: snuffed = frozen; brazier aura pauses base burn only
  let burn = cost;
  if (s.candle === Candle.SNUFFED && action !== Action.SNUFF) burn = 0;
  else if (burn === COST_BASIC && inBrazierAura(s, s.px, s.py)) burn = 0;
  if (burn > 0) s.wax = s.wax > burn ? s.wax - burn : 0;

  // 6–9. World passes — skipped if the delver left the floor this tick
  if (s.status === Status.ALIVE) {
    const effR = effectiveRadius(s);
    let abort = aiPass(ctx, effR);
    if (abort !== null) return { needRule: abort };
    abort = firePass(ctx);
    if (abort !== null) return { needRule: abort };
    abort = auraPass(ctx);
    if (abort !== null) return { needRule: abort };
  }

  // 10. Dark Grace (01 §5): 25 ticks of blindness to reach flame or exit
  if (s.status === Status.ALIVE || s.status === Status.DESCENDING) {
    if (s.graceLeft > 0) {
      if (s.wax > 0) {
        // rescued by a pickup — the flame catches again (DECISIONS 9)
        s.graceLeft = 0;
        s.candle = Candle.LIT;
        s.candleTimer = 0;
        ev(ctx, Ev.CANDLE_STATE, s.candle);
      } else if (inBrazierAura(s, s.px, s.py)) {
        ev(ctx, Ev.GRACE_PAUSED); // reached flame — countdown holds
      } else {
        s.graceLeft--;
        if (s.graceLeft === 0) {
          s.status = Status.DEAD;
          s.deathCause = DeathCause.TAKEN_BY_THE_DARK;
          ev(ctx, Ev.DIED, s.deathCause);
        }
      }
    } else if (s.wax === 0 && s.candle !== Candle.SNUFFED && s.status !== Status.DESCENDING) {
      s.graceLeft = GRACE_TICKS;
      ev(ctx, Ev.GRACE_STARTED);
    }
  }

  // 11. Tier event + FOV + memory
  const radiusAfter = s.status === Status.DEAD ? 0 : effectiveRadius(s);
  if (radiusAfter !== radiusBefore) ev(ctx, Ev.TIER_CHANGED, radiusAfter);
  const visible = visibleFor(s);
  for (let i = 0; i < visible.length; i++) {
    if (visible[i]! === 1) s.seen[i] = 1;
  }

  return { state: s, events, visible };
}

/**
 * tick() with rule resolution: on a RuleRequest, ask `resolve` (dev adapter /
 * server), memoize into `table`, retry. Deterministic given the same rules
 * source — the server replays with the full table and takes the same path.
 */
export function tickResolving(
  state: SimState,
  action: number,
  table: import("./types.js").MutableRuleTable,
  resolve: (key: string) => number,
): TickResult {
  for (let guard = 0; guard < 32; guard++) {
    const r = tick(state, action, table);
    if (!isRuleRequest(r)) return r;
    table.set(r.needRule, resolve(r.needRule));
  }
  throw new Error("tickResolving: rule resolution did not converge");
}

export { isRuleRequest };
