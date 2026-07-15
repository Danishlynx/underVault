// src/server/http/codex.ts — GET /api/codex?page=n → zCodexRes (08 §1.6, §2).
//
// Public read of the inked ledger, paged 50/page, Redis-cached 60 s
// (uv:codexcache:{page}, 02 §4). Entries are structured only — subject/text
// derive client-side via describeRuleKey (C8).

import { Hono } from "hono";
import {
  zCodexReq,
  zCodexRes,
  type CodexEntryWire,
  type CodexRes,
} from "../../shared/protocol.js";
import { CodexRepo, type CodexRow } from "../data/codex.js";
import type { UvEnv } from "./env.js";

const PAGE_SIZE = 50;
const U16_MAX = 65535;

/** CodexRow → wire (also used by /api/run/bank). */
export function codexEntryToWire(row: CodexRow): CodexEntryWire {
  return {
    ruleKey: row.ruleKey.slice(0, 96),
    effect: row.effect,
    status: row.status,
    confirms: Math.min(row.confirms, U16_MAX),
    day: row.day,
  };
}

export const codexRoutes = new Hono<UvEnv>();

codexRoutes.get("/", async (c) => {
  const raw = c.req.query("page") ?? "0";
  const { page } = zCodexReq.parse({ page: Number(raw) }); // NaN/float/negative → ZodError → 400

  const codex = new CodexRepo(c.get("redis"));

  const cached = await codex.getCache(page);
  if (cached !== undefined) {
    return c.json(zCodexRes.parse(JSON.parse(cached)));
  }

  const { rows, total } = await codex.page(page, PAGE_SIZE);
  const res: CodexRes = {
    entries: rows.slice(0, PAGE_SIZE).map(codexEntryToWire),
    page,
    pageCount: Math.min(Math.ceil(total / PAGE_SIZE), U16_MAX),
  };
  await codex.setCache(page, JSON.stringify(res));
  return c.json(res);
});
