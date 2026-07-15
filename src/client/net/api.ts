/**
 * src/client/net/api.ts — typed same-origin fetch layer (08 §1.12).
 *
 * Rules (binding): same-origin `/api/*` only (invariant 4); every 2xx body is
 * parsed with the matching zod schema — a malformed response throws, never
 * propagates untyped; non-2xx bodies are parsed as zErrRes → ApiError. No
 * retry logic lives here (that is the batcher's job — net/batcher.ts).
 *
 * Error taxonomy for callers:
 *   ApiError      — the server answered with a protocol error (zErrRes).
 *                   `code` is an ErrCodeT; `message` is in-fiction copy.
 *   NetworkError  — the transport failed or the response was not protocol
 *                   JSON (fetch rejection, gateway HTML, dropped body).
 *                   Retry-safe: every mutating endpoint is idempotent (08 §2).
 *   ZodError      — a 2xx body parsed as JSON but violated the schema; a
 *                   protocol bug, never retried.
 */

import {
  zActRes,
  zBankRes,
  zCodexRes,
  zDayRes,
  zDescendRes,
  zEndRes,
  zErrRes,
  zStartRes,
  type ActReq,
  type ActRes,
  type BankReq,
  type BankRes,
  type CodexRes,
  type DayRes,
  type DescendRes,
  type EndReq,
  type EndRes,
  type ErrCodeT,
  type StartRes,
} from "../../shared/protocol.js";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrCodeT,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Transport-level failure — safe to retry (idempotent endpoints, 08 §2). */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

interface Parser<T> {
  parse(v: unknown): T;
}

async function request<T>(path: string, init: RequestInit, schema: Parser<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new NetworkError("the vault did not answer");
  }

  let body: unknown;
  let bodyReadable = true;
  try {
    body = await res.json();
  } catch {
    bodyReadable = false;
  }

  if (!res.ok) {
    if (bodyReadable) {
      const err = zErrRes.safeParse(body);
      if (err.success) throw new ApiError(res.status, err.data.error, err.data.message);
    }
    // not our server's voice (gateway page, dropped body) — transient
    throw new NetworkError(`the vault answered strangely (HTTP ${res.status})`);
  }
  if (!bodyReadable) throw new NetworkError("the vault's answer crumbled in transit");
  return schema.parse(body); // ZodError on drift — never propagate untyped
}

function get<T>(path: string, schema: Parser<T>): Promise<T> {
  return request(path, { method: "GET" }, schema);
}

function post<T>(path: string, payload: unknown, schema: Parser<T>): Promise<T> {
  return request(
    path,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    schema,
  );
}

export function apiDay(): Promise<DayRes> {
  return get("/api/day", zDayRes);
}

// ⚠ DEV-ONLY (D122) — REMOVE BEFORE PUBLIC LAUNCH. Wipes your own run so the
// in-game "Play again (dev)" button can replay without the mod menu. Raw fetch
// (no schema): the response is ignored, the caller reloads afterwards.
export async function apiRunResetDev(): Promise<void> {
  await fetch("/api/run/reset-dev", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}

export function apiRunStart(): Promise<StartRes> {
  return post("/api/run/start", {}, zStartRes);
}

export function apiRunAct(req: ActReq): Promise<ActRes> {
  return post("/api/run/act", req, zActRes);
}

export function apiRunDescend(token: string, toFloor: number): Promise<DescendRes> {
  return post("/api/run/descend", { token, toFloor }, zDescendRes);
}

export function apiRunBank(req: BankReq): Promise<BankRes> {
  return post("/api/run/bank", req, zBankRes);
}

export function apiRunEnd(req: EndReq): Promise<EndRes> {
  return post("/api/run/end", req, zEndRes);
}

export function apiCodex(page: number): Promise<CodexRes> {
  return get(`/api/codex?page=${page}`, zCodexRes);
}
