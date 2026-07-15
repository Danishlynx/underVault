/**
 * tick(state, step, rules) → TickResult | RuleRequest — pure, integer-only.
 * v2: argumented verbs (USE/SIGN), full door taxonomy, sigil ritual, omen
 * mutations (state.mods), gas/shock passes, the Bottom.
 *
 * FROZEN tick order (changing it = determinism break = regenerate goldens):
 *   0 dead-state guard · 1 clone · 2 tick+1 · 3 channel cancel + ritual
 *   reset · 4 apply verb (invalid → WAIT demotion) · 4b noise · 5 burn
 *   (mods.burnBasic; aura pauses; snuffed frozen except completing snuff) ·
 *   6 effective radius · 7 AI · 8 fire · 9 gas · 10 shock · 11 aura ·
 *   12 Dark Grace (mods.graceTicks) · 13 tier event + FOV + seen.
 *
 * engine.ts NEVER imports gen/ — (seed, floor) → FloorData composition
 * happens behind the ports (dev adapter / M2 server).
 */

import {
  Action,
  Candle,
  DeathCause,
  DEFAULT_MODS,
  EntityKind,
  Ev,
  Item,
  Status,
  STATE_V,
  Tile,
  cloneState,
  isRuleRequest,
  type FloorData,
  type OmenMods,
  type OutcomeEvent,
  type RuleRequest,
  type RuleTable,
  type SimState,
  type Step,
  type TickResult,
} from "./types.js";
import {
  ACTION_COST,
  BELL_THROW_RANGE,
  COST_BASIC,
  DX,
  DY,
  MAX_FLOOR,
  NOISE_BELL,
  BELL_PEAL_TICKS,
  NOISE_INTERACT,
  NOISE_SOFT,
  NOISE_STONE,
  RELIGHT_TICKS,
  SALT_THROW_RANGE,
  SIGIL_WAITS,
  SIGNS_PER_RUN,
  SNUFF_TICKS,
  START_INVENTORY,
  START_WAX,
  TIER_THRESHOLDS,
  TILE_FLAGS,
  WAX_MAX,
  F_WALK,
} from "./constants.js";
import { computeVisible } from "./fov.js";
import {
  aiPass,
  auraPass,
  bumpEntity,
  collectGround,
  consumeCharge,
  entityAt,
  ev,
  firePass,
  flameAdjacent,
  gasPass,
  hasItem,
  idx,
  inBounds,
  inBrazierAura,
  interactTile,
  orbitingMoths,
  pickpocket,
  shockPass,
  walkable,
  type Ctx,
} from "./systems.js";
import { Heirloom } from "./types.js";

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
  if (candle === Candle.CUPPED) {
    // −50% floored, but never fully blind while the flame exists (⚖ D58:
    // cupping at 1–49 wax previously gave radius 0 with zero feedback —
    // players read total blackness-while-lit as a bug, not sneaking)
    const halved = base >> 1;
    base = base > 0 && halved === 0 ? 1 : halved;
  }
  return base;
}

export function effectiveRadius(s: SimState): number {
  if (s.candle === Candle.SNUFFED) {
    return s.heirloom === Heirloom.SMOKED_GLASS ? 1 : 0; // 01 §9 heirloom
  }
  const base = lightRadiusBase(s.wax, s.candle) - s.mods.radiusPenalty - orbitingMoths(s);
  return base > 0 ? base : 0;
}

export function visibleFor(s: SimState): Uint8Array {
  return computeVisible(s, effectiveRadius(s));
}

// ── State construction ─────────────────────────────────────────────────────
export interface InitOptions {
  mods?: OmenMods;
  heirloom?: number;
  noSalt?: boolean; // the Saltless sky (omen — the sim doesn't know why)
}

export function initState(floorData: FloorData, rngInit: Uint32Array, opts?: InitOptions): SimState {
  const n = floorData.w * floorData.h;
  const inv = new Uint8Array(6);
  const invCharges = new Uint8Array(6);
  let slot = 0;
  for (let i = 0; i < START_INVENTORY.length; i++) {
    if (opts?.noSalt === true && START_INVENTORY[i]![0] === Item.SALT) continue;
    inv[slot] = START_INVENTORY[i]![0];
    invCharges[slot] = START_INVENTORY[i]![1];
    slot++;
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
    heirloom: opts?.heirloom ?? 0,
    noiseX: floorData.px,
    noiseY: floorData.py,
    noiseLevel: 0,
    alertTicks: 0,
    ritualTile: -1,
    ritualCount: 0,
    signsLeft: SIGNS_PER_RUN,
    banked: 0,
    mods: { ...(opts?.mods ?? DEFAULT_MODS) },
    entities: floorData.entities.map((e) => ({ ...e })),
    nextEntityId: floorData.nextEntityId,
    salt: new Uint8Array(n),
    chalk: floorData.chalk !== undefined ? floorData.chalk.slice() : new Uint8Array(n),
    fire: new Uint8Array(n),
    gas: new Uint8Array(n),
    signs: floorData.signs !== undefined ? floorData.signs.slice() : new Uint8Array(n),
    seen: new Uint8Array(n),
    rng: rngInit.slice(),
  };
  markSeen(s);
  return s;
}

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
    alertTicks: 0,
    ritualTile: -1,
    ritualCount: 0,
    entities: floorData.entities.map((e) => ({ ...e })),
    nextEntityId: floorData.nextEntityId,
    salt: new Uint8Array(n),
    chalk: floorData.chalk !== undefined ? floorData.chalk.slice() : new Uint8Array(n),
    fire: new Uint8Array(n),
    gas: new Uint8Array(n),
    signs: floorData.signs !== undefined ? floorData.signs.slice() : new Uint8Array(n),
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
export function tick(state: SimState, step: Step, rules: RuleTable): TickResult | RuleRequest {
  if (state.status !== Status.ALIVE) {
    const events: OutcomeEvent[] = [{ tick: state.tick, type: Ev.REJECTED, a: step.op, b: 0, c: 0 }];
    return { state, events, visible: visibleFor(state) };
  }

  const s = cloneState(state);
  const events: OutcomeEvent[] = [];
  const ctx: Ctx = { s, events, rules };
  s.tick = (s.tick + 1) >>> 0;
  const action = step.op;
  const radiusBefore = effectiveRadius(s);

  // 3. channel cancel + sigil-ritual reset on any non-WAIT verb
  if (s.candleTimer > 0) {
    const continues =
      (action === Action.SNUFF && s.candlePending === Candle.SNUFFED) ||
      (action === Action.RELIGHT && s.candlePending === Candle.LIT);
    if (!continues) {
      s.candleTimer = 0;
      ev(ctx, Ev.CANDLE_CANCEL);
    }
  }
  if (action !== Action.WAIT && s.ritualCount > 0) {
    s.ritualCount = 0;
    s.ritualTile = -1;
  }

  // 4. apply verb
  let cost: number = ACTION_COST[action] ?? COST_BASIC;
  let noise = 0;
  let lastMoveDir = -1;
  let snuffCompleted = false;

  const demote = (): void => {
    cost = COST_BASIC;
    noise = 0;
    ev(ctx, Ev.REJECTED, action);
  };

  const MOVE_BUMPABLE = new Set<number>(); // set OK: never iterated
  MOVE_BUMPABLE.add(Tile.DOOR_CLOSED).add(Tile.DOOR_STUCK).add(Tile.DOOR_IRON)
    .add(Tile.DOOR_HUNGER).add(Tile.DOOR_CHOIR).add(Tile.DOOR_SIGIL)
    .add(Tile.CHEST).add(Tile.POOL).add(Tile.FONT).add(Tile.SEAL);

  const doInteract = (nx: number, ny: number): string | null => {
    const out = interactTile(ctx, nx, ny);
    if (out === "invalid") {
      demote();
      return null;
    }
    if (typeof out === "string") return out; // missing rule
    cost = out.cost;
    noise = NOISE_INTERACT;
    if (out.exited) s.status = Status.EXITED;
    if (out.victory) s.status = Status.VICTORY;
    return null;
  };

  switch (action) {
    case Action.WAIT: {
      // offering darkness to a Sigil door (01 §10): snuff + wait 3
      if (s.candle === Candle.SNUFFED) {
        let sigil = -1;
        for (let d = 0; d < 4; d++) {
          const nx = s.px + DX[d]!;
          const ny = s.py + DY[d]!;
          if (inBounds(s, nx, ny) && s.tiles[idx(s, nx, ny)] === Tile.DOOR_SIGIL) {
            sigil = idx(s, nx, ny);
            break;
          }
        }
        if (sigil >= 0) {
          if (s.ritualTile !== sigil) {
            s.ritualTile = sigil;
            s.ritualCount = 0;
          }
          s.ritualCount++;
          ev(ctx, Ev.RITUAL_TICK, s.ritualCount);
          if (s.ritualCount >= SIGIL_WAITS) {
            s.tiles[sigil] = Tile.DOOR_OPEN;
            s.ritualTile = -1;
            s.ritualCount = 0;
            ev(ctx, Ev.DOOR_SIGIL_OPEN);
          }
        } else {
          s.ritualCount = 0;
          s.ritualTile = -1;
        }
      }
      break;
    }

    case Action.MOVE_N:
    case Action.MOVE_E:
    case Action.MOVE_S:
    case Action.MOVE_W: {
      const d = action - Action.MOVE_N;
      const nx = s.px + DX[d]!;
      const ny = s.py + DY[d]!;
      const target = inBounds(s, nx, ny) ? entityAt(s, nx, ny) : undefined;
      const targetTile = inBounds(s, nx, ny) ? s.tiles[idx(s, nx, ny)]! : Tile.VOID;
      if (target !== undefined) {
        const abort = bumpEntity(ctx, target);
        if (abort !== null) return { needRule: abort };
        noise = NOISE_INTERACT;
      } else if (walkable(s, nx, ny)) {
        s.px = nx;
        s.py = ny;
        lastMoveDir = d;
        ev(ctx, Ev.MOVED, nx, ny);
        collectGround(ctx);
        const t = s.tiles[idx(s, nx, ny)]!;
        noise = t === Tile.MOSS || t === Tile.WEBBING || t === Tile.GLOWMOSS ? NOISE_SOFT : NOISE_STONE;
        if (s.tiles[idx(s, nx, ny)] === Tile.PLATE) ev(ctx, Ev.PLATE_PRESSED, nx, ny);
      } else if (MOVE_BUMPABLE.has(targetTile)) {
        const abort = doInteract(nx, ny);
        if (abort !== null) return { needRule: abort };
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
        // a snuffed hand near the Keeper reaches for his keys (01 §8 #14)
        const abort =
          target.kind === EntityKind.KEEPER && s.candle === Candle.SNUFFED
            ? pickpocket(ctx, target)
            : bumpEntity(ctx, target);
        if (abort !== null) return { needRule: abort };
        noise = NOISE_INTERACT;
      } else {
        const abort = doInteract(nx, ny);
        if (abort !== null) return { needRule: abort };
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
        snuffCompleted = true;
        ev(ctx, Ev.CANDLE_STATE, s.candle);
      }
      break;
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
      if (!throwSalt(ctx, d)) demote();
      else noise = NOISE_SOFT;
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

    case Action.USE: {
      const slot = (step.arg >> 2) & 7;
      const dir = step.arg & 3;
      const item = slot < 6 ? s.inv[slot]! : Item.NONE;
      const charges = slot < 6 ? s.invCharges[slot]! : 0;
      if (item === Item.NONE || charges === 0) {
        demote();
        break;
      }
      switch (item) {
        case Item.SALT:
          if (!throwSalt(ctx, dir)) demote();
          else noise = NOISE_SOFT;
          break;
        case Item.BELL: {
          // a thrown voice: the dark chases the sound, not you (01 §9)
          let lx = s.px;
          let ly = s.py;
          for (let r = 1; r <= BELL_THROW_RANGE; r++) {
            const nx = s.px + DX[dir]! * r;
            const ny = s.py + DY[dir]! * r;
            if (!inBounds(s, nx, ny) || (TILE_FLAGS[s.tiles[idx(s, nx, ny)]!]! & F_WALK) === 0) break;
            lx = nx;
            ly = ny;
          }
          s.noiseX = lx;
          s.noiseY = ly;
          // planted ABOVE NOISE_BELL: levels > NOISE_BELL mark the decoy,
          // which fades one step per tick and shrugs off quieter sounds
          s.noiseLevel = NOISE_BELL + BELL_PEAL_TICKS;
          consumeCharge(s, Item.BELL);
          ev(ctx, Ev.ITEM_USED, Item.BELL);
          // a Choir door adjacent to the peal swings open (01 §10)
          for (let d = 0; d < 4; d++) {
            const nx = lx + DX[d]!;
            const ny = ly + DY[d]!;
            if (inBounds(s, nx, ny) && s.tiles[idx(s, nx, ny)] === Tile.DOOR_CHOIR) {
              s.tiles[idx(s, nx, ny)] = Tile.DOOR_OPEN;
              ev(ctx, Ev.DOOR_OPENED, nx, ny);
            }
          }
          break;
        }
        case Item.MIRROR: {
          // the shard shows fangs in the reflection (01 §8 #5)
          let shown = 0;
          for (let i = 0; i < s.entities.length; i++) {
            const e = s.entities[i]!;
            if (e.kind === EntityKind.MIMIC && e.state === 0) {
              const dd = Math.abs(e.x - s.px) + Math.abs(e.y - s.py);
              if (dd <= 6) {
                e.state = 1; // GROWLED — marked as suspicious
                ev(ctx, Ev.MIMIC_REVEAL, e.id);
                shown++;
              }
            }
          }
          ev(ctx, Ev.ITEM_USED, Item.MIRROR, shown);
          break;
        }
        case Item.GLOWVIAL: {
          const i = idx(s, s.px, s.py);
          if (s.tiles[i] !== Tile.FLOOR && s.tiles[i] !== Tile.MOSS) {
            demote();
            break;
          }
          s.tiles[i] = Tile.GLOWMOSS;
          consumeCharge(s, Item.GLOWVIAL);
          ev(ctx, Ev.ITEM_USED, Item.GLOWVIAL);
          break;
        }
        case Item.DOUSE: {
          if (s.candle === Candle.SNUFFED) {
            demote();
            break;
          }
          s.candle = Candle.SNUFFED;
          s.candleTimer = 0;
          cost = 0; // instant, free (01 §9)
          consumeCharge(s, Item.DOUSE);
          ev(ctx, Ev.CANDLE_STATE, s.candle);
          ev(ctx, Ev.ITEM_USED, Item.DOUSE);
          break;
        }
        case Item.WSHARD: {
          // the charge burns when the commitment lands (Action.BANK), not
          // when the shard is raised — cancelling the sheet costs nothing
          ev(ctx, Ev.ITEM_USED, Item.WSHARD);
          ev(ctx, Ev.WAYSTONE_TOUCHED, s.px, s.py); // the Vault listens remotely
          break;
        }
        case Item.ROPE: {
          // Coil of Rope: an alternate stair. Reaches DESCENDING from any
          // floor but the Bottom, reusing the exact stairs transition so the
          // existing descend flow runs unchanged. Single-use (dir ignored).
          if (s.floor >= MAX_FLOOR) {
            demote(); // the Bottom has nowhere below it
            break;
          }
          consumeCharge(s, Item.ROPE);
          s.status = Status.DESCENDING;
          ev(ctx, Ev.ITEM_USED, Item.ROPE);
          ev(ctx, Ev.DESCENDED, s.floor + 1); // same event the stairs emit
          noise = NOISE_STONE;
          break;
        }
        case Item.WAXCAKE: {
          // Tallow Cake: pour +100 wax back into the candle, up to the fill
          // line. At/over the cap it stays in the pack — no waste. The USE
          // tick is free (cost 0) so the restore is exactly +100 to the cap.
          if (s.wax >= WAX_MAX) {
            demote();
            break;
          }
          const before = s.wax;
          s.wax = s.wax + 100 > WAX_MAX ? WAX_MAX : s.wax + 100;
          cost = 0;
          consumeCharge(s, Item.WAXCAKE);
          ev(ctx, Ev.WAX_GAINED, s.wax - before);
          ev(ctx, Ev.ITEM_USED, Item.WAXCAKE);
          break;
        }
        case Item.BONEKEY: {
          // Bone Key: opens an adjacent iron door exactly as the iron key
          // does (→ DOOR_OPEN, DOOR_OPENED), but it is reusable (charge NOT
          // consumed) and silent (no NOISE_INTERACT — noise stays 0).
          const nx = s.px + DX[dir]!;
          const ny = s.py + DY[dir]!;
          if (!inBounds(s, nx, ny) || s.tiles[idx(s, nx, ny)] !== Tile.DOOR_IRON) {
            demote(); // only a locked iron door yields to it
            break;
          }
          s.tiles[idx(s, nx, ny)] = Tile.DOOR_OPEN;
          ev(ctx, Ev.DOOR_OPENED, nx, ny);
          break;
        }
        default:
          demote();
      }
      break;
    }

    case Action.BANK: {
      // waystone commitment: the sim only tracks the COUNT (the Seal reads
      // it); which claims went into the Codex is the server/adapter's book.
      // Touching the stone happens from an adjacent tile, so BANK accepts
      // on-or-beside; away from any stone a waystone-shard charge pays
      let nearStone = s.tiles[idx(s, s.px, s.py)] === Tile.WAYSTONE;
      for (let d = 0; d < 4 && !nearStone; d++) {
        const nx = s.px + DX[d]!;
        const ny = s.py + DY[d]!;
        if (inBounds(s, nx, ny) && s.tiles[idx(s, nx, ny)] === Tile.WAYSTONE) nearStone = true;
      }
      const count = step.arg & 3;
      if (count === 0 || (!nearStone && !consumeCharge(s, Item.WSHARD))) {
        demote();
        break;
      }
      s.banked += count > 3 ? 3 : count;
      cost = 0;
      ev(ctx, Ev.BANKED, count);
      break;
    }

    case Action.SIGN: {
      const i = idx(s, s.px, s.py);
      if (s.signsLeft === 0 || s.signs[i]! !== 0 || (TILE_FLAGS[s.tiles[i]!]! & F_WALK) === 0) {
        demote();
        break;
      }
      s.signs[i] = 1;
      s.signsLeft--;
      ev(ctx, Ev.SIGN_PLACED, (step.arg >> 5) & 7, step.arg & 31);
      break;
    }

    default:
      demote();
  }

  // 4b. sound
  if (s.mods.quietFeet === 1 && action >= Action.MOVE_N && action <= Action.MOVE_W) noise = 0;
  if (s.noiseLevel > NOISE_BELL) {
    // an echoing decoy peal: holds its ground, fades one step a tick,
    // and only a louder sound can claim the dark's attention
    if (noise > s.noiseLevel) {
      s.noiseX = s.px;
      s.noiseY = s.py;
      s.noiseLevel = noise;
    } else {
      s.noiseLevel = s.noiseLevel - 1;
    }
  } else if (noise > 0) {
    s.noiseX = s.px;
    s.noiseY = s.py;
    s.noiseLevel = noise;
  } else {
    s.noiseLevel = 0;
  }

  // 5. burn
  let burn = cost;
  if (s.candle === Candle.SNUFFED && !snuffCompleted) burn = 0;
  else if (burn === COST_BASIC) {
    burn = inBrazierAura(s, s.px, s.py) ? 0 : s.mods.burnBasic;
  }
  if (burn > 0) s.wax = s.wax > burn ? s.wax - burn : 0;

  // 6–11. world passes
  if (s.status === Status.ALIVE) {
    const effR = effectiveRadius(s);
    let abort = aiPass(ctx, effR, lastMoveDir);
    if (abort !== null) return { needRule: abort };
    abort = firePass(ctx);
    if (abort !== null) return { needRule: abort };
    abort = gasPass(ctx);
    if (abort !== null) return { needRule: abort };
    abort = shockPass(ctx);
    if (abort !== null) return { needRule: abort };
    abort = auraPass(ctx);
    if (abort !== null) return { needRule: abort };
  }

  // 12. Dark Grace
  if (s.status === Status.ALIVE || s.status === Status.DESCENDING) {
    if (s.graceLeft > 0) {
      if (s.wax > 0) {
        s.graceLeft = 0;
        s.candle = Candle.LIT;
        s.candleTimer = 0;
        ev(ctx, Ev.CANDLE_STATE, s.candle);
      } else if (inBrazierAura(s, s.px, s.py)) {
        ev(ctx, Ev.GRACE_PAUSED);
      } else {
        s.graceLeft--;
        if (s.graceLeft === 0) {
          s.status = Status.DEAD;
          s.deathCause = DeathCause.TAKEN_BY_THE_DARK;
          ev(ctx, Ev.DIED, s.deathCause);
        }
      }
    } else if (s.wax === 0 && s.status !== Status.DESCENDING) {
      s.graceLeft = s.mods.graceTicks;
      ev(ctx, Ev.GRACE_STARTED);
    }
  }

  // 13. tier + FOV + memory
  const radiusAfter = s.status === Status.DEAD ? 0 : effectiveRadius(s);
  if (radiusAfter !== radiusBefore) ev(ctx, Ev.TIER_CHANGED, radiusAfter);
  const visible = visibleFor(s);
  for (let i = 0; i < visible.length; i++) {
    if (visible[i]! === 1) s.seen[i] = 1;
  }

  return { state: s, events, visible };
}

function throwSalt(ctx: Ctx, dir: number): boolean {
  const s = ctx.s;
  if (!hasItem(s, Item.SALT)) return false;
  for (let r = 1; r <= SALT_THROW_RANGE; r++) {
    const nx = s.px + DX[dir]! * r;
    const ny = s.py + DY[dir]! * r;
    if (!inBounds(s, nx, ny)) return false;
    const i = idx(s, nx, ny);
    if ((TILE_FLAGS[s.tiles[i]!]! & F_WALK) === 0) return false;
    if (entityAt(s, nx, ny) !== undefined) return false;
    if (s.salt[i]! === 0) {
      s.salt[i] = 1;
      consumeCharge(s, Item.SALT);
      ev(ctx, Ev.SALT_PLACED, nx, ny);
      return true;
    }
  }
  return false;
}

/** tick() with rule resolution (dev adapter / server). */
export function tickResolving(
  state: SimState,
  step: Step,
  table: import("./types.js").MutableRuleTable,
  resolve: (key: string) => number,
): TickResult {
  for (let guard = 0; guard < 64; guard++) {
    const r = tick(state, step, table);
    if (!isRuleRequest(r)) return r;
    table.set(r.needRule, resolve(r.needRule));
  }
  throw new Error("tickResolving: rule resolution did not converge");
}

export { isRuleRequest };
