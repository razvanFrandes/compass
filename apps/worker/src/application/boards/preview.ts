import { BOARD_PREVIEW, type BoardWidget, type BoardWidgetPreview, type WidgetSpec } from '@compass/contracts';

/**
 * A widget as a board's card on the Boards page draws it: the spec with only the columns it uses, and few enough
 * rows that listing 50 boards stays light. A long series is thinned evenly (its first and last rows kept, so the
 * shape holds); a calendar keeps every day up to three months, so no month has holes; a table keeps its first rows.
 */
export function previewOf(widget: BoardWidget): BoardWidgetPreview {
  const keys = usedKeys(widget.spec);
  const limit = widget.spec.kind === 'table' ? BOARD_PREVIEW.tableRows : widget.spec.kind === 'calendar_heatmap' ? BOARD_PREVIEW.calendarDays : BOARD_PREVIEW.rows;
  const rows = widget.spec.kind === 'table' ? widget.rows.slice(0, limit) : thin(widget.rows, limit);
  return {
    id: widget.id,
    spec: widget.spec,
    columns: widget.columns.filter((column) => keys.has(column.key)),
    rows: rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => keys.has(key)))),
  };
}

function usedKeys(spec: WidgetSpec): Set<string> {
  return new Set([spec.x, ...(spec.y ?? []), spec.group, spec.compare].filter((key): key is string => !!key));
}

/** At most `limit` rows, spread evenly from the first to the last. */
function thin<T>(rows: readonly T[], limit: number): T[] {
  if (rows.length <= limit) return [...rows];
  const step = (rows.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, i) => rows[Math.round(i * step)]!);
}
