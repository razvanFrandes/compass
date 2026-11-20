import { formatDelta, formatValue, isNumericKind } from '../format';
import { catColor, mix } from '../tokens';
import type { EvidenceColumn } from '../widget-types';
import { type Built, type Ctx, type LegendItem, baseOption, cell, column, empty, label, numberAt, pickLabelKey, pickValueKey, specKeys, summary, tableModel, textWidth, tip, tooltip, valueAxis, valueColumn, visibleKeys } from './shared';

/* Scatter (the ARI × MPI quadrant), radar and gauge. */

const isIndex = (col: EvidenceColumn, values: number[]) => col.unit === 'index' || /(^|_)(ari|mpi|rgi|index)(_|$)/i.test(col.key) || (/index/i.test(col.label) && values.every((v) => v > 20 && v < 300));
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** What each corner means when rate index (ARI) meets share index (MPI); 100 is parity with the comp set. */
const ARI_MPI = { topRight: 'Higher rate, more than fair share', topLeft: 'Lower rate, more than fair share', bottomRight: 'Higher rate, less than fair share', bottomLeft: 'Lower rate, less than fair share' };

export function buildScatter(c: Ctx): Built {
  const numeric = visibleKeys(c).filter((k) => isNumericKind(column(c, k).kind));
  const xKey = c.spec.x ?? numeric[0];
  const yKey = c.spec.y?.[0] ?? numeric.find((k) => k !== xKey);
  if (!xKey || !yKey || !c.rows.length) return empty(c, 'A scatter needs two numeric columns (x and y).');
  const xCol = column(c, xKey, 'value');
  const yCol = column(c, yKey, 'value');
  const nameKey = pickLabelKey(c, c.spec.group);
  const nameCol = nameKey ? column(c, nameKey) : null;
  const pts = c.rows
    .map((r) => ({ name: nameKey && nameCol ? label(cell(r, nameKey), nameCol) : '', x: numberAt(r, xKey), y: numberAt(r, yKey) }))
    .filter((p): p is { name: string; x: number; y: number } => p.x !== null && p.y !== null);
  if (!pts.length) return empty(c, 'No data for this period.');
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const xIndex = isIndex(xCol, xs);
  const yIndex = isIndex(yCol, ys);
  const xRef = xIndex ? 100 : median(xs);
  const yRef = yIndex ? 100 : median(ys);
  const quadrant = /ari/i.test(xCol.key) && /mpi/i.test(yCol.key) ? ARI_MPI : null;
  // Round the range out to whole steps, so the reference lines sit inside the plot and the axis ends on clean numbers.
  const pad = (lo: number, hi: number, ref: number) => {
    const a = Math.min(lo, ref);
    const b = Math.max(hi, ref);
    const span = b - a || Math.abs(b) || 1;
    const step = niceStep(span / 5);
    return { min: Math.floor((a - span * extra) / step) * step, max: Math.ceil((b + span * extra) / step) * step, interval: step };
  };
  // Corner captions need air above and below the points.
  const extra = quadrant && !c.narrow ? 0.16 : 0.06;
  const xr = pad(Math.min(...xs), Math.max(...xs), xRef);
  const yr = pad(Math.min(...ys), Math.max(...ys), yRef);
  const plotW = Math.max(120, c.width - 70);
  const roomRight = (p: { x: number }) => ((xr.max - p.x) / (xr.max - xr.min)) * plotW;
  const refLabel = (isIdx: boolean, v: number, col: EvidenceColumn) => (isIdx ? '100' : `median ${formatValue(v, col, { compact: true })}`);
  const caption = { color: c.t.muted, fontSize: 11, fontFamily: c.t.font, opacity: 0.9 };
  const option = {
    ...baseOption(c),
    grid: { left: 10, right: 16, top: 26, bottom: 26, containLabel: true },
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (p: unknown) => {
        const d = pts[(p as { dataIndex: number }).dataIndex];
        if (!d) return '';
        return tip(c, d.name, [
          { label: xCol.label, value: formatValue(d.x, xCol), color: c.t.series },
          { label: yCol.label, value: formatValue(d.y, yCol), color: c.t.series },
        ]);
      },
    }),
    xAxis: valueAxis(c, xCol, { ...xr, name: xCol.label, nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font }, axisLabel: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, formatter: (v: number) => formatValue(Math.round(v * 10) / 10, xCol, { axis: true }) }, splitLine: { show: false } }),
    yAxis: valueAxis(c, yCol, { ...yr, name: yCol.label, nameLocation: 'end', nameGap: 10, nameTextStyle: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, align: 'left' }, axisLabel: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, formatter: (v: number) => formatValue(Math.round(v * 10) / 10, yCol, { axis: true }) }, splitLine: { show: false } }),
    series: [
      {
        type: 'scatter',
        name: `${yCol.label} by ${xCol.label}`,
        // A name that would run off the right edge sits on the left of its point instead.
        data: pts.map((p) => ({ value: [p.x, p.y], label: { position: roomRight(p) < textWidth(p.name, 11.5) + 16 ? 'left' : 'right' } })),
        symbolSize: 10,
        // A ring in the surface colour keeps overlapping points apart.
        itemStyle: { color: c.t.series, borderColor: c.t.surface, borderWidth: 2 },
        emphasis: { scale: 1.3, itemStyle: { borderColor: c.t.fg, borderWidth: 1 } },
        label: { show: pts.length <= (c.narrow ? 12 : 28), position: 'right', distance: 5, color: c.t.text, fontSize: 11.5, fontFamily: c.t.font, formatter: (p: { dataIndex: number }) => pts[p.dataIndex].name },
        labelLayout: { hideOverlap: true },
        markLine: {
          silent: true,
          symbol: 'none',
          animation: false,
          lineStyle: { color: c.t.ref, width: 1, type: 'solid', opacity: 0.55 },
          label: { color: c.t.muted, fontSize: 11, fontFamily: c.t.font },
          data: [
            // An index line needs no label (the axis says 100); a median does.
            { xAxis: xRef, label: { show: !xIndex, formatter: refLabel(xIndex, xRef, xCol), position: 'end' } },
            { yAxis: yRef, label: { show: !yIndex, formatter: refLabel(yIndex, yRef, yCol), position: 'insideEndTop' } },
          ],
        },
        markArea:
          quadrant && !c.narrow
            ? {
                silent: true,
                animation: false,
                itemStyle: { color: 'transparent' },
                data: [
                  [{ xAxis: xRef, yAxis: yr.max, label: { ...caption, show: true, position: 'insideTopRight', formatter: quadrant.topRight } }, { xAxis: xr.max, yAxis: yRef }],
                  [{ xAxis: xr.min, yAxis: yr.max, label: { ...caption, show: true, position: 'insideTopLeft', formatter: quadrant.topLeft } }, { xAxis: xRef, yAxis: yRef }],
                  [{ xAxis: xRef, yAxis: yRef, label: { ...caption, show: true, position: 'insideBottomRight', formatter: quadrant.bottomRight } }, { xAxis: xr.max, yAxis: yr.min }],
                  [{ xAxis: xr.min, yAxis: yRef, label: { ...caption, show: true, position: 'insideBottomLeft', formatter: quadrant.bottomLeft } }, { xAxis: xRef, yAxis: yr.min }],
                ],
              }
            : undefined,
      },
    ],
  };
  const above = pts.filter((p) => p.x >= xRef && p.y >= yRef).length;
  return {
    render: 'echarts',
    kind: 'scatter',
    option,
    points: pts.map((p, i) => ({ seriesIndex: 0, dataIndex: i, text: `${p.name}: ${xCol.label} ${formatValue(p.x, xCol)}, ${yCol.label} ${formatValue(p.y, yCol)}` })),
    legend: [],
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Scatter plot of ${yCol.label} against ${xCol.label} for ${pts.length} points.`, `${above} of ${pts.length} are at or above ${refLabel(xIndex, xRef, xCol)} on both.`),
  };
}

/* ───────── Radar ───────── */

/** An axis step at or above `v`: 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceStep(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Number(([1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= v - 1e-9) ?? v).toPrecision(12));
}

/** A round number at or above `v`: 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 or 10 times a power of ten. */
export function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const found = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * mag).find((s) => s >= v - 1e-9) ?? v;
  return Number(found.toPrecision(12));
}

export function buildRadar(c: Ctx): Built {
  const xKey = pickLabelKey(c, c.spec.x, c.spec.group);
  const yKeys = c.spec.y?.length ? c.spec.y : [pickValueKey(c)].filter((k): k is string => !!k);
  if (!xKey || !yKeys.length || c.rows.length < 3) return empty(c, 'A radar needs at least three axes.');
  const xCol = column(c, xKey);
  const axes = c.rows.map((r) => label(cell(r, xKey), xCol));
  const keys = [...yKeys, ...(c.spec.compare ? [c.spec.compare] : [])];
  const series = keys.map((k, i) => {
    const col = valueColumn(c, k);
    const compare = k === c.spec.compare;
    return { col, name: col.label, compare, color: compare ? c.t.cmp : yKeys.length === 1 ? c.t.series : catColor(c.t, i, col.label), values: c.rows.map((r) => numberAt(r, k) ?? 0) };
  });
  const col = series[0].col;
  // Every spoke shares one scale, so the shape can be compared across spokes.
  const all = series.flatMap((s) => s.values);
  const hi = Math.max(...all);
  const lo = Math.min(...all);
  // Values bunched far from zero (indices around 100) would all draw the same hexagon: start the scale nearer to them, and say so.
  const bunched = lo > hi * 0.5 && hi > lo;
  const step = niceStep((bunched ? hi - lo : hi) / 4);
  const max = Math.ceil((hi * 1.02) / step) * step;
  const min = bunched ? Math.max(0, Math.floor((lo - (hi - lo) * 0.5) / step) * step) : 0;
  const option = {
    ...baseOption(c),
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (p: unknown) => {
        const s = series[(p as { seriesIndex: number }).seriesIndex] ?? series[0];
        return tip(c, s.name, axes.map((a, i) => ({ label: a, value: formatValue(s.values[i], s.col) })));
      },
    }),
    radar: {
      shape: 'polygon',
      center: ['50%', '53%'],
      radius: c.narrow ? '60%' : '72%',
      splitNumber: 4,
      indicator: axes.map((name) => ({ name, max, min })),
      axisName: { color: c.t.text, fontSize: 11.5, fontFamily: c.t.font },
      axisNameGap: 8,
      axisLine: { lineStyle: { color: c.t.grid } },
      splitLine: { lineStyle: { color: c.t.grid } },
      splitArea: { show: false },
    },
    series: series.map((s) => ({
      type: 'radar',
      name: s.name,
      symbol: 'circle',
      symbolSize: 6,
      z: s.compare ? 1 : 2,
      data: [{ value: s.values, name: s.name }],
      lineStyle: { color: s.color, width: 2, type: s.compare ? [...c.t.cmpDash] : 'solid' },
      itemStyle: { color: s.color, borderColor: c.t.surface, borderWidth: 1.5 },
      areaStyle: s.compare ? undefined : { color: s.color, opacity: 0.12 },
      emphasis: { lineStyle: { width: 2 } },
    })),
  };
  const legend: LegendItem[] = series.length > 1 ? series.map((s) => ({ label: s.name, color: s.color, mark: s.compare ? 'dashed' : 'line' })) : [];
  return {
    render: 'echarts',
    kind: 'radar',
    option,
    points: [],
    legend,
    note: min > 0 ? `The scale runs from ${formatValue(min, col, { unit: false })} at the centre to ${formatValue(max, col, { unit: false })} at the edge.` : undefined,
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Radar chart with ${axes.length} axes and ${series.length} series.`, axes.map((a, i) => `${a}: ${series.map((s) => `${s.name} ${formatValue(s.values[i], s.col)}`).join(', ')}`).join('. ') + `. Scale ${formatValue(min, col)} to ${formatValue(max, col)}.`),
  };
}

/* ───────── Gauge ───────── */

export function buildGauge(c: Ctx): Built {
  const yKey = pickValueKey(c);
  if (!yKey || !c.rows.length) return empty(c, 'No value to show.');
  const col = valueColumn(c, yKey);
  const row = c.rows[c.rows.length - 1];
  const value = numberAt(row, yKey);
  if (value === null) return empty(c, 'No value to show.');
  const targetCol = c.spec.compare ? valueColumn(c, c.spec.compare) : null;
  const target = targetCol ? numberAt(row, c.spec.compare) : null;
  const scale = col.kind === 'percent' && col.unit === 'ratio' ? 1 : 100;
  const max = col.kind === 'percent' ? Math.max(scale, niceCeil(Math.max(value, target ?? 0))) : niceCeil(Math.max(value, target ?? 0) * 1.15);
  const delta = target !== null ? formatDelta(value, target, col.kind, col.unit) : null;
  const shape = { type: 'gauge', min: 0, max, startAngle: 205, endAngle: -25, center: ['50%', '62%'], radius: '96%', splitNumber: 1, axisTick: { show: false }, splitLine: { show: false }, anchor: { show: false } };
  const band = c.compact ? 12 : 14;
  const option = {
    ...baseOption(c),
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: () => tip(c, col.label, [{ label: 'Actual', value: formatValue(value, col), color: c.t.series }, ...(target !== null && targetCol ? [{ label: targetCol.label, value: formatValue(target, targetCol), color: c.t.cmp }] : [])], delta && targetCol ? `${delta.text} vs ${targetCol.label.toLowerCase()}` : undefined),
    }),
    series: [
      {
        ...shape,
        name: col.label,
        data: [{ value, name: col.label }],
        progress: { show: true, width: band, roundCap: true, itemStyle: { color: c.t.series } },
        // The unfilled track is a lighter step of the same blue, so the arc reads as one scale.
        axisLine: { roundCap: true, lineStyle: { width: band, color: [[1, mix(c.t.series, c.t.surface, 0.18)]] } },
        pointer: { show: false },
        axisLabel: { show: true, distance: -band - 24, color: c.t.muted, fontSize: 11, fontFamily: c.t.font, formatter: (v: number) => formatValue(v, col, { axis: true }) },
        title: { show: true, offsetCenter: [0, '24%'], color: c.t.muted, fontSize: 12, fontFamily: c.t.font },
        detail: { valueAnimation: c.motion, offsetCenter: [0, '-8%'], color: c.t.fg, fontSize: c.compact ? 26 : 32, fontWeight: 600, fontFamily: c.t.font, formatter: (v: number) => formatValue(v, col, { compact: true }) },
      },
      ...(target !== null
        ? [
            {
              ...shape,
              name: targetCol?.label ?? 'Target',
              data: [{ value: target }],
              silent: true,
              progress: { show: false },
              axisLine: { show: false },
              axisLabel: { show: false },
              title: { show: false },
              detail: { show: false },
              // The target is a tick across the band, in the comparison colour.
              pointer: { show: true, icon: 'rect', width: 3, length: '24%', offsetCenter: [0, '-81%'], itemStyle: { color: c.t.cmp, borderColor: c.t.surface, borderWidth: 1 } },
            },
          ]
        : []),
    ],
  };
  return {
    render: 'echarts',
    kind: 'gauge',
    option,
    points: [],
    legend: target !== null && targetCol ? [{ label: col.label, color: c.t.series, mark: 'solid' }, { label: `${targetCol.label} ${formatValue(target, targetCol, { compact: true })}`, color: c.t.cmp, mark: 'tick' }] : [],
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Gauge: ${col.label} is ${formatValue(value, col)} on a scale of 0 to ${formatValue(max, col)}.`, target !== null && targetCol ? `${targetCol.label} ${formatValue(target, targetCol)}${delta ? `, ${delta.spoken}` : ''}.` : ''),
  };
}
