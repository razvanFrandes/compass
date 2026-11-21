import { WIDGET_KINDS, type WidgetSpec } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { inferColumns } from '../src/application/widgets/columns.ts';
import { fitWidget } from '../src/application/widgets/fit.ts';

type Row = Record<string, unknown>;

// Rows shaped like the real tools' (get_metric, get_pace, get_mix, get_web_funnel, get_rate_position).
const HOTELS = ['AMS', 'BCN', 'BER', 'LIS', 'NYC', 'PAR', 'VIE', 'DOH'];
const pace: Row[] = HOTELS.map((hotel_code, i) => ({ hotel_code, rooms_otb: 4000 + i, rooms_otb_stly: 4100 - i, pace_pct: i - 4 }));
const weekly: Row[] = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((period, i) => ({
  period,
  key: 'Halcyon group',
  value: 70 + i,
  compare_value: 72 - i,
}));
const weeklyByHotel: Row[] = ['LIS', 'AMS'].flatMap((key) => weekly.map((row) => ({ ...row, key })));
const mix: Row[] = [
  { key: 'direct', room_nights: 1940, share_pct: 40.3, revenue_eur: 341805 },
  { key: 'OTA', room_nights: 1609, share_pct: 33.4, revenue_eur: 303640 },
  { key: 'GDS', room_nights: 900, share_pct: 18.7, revenue_eur: 150000 },
  { key: 'wholesale', room_nights: 366, share_pct: 7.6, revenue_eur: 50000 },
];
const funnel: Row[] = [
  { key: 'mobile', sessions: 18552, searches: 1092, checkout_starts: 343, bookings: 151, conversion_pct: 0.81 },
  { key: 'desktop', sessions: 9061, searches: 914, checkout_starts: 282, bookings: 282, conversion_pct: 3.11 },
];
const one: Row[] = [{ period: '2026-10-21', key: 'Halcyon group', value: 74.9, compare_value: 73.1, occupancy_pct: 74.9 }];

const spec = (kind: WidgetSpec['kind'], fields: Partial<WidgetSpec> = {}): WidgetSpec => ({
  kind,
  title: 'Lisbon is 15.9% behind last year',
  sourceCallId: 'call-1',
  ...fields,
});
const fit = (rows: Row[], widget: WidgetSpec) => fitWidget(widget, { rows, columns: inferColumns(rows) });
const errorOf = (rows: Row[], widget: WidgetSpec): string => {
  const result = fit(rows, widget);
  return result.ok ? '' : result.error;
};

describe('fitWidget: what every kind checks', () => {
  it('refuses a result with no rows', () => {
    expect(errorOf([], spec('table'))).toMatch(/no rows/);
  });

  it('refuses more than 400 rows and says how to narrow the result', () => {
    const many = Array.from({ length: 401 }, (_, i) => ({ period: `d${i}`, value: i }));
    expect(errorOf(many, spec('table'))).toMatch(/401 rows.*at most 400.*narrower/s);
  });

  it('takes the 20 hotels × 14 nights of a group heatmap', () => {
    const grid = Array.from({ length: 20 }, (_, h) => Array.from({ length: 14 }, (_, d) => ({ period: `2026-11-${String(20 + (d % 10)).padStart(2, '0')}-${d}`, key: `H${h}`, value: 60 + h + d }))).flat();
    expect(grid).toHaveLength(280);
    expect(fit(grid, spec('heatmap', { x: 'period', group: 'key', y: ['value'] })).ok).toBe(true);
  });

  it('names the columns of the result when a key is not one of them', () => {
    const error = errorOf(pace, spec('bar', { x: 'hotel', y: ['pace'] }));
    expect(error).toContain('"hotel"');
    expect(error).toContain('"pace"');
    expect(error).toContain('hotel_code, rooms_otb, rooms_otb_stly, pace_pct');
  });

  it('refuses a text column as y, and names the number columns', () => {
    const error = errorOf(pace, spec('bar', { x: 'hotel_code', y: ['hotel_code'] }));
    expect(error).toMatch(/"hotel_code" is not a number column/);
    expect(error).toContain('rooms_otb, rooms_otb_stly, pace_pct');
  });

  it('refuses a compare column that is not a number', () => {
    expect(errorOf(pace, spec('bar', { x: 'hotel_code', y: ['pace_pct'], compare: 'hotel_code' }))).toMatch(/compare/);
  });

  it('counts a column with nulls as a number column when the rest are numbers', () => {
    const rows = [{ hotel_code: 'BER', impact_eur: null }, { hotel_code: 'NYC', impact_eur: -1336633 }];
    expect(fit(rows, spec('bar', { x: 'hotel_code', y: ['impact_eur'] })).ok).toBe(true);
  });

  it('keeps only the fields the kind uses and fills the format from the y column', () => {
    const result = fit(pace, spec('bar', { x: 'hotel_code', y: ['pace_pct'], group: 'rooms_otb', subtitle: 'Next 45 nights' }));
    expect(result).toEqual({
      ok: true,
      value: { kind: 'bar', title: 'Lisbon is 15.9% behind last year', subtitle: 'Next 45 nights', sourceCallId: 'call-1', x: 'hotel_code', y: ['pace_pct'], format: 'percent' },
    });
  });

  it('keeps a format the model chose', () => {
    const result = fit(pace, spec('bar', { x: 'hotel_code', y: ['pace_pct'], format: 'number' }));
    expect(result.ok && result.value.format).toBe('number');
  });

  it('has a rule for every kind of the contract', () => {
    // A kind without a rule would return undefined instead of a Result.
    for (const kind of WIDGET_KINDS) expect(typeof fit(pace, spec(kind)).ok).toBe('boolean');
  });
});

describe('fitWidget: one number', () => {
  it('kpi takes one row and one number, with an optional comparison', () => {
    expect(fit(one, spec('kpi', { y: ['value'], compare: 'compare_value' }))).toMatchObject({ ok: true, value: { y: ['value'], compare: 'compare_value' } });
  });

  it('kpi refuses a result with a row per hotel', () => {
    expect(errorOf(pace, spec('kpi', { y: ['pace_pct'] }))).toMatch(/kpi fits 1 row; that result has 8/);
  });

  it('kpi_row takes one row with several numbers, or a few rows with a label', () => {
    expect(fit(one, spec('kpi_row', { y: ['value', 'compare_value'] })).ok).toBe(true);
    expect(fit(mix, spec('kpi_row', { x: 'key', y: ['room_nights'] })).ok).toBe(true);
    expect(errorOf(pace, spec('kpi_row', { x: 'hotel_code', y: ['pace_pct'] }))).toMatch(/2–6 rows/);
  });

  it('gauge needs a percent column or a target', () => {
    expect(fit(one, spec('gauge', { y: ['occupancy_pct'] })).ok).toBe(true);
    expect(fit(one, spec('gauge', { y: ['value'], compare: 'compare_value' })).ok).toBe(true);
    expect(errorOf(one, spec('gauge', { y: ['value'] }))).toMatch(/percent column.*or compare/);
  });
});

describe('fitWidget: trends', () => {
  it('line takes an ordered x and one line per y column', () => {
    expect(fit(weekly, spec('line', { x: 'period', y: ['value'], compare: 'compare_value' }))).toMatchObject({
      ok: true,
      value: { x: 'period', y: ['value'], compare: 'compare_value' },
    });
    expect(fit(weekly, spec('area', { x: 'period', y: ['value', 'compare_value'] })).ok).toBe(true);
  });

  it('line refuses a category as x', () => {
    expect(errorOf(pace, spec('line', { x: 'hotel_code', y: ['pace_pct'] }))).toMatch(/ordered x.*Use bar/s);
  });

  it('line refuses an x that repeats without a group, and says what to do', () => {
    expect(errorOf(weeklyByHotel, spec('line', { x: 'period', y: ['value'] }))).toMatch(/repeats.*group/s);
  });

  it('line splits one number into a line per group value', () => {
    expect(fit(weeklyByHotel, spec('line', { x: 'period', y: ['value'], group: 'key' }))).toMatchObject({ ok: true, value: { group: 'key' } });
    expect(errorOf(weeklyByHotel, spec('line', { x: 'period', y: ['value', 'compare_value'], group: 'key' }))).toMatch(/1 y column/);
  });

  it('line needs at least two points', () => {
    expect(errorOf(one, spec('line', { x: 'period', y: ['value'] }))).toMatch(/at least 2/);
  });

  it('sparkline_list needs a group', () => {
    expect(fit(weeklyByHotel, spec('sparkline_list', { x: 'period', y: ['value'], group: 'key' })).ok).toBe(true);
    expect(errorOf(weekly, spec('sparkline_list', { x: 'period', y: ['value'] }))).toMatch(/needs group/);
  });

  it('calendar_heatmap needs a day column with one row per day', () => {
    const days = Array.from({ length: 10 }, (_, i) => ({ stay_date: `2026-11-${String(i + 10)}`, bar_vs_comp: 1 + i / 100 }));
    expect(fit(days, spec('calendar_heatmap', { x: 'stay_date', y: ['bar_vs_comp'] })).ok).toBe(true);
    expect(errorOf(pace, spec('calendar_heatmap', { x: 'hotel_code', y: ['pace_pct'] }))).toMatch(/day column/);
  });
});

describe('fitWidget: categories', () => {
  it('bar takes one row per category', () => {
    expect(fit(pace, spec('bar', { x: 'hotel_code', y: ['rooms_otb'], compare: 'rooms_otb_stly' })).ok).toBe(true);
  });

  it('bar refuses a category that repeats and points to the grouped kinds', () => {
    expect(errorOf(weeklyByHotel, spec('bar', { x: 'key', y: ['value'] }))).toMatch(/grouped_bar or stacked_bar/);
  });

  it('grouped and stacked bars take several y columns, or one split by a group', () => {
    expect(fit(pace, spec('grouped_bar', { x: 'hotel_code', y: ['rooms_otb', 'rooms_otb_stly'] })).ok).toBe(true);
    expect(fit(weeklyByHotel, spec('stacked_bar', { x: 'period', y: ['value'], group: 'key' })).ok).toBe(true);
    expect(errorOf(pace, spec('stacked_bar', { x: 'hotel_code', y: ['rooms_otb'] }))).toMatch(/2–8 y columns/);
  });

  it('pie and donut take 2–7 parts of one whole', () => {
    expect(fit(mix, spec('pie', { group: 'key', y: ['room_nights'] })).ok).toBe(true);
    expect(fit(mix, spec('donut', { group: 'key', y: ['share_pct'] })).ok).toBe(true);
    expect(errorOf(pace, spec('pie', { group: 'hotel_code', y: ['rooms_otb'] }))).toMatch(/2–7 rows; that result has 8.*bar/s);
  });

  it('pie takes the slice label from x too, and stores it as group', () => {
    expect(fit(mix, spec('pie', { x: 'key', y: ['room_nights'] }))).toMatchObject({ ok: true, value: { group: 'key' } });
    expect(fit(mix, spec('pie', { x: 'key', y: ['room_nights'] })).ok && 'x' in (fit(mix, spec('pie', { x: 'key', y: ['room_nights'] })) as { value: object }).value).toBe(false);
  });

  it('pie refuses negative parts and percentages that are not a whole', () => {
    expect(errorOf(pace.slice(0, 5), spec('pie', { group: 'hotel_code', y: ['pace_pct'] }))).toMatch(/negative|add up/);
    const scores = [{ key: 'AMS', occupancy_pct: 71 }, { key: 'BCN', occupancy_pct: 80 }, { key: 'LIS', occupancy_pct: 64 }];
    expect(errorOf(scores, spec('donut', { group: 'key', y: ['occupancy_pct'] }))).toMatch(/adds up to 215%.*not.*whole/s);
  });

  it('treemap keeps x and group when both are named: the parts (x) sit inside their parents (group)', () => {
    const byRegion = pace.map((row, i) => ({ ...row, region: i < 5 ? 'Europe' : 'Asia' }));
    const fitted = fit(byRegion, spec('treemap', { x: 'hotel_code', group: 'region', y: ['rooms_otb'] }));
    expect(fitted.ok && fitted.value).toMatchObject({ x: 'hotel_code', group: 'region', y: ['rooms_otb'] });
  });

  it('treemap with a parent still needs one row per part', () => {
    const twice = [...pace, ...pace].map((row, i) => ({ ...row, region: i < 8 ? 'Europe' : 'Asia' }));
    expect(errorOf(twice, spec('treemap', { x: 'hotel_code', group: 'region', y: ['rooms_otb'] }))).toMatch(/"hotel_code" repeats/);
  });

  it('treemap takes more parts than a pie', () => {
    expect(fit(pace, spec('treemap', { group: 'hotel_code', y: ['rooms_otb'] })).ok).toBe(true);
  });

  it('table takes any result, and y picks its columns', () => {
    expect(fit(pace, spec('table'))).toMatchObject({ ok: true });
    expect(fit(pace, spec('table', { y: ['hotel_code', 'pace_pct'] }))).toMatchObject({ ok: true, value: { y: ['hotel_code', 'pace_pct'] } });
    expect(fit(pace, spec('table')).ok && (fit(pace, spec('table')) as { value: WidgetSpec }).value.format).toBeUndefined();
  });

  it('heatmap needs one row per cell', () => {
    expect(fit(weeklyByHotel, spec('heatmap', { x: 'period', group: 'key', y: ['value'] })).ok).toBe(true);
    expect(errorOf(weeklyByHotel, spec('heatmap', { x: 'period', y: ['value'] }))).toMatch(/needs group/);
  });

  it('bullet needs a target', () => {
    expect(fit(pace, spec('bullet', { x: 'hotel_code', y: ['rooms_otb'], compare: 'rooms_otb_stly' })).ok).toBe(true);
    expect(errorOf(pace, spec('bullet', { x: 'hotel_code', y: ['rooms_otb'] }))).toMatch(/needs compare/);
  });

  it('radar needs at least three axes', () => {
    const scores = [{ hotel_code: 'AMS', staff: 8.4, comfort: 8.4, value: 7.9, food: 8.4 }];
    expect(fit(scores, spec('radar', { y: ['staff', 'comfort', 'value', 'food'] })).ok).toBe(true);
    expect(errorOf(scores, spec('radar', { y: ['staff', 'comfort'] }))).toMatch(/3–8 y columns/);
  });
});

describe('fitWidget: forecast, band, target and limit', () => {
  // A booking curve: actuals up to today, then the forecast (P50) with its P10–P90 range; capacity on every row.
  const curve: Row[] = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].map((period, i) => ({
    period,
    rooms: i < 3 ? 100 + i * 10 : null,
    rooms_p10: 110 + i * 8,
    rooms_p50: 115 + i * 10,
    rooms_p90: 120 + i * 12,
    budget_rooms_sold: 130,
    rooms_available: 180,
  }));
  // get_forecast by "hotel", grain "total".
  const hotels: Row[] = [
    { key: 'LIS', rooms_on_books: 2100, rooms_on_books_stly: 2300, rooms_p50: 2600, budget_rooms_sold: 2800 },
    { key: 'AMS', rooms_on_books: 3900, rooms_on_books_stly: 3700, rooms_p50: 4400, budget_rooms_sold: 4200 },
  ];
  const overlays = { forecast: 'rooms_p50', band: ['rooms_p10', 'rooms_p90'] as [string, string], target: 'budget_rooms_sold', limit: 'rooms_available' };

  it('line keeps all four; area has no target', () => {
    expect(fit(curve, spec('line', { x: 'period', y: ['rooms'], ...overlays }))).toMatchObject({ ok: true, value: overlays });
    const area = fit(curve, spec('area', { x: 'period', y: ['rooms'], ...overlays }));
    expect(area).toMatchObject({ ok: true, value: { forecast: 'rooms_p50', band: ['rooms_p10', 'rooms_p90'], limit: 'rooms_available' } });
    expect(area.ok && area.value.target).toBeUndefined();
  });

  it('a line per group keeps only the limit', () => {
    const byHotel = ['LIS', 'AMS'].flatMap((key) => curve.map((row) => ({ ...row, key })));
    const result = fit(byHotel, spec('line', { x: 'period', y: ['rooms'], group: 'key', ...overlays }));
    expect(result.ok && result.value).toMatchObject({ limit: 'rooms_available' });
    expect(result.ok && [result.value.forecast, result.value.band, result.value.target]).toEqual([undefined, undefined, undefined]);
  });

  it('a forecast on a line needs an ordered x', () => {
    expect(errorOf(hotels, spec('line', { x: 'key', y: ['rooms_on_books'], forecast: 'rooms_p50' }))).toMatch(/ordered x/);
  });

  it('bar draws a forecast and band only over dates, but a target over any categories', () => {
    expect(fit(curve, spec('bar', { x: 'period', y: ['rooms_p50'], ...overlays }))).toMatchObject({ ok: true, value: overlays });
    expect(errorOf(hotels, spec('bar', { x: 'key', y: ['rooms_on_books'], forecast: 'rooms_p50' }))).toMatch(/date order.*Leave forecast and band out/);
    expect(fit(hotels, spec('bar', { x: 'key', y: ['rooms_on_books'], target: 'budget_rooms_sold' }))).toMatchObject({ ok: true, value: { target: 'budget_rooms_sold' } });
  });

  it('kinds that do not draw them drop them', () => {
    const result = fit(hotels, spec('grouped_bar', { x: 'key', y: ['rooms_on_books', 'rooms_p50'], forecast: 'rooms_p50', target: 'budget_rooms_sold', limit: 'rooms_on_books' }));
    expect(result.ok && [result.value.forecast, result.value.target, result.value.limit]).toEqual([undefined, undefined, undefined]);
  });

  it('every one of them must be a number column of the result', () => {
    expect(errorOf(curve, spec('line', { x: 'period', y: ['rooms'], forecast: 'nope' }))).toMatch(/Unknown column "nope"/);
    expect(errorOf(curve, spec('line', { x: 'period', y: ['rooms'], band: ['rooms_p10', 'nope'] }))).toMatch(/Unknown column "nope"/);
    expect(errorOf(curve, spec('line', { x: 'period', y: ['rooms'], limit: 'period' }))).toMatch(/"period" is not a number column, so it cannot be limit/);
    expect(errorOf(hotels, spec('bullet', { x: 'key', y: ['rooms_on_books'], target: 'key' }))).toMatch(/cannot be target/);
  });

  it('band is [low, high]', () => {
    expect(errorOf(curve, spec('line', { x: 'period', y: ['rooms'], band: ['rooms_p90', 'rooms_p10'] }))).toMatch(/other way round/);
    expect(errorOf(curve, spec('line', { x: 'period', y: ['rooms'], band: ['rooms_p10', 'rooms_p10'] }))).toMatch(/two different columns/);
  });

  it('bullet against budget: target, forecast and last year as compare', () => {
    const budget = { x: 'key', y: ['rooms_on_books'], target: 'budget_rooms_sold', forecast: 'rooms_p50', compare: 'rooms_on_books_stly' };
    expect(fit(hotels, spec('bullet', budget))).toMatchObject({ ok: true, value: budget });
    expect(fit(hotels, spec('bullet', { x: 'key', y: ['rooms_on_books'], target: 'budget_rooms_sold' })).ok).toBe(true);
    const noBudget = hotels.map((row, i) => ({ ...row, budget_rooms_sold: i === 0 ? null : row['budget_rooms_sold'] }));
    expect(errorOf(noBudget, spec('bullet', { x: 'key', y: ['rooms_on_books'], target: 'budget_rooms_sold' }))).toMatch(/% of its own target.*empty or 0/);
  });
});

describe('fitWidget: stages and flows', () => {
  const stages = ['sessions', 'searches', 'checkout_starts', 'bookings'];

  it('funnel takes its stages from y columns, one funnel per row', () => {
    expect(fit(funnel, spec('funnel', { x: 'key', y: stages }))).toMatchObject({ ok: true, value: { x: 'key', y: stages } });
    expect(fit(funnel.slice(0, 1), spec('funnel', { y: stages })).ok).toBe(true);
  });

  it('funnel refuses stages that grow', () => {
    const error = errorOf(funnel.slice(0, 1), spec('funnel', { y: ['bookings', 'sessions'] }));
    expect(error).toMatch(/only shrink/);
    expect(error).toContain('"bookings"');
  });

  it('funnel takes its stages from rows too', () => {
    const rows = [{ stage: 'Sessions', visitors: 1000 }, { stage: 'Searches', visitors: 300 }, { stage: 'Bookings', visitors: 40 }];
    expect(fit(rows, spec('funnel', { x: 'stage', y: ['visitors'] })).ok).toBe(true);
    expect(errorOf([...rows].reverse(), spec('funnel', { x: 'stage', y: ['visitors'] }))).toMatch(/only shrink/);
  });

  it('waterfall takes one step per row', () => {
    const lines = [{ line: 'Rooms', variance_eur: 120 }, { line: 'F&B', variance_eur: -40 }, { line: 'Other', variance_eur: 5 }];
    expect(fit(lines, spec('waterfall', { x: 'line', y: ['variance_eur'] })).ok).toBe(true);
    expect(errorOf(lines, spec('waterfall', { y: ['variance_eur'] }))).toMatch(/needs x/);
  });

  it('scatter needs numbers on both axes', () => {
    expect(fit(pace, spec('scatter', { x: 'rooms_otb', y: ['pace_pct'], group: 'hotel_code' })).ok).toBe(true);
    expect(errorOf(pace, spec('scatter', { x: 'hotel_code', y: ['pace_pct'] }))).toMatch(/number column as x/);
  });

  it('sankey needs a source, a target and a flow', () => {
    const flows = [
      { channel: 'WEB', segment: 'RET', room_nights: 400 },
      { channel: 'WEB', segment: 'ADV', room_nights: 100 },
      { channel: 'OTA', segment: 'RET', room_nights: 250 },
    ];
    expect(fit(flows, spec('sankey', { x: 'channel', group: 'segment', y: ['room_nights'] })).ok).toBe(true);
    expect(errorOf(flows, spec('sankey', { x: 'channel', y: ['room_nights'] }))).toMatch(/needs group/);
    expect(errorOf(flows, spec('sankey', { x: 'channel', group: 'channel', y: ['room_nights'] }))).toMatch(/different/);
  });
});

describe('inferColumns', () => {
  const columns = inferColumns([
    { id: 'x:1', hotel_code: 'LIS', hotel_name: 'Arbor Lisbon Chiado', period: '2026-11-01', stay_date: '2026-11-20', month: '2026-11', pace_pct: null, revenue_eur: 12.5, rooms_otb: 40, value: 1.5, status: 'ok', facts: { a: 1 } },
    { id: 'x:2', hotel_code: 'AMS', hotel_name: 'Arbor Amsterdam Centraal', period: '2026-12-01', stay_date: '2026-11-21', month: '2026-12', pace_pct: -3.1, revenue_eur: 14, rooms_otb: 41, value: 2, status: 'stale', facts: null, extra: 7 },
  ]);
  const column = (key: string) => columns.find((c) => c.key === key);

  it('lists every key once, in the order the rows have them', () => {
    expect(columns.map((c) => c.key)).toEqual(['id', 'hotel_code', 'hotel_name', 'period', 'stay_date', 'month', 'pace_pct', 'revenue_eur', 'rooms_otb', 'value', 'status', 'facts', 'extra']);
  });

  it('reads the kind from the name and the values', () => {
    expect(column('hotel_code')).toMatchObject({ kind: 'hotel', label: 'Hotel' });
    expect(column('hotel_name')).toMatchObject({ kind: 'hotel' });
    expect(column('period')).toMatchObject({ kind: 'date' });
    expect(column('stay_date')).toMatchObject({ kind: 'date', label: 'Stay date' });
    expect(column('month')).toMatchObject({ kind: 'month' });
    expect(column('pace_pct')).toMatchObject({ kind: 'percent', label: 'Pace %' });
    expect(column('revenue_eur')).toMatchObject({ kind: 'currency', unit: 'EUR', label: 'Revenue' });
    expect(column('rooms_otb')).toMatchObject({ kind: 'count' });
    expect(column('value')).toMatchObject({ kind: 'number' });
    expect(column('status')).toMatchObject({ kind: 'text', label: 'Status' });
  });

  it('hides ids and nested values', () => {
    expect(column('id')).toMatchObject({ kind: 'id', hidden: true });
    expect(column('facts')).toMatchObject({ kind: 'text', hidden: true });
    expect(column('status')?.hidden).toBeUndefined();
  });
});
