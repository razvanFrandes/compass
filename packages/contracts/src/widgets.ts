import { z } from 'zod';
import type { Evidence, EvidenceColumn } from './evidence.ts';

/**
 * Widgets: generative UI drawn from tool rows (docs/round2-contracts.md §3).
 *
 * Kassandra's `show_widget` tool names a previous tool result (`sourceCallId`) and its column keys. The server checks
 * that the keys exist and that the kind fits the data, then copies that result's rows, columns and evidence into the
 * widget. The model never supplies a number.
 */

export const WIDGET_KINDS = [
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
] as const;
export const WidgetKind = z.enum(WIDGET_KINDS);
export type WidgetKind = z.infer<typeof WidgetKind>;

export const WIDGET_FORMATS = ['number', 'percent', 'currency', 'count'] as const;

/** A widget never carries more rows than this; a board widget neither. */
export const WIDGET_MAX_ROWS = 200;

const columnKey = z.string().min(1).max(64);

/**
 * What a widget shows. What `x`, `y`, `group` and `compare` mean depends on the kind: see "Widgets" in docs/api.md.
 * The server stores only the fields the kind uses, and fills `format` from the first `y` column when it is left out.
 */
export const WidgetSpec = z.object({
  kind: WidgetKind,
  /** A conclusion, e.g. "Lisbon is 15.9% behind last year for December". */
  title: z.string().trim().min(3).max(140),
  /** Scope line: hotels and period. */
  subtitle: z.string().trim().max(140).optional(),
  /** The tool_result whose rows feed it. */
  sourceCallId: z.string().min(1).max(128),
  /** Column key: the axis, the label or the source, by kind. */
  x: columnKey.optional(),
  /** Column keys: the series, the stages or the table's columns, by kind. */
  y: z.array(columnKey).min(1).max(12).optional(),
  /** Column key for the series split, the slices or the target, by kind. */
  group: columnKey.optional(),
  /** Column key for the comparison series (last year, budget). */
  compare: columnKey.optional(),
  format: z.enum(WIDGET_FORMATS).optional(),
});
export type WidgetSpec = z.infer<typeof WidgetSpec>;

/** A widget as the chat sends it (`tool_result.widget`): the spec with the rows it draws and where they came from. */
export type Widget = WidgetSpec & { rows: Record<string, unknown>[]; columns: EvidenceColumn[]; evidence: Evidence };
