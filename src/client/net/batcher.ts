/**
 * src/client/net/batcher.ts — the act batcher (08 §7).
 *
 * Accumulates every action the driver applies to the local sim and ships them
 * to /api/run/act as pack.ts frames. Flush rules (all implemented here):
 *
 *   - auto-flush when 12 acts are pending;
 *   - auto-flush 5 s after the FIRST unflushed act (timer is not reset by
 *     later pushes);
 *   - explicit flush() force-drains (unknown rule / descend / bank / end);
 *   - never more than one request in flight (a serialized send chain);
 *   - ≥1 s between a flush completion and the next request (mirrors the
 *     server's ACT_MIN_SPACING_MS rate gate — 08 §0.3/§2);
 *   - retries are byte-idempotent: the SAME fromTick + the SAME frame bytes
 *     are re-sent on transport failure; acts pushed meanwhile wait for the
 *     next segment (the server's (token, fromTick, actions) idempotency key
 *     then re-replays or appends correctly — 08 §2 act row).
 *
 * Segment sealing constraints (mirrors src/server semantics — read, never
 * imported):
 *   - a DESCEND act closes its segment: server replay crosses floors lazily
 *     and the next floor's entry ts is only stamped by /api/run/descend, so
 *     steps after a DESCEND in the same segment would "outrun the stairs";
 *   - a segment that crosses a 32-step checkpoint boundary MUST carry
 *     `checkHash` = h32Hex(state after its last step). Hashes arrive as lazy
 *     thunks (the remote-ports shadow sim backfills them once unknown rules
 *     resolve); when the tail hash is unknowable the segment shrinks until
 *     the boundary is covered by a hashed act. The irreducible case — an
 *     unknown-rule act that itself completes a 32-step block — rides the
 *     server's single-act valve: /act accepts a hash-less crossing when the
 *     segment carries exactly one act (run.ts), because that flush is the
 *     only way the client can learn the rule it needs to hash with.
 *   - segments never exceed 256 steps (server MAX_SEGMENT_STEPS).
 */

import type { ActReq, ActRes, CorpseYieldWire, LearnedRuleWire } from "../../shared/protocol.js";
import { CHECKPOINT_EVERY, packActions, toB64 } from "../../shared/sim/pack.js";
import { Action, type Step } from "../../shared/sim/types.js";
import { ApiError, NetworkError } from "./api.js";

export const FLUSH_AT_ACTS = 12;
export const FLUSH_AFTER_MS = 5000;
/** Client mirror of server ACT_MIN_SPACING_MS (08 §0.3) — do not lower. */
export const MIN_SPACING_MS = 1000;
export const RETRY_DELAY_MS = 1000;
/** Client mirror of server MAX_SEGMENT_STEPS (08 §0.3). */
export const SEGMENT_MAX_STEPS = 256;

export type SendFn = (req: ActReq) => Promise<ActRes>;

/** Accumulated result of one flush() drain (may span several segments). */
export interface FlushOutcome {
  serverTick: number;
  rules: LearnedRuleWire[];
  corpses: CorpseYieldWire[];
}

export interface ActBatcherOpts {
  token: string;
  send: SendFn;
  /** Called with every successful ActRes — the rule/corpse cache fill hook. */
  onResult?: (res: ActRes) => void;
  /** Called once when a non-retryable error kills the batcher. */
  onFatal?: (err: unknown) => void;
  /** Injectable clock (tests). Defaults to Date.now. */
  now?: () => number;
  /** Steps the server already holds — mid-run resume sets this (M2b). */
  fromTick?: number;
}

interface QueuedAct {
  op: number;
  arg: number;
  atTick: number;
  /** Lazy state hash AFTER this act; null while not yet computable. */
  hashAfter: () => string | null;
}

interface SealedSegment {
  count: number;
  checkHash: string | undefined;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  return err instanceof ApiError && (err.code === "RATE" || err.code === "CONFLICT");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class ActBatcher {
  private readonly q: QueuedAct[] = [];
  private acked: number; // steps the server has acknowledged (== next fromTick)
  private lastDoneAt = Number.NEGATIVE_INFINITY;
  private chain: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private fatalErr: unknown = null;

  constructor(private readonly opts: ActBatcherOpts) {
    this.acked = opts.fromTick ?? 0;
  }

  /** Steps acknowledged by the server so far. */
  get ackedSteps(): number {
    return this.acked;
  }

  /** Acts accumulated and not yet acknowledged. */
  get pendingCount(): number {
    return this.q.length;
  }

  get fatal(): unknown {
    return this.fatalErr;
  }

  push(op: number, arg: number, atTick: number, hashAfter: () => string | null): void {
    if (this.fatalErr !== null) return; // the run is already void — acts are moot
    this.q.push({ op, arg, atTick, hashAfter });
    if (this.q.length >= FLUSH_AT_ACTS) {
      this.clearTimer();
      this.enqueueDrain();
    } else if (this.timer === null) {
      // 5 s since the FIRST unflushed act — later pushes do not reset it
      this.timer = setTimeout(() => {
        this.timer = null;
        this.enqueueDrain();
      }, FLUSH_AFTER_MS);
    }
  }

  /** Force-drain every pending act (before unknown-rule / descend / bank / end). */
  flush(): Promise<FlushOutcome> {
    if (this.fatalErr !== null) return Promise.reject(this.fatalErr);
    this.clearTimer();
    return new Promise<FlushOutcome>((resolve, reject) => {
      this.chain = this.chain.then(async () => {
        try {
          resolve(await this.drainAll());
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
  }

  dispose(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private enqueueDrain(): void {
    this.chain = this.chain.then(async () => {
      try {
        await this.drainAll();
      } catch {
        // recorded as fatal inside drainAll; surfaced on the next flush()
      }
    });
  }

  private async drainAll(): Promise<FlushOutcome> {
    if (this.fatalErr !== null) throw this.fatalErr;
    const out: FlushOutcome = { serverTick: this.acked, rules: [], corpses: [] };
    while (this.q.length > 0) {
      let res: ActRes;
      try {
        res = await this.sendSegment();
      } catch (err) {
        this.fatalErr = err;
        this.opts.onFatal?.(err);
        throw err;
      }
      out.serverTick = res.serverTick;
      out.rules.push(...res.rules);
      out.corpses.push(...res.corpses);
    }
    return out;
  }

  /**
   * Choose the longest sendable prefix of the queue:
   *   1. cap at SEGMENT_MAX_STEPS;
   *   2. cut right after the first DESCEND (see module doc);
   *   3. if the segment crosses a 32-step checkpoint boundary, its tail act
   *      must carry a known hash — shrink until it does (or until the
   *      boundary leaves the segment);
   *   4. server valve (run.ts /act): a SINGLE-act crossing may go hash-less —
   *      the unknown-rule act that completes a 32-block cannot be hashed
   *      before the server reveals its rule, and this flush is how it learns
   *      it. Hash coverage resumes at the next boundary.
   * Returns null only if the queue is empty (guarded by drainAll) — every
   * non-empty queue is sendable; a multi-act crossing is never sent hash-less.
   */
  private seal(): SealedSegment | null {
    let n = Math.min(this.q.length, SEGMENT_MAX_STEPS);
    for (let i = 0; i < n; i++) {
      if (this.q[i]!.op === Action.DESCEND) {
        n = i + 1;
        break;
      }
    }
    while (n > 0) {
      const crossing =
        Math.floor((this.acked + n) / CHECKPOINT_EVERY) >
        Math.floor(this.acked / CHECKPOINT_EVERY);
      if (!crossing) return { count: n, checkHash: undefined };
      const h = this.q[n - 1]!.hashAfter();
      if (h !== null) return { count: n, checkHash: h };
      if (n === 1) return { count: 1, checkHash: undefined }; // the valve
      n--;
    }
    return null;
  }

  private async sendSegment(): Promise<ActRes> {
    const sealed = this.seal();
    if (sealed === null) {
      // defensive: unreachable while the queue is non-empty (see seal())
      throw new Error("act batcher sealed an empty segment — batcher bug");
    }
    const steps: Step[] = this.q
      .slice(0, sealed.count)
      .map((a) => ({ op: a.op, arg: a.arg }));
    const req: ActReq = {
      token: this.opts.token,
      logV: 2,
      fromTick: this.acked,
      actions: toB64(packActions(steps)),
    };
    if (sealed.checkHash !== undefined) req.checkHash = sealed.checkHash;

    // retry loop: byte-idempotent — same fromTick, same frame, same hash
    for (;;) {
      await this.spacing();
      try {
        const res = await this.opts.send(req);
        this.lastDoneAt = this.now();
        this.q.splice(0, sealed.count);
        this.acked += sealed.count;
        this.opts.onResult?.(res);
        return res;
      } catch (err) {
        this.lastDoneAt = this.now(); // a failed round-trip still spaces the next
        if (!isRetryable(err)) throw err;
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  private async spacing(): Promise<void> {
    const wait = MIN_SPACING_MS - (this.now() - this.lastDoneAt);
    if (wait > 0) await delay(wait);
  }

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }
}
