/**
 * Sim state, actions, events — the deterministic contract's type layer.
 * Every field is integer-encodable; see serialization in pack.ts (field order
 * there is FROZEN under STATE_V). cloneState() below must enumerate fields in
 * the same order as serializeState() — the field-probe unit test enforces it.
 */

export const STATE_V = 1;
export const LOG_V = 1;

// ── Tiles ──────────────────────────────────────────────────────────────────
export const Tile = {
  VOID: 0,
  WALL: 1,
  FLOOR: 2, // stone (noise 2)
  MOSS: 3, // quiet floor (noise 1)
  WEBBING: 4, // flammable floor (noise 1)
  DOOR_CLOSED: 5,
  DOOR_STUCK: 6,
  DOOR_OPEN: 7,
  ENTRY: 8,
  STAIRS_DOWN: 9,
  WAYSTONE: 10,
  BRAZIER_UNLIT: 11,
  BRAZIER_LIT: 12,
  WAX_DRIP: 13,
  WAX_STUB: 14,
  WAX_CAKE: 15,
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

// ── Candle / status ────────────────────────────────────────────────────────
export const Candle = { LIT: 0, CUPPED: 1, SNUFFED: 2 } as const;
export const Status = { ALIVE: 0, DEAD: 1, EXITED: 2, DESCENDING: 3 } as const;
export const DeathCause = {
  NONE: 0,
  TAKEN_BY_THE_DARK: 1, // grace expiry / bitten out in the dark (04 §7)
  OWN_FLAME: 2, // "Undone by their own flame" — died in fire
  MELTED_BEFORE_BEAST: 3, // "Melted before the Chandler Beast"
} as const;

// ── Entities ───────────────────────────────────────────────────────────────
export const EntityKind = { RAT: 1, WICKWORM: 2, MOTH: 3, BEAST: 4 } as const;

/** Per-kind `state` field meanings (u8): */
export const WormState = { BURROWED: 0, TELEGRAPH: 1, SURFACED: 2 } as const;
export const MothState = { WANDER: 0, SEEK: 1, ORBIT: 2, SCATTER: 3 } as const;

export interface Entity {
  id: number; // u32, deterministic, ascending
  kind: number; // EntityKind
  x: number; // u8
  y: number; // u8
  hp: number; // i16
  state: number; // u8, kind-specific
  data: number; // u16, kind-specific counter (scatter/surfaced ticks etc.)
}

// ── Items ──────────────────────────────────────────────────────────────────
export const Item = { NONE: 0, FLINT: 1, SALT: 2, CHALK: 3 } as const;

// ── Actions (6-bit opcodes; ARG_BITS all zero at logV 1) ───────────────────
export const Action = {
  WAIT: 0,
  MOVE_N: 1,
  MOVE_E: 2,
  MOVE_S: 3,
  MOVE_W: 4,
  INTERACT_N: 5,
  INTERACT_E: 6,
  INTERACT_S: 7,
  INTERACT_W: 8,
  CUP: 9,
  SNUFF: 10,
  RELIGHT: 11,
  SALT_N: 12,
  SALT_E: 13,
  SALT_S: 14,
  SALT_W: 15,
  CHALK_MARK: 16,
  DESCEND: 17,
} as const;
export const ACTION_MAX = 17;

// ── Outcome events (write-only sim output; never hashed, never re-consumed) ─
export const Ev = {
  MOVED: 1,
  BLOCKED: 2,
  REJECTED: 3,
  DOOR_OPENED: 4,
  DOOR_FORCED: 5,
  BRAZIER_LIT: 6,
  WAX_GAINED: 7,
  CANDLE_STATE: 8, // a = new Candle state
  CANDLE_CANCEL: 9,
  TIER_CHANGED: 10, // a = new radius
  GRACE_STARTED: 11,
  GRACE_PAUSED: 12,
  DIED: 13, // a = DeathCause
  EXITED: 14,
  WAYSTONE_TOUCHED: 15,
  STAIRS_TOUCHED: 16,
  DESCENDED: 17, // runner must swap floors via descendState()
  BUMP: 18, // a = entity id (no special outcome)
  PLAYER_HURT: 19, // a = attacker kind, b = wax lost
  MONSTER_DIED: 20, // a = entity id, b = kind
  MONSTER_MELTED: 21, // a = entity id
  MONSTER_IMMUNE: 22, // a = entity id ("your hand sinks into wax")
  SALT_PLACED: 23,
  CHALK_MARKED: 24,
  FIRE_IGNITED: 25, // a = x, b = y
  FIRE_HURT: 26, // b = wax lost
  WORM_TELEGRAPH: 27, // a = x, b = y (dust plume)
  WORM_LUNGE: 28,
  RULE_LEARNED: 29, // a = effect id; c = interned query index (client-side aid)
} as const;

export interface OutcomeEvent {
  tick: number;
  type: number;
  a: number;
  b: number;
  c: number;
}

// ── Rules port (outcome mapping is SECRET; effect semantics are public) ────
export const Effect = {
  NONE: 0,
  DIE: 1,
  IGNITE_DIE: 2, // dies and ignites its tile
  IMMUNE: 3, // interaction absorbed, no damage
  MELT: 4, // dies, melting (wax body)
  IGNITE_TILE: 5,
} as const;

/** Resolved rule outcomes the sim may consult. Client fills this lazily via
 *  the RulesPort (dev: local adapter; M2: /api/run/act synchronous flush). */
export interface RuleTable {
  get(key: string): number | undefined;
}

export interface MutableRuleTable extends RuleTable {
  set(key: string, effect: number): void;
}

/** tick() returns this instead of a result when an outcome is unknown. */
export interface RuleRequest {
  needRule: string;
}
export function isRuleRequest(r: TickResult | RuleRequest): r is RuleRequest {
  return (r as RuleRequest).needRule !== undefined;
}

// ── State ──────────────────────────────────────────────────────────────────
export interface SimState {
  stateV: number;
  floor: number;
  tick: number; // u32; increments exactly once per accepted tick
  w: number;
  h: number;
  tiles: Uint8Array; // w*h TileId
  px: number;
  py: number;
  wax: number; // u16, ≥0
  candle: number; // Candle
  candleTimer: number; // remaining channel ticks (0 = none)
  candlePending: number; // Candle target when channel completes
  graceLeft: number; // 0 = not in Dark Grace, else remaining ticks
  status: number; // Status
  deathCause: number; // DeathCause
  inv: Uint8Array; // 6 slots, Item ids
  invCharges: Uint8Array; // 6 slots, charges
  noiseX: number;
  noiseY: number;
  noiseLevel: number; // last tick's noise (Beast food)
  entities: Entity[]; // ALWAYS sorted ascending by id
  nextEntityId: number;
  salt: Uint8Array; // w*h 0|1 overlay
  chalk: Uint8Array; // w*h 0|1 overlay (per-floor, per-run)
  fire: Uint8Array; // w*h remaining burn ticks
  seen: Uint8Array; // w*h 0|1 memory (hashed: FOV drift tripwire)
  rng: Uint32Array; // 20 = [gen,spawn,ai,loot,fx] × 4; fx EXCLUDED from hash
}

export interface FloorData {
  floor: number;
  w: number;
  h: number;
  tiles: Uint8Array;
  px: number;
  py: number;
  entities: Entity[];
  nextEntityId: number;
}

export interface TickResult {
  state: SimState;
  events: OutcomeEvent[];
  visible: Uint8Array; // w*h 0|1, derived (renderer aid; also OR-ed into seen)
}

export function cloneState(s: SimState): SimState {
  return {
    stateV: s.stateV,
    floor: s.floor,
    tick: s.tick,
    w: s.w,
    h: s.h,
    tiles: s.tiles.slice(),
    px: s.px,
    py: s.py,
    wax: s.wax,
    candle: s.candle,
    candleTimer: s.candleTimer,
    candlePending: s.candlePending,
    graceLeft: s.graceLeft,
    status: s.status,
    deathCause: s.deathCause,
    inv: s.inv.slice(),
    invCharges: s.invCharges.slice(),
    noiseX: s.noiseX,
    noiseY: s.noiseY,
    noiseLevel: s.noiseLevel,
    entities: s.entities.map((e) => ({ ...e })),
    nextEntityId: s.nextEntityId,
    salt: s.salt.slice(),
    chalk: s.chalk.slice(),
    fire: s.fire.slice(),
    seen: s.seen.slice(),
    rng: s.rng.slice(),
  };
}
