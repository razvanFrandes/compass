import { Service, computed, signal } from '@angular/core';
import { PF_BUSINESS_DATE, PF_CHANNELS, PF_DATES, PF_HOTELS, PF_SEGMENTS } from './portfolio-data';

/*
  One FilterState for the whole app (report "Filtre și grafice pentru Compass", stage 1).
  - Three permanent controls: hotels, stay nights, comparison. Reset brings them back to the defaults.
  - Two promoted filters: segment and channel ("is" or "is not").
  - Optional dimensions come from "+ Filter" as removable tokens; here, the booking window ("Booked: last 7 days").
  The bar and Kassandra change it through the same `set()`; every change Kassandra makes leaves a receipt
  (before → after, Undo, Edit filters). The state lives in the URL with short, stable parameters
  (`?h=lis,opo&stay=next30n&cmp=stly&seg=corp,grp&ch=!ota&booked=7d`), so a view is a link.
*/

export type RangeKey = 'next7' | 'next30' | 'next90' | 'rest_month' | 'next_month' | 'yesterday' | 'last7' | 'last30' | 'mtd' | 'last_month' | 'ytd';
export type CompareKey = 'stly' | 'ly_dow' | 'ly_date' | 'prev' | 'budget' | 'forecast' | 'none';
export type BookedKey = '1d' | '7d' | '30d';
export type Op = 'is' | 'is_not';
export interface FilterState {
  hotels: string[]; // empty = all hotels
  range: RangeKey;
  compare: CompareKey;
  segments: string[];
  segOp: Op;
  channels: string[];
  chOp: Op;
  /** Optional token from "+ Filter": when the bookings were made. */
  booked: BookedKey | null;
}

const DAY = 86_400_000;
export const BUSINESS_DATE = PF_BUSINESS_DATE as string;
const DATES = PF_DATES as readonly string[];
const at = (d: string) => Date.parse(`${d}T00:00:00Z`);
const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);
const idx = (d: string) => DATES.indexOf(d);
const BD = at(BUSINESS_DATE);
const bdDate = new Date(BD);
const monthStart = (y: number, m: number) => Date.UTC(y, m, 1);
const Y = bdDate.getUTCFullYear();
const M = bdDate.getUTCMonth();
const dm = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dmy = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const fmtDay = (t: number) => dm.format(t);
export const fmtDayYear = (t: number) => dmy.format(t);

interface Range {
  label: string;
  short: string;
  future: boolean;
  from: number; // index into PF_DATES
  to: number;
  /** Set when the preset can't be served from this extract; the option is shown disabled with this reason. */
  unavailable?: string;
}
const span = (label: string, short: string, future: boolean, a: number, b: number): Range => ({ label, short, future, from: idx(isoOf(a)), to: idx(isoOf(b)) });
export const RANGES: Record<RangeKey, Range> = {
  next7: span('Next 7 nights', 'next 7 nights', true, BD + DAY, BD + 7 * DAY),
  next30: span('Next 30 nights', 'next 30 nights', true, BD + DAY, BD + 30 * DAY),
  next90: span('Next 90 nights', 'next 90 nights', true, BD + DAY, BD + 90 * DAY),
  rest_month: span('Rest of this month', 'the rest of this month', true, BD + DAY, monthStart(Y, M + 1) - DAY),
  next_month: span('Next month', 'next month', true, monthStart(Y, M + 1), monthStart(Y, M + 2) - DAY),
  yesterday: span('Yesterday', 'yesterday', false, BD - DAY, BD - DAY),
  last7: span('Last 7 nights', 'last 7 nights', false, BD - 7 * DAY, BD - DAY),
  last30: span('Last 30 nights', 'last 30 nights', false, BD - 30 * DAY, BD - DAY),
  mtd: span('Month to date', 'month to date', false, monthStart(Y, M), BD - DAY),
  last_month: span('Last month', 'last month', false, monthStart(Y, M - 1), monthStart(Y, M) - DAY),
  ytd: { label: 'Year to date', short: 'year to date', future: false, from: 0, to: 0, unavailable: `This prototype’s extract starts ${fmtDay(at(DATES[0]))}` },
};
export const RANGE_GROUPS: { label: string; keys: RangeKey[] }[] = [
  { label: 'Upcoming', keys: ['next7', 'next30', 'next90', 'rest_month', 'next_month'] },
  { label: 'Past', keys: ['yesterday', 'last7', 'last30', 'mtd', 'last_month', 'ytd'] },
];
const URL_RANGE: Record<RangeKey, string> = { next7: 'next7n', next30: 'next30n', next90: 'next90n', rest_month: 'restm', next_month: 'nextm', yesterday: 'yday', last7: 'last7n', last30: 'last30n', mtd: 'mtd', last_month: 'lastm', ytd: 'ytd' };

export const COMPARES: Record<CompareKey, { label: string; short: string; future: string | null; past: string | null }> = {
  // `future` / `past`: null when allowed, else the reason it's disabled.
  stly: { label: 'Same time last year', short: 'same time last year', future: null, past: 'For future nights; past nights compare with last year' },
  ly_dow: { label: 'Last year, same weekday', short: 'last year', future: 'For past nights; future nights compare with same time last year', past: null },
  ly_date: { label: 'Last year, same date', short: 'last year, same date', future: null, past: null },
  prev: { label: 'Previous period', short: 'previous period', future: 'Would compare bookings with finished nights', past: null },
  budget: { label: 'Budget', short: 'budget', future: null, past: null },
  forecast: { label: 'Forecast', short: 'forecast', future: null, past: 'Forecasts exist for future nights only' },
  none: { label: 'No comparison', short: '', future: null, past: null },
};
export const COMPARE_KEYS: CompareKey[] = ['stly', 'ly_dow', 'ly_date', 'prev', 'budget', 'forecast', 'none'];
export const BOOKED: Record<BookedKey, { label: string; days: number }> = {
  '1d': { label: 'Last day', days: 1 },
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
};

export const HOTELS = PF_HOTELS as readonly { code: string; name: string; short: string; city: string; region: string; brand: string; rooms: number }[];
export const SEGMENTS = PF_SEGMENTS as readonly { code: string; name: string }[];
export const CHANNELS = PF_CHANNELS as readonly { code: string; name: string; type: string; commission_pct: number }[];
export const BRAND_NAME: Record<string, string> = { ARB: 'Arbor', LUM: 'Lumen', TES: 'Tessera', KES: 'Kestrel' };
export const REGIONS = [...new Set(HOTELS.map((h) => h.region))];
export const BRANDS = [...new Set(HOTELS.map((h) => h.brand))];

export const rangeLen = (r: RangeKey) => RANGES[r].to - RANGES[r].from + 1;
const fromT = (r: RangeKey) => at(DATES[RANGES[r].from]);
const toT = (r: RangeKey) => at(DATES[RANGES[r].to]);
export const rangeDates = (r: RangeKey) => (RANGES[r].unavailable ? '' : RANGES[r].from === RANGES[r].to ? fmtDayYear(fromT(r)) : `${fmtDay(fromT(r))} – ${fmtDayYear(toT(r))}`);
/** The dates the comparison resolves to, written out (Plausible / Wix pattern). */
export function compareDates(r: RangeKey, c: CompareKey): string {
  const shift = (days: number) => (RANGES[r].from === RANGES[r].to ? fmtDayYear(fromT(r) - days * DAY) : `${fmtDay(fromT(r) - days * DAY)} – ${fmtDayYear(toT(r) - days * DAY)}`);
  switch (c) {
    case 'stly':
      return `${shift(364)}, on the books as of ${fmtDayYear(BD - 364 * DAY)}`;
    case 'ly_dow':
      return `${shift(364)}, same weekday`;
    case 'ly_date':
      return RANGES[r].future ? `${shift(365)}, on the books as of ${fmtDayYear(BD - 365 * DAY)}` : shift(365);
    case 'prev':
      return shift(rangeLen(r));
    case 'budget':
      return 'monthly budget, per night';
    case 'forecast':
      return `forecast made ${fmtDay(BD)}, P50`;
    default:
      return '';
  }
}
export const defaultCompare = (r: RangeKey): CompareKey => (RANGES[r].future ? 'stly' : 'ly_dow');
export const compareReason = (r: RangeKey, c: CompareKey) => (RANGES[r].future ? COMPARES[c].future : COMPARES[c].past);
export const compareAllowed = (r: RangeKey, c: CompareKey) => compareReason(r, c) === null;

export const DEFAULTS: FilterState = { hotels: [], range: 'next30', compare: 'stly', segments: [], segOp: 'is', channels: [], chOp: 'is', booked: null };

function fromUrl(): FilterState {
  try {
    const p = new URLSearchParams(globalThis.location?.search ?? '');
    const range = (Object.keys(URL_RANGE) as RangeKey[]).find((k) => URL_RANGE[k] === p.get('stay')) ?? DEFAULTS.range;
    const list = (v: string | null, all: readonly { code: string }[]) => {
      const raw = v ?? '';
      const op: Op = raw.startsWith('!') ? 'is_not' : 'is';
      const codes = raw.replace(/^!/, '').split(',').map((c) => c.toUpperCase()).filter((c) => all.some((x) => x.code === c));
      return { codes, op };
    };
    const seg = list(p.get('seg'), SEGMENTS);
    const ch = list(p.get('ch'), CHANNELS);
    const cmp = p.get('cmp') as CompareKey | null;
    const booked = p.get('booked') as BookedKey | null;
    return normalize({
      hotels: (p.get('h') ?? '').split(',').map((c) => c.toUpperCase()).filter((c) => HOTELS.some((h) => h.code === c)),
      range: RANGES[range].unavailable ? DEFAULTS.range : range,
      compare: cmp && cmp in COMPARES ? cmp : defaultCompare(range),
      segments: seg.codes,
      segOp: seg.op,
      channels: ch.codes,
      chOp: ch.op,
      booked: booked && booked in BOOKED ? booked : null,
    });
  } catch {
    return DEFAULTS;
  }
}
function normalize(s: FilterState): FilterState {
  const hotels = s.hotels.length === HOTELS.length ? [] : s.hotels;
  const t = { ...s, hotels, segOp: s.segments.length ? s.segOp : 'is', chOp: s.channels.length ? s.chOp : 'is' } as FilterState;
  return compareAllowed(t.range, t.compare) ? t : { ...t, compare: defaultCompare(t.range) };
}
const same = (a: FilterState, b: FilterState) => JSON.stringify(a) === JSON.stringify(b);

export interface Receipt {
  id: number;
  before: FilterState;
  changes: { key: Pill; label: string; from: string; to: string; said?: string }[];
}
export type Pill = 'hotels' | 'range' | 'compare' | 'segment' | 'channel' | 'booked';

@Service()
export class Filters {
  readonly state = signal<FilterState>(fromUrl());
  /** The last change Kassandra made, shown as a receipt until the next change. */
  readonly receipt = signal<Receipt | null>(null);
  /** Pills that just changed, highlighted briefly so the eye finds them. */
  readonly flash = signal<{ id: number; pills: Pill[] }>({ id: 0, pills: [] });
  /** One polite status message per update (WCAG 4.1.3). */
  readonly status = signal('');
  /** Set by "Edit filters" on a receipt: the bar opens this pill. */
  readonly editRequest = signal<{ id: number; pill: Pill } | null>(null);
  private seq = 0;

  readonly isDefault = computed(() => same(this.state(), DEFAULTS));
  readonly summary = computed(() => scopeLine(this.state()));
  readonly optionalCount = computed(() => {
    const s = this.state();
    return (s.segments.length ? 1 : 0) + (s.channels.length ? 1 : 0) + (s.booked ? 1 : 0);
  });

  set(patch: Partial<FilterState>, by: 'you' | 'kassandra' = 'you', said: Partial<Record<Pill, string>> = {}) {
    const before = this.state();
    const next = normalize({ ...before, ...patch });
    if (same(next, before)) return;
    const changes = describeChanges(before, next).map((c) => ({ ...c, said: said[c.key] }));
    this.state.set(next);
    this.receipt.set(by === 'kassandra' ? { id: ++this.seq, before, changes } : null);
    this.flash.set({ id: ++this.seq, pills: changes.map((c) => c.key) });
    this.status.set(`Dashboard updated: ${statusLine(next)}`);
    this.writeUrl(next);
  }
  undoReceipt() {
    const r = this.receipt();
    if (!r) return;
    this.state.set(r.before);
    this.receipt.set(null);
    this.flash.set({ id: ++this.seq, pills: r.changes.map((c) => c.key) });
    this.status.set(`Filters restored: ${statusLine(r.before)}`);
    this.writeUrl(r.before);
  }
  edit(pill: Pill) {
    this.editRequest.set({ id: ++this.seq, pill });
  }
  reset() {
    this.set({ ...DEFAULTS });
  }
  private writeUrl(s: FilterState) {
    try {
      const p = new URLSearchParams();
      if (s.hotels.length) p.set('h', s.hotels.join(',').toLowerCase());
      if (s.range !== DEFAULTS.range) p.set('stay', URL_RANGE[s.range]);
      if (s.compare !== defaultCompare(s.range)) p.set('cmp', s.compare);
      if (s.segments.length) p.set('seg', (s.segOp === 'is_not' ? '!' : '') + s.segments.join(',').toLowerCase());
      if (s.channels.length) p.set('ch', (s.chOp === 'is_not' ? '!' : '') + s.channels.join(',').toLowerCase());
      if (s.booked) p.set('booked', s.booked);
      const q = p.toString();
      globalThis.history?.replaceState(null, '', `${globalThis.location.pathname}${q ? '?' + q : ''}`);
    } catch {
      /* sandboxed frames may refuse history access; the state still works */
    }
  }
}

/** "All hotels (20)", one name, a whole region or brand ("Europe (8)"), or "Lisbon Chiado + 2". */
export function hotelLabel(codes: string[]) {
  if (!codes.length || codes.length === HOTELS.length) return `All hotels (${HOTELS.length})`;
  if (codes.length === 1) return HOTELS.find((h) => h.code === codes[0])?.short ?? codes[0];
  const set = new Set(codes);
  for (const r of REGIONS) {
    const g = HOTELS.filter((h) => h.region === r);
    if (g.length === set.size && g.every((h) => set.has(h.code))) return `${r} (${g.length})`;
  }
  for (const b of BRANDS) {
    const g = HOTELS.filter((h) => h.brand === b);
    if (g.length === set.size && g.every((h) => set.has(h.code))) return `${BRAND_NAME[b] ?? b} (${g.length})`;
  }
  const first = HOTELS.find((h) => h.code === codes[0])?.short ?? codes[0];
  return `${first} + ${codes.length - 1}`;
}
export function listLabel(codes: string[], all: readonly { code: string; name: string }[], none = 'All') {
  if (!codes.length) return none;
  const first = all.find((x) => x.code === codes[0])?.name ?? codes[0];
  return codes.length === 1 ? first : codes.length === 2 ? `${first}, ${all.find((x) => x.code === codes[1])?.name}` : `${first} + ${codes.length - 1}`;
}
/** Token text: "Corporate, Group" or "is not OTA" (the operator only shows when it isn't "is"). */
export function tokenValue(codes: string[], op: Op, all: readonly { code: string; name: string }[]) {
  return `${op === 'is_not' ? 'is not ' : ''}${listLabel(codes, all)}`;
}
export function scopeLine(s: FilterState) {
  const r = RANGES[s.range];
  const cmp = s.compare === 'none' ? '' : ` · vs ${compareDates(s.range, s.compare)}`;
  return `${rangeDates(s.range)}${cmp} · ${r.future ? 'On the books' : 'Actuals'} as of ${fmtDay(BD)}, 07:00`;
}
/** The one-line scope every quantitative answer declares. */
export function scopeChips(s: FilterState) {
  return [
    hotelLabel(s.hotels),
    `stays ${rangeDates(s.range)}`,
    ...(s.compare !== 'none' ? [`vs ${COMPARES[s.compare].short}`] : []),
    ...(s.segments.length ? [`Segment ${tokenValue(s.segments, s.segOp, SEGMENTS)}`] : []),
    ...(s.channels.length ? [`Channel ${tokenValue(s.channels, s.chOp, CHANNELS)}`] : []),
    ...(s.booked ? [`Booked ${BOOKED[s.booked].label.toLowerCase()}`] : []),
  ];
}
function statusLine(s: FilterState) {
  const n = s.hotels.length || HOTELS.length;
  return `${n === HOTELS.length ? 'all' : n} hotel${n === 1 ? '' : 's'}, stays ${rangeDates(s.range)}${s.compare === 'none' ? '' : `, compared with ${COMPARES[s.compare].short}`}`;
}
export function pillValue(s: FilterState, key: Pill) {
  switch (key) {
    case 'hotels':
      return hotelLabel(s.hotels);
    case 'range':
      return `${RANGES[s.range].label} (${rangeDates(s.range)})`;
    case 'compare':
      return COMPARES[s.compare].label;
    case 'segment':
      return s.segments.length ? tokenValue(s.segments, s.segOp, SEGMENTS) : 'All';
    case 'channel':
      return s.channels.length ? tokenValue(s.channels, s.chOp, CHANNELS) : 'All';
    case 'booked':
      return s.booked ? BOOKED[s.booked].label : 'Any time';
  }
}
export const PILL_LABEL: Record<Pill, string> = { hotels: 'Hotels', range: 'Stay dates', compare: 'Compare', segment: 'Segment', channel: 'Channel', booked: 'Booked' };
function describeChanges(a: FilterState, b: FilterState) {
  const keys: Pill[] = [];
  if (a.hotels.join() !== b.hotels.join()) keys.push('hotels');
  if (a.range !== b.range) keys.push('range');
  if (a.compare !== b.compare) keys.push('compare');
  if (a.segments.join() !== b.segments.join() || a.segOp !== b.segOp) keys.push('segment');
  if (a.channels.join() !== b.channels.join() || a.chOp !== b.chOp) keys.push('channel');
  if (a.booked !== b.booked) keys.push('booked');
  return keys.map((key) => ({ key, label: PILL_LABEL[key], from: pillValue(a, key), to: pillValue(b, key) }));
}

/**
 * Kassandra's side of the same state: reads a request and returns the filters it names, plus the words
 * each one came from (for the receipt's "you said …"). Deterministic here; in the product the model calls
 * a `set_filters(patch)` tool with the same shape.
 */
export function parseFilterRequest(text: string): { patch: Partial<FilterState>; said: Partial<Record<Pill, string>> } | null {
  const s = text.toLowerCase();
  const patch: Partial<FilterState> = {};
  const said: Partial<Record<Pill, string>> = {};
  const hit = (re: RegExp) => s.match(re)?.[0];

  const brandWords: Record<string, string> = { arbor: 'ARB', lumen: 'LUM', tessera: 'TES', kestrel: 'KES' };
  const words: string[] = [];
  const hotels = HOTELS.filter((h) => {
    const keys = [h.city, h.short, h.region, BRAND_NAME[h.brand] ?? ''].map((x) => x.toLowerCase()).filter(Boolean);
    const k = keys.find((x) => s.includes(x));
    if (k) words.push(k);
    return !!k || Object.entries(brandWords).some(([w, b]) => b === h.brand && s.includes(w));
  }).map((h) => h.code);
  if (/all hotels|whole group|portfolio/.test(s)) {
    patch.hotels = [];
    said.hotels = hit(/all hotels|whole group|portfolio/);
  } else if (hotels.length && hotels.length < HOTELS.length) {
    patch.hotels = hotels;
    said.hotels = [...new Set(words)].join(', ');
  }
  const m = s.match(/(next|last|past)\s+(7|30|90)\s+(nights|days)/);
  if (m && !(m[1] !== 'next' && m[2] === '90')) {
    patch.range = `${m[1] === 'next' ? 'next' : 'last'}${m[2]}` as RangeKey;
    said.range = m[0];
  } else if (/next month/.test(s)) [patch.range, said.range] = ['next_month', 'next month'];
  else if (/last month/.test(s)) [patch.range, said.range] = ['last_month', 'last month'];
  else if (/rest of (the|this) month/.test(s)) [patch.range, said.range] = ['rest_month', hit(/rest of (the|this) month/)];
  else if (/month to date|mtd/.test(s)) [patch.range, said.range] = ['mtd', hit(/month to date|mtd/)];
  else if (/yesterday|last night/.test(s)) [patch.range, said.range] = ['yesterday', hit(/yesterday|last night/)];

  const future = patch.range ? RANGES[patch.range].future : true;
  const cmp: [RegExp, CompareKey][] = [
    [/budget/, 'budget'],
    [/forecast/, 'forecast'],
    [/no comparison|without comparison/, 'none'],
    [/previous period|period before/, 'prev'],
    [/same date/, 'ly_date'],
    [/last year|stly|same time/, future ? 'stly' : 'ly_dow'],
  ];
  const c = cmp.find(([re]) => re.test(s));
  if (c) {
    patch.compare = c[1];
    said.compare = hit(c[0]);
  }
  const segHit = SEGMENTS.filter((x) => new RegExp(`\\b${x.name.toLowerCase().split(' ')[0]}\\b`).test(s.replace(/whole group|group of hotels/g, ''))).map((x) => x.code);
  if (segHit.length) {
    patch.segments = segHit;
    patch.segOp = 'is';
    said.segment = SEGMENTS.filter((x) => segHit.includes(x.code)).map((x) => x.name.toLowerCase().split(' ')[0]).join(', ');
  }
  const not = /\b(excluding|except|without|not)\b[^,.]*\b(ota|booking|expedia)/.test(s);
  const ch = CHANNELS.filter((x) => s.includes(x.name.toLowerCase()) || (x.code === 'BDC' && /booking\.com|\bbooking\b/.test(s)) || (x.type === 'OTA' && /\bota/.test(s))).map((x) => x.code);
  if (ch.length) {
    patch.channels = [...new Set(ch)];
    patch.chOp = not ? 'is_not' : 'is';
    said.channel = hit(/(excluding |except |without |not )?(otas?|booking\.com|booking|expedia|brand website|wholesale\w*|gds)/);
  }
  const b = s.match(/booked (in the )?(last|past) (1|7|30) days?|booked (yesterday|today)/);
  if (b) {
    patch.booked = b[3] === '7' ? '7d' : b[3] === '30' ? '30d' : '1d';
    said.booked = b[0];
  }
  return Object.keys(patch).length ? { patch, said } : null;
}
