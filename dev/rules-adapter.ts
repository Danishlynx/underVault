// DEV-ONLY: deleted at M2.
// This adapter is the one sanctioned bridge to src/server/rules for local
// play (Track B clause). It lives OUTSIDE src/client and src/shared so the
// tools/no-secret-leak guard keeps the shipped surfaces provably clean.
// At M2 it is replaced by net/api.ts + the /api/run/act synchronous flush.

import { resolveRuleKey } from "../src/server/rules/resolve.js";
import { generateFloor } from "../src/shared/gen/index.js";
import type { GamePorts, FloorPayloadLike } from "../src/client/net/ports.js";

/** Fixed dev seed (Track B: fixed seed, instant restart, no daily limit). */
export const DAY_SEED = 20260708;

export function createDevPorts(): GamePorts {
  return {
    resolveRule(key: string): number {
      return resolveRuleKey(key);
    },
    getFloor(floor: number): FloorPayloadLike {
      return generateFloor(DAY_SEED, floor);
    },
  };
}
