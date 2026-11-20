import type { Evidence } from '@compass/contracts';

/*
  Round 2 contracts (docs/round2-contracts.md §3–4), as the board UI needs them. When r2/be-widgets-boards lands
  these shapes in @compass/contracts, import them from there and delete this file; the names match.
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

export interface EvidenceColumn {
  key: string;
  label: string;
  kind: 'text' | 'hotel' | 'date' | 'month' | 'number' | 'percent' | 'currency' | 'count' | 'id';
  unit?: string;
  hidden?: boolean;
}

export interface WidgetSpec {
  kind: WidgetKind;
  title: string;
  subtitle?: string;
  sourceCallId: string;
  x?: string;
  y?: string[];
  group?: string;
  compare?: string;
  format?: 'number' | 'percent' | 'currency' | 'count';
}

export type WidgetRow = Record<string, unknown>;

export interface BoardWidget {
  id: string;
  spec: WidgetSpec;
  rows: WidgetRow[];
  columns: EvidenceColumn[];
  evidence: Evidence;
  question?: string;
  addedAt: string;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  hotels: string[];
  widgets: BoardWidget[];
  createdAt: string;
  updatedAt: string;
}

/** What "Add to board" sends (POST /api/boards/:id/widgets). */
export type WidgetPayload = Pick<BoardWidget, 'spec' | 'rows' | 'columns' | 'evidence' | 'question'>;
