import { ATTACK_S, RELEASE_S, bandEdges, bandLevels, dbToUnit, envelope, levelFromRms, rms, toDb } from './mic-analyser';

describe('level', () => {
  it('rms of silence is 0, of a full-scale square wave 1, of a full-scale sine 1/√2', () => {
    expect(rms(new Float32Array(256))).toBe(0);
    expect(rms([])).toBe(0);
    expect(rms(Float32Array.from({ length: 256 }, (_, i) => (i % 2 ? 1 : -1)))).toBeCloseTo(1, 10);
    const sine = Float32Array.from({ length: 1024 }, (_, i) => Math.sin((2 * Math.PI * 8 * i) / 1024));
    expect(rms(sine)).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it('converts amplitude to decibels, with silence clamped', () => {
    expect(toDb(1)).toBeCloseTo(0, 10);
    expect(toDb(0.1)).toBeCloseTo(-20, 10);
    expect(toDb(0)).toBeCloseTo(-160, 10);
  });

  it('maps −55 dBFS to 0 and −15 dBFS to 1, clamped outside', () => {
    const amplitude = (db: number) => Math.pow(10, db / 20);
    expect(levelFromRms(0)).toBe(0);
    expect(levelFromRms(amplitude(-70))).toBe(0);
    expect(levelFromRms(amplitude(-55))).toBeCloseTo(0, 6);
    expect(levelFromRms(amplitude(-35))).toBeCloseTo(0.5, 6);
    expect(levelFromRms(amplitude(-15))).toBeCloseTo(1, 6);
    expect(levelFromRms(1)).toBe(1);
  });

  it('dbToUnit treats −Infinity and NaN as silence', () => {
    expect(dbToUnit(Number.NEGATIVE_INFINITY, -80, 50)).toBe(0);
    expect(dbToUnit(Number.NaN, -80, 50)).toBe(0);
    expect(dbToUnit(-55, -80, 50)).toBeCloseTo(0.5, 10);
  });
});

describe('envelope', () => {
  it('rises with a 60 ms time constant and falls with a 300 ms one', () => {
    expect(envelope(0, 1, ATTACK_S)).toBeCloseTo(1 - Math.exp(-1), 10);
    expect(envelope(1, 0, RELEASE_S)).toBeCloseTo(Math.exp(-1), 10);
    expect(ATTACK_S).toBe(0.06);
    expect(RELEASE_S).toBe(0.3);
  });

  it('attack is about five times faster than release', () => {
    const up = envelope(0, 1, 0.016);
    const down = 1 - envelope(1, 0, 0.016);
    expect(up / down).toBeGreaterThan(4);
    expect(up / down).toBeLessThan(5.5);
  });

  it('is frame-rate independent', () => {
    let at120 = 0;
    for (let i = 0; i < 12; i++) at120 = envelope(at120, 1, 1 / 120);
    let at30 = 0;
    for (let i = 0; i < 3; i++) at30 = envelope(at30, 1, 1 / 30);
    expect(at120).toBeCloseTo(at30, 10);
  });

  it('never overshoots, and holds on a zero-length frame', () => {
    expect(envelope(0, 1, 10)).toBeLessThanOrEqual(1);
    expect(envelope(1, 0, 10)).toBeGreaterThanOrEqual(0);
    expect(envelope(0.4, 1, 0)).toBe(0.4);
  });

  it('a syllable is caught at once and let go slowly', () => {
    // 100 ms of sound, then silence, at 60 fps.
    let v = 0;
    for (let i = 0; i < 6; i++) v = envelope(v, 1, 1 / 60);
    expect(v).toBeGreaterThan(0.8);
    for (let i = 0; i < 6; i++) v = envelope(v, 0, 1 / 60);
    expect(v).toBeGreaterThan(0.55); // still more than half-way up 100 ms after it stopped
    for (let i = 0; i < 60; i++) v = envelope(v, 0, 1 / 60);
    expect(v).toBeLessThan(0.03);
  });
});

describe('bands', () => {
  // A 1024-point FFT at 48 kHz: 512 bins of 46.875 Hz.
  const edges = bandEdges(8, 512, 48000);

  it('gives count + 1 strictly increasing edges inside the spectrum', () => {
    expect(edges).toHaveLength(9);
    for (let i = 1; i < edges.length; i++) expect(edges[i]).toBeGreaterThan(edges[i - 1]);
    expect(edges[0]).toBeGreaterThanOrEqual(1); // never the DC bin
    expect(edges[8]).toBeLessThanOrEqual(512);
  });

  it('spans 80 Hz to 8 kHz on a log scale', () => {
    const hz = (bin: number) => bin * 46.875;
    expect(hz(edges[0])).toBeLessThan(120);
    expect(hz(edges[8])).toBeCloseTo(8000, -2);
    // Log spacing: the top band is far wider than the bottom one.
    expect(edges[8] - edges[7]).toBeGreaterThan((edges[1] - edges[0]) * 10);
  });

  it('keeps one bin per band when the FFT is too coarse for the low end', () => {
    const coarse = bandEdges(16, 64, 44100);
    for (let i = 1; i < coarse.length; i++) expect(coarse[i]).toBeGreaterThan(coarse[i - 1]);
  });

  it('never reaches past the Nyquist frequency', () => {
    const narrow = bandEdges(8, 256, 8000); // an 8 kHz stream tops out at 4 kHz
    expect(narrow[8]).toBeLessThanOrEqual(256);
  });

  it('a tone lights the band it falls in and no other', () => {
    const spectrum = new Float32Array(512).fill(-120);
    spectrum[Math.round(1000 / 46.875)] = -30; // 1 kHz
    const out = bandLevels(spectrum, edges, new Float32Array(8));
    const hit = Array.from(out).findIndex((v) => v > 0);
    expect(hit).toBeGreaterThan(-1);
    const from = edges[hit] * 46.875;
    const to = edges[hit + 1] * 46.875;
    expect(1000).toBeGreaterThanOrEqual(from - 47);
    expect(1000).toBeLessThanOrEqual(to + 47);
    Array.from(out).forEach((v, i) => i !== hit && expect(v).toBe(0));
  });

  it('maps −82 dB to 0 and −30 dB to 1, and treats −Infinity as silence', () => {
    const flat = (db: number) => Array.from(bandLevels(new Float32Array(512).fill(db), edges, new Float32Array(8)));
    flat(-82).forEach((v) => expect(v).toBeCloseTo(0, 5));
    flat(-56).forEach((v) => expect(v).toBeCloseTo(0.5, 5));
    flat(-30).forEach((v) => expect(v).toBeCloseTo(1, 5));
    flat(Number.NEGATIVE_INFINITY).forEach((v) => expect(v).toBe(0));
  });

  it('averages power, so one loud bin is not lost among quiet ones', () => {
    const spectrum = new Float32Array(512).fill(-100);
    const top = edges[7];
    spectrum[top + 3] = -30;
    const out = bandLevels(spectrum, edges, new Float32Array(8));
    // Averaging decibels over this band would give about −99 dB, which is 0.
    expect(out[7]).toBeGreaterThan(0.4);
  });
});
