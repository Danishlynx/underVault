/**
 * Wire protocol (M2 — docs/08-M2-PORT-CONTRACT.md §1.3, verbatim-binding).
 * Client-safe: zod schemas + b64/bitpack codecs only. No secrets, no server
 * imports. Compiles under tsconfig.shared.json (`types: []`).
 *
 * logV is 2 (D50/C1 — supersedes the CLAUDE.md appendix `logV: 1`).
 * Claim wire shape is `{ key, effect }` (C7 — supersedes appendix Claim).
 */

import { z } from "zod";
import type { FloorData, Entity, OutcomeEvent, OmenMods } from "./sim/types.js";
import { toB64, fromB64 } from "./sim/pack.js";

export const PROTOCOL_V = 1;

// ── primitives ─────────────────────────────────────────────────────────────
export const zU8 = z.number().int().min(0).max(255);
export const zU16 = z.number().int().min(0).max(65535);
export const zU32 = z.number().int().min(0).max(4294967295);
export const zI16 = z.number().int().min(-32768).max(32767);
export const zB64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/).max(700000);
export const zHash8 = z.string().regex(/^[0-9a-f]{8}$/);
export const zToken = z.string().min(16).max(64);
export type U8 = z.infer<typeof zU8>;
export type U16 = z.infer<typeof zU16>;
export type U32 = z.infer<typeof zU32>;
export type I16 = z.infer<typeof zI16>;
export type B64 = z.infer<typeof zB64>;
export type Hash8 = z.infer<typeof zHash8>;
export type Token = z.infer<typeof zToken>;

// ── errors ─────────────────────────────────────────────────────────────────
export const ErrCode = {
  UNAUTHENTICATED: "UNAUTHENTICATED", // 401 — Vision mode plays locally, no server calls
  NO_DAY: "NO_DAY",                   // 503 — day not minted yet
  CANDLE_SPENT: "CANDLE_SPENT",       // 409 — run already banked/done today (invariant 10)
  NO_RUN: "NO_RUN",                   // 404 — no active run / bad token
  RUN_EXPIRED: "RUN_EXPIRED",         // 409 — 45 min token expiry; server auto-finalized
  RUN_ALIVE: "RUN_ALIVE",             // 409 — /end called while replayed status is ALIVE
  DESYNC: "DESYNC",                   // 422 — checkpoint-hash mismatch; run voided, integrity++
  RATE: "RATE",                       // 429 — act spacing < 1 s, etc.
  BAD_INPUT: "BAD_INPUT",             // 400 — zod reject / malformed log / claim not learned
  CONFLICT: "CONFLICT",               // 409 — watch/multi lost; client may retry
  FROZEN: "FROZEN",                   // 503 — freezeRuns kill switch (wired M3)
} as const;
export type ErrCodeT = (typeof ErrCode)[keyof typeof ErrCode];
export const zErrRes = z.object({
  error: z.enum(Object.keys(ErrCode) as [ErrCodeT, ...ErrCodeT[]]),
  message: z.string().max(200), // in-fiction toast copy per 04; retry-safe (02 §11)
});
export type ErrRes = z.infer<typeof zErrRes>;

// ── shared wire fragments ──────────────────────────────────────────────────
export const zOmenModsWire = z.object({
  graceTicks: zU16, burnBasic: zU8, radiusPenalty: zU8,
  quietFeet: zU8, beastEar: zU8, echoRadius: zU8,
});
export type OmenModsWire = z.infer<typeof zOmenModsWire>;
export const zRunSetupWire = z.object({
  mods: zOmenModsWire, heirloom: zU8, noSalt: z.boolean(),
}); // == ports.RunSetup, numbers only — WHY stays secret (02 §7)
export type RunSetupWire = z.infer<typeof zRunSetupWire>;

export const zEntityWire = z.object({
  id: zU32, kind: zU8, x: zU16, y: zU16, hp: zI16, state: zU8, data: zU16,
}); // 1:1 with sim Entity
export type EntityWire = z.infer<typeof zEntityWire>;
export const zEchoWire = z.object({
  day: zU32, floor: zU8,
  frames: z.array(z.tuple([zU16, zU16, zU8])).max(64), // [x, y, candle] @ 2 Hz — cosmetic only
});
export type EchoWire = z.infer<typeof zEchoWire>;
export const zSignWire = z.object({
  tileIndex: zU32, template: zU8, noun: zU8,
}); // content for tiles already flagged in FloorData.signs bitmap
export type SignWire = z.infer<typeof zSignWire>;
export const zLearnedRuleWire = z.object({ key: z.string().min(7).max(96), effect: zU8 });
export type LearnedRuleWire = z.infer<typeof zLearnedRuleWire>; // == ports.LearnedRule (C7)
export const zGiftWire = z.object({ item: zU8, charges: zU8 }); // == ports.CorpseGift
export type GiftWire = z.infer<typeof zGiftWire>;
export const zEventWire = z.object({ tick: zU32, type: zU8, a: zU32, b: zU32, c: zU32 });
export type EventWire = z.infer<typeof zEventWire>;
export const zCodexEntryWire = z.object({
  ruleKey: z.string().max(96), effect: zU8,
  status: z.enum(["conditional", "true", "inked", "disproven"]),
  confirms: zU16, day: zU32,
}); // structured only — subject/text derived client-side via describeRuleKey (C8)
export type CodexEntryWire = z.infer<typeof zCodexEntryWire>;

export const zFloorWire = z.object({
  floor: zU8, w: zU16, h: zU16,
  tiles: zB64,                       // w*h bytes — braziers/glowmoss already layered in
  px: zU16, py: zU16,
  entities: z.array(zEntityWire).max(512), // sorted ascending by id — corpses injected
  nextEntityId: zU32,
  chalk: zB64.optional(),            // w*h bytes — caller's own persistent chalk (D17)
  signs: zB64.optional(),            // w*h bytes — presence bitmap
  rngInit: zB64,                     // 80 bytes = 20×u32 LE, per-floor derived seed (D32/C5)
  signContents: z.array(zSignWire).max(128),
  echoes: z.array(zEchoWire).max(8),
  corpseIds: z.array(z.string().max(40)).max(64), // corpse entity.data indexes into this
});
export type FloorWire = z.infer<typeof zFloorWire>;

// ── /api/day ───────────────────────────────────────────────────────────────
export const zDayRes = z.object({
  day: zU32, gatePct: zU8, codexPct: zU8, fallenToday: zU16,
  teaser: z.string().max(140),       // omen tellHint fragment — the rumor, never the omen id
  houseLine: z.string().max(120).optional(), // present when authenticated
});
export type DayRes = z.infer<typeof zDayRes>;

// ── /api/run/start ─────────────────────────────────────────────────────────
export const zStartReq = z.object({}).strict();
export type StartReq = z.infer<typeof zStartReq>;
/**
 * Mid-run resume payload (M2b, additive — no logV bump): present on a
 * `resumed: true` response for a still-ALIVE run. `log` is the run's entire
 * packed action log (one canonical pack.ts frame, same codec as
 * zActReq.actions); the client replays it locally over the descend-re-served
 * floors 1..`floor` (ts-pinned ⇒ byte-identical composition). `learned`
 * carries run.learned — every rule the log consulted, server-recorded — so
 * the local replay never hits an unresolvable rule. Leak-safe: this player
 * already learned each of them this run (they rode earlier ActRes.rules).
 * `banked` lists the ruleKeys already committed to the Codex this run so the
 * driver never re-banks them.
 */
export const zResumeWire = z.object({
  log: zB64,
  floor: zU8,
  learned: z.array(zLearnedRuleWire).max(1024),
  banked: z.array(z.string().max(96)).max(256),
});
export type ResumeWire = z.infer<typeof zResumeWire>;
export const zStartRes = z.object({
  token: zToken, day: zU32, resumed: z.boolean(),
  setup: zRunSetupWire, floor: zFloorWire,
  resume: zResumeWire.optional(),
});
export type StartRes = z.infer<typeof zStartRes>;

// ── /api/run/act ───────────────────────────────────────────────────────────
export const zActReq = z.object({
  token: zToken,
  logV: z.literal(2),                // D50 — supersedes appendix logV:1 (C1)
  fromTick: zU32,                    // steps already acked; idempotency key with `actions`
  actions: zB64,                     // pack.ts frame (u8 logV · u16 LE count · bitstream)
  checkHash: zHash8.optional(),      // h32Hex(state) — required when crossing a 32-tick boundary
});
export type ActReq = z.infer<typeof zActReq>;
export const zCorpseYieldWire = z.object({
  entityId: zU32, corpseId: z.string().max(40),
  gift: zGiftWire.nullable(),        // D51: granted server-side, display-only in sim terms
  unbanked: z.array(zLearnedRuleWire).max(8), // joins run.learned server-side
});
export type CorpseYieldWire = z.infer<typeof zCorpseYieldWire>;
export const zActRes = z.object({
  serverTick: zU32,
  events: z.array(zEventWire).max(4096),
  rules: z.array(zLearnedRuleWire).max(64), // every rule consulted this segment (cache fill)
  corpses: z.array(zCorpseYieldWire).max(4),
});
export type ActRes = z.infer<typeof zActRes>;

// ── /api/run/descend ───────────────────────────────────────────────────────
export const zDescendReq = z.object({ token: zToken, toFloor: zU8 });
export type DescendReq = z.infer<typeof zDescendReq>;
export const zDescendRes = z.object({ floor: zFloorWire, serverTick: zU32 });
export type DescendRes = z.infer<typeof zDescendRes>;

// ── /api/run/bank ──────────────────────────────────────────────────────────
export const zBankReq = z.object({
  token: zToken,
  claims: z.array(zLearnedRuleWire).max(3),  // BANK_MAX (sim constants)
  confirms: z.array(z.string().max(96)).max(64), // SessionRules.drainTouched() output
});
export type BankReq = z.infer<typeof zBankReq>;
export const zBankRes = z.object({ entries: z.array(zCodexEntryWire).max(3) });
export type BankRes = z.infer<typeof zBankRes>;

// ── /api/run/end ───────────────────────────────────────────────────────────
export const zEndReq = z.object({
  token: zToken,
  lastWords: z.string().max(80),
  echoFrames: z.array(z.tuple([zU16, zU16, zU8])).max(64), // cosmetic; values clamped server-side
});
export type EndReq = z.infer<typeof zEndReq>;
export const zEndRes = z.object({
  day: zU32, floor: zU8, cause: zU8, generation: zU16,
  epitaphLine: z.string().max(140),
  unbanked: z.array(zLearnedRuleWire).max(64), // learned − banked, server-computed (never trusted)
});
export type EndRes = z.infer<typeof zEndRes>;

// ── /api/codex ─────────────────────────────────────────────────────────────
export const zCodexReq = z.object({ page: zU16 }); // query param, default 0
export type CodexReq = z.infer<typeof zCodexReq>;
export const zCodexRes = z.object({
  entries: z.array(zCodexEntryWire).max(50), page: zU16, pageCount: zU16,
});
export type CodexRes = z.infer<typeof zCodexRes>;

// ── compile-time parity guards (wire ⇄ sim; drift in either direction fails
//    the build — `zEntityWire == Entity`, `zEventWire == OutcomeEvent`,
//    `zOmenModsWire == OmenMods` per §1.3 comments) ─────────────────────────
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type EntityWireParity = Assert<MutuallyAssignable<EntityWire, Entity>>;
export type EventWireParity = Assert<MutuallyAssignable<EventWire, OutcomeEvent>>;
export type OmenModsWireParity = Assert<MutuallyAssignable<OmenModsWire, OmenMods>>;

// ── codecs (both sides use these; the ONLY tiles/rng wire encoding) ────────

/** 20 words → 80 bytes LE → b64 (any word count accepted; LE byte order). */
export function u32ToB64(words: Uint32Array): string {
  const bytes = new Uint8Array(words.length * 4);
  for (let i = 0; i < words.length; i++) {
    const v = words[i]! >>> 0;
    const o = i * 4;
    bytes[o] = v & 0xff;
    bytes[o + 1] = (v >>> 8) & 0xff;
    bytes[o + 2] = (v >>> 16) & 0xff;
    bytes[o + 3] = (v >>> 24) & 0xff;
  }
  return toB64(bytes);
}

/** Inverse of u32ToB64 — throws unless byteLength % 4 === 0. */
export function b64ToU32(s: string): Uint32Array {
  const bytes = fromB64(s);
  if (bytes.byteLength % 4 !== 0) {
    throw new Error(`u32 payload not word-aligned: ${bytes.byteLength} bytes`);
  }
  const out = new Uint32Array(bytes.byteLength >> 2);
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    out[i] =
      (bytes[o]! | (bytes[o + 1]! << 8) | (bytes[o + 2]! << 16) | (bytes[o + 3]! << 24)) >>> 0;
  }
  return out;
}

export interface FloorExtras {
  signContents: SignWire[]; echoes: EchoWire[]; corpseIds: string[];
}

const copyEntity = (e: Entity): EntityWire => ({
  id: e.id, kind: e.kind, x: e.x, y: e.y, hp: e.hp, state: e.state, data: e.data,
});

const copyFrames = (
  frames: readonly (readonly [number, number, number])[],
): [number, number, number][] => frames.map((f) => [f[0], f[1], f[2]]);

/**
 * FloorData → wire. Round-trips exactly with floorFromWire: tiles/chalk/signs
 * via toB64, entities copied field-for-field, rngInit via u32ToB64. No other
 * serialization of FloorData may exist (contract §1.3).
 */
export function floorToWire(fd: FloorData, rngInit: Uint32Array, extras: FloorExtras): FloorWire {
  const wire: FloorWire = {
    floor: fd.floor,
    w: fd.w,
    h: fd.h,
    tiles: toB64(fd.tiles),
    px: fd.px,
    py: fd.py,
    entities: fd.entities.map(copyEntity),
    nextEntityId: fd.nextEntityId,
    rngInit: u32ToB64(rngInit),
    signContents: extras.signContents.map((s) => ({
      tileIndex: s.tileIndex, template: s.template, noun: s.noun,
    })),
    echoes: extras.echoes.map((e) => ({
      day: e.day, floor: e.floor, frames: copyFrames(e.frames),
    })),
    corpseIds: [...extras.corpseIds],
  };
  if (fd.chalk !== undefined) wire.chalk = toB64(fd.chalk);
  if (fd.signs !== undefined) wire.signs = toB64(fd.signs);
  return wire;
}

/** Wire → FloorData (+ rngInit + extras). Exact inverse of floorToWire. */
export function floorFromWire(w: FloorWire): {
  floorData: FloorData; rngInit: Uint32Array; extras: FloorExtras;
} {
  const floorData: FloorData = {
    floor: w.floor,
    w: w.w,
    h: w.h,
    tiles: fromB64(w.tiles),
    px: w.px,
    py: w.py,
    entities: w.entities.map(copyEntity),
    nextEntityId: w.nextEntityId,
  };
  if (w.chalk !== undefined) floorData.chalk = fromB64(w.chalk);
  if (w.signs !== undefined) floorData.signs = fromB64(w.signs);
  return {
    floorData,
    rngInit: b64ToU32(w.rngInit),
    extras: {
      signContents: w.signContents.map((s) => ({
        tileIndex: s.tileIndex, template: s.template, noun: s.noun,
      })),
      echoes: w.echoes.map((e) => ({
        day: e.day, floor: e.floor, frames: copyFrames(e.frames),
      })),
      corpseIds: [...w.corpseIds],
    },
  };
}
