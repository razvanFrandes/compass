import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HotelData } from '../src/application/hotel-data.ts';
import { openPostgres, type PostgresDb } from '../src/infrastructure/postgres.ts';

// The shapes the data layer gives a widget that the plain rows cannot draw: headline KPIs in one row, a GOP bridge,
// channel flows, a rolled-up mix and rate against occupancy. Integration tests against the local Halcyon database;
// every expected number comes from another governed method or an oracle query over the raw tables.
process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);

let db: PostgresDb;
let data: HotelData;

beforeAll(() => {
  db = openPostgres(process.env['DATABASE_URL']!);
  data = new HotelData(db);
});
afterAll(() => db.close());

const october = { from: '2026-10-01', to: '2026-10-31' };
const sumOf = <T>(rows: readonly T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);

describe('getKpis: the headline figures in one row', () => {
  it('gives occupancy, ADR, RevPAR, room revenue and rooms sold with last year, equal to the governed metrics', async () => {
    const result = await data.getKpis({ by: 'group', ...october });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(1);
    const row = result.value.rows[0]!;
    expect(row.key).toBe('Halcyon group');

    const columns = { occupancy: 'occupancy', adr: 'adr', revpar: 'revpar', room_revenue: 'room_revenue', rooms_sold: 'rooms_sold' } as const;
    const names = { occupancy: ['occupancy_pct', 'occupancy_ly_pct'], adr: ['adr_eur', 'adr_ly_eur'], revpar: ['revpar_eur', 'revpar_ly_eur'], room_revenue: ['room_revenue_eur', 'room_revenue_ly_eur'], rooms_sold: ['rooms_sold', 'rooms_sold_ly'] } as const;
    // One after another: the database is shared with the other suites, and its read-only role cancels a query after 5 s.
    for (const metric of Object.values(columns)) {
      const governed = await data.getMetric({ metric, by: 'group', grain: 'total', compare: 'stly', ...october });
      if (!governed.ok) throw new Error('getMetric failed');
      const [value, lastYear] = names[metric];
      expect(Number(row[value]), value).toBe(Number(governed.value.rows[0]!.value));
      expect(Number(row[lastYear]), lastYear).toBe(Number(governed.value.rows[0]!.compare_value));
    }
    // Comp set indices are per hotel only, so a roll-up has none.
    expect(row).not.toHaveProperty('mpi');
    expect(result.value.evidence.period).toEqual(october);
  });

  it('keeps one region when asked for it', async () => {
    const result = await data.getKpis({ by: 'region', region: 'Asia', ...october });
    if (!result.ok) throw new Error('getKpis failed');
    expect(result.value.rows.map((row) => row.key)).toEqual(['Asia']);
    const asia = await data.getMetric({ metric: 'room_revenue', hotels: ['DPS', 'SIN', 'TYO'], by: 'region', grain: 'total', ...october });
    if (!asia.ok) throw new Error('getMetric failed');
    expect(result.value.rows[0]!.room_revenue_eur).toBe(asia.value.rows[0]!.value);
  });

  it('per hotel, adds the region and the comp set indices, so a scatter or a treemap can be drawn from it', async () => {
    const result = await data.getKpis({ by: 'hotel', ...october });
    if (!result.ok) throw new Error('getKpis failed');
    expect(result.value.rows).toHaveLength(20);
    const lisbon = result.value.rows.find((row) => row.key === 'LIS')!;
    expect(lisbon.region).toBe('Europe');
    for (const metric of ['mpi', 'ari', 'rgi'] as const) {
      const governed = await data.getMetric({ metric, hotels: ['LIS'], grain: 'total', ...october });
      if (!governed.ok) throw new Error('getMetric failed');
      expect(lisbon[metric], metric).toBe(governed.value.rows[0]!.value);
    }
  });

  it('rejects a period that ends before it starts', async () => {
    const result = await data.getKpis({ by: 'group', from: '2026-10-31', to: '2026-10-01' });
    expect(result.ok).toBe(false);
  });
});

describe('getChannelMix: rolled up, and as flows', () => {
  it('shape "total" gives one row per channel, summed over the hotels', async () => {
    const perHotel = await data.getChannelMix({ hotels: ['LIS', 'BCN'], ...october });
    const total = await data.getChannelMix({ hotels: ['LIS', 'BCN'], shape: 'total', ...october });
    const channels = total.rows.map((row) => row.channel);
    expect(new Set(channels).size).toBe(channels.length);
    expect(total.rows[0]).not.toHaveProperty('hotel_code');
    // Each hotel's amount is rounded to the euro before it is summed here, so allow a euro per hotel.
    expect(Math.abs(sumOf(total.rows, (row) => row.net_revenue_eur) - sumOf(perHotel.rows, (row) => row.net_revenue_eur))).toBeLessThanOrEqual(channels.length * 2);
    expect(sumOf(total.rows, (row) => row.room_nights)).toBe(sumOf(perHotel.rows, (row) => row.room_nights));
  });

  it('shape "flows" sends each channel to net revenue and to commission, with no empty flow', async () => {
    const total = await data.getChannelMix({ hotels: ['LIS'], shape: 'total', ...october });
    const flows = await data.getChannelMix({ hotels: ['LIS'], shape: 'flows', ...october });
    expect(Object.keys(flows.rows[0]!).sort()).toEqual(['amount_eur', 'channel', 'lands_in']);
    expect(new Set(flows.rows.map((row) => row.lands_in))).toEqual(new Set(['Net revenue', 'Commission']));
    expect(flows.rows.every((row) => row.amount_eur > 0)).toBe(true);
    for (const channel of total.rows) {
      const net = flows.rows.find((row) => row.channel === channel.channel && row.lands_in === 'Net revenue');
      const commission = flows.rows.find((row) => row.channel === channel.channel && row.lands_in === 'Commission');
      expect(net?.amount_eur ?? 0, channel.channel).toBe(channel.net_revenue_eur);
      expect(commission?.amount_eur ?? 0, channel.channel).toBe(channel.commission_eur);
    }
  });
});

describe('getChannelMix: the totals come from SQL, so nobody has to add the channels up', () => {
  const totalsOf = (notes: string[]) => {
    const note = notes.find((line) => line.startsWith('Totals over these channels'));
    const [gross, commission, net] = [...(note ?? '').matchAll(/([\d,]+) EUR/g)].map((match) => Number(match[1]!.replaceAll(',', '')));
    return { note, gross, commission, net, pct: Number(/\(([\d.]+)% of gross\)/.exec(note ?? '')?.[1]) };
  };

  it('shape "total" says the gross, commission and net totals and the commission share in its notes', async () => {
    const total = await data.getChannelMix({ hotels: ['LIS', 'BCN'], shape: 'total', ...october });
    const totals = totalsOf(total.evidence.notes);
    expect(totals.note).toBeDefined();
    // Each channel row is rounded to the euro on its own.
    const slack = total.rows.length;
    expect(Math.abs(totals.gross! - sumOf(total.rows, (row) => row.gross_revenue_eur))).toBeLessThanOrEqual(slack);
    expect(Math.abs(totals.commission! - sumOf(total.rows, (row) => row.commission_eur))).toBeLessThanOrEqual(slack);
    expect(Math.abs(totals.net! - sumOf(total.rows, (row) => row.net_revenue_eur))).toBeLessThanOrEqual(slack);
    expect(totals.pct).toBeCloseTo((100 * totals.commission!) / totals.gross!, 1);
    // The totals are said once, not repeated on every row.
    expect(Object.keys(total.rows[0]!).sort()).toEqual(['channel', 'channel_type', 'commission_eur', 'commission_pct', 'gross_revenue_eur', 'net_revenue_eur', 'room_nights']);
  });

  it('gives each channel its commission as a share of its gross revenue, so the ratio is not worked out by hand', async () => {
    for (const shape of ['hotel', 'total'] as const) {
      const { rows } = await data.getChannelMix({ hotels: ['LIS'], shape, ...october });
      const paid = rows.find((row) => row.commission_eur > 0)!;
      // From unrounded sums in SQL; the rounded euros of the row give the same to a tenth of a point.
      expect(paid.commission_pct, shape).toBeCloseTo((100 * paid.commission_eur) / paid.gross_revenue_eur, 1);
      expect(rows.find((row) => row.commission_eur === 0)?.commission_pct ?? 0, shape).toBe(0);
    }
  });

  it('shape "flows" says the same totals', async () => {
    const total = await data.getChannelMix({ hotels: ['LIS'], shape: 'total', ...october });
    const flows = await data.getChannelMix({ hotels: ['LIS'], shape: 'flows', ...october });
    expect(totalsOf(flows.evidence.notes).note).toBeDefined();
    expect(totalsOf(flows.evidence.notes)).toMatchObject({ gross: totalsOf(total.evidence.notes).gross, net: totalsOf(total.evidence.notes).net });
    expect(Object.keys(flows.rows[0]!).sort()).toEqual(['amount_eur', 'channel', 'lands_in']);
  });

  it('the per-hotel shape has no group totals', async () => {
    const perHotel = await data.getChannelMix({ hotels: ['LIS'], ...october });
    expect(perHotel.evidence.notes.some((line) => line.startsWith('Totals'))).toBe(false);
  });
});

describe('getMix: rolled up over the hotels', () => {
  it('gives one row per period and key, with shares that add up to 100', async () => {
    const perHotel = await data.getMix({ by: 'segment', grain: 'total', ...october });
    const rolled = await data.getMix({ by: 'segment', grain: 'total', rollUp: true, ...october });
    expect(rolled.rows[0]).not.toHaveProperty('hotel_code');
    const keys = rolled.rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(sumOf(rolled.rows, (row) => row.room_nights)).toBe(sumOf(perHotel.rows, (row) => row.room_nights));
    expect(sumOf(rolled.rows, (row) => row.share_pct)).toBeCloseTo(100, 0);
  });
});

describe('getPace: night by night, for a window of stay dates', () => {
  const december = { from: '2026-12-01', to: '2026-12-31' };

  it('grain "day" gives one row per night with what is on the books now and at the same time last year', async () => {
    const nights = await data.getPace({ hotels: ['LIS'], grain: 'day', ...december });
    expect(nights.rows).toHaveLength(31);
    expect(nights.rows[0]).toMatchObject({ hotel_code: 'LIS', stay_date: '2026-12-01' });
    expect(nights.rows.at(-1)!.stay_date).toBe('2026-12-31');
    const oracle = await db.query<{ otb: number; stly: number }>(
      `select sum(rooms_otb)::int as otb, sum(rooms_otb_stly)::int as stly from hotel.pace_vs_stly('LIS', 60)
        where stay_date between '2026-12-01' and '2026-12-31'`,
    );
    expect(sumOf(nights.rows, (row) => row.rooms_otb)).toBe(oracle[0]!.otb);
    expect(sumOf(nights.rows, (row) => row.rooms_otb_stly)).toBe(oracle[0]!.stly);
  });

  it('the total for a window covers only its stay dates, even past the default days ahead', async () => {
    const nights = await data.getPace({ hotels: ['LIS'], grain: 'day', ...december });
    const total = await data.getPace({ hotels: ['LIS'], daysAhead: 7, ...december });
    expect(total.rows).toHaveLength(1);
    expect(total.rows[0]!.rooms_otb).toBe(sumOf(nights.rows, (row) => row.rooms_otb));
    expect(total.rows[0]!.rooms_otb_stly).toBe(sumOf(nights.rows, (row) => row.rooms_otb_stly));
    expect(total.evidence.period).toEqual(december);
  });
});

describe('getRatePosition: rate against demand', () => {
  it('adds the occupancy on the books of each night', async () => {
    const result = await data.getRatePosition({ hotels: ['DXB2'], from: '2026-12-14', to: '2026-12-16' });
    expect(result.rows).toHaveLength(3);
    const oracle = await db.query<{ day: string; occ: number }>(
      `select to_char(date, 'YYYY-MM-DD') as day, round(100.0 * rooms_sold / nullif(rooms_available, 0), 1)::float8 as occ
         from hotel.v_hotel_day where hotel_code = 'DXB2' and date between '2026-12-14' and '2026-12-16' order by 1`,
    );
    expect(result.rows.map((row) => [row.stay_date, row.occupancy_otb_pct])).toEqual(oracle.map((row) => [row.day, row.occ]));
  });

  it('grain "total" gives one row per hotel: the average rates, and the ratio from their sums', async () => {
    const nights = await data.getRatePosition({ hotels: ['DXB1', 'DXB2'], from: '2026-12-01', to: '2026-12-20' });
    const total = await data.getRatePosition({ hotels: ['DXB1', 'DXB2'], from: '2026-12-01', to: '2026-12-20', grain: 'total' });
    expect(total.rows.map((row) => row.hotel_code)).toEqual(['DXB1', 'DXB2']);
    // Only the nights the rate shop has a median for: a night without one cannot be compared.
    const dxb2 = nights.rows.filter((row) => row.hotel_code === 'DXB2' && row.comp_median !== null);
    expect(dxb2.length).toBeGreaterThan(0);
    const row = total.rows[1]!;
    expect(row.nights).toBe(dxb2.length);
    expect(row.bar_rate).toBeCloseTo(sumOf(dxb2, (night) => night.bar_rate) / dxb2.length, 1);
    expect(row.comp_median).toBeCloseTo(sumOf(dxb2, (night) => night.comp_median) / dxb2.length, 1);
    expect(row.bar_vs_comp).toBeCloseTo(sumOf(dxb2, (night) => night.bar_rate) / sumOf(dxb2, (night) => night.comp_median), 2);
    expect(row).not.toHaveProperty('stay_date');
  });
});

describe('getPnl view "bridge": from budget GOP to GOP, step by step', () => {
  it('opens with the budget, closes with the GOP, and the steps between add up to the difference', async () => {
    const bridge = await data.finance.getPnl({ hotels: ['MIA'], view: 'bridge', ...october });
    const summary = await data.finance.getPnl({ hotels: ['MIA'], grain: 'total', ...october });
    if (!bridge.ok || !summary.ok) throw new Error('getPnl failed');
    const rows = bridge.value.rows;
    const first = rows[0]!;
    const last = rows.at(-1)!;
    expect(first).toMatchObject({ key: 'MIA', step: 'Budget GOP', kind: 'total', amount_eur: summary.value.rows[0]!.gop_budget_eur });
    expect(last).toMatchObject({ step: 'GOP', kind: 'total', amount_eur: summary.value.rows[0]!.gop_eur });
    const steps = rows.slice(1, -1);
    expect(steps.every((row) => row.kind === 'step')).toBe(true);
    expect(new Set(rows.map((row) => row.step)).size).toBe(rows.length);
    // Each step is rounded to the euro on its own.
    expect(Math.abs(first.amount_eur + sumOf(steps, (row) => row.amount_eur) - last.amount_eur)).toBeLessThanOrEqual(steps.length);
  });

  it('counts spending above budget as a step down, and revenue above budget as a step up', async () => {
    const bridge = await data.finance.getPnl({ hotels: ['MIA'], view: 'bridge', ...october });
    const lines = await data.finance.getPnl({ hotels: ['MIA'], view: 'lines', grain: 'total', ...october });
    if (!bridge.ok || !lines.ok) throw new Error('getPnl failed');
    const line = (name: string) => lines.value.rows.find((row) => row.line === name)!;
    const step = (name: string) => bridge.value.rows.find((row) => row.step === name)!;
    expect(step('Rooms revenue').amount_eur).toBe(line('ROOMS_REVENUE').var_eur);
    expect(step('Rooms expense').amount_eur).toBe(-line('ROOMS_EXPENSE').var_eur);
    // The subtotals are not steps: they would be counted twice.
    expect(bridge.value.rows.map((row) => row.step)).not.toContain('Total revenue');
  });

  it('shows what the budget lines do not explain of the budget GOP as its own step, just before the GOP', async () => {
    const bridge = await data.finance.getPnl({ hotels: ['MIA'], view: 'bridge', ...october });
    if (!bridge.ok) throw new Error('getPnl failed');
    const o = (
      await db.query<{ gop_b: number; lines_b: number }>(
        `select sum(amount) filter (where line = 'GOP')::float8 as gop_b,
                sum(case when line like '%EXPENSE' then -amount when line in ('ROOMS_REVENUE', 'FNB_REVENUE', 'ME_REVENUE', 'OTHER_REVENUE') then amount else 0 end)::float8 as lines_b
           from hotel.pnl_monthly where hotel_code = 'MIA' and month = '2026-10-01' and scenario = 'budget'`,
      )
    )[0]!;
    const row = bridge.value.rows.at(-2)!;
    expect(row).toMatchObject({ step: 'Unallocated in budget', kind: 'step' });
    // MIA reports in USD and October's rate is one number, so the oracle converts with the tool's own summary row.
    const summary = await data.finance.getPnl({ hotels: ['MIA'], grain: 'total', ...october });
    if (!summary.ok) throw new Error('getPnl failed');
    const rate = summary.value.rows[0]!.gop_budget_eur / o.gop_b;
    expect(Math.abs(row.amount_eur - (o.lines_b - o.gop_b) * rate)).toBeLessThan(2);
  });

  it('bridges from last year when asked', async () => {
    const bridge = await data.finance.getPnl({ by: 'group', view: 'bridge', against: 'ly', ...october });
    const summary = await data.finance.getPnl({ by: 'group', grain: 'total', ...october });
    if (!bridge.ok || !summary.ok) throw new Error('getPnl failed');
    expect(bridge.value.rows[0]).toMatchObject({ step: 'GOP last year', kind: 'total', amount_eur: summary.value.rows[0]!.gop_ly_eur });
    expect(bridge.value.rows.at(-1)).toMatchObject({ step: 'GOP', amount_eur: summary.value.rows[0]!.gop_eur });
    // Actuals add up line by line, so nothing is left unexplained.
    expect(bridge.value.rows.map((row) => row.step)).not.toContain('Unallocated in budget');
  });

  it('refuses more than one hotel or roll-up at a time, and says how to ask', async () => {
    const result = await data.finance.getPnl({ hotels: ['MIA', 'NYC'], view: 'bridge', ...october });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid');
    expect((result.error as { message: string }).message).toMatch(/one hotel|by: "group"/);
  });
});
