import { icosphere } from './icosphere';
import {
  ORB_BANDS,
  ORB_SH,
  ORB_STATES,
  OrbMotion,
  type OrbFeatures,
  PARAM_KEYS,
  clamp01,
  damp,
  lerp,
  mixParams,
  perFrame,
  resampleBands,
  shCoefficients,
  simulatedVoice,
  smoothstep,
  speechPulse,
  splitBands,
  stateParams,
  stepWeights,
  synthBands,
  weightsFor,
} from './orb-motion';

const quiet: OrbFeatures = { level: 0, bass: 0, mid: 0, high: 0 };
const loud: OrbFeatures = { level: 1, bass: 1, mid: 1, high: 1 };

describe('easing', () => {
  it('clamps and interpolates', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(1.7)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
    expect(lerp(2, 6, 0.25)).toBe(3);
  });

  it('smoothstep is 0 below, 1 above, half-way in the middle, and flat at both ends', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(2, 4, 3)).toBeCloseTo(0.5, 10);
    expect(smoothstep(0, 1, 0.01)).toBeLessThan(0.001);
    expect(smoothstep(1, 1, 0.5)).toBe(0); // equal edges do not divide by zero
    expect(smoothstep(1, 1, 1.5)).toBe(1);
  });

  it('damp covers 63% of the distance in one time constant', () => {
    expect(damp(0, 1, 0.3, 0.3)).toBeCloseTo(1 - Math.exp(-1), 10);
  });

  it('damp gives the same result in one step or in many (frame-rate independent)', () => {
    let v = 0;
    for (let i = 0; i < 120; i++) v = damp(v, 1, 0.25, 1 / 120);
    expect(v).toBeCloseTo(damp(0, 1, 0.25, 1), 10);
  });

  it('damp holds still with no time and jumps with no time constant', () => {
    expect(damp(0.2, 1, 0.3, 0)).toBe(0.2);
    expect(damp(0.2, 1, 0, 0.016)).toBe(1);
  });

  it('perFrame converts a 60 fps factor to the real frame time', () => {
    expect(perFrame(0.95, 1 / 60)).toBeCloseTo(0.95, 12);
    // Two 120 Hz frames fade as much as one 60 Hz frame.
    expect(perFrame(0.95, 1 / 120) ** 2).toBeCloseTo(0.95, 12);
  });
});

describe('bands', () => {
  it('splits eight bands into bass (2), mids (3) and highs (3)', () => {
    const s = splitBands([1, 1, 0.5, 0.5, 0.5, 0.2, 0.2, 0.2]);
    expect(s.bass).toBeCloseTo(1);
    expect(s.mid).toBeCloseTo(0.5);
    expect(s.high).toBeCloseTo(0.2);
  });

  it('copes with empty, tiny and out-of-range input', () => {
    expect(splitBands([])).toEqual({ bass: 0, mid: 0, high: 0 });
    const one = splitBands([0.7]);
    expect(one.bass).toBeCloseTo(0.7);
    expect(one.high).toBeCloseTo(0.7);
    expect(splitBands([4, 4, 4, 4]).bass).toBe(1);
  });

  it('resamples by averaging down and repeating up', () => {
    const down = resampleBands(Float32Array.from({ length: 16 }, (_, i) => (i < 8 ? 0 : 1)), new Float32Array(ORB_BANDS));
    expect(Array.from(down)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
    const up = resampleBands([0.25, 0.75], new Float32Array(ORB_BANDS));
    expect(Array.from(up)).toEqual([0.25, 0.25, 0.25, 0.25, 0.75, 0.75, 0.75, 0.75]);
    expect(Array.from(resampleBands([], new Float32Array(3).fill(9)))).toEqual([0, 0, 0]);
  });

  it('synthetic bands are silent at level 0 and stay within 0..1', () => {
    expect(Array.from(synthBands(0, 3.3, new Float32Array(ORB_BANDS))).every((v) => v === 0)).toBe(true);
    for (let t = 0; t < 10; t += 0.37) {
      for (const v of synthBands(1, t, new Float32Array(ORB_BANDS))) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the speech rhythm and the simulated voice stay within 0..1 and are not constant', () => {
    const bands = new Float32Array(ORB_BANDS);
    let min = 1;
    let max = 0;
    for (let t = 0; t < 12; t += 0.013) {
      const p = speechPulse(t);
      const level = simulatedVoice(t, bands);
      for (const v of [p, level, ...bands]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      min = Math.min(min, p);
      max = Math.max(max, p);
    }
    expect(min).toBeLessThan(0.05); // it pauses
    expect(max).toBeGreaterThan(0.8); // and it peaks
  });
});

describe('state parameters', () => {
  it('every state defines every parameter with a finite value', () => {
    for (const s of ORB_STATES) {
      for (const f of [quiet, loud]) {
        const p = stateParams(s, f, 4.2);
        for (const k of PARAM_KEYS) expect(Number.isFinite(p[k]), `${s}.${k}`).toBe(true);
      }
    }
  });

  it('listening follows the voice: bass bulges, mids ripple, highs sparkle, level throws the trails further', () => {
    const base = stateParams('listening', quiet, 1);
    const bass = stateParams('listening', { ...quiet, bass: 1 }, 1);
    const mid = stateParams('listening', { ...quiet, mid: 1 }, 1);
    const high = stateParams('listening', { ...quiet, high: 1 }, 1);
    const level = stateParams('listening', { ...quiet, level: 1 }, 1);
    expect(bass.amp).toBeGreaterThan(base.amp);
    expect(bass.wobble).toBeGreaterThan(base.wobble * 2);
    expect(bass.ripple).toBe(base.ripple);
    expect(mid.ripple).toBeGreaterThan(base.ripple * 3);
    expect(mid.trailWarp).toBeGreaterThan(base.trailWarp);
    expect(high.sparkle).toBe(1);
    expect(base.sparkle).toBe(0);
    expect(high.rim).toBeGreaterThan(base.rim);
    expect(level.trailZoom).toBeGreaterThan(base.trailZoom * 3);
    expect(level.scale).toBeGreaterThan(base.scale);
    expect(level.ring).toBeGreaterThan(base.ring);
  });

  it('idle barely reacts, thinking does not react at all', () => {
    const idleQuiet = stateParams('idle', quiet, 2);
    const idleLoud = stateParams('idle', loud, 2);
    const listenLoud = stateParams('listening', loud, 2);
    const listenQuiet = stateParams('listening', quiet, 2);
    expect(idleLoud.amp - idleQuiet.amp).toBeLessThan((listenLoud.amp - listenQuiet.amp) / 2);
    expect(stateParams('thinking', loud, 2)).toEqual(stateParams('thinking', quiet, 2));
  });

  it('thinking is the state that twists and turns', () => {
    const thinking = stateParams('thinking', quiet, 0);
    for (const s of ORB_STATES.filter((x) => x !== 'thinking')) {
      const other = stateParams(s, quiet, 0);
      expect(thinking.twist).toBeGreaterThan(Math.abs(other.twist) * 3);
      expect(thinking.spin).toBeGreaterThan(other.spin * 2);
      expect(thinking.trailSpin).toBeGreaterThan(other.trailSpin * 2);
    }
  });

  it('speaking pulses on its own, and follows a level when one is given', () => {
    const pulses = Array.from({ length: 200 }, (_, i) => stateParams('speaking', quiet, i * 0.03).pulse);
    expect(Math.max(...pulses) - Math.min(...pulses)).toBeGreaterThan(0.015);
    expect(stateParams('speaking', { ...quiet, level: 1 }, 0).pulse).toBeGreaterThanOrEqual(Math.max(...pulses));
    expect(stateParams('idle', loud, 0).pulse).toBe(0);
  });

  it('even at its loudest the surface cannot turn inside out or leave its canvas', () => {
    const ORB_FILL = 0.54; // share of the half-canvas the resting orb fills (orb-renderer.ts)
    for (const s of ORB_STATES) {
      for (let t = 0; t < 8; t += 0.5) {
        const p = stateParams(s, loud, t);
        // Worst case, everything peaking at one point: noise ≤ amp, harmonics ≤ about 3 × wobble,
        // plus ripples, rings and swirl ridges.
        const worst = p.amp + 3 * p.wobble + p.ripple + p.pulse + 0.034 * Math.abs(p.twist);
        expect(worst, s).toBeLessThan(1); // radius 1 − worst stays positive
        expect(ORB_FILL * p.scale * (1 + worst), s).toBeLessThan(1);
      }
    }
  });

  it('trails always fade and always move outwards', () => {
    for (const s of ORB_STATES) {
      for (const f of [quiet, loud]) {
        const p = stateParams(s, f, 1);
        expect(p.trailDecay).toBeGreaterThan(0.9);
        expect(p.trailDecay).toBeLessThan(0.97);
        expect(p.trailZoom).toBeGreaterThan(0);
      }
    }
  });
});

describe('state transitions', () => {
  it('starts on one state', () => {
    expect(weightsFor('thinking')).toEqual({ idle: 0, listening: 0, thinking: 1, speaking: 0 });
  });

  it('cross-fades: weights always sum to 1 and move towards the new state', () => {
    let w = weightsFor('idle');
    let previous = 0;
    for (let i = 0; i < 60; i++) {
      w = stepWeights(w, 'listening', 1 / 60);
      expect(w.idle + w.listening + w.thinking + w.speaking).toBeCloseTo(1, 10);
      expect(w.listening).toBeGreaterThan(previous);
      previous = w.listening;
    }
    expect(w.listening).toBeGreaterThan(0.9); // settled within a second
    expect(w.idle).toBeLessThan(0.1);
  });

  it('a change mid-transition carries on from where it was, with no jump', () => {
    let w = weightsFor('idle');
    for (let i = 0; i < 10; i++) w = stepWeights(w, 'listening', 1 / 60);
    const before = mixParams(w, quiet, 1);
    const after = mixParams(stepWeights(w, 'thinking', 1 / 60), quiet, 1 + 1 / 60);
    for (const k of PARAM_KEYS) expect(Math.abs(after[k] - before[k]), k).toBeLessThan(0.08);
  });

  it('a settled mix equals the state itself, and a half-way mix sits between the two', () => {
    expect(mixParams(weightsFor('speaking'), loud, 3)).toEqual(stateParams('speaking', loud, 3));
    const half = mixParams({ idle: 0.5, listening: 0, thinking: 0.5, speaking: 0 }, quiet, 0);
    const idle = stateParams('idle', quiet, 0);
    const thinking = stateParams('thinking', quiet, 0);
    expect(half.spin).toBeCloseTo((idle.spin + thinking.spin) / 2, 10);
    expect(half.twist).toBeCloseTo((idle.twist + thinking.twist) / 2, 10);
  });
});

describe('spherical-harmonic wobble', () => {
  it('scales with the amplitude, weights degree 3 below degree 2, and is zero at amplitude 0', () => {
    const out = new Float32Array(ORB_SH);
    expect(Array.from(shCoefficients(1.3, 0, out)).every((v) => v === 0)).toBe(true);
    const a = Array.from(shCoefficients(1.3, 0.1, new Float32Array(ORB_SH)));
    const b = Array.from(shCoefficients(1.3, 0.2, new Float32Array(ORB_SH)));
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v * 2, 6));
    for (let phase = 0; phase < 20; phase += 0.7) {
      shCoefficients(phase, 0.1, out).forEach((v, i) => expect(Math.abs(v)).toBeLessThanOrEqual((i < 5 ? 0.1 : 0.045) + 1e-6));
    }
  });
});

describe('OrbMotion', () => {
  it('produces finite frames and advances time', () => {
    const m = new OrbMotion('idle', 0);
    const f = m.step(1 / 60, { state: 'idle', level: 0, bands: null });
    expect(f.time).toBeCloseTo(1 / 60, 10);
    for (const k of PARAM_KEYS) expect(Number.isFinite(f.params[k])).toBe(true);
    expect(f.bands).toHaveLength(ORB_BANDS);
    expect(f.sh).toHaveLength(ORB_SH);
    expect(f.decay).toBeGreaterThan(0.9);
    expect(f.decay).toBeLessThan(1);
    expect(f.zoom).toBeGreaterThan(1);
    expect(f.frames).toBeCloseTo(1, 10);
  });

  it('a state change is eased, not snapped', () => {
    const m = new OrbMotion('idle', 0);
    const idleSpin = m.step(1 / 60, { state: 'idle', level: 0, bands: null }).params.spin;
    const first = m.step(1 / 60, { state: 'thinking', level: 0, bands: null }).params.spin;
    expect(first).toBeGreaterThan(idleSpin);
    expect(first).toBeLessThan(idleSpin + 0.1);
    let last = first;
    for (let i = 0; i < 180; i++) last = m.step(1 / 60, { state: 'thinking', level: 0, bands: null }).params.spin;
    expect(last).toBeCloseTo(stateParams('thinking', quiet, 0).spin, 2);
  });

  it('louder voice moves the surface faster, without time ever running backwards', () => {
    const run = (level: number) => {
      const m = new OrbMotion('listening', 0);
      let f = m.step(1 / 60, { state: 'listening', level, bands: null });
      const start = f.flowT;
      let previous = start;
      for (let i = 0; i < 120; i++) {
        f = m.step(1 / 60, { state: 'listening', level, bands: null });
        expect(f.flowT).toBeGreaterThan(previous);
        previous = f.flowT;
      }
      return f.flowT - start;
    };
    expect(run(0.9)).toBeGreaterThan(run(0) * 2);
  });

  it('uses the bands it is given, at any length, and ignores bad levels', () => {
    const m = new OrbMotion('listening', 0);
    const bands = new Float32Array(32).fill(0);
    bands.fill(1, 0, 8); // bass only
    let f = m.step(1 / 60, { state: 'listening', level: Number.NaN, bands });
    for (let i = 0; i < 60; i++) f = m.step(1 / 60, { state: 'listening', level: 7, bands });
    expect(f.features.bass).toBeGreaterThan(0.9);
    expect(f.features.high).toBeLessThan(0.05);
    expect(f.features.level).toBeLessThanOrEqual(1);
    expect(f.features.level).toBeGreaterThan(0.9);
  });

  it('a long frame fades the trails as much as the short frames it replaces', () => {
    const a = new OrbMotion('idle', 0).step(1 / 30, { state: 'idle', level: 0, bands: null });
    const m = new OrbMotion('idle', 0);
    const b1 = m.step(1 / 60, { state: 'idle', level: 0, bands: null }).decay;
    const b2 = m.step(1 / 60, { state: 'idle', level: 0, bands: null }).decay;
    expect(a.decay).toBeCloseTo(b1 * b2, 3);
  });
});

describe('icosphere', () => {
  it('has 10·4^n + 2 vertices and 20·4^n triangles', () => {
    for (const [detail, verts, tris] of [
      [0, 12, 20],
      [2, 162, 320],
      [4, 2562, 5120],
    ]) {
      const mesh = icosphere(detail);
      expect(mesh.positions.length / 3).toBe(verts);
      expect(mesh.indices.length / 3).toBe(tris);
    }
  });

  it('every vertex is on the unit sphere and every triangle faces outwards', () => {
    const { positions: p, indices } = icosphere(3);
    for (let i = 0; i < p.length; i += 3) expect(Math.hypot(p[i], p[i + 1], p[i + 2])).toBeCloseTo(1, 5);
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3];
      const ab = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
      const ac = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
      const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      // Counter-clockwise seen from outside: the normal points the same way as the vertex.
      expect(n[0] * p[a] + n[1] * p[a + 1] + n[2] * p[a + 2]).toBeGreaterThan(0);
    }
  });

  it('shares vertices between neighbouring triangles (no cracks when displaced)', () => {
    const { positions: p } = icosphere(2);
    const seen = new Set<string>();
    for (let i = 0; i < p.length; i += 3) seen.add(`${p[i].toFixed(5)},${p[i + 1].toFixed(5)},${p[i + 2].toFixed(5)}`);
    expect(seen.size).toBe(p.length / 3);
  });
});
