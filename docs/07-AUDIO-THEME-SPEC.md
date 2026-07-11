# 07 — Title-theme production spec (research synthesis, D85)

Product of the menu-theme research workflow (musicology of HK/Silksong,
Diablo, Darkest Dungeon, Elden Ring title themes + WebAudio production
technique + game-audio mixing). The shipped vigil theme (graph.ts D85)
implements the core of this; items marked **PARKED** are validated
refinements available whenever the theme gets another pass. Nothing here
is sim-relevant; `Math.random()` is permitted (client fx only).

## Applied in D85

- A–G–F–E lament roots, ~9.6 s/chord, add9/maj7 color, E-over-F clash.
- Music-box bell: partials [1, ~3, ~5.4], detuned double, fast attack,
  long exponential decay; ±3-cent per-note drift; 5 ms bandpassed strike
  transient before the ring.
- Ten detuned pad oscillators, stereo spread, slow amp-breath LFOs,
  2.5 s crossfades at chord boundaries.
- Procedural stereo convolution IR, 4.0 s, decay `10^(−3i/len)` (exact
  −60 dB at the tail — no truncation cliff), 40 ms squared fade-in,
  progressive one-pole damping along the tail.
- Melody rests every third pass; rare in-key far toll; hush + crackle
  stay dry-ish (they are the room).

## PARKED (validated, not yet applied)

1. **All-minor v**: replace the E-major bar (G#) with Em7(add9)
   [82.41, 123.47, 164.81, 196.00, 293.66] and melody G#4→G4 392 for a
   more ancient/modal read. Taste call — current Phrygian-major close is
   operator-approved.
2. **Additive strophes**: cycle 1 bass+hush only → cycle 2 +pad →
   cycle 3 +melody → cycle 4 fragments → cycle 5 thin. Right for long
   dwell; menu dwell is short, so we front-load instead. Revisit for a
   credits/victory screen.
3. **Phrase bank** (no repeat within 90 s): theme phrase 1; phrase 2;
   phrase 1 up an octave at −6 dB; retrograde fragment A4 B4 C5 B4.
4. **Risset gate toll** (accent, ≤1/min): 11 partials on A3 220 —
   ratios [0.56, 0.56(+1 Hz), 0.92, 0.92(+1.7 Hz), 1.19, 1.70, 2.00,
   2.74, 3.00, 3.76, 4.07], amps [1, .67, 1, 1.8, 2.67, 1.67, 1.46,
   1.33, 1.33, 1, 1.33], 6 s base dur × [1, .9, .65, .55, .325, .35,
   .25, .2, .15, .1, .075].
5. **Two-clocks scheduler**: 50 ms timer / 250 ms lookahead with
   absolute-time automation, if tighter rhythm is ever wanted (current
   rubato ambient tolerates setTimeout drift).
6. **Saw-stack pad recipe** (bigger, more orchestral than our sine/tri):
   3×saw+2×tri, detune [−9,−4.5,0,+4.5,+9] cents, per-note highpass at
   the fundamental, chord bus through 2×lowpass 1200 Hz Q 0.6 with
   0.08/0.093 Hz L/R-divergent filter LFOs.
7. **Mix targets**: ≈ −26 LUFS integrated, −1 dBTP ceiling; melody
   density 2–3 phrases/min with 12–22 s gaps; ≥ one 8–15 s near-silent
   stretch per minute; lows mono, only pads/bells/reverb on the sides.
