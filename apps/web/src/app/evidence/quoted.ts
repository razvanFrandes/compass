import { formatCell, isHidden, isNumericKind, rowLabel, visibleColumns, type FormatContext } from './format';
import type { EvidenceColumn, EvidenceRow } from './types';

/*
  The panel leads with the numbers the answer quotes, each traced to the row it came from. The model never
  computes a number, so a figure in the answer should be a cell of some tool result: this finds that cell. A
  figure that matches nothing (a difference the model worked out in words, a rounded total) is simply not listed;
  when nothing matches, the panel shows key figures per tool instead.
*/

/** A number as the answer wrote it. */
export interface AnswerNumber {
  /** The text as written, e.g. "€1.34M". */
  raw: string;
  /** Its magnitude before scaling: 1.34 for "€1.34M". Always positive. */
  value: number;
  decimals: number;
  /** 1, 1e3 (k), 1e6 (M) or 1e9 (bn). */
  scale: number;
  percent: boolean;
  currency: boolean;
}

/** One result the figures can come from. */
export interface FigureTable {
  callId: string;
  /** The human title of the tool call. */
  title: string;
  rows: readonly EvidenceRow[];
  columns: readonly EvidenceColumn[];
}

/** A number in the answer (or a key figure), tied to its cell. */
export interface Figure {
  callId: string;
  rowIndex: number;
  key: string;
  /** The cell at full precision, formatted like the table: "€1,336,633". */
  value: string;
  /** The column: "Pace vs last year". */
  label: string;
  /** The row: "Arbor Lisbon Chiado · Nov 2026". Empty when the row names nothing. */
  context: string;
  /** The tool call's title. */
  source: string;
}

const MONTH = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
const AFTER_MONTH = new RegExp(`^\\s?(?:${MONTH})[a-z]*\\b`, 'i');
const BEFORE_MONTH = new RegExp(`\\b(?:${MONTH})[a-z]*\\.?\\s$`, 'i');
const NUMBER = /(?<![\w.,/])([€$£])?\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?:\s?(%|percent\b|bn\b|million\b|thousand\b|[kKmM]\b))?/g;
const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, bn: 1e9 };
const MAX_ROWS_SCANNED = 500;

/** The numbers an answer states, in order. Dates, times, years, list numbering and bare single digits are left out. */
export function numbersIn(answer: string): AnswerNumber[] {
  const text = answer
    .replace(/`[^`]*`/g, ' ')
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ');
  const found: AnswerNumber[] = [];
  for (const match of text.matchAll(NUMBER)) {
    const [matched, symbol, whole, fraction, unitText] = match;
    const start = match.index;
    // "m" alone is metres as often as millions: only money is scaled by it.
    const suffix = unitText === 'm' && !symbol ? undefined : unitText;
    const raw = suffix === unitText ? matched : matched.slice(0, matched.length - unitText!.length).trimEnd();
    const after = text.slice(start + raw.length, start + raw.length + 12);
    const before = text.slice(Math.max(0, start - 12), start);
    // "20 Nov", "Nov 20", "1st", "3x", "1.": not a figure from the data.
    if (AFTER_MONTH.test(after) || BEFORE_MONTH.test(before)) continue;
    if (!suffix && /^[A-Za-z]/.test(after)) continue;
    if (!suffix && !fraction && !symbol && /^\.(\s|$)/.test(after) && /(^|\n)\s*$/.test(text.slice(0, start))) continue;

    const value = Number(`${whole!.replace(/,/g, '')}${fraction ?? ''}`);
    const unit = suffix?.toLowerCase() ?? '';
    const percent = unit === '%' || unit === 'percent';
    const currency = !!symbol;
    const scale = percent ? 1 : (SCALE[unit] ?? 1);
    const bare = !percent && !currency && scale === 1 && !fraction;
    if (bare && !whole!.includes(',') && value >= 1990 && value <= 2100) continue;
    if (bare && value < 10) continue;
    found.push({ raw: raw.trim(), value, decimals: fraction ? fraction.length - 1 : 0, scale, percent, currency });
  }
  return found;
}

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals + Number.EPSILON * 10) / 10 ** decimals;

/** How well a cell matches a number from the answer: 0 is no match; higher is a closer one. */
function matchScore(cell: number, column: EvidenceColumn, target: AnswerNumber): number {
  if (target.percent && column.kind !== 'percent' && column.kind !== 'number') return 0;
  if (target.currency && column.kind !== 'currency' && column.kind !== 'number' && column.kind !== 'count') return 0;
  if (!target.percent && !target.currency && column.kind === 'percent' && target.decimals === 0 && target.value < 10) return 0;

  const magnitudes = [Math.abs(cell)];
  if (column.kind === 'percent' && (column.unit === 'ratio' || target.percent)) magnitudes.push(Math.abs(cell) * 100);
  const hiddenPenalty = isHidden(column) ? 0.5 : 0;

  for (const magnitude of magnitudes) {
    if (target.scale === 1) {
      if (magnitude === target.value) return 3 - hiddenPenalty;
      // A small bare integer must be the cell itself: "14 events" is not 14.2 of something else.
      const loose = target.percent || target.currency || target.decimals > 0 || target.value >= 100;
      if (loose && round(magnitude, target.decimals) === target.value) return 2 - hiddenPenalty;
    } else if (magnitude >= target.scale / 2 && round(magnitude / target.scale, target.decimals) === target.value) {
      return 2 - hiddenPenalty;
    }
  }
  return 0;
}

function figureAt(table: FigureTable, rowIndex: number, column: EvidenceColumn, context: FormatContext): Figure {
  const row = table.rows[rowIndex]!;
  return {
    callId: table.callId,
    rowIndex,
    key: column.key,
    value: formatCell(row[column.key], column, context),
    label: column.label,
    context: rowLabel(row, table.columns, context),
    source: table.title,
  };
}

/** The numbers in the answer that are a cell of some result, in the order the answer states them. */
export function quotedFigures(answer: string | null | undefined, tables: readonly FigureTable[], context: FormatContext = {}, limit = 8): Figure[] {
  if (!answer) return [];
  const figures: Figure[] = [];
  const taken = new Set<string>();

  for (const target of numbersIn(answer)) {
    let best: { table: FigureTable; rowIndex: number; column: EvidenceColumn; score: number } | null = null;
    for (const table of tables) {
      const columns = table.columns.filter((column) => isNumericKind(column.kind));
      const count = Math.min(table.rows.length, MAX_ROWS_SCANNED);
      for (let rowIndex = 0; rowIndex < count; rowIndex++) {
        const row = table.rows[rowIndex]!;
        for (const column of columns) {
          const cell = row[column.key];
          if (typeof cell !== 'number') continue;
          const score = matchScore(cell, column, target);
          if (score > (best?.score ?? 0) && !taken.has(`${table.callId}:${rowIndex}:${column.key}`)) best = { table, rowIndex, column, score };
        }
      }
    }
    if (!best) continue;
    taken.add(`${best.table.callId}:${best.rowIndex}:${best.column.key}`);
    figures.push(figureAt(best.table, best.rowIndex, best.column, context));
    if (figures.length >= limit) break;
  }
  return figures;
}

/** When the answer quotes nothing we can trace: the first figures of each result, so the panel still leads with numbers. */
export function keyFigures(tables: readonly FigureTable[], context: FormatContext = {}, perTool = 2, limit = 6): Figure[] {
  const figures: Figure[] = [];
  for (const table of tables) {
    const row = table.rows[0];
    if (!row) continue;
    const columns = visibleColumns(table.columns)
      .filter((column) => isNumericKind(column.kind) && typeof row[column.key] === 'number')
      .slice(0, perTool);
    for (const column of columns) {
      figures.push(figureAt(table, 0, column, context));
      if (figures.length >= limit) return figures;
    }
  }
  return figures;
}
