/** The rate speech recognition wants; more only costs upload. */
export const TARGET_RATE = 16_000;

/** By how much to thin a stream out: 48 kHz → 3 (16 kHz). 1 when the rate is not a multiple (44.1 kHz stays as is). */
export function decimation(sampleRate: number): number {
  const factor = sampleRate / TARGET_RATE;
  return Number.isInteger(factor) && factor >= 1 ? factor : 1;
}

/** Float samples (−1..1) as 16-bit little-endian PCM, each output sample the mean of `factor` input samples. */
export function toPcm16(samples: Float32Array, factor = 1): ArrayBuffer {
  const length = Math.floor(samples.length / factor);
  const out = new DataView(new ArrayBuffer(length * 2));
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += samples[i * factor + j]!;
    const value = Math.max(-1, Math.min(1, sum / factor));
    out.setInt16(i * 2, Math.round(value < 0 ? value * 0x8000 : value * 0x7fff), true);
  }
  return out.buffer;
}

/** Loudness of a block as 0..1: RMS in dBFS, with −55 dB as silence and −15 dB as a full voice. */
export function loudness(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  const db = 20 * Math.log10(Math.sqrt(sum / Math.max(1, samples.length)) + 1e-8);
  return Math.min(1, Math.max(0, (db + 55) / 40));
}

/** One smoothing step: fast up (60 ms), slow down (300 ms), independent of the frame rate. */
export function smooth(current: number, target: number, dtSeconds: number): number {
  const tau = target > current ? 0.06 : 0.3;
  return current + (target - current) * (1 - Math.exp(-dtSeconds / tau));
}
