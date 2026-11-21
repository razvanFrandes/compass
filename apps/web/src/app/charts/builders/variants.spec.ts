import { DARK_TOKENS, LIGHT_TOKENS } from '../tokens';
import type { EvidenceColumn, WidgetKind, WidgetRow, WidgetSpec } from '../widget-types';
import { type BuildInput, type Built, buildWidget } from './index';
import { rangeName, weekendRuns } from './overlays';

/* The hotel charts the Portfolio board draws: forecast, band, target and limit; diverging and hatched stacks; bullets against budget; KPI trends. */

type Obj = Record<string, unknown>;
const col = (key: string, label: string, kind: EvidenceColumn['kind'], unit?: string): EvidenceColumn => ({ key, label, kind, ...(unit ? { unit } : {}) });
const spec = (kind: WidgetKind, over: Partial<WidgetSpec> = {}): WidgetSpec => ({ kind, title: 'Title', sourceCallId: 'call_1', ...over });
const build = (s: WidgetSpec, rows: WidgetRow[], columns: EvidenceColumn[], over: Partial<BuildInput> = {}) => buildWidget({ spec: s, rows, columns, tokens: LIGHT_TOKENS, width: 720, ...over });
const opt = (b: Built) => (b as Extract<Built, { render: 'echarts' }>).option as Obj;
const series = (b: Built) => opt(b)['series'] as Obj[];
const named = (b: Built, name: string) => series(b).find((s) => s['name'] === name)!;
const day = (i: number) => new Date(Date.UTC(2026, 10, 21 + i)).toISOString().slice(0, 10);

describe('booking curve: line with forecast, band and limit', () => {
  // Ten booking dates; actuals stop at index 5 ("today"), the projection carries on.
  const rows = Array.from({ length: 10 }, (_, k) => ({
    booked_as_of: day(k),
    this_year: k <= 5 ? 100 + k * 10 : null,
    last_year: 90 + k * 9,
    p10: k >= 5 ? 150 + (k - 5) * 5 : null,
    p50: k >= 5 ? 150 + (k - 5) * 8 : null,
    p90: k >= 5 ? 150 + (k - 5) * 11 : null,
    capacity: 400,
  }));
  const columns = [col('booked_as_of', 'Booked as of', 'date'), col('this_year', 'This year', 'count'), col('last_year', 'Same time last year', 'count'), col('p10', 'P10', 'count'), col('p50', 'Projection (P50)', 'count'), col('p90', 'P90', 'count'), col('capacity', 'Capacity', 'count')];
  const b = build(spec('line', { x: 'booked_as_of', y: ['this_year'], compare: 'last_year', forecast: 'p50', band: ['p10', 'p90'], limit: 'capacity' }), rows, columns);

  it('draws the range as a band under a dotted projection that starts where the actuals stop', () => {
    const band = named(b, 'Likely range (P10–P90)');
    expect(band['stack']).toBe('__band');
    expect((band['data'] as (number | null)[])[9]).toBe(194 - 170);
    const fc = named(b, 'Projection (P50)');
    expect((fc['lineStyle'] as Obj)['type']).toEqual([2, 3]);
    expect((fc['data'] as (number | null)[])[5]).toBe(150);
  });

  it('marks Today and the capacity, and lets the axis reach the capacity', () => {
    const marks = (named(b, '__marks')['markLine'] as Obj)['data'] as Obj[];
    expect(marks.map((m) => m['xAxis'] ?? m['yAxis'])).toEqual([400, 5]);
    expect(JSON.stringify(marks)).toContain('Capacity 400');
    expect(JSON.stringify(marks)).toContain('Today');
    expect((opt(b)['yAxis'] as Obj)['max']).toBe(400);
  });

  it('names everything in the legend, and keeps the first series index for the keyboard', () => {
    expect(b.legend.map((l) => [l.label, l.mark])).toEqual([
      ['This year', 'line'],
      ['Same time last year', 'dashed'],
      ['Likely range (P10–P90)', 'band'],
      ['Projection (P50)', 'dotted'],
    ]);
    const points = (b as Extract<Built, { render: 'echarts' }>).points;
    expect(series(b)[points[0].seriesIndex]['name']).toBe('This year');
  });
});

describe('forecast occupancy: columns with forecast, band and a budget step', () => {
  const rows = Array.from({ length: 14 }, (_, k) => ({ night: day(k), on_books: 50 + k, p10: 60 + k, p50: 70 + k, p90: 80 + k, budget: 75 }));
  const columns = [col('night', 'Night of stay', 'date'), col('on_books', 'On the books', 'percent'), col('p10', 'P10', 'percent'), col('p50', 'Forecast (P50)', 'percent'), col('p90', 'P90', 'percent'), col('budget', 'Budget', 'percent')];
  const b = build(spec('bar', { x: 'night', y: ['on_books'], forecast: 'p50', band: ['p10', 'p90'], target: 'budget' }), rows, columns);

  it('draws the budget as a step and caps a share of rooms at 100%', () => {
    expect(named(b, 'Budget')['step']).toBe('middle');
    expect((opt(b)['yAxis'] as Obj)['max']).toBe(100);
  });

  it('shades the weekends of nights of stay', () => {
    const area = (named(b, '__marks')['markArea'] as Obj)['data'] as Obj[][];
    // 21 Nov 2026 is a Saturday: Sat 21, then Fri 27 – Sat 28, then Fri 4 Dec.
    expect(area.map(([a, z]) => [a['xAxis'], z['xAxis']])).toEqual([
      [0, 0],
      [6, 7],
      [13, 13],
    ]);
    expect(b.legend.map((l) => l.label)).toContain('Weekends (Fri, Sat)');
  });

  it('says the forecast in the tooltip', () => {
    const html = ((opt(b)['tooltip'] as Obj)['formatter'] as (p: unknown) => string)([{ dataIndex: 3 }]);
    expect(html).toContain('Forecast (P50)');
    expect(html).toContain('Likely range (P10–P90)');
    expect(html).toContain('Budget');
  });
});

describe('stacks that carry more than parts', () => {
  it('pickup: cancellations below zero in grey, last year as a dashed step over the columns', () => {
    const rows = Array.from({ length: 10 }, (_, k) => ({ night: day(k), booked: 100 + k, cancelled: -(20 + k), last_year_net: 70 }));
    const b = build(spec('stacked_bar', { x: 'night', y: ['booked', 'cancelled'], compare: 'last_year_net' }), rows, [col('night', 'Night of stay', 'date'), col('booked', 'Booked', 'count'), col('cancelled', 'Cancelled', 'count'), col('last_year_net', 'Last year, net', 'count')]);
    expect((named(b, 'Cancelled')['itemStyle'] as Obj)['color']).toBe(LIGHT_TOKENS.grey);
    expect(named(b, 'Last year, net')['type']).toBe('line');
    expect(named(b, 'Last year, net')['step']).toBe('middle');
    expect(named(b, '__zero')).toBeDefined();
    expect(b.summary).toContain('Bars above and below zero');
  });

  it('channel net: commission hatched in the same hue, last year as a tick across each row', () => {
    const rows = [
      { channel: 'Brand website', net: 500, commission: 10, last_year_net: 450 },
      { channel: 'Booking.com', net: 400, commission: 70, last_year_net: 420 },
      { channel: 'Expedia', net: 200, commission: 40, last_year_net: 180 },
    ];
    const b = build(spec('stacked_bar', { x: 'channel', y: ['net', 'commission'], compare: 'last_year_net' }), rows, [col('channel', 'Channel', 'text'), col('net', 'Net room revenue', 'currency', 'EUR'), col('commission', 'Commission', 'currency', 'EUR'), col('last_year_net', 'Last year net', 'currency', 'EUR')], { tokens: DARK_TOKENS });
    const fill = (named(b, 'Commission')['itemStyle'] as Obj)['color'] as Obj;
    expect(String(fill['image'])).toContain('data:image/svg+xml');
    expect((named(b, 'Commission')['itemStyle'] as Obj)['borderColor']).toBe(DARK_TOKENS.series);
    expect(named(b, 'Last year net')['type']).toBe('scatter');
    expect(b.legend.map((l) => l.mark)).toEqual(['solid', 'hatch', 'tick']);
  });
});

describe('bullet against budget', () => {
  const rows = [
    { hotel: 'Hotel A', on_books: 63, forecast: 90, ly: 60, budget: 100 },
    { hotel: 'Group total', on_books: 700, forecast: 950, ly: 650, budget: 1000 },
    { hotel: 'Hotel B', on_books: 300, forecast: 420, ly: 320, budget: 400 },
  ];
  const columns = [col('hotel', 'Hotel', 'text'), col('on_books', 'On the books', 'currency', 'EUR'), col('forecast', 'Forecast (P50)', 'currency', 'EUR'), col('ly', 'Last year', 'currency', 'EUR'), col('budget', 'Budget', 'currency', 'EUR')];
  const s = spec('bullet', { x: 'hotel', y: ['on_books'], target: 'budget', forecast: 'forecast', compare: 'ly' });

  it('draws each row as % of its own budget, the total first and then the worst', () => {
    const b = build(s, rows, columns, { width: 900 });
    expect(series(b)[0]['data']).toEqual([70, 63, 75]);
    expect(series(b)[1]['data']).toEqual([25, 27, 30]);
    expect(((series(b)[3]['markLine'] as Obj)['data'] as Obj[])[0]['xAxis']).toBe(100);
    expect(b.rows).toEqual([1, 0, 2]);
  });

  it('says the amount, the gap to last year and the share of budget beside each row; only the share on a phone', () => {
    const wide = (opt(build(s, rows, columns, { width: 900 }))['yAxis'] as Obj[])[1]['data'] as string[];
    expect(wide[1]).toBe('€63 · +€3 vs last year · 63% of budget');
    const phone = (opt(build(s, rows, columns, { width: 360 }))['yAxis'] as Obj[])[1]['data'] as string[];
    expect(phone[1]).toBe('63%');
  });

  it('shows every row when the host gives it the height', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ hotel: `Hotel ${i}`, on_books: 50 + i, budget: 100 }));
    const b = build(spec('bullet', { x: 'hotel', y: ['on_books'], target: 'budget' }), many, [col('hotel', 'Hotel', 'text'), col('on_books', 'On the books', 'currency', 'EUR'), col('budget', 'Budget', 'currency', 'EUR')], { height: 21 * 26 + 64 });
    expect(b.more).toBeUndefined();
    expect(series(b)[0]['data'] as unknown[]).toHaveLength(21);
  });

  it('keeps the old meaning of compare without a target', () => {
    const b = build(spec('bullet', { x: 'hotel', y: ['on_books'], compare: 'budget' }), rows, columns);
    expect(b.legend.map((l) => l.label)).toEqual(['On the books', 'Budget']);
  });
});

describe('KPI tiles with their trend', () => {
  it('draws the trend and the comparison’s trend on one scale', () => {
    const b = build(spec('kpi_row', { y: ['occupancy'] }), [{ occupancy: 51.4, occupancy_cmp: 50, occupancy_trend: [40, 50, 60], occupancy_cmp_trend: [45, 45, 45] }], [col('occupancy', 'Occupancy', 'percent'), col('occupancy_cmp', 'Last year', 'percent')]);
    expect(b.render).toBe('kpi_row');
    const tile = (b as Extract<Built, { render: 'kpi_row' }>).tiles[0];
    expect(tile.spark?.line).toBeTruthy();
    expect(tile.sparkCmp?.line).toBeTruthy();
    expect(tile.versus).toBe('vs last year');
  });
});

describe('overlay helpers', () => {
  it('names a P10–P90 range plainly', () => {
    expect(rangeName('P10', 'P90')).toBe('Likely range (P10–P90)');
    expect(rangeName('Low', 'High')).toBe('Low–High');
  });
  it('finds Friday–Saturday runs', () => {
    const dates = Array.from({ length: 8 }, (_, i) => Date.UTC(2026, 10, 20 + i));
    expect(weekendRuns(dates)).toEqual([
      [0, 1],
      [7, 7],
    ]);
  });
});
