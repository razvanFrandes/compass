import { niceStep } from './steps';

/*
  The pure parts of the quadrant scatter: where the axes end, which corner a point is in, which points get a
  name on the chart, and where each name goes so it touches no dot, no other name, no corner caption and no edge.
  Kept apart from ECharts so they can be tested with plain numbers.
*/

export type Corner = 'tr' | 'tl' | 'br' | 'bl';

/** The corner of a point around the reference (100 for an index, the median otherwise). On the line counts as up / right. */
export function cornerOf(x: number, y: number, xRef: number, yRef: number): Corner {
  return `${y >= yRef ? 't' : 'b'}${x >= xRef ? 'r' : 'l'}` as Corner;
}

export interface AxisRange {
  min: number;
  max: number;
  interval: number;
}

/**
 * An axis zoomed to the data: the points fill the plot, the reference stays in view, and it never sits right at an
 * edge (each side gets at least 40% of the other's room, so the quadrants keep their shape). Ends on whole steps.
 * `pad` is the share of the span added on each side.
 */
export function zoomRange(values: readonly number[], ref: number, pad = 0.12): AxisRange {
  const lo0 = Math.min(ref, ...values);
  const hi0 = Math.max(ref, ...values);
  const span = hi0 - lo0 || Math.abs(ref) * 0.1 || 1;
  let below = ref - lo0 + span * pad;
  let above = hi0 - ref + span * pad;
  below = Math.max(below, above * 0.4);
  above = Math.max(above, below * 0.4);
  const interval = niceStep((below + above) / 5);
  return { min: Math.floor((ref - below) / interval) * interval, max: Math.ceil((ref + above) / interval) * interval, interval };
}

export interface NamedPoint {
  /** What the chart shows on the mark (a hotel's short name). */
  name: string;
  /** Other spellings the title may use (the full name, the code). */
  aliases?: readonly string[];
  x: number;
  y: number;
}

/**
 * The points that get their name on the chart: the ones the title or subtitle names first, then the extremes
 * (best and worst on both axes together, then the farthest from the reference), up to `max`. The rest are named on
 * hover and focus. Returns indices into `pts`, in the order they were picked.
 */
export function pickLabels(pts: readonly NamedPoint[], o: { text?: string; max: number; xRef: number; yRef: number; xSpan: number; ySpan: number }): number[] {
  const out: number[] = [];
  const add = (i: number) => {
    if (i >= 0 && out.length < o.max && !out.includes(i)) out.push(i);
  };
  const text = (o.text ?? '').toLowerCase();
  if (text) {
    // Longest names first, so "Dubai Business Bay" wins over "Dubai".
    const mentioned = pts
      .map((p, i) => ({ i, hit: [p.name, ...(p.aliases ?? [])].filter((s) => s && s.length > 2).sort((a, b) => b.length - a.length).find((s) => text.includes(s.toLowerCase())) }))
      .filter((m) => m.hit)
      .sort((a, b) => text.indexOf(a.hit!.toLowerCase()) - text.indexOf(b.hit!.toLowerCase()));
    for (const m of mentioned) add(m.i);
  }
  const nx = (p: NamedPoint) => (p.x - o.xRef) / (o.xSpan || 1);
  const ny = (p: NamedPoint) => (p.y - o.yRef) / (o.ySpan || 1);
  const by = (score: (p: NamedPoint) => number) => pts.reduce((best, p, i) => (out.includes(i) ? best : best < 0 || score(p) > score(pts[best]) ? i : best), -1);
  add(by((p) => nx(p) + ny(p))); // best on both
  add(by((p) => -(nx(p) + ny(p)))); // worst on both
  // Then the far ones, farthest first.
  const far = pts.map((p, i) => ({ i, d: Math.hypot(nx(p), ny(p)) })).sort((a, b) => b.d - a.d);
  for (const f of far) add(f.i);
  return out;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelSpot {
  /** Offset of the label's anchor from the centre of its dot, in px. */
  dx: number;
  dy: number;
  align: 'left' | 'right' | 'center';
  verticalAlign: 'top' | 'middle' | 'bottom';
  /** Drawn away from its dot: a leader line joins them. */
  leader: boolean;
  /** The box the label takes, in plot px (for tests). */
  box: Rect;
}

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Places each name next to its dot where it collides with nothing: right, left, above, below, the four diagonals,
 * then farther out with a leader line. Greedy, in the order given (the most important first), so a name the title
 * talks about gets the best spot. `dots` are the centres of every point in px; `avoid` are boxes to keep clear
 * (corner captions); `box` is the plot.
 */
export function placeLabels(
  dots: readonly { x: number; y: number }[],
  labelled: readonly { index: number; width: number }[],
  box: Rect,
  o: { height?: number; radius?: number; avoid?: readonly Rect[] } = {},
): Map<number, LabelSpot> {
  const h = o.height ?? 14;
  const r = o.radius ?? 5;
  const gap = 4;
  const dotBoxes: Rect[] = dots.map((d) => ({ x: d.x - r, y: d.y - r, w: 2 * r, h: 2 * r }));
  const placed: Rect[] = [...(o.avoid ?? [])];
  const out = new Map<number, LabelSpot>();
  for (const { index, width: w } of labelled) {
    const d = dots[index];
    if (!d) continue;
    const near = r + gap;
    const candidates: Omit<LabelSpot, 'box'>[] = [];
    for (const k of [1, 2.6, 4.2]) {
      const leader = k > 1;
      const n = near * k;
      const diag = n * 0.75;
      candidates.push(
        { dx: n, dy: 0, align: 'left', verticalAlign: 'middle', leader },
        { dx: -n, dy: 0, align: 'right', verticalAlign: 'middle', leader },
        { dx: 0, dy: -n, align: 'center', verticalAlign: 'bottom', leader },
        { dx: 0, dy: n, align: 'center', verticalAlign: 'top', leader },
        { dx: diag, dy: -diag, align: 'left', verticalAlign: 'bottom', leader },
        { dx: -diag, dy: -diag, align: 'right', verticalAlign: 'bottom', leader },
        { dx: diag, dy: diag, align: 'left', verticalAlign: 'top', leader },
        { dx: -diag, dy: diag, align: 'right', verticalAlign: 'top', leader },
      );
    }
    let best: LabelSpot | null = null;
    let bestScore = Infinity;
    candidates.forEach((c, order) => {
      const left = c.align === 'left' ? d.x + c.dx : c.align === 'right' ? d.x + c.dx - w : d.x + c.dx - w / 2;
      const top = c.verticalAlign === 'top' ? d.y + c.dy : c.verticalAlign === 'bottom' ? d.y + c.dy - h : d.y + c.dy - h / 2;
      const rect = { x: left, y: top, w, h };
      const outside = w * h - overlap(rect, box);
      const hits = placed.reduce((s, p) => s + overlap(rect, p), 0) + dotBoxes.reduce((s, p, i) => s + (i === index ? 0 : overlap(rect, p)), 0);
      // Any collision costs more than going farther out; among clean spots the nearest, in the order above, wins.
      const score = (outside + hits) * 1000 + order;
      if (score < bestScore) {
        bestScore = score;
        best = { ...c, box: rect };
      }
    });
    if (best) {
      out.set(index, best);
      placed.push((best as LabelSpot).box);
    }
  }
  return out;
}
