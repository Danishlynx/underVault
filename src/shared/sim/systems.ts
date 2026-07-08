/**
 * World systems v2: full bestiary AI (01 §8, all 14), gas/water/shock,
 * plates, chests & mimics, theft, tile interactions, and the rule-query
 * points where SECRET outcomes are consulted.
 *
 * Convention: functions that may need an unresolved rule return
 * `string | null` — non-null is the missing rule key; the engine aborts the
 * cloned tick and the runner resolves + retries. AI dispositions here are
 * client-visible data (DECISIONS 19); only interaction OUTCOMES are secret.
 */

import {
  Tile,
  Candle,
  EntityKind,
  WormState,
  MothState,
  MimicState,
  Effect,
  Ev,
  Item,
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
  GAS_TICKS,
  GAS_BOOM_DAMAGE,
  SHOCK_DAMAGE,
  COST_BASIC,
  COST_FORCE_DOOR,
  COST_BRAZIER,
  COST_HUNGER_DOOR,
  COST_ALTAR,
  PICKUP_WAX,
  CHEST_LOOT,
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
  SLIME_SENSE,
  SHADE_SENSE,
  CHOIRLESS_SIGHT,
  RUSTLING_SENSE,
  KEEPER_CONE,
  ALERT_TICKS,
  KIND_NAME,
  CANDLE_NAME,
  DX,
  DY,
} from "./constants.js";
import { Stream, chance, rollInt } from "./rng.js";
import { shadowcast } from "./fov.js";

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
function isStatic(kind: number): boolean {
  return kind === EntityKind.BELLHUNG || kind === EntityKind.CORPSE;
}

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

/** Player line-of-sight test (for Choirless sight, Keeper cone). */
function playerLos(s: SimState, x: number, y: number): boolean {
  const out = new Uint8Array(s.w * s.h);
  shadowcast(s.tiles, s.w, s.h, s.px, s.py, -1, out);
  return out[idx(s, x, y)]! === 1;
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
      if (s.invCharges[i] === 0 && item !== Item.FLINT) s.inv[i] = Item.NONE;
      return true;
    }
  }
  return false;
}
export function giveItem(s: SimState, item: number, charges: number): boolean {
  for (let i = 0; i < 6; i++) {
    if (s.inv[i] === item && item !== Item.KEY_IRON) {
      s.invCharges[i] = s.invCharges[i]! + charges;
      return true;
    }
  }
  for (let i = 0; i < 6; i++) {
    if (s.inv[i] === Item.NONE) {
      s.inv[i] = item;
      s.invCharges[i] = charges;
      return true;
    }
  }
  return false; // 6 slots — choice pressure (01 §9)
}
function stealKey(s: SimState): number {
  for (let i = 0; i < 6; i++) {
    if ((s.inv[i] === Item.KEY_IRON || s.inv[i] === Item.KEY_MASTER) && s.invCharges[i]! > 0) {
      const item = s.inv[i]!;
      s.invCharges[i] = s.invCharges[i]! - 1;
      if (s.invCharges[i] === 0) s.inv[i] = Item.NONE;
      return item;
    }
  }
  return Item.NONE;
}

// ── Player damage ──────────────────────────────────────────────────────────
export const DmgSource = { MONSTER: 0, FIRE: 1, BEAST: 2, SHOCK: 3 } as const;

export function damagePlayer(ctx: Ctx, amount: number, source: number, kind = 0): void {
  const s = ctx.s;
  if (s.status !== 0 || amount <= 0) return;
  if (s.graceLeft > 0) {
    s.graceLeft = s.graceLeft > amount ? s.graceLeft - amount : 0;
    if (s.graceLeft === 0) {
      s.status = 1;
      s.deathCause =
        source === DmgSource.FIRE ? 2 : source === DmgSource.BEAST ? 3 : source === DmgSource.SHOCK ? 4 : 1;
      ev(ctx, Ev.DIED, s.deathCause);
    }
  } else {
    s.wax = s.wax > amount ? s.wax - amount : 0;
  }
  if (source === DmgSource.FIRE) ev(ctx, Ev.FIRE_HURT, 0, amount);
  else if (source === DmgSource.SHOCK) ev(ctx, Ev.SHOCK, 0, amount);
  else ev(ctx, Ev.PLAYER_HURT, kind, amount);
}

// ── Fire & gas ─────────────────────────────────────────────────────────────
export function igniteTile(ctx: Ctx, x: number, y: number): void {
  const s = ctx.s;
  if (!inBounds(s, x, y)) return;
  const i = idx(s, x, y);
  if (s.fire[i]! === 0 && (TILE_FLAGS[s.tiles[i]!]! & F_WALK) !== 0) {
    s.fire[i] = FIRE_TICKS;
    ev(ctx, Ev.FIRE_IGNITED, x, y);
  }
}

function releaseGas(ctx: Ctx, x: number, y: number): void {
  const s = ctx.s;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(s, nx, ny)) continue;
      const i = idx(s, nx, ny);
      if ((TILE_FLAGS[s.tiles[i]!]! & F_WALK) !== 0 && s.gas[i]! === 0) {
        s.gas[i] = GAS_TICKS;
      }
    }
  }
  ev(ctx, Ev.GAS_RELEASED, x, y);
}

function boom(ctx: Ctx, x: number, y: number): void {
  const s = ctx.s;
  ev(ctx, Ev.GAS_BOOM, x, y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(s, nx, ny)) continue;
      const i = idx(s, nx, ny);
      s.gas[i] = 0;
      if ((TILE_FLAGS[s.tiles[i]!]! & F_WALK) !== 0 && s.fire[i]! === 0) s.fire[i] = FIRE_TICKS;
    }
  }
  if (cheb(s.px, s.py, x, y) <= 1) damagePlayer(ctx, GAS_BOOM_DAMAGE, DmgSource.FIRE);
}

// ── Killing & rule effects ─────────────────────────────────────────────────
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
  // stolen goods return to the floor (Rustlings)
  if (e.kind === EntityKind.RUSTLING && e.data !== 0) {
    ev(ctx, Ev.DROPPED_LOOT, e.data);
    const i = idx(s, e.x, e.y);
    if (s.tiles[i] === Tile.FLOOR) s.tiles[i] = Tile.KEY_DROP;
  }
  // Bellhung drop a Bell when cut down (01 §8 #9)
  if (e.kind === EntityKind.BELLHUNG) {
    if (giveItem(s, Item.BELL, 1)) ev(ctx, Ev.DROPPED_LOOT, Item.BELL);
  }
  // death-effects that are themselves SECRET
  const dieKey = ruleKey(KIND_NAME[e.kind]!, "dies", "self", "-");
  const dieEff = lookup(ctx, dieKey);
  if (dieEff === null) return dieKey;
  if (dieEff === Effect.GAS_BURST) releaseGas(ctx, e.x, e.y);
  if (s.tiles[idx(s, e.x, e.y)] === Tile.WEBBING) {
    const key = ruleKey(KIND_NAME[e.kind]!, "dies-over", "webbing", "-");
    const eff = lookup(ctx, key);
    if (eff === null) return key;
    if (eff === Effect.IGNITE_TILE) igniteTile(ctx, e.x, e.y);
  }
  return null;
}

function applyEffect(ctx: Ctx, e: Entity, eff: number): string | null {
  const s = ctx.s;
  switch (eff) {
    case Effect.DIE:
      return killEntity(ctx, e, false);
    case Effect.IGNITE_DIE:
      igniteTile(ctx, e.x, e.y);
      return killEntity(ctx, e, false);
    case Effect.MELT:
      return killEntity(ctx, e, true);
    case Effect.IMMUNE:
      ev(ctx, Ev.MONSTER_IMMUNE, e.id, e.kind);
      return null;
    case Effect.IGNITE_TILE:
      igniteTile(ctx, e.x, e.y);
      return null;
    case Effect.HURT: {
      e.hp -= 1;
      if (e.hp <= 0) return killEntity(ctx, e, false);
      ev(ctx, Ev.BUMP, e.id, e.kind);
      return null;
    }
    case Effect.SPLIT: {
      // Gloomcap: struck → two smaller (01 §8 #4)
      e.hp = e.hp > 1 ? e.hp >> 1 : 0;
      if (e.hp <= 0) return killEntity(ctx, e, false);
      ev(ctx, Ev.SLIME_SPLIT, e.id);
      for (let d = 0; d < 4 && 1; d++) {
        const nx = e.x + DX[d]!;
        const ny = e.y + DY[d]!;
        if (walkable(s, nx, ny) && entityAt(s, nx, ny) === undefined && !(nx === s.px && ny === s.py)) {
          s.entities.push({ id: s.nextEntityId++, kind: EntityKind.SLIME, x: nx, y: ny, hp: e.hp, state: 0, data: 0 });
          break;
        }
      }
      return null;
    }
    case Effect.BLESS: {
      s.wax += 50; // the Font keeps its reasons to itself
      ev(ctx, Ev.WAX_GAINED, 50);
      return null;
    }
    case Effect.RECOVER: {
      ev(ctx, Ev.CORPSE_RECOVERED, e.id, e.data);
      removeEntity(s, e.id);
      return null;
    }
    case Effect.ALARM: {
      s.alertTicks = ALERT_TICKS;
      ev(ctx, Ev.ALERT);
      return null;
    }
    case Effect.STEAL: {
      const taken = stealKey(s);
      if (taken !== Item.NONE) {
        e.data = taken;
        ev(ctx, Ev.STOLEN, taken);
      }
      return null;
    }
    case Effect.PICKPOCKET_OK: {
      if (e.data !== 1) {
        e.data = 1;
        if (giveItem(s, Item.KEY_MASTER, 1)) ev(ctx, Ev.PICKPOCKET);
      }
      return null;
    }
    default:
      ev(ctx, Ev.BUMP, e.id, e.kind);
      return null;
  }
}

/** Player strikes/touches a monster. Outcome is SECRET (rules table). */
export function bumpEntity(ctx: Ctx, e: Entity): string | null {
  const s = ctx.s;
  // Mirrormaw disguise stages are observable behavior, not rules (01 §8 #5)
  if (e.kind === EntityKind.MIMIC && e.state === MimicState.DISGUISED) {
    e.state = MimicState.GROWLED;
    ev(ctx, Ev.MIMIC_GROWL, e.id);
    return null;
  }
  if (e.kind === EntityKind.MIMIC && e.state === MimicState.GROWLED) {
    e.state = MimicState.REVEALED;
    ev(ctx, Ev.MIMIC_REVEAL, e.id);
    return null;
  }
  const key = ruleKey(KIND_NAME[e.kind]!, "bump", "self", CANDLE_NAME[s.candle]!);
  const eff = lookup(ctx, key);
  if (eff === null) return key;
  ev(ctx, Ev.RULE_LEARNED, eff);
  return applyEffect(ctx, e, eff);
}

/** Snuffed pickpocket attempt on the Keeper (01 §8 #14). */
export function pickpocket(ctx: Ctx, e: Entity): string | null {
  const key = ruleKey(KIND_NAME[e.kind]!, "pickpocket", "self", CANDLE_NAME[ctx.s.candle]!);
  const eff = lookup(ctx, key);
  if (eff === null) return key;
  ev(ctx, Ev.RULE_LEARNED, eff);
  return applyEffect(ctx, e, eff);
}

// ── Tile interaction ───────────────────────────────────────────────────────
export interface InteractOutcome {
  cost: number;
  exited: boolean;
  victory: boolean;
}
const OK: InteractOutcome = { cost: COST_BASIC, exited: false, victory: false };

export function interactTile(ctx: Ctx, x: number, y: number): InteractOutcome | "invalid" | string {
  const s = ctx.s;
  if (!inBounds(s, x, y)) return "invalid";
  const i = idx(s, x, y);
  switch (s.tiles[i]!) {
    case Tile.DOOR_CLOSED:
      s.tiles[i] = Tile.DOOR_OPEN;
      ev(ctx, Ev.DOOR_OPENED, x, y);
      return { ...OK };
    case Tile.DOOR_STUCK:
      s.tiles[i] = Tile.DOOR_OPEN;
      ev(ctx, Ev.DOOR_FORCED, x, y);
      return { ...OK, cost: COST_FORCE_DOOR };
    case Tile.DOOR_IRON: {
      if (hasItem(s, Item.KEY_MASTER)) {
        s.tiles[i] = Tile.DOOR_OPEN;
        ev(ctx, Ev.DOOR_OPENED, x, y);
        return { ...OK };
      }
      if (hasItem(s, Item.KEY_IRON)) {
        consumeCharge(s, Item.KEY_IRON);
        s.tiles[i] = Tile.DOOR_OPEN;
        ev(ctx, Ev.DOOR_OPENED, x, y);
        return { ...OK };
      }
      ev(ctx, Ev.DOOR_LOCKED, x, y);
      return { ...OK };
    }
    case Tile.DOOR_HUNGER: {
      if (s.wax > COST_HUNGER_DOOR) {
        s.tiles[i] = Tile.DOOR_OPEN;
        ev(ctx, Ev.DOOR_FED, x, y);
        return { ...OK, cost: COST_HUNGER_DOOR };
      }
      ev(ctx, Ev.DOOR_LOCKED, x, y);
      return { ...OK };
    }
    case Tile.DOOR_CHOIR:
      ev(ctx, Ev.DOOR_LOCKED, x, y); // wants a bell's voice, not hands
      return { ...OK };
    case Tile.DOOR_SIGIL:
      ev(ctx, Ev.RITUAL_TICK, 0); // it wants something offered, not force
      return { ...OK };
    case Tile.BRAZIER_UNLIT:
      if (s.candle === Candle.SNUFFED || s.wax < COST_BRAZIER) return "invalid";
      s.tiles[i] = Tile.BRAZIER_LIT;
      ev(ctx, Ev.BRAZIER_LIT, x, y);
      return { ...OK, cost: COST_BRAZIER };
    case Tile.CHEST: {
      // real chest: open and take (mimics are entities wearing this face)
      const roll = rollInt(s.rng, Stream.LOOT, CHEST_LOOT.length);
      const [item, charges] = CHEST_LOOT[roll]!;
      s.tiles[i] = Tile.FLOOR;
      if (giveItem(s, item, charges)) ev(ctx, Ev.CHEST_LOOT, item);
      else {
        ev(ctx, Ev.DROPPED_LOOT, item); // hands full — it spills
        if (item === Item.KEY_IRON) s.tiles[i] = Tile.KEY_DROP;
      }
      return { ...OK };
    }
    case Tile.ALTAR: {
      if (s.wax <= COST_ALTAR) return "invalid";
      for (let k = 0; k < s.seen.length; k++) s.seen[k] = 1; // the floor-map pulse
      ev(ctx, Ev.ALTAR_PULSE);
      return { ...OK, cost: COST_ALTAR };
    }
    case Tile.POOL:
      ev(ctx, Ev.POOL_ECHO, x, y);
      return { ...OK };
    case Tile.FONT: {
      const key = ruleKey("font", "touch", "self", CANDLE_NAME[s.candle]!);
      const eff = lookup(ctx, key);
      if (eff === null) return key;
      ev(ctx, Ev.FONT_TOUCHED);
      if (eff !== Effect.NONE) {
        ev(ctx, Ev.RULE_LEARNED, eff);
        const abort = applyEffectOnPlayer(ctx, eff);
        if (abort !== null) return abort;
      }
      return { ...OK };
    }
    case Tile.SEAL: {
      if (s.banked >= 5) {
        ev(ctx, Ev.SEAL_OPENED);
        ev(ctx, Ev.VICTORY);
        return { ...OK, victory: true };
      }
      ev(ctx, Ev.DOOR_LOCKED, x, y); // the Seal does not know you yet
      return { ...OK };
    }
    case Tile.WAYSTONE:
      ev(ctx, Ev.WAYSTONE_TOUCHED, x, y);
      return { ...OK };
    case Tile.STAIRS_DOWN:
      ev(ctx, Ev.STAIRS_TOUCHED, x, y);
      return { ...OK };
    case Tile.ENTRY:
      ev(ctx, Ev.EXITED);
      return { ...OK, exited: true };
    default:
      return "invalid";
  }
}

function applyEffectOnPlayer(ctx: Ctx, eff: number): string | null {
  if (eff === Effect.BLESS) {
    ctx.s.wax += 50;
    ev(ctx, Ev.WAX_GAINED, 50);
  }
  return null;
}

/** Walk-over pickups: wax and dropped keys. */
export function collectGround(ctx: Ctx): void {
  const s = ctx.s;
  const i = idx(s, s.px, s.py);
  const t = s.tiles[i]!;
  const gain = PICKUP_WAX[t];
  if (gain !== undefined) {
    s.wax += gain;
    s.tiles[i] = Tile.FLOOR;
    ev(ctx, Ev.WAX_GAINED, gain);
  } else if (t === Tile.KEY_DROP) {
    if (giveItem(s, Item.KEY_IRON, 1)) {
      s.tiles[i] = Tile.FLOOR;
      ev(ctx, Ev.KEY_TAKEN);
    }
  }
}

// ── Movement helpers ───────────────────────────────────────────────────────
function canEnter(s: SimState, e: Entity, x: number, y: number, ignoreSalt: boolean, ignoreFire: boolean): boolean {
  if (!walkable(s, x, y)) return false;
  if (x === s.px && y === s.py) return false;
  if (entityAt(s, x, y) !== undefined) return false;
  const i = idx(s, x, y);
  if (!ignoreSalt && s.salt[i]! !== 0) return false;
  if (!ignoreFire && s.fire[i]! > 0) return false;
  // chalk repels Rustlings (01 §8 #13 hidden second use)
  if (e.kind === EntityKind.RUSTLING && s.chalk[i]! !== 0) return false;
  return true;
}

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

function wanderStep(s: SimState, e: Entity, ignoreSalt: boolean): boolean {
  const r = rollInt(s.rng, Stream.AI, 5);
  if (r >= 4) return false;
  const nx = e.x + DX[r]!;
  const ny = e.y + DY[r]!;
  if (canEnter(s, e, nx, ny, ignoreSalt, false)) {
    e.x = nx;
    e.y = ny;
    return true;
  }
  return false;
}

function meleeOrApproach(ctx: Ctx, e: Entity, ignoreSalt: boolean, ignoreFire: boolean): void {
  const s = ctx.s;
  if (manh(e.x, e.y, s.px, s.py) === 1) {
    damagePlayer(ctx, DMG[e.kind] ?? 0, e.kind === EntityKind.BEAST ? DmgSource.BEAST : DmgSource.MONSTER, e.kind);
  } else {
    stepToward(s, e, s.px, s.py, ignoreSalt, ignoreFire);
  }
}

export function orbitingMoths(s: SimState): number {
  let n = 0;
  for (let i = 0; i < s.entities.length; i++) {
    const e = s.entities[i]!;
    if (e.kind === EntityKind.MOTH && e.state === MothState.ORBIT && cheb(e.x, e.y, s.px, s.py) <= 1) n++;
  }
  return n;
}

/** Any plate on the floor currently pressed (player or entity weight)? */
export function anyPlatePressed(s: SimState): boolean {
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i] !== Tile.PLATE) continue;
    const x = i % s.w;
    const y = (i / s.w) | 0;
    if ((x === s.px && y === s.py) || entityAt(s, x, y) !== undefined) return true;
  }
  return false;
}

// ── AI pass ────────────────────────────────────────────────────────────────
export function aiPass(ctx: Ctx, effRadius: number, lastMoveDir: number): string | null {
  const s = ctx.s;
  const alerted = s.alertTicks > 0;
  const plateSilence = anyPlatePressed(s);
  const ids: number[] = [];
  for (let i = 0; i < s.entities.length; i++) ids.push(s.entities[i]!.id);

  for (let k = 0; k < ids.length; k++) {
    if (s.status !== 0) break;
    let e: Entity | undefined;
    for (let i = 0; i < s.entities.length; i++) {
      if (s.entities[i]!.id === ids[k]) {
        e = s.entities[i]!;
        break;
      }
    }
    if (e === undefined) continue;
    const dist = manh(e.x, e.y, s.px, s.py);

    switch (e.kind) {
      case EntityKind.RAT: {
        if (alerted || effRadius <= RAT_SWARM_RADIUS) {
          if (dist === 1) damagePlayer(ctx, DMG[EntityKind.RAT]!, DmgSource.MONSTER, e.kind);
          else stepToward(s, e, s.px, s.py, false, false);
        } else if (effRadius >= RAT_FLEE_RADIUS && dist < effRadius) {
          stepAway(s, e, s.px, s.py, false);
        } else if (effRadius >= RAT_FLEE_RADIUS && dist <= effRadius + 1) {
          if (chance(s.rng, Stream.AI, 1, 3)) wanderStep(s, e, false);
        } else {
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
          if (bx >= 0 && bd > 1) stepToward(s, e, bx, by, false, false);
          else if (chance(s.rng, Stream.AI, 1, 2)) wanderStep(s, e, false);
        }
        break;
      }

      case EntityKind.WICKWORM: {
        if (e.state === WormState.BURROWED) {
          const senses =
            (s.candle === Candle.CUPPED && dist <= WORM_HEAT_SENSE) || dist <= WORM_VIBRATION_SENSE || alerted;
          if (senses) {
            if (dist === 1) {
              e.state = WormState.TELEGRAPH;
              ev(ctx, Ev.WORM_TELEGRAPH, e.x, e.y);
            } else {
              stepToward(s, e, s.px, s.py, true, true);
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
          e.data = e.data > 0 ? e.data - 1 : 0;
          if (e.data === 0) e.state = WormState.BURROWED;
        }
        break;
      }

      case EntityKind.MOTH: {
        if (s.candle !== Candle.LIT && (e.state === MothState.SEEK || e.state === MothState.ORBIT)) {
          e.state = MothState.SCATTER;
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
        } else if (s.candle === Candle.LIT && dist <= MOTH_FLAME_SENSE) {
          e.state = MothState.SEEK;
        } else {
          wanderStep(s, e, true);
        }
        break;
      }

      case EntityKind.BEAST: {
        // blind; strides scale with the noise you made (Stillair doubles)
        const heard = s.noiseLevel * s.mods.beastEar;
        const steps = heard > BEAST_MAX_STEP + 1 ? BEAST_MAX_STEP + 1 : heard;
        for (let step = 0; step < steps; step++) {
          if (manh(e.x, e.y, s.px, s.py) === 1) {
            damagePlayer(ctx, DMG[EntityKind.BEAST]!, DmgSource.BEAST, e.kind);
            break;
          }
          if (!stepToward(s, e, s.noiseX, s.noiseY, true, true)) break;
        }
        break;
      }

      case EntityKind.SLIME: {
        // slow ooze: moves on alternating ticks; salt is a hard wall
        if (((s.tick + e.id) & 1) === 0) break;
        if (dist === 1) damagePlayer(ctx, DMG[EntityKind.SLIME]!, DmgSource.MONSTER, e.kind);
        else if (alerted || dist <= SLIME_SENSE) stepToward(s, e, s.px, s.py, false, false);
        else wanderStep(s, e, false);
        break;
      }

      case EntityKind.MIMIC: {
        if (e.state !== MimicState.REVEALED) break; // patient furniture
        meleeOrApproach(ctx, e, true, false);
        break;
      }

      case EntityKind.SPOREWIGHT: {
        if (dist === 1) damagePlayer(ctx, DMG[EntityKind.SPOREWIGHT]!, DmgSource.MONSTER, e.kind);
        else if (alerted || dist <= 6) stepToward(s, e, s.px, s.py, false, true);
        else wanderStep(s, e, false);
        break;
      }

      case EntityKind.DROWNED: {
        // animate only while a delver stands in the water (01 §8 #8)
        const playerOnWater = s.tiles[idx(s, s.px, s.py)] === Tile.WATER;
        if (playerOnWater || alerted) {
          e.state = 1;
          meleeOrApproach(ctx, e, false, false);
        } else {
          e.state = 0;
        }
        break;
      }

      case EntityKind.BELLHUNG: {
        // rings if you pass adjacent while LIT (01 §8 #9)
        if (e.data > 0) e.data--;
        if (dist === 1 && s.candle === Candle.LIT && e.data === 0) {
          e.data = 10; // won't re-ring immediately
          s.alertTicks = ALERT_TICKS;
          ev(ctx, Ev.BELL_RUNG, e.x, e.y);
          ev(ctx, Ev.ALERT);
        }
        break;
      }

      case EntityKind.SHADE: {
        if (s.candle === Candle.SNUFFED && !alerted) {
          wanderStep(s, e, true); // your flame gone, they drift
        } else if (alerted || dist <= SHADE_SENSE) {
          meleeOrApproach(ctx, e, true, true); // fire cannot hurt what is already cinder? (rules decide)
        } else {
          wanderStep(s, e, true);
        }
        break;
      }

      case EntityKind.GASLIGHT: {
        // mirrors your moves in reverse (01 §8 #11)
        if (lastMoveDir >= 0) {
          const rev = (lastMoveDir + 2) & 3;
          const nx = e.x + DX[rev]!;
          const ny = e.y + DY[rev]!;
          if (canEnter(s, e, nx, ny, true, true)) {
            e.x = nx;
            e.y = ny;
          }
        }
        if (s.gas[idx(s, e.x, e.y)]! > 0) {
          boom(ctx, e.x, e.y);
          const abort = killEntity(ctx, e, false);
          if (abort !== null) return abort;
        }
        break;
      }

      case EntityKind.CHOIRLESS: {
        if (e.data > 0) e.data--;
        const canSee =
          s.candle !== Candle.SNUFFED && dist <= CHOIRLESS_SIGHT && playerLos(s, e.x, e.y);
        if (canSee && e.data === 0 && !plateSilence) {
          e.data = 30;
          s.alertTicks = ALERT_TICKS;
          ev(ctx, Ev.SCREAM, e.x, e.y);
          ev(ctx, Ev.ALERT);
        }
        if (alerted || canSee) meleeOrApproach(ctx, e, false, false);
        break;
      }

      case EntityKind.RUSTLING: {
        const holdsLoot = e.data !== 0;
        if (holdsLoot) {
          stepAway(s, e, s.px, s.py, true); // flees with your key
          if (s.chalk[idx(s, e.x, e.y)]! !== 0) {
            // chalk's hidden second use: they drop everything (01 §8 #13)
            ev(ctx, Ev.DROPPED_LOOT, e.data);
            if (s.tiles[idx(s, e.x, e.y)] === Tile.FLOOR) s.tiles[idx(s, e.x, e.y)] = Tile.KEY_DROP;
            e.data = 0;
          }
        } else if ((hasItem(s, Item.KEY_IRON) || hasItem(s, Item.KEY_MASTER)) && dist <= RUSTLING_SENSE) {
          if (dist === 1) {
            const key = ruleKey(KIND_NAME[e.kind]!, "reaches", "self", "-");
            const eff = lookup(ctx, key);
            if (eff === null) return key;
            const abort = applyEffect(ctx, e, eff);
            if (abort !== null) return abort;
          } else {
            stepToward(s, e, s.px, s.py, true, false);
          }
        } else {
          wanderStep(s, e, true);
        }
        break;
      }

      case EntityKind.KEEPER: {
        const seesFlame =
          s.candle === Candle.LIT && dist <= KEEPER_CONE && playerLos(s, e.x, e.y);
        if (seesFlame) e.state = 1;
        if (s.candle === Candle.SNUFFED) e.state = 0; // ignores the snuffed utterly
        if (e.state === 1) {
          meleeOrApproach(ctx, e, true, true);
        } else if (chance(s.rng, Stream.AI, 2, 3)) {
          wanderStep(s, e, true); // patrols his rounds
        }
        break;
      }

      default:
        break; // CORPSE and other static things
    }
  }
  if (s.alertTicks > 0) s.alertTicks--;
  return null;
}

// ── Fire pass ──────────────────────────────────────────────────────────────
export function firePass(ctx: Ctx): string | null {
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
    if (s.fire[idx(s, e.x, e.y)]! > 0 && !isBurrowed(e) && !isStatic(e.kind)) {
      const key = ruleKey(KIND_NAME[e.kind]!, "fire", "self", "-");
      const eff = lookup(ctx, key);
      if (eff === null) return key;
      const abort = applyEffect(ctx, e, eff);
      if (abort !== null) return abort;
    }
  }

  if (s.status === 0 && s.fire[idx(s, s.px, s.py)]! > 0) {
    damagePlayer(ctx, FIRE_WAX_DAMAGE, DmgSource.FIRE);
  }

  const burning: number[] = [];
  for (let i = 0; i < s.fire.length; i++) if (s.fire[i]! > 0) burning.push(i);
  for (let k = 0; k < burning.length; k++) {
    const i = burning[k]!;
    const x = i % s.w;
    const y = (i / s.w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]!;
      const ny = y + DY[d]!;
      if (!inBounds(s, nx, ny)) continue;
      const ni = idx(s, nx, ny);
      if (s.tiles[ni] === Tile.WEBBING && s.fire[ni]! === 0) {
        s.fire[ni] = FIRE_TICKS;
        ev(ctx, Ev.FIRE_IGNITED, nx, ny);
      }
      if (s.gas[ni]! > 0) boom(ctx, nx, ny);
    }
  }
  for (let k = 0; k < burning.length; k++) {
    const i = burning[k]!;
    s.fire[i] = s.fire[i]! - 1;
    if (s.fire[i]! === 0 && s.tiles[i] === Tile.WEBBING) s.tiles[i] = Tile.FLOOR;
  }
  return null;
}

// ── Gas pass: lit flames detonate spore clouds (01 §8 #6) ──────────────────
export function gasPass(ctx: Ctx): string | null {
  const s = ctx.s;
  const pi = idx(s, s.px, s.py);
  if (s.gas[pi]! > 0 && s.candle !== Candle.SNUFFED && s.status === 0) {
    boom(ctx, s.px, s.py);
  }
  for (let i = 0; i < s.gas.length; i++) {
    if (s.gas[i]! > 0) s.gas[i] = s.gas[i]! - 1;
  }
  return null;
}

// ── Shock pass: Drownedkin conduct along connected water (01 §8 #8) ────────
export function shockPass(ctx: Ctx): string | null {
  const s = ctx.s;
  const pi = idx(s, s.px, s.py);
  if (s.tiles[pi] !== Tile.WATER || s.status !== 0) return null;
  // flood the player's water component; salt bridges break conduction
  const region = new Uint8Array(s.w * s.h);
  const q = [pi];
  region[pi] = 1;
  let qi = 0;
  while (qi < q.length) {
    const i = q[qi++]!;
    const x = i % s.w;
    const y = (i / s.w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]!;
      const ny = y + DY[d]!;
      if (!inBounds(s, nx, ny)) continue;
      const ni = idx(s, nx, ny);
      if (region[ni]! !== 0 || s.tiles[ni] !== Tile.WATER || s.salt[ni]! !== 0) continue;
      region[ni] = 1;
      q.push(ni);
    }
  }
  for (let i = 0; i < s.entities.length; i++) {
    const e = s.entities[i]!;
    if (e.kind === EntityKind.DROWNED && e.state === 1 && region[idx(s, e.x, e.y)]! === 1) {
      damagePlayer(ctx, SHOCK_DAMAGE, DmgSource.SHOCK);
      break; // one jolt per tick is cruelty enough (⚖)
    }
  }
  return null;
}

// ── Brazier aura pass ──────────────────────────────────────────────────────
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
    if (isBurrowed(e) || isStatic(e.kind)) continue;
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
