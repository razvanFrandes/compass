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
    if (!result.ok) {
      expect(result.error.kind).toBe('database');
      expect(result.error.message).toMatch(/no_such_column/);
    }
  });
});
