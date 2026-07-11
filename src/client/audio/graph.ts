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
  | "match-strike"
  | "chime"
  | "victory"
  | "exit"
  | "waystone"
  | "stairs-found"
  | "monster-die"
  | "split"
  | "gas"
  | "ignite"
  | "salt"
  | "chalk"
  | "sign"
  | "plate"
  | "pool"
  | "stolen"
  | "locked"
  | "thump"
  | "mirror"
  | "vial"
  | "shard"
  | "ritual"
  | "sheet"
  | "reject"
  | "inspect"
  | "guttering"
  | "squelch-soft"
  | "drip"
  | "bell-far"
  | "moan"
  | "skitter"
  | "creak";

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
  private readonly bed: GainNode; // per-biome room tone (D72)
  private readonly theme: GainNode; // title-menu vigil theme (D84)
  private readonly noise: AudioBuffer;
  private bedSources: AudioScheduledSourceNode[] = [];
  private bedOthers: AudioNode[] = [];
  private bedBiome = -1;
  private themeSources: AudioScheduledSourceNode[] = [];
  private themeOthers: AudioNode[] = [];
  private themeTimers: number[] = [];
  private themeOn = false;
  private themeConv: ConvolverNode | null = null; // procedural cathedral (D84)
  private themeCycle = 0; // bar counter for the score

  private userMuted = false;
  private hidden: boolean;
  /** In-flight ctx.resume() from unlock() — see play()'s race note. */
  private resumed: Promise<void> | null = null;
  /** Per-call peak scalar (playNow's `quiet` reuse) read by tone()/burst(). */
  private trim = 1;

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

    this.bed = this.ctx.createGain();
    this.bed.gain.value = 0;
    this.bed.connect(this.master);

    this.theme = this.ctx.createGain();
    this.theme.gain.value = 0;
    this.theme.connect(this.master);

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
    this.resumed = this.ctx.resume();
    this.resumed.catch(() => {
      // blocked or interrupted — the context stays locked, cues stay dropped
    });
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

  /**
   * The sound direction changes per biome (D72): each biome gets its own
   * synthesized room tone — warm hush in the Tallow Halls, earth-weight in
   * the Cellars, submerged wash in the Drowned Stacks, furnace roar below,
   * a hollow organ hum in the Choir, a thin subsonic ring in the Deep, a
   * gold two-tone at the Bottom. Crossfades over ~2s on descent. Quiet by
   * design: the bed is felt more than heard.
   */
  setBiome(bi: number): void {
    if (bi === this.bedBiome) return;
    this.bedBiome = bi;
    const t = this.ctx.currentTime;
    this.bed.gain.cancelScheduledValues(t);
    this.bed.gain.setTargetAtTime(0, t, 0.5);
    const oldSrc = this.bedSources;
    const oldOther = this.bedOthers;
    this.bedSources = [];
    this.bedOthers = [];
    window.setTimeout(() => {
      for (const s of oldSrc) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
        s.disconnect();
      }
      for (const n of oldOther) n.disconnect();
    }, 2600);

    // voice builders — everything routes into this.bed
    const looped = (): AudioBufferSourceNode => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      return src;
    };
    const noiseVoice = (type: BiquadFilterType, freq: number, q: number, gain: number): BiquadFilterNode => {
      const src = looped();
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(this.bed);
      src.start();
      this.bedSources.push(src);
      this.bedOthers.push(f, g);
      return f;
    };
    const drone = (type: OscillatorType, freq: number, gain: number): void => {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(this.bed);
      o.start();
      this.bedSources.push(o);
      this.bedOthers.push(g);
    };
    const lfo = (rate: number, depth: number, target: AudioParam): void => {
      const o = this.ctx.createOscillator();
      o.frequency.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = depth;
      o.connect(g).connect(target);
      o.start();
      this.bedSources.push(o);
      this.bedOthers.push(g);
    };

    let level = 0.05;
    switch (bi) {
      case 1: {
        // the Root Cellars: earth-weight, something settling far off
        noiseVoice("lowpass", 140, 0.7, 0.8);
        drone("sine", 41, 0.35);
        level = 0.055;
        break;
      }
      case 2: {
        // the Drowned Stacks: a submerged wash that slowly wanders
        const f = noiseVoice("bandpass", 320, 2.2, 1.1);
        lfo(0.07, 90, f.frequency);
        drone("sine", 49, 0.3);
        level = 0.05;
        break;
      }
      case 3: {
        // the Glassblack Furnaces: a roar behind the walls, fire-flicker
        // wobbling the roar's mouth
        const f = noiseVoice("lowpass", 95, 0.7, 1.3);
        lfo(6.2, 14, f.frequency);
        drone("sawtooth", 36, 0.12);
        level = 0.075;
        break;
      }
      case 4: {
        // the Hollow Choir: two pipes still sounding, wind over stone
        drone("sine", 110, 0.5);
        drone("sine", 165.2, 0.3); // a fifth, slightly wide — hollow beat
        noiseVoice("highpass", 900, 0.7, 0.12);
        level = 0.045;
        break;
      }
      case 5: {
        // the Wickless Deep: subsonic pressure, a thin ring of nothing
        drone("sine", 33, 0.5);
        noiseVoice("bandpass", 1250, 9, 0.1);
        level = 0.055;
        break;
      }
      case 6: {
        // the Bottom: a gold two-tone, patient as a bell that never strikes
        drone("sine", 45, 0.4);
        drone("sine", 67.8, 0.22);
        drone("triangle", 135.5, 0.06);
        level = 0.05;
        break;
      }
      default: {
        // the Tallow Halls: the warm hush of a room full of candles
        noiseVoice("lowpass", 210, 0.7, 0.7);
        drone("sine", 55, 0.22);
        level = 0.05;
      }
    }
    this.bed.gain.setTargetAtTime(level, t + 0.3, 1.0);
  }

  /**
   * The title-menu theme (D84, recomposed on operator verdict "one mono
   * bell") — "the vigil". A real composed piece, still 100% synthesized:
   * a descending LAMENT BASS in A minor (A–G–F–E, one chord per ~9.6 s
   * bar, add9/maj7 voicings, ten detuned pad oscillators spread across
   * the stereo field), the Candlemaid's music-box tune above it (in-key,
   * resting every third pass so the loop breathes), a rare far toll, the
   * candle-room hush, wax crackle — all sent through a procedurally
   * generated stereo convolution reverb (no samples: the impulse response
   * is synthesized noise with exponential decay and progressive damping).
   * Startable only after a user gesture on the menu (operator-directed
   * extension of invariant 6 — the match-strike remains the in-run
   * ceremony); the menu keeps a mute control visible, and it obeys the
   * same master/visibility mutes.
   */
  startMenuTheme(): void {
    if (this.themeOn) return;
    this.themeOn = true;
    const begin = (): void => {
      if (!this.themeOn || this.ctx.state !== "running") return;
      this.buildThemeReverb();
      this.buildThemeVoices();
      const t = this.ctx.currentTime;
      this.theme.gain.cancelScheduledValues(t);
      // 0.20 = operator-tuned (+25% over the first mix — "hard to hear")
      this.theme.gain.setTargetAtTime(0.2, t + 0.1, 1.2);
      this.scheduleThemeScore(350);
      this.scheduleThemeCrackle(1200 + Math.random() * 1400);
    };
    if (this.ctx.state === "running") {
      begin();
      return;
    }
    const resumed = this.resumed;
    if (resumed !== null) {
      void resumed.then(begin, () => {
        this.themeOn = false;
      });
      return;
    }
    // no unlock has happened — the menu must gesture-unlock first
    this.themeOn = false;
  }

  /** Fade the vigil out (~1.5 s tail) and release its voices. */
  stopMenuTheme(): void {
    if (!this.themeOn) return;
    this.themeOn = false;
    this.themeConv = null;
    this.themeCycle = 0;
    for (const id of this.themeTimers) window.clearTimeout(id);
    this.themeTimers = [];
    const t = this.ctx.currentTime;
    this.theme.gain.cancelScheduledValues(t);
    this.theme.gain.setTargetAtTime(0, t, 0.35);
    const src = this.themeSources;
    const oth = this.themeOthers;
    this.themeSources = [];
    this.themeOthers = [];
    window.setTimeout(() => {
      for (const s of src) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
        s.disconnect();
      }
      for (const n of oth) n.disconnect();
    }, 2200);
  }

  /** The vigil's sustaining voices — everything routes into this.theme. */
  private buildThemeVoices(): void {
    const hold = (node: AudioScheduledSourceNode): void => {
      node.start();
      this.themeSources.push(node);
    };
    // the hush: a room's worth of still air, slowly breathing
    const air = this.ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const airLp = this.ctx.createBiquadFilter();
    airLp.type = "lowpass";
    airLp.frequency.value = 220;
    airLp.Q.value = 0.7;
    const airG = this.ctx.createGain();
    airG.gain.value = 0.55;
    air.connect(airLp).connect(airG).connect(this.theme);
    const airLfo = this.ctx.createOscillator();
    airLfo.frequency.value = 0.06;
    const airDepth = this.ctx.createGain();
    airDepth.gain.value = 55;
    airLfo.connect(airDepth);
    airDepth.connect(airLp.frequency);
    hold(air);
    hold(airLfo);
    this.themeOthers.push(airLp, airG, airDepth);

    // the shimmer: a thin high air that wanders, barely there
    const shim = this.ctx.createBufferSource();
    shim.buffer = this.noise;
    shim.loop = true;
    const shimBp = this.ctx.createBiquadFilter();
    shimBp.type = "bandpass";
    shimBp.frequency.value = 2400;
    shimBp.Q.value = 6;
    const shimG = this.ctx.createGain();
    shimG.gain.value = 0.05;
    shim.connect(shimBp).connect(shimG).connect(this.theme);
    const shimLfo = this.ctx.createOscillator();
    shimLfo.frequency.value = 0.11;
    const shimDepth = this.ctx.createGain();
    shimDepth.gain.value = 500;
    shimLfo.connect(shimDepth);
    shimDepth.connect(shimBp.frequency);
    hold(shim);
    hold(shimLfo);
    this.themeOthers.push(shimBp, shimG, shimDepth);
  }

  /**
   * The lament: A minor descending tetrachord — Am(add9), G, Fmaj7, E —
   * the oldest "ancient and doomed" progression there is. One chord per
   * ~9.6 s bar; voicings kept low and close (candle-lit, not orchestral).
   */
  private static readonly THEME_CHORDS: readonly { bass: number; pad: readonly number[] }[] = [
    { bass: 55.0, pad: [110.0, 164.81, 220.0, 246.94, 261.63] }, // Am(add9): A2 E3 A3 B3 C4
    { bass: 49.0, pad: [98.0, 146.83, 196.0, 246.94, 293.66] }, // G: G2 D3 G3 B3 D4
    { bass: 43.65, pad: [87.31, 130.81, 174.61, 220.0, 329.63] }, // Fmaj7: F2 C3 F3 A3 E4
    { bass: 41.2, pad: [82.41, 123.47, 164.81, 207.65, 246.94] }, // E: E2 B2 E3 G#3 B3
  ];

  /**
   * The Candlemaid's tune — a two-phrase music-box melody over the
   * lament, entry per bar: [bar, offset s, Hz, decay s]. Falls with the
   * bass and lands on the Phrygian E — mournful, unresolved, inviting.
   */
  private static readonly THEME_MELODY: readonly [number, number, number, number][] = [
    [0, 0.5, 659.25, 3.4], // E5 — the call
    [0, 2.8, 523.25, 3.0], // C5
    [0, 4.6, 493.88, 2.6], // B4
    [0, 6.0, 440.0, 4.2], // A4
    [1, 1.2, 493.88, 3.0], // B4
    [1, 3.4, 587.33, 3.4], // D5 — the reach
    [1, 6.2, 493.88, 3.6], // B4
    [2, 0.8, 523.25, 3.2], // C5
    [2, 3.2, 440.0, 3.0], // A4
    [2, 6.4, 659.25, 4.0], // E5 over Fmaj7 — the ache
    [3, 1.0, 493.88, 3.2], // B4
    [3, 3.6, 415.3, 3.8], // G#4 — the leading tone
    [3, 6.4, 329.63, 5.0], // E4 — she does not come back up
  ];

  /**
   * Procedural cathedral: a stereo impulse response synthesized in place
   * (decorrelated noise, exponential decay, highs damped progressively —
   * the deeper into the tail, the more stone it has passed through).
   * Zero samples fetched; invariant 4 holds.
   */
  private buildThemeReverb(): void {
    const conv = this.ctx.createConvolver();
    conv.buffer = this.makeReverbIR(3.2, 1.1);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.8;
    conv.connect(wet).connect(this.theme);
    this.themeConv = conv;
    this.themeOthers.push(conv, wet);
  }

  private makeReverbIR(seconds: number, tau: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const len = Math.max(1, Math.round(sr * seconds));
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        // one-pole lowpass whose cutoff falls along the tail
        const k = 0.55 * (1 - t / seconds) + 0.06;
        lp += (Math.random() * 2 - 1 - lp) * k;
        // 20 ms fade-in stands in for pre-delay; keeps the dry hit distinct
        const pre = t < 0.02 ? t / 0.02 : 1;
        d[i] = lp * Math.exp(-t / tau) * pre;
      }
    }
    return buf;
  }

  /** One pad voice: detuned sine+triangle pair through a lowpass, panned,
   *  breathing on its own slow LFO, split dry/reverb. Self-cleaning. */
  private themePadVoice(freq: number, pan: number, t0: number, holdS: number, peak: number): void {
    const oscA = this.ctx.createOscillator();
    oscA.type = "sine";
    oscA.frequency.value = freq;
    const oscB = this.ctx.createOscillator();
    oscB.type = "triangle";
    oscB.frequency.value = freq;
    oscB.detune.value = 4 + Math.random() * 4;
    const trimB = this.ctx.createGain();
    trimB.gain.value = 0.35;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(1400, freq * 6);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(SILENT, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + 2.6);
    env.gain.setValueAtTime(peak, t0 + holdS);
    env.gain.exponentialRampToValueAtTime(SILENT, t0 + holdS + 3.6);
    const breath = this.ctx.createOscillator();
    breath.frequency.value = 0.08 + Math.random() * 0.06;
    const breathDepth = this.ctx.createGain();
    breathDepth.gain.value = peak * 0.16;
    breath.connect(breathDepth);
    breathDepth.connect(env.gain);
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    const send = this.ctx.createGain();
    send.gain.value = 0.4;
    oscA.connect(lp);
    oscB.connect(trimB).connect(lp);
    lp.connect(env).connect(panner);
    panner.connect(this.theme);
    if (this.themeConv !== null) panner.connect(send).connect(this.themeConv);
    const tEnd = t0 + holdS + 3.7;
    oscA.start(t0);
    oscB.start(t0);
    breath.start(t0);
    oscA.stop(tEnd);
    oscB.stop(tEnd);
    breath.stop(tEnd);
    oscA.onended = () => {
      for (const n of [oscA, oscB, trimB, lp, env, breath, breathDepth, panner, send]) n.disconnect();
    };
  }

  /** The lament bass — dry, centered, felt in the floor. */
  private themeBass(freq: number, t0: number, holdS: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(SILENT, t0);
    env.gain.linearRampToValueAtTime(0.075, t0 + 2.2);
    env.gain.setValueAtTime(0.075, t0 + holdS);
    env.gain.exponentialRampToValueAtTime(SILENT, t0 + holdS + 3.0);
    osc.connect(env).connect(this.theme);
    osc.start(t0);
    osc.stop(t0 + holdS + 3.1);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }

  /** A music-box bell: fundamental + detuned double + inharmonic partials
   *  (3.01f, 5.4f), panned, mostly living inside the reverb. */
  private themeBell(freq: number, atS: number, peak: number, pan: number, sendLvl: number, dur: number): void {
    const t0 = this.ctx.currentTime + atS;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    const dry = this.ctx.createGain();
    dry.gain.value = 0.5;
    panner.connect(dry).connect(this.theme);
    const send = this.ctx.createGain();
    send.gain.value = sendLvl;
    if (this.themeConv !== null) panner.connect(send).connect(this.themeConv);
    const parts: [number, number, number, number][] = [
      [1, 1, dur, 0], // fundamental
      [1, 0.5, dur * 0.9, 3.5], // detuned double — the shimmer
      [3.01, 0.2, dur * 0.5, 0], // music-box clink
      [5.4, 0.05, dur * 0.28, 0], // glassy edge
    ];
    // the fundamental (parts[0]) rings longest — it owns the bus teardown
    let longest: OscillatorNode | null = null;
    for (const [ratio, amp, dec, cents] of parts) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      osc.detune.value = cents;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(SILENT, t0);
      env.gain.linearRampToValueAtTime(peak * amp, t0 + 0.004);
      env.gain.exponentialRampToValueAtTime(SILENT, t0 + dec);
      osc.connect(env).connect(panner);
      osc.start(t0);
      osc.stop(t0 + dec + 0.05);
      const localEnv = env;
      osc.onended = () => {
        osc.disconnect();
        localEnv.disconnect();
      };
      if (longest === null) longest = osc;
    }
    if (longest !== null) {
      const own = longest;
      const prev = own.onended;
      own.onended = (ev) => {
        if (prev !== null) prev.call(own, ev);
        panner.disconnect();
        dry.disconnect();
        send.disconnect();
      };
    }
  }

  /**
   * The score: one bar per call — bass + five pad voices spread across
   * the field, the tune when it isn't resting (every third pass it lies
   * silent and lets the stone speak), a far toll through the reverb on
   * an off-cycle so three minutes on this screen never feels looped.
   */
  private scheduleThemeScore(delayMs: number): void {
    const id = window.setTimeout(() => {
      if (!this.themeOn || this.ctx.state !== "running") return;
      const BAR = 9.6;
      const bar = this.themeCycle % 4;
      const pass = Math.floor(this.themeCycle / 4);
      const c = AudioGraph.THEME_CHORDS[bar]!;
      const t0 = this.ctx.currentTime + 0.05;
      this.themeBass(c.bass, t0, BAR);
      const spread = [-0.55, 0.35, -0.2, 0.5, -0.4];
      c.pad.forEach((f, i) => {
        this.themePadVoice(f, spread[i % spread.length]!, t0, BAR, 0.045);
      });
      if (pass % 3 !== 2) {
        for (const [b, at, f, dur] of AudioGraph.THEME_MELODY) {
          if (b !== bar) continue;
          this.themeBell(
            f,
            at + (Math.random() - 0.5) * 0.2, // rubato — a hand, not a clock
            0.055 + Math.random() * 0.015,
            0.12 + Math.random() * 0.24, // the tune lives Gate-side
            0.8,
            dur,
          );
        }
      }
      if (this.themeCycle % 5 === 2) {
        this.themeBell(329.63, 2 + Math.random() * 4, 0.016, 0.45, 1.4, 6);
      }
      this.themeCycle++;
      this.scheduleThemeScore(BAR * 1000);
    }, delayMs);
    this.themeTimers.push(id);
  }

  /** Sparse wax crackle — the candle on the menu is alive. */
  private scheduleThemeCrackle(delay: number): void {
    const id = window.setTimeout(() => {
      if (!this.themeOn || this.ctx.state !== "running") return;
      this.trim = 1;
      this.burst({
        dur: 0.02,
        peak: 0.022,
        filter: { type: "bandpass", freq: this.jitter(2500, 600), q: 2 },
      });
      if (Math.random() < 0.35) {
        this.burst({
          at: 0.07,
          dur: 0.015,
          peak: 0.016,
          filter: { type: "bandpass", freq: this.jitter(3100, 500), q: 2 },
        });
      }
      this.scheduleThemeCrackle(1600 + Math.random() * 2600);
    }, delay);
    this.themeTimers.push(id);
  }

  /** Slow ~55 bpm lub-dub, faded in/out over ~a beat. Subtle by design. */
  setHeartbeat(on: boolean): void {
    const t = this.ctx.currentTime;
    this.heartbeat.gain.cancelScheduledValues(t);
    this.heartbeat.gain.setTargetAtTime(on ? 0.12 : 0, t, 0.6);
  }

  /**
   * `quiet` replays a cue at reduced level (distant/soft variants — tells,
   * off-screen thuds) without duplicating synth code: tone()/burst() scale
   * their peaks by `this.trim` for the duration of the synchronous switch.
   *
   * Race note: unlock() and the first cue arrive inside the SAME gesture
   * (match-strike), but ctx.resume() is async — the state is still
   * "suspended" when play("match-strike") lands, and the signature cue used
   * to drop. If a resume is in flight we replay the cue once it settles.
   * Before any unlock() `resumed` is null, so nothing can sound early
   * (invariant 6 holds).
   */
  play(cue: Cue, quiet = false): void {
    if (this.ctx.state === "running") {
      this.playNow(cue, quiet);
      return;
    }
    const resumed = this.resumed;
    if (resumed !== null) {
      void resumed.then(
        () => {
          if (this.ctx.state === "running") this.playNow(cue, quiet);
        },
        () => {
          /* resume failed — stay silent */
        },
      );
    }
    // no resume in flight: locked or interrupted — drop silently
  }

  private playNow(cue: Cue, quiet: boolean): void {
    this.trim = quiet ? 0.35 : 1;

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
        env.gain.linearRampToValueAtTime(0.1 * this.trim, t0 + 0.06);
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

      // ── resolves & ceremonies ───────────────────────────────────────────
      case "victory": {
        // the Bottom, reached: three ascending sines with slow attacks under
        // a late soft shimmer — golden, restrained, never a fanfare
        for (const [i, f] of [220, 330, 440].entries()) {
          this.tone({ type: "sine", freq: f, at: i * 0.28, attack: 0.16, dur: 1.15, peak: 0.07 });
        }
        this.tone({ type: "triangle", freq: 880, at: 0.72, attack: 0.4, dur: 1.3, peak: 0.025, detune: 5 });
        this.burst({ at: 0.6, dur: 1.1, peak: 0.02, attack: 0.5, filter: { type: "highpass", freq: 5200 } });
        return;
      }
      case "exit": {
        // survive-and-leave: a two-tone settle, humbler than victory
        this.tone({ type: "sine", freq: 392, attack: 0.1, dur: 0.7, peak: 0.055 });
        this.tone({ type: "sine", freq: 294, at: 0.3, attack: 0.14, dur: 0.9, peak: 0.05 });
        return;
      }

      // ── shrines & stones ────────────────────────────────────────────────
      case "waystone": {
        // verdigris shimmer — the stone wakes to take your truths
        this.tone({ type: "triangle", freq: 740, dur: 0.5, peak: 0.045, attack: 0.03 });
        this.tone({ type: "triangle", freq: 1108, at: 0.08, dur: 0.55, peak: 0.035, attack: 0.05, detune: 6 });
        this.burst({
          dur: 0.5,
          peak: 0.02,
          attack: 0.12,
          filter: { type: "bandpass", freq: 2400, freqEnd: 3600, q: 3 },
        });
        return;
      }
      case "stairs-found": {
        // small hollow tick over the stairwell's cold draft
        this.tone({ type: "sine", freq: 620, freqEnd: 480, dur: 0.09, peak: 0.06, attack: 0.002 });
        this.burst({
          at: 0.04,
          dur: 0.25,
          peak: 0.02,
          attack: 0.08,
          rate: 0.6,
          filter: { type: "lowpass", freq: 300 },
        });
        return;
      }
      case "chime": {
        // bright glassy ping, slow decay — the Font acknowledges
        this.tone({ type: "sine", freq: 1568, dur: 0.9, peak: 0.05, attack: 0.004 });
        this.tone({ type: "sine", freq: 2349, dur: 0.6, peak: 0.02, attack: 0.004 });
        return;
      }
      case "pool": {
        // watery shimmer — the surface remembers someone
        this.burst({
          dur: 0.55,
          peak: 0.035,
          attack: 0.1,
          rate: 0.5,
          filter: { type: "bandpass", freq: 600, freqEnd: 1400, q: 3 },
        });
        this.tone({ type: "sine", freq: 990, freqEnd: 1320, glide: 0.4, dur: 0.5, peak: 0.03, attack: 0.08 });
        return;
      }
      case "shard": {
        // stone hum — the waystone answers from afar
        this.tone({ type: "triangle", freq: 220, dur: 0.6, peak: 0.05, attack: 0.08, detune: 4 });
        this.tone({ type: "sine", freq: 440, at: 0.1, dur: 0.5, peak: 0.03, attack: 0.1 });
        return;
      }
      case "ritual": {
        // low pulse — the sigil drinks the offered dark
        this.tone({ type: "sine", freq: 70, freqEnd: 55, dur: 0.4, peak: 0.09, attack: 0.05 });
        this.tone({ type: "triangle", freq: 140, at: 0.02, dur: 0.3, peak: 0.03, attack: 0.06 });
        return;
      }
      case "plate": {
        // stone click — something under the floor takes note
        this.tone({ type: "sine", freq: 210, freqEnd: 160, dur: 0.08, peak: 0.08, attack: 0.002 });
        this.burst({ dur: 0.025, peak: 0.045, filter: { type: "bandpass", freq: 1500, q: 1.4 } });
        return;
      }

      // ── creatures & consequences ────────────────────────────────────────
      case "monster-die": {
        // soft thud plus a last exhale (quiet variant = melting into tallow)
        this.tone({ type: "sine", freq: 120, freqEnd: 60, dur: 0.16, peak: 0.09, attack: 0.003 });
        this.burst({
          at: 0.06,
          dur: 0.28,
          peak: 0.045,
          attack: 0.05,
          rate: 0.7,
          filter: { type: "lowpass", freq: 900, freqEnd: 250 },
        });
        return;
      }
      case "split": {
        // wet squelch — one body becomes two
        this.burst({
          dur: 0.14,
          peak: 0.08,
          attack: 0.01,
          rate: 0.45,
          filter: { type: "bandpass", freq: 380, freqEnd: 160, q: 2.5 },
        });
        this.tone({ type: "sine", freq: 240, freqEnd: 90, dur: 0.12, peak: 0.05, attack: 0.004 });
        return;
      }
      case "gas": {
        // hiss-pop: a spore bladder lets go
        this.burst({ dur: 0.035, peak: 0.06, filter: { type: "bandpass", freq: 1900, q: 1.2 } });
        this.burst({ at: 0.03, dur: 0.4, peak: 0.05, attack: 0.04, filter: { type: "highpass", freq: 2600 } });
        return;
      }
      case "ignite": {
        // whoomp — the air catches all at once
        this.burst({
          dur: 0.3,
          peak: 0.11,
          attack: 0.015,
          rate: 0.8,
          filter: { type: "lowpass", freq: 900, freqEnd: 180 },
        });
        this.tone({ type: "sine", freq: 90, freqEnd: 50, dur: 0.25, peak: 0.08, attack: 0.01 });
        return;
      }
      case "stolen": {
        // sharp descending sting — it's gone
        this.tone({
          type: "square",
          freq: 880,
          freqEnd: 220,
          glide: 0.18,
          dur: 0.2,
          peak: 0.06,
          attack: 0.002,
          filter: { type: "lowpass", freq: 2200 },
        });
        this.tone({ type: "sine", freq: 660, freqEnd: 165, glide: 0.2, at: 0.02, dur: 0.22, peak: 0.05, attack: 0.002 });
        return;
      }
      case "locked": {
        // iron rattle — the door refuses
        for (const [i, f] of [640, 590, 655].entries()) {
          this.tone({
            type: "square",
            freq: f,
            at: i * 0.055,
            dur: 0.045,
            peak: 0.045,
            attack: 0.002,
            filter: { type: "bandpass", freq: 1300, q: 2 },
          });
        }
        this.burst({ dur: 0.05, peak: 0.03, filter: { type: "highpass", freq: 3000 } });
        return;
      }
      case "thump": {
        // dull hands-full thump — the lid drops back on its hoard
        this.tone({ type: "sine", freq: 140, freqEnd: 85, dur: 0.12, peak: 0.08, attack: 0.003 });
        this.burst({ dur: 0.05, peak: 0.03, rate: 0.7, filter: { type: "lowpass", freq: 600 } });
        return;
      }

      // ── tools ───────────────────────────────────────────────────────────
      case "salt": {
        // granular scatter — a handful of grains across stone
        for (let i = 0; i < 5; i++) {
          this.burst({
            at: i * 0.022 + Math.random() * 0.012,
            dur: 0.02,
            peak: 0.035 - i * 0.004,
            filter: { type: "bandpass", freq: this.jitter(3400, 700), q: 2 },
          });
        }
        return;
      }
      case "chalk": {
        // dry scratch, two strokes
        this.burst({
          dur: 0.09,
          peak: 0.045,
          attack: 0.01,
          rate: 1.4,
          filter: { type: "bandpass", freq: 2600, freqEnd: 3400, q: 1.6 },
        });
        this.burst({
          at: 0.11,
          dur: 0.07,
          peak: 0.035,
          attack: 0.01,
          rate: 1.5,
          filter: { type: "bandpass", freq: 3000, freqEnd: 2400, q: 1.6 },
        });
        return;
      }
      case "sign": {
        // two wooden knocks — the plank goes in
        this.tone({ type: "sine", freq: 320, freqEnd: 240, dur: 0.07, peak: 0.09, attack: 0.002 });
        this.burst({ dur: 0.03, peak: 0.04, filter: { type: "bandpass", freq: 1100, q: 1 } });
        this.tone({ type: "sine", freq: 290, freqEnd: 220, at: 0.12, dur: 0.06, peak: 0.055, attack: 0.002 });
        return;
      }
      case "mirror": {
        // glassy upward sweep — the shard drinks the light
        this.tone({ type: "sine", freq: 1200, freqEnd: 2400, glide: 0.3, dur: 0.35, peak: 0.04, attack: 0.03 });
        this.burst({ dur: 0.3, peak: 0.02, attack: 0.06, filter: { type: "highpass", freq: 4800 } });
        return;
      }
      case "vial": {
        // liquid plink-plink — glowmoss decanted
        this.tone({ type: "sine", freq: 900, freqEnd: 1350, glide: 0.06, dur: 0.12, peak: 0.055, attack: 0.003 });
        this.tone({ type: "sine", freq: 1180, freqEnd: 1600, glide: 0.05, at: 0.09, dur: 0.1, peak: 0.035, attack: 0.003 });
        return;
      }

      // ── interface murmurs ───────────────────────────────────────────────
      case "sheet": {
        // soft parchment whisper — a page turns
        this.burst({
          dur: 0.18,
          peak: 0.035,
          attack: 0.03,
          rate: 1.1,
          filter: { type: "bandpass", freq: 2000, freqEnd: 3200, q: 0.8 },
        });
        return;
      }
      case "reject": {
        // tiny dull no — nothing happened
        this.tone({
          type: "sine",
          freq: 220,
          freqEnd: 180,
          dur: 0.07,
          peak: 0.045,
          attack: 0.003,
          filter: { type: "lowpass", freq: 700 },
        });
        return;
      }
      case "inspect": {
        // faint tick — attention narrows on a tile
        this.burst({ dur: 0.02, peak: 0.03, filter: { type: "bandpass", freq: 2100, q: 2 } });
        return;
      }
      case "guttering": {
        // the flame shrinks a tier — waxy sputter, felt more than heard
        this.burst({
          dur: 0.12,
          peak: 0.03,
          attack: 0.02,
          rate: 0.9,
          filter: { type: "bandpass", freq: 1600, freqEnd: 700, q: 1.4 },
        });
        this.tone({ type: "sine", freq: 200, freqEnd: 150, dur: 0.18, peak: 0.025, attack: 0.02 });
        return;
      }

      // ── distant tells (01 §8 — very quiet by design) ────────────────────
      case "squelch-soft": {
        // something gelatinous shifts its weight nearby
        this.burst({
          dur: 0.12,
          peak: 0.035,
          attack: 0.02,
          rate: 0.4,
          filter: { type: "bandpass", freq: 300, freqEnd: 150, q: 2 },
        });
        return;
      }
      case "drip": {
        // a low watery breath — something waterlogged inhales
        this.tone({ type: "sine", freq: 520, freqEnd: 300, dur: 0.09, peak: 0.035, attack: 0.003 });
        this.burst({
          at: 0.06,
          dur: 0.3,
          peak: 0.025,
          attack: 0.08,
          rate: 0.5,
          filter: { type: "lowpass", freq: 500, freqEnd: 200 },
        });
        return;
      }
      case "bell-far": {
        // a bell heard through stone — the Bellhung sways somewhere close
        this.tone({ type: "triangle", freq: 1046.5, dur: 0.5, peak: 0.02, attack: 0.01 });
        this.tone({ type: "sine", freq: 523.25, dur: 0.45, peak: 0.012, attack: 0.01 });
        return;
      }
      case "moan": {
        // a choral vowel with no choir left behind it — distant, hollow
        this.tone({
          type: "sawtooth",
          freq: 175,
          freqEnd: 155,
          glide: 0.5,
          dur: 0.6,
          peak: 0.025,
          attack: 0.15,
          filter: { type: "bandpass", freq: 700, freqEnd: 450, q: 4 },
        });
        this.tone({
          type: "sawtooth",
          freq: 262,
          freqEnd: 233,
          glide: 0.5,
          dur: 0.55,
          peak: 0.015,
          attack: 0.18,
          detune: -8,
          filter: { type: "bandpass", freq: 900, freqEnd: 600, q: 4 },
        });
        return;
      }
      case "skitter": {
        // dry legs over stone, too many of them
        for (let i = 0; i < 6; i++) {
          this.burst({
            at: i * 0.035 + Math.random() * 0.015,
            dur: 0.015,
            peak: 0.025,
            filter: { type: "bandpass", freq: this.jitter(4200, 800), q: 2.5 },
          });
        }
        return;
      }
      case "creak": {
        // old iron under a swinging lantern
        this.tone({
          type: "sawtooth",
          freq: 480,
          freqEnd: 640,
          glide: 0.4,
          dur: 0.5,
          peak: 0.022,
          attack: 0.12,
          filter: { type: "bandpass", freq: 950, q: 6 },
        });
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
    env.gain.linearRampToValueAtTime(o.peak * this.trim, t0 + (o.attack ?? 0.005));
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
    env.gain.linearRampToValueAtTime(o.peak * this.trim, t0 + (o.attack ?? 0.003));
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
