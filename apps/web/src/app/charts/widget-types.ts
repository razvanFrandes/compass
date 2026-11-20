/*
  The Round 2 widget contract (docs/round2-contracts.md §2 and §3), mirrored here until
  `@compass/contracts` exports it. The shapes are identical, so the import can be swapped without other changes.
*/

export type WidgetKind =
  | 'kpi'
  | 'kpi_row'
  | 'line'
  | 'area'
  | 'bar'
  | 'stacked_bar'
  | 'grouped_bar'
  | 'pie'
  | 'donut'
  | 'table'
  | 'heatmap'
  | 'calendar_heatmap'
  | 'funnel'
  | 'waterfall'
  | 'bullet'
  | 'sparkline_list'
  | 'scatter'
  | 'treemap'
  | 'gauge'
  | 'radar'
  | 'sankey';

export const WIDGET_KINDS: readonly WidgetKind[] = [
  'kpi',
  'kpi_row',
  'line',
  'area',
  'bar',
  'stacked_bar',
  'grouped_bar',
  'pie',
  'donut',
  'table',
  'heatmap',
  'calendar_heatmap',
  'funnel',
  'waterfall',
  'bullet',
  'sparkline_list',
  'scatter',
  'treemap',
  'gauge',
  'radar',
  'sankey',
];

export interface WidgetSpec {
  kind: WidgetKind;
  /** A conclusion, e.g. "Lisbon is 15.9% behind last year for December". */
  title: string;
  /** Scope line. */
  subtitle?: string;
  /** The tool_result whose rows feed it (the model never supplies numbers). */
  sourceCallId: string;
  /** Column key. */
  x?: string;
  /** Column keys (series). */
  y?: string[];
  /** Column key for series split / slices. */
  group?: string;
  /** Column key for the comparison series (LY, budget). */
  compare?: string;
  format?: 'number' | 'percent' | 'currency' | 'count';
}

export type ColumnKind = 'text' | 'hotel' | 'date' | 'month' | 'number' | 'percent' | 'currency' | 'count' | 'id';

export interface EvidenceColumn {
  /** Row property. */
  key: string;
  /** "Occupancy", "On the books", "Hotel". */
  label: string;
  kind: ColumnKind;
  /** "EUR", "nights", "pts". */
  unit?: string;
  /** Ids, kinds, internal flags: hidden by default in the UI. */
  hidden?: boolean;
}

export type WidgetRow = Readonly<Record<string, unknown>>;
