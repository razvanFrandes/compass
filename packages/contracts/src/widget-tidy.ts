import type { EvidenceColumn } from './evidence.ts';
import type { WidgetSpec } from './widgets.ts';

/**
 * What a widget shows of its columns, tidied the same way by the server (show_widget) and by the web (before a
 * chart draws it, also for widgets saved before this rule):
 *
 *  - A label column that says the same on every row ("Period from: Sat 21 Nov 2026" on each of six rows) is hidden,
 *    and said once in the subtitle unless the subtitle already says it. A column the chart draws (x, group, compare)
 *    stays: hiding it would change the chart. Numbers stay: a figure that happens to repeat is still a figure.
 *  - A unit the label already says is dropped: "Room nights (room nights)" says it twice.
 *
 * The rows are never touched. Pure and idempotent.
 */

const NUMERIC = new Set(['number', 'count', 'currency', 'percent']);
const SUBTITLE_MAX = 140;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

export interface TidyOptions {
  /** A hotel's name from its code. Without it a constant hotel is hidden but never written as its code. */
  hotelName?: (code: string) => string | undefined;
}

type Tidied = Pick<WidgetSpec, 'subtitle' | 'y'> & { columns: EvidenceColumn[] };

/** A unit the label already carries is dropped; the same column object when there is nothing to drop. */
export function withoutRepeatedUnit(column: EvidenceColumn): EvidenceColumn {
  const unit = column.unit?.trim().toLowerCase();
  if (!unit || !column.label.toLowerCase().includes(unit)) return column;
  const { unit: _unit, ...rest } = column;
  return rest;
}

/** How the subtitle states a constant value, and the texts that mean it is already stated. */
function stated(column: EvidenceColumn, value: unknown, options: TidyOptions): { text: string | null; already: string[] } {
  const raw = String(value);
  const date = ISO_DATE.exec(raw);
  if (date && (column.kind === 'date' || column.kind === 'month')) {
    const [, y, m, d] = date;
    const month = MONTHS[Number(m) - 1]!;
    if (column.kind === 'month') return { text: `${column.label} ${month} ${y}`, already: [`${month} ${y}`, `${month}`] };
    const day = DAYS[new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay()]!;
    return { text: `${column.label} ${day} ${Number(d)} ${month} ${y}`, already: [`${Number(d)} ${month}`, `${month} ${Number(d)}`] };
  }
  if (column.kind === 'hotel') {
    const name = options.hotelName?.(raw);
    return { text: name ?? null, already: name ? [name, raw] : [raw] };
  }
  return { text: `${column.label}: ${raw}`, already: [raw] };
}

export function tidyWidget(widget: Pick<WidgetSpec, 'kind' | 'subtitle' | 'x' | 'y' | 'group' | 'compare'> & { rows: readonly Record<string, unknown>[]; columns: readonly EvidenceColumn[] }, options: TidyOptions = {}): Tidied {
  const { rows } = widget;
  const drawn = new Set([widget.x, widget.group, widget.compare, ...(widget.kind === 'table' ? [] : (widget.y ?? []))].filter(Boolean));
  let subtitle = widget.subtitle;
  let changed = false;
  const constant: string[] = [];

  const columns = widget.columns.map((original) => {
    let column = withoutRepeatedUnit(original);
    if (column !== original) changed = true;
    if (column.hidden || NUMERIC.has(column.kind) || drawn.has(column.key) || rows.length < 2) return column;
    const first = rows[0]![column.key];
    if (first === null || first === undefined || first === '' || typeof first === 'object') return column;
    if (!rows.every((row) => row[column.key] === first)) return column;

    constant.push(column.key);
    changed = true;
    column = { ...column, hidden: true };
    const { text, already } = stated(column, first, options);
    const said = (subtitle ?? '').toLowerCase();
    if (text && !already.some((part) => said.includes(part.toLowerCase()))) {
      const next = subtitle ? `${subtitle} · ${text}` : text;
      if (next.length <= SUBTITLE_MAX) subtitle = next;
    }
    return column;
  });

  // A table lists the columns it was asked for: not one that says the same on every row, unless nothing else is left.
  let y = widget.y;
  if (widget.kind === 'table' && y && constant.length) {
    const kept = y.filter((key) => !constant.includes(key));
    if (kept.length && kept.length !== y.length) y = kept;
  }

  return { subtitle, y, columns: changed ? columns : (widget.columns as EvidenceColumn[]) };
}
