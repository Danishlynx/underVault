# The Undervault 
https://www.reddit.com/r/the_undervault_dev/

One shared dungeon. One candle a day. You get a single life, and the dungeon's rules are hidden from you. The only way to learn them is together: whatever one player discovers and banks into the Codex, everyone who plays after them gets to know.

It's a community knowledge-roguelike built for Reddit on Devvit Web, with a Phaser 4.2 WebGL game inside the post.

## The idea

Every day the vault reshuffles its secret laws. Does ringing a bell wake the floor, or scare something off? Does salt stop a slime or feed it? If you snuff your candle, do you vanish from the thing hunting you, or just go blind while it closes in? Nobody tells you. You find out by trying it, usually dying, and then banking what you learned so the whole town is a little less in the dark tomorrow.

A few things make it tick:

- You get one candle, so one life, per day. Spend it well.
- You don't keep gear between days. You keep what the community figured out.
- Every trace in the dungeon is a real person who played today: the corpse on the stairs, the ghost replaying a delver's last moments, the chalk sign on the wall, the Codex line that says "confirmed by 7 delvers."
- There's a season-long goal the whole sub chips away at. Someone is waiting at the bottom. When the town gives 100 candles between them, the gate opens and she comes home. It happens once, and everyone got her there.

You come back because the rules changed overnight, the Codex grew, and the gate is one candle closer.


<img width="1060" height="878" alt="Screenshot 2026-07-16 040805" src="https://github.com/user-attachments/assets/89229d38-63b7-486d-853d-ad926b0be96a" />
<img width="1120" height="896" alt="Screenshot 2026-07-16 040706" src="https://github.com/user-attachments/assets/60b3d2eb-d48e-481b-add3-5a322c0e1883" />
<img width="1018" height="891" alt="Screenshot 2026-07-16 040756" src="https://github.com/user-attachments/assets/b13d398a-7001-4198-bea9-d70659ee31fc" />
<img width="1117" height="893" alt="Screenshot 2026-07-16 040626" src="https://github.com/user-attachments/assets/a3e7550e-bf9a-42b2-a3a4-4eb28ba0615f" />


## How to play

Get as deep as your one candle lets you, learn the vault's hidden rules, and bank them at a Waystone before you die. Unbanked truths die with you.

Controls:

- Move with WASD or the arrow keys. On mobile, tap a tile to walk there.
- Interact, open doors, and bank at a waystone with E, or just tap the thing.
- To go down stairs, stand on them and press Enter (or tap yourself).
- Use an item by tapping its slot in the bottom bar: salt, chalk, flint, bell, mirror, and more.
- Press C to cup the flame. It burns slower and draws less attention, but you see less.
- Hold X (or hold SNUFF) to put the candle out and disappear into the dark. Some things can't find you without your light. Neither can you find them.
- Press V to pull the camera back and read the room, then lean back in.
- Long-press a tile to inspect what you've seen there.

The loop:

1. Strike the match and descend.
2. Poke at the dark. Every monster, item, door, and shrine follows a hidden law. Test them, carefully.
3. When the vault gives up a truth, carry it to a Waystone and bank it. It enters the shared Codex for everyone.
4. You're going to die. Your body, your last words, and your unbanked truths stay down there for the next delver. You also found a House, a family line that carries on across days.
5. Post your epitaph to the sub as a comment so your run joins the feed.
6. Come back at dusk. New rules, a bigger Codex, a closer gate.

## Why it belongs on Reddit

The comment section is part of the game. Deaths post epitaphs, discoveries become shared Codex entries, and the whole subreddit turns into one running logbook of a dungeon nobody has fully cracked yet. Players leave signs, plant lights, bank truths, and drop corpses that everyone else walks through. It's built to be a daily habit: a dungeon that reshuffles every day, a House that persists, a Codex that keeps growing, and a season goal the community reaches together.

## How it's built

- Phaser 4.2 on WebGL. The world is drawn in isometric 2:1, but the simulation underneath is a plain square grid that never knows the iso view exists. Animated candlelight, walls that fade when they'd block you, depth-sorted sprites, GPU post-effects.
- Devvit Web, serverless. Hono on the server, Redis for storage, every request validated.
- Server-authoritative and deterministic. All the game logic is pure integer math with a seeded RNG. The client never holds the secret rule table. When you touch something unknown, the server replays your whole run against the hidden laws and hands back only the one rule you actually hit. You can't bank a rule you didn't really discover. A golden-replay test suite keeps the simulation identical across changes.
- Two entry points: a tiny splash card that paints instantly in the feed with no game engine, and the full Phaser game that loads only when you tap in.

## Running it

It's a Devvit app, so it runs inside a Reddit post.

```bash
npm install
npm run check                          # typecheck, lint, unit tests, golden replays, guards
npx devvit playtest r/<your-test-sub>  # hot-reload against a test subreddit
npx devvit upload                      # publish a version and get the app listing
```

Open the post on new Reddit (web or the official app) and strike the match.

One candle a day. Learn the dungeon's hidden rules together, and what you discover outlives you.
