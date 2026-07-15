# The Undervault

**A community knowledge-roguelike for Reddit.** One shared dungeon. One candle — one life — per player, per day. The dungeon's laws are *hidden*, and the only way to learn them is together: what one delver discovers and carves into the Codex, every delver after them inherits.

Built on **Reddit's Developer Platform (Devvit Web)** with **Phaser 4.2** (WebGL), an isometric world, and a fully server-authoritative simulation.

---

## The hook

Every dungeon looks familiar, but its rules are secret and they **reshuffle at dusk**. Does striking a bell wake the floor? Does salt stop a slime — or feed it? Does snuffing your candle hide you from the thing in the dark, or blind you while it closes in? Nobody is told. You find out by trying, dying, and **banking what you learned** so the whole town gets a little less blind.

- **One candle a day.** You get a single life. Spend it well — the dark is patient.
- **Knowledge is the only progression.** You keep no gear between days. You keep what the community *knows*.
- **Every trace is a real person.** The corpse on the stairs, the ghostly echo of a delver's last run, the chalk sign scrawled on a wall, the Codex entry marked "confirmed by 7 delvers" — those are other redditors, today.
- **A season-long shared goal.** Deep in the vault, someone is waiting. When the town collectively gives **100 candles**, the Great Gate opens and she comes home — a finish line the whole community crosses together, once.

You come back tomorrow because the laws changed, the Codex grew, and the Gate is one candle closer.

---

## How to play

**Goal:** descend as far as your one candle allows, learn the vault's hidden rules, and **bank them at a Waystone** so they enter the shared Codex before you die.

### Controls
- **Move:** WASD / Arrow keys, or **tap a tile** to walk there (mobile).
- **Interact / open doors / bank at a waystone:** **E**, or tap the thing.
- **Descend stairs:** stand on them and press **Enter** (or tap yourself).
- **Use an item:** tap its slot in the bottom tray (salt, chalk, flint, bell, mirror, and more).
- **Cup the flame (C):** sip wax instead of burning it — dimmer, but you last longer and draw less attention.
- **Snuff the candle (hold X / hold SNUFF):** vanish into the dark. Some things can't find you without your light — but you can't see them either.
- **Look around (V):** pull the camera back to read the room, then lean back in.
- **Inspect (long-press a tile):** read what you've seen there.

### The loop
1. **Strike the match** to light your candle and descend.
2. **Probe the dark.** Every monster, item, door and shrine obeys a hidden law. Test them — carefully.
3. **When the vault yields a truth,** carry it to a **Waystone** and bank it. Unbanked truths die with you.
4. **You will die.** Your body, your last words, and your unbanked truths stay in the dungeon for other delvers to find. You **found a House** — a lineage that endures across days and generations.
5. **Share your fall.** Post your epitaph to the subreddit as a comment, so your run becomes part of the feed.
6. **Come back at dusk.** New laws, a fuller Codex, a Gate one step closer.

---

## Why it's a Reddit game

- **The comment section is part of the game.** Deaths post epitaphs; discoveries become shared Codex entries; the whole sub is one collaborative logbook of a dungeon nobody fully understands yet.
- **User contributions everywhere:** player-carved signs, banked truths, planted lights, and corpses seed the world every other player walks through.
- **Retention by design:** a daily reshuffled dungeon, a persistent House/lineage, a growing communal Codex, and a season-long Gate goal — anticipation that renews every day.
- **One life a day** turns each descent into an event worth talking about.

---

## Under the hood

- **Phaser 4.2, WebGL** — isometric 2:1 dimetric presentation over an unchanged square-grid simulation (the sim never learns iso exists); animated candlelight, wall-occlusion fade, depth-sorted billboards, GPU filters.
- **Devvit Web (serverless)** — Hono server, Redis persistence, zod-validated endpoints.
- **Server-authoritative & deterministic** — all game logic is pure integer simulation with a seeded RNG. The client never holds the secret rule table; unknown interactions are resolved by the server, which replays your full action log against the hidden laws and returns only the rule you actually touched. Invented claims are refused. A golden-replay corpus guards determinism on every change.
- **Two entrypoints** — a lightweight feed-card splash (no engine) and the full Phaser game, so the card paints instantly in-feed and the engine loads only on tap.

---

## Running it

This is a Devvit app; it runs inside a Reddit post.

```bash
npm install
npm run check        # typecheck + lint + unit + golden-replay + guards
npx devvit playtest r/<your-test-sub>   # hot-reload against a test subreddit
npx devvit upload                        # publish a version → app listing
```

Open the app's post on **new Reddit** (web or the official app) and **strike the match** to descend.

---

*One candle a day. Learn the dungeon's hidden rules together, and what you discover outlives you.*
