# 09 — Session Handoff (for the next agent: Opus 4.8)

Written 2026-07-15 (hackathon deadline day) by the outgoing session. The game is
**feature-complete for the jam**; the only critical path left is **hosting**.
Read CLAUDE.md first, then this. DECISIONS.md (D95–D108) is the authoritative
recent history; docs on disk may lag it.

## 1. State of the world

Everything below is committed and the full check was green on every commit
(`tools/git-hooks` runs `npm run check` on each commit — expect ~90 s per commit).

- **D100** `1ea7488` — M2 server port: zod protocol, RedisLike + mock + Devvit
  adapter, Hono routes, one-candle state machine, full-log replay anti-cheat.
- **D101/D104** — THE MEETING: victory opens four painted plates (her hands /
  her tears / the gift / "What She Kept"), then THE FIRST FLAME IS FED sheet.
  Her theme (`MEETING_SCORE`, graph.ts) rises when the Seal breaks. The Meeting
  is **tap-paced only** — never re-add auto-advance to an ending.
- **D102** `2caeaf9` — M2b: client speaks to the real server. net/api.ts,
  batcher (12 acts/5 s/on-unknown, byte-idempotent retry, shadow-sim checkpoint
  hashes), session-model, remote-ports, client/main.ts bootstrap in game.html.
  GamePorts stays sync; optional async seams; dev adapter untouched.
  **Mid-run resume**: /start on a live run returns {log, floor, learned,
  banked}; client shadow-replays; a mobile app-switch never voids the candle.
- **D103** — Antechamber splash (feed card): painted Gate monument, 135 KB,
  no Phaser (invariant 7).
- **D105** — THE LONG RESCUE IS REAL: permanent `uv:season` gifts counter
  bumped on every VICTORY finalize; `gatePct` = min(100, gifts) — goal is 100
  so the percent IS the count (resolves contract conflict C9). The ending
  recruits (her ask + "Yours is the Nth candle given").
- **D106/D107** `c22e8b5` — the FINALE is playable (hundredth candle → three
  more plates: Gate unlocks / She walks up / Festival of Wicks → THE GATE IS
  OPEN sheet, button WALK UP BESIDE HER) + the human-fingerprint pass (echoes/
  corpses/signs/banking/codex all name the human hand in words).
- **D108** (this session's last commit) — the rescued menu: when the season
  completes (server gatePct ≥ 100, or same-session finale witness via registry
  `uv-rescued`), the menu changes forever — tagline "She is home. The dark can
  be warmed.", vitals "the Gate stands open", and the First Flame painted
  beside the daily candle in backdrop.ts.

## 2. THE CRITICAL PATH — hosting (blocked on the operator)

Everything needs these three operator actions, in order:
1. `npx devvit login` (run in repo root; opens Reddit OAuth in browser).
2. Confirm app name — devvit.json says `the-undervault` (must be globally
   unique; if taken, pick a new one and update devvit.json `name`).
3. Create a **private** test subreddit and give its name.

Then: `npm run dev:devvit` (= `devvit playtest`, builds via
vite.devvit.config.ts and uploads to the playtest sub). First hosted test list:
- **Mobile audio unlock** inside the Reddit iOS/Android apps (riskiest unknown;
  gesture-gated unlock + always-on music is operator-mandated, D98 override).
- Webview sizes: feed card vs expanded, portrait/landscape, small phones.
- Real Redis latency on act batches; floor payload sizes; cold-start time.
- Multi-account: corpses/signs/echoes across DIFFERENT accounts; one-candle
  enforcement; the gift counter moving on a real victory.
- **Resume**: mid-run app-switch on a phone, reload → "Your candle still burns
  where you left it."
- splash postData flow (mint a day via the subreddit menu item
  "Undervault: mint today's descent", moderator-only).
- Watch `dist/dev/` — the devvit build sweeps the dev harness into dist; the
  packager should only ship dist/client + dist/server, verify nothing leaks.

Before submission: play several REAL runs across 2+ accounts on the test sub
so the shared world has corpses/signs/echoes in it — a judge alone on a fresh
sub sees an empty world otherwise (D107 note).

## 3. Environment landmines (Windows, PowerShell 5.1 — cost this session hours)

- EVERY shell command must start with:
  `$env:Path = "$env:LOCALAPPDATA\Programs\node-v22.23.1-win-x64;$env:LOCALAPPDATA\Programs\MinGit\cmd;$env:Path";`
- No `&&` in PS 5.1 — use `;` or `if ($?) { }`.
- **Embedded double quotes inside `git commit -m @'...'@` here-strings split
  the argument and break the commit** — never put `"` in commit messages.
- **NEVER rewrite source files with PowerShell pipelines** (Get/Set-Content
  mangles UTF-8 no-BOM → mojibake/NUL). Use the Edit tool or Node scripts.
- The commit hook = `npm run check` (~90 s). A broken file anywhere in the
  tree fails ANY commit — never commit while an agent is mid-write.

## 4. Verification rigs

- Dev server: `npm run dev` (vite, root `dev/`, port 5173). Keep it running;
  probes depend on it.
- Screenshots: `npx tsx tools/dev-harness/snap.ts --url ... --vw --vh --wait
  --out ... [--strike] [--keys WASD…, n=Enter] [--slide N] [--landscape]`.
- Standalone plate preview: `http://localhost:5173/?plate=<painterFile>` (any
  `src/client/ui/story/*.ts` painter, e.g. `?plate=finale2`).
- Menu overrides: `?burn=0.95` (candle-clock), `?rescued=1` (post-season menu).
- Ending probe: `tools/dev-harness/meeting-probe.mjs` (walks menu → strike →
  forces the hundredth candle → screenshots every plate + sheet).
- DEV KEYS in a run (all `DEV-ONLY: deleted at M2`, never in hosted build):
  M = floor skip · P = Tower X-Ray teleport · L = force Seal open (Meeting) ·
  K = the hundredth candle (Meeting + Finale + rescued menu after).
- Live sim handle: `window.__uvGame` (dev only) — scene has `devOpenSeal()`,
  `openVictory()` etc. for forcing states headlessly.

## 5. Backlog (ranked)

**Post-hosting fixes** — whatever the playtest surfaces; expect audio-unlock
and webview-viewport issues first.

**Submission** — post copy for the jam, screenshots/video of: splash card,
menu (both states), a run with lessons, the Meeting, the Finale. The story
pitch: one shared daily dungeon, knowledge as the only progression, an ending
that recruits, a season that ends publicly.

**Post-jam, designed and logged (do not silently redesign):**
- D105 proposals: finale-day EVENT for all players (server flips a day flag at
  gifts ≥ 100 at next mint), Festival of Wicks (two candles, one day),
  permanent +1 grace, monument of houses (needs winners zset).
- Season 2 "The Unkept Dark": the Hearth reservoir, wax deliveries, Cold
  Snaps (full formulation in D105).
- House attribution on codex entries/braziers (schema field).
- The Fabric design doc (thread map, hooks, Deep Set, inscriptions):
  https://claude.ai/code/artifact/3ce81efd-545e-4b09-a0ec-335225a3abd0
- Contract 08 §1.11 wire-probe was superseded by the real bootstrap (never
  built, intentionally). dev/ deletion at M2 deferred while it remains the
  test rig. Splash/game byte budgets enforced-at-upload (byte-report note).

## 6. Operator preferences (hard-won; violating these caused rework)

- Voice: everything in-world, manuscript grammar ("The Vault yields a truth"),
  never gamey UI copy, never "AI slop" phrasing.
- Highlighting = LIGHT, not lines (golden pools/halos; wireframes read as
  debug art). Toasts are manuscript leaves; lessons are folio cards.
- In-run music always on; NO in-gameplay mute control (D98 operator override,
  twice confirmed). Menu SOUND toggle is the only audio control.
- One candle per day is sacred. The Meeting/Finale never auto-advance.
- The operator wants to SEE things: screenshot proof over claims, dev keys
  over instructions. When art is involved, iterate against the canon
  (two-hue law: amber/gold vs verdigris over near-void; quiet, never
  melodrama).
