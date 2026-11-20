import { clampPosition, positionFromPointer, readSplit, splitKey, splitRange, writeSplit } from './split-pane-logic';

const limits = { minStart: 380, minEnd: 320 };

describe('splitRange', () => {
  it('turns the minimum widths into the range of the divider', () => {
    expect(splitRange(1000, limits)).toEqual({ min: 38, max: 68 });
  });

  it('allows a wide range before the container is measured', () => {
    expect(splitRange(0, limits)).toEqual({ min: 10, max: 90 });
  });

  it('pins the divider when both minimums cannot fit', () => {
    expect(splitRange(600, limits)).toEqual({ min: 63.3, max: 63.3 });
  });
});

describe('clampPosition and positionFromPointer', () => {
  const range = splitRange(1000, limits);

  it('keeps the divider inside the range', () => {
    expect(clampPosition(20, range)).toBe(38);
    expect(clampPosition(95, range)).toBe(68);
    expect(clampPosition(55.55, range)).toBe(55.6);
    expect(clampPosition(Number.NaN, range)).toBe(38);
  });

  it('follows the pointer inside the container, and stops at the limits', () => {
    const box = { left: 232, width: 1000 };
    expect(positionFromPointer(232 + 500, box, range)).toBe(50);
    expect(positionFromPointer(0, box, range)).toBe(38);
    expect(positionFromPointer(5000, box, range)).toBe(68);
  });
});

describe('splitKey', () => {
  const range = { min: 38, max: 68 };

  it('moves by a step with the arrows, and by a big step with Shift', () => {
    expect(splitKey('ArrowLeft', 56, range)).toEqual({ type: 'move', position: 54 });
    expect(splitKey('ArrowRight', 56, range)).toEqual({ type: 'move', position: 58 });
    expect(splitKey('ArrowLeft', 56, range, { shift: true })).toEqual({ type: 'move', position: 46 });
  });

  it('stops at the limits', () => {
    expect(splitKey('ArrowLeft', 39, range)).toEqual({ type: 'move', position: 38 });
    expect(splitKey('ArrowRight', 67.5, range)).toEqual({ type: 'move', position: 68 });
  });

  it('goes to the limits with Home and End', () => {
    expect(splitKey('Home', 56, range)).toEqual({ type: 'move', position: 38 });
    expect(splitKey('End', 56, range)).toEqual({ type: 'move', position: 68 });
  });

  it('collapses or restores with Enter, and ignores other keys', () => {
    expect(splitKey('Enter', 56, range)).toEqual({ type: 'toggle' });
    expect(splitKey('a', 56, range)).toBeNull();
    expect(splitKey('ArrowUp', 56, range)).toBeNull();
  });
});

describe('remembering the split', () => {
  function memory(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return { data, getItem: (key: string) => data[key] ?? null, setItem: (key: string, value: string) => void (data[key] = value) };
  }

  it('round-trips a position and the collapse', () => {
    const storage = memory();
    writeSplit('k', { position: 44, collapsed: true }, storage);
    expect(readSplit('k', storage)).toEqual({ position: 44, collapsed: true });
  });

  it('remembers a reset as a reset', () => {
    const storage = memory();
    writeSplit('k', { position: null, collapsed: false }, storage);
    expect(readSplit('k', storage)).toEqual({ position: null, collapsed: false });
  });

  it('ignores what it cannot read', () => {
    expect(readSplit('k', memory({ k: 'not json' }))).toBeNull();
    expect(readSplit('k', memory({ k: '"text"' }))).toBeNull();
    expect(readSplit('k', memory({ k: '{"position":900,"collapsed":"yes"}' }))).toEqual({ position: null, collapsed: false });
    expect(readSplit('k', memory())).toBeNull();
    expect(readSplit(null, memory({ k: '{}' }))).toBeNull();
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(readSplit('k', broken)).toBeNull();
    expect(() => writeSplit('k', { position: 50, collapsed: false }, broken)).not.toThrow();
  });
});
