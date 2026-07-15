// src/server/http/day.ts — GET /api/day → zDayRes (08 §1.6, §2).
//
// Tolerates anonymous callers (houseLine omitted). Serves the day number,
// the gate/codex percentages, today's toll, and the omen's tellHint teaser —
// the rumor, never the omen id (02 §7 secrecy).

import { Hono } from "hono";
import { ErrCode, type DayRes } from "../../shared/protocol.js";
import { CodexRepo } from "../data/codex.js";
import { DayRepo, type DayMeta } from "../data/days.js";
import { UserRepo } from "../data/users.js";
import { omenDayFor } from "../rules/table.js";
import { fail, type UvEnv } from "./env.js";

const U16_MAX = 65535;

/** Shared by day/run/codex routes: today's meta or 503 NO_DAY. */
export async function requireDayMeta(days: DayRepo): Promise<DayMeta> {
  const day = await days.currentDay();
  if (day === null) fail(503, ErrCode.NO_DAY, "the vault has not opened today");
  const meta = await days.getMeta(day);
  if (meta === null) fail(503, ErrCode.NO_DAY, "the vault has not opened today");
  return meta;
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
function roman(n: number): string {
  return ROMAN[n] ?? String(n);
}

/** Guildhall house strap-line (dev-adapter parity; 04 copy lands with the real Guildhall). */
export function houseLineFor(house: string, gen: number): string {
  if (house === "") return "No house sworn yet — die once to found one.";
  return `⚑ House ${house} · ${house} ${roman(gen)} awaits`.slice(0, 120);
}

export const dayRoutes = new Hono<UvEnv>();

dayRoutes.get("/", async (c) => {
  const r = c.get("redis");
  const uid = c.get("uid");
  const days = new DayRepo(r);
  const codex = new CodexRepo(r);

  const meta = await requireDayMeta(days);
  const omen = omenDayFor(meta);

  const inked = await codex.inkedCount();
  const total = await codex.totalRules();
  const codexPct = total > 0 ? Math.min(100, Math.round((inked * 100) / total)) : 0;
  const fallen = Math.min(await days.getFallen(meta.day), U16_MAX);

  const res: DayRes = {
    day: meta.day,
    // the Long Rescue (D105, resolves C9): gifts given this season out of the
    // 100 that open the Gate — the goal is 100, so the percent IS the count
    gatePct: Math.min(100, await days.giftCount()),
    codexPct,
    fallenToday: fallen,
    teaser: omen.tellHint.slice(0, 140),
  };
  if (uid !== null) {
    const user = await new UserRepo(r).get(uid);
    res.houseLine = houseLineFor(user.house, user.gen);
  }
  return c.json(res);
});
