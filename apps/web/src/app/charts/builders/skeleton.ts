import { isNumericKind } from '../format';
import type { EvidenceColumn, WidgetKind, WidgetSpec } from '../widget-types';
import { NARROW, kpiColumns, kpiCount } from './shared';

/*
  What a widget's placeholder looks like before any row has arrived. Only the spec is known (and perhaps the
  columns), so the plan answers the questions the finished layout will answer from the rows: do the bars lie
  down, is there a legend row, how many KPI tiles. The skeleton then has the layout the chart will have.
*/

export interface SkeletonPlan {
  kind: WidgetKind;
  /** Bars lie down (categories are names) rather than stand up (categories are dates). */
  horizontal: boolean;
  /** How many legend entries sit above the plot (0: no legend row). */
  legend: number;
  /** A magnitude scale sits above the plot (heatmaps). */
  ramp: boolean;
  /** The chart will carry a comparison: a second line, a tick on each bar, a second bar. */
  compare: boolean;
  /** KPI tiles and how many sit in a row. */
  tiles: number;
  tileColumns: number;
  /** A KPI with a trend beside it. */
  spark: boolean;
  /** How many series a line, area or grouped chart will draw. */
  series: number;
}

const TIME_KEY = /(date|day|month|week|year|time|period|night)/i;

/** Whether the x column holds names (true) or dates and numbers (false); guessed from the key when no column metadata came. */
export function wordyAxis(spec: Pick<WidgetSpec, 'x' | 'group'>, columns: readonly EvidenceColumn[] = []): boolean {
  const key = spec.x ?? spec.group;
  if (!key) return true;
  const col = columns.find((c) => c.key === key);
  if (col) return col.kind !== 'date' && col.kind !== 'month' && !isNumericKind(col.kind);
  return !TIME_KEY.test(key);
}

export function skeletonPlan(spec: Pick<WidgetSpec, 'kind' | 'x' | 'y' | 'group' | 'compare'>, columns: readonly EvidenceColumn[] = [], width = 640): SkeletonPlan {
  const kind = spec.kind;
  const narrow = width < NARROW;
  const compare = !!spec.compare;
  const split = !!spec.group && spec.group !== spec.x;
  const series = split ? 3 : Math.max(1, spec.y?.length ?? 1) + (compare ? 1 : 0);
  const tiles = kpiCount(spec);
  let legend = 0;
  switch (kind) {
    case 'line':
    case 'area':
      // Wide charts name their series on the line ends; a phone gets a legend.
      legend = series > 1 && (narrow || series > 4) ? Math.min(series, 4) : 0;
      break;
    case 'stacked_bar':
    case 'grouped_bar':
      legend = Math.min(4, Math.max(2, series));
      break;
    case 'radar':
      legend = series > 1 ? Math.min(series, 4) : 0;
      break;
    case 'bar':
    case 'bullet':
    case 'gauge':
      legend = compare ? 2 : 0;
      break;
    case 'waterfall':
      legend = 3;
      break;
    case 'pie':
    case 'donut':
      legend = narrow ? 4 : 0;
      break;
    default:
      legend = 0;
  }
  return {
    kind,
    horizontal: kind === 'bullet' || ((kind === 'bar' || kind === 'stacked_bar' || kind === 'grouped_bar') && wordyAxis(spec, columns)),
    legend,
    ramp: kind === 'heatmap' || kind === 'calendar_heatmap',
    compare,
    tiles,
    tileColumns: kpiColumns(tiles, width),
    spark: (kind === 'kpi' || kind === 'kpi_row') && !!spec.x && !wordyAxis({ x: spec.x }, columns),
    series,
  };
}
