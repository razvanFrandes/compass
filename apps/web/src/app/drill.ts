import type { ArtifactSpec, TopicContent } from './store';
import { CHANNELS, FilterState, HOTELS, RANGES, SEGMENTS, fmtDay, scopeChips } from './filters';
import { Drill, PORTFOLIO_SPECS, kpis, resolve } from './portfolio';
import { PF_DATES, PF_MIX, PF_NIGHTS, PF_SQL } from './portfolio-data';

/*
  A click on a chart mark becomes a structured follow-up ({ drill: { dimension, value } }), not free text
  (report, "Fiecare grafic poartă aceleași cinci piese"). The answer is assembled from the same resolver
  the charts use, so every sentence matches a chart on the board, and it carries its own scope.
*/

const spec = (kind: string) => PORTFOLIO_SPECS.find((s) => s.kind === kind)!;
const N = PF_NIGHTS as unknown as Record<string, Record<string, (number | null)[]>>;
const DATES = PF_DATES as readonly string[];

export interface DrillResult {
  question: string;
  scope: FilterState;
  extraChip?: string;
  content: TopicContent;
}

export function drillContent(d: Drill, s: FilterState): DrillResult {
  if (d.dimension === 'night') return nightDrill(d, s);
  const scope: FilterState =
    d.dimension === 'hotel' ? { ...s, hotels: [d.value] } : d.dimension === 'channel' ? { ...s, channels: [d.value], chOp: 'is' } : { ...s, segments: [d.value], segOp: 'is' };
  const r = RANGES[scope.range];
  const titles = (kinds: string[]) => kinds.map((k) => resolve(spec(k), scope)).filter((x) => !x.empty);
  const parts =
    d.dimension === 'hotel'
      ? titles(['position', 'pace', ...(r.future ? ['pickup', 'fan'] : []), 'quadrant'])
      : titles(d.dimension === 'channel' ? ['mix_net', 'share'] : ['share', 'mix_net']);
  const k = kpis(scope);
  const occ = k[0];
  const question = d.dimension === 'hotel' ? `What’s behind ${d.label}, ${r.short}?` : `What’s behind ${d.label}, ${r.short}?`;
  const answer = parts.flatMap((p, i) => [{ t: i ? ' ' : '' }, { t: `${p.title}.`, b: i === 0 }]);
  const artifact: ArtifactSpec =
    d.dimension === 'hotel'
      ? {
          id: `a-drill-${d.value}`,
          kind: 'columns',
          title: `Occupancy by night · ${r.label}`,
          subtitle: d.label,
          points: occ.spark.slice(0, 31).map((v, i) => ({ label: fmtDay(Date.parse(`${DATES[r.from + i]}T00:00:00Z`)), value: Math.round(v) })),
          unit: '%',
          source: 'Daily hotel performance · pace vs last year',
        }
      : {
          id: `a-drill-${d.value}`,
          kind: 'bars',
          title: `${d.label} by hotel · ${r.label}`,
          subtitle: 'Room revenue, net of commission',
          rows: byHotel(scope, d).slice(0, 8),
          source: 'Reservations · channels',
        };
  return {
    question,
    scope,
    content: {
      steps: [
        { title: 'Read the board’s filters', detail: scopeChips(scope).join(' · ') },
        { title: `Narrowed to ${d.label}`, detail: `${d.dimension}: ${d.label}` },
        { title: 'Used the same figures as the charts', detail: parts.map((p) => p.data?.kind ?? 'table').join(', ') },
      ],
      answer: answer.length ? answer : [{ t: `No data for ${d.label} with these filters.` }],
      sources: d.dimension === 'hotel' ? ['v_hotel_day', 'pace_vs_stly()', 'forecasts', 'comp_set_daily'] : ['reservations', 'channels'],
      artifact,
      definitions: parts.flatMap((p) => p.definitions).filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i),
      sql: d.dimension === 'hotel' ? PF_SQL.nights : PF_SQL.mix,
      followUps: d.dimension === 'hotel' ? [`Which ${d.label} nights are furthest behind?`, `How does ${d.label} compare with its comp set?`] : [`Which hotels rely most on ${d.label}?`],
    },
  };
}

/** Room nights for one channel or segment, by hotel (after the other filters). */
function byHotel(s: FilterState, d: Drill) {
  const rows = (PF_MIX as unknown as Record<string, [string, string, string, number, number, number][]>)[s.range] ?? [];
  const codes = new Set(s.hotels.length ? s.hotels : HOTELS.map((h) => h.code));
  const m = new Map<string, number>();
  for (const r of rows) if (codes.has(r[0]) && (d.dimension === 'channel' ? r[2] : r[1]) === d.value) m.set(r[0], (m.get(r[0]) ?? 0) + r[4] - r[5]);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, v]) => ({ label: HOTELS.find((h) => h.code === c)?.short ?? c, value: Math.round(v), note: '', display: v >= 1e6 ? `€${(v / 1e6).toFixed(2)}M` : `€${Math.round(v / 1e3)}k` }));
}

function nightDrill(d: Drill, s: FilterState): DrillResult {
  const i = DATES.indexOf(d.value);
  const codes = s.hotels.length ? s.hotels : HOTELS.map((h) => h.code);
  const v = (c: string, col: string) => N[c]?.[col]?.[i] ?? 0;
  const rows = codes
    .map((c) => ({ c, name: HOTELS.find((h) => h.code === c)?.short ?? c, occ: (v(c, 'rooms') / Math.max(1, v(c, 'avail'))) * 100, p50: (v(c, 'p50') / Math.max(1, v(c, 'avail'))) * 100 }))
    .sort((a, b) => b.p50 - a.p50);
  const tot = (col: string) => codes.reduce((t, c) => t + v(c, col), 0);
  const occ = (tot('rooms') / tot('avail')) * 100;
  const p50 = (tot('p50') / tot('avail')) * 100;
  const stly = (tot('cmp_rooms') / tot('avail')) * 100;
  const label = fmtDay(Date.parse(`${d.value}T00:00:00Z`));
  const top = rows[0];
  return {
    question: `What’s driving the night of ${label}?`,
    scope: s,
    extraChip: `night of ${label}`,
    content: {
      steps: [
        { title: 'Read the board’s filters', detail: scopeChips(s).join(' · ') },
        { title: `Narrowed to one night`, detail: label },
      ],
      answer: [
        { t: `On ${label} the selected hotels are ` },
        { t: `${occ.toFixed(1)}% on the books`, b: true },
        { t: `, ${(occ - stly >= 0 ? '+' : '−') + Math.abs(occ - stly).toFixed(1)} pts vs same time last year, and the forecast lands at ` },
        { t: `${p50.toFixed(0)}%`, b: true },
        { t: `. ${top ? `${top.name} is forecast fullest (${top.p50.toFixed(0)}%).` : ''}` },
      ],
      sources: ['pace_vs_stly()', 'forecasts', 'room_inventory_daily'],
      artifact: {
        id: `a-night-${d.value}`,
        kind: 'bars',
        title: `Forecast occupancy · ${label}`,
        subtitle: `${rows.length} hotels`,
        rows: rows.slice(0, 10).map((x) => ({ label: x.name, value: Math.round(x.p50), note: `${x.occ.toFixed(0)}% on the books`, display: `${x.p50.toFixed(0)}%` })),
        source: 'Forecasts',
      },
      definitions: [
        ['On the books', 'reservations made before today and not cancelled'],
        ['Forecast', 'the RMS forecast made 20 Nov, middle estimate'],
      ],
      sql: PF_SQL.nights,
      followUps: [`Which hotels could still sell out on ${label}?`],
    },
  };
}

/** Labels for channel and segment drills, kept here so the card stays dumb. */
export const dimLabel = (d: Drill) => (d.dimension === 'channel' ? (CHANNELS.find((c) => c.code === d.value)?.name ?? d.value) : d.dimension === 'segment' ? (SEGMENTS.find((x) => x.code === d.value)?.name ?? d.value) : d.label);
