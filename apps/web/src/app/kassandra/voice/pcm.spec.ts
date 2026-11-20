import { decimation, loudness, smooth, toPcm16 } from './pcm';

describe('pcm', () => {
  it('thins 48 kHz and 96 kHz down to 16 kHz and leaves other rates alone', () => {
    expect(decimation(48_000)).toBe(3);
    expect(decimation(96_000)).toBe(6);
    expect(decimation(16_000)).toBe(1);
    expect(decimation(44_100)).toBe(1);
  });

  it('writes 16-bit little-endian samples, clipped to the range', () => {
    const view = new DataView(toPcm16(new Float32Array([0, 1, -1, 2, 0.5])));
    expect([0, 1, 2, 3, 4].map((i) => view.getInt16(i * 2, true))).toEqual([0, 32767, -32768, 32767, 16384]);
  });

  it('averages groups of samples when thinning and drops an incomplete last group', () => {
    const view = new DataView(toPcm16(new Float32Array([0.5, 0.5, 0.5, -1, -1, -1, 0.9]), 3));
    expect(view.byteLength).toBe(4);
    expect(view.getInt16(0, true)).toBe(16384);
    expect(view.getInt16(2, true)).toBe(-32768);
  });

  it('reads silence as 0 and a loud voice as 1', () => {
    expect(loudness(new Float32Array(512))).toBe(0);
    expect(loudness(new Float32Array(512).fill(0.5))).toBe(1);
    const quiet = loudness(new Float32Array(512).fill(0.01));
    expect(quiet).toBeGreaterThan(0.2);
    expect(quiet).toBeLessThan(0.5);
  });

  it('rises faster than it falls', () => {
    const up = smooth(0, 1, 0.016);
    const down = 1 - smooth(1, 0, 0.016);
    expect(up).toBeGreaterThan(down * 3);
  });
});
