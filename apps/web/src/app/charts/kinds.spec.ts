import { fitWidget } from '@compass/contracts/widget-fit';
import { SPECIMENS } from './catalog-samples';
import { KIND_LABELS, KIND_ORDER, compatibleKinds, recommendKind, recommendSpec, specAs } from './kinds';
import { WIDGET_KINDS, type EvidenceColumn, type WidgetKind, type WidgetRow, type WidgetSpec } from './widget-types';

/*
  Row shapes as the Halcyon tools return them (the column maps of apps/worker tool-views.ts), and what each can be
  shown as. The tables are the contract of "View as": a kind is offered only where it reads well, and never with a
  spec the server would refuse.
*/

const col = (key: string, label: string, kind: EvidenceColumn['kind'], unit?: string): EvidenceColumn => ({ key, label, kind, ...(unit ? { unit } : {}) });
const spec = (kind: WidgetKind, roles: Partial<WidgetSpec> = {}): WidgetSpec => ({ kind, title: 'Lisbon is 15.9% behind last year', sourceCallId: 'c1', ...roles });
const kinds = (s: WidgetSpec, rows: WidgetRow[], columns: EvidenceColumn[]) => compatibleKinds(s, rows, columns).map((option) => option.kind);
const day = (i: number) => new Date(Date.UTC(2026, 11, 1 + i)).toISOString().slice(0, 10);

const HOTELS = ['LIS', 'AMS', 'PAR', 'BER', 'VIE', 'BCN', 'DXB1', 'LON2'];

/* get_pace: one row per hotel, the number, last year, and a percentage. */
const paceColumns = [col('hotel_code', 'Hotel', 'hotel'), col('rooms_otb', 'On the books', 'count', 'room nights'), col('rooms_otb_stly', 'On the books, same time last year', 'count', 'room nights'), col('pace_pct', 'Pace vs last year', 'percent')];
const paceRows = HOTELS.map((hotel_code, i) => ({ hotel_code, rooms_otb: 900 - i * 70, rooms_otb_stly: 880 - i * 40, pace_pct: Math.round((2 - i * 3.1) * 10) / 10 }));

/* get_mix: the parts of one whole, with their share. */
const mixColumns = [col('period', 'Period from', 'date'), col('hotel_code', 'Hotel', 'hotel'), col('key', 'Segment', 'text'), col('room_nights', 'Room nights', 'count'), col('share_pct', 'Share of room nights', 'percent'), col('revenue_eur', 'Room revenue', 'currency', 'EUR'), col('adr_eur', 'ADR', 'currency', 'EUR')];
const mixRows = [
  ['Corporate', 412, 20.6, 74160, 180],
  ['Leisure', 980, 49.0, 147000, 150],
  ['Group', 310, 15.5, 40300, 130],
  ['Wholesale', 198, 9.9, 21780, 110],
  ['Crew', 100, 5.0, 9000, 90],
].map(([key, room_nights, share_pct, revenue_eur, adr_eur]) => ({ period: '2026-12-01', hotel_code: 'LIS', key, room_nights, share_pct, revenue_eur, adr_eur }));

/* get_metric by day: an ordered x, the value and last year. */
const dailyColumns = [col('period', 'Date', 'date'), col('key', 'Group', 'text'), col('value', 'Occupancy', 'percent'), col('compare_value', 'Occupancy, same time last year', 'percent')];
const dailyRows = Array.from({ length: 14 }, (_, i) => ({ period: day(i), key: 'Group', value: 70 + (i % 5) * 2.5, compare_value: 68 + (i % 4) * 2 }));

/* get_metric by hotel and month: two columns name each row. */
const trendColumns = [col('period', 'Month', 'month'), col('key', 'Hotel', 'hotel'), col('value', 'Room revenue', 'currency', 'EUR')];
const trendRows = (hotels: string[]) => hotels.flatMap((key, h) => ['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01'].map((period, m) => ({ period, key, value: 100000 + h * 9000 + m * 4000 })));

/* One row: a figure. */
const oneColumns = [col('period', 'Period from', 'date'), col('key', 'Hotel', 'hotel'), col('value', 'Occupancy', 'percent'), col('compare_value', 'Occupancy, same time last year', 'percent')];
const oneRow = [{ period: '2026-12-01', key: 'LIS', value: 72.4, compare_value: 76.1 }];

/* get_pnl by hotel: actual against budget. */
const pnlColumns = [col('key', 'Hotel', 'hotel'), col('months', 'Months', 'count'), col('revenue_eur', 'Total revenue', 'currency', 'EUR'), col('revenue_budget_eur', 'Revenue budget', 'currency', 'EUR'), col('gop_margin_pct', 'GOP margin', 'percent')];
const pnlRows = HOTELS.slice(0, 5).map((key, i) => ({ key, months: 1, revenue_eur: 900000 - i * 80000, revenue_budget_eur: 880000 - i * 60000, gop_margin_pct: 38 - i }));

/* The stages of the website funnel, one per row. */
const funnelColumns = [col('stage', 'Stage', 'text'), col('sessions', 'Sessions', 'count')];
const funnelRows = [['Visits', 48200], ['Searches', 21900], ['Checkout starts', 4100], ['Bookings', 1640]].map(([stage, sessions]) => ({ stage, sessions }));

/* A bridge: signed steps between two totals. */
const bridgeColumns = [col('step', 'Step', 'text'), col('amount', 'Amount', 'currency', 'EUR'), { ...col('kind', 'Kind', 'text'), hidden: true }];
const bridgeRows = [['Budget GOP', 1_420_000, 'total'], ['Rooms', 64_000, 'delta'], ['F&B', -38_000, 'delta'], ['Payroll', -52_000, 'delta'], ['Actual GOP', 1_394_000, 'total']].map(([step, amount, kind]) => ({ step, amount, kind }));

/* Two measures per hotel. */
const positionColumns = [col('hotel', 'Hotel', 'hotel'), col('occupancy_pct', 'Occupancy', 'percent'), col('adr_eur', 'ADR', 'currency', 'EUR')];
const positionRows = HOTELS.map((hotel, i) => ({ hotel, occupancy_pct: 60 + i * 3, adr_eur: 210 - i * 9 }));

/* Hotel by weekday: two categorical columns and a number. */
const gridColumns = [col('hotel', 'Hotel', 'hotel'), col('weekday', 'Weekday', 'text'), col('occupancy_pct', 'Occupancy', 'percent')];
const gridRows = HOTELS.flatMap((hotel, h) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((weekday, d) => ({ hotel, weekday, occupancy_pct: 55 + h * 2 + d * 3 })));

/* Segment by hotel: counts that add up. */
const stackColumns = [col('hotel_code', 'Hotel', 'hotel'), col('key', 'Segment', 'text'), col('room_nights', 'Room nights', 'count')];
const stackRows = HOTELS.slice(0, 4).flatMap((hotel_code, h) => ['Corporate', 'Leisure', 'Group'].map((key, s) => ({ hotel_code, key, room_nights: 300 + h * 40 + s * 90 })));

/* Reviews: text to read. */
const reviewColumns = [col('hotel_code', 'Hotel', 'hotel'), col('review_date', 'Review date', 'date'), col('overall_score', 'Score', 'number', 'out of 10'), col('negative_text', 'What they disliked', 'text')];
const reviewRows = HOTELS.slice(0, 4).map((hotel_code, i) => ({ hotel_code, review_date: day(i), overall_score: 6.2 + i, negative_text: 'Construction noise from the floor below started early every morning, and nobody at the desk could say when it would end.' }));

describe('compatibleKinds: the kinds a chart can be switched to', () => {
  const cases: [name: string, spec: WidgetSpec, rows: WidgetRow[], columns: EvidenceColumn[], expected: WidgetKind[]][] = [
    ['a ranking of 8 hotels with last year', spec('bar', { x: 'hotel_code', y: ['rooms_otb'], compare: 'rooms_otb_stly' }), paceRows, paceColumns, ['bullet', 'bar', 'grouped_bar', 'treemap', 'table']],
    ['a ranking on a percentage that goes below zero: points do not add up into a bridge', spec('bar', { x: 'hotel_code', y: ['pace_pct'] }), paceRows, paceColumns, ['bar', 'table']],
    ['5 parts of one whole, as counts', spec('donut', { group: 'key', y: ['room_nights'] }), mixRows, mixColumns, ['bar', 'donut', 'pie', 'treemap', 'table']],
    ['5 shares that add up to 100%', spec('bar', { x: 'key', y: ['share_pct'] }), mixRows, mixColumns, ['bar', 'donut', 'pie', 'treemap', 'table']],
    ['5 averages, which are not parts of anything', spec('bar', { x: 'key', y: ['adr_eur'] }), mixRows, mixColumns, ['bar', 'table']],
    ['14 days with last year', spec('line', { x: 'period', y: ['value'], compare: 'compare_value' }), dailyRows, dailyColumns, ['bar', 'grouped_bar', 'line', 'area', 'calendar_heatmap', 'table']],
    ['4 months for 3 hotels', spec('line', { x: 'period', y: ['value'], group: 'key' }), trendRows(['LIS', 'AMS', 'PAR']), trendColumns, ['grouped_bar', 'stacked_bar', 'line', 'area', 'sparkline_list', 'heatmap', 'table']],
    ['4 months for 8 hotels: too many lines to read', spec('sparkline_list', { x: 'period', y: ['value'], group: 'key' }), trendRows(HOTELS), trendColumns, ['sparkline_list', 'heatmap', 'table']],
    ['one number with last year', spec('kpi', { y: ['value'], compare: 'compare_value' }), oneRow, oneColumns, ['kpi', 'gauge', 'table']],
    ['one row, three numbers', spec('kpi_row', { y: ['revenue_eur', 'revenue_budget_eur', 'gop_margin_pct'] }), pnlRows.slice(0, 1), pnlColumns, ['kpi_row', 'table']],
    ['actual against budget for 5 hotels', spec('bullet', { x: 'key', y: ['revenue_eur'], compare: 'revenue_budget_eur' }), pnlRows, pnlColumns, ['bullet', 'bar', 'grouped_bar', 'donut', 'pie', 'treemap', 'table']],
    ['4 stages that only shrink', spec('funnel', { x: 'stage', y: ['sessions'] }), funnelRows, funnelColumns, ['kpi_row', 'bar', 'funnel', 'table']],
    ['stages named by their column, seen as bars', spec('bar', { x: 'stage', y: ['sessions'] }), funnelRows, funnelColumns, ['kpi_row', 'bar', 'funnel', 'table']],
    ['signed steps between two totals', spec('waterfall', { x: 'step', y: ['amount'] }), bridgeRows, bridgeColumns, ['bar', 'waterfall', 'table']],
    ['two numbers per hotel', spec('scatter', { x: 'occupancy_pct', y: ['adr_eur'], group: 'hotel' }), positionRows, positionColumns, ['scatter', 'table']],
    ['a hotel by weekday grid', spec('heatmap', { x: 'weekday', y: ['occupancy_pct'], group: 'hotel' }), gridRows, gridColumns, ['heatmap', 'table']],
    ['segments within 4 hotels', spec('stacked_bar', { x: 'hotel_code', y: ['room_nights'], group: 'key' }), stackRows, stackColumns, ['grouped_bar', 'stacked_bar', 'heatmap', 'table']],
    ['a table of a ranking', spec('table'), paceRows, paceColumns, ['bullet', 'bar', 'grouped_bar', 'treemap', 'table']],
    ['a table of reviews', spec('table'), reviewRows, reviewColumns, ['table']],
  ];

  it.each(cases)('%s', (_name, s, rows, columns, expected) => {
    expect(kinds(s, rows, columns)).toEqual(expected);
  });

  it('always offers the kind the chart was drawn as, even one this version would not suggest', () => {
    for (const group of SPECIMENS) {
      for (const specimen of group.items) expect(kinds(specimen.spec, specimen.rows, specimen.columns), specimen.id).toContain(specimen.spec.kind);
    }
    const radar = spec('radar', { x: 'hotel', y: ['occupancy_pct', 'adr_eur'] });
    expect(compatibleKinds(radar, positionRows, positionColumns).find((option) => option.kind === 'radar')?.spec).toBe(radar);
  });

  it('offers a table for any rows, and nothing else to switch to without rows or beyond 400 of them', () => {
    for (const [, s, rows, columns] of cases) expect(kinds(s, rows, columns)).toContain('table');
    const line = spec('line', { x: 'period', y: ['value'] });
    expect(kinds(line, [], dailyColumns)).toEqual(['line']);
    expect(compatibleKinds(line, null)).toEqual([{ kind: 'line', reason: 'How it was drawn.', spec: line }]);
    const many = Array.from({ length: 401 }, (_, i) => ({ period: day(i), value: i }));
    expect(kinds(line, many, dailyColumns)).toEqual(['line']);
  });

  it('never offers a spec the server would refuse: every option passes the check behind show_widget and "Add to board"', () => {
    for (const [name, s, rows, columns] of cases) {
      for (const option of compatibleKinds(s, rows, columns)) {
        const result = fitWidget(option.spec, { rows: rows as Record<string, unknown>[], columns });
        expect(result.ok, `${name} as ${option.kind}: ${result.ok ? '' : result.error}`).toBe(true);
        expect(option.spec.title).toBe(s.title);
        expect(option.spec.sourceCallId).toBe(s.sourceCallId);
      }
    }
  });

  it('keeps the order figures, comparisons, trends, parts, relations, table, and names every kind', () => {
    expect([...KIND_ORDER].sort()).toEqual([...WIDGET_KINDS].sort());
    for (const [, s, rows, columns] of cases) {
      const offered = kinds(s, rows, columns);
      expect(offered).toEqual(KIND_ORDER.filter((kind) => offered.includes(kind)));
    }
    expect(Object.keys(KIND_LABELS).sort()).toEqual([...WIDGET_KINDS].sort());
  });

  it('says why each kind fits, in words about these rows', () => {
    const reasons = Object.fromEntries(compatibleKinds(spec('donut', { group: 'key', y: ['room_nights'] }), mixRows, mixColumns).map((option) => [option.kind, option.reason]));
    expect(reasons).toEqual({ bar: 'One bar per segment.', donut: '5 parts of one whole.', pie: '5 parts of one whole.', treemap: '5 parts, sized by their share.', table: 'The exact 5 rows.' });
    const trend = Object.fromEntries(compatibleKinds(spec('line', { x: 'period', y: ['value'], compare: 'compare_value' }), dailyRows, dailyColumns).map((option) => [option.kind, option.reason]));
    expect(trend['line']).toBe('Date is in order, so the values read as a trend.');
    expect(trend['calendar_heatmap']).toBe('One value per day, laid out as a calendar.');
  });

  describe('the rules a kind has beyond the server’s', () => {
    it('donut and pie: 2–7 positive parts of one whole', () => {
      const donut = (rows: WidgetRow[], y = 'room_nights') => kinds(spec('bar', { x: 'key', y: [y] }), rows, mixColumns).includes('donut');
      expect(donut(mixRows)).toBe(true);
      expect(donut(mixRows.slice(0, 1))).toBe(false);
      expect(donut([...mixRows, ...mixRows.slice(0, 3).map((row) => ({ ...row, key: `${row.key} 2` }))])).toBe(false); // 8 parts
      expect(donut(mixRows.map((row, i) => (i === 0 ? { ...row, room_nights: -5 } : row)))).toBe(false);
      expect(donut(mixRows.map((row, i) => ({ ...row, room_nights: i === 0 ? 40 : 0 })))).toBe(false); // one part is not a split
      expect(donut(mixRows.map((row) => ({ ...row, share_pct: 30 })), 'share_pct')).toBe(false); // 150%
      expect(donut(mixRows, 'adr_eur')).toBe(false);
    });

    it('line and area: only along an ordered x', () => {
      const offered = kinds(spec('bar', { x: 'hotel_code', y: ['rooms_otb'] }), paceRows, paceColumns);
      expect(offered).not.toContain('line');
      expect(offered).not.toContain('area');
      const lead = [1, 2, 3, 4].map((days_out) => ({ days_out, rooms: 40 - days_out * 3 }));
      expect(kinds(spec('line', { x: 'days_out', y: ['rooms'] }), lead, [col('days_out', 'Days out', 'count'), col('rooms', 'Rooms', 'count')])).toEqual(['bar', 'line', 'area', 'table']);
    });

    it('scatter: two different numbers per point, and at least three points', () => {
      const two = spec('grouped_bar', { x: 'hotel', y: ['occupancy_pct', 'adr_eur'] });
      expect(kinds(two, positionRows, positionColumns)).toContain('scatter');
      expect(kinds(two, positionRows.slice(0, 2), positionColumns)).not.toContain('scatter');
      expect(kinds(spec('bar', { x: 'hotel_code', y: ['rooms_otb'], compare: 'rooms_otb_stly' }), paceRows, paceColumns)).not.toContain('scatter');
    });

    it('a kind that draws one number never stands in for a chart of several: no series is quietly left out', () => {
      const stages = [col('device', 'Device', 'text'), col('sessions', 'Sessions', 'count'), col('searches', 'Searches', 'count'), col('bookings', 'Bookings', 'count')];
      const devices = [{ device: 'mobile', sessions: 18600, searches: 7400, bookings: 310 }, { device: 'desktop', sessions: 9061, searches: 5200, bookings: 420 }];
      expect(kinds(spec('funnel', { x: 'device', y: ['sessions', 'searches', 'bookings'] }), devices, stages)).toEqual(['grouped_bar', 'funnel', 'table']);
      const lines = spec('line', { x: 'period', y: ['a', 'b', 'c'] });
      const months = ['2026-09-01', '2026-10-01', '2026-11-01'].map((period, i) => ({ period, a: 10 + i, b: 20 + i, c: 30 + i }));
      expect(kinds(lines, months, [col('period', 'Month', 'month'), col('a', 'A', 'count'), col('b', 'B', 'count'), col('c', 'C', 'count')])).toEqual(['grouped_bar', 'stacked_bar', 'line', 'area', 'table']);
      // A number next to its own comparison is still one number: it can be a bar with last year as its tick.
      const pair = spec('grouped_bar', { x: 'hotel_code', y: ['rooms_otb', 'rooms_otb_stly'] });
      expect(specAs(pair, 'bar', paceRows, paceColumns)).toMatchObject({ kind: 'bar', x: 'hotel_code', y: ['rooms_otb'], compare: 'rooms_otb_stly' });
    });

    it('heatmap: two columns that name each row together, two values each, and a number', () => {
      expect(kinds(spec('grouped_bar', { x: 'hotel_code', y: ['room_nights'], group: 'key' }), stackRows, stackColumns)).toContain('heatmap');
      expect(kinds(spec('bar', { x: 'hotel_code', y: ['rooms_otb'] }), paceRows, paceColumns)).not.toContain('heatmap');
    });

    it('waterfall: ordered steps with both signs, or rows that mark their totals', () => {
      const steps = (rows: WidgetRow[]) => kinds(spec('bar', { x: 'step', y: ['amount'] }), rows, [col('step', 'Step', 'text'), col('amount', 'Amount', 'currency', 'EUR')]).includes('waterfall');
      expect(steps([{ step: 'Rooms', amount: 64000 }, { step: 'F&B', amount: -38000 }, { step: 'Other', amount: 9000 }])).toBe(true);
      expect(steps([{ step: 'Rooms', amount: 64000 }, { step: 'F&B', amount: 38000 }])).toBe(false);
      expect(steps([{ step: 'Budget', amount: 100, kind: 'total' }, { step: 'Rooms', amount: 20, kind: 'delta' }])).toBe(true);
    });

    it('funnel: stages in order that only shrink', () => {
      const funnel = (rows: WidgetRow[], columns = funnelColumns, x = 'stage') => kinds(spec('bar', { x, y: ['sessions'] }), rows, columns).includes('funnel');
      expect(funnel(funnelRows)).toBe(true);
      expect(funnel([...funnelRows].reverse())).toBe(false);
      expect(funnel(funnelRows.map((row) => ({ ...row, sessions: 100 })))).toBe(false);
      // Hotels sorted by a count also "only shrink", and are not stages.
      expect(funnel(funnelRows.map((row, i) => ({ hotel: HOTELS[i], sessions: row.sessions })), [col('hotel', 'Hotel', 'hotel'), col('sessions', 'Sessions', 'count')], 'hotel')).toBe(false);
    });

    it('tiles: 1–4 numbers, from one row or from up to four named rows', () => {
      const tiles = (n: number) => kinds(spec('bar', { x: 'key', y: ['room_nights'] }), mixRows.slice(0, n), mixColumns).includes('kpi_row');
      expect([2, 3, 4, 5].map(tiles)).toEqual([true, true, true, false]);
      const row = { a: 1, b: 2, c: 3, d: 4, e: 5 };
      const wide = (y: string[]) => kinds(spec('table', { y }), [row], y.map((key) => col(key, key.toUpperCase(), 'count')));
      expect(wide(['a'])).toEqual(['kpi', 'table']);
      expect(wide(['a', 'b'])).toEqual(['kpi_row', 'table']);
      expect(wide(['a', 'b', 'c', 'd'])).toEqual(['kpi_row', 'table']);
    });
  });
});

describe('specAs', () => {
  it('re-reads the same columns in the roles the kind needs', () => {
    const bar = spec('bar', { x: 'key', y: ['room_nights'], subtitle: 'Arbor Lisbon Chiado · December 2026', format: 'count' });
    expect(specAs(bar, 'donut', mixRows, mixColumns)).toEqual({ kind: 'donut', title: bar.title, subtitle: bar.subtitle, sourceCallId: 'c1', group: 'key', y: ['room_nights'], format: 'count' });
    expect(specAs(bar, 'table', mixRows, mixColumns)).toEqual({ kind: 'table', title: bar.title, subtitle: bar.subtitle, sourceCallId: 'c1' });
    const line = spec('line', { x: 'period', y: ['value'], compare: 'compare_value' });
    expect(specAs(line, 'grouped_bar', dailyRows, dailyColumns)).toMatchObject({ kind: 'grouped_bar', x: 'period', y: ['value', 'compare_value'] });
  });

  it('keeps the spec when the kind is its own, unknown or does not fit', () => {
    const bar = spec('bar', { x: 'hotel_code', y: ['rooms_otb'] });
    expect(specAs(bar, 'bar', paceRows, paceColumns)).toBe(bar);
    expect(specAs(bar, null, paceRows, paceColumns)).toBe(bar);
    expect(specAs(bar, 'line', paceRows, paceColumns)).toBe(bar);
    expect(specAs(bar, 'donut', null)).toBe(bar);
  });

  it('switches within a family without touching a role', () => {
    const area = spec('area', { x: 'period', y: ['value'], compare: 'compare_value', format: 'percent' });
    expect(specAs(area, 'line', dailyRows, dailyColumns)).toEqual({ ...area, kind: 'line' });
    const grouped = spec('grouped_bar', { x: 'hotel_code', y: ['room_nights'], group: 'key' });
    expect(specAs(grouped, 'stacked_bar', stackRows, stackColumns)).toEqual({ ...grouped, kind: 'stacked_bar', format: 'count' });
  });
});

describe('recommendKind: the first look at rows, with no model', () => {
  const cases: [name: string, rows: WidgetRow[], columns: EvidenceColumn[], expected: WidgetKind, roles?: Partial<WidgetSpec>][] = [
    ['one row per hotel → bar, with last year next to it', paceRows, paceColumns, 'bar', { x: 'hotel_code', y: ['rooms_otb'], compare: 'rooms_otb_stly' }],
    ['one row per day → line, with last year', dailyRows, dailyColumns, 'line', { x: 'period', y: ['value'], compare: 'compare_value' }],
    ['one row → a number', oneRow, oneColumns, 'kpi', { y: ['value'], compare: 'compare_value' }],
    ['one row with its change worked out → still one number: the change is its delta, not a second figure', [{ ...oneRow[0]!, change: -3.7, change_pct: -4.9 }], [...oneColumns, col('change', 'Change', 'number', 'pts'), col('change_pct', 'Change %', 'percent')], 'kpi', { y: ['value'], compare: 'compare_value' }],
    ['one row, several numbers → tiles (comparisons become their deltas)', pnlRows.slice(0, 1), pnlColumns, 'kpi_row', { y: ['revenue_eur', 'gop_margin_pct'] }],
    ['parts with a share column that adds up → donut', mixRows, mixColumns, 'donut', { group: 'key', y: ['room_nights'] }],
    ['more than 7 parts → bar', [...mixRows, ...mixRows.map((row) => ({ ...row, key: `${row.key} B`, share_pct: 0 }))], mixColumns, 'bar'],
    ['a period column that is the same on every row is not an axis', paceRows.map((row) => ({ period: '2026-12-01', ...row })), [col('period', 'Period from', 'date'), ...paceColumns], 'bar', { x: 'hotel_code' }],
    ['months for 3 hotels → a line each', trendRows(['LIS', 'AMS', 'PAR']), trendColumns, 'line', { x: 'period', group: 'key', y: ['value'] }],
    ['months for 8 hotels → sparklines', trendRows(HOTELS), trendColumns, 'sparkline_list', { x: 'period', group: 'key' }],
    ['segments within hotels, counts → stacked bars', stackRows, stackColumns, 'stacked_bar', { x: 'hotel_code', group: 'key' }],
    ['a grid of a rate → heatmap', gridRows, gridColumns, 'heatmap', { x: 'hotel', group: 'weekday' }],
    ['stages that shrink → funnel', funnelRows, funnelColumns, 'funnel', { x: 'stage', y: ['sessions'] }],
    ['actual against budget → bar with the budget as the comparison', pnlRows, pnlColumns, 'bar', { x: 'key', y: ['revenue_eur'], compare: 'revenue_budget_eur' }],
    ['numbers only → scatter', positionRows.map(({ occupancy_pct, adr_eur }) => ({ occupancy_pct, adr_eur })), positionColumns.slice(1), 'scatter', { x: 'adr_eur', y: ['occupancy_pct'] }],
    ['reviews → table', reviewRows, reviewColumns, 'table'],
    ['text only → table', [{ label: 'Occupancy', definition: 'Rooms sold over rooms available' }, { label: 'ADR', definition: 'Room revenue over rooms sold' }], [col('label', 'Metric', 'text'), col('definition', 'Definition', 'text')], 'table'],
    ['no rows → table', [], paceColumns, 'table'],
    ['more than 400 rows → table', Array.from({ length: 401 }, (_, i) => ({ period: day(i), value: i })), dailyColumns, 'table'],
  ];

  it.each(cases)('%s', (_name, rows, columns, expected, roles) => {
    expect(recommendKind(rows, columns)).toBe(expected);
    if (roles) expect(recommendSpec(rows, columns)).toMatchObject(roles);
  });

  it('is the same answer every time: no clock, no chance', () => {
    for (const [, rows, columns] of cases) expect(recommendSpec(rows, columns)).toEqual(recommendSpec(rows, columns));
  });

  it('reads columns nobody described from their names and values', () => {
    expect(recommendSpec(paceRows, [])).toMatchObject({ kind: 'bar', x: 'hotel_code', y: ['rooms_otb'] });
    expect(recommendKind(dailyRows, null)).toBe('line');
  });

  it('returns a spec the server accepts, or none', () => {
    for (const [name, rows, columns] of cases) {
      const picked = recommendSpec(rows, columns);
      if (!picked) continue;
      const result = fitWidget({ title: 'Preview', sourceCallId: 'c1', ...picked }, { rows: rows as Record<string, unknown>[], columns });
      expect(result.ok, `${name}: ${result.ok ? '' : result.error}`).toBe(true);
    }
    expect(recommendSpec([], paceColumns)).toBeNull();
    expect(recommendSpec(null)).toBeNull();
  });

  describe('with a hint', () => {
    it('takes Kassandra’s kind and columns when the rows allow them', () => {
      expect(recommendSpec(mixRows, mixColumns, { kind: 'bar', x: 'key', y: ['revenue_eur'] })).toMatchObject({ kind: 'bar', x: 'key', y: ['revenue_eur'] });
      expect(recommendKind(paceRows, paceColumns, { kind: 'treemap', group: 'hotel_code', y: ['rooms_otb'] })).toBe('treemap');
    });

    it('falls back to its own reading when the hinted kind does not fit, keeping the hinted columns', () => {
      expect(recommendSpec(paceRows, paceColumns, { kind: 'donut', group: 'hotel_code', y: ['pace_pct'] })).toMatchObject({ kind: 'bar', x: 'hotel_code', y: ['pace_pct'] });
      expect(recommendKind(paceRows, paceColumns, { kind: 'line', x: 'hotel_code', y: ['rooms_otb'] })).toBe('bar');
    });

    it('uses a tool’s usual columns: which number to draw, against what', () => {
      expect(recommendSpec(paceRows, paceColumns, { y: ['pace_pct'] })).toMatchObject({ kind: 'bar', x: 'hotel_code', y: ['pace_pct'] });
      expect(recommendSpec(pnlRows, pnlColumns, { kind: 'bullet', y: ['revenue_eur'], compare: 'revenue_budget_eur' })).toMatchObject({ kind: 'bullet', x: 'key', y: ['revenue_eur'], compare: 'revenue_budget_eur' });
    });
  });
});
