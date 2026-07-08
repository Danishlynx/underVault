/**
 * World systems: tile interactions, monster AI, fire, brazier auras, and the
 * rule-query points where SECRET outcomes (server rules table) are consulted.
 *
 * Convention: any function that may need an unresolved rule returns
 * `string | null` — a non-null return is the rule key the tick is missing;
 * the engine aborts the (cloned) tick and the runner resolves + retries.
 * AI dispositions here are client-visible data (DECISIONS 19); only
 * interaction OUTCOMES are secret.
 */

import {
  Tile,
  Candle,
  EntityKind,
  WormState,
  MothState,
  Effect,
  Ev,
  type Entity,
  type OutcomeEvent,
  type RuleTable,
  type SimState,
} from "./types.js";
import {
  TILE_FLAGS,
  F_WALK,
  BRAZIER_RADIUS,
  FIRE_TICKS,
  FIRE_WAX_DAMAGE,
  COST_BASIC,
  COST_FORCE_DOOR,
  COST_BRAZIER,
  PICKUP_WAX,
  DMG,
  RAT_FLEE_RADIUS,
  RAT_SWARM_RADIUS,
  RAT_WAX_SENSE,
  WORM_HEAT_SENSE,
  WORM_VIBRATION_SENSE,
  WORM_SURFACED_TICKS,
  MOTH_FLAME_SENSE,
  MOTH_SCATTER_TICKS,
  BEAST_MAX_STEP,
  KIND_NAME,
  CANDLE_NAME,
  DX,
  DY,
} from "./constants.js";
import { Stream, rollInt } from "./rng.js";

export interface Ctx {
  s: SimState;
  events: OutcomeEvent[];
  rules: RuleTable;
}

export function ev(ctx: Ctx, type: number, a = 0, b = 0, c = 0): void {
  ctx.events.push({ tick: ctx.s.tick, type, a, b, c });
}

export function ruleKey(subject: string, verb: string, object: string, cond: string): string {
  return `${subject}|${verb}|${object}|${cond}`;
}

/** null = missing (tick must abort and ask the port). */
function lookup(ctx: Ctx, key: string): number | null {
  const eff = ctx.rules.get(key);
  return eff === undefined ? null : eff;
}

// ── Spatial helpers ────────────────────────────────────────────────────────
export function idx(s: SimState, x: number, y: number): number {
  return y * s.w + x;
}
export function inBounds(s: SimState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < s.w && y < s.h;
}
export function walkable(s: SimState, x: number, y: number): boolean {
  return inBounds(s, x, y) && (TILE_FLAGS[s.tiles[idx(s, x, y)]!]! & F_WALK) !== 0;
}
function manh(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax > bx ? ax - bx : bx - ax;
  const dy = ay > by ? ay - by : by - ay;
  return dx + dy;
}
function cheb(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax > bx ? ax - bx : bx - ax;
  const dy = ay > by ? ay - by : by - ay;
  return dx > dy ? dx : dy;
}

function isBurrowed(e: Entity): boolean {
  return e.kind === EntityKind.WICKWORM && e.state === WormState.BURROWED;
}

/** Surface entity at (x,y) — burrowed worms DO block/bump (a solid something
 *  under the dust — deliberate tell). */
export function entityAt(s: SimState, x: number, y: number): Entity | undefined {
  for (let i = 0; i < s.entities.length; i++) {
    const e = s.entities[i]!;
    if (e.x === x && e.y === y) return e;
  }
  return undefined;
}

export function inBrazierAura(s: SimState, x: number, y: number): boolean {
  const r2 = Math.imul(BRAZIER_RADIUS, BRAZIER_RADIUS) + BRAZIER_RADIUS;
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i] !== Tile.BRAZIER_LIT) continue;
    const bx = i % s.w;
    const by = (i / s.w) | 0; // non-negative int division
    const dx = bx - x;
    const dy = by - y;
    if (Math.imul(dx, dx) + Math.imul(dy, dy) <= r2) return true;
  }
  return false;
}

export function flameAdjacent(s: SimState, x: number, y: number): boolean {
  for (let d = 0; d < 4; d++) {
    const nx = x + DX[d]!;
    const ny = y + DY[d]!;
    if (!inBounds(s, nx, ny)) continue;
    const i = idx(s, nx, ny);
    if (s.tiles[i] === Tile.BRAZIER_LIT || s.fire[i]! > 0) return true;
  }
  return false;
}

// ── Inventory ──────────────────────────────────────────────────────────────
export function hasItem(s: SimState, item: number): boolean {
  for (let i = 0; i < 6; i++) {
    if (s.inv[i] === item && s.invCharges[i]! > 0) return true;
  }
  return false;
}
export function consumeCharge(s: SimState, item: number): boolean {
  for (let i = 0; i < 6; i++) {
    if (s.inv[i] === item && s.invCharges[i]! > 0) {
      s.invCharges[i] = s.invCharges[i]! - 1;
      return true;
    }
  }
  return false;
}

// ── Player damage (all damage routes through wax / grace — DECISIONS 8) ────
export const DmgSource = { MONSTER: 0, FIRE: 1, BEAST: 2 } as const;

export function damagePlayer(ctx: Ctx, amount: number, source: number, kind = 0): void {
  const s = ctx.s;
  if (s.status !== 0 /* ALIVE */ || amount <= 0) return;
  if (s.graceLeft > 0) {
    s.graceLeft = s.graceLeft > amount ? s.graceLeft - amount : 0;
    if (s.graceLeft === 0) {
      s.status = 1; // DEAD
      s.deathCause = source === DmgSource.FIRE ? 2 : source === DmgSource.BEAST ? 3 : 1;
      ev(ctx, Ev.DIED, s.deathCause);
    }
  } else {
    s.wax = s.wax > amount ? s.wax - amount : 0;
  }
  if (source === DmgSource.FIRE) ev(ctx, Ev.FIRE_HURT, 0, amount);
  else ev(ctx, Ev.PLAYER_HURT, kind, amount);
}

// ── Fire ───────────────────────────────────────────────────────────────────
export function igniteTile(ctx: Ctx, x: number, y: number): void {
  const s = ctx.s;
  if (!inBounds(s, x, y)) return;
  const i = idx(s, x, y);
  if (s.fire[i]! === 0 && (TILE_FLAGS[s.tiles[i]!]! & F_WALK) !== 0) {
    s.fire[i] = FIRE_TICKS;
    ev(ctx, Ev.FIRE_IGNITED, x, y);
  }
}

// ── Killing & rule-driven effects ──────────────────────────────────────────
function removeEntity(s: SimState, id: number): void {
  for (let i = 0; i < s.entities.length; i++) {
    if (s.entities[i]!.id === id) {
      s.entities.splice(i, 1);
      return;
    }
  }
}

export function killEntity(ctx: Ctx, e: Entity, melted: boolean): string | null {
  const s = ctx.s;
  removeEntity(s, e.id);
  ev(ctx, melted ? Ev.MONSTER_MELTED : Ev.MONSTER_DIED, e.id, e.kind);
  // Secret: dying over webbing may ignite it (01 §8 #3 L2)
  if (s.tiles[idx(s, e.x, e.y)] === Tile.WEBBING) {
    const key = ruleKey(KIND_NAME[e.kind]!, "dies-over", "webbing", "-");
    const eff = lookup(ctx, key);
    if (eff === null) return key;
    if (eff === Effect.IGNITE_TILE) igniteTile(ctx, e.x, e.y);
  }
  return null;
}

function applyEffect(ctx: Ctx, e: Entity, eff: number): string | null {
  switch (eff) {
    case Effect.DIE:
      return killEntity(ctx, e, false);
    case Effect.IGNITE_DIE: {
      igniteTile(ctx, e.x, e.y);
      return killEntity(ctx, e, false);
    }
    case Effect.MELT:
      return killEntity(ctx, e, true);
    case Effect.IMMUNE:
      ev(ctx, Ev.MONSTER_IMMUNE, e.id, e.kind);
      return null;
    case Effect.IGNITE_TILE:
      igniteTile(ctx, e.x, e.y);
      return null;
    default:
      ev(ctx, Ev.BUMP, e.id, e.kind);
      return null;
  }
}

/** Player bumps a monster (move/interact into its tile). Outcome is SECRET. */
export function bumpEntity(ctx: Ctx, e: Entity): string | null {
  const key = ruleKey(KIND_NAME[e.kind]!, "bump", "self", CANDLE_NAME[ctx.s.candle]!);
  const eff = lookup(ctx, key);
  if (eff === null) return key;
  ev(ctx, Ev.RULE_LEARNED, eff);
  return applyEffect(ctx, e, eff);
}

// ── Tile interaction (known mechanics — not secret) ────────────────────────
export interface InteractOutcome {
  cost: number;
  exited: boolean;
}

export function interactTile(ctx: Ctx, x: number, y: number): InteractOutcome | "invalid" {
  const s = ctx.s;
  if (!inBounds(s, x, y)) return "invalid";
  const i = idx(s, x, y);
  switch (s.tiles[i]!) {
    case Tile.DOOR_CLOSED:
      s.tiles[i] = Tile.DOOR_OPEN;
      ev(ctx, Ev.DOOR_OPENED, x, y);
      return { cost: COST_BASIC, exited: false };
    case Tile.DOOR_STUCK:
      s.tiles[i] = Tile.DOOR_OPEN;
      ev(ctx, Ev.DOOR_FORCED, x, y);
      return { cost: COST_FORCE_DOOR, exited: false };
    case Tile.BRAZIER_UNLIT:
      if (s.candle === Candle.SNUFFED || s.wax < COST_BRAZIER) return "invalid";
      s.tiles[i] = Tile.BRAZIER_LIT;
      ev(ctx, Ev.BRAZIER_LIT, x, y);
      return { cost: COST_BRAZIER, exited: false };
    case Tile.WAYSTONE:
      ev(ctx, Ev.WAYSTONE_TOUCHED, x, y);
      return { cost: COST_BASIC, exited: false };
    case Tile.STAIRS_DOWN:
      ev(ctx, Ev.STAIRS_TOUCHED, x, y);
      return { cost: COST_BASIC, exited: false };
    case Tile.ENTRY:
      ev(ctx, Ev.EXITED);
      return { cost: COST_BASIC, exited: true };
    default:
      return "invalid";
  }
}

/** Auto-collect wax pickups on the tile the player just entered. */
export function collectWax(ctx: Ctx): void {
  const s = ctx.s;
  const i = idx(s, s.px, s.py);
  const gain = PICKUP_WAX[s.tiles[i]!];
  if (gain !== undefined) {
    s.wax += gain;
    s.tiles[i] = Tile.FLOOR;
    ev(ctx, Ev.WAX_GAINED, gain);
  }
}

// ── Monster movement helpers ───────────────────────────────────────────────
function canEnter(s: SimState, e: Entity, x: number, y: number, ignoreSalt: boolean, ignoreFire: boolean): boolean {
  if (!walkable(s, x, y)) return false;
  if (x === s.px && y === s.py) return false;
  if (entityAt(s, x, y) !== undefined) return false;
  const i = idx(s, x, y);
  if (!ignoreSalt && s.salt[i]! !== 0) return false;
  if (!ignoreFire && s.fire[i]! > 0) return false;
  return true;
}

/** One greedy step toward (tx,ty). Ties break in fixed N,E,S,W order. */
function stepToward(s: SimState, e: Entity, tx: number, ty: number, ignoreSalt: boolean, ignoreFire: boolean): boolean {
  const d0 = manh(e.x, e.y, tx, ty);
  let bestDir = -1;
  let bestDist = d0;
  for (let d = 0; d < 4; d++) {
    const nx = e.x + DX[d]!;
    const ny = e.y + DY[d]!;
    if (!canEnter(s, e, nx, ny, ignoreSalt, ignoreFire)) continue;
    const nd = manh(nx, ny, tx, ty);
    if (nd < bestDist) {
      bestDist = nd;
      bestDir = d;
    }
  }
  if (bestDir < 0) return false;
  e.x += DX[bestDir]!;
  e.y += DY[bestDir]!;
  return true;
}

function stepAway(s: SimState, e: Entity, tx: number, ty: number, ignoreSalt: boolean): boolean {
  const d0 = manh(e.x, e.y, tx, ty);
  let bestDir = -1;
  let bestDist = d0;
  for (let d = 0; d < 4; d++) {
    const nx = e.x + DX[d]!;
    const ny = e.y + DY[d]!;
    if (!canEnter(s, e, nx, ny, ignoreSalt, false)) continue;
    const nd = manh(nx, ny, tx, ty);
    if (nd > bestDist) {
      bestDist = nd;
      bestDir = d;
    }
  }
  if (bestDir < 0) return false;
  e.x += DX[bestDir]!;
  e.y += DY[bestDir]!;
  return true;
}

/** Count moths currently orbiting (adjacent-8, ORBIT state) — light drain. */
export function orbitingMoths(s: SimState): number {
  let n = 0;
  for (let i = 0; i < s.entities.length; i++) {
    const e = s.entities[i]!;
    if (e.kind === EntityKind.MOTH && e.state === MothState.ORBIT && cheb(e.x, e.y, s.px, s.py) <= 1) n++;
  }
  return n;
}

// ── AI pass (entities ascending id; deterministic) ─────────────────────────
export function aiPass(ctx: Ctx, effRadius: number): string | null {
  const s = ctx.s;
  // Iterate over a snapshot of ids: entities may die mid-pass (fire from a
  // kill effect), and splice must not skip anyone.
  const ids: number[] = [];
  for (let i = 0; i < s.entities.length; i++) ids.push(s.entities[i]!.id);

  for (let k = 0; k < ids.length; k++) {
    if (s.status !== 0 /* ALIVE */) break;
    let e: Entity | undefined;
    for (let i = 0; i < s.entities.length; i++) {
      if (s.entities[i]!.id === ids[k]) {
        e = s.entities[i]!;
        break;
      }
    }
    if (e === undefined) continue; // died earlier this pass

    switch (e.kind) {
      case EntityKind.RAT: {
        const dist = manh(e.x, e.y, s.px, s.py);
        if (effRadius >= RAT_FLEE_RADIUS && dist <= effRadius + 2) {
          stepAway(s, e, s.px, s.py, false); // flees light (01 §8 #1)
        } else if (effRadius <= RAT_SWARM_RADIUS) {
          if (dist === 1) damagePlayer(ctx, DMG[EntityKind.RAT]!, DmgSource.MONSTER, e.kind);
          else stepToward(s, e, s.px, s.py, false, false); // swarms in dark
        } else {
          // L1: drifts toward floor drippings — following a rat finds wax
          let bx = -1, by = -1, bd = RAT_WAX_SENSE + 1;
          for (let i = 0; i < s.tiles.length; i++) {
            const t = s.tiles[i]!;
            if (t !== Tile.WAX_DRIP && t !== Tile.WAX_STUB && t !== Tile.WAX_CAKE) continue;
            const x = i % s.w;
            const y = (i / s.w) | 0;
            const d = manh(e.x, e.y, x, y);
            if (d < bd) {
              bd = d;
              bx = x;
              by = y;
            }
          }
          if (bx >= 0 && bd > 0) stepToward(s, e, bx, by, false, false);
        }
        break;
      }

      case EntityKind.WICKWORM: {
        const dist = manh(e.x, e.y, s.px, s.py);
        if (e.state === WormState.BURROWED) {
          const senses =
            (s.candle === Candle.CUPPED && dist <= WORM_HEAT_SENSE) || // heat (01 §8 #2 L1)
            dist <= WORM_VIBRATION_SENSE;
          if (senses) {
            if (dist === 1) {
              e.state = WormState.TELEGRAPH;
              ev(ctx, Ev.WORM_TELEGRAPH, e.x, e.y);
            } else {
              stepToward(s, e, s.px, s.py, true, true); // underground: ignores salt/fire
            }
          }
        } else if (e.state === WormState.TELEGRAPH) {
          e.state = WormState.SURFACED;
          e.data = WORM_SURFACED_TICKS;
          if (dist === 1) {
            ev(ctx, Ev.WORM_LUNGE, e.x, e.y);
            damagePlayer(ctx, DMG[EntityKind.WICKWORM]!, DmgSource.MONSTER, e.kind);
          }
        } else {
          // SURFACED: vulnerable, immobile cooldown
          e.data = e.data > 0 ? e.data - 1 : 0;
          if (e.data === 0) e.state = WormState.BURROWED;
        }
        break;
      }

      case EntityKind.MOTH: {
        const dist = manh(e.x, e.y, s.px, s.py);
        if (s.candle !== Candle.LIT && (e.state === MothState.SEEK || e.state === MothState.ORBIT)) {
          e.state = MothState.SCATTER; // cupping sheds them (01 §8 #3)
          e.data = MOTH_SCATTER_TICKS;
        }
        if (e.state === MothState.SCATTER) {
          e.data = e.data > 0 ? e.data - 1 : 0;
          stepAway(s, e, s.px, s.py, true);
          if (e.data === 0) e.state = MothState.WANDER;
        } else if (e.state === MothState.ORBIT) {
          if (cheb(e.x, e.y, s.px, s.py) > 1) {
            e.state = MothState.SEEK;
            stepToward(s, e, s.px, s.py, true, false);
          } else {
            // rotate clockwise among free adjacent-8 slots
            const OX = [0, 1, 1, 1, 0, -1, -1, -1];
            const OY = [-1, -1, 0, 1, 1, 1, 0, -1];
            let cur = 0;
            for (let i = 0; i < 8; i++) {
              if (s.px + OX[i]! === e.x && s.py + OY[i]! === e.y) {
                cur = i;
                break;
              }
            }
            for (let step = 1; step <= 8; step++) {
              const i = (cur + step) & 7;
              const nx = s.px + OX[i]!;
              const ny = s.py + OY[i]!;
              if (canEnter(s, e, nx, ny, true, false)) {
                e.x = nx;
                e.y = ny;
                break;
              }
            }
          }
        } else if (e.state === MothState.SEEK) {
          stepToward(s, e, s.px, s.py, true, false);
          if (cheb(e.x, e.y, s.px, s.py) <= 1) e.state = MothState.ORBIT;
        } else {
          // WANDER: deterministic drift from the ai stream
          if (s.candle === Candle.LIT && dist <= MOTH_FLAME_SENSE) {
            e.state = MothState.SEEK;
          } else {
            const r = rollInt(s.rng, Stream.AI, 5);
            if (r < 4) {
              const nx = e.x + DX[r]!;
              const ny = e.y + DY[r]!;
              if (canEnter(s, e, nx, ny, true, false)) {
                e.x = nx;
                e.y = ny;
              }
            }
          }
        }
        break;
      }

      case EntityKind.BEAST: {
        // Blind; hunts last tick's sound (01 §8 #7, DECISIONS 18)
        const steps = s.noiseLevel > BEAST_MAX_STEP ? BEAST_MAX_STEP : s.noiseLevel;
        for (let step = 0; step < steps; step++) {
          if (manh(e.x, e.y, s.px, s.py) === 1) {
            damagePlayer(ctx, DMG[EntityKind.BEAST]!, DmgSource.BEAST, e.kind);
            break;
          }
          if (!stepToward(s, e, s.noiseX, s.noiseY, true, true)) break; // fearless of fire
        }
        break;
      }
    }
  }
  return null;
}

// ── Fire pass: damage, then spread/decay (sorted, deterministic) ───────────
export function firePass(ctx: Ctx): string | null {
  const s = ctx.s;

  // 1. Damage entities standing in fire (outcome per kind is SECRET)
  const ids: number[] = [];
  for (let i = 0; i < s.entities.length; i++) ids.push(s.entities[i]!.id);
  for (let k = 0; k < ids.length; k++) {
    let e: Entity | undefined;
    for (let i = 0; i < s.entities.length; i++) {
      if (s.entities[i]!.id === ids[k]) {
        e = s.entities[i]!;
        break;
      }
    }
    if (e === undefined) continue;
    if (s.fire[idx(s, e.x, e.y)]! > 0 && !isBurrowed(e)) {
      const key = ruleKey(KIND_NAME[e.kind]!, "fire", "self", "-");
      const eff = lookup(ctx, key);
      if (eff === null) return key;
      const abort = applyEffect(ctx, e, eff);
      if (abort !== null) return abort;
    }
  }

  // 2. Player in fire
  if (s.status === 0 && s.fire[idx(s, s.px, s.py)]! > 0) {
    damagePlayer(ctx, FIRE_WAX_DAMAGE, DmgSource.FIRE);
  }

  // 3. Spread once to adjacent webbing (fresh tiles skip this tick's decay),
  //    then decay pre-existing fires; burnt-out webbing is consumed.
  const burning: number[] = [];
  for (let i = 0; i < s.fire.length; i++) if (s.fire[i]! > 0) burning.push(i);
  for (let k = 0; k < burning.length; k++) {
    const i = burning[k]!;
    const x = i % s.w;
    const y = (i / s.w) | 0; // non-negative int division
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]!;
      const ny = y + DY[d]!;
      if (!inBounds(s, nx, ny)) continue;
      const ni = idx(s, nx, ny);
      if (s.tiles[ni] === Tile.WEBBING && s.fire[ni]! === 0) {
        s.fire[ni] = FIRE_TICKS;
        ev(ctx, Ev.FIRE_IGNITED, nx, ny);
      }
    }
  }
  for (let k = 0; k < burning.length; k++) {
    const i = burning[k]!;
    s.fire[i] = s.fire[i]! - 1;
    if (s.fire[i]! === 0 && s.tiles[i] === Tile.WEBBING) s.tiles[i] = Tile.FLOOR;
  }
  return null;
}

// ── Brazier aura pass: wax bodies melt (SECRET outcome) ────────────────────
export function auraPass(ctx: Ctx): string | null {
  const s = ctx.s;
  const ids: number[] = [];
  for (let i = 0; i < s.entities.length; i++) ids.push(s.entities[i]!.id);
  for (let k = 0; k < ids.length; k++) {
    let e: Entity | undefined;
    for (let i = 0; i < s.entities.length; i++) {
      if (s.entities[i]!.id === ids[k]) {
        e = s.entities[i]!;
        break;
      }
    }
    if (e === undefined) continue;
    if (isBurrowed(e)) continue;
    if (inBrazierAura(s, e.x, e.y)) {
      const key = ruleKey(KIND_NAME[e.kind]!, "in-aura", "brazier", "-");
      const eff = lookup(ctx, key);
      if (eff === null) return key;
      if (eff !== Effect.NONE) {
        const abort = applyEffect(ctx, e, eff);
        if (abort !== null) return abort;
      }
    }
  }
  return null;
}
