import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DataTable } from './data-table';
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
    expect(text('tbody tr:nth-child(3) > *')).toEqual(['ZZZ', '12', '–', '€900.50']);
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

  it("uses the server's column metadata: labels, units, order and hidden columns", () => {
    const columns: EvidenceColumn[] = [
      { key: 'pace_pct', label: 'Pace', kind: 'percent' },
      { key: 'hotel_code', label: 'Property', kind: 'hotel' },
      { key: 'rooms_otb', label: 'On the books', kind: 'count', unit: 'nights' },
      { key: 'revenue_otb_eur', label: 'Revenue', kind: 'currency', unit: 'EUR', hidden: true },
    ];
    const { text } = render(pace, { columns });
    expect(text('thead th')).toEqual(['Pace', 'Property', 'On the books (nights)']);
  });

  it('shows internal columns on request', () => {
    const { text, click, button } = render(pace);
    expect(button('Show 1 internal column')).toBeTruthy();
    click('Show 1 internal column');
    expect(text('thead th')[0]).toBe('ID');
    expect(text('tbody tr:nth-child(1) > *')[0]).toBe('p:LIS');
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

  it('leads with the column that tells the rows apart when the first one never changes', () => {
    const rows = [
      { hotel_code: 'LIS', stay_date: '2026-11-20', bar_rate: 200 },
      { hotel_code: 'LIS', stay_date: '2026-11-21', bar_rate: 220 },
    ];
    expect(render(rows).text('thead th')).toEqual(['Stay date', 'Hotel', 'BAR']);
    TestBed.resetTestingModule();
    expect(render([rows[0]!]).text('thead th')).toEqual(['Hotel', 'Stay date', 'BAR']);
  });

  it('says so when there are no rows', () => {
    const { el } = render([]);
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('No rows came back');
  });
});
