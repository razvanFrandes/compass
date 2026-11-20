/*
  The orb's motion model: everything that decides *how* the orb moves, with no WebGL in it.
  The renderer only draws the frame this file computes, so the behaviour is unit-tested (orb-motion.spec.ts).

  How a frame is made:
  1. The four states each describe a full set of parameters as a function of the voice (`stateParams`).
  2. A weight per state eases towards the current state (`stepWeights`), and the frame is the weighted mix.
     Changing state therefore cross-fades every uniform; nothing jumps.
  3. Speeds are integrated into phases (`flowT`, `spinT`, …), so a speed change bends the motion instead of
     making it skip.
*/

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';
export const ORB_STATES: readonly OrbState[] = ['idle', 'listening', 'thinking', 'speaking'];

/** Bands the shaders work with; any input length is resampled to this. */
export const ORB_BANDS = 8;
/** Spherical-harmonic terms used for the wobble: five of degree 2, four of degree 3. */
export const ORB_SH = 9;

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

/** A per-frame factor authored at 60 fps (a feedback decay, a zoom), converted to the real frame time. */
export const perFrame = (valueAt60: number, dt: number) => Math.pow(valueAt60, dt * 60);

/* ───────────────────────── Voice features ───────────────────────── */

export interface OrbFeatures {
  /** Overall loudness, 0..1. */
  level: number;
  /** Low bands (the voice's fundamental): the orb bulges. */
  bass: number;
  /** Middle bands (vowels): the surface ripples. */
  mid: number;
  /** High bands (consonants, sibilance): the rim sparkles. */
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
  /** Simplex displacement, as a fraction of the radius. */
  amp: number;
  /** Simplex frequency: higher is lumpier. */
  freq: number;
  /** How fast the displacement field drifts (units per second). */
  flow: number;
  /** Spherical-harmonic wobble amplitude. */
  wobble: number;
  /** Fine travelling ripples (mids). */
  ripple: number;
  /** Rings that travel over the surface from the pole facing the viewer (speaking). */
  pulse: number;
  /** Twist around the vertical axis, in radians at the poles (thinking). */
  twist: number;
  /** Rotation speed, radians per second. */
  spin: number;
  /** Inner plasma speed. */
  plasma: number;
  /** Inner plasma brightness. */
  glow: number;
  /** Fresnel rim brightness. */
  rim: number;
  /** Glints on the rim (highs). */
  sparkle: number;
  /** Feedback zoom per frame at 60 fps, minus one: how fast trails leave the orb. */
  trailZoom: number;
  /** Feedback rotation, radians per second: how much trails swirl. */
  trailSpin: number;
  /** Feedback decay per frame at 60 fps: how long trails last. */
  trailDecay: number;
  /** Wave distortion of the trails. */
  trailWarp: number;
  /** Halo brightness. */
  halo: number;
  /** The waveform ring drawn into the trails. */
  ring: number;
  /** Colour cycling speed, cycles of the gradient per second. */
  hue: number;
}

export const PARAM_KEYS = [
  'scale',
  'amp',
  'freq',
  'flow',
  'wobble',
  'ripple',
  'pulse',
  'twist',
  'spin',
  'plasma',
  'glow',
  'rim',
  'sparkle',
  'trailZoom',
  'trailSpin',
  'trailDecay',
  'trailWarp',
  'halo',
  'ring',
  'hue',
] as const satisfies readonly (keyof OrbParams)[];

/**
 * What each state looks like for a given voice at time `t`.
 * Idle breathes. Listening hands the surface to the voice. Thinking twists and turns, quietly.
 * Speaking beats: with no level supplied it follows `speechPulse`.
 */
export function stateParams(state: OrbState, f: OrbFeatures, t: number): OrbParams {
  switch (state) {
    case 'idle': {
      const breath = Math.sin(t * 0.85);
      const l = f.level * 0.35;
      return {
        scale: 1 + 0.018 * breath + 0.03 * l,
        amp: 0.085 + 0.012 * breath + 0.08 * l,
        freq: 0.72,
        flow: 0.16 + 0.3 * l,
        wobble: 0.034 + 0.05 * l,
        ripple: 0,
        pulse: 0,
        twist: 0.18 * Math.sin(t * 0.21),
        spin: 0.08,
        plasma: 0.2 + 0.4 * l,
        glow: 0.85 + 0.2 * l,
        rim: 0.9 + 0.08 * breath,
        sparkle: 0,
        trailZoom: 0.008,
        trailSpin: 0.06,
        trailDecay: 0.948,
        trailWarp: 0.55,
        halo: 0.55 + 0.06 * breath,
        ring: 0,
        hue: 0.018,
      };
    }
    case 'listening':
      return {
        scale: 1 + 0.07 * f.level + 0.04 * f.bass,
        amp: 0.09 + 0.055 * f.bass + 0.02 * f.level,
        freq: 0.62 + 0.2 * f.mid,
        flow: 0.34 + 1.25 * f.level,
        wobble: 0.045 + 0.1 * f.bass,
        ripple: 0.003 + 0.015 * f.mid,
        pulse: 0,
        twist: 0.12 * Math.sin(t * 0.5),
        spin: 0.12 + 0.22 * f.level,
        plasma: 0.42 + 1.5 * f.level,
        glow: 1 + 0.55 * f.level,
        rim: 1 + 0.55 * f.high + 0.3 * f.level,
        sparkle: f.high,
        trailZoom: 0.008 + 0.028 * f.level,
        trailSpin: 0.1 + 0.25 * f.mid,
        trailDecay: 0.945 + 0.018 * f.level,
        trailWarp: 0.8 + 1.7 * f.mid,
        halo: 0.72 + 0.6 * f.level,
        ring: 0.12 + 0.88 * f.level,
        hue: 0.04 + 0.11 * f.level,
      };
    case 'thinking':
      return {
        scale: 0.965 + 0.01 * Math.sin(t * 1.7),
        amp: 0.045,
        freq: 0.9,
        flow: 0.22,
        wobble: 0.02,
        ripple: 0.004,
        pulse: 0,
        twist: 1.15 + 0.25 * Math.sin(t * 0.6),
        spin: 0.6,
        plasma: 0.75,
        glow: 0.95,
        rim: 0.85,
        sparkle: 0.06,
        trailZoom: 0.0035,
        trailSpin: 1.0,
        trailDecay: 0.956,
        trailWarp: 0.35,
        halo: 0.62,
        ring: 0,
        hue: 0.06,
      };
    case 'speaking': {
      const d = Math.max(f.level, 0.85 * speechPulse(t));
      return {
        scale: 1 + 0.065 * d,
        amp: 0.08 + 0.06 * d + 0.04 * f.bass,
        freq: 0.7 + 0.12 * f.mid,
        flow: 0.3 + 0.55 * d,
        wobble: 0.04 + 0.05 * d,
        ripple: 0.008 * f.mid,
        pulse: 0.012 + 0.032 * d,
        twist: 0,
        spin: 0.14,
        plasma: 0.5 + 0.85 * d,
        glow: 1 + 0.45 * d,
        rim: 1 + 0.4 * d,
        sparkle: 0.15 * d + 0.4 * f.high,
        trailZoom: 0.01 + 0.02 * d,
        trailSpin: 0.08,
        trailDecay: 0.95,
        trailWarp: 0.6,
        halo: 0.7 + 0.5 * d,
        ring: 0.2 + 0.65 * d,
        hue: 0.05,
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

/* ───────────────────────── Spherical-harmonic wobble ───────────────────────── */

const SH_RATE = [0.53, 0.71, 0.37, 0.61, 0.83, 0.47, 0.67, 0.29, 0.59];
const SH_PHASE = [0.0, 1.9, 4.1, 2.6, 5.3, 0.8, 3.4, 1.2, 4.7];

/**
 * Coefficients for the nine harmonics. Each one swings at its own slow rate, so the shape never repeats
 * within a session; degree 3 gets less weight than degree 2, which keeps the wobble round rather than spiky.
 */
export function shCoefficients(phase: number, amplitude: number, out: Float32Array) {
  for (let i = 0; i < ORB_SH; i++) out[i] = amplitude * (i < 5 ? 1 : 0.45) * Math.sin(phase * SH_RATE[i] * 2 * Math.PI + SH_PHASE[i]);
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
  flowT: number;
  spinT: number;
  plasmaT: number;
  hueT: number;
  rippleT: number;
  pulseT: number;
  wobbleT: number;
  trailSpinT: number;
  sh: Float32Array;
  bands: Float32Array;
  /** This frame's length in 60 fps frames, and the per-frame feedback factors scaled to it. */
  frames: number;
  decay: number;
  zoom: number;
  rotate: number;
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
      flowT: time * 0.16,
      spinT: time * 0.08,
      plasmaT: time * 0.2,
      hueT: 0,
      rippleT: 0,
      pulseT: 0,
      wobbleT: time,
      trailSpinT: 0,
      sh: new Float32Array(ORB_SH),
      bands: new Float32Array(ORB_BANDS),
      frames: 1,
      decay: 1,
      zoom: 1,
      rotate: 0,
    };
  }

  /** Jump straight to a state (used for the reduced-motion still). */
  snap(state: OrbState) {
    this.weights = weightsFor(state);
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

    fr.flowT += p.flow * dt;
    fr.spinT += p.spin * dt;
    fr.plasmaT += p.plasma * dt;
    fr.hueT = (fr.hueT + p.hue * dt) % 1;
    fr.rippleT += (1.4 + 3.2 * f.mid) * dt;
    fr.pulseT += (5 + 60 * p.pulse) * dt;
    fr.wobbleT += (0.5 + 1.6 * f.bass + 0.6 * f.level) * dt;
    fr.trailSpinT += p.trailSpin * dt;
    shCoefficients(fr.wobbleT, p.wobble, fr.sh);

    fr.frames = dt * 60;
    fr.decay = perFrame(p.trailDecay, dt);
    fr.zoom = perFrame(1 + p.trailZoom, dt);
    fr.rotate = p.trailSpin * dt * 0.35;
    return fr;
  }
}
