// ActBatcher — framing, flush triggers, retry idempotency, spacing, and the
// checkpoint-hash sealing rules (08 §7 + server /act semantics).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActReq, ActRes } from "../../shared/protocol.js";
import { fromB64, unpackActions } from "../../shared/sim/pack.js";
import { Action, type Step } from "../../shared/sim/types.js";
import { ApiError, NetworkError } from "./api.js";
import {
  ActBatcher,
  FLUSH_AFTER_MS,
  FLUSH_AT_ACTS,
  MIN_SPACING_MS,
  RETRY_DELAY_MS,
} from "./batcher.js";

const TOKEN = "0123456789abcdef0123456789abcdef";

function okRes(serverTick: number, rules: { key: string; effect: number }[] = []): ActRes {
  return { serverTick, events: [], rules, corpses: [] };
}

/** Mock send that snapshots every request (deep copy — retry-byte assertions). */
function makeSend(...outcomes: (ActRes | Error)[]) {
  const calls: ActReq[] = [];
  const send = vi.fn(async (req: ActReq): Promise<ActRes> => {
    calls.push(JSON.parse(JSON.stringify(req)) as ActReq);
    const next = outcomes.length > 0 ? outcomes.shift()! : okRes(0);
    if (next instanceof Error) throw next;
    return next;
  });
  return { send, calls };
}

function decodeSteps(req: ActReq): Step[] {
  return unpackActions(fromB64(req.actions));
}

const knownHash = (h: string) => (): string | null => h;
const noHash = (): string | null => null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("framing", () => {
  it("ships a pack.ts frame: logV 2, fromTick 0, decodable back to the pushed steps", async () => {
    const { send, calls } = makeSend(okRes(4));
    const b = new ActBatcher({ token: TOKEN, send });
    b.push(Action.WAIT, 0, 0, knownHash("00000001"));
    b.push(Action.MOVE_N, 0, 1, knownHash("00000002"));
    b.push(Action.USE, 22, 2, knownHash("00000003")); // 5 ARG_BITS payload
    b.push(Action.SIGN, 200, 3, knownHash("00000004")); // 8 ARG_BITS payload

    const out = await b.flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.token).toBe(TOKEN);
    expect(calls[0]!.logV).toBe(2);
    expect(calls[0]!.fromTick).toBe(0);
    expect(calls[0]!.checkHash).toBeUndefined(); // no 32-step boundary crossed
    expect(decodeSteps(calls[0]!)).toEqual([
      { op: Action.WAIT, arg: 0 },
      { op: Action.MOVE_N, arg: 0 },
      { op: Action.USE, arg: 22 },
      { op: Action.SIGN, arg: 200 },
    ]);
    expect(out.serverTick).toBe(4);
    expect(b.ackedSteps).toBe(4);
    expect(b.pendingCount).toBe(0);
  });

  it("advances fromTick across flushes", async () => {
    const { send, calls } = makeSend(okRes(2), okRes(3));
    const b = new ActBatcher({ token: TOKEN, send });
    b.push(Action.WAIT, 0, 0, knownHash("00000001"));
    b.push(Action.WAIT, 0, 1, knownHash("00000002"));
    await b.flush();
    b.push(Action.MOVE_E, 0, 2, knownHash("00000003"));
    const p = b.flush();
    await vi.advanceTimersByTimeAsync(MIN_SPACING_MS); // inter-flush spacing
    await p;
    expect(calls[1]!.fromTick).toBe(2);
    expect(decodeSteps(calls[1]!)).toEqual([{ op: Action.MOVE_E, arg: 0 }]);
  });
});

describe("flush triggers", () => {
  it("auto-flushes when 12 acts are pending", async () => {
    const { send, calls } = makeSend(okRes(FLUSH_AT_ACTS));
    const b = new ActBatcher({ token: TOKEN, send });
    for (let i = 0; i < FLUSH_AT_ACTS; i++) b.push(Action.WAIT, 0, i, knownHash("00000001"));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    expect(decodeSteps(calls[0]!)).toHaveLength(FLUSH_AT_ACTS);
    expect(b.pendingCount).toBe(0);
  });

  it("auto-flushes 5 s after the FIRST unflushed act (later pushes do not reset)", async () => {
    const { send, calls } = makeSend(okRes(2));
    const b = new ActBatcher({ token: TOKEN, send });
    b.push(Action.WAIT, 0, 0, knownHash("00000001"));
    await vi.advanceTimersByTimeAsync(FLUSH_AFTER_MS - 1000);
    b.push(Action.WAIT, 0, 1, knownHash("00000002")); // must NOT reset the timer
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(1);
    expect(decodeSteps(calls[0]!)).toHaveLength(2);
  });

  it("explicit flush() with nothing pending resolves without a request", async () => {
    const { send, calls } = makeSend();
    const b = new ActBatcher({ token: TOKEN, send });
    const out = await b.flush();
    expect(calls).toHaveLength(0);
    expect(out).toEqual({ serverTick: 0, rules: [], corpses: [] });
  });
});

describe("retry idempotency", () => {
  it("re-sends the SAME fromTick and SAME bytes after a network failure", async () => {
    const { send, calls } = makeSend(new NetworkError("gone"), okRes(2));
    const b = new ActBatcher({ token: TOKEN, send });
    b.push(Action.WAIT, 0, 0, knownHash("00000001"));
    b.push(Action.MOVE_S, 0, 1, knownHash("00000002"));
    const p = b.flush();
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    await p;
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]); // byte-identical retry
    expect(b.ackedSteps).toBe(2); // acked exactly once
  });

  it("acts pushed during a retry wait for the next segment (frozen bytes)", async () => {
    const { send, calls } = makeSend(new NetworkError("gone"), okRes(1), okRes(2));
    const b = new ActBatcher({ token: TOKEN, send });
    b.push(Action.WAIT, 0, 0, knownHash("00000001"));
    const p = b.flush();
    await vi.advanceTimersByTimeAsync(0);
    b.push(Action.MOVE_W, 0, 1, knownHash("00000002")); // arrives mid-retry
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + MIN_SPACING_MS);
    await p;
    expect(calls).toHaveLength(3);
    expect(calls[1]).toEqual(calls[0]); // retry did not absorb the new act
    expect(calls[2]!.fromTick).toBe(1);
    expect(decodeSteps(calls[2]!)).toEqual([{ op: Action.MOVE_W, arg: 0 }]);
  });

  it("retries after 429 RATE with the same payload", async () => {
    const { send, calls } = makeSend(new ApiError(429, "RATE", "rushed hand"), okRes(1));
    const b = new ActBatcher({ token: TOKEN, send });
    b.push(Action.WAIT, 0, 0, knownHash("00000001"));
    const p = b.flush();
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + MIN_SPACING_MS);
    await p;
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
  });

  it("a non-retryable error is fatal: flush rejects, later pushes are ignored", async () => {
    const boom = new ApiError(422, "DESYNC", "the Ledger disagrees");
    const onFatal = vi.fn();
    const { send, calls } = makeSend(boom);
    const b = new ActBatcher({ token: TOKEN, send, onFatal });
    b.push(Action.WAIT, 0, 0, knownHash("00000001"));
    await expect(b.flush()).rejects.toBe(boom);
    expect(onFatal).toHaveBeenCalledWith(boom);
    b.push(Action.WAIT, 0, 1, knownHash("00000002"));
    expect(b.pendingCount).toBe(1); // untouched — the run is void
    await expect(b.flush()).rejects.toBe(boom);
    expect(calls).toHaveLength(1); // nothing further went out
  });
});

describe("spacing", () => {
  it("waits ≥1 s between a completion and the next request", async () => {
    const { send, calls } = makeSend(okRes(1), okRes(2));
    const b = new ActBatcher({ token: TOKEN, send });
    b.push(Action.WAIT, 0, 0, knownHash("00000001"));
    await b.flush(); // first send is immediate
    b.push(Action.WAIT, 0, 1, knownHash("00000002"));
    const p = b.flush();
    await vi.advanceTimersByTimeAsync(MIN_SPACING_MS - 1);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(calls).toHaveLength(2);
  });
});

describe("segment sealing", () => {
  it("a DESCEND closes its segment; later acts ride the next one", async () => {
    const { send, calls } = makeSend(okRes(2), okRes(3));
    const b = new ActBatcher({ token: TOKEN, send });
    b.push(Action.MOVE_N, 0, 0, knownHash("00000001"));
    b.push(Action.DESCEND, 0, 1, knownHash("00000002"));
    b.push(Action.MOVE_S, 0, 2, knownHash("00000003"));
    const p = b.flush();
    await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
    await p;
    expect(calls).toHaveLength(2);
    expect(decodeSteps(calls[0]!)).toEqual([
      { op: Action.MOVE_N, arg: 0 },
      { op: Action.DESCEND, arg: 0 },
    ]);
    expect(decodeSteps(calls[1]!)).toEqual([{ op: Action.MOVE_S, arg: 0 }]);
  });

  it("attaches checkHash when the segment crosses a 32-step boundary", async () => {
    const { send, calls } = makeSend(okRes(31), okRes(33));
    const b = new ActBatcher({ token: TOKEN, send });
    for (let i = 0; i < 31; i++) b.push(Action.WAIT, 0, i, knownHash("0000aaaa"));
    await b.flush();
    expect(calls[0]!.checkHash).toBeUndefined(); // 0 → 31: no boundary crossed
    b.push(Action.WAIT, 0, 31, knownHash("0000bbbb"));
    b.push(Action.WAIT, 0, 32, knownHash("0000cccc"));
    const p = b.flush();
    await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
    await p;
    expect(calls).toHaveLength(2);
    expect(calls[1]!.checkHash).toBe("0000cccc"); // hash AFTER the segment's last step
  });

  it("shrinks a crossing segment until its tail hash is known", async () => {
    const { send, calls } = makeSend(okRes(31), okRes(32), okRes(33));
    const b = new ActBatcher({ token: TOKEN, send });
    for (let i = 0; i < 31; i++) b.push(Action.WAIT, 0, i, knownHash("0000aaaa"));
    await b.flush();
    // the boundary-completing act is hashed; the unknown-rule act is not yet
    b.push(Action.MOVE_N, 0, 31, knownHash("0000bbbb"));
    b.push(Action.INTERACT_N, 0, 32, noHash);
    const p = b.flush();
    await vi.advanceTimersByTimeAsync(2 * MIN_SPACING_MS);
    await p;
    expect(calls).toHaveLength(3);
    expect(decodeSteps(calls[1]!)).toEqual([{ op: Action.MOVE_N, arg: 0 }]);
    expect(calls[1]!.checkHash).toBe("0000bbbb"); // crossing 31→32 sealed alone
    expect(decodeSteps(calls[2]!)).toEqual([{ op: Action.INTERACT_N, arg: 0 }]);
    expect(calls[2]!.checkHash).toBeUndefined(); // 32→33 crosses nothing
  });

  it("valve: an unhashable act that itself completes a 32-block flushes hash-less alone", async () => {
    const { send, calls } = makeSend(okRes(31), okRes(32));
    const b = new ActBatcher({ token: TOKEN, send });
    for (let i = 0; i < 31; i++) b.push(Action.WAIT, 0, i, knownHash("0000aaaa"));
    await b.flush();
    b.push(Action.INTERACT_N, 0, 31, noHash); // completes step 32 — unknown rule
    const p = b.flush();
    await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
    await p; // formerly checkpoint-blocked — now rides the server's single-act valve
    expect(calls).toHaveLength(2);
    expect(decodeSteps(calls[1]!)).toEqual([{ op: Action.INTERACT_N, arg: 0 }]);
    expect(calls[1]!.checkHash).toBeUndefined(); // hash-less single-act crossing
    expect(b.ackedSteps).toBe(32);
    expect(b.fatal).toBeNull(); // the batcher lives on
  });

  it("never sends a multi-act crossing hash-less: unhashable tails shrink to one act", async () => {
    const { send, calls } = makeSend(okRes(31), okRes(32), okRes(33));
    const b = new ActBatcher({ token: TOKEN, send });
    for (let i = 0; i < 31; i++) b.push(Action.WAIT, 0, i, knownHash("0000aaaa"));
    await b.flush();
    b.push(Action.INTERACT_N, 0, 31, noHash); // both unhashable — cannot seal together
    b.push(Action.INTERACT_E, 0, 32, noHash);
    const p = b.flush();
    await vi.advanceTimersByTimeAsync(2 * MIN_SPACING_MS);
    await p;
    expect(calls).toHaveLength(3);
    expect(decodeSteps(calls[1]!)).toEqual([{ op: Action.INTERACT_N, arg: 0 }]); // valve, alone
    expect(calls[1]!.checkHash).toBeUndefined();
    expect(decodeSteps(calls[2]!)).toEqual([{ op: Action.INTERACT_E, arg: 0 }]); // 32→33: no crossing
    expect(calls[2]!.checkHash).toBeUndefined();
  });
});

describe("results", () => {
  it("flush() accumulates rules/corpses across every drained segment", async () => {
    const { send } = makeSend(
      { ...okRes(2), rules: [{ key: "rat|bump|torch", effect: 2 }] },
      { ...okRes(3), rules: [{ key: "moth|touch|flame", effect: 1 }] },
    );
    const onResult = vi.fn();
    const b = new ActBatcher({ token: TOKEN, send, onResult });
    b.push(Action.WAIT, 0, 0, knownHash("00000001"));
    b.push(Action.DESCEND, 0, 1, knownHash("00000002")); // forces two segments
    b.push(Action.WAIT, 0, 2, knownHash("00000003"));
    const p = b.flush();
    await vi.advanceTimersByTimeAsync(MIN_SPACING_MS);
    const out = await p;
    expect(out.rules.map((r) => r.key)).toEqual(["rat|bump|torch", "moth|touch|flame"]);
    expect(out.serverTick).toBe(3);
    expect(onResult).toHaveBeenCalledTimes(2);
  });
});
