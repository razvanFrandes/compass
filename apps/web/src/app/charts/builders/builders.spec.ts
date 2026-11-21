import { SPECIMENS } from '../catalog-samples';
import { DARK_TOKENS, LIGHT_TOKENS, contrast, inkOn } from '../tokens';
import { WIDGET_KINDS, type EvidenceColumn, type WidgetKind, type WidgetRow, type WidgetSpec } from '../widget-types';
import { hasCycle } from './parts';
import { niceCeil, niceStep } from './points';
import { sparkPath } from './figures';
import { waterfallBase, waterfallSteps } from './cartesian';
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

  it('shows the tooltip wherever the pointer is over a bar or line chart, and moves it with the pointer at once', () => {
    for (const sp of specimens) {
      for (const width of [1100, 320]) {
        const b = buildWidget({ spec: sp.spec, rows: sp.rows, columns: sp.columns, width });
        if (b.render !== 'echarts') continue;
        const o = b.option as Obj;
        const tip = o['tooltip'] as Obj;
        // No transition: ECharts then throttles the tooltip to 50 ms steps and eases it behind the pointer.
        expect(tip['transitionDuration'], sp.id).toBe(0);
        // The tooltip survives the hairline gaps between slices, cells and steps.
        expect(tip['hideDelay'], sp.id).toBeGreaterThanOrEqual(200);
        const axes = [o['xAxis'], o['yAxis']].flat().filter(Boolean) as Obj[];
        const marks = ((o['series'] as Obj[]) ?? []).map((x) => x['type']);
        // Bars and lines over categories answer for the whole band under the pointer, not only for the mark itself:
        // between two bars, beside a short one, on a line between its points.
        if (axes.some((a) => a['type'] === 'category') && marks.some((m) => m === 'bar' || m === 'line')) expect(tip['trigger'], `${sp.id} at ${width}`).toBe('axis');
      }
    }
  });

  it('shows an unknown kind as a table with a note, never a blank', () => {
    const b = build(spec('hexbin' as WidgetKind, { x: 'hotel', y: ['revpar'] }), HOTELS, HOTEL_COLS);
    expect(b.render).toBe('table');
    expect(b.note).toBe('This kind of chart isn’t available yet, so the numbers are shown as a table.');
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

describe('money in a hotel’s own currency', () => {
  const LOCAL = [col('hotel_code', 'Hotel', 'hotel'), col('stay_date', 'Stay date', 'date'), col('bar_rate', 'Our BAR', 'currency', 'local currency'), col('comp_median', 'Comp set median', 'currency', 'local currency')];
  const nights = (hotel: string, n = 4) => Array.from({ length: n }, (_, i) => ({ hotel_code: hotel, stay_date: `2026-12-${String(i + 10).padStart(2, '0')}`, bar_rate: 530 + i * 300, comp_median: 446.2 + i * 100 }));
  const line = spec('line', { x: 'stay_date', y: ['bar_rate', 'comp_median'], format: 'currency' });
  const all = (b: Built) => JSON.stringify(b, (_k, v) => (typeof v === 'function' ? undefined : v)) + [tooltipHtml(b, [{ dataIndex: 0 }])].join();
  const ticks = (b: Built) => [200, 800, 1200].map((v) => call((axis(b, 'yAxis')['axisLabel'] as Obj)['formatter'], v));

  it('writes the currency of the hotel the rows are about, never the words “local currency”', () => {
    const b = build(line, nights('DXB2'), LOCAL);
    expect(ticks(b)).toEqual(['AED 200', 'AED 800', 'AED 1.2k']);
    expect(tooltipHtml(b, [{ dataIndex: 0 }])).toContain('AED 530');
    expect(all(b)).not.toMatch(/local currency/i);
    expect(b.unitNote).toBeUndefined();
  });

  it('writes plain numbers when the hotels’ currencies differ or are unknown, and says the unit once', () => {
    for (const rows of [[...nights('DXB2', 2), ...nights('NYC', 2)], nights('DXB2').map(({ hotel_code: _h, ...r }) => r)]) {
      const b = build(line, rows, LOCAL);
      expect(ticks(b)).toEqual(['200', '800', '1.2k']);
      expect(all(b)).not.toMatch(/local currency \d|currency \d/i);
      expect(b.unitNote).toBe('In local currency');
    }
  });

  it('shares one currency between hotels of the same country', () => {
    const b = build(line, [...nights('DXB1', 2), ...nights('DXB2', 2)], LOCAL);
    expect(ticks(b)[2]).toBe('AED 1.2k');
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
  const endLabelSeries = (b: Built) => series(b).find((x) => String(x['name']).endsWith('values')) as Obj;
  const endLabelTexts = (b: Built) => (endLabelSeries(b)['data'] as (Obj | string)[]).map((d) => (typeof d === 'string' ? d : ((d['label'] as Obj)['formatter'] as string)));

  it('lays bars down when the categories are names, sorted by value, with the value at the end of each bar', () => {
    const b = build(spec('bar', { x: 'hotel', y: ['revpar'] }), [HOTELS[2], HOTELS[0], HOTELS[1]], HOTEL_COLS);
    expect(axis(b, 'yAxis')['type']).toBe('category');
    expect(axis(b, 'yAxis')['inverse']).toBe(true);
    // Hotels read by their city on the marks; the full name is in the tooltip.
    expect(axis(b, 'yAxis')['data']).toEqual(['New York', 'London Mayfair', 'Berlin']);
    expect(endLabelTexts(b)).toEqual(['€261', '€253', '€98']);
    expect(tooltipHtml(b, { dataIndex: 0 })).toContain('Arbor New York Midtown');
    expect(b.legend).toEqual([]);
  });

  it('names hotels, never codes, on every chart kind that draws them', () => {
    const rows = [
      { hotel_code: 'LIS', pace_pct: -20.5 },
      { hotel_code: 'DXB2', pace_pct: 9 },
      { hotel_code: 'LON2', pace_pct: -8.9 },
    ];
    const cols = [col('hotel_code', 'Hotel', 'hotel'), col('pace_pct', 'Pace', 'percent')];
    for (const kind of ['bar', 'bullet', 'donut', 'pie', 'funnel'] as const) {
      const b = build(spec(kind, { x: 'hotel_code', y: ['pace_pct'] }), rows, cols);
      const text = JSON.stringify(chart(b).option, (_k, v) => (typeof v === 'function' ? undefined : v));
      expect(text, kind).not.toMatch(/"(LIS|DXB2|LON2)"/);
    }
    const bar = build(spec('bar', { x: 'hotel_code', y: ['pace_pct'] }), rows, cols);
    expect(axis(bar, 'yAxis')['data']).toEqual(expect.arrayContaining(['Lisbon', 'Dubai Business Bay', "London King's Cross"]));
    // A text column of codes is recognised as hotels too.
    const loose = build(spec('bar', { x: 'hotel_code', y: ['pace_pct'] }), rows, [col('hotel_code', 'Hotel', 'text'), col('pace_pct', 'Pace', 'percent')]);
    expect(axis(loose, 'yAxis')['data']).toContain('Lisbon');
  });

  it('ranks from the weak end when the title is about it, and highlights the hotels the title names', () => {
    const rows = [
      { hotel_code: 'AMS', pace_pct: 5.6 },
      { hotel_code: 'LIS', pace_pct: -20.5 },
      { hotel_code: 'DPS', pace_pct: 8.4 },
      { hotel_code: 'LON2', pace_pct: -8.9 },
    ];
    const cols = [col('hotel_code', 'Hotel', 'hotel'), col('pace_pct', 'Pace', 'percent')];
    const b = build(spec('bar', { title: 'Lisbon is 20.5% behind last year, the weakest of the group', x: 'hotel_code', y: ['pace_pct'] }), rows, cols);
    expect(axis(b, 'yAxis')['data']).toEqual(['Lisbon', "London King's Cross", 'Amsterdam', 'Bali']);
    const data = series(b)[0]['data'] as Obj[];
    expect(data.map((d) => (d['itemStyle'] as Obj)['opacity'])).toEqual([1, 0.38, 0.38, 0.38]);
    const color = (axis(b, 'yAxis')['axisLabel'] as Obj)['color'] as (v: string, i: number) => string;
    expect([color('', 0), color('', 1)]).toEqual([DARK_TOKENS.text, DARK_TOKENS.muted]);
    // Labels of bars below zero sit on their left, past the bar's end; the axis keeps room for them.
    const labels = endLabelSeries(b)['data'] as Obj[];
    expect((labels[0]['label'] as Obj)['position']).toBe('left');
    expect((labels[2]['label'] as Obj)['position']).toBe('right');
    expect((axis(b, 'xAxis')['min'] as number) < -20.5).toBe(true);
    // A title about the strong end ranks from the top.
    const top = build(spec('bar', { title: 'Bali leads the group', x: 'hotel_code', y: ['pace_pct'] }), rows, cols);
    expect((axis(top, 'yAxis')['data'] as string[])[0]).toBe('Bali');
  });

  it('keeps one bar thickness on every row, between 12 and 16 px', () => {
    for (const n of [3, 6, 8]) {
      const rows = Array.from({ length: n }, (_, i) => ({ hotel: `Hotel ${i + 1}`, revpar: 100 + i }));
      const b = build(spec('bar', { x: 'hotel', y: ['revpar'] }), rows, HOTEL_COLS, { compact: true });
      const w = series(b)[0]['barWidth'] as number;
      expect(w).toBeGreaterThanOrEqual(12);
      expect(w).toBeLessThanOrEqual(16);
    }
  });

  it('draws the comparison as a purple tick, with the value past whichever ends further out', () => {
    const b = build(spec('bar', { x: 'hotel', y: ['revpar'], compare: 'revpar_ly' }), HOTELS, HOTEL_COLS);
    expect(series(b).map((x) => x['type'])).toEqual(['bar', 'scatter', 'scatter']);
    expect((series(b)[1]['itemStyle'] as Obj)['color']).toBe(DARK_TOKENS.cmp);
    const ends = (endLabelSeries(b)['data'] as Obj[]).map((d) => d['value']);
    expect(ends).toEqual([289.2, 252.8, 97.6]);
    expect(b.legend.map((l) => [l.label, l.mark])).toEqual([
      ['RevPAR', 'solid'],
      ['Last year', 'tick'],
    ]);
  });

  it('draws eight rows at most and keeps the rest one “+N more” away, never cutting a hotel the title names', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ hotel: `Hotel ${i + 1}`, revpar: 100 + i }));
    const b = build(spec('bar', { title: 'Hotel 1 trails the group', x: 'hotel', y: ['revpar'] }), rows, HOTEL_COLS);
    const shown = axis(b, 'yAxis')['data'] as string[];
    expect(shown.length).toBeLessThanOrEqual(8);
    expect(b.more).toBe(20 - shown.length);
    expect(b.note).toBeUndefined();
    expect(b.table.rows).toHaveLength(20);
    const named = build(spec('bar', { title: 'Hotel 1 is the weakest by far', x: 'hotel', y: ['revpar'] }), [...rows].reverse(), HOTEL_COLS);
    expect(axis(named, 'yAxis')['data']).toContain('Hotel 1');
    const high = build(spec('bar', { title: 'Hotel 1 is far below the top', x: 'hotel', y: ['revpar'] }), rows, HOTEL_COLS);
    expect(high.more).toBeGreaterThan(0);
    const strong = build(spec('bar', { title: 'Hotel 1 keeps its place', x: 'hotel', y: ['revpar'] }), rows, HOTEL_COLS);
    expect(axis(strong, 'yAxis')['data']).toContain('Hotel 1');
  });

  it('draws grouped bars of a value and its comparison per hotel as one bar and a marker', () => {
    const b = build(spec('grouped_bar', { x: 'hotel', y: ['revpar', 'revpar_ly'] }), HOTELS, HOTEL_COLS);
    expect(b.kind).toBe('grouped_bar');
    expect(series(b).map((x) => x['type'])).toEqual(['bar', 'scatter', 'scatter']);
  });

  it('never lets the numbers of grouped columns collide: they show on hover when they do not fit', () => {
    const rows = ['2026-08', '2026-09', '2026-10', '2026-11'].flatMap((month, m) => ['Corporate', 'Leisure', 'Group'].map((segment, i) => ({ month, segment, room_nights: 3000 + 100 * m + 17 * i })));
    const b = build(spec('grouped_bar', { x: 'month', y: ['room_nights'], group: 'segment' }), rows, [col('month', 'Month', 'month'), col('segment', 'Segment', 'text'), col('room_nights', 'Room nights', 'count')], { width: 360, compact: true });
    expect(series(b).every((x) => (x['label'] as Obj)['show'] === false)).toBe(true);
    expect(series(b).every((x) => ((x['emphasis'] as Obj)['label'] as Obj)['show'] === true)).toBe(true);
  });

  it('stacks the parts with a surface-coloured gap and labels each stack with its total', () => {
    const rows = ['2026-10', '2026-11'].flatMap((month, m) => ['Corporate', 'Leisure'].map((segment, i) => ({ month, segment, room_nights: 1000 * (m + 1) + 500 * i })));
    const b = build(spec('stacked_bar', { x: 'month', y: ['room_nights'], group: 'segment' }), rows, [col('month', 'Month', 'month'), col('segment', 'Segment', 'text'), col('room_nights', 'Room nights', 'count', 'nights')]);
    expect(series(b).every((x) => x['stack'] === 'total')).toBe(true);
    expect((series(b)[0]['itemStyle'] as Obj)['borderColor']).toBe(DARK_TOKENS.surface);
    expect((series(b)[0]['label'] as Obj)['show']).toBe(false);
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

  // Miami Beach, October: "From budgeted to actual GOP", in a brief card about 400 px wide.
  const miami: WidgetRow[] = [
    { step: 'Budget GOP', amount: 886_300 },
    { step: 'Rooms', amount: -12_000 },
    { step: 'F&B', amount: 8_400 },
    { step: 'Meetings & events', amount: -21_600 },
    { step: 'Other revenue', amount: 3_200 },
    { step: 'Costs', amount: -50_000 },
    { step: 'Unallocated', amount: -18_300 },
    { step: 'Actual GOP', amount: 796_000 },
  ];
  /** Runs the custom series' renderItem for step i, the way ECharts would, and returns what it draws. */
  const drawStep = (b: Built, i: number) => {
    const data = series(b)[0]['data'] as number[][];
    const horizontal = axis(b, 'yAxis')['type'] === 'category';
    const api = {
      value: (dim: number) => data[i][dim],
      coord: ([a, v]: [number, number]) => (horizontal ? [v / 1000, a * 28 + 14] : [a * 60 + 30, 300 - v / 1000]),
      size: () => (horizontal ? [0, 28] : [60, 0]),
    };
    const out = call(series(b)[0]['renderItem'], {}, api) as unknown as { children: Obj[] };
    return out.children;
  };
  const texts = (b: Built) => miami.map((_, i) => drawStep(b, i).find((ch) => ch['type'] === 'text')!['style'] as Obj);

  it('draws the bridge lying down in a narrow card: a row per step, the whole name on the left, the value at the bar’s end', () => {
    for (const width of [400, 320, 540]) {
      const b = chart(build(s, miami, cols, { width, compact: true, height: 180 }));
      const y = axis(b, 'yAxis');
      expect(y['type'], `${width}`).toBe('category');
      expect(y['data']).toEqual(miami.map((r) => r['step']));
      expect(y['inverse']).toBe(true);
      expect((y['axisLabel'] as Obj)['rotate'] ?? 0).toBe(0);
      expect(axis(b, 'xAxis')['type']).toBe('value');
      // About 28 px a row, whatever height the host asked for: a squashed bridge says nothing.
      expect(b.height).toBeGreaterThanOrEqual(miami.length * 26);
      expect(b.height).toBeLessThanOrEqual(miami.length * 28 + 60);
      expect(texts(b).map((t) => t['text'])).toEqual(['€886k', '−€12k', '+€8.4k', '−€21.6k', '+€3.2k', '−€50k', '−€18.3k', '€796k']);
      const [open, rooms, fb] = texts(b);
      expect(open['fontWeight']).toBe(600);
      expect(rooms['fill']).toBe(DARK_TOKENS.neg);
      expect(fb['fill']).toBe(DARK_TOKENS.pos);
      // A thin connector from each step's end to the next row.
      expect(drawStep(b, 1).some((ch) => ch['type'] === 'line')).toBe(true);
    }
  });

  it('never breaks the axis: it starts near the lowest running total and says so once, as its first tick', () => {
    for (const width of [400, 900]) {
      const b = chart(build(s, miami, cols, { width }));
      const o = opt(b);
      expect(JSON.stringify(o)).not.toMatch(/"breaks"|breakArea|zigzag/);
      expect(b.note).toBeUndefined();
      const valueAxis = axis(b, width < 560 ? 'xAxis' : 'yAxis');
      const min = valueAxis['min'] as number;
      expect(min).toBeGreaterThan(0);
      expect(min).toBeLessThan(796_000);
      const tick = (v: number) => call((valueAxis['axisLabel'] as Obj)['formatter'], v);
      expect(tick(min)).toMatch(/^€\d+k$/);
      if (width < 560) expect(tick(min + 100_000)).toBe('');
    }
    // A bridge whose steps are large next to its totals starts at zero.
    expect(waterfallBase(waterfallSteps(context({ spec: s, rows: [{ step: 'Open', amount: 100 }, { step: 'A', amount: -70 }] })))).toBe(0);
  });

  it('stands the bridge up in a wide card without turning a label or letting two collide', () => {
    for (const width of [560, 760, 1100]) {
      const b = chart(build(s, miami, cols, { width }));
      const x = axis(b, 'xAxis');
      expect(x['type']).toBe('category');
      const label = x['axisLabel'] as Obj;
      expect(label['rotate'] ?? 0).toBe(0);
      const slot = (width - 60) / miami.length;
      for (const name of miami.map((r) => r['step'] as string)) {
        const lines = call(label['formatter'], name).split('\n');
        expect(lines.length, name).toBeLessThanOrEqual(2);
        for (const line of lines) expect(line.length * 11.5 * 0.53, `${name} at ${width}`).toBeLessThanOrEqual(slot - 4);
      }
      // Each value fits over its own column.
      for (const t of texts(b)) expect(String(t['text']).length * (t['fontSize'] as number) * 0.55, `${t['text']} at ${width}`).toBeLessThanOrEqual(slot);
    }
  });

  it('labels direction with arrows in the legend and for screen readers', () => {
    const b = chart(build(s, rows, cols));
    expect(b.legend.map((l) => l.label)).toEqual(['Total', '+ Adds', '− Takes away']);
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

  it('fits the total inside the hole at every width: the number big, its unit small with “Total”, or nothing', () => {
    // "Account production — New York Midtown": 1,114 room nights, which used to spill out of both sides of the hole.
    const accounts = [col('account', 'Account', 'text'), col('room_nights', 'Room nights', 'count', 'room nights')];
    const rows = [
      { account: 'Vantor Consulting', room_nights: 512 },
      { account: 'Halden Pharma', room_nights: 301 },
      { account: 'Meridian Air crew', room_nights: 187 },
      { account: 'Other', room_nights: 114 },
    ];
    for (const [cols2, data] of [
      [accounts, rows],
      [cols, parts(4)],
      [accounts, rows.map((r) => ({ ...r, room_nights: r.room_nights * 1234 }))],
    ] as const) {
      for (const width of [1100, 640, 390, 320, 240]) {
        for (const compact of [false, true]) {
          const b = chart(build(spec('donut', { group: data === rows || cols2 === accounts ? 'account' : 'channel', y: [cols2[1].key] }), [...data], [...cols2], { width, compact }));
          const g = opt(b)['graphic'] as Obj[] | undefined;
          const center = g?.[0];
          // A card as narrow as a phone still has room for the total; only a smaller hole goes without (never clipped).
          if (width >= 320 && data === rows) expect(center, `label at ${width}${compact ? ' compact' : ''}`).toBeTruthy();
          if (!center) continue;
          const st = center['style'] as Obj;
          const text = st['text'] as string;
          const rich = st['rich'] as Record<string, Obj>;
          const [big, small] = text.split('\n').map((line) => line.replace(/^\{\w\|(.*)\}$/, '$1'));
          expect(big, `${width} ${compact}`).not.toMatch(/room nights|Total/);
          expect(small).toMatch(/^Total/);
          // The text block, as wide as its longest line at a generous digit width, lies inside the hole.
          const w = Math.max(big.length * (rich['v']['fontSize'] as number) * 0.62, small.length * (rich['l']['fontSize'] as number) * 0.56);
          const h = (rich['v']['lineHeight'] as number) + (rich['l']['lineHeight'] as number);
          expect(Math.hypot(w, h), `${big} / ${small} at ${width}${compact ? ' compact' : ''}`).toBeLessThanOrEqual((center['info'] as Obj)['hole'] as number);
          expect(rich['v']['fontSize']).toBeGreaterThanOrEqual(12);
        }
      }
    }
    const wide = chart(build(spec('donut', { group: 'account', y: ['room_nights'] }), rows, accounts, { width: 640 }));
    expect(((opt(wide)['graphic'] as Obj[])[0]['style'] as Obj)['text']).toBe('{v|1,114}\n{l|Total room nights}');
    // A count without a unit says what it counts.
    const unitless = chart(build(spec('donut', { group: 'account', y: ['room_nights'] }), rows, [accounts[0], col('room_nights', 'Room nights', 'count')], { width: 640 }));
    expect(((opt(unitless)['graphic'] as Obj[])[0]['style'] as Obj)['text']).toBe('{v|1,114}\n{l|Total room nights}');
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
    [8, '8 parts are too many for a donut (it works for 2 to 7), so this is shown as bars.'],
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
    expect(negative.note).toBe('A pie can’t show negative parts, so this is shown as bars.');
  });
});

describe('funnel from stage columns (the shape get_web_funnel returns)', () => {
  // One row per device; the stages are columns, in the order of y.
  const devices: WidgetRow[] = [
    { key: 'mobile', sessions: 18_400, searches: 1_092, checkout_starts: 343, bookings: 147 },
    { key: 'desktop', sessions: 9_071, searches: 914, checkout_starts: 282, bookings: 282 },
  ];
  const cols = [col('key', 'Device', 'text'), col('sessions', 'Sessions', 'count'), col('searches', 'Searches', 'count'), col('checkout_starts', 'Checkout starts', 'count'), col('bookings', 'Bookings', 'count')];
  const y = ['sessions', 'searches', 'checkout_starts', 'bookings'];

  it('one row: the stages are the y columns, named by their labels, never the rows', () => {
    const b = chart(build(spec('funnel', { y }), [devices[0]], cols));
    expect((series(b)[0]['data'] as Obj[]).map((d) => [d['name'], d['value']])).toEqual([
      ['Sessions', 18_400],
      ['Searches', 1_092],
      ['Checkout starts', 343],
      ['Bookings', 147],
    ]);
    expect(b.points[3].text).toBe('Bookings: 147, 0.8% of sessions, 42.9% of the previous stage');
    expect(b.summary).toContain('Funnel with 4 stages');
  });

  it('several rows: one funnel per row, each with every stage, named by x', () => {
    const b = chart(build(spec('funnel', { x: 'key', y }), devices, cols));
    const funnels = series(b).filter((s) => s['type'] === 'funnel');
    expect(funnels.map((s) => s['name'])).toEqual(['mobile', 'desktop']);
    for (const f of funnels) expect((f['data'] as Obj[]).map((d) => d['name'])).toEqual(['Sessions', 'Searches', 'Checkout starts', 'Bookings']);
    expect((funnels[1]['data'] as Obj[]).map((d) => d['value'])).toEqual([9_071, 914, 282, 282]);
    // Each funnel's shares are of its own first stage.
    expect(b.points).toHaveLength(8);
    expect(b.points[3].text).toBe('mobile, Bookings: 147, 0.8% of sessions, 42.9% of the previous stage');
    expect(b.points[7].text).toBe('desktop, Bookings: 282, 3.1% of sessions, 100.0% of the previous stage');
    expect(b.points[7]).toMatchObject({ seriesIndex: 1, dataIndex: 3 });
    expect(b.summary).toContain('2 funnels');
    expect(b.summary).toContain('mobile');
    // The funnels sit side by side and do not overlap.
    const boxes = funnels.map((s) => [Number(s['left']), Number(s['left']) + Number(s['width'])]);
    expect(boxes[0][1]).toBeLessThanOrEqual(boxes[1][0]);
  });

  it('several rows on a phone: the stage names move into each label', () => {
    const b = chart(build(spec('funnel', { x: 'key', y }), devices, cols, { width: 360 }));
    const funnels = series(b).filter((s) => s['type'] === 'funnel');
    expect(call((funnels[0]['label'] as Obj)['formatter'], { dataIndex: 3 })).toContain('Bookings');
    expect(Number(funnels[1]['left']) + Number(funnels[1]['width'])).toBeLessThanOrEqual(360);
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

describe('heatmap of the group', () => {
  it('shows all 20 hotels over 14 nights at the regular height, without leaving any out', () => {
    const grid: WidgetRow[] = Array.from({ length: 20 }, (_, h) => Array.from({ length: 14 }, (_, d) => ({ period: `2026-11-${String(20 + d).padStart(2, '0')}`.replace('2026-11-3', '2026-12-0'), key: `H${String(h).padStart(2, '0')}`, value: 50 + h + d }))).flat();
    const b = chart(build(spec('heatmap', { x: 'period', group: 'key', y: ['value'] }), grid, [col('period', 'Date', 'date'), col('key', 'Hotel', 'hotel'), col('value', 'Occupancy', 'percent')]));
    expect((axis(b, 'yAxis')['data'] as unknown[]).length).toBe(20);
    expect(b.note).toBeUndefined();
    expect((series(b)[0]['data'] as unknown[]).length).toBe(280);
  });

  it('shows all 20 hotels in an answer too, where widgets are compact', () => {
    const grid: WidgetRow[] = Array.from({ length: 20 }, (_, h) => Array.from({ length: 14 }, (_, d) => ({ period: `2026-12-${String(1 + d).padStart(2, '0')}`, key: `H${String(h).padStart(2, '0')}`, value: 50 + h + d }))).flat();
    const b = chart(build(spec('heatmap', { x: 'period', group: 'key', y: ['value'] }), grid, [col('period', 'Date', 'date'), col('key', 'Hotel', 'hotel'), col('value', 'Occupancy', 'percent')], { compact: true, width: 600 }));
    expect((axis(b, 'yAxis')['data'] as unknown[]).length).toBe(20);
    expect(b.note).toBeUndefined();
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

  type CalendarBuilt = Extract<Built, { render: 'calendar' }>;
  const cal = (b: Built) => {
    expect(b.render).toBe('calendar');
    return b as CalendarBuilt;
  };
  // The rate position of one hotel for 45 nights from Fri 20 Nov 2026: 1.00 is the comp set median.
  const position = Array.from({ length: 45 }, (_, i) => ({ stay_date: new Date(Date.UTC(2026, 10, 20 + i)).toISOString().slice(0, 10), bar_vs_comp: [0.82, 0.92, 1, 1.08, 1.18][i % 5] }));
  const positionCols = [col('stay_date', 'Stay date', 'date'), col('bar_vs_comp', 'Our BAR vs the comp set median', 'number', '× the median')];
  const positionSpec = spec('calendar_heatmap', { title: 'Rate position by night (1.00 is the comp-set median)', x: 'stay_date', y: ['bar_vs_comp'] });

  it('lays nights out as one Monday-first month per month, with the days outside the range faint and empty', () => {
    const b = cal(build(positionSpec, position, positionCols, { width: 1200 }));
    expect(b.calendar.months.map((m) => m.name)).toEqual(['November 2026', 'December 2026', 'January 2027']);
    const nov = b.calendar.months[0]!;
    // 1 Nov 2026 is a Sunday: six cells of the first week come before it.
    expect(nov.weeks[0]!.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(nov.weeks[0]![6]!.day).toBe(1);
    expect(nov.weeks[0]![6]!.inRange).toBe(false);
    const friday20 = nov.weeks.flat().find((d) => d?.day === 20)!;
    expect(friday20.inRange).toBe(true);
    expect(friday20.value).toBe(0.82);
    const jan = b.calendar.months[2]!;
    expect(jan.weeks.flat().filter((d) => d?.inRange)).toHaveLength(3);
  });

  it('places the months side by side when there is room, and wraps them when there is not', () => {
    const wide = cal(build(positionSpec, position, positionCols, { width: 1200 }));
    expect(wide.calendar.perRow).toBe(3);
    expect(wide.calendar.cell).toBeGreaterThanOrEqual(32);
    expect(wide.calendar.cell).toBeLessThanOrEqual(64);
    const half = cal(build(positionSpec, position, positionCols, { width: 600 }));
    expect(half.calendar.perRow).toBe(2);
    const phone = cal(build(positionSpec, position, positionCols, { width: 360 }));
    expect(phone.calendar.perRow).toBe(1);
    expect(phone.calendar.cell).toBeGreaterThanOrEqual(32);
    // A wider card gets larger cells, up to 64 px, and the calendar's height follows them.
    expect(cal(build(positionSpec, position, positionCols, { width: 2400 })).calendar.cell).toBe(64);
    expect(wide.height).toBeGreaterThan(wide.calendar.cell * 5);
  });

  it('colours a ratio around 1.00 on a diverging scale: under one hue, over another, neutral at the median', () => {
    const b = cal(build(positionSpec, position, positionCols, { width: 1200, tokens: LIGHT_TOKENS }));
    expect(b.calendar.scale).toMatchObject({ kind: 'diverging', midText: '1.00', lowLabel: 'Under the comp set', highLabel: 'Over the comp set' });
    const days = b.calendar.months.flatMap((m) => m.weeks.flat()).filter((d) => d?.inRange) as NonNullable<CalendarBuilt['calendar']['months'][number]['weeks'][number][number]>[];
    const under = days.find((d) => d.value === 0.82)!;
    const at = days.find((d) => d.value === 1)!;
    const over = days.find((d) => d.value === 1.18)!;
    expect(new Set([under.fill, at.fill, over.fill]).size).toBe(3);
    expect(contrast(at.fill, LIGHT_TOKENS.surface)).toBeLessThan(1.4);
    // The cell says the distance from the median; the tooltip says what it means.
    expect(under.text).toBe('−18%');
    expect(over.text).toBe('+18%');
    expect(at.text).toBe('±0%');
    expect(under.meaning).toBe('18% under the comp set median');
    expect(at.meaning).toBe('At the comp set median');
    for (const t of [LIGHT_TOKENS, DARK_TOKENS]) {
      for (const d of cal(build(positionSpec, position, positionCols, { width: 1200, tokens: t })).calendar.months.flatMap((m) => m.weeks.flat())) {
        if (d?.inRange) expect(contrast(d.ink, d.fill), `${t.mode} ${d.iso}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('colours other values on a one-hue scale from low to high', () => {
    const nights = Array.from({ length: 31 }, (_, i) => ({ stay_date: `2026-12-${String(i + 1).padStart(2, '0')}`, occupancy_pct: 50 + i }));
    const b = cal(build(spec('calendar_heatmap', { x: 'stay_date', y: ['occupancy_pct'] }), nights, [col('stay_date', 'Night', 'date'), col('occupancy_pct', 'Occupancy', 'percent')], { width: 900 }));
    expect(b.calendar.scale).toMatchObject({ kind: 'sequential', lowLabel: 'Lower', highLabel: 'Higher', minText: '50%', maxText: '80%' });
    expect(b.calendar.months).toHaveLength(1);
    const d16 = b.calendar.months[0]!.weeks.flat().find((d) => d?.day === 16)!;
    expect(d16.text).toBe('65%');
    expect(d16.label).toBe('Wed 16 Dec 2026: 65.0%');
  });

  it('marks today, and says the extremes in its text alternative', () => {
    const b = cal(build(positionSpec, position, positionCols, { width: 1200, today: '2026-11-21' }));
    const days = b.calendar.months.flatMap((m) => m.weeks.flat());
    expect(days.filter((d) => d?.today).map((d) => d!.iso)).toEqual(['2026-11-21']);
    expect(b.summary).toContain('45 nights');
    expect(b.calendar.days).toHaveLength(45);
  });
});

describe('scatter, radar and gauge', () => {
  const idx = [
    { hotel: 'Dubai Business Bay', ari: 78, mpi: 118 },
    { hotel: 'London Mayfair', ari: 109, mpi: 106 },
    { hotel: 'Barcelona Mar', ari: 95, mpi: 89 },
  ];
  const idxCols = [col('hotel', 'Hotel', 'hotel'), col('ari', 'ARI (rate index)', 'number', 'index'), col('mpi', 'MPI (share index)', 'number', 'index')];

  it('draws the comp-set quadrant in plain words: tinted corners, no jargon on the chart', () => {
    const b = build(spec('scatter', { x: 'ari', y: ['mpi'], group: 'hotel' }), idx, idxCols, { width: 640 });
    const s = series(b)[0];
    const lines = (s['markLine'] as Obj)['data'] as Obj[];
    expect(lines.map((l) => l['xAxis'] ?? l['yAxis'])).toEqual([100, 100]);
    const areas = JSON.stringify(s['markArea']);
    for (const words of ['Pricier, still winning guests', 'Cheaper, winning guests', 'Pricier, losing guests', 'Cheaper and losing guests']) expect(areas).toContain(words);
    expect(axis(b, 'xAxis')['name']).toBe('← Cheaper · Price vs comp set · Pricier →');
    expect(axis(b, 'yAxis')['name']).toContain('Share of demand vs comp set');
    expect(JSON.stringify([axis(b, 'xAxis')['name'], axis(b, 'yAxis')['name'], areas])).not.toMatch(/ARI|MPI|RGI/);
    // 100 reads as "Comp set", the rest as a difference from it.
    expect(call((axis(b, 'xAxis')['axisLabel'] as Obj)['formatter'], 100)).toBe('Comp set');
    expect(call((axis(b, 'xAxis')['axisLabel'] as Obj)['formatter'], 110)).toBe('+10%');
    expect(b.legend).toEqual([]);
    expect(b.summary).toContain('Pricier, still winning guests: 1.');
  });

  it('colours and shapes each point by its corner, so colour is not the only cue', () => {
    const b = build(spec('scatter', { x: 'ari', y: ['mpi'], group: 'hotel' }), idx, idxCols, { width: 640, tokens: LIGHT_TOKENS });
    const data = series(b)[0]['data'] as Obj[];
    // Dubai: cheaper, winning · Mayfair: pricier, winning · Barcelona: cheaper, losing.
    expect(data.map((d) => d['symbol'])).toEqual(['circle', 'triangle', 'path://M0,0 L10,0 L5,9 Z']);
    expect(data.map((d) => (d['itemStyle'] as Obj)['color'])).toEqual([LIGHT_TOKENS.series, LIGHT_TOKENS.pos, LIGHT_TOKENS.neg]);
  });

  it('keeps the jargon for the tooltip, with what it means', () => {
    const b = build(spec('scatter', { x: 'ari', y: ['mpi'], group: 'hotel' }), [...idx.slice(0, 1), { hotel: 'London Mayfair', ari: 104.2, mpi: 96, rgi: 100 }], [...idxCols, col('rgi', 'RGI', 'number', 'index')], { width: 640 });
    const html = tooltipHtml(b, { dataIndex: 1 });
    expect(html).toContain('4.2% more than comp set');
    expect(html).toContain('4% fewer than fair share');
    expect(html).toContain('ARI 104.2');
    expect(html).toContain('Pricier, losing guests');
  });

  it('names the hotels the title talks about and the extremes, never all of them', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ hotel: `Hotel ${i}`, ari: 90 + i, mpi: 110 - i * 0.7 }));
    const rows = [...many, { hotel: 'London Mayfair', ari: 101, mpi: 100.5 }];
    const b = build(spec('scatter', { x: 'ari', y: ['mpi'], group: 'hotel', title: 'London Mayfair sits right on its comp set' }), rows, idxCols, { width: 900 });
    const data = series(b)[0]['data'] as Obj[];
    const named = data.map((d, i) => ((d['label'] as Obj)['show'] ? i : -1)).filter((i) => i >= 0);
    expect(named.length).toBeLessThanOrEqual(5);
    expect(named).toContain(20);
    expect(call((series(b)[0]['label'] as Obj)['formatter'], { dataIndex: 20 })).toBe('London Mayfair');
    // Fewer on a phone.
    const phone = series(build(spec('scatter', { x: 'ari', y: ['mpi'], group: 'hotel' }), rows, idxCols, { width: 360 }))[0]['data'] as Obj[];
    expect(phone.filter((d) => (d['label'] as Obj)['show']).length).toBeLessThanOrEqual(3);
  });

  it('zooms the axes to the data and keeps 100 in view', () => {
    const b = build(spec('scatter', { x: 'ari', y: ['mpi'], group: 'hotel' }), idx, idxCols, { width: 640 });
    const x = axis(b, 'xAxis');
    expect(x['min']).toBeLessThanOrEqual(78);
    expect(x['max']).toBeGreaterThanOrEqual(109);
    expect(x['min']).toBeGreaterThan(60);
    expect(niceStep(8.4)).toBe(10);
    expect(niceStep(0.3)).toBe(0.5);
    expect(niceCeil(123)).toBe(150);
  });

  it('names the row a click lands on', () => {
    const b = build(spec('scatter', { x: 'ari', y: ['mpi'], group: 'hotel' }), [{ hotel: 'Nowhere', ari: null, mpi: 90 }, ...idx], idxCols, { width: 640 });
    expect(b.rows).toEqual([1, 2, 3]);
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

  it('reads the headline KPIs of one row with last year from the _ly columns, and says "vs last year" whatever their label', () => {
    // The row get_kpis returns for a region, with the labels its view gives the columns.
    const row = { key: 'Asia', occupancy_pct: 77.1, occupancy_ly_pct: 72.5, adr_eur: 386.47, adr_ly_eur: 381.43, revpar_eur: 298.12, revpar_ly_eur: 276.53 };
    const kpiCols = [
      col('key', 'Region', 'text'),
      col('occupancy_pct', 'Occupancy', 'percent'),
      col('occupancy_ly_pct', 'Occupancy, last year', 'percent'),
      col('adr_eur', 'ADR', 'currency', 'EUR'),
      col('adr_ly_eur', 'ADR, last year', 'currency', 'EUR'),
      col('revpar_eur', 'RevPAR', 'currency', 'EUR'),
      col('revpar_ly_eur', 'RevPAR, last year', 'currency', 'EUR'),
    ];
    const b = build(spec('kpi_row', { y: ['occupancy_pct', 'adr_eur', 'revpar_eur'] }), [row], kpiCols);
    expect(b.render === 'kpi_row' && b.tiles.map((t) => [t.label, t.value, t.delta?.text, t.versus])).toEqual([
      ['Occupancy', '77.1%', '▲ 4.6 pts', 'vs last year'],
      ['ADR', '€386', '▲ 1.3%', 'vs last year'],
      ['RevPAR', '€298', '▲ 7.8%', 'vs last year'],
    ]);
  });

  it('says "vs budget" for a budget comparison, from the column label', () => {
    const b = build(spec('kpi', { y: ['gop_eur'], compare: 'plan' }), [{ gop_eur: 110, plan: 100 }], [col('gop_eur', 'GOP', 'currency', 'EUR'), col('plan', 'GOP budget', 'currency', 'EUR')]);
    expect(b.render === 'kpi' && b.kpi.versus).toBe('vs budget');
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
