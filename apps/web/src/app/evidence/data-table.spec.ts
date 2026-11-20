import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DataTable, columnsThatFit, rowsToStartWith, turnsOnSide } from './data-table';
import type { EvidenceColumn, EvidenceRow } from './types';

function render(rows: EvidenceRow[], inputs: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(DataTable);
  fixture.componentRef.setInput('rows', rows);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const text = (selector: string) => Array.from(el.querySelectorAll(selector)).map((node) => node.textContent!.trim());
  const button = (name: string) => Array.from(el.querySelectorAll('button')).find((node) => node.textContent!.trim().startsWith(name))!;
  const click = (name: string) => {
    button(name).click();
    fixture.detectChanges();
  };
  return { fixture, el, text, button, click };
}

const pace: EvidenceRow[] = [
  { id: 'p:LIS', hotel_code: 'LIS', rooms_otb: 2928, pace_pct: -12.3, revenue_otb_eur: 485652 },
  { id: 'p:BER', hotel_code: 'BER', rooms_otb: 4120, pace_pct: 3.4, revenue_otb_eur: 612004 },
  { id: 'p:ZZZ', hotel_code: 'ZZZ', rooms_otb: 12, pace_pct: null, revenue_otb_eur: 900.5 },
];

describe('DataTable', () => {
  it('has human headers, a caption and column scopes, and hides internal columns', () => {
    const { el, text } = render(pace, { caption: 'Pace vs last year' });
    expect(text('thead th')).toEqual(['Hotel', 'Rooms on the books', 'Pace vs last year', 'Revenue on the books']);
    expect(el.querySelector('caption')!.textContent).toContain('Pace vs last year: 3 rows');
    expect(Array.from(el.querySelectorAll('thead th')).every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    expect(el.textContent).not.toContain('hotel_code');
    expect(el.textContent).not.toContain('p:LIS');
  });

  it('shows hotel names for codes, the code when it is unknown, and formatted values', () => {
    const { text } = render(pace);
    expect(text('tbody tr:nth-child(1) > *')).toEqual(['Arbor Lisbon Chiado', '2,928', '−12.3%', '€485,652']);
    // A column reads as one: money in whole euros once any value reaches 1,000.
    expect(text('tbody tr:nth-child(3) > *')).toEqual(['ZZZ', '12', '–', '€901']);
    expect(text('tbody th[scope=row]')).toHaveLength(3);
  });

  it('takes hotel names from GET /api/hotels once it answers', async () => {
    const { fixture, text } = render(pace);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/hotels')
      .flush([{ code: 'ZZZ', name: 'Kestrel Zurich See', city: 'Zurich', country: 'CH', region: 'Europe', brand: 'Kestrel', rooms: 120 }]);
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    expect(text('tbody tr:nth-child(3) th')).toEqual(['Kestrel Zurich See']);
  });

  it('right-aligns numeric columns only', () => {
    const { el } = render(pace);
    const numeric = Array.from(el.querySelectorAll('thead th')).map((th) => th.classList.contains('dt-num'));
    expect(numeric).toEqual([false, true, true, true]);
  });

  it("uses the server's column metadata: labels, units and hidden columns", () => {
    const columns: EvidenceColumn[] = [
      { key: 'pace_pct', label: 'Pace', kind: 'percent' },
      { key: 'hotel_code', label: 'Property', kind: 'hotel' },
      { key: 'rooms_otb', label: 'On the books', kind: 'count', unit: 'nights' },
      { key: 'revenue_otb_eur', label: 'Revenue', kind: 'currency', unit: 'EUR', hidden: true },
    ];
    const { text } = render(pace, { columns });
    // The column that names the row leads (it is the frozen one); the rest keep the server's order.
    expect(text('thead th')).toEqual(['Property', 'Pace', 'On the books (nights)']);
  });

  it('writes every number of a column the same way, so the figures line up', () => {
    const rows = [
      { hotel_code: 'LIS', pace_pct: -12.3, adr_eur: 196.5, bar_vs_comp: 1.04 },
      { hotel_code: 'BER', pace_pct: 5, adr_eur: 201, bar_vs_comp: 0.9 },
    ];
    const { text } = render(rows);
    expect(text('tbody tr:nth-child(1) td')).toEqual(['−12.3%', '€196.50', '1.04']);
    expect(text('tbody tr:nth-child(2) td')).toEqual(['5.0%', '€201.00', '0.90']);
  });

  it('keeps internal columns behind "More columns", last', () => {
    const { text, click, button } = render(pace);
    expect(button('More columns (1)').getAttribute('aria-expanded')).toBe('false');
    click('More columns (1)');
    expect(text('thead th')).toEqual(['Hotel', 'Rooms on the books', 'Pace vs last year', 'Revenue on the books', 'ID']);
    expect(text('tbody tr:nth-child(1) > *').at(-1)).toBe('p:LIS');
    expect(button('Fewer columns').getAttribute('aria-expanded')).toBe('true');
  });

  it('shows six columns at most, the rest behind "More columns"', () => {
    const wide = [1, 2].map((n) => ({ hotel_code: n === 1 ? 'LIS' : 'BER', a_eur: n, b_eur: n, c_eur: n, d_eur: n, e_eur: n, f_eur: n, g_eur: n }));
    const { text, click } = render(wide);
    expect(text('thead th')).toHaveLength(6);
    click('More columns (2)');
    expect(text('thead th')).toHaveLength(8);
  });

  it('hides a code beside its name and the country and currency of a hotel, and keeps a quoted column on screen', () => {
    const hotels = [
      { hotel_code: 'DPS', name: 'Lumen Bali Uluwatu', brand: 'Lumen', city: 'Bali', country: 'ID', region: 'Asia', currency: 'IDR', rooms: 200 },
      { hotel_code: 'SIN', name: 'Kestrel Singapore Marina', brand: 'Kestrel', city: 'Singapore', country: 'SG', region: 'Asia', currency: 'SGD', rooms: 280 },
    ];
    const columns: EvidenceColumn[] = [
      { key: 'hotel_code', label: 'Code', kind: 'text' },
      { key: 'name', label: 'Hotel', kind: 'text' },
      { key: 'brand', label: 'Brand', kind: 'text' },
      { key: 'city', label: 'City', kind: 'text' },
      { key: 'country', label: 'Country', kind: 'text' },
      { key: 'region', label: 'Region', kind: 'text' },
      { key: 'currency', label: 'Currency', kind: 'text' },
      { key: 'rooms', label: 'Rooms', kind: 'count' },
    ];
    expect(render(hotels, { columns }).text('thead th')).toEqual(['Hotel', 'Brand', 'City', 'Rooms']);
    TestBed.resetTestingModule();
    expect(render(hotels, { columns, prefer: ['currency'] }).text('thead th')).toEqual(['Hotel', 'Brand', 'City', 'Currency', 'Rooms']);
  });

  it('says once what every row shares instead of repeating it in a column', () => {
    const rows = [
      { hotel_code: 'LIS', stay_date: '2026-11-20', bar_rate: 200 },
      { hotel_code: 'LIS', stay_date: '2026-11-21', bar_rate: 220 },
    ];
    const { el, text } = render(rows);
    expect(text('thead th')).toEqual(['Stay date', 'BAR']);
    expect(el.querySelector('[data-shared]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Every row · Hotel: Arbor Lisbon Chiado');
    TestBed.resetTestingModule();
    // The host already says it (a card titled with the hotel): no line.
    expect(render(rows, { stated: ['hotel_code'] }).el.querySelector('[data-shared]')).toBeNull();
  });

  it('starts with a few rows and "Show all N rows" opens the rest', () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({ stay_date: `2026-11-${String(index + 1).padStart(2, '0')}`, bar_rate: 150 + index }));
    const { el, click, button } = render(rows);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(8);
    expect(el.textContent).toContain('First 8 of 30 rows');
    expect(button('Show all 30 rows').getAttribute('aria-expanded')).toBe('false');
    click('Show all 30 rows');
    expect(el.querySelectorAll('tbody tr')).toHaveLength(30);
    expect(button('Show the first 8').getAttribute('aria-expanded')).toBe('true');
  });

  it('sorts from a header: largest first for numbers, then smallest, then the original order', () => {
    const { el, text, click } = render(pace);
    const sortOf = () => Array.from(el.querySelectorAll('thead th')).map((th) => th.getAttribute('aria-sort'));
    const hotels = () => text('tbody th');
    expect(sortOf()).toEqual(['none', 'none', 'none', 'none']);

    click('Rooms on the books');
    expect(sortOf()[1]).toBe('descending');
    expect(hotels()).toEqual(['Tessera Berlin Mitte', 'Arbor Lisbon Chiado', 'ZZZ']);

    click('Rooms on the books');
    expect(sortOf()[1]).toBe('ascending');
    expect(hotels()).toEqual(['ZZZ', 'Arbor Lisbon Chiado', 'Tessera Berlin Mitte']);

    click('Rooms on the books');
    expect(sortOf()[1]).toBe('none');
    expect(hotels()).toEqual(['Arbor Lisbon Chiado', 'Tessera Berlin Mitte', 'ZZZ']);

    click('Hotel');
    expect(sortOf()[0]).toBe('ascending');
    expect(hotels()).toEqual(['Arbor Lisbon Chiado', 'Tessera Berlin Mitte', 'ZZZ']);
  });

  it('opens up to a highlighted row beyond the first page and marks its cell', () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({ stay_date: `2026-11-${String(index + 1).padStart(2, '0')}`, bar_rate: 150 + index }));
    const { fixture, el } = render(rows, { highlight: { rowIndex: 15, key: 'bar_rate' } });
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr')).toHaveLength(20);
    expect(el.querySelector('tr.dt-hit .dt-hit-cell')!.textContent!.trim()).toBe('165');
  });

  it('leads with the column that tells the rows apart', () => {
    const rows = [
      { stay_date: '2026-11-20', segment: 'Corporate', bar_rate: 200 },
      { stay_date: '2026-11-20', segment: 'Leisure', bar_rate: 220 },
      { stay_date: '2026-11-21', segment: 'Leisure', bar_rate: 230 },
    ];
    expect(render(rows).text('thead th')).toEqual(['Stay date', 'Segment', 'BAR']);
    TestBed.resetTestingModule();
    const oneHotel = [
      { hotel_code: 'LIS', stay_date: '2026-11-20', bar_rate: 200 },
      { hotel_code: 'LIS', stay_date: '2026-11-21', bar_rate: 220 },
    ];
    expect(render(oneHotel).text('thead th')[0]).toBe('Stay date');
    TestBed.resetTestingModule();
    expect(render([oneHotel[0]!]).text('thead th')).toEqual(['Hotel', 'Stay date', 'BAR']);
  });

  describe('the rows the answer quotes', () => {
    const accounts = ['Vantor Consulting', 'Marlowe-Ito wedding', 'Brightwave Media', 'Nordic Data Alliance', 'Orion Robotics'].map((account, index) => ({ account, revenue_eur: 144102 + index * 1000, revenue_change_eur: -1351390 + index * 900000 }));

    it('starts with those rows alone, and "Show all N rows" brings the others with the quoted ones marked', () => {
      const { el, text, click, button } = render(accounts, { quotedRows: [3, 0] });
      expect(text('tbody th')).toEqual(['Vantor Consulting', 'Nordic Data Alliance']);
      expect(el.textContent).toContain('2 of 5 rows: the ones the answer quotes');
      expect(el.querySelectorAll('tr.dt-quoted')).toHaveLength(0);

      click('Show all 5 rows');
      expect(el.querySelectorAll('tbody tr')).toHaveLength(5);
      expect(Array.from(el.querySelectorAll('tr.dt-quoted th .dt-clip')).map((node) => node.textContent)).toEqual(['Vantor Consulting', 'Nordic Data Alliance']);
      expect(el.querySelector('tr.dt-quoted th')!.textContent).toContain('(quoted in the answer)');
      expect(button('Show only the 2 quoted rows').getAttribute('aria-expanded')).toBe('true');

      click('Show only the 2 quoted rows');
      expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    });

    it('says "the one" for a single quoted row', () => {
      const { el } = render(accounts, { quotedRows: [0] });
      expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(el.textContent).toContain('1 of 5 rows: the one the answer quotes');
    });

    it('opens up for a figure in a row that is not among them', () => {
      const { fixture, el } = render(accounts, { quotedRows: [0], highlight: { rowIndex: 4, key: 'revenue_eur' } });
      fixture.detectChanges();
      expect(el.querySelectorAll('tbody tr')).toHaveLength(5);
      expect(el.querySelector('tr.dt-hit .dt-hit-cell')!.textContent!.trim()).toBe('€148,102');
    });

    it('shows every row from the start when asked to (a chart draws them all)', () => {
      const { el } = render(accounts, { quotedRows: [0], allRows: true });
      expect(el.querySelectorAll('tbody tr')).toHaveLength(5);
      expect(el.querySelectorAll('tr.dt-quoted')).toHaveLength(1);
    });

    it('pages as usual when the answer quotes every row, or none', () => {
      expect(rowsToStartWith(30, [], 8)).toEqual({ indices: [0, 1, 2, 3, 4, 5, 6, 7], quotedOnly: false });
      expect(rowsToStartWith(2, [0, 1], 8)).toEqual({ indices: [0, 1], quotedOnly: false });
      expect(rowsToStartWith(10, [4, 1, 4, 99, -1], 8)).toEqual({ indices: [1, 4], quotedOnly: true });
    });
  });

  describe('the width of the box', () => {
    it('decides how many columns show without scrolling: four at least, six at most', () => {
      expect(columnsThatFit(0)).toBe(6);
      expect(columnsThatFit(320)).toBe(4);
      expect(columnsThatFit(460)).toBe(4);
      expect(columnsThatFit(580)).toBe(5);
      expect(columnsThatFit(1200)).toBe(6);
    });

    it('turns a few quoted rows on their side when their columns do not fit as a table', () => {
      // The Vantor answer: two quoted accounts, the account and six quoted figures, in a 460px panel.
      expect(turnsOnSide(460, 2, 7)).toBe(true);
      // Wide enough for the table as it is, or too many rows to stand side by side.
      expect(turnsOnSide(900, 2, 7)).toBe(false);
      expect(turnsOnSide(460, 3, 7)).toBe(false);
      expect(turnsOnSide(460, 2, 3)).toBe(false);
      expect(turnsOnSide(0, 2, 7)).toBe(false);
    });
  });

  it('says so when there are no rows', () => {
    const { el } = render([]);
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('No rows came back');
  });
});
