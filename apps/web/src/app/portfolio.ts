import type { EChartsCoreOption } from 'echarts/core';
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
import { PF_CLOSED_MONTH, PF_DATES, PF_EVENTS, PF_INDEX, PF_MIX, PF_MIX_CMP, PF_NIGHTS, PF_PACE, PF_PICKUP, PF_PNL, PF_SQL } from './portfolio-data';

/*
  The chart catalogue (report "Filtre și grafice pentru Compass", stage 2). A spec is small and flat: it
  names the question (`kind`) and never a number or a colour. The resolver turns spec + FilterState into
  the numbers, the statement title, the scope line, the compatible views (and why the others aren't),
  the table, the badge when a filter can't apply, and an ECharts option.

  Colour, as the report sets it (at most two accents per chart):
  - current period: blue, solid;
  - comparison: purple, dashed or lighter (recognisable without colour too);
  - budget: a neutral, labelled reference line or tick;
  - forecast: hatched (IBCS);
  - everything else grey; orange only for "needs your decision" (not used here).
  Rates change in percentage points ("+3.1 pp"), money in percent ("+4.2%").
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

export type View = 'kpi' | 'bullet' | 'bars' | 'line' | 'columns' | 'donut' | 'quadrant' | 'waterfall' | 'table';
export const VIEW_LABEL: Record<View, string> = {
  kpi: 'Number',
  bullet: 'Bullet rows',
  bars: 'Bars',
  line: 'Line',
  columns: 'Columns',
  donut: 'Donut',
  quadrant: 'Quadrant',
  waterfall: 'Bridge',
  table: 'Table',
};

export interface Palette {
  series: string;
  seriesSoft: string;
  cmp: string;
  ref: string;
  grey: string;
  text: string;
  muted: string;
  grid: string;
  card: string;
  popover: string;
  border: string;
  fg: string;
  neg: string;
}

export type Cell = string | { text: string; bar?: number; spark?: number[]; muted?: boolean };
export interface Drill {
  dimension: 'hotel' | 'night' | 'channel' | 'segment';
  value: string;
  label: string;
}
export type Mark = 'solid' | 'dashed-cmp' | 'tick-cmp' | 'line-ref' | 'hatch' | 'band' | 'dotted' | 'grey' | 'neg' | 'outline';

export interface Resolved {
  title: string;
  subtitle: string;
  aria: string;
  view: View;
  /** Why Auto picked `view` (shown in "Show as"). */
  autoWhy: string;
  views: { view: View; ok: boolean; reason?: string }[];
  badge: { label: string; detail: string } | null;
  ignores: string[];
  legend: { label: string; mark: Mark }[];
  table: { columns: string[]; rows: Cell[][]; align?: ('l' | 'r')[] };
  kpi?: { value: string; delta: string };
  empty?: { text: string; action?: { label: string; patch: Partial<FilterState> } };
  sql: string;
  definitions: [string, string][];
  computed: string;
  height: number;
  /** Turns a click on a mark into a structured follow-up ({ drill: { dimension, value } }), never free text. */
  drill?: (dataIndex: number) => Drill | null;
  option: (view: View, p: Palette, width: number) => EChartsCoreOption;
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
const cmpShort = (s: FilterState) => (s.compare === 'stly' ? 'STLY' : s.compare === 'ly_dow' ? 'LY' : s.compare === 'ly_date' ? 'LY (date)' : s.compare === 'prev' ? 'previous period' : COMPARES[s.compare].short);

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
  pp: (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} pp`,
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
            : `${cmpShort(s)} ${METRIC[m].format(c)} · ${compareDates(s.range, s.compare).split(',')[0]}`;
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

/* ───────────── shared pieces ───────────── */
const scope = (s: FilterState) =>
  scopeChips(s)
    .filter((c) => !c.startsWith('Segment') && !c.startsWith('Channel') && !c.startsWith('Booked'))
    .join(' · ');
const dayLabel = (iso: string) => fmtDay(at(iso));
const DEF = {
  occ: ['Occupancy', 'rooms sold (or on the books) ÷ rooms available; out-of-order rooms excluded'] as [string, string],
  stly: ['Same time last year', 'the same weekday 364 days earlier, on the books at the same lead time (pace_vs_stly())'] as [string, string],
  lyDow: ['Last year, same weekday', 'final actuals 364 days earlier'] as [string, string],
  lyDate: ['Last year, same date', '365 days earlier; for future nights on the books at the same lead time'] as [string, string],
  prev: ['Previous period', 'the same number of nights immediately before'] as [string, string],
  bud: ['Budget per night', 'the month’s budget ÷ its days'] as [string, string],
  fc: ['Forecast', `the RMS forecast made on ${fmtDay(at(BUSINESS_DATE))}: P50 is the middle case, P10–P90 the likely range. P25–P75 isn’t stored in this forecast table.`] as [string, string],
  otb: ['On the books', 'reservations made before today and not cancelled (otb_as_of())'] as [string, string],
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
const axisBase = (p: Palette) => ({
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: p.muted, fontSize: 12, fontFamily: 'Inter' },
  splitLine: { lineStyle: { color: p.grid } },
});
const tooltip = (p: Palette, trigger: 'axis' | 'item' = 'axis') => ({
  trigger,
  confine: true,
  backgroundColor: p.popover,
  borderColor: p.border,
  textStyle: { color: p.fg, fontSize: 12, fontFamily: 'Inter' },
  axisPointer: { type: trigger === 'axis' ? 'shadow' : 'line', shadowStyle: { color: 'rgba(127,127,127,0.08)' }, lineStyle: { color: p.border } },
});
/** IBCS: forecast is hatched. The decal only renders with aria.decal.show, so every other series sets decal 'none'. */
const hatch = (p: Palette, color = p.seriesSoft) => ({ symbol: 'rect', symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [2, 4], rotation: -Math.PI / 4, color, backgroundColor: 'transparent' });
const aria = (summary: string) => ({ enabled: true, label: { description: summary }, decal: { show: true } });
const solid = { decal: { symbol: 'none' } };
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion = () => (reduced() ? { animation: false } : { animationDuration: 350 });
const zoom = (p: Palette) => ({
  dataZoom: [
    { type: 'inside', start: 0, end: 40 },
    { type: 'slider', height: 18, bottom: 6, start: 0, end: 40, borderColor: p.border, fillerColor: 'rgba(127,127,127,0.12)', textStyle: { color: p.muted } },
  ],
});

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
  const rows = hotels.length > 1 ? [row(codes, 'Chain total', null), ...hotels] : hotels;
  const one = hotels.length === 1;
  const pctOf = (x: number, b: number) => (b ? (x / b) * 100 : 0);
  const rowText = (r: (typeof rows)[number], narrow = false) => {
    const parts = [fmt.eur(r.otb)];
    if (r.cmp !== null && !narrow) parts.push(`${fmt.signedEur(r.otb - r.cmp)} vs ${cmpShort(s)}`);
    parts.push(`${Math.round(pctOf(r.otb, r.bud))}% of budget`);
    return parts.join(' · ');
  };
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
    aria: `${title}. ${rows.map((r) => `${r.name} ${rowText(r)}`).join('; ')}`,
    view: one ? 'kpi' : 'bullet',
    autoWhy: one ? 'One hotel: a number says it best' : 'Position against a target: bullet rows',
    views: one
      ? [
          { view: 'kpi', ok: true },
          { view: 'table', ok: true },
        ]
      : [
          { view: 'bullet', ok: true },
          { view: 'bars', ok: true },
          { view: 'table', ok: true },
          { view: 'donut', ok: false, reason: 'Hotels against budget aren’t parts of one whole' },
        ],
    badge: ignoreBadge(ig, 'Hotel revenue and budget aren’t split by segment, channel or booking date; the mix and pickup charts follow those filters.'),
    ignores: ig,
    legend: [
      { label: future ? 'On the books' : 'Actual', mark: 'solid' },
      ...(future ? [{ label: 'Forecast to come (P50)', mark: 'hatch' as Mark }] : []),
      ...(isPeriod(s) ? [{ label: COMPARES[s.compare].label, mark: 'tick-cmp' as Mark }] : []),
      { label: 'Budget = 100%', mark: 'line-ref' },
    ],
    table: {
      columns: ['Hotel', future ? 'On the books' : 'Actual', ...(future ? ['Forecast P50'] : []), ...(isPeriod(s) ? [cmpShort(s)] : []), 'Budget', '% of budget'],
      rows: rows.map((r) => [r.name, fmt.eur(r.otb), ...(future ? [fmt.eur(r.p50 ?? 0)] : []), ...(isPeriod(s) ? [fmt.eur(r.cmp ?? 0)] : []), fmt.eur(r.bud), `${Math.round(pctOf(r.otb, r.bud))}%`]),
      align: ['l', 'r', 'r', 'r', 'r', 'r'],
    },
    kpi: one ? { value: fmt.eur(worst.otb), delta: rowText(worst).split(' · ').slice(1).join(' · ') } : undefined,
    sql: PF_SQL.nights,
    definitions: [DEF.otb, DEF.bud, ...(future ? [DEF.fc] : []), ...cmpDefs(s).filter((d) => d !== DEF.bud && d !== DEF.fc)],
    computed: `Each row sums room revenue over the selected nights and divides by the budget for the same nights, so every hotel shares one scale and the chain total sits on top. Sorted by where the hotel ${future ? 'is forecast to land' : 'finished'} against budget, worst first.`,
    height: Math.max(110, rows.length * 30 + 40),
    drill: (i) => (rows[i]?.code ? { dimension: 'hotel', value: rows[i].code!, label: rows[i].name } : null),
    option: (view, p, width) => {
      const narrow = width < 560;
      const max = Math.max(120, ...rows.map((r) => Math.ceil(pctOf(Math.max(r.otb, r.p50 ?? 0, r.cmp ?? 0), r.bud) / 10) * 10));
      const otb = rows.map((r) => +pctOf(r.otb, r.bud).toFixed(1));
      return {
        aria: aria(title),
        ...motion(),
        grid: { left: 8, right: 8, top: 4, bottom: 24, containLabel: true },
        tooltip: {
          ...tooltip(p),
          formatter: (xs: { dataIndex: number }[]) => {
            const r = rows[xs[0].dataIndex];
            return `<b>${r.name}</b><br/>${future ? 'On the books' : 'Actual'} ${fmt.eur(r.otb)} (${Math.round(pctOf(r.otb, r.bud))}%)${r.p50 !== null ? `<br/>Forecast P50 ${fmt.eur(r.p50)} (${Math.round(pctOf(r.p50, r.bud))}%)` : ''}${r.cmp !== null ? `<br/>${COMPARES[s.compare].label} ${fmt.eur(r.cmp)}` : ''}<br/>Budget ${fmt.eur(r.bud)}`;
          },
        },
        xAxis: { type: 'value', min: 0, max, interval: narrow ? 50 : 25, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, formatter: '{value}%' } },
        yAxis: [
          {
            type: 'category',
            data: rows.map((r) => r.name),
            inverse: true,
            ...axisBase(p),
            axisLabel: {
              color: p.text,
              fontSize: 12.5,
              fontFamily: 'Inter',
              width: narrow ? Math.round(width * 0.28) : 150,
              overflow: 'truncate',
              formatter: (n: string) => (n === 'Chain total' ? `{b|${n}}` : n),
              rich: { b: { fontWeight: 600, color: p.text, fontSize: 12.5, fontFamily: 'Inter' } },
            },
            splitLine: { show: false },
          },
          { type: 'category', data: rows.map((r) => rowText(r, narrow)), inverse: true, position: 'right', ...axisBase(p), axisLabel: { color: p.muted, fontSize: 12, fontFamily: 'Inter' }, splitLine: { show: false } },
        ],
        series: [
          { name: future ? 'On the books' : 'Actual', type: 'bar', stack: 'pos', barWidth: 12, data: otb, itemStyle: { color: p.series, ...solid }, z: 3 },
          ...(view === 'bullet' && future
            ? [
                {
                  name: 'Forecast to come (P50)',
                  type: 'bar',
                  stack: 'pos',
                  barWidth: 12,
                  data: rows.map((r, i) => Math.max(0, +(pctOf(r.p50 ?? 0, r.bud) - otb[i]).toFixed(1))),
                  itemStyle: { color: 'transparent', borderColor: p.series, borderWidth: 1, decal: hatch(p) },
                  z: 2,
                },
              ]
            : []),
          ...(view === 'bullet' && isPeriod(s)
            ? [{ name: COMPARES[s.compare].label, type: 'scatter', symbol: 'rect', symbolSize: [2.5, 20], data: rows.map((r, i) => [+pctOf(r.cmp ?? 0, r.bud).toFixed(1), i]), itemStyle: { color: p.cmp, ...solid }, z: 4 }]
            : []),
          {
            name: 'Budget',
            type: 'line',
            data: [],
            markLine: { symbol: 'none', silent: true, lineStyle: { color: p.ref, type: 'solid', width: 1.5 }, label: { show: false }, data: [{ xAxis: 100 }] },
          },
        ],
      };
    },
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
  // Between today and the last night the projection follows last year's pickup shape (stated in "How this was computed").
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
  const startIdx = Math.round((at(DATES[r.from]) - firstT) / DAY);
  return {
    title,
    subtitle: `Room nights on the books for these stays, by booking date · ${scope(s)}`,
    aria: title,
    view: 'line',
    autoWhy: 'Change over time: a line, with last year dashed',
    views: [
      { view: 'line', ok: true },
      { view: 'table', ok: true },
      { view: 'donut', ok: false, reason: 'A series over time isn’t parts of one whole' },
    ],
    badge: ownCmp
      ? { label: 'Compares with same time last year', detail: 'Pace is read at the same lead time, so it always compares with last year on the same weekday.' }
      : ignoreBadge(ig, 'Pace counts every reservation for these nights; segment, channel and booking-date filters apply to the mix and pickup charts.'),
    ignores: [...ig, ...(ownCmp ? ['comparison'] : [])],
    legend: [
      { label: 'This year', mark: 'solid' },
      ...(showLy ? [{ label: r.future ? 'Same time last year' : 'Last year', mark: 'dashed-cmp' as Mark }] : []),
      ...(r.future ? [{ label: 'Projection (P50)', mark: 'dotted' as Mark }, { label: 'P10–P90', mark: 'band' as Mark }] : []),
      ...(s.compare === 'budget' ? [{ label: 'Budget', mark: 'line-ref' as Mark }] : []),
      { label: 'Capacity', mark: 'line-ref' },
    ],
    table: {
      columns: ['Booked as of', 'This year', 'Last year', ...(r.future ? ['P10', 'P50', 'P90'] : [])],
      rows: labels
        .map((l, k) => [l, ty[k] !== undefined ? fmt.int(ty[k]) : '—', fmt.int(ly[k] ?? 0), ...(r.future ? [b10[k], b50[k], b90[k]].map((x) => (x === null ? '—' : fmt.int(x))) : [])])
        .filter((_, k) => k % 7 === 0 || k === tyLen - 1 || k === lastIdx),
      align: ['l', 'r', 'r', 'r', 'r', 'r'],
    },
    sql: PF_SQL.pace,
    definitions: [DEF.otb, DEF.stly, ...(r.future ? [DEF.fc] : []), ['Capacity', 'rooms available over the selected nights']],
    computed: `Counts each reservation night in the window from the day it was booked until the day it was cancelled, the same rule as otb_as_of(). Last year uses the same weekdays 364 days earlier.${r.future ? ' The P10–P90 range ends at the forecast for these nights; between today and then it follows last year’s pickup shape.' : ''}`,
    height: 270,
    option: (_v, p, width) => ({
      aria: aria(title),
      ...motion(),
      grid: { left: 8, right: 24, top: 26, bottom: 8, containLabel: true },
      tooltip: { ...tooltip(p), axisPointer: { type: 'line', lineStyle: { color: p.border } }, valueFormatter: (x: number | null) => (x === null || x === undefined ? '—' : fmt.int(x)) },
      xAxis: { type: 'category', data: labels, boundaryGap: false, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, interval: Math.ceil(labels.length / (width < 560 ? 3 : 6)) - 1 }, splitLine: { show: false } },
      yAxis: { type: 'value', min: 0, max: Math.ceil((capacity * 1.05) / 100) * 100, splitNumber: 4, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, formatter: (x: number) => fmt.k(x) } },
      series: [
        ...(r.future
          ? [
              { name: 'P10', type: 'line', data: b10, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, itemStyle: solid },
              { name: 'P90', type: 'line', data: b90.map((x, k) => (x === null ? null : x - (b10[k] ?? 0))), stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: p.series, opacity: 0.14 }, itemStyle: solid, tooltip: { show: false } },
              { name: 'Projection (P50)', type: 'line', data: b50, symbol: 'none', lineStyle: { color: p.series, width: 1.5, type: 'dotted' }, itemStyle: { color: p.series, ...solid } },
            ]
          : []),
        ...(showLy || ownCmp ? [{ name: r.future ? 'Same time last year' : 'Last year', type: 'line', data: ly, symbol: 'none', lineStyle: { color: p.cmp, width: 1.5, type: 'dashed' }, itemStyle: { color: p.cmp, ...solid } }] : []),
        {
          name: 'This year',
          type: 'line',
          data: ty,
          symbol: 'none',
          lineStyle: { color: p.series, width: 2.5 },
          itemStyle: { color: p.series, ...solid },
          endLabel: { show: r.future, formatter: () => fmt.int(now), color: p.text, fontSize: 12, fontWeight: 600 },
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { color: p.ref, type: 'solid', width: 1, opacity: 0.7 },
            label: { color: p.muted, fontSize: 11.5 },
            data: [
              ...(r.future ? [{ xAxis: tyLen - 1, label: { formatter: 'Today', position: 'end' }, lineStyle: { color: p.muted, type: 'dashed' } }] : []),
              { yAxis: capacity, label: { formatter: `Capacity ${fmt.k(capacity)}`, position: 'insideStartTop' } },
              ...(s.compare === 'budget' ? [{ yAxis: Math.round(budget), label: { formatter: `Budget ${fmt.k(budget)}`, position: 'insideEndTop' } }] : []),
            ],
          },
          markArea: { silent: true, itemStyle: { color: 'rgba(127,127,127,0.06)' }, label: { color: p.muted, fontSize: 11.5, position: 'insideBottom' }, data: [[{ name: 'Stay nights', xAxis: startIdx }, { xAxis: lastIdx }]] },
        },
      ],
    }),
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
    aria: 'Pickup',
    view: 'columns',
    autoWhy: 'Gains and losses per night: diverging columns',
    views: [
      { view: 'columns', ok: true },
      { view: 'table', ok: true },
    ],
    badge: null,
    ignores: [],
    legend: [],
    table: { columns: [], rows: [] },
    sql: PF_SQL.pickup,
    definitions: [],
    computed: '',
    height: 260,
    option: () => ({}),
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
  const labels = dates.map((d) => dayLabel(d));
  const total = (a: number[]) => a.reduce((t, x) => t + x, 0);
  const showLy = s.compare !== 'none';
  const ownCmp = !['stly', 'none'].includes(s.compare);
  const title = `Net pickup ${fmt.signedInt(total(b) - total(c))} room nights in the ${win} (${fmt.int(total(b))} booked, ${fmt.int(total(c))} cancelled)${showLy ? `; last year ${fmt.signedInt(total(lyNet))}` : ''}`;
  const cities = [...new Set(codes.map((x) => HOTELS.find((h) => h.code === x)?.city))];
  const events = (PF_EVENTS as readonly { city: string; name: string; start: string; end: string }[]).filter((e) => cities.includes(e.city) && e.end >= dates[0] && e.start <= dates[n - 1]);
  const showEvents = cities.length <= 3;
  const weekend = dates.map((d) => [5, 6].includes(new Date(at(d)).getUTCDay()));
  const ig = ignoredOptional(s, ['booked']);
  return {
    ...base,
    title,
    aria: title,
    badge: ownCmp
      ? { label: 'Compares with same time last year', detail: 'Pickup compares the same booking window a year earlier, on the same weekdays.' }
      : ignoreBadge(ig, 'Pickup counts every reservation; segment and channel apply to the mix charts.'),
    ignores: [...ig, ...(ownCmp ? ['comparison'] : [])],
    legend: [
      { label: 'Booked', mark: 'solid' },
      { label: 'Cancelled', mark: 'grey' },
      ...(showLy ? [{ label: 'Last year, net', mark: 'dashed-cmp' as Mark }] : []),
      { label: showEvents && events.length ? 'Weekends and city events' : 'Weekends (Fri, Sat)', mark: 'band' },
    ],
    table: {
      columns: ['Night', 'Booked', 'Cancelled', 'Net', ...(showLy ? ['Last year net'] : [])],
      rows: labels.map((l, j) => [`${l}${weekend[j] ? ' (weekend)' : ''}`, fmt.int(b[j]), fmt.int(c[j]), fmt.signedInt(b[j] - c[j]), ...(showLy ? [fmt.signedInt(lyNet[j])] : [])]),
      align: ['l', 'r', 'r', 'r', 'r'],
    },
    definitions: [
      ['Pickup', `room nights booked in the ${win}, by night of stay`],
      ['Cancelled', 'room nights cancelled in the same days, shown below zero'],
      ['Last year', 'the same booking window 364 days earlier, for the same weekdays'],
    ],
    computed: `For each night, counts reservation nights created, and separately cancelled, in the ${win} up to ${fmtDay(at(BUSINESS_DATE))}. Change the window with “+ Filter → Booked”.`,
    drill: (j) => (dates[j] ? { dimension: 'night', value: dates[j], label: labels[j] } : null),
    option: (_v, p, width) => ({
      aria: aria(title),
      ...motion(),
      grid: { left: 8, right: 12, top: 26, bottom: n > 45 ? 44 : 8, containLabel: true },
      tooltip: {
        ...tooltip(p),
        formatter: (xs: { dataIndex: number }[]) => {
          const j = xs[0].dataIndex;
          const ev = events.filter((e) => e.start <= dates[j] && e.end >= dates[j]).map((e) => e.name);
          return `<b>${labels[j]}</b>${ev.length ? ` · ${ev.join(', ')}` : ''}<br/>Booked ${fmt.int(b[j])}<br/>Cancelled ${fmt.int(c[j])}<br/>Net ${fmt.signedInt(b[j] - c[j])}${showLy ? `<br/>Last year net ${fmt.signedInt(lyNet[j])}` : ''}`;
        },
      },
      ...(n > 45 ? zoom(p) : {}),
      xAxis: { type: 'category', data: labels, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, interval: Math.ceil(n / (width < 560 ? 4 : 8)) - 1 }, splitLine: { show: false } },
      yAxis: { type: 'value', splitNumber: 4, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, formatter: (x: number) => fmt.k(x) } },
      series: [
        {
          name: 'Booked',
          type: 'bar',
          stack: 'p',
          data: b,
          barMaxWidth: 14,
          itemStyle: { color: p.series, ...solid },
          markLine: { symbol: 'none', silent: true, lineStyle: { color: p.ref, width: 1 }, label: { show: false }, data: [{ yAxis: 0 }] },
          markArea: {
            silent: true,
            itemStyle: { color: 'rgba(127,127,127,0.08)' },
            label: { color: p.muted, fontSize: 11, position: 'insideTop' },
            data: [
              ...weekend.flatMap((w, j) => (w && !weekend[j - 1] ? [[{ xAxis: j }, { xAxis: weekend[j + 1] ? j + 1 : j }]] : [])),
              ...(showEvents ? events.map((e) => [{ name: e.name, xAxis: e.start < dates[0] ? 0 : dates.indexOf(e.start) }, { xAxis: e.end > dates[n - 1] ? n - 1 : dates.indexOf(e.end) }]) : []),
            ],
          },
        },
        { name: 'Cancelled', type: 'bar', stack: 'p', data: c.map((x) => -x), barMaxWidth: 14, itemStyle: { color: p.grey, ...solid } },
        ...(showLy ? [{ name: 'Last year, net', type: 'line', step: 'middle', data: lyNet, symbol: 'none', lineStyle: { color: p.cmp, width: 1.5, type: 'dashed' }, itemStyle: { color: p.cmp, ...solid } }] : []),
      ],
    }),
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
    aria: `${title}. ${list.map((x) => `${x.name} ${fmt.eur(x.net)} net`).join(', ')}`,
    view: 'bars',
    autoWhy: 'A ranking with a part inside each bar: sorted horizontal bars',
    views: [
      { view: 'bars', ok: true },
      { view: 'table', ok: true },
      { view: 'donut', ok: false, reason: 'Net and commission are two measures; a donut shows one whole' },
    ],
    badge: cmpBadge
      ? { label: 'Compares with last year', detail: 'The mix is compared with the same weekdays last year; budget and forecast aren’t split by channel.' }
      : ignoreBadge(ig, 'The mix is counted from reservations on the books; the booking-date filter applies to pickup.'),
    ignores: [...ig, ...(cmpBadge ? ['comparison'] : [])],
    legend: [{ label: 'Net room revenue', mark: 'solid' }, { label: 'Commission', mark: 'hatch' }, ...(ly ? [{ label: `${cmpShort(s)} net`, mark: 'tick-cmp' as Mark }] : [])],
    table: {
      columns: ['Channel', 'Room nights', 'Revenue', 'Commission', 'Net', ...(ly ? [`${cmpShort(s)} net`] : []), 'Share of net'],
      rows: list.map((x) => [x.name, fmt.int(x.rn), fmt.eur(x.rev), fmt.eur(x.comm), fmt.eur(x.net), ...(ly ? [fmt.eur(x.lyNet ?? 0)] : []), `${Math.round((x.net / totalNet) * 100)}%`]),
      align: ['l', 'r', 'r', 'r', 'r', 'r', 'r'],
    },
    empty: list.length ? undefined : { text: 'No room nights match these filters. Try clearing the segment and channel filters.', action: { label: 'Clear segment and channel', patch: { segments: [], channels: [] } } },
    sql: `${PF_SQL.mix}\n\n${PF_SQL.mix_cmp}`,
    definitions: [['Net', 'room revenue − commission'], ['Commission', 'revenue × the channel’s commission rate'], ...(ly ? [s.compare === 'stly' ? DEF.stly : DEF.lyDow] : [])],
    computed: 'Sums each reservation night in the window by channel, after the hotel, segment and channel filters, then applies the channel’s commission rate. Sorted by net, largest first.',
    height: Math.max(140, list.length * 34 + 30),
    drill: (i) => (list[i] ? { dimension: 'channel', value: list[i].code, label: list[i].name } : null),
    option: (_v, p, width) => ({
      aria: aria(title),
      ...motion(),
      grid: { left: 8, right: 8, top: 4, bottom: 22, containLabel: true },
      tooltip: {
        ...tooltip(p),
        formatter: (xs: { dataIndex: number }[]) => {
          const x = list[xs[0].dataIndex];
          return `<b>${x.name}</b><br/>Net ${fmt.eur(x.net)}<br/>Commission ${fmt.eur(x.comm)}${x.lyNet !== null ? `<br/>${cmpShort(s)} net ${fmt.eur(x.lyNet)}` : ''}`;
        },
      },
      xAxis: { type: 'value', splitNumber: 3, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, formatter: (x: number) => fmt.axis(x) } },
      yAxis: [
        { type: 'category', data: list.map((x) => x.name), inverse: true, ...axisBase(p), axisLabel: { color: p.text, fontSize: 12.5, fontFamily: 'Inter', width: width < 560 ? 96 : 140, overflow: 'truncate' }, splitLine: { show: false } },
        { type: 'category', data: list.map((x) => (width < 560 ? fmt.eur(x.net) : `${fmt.eur(x.net)} · ${fmt.eur(x.comm)} comm.`)), inverse: true, position: 'right', ...axisBase(p), axisLabel: { color: p.muted, fontSize: 12 }, splitLine: { show: false } },
      ],
      series: [
        { name: 'Net room revenue', type: 'bar', stack: 'm', barWidth: 12, data: list.map((x) => Math.round(x.net)), itemStyle: { color: p.series, ...solid } },
        { name: 'Commission', type: 'bar', stack: 'm', barWidth: 12, data: list.map((x) => Math.round(x.comm)), itemStyle: { color: 'transparent', borderColor: p.grey, borderWidth: 1, decal: hatch(p, p.grey) } },
        ...(ly ? [{ name: `${cmpShort(s)} net`, type: 'scatter', symbol: 'rect', symbolSize: [2.5, 20], data: list.map((x, i) => [Math.round(x.lyNet ?? 0), i]), itemStyle: { color: p.cmp, ...solid }, z: 4 }] : []),
      ],
    }),
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
          ? 'The two largest parts are under 5 pp apart; bars show the difference'
          : null;
  const top = list[0];
  const title = top ? `${top.name} is ${Math.round(top.pct)}% of room nights${top.lyPct !== null ? `, ${fmt.pp(top.pct - top.lyPct)} vs ${cmpShort(s)}` : ''}` : 'No room nights match these filters';
  const ig = ignoredOptional(s, ['segment', 'channel']);
  const cmpBadge = s.compare !== 'none' && !mixCmpOk(s);
  return {
    title,
    subtitle: `Share of room nights by segment · ${scope(s)}`,
    aria: `${title}. ${list.map((x) => `${x.name} ${Math.round(x.pct)}%`).join(', ')}`,
    view: 'bars',
    autoWhy: 'Part-to-whole: sorted bars on a % axis',
    views: [
      { view: 'bars', ok: true },
      { view: 'donut', ok: !gate, reason: gate ?? undefined },
      { view: 'table', ok: true },
    ],
    badge: cmpBadge
      ? { label: 'Compares with last year', detail: 'Shares are compared with the same weekdays last year; budget and forecast aren’t split by segment.' }
      : ignoreBadge(ig, 'Shares are counted from reservations on the books; the booking-date filter applies to pickup.'),
    ignores: [...ig, ...(cmpBadge ? ['comparison'] : [])],
    legend: [{ label: 'Share of room nights', mark: 'solid' }, ...(ly ? [{ label: cmpShort(s), mark: 'tick-cmp' as Mark }] : [])],
    table: {
      columns: ['Segment', 'Room nights', 'Share', ...(ly ? [cmpShort(s), 'Change'] : [])],
      rows: list.map((x) => [x.name, fmt.int(x.rn), `${x.pct.toFixed(1)}%`, ...(ly ? [`${(x.lyPct ?? 0).toFixed(1)}%`, fmt.pp(x.pct - (x.lyPct ?? 0))] : [])]),
      align: ['l', 'r', 'r', 'r', 'r'],
    },
    empty: list.length ? undefined : { text: 'No room nights match these filters. Try clearing the segment and channel filters.', action: { label: 'Clear segment and channel', patch: { segments: [], channels: [] } } },
    sql: `${PF_SQL.mix}\n\n${PF_SQL.mix_cmp}`,
    definitions: [['Share', 'room nights in the segment ÷ all room nights in the window'], ...(ly ? [s.compare === 'stly' ? DEF.stly : DEF.lyDow] : [])],
    computed: 'Counts reservation nights in the window by segment, after the hotel and channel filters. A donut is offered only when the parts pass the gate: one whole, 2–5 slices after grouping, “Other” not the largest, the top two at least 5 pp apart.',
    height: Math.max(140, list.length * 32 + 30),
    drill: (i) => (list[i] ? { dimension: 'segment', value: list[i].code, label: list[i].name } : null),
    option: (view, p) => {
      if (view === 'donut') {
        const greys = ['#8b949e', '#6e7681', '#a3abb4', '#565e66'];
        return {
          aria: aria(title),
          ...motion(),
          tooltip: { ...tooltip(p, 'item'), formatter: (x: { name: string; percent: number }) => `${x.name}: ${x.percent.toFixed(1)}%` },
          title: { text: fmt.k(total), subtext: 'room nights', left: 'center', top: 'center', textStyle: { color: p.text, fontSize: 18, fontWeight: 600 }, subtextStyle: { color: p.muted, fontSize: 12 }, itemGap: 2 },
          series: [
            {
              type: 'pie',
              radius: ['52%', '72%'],
              startAngle: 90,
              clockwise: true,
              data: slices.map((x, i) => ({ name: x.name, value: x.rn, itemStyle: { color: i === 0 ? p.series : greys[(i - 1) % greys.length], borderColor: p.card, borderWidth: 2, ...solid } })),
              label: { color: p.text, fontSize: 12, formatter: (x: { name: string; percent: number }) => `${x.name}\n${Math.round(x.percent)}%` },
              labelLine: { lineStyle: { color: p.border } },
            },
          ],
        };
      }
      return {
        aria: aria(title),
        ...motion(),
        grid: { left: 8, right: 8, top: 4, bottom: 22, containLabel: true },
        tooltip: {
          ...tooltip(p),
          formatter: (xs: { dataIndex: number }[]) => {
            const x = list[xs[0].dataIndex];
            return `<b>${x.name}</b><br/>${x.pct.toFixed(1)}% · ${fmt.int(x.rn)} room nights${x.lyPct !== null ? `<br/>${cmpShort(s)} ${x.lyPct.toFixed(1)}%` : ''}`;
          },
        },
        xAxis: { type: 'value', min: 0, max: Math.max(50, Math.ceil(Math.max(...list.map((x) => Math.max(x.pct, x.lyPct ?? 0))) / 10) * 10), splitNumber: 3, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, formatter: '{value}%' } },
        yAxis: [
          { type: 'category', data: list.map((x) => x.name), inverse: true, ...axisBase(p), axisLabel: { color: p.text, fontSize: 12.5, fontFamily: 'Inter' }, splitLine: { show: false } },
          { type: 'category', data: list.map((x) => `${Math.round(x.pct)}%`), inverse: true, position: 'right', ...axisBase(p), axisLabel: { color: p.muted, fontSize: 12 }, splitLine: { show: false } },
        ],
        series: [
          { name: 'Share', type: 'bar', barWidth: 12, data: list.map((x) => +x.pct.toFixed(1)), itemStyle: { color: p.series, ...solid } },
          ...(ly ? [{ name: cmpShort(s), type: 'scatter', symbol: 'rect', symbolSize: [2.5, 20], data: list.map((x, i) => [+(x.lyPct ?? 0).toFixed(1), i]), itemStyle: { color: p.cmp, ...solid }, z: 4 }] : []),
        ],
      };
    },
  };
}

/* V9 · Forecast fan: per night, on the books as a bar, P50 dotted, P10–P90 shaded, budget as a neutral reference. */
function fan(s: FilterState): Resolved {
  const r = RANGES[s.range];
  const base: Resolved = {
    title: 'The forecast covers nights still to come',
    subtitle: `Occupancy by night · ${scope(s)}`,
    aria: 'Forecast',
    view: 'columns',
    autoWhy: 'Where each night lands, with its uncertainty: a fan',
    views: [
      { view: 'columns', ok: true },
      { view: 'table', ok: true },
    ],
    badge: null,
    ignores: [],
    legend: [],
    table: { columns: [], rows: [] },
    sql: PF_SQL.nights,
    definitions: [],
    computed: '',
    height: 260,
    option: () => ({}),
  };
  if (!r.future) return { ...base, empty: { text: 'These nights are already stayed; their actuals are in the other charts.', action: { label: 'Show next 30 nights', patch: { range: 'next30', compare: 'stly' } } } };
  const codes = codesOf(s);
  const idx = Array.from({ length: r.to - r.from + 1 }, (_, k) => r.from + k);
  const pct = (col: Col) => idx.map((i) => +((night(codes, col, i) / Math.max(1, night(codes, 'avail', i))) * 100).toFixed(1));
  const [otb, p10, p50, p90, bud] = [pct('rooms'), pct('p10'), pct('p50'), pct('p90'), pct('bud_rooms')];
  const labels = idx.map((i) => dayLabel(DATES[i]));
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
    aria: title,
    badge: ownCmp
      ? { label: 'Compares with budget', detail: 'A forecast is a finished number, so it is read against budget; last year’s bookings at this lead time would understate it.' }
      : ignoreBadge(ig, 'The forecast is made per hotel and night, not by segment, channel or booking date.'),
    ignores: [...ig, ...(ownCmp ? ['comparison'] : [])],
    legend: [{ label: 'On the books', mark: 'solid' }, { label: 'Forecast P50', mark: 'dotted' }, { label: 'P10–P90', mark: 'band' }, ...(showBud ? [{ label: 'Budget', mark: 'line-ref' as Mark }] : [])],
    table: {
      columns: ['Night', 'On the books', 'P10', 'P50', 'P90', 'Budget'],
      rows: labels.map((l, k) => [l, fmt.pct(otb[k]), fmt.pct(p10[k]), fmt.pct(p50[k]), fmt.pct(p90[k]), fmt.pct(bud[k])]),
      align: ['l', 'r', 'r', 'r', 'r', 'r'],
    },
    definitions: [DEF.otb, DEF.fc, DEF.bud],
    computed: 'For each night, rooms and rooms available are summed across the selected hotels, then divided. The range adds each hotel’s P10 and P90, so for a group it is wider than the true range.',
    drill: (k) => ({ dimension: 'night', value: DATES[idx[k]], label: labels[k] }),
    option: (_v, p, width) => ({
      aria: aria(title),
      ...motion(),
      grid: { left: 8, right: 12, top: 16, bottom: idx.length > 45 ? 44 : 8, containLabel: true },
      tooltip: {
        ...tooltip(p),
        formatter: (xs: { dataIndex: number }[]) => {
          const k = xs[0].dataIndex;
          return `<b>${labels[k]}</b><br/>On the books ${fmt.pct(otb[k])}<br/>Forecast P50 ${fmt.pct(p50[k])}<br/>P10–P90 ${fmt.pct(p10[k], 0)}–${fmt.pct(p90[k], 0)}<br/>Budget ${fmt.pct(bud[k])}`;
        },
      },
      ...(idx.length > 45 ? zoom(p) : {}),
      xAxis: { type: 'category', data: labels, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, interval: Math.ceil(labels.length / (width < 560 ? 4 : 8)) - 1 }, splitLine: { show: false } },
      yAxis: { type: 'value', min: 0, max: 100, splitNumber: 4, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, formatter: '{value}%' } },
      series: [
        { name: 'P10', type: 'line', data: p10, stack: 'fan', symbol: 'none', lineStyle: { opacity: 0 }, itemStyle: solid, z: 1 },
        { name: 'P90', type: 'line', data: p90.map((x, k) => +(x - p10[k]).toFixed(1)), stack: 'fan', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: p.series, opacity: 0.16 }, itemStyle: solid, z: 1, tooltip: { show: false } },
        { name: 'On the books', type: 'bar', data: otb, barMaxWidth: 12, itemStyle: { color: p.series, ...solid }, z: 2 },
        { name: 'Forecast P50', type: 'line', data: p50, symbol: 'none', lineStyle: { color: p.series, width: 1.5, type: 'dotted' }, itemStyle: { color: p.series, ...solid }, z: 3 },
        ...(showBud ? [{ name: 'Budget', type: 'line', step: 'middle', data: bud, symbol: 'none', lineStyle: { color: p.ref, width: 1, opacity: 0.8 }, itemStyle: { color: p.ref, ...solid }, z: 3 }] : []),
      ],
    }),
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
  const title = pts.length < 2 ? `${pts[0]?.name ?? '—'}: RGI ${pts[0]?.rgi ?? '—'} (MPI ${pts[0]?.mpi}, ARI ${pts[0]?.ari})` : `${winning} of ${pts.length} hotels win share at a premium; ${low.name} has the lowest RGI (${low.rgi})`;
  const ig = ignoredOptional(s, []);
  const cmpIg = s.compare !== 'none';
  const sorted = [...pts].sort((a, b) => Math.hypot(b.ari - 100, b.mpi - 100) - Math.hypot(a.ari - 100, a.mpi - 100));
  return {
    title,
    subtitle: `Price (ARI) against share of demand (MPI), each hotel vs its comp set · ${hotelLabel(s.hotels)} · ${RANGES[win as keyof typeof RANGES].short}`,
    aria: `${title}. ${pts.map((x) => `${x.name} MPI ${x.mpi}, ARI ${x.ari}`).join('; ')}`,
    view: pts.length < 2 ? 'table' : 'quadrant',
    autoWhy: 'Relation between two indices: a quadrant with named reference lines',
    views: [
      { view: 'quadrant', ok: pts.length >= 2, reason: 'Needs two hotels or more' },
      { view: 'bars', ok: true },
      { view: 'table', ok: true },
    ],
    badge: future
      ? { label: 'Own dates: last 30 nights', detail: 'MPI, ARI and RGI need actuals: the comp-set benchmark only covers nights already stayed.' }
      : ig.length || cmpIg
        ? { label: 'Comp set is the comparison', detail: 'Each index already compares a hotel with its comp set; the comparison, segment, channel and booking filters don’t apply.' }
        : null,
    ignores: [...(future ? ['stay nights'] : []), ...ig, ...(cmpIg ? ['comparison'] : [])],
    legend: [{ label: 'Hotel', mark: 'solid' }, { label: '100 = comp set', mark: 'line-ref' }, { label: 'RGI = 100', mark: 'dotted' }],
    table: { columns: ['Hotel', 'MPI', 'ARI', 'RGI'], rows: [...pts].sort((a, b) => a.rgi - b.rgi).map((x) => [x.name, String(x.mpi), String(x.ari), String(x.rgi)]), align: ['l', 'r', 'r', 'r'] },
    sql: PF_SQL.index,
    definitions: [
      ['MPI', 'occupancy ÷ comp-set occupancy × 100 (share of demand)'],
      ['ARI', 'ADR ÷ comp-set ADR × 100 (price position)'],
      ['RGI', 'RevPAR ÷ comp-set RevPAR × 100 = MPI × ARI ÷ 100'],
      ['Points', '+5 on an index means 5% against the comp set, not 5 pp of occupancy'],
    ],
    computed: 'Computed from v_hotel_day and comp_set_daily over the window. The dotted curve is RGI = 100 (MPI = 10,000 ÷ ARI): hotels above it take more than their fair share of revenue.',
    height: 380,
    drill: (i) => (sorted[i] ? { dimension: 'hotel', value: sorted[i].code, label: sorted[i].name } : null),
    option: (view, p, width) => {
      if (view === 'bars') {
        const byRgi = [...pts].sort((a, b) => a.rgi - b.rgi);
        return {
          aria: aria(title),
          ...motion(),
          grid: { left: 8, right: 8, top: 4, bottom: 22, containLabel: true },
          tooltip: tooltip(p),
          xAxis: { type: 'value', ...axisBase(p), min: (x: { min: number }) => Math.floor(Math.min(x.min, 90) / 10) * 10 },
          yAxis: [
            { type: 'category', data: byRgi.map((x) => x.name), inverse: true, ...axisBase(p), axisLabel: { color: p.text, fontSize: 12.5 }, splitLine: { show: false } },
            { type: 'category', data: byRgi.map((x) => String(x.rgi)), inverse: true, position: 'right', ...axisBase(p), axisLabel: { color: p.muted, fontSize: 12 }, splitLine: { show: false } },
          ],
          series: [{ type: 'bar', name: 'RGI', data: byRgi.map((x) => x.rgi), barWidth: 12, itemStyle: { color: p.series, ...solid }, markLine: { symbol: 'none', silent: true, lineStyle: { color: p.ref }, label: { color: p.muted, formatter: '100' }, data: [{ xAxis: 100 }] } }],
        };
      }
      const d = Math.ceil((Math.max(5, ...pts.flatMap((x) => [Math.abs(x.ari - 100), Math.abs(x.mpi - 100)])) + 4) / 5) * 5;
      const [lo, hi] = [100 - d, 100 + d];
      const curve = Array.from({ length: 61 }, (_, k) => lo + (k * (hi - lo)) / 60)
        .map((ari) => [+ari.toFixed(2), +(10000 / ari).toFixed(2)])
        .filter(([, m]) => m >= lo && m <= hi);
      const corner = (name: string, x: [number, number], y: [number, number], pos: string) => [{ name, coord: [x[0], y[0]], label: { position: pos } }, { coord: [x[1], y[1]] }];
      return {
        aria: aria(title),
        ...motion(),
        grid: { left: 8, right: 16, top: 30, bottom: 26, containLabel: true },
        tooltip: { ...tooltip(p, 'item'), formatter: (x: { data: [number, number, string, number] }) => (Array.isArray(x.data) && x.data[2] ? `<b>${x.data[2]}</b><br/>ARI ${x.data[0]} · MPI ${x.data[1]} · RGI ${x.data[3]}` : '') },
        xAxis: { type: 'value', min: lo, max: hi, interval: d / 2, name: 'ARI · price vs comp set', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: p.muted, fontSize: 12 }, ...axisBase(p) },
        yAxis: { type: 'value', min: lo, max: hi, interval: d / 2, name: 'MPI · share of demand', nameLocation: 'end', nameGap: 12, nameTextStyle: { color: p.muted, fontSize: 12, align: 'left' }, ...axisBase(p) },
        series: [
          {
            type: 'scatter',
            name: 'Hotel',
            data: sorted.map((x) => [x.ari, x.mpi, x.name, x.rgi]),
            symbolSize: 9,
            itemStyle: { color: p.series, ...solid },
            label: { show: true, position: 'right', color: p.text, fontSize: width < 560 ? 11 : 12, formatter: (x: { data: [number, number, string] }) => x.data[2] },
            labelLayout: { hideOverlap: true },
            markLine: { symbol: 'none', silent: true, lineStyle: { color: p.ref, type: 'solid', width: 1 }, label: { show: false }, data: [{ xAxis: 100 }, { yAxis: 100 }] },
            markArea: {
              silent: true,
              itemStyle: { color: 'transparent' },
              label: { color: p.muted, fontSize: 11.5 },
              data: [
                corner('Winning share', [100, hi], [100, hi], 'insideTopRight'),
                corner('Volume-led', [lo, 100], [100, hi], 'insideTopLeft'),
                corner('Rate-led', [100, hi], [lo, 100], 'insideBottomRight'),
                corner('Losing share', [lo, 100], [lo, 100], 'insideBottomLeft'),
              ],
            },
            z: 3,
          },
          { type: 'line', name: 'RGI = 100', data: curve, showSymbol: false, silent: true, smooth: true, lineStyle: { color: p.muted, type: 'dotted', width: 1.25 }, itemStyle: solid, tooltip: { show: false }, z: 1 },
        ],
      };
    },
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
    aria: `${title}. ${steps.map((x) => `${x.name} ${fmt.signedEur(x.d)}`).join(', ')}`,
    view: 'waterfall',
    autoWhy: 'A deviation from plan, explained: a bridge',
    views: [
      { view: 'waterfall', ok: true },
      { view: 'table', ok: true },
      { view: 'donut', ok: false, reason: 'Variances can be negative; parts of a whole can’t' },
    ],
    badge: { label: `Own dates: ${month.split(' ')[0]}`, detail: 'The P&L closes monthly, so the stay-night filter doesn’t apply; October is the last closed month. It is always read against budget.' },
    ignores: ['stay nights', ...ig, ...(s.compare !== 'budget' && s.compare !== 'none' ? ['comparison'] : [])],
    legend: [
      { label: 'Budget', mark: 'outline' },
      { label: 'Actual · raised GOP', mark: 'solid' },
      { label: 'Lowered GOP', mark: 'neg' },
    ],
    table: { columns: ['Step', 'Effect on GOP'], rows: [['Budget GOP', fmt.eur(b)], ...steps.map((x) => [x.name, fmt.signedEur(x.d)]), ['Actual GOP', fmt.eur(a)]], align: ['l', 'r'] },
    sql: PF_SQL.pnl,
    definitions: [
      ['GOP', 'gross operating profit: total revenue − departmental and undistributed expenses (USALI)'],
      ['Effect', 'revenue above budget raises GOP; costs above budget lower it'],
    ],
    computed: 'Each step is actual − budget for its P&L lines (costs with the sign flipped), summed over the selected hotels; “Other” reconciles any line not listed. The axis is broken so the steps are readable; the break is drawn on the totals.',
    height: 300,
    option: (_v, p, width) => {
      const cats = ['Budget', ...steps.map((x) => x.name), 'Actual'];
      let run = b;
      const baseS: (number | string)[] = [0];
      const up: (number | string)[] = ['-'];
      const down: (number | string)[] = ['-'];
      for (const x of steps) {
        baseS.push(Math.round(x.d >= 0 ? run : run + x.d));
        up.push(x.d >= 0 ? Math.round(x.d) : '-');
        down.push(x.d < 0 ? Math.round(-x.d) : '-');
        run += x.d;
      }
      baseS.push(0);
      up.push('-');
      down.push('-');
      let lo = Math.min(a, b);
      for (let i = 0, r = b; i < steps.length; i++) lo = Math.min(lo, (r += steps[i].d));
      const unit = 10 ** Math.floor(Math.log10(Math.max(1, lo / 4)));
      const brk = { start: Math.round((lo * 0.1) / unit) * unit, end: Math.floor((lo * 0.93) / unit) * unit, gap: '6%' };
      const lbl = (sign: 1 | -1) => ({ show: true, position: sign > 0 ? 'top' : 'bottom', color: p.text, fontSize: 11.5, formatter: (x: { value: number | string }) => `${sign > 0 ? '+' : '−'}${fmt.eur(+x.value)}` });
      return {
        aria: aria(title),
        ...motion(),
        grid: { left: 8, right: 12, top: 22, bottom: 4, containLabel: true },
        tooltip: {
          ...tooltip(p),
          formatter: (xs: { dataIndex: number }[]) => {
            const i = xs[0].dataIndex;
            return i === 0 ? `Budget GOP ${fmt.eur(b)}` : i === cats.length - 1 ? `Actual GOP ${fmt.eur(a)}` : `${steps[i - 1].name}: ${fmt.signedEur(steps[i - 1].d)}`;
          },
        },
        xAxis: { type: 'category', data: cats, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, interval: 0, rotate: width < 760 ? 40 : 0, fontSize: 11.5 }, splitLine: { show: false } },
        yAxis: {
          type: 'value',
          ...axisBase(p),
          breaks: [brk],
          breakArea: { itemStyle: { color: p.card, borderColor: p.muted, borderWidth: 1, opacity: 1 }, zigzagAmplitude: 3 },
          axisLabel: { ...axisBase(p).axisLabel, formatter: (x: number) => fmt.axis(x) },
        },
        series: [
          { type: 'bar', stack: 'w', data: baseS, itemStyle: { color: 'transparent', ...solid }, emphasis: { disabled: true }, tooltip: { show: false } },
          { type: 'bar', stack: 'w', name: 'Raised GOP', data: up, barMaxWidth: 34, itemStyle: { color: p.series, ...solid }, label: lbl(1) },
          { type: 'bar', stack: 'w', name: 'Lowered GOP', data: down, barMaxWidth: 34, itemStyle: { color: p.neg, ...solid }, label: lbl(-1) },
          {
            type: 'bar',
            stack: 'w',
            name: 'GOP',
            barMaxWidth: 34,
            data: cats.map((_, i) =>
              i === 0
                ? { value: Math.round(b), itemStyle: { color: 'transparent', borderColor: p.series, borderWidth: 1.5, decal: { symbol: 'none' } } }
                : i === cats.length - 1
                  ? { value: Math.round(a), itemStyle: { color: p.series, decal: { symbol: 'none' } } }
                  : '-',
            ),
            itemStyle: solid,
            label: { show: true, position: 'top', color: p.text, fontSize: 11.5, fontWeight: 600, formatter: (x: { value: number | string }) => fmt.eur(+x.value) },
          },
        ],
      };
    },
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
  const shown = all.length > 1 ? [make(all, 'Chain total'), ...hotelRows] : hotelRows;
  const title = `${all.length} ${all.length === 1 ? 'hotel' : 'hotels'}, ${RANGES[s.range].short}, by room revenue`;
  const ig = ignoredOptional(s, []);
  return {
    title,
    subtitle: scope(s),
    aria: title,
    view: 'table',
    autoWhy: 'Exact values for many hotels: a table with bars and sparklines',
    views: [{ view: 'table', ok: true }],
    badge: ignoreBadge(ig, 'Hotel totals aren’t split by segment, channel or booking date.'),
    ignores: ig,
    legend: [],
    table: {
      columns: ['Hotel', 'Occupancy', 'Δ', 'ADR', 'RevPAR', 'Room revenue', 'Δ', 'By night'],
      rows: shown.map((r) => [
        r.name,
        { text: fmt.pct(r.occ), bar: r.occ / 100 },
        { text: r.dOcc === null ? '—' : fmt.pp(r.dOcc), muted: true },
        fmt.eur(METRIC.adr.value(r.t)),
        fmt.eur(METRIC.revpar.value(r.t)),
        fmt.eur(r.t.rev),
        { text: r.dRev === null ? '—' : fmt.rel(r.dRev), muted: true },
        { text: '', spark: r.spark },
      ]),
      align: ['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
    },
    sql: PF_SQL.nights,
    definitions: [DEF.occ, ['ADR', 'room revenue ÷ rooms sold'], ['RevPAR', 'room revenue ÷ rooms available'], ...cmpDefs(s)],
    computed: `Sums over the selected nights per hotel, then the ratios. Δ is against ${s.compare === 'none' ? 'nothing (no comparison)' : proj ? 'budget, using the forecast for nights not yet stayed' : COMPARES[s.compare].short}. Occupancy changes are in percentage points.`,
    height: 0,
    option: () => ({}),
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
