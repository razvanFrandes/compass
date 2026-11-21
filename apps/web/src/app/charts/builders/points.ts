import { formatDelta, formatValue, isNumericKind } from '../format';
import { catColor, mix } from '../tokens';
import type { EvidenceColumn } from '../widget-types';
import { hotelLabel } from '../hotel-names';
import { type AxisRange, type Corner, type Rect, cornerOf, pickLabels, placeLabels, zoomRange } from './quadrant';
import { COMP_SET_CORNERS, CORNER_GLYPH, isCompSetPair, vsCompSet, vsCompSetWords } from './scatter-words';
import { type Built, type Ctx, type LegendItem, type TipRow, baseOption, cell, column, empty, label, numberAt, pickLabelKey, pickValueKey, specKeys, summary, tableModel, textWidth, tip, tooltip, valueAxis, valueColumn, visibleKeys } from './shared';

import { niceCeil, niceStep } from './steps';

export { niceCeil, niceStep };

/* Scatter (the ARI × MPI quadrant), radar and gauge. */

const isIndex = (col: EvidenceColumn, values: number[]) => col.unit === 'index' || /(^|_)(ari|mpi|rgi|index)(_|$)/i.test(col.key) || (/index/i.test(col.label) && values.every((v) => v > 20 && v < 300));
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The ECharts symbol for each corner: ▲ for the best, ▼ for the worst, a circle and a diamond between. */
const CORNER_SYMBOL: Record<Corner, string> = { tr: 'triangle', tl: 'circle', br: 'diamond', bl: 'path://M0,0 L10,0 L5,9 Z' };

export function buildScatter(c: Ctx): Built {
  const numeric = visibleKeys(c).filter((k) => isNumericKind(column(c, k).kind));
  const xKey = c.spec.x ?? numeric[0];
  const yKey = c.spec.y?.[0] ?? numeric.find((k) => k !== xKey);
  if (!xKey || !yKey || !c.rows.length) return empty(c, 'A scatter needs two numeric columns (x and y).');
  const xCol = column(c, xKey, 'value');
  const yCol = column(c, yKey, 'value');
  const nameKey = pickLabelKey(c, c.spec.group);
  const nameCol = nameKey ? column(c, nameKey) : null;
  // Another index on the rows (RGI) goes into the tooltip.
  const extraKey = visibleKeys(c).find((k) => k !== xKey && k !== yKey && /(^|_)rgi(_|$)/i.test(k));
  const pts = c.rows
    .map((r, row) => {
      const raw = nameKey ? cell(r, nameKey) : undefined;
      const name = nameKey && nameCol ? label(raw, nameCol) : '';
      const full = nameCol?.kind === 'hotel' ? hotelLabel(raw, 'full') : name;
      return { row, name, full, aliases: [full, String(raw ?? '')], x: numberAt(r, xKey), y: numberAt(r, yKey), extra: extraKey ? numberAt(r, extraKey) : null };
    })
    .filter((p): p is typeof p & { x: number; y: number } => p.x !== null && p.y !== null);
  if (!pts.length) return empty(c, 'No data for this period.');
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const xIndex = isIndex(xCol, xs);
  const yIndex = isIndex(yCol, ys);
  const xRef = xIndex ? 100 : median(xs);
  const yRef = yIndex ? 100 : median(ys);
  const compSet = xIndex && yIndex && isCompSetPair(xCol.key, xCol.label, yCol.key, yCol.label);
  const narrow = c.narrow;

  // The plot box in px: everything below is placed in it, so the grid does not size itself around its labels.
  const tickText = (v: number, col: EvidenceColumn, isIdx: boolean) => (isIdx ? vsCompSet(v) : formatValue(Math.round(v * 10) / 10, col, { axis: true }));
  let xr = zoomRange(xs, xRef);
  let yr = zoomRange(ys, yRef);
  const top = 26;
  const bottom = 44;
  const right = 14;
  const yTicks = (r: AxisRange) => Array.from({ length: Math.round((r.max - r.min) / r.interval) + 1 }, (_, i) => r.min + i * r.interval);
  const plotH = Math.max(80, c.height - top - bottom);
  // The corner captions get a strip of their own at the top and the bottom of the plot.
  if (compSet) {
    const room = ((yr.max - yr.min) * 22) / plotH;
    yr = { ...yr, min: Math.floor((Math.min(yr.min, Math.min(...ys) - room)) / yr.interval) * yr.interval, max: Math.ceil((Math.max(yr.max, Math.max(...ys) + room)) / yr.interval) * yr.interval };
  }
  const left = Math.max(...yTicks(yr).map((v) => textWidth(tickText(v, yCol, yIndex), 11.5))) + 14;
  const plotW = Math.max(120, c.width - left - right);
  const words = (k: Corner) => (narrow ? COMP_SET_CORNERS[k].short : COMP_SET_CORNERS[k].long);
  const capSize = 11;
  const capWidth = (k: Corner) => textWidth(`${CORNER_GLYPH[k]} ${words(k)}`, capSize) + 4;
  // Each side of the comp-set line is wide enough for its corner captions: the axis grows a step at a time.
  if (compSet) {
    const need = (ks: Corner[]) => Math.max(...ks.map(capWidth)) + 16;
    for (let i = 0; i < 8 && ((xr.max - xRef) / (xr.max - xr.min)) * plotW < need(['tr', 'br']); i++) xr = { ...xr, max: xr.max + xr.interval };
    for (let i = 0; i < 8 && ((xRef - xr.min) / (xr.max - xr.min)) * plotW < need(['tl', 'bl']); i++) xr = { ...xr, min: xr.min - xr.interval };
  }
  const box = { x: left, y: top, w: plotW, h: plotH };
  const px = (p: { x: number; y: number }) => ({ x: left + ((p.x - xr.min) / (xr.max - xr.min)) * plotW, y: top + ((yr.max - p.y) / (yr.max - yr.min)) * plotH });

  const corners = pts.map((p) => cornerOf(p.x, p.y, xRef, yRef));
  const tone: Record<Corner, string> = { tr: c.t.pos, tl: c.t.series, br: c.t.cat[3] ?? c.t.cmp, bl: c.t.neg };

  // Corner captions, and the boxes they take (names keep clear of them).
  const capBox = (k: Corner): Rect => {
    const w = capWidth(k);
    return { x: k[1] === 'r' ? left + plotW - 6 - w : left + 6, y: k[0] === 't' ? top + 4 : top + plotH - 4 - 15, w, h: 15 };
  };
  const avoid = compSet ? (['tr', 'tl', 'br', 'bl'] as Corner[]).map(capBox) : [];

  const max = narrow ? 3 : c.width < 720 ? 4 : 5;
  const chosen = pickLabels(pts, { text: `${c.spec.title} ${c.spec.subtitle ?? ''}`, max, xRef, yRef, xSpan: xr.max - xr.min, ySpan: yr.max - yr.min });
  const spots = placeLabels(
    pts.map(px),
    chosen.filter((i) => pts[i].name).map((i) => ({ index: i, width: textWidth(pts[i].name, 11.5) + 2 })),
    box,
    { avoid, radius: 6, height: 15 },
  );

  const xWords = compSet ? { name: narrow ? '← Cheaper · Price · Pricier →' : '← Cheaper · Price vs comp set · Pricier →' } : { name: xCol.label };
  const yName = compSet ? (narrow ? 'Share of demand ↑' : 'Share of demand vs comp set (↑ more guests)') : yCol.label;
  const axisText = { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font };
  const refLabel = (isIdx: boolean, v: number, col: EvidenceColumn) => (isIdx ? 'Comp set' : `median ${formatValue(v, col, { compact: true })}`);
  const tipRows = (p: (typeof pts)[number], k: Corner): TipRow[] => {
    if (!compSet) return [
      { label: xCol.label, value: formatValue(p.x, xCol), color: c.t.series },
      { label: yCol.label, value: formatValue(p.y, yCol), color: c.t.series },
    ];
    return [
      { label: 'Price', value: vsCompSetWords(p.x, 'more than comp set', 'less than comp set') },
      { label: 'Guests', value: vsCompSetWords(p.y, 'more than fair share', 'fewer than fair share') },
      ...(p.extra !== null ? [{ label: 'Revenue per room', value: vsCompSetWords(p.extra, 'above comp set', 'below comp set') }] : []),
    ].map((r, i) => (i === 0 ? { ...r, color: tone[k] } : r));
  };
  const jargon = (p: (typeof pts)[number]) => [`ARI ${p.x.toFixed(1)}`, `MPI ${p.y.toFixed(1)}`, ...(p.extra !== null ? [`RGI ${p.extra.toFixed(1)}`] : [])].join(' · ');

  const option = {
    ...baseOption(c),
    grid: { left, right, top, bottom, containLabel: false },
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (prm: unknown) => {
        const i = (prm as { dataIndex: number }).dataIndex;
        const p = pts[i];
        if (!p) return '';
        const k = corners[i];
        return tip(c, compSet ? `${p.full} · ${COMP_SET_CORNERS[k].long}` : p.full, tipRows(p, k), compSet ? jargon(p) : undefined);
      },
    }),
    xAxis: valueAxis(c, xCol, { ...xr, name: xWords.name, nameLocation: 'middle', nameGap: 28, nameTextStyle: axisText, axisLabel: { ...axisText, formatter: (v: number) => tickText(v, xCol, xIndex) }, splitLine: { show: false } }),
    yAxis: valueAxis(c, yCol, { ...yr, name: yName, nameLocation: 'end', nameGap: 10, nameTextStyle: { ...axisText, align: 'left', padding: [0, 0, 0, -left + 4] }, axisLabel: { ...axisText, formatter: (v: number) => tickText(v, yCol, yIndex) }, splitLine: { show: false } }),
    series: [
      {
        type: 'scatter',
        name: `${yCol.label} by ${xCol.label}`,
        data: pts.map((p, i) => {
          const k = corners[i];
          const spot = spots.get(i);
          const color = compSet ? tone[k] : c.t.series;
          return {
            value: [p.x, p.y],
            symbol: compSet ? CORNER_SYMBOL[k] : 'circle',
            symbolSize: compSet && k !== 'tl' ? 12 : 10,
            itemStyle: { color, borderColor: c.t.surface, borderWidth: 1.5 },
            label: { show: !!spot },
            labelLine: { show: !!spot?.leader },
          };
        }),
        emphasis: { scale: 1.35, itemStyle: { borderColor: c.t.fg, borderWidth: 1.5 } },
        label: { show: false, color: c.t.text, fontSize: 11.5, fontWeight: 500, fontFamily: c.t.font, formatter: (p: { dataIndex: number }) => pts[p.dataIndex].name },
        labelLine: { lineStyle: { color: c.t.muted, width: 1, opacity: 0.7 } },
        // Where each name goes was worked out above; ECharts only gets the dot's real position.
        labelLayout: (p: { dataIndex: number; rect: { x: number; y: number; width: number; height: number } }) => {
          const s = spots.get(p.dataIndex);
          if (!s) return {};
          return { x: p.rect.x + p.rect.width / 2 + s.dx, y: p.rect.y + p.rect.height / 2 + s.dy, align: s.align, verticalAlign: s.verticalAlign };
        },
        markLine: {
          silent: true,
          symbol: 'none',
          animation: false,
          lineStyle: { color: c.t.ref, width: 1, type: 'solid', opacity: 0.6 },
          label: { color: c.t.muted, fontSize: 11, fontFamily: c.t.font },
          data: [
            // An index line is named by its tick ("Comp set"); a median line by its own label.
            { xAxis: xRef, label: { show: !xIndex, formatter: refLabel(xIndex, xRef, xCol), position: 'end' } },
            { yAxis: yRef, label: { show: !yIndex, formatter: refLabel(yIndex, yRef, yCol), position: 'insideEndTop' } },
          ],
        },
        markArea: compSet
          ? {
              silent: true,
              animation: false,
              data: (
                [
                  ['tr', [xRef, yr.max], [xr.max, yRef], 'insideTopRight'],
                  ['tl', [xr.min, yr.max], [xRef, yRef], 'insideTopLeft'],
                  ['br', [xRef, yRef], [xr.max, yr.min], 'insideBottomRight'],
                  ['bl', [xr.min, yRef], [xRef, yr.min], 'insideBottomLeft'],
                ] as const
              ).map(([k, a, b, position]) => [
                {
                  xAxis: a[0],
                  yAxis: a[1],
                  itemStyle: { color: mix(tone[k], c.t.surface, c.t.mode === 'dark' ? 0.1 : 0.07) },
                  label: {
                    show: true,
                    position,
                    distance: 6,
                    formatter: `{g|${CORNER_GLYPH[k]}} ${words(k)}`,
                    color: c.t.muted,
                    fontSize: capSize,
                    fontFamily: c.t.font,
                    rich: { g: { color: tone[k], fontSize: capSize - 1, fontFamily: c.t.font } },
                  },
                },
                { xAxis: b[0], yAxis: b[1] },
              ]),
            }
          : undefined,
      },
    ],
  };
  const count = (k: Corner) => corners.filter((x) => x === k).length;
  const pointText = (p: (typeof pts)[number], i: number) =>
    compSet
      ? `${p.full}: ${COMP_SET_CORNERS[corners[i]].long.toLowerCase()}. ${tipRows(p, corners[i]).map((r) => `${r.label} ${r.value}`).join(', ')}. ${jargon(p)}.`
      : `${p.full}: ${xCol.label} ${formatValue(p.x, xCol)}, ${yCol.label} ${formatValue(p.y, yCol)}`;
  return {
    render: 'echarts',
    kind: 'scatter',
    option,
    points: pts.map((p, i) => ({ seriesIndex: 0, dataIndex: i, text: pointText(p, i) })),
    rows: pts.map((p) => p.row),
    legend: [],
    table: tableModel(c, specKeys(c.spec)),
    summary: compSet
      ? summary(c, `Each hotel's price against its share of demand, both against its comp set, for ${pts.length} hotels.`, (['tr', 'tl', 'br', 'bl'] as Corner[]).map((k) => `${COMP_SET_CORNERS[k].long}: ${count(k)}.`).join(' '))
      : summary(c, `Scatter plot of ${yCol.label} against ${xCol.label} for ${pts.length} points.`, `${count('tr')} of ${pts.length} are at or above ${refLabel(xIndex, xRef, xCol)} on both.`),
  };
}

/* ───────── Radar ───────── */

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
