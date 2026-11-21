import { GOLDEN_ANGLE, LATTICE_DIST, latticePoint, pointCount, silhouetteRadius } from './lattice';
import {
  ORB_BANDS,
  ORB_STATES,
  OrbMotion,
  type OrbFeatures,
  PARAM_KEYS,
  clamp01,
  damp,
  lerp,
  mixParams,
  resampleBands,
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

  it('listening hands the sphere to the voice: bands lift far, bass swells, highs twinkle, loudness turns it faster', () => {
    const base = stateParams('listening', quiet, 1);
    const idle = stateParams('idle', quiet, 1);
    expect(base.lift).toBeGreaterThan(idle.lift * 3);
    expect(stateParams('listening', { ...quiet, bass: 1 }, 1).scale).toBeGreaterThan(base.scale);
    expect(stateParams('listening', { ...quiet, high: 1 }, 1).sparkle).toBe(1);
    expect(base.sparkle).toBe(0);
    const level = stateParams('listening', { ...quiet, level: 1 }, 1);
    expect(level.spin).toBeGreaterThan(base.spin * 2);
    expect(level.glow).toBeGreaterThan(base.glow);
    expect(level.dot).toBeGreaterThan(base.dot);
  });

  it('thinking does not react to sound, and is the state that spirals and turns', () => {
    expect(stateParams('thinking', loud, 2)).toEqual(stateParams('thinking', quiet, 2));
    const thinking = stateParams('thinking', quiet, 0);
    for (const s of ORB_STATES.filter((x) => x !== 'thinking')) {
      const other = stateParams(s, quiet, 0);
      expect(other.spiral).toBe(0);
      expect(thinking.spin).toBeGreaterThan(other.spin * 3);
      expect(thinking.lift).toBeLessThan(other.lift);
    }
    expect(thinking.spiral).toBeGreaterThan(0);
  });

  it('speaking pulses on its own, and follows a level when one is given', () => {
    const pulses = Array.from({ length: 200 }, (_, i) => stateParams('speaking', quiet, i * 0.03).pulse);
    expect(Math.max(...pulses) - Math.min(...pulses)).toBeGreaterThan(0.03);
    expect(stateParams('speaking', { ...quiet, level: 1 }, 0).pulse).toBeGreaterThanOrEqual(Math.max(...pulses));
    for (const s of ORB_STATES.filter((x) => x !== 'speaking')) expect(stateParams(s, loud, 0).pulse).toBe(0);
  });

  it('idle is the calmest: slowest turn, no sparkle, no rings, no spiral', () => {
    const idle = stateParams('idle', loud, 3);
    for (const s of ORB_STATES.filter((x) => x !== 'idle')) expect(idle.spin).toBeLessThan(stateParams(s, quiet, 3).spin);
    expect(idle.sparkle).toBe(0);
    expect(idle.pulse).toBe(0);
    expect(idle.spiral).toBe(0);
    expect(idle.ripple).toBeGreaterThan(0); // but never frozen
  });

  it('even at its loudest no point can cross the centre or leave the canvas', () => {
    for (const s of ORB_STATES) {
      for (let t = 0; t < 8; t += 0.5) {
        const p = stateParams(s, loud, t);
        // Worst case: every displacement peaking at the same point.
        const push = p.lift + p.ripple + p.pulse + p.spiral;
        expect(push, s).toBeLessThan(1);
        const reach = p.scale * (1 + push);
        expect(reach, s).toBeLessThan(LATTICE_DIST); // stays in front of the camera
        expect(silhouetteRadius(reach), s).toBeLessThan(0.95); // and inside the canvas, with room for the dot
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
    for (const k of PARAM_KEYS) expect(Math.abs(after[k] - before[k]), k).toBeLessThan(0.1);
  });

  it('a settled mix equals the state itself, and a half-way mix sits between the two', () => {
    expect(mixParams(weightsFor('speaking'), loud, 3)).toEqual(stateParams('speaking', loud, 3));
    const half = mixParams({ idle: 0.5, listening: 0, thinking: 0.5, speaking: 0 }, quiet, 0);
    const idle = stateParams('idle', quiet, 0);
    const thinking = stateParams('thinking', quiet, 0);
    expect(half.spin).toBeCloseTo((idle.spin + thinking.spin) / 2, 10);
    expect(half.spiral).toBeCloseTo(thinking.spiral / 2, 10);
  });
});

describe('OrbMotion', () => {
  it('produces finite frames and advances time', () => {
    const m = new OrbMotion('idle', 0);
    const f = m.step(1 / 60, { state: 'idle', level: 0, bands: null });
    expect(f.time).toBeCloseTo(1 / 60, 10);
    for (const k of PARAM_KEYS) expect(Number.isFinite(f.params[k])).toBe(true);
    expect(f.bands).toHaveLength(ORB_BANDS);
    for (const v of [f.spinT, f.waveT, f.pulseT, f.spiralT, f.twinkleT, f.hueT]) expect(Number.isFinite(v)).toBe(true);
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

  it('a louder voice turns the sphere faster, and it never turns backwards', () => {
    const run = (level: number) => {
      const m = new OrbMotion('listening', 0);
      let f = m.step(1 / 60, { state: 'listening', level, bands: null });
      const start = f.spinT;
      let previous = start;
      for (let i = 0; i < 120; i++) {
        f = m.step(1 / 60, { state: 'listening', level, bands: null });
        expect(f.spinT).toBeGreaterThan(previous);
        previous = f.spinT;
      }
      return f.spinT - start;
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

  it('moves the same distance in one long frame as in the short frames it replaces', () => {
    const input = { state: 'thinking', level: 0, bands: null } as const;
    const a = new OrbMotion('thinking', 0).step(1 / 30, input);
    const m = new OrbMotion('thinking', 0);
    m.step(1 / 60, input);
    const b = m.step(1 / 60, input);
    expect(a.spinT).toBeCloseTo(b.spinT, 3);
    expect(a.waveT).toBeCloseTo(b.waveT, 3);
  });
});

describe('lattice', () => {
  it('every point is on the unit sphere', () => {
    for (const n of [1100, 2600]) {
      for (let i = 0; i < n; i += 37) {
        const [x, y, z] = latticePoint(i, n);
        expect(Math.hypot(x, y, z)).toBeCloseTo(1, 10);
      }
    }
  });

  it('heights run evenly from just under the top to just above the bottom', () => {
    const n = 100;
    expect(latticePoint(0, n)[1]).toBeCloseTo(0.99, 10);
    expect(latticePoint(n - 1, n)[1]).toBeCloseTo(-0.99, 10);
    expect(latticePoint(10, n)[1] - latticePoint(11, n)[1]).toBeCloseTo(2 / n, 10);
  });

  it('each point is a golden angle further round than the one before', () => {
    expect(GOLDEN_ANGLE).toBeCloseTo(2.39996323, 7); // the constant written into the vertex shader
    const [x, , z] = latticePoint(1, 1000);
    expect(Math.atan2(z, x)).toBeCloseTo(GOLDEN_ANGLE, 10);
  });

  it('spreads points evenly: no two neighbours crowd, no hemisphere is favoured', () => {
    const n = 600;
    const pts = Array.from({ length: n }, (_, i) => latticePoint(i, n));
    // On a unit sphere each of n points owns an area of 4π/n: a typical spacing of about sqrt(4π/n).
    const spacing = Math.sqrt((4 * Math.PI) / n);
    let closest = Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        closest = Math.min(closest, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]));
      }
    }
    expect(closest).toBeGreaterThan(spacing * 0.5);
    for (const axis of [0, 1, 2]) {
      const positive = pts.filter((p) => p[axis] > 0).length;
      expect(Math.abs(positive - n / 2)).toBeLessThan(n * 0.03);
    }
  });

  it('frames the resting sphere at a little over half the canvas', () => {
    expect(silhouetteRadius(1)).toBeGreaterThan(0.5);
    expect(silhouetteRadius(1)).toBeLessThan(0.6);
    expect(silhouetteRadius(1.3)).toBeGreaterThan(silhouetteRadius(1));
  });

  it('uses fewer points on a small orb', () => {
    expect(pointCount(104)).toBeLessThan(pointCount(200));
    expect(pointCount(480)).toBe(pointCount(200));
  });
});
