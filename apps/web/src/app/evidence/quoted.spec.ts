import { resolveColumns } from './format';
import { numbersIn, quotedFigures, type FigureTable } from './quoted';

const HOTELS: Record<string, string> = { LIS: 'Arbor Lisbon Chiado', NYC: 'Arbor New York Midtown' };
const context = { hotelName: (code: string) => HOTELS[code], baseYear: 2026 };
const isHotel = (code: string) => code in HOTELS;

function table(callId: string, title: string, rows: Record<string, unknown>[]): FigureTable {
  return { callId, title, rows, columns: resolveColumns(rows, null, isHotel) };
}

const pace = table('c1', 'Pace vs last year', [{ hotel_code: 'LIS', rooms_otb: 2928, rooms_otb_stly: 3337, pace_pct: -12.3, revenue_otb: 485652 }]);
const forecast = table('c2', 'Forecast', [
  { period: '2026-11-01', key: 'LIS', rooms_on_books: 830, pace_pct: -22.2, occupancy_p50_pct: 68.6 },
  { period: '2026-12-01', key: 'LIS', rooms_on_books: 1286, pace_pct: -15.9, occupancy_p50_pct: 62.4 },
]);
const brief = table('c3', 'The morning brief', [{ id: 'account_loss:NYC:Vantor', hotel_code: 'NYC', impact_eur: -1336633 }]);
const pickup = table('c4', 'Pickup in the last days', [{ hotel_code: 'LIS', rooms_picked_up: 737, pickup_pct: 0.1098 }]);

describe('numbersIn', () => {
  it('reads figures with their unit, scale and precision', () => {
    expect(numbersIn('Lisbon is 12.3% behind: 2,928 room nights, worth €1.34M.')).toEqual([
      { raw: '12.3%', value: 12.3, decimals: 1, scale: 1, percent: true, currency: false },
      { raw: '2,928', value: 2928, decimals: 0, scale: 1, percent: false, currency: false },
      { raw: '€1.34M', value: 1.34, decimals: 2, scale: 1e6, percent: false, currency: true },
    ]);
  });

  it('leaves out dates, times, years, list numbering and bare single digits', () => {
    const text = '1. On 20 Nov 2026 (2026-11-20, 04:12) the feed was 3 days behind.\n2. Since Nov 17 in Q4.';
    expect(numbersIn(text)).toEqual([]);
  });

  it('does not read metres as millions', () => {
    expect(numbersIn('a room of 300 m and a budget of €2m').map((n) => n.raw)).toEqual(['300', '€2m']);
  });
});

describe('quotedFigures', () => {
  it('ties each number in the answer to the cell it came from, in the order of the answer', () => {
    const answer = 'Lisbon is **12.3% behind**: 2,928 room nights on the books against 3,337 last year. December sits at −15.9%.';
    const figures = quotedFigures(answer, [pace, forecast], context);
    expect(figures.map((f) => [f.value, f.label, f.context, f.source])).toEqual([
      ['−12.3%', 'Pace vs last year', 'Arbor Lisbon Chiado', 'Pace vs last year'],
      ['2,928', 'Rooms on the books', 'Arbor Lisbon Chiado', 'Pace vs last year'],
      ['3,337', 'Same time last year', 'Arbor Lisbon Chiado', 'Pace vs last year'],
      ['−15.9%', 'Pace vs last year', 'Dec 2026 · Arbor Lisbon Chiado', 'Forecast'],
    ]);
    expect(figures[3]).toMatchObject({ callId: 'c2', rowIndex: 1, key: 'pace_pct' });
  });

  it('matches a rounded or scaled figure and shows the cell at full precision', () => {
    expect(quotedFigures('New York lost €1.34M with that account.', [brief], context).map((f) => f.value)).toEqual(['−€1,336,633']);
    expect(quotedFigures('Pickup was 11% of inventory.', [pickup], context).map((f) => f.value)).toEqual(['11%']);
  });

  it('never ties one cell to two numbers, and skips numbers that are in no row', () => {
    const figures = quotedFigures('2,928 nights, again 2,928, and 409 fewer than last year.', [pace], context);
    expect(figures.map((f) => f.value)).toEqual(['2,928']);
  });

  it('does not take a small whole number for a rounded cell', () => {
    expect(quotedFigures('We looked at 12 hotels.', [pace], context)).toEqual([]);
  });

  it('returns nothing without an answer', () => {
    expect(quotedFigures(null, [pace], context)).toEqual([]);
  });
});

describe('a figure names its row', () => {
  it('names a hotel, never its code, even in a column not marked as hotels', () => {
    // A custom query's column of codes, declared as plain text by the server.
    const rows = [{ hotel_code: 'LIS', room_nights: 2928 }];
    const codes: FigureTable = { callId: 'c5', title: 'Custom query', rows, columns: [
      { key: 'hotel_code', label: 'Code', kind: 'text' },
      { key: 'room_nights', label: 'Room nights', kind: 'count' },
    ] };
    const [figure] = quotedFigures('2,928 room nights.', [codes], context);
    expect(figure!.context).toBe('Arbor Lisbon Chiado');
  });
});
