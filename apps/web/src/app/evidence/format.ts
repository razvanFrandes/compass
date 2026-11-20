import { humanizeKey } from './labels';
import type { EvidenceColumn, EvidenceColumnKind, EvidenceRow } from './types';

/*
  How evidence rows become a readable table: which columns there are (the server's metadata, or inferred from the
  keys and values), and how each value is written. Pure functions, so the table, the quoted figures and the tests
  share one definition of "formatted".
*/

export interface FormatContext {
  /** A hotel's name from its code, or undefined when it is not known (the code is shown then). */
  hotelName?: (code: string) => string | undefined;
  /** The year that goes without saying: the business date's. Other years are written out. */
  baseYear?: number;
}

/** Shown for a value that is missing. */
export const EMPTY_CELL = '–';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;
const NUMERIC_KINDS: readonly EvidenceColumnKind[] = ['number', 'percent', 'currency', 'count'];
const CURRENCY_SYMBOL: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });

export const isNumericKind = (kind: EvidenceColumnKind) => NUMERIC_KINDS.includes(kind);

/* ───────── Numbers ───────── */

function decimalsFor(value: number, max: number): number {
  if (Number.isInteger(value)) return 0;
  return max;
}

/** 1234.5 → "1,234.5"; −12.3 → "−12.3" (a real minus sign, so signs line up in a column). */
export function formatNumber(value: number, maxDecimals = 2, minDecimals = 0): string {
  const text = new Intl.NumberFormat('en-GB', { maximumFractionDigits: maxDecimals, minimumFractionDigits: minDecimals }).format(value);
  return text.replace(/^-/, '−');
}

/** A percentage with at most one decimal: −12.3 → "−12.3%". `ratio` values are fractions (0.1098 → "11%"). */
export function formatPercent(value: number, ratio = false): string {
  const percent = ratio ? value * 100 : value;
  return `${formatNumber(percent, decimalsFor(percent, 1))}%`;
}

/** Money: whole units from 1,000 up, two decimals below (an ADR of 196.56). The symbol only when the unit is known. */
export function formatCurrency(value: number, unit?: string): string {
  const cents = !Number.isInteger(value) && Math.abs(value) < 1000;
  const body = formatNumber(Math.abs(value), cents ? 2 : 0, cents ? 2 : 0);
  const code = unit?.toUpperCase();
  const symbol = code ? (CURRENCY_SYMBOL[code] ?? '') : '';
  const sign = value < 0 ? '−' : '';
  const suffix = code && !symbol ? ` ${code}` : '';
  return `${sign}${symbol}${body}${suffix}`;
}

/* ───────── Dates ───────── */

interface DateParts {
  year: number;
  month: number;
  day: number;
  time: string | null;
}

function parseDate(value: string): DateParts | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, y, mo, d, hh, mm] = match;
  const parts = { year: Number(y), month: Number(mo), day: Number(d), time: hh ? `${hh}:${mm}` : null };
  const time = Date.UTC(parts.year, parts.month - 1, parts.day);
  return Number.isNaN(time) || parts.month > 12 || parts.day > 31 ? null : parts;
}

const utc = (parts: DateParts) => Date.UTC(parts.year, parts.month - 1, parts.day);

/** "2026-11-20" → "Fri 20 Nov"; another year is written ("Sat 15 Nov 2025"); a time is kept ("Tue 17 Nov, 04:12"). */
export function formatDate(value: string, baseYear?: number): string {
  const parts = parseDate(value);
  if (!parts) return value;
  const year = parts.year === baseYear ? '' : ` ${parts.year}`;
  return `${weekdayFmt.format(utc(parts))}${year}${parts.time ? `, ${parts.time}` : ''}`;
}

/** "2026-11-01" or "2026-11" → "Nov 2026". */
export function formatMonth(value: string): string {
  const month = ISO_MONTH.exec(value);
  const parts = month ? { year: Number(month[1]), month: Number(month[2]), day: 1, time: null } : parseDate(value);
  if (!parts) return value;
  return `${monthFmt.format(utc(parts))} ${parts.year}`;
}

/** A period in words: "1–19 Nov 2026", "1 Nov – 31 Dec 2026", "15 Dec 2026 – 14 Jan 2027". */
export function formatPeriod(period: { from: string; to: string }): string {
  const from = parseDate(period.from);
  const to = parseDate(period.to);
  if (!from || !to) return `${period.from} – ${period.to}`;
  if (utc(from) === utc(to)) return `${weekdayFmt.format(utc(to))} ${to.year}`;
  if (from.year === to.year && from.month === to.month) return `${from.day}–${dayFmt.format(utc(to))} ${to.year}`;
  if (from.year === to.year) return `${dayFmt.format(utc(from))} – ${dayFmt.format(utc(to))} ${to.year}`;
  return `${dayFmt.format(utc(from))} ${from.year} – ${dayFmt.format(utc(to))} ${to.year}`;
}

/**
 * The business date in words, with what it means for the rows: "Data as of Fri 20 Nov · earlier stays are actuals,
 * later ones on the books". When the period lies wholly on one side, it says so instead.
 */
export function dataAsOf(businessDate: string, period?: { from: string; to: string } | null): string {
  const day = parseDate(businessDate);
  if (!day) return `Data as of ${businessDate}`;
  const head = `Data as of ${weekdayFmt.format(utc(day))}`;
  const from = period ? parseDate(period.from) : null;
  const to = period ? parseDate(period.to) : null;
  if (from && to) {
    if (utc(to) < utc(day)) return `${head} · this period is all actuals`;
    if (utc(from) >= utc(day)) return `${head} · this period is all on the books, not actuals yet`;
  }
  return `${head} · earlier stays are actuals, later ones on the books`;
}

/** The year of an ISO date, for `FormatContext.baseYear`. */
export function yearOf(isoDate: string | undefined): number | undefined {
  return isoDate ? parseDate(isoDate)?.year : undefined;
}

/* ───────── Columns ───────── */

const HOTEL_KEYS = new Set(['hotel_code', 'hotel', 'hotelcode', 'property_code']);
const MAYBE_HOTEL_KEYS = new Set(['key', 'code', 'group', 'property']);
const ID_KEY = /^(id|uuid|kind)$|_(id|uuid)$/i;
const PERCENT_KEY = /(_pct|_percent|_share|_margin)$|^(pct|share|occupancy|conversion|utilisation|utilization)(_|$)/i;
const RATIO_KEYS = new Set(['pickup_pct']);
const CURRENCY_UNIT_KEY = /_(eur|usd|gbp)$/i;
const MONEY_KEY = /(^|_)(revenue|adr|revpar|trevpar|goppar|gop|rate|cost|commission|price|median|spend)(_|$)/i;
const COUNT_KEY = /(^|_)(rooms|nights|events|attendees|reviews|sessions|searches|bookings|covers|requests|hours|mentions|months|starts|hotels|days)(_|$)/i;
const SNAKE_WORD = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

function present(rows: readonly EvidenceRow[], key: string): unknown[] {
  const values: unknown[] = [];
  for (const row of rows) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== '') values.push(value);
    if (values.length >= 50) break;
  }
  return values;
}

/** What a column holds, read from its key and a sample of its values. */
export function inferColumn(key: string, rows: readonly EvidenceRow[], isHotelCode: (code: string) => boolean = () => false): EvidenceColumn {
  const values = present(rows, key);
  const label = humanizeKey(key);
  const all = (test: (value: unknown) => boolean) => values.length > 0 && values.every(test);

  if (values.some((value) => typeof value === 'object')) return { key, label, kind: 'text', hidden: true };
  if (ID_KEY.test(key)) return { key, label, kind: 'id', hidden: true };
  if (HOTEL_KEYS.has(key.toLowerCase())) return { key, label: 'Hotel', kind: 'hotel' };
  if (MAYBE_HOTEL_KEYS.has(key.toLowerCase()) && all((value) => typeof value === 'string' && isHotelCode(value))) return { key, label: 'Hotel', kind: 'hotel' };

  if (all((value) => typeof value === 'string' && ISO_MONTH.test(value))) return { key, label, kind: 'month' };
  if (all((value) => typeof value === 'string' && parseDate(value) !== null)) {
    const monthly = /period|month/i.test(key) && all((value) => /^\d{4}-\d{2}-01$/.test(value as string));
    return { key, label: monthly && key === 'period' ? 'Month' : label, kind: monthly ? 'month' : 'date' };
  }

  if (all((value) => typeof value === 'number')) {
    const unit = CURRENCY_UNIT_KEY.exec(key)?.[1]?.toUpperCase();
    if (unit) return { key, label, kind: 'currency', unit };
    if (PERCENT_KEY.test(key)) return RATIO_KEYS.has(key) ? { key, label, kind: 'percent', unit: 'ratio' } : { key, label, kind: 'percent' };
    if (MONEY_KEY.test(key) && !/_vs_/.test(key)) return { key, label, kind: 'currency' };
    if (COUNT_KEY.test(key) && all((value) => Number.isInteger(value))) return { key, label, kind: 'count' };
    return { key, label, kind: 'number' };
  }
  return { key, label, kind: 'text' };
}

/**
 * Every column of a result, in display order. The server's metadata wins; a row property it does not mention is
 * kept at the end, hidden, so nothing is silently dropped. Without metadata, kinds and labels are inferred.
 */
export function resolveColumns(rows: readonly EvidenceRow[], serverColumns?: readonly EvidenceColumn[] | null, isHotelCode?: (code: string) => boolean): EvidenceColumn[] {
  const keys: string[] = [];
  for (const row of rows.slice(0, 50)) {
    for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key);
  }
  if (serverColumns?.length) {
    const listed = new Set(serverColumns.map((column) => column.key));
    const extra = keys.filter((key) => !listed.has(key)).map((key) => ({ ...inferColumn(key, rows, isHotelCode), hidden: true }));
    return [...serverColumns.map((column) => ({ ...column, label: column.label?.trim() || humanizeKey(column.key) })), ...extra];
  }
  const columns = keys.map((key) => inferColumn(key, rows, isHotelCode));
  // The hotel's name next to its code says the same thing twice: the code column already shows the name.
  if (columns.some((column) => column.kind === 'hotel')) {
    for (const column of columns) if (column.key === 'hotel_name') column.hidden = true;
  }
  return columns;
}

export const isHidden = (column: EvidenceColumn) => column.hidden === true || column.kind === 'id';

/** Columns a person sees by default. */
export function visibleColumns(columns: readonly EvidenceColumn[]): EvidenceColumn[] {
  const shown = columns.filter((column) => !isHidden(column));
  return shown.length ? shown : [...columns];
}

/** The header text: the label, with a unit the cells do not already carry ("Length of stay (nights)"). */
export function columnHeader(column: EvidenceColumn): string {
  const unit = column.unit?.trim();
  if (!unit || column.kind === 'percent' || column.kind === 'currency' || unit === 'ratio') return column.label;
  return `${column.label} (${unit})`;
}

/* ───────── Cells ───────── */

function plainText(value: unknown, baseYear?: number): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'object') {
    const text = Array.isArray(value)
      ? value.map((item) => plainText(item, baseYear)).join(', ')
      : Object.entries(value as Record<string, unknown>)
          .map(([key, item]) => `${humanizeKey(key)}: ${plainText(item, baseYear)}`)
          .join(' · ');
    return text || EMPTY_CELL;
  }
  const text = String(value);
  if (ISO_DATE.test(text) && parseDate(text)) return formatDate(text, baseYear);
  // An internal token ("no_availability", "stale") reads as words.
  if (SNAKE_WORD.test(text)) return text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, ' ');
  return text;
}

/** One value as the table shows it. */
export function formatCell(value: unknown, column: Pick<EvidenceColumn, 'kind' | 'unit'>, context: FormatContext = {}): string {
  if (value === null || value === undefined || value === '') return EMPTY_CELL;
  switch (column.kind) {
    case 'hotel':
      return typeof value === 'string' ? (context.hotelName?.(value) ?? value) : plainText(value, context.baseYear);
    case 'date':
      return typeof value === 'string' ? formatDate(value, context.baseYear) : plainText(value, context.baseYear);
    case 'month':
      return typeof value === 'string' ? formatMonth(value) : plainText(value, context.baseYear);
    case 'percent':
      return typeof value === 'number' ? formatPercent(value, column.unit === 'ratio') : plainText(value, context.baseYear);
    case 'currency':
      return typeof value === 'number' ? formatCurrency(value, column.unit) : plainText(value, context.baseYear);
    case 'count':
      return typeof value === 'number' ? formatNumber(value, 0) : plainText(value, context.baseYear);
    case 'number':
      return typeof value === 'number' ? formatNumber(value, 2) : plainText(value, context.baseYear);
    case 'id':
      return String(value);
    default:
      return plainText(value, context.baseYear);
  }
}

/** What a row is about, from its first columns that name something: "Arbor Lisbon Chiado · Nov 2026". */
export function rowLabel(row: EvidenceRow, columns: readonly EvidenceColumn[], context: FormatContext = {}, max = 2): string {
  return visibleColumns(columns)
    .filter((column) => !isNumericKind(column.kind) && row[column.key] !== null && row[column.key] !== undefined && row[column.key] !== '')
    .slice(0, max)
    .map((column) => formatCell(row[column.key], column, context))
    .join(' · ');
}

/* ───────── Sorting ───────── */

export type SortDirection = 'asc' | 'desc';

const blank = (value: unknown) => value === null || value === undefined || value === '';

function compare(a: unknown, b: unknown, column: EvidenceColumn, context: FormatContext): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (column.kind === 'hotel') return formatCell(a, column, context).localeCompare(formatCell(b, column, context), 'en-GB');
  return String(a).localeCompare(String(b), 'en-GB', { numeric: true, sensitivity: 'base' });
}

/** Rows sorted by one column, on the raw values (names for hotels). Empty values stay last in both directions. */
export function sortRows<Row extends EvidenceRow>(rows: readonly Row[], column: EvidenceColumn, direction: SortDirection, context: FormatContext = {}): Row[] {
  const sign = direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = left.row[column.key];
      const b = right.row[column.key];
      if (blank(a) || blank(b)) return blank(a) === blank(b) ? left.index - right.index : blank(a) ? 1 : -1;
      return sign * compare(a, b, column, context) || left.index - right.index;
    })
    .map((item) => item.row);
}
