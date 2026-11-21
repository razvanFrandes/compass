import type {
  BriefChart,
  BriefFeed,
  BriefHotelNight,
  BriefItem,
  BriefMoney,
  BriefNight,
  BriefNights,
  BriefOverview,
  BriefPickup,
  BriefPulse,
  EvidenceColumn,
  PulseTile,
} from '@compass/contracts';
import type { Db } from './ports.ts';

/**
 * The numbers around the morning brief, for the hotels of a scope: the Pulse tiles, the next 14 nights, the last
 * 7 days of pickup, where the revenue is, the data feeds, and one catalogue chart per finding.
 *
 * Every number is computed in SQL; this file only arranges rows. Ratios come from sums over the scope's hotels,
 * money is in EUR at the business date's rate (so a move in a currency does not read as a move in trade), and last
 * year is the same weekday 364 days earlier, at the same lead time.
 */

/** `$1`: the hotel codes of the scope, or null for the whole group. */
const SCOPED = (column: string) => `($1::text[] is null or ${column} = any($1::text[]))`;

const DATES_SQL = `
  select to_char(d, 'YYYY-MM-DD') as today, to_char(d + 29, 'YYYY-MM-DD') as plus29, to_char(d + 13, 'YYYY-MM-DD') as plus13,
         to_char(d - 6, 'YYYY-MM-DD') as minus6
    from (select hotel.business_date() as d) bd`;

/** On the books for the next 30 nights against the same time last year: a row per night, then one for the period. */
const PULSE_SQL = `
  with bd as (select hotel.business_date() as d),
  n as (
    select p.stay_date, p.rooms_otb, p.rooms_otb_stly,
           p.revenue_otb * hotel.eur_rate(h.currency, bd.d) as rev,
           p.revenue_otb_stly * hotel.eur_rate(h.currency, bd.d) as rev_stly,
           i.rooms_available as avail, coalesce(il.rooms_available, i.rooms_available) as avail_stly
      from bd cross join hotel.pace_vs_stly(null, 29) p
      join hotel.hotels h on h.hotel_code = p.hotel_code
      join hotel.room_inventory_daily i on i.hotel_code = p.hotel_code and i.date = p.stay_date
      left join hotel.room_inventory_daily il on il.hotel_code = p.hotel_code and il.date = p.stay_date - 364
     where ${SCOPED('p.hotel_code')}),
  s as (
    select stay_date, sum(rooms_otb) as rooms, sum(rooms_otb_stly) as rooms_stly, sum(avail) as avail, sum(avail_stly) as avail_stly,
           sum(rev) as rev, sum(rev_stly) as rev_stly
      from n group by grouping sets ((stay_date), ()))
  select to_char(stay_date, 'YYYY-MM-DD') as stay_date,
         rooms::int as rooms, rooms_stly::int as rooms_stly,
         round(100.0 * rooms / nullif(avail, 0), 1)::float8 as occupancy,
         round(100.0 * rooms_stly / nullif(avail_stly, 0), 1)::float8 as occupancy_stly,
         round(rev / nullif(rooms, 0), 2)::float8 as adr, round(rev_stly / nullif(rooms_stly, 0), 2)::float8 as adr_stly,
         round(rev / nullif(avail, 0), 2)::float8 as revpar, round(rev_stly / nullif(avail_stly, 0), 2)::float8 as revpar_stly,
         round(rev)::float8 as revenue, round(rev_stly)::float8 as revenue_stly,
         round(100.0 * rooms / nullif(avail, 0) - 100.0 * rooms_stly / nullif(avail_stly, 0), 1)::float8 as occupancy_delta,
         round(100.0 * ((rev / nullif(rooms, 0)) / nullif(rev_stly / nullif(rooms_stly, 0), 0) - 1), 1)::float8 as adr_delta,
         round(100.0 * ((rev / nullif(avail, 0)) / nullif(rev_stly / nullif(avail_stly, 0), 0) - 1), 1)::float8 as revpar_delta,
         round(100.0 * (rev / nullif(rev_stly, 0) - 1), 1)::float8 as revenue_delta,
         round(100.0 * (rooms::numeric / nullif(rooms_stly, 0) - 1), 1)::float8 as pace_delta
    from s order by stay_date nulls last`;

/**
 * The P&L's last twelve closed months: total revenue, total revenue per available room, GOP and the GOP margin,
 * each against a year earlier and against the month's budget.
 */
const FINANCE_SQL = `
  with m as (select max(month) as month from hotel.pnl_monthly where scenario = 'actual' and ${SCOPED('hotel_code')}),
  months as (select generate_series(m.month - interval '11 months', m.month, interval '1 month')::date as month from m),
  pnl as (
    select p.month, p.line, p.scenario, sum(p.amount * hotel.eur_rate(p.currency, p.month)) as eur
      from hotel.pnl_monthly p, m
     where p.scenario in ('actual', 'budget') and p.line in ('GOP', 'TOTAL_REVENUE')
       and p.month between m.month - interval '23 months' and m.month and ${SCOPED('p.hotel_code')}
     group by 1, 2, 3),
  inv as (
    select date_trunc('month', i.date)::date as month, sum(i.rooms_available) as avail
      from hotel.room_inventory_daily i, m
     where i.date >= m.month - interval '23 months' and i.date < m.month + interval '1 month' and ${SCOPED('i.hotel_code')}
     group by 1),
  x as (
    select mo.month,
           (select eur from pnl where pnl.month = mo.month and pnl.line = 'GOP' and pnl.scenario = 'actual') as gop,
           (select eur from pnl where pnl.month = (mo.month - interval '1 year')::date and pnl.line = 'GOP' and pnl.scenario = 'actual') as gop_ly,
           (select eur from pnl where pnl.month = mo.month and pnl.line = 'GOP' and pnl.scenario = 'budget') as gop_b,
           (select eur from pnl where pnl.month = mo.month and pnl.line = 'TOTAL_REVENUE' and pnl.scenario = 'actual') as rev,
           (select eur from pnl where pnl.month = (mo.month - interval '1 year')::date and pnl.line = 'TOTAL_REVENUE' and pnl.scenario = 'actual') as rev_ly,
           (select eur from pnl where pnl.month = mo.month and pnl.line = 'TOTAL_REVENUE' and pnl.scenario = 'budget') as rev_b,
           (select avail from inv where inv.month = mo.month) as avail,
           (select avail from inv where inv.month = (mo.month - interval '1 year')::date) as avail_ly
      from months mo)
  select to_char(month, 'YYYY-MM-DD') as month,
         round(rev)::float8 as revenue, round(rev_ly)::float8 as revenue_ly,
         round(100.0 * (rev / nullif(rev_ly, 0) - 1), 1)::float8 as revenue_delta,
         round(100.0 * (rev / nullif(rev_b, 0) - 1), 1)::float8 as revenue_budget_delta,
         round(rev / nullif(avail, 0), 2)::float8 as trevpar, round(rev_ly / nullif(avail_ly, 0), 2)::float8 as trevpar_ly,
         round(100.0 * ((rev / nullif(avail, 0)) / nullif(rev_ly / nullif(avail_ly, 0), 0) - 1), 1)::float8 as trevpar_delta,
         round(gop)::float8 as gop, round(gop_ly)::float8 as gop_ly,
         round(100.0 * (gop / nullif(gop_ly, 0) - 1), 1)::float8 as gop_delta,
         round(100.0 * (gop / nullif(gop_b, 0) - 1), 1)::float8 as gop_budget_delta,
         round(100.0 * gop / nullif(rev, 0), 1)::float8 as margin, round(100.0 * gop_ly / nullif(rev_ly, 0), 1)::float8 as margin_ly,
         round(100.0 * gop / nullif(rev, 0) - 100.0 * gop_ly / nullif(rev_ly, 0), 1)::float8 as margin_delta,
         round(100.0 * gop / nullif(rev, 0) - 100.0 * gop_b / nullif(rev_b, 0), 1)::float8 as margin_budget_delta
    from x order by month`;

/**
 * The next 14 nights per hotel, then per night for the scope (hotel_code null). A night's rate is flagged when it is
 * under the market while demand is high (the brief detector's rule) or over it while the night trails last year.
 */
const NIGHTS_SQL = `
  with n as (
    select p.hotel_code, p.stay_date, p.rooms_otb::int as rooms_otb, p.rooms_otb_stly::int as rooms_otb_stly,
           i.rooms_available as avail, coalesce(il.rooms_available, i.rooms_available) as avail_stly,
           r.bar_rate, r.bar_vs_comp, r.comps_sold_out, h.currency,
           (select string_agg(e.name, ', ' order by e.start_date) from hotel.city_events e
             where e.city = h.city and p.stay_date between e.start_date and e.end_date) as event
      from hotel.pace_vs_stly(null, 13) p
      join hotel.hotels h on h.hotel_code = p.hotel_code
      join hotel.room_inventory_daily i on i.hotel_code = p.hotel_code and i.date = p.stay_date
      left join hotel.room_inventory_daily il on il.hotel_code = p.hotel_code and il.date = p.stay_date - 364
      left join hotel.v_rate_position r on r.hotel_code = p.hotel_code and r.stay_date = p.stay_date
     where ${SCOPED('p.hotel_code')}),
  f as (
    select n.*,
           case when n.bar_vs_comp < 0.85 and (n.comps_sold_out >= 2 or n.rooms_otb > 0.7 * n.avail) then 'underpriced'
                when n.bar_vs_comp > 1.25 and n.rooms_otb < 0.85 * n.rooms_otb_stly then 'overpriced' end as rate_flag
      from n)
  select hotel_code, to_char(stay_date, 'YYYY-MM-DD') as stay_date, avail::int as rooms_available, rooms_otb, rooms_otb_stly,
         round(100.0 * rooms_otb / nullif(avail, 0), 1)::float8 as occupancy_pct,
         round(100.0 * rooms_otb_stly / nullif(avail_stly, 0), 1)::float8 as occupancy_stly_pct,
         bar_rate::float8 as bar_rate, currency::text as currency, round(bar_vs_comp::numeric, 2)::float8 as bar_vs_comp,
         comps_sold_out::int as comps_sold_out, event, rate_flag, null::int as events, null::int as rate_flags
    from f
  union all
  select null, to_char(stay_date, 'YYYY-MM-DD'), sum(avail)::int, sum(rooms_otb)::int, sum(rooms_otb_stly)::int,
         round(100.0 * sum(rooms_otb) / nullif(sum(avail), 0), 1)::float8,
         round(100.0 * sum(rooms_otb_stly) / nullif(sum(avail_stly), 0), 1)::float8,
         null, null, null, null, null, null, count(event)::int, count(rate_flag)::int
    from f group by stay_date
   order by 1 nulls first, 2`;

/** Room nights booked and cancelled on each of the last 7 days (shift 0) and on the same weekdays last year (shift 1). */
const PICKUP_EVENTS = `
  bd as (select hotel.business_date() as d),
  ev as (
    select r.hotel_code, r.created_at::date as day, r.nights as booked, 0 as cancelled, 0 as shift,
           r.total_room_revenue * hotel.eur_rate(r.currency, bd.d) as rev
      from hotel.reservations r, bd where r.created_at >= bd.d - 6 and r.created_at < bd.d + 1 and ${SCOPED('r.hotel_code')}
    union all
    select r.hotel_code, r.cancelled_at::date, 0, r.nights, 0, 0
      from hotel.reservations r, bd where r.cancelled_at >= bd.d - 6 and r.cancelled_at < bd.d + 1 and ${SCOPED('r.hotel_code')}
    union all
    select r.hotel_code, r.created_at::date + 364, r.nights, 0, 1, 0
      from hotel.reservations r, bd where r.created_at >= bd.d - 370 and r.created_at < bd.d - 363 and ${SCOPED('r.hotel_code')}
    union all
    select r.hotel_code, r.cancelled_at::date + 364, 0, r.nights, 1, 0
      from hotel.reservations r, bd where r.cancelled_at >= bd.d - 370 and r.cancelled_at < bd.d - 363 and ${SCOPED('r.hotel_code')})`;
const PICKUP_COLUMNS = `
         coalesce(sum(ev.booked) filter (where ev.shift = 0), 0)::int as booked,
         coalesce(sum(ev.cancelled) filter (where ev.shift = 0), 0)::int as cancelled,
         coalesce(sum(ev.booked - ev.cancelled) filter (where ev.shift = 0), 0)::int as net,
         coalesce(sum(ev.booked - ev.cancelled) filter (where ev.shift = 1), 0)::int as net_ly`;
const PICKUP_BY_DAY_SQL = `
  with ${PICKUP_EVENTS}
  select to_char(g.day, 'YYYY-MM-DD') as booking_date, ${PICKUP_COLUMNS}
    from bd cross join generate_series(bd.d - 6, bd.d, interval '1 day') g(day)
    left join ev on ev.day = g.day::date
   group by 1 order by 1`;
const PICKUP_BY_HOTEL_SQL = `
  with ${PICKUP_EVENTS}
  select h.hotel_code, ${PICKUP_COLUMNS}, round(coalesce(sum(ev.rev), 0))::float8 as revenue_eur
    from hotel.hotels h left join ev on ev.hotel_code = h.hotel_code
   where ${SCOPED('h.hotel_code')}
   group by 1 order by net desc, 1`;

/** Room revenue on the books for the next 30 nights against the same time last year: per hotel, then per stay week. */
const MONEY_SQL = `
  with bd as (select hotel.business_date() as d),
  n as (
    select p.hotel_code, h.region, p.stay_date,
           p.revenue_otb * hotel.eur_rate(h.currency, bd.d) as rev, p.revenue_otb_stly * hotel.eur_rate(h.currency, bd.d) as rev_stly
      from bd cross join hotel.pace_vs_stly(null, 29) p join hotel.hotels h on h.hotel_code = p.hotel_code
     where ${SCOPED('p.hotel_code')})
  select hotel_code, region, null::text as week, round(sum(rev))::float8 as revenue_eur, round(sum(rev_stly))::float8 as revenue_stly_eur,
         round(sum(rev) - sum(rev_stly))::float8 as change_eur, round(100.0 * (sum(rev) / nullif(sum(rev_stly), 0) - 1), 1)::float8 as change_pct
    from n group by hotel_code, region
  union all
  select null, null, to_char(date_trunc('week', stay_date), 'YYYY-MM-DD'), round(sum(rev))::float8, round(sum(rev_stly))::float8,
         round(sum(rev) - sum(rev_stly))::float8, round(100.0 * (sum(rev) / nullif(sum(rev_stly), 0) - 1), 1)::float8
    from n group by date_trunc('week', stay_date)
   order by 3 nulls first, 4 desc`;

/** Every source system of the scope's hotels, the ones that are not fresh first. */
const HEALTH_SQL = `
  select d.hotel_code, d.system, d.vendor, d.status, to_char(d.last_sync_at, 'YYYY-MM-DD HH24:MI') as last_sync_at,
         (hotel.business_date() - d.last_sync_at::date)::int as days_behind
    from hotel.data_sources d
   where ${SCOPED('d.hotel_code')}
   order by (d.status = 'ok'), d.system, d.hotel_code`;

type Row = Record<string, unknown>;
interface PulseRow {
  stay_date: string | null;
  rooms: number;
  rooms_stly: number;
  occupancy: number | null;
  occupancy_stly: number | null;
  adr: number | null;
  adr_stly: number | null;
  revpar: number | null;
  revpar_stly: number | null;
  revenue: number | null;
  revenue_stly: number | null;
  occupancy_delta: number | null;
  adr_delta: number | null;
  revpar_delta: number | null;
  revenue_delta: number | null;
  pace_delta: number | null;
}
interface FinanceRow {
  month: string;
  revenue: number | null;
  revenue_ly: number | null;
  revenue_delta: number | null;
  revenue_budget_delta: number | null;
  trevpar: number | null;
  trevpar_ly: number | null;
  trevpar_delta: number | null;
  gop: number | null;
  gop_ly: number | null;
  gop_delta: number | null;
  gop_budget_delta: number | null;
  margin: number | null;
  margin_ly: number | null;
  margin_delta: number | null;
  margin_budget_delta: number | null;
}
interface Dates {
  today: string;
  plus29: string;
  plus13: string;
  minus6: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-01" → "Oct 2026"; `back` years earlier when given. */
const monthLabel = (iso: string, back = 0) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(0, 4)) - back}`;

async function pulse(db: Db, hotels: string[] | null, dates: Dates): Promise<BriefPulse> {
  const [forward, finance] = await Promise.all([db.query<PulseRow>(PULSE_SQL, [hotels]), db.query<FinanceRow>(FINANCE_SQL, [hotels])]);
  const total = forward.find((row) => row.stay_date === null);
  const nights = forward.filter((row) => row.stay_date !== null);
  const period = 'Next 30 nights';
  const basis = 'same time last year';
  const night = (value: (row: PulseRow) => number | null, compare: (row: PulseRow) => number | null) =>
    nights.map((row) => ({ x: row.stay_date!, value: value(row), compare: compare(row) }));
  const tiles: PulseTile[] = total
    ? [
        {
          key: 'occupancy', label: 'Occupancy', unit: 'percent', value: total.occupancy, compare: total.occupancy_stly, delta: total.occupancy_delta, deltaUnit: 'pp', period, basis,
          definition: 'Rooms on the books ÷ rooms available, for the next 30 nights. Rooms out of order are not available.',
          series: night((r) => r.occupancy, (r) => r.occupancy_stly),
        },
        {
          key: 'adr', label: 'ADR', unit: 'eur', value: total.adr, compare: total.adr_stly, delta: total.adr_delta, deltaUnit: 'pct', period, basis,
          definition: 'Room revenue on the books ÷ rooms on the books, in EUR at today’s rate.',
          series: night((r) => r.adr, (r) => r.adr_stly),
        },
        {
          key: 'revpar', label: 'RevPAR', unit: 'eur', value: total.revpar, compare: total.revpar_stly, delta: total.revpar_delta, deltaUnit: 'pct', period, basis,
          definition: 'Room revenue on the books ÷ rooms available: occupancy × ADR.',
          series: night((r) => r.revpar, (r) => r.revpar_stly),
        },
        {
          key: 'room_revenue', label: 'Room revenue', unit: 'eur', value: total.revenue, compare: total.revenue_stly, delta: total.revenue_delta, deltaUnit: 'pct', period, basis,
          definition: 'Room revenue already on the books for the next 30 nights, in EUR at today’s rate.',
          series: night((r) => r.revenue, (r) => r.revenue_stly),
        },
        {
          key: 'pace', label: 'Pace', unit: 'count', value: total.rooms, compare: total.rooms_stly, delta: total.pace_delta, deltaUnit: 'pct', period, basis,
          definition: 'Room nights on the books for the next 30 nights against what was on the books at the same point last year.',
          series: night((r) => r.rooms, (r) => r.rooms_stly),
        },
      ]
    : [];
  // The finance tiles exist only where the P&L has a closed month for these hotels.
  const closed = finance.filter((row) => row.gop !== null || row.trevpar !== null);
  const last = closed.at(-1);
  if (last) {
    const months = (value: (row: FinanceRow) => number | null, compare: (row: FinanceRow) => number | null) =>
      finance.map((row) => ({ x: row.month, value: value(row), compare: compare(row) }));
    const month = { period: monthLabel(last.month), basis: monthLabel(last.month, 1) };
    const budget = (delta: number | null, deltaUnit: 'pp' | 'pct') => ({ also: { delta, deltaUnit, basis: 'budget' } });
    tiles.push(
      {
        key: 'total_revenue', label: 'Total revenue', unit: 'eur', value: last.revenue, compare: last.revenue_ly, delta: last.revenue_delta, deltaUnit: 'pct', ...month, ...budget(last.revenue_budget_delta, 'pct'),
        definition: 'Rooms, F&B, meetings and other revenue of the last closed month, in EUR.',
        series: months((r) => r.revenue, (r) => r.revenue_ly),
      },
      {
        key: 'trevpar', label: 'TRevPAR', unit: 'eur', value: last.trevpar, compare: last.trevpar_ly, delta: last.trevpar_delta, deltaUnit: 'pct', ...month, ...budget(last.revenue_budget_delta, 'pct'),
        definition: 'Total revenue (rooms, F&B, meetings and other) ÷ rooms available, for the last closed month.',
        series: months((r) => r.trevpar, (r) => r.trevpar_ly),
      },
      {
        key: 'gop', label: 'GOP', unit: 'eur', value: last.gop, compare: last.gop_ly, delta: last.gop_delta, deltaUnit: 'pct', ...month, ...budget(last.gop_budget_delta, 'pct'),
        definition: 'Gross operating profit of the last closed month: total revenue less departmental and undistributed costs.',
        series: months((r) => r.gop, (r) => r.gop_ly),
      },
      {
        key: 'gop_margin', label: 'GOP margin', unit: 'percent', value: last.margin, compare: last.margin_ly, delta: last.margin_delta, deltaUnit: 'pp', ...month, ...budget(last.margin_budget_delta, 'pp'),
        definition: 'GOP ÷ total revenue for the last closed month: how much of each euro of revenue is left as operating profit.',
        series: months((r) => r.margin, (r) => r.margin_ly),
      },
    );
  }
  return { from: dates.today, to: dates.plus29, month: last?.month ?? null, tiles };
}

async function nights(db: Db, hotels: string[] | null, dates: Dates): Promise<BriefNights> {
  const rows = await db.query<BriefHotelNight & { hotel_code: string | null; events: number | null; rate_flags: number | null }>(NIGHTS_SQL, [hotels]);
  const night = (row: (typeof rows)[number]): BriefNight => ({
    stay_date: row.stay_date,
    rooms_available: row.rooms_available,
    rooms_otb: row.rooms_otb,
    rooms_otb_stly: row.rooms_otb_stly,
    occupancy_pct: row.occupancy_pct,
    occupancy_stly_pct: row.occupancy_stly_pct,
  });
  return {
    from: dates.today,
    to: dates.plus13,
    total: rows.filter((row) => row.hotel_code === null).map((row) => ({ ...night(row), events: row.events ?? 0, rate_flags: row.rate_flags ?? 0 })),
    hotels: rows
      .filter((row) => row.hotel_code !== null)
      .map((row) => ({
        hotel_code: row.hotel_code!,
        ...night(row),
        bar_rate: row.bar_rate,
        currency: row.currency,
        bar_vs_comp: row.bar_vs_comp,
        comps_sold_out: row.comps_sold_out,
        event: row.event,
        rate_flag: row.rate_flag,
      })),
  };
}

async function pickup(db: Db, hotels: string[] | null, dates: Dates): Promise<BriefPickup> {
  const [byDay, byHotel] = await Promise.all([
    db.query<BriefPickup['byDay'][number]>(PICKUP_BY_DAY_SQL, [hotels]),
    db.query<BriefPickup['byHotel'][number]>(PICKUP_BY_HOTEL_SQL, [hotels]),
  ]);
  return { from: dates.minus6, to: dates.today, byDay, byHotel };
}

async function money(db: Db, hotels: string[] | null, dates: Dates): Promise<BriefMoney> {
  const rows = await db.query<BriefMoney['byHotel'][number] & { hotel_code: string | null; week: string | null }>(MONEY_SQL, [hotels]);
  return {
    from: dates.today,
    to: dates.plus29,
    byHotel: rows
      .filter((row) => row.hotel_code !== null)
      .map(({ hotel_code, region, revenue_eur, revenue_stly_eur, change_eur, change_pct }) => ({ hotel_code: hotel_code!, region, revenue_eur, revenue_stly_eur, change_eur, change_pct })),
    byWeek: rows.filter((row) => row.week !== null).map((row) => ({ week: row.week!, revenue_eur: row.revenue_eur, revenue_stly_eur: row.revenue_stly_eur })),
  };
}

/* ───────── A chart per finding ───────── */

const col = (key: string, label: string, kind: EvidenceColumn['kind'], extra: Partial<EvidenceColumn> = {}): EvidenceColumn => ({ key, label, kind, ...extra });

interface ChartPlan {
  sql: string;
  params: (item: BriefItem) => unknown[];
  /** The spec and the columns, once the rows are known (a currency comes from the rows). */
  chart: (item: BriefItem, rows: Row[]) => Omit<BriefChart, 'rows'>;
}

const PACE_DAYS_AHEAD = 45;
const PACE_LOOKBACK = 56;

const CHARTS: Partial<Record<BriefItem['kind'], ChartPlan>> = {
  /** The booking curve: room nights on the books for the next 45 nights as of each of the last 8 weeks' days. */
  pace_behind: {
    sql: `
      with bd as (select hotel.business_date() as d),
      res as (
        select r.created_at, r.cancelled_at, 0 as shift,
               (least(r.departure_date - 1, bd.d + $2::int) - greatest(r.arrival_date, bd.d) + 1) as nights
          from hotel.reservations r, bd
         where r.hotel_code = $1 and r.departure_date > bd.d and r.arrival_date <= bd.d + $2::int
        union all
        select r.created_at, r.cancelled_at, 364,
               (least(r.departure_date - 1, bd.d - 364 + $2::int) - greatest(r.arrival_date, bd.d - 364) + 1)
          from hotel.reservations r, bd
         where r.hotel_code = $1 and r.departure_date > bd.d - 364 and r.arrival_date <= bd.d - 364 + $2::int)
      select to_char(bd.d - a.back, 'YYYY-MM-DD') as booking_date,
             coalesce(sum(res.nights) filter (where res.shift = 0), 0)::int as rooms_otb,
             coalesce(sum(res.nights) filter (where res.shift = 364), 0)::int as rooms_otb_stly
        from bd cross join generate_series(0, $3::int) a(back)
        left join res on res.created_at < bd.d - a.back - res.shift + 1
                     and (res.cancelled_at is null or res.cancelled_at >= bd.d - a.back - res.shift + 1)
       group by 1 order by 1`,
    params: (item) => [item.hotel_code, PACE_DAYS_AHEAD, PACE_LOOKBACK],
    chart: () => ({
      kind: 'line',
      title: `Room nights on the books for the next ${PACE_DAYS_AHEAD} nights, by booking day`,
      subtitle: 'This year against the same point last year',
      x: 'booking_date',
      y: ['rooms_otb'],
      compare: 'rooms_otb_stly',
      columns: [col('booking_date', 'As of', 'date'), col('rooms_otb', 'On the books', 'count', { unit: 'room nights' }), col('rooms_otb_stly', 'Last year', 'count', { unit: 'room nights' })],
      sources: ['hotel.reservations'],
    }),
  },

  /** Our rate on the flagged nights (and a night either side) against the comp set's median. */
  underpriced_demand: {
    sql: `
      select to_char(r.stay_date, 'Dy FMDD Mon') as night, to_char(r.stay_date, 'YYYY-MM-DD') as stay_date,
             r.bar_rate::float8 as bar_rate, round(r.comp_median::numeric, 2)::float8 as comp_median,
             r.comps_sold_out::int as comps_sold_out, h.currency::text as currency
        from hotel.v_rate_position r join hotel.hotels h using (hotel_code)
       where r.hotel_code = $1 and r.stay_date between $2::date - 1 and $3::date + 1 and r.comp_median is not null
       order by r.stay_date`,
    params: (item) => [item.hotel_code, item.facts['first_night'], item.facts['last_night']],
    chart: (_item, rows) => {
      const currency = String(rows[0]?.['currency'] ?? 'local currency');
      return {
        kind: 'bullet',
        title: 'Our rate against the comp set’s median, per night',
        subtitle: `Best available rate in ${currency}; the mark is the median of the latest rate shop`,
        x: 'night',
        y: ['bar_rate'],
        compare: 'comp_median',
        columns: [
          col('night', 'Night', 'text'),
          col('stay_date', 'Stay date', 'date', { hidden: true }),
          col('bar_rate', 'Our rate', 'currency', { unit: currency }),
          col('comp_median', 'Comp set median', 'currency', { unit: currency }),
          col('comps_sold_out', 'Competitors sold out', 'count'),
          col('currency', 'Currency', 'text', { hidden: true }),
        ],
        sources: ['hotel.v_rate_position'],
      };
    },
  },

  /** The account's room nights over the last twelve full months. */
  account_loss: {
    sql: `
      with bd as (select date_trunc('month', hotel.business_date())::date as this_month),
      n as (
        select date_trunc('month', n.stay_date)::date as month, count(*) as room_nights
          from bd, hotel.reservation_nights n
          join hotel.reservations r using (reservation_id)
          join hotel.accounts a using (account_id)
         where n.hotel_code = $1 and a.name = $2
           and n.stay_date >= bd.this_month - interval '12 months' and n.stay_date < bd.this_month
         group by 1)
      select to_char(g.month, 'YYYY-MM-DD') as month, coalesce(n.room_nights, 0)::int as room_nights
        from bd cross join generate_series(bd.this_month - interval '12 months', bd.this_month - interval '1 month', interval '1 month') g(month)
        left join n on n.month = g.month::date
       order by 1`,
    params: (item) => [item.hotel_code, item.facts['account']],
    chart: (item) => ({
      kind: 'bar',
      title: `${item.facts['account']}: room nights a month`,
      subtitle: 'The last twelve full months',
      x: 'month',
      y: ['room_nights'],
      columns: [col('month', 'Month', 'month'), col('room_nights', 'Room nights', 'count')],
      sources: ['hotel.reservation_nights', 'hotel.reservations', 'hotel.accounts'],
    }),
  },

  /** The booking engine's funnel on that device for the last 30 days, a stage per row, with the 30 days before beside it. */
  web_conversion_drop: {
    sql: `
      with bd as (select hotel.business_date() as d),
      w as (
        select sum(w.sessions) filter (where w.date >= bd.d - 30) as s1, sum(w.searches) filter (where w.date >= bd.d - 30) as q1,
               sum(w.checkout_starts) filter (where w.date >= bd.d - 30) as c1, sum(w.bookings) filter (where w.date >= bd.d - 30) as b1,
               sum(w.sessions) filter (where w.date < bd.d - 30) as s0, sum(w.searches) filter (where w.date < bd.d - 30) as q0,
               sum(w.checkout_starts) filter (where w.date < bd.d - 30) as c0, sum(w.bookings) filter (where w.date < bd.d - 30) as b0
          from bd, hotel.web_daily w
         where w.hotel_code = $1 and w.device = $2 and w.date between bd.d - 60 and bd.d - 1),
      stages as (
        select 1 as ord, 'Sessions' as stage, s1 as visits, s0 as visits_before from w
        union all select 2, 'Searches', q1, q0 from w
        union all select 3, 'Checkout starts', c1, c0 from w
        union all select 4, 'Bookings', b1, b0 from w)
      select stage, visits::int as visits, visits_before::int as visits_before,
             round(100.0 * visits / nullif(lag(visits) over (order by ord), 0), 1)::float8 as step_pct,
             round(100.0 * visits_before / nullif(lag(visits_before) over (order by ord), 0), 1)::float8 as step_before_pct
        from stages where visits is not null order by ord`,
    params: (item) => [item.hotel_code, item.facts['device']],
    chart: (item, rows) => {
      const booked = rows.at(-1);
      const step = booked && booked['step_pct'] !== null && booked['step_before_pct'] !== null ? `${booked['step_pct']}% of checkouts ended in a booking, against ${booked['step_before_pct']}% in the 30 days before` : 'The 30 days before are in the table';
      return {
        kind: 'funnel',
        title: `Website funnel on ${item.facts['device']}, last 30 days`,
        subtitle: `${step[0]!.toUpperCase()}${step.slice(1)}`,
        x: 'stage',
        y: ['visits'],
        columns: [
          col('stage', 'Stage', 'text'),
          col('visits', 'Last 30 days', 'count'),
          col('visits_before', '30 days before', 'count'),
          col('step_pct', 'Of the stage before', 'percent'),
          col('step_before_pct', 'Of the stage before, 30 days before', 'percent'),
        ],
        sources: ['hotel.web_daily'],
      };
    },
  },

  /** Hours the workload needed against hours worked, for the last eight whole weeks. */
  staffing_gap: {
    sql: `
      with w as (select date_trunc('week', hotel.business_date())::date as this_week)
      select to_char(date_trunc('week', l.date), 'YYYY-MM-DD') as week,
             round(sum(l.required_hours))::float8 as required_hours, round(sum(l.actual_hours))::float8 as actual_hours
        from w, hotel.labor_daily l
       where l.hotel_code = $1 and l.department = $2 and l.date >= w.this_week - 56 and l.date < w.this_week
       group by 1 order by 1`,
    params: (item) => [item.hotel_code, item.facts['department']],
    chart: (item) => ({
      kind: 'grouped_bar',
      title: `${item.facts['department']}: hours needed against hours worked`,
      subtitle: 'The last eight whole weeks',
      x: 'week',
      y: ['required_hours', 'actual_hours'],
      columns: [col('week', 'Week starting', 'date'), col('required_hours', 'Hours needed', 'number', { unit: 'hours' }), col('actual_hours', 'Hours worked', 'number', { unit: 'hours' })],
      sources: ['hotel.labor_daily'],
    }),
  },

  /** Rooms out of order per day, from two weeks back to eleven weeks ahead. */
  rooms_out_of_order: {
    sql: `
      select to_char(i.date, 'YYYY-MM-DD') as date, i.out_of_order::int as out_of_order
        from hotel.room_inventory_daily i, (select hotel.business_date() as d) bd
       where i.hotel_code = $1 and i.date between bd.d - 14 and bd.d + 75
       order by 1`,
    params: (item) => [item.hotel_code],
    chart: () => ({
      kind: 'calendar_heatmap',
      title: 'Rooms out of order, per day',
      subtitle: 'From two weeks back to eleven weeks ahead',
      x: 'date',
      y: ['out_of_order'],
      columns: [col('date', 'Date', 'date'), col('out_of_order', 'Rooms out of order', 'count')],
      sources: ['hotel.room_inventory_daily'],
    }),
  },

  /** The bridge from budgeted to actual GOP for the month: each revenue line, then all costs together. */
  gop_miss: {
    sql: `
      with x as (
        select p.line,
               sum(p.amount * hotel.eur_rate(p.currency, p.month)) filter (where p.scenario = 'actual') as a,
               sum(p.amount * hotel.eur_rate(p.currency, p.month)) filter (where p.scenario = 'budget') as b
          from hotel.pnl_monthly p
         where p.hotel_code = $1 and p.month = ($2 || '-01')::date and p.scenario in ('actual', 'budget')
         group by 1),
      steps(ord, line, step) as (values (1, 'ROOMS_REVENUE', 'Rooms'), (2, 'FNB_REVENUE', 'F&B'), (3, 'ME_REVENUE', 'Meetings & events'), (4, 'OTHER_REVENUE', 'Other revenue'))
      select 0 as ord, 'Budget GOP' as step, round(b)::float8 as amount_eur, 'total' as kind from x where line = 'GOP'
      union all
      select s.ord, s.step, round(x.a - x.b)::float8, 'change' from steps s join x using (line)
      union all
      select 5, 'Costs', round(-sum(x.a - x.b))::float8, 'change' from x where x.line like '%\\_EXPENSE'
      union all
      -- What the lines above leave unexplained (a budget total that is not split by line), so the bridge adds up.
      select 6, 'Unallocated', round(r.gap)::float8, 'change'
        from (select (select a - b from x where line = 'GOP')
                     - coalesce((select sum(x.a - x.b) from x join steps s using (line)), 0)
                     + coalesce((select sum(x.a - x.b) from x where x.line like '%\\_EXPENSE'), 0) as gap) r
       where abs(r.gap) >= 1
      union all
      select 7, 'Actual GOP', round(a)::float8, 'total' from x where line = 'GOP'
       order by ord`,
    params: (item) => [item.hotel_code, item.facts['month']],
    chart: (item) => ({
      kind: 'waterfall',
      title: 'From budgeted to actual GOP',
      subtitle: `${monthLabel(`${item.facts['month']}-01`)}, in EUR: each revenue line against budget, then all costs together`,
      x: 'step',
      y: ['amount_eur'],
      columns: [col('ord', 'Order', 'id', { hidden: true }), col('step', 'Step', 'text'), col('amount_eur', 'Amount', 'currency', { unit: 'EUR' }), col('kind', 'Kind', 'text', { hidden: true })],
      sources: ['hotel.pnl_monthly'],
    }),
  },

  /** What a stale POS feed leaves out: F&B covers per day, with nothing since the last sync. Other feeds have no chart. */
  data_stale: {
    sql: `
      with bd as (select hotel.business_date() as d)
      select to_char(g.day, 'YYYY-MM-DD') as date, coalesce(sum(f.covers), 0)::int as covers
        from bd cross join generate_series(bd.d - 14, bd.d - 1, interval '1 day') g(day)
        left join hotel.fnb_daily f on f.hotel_code = $1 and f.date = g.day::date
       group by 1 order by 1`,
    params: (item) => [item.hotel_code],
    chart: () => ({
      kind: 'bar',
      title: 'F&B covers received from the POS, per day',
      subtitle: 'The last 14 days; nothing has arrived since the last sync',
      x: 'date',
      y: ['covers'],
      columns: [col('date', 'Date', 'date'), col('covers', 'Covers', 'count')],
      sources: ['hotel.fnb_daily'],
    }),
  },
};

async function chartFor(db: Db, item: BriefItem): Promise<BriefChart | null> {
  const plan = item.kind === 'data_stale' && item.facts['system'] !== 'POS' ? undefined : CHARTS[item.kind];
  if (!plan) return null;
  const rows = await db.query<Row>(plan.sql, plan.params(item));
  // A chart needs something to draw; a finding without rows keeps its text.
  return rows.length >= 2 ? { ...plan.chart(item, rows), rows } : null;
}

export interface OverviewInput {
  /** Hotel codes of the scope; none, or an empty list, is the whole group. */
  hotels?: readonly string[];
  /** Today's brief findings (any scope): the ones in scope get a chart. */
  items?: readonly BriefItem[];
}

/** Reads every part in parallel. A part that fails is null and named in `failed`; the cause goes to the logs. */
export async function briefOverview(db: Db, input: OverviewInput = {}): Promise<BriefOverview> {
  const codes = [...(input.hotels ?? [])];
  const hotels = codes.length ? codes : null;
  const items = (input.items ?? []).filter((item) => !hotels || hotels.includes(item.hotel_code));
  const failed: string[] = [];
  const part = async <T>(name: string, read: () => Promise<T>): Promise<T | null> => {
    try {
      return await read();
    } catch (error) {
      console.error(`brief overview: ${name} failed`, error);
      failed.push(name);
      return null;
    }
  };

  const dates = await db.query<Dates>(DATES_SQL).then(
    (rows) => rows[0] ?? null,
    (error: unknown) => {
      console.error('brief overview: dates failed', error);
      return null;
    },
  );
  const read = <T>(name: string, run: (dates: Dates) => Promise<T>) => part(name, () => (dates ? run(dates) : Promise.reject(new Error('no business date'))));

  const [pulseTiles, nightRows, pickupRows, moneyRows, health, ...charts] = await Promise.all([
    read('pulse', (d) => pulse(db, hotels, d)),
    read('nights', (d) => nights(db, hotels, d)),
    read('pickup', (d) => pickup(db, hotels, d)),
    read('money', (d) => money(db, hotels, d)),
    read('health', () => db.query<BriefFeed>(HEALTH_SQL, [hotels])),
    ...items.map((item) => read(`chart:${item.id}`, () => chartFor(db, item))),
  ]);

  // `failed` fills in the order the parts settle; report it in the order of the page.
  const order = ['pulse', 'nights', 'pickup', 'money', 'health', ...items.map((item) => `chart:${item.id}`)];
  return {
    businessDate: dates?.today ?? '',
    hotels: codes,
    pulse: pulseTiles,
    nights: nightRows,
    pickup: pickupRows,
    money: moneyRows,
    health,
    charts: Object.fromEntries(items.flatMap((item, i) => (charts[i] ? [[item.id, charts[i]]] : []))),
    failed: order.filter((name) => failed.includes(name)),
  };
}

/**
 * A minute of memory per scope: the page asks again on every visit and every change of scope, and the answer only
 * changes when the data does. Callers that arrive together share one read; a failed read is not kept.
 */
export class OverviewCache<T> {
  readonly #entries = new Map<string, { at: number; value: Promise<T> }>();
  readonly #ttlMs: number;
  readonly #max: number;
  readonly #now: () => number;

  constructor(ttlMs = 60_000, max = 64, now: () => number = Date.now) {
    this.#ttlMs = ttlMs;
    this.#max = max;
    this.#now = now;
  }

  get size(): number {
    return this.#entries.size;
  }

  /** `version` names what the answer was built from (the brief's `generatedAt`): a new brief is a new answer. */
  get(hotels: readonly string[], version: string, load: () => Promise<T>): Promise<T> {
    const key = `${version}|${[...hotels].sort().join(',')}`;
    const hit = this.#entries.get(key);
    if (hit && this.#now() - hit.at < this.#ttlMs) return hit.value;
    const value = load();
    this.#entries.delete(key);
    this.#entries.set(key, { at: this.#now(), value });
    value.catch(() => {
      if (this.#entries.get(key)?.value === value) this.#entries.delete(key);
    });
    // The oldest entry goes first: a Map keeps insertion order.
    while (this.#entries.size > this.#max) this.#entries.delete(this.#entries.keys().next().value!);
    return value;
  }
}
