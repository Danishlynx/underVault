/**
 * Byte layer v2 (02 §3). logV 2: each 6-bit opcode is followed by
 * ARG_BITS[op] argument bits (USE: slot·dir, SIGN: template·noun).
 * Canonical serialization STATE_V 2 — field order FROZEN; any change bumps
 * STATE_V in types.ts and regenerates every golden. fx RNG (words 16..19)
 * DELIBERATELY OMITTED from serialization.
 */

import { ARG_BITS, LOG_V, ACTION_MAX, type SimState, type Step } from "./types.js";

// ── Action log codec ───────────────────────────────────────────────────────
// Frame: u8 logV · u16 LE count · count × (6-bit opcode + ARG_BITS[op] bits)

class BitWriter {
  bytes: number[] = [];
  private acc = 0;
  private nbits = 0;
  write(value: number, bits: number): void {
    for (let b = bits - 1; b >= 0; b--) {
      this.acc = (this.acc << 1) | ((value >> b) & 1);
      this.nbits++;
      if (this.nbits === 8) {
        this.bytes.push(this.acc & 0xff);
        this.acc = 0;
        this.nbits = 0;
      }
    }
  }
  finish(): void {
    if (this.nbits > 0) {
      this.bytes.push((this.acc << (8 - this.nbits)) & 0xff);
      this.acc = 0;
      this.nbits = 0;
    }
  }
}

class BitReader {
  private pos = 0;
  constructor(private readonly bytes: Uint8Array, private readonly offset: number) {}
  read(bits: number): number {
    let v = 0;
    for (let b = 0; b < bits; b++) {
      const byteIdx = this.offset + (this.pos >> 3);
      if (byteIdx >= this.bytes.length) throw new Error("action log truncated (payload)");
      v = (v << 1) | ((this.bytes[byteIdx]! >> (7 - (this.pos & 7))) & 1);
      this.pos++;
    }
    return v;
  }
}

export function packActions(steps: readonly Step[]): Uint8Array {
  const w = new BitWriter();
  for (const s of steps) {
    if (s.op < 0 || s.op > 63) throw new Error(`opcode out of range: ${s.op}`);
    w.write(s.op, 6);
    const extra = ARG_BITS[s.op] ?? 0;
    if (extra > 0) w.write(s.arg & ((1 << extra) - 1), extra);
  }
  w.finish();
  const out = new Uint8Array(3 + w.bytes.length);
  out[0] = LOG_V;
  out[1] = steps.length & 0xff;
  out[2] = (steps.length >> 8) & 0xff;
  out.set(w.bytes, 3);
  return out;
}

export function unpackActions(bytes: Uint8Array): Step[] {
  if (bytes.length < 3) throw new Error("action log truncated (header)");
  if (bytes[0] !== LOG_V) throw new Error(`unsupported logV: ${bytes[0]}`);
  const n = bytes[1]! | (bytes[2]! << 8);
  const r = new BitReader(bytes, 3);
  const out: Step[] = [];
  for (let i = 0; i < n; i++) {
    const op = r.read(6);
    if (op > ACTION_MAX) throw new Error(`unknown opcode ${op} at index ${i}`);
    const extra = ARG_BITS[op] ?? 0;
    const arg = extra > 0 ? r.read(extra) : 0;
    out.push({ op, arg });
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

// ── Canonical state serialization (STATE_V 2) ──────────────────────────────

export function serializeState(s: SimState): Uint8Array {
  const n = s.w * s.h;
  const size =
    1 + 2 + 4 + 1 + 1 + n /*tiles*/ + 1 + 1 + 2 +
    6 /*candle..deathCause*/ + 6 + 6 + 1 /*heirloom*/ +
    3 /*noise*/ + 1 /*alert*/ + 4 /*ritualTile*/ + 1 + 1 + 1 /*ritual/signs/banked*/ +
    6 /*mods*/ + 4 + 2 + s.entities.length * 12 +
    n * 6 /*salt chalk fire gas signs seen*/ + 16 * 4;
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
  dv.setUint8(o, s.heirloom); o += 1;
  dv.setUint8(o, s.noiseX); o += 1;
  dv.setUint8(o, s.noiseY); o += 1;
  dv.setUint8(o, s.noiseLevel); o += 1;
  dv.setUint8(o, s.alertTicks); o += 1;
  dv.setInt32(o, s.ritualTile, true); o += 4;
  dv.setUint8(o, s.ritualCount); o += 1;
  dv.setUint8(o, s.signsLeft); o += 1;
  dv.setUint8(o, s.banked); o += 1;
  dv.setUint8(o, s.mods.graceTicks); o += 1;
  dv.setUint8(o, s.mods.burnBasic); o += 1;
  dv.setUint8(o, s.mods.radiusPenalty); o += 1;
  dv.setUint8(o, s.mods.quietFeet); o += 1;
  dv.setUint8(o, s.mods.beastEar); o += 1;
  dv.setUint8(o, s.mods.echoRadius); o += 1;
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
  u8.set(s.gas, o); o += n;
  u8.set(s.signs, o); o += n;
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
