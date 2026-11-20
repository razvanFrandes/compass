import { type Delta, formatDate, formatDelta, formatValue, isNumericKind, lowerIsBetter } from '../format';
import type { EvidenceColumn, WidgetRow } from '../widget-types';
import { type Built, type Ctx, type KpiModel, type SparkPath, type SparkRow, cell, column, distinct, empty, label, numberAt, pickValueKey, specKeys, summary, tableModel, valueColumn, visibleKeys } from './shared';

/* The kinds that are numbers and text, not plots: kpi, kpi_row, sparkline_list and table. They render as HTML. */

/** A sparkline in a 100 × 28 box (stretched to its container), with 3 px of air above and below. */
export function sparkPath(values: (number | null)[]): SparkPath | null {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return null;
  const lo = Math.min(...pts.map((p) => p.v));
  const hi = Math.max(...pts.map((p) => p.v));
  const span = hi - lo || 1;
  const n = values.length - 1;
  const x = (i: number) => (i / n) * 100;
  const y = (v: number) => (hi === lo ? 14 : 25 - ((v - lo) / span) * 22);
  const line = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return { line, area: `${line}L${x(last.i).toFixed(1)},28L${x(pts[0].i).toFixed(1)},28Z`, lastY: y(last.v) / 28 };
}

const COMPANIONS = ['_ly', '_stly', '_last_year', '_prev', '_previous', '_budget', '_target'];

/** The comparison column for a value: the spec's `compare`, else a sibling like `revpar_ly` or `revpar_budget`. */
function companion(c: Ctx, key: string, single: boolean): string | undefined {
  if (single && c.spec.compare) return c.spec.compare;
  const keys = c.rows.length ? Object.keys(c.rows[0]) : [];
  const stem = key.replace(/_(pct|eur)$/, '');
  return COMPANIONS.flatMap((s) => [`${key}${s}`, `${stem}${s}`, `${stem}${s}_pct`, `${stem}${s}_eur`]).find((k) => keys.includes(k));
}

function versus(c: Ctx, key: string | undefined): string {
  if (!key) return '';
  // What the comparison is, from the key or from its label: "Occupancy, last year" reads as "vs last year".
  const known = c.columns.find((x) => x.key === key);
  const said = `${key} ${known?.label ?? ''}`;
  if (/_(ly|stly|last_year)(_|$)|last year/i.test(said)) return 'vs last year';
  if (/budget/i.test(said)) return 'vs budget';
  if (/target/i.test(said)) return 'vs target';
  if (known) return `vs ${known.label.replace(/^./, (m) => m.toLowerCase())}`;
  return 'vs previous';
}

const isTime = (col: EvidenceColumn) => col.kind === 'date' || col.kind === 'month';

/** The row a single figure reads: the latest one when the rows are a time series, else the first. */
function headlineRow(c: Ctx): WidgetRow {
  const xCol = c.spec.x ? column(c, c.spec.x) : null;
  return xCol && isTime(xCol) ? c.rows[c.rows.length - 1] : c.rows[0];
}

function tile(c: Ctx, key: string, single: boolean): KpiModel {
  const col = valueColumn(c, key);
  const xCol = c.spec.x ? column(c, c.spec.x) : null;
  const series = xCol && isTime(xCol) && c.rows.length > 1;
  const row = headlineRow(c);
  const cmpKey = companion(c, key, single);
  let delta: Delta | null = cmpKey ? formatDelta(row[key], row[cmpKey], col.kind, col.unit, lowerIsBetter(col)) : null;
  let vs = delta ? versus(c, cmpKey) : '';
  if (!delta && series && c.spec.x && xCol) {
    // No comparison column: say how the period moved, against its own first point.
    delta = formatDelta(row[key], c.rows[0][key], col.kind, col.unit, lowerIsBetter(col));
    vs = delta ? `since ${formatDate(cell(c.rows[0], c.spec.x), xCol.kind === 'month' ? 'month' : 'date')}` : '';
  }
  return { label: col.label, value: formatValue(row[key], col, { compact: true }), delta, versus: vs, spark: series ? sparkPath(c.rows.map((r) => numberAt(r, key))) : null };
}

const speak = (k: KpiModel) => `${k.label} ${k.value}${k.delta ? `, ${k.delta.spoken} ${k.versus}` : ''}`;

export function buildKpi(c: Ctx): Built {
  const key = pickValueKey(c);
  if (!key || !c.rows.length) return empty(c, 'No value to show.');
  const kpi = tile(c, key, true);
  return { render: 'kpi', kind: 'kpi', kpi, legend: [], table: tableModel(c, specKeys(c.spec)), summary: summary(c, `${speak(kpi)}.`) };
}

export function buildKpiRow(c: Ctx): Built {
  if (!c.rows.length) return empty(c, 'No values to show.');
  const xCol = c.spec.x ? column(c, c.spec.x) : null;
  let tiles: KpiModel[];
  if (xCol && !isTime(xCol) && !isNumericKind(xCol.kind) && c.spec.x) {
    // One row per figure: the label column names it.
    const key = pickValueKey(c);
    if (!key) return empty(c, 'No values to show.');
    const col = valueColumn(c, key);
    tiles = c.rows.slice(0, 6).map((r) => {
      const delta = c.spec.compare ? formatDelta(r[key], r[c.spec.compare], col.kind, col.unit, lowerIsBetter(col)) : null;
      return { label: label(cell(r, c.spec.x), xCol), value: formatValue(r[key], col, { compact: true }), delta, versus: delta ? versus(c, c.spec.compare) : '', spark: null };
    });
  } else {
    const keys = (c.spec.y?.length ? c.spec.y : visibleKeys(c).filter((k) => isNumericKind(column(c, k).kind))).slice(0, 6);
    if (!keys.length) return empty(c, 'No values to show.');
    tiles = keys.map((k) => tile(c, k, keys.length === 1));
  }
  return { render: 'kpi_row', kind: 'kpi_row', tiles, legend: [], table: tableModel(c, specKeys(c.spec)), summary: summary(c, tiles.map(speak).join('. ') + '.') };
}

export function buildSparklineList(c: Ctx): Built {
  const xKey = c.spec.x;
  const table = tableModel(c, specKeys(c.spec));
  if (!c.rows.length || !xKey) return empty(c, 'No trends to show.');
  const xCol = column(c, xKey);
  let items: SparkRow[];
  const item = (name: string, values: (number | null)[], col: EvidenceColumn): SparkRow => {
    const ok = values.filter((v): v is number => v !== null);
    return { label: name, value: ok.length ? formatValue(ok[ok.length - 1], col, { compact: true }) : '–', delta: ok.length > 1 ? formatDelta(ok[ok.length - 1], ok[0], col.kind, col.unit, lowerIsBetter(col)) : null, spark: sparkPath(values) };
  };
  if (c.spec.group && c.spec.group !== xKey) {
    const key = pickValueKey(c);
    if (!key) return empty(c, 'No trends to show.');
    const col = valueColumn(c, key);
    const groupCol = column(c, c.spec.group);
    const xs = distinct(c.rows.map((r) => String(cell(r, xKey) ?? '')));
    const groups = distinct(c.rows.map((r) => String(cell(r, c.spec.group) ?? '')));
    const at = new Map(c.rows.map((r) => [`${String(cell(r, xKey) ?? '')}¦${String(cell(r, c.spec.group) ?? '')}`, numberAt(r, key)]));
    items = groups.map((g) => item(label(g, groupCol), xs.map((x) => at.get(`${x}¦${g}`) ?? null), col));
  } else {
    const keys = c.spec.y?.length ? c.spec.y : [pickValueKey(c)].filter((k): k is string => !!k);
    items = keys.map((k) => item(valueColumn(c, k).label, c.rows.map((r) => numberAt(r, k)), valueColumn(c, k)));
  }
  if (!items.length) return empty(c, 'No trends to show.');
  const first = formatDate(cell(c.rows[0], xKey), xCol.kind === 'month' ? 'month' : 'date');
  return {
    render: 'sparklines',
    kind: 'sparkline_list',
    items,
    legend: [],
    note: isTime(xCol) ? `Change since ${first}.` : undefined,
    table,
    summary: summary(c, `${items.length} trends.`, items.map((i) => `${i.label} ${i.value}${i.delta ? `, ${i.delta.spoken}` : ''}`).join('. ') + '.'),
  };
}

export function buildTable(c: Ctx): Built {
  // A table shows what the spec names; with no keys named, every visible column.
  const keys = specKeys(c.spec);
  const table = tableModel(c, keys.length > 1 ? keys : undefined);
  if (!c.rows.length) return { ...empty(c, 'No rows for this period.'), table };
  return { render: 'table', kind: 'table', table, legend: [], summary: summary(c, `Table with ${table.rows.length} rows and ${table.columns.length} columns: ${table.columns.map((x) => x.label).join(', ')}.`) };
}
