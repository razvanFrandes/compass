import type { AuditEntry, BriefChart, BriefFeed, BriefMoney, BriefNights, BriefPickup, Proposal, PulseTile, RateFlag, Workflow, WorkflowRun } from '@compass/contracts';
import type { EvidenceColumn, WidgetKind, WidgetSpec } from '../charts/widget-types';
import { shortName, type HotelRef } from '../scope/hotels';
import { firstSentences, latestFinding, studioStatus, type StudioStatus } from '../studio/studio';

/*
  The morning brief, the pure part: how the brief's rows and the overview's numbers (GET /api/brief/overview)
  read on the page. Nothing here fetches, and no figure is invented: totals are sums of the findings' own
  EUR impacts, and everything else is formatting.
*/

/** What the header needs from a finding. */
export interface StakeRow {
  id: string;
  kind: string;
  hotel_code: string;
  impact_eur: number | null;
}

export interface Stakes {
  /** Findings still open, plus decisions waiting. */
  things: number;
  findings: number;
  decisions: number;
  /** EUR lost or at risk across the open findings (a positive number). */
  atRisk: number;
  atRiskHotels: number;
  /** EUR left on the table across the open findings. */
  upside: number;
  upsideHotels: number;
  /** Findings that cannot be priced (a broken data feed). */
  feeds: number;
}

export function stakes(open: readonly StakeRow[], decisions: number): Stakes {
  const risk = open.filter((r) => (r.impact_eur ?? 0) < 0);
  const gain = open.filter((r) => (r.impact_eur ?? 0) > 0);
  const hotels = (rows: readonly StakeRow[]) => new Set(rows.map((r) => r.hotel_code)).size;
  return {
    things: open.length + decisions,
    findings: open.length,
    decisions,
    atRisk: -risk.reduce((sum, r) => sum + (r.impact_eur ?? 0), 0),
    atRiskHotels: hotels(risk),
    upside: gain.reduce((sum, r) => sum + (r.impact_eur ?? 0), 0),
    upsideHotels: hotels(gain),
    feeds: open.filter((r) => r.kind === 'data_stale').length,
  };
}

/** €1.34M, €118k, €900: three figures at most, the way a hotelier says it. */
export function eurShort(value: number): string {
  const n = Math.abs(value);
  if (n >= 999_500) return `€${(n / 1e6).toFixed(n >= 9_995_000 ? 1 : 2)}M`;
  if (n >= 1000) return `€${Math.round(n / 1000)}k`;
  return `€${Math.round(n)}`;
}

/** The page's one sentence: how much needs the reader, and the money in it. */
export function headline(s: Stakes, state: 'loading' | 'ready'): string {
  if (state === 'loading') return 'Reading this morning’s brief…';
  if (!s.things) return 'Nothing needs you this morning.';
  const lead = s.things === 1 ? '1 thing needs you today' : `${s.things} things need you today`;
  const money = [s.atRisk ? `${eurShort(s.atRisk)} at risk` : '', s.upside ? `${eurShort(s.upside)} upside` : ''].filter(Boolean);
  return money.length ? `${lead}: ${money.join(', ')}.` : `${lead}.`;
}

export type FindingFilter = 'all' | 'risk' | 'upside';
export const matchesFilter = (impact: number | null, filter: FindingFilter) => filter === 'all' || (filter === 'risk' ? (impact ?? 0) < 0 : (impact ?? 0) > 0);

/* ───────── Findings ───────── */

/** What each kind of finding is called on its card, and the chart its skeleton draws while the numbers load. */
export const FINDING_KINDS: Record<string, { label: string; icon: string; chart: WidgetKind | null }> = {
  data_stale: { label: 'Data feed', icon: 'phosphorDatabaseLight', chart: 'bar' },
  pace_behind: { label: 'Pace', icon: 'phosphorTrendDownLight', chart: 'line' },
  underpriced_demand: { label: 'Rate vs comp set', icon: 'phosphorTargetLight', chart: 'bullet' },
  account_loss: { label: 'Corporate account', icon: 'phosphorUsersThreeLight', chart: 'bar' },
  web_conversion_drop: { label: 'Website', icon: 'phosphorChartLineLight', chart: 'funnel' },
  staffing_gap: { label: 'Staffing', icon: 'phosphorClockLight', chart: 'grouped_bar' },
  rooms_out_of_order: { label: 'Rooms out of order', icon: 'phosphorCalendarBlankLight', chart: 'calendar_heatmap' },
  gop_miss: { label: 'Profit', icon: 'phosphorChartBarLight', chart: 'waterfall' },
};
export const findingKind = (kind: string) => FINDING_KINDS[kind] ?? { label: kind.replace(/_/g, ' '), icon: 'phosphorSparkleLight', chart: null };

/** "€1.34M at risk", "€43k upside", "Not priced". */
export function stakeLabel(impact: number | null): { text: string; tone: 'risk' | 'upside' | 'none'; arrow: string } {
  if (impact === null || impact === 0) return { text: 'Not priced', tone: 'none', arrow: '' };
  return impact < 0 ? { text: `${eurShort(impact)} at risk`, tone: 'risk', arrow: '▼' } : { text: `${eurShort(impact)} upside`, tone: 'upside', arrow: '▲' };
}

const SOURCE_NAMES: Record<string, string> = {
  'hotel.data_sources': 'data feeds',
  'hotel.pace_vs_stly()': 'bookings',
  'hotel.v_rate_position': 'rate shop',
  'hotel.otb_as_of()': 'bookings',
  'hotel.room_inventory_daily': 'room inventory',
  'hotel.reservation_nights': 'bookings',
  'hotel.reservations': 'bookings',
  'hotel.accounts': 'accounts',
  'hotel.web_daily': 'web analytics',
  'hotel.labor_daily': 'labour',
  'hotel.fnb_daily': 'POS',
  'hotel.v_hotel_day': 'daily performance',
  'hotel.pnl_monthly': 'P&L',
};
/** "bookings, rate shop": where a finding's numbers come from, in the words of the systems. */
export function sourceNames(sources: readonly string[]): string {
  return [...new Set(sources.map((s) => SOURCE_NAMES[s] ?? s.replace(/^hotel\./, '').replace(/[_()]/g, ' ').trim()))].join(', ');
}

/** One line under the chart: how the money was priced and what was read. */
export function evidenceLine(impactBasis: string, sources: readonly string[]): string {
  const basis = impactBasis.replace(/\s+/g, ' ').trim().replace(/[.:]+$/, '');
  const short = basis.length > 120 ? `${basis.slice(0, 118).replace(/\s+\S*$/, '')}…` : basis;
  const from = sourceNames(sources);
  const first = short ? `${short[0]!.toUpperCase()}${short.slice(1)}` : '';
  return [first, from ? `From ${from}` : ''].filter(Boolean).join(' · ');
}

/** The widget spec of a finding's chart. The card shows its own title, so the chart's title is only read aloud. */
export function chartSpec(chart: BriefChart, id: string): WidgetSpec {
  return {
    kind: chart.kind,
    title: chart.title,
    sourceCallId: `brief:${id}`,
    ...(chart.subtitle ? { subtitle: chart.subtitle } : {}),
    ...(chart.x ? { x: chart.x } : {}),
    ...(chart.y ? { y: chart.y } : {}),
    ...(chart.group ? { group: chart.group } : {}),
    ...(chart.compare ? { compare: chart.compare } : {}),
    ...(chart.format ? { format: chart.format } : {}),
  };
}
/** The spec a card shows while its chart loads: the right kind, so the skeleton has the chart's shape and height. */
export const placeholderSpec = (kind: WidgetKind, id: string): WidgetSpec => ({ kind, title: 'Chart', sourceCallId: `brief:${id}` });

interface WatchRow {
  kind: string;
  hotel_name: string;
  facts: Readonly<Record<string, string | number | null>>;
}
/**
 * "Watch this": the description the agent builder opens with. It is the person's to edit and send: the builder
 * never sends it on its own, and the address for the email is theirs to add.
 */
export function watchPrompt(r: WatchRow): string {
  const h = r.hotel_name;
  switch (r.kind) {
    case 'data_stale':
      return `Email me every morning if any data feed at ${h} has not synced since the day before`;
    case 'pace_behind':
      return `Email me every morning if ${h} is more than 10% behind last year on the books for the next 45 nights`;
    case 'underpriced_demand':
      return `Every morning, check ${h}'s rate against its comp set for the next 45 nights and propose a new rate for busy nights priced more than 15% under the median`;
    case 'account_loss':
      return `Every week, email me the corporate accounts at ${h} whose room nights fell by more than half against the six months before`;
    case 'web_conversion_drop':
      return `Email me every morning if ${String(r.facts['device'] ?? 'website')} conversion on the ${h} website falls more than 30% below its last 60 days`;
    case 'staffing_gap':
      return `Every week, email me the departments at ${h} that worked less than 85% of the hours their workload needed`;
    case 'rooms_out_of_order':
      return `Email me every morning if ${h} has more than 5% of its rooms out of order in the next 30 days`;
    case 'gop_miss':
      return `When a month closes, email me if ${h} misses its GOP budget by more than 10%, with the P&L lines behind it`;
    default:
      return `Watch ${h} every morning and email me when something changes`;
  }
}

/* ───────── Pulse ───────── */

export interface Spark {
  /** SVG paths in a 120 × 36 box: this period solid, the comparison dashed. */
  line: string;
  compare: string;
  /** Where the last point of the line sits, in percent of the box. */
  lastX: number;
  lastY: number;
}

/** Two series on one scale. A gap (null) breaks the line instead of drawing through it. */
export function spark(values: readonly (number | null)[], compare: readonly (number | null)[] = [], width = 120, height = 36): Spark {
  const all = [...values, ...compare].filter((v): v is number => v !== null && Number.isFinite(v));
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const pad = 3;
  const x = (i: number, n: number) => (n > 1 ? (i / (n - 1)) * width : width / 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - 2 * pad);
  const path = (series: readonly (number | null)[]) => {
    let d = '';
    let pen = false;
    series.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) return void (pen = false);
      d += `${pen ? 'L' : 'M'}${x(i, series.length).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  let last = -1;
  values.forEach((v, i) => {
    if (v !== null && Number.isFinite(v)) last = i;
  });
  return {
    line: all.length ? path(values) : '',
    compare: all.length ? path(compare) : '',
    lastX: last < 0 ? 100 : (x(last, values.length) / width) * 100,
    lastY: last < 0 ? 50 : (y(values[last]!) / height) * 100,
  };
}

export interface PulseDelta {
  arrow: '▲' | '▼' | '';
  /** "+4.2%", "−9.9 pts", "±0". */
  text: string;
  tone: 'up' | 'down' | 'flat';
  /** What it is against, short: "STLY", "Oct 2025", "budget". */
  basis: string;
  spoken: string;
}

export interface PulseView {
  key: string;
  label: string;
  /** "next 30 nights", "Oct 2026": said next to the label. */
  period: string;
  /** One dominant value, three figures at most: "53%", "€279", "€20.8M". */
  value: string;
  /** At most two comparisons, each naming its base. */
  deltas: PulseDelta[];
  definition: string;
  spark: Spark;
  /** What "Ask why" sends. */
  question: string;
  /** The tile in one sentence, for a screen reader. */
  spoken: string;
}

const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
/** Three figures at most on a tile; the full value is in the thread and the tables. */
export function pulseValue(tile: Pick<PulseTile, 'unit' | 'value'>): string {
  const v = tile.value;
  if (v === null || !Number.isFinite(v)) return '–';
  if (tile.unit === 'percent') return `${Math.round(v)}%`;
  if (tile.unit === 'count') return Math.abs(v) >= 100_000 ? `${Math.round(v / 1000)}k` : grouped.format(v);
  if (Math.abs(v) >= 1e6) return `€${(v / 1e6).toFixed(Math.abs(v) >= 1e7 ? 1 : 2)}M`;
  if (Math.abs(v) >= 10_000) return `€${Math.round(v / 1000)}k`;
  return `€${grouped.format(v)}`;
}

/** "same time last year" is STLY on a tile; the section's header spells it out once. */
export const shortBasis = (basis: string) => (basis === 'same time last year' ? 'STLY' : basis);

export function pulseDelta(delta: number | null, unit: 'pp' | 'pct', basis: string): PulseDelta {
  const short = shortBasis(basis);
  const suffix = unit === 'pp' ? ' pts' : '%';
  if (delta === null || !Number.isFinite(delta)) return { arrow: '', text: 'no figure', tone: 'flat', basis: short, spoken: `No comparison with ${basis}.` };
  if (Math.abs(delta) < 0.05) return { arrow: '', text: '±0', tone: 'flat', basis: short, spoken: `Level with ${basis}.` };
  const size = `${Math.abs(delta).toFixed(1)}${suffix}`;
  return { arrow: delta > 0 ? '▲' : '▼', text: `${delta > 0 ? '+' : '−'}${size}`, tone: delta > 0 ? 'up' : 'down', basis: short, spoken: `${delta > 0 ? 'Up' : 'Down'} ${size} against ${basis}.` };
}

const KEEP_CASE = new Set(['ADR', 'RevPAR', 'TRevPAR', 'GOP', 'GOP margin']);

export function pulseView(tile: PulseTile): PulseView {
  const future = tile.period.startsWith('Next');
  const name = tile.key === 'pace' ? 'room nights on the books' : KEEP_CASE.has(tile.label) ? tile.label : tile.label.toLowerCase();
  const deltas = [pulseDelta(tile.delta, tile.deltaUnit, tile.basis), ...(tile.also ? [pulseDelta(tile.also.delta, tile.also.deltaUnit, tile.also.basis)] : [])];
  const label = tile.key === 'pace' ? 'On the books' : tile.label;
  const value = pulseValue(tile);
  return {
    key: tile.key,
    label,
    period: future ? 'next 30 nights' : tile.period,
    value,
    deltas,
    definition: tile.definition,
    spark: spark(
      tile.series.map((p) => p.value),
      tile.series.map((p) => p.compare),
      80,
      24,
    ),
    question: future ? `What is driving ${name} for the next 30 nights against the same time last year?` : `What drove ${name} in ${tile.period} against ${tile.basis}${tile.also ? ` and against ${tile.also.basis}` : ''}?`,
    spoken: `${label}, ${future ? 'next 30 nights' : tile.period}: ${value}. ${deltas.map((d) => d.spoken).join(' ')}`,
  };
}

/** The Pulse row shows one period at a time, four tiles at most: what is on the books, or the last closed month. */
export interface PulseGroups {
  forward: PulseView[];
  month: PulseView[];
  /** Room nights on the books against the same time last year: said in a line under the row, not as a fifth tile. */
  pace: PulseView | null;
  monthLabel: string;
  monthBasis: string;
}
export function pulseGroups(tiles: readonly PulseTile[]): PulseGroups {
  const forward = tiles.filter((t) => t.period.startsWith('Next') && t.key !== 'pace');
  const month = tiles.filter((t) => !t.period.startsWith('Next'));
  const pace = tiles.find((t) => t.key === 'pace');
  return { forward: forward.slice(0, 4).map(pulseView), month: month.slice(0, 4).map(pulseView), pace: pace ? pulseView(pace) : null, monthLabel: month[0]?.period ?? '', monthBasis: month[0]?.basis ?? '' };
}

/* ───────── Next 14 nights ───────── */

/** Occupancy as one of five steps of a single hue: under 40%, 40–55%, 55–70%, 70–85%, 85% and over. */
export const occupancyStep = (pct: number | null): 0 | 1 | 2 | 3 | 4 => (pct === null ? 0 : pct >= 85 ? 4 : pct >= 70 ? 3 : pct >= 55 ? 2 : pct >= 40 ? 1 : 0);

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
const DAY_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const stamp = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export const FLAG_TEXT: Record<RateFlag, string> = {
  underpriced: 'rate under the market on a busy night',
  overpriced: 'rate over the market, behind last year',
};

export interface NightCell {
  date: string;
  occupancy: number | null;
  step: 0 | 1 | 2 | 3 | 4;
  /** Points against the same time last year. */
  delta: number | null;
  events: string[];
  flag: RateFlag | null;
  /** How many hotels have a flagged rate that night (the scope's row). */
  flags: number;
  /** The cell in words. */
  label: string;
}
export interface NightDay {
  date: string;
  weekday: string;
  day: string;
  /** "Dec" on the first night of a month after the first column. */
  month: string;
  weekend: boolean;
  full: string;
}
export interface NightsModel {
  days: NightDay[];
  total: NightCell[];
  rows: { code: string; name: string; cells: NightCell[]; flags: number; events: number }[];
  flags: number;
  events: string[];
}

const pct = (v: number | null) => (v === null ? 'no rooms available' : `${Math.round(v)}% occupied`);
const signedPts = (v: number | null) => (v === null || Math.abs(v) < 0.5 ? '' : `, ${Math.abs(Math.round(v))} points ${v > 0 ? 'ahead of' : 'behind'} last year`);

export function nightsModel(nights: BriefNights, hotels: readonly HotelRef[]): NightsModel {
  const days: NightDay[] = nights.total.map((n, i) => {
    const t = stamp(n.stay_date);
    const dow = new Date(t).getUTCDay();
    const dayOfMonth = new Date(t).getUTCDate();
    return {
      date: n.stay_date,
      weekday: DAY.format(t),
      day: String(dayOfMonth),
      month: i > 0 && dayOfMonth === 1 ? new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(t) : '',
      // Hotel weekends are Friday and Saturday nights.
      weekend: dow === 5 || dow === 6,
      full: DAY_LONG.format(t),
    };
  });
  const byHotel = new Map<string, BriefNights['hotels']>();
  for (const n of nights.hotels) byHotel.set(n.hotel_code, [...(byHotel.get(n.hotel_code) ?? []), n]);
  const eventsOn = (date: string) => [...new Set(nights.hotels.filter((n) => n.stay_date === date && n.event).map((n) => n.event!))];
  const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 10) / 10);

  const total: NightCell[] = nights.total.map((n, i) => {
    const events = eventsOn(n.stay_date);
    const d = delta(n.occupancy_pct, n.occupancy_stly_pct);
    return {
      date: n.stay_date,
      occupancy: n.occupancy_pct,
      step: occupancyStep(n.occupancy_pct),
      delta: d,
      events,
      flag: null,
      flags: n.rate_flags,
      label: `${days[i]!.full}: ${pct(n.occupancy_pct)}${signedPts(d)}${events.length ? `. ${events.join(', ')}` : ''}${n.rate_flags ? `. ${n.rate_flags} ${n.rate_flags === 1 ? 'rate' : 'rates'} to check` : ''}.`,
    };
  });

  const order = new Map(hotels.map((h, i) => [h.code, i]));
  const rows = [...byHotel.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
    .map(([code, list]) => {
      const hotel = hotels.find((h) => h.code === code);
      const cells = [...list]
        .sort((a, b) => a.stay_date.localeCompare(b.stay_date))
        .map((n): NightCell => {
          const d = delta(n.occupancy_pct, n.occupancy_stly_pct);
          const rate = n.bar_vs_comp === null ? '' : `, rate at ${n.bar_vs_comp.toFixed(2)}× the comp set`;
          return {
            date: n.stay_date,
            occupancy: n.occupancy_pct,
            step: occupancyStep(n.occupancy_pct),
            delta: d,
            events: n.event ? [n.event] : [],
            flag: n.rate_flag,
            flags: n.rate_flag ? 1 : 0,
            label: `${DAY_LONG.format(stamp(n.stay_date))}: ${pct(n.occupancy_pct)}${signedPts(d)}${n.event ? `. ${n.event}` : ''}${n.rate_flag ? `. To check: ${FLAG_TEXT[n.rate_flag]}${rate}` : ''}.`,
          };
        });
      return { code, name: hotel ? shortName(hotel) : code, cells, flags: cells.filter((c) => c.flag).length, events: cells.filter((c) => c.events.length).length };
    });

  return { days, total, rows, flags: rows.reduce((sum, r) => sum + r.flags, 0), events: [...new Set(nights.hotels.filter((n) => n.event).map((n) => n.event!))] };
}

/** The hotels a long list opens with: the ones with a rate to check, then the ones with an event, then the rest. */
export function notableRows<T extends { flags: number; events: number }>(rows: readonly T[], limit: number): T[] {
  if (rows.length <= limit) return [...rows];
  const rank = (r: T) => (r.flags ? 0 : r.events ? 1 : 2);
  const picked = new Set([...rows].sort((a, b) => rank(a) - rank(b) || b.flags - a.flags).slice(0, limit));
  return rows.filter((r) => picked.has(r));
}

/** What a click on a night asks Kassandra. */
export function nightQuestion(full: string, hotelName?: string, flag?: RateFlag | null): string {
  if (hotelName && flag) return `Should ${hotelName} change its rate for ${full}? Compare it with the comp set and with last year's pace.`;
  if (hotelName) return `How is ${full} looking at ${hotelName}: occupancy, pickup and rate against the comp set?`;
  return `How is ${full} looking: occupancy against last year, pickup, events and rates against the comp set?`;
}

/* ───────── Pickup, money: rows and specs for the catalogue ───────── */

const col = (key: string, label: string, kind: EvidenceColumn['kind'], unit?: string): EvidenceColumn => ({ key, label, kind, ...(unit ? { unit } : {}) });
export interface WidgetView {
  spec: WidgetSpec;
  rows: Record<string, unknown>[];
  columns: EvidenceColumn[];
}

const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0);
const signedPct = (now: number, before: number) => (before ? `${now >= before ? '+' : '−'}${Math.abs((now / before - 1) * 100).toFixed(1)}%` : '');

/** Net room nights picked up per booking day, with the same weekday last year as the comparison mark. */
export function pickupByDay(pickup: BriefPickup): WidgetView & { net: number; netLy: number; change: string } {
  const net = sum(pickup.byDay, (d) => d.net);
  const netLy = sum(pickup.byDay, (d) => d.net_ly);
  return {
    net,
    netLy,
    change: signedPct(net, netLy),
    spec: { kind: 'bar', title: 'Net room nights picked up per booking day', subtitle: 'Booked less cancelled; the mark is the same weekday last year', sourceCallId: 'brief:pickup:day', x: 'day', y: ['net'], compare: 'net_ly' },
    rows: pickup.byDay.map((d) => ({ day: DAY_LONG.format(stamp(d.booking_date)).replace(/ \w+$/, ''), net: d.net, net_ly: d.net_ly, booked: d.booked, cancelled: d.cancelled })),
    columns: [col('day', 'Booking day', 'text'), col('net', 'Net pickup', 'count', 'room nights'), col('net_ly', 'Last year', 'count', 'room nights'), col('booked', 'Booked', 'count', 'room nights'), col('cancelled', 'Cancelled', 'count', 'room nights')],
  };
}

/** The same 7 days per hotel, the strongest first. One hotel has no ranking to show. */
export function pickupByHotel(pickup: BriefPickup, hotels: readonly HotelRef[]): WidgetView | null {
  if (pickup.byHotel.length < 2) return null;
  const name = (code: string) => {
    const hotel = hotels.find((h) => h.code === code);
    return hotel ? shortName(hotel) : code;
  };
  return {
    spec: { kind: 'bar', title: 'Net room nights picked up per hotel, last 7 days', subtitle: 'Booked less cancelled; the mark is the same 7 days last year', sourceCallId: 'brief:pickup:hotel', x: 'hotel', y: ['net'], compare: 'net_ly' },
    rows: [...pickup.byHotel].sort((a, b) => b.net - a.net).map((h) => ({ hotel: name(h.hotel_code), net: h.net, net_ly: h.net_ly, revenue_eur: h.revenue_eur })),
    columns: [col('hotel', 'Hotel', 'text'), col('net', 'Net pickup', 'count', 'room nights'), col('net_ly', 'Last year', 'count', 'room nights'), col('revenue_eur', 'Revenue booked', 'currency', 'EUR')],
  };
}

/**
 * Where the revenue on the books sits: a treemap of the hotels by region; for one hotel (or a single region's
 * worth of one), the stay weeks against last year instead.
 */
export function moneyOnTheBooks(money: BriefMoney, hotels: readonly HotelRef[]): WidgetView & { total: number; change: string } {
  const total = sum(money.byHotel, (h) => h.revenue_eur);
  const before = sum(money.byHotel, (h) => h.revenue_stly_eur);
  const change = signedPct(total, before);
  if (money.byHotel.length < 2) {
    return {
      total,
      change,
      spec: { kind: 'bar', title: 'Room revenue on the books per stay week', subtitle: 'The next 30 nights; the mark is the same time last year', sourceCallId: 'brief:money:week', x: 'week', y: ['revenue_eur'], compare: 'revenue_stly_eur' },
      rows: money.byWeek.map((w) => ({ week: w.week, revenue_eur: w.revenue_eur, revenue_stly_eur: w.revenue_stly_eur })),
      columns: [col('week', 'Week starting', 'date'), col('revenue_eur', 'On the books', 'currency', 'EUR'), col('revenue_stly_eur', 'Last year', 'currency', 'EUR')],
    };
  }
  const name = (code: string) => {
    const hotel = hotels.find((h) => h.code === code);
    return hotel ? shortName(hotel) : code;
  };
  const regions = new Set(money.byHotel.map((h) => h.region)).size;
  return {
    total,
    change,
    spec: { kind: 'treemap', title: 'Room revenue on the books per hotel', subtitle: 'The next 30 nights, in EUR', sourceCallId: 'brief:money:hotel', x: 'hotel', y: ['revenue_eur'], ...(regions > 1 ? { group: 'region' } : {}) },
    rows: [...money.byHotel].sort((a, b) => b.revenue_eur - a.revenue_eur).map((h) => ({ hotel: name(h.hotel_code), region: h.region, revenue_eur: h.revenue_eur, revenue_stly_eur: h.revenue_stly_eur, change_eur: h.change_eur })),
    columns: [col('hotel', 'Hotel', 'text'), col('region', 'Region', 'text'), col('revenue_eur', 'On the books', 'currency', 'EUR'), col('revenue_stly_eur', 'Last year', 'currency', 'EUR'), col('change_eur', 'Change', 'currency', 'EUR')],
  };
}

/** The money in today's open findings, per hotel: what is at risk and what is left on the table. */
export function moneyAtStake(open: readonly StakeRow[], hotels: readonly HotelRef[]): WidgetView | null {
  const byHotel = new Map<string, number>();
  for (const r of open) if (r.impact_eur) byHotel.set(r.hotel_code, (byHotel.get(r.hotel_code) ?? 0) + Math.abs(r.impact_eur));
  if (byHotel.size < 2) return null;
  const name = (code: string) => {
    const hotel = hotels.find((h) => h.code === code);
    return hotel ? shortName(hotel) : code;
  };
  return {
    spec: { kind: 'bar', title: 'Money in today’s findings, per hotel', subtitle: 'At risk and upside together, in EUR', sourceCallId: 'brief:money:stake', x: 'hotel', y: ['at_stake_eur'] },
    rows: [...byHotel.entries()].sort((a, b) => b[1] - a[1]).map(([code, value]) => ({ hotel: name(code), at_stake_eur: value })),
    columns: [col('hotel', 'Hotel', 'text'), col('at_stake_eur', 'In today’s findings', 'currency', 'EUR')],
  };
}

/** The hotels furthest from last year on the books, in money: the two that lost most and the two that gained most. */
export function moneyMovers(money: BriefMoney, hotels: readonly HotelRef[], each = 2): { name: string; code: string; change: string; tone: 'up' | 'down' }[] {
  const name = (code: string) => {
    const hotel = hotels.find((h) => h.code === code);
    return hotel ? shortName(hotel) : code;
  };
  const sorted = [...money.byHotel].sort((a, b) => a.change_eur - b.change_eur);
  const down = sorted.filter((h) => h.change_eur < 0).slice(0, each);
  const up = sorted.filter((h) => h.change_eur > 0).slice(-each).reverse();
  return [...down, ...up].map((h) => ({ name: name(h.hotel_code), code: h.hotel_code, change: `${h.change_eur < 0 ? '−' : '+'}${eurShort(h.change_eur)}`, tone: h.change_eur < 0 ? 'down' : 'up' }));
}

/* ───────── Data health ───────── */

export interface FeedSystem {
  system: string;
  total: number;
  fresh: number;
  /** "05:11–05:47": when the fresh feeds last synced. */
  synced: string;
  stale: BriefFeed[];
  /** One mark per hotel, the stale ones last. */
  marks: { code: string; ok: boolean }[];
}
export interface HealthModel {
  total: number;
  fresh: number;
  systems: FeedSystem[];
  stale: BriefFeed[];
}

export function healthModel(feeds: readonly BriefFeed[]): HealthModel {
  const systems = [...new Set(feeds.map((f) => f.system))].sort().map((system): FeedSystem => {
    const mine = feeds.filter((f) => f.system === system);
    const ok = mine.filter((f) => f.status === 'ok');
    const times = ok.map((f) => f.last_sync_at.slice(11)).sort();
    return {
      system,
      total: mine.length,
      fresh: ok.length,
      synced: !times.length ? '' : times[0] === times.at(-1) ? times[0]! : `${times[0]}–${times.at(-1)}`,
      stale: mine.filter((f) => f.status !== 'ok'),
      marks: [...mine].sort((a, b) => Number(b.status === 'ok') - Number(a.status === 'ok')).map((f) => ({ code: f.hotel_code, ok: f.status === 'ok' })),
    };
  });
  // Systems with a problem lead, so the eye lands on them.
  systems.sort((a, b) => b.stale.length - a.stale.length || a.system.localeCompare(b.system));
  return { total: feeds.length, fresh: feeds.filter((f) => f.status === 'ok').length, systems, stale: feeds.filter((f) => f.status !== 'ok') };
}

/** "Tue 17 Nov, 04:12" from `2026-11-17 04:12`. */
export function syncTime(lastSyncAt: string): string {
  const [day = '', time = ''] = lastSyncAt.split(' ');
  return `${DAY_LONG.format(stamp(day))}, ${time}`;
}

/* ───────── Agents ───────── */

export interface AgentRow {
  id: string;
  name: string;
  status: StudioStatus;
  /** When it last ran (ISO), or null when it never has. */
  at: string | null;
  /** What it found or concluded, in a sentence or two. */
  finding: string;
  hotel: string;
  loading: boolean;
}

export interface AgentDetail {
  runs: readonly WorkflowRun[];
  proposals: readonly Proposal[];
}

/** Whether a sentence names one of these hotels: by its name without the brand, its city, or its code as a word. */
export function hotelMentions(hotels: readonly HotelRef[]): (text: string) => boolean {
  const words = hotels.flatMap((h) => [shortName(h), h.city]).map((w) => w.toLowerCase());
  const codes = hotels.map((h) => new RegExp(`\\b${h.code}\\b`));
  return (text) => {
    const lower = text.toLowerCase();
    return words.some((w) => lower.includes(w)) || codes.some((code) => code.test(text));
  };
}

/**
 * The agents that watch a hotel in scope, the ones that need the reader first, then the latest run first.
 * An agent for the whole group reports on every hotel; under a narrower scope (`mentions`) its last word is shown
 * only when it is about a hotel in scope, and otherwise the row says it had nothing for these hotels.
 */
export function agentRows(workflows: readonly Workflow[], details: Readonly<Record<string, AgentDetail>>, audit: readonly AuditEntry[], inScope: (code: string) => boolean, mentions?: (text: string) => boolean): AgentRow[] {
  const order: Record<StudioStatus['tone'], number> = { needs: 0, failed: 1, running: 2, finding: 3, quiet: 4 };
  return workflows
    .filter((w) => w.enabled && (w.hotels.includes('ALL') || w.hotels.some(inScope)))
    .map((w): AgentRow => {
      const detail = details[w.id];
      const runs = detail?.runs ?? [];
      // A group-wide agent proposes for many hotels: only what it found for the hotels in scope counts here.
      const proposals = (detail?.proposals ?? []).filter((p) => inScope(p.hotel_code));
      const found = latestFinding(runs, proposals);
      const status = studioStatus(w, runs, proposals, audit);
      // A run's summary may be about another hotel of the group: say so instead of quoting it.
      const elsewhere = !!found && found.kind === 'run' && !!mentions && !mentions(found.text);
      return {
        id: w.id,
        name: w.name,
        status: elsewhere && status.tone !== 'running' && status.tone !== 'failed' ? { tone: 'quiet', text: 'Nothing for these hotels' } : status,
        at: w.lastRun?.at ?? null,
        finding: !found || elsewhere ? '' : found.kind === 'run' ? firstSentences(found.text, 170) : found.text,
        hotel: found?.hotel ?? '',
        loading: !detail && !!w.lastRun,
      };
    })
    .sort((a, b) => order[a.status.tone] - order[b.status.tone] || (b.at ?? '').localeCompare(a.at ?? ''));
}

/** "5 agents ran · 2 found something · 1 needs you". */
export function agentsSummary(rows: readonly AgentRow[]): string {
  const ran = rows.filter((r) => r.at).length;
  if (!rows.length) return '';
  const count = (tone: StudioStatus['tone']) => rows.filter((r) => r.status.tone === tone).length;
  const parts = [
    `${ran} of ${rows.length} ${rows.length === 1 ? 'agent' : 'agents'} ran`,
    count('needs') ? `${count('needs')} ${count('needs') === 1 ? 'needs' : 'need'} you` : '',
    count('finding') ? `${count('finding')} found something` : '',
    count('failed') ? `${count('failed')} couldn’t run` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}
