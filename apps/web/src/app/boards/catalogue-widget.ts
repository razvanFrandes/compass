import type { Evidence } from '@compass/contracts';
import { BUSINESS_DATE, FilterState, RANGES } from '../filters';
import { ChartSpec, resolve } from '../portfolio';
import { PF_CLOSED_MONTH, PF_DATES } from '../portfolio-data';
import type { WidgetPayload } from './types';

const SOURCES: Record<ChartSpec['kind'], string[]> = {
  position: ['hotel.pace_vs_stly()', 'hotel.forecasts', 'hotel.budgets'],
  pace: ['hotel.reservations', 'hotel.otb_as_of()'],
  pickup: ['hotel.reservations'],
  fan: ['hotel.forecasts', 'hotel.room_inventory_daily', 'hotel.budgets'],
  mix_net: ['hotel.reservation_nights', 'hotel.reservations', 'hotel.channels'],
  share: ['hotel.reservation_nights', 'hotel.reservations'],
  quadrant: ['hotel.v_hotel_day', 'hotel.comp_set_daily'],
  bridge: ['hotel.pnl_monthly'],
  table: ['hotel.v_hotel_day', 'hotel.pace_vs_stly()'],
};

/**
 * A catalogue chart as a board widget (round2-contracts §3–4): the numbers it shows as rows with labelled
 * columns, and the evidence behind them, so a saved board shows the same chart without the filter bar.
 */
export function chartToWidget(spec: ChartSpec, s: FilterState): WidgetPayload | null {
  const r = resolve(spec, s);
  if (!r.data || r.empty || !r.data.rows.length) return null;
  const range = RANGES[s.range];
  const dates = PF_DATES as readonly string[];
  const period =
    spec.kind === 'bridge'
      ? { from: `${PF_CLOSED_MONTH}-01`, to: lastDay(PF_CLOSED_MONTH) }
      : spec.kind === 'quadrant' && range.future
        ? { from: dates[dates.indexOf(BUSINESS_DATE) - 30] ?? dates[0], to: dates[dates.indexOf(BUSINESS_DATE) - 1] ?? BUSINESS_DATE }
        : { from: dates[range.from], to: dates[range.to] };
  const evidence: Evidence = {
    sources: SOURCES[spec.kind],
    definitions: Object.fromEntries(r.definitions),
    period,
    sql: r.sql,
    params: [],
    rowCount: r.data.rows.length,
    businessDate: BUSINESS_DATE,
    notes: [r.computed],
  };
  const { kind, x, y, group, compare, format, rows, columns } = r.data;
  return {
    spec: { kind, title: r.title, subtitle: r.subtitle, sourceCallId: `catalogue:${spec.kind}`, ...(x ? { x } : {}), ...(y ? { y } : {}), ...(group ? { group } : {}), ...(compare ? { compare } : {}), ...(format ? { format } : {}) },
    rows,
    columns,
    evidence,
  };
}

function lastDay(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
