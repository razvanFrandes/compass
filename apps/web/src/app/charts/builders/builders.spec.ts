import { SPECIMENS } from '../catalog-samples';
import { DARK_TOKENS, LIGHT_TOKENS, contrast, inkOn } from '../tokens';
import { WIDGET_KINDS, type EvidenceColumn, type WidgetKind, type WidgetRow, type WidgetSpec } from '../widget-types';
import { calendarLayout } from './matrix';
import { hasCycle } from './parts';
import { niceCeil, niceStep } from './points';
import { sparkPath } from './figures';
import { waterfallBreak, waterfallSteps } from './cartesian';
import { BUILDERS, type BuildInput, type Built, bodyHeight, buildWidget, context, kpiColumns } from './index';

type Obj = Record<string, unknown>;
type EChartsBuilt = Extract<Built, { render: 'echarts' }>;

const col = (key: string, label: string, kind: EvidenceColumn['kind'], unit?: string): EvidenceColumn => ({ key, label, kind, unit });
const spec = (kind: WidgetKind, over: Partial<WidgetSpec> = {}): WidgetSpec => ({ kind, title: 'Title', sourceCallId: 'call_1', ...over });
const build = (s: WidgetSpec, rows: WidgetRow[], columns: EvidenceColumn[] = [], over: Partial<BuildInput> = {}) => buildWidget({ spec: s, rows, columns, ...over });

function chart(b: Built): EChartsBuilt {
  expect(b.render).toBe('echarts');
  return b as EChartsBuilt;
}
const opt = (b: Built) => chart(b).option as Obj;
const series = (b: Built) => opt(b)['series'] as Obj[];
const axis = (b: Built, name: 'xAxis' | 'yAxis', i = 0) => {
  const a = opt(b)[name];
  return (Array.isArray(a) ? a[i] : a) as Obj;
};
/** Runs a label or tooltip formatter the way ECharts would. */
const call = (fn: unknown, ...args: unknown[]) => (fn as (...a: unknown[]) => string)(...args);
const tooltipHtml = (b: Built, param: unknown) => call((opt(b)['tooltip'] as Obj)['formatter'], param);

const HOTELS: WidgetRow[] = [
  { hotel: 'Arbor New York Midtown', revpar: 261.4, revpar_ly: 289.2 },
  { hotel: 'Kestrel London Mayfair', revpar: 252.8, revpar_ly: 236.1 },
  { hotel: 'Tessera Berlin Mitte', revpar: 97.6, revpar_ly: 95.2 },
];
const HOTEL_COLS = [col('hotel', 'Hotel', 'hotel'), col('revpar', 'RevPAR', 'currency', 'EUR'), col('revpar_ly', 'Last year', 'currency', 'EUR')];

const DAILY: WidgetRow[] = [
  { stay_date: '2026-12-14', rooms_otb: 80, rooms_otb_ly: 100 },
  { stay_date: '2026-12-15', rooms_otb: 96, rooms_otb_ly: 104 },
  { stay_date: '2026-12-16', rooms_otb: 121, rooms_otb_ly: 110 },
];
const DAILY_COLS = [col('stay_date', 'Stay date', 'date'), col('rooms_otb', 'On the books', 'count', 'rooms'), col('rooms_otb_ly', 'Same time last year', 'count', 'rooms')];

describe('every widget kind', () => {
  const specimens = SPECIMENS.flatMap((g) => g.items);

  it('has a builder and a sample in the catalogue', () => {
    for (const kind of WIDGET_KINDS) {
      expect(BUILDERS[kind], kind).toBeTypeOf('function');
      expect(specimens.some((s) => s.spec.kind === kind), `sample for ${kind}`).toBe(true);
    }
  });

  it.each(specimens.map((s) => [s.id, s] as const))('%s builds in both themes, at desktop and phone width, with a table and a text alternative', (_id, sp) => {
    for (const tokens of [DARK_TOKENS, LIGHT_TOKENS]) {
      for (const width of [1100, 640, 320]) {
        for (const compact of [false, true]) {
          const b = buildWidget({ spec: sp.spec, rows: sp.rows, columns: sp.columns, tokens, width, compact });
          expect(b.summary.startsWith(sp.spec.title.replace(/\.$/, ''))).toBe(true);
          expect(b.table.columns.length).toBeGreaterThan(0);
          expect(b.table.rows.length).toBe(sp.rows.length);
          if (b.render === 'echarts') expect(JSON.stringify(b.option)).not.toContain('NaN');
        }
      }
    }
  });

  it.each(WIDGET_KINDS.map((k) => [k] as const))('%s says so instead of drawing when there are no rows', (kind) => {
    const b = build(spec(kind, { x: 'a', y: ['b'], group: 'c' }), []);
    expect(b.render).toBe('empty');
    expect(b.render === 'empty' && b.message.length).toBeGreaterThan(5);
  });

  it('shows an unknown kind as a table with a note, never a blank', () => {
    const b = build(spec('hexbin' as WidgetKind, { x: 'hotel', y: ['revpar'] }), HOTELS, HOTEL_COLS);
    expect(b.render).toBe('table');
    expect(b.note).toContain('hexbin');
    expect(b.table.rows).toHaveLength(3);
  });

  it('keeps one body height per kind and density, so the skeleton matches the chart', () => {
    for (const kind of WIDGET_KINDS) {
      expect(bodyHeight({ kind }, false, 900)).toBe(context({ spec: spec(kind), rows: HOTELS, width: 900 }).height);
      expect(bodyHeight({ kind }, true, 900)).toBeLessThanOrEqual(bodyHeight({ kind }, false, 900));
    }
    // KPI tiles wrap two by two once each would get less than 132 px: four tiles on a phone are two rows.
    const oneRow = bodyHeight({ kind: 'kpi_row' }, false, 900);
    expect(bodyHeight({ kind: 'kpi_row', y: ['a', 'b', 'c', 'd'] }, false, 360)).toBe(2 * oneRow + 8);
    expect(bodyHeight({ kind: 'kpi_row', y: ['a', 'b', 'c', 'd'] }, false, 540)).toBe(oneRow);
    expect(bodyHeight({ kind: 'kpi_row', y: ['a', 'b'] }, false, 240)).toBe(oneRow);
    expect(bodyHeight({ kind: 'kpi_row', y: ['a', 'b', 'c', 'd', 'e'] }, false, 360)).toBe(3 * oneRow + 16);
    expect(kpiColumns(4, 520)).toBe(2);
    expect(kpiColumns(4, 528)).toBe(4);
  });

  it('turns motion off under prefers-reduced-motion', () => {
    expect(opt(build(spec('line', { x: 'stay_date', y: ['rooms_otb'] }), DAILY, DAILY_COLS, { motion: false }))['animation']).toBe(false);
    expect(opt(build(spec('line', { x: 'stay_date', y: ['rooms_otb'] }), DAILY, DAILY_COLS))['animation']).toBe(true);
  });
});

describe('line and area', () => {
  const s = spec('line', { x: 'stay_date', y: ['rooms_otb'], compare: 'rooms_otb_ly' });

  it('labels the x axis with dates and the y axis by the column kind', () => {
    const b = build(s, DAILY, DAILY_COLS);
    expect(axis(b, 'xAxis')['data']).toEqual(['14 Dec', '15 Dec', '16 Dec']);
    expect(call((axis(b, 'yAxis')['axisLabel'] as Obj)['formatter'], 1500)).toBe('1.5k');
  });

  it('draws this year solid blue and the comparison dashed purple', () => {
    const [main, cmp] = series(build(s, DAILY, DAILY_COLS));
    expect(main['name']).toBe('On the books');
    expect((main['lineStyle'] as Obj)['color']).toBe(DARK_TOKENS.series);
    expect((main['lineStyle'] as Obj)['type']).toBe('solid');
    expect(cmp['name']).toBe('Same time last year');
    expect((cmp['lineStyle'] as Obj)['color']).toBe(DARK_TOKENS.cmp);
    expect((cmp['lineStyle'] as Obj)['type']).toEqual([4, 4]);
  });

  it('names the series on the line ends when there is room, and falls back to a legend on a phone', () => {
    const wide = build(s, DAILY, DAILY_COLS, { width: 640 });
    expect(wide.legend).toEqual([]);
    expect(call((series(wide)[0]['endLabel'] as Obj)['formatter'])).toBe('On the books');
    const phone = build(s, DAILY, DAILY_COLS, { width: 340 });
    expect(phone.legend.map((l) => [l.label, l.mark])).toEqual([
      ['On the books', 'line'],
      ['Same time last year', 'dashed'],
    ]);
    expect(series(phone)[0]['endLabel']).toBeUndefined();
  });

  it('labels a single series with its latest value, unit included', () => {
    const b = build(spec('area', { x: 'stay_date', y: ['rooms_otb'] }), DAILY, DAILY_COLS);
    expect(call((series(b)[0]['endLabel'] as Obj)['formatter'])).toBe('121 rooms');
  });

  it('starts an area at zero and lets a line zoom to its range', () => {
    expect(axis(build(spec('area', { x: 'stay_date', y: ['rooms_otb'] }), DAILY, DAILY_COLS), 'yAxis')['scale']).toBe(false);
    expect(axis(build(spec('line', { x: 'stay_date', y: ['rooms_otb'] }), DAILY, DAILY_COLS), 'yAxis')['scale']).toBe(true);
    expect(series(build(spec('area', { x: 'stay_date', y: ['rooms_otb'] }), DAILY, DAILY_COLS))[0]['areaStyle']).toBeTruthy();
  });

  it('puts the full date, both values and the change in the tooltip', () => {
    const html = tooltipHtml(build(s, DAILY, DAILY_COLS), [{ dataIndex: 0 }]);
    expect(html).toContain('Mon 14 Dec 2026');
    expect(html).toContain('80 rooms');
    expect(html).toContain('100 rooms');
    expect(html).toContain('▼ 20.0% vs same time last year');
  });

  it('escapes row text in tooltips', () => {
    const rows = [
      { segment: '<b>Corp</b>', month: '2026-11', nights: 10 },
      { segment: 'Leisure', month: '2026-11', nights: 12 },
    ];
    const html = tooltipHtml(build(spec('line', { x: 'month', y: ['nights'], group: 'segment' }), rows), [{ dataIndex: 0 }]);
    expect(html).toContain('&lt;b&gt;Corp&lt;/b&gt;');
    expect(html).not.toContain('<b>Corp');
  });

  it('splits long rows into one series per group', () => {
    const rows = ['2026-10', '2026-11'].flatMap((month, m) => ['Corporate', 'Leisure', 'Other'].map((segment, i) => ({ month, segment, nights: (m + 1) * (i + 1) * 10 })));
    const b = build(spec('line', { x: 'month', y: ['nights'], group: 'segment' }), rows);
    expect(series(b).map((x) => x['name'])).toEqual(['Corporate', 'Leisure', 'Other']);
    expect(series(b)[1]['data']).toEqual([20, 40]);
    // "Other" is always grey, whatever its position.
    expect((series(b)[2]['lineStyle'] as Obj)['color']).toBe(DARK_TOKENS.grey);
    expect(axis(b, 'xAxis')['data']).toEqual(['Oct', 'Nov']);
  });

  it('gives the keyboard one stop per point, with what to announce', () => {
    const b = chart(build(s, DAILY, DAILY_COLS));
    expect(b.points).toHaveLength(3);
    expect(b.points[2]).toEqual({ seriesIndex: 0, dataIndex: 2, text: 'Wed 16 Dec 2026: On the books 121 rooms; Same time last year 110 rooms' });
  });
});

describe('bars', () => {
  it('lays bars down when the categories are names and keeps the row order', () => {
    const b = build(spec('bar', { x: 'hotel', y: ['revpar'] }), HOTELS, HOTEL_COLS);
    expect(axis(b, 'yAxis')['type']).toBe('category');
    expect(axis(b, 'yAxis')['inverse']).toBe(true);
    expect(axis(b, 'yAxis')['data']).toEqual(['Arbor New York Midtown', 'Kestrel London Mayfair', 'Tessera Berlin Mitte']);
    expect(call((series(b)[0]['label'] as Obj)['formatter'], { dataIndex: 2 })).toBe('€98');
    expect(b.legend).toEqual([]);
  });

  it('stands bars up for dates', () => {
    const b = build(spec('bar', { x: 'stay_date', y: ['rooms_otb'] }), DAILY, DAILY_COLS);
    expect(axis(b, 'xAxis')['type']).toBe('category');
    expect(axis(b, 'xAxis')['data']).toEqual(['14 Dec', '15 Dec', '16 Dec']);
  });

  it('draws the comparison as a purple tick and moves the values to their own column', () => {
    const b = build(spec('bar', { x: 'hotel', y: ['revpar'], compare: 'revpar_ly' }), HOTELS, HOTEL_COLS);
    expect(series(b).map((x) => x['type'])).toEqual(['bar', 'scatter']);
    expect((series(b)[1]['itemStyle'] as Obj)['color']).toBe(DARK_TOKENS.cmp);
    expect(series(b)[0]['label']).toBeUndefined();
    expect(call((axis(b, 'yAxis', 1)['axisLabel'] as Obj)['formatter'], '', 0)).toBe('€261');
    expect(b.legend.map((l) => [l.label, l.mark])).toEqual([
      ['RevPAR', 'solid'],
      ['Last year', 'tick'],
    ]);
  });

  it('caps bar thickness at 20 px and rounds only the data end', () => {
    const b = build(spec('bar', { x: 'hotel', y: ['revpar'] }), HOTELS, HOTEL_COLS);
    expect(series(b)[0]['barMaxWidth']).toBe(20);
    expect((series(b)[0]['itemStyle'] as Obj)['borderRadius']).toEqual([0, 4, 4, 0]);
  });

  it('shows what fits and says where the rest is', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ hotel: `Hotel ${i + 1}`, revpar: 100 + i }));
    const b = build(spec('bar', { x: 'hotel', y: ['revpar'] }), rows, HOTEL_COLS, { compact: true });
    expect((axis(b, 'yAxis')['data'] as string[]).length).toBeLessThan(40);
    expect(b.note).toMatch(/^Showing the first \d+ of 40 rows/);
    expect(b.table.rows).toHaveLength(40);
  });

  it('stacks the parts with a surface-coloured gap and labels each stack with its total', () => {
    const rows = ['2026-10', '2026-11'].flatMap((month, m) => ['Corporate', 'Leisure'].map((segment, i) => ({ month, segment, room_nights: 1000 * (m + 1) + 500 * i })));
    const b = build(spec('stacked_bar', { x: 'month', y: ['room_nights'], group: 'segment' }), rows, [col('month', 'Month', 'month'), col('segment', 'Segment', 'text'), col('room_nights', 'Room nights', 'count', 'nights')]);
    expect(series(b).every((x) => x['stack'] === 'total')).toBe(true);
    expect((series(b)[0]['itemStyle'] as Obj)['borderColor']).toBe(DARK_TOKENS.surface);
    expect(series(b)[0]['label']).toBeUndefined();
    expect(call((series(b)[1]['label'] as Obj)['formatter'], { dataIndex: 1 })).toBe('4,500');
    expect(b.legend.map((l) => l.label)).toEqual(['Corporate', 'Leisure']);
    expect(tooltipHtml(b, [{ dataIndex: 0 }])).toContain('Total 2,500 nights');
  });

  it('groups the comparison next to the current value, in its own colour', () => {
    const rows = [
      { month: '2026-10', revenue: 17_640_000, budget: 18_100_000 },
      { month: '2026-11', revenue: 15_210_000, budget: 16_800_000 },
    ];
    const b = build(spec('grouped_bar', { x: 'month', y: ['revenue'], compare: 'budget' }), rows, [col('month', 'Month', 'month'), col('revenue', 'Revenue', 'currency'), col('budget', 'Budget', 'currency')]);
    expect(series(b).map((x) => [x['name'], (x['itemStyle'] as Obj)['color'], x['stack']])).toEqual([
      ['Revenue', DARK_TOKENS.series, undefined],
      ['Budget', DARK_TOKENS.cmp, undefined],
    ]);
    expect(call((axis(b, 'yAxis')['axisLabel'] as Obj)['formatter'], 15_000_000)).toBe('€15M');
    expect(opt(b)['yAxis']).not.toBeInstanceOf(Array); // one value axis, never two
  });
});

describe('waterfall', () => {
  const rows: WidgetRow[] = [
    { step: 'Budget GOP', amount: 1_412_000 },
    { step: 'Rooms revenue', amount: -38_000 },
    { step: 'F&B revenue', amount: 21_000 },
    { step: 'Payroll', amount: -147_000 },
    { step: 'Actual GOP', amount: 1_248_000 },
  ];
  const cols = [col('step', 'Step', 'text'), col('amount', 'GOP', 'currency', 'EUR')];
  const s = spec('waterfall', { x: 'step', y: ['amount'] });

  it('floats each step between the running totals and closes on the last total', () => {
    const steps = waterfallSteps(context({ spec: s, rows, columns: cols }));
    expect(steps.map((x) => x.type)).toEqual(['total', 'down', 'up', 'down', 'total']);
    expect(steps[1]).toMatchObject({ start: 1_412_000, end: 1_374_000 });
    expect(steps[3]).toMatchObject({ start: 1_395_000, end: 1_248_000 });
    expect(series(build(s, rows, cols))[0]['data']).toEqual([
      [0, 0, 1_412_000],
      [1, 1_412_000, 1_374_000],
      [2, 1_374_000, 1_395_000],
      [3, 1_395_000, 1_248_000],
      [4, 0, 1_248_000],
    ]);
  });

  it('honours a kind column over the guess', () => {
    const flagged = [
      { step: 'Open', amount: 100, kind: 'total' },
      { step: 'A', amount: 20, kind: 'step' },
      { step: 'Subtotal', amount: 120, kind: 'total' },
      { step: 'B', amount: -50, kind: 'step' },
    ];
    expect(waterfallSteps(context({ spec: s, rows: flagged })).map((x) => [x.type, x.start, x.end])).toEqual([
      ['total', 0, 100],
      ['up', 100, 120],
      ['total', 0, 120],
      ['down', 120, 70],
    ]);
  });

  it('treats the last row as a step when it does not close the bridge', () => {
    const open = [
      { step: 'Open', amount: 100 },
      { step: 'A', amount: 20 },
      { step: 'B', amount: 5 },
    ];
    expect(waterfallSteps(context({ spec: s, rows: open })).map((x) => x.type)).toEqual(['total', 'up', 'up']);
  });

  it('breaks the axis when the steps are small next to the totals, and says so', () => {
    const b = build(s, rows, cols);
    const brk = waterfallBreak(waterfallSteps(context({ spec: s, rows, columns: cols })));
    expect(brk).not.toBeNull();
    expect(brk!.end).toBeLessThan(1_248_000);
    expect(axis(b, 'yAxis')['breaks']).toHaveLength(1);
    expect(b.note).toMatch(/^The axis is broken between €\S+ and €\S+ so the steps are readable\.$/);
    // A bridge whose steps are large needs no break.
    expect(waterfallBreak(waterfallSteps(context({ spec: s, rows: [{ step: 'Open', amount: 100 }, { step: 'A', amount: -70 }] })))).toBeNull();
  });

  it('labels direction with arrows in the legend and for screen readers', () => {
    const b = chart(build(s, rows, cols));
    expect(b.legend.map((l) => l.label)).toEqual(['Total', '▲ Adds', '▼ Takes away']);
    expect(b.points[3].text).toBe('Payroll: takes away €147,000, running total €1,248,000');
    expect(b.summary).toContain('Payroll down €147k');
  });
});

describe('bullet', () => {
  const rows = [
    { hotel: 'Kestrel London Mayfair', revenue: 1_184_000, budget: 1_120_000 },
    { hotel: 'Arbor Lisbon Chiado', revenue: 517_000, budget: 602_000 },
  ];
  const cols = [col('hotel', 'Hotel', 'hotel'), col('revenue', 'Revenue', 'currency'), col('budget', 'Budget', 'currency')];

  it('draws actual as a bar, target as a tick, and the value with its change', () => {
    const b = build(spec('bullet', { x: 'hotel', y: ['revenue'], compare: 'budget' }), rows, cols);
    expect(series(b).map((x) => x['type'])).toEqual(['bar', 'scatter']);
    expect(series(b)[1]['data']).toEqual([1_120_000, 602_000]);
    const fmt = (axis(b, 'yAxis', 1)['axisLabel'] as Obj)['formatter'];
    expect(call(fmt, '', 0)).toBe('{v|€1.18M}{good|▲ 5.7%}');
    expect(call(fmt, '', 1)).toBe('{v|€517k}{bad|▼ 14.1%}');
    expect(chart(b).points[1].text).toBe('Arbor Lisbon Chiado: €517,000, budget €602,000, down 14.1%');
  });

  it('works without a target', () => {
    const b = build(spec('bullet', { x: 'hotel', y: ['revenue'] }), rows, cols);
    expect(series(b)).toHaveLength(1);
    expect(b.legend).toEqual([]);
  });
});

describe('pie and donut', () => {
  const cols = [col('channel', 'Channel', 'text'), col('revenue', 'Revenue', 'currency')];
  const parts = (n: number) => Array.from({ length: n }, (_, i) => ({ channel: i === n - 1 ? 'Other' : `Channel ${i + 1}`, revenue: (n - i) * 100_000 }));

  it('names each slice with its share and puts the total in the hole', () => {
    const b = build(spec('donut', { group: 'channel', y: ['revenue'] }), parts(4), cols);
    expect(b.kind).toBe('donut');
    const s = series(b)[0];
    expect(s['type']).toBe('pie');
    expect((s['radius'] as string[])[0]).not.toBe(0);
    expect(call((s['label'] as Obj)['formatter'], { dataIndex: 0 })).toBe('{n|Channel 1}\n{s|40.0%}');
    expect(JSON.stringify(opt(b)['graphic'])).toContain('€1M');
    // Parts take the categorical hues in order; "Other" is grey.
    const colors = (s['data'] as Obj[]).map((d) => (d['itemStyle'] as Obj)['color']);
    expect(colors).toEqual([DARK_TOKENS.cat[0], DARK_TOKENS.cat[1], DARK_TOKENS.cat[2], DARK_TOKENS.grey]);
  });

  it('separates slices with a gap in the surface colour', () => {
    const s = series(build(spec('pie', { group: 'channel', y: ['revenue'] }), parts(3), cols))[0];
    expect(s['itemStyle']).toMatchObject({ borderColor: DARK_TOKENS.surface, borderWidth: 2 });
    expect((s['radius'] as unknown[])[0]).toBe(0);
  });

  it('moves the names and shares to a legend on a phone', () => {
    const b = build(spec('donut', { group: 'channel', y: ['revenue'] }), parts(3), cols, { width: 340 });
    expect((series(b)[0]['label'] as Obj)['show']).toBe(false);
    expect(b.legend.map((l) => l.label)).toEqual(['Channel 1 50.0%', 'Channel 2 33.3%', 'Other 16.7%']);
  });

  it.each([
    [8, '8 parts are too many for a donut (it reads for 2 to 7), so this is shown as bars.'],
    [1, 'A donut needs at least 2 parts, so this is shown as bars.'],
  ])('falls back to bars for %i parts, with a note', (n, note) => {
    const b = build(spec('donut', { group: 'channel', y: ['revenue'] }), parts(n), cols);
    expect(b.kind).toBe('bar');
    expect(series(b)[0]['type']).toBe('bar');
    expect(b.note).toBe(note);
  });

  it('accepts 2 and 7 parts, and refuses negative ones', () => {
    expect(build(spec('pie', { group: 'channel', y: ['revenue'] }), parts(2), cols).kind).toBe('pie');
    expect(build(spec('pie', { group: 'channel', y: ['revenue'] }), parts(7), cols).kind).toBe('pie');
    const negative = build(spec('pie', { group: 'channel', y: ['revenue'] }), [...parts(3), { channel: 'Refunds', revenue: -5 }], cols);
    expect(negative.kind).toBe('bar');
    expect(negative.note).toBe("A pie can't show negative parts, so this is shown as bars.");
  });
});

describe('funnel, treemap and sankey', () => {
  it('labels each funnel stage with its value and its share of the first stage', () => {
    const rows = [
      { stage: 'Searches', sessions: 48_200 },
      { stage: 'Room viewed', sessions: 21_700 },
      { stage: 'Booked', sessions: 1_010 },
    ];
    const b = chart(build(spec('funnel', { x: 'stage', y: ['sessions'] }), rows, [col('stage', 'Stage', 'text'), col('sessions', 'Sessions', 'count')]));
    expect(series(b)[0]['sort']).toBe('none');
    expect(call((series(b)[1]['label'] as Obj)['formatter'], { dataIndex: 2 })).toBe('{n|1,010}{v|2.1%}');
    expect(b.points[1].text).toBe('Room viewed: 21,700, 45.0% of searches, 45.0% of the previous stage');
    expect(tooltipHtml(b, { dataIndex: 2 })).toContain('4.7%');
  });

  it('nests treemap leaves under their group and keeps flat data flat', () => {
    const rows = [
      { hotel: 'New York', region: 'North America', revenue: 300 },
      { hotel: 'Chicago', region: 'North America', revenue: 100 },
      { hotel: 'London', region: 'Europe', revenue: 200 },
    ];
    const nested = series(build(spec('treemap', { x: 'hotel', group: 'region', y: ['revenue'] }), rows))[0]['data'] as Obj[];
    expect(nested.map((n) => [n['name'], (n['children'] as Obj[]).map((c) => c['name'])])).toEqual([
      ['North America', ['New York', 'Chicago']],
      ['Europe', ['London']],
    ]);
    const flat = series(build(spec('treemap', { x: 'hotel', y: ['revenue'] }), rows))[0]['data'] as Obj[];
    expect(flat.map((n) => n['name'])).toEqual(['New York', 'Chicago', 'London']);
    expect(call((series(build(spec('treemap', { x: 'hotel', y: ['revenue'] }), rows))[0]['label'] as Obj)['formatter'], { name: 'London', value: 200 })).toBe('London\n€200');
  });

  it('builds sankey nodes and links from source, target and value', () => {
    const rows = [
      { channel: 'OTA', lands_in: 'Net revenue', revenue: 1_648_000 },
      { channel: 'OTA', lands_in: 'Commission', revenue: 412_000 },
      { channel: 'Direct web', lands_in: 'Net revenue', revenue: 1_180_000 },
    ];
    const b = build(spec('sankey', { x: 'channel', group: 'lands_in', y: ['revenue'] }), rows, [col('channel', 'Channel', 'text'), col('lands_in', 'Lands in', 'text'), col('revenue', 'Revenue', 'currency')]);
    const s = series(b)[0];
    expect((s['data'] as Obj[]).map((n) => n['name'])).toEqual(['OTA', 'Net revenue', 'Commission', 'Direct web']);
    expect(s['links']).toEqual([
      { source: 'OTA', target: 'Net revenue', value: 1_648_000 },
      { source: 'OTA', target: 'Commission', value: 412_000 },
      { source: 'Direct web', target: 'Net revenue', value: 1_180_000 },
    ]);
    expect(call((s['label'] as Obj)['formatter'], { name: 'Net revenue' })).toBe('{n|Net revenue}  {v|€2.83M}');
    expect(tooltipHtml(b, { dataType: 'edge', name: '', data: rows.map((r) => ({ source: r.channel, target: r.lands_in, value: r.revenue }))[1] })).toContain('20.0%');
  });

  it('shows looping flows as a table instead of crashing the chart', () => {
    const rows = [
      { from: 'A', to: 'B', v: 1 },
      { from: 'B', to: 'A', v: 1 },
    ];
    expect(hasCycle(rows.map((r) => ({ source: r.from, target: r.to, value: r.v })))).toBe(true);
    const b = build(spec('sankey', { x: 'from', group: 'to', y: ['v'] }), rows);
    expect(b.render).toBe('table');
    expect(b.note).toBe('These flows loop back on themselves, so they are shown as a table.');
  });
});

describe('heatmap and calendar', () => {
  const rows = ['New York', 'Lisbon'].flatMap((hotel, h) => ['Mon', 'Sat'].map((weekday, d) => ({ hotel, weekday, occupancy_pct: h === d ? 60 : 92 })));
  const cols = [col('hotel', 'Hotel', 'hotel'), col('weekday', 'Weekday', 'text'), col('occupancy_pct', 'Occupancy', 'percent')];

  it('lays rows by group and columns by x, coloured along one hue', () => {
    const b = build(spec('heatmap', { x: 'weekday', group: 'hotel', y: ['occupancy_pct'] }), rows, cols);
    expect(axis(b, 'xAxis')['data']).toEqual(['Mon', 'Sat']);
    expect(axis(b, 'yAxis')['data']).toEqual(['New York', 'Lisbon']);
    expect((series(b)[0]['data'] as Obj[]).map((d) => d['value'])).toEqual([
      [0, 0, 60],
      [1, 0, 92],
      [0, 1, 92],
      [1, 1, 60],
    ]);
    const vm = opt(b)['visualMap'] as Obj;
    expect(vm).toMatchObject({ show: false, min: 60, max: 92, dimension: 2 });
    expect(((vm['inRange'] as Obj)['color'] as string[])[1]).toBe(DARK_TOKENS.series);
    expect(b.ramp).toMatchObject({ min: '60.0%', max: '92.0%', label: 'Occupancy' });
  });

  it('prints each cell value in an ink that reads on its fill', () => {
    for (const tokens of [DARK_TOKENS, LIGHT_TOKENS]) {
      const b = build(spec('heatmap', { x: 'weekday', group: 'hotel', y: ['occupancy_pct'] }), rows, cols, { tokens });
      const inks = (series(b)[0]['data'] as Obj[]).map((d) => (d['label'] as Obj)['color'] as string);
      const fills = (opt(b)['visualMap'] as Obj)['inRange'] as { color: string[] };
      expect(contrast(inks[0], fills.color[0])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(inks[1], fills.color[1])).toBeGreaterThanOrEqual(4.5);
    }
    expect(call((series(build(spec('heatmap', { x: 'weekday', group: 'hotel', y: ['occupancy_pct'] }), rows, cols))[0]['label'] as Obj)['formatter'], { dataIndex: 0 })).toBe('60%');
  });

  it('fits a Monday-first calendar into the space with square cells', () => {
    // 1 Dec 2026 is a Tuesday: December spans five Monday-first weeks.
    const lay = calendarLayout(Date.UTC(2026, 11, 1), Date.UTC(2026, 11, 31), 600, 206);
    expect(lay.range).toEqual(['2026-12-01', '2026-12-31']);
    expect(lay.weeks).toBe(5);
    expect(lay.cell).toBe(25);
    expect(calendarLayout(Date.UTC(2026, 10, 23), Date.UTC(2027, 2, 28), 320, 206).cell).toBe(15);
  });

  it('draws nights on a calendar with the day of the month and a full-date tooltip', () => {
    const nights = Array.from({ length: 31 }, (_, i) => ({ stay_date: `2026-12-${String(i + 1).padStart(2, '0')}`, occupancy_pct: 50 + i }));
    const b = chart(build(spec('calendar_heatmap', { x: 'stay_date', y: ['occupancy_pct'] }), nights, [col('stay_date', 'Night', 'date'), col('occupancy_pct', 'Occupancy', 'percent')]));
    const cal = opt(b)['calendar'] as Obj;
    expect(cal['range']).toEqual(['2026-12-01', '2026-12-31']);
    expect((cal['dayLabel'] as Obj)['firstDay']).toBe(1);
    expect(series(b)[0]['coordinateSystem']).toBe('calendar');
    expect(((series(b)[0]['data'] as Obj[])[15]['value'] as unknown[])[0]).toBe('2026-12-16');
    expect(call((series(b)[0]['label'] as Obj)['formatter'], { dataIndex: 15 })).toBe('16');
    expect(tooltipHtml(b, { dataIndex: 15 })).toContain('Wed 16 Dec 2026');
    expect(b.points[15].text).toBe('Wed 16 Dec 2026: 65.0%');
  });
});

describe('scatter, radar and gauge', () => {
  const idx = [
    { hotel: 'Dubai Business Bay', ari: 78, mpi: 118 },
    { hotel: 'London Mayfair', ari: 109, mpi: 106 },
    { hotel: 'Barcelona Mar', ari: 95, mpi: 89 },
  ];
  const idxCols = [col('hotel', 'Hotel', 'hotel'), col('ari', 'ARI (rate index)', 'number', 'index'), col('mpi', 'MPI (share index)', 'number', 'index')];

  it('draws index quadrants at 100 and says what each corner means', () => {
    const b = build(spec('scatter', { x: 'ari', y: ['mpi'], group: 'hotel' }), idx, idxCols, { width: 640 });
    const s = series(b)[0];
    const lines = (s['markLine'] as Obj)['data'] as Obj[];
    expect(lines.map((l) => l['xAxis'] ?? l['yAxis'])).toEqual([100, 100]);
    expect(JSON.stringify(s['markArea'])).toContain('Lower rate, more than fair share');
    expect(axis(b, 'xAxis')['name']).toBe('ARI (rate index)');
    expect(call((s['label'] as Obj)['formatter'], { dataIndex: 0 })).toBe('Dubai Business Bay');
    expect(b.summary).toContain('1 of 3 are at or above 100 on both.');
  });

  it('ends its axes on round numbers', () => {
    const b = build(spec('scatter', { x: 'ari', y: ['mpi'], group: 'hotel' }), idx, idxCols, { width: 640 });
    expect([axis(b, 'xAxis')['min'], axis(b, 'xAxis')['max'], axis(b, 'xAxis')['interval']]).toEqual([70, 120, 10]);
    expect(niceStep(8.4)).toBe(10);
    expect(niceStep(0.3)).toBe(0.5);
    expect(niceCeil(123)).toBe(150);
  });

  it('uses the medians as reference for anything that is not an index', () => {
    const rows = [
      { hotel: 'A', adr: 100, occupancy_pct: 60 },
      { hotel: 'B', adr: 200, occupancy_pct: 80 },
      { hotel: 'C', adr: 300, occupancy_pct: 70 },
    ];
    const s = series(build(spec('scatter', { x: 'adr', y: ['occupancy_pct'], group: 'hotel' }), rows))[0];
    const lines = (s['markLine'] as Obj)['data'] as Obj[];
    expect(lines[0]['xAxis']).toBe(200);
    expect(lines[1]['yAxis']).toBe(70);
    expect((lines[0]['label'] as Obj)['formatter']).toBe('median €200');
    expect(s['markArea']).toBeUndefined();
  });

  it('puts every radar spoke on one scale and says when it does not start at zero', () => {
    const rows = [
      { measure: 'Occupancy', hotel_index: 92, compset_index: 100 },
      { measure: 'Rate', hotel_index: 108, compset_index: 100 },
      { measure: 'RevPAR', hotel_index: 99, compset_index: 100 },
      { measure: 'Direct share', hotel_index: 121, compset_index: 100 },
    ];
    const b = build(spec('radar', { x: 'measure', y: ['hotel_index'], compare: 'compset_index' }), rows, [col('measure', 'Measure', 'text'), col('hotel_index', 'Lisbon Chiado', 'number', 'index'), col('compset_index', 'Comp set', 'number', 'index')]);
    const indicators = (opt(b)['radar'] as Obj)['indicator'] as Obj[];
    expect(indicators.map((i) => i['name'])).toEqual(['Occupancy', 'Rate', 'RevPAR', 'Direct share']);
    expect(new Set(indicators.map((i) => `${i['min']}–${i['max']}`))).toEqual(new Set(['70–130']));
    expect(b.note).toBe('The scale runs from 70 at the centre to 130 at the edge.');
    expect(b.legend.map((l) => [l.label, l.mark])).toEqual([
      ['Lisbon Chiado', 'line'],
      ['Comp set', 'dashed'],
    ]);
    expect((series(b)[1]['lineStyle'] as Obj)['color']).toBe(DARK_TOKENS.cmp);
  });

  it('starts a radar at zero when the values spread out, and needs three spokes', () => {
    const rows = [
      { m: 'A', v: 10 },
      { m: 'B', v: 80 },
      { m: 'C', v: 45 },
    ];
    const b = build(spec('radar', { x: 'm', y: ['v'] }), rows);
    expect(((opt(b)['radar'] as Obj)['indicator'] as Obj[])[0]['min']).toBe(0);
    expect(b.note).toBeUndefined();
    expect(build(spec('radar', { x: 'm', y: ['v'] }), rows.slice(0, 2)).render).toBe('empty');
  });

  it('runs a percent gauge from 0 to 100 with the target as a tick', () => {
    const b = build(spec('gauge', { y: ['occupancy_pct'], compare: 'budget_occupancy_pct' }), [{ occupancy_pct: 71.6, budget_occupancy_pct: 80 }], [col('occupancy_pct', 'Occupancy', 'percent'), col('budget_occupancy_pct', 'Budget', 'percent')]);
    const [value, target] = series(b);
    expect([value['min'], value['max']]).toEqual([0, 100]);
    expect(call((value['detail'] as Obj)['formatter'], 71.6)).toBe('71.6%');
    expect((target['data'] as Obj[])[0]['value']).toBe(80);
    expect(((target['pointer'] as Obj)['itemStyle'] as Obj)['color']).toBe(DARK_TOKENS.cmp);
    expect(b.legend.map((l) => l.label)).toEqual(['Occupancy', 'Budget 80.0%']);
    expect(b.summary).toContain('Occupancy is 71.6% on a scale of 0 to 100.0%. Budget 80.0%, down 8.4 pts.');
  });

  it('rounds the top of a money gauge above the value and the target', () => {
    const b = build(spec('gauge', { y: ['revenue'], compare: 'budget' }), [{ revenue: 517_000, budget: 602_000 }], [col('revenue', 'Revenue', 'currency'), col('budget', 'Budget', 'currency')]);
    expect(series(b)[0]['max']).toBe(800_000);
    expect(call((series(b)[0]['detail'] as Obj)['formatter'], 517_000)).toBe('€517k');
  });
});

describe('kpi, kpi_row, sparkline_list and table', () => {
  const daily = [
    { stay_date: '2026-11-17', revpar: 140, revpar_ly: 138, cancellations: 110, cancellations_ly: 100 },
    { stay_date: '2026-11-18', revpar: 152, revpar_ly: 139, cancellations: 104, cancellations_ly: 101 },
    { stay_date: '2026-11-19', revpar: 148, revpar_ly: 136.7, cancellations: 100, cancellations_ly: 102 },
  ];
  const cols = [col('stay_date', 'Stay date', 'date'), col('revpar', 'RevPAR', 'currency'), col('revpar_ly', 'Last year', 'currency'), col('cancellations', 'Cancellations', 'count'), col('cancellations_ly', 'Last year', 'count')];

  it('reads a KPI from the latest row, with the change against the compare column and a trend', () => {
    const b = build(spec('kpi', { x: 'stay_date', y: ['revpar'], compare: 'revpar_ly' }), daily, cols);
    expect(b.render).toBe('kpi');
    if (b.render !== 'kpi') return;
    expect(b.kpi).toMatchObject({ label: 'RevPAR', value: '€148', versus: 'vs last year' });
    expect(b.kpi.delta).toMatchObject({ text: '▲ 8.3%', tone: 'good' });
    expect(b.kpi.spark?.line.startsWith('M0.0,')).toBe(true);
    expect(b.summary).toContain('RevPAR €148, up 8.3% vs last year.');
  });

  it('reads a KPI without dates from the first row, and without a comparison shows none', () => {
    const b = build(spec('kpi', { y: ['revenue'] }), [{ revenue: 1_340_000 }, { revenue: 5 }], [col('revenue', 'Revenue', 'currency')]);
    expect(b.render === 'kpi' && b.kpi).toMatchObject({ value: '€1.34M', delta: null, spark: null, versus: '' });
  });

  it('makes one tile per y column, each with its own _ly column, and treats fewer cancellations as good', () => {
    const b = build(spec('kpi_row', { x: 'stay_date', y: ['revpar', 'cancellations'] }), daily, cols);
    expect(b.render).toBe('kpi_row');
    if (b.render !== 'kpi_row') return;
    expect(b.tiles.map((t) => [t.label, t.value, t.delta?.text, t.delta?.tone])).toEqual([
      ['RevPAR', '€148', '▲ 8.3%', 'good'],
      ['Cancellations', '100', '▼ 2.0%', 'good'],
    ]);
    expect(b.tiles.every((t) => t.spark !== null)).toBe(true);
  });

  it('makes one tile per row when x is a label column', () => {
    const rows = [
      { metric: 'Occupancy', value: 78.1, ly: 75 },
      { metric: 'Pickup', value: 61, ly: 70 },
    ];
    const b = build(spec('kpi_row', { x: 'metric', y: ['value'], compare: 'ly', format: 'percent' }), rows);
    expect(b.render === 'kpi_row' && b.tiles.map((t) => [t.label, t.value, t.delta?.text, t.spark])).toEqual([
      ['Occupancy', '78.1%', '▲ 3.1 pts', null],
      ['Pickup', '61.0%', '▼ 9.0 pts', null],
    ]);
  });

  it('falls back to the change over the period when a tile has no comparison column', () => {
    const b = build(spec('kpi_row', { x: 'stay_date', y: ['revpar'] }), daily.map(({ stay_date, revpar }) => ({ stay_date, revpar })), cols);
    expect(b.render === 'kpi_row' && b.tiles[0]).toMatchObject({ versus: 'since 17 Nov' });
    expect(b.render === 'kpi_row' && b.tiles[0].delta?.text).toBe('▲ 5.7%');
  });

  it('draws a sparkline inside its box, flat when nothing changes, and none for a single point', () => {
    const p = sparkPath([1, 3, 2]);
    expect(p?.line).toBe('M0.0,25.0L50.0,3.0L100.0,14.0');
    expect(p?.lastY).toBeCloseTo(0.5);
    expect(sparkPath([5, 5, 5])?.line).toBe('M0.0,14.0L50.0,14.0L100.0,14.0');
    expect(sparkPath([4])).toBeNull();
    expect(sparkPath([1, null, 3])?.line).toBe('M0.0,25.0L100.0,3.0');
  });

  it('lists one trend per group with its latest value and its change over the period', () => {
    const rows = ['Lisbon', 'Mayfair'].flatMap((hotel, h) => daily.map((d, i) => ({ hotel, stay_date: d.stay_date, revpar: h ? 240 + i * 10 : 130 - i * 5 })));
    const b = build(spec('sparkline_list', { x: 'stay_date', y: ['revpar'], group: 'hotel' }), rows, cols);
    expect(b.render).toBe('sparklines');
    if (b.render !== 'sparklines') return;
    expect(b.items.map((i) => [i.label, i.value, i.delta?.text])).toEqual([
      ['Lisbon', '€120', '▼ 7.7%'],
      ['Mayfair', '€260', '▲ 8.3%'],
    ]);
    expect(b.note).toBe('Change since 17 Nov.');
  });

  it('formats a table by column kind, hides hidden columns and keeps sortable values', () => {
    const rows = [{ hotel_code: 'LIS', hotel: 'Arbor Lisbon Chiado', stay_month: '2026-12', occupancy_pct: 58.4, rooms_otb: 2716, rooms_otb_ly: null, adr: 148.9 }];
    const columns: EvidenceColumn[] = [{ ...col('hotel_code', 'Code', 'id'), hidden: true }, col('hotel', 'Hotel', 'hotel'), col('stay_month', 'Month', 'month'), col('occupancy_pct', 'Occupancy', 'percent'), col('rooms_otb', 'On the books', 'count', 'rooms'), col('rooms_otb_ly', 'Last year', 'count', 'rooms'), col('adr', 'ADR', 'currency', 'EUR')];
    const b = build(spec('table'), rows, columns);
    expect(b.render).toBe('table');
    expect(b.table.columns.map((c) => [c.label, c.align])).toEqual([
      ['Hotel', 'left'],
      ['Month', 'left'],
      ['Occupancy', 'right'],
      ['On the books (rooms)', 'right'],
      ['Last year (rooms)', 'right'],
      ['ADR', 'right'],
    ]);
    expect(b.table.rows[0].map((c) => c.text)).toEqual(['Arbor Lisbon Chiado', 'Dec 2026', '58.4%', '2,716', '–', '€149']);
    expect(b.table.rows[0].map((c) => c.sort)).toEqual(['arbor lisbon chiado', Date.UTC(2026, 11, 1), 58.4, 2716, null, 148.9]);
  });

  it('infers column kinds from keys and values when the backend sends no metadata', () => {
    const b = build(spec('table'), [{ hotel: 'Lisbon', stay_date: '2026-12-16', occupancy_pct: 58.4, revenue: 404000, rooms: 2716, score: 4.25 }]);
    expect(b.table.columns.map((c) => c.kind)).toEqual(['text', 'date', 'percent', 'currency', 'count', 'number']);
    expect(b.table.rows[0].map((c) => c.text)).toEqual(['Lisbon', 'Wed 16 Dec 2026', '58.4%', '€404,000', '2,716', '4.25']);
  });

  it('gives a chart the columns its spec uses as its table', () => {
    const b = build(spec('bar', { x: 'hotel', y: ['revpar'], compare: 'revpar_ly' }), HOTELS, HOTEL_COLS);
    expect(b.table.columns.map((c) => c.label)).toEqual(['Hotel', 'RevPAR', 'Last year']);
    expect(b.table.rows[2].map((c) => c.text)).toEqual(['Tessera Berlin Mitte', '€97.60', '€95.20']);
  });
});

describe('tokens', () => {
  it('keeps every chart colour at 3:1 or better against its surface, in both themes', () => {
    for (const t of [DARK_TOKENS, LIGHT_TOKENS]) {
      for (const color of [t.series, t.cmp, t.pos, t.neg, t.decision, ...t.cat]) expect(contrast(color, t.surface), `${color} on ${t.surface}`).toBeGreaterThanOrEqual(3);
      for (const ink of [t.fg, t.text, t.muted]) expect(contrast(ink, t.surface), `${ink} on ${t.surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('picks the ink that reads on a fill', () => {
    expect(inkOn('#5b8deb')).toBe('#0d1117');
    expect(inkOn('#1f2c40')).toBe('#ffffff');
  });
});
