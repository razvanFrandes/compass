import { cornerOf, pickLabels, placeLabels, zoomRange } from './quadrant';
import { vsCompSet, vsCompSetWords } from './scatter-words';

describe('quadrant scatter: axis range', () => {
  it('zooms to the data, keeps 100 in view and ends on whole steps', () => {
    // The portfolio's last 30 nights: ARI 93–110.3, MPI 88.4–105.1. The old chart drew 80–120 on both.
    expect(zoomRange([93, 99.5, 104.4, 110.3], 100)).toEqual({ min: 90, max: 115, interval: 5 });
    expect(zoomRange([88.4, 97.5, 105.1], 100)).toEqual({ min: 85, max: 110, interval: 5 });
  });

  it('never leaves 100 at an edge, even when every point is on one side', () => {
    const r = zoomRange([104, 108, 112], 100);
    expect(r.min).toBeLessThan(100);
    expect((100 - r.min) / (r.max - 100)).toBeGreaterThanOrEqual(0.4);
  });

  it('copes with a single point on the reference', () => {
    const r = zoomRange([100], 100);
    expect(r.min).toBeLessThan(100);
    expect(r.max).toBeGreaterThan(100);
  });
});

describe('quadrant scatter: corners and words', () => {
  it('puts a point in its corner; on the line counts as up and right', () => {
    expect(cornerOf(104, 103, 100, 100)).toBe('tr');
    expect(cornerOf(96, 103, 100, 100)).toBe('tl');
    expect(cornerOf(104, 97, 100, 100)).toBe('br');
    expect(cornerOf(96, 97, 100, 100)).toBe('bl');
    expect(cornerOf(100, 100, 100, 100)).toBe('tr');
  });

  it('reads an index against the comp set', () => {
    expect(vsCompSet(100)).toBe('Comp set');
    expect(vsCompSet(110)).toBe('+10%');
    expect(vsCompSet(92.6)).toBe('−7.4%');
    expect(vsCompSetWords(104.2, 'more than comp set', 'less than comp set')).toBe('4.2% more than comp set');
    expect(vsCompSetWords(88, 'more', 'fewer than fair share')).toBe('12% fewer than fair share');
  });
});

describe('quadrant scatter: which points are named', () => {
  const pts = [
    { name: 'Lisbon', x: 101, y: 99 },
    { name: 'New York', aliases: ['Arbor New York Midtown'], x: 93.5, y: 98.7 },
    { name: 'Barcelona', x: 104.4, y: 104.6 },
    { name: 'Paris', x: 109.3, y: 88.4 },
    { name: 'Berlin', x: 100.2, y: 101 },
    { name: 'Amsterdam', x: 95, y: 97.5 },
  ];
  const o = { xRef: 100, yRef: 100, xSpan: 25, ySpan: 25 };

  it('names the hotel the title talks about first, then the best and the worst, then the far ones', () => {
    const picked = pickLabels(pts, { ...o, text: '5 of 20 hotels win; New York Midtown earns 8% less per room', max: 4 });
    expect(picked.map((i) => pts[i].name)).toEqual(['New York', 'Barcelona', 'Amsterdam', 'Paris']);
  });

  it('never names more than it may', () => {
    expect(pickLabels(pts, { ...o, max: 3 })).toHaveLength(3);
    expect(pickLabels(pts.slice(0, 2), { ...o, max: 5 })).toHaveLength(2);
  });

  it('matches a full name in the title', () => {
    expect(pickLabels(pts, { ...o, text: 'Arbor New York Midtown trails', max: 1 })).toEqual([1]);
  });
});

describe('quadrant scatter: where the names go', () => {
  const box = { x: 0, y: 0, w: 400, h: 300 };
  const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it('puts a name to the right of its dot when there is room', () => {
    const spots = placeLabels([{ x: 100, y: 100 }], [{ index: 0, width: 60 }], box);
    expect(spots.get(0)).toMatchObject({ align: 'left', leader: false });
  });

  it('moves to the left at the right edge', () => {
    const spots = placeLabels([{ x: 390, y: 100 }], [{ index: 0, width: 60 }], box);
    expect(spots.get(0)).toMatchObject({ align: 'right' });
  });

  it('keeps names off each other, off other dots and off the corner captions', () => {
    // A tight cluster, every one named.
    const dots = [
      { x: 200, y: 150 },
      { x: 212, y: 152 },
      { x: 205, y: 140 },
      { x: 195, y: 160 },
    ];
    const caption = { x: 300, y: 4, w: 96, h: 15 };
    const spots = placeLabels(dots, dots.map((_, i) => ({ index: i, width: 70 })), box, { avoid: [caption], radius: 6 });
    const boxes = [...spots.values()].map((s) => s.box);
    expect(boxes).toHaveLength(4);
    for (let i = 0; i < boxes.length; i++) {
      expect(hit(boxes[i], caption)).toBe(false);
      for (let j = i + 1; j < boxes.length; j++) expect(hit(boxes[i], boxes[j])).toBe(false);
      dots.forEach((d, k) => {
        if ([...spots.keys()][i] !== k) expect(hit(boxes[i], { x: d.x - 6, y: d.y - 6, w: 12, h: 12 })).toBe(false);
      });
    }
  });
});
