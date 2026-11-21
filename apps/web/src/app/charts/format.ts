import { hotelLabel } from './hotel-names';
import type { ColumnKind, EvidenceColumn } from './widget-types';

/*
  One place for how a value reads, driven by the column's kind (contract §2):
  currency → €1,240 / €1.34M · percent → 78.4% (rows carry 0–100, like the backend) · count → 1,240 ·
  date → 16 Dec · month → Dec 2026. Negative numbers use a real minus sign.
*/

const LOCALE = 'en-GB';
const MINUS = '−';
export const EMPTY = '–';

export type NumericKind = 'number' | 'percent' | 'currency' | 'count';
export const isNumericKind = (k: ColumnKind): k is NumericKind => k === 'number' || k === 'percent' || k === 'currency' || k === 'count';

export type ColumnLike = Pick<EvidenceColumn, 'kind'> & Partial<Pick<EvidenceColumn, 'unit' | 'label' | 'key'>>;

/** Numbers arrive as numbers or as numeric strings (Postgres numerics); anything else is "no value". */
export function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(v.trim())) return Number(v);
  return null;
}

const CURRENCY_SYMBOL: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', AED: 'AED ', JPY: '¥', CHF: 'CHF ', SGD: 'S$' };
const KNOWN_UNITS = new Set(['pts', 'pt', 'nights', 'rooms', 'bookings', 'index', 'days', 'guests', 'x', '×']);

function grouped(n: number, decimals: number): string {
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

function trim(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** 1,284 · 12.9k · 164k · 1.34M. `always` compacts from 1,000 up (axis ticks); otherwise from 10,000. */
function compactNumber(abs: number, always: boolean): string | null {
  if (abs >= 1e9) return `${trim((abs / 1e9).toFixed(2))}B`;
  // €18.4M but €1.34M: three significant figures either way.
  if (abs >= 1e8) return `${Math.round(abs / 1e6)}M`;
  if (abs >= 1e7) return `${trim((abs / 1e6).toFixed(1))}M`;
  if (abs >= 1e6) return `${trim((abs / 1e6).toFixed(2))}M`;
  if (abs >= 1e5) return `${Math.round(abs / 1e3)}k`;
  if (abs >= 1e4 || (always && abs >= 1e3)) return `${trim((abs / 1e3).toFixed(1))}k`;
  return null;
}

export interface FormatOptions {
  /** €1.34M instead of €1,340,000. */
  compact?: boolean;
  /** Axis ticks: compact from 1,000 and no trailing zeros. */
  axis?: boolean;
  /** Append a unit like "nights" or "pts" (default true). */
  unit?: boolean;
}

export function formatNumber(n: number, col: ColumnLike, o: FormatOptions = {}): string {
  const sign = n < 0 && Math.abs(n) > 1e-9 ? MINUS : '';
  const abs = Math.abs(n);
  const unit = col.unit?.trim();
  switch (col.kind) {
    case 'currency': {
      const symbol = CURRENCY_SYMBOL[(unit ?? 'EUR').toUpperCase()] ?? `${unit} `;
      const short = o.compact || o.axis ? compactNumber(abs, !!o.axis) : null;
      if (short) return `${sign}${symbol}${short}`;
      // Cents only where they matter: small amounts in tables and tooltips, never on a chart label.
      const decimals = abs >= 100 || Number.isInteger(abs) || ((o.compact || o.axis) && abs >= 10) ? 0 : 2;
      return `${sign}${symbol}${grouped(abs, decimals)}`;
    }
    case 'percent': {
      const pct = unit === 'ratio' ? abs * 100 : abs;
      return `${sign}${o.axis ? trim(pct.toFixed(1)) : pct.toFixed(1)}%`;
    }
    case 'count': {
      const short = o.compact || o.axis ? compactNumber(abs, !!o.axis) : null;
      const text = short ?? grouped(Math.round(abs), 0);
      return `${sign}${text}${suffix(unit, o)}`;
    }
    default: {
      const short = o.compact || o.axis ? compactNumber(abs, !!o.axis) : null;
      const decimals = Number.isInteger(abs) ? 0 : abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
      const text = short ?? (o.axis ? trim(grouped(abs, decimals)) : grouped(abs, decimals));
      return `${sign}${text}${suffix(unit, o)}`;
    }
  }
}

function suffix(unit: string | undefined, o: FormatOptions): string {
  if (!unit || o.unit === false || o.axis) return '';
  return KNOWN_UNITS.has(unit.toLowerCase()) || /^[a-z ]{2,12}$/i.test(unit) ? ` ${unit}` : '';
}

/** Parses "2026-12-16", "2026-12", an ISO timestamp, a Date or epoch milliseconds, as a UTC day. */
export function parseDate(v: unknown): number | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1);
}

const dayFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayFullFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' });
const monthFullFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short', year: 'numeric', timeZone: 'UTC' });
const clean = (s: string) => s.replace('Sept', 'Sep').replace(/,/g, '');

/** `axis`: 16 Dec / Dec. `full`: Wed 16 Dec 2026 / Dec 2026. */
export function formatDate(v: unknown, kind: 'date' | 'month', style: 'axis' | 'full' = 'axis'): string {
  const t = parseDate(v);
  if (t === null) return v === null || v === undefined || v === '' ? EMPTY : String(v);
  if (kind === 'month') return clean((style === 'full' ? monthFullFmt : monthFmt).format(t));
  return clean((style === 'full' ? dayFullFmt : dayFmt).format(t));
}

/** ISO day (YYYY-MM-DD) of a parsed date, for ECharts' calendar. */
export function isoDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Any cell, by its column. Text passes through; missing values read "–". */
export function formatValue(v: unknown, col: ColumnLike, o: FormatOptions = {}): string {
  if (v === null || v === undefined || v === '') return EMPTY;
  if (col.kind === 'date' || col.kind === 'month') return formatDate(v, col.kind, o.axis ? 'axis' : 'full');
  if (isNumericKind(col.kind)) {
    const n = num(v);
    return n === null ? String(v) : formatNumber(n, col, o);
  }
  // A hotel is never a code: its city (or short name) on the marks, its full name everywhere else.
  if (col.kind === 'hotel') return hotelLabel(v, o.axis ? 'short' : 'full');
  return String(v);
}

export interface Delta {
  dir: 'up' | 'down' | 'flat';
  /** "▲ 4.2%" · "▼ 2.4 pts": the arrow carries the direction, never colour alone. */
  text: string;
  /** For screen readers: "up 4.2%". */
  spoken: string;
  /** Signed size of the change: percent of the comparison, or points for percent columns. */
  value: number;
  /** Whether the direction is good news: up is good unless the column is a cost, where down is. */
  tone: 'good' | 'bad' | 'flat';
}

/** Columns where a fall is the good news: costs, commissions, cancellations, rooms out of order. */
export function lowerIsBetter(col: Partial<Pick<EvidenceColumn, 'key' | 'label'>>): boolean {
  return /(cost|expense|commission|cancel|out.?of.?order|ooo|complaint|no.?show|payroll|churn|bounce)/i.test(`${col.key ?? ''} ${col.label ?? ''}`);
}

/** A change against a comparison. Percent columns differ in points; everything else in percent of the comparison. */
export function formatDelta(current: unknown, comparison: unknown, kind: ColumnKind, unit?: string, inverse = false): Delta | null {
  const a = num(current);
  const b = num(comparison);
  if (a === null || b === null) return null;
  let value: number;
  let size: string;
  if (kind === 'percent') {
    value = (a - b) * (unit === 'ratio' ? 100 : 1);
    size = `${Math.abs(value).toFixed(1)} pts`;
  } else {
    if (b === 0) return null;
    value = ((a - b) / Math.abs(b)) * 100;
    size = `${Math.abs(value).toFixed(1)}%`;
  }
  const dir = Math.abs(value) < 0.05 ? 'flat' : value > 0 ? 'up' : 'down';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•';
  const word = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'no change,';
  const tone = dir === 'flat' ? 'flat' : (dir === 'up') !== inverse ? 'good' : 'bad';
  return { dir, text: `${arrow} ${size}`, spoken: `${word} ${size}`, value, tone };
}

/** HTML-escapes text that goes into an ECharts tooltip (rows come from the database and the model). */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** "occupancy_ly_pct" → "Occupancy ly pct": the label of a column the backend sent no metadata for. */
export function humanize(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : key;
}
