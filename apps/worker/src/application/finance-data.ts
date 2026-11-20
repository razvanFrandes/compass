import type { DataResult, Evidence } from '@compass/contracts';
import { err, ok, type Result } from '../domain/result.ts';
import type { Db } from './ports.ts';

/**
 * The Finance, Meetings & Events and forecast lenses: the USALI P&L against budget and last year, the occupancy
 * forecast as a P10–P90 range, M&E revenue and space utilisation, and demand turned away. Same contract as
 * HotelData: rows plus the evidence of how they were computed, money in EUR, ratios from sums.
 */

/** `internal`: the database failed. `cause` may name hosts or connection details, so it is for the logs only. */
export type FinanceError = { kind: 'invalid'; message: string } | { kind: 'internal'; cause: unknown };

export type RollUp = 'hotel' | 'region' | 'brand' | 'group';
export type MonthBucket = 'month' | 'total';
export type DayBucket = 'day' | 'week' | 'month' | 'total';

/** The USALI lines of hotel.pnl_monthly, in statement order. */
export const PNL_LINES = [
  'ROOMS_REVENUE',
  'FNB_REVENUE',
  'ME_REVENUE',
  'OTHER_REVENUE',
  'TOTAL_REVENUE',
  'ROOMS_EXPENSE',
  'FNB_EXPENSE',
  'DEPARTMENTAL_PROFIT',
  'AG_EXPENSE',
  'SM_EXPENSE',
  'POM_EXPENSE',
  'UTILITIES_EXPENSE',
  'GOP',
] as const;
export type PnlLine = (typeof PNL_LINES)[number];

/** Row key per roll-up level; `h` is hotel.hotels and `b` hotel.brands. A closed union, so interpolating it is safe. */
const KEY: Record<RollUp, string> = { hotel: 'h.hotel_code', region: 'h.region', brand: 'b.name', group: "'Halcyon group'" };
const JOIN_HOTELS = 'join hotel.hotels h using (hotel_code) join hotel.brands b on b.brand_code = h.brand_code';

/** SQL for a period column. `grain` is a closed union, so interpolating it is safe. */
function period(grain: DayBucket, column: string, fromParam: string): string {
  return grain === 'total' ? `${fromParam}::date` : `date_trunc('${grain}', ${column})::date`;
}

const rollUpNote = (by: RollUp) =>
  by === 'hotel' ? [] : [`Rolled up by ${by} from sums over its hotels in EUR, not by averaging hotel ratios.`];
const hotelsParam = (hotels?: string[]) => (hotels?.length ? hotels : null);

export interface PnlInput {
  hotels?: string[];
  by?: RollUp;
  from: string;
  to: string;
  grain?: MonthBucket;
  view?: 'summary' | 'lines';
  lines?: PnlLine[];
}

export interface PnlSummaryRow {
  period: string;
  key: string;
  months: number;
  basis: 'actual' | 'forecast' | 'actual+forecast';
  revenue_eur: number;
  revenue_budget_eur: number;
  revenue_var_eur: number;
  revenue_var_pct: number | null;
  gop_eur: number;
  gop_budget_eur: number;
  gop_var_eur: number;
  gop_var_pct: number | null;
  gop_margin_pct: number | null;
  gop_margin_budget_pct: number | null;
  flowthrough_budget_pct: number | null;
  revenue_ly_eur: number | null;
  gop_ly_eur: number | null;
  gop_margin_ly_pct: number | null;
  revenue_ly_var_pct: number | null;
  flowthrough_ly_pct: number | null;
}

export interface PnlLineRow {
  period: string;
  key: string;
  line: PnlLine;
  months: number;
  basis: PnlSummaryRow['basis'];
  value_eur: number;
  budget_eur: number;
  var_eur: number;
  var_pct: number | null;
  favourable: boolean;
  ly_eur: number | null;
  ly_var_pct: number | null;
}

export interface ForecastRow {
  period: string;
  key: string;
  rooms_available: number;
  rooms_actual: number;
  rooms_on_books: number;
  rooms_on_books_stly: number;
  pace_pct: number | null;
  rooms_p10: number;
  rooms_p50: number;
  rooms_p90: number;
  occupancy_p10_pct: number;
  occupancy_p50_pct: number;
  occupancy_p90_pct: number;
  room_revenue_p10_eur: number;
  room_revenue_p50_eur: number;
  room_revenue_p90_eur: number;
  budget_rooms_sold: number | null;
  budget_occupancy_pct: number | null;
  budget_room_revenue_eur: number | null;
  p50_vs_budget_pct: number | null;
  revenue_p50_vs_budget_pct: number | null;
  budget_position: 'below P10' | 'within P10–P90' | 'above P90' | null;
}

export interface MeetingsEventsRow {
  period: string;
  key: string;
  events: number;
  attendees: number;
  revenue_eur: number;
  space_av_revenue_eur: number;
  banquet_fnb_revenue_eur: number;
  meeting_space_sqm: number;
  revenue_per_sqm_eur: number | null;
  room_days_booked: number;
  room_days_available: number;
  utilisation_pct: number | null;
  tentative_events: number;
  tentative_revenue_eur: number;
  cancelled_events: number;
}

export interface LostBusinessRow {
  period: string;
  key: string;
  reason: 'price' | 'no_availability';
  detail: string | null;
  requests: number;
  room_nights: number;
  share_pct: number;
  est_revenue_eur: number;
}

export class FinanceData {
  private readonly db: Db;
  private readonly businessDate: () => Promise<string>;

  constructor(db: Db, businessDate: () => Promise<string>) {
    this.db = db;
    this.businessDate = businessDate;
  }

  /** USALI P&L: actual (closed months) or forecast (open months) against budget and last year, in EUR. */
  getPnl(input: PnlInput & { view?: 'summary' }): Promise<Result<DataResult<PnlSummaryRow>, FinanceError>>;
  getPnl(input: PnlInput & { view: 'lines' }): Promise<Result<DataResult<PnlLineRow>, FinanceError>>;
  getPnl(input: PnlInput): Promise<Result<DataResult<PnlSummaryRow | PnlLineRow>, FinanceError>>;
  async getPnl(input: PnlInput): Promise<Result<DataResult<PnlSummaryRow | PnlLineRow>, FinanceError>> {
    if (input.from > input.to) return err({ kind: 'invalid', message: '`from` must be on or before `to`.' });
    const by = input.by ?? 'hotel';
    const grain = input.grain ?? 'month';
    const view = input.view ?? 'summary';
    const lines = view === 'summary' ? ['TOTAL_REVENUE', 'GOP'] : input.lines?.length ? input.lines : null;
    // $1 from, $2 to, $3 hotels, $4 lines. A month's value is its actual when closed, else the latest forecast.
    const base = `
      with months as (
        select m::date as month
          from generate_series(date_trunc('month', $1::date), date_trunc('month', $2::date), interval '1 month') m),
      hm as (
        select p.hotel_code, mo.month, p.line,
               sum(p.amount * hotel.eur_rate(p.currency, p.month)) filter (where p.month = mo.month and p.scenario in ('actual', 'forecast')) as value,
               sum(p.amount * hotel.eur_rate(p.currency, p.month)) filter (where p.month = mo.month and p.scenario = 'budget') as budget,
               sum(p.amount * hotel.eur_rate(p.currency, p.month)) filter (where p.month < mo.month and p.scenario = 'actual') as ly,
               bool_or(p.month = mo.month and p.scenario = 'actual') as has_actual,
               bool_or(p.month = mo.month and p.scenario = 'forecast') as has_forecast
          from months mo
          join hotel.pnl_monthly p on p.month = mo.month or p.month = (mo.month - interval '1 year')::date
         where ($3::text[] is null or p.hotel_code = any($3::text[])) and ($4::text[] is null or p.line = any($4::text[]))
         group by 1, 2, 3
        having bool_or(p.month = mo.month and p.scenario in ('actual', 'forecast'))),
      agg as (
        select ${period(grain, 'hm.month', '$1')} as period, ${KEY[by]} as key, hm.line, count(distinct hm.month)::int as months,
               sum(hm.value) as value, sum(hm.budget) as budget,
               case when bool_and(hm.ly is not null) then sum(hm.ly) end as ly,
               case when bool_and(hm.has_actual) then 'actual' when bool_and(hm.has_forecast) then 'forecast'
                    else 'actual+forecast' end as basis
          from hm ${JOIN_HOTELS}
         group by 1, 2, 3)`;
    const sql =
      view === 'summary'
        ? `${base},
      s as (
        select period, key, months, basis,
               max(value) filter (where line = 'TOTAL_REVENUE') as rev, max(budget) filter (where line = 'TOTAL_REVENUE') as rev_b,
               max(ly) filter (where line = 'TOTAL_REVENUE') as rev_ly,
               max(value) filter (where line = 'GOP') as gop, max(budget) filter (where line = 'GOP') as gop_b,
               max(ly) filter (where line = 'GOP') as gop_ly
          from agg group by 1, 2, 3, 4)
      select to_char(period, 'YYYY-MM-DD') as period, key, months, basis,
             round(rev)::float8 as revenue_eur, round(rev_b)::float8 as revenue_budget_eur, round(rev - rev_b)::float8 as revenue_var_eur,
             round(100 * (rev - rev_b) / nullif(rev_b, 0), 1)::float8 as revenue_var_pct,
             round(gop)::float8 as gop_eur, round(gop_b)::float8 as gop_budget_eur, round(gop - gop_b)::float8 as gop_var_eur,
             round(100 * (gop - gop_b) / nullif(abs(gop_b), 0), 1)::float8 as gop_var_pct,
             round(100 * gop / nullif(rev, 0), 1)::float8 as gop_margin_pct,
             round(100 * gop_b / nullif(rev_b, 0), 1)::float8 as gop_margin_budget_pct,
             case when abs(rev - rev_b) >= 0.02 * abs(rev_b) then round(100 * (gop - gop_b) / (rev - rev_b), 1)::float8 end
               as flowthrough_budget_pct,
             round(rev_ly)::float8 as revenue_ly_eur, round(gop_ly)::float8 as gop_ly_eur,
             round(100 * gop_ly / nullif(rev_ly, 0), 1)::float8 as gop_margin_ly_pct,
             round(100 * (rev - rev_ly) / nullif(rev_ly, 0), 1)::float8 as revenue_ly_var_pct,
             case when abs(rev - rev_ly) >= 0.02 * abs(rev_ly) then round(100 * (gop - gop_ly) / (rev - rev_ly), 1)::float8 end
               as flowthrough_ly_pct
        from s order by 1, 2`
        : `${base}
      select to_char(period, 'YYYY-MM-DD') as period, key, line, months, basis,
             round(value)::float8 as value_eur, round(budget)::float8 as budget_eur, round(value - budget)::float8 as var_eur,
             round(100 * (value - budget) / nullif(abs(budget), 0), 1)::float8 as var_pct,
             case when line like '%EXPENSE' then value <= budget else value >= budget end as favourable,
             round(ly)::float8 as ly_eur, round(100 * (value - ly) / nullif(abs(ly), 0), 1)::float8 as ly_var_pct
        from agg
       order by 1, 2, array_position(array['${PNL_LINES.join("','")}'], line)`;
    const params = [input.from, input.to, hotelsParam(input.hotels), lines];
    return this.#tryRun<PnlSummaryRow | PnlLineRow>(sql, params, {
      sources: ['hotel.pnl_monthly'],
      definitions: {
        basis: 'actual for closed months; forecast (the latest estimate) for the current and future months; actual+forecast when the period spans both.',
        gop: 'Gross operating profit: total revenue − departmental expenses − undistributed expenses (A&G, S&M, POM, utilities), USALI.',
        gop_margin: 'GOP ÷ total revenue, in %.',
        flowthrough:
          'Δ GOP ÷ Δ total revenue, in %, vs budget or vs last year: how much of each extra euro of revenue reached GOP. ' +
          'Left empty when revenue moved by less than 2%: the ratio of two small differences is noise.',
        variance: 'Actual (or forecast) − budget, in EUR and in % of budget.',
      },
      period: { from: input.from, to: input.to },
      notes: [
        'Monthly data: periods are whole calendar months. Money converted to EUR at each month\'s rate; future months use the latest rate.',
        'Last year is the same months one year earlier, actuals only; it is empty when any of those months has no actuals (data starts in January 2025).',
        ...(view === 'lines' ? ['For expense lines a positive variance means spending above budget: favourable says which way is good.'] : []),
        ...rollUpNote(by),
      ],
    });
  }

  /** Room-night forecast with its P10–P90 range per month, against on the books, last year and the budget. */
  async getForecast(input: {
    hotels?: string[];
    by?: RollUp;
    from?: string;
    to?: string;
    grain?: MonthBucket;
  }): Promise<Result<DataResult<ForecastRow>, FinanceError>> {
    const bd = await this.businessDate();
    if (input.from && input.to && input.from > input.to) return err({ kind: 'invalid', message: '`from` must be on or before `to`.' });
    if (input.to && input.to < bd) {
      return err({ kind: 'invalid', message: `The forecast covers stays from the business date (${bd}) on. Use get_metric for past months.` });
    }
    const by = input.by ?? 'hotel';
    const grain = input.grain ?? 'month';
    // $1 from, $2 to, $3 hotels. Whole months: the current month adds its actual nights before the business date.
    const sql = `
      with snap as (select max(forecast_date) as d from hotel.forecasts),
      lim as (
        select greatest(date_trunc('month', coalesce($1::date, snap.d)), date_trunc('month', snap.d))::date as f,
               least((date_trunc('month', coalesce($2::date, (select max(stay_date) from hotel.forecasts))) + interval '1 month - 1 day')::date,
                     (select max(stay_date) from hotel.forecasts)) as t,
               snap.d
          from snap),
      stly as (
        select o.hotel_code, o.stay_date + 364 as date, o.rooms_on_books
          from lim, hotel.otb_as_of(lim.d - 364, null, lim.d - 364, lim.t - 364) o),
      nights as (
        select d.hotel_code, d.date, d.rooms_available, d.rooms_sold as actual, 0 as otb, 0 as stly,
               d.rooms_sold as p10, d.rooms_sold as p50, d.rooms_sold as p90,
               d.room_revenue as rev_p10, d.room_revenue as rev_p50, d.room_revenue as rev_p90
          from lim, hotel.v_hotel_day d
         where d.date >= lim.f and d.date < lim.d and ($3::text[] is null or d.hotel_code = any($3::text[]))
        union all
        select f.hotel_code, f.stay_date, f.rooms_available, 0, f.rooms_on_books, coalesce(s.rooms_on_books, 0),
               f.rooms_p10, f.rooms_p50, f.rooms_p90,
               f.rooms_p10 * f.adr_p50, f.room_revenue_p50, f.rooms_p90 * f.adr_p50
          from lim, hotel.forecasts f
          left join stly s on s.hotel_code = f.hotel_code and s.date = f.stay_date
         where f.forecast_date = lim.d and f.stay_date between greatest(lim.f, lim.d) and lim.t
           and ($3::text[] is null or f.hotel_code = any($3::text[]))),
      hm as (
        select n.hotel_code, date_trunc('month', n.date)::date as month,
               sum(n.rooms_available) as cap, sum(n.actual) as actual, sum(n.otb) as otb, sum(n.stly) as stly,
               sum(n.p10) as p10, sum(n.p50) as p50, sum(n.p90) as p90,
               sum(n.rev_p10) as rev_p10, sum(n.rev_p50) as rev_p50, sum(n.rev_p90) as rev_p90
          from nights n group by 1, 2),
      hme as (
        select hm.*, hotel.eur_rate(h.currency, hm.month) as fx, bu.rooms_sold as b_rooms, bu.rooms_available as b_cap,
               bu.room_revenue as b_rev
          from hm join hotel.hotels h using (hotel_code)
          left join hotel.budgets bu on bu.hotel_code = hm.hotel_code and bu.month = hm.month),
      agg as (
        select ${period(grain, 'hme.month', '(select f from lim)')} as period, ${KEY[by]} as key,
               sum(cap) as cap, sum(actual) as actual, sum(otb) as otb, sum(stly) as stly,
               sum(p10) as p10, sum(p50) as p50, sum(p90) as p90,
               sum(rev_p10 * fx) as rev_p10, sum(rev_p50 * fx) as rev_p50, sum(rev_p90 * fx) as rev_p90,
               case when bool_and(b_rooms is not null) then sum(b_rooms) end as b_rooms, sum(b_cap) as b_cap,
               case when bool_and(b_rev is not null) then sum(b_rev * fx) end as b_rev
          from hme ${JOIN_HOTELS}
         group by 1, 2)
      select to_char(period, 'YYYY-MM-DD') as period, key, cap::int as rooms_available, actual::int as rooms_actual,
             otb::int as rooms_on_books, stly::int as rooms_on_books_stly,
             round(100.0 * (otb - stly) / nullif(stly, 0), 1)::float8 as pace_pct,
             p10::int as rooms_p10, p50::int as rooms_p50, p90::int as rooms_p90,
             round(100.0 * p10 / cap, 1)::float8 as occupancy_p10_pct, round(100.0 * p50 / cap, 1)::float8 as occupancy_p50_pct,
             round(100.0 * p90 / cap, 1)::float8 as occupancy_p90_pct,
             round(rev_p10)::float8 as room_revenue_p10_eur, round(rev_p50)::float8 as room_revenue_p50_eur,
             round(rev_p90)::float8 as room_revenue_p90_eur,
             b_rooms::int as budget_rooms_sold, round(100.0 * b_rooms / nullif(b_cap, 0), 1)::float8 as budget_occupancy_pct,
             round(b_rev)::float8 as budget_room_revenue_eur,
             round(100.0 * (p50 - b_rooms) / nullif(b_rooms, 0), 1)::float8 as p50_vs_budget_pct,
             round(100 * (rev_p50 - b_rev) / nullif(b_rev, 0), 1)::float8 as revenue_p50_vs_budget_pct,
             case when b_rooms is null then null when b_rooms < p10 then 'below P10' when b_rooms > p90 then 'above P90'
                  else 'within P10–P90' end as budget_position
        from agg order by 1, 2`;
    const params = [input.from ?? null, input.to ?? null, hotelsParam(input.hotels)];
    return this.#tryRun<ForecastRow>(sql, params, {
      sources: ['hotel.forecasts', 'hotel.v_hotel_day', 'hotel.otb_as_of()', 'hotel.budgets'],
      definitions: {
        range:
          'The RMS forecast of room nights sold: low (P10), expected (P50) and high (P90). P10 has 9 in 10 chances of being beaten, ' +
          'P50 is the median, P90 has 1 in 10. A forecast is quoted as the P10–P90 range, not as one number.',
        rooms_on_books: 'Room nights already booked for the future nights of the period (forecast snapshot).',
        rooms_on_books_stly: 'Room nights on the books at the same time last year (364 days earlier) for the same nights.',
        room_revenue_p10_eur:
          'P10 and P90 room revenue = P10 / P90 room nights × the forecast ADR (P50); only room revenue has a P50 in the RMS.',
        budget_position: 'Where the room-night budget falls against the forecast range.',
      },
      period: input.from && input.to ? { from: input.from, to: input.to } : null,
      notes: [
        `Forecast made on ${bd}. Periods are whole months; the current month includes the nights already sold before the business date, so it compares with the monthly budget.`,
        'Monthly ranges are sums of daily P10/P90: a deliberately wide range (it assumes the days move together).',
        'Money in EUR at each month\'s rate (the latest rate for future months).',
        ...rollUpNote(by),
      ],
    });
  }

  /** Meetings & events: definite events, attendees, revenue, revenue per sqm and space utilisation; tentative pipeline. */
  async getMeetingsEvents(input: { hotels?: string[]; by?: RollUp; from: string; to: string; grain?: DayBucket }): Promise<DataResult<MeetingsEventsRow>> {
    const by = input.by ?? 'hotel';
    const grain = input.grain ?? 'month';
    // $1 from, $2 to, $3 hotels. Revenue and counts by event start date; utilisation by every day an event occupies a room.
    const sql = `
      with ev as (
        select e.*, hotel.eur_rate(e.currency, e.start_date) as fx
          from hotel.me_events e
         where e.start_date <= $2::date and e.end_date >= $1::date and ($3::text[] is null or e.hotel_code = any($3::text[]))),
      cap as (
        select ${period(grain, 'g.d', '$1')} as period, ${KEY[by]} as key, count(*)::int as room_days_available
          from hotel.meeting_rooms mr ${JOIN_HOTELS}
         cross join generate_series($1::date, $2::date, interval '1 day') g(d)
         where $3::text[] is null or mr.hotel_code = any($3::text[])
         group by 1, 2),
      space as (
        select ${KEY[by]} as key, sum(h.meeting_space_sqm)::int as sqm
          from hotel.hotels h join hotel.brands b on b.brand_code = h.brand_code
         where h.meeting_space_sqm > 0 and ($3::text[] is null or h.hotel_code = any($3::text[]))
         group by 1),
      rev as (
        select ${period(grain, 'ev.start_date', '$1')} as period, ${KEY[by]} as key,
               count(*) filter (where ev.status = 'definite') as events,
               sum(ev.attendees) filter (where ev.status = 'definite') as attendees,
               sum((ev.space_revenue + ev.fnb_revenue + ev.av_revenue) * ev.fx) filter (where ev.status = 'definite') as revenue,
               sum((ev.space_revenue + ev.av_revenue) * ev.fx) filter (where ev.status = 'definite') as space_av,
               sum(ev.fnb_revenue * ev.fx) filter (where ev.status = 'definite') as banquet,
               count(*) filter (where ev.status = 'tentative') as tentative,
               sum((ev.space_revenue + ev.fnb_revenue + ev.av_revenue) * ev.fx) filter (where ev.status = 'tentative') as tentative_revenue,
               count(*) filter (where ev.status = 'cancelled') as cancelled
          from ev ${JOIN_HOTELS}
         where ev.start_date between $1::date and $2::date
         group by 1, 2),
      booked as (
        select ${period(grain, 'g.d', '$1')} as period, ${KEY[by]} as key, count(distinct (ev.meeting_room_id, g.d)) as room_days
          from ev ${JOIN_HOTELS}
         cross join generate_series(greatest(ev.start_date, $1::date), least(ev.end_date, $2::date), interval '1 day') g(d)
         where ev.status = 'definite'
         group by 1, 2)
      select to_char(cap.period, 'YYYY-MM-DD') as period, cap.key,
             coalesce(rev.events, 0)::int as events, coalesce(rev.attendees, 0)::int as attendees,
             round(coalesce(rev.revenue, 0))::float8 as revenue_eur, round(coalesce(rev.space_av, 0))::float8 as space_av_revenue_eur,
             round(coalesce(rev.banquet, 0))::float8 as banquet_fnb_revenue_eur, space.sqm as meeting_space_sqm,
             round(coalesce(rev.revenue, 0) / nullif(space.sqm, 0), 2)::float8 as revenue_per_sqm_eur,
             coalesce(booked.room_days, 0)::int as room_days_booked, cap.room_days_available,
             round(100.0 * coalesce(booked.room_days, 0) / nullif(cap.room_days_available, 0), 1)::float8 as utilisation_pct,
             coalesce(rev.tentative, 0)::int as tentative_events, round(coalesce(rev.tentative_revenue, 0))::float8 as tentative_revenue_eur,
             coalesce(rev.cancelled, 0)::int as cancelled_events
        from cap join space using (key)
        left join rev using (period, key)
        left join booked using (period, key)
       order by 1, 2`;
    return this.#run<MeetingsEventsRow>(sql, [input.from, input.to, hotelsParam(input.hotels)], {
      sources: ['hotel.me_events', 'hotel.meeting_rooms', 'hotel.hotels'],
      definitions: {
        revenue_eur: 'Definite events: space hire + banquet F&B + AV, in EUR, by event start date.',
        space_av_revenue_eur: 'Space hire + AV only: what the P&L books as M&E revenue (banquet F&B is booked under F&B revenue).',
        revenue_per_sqm_eur: 'M&E revenue ÷ the hotel\'s meeting space in sqm, for the period.',
        utilisation_pct: 'Meeting-room days booked by definite events ÷ meeting-room days available (rooms × days), in %.',
        tentative_events: 'Pipeline: provisional bookings not yet confirmed, with their revenue if they convert.',
      },
      period: { from: input.from, to: input.to },
      notes: [
        'Dates after the business date are the pipeline: definite events are on the books, tentative ones may still convert or drop.',
        'Tessera Buenos Aires Palermo and Tessera London King’s Cross have no meeting space, so they do not appear.',
        ...rollUpNote(by),
      ],
    });
  }

  /** Demand turned away (regrets and denials) by reason, with room nights and an estimated value at BAR in EUR. */
  async getLostBusiness(input: {
    hotels?: string[];
    by?: RollUp;
    from: string;
    to: string;
    grain?: DayBucket;
    basis?: 'arrival' | 'request';
    detail?: 'none' | 'segment' | 'channel';
  }): Promise<DataResult<LostBusinessRow>> {
    const by = input.by ?? 'hotel';
    const grain = input.grain ?? 'month';
    const dateColumn = input.basis === 'request' ? 'l.request_date' : 'l.arrival_date';
    const detail = { none: 'null::text', segment: 'l.segment', channel: 'l.channel' }[input.detail ?? 'none'];
    const sql = `
      with x as (
        select ${period(grain, dateColumn, '$1')} as period, l.hotel_code, l.reason, ${detail} as detail,
               sum(l.requests) as requests, sum(l.room_nights) as room_nights, sum(l.room_nights * r.bar_rate) as value_local
          from hotel.lost_business l
          left join hotel.rates_daily r on r.hotel_code = l.hotel_code and r.stay_date = l.arrival_date
         where ${dateColumn} between $1::date and $2::date and ($3::text[] is null or l.hotel_code = any($3::text[]))
         group by 1, 2, 3, 4),
      y as (
        select x.period, ${KEY[by]} as key, x.reason, x.detail, sum(x.requests) as requests, sum(x.room_nights) as room_nights,
               sum(x.value_local * hotel.eur_rate(h.currency, x.period)) as value
          from x ${JOIN_HOTELS}
         group by 1, 2, 3, 4)
      select to_char(period, 'YYYY-MM-DD') as period, key, reason, detail, requests::int, room_nights::int,
             round(100.0 * room_nights / sum(room_nights) over (partition by period, key), 1)::float8 as share_pct,
             round(value)::float8 as est_revenue_eur
        from y order by 1, 2, room_nights desc`;
    return this.#run<LostBusinessRow>(sql, [input.from, input.to, hotelsParam(input.hotels)], {
      sources: ['hotel.lost_business', 'hotel.rates_daily'],
      definitions: {
        reason: 'price: the guest saw the rate and did not book (a regret); no_availability: the hotel or room type was full (a denial).',
        est_revenue_eur:
          'Room nights turned away × our BAR on the arrival night, in EUR. An upper bound: price regrets would not have paid BAR.',
        share_pct: 'Share of the room nights turned away in the period by reason (and detail).',
      },
      period: { from: input.from, to: input.to },
      notes: [
        input.basis === 'request'
          ? 'Basis "request": by the day the guest asked (when demand was turned away).'
          : 'Basis "arrival": by arrival date (which stays the demand was for). For future arrivals only requests made up to the business date count, so those totals still grow; denials (no_availability) mostly come close to arrival.',
        'Many price regrets with a rate above the comp set suggest "priced too high"; many denials suggest "full", where a higher rate could have been charged.',
        'Money converted at the rate of the period start.',
        ...rollUpNote(by),
      ],
    });
  }

  async #run<Row>(sql: string, params: unknown[], meta: Partial<Evidence>): Promise<DataResult<Row>> {
    const rows = await this.db.query<Row>(sql, params);
    return {
      rows,
      evidence: {
        sources: meta.sources ?? [],
        definitions: meta.definitions ?? {},
        period: meta.period ?? null,
        sql: sql.replace(/\s+/g, ' ').trim(),
        params,
        rowCount: rows.length,
        businessDate: await this.businessDate(),
        notes: meta.notes ?? [],
      },
    };
  }

  async #tryRun<Row>(sql: string, params: unknown[], meta: Partial<Evidence>): Promise<Result<DataResult<Row>, FinanceError>> {
    try {
      return ok(await this.#run<Row>(sql, params, meta));
    } catch (error) {
      return err({ kind: 'internal', cause: error });
    }
  }
}
