import {
  columnHeader,
  dataAsOf,
  formatCell,
  formatCurrency,
  formatDate,
  formatMonth,
  formatNumber,
  formatPercent,
  formatPeriod,
  inferColumn,
  resolveColumns,
  rowLabel,
  sortRows,
  visibleColumns,
} from './format';
import { humanizeKey, proseKeys, sourceLabel, toolTitle } from './labels';
import type { EvidenceColumn } from './types';

const HOTELS: Record<string, string> = { LIS: 'Arbor Lisbon Chiado', BER: 'Tessera Berlin Mitte', NYC: 'Arbor New York Midtown' };
const context = { hotelName: (code: string) => HOTELS[code], baseYear: 2026 };
const isHotel = (code: string) => code in HOTELS;

describe('formatting numbers', () => {
  it('groups thousands and uses a real minus sign', () => {
    expect(formatNumber(485652)).toBe('485,652');
    expect(formatNumber(-12.3)).toBe('−12.3');
    expect(formatNumber(0.933)).toBe('0.93');
  });

  it('writes percentages with at most one decimal, and fractions as percentages', () => {
    expect(formatPercent(-12.3)).toBe('−12.3%');
    expect(formatPercent(65)).toBe('65%');
    expect(formatPercent(0.1098, true)).toBe('11%');
  });

  it('writes money whole from 1,000 up, with cents below, and the symbol only for a known unit', () => {
    expect(formatCurrency(485652, 'EUR')).toBe('€485,652');
    expect(formatCurrency(196.56, 'EUR')).toBe('€196.56');
    expect(formatCurrency(-1336633, 'EUR')).toBe('−€1,336,633');
    expect(formatCurrency(200)).toBe('200');
    expect(formatCurrency(1500, 'IDR')).toBe('1,500 IDR');
  });
});

describe('formatting dates', () => {
  it('names the weekday, and the year only when it is not the business year', () => {
    expect(formatDate('2026-11-20', 2026)).toBe('Fri 20 Nov');
    expect(formatDate('2025-11-15', 2026)).toBe('Sat 15 Nov 2025');
    expect(formatDate('2026-11-17 04:12', 2026)).toBe('Tue 17 Nov, 04:12');
    expect(formatDate('not a date')).toBe('not a date');
  });

  it('writes a month with its year', () => {
    expect(formatMonth('2026-11-01')).toBe('Nov 2026');
    expect(formatMonth('2027-01')).toBe('Jan 2027');
  });

  it('writes a period without repeating what both ends share', () => {
    expect(formatPeriod({ from: '2026-11-01', to: '2026-11-19' })).toBe('1–19 Nov 2026');
    expect(formatPeriod({ from: '2026-11-01', to: '2026-12-31' })).toBe('1 Nov – 31 Dec 2026');
    expect(formatPeriod({ from: '2026-12-15', to: '2027-01-14' })).toBe('15 Dec 2026 – 14 Jan 2027');
  });

  it('says what the business date means for the rows', () => {
    expect(dataAsOf('2026-11-20', null)).toBe('Data as of Fri 20 Nov · earlier stays are actuals, later ones on the books');
    expect(dataAsOf('2026-11-20', { from: '2026-08-01', to: '2026-11-19' })).toBe('Data as of Fri 20 Nov · this period is all actuals');
    expect(dataAsOf('2026-11-20', { from: '2026-11-20', to: '2026-12-31' })).toBe('Data as of Fri 20 Nov · this period is all on the books, not actuals yet');
    expect(dataAsOf('2026-11-20', { from: '2026-11-01', to: '2026-12-31' })).toContain('earlier stays are actuals');
  });
});

describe('columns', () => {
  const pace = [{ hotel_code: 'LIS', rooms_otb: 2928, rooms_otb_stly: 3337, pace_pct: -12.3, revenue_otb: 485652 }];

  it('reads kinds and human labels from keys and values', () => {
    const columns = resolveColumns(pace);
    expect(columns.map((column) => [column.label, column.kind])).toEqual([
      ['Hotel', 'hotel'],
      ['Rooms on the books', 'count'],
      ['Same time last year', 'count'],
      ['Pace vs last year', 'percent'],
      ['Revenue on the books', 'currency'],
    ]);
  });

  it('knows a hotel code under a generic key, a month, a date, money in EUR and a fraction', () => {
    expect(inferColumn('key', [{ key: 'LIS' }, { key: 'BER' }], isHotel)).toMatchObject({ kind: 'hotel', label: 'Hotel' });
    expect(inferColumn('key', [{ key: 'RET' }], isHotel)).toMatchObject({ kind: 'text' });
    expect(inferColumn('period', [{ period: '2026-11-01' }, { period: '2026-12-01' }])).toMatchObject({ kind: 'month', label: 'Month' });
    expect(inferColumn('stay_date', [{ stay_date: '2026-11-20' }])).toMatchObject({ kind: 'date', label: 'Stay date' });
    expect(inferColumn('net_revenue_eur', [{ net_revenue_eur: 723561 }])).toEqual({ key: 'net_revenue_eur', label: 'Net revenue', kind: 'currency', unit: 'EUR' });
    expect(inferColumn('pickup_pct', [{ pickup_pct: 0.1098 }])).toMatchObject({ kind: 'percent', unit: 'ratio' });
    expect(inferColumn('bar_vs_comp', [{ bar_vs_comp: 1.282 }])).toMatchObject({ kind: 'number', label: 'BAR vs comp set' });
  });

  it('hides ids, kinds, nested values and a hotel name that repeats the code', () => {
    const brief = [{ id: 'data_stale:BER:POS', kind: 'data_stale', hotel_code: 'BER', hotel_name: 'Tessera Berlin Mitte', severity: 'critical', impact_eur: null, facts: { system: 'POS' } }];
    const columns = resolveColumns(brief);
    expect(visibleColumns(columns).map((column) => column.key)).toEqual(['hotel_code', 'severity', 'impact_eur']);
    expect(columns.find((column) => column.key === 'id')).toMatchObject({ kind: 'id', hidden: true });
  });

  it("uses the server's columns as they are, and keeps what they leave out hidden at the end", () => {
    const server: EvidenceColumn[] = [
      { key: 'hotel_code', label: 'Hotel', kind: 'hotel' },
      { key: 'pace_pct', label: 'Pace', kind: 'percent' },
      { key: 'rooms_otb', label: 'On the books', kind: 'count', unit: 'nights' },
    ];
    const columns = resolveColumns(pace, server);
    expect(columns.slice(0, 3)).toEqual(server);
    expect(columns.slice(3).every((column) => column.hidden)).toBe(true);
    expect(visibleColumns(columns).map(columnHeader)).toEqual(['Hotel', 'Pace', 'On the books (nights)']);
  });

  it('shows every column when all of them are internal', () => {
    expect(visibleColumns([{ key: 'id', label: 'ID', kind: 'id' }])).toHaveLength(1);
  });
});

describe('cells', () => {
  it('shows a hotel by name, and by code when the name is not known', () => {
    expect(formatCell('LIS', { kind: 'hotel' }, context)).toBe('Arbor Lisbon Chiado');
    expect(formatCell('XYZ', { kind: 'hotel' }, context)).toBe('XYZ');
  });

  it('formats by kind', () => {
    expect(formatCell(-12.3, { kind: 'percent' })).toBe('−12.3%');
    expect(formatCell(0.1098, { kind: 'percent', unit: 'ratio' })).toBe('11%');
    expect(formatCell(485652, { kind: 'currency', unit: 'EUR' })).toBe('€485,652');
    expect(formatCell(2928, { kind: 'count' })).toBe('2,928');
    expect(formatCell('2026-12-01', { kind: 'month' })).toBe('Dec 2026');
    expect(formatCell('2026-11-21', { kind: 'date' }, context)).toBe('Sat 21 Nov');
  });

  it('turns internal tokens, timestamps, flags and empty values into words', () => {
    expect(formatCell('no_availability', { kind: 'text' })).toBe('No availability');
    expect(formatCell('BDC', { kind: 'text' })).toBe('BDC');
    expect(formatCell('2026-11-17 04:12', { kind: 'text' }, context)).toBe('Tue 17 Nov, 04:12');
    expect(formatCell(true, { kind: 'text' })).toBe('Yes');
    expect(formatCell(null, { kind: 'currency' })).toBe('–');
    expect(formatCell({ system: 'POS', days_behind: 3 }, { kind: 'text' })).toBe('System: POS · Days behind: 3');
  });

  it('labels a row by what it names', () => {
    const rows = [{ period: '2026-12-01', key: 'LIS', pace_pct: -15.9 }];
    expect(rowLabel(rows[0]!, resolveColumns(rows, null, isHotel), context)).toBe('Dec 2026 · Arbor Lisbon Chiado');
  });
});

describe('sorting', () => {
  const rows = [
    { hotel_code: 'NYC', pace_pct: 4.1 },
    { hotel_code: 'BER', pace_pct: null },
    { hotel_code: 'LIS', pace_pct: -12.3 },
  ];
  const [hotel, pace] = resolveColumns(rows);

  it('sorts numbers as numbers and keeps empty values last in both directions', () => {
    expect(sortRows(rows, pace!, 'asc').map((row) => row.hotel_code)).toEqual(['LIS', 'NYC', 'BER']);
    expect(sortRows(rows, pace!, 'desc').map((row) => row.hotel_code)).toEqual(['NYC', 'LIS', 'BER']);
  });

  it('sorts hotels by the name on screen, not the code', () => {
    expect(sortRows(rows, hotel!, 'asc', context).map((row) => row.hotel_code)).toEqual(['LIS', 'NYC', 'BER']);
  });

  it('does not change the rows it was given', () => {
    sortRows(rows, pace!, 'asc');
    expect(rows[0]!.hotel_code).toBe('NYC');
  });
});

describe('labels', () => {
  it('turns a key into words', () => {
    expect(humanizeKey('gop_margin_pct')).toBe('GOP margin');
    expect(humanizeKey('covers_per_occupied_room')).toBe('Covers per occupied room');
    expect(humanizeKey('revenue_ly_eur')).toBe('Revenue last year');
  });

  it("titles a tool call: the server's title, the label map, the metric it read, or plain words", () => {
    expect(toolTitle('get_pace', { hotels: ['LIS'], days: 45 })).toBe('Pace vs last year');
    expect(toolTitle('get_pace', {}, 'Pace for the next 45 nights')).toBe('Pace for the next 45 nights');
    expect(toolTitle('get_metric', { metric: 'occupancy' })).toBe('Occupancy');
    expect(toolTitle('mcp__compass__get_data_health')).toBe('Data freshness');
    expect(toolTitle('get_guest_origin')).toBe('Guest origin');
  });

  it('names a source for people', () => {
    expect(sourceLabel('hotel.v_hotel_day')).toBe('Daily hotel performance');
    expect(sourceLabel('hotel.pace_vs_stly()')).toBe('Pace vs same time last year');
    expect(sourceLabel('hotel.v_hotel_day', { 'hotel.v_hotel_day': 'Hotel day view' })).toBe('Hotel day view');
    expect(sourceLabel('hotel.guest_origin_daily')).toBe('Guest origin');
  });

  it('reads column names inside a note as words', () => {
    expect(proseKeys('adds its actual nights (rooms_actual), so')).toBe('adds its actual nights (rooms actual), so');
  });
});
