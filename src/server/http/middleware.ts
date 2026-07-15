// src/server/http/middleware.ts — errorBoundary + requireUser (08 §1.5).
//
// errorBoundary binds the per-request env (redis, uid, now), catches
// ApiFailure → zErrRes JSON, ZodError → 400 BAD_INPUT, and logs
// { route, latencyMs, uid, result } per 02 §11.
//
// Platform bindings (@devvit/web/server) load lazily and only when the env
// was not already injected upstream — vitest composes an injection middleware
// ahead of this one and never touches the Devvit runtime (contract §6).

import type { MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { ErrCode } from "../../shared/protocol.js";
import type { RedisLike } from "../data/redis.js";
import { ApiFailure, fail, type UvEnv } from "./env.js";

const MSG_MAX = 200; // zErrRes.message ceiling

function errBody(code: string, message: string): { error: string; message: string } {
  return { error: code, message: message.slice(0, MSG_MAX) };
}

export const errorBoundary: MiddlewareHandler<UvEnv> = async (c, next) => {
  const started = Date.now();

  if ((c.get("redis") as RedisLike | undefined) === undefined) {
    // Only reached on the Devvit runtime — tests always inject a mock first.
    const { bindDevvitRedis } = await import("../data/redis-devvit.js");
    c.set("redis", bindDevvitRedis());
  }
  if ((c.get("uid") as string | null | undefined) === undefined) {
    try {
      const { context } = await import("@devvit/web/server");
      c.set("uid", context.userId ?? null);
    } catch {
      c.set("uid", null); // no platform context (never on Devvit; defensive)
    }
  }
  if ((c.get("now") as number | undefined) === undefined) {
    // Date.now() is legal here — it never enters sim ticks (invariant 1
    // scopes to shared/sim); it feeds Redis metadata + ts-pinning only.
    c.set("now", Date.now());
  }

  let result = "ok";
  try {
    await next();
    if (c.error) throw c.error; // router-level onError already ran — reshape below
    result = String(c.res.status);
  } catch (err) {
    // The router's default onError may have finalized a response before this
    // catch runs (sub-route throws are caught at their own dispatch level), so
    // the shaped zErrRes response is force-assigned to c.res, never returned
    // into an already-finalized context.
    let res: Response;
    if (err instanceof ApiFailure) {
      result = err.code;
      res = c.json(errBody(err.code, err.message), err.status as ContentfulStatusCode);
    } else if (err instanceof ZodError) {
      result = ErrCode.BAD_INPUT;
      const first = err.issues[0];
      const where = first === undefined ? "" : ` (${first.path.join(".")}: ${first.message})`;
      res = c.json(errBody(ErrCode.BAD_INPUT, `the ledger rejects this page${where}`), 400);
    } else {
      result = "error";
      console.error(`[http] unhandled error on ${c.req.path}:`, err);
      res = c.json(errBody(ErrCode.BAD_INPUT, "the vault shuddered — try again"), 500);
    }
    c.res = undefined; // drop any router-default response so ours sticks
    c.res = res;
    return res;
  } finally {
    console.log(
      JSON.stringify({
        route: c.req.path,
        method: c.req.method,
        latencyMs: Date.now() - started,
        uid: c.get("uid"),
        result,
      }),
    );
  }
};

/** 401 UNAUTHENTICATED when uid === null (Vision mode plays locally). */
export const requireUser: MiddlewareHandler<UvEnv> = async (c, next) => {
  if (c.get("uid") === null) {
    fail(401, ErrCode.UNAUTHENTICATED, "the Guildhall does not know your face");
  }
  await next();
};
