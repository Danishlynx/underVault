/**
 * Client-side ports. The client NEVER resolves secret rules itself and NEVER
 * holds the day seed — it asks a port. In the dev slice the port is
 * dev/rules-adapter.ts (local, synchronous, DEV-ONLY); at M2 this becomes
 * net/api.ts + batcher.ts speaking /api/run/* with the synchronous flush
 * masked by anticipation animation (02 §4).
 */

import type { FloorData, MutableRuleTable } from "../../shared/sim/types.js";

export interface FloorPayloadLike {
  floorData: FloorData;
  rngInit: Uint32Array;
}

export interface GamePorts {
  /** Resolve a secret interaction outcome (subject|verb|object|cond). */
  resolveRule(key: string): number;
  /** Fetch a floor layout. The seed stays behind the port. */
  getFloor(floor: number): FloorPayloadLike;
}

export interface LearnedRule {
  key: string;
  effect: number;
}

/** Session-learned rule cache (02 §4: each secret costs one round-trip per
 *  run at most; everything known resolves locally at zero latency). */
export class SessionRules implements MutableRuleTable {
  private readonly cache = new Map<string, number>();
  /** Rules learned in resolution order — feeds the Waystone sheet. */
  readonly learned: LearnedRule[] = [];

  get(key: string): number | undefined {
    return this.cache.get(key);
  }

  set(key: string, effect: number): void {
    if (!this.cache.has(key)) this.learned.push({ key, effect });
    this.cache.set(key, effect);
  }
}
