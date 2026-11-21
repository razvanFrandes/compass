import type { BriefItem, DataResult, Evidence, HotelRef, MetricDefinition, MetricQuery, MetricQueryInput, MetricRow } from '@compass/contracts';
import { METRICS, metricByKey } from '../domain/metrics.ts';
import { err, ok, type Result } from '../domain/result.ts';
import { guardReadOnlySql, type GuardReason } from '../domain/sql-guard.ts';
import { detectBriefItems } from './brief-detectors.ts';
import { FinanceData } from './finance-data.ts';
import type { Db, Embedder } from './ports.ts';
import { findReviews, type FindReviewsInput, type ReviewMatch } from './review-search.ts';

export type DataError =
  | { kind: 'invalid'; message: string }
  | { kind: 'rejected'; reason: GuardReason; message: string }
  /** Postgres refused a model-written query (run_readonly_query only, SQL errors only): the message helps the model fix its SQL. */
  | { kind: 'database'; message: string }
  /** A part of the service is down. `message` is written for the reader; `cause` is for the logs only. */
  | { kind: 'unavailable'; message: string; cause: unknown }
  /** The database failed under a governed tool. `cause` may name hosts or connection details: for the logs only. */
  | { kind: 'internal'; cause: unknown };

export interface Hotel {
  hotel_code: string;
  name: string;
  brand: string;
  city: string;
  country: string;
  region: string;
  currency: string;
  rooms: number;
  meeting_space_sqm: number;
}

export interface KpisInput {
  hotels?: string[];
  region?: string;
  by?: 'hotel' | 'region' | 'brand' | 'group';
  from: string;
  to: string;
}

/** One row of getKpis. `region` and the comp set indices are there only per hotel. */
export interface KpiRow {
  key: string;
  region?: string;
  occupancy_pct: number | null;
  occupancy_ly_pct: number | null;
  adr_eur: number | null;
  adr_ly_eur: number | null;
  revpar_eur: number | null;
  revpar_ly_eur: number | null;
  room_revenue_eur: number | null;
  room_revenue_ly_eur: number | null;
  rooms_sold: number | null;
  rooms_sold_ly: number | null;
  mpi?: number | null;
  ari?: number | null;
  rgi?: number | null;
}

export interface PaceInput {
  hotels?: string[];
  daysAhead?: number;
  /** Only these stay dates. */
  from?: string;
  to?: string;
  grain?: 'total' | 'day';
}
export interface PaceRow {
  hotel_code: string;
  rooms_otb: number;
  rooms_otb_stly: number;
  pace_pct: number;
  revenue_otb: number;
  revenue_otb_stly: number;
}
export interface PaceNightRow {
  hotel_code: string;
  stay_date: string;
  rooms_otb: number;
  rooms_otb_stly: number;
}

export interface RatePositionInput {
  hotels?: string[];
  from?: string;
  to?: string;
  grain?: 'night' | 'total';
}
export interface RatePositionRow {
  hotel_code: string;
  stay_date: string;
  bar_rate: number;
  comp_median: number;
  bar_vs_comp: number;
  comps_sold_out: number;
  occupancy_otb_pct: number | null;
}
export interface RatePositionTotalRow {
  hotel_code: string;
  nights: number;
  bar_rate: number;
  comp_median: number;
  bar_vs_comp: number;
  occupancy_otb_pct: number | null;
}

export interface ChannelMixInput {
  hotels?: string[];
  from: string;
  to: string;
  shape?: 'hotel' | 'total' | 'flows';
}
/** `hotel_code` is there only in the per-hotel shape. */
export interface ChannelMixRow {
  hotel_code?: string;
  channel: string;
  channel_type: string;
  room_nights: number;
  gross_revenue_eur: number;
  commission_eur: number;
  net_revenue_eur: number;
  /** Commission ÷ gross revenue of the channel, in %. */
  commission_pct: number | null;
}
/** The totals over every channel of a rolled-up result, as SQL returns them on each row. */
interface ChannelTotals {
  total_gross_eur: number;
  total_commission_eur: number;
  total_net_eur: number;
  total_commission_pct: number | null;
}
export interface ChannelFlowRow {
  channel: string;
  lands_in: 'Net revenue' | 'Commission';
  amount_eur: number;
}

/** `hotel_code` is absent when the mix is rolled up over the hotels. */
export interface MixRow {
  period: string;
  hotel_code?: string;
  key: string;
  room_nights: number;
  share_pct: number;
  revenue_eur: number;
  adr_eur: number;
}

const MAX_ROWS = 200;

/**
 * SQLSTATE classes that describe the statement itself: 0A feature not supported, 21 cardinality violation, 22 data
 * exception, 23 integrity constraint, 25 invalid transaction state (a write in a read-only transaction), 2B dependent
 * privileges, 42 syntax error or access rule violation, 54 program limit exceeded.
 */
const STATEMENT_CLASSES = new Set(['0A', '21', '22', '23', '25', '2B', '42', '54']);
const STATEMENT_TIMEOUT = '57014';

/**
 * Whether Postgres refused the statement for a reason the model can fix in its SQL. Everything else is not about
 * the query and may name hosts, roles or databases: driver and network errors without a SQLSTATE (CONNECTION_CLOSED,
 * ECONNREFUSED, Hyperdrive), and server errors about the connection or the server's state (08 connection, 28 login,
 * 3D database, 53 resources, 57P shutdown or startup). The client connects lazily, so those land on a query too.
 */
function isSqlError(error: unknown): error is Error & { code: string } {
  const code = error instanceof Error ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' && code.length === 5 && (STATEMENT_CLASSES.has(code.slice(0, 2)) || code === STATEMENT_TIMEOUT);
}

/** Bucket size for time series; `total` gives one row for the whole period. */
export type Bucket = 'day' | 'week' | 'month' | 'total';

/** SQL for a period column. `grain` is a closed union, so interpolating it is safe. */
function period(grain: Bucket, column: string, fromParam: string): string {
  return grain === 'total' ? `${fromParam}::date` : `date_trunc('${grain}', ${column})::date`;
}

const SCHEMA_NOTES = `Helpers (the definitions live in SQL; prefer them to re-deriving metrics):
- hotel.v_hotel_day: occupancy, ADR, RevPAR per hotel and day, local currency plus room_revenue_eur; is_actual = before the business date.
- hotel.v_comp_set_index: MPI, ARI, RGI per hotel and day (actuals only).
- hotel.v_channel_month: gross revenue, commission and net revenue by channel and month (local currency).
- hotel.v_rate_position: BAR vs comp set median per future night.
- hotel.otb_as_of(as_of date, p_hotel text, stay_from date, stay_to date): what was on the books on a past day. Always pass a stay range.
- hotel.pace_vs_stly(p_hotel text, days_ahead int): on the books now vs the same time last year.
- hotel.eur_rate(currency, date): EUR per unit of a currency. hotel.business_date(): today in the data.
Rules: money is in each hotel's local currency unless a column ends in _eur; convert with eur_rate() before comparing hotels.
Ratios come from sums (sum(rooms_sold) / sum(rooms_available)), never from averaging daily ratios. Same time last year = date - 364.`;

/** SQL aggregate per metric. `d` is hotel.v_hotel_day; `c` is hotel.comp_set_daily (joined for indices). */
const METRIC_SQL: Record<MetricQuery['metric'], string> = {
  occupancy: 'round(100.0 * sum(d.rooms_sold) / nullif(sum(d.rooms_available), 0), 1)',
  adr: 'round(sum(d.room_revenue_eur) / nullif(sum(d.rooms_sold), 0), 2)',
  revpar: 'round(sum(d.room_revenue_eur) / nullif(sum(d.rooms_available), 0), 2)',
  room_revenue: 'round(sum(d.room_revenue_eur), 0)',
  rooms_sold: 'sum(d.rooms_sold)',
  mpi: `round(100.0 * (sum(d.rooms_sold)::numeric / nullif(sum(d.rooms_available), 0))
               / nullif(sum(c.rooms_sold)::numeric / nullif(sum(c.rooms_available), 0), 0), 1)`,
  ari: `round(100.0 * (sum(d.room_revenue) / nullif(sum(d.rooms_sold), 0))
               / nullif(sum(c.room_revenue) / nullif(sum(c.rooms_sold), 0), 0), 1)`,
  rgi: `round(100.0 * (sum(d.room_revenue) / nullif(sum(d.rooms_available), 0))
               / nullif(sum(c.room_revenue) / nullif(sum(c.rooms_available), 0), 0), 1)`,
};
const COMP_SET_METRICS = new Set(['mpi', 'ari', 'rgi']);

/**
 * Application service over the Halcyon database: governed metrics, the planted-story lenses
 * (pickup, pace, rate position, channel mix, data health) and a guarded escape hatch for custom SQL.
 * Every method returns rows plus the evidence of how they were computed.
 */
export class HotelData {
  #businessDate: Promise<string> | undefined;
  #finance: FinanceData | undefined;

  private readonly db: Db;
  /** Embeds questions for semantic review search. Optional: without it, find_reviews reports that it is unavailable. */
  private readonly embedder: Embedder | undefined;

  constructor(db: Db, embedder?: Embedder) {
    this.db = db;
    this.embedder = embedder;
  }

  businessDate(): Promise<string> {
    this.#businessDate ??= this.db
      .query<{ d: string }>(`select to_char(hotel.business_date(), 'YYYY-MM-DD') as d`)
      .then((rows) => rows[0]!.d);
    return this.#businessDate;
  }

  /** The Finance, M&E, forecast and lost-business lenses (application/finance-data.ts). */
  get finance(): FinanceData {
    this.#finance ??= new FinanceData(this.db, () => this.businessDate());
    return this.#finance;
  }

  /** The hotels of the group, or only those of a hotel scope. */
  async listHotels(hotels?: readonly string[]): Promise<DataResult<Hotel>> {
    const sql = `select h.hotel_code, h.name, b.name as brand, h.city, h.country, h.region, h.currency, h.rooms,
                        h.meeting_space_sqm
                   from hotel.hotels h join hotel.brands b using (brand_code)
                  where $1::text[] is null or h.hotel_code = any($1::text[])
                  order by h.region, h.hotel_code`;
    return this.#run(sql, [hotels?.length ? hotels : null], { sources: ['hotel.hotels', 'hotel.brands'] });
  }

  /** The hotel directory for the app (`GET /api/hotels`) and for naming the hotels of a scope. */
  async hotelRefs(): Promise<Result<HotelRef[], DataError>> {
    try {
      const { rows } = await this.listHotels();
      return ok(rows.map((h) => ({ code: h.hotel_code, name: h.name, city: h.city, country: h.country, region: h.region, brand: h.brand, rooms: h.rooms })));
    } catch (error) {
      return err({ kind: 'internal', cause: error });
    }
  }

  listMetrics(): { rows: MetricDefinition[] } {
    return { rows: [...METRICS] };
  }

  async getMetric(input: MetricQueryInput): Promise<Result<DataResult<MetricRow>, DataError>> {
    const query: MetricQuery = { ...input, by: input.by ?? 'hotel', grain: input.grain ?? 'month', compare: input.compare ?? 'none' };
    if (query.from > query.to) return err({ kind: 'invalid', message: '`from` must be on or before `to`.' });
    const def = metricByKey(query.metric);
    const expr = METRIC_SQL[query.metric];
    const level = query.by;
    if (COMP_SET_METRICS.has(query.metric) && level !== 'hotel') {
      return err({ kind: 'invalid', message: `${def.label} compares local-currency rates with each hotel's own comp set, so it is per hotel only. Use by: "hotel".` });
    }
    const keyExpr = { hotel: 'd.hotel_code', region: 'h.region', brand: 'b.name', group: "'Halcyon group'" }[level];
    const join = COMP_SET_METRICS.has(query.metric)
      ? 'join hotel.comp_set_daily c on c.hotel_code = d.hotel_code and c.date = d.date'
      : '';
    // $1 from, $2 to, $3 hotels (null = all); SHIFT is 0 for the period itself and 364 for STLY (weekdays line up)
    const window = `
      select to_char(${period(query.grain, 'd.date + SHIFT', '$1')}, 'YYYY-MM-DD') as period, ${keyExpr} as key, ${expr}::float8 as value
        from hotel.v_hotel_day d join hotel.hotels h on h.hotel_code = d.hotel_code join hotel.brands b on b.brand_code = h.brand_code ${join}
       where d.date between $1::date - SHIFT and $2::date - SHIFT
         and ($3::text[] is null or d.hotel_code = any($3::text[]))
       group by 1, 2`;
    const sql =
      query.compare === 'stly'
        ? `with cur as (${window.replaceAll('SHIFT', '0')}), ly as (${window.replaceAll('SHIFT', '364')})
           select cur.period, cur.key, cur.value, ly.value as compare_value,
                  round((cur.value - ly.value)::numeric, 2)::float8 as change,
                  round((100.0 * (cur.value - ly.value) / nullif(ly.value, 0))::numeric, 1)::float8 as change_pct
             from cur left join ly using (period, key) order by 1, 2`
        : `${window.replaceAll('SHIFT', '0')} order by 1, 2`;
    const params = [query.from, query.to, query.hotels?.length ? query.hotels : null];
    const notes = [
      'Stay dates on or after the business date are on the books, not actuals.',
      ...(level !== 'hotel' ? [`Rolled up by ${level} from sums over its hotels (money in EUR), not by averaging hotel ratios.`] : []),
      ...(query.compare === 'stly'
        ? ['Last year is the same period shifted back 364 days, so weekdays line up. The change is this year against last year.']
        : []),
      ...(join ? ['The comp set benchmark covers actuals only (stay dates before the business date). For future nights use the rate position.'] : []),
    ];
    return this.#tryRun<MetricRow>(sql, params, {
      sources: [def.source === 'hotel.comp_set_daily' ? 'hotel.v_hotel_day' : def.source, ...(join ? ['hotel.comp_set_daily'] : [])],
      definitions: { [def.key]: def.definition },
      period: { from: query.from, to: query.to },
      notes,
    });
  }

  /**
   * The headline figures of a period in one row per hotel, region, brand or the group: occupancy, ADR, RevPAR, room
   * revenue and rooms sold, each next to the same period last year. Per hotel the row also says its region and its
   * comp set indices. The expressions are the governed ones of getMetric (METRIC_SQL), so the numbers are the same.
   */
  async getKpis(input: KpisInput): Promise<Result<DataResult<KpiRow>, DataError>> {
    if (input.from > input.to) return err({ kind: 'invalid', message: '`from` must be on or before `to`.' });
    const level = input.by ?? 'hotel';
    const perHotel = level === 'hotel';
    const keyExpr = { hotel: 'd.hotel_code', region: 'h.region', brand: 'b.name', group: "'Halcyon group'" }[level];
    // $1 from, $2 to, $3 hotels (null = all), $4 region (null = all); SHIFT is 0 for the period and 364 for last year.
    const where = `($3::text[] is null or d.hotel_code = any($3::text[])) and ($4::text is null or h.region = $4)`;
    const window = `
      select ${keyExpr} as key${perHotel ? ', max(h.region) as region' : ''},
             ${METRIC_SQL.occupancy}::float8 as occupancy, ${METRIC_SQL.adr}::float8 as adr, ${METRIC_SQL.revpar}::float8 as revpar,
             ${METRIC_SQL.room_revenue}::float8 as room_revenue, ${METRIC_SQL.rooms_sold}::float8 as rooms_sold
        from hotel.v_hotel_day d join hotel.hotels h on h.hotel_code = d.hotel_code join hotel.brands b on b.brand_code = h.brand_code
       where d.date between $1::date - SHIFT and $2::date - SHIFT and ${where}
       group by 1`;
    const indices = `
      select d.hotel_code as key, ${METRIC_SQL.mpi}::float8 as mpi, ${METRIC_SQL.ari}::float8 as ari, ${METRIC_SQL.rgi}::float8 as rgi
        from hotel.v_hotel_day d join hotel.hotels h on h.hotel_code = d.hotel_code
        join hotel.comp_set_daily c on c.hotel_code = d.hotel_code and c.date = d.date
       where d.date between $1::date and $2::date and ${where}
       group by 1`;
    const sql = `
      with cur as (${window.replaceAll('SHIFT', '0')}), ly as (${window.replaceAll('SHIFT', '364')})${perHotel ? `, idx as (${indices})` : ''}
      select cur.key${perHotel ? ', cur.region' : ''},
             cur.occupancy as occupancy_pct, ly.occupancy as occupancy_ly_pct, cur.adr as adr_eur, ly.adr as adr_ly_eur,
             cur.revpar as revpar_eur, ly.revpar as revpar_ly_eur, cur.room_revenue as room_revenue_eur, ly.room_revenue as room_revenue_ly_eur,
             cur.rooms_sold, ly.rooms_sold as rooms_sold_ly${perHotel ? ', idx.mpi, idx.ari, idx.rgi' : ''}
        from cur left join ly using (key)${perHotel ? ' left join idx using (key)' : ''}
       order by 1`;
    const definitions = Object.fromEntries(
      (['occupancy', 'adr', 'revpar', 'room_revenue', 'rooms_sold', ...(perHotel ? (['mpi', 'ari', 'rgi'] as const) : [])] as const).map((key) => [key, metricByKey(key).definition]),
    );
    return this.#tryRun<KpiRow>(sql, [input.from, input.to, input.hotels?.length ? input.hotels : null, input.region ?? null], {
      sources: ['hotel.v_hotel_day', ...(perHotel ? ['hotel.comp_set_daily'] : [])],
      definitions,
      period: { from: input.from, to: input.to },
      notes: [
        'Stay dates on or after the business date are on the books, not actuals.',
        'The _ly columns are the same period last year, shifted 364 days so weekdays line up.',
        ...(perHotel
          ? ['MPI, ARI and RGI cover actuals only (stay dates before the business date); they are empty for a period in the future.']
          : [`Rolled up by ${level} from sums over its hotels (money in EUR), not by averaging hotel ratios.`]),
      ],
    });
  }

  /** On-the-books change over the last `daysBack` days for the next `horizonDays` nights, as a share of capacity. */
  async getPickup(input: { hotels?: string[]; region?: string; daysBack?: number; horizonDays?: number }) {
    const sql = `
      with bd as (select hotel.business_date() as d),
      now_ as (select o.* from bd, hotel.otb_as_of(bd.d, null, bd.d, bd.d + $2::int) o),
      before as (select o.* from bd, hotel.otb_as_of(bd.d - $1::int, null, bd.d, bd.d + $2::int) o),
      nights as (select i.hotel_code, i.date, i.rooms_available from hotel.room_inventory_daily i, bd
                  where i.date between bd.d and bd.d + $2::int)
      select n.hotel_code,
             sum(coalesce(a.rooms_on_books, 0) - coalesce(b.rooms_on_books, 0))::int as rooms_picked_up,
             round(sum(coalesce(a.rooms_on_books, 0) - coalesce(b.rooms_on_books, 0))::numeric
                   / sum(n.rooms_available), 4)::float8 as pickup_pct
        from nights n
        left join now_ a on a.hotel_code = n.hotel_code and a.stay_date = n.date
        left join before b on b.hotel_code = n.hotel_code and b.stay_date = n.date
        join hotel.hotels h on h.hotel_code = n.hotel_code
       where ($3::text[] is null or n.hotel_code = any($3::text[])) and ($4::text is null or h.region = $4)
       group by 1 order by 1`;
    const daysBack = input.daysBack ?? 21;
    const horizon = input.horizonDays ?? 44;
    return this.#run<{ hotel_code: string; rooms_picked_up: number; pickup_pct: number }>(
      sql,
      [daysBack, horizon, input.hotels?.length ? input.hotels : null, input.region ?? null],
      {
        sources: ['hotel.otb_as_of()', 'hotel.room_inventory_daily'],
        definitions: {
          pickup: `Rooms added to the books in the last ${daysBack} days for the next ${horizon} nights, ÷ rooms available in those nights.`,
        },
      },
    );
  }

  /**
   * On the books now vs the same time last year: per hotel for the next `daysAhead` nights, or only for the stay
   * dates `from`–`to` (the window is widened to reach `to`). Grain day gives the same night by night: the pace curve.
   */
  getPace(input: PaceInput & { grain: 'day' }): Promise<DataResult<PaceNightRow>>;
  getPace(input: PaceInput & { grain?: 'total' }): Promise<DataResult<PaceRow>>;
  getPace(input: PaceInput): Promise<DataResult<PaceRow | PaceNightRow>>;
  async getPace(input: PaceInput): Promise<DataResult<PaceRow | PaceNightRow>> {
    // $1 days ahead, $2 hotels, $3 from, $4 to. The function reads the next N nights, so N reaches `to` when one is given.
    const from = `
        from hotel.pace_vs_stly(null, greatest($1::int, coalesce($4::date - hotel.business_date(), 0)))
       where ($2::text[] is null or hotel_code = any($2::text[]))
         and ($3::date is null or stay_date >= $3::date) and ($4::date is null or stay_date <= $4::date)`;
    const sql =
      input.grain === 'day'
        ? `
      select hotel_code, to_char(stay_date, 'YYYY-MM-DD') as stay_date, rooms_otb::int, rooms_otb_stly::int${from}
       order by 1, 2`
        : `
      select hotel_code, sum(rooms_otb)::int as rooms_otb, sum(rooms_otb_stly)::int as rooms_otb_stly,
             round(100.0 * (sum(rooms_otb) - sum(rooms_otb_stly)) / nullif(sum(rooms_otb_stly), 0), 1)::float8 as pace_pct,
             round(sum(revenue_otb), 0)::float8 as revenue_otb, round(sum(revenue_otb_stly), 0)::float8 as revenue_otb_stly${from}
       group by 1 order by 1`;
    const days = input.daysAhead ?? 90;
    const window = input.from || input.to ? `stay dates ${input.from ?? 'from the business date'} to ${input.to ?? `${days} nights ahead`}` : `the next ${days} nights`;
    return this.#run<PaceRow | PaceNightRow>(sql, [days, input.hotels?.length ? input.hotels : null, input.from ?? null, input.to ?? null], {
      sources: ['hotel.pace_vs_stly()'],
      definitions: {
        pace: `Room nights on the books for ${window} vs on the books at the same time last year (364 days earlier). Revenue in local currency.`,
      },
      period: input.from && input.to ? { from: input.from, to: input.to } : null,
    });
  }

  /**
   * Our BAR against the comp set median of the latest rate shop, with the occupancy on the books: per future night,
   * or (grain total) one row per hotel for the whole window.
   */
  getRatePosition(input: RatePositionInput & { grain: 'total' }): Promise<DataResult<RatePositionTotalRow>>;
  getRatePosition(input: RatePositionInput & { grain?: 'night' }): Promise<DataResult<RatePositionRow>>;
  getRatePosition(input: RatePositionInput): Promise<DataResult<RatePositionRow | RatePositionTotalRow>>;
  async getRatePosition(input: RatePositionInput): Promise<DataResult<RatePositionRow | RatePositionTotalRow>> {
    // v_hotel_day holds what is on the books for a future night, so the same join gives demand next to price.
    const from = `
        from hotel.v_rate_position r
        left join hotel.v_hotel_day d on d.hotel_code = r.hotel_code and d.date = r.stay_date
       where ($1::text[] is null or r.hotel_code = any($1::text[]))
         and ($2::date is null or r.stay_date >= $2::date) and ($3::date is null or r.stay_date <= $3::date)`;
    const sql =
      input.grain === 'total'
        ? `
      select r.hotel_code, count(*)::int as nights, round(avg(r.bar_rate)::numeric, 2)::float8 as bar_rate,
             round(avg(r.comp_median)::numeric, 2)::float8 as comp_median,
             round((sum(r.bar_rate) / nullif(sum(r.comp_median), 0))::numeric, 2)::float8 as bar_vs_comp,
             round(100.0 * sum(d.rooms_sold) / nullif(sum(d.rooms_available), 0), 1)::float8 as occupancy_otb_pct${from}
         and r.comp_median is not null
       group by r.hotel_code order by r.hotel_code`
        : `
      select r.hotel_code, to_char(r.stay_date, 'YYYY-MM-DD') as stay_date, r.bar_rate::float8,
             round(r.comp_median::numeric, 2)::float8 as comp_median, r.bar_vs_comp::float8, r.comps_sold_out::int,
             round(100.0 * d.rooms_sold / nullif(d.rooms_available, 0), 1)::float8 as occupancy_otb_pct${from}
       order by r.hotel_code, r.stay_date`;
    return this.#run<RatePositionRow | RatePositionTotalRow>(sql, [input.hotels?.length ? input.hotels : null, input.from ?? null, input.to ?? null], {
      sources: ['hotel.v_rate_position', 'hotel.v_hotel_day'],
      definitions: {
        bar_vs_comp: 'Our best available rate ÷ the comp set median from the latest rate shop. 1.00 is at the median.',
        occupancy_otb: 'Rooms on the books for the night ÷ rooms available, in %.',
      },
      period: input.from && input.to ? { from: input.from, to: input.to } : null,
      notes:
        input.grain === 'total'
          ? ['One row per hotel for the whole window, over the nights the rate shop has a comp set median for: the rates are averages over those nights, and bar_vs_comp is the sum of our rates ÷ the sum of the medians.']
          : [],
    });
  }

  /**
   * Gross revenue, commission and net revenue by channel, in EUR: per hotel, summed over the hotels (shape total), or
   * as flows from each channel to net revenue and to commission (shape flows, what a sankey draws).
   */
  getChannelMix(input: ChannelMixInput & { shape: 'flows' }): Promise<DataResult<ChannelFlowRow>>;
  getChannelMix(input: ChannelMixInput & { shape?: 'hotel' | 'total' }): Promise<DataResult<ChannelMixRow>>;
  getChannelMix(input: ChannelMixInput): Promise<DataResult<ChannelMixRow | ChannelFlowRow>>;
  async getChannelMix(input: ChannelMixInput): Promise<DataResult<ChannelMixRow | ChannelFlowRow>> {
    const shape = input.shape ?? 'hotel';
    const eur = (column: string) => `sum(v.${column} * hotel.eur_rate(h.currency, v.month))`;
    // Over all the channels of the result, on every row: read once below and said in a note, so that the reader of the
    // rows (a model above all) never adds the channels up itself.
    const totals = `,
             round(sum(${eur('gross_revenue')}) over (), 0)::float8 as total_gross_eur,
             round(sum(${eur('commission')}) over (), 0)::float8 as total_commission_eur,
             round(sum(${eur('net_revenue')}) over (), 0)::float8 as total_net_eur,
             round(100 * sum(${eur('commission')}) over () / nullif(sum(${eur('gross_revenue')}) over (), 0), 1)::float8 as total_commission_pct`;
    // Each hotel's month is converted to EUR before anything is summed.
    const channels = (perHotel: boolean) => `
      select ${perHotel ? 'v.hotel_code, ' : ''}ch.name as channel, v.channel_type, sum(v.room_nights)::int as room_nights,
             round(${eur('gross_revenue')}, 0)::float8 as gross_revenue_eur,
             round(${eur('commission')}, 0)::float8 as commission_eur,
             round(${eur('net_revenue')}, 0)::float8 as net_revenue_eur,
             round(100 * ${eur('commission')} / nullif(${eur('gross_revenue')}, 0), 1)::float8 as commission_pct${perHotel ? '' : totals}
        from hotel.v_channel_month v join hotel.hotels h using (hotel_code) join hotel.channels ch on ch.channel = v.channel
       where v.month between date_trunc('month', $1::date) and $2::date
         and ($3::text[] is null or v.hotel_code = any($3::text[]))
       group by ${perHotel ? '1, 2, 3' : '1, 2'}`;
    const sql =
      shape === 'flows'
        ? `with c as (${channels(false)})
      select c.channel, f.lands_in, f.amount_eur, c.total_gross_eur, c.total_commission_eur, c.total_net_eur, c.total_commission_pct
        from c cross join lateral (values ('Net revenue', c.net_revenue_eur), ('Commission', c.commission_eur)) f(lands_in, amount_eur)
       where f.amount_eur > 0
       order by c.net_revenue_eur desc, c.channel, f.lands_in desc`
        : shape === 'total'
          ? `${channels(false)} order by net_revenue_eur desc`
          : `${channels(true)} order by 1, net_revenue_eur desc`;
    const result = await this.#run<(ChannelMixRow | ChannelFlowRow) & Partial<ChannelTotals>>(sql, [input.from, input.to, input.hotels?.length ? input.hotels : null], {
      sources: ['hotel.v_channel_month', 'hotel.channels'],
      definitions: {
        net_revenue: 'Room revenue after channel commission and GDS fees, in EUR.',
        ...(shape === 'flows' ? {} : { commission_pct: 'Commission and fees ÷ gross room revenue of the channel, in %.' }),
      },
      period: { from: input.from, to: input.to },
      notes:
        shape === 'flows'
          ? ['Each channel\'s gross room revenue, split into what the hotel keeps (Net revenue) and what the channel takes (Commission), summed over the hotels asked for.']
          : shape === 'total'
            ? ['Summed over the hotels asked for, after converting each to EUR.']
            : [],
    });
    if (shape === 'hotel') return result;
    // The totals leave the rows (a widget draws the channels, not a total next to them) and become a note.
    const first = result.rows[0];
    const rows = result.rows.map(({ total_gross_eur: _g, total_commission_eur: _c, total_net_eur: _n, total_commission_pct: _p, ...row }) => row as ChannelMixRow | ChannelFlowRow);
    const eurText = (value: number | undefined) => `${(value ?? 0).toLocaleString('en-US')} EUR`;
    const note = first
      ? [
          `Totals over these channels, computed in the same query: gross revenue ${eurText(first.total_gross_eur)}, commission ${eurText(first.total_commission_eur)} ` +
            `(${first.total_commission_pct ?? 0}% of gross), net revenue ${eurText(first.total_net_eur)}. Quote these; do not add the rows up.`,
        ]
      : [];
    return { rows, evidence: { ...result.evidence, notes: [...result.evidence.notes, ...note] } };
  }

  /** Last sync and status of every source system. */
  async getDataHealth(input: { hotels?: string[] }) {
    const sql = `
      select hotel_code, system, vendor, connection, to_char(last_sync_at, 'YYYY-MM-DD HH24:MI') as last_sync_at, status
        from hotel.data_sources
       where $1::text[] is null or hotel_code = any($1::text[])
       order by (status = 'ok'), hotel_code, system`;
    return this.#run<{ hotel_code: string; system: string; vendor: string; connection: string; last_sync_at: string; status: string }>(
      sql,
      [input.hotels?.length ? input.hotels : null],
      { sources: ['hotel.data_sources'] },
    );
  }

  /** Room nights and revenue by segment, channel or channel type, with each key's share of room nights. */
  async getMix(input: {
    hotels?: string[];
    from: string;
    to: string;
    grain?: Bucket;
    by: 'segment' | 'channel' | 'channel_type';
    basis?: 'stay' | 'booked';
    /** One row per period and key, summed over the hotels, instead of one per hotel. */
    rollUp?: boolean;
  }): Promise<DataResult<MixRow>> {
    const grain = input.grain ?? 'month';
    const booked = input.basis === 'booked';
    const dateColumn = booked ? 'r.created_at::date' : 'n.stay_date';
    // Names, never codes: "Transient retail", not RET; "Booking.com", not BDC. A reader (and the model) sees these.
    const key = { segment: 's.name', channel: 'c.name', channel_type: 'c.channel_type' }[input.by];
    const perHotel = `
      with x as (
        select ${period(grain, dateColumn, '$1')} as period, n.hotel_code, ${key} as key,
               count(*) as room_nights, sum(n.room_revenue) as revenue
          from hotel.reservation_nights n
          join hotel.reservations r using (reservation_id)
          join hotel.channels c on c.channel = r.channel
          join hotel.segments s on s.segment = r.segment
         where ${dateColumn} between $1::date and $2::date and ($3::text[] is null or n.hotel_code = any($3::text[]))
         group by 1, 2, 3)`;
    const sql = input.rollUp
      ? `${perHotel},
      r as (
        select x.period, x.key, sum(x.room_nights) as room_nights, sum(x.revenue * hotel.eur_rate(h.currency, x.period)) as revenue_eur
          from x join hotel.hotels h using (hotel_code)
         group by 1, 2)
      select to_char(r.period, 'YYYY-MM-DD') as period, r.key, r.room_nights::int,
             round(100.0 * r.room_nights / sum(r.room_nights) over (partition by r.period), 1)::float8 as share_pct,
             round(r.revenue_eur, 0)::float8 as revenue_eur, round(r.revenue_eur / r.room_nights, 2)::float8 as adr_eur
        from r
       order by 1, r.room_nights desc`
      : `${perHotel}
      select to_char(x.period, 'YYYY-MM-DD') as period, x.hotel_code, x.key, x.room_nights::int,
             round(100.0 * x.room_nights / sum(x.room_nights) over (partition by x.period, x.hotel_code), 1)::float8 as share_pct,
             round(x.revenue * hotel.eur_rate(h.currency, x.period), 0)::float8 as revenue_eur,
             round(x.revenue * hotel.eur_rate(h.currency, x.period) / x.room_nights, 2)::float8 as adr_eur
        from x join hotel.hotels h using (hotel_code)
       order by 1, 2, x.room_nights desc`;
    return this.#run<MixRow>(
      sql,
      [input.from, input.to, input.hotels?.length ? input.hotels : null],
      {
        sources: ['hotel.reservation_nights', 'hotel.reservations', 'hotel.channels', 'hotel.segments'],
        definitions: {
          share_pct: `Share of the hotel's room nights in the period by ${input.by}.`,
        },
        period: { from: input.from, to: input.to },
        notes: [
          booked
            ? 'Basis "booked": room nights of reservations made in the period (by booking date), whatever their stay dates. Shows where new demand comes from now.'
            : 'Basis "stay": room nights staying in the period.',
          'Cancelled and no-show reservations have no stay nights, so they are excluded. Revenue converted to EUR at the rate of the period start.',
        ],
      },
    );
  }

  /** Room nights per company account in the period vs the period of the same length just before it. */
  async getAccountProduction(input: { hotels?: string[]; from: string; to: string; limit?: number; sort?: 'decline' | 'volume' }) {
    const sql = `
      with bounds as (select $1::date as f, $2::date as t, $2::date - $1::date + 1 as len),
      x as (
        select n.hotel_code, a.name as account, a.account_type,
               count(*) filter (where n.stay_date between b.f and b.t) as room_nights,
               count(*) filter (where n.stay_date between b.f - b.len and b.f - 1) as previous_room_nights,
               sum(n.room_revenue) filter (where n.stay_date between b.f and b.t) as revenue,
               sum(n.room_revenue) filter (where n.stay_date between b.f - b.len and b.f - 1) as previous_revenue,
               min(n.stay_date) as first_stay_date, max(n.stay_date) as last_stay_date
          from bounds b, hotel.reservation_nights n
          join hotel.reservations r using (reservation_id)
          join hotel.accounts a using (account_id)
         where n.stay_date between b.f - b.len and b.t and ($3::text[] is null or n.hotel_code = any($3::text[]))
         group by 1, 2, 3)
      select x.hotel_code, x.account, x.account_type, x.room_nights::int, x.previous_room_nights::int,
             (x.room_nights - x.previous_room_nights)::int as change,
             round(coalesce(x.revenue, 0) * hotel.eur_rate(h.currency, $2::date), 0)::float8 as revenue_eur,
             round(coalesce(x.previous_revenue, 0) * hotel.eur_rate(h.currency, $2::date), 0)::float8 as previous_revenue_eur,
             round((coalesce(x.revenue, 0) - coalesce(x.previous_revenue, 0)) * hotel.eur_rate(h.currency, $2::date), 0)::float8
               as revenue_change_eur,
             to_char(x.first_stay_date, 'YYYY-MM-DD') as first_stay_date, to_char(x.last_stay_date, 'YYYY-MM-DD') as last_stay_date
        from x join hotel.hotels h using (hotel_code)
       order by ${input.sort === 'volume' ? 'greatest(x.room_nights, x.previous_room_nights) desc' : '(x.room_nights - x.previous_room_nights) asc'}
       limit $4::int`;
    return this.#run<{ hotel_code: string; account: string; account_type: string; room_nights: number; previous_room_nights: number; change: number; revenue_eur: number; previous_revenue_eur: number; revenue_change_eur: number; first_stay_date: string; last_stay_date: string }>(
      sql,
      [input.from, input.to, input.hotels?.length ? input.hotels : null, input.limit ?? 15],
      {
        sources: ['hotel.reservation_nights', 'hotel.reservations', 'hotel.accounts'],
        definitions: {
          previous_room_nights: 'Room nights in the period of the same length just before this one.',
          last_stay_date: 'The last night the account stayed, across both windows.',
        },
        period: { from: input.from, to: input.to },
      },
    );
  }

  /** Staffing: required vs scheduled vs worked hours per department. */
  async getLabor(input: { hotels?: string[]; department?: string; from: string; to: string; grain?: Bucket }) {
    const grain = input.grain ?? 'week';
    const sql = `
      select to_char(${period(grain, 'l.date', '$1')}, 'YYYY-MM-DD') as period, l.hotel_code, l.department,
             round(sum(l.required_hours), 0)::float8 as required_hours, round(sum(l.scheduled_hours), 0)::float8 as scheduled_hours,
             round(sum(l.actual_hours), 0)::float8 as actual_hours, round(sum(l.overtime_hours), 0)::float8 as overtime_hours,
             round(100.0 * sum(l.actual_hours) / nullif(sum(l.required_hours), 0), 1)::float8 as staffing_pct,
             round(sum(l.labor_cost * hotel.eur_rate(l.currency, l.date)), 0)::float8 as labor_cost_eur
        from hotel.labor_daily l
       where l.date between $1::date and $2::date
         and ($3::text[] is null or l.hotel_code = any($3::text[])) and ($4::text is null or l.department = $4)
       group by 1, 2, 3 order by 1, 2, 3`;
    return this.#run<{ period: string; hotel_code: string; department: string; required_hours: number; actual_hours: number; staffing_pct: number }>(
      sql,
      [input.from, input.to, input.hotels?.length ? input.hotels : null, input.department ?? null],
      {
        sources: ['hotel.labor_daily'],
        definitions: { staffing_pct: 'Hours actually worked ÷ hours the workload required, in %.' },
        period: { from: input.from, to: input.to },
        notes: ['Departments: Front Office, Housekeeping, Kitchen, F&B Service, Maintenance, Sales & Marketing, Administration & General.'],
      },
    );
  }

  /** F&B covers and revenue per outlet type and meal period, with covers per occupied room. */
  async getFnb(input: { hotels?: string[]; from: string; to: string; grain?: Bucket; mealPeriods?: string[] }) {
    const grain = input.grain ?? 'week';
    const sql = `
      with f as (
        select ${period(grain, 'f.date', '$1')} as period, f.hotel_code, o.outlet_type, f.meal_period,
               sum(f.covers) as covers, sum((f.food_revenue + f.beverage_revenue) * hotel.eur_rate(f.currency, f.date)) as revenue_eur
          from hotel.fnb_daily f join hotel.outlets o using (outlet_id)
         where f.date between $1::date and $2::date and ($3::text[] is null or f.hotel_code = any($3::text[]))
           and ($4::text[] is null or f.meal_period = any($4::text[]))
         group by 1, 2, 3, 4),
      rooms as (
        select ${period(grain, 'd.date', '$1')} as period, d.hotel_code, sum(d.rooms_sold) as rooms_sold
          from hotel.v_hotel_day d
         where d.date between $1::date and $2::date and ($3::text[] is null or d.hotel_code = any($3::text[]))
         group by 1, 2)
      select to_char(f.period, 'YYYY-MM-DD') as period, f.hotel_code, f.outlet_type, f.meal_period, f.covers::int,
             round(f.revenue_eur, 0)::float8 as revenue_eur, rooms.rooms_sold::int,
             round(f.covers::numeric / nullif(rooms.rooms_sold, 0), 3)::float8 as covers_per_occupied_room
        from f join rooms using (period, hotel_code)
       order by 1, 2, f.covers desc`;
    return this.#run<{ period: string; hotel_code: string; outlet_type: string; meal_period: string; covers: number; revenue_eur: number; rooms_sold: number; covers_per_occupied_room: number }>(
      sql,
      [input.from, input.to, input.hotels?.length ? input.hotels : null, input.mealPeriods?.length ? input.mealPeriods : null],
      {
        sources: ['hotel.fnb_daily', 'hotel.outlets', 'hotel.v_hotel_day'],
        definitions: { covers_per_occupied_room: 'Covers ÷ room nights sold in the same period: how much in-house demand the outlets capture.' },
        period: { from: input.from, to: input.to },
        notes: ['Meal periods: breakfast, lunch, dinner, all_day. A stalled POS feed shows as missing days: check data freshness first.'],
      },
    );
  }

  /** Guest review scores (0–10) per period. */
  async getReviewScores(input: { hotels?: string[]; from: string; to: string; grain?: Bucket }) {
    const grain = input.grain ?? 'month';
    const sql = `
      select to_char(${period(grain, 'v.review_date', '$1')}, 'YYYY-MM-DD') as period, v.hotel_code, count(*)::int as reviews,
             round(avg(v.overall_score), 2)::float8 as overall, round(avg(v.staff), 2)::float8 as staff,
             round(avg(v.cleanliness), 2)::float8 as cleanliness, round(avg(v.comfort), 2)::float8 as comfort,
             round(avg(v.location), 2)::float8 as location, round(avg(v.value), 2)::float8 as value,
             round(avg(v.food), 2)::float8 as food
        from hotel.reviews v
       where v.review_date between $1::date and $2::date and ($3::text[] is null or v.hotel_code = any($3::text[]))
       group by 1, 2 order by 1, 2`;
    return this.#run<{ period: string; hotel_code: string; reviews: number; overall: number; food: number }>(
      sql,
      [input.from, input.to, input.hotels?.length ? input.hotels : null],
      { sources: ['hotel.reviews'], definitions: { scores: 'Average guest scores on a 0–10 scale, by review date.' }, period: { from: input.from, to: input.to } },
    );
  }

  /** Review quotes that mention a phrase, newest first. Keyword search; semantic search comes with embeddings. */
  async searchReviews(input: { hotels?: string[]; text: string; from?: string; to?: string; limit?: number }) {
    const sql = `
      select v.hotel_code, to_char(v.review_date, 'YYYY-MM-DD') as review_date, v.source, v.overall_score::float8,
             v.positive_text, v.negative_text, v.topics
        from hotel.reviews v
       where (v.negative_text ilike '%' || $1 || '%' or v.positive_text ilike '%' || $1 || '%')
         and ($2::text[] is null or v.hotel_code = any($2::text[]))
         and ($3::date is null or v.review_date >= $3::date) and ($4::date is null or v.review_date <= $4::date)
       order by v.review_date desc limit $5::int`;
    return this.#run<{ hotel_code: string; review_date: string; source: string; overall_score: number; positive_text: string; negative_text: string; topics: string }>(
      sql,
      [input.text, input.hotels?.length ? input.hotels : null, input.from ?? null, input.to ?? null, input.limit ?? 10],
      { sources: ['hotel.reviews'], notes: ['Exact phrase match, case-insensitive.'] },
    );
  }

  /** Review sentences closest in meaning to a question (semantic search; see review-search.ts). */
  async findReviews(input: FindReviewsInput): Promise<Result<DataResult<ReviewMatch>, DataError>> {
    if (!this.embedder) return err({ kind: 'invalid', message: 'Semantic review search is not available here. Use search_reviews with a phrase.' });
    return findReviews(this.db, this.embedder, input, await this.businessDate());
  }

  /** Booking-engine funnel: sessions → searches → checkout starts → bookings, by device or traffic source. */
  async getWebFunnel(input: { hotels?: string[]; from: string; to: string; grain?: Bucket; by: 'device' | 'source' }) {
    const grain = input.grain ?? 'week';
    const key = input.by === 'device' ? 'w.device' : 'w.source';
    const sql = `
      select to_char(${period(grain, 'w.date', '$1')}, 'YYYY-MM-DD') as period, w.hotel_code, ${key} as key,
             sum(w.sessions)::int as sessions, sum(w.searches)::int as searches, sum(w.checkout_starts)::int as checkout_starts,
             sum(w.bookings)::int as bookings,
             round(100.0 * sum(w.bookings) / nullif(sum(w.sessions), 0), 2)::float8 as conversion_pct,
             round(100.0 * sum(w.bookings) / nullif(sum(w.checkout_starts), 0), 1)::float8 as checkout_completion_pct,
             round(sum(w.booking_revenue * hotel.eur_rate(w.currency, w.date)), 0)::float8 as booking_revenue_eur
        from hotel.web_daily w
       where w.date between $1::date and $2::date and ($3::text[] is null or w.hotel_code = any($3::text[]))
       group by 1, 2, 3 order by 1, 2, sessions desc`;
    return this.#run<{ period: string; hotel_code: string; key: string; sessions: number; bookings: number; conversion_pct: number; checkout_completion_pct: number }>(
      sql,
      [input.from, input.to, input.hotels?.length ? input.hotels : null],
      {
        sources: ['hotel.web_daily'],
        definitions: {
          conversion_pct: 'Bookings ÷ sessions on the hotel website, in %.',
          checkout_completion_pct: 'Bookings ÷ checkout starts, in %: a drop points at a broken checkout.',
        },
        period: { from: input.from, to: input.to },
      },
    );
  }

  /** Physical rooms, rooms out of order and rooms available. */
  async getInventory(input: { hotels?: string[]; from: string; to: string; grain?: Bucket }) {
    const grain = input.grain ?? 'week';
    const sql = `
      select to_char(${period(grain, 'i.date', '$1')}, 'YYYY-MM-DD') as period, i.hotel_code,
             max(i.physical_rooms)::int as physical_rooms, min(i.out_of_order)::int as min_out_of_order,
             max(i.out_of_order)::int as max_out_of_order, round(avg(i.out_of_order), 1)::float8 as avg_out_of_order,
             sum(i.rooms_available)::int as room_nights_available
        from hotel.room_inventory_daily i
       where i.date between $1::date and $2::date and ($3::text[] is null or i.hotel_code = any($3::text[]))
       group by 1, 2 order by 1, 2`;
    return this.#run<{ period: string; hotel_code: string; physical_rooms: number; min_out_of_order: number; max_out_of_order: number; avg_out_of_order: number }>(
      sql,
      [input.from, input.to, input.hotels?.length ? input.hotels : null],
      {
        sources: ['hotel.room_inventory_daily'],
        definitions: { out_of_order: 'Rooms taken out of sale (renovation, maintenance); they are excluded from rooms available.' },
        period: { from: input.from, to: input.to },
      },
    );
  }

  /** Today's brief findings across the portfolio: fixed detectors, ranked by money impact. */
  async getBriefItems(hotels?: readonly string[]): Promise<DataResult<BriefItem>> {
    const found = await detectBriefItems(this.db);
    // The detectors scan the portfolio; a hotel scope keeps the findings of its hotels.
    const rows = hotels?.length ? found.filter((item) => hotels.includes(item.hotel_code)) : found;
    return {
      rows,
      evidence: await this.#evidence('brief detectors (see impact_basis on each item)', [], rows.length, {
        sources: [...new Set(rows.flatMap((r) => r.sources))],
        notes: ['Found by fixed checks on the data, not written by AI. Stalled data feeds come first, then the findings with the most money at stake.'],
      }),
    };
  }

  /** A compact description of schema `hotel` for writing custom queries: every table and view with its columns. */
  async getSchema(): Promise<string> {
    const rows = await this.db.query<{ table_name: string; column_name: string; data_type: string; udt_name: string }>(
      `select table_name, column_name, data_type, udt_name
         from information_schema.columns where table_schema = 'hotel' order by table_name, ordinal_position`,
    );
    const columns = new Map<string, string[]>();
    for (const r of rows) {
      // An embedding is 1024 numbers: selecting one would flood the answer.
      const column = r.udt_name === 'vector' ? `${r.column_name} (vector; never select it)` : `${r.column_name} ${r.data_type}`;
      columns.set(r.table_name, [...(columns.get(r.table_name) ?? []), column]);
    }
    const tables = [...columns].map(([table, list]) => `- hotel.${table}(${list.join(', ')})`).join('\n');
    return `${tables}\n\n${SCHEMA_NOTES}\nBusiness date: ${await this.businessDate()}.`;
  }

  /**
   * Model-written SQL: guarded, capped at 200 rows, run by a read-only role with a 5 s timeout.
   * Under a hotel scope (`hotels`) the rows must say which hotel they are for (a `hotel_code` column), and only the
   * rows of those hotels are returned. A query may still aggregate other hotels inside itself: the scope is a
   * working mode, not access control, and the prompt tells the model to filter on the scope's codes.
   */
  async runReadonlyQuery(sql: string, hotels?: readonly string[]): Promise<Result<DataResult, DataError>> {
    const guarded = guardReadOnlySql(sql, { maxRows: MAX_ROWS });
    if (!guarded.ok) return err({ kind: 'rejected', ...guarded.error });
    try {
      const result = await this.#run<Record<string, unknown>>(guarded.value, [], {
        sources: ['hotel.*'],
        notes: [`A custom analysis written for this question, limited to ${MAX_ROWS} rows.`],
      });
      if (!hotels?.length) return ok(result);
      if (result.rows.length && !result.rows.some((row) => 'hotel_code' in row)) {
        return err({
          kind: 'invalid',
          message: `You are answering for ${hotels.join(', ')} only. Return a hotel_code column and filter on those codes, so the rows can be limited to them.`,
        });
      }
      const rows = result.rows.filter((row) => hotels.includes(String(row['hotel_code'])));
      return ok({ rows, evidence: { ...result.evidence, rowCount: rows.length } });
    } catch (error) {
      // The one place where database error text goes back to the caller: the model needs it to fix its query.
      // Only what Postgres says about the statement; anything else goes to the logs behind the generic failure.
      return isSqlError(error) ? err({ kind: 'database', message: error.message }) : err({ kind: 'internal', cause: error });
    }
  }

  async #run<Row>(sql: string, params: unknown[], meta: Partial<Evidence>): Promise<DataResult<Row>> {
    const rows = await this.db.query<Row>(sql, params);
    return { rows, evidence: await this.#evidence(sql, params, rows.length, meta) };
  }

  async #tryRun<Row>(sql: string, params: unknown[], meta: Partial<Evidence>): Promise<Result<DataResult<Row>, DataError>> {
    try {
      return ok(await this.#run<Row>(sql, params, meta));
    } catch (error) {
      return err({ kind: 'internal', cause: error });
    }
  }

  async #evidence(sql: string, params: unknown[], rowCount: number, meta: Partial<Evidence>): Promise<Evidence> {
    return {
      sources: meta.sources ?? [],
      definitions: meta.definitions ?? {},
      period: meta.period ?? null,
      sql: sql.replace(/\s+/g, ' ').trim(),
      params,
      rowCount,
      businessDate: await this.businessDate(),
      notes: meta.notes ?? [],
    };
  }
}
