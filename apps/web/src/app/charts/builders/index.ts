import type { WidgetKind } from '../widget-types';
import { buildArea, buildBar, buildBullet, buildGroupedBar, buildLine, buildStackedBar, buildWaterfall } from './cartesian';
import { buildKpi, buildKpiRow, buildSparklineList, buildTable } from './figures';
import { buildCalendarHeatmap, buildHeatmap } from './matrix';
import { buildDonut, buildFunnel, buildPie, buildSankey, buildTreemap } from './parts';
import { buildGauge, buildRadar, buildScatter } from './points';
import { type BuildInput, type Built, type Builder, context, specKeys, summary, tableModel } from './shared';

/** One pure builder per widget kind: rows + columns + spec → what to draw. */
export const BUILDERS: Record<WidgetKind, Builder> = {
  kpi: buildKpi,
  kpi_row: buildKpiRow,
  line: buildLine,
  area: buildArea,
  bar: (c) => buildBar(c),
  stacked_bar: buildStackedBar,
  grouped_bar: buildGroupedBar,
  pie: buildPie,
  donut: buildDonut,
  table: buildTable,
  heatmap: buildHeatmap,
  calendar_heatmap: buildCalendarHeatmap,
  funnel: buildFunnel,
  waterfall: buildWaterfall,
  bullet: buildBullet,
  sparkline_list: buildSparklineList,
  scatter: buildScatter,
  treemap: buildTreemap,
  gauge: buildGauge,
  radar: buildRadar,
  sankey: buildSankey,
};

/** Builds any widget. A kind this version does not know is shown as a table, with a note, never as a blank. */
export function buildWidget(input: BuildInput): Built {
  const c = context(input);
  const builder = BUILDERS[input.spec.kind] as Builder | undefined;
  if (!builder) {
    const table = tableModel(c, specKeys(c.spec));
    return { render: 'table', kind: 'table', table, legend: [], note: `“${String(input.spec.kind)}” is not a chart this version can draw, so the rows are shown as a table.`, summary: summary({ ...c, spec: { ...c.spec, kind: 'table' } }, `Table with ${table.rows.length} rows.`) };
  }
  return builder(c);
}

export { bodyHeight, context, kpiColumns, kpiCount, summaryHead, tableModel, NARROW } from './shared';
export type { BuildInput, Built, Builder, Ctx, KpiModel, LegendItem, PointRef, RampLegend, SparkPath, SparkRow, TableModel } from './shared';
