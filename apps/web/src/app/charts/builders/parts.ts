import { formatValue } from '../format';
import { catColor, inkOn, mix, markRadius } from '../tokens';
import type { EvidenceColumn } from '../widget-types';
import { buildBar } from './cartesian';
import { type Built, type Ctx, type LegendItem, baseOption, cell, column, distinct, empty, extremes, label, numberAt, pickLabelKey, pickValueKey, specKeys, summary, tableModel, textWidth, tip, tooltip, valueColumn } from './shared';

/* Parts of a whole and flows: pie, donut, funnel, treemap and sankey. */

interface Part {
  name: string;
  value: number;
}

function parts(c: Ctx): { parts: Part[]; col: EvidenceColumn; labelKey?: string } {
  const labelKey = pickLabelKey(c, c.spec.group, c.spec.x);
  const yKey = pickValueKey(c);
  const col = valueColumn(c, yKey);
  if (!labelKey || !yKey) return { parts: [], col };
  const lc = column(c, labelKey);
  const out: Part[] = [];
  for (const r of c.rows) {
    const v = numberAt(r, yKey);
    if (v !== null) out.push({ name: label(cell(r, labelKey), lc), value: v });
  }
  return { parts: out, col, labelKey };
}

const share = (v: number, total: number) => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '–');

/* ───────── Pie and donut ───────── */

export const PIE_MIN = 2;
export const PIE_MAX = 7;

function pieLike(c: Ctx, donut: boolean): Built {
  const { parts: ps, col, labelKey } = parts(c);
  if (!ps.length) return empty(c, 'No data for this period.');
  const name = donut ? 'donut' : 'pie';
  // A pie only reads for a few parts of one whole; anything else is honest as bars.
  if (ps.length < PIE_MIN || ps.length > PIE_MAX || ps.some((p) => p.value < 0)) {
    const why = ps.some((p) => p.value < 0) ? `A ${name} can’t show negative parts` : ps.length > PIE_MAX ? `${ps.length} parts are too many for a ${name} (it works for ${PIE_MIN} to ${PIE_MAX})` : `A ${name} needs at least ${PIE_MIN} parts`;
    return buildBar({ ...c, spec: { ...c.spec, kind: 'bar', x: labelKey, group: undefined, compare: undefined } }, `${why}, so this is shown as bars.`);
  }
  const total = ps.reduce((s, p) => s + p.value, 0);
  const colors = ps.map((p, i) => catColor(c.t, i, p.name));
  const outside = !c.narrow;
  const option = {
    ...baseOption(c),
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (p: unknown) => {
        const i = (p as { dataIndex: number }).dataIndex;
        return tip(c, ps[i].name, [{ label: col.label, value: formatValue(ps[i].value, col), color: colors[i] }, { label: 'Share', value: share(ps[i].value, total), muted: true }]);
      },
    }),
    series: [
      {
        type: 'pie',
        name: col.label,
        radius: donut ? ['54%', outside ? '78%' : '88%'] : [0, outside ? '74%' : '86%'],
        center: ['50%', '50%'],
        startAngle: 90,
        clockwise: true,
        avoidLabelOverlap: true,
        // Parts are separated by a gap in the surface colour, never by an outline.
        itemStyle: { borderColor: c.t.surface, borderWidth: 2, borderRadius: markRadius(c.t, donut ? 3 : 2) },
        emphasis: { scale: true, scaleSize: 3 },
        data: ps.map((p, i) => ({ name: p.name, value: p.value, itemStyle: { color: colors[i] } })),
        label: outside
          ? {
              show: true,
              position: 'outside',
              fontFamily: c.t.font,
              formatter: (p: { dataIndex: number }) => `{n|${ps[p.dataIndex].name}}\n{s|${share(ps[p.dataIndex].value, total)}}`,
              rich: { n: { color: c.t.text, fontSize: 12, lineHeight: 16, fontFamily: c.t.font }, s: { color: c.t.muted, fontSize: 11.5, lineHeight: 15, fontFamily: c.t.font } },
            }
          : { show: false },
        labelLine: { show: outside, length: 8, length2: 10, lineStyle: { color: c.t.muted, opacity: 0.6 } },
      },
    ],
    graphic: donut
      ? [
          {
            // The hole carries the whole: the total and what it is a total of.
            type: 'text',
            left: 'center',
            top: 'middle',
            silent: true,
            style: {
              text: `{v|${formatValue(total, col, { compact: true })}}\n{l|Total}`,
              textAlign: 'center',
              rich: { v: { fill: c.t.fg, fontSize: c.compact ? 18 : 22, fontWeight: 600, fontFamily: c.t.font, lineHeight: c.compact ? 24 : 28 }, l: { fill: c.t.muted, fontSize: 11.5, fontFamily: c.t.font, lineHeight: 16 } },
            },
          },
        ]
      : undefined,
  };
  // On a phone the names move to the legend, each with its share, so identity never rests on colour alone.
  const legend: LegendItem[] = ps.map((p, i) => ({ label: outside ? p.name : `${p.name} ${share(p.value, total)}`, color: colors[i], mark: 'solid' }));
  return {
    render: 'echarts',
    kind: donut ? 'donut' : 'pie',
    option,
    points: ps.map((p, i) => ({ seriesIndex: 0, dataIndex: i, text: `${p.name}: ${formatValue(p.value, col)}, ${share(p.value, total)} of the total` })),
    legend: outside ? [] : legend,
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `${donut ? 'Donut' : 'Pie'} chart with ${ps.length} parts, total ${formatValue(total, col)}.`, ps.map((p) => `${p.name} ${share(p.value, total)}`).join(', ') + '.'),
  };
}

export const buildPie = (c: Ctx): Built => pieLike(c, false);
export const buildDonut = (c: Ctx): Built => pieLike(c, true);

/* ───────── Funnel ───────── */

interface StageFunnel {
  name: string;
  stages: Part[];
}

/**
 * Funnels whose stages are columns: `y` names them in order and each row is one funnel (mobile next to desktop),
 * named by `x`. This is the shape the web funnel tool returns. Null when `y` is one column: the stages are then rows.
 */
function stageFunnels(c: Ctx): StageFunnel[] | null {
  const keys = c.spec.y ?? [];
  if (keys.length < 2) return null;
  const xKey = c.spec.x;
  const nameCol = xKey ? column(c, xKey) : null;
  return c.rows
    .slice(0, 4)
    .map((r) => ({
      name: xKey && nameCol ? label(cell(r, xKey), nameCol) : '',
      stages: keys.map((k) => ({ name: valueColumn(c, k).label, value: numberAt(r, k) })).filter((s): s is Part => s.value !== null),
    }))
    .filter((f) => f.stages.length > 0);
}

const FUNNEL_SHAPE = { type: 'funnel', sort: 'none', gap: 2, minSize: '6%', maxSize: '100%' } as const;

/** Two to four funnels side by side, one per row: the same stages down each, shares of each funnel's own first stage. */
function buildFunnels(c: Ctx, funnels: StageFunnel[], col: EvidenceColumn): Built {
  const stageNames = funnels[0].stages.map((s) => s.name);
  const n = funnels.length;
  const top = 28;
  const bottom = 6;
  // Wide: the stage names sit once on the left. On a phone there is no room, so each label carries its stage name.
  const namesW = c.narrow ? 0 : Math.min(Math.max(...stageNames.map((s) => textWidth(s, 12))) + 16, Math.round(c.width * 0.24));
  const slot = (c.width - namesW) / n;
  const shapeW = Math.round(slot * (c.narrow ? 0.4 : 0.5));
  const lefts = funnels.map((_, i) => Math.round(namesW + i * slot + 2));
  const ofTop = (f: StageFunnel, j: number) => share(f.stages[j].value, f.stages[0].value || 1);
  const ofPrev = (f: StageFunnel, j: number) => (j === 0 ? null : share(f.stages[j].value, f.stages[j - 1].value || 1));
  const value = (f: StageFunnel, j: number) => formatValue(f.stages[j].value, col, { compact: true, unit: false });
  const colorOf = (f: StageFunnel, j: number) => mix(c.t.series, c.t.surface, 1 - (0.62 * j) / Math.max(1, f.stages.length - 1));
  const rich = {
    n: { color: c.t.text, fontSize: 12, lineHeight: 16, fontFamily: c.t.font, fontWeight: 500 },
    v: { color: c.t.muted, fontSize: 11.5, lineHeight: 15, fontFamily: c.t.font },
  };
  const series = funnels.map((f, i) => ({
    ...FUNNEL_SHAPE,
    name: f.name,
    top,
    bottom,
    left: lefts[i],
    width: shapeW,
    itemStyle: { borderWidth: 0, borderRadius: markRadius(c.t, 2) },
    emphasis: { disabled: false, label: { fontWeight: 500 } },
    labelLine: { show: false },
    data: f.stages.map((s, j) => ({ name: s.name, value: s.value, itemStyle: { color: colorOf(f, j) } })),
    label: {
      show: true,
      position: 'right',
      fontFamily: c.t.font,
      formatter: (p: { dataIndex: number }) => (c.narrow ? `{n|${f.stages[p.dataIndex].name}}\n{v|${value(f, p.dataIndex)} · ${ofTop(f, p.dataIndex)}}` : `{n|${value(f, p.dataIndex)}}  {v|${ofTop(f, p.dataIndex)}}`),
      rich,
    },
  }));
  // ECharts gives every stage the same height, so the names on the left can be placed without measuring the chart.
  const stageH = (c.height - top - bottom - FUNNEL_SHAPE.gap * (stageNames.length - 1)) / stageNames.length;
  const text = (x: number, y: number, value: string, align: 'center' | 'right', fill: string, weight: number) => ({
    type: 'text',
    silent: true,
    x,
    y,
    style: { text: value, textAlign: align, textVerticalAlign: 'middle', fill, fontSize: 12, fontFamily: c.t.font, fontWeight: weight },
  });
  const option = {
    ...baseOption(c),
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (p: unknown) => {
        const { seriesIndex, dataIndex: j } = p as { seriesIndex: number; dataIndex: number };
        const f = funnels[seriesIndex];
        if (!f?.stages[j]) return '';
        const prev = ofPrev(f, j);
        return tip(c, `${f.name} · ${f.stages[j].name}`, [{ label: col.label, value: formatValue(f.stages[j].value, col), color: colorOf(f, j) }, { label: `Of ${f.stages[0].name.toLowerCase()}`, value: ofTop(f, j), muted: true }, ...(prev ? [{ label: 'Of the previous stage', value: prev, muted: true }] : [])]);
      },
    }),
    graphic: [
      ...funnels.map((f, i) => text(lefts[i] + shapeW / 2, 11, f.name, 'center', c.t.fg, 600)),
      ...(c.narrow ? [] : stageNames.map((name, j) => text(namesW - 10, top + j * (stageH + FUNNEL_SHAPE.gap) + stageH / 2, name, 'right', c.t.text, 500))),
    ],
    series,
  };
  return {
    render: 'echarts',
    kind: 'funnel',
    option,
    points: funnels.flatMap((f, i) =>
      f.stages.map((s, j) => ({ seriesIndex: i, dataIndex: j, text: `${f.name}, ${s.name}: ${formatValue(s.value, col)}, ${ofTop(f, j)} of ${f.stages[0].name.toLowerCase()}${ofPrev(f, j) ? `, ${ofPrev(f, j)} of the previous stage` : ''}` })),
    ),
    legend: [],
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `${n} funnels with ${stageNames.length} stages each.`, funnels.map((f) => `${f.name}: ${f.stages.map((s, j) => `${s.name} ${formatValue(s.value, col)} (${ofTop(f, j)})`).join(', ')}`).join('. ') + '.'),
  };
}

export function buildFunnel(c: Ctx): Built {
  // Stages are the y columns (one funnel per row), or the rows (one y column).
  const byColumn = stageFunnels(c);
  if (byColumn && byColumn.length > 1) return buildFunnels(c, byColumn, valueColumn(c, c.spec.y?.[0]));
  const { parts: ps, col } = byColumn ? { parts: byColumn[0]?.stages ?? [], col: valueColumn(c, c.spec.y?.[0]) } : parts(c);
  if (!ps.length) return empty(c, 'No stages to show.');
  const top = ps[0].value || 1;
  // One hue stepping down: the stages are an order, not categories.
  const colors = ps.map((_, i) => mix(c.t.series, c.t.surface, 1 - (0.62 * i) / Math.max(1, ps.length - 1)));
  const ofTop = (i: number) => share(ps[i].value, top);
  const ofPrev = (i: number) => (i === 0 ? null : share(ps[i].value, ps[i - 1].value || 1));
  const data = ps.map((p, i) => ({ name: p.name, value: p.value, itemStyle: { color: colors[i] } }));
  const rich = { n: { color: c.t.text, fontSize: 12, lineHeight: 16, fontFamily: c.t.font, fontWeight: 500 }, v: { color: c.t.muted, fontSize: 11.5, lineHeight: 15, fontFamily: c.t.font } };
  // Value and share sit in two right-aligned columns of fixed width, so they line up down the funnel.
  const valueW = Math.max(...ps.map((p) => formatValue(p.value, col, { compact: true, unit: false }).length)) * 7.2 + 4;
  const columns = { n: { ...rich.n, width: valueW, align: 'right' }, v: { ...rich.v, width: 50, align: 'right' } };
  const shape = { type: 'funnel', sort: 'none', gap: 2, minSize: '6%', maxSize: '100%', top: 6, bottom: 6, itemStyle: { borderWidth: 0, borderRadius: markRadius(c.t, 2) }, emphasis: { disabled: false, label: { fontWeight: 500 } }, labelLine: { show: false } };
  const valueText = (i: number) => `${formatValue(ps[i].value, col, { compact: true, unit: false })} · ${ofTop(i)}`;
  const series = c.narrow
    ? [{ ...shape, name: col.label, data, left: 4, width: '42%', funnelAlign: 'left', label: { show: true, position: 'right', fontFamily: c.t.font, formatter: (p: { dataIndex: number }) => `{n|${ps[p.dataIndex].name}}\n{v|${valueText(p.dataIndex)}}`, rich } }]
    : [
        { ...shape, name: col.label, data, left: '30%', width: '40%', label: { show: true, position: 'left', fontFamily: c.t.font, formatter: (p: { dataIndex: number }) => `{n|${ps[p.dataIndex].name}}`, rich } },
        // The same shape again, invisible, to carry the values on the right.
        { ...shape, name: `${col.label} values`, data: data.map((d) => ({ ...d, itemStyle: { color: 'transparent' } })), left: '30%', width: '40%', silent: true, z: 1, label: { show: true, position: 'right', fontFamily: c.t.font, formatter: (p: { dataIndex: number }) => `{n|${formatValue(ps[p.dataIndex].value, col, { compact: true, unit: false })}}{v|${ofTop(p.dataIndex)}}`, rich: columns }, tooltip: { show: false } },
      ];
  const option = {
    ...baseOption(c),
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (p: unknown) => {
        const i = (p as { dataIndex: number }).dataIndex;
        const prev = ofPrev(i);
        return tip(c, ps[i].name, [{ label: col.label, value: formatValue(ps[i].value, col), color: colors[i] }, { label: `Of ${ps[0].name.toLowerCase()}`, value: ofTop(i), muted: true }, ...(prev ? [{ label: 'Of the previous stage', value: prev, muted: true }] : [])]);
      },
    }),
    series,
  };
  return {
    render: 'echarts',
    kind: 'funnel',
    option,
    points: ps.map((p, i) => ({ seriesIndex: 0, dataIndex: i, text: `${p.name}: ${formatValue(p.value, col)}, ${ofTop(i)} of ${ps[0].name.toLowerCase()}${ofPrev(i) ? `, ${ofPrev(i)} of the previous stage` : ''}` })),
    legend: [],
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Funnel with ${ps.length} stages.`, ps.map((p, i) => `${p.name} ${formatValue(p.value, col)} (${ofTop(i)})`).join(', ') + '.'),
  };
}

/* ───────── Treemap ───────── */

export function buildTreemap(c: Ctx): Built {
  const yKey = pickValueKey(c);
  const leafKey = pickLabelKey(c, c.spec.x, c.spec.group);
  if (!yKey || !leafKey || !c.rows.length) return empty(c, 'No data for this period.');
  const col = valueColumn(c, yKey);
  const leafCol = column(c, leafKey);
  const parentKey = c.spec.group && c.spec.x && c.spec.group !== c.spec.x ? c.spec.group : null;
  const leaves = c.rows.map((r) => ({ name: label(cell(r, leafKey), leafCol), parent: parentKey ? String(cell(r, parentKey) ?? '') : '', value: Math.max(0, numberAt(r, yKey) ?? 0) })).filter((l) => l.value > 0);
  if (!leaves.length) return empty(c, 'No data for this period.');
  const total = leaves.reduce((s, l) => s + l.value, 0);
  const max = Math.max(...leaves.map((l) => l.value));
  const parents = distinct(leaves.map((l) => l.parent));
  const leafNode = (l: (typeof leaves)[number], base: string) => {
    // Within one hue, larger parts are stronger: size and tone say the same thing.
    const fill = mix(base, c.t.surface, parentKey ? 0.5 + 0.5 * (l.value / max) : 0.34 + 0.66 * (l.value / max));
    const big = l.value / total >= 0.035;
    return { name: l.name, value: l.value, itemStyle: { color: fill }, label: { show: big, color: inkOn(fill) }, parent: l.parent };
  };
  const data = parentKey ? parents.map((p, i) => ({ name: p, itemStyle: { color: catColor(c.t, i, p) }, children: leaves.filter((l) => l.parent === p).map((l) => leafNode(l, catColor(c.t, i, p))) })) : leaves.map((l) => leafNode(l, c.t.series));
  const option = {
    ...baseOption(c),
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (p: unknown) => {
        const q = p as { name: string; value: number; color?: string; treePathInfo?: { name: string }[] };
        const path = (q.treePathInfo ?? []).map((x) => x.name).filter(Boolean);
        return tip(c, path.length > 1 ? path.join(' › ') : q.name, [{ label: col.label, value: formatValue(q.value, col), color: typeof q.color === 'string' ? q.color : undefined }, { label: 'Share', value: share(q.value, total), muted: true }]);
      },
    }),
    series: [
      {
        type: 'treemap',
        name: col.label,
        data,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        animationDurationUpdate: c.motion ? 260 : 0,
        label: { show: true, position: 'insideTopLeft', distance: 6, fontFamily: c.t.font, fontSize: 12, lineHeight: 16, overflow: 'truncate', formatter: (p: { name: string; value: number }) => `${p.name}\n${formatValue(p.value, col, { compact: true })}` },
        upperLabel: parentKey ? { show: true, height: 22, color: c.t.text, fontFamily: c.t.font, fontSize: 11.5, fontWeight: 500, overflow: 'truncate' } : { show: false },
        itemStyle: { borderColor: c.t.surface, borderWidth: 0, gapWidth: 2 },
        levels: parentKey ? [{ itemStyle: { borderWidth: 0, gapWidth: 4 }, upperLabel: { show: false } }, { itemStyle: { borderColor: c.t.surface, borderWidth: 0, gapWidth: 2 }, upperLabel: { show: true } }, { itemStyle: { gapWidth: 2 } }] : [{ itemStyle: { borderWidth: 0, gapWidth: 2 } }],
        emphasis: { itemStyle: { borderColor: c.t.fg }, upperLabel: { color: c.t.fg } },
      },
    ],
  };
  return {
    render: 'echarts',
    kind: 'treemap',
    option,
    points: [],
    // Each group is named on its own block, so there is no legend to match against.
    legend: [],
    table: tableModel(c, specKeys(c.spec)),
    summary: summary(c, `Treemap with ${leaves.length} parts, total ${formatValue(total, col)}.`, extremes(leaves.map((l) => ({ name: l.name, value: l.value, text: formatValue(l.value, col) })))),
  };
}

/* ───────── Sankey ───────── */

export interface Flow {
  source: string;
  target: string;
  value: number;
}

/** True when the flows loop back on themselves: a sankey can only draw a one-way flow. */
export function hasCycle(flows: Flow[]): boolean {
  const out = new Map<string, string[]>();
  for (const f of flows) out.set(f.source, [...(out.get(f.source) ?? []), f.target]);
  const state = new Map<string, 1 | 2>();
  const visit = (n: string): boolean => {
    if (state.get(n) === 1) return true;
    if (state.get(n) === 2) return false;
    state.set(n, 1);
    for (const m of out.get(n) ?? []) if (visit(m)) return true;
    state.set(n, 2);
    return false;
  };
  return [...out.keys()].some(visit);
}

export function buildSankey(c: Ctx): Built {
  const sourceKey = c.spec.x;
  const targetKey = c.spec.group;
  const yKey = pickValueKey(c);
  const table = tableModel(c, specKeys(c.spec));
  if (!sourceKey || !targetKey || !yKey) return { ...empty(c, 'This flow can’t be drawn: it needs a from, a to and a value. Ask Kassandra for it again.'), table };
  const col = valueColumn(c, yKey);
  const flows: Flow[] = [];
  for (const r of c.rows) {
    const v = numberAt(r, yKey);
    const s = cell(r, sourceKey);
    const t = cell(r, targetKey);
    if (v !== null && v > 0 && s !== null && s !== undefined && t !== null && t !== undefined) flows.push({ source: String(s), target: String(t), value: v });
  }
  if (!flows.length) return empty(c, 'No flows to show.');
  if (hasCycle(flows)) return { render: 'table', kind: 'table', table, legend: [], note: 'These flows loop back on themselves, so they are shown as a table.', summary: summary(c, `Table with ${table.rows.length} rows.`) };

  const names = distinct(flows.flatMap((f) => [f.source, f.target]));
  const targets = new Set(flows.map((f) => f.target));
  const sources = new Set(flows.map((f) => f.source));
  const roots = names.filter((n) => !targets.has(n));
  const inflow = (n: string) => flows.filter((f) => f.target === n).reduce((s, f) => s + f.value, 0);
  const outflow = (n: string) => flows.filter((f) => f.source === n).reduce((s, f) => s + f.value, 0);
  const size = (n: string) => Math.max(inflow(n), outflow(n));
  const total = roots.reduce((s, n) => s + outflow(n), 0);
  // Where the flow starts gets the hues; everything downstream is neutral, so the eye follows the sources.
  const color = (n: string) => (roots.includes(n) ? catColor(c.t, roots.indexOf(n), n) : c.t.grey);
  const option = {
    ...baseOption(c),
    tooltip: tooltip(c, {
      trigger: 'item',
      formatter: (p: unknown) => {
        const q = p as { dataType?: string; name: string; data: { source?: string; target?: string; value?: number } };
        if (q.dataType === 'edge') return tip(c, `${q.data.source} → ${q.data.target}`, [{ label: col.label, value: formatValue(q.data.value ?? 0, col), color: color(q.data.source ?? '') }, { label: `Of ${q.data.source}`, value: share(q.data.value ?? 0, outflow(q.data.source ?? '')), muted: true }]);
        return tip(c, q.name, [{ label: col.label, value: formatValue(size(q.name), col), color: color(q.name) }, { label: 'Share', value: share(size(q.name), total), muted: true }]);
      },
    }),
    series: [
      {
        type: 'sankey',
        name: col.label,
        left: 4,
        right: c.narrow ? 4 : 8,
        top: 8,
        bottom: 8,
        nodeWidth: 10,
        nodeGap: c.compact ? 10 : 14,
        nodeAlign: 'justify',
        draggable: false,
        layoutIterations: 32,
        emphasis: { focus: 'adjacency' },
        blur: { lineStyle: { opacity: 0.08 }, itemStyle: { opacity: 0.35 }, label: { opacity: 0.5 } },
        data: names.map((n) => ({
          name: n,
          itemStyle: { color: color(n), borderWidth: 0, borderRadius: markRadius(c.t, 2) },
          // The last column is labelled on its left, so no label leaves the chart.
          label: { position: sources.has(n) ? 'right' : 'left' },
        })),
        links: flows.map((f) => ({ ...f })),
        lineStyle: { color: 'source', opacity: c.t.mode === 'dark' ? 0.32 : 0.26, curveness: 0.5 },
        label: {
          show: true,
          fontFamily: c.t.font,
          formatter: (p: { name: string }) => `{n|${p.name}}${c.narrow ? '' : `  {v|${formatValue(size(p.name), col, { compact: true })}}`}`,
          rich: { n: { color: c.t.text, fontSize: 12, fontFamily: c.t.font }, v: { color: c.t.muted, fontSize: 11.5, fontFamily: c.t.font } },
        },
      },
    ],
  };
  return {
    render: 'echarts',
    kind: 'sankey',
    option,
    points: [],
    legend: [],
    table,
    summary: summary(c, `Flow diagram with ${names.length} nodes and ${flows.length} flows, total ${formatValue(total, col)}.`, flows.slice(0, 8).map((f) => `${f.source} to ${f.target} ${formatValue(f.value, col)}`).join(', ') + '.'),
  };
}
