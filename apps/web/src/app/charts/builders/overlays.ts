import { formatValue, parseDate } from '../format';
import { mix } from '../tokens';
import type { EvidenceColumn } from '../widget-types';
import { type Ctx, type LegendItem, type TipRow, cell, numberAt, pickLabelKey, valueColumn } from './shared';

/*
  What a chart over time can carry besides its series (the spec's `forecast`, `band`, `target` and `limit`), drawn
  the same way on a line and on columns:
  - forecast (P50): dotted, in the series colour, continuing where the actuals stop; a "Today" rule where they do;
  - band (P10–P90): a pale band of the series colour, under everything;
  - target (budget): a thin step line in the reference colour;
  - limit (capacity): one flat labelled rule;
  and, for daily dates, the weekends (Fri, Sat) as a quiet shade.
*/

export interface Overlay {
  series: Record<string, unknown>[];
  legend: LegendItem[];
  /** Tooltip rows for row `i`. */
  tip: (i: number) => TipRow[];
  /** Where the value axis has to reach: the band's top, the limit. */
  values: number[];
  /** Words for the text alternative. */
  spoken: string;
  /** Index of the last row with an actual, when a forecast carries on after it ("Today"). */
  today: number | null;
}

const col = (c: Ctx, key: string | undefined) => (key ? valueColumn(c, key) : null);
const values = (c: Ctx, key: string | undefined) => (key ? c.rows.map((r) => numberAt(r, key)) : []);
const compact = (v: number | null, column: EvidenceColumn) => (v === null ? '–' : formatValue(v, column, { compact: true }));
const full = (v: number | null, column: EvidenceColumn) => (v === null ? '–' : formatValue(v, column));

/** The overlays of a chart on a category axis (one category per row). `step` draws the target as steps (columns). */
export function overlays(c: Ctx, o: { yKey: string | undefined; columns: boolean }): Overlay {
  const s = c.spec;
  const fCol = col(c, s.forecast);
  const [loKey, hiKey] = s.band ?? [];
  const loCol = col(c, loKey);
  const hiCol = col(c, hiKey);
  const tCol = col(c, s.target);
  const lCol = col(c, s.limit);
  const f = values(c, s.forecast);
  const lo = values(c, loKey);
  const hi = values(c, hiKey);
  const t = values(c, s.target);
  const limit = s.limit ? (c.rows.map((r) => numberAt(r, s.limit)).find((v): v is number => v !== null) ?? null) : null;
  const y = values(c, o.yKey);
  // The actuals stop where the forecast carries on: the last row with a value, when rows after it have a forecast only.
  let today: number | null = null;
  if (fCol && y.length) {
    const last = y.map((v, i) => (v !== null ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
    if (last >= 0 && last < y.length - 1 && f.slice(last + 1).some((v) => v !== null)) today = last;
  }
  const series: Record<string, unknown>[] = [];
  const legend: LegendItem[] = [];
  const bandName = loCol && hiCol ? rangeName(loCol.label, hiCol.label) : '';
  if (loCol && hiCol) {
    // A band is two stacked lines: the low edge (invisible) and the gap up to the high edge (filled).
    const common = { type: 'line', stack: '__band', symbol: 'none', silent: true, tooltip: { show: false }, lineStyle: { opacity: 0 }, emphasis: { disabled: true }, z: 0, connectNulls: false, step: o.columns ? 'middle' : undefined };
    series.push({ ...common, name: `${bandName} low`, data: lo });
    series.push({ ...common, name: bandName, data: hi.map((v, i) => (v === null || lo[i] === null ? null : v - (lo[i] as number))), areaStyle: { color: c.t.series, opacity: c.t.mode === 'dark' ? 0.2 : 0.14 } });
    legend.push({ label: bandName, color: c.t.series, mark: 'band' });
  }
  if (fCol) {
    // On a line the projection starts at the last actual, so the two read as one path.
    const data = !o.columns && today !== null ? f.map((v, i) => (i === today ? (y[i] ?? v) : v)) : f;
    series.push({ type: 'line', name: fCol.label, data, symbol: o.columns ? 'circle' : 'none', symbolSize: 4, showSymbol: o.columns, connectNulls: false, z: 3, lineStyle: { color: c.t.series, width: 2, type: [2, 3], cap: 'round' }, itemStyle: { color: c.t.series }, emphasis: { disabled: true } });
    legend.push({ label: fCol.label, color: c.t.series, mark: 'dotted' });
  }
  if (tCol) {
    series.push({ type: 'line', name: tCol.label, data: t, step: o.columns ? 'middle' : undefined, symbol: 'none', z: 2, lineStyle: { color: c.t.ref, width: 1.5 }, itemStyle: { color: c.t.ref }, emphasis: { disabled: true } });
    legend.push({ label: tCol.label, color: c.t.ref, mark: 'rule' });
  }
  const marks: Record<string, unknown>[] = [];
  if (lCol && limit !== null) marks.push({ yAxis: limit, lineStyle: { color: c.t.ref, type: 'solid', width: 1, opacity: 0.8 }, label: { formatter: `${lCol.label} ${compact(limit, lCol)}`, position: 'insideStartTop', color: c.t.muted, fontSize: 11, fontFamily: c.t.font } });
  if (today !== null) marks.push({ xAxis: today, lineStyle: { color: c.t.muted, type: 'dashed', width: 1 }, label: { formatter: 'Today', position: 'end', color: c.t.muted, fontSize: 11, fontFamily: c.t.font } });
  const shade = weekends(c);
  if (marks.length || shade.length) {
    series.push({
      type: 'line',
      name: '__marks',
      data: [],
      silent: true,
      tooltip: { show: false },
      markLine: marks.length ? { silent: true, symbol: 'none', animation: false, data: marks } : undefined,
      markArea: shade.length ? { silent: true, animation: false, itemStyle: { color: mix(c.t.muted, c.t.surface, c.t.mode === 'dark' ? 0.12 : 0.08) }, data: shade } : undefined,
    });
  }
  if (shade.length) legend.push({ label: 'Weekends (Fri, Sat)', color: mix(c.t.muted, c.t.surface, 0.3), mark: 'solid' });
  const tip = (i: number): TipRow[] => [
    ...(fCol ? [{ label: fCol.label, value: full(f[i], fCol), color: c.t.series, dashed: true }] : []),
    ...(loCol && hiCol && lo[i] !== null && hi[i] !== null ? [{ label: bandName, value: `${compact(lo[i], loCol)}–${compact(hi[i], hiCol)}`, muted: true }] : []),
    ...(tCol ? [{ label: tCol.label, value: full(t[i], tCol), color: c.t.ref }] : []),
  ];
  const spoken = [
    fCol && today !== null ? `${fCol.label} from ${compact(y[today], fCol)} today to ${compact(f[f.length - 1], fCol)}${loCol && hiCol ? ` (${compact(lo[lo.length - 1], loCol)}–${compact(hi[hi.length - 1], hiCol)})` : ''}.` : '',
    lCol && limit !== null ? `${lCol.label} ${full(limit, lCol)}.` : '',
    tCol ? `${tCol.label} shown as a line.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const reach = [...hi, ...f, ...t, limit].filter((v): v is number => v !== null);
  return { series, legend, tip, values: reach, spoken, today };
}

/** "P10–P90" from "P10" and "P90"; "Low–High" otherwise. */
export function rangeName(lo: string, hi: string): string {
  const a = lo.match(/P\d+/i)?.[0];
  const b = hi.match(/P\d+/i)?.[0];
  return a && b ? `Likely range (${a.toUpperCase()}–${b.toUpperCase()})` : `${lo}–${hi}`;
}

/** Fridays and Saturdays as [start, end] index pairs, for daily dates up to four months long. */
export function weekendRuns(dates: (number | null)[]): [number, number][] {
  if (dates.length < 7 || dates.length > 124 || dates.some((d) => d === null)) return [];
  const runs: [number, number][] = [];
  dates.forEach((d, i) => {
    const day = new Date(d as number).getUTCDay();
    if (day !== 5 && day !== 6) return;
    const prev = runs[runs.length - 1];
    if (prev && prev[1] === i - 1) prev[1] = i;
    else runs.push([i, i]);
  });
  return runs;
}

function weekends(c: Ctx): Record<string, unknown>[][] {
  const xKey = pickLabelKey(c, c.spec.x, c.spec.group);
  if (!xKey || c.spec.group) return [];
  const xCol = c.columns.find((k) => k.key === xKey);
  if (xCol?.kind !== 'date') return [];
  // Only for nights of stay: a booking curve's dates are when people booked, where weekends mean nothing.
  if (!/night|stay|arrival/i.test(`${xCol.key} ${xCol.label}`)) return [];
  const dates = c.rows.map((r) => parseDate(cell(r, xKey)));
  return weekendRuns(dates).map(([a, b]) => [{ xAxis: a }, { xAxis: b }]);
}
