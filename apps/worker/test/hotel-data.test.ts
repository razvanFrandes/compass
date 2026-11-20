import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HotelData } from '../src/application/hotel-data.ts';
import { openPostgres, type PostgresDb } from '../src/infrastructure/postgres.ts';

// Integration tests against the local Halcyon database (compass-datagen), through the read-only role.
// The expected values come from compass-datagen/tests/check.py, the answer key for the planted stories.
process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);

let db: PostgresDb;
let data: HotelData;

beforeAll(() => {
  db = openPostgres(process.env['DATABASE_URL']!);
  data = new HotelData(db);
});
afterAll(() => db.close());

describe('reference data', () => {
  it('lists the 20 Halcyon hotels', async () => {
    const { rows } = await data.listHotels();
    expect(rows).toHaveLength(20);
    expect(rows.map((h) => h.hotel_code)).toContain('LIS');
  });

  it('knows the business date', async () => {
    expect(await data.businessDate()).toBe('2026-11-20');
  });

  it('lists every metric with a definition', () => {
    const { rows } = data.listMetrics();
    expect(rows.map((m) => m.key)).toEqual(['occupancy', 'adr', 'revpar', 'room_revenue', 'rooms_sold', 'mpi', 'ari', 'rgi']);
    for (const m of rows) expect(m.definition.length).toBeGreaterThan(10);
  });
});

describe('getMetric', () => {
  it('computes occupancy from sums, matching the raw tables', async () => {
    const result = await data.getMetric({ metric: 'occupancy', hotels: ['LIS'], from: '2026-10-01', to: '2026-10-31', grain: 'month', compare: 'none' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = result.value.rows;
    const [oracle] = await db.query<{ occ: number }>(
      `select round(100.0 * sum(rooms_sold) / sum(rooms_available), 1)::float8 as occ
         from hotel.v_hotel_day where hotel_code = 'LIS' and date between '2026-10-01' and '2026-10-31'`,
    );
    expect(row?.value).toBe(oracle!.occ);
    expect(result.value.evidence.sources).toContain('hotel.v_hotel_day');
    expect(result.value.evidence.definitions['occupancy']).toMatch(/rooms sold/i);
  });

  it('adds the same period last year when asked', async () => {
    const result = await data.getMetric({ metric: 'revpar', hotels: ['AMS', 'PAR'], from: '2026-09-01', to: '2026-10-31', grain: 'month', compare: 'stly' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(4);
    for (const row of result.value.rows) expect(row.compare_value).toBeGreaterThan(0);
  });

  it('computes comp set indices from the benchmark feed, which covers actuals only', async () => {
    const result = await data.getMetric({ metric: 'ari', hotels: ['LIS'], from: '2026-10-01', to: '2026-10-31', grain: 'month', compare: 'none' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [oracle] = await db.query<{ ari: number }>(
      `select round(100.0 * (sum(d.room_revenue) / sum(d.rooms_sold)) / (sum(c.room_revenue) / sum(c.rooms_sold)), 1)::float8 as ari
         from hotel.v_hotel_day d join hotel.comp_set_daily c using (hotel_code, date)
        where hotel_code = 'LIS' and date between '2026-10-01' and '2026-10-31'`,
    );
    expect(result.value.rows[0]!.value).toBe(oracle!.ari);
    expect(result.value.evidence.notes.join(' ')).toMatch(/actuals only/);
  });

  it('gives one row for the whole period with grain total, also against last year', async () => {
    const result = await data.getMetric({ metric: 'occupancy', hotels: ['BER'], from: '2026-10-21', to: '2026-11-19', grain: 'total', compare: 'stly' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(1);
    expect(result.value.rows[0]).toMatchObject({ period: '2026-10-21', key: 'BER' });
    expect(result.value.rows[0]!.compare_value).toBeGreaterThan(0);
  });

  it('rolls a metric up to the whole group, from sums in EUR', async () => {
    const result = await data.getMetric({ metric: 'revpar', by: 'group', from: '2026-10-01', to: '2026-10-31', grain: 'total', compare: 'stly' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [oracle] = await db.query<{ revpar: number }>(
      `select round(sum(room_revenue_eur) / sum(rooms_available), 2)::float8 as revpar
         from hotel.v_hotel_day where date between '2026-10-01' and '2026-10-31'`,
    );
    expect(result.value.rows).toEqual([expect.objectContaining({ key: 'Halcyon group', value: oracle!.revpar })]);
    expect(result.value.rows[0]!.compare_value).toBeGreaterThan(0);
    const row = result.value.rows[0]!;
    expect(row.change_pct).toBeCloseTo((100 * (row.value! - row.compare_value!)) / row.compare_value!, 0);
  });

  it('rolls a metric up by region', async () => {
    const result = await data.getMetric({ metric: 'occupancy', by: 'region', from: '2026-10-01', to: '2026-10-31', grain: 'total', compare: 'none' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rows.map((r) => r.key).sort()).toEqual(['Asia', 'Europe', 'Middle East', 'North America', 'South America']);
  });

  it('keeps comp set indices per hotel, since they compare local-currency rates', async () => {
    const result = await data.getMetric({ metric: 'ari', by: 'group', from: '2026-10-01', to: '2026-10-31', grain: 'total', compare: 'none' });
    expect(result.ok).toBe(false);
  });

  it('rejects a period that ends before it starts', async () => {
    const result = await data.getMetric({ metric: 'adr', from: '2026-10-31', to: '2026-10-01', grain: 'month', compare: 'none' });
    expect(result.ok).toBe(false);
  });
});

describe('planted stories', () => {
  it('S1: Lisbon 21-day pickup is under 70% of the European median', async () => {
    const { rows } = await data.getPickup({ region: 'Europe', daysBack: 21, horizonDays: 44 });
    const lis = rows.find((r) => r.hotel_code === 'LIS')!;
    const others = rows.filter((r) => r.hotel_code !== 'LIS').map((r) => r.pickup_pct).sort((a, b) => a - b);
    expect(lis.pickup_pct).toBeLessThan(0.7 * others[Math.floor(others.length / 2)]!);
  });

  it('S1: Lisbon pace is behind last year', async () => {
    const { rows } = await data.getPace({ hotels: ['LIS'], daysAhead: 44 });
    expect(rows[0]!.pace_pct).toBeLessThan(-10);
  });

  it('S6: Dubai Business Bay prices under 0.8x its comp set on event nights, Marina does not', async () => {
    const { rows } = await data.getRatePosition({ hotels: ['DXB1', 'DXB2'], from: '2026-12-15', to: '2026-12-19' });
    const avg = (code: string) => {
      const own = rows.filter((r) => r.hotel_code === code);
      return own.reduce((s, r) => s + r.bar_vs_comp, 0) / own.length;
    };
    expect(avg('DXB2')).toBeLessThan(0.8);
    expect(avg('DXB1')).toBeGreaterThan(0.95);
  });

  it('S2: New York channel mix shows net revenue after commission', async () => {
    const { rows } = await data.getChannelMix({ hotels: ['NYC'], from: '2026-06-01', to: '2026-10-31' });
    expect(rows.length).toBeGreaterThan(3);
    for (const r of rows) expect(r.net_revenue_eur).toBeLessThanOrEqual(r.gross_revenue_eur);
  });

  it('S7: Berlin POS feed is flagged stale', async () => {
    const { rows } = await data.getDataHealth({ hotels: ['BER'] });
    expect(rows.find((r) => r.system === 'POS')?.status).toBe('stale');
  });
});

describe('runReadonlyQuery', () => {
  it('runs a SELECT and returns rows with evidence', async () => {
    const result = await data.runReadonlyQuery("select hotel_code, rooms from hotels where region = 'Asia' order by 1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(3);
      expect(result.value.evidence.sql).toMatch(/limit 200$/);
    }
  });

  it('refuses writes before they reach the database', async () => {
    const result = await data.runReadonlyQuery('delete from hotels');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('rejected');
  });

  it('returns a database error as a value the model can repair', async () => {
    const result = await data.runReadonlyQuery('select no_such_column from hotels');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toEqual({ kind: 'database', message: expect.stringMatching(/no_such_column/) });
  });

  it('runs analytic SQL with the helper functions through the wrapper', async () => {
    const result = await data.runReadonlyQuery(`
      with p as (select * from hotel.pace_vs_stly('LIS', 30))
      select h.hotel_code, round(hotel.eur_rate(h.currency, hotel.business_date()), 4) as rate,
             row_number() over (order by h.hotel_code) as n,
             (select count(*) from p) as pace_rows
        from hotel.hotels h
       where h.region = 'Europe' -- a trailing comment must not swallow the row cap`);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.value.rows.length).toBeGreaterThan(0);
  });

  it('fails a query whose rows are too large instead of streaming them to the Worker', async () => {
    const result = await data.runReadonlyQuery("select repeat('x', 1000000) as huge");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ kind: 'database', message: expect.stringMatching(/Result row larger than/) });
  });

  it('caps the rows even when the query asks for more', async () => {
    const result = await data.runReadonlyQuery('select g from generate_series(1, 100000) as g');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rows).toHaveLength(200);
  });
});

describe('planted stories S2–S5', () => {
  it('S2: New York corporate share of room nights falls by over a quarter, OTA share rises', async () => {
    const before = await data.getMix({ hotels: ['NYC'], from: '2025-11-20', to: '2026-05-03', grain: 'total', by: 'segment' });
    const after = await data.getMix({ hotels: ['NYC'], from: '2026-06-02', to: '2026-11-19', grain: 'total', by: 'segment' });
    const share = (r: typeof before.rows, key: string) => r.find((x) => x.key === key)?.share_pct ?? 0;
    expect(share(after.rows, 'COR')).toBeLessThan(0.75 * share(before.rows, 'COR'));

    const otaBefore = await data.getMix({ hotels: ['NYC'], from: '2025-11-20', to: '2026-05-03', grain: 'total', by: 'channel_type' });
    const otaAfter = await data.getMix({ hotels: ['NYC'], from: '2026-06-02', to: '2026-11-19', grain: 'total', by: 'channel_type' });
    expect(share(otaAfter.rows, 'OTA')).toBeGreaterThan(share(otaBefore.rows, 'OTA') + 2);
  });

  it('S2: Vantor Consulting stops staying in New York', async () => {
    const { rows } = await data.getAccountProduction({ from: '2026-05-23', to: '2026-11-19' });
    expect(rows[0]!.hotel_code).toBe('NYC'); // across the whole group, the biggest decline comes first
    const vantor = rows.find((r) => r.account === 'Vantor Consulting' && r.hotel_code === 'NYC')!;
    expect(vantor.previous_room_nights).toBeGreaterThan(100);
    expect(vantor.room_nights).toBeLessThan(0.2 * vantor.previous_room_nights);
    expect(vantor.revenue_change_eur).toBeLessThan(-1_000_000);
    expect(vantor.last_stay_date).toBe('2026-07-15'); // the account left; its last booked stays ran out in July
  });

  it('S4: Booking.com share of new bookings in Amsterdam rises (by booking date)', async () => {
    const recent = await data.getMix({ hotels: ['AMS'], from: '2026-10-21', to: '2026-11-19', grain: 'total', by: 'channel', basis: 'booked' });
    const before = await data.getMix({ hotels: ['AMS'], from: '2026-08-22', to: '2026-10-20', grain: 'total', by: 'channel', basis: 'booked' });
    const bdc = (r: typeof recent.rows) => r.find((x) => x.key === 'BDC')!.share_pct;
    expect(bdc(recent.rows)).toBeGreaterThan(bdc(before.rows) + 4);
  });

  it('S3: Bali kitchen ran under 75% of required hours during the shortage', async () => {
    const { rows } = await data.getLabor({ hotels: ['DPS'], department: 'Kitchen', from: '2026-10-06', to: '2026-11-10', grain: 'total' });
    expect(rows[0]!.staffing_pct).toBeLessThan(75);
  });

  it('S3: Bali dinner covers per occupied room drop, and the food score with them', async () => {
    const window = { hotels: ['DPS'], grain: 'total' as const, mealPeriods: ['dinner', 'all_day'] };
    const during = await data.getFnb({ ...window, from: '2026-10-06', to: '2026-11-10' });
    const before = await data.getFnb({ ...window, from: '2026-07-23', to: '2026-10-05' });
    const cpor = (r: typeof during.rows) => r.reduce((s, x) => s + x.covers, 0) / r[0]!.rooms_sold;
    expect(cpor(during.rows)).toBeLessThan(0.75 * cpor(before.rows));

    const reviewsDuring = await data.getReviewScores({ hotels: ['DPS'], from: '2026-10-16', to: '2026-11-19', grain: 'total' });
    const reviewsBefore = await data.getReviewScores({ hotels: ['DPS'], from: '2026-06-01', to: '2026-09-30', grain: 'total' });
    expect(reviewsDuring.rows[0]!.food).toBeLessThan(reviewsBefore.rows[0]!.food - 1.0);
  });

  it('S4: Amsterdam mobile conversion falls, desktop holds', async () => {
    const last30 = await data.getWebFunnel({ hotels: ['AMS'], from: '2026-10-21', to: '2026-11-19', grain: 'total', by: 'device' });
    const prior = await data.getWebFunnel({ hotels: ['AMS'], from: '2026-08-22', to: '2026-10-20', grain: 'total', by: 'device' });
    const conv = (r: typeof last30.rows, d: string) => r.find((x) => x.key === d)!.conversion_pct;
    expect(conv(last30.rows, 'mobile')).toBeLessThan(0.6 * conv(prior.rows, 'mobile'));
    expect(Math.abs(conv(last30.rows, 'desktop') / conv(prior.rows, 'desktop') - 1)).toBeLessThan(0.25);
  });

  it('S5: Barcelona has 24+ rooms out of order, and guests mention construction noise', async () => {
    const { rows } = await data.getInventory({ hotels: ['BCN'], from: '2026-09-21', to: '2026-12-20', grain: 'total' });
    expect(rows[0]!.min_out_of_order).toBeGreaterThanOrEqual(24);
    const quotes = await data.searchReviews({ hotels: ['BCN'], text: 'construction noise', limit: 10 });
    expect(quotes.rows.length).toBeGreaterThanOrEqual(5);
    expect(quotes.rows[0]!.negative_text.toLowerCase()).toContain('construction noise');
  });
});
