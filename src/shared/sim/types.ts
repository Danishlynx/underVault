/**
 * Sim state, actions, events — the deterministic contract's type layer (v2:
 * full bestiary, item verbs, door taxonomy, omen mutations, gas/water).
 * Every field is integer-encodable; serialization field order in pack.ts is
 * FROZEN under STATE_V. cloneState() must enumerate fields in the same
 * order as serializeState() — the field-probe unit test enforces it.
 */

export const STATE_V = 2;
export const LOG_V = 2; // v2: ARG_BITS argument payloads (USE, SIGN)

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
  WATER: 16, // conducts shock while Drownedkin animate (01 §8 #8)
  GLOWMOSS: 17, // faint permanent light
  INSCRIPTION: 18, // cipher wall-text (floor 9+); opaque like wall
  CHEST: 19, // loot… or a Mirrormaw (01 §8 #5)
  DOOR_IRON: 20, // key (01 §10)
  DOOR_SIGIL: 21, // offer darkness = snuff + wait 3
  DOOR_HUNGER: 22, // feed 50 wax
  DOOR_CHOIR: 23, // ring bell adjacent
  PLATE: 24, // pressure plate (also the Choirless-silencing echo-plate)
  ALTAR: 25, // Tallow Altar: 100 wax → floor-map pulse
  POOL: 26, // Mirror Pool: replay the floor's deepest echo
  FONT: 27, // Nameless Font: deliberately blank (server rules know)
  SEAL: 28, // the Bottom Seal (floor 25)
  KEY_DROP: 29, // an iron key lying on the floor
} as const;
export const TILE_KIND_COUNT = 30;

// ── Candle / status ────────────────────────────────────────────────────────
export const Candle = { LIT: 0, CUPPED: 1, SNUFFED: 2 } as const;
export const Status = { ALIVE: 0, DEAD: 1, EXITED: 2, DESCENDING: 3, VICTORY: 4 } as const;
export const DeathCause = {
  NONE: 0,
  TAKEN_BY_THE_DARK: 1,
  OWN_FLAME: 2, // "Undone by their own flame" — fire/gas
  MELTED_BEFORE_BEAST: 3,
  DROWNED: 4, // "Drowned among the Stacks" — shock on water
} as const;

// ── Entities ───────────────────────────────────────────────────────────────
export const EntityKind = {
  RAT: 1,
  WICKWORM: 2,
  MOTH: 3,
  BEAST: 4,
  SLIME: 5, // Gloomcap Slimes
  MIMIC: 6, // Mirrormaws
  SPOREWIGHT: 7,
  DROWNED: 8, // Drownedkin
  BELLHUNG: 9,
  SHADE: 10, // Cinder Shades
  GASLIGHT: 11,
  CHOIRLESS: 12,
  RUSTLING: 13,
  KEEPER: 14, // the Lantern-Keeper
  CORPSE: 20, // a fallen delver (cross-run, injected by the adapter)
} as const;

export const WormState = { BURROWED: 0, TELEGRAPH: 1, SURFACED: 2 } as const;
export const MothState = { WANDER: 0, SEEK: 1, ORBIT: 2, SCATTER: 3 } as const;
export const MimicState = { DISGUISED: 0, GROWLED: 1, REVEALED: 2 } as const;

export interface Entity {
  id: number; // u32, deterministic, ascending
  kind: number;
  x: number;
  y: number;
  hp: number; // i16
  state: number; // u8, kind-specific
  data: number; // u16, kind-specific (cooldowns, stolen item id, corpse ref)
}

// ── Items (inventory: 6 slots — choice pressure, 01 §9) ────────────────────
export const Item = {
  NONE: 0,
  FLINT: 1, // relight
  SALT: 2, // lines/throws
  CHALK: 3, // marks persist into YOUR future days; repels Rustlings
  MIRROR: 4, // mimic/echo reveal (passive)
  BELL: 5, // throw = sound decoy
  GLOWVIAL: 6, // plant a permanent light tile — a gift
  DOUSE: 7, // Dousing Cap: instant free snuff (passive)
  KEY_IRON: 8,
  KEY_MASTER: 9,
  WSHARD: 10, // Waystone Shard: remote bank, single use
} as const;

/** Heirlooms (lineage, informational only — 01 §9/§13). */
export const Heirloom = {
  NONE: 0,
  SMOKED_GLASS: 1, // see 1 tile while snuffed
  FEVER_RING: 2, // warms adjacent to mimics
  LISTENING_HORN: 3, // doubles audio-tell radius (client-side)
  WIDDERSHINS: 4, // spins near cipher walls (client-side)
  LOCKET: 5, // hums near secret rooms (client-side)
} as const;

// ── Actions (6-bit opcodes; v2 adds argumented verbs via ARG_BITS) ─────────
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
  USE: 18, // args: slot(3 bits) + dir(2 bits)
  SIGN: 19, // args: template(3 bits) + noun(5 bits)
  BANK: 20, // args: count(2 bits) — claims committed at a waystone
} as const;
export const ACTION_MAX = 20;

/** Extra argument bits read after each opcode (logV 2). Index = opcode. */
export const ARG_BITS: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 5, 8,
  2,
];

/** A packed action step: opcode + argument payload. */
export interface Step {
  op: number;
  arg: number;
}

// ── Outcome events (write-only sim output; never hashed) ───────────────────
export const Ev = {
  MOVED: 1,
  BLOCKED: 2,
  REJECTED: 3,
  DOOR_OPENED: 4,
  DOOR_FORCED: 5,
  BRAZIER_LIT: 6,
  WAX_GAINED: 7,
  CANDLE_STATE: 8,
  CANDLE_CANCEL: 9,
  TIER_CHANGED: 10,
  GRACE_STARTED: 11,
  GRACE_PAUSED: 12,
  DIED: 13,
  EXITED: 14,
  WAYSTONE_TOUCHED: 15,
  STAIRS_TOUCHED: 16,
  DESCENDED: 17,
  BUMP: 18,
  PLAYER_HURT: 19,
  MONSTER_DIED: 20,
  MONSTER_MELTED: 21,
  MONSTER_IMMUNE: 22,
  SALT_PLACED: 23,
  CHALK_MARKED: 24,
  FIRE_IGNITED: 25,
  FIRE_HURT: 26,
  WORM_TELEGRAPH: 27,
  WORM_LUNGE: 28,
  RULE_LEARNED: 29,
  GAS_RELEASED: 30, // a = x, b = y
  GAS_BOOM: 31,
  SHOCK: 32, // conduction along water
  MIMIC_GROWL: 33,
  MIMIC_REVEAL: 34,
  CHEST_LOOT: 35, // a = Item id
  SLIME_SPLIT: 36,
  BELL_RUNG: 37, // Bellhung alarm — floor alert
  SCREAM: 38, // Choirless — floor alert
  STOLEN: 39, // a = item id (Rustling)
  DROPPED_LOOT: 40, // a = item id
  DOOR_LOCKED: 41, // needs a key
  DOOR_FED: 42, // Hunger door accepted 50 wax
  RITUAL_TICK: 43, // sigil progress a = count
  DOOR_SIGIL_OPEN: 44,
  PLATE_PRESSED: 45,
  ALTAR_PULSE: 46, // floor map revealed
  POOL_ECHO: 47, // replay deepest echo (client)
  FONT_TOUCHED: 48,
  KEY_TAKEN: 49,
  SIGN_PLACED: 50, // a = template, b = noun
  ITEM_USED: 51, // a = item id
  CORPSE_RECOVERED: 52, // a = corpse entity id
  PICKPOCKET: 53, // lifted the Keeper's master key
  SEAL_OPENED: 54,
  VICTORY: 55, // the Bottom
  ALERT: 56, // floor-wide aggro began
  BANKED: 57, // a = count of claims committed
  HANDS_FULL: 58, // chest kept its hoard — a = item id it holds
} as const;

export interface OutcomeEvent {
  tick: number;
  type: number;
  a: number;
  b: number;
  c: number;
}

// ── Rules port ─────────────────────────────────────────────────────────────
export const Effect = {
  NONE: 0,
  DIE: 1,
  IGNITE_DIE: 2,
  IMMUNE: 3,
  MELT: 4,
  IGNITE_TILE: 5,
  SPLIT: 6, // slime: struck → two smaller
  GAS_BURST: 7, // sporewight death
  BLESS: 8, // + wax (the Font keeps its secret)
  RECOVER: 9, // corpse: yields its unbanked truths
  ALARM: 10, // floor-wide alert
  STEAL: 11,
  PICKPOCKET_OK: 12,
  HURT: 13, // generic: −1 hp; at 0 the thing dies (bellhung, shades…)
} as const;

export interface RuleTable {
  get(key: string): number | undefined;
}
export interface MutableRuleTable extends RuleTable {
  set(key: string, effect: number): void;
}
export interface RuleRequest {
  needRule: string;
}
export function isRuleRequest(r: TickResult | RuleRequest): r is RuleRequest {
  return (r as RuleRequest).needRule !== undefined;
}

// ── Omen mutations visible to the sim (numbers only; WHY is secret) ────────
export interface OmenMods {
  graceTicks: number; // default 25 (Hungry Dark: 12)
  burnBasic: number; // default 1 (Sweltering: 2)
  radiusPenalty: number; // default 0 (Longshadow: 1)
  quietFeet: number; // 0|1 (Quietfoot: player noise = 0)
  beastEar: number; // 1|2 (Stillair: beast strides double)
  echoRadius: number; // 0 = touch, 3 = Echofast auto-play
}
export const DEFAULT_MODS: OmenMods = {
  graceTicks: 25,
  burnBasic: 1,
  radiusPenalty: 0,
  quietFeet: 0,
  beastEar: 1,
  echoRadius: 0,
};

// ── State ──────────────────────────────────────────────────────────────────
export interface SimState {
  stateV: number;
  floor: number;
  tick: number;
  w: number;
  h: number;
  tiles: Uint8Array;
  px: number;
  py: number;
  wax: number;
  candle: number;
  candleTimer: number;
  candlePending: number;
  graceLeft: number;
  status: number;
  deathCause: number;
  inv: Uint8Array; // 6 slots, Item ids
  invCharges: Uint8Array; // 6 slots
  heirloom: number; // Heirloom id (lineage passive)
  noiseX: number;
  noiseY: number;
  noiseLevel: number;
  alertTicks: number; // floor-wide aggro (bells, screams)
  ritualTile: number; // sigil-door progress target (-1 = none) — i32
  ritualCount: number;
  signsLeft: number; // 2 per run (01 §10)
  banked: number; // claims banked this run (session credit)
  mods: OmenMods;
  entities: Entity[]; // ALWAYS sorted ascending by id
  nextEntityId: number;
  salt: Uint8Array;
  chalk: Uint8Array;
  fire: Uint8Array;
  gas: Uint8Array; // spore gas ticks; ignites (01 §8 #6)
  signs: Uint8Array; // sign markers (content lives day-side)
  seen: Uint8Array;
  rng: Uint32Array; // 20 words; fx (16..19) EXCLUDED from hash
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
  /** pre-seeded overlays from the shared day (braziers arrive via tiles) */
  chalk?: Uint8Array;
  signs?: Uint8Array;
}

export interface TickResult {
  state: SimState;
  events: OutcomeEvent[];
  visible: Uint8Array;
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
    heirloom: s.heirloom,
    noiseX: s.noiseX,
    noiseY: s.noiseY,
    noiseLevel: s.noiseLevel,
    alertTicks: s.alertTicks,
    ritualTile: s.ritualTile,
    ritualCount: s.ritualCount,
    signsLeft: s.signsLeft,
    banked: s.banked,
    mods: { ...s.mods },
    entities: s.entities.map((e) => ({ ...e })),
    nextEntityId: s.nextEntityId,
    salt: s.salt.slice(),
    chalk: s.chalk.slice(),
    fire: s.fire.slice(),
    gas: s.gas.slice(),
    signs: s.signs.slice(),
    seen: s.seen.slice(),
    rng: s.rng.slice(),
  };
}
