/*
  The orb's motion model: everything that decides *how* the orb moves, with no WebGL in it.
  The renderer only draws the frame this file computes, so the behaviour is unit-tested (orb-motion.spec.ts).

  How a frame is made:
  1. The four states each describe a full set of parameters as a function of the voice (`stateParams`).
  2. A weight per state eases towards the current state (`stepWeights`), and the frame is the weighted mix.
     Changing state therefore cross-fades every uniform; nothing jumps.
  3. Speeds are integrated into phases (`spinT`, `waveT`, …), so a speed change bends the motion instead of
     making it skip.
*/

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';
export const ORB_STATES: readonly OrbState[] = ['idle', 'listening', 'thinking', 'speaking'];

/** Bands the shaders work with; any input length is resampled to this. */
export const ORB_BANDS = 8;

/* ───────────────────────── Easing ───────────────────────── */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Hermite smoothstep, safe when the edges are equal. */
export function smoothstep(edge0: number, edge1: number, x: number) {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Frame-rate independent exponential approach: after `tau` seconds 63% of the distance is covered,
 * whether that takes 4 frames or 40.
 */
export function damp(current: number, target: number, tau: number, dt: number) {
  if (tau <= 0 || dt <= 0) return tau <= 0 ? target : current;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/* ───────────────────────── Voice features ───────────────────────── */

export interface OrbFeatures {
  /** Overall loudness, 0..1. */
  level: number;
  /** Low bands (the voice's fundamental): the sphere swells and its equator lifts. */
  bass: number;
  /** Middle bands (vowels): the middle latitudes lift. */
  mid: number;
  /** High bands (consonants, sibilance): the poles lift and the points twinkle. */
  high: number;
}

/** Splits any number of bands into bass / mid / high: the lowest quarter, the middle, and the top three eighths. */
export function splitBands(bands: ArrayLike<number>): Pick<OrbFeatures, 'bass' | 'mid' | 'high'> {
  const n = bands.length;
  if (!n) return { bass: 0, mid: 0, high: 0 };
  const b = Math.max(1, Math.round(n * 0.25));
  const m = Math.max(b, Math.round(n * 0.625));
  const mean = (from: number, to: number) => {
    if (to <= from) return clamp01(bands[Math.min(from, n - 1)]);
    let sum = 0;
    for (let i = from; i < to; i++) sum += bands[i];
    return clamp01(sum / (to - from));
  };
  return { bass: mean(0, b), mid: mean(b, m), high: mean(m, n) };
}

/** Resamples `src` into `out` by averaging the source bands that fall in each output band. */
export function resampleBands(src: ArrayLike<number>, out: Float32Array) {
  const n = src.length;
  const m = out.length;
  if (!n) return out.fill(0);
  for (let i = 0; i < m; i++) {
    const from = Math.floor((i * n) / m);
    const to = Math.max(from + 1, Math.floor(((i + 1) * n) / m));
    let sum = 0;
    for (let j = from; j < to; j++) sum += src[Math.min(j, n - 1)];
    out[i] = clamp01(sum / (to - from));
  }
  return out;
}

/** With no analyser, the level alone still gives the bands some life: each one drifts at its own rate. */
export function synthBands(level: number, t: number, out: Float32Array) {
  const n = out.length;
  for (let i = 0; i < n; i++) {
    const tilt = 1 - 0.45 * (i / Math.max(1, n - 1)); // a voice has less energy higher up
    const drift = 0.62 + 0.38 * Math.sin(t * (5.1 + i * 2.3) + i * 1.7) * Math.sin(t * (1.3 + i * 0.41) + i);
    out[i] = clamp01(level * tilt * drift);
  }
  return out;
}

/**
 * The rhythm of speech when nobody gives us a level for it: syllables at about 3.6 per second whose
 * timing wanders a little, grouped into phrases with pauses between them. 0..1.
 */
export function speechPulse(t: number) {
  const syllable = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 3.6 * t + 1.3 * Math.sin(2 * Math.PI * 0.7 * t)), 2);
  const phrase = smoothstep(-0.25, 0.35, Math.sin(2 * Math.PI * 0.23 * t) + 0.4 * Math.sin(2 * Math.PI * 0.61 * t + 1));
  return clamp01(syllable * (0.22 + 0.78 * phrase));
}

/**
 * A believable voice with no microphone (the lab, a sandboxed preview): writes the bands and returns the level.
 * The fundamental follows the syllables, the vowel energy wanders between the middle bands like formants do,
 * and the top bands fire in short bursts, like "s" and "t".
 */
export function simulatedVoice(t: number, bands: Float32Array) {
  const env = speechPulse(t);
  const n = bands.length;
  const vowel = 0.5 + 0.5 * Math.sin(t * 2.1 + Math.sin(t * 0.9)); // 0..1: where the formant sits
  const hiss = Math.pow(Math.max(0, Math.sin(t * 7.3 + 2 * Math.sin(t * 1.7))), 6);
  for (let i = 0; i < n; i++) {
    const x = i / Math.max(1, n - 1);
    const fundamental = Math.exp(-Math.pow(x / 0.16, 2));
    const formant = Math.exp(-Math.pow((x - (0.3 + 0.3 * vowel)) / 0.16, 2));
    const sibilant = smoothstep(0.6, 0.95, x) * hiss;
    bands[i] = clamp01(env * (0.95 * fundamental + 0.8 * formant) + 0.85 * sibilant * (0.3 + 0.7 * env));
  }
  return clamp01(env * 0.9 + 0.1 * hiss);
}

/* ───────────────────────── Parameters per state ───────────────────────── */

export interface OrbParams {
  /** Radius multiplier. */
  scale: number;
  /** How far a full band pushes its latitude out, as a fraction of the radius. */
  lift: number;
  /** Share of the lift that rides a wave travelling from pole to pole, 0..1. The rest is steady. */
  wave: number;
  /** How fast that wave travels, radians per second. */
  waveSpeed: number;
  /** A slow swell that is always there, so a silent sphere is still alive. */
  ripple: number;
  /** Rings leaving the equator towards both poles (speaking). */
  pulse: number;
  /** A three-armed spiral that winds around the sphere (thinking). */
  spiral: number;
  /** Rotation speed, radians per second. */
  spin: number;
  /** Point size multiplier. */
  dot: number;
  /** Twinkle: points flick larger and brighter (highs). */
  sparkle: number;
  /** Brightness. */
  glow: number;
  /** Colour cycling speed, cycles per second. */
  hue: number;
}

export const PARAM_KEYS = ['scale', 'lift', 'wave', 'waveSpeed', 'ripple', 'pulse', 'spiral', 'spin', 'dot', 'sparkle', 'glow', 'hue'] as const satisfies readonly (keyof OrbParams)[];

/**
 * What each state looks like for a given voice at time `t`.
 * Idle breathes. Listening hands the latitudes to the voice. Thinking winds a spiral and turns, quietly.
 * Speaking beats: with no level supplied it follows `speechPulse`.
 */
export function stateParams(state: OrbState, f: OrbFeatures, t: number): OrbParams {
  switch (state) {
    case 'idle': {
      const breath = Math.sin(t * 0.85);
      return {
        scale: 1 + 0.015 * breath + 0.02 * f.level,
        lift: 0.08,
        wave: 0.65,
        waveSpeed: 1.2,
        ripple: 0.022 + 0.006 * breath,
        pulse: 0,
        spiral: 0,
        spin: 0.12,
        dot: 1,
        sparkle: 0,
        glow: 0.85 + 0.05 * breath,
        hue: 0.01,
      };
    }
    case 'listening':
      return {
        scale: 1 + 0.05 * f.bass + 0.03 * f.level,
        lift: 0.3,
        wave: 0.65,
        waveSpeed: 3,
        ripple: 0.012,
        pulse: 0,
        spiral: 0,
        spin: 0.14 + 0.3 * f.level,
        dot: 1 + 0.1 * f.level,
        sparkle: f.high,
        glow: 1 + 0.25 * f.level,
        hue: 0.03 + 0.05 * f.level,
      };
    case 'thinking':
      return {
        scale: 0.97 + 0.008 * Math.sin(t * 1.7),
        lift: 0.03,
        wave: 0.65,
        waveSpeed: 1.5,
        ripple: 0.008,
        pulse: 0,
        spiral: 0.075,
        spin: 0.75,
        dot: 0.95,
        sparkle: 0.08,
        glow: 0.95,
        hue: 0.05,
      };
    case 'speaking': {
      const d = Math.max(f.level, 0.85 * speechPulse(t));
      return {
        scale: 1 + 0.045 * d,
        lift: 0.16,
        wave: 0.4,
        waveSpeed: 2.4,
        ripple: 0.01,
        pulse: 0.035 + 0.075 * d,
        spiral: 0,
        spin: 0.18,
        dot: 1 + 0.1 * d,
        sparkle: 0.1 * d + 0.3 * f.high,
        glow: 1 + 0.3 * d,
        hue: 0.03,
      };
    }
  }
}

/* ───────────────────────── State transitions ───────────────────────── */

export type StateWeights = Record<OrbState, number>;

export const weightsFor = (state: OrbState): StateWeights => ({ idle: 0, listening: 0, thinking: 0, speaking: 0, [state]: 1 });

/** Moves the weights towards `state`. They always sum to 1, so the mix is a true cross-fade. */
export function stepWeights(w: StateWeights, state: OrbState, dt: number, tau = 0.38): StateWeights {
  const next = { ...w };
  for (const s of ORB_STATES) next[s] = damp(w[s], s === state ? 1 : 0, tau, dt);
  return next;
}

export function mixParams(w: StateWeights, f: OrbFeatures, t: number): OrbParams {
  const out = {} as OrbParams;
  for (const k of PARAM_KEYS) out[k] = 0;
  for (const s of ORB_STATES) {
    if (w[s] < 1e-4) continue;
    const p = stateParams(s, f, t);
    for (const k of PARAM_KEYS) out[k] += p[k] * w[s];
  }
  return out;
}

/* ───────────────────────── The frame ───────────────────────── */

export interface OrbInput {
  state: OrbState;
  level: number;
  bands: ArrayLike<number> | null;
}

export interface OrbFrame {
  time: number;
  params: OrbParams;
  features: OrbFeatures;
  /** Integrated phases. */
  spinT: number;
  waveT: number;
  pulseT: number;
  spiralT: number;
  twinkleT: number;
  hueT: number;
  bands: Float32Array;
}

/** Holds the eased state of one orb and turns inputs into frames. */
export class OrbMotion {
  private weights: StateWeights;
  private readonly features: OrbFeatures = { level: 0, bass: 0, mid: 0, high: 0 };
  private readonly frame: OrbFrame;
  private readonly rawBands = new Float32Array(ORB_BANDS);

  /** `time` is where the animation starts: a non-zero start makes the first frame already look settled. */
  constructor(state: OrbState = 'idle', time = 7.3) {
    this.weights = weightsFor(state);
    this.frame = {
      time,
      params: mixParams(this.weights, this.features, time),
      features: this.features,
      spinT: time * 0.12,
      waveT: time * 1.2,
      pulseT: 0,
      spiralT: 0,
      twinkleT: 0,
      hueT: 0,
      bands: new Float32Array(ORB_BANDS),
    };
  }

  step(dt: number, input: OrbInput): OrbFrame {
    const fr = this.frame;
    const f = this.features;
    fr.time += dt;
    const t = fr.time;

    // Inputs get a light 40 ms smoothing of our own, so a host that passes a raw level still looks fluid.
    const level = clamp01(input.level || 0);
    f.level = damp(f.level, level, 0.04, dt);
    if (input.bands?.length) resampleBands(input.bands, this.rawBands);
    else synthBands(input.state === 'speaking' ? Math.max(level, 0.85 * speechPulse(t)) : level, t, this.rawBands);
    for (let i = 0; i < ORB_BANDS; i++) fr.bands[i] = damp(fr.bands[i], this.rawBands[i], 0.04, dt);
    const split = splitBands(fr.bands);
    f.bass = split.bass;
    f.mid = split.mid;
    f.high = split.high;

    this.weights = stepWeights(this.weights, input.state, dt);
    const p = (fr.params = mixParams(this.weights, f, t));

    fr.spinT += p.spin * dt;
    fr.waveT += p.waveSpeed * dt;
    fr.pulseT += (5 + 40 * p.pulse) * dt;
    fr.spiralT += (1.2 + 14 * p.spiral) * dt;
    fr.twinkleT += 14 * dt;
    fr.hueT = (fr.hueT + p.hue * dt) % 1;
    return fr;
  }
}
