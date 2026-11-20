import { formatDate, formatValue, isoDay, parseDate } from '../format';
import { inkOn, seqColor, seqRamp, markRadius } from '../tokens';
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
  const maxRows = Math.max(3, Math.floor((c.height - 34) / 16));
  const allYs = distinct(c.rows.map((r) => String(cell(r, yKey) ?? '')));
  const ys = allYs.slice(0, maxRows);
  const cells = c.rows
    .map((r) => ({ x: xs.indexOf(String(cell(r, xKey) ?? '')), y: ys.indexOf(String(cell(r, yKey) ?? '')), v: numberAt(r, vKey) }))
    .filter((p): p is { x: number; y: number; v: number } => p.v !== null && p.y >= 0);
  if (!cells.length) return empty(c, 'No data to plot for this period.');
  const min = Math.min(...cells.map((p) => p.v));
  const max = Math.max(...cells.map((p) => p.v));
  const xLabels = xs.map((x) => label(x, xCol));
  const yLabels = ys.map((y) => label(y, yCol));
  const nameW = Math.min(Math.max(...yLabels.map((l) => textWidth(l, 12))) + 6, Math.round(c.width * (c.narrow ? 0.3 : 0.26)));
  const cellW = (c.width - nameW - 16) / xs.length;
  const cellH = (c.height - 34) / ys.length;
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
    yAxis: categoryAxis(c, yLabels, { inverse: true, axisLine: { show: false }, axisLabel: { color: c.t.text, fontSize: 12, fontFamily: c.t.font, width: nameW, overflow: 'truncate', interval: 0, margin: 10 } }),
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
    note: allYs.length > ys.length ? `Showing the first ${ys.length} of ${allYs.length} rows; all of them are in the table.` : undefined,
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Heatmap of ${col.label.toLowerCase()}: ${ys.length} rows by ${xs.length} columns.`, extremes(cells.map((p) => ({ name: `${yLabels[p.y]} ${xLabels[p.x]}`, value: p.v, text: formatValue(p.v, col) })))),
  };
}

const DAY = 86_400_000;
/** Monday-first weekday index of a UTC day. */
const weekday = (t: number) => (new Date(t).getUTCDay() + 6) % 7;

export interface CalendarLayout {
  range: [string, string];
  weeks: number;
  cell: number;
  left: number;
  top: number;
}

/** Fits a Monday-first calendar (weeks as columns) into the space: square cells, centred. */
export function calendarLayout(first: number, last: number, width: number, height: number): CalendarLayout {
  const days = Math.round((last - first) / DAY) + 1;
  const weeks = Math.ceil((weekday(first) + days) / 7);
  const gutter = 34;
  const cell = Math.max(10, Math.min(40, Math.floor((width - gutter - 8) / weeks), Math.floor((height - 30) / 7)));
  return { range: [isoDay(first), isoDay(last)], weeks, cell, left: Math.max(gutter, Math.round((width - cell * weeks + gutter - 8) / 2)), top: 24 + Math.max(0, Math.floor((height - 30 - cell * 7) / 2)) };
}

export function buildCalendarHeatmap(c: Ctx): Built {
  const xKey = c.spec.x ?? c.columns.find((k) => k.kind === 'date')?.key;
  const vKey = pickValueKey(c);
  if (!xKey || !vKey) return empty(c, 'A calendar needs a date column (x) and a value (y).');
  const col = valueColumn(c, vKey);
  const days = c.rows.map((r) => ({ t: parseDate(cell(r, xKey)), v: numberAt(r, vKey) })).filter((d): d is { t: number; v: number } => d.t !== null && d.v !== null);
  if (!days.length) return empty(c, 'No nights to show for this period.');
  const first = Math.min(...days.map((d) => d.t));
  const last = Math.max(...days.map((d) => d.t));
  const min = Math.min(...days.map((d) => d.v));
  const max = Math.max(...days.map((d) => d.v));
  // The scale legend above the plot takes its share of the body.
  const lay = calendarLayout(first, last, c.width, c.height - 34);
  const dayNumbers = lay.cell >= 22;
  const option = {
    ...baseOption(c),
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (p: unknown) => {
        const d = days[(p as { dataIndex: number }).dataIndex];
        if (!d) return '';
        return tip(c, formatDate(d.t, 'date', 'full'), [{ label: col.label, value: formatValue(d.v, col), color: seqColor(c.t, d.v, min, max) }]);
      },
    }),
    visualMap: fills(c, min, max, 1),
    calendar: {
      orient: 'horizontal',
      range: lay.range,
      cellSize: lay.cell,
      left: lay.left,
      top: lay.top,
      splitLine: { show: false },
      itemStyle: { color: 'transparent', borderColor: c.t.surface, borderWidth: 2 },
      yearLabel: { show: false },
      monthLabel: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, margin: 8, nameMap: 'EN' },
      dayLabel: { firstDay: 1, color: c.t.muted, fontSize: 10.5, fontFamily: c.t.font, margin: 8, nameMap: lay.cell >= 16 ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'] },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        name: col.label,
        data: days.map((d) => ({ value: [isoDay(d.t), d.v], label: { color: inkOn(seqColor(c.t, d.v, min, max)) } })),
        itemStyle: { borderRadius: markRadius(c.t, 3) },
        label: { show: dayNumbers, fontSize: 10.5, fontFamily: c.t.font, formatter: (p: { dataIndex: number }) => String(new Date(days[p.dataIndex].t).getUTCDate()) },
        emphasis: { itemStyle: { borderColor: c.t.fg, borderWidth: 1 } },
      },
    ],
  };
  return {
    render: 'echarts',
    kind: 'calendar_heatmap',
    option,
    points: days.map((d, i) => ({ seriesIndex: 0, dataIndex: i, text: `${formatDate(d.t, 'date', 'full')}: ${formatValue(d.v, col)}` })),
    legend: [],
    ramp: ramp(c, min, max, col, col.label),
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Calendar of ${col.label.toLowerCase()} for ${days.length} days, ${formatDate(first, 'date', 'full')} to ${formatDate(last, 'date', 'full')}.`, extremes(days.map((d) => ({ name: formatDate(d.t, 'date', 'full'), value: d.v, text: formatValue(d.v, col) })))),
  };
}
