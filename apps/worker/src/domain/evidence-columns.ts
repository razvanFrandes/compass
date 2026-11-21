import type { EvidenceColumn } from '@compass/contracts';

/**
 * Column metadata for rows nobody described in advance: the rows of a custom query (run_readonly_query). The kind
 * comes from the column's name first, then from its values. Pure.
 */

/** Words that are not written like ordinary words. */
const WORDS: Record<string, string> = {
  adr: 'ADR', revpar: 'RevPAR', bar: 'BAR', gop: 'GOP', otb: 'on the books', stly: 'same time last year', ly: 'last year', mpi: 'MPI', ari: 'ARI', rgi: 'RGI',
  id: 'ID', fnb: 'F&B', eur: 'EUR', p10: 'P10', p50: 'P50', p90: 'P90', pos: 'POS', pms: 'PMS', rms: 'RMS', ota: 'OTA', gds: 'GDS',
  av: 'AV', sqm: 'sqm', usd: 'USD',
};

/** `room_revenue_eur` → "Room revenue": the unit suffix is dropped, since the column's kind and unit carry it. */
export function humanize(key: string): string {
  if (key === 'hotel_code') return 'Hotel';
  const words = key
    .replace(/_(eur|pct|percent)$/i, '')
    .split(/[_\s]+/)
    .filter(Boolean);
  if (!words.length) return key;
  const label = words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (WORDS[lower]) return WORDS[lower];
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
  // "otb_rooms" starts with a phrase from WORDS ("on the books"): a label still opens with a capital.
  return /^(on the books|same time last year|last year)/.test(label) ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const MONEY_WORDS = new Set(['revenue', 'adr', 'revpar', 'cost', 'price', 'amount', 'commission', 'gop', 'spend']);

function kindOf(key: string, values: readonly unknown[]): Pick<EvidenceColumn, 'kind' | 'unit' | 'hidden'> {
  const name = key.toLowerCase();
  if (name === 'hotel_code') return { kind: 'hotel' };
  if (name === 'id' || name.endsWith('_id')) return { kind: 'id', hidden: true };

  const present = values.filter((value) => value !== null && value !== undefined);
  if (present.length && present.every((value) => typeof value === 'string' && ISO_DATE.test(value))) {
    return { kind: name === 'month' || name.endsWith('_month') ? 'month' : 'date' };
  }
  // A numeric column whose values arrived as numbers; a name alone decides only when every value is null.
  const numeric = present.length ? present.every((value) => typeof value === 'number') : /_(eur|pct|percent)$/.test(name);
  if (!numeric) return { kind: 'text' };
  if (/(^|_)(pct|percent)$/.test(name)) return { kind: 'percent' };
  if (name.endsWith('_eur')) return { kind: 'currency', unit: 'EUR' };
  const words = name.split('_');
  if (name.endsWith('bar_rate') || (words.some((word) => MONEY_WORDS.has(word)) && !words.includes('vs'))) return { kind: 'currency' };
  return { kind: present.every((value) => Number.isInteger(value)) ? 'count' : 'number' };
}

/** One column per property of the rows, in the order the properties first appear. */
export function inferColumns(rows: readonly Record<string, unknown>[]): EvidenceColumn[] {
  const keys: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key);
  return keys.map((key) => ({ key, label: humanize(key), ...kindOf(key, rows.map((row) => row[key])) }));
}
