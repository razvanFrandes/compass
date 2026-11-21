import { EvidenceColumn } from '@compass/contracts';
import { z } from 'zod';

/**
 * Column metadata read from the rows themselves: the fallback for a tool result whose evidence names no columns
 * (docs/round2-contracts.md §2 gives every catalog tool a column map; a widget prefers that one when it is there).
 * The kind comes from the key's name and the first value; the label from the key.
 */

type Row = Record<string, unknown>;

const DAY = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}.*)?$/;
const MONTH = /^\d{4}-\d{2}$/;

const LABELS: Record<string, string> = {
  hotel_code: 'Hotel',
  hotel_name: 'Hotel',
  key: 'Name',
  value: 'Value',
  compare_value: 'Last year',
  change: 'Change',
  change_pct: 'Change %',
  rooms_otb: 'On the books',
  rooms_otb_stly: 'On the books, same time last year',
  adr_eur: 'ADR',
};

const COUNT_WORDS = /(^|_)(rooms?|nights|count|covers|sessions|searches|starts|bookings|mentions|requests|events|attendees|hours|reviews|months|days)(_|$)/;

function label(key: string): string {
  const known = LABELS[key];
  if (known) return known;
  const percent = key.endsWith('_pct');
  const words = key
    .replace(/_(eur|pct)$/, '')
    .split('_')
    .filter(Boolean)
    .join(' ');
  const text = words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
  return percent ? `${text} %` : text;
}

function columnOf(key: string, sample: unknown): EvidenceColumn {
  const base = { key, label: label(key) };
  if (key === 'id' || key.endsWith('_id')) return { ...base, kind: 'id', hidden: true };
  if (typeof sample === 'object' && sample !== null) return { ...base, kind: 'text', hidden: true };
  if (key === 'hotel_code' || key === 'hotel_name' || key === 'hotel') return { ...base, kind: 'hotel' };
  if (typeof sample === 'number') {
    if (key.endsWith('_pct')) return { ...base, kind: 'percent' };
    // Only a key that says EUR is money in EUR: rates and local-currency amounts stay plain numbers.
    if (/(^|_)eur(_|$)/.test(key)) return { ...base, kind: 'currency', unit: 'EUR' };
    if (COUNT_WORDS.test(key)) return { ...base, kind: 'count' };
    return { ...base, kind: 'number' };
  }
  if (typeof sample === 'string') {
    if (MONTH.test(sample)) return { ...base, kind: 'month' };
    if (DAY.test(sample)) return { ...base, kind: 'date' };
  }
  return { ...base, kind: 'text' };
}

export function inferColumns(rows: readonly Row[]): EvidenceColumn[] {
  // The first value that is not null decides the kind; a key only later rows have still gets a column.
  const samples = new Map<string, unknown>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!samples.has(key) || (samples.get(key) === null && value !== null)) samples.set(key, value ?? null);
    }
  }
  return [...samples].map(([key, sample]) => columnOf(key, sample));
}

/** The columns of a tool result: the ones its evidence names (contracts §2), else read from the rows. */
export function columnsFor(rows: readonly Row[], evidence: unknown): EvidenceColumn[] {
  const named = z.array(EvidenceColumn).min(1).safeParse((evidence as { columns?: unknown } | null)?.columns);
  return named.success ? named.data : inferColumns(rows);
}
