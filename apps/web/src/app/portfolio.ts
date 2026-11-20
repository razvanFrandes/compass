import type { EChartsCoreOption } from 'echarts/core';
import { CHANNELS, COMPARES, FilterState, HOTELS, RANGES, RangeKey, SEGMENTS, hotelLabel, listLabel, rangeDates } from './filters';
import { PF_CLOSED_MONTH, PF_DATES, PF_INDEX, PF_MIX, PF_NIGHTS, PF_PNL, PF_SQL } from './portfolio-data';

/*
  The chart catalogue (report "Filtre și grafice pentru Compass"): a small, flat ChartSpec keyed on `kind`.
  A spec names the intent and the metric, never a number or a colour. A deterministic resolver turns
  spec + filter state into the numbers, the statement title, the scope line, the views it allows
  (with the reason when one isn't), the table behind the chart and the badge when it can't follow a filter.
  The renderer owns every colour: one hue for the data, grey for the comparison.
*/

export type MetricId = 'occupancy' | 'adr' | 'revpar' | 'revenue';
export type ChartSpec =
  | { id: string; kind: 'bullet'; metric: 'occupancy'; rows: 'hotel'; refs: ('stly' | 'budget' | 'forecast')[] }
  | { id: string; kind: 'line'; metric: 'occupancy'; grain: 'day'; band?: 'p10_p90' }
  | { id: string; kind: 'bar'; metric: 'revenue_net'; dimension: 'channel' | 'segment'; sort: 'desc' }
  | { id: string; kind: 'share'; metric: 'room_nights'; dimension: 'segment' | 'channel' }
  | { id: string; kind: 'quadrant'; x: 'ari'; y: 'mpi' }
  | { id: string; kind: 'bridge'; metric: 'gop' }
  | { id: string; kind: 'table'; rows: 'hotel' };

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
  cmp: string;
  fg: string;
  text: string;
  muted: string;
  grid: string;
  card: string;
  popover: string;
  border: string;
  pos: string;
  neg: string;
}

export interface Resolved {
  title: string;
  subtitle: string;
  aria: string;
  view: View;
  views: { view: View; ok: boolean; reason?: string }[];
  badge: { label: string; detail: string } | null;
  ignores: string[];
  legend: { label: string; mark: 'solid' | 'dashed' | 'light' | 'tick' | 'tick-fg' | 'band' | 'pos' | 'neg' | 'grey' }[];
  table: { columns: string[]; rows: string[][]; align?: ('l' | 'r')[] };
  kpi?: { value: string; delta: string };
  empty?: { text: string; action?: { label: string; patch: Partial<FilterState> } };
  sql: string;
  definitions: [string, string][];
  computed: string;
  height: number;
  /** `width` is the card's chart width in px, so phones get shorter labels and sparser ticks. */
  option: (view: View, p: Palette, width: number) => EChartsCoreOption;
}

/* ───────────── numbers ───────────── */
type Col = 'avail' | 'rooms' | 'cmp_rooms' | 'rev' | 'cmp_rev' | 'p10' | 'p50' | 'p90' | 'fc_rev' | 'bud_rooms' | 'bud_rev';
const N = PF_NIGHTS as unknown as Record<string, Record<Col, (number | null)[]>>;
const DATES = PF_DATES as readonly string[];
const codesOf = (s: FilterState) => (s.hotels.length ? s.hotels : HOTELS.map((h) => h.code));
const short = (code: string) => HOTELS.find((h) => h.code === code)?.short ?? code;
const sum = (codes: string[], col: Col, from: number, to: number) => {
  let t = 0;
  for (const c of codes) for (let i = from; i <= to; i++) t += N[c]?.[col][i] ?? 0;
  return t;
};
const perNight = (codes: string[], col: Col, i: number) => codes.reduce((t, c) => t + (N[c]?.[col][i] ?? 0), 0);

/** Comparison column for the active compare key. */
const cmpCols = (c: FilterState['compare']): [Col, Col] | null =>
  c === 'stly' || c === 'ly_dow' ? ['cmp_rooms', 'cmp_rev'] : c === 'budget' ? ['bud_rooms', 'bud_rev'] : c === 'forecast' ? ['p50', 'fc_rev'] : null;

export interface Totals {
  rooms: number;
  avail: number;
  rev: number;
  cRooms: number | null;
  cRev: number | null;
  /** Forecast P50 for the same nights (future ranges only). */
  fRooms: number | null;
  fRev: number | null;
}
/**
 * Budget is a finished-month target, so on future nights it is compared with where the forecast says
 * the nights will end up, not with what is on the books today (that gap is mostly nights not yet sold).
 */
export const projectsToBudget = (s: FilterState) => RANGES[s.range].future && s.compare === 'budget';
const asForecast = (t: Totals): Totals => ({ ...t, rooms: t.fRooms ?? t.rooms, rev: t.fRev ?? t.rev });
export function totals(s: FilterState, codes = codesOf(s)): Totals {
  const { from, to } = RANGES[s.range];
  const cc = cmpCols(s.compare);
  return {
    rooms: sum(codes, 'rooms', from, to),
    avail: sum(codes, 'avail', from, to),
    rev: sum(codes, 'rev', from, to),
    cRooms: cc ? sum(codes, cc[0], from, to) : null,
    cRev: cc ? sum(codes, cc[1], from, to) : null,
    fRooms: RANGES[s.range].future ? sum(codes, 'p50', from, to) : null,
    fRev: RANGES[s.range].future ? sum(codes, 'fc_rev', from, to) : null,
  };
}

export const fmt = {
  pct: (n: number, d = 1) => `${n.toFixed(d)}%`,
  eur: (n: number) => {
    const a = Math.abs(n);
    const v = a >= 1e6 ? `€${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `€${Math.round(a / 1e3)}k` : `€${Math.round(a).toLocaleString('en-GB')}`;
    return n < 0 ? `−${v}` : v;
  },
  int: (n: number) => Math.round(n).toLocaleString('en-GB'),
  /** Axis ticks: as short as the number allows (€2M, €500k). */
  axis: (n: number) => (n === 0 ? '€0' : Math.abs(n) >= 1e6 ? `€${+(n / 1e6).toFixed(1)}M` : `€${Math.round(n / 1e3)}k`),
  pts: (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} pts`,
  rel: (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}%`,
};

export const METRIC: Record<MetricId, { label: string; unit: 'pt' | '%'; value: (t: Totals) => number; cmp: (t: Totals) => number | null; format: (n: number) => string }> = {
  occupancy: { label: 'Occupancy', unit: 'pt', value: (t) => (t.rooms / t.avail) * 100, cmp: (t) => (t.cRooms === null ? null : (t.cRooms / t.avail) * 100), format: (n) => fmt.pct(n) },
  adr: { label: 'ADR', unit: '%', value: (t) => t.rev / t.rooms, cmp: (t) => (t.cRooms ? (t.cRev ?? 0) / t.cRooms : null), format: (n) => fmt.eur(n) },
  revpar: { label: 'RevPAR', unit: '%', value: (t) => t.rev / t.avail, cmp: (t) => (t.cRev === null ? null : t.cRev / t.avail), format: (n) => fmt.eur(n) },
  revenue: { label: 'Room revenue', unit: '%', value: (t) => t.rev, cmp: (t) => t.cRev, format: (n) => fmt.eur(n) },
};
export function delta(m: MetricId, t: Totals) {
  const v = METRIC[m].value(t);
  const c = METRIC[m].cmp(t);
  if (c === null || !Number.isFinite(c) || c === 0) return null;
  return METRIC[m].unit === 'pt' ? v - c : (v / c - 1) * 100;
}
export const deltaText = (m: MetricId, d: number | null) => (d === null ? '' : METRIC[m].unit === 'pt' ? fmt.pts(d) : fmt.rel(d));

/** KPI tiles: the portfolio (or the selected hotels) over the selected nights. */
export function kpis(s: FilterState) {
  const t = totals(s);
  const proj = projectsToBudget(s);
  return (['occupancy', 'adr', 'revpar', 'revenue'] as MetricId[]).map((m) => {
    const d = delta(m, proj ? asForecast(t) : t);
    return { metric: m, label: METRIC[m].label, value: METRIC[m].format(METRIC[m].value(t)), delta: d, deltaText: deltaText(m, d), basis: proj ? 'Forecast ' : '' };
  });
}

/* ───────────── shared helpers ───────────── */
const cmpWord = (s: FilterState) => COMPARES[s.compare].short;
const scope = (s: FilterState) => `${hotelLabel(s.hotels)} · ${RANGES[s.range].label.toLowerCase()} (${rangeDates(s.range)})${s.compare !== 'none' ? ` · vs ${cmpWord(s)}` : ''}`;
const dayLabel = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(Date.parse(`${iso}T00:00:00Z`));
const OCC_DEF: [string, string] = ['Occupancy', 'rooms sold (or on the books) ÷ rooms available, out-of-order rooms excluded'];
const STLY_DEF: [string, string] = ['Same time last year', 'the same weekday 364 days earlier, on the books at the same lead time (pace_vs_stly())'];
const BUD_DEF: [string, string] = ['Budget per night', 'the month’s budget ÷ its days'];
const FC_DEF: [string, string] = ['Forecast', 'the RMS forecast made on 20 Nov: P50 is the middle case, P10–P90 the likely range'];
const segChIgnored = (s: FilterState) => [...(s.segments.length ? ['segment'] : []), ...(s.channels.length ? ['channel'] : [])];
const axisBase = (p: Palette) => ({
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: p.muted, fontSize: 11.5, fontFamily: 'Inter' },
  splitLine: { lineStyle: { color: p.grid } },
});
const tooltip = (p: Palette, trigger: 'axis' | 'item' = 'axis') => ({
  trigger,
  backgroundColor: p.popover,
  borderColor: p.border,
  textStyle: { color: p.fg, fontSize: 12, fontFamily: 'Inter' },
  axisPointer: { type: 'line', lineStyle: { color: p.border } },
});

/* ───────────── the resolver ───────────── */
export function resolve(spec: ChartSpec, s: FilterState): Resolved {
  switch (spec.kind) {
    case 'bullet':
      return bullet(spec, s);
    case 'line':
      return line(spec, s);
    case 'bar':
    case 'share':
      return mix(spec, s);
    case 'quadrant':
      return quadrant(s);
    case 'bridge':
      return bridge(s);
    case 'table':
      return hotelTable(s);
  }
}

function hotelRows(s: FilterState) {
  const { from, to, future } = RANGES[s.range];
  return codesOf(s).map((c) => {
    const avail = sum([c], 'avail', from, to);
    const occ = (sum([c], 'rooms', from, to) / avail) * 100;
    return {
      code: c,
      name: short(c),
      occ,
      ly: (sum([c], 'cmp_rooms', from, to) / avail) * 100,
      bud: (sum([c], 'bud_rooms', from, to) / avail) * 100,
      fc: future ? (sum([c], 'p50', from, to) / avail) * 100 : null,
    };
  });
}

function bullet(spec: Extract<ChartSpec, { kind: 'bullet' }>, s: FilterState): Resolved {
  const future = RANGES[s.range].future;
  const proj = projectsToBudget(s);
  const ref = (r: ReturnType<typeof hotelRows>[number]) => (s.compare === 'budget' ? r.bud : s.compare === 'forecast' ? r.fc : s.compare === 'none' ? null : r.ly);
  // Against budget on future nights the forecast is what's measured (see projectsToBudget).
  const val = (r: ReturnType<typeof hotelRows>[number]) => (proj ? (r.fc ?? r.occ) : r.occ);
  const gap = (r: ReturnType<typeof hotelRows>[number]) => val(r) - (ref(r) ?? 0);
  const rows = hotelRows(s).sort((a, b) => (ref(a) === null ? b.occ - a.occ : gap(a) - gap(b)));
  const ahead = rows.filter((r) => ref(r) !== null && gap(r) >= 0).length;
  const worst = rows[0];
  const one = rows.length === 1;
  // When every hotel is ahead, the last one isn't "behind": it has the smallest lead.
  const trail = `${gap(worst) < 0 ? 'is furthest behind' : 'has the smallest lead'} (${fmt.pts(gap(worst))})`;
  const title = one
    ? proj
      ? `${worst.name} is forecast to fill ${fmt.pct(val(worst), 0)}, ${fmt.pts(gap(worst))} vs budget; ${fmt.pct(worst.occ, 0)} on the books`
      : `${worst.name} is ${fmt.pct(worst.occ, 0)} full${ref(worst) !== null ? `, ${fmt.pts(gap(worst))} vs ${cmpWord(s)}` : ''}`
    : s.compare === 'none'
      ? `${rows[rows.length - 1].name} leads at ${fmt.pct(Math.max(...rows.map((r) => r.occ)), 0)}; ${rows.reduce((a, b) => (a.occ < b.occ ? a : b)).name} trails`
      : proj
        ? `${ahead} of ${rows.length} hotels are forecast to beat budget; ${worst.name} ${trail}`
        : `${ahead} of ${rows.length} hotels are ahead of ${cmpWord(s)}; ${worst.name} ${trail}`;
  const showRefs = spec.refs.filter((r) => (r === 'forecast' ? future : true));
  const ignores = segChIgnored(s);
  const views: View[] = one ? ['kpi', 'table'] : ['bullet', 'bars', 'table'];
  return {
    title,
    subtitle: `${METRIC.occupancy.label} by hotel · ${scope(s)}`,
    aria: `${title}. ${rows.map((r) => `${r.name} ${fmt.pct(r.occ, 0)}`).join(', ')}`,
    view: views[0],
    views: [...views.map((v) => ({ view: v, ok: true })), { view: 'donut' as View, ok: false, reason: 'Occupancy isn’t parts of one whole' }],
    badge: ignores.length ? { label: `All ${ignores.join(' & ')}s`, detail: 'Night totals per hotel aren’t split by segment or channel; Channel mix and Segment share follow those filters.' } : null,
    ignores,
    legend: [
      { label: future ? 'On the books' : 'Actual', mark: 'solid' },
      ...(showRefs.includes('forecast') ? [{ label: 'Forecast P50', mark: 'light' as const }] : []),
      ...(showRefs.includes('stly') ? [{ label: future ? 'Same time last year' : 'Last year', mark: 'tick' as const }] : []),
      ...(showRefs.includes('budget') ? [{ label: 'Budget', mark: 'tick-fg' as const }] : []),
    ],
    table: {
      columns: ['Hotel', future ? 'On the books' : 'Actual', future ? 'STLY' : 'Last year', 'Budget', ...(future ? ['Forecast P50'] : [])],
      rows: rows.map((r) => [r.name, fmt.pct(r.occ), fmt.pct(r.ly), fmt.pct(r.bud), ...(future ? [fmt.pct(r.fc ?? 0)] : [])]),
      align: ['l', 'r', 'r', 'r', 'r'],
    },
    kpi: one ? { value: fmt.pct(worst.occ), delta: ref(worst) !== null ? `${proj ? 'Forecast ' : ''}${fmt.pts(gap(worst))} vs ${cmpWord(s)}` : '' } : undefined,
    sql: PF_SQL.nights,
    definitions: [OCC_DEF, STLY_DEF, BUD_DEF, ...(future ? [FC_DEF] : [])],
    computed: `Each row sums rooms and rooms available over the selected nights for one hotel, then divides. Sorted by the gap to the comparison, worst first.${proj ? ' Against budget, future nights are judged on the forecast P50: the budget is a final number, and today’s bookings still have time to grow.' : ''}`,
    height: Math.max(120, rows.length * 30 + 36),
    option: (view, p, width) => {
      const names = rows.map((r) => r.name);
      const narrow = width < 480;
      const bar = { type: 'bar', data: rows.map((r) => +r.occ.toFixed(1)), barWidth: 12, itemStyle: { color: p.series, borderRadius: [0, 2, 2, 0] }, z: 3, name: future ? 'On the books' : 'Actual', label: { show: view === 'bars', position: 'right', color: p.text, fontSize: 11.5, formatter: (x: { value: number }) => `${Math.round(x.value)}%` } };
      return {
        aria: { enabled: true },
        animationDuration: 400,
        grid: { left: 8, right: view === 'bars' ? 44 : 8, top: 6, bottom: 22, containLabel: true },
        tooltip: { ...tooltip(p), valueFormatter: (v: number) => `${v.toFixed(1)}%` },
        xAxis: { type: 'value', min: 0, max: 100, splitNumber: narrow ? 2 : 5, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, formatter: '{value}%' } },
        // On phones long hotel names are cut so the bars keep most of the width; the tooltip and table keep the full name.
        yAxis: [
          { type: 'category', data: names, inverse: true, ...axisBase(p), axisLabel: { color: p.text, fontSize: narrow ? 12 : 12.5, fontFamily: 'Inter', width: narrow ? Math.round(width * 0.3) : undefined, overflow: narrow ? 'truncate' : 'none' }, splitLine: { show: false } },
          // Bullet view: values sit in their own right-hand column, clear of the reference ticks.
          ...(view === 'bars' ? [] : [{ type: 'category', data: rows.map((r) => `${Math.round(r.occ)}%`), inverse: true, position: 'right', ...axisBase(p), axisLabel: { color: p.text, fontSize: 12, fontFamily: 'Inter' }, splitLine: { show: false } }]),
        ],
        series:
          view === 'bars'
            ? [bar]
            : [
                ...(showRefs.includes('forecast') ? [{ type: 'bar', data: rows.map((r) => +(r.fc ?? 0).toFixed(1)), barWidth: 12, barGap: '-100%', itemStyle: { color: p.series, opacity: 0.25 }, z: 2, name: 'Forecast P50' }] : []),
                bar,
                ...(showRefs.includes('stly') ? [{ type: 'scatter', data: rows.map((r) => +r.ly.toFixed(1)), symbol: 'rect', symbolSize: [2.5, 20], itemStyle: { color: p.cmp }, z: 4, name: future ? 'Same time last year' : 'Last year' }] : []),
                ...(showRefs.includes('budget') ? [{ type: 'scatter', data: rows.map((r) => +r.bud.toFixed(1)), symbol: 'rect', symbolSize: [2.5, 20], itemStyle: { color: p.fg }, z: 4, name: 'Budget' }] : []),
              ],
      };
    },
  };
}

function line(spec: Extract<ChartSpec, { kind: 'line' }>, s: FilterState): Resolved {
  const { from, to, future } = RANGES[s.range];
  const codes = codesOf(s);
  const idx = Array.from({ length: to - from + 1 }, (_, k) => from + k);
  const avail = idx.map((i) => perNight(codes, 'avail', i));
  const occ = idx.map((i, k) => (perNight(codes, 'rooms', i) / avail[k]) * 100);
  const cc = cmpCols(s.compare);
  const cmp = cc ? idx.map((i, k) => (perNight(codes, cc[0], i) / avail[k]) * 100) : null;
  const band = future && spec.band ? { lo: idx.map((i, k) => (perNight(codes, 'p10', i) / avail[k]) * 100), hi: idx.map((i, k) => (perNight(codes, 'p90', i) / avail[k]) * 100), mid: idx.map((i, k) => (perNight(codes, 'p50', i) / avail[k]) * 100) } : null;
  const t = totals(s);
  const proj = projectsToBudget(s);
  const d = delta('occupancy', proj ? asForecast(t) : t);
  const peak = occ.indexOf(Math.max(...occ));
  const title = proj
    ? `Forecast to fill ${fmt.pct(METRIC.occupancy.value(asForecast(t)), 0)} over ${RANGES[s.range].label.toLowerCase()}, ${fmt.pts(d ?? 0)} vs budget; ${fmt.pct(METRIC.occupancy.value(t), 0)} on the books today`
    : `${future ? 'On the books' : 'Occupancy'} ${fmt.pct(METRIC.occupancy.value(t), 0)} for ${RANGES[s.range].label.toLowerCase()}${d !== null ? `, ${fmt.pts(d)} vs ${cmpWord(s)}` : ''}; peak ${fmt.pct(occ[peak], 0)} on ${dayLabel(DATES[idx[peak]])}`;
  const ignores = segChIgnored(s);
  const labels = idx.map((i) => dayLabel(DATES[i]));
  return {
    title,
    subtitle: `Occupancy by night · ${scope(s)}${spec.band && !future ? ' · no forecast band for past nights' : ''}`,
    aria: `${title}.`,
    view: 'line',
    views: [{ view: 'line', ok: true }, { view: 'columns', ok: true }, { view: 'table', ok: true }, { view: 'donut', ok: false, reason: 'A series over time isn’t parts of one whole' }],
    badge: ignores.length ? { label: `All ${ignores.join(' & ')}s`, detail: 'Nightly totals aren’t split by segment or channel; Channel mix and Segment share follow those filters.' } : null,
    ignores,
    legend: [
      { label: future ? 'On the books' : 'Actual', mark: 'solid' },
      ...(cmp ? [{ label: COMPARES[s.compare].label, mark: 'dashed' as const }] : []),
      ...(band ? [{ label: 'Forecast P10–P90', mark: 'band' as const }] : []),
    ],
    table: {
      columns: ['Night', future ? 'On the books' : 'Actual', ...(cmp ? [COMPARES[s.compare].label] : []), ...(band ? ['P10', 'P50', 'P90'] : [])],
      rows: idx.map((i, k) => [labels[k], fmt.pct(occ[k]), ...(cmp ? [fmt.pct(cmp[k])] : []), ...(band ? [fmt.pct(band.lo[k]), fmt.pct(band.mid[k]), fmt.pct(band.hi[k])] : [])]),
      align: ['l', 'r', 'r', 'r', 'r', 'r'],
    },
    sql: PF_SQL.nights,
    definitions: [OCC_DEF, ...(s.compare === 'stly' ? [STLY_DEF] : s.compare === 'budget' ? [BUD_DEF] : []), ...(band || s.compare === 'forecast' ? [FC_DEF] : [])],
    computed: 'For each night, rooms and rooms available are summed across the selected hotels, then divided. The band is the sum of each hotel’s P10 and P90 rooms.',
    height: 230,
    option: (view, p, width) => ({
      aria: { enabled: true },
      animationDuration: 400,
      grid: { left: 8, right: 12, top: 12, bottom: 4, containLabel: true },
      tooltip: { ...tooltip(p), valueFormatter: (v: number) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '') },
      xAxis: { type: 'category', data: labels, boundaryGap: view === 'columns', ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, interval: Math.max(0, Math.ceil(labels.length / (width < 480 ? 4 : 6)) - 1) }, splitLine: { show: false } },
      yAxis: { type: 'value', min: 0, max: 100, splitNumber: 4, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, formatter: '{value}%' } },
      series: [
        ...(band && view === 'line'
          ? [
              { type: 'line', name: 'P10', data: band.lo.map((v) => +v.toFixed(1)), stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, tooltip: { show: false } },
              { type: 'line', name: 'P10–P90', data: band.hi.map((v, k) => +(v - band.lo[k]).toFixed(1)), stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: p.series, opacity: 0.14 }, tooltip: { show: false } },
              { type: 'line', name: 'Forecast P50', data: band.mid.map((v) => +v.toFixed(1)), symbol: 'none', lineStyle: { color: p.series, width: 1, type: 'dashed', opacity: 0.7 } },
            ]
          : []),
        ...(cmp ? [{ type: 'line', name: COMPARES[s.compare].label, data: cmp.map((v) => +v.toFixed(1)), symbol: 'none', lineStyle: { color: p.cmp, width: 1.5, type: 'dashed' } }] : []),
        view === 'columns'
          ? { type: 'bar', name: future ? 'On the books' : 'Actual', data: occ.map((v) => +v.toFixed(1)), itemStyle: { color: p.series, borderRadius: [2, 2, 0, 0] }, barMaxWidth: 14 }
          : { type: 'line', name: future ? 'On the books' : 'Actual', data: occ.map((v) => +v.toFixed(1)), symbol: 'none', lineStyle: { color: p.series, width: 2 }, z: 5 },
      ],
    }),
  };
}

type MixRow = readonly [string, string, string, number, number, number];
function mix(spec: Extract<ChartSpec, { kind: 'bar' | 'share' }>, s: FilterState): Resolved {
  const codes = new Set(codesOf(s));
  const rows = ((PF_MIX as unknown as Record<RangeKey, MixRow[]>)[s.range] ?? []).filter(
    (r) => codes.has(r[0]) && (!s.segments.length || s.segments.includes(r[1])) && (!s.channels.length || s.channels.includes(r[2])),
  );
  const dim = spec.dimension;
  const names = dim === 'channel' ? CHANNELS : SEGMENTS;
  const groups = new Map<string, { nights: number; rev: number; comm: number }>();
  for (const r of rows) {
    const k = dim === 'channel' ? r[2] : r[1];
    const g = groups.get(k) ?? { nights: 0, rev: 0, comm: 0 };
    g.nights += r[3];
    g.rev += r[4];
    g.comm += r[5];
    groups.set(k, g);
  }
  const by = spec.kind === 'share' ? 'nights' : 'rev';
  const list = [...groups.entries()].map(([k, g]) => ({ code: k, name: names.find((n) => n.code === k)?.name ?? k, ...g, net: g.rev - g.comm })).sort((a, b) => b[by] - a[by]);
  const total = list.reduce((t, x) => t + x[by], 0);
  const comm = list.reduce((t, x) => t + x.comm, 0);
  // Donut gate: one whole, one moment, 2–5 slices, largest first; more parts fold into "Other" (last).
  const slices = list.length > 5 ? [...list.slice(0, 4), list.slice(4).reduce((o, x) => ({ ...o, nights: o.nights + x.nights, rev: o.rev + x.rev, comm: o.comm + x.comm, net: o.net + x.net }), { code: 'other', name: 'Other', nights: 0, rev: 0, comm: 0, net: 0 })] : list;
  const donutOk = slices.length >= 2 && slices.length <= 5 && spec.kind === 'share';
  const top = list[0];
  const share = top ? (top[by] / total) * 100 : 0;
  const scopeText = `${hotelLabel(s.hotels)} · ${RANGES[s.range].label.toLowerCase()}${s.segments.length ? ` · ${listLabel(s.segments, SEGMENTS, '')}` : ''}${s.channels.length ? ` · ${listLabel(s.channels, CHANNELS, '')}` : ''}`;
  const title =
    !top
      ? 'No room nights for these filters'
      : spec.kind === 'share'
        ? `${top.name} is ${fmt.pct(share, 0)} of room nights`
        : `${top.name} brings ${fmt.pct(share, 0)} of room revenue; commission takes ${fmt.eur(comm)}`;
  const views: Resolved['views'] =
    spec.kind === 'share'
      ? [{ view: 'donut', ok: donutOk, reason: donutOk ? undefined : slices.length < 2 ? 'Only one part' : 'A donut reads 2–5 parts' }, { view: 'bars', ok: true }, { view: 'table', ok: true }]
      : [{ view: 'bars', ok: true }, { view: 'table', ok: true }, { view: 'donut', ok: false, reason: `${list.length} parts and net vs commission: a donut reads 2–5 parts of one whole` }];
  const ignoresCompare = s.compare !== 'none';
  return {
    title,
    subtitle: `${spec.kind === 'share' ? 'Room nights by ' + dim : 'Room revenue by ' + dim + ', net of commission'} · ${scopeText}`,
    aria: `${title}. ${list.map((x) => `${x.name} ${spec.kind === 'share' ? fmt.int(x.nights) + ' room nights' : fmt.eur(x.net) + ' net'}`).join(', ')}`,
    view: list.length ? views.find((v) => v.ok)!.view : 'table',
    views,
    badge: ignoresCompare ? { label: 'No comparison', detail: 'Mix is shown for the selected nights only; the comparison isn’t applied to it yet.' } : null,
    ignores: ignoresCompare ? ['comparison'] : [],
    legend: spec.kind === 'share' ? [] : [{ label: 'Net room revenue', mark: 'solid' }, { label: 'Commission', mark: 'grey' }],
    table: {
      columns: [dim === 'channel' ? 'Channel' : 'Segment', 'Room nights', 'Room revenue', 'Commission', 'Net', 'Share'],
      rows: list.map((x) => [x.name, fmt.int(x.nights), fmt.eur(x.rev), fmt.eur(x.comm), fmt.eur(x.net), fmt.pct((x[by] / total) * 100, 0)]),
      align: ['l', 'r', 'r', 'r', 'r', 'r'],
    },
    empty: list.length ? undefined : { text: 'No room nights match these filters.', action: { label: 'Clear segment and channel', patch: { segments: [], channels: [] } } },
    sql: PF_SQL.mix,
    definitions: [['Commission', 'room revenue × the channel’s commission rate (Booking.com 17%, Expedia 18%, GDS 10%, brand website 3%)'], ['Net', 'room revenue − commission'], ['Room nights', 'nights booked and not cancelled, on the books as of 20 Nov']],
    computed: 'Rows are grouped in the browser from the extracted cube (hotel × segment × channel) for the selected nights.',
    height: spec.kind === 'share' ? 220 : Math.max(140, list.length * 30 + 30),
    option: (view, p) => {
      if (view === 'donut') {
        const greys = [p.cmp, p.muted, p.grid, p.border];
        return {
          aria: { enabled: true },
          animationDuration: 400,
          tooltip: { ...tooltip(p, 'item'), valueFormatter: (v: number) => fmt.int(v) },
          series: [
            {
              type: 'pie',
              radius: ['52%', '78%'],
              center: ['50%', '52%'],
              startAngle: 90,
              clockwise: true,
              avoidLabelOverlap: true,
              itemStyle: { borderColor: p.card, borderWidth: 2 },
              label: { color: p.text, fontSize: 12, formatter: (x: { name: string; percent: number }) => `${x.name}\n${Math.round(x.percent)}%` },
              labelLine: { lineStyle: { color: p.border } },
              data: slices.map((x, i) => ({ name: x.name, value: x[by], itemStyle: { color: i === 0 ? p.series : greys[(i - 1) % greys.length] } })),
            },
          ],
        };
      }
      const cats = list.map((x) => x.name);
      return {
        aria: { enabled: true },
        animationDuration: 400,
        grid: { left: 8, right: 56, top: 6, bottom: 22, containLabel: true },
        tooltip: { ...tooltip(p), valueFormatter: (v: number) => (spec.kind === 'share' ? fmt.int(v) : fmt.eur(v)) },
        xAxis: { type: 'value', splitNumber: 3, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, formatter: (v: number) => (spec.kind === 'share' ? fmt.int(v) : fmt.axis(v)) } },
        yAxis: { type: 'category', data: cats, inverse: true, ...axisBase(p), axisLabel: { color: p.text, fontSize: 12.5, fontFamily: 'Inter' }, splitLine: { show: false } },
        series:
          spec.kind === 'share'
            ? [{ type: 'bar', name: 'Room nights', data: list.map((x) => x.nights), barWidth: 12, itemStyle: { color: p.series, borderRadius: [0, 2, 2, 0] }, label: { show: true, position: 'right', color: p.text, fontSize: 11.5, formatter: (x: { value: number }) => `${Math.round((x.value / total) * 100)}%` } }]
            : [
                { type: 'bar', name: 'Net', stack: 'r', data: list.map((x) => Math.round(x.net)), barWidth: 12, itemStyle: { color: p.series } },
                { type: 'bar', name: 'Commission', stack: 'r', data: list.map((x) => Math.round(x.comm)), barWidth: 12, itemStyle: { color: p.cmp, borderRadius: [0, 2, 2, 0] }, label: { show: true, position: 'right', color: p.text, fontSize: 11.5, formatter: (x: { dataIndex: number }) => fmt.eur(list[x.dataIndex].net) } },
              ],
      };
    },
  };
}

function quadrant(s: FilterState): Resolved {
  const future = RANGES[s.range].future;
  const win = future ? 'last30' : s.range;
  const idx = (PF_INDEX as unknown as Record<string, Record<string, { mpi: number; ari: number; rgi: number }>>)[win] ?? {};
  const pts = codesOf(s)
    .filter((c) => idx[c])
    .map((c) => ({ code: c, name: short(c), ...idx[c] }));
  const premium = pts.filter((x) => x.mpi >= 100 && x.ari >= 100).length;
  const low = pts.reduce((a, b) => (a.rgi < b.rgi ? a : b), pts[0]);
  const title = pts.length < 2 ? `${pts[0]?.name ?? '—'}: RGI ${pts[0]?.rgi ?? '—'}` : `${premium} of ${pts.length} hotels win share at a premium; ${low.name} has the lowest RGI (${low.rgi})`;
  const ignores = [...segChIgnored(s), ...(s.compare !== 'none' ? ['comparison'] : [])];
  return {
    title,
    subtitle: `ARI × MPI against each comp set · ${hotelLabel(s.hotels)} · ${win === 'last30' ? 'last 30 nights' : 'last 7 nights'}`,
    aria: `${title}. ${pts.map((x) => `${x.name} MPI ${x.mpi}, ARI ${x.ari}`).join('; ')}`,
    view: pts.length < 2 ? 'table' : 'quadrant',
    views: [{ view: 'quadrant', ok: pts.length >= 2, reason: 'Needs two hotels or more' }, { view: 'bars', ok: true }, { view: 'table', ok: true }],
    badge: future ? { label: 'Own dates: last 30 nights', detail: 'MPI, ARI and RGI need actuals; the comp-set benchmark only covers nights already stayed.' } : ignores.length ? { label: 'Comp-set index', detail: 'Indices compare whole hotels with their comp sets; segment, channel and comparison filters don’t apply.' } : null,
    ignores,
    legend: [{ label: 'Hotel', mark: 'solid' }, { label: '100 = comp set', mark: 'dashed' }],
    table: { columns: ['Hotel', 'MPI', 'ARI', 'RGI'], rows: [...pts].sort((a, b) => a.rgi - b.rgi).map((x) => [x.name, String(x.mpi), String(x.ari), String(x.rgi)]), align: ['l', 'r', 'r', 'r'] },
    sql: PF_SQL.index,
    definitions: [['MPI', 'occupancy ÷ comp-set occupancy × 100 (share of demand)'], ['ARI', 'ADR ÷ comp-set ADR × 100 (price position)'], ['RGI', 'RevPAR ÷ comp-set RevPAR × 100 (fair share of revenue)']],
    computed: 'Computed in SQL from v_hotel_day and the comp-set benchmark (comp_set_daily) for the window.',
    height: 400,
    option: (view, p) => {
      if (view === 'bars') {
        const sorted = [...pts].sort((a, b) => a.rgi - b.rgi);
        return {
          aria: { enabled: true },
          grid: { left: 8, right: 40, top: 6, bottom: 22, containLabel: true },
          tooltip: tooltip(p),
          xAxis: { type: 'value', ...axisBase(p), min: (v: { min: number }) => Math.floor(Math.min(v.min, 90) / 10) * 10 },
          yAxis: { type: 'category', data: sorted.map((x) => x.name), inverse: true, ...axisBase(p), axisLabel: { color: p.text, fontSize: 12.5 }, splitLine: { show: false } },
          series: [{ type: 'bar', name: 'RGI', data: sorted.map((x) => x.rgi), barWidth: 12, itemStyle: { color: p.series }, markLine: { symbol: 'none', silent: true, lineStyle: { color: p.cmp, type: 'dashed' }, label: { color: p.muted, formatter: '100' }, data: [{ xAxis: 100 }] }, label: { show: true, position: 'right', color: p.text, fontSize: 11.5 } }],
        };
      }
      const xs = pts.map((x) => x.ari);
      const ys = pts.map((x) => x.mpi);
      const pad = (a: number[]) => [Math.floor(Math.min(...a, 100) / 5) * 5 - 5, Math.ceil(Math.max(...a, 100) / 5) * 5 + 5];
      const [x0, x1] = pad(xs);
      const [y0, y1] = pad(ys);
      return {
        aria: { enabled: true },
        animationDuration: 400,
        grid: { left: 8, right: 16, top: 40, bottom: 26, containLabel: true },
        tooltip: { ...tooltip(p, 'item'), formatter: (x: { data: [number, number, string, number] }) => `${x.data[2]}<br/>ARI ${x.data[0]} · MPI ${x.data[1]} · RGI ${x.data[3]}` },
        xAxis: { type: 'value', min: x0, max: x1, name: 'ARI · price vs comp set', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: p.muted, fontSize: 11.5 }, ...axisBase(p) },
        yAxis: { type: 'value', min: y0, max: y1, name: 'MPI · share of demand', nameLocation: 'end', nameGap: 14, nameTextStyle: { color: p.muted, fontSize: 11.5, align: 'left' }, ...axisBase(p) },
        series: [
          {
            type: 'scatter',
            // Furthest from parity first: when labels collide, hideOverlap keeps the hotels worth naming; the rest stay in the tooltip and table.
            data: [...pts].sort((a, b) => Math.hypot(b.ari - 100, b.mpi - 100) - Math.hypot(a.ari - 100, a.mpi - 100)).map((x) => [x.ari, x.mpi, x.name, x.rgi]),
            symbolSize: 9,
            itemStyle: { color: p.series },
            label: { show: true, position: 'right', color: p.text, fontSize: 11, formatter: (x: { data: [number, number, string] }) => x.data[2] },
            labelLayout: { hideOverlap: true },
            markLine: { symbol: 'none', silent: true, lineStyle: { color: p.cmp, type: 'dashed' }, label: { show: false }, data: [{ xAxis: 100 }, { yAxis: 100 }] },
          },
        ],
        graphic: [
          { type: 'text', right: 24, top: 44, style: { text: 'Share at a premium', fill: p.muted, fontSize: 11 } },
          { type: 'text', left: 56, top: 44, style: { text: 'Share at a discount', fill: p.muted, fontSize: 11 } },
          { type: 'text', right: 24, bottom: 40, style: { text: 'Price over share', fill: p.muted, fontSize: 11 } },
        ],
      };
    },
  };
}

function bridge(s: FilterState): Resolved {
  const pnl = PF_PNL as unknown as Record<string, Record<string, { actual?: number; budget?: number }>>;
  const codes = codesOf(s);
  const line = (l: string, k: 'actual' | 'budget') => codes.reduce((t, c) => t + (pnl[c]?.[l]?.[k] ?? 0), 0);
  const v = (l: string) => line(l, 'actual') - line(l, 'budget');
  const exp = (l: string) => -(line(l, 'actual') - line(l, 'budget')); // spending more lowers GOP
  const steps = [
    { name: 'Rooms revenue', d: v('ROOMS_REVENUE') },
    { name: 'F&B revenue', d: v('FNB_REVENUE') },
    { name: 'M&E revenue', d: v('ME_REVENUE') },
    { name: 'Other revenue', d: v('OTHER_REVENUE') },
    { name: 'Rooms costs', d: exp('ROOMS_EXPENSE') },
    { name: 'F&B costs', d: exp('FNB_EXPENSE') },
    { name: 'Undistributed', d: exp('AG_EXPENSE') + exp('SM_EXPENSE') + exp('POM_EXPENSE') + exp('UTILITIES_EXPENSE') },
  ];
  const b = line('GOP', 'budget');
  const a = line('GOP', 'actual');
  const rest = a - b - steps.reduce((t, x) => t + x.d, 0);
  if (Math.abs(rest) > 1) steps.push({ name: 'Other', d: rest });
  const biggest = steps.reduce((x, y) => (Math.abs(x.d) > Math.abs(y.d) ? x : y));
  const month = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(`${PF_CLOSED_MONTH}-01T00:00:00Z`));
  const title = `${month} GOP ${fmt.eur(a)} vs ${fmt.eur(b)} budgeted; ${biggest.name.toLowerCase()} moved it most (${fmt.eur(biggest.d)})`;
  const ignores = [...segChIgnored(s), ...(s.compare !== 'budget' && s.compare !== 'none' ? ['comparison'] : [])];
  return {
    title,
    subtitle: `GOP from budget to actual · ${hotelLabel(s.hotels)} · ${month}, the last closed month`,
    aria: `${title}. ${steps.map((x) => `${x.name} ${fmt.eur(x.d)}`).join(', ')}`,
    view: 'waterfall',
    views: [{ view: 'waterfall', ok: true }, { view: 'table', ok: true }, { view: 'donut', ok: false, reason: 'Variances can be negative; parts of a whole can’t' }],
    badge: { label: `Own dates: ${month.split(' ')[0]}`, detail: 'The P&L closes monthly; the stay-night filter doesn’t apply. October is the last closed month.' },
    ignores: ['stay nights', ...ignores],
    legend: [{ label: 'Budget and actual GOP', mark: 'solid' }, { label: 'Raised GOP', mark: 'pos' }, { label: 'Lowered GOP', mark: 'neg' }],
    table: { columns: ['Step', 'Effect on GOP'], rows: [['Budget GOP', fmt.eur(b)], ...steps.map((x) => [x.name, fmt.eur(x.d)]), ['Actual GOP', fmt.eur(a)]], align: ['l', 'r'] },
    sql: PF_SQL.pnl,
    definitions: [['GOP', 'gross operating profit: total revenue − departmental and undistributed expenses (USALI)'], ['Effect', 'revenue above budget raises GOP; costs above budget lower it']],
    computed: 'Each step is actual − budget for its P&L lines (costs with the sign flipped), summed over the selected hotels; "Other" reconciles any line not listed.',
    height: 280,
    option: (_view, p) => {
      const cats = ['Budget', ...steps.map((x) => x.name), 'Actual'];
      let run = b;
      const base: (number | string)[] = [0];
      const up: (number | string)[] = [b];
      const down: (number | string)[] = ['-'];
      for (const x of steps) {
        const lo = x.d >= 0 ? run : run + x.d;
        base.push(Math.round(lo));
        up.push(x.d >= 0 ? Math.round(x.d) : '-');
        down.push(x.d < 0 ? Math.round(-x.d) : '-');
        run += x.d;
      }
      base.push(0);
      up.push(Math.round(a));
      down.push('-');
      const color = (i: number) => (i === 0 || i === cats.length - 1 ? p.series : p.pos);
      // The steps are a few % of GOP; without a break they'd be slivers on two tall columns. The break is
      // drawn as a visible gap in the totals, so nothing pretends the axis starts at the bottom.
      let lo = Math.min(a, b);
      for (let i = 0, r = b; i < steps.length; i++) lo = Math.min(lo, (r += steps[i].d));
      const step = 10 ** Math.floor(Math.log10(lo / 4));
      const brk = { start: Math.round((lo * 0.1) / step) * step, end: Math.floor((lo * 0.93) / step) * step, gap: '6%' };
      const stepLabel = (sign: 1 | -1) => ({ show: true, position: 'top', color: p.text, fontSize: 11, formatter: (x: { dataIndex: number; value: number | string }) => (x.dataIndex === 0 || x.dataIndex === cats.length - 1 ? fmt.eur(+x.value) : `${sign > 0 ? '+' : '−'}${fmt.eur(+x.value)}`) });
      return {
        aria: { enabled: true },
        animationDuration: 400,
        grid: { left: 8, right: 12, top: 18, bottom: 4, containLabel: true },
        tooltip: { ...tooltip(p), formatter: (xs: { dataIndex: number }[]) => { const i = xs[0].dataIndex; return i === 0 ? `Budget GOP ${fmt.eur(b)}` : i === cats.length - 1 ? `Actual GOP ${fmt.eur(a)}` : `${steps[i - 1].name}: ${fmt.eur(steps[i - 1].d)}`; } },
        xAxis: { type: 'category', data: cats, ...axisBase(p), axisLabel: { ...axisBase(p).axisLabel, interval: 0, rotate: cats.length > 7 ? 30 : 0 }, splitLine: { show: false } },
        yAxis: { type: 'value', ...axisBase(p), breaks: [brk], breakArea: { itemStyle: { color: p.card, borderColor: p.muted, borderWidth: 1, borderType: 'solid', opacity: 1 }, zigzagAmplitude: 3 }, axisLabel: { ...axisBase(p).axisLabel, formatter: (x: number) => fmt.axis(x) } },
        series: [
          { type: 'bar', stack: 'w', data: base, itemStyle: { color: 'transparent' }, emphasis: { disabled: true }, tooltip: { show: false } },
          { type: 'bar', stack: 'w', name: 'Raised', data: up, barMaxWidth: 34, itemStyle: { color: (x: { dataIndex: number }) => color(x.dataIndex) }, label: stepLabel(1) },
          { type: 'bar', stack: 'w', name: 'Lowered', data: down, barMaxWidth: 34, itemStyle: { color: p.neg }, label: { ...stepLabel(-1), position: 'bottom' } },
        ],
      };
    },
  };
}

function hotelTable(s: FilterState): Resolved {
  const rows = codesOf(s).map((c) => {
    const t = totals(s, [c]);
    return { name: short(c), t };
  }).sort((a, b) => b.t.rev - a.t.rev);
  const col = (m: MetricId, t: Totals) => [METRIC[m].format(METRIC[m].value(t)), deltaText(m, delta(m, t))];
  const ignores = segChIgnored(s);
  return {
    title: `${rows.length} ${rows.length === 1 ? 'hotel' : 'hotels'}, ${RANGES[s.range].label.toLowerCase()}, by room revenue`,
    subtitle: scope(s),
    aria: 'Table of hotels',
    view: 'table',
    views: [{ view: 'table', ok: true }],
    badge: ignores.length ? { label: `All ${ignores.join(' & ')}s`, detail: 'Hotel totals aren’t split by segment or channel.' } : null,
    ignores,
    legend: [],
    table: {
      columns: ['Hotel', 'Occupancy', 'Δ', 'ADR', 'Δ', 'RevPAR', 'Δ', 'Room revenue', 'Δ'],
      rows: rows.map((r) => [r.name, ...col('occupancy', r.t), ...col('adr', r.t), ...col('revpar', r.t), ...col('revenue', r.t)]),
      align: ['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
    },
    sql: PF_SQL.nights,
    definitions: [OCC_DEF, ['ADR', 'room revenue ÷ rooms sold'], ['RevPAR', 'room revenue ÷ rooms available'], ...(s.compare === 'stly' ? [STLY_DEF] : [])],
    computed: 'Sums over the selected nights per hotel, then the ratios; Δ is against the selected comparison.',
    height: 0,
    option: () => ({}),
  };
}

/** The Portfolio board's widgets, as specs (the same shape Kassandra would emit). */
export const PORTFOLIO_SPECS: ChartSpec[] = [
  { id: 'c-pace', kind: 'line', metric: 'occupancy', grain: 'day', band: 'p10_p90' },
  { id: 'c-position', kind: 'bullet', metric: 'occupancy', rows: 'hotel', refs: ['stly', 'budget', 'forecast'] },
  { id: 'c-index', kind: 'quadrant', x: 'ari', y: 'mpi' },
  { id: 'c-mix', kind: 'bar', metric: 'revenue_net', dimension: 'channel', sort: 'desc' },
  { id: 'c-segments', kind: 'share', metric: 'room_nights', dimension: 'segment' },
  { id: 'c-gop', kind: 'bridge', metric: 'gop' },
  { id: 'c-table', kind: 'table', rows: 'hotel' },
];
/** Wide cards span both columns on desktop. */
export const isWide = (s: ChartSpec) => s.kind === 'line' || s.kind === 'bridge' || s.kind === 'table';
