import { formatDate, formatValue, isoDay, parseDate } from '../format';
import { contrast, inkOn, markRadius, mix, seqColor, seqRamp } from '../tokens';
import type { EvidenceColumn } from '../widget-types';
import { type Built, type Ctx, type RampLegend, baseOption, categoryAxis, cell, column, distinct, empty, extremes, label, numberAt, pickValueKey, specKeys, summary, tableModel, textWidth, tip, tooltip, valueColumn } from './shared';

/*
  Heatmap and calendar heatmap. Magnitude is one hue from near the surface to full blue: a hidden visualMap
  paints the cells along that ramp, and the same ramp is computed here so a label inside a cell takes the ink
  that reads on it.
*/

function ramp(c: Ctx, min: number, max: number, col: Parameters<typeof formatValue>[1], name: string): RampLegend {
  return { colors: seqRamp(c.t, 5), min: formatValue(min, col, { compact: true }), max: formatValue(max, col, { compact: true }), label: name };
}

/** The hidden visualMap that paints cells along the sequential ramp. */
function fills(c: Ctx, min: number, max: number, dimension: number) {
  return { type: 'continuous', show: false, min, max: max > min ? max : min + 1, dimension, inRange: { color: [seqColor(c.t, min, min, max > min ? max : min + 1), c.t.series] } };
}

export function buildHeatmap(c: Ctx): Built {
  const xKey = c.spec.x;
  const yKey = c.spec.group;
  const vKey = pickValueKey(c);
  if (!xKey || !yKey || !vKey || !c.rows.length) return empty(c, 'A heatmap needs columns (x), rows (group) and a value (y).');
  const xCol = column(c, xKey);
  const yCol = column(c, yKey);
  const col = valueColumn(c, vKey);
  const xs = distinct(c.rows.map((r) => String(cell(r, xKey) ?? '')));
  // Rows may be as low as 13 px, so the group's 20 hotels fit the regular height; the names shrink with them.
  const maxRows = Math.max(3, Math.floor((c.height - 34) / 13));
  const allYs = distinct(c.rows.map((r) => String(cell(r, yKey) ?? '')));
  const ys = allYs.slice(0, maxRows);
  const cells = c.rows
    .map((r) => ({ x: xs.indexOf(String(cell(r, xKey) ?? '')), y: ys.indexOf(String(cell(r, yKey) ?? '')), v: numberAt(r, vKey) }))
    .filter((p): p is { x: number; y: number; v: number } => p.v !== null && p.y >= 0);
  if (!cells.length) return empty(c, 'No data for this period.');
  const min = Math.min(...cells.map((p) => p.v));
  const max = Math.max(...cells.map((p) => p.v));
  const xLabels = xs.map((x) => label(x, xCol));
  const yLabels = ys.map((y) => label(y, yCol));
  const cellH = (c.height - 34) / ys.length;
  const nameSize = cellH < 15 ? 11 : 12;
  const nameW = Math.min(Math.max(...yLabels.map((l) => textWidth(l, nameSize))) + 10, Math.round(c.width * (c.narrow ? 0.3 : 0.26)));
  const cellW = (c.width - nameW - 16) / xs.length;
  const short = (v: number) => formatValue(v, col, { axis: true }).replace(/\.\d+%$/, '%');
  const showValues = cellW >= Math.max(...cells.map((p) => textWidth(short(p.v), 11))) + 6 && cellH >= 16;
  const option = {
    ...baseOption(c),
    grid: { left: nameW + 12, right: 4, top: 4, bottom: 24, containLabel: false },
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (p: unknown) => {
        const d = cells[(p as { dataIndex: number }).dataIndex];
        if (!d) return '';
        return tip(c, `${yLabels[d.y]} · ${label(xs[d.x], xCol, 'full')}`, [{ label: col.label, value: formatValue(d.v, col), color: seqColor(c.t, d.v, min, max) }]);
      },
    }),
    visualMap: fills(c, min, max, 2),
    xAxis: categoryAxis(c, xLabels, { axisLine: { show: false }, splitArea: { show: false } }),
    yAxis: categoryAxis(c, yLabels, { inverse: true, axisLine: { show: false }, axisLabel: { color: c.t.text, fontSize: nameSize, fontFamily: c.t.font, width: nameW, overflow: 'truncate', interval: 0, margin: 10 } }),
    series: [
      {
        type: 'heatmap',
        name: col.label,
        data: cells.map((p) => ({ value: [p.x, p.y, p.v], label: { color: inkOn(seqColor(c.t, p.v, min, max)) } })),
        itemStyle: { borderColor: c.t.surface, borderWidth: 1, borderRadius: markRadius(c.t, 3) },
        label: { show: showValues, fontSize: 11, fontFamily: c.t.font, formatter: (p: { dataIndex: number }) => short(cells[p.dataIndex].v) },
        emphasis: { itemStyle: { borderColor: c.t.fg, borderWidth: 1 } },
      },
    ],
  };
  return {
    render: 'echarts',
    kind: 'heatmap',
    option,
    points: cells.map((p, i) => ({ seriesIndex: 0, dataIndex: i, text: `${yLabels[p.y]}, ${label(xs[p.x], xCol, 'full')}: ${formatValue(p.v, col)}` })),
    legend: [],
    ramp: ramp(c, min, max, col, col.label),
    note: allYs.length > ys.length ? `Showing the first ${ys.length} of ${allYs.length}. “View as table” has them all.` : undefined,
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Heatmap of ${col.label.toLowerCase()}: ${ys.length} rows by ${xs.length} columns.`, extremes(cells.map((p) => ({ name: `${yLabels[p.y]} ${xLabels[p.x]}`, value: p.v, text: formatValue(p.v, col) })))),
  };
}

const DAY = 86_400_000;
/** Monday-first weekday index of a UTC day. */
const weekday = (t: number) => (new Date(t).getUTCDay() + 6) % 7;

/** Calendar geometry, in px: cells between 32 and 64, square, 3 apart; months 24 apart, side by side while they fit. */
export const CAL = { minCell: 32, maxCell: 64, gap: 3, monthGap: 24, rowGap: 20, title: 24, head: 20, legend: 48 } as const;

/** One day of a month grid: its fill and ink, what the cell says, and what the tooltip and a screen reader say. */
export interface CalendarDay {
  iso: string;
  day: number;
  /** Inside the period the rows cover, with a value: drawn. Outside: faint and empty. */
  inRange: boolean;
  value: number | null;
  today: boolean;
  fill: string;
  ink: string;
  /** In the cell: "0.92", "−8%" for a ratio around 1.00, "65%". */
  text: string;
  /** In the tooltip: the value in full. */
  full: string;
  /** In the tooltip: what the value means ("8% under the comp set median"), or ''. */
  meaning: string;
  /** "Wed 16 Dec 2026: 65.0%": what the keyboard announces. */
  label: string;
  /** Its place among the drawn days (keyboard order), or -1. */
  index: number;
}
export interface CalendarMonth {
  key: string;
  name: string;
  /** Monday-first weeks of seven: null before the 1st and after the last day of the month. */
  weeks: (CalendarDay | null)[][];
}
export interface CalendarScale {
  kind: 'diverging' | 'sequential';
  /** Plain words at the two ends: "Under the comp set" / "Over the comp set", or "Lower" / "Higher". */
  lowLabel: string;
  highLabel: string;
  minText: string;
  maxText: string;
  /** The midpoint, marked on the bar ("1.00"). */
  midText?: string;
  /** Where the midpoint sits on the bar, 0 to 1. */
  midAt?: number;
  /** The CSS gradient of the bar. */
  gradient: string;
}
export interface CalendarModel {
  months: CalendarMonth[];
  /** Months side by side. */
  perRow: number;
  cell: number;
  gap: number;
  weekdays: readonly string[];
  scale: CalendarScale;
  /** The drawn days in date order: what the arrow keys step through. */
  days: CalendarDay[];
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Black or white, whichever reads better on the fill: either way at least 4.5:1, on any fill. */
const inkFor = (fill: string) => (contrast('#000000', fill) >= contrast('#ffffff', fill) ? '#000000' : '#ffffff');

/** How many months sit side by side in `width`, and the cell size that fills it (32–64 px). */
export function calendarFit(months: number, width: number): { perRow: number; cell: number } {
  const monthAtMin = 7 * CAL.minCell + 6 * CAL.gap;
  const perRow = Math.max(1, Math.min(months, Math.floor((width + CAL.monthGap) / (monthAtMin + CAL.monthGap))));
  const monthWidth = (width - (perRow - 1) * CAL.monthGap) / perRow;
  const cell = Math.max(CAL.minCell, Math.min(CAL.maxCell, Math.floor((monthWidth - 6 * CAL.gap) / 7)));
  return { perRow, cell };
}

/** The reference a ratio is read against, from its label: "Our BAR vs the comp set median" → "the comp set median". */
function reference(col: EvidenceColumn, title: string): string | null {
  const said = col.label.match(/\bvs\.?\s+(.+)$/i)?.[1] ?? title.match(/\(1\.00 is (?:at )?(?:the )?(.+?)\)/i)?.[1];
  if (!said) return null;
  const ref = said.trim().replace(/-/g, ' ');
  return /^the\s/i.test(ref) ? ref : `the ${ref}`;
}

export function buildCalendarHeatmap(c: Ctx): Built {
  const xKey = c.spec.x ?? c.columns.find((k) => k.kind === 'date')?.key;
  const vKey = pickValueKey(c);
  if (!xKey || !vKey) return empty(c, 'This calendar can’t be drawn: it is missing its dates or its values. Ask Kassandra for it again.');
  const col = valueColumn(c, vKey);
  const values = new Map<number, number>();
  for (const r of c.rows) {
    const t = parseDate(cell(r, xKey));
    const v = numberAt(r, vKey);
    if (t !== null && v !== null) values.set(t, v);
  }
  if (!values.size) return empty(c, 'No nights to show for this period.');
  const times = [...values.keys()].sort((a, b) => a - b);
  const first = times[0]!;
  const last = times.at(-1)!;
  const all = [...values.values()];
  const min = Math.min(...all);
  const max = Math.max(...all);

  // The scale: diverging around a meaningful midpoint (1.00 for a ratio to a reference, 0 for a change), else one hue.
  const ratio = /×|ratio|median|_vs_|\bvs\b/i.test(`${col.unit ?? ''} ${col.key} ${col.label}`) && min > 0 && max < 5;
  const mid = ratio ? 1 : min < 0 && max > 0 ? 0 : null;
  const ref = ratio ? reference(col, c.spec.title) : null;
  const refShort = ref?.replace(/\s+(median|average|mean)$/i, '');
  const low = c.t.cat[3] ?? c.t.cmp;
  const high = c.t.series;
  const neutral = mix(c.t.grey, c.t.surface, 0.14);
  const reach = mid === null ? 0 : Math.max(Math.abs(min - mid), Math.abs(max - mid)) || 1;
  const fillOf = (v: number) => {
    if (mid === null) return seqColor(c.t, v, min, max);
    const s = Math.min(1, Math.abs(v - mid) / reach);
    return s < 0.04 ? neutral : mix(v < mid ? low : high, c.t.surface, 0.22 + 0.78 * s);
  };
  const short = (v: number) => formatValue(v, col, { axis: true }).replace(/\.\d+%$/, '%');
  const ratioText = (v: number) => {
    const pct = Math.round((v - 1) * 100);
    return pct === 0 ? '±0%' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
  };
  const textOf = (v: number) => (ratio ? ratioText(v) : short(v));
  const fullOf = (v: number) => (ratio ? `${v.toFixed(2)}${col.unit ? ` ${col.unit}` : ''}` : formatValue(v, col));
  const meaningOf = (v: number) => {
    if (!ratio) return '';
    const pct = Math.round(Math.abs(v - 1) * 100);
    if (pct === 0) return ref ? `At ${ref}` : 'At 1.00';
    return `${pct}% ${v < 1 ? (ref ? 'under' : 'below') : ref ? 'over' : 'above'} ${ref ?? '1.00'}`;
  };

  const today = c.today ? parseDate(c.today) : null;
  const days: CalendarDay[] = [];
  const months: CalendarMonth[] = [];
  const firstMonth = new Date(first);
  const lastMonth = new Date(last);
  for (let y = firstMonth.getUTCFullYear(), m = firstMonth.getUTCMonth(); y < lastMonth.getUTCFullYear() || (y === lastMonth.getUTCFullYear() && m <= lastMonth.getUTCMonth()); m === 11 ? ((m = 0), y++) : m++) {
    const start = Date.UTC(y, m, 1);
    const length = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const cells: (CalendarDay | null)[] = Array.from({ length: weekday(start) }, () => null);
    for (let d = 1; d <= length; d++) {
      const t = Date.UTC(y, m, d);
      const v = values.get(t) ?? null;
      const inRange = v !== null;
      const day: CalendarDay = {
        iso: isoDay(t),
        day: d,
        inRange,
        value: v,
        today: today !== null && t === today,
        fill: inRange ? fillOf(v) : 'transparent',
        ink: inRange ? inkFor(fillOf(v)) : c.t.muted,
        text: inRange ? textOf(v) : '',
        full: inRange ? fullOf(v) : '',
        meaning: inRange ? meaningOf(v) : '',
        label: inRange ? `${formatDate(t, 'date', 'full')}: ${fullOf(v)}${ratio && meaningOf(v) ? `, ${meaningOf(v).replace(/^./, (s) => s.toLowerCase())}` : ''}` : '',
        index: inRange ? days.length : -1,
      };
      if (inRange) days.push(day);
      cells.push(day);
    }
    while (cells.length % 7) cells.push(null);
    months.push({ key: `${y}-${m}`, name: monthName.format(start), weeks: Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7)) });
  }
  // The keyboard reads the plain value: the label says "0.82 × the median, 18% under the comp set median".
  if (!ratio) for (const d of days) d.label = `${formatDate(parseDate(d.iso), 'date', 'full')}: ${formatValue(d.value, col)}`;

  // The width the host measured is rounded to 20 px: keep clear of the edge so the months never wrap sooner than planned.
  const fit = calendarFit(months.length, c.width - 12);
  const rowsOfMonths: CalendarMonth[][] = [];
  for (let i = 0; i < months.length; i += fit.perRow) rowsOfMonths.push(months.slice(i, i + fit.perRow));
  const height = rowsOfMonths.reduce((h, row) => h + CAL.title + CAL.head + Math.max(...row.map((m) => m.weeks.length)) * (fit.cell + CAL.gap), 0) + (rowsOfMonths.length - 1) * CAL.rowGap + CAL.legend;

  const scale: CalendarScale =
    mid === null
      ? { kind: 'sequential', lowLabel: 'Lower', highLabel: 'Higher', minText: short(min), maxText: short(max), gradient: `linear-gradient(to right, ${seqRamp(c.t, 5).join(', ')})` }
      : {
          kind: 'diverging',
          lowLabel: ref ? `Under ${refShort}` : mid === 1 ? 'Below 1.00' : 'Below zero',
          highLabel: ref ? `Over ${refShort}` : mid === 1 ? 'Above 1.00' : 'Above zero',
          minText: ratio ? min.toFixed(2) : short(min),
          maxText: ratio ? max.toFixed(2) : short(max),
          midText: ratio ? '1.00' : short(0),
          midAt: 0.5,
          gradient: `linear-gradient(to right, ${mix(low, c.t.surface, 1)}, ${mix(low, c.t.surface, 0.5)}, ${neutral} 50%, ${mix(high, c.t.surface, 0.5)}, ${mix(high, c.t.surface, 1)})`,
        };
  const subject = ratio ? 'nights' : 'days';
  const under = ratio ? days.filter((d) => d.value! < 0.995).length : 0;
  return {
    render: 'calendar',
    kind: 'calendar_heatmap',
    calendar: { months, perRow: fit.perRow, cell: fit.cell, gap: CAL.gap, weekdays: WEEKDAYS, scale, days },
    height,
    legend: [],
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(
      c,
      `Calendar of ${col.label.replace(/^[A-Z][a-z]/, (s) => s.toLowerCase())} for ${days.length} ${subject}, ${formatDate(first, 'date', 'full')} to ${formatDate(last, 'date', 'full')}.${ratio && ref ? ` ${under} of them under ${ref}.` : ''}`,
      extremes(days.map((d) => ({ name: formatDate(parseDate(d.iso), 'date', 'full'), value: d.value, text: d.full }))),
    ),
  };
}
