// src/server/http/internal.ts — platform-invoked endpoints (08 §1.6, §2):
//   POST /internal/menu/mint-day          (moderator menu — manual reshuffle)
//   POST /internal/jobs/reshuffle         (scheduler, 0 0 * * *)
//   POST /internal/triggers/on-app-install
//
// All three funnel into mintDay: hSetNX one-winner on day meta (invariant 10),
// then the winner submits the daily post with ≤2 KB postData. Request bodies
// are platform-shaped (UiRequest / scheduler / trigger envelopes) and are
// deliberately never read — no payload is consumed, so there is nothing to
// zod-validate (invariant 9 holds vacuously).
//
// This module MAY import @devvit/* (08 §4 allowlist) — done lazily so vitest
// never touches the platform runtime.

import { Hono } from "hono";
import { CodexRepo } from "../data/codex.js";
import { DayRepo } from "../data/days.js";
import type { RedisLike } from "../data/redis.js";
import { mintDaySeed } from "../rules/seed.js";
import { omenDayFor, RULE_TOTAL } from "../rules/table.js";
import type { UvEnv } from "./env.js";

/**
 * Mint the next day: one winner via DayRepo.putMeta (hSetNX on seedHi).
 * Winner stamps ruleTotal and submits the daily post (entry "default").
 * Losers/repeats return the standing day with created: false.
 */
export async function mintDay(r: RedisLike, now: number): Promise<{ day: number; created: boolean }> {
  const days = new DayRepo(r);
  const day = ((await days.currentDay()) ?? 0) + 1;
  const seeds = mintDaySeed();
  const created = await days.putMeta({
    day,
    seedHi: seeds.seedHi,
    seedLo: seeds.seedLo,
    omenSeed: seeds.omenSeed,
    postId: "",
    createdTs: now,
  });
  if (!created) return { day, created: false };

  await days.setRuleTotal(day, RULE_TOTAL);

  // Winner-only post submission. Off-platform (vitest) the import/call throws
  // and the mint stands — the playtest sub exercises the real path.
  try {
    const { context, reddit } = await import("@devvit/web/server");
    const codex = new CodexRepo(r);
    const inked = await codex.inkedCount();
    const codexPct = RULE_TOTAL > 0 ? Math.min(100, Math.round((inked * 100) / RULE_TOTAL)) : 0;
    const omen = omenDayFor({ omenSeed: seeds.omenSeed, day });
    const post = await reddit.submitCustomPost({
      subredditName: context.subredditName ?? "",
      title: `The Undervault — Day ${day}`,
      entry: "default",
      postData: {
        day,
        gatePct: Math.min(100, await days.giftCount()), // the Long Rescue (D105, resolves C9)
        codexPct,
        teaser: omen.tellHint.slice(0, 140),
      },
      textFallback: {
        text: `The Undervault — Day ${day}. Open on new Reddit to descend.`,
      },
    });
    await days.setPostId(day, post.id);
  } catch (err) {
    console.warn(`[mint-day] day ${day} minted; post submission unavailable:`, err);
  }
  return { day, created: true };
}

export const internalRoutes = new Hono<UvEnv>();

internalRoutes.post("/menu/mint-day", async (c) => {
  const { day, created } = await mintDay(c.get("redis"), c.get("now"));
  return c.json({
    showToast: created
      ? `The vault reshuffles — Day ${day} stands open.`
      : `Day ${day} already stands.`,
  });
});

internalRoutes.post("/jobs/reshuffle", async (c) => {
  const { day, created } = await mintDay(c.get("redis"), c.get("now"));
  return c.json({ status: "ok", day, created });
});

internalRoutes.post("/triggers/on-app-install", async (c) => {
  // mints the FIRST day only; a re-fired trigger finds a standing day and
  // leaves it alone (mintDay would advance it — that is the reshuffle's job)
  const r = c.get("redis");
  const standing = await new DayRepo(r).currentDay();
  if (standing !== null) return c.json({ status: "ok", day: standing, created: false });
  const { day, created } = await mintDay(r, c.get("now"));
  return c.json({ status: "ok", day, created });
});
