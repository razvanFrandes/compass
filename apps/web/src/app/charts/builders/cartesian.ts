import { formatDelta, formatValue, isNumericKind, lowerIsBetter, num } from '../format';
import { catColor, markRadius } from '../tokens';
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
  valueAxis,
  valueColumn,
} from './shared';

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
      series: shown.map((g, i) => ({ name: g, values: xs.map((x) => at.get(`${x}¦${g}`) ?? null), color: catColor(c.t, i, g), role: 'main', col: valueCol })),
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

function pointsOf(f: Frame): PointRef[] {
  return f.labels.map((_, i) => ({
    seriesIndex: 0,
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
  // Name the series on the line ends when they fit; otherwise the legend carries them.
  const direct = !c.narrow && f.series.length <= 4;
  const endText = (s: Series) => (multi ? s.name : formatValue(lastValue(s.values), s.col, { compact: true }));
  const right = direct ? Math.min(150, Math.max(...f.series.map((s) => textWidth(endText(s), 12)))) + 4 : 12;
  const option = {
    ...baseOption(c),
    grid: { left: 8, right, top: 14, bottom: 4, containLabel: true },
    tooltip: tooltip(c, { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: c.t.muted, width: 1, opacity: 0.5 } }, formatter: axisTip(c, f) }),
    xAxis: categoryAxis(c, f.labels, { boundaryGap: false }),
    // An area encodes magnitude, so it starts at zero; a line may zoom to its range.
    yAxis: valueAxis(c, f.valueCol, { scale: !area }),
    series: f.series.map((s) => ({
      type: 'line',
      name: s.name,
      data: s.values,
      connectNulls: false,
      symbol: 'circle',
      symbolSize: 8,
      showSymbol: f.labels.length === 1,
      z: s.role === 'compare' ? 1 : 2,
      lineStyle: { color: s.color, width: 2, type: s.role === 'compare' ? [...c.t.cmpDash] : 'solid', cap: 'round', join: 'round' },
      itemStyle: { color: s.color, borderColor: c.t.surface, borderWidth: 2 },
      emphasis: { focus: 'none', scale: false, lineStyle: { width: 2 } },
      areaStyle: area && s.role === 'main' ? { color: s.color, opacity: multi ? 0.1 : 0.14 } : undefined,
      endLabel: direct ? { show: true, formatter: () => endText(s), color: s.role === 'compare' ? c.t.muted : c.t.text, fontSize: 12, fontWeight: multi ? 500 : 600, fontFamily: c.t.font, distance: 8 } : undefined,
      labelLayout: direct ? { moveOverlap: 'shiftY' } : undefined,
    })),
  };
  return {
    render: 'echarts',
    kind: area ? 'area' : 'line',
    option,
    points: pointsOf(f),
    legend: direct ? [] : legendOf(f, (s) => (s.role === 'compare' ? 'dashed' : 'line')),
    note: droppedNote(f),
    table: tableModel(c, specKeys(c.spec)),
    summary: describe(c, f, area ? 'Area chart' : 'Line chart', trend(f.series[0])),
  };
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

/** How many horizontal bars fit the body before the rest moves to the table. */
const maxRows = (c: Ctx, perRow = 15) => Math.max(4, Math.floor((c.height - 24) / perRow));

function clip(c: Ctx, f: Frame, limit: number): { f: Frame; note?: string } {
  if (f.labels.length <= limit) return { f };
  const cut = (xs: readonly string[]) => xs.slice(0, limit);
  return {
    f: { ...f, labels: cut(f.labels), full: cut(f.full), series: f.series.map((s) => ({ ...s, values: s.values.slice(0, limit) })) },
    note: `Showing the first ${limit} of ${f.labels.length}. “View as table” has them all.`,
  };
}

/** The room the category names of horizontal bars get: what they need, up to a share of the width. */
export function nameWidth(c: Ctx, names: string[]): number {
  return Math.min(Math.max(...names.map((l) => textWidth(l, 12))) + 6, Math.round(c.width * (c.narrow ? 0.36 : 0.3)));
}

/** Category names on the left of horizontal bars, truncated with an ellipsis to the room they have. */
function nameAxis(c: Ctx, f: Frame) {
  return categoryAxis(c, f.labels, {
    inverse: true,
    axisLine: { show: false },
    axisLabel: { color: c.t.text, fontSize: 12, fontFamily: c.t.font, width: nameWidth(c, f.labels), overflow: 'truncate', interval: 0, margin: 10 },
  });
}

/** The plot area of horizontal bars, with the name and value columns reserved explicitly (names never slide under bars). */
function rowsGrid(c: Ctx, names: string[], right: number, bottom = 4) {
  return { left: nameWidth(c, names) + 12, right, top: 4, bottom, containLabel: false };
}

/** A right-hand column of values for horizontal bars: right-aligned, in tabular figures. */
function valuesAxis(c: Ctx, f: Frame, s: Series) {
  return categoryAxis(c, f.labels, {
    inverse: true,
    position: 'right',
    axisLine: { show: false },
    axisLabel: { interval: 0, margin: 10, color: c.t.text, fontSize: 12, fontFamily: c.t.font, formatter: (_: string, i: number) => fmt(s.values[i], s.col, true) },
  });
}

const hiddenValueAxis = (c: Ctx, col: EvidenceColumn, extra: Record<string, unknown> = {}) => valueAxis(c, col, { axisLabel: { show: false }, splitLine: { show: false }, ...extra });

export function buildBar(c: Ctx, note?: string): Built {
  const whole = frame(c);
  if (!whole) return empty(c, 'No data for this period.');
  const { f, note: clipped } = whole.wordy ? clip(c, whole, maxRows(c)) : { f: whole, note: undefined };
  const main = f.series[0];
  const cmp = f.series.find((s) => s.role === 'compare');
  const tipFmt = (p: unknown) => tipAt(c, f, (p as { dataIndex: number }).dataIndex);
  const valueLabels = f.wordy || f.labels.length <= (c.narrow ? 8 : 14);
  const longest = Math.max(...main.values.map((v) => textWidth(fmt(v, main.col, true), 12)));
  // With a comparison tick on the bar, the values move to their own column so a tick never crosses a number.
  const column = f.wordy && !!cmp;
  const bar = {
    type: 'bar',
    name: main.name,
    data: main.values,
    barMaxWidth: 20,
    barMinHeight: 1,
    itemStyle: { color: main.color, borderRadius: markRadius(c.t, f.wordy ? [0, 4, 4, 0] : [4, 4, 0, 0]) },
    emphasis: { itemStyle: { color: main.color, opacity: 0.85 } },
    label: valueLabels && !column ? { show: true, position: f.wordy ? 'right' : 'top', distance: 6, color: c.t.text, fontSize: 12, fontFamily: c.t.font, formatter: (p: { dataIndex: number }) => fmt(main.values[p.dataIndex], main.col, true) } : undefined,
    labelLayout: f.wordy ? undefined : { hideOverlap: true },
  };
  // The comparison rides on each bar as a purple tick, so the bar itself stays the one thing to read.
  const tick = cmp
    ? { type: 'scatter', name: cmp.name, data: cmp.values, symbol: 'rect', symbolSize: f.wordy ? [3, 18] : [18, 3], itemStyle: { color: cmp.color, borderColor: c.t.surface, borderWidth: 1 }, emphasis: { scale: false }, z: 3 }
    : null;
  const option = {
    ...baseOption(c),
    tooltip: tooltip(c, { trigger: 'item', formatter: tipFmt }),
    grid: f.wordy ? rowsGrid(c, f.labels, longest + 16) : { left: 8, right: 12, top: valueLabels ? 22 : 12, bottom: 4, containLabel: true },
    xAxis: f.wordy ? hiddenValueAxis(c, f.valueCol) : categoryAxis(c, f.labels),
    yAxis: f.wordy ? (column ? [nameAxis(c, f), valuesAxis(c, f, main)] : nameAxis(c, f)) : valueAxis(c, f.valueCol, valueLabels ? { axisLabel: { show: false }, splitLine: { show: false } } : {}),
    series: tick ? [bar, tick] : [bar],
  };
  return {
    render: 'echarts',
    kind: 'bar',
    option,
    points: pointsOf(f),
    legend: cmp ? [{ label: main.name, color: main.color, mark: 'solid' }, { label: cmp.name, color: cmp.color, mark: 'tick' }] : [],
    note: [note, clipped].filter(Boolean).join(' ') || undefined,
    table: tableModel(c, specKeys(c.spec)),
    summary: describe(c, f, 'Bar chart'),
  };
}

function multiBar(c: Ctx, stacked: boolean): Built {
  const whole = frame(c);
  if (!whole) return empty(c, 'No data for this period.');
  const perRow = stacked ? 15 : 12 + whole.series.length * 7;
  const { f, note: clipped } = whole.wordy ? clip(c, whole, maxRows(c, perRow)) : { f: whole, note: undefined };
  const totals = f.labels.map((_, i) => f.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const few = f.labels.length * (stacked ? 1 : f.series.length) <= (c.narrow ? 8 : 14);
  const hasCompare = f.series.some((s) => s.role === 'compare');
  // Upright bars side by side leave no room for a number that a taller neighbour would not run into.
  const showLabels = stacked ? f.wordy || few : f.wordy ? f.series.length <= 3 : few && !hasCompare;
  // Side by side, only the series the chart is about carries numbers; a comparison is read against it.
  const labelled = (s: Series, si: number) => (stacked ? si === f.series.length - 1 : !hasCompare || s.role === 'main');
  const longest = Math.max(...(stacked ? totals : f.series.flatMap((s) => s.values)).map((v) => textWidth(fmt(v, f.valueCol, true), 12)));
  const series = f.series.map((s, si) => ({
    type: 'bar',
    name: s.name,
    data: s.values,
    stack: stacked ? 'total' : undefined,
    barMaxWidth: stacked ? 20 : 14,
    barGap: stacked ? undefined : '12%',
    barCategoryGap: stacked ? '38%' : '30%',
    // A 2 px gap in the surface colour separates the parts of a stack; no outlines.
    itemStyle: stacked ? { color: s.color, borderColor: c.t.surface, borderWidth: 1, borderRadius: markRadius(c.t, 2) } : { color: s.color, borderRadius: markRadius(c.t, f.wordy ? [0, 3, 3, 0] : [3, 3, 0, 0]) },
    emphasis: { focus: 'series', blurScope: 'coordinateSystem' },
    blur: { itemStyle: { opacity: 0.35 } },
    label:
      showLabels && labelled(s, si)
        ? {
            show: true,
            position: f.wordy ? 'right' : 'top',
            distance: 6,
            color: stacked || s.role === 'main' ? c.t.text : c.t.muted,
            fontSize: stacked ? 12 : 11.5,
            fontFamily: c.t.font,
            formatter: (p: { dataIndex: number }) => fmt(stacked ? totals[p.dataIndex] : s.values[p.dataIndex], s.col, true),
          }
        : undefined,
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
    grid: f.wordy ? rowsGrid(c, f.labels, showLabels ? longest + 16 : 14, showLabels ? 4 : 24) : { left: 8, right: 12, top: showLabels ? 22 : 12, bottom: 4, containLabel: true },
    xAxis: f.wordy ? (showLabels ? hiddenValueAxis(c, f.valueCol) : valueAxis(c, f.valueCol)) : categoryAxis(c, f.labels),
    yAxis: f.wordy ? nameAxis(c, f) : valueAxis(c, f.valueCol),
    series,
  };
  return {
    render: 'echarts',
    kind: stacked ? 'stacked_bar' : 'grouped_bar',
    option,
    points: pointsOf(f),
    legend: legendOf(f, () => 'solid'),
    note: [droppedNote(f), clipped].filter(Boolean).join(' ') || undefined,
    table: tableModel(c, specKeys(c.spec)),
    summary: describe(c, f, stacked ? 'Stacked bar chart' : 'Grouped bar chart'),
  };
}

export const buildStackedBar = (c: Ctx): Built => multiBar(c, true);
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
 * When the steps are small next to the totals, most of the axis is cut out (and drawn as a break across the
 * totals), so a €20k step is not a hairline under a €1.4M bar.
 */
export function waterfallBreak(steps: WaterfallStep[]): { start: number; end: number } | null {
  const levels = steps.flatMap((s) => (s.type === 'total' ? [s.end] : [s.start, s.end]));
  const lo = Math.min(...levels);
  const hi = Math.max(...levels);
  if (lo <= 0 || (hi - lo) / hi > 0.4) return null;
  const unit = 10 ** Math.floor(Math.log10(Math.max(1, lo / 4)));
  const start = Math.round((lo * 0.08) / unit) * unit;
  const end = Math.floor((lo - (hi - lo) * 0.35) / unit) * unit;
  return end > start ? { start, end } : null;
}

export function buildWaterfall(c: Ctx): Built {
  const steps = waterfallSteps(c);
  if (!steps.length) return empty(c, 'No steps to show.');
  const col = valueColumn(c, pickValueKey(c));
  const color = (s: WaterfallStep) => (s.type === 'total' ? c.t.series : s.type === 'up' ? c.t.pos : c.t.neg);
  const text = (s: WaterfallStep) => (s.type === 'total' ? formatValue(s.value, col, { compact: true }) : `${s.value >= 0 ? '▲' : '▼'} ${formatValue(Math.abs(s.value), col, { compact: true })}`);
  const slot = (c.width - 60) / steps.length;
  // On a phone there is no room for a number on every step: the totals and the biggest step keep theirs.
  const tight = slot < 58;
  const biggest = steps.reduce((best, s, i) => (s.type !== 'total' && Math.abs(s.value) > Math.abs(steps[best]?.type === 'total' ? 0 : (steps[best]?.value ?? 0)) ? i : best), steps.findIndex((s) => s.type !== 'total'));
  const labelled = (s: WaterfallStep, i: number) => !tight || s.type === 'total' || i === biggest;
  const brk = waterfallBreak(steps);
  const option = {
    ...baseOption(c),
    grid: { left: 8, right: 12, top: 24, bottom: 4, containLabel: true },
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (p: unknown) => {
        const s = steps[(p as { dataIndex: number }).dataIndex];
        if (!s) return '';
        return s.type === 'total' ? tip(c, s.name, [{ label: col.label, value: formatValue(s.value, col) }]) : tip(c, s.name, [{ label: s.value >= 0 ? 'Adds' : 'Takes away', value: formatValue(Math.abs(s.value), col), color: color(s) }, { label: 'Running total', value: formatValue(s.end, col), muted: true }]);
      },
    }),
    xAxis: categoryAxis(c, steps.map((s) => s.name), { axisLabel: tight ? { color: c.t.muted, fontSize: 11, fontFamily: c.t.font, interval: 0, rotate: 40, width: 76, overflow: 'truncate' } : { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, interval: 0, width: Math.max(40, slot - 6), overflow: 'break', lineHeight: 14 } }),
    yAxis: valueAxis(
      c,
      col,
      brk
        ? {
            scale: false,
            breaks: [{ ...brk, gap: '5%' }],
            breakArea: { itemStyle: { color: c.t.surface, borderColor: c.t.border, borderWidth: 1, borderType: 'solid', opacity: 1 }, zigzagAmplitude: 3 },
            // Below the break only zero is labelled; a tick squeezed against the break would read as part of it.
            axisLabel: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, formatter: (v: number) => (v > 0 && v <= brk.end ? '' : formatValue(v, col, { axis: true })) },
          }
        : { scale: false },
    ),
    series: [
      {
        type: 'custom',
        name: col.label,
        // [index, start, end]: the bar floats between the running totals.
        data: steps.map((s, i) => [i, s.start, s.end]),
        encode: { x: 0, y: [1, 2] },
        renderItem: (_params: unknown, api: WaterfallApi) => {
          const i = api.value(0);
          const s = steps[i];
          const a = api.coord([i, api.value(1)]);
          const b = api.coord([i, api.value(2)]);
          const w = Math.min(api.size([1, 0])[0] * 0.58, 44);
          const top = Math.min(a[1], b[1]);
          const h = Math.max(Math.abs(a[1] - b[1]), 1.5);
          const next = steps[i + 1];
          const children: unknown[] = [
            { type: 'rect', shape: { x: a[0] - w / 2, y: top, width: w, height: h, r: 3 }, style: { fill: color(s) } },
            { type: 'text', invisible: !labelled(s, i), style: { text: text(s), x: a[0], y: top - 6, textAlign: 'center', textVerticalAlign: 'bottom', fill: c.t.text, fontSize: slot < 62 ? 10.5 : 11.5, fontFamily: c.t.font, fontWeight: s.type === 'total' ? 600 : 500 } },
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
  const table = tableModel(c, specKeys(c.spec));
  return {
    render: 'echarts',
    kind: 'waterfall',
    option,
    points: steps.map((s, i) => ({ seriesIndex: 0, dataIndex: i, text: s.type === 'total' ? `${s.name}: ${formatValue(s.value, col)}` : `${s.name}: ${s.value >= 0 ? 'adds' : 'takes away'} ${formatValue(Math.abs(s.value), col)}, running total ${formatValue(s.end, col)}` })),
    legend: [
      { label: 'Total', color: c.t.series, mark: 'solid' },
      ...(steps.some((s) => s.type === 'up') ? [{ label: '▲ Adds', color: c.t.pos, mark: 'solid' as const }] : []),
      ...(steps.some((s) => s.type === 'down') ? [{ label: '▼ Takes away', color: c.t.neg, mark: 'solid' as const }] : []),
    ],
    note: brk ? `The axis is broken between ${formatValue(brk.start, col, { compact: true })} and ${formatValue(brk.end, col, { compact: true })} so the steps are readable.` : undefined,
    table,
    summary: summary(c, `Waterfall chart with ${steps.length} steps.`, steps.map((s) => `${s.name} ${text(s).replace('▲', 'up').replace('▼', 'down')}`).join(', ') + '.'),
  };
}

interface WaterfallApi {
  value(dim: number): number;
  coord(point: [number, number]): [number, number];
  size(span: [number, number]): [number, number];
}

/* ───────── Bullet (actual against target) ───────── */

export function buildBullet(c: Ctx): Built {
  const xKey = pickLabelKey(c, c.spec.x, c.spec.group);
  const yKey = pickValueKey(c);
  if (!xKey || !yKey || !c.rows.length) return empty(c, 'No data for this period.');
  const xCol = column(c, xKey);
  const col = valueColumn(c, yKey);
  const targetCol = c.spec.compare ? valueColumn(c, c.spec.compare) : null;
  const limit = maxRows(c, 26);
  const rows = c.rows.slice(0, limit);
  const names = rows.map((r) => label(cell(r, xKey), xCol));
  const actual = rows.map((r) => numberAt(r, yKey));
  const target = rows.map((r) => (targetCol ? numberAt(r, c.spec.compare) : null));
  const max = Math.max(...actual.map((v) => v ?? 0), ...target.map((v) => v ?? 0)) * 1.04 || 1;
  const deltas = rows.map((_, i) => (targetCol ? formatDelta(actual[i], target[i], col.kind, col.unit, lowerIsBetter(col)) : null));
  const nameW = nameWidth(c, names);
  const valueW = Math.max(...actual.map((v) => textWidth(fmt(v, col, true), 12))) + 4;
  const option = {
    ...baseOption(c),
    grid: { left: nameW + 12, right: valueW + (targetCol && !c.narrow ? 62 : 0) + 12, top: 4, bottom: 4, containLabel: false },
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (p: unknown) => {
        const i = (p as { dataIndex: number }).dataIndex;
        const d = deltas[i];
        const rowsTip: TipRow[] = [{ label: col.label, value: fmt(actual[i], col), color: c.t.series }];
        if (targetCol) rowsTip.push({ label: targetCol.label, value: fmt(target[i], targetCol), color: c.t.cmp });
        return tip(c, names[i] ?? '', rowsTip, d && targetCol ? `${d.text} vs ${targetCol.label.toLowerCase()}` : undefined);
      },
    }),
    xAxis: hiddenValueAxis(c, col, { min: 0, max }),
    yAxis: [
      categoryAxis(c, names, { inverse: true, axisLine: { show: false }, axisLabel: { color: c.t.text, fontSize: 12, fontFamily: c.t.font, width: nameW, overflow: 'truncate', interval: 0, margin: 10 } }),
      // The values sit in their own right-aligned column, so a target mark never runs into a number.
      categoryAxis(c, names, {
        inverse: true,
        position: 'right',
        axisLine: { show: false },
        axisLabel: {
          interval: 0,
          margin: 10,
          fontFamily: c.t.font,
          formatter: (_: string, i: number) => {
            const d = deltas[i];
            const value = `{v|${fmt(actual[i], col, true)}}`;
            return d && !c.narrow ? `${value}{${d.tone}|${d.text}}` : value;
          },
          rich: {
            v: { color: c.t.text, fontSize: 12, fontWeight: 500, fontFamily: c.t.font, width: valueW, align: 'right' },
            good: { color: c.t.pos, fontSize: 11.5, fontFamily: c.t.font, width: 62, align: 'right' },
            bad: { color: c.t.neg, fontSize: 11.5, fontFamily: c.t.font, width: 62, align: 'right' },
            flat: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, width: 62, align: 'right' },
          },
        },
      }),
    ],
    series: [
      { type: 'bar', name: col.label, data: actual, barWidth: 10, showBackground: true, backgroundStyle: { color: c.t.grid, borderRadius: markRadius(c.t, 3) }, itemStyle: { color: c.t.series, borderRadius: markRadius(c.t, 3) }, emphasis: { itemStyle: { color: c.t.series, opacity: 0.85 } } },
      ...(targetCol ? [{ type: 'scatter', name: targetCol.label, data: target, symbol: 'rect', symbolSize: [3, 22], itemStyle: { color: c.t.cmp, borderColor: c.t.surface, borderWidth: 1 }, emphasis: { scale: false }, z: 3 }] : []),
    ],
  };
  return {
    render: 'echarts',
    kind: 'bullet',
    option,
    points: names.map((name, i) => ({ seriesIndex: 0, dataIndex: i, text: `${name}: ${fmt(actual[i], col)}${targetCol ? `, ${targetCol.label.toLowerCase()} ${fmt(target[i], targetCol)}${deltas[i] ? `, ${deltas[i]!.spoken}` : ''}` : ''}` })),
    legend: targetCol ? [{ label: col.label, color: c.t.series, mark: 'solid' }, { label: targetCol.label, color: c.t.cmp, mark: 'tick' }] : [],
    note: c.rows.length > limit ? `Showing the first ${limit} of ${c.rows.length}. “View as table” has them all.` : undefined,
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Bullet chart: ${col.label}${targetCol ? ` against ${targetCol.label}` : ''} for ${names.length} rows.`, extremes(names.map((name, i) => ({ name, value: actual[i], text: fmt(actual[i], col) })))),
  };
}

export { num };
