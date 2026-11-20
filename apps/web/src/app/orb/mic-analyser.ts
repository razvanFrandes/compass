import { type Signal, signal } from '@angular/core';

/*
  Microphone → { level, bands } signals for <juyo-orb>.

  level  RMS of the waveform → dBFS → 0..1 (−55 dB is silence, −15 dB is a raised voice), then an envelope
         with a 60 ms attack and a 300 ms release: the orb jumps with a syllable and settles after it.
  bands  the spectrum folded into log-spaced bands between 80 Hz and 8 kHz (where a voice lives), each with
         the same envelope. Low bands carry the voice's pitch, the middle its vowels, the top its consonants.

  The maths is in pure functions (tested in mic-analyser.spec.ts); `createMicAnalyser` wires them to Web Audio.
  Nothing is recorded or sent anywhere: the samples are read, reduced to these few numbers and dropped.
*/

export const ATTACK_S = 0.06;
export const RELEASE_S = 0.3;

/** Root mean square of a block of samples in −1..1. */
export function rms(samples: ArrayLike<number>) {
  const n = samples.length;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / n);
}

/** Amplitude → decibels relative to full scale. Silence is clamped to −160 dB instead of −∞. */
export const toDb = (amplitude: number) => 20 * Math.log10(Math.max(amplitude, 1e-8));

/** Maps decibels to 0..1: `floorDb` and below is 0, `floorDb + rangeDb` and above is 1. */
export function dbToUnit(db: number, floorDb: number, rangeDb: number) {
  const x = (db - floorDb) / rangeDb;
  return x < 0 || Number.isNaN(x) ? 0 : x > 1 ? 1 : x;
}

/** RMS → level: −55 dBFS (a quiet room) is 0, −15 dBFS (a raised voice near the mic) is 1. */
export const levelFromRms = (value: number, floorDb = -55, rangeDb = 40) => dbToUnit(toDb(value), floorDb, rangeDb);

/**
 * Attack/release envelope, independent of frame rate: rising values are followed quickly (`attack`),
 * falling values slowly (`release`). Both are time constants in seconds.
 */
export function envelope(current: number, target: number, dt: number, attack = ATTACK_S, release = RELEASE_S) {
  if (dt <= 0) return current;
  const tau = target > current ? attack : release;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/**
 * Bin indices that split a spectrum into `count` log-spaced bands from `minHz` to `maxHz`.
 * Returns `count + 1` strictly increasing edges; band i covers bins [edges[i], edges[i + 1]).
 * `binCount` is the analyser's frequencyBinCount (fftSize / 2); bin k is centred on k · sampleRate / fftSize.
 */
export function bandEdges(count: number, binCount: number, sampleRate: number, minHz = 80, maxHz = 8000): Uint16Array {
  const edges = new Uint16Array(count + 1);
  const hzPerBin = sampleRate / (binCount * 2);
  const top = Math.min(maxHz, sampleRate / 2);
  for (let i = 0; i <= count; i++) {
    const hz = minHz * Math.pow(top / minHz, i / count);
    const bin = Math.round(hz / hzPerBin);
    // At least one bin per band, even where log spacing is finer than the FFT (the low end).
    edges[i] = Math.min(binCount, Math.max(bin, i === 0 ? 1 : edges[i - 1] + 1));
  }
  return edges;
}

/**
 * Folds a spectrum in decibels (AnalyserNode.getFloatFrequencyData) into bands, 0..1 each.
 * Power is averaged, not decibels, so one loud bin is not drowned by quiet neighbours.
 */
export function bandLevels(spectrumDb: ArrayLike<number>, edges: ArrayLike<number>, out: Float32Array, floorDb = -82, rangeDb = 52) {
  for (let i = 0; i < out.length; i++) {
    const from = edges[i];
    const to = Math.max(from + 1, edges[i + 1]);
    let power = 0;
    for (let k = from; k < to; k++) {
      const db = spectrumDb[Math.min(k, spectrumDb.length - 1)];
      power += Number.isFinite(db) ? Math.pow(10, db / 10) : 0;
    }
    out[i] = dbToUnit(10 * Math.log10(Math.max(power / (to - from), 1e-16)), floorDb, rangeDb);
  }
  return out;
}

export interface MicAnalyserOptions {
  /** Number of bands. Default 8. */
  bands?: number;
  /** Envelope time constants in seconds. Defaults 0.06 and 0.3. */
  attack?: number;
  release?: number;
  minHz?: number;
  maxHz?: number;
  fftSize?: number;
}

export interface MicAnalyser {
  /** Smoothed loudness, 0..1. */
  readonly level: Signal<number>;
  /** Smoothed band levels, low to high, 0..1 each. The same array is reused; the signal still notifies every frame. */
  readonly bands: Signal<Float32Array>;
  /** Stops analysing and closes the audio context. The stream's tracks belong to the caller and are left running. */
  stop(): void;
}

/**
 * Starts analysing a microphone stream. Call it from the same user gesture that asked for the microphone,
 * so the browser lets the audio context start.
 *
 *     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
 *     const mic = createMicAnalyser(stream);
 *     // <juyo-orb state="listening" [level]="mic.level()" [bands]="mic.bands()" />
 *     mic.stop(); stream.getTracks().forEach((t) => t.stop());
 */
export function createMicAnalyser(stream: MediaStream, options: MicAnalyserOptions = {}): MicAnalyser {
  const { bands: count = 8, attack = ATTACK_S, release = RELEASE_S, minHz = 80, maxHz = 8000, fftSize = 1024 } = options;
  const level = signal(0);
  const smoothed = new Float32Array(count);
  const bands = signal(smoothed, { equal: () => false });

  const context = new AudioContext();
  void context.resume().catch(() => undefined);
  const analyser = context.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0; // the envelope below does the smoothing
  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);

  const wave = new Float32Array(analyser.fftSize);
  const spectrum = new Float32Array(analyser.frequencyBinCount);
  const raw = new Float32Array(count);
  const edges = bandEdges(count, analyser.frequencyBinCount, context.sampleRate, minHz, maxHz);

  let raf = 0;
  let last = performance.now();
  let current = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    analyser.getFloatTimeDomainData(wave);
    current = envelope(current, levelFromRms(rms(wave)), dt, attack, release);
    analyser.getFloatFrequencyData(spectrum);
    bandLevels(spectrum, edges, raw);
    for (let i = 0; i < count; i++) smoothed[i] = envelope(smoothed[i], raw[i], dt, attack, release);
    level.set(current);
    bands.set(smoothed);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  let stopped = false;
  return {
    level: level.asReadonly(),
    bands: bands.asReadonly(),
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      source.disconnect();
      void context.close().catch(() => undefined);
      level.set(0);
      bands.set(smoothed.fill(0));
    },
  };
}
