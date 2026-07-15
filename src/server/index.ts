// Server entry (08-M2-PORT-CONTRACT §1.4) — binds the Hono app to the Devvit
// runtime. Stateless per invariant 8: no module-level mutable caches of game
// state (immutable rules JSON module state is allowed; per-request memoization
// lives inside the request handlers).
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createServer, getServerPort } from "@devvit/web/server";
import type { UvEnv } from "./http/env.js";
import { dayRoutes } from "./http/day.js";
import { runRoutes } from "./http/run.js";
import { codexRoutes } from "./http/codex.js";
import { internalRoutes } from "./http/internal.js";
import { requireUser, errorBoundary } from "./http/middleware.js";

const app = new Hono<UvEnv>();
app.use("*", errorBoundary);
app.route("/api/day", dayRoutes); // GET tolerates anonymous (houseLine omitted)
app.use("/api/run/*", requireUser);
app.route("/api/run", runRoutes);
app.route("/api/codex", codexRoutes); // GET public
app.route("/internal", internalRoutes); // platform-invoked only (menu/jobs/triggers)

serve({ fetch: app.fetch, createServer, port: getServerPort() });
