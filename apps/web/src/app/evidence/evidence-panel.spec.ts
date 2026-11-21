import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EvidencePanel } from './evidence-panel';
import type { EvidenceEntry, RichEvidence } from './types';

const evidence = (patch: Partial<RichEvidence> = {}): RichEvidence => ({
  sources: ['hotel.pace_vs_stly()'],
  definitions: { pace: 'Room nights on the books vs the same point last year.' },
  period: null,
  sql: 'select hotel_code from hotel.pace_vs_stly(null, $1::int)',
  params: [45, ['LIS']],
  rowCount: 1,
  businessDate: '2026-11-20',
  notes: [],
  ...patch,
});

const pace: EvidenceEntry = {
  callId: 'c1',
  name: 'get_pace',
  args: { hotels: ['LIS'], days: 45 },
  status: 'done',
  rows: [{ hotel_code: 'LIS', rooms_otb: 2928, rooms_otb_stly: 3337, pace_pct: -12.3 }],
  evidence: evidence(),
};
const forecast: EvidenceEntry = {
  callId: 'c6',
  name: 'get_forecast',
  args: {},
  status: 'done',
  rows: [{ period: '2026-12-01', key: 'LIS', rooms_on_books: 1286 }],
  evidence: evidence({ sources: ['hotel.forecasts'], definitions: {} }),
};
const brief: EvidenceEntry = {
  callId: 'c2',
  name: 'get_brief',
  args: {},
  status: 'done',
  rows: [{ id: 'data_stale:BER:POS', kind: 'data_stale', hotel_code: 'BER', severity: 'critical', impact_eur: null }],
  evidence: evidence({ sources: ['hotel.data_sources', 'hotel.v_hotel_day'], definitions: {}, notes: ['Forecast made on 2026-11-20 (rooms_actual).'] }),
};

/* The owner's case: Kassandra looks up the hotel list, reads the account production and checks data freshness. */
const hotels: EvidenceEntry = {
  callId: 'h1',
  name: 'list_hotels',
  args: {},
  status: 'done',
  rows: [
    { hotel_code: 'NYC', name: 'Arbor New York Midtown', brand: 'Arbor', city: 'New York', country: 'US', region: 'Americas', currency: 'USD', rooms: 477 },
    { hotel_code: 'LIS', name: 'Arbor Lisbon Chiado', brand: 'Arbor', city: 'Lisbon', country: 'PT', region: 'Europe', currency: 'EUR', rooms: 150 },
  ],
  evidence: evidence({
    title: 'Hotels of the group',
    sources: ['hotel.hotels'],
    definitions: {},
    rowCount: 2,
    columns: [
      { key: 'hotel_code', label: 'Code', kind: 'text' },
      { key: 'name', label: 'Hotel', kind: 'text' },
      { key: 'brand', label: 'Brand', kind: 'text' },
      { key: 'city', label: 'City', kind: 'text' },
      { key: 'country', label: 'Country', kind: 'text' },
      { key: 'region', label: 'Region', kind: 'text' },
      { key: 'currency', label: 'Currency', kind: 'text' },
      { key: 'rooms', label: 'Rooms', kind: 'count' },
    ],
  }),
};
const production: EvidenceEntry = {
  callId: 'p1',
  name: 'get_account_production',
  args: { hotels: ['NYC'], from: '2026-05-21', to: '2026-11-20' },
  status: 'done',
  rows: [
    { hotel_code: 'NYC', account: 'Vantor Consulting', room_nights: 477, previous_room_nights: 5504, revenue_eur: 144102, previous_revenue_eur: 1495492, revenue_change_eur: -1351390 },
    { hotel_code: 'NYC', account: 'Marlowe-Ito wedding', room_nights: 286, previous_room_nights: 686, revenue_eur: 64418, previous_revenue_eur: 145286, revenue_change_eur: -80868 },
    { hotel_code: 'NYC', account: 'Brightwave Media', room_nights: 410, previous_room_nights: 455, revenue_eur: 94323, previous_revenue_eur: 106840, revenue_change_eur: -12517 },
  ],
  evidence: evidence({ title: 'Account production', sources: ['hotel.reservations'], definitions: {}, rowCount: 3, period: { from: '2026-05-21', to: '2026-11-20' } }),
};
const health: EvidenceEntry = {
  callId: 'd1',
  name: 'get_data_health',
  args: { hotels: ['NYC'] },
  status: 'done',
  rows: [{ hotel_code: 'NYC', system: 'PMS', status: 'ok' }],
  evidence: evidence({ title: 'Data freshness', sources: ['hotel.data_sources'], definitions: {} }),
};
const VANTOR = 'Room nights fell from 5,504 to 477. Revenue fell from €1,495,492 to €144,102, a drop of €1,351,390. The next largest is the Marlowe-Ito wedding, down €80,868.';

/** The text of a node as a person reads it: its pieces, one space apart. */
function words(node: Element): string {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent!.trim();
    if (text) parts.push(text);
  }
  return parts.join(' ');
}

function render(entries: EvidenceEntry[], inputs: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(EvidencePanel);
  fixture.componentRef.setInput('entries', entries);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const heads = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.ev-head'));
  return { fixture, el, heads };
}

describe('EvidencePanel', () => {
  it('is a compact region wherever it is shown', () => {
    const { el } = render([pace]);
    expect(el.getAttribute('data-density')).toBe('compact');
  });

  it('leads with the numbers the answer quotes', () => {
    const { el } = render([pace, brief], { answer: 'Lisbon is 12.3% behind: 2,928 room nights against 3,337 last year.' });
    expect(el.querySelector('h3')!.textContent).toBe('Numbers in this answer');
    const figures = Array.from(el.querySelectorAll('.ev-figure')).map(words);
    expect(figures).toEqual([
      '−12.3% Pace vs last year Arbor Lisbon Chiado Show this figure in Pace vs last year',
      '2,928 Rooms on the books Arbor Lisbon Chiado Show this figure in Pace vs last year',
      '3,337 Same time last year Arbor Lisbon Chiado Show this figure in Pace vs last year',
    ]);
  });

  it('lists no figures when the answer quotes nothing it can trace', () => {
    const { el } = render([pace], { answer: 'Lisbon is behind last year.' });
    expect(el.querySelector('.ev-figure')).toBeNull();
    expect(el.textContent).not.toContain('Key figures');
    expect(el.textContent).not.toContain('Numbers in this answer');
  });

  it('never makes figures of the hotel list when the data read failed (the owner\'s channel mix answer)', () => {
    const bali: EvidenceEntry = {
      ...hotels,
      rows: [
        { hotel_code: 'DPS', name: 'Lumen Bali Uluwatu', brand: 'Lumen', city: 'Bali', country: 'ID', region: 'Asia', currency: 'IDR', rooms: 200, meeting_space_sqm: 400 },
        { hotel_code: 'BCN', name: 'Lumen Barcelona Mar', brand: 'Lumen', city: 'Barcelona', country: 'ES', region: 'Europe', currency: 'EUR', rooms: 300, meeting_space_sqm: 1200 },
      ],
    };
    const mix: EvidenceEntry = { callId: 'm1', name: 'get_mix', args: { hotels: ['BCN'], by: 'channel' }, status: 'error', error: 'The data source failed to answer.' };
    const { el } = render([bali, mix], { answer: "I can't give you the channel mix for Lumen Barcelona Mar right now." });
    expect(el.querySelector('.ev-figure')).toBeNull();
    expect(el.textContent).not.toContain('Key figures');
    for (const raw of ['200', '400', 'DPS']) expect(el.textContent).not.toContain(raw);
  });

  it('without an answer (a run log), shows closed cards with human titles and no raw names', () => {
    const { el, heads } = render([pace, forecast]);
    expect(heads().map(words)).toEqual(['Pace vs last year Arbor Lisbon Chiado · 1 row', 'Forecast 1 row']);
    expect(heads().every((head) => head.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(el.querySelector('table')).toBeNull();
    for (const raw of ['get_pace', 'Get pace', '· 45', 'hotel_code', 'hotel.', 'get_forecast']) expect(el.textContent).not.toContain(raw);
  });

  describe('what fed the answer, and what was only looked up', () => {
    it('leads with the result that backs the numbers, open, and never with the hotel list', () => {
      const { el, heads } = render([hotels, production, health], { answer: VANTOR });
      expect(heads().map(words)).toEqual([
        'Account production Arbor New York Midtown · 21 May – 20 Nov 2026 · 3 rows',
        'Lookups Kassandra also looked up the hotel list and checked data freshness',
      ]);
      expect(heads().map((head) => head.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
      // The lookup's rows are not on screen at all until it is opened.
      expect(el.textContent).not.toContain('Arbor Lisbon Chiado');
      expect(el.textContent).not.toContain('Hotels of the group');
    });

    it('never traces a number of the answer to a lookup table', () => {
      // 477 is also the number of rooms of the New York hotel in the hotel list.
      const { el } = render([hotels, production, health], { answer: VANTOR });
      const sources = Array.from(el.querySelectorAll('.ev-figure .sr-only')).map((node) => node.textContent);
      expect(sources).toHaveLength(6);
      expect(new Set(sources)).toEqual(new Set(['Show this figure in Account production']));
    });

    it('starts the table with the rows the answer quotes and the columns it quotes', () => {
      const { el } = render([hotels, production, health], { answer: VANTOR });
      const card = el.querySelector<HTMLElement>('[data-call="p1"]')!;
      expect(Array.from(card.querySelectorAll('tbody th .dt-clip')).map((node) => node.textContent)).toEqual(['Vantor Consulting', 'Marlowe-Ito wedding']);
      expect(card.textContent).toContain('2 of 3 rows: the ones the answer quotes');
      expect(Array.from(card.querySelectorAll('thead th')).map((th) => th.textContent!.trim())).toEqual(['Account', 'Room nights', 'Previous room nights', 'Revenue', 'Previous revenue', 'Revenue change']);
      // The hotel is in the card's title: it is neither a column nor repeated above the table.
      expect(card.querySelector('[data-shared]')).toBeNull();
    });

    it('orders the results by how many numbers of the answer they back', () => {
      const { heads } = render([pace, production], { answer: VANTOR + ' Lisbon is 12.3% behind.' });
      expect(heads().map((head) => words(head).split(' Arbor')[0])).toEqual(['Account production', 'Pace vs last year']);
      expect(heads().map((head) => head.getAttribute('aria-expanded'))).toEqual(['true', 'true']);
    });

    it('opens the lookups on request, each lookup still closed', () => {
      const { fixture, el, heads } = render([hotels, production, health], { answer: VANTOR });
      heads()[1]!.click();
      fixture.detectChanges();
      expect(heads().map((head) => words(head).split(' ')[0])).toEqual(['Account', 'Lookups', 'Hotels', 'Data']);
      expect(heads().map((head) => head.getAttribute('aria-expanded'))).toEqual(['true', 'true', 'false', 'false']);
      heads()[2]!.click();
      fixture.detectChanges();
      const lookup = el.querySelector<HTMLElement>('[data-call="h1"]')!;
      expect(Array.from(lookup.querySelectorAll('thead th')).map((th) => th.textContent!.trim())).toEqual(['Hotel', 'City', 'Region', 'Rooms']);
      expect(lookup.textContent).toContain('Data as of Fri 20 Nov');
      expect(lookup.textContent).not.toContain('actuals');
    });

    it('opens the lookups for a lookup that is asked for by its call', () => {
      const { el } = render([hotels, production, health], { answer: VANTOR, focusCallId: 'd1' });
      expect(el.querySelector('[data-lookups] > h4 button')!.getAttribute('aria-expanded')).toBe('true');
      expect(el.querySelector('[data-call="d1"]')!.classList.contains('is-focus')).toBe(true);
      expect(el.querySelector('[data-call="d1"] .ev-head')!.getAttribute('aria-expanded')).toBe('true');
    });

    it('shows a lookup table as the data when a finished answer read nothing else, and holds it back while one is on its way', () => {
      expect(render([hotels], { answer: 'The group has two hotels.' }).heads().map((head) => words(head).split(' ')[0])).toEqual(['Hotels']);
      TestBed.resetTestingModule();
      const running: EvidenceEntry = { callId: 'p9', name: 'get_account_production', args: {}, status: 'running' };
      const { el, heads } = render([hotels, running]);
      expect(Array.from(el.querySelectorAll('ol > li')).map(words)).toEqual(['Account production Reading the data…']);
      expect(heads().map(words)).toEqual(['Lookups Kassandra also looked up the hotel list']);
    });

    it('lets the person close a card that opened by itself', () => {
      const { fixture, el, heads } = render([hotels, production, health], { answer: VANTOR });
      heads()[0]!.click();
      fixture.detectChanges();
      expect(heads()[0]!.getAttribute('aria-expanded')).toBe('false');
      expect(el.querySelector('table')).toBeNull();
    });
  });

  describe('a chart that was asked about', () => {
    it('opens and marks the result the chart draws, with the chart’s columns and every row', () => {
      const { el } = render([production], { answer: 'I’ve added the chart above.\nVantor Consulting revenue fell €1.35M', focusCallId: 'p1', focusColumns: ['account', 'revenue_eur', 'previous_revenue_eur'] });
      const card = el.querySelector<HTMLElement>('[data-call="p1"]')!;
      expect(card.classList.contains('is-focus')).toBe(true);
      const headers = Array.from(card.querySelectorAll('thead th')).map((th) => th.textContent!.trim());
      for (const drawn of ['Account', 'Revenue', 'Previous revenue', 'Revenue change']) expect(headers).toContain(drawn);
      expect(card.querySelectorAll('tbody tr')).toHaveLength(3);
      // The row the chart's title quotes is marked among the others.
      expect(card.querySelector('tr.dt-quoted .dt-clip')!.textContent).toBe('Vantor Consulting');
      expect(Array.from(el.querySelectorAll('.ev-figure')).map((figure) => words(figure).split(' ')[0])).toEqual(['−€1,351,390']);
    });
  });

  it('opens a card to the business date in words, sources by name and the table; raw names stay in Technical details', () => {
    const { fixture, el, heads } = render([brief]);
    heads()[0]!.click();
    fixture.detectChanges();
    const card = el.querySelector<HTMLElement>('[data-call="c2"]')!;
    expect(heads()[0]!.getAttribute('aria-expanded')).toBe('true');
    expect(card.textContent).toContain('Data as of Fri 20 Nov · earlier stays are actuals, later ones on the books');
    expect(Array.from(card.querySelectorAll('dd .ev-chip')).map((chip) => chip.textContent)).toEqual(['Data feed status', 'Daily hotel performance']);
    expect(card.textContent).toContain('Forecast made on 20 Nov (rooms actual).');
    expect(card.querySelector('tbody')!.textContent).toContain('Tessera Berlin Mitte');
    expect(card.querySelector('tbody')!.textContent).not.toContain('data_stale:BER:POS');

    const details = card.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')!.textContent!.trim()).toBe('Technical details');
    expect(Array.from(details.querySelectorAll('code')).map((code) => code.textContent)).toEqual(['hotel.data_sources', 'hotel.v_hotel_day']);
    expect(details.querySelector('pre')!.textContent).toContain('select hotel_code');
    // Outside the disclosure, no raw source name.
    const outside = card.cloneNode(true) as HTMLElement;
    outside.querySelector('details')!.remove();
    expect(outside.textContent).not.toContain('hotel.');
  });

  it("uses the server's title, column labels and source labels when it sends them", () => {
    const rich: EvidenceEntry = {
      ...pace,
      evidence: evidence({
        title: 'Pace for the next 45 nights',
        sourceLabels: { 'hotel.pace_vs_stly()': 'Pace snapshots' },
        columns: [
          { key: 'hotel_code', label: 'Property', kind: 'hotel' },
          { key: 'pace_pct', label: 'Pace', kind: 'percent' },
        ],
      }),
    };
    const { el } = render([rich], { focusCallId: 'c1' });
    expect(el.querySelector('.ev-head')!.textContent).toContain('Pace for the next 45 nights');
    expect(el.querySelector('dd .ev-chip')!.textContent).toBe('Pace snapshots');
    expect(Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent!.trim())).toEqual(['Property', 'Pace']);
  });

  it('opens and marks the card named by focusCallId', () => {
    const { el, heads } = render([pace, forecast], { focusCallId: 'c6' });
    expect(heads().map((head) => head.getAttribute('aria-expanded'))).toEqual(['false', 'true']);
    expect(el.querySelector('[data-call="c6"]')!.classList.contains('is-focus')).toBe(true);
    expect(el.querySelector('#ev-c6')).not.toBeNull();
  });

  it('opens a card that was asked for while its result was still on its way, once it lands', () => {
    const { fixture, el } = render([{ ...forecast, evidence: undefined, rows: undefined, status: 'running' }], { focusCallId: 'c6' });
    expect(el.querySelector('[data-call="c6"]')).toBeNull();
    fixture.componentRef.setInput('entries', [forecast]);
    fixture.detectChanges();
    expect(el.querySelector('[data-call="c6"] .ev-head')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('a figure opens its card and points at the cell', () => {
    const { fixture, el } = render([pace], { answer: 'Lisbon is 12.3% behind.' });
    el.querySelector<HTMLButtonElement>('.ev-figure')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.ev-head')!.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('.dt-hit-cell')!.textContent!.trim()).toBe('−12.3%');
  });

  it('reveals the card that was asked for once, not again when another result arrives', () => {
    const { fixture, heads } = render([pace, forecast], { focusCallId: 'c6' });
    heads()[1]!.click();
    fixture.detectChanges();
    expect(heads()[1]!.getAttribute('aria-expanded')).toBe('false');
    fixture.componentRef.setInput('entries', [pace, forecast, { callId: 'c8', name: 'get_pnl', args: {}, status: 'running' }]);
    fixture.detectChanges();
    expect(heads()[1]!.getAttribute('aria-expanded')).toBe('false');
  });

  it('holds a place for a data call still running, and says when one failed', () => {
    const running: EvidenceEntry = { callId: 'c3', name: 'get_forecast', args: {}, status: 'running' };
    const failed: EvidenceEntry = { callId: 'c4', name: 'get_pnl', args: {}, status: 'error', error: 'timeout' };
    const other: EvidenceEntry = { callId: 'c5', name: 'draft_workflow', args: {}, status: 'running' };
    const { el } = render([pace, running, failed, other]);
    const items = Array.from(el.querySelectorAll('ol > li')).map(words);
    expect(items).toHaveLength(3);
    expect(items[1]).toBe('Forecast Reading the data…');
    expect(items[2]).toBe('Profit and loss Couldn’t read this, so the answer doesn’t use it. Ask again to retry.');
  });

  it('says where evidence will appear when there is none', () => {
    const { el } = render([]);
    expect(el.textContent).toContain('Each number in the answer shows its source, period and definition here.');
  });

  it('never shows that for an answer that used tools: it says the answer read no data', () => {
    const { el } = render([{ callId: 'c7', name: 'draft_workflow', args: {}, status: 'done' }], { answer: 'I drafted the agent.' });
    expect(el.textContent).not.toContain('will show where they came from');
    expect(el.textContent).toContain('This answer read no data, so there is nothing to trace.');
  });
});
