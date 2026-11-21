import type { BriefFeed, BriefMoney, BriefNights, BriefPickup, Proposal, PulseTile, Workflow, WorkflowRun } from '@compass/contracts';
import { HALCYON_HOTELS } from '../scope/hotels';
import {
  agentRows,
  agentsSummary,
  chartSpec,
  eurShort,
  evidenceLine,
  findingKind,
  headline,
  hotelMentions,
  healthModel,
  matchesFilter,
  moneyAtStake,
  moneyMovers,
  moneyOnTheBooks,
  nightQuestion,
  nightsModel,
  notableRows,
  occupancyStep,
  pickupByDay,
  pickupByHotel,
  pulseDelta,
  pulseGroups,
  pulseValue,
  pulseView,
  spark,
  stakeLabel,
  stakes,
  syncTime,
  watchPrompt,
} from './brief-model';

const row = (id: string, kind: string, hotel_code: string, impact_eur: number | null) => ({ id, kind, hotel_code, impact_eur });
const BRIEF = [
  row('data_stale:BER:POS', 'data_stale', 'BER', null),
  row('account_loss:NYC', 'account_loss', 'NYC', -1_336_633),
  row('rooms_out_of_order:BCN', 'rooms_out_of_order', 'BCN', -114_789),
  row('underpriced_demand:DXB2', 'underpriced_demand', 'DXB2', 42_677),
  row('pace_behind:LIS', 'pace_behind', 'LIS', -38_187),
];

describe('stakes and the headline', () => {
  it('adds what is at risk and what is upside, and counts the hotels and the decisions', () => {
    expect(stakes(BRIEF, 1)).toEqual({ things: 6, findings: 5, decisions: 1, atRisk: 1_489_609, atRiskHotels: 3, upside: 42_677, upsideHotels: 1, feeds: 1 });
  });

  it('follows the scope: only the rows it is given count', () => {
    const lisbon = stakes(BRIEF.filter((r) => r.hotel_code === 'LIS'), 1);
    expect(lisbon).toMatchObject({ things: 2, atRisk: 38_187, upside: 0, atRiskHotels: 1 });
  });

  it('says how much needs the reader and the money in it, in plain words', () => {
    expect(headline(stakes(BRIEF, 1), 'ready')).toBe('6 things need you today: €1.49M at risk, €43k upside.');
    expect(headline(stakes([BRIEF[4]!], 0), 'ready')).toBe('1 thing needs you today: €38k at risk.');
    expect(headline(stakes([BRIEF[0]!], 0), 'ready')).toBe('1 thing needs you today.');
    expect(headline(stakes([], 2), 'ready')).toBe('2 things need you today.');
  });

  it('is honest when there is nothing, and while the brief loads', () => {
    expect(headline(stakes([], 0), 'ready')).toBe('Nothing needs you this morning.');
    expect(headline(stakes([], 0), 'loading')).toBe('Reading this morning’s brief…');
  });

  it('formats money the way it is said', () => {
    expect([1_336_633, 118_400, 42_677, 999_600, 12_400_000, 640].map(eurShort)).toEqual(['€1.34M', '€118k', '€43k', '€1.00M', '€12.4M', '€640']);
    expect(eurShort(-53_333)).toBe('€53k');
  });

  it('filters findings by the side of the money', () => {
    expect([-1, 0, 5, null].map((v) => matchesFilter(v, 'risk'))).toEqual([true, false, false, false]);
    expect([-1, 0, 5, null].map((v) => matchesFilter(v, 'upside'))).toEqual([false, false, true, false]);
    expect(matchesFilter(null, 'all')).toBe(true);
  });
});

describe('finding cards', () => {
  it('labels the stake with its direction', () => {
    expect(stakeLabel(-1_336_633)).toEqual({ text: '€1.34M at risk', tone: 'risk', arrow: '▼' });
    expect(stakeLabel(42_677)).toEqual({ text: '€43k upside', tone: 'upside', arrow: '▲' });
    expect(stakeLabel(null)).toEqual({ text: 'Not priced', tone: 'none', arrow: '' });
  });

  it('names every kind the backend detects, and survives a new one', () => {
    for (const kind of ['data_stale', 'pace_behind', 'underpriced_demand', 'account_loss', 'web_conversion_drop', 'staffing_gap', 'rooms_out_of_order', 'gop_miss']) {
      expect(findingKind(kind).label, kind).not.toContain('_');
    }
    expect(findingKind('fnb_margin_drop')).toEqual({ label: 'fnb margin drop', icon: 'phosphorSparkleLight', chart: null });
  });

  it('writes the evidence line from how the money was priced and what was read', () => {
    expect(evidenceLine('room revenue on the books vs the same point last year, next 45 nights', ['hotel.pace_vs_stly()'])).toBe('Room revenue on the books vs the same point last year, next 45 nights · From bookings');
    expect(evidenceLine('GOP actual − budget in the last closed month, in EUR', ['hotel.pnl_monthly'])).toBe('GOP actual − budget in the last closed month, in EUR · From P&L');
    expect(evidenceLine('x', ['hotel.reservation_nights', 'hotel.reservations', 'hotel.accounts'])).toBe('X · From bookings, accounts');
  });

  it('cuts a long basis at a word', () => {
    const line = evidenceLine("gap to the comp set median × rooms already sold on those nights: revenue already left on the table at today's rate. Booked rooms cannot be repriced; the rooms still unsold can.", ['hotel.v_rate_position']);
    expect(line.length).toBeLessThan(150);
    expect(line).toMatch(/… · From rate shop$/);
  });

  it('turns a finding’s chart into a widget spec, without touching its columns', () => {
    const spec = chartSpec({ kind: 'line', title: 'Room nights on the books', x: 'booking_date', y: ['rooms_otb'], compare: 'rooms_otb_stly', rows: [], columns: [], sources: [] }, 'pace_behind:LIS');
    expect(spec).toEqual({ kind: 'line', title: 'Room nights on the books', sourceCallId: 'brief:pace_behind:LIS', x: 'booking_date', y: ['rooms_otb'], compare: 'rooms_otb_stly' });
  });

  it('“Watch this” describes an agent for that hotel and that kind of finding', () => {
    expect(watchPrompt({ kind: 'pace_behind', hotel_name: 'Arbor Lisbon Chiado', facts: {} })).toBe('Email me every morning if Arbor Lisbon Chiado is more than 10% behind last year on the books for the next 45 nights');
    expect(watchPrompt({ kind: 'web_conversion_drop', hotel_name: 'Arbor Amsterdam Centraal', facts: { device: 'mobile' } })).toContain('mobile conversion on the Arbor Amsterdam Centraal website');
    expect(watchPrompt({ kind: 'something_new', hotel_name: 'Lumen Bali Uluwatu', facts: {} })).toContain('Lumen Bali Uluwatu');
  });
});

const tile = (over: Partial<PulseTile>): PulseTile => ({
  key: 'occupancy',
  label: 'Occupancy',
  unit: 'percent',
  value: 53,
  compare: 52.6,
  delta: 0.4,
  deltaUnit: 'pp',
  period: 'Next 30 nights',
  basis: 'same time last year',
  definition: 'Rooms on the books ÷ rooms available.',
  series: [
    { x: '2026-11-20', value: 76, compare: 72 },
    { x: '2026-11-21', value: 73, compare: 67 },
    { x: '2026-11-22', value: 63, compare: 64 },
  ],
  ...over,
});

describe('Pulse tiles', () => {
  it('shows one value of three figures at most, without decimals it does not need', () => {
    expect(pulseValue({ unit: 'percent', value: 53.4 })).toBe('53%');
    expect(pulseValue({ unit: 'eur', value: 279.47 })).toBe('€279');
    expect(pulseValue({ unit: 'eur', value: 312_520 })).toBe('€313k');
    expect(pulseValue({ unit: 'eur', value: 4_738_368 })).toBe('€4.74M');
    expect(pulseValue({ unit: 'eur', value: 20_817_635 })).toBe('€20.8M');
    expect(pulseValue({ unit: 'count', value: 74_489 })).toBe('74,489');
    expect(pulseValue({ unit: 'eur', value: null })).toBe('–');
  });

  it('a rise reads ▲ with a plus, in points for a percentage, and names its base', () => {
    const view = pulseView(tile({}));
    expect(view).toMatchObject({ label: 'Occupancy', period: 'next 30 nights', value: '53%' });
    expect(view.deltas).toEqual([{ arrow: '▲', text: '+0.4 pts', tone: 'up', basis: 'STLY', spoken: 'Up 0.4 pts against same time last year.' }]);
    expect(view.spoken).toBe('Occupancy, next 30 nights: 53%. Up 0.4 pts against same time last year.');
  });

  it('a fall reads ▼ with a minus, in percent for money', () => {
    const view = pulseView(tile({ key: 'room_revenue', label: 'Room revenue', unit: 'eur', value: 312_520, compare: 357_265, delta: -12.5, deltaUnit: 'pct' }));
    expect(view.value).toBe('€313k');
    expect(view.deltas[0]).toMatchObject({ arrow: '▼', text: '−12.5%', tone: 'down' });
  });

  it('a P&L tile has two labelled comparisons: a year earlier and the budget', () => {
    const view = pulseView(tile({ key: 'gop', label: 'GOP', unit: 'eur', value: 632_147, period: 'Oct 2026', basis: 'Oct 2025', delta: 4.2, deltaUnit: 'pct', also: { delta: -20.6, deltaUnit: 'pct', basis: 'budget' } }));
    expect(view.deltas.map((d) => `${d.arrow} ${d.text} vs ${d.basis}`)).toEqual(['▲ +4.2% vs Oct 2025', '▼ −20.6% vs budget']);
    expect(view.question).toBe('What drove GOP in Oct 2026 against Oct 2025 and against budget?');
    expect(view.period).toBe('Oct 2026');
  });

  it('no change and no comparison are said as such, without an arrow', () => {
    expect(pulseDelta(0.04, 'pp', 'budget')).toMatchObject({ arrow: '', text: '±0', tone: 'flat', spoken: 'Level with budget.' });
    expect(pulseDelta(null, 'pct', 'Oct 2025')).toMatchObject({ arrow: '', text: 'no figure', tone: 'flat', basis: 'Oct 2025' });
  });

  it('“Ask why” asks about the tile’s own period', () => {
    expect(pulseView(tile({})).question).toBe('What is driving occupancy for the next 30 nights against the same time last year?');
    expect(pulseView(tile({ key: 'pace', label: 'Pace', unit: 'count' }))).toMatchObject({ label: 'On the books', question: 'What is driving room nights on the books for the next 30 nights against the same time last year?' });
  });

  it('groups the row by period, four tiles at most, with pace said apart', () => {
    const keys = (['occupancy', 'adr', 'revpar', 'room_revenue', 'pace'] as const).map((key) => tile({ key }));
    const month = (['total_revenue', 'trevpar', 'gop', 'gop_margin'] as const).map((key) => tile({ key, period: 'Oct 2026', basis: 'Oct 2025' }));
    const groups = pulseGroups([...keys, ...month]);
    expect(groups.forward.map((t) => t.key)).toEqual(['occupancy', 'adr', 'revpar', 'room_revenue']);
    expect(groups.month.map((t) => t.key)).toEqual(['total_revenue', 'trevpar', 'gop', 'gop_margin']);
    expect(groups.pace?.key).toBe('pace');
    expect(groups).toMatchObject({ monthLabel: 'Oct 2026', monthBasis: 'Oct 2025' });
    expect(pulseGroups(keys)).toMatchObject({ month: [], monthLabel: '' });
  });

  it('draws both series on one scale and breaks the line at a gap', () => {
    const s = spark([10, null, 20, 30], [10, 20, 30, 40]);
    expect(s.line.match(/M/g)).toHaveLength(2);
    expect(s.compare.match(/M/g)).toHaveLength(1);
    expect(s.lastX).toBe(100);
    // 30 of a 10–40 range sits a third of the way down the padded box.
    expect(s.lastY).toBeGreaterThan(20);
    expect(s.lastY).toBeLessThan(45);
    expect(spark([], [])).toMatchObject({ line: '', compare: '' });
  });
});

const night = (stay_date: string, rooms_otb: number, rooms_available: number, stly: number) => ({
  stay_date,
  rooms_available,
  rooms_otb,
  rooms_otb_stly: stly,
  occupancy_pct: Math.round((1000 * rooms_otb) / rooms_available) / 10,
  occupancy_stly_pct: Math.round((1000 * stly) / rooms_available) / 10,
});
const NIGHTS: BriefNights = {
  from: '2026-11-27',
  to: '2026-12-01',
  total: ['2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'].map((d, i) => ({ ...night(d, 300 + i * 20, 470, 310), events: i === 0 ? 1 : 0, rate_flags: i === 1 ? 2 : 0 })),
  hotels: ['LIS', 'DXB1'].flatMap((code) =>
    ['2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'].map((d, i) => ({
      hotel_code: code,
      ...night(d, code === 'LIS' ? 60 : 280, code === 'LIS' ? 150 : 320, code === 'LIS' ? 90 : 270),
      bar_rate: 200,
      currency: code === 'LIS' ? 'EUR' : 'AED',
      bar_vs_comp: code === 'LIS' ? 1.4 : 0.83,
      comps_sold_out: 0,
      event: code === 'LIS' && i === 0 ? 'Atlantic Web Forum' : null,
      rate_flag: i === 1 ? (code === 'LIS' ? ('overpriced' as const) : ('underpriced' as const)) : null,
    })),
  ),
};

describe('Next 14 nights', () => {
  it('steps occupancy through five bands', () => {
    expect([null, 12, 40, 54.9, 55, 70, 84.9, 85, 100].map(occupancyStep)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4]);
  });

  it('heads each column with its weekday and date, and names a new month', () => {
    const m = nightsModel(NIGHTS, HALCYON_HOTELS);
    expect(m.days.map((d) => `${d.weekday} ${d.day}`)).toEqual(['Fri 27', 'Sat 28', 'Sun 29', 'Mon 30', 'Tue 1']);
    expect(m.days.map((d) => d.month)).toEqual(['', '', '', '', 'Dec']);
    expect(m.days.map((d) => d.weekend)).toEqual([true, true, false, false, false]);
  });

  it('describes the scope’s nights: occupancy, the gap to last year, events and rates to check', () => {
    const m = nightsModel(NIGHTS, HALCYON_HOTELS);
    expect(m.total[0]).toMatchObject({ occupancy: 63.8, step: 2, delta: -2.2, events: ['Atlantic Web Forum'], flags: 0 });
    expect(m.total[0]!.label).toBe('Fri 27 Nov: 64% occupied, 2 points behind last year. Atlantic Web Forum.');
    expect(m.total[1]!.label).toBe('Sat 28 Nov: 68% occupied, 2 points ahead of last year. 2 rates to check.');
  });

  it('gives one row per hotel in the catalog’s order, with short names and their flagged nights', () => {
    const m = nightsModel(NIGHTS, HALCYON_HOTELS);
    expect(m.rows.map((r) => [r.code, r.name, r.flags, r.events])).toEqual([
      ['LIS', 'Lisbon Chiado', 1, 1],
      ['DXB1', 'Dubai Marina', 1, 0],
    ]);
    expect(m.rows[0]!.cells[1]!.label).toBe('Sat 28 Nov: 40% occupied, 20 points behind last year. To check: rate over the market, behind last year, rate at 1.40× the comp set.');
    expect(m.rows[1]!.cells[1]!.flag).toBe('underpriced');
    expect(m.flags).toBe(2);
    expect(m.events).toEqual(['Atlantic Web Forum']);
  });

  it('opens a long list with the hotels that have something to look at, in their usual order', () => {
    const rows = [
      { code: 'A', flags: 0, events: 0 },
      { code: 'B', flags: 0, events: 2 },
      { code: 'C', flags: 3, events: 0 },
      { code: 'D', flags: 0, events: 0 },
      { code: 'E', flags: 1, events: 1 },
    ];
    expect(notableRows(rows, 3).map((r) => r.code)).toEqual(['B', 'C', 'E']);
    expect(notableRows(rows, 8)).toHaveLength(5);
  });

  it('asks about the night, the hotel and the rate that was clicked', () => {
    expect(nightQuestion('Sat 28 Nov')).toContain('How is Sat 28 Nov looking');
    expect(nightQuestion('Sat 28 Nov', 'Kestrel Dubai Marina', 'underpriced')).toBe("Should Kestrel Dubai Marina change its rate for Sat 28 Nov? Compare it with the comp set and with last year's pace.");
    expect(nightQuestion('Sat 28 Nov', 'Kestrel Dubai Marina')).toContain('at Kestrel Dubai Marina');
  });
});

const PICKUP: BriefPickup = {
  from: '2026-11-14',
  to: '2026-11-20',
  byDay: [
    { booking_date: '2026-11-19', booked: 400, cancelled: 80, net: 320, net_ly: 300 },
    { booking_date: '2026-11-20', booked: 380, cancelled: 100, net: 280, net_ly: 300 },
  ],
  byHotel: [
    { hotel_code: 'TYO', booked: 300, cancelled: 60, net: 240, net_ly: 200, revenue_eur: 90_000 },
    { hotel_code: 'SIN', booked: 480, cancelled: 120, net: 360, net_ly: 400, revenue_eur: 140_000 },
  ],
};
const MONEY: BriefMoney = {
  from: '2026-11-20',
  to: '2026-12-19',
  byHotel: [
    { hotel_code: 'TYO', region: 'Asia', revenue_eur: 1_400_000, revenue_stly_eur: 1_300_000, change_eur: 100_000, change_pct: 7.7 },
    { hotel_code: 'SIN', region: 'Asia', revenue_eur: 2_400_000, revenue_stly_eur: 2_200_000, change_eur: 200_000, change_pct: 9.1 },
    { hotel_code: 'LIS', region: 'Europe', revenue_eur: 312_000, revenue_stly_eur: 357_000, change_eur: -45_000, change_pct: -12.6 },
  ],
  byWeek: [
    { week: '2026-11-16', revenue_eur: 40_000, revenue_stly_eur: 50_000 },
    { week: '2026-11-23', revenue_eur: 90_000, revenue_stly_eur: 100_000 },
  ],
};

describe('pickup and money as catalogue widgets', () => {
  it('pickup by day: net pickup against the same weekday last year, with the total and its change', () => {
    const view = pickupByDay(PICKUP);
    expect(view).toMatchObject({ net: 600, netLy: 600, change: '+0.0%' });
    expect(view.spec).toMatchObject({ kind: 'bar', x: 'day', y: ['net'], compare: 'net_ly' });
    expect(view.rows.map((r) => r['day'])).toEqual(['Thu 19', 'Fri 20']);
    expect(view.columns.map((c) => c.key)).toEqual(Object.keys(view.rows[0]!));
  });

  it('pickup by hotel: ranked, by name; one hotel has nothing to rank', () => {
    const view = pickupByHotel(PICKUP, HALCYON_HOTELS)!;
    expect(view.rows.map((r) => [r['hotel'], r['net']])).toEqual([
      ['Singapore Marina', 360],
      ['Tokyo Ginza', 240],
    ]);
    expect(pickupByHotel({ ...PICKUP, byHotel: PICKUP.byHotel.slice(0, 1) }, HALCYON_HOTELS)).toBeNull();
  });

  it('money on the books: a treemap by region for several hotels', () => {
    const view = moneyOnTheBooks(MONEY, HALCYON_HOTELS);
    expect(view.spec).toMatchObject({ kind: 'treemap', x: 'hotel', group: 'region', y: ['revenue_eur'] });
    expect(view.total).toBe(4_112_000);
    expect(view.change).toBe('+6.6%');
    expect(view.rows[0]).toMatchObject({ hotel: 'Singapore Marina', region: 'Asia' });
  });

  it('money on the books: no parent level inside one region, and stay weeks for a single hotel', () => {
    expect(moneyOnTheBooks({ ...MONEY, byHotel: MONEY.byHotel.slice(0, 2) }, HALCYON_HOTELS).spec.group).toBeUndefined();
    const one = moneyOnTheBooks({ ...MONEY, byHotel: MONEY.byHotel.slice(2) }, HALCYON_HOTELS);
    expect(one.spec).toMatchObject({ kind: 'bar', x: 'week', compare: 'revenue_stly_eur' });
    expect(one.rows).toHaveLength(2);
    expect(one.change).toBe('−12.6%');
  });

  it('money in the findings: per hotel, largest first, risk and upside together', () => {
    const view = moneyAtStake(BRIEF, HALCYON_HOTELS)!;
    expect(view.rows.map((r) => r['hotel'])).toEqual(['New York Midtown', 'Barcelona Mar', 'Dubai Business Bay', 'Lisbon Chiado']);
    expect(view.rows[0]!['at_stake_eur']).toBe(1_336_633);
    expect(moneyAtStake(BRIEF.slice(0, 2), HALCYON_HOTELS)).toBeNull();
  });

  it('names the hotels furthest from last year, the falls first', () => {
    expect(moneyMovers(MONEY, HALCYON_HOTELS)).toEqual([
      { name: 'Lisbon Chiado', code: 'LIS', change: '−€45k', tone: 'down' },
      { name: 'Singapore Marina', code: 'SIN', change: '+€200k', tone: 'up' },
      { name: 'Tokyo Ginza', code: 'TYO', change: '+€100k', tone: 'up' },
    ]);
  });
});

const feed = (hotel_code: string, system: string, status = 'ok', last_sync_at = '2026-11-20 05:30', days_behind = 0): BriefFeed => ({ hotel_code, system, vendor: 'Vendor', status, last_sync_at, days_behind });

describe('data health', () => {
  const feeds = [feed('BER', 'POS', 'stale', '2026-11-17 04:12', 3), feed('LIS', 'POS', 'ok', '2026-11-20 05:19'), feed('BER', 'PMS', 'ok', '2026-11-20 05:34'), feed('LIS', 'PMS', 'ok', '2026-11-20 05:32')];

  it('counts the fresh feeds and leads with the system that has a problem', () => {
    const m = healthModel(feeds);
    expect(m).toMatchObject({ total: 4, fresh: 3 });
    expect(m.systems.map((s) => [s.system, s.fresh, s.total, s.synced])).toEqual([
      ['POS', 1, 2, '05:19'],
      ['PMS', 2, 2, '05:32–05:34'],
    ]);
    expect(m.systems[0]!.marks).toEqual([
      { code: 'LIS', ok: true },
      { code: 'BER', ok: false },
    ]);
    expect(m.stale.map((f) => f.hotel_code)).toEqual(['BER']);
  });

  it('follows the scope it is given', () => {
    expect(healthModel(feeds.filter((f) => f.hotel_code === 'LIS'))).toMatchObject({ total: 2, fresh: 2, stale: [] });
  });

  it('writes the last sync as a day and a time', () => {
    expect(syncTime('2026-11-17 04:12')).toBe('Tue 17 Nov, 04:12');
  });
});

const workflow = (id: string, hotels: string[], lastRun: Workflow['lastRun'], enabled = true): Workflow => ({
  id,
  name: `Agent ${id}`,
  description: '',
  hotels,
  trigger: { kind: 'schedule', every: 'day' },
  goal: 'Watch the numbers and say what changed.',
  checks: [],
  action: { type: 'notify', guidance: '' },
  approver: 'revenue_manager',
  autonomy: 'approve',
  enabled,
  createdAt: '2026-11-19T10:00:00.000Z',
  createdBy: 'template',
  lastRun,
});
const run = (id: string, workflowId: string, summary: string, status: WorkflowRun['status'] = 'done'): WorkflowRun => ({ id, workflowId, sessionId: 's', trigger: 'brief', status, startedAt: '2026-11-20T05:01:00.000Z', endedAt: '2026-11-20T05:02:00.000Z', summary });
const proposal = (id: string, workflowId: string, runId: string, hotel_code: string, status: Proposal['status']): Proposal => ({
  id,
  workflowId,
  runId,
  hotel_code,
  action: 'adjust_bar',
  title: `Change the rate at ${hotel_code}`,
  rationale: '',
  change: { before: '', after: '', scope: '' },
  impact_eur: 1000,
  risk: 'high',
  status,
  createdAt: '2026-11-20T05:01:30.000Z',
  decidedBy: null,
  decidedAt: null,
  note: null,
});

describe('agents overnight', () => {
  const workflows = [
    workflow('pace', ['ALL'], { runId: 'r1', at: '2026-11-20T05:01:00.000Z', status: 'waiting_approval' }),
    workflow('feeds', ['ALL'], { runId: 'r2', at: '2026-11-20T05:03:00.000Z', status: 'done' }),
    workflow('bcn', ['BCN'], { runId: 'r3', at: '2026-11-20T05:02:00.000Z', status: 'failed' }),
    workflow('off', ['ALL'], null, false),
    workflow('new', ['LIS'], null),
  ];
  const details = {
    pace: { runs: [run('r1', 'pace', 'Proposed a lower rate.', 'waiting_approval')], proposals: [proposal('p1', 'pace', 'r1', 'LIS', 'pending'), proposal('p2', 'pace', 'r1', 'DXB2', 'pending')] },
    feeds: { runs: [run('r2', 'feeds', 'All 140 feeds are fresh except Berlin POS. Nothing else to flag.')], proposals: [] },
  };

  it('lists the agents that watch the scope: the one that needs you first, then failures', () => {
    const rows = agentRows(workflows, details, [], (code) => code === 'LIS');
    expect(rows.map((r) => [r.id, r.status.tone])).toEqual([
      ['pace', 'needs'],
      ['feeds', 'quiet'],
      ['new', 'quiet'],
    ]);
    expect(rows[0]).toMatchObject({ finding: 'Change the rate at LIS', hotel: 'LIS', loading: false });
    expect(rows[1]!.finding).toBe('All 140 feeds are fresh except Berlin POS. Nothing else to flag.');
    expect(rows[2]).toMatchObject({ at: null, finding: '' });
  });

  it('a group-wide agent’s proposal for another hotel does not need you in this scope', () => {
    const rows = agentRows(workflows, details, [], (code) => code === 'BCN');
    expect(rows.map((r) => [r.id, r.status.tone])).toEqual([
      ['pace', 'needs'],
      ['bcn', 'failed'],
      ['feeds', 'quiet'],
    ]);
    // The run still waits for approval, but nothing it proposed is for Barcelona.
    expect(rows[0]!.hotel).toBe('');
  });

  it('under a narrower scope, a run that reported on another hotel is not quoted', () => {
    const asia = HALCYON_HOTELS.filter((h) => h.region === 'Asia');
    const rows = agentRows(workflows, details, [], (code) => asia.some((h) => h.code === code), hotelMentions(asia));
    expect(rows.find((r) => r.id === 'feeds')).toMatchObject({ finding: '', status: { tone: 'quiet', text: 'Nothing for these hotels' } });
    const berlin = HALCYON_HOTELS.filter((h) => h.code === 'BER');
    expect(agentRows(workflows, details, [], (code) => code === 'BER', hotelMentions(berlin)).find((r) => r.id === 'feeds')!.finding).toContain('Berlin POS');
  });

  it('recognises a hotel by its short name, its city or its code as a word', () => {
    const mentions = hotelMentions(HALCYON_HOTELS.filter((h) => h.code === 'LIS'));
    expect(['Lisbon pace is behind', 'LIS pace for the next 90 nights', 'Arbor Lisbon Chiado is 17% behind'].map(mentions)).toEqual([true, true, true]);
    expect(['The Berlin POS feed is stale', 'A new LISTING appeared'].map(mentions)).toEqual([false, false]);
  });

  it('shows a skeleton line until an agent’s runs have loaded', () => {
    expect(agentRows(workflows, {}, [], () => true).find((r) => r.id === 'feeds')!.loading).toBe(true);
  });

  it('sums the night up in a line', () => {
    expect(agentsSummary(agentRows(workflows, details, [], () => true))).toBe('3 of 4 agents ran · 1 needs you · 1 couldn’t run');
    expect(agentsSummary([])).toBe('');
  });
});
