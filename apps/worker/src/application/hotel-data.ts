import type { DataResult, Evidence, MetricDefinition, MetricQuery, MetricRow } from '@compass/contracts';
import { METRICS, metricByKey } from '../domain/metrics.ts';
import { err, ok, type Result } from '../domain/result.ts';
import { guardReadOnlySql, type GuardReason } from '../domain/sql-guard.ts';
import type { Db } from './ports.ts';

export type DataError =
  | { kind: 'invalid'; message: string }
  | { kind: 'rejected'; reason: GuardReason; message: string }
  | { kind: 'database'; message: string };

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

const MAX_ROWS = 200;

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

  constructor(private readonly db: Db) {}

  businessDate(): Promise<string> {
    this.#businessDate ??= this.db
      .query<{ d: string }>(`select to_char(hotel.business_date(), 'YYYY-MM-DD') as d`)
      .then((rows) => rows[0]!.d);
    return this.#businessDate;
  }

  async listHotels(): Promise<DataResult<Hotel>> {
    const sql = `select h.hotel_code, h.name, b.name as brand, h.city, h.country, h.region, h.currency, h.rooms,
                        h.meeting_space_sqm
                   from hotel.hotels h join hotel.brands b using (brand_code) order by h.region, h.hotel_code`;
    return this.#run(sql, [], { sources: ['hotel.hotels', 'hotel.brands'] });
  }

  listMetrics(): { rows: MetricDefinition[] } {
    return { rows: [...METRICS] };
  }

  async getMetric(query: MetricQuery): Promise<Result<DataResult<MetricRow>, DataError>> {
    if (query.from > query.to) return err({ kind: 'invalid', message: '`from` must be on or before `to`.' });
    const def = metricByKey(query.metric);
    const expr = METRIC_SQL[query.metric];
    const join = COMP_SET_METRICS.has(query.metric)
      ? 'join hotel.comp_set_daily c on c.hotel_code = d.hotel_code and c.date = d.date'
      : '';
    // $1 grain, $2 from, $3 to, $4 hotels (null = all), $5 shift in days (0 now, 364 for STLY)
    const window = `
      select to_char(date_trunc($1, d.date + $5::int), 'YYYY-MM-DD') as period, d.hotel_code, ${expr}::float8 as value
        from hotel.v_hotel_day d ${join}
       where d.date between $2::date - $5::int and $3::date - $5::int
         and ($4::text[] is null or d.hotel_code = any($4::text[]))
       group by 1, 2`;
    const sql =
      query.compare === 'stly'
        ? `with cur as (${window.replaceAll('$5', '0')}), ly as (${window.replaceAll('$5', '364')})
           select cur.period, cur.hotel_code, cur.value, ly.value as compare_value
             from cur left join ly using (period, hotel_code) order by 1, 2`
        : `${window.replaceAll('$5', '0')} order by 1, 2`;
    const params = [query.grain, query.from, query.to, query.hotels?.length ? query.hotels : null];
    const notes = [
      'Stay dates on or after the business date are on the books, not actuals.',
      ...(query.compare === 'stly' ? ['compare_value is the same period last year, shifted 364 days so weekdays line up.'] : []),
      ...(join ? ['The comp set benchmark covers actuals only (stay dates before the business date). For future nights use the rate position.'] : []),
    ];
    return this.#tryRun<MetricRow>(sql, params, {
      sources: [def.source === 'hotel.comp_set_daily' ? 'hotel.v_hotel_day' : def.source, ...(join ? ['hotel.comp_set_daily'] : [])],
      definitions: { [def.key]: def.definition },
      period: { from: query.from, to: query.to },
      notes,
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

  /** On the books now vs the same time last year, for the next `daysAhead` nights. */
  async getPace(input: { hotels?: string[]; daysAhead?: number }) {
    const sql = `
      select hotel_code, sum(rooms_otb)::int as rooms_otb, sum(rooms_otb_stly)::int as rooms_otb_stly,
             round(100.0 * (sum(rooms_otb) - sum(rooms_otb_stly)) / nullif(sum(rooms_otb_stly), 0), 1)::float8 as pace_pct,
             round(sum(revenue_otb), 0)::float8 as revenue_otb, round(sum(revenue_otb_stly), 0)::float8 as revenue_otb_stly
        from hotel.pace_vs_stly(null, $1::int)
       where $2::text[] is null or hotel_code = any($2::text[])
       group by 1 order by 1`;
    const days = input.daysAhead ?? 90;
    return this.#run<{ hotel_code: string; rooms_otb: number; rooms_otb_stly: number; pace_pct: number; revenue_otb: number; revenue_otb_stly: number }>(
      sql,
      [days, input.hotels?.length ? input.hotels : null],
      {
        sources: ['hotel.pace_vs_stly()'],
        definitions: {
          pace: `Room nights on the books for the next ${days} nights vs on the books at the same point last year (−364 days). Revenue in local currency.`,
        },
      },
    );
  }

  /** Our BAR against the comp set median of the latest rate shop, per future night. */
  async getRatePosition(input: { hotels?: string[]; from?: string; to?: string }) {
    const sql = `
      select hotel_code, to_char(stay_date, 'YYYY-MM-DD') as stay_date, bar_rate::float8,
             round(comp_median::numeric, 2)::float8 as comp_median, bar_vs_comp::float8, comps_sold_out::int
        from hotel.v_rate_position
       where ($1::text[] is null or hotel_code = any($1::text[]))
         and ($2::date is null or stay_date >= $2::date) and ($3::date is null or stay_date <= $3::date)
       order by hotel_code, stay_date`;
    return this.#run<{ hotel_code: string; stay_date: string; bar_rate: number; comp_median: number; bar_vs_comp: number; comps_sold_out: number }>(
      sql,
      [input.hotels?.length ? input.hotels : null, input.from ?? null, input.to ?? null],
      {
        sources: ['hotel.v_rate_position'],
        definitions: { bar_vs_comp: 'Our best available rate ÷ the median comp set rate from the latest shop. 1.00 = at the median.' },
        period: input.from && input.to ? { from: input.from, to: input.to } : null,
      },
    );
  }

  /** Gross revenue, commission and net revenue by channel, in EUR. */
  async getChannelMix(input: { hotels?: string[]; from: string; to: string }) {
    const sql = `
      select v.hotel_code, v.channel, v.channel_type, sum(v.room_nights)::int as room_nights,
             round(sum(v.gross_revenue * hotel.eur_rate(h.currency, v.month)), 0)::float8 as gross_revenue_eur,
             round(sum(v.commission * hotel.eur_rate(h.currency, v.month)), 0)::float8 as commission_eur,
             round(sum(v.net_revenue * hotel.eur_rate(h.currency, v.month)), 0)::float8 as net_revenue_eur
        from hotel.v_channel_month v join hotel.hotels h using (hotel_code)
       where v.month between date_trunc('month', $1::date) and $2::date
         and ($3::text[] is null or v.hotel_code = any($3::text[]))
       group by 1, 2, 3 order by 1, net_revenue_eur desc`;
    return this.#run<{ hotel_code: string; channel: string; channel_type: string; room_nights: number; gross_revenue_eur: number; commission_eur: number; net_revenue_eur: number }>(
      sql,
      [input.from, input.to, input.hotels?.length ? input.hotels : null],
      {
        sources: ['hotel.v_channel_month', 'hotel.channels'],
        definitions: { net_revenue: 'Room revenue after channel commission and GDS fees (channels.commission_pct), in EUR.' },
        period: { from: input.from, to: input.to },
      },
    );
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

  /** Model-written SQL: guarded, capped at 200 rows, run by a read-only role with a 5 s timeout. */
  async runReadonlyQuery(sql: string): Promise<Result<DataResult, DataError>> {
    const guarded = guardReadOnlySql(sql, { maxRows: MAX_ROWS });
    if (!guarded.ok) return err({ kind: 'rejected', ...guarded.error });
    return this.#tryRun(guarded.value, [], {
      sources: ['hotel.*'],
      notes: [`Custom query written by the assistant, capped at ${MAX_ROWS} rows.`],
    });
  }

  async #run<Row>(sql: string, params: unknown[], meta: Partial<Evidence>): Promise<DataResult<Row>> {
    const rows = await this.db.query<Row>(sql, params);
    return { rows, evidence: await this.#evidence(sql, params, rows.length, meta) };
  }

  async #tryRun<Row>(sql: string, params: unknown[], meta: Partial<Evidence>): Promise<Result<DataResult<Row>, DataError>> {
    try {
      return ok(await this.#run<Row>(sql, params, meta));
    } catch (error) {
      return err({ kind: 'database', message: error instanceof Error ? error.message : String(error) });
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
