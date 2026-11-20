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
const brief: EvidenceEntry = {
  callId: 'c2',
  name: 'get_brief',
  args: {},
  status: 'done',
  rows: [{ id: 'data_stale:BER:POS', kind: 'data_stale', hotel_code: 'BER', severity: 'critical', impact_eur: null }],
  evidence: evidence({ sources: ['hotel.data_sources', 'hotel.v_hotel_day'], definitions: {}, notes: ['Forecast made on 2026-11-20 (rooms_actual).'] }),
};

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

  it('falls back to key figures when the answer quotes nothing it can trace', () => {
    const { el } = render([pace], { answer: 'Lisbon is behind last year.' });
    expect(el.querySelector('h3')!.textContent).toBe('Key figures');
    expect(el.querySelectorAll('.ev-figure')).toHaveLength(2);
  });

  it('shows one closed card per tool call, with a human title and no raw names', () => {
    const { el, heads } = render([pace, brief]);
    expect(heads().map(words)).toEqual(['Pace vs last year Arbor Lisbon Chiado · 1 row', 'Morning brief 1 row']);
    expect(heads().every((head) => head.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(el.querySelector('table')).toBeNull();
    for (const raw of ['get_pace', 'Get pace', '· 45', 'hotel_code', 'hotel.', 'data_stale']) expect(el.textContent).not.toContain(raw);
  });

  it('opens a card to the business date in words, sources by name and the table; raw names stay in Technical details', () => {
    const { fixture, el, heads } = render([pace, brief]);
    heads()[1]!.click();
    fixture.detectChanges();
    const card = el.querySelector<HTMLElement>('[data-call="c2"]')!;
    expect(heads()[1]!.getAttribute('aria-expanded')).toBe('true');
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
    const { el, heads } = render([pace, brief], { focusCallId: 'c2' });
    expect(heads().map((head) => head.getAttribute('aria-expanded'))).toEqual(['false', 'true']);
    expect(el.querySelector('[data-call="c2"]')!.classList.contains('is-focus')).toBe(true);
    expect(el.querySelector('#ev-c2')).not.toBeNull();
  });

  it('a figure opens its card and points at the cell', () => {
    const { fixture, el } = render([pace], { answer: 'Lisbon is 12.3% behind.' });
    el.querySelector<HTMLButtonElement>('.ev-figure')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.ev-head')!.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('.dt-hit-cell')!.textContent!.trim()).toBe('−12.3%');
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
});
