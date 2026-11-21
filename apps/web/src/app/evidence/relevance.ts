import { isHidden, isNumericKind } from './format';
import type { EvidenceColumn, EvidenceRow } from './types';

/*
  What in an answer's evidence is worth reading first. Kassandra often looks things up on the way (the hotel list
  to turn a name into a code, data freshness as a sanity check): those calls are plumbing, not where the numbers
  came from. This file decides which results fed the answer, which rows of them back the numbers it quotes, and
  which columns are worth the space. Pure functions, so the panel, the table and the tests share one definition.
*/

/**
 * What a tool call is to an answer:
 *   data       it read the numbers (pace, production, P&L);
 *   check      a sanity check or context read (data freshness, the morning brief): data only when the answer
 *              quotes it or has nothing else;
 *   reference  a lookup table (the hotel list, metric definitions, the data model).
 */
export type ToolRole = 'data' | 'check' | 'reference';

const REFERENCE_TOOLS = new Set(['list_hotels', 'list_metrics', 'get_schema']);
const CHECK_TOOLS = new Set(['get_data_health', 'get_brief']);

const bare = (name: string) => name.replace(/^mcp__\w+?__/, '');

export function toolRole(name: string): ToolRole {
  const tool = bare(name);
  if (REFERENCE_TOOLS.has(tool)) return 'reference';
  if (CHECK_TOOLS.has(tool)) return 'check';
  return 'data';
}

interface Call {
  callId: string;
  name: string;
}

/**
 * The results a number in the answer may be traced to, best source first: the data calls, then the checks. A
 * lookup table never is, not even when it is all the answer read: the 280 rooms of some hotel would "back" any 280
 * in the answer, and its rooms and meeting space answer no question the person asked.
 */
export function figureSources<T extends Call>(calls: readonly T[]): T[] {
  const data = calls.filter((call) => toolRole(call.name) === 'data');
  const checks = calls.filter((call) => toolRole(call.name) === 'check');
  return [...data, ...checks];
}

/**
 * Splits an answer's results into the ones that fed it and the lookups Kassandra made on the way.
 * `backs` is how many numbers of the answer each call backs. The results that fed the answer are ordered by it,
 * most first; calls that tie keep the order they were made in. While the answer is still being worked on
 * (`settled` false) a lookup table is always a lookup: the data it was looked up for is on its way.
 */
export function arrangeCalls<T extends Call>(calls: readonly T[], backs: ReadonlyMap<string, number> = new Map(), settled = true): { answer: T[]; lookups: T[] } {
  const count = (call: T) => backs.get(call.callId) ?? 0;
  const hasData = calls.some((call) => toolRole(call.name) === 'data');
  const hasCheck = calls.some((call) => toolRole(call.name) === 'check');
  const feeds = (call: T): boolean => {
    const role = toolRole(call.name);
    if (role === 'data') return true;
    // A check is the answer's data when the answer quotes it, or when nothing else was read.
    if (role === 'check') return count(call) > 0 || !hasData;
    // A lookup table is the answer's data only when it is all a finished answer has.
    return settled && !hasData && !hasCheck;
  };
  const answer = calls
    .map((call, index) => ({ call, index }))
    .filter(({ call }) => feeds(call))
    .sort((a, b) => count(b.call) - count(a.call) || a.index - b.index)
    .map(({ call }) => call);
  return { answer, lookups: calls.filter((call) => !feeds(call)) };
}

/** What Kassandra did with a lookup, as the end of "Kassandra also …". */
const LOOKUP_PHRASES: Record<string, { verb: string; what: string }> = {
  list_hotels: { verb: 'looked up', what: 'the hotel list' },
  list_metrics: { verb: 'looked up', what: 'the metric definitions' },
  get_schema: { verb: 'looked up', what: 'the available data' },
  get_data_health: { verb: 'checked', what: 'data freshness' },
  get_brief: { verb: 'read', what: 'the morning brief' },
};

const list = (items: readonly string[]) => (items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/** "Kassandra also looked up the hotel list and checked data freshness". `title` names a lookup this file does not know. */
export function lookupSummary(lookups: readonly (Call & { title?: string })[]): string {
  const byVerb = new Map<string, string[]>();
  for (const lookup of lookups) {
    const phrase = LOOKUP_PHRASES[bare(lookup.name)] ?? { verb: 'looked up', what: (lookup.title ?? 'other data').replace(/^[A-Z](?=[a-z])/, (letter) => letter.toLowerCase()) };
    const things = byVerb.get(phrase.verb) ?? [];
    if (!things.includes(phrase.what)) things.push(phrase.what);
    byVerb.set(phrase.verb, things);
  }
  if (!byVerb.size) return '';
  return `Kassandra also ${list([...byVerb].map(([verb, things]) => `${verb} ${list(things)}`))}`;
}

/** A number of the answer tied to a cell (a `Figure` fits). */
interface CellRef {
  callId: string;
  rowIndex: number;
  key: string;
}

/** How many numbers of the answer each call backs. */
export function backedCounts(figures: readonly CellRef[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const figure of figures) counts.set(figure.callId, (counts.get(figure.callId) ?? 0) + 1);
  return counts;
}

/** The rows of one result that back numbers of the answer, in the order of the data, and the columns, in the order quoted. */
export function backingCells(figures: readonly CellRef[], callId: string): { rows: number[]; keys: string[] } {
  const own = figures.filter((figure) => figure.callId === callId);
  return {
    rows: [...new Set(own.map((figure) => figure.rowIndex))].sort((a, b) => a - b),
    keys: [...new Set(own.map((figure) => figure.key))],
  };
}

/* ───────── Columns ───────── */

/** A table reads well up to about this many columns; the rest wait behind "Show N more columns". */
export const MAX_COLUMNS = 6;

export interface ColumnPlan {
  /** The columns on screen, the one that names the row first. */
  shown: EvidenceColumn[];
  /** The rest, behind "Show N more columns": what did not fit, then what says little, then ids. */
  more: EvidenceColumn[];
  /** Columns left out because every row says the same in them (one hotel, one segment): said once, beside the table. */
  shared: EvidenceColumn[];
}

const CODE_KEY = /(^|_)(code|id|key)$/i;
const NAME_KEY = /(^|_)name$/i;
/** True of every row of a group, so it says little in a table about its hotels or accounts. */
const SETTING_KEY = /^(currency|currency_code|country|country_code)$/i;

const blank = (value: unknown) => value === null || value === undefined || value === '';

/**
 * Which columns of a result to show. The column that tells the rows apart leads. Then the ones named in `prefer`
 * (the cells an answer quotes, the columns a chart draws): those are never dropped. Then the others in the
 * server's order, up to `max` in all. Left for "Show N more columns": a code beside its name, the currency and country
 * of a hotel, a column that is empty or says the same on every row, and ids.
 */
export function planColumns(columns: readonly EvidenceColumn[], rows: readonly EvidenceRow[], options: { prefer?: readonly string[]; max?: number } = {}): ColumnPlan {
  const max = options.max ?? MAX_COLUMNS;
  const prefer = options.prefer ?? [];
  const internal = columns.filter(isHidden);
  const open = columns.filter((column) => !isHidden(column));
  if (!open.length) return { shown: [...columns], more: [], shared: [] };

  const label = (column: EvidenceColumn) => !isNumericKind(column.kind);
  const varies = (column: EvidenceColumn) => rows.some((row) => row[column.key] !== rows[0]![column.key]);
  const hasName = open.some((column) => column.kind !== 'hotel' && label(column) && (NAME_KEY.test(column.key) || /^(hotel|account|name)$/i.test(column.key)));
  const hasHotel = open.some((column) => column.kind === 'hotel');

  /** Why a column is not worth the space, or null when it is. */
  const saysLittle = (column: EvidenceColumn): 'empty' | 'repeats' | 'setting' | 'same' | null => {
    if (prefer.includes(column.key)) return null;
    if (rows.length && rows.every((row) => blank(row[column.key]))) return 'empty';
    if (!label(column)) return null;
    if (column.kind !== 'hotel' && CODE_KEY.test(column.key) && hasName) return 'repeats';
    if (hasHotel && column.key === 'hotel_name') return 'repeats';
    if (SETTING_KEY.test(column.key)) return 'setting';
    return rows.length > 1 && !varies(column) ? 'same' : null;
  };

  let quiet = open.filter((column) => saysLittle(column) !== null);
  let useful = open.filter((column) => !quiet.includes(column));
  // Every row says the same in every label column (one hotel, one month): keep the first, so the row has a name.
  if (!useful.some(label)) {
    const name = quiet.find((column) => label(column) && !rows.every((row) => blank(row[column.key])));
    if (name) {
      useful = open.filter((column) => column === name || useful.includes(column));
      quiet = quiet.filter((column) => column !== name);
    }
  }
  if (!useful.length) return { shown: open, more: internal, shared: [] };

  const lead = useful.find((column) => label(column) && varies(column)) ?? useful.find(label);
  const preferred = prefer.map((key) => useful.find((column) => column.key === key)).filter((column): column is EvidenceColumn => !!column && column !== lead);
  const others = useful.filter((column) => column !== lead && !preferred.includes(column));
  const room = Math.max(0, max - (lead ? 1 : 0) - preferred.length);
  const kept = new Set<EvidenceColumn>([...preferred, ...others.slice(0, room)]);

  return {
    shown: [...(lead ? [lead] : []), ...useful.filter((column) => kept.has(column))],
    more: [...useful.filter((column) => column !== lead && !kept.has(column)), ...quiet, ...internal],
    shared: quiet.filter((column) => saysLittle(column) === 'same'),
  };
}
