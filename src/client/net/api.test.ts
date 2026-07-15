// api.ts — typed fetch layer: schema-parsed successes, zErrRes → ApiError,
// transport failures → NetworkError, malformed 2xx → throws (08 §1.12).

import { afterEach, describe, expect, it, vi } from "vitest";
import type { DayRes } from "../../shared/protocol.js";
import { ApiError, NetworkError, apiDay, apiRunDescend } from "./api.js";

const DAY: DayRes = { day: 1, gatePct: 9, codexPct: 0, fallenToday: 0, teaser: "a rumor" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api fetch layer", () => {
  it("parses a 2xx body with the matching schema", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(DAY)));
    await expect(apiDay()).resolves.toEqual(DAY);
  });

  it("posts same-origin JSON with the request shape", async () => {
    const f = vi.fn(async () => json({ floor: null }, 500));
    vi.stubGlobal("fetch", f);
    await apiRunDescend("t".repeat(16), 2).catch(() => undefined);
    expect(f).toHaveBeenCalledWith(
      "/api/run/descend",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "t".repeat(16), toFloor: 2 }),
      }),
    );
  });

  it("turns a zErrRes body into ApiError(status, code, message)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "CANDLE_SPENT", message: "the candle is spent" }, 409)),
    );
    const err = await apiDay().then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).code).toBe("CANDLE_SPENT");
    expect((err as ApiError).message).toBe("the candle is spent");
  });

  it("wraps a transport rejection in NetworkError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(apiDay()).rejects.toBeInstanceOf(NetworkError);
  });

  it("treats a non-protocol error body (gateway page) as NetworkError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>bad gateway</html>", { status: 502 })),
    );
    await expect(apiDay()).rejects.toBeInstanceOf(NetworkError);
  });

  it("a schema-violating 2xx throws and is NOT retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ nonsense: true })));
    const err = await apiDay().then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).not.toBeNull();
    expect(err).not.toBeInstanceOf(ApiError);
    expect(err).not.toBeInstanceOf(NetworkError);
  });
});
