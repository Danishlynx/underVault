// MetricsRepo — hIncrBy counters on uv:metrics:{d} with 48 h TTL (08 §1.10/§3).

import { describe, expect, it } from "vitest";
import { DAY_TTL_S } from "../core/constants.js";
import { createMockRedis } from "./redis-mock.js";
import { MetricsRepo } from "./metrics.js";

describe("MetricsRepo.incr", () => {
  it("creates the counter at 1 and stamps the 48 h TTL", async () => {
    const r = createMockRedis();
    await new MetricsRepo(r).incr(7, "runs");
    expect(await r.hGet("uv:metrics:7", "runs")).toBe("1");
    const entry = r.dump().get("uv:metrics:7") as { ttlS?: number };
    expect(entry.ttlS).toBe(DAY_TTL_S);
  });

  it("increments on subsequent calls and supports custom deltas", async () => {
    const r = createMockRedis();
    const repo = new MetricsRepo(r);
    await repo.incr(7, "claims");
    await repo.incr(7, "claims", 4);
    expect(await r.hGet("uv:metrics:7", "claims")).toBe("5");
  });

  it("tracks per-cause death counters independently per day", async () => {
    const r = createMockRedis();
    const repo = new MetricsRepo(r);
    await repo.incr(7, "deaths:2");
    await repo.incr(7, "deaths:5");
    await repo.incr(8, "deaths:2");
    expect(await r.hGetAll("uv:metrics:7")).toEqual({ "deaths:2": "1", "deaths:5": "1" });
    expect(await r.hGetAll("uv:metrics:8")).toEqual({ "deaths:2": "1" });
  });
});
