import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HotelData } from '../src/application/hotel-data.ts';
import { openPostgres, type PostgresDb } from '../src/infrastructure/postgres.ts';

// Integration tests for the Finance, M&E, forecast and lost-business lenses, against the local Halcyon database
// through the read-only role. Every expected number comes from an independent oracle query over the raw tables.
process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);

let db: PostgresDb;
let data: HotelData;

beforeAll(() => {
  db = openPostgres(process.env['DATABASE_URL']!);
  data = new HotelData(db);
});
afterAll(() => db.close());

const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params))[0]!;

describe('getPnl', () => {
  it('gives revenue, GOP and the variance to budget for one hotel and month', async () => {
    const result = await data.finance.getPnl({ hotels: ['LIS'], from: '2026-10-01', to: '2026-10-31', grain: 'month' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(1);
    const row = result.value.rows[0]!;
    const o = await one<{ rev: number; rev_b: number; gop: number; gop_b: number }>(
      `select sum(amount) filter (where scenario = 'actual' and line = 'TOTAL_REVENUE')::float8 as rev,
              sum(amount) filter (where scenario = 'budget' and line = 'TOTAL_REVENUE')::float8 as rev_b,
              sum(amount) filter (where scenario = 'actual' and line = 'GOP')::float8 as gop,
              sum(amount) filter (where scenario = 'budget' and line = 'GOP')::float8 as gop_b
         from hotel.pnl_monthly where hotel_code = 'LIS' and month = '2026-10-01'`,
    );
    expect(row).toMatchObject({ period: '2026-10-01', key: 'LIS', basis: 'actual' });
    expect(row.revenue_eur).toBe(Math.round(o.rev));
    expect(row.revenue_budget_eur).toBe(Math.round(o.rev_b));
    expect(row.gop_eur).toBe(Math.round(o.gop));
    expect(row.gop_var_eur).toBe(Math.round(o.gop - o.gop_b));
    expect(row.gop_var_pct).toBeCloseTo((100 * (o.gop - o.gop_b)) / o.gop_b, 1);
    expect(row.gop_margin_pct).toBeCloseTo((100 * o.gop) / o.rev, 1);
    // Revenue within 2% of budget: flowthrough would be noise (here ~570%), so it is left empty
    expect(Math.abs(o.rev - o.rev_b) / o.rev_b).toBeLessThan(0.02);
    expect(row.flowthrough_budget_pct).toBeNull();
    expect(result.value.evidence.sources).toContain('hotel.pnl_monthly');
    expect(result.value.evidence.definitions['flowthrough']).toMatch(/GOP/);
  });

  it('converts to EUR and compares with last year (Miami, USD)', async () => {
    const result = await data.finance.getPnl({ hotels: ['MIA'], from: '2026-10-01', to: '2026-10-31', grain: 'month' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = result.value.rows[0]!;
    const o = await one<{ rev: number; rev_ly: number; gop: number; gop_ly: number; rev_b: number; gop_b: number }>(
      `select sum(amount * hotel.eur_rate(currency, month)) filter (where month = '2026-10-01' and line = 'TOTAL_REVENUE')::float8 as rev,
              (select sum(amount * hotel.eur_rate(currency, month)) from hotel.pnl_monthly
                where hotel_code = 'MIA' and scenario = 'budget' and month = '2026-10-01' and line = 'TOTAL_REVENUE')::float8 as rev_b,
              (select sum(amount * hotel.eur_rate(currency, month)) from hotel.pnl_monthly
                where hotel_code = 'MIA' and scenario = 'budget' and month = '2026-10-01' and line = 'GOP')::float8 as gop_b,
              sum(amount * hotel.eur_rate(currency, month)) filter (where month = '2025-10-01' and line = 'TOTAL_REVENUE')::float8 as rev_ly,
              sum(amount * hotel.eur_rate(currency, month)) filter (where month = '2026-10-01' and line = 'GOP')::float8 as gop,
              sum(amount * hotel.eur_rate(currency, month)) filter (where month = '2025-10-01' and line = 'GOP')::float8 as gop_ly
         from hotel.pnl_monthly where hotel_code = 'MIA' and scenario = 'actual'`,
    );
    expect(row.revenue_eur).toBe(Math.round(o.rev));
    expect(row.revenue_ly_eur).toBe(Math.round(o.rev_ly));
    expect(row.gop_ly_eur).toBe(Math.round(o.gop_ly));
    expect(row.flowthrough_ly_pct).toBeCloseTo((100 * (o.gop - o.gop_ly)) / (o.rev - o.rev_ly), 0);
    expect(row.flowthrough_budget_pct).toBeCloseTo((100 * (row.gop_eur - o.gop_b)) / (row.revenue_eur - o.rev_b), 0);
    expect(row.gop_var_eur).toBeLessThan(0); // Miami missed its October GOP budget
  });

  it('rolls the group up from sums: GOP margin = Σ GOP ÷ Σ revenue in EUR', async () => {
    const result = await data.finance.getPnl({ from: '2026-01-01', to: '2026-10-31', grain: 'total', by: 'group' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(1);
    const o = await one<{ margin: number }>(
      `select (100 * sum(amount * hotel.eur_rate(currency, month)) filter (where line = 'GOP')
                   / sum(amount * hotel.eur_rate(currency, month)) filter (where line = 'TOTAL_REVENUE'))::float8 as margin
         from hotel.pnl_monthly where scenario = 'actual' and month between '2026-01-01' and '2026-10-01'`,
    );
    expect(result.value.rows[0]!.gop_margin_pct).toBeCloseTo(o.margin, 1);
    expect(result.value.rows[0]).toMatchObject({ key: 'Halcyon group', months: 10, basis: 'actual' });
  });

  it('blends actuals and the forecast into an outlook when the period crosses the business date', async () => {
    const result = await data.finance.getPnl({ hotels: ['AMS'], from: '2026-10-01', to: '2026-12-31', grain: 'total' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = result.value.rows[0]!;
    const o = await one<{ rev: number }>(
      `select sum(amount)::float8 as rev from hotel.pnl_monthly
        where hotel_code = 'AMS' and line = 'TOTAL_REVENUE' and month between '2026-10-01' and '2026-12-01'
          and ((scenario = 'actual' and month < '2026-11-01') or (scenario = 'forecast' and month >= '2026-11-01'))`,
    );
    expect(row.basis).toBe('actual+forecast');
    expect(row.revenue_eur).toBe(Math.round(o.rev));
  });

  it('lists USALI lines with favourable or unfavourable variance; revenue lines add up to total revenue', async () => {
    const result = await data.finance.getPnl({ hotels: ['PAR'], from: '2026-09-01', to: '2026-09-30', view: 'lines' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = result.value.rows;
    expect(rows).toHaveLength(13);
    const byLine = Object.fromEntries(rows.map((r) => [r.line, r]));
    const parts = ['ROOMS_REVENUE', 'FNB_REVENUE', 'ME_REVENUE', 'OTHER_REVENUE'].reduce((s, l) => s + byLine[l]!.value_eur, 0);
    expect(Math.abs(parts - byLine['TOTAL_REVENUE']!.value_eur)).toBeLessThanOrEqual(3);
    const expense = byLine['ROOMS_EXPENSE']!;
    expect(expense.favourable).toBe(expense.var_eur <= 0);
    const gop = byLine['GOP']!;
    expect(gop.favourable).toBe(gop.var_eur >= 0);
  });

  it('filters lines', async () => {
    const result = await data.finance.getPnl({ hotels: ['PAR'], from: '2026-09-01', to: '2026-09-30', view: 'lines', lines: ['GOP'] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rows.map((r) => r.line)).toEqual(['GOP']);
  });

  it('rejects a reversed period', async () => {
    const result = await data.finance.getPnl({ from: '2026-10-31', to: '2026-10-01' });
    expect(result.ok).toBe(false);
  });
});

describe('getForecast', () => {
  it('gives the P10/P50/P90 range for a future month, on the books and the budget', async () => {
    const result = await data.finance.getForecast({ hotels: ['VIE'], from: '2026-12-01', to: '2026-12-31' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(1);
    const row = result.value.rows[0]!;
    const o = await one<{ p10: number; p50: number; p90: number; otb: number; cap: number; budget: number }>(
      `select sum(f.rooms_p10)::int as p10, sum(f.rooms_p50)::int as p50, sum(f.rooms_p90)::int as p90,
              sum(f.rooms_on_books)::int as otb, sum(f.rooms_available)::int as cap,
              (select rooms_sold from hotel.budgets where hotel_code = 'VIE' and month = '2026-12-01') as budget
         from hotel.forecasts f where f.hotel_code = 'VIE' and f.stay_date between '2026-12-01' and '2026-12-31'`,
    );
    expect(row).toMatchObject({ period: '2026-12-01', key: 'VIE', rooms_p10: o.p10, rooms_p50: o.p50, rooms_p90: o.p90 });
    expect(row.rooms_on_books).toBe(o.otb);
    expect(row.budget_rooms_sold).toBe(o.budget);
    expect(row.occupancy_p50_pct).toBeCloseTo((100 * o.p50) / o.cap, 1);
    expect(row.rooms_p10).toBeLessThanOrEqual(row.rooms_p50);
    expect(row.rooms_p50).toBeLessThanOrEqual(row.rooms_p90);
    expect(['below P10', 'within P10–P90', 'above P90']).toContain(row.budget_position);
    expect(row.rooms_on_books_stly).toBeGreaterThan(0);
    expect(result.value.evidence.notes.join(' ')).toMatch(/range/i);
  });

  it('adds the actual nights of the current month before the business date, so the month compares with its budget', async () => {
    const result = await data.finance.getForecast({ hotels: ['LIS'], from: '2026-11-01', to: '2026-11-30' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = result.value.rows[0]!;
    const o = await one<{ actual: number; p50: number; cap: number }>(
      `select (select sum(rooms_sold) from hotel.v_hotel_day where hotel_code = 'LIS' and date between '2026-11-01' and '2026-11-19')::int as actual,
              (select sum(rooms_p50) from hotel.forecasts where hotel_code = 'LIS' and stay_date between '2026-11-20' and '2026-11-30')::int as p50,
              (select sum(rooms_available) from hotel.room_inventory_daily where hotel_code = 'LIS' and date between '2026-11-01' and '2026-11-30')::int as cap`,
    );
    expect(row.rooms_actual).toBe(o.actual);
    expect(row.rooms_p50).toBe(o.actual + o.p50);
    expect(row.rooms_available).toBe(o.cap);
  });

  it('rolls up by region from sums', async () => {
    const result = await data.finance.getForecast({ from: '2027-01-01', to: '2027-03-31', grain: 'total', by: 'region' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows.map((r) => r.key).sort()).toEqual(['Asia', 'Europe', 'Middle East', 'North America', 'South America']);
  });
});

describe('getMeetingsEvents', () => {
  it('gives definite events, attendees and M&E revenue in EUR per month, with revenue per sqm', async () => {
    const result = await data.finance.getMeetingsEvents({ hotels: ['NYC'], from: '2026-09-01', to: '2026-10-31', grain: 'month' });
    expect(result.rows).toHaveLength(2);
    const row = result.rows.find((r) => r.period === '2026-10-01')!;
    const o = await one<{ events: number; attendees: number; revenue: number; space_av: number }>(
      `select count(*)::int as events, sum(attendees)::int as attendees,
              sum((space_revenue + fnb_revenue + av_revenue) * hotel.eur_rate(currency, start_date))::float8 as revenue,
              sum((space_revenue + av_revenue) * hotel.eur_rate(currency, start_date))::float8 as space_av
         from hotel.me_events where hotel_code = 'NYC' and status = 'definite' and start_date between '2026-10-01' and '2026-10-31'`,
    );
    expect(row).toMatchObject({ key: 'NYC', events: o.events, attendees: o.attendees });
    expect(row.revenue_eur).toBe(Math.round(o.revenue));
    expect(row.space_av_revenue_eur).toBe(Math.round(o.space_av));
    expect(row.revenue_per_sqm_eur).toBeCloseTo(o.revenue / 1500, 1);
    expect(row.utilisation_pct).toBeGreaterThan(0);
    expect(row.utilisation_pct).toBeLessThanOrEqual(100);
  });

  it('measures utilisation as booked meeting-room days ÷ available room days', async () => {
    const result = await data.finance.getMeetingsEvents({ hotels: ['LIS'], from: '2026-10-01', to: '2026-10-31', grain: 'total' });
    const o = await one<{ util: number }>(
      `select (100.0 * (select count(distinct (e.meeting_room_id, d::date)) from hotel.me_events e,
                         generate_series(greatest(e.start_date, '2026-10-01'), least(e.end_date, '2026-10-31'), interval '1 day') d
                        where e.hotel_code = 'LIS' and e.status = 'definite' and e.start_date <= '2026-10-31' and e.end_date >= '2026-10-01')
              / ((select count(*) from hotel.meeting_rooms where hotel_code = 'LIS') * 31))::float8 as util`,
    );
    expect(result.rows[0]!.utilisation_pct).toBeCloseTo(o.util, 1);
  });

  it('shows the future pipeline: definite and tentative events', async () => {
    const result = await data.finance.getMeetingsEvents({ from: '2026-11-20', to: '2027-05-31', grain: 'total', by: 'group' });
    const o = await one<{ tentative: number; definite: number }>(
      `select count(*) filter (where status = 'tentative')::int as tentative, count(*) filter (where status = 'definite')::int as definite
         from hotel.me_events where start_date between '2026-11-20' and '2027-05-31'`,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ key: 'Halcyon group', events: o.definite, tentative_events: o.tentative });
    expect(result.rows[0]!.tentative_revenue_eur).toBeGreaterThan(0);
  });
});

describe('getLostBusiness', () => {
  it('splits demand turned away by reason, with room nights and an estimated value at BAR in EUR', async () => {
    const result = await data.finance.getLostBusiness({ hotels: ['MIA'], from: '2026-10-01', to: '2026-10-31', grain: 'total' });
    const price = result.rows.find((r) => r.reason === 'price')!;
    const o = await one<{ rn: number; requests: number; value: number }>(
      `select sum(l.room_nights)::int as rn, sum(l.requests)::int as requests,
              (sum(l.room_nights * r.bar_rate) * hotel.eur_rate('USD', '2026-10-01'))::float8 as value
         from hotel.lost_business l join hotel.rates_daily r on r.hotel_code = l.hotel_code and r.stay_date = l.arrival_date
        where l.hotel_code = 'MIA' and l.reason = 'price' and l.arrival_date between '2026-10-01' and '2026-10-31'`,
    );
    expect(price).toMatchObject({ key: 'MIA', room_nights: o.rn, requests: o.requests });
    expect(price.est_revenue_eur).toBe(Math.round(o.value));
    const shares = result.rows.reduce((s, r) => s + r.share_pct, 0);
    expect(shares).toBeCloseTo(100, 0);
    expect(result.evidence.definitions['est_revenue_eur']).toMatch(/BAR/);
  });

  it('can split by segment and count by request date', async () => {
    const result = await data.finance.getLostBusiness({
      hotels: ['LIS'], from: '2026-10-30', to: '2026-11-19', grain: 'total', basis: 'request', detail: 'segment',
    });
    const o = await one<{ rn: number }>(
      `select sum(room_nights)::int as rn from hotel.lost_business
        where hotel_code = 'LIS' and reason = 'price' and segment = 'RET' and request_date between '2026-10-30' and '2026-11-19'`,
    );
    const row = result.rows.find((r) => r.reason === 'price' && r.detail === 'RET')!;
    expect(row.room_nights).toBe(o.rn);
  });
});

describe('speed over the whole group', () => {
  it('answers each lens in under 1.5 s', async () => {
    const timed = async (run: () => Promise<unknown>) => {
      const t = performance.now();
      await run();
      return performance.now() - t;
    };
    const times = {
      pnl: await timed(() => data.finance.getPnl({ from: '2025-01-01', to: '2027-05-31', grain: 'month', by: 'hotel' })),
      forecast: await timed(() => data.finance.getForecast({ grain: 'month' })),
      me: await timed(() => data.finance.getMeetingsEvents({ from: '2025-01-01', to: '2027-05-31', grain: 'month' })),
      lost: await timed(() => data.finance.getLostBusiness({ from: '2025-01-01', to: '2027-05-31', grain: 'month', detail: 'segment' })),
    };
    for (const ms of Object.values(times)) expect(ms).toBeLessThan(1500);
  });
});
