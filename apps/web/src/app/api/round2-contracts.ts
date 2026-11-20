import type { Evidence } from '@compass/contracts';

/**
 * The Round 2 shapes of docs/round2-contracts.md (§1 scope, §2 columns, §3 widgets, §4 boards, §6 voice), as the app
 * uses them. They mirror the document until `@compass/contracts` exports them; then this file re-exports from there.
 */

/** §1. The hotels a question is asked for. Absent or empty means the whole group. */
export interface AskScope {
  hotels: string[];
}

/** §2. How a column of tool rows reads to a person. */
export interface EvidenceColumn {
  key: string;
  label: string;
  kind: 'text' | 'hotel' | 'date' | 'month' | 'number' | 'percent' | 'currency' | 'count' | 'id';
  unit?: string;
  hidden?: boolean;
}

/** §3. */
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

export interface WidgetSpec {
  kind: WidgetKind;
  /** A conclusion, e.g. "Lisbon is 15.9% behind last year for December". */
  title: string;
  subtitle?: string;
  /** The tool result whose rows feed it: the model never supplies numbers. */
  sourceCallId: string;
  x?: string;
  y?: string[];
  group?: string;
  compare?: string;
  format?: 'number' | 'percent' | 'currency' | 'count';
}

/** §3. What a `show_widget` tool result carries: the spec with the rows copied from the tool result it names. */
export type ChatWidget = WidgetSpec & { rows: Record<string, unknown>[]; columns: EvidenceColumn[]; evidence: Evidence };

/** §4. */
export interface BoardWidget {
  id: string;
  spec: WidgetSpec;
  rows: Record<string, unknown>[];
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

/** §6. `POST /api/voice/token`: a temporary Soniox key; the permanent one never reaches the browser. */
export interface VoiceToken {
  apiKey: string;
  expiresAt: string;
  model: string;
  wsUrl: string;
}
