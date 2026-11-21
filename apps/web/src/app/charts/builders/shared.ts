import type { EChartsCoreOption } from 'echarts/core';
import { EMPTY, type Delta, esc, formatValue, humanize, isNumericKind, num, parseDate } from '../format';
import { hotelNames } from '../hotel-names';
import { type ChartTokens, DARK_TOKENS, markRadius } from '../tokens';
import type { ColumnKind, EvidenceColumn, WidgetKind, WidgetRow, WidgetSpec } from '../widget-types';

/*
  What every builder gets and gives back. A builder is pure: rows + columns + spec (plus the theme tokens and
  the space available) → what to draw. It never fetches and never invents a number.
*/

export interface BuildInput {
  spec: WidgetSpec;
  rows: readonly WidgetRow[];
  columns?: readonly EvidenceColumn[];
  tokens?: ChartTokens;
  /** Width available, in px. Builders adapt labels and layout to it (down to 390 px phones). */
  width?: number;
  compact?: boolean;
  /** False under prefers-reduced-motion. */
  motion?: boolean;
  /** The height of the body in px, when the host sets it (an overview card, a featured chart). Default: by kind. */
  height?: number;
}

export interface Ctx {
  spec: WidgetSpec;
  rows: readonly WidgetRow[];
  columns: readonly EvidenceColumn[];
  t: ChartTokens;
  width: number;
  height: number;
  compact: boolean;
  motion: boolean;
  narrow: boolean;
}

export interface TableColumn {
  key: string;
  label: string;
  kind: ColumnKind;
  align: 'left' | 'right';
}
export interface TableCell {
  text: string;
  /** What the column sorts by. */
  sort: number | string | null;
}
export interface TableModel {
  columns: TableColumn[];
  rows: TableCell[][];
}

export type LegendMark = 'solid' | 'line' | 'dashed' | 'tick' | 'outline';
export interface LegendItem {
  label: string;
  color: string;
  mark: LegendMark;
}
export interface RampLegend {
  colors: string[];
  min: string;
  max: string;
  label: string;
}

/** A data point the keyboard can step to: which mark to show the tooltip on, and what to announce. */
export interface PointRef {
  seriesIndex: number;
  dataIndex: number;
  text: string;
}

export interface KpiModel {
  label: string;
  value: string;
  delta: Delta | null;
  /** "vs last year": what the delta compares against. */
  versus: string;
  spark: SparkPath | null;
}
export interface SparkPath {
  /** Line path in a 100 × 28 box. */
  line: string;
  area: string;
  /** Where the last point sits, 0 (top) to 1 (bottom). */
  lastY: number;
}
export interface SparkRow {
  label: string;
  value: string;
  delta: Delta | null;
  spark: SparkPath | null;
}

interface BuiltBase {
  /** The kind that is drawn (differs from the spec's when a fallback applied). */
  kind: WidgetKind;
  /** Why the chart differs from what was asked, e.g. "11 parts are too many for a donut". */
  note?: string;
  /** The same data as a table: the accessible fallback behind "View as table". */
  table: TableModel;
  /** Text alternative of the chart. */
  summary: string;
  legend: LegendItem[];
  ramp?: RampLegend;
  /** Rows of the data the chart leaves out (a list of bars draws eight at most): "+12 more" opens the table. */
  more?: number;
}
export type Built =
  | (BuiltBase & { render: 'echarts'; option: EChartsCoreOption; points: PointRef[] })
  | (BuiltBase & { render: 'kpi'; kpi: KpiModel })
  | (BuiltBase & { render: 'kpi_row'; tiles: KpiModel[] })
  | (BuiltBase & { render: 'sparklines'; items: SparkRow[] })
  | (BuiltBase & { render: 'table' })
  | (BuiltBase & { render: 'empty'; message: string });

export type Builder = (c: Ctx) => Built;

/** Body heights are fixed per kind, so a skeleton and the finished widget have identical dimensions. */
const HEIGHTS: Record<WidgetKind, [regular: number, compact: number]> = {
  kpi: [104, 84],
  kpi_row: [124, 108],
  line: [300, 220],
  area: [300, 220],
  bar: [300, 220],
  stacked_bar: [300, 220],
  grouped_bar: [300, 220],
  pie: [280, 220],
  donut: [280, 220],
  table: [320, 240],
  // Not shorter when compact: an answer's heatmap is often the group's 20 hotels, and a row needs 13 px.
  heatmap: [300, 300],
  calendar_heatmap: [240, 200],
  funnel: [280, 220],
  waterfall: [300, 220],
  bullet: [300, 220],
  sparkline_list: [300, 220],
  scatter: [320, 240],
  treemap: [300, 220],
  gauge: [220, 180],
  radar: [320, 240],
  sankey: [320, 240],
};
export const NARROW = 480;

/** How many KPI tiles a spec will draw: one per y column, or (one tile per row) four until the rows say otherwise. */
export function kpiCount(spec: Pick<WidgetSpec, 'y'>): number {
  return spec.y && spec.y.length > 1 ? Math.min(6, spec.y.length) : 4;
}
/** KPI tiles sit in one row while each gets 132 px; below that they wrap two by two. */
export function kpiColumns(count: number, width: number): number {
  return width / count >= 132 ? count : Math.min(count, 2);
}

/**
 * The height of a widget's body. It depends only on the spec, the density and the width, so the skeleton
 * (which knows no rows) has the same box as the finished widget.
 */
export function bodyHeight(spec: Pick<WidgetSpec, 'kind' | 'y'>, compact: boolean, width: number, tiles = kpiCount(spec)): number {
  const base = (HEIGHTS[spec.kind] ?? HEIGHTS.table)[compact ? 1 : 0];
  if (spec.kind !== 'kpi_row') return base;
  const rows = Math.ceil(tiles / kpiColumns(tiles, width));
  return rows * base + (rows - 1) * 8;
}

export function context(input: BuildInput): Ctx {
  const width = input.width ?? 640;
  const compact = input.compact ?? false;
  const rows = input.rows;
  return {
    spec: input.spec,
    rows,
    columns: input.columns ?? [],
    t: input.tokens ?? DARK_TOKENS,
    width,
    height: input.height ?? bodyHeight(input.spec, compact, width),
    compact,
    motion: input.motion ?? true,
    narrow: width < NARROW,
  };
}

/* ───────── Columns ───────── */

function inferKind(key: string, rows: readonly WidgetRow[]): ColumnKind {
  const sample = rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined && v !== '');
  if (!sample.length) return 'text';
  if (sample.every((v) => typeof v === 'number' || num(v) !== null)) {
    if (/(_pct|percent|occupancy|share|rate$|conversion)/i.test(key) && !/(adr|revpar)/i.test(key)) return 'percent';
    if (/(revenue|adr|revpar|eur|gop|cost|profit|amount|price|budget|spend)/i.test(key)) return 'currency';
    if (/(count|rooms|nights|bookings|guests|sessions|searches)/i.test(key)) return 'count';
    return 'number';
  }
  if (sample.every((v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v))) return 'date';
  if (sample.every((v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v))) return 'month';
  if (sample.every((v) => hotelNames(v))) return 'hotel';
  return 'text';
}

/** The metadata of a column: what the backend sent, else inferred from the key and the values. */
export function column(c: Pick<Ctx, 'columns' | 'rows' | 'spec'>, key: string, role?: 'value'): EvidenceColumn {
  const found = c.columns.find((x) => x.key === key);
  // A text column of hotel codes is a hotel column: it is drawn with the hotels' names.
  if (found) return found.kind === 'text' && inferKind(key, c.rows) === 'hotel' ? { ...found, kind: 'hotel' } : found;
  const inferred = inferKind(key, c.rows);
  const kind = role === 'value' && c.spec.format && isNumericKind(inferred) ? c.spec.format : inferred;
  return { key, label: humanize(key), kind };
}

/** The column the y values read by: the first y key, with the spec's `format` as a fallback kind. */
export function valueColumn(c: Ctx, key: string | undefined): EvidenceColumn {
  if (!key) return { key: '', label: 'Value', kind: c.spec.format ?? 'number' };
  return column(c, key, 'value');
}

export const cell = (row: WidgetRow, key: string | undefined): unknown => (key ? row[key] : undefined);
export const numberAt = (row: WidgetRow, key: string | undefined): number | null => num(cell(row, key));
export const label = (v: unknown, col: EvidenceColumn, style: 'axis' | 'full' = 'axis'): string => formatValue(v, col, { axis: style === 'axis', unit: false });

/** First key the spec names that exists, falling back to the first column of that sort. */
export function pickLabelKey(c: Ctx, ...preferred: (string | undefined)[]): string | undefined {
  for (const k of preferred) if (k) return k;
  const keys = visibleKeys(c);
  return keys.find((k) => !isNumericKind(column(c, k).kind));
}
export function pickValueKey(c: Ctx): string | undefined {
  if (c.spec.y?.length) return c.spec.y[0];
  return visibleKeys(c).find((k) => isNumericKind(column(c, k).kind));
}

export function visibleKeys(c: Pick<Ctx, 'columns' | 'rows'>): string[] {
  if (c.columns.length) return c.columns.filter((x) => !x.hidden).map((x) => x.key);
  const keys: string[] = [];
  for (const r of c.rows.slice(0, 20)) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
  return keys;
}

/* ───────── The accessible table ───────── */

/** All visible columns (or just `keys`), formatted by kind. Also what the `table` kind draws. */
export function tableModel(c: Pick<Ctx, 'columns' | 'rows' | 'spec'>, keys?: string[]): TableModel {
  const use = (keys?.length ? keys : visibleKeys(c)).filter((k, i, a) => a.indexOf(k) === i);
  const cols = use.map((k) => column(c, k));
  return {
    columns: cols.map((col) => ({ key: col.key, label: col.unit && !/eur|ratio/i.test(col.unit) && isNumericKind(col.kind) && col.kind !== 'percent' ? `${col.label} (${col.unit})` : col.label, kind: col.kind, align: isNumericKind(col.kind) ? 'right' : 'left' })),
    rows: c.rows.map((r) =>
      cols.map((col) => {
        const v = r[col.key];
        const text = formatValue(v, col, { unit: false });
        if (isNumericKind(col.kind)) return { text, sort: num(v) };
        if (col.kind === 'date' || col.kind === 'month') return { text, sort: parseDate(v) };
        return { text, sort: v === null || v === undefined ? null : String(v).toLowerCase() };
      }),
    ),
  };
}

/** The keys a spec uses, in reading order: what the fallback table shows for a chart. */
export function specKeys(spec: WidgetSpec): string[] {
  return [spec.group, spec.x, ...(spec.y ?? []), spec.compare].filter((k): k is string => !!k);
}

export function empty(c: Ctx, message: string): Built {
  return { render: 'empty', kind: c.spec.kind, message, table: tableModel(c, specKeys(c.spec)), summary: `${c.spec.title}. ${message}`, legend: [] };
}

/* ───────── ECharts pieces shared by every option ───────── */

export function baseOption(c: Ctx): Record<string, unknown> {
  return {
    animation: c.motion,
    animationDuration: 520,
    animationDurationUpdate: 260,
    animationEasing: 'cubicOut',
    backgroundColor: 'transparent',
    textStyle: { fontFamily: c.t.font, color: c.t.muted, fontSize: 11.5 },
    tooltip: tooltip(c),
  };
}

export function tooltip(c: Ctx, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    trigger: 'item',
    confine: true,
    backgroundColor: c.t.popover,
    borderColor: c.t.border,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: c.t.fg, fontSize: 12, fontFamily: c.t.font },
    extraCssText: `border-radius:${markRadius(c.t, 4) * 2}px;box-shadow:0 8px 24px -8px rgb(0 0 0 / 0.35);font-variant-numeric:tabular-nums;max-width:280px;white-space:normal;`,
    transitionDuration: c.motion ? 0.12 : 0,
    ...extra,
  };
}

export interface TipRow {
  label: string;
  value: string;
  color?: string;
  dashed?: boolean;
  muted?: boolean;
}

/** Tooltip HTML: a quiet title, then mark · label · value rows. Every string is escaped. */
export function tip(c: Ctx, title: string, rows: TipRow[], foot?: string): string {
  const line = (r: TipRow) => {
    const mark = r.color
      ? r.dashed
        ? `<i style="display:inline-block;width:10px;height:0;border-top:2px dashed ${esc(r.color)};margin-right:6px;vertical-align:middle"></i>`
        : `<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${esc(r.color)};margin-right:6px;vertical-align:middle"></i>`
      : '';
    return `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px;${r.muted ? `color:${c.t.muted}` : ''}"><span>${mark}${esc(r.label)}</span><span style="font-weight:500">${esc(r.value)}</span></div>`;
  };
  const head = title ? `<div style="color:${c.t.muted};font-weight:500;margin-bottom:2px">${esc(title)}</div>` : '';
  const tail = foot ? `<div style="color:${c.t.muted};margin-top:5px">${esc(foot)}</div>` : '';
  return `${head}${rows.map(line).join('')}${tail}`;
}

export function valueAxis(c: Ctx, col: EvidenceColumn, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    splitNumber: c.height < 240 ? 3 : 4,
    axisLabel: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, formatter: (v: number) => formatValue(v, col, { axis: true }) },
    splitLine: { lineStyle: { color: c.t.grid, width: 1 } },
    ...extra,
  };
}

export function categoryAxis(c: Ctx, data: string[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'category',
    data,
    axisLine: { lineStyle: { color: c.t.grid } },
    axisTick: { show: false },
    axisLabel: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, hideOverlap: true },
    ...extra,
  };
}

/** Rough text width at 11.5 px Inter: enough to reserve room for direct labels. */
export const textWidth = (s: string, size = 11.5) => Math.ceil(s.length * size * 0.53);

export function distinct<T>(xs: T[]): T[] {
  return xs.filter((x, i) => xs.indexOf(x) === i);
}

/** "Highest: Lisbon (€142). Lowest: Berlin (€88)." for a chart's text alternative. */
export function extremes(points: { name: string; value: number | null; text: string }[]): string {
  const ok = points.filter((p): p is { name: string; value: number; text: string } => p.value !== null);
  if (ok.length < 2) return ok.length ? `${ok[0].name}: ${ok[0].text}.` : '';
  const hi = ok.reduce((a, b) => (b.value > a.value ? b : a));
  const lo = ok.reduce((a, b) => (b.value < a.value ? b : a));
  return `Highest: ${hi.name} (${hi.text}). Lowest: ${lo.name} (${lo.text}).`;
}

/** How a chart's text alternative opens: its title and scope line, each as a sentence. */
export function summaryHead(spec: Pick<WidgetSpec, 'title' | 'subtitle'>): string {
  return [spec.title.replace(/\.$/, '') + '.', spec.subtitle ? spec.subtitle.replace(/\.$/, '') + '.' : ''].filter(Boolean).join(' ');
}

export function summary(c: Ctx, what: string, detail = ''): string {
  return [summaryHead(c.spec), what, detail].filter(Boolean).join(' ');
}

export { EMPTY };
