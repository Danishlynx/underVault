/**
 * The Undervault — fully synthesized WebAudio layer.
 *
 * Invariant 4: zero external assets. Every sound here is built at runtime
 * from oscillators, procedurally filled noise buffers, biquad filters and
 * gain envelopes. Nothing is fetched, nothing is decoded.
 *
 * Invariant 6: the AudioContext is created suspended and `unlock()` must be
 * called ONLY from inside the match-strike gesture (04 §4: "audio context
 * resumes here"). `visibilitychange` hard-mutes while hidden and restores the
 * user's prior mute state on return. Nothing is persisted here — the mute
 * preference lives in the `user:{uid}` hash server-side (invariant 3).
 *
 * Aesthetic (04 §5/§7): hushed manuscript-horror. Quiet, dry, woody, airy —
 * never chiptune-cheerful, never louder than a murmur. All peak gains ≤ 0.25
 * and a gentle limiter sits before the destination as a safety net when cues
 * overlap.
 *
 * Note on Math.random: the determinism wall (invariant 1) applies to
 * `src/shared/sim` — this is pure client fx and never influences validated
 * state, so free-running randomness is used for organic timbral variation.
 */

export type Cue =
  | "step-stone"
  | "step-moss"
  | "step-soft"
  | "bump"
  | "door"
  | "door-force"
  | "brazier"
  | "pickup"
  | "bite"
  | "lunge"
  | "stomp"
  | "snuff"
  | "relight"
  | "cup"
  | "discovery"
  | "bank"
  | "death"
  | "descend"
  | "fire"
  | "boom"
  | "squeak"
  | "rumble"
  | "flutter"
  | "click3"
  | "hiss"
  | "scream"
  | "bell"
  | "shock"
  | "growl"
  | "match-strike";

/** Envelope-shaped one-shot oscillator voice. */
interface ToneOpts {
  type: OscillatorType;
  freq: number;
  /** Exponential glide target (Hz). */
  freqEnd?: number;
  /** Seconds over which the glide runs (default: full duration). */
  glide?: number;
  /** Start offset in seconds from "now". */
  at?: number;
  /** Attack in seconds (default 5 ms). */
  attack?: number;
  /** Total envelope length in seconds (attack + decay). */
  dur: number;
  /** Peak linear gain — keep ≤ 0.25 (project loudness ceiling). */
  peak: number;
  detune?: number;
  filter?: FilterOpts;
}

/** Envelope-shaped one-shot slice of the shared white-noise buffer. */
interface BurstOpts {
  at?: number;
  dur: number;
  peak: number;
  attack?: number;
  /** playbackRate — recolors the noise (slower = darker). */
  rate?: number;
  filter: FilterOpts;
}

interface FilterOpts {
  type: BiquadFilterType;
  freq: number;
  /** Exponential sweep target over the full duration (Hz). */
  freqEnd?: number;
  q?: number;
}

const SILENT = 0.0001; // exponentialRamp cannot reach 0; this is ≈ -80 dB

export class AudioGraph {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly sfx: GainNode;
  private readonly whisper: GainNode;
  private readonly heartbeat: GainNode;
  private readonly noise: AudioBuffer;

  private userMuted = false;
  private hidden: boolean;

  constructor() {
    // Created outside any gesture, so the context starts suspended per
    // autoplay policy; if a host ever constructs us inside a gesture, force
    // the invariant anyway. unlock() is the only resume path.
    this.ctx = new AudioContext();
    if (this.ctx.state === "running") {
      void this.ctx.suspend();
    }

    // master → limiter → destination. The limiter is a safety net only;
    // individual voices stay quiet enough that it rarely engages.
    this.master = this.ctx.createGain();
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -20;
    limiter.knee.value = 12;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    this.master.connect(limiter).connect(this.ctx.destination);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);

    this.whisper = this.ctx.createGain();
    this.whisper.gain.value = 0;
    this.whisper.connect(this.master);

    this.heartbeat = this.ctx.createGain();
    this.heartbeat.gain.value = 0;
    this.heartbeat.connect(this.master);

    // Shared source material for every noise-based voice.
    this.noise = this.makeNoiseBuffer(2);

    this.buildWhisperLoop();
    this.buildHeartbeatLoop();

    this.hidden = document.visibilityState === "hidden";
    document.addEventListener("visibilitychange", () => {
      this.hidden = document.visibilityState === "hidden";
      this.applyMasterGain();
    });
    this.applyMasterGain();
  }

  /** Resume the context. Call ONLY inside the match-strike gesture. */
  unlock(): void {
    void this.ctx.resume();
  }

  get muted(): boolean {
    return this.userMuted;
  }

  setMuted(m: boolean): void {
    this.userMuted = m;
    this.applyMasterGain();
  }

  /**
   * Darkness drives the whisper bed: silent below 0.4, rising linearly to
   * ~0.15 at full dark. Long ramp so the dread creeps rather than snaps.
   */
  setDarkness(level: number): void {
    const l = Math.min(1, Math.max(0, level));
    const target = l <= 0.4 ? 0 : ((l - 0.4) / 0.6) * 0.15;
    const t = this.ctx.currentTime;
    this.whisper.gain.cancelScheduledValues(t);
    this.whisper.gain.setTargetAtTime(target, t, 0.4);
  }

  /** Slow ~55 bpm lub-dub, faded in/out over ~a beat. Subtle by design. */
  setHeartbeat(on: boolean): void {
    const t = this.ctx.currentTime;
    this.heartbeat.gain.cancelScheduledValues(t);
    this.heartbeat.gain.setTargetAtTime(on ? 0.12 : 0, t, 0.6);
  }

  play(cue: Cue): void {
    if (this.ctx.state !== "running") return; // locked or interrupted: drop silently

    switch (cue) {
      // ── movement ────────────────────────────────────────────────────────
      case "step-stone": {
        // dry tick — a boot heel on flagstone
        this.burst({
          dur: 0.055,
          peak: 0.07,
          rate: this.jitter(1, 0.12),
          filter: { type: "bandpass", freq: this.jitter(1800, 200), q: 1.2 },
        });
        return;
      }
      case "step-moss": {
        // damp press — low, breathy
        this.burst({
          dur: 0.09,
          peak: 0.05,
          attack: 0.012,
          rate: this.jitter(0.7, 0.08),
          filter: { type: "lowpass", freq: this.jitter(520, 60) },
        });
        return;
      }
      case "step-soft": {
        // barely-there footfall (sneaking / carpetled dust)
        this.burst({
          dur: 0.07,
          peak: 0.028,
          attack: 0.015,
          rate: this.jitter(0.55, 0.06),
          filter: { type: "lowpass", freq: 340 },
        });
        return;
      }
      case "bump": {
        // dull thud against a wall — pitch drop plus a knuckle of noise
        this.tone({ type: "sine", freq: 95, freqEnd: 55, dur: 0.12, peak: 0.12, attack: 0.003 });
        this.burst({ dur: 0.03, peak: 0.04, filter: { type: "bandpass", freq: 700, q: 1 } });
        return;
      }

      // ── doors & interaction ─────────────────────────────────────────────
      case "door": {
        // hinge groan: resonant lowpassed saw creeping upward + wood grain noise
        this.tone({
          type: "sawtooth",
          freq: 62,
          freqEnd: 96,
          glide: 0.32,
          dur: 0.4,
          peak: 0.06,
          attack: 0.05,
          filter: { type: "lowpass", freq: 420, q: 3 },
        });
        this.burst({
          dur: 0.38,
          peak: 0.035,
          attack: 0.06,
          rate: 0.5,
          filter: { type: "bandpass", freq: 350, q: 1.2 },
        });
        return;
      }
      case "door-force": {
        // shoulder-slam: heavy drop-thud, splinter noise, delayed frame rattle
        this.tone({ type: "sine", freq: 75, freqEnd: 42, dur: 0.28, peak: 0.16, attack: 0.004 });
        this.burst({ dur: 0.3, peak: 0.12, filter: { type: "lowpass", freq: 800, freqEnd: 200 } });
        this.burst({ at: 0.14, dur: 0.12, peak: 0.06, filter: { type: "bandpass", freq: 900, q: 1 } });
        return;
      }
      case "brazier": {
        // catching flame: rising whoosh, one spark tick, warm low swell
        this.burst({
          dur: 0.4,
          peak: 0.09,
          attack: 0.05,
          filter: { type: "bandpass", freq: 420, freqEnd: 1500, q: 0.8 },
        });
        this.burst({ at: 0.18, dur: 0.03, peak: 0.05, filter: { type: "bandpass", freq: 2800, q: 2 } });
        this.tone({ type: "sine", freq: 180, at: 0.1, attack: 0.12, dur: 0.35, peak: 0.04 });
        return;
      }
      case "pickup": {
        // muted dyad — parchment-quiet acknowledgement, not a coin fanfare
        this.tone({
          type: "triangle",
          freq: 660,
          dur: 0.14,
          peak: 0.055,
          attack: 0.003,
          filter: { type: "lowpass", freq: 2200 },
        });
        this.tone({
          type: "triangle",
          freq: 990,
          at: 0.05,
          dur: 0.12,
          peak: 0.03,
          attack: 0.003,
          filter: { type: "lowpass", freq: 2600 },
        });
        return;
      }

      // ── violence ────────────────────────────────────────────────────────
      case "bite": {
        // snap: bright noise click into a hard down-chirp
        this.burst({ dur: 0.04, peak: 0.11, filter: { type: "bandpass", freq: 2400, q: 1.4 } });
        this.tone({
          type: "square",
          freq: 420,
          freqEnd: 140,
          dur: 0.09,
          peak: 0.07,
          attack: 0.002,
          filter: { type: "lowpass", freq: 1400 },
        });
        return;
      }
      case "lunge": {
        // fast air-cut, sweeping upward
        this.burst({
          dur: 0.18,
          peak: 0.09,
          attack: 0.03,
          rate: 1.2,
          filter: { type: "bandpass", freq: 350, freqEnd: 2400, q: 0.9 },
        });
        return;
      }
      case "stomp": {
        // sub-heavy floor hit
        this.tone({ type: "sine", freq: 58, freqEnd: 34, dur: 0.28, peak: 0.2, attack: 0.004 });
        this.burst({ dur: 0.18, peak: 0.09, filter: { type: "lowpass", freq: 260 } });
        return;
      }

      // ── the candle ──────────────────────────────────────────────────────
      case "snuff": {
        // breath of air closing over the wick, faint dying sizzle
        this.burst({
          dur: 0.2,
          peak: 0.07,
          attack: 0.025,
          rate: 0.8,
          filter: { type: "lowpass", freq: 1300, freqEnd: 280 },
        });
        this.burst({ at: 0.03, dur: 0.02, peak: 0.03, filter: { type: "bandpass", freq: 3000, q: 2 } });
        return;
      }
      case "relight": {
        // crackle then a small warm bloom
        this.burst({ dur: 0.05, peak: 0.05, filter: { type: "bandpass", freq: 2400, q: 1.5 } });
        this.tone({
          type: "sine",
          freq: 170,
          freqEnd: 230,
          glide: 0.25,
          at: 0.05,
          attack: 0.14,
          dur: 0.32,
          peak: 0.06,
        });
        return;
      }
      case "cup": {
        // palm closing around the flame — the world muffles for an instant
        this.burst({
          dur: 0.16,
          peak: 0.05,
          attack: 0.03,
          rate: 0.7,
          filter: { type: "lowpass", freq: 900, freqEnd: 220 },
        });
        return;
      }

      // ── verdigris moments ───────────────────────────────────────────────
      case "discovery": {
        // small pentatonic chime, rising — knowledge inked
        for (const [i, f] of [523.25, 587.33, 659.25, 783.99].entries()) {
          this.tone({
            type: "triangle",
            freq: f,
            at: i * 0.09,
            dur: 0.35,
            peak: 0.055,
            attack: 0.004,
            filter: { type: "lowpass", freq: 2400 },
          });
        }
        return;
      }
      case "bank": {
        // weightier sibling of discovery: wider pentatonic spread over a low anchor
        this.tone({ type: "sine", freq: 130.81, dur: 0.5, peak: 0.05, attack: 0.02 });
        for (const [i, f] of [392, 523.25, 659.25, 783.99].entries()) {
          this.tone({
            type: "triangle",
            freq: f,
            at: 0.04 + i * 0.11,
            dur: 0.42,
            peak: 0.06,
            attack: 0.004,
            filter: { type: "lowpass", freq: 2400 },
          });
        }
        return;
      }

      // ── ceremony ────────────────────────────────────────────────────────
      case "death": {
        // ~1.5 s descending drone: two detuned saws under a closing lowpass,
        // sub sine sinking beneath — the candle gutters out
        this.tone({
          type: "sawtooth",
          freq: 108,
          freqEnd: 36,
          glide: 1.35,
          dur: 1.5,
          peak: 0.08,
          attack: 0.1,
          filter: { type: "lowpass", freq: 620, freqEnd: 80, q: 0.8 },
        });
        this.tone({
          type: "sawtooth",
          freq: 111,
          freqEnd: 38,
          glide: 1.35,
          dur: 1.5,
          peak: 0.06,
          attack: 0.15,
          detune: -10,
          filter: { type: "lowpass", freq: 540, freqEnd: 70, q: 0.8 },
        });
        this.tone({ type: "sine", freq: 54, freqEnd: 27, glide: 1.4, dur: 1.5, peak: 0.07, attack: 0.2 });
        return;
      }
      case "descend": {
        // sinking gliss plus stair-shaft rumble
        this.tone({ type: "sine", freq: 330, freqEnd: 160, dur: 0.45, peak: 0.07, attack: 0.02 });
        this.burst({
          dur: 0.5,
          peak: 0.07,
          attack: 0.08,
          filter: { type: "lowpass", freq: 220, freqEnd: 90 },
        });
        return;
      }
      case "match-strike": {
        // ~1.2 s: two dry scrapes → ignition pop → warm bloom with settling
        // crackles. This underscores the audio-unlock brand moment (04 §4.1).
        this.burst({
          dur: 0.16,
          peak: 0.1,
          attack: 0.02,
          rate: 1.6,
          filter: { type: "bandpass", freq: 1400, freqEnd: 2600, q: 1.2 },
        });
        this.burst({
          at: 0.14,
          dur: 0.2,
          peak: 0.12,
          attack: 0.02,
          rate: 1.8,
          filter: { type: "bandpass", freq: 1800, freqEnd: 3800, q: 1.2 },
        });
        this.burst({ at: 0.34, dur: 0.05, peak: 0.1, filter: { type: "bandpass", freq: 2600, q: 1.5 } });
        this.tone({
          type: "sine",
          freq: 150,
          freqEnd: 210,
          glide: 0.5,
          at: 0.38,
          attack: 0.3,
          dur: 0.82,
          peak: 0.09,
        });
        this.tone({ type: "triangle", freq: 310, at: 0.42, attack: 0.35, dur: 0.75, peak: 0.035, detune: 6 });
        this.burst({ at: 0.62, dur: 0.03, peak: 0.04, filter: { type: "bandpass", freq: 3200, q: 2 } });
        this.burst({ at: 0.8, dur: 0.03, peak: 0.03, filter: { type: "bandpass", freq: 2700, q: 2 } });
        return;
      }

      // ── hazards & tells ─────────────────────────────────────────────────
      case "fire": {
        // low whoosh bed with sparse bright crackles
        this.burst({ dur: 0.45, peak: 0.06, attack: 0.06, filter: { type: "lowpass", freq: 520 } });
        for (let i = 0; i < 4; i++) {
          this.burst({
            at: 0.05 + i * 0.09 + Math.random() * 0.04,
            dur: 0.02,
            peak: 0.05,
            filter: { type: "bandpass", freq: this.jitter(2500, 500), q: 2 },
          });
        }
        return;
      }
      case "boom": {
        // lowpassed noise slam over a sinking sub
        this.burst({
          dur: 0.5,
          peak: 0.22,
          attack: 0.005,
          filter: { type: "lowpass", freq: 320, freqEnd: 70 },
        });
        this.tone({ type: "sine", freq: 64, freqEnd: 30, dur: 0.55, peak: 0.18, attack: 0.005 });
        return;
      }
      case "squeak": {
        // paired rising chirps — something small in the dark
        this.tone({ type: "sine", freq: 2300, freqEnd: 3300, glide: 0.05, dur: 0.07, peak: 0.06, attack: 0.004 });
        this.tone({
          type: "sine",
          freq: 2600,
          freqEnd: 3600,
          glide: 0.05,
          at: 0.1,
          dur: 0.06,
          peak: 0.05,
          attack: 0.004,
        });
        return;
      }
      case "rumble": {
        // deep shudder through stone
        this.burst({ dur: 0.55, peak: 0.11, attack: 0.1, filter: { type: "lowpass", freq: 130 } });
        this.tone({ type: "sine", freq: 45, freqEnd: 38, dur: 0.5, peak: 0.06, attack: 0.08 });
        return;
      }
      case "flutter": {
        // five fading wing-beats
        for (let i = 0; i < 5; i++) {
          this.burst({
            at: i * 0.05,
            dur: 0.03,
            peak: 0.05 - i * 0.006,
            attack: 0.008,
            filter: { type: "bandpass", freq: this.jitter(1100, 150), q: 0.9 },
          });
        }
        return;
      }
      case "click3": {
        // three woodblock knocks — the Chandler tell. Fast-decay sine body
        // plus a splinter of noise; middle knock sits lower, third rises.
        for (const [i, f] of [1150, 1050, 1250].entries()) {
          const at = i * 0.13;
          this.tone({ type: "sine", freq: f, freqEnd: f * 0.85, at, dur: 0.05, peak: 0.11, attack: 0.001 });
          this.burst({ at, dur: 0.015, peak: 0.045, filter: { type: "bandpass", freq: 1600, q: 1 } });
        }
        return;
      }
      case "hiss": {
        // thin sustained sibilance
        this.burst({ dur: 0.4, peak: 0.05, attack: 0.05, filter: { type: "highpass", freq: 3800 } });
        return;
      }
      case "scream": {
        // descending sawtooth wail, doubled slightly off-pitch — kept at a
        // murmur; the horror is in the shape, not the volume
        this.tone({
          type: "sawtooth",
          freq: 1350,
          freqEnd: 290,
          glide: 0.5,
          dur: 0.55,
          peak: 0.09,
          attack: 0.03,
          filter: { type: "bandpass", freq: 1000, freqEnd: 400, q: 1.6 },
        });
        this.tone({
          type: "sawtooth",
          freq: 1390,
          freqEnd: 310,
          glide: 0.5,
          dur: 0.52,
          peak: 0.05,
          attack: 0.05,
          detune: -14,
          filter: { type: "bandpass", freq: 1200, freqEnd: 450, q: 2 },
        });
        return;
      }
      case "bell": {
        // small tolling bell: detuned triangle pair over a soft hum partial
        this.tone({ type: "triangle", freq: 1046.5, dur: 0.58, peak: 0.08, attack: 0.003 });
        this.tone({ type: "triangle", freq: 1046.5, detune: 7, dur: 0.55, peak: 0.045, attack: 0.003 });
        this.tone({ type: "sine", freq: 523.25, dur: 0.5, peak: 0.03, attack: 0.003 });
        return;
      }
      case "shock": {
        // arcing buzz: three jittered square blips under a static tick
        for (const [i, f] of [190, 265, 205].entries()) {
          this.tone({
            type: "square",
            freq: f,
            at: i * 0.045,
            dur: 0.05,
            peak: 0.07,
            attack: 0.002,
            filter: { type: "highpass", freq: 300 },
          });
        }
        this.burst({ dur: 0.05, peak: 0.05, filter: { type: "highpass", freq: 4000 } });
        return;
      }
      case "growl": {
        // low wobbling saw — needs its own frequency LFO, built inline
        const t0 = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(58, t0);
        const wobble = this.ctx.createOscillator();
        wobble.frequency.setValueAtTime(6.5, t0);
        const wobbleGain = this.ctx.createGain();
        wobbleGain.gain.setValueAtTime(9, t0);
        wobble.connect(wobbleGain);
        wobbleGain.connect(osc.frequency);
        const lp = this.ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(340, t0);
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(SILENT, t0);
        env.gain.linearRampToValueAtTime(0.1, t0 + 0.06);
        env.gain.exponentialRampToValueAtTime(SILENT, t0 + 0.5);
        osc.connect(lp);
        lp.connect(env);
        env.connect(this.sfx);
        osc.start(t0);
        wobble.start(t0);
        osc.stop(t0 + 0.55);
        wobble.stop(t0 + 0.55);
        osc.onended = () => {
          osc.disconnect();
          wobble.disconnect();
          wobbleGain.disconnect();
          lp.disconnect();
          env.disconnect();
        };
        return;
      }
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Effective master gain: user mute OR page hidden ⇒ 0, else 1. */
  private applyMasterGain(): void {
    const t = this.ctx.currentTime;
    const g = this.master.gain;
    g.cancelScheduledValues(t);
    if (this.userMuted || this.hidden) {
      g.setValueAtTime(0, t); // hard mute — immediate
    } else {
      g.setTargetAtTime(1, t, 0.015); // click-free restore
    }
  }

  private jitter(base: number, spread: number): number {
    return base + (Math.random() * 2 - 1) * spread;
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.max(1, Math.round(sr * seconds)), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  /**
   * Whisper bed: looping noise through two slowly wandering bandpasses — a
   * dull mid "breath" layer and a narrow sibilant layer. Bus gain is 0 until
   * setDarkness() raises it, so this idles silently.
   */
  private buildWhisperLoop(): void {
    const breath = this.ctx.createBufferSource();
    breath.buffer = this.noise;
    breath.loop = true;
    const breathBp = this.ctx.createBiquadFilter();
    breathBp.type = "bandpass";
    breathBp.frequency.value = 900;
    breathBp.Q.value = 0.7;
    const breathLfo = this.ctx.createOscillator();
    breathLfo.frequency.value = 0.07;
    const breathDepth = this.ctx.createGain();
    breathDepth.gain.value = 350;
    breathLfo.connect(breathDepth);
    breathDepth.connect(breathBp.frequency);
    breath.connect(breathBp).connect(this.whisper);

    const sibilant = this.ctx.createBufferSource();
    sibilant.buffer = this.noise;
    sibilant.loop = true;
    const sibBp = this.ctx.createBiquadFilter();
    sibBp.type = "bandpass";
    sibBp.frequency.value = 2800;
    sibBp.Q.value = 4;
    const sibLfo = this.ctx.createOscillator();
    sibLfo.frequency.value = 0.9;
    const sibDepth = this.ctx.createGain();
    sibDepth.gain.value = 600;
    sibLfo.connect(sibDepth);
    sibDepth.connect(sibBp.frequency);
    const sibTrim = this.ctx.createGain();
    sibTrim.gain.value = 0.35;
    sibilant.connect(sibBp).connect(sibTrim).connect(this.whisper);

    // Started while suspended — they begin producing on unlock().
    breath.start();
    breathLfo.start();
    sibilant.start();
    sibLfo.start();
  }

  /**
   * Heartbeat: one lub-dub rendered into a buffer whose length is exactly one
   * beat at 55 bpm, looped forever behind a gain that setHeartbeat() opens.
   */
  private buildHeartbeatLoop(): void {
    const sr = this.ctx.sampleRate;
    const period = 60 / 55; // ≈ 1.09 s
    const buf = this.ctx.createBuffer(1, Math.round(sr * period), sr);
    const data = buf.getChannelData(0);
    const thump = (start: number, amp: number): void => {
      const startI = Math.round(start * sr);
      const len = Math.round(0.3 * sr);
      let phase = 0;
      for (let i = 0; i < len && startI + i < data.length; i++) {
        const t = i / sr;
        const f = 30 + 34 * Math.exp(-t / 0.06); // ~64 Hz knocking down to ~30
        phase += (2 * Math.PI * f) / sr;
        const idx = startI + i;
        data[idx] = (data[idx] ?? 0) + Math.sin(phase) * amp * Math.exp(-t / 0.09);
      }
    };
    thump(0, 0.9); // lub
    thump(0.22, 0.55); // dub

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.heartbeat);
    src.start();
  }

  private tone(o: ToneOpts): void {
    const t0 = this.ctx.currentTime + (o.at ?? 0);
    const tEnd = t0 + o.dur;

    const osc = this.ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(Math.max(1, o.freq), t0);
    if (o.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t0 + (o.glide ?? o.dur));
    }
    if (o.detune !== undefined) {
      osc.detune.setValueAtTime(o.detune, t0);
    }

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(SILENT, t0);
    env.gain.linearRampToValueAtTime(o.peak, t0 + (o.attack ?? 0.005));
    env.gain.exponentialRampToValueAtTime(SILENT, tEnd);

    const filt = o.filter !== undefined ? this.makeFilter(o.filter, t0, tEnd) : undefined;
    if (filt !== undefined) {
      osc.connect(filt);
      filt.connect(env);
    } else {
      osc.connect(env);
    }
    env.connect(this.sfx);

    osc.start(t0);
    osc.stop(tEnd + 0.05);
    osc.onended = () => {
      osc.disconnect();
      if (filt !== undefined) filt.disconnect();
      env.disconnect();
    };
  }

  private burst(o: BurstOpts): void {
    const t0 = this.ctx.currentTime + (o.at ?? 0);
    const tEnd = t0 + o.dur;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    if (o.rate !== undefined) {
      src.playbackRate.setValueAtTime(Math.max(0.05, o.rate), t0);
    }

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(SILENT, t0);
    env.gain.linearRampToValueAtTime(o.peak, t0 + (o.attack ?? 0.003));
    env.gain.exponentialRampToValueAtTime(SILENT, tEnd);

    const filt = this.makeFilter(o.filter, t0, tEnd);
    src.connect(filt);
    filt.connect(env);
    env.connect(this.sfx);

    src.start(t0);
    src.stop(tEnd + 0.05);
    src.onended = () => {
      src.disconnect();
      filt.disconnect();
      env.disconnect();
    };
  }

  private makeFilter(f: FilterOpts, t0: number, tEnd: number): BiquadFilterNode {
    const filt = this.ctx.createBiquadFilter();
    filt.type = f.type;
    filt.frequency.setValueAtTime(Math.max(1, f.freq), t0);
    if (f.freqEnd !== undefined) {
      filt.frequency.exponentialRampToValueAtTime(Math.max(1, f.freqEnd), tEnd);
    }
    if (f.q !== undefined) {
      filt.Q.setValueAtTime(f.q, t0);
    }
    return filt;
  }
}
