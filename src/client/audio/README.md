# `src/client/audio` — synthesized audio layer

`graph.ts` exports `AudioGraph` and the `Cue` union. Everything is synthesized
at runtime (oscillators, noise buffers, filters, envelopes) — zero external
assets (invariant 4). The context is created suspended; `unlock()` may only be
called inside the match-strike gesture, `visibilitychange` hard-mutes, and the
mute preference is persisted server-side, never here (invariants 3 and 6).

## Continuous layers

| Control | Behavior |
|---|---|
| `setDarkness(0..1)` | whisper bed (filtered looping noise); silent below 0.4, up to ~0.15 gain at full dark |
| `setHeartbeat(on)` | ~55 bpm lub-dub loop, subtle |

## One-shot cues (`play(cue)`)

| Cue | Character |
|---|---|
| `step-stone` | dry filtered-noise tick |
| `step-moss` | damp low press |
| `step-soft` | barely-there footfall |
| `bump` | dull wall thud |
| `door` | hinge groan + wood grain |
| `door-force` | slam, splinter, frame rattle |
| `brazier` | rising whoosh, spark, warm swell |
| `pickup` | muted triangle dyad |
| `bite` | snap click + down-chirp |
| `lunge` | fast rising air-cut |
| `stomp` | sub-heavy floor hit |
| `snuff` | air puff, dying sizzle |
| `relight` | crackle then warm bloom |
| `cup` | muffling lowpass sweep |
| `discovery` | rising pentatonic chime (verdigris moment) |
| `bank` | wider pentatonic chime over low anchor |
| `death` | ~1.5 s descending detuned drone |
| `descend` | sinking gliss + shaft rumble |
| `fire` | whoosh bed + sparse crackles |
| `boom` | lowpassed noise slam + sub sine |
| `squeak` | paired high sine chirps |
| `rumble` | deep stone shudder |
| `flutter` | five fading wing-beats |
| `click3` | three woodblock knocks — the Chandler tell |
| `hiss` | thin sustained sibilance |
| `scream` | descending sawtooth wail, doubled off-pitch |
| `bell` | detuned triangle toll + hum partial |
| `shock` | arcing square blips + static tick |
| `growl` | low wobbling saw |
| `match-strike` | ~1.2 s scrape, ignition pop, warm bloom (audio-unlock moment) |

All peak gains ≤ 0.25; a gentle limiter sits before the destination. Tone per
04 §5/§7: hushed manuscript-horror — never chiptune cheer.
