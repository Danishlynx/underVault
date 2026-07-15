// Invariant 5 / 02 §5 law: no key scans, no Lua, no plain Sets anywhere in the
// data layer. Enforced two ways: (a) the frozen RedisLike surface simply lacks
// those commands, (b) a source sweep over src/server/data keeps banned command
// names from sneaking in through adapters or string escape hatches.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { createMockRedis } from "./redis-mock.js";

const DATA_DIR = dirname(fileURLToPath(import.meta.url));

// Redis command families banned by invariant 5 (scans, Lua, plain Sets).
const BANNED = [
  /\bhScan\s*\(/i,
  /\bzScan\s*\(/i,
  /\.scan\s*\(/i,
  /\beval\s*\(/i,
  /\bevalSha\s*\(/i,
  /\bsAdd\s*\(/i,
  /\bsRem\s*\(/i,
  /\bsMembers\s*\(/i,
  /\bsIsMember\s*\(/i,
  /\bsInter\s*\(/i,
  /\bsUnion\s*\(/i,
  /["'`]KEYS\b/, // raw KEYS command strings
  /["'`]SCAN\b/,
  /["'`]EVAL\b/,
];

const EXPECTED_SURFACE = [
  "get",
  "set",
  "del",
  "exists",
  "expire",
  "incrBy",
  "mGet",
  "hSet",
  "hSetNX",
  "hGet",
  "hMGet",
  "hGetAll",
  "hDel",
  "hIncrBy",
  "zAdd",
  "zRange",
  "zRem",
  "zScore",
  "zCard",
  "zIncrBy",
  "zRemRangeByRank",
  "zRemRangeByScore",
  "watch",
].sort();

describe("invariant 5 — no key scans, no Lua, no plain Sets", () => {
  const sources = readdirSync(DATA_DIR).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  );

  it("covers the whole data layer", () => {
    // every repo the contract lists + the abstraction and both implementations
    for (const expected of [
      "redis.ts",
      "redis-devvit.ts",
      "redis-mock.ts",
      "days.ts",
      "runs.ts",
      "corpses.ts",
      "echoes.ts",
      "codex.ts",
      "users.ts",
      "metrics.ts",
    ]) {
      expect(sources).toContain(expected);
    }
  });

  for (const file of sources) {
    it(`${file} uses no banned command`, () => {
      const text = readFileSync(join(DATA_DIR, file), "utf8");
      for (const pattern of BANNED) {
        expect(text).not.toMatch(pattern);
      }
    });
  }

  it("the RedisLike runtime surface is exactly the frozen contract (08 §4)", () => {
    const mock = createMockRedis();
    const methods = Object.keys(mock)
      .filter((k) => k !== "dump")
      .sort();
    expect(methods).toEqual(EXPECTED_SURFACE);
  });

  it("scan/Lua/Set entry points do not exist on the abstraction", () => {
    const mock = createMockRedis() as unknown as Record<string, unknown>;
    for (const gone of ["scan", "keys", "hScan", "zScan", "eval", "evalSha", "sAdd", "sMembers"]) {
      expect(mock[gone]).toBeUndefined();
    }
  });
});
