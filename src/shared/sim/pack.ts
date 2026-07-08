/**
 * The byte layer of the determinism contract (02 §3):
 *  - bit-packed action log codec (logV 1: 6-bit opcodes, ≤400 B @ 500 actions)
 *  - canonical state serialization (STATE_V 1 — field order FROZEN; any
 *    change bumps STATE_V in types.ts and regenerates every golden)
 *  - xxhash32 (h32) over the canonical bytes
 * All integer-only: Math.imul + >>>0; hand-rolled base64 (atob/Buffer are
 * not isomorphic); DataView with explicit littleEndian on every access.
 * The fx RNG slice (words 16..19) is DELIBERATELY OMITTED from serialization.
 */

import { LOG_V, ACTION_MAX, type SimState } from "./types.js";

// ── Action log codec ───────────────────────────────────────────────────────
// Frame: u8 logV · u16 LE count · count × 6-bit opcodes (MSB-first) · pad 0s

export function packActions(actions: readonly number[]): Uint8Array {
  const n = actions.length;
  const bitLen = n * 6;
  const out = new Uint8Array(3 + ((bitLen + 7) >> 3));
  out[0] = LOG_V;
  out[1] = n & 0xff;
  out[2] = (n >> 8) & 0xff;
  let bitPos = 0;
  for (let i = 0; i < n; i++) {
    const op = actions[i]!;
    if (op < 0 || op > 63) throw new Error(`opcode out of range: ${op}`);
    for (let b = 5; b >= 0; b--) {
      const bit = (op >> b) & 1;
      const byteIdx = 3 + (bitPos >> 3);
      out[byteIdx] = (out[byteIdx]! | (bit << (7 - (bitPos & 7)))) & 0xff;
      bitPos++;
    }
  }
  return out;
}

export function unpackActions(bytes: Uint8Array): number[] {
  if (bytes.length < 3) throw new Error("action log truncated (header)");
  if (bytes[0] !== LOG_V) throw new Error(`unsupported logV: ${bytes[0]}`);
  const n = bytes[1]! | (bytes[2]! << 8);
  const need = 3 + ((n * 6 + 7) >> 3);
  if (bytes.length < need) throw new Error("action log truncated (payload)");
  const out: number[] = [];
  let bitPos = 0;
  for (let i = 0; i < n; i++) {
    let op = 0;
    for (let b = 0; b < 6; b++) {
      const byteIdx = 3 + (bitPos >> 3);
      op = (op << 1) | ((bytes[byteIdx]! >> (7 - (bitPos & 7))) & 1);
      bitPos++;
    }
    if (op > ACTION_MAX) throw new Error(`unknown opcode ${op} at index ${i}`);
    out.push(op);
  }
  return out;
}

// ── base64 (hand-rolled, isomorphic) ───────────────────────────────────────
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_REV: Int16Array = (() => {
  const rev = new Int16Array(128).fill(-1);
  for (let i = 0; i < 64; i++) rev[B64.charCodeAt(i)] = i;
  return rev;
})();

export function toB64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += B64[b0 >> 2]! + B64[((b0 & 3) << 4) | (b1 >> 4)]!;
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)]! : "=";
    out += i + 2 < bytes.length ? B64[b2 & 63]! : "=";
  }
  return out;
}

export function fromB64(s: string): Uint8Array {
  if (s.length % 4 !== 0) throw new Error("bad base64 length");
  let pad = 0;
  if (s.endsWith("==")) pad = 2;
  else if (s.endsWith("=")) pad = 1;
  const out = new Uint8Array((s.length >> 2) * 3 - pad);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const c0 = B64_REV[s.charCodeAt(i)]!;
    const c1 = B64_REV[s.charCodeAt(i + 1)]!;
    const c2 = s[i + 2] === "=" ? 0 : B64_REV[s.charCodeAt(i + 2)]!;
    const c3 = s[i + 3] === "=" ? 0 : B64_REV[s.charCodeAt(i + 3)]!;
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) throw new Error("bad base64 char");
    const trip = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (o < out.length) out[o++] = (trip >> 16) & 0xff;
    if (o < out.length) out[o++] = (trip >> 8) & 0xff;
    if (o < out.length) out[o++] = trip & 0xff;
  }
  return out;
}

// ── Canonical state serialization (STATE_V 1) ──────────────────────────────

export function serializeState(s: SimState): Uint8Array {
  const n = s.w * s.h;
  const size =
    1 + 2 + 4 + 1 + 1 + n /*tiles*/ + 1 + 1 + 2 + 1 + 1 + 1 + 1 + 1 + 1 +
    6 + 6 + 1 + 1 + 1 + 4 + 2 + s.entities.length * 12 +
    n /*salt*/ + n /*chalk*/ + n /*fire*/ + n /*seen*/ + 16 * 4;
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let o = 0;
  dv.setUint8(o, s.stateV); o += 1;
  dv.setUint16(o, s.floor, true); o += 2;
  dv.setUint32(o, s.tick >>> 0, true); o += 4;
  dv.setUint8(o, s.w); o += 1;
  dv.setUint8(o, s.h); o += 1;
  u8.set(s.tiles, o); o += n;
  dv.setUint8(o, s.px); o += 1;
  dv.setUint8(o, s.py); o += 1;
  dv.setUint16(o, s.wax, true); o += 2;
  dv.setUint8(o, s.candle); o += 1;
  dv.setUint8(o, s.candleTimer); o += 1;
  dv.setUint8(o, s.candlePending); o += 1;
  dv.setUint8(o, s.graceLeft); o += 1;
  dv.setUint8(o, s.status); o += 1;
  dv.setUint8(o, s.deathCause); o += 1;
  u8.set(s.inv, o); o += 6;
  u8.set(s.invCharges, o); o += 6;
  dv.setUint8(o, s.noiseX); o += 1;
  dv.setUint8(o, s.noiseY); o += 1;
  dv.setUint8(o, s.noiseLevel); o += 1;
  dv.setUint32(o, s.nextEntityId >>> 0, true); o += 4;
  dv.setUint16(o, s.entities.length, true); o += 2;
  for (let i = 0; i < s.entities.length; i++) {
    const e = s.entities[i]!;
    dv.setUint32(o, e.id >>> 0, true); o += 4;
    dv.setUint8(o, e.kind); o += 1;
    dv.setUint8(o, e.x); o += 1;
    dv.setUint8(o, e.y); o += 1;
    dv.setInt16(o, e.hp, true); o += 2;
    dv.setUint8(o, e.state); o += 1;
    dv.setUint16(o, e.data, true); o += 2;
  }
  u8.set(s.salt, o); o += n;
  u8.set(s.chalk, o); o += n;
  u8.set(s.fire, o); o += n;
  u8.set(s.seen, o); o += n;
  for (let i = 0; i < 16; i++) {
    // fx words 16..19 omitted — quarantined from validated state
    dv.setUint32(o, s.rng[i]!, true); o += 4;
  }
  if (o !== size) throw new Error(`serializer drift: wrote ${o}, sized ${size}`);
  return u8;
}

// ── xxhash32 ───────────────────────────────────────────────────────────────
const P1 = 0x9e3779b1, P2 = 0x85ebca77, P3 = 0xc2b2ae3d, P4 = 0x27d4eb2f, P5 = 0x165667b1;

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

export function xxhash32(data: Uint8Array, seed: number): number {
  const len = data.length;
  let i = 0;
  let h: number;
  if (len >= 16) {
    let v1 = (seed + P1 + P2) >>> 0;
    let v2 = (seed + P2) >>> 0;
    let v3 = seed >>> 0;
    let v4 = (seed - P1) >>> 0;
    const limit = len - 16;
    while (i <= limit) {
      const l1 = data[i]! | (data[i + 1]! << 8) | (data[i + 2]! << 16) | (data[i + 3]! << 24);
      v1 = Math.imul(rotl((v1 + Math.imul(l1 >>> 0, P2)) >>> 0, 13), P1) >>> 0;
      const l2 = data[i + 4]! | (data[i + 5]! << 8) | (data[i + 6]! << 16) | (data[i + 7]! << 24);
      v2 = Math.imul(rotl((v2 + Math.imul(l2 >>> 0, P2)) >>> 0, 13), P1) >>> 0;
      const l3 = data[i + 8]! | (data[i + 9]! << 8) | (data[i + 10]! << 16) | (data[i + 11]! << 24);
      v3 = Math.imul(rotl((v3 + Math.imul(l3 >>> 0, P2)) >>> 0, 13), P1) >>> 0;
      const l4 = data[i + 12]! | (data[i + 13]! << 8) | (data[i + 14]! << 16) | (data[i + 15]! << 24);
      v4 = Math.imul(rotl((v4 + Math.imul(l4 >>> 0, P2)) >>> 0, 13), P1) >>> 0;
      i += 16;
    }
    h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) >>> 0;
  } else {
    h = (seed + P5) >>> 0;
  }
  h = (h + len) >>> 0;
  while (i + 4 <= len) {
    const l = data[i]! | (data[i + 1]! << 8) | (data[i + 2]! << 16) | (data[i + 3]! << 24);
    h = (h + Math.imul(l >>> 0, P3)) >>> 0;
    h = Math.imul(rotl(h, 17), P4) >>> 0;
    i += 4;
  }
  while (i < len) {
    h = (h + Math.imul(data[i]!, P5)) >>> 0;
    h = Math.imul(rotl(h, 11), P1) >>> 0;
    i++;
  }
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, P2) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, P3) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

export const H32_SEED = 0;

export function hashState(s: SimState): number {
  return xxhash32(serializeState(s), H32_SEED);
}

export function h32Hex(s: SimState): string {
  return (hashState(s) >>> 0).toString(16).padStart(8, "0");
}

export const CHECKPOINT_EVERY = 32;
