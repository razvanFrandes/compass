import {
  BOOKED,
  BUSINESS_DATE,
  CHANNELS,
  COMPARES,
  FilterState,
  HOTELS,
  RANGES,
  SEGMENTS,
  compareDates,
  fmtDay,
  hotelLabel,
  rangeLen,
  scopeChips,
} from './filters';
import type { EvidenceColumn, WidgetSpec } from './boards/types';
import { PF_CLOSED_MONTH, PF_DATES, PF_INDEX, PF_MIX, PF_MIX_CMP, PF_NIGHTS, PF_PACE, PF_PICKUP, PF_PNL, PF_SQL } from './portfolio-data';

/*
  The chart catalogue (report "Filtre și grafice pentru Compass", stage 2). A spec is small and flat: it
  names the question (`kind`) and never a number or a colour. The resolver turns spec + FilterState into
  the numbers (as widget rows), the statement title, the scope line, the badge when a filter can't apply and
  the evidence. Drawing is <juyo-widget-chart>'s job, the same as for every other chart in the app: the rows
  name their forecast, range, budget and capacity columns (`forecast`, `band`, `target`, `limit`), and the
  widget draws them the one way (charts/builders/overlays.ts).
  Rates change in percentage points ("+3.1 pts"), money in percent ("+4.2%").
*/

export type ChartSpec =
  | { id: string; kind: 'position'; metric: 'room_revenue'; rows: 'hotel' } // V1
  | { id: string; kind: 'pace'; metric: 'room_nights' } // V2
  | { id: string; kind: 'pickup'; metric: 'room_nights' } // V3
  | { id: string; kind: 'mix_net'; dimension: 'channel' } // V8
  | { id: string; kind: 'share'; metric: 'room_nights'; dimension: 'segment' } // part-to-whole
  | { id: string; kind: 'fan'; metric: 'occupancy' } // V9
  | { id: string; kind: 'quadrant'; x: 'ari'; y: 'mpi' } // V7
  | { id: string; kind: 'bridge'; metric: 'gop' } // V12
  | { id: string; kind: 'table'; rows: 'hotel' }; // V16


/** A chart as a widget (round2-contracts §3): the spec's drawing fields, and the numbers as rows, never formatted text. */
export type WidgetData = Omit<WidgetSpec, 'title' | 'subtitle' | 'sourceCallId'> & { rows: Record<string, unknown>[]; columns: EvidenceColumn[] };
const col = (key: string, label: string, kind: EvidenceColumn['kind'], unit?: string): EvidenceColumn => ({ key, label, kind, ...(unit ? { unit } : {}) });
const r1 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);

export interface Drill {
  dimension: 'hotel' | 'night' | 'channel' | 'segment';
  value: string;
  label: string;
}

export interface Resolved {
  /** A statement: what the chart says, in words. */
  title: string;
  /** The scope line: what, which hotels, which nights. */
  subtitle: string;
  badge: { label: string; detail: string } | null;
  ignores: string[];
  empty?: { text: string; action?: { label: string; patch: Partial<FilterState> } };
  sql: string;
  definitions: [string, string][];
  computed: string;
  /** The body height in its card, for charts whose rows set it (a bullet per hotel). Default: the kind's own. */
  height?: number;
  /** The chart, drawn by <juyo-widget-chart> like every other chart: numbers as rows, never formatted text. */
  data?: WidgetData;
  /** Turns a click on a mark (the row it stands for) into a structured follow-up ({ drill: { dimension, value } }), never free text. */
  drillRow?: (row: Record<string, unknown>) => Drill | null;
}

/* ───────────── the cube ───────────── */
type Col = 'avail' | 'rooms' | 'cmp_rooms' | 'rev' | 'cmp_rev' | 'p10' | 'p50' | 'p90' | 'fc_rev' | 'bud_rooms' | 'bud_rev' | 'lyd_rooms' | 'lyd_rev';
const N = PF_NIGHTS as unknown as Record<string, Record<Col, (number | null)[]>>;
const DATES = PF_DATES as readonly string[];
const FIRST_FUTURE = DATES.findIndex((d) => d > BUSINESS_DATE);
const DAY = 86_400_000;
const at = (d: string) => Date.parse(`${d}T00:00:00Z`);
const codesOf = (s: FilterState) => (s.hotels.length ? s.hotels : HOTELS.map((h) => h.code));
const short = (code: string) => HOTELS.find((h) => h.code === code)?.short ?? code;
const v = (c: string, col: Col, i: number) => N[c]?.[col]?.[i] ?? 0;
const sumCol = (codes: string[], col: Col, from: number, to: number) => {
  let t = 0;
  for (const c of codes) for (let i = from; i <= to; i++) t += v(c, col, i);
  return t;
};
const night = (codes: string[], col: Col, i: number) => codes.reduce((t, c) => t + v(c, col, i), 0);

/** The comparison value for one night, by compare key (null when there is none). */
function cmpAt(s: FilterState, codes: string[], kind: 'rooms' | 'rev', i: number): number | null {
  switch (s.compare) {
    case 'stly':
    case 'ly_dow':
      return night(codes, kind === 'rooms' ? 'cmp_rooms' : 'cmp_rev', i);
    case 'ly_date':
      return night(codes, kind === 'rooms' ? 'lyd_rooms' : 'lyd_rev', i);
    case 'prev':
      return night(codes, kind, i - rangeLen(s.range));
    case 'budget':
      return night(codes, kind === 'rooms' ? 'bud_rooms' : 'bud_rev', i);
    case 'forecast':
      return night(codes, kind === 'rooms' ? 'p50' : 'fc_rev', i);
    default:
      return null;
  }
}
const isPeriod = (s: FilterState) => ['stly', 'ly_dow', 'ly_date', 'prev'].includes(s.compare);
const cmpShort = (s: FilterState) => (s.compare === 'stly' || s.compare === 'ly_dow' ? 'last year' : s.compare === 'ly_date' ? 'last year, same date' : s.compare === 'prev' ? 'previous period' : COMPARES[s.compare].short);
/** The same words where they open a label or head a column: "Last year". */
const cmpHead = (s: FilterState) => cmpShort(s).replace(/^./, (c) => c.toUpperCase());

export interface Totals {
  rooms: number;
  avail: number;
  rev: number;
  cRooms: number | null;
  cRev: number | null;
  fRooms: number | null;
  fRev: number | null;
}
export function totals(s: FilterState, codes = codesOf(s)): Totals {
  const { from, to, future } = RANGES[s.range];
  let cRooms: number | null = null;
  let cRev: number | null = null;
  if (s.compare !== 'none') {
    cRooms = 0;
    cRev = 0;
    for (let i = from; i <= to; i++) {
      cRooms += cmpAt(s, codes, 'rooms', i) ?? 0;
      cRev += cmpAt(s, codes, 'rev', i) ?? 0;
    }
  }
  return {
    rooms: sumCol(codes, 'rooms', from, to),
    avail: sumCol(codes, 'avail', from, to),
    rev: sumCol(codes, 'rev', from, to),
    cRooms,
    cRev,
    fRooms: future ? sumCol(codes, 'p50', from, to) : null,
    fRev: future ? sumCol(codes, 'fc_rev', from, to) : null,
  };
}
/** Budget is a finished number; on future nights it is compared with the forecast, not with today's bookings. */
export const projects = (s: FilterState) => RANGES[s.range].future && s.compare === 'budget';
const asForecast = (t: Totals): Totals => ({ ...t, rooms: t.fRooms ?? t.rooms, rev: t.fRev ?? t.rev });

export const fmt = {
  pct: (n: number, d = 1) => `${n.toFixed(d)}%`,
  eur: (n: number) => {
    const a = Math.abs(n);
    const s = a >= 1e6 ? `€${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `€${Math.round(a / 1e3)}k` : `€${Math.round(a).toLocaleString('en-GB')}`;
    return n < 0 ? `−${s}` : s;
  },
  signedEur: (n: number) => `${n >= 0 ? '+' : '−'}${fmt.eur(Math.abs(n))}`,
  int: (n: number) => Math.round(n).toLocaleString('en-GB'),
  signedInt: (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n)).toLocaleString('en-GB')}`,
  k: (n: number) => (Math.abs(n) >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : fmt.int(n)),
  pp: (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} pts`,
  rel: (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}%`,
  axis: (n: number) => (n === 0 ? '€0' : Math.abs(n) >= 1e6 ? `€${+(n / 1e6).toFixed(1)}M` : `€${Math.round(n / 1e3)}k`),
};

type MetricId = 'occupancy' | 'adr' | 'revpar' | 'revenue';
const METRIC: Record<MetricId, { label: string; unit: 'pp' | '%'; value: (t: Totals) => number; cmp: (t: Totals) => number | null; format: (n: number) => string }> = {
  occupancy: { label: 'Occupancy', unit: 'pp', value: (t) => (t.rooms / t.avail) * 100, cmp: (t) => (t.cRooms === null ? null : (t.cRooms / t.avail) * 100), format: (n) => fmt.pct(n) },
  adr: { label: 'ADR', unit: '%', value: (t) => t.rev / t.rooms, cmp: (t) => (t.cRooms ? (t.cRev ?? 0) / t.cRooms : null), format: (n) => fmt.eur(n) },
  revpar: { label: 'RevPAR', unit: '%', value: (t) => t.rev / t.avail, cmp: (t) => (t.cRev === null ? null : t.cRev / t.avail), format: (n) => fmt.eur(n) },
  revenue: { label: 'Room revenue', unit: '%', value: (t) => t.rev, cmp: (t) => t.cRev, format: (n) => fmt.eur(n) },
};
function delta(m: MetricId, t: Totals) {
  const a = METRIC[m].value(t);
  const c = METRIC[m].cmp(t);
  if (c === null || !Number.isFinite(c) || c === 0) return null;
  return METRIC[m].unit === 'pp' ? a - c : (a / c - 1) * 100;
}
const deltaText = (m: MetricId, d: number | null) => (d === null ? '' : METRIC[m].unit === 'pp' ? fmt.pp(d) : fmt.rel(d));

export interface Kpi {
  metric: MetricId;
  label: string;
  value: string;
  delta: number | null;
  deltaText: string;
  /** The comparison value and its dates, so the delta has a named base. */
  base: string;
  spark: number[];
  sparkCmp: number[] | null;
}
/** KPI tiles: value, delta against a named base, the base itself with its dates, and a sparkline (report: "Cum stăm?"). */
export function kpis(s: FilterState): Kpi[] {
  const t = totals(s);
  const codes = codesOf(s);
  const { from, to } = RANGES[s.range];
  const proj = projects(s);
  const idx = Array.from({ length: to - from + 1 }, (_, k) => from + k);
  const perNight = (m: MetricId, kind: 'cur' | 'cmp') =>
    idx.map((i) => {
      const nt: Totals = {
        rooms: kind === 'cur' ? night(codes, 'rooms', i) : (cmpAt(s, codes, 'rooms', i) ?? 0),
        avail: night(codes, 'avail', i),
        rev: kind === 'cur' ? night(codes, 'rev', i) : (cmpAt(s, codes, 'rev', i) ?? 0),
        cRooms: null,
        cRev: null,
        fRooms: null,
        fRev: null,
      };
      const x = METRIC[m].value(nt);
      return Number.isFinite(x) ? x : 0;
    });
  const sparkOf = (m: MetricId) => (m === 'revenue' ? 'revpar' : m);
  return (['occupancy', 'adr', 'revpar', 'revenue'] as MetricId[]).map((m) => {
    const basis = proj ? asForecast(t) : t;
    const d = delta(m, basis);
    const c = METRIC[m].cmp(t);
    const base =
      s.compare === 'none' || c === null
        ? 'No comparison'
        : s.compare === 'budget'
          ? `${proj ? `Forecast ${METRIC[m].format(METRIC[m].value(basis))} · ` : ''}Budget ${METRIC[m].format(c)}`
          : s.compare === 'forecast'
            ? `Forecast P50 ${METRIC[m].format(c)}`
            : `${cmpHead(s)} ${METRIC[m].format(c)} · ${compareDates(s.range, s.compare).split(',')[0]}`;
    return {
      metric: m,
      label: METRIC[m].label,
      value: METRIC[m].format(METRIC[m].value(t)),
      delta: d,
      deltaText: d === null ? '' : `${deltaText(m, d)} vs ${s.compare === 'budget' ? 'budget' : s.compare === 'forecast' ? 'forecast' : cmpShort(s)}`,
      base,
      spark: perNight(sparkOf(m), 'cur'),
      sparkCmp: isPeriod(s) ? perNight(sparkOf(m), 'cmp') : null,
    };
  });
}

/**
 * The key figures as one widget (kpi_row): one row with each figure for the window, its comparison (`<key>_cmp`) and
 * both trends, one number per night (`<key>_trend`, `<key>_cmp_trend`), so the tiles carry a sparkline with the
 * comparison dashed behind it.
 */
export function kpiWidget(s: FilterState): WidgetData {
  const t = totals(s);
  const proj = projects(s);
  const list = kpis(s);
  const cmpLabel = s.compare === 'budget' ? 'Budget' : s.compare === 'forecast' ? 'Forecast' : s.compare === 'none' ? '' : cmpHead(s);
  const row: Record<string, unknown> = {};
  const columns: EvidenceColumn[] = [];
  const keys = ['occupancy', 'adr', 'revpar', 'revenue'] as MetricId[];
  const kind = (m: MetricId) => (m === 'occupancy' ? 'percent' : 'currency');
  const round = (m: MetricId, n: number) => (m === 'occupancy' ? Math.round(n * 10) / 10 : m === 'revenue' ? Math.round(n) : Math.round(n * 100) / 100);
  for (const m of keys) {
    const k = list.find((x) => x.metric === m)!;
    const value = METRIC[m].value(proj ? asForecast(t) : t);
    const cmp = METRIC[m].cmp(t);
    row[m] = Number.isFinite(value) ? round(m, value) : null;
    columns.push(col(m, `${METRIC[m].label}${proj ? ' (forecast)' : ''}`, kind(m), m === 'occupancy' ? undefined : 'EUR'));
    if (cmp !== null && Number.isFinite(cmp) && cmpLabel) {
      row[`${m}_cmp`] = round(m, cmp);
      columns.push(col(`${m}_cmp`, cmpLabel, kind(m), m === 'occupancy' ? undefined : 'EUR'));
    }
    row[`${m}_trend`] = k.spark.map((v) => Math.round(v * 100) / 100);
    columns.push({ ...col(`${m}_trend`, `${METRIC[m].label} by night`, 'number'), hidden: true });
    if (k.sparkCmp && row[`${m}_cmp`] !== undefined) {
      row[`${m}_cmp_trend`] = k.sparkCmp.map((v) => Math.round(v * 100) / 100);
      columns.push({ ...col(`${m}_cmp_trend`, `${cmpLabel} by night`, 'number'), hidden: true });
    }
  }
  return { kind: 'kpi_row', y: keys, rows: [row], columns };
}

/* ───────────── shared pieces ───────────── */
const scope = (s: FilterState) =>
  scopeChips(s)
    .filter((c) => !c.startsWith('Segment') && !c.startsWith('Channel') && !c.startsWith('Booked'))
    .join(' · ');
const dayLabel = (iso: string) => fmtDay(at(iso));
const DEF = {
  occ: ['Occupancy', 'rooms sold (or on the books) ÷ rooms available; out-of-order rooms excluded'] as [string, string],
  stly: ['Same time last year', 'the same weekday 364 days earlier, on the books at the same lead time'] as [string, string],
  lyDow: ['Last year, same weekday', 'final actuals 364 days earlier'] as [string, string],
  lyDate: ['Last year, same date', '365 days earlier; for future nights on the books at the same lead time'] as [string, string],
  prev: ['Previous period', 'the same number of nights immediately before'] as [string, string],
  bud: ['Budget per night', 'the month’s budget ÷ its days'] as [string, string],
  fc: ['Forecast', `the RMS forecast made on ${fmtDay(at(BUSINESS_DATE))}: P50 is the middle case, P10–P90 the likely range`] as [string, string],
  otb: ['On the books', 'reservations made before today and not cancelled'] as [string, string],
};
const cmpDefs = (s: FilterState): [string, string][] =>
  s.compare === 'stly' ? [DEF.stly] : s.compare === 'ly_dow' ? [DEF.lyDow] : s.compare === 'ly_date' ? [DEF.lyDate] : s.compare === 'prev' ? [DEF.prev] : s.compare === 'budget' ? [DEF.bud] : s.compare === 'forecast' ? [DEF.fc] : [];
const ignoredOptional = (s: FilterState, uses: ('segment' | 'channel' | 'booked')[]) => [
  ...(s.segments.length && !uses.includes('segment') ? ['segment'] : []),
  ...(s.channels.length && !uses.includes('channel') ? ['channel'] : []),
  ...(s.booked && !uses.includes('booked') ? ['booking window'] : []),
];
/** "All channels", "All segments · all booking dates": what the chart shows instead of the filter. */
const ignoreBadge = (ig: string[], what: string) => {
  if (!ig.length) return null;
  const words = ig.map((x) => (x === 'booking window' ? 'all booking dates' : `all ${x}s`)).join(' · ');
  return { label: words[0].toUpperCase() + words.slice(1), detail: what };
};
/* ───────────── the resolver ───────────── */
export function resolve(spec: ChartSpec, s: FilterState): Resolved {
  switch (spec.kind) {
    case 'position':
      return position(s);
    case 'pace':
      return pace(s);
    case 'pickup':
      return pickup(s);
    case 'mix_net':
      return mixNet(s);
    case 'share':
      return share(s);
    case 'fan':
      return fan(s);
    case 'quadrant':
      return quadrant(s);
    case 'bridge':
      return bridge(s);
    case 'table':
      return hotelTable(s);
  }
}

/* V1 · Position: bullet rows as % of budget. OTB solid, hatched extension to P50, comparison tick, budget at 100%. */
function position(s: FilterState): Resolved {
  const { from, to, future } = RANGES[s.range];
  const codes = codesOf(s);
  const row = (cs: string[], name: string, code: string | null) => {
    const otb = sumCol(cs, 'rev', from, to);
    const p50 = future ? sumCol(cs, 'fc_rev', from, to) : null;
    const bud = sumCol(cs, 'bud_rev', from, to);
    let cmp: number | null = null;
    if (isPeriod(s)) {
      cmp = 0;
      for (let i = from; i <= to; i++) cmp += cmpAt(s, cs, 'rev', i) ?? 0;
    }
    return { name, code, otb, p50, bud, cmp, gap: bud ? (p50 ?? otb) / bud - 1 : 0 };
  };
  const hotels = codes.map((c) => row([c], short(c), c)).sort((a, b) => a.gap - b.gap);
  // "Group total" for the whole group, "Selection total" when only some hotels are chosen.
  const totalName = s.hotels.length ? 'Selection total' : 'Group total';
  const rows = hotels.length > 1 ? [row(codes, totalName, null), ...hotels] : hotels;
  const one = hotels.length === 1;
  const pctOf = (x: number, b: number) => (b ? (x / b) * 100 : 0);

  const miss = hotels.filter((r) => r.gap < 0).length;
  const worst = hotels[0];
  const lands = (r: (typeof rows)[number]) => Math.round(pctOf(r.p50 ?? r.otb, r.bud));
  const title = one
    ? `${worst.name}: ${fmt.eur(worst.otb)} ${future ? 'on the books' : 'room revenue'}, ${Math.round(pctOf(worst.otb, worst.bud))}% of budget${future ? `; forecast lands at ${lands(worst)}%` : ''}`
    : miss
      ? `${miss} of ${hotels.length} hotels ${future ? 'are forecast to miss' : 'missed'} budget; ${worst.name} ${future ? 'lands' : 'finished'} at ${lands(worst)}%`
      : `All ${hotels.length} hotels ${future ? 'are forecast to beat' : 'beat'} budget; ${worst.name} has the smallest lead (${lands(worst)}%)`;
  const ig = ignoredOptional(s, []);
  return {
    title,
    subtitle: `Room revenue against budget, by hotel · ${scope(s)}`,
    badge: ignoreBadge(ig, 'Hotel revenue and budget aren’t split by segment, channel or booking date; the mix and pickup charts follow those filters.'),
    ignores: ig,
    sql: PF_SQL.nights,
    definitions: [DEF.otb, DEF.bud, ...(future ? [DEF.fc] : []), ...cmpDefs(s).filter((d) => d !== DEF.bud && d !== DEF.fc)],
    computed: `Each row sums room revenue over the selected nights and divides by the budget for the same nights, so every hotel shares one scale and the group total sits on top. Sorted by where the hotel ${future ? 'is forecast to land' : 'finished'} against budget, worst first.`,
    data: {
      kind: 'bullet',
      x: 'hotel',
      y: ['on_books'],
      target: 'budget',
      ...(future ? { forecast: 'forecast_p50' } : {}),
      ...(isPeriod(s) ? { compare: 'comparison' } : {}),
      format: 'currency',
      rows: rows.map((r) => ({ hotel: r.code ?? r.name, on_books: Math.round(r.otb), ...(future ? { forecast_p50: Math.round(r.p50 ?? 0) } : {}), ...(r.cmp !== null ? { comparison: Math.round(r.cmp) } : {}), budget: Math.round(r.bud) })),
      columns: [
        col('hotel', 'Hotel', 'hotel'),
        col('on_books', future ? 'On the books' : 'Actual', 'currency', 'EUR'),
        ...(future ? [col('forecast_p50', 'Forecast (P50)', 'currency', 'EUR')] : []),
        ...(isPeriod(s) ? [col('comparison', cmpHead(s), 'currency', 'EUR')] : []),
        col('budget', 'Budget', 'currency', 'EUR'),
      ],
    },
    // A row per hotel, all of them: the board has the room.
    height: rows.length * 26 + 64,
    drillRow: (x) => (typeof x['hotel'] === 'string' && HOTELS.some((h) => h.code === x['hotel']) ? { dimension: 'hotel', value: x['hotel'], label: short(x['hotel']) } : null),
  };
}

/* V2 · Pace: room nights on the books for the window as of each day; STLY dashed, Today, capacity, P10–P90 to the last night. */
function pace(s: FilterState): Resolved {
  const r = RANGES[s.range];
  const codes = codesOf(s);
  const P = (PF_PACE as unknown as Record<string, { first: string; ty: Record<string, number[]>; ly: Record<string, number[]> }>)[s.range];
  const firstT = at(P.first);
  const lastIdx = Math.round((at(DATES[r.to]) - firstT) / DAY);
  const todayIdx = Math.round((at(BUSINESS_DATE) - firstT) / DAY);
  const agg = (src: Record<string, number[]>, len: number) => Array.from({ length: len }, (_, k) => codes.reduce((t, c) => t + (src[c]?.[k] ?? 0), 0));
  const tyLen = (r.future ? Math.min(lastIdx, todayIdx) : lastIdx) + 1;
  const ty = agg(P.ty, tyLen);
  const ly = agg(P.ly, lastIdx + 1);
  const labels = Array.from({ length: lastIdx + 1 }, (_, k) => fmtDay(firstT + k * DAY));
  const capacity = sumCol(codes, 'avail', r.from, r.to);
  const budget = sumCol(codes, 'bud_rooms', r.from, r.to);
  const now = ty[ty.length - 1] ?? 0;
  const lyNow = ly[tyLen - 1] ?? 0;
  const lyEnd = ly[ly.length - 1] ?? 0;
  const p10 = r.future ? sumCol(codes, 'p10', r.from, r.to) : null;
  const p50 = r.future ? sumCol(codes, 'p50', r.from, r.to) : null;
  const p90 = r.future ? sumCol(codes, 'p90', r.from, r.to) : null;
  // Between today and the last night the projection follows last year's pickup shape (stated in "Behind the numbers").
  const shape = (k: number) => (lyEnd - lyNow > 0 ? (ly[k] - lyNow) / (lyEnd - lyNow) : (k - (tyLen - 1)) / Math.max(1, lastIdx - (tyLen - 1)));
  const proj = (target: number | null) => labels.map((_, k) => (target === null || k < tyLen - 1 ? null : Math.round(now + (target - now) * Math.max(0, Math.min(1, shape(k))))));
  const [b10, b50, b90] = [proj(p10), proj(p50), proj(p90)];
  const ownCmp = s.compare === 'ly_date' || s.compare === 'prev' || s.compare === 'forecast';
  const showLy = s.compare !== 'none' && s.compare !== 'budget';
  const vsLy = r.future ? (lyNow ? (now / lyNow - 1) * 100 : null) : lyEnd ? (now / lyEnd - 1) * 100 : null;
  const title = r.future
    ? `${fmt.int(now)} room nights on the books for ${r.short}${showLy && vsLy !== null ? `, ${fmt.rel(vsLy)} vs same time last year` : ''}; forecast lands at ${fmt.int(p50 ?? 0)} (${fmt.k(p10 ?? 0)}–${fmt.k(p90 ?? 0)})`
    : `${fmt.int(now)} room nights sold over ${r.short}${showLy && vsLy !== null ? `, ${fmt.rel(vsLy)} vs last year` : ''}`;
  const ig = ignoredOptional(s, []);
  return {
    title,
    subtitle: `Room nights on the books for these stays, by booking date · ${scope(s)}`,
    badge: ownCmp
      ? { label: 'Compares with same time last year', detail: 'Pace is read at the same lead time, so it always compares with last year on the same weekday.' }
      : ignoreBadge(ig, 'Pace counts every reservation for these nights; segment, channel and booking-date filters apply to the mix and pickup charts.'),
    ignores: [...ig, ...(ownCmp ? ['comparison'] : [])],
    sql: PF_SQL.pace,
    definitions: [DEF.otb, DEF.stly, ...(r.future ? [DEF.fc] : []), ['Capacity', 'rooms available over the selected nights']],
    computed: `Counts each reservation night in the window from the day it was booked until the day it was cancelled. Last year uses the same weekdays 364 days earlier.${r.future ? ' The P10–P90 range ends at the forecast for these nights; between today and then it follows last year’s pickup shape.' : ''}`,
    data: {
      kind: 'line',
      x: 'booked_as_of',
      y: ['this_year'],
      ...(showLy || ownCmp ? { compare: 'last_year' } : {}),
      ...(r.future ? { forecast: 'projection_p50', band: ['projection_p10', 'projection_p90'] as [string, string] } : {}),
      limit: 'capacity',
      ...(s.compare === 'budget' ? { target: 'budget' } : {}),
      format: 'count',
      rows: labels.map((_, k) => ({
        booked_as_of: new Date(firstT + k * DAY).toISOString().slice(0, 10),
        this_year: ty[k] ?? null,
        last_year: ly[k] ?? null,
        ...(r.future ? { projection_p10: b10[k], projection_p50: b50[k], projection_p90: b90[k] } : {}),
        capacity,
        ...(s.compare === 'budget' ? { budget: Math.round(budget) } : {}),
      })),
      columns: [
        col('booked_as_of', 'Booked as of', 'date'),
        col('this_year', 'This year', 'count', 'room nights'),
        col('last_year', r.future ? 'Same time last year' : 'Last year', 'count', 'room nights'),
        ...(r.future ? [col('projection_p10', 'P10', 'count', 'room nights'), col('projection_p50', 'Projection (P50)', 'count', 'room nights'), col('projection_p90', 'P90', 'count', 'room nights')] : []),
        col('capacity', 'Capacity', 'count', 'room nights'),
        ...(s.compare === 'budget' ? [col('budget', 'Budget', 'count', 'room nights')] : []),
      ],
    },
    height: 300,
  };
}

/* V3 · Pickup: per stay night, bookings above zero and cancellations below; last year's net as a dashed step. */
function pickup(s: FilterState): Resolved {
  const r = RANGES[s.range];
  const booked = s.booked ?? '7d';
  const days = BOOKED[booked].days;
  const win = BOOKED[booked].label.toLowerCase();
  const base: Resolved = {
    title: 'Pickup is about nights still to come',
    subtitle: `Room nights booked and cancelled in the ${win}${s.booked ? '' : ' (default)'} · ${scope(s)}`,
    badge: null,
    ignores: [],
    sql: PF_SQL.pickup,
    definitions: [],
    computed: '',
    height: 260,
  };
  if (!r.future)
    return { ...base, empty: { text: 'These nights have already been stayed, so nothing more can be booked for them. Pickup shows future nights.', action: { label: 'Show next 30 nights', patch: { range: 'next30', compare: 'stly' } } } };
  const codes = codesOf(s);
  const PK = (PF_PICKUP as unknown as Record<string, Record<'ty' | 'ly', Record<string, [number[], number[]]>>>)[String(days)];
  const i0 = r.from - FIRST_FUTURE;
  const n = r.to - r.from + 1;
  const agg = (k: 'ty' | 'ly', which: 0 | 1) => Array.from({ length: n }, (_, j) => codes.reduce((t, c) => t + (PK[k][c]?.[which]?.[i0 + j] ?? 0), 0));
  const b = agg('ty', 0);
  const c = agg('ty', 1);
  const lyB = agg('ly', 0);
  const lyC = agg('ly', 1);
  const lyNet = lyB.map((x, j) => x - lyC[j]);
  const dates = Array.from({ length: n }, (_, j) => DATES[r.from + j]);
  const total = (a: number[]) => a.reduce((t, x) => t + x, 0);
  const showLy = s.compare !== 'none';
  const ownCmp = !['stly', 'none'].includes(s.compare);
  const title = `Net pickup ${fmt.signedInt(total(b) - total(c))} room nights in the ${win} (${fmt.int(total(b))} booked, ${fmt.int(total(c))} cancelled)${showLy ? `; last year ${fmt.signedInt(total(lyNet))}` : ''}`;
  const ig = ignoredOptional(s, ['booked']);
  return {
    ...base,
    title,
    badge: ownCmp
      ? { label: 'Compares with same time last year', detail: 'Pickup compares the same booking window a year earlier, on the same weekdays.' }
      : ignoreBadge(ig, 'Pickup counts every reservation; segment and channel apply to the mix charts.'),
    ignores: [...ig, ...(ownCmp ? ['comparison'] : [])],
    definitions: [
      ['Pickup', `room nights booked in the ${win}, by night of stay`],
      ['Cancelled', 'room nights cancelled in the same days, shown below zero'],
      ['Last year', 'the same booking window 364 days earlier, for the same weekdays'],
    ],
    data: {
      kind: 'stacked_bar',
      x: 'night',
      y: ['booked', 'cancelled'],
      ...(showLy ? { compare: 'last_year_net' } : {}),
      format: 'count',
      rows: dates.map((d, j) => ({ night: d, booked: b[j], cancelled: -c[j], last_year_net: lyNet[j] })),
      columns: [col('night', 'Night of stay', 'date'), col('booked', 'Booked', 'count', 'room nights'), col('cancelled', 'Cancelled', 'count', 'room nights'), col('last_year_net', 'Last year, net', 'count', 'room nights')],
    },
    drillRow: (x) => (typeof x['night'] === 'string' ? { dimension: 'night', value: x['night'], label: dayLabel(x['night']) } : null),
    computed: `For each night, counts reservation nights created, and separately cancelled, in the ${win} up to ${fmtDay(at(BUSINESS_DATE))}. Change the window with “+ Filter → Booked”.`,
  };
}

/* Mix rows for the window, after the hotel, segment and channel filters. */
type MixRow = [string, string, string, number, number, number];
function mixRows(s: FilterState, cmp: boolean) {
  const src = (cmp ? PF_MIX_CMP : PF_MIX) as unknown as Record<string, MixRow[]>;
  const codes = new Set(codesOf(s));
  const segOk = (x: string) => !s.segments.length || (s.segOp === 'is' ? s.segments.includes(x) : !s.segments.includes(x));
  const chOk = (x: string) => !s.channels.length || (s.chOp === 'is' ? s.channels.includes(x) : !s.channels.includes(x));
  return (src[s.range] ?? []).filter((r) => codes.has(r[0]) && segOk(r[1]) && chOk(r[2]));
}
const mixCmpOk = (s: FilterState) => s.compare === 'stly' || s.compare === 'ly_dow';

/* V8 · Net mix by channel: net solid, commission hatched, last year's net as a tick. */
function mixNet(s: FilterState): Resolved {
  const group = (rows: MixRow[]) => {
    const m = new Map<string, { rn: number; rev: number; comm: number }>();
    for (const r of rows) {
      const g = m.get(r[2]) ?? { rn: 0, rev: 0, comm: 0 };
      g.rn += r[3];
      g.rev += r[4];
      g.comm += r[5];
      m.set(r[2], g);
    }
    return m;
  };
  const cur = group(mixRows(s, false));
  const ly = mixCmpOk(s) ? group(mixRows(s, true)) : null;
  const list = [...cur.entries()]
    .map(([code, g]) => ({ code, name: CHANNELS.find((c) => c.code === code)?.name ?? code, ...g, net: g.rev - g.comm, lyNet: ly ? (ly.get(code)?.rev ?? 0) - (ly.get(code)?.comm ?? 0) : null }))
    .sort((a, b) => b.net - a.net);
  const totalNet = list.reduce((t, x) => t + x.net, 0);
  const totalComm = list.reduce((t, x) => t + x.comm, 0);
  const totalRev = list.reduce((t, x) => t + x.rev, 0);
  const top = list[0];
  const title = top
    ? `${top.name} brings ${Math.round((top.net / totalNet) * 100)}% of net room revenue; commission costs ${fmt.eur(totalComm)} (${((totalComm / totalRev) * 100).toFixed(1)}% of revenue)`
    : 'No room nights match these filters';
  const ig = ignoredOptional(s, ['segment', 'channel']);
  const cmpBadge = s.compare !== 'none' && !mixCmpOk(s);
  return {
    title,
    subtitle: `Room revenue by channel, net of commission · ${scope(s)}`,
    badge: cmpBadge
      ? { label: 'Compares with last year', detail: 'The mix is compared with the same weekdays last year; budget and forecast aren’t split by channel.' }
      : ignoreBadge(ig, 'The mix is counted from reservations on the books; the booking-date filter applies to pickup.'),
    ignores: [...ig, ...(cmpBadge ? ['comparison'] : [])],
    empty: list.length ? undefined : { text: 'No room nights match these filters. Try clearing the segment and channel filters.', action: { label: 'Clear segment and channel', patch: { segments: [], channels: [] } } },
    sql: `${PF_SQL.mix}\n\n${PF_SQL.mix_cmp}`,
    definitions: [['Net', 'room revenue − commission'], ['Commission', 'revenue × the channel’s commission rate'], ...(ly ? [s.compare === 'stly' ? DEF.stly : DEF.lyDow] : [])],
    computed: 'Sums each reservation night in the window by channel, after the hotel, segment and channel filters, then applies the channel’s commission rate. Sorted by net, largest first.',
    data: {
      kind: 'stacked_bar',
      x: 'channel',
      y: ['net', 'commission'],
      ...(ly ? { compare: 'last_year_net' } : {}),
      format: 'currency',
      rows: list.map((x) => ({ channel: x.name, net: Math.round(x.net), commission: Math.round(x.comm), room_nights: x.rn, ...(x.lyNet !== null ? { last_year_net: Math.round(x.lyNet) } : {}) })),
      columns: [col('channel', 'Channel', 'text'), col('net', 'Net room revenue', 'currency', 'EUR'), col('commission', 'Commission', 'currency', 'EUR'), col('room_nights', 'Room nights', 'count'), ...(ly ? [col('last_year_net', `${cmpHead(s)} net`, 'currency', 'EUR')] : [])],
    },
    drillRow: (x) => {
      const hit = list.find((c) => c.name === x['channel']);
      return hit ? { dimension: 'channel', value: hit.code, label: hit.name } : null;
    },
  };
}

/* Part-to-whole · Segment share: sorted bars on a % axis by default; a donut only through the gate. */
function share(s: FilterState): Resolved {
  const group = (rows: MixRow[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r[1], (m.get(r[1]) ?? 0) + r[3]);
    return m;
  };
  const cur = group(mixRows(s, false));
  const ly = mixCmpOk(s) ? group(mixRows(s, true)) : null;
  const total = [...cur.values()].reduce((a, x) => a + x, 0);
  const lyTotal = ly ? [...ly.values()].reduce((a, x) => a + x, 0) : 0;
  const list = [...cur.entries()]
    .map(([code, rn]) => ({ code, name: SEGMENTS.find((x) => x.code === code)?.name ?? code, rn, pct: (rn / total) * 100, lyPct: ly && lyTotal ? ((ly.get(code) ?? 0) / lyTotal) * 100 : null }))
    .sort((a, b) => b.pct - a.pct);
  // The donut gate: one whole at one moment, 2–5 slices after grouping, "Other" not the largest, the top two ≥ 5 pp apart.
  const slices = list.length > 5 ? [...list.slice(0, 4), { code: 'OTHER', name: 'Other', rn: list.slice(4).reduce((a, x) => a + x.rn, 0), pct: list.slice(4).reduce((a, x) => a + x.pct, 0), lyPct: null }] : list;
  const gate =
    slices.length < 2
      ? 'Needs two parts or more'
      : slices[slices.length - 1].code === 'OTHER' && slices[slices.length - 1].pct >= slices[0].pct
        ? '“Other” would be the largest slice'
        : slices[0].pct - slices[1].pct < 5
          ? 'The two largest parts are under 5 pts apart; bars show the difference'
          : null;
  const top = list[0];
  const title = top ? `${top.name} is ${Math.round(top.pct)}% of room nights${top.lyPct !== null ? `, ${fmt.pp(top.pct - top.lyPct)} vs ${cmpShort(s)}` : ''}` : 'No room nights match these filters';
  const ig = ignoredOptional(s, ['segment', 'channel']);
  const cmpBadge = s.compare !== 'none' && !mixCmpOk(s);
  return {
    title,
    subtitle: `Share of room nights by segment · ${scope(s)}`,
    badge: cmpBadge
      ? { label: 'Compares with last year', detail: 'Shares are compared with the same weekdays last year; budget and forecast aren’t split by segment.' }
      : ignoreBadge(ig, 'Shares are counted from reservations on the books; the booking-date filter applies to pickup.'),
    ignores: [...ig, ...(cmpBadge ? ['comparison'] : [])],
    empty: list.length ? undefined : { text: 'No room nights match these filters. Try clearing the segment and channel filters.', action: { label: 'Clear segment and channel', patch: { segments: [], channels: [] } } },
    sql: `${PF_SQL.mix}\n\n${PF_SQL.mix_cmp}`,
    definitions: [['Share', 'room nights in the segment ÷ all room nights in the window'], ...(ly ? [s.compare === 'stly' ? DEF.stly : DEF.lyDow] : [])],
    computed: 'Counts reservation nights in the window by segment, after the hotel and channel filters. A donut is offered only when the parts pass the gate: one whole, 2–5 slices after grouping, “Other” not the largest, the top two at least 5 pts apart.',
    data: {
      kind: gate ? 'bar' : 'donut',
      x: 'segment',
      // A donut of room nights: its centre says the total, its slices their share.
      y: [gate ? 'share' : 'room_nights'],
      group: 'segment',
      format: 'percent',
      rows: (gate ? list : slices).map((x) => ({ segment: x.name, share: r1(x.pct), room_nights: x.rn })),
      columns: [col('segment', 'Segment', 'text'), col('share', 'Share of room nights', 'percent'), col('room_nights', 'Room nights', 'count')],
    },
    drillRow: (x) => {
      const hit = list.find((c) => c.name === x['segment']);
      return hit ? { dimension: 'segment', value: hit.code, label: hit.name } : null;
    },
  };
}

/* V9 · Forecast fan: per night, on the books as a bar, P50 dotted, P10–P90 shaded, budget as a neutral reference. */
function fan(s: FilterState): Resolved {
  const r = RANGES[s.range];
  const base: Resolved = {
    title: 'The forecast covers nights still to come',
    subtitle: `Occupancy by night · ${scope(s)}`,
    badge: null,
    ignores: [],
    sql: PF_SQL.nights,
    definitions: [],
    computed: '',
    height: 260,
  };
  if (!r.future) return { ...base, empty: { text: 'These nights are already stayed; their actuals are in the other charts.', action: { label: 'Show next 30 nights', patch: { range: 'next30', compare: 'stly' } } } };
  const codes = codesOf(s);
  const idx = Array.from({ length: r.to - r.from + 1 }, (_, k) => r.from + k);
  const pct = (col: Col) => idx.map((i) => +((night(codes, col, i) / Math.max(1, night(codes, 'avail', i))) * 100).toFixed(1));
  const [otb, p10, p50, p90, bud] = [pct('rooms'), pct('p10'), pct('p50'), pct('p90'), pct('bud_rooms')];
  const avail = sumCol(codes, 'avail', r.from, r.to);
  const occ = (col: Col) => Math.round((sumCol(codes, col, r.from, r.to) / avail) * 100);
  const sellOut = p90.filter((x) => x >= 98).length;
  const title = `Forecast lands at ${occ('p50')}% for ${r.short} (P10–P90 ${occ('p10')}–${occ('p90')}%)${sellOut ? `; ${sellOut} night${sellOut === 1 ? '' : 's'} could sell out` : ''}`;
  const ig = ignoredOptional(s, []);
  const ownCmp = isPeriod(s);
  const showBud = s.compare !== 'none';
  return {
    ...base,
    title,
    badge: ownCmp
      ? { label: 'Compares with budget', detail: 'A forecast is a finished number, so it is read against budget; last year’s bookings at this lead time would understate it.' }
      : ignoreBadge(ig, 'The forecast is made per hotel and night, not by segment, channel or booking date.'),
    ignores: [...ig, ...(ownCmp ? ['comparison'] : [])],
    definitions: [DEF.otb, DEF.fc, DEF.bud],
    data: {
      kind: 'bar',
      x: 'night',
      y: ['on_books'],
      forecast: 'forecast_p50',
      band: ['forecast_p10', 'forecast_p90'],
      ...(showBud ? { target: 'budget' } : {}),
      format: 'percent',
      rows: idx.map((i, k) => ({ night: DATES[i], on_books: otb[k], forecast_p10: p10[k], forecast_p50: p50[k], forecast_p90: p90[k], budget: bud[k] })),
      columns: [col('night', 'Night of stay', 'date'), col('on_books', 'On the books', 'percent'), col('forecast_p10', 'P10', 'percent'), col('forecast_p50', 'Forecast (P50)', 'percent'), col('forecast_p90', 'P90', 'percent'), col('budget', 'Budget', 'percent')],
    },
    drillRow: (x) => (typeof x['night'] === 'string' ? { dimension: 'night', value: x['night'], label: dayLabel(x['night']) } : null),
    computed: 'For each night, rooms and rooms available are summed across the selected hotels, then divided. The range adds each hotel’s P10 and P90, so for a group it is wider than the true range.',
  };
}

/* V7 · ARI × MPI quadrant, centred on 100, with the RGI = 100 isocurve and named quadrants. */
function quadrant(s: FilterState): Resolved {
  const future = RANGES[s.range].future;
  const win = future ? 'last30' : s.range;
  const idx = (PF_INDEX as unknown as Record<string, Record<string, { mpi: number; ari: number; rgi: number }>>)[win] ?? {};
  const pts = codesOf(s)
    .filter((c) => idx[c])
    .map((c) => ({ code: c, name: short(c), ...idx[c] }));
  const winning = pts.filter((x) => x.mpi >= 100 && x.ari >= 100).length;
  const low = pts.reduce((a, b) => (a.rgi < b.rgi ? a : b), pts[0]);
  // Plain words: RGI 92.3 is "earns 8% less per room than its comp set". The indices themselves are in the tooltip and the table.
  const perRoom = (rgi: number) => (Math.abs(rgi - 100) < 0.5 ? 'earns the same per room as its comp set' : `earns ${Math.round(Math.abs(rgi - 100))}% ${rgi < 100 ? 'less' : 'more'} per room than its comp set`);
  const title =
    pts.length < 2
      ? `${pts[0]?.name ?? '—'} ${pts[0] ? perRoom(pts[0].rgi) : 'has no comp set data'}`
      : `${winning} of ${pts.length} hotels charge more than their comp set and still win more guests; ${low.name} ${perRoom(low.rgi)}`;
  const ig = ignoredOptional(s, []);
  const cmpIg = s.compare !== 'none';
  return {
    title,
    subtitle: `Each hotel's price and share of guests against its comp set · ${hotelLabel(s.hotels)} · ${RANGES[win as keyof typeof RANGES].short}${future ? ' stayed' : ''}`,
    // No chip: the period is said once, in the subtitle ("last 30 nights stayed": the benchmark only covers nights
    // already stayed), and every point is already against its comp set, which the axes say.
    badge: null,
    ignores: [...(future ? ['stay nights'] : []), ...ig, ...(cmpIg ? ['comparison'] : [])],
    // The corners name themselves; no legend.
    sql: PF_SQL.index,
    definitions: [
      ['MPI', 'occupancy ÷ comp set occupancy × 100 (share of demand)'],
      ['ARI', 'ADR ÷ comp set ADR × 100 (price position)'],
      ['RGI', 'RevPAR ÷ comp set RevPAR × 100 = MPI × ARI ÷ 100'],
      ['Points', '+5 on an index means 5% against the comp set, not 5 pts of occupancy'],
    ],
    computed: 'Computed from each hotel’s daily results and its comp set’s over the window. 100 on either axis is the comp set: right of it a hotel charges more, above it it wins more than its fair share of guests.',
    data: {
      kind: 'scatter',
      x: 'ari',
      y: ['mpi'],
      group: 'hotel',
      format: 'number',
      rows: pts.map((x) => ({ hotel: x.code, ari: x.ari, mpi: x.mpi, rgi: x.rgi })),
      columns: [col('hotel', 'Hotel', 'hotel'), col('ari', 'ARI (price vs comp set)', 'number', 'index'), col('mpi', 'MPI (share vs comp set)', 'number', 'index'), col('rgi', 'RGI (revenue per room vs comp set)', 'number', 'index')],
    },
    height: 380,
    drillRow: (row) => (typeof row['hotel'] === 'string' ? { dimension: 'hotel', value: row['hotel'], label: short(row['hotel']) } : null),
  };
}

/* V12 · GOP bridge, budget (outlined) to actual (solid); steps coloured by their effect on GOP, not by direction. */
function bridge(s: FilterState): Resolved {
  const pnl = PF_PNL as unknown as Record<string, Record<string, { actual?: number; budget?: number }>>;
  const codes = codesOf(s);
  const line = (l: string, k: 'actual' | 'budget') => codes.reduce((t, c) => t + (pnl[c]?.[l]?.[k] ?? 0), 0);
  const rv = (l: string) => line(l, 'actual') - line(l, 'budget');
  const ex = (l: string) => -(line(l, 'actual') - line(l, 'budget')); // spending more lowers GOP
  const steps = [
    { name: 'Rooms revenue', d: rv('ROOMS_REVENUE') },
    { name: 'F&B revenue', d: rv('FNB_REVENUE') },
    { name: 'M&E revenue', d: rv('ME_REVENUE') },
    { name: 'Other revenue', d: rv('OTHER_REVENUE') },
    { name: 'Rooms costs', d: ex('ROOMS_EXPENSE') },
    { name: 'F&B costs', d: ex('FNB_EXPENSE') },
    { name: 'Undistributed', d: ex('AG_EXPENSE') + ex('SM_EXPENSE') + ex('POM_EXPENSE') + ex('UTILITIES_EXPENSE') },
  ];
  const b = line('GOP', 'budget');
  const a = line('GOP', 'actual');
  const rest = a - b - steps.reduce((t, x) => t + x.d, 0);
  if (Math.abs(rest) > 1) steps.push({ name: 'Other', d: rest });
  const biggest = steps.reduce((x, y) => (Math.abs(x.d) > Math.abs(y.d) ? x : y));
  const month = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(`${PF_CLOSED_MONTH}-01T00:00:00Z`));
  const title = `${month} GOP ${fmt.eur(a)}, ${fmt.signedEur(a - b)} vs budget; ${biggest.name.toLowerCase()} moved it most (${fmt.signedEur(biggest.d)})`;
  const ig = ignoredOptional(s, []);
  return {
    title,
    subtitle: `From budgeted to actual GOP · ${hotelLabel(s.hotels)} · ${month}, the last closed month`,
    badge: { label: `Own dates: ${month.split(' ')[0]}`, detail: 'The P&L closes monthly, so the stay-night filter doesn’t apply; October is the last closed month. It is always read against budget.' },
    ignores: ['stay nights', ...ig, ...(s.compare !== 'budget' && s.compare !== 'none' ? ['comparison'] : [])],
    sql: PF_SQL.pnl,
    definitions: [
      ['GOP', 'gross operating profit: total revenue − departmental and undistributed expenses (USALI)'],
      ['Effect', 'revenue above budget raises GOP; costs above budget lower it'],
    ],
    computed: 'Each step is actual − budget for its P&L lines (costs with the sign flipped), summed over the selected hotels; “Other” reconciles any line not listed. The axis is broken so the steps are readable; the break is drawn on the totals.',
    data: {
      kind: 'waterfall',
      x: 'step',
      y: ['effect'],
      format: 'currency',
      rows: [{ step: 'Budget GOP', effect: Math.round(b), total: true }, ...steps.map((x) => ({ step: x.name, effect: Math.round(x.d), total: false })), { step: 'Actual GOP', effect: Math.round(a), total: true }],
      columns: [col('step', 'Step', 'text'), col('effect', 'Effect on GOP', 'currency', 'EUR'), { ...col('total', 'Total', 'text'), hidden: true }],
    },
    height: 300,
  };
}

/* V16 · Hotel table: exact values with an in-cell bar and a sparkline; chain total first. */
function hotelTable(s: FilterState): Resolved {
  const { from, to } = RANGES[s.range];
  const all = codesOf(s);
  const proj = projects(s);
  const make = (codes: string[], name: string) => {
    const t = totals(s, codes);
    const basis = proj ? asForecast(t) : t;
    const spark = Array.from({ length: to - from + 1 }, (_, k) => (night(codes, 'rooms', from + k) / Math.max(1, night(codes, 'avail', from + k))) * 100);
    return { name, t, occ: METRIC.occupancy.value(t), dOcc: delta('occupancy', basis), dRev: delta('revenue', basis), spark };
  };
  const hotelRows = all.map((c) => make([c], short(c))).sort((a, b) => b.t.rev - a.t.rev);
  const shown = all.length > 1 ? [make(all, s.hotels.length ? 'Selection total' : 'Group total'), ...hotelRows] : hotelRows;
  const title = `${all.length} ${all.length === 1 ? 'hotel' : 'hotels'}, ${RANGES[s.range].short}, by room revenue`;
  const ig = ignoredOptional(s, []);
  return {
    title,
    subtitle: scope(s),
    badge: ignoreBadge(ig, 'Hotel totals aren’t split by segment, channel or booking date.'),
    ignores: ig,
    sql: PF_SQL.nights,
    definitions: [DEF.occ, ['ADR', 'room revenue ÷ rooms sold'], ['RevPAR', 'room revenue ÷ rooms available'], ...cmpDefs(s)],
    computed: `Sums over the selected nights per hotel, then the ratios. Δ is against ${s.compare === 'none' ? 'nothing (no comparison)' : proj ? 'budget, using the forecast for nights not yet stayed' : COMPARES[s.compare].short}. Occupancy changes are in percentage points.`,
    data: {
      kind: 'table',
      rows: shown.map((r) => ({ hotel: r.name, occupancy: r1(r.occ), occupancy_change_pp: r1(r.dOcc), adr: Math.round(METRIC.adr.value(r.t)), revpar: Math.round(METRIC.revpar.value(r.t)), room_revenue: Math.round(r.t.rev), revenue_change_pct: r1(r.dRev) })),
      columns: [
        col('hotel', 'Hotel', 'hotel'),
        col('occupancy', 'Occupancy', 'percent'),
        col('occupancy_change_pp', 'Δ occupancy', 'number', 'pts'),
        col('adr', 'ADR', 'currency', 'EUR'),
        col('revpar', 'RevPAR', 'currency', 'EUR'),
        col('room_revenue', 'Room revenue', 'currency', 'EUR'),
        col('revenue_change_pct', 'Δ revenue', 'percent'),
      ],
    },
  };
}

/** The Portfolio board's widgets, as specs (the same shape Kassandra emits). */
export const PORTFOLIO_SPECS: ChartSpec[] = [
  { id: 'c-position', kind: 'position', metric: 'room_revenue', rows: 'hotel' },
  { id: 'c-pace', kind: 'pace', metric: 'room_nights' },
  { id: 'c-pickup', kind: 'pickup', metric: 'room_nights' },
  { id: 'c-fan', kind: 'fan', metric: 'occupancy' },
  { id: 'c-mix', kind: 'mix_net', dimension: 'channel' },
  { id: 'c-segments', kind: 'share', metric: 'room_nights', dimension: 'segment' },
  { id: 'c-index', kind: 'quadrant', x: 'ari', y: 'mpi' },
  { id: 'c-gop', kind: 'bridge', metric: 'gop' },
  { id: 'c-table', kind: 'table', rows: 'hotel' },
];
export const isWide = (s: ChartSpec) => ['position', 'pace', 'pickup', 'fan', 'bridge', 'table'].includes(s.kind);
