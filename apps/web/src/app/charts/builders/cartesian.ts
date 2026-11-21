import { formatDelta, formatValue, isNumericKind, isRatio, lowerIsBetter, num } from '../format';
import { catColor, markRadius, mix } from '../tokens';
import type { EvidenceColumn } from '../widget-types';
import {
  type Built,
  type Ctx,
  type LegendItem,
  type PointRef,
  type TipRow,
  baseOption,
  categoryAxis,
  cell,
  column,
  distinct,
  empty,
  extremes,
  label,
  numberAt,
  pickLabelKey,
  pickValueKey,
  specKeys,
  summary,
  tableModel,
  textWidth,
  tip,
  tooltip,
  bandTip,
  hatch,
  valueAxis,
  valueColumn,
} from './shared';
import { type Overlay, overlays } from './overlays';

/*
  Line, area, bar, stacked bar, grouped bar, waterfall and bullet: everything on a category axis and a value axis.
  One value axis only (never dual). The current period is blue, a `compare` column is purple and dashed (lines)
  or a tick (bars), and series are named on the marks where there is room, in a legend otherwise.
*/

export interface Series {
  name: string;
  values: (number | null)[];
  color: string;
  role: 'main' | 'compare';
  col: EvidenceColumn;
}
export interface Frame {
  xCol: EvidenceColumn;
  /** Axis labels (16 Dec) and tooltip titles (Wed 16 Dec 2026). */
  labels: string[];
  full: string[];
  series: Series[];
  valueCol: EvidenceColumn;
  /** Category names are words (hotels, segments), not dates: bars lie down so the names read. */
  wordy: boolean;
  dropped: number;
}

const MAX_SERIES = 6;

/** Rows → categories and series. Wide rows use `y` (+ `compare`); long rows split `y[0]` by `group`. */
export function frame(c: Ctx): Frame | null {
  const xKey = pickLabelKey(c, c.spec.x, c.spec.group);
  const yKey = pickValueKey(c);
  if (!xKey || !yKey || !c.rows.length) return null;
  const xCol = column(c, xKey);
  const valueCol = valueColumn(c, yKey);
  const wordy = xCol.kind !== 'date' && xCol.kind !== 'month' && !isNumericKind(xCol.kind);
  const split = c.spec.group && c.spec.group !== xKey ? c.spec.group : null;

  if (split) {
    const xs = distinct(c.rows.map((r) => String(cell(r, xKey) ?? '')));
    const groups = distinct(c.rows.map((r) => String(cell(r, split) ?? '')));
    const shown = groups.slice(0, MAX_SERIES);
    const at = new Map(c.rows.map((r) => [`${String(cell(r, xKey) ?? '')}¦${String(cell(r, split) ?? '')}`, numberAt(r, yKey)]));
    return {
      xCol,
      labels: xs.map((x) => label(x, xCol)),
      full: xs.map((x) => label(x, xCol, 'full')),
      series: shown.map((g, i) => ({ name: label(g, column(c, split)), values: xs.map((x) => at.get(`${x}¦${g}`) ?? null), color: catColor(c.t, i, g), role: 'main', col: valueCol })),
      valueCol,
      wordy,
      dropped: groups.length - shown.length,
    };
  }

  const yKeys = (c.spec.y?.length ? c.spec.y : [yKey]).slice(0, MAX_SERIES);
  const single = yKeys.length === 1;
  const series: Series[] = yKeys.map((k, i) => {
    const col = valueColumn(c, k);
    return { name: col.label, values: c.rows.map((r) => numberAt(r, k)), color: single ? c.t.series : catColor(c.t, i, col.label), role: 'main', col };
  });
  if (c.spec.compare) {
    const col = valueColumn(c, c.spec.compare);
    series.push({ name: col.label, values: c.rows.map((r) => numberAt(r, c.spec.compare)), color: c.t.cmp, role: 'compare', col });
  }
  return {
    xCol,
    labels: c.rows.map((r) => label(cell(r, xKey), xCol)),
    full: c.rows.map((r) => label(cell(r, xKey), xCol, 'full')),
    series,
    valueCol,
    wordy,
    dropped: Math.max(0, (c.spec.y?.length ?? 1) - yKeys.length),
  };
}

/** Tooltips and tables get the full value; labels on the chart get the compact one, without its unit. */
const fmt = (v: number | null, col: EvidenceColumn, compact = false) => (v === null ? '–' : formatValue(v, col, compact ? { compact: true, unit: false } : {}));

function axisTip(c: Ctx, f: Frame) {
  return (params: unknown) => {
    const list = (Array.isArray(params) ? params : [params]) as { dataIndex: number }[];
    const i = list[0]?.dataIndex ?? 0;
    return tipAt(c, f, i);
  };
}

function tipAt(c: Ctx, f: Frame, i: number): string {
  const rows: TipRow[] = f.series.map((s) => ({ label: s.name, value: fmt(s.values[i], s.col), color: s.color, dashed: s.role === 'compare' }));
  const main = f.series.find((s) => s.role === 'main');
  const cmp = f.series.find((s) => s.role === 'compare');
  const d = main && cmp && f.series.length === 2 ? formatDelta(main.values[i], cmp.values[i], main.col.kind, main.col.unit) : null;
  return tip(c, f.full[i] ?? '', rows, d ? `${d.text} vs ${cmp!.name.toLowerCase()}` : undefined);
}

function pointsOf(f: Frame, seriesIndex = 0): PointRef[] {
  return f.labels.map((_, i) => ({
    seriesIndex,
    dataIndex: i,
    text: `${f.full[i]}: ${f.series.map((s) => `${s.name} ${fmt(s.values[i], s.col)}`).join('; ')}`,
  }));
}

function describe(c: Ctx, f: Frame, what: string, extra = ''): string {
  const s = f.series[0];
  return summary(c, `${what} with ${f.labels.length} ${f.labels.length === 1 ? 'point' : 'points'}${f.series.length > 1 ? ` and ${f.series.length} series (${f.series.map((x) => x.name).join(', ')})` : ''}.`, [extremes(f.labels.map((name, i) => ({ name: f.full[i] ?? name, value: s.values[i], text: fmt(s.values[i], s.col) }))), extra].filter(Boolean).join(' '));
}

const legendOf = (f: Frame, mark: (s: Series) => LegendItem['mark']): LegendItem[] => (f.series.length > 1 ? f.series.map((s) => ({ label: s.name, color: s.color, mark: mark(s) })) : []);
const droppedNote = (f: Frame) => (f.dropped > 0 ? `Showing the first ${MAX_SERIES} series. “View as table” has the other ${f.dropped}.` : undefined);

/* ───────── Line and area ───────── */

function lineLike(c: Ctx, area: boolean): Built {
  const f = frame(c);
  if (!f) return empty(c, 'No data for this period.');
  const multi = f.series.length > 1;
  const extra = overlays(c, { yKey: c.spec.y?.[0] ?? pickValueKey(c), columns: false });
  const rich = extra.series.length > 0;
  // Name the series on the line ends when they fit; otherwise the legend carries them. With a forecast, a range or a
  // reference line the legend names everything, and only the main line's end carries its value.
  const direct = !c.narrow && f.series.length <= 4 && !rich;
  const endText = (s: Series) => (multi ? s.name : formatValue(lastValue(s.values), s.col, { compact: true }));
  const valueEnd = rich && extra.today === null && !c.narrow;
  // The end label sits 8 px past the line's end: its room is that, its width and a little air, or it is clipped.
  const right = direct ? Math.min(150, Math.max(...f.series.map((s) => textWidth(endText(s), 12)))) + 8 + 8 : valueEnd ? textWidth(formatValue(lastValue(f.series[0].values), f.series[0].col, { compact: true }), 12) + 16 : 16;
  const dataMax = Math.max(...f.series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  const reach = Math.max(...extra.values, dataMax);
  const option = {
    ...baseOption(c),
    grid: { left: 8, right, top: rich ? 22 : 14, bottom: 4, containLabel: true },
    tooltip: tooltip(c, { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: c.t.muted, width: 1, opacity: 0.5 } }, formatter: rich ? (params: unknown) => tipWith(c, f, extra, firstIndex(params)) : axisTip(c, f) }),
    xAxis: categoryAxis(c, f.labels, { boundaryGap: false }),
    // An area encodes magnitude, so it starts at zero; a line may zoom to its range, but not past a limit or a band.
    yAxis: valueAxis(c, f.valueCol, rich ? { min: 0, ...(reach > dataMax ? { max: reach } : {}) } : { scale: !area }),
    series: [
      ...extra.series,
      ...f.series.map((s) => ({
        type: 'line',
        name: s.name,
        data: s.values,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: f.labels.length === 1,
        z: s.role === 'compare' ? 1 : 2,
        lineStyle: { color: s.color, width: s.role === 'compare' ? 1.5 : 2, type: s.role === 'compare' ? [...c.t.cmpDash] : 'solid', cap: 'round', join: 'round' },
        itemStyle: { color: s.color, borderColor: c.t.surface, borderWidth: 2 },
        emphasis: { focus: 'none', scale: false, lineStyle: { width: 2 } },
        areaStyle: area && s.role === 'main' ? { color: s.color, opacity: multi ? 0.1 : 0.14 } : undefined,
        endLabel: direct || (valueEnd && s === f.series[0]) ? { show: true, formatter: () => (direct ? endText(s) : formatValue(lastValue(s.values), s.col, { compact: true })), color: s.role === 'compare' ? c.t.muted : c.t.text, fontSize: 12, fontWeight: multi ? 500 : 600, fontFamily: c.t.font, distance: 8 } : undefined,
        labelLayout: direct ? { moveOverlap: 'shiftY' } : undefined,
      })),
    ],
  };
  const legend = rich ? [...f.series.map((s) => ({ label: s.name, color: s.color, mark: (s.role === 'compare' ? 'dashed' : 'line') as LegendItem['mark'] })), ...extra.legend] : direct ? [] : legendOf(f, (s) => (s.role === 'compare' ? 'dashed' : 'line'));
  return {
    render: 'echarts',
    kind: area ? 'area' : 'line',
    option,
    points: pointsOf(f, extra.series.length),
    legend,
    note: droppedNote(f),
    table: tableModel(c, specKeys(c.spec)),
    summary: describe(c, f, area ? 'Area chart' : 'Line chart', [trend(f.series[0]), extra.spoken].filter(Boolean).join(' ')),
  };
}

const firstIndex = (params: unknown) => ((Array.isArray(params) ? params : [params]) as { dataIndex: number }[])[0]?.dataIndex ?? 0;

/** The tooltip of a chart with overlays: its series, then the forecast, the range and the target. */
function tipWith(c: Ctx, f: Frame, extra: Overlay, i: number): string {
  const rows: TipRow[] = [...f.series.filter((s) => s.values[i] !== null).map((s) => ({ label: s.name, value: fmt(s.values[i], s.col), color: s.color, dashed: s.role === 'compare' })), ...extra.tip(i).filter((r) => r.value !== '–')];
  return tip(c, f.full[i] ?? '', rows);
}

const lastValue = (xs: (number | null)[]) => [...xs].reverse().find((v): v is number => v !== null) ?? null;
const firstValue = (xs: (number | null)[]) => xs.find((v): v is number => v !== null) ?? null;
function trend(s: Series): string {
  const a = firstValue(s.values);
  const b = lastValue(s.values);
  if (a === null || b === null) return '';
  return `${s.name} goes from ${fmt(a, s.col)} to ${fmt(b, s.col)}.`;
}

export const buildLine = (c: Ctx): Built => lineLike(c, false);
export const buildArea = (c: Ctx): Built => lineLike(c, true);

/* ───────── Bars ───────── */

/*
  Horizontal bars (one row per hotel, segment, channel) read like a ranked list: sorted by what the title is
  about, the rows the title names in full colour and the rest muted, every bar the same thickness, the value at
  the end of its bar. At most eight rows are drawn; the rest are one "+12 more" away (the table has them all).
*/

/** The most rows a list of bars draws. */
export const MAX_BAR_ROWS = 8;
/** Pixels kept under the rows for "+12 more". */
export const MORE_H = 24;
/** Pixels the legend row above the plot takes. */
export const LEGEND_H = 26;
/** A title about the weak end ("behind", "lowest") ranks from the bottom up. */
const LOW_END = /\b(behind|weakest|weaker|lowest|lower|worst|below|bottom|least|slowest|fewest|lag\w*|trail\w*|under\w*|down|drops?|dropped|fell|falls?|falling|declin\w*|los(?:es|t|ing)|short|miss\w*|soft\w*)\b/i;
/** A title about a gap to a comparison ("vs last year", "behind budget") ranks by that gap. */
const ABOUT_GAP = /\b(last year|ly|stly|budget|target|forecast|vs\.?|versus|behind|ahead|above|below|gap|pace|pacing|against|compared)\b/i;
/** Column keys that hold the comparison to another (last year, budget): such a pair is one bar and a marker. */
export const COMPARE_KEY = /(_ly$|_stly$|stly|last_?year|_py$|prior|budget|target|forecast|_cmp$|compare)/i;
const ORDINAL = /^(\d|mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q[1-4]\b|week|day|stage|step)/i;

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Which rows the title names (a hotel by its city, short or full name, a segment by its name). */
export function subjectsOf(title: string, names: string[], full: string[] = names): boolean[] {
  const hit = names.map((n, i) =>
    [n, full[i]]
      .filter((s): s is string => !!s && s.length >= 3)
      .some((s) => new RegExp(`(^|[^\\p{L}])${escRe(s)}($|[^\\p{L}])`, 'iu').test(title)),
  );
  const count = hit.filter(Boolean).length;
  // Naming every row (or none) singles nothing out.
  return count && count < names.length ? hit : names.map(() => false);
}

export interface Ranking {
  /** Row indices in the order to draw. */
  order: number[];
  /** Rows not drawn: "+N more". */
  more: number;
}

/**
 * The order and the cut of a list of bars: by `key` (descending, or ascending for a title about the weak end),
 * the first `limit`, and every row the title names even when it ranks below the cut.
 */
export function rank(title: string, labels: string[], key: (number | null)[] | null, subject: boolean[], limit: number): Ranking {
  const all = labels.map((_, i) => i);
  const ordinal = labels.length > 0 && labels.every((l) => ORDINAL.test(l.trim()));
  let order = all;
  if (key && !ordinal) {
    const dir = LOW_END.test(title) ? 1 : -1;
    order = [...all].sort((a, b) => {
      const x = key[a];
      const y = key[b];
      if (x === null || y === null) return x === y ? a - b : x === null ? 1 : -1;
      return (x - y) * dir || a - b;
    });
  }
  if (order.length <= limit) return { order, more: 0 };
  const kept = order.slice(0, limit);
  for (const i of order.slice(limit)) {
    if (!subject[i]) continue;
    // Give the named row the place of the last row nobody asked about.
    const out = [...kept].reverse().find((k) => !subject[k]);
    if (out === undefined) break;
    kept.splice(kept.indexOf(out), 1);
    kept.push(i);
  }
  const shown = new Set(kept);
  return { order: order.filter((i) => shown.has(i)), more: labels.length - kept.length };
}

/** What a list of bars ranks by: the gap to the comparison when the title is about it, else the value. */
function rankKey(c: Ctx, main: Series, cmp: Series | undefined): (number | null)[] {
  if (cmp && ABOUT_GAP.test(c.spec.title)) {
    return main.values.map((v, i) => {
      const b = cmp.values[i];
      if (v === null || b === null || b === undefined) return null;
      return main.col.kind === 'percent' || b === 0 ? v - b : (v - b) / Math.abs(b);
    });
  }
  return main.values;
}

function pick(f: Frame, order: number[]): Frame {
  const at = <T>(xs: readonly T[]) => order.map((i) => xs[i]);
  return { ...f, labels: at(f.labels), full: at(f.full), series: f.series.map((s) => ({ ...s, values: at(s.values) })) };
}

/** The vertical rhythm of a list of bars: one pitch per row, the same bar thickness on every row. */
export interface RowLayout {
  pitch: number;
  bar: number;
  /** Height of the plot (rows only). */
  plot: number;
}
export function rowLayout(c: Ctx, rows: number, more: boolean, bars = 1, legend = false): RowLayout {
  const room = c.height - 8 - (more ? MORE_H : 0) - (legend ? LEGEND_H : 0);
  const pitch = Math.max(18, Math.min(bars > 1 ? 18 + bars * 12 : 34, Math.floor(room / Math.max(1, rows))));
  const bar = bars > 1 ? Math.max(6, Math.min(12, Math.floor((pitch * 0.72) / bars))) : pitch >= 30 ? 16 : pitch >= 24 ? 14 : 12;
  return { pitch, bar, plot: pitch * rows };
}

/** How many rows of bars fit the body (never more than eight). */
export function rowLimit(c: Ctx, bars = 1, legend = false): number {
  // A host that gives the list more height than a card's (a board's bullet per hotel) gets more rows: 24 px each.
  const cap = c.height >= 400 ? Math.max(MAX_BAR_ROWS, Math.floor((c.height - 8 - MORE_H - (legend ? LEGEND_H : 0)) / 24)) : MAX_BAR_ROWS;
  return Math.max(3, Math.min(cap, Math.floor((c.height - 8 - MORE_H - (legend ? LEGEND_H : 0)) / (bars > 1 ? 14 + bars * 8 : 22))));
}

/** The room the category names of horizontal bars get: what they need, up to a share of the width. */
export function nameWidth(c: Ctx, names: string[]): number {
  return Math.min(Math.max(...names.map((l) => textWidth(l, 12))) + 6, Math.round(c.width * (c.narrow ? 0.36 : 0.32)));
}

/** Category names on the left of horizontal bars: wrapped onto a second line when long, never cut to "…" where a row has the room. */
function nameAxis(c: Ctx, f: Frame, subject: boolean[], layout: RowLayout) {
  const lit = subject.some(Boolean);
  return categoryAxis(c, f.labels, {
    inverse: true,
    axisLine: { show: false },
    axisLabel: {
      color: (_: string, i: number) => (!lit || subject[i] ? c.t.text : c.t.muted),
      fontSize: 12,
      fontFamily: c.t.font,
      fontWeight: 400,
      width: nameWidth(c, f.labels),
      overflow: layout.pitch >= 28 ? 'break' : 'truncate',
      lineHeight: 13,
      interval: 0,
      margin: 10,
    },
  });
}

const hiddenValueAxis = (c: Ctx, col: EvidenceColumn, extra: Record<string, unknown> = {}) => valueAxis(c, col, { axisLabel: { show: false }, splitLine: { show: false }, ...extra });

/**
 * The value axis of horizontal bars with the labels' room built in: bars below zero keep space on their left for
 * their number, so a label never runs into the names.
 */
function barExtent(values: (number | null)[], plotW: number, negLabel: number): { min?: number; max?: number } {
  const ok = values.filter((v): v is number => v !== null);
  if (!ok.length) return {};
  const lo = Math.min(0, ...ok);
  const hi = Math.max(0, ...ok);
  if (lo >= 0) return { min: 0 };
  const range = hi - lo || 1;
  const scale = range / Math.max(40, plotW - negLabel);
  return { min: lo - negLabel * scale, max: hi };
}

/** Direct value labels at the end of each bar, carried by an invisible series so they sit past a comparison marker too. */
function endLabels(c: Ctx, ends: (number | null)[], texts: string[], subject: boolean[], name: string, xAxisIndex = 0) {
  const lit = subject.some(Boolean);
  return {
    type: 'scatter',
    name,
    silent: true,
    tooltip: { show: false },
    symbolSize: 1,
    // Transparent, not opacity 0: the label would inherit an opacity.
    itemStyle: { color: 'rgba(0,0,0,0)' },
    xAxisIndex,
    z: 4,
    data: ends.map((v, i) =>
      v === null
        ? '-'
        : {
            value: v,
            label: { show: true, position: v < 0 ? 'left' : 'right', distance: 5, formatter: texts[i], color: !lit || subject[i] ? c.t.text : c.t.muted, fontWeight: lit && subject[i] ? 600 : 400, fontSize: 11.5, fontFamily: c.t.font },
          },
    ),
  };
}

const MUTED = 0.38;

export function buildBar(c: Ctx, note?: string): Built {
  const whole = frame(c);
  if (!whole) return empty(c, 'No data for this period.');
  return whole.wordy ? barRows(c, whole, note) : barColumns(c, whole, note);
}

/** Bars per hotel, segment or channel: a ranked list. */
function barRows(c: Ctx, whole: Frame, note?: string): Built {
  const main0 = whole.series[0];
  const cmp0 = whole.series.find((s) => s.role === 'compare');
  const subjectAll = subjectsOf(c.spec.title, whole.labels, whole.full);
  const { order, more } = rank(c.spec.title, whole.labels, rankKey(c, main0, cmp0), subjectAll, rowLimit(c, 1, !!cmp0));
  const f = pick(whole, order);
  const subject = order.map((i) => subjectAll[i]);
  const lit = subject.some(Boolean);
  const main = f.series[0];
  const cmp = f.series.find((s) => s.role === 'compare');
  const layout = rowLayout(c, f.labels.length, more > 0, 1, !!cmp);
  // A ratio to a benchmark (BAR ÷ comp set median) grows from 1, where it is level: a bar is the gap, not the multiple.
  const base = isRatio(main.col) ? 1 : 0;
  const at = (v: number | null) => (v === null ? null : v - base);
  const texts = main.values.map((v) => fmt(v, main.col, true));
  const longest = Math.max(...texts.map((t) => textWidth(t, 11.5)));
  const negative = main.values.some((v) => v !== null && v < base);
  const positive = main.values.some((v) => v !== null && v > base) || !!cmp?.values.some((v) => v !== null && v > base);
  // Room for the labels on the side they sit: right of bars above zero, left of bars below it (clear of the names).
  const left = nameWidth(c, f.labels) + 12 + (negative ? 28 : 0);
  const right = positive || !negative ? longest + 12 : 16;
  const plotW = c.width - left - right;
  // A label goes past whichever is further out: the bar or its comparison marker.
  const ends = main.values.map((v, i) => {
    const b = at(cmp?.values[i] ?? null);
    const x = at(v);
    if (x === null) return null;
    if (b === null) return x;
    return x < 0 ? Math.min(x, b) : Math.max(x, b);
  });
  const extent = barExtent([...main.values, ...(cmp?.values ?? [])].map(at), plotW, negative ? longest + 10 : 0);
  const radius = (v: number | null) => markRadius(c.t, v !== null && v < 0 ? [3, 0, 0, 3] : [0, 3, 3, 0]);
  const bar = {
    type: 'bar',
    name: main.name,
    barWidth: layout.bar,
    barMinHeight: 1,
    data: main.values.map((v, i) => ({ value: at(v), itemStyle: { color: main.color, opacity: !lit || subject[i] ? 1 : MUTED, borderRadius: radius(at(v)) } })),
    emphasis: { itemStyle: { opacity: 1 } },
  };
  const tick = cmp
    ? { type: 'scatter', name: cmp.name, data: cmp.values.map(at), symbol: 'rect', symbolSize: [2.5, layout.bar + 6], itemStyle: { color: cmp.color, borderColor: c.t.surface, borderWidth: 1 }, emphasis: { scale: false }, z: 3 }
    : null;
  const option = {
    ...baseOption(c),
    tooltip: bandTip(c, (i) => tipAt(c, f, i)),
    grid: { left, right, top: 4, height: layout.plot, containLabel: false },
    xAxis: hiddenValueAxis(c, f.valueCol, extent),
    yAxis: nameAxis(c, f, subject, layout),
    series: [bar, ...(tick ? [tick] : []), endLabels(c, ends, texts, subject, `${main.name} values`)],
  };
  return {
    render: 'echarts',
    kind: 'bar',
    option,
    points: pointsOf(f),
    legend: cmp ? [{ label: main.name, color: main.color, mark: 'solid' }, { label: cmp.name, color: cmp.color, mark: 'tick' }] : [],
    note,
    ...(more ? { more } : {}),
    table: tableModel(c, specKeys(c.spec)),
    summary: describe(c, whole, 'Bar chart', more ? `The chart shows ${f.labels.length} of them; the table has all ${whole.labels.length}.` : ''),
  };
}

/** Bars over time (days, months): upright columns in their own order. */
function barColumns(c: Ctx, f: Frame, note?: string): Built {
  const main = f.series[0];
  const cmp = f.series.find((s) => s.role === 'compare');
  const extra = overlays(c, { yKey: c.spec.y?.[0] ?? pickValueKey(c), columns: true });
  const rich = extra.series.length > 0;
  const valueLabels = !rich && f.labels.length <= (c.narrow ? 8 : 14);
  // A share of rooms stops at 100%.
  const reach = Math.max(...extra.values, ...main.values.filter((v): v is number => v !== null), ...(cmp?.values.filter((v): v is number => v !== null) ?? []));
  const capped = main.col.kind === 'percent' && reach <= 100 && reach > 40;
  const bar = {
    type: 'bar',
    name: main.name,
    data: main.values,
    barMaxWidth: 16,
    barCategoryGap: '40%',
    barMinHeight: 1,
    z: 2,
    itemStyle: { color: main.color, borderRadius: markRadius(c.t, [3, 3, 0, 0]) },
    emphasis: { itemStyle: { color: main.color, opacity: 0.85 } },
    label: valueLabels ? { show: true, position: 'top', distance: 5, color: c.t.text, fontSize: 11.5, fontFamily: c.t.font, formatter: (p: { dataIndex: number }) => fmt(main.values[p.dataIndex], main.col, true) } : undefined,
    labelLayout: { hideOverlap: true },
  };
  const tick = cmp ? { type: 'scatter', name: cmp.name, data: cmp.values, symbol: 'rect', symbolSize: [Math.max(6, Math.min(20, ((c.width - 60) / f.labels.length) * 0.7)), 2.5], itemStyle: { color: cmp.color, borderColor: c.t.surface, borderWidth: 1 }, emphasis: { scale: false }, z: 3 } : null;
  const option = {
    ...baseOption(c),
    tooltip: bandTip(c, (i) => (rich ? tipWith(c, f, extra, i) : tipAt(c, f, i))),
    grid: { left: 8, right: 12, top: valueLabels ? 22 : rich ? 22 : 12, bottom: 4, containLabel: true },
    xAxis: categoryAxis(c, f.labels),
    yAxis: valueAxis(c, f.valueCol, valueLabels ? { axisLabel: { show: false }, splitLine: { show: false } } : capped ? { min: 0, max: 100 } : rich ? { min: 0, ...(reach > Math.max(...main.values.filter((v): v is number => v !== null)) ? { max: reach } : {}) } : {}),
    series: [...extra.series, bar, ...(tick ? [tick] : [])],
  };
  const legend = cmp || rich ? [{ label: main.name, color: main.color, mark: 'solid' as const }, ...(cmp ? [{ label: cmp.name, color: cmp.color, mark: 'tick' as const }] : []), ...extra.legend] : [];
  return {
    render: 'echarts',
    kind: 'bar',
    option,
    points: pointsOf(f, extra.series.length),
    legend,
    note,
    table: tableModel(c, specKeys(c.spec)),
    summary: describe(c, f, 'Bar chart', extra.spoken),
  };
}

/**
 * Grouped bars per hotel (or segment) of a value and its comparison (this year and last, actual and budget) read
 * better as one bar with a marker: the spec as a bar chart with `compare`, or null when it is not such a pair.
 */
export function comparisonPair(c: Ctx, f: Frame): Ctx | null {
  if (!f.wordy || c.spec.group || f.series.length !== 2) return null;
  const y = c.spec.y ?? [];
  if (c.spec.compare && y.length === 1) return c;
  if (c.spec.compare || y.length !== 2) return null;
  const [a, b] = y;
  return COMPARE_KEY.test(a) || !COMPARE_KEY.test(b) ? null : { ...c, spec: { ...c.spec, y: [a], compare: b } };
}

function multiBar(c: Ctx, stacked: boolean): Built {
  const whole = frame(c);
  if (!whole) return empty(c, 'No data for this period.');
  const pair = stacked ? null : comparisonPair(c, whole);
  if (pair) return { ...buildBar(pair), kind: 'grouped_bar' };
  const k = stacked ? 1 : whole.series.length;
  const totalsOf = (f: Frame) => f.labels.map((_, i) => f.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  let f = whole;
  let more = 0;
  let subject = whole.labels.map(() => false);
  if (whole.wordy) {
    const subjectAll = subjectsOf(c.spec.title, whole.labels, whole.full);
    const r = rank(c.spec.title, whole.labels, stacked ? totalsOf(whole) : whole.series[0].values, subjectAll, rowLimit(c, k, whole.series.length > 1));
    f = pick(whole, r.order);
    more = r.more;
    subject = r.order.map((i) => subjectAll[i]);
  }
  const lit = subject.some(Boolean);
  const totals = totalsOf(f);
  const hasCompare = f.series.some((s) => s.role === 'compare');
  const layout = rowLayout(c, f.labels.length, more > 0, k, f.series.length > 1);
  // Labels never collide: on rows, each bar needs the height of its number; on columns, each bar the width of its number.
  const longest = Math.max(...(stacked ? totals : f.series.flatMap((s) => s.values)).map((v) => textWidth(fmt(v, f.valueCol, true), 11.5)));
  const plotW = c.width - 40;
  const slot = (plotW / Math.max(1, f.labels.length)) * 0.7;
  const fits = f.wordy ? (stacked ? true : layout.bar >= 11) : stacked ? slot >= longest : slot / k >= longest + 2 && !hasCompare;
  const labelled = (s: Series, si: number) => (stacked ? si === f.series.length - 1 : !hasCompare || s.role === 'main');
  const labelStyle = (s: Series, si: number) => ({
    position: f.wordy ? 'right' : 'top',
    distance: 5,
    color: stacked || s.role === 'main' ? c.t.text : c.t.muted,
    fontSize: 11.5,
    fontFamily: c.t.font,
    formatter: (p: { dataIndex: number }) => fmt(stacked ? totals[p.dataIndex] : s.values[p.dataIndex], s.col, true),
    show: fits && labelled(s, si),
  });
  const series = f.series.map((s, si) => ({
    type: 'bar',
    name: s.name,
    data: s.values.map((v, i) => ({ value: v, itemStyle: { opacity: !lit || subject[i] ? 1 : MUTED } })),
    stack: stacked ? 'total' : undefined,
    barWidth: f.wordy ? layout.bar : undefined,
    barMaxWidth: f.wordy ? undefined : stacked ? 18 : 12,
    barGap: stacked ? undefined : '20%',
    barCategoryGap: stacked ? '40%' : '32%',
    // A 1 px gap in the surface colour separates the parts of a stack; no outlines.
    itemStyle: stacked ? { color: s.color, borderColor: c.t.surface, borderWidth: 1, borderRadius: markRadius(c.t, 2) } : { color: s.color, borderRadius: markRadius(c.t, f.wordy ? [0, 3, 3, 0] : [3, 3, 0, 0]) },
    label: labelStyle(s, si),
    // Where the numbers do not fit beside every bar, hovering a bar shows its own.
    emphasis: { focus: 'series', blurScope: 'coordinateSystem', label: { show: labelled(s, si) || !stacked } },
    blur: { itemStyle: { opacity: 0.35 } },
    labelLayout: f.wordy ? undefined : { hideOverlap: true },
  }));
  const option = {
    ...baseOption(c),
    tooltip: tooltip(c, {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: c.t.grid } },
      formatter: (params: unknown) => {
        const i = ((Array.isArray(params) ? params : [params]) as { dataIndex: number }[])[0]?.dataIndex ?? 0;
        const rows: TipRow[] = f.series.map((s) => ({ label: s.name, value: fmt(s.values[i], s.col), color: s.color }));
        return tip(c, f.full[i] ?? '', rows, stacked ? `Total ${fmt(totals[i], f.valueCol)}` : undefined);
      },
    }),
    grid: f.wordy ? { left: nameWidth(c, f.labels) + 12, right: fits ? longest + 12 : 14, top: 4, height: layout.plot, containLabel: false } : { left: 8, right: 12, top: fits ? 22 : 12, bottom: 4, containLabel: true },
    xAxis: f.wordy ? hiddenValueAxis(c, f.valueCol) : categoryAxis(c, f.labels),
    yAxis: f.wordy ? nameAxis(c, f, subject, layout) : valueAxis(c, f.valueCol),
    series,
  };
  return {
    render: 'echarts',
    kind: stacked ? 'stacked_bar' : 'grouped_bar',
    option,
    points: pointsOf(f),
    legend: legendOf(f, () => 'solid'),
    note: droppedNote(f),
    ...(more ? { more } : {}),
    table: tableModel(c, specKeys(c.spec)),
    summary: describe(c, whole, stacked ? 'Stacked bar chart' : 'Grouped bar chart'),
  };
}

/** Parts of a bar that are a cost taken out of it (commission, fees): hatched in the bar's colour, never a second hue. */
const COST = /commission|fees?\b|cost/i;

/**
 * Stacked bars, with what a stack can carry besides its parts: a comparison (last year's total or net) as a tick on
 * rows or a dashed step over columns; parts below zero (cancellations) in grey under the axis; a cost part hatched;
 * and, over nights, the weekends shaded.
 */
function stackedBar(c: Ctx): Built {
  const whole = frame(c);
  if (!whole) return empty(c, 'No data for this period.');
  const partsOf = (f: Frame) => f.series.filter((s) => s.role === 'main');
  const totalsOf = (f: Frame) => f.labels.map((_, i) => partsOf(f).reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  let f = whole;
  let more = 0;
  let subject = whole.labels.map(() => false);
  const hasCmp = whole.series.some((s) => s.role === 'compare');
  if (whole.wordy) {
    const subjectAll = subjectsOf(c.spec.title, whole.labels, whole.full);
    const r = rank(c.spec.title, whole.labels, totalsOf(whole), subjectAll, rowLimit(c, 1, true));
    f = pick(whole, r.order);
    more = r.more;
    subject = r.order.map((i) => subjectAll[i]);
  }
  const lit = subject.some(Boolean);
  const parts = partsOf(f);
  const cmp = f.series.find((s) => s.role === 'compare');
  const totals = totalsOf(f);
  const below = (s: Series) => s.values.some((v) => v !== null && v < 0) && s.values.every((v) => v === null || v <= 0);
  const diverging = parts.some(below);
  const costly = (s: Series, i: number) => i > 0 && COST.test(`${s.col.key} ${s.name}`);
  const colorOf = (s: Series, i: number) => (below(s) ? c.t.grey : parts.length === 1 || i === 0 || costly(s, i) ? c.t.series : s.color);
    const extra = f.wordy ? null : overlays(c, { yKey: undefined, columns: true });
  const layout = rowLayout(c, f.labels.length, more > 0, 1, true);
  const totalText = (i: number) => fmt(totals[i], f.valueCol, true);
  const longest = Math.max(...totals.map((_, i) => textWidth(totalText(i), 11.5)));
  const slot = ((c.width - 40) / Math.max(1, f.labels.length)) * 0.7;
  const fits = !diverging && (f.wordy || slot >= longest);
  const series = parts.map((s, si) => {
    const color = colorOf(s, si);
    const fill = costly(s, si) ? hatch(color, mix(color, c.t.surface, 0.18)) : color;
    const last = si === parts.length - 1;
    return {
      type: 'bar',
      name: s.name,
      stack: 'total',
      data: s.values.map((v, i) => ({ value: v, itemStyle: { opacity: !lit || subject[i] ? 1 : MUTED } })),
      barWidth: f.wordy ? Math.min(layout.bar, 14) : undefined,
      barMaxWidth: f.wordy ? undefined : 16,
      barCategoryGap: '40%',
      z: 2,
      itemStyle: { color: fill, borderColor: costly(s, si) ? color : c.t.surface, borderWidth: 1, borderRadius: markRadius(c.t, 2) },
      label: { show: fits && last, position: f.wordy ? 'right' : 'top', distance: 5, color: c.t.text, fontSize: 11.5, fontFamily: c.t.font, formatter: (p: { dataIndex: number }) => totalText(p.dataIndex) },
      emphasis: { disabled: true },
      labelLayout: f.wordy ? undefined : { hideOverlap: true },
    };
  });
  // The comparison: a tick across each row, or a dashed step over the columns.
  const cmpSeries = cmp
    ? f.wordy
      ? { type: 'scatter', name: cmp.name, data: cmp.values, symbol: 'rect', symbolSize: [2.5, Math.min(layout.bar, 14) + 8], itemStyle: { color: cmp.color, borderColor: c.t.surface, borderWidth: 1 }, emphasis: { scale: false }, z: 4 }
      : { type: 'line', name: cmp.name, data: cmp.values, step: 'middle', symbol: 'none', z: 4, lineStyle: { color: cmp.color, width: 1.5, type: [...c.t.cmpDash] }, itemStyle: { color: cmp.color }, emphasis: { disabled: true } }
    : null;
  const zero = diverging ? [{ type: 'line', name: '__zero', data: [], silent: true, tooltip: { show: false }, markLine: { silent: true, symbol: 'none', animation: false, label: { show: false }, lineStyle: { color: c.t.ref, width: 1, type: 'solid' }, data: [{ [f.wordy ? 'xAxis' : 'yAxis']: 0 }] } }] : [];
  const tipAtRow = (i: number) => {
    const rows: TipRow[] = [
      ...parts.map((s, si) => ({ label: s.name, value: fmt(s.values[i], s.col), color: colorOf(s, si) })),
      ...(cmp ? [{ label: cmp.name, value: fmt(cmp.values[i], cmp.col), color: cmp.color, dashed: true }] : []),
    ];
    return tip(c, f.full[i] ?? '', rows, parts.length > 1 ? `${diverging ? 'Net' : 'Total'} ${fmt(totals[i], f.valueCol)}` : undefined);
  };
  const ends = totals.map((v, i) => Math.max(v, cmp?.values[i] ?? v));
  const option = {
    ...baseOption(c),
    tooltip: bandTip(c, tipAtRow),
    grid: f.wordy ? { left: nameWidth(c, f.labels) + 12, right: fits ? longest + 14 : 14, top: 4, height: layout.plot, containLabel: false } : { left: 8, right: 12, top: fits ? 22 : 14, bottom: 4, containLabel: true },
    xAxis: f.wordy ? hiddenValueAxis(c, f.valueCol, { min: 0, max: Math.max(...ends) * 1.02 || 1 }) : categoryAxis(c, f.labels),
    yAxis: f.wordy ? nameAxis(c, f, subject, layout) : valueAxis(c, f.valueCol),
    series: [...(extra?.series ?? []), ...zero, ...series, ...(cmpSeries ? [cmpSeries] : [])],
  };
  const legend: LegendItem[] = [
    ...parts.map((s, si) => ({ label: s.name, color: colorOf(s, si), mark: (costly(s, si) ? 'hatch' : 'solid') as LegendItem['mark'] })),
    ...(cmp ? [{ label: cmp.name, color: cmp.color, mark: (f.wordy ? 'tick' : 'dashed') as LegendItem['mark'] }] : []),
    ...(extra?.legend ?? []),
  ];
  const lead = (extra?.series.length ?? 0) + zero.length;
  return {
    render: 'echarts',
    kind: 'stacked_bar',
    option,
    points: pointsOf(f, lead),
    legend: legend.length > 1 ? legend : [],
    note: droppedNote(f),
    ...(more ? { more } : {}),
    table: tableModel(c, specKeys(c.spec)),
    summary: describe(c, whole, diverging ? 'Bars above and below zero' : 'Stacked bar chart', hasCmp && cmp ? `${cmp.name} is shown for comparison.` : ''),
  };
}

export const buildStackedBar = (c: Ctx): Built => stackedBar(c);
export const buildGroupedBar = (c: Ctx): Built => multiBar(c, false);

/* ───────── Waterfall (the GOP bridge) ───────── */

export interface WaterfallStep {
  name: string;
  /** The row's own value: a level for totals, a change for steps. */
  value: number;
  start: number;
  end: number;
  type: 'total' | 'up' | 'down';
}

const TOTAL_KEYS = ['kind', 'type', 'step_kind', 'step_type', 'is_total'];

/**
 * Rows → floating bars. A row is a total when a `kind`/`type` column says so ("total", "start", "end", true);
 * without one, the first row is the opening total and the last row is the closing total when it equals the
 * opening plus the steps between.
 */
export function waterfallSteps(c: Ctx): WaterfallStep[] {
  const xKey = pickLabelKey(c, c.spec.x, c.spec.group);
  const yKey = pickValueKey(c);
  if (!xKey || !yKey) return [];
  const xCol = column(c, xKey);
  const rows = c.rows.map((r) => ({ r, v: numberAt(r, yKey) })).filter((x): x is { r: (typeof c.rows)[number]; v: number } => x.v !== null);
  const flagKey = TOTAL_KEYS.find((k) => rows.some((x) => x.r[k] !== undefined));
  const flagged = (r: (typeof c.rows)[number]) => {
    const v = flagKey ? r[flagKey] : undefined;
    return v === true || (typeof v === 'string' && /^(total|start|end|subtotal|opening|closing)$/i.test(v));
  };
  let isTotal: boolean[];
  if (flagKey) isTotal = rows.map((x) => flagged(x.r));
  else {
    const n = rows.length;
    const middle = rows.slice(1, -1).reduce((s, x) => s + x.v, 0);
    const closes = n >= 3 && Math.abs(rows[n - 1].v - (rows[0].v + middle)) <= Math.max(0.5, Math.abs(rows[n - 1].v) * 0.005);
    isTotal = rows.map((_, i) => i === 0 || (closes && i === n - 1));
  }
  let level = 0;
  return rows.map((x, i) => {
    const name = label(cell(x.r, xKey), xCol);
    if (isTotal[i]) {
      level = x.v;
      return { name, value: x.v, start: 0, end: x.v, type: 'total' as const };
    }
    const start = level;
    level += x.v;
    return { name, value: x.v, start, end: level, type: x.v >= 0 ? ('up' as const) : ('down' as const) };
  });
}

/**
 * Where the value axis of a bridge starts. When the steps are small next to the totals it starts a little under the
 * lowest running total (a round number), so a €20k step is not a hairline under a €1.4M bar; otherwise at zero.
 * Never a broken axis: the start is said once, as the axis' first tick.
 */
export function waterfallBase(steps: WaterfallStep[]): number {
  const levels = steps.flatMap((s) => (s.type === 'total' ? [s.end] : [s.start, s.end]));
  const lo = Math.min(...levels);
  const hi = Math.max(...levels);
  if (lo <= 0 || (hi - lo) / hi > 0.4) return Math.min(0, lo);
  // A round start (€500k, €1.15M), so it is also where the axis' ticks begin.
  const unit = 10 ** Math.floor(Math.log10(Math.max(1, hi - lo))) / 2;
  const base = Math.floor((lo - (hi - lo) * 0.35) / unit) * unit;
  return base > 0 ? base : 0;
}

/** A bridge narrower than this lies down: one row per step, so names stay whole and numbers never collide. */
export const WATERFALL_ROWS_BELOW = 560;
/** The pitch of a lying bridge: one row per step. */
const WATERFALL_ROW = 28;

/** "€886k" for a total; "+€8.4k" / "−€21.6k" for a step. */
function stepText(s: WaterfallStep, col: EvidenceColumn): string {
  // Compact from 1,000 up (€8.4k), as on an axis: a bridge's labels sit side by side.
  const amount = formatValue(Math.abs(s.value), col, { axis: true });
  return s.type === 'total' ? formatValue(s.value, col, { axis: true }) : `${s.value >= 0 ? '+' : '−'}${amount}`;
}

/** A category name in at most two lines of `chars` characters, ending in "…" when it is longer (the tooltip has it whole). */
function twoLines(name: string, chars: number): string {
  const words = name.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= chars) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const cut = (t: string) => (t.length > chars ? `${t.slice(0, Math.max(1, chars - 1))}…` : t);
  if (lines.length <= 2) return lines.map(cut).join('\n');
  const rest = lines.slice(1).join(' ');
  return [cut(lines[0]), `${rest.slice(0, Math.max(1, chars - 1))}…`].join('\n');
}

export function buildWaterfall(c: Ctx): Built {
  const steps = waterfallSteps(c);
  if (!steps.length) return empty(c, 'No steps to show.');
  const col = valueColumn(c, pickValueKey(c));
  const color = (s: WaterfallStep) => (s.type === 'total' ? c.t.series : s.type === 'up' ? c.t.pos : c.t.neg);
  const ink = (s: WaterfallStep) => (s.type === 'total' ? c.t.text : s.type === 'up' ? c.t.pos : c.t.neg);
  const texts = steps.map((s) => stepText(s, col));
  const base = waterfallBase(steps);
  const top = Math.max(...steps.map((s) => Math.max(s.start, s.end)));
  // The axis says where it starts once, as its first tick, when that is not zero.
  const baseTick = (v: number) => (base > 0 && Math.abs(v - base) < 1e-6 ? formatValue(v, col, { axis: true }) : '');
  const lying = c.width < WATERFALL_ROWS_BELOW;
  const tooltipOf = bandTip(c, (i) => {
    const s = steps[i];
    if (!s) return '';
    return s.type === 'total' ? tip(c, s.name, [{ label: col.label, value: formatValue(s.value, col) }]) : tip(c, s.name, [{ label: s.value >= 0 ? 'Adds' : 'Takes away', value: formatValue(Math.abs(s.value), col), color: color(s) }, { label: 'Running total', value: formatValue(s.end, col), muted: true }]);
  });
  const legend: LegendItem[] = [
    { label: 'Total', color: c.t.series, mark: 'solid' },
    ...(steps.some((s) => s.type === 'up') ? [{ label: '+ Adds', color: c.t.pos, mark: 'solid' as const }] : []),
    ...(steps.some((s) => s.type === 'down') ? [{ label: '− Takes away', color: c.t.neg, mark: 'solid' as const }] : []),
  ];
  const common = {
    render: 'echarts' as const,
    kind: 'waterfall' as const,
    points: steps.map((s, i) => ({ seriesIndex: 0, dataIndex: i, text: s.type === 'total' ? `${s.name}: ${formatValue(s.value, col)}` : `${s.name}: ${s.value >= 0 ? 'adds' : 'takes away'} ${formatValue(Math.abs(s.value), col)}, running total ${formatValue(s.end, col)}` })),
    legend,
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Waterfall chart with ${steps.length} steps${base > 0 ? `, its axis starting at ${formatValue(base, col, { compact: true })}` : ''}.`, steps.map((s) => (s.type === 'total' ? `${s.name} ${formatValue(s.value, col, { compact: true })}` : `${s.name} ${s.value >= 0 ? 'up' : 'down'} ${formatValue(Math.abs(s.value), col, { compact: true })}`)).join(', ') + '.'),
  };
  // [index, start, end]: each bar floats between the running totals.
  const data = steps.map((s, i) => [i, s.start, s.end]);
  /** A total stands on the axis' start; a step floats between its two levels. */
  const from = (s: WaterfallStep, v: number) => (s.type === 'total' ? Math.max(v, base) : v);

  if (lying) {
    const names = steps.map((s) => s.name);
    const nameW = nameWidth(c, names);
    const valueW = Math.max(...texts.map((t) => textWidth(t, 12))) + 10;
    const bar = c.compact ? 14 : 16;
    const plot = steps.length * WATERFALL_ROW;
    const bottom = base > 0 ? 20 : 4;
    const option = {
      ...baseOption(c),
      grid: { left: nameW + 12, right: valueW + 6, top: 2, height: plot, containLabel: false },
      tooltip: tooltipOf,
      yAxis: categoryAxis(c, names, {
        inverse: true,
        axisLine: { show: false },
        // The whole name, on two lines when it needs them; never turned.
        axisLabel: { color: c.t.text, fontSize: 12, fontFamily: c.t.font, width: nameW, overflow: 'break', lineHeight: 13, interval: 0, margin: 10 },
      }),
      xAxis: {
        type: 'value',
        min: base,
        max: top,
        splitNumber: 2,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: base > 0, color: c.t.muted, fontSize: 11, fontFamily: c.t.font, showMinLabel: true, showMaxLabel: false, formatter: baseTick },
      },
      series: [
        {
          type: 'custom',
          name: col.label,
          data,
          encode: { y: 0, x: [1, 2] },
          renderItem: (_params: unknown, api: WaterfallApi) => {
            const i = api.value(0);
            const s = steps[i];
            const a = api.coord([from(s, api.value(1)), i]);
            const b = api.coord([api.value(2), i]);
            const left = Math.min(a[0], b[0]);
            const right = Math.max(a[0], b[0]);
            const y = a[1];
            const children: unknown[] = [
              { type: 'rect', shape: { x: left, y: y - bar / 2, width: Math.max(right - left, 1.5), height: bar, r: markRadius(c.t, 3) }, style: { fill: color(s) } },
              { type: 'text', style: { text: texts[i], x: right + 6, y, textAlign: 'left', textVerticalAlign: 'middle', fill: ink(s), fontSize: 12, fontFamily: c.t.font, fontWeight: s.type === 'total' ? 600 : 500 } },
            ];
            const next = steps[i + 1];
            if (next) {
              // A thin connector from where this step ends to the next row.
              const x = b[0];
              children.push({ type: 'line', shape: { x1: x, y1: y + bar / 2, x2: x, y2: y + WATERFALL_ROW - bar / 2 }, style: { stroke: c.t.muted, lineWidth: 1, opacity: 0.5 } });
            }
            return { type: 'group', children };
          },
        },
      ],
    };
    // Its own height: a row per step, the legend above, the axis' start under it.
    return { ...common, option, height: 25 + 2 + plot + bottom + 4 };
  }

  const slot = (c.width - 60) / steps.length;
  const chars = Math.max(4, Math.floor((slot - 4) / (11.5 * 0.53)));
  const valueSize = Math.max(...texts.map((t) => t.length)) * 11.5 * 0.55 <= slot ? 11.5 : 10.5;
  const option = {
    ...baseOption(c),
    grid: { left: 8, right: 12, top: 24, bottom: 4, containLabel: true },
    tooltip: tooltipOf,
    // Names stay level: two lines at most, shortened with "…" past that (the tooltip has them whole).
    xAxis: categoryAxis(c, steps.map((s) => s.name), { axisLabel: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, interval: 0, lineHeight: 14, formatter: (name: string) => twoLines(name, chars) } }),
    yAxis: valueAxis(c, col, { scale: false, min: base, axisLabel: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, formatter: (v: number) => formatValue(v, col, { axis: true }) } }),
    series: [
      {
        type: 'custom',
        name: col.label,
        data,
        encode: { x: 0, y: [1, 2] },
        renderItem: (_params: unknown, api: WaterfallApi) => {
          const i = api.value(0);
          const s = steps[i];
          const a = api.coord([i, from(s, api.value(1))]);
          const b = api.coord([i, api.value(2)]);
          const w = Math.min(api.size([1, 0])[0] * 0.58, 44);
          const y0 = Math.min(a[1], b[1]);
          const h = Math.max(Math.abs(a[1] - b[1]), 1.5);
          const next = steps[i + 1];
          const children: unknown[] = [
            { type: 'rect', shape: { x: a[0] - w / 2, y: y0, width: w, height: h, r: 3 }, style: { fill: color(s) } },
            { type: 'text', style: { text: texts[i], x: a[0], y: y0 - 6, textAlign: 'center', textVerticalAlign: 'bottom', fill: ink(s), fontSize: valueSize, fontFamily: c.t.font, fontWeight: s.type === 'total' ? 600 : 500 } },
          ];
          if (next) {
            const nx = api.coord([i + 1, 0])[0];
            children.push({ type: 'line', shape: { x1: a[0] + w / 2, y1: b[1], x2: nx - w / 2, y2: b[1] }, style: { stroke: c.t.muted, lineWidth: 1, opacity: 0.45 } });
          }
          return { type: 'group', children };
        },
      },
    ],
  };
  // A real plot: a host that asks for less than this gets this.
  return { ...common, option, ...(c.height < 240 ? { height: 240 } : {}) };
}

interface WaterfallApi {
  value(dim: number): number;
  coord(point: [number, number]): [number, number];
  size(span: [number, number]): [number, number];
}

/* ───────── Bullet (actual against target) ───────── */

export function buildBullet(c: Ctx): Built {
  if (c.spec.target) return budgetBullet(c);
  const xKey = pickLabelKey(c, c.spec.x, c.spec.group);
  const yKey = pickValueKey(c);
  if (!xKey || !yKey || !c.rows.length) return empty(c, 'No data for this period.');
  const xCol = column(c, xKey);
  const col = valueColumn(c, yKey);
  const targetCol = c.spec.compare ? valueColumn(c, c.spec.compare) : null;
  const allNames = c.rows.map((r) => label(cell(r, xKey), xCol));
  const allFull = c.rows.map((r) => label(cell(r, xKey), xCol, 'full'));
  const allActual = c.rows.map((r) => numberAt(r, yKey));
  const allTarget = c.rows.map((r) => (targetCol ? numberAt(r, c.spec.compare) : null));
  const subjectAll = subjectsOf(c.spec.title, allNames, allFull);
  // Against a target the list ranks by how far each row is from it; otherwise by the value.
  const gap = allActual.map((v, i) => (v === null || allTarget[i] === null ? null : col.kind === 'percent' || !allTarget[i] ? v - allTarget[i]! : (v - allTarget[i]!) / Math.abs(allTarget[i]!)));
  const { order, more } = rank(c.spec.title, allNames, targetCol ? gap : allActual, subjectAll, rowLimit(c, 1, !!targetCol));
  const at = <T>(xs: readonly T[]) => order.map((i) => xs[i]);
  const names = at(allNames);
  const full = at(allFull);
  const actual = at(allActual);
  const target = at(allTarget);
  const subject = at(subjectAll);
  const lit = subject.some(Boolean);
  const layout = rowLayout(c, names.length, more > 0, 1, !!targetCol);
  const max = Math.max(...actual.map((v) => v ?? 0), ...target.map((v) => v ?? 0)) * 1.04 || 1;
  const deltas = actual.map((v, i) => (targetCol ? formatDelta(v, target[i], col.kind, col.unit, lowerIsBetter(col)) : null));
  const showDelta = !!targetCol && !c.narrow;
  const nameW = nameWidth(c, names);
  const valueW = Math.max(...actual.map((v) => textWidth(fmt(v, col, true), 12))) + 4;
  const deltaW = showDelta ? Math.max(...deltas.map((d) => (d ? textWidth(d.text, 11.5) : 0))) + 10 : 0;
  const ink = (i: number) => (!lit || subject[i] ? c.t.text : c.t.muted);
  const option = {
    ...baseOption(c),
    grid: { left: nameW + 12, right: valueW + deltaW + 12, top: 4, height: layout.plot, containLabel: false },
    tooltip: bandTip(c, (i) => {
      const d = deltas[i];
      const rowsTip: TipRow[] = [{ label: col.label, value: fmt(actual[i], col), color: c.t.series }];
      if (targetCol) rowsTip.push({ label: targetCol.label, value: fmt(target[i], targetCol), color: c.t.cmp });
      return tip(c, full[i] ?? '', rowsTip, d && targetCol ? `${d.text} vs ${targetCol.label.toLowerCase()}` : undefined);
    }),
    xAxis: hiddenValueAxis(c, col, { min: 0, max }),
    yAxis: [
      categoryAxis(c, names, {
        inverse: true,
        axisLine: { show: false },
        axisLabel: { color: (_: string, i: number) => ink(i), fontSize: 12, fontFamily: c.t.font, width: nameW, overflow: layout.pitch >= 28 ? 'break' : 'truncate', lineHeight: 13, interval: 0, margin: 10 },
      }),
      // The value and its gap to the target sit right after the track, in a column of their own, so a target mark never runs into a number.
      categoryAxis(c, names, {
        inverse: true,
        position: 'right',
        axisLine: { show: false },
        axisLabel: {
          interval: 0,
          margin: 8,
          fontFamily: c.t.font,
          formatter: (_: string, i: number) => {
            const d = deltas[i];
            const value = `{${!lit || subject[i] ? 'v' : 'm'}|${fmt(actual[i], col, true)}}`;
            return d && showDelta ? `${value}{${d.tone}|${d.text}}` : value;
          },
          rich: {
            v: { color: c.t.text, fontSize: 12, fontWeight: 500, fontFamily: c.t.font, width: valueW, align: 'right' },
            m: { color: c.t.muted, fontSize: 12, fontWeight: 400, fontFamily: c.t.font, width: valueW, align: 'right' },
            good: { color: c.t.pos, fontSize: 11.5, fontFamily: c.t.font, width: deltaW, align: 'right' },
            bad: { color: c.t.neg, fontSize: 11.5, fontFamily: c.t.font, width: deltaW, align: 'right' },
            flat: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, width: deltaW, align: 'right' },
          },
        },
      }),
    ],
    series: [
      {
        type: 'bar',
        name: col.label,
        barWidth: Math.min(layout.bar, 12),
        showBackground: true,
        backgroundStyle: { color: c.t.grid, borderRadius: markRadius(c.t, 3) },
        data: actual.map((v, i) => ({ value: v, itemStyle: { color: c.t.series, opacity: !lit || subject[i] ? 1 : MUTED, borderRadius: markRadius(c.t, 3) } })),
        emphasis: { itemStyle: { opacity: 1 } },
      },
      ...(targetCol ? [{ type: 'scatter', name: targetCol.label, data: target, symbol: 'rect', symbolSize: [2.5, Math.min(layout.bar, 12) + 8], itemStyle: { color: c.t.cmp, borderColor: c.t.surface, borderWidth: 1 }, emphasis: { scale: false }, z: 3 }] : []),
    ],
  };
  return {
    render: 'echarts',
    kind: 'bullet',
    option,
    points: names.map((_, i) => ({ seriesIndex: 0, dataIndex: i, text: `${full[i]}: ${fmt(actual[i], col)}${targetCol ? `, ${targetCol.label.toLowerCase()} ${fmt(target[i], targetCol)}${deltas[i] ? `, ${deltas[i]!.spoken}` : ''}` : ''}` })),
    legend: targetCol ? [{ label: col.label, color: c.t.series, mark: 'solid' }, { label: targetCol.label, color: c.t.cmp, mark: 'tick' }] : [],
    ...(more ? { more } : {}),
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Bullet chart: ${col.label}${targetCol ? ` against ${targetCol.label}` : ''} for ${allNames.length} rows.`, extremes(allFull.map((name, i) => ({ name, value: allActual[i], text: fmt(allActual[i], col) })))),
  };
}

/** A row that sums the others ("Group total", "Selection total"): first, and in bold. */
const TOTAL_ROW = /\btotal$/i;

/**
 * Bullets against each row's own target (budget): every row as % of its target, so a small hotel and a large one
 * share one scale and 100% is one line. The actual is solid; the forecast still to come is hatched on from it; last
 * year (`compare`) is a tick. Worst first, the total on top. Beside each row: the amount, the gap to last year and
 * the share of the target ("€368k · +€42k vs last year · 63% of budget"), shortened to "63%" on a phone.
 */
function budgetBullet(c: Ctx): Built {
  const xKey = pickLabelKey(c, c.spec.x, c.spec.group);
  const yKey = c.spec.y?.[0] ?? pickValueKey(c);
  if (!xKey || !yKey || !c.spec.target || !c.rows.length) return empty(c, 'No data for this period.');
  const xCol = column(c, xKey);
  const col = valueColumn(c, yKey);
  const tCol = valueColumn(c, c.spec.target);
  const fCol = c.spec.forecast ? valueColumn(c, c.spec.forecast) : null;
  const lyCol = c.spec.compare ? valueColumn(c, c.spec.compare) : null;
  const all = c.rows.map((r) => {
    const target = numberAt(r, c.spec.target);
    const pct = (v: number | null) => (v === null || !target ? null : (v / target) * 100);
    const actual = numberAt(r, yKey);
    const forecast = fCol ? numberAt(r, c.spec.forecast) : null;
    const ly = lyCol ? numberAt(r, c.spec.compare) : null;
    return { name: label(cell(r, xKey), xCol), full: label(cell(r, xKey), xCol, 'full'), actual, target, forecast, ly, pa: pct(actual), pf: pct(forecast), pl: pct(ly) };
  });
  const lands = (r: (typeof all)[number]) => r.pf ?? r.pa ?? Infinity;
  const sorted = [...all.keys()].sort((a, b) => Number(TOTAL_ROW.test(all[b].name)) - Number(TOTAL_ROW.test(all[a].name)) || lands(all[a]) - lands(all[b]) || a - b);
  const limit = rowLimit(c, 1, true);
  const order = sorted.slice(0, limit);
  const more = all.length - order.length;
  const rows = order.map((i) => all[i]);
  const layout = rowLayout(c, rows.length, more > 0, 1, true);
  const max = Math.max(120, ...rows.flatMap((r) => [r.pa, r.pf, r.pl]).filter((v): v is number => v !== null).map((v) => Math.ceil(v / 10) * 10 + 4));
  const wide = c.width >= 720;
  const lyWord = lyCol ? `vs ${lyCol.label.replace(/^./, (m) => m.toLowerCase())}` : '';
  const tWord = tCol.label.toLowerCase();
  const signed = (d: number) => `${d < 0 ? '−' : '+'}${formatValue(Math.abs(d), col, { compact: true })}`;
  const sideText = (r: (typeof rows)[number]) => {
    const pct = r.pa === null ? '–' : `${Math.round(r.pa)}%`;
    if (c.narrow) return pct;
    const parts = [fmt(r.actual, col, true)];
    if (wide && r.ly !== null && r.actual !== null) parts.push(`${signed(r.actual - r.ly)} ${lyWord}`);
    parts.push(`${pct} of ${tWord}`);
    return parts.join(' · ');
  };
  const texts = rows.map(sideText);
  const sideW = Math.max(...texts.map((t) => textWidth(t, 12))) + 8;
  const names = rows.map((r) => r.name);
  const nameW = nameWidth(c, names);
  const barW = Math.min(layout.bar, 12);
  const option = {
    ...baseOption(c),
    grid: { left: nameW + 12, right: sideW + 12, top: 4, height: layout.plot, containLabel: false },
    tooltip: bandTip(c, (i) => {
      const r = rows[i];
      const pct = (v: number | null) => (v === null ? '' : ` (${Math.round(v)}%)`);
      const tipRows: TipRow[] = [
        { label: col.label, value: `${fmt(r.actual, col)}${pct(r.pa)}`, color: c.t.series },
        ...(fCol && r.forecast !== null ? [{ label: fCol.label, value: `${fmt(r.forecast, fCol)}${pct(r.pf)}`, color: c.t.series, dashed: true }] : []),
        ...(lyCol && r.ly !== null ? [{ label: lyCol.label, value: fmt(r.ly, lyCol), color: c.t.cmp }] : []),
        { label: tCol.label, value: fmt(r.target, tCol), color: c.t.ref },
      ];
      return tip(c, r.full, tipRows);
    }),
    xAxis: hiddenValueAxis(c, { key: 'pct', label: '%', kind: 'percent' }, { min: 0, max }),
    yAxis: [
      categoryAxis(c, names, {
        inverse: true,
        axisLine: { show: false },
        axisLabel: {
          fontSize: 12,
          fontFamily: c.t.font,
          width: nameW,
          overflow: 'truncate',
          interval: 0,
          margin: 10,
          formatter: (n: string) => (TOTAL_ROW.test(n) ? `{b|${n}}` : n),
          color: c.t.text,
          rich: { b: { fontWeight: 600, color: c.t.text, fontSize: 12, fontFamily: c.t.font } },
        },
      }),
      categoryAxis(c, texts, { inverse: true, position: 'right', axisLine: { show: false }, axisLabel: { interval: 0, margin: 8, color: c.t.muted, fontSize: 12, fontFamily: c.t.font, align: 'left' } }),
    ],
    series: [
      {
        type: 'bar',
        name: col.label,
        stack: 'pos',
        barWidth: barW,
        showBackground: true,
        backgroundStyle: { color: c.t.grid, borderRadius: markRadius(c.t, 3) },
        data: rows.map((r) => r.pa),
        itemStyle: { color: c.t.series, borderRadius: markRadius(c.t, 2) },
        emphasis: { disabled: true },
        z: 3,
      },
      ...(fCol
        ? [
            {
              type: 'bar',
              name: fCol.label,
              stack: 'pos',
              barWidth: barW,
              data: rows.map((r) => (r.pf === null || r.pa === null ? null : Math.max(0, r.pf - r.pa))),
              itemStyle: { color: hatch(c.t.series, mix(c.t.series, c.t.surface, 0.12)), borderColor: c.t.series, borderWidth: 1, borderRadius: markRadius(c.t, 2) },
              emphasis: { disabled: true },
              // Above the track, which is drawn with the first series and may be opaque in a theme.
              z: 4,
            },
          ]
        : []),
      ...(lyCol ? [{ type: 'scatter', name: lyCol.label, data: rows.map((r) => r.pl), symbol: 'rect', symbolSize: [2.5, barW + 8], itemStyle: { color: c.t.cmp, borderColor: c.t.surface, borderWidth: 1 }, emphasis: { scale: false }, z: 5 }] : []),
      { type: 'line', name: tCol.label, data: [], silent: true, tooltip: { show: false }, markLine: { silent: true, symbol: 'none', animation: false, label: { show: false }, lineStyle: { color: c.t.ref, width: 1.5, type: 'solid' }, data: [{ xAxis: 100 }] } },
    ],
  };
  const legend: LegendItem[] = [
    { label: col.label, color: c.t.series, mark: 'solid' },
    ...(fCol ? [{ label: `${fCol.label}, still to come`, color: c.t.series, mark: 'hatch' as const }] : []),
    ...(lyCol ? [{ label: lyCol.label, color: c.t.cmp, mark: 'tick' as const }] : []),
    { label: `${tCol.label} = 100%`, color: c.t.ref, mark: 'rule' },
  ];
  const missed = all.filter((r) => !TOTAL_ROW.test(r.name) && lands(r) < 100).length;
  return {
    render: 'echarts',
    kind: 'bullet',
    option,
    points: rows.map((r, i) => ({ seriesIndex: 0, dataIndex: i, text: `${r.full}: ${texts[i] === `${Math.round(r.pa ?? 0)}%` ? `${fmt(r.actual, col)}, ${texts[i]} of ${tWord}` : texts[i]}${r.pf !== null ? `; ${fCol!.label.toLowerCase()} ${Math.round(r.pf)}%` : ''}` })),
    rows: order,
    legend,
    ...(more ? { more } : {}),
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Bullet chart: ${col.label} as a share of ${tWord} for ${all.length} rows.`, `${missed} of ${all.filter((r) => !TOTAL_ROW.test(r.name)).length} below 100%.`),
  };
}

export { num };
