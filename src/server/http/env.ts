// src/server/http/env.ts — Hono env vars + the ApiFailure error channel
// (08-M2-PORT-CONTRACT §1.5, verbatim-binding).
//
// Every route/repo failure funnels through ApiFailure so the errorBoundary
// middleware can shape it into a zErrRes body (02 §11 in-fiction copy).

import type { RedisLike } from "../data/redis.js";

export interface UvVars {
  uid: string | null;
  redis: RedisLike;
  now: number;
}

export type UvEnv = { Variables: UvVars };

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiFailure";
  }

  /**
   * Hono's router-level error handler duck-types on `getResponse` (the
   * HTTPException protocol) and would otherwise convert any throw into a
   * plain 500 before errorBoundary can shape it. This keeps the zErrRes
   * body/status correct at every catch level.
   */
  getResponse(): Response {
    return new Response(
      JSON.stringify({ error: this.code, message: this.message.slice(0, 200) }),
      { status: this.status, headers: { "content-type": "application/json" } },
    );
  }
}

/** Throws ApiFailure — `never` lets callers use it in expression position. */
export function fail(status: number, code: string, message: string): never {
  throw new ApiFailure(status, code, message);
}
