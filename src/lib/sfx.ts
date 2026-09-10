/**
 * Synthesised sound design for the control room. No assets, off by default, never throws.
 *
 *   voices ──► fx (Gain 1) ─────────────┐
 *   bed: 55 + 82.4 + 110 + 164.8 Hz      ├──► comp (DynamicsCompressor) ──► master (Gain 0 ↔ MASTER) ──► destination
 *        + band-passed noise (LFO sweep) ┘
 *
 * Every sound is scheduled on the audio clock (never setTimeout), so muting is purely the master
 * gain and nothing is queued while the context is not running. The AudioContext is created only
 * inside a user gesture (the sound toggle, a key, a click); a preference restored from storage
 * waits for the first gesture. Hard cap of 16 live voices, per-sound rate limits.
 */
import type { Classification } from "@/engine";

const MASTER = 0.28;
const BED_LEVEL = 0.12;
const MAX_VOICES = 16;

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  fx: GainNode;
  bed: GainNode;
  noise: AudioBuffer;
  bedStarted: boolean;
}

let graph: Graph | null = null;
/** desired state, applied whenever the context is (or becomes) running */
let enabled = false;
let ambientOn = false;
let appliedEnabled = false;
let appliedAmbient = false;
let voices = 0;
/** audio-clock time when the last scheduled voice ends; lets the voice counter self-heal */
let lastVoiceEnd = 0;
let unlockArmed = false;
const last = new Map<string, number>();

function allow(key: string, gapMs: number): boolean {
  const now = performance.now();
  if (now - (last.get(key) ?? -1e9) < gapMs) return false;
  last.set(key, now);
  return true;
}

function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    /* audio is decoration: nothing here may throw into React or the RAF loop */
  }
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** True while a user gesture is in flight; true when the browser cannot tell us. */
function hasActivation(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  return ua ? ua.isActive : true;
}

/** Create or resume the context on the next click or key, inside that gesture's call stack. */
function armUnlock(): void {
  if (unlockArmed || typeof window === "undefined") return;
  unlockArmed = true;
  const unlock = () => {
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
    unlockArmed = false;
    safe(() => {
      ac();
    });
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // UI-only randomness: the engine's PRNG is untouched.
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function build(ctx: AudioContext): Graph {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;
  comp.connect(master);
  const fx = ctx.createGain();
  fx.gain.value = 1;
  fx.connect(comp);
  const bed = ctx.createGain();
  bed.gain.value = 0;
  bed.connect(comp);
  const g: Graph = { ctx, master, fx, bed, noise: makeNoise(ctx), bedStarted: false };
  ctx.addEventListener("statechange", () => safe(() => applyPending(g)));
  return g;
}

/** The ambient bed: a quiet A1 drone with two partials and a slow band-pass sweep on noise. Started once, faded by `bed`. */
function startBed(g: Graph): void {
  const { ctx, bed, noise } = g;
  const t = ctx.currentTime;
  const partials: [number, number][] = [
    [55, 0.55],
    [82.4, 0.3],
    [110, 0.2],
    [164.8, 0.1],
  ];
  for (const [freq, gain] of partials) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const og = ctx.createGain();
    og.gain.value = gain;
    o.connect(og).connect(bed);
    o.start(t);
  }
  const n = ctx.createBufferSource();
  n.buffer = noise;
  n.loop = true;
  const bpf = ctx.createBiquadFilter();
  bpf.type = "bandpass";
  bpf.frequency.value = 380;
  bpf.Q.value = 0.7;
  const ng = ctx.createGain();
  ng.gain.value = 0.25;
  n.connect(bpf).connect(ng).connect(bed);
  n.start(t);
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.05;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 90; // sweeps the band 290 → 470 Hz
  lfo.connect(lfoGain).connect(bpf.frequency);
  lfo.start(t);
  g.bedStarted = true;
}

/** Apply the desired master/bed state once the clock is actually advancing (never on a suspended context). */
function applyPending(g: Graph): void {
  if (g.ctx.state !== "running") return;
  const now = g.ctx.currentTime;
  if (!g.bedStarted) startBed(g);
  if (enabled !== appliedEnabled) {
    // −60 dB in about 50 ms: mute is instant, and scheduled-ahead notes die with it.
    g.master.gain.setTargetAtTime(enabled ? MASTER : 0, now, 0.01);
    appliedEnabled = enabled;
  }
  if (ambientOn !== appliedAmbient) {
    g.bed.gain.setTargetAtTime(ambientOn ? BED_LEVEL : 0, now, ambientOn ? 0.9 : 0.4);
    appliedAmbient = ambientOn;
  }
}

/** The context, created or resumed inside a user gesture; null on the server, without WebAudio, or while waiting for a gesture. */
function ac(): Graph | null {
  if (typeof window === "undefined") return null;
  try {
    if (!graph) {
      if (!hasActivation()) {
        armUnlock();
        return null;
      }
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      graph = build(new Ctor());
    }
    const g = graph;
    if (g.ctx.state === "suspended") {
      if (hasActivation()) g.ctx.resume().catch(() => {});
      else armUnlock();
    }
    applyPending(g);
    return g;
  } catch {
    return null;
  }
}

/** A context that is running right now, or null: nothing is ever queued on a stopped clock. */
function live(): Graph | null {
  const g = ac();
  return g && g.ctx.state === "running" ? g : null;
}

function claimVoice(g: Graph, endsAt: number): boolean {
  if (voices >= MAX_VOICES) {
    if (g.ctx.currentTime <= lastVoiceEnd) return false;
    voices = 0; // every scheduled voice has ended: the counter drifted, heal it
  }
  voices++;
  lastVoiceEnd = Math.max(lastVoiceEnd, endsAt);
  return true;
}

interface Envelope {
  /** peak gain */
  gain?: number;
  /** seconds to reach the peak (default 5 ms) */
  attack?: number;
  /** seconds of decay at the end of `dur` (default: the whole note decays after the attack) */
  release?: number;
  /** seconds after now to start */
  at?: number;
}

/** 0 → peak over `attack`, hold, then an exponential decay that ends exactly at `dur`. */
function envelope(ctx: AudioContext, t0: number, dur: number, e: Envelope): GainNode {
  const attack = Math.min(e.attack ?? 0.005, dur * 0.5);
  const release = Math.min(e.release ?? dur, dur - attack);
  const peak = e.gain ?? 0.04;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  env.gain.setValueAtTime(peak, t0 + dur - release);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  return env;
}

interface VoiceOpts extends Envelope {
  type?: OscillatorType;
  /** glide the frequency to this value over `dur` */
  slideTo?: number;
  detune?: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
}

function voice(freq: number, dur: number, o: VoiceOpts = {}): void {
  const g = live();
  if (!g) return;
  const { ctx, fx } = g;
  const t0 = ctx.currentTime + (o.at ?? 0);
  if (!claimVoice(g, t0 + dur + 0.05)) return;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (o.detune) osc.detune.value = o.detune;
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
  const env = envelope(ctx, t0, dur, o);
  let node: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.value = o.filter.freq;
    f.Q.value = o.filter.q ?? 1;
    node.connect(f);
    node = f;
  }
  node.connect(env).connect(fx);
  osc.onended = () => {
    voices = Math.max(0, voices - 1);
    env.disconnect();
  };
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

interface NoiseOpts extends Envelope {
  filter: {
    type: BiquadFilterType;
    freq: number;
    q?: number;
    /** sweep the cutoff to this value ... */
    sweepTo?: number;
    /** ... over this many seconds (default `dur`) ... */
    sweepFor?: number;
    /** ... and settle back to this value by the end of the note */
    settle?: number;
  };
}

/** Shared 1 s white-noise buffer through a filter and the same envelope as `voice`. */
function noise(dur: number, o: NoiseOpts): void {
  const g = live();
  if (!g) return;
  const { ctx, fx } = g;
  const t0 = ctx.currentTime + (o.at ?? 0);
  if (!claimVoice(g, t0 + dur + 0.05)) return;
  const src = ctx.createBufferSource();
  src.buffer = g.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter.type;
  f.frequency.setValueAtTime(o.filter.freq, t0);
  f.Q.value = o.filter.q ?? 1;
  if (o.filter.sweepTo) {
    const sweepFor = Math.min(o.filter.sweepFor ?? dur, dur);
    f.frequency.linearRampToValueAtTime(o.filter.sweepTo, t0 + sweepFor);
    if (o.filter.settle && sweepFor < dur) f.frequency.linearRampToValueAtTime(o.filter.settle, t0 + dur);
  }
  const env = envelope(ctx, t0, dur, o);
  src.connect(f).connect(env).connect(fx);
  src.onended = () => {
    voices = Math.max(0, voices - 1);
    env.disconnect();
  };
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

/** Two-note motifs per marking: OPEN bright, RESTRICTED softer, SECRET low with weight, ONYX edgy. */
const ROUTE_TONES: Record<Classification, [number, number, OscillatorType]> = {
  OPEN: [660, 990, "sine"],
  RESTRICTED: [587, 880, "triangle"],
  SECRET: [440, 660, "sine"],
  ONYX: [349, 523, "sawtooth"],
};

function buzzer(): void {
  voice(220, 0.25, { type: "square", gain: 0.035, slideTo: 110 });
  voice(180, 0.3, { type: "square", gain: 0.03, at: 0.12, slideTo: 90 });
  voice(110, 0.35, { type: "square", gain: 0.03, filter: { type: "lowpass", freq: 800 } });
  voice(113, 0.35, { type: "square", gain: 0.03, filter: { type: "lowpass", freq: 800 } });
}

export const sfx = {
  /** Master on/off. Creates or resumes the context when called from a user gesture (the sound toggle). */
  setEnabled(on: boolean): void {
    safe(() => {
      enabled = on;
      if (!on) {
        if (graph) {
          graph.master.gain.setTargetAtTime(0, graph.ctx.currentTime, 0.01);
          appliedEnabled = false;
        }
        return;
      }
      ac();
    });
  },

  /** Fade the ambient bed in (while the director plays) or out. */
  ambient(on: boolean): void {
    safe(() => {
      ambientOn = on;
      if (!enabled) return;
      ac();
    });
  },

  /** A job routed to an environment, coloured by its marking. */
  route(c: Classification): void {
    safe(() => {
      if (!enabled || !allow("route", 80)) return;
      const [f1, f2, type] = ROUTE_TONES[c] ?? ROUTE_TONES.OPEN;
      voice(f1, 0.12, { type, gain: 0.05, slideTo: f2 });
      voice(f2, 0.16, { type, gain: 0.04, at: 0.09 });
      if (c === "SECRET") voice(220, 0.2, { gain: 0.02 });
    });
  },

  /** Refused at the policy barrier, or a rejected import. */
  refuse(): void {
    safe(() => {
      if (!enabled || !allow("refuse", 150)) return;
      buzzer();
    });
  },

  /** One diode chunk; pitch rises with progress 0 → 1 (900 → 1800 Hz). */
  chunk(progress: number): void {
    safe(() => {
      if (!enabled || !allow("chunk", 45)) return;
      voice(900 + 900 * clamp01(progress), 0.045, { type: "triangle", gain: 0.02 });
    });
  },

  /** The enclave's return-path attempt bouncing off the gate. */
  bounce(): void {
    safe(() => {
      if (!enabled || !allow("bounce", 200)) return;
      voice(300, 0.18, { type: "sawtooth", gain: 0.03, slideTo: 150 });
      voice(70, 0.25, { gain: 0.06, attack: 0.002 });
    });
  },

  /** An operator's approval stamp; the second operator lands lower. `at` offsets it on the audio clock. */
  stamp(n: number, at = 0): void {
    safe(() => {
      if (!enabled || !allow(`stamp-${n}`, 120)) return;
      noise(0.07, { gain: 0.045, at, filter: { type: "bandpass", freq: 1400, q: 1.5 } });
      voice(n === 1 ? 196 : 165, 0.14, { gain: 0.05, at });
    });
  },

  /** Bundle verified and loaded in the enclave: a held chord under a rising arpeggio. */
  verified(): void {
    safe(() => {
      if (!enabled || !allow("verified", 500)) return;
      for (const f of [523, 659, 784]) voice(f, 0.9, { gain: 0.028, release: 0.6 });
      [523, 659, 784, 1046].forEach((f, i) => voice(f, 0.22, { gain: 0.03, at: i * 0.09 }));
    });
  },

  /** One tick per ledger link appended (batches of up to four). */
  ledger(count = 1): void {
    safe(() => {
      if (!enabled || !allow("ledger", 120)) return;
      const n = Math.min(Math.max(1, Math.floor(count)), 4);
      for (let i = 0; i < n; i++) voice(880, 0.03, { type: "square", gain: 0.012, at: i * 0.055 });
    });
  },

  /** A camera flight. */
  whoosh(): void {
    safe(() => {
      if (!enabled || !allow("whoosh", 400)) return;
      noise(0.55, { gain: 0.03, attack: 0.15, release: 0.3, filter: { type: "bandpass", freq: 300, q: 0.9, sweepTo: 2200, sweepFor: 0.25, settle: 400 } });
    });
  },

  /** Scenario complete. */
  complete(): void {
    safe(() => {
      if (!enabled || !allow("complete", 2000)) return;
      [523, 784, 1046].forEach((f, i) => voice(f, 0.6, { gain: 0.035, at: i * 0.14 }));
      voice(130.8, 1.8, { type: "triangle", gain: 0.035, attack: 0.2 });
      noise(0.8, { gain: 0.012, filter: { type: "highpass", freq: 4000 } });
    });
  },

  /** Ledger chain verified intact (chime) or broken (buzzer). */
  chain(ok: boolean): void {
    safe(() => {
      if (!enabled || !allow("chain", 300)) return;
      if (ok) {
        voice(784, 0.12, { gain: 0.03 });
        voice(1046, 0.18, { gain: 0.03, at: 0.1 });
      } else {
        buzzer();
      }
    });
  },
};
