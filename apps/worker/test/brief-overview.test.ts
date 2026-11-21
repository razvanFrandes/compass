import type { BriefChart, BriefItem, BriefOverview, WidgetSpec } from '@compass/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detectBriefItems } from '../src/application/brief-detectors.ts';
import { briefOverview, OverviewCache } from '../src/application/brief-overview.ts';
import type { Db } from '../src/application/ports.ts';
import { fitWidget } from '../src/application/widgets/fit.ts';
import { openPostgres, type PostgresDb } from '../src/infrastructure/postgres.ts';
import { hotelsParam } from '../src/presentation/http/routes.ts';

// Integration tests against the local Halcyon database (compass-datagen), through the read-only role.
process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);

const ASIA = ['DPS', 'SIN', 'TYO'];

let db: PostgresDb;
let items: BriefItem[];
let group: BriefOverview;
let asia: BriefOverview;
let lisbon: BriefOverview;

beforeAll(async () => {
  db = openPostgres(process.env['DATABASE_URL']!);
  items = await detectBriefItems(db);
  [group, asia, lisbon] = await Promise.all([briefOverview(db, { items }), briefOverview(db, { hotels: ASIA, items }), briefOverview(db, { hotels: ['LIS'], items })]);
}, 60_000);
afterAll(() => db.close());

const one = async <Row>(sql: string, params: unknown[] = []) => (await db.query<Row>(sql, params))[0]!;
const tile = (overview: BriefOverview, key: string) => overview.pulse!.tiles.find((t) => t.key === key)!;

describe('overview: the whole group', () => {
  it('reads every part and says which hotels it is for', () => {
    expect(group.failed).toEqual([]);
    expect(group.businessDate).toBe('2026-11-20');
    expect(group.hotels).toEqual([]);
    expect(asia.hotels).toEqual(ASIA);
  });
});

describe('Pulse', () => {
  it('has the nine tiles, in order, each with a value, a comparison and a series', () => {
    expect(group.pulse!.tiles.map((t) => t.key)).toEqual(['occupancy', 'adr', 'revpar', 'room_revenue', 'pace', 'total_revenue', 'trevpar', 'gop', 'gop_margin']);
    for (const t of group.pulse!.tiles) {
      expect(t.value, t.key).toBeTypeOf('number');
      expect(t.compare, t.key).toBeTypeOf('number');
      expect(t.delta, t.key).toBeTypeOf('number');
      expect(t.series.length, t.key).toBeGreaterThanOrEqual(12);
      expect(t.definition.length, t.key).toBeGreaterThan(20);
    }
    expect(group.pulse!.from).toBe('2026-11-20');
    expect(group.pulse!.to).toBe('2026-12-19');
    expect(tile(group, 'occupancy').series).toHaveLength(30);
    expect(tile(group, 'occupancy').period).toBe('Next 30 nights');
    expect(tile(group, 'gop').period).toBe('Oct 2026');
    expect(tile(group, 'gop').basis).toBe('Oct 2025');
  });

  it('follows the scope: Asia’s occupancy is the sum of its three hotels, not the group’s', async () => {
    const direct = await one<{ occ: number; rooms: number }>(
      `select round(100.0 * sum(p.rooms_otb) / sum(i.rooms_available), 1)::float8 as occ, sum(p.rooms_otb)::int as rooms
         from hotel.pace_vs_stly(null, 29) p join hotel.room_inventory_daily i on i.hotel_code = p.hotel_code and i.date = p.stay_date
        where p.hotel_code = any($1::text[])`,
      [ASIA],
    );
    expect(tile(asia, 'occupancy').value).toBe(direct.occ);
    expect(tile(asia, 'pace').value).toBe(direct.rooms);
    expect(tile(asia, 'occupancy').value).not.toBe(tile(group, 'occupancy').value);
    expect(tile(asia, 'room_revenue').value).toBeLessThan(tile(group, 'room_revenue').value!);
  });

  it('RevPAR is room revenue over rooms available, so occupancy × ADR', () => {
    const [occ, adr, revpar] = ['occupancy', 'adr', 'revpar'].map((key) => tile(group, key).value!);
    expect(revpar).toBeCloseTo((occ! / 100) * adr!, 0);
  });

  it('S1: Lisbon is behind last year on occupancy and on pace', () => {
    expect(tile(lisbon, 'occupancy').delta).toBeLessThan(-5);
    expect(tile(lisbon, 'occupancy').deltaUnit).toBe('pp');
    expect(tile(lisbon, 'pace').delta).toBeLessThan(-10);
    expect(tile(lisbon, 'pace').deltaUnit).toBe('pct');
  });

  it('the GOP tile is the last closed month of the P&L, in EUR', async () => {
    const direct = await one<{ gop: number }>(
      `select round(sum(amount * hotel.eur_rate(currency, month)))::float8 as gop from hotel.pnl_monthly
        where scenario = 'actual' and line = 'GOP' and month = '2026-10-01' and hotel_code = any($1::text[])`,
      [ASIA],
    );
    expect(asia.pulse!.month).toBe('2026-10-01');
    expect(tile(asia, 'gop').value).toBe(direct.gop);
    expect(tile(asia, 'gop').series.at(-1)).toMatchObject({ x: '2026-10-01', value: direct.gop });
  });

  it('the P&L tiles are also read against the month’s budget; the on-the-books tiles have one comparison', async () => {
    const direct = await one<{ gop: number; budget: number; rev: number }>(
      `select sum(amount * hotel.eur_rate(currency, month)) filter (where scenario = 'actual' and line = 'GOP')::float8 as gop,
              sum(amount * hotel.eur_rate(currency, month)) filter (where scenario = 'budget' and line = 'GOP')::float8 as budget,
              sum(amount * hotel.eur_rate(currency, month)) filter (where scenario = 'actual' and line = 'TOTAL_REVENUE')::float8 as rev
         from hotel.pnl_monthly where month = '2026-10-01' and hotel_code = 'MIA'`,
    );
    const miami = await briefOverview(db, { hotels: ['MIA'] });
    // Miami missed its October GOP budget by about a fifth (the brief's gop_miss finding).
    expect(tile(miami, 'gop').also).toEqual({ delta: Math.round(1000 * (direct.gop / direct.budget - 1)) / 10, deltaUnit: 'pct', basis: 'budget' });
    expect(tile(miami, 'gop').also!.delta).toBeLessThan(-10);
    expect(tile(miami, 'gop_margin').value).toBe(Math.round((1000 * direct.gop) / direct.rev) / 10);
    expect(tile(miami, 'gop_margin')).toMatchObject({ unit: 'percent', deltaUnit: 'pp', also: { deltaUnit: 'pp', basis: 'budget' } });
    expect(tile(miami, 'total_revenue').value).toBe(Math.round(direct.rev));
    expect(tile(miami, 'occupancy').also).toBeUndefined();
  });
});

describe('Next 14 nights', () => {
  it('has one row per night for the scope and one per hotel and night', () => {
    expect(group.nights!.total).toHaveLength(14);
    expect(group.nights!.hotels).toHaveLength(14 * 20);
    expect(asia.nights!.hotels).toHaveLength(14 * 3);
    expect(new Set(asia.nights!.hotels.map((n) => n.hotel_code))).toEqual(new Set(ASIA));
    expect(group.nights!.from).toBe('2026-11-20');
    expect(group.nights!.to).toBe('2026-12-03');
    expect(group.nights!.total.map((n) => n.stay_date)).toEqual([...group.nights!.total.map((n) => n.stay_date)].sort());
  });

  it('the scope’s occupancy comes from sums over its hotels', () => {
    const night = asia.nights!.total[3]!;
    const hotels = asia.nights!.hotels.filter((n) => n.stay_date === night.stay_date);
    expect(night.rooms_otb).toBe(hotels.reduce((sum, n) => sum + n.rooms_otb, 0));
    expect(night.rooms_available).toBe(hotels.reduce((sum, n) => sum + n.rooms_available, 0));
    expect(night.occupancy_pct).toBeCloseTo((100 * night.rooms_otb) / night.rooms_available, 1);
  });

  it('marks city events on the nights of the hotels in that city', () => {
    const berlin = group.nights!.hotels.filter((n) => n.hotel_code === 'BER' && n.event);
    expect(berlin.map((n) => n.stay_date)).toEqual(['2026-11-25', '2026-11-26', '2026-11-27']);
    expect(berlin[0]!.event).toBe('Spree Fintech Forum');
    expect(group.nights!.total.find((n) => n.stay_date === '2026-11-25')!.events).toBeGreaterThanOrEqual(1);
  });

  it('flags the nights whose rate is out of line: under the market when busy, over it when behind last year', () => {
    const flagged = (code: string, flag: string) => group.nights!.hotels.filter((n) => n.hotel_code === code && n.rate_flag === flag);
    // Dubai Marina, 28 Nov: 0.83× the comp set with three competitors sold out (the brief detector's own rule).
    expect(flagged('DXB1', 'underpriced').map((n) => n.stay_date)).toContain('2026-11-28');
    // Lisbon is priced far above its comp set on nights that trail last year (story S1).
    expect(flagged('LIS', 'overpriced').length).toBeGreaterThan(3);
    for (const n of flagged('LIS', 'overpriced')) {
      expect(n.bar_vs_comp).toBeGreaterThanOrEqual(1.25);
      expect(n.rooms_otb).toBeLessThan(0.85 * n.rooms_otb_stly);
    }
    const day = group.nights!.total.find((n) => n.stay_date === '2026-11-28')!;
    expect(day.rate_flags).toBe(group.nights!.hotels.filter((n) => n.stay_date === '2026-11-28' && n.rate_flag).length);
  });
});

describe('Pickup, last 7 days', () => {
  it('counts room nights booked and cancelled per booking day', async () => {
    expect(group.pickup!.byDay.map((d) => d.booking_date)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
    const direct = await one<{ booked: number; cancelled: number }>(
      `select (select sum(nights) from hotel.reservations where created_at::date = '2026-11-19')::int as booked,
              (select sum(nights) from hotel.reservations where cancelled_at::date = '2026-11-19')::int as cancelled`,
    );
    const day = group.pickup!.byDay.find((d) => d.booking_date === '2026-11-19')!;
    expect(day).toMatchObject({ booked: direct.booked, cancelled: direct.cancelled, net: direct.booked - direct.cancelled });
    expect(day.net_ly).toBeGreaterThan(0);
  });

  it('gives the same days per hotel, for the hotels of the scope only', () => {
    expect(group.pickup!.byHotel).toHaveLength(20);
    expect(asia.pickup!.byHotel.map((h) => h.hotel_code).sort()).toEqual(ASIA);
    const sum = (key: 'booked' | 'cancelled' | 'net') => asia.pickup!.byHotel.reduce((total, h) => total + h[key], 0);
    expect(sum('net')).toBe(asia.pickup!.byDay.reduce((total, d) => total + d.net, 0));
    expect(sum('booked') - sum('cancelled')).toBe(sum('net'));
    expect(asia.pickup!.byHotel.every((h) => h.revenue_eur > 0)).toBe(true);
  });
});

describe('Where the money is', () => {
  it('gives each hotel’s room revenue on the books against the same time last year', () => {
    expect(group.money!.byHotel).toHaveLength(20);
    expect(asia.money!.byHotel.map((h) => h.hotel_code).sort()).toEqual(ASIA);
    const lis = group.money!.byHotel.find((h) => h.hotel_code === 'LIS')!;
    expect(lis.region).toBe('Europe');
    expect(lis.change_eur).toBeLessThan(0);
    expect(lis.change_eur).toBeCloseTo(lis.revenue_eur - lis.revenue_stly_eur, -1);
  });

  it('the weeks add up to the hotels, and to the Pulse revenue tile', () => {
    const byHotel = asia.money!.byHotel.reduce((sum, h) => sum + h.revenue_eur, 0);
    const byWeek = asia.money!.byWeek.reduce((sum, w) => sum + w.revenue_eur, 0);
    expect(Math.abs(byHotel - byWeek)).toBeLessThan(10);
    expect(Math.abs(byHotel - tile(asia, 'room_revenue').value!)).toBeLessThan(10);
    expect(asia.money!.byWeek.map((w) => w.week)).toEqual([...asia.money!.byWeek.map((w) => w.week)].sort());
  });
});

describe('Data health', () => {
  it('S7: Berlin’s POS feed is three days behind; the rest are fresh', () => {
    const stale = group.health!.filter((f) => f.status !== 'ok');
    expect(stale).toEqual([{ hotel_code: 'BER', system: 'POS', vendor: 'Lightspeed', status: 'stale', last_sync_at: '2026-11-17 04:12', days_behind: 3 }]);
    expect(group.health![0]).toMatchObject({ hotel_code: 'BER', system: 'POS' });
    expect(group.health!).toHaveLength(20 * 7);
  });

  it('follows the scope', () => {
    expect(asia.health!).toHaveLength(3 * 7);
    expect(asia.health!.every((f) => f.status === 'ok' && ASIA.includes(f.hotel_code))).toBe(true);
  });
});

describe('a chart per finding', () => {
  const asSpec = (chart: BriefChart): WidgetSpec => ({
    kind: chart.kind,
    title: chart.title,
    sourceCallId: 'brief',
    ...(chart.subtitle ? { subtitle: chart.subtitle } : {}),
    ...(chart.x ? { x: chart.x } : {}),
    ...(chart.y ? { y: chart.y } : {}),
    ...(chart.group ? { group: chart.group } : {}),
    ...(chart.compare ? { compare: chart.compare } : {}),
    ...(chart.format ? { format: chart.format } : {}),
  });
  const chartOf = (kind: BriefItem['kind'], hotel: string) => group.charts[items.find((i) => i.kind === kind && i.hotel_code === hotel)!.id]!;

  it('every finding has a chart, and every chart passes the catalogue’s fit rules', () => {
    expect(Object.keys(group.charts).sort()).toEqual(items.map((i) => i.id).sort());
    for (const [id, chart] of Object.entries(group.charts)) {
      const fit = fitWidget(asSpec(chart), { rows: chart.rows, columns: chart.columns });
      expect(fit.ok ? '' : `${id}: ${fit.error}`).toBe('');
      // Every row property has a column, so nothing on the chart is guessed from a key.
      const keys = new Set(chart.columns.map((c) => c.key));
      expect(Object.keys(chart.rows[0]!).filter((key) => !keys.has(key)), id).toEqual([]);
      expect(chart.sources.length, id).toBeGreaterThan(0);
    }
  });

  it('uses the chart that suits each kind of finding', () => {
    const kinds = Object.fromEntries(items.map((i) => [i.kind, group.charts[i.id]!.kind]));
    expect(kinds).toEqual({
      data_stale: 'bar',
      account_loss: 'bar',
      gop_miss: 'waterfall',
      rooms_out_of_order: 'calendar_heatmap',
      web_conversion_drop: 'funnel',
      staffing_gap: 'grouped_bar',
      underpriced_demand: 'bullet',
      pace_behind: 'line',
    });
  });

  it('pace: the booking curve ends on the finding’s own numbers, with last year as the comparison', () => {
    const item = items.find((i) => i.kind === 'pace_behind' && i.hotel_code === 'LIS')!;
    const chart = group.charts[item.id]!;
    expect(chart).toMatchObject({ kind: 'line', x: 'booking_date', y: ['rooms_otb'], compare: 'rooms_otb_stly' });
    expect(chart.rows.at(-1)).toEqual({ booking_date: '2026-11-20', rooms_otb: item.facts['rooms_otb'], rooms_otb_stly: item.facts['rooms_otb_stly'] });
    expect(chart.rows).toHaveLength(57);
  });

  it('rate: the under-priced nights against the comp set’s median, in the hotel’s currency', () => {
    const chart = chartOf('underpriced_demand', 'DXB2');
    expect(chart).toMatchObject({ kind: 'bullet', x: 'night', y: ['bar_rate'], compare: 'comp_median' });
    expect(chart.rows.map((r) => r['stay_date'])).toEqual(expect.arrayContaining(['2026-12-16', '2026-12-17', '2026-12-18']));
    expect(chart.columns.find((c) => c.key === 'bar_rate')).toMatchObject({ kind: 'currency', unit: 'AED' });
    const night = chart.rows.find((r) => r['stay_date'] === '2026-12-16')!;
    expect(Number(night['bar_rate'])).toBeLessThan(0.85 * Number(night['comp_median']));
  });

  it('account: twelve full months of room nights, falling away', () => {
    const chart = chartOf('account_loss', 'NYC');
    expect(chart.rows).toHaveLength(12);
    expect(chart.rows[0]!['month']).toBe('2025-11-01');
    expect(Number(chart.rows.at(-1)!['room_nights'])).toBeLessThan(Number(chart.rows[0]!['room_nights']) / 4);
  });

  it('web: the last 30 days as a funnel, a stage per row, with the 30 days before beside it', () => {
    const chart = chartOf('web_conversion_drop', 'AMS');
    expect(chart).toMatchObject({ kind: 'funnel', x: 'stage', y: ['visits'] });
    expect(chart.rows.map((r) => r['stage'])).toEqual(['Sessions', 'Searches', 'Checkout starts', 'Bookings']);
    const booked = chart.rows.at(-1)!;
    expect(Number(booked['visits'])).toBeLessThan(Number(booked['visits_before']));
    // The checkout is where it broke: far fewer checkouts end in a booking than in the 30 days before.
    expect(Number(booked['step_pct'])).toBeLessThan(0.6 * Number(booked['step_before_pct']));
    expect(chart.subtitle).toBe(`${booked['step_pct']}% of checkouts ended in a booking, against ${booked['step_before_pct']}% in the 30 days before`);
  });

  it('staffing: eight whole weeks of hours needed against hours worked', () => {
    const chart = chartOf('staffing_gap', 'DPS');
    expect(chart).toMatchObject({ kind: 'grouped_bar', x: 'week', y: ['required_hours', 'actual_hours'] });
    expect(chart.rows).toHaveLength(8);
    expect(Number(chart.rows.at(-1)!['actual_hours'])).toBeLessThan(Number(chart.rows.at(-1)!['required_hours']));
  });

  it('rooms out of order: a day per row around today', () => {
    const chart = chartOf('rooms_out_of_order', 'BCN');
    expect(chart).toMatchObject({ kind: 'calendar_heatmap', x: 'date', y: ['out_of_order'] });
    expect(chart.rows.length).toBeGreaterThan(60);
    expect(Math.max(...chart.rows.map((r) => Number(r['out_of_order'])))).toBeGreaterThan(20);
  });

  it('GOP: a bridge from budget to actual whose steps add up', () => {
    const item = items.find((i) => i.kind === 'gop_miss' && i.hotel_code === 'MIA')!;
    const rows = group.charts[item.id]!.rows;
    expect(rows[0]).toMatchObject({ step: 'Budget GOP', kind: 'total' });
    expect(rows.at(-1)).toMatchObject({ step: 'Actual GOP', kind: 'total' });
    const steps = rows.slice(1, -1).reduce((sum, r) => sum + Number(r['amount_eur']), 0);
    expect(Math.abs(Number(rows[0]!['amount_eur']) + steps - Number(rows.at(-1)!['amount_eur']))).toBeLessThan(5);
    expect(Math.abs(Number(rows.at(-1)!['amount_eur']) - Number(rows[0]!['amount_eur']) - item.impact_eur!)).toBeLessThan(5);
  });

  it('stale POS: covers per day, with the days since the last sync at zero', () => {
    const chart = chartOf('data_stale', 'BER');
    expect(chart.rows).toHaveLength(14);
    expect(chart.rows.slice(-3).map((r) => r['covers'])).toEqual([0, 0, 0]);
    expect(Number(chart.rows[0]!['covers'])).toBeGreaterThan(100);
  });

  it('keeps only the charts of the findings in scope', () => {
    expect(Object.keys(lisbon.charts)).toEqual(['pace_behind:LIS']);
    expect(Object.keys(asia.charts)).toEqual(items.filter((i) => ASIA.includes(i.hotel_code)).map((i) => i.id));
  });
});

describe('when a part cannot be read', () => {
  it('the rest still answers, and the part is named in `failed`', async () => {
    const flaky: Db = { query: (sql, params) => (sql.includes('hotel.data_sources') ? Promise.reject(new Error('CONNECTION_CLOSED db.internal:5432')) : db.query(sql, params)) };
    const overview = await briefOverview(flaky, { hotels: ['BER'], items: items.filter((i) => i.hotel_code === 'BER') });
    expect(overview.health).toBeNull();
    expect(overview.failed).toEqual(['health']);
    expect(overview.pulse!.tiles).toHaveLength(9);
    expect(JSON.stringify(overview)).not.toContain('db.internal');
  });

  it('a dead database gives an overview with every part failed, not an exception', async () => {
    const overview = await briefOverview({ query: () => Promise.reject(new Error('down')) }, { items: items.slice(0, 1) });
    expect(overview).toMatchObject({ businessDate: '', pulse: null, nights: null, pickup: null, money: null, health: null, charts: {} });
    expect(overview.failed).toEqual(['pulse', 'nights', 'pickup', 'money', 'health', `chart:${items[0]!.id}`]);
  });
});

describe('hotelsParam', () => {
  it.each([
    [null, undefined],
    ['', undefined],
    ['LIS', { hotels: ['LIS'] }],
    ['lis, ams ,LIS', { hotels: ['LIS', 'AMS'] }],
    ['DXB1,,LON2', { hotels: ['DXB1', 'LON2'] }],
  ])('%s → %j', (raw, scope) => {
    expect(hotelsParam(raw)).toEqual(scope);
  });
});

describe('OverviewCache', () => {
  it('answers a repeated scope from memory until it is stale, whatever the order of the codes', async () => {
    let now = 0;
    let loads = 0;
    const cache = new OverviewCache<number>(60_000, 2, () => now);
    const load = async () => ++loads;
    expect(await cache.get(['LIS', 'AMS'], 'brief-1', load)).toBe(1);
    expect(await cache.get(['AMS', 'LIS'], 'brief-1', load)).toBe(1);
    now = 61_000;
    expect(await cache.get(['LIS', 'AMS'], 'brief-1', load)).toBe(2);
    // A new brief is a new answer.
    expect(await cache.get(['LIS', 'AMS'], 'brief-2', load)).toBe(3);
  });

  it('shares one load between callers that arrive together, forgets a failed load and stays small', async () => {
    const cache = new OverviewCache<number>(60_000, 2, () => 0);
    let loads = 0;
    const slow = () => new Promise<number>((resolve) => setTimeout(() => resolve(++loads), 5));
    expect(await Promise.all([cache.get([], 'b', slow), cache.get([], 'b', slow)])).toEqual([1, 1]);
    await expect(cache.get(['X'], 'b', () => Promise.reject(new Error('no')))).rejects.toThrow('no');
    expect(await cache.get(['X'], 'b', async () => 7)).toBe(7);
    await cache.get(['Y'], 'b', async () => 8);
    await cache.get(['Z'], 'b', async () => 9);
    expect(cache.size).toBe(2);
  });
});
