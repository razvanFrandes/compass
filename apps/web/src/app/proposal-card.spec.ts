import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Proposal } from '@compass/contracts';
import { Live } from './live';
import { ProposalCard } from './proposal-card';

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

const LISBON: Proposal = {
  id: 'prop-1',
  workflowId: 'tpl-pace-guard',
  runId: 'run-1',
  hotel_code: 'LIS',
  action: 'adjust_bar',
  title: "Lower BAR on Lisbon's most overpriced nights to 1.2x comp median",
  rationale: 'LIS has 2,231 room nights on the books against 2,700 last year for the next 45 nights (-17.4%). BAR is above the comp median on every shop night through 2027-01-03.',
  change: { before: 'BAR 145–220 EUR, 1.10x–1.89x comp median', after: 'Cap at about 1.2x comp median', scope: 'LIS, all room types, stay dates 2026-11-20 to 2027-01-03' },
  impact_eur: 38_187,
  risk: 'high',
  status: 'pending',
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  decidedBy: null,
  decidedAt: null,
  note: null,
};

describe('ProposalCard', () => {
  const busy = signal<Record<string, string>>({});
  const decided: [string, boolean][] = [];
  const undone: string[] = [];
  const viewed: string[] = [];

  function render(over: Partial<Proposal> = {}) {
    const live = {
      busy,
      workflowList: signal([{ id: 'tpl-pace-guard', name: 'Pace guard' }]),
      decide: (p: Proposal, approved: boolean) => void decided.push([p.id, approved]),
      undo: (p: Proposal) => void undone.push(p.id),
      viewMessage: (p: Proposal) => void viewed.push(p.id),
    };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Live, useValue: live }] });
    const fixture = TestBed.createComponent(ProposalCard);
    fixture.componentRef.setInput('proposal', { ...LISBON, ...over });
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const buttons = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.dcard-actions button')];

  beforeEach(() => {
    busy.set({});
    decided.length = 0;
    undone.length = 0;
    viewed.length = 0;
  });

  it('reads as a suggestion for a person, with the hotel by name and no rate-desk shorthand', () => {
    const { el } = render();
    expect(text(el.querySelector('.dcard-status'))).toBe('Waiting for your decision · Arbor Lisbon Chiado');
    expect(text(el.querySelector('.dcard-kind'))).toBe('Price change · needs a person');
    expect(text(el.querySelector('h3'))).toBe("Suggestion: lower rates on Lisbon's most overpriced nights");
    expect(text(el.querySelector('.dcard-summary'))).toBe('Lisbon has 2,231 room nights on the books against 2,700 last year for the next 45 nights (−17.4%). The rate is above the competition on every night we checked through Sun 3 Jan. This could win back about €38k.');
    // Nothing struck through, no codes, no ISO dates, no "high risk" anywhere on the card.
    expect(el.querySelector('.line-through, s, del')).toBeNull();
    expect(text(el)).not.toMatch(/\bLIS\b|\d{4}-\d{2}-\d{2}|\bBAR\b|comp median|high risk|Approve|Decline/);
  });

  it('says that sending only hands over a task: Compass never changes the rates', () => {
    const { el } = render();
    expect(text(el.querySelector('.dcard-promise'))).toBe('This goes to your revenue manager as a task. Compass never changes your rates.');
    expect(buttons(el).map(text)).toEqual(['Send to revenue manager', 'Dismiss', 'See the reasoning']);
  });

  it('sends or dismisses, and says which while the answer is on its way', () => {
    const { fixture, el } = render();
    buttons(el)[0]!.click();
    buttons(el)[1]!.click();
    expect(decided).toEqual([['prop-1', true], ['prop-1', false]]);
    busy.set({ 'prop-1': 'Sending…' });
    fixture.detectChanges();
    expect(buttons(el).slice(0, 2).map((b) => [text(b), b.disabled])).toEqual([['Sending…', true], ['Dismiss', true]]);
    busy.set({ 'prop-1': 'Dismissing…' });
    fixture.detectChanges();
    expect(buttons(el).slice(0, 2).map(text)).toEqual(['Send to revenue manager', 'Dismissing…']);
  });

  it('keeps today → suggested, the nights and the full reasoning one step down', () => {
    const { fixture, el } = render();
    const why = buttons(el)[2]!;
    const panel = el.querySelector<HTMLElement>(`#${why.getAttribute('aria-controls')}`)!;
    expect(why.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);
    why.click();
    fixture.detectChanges();
    expect(why.getAttribute('aria-expanded')).toBe('true');
    expect(text(why)).toBe('Hide the reasoning');
    expect(panel.hidden).toBe(false);
    const pairs = [...panel.querySelectorAll('dt')].map((dt) => [text(dt), text(dt.nextElementSibling)]);
    expect(pairs).toEqual([
      ['Today', '€145–220 a night, up to 1.9× the competition'],
      ['→ Suggested', 'Cap at about 1.2× the competition'],
      ['Covers', 'Lisbon, all room types, stay dates Fri 20 Nov – Sun 3 Jan'],
      ['Why', expect.stringContaining('The rate is above the competition')],
    ]);
    expect(text(panel.querySelector('.dcard-from'))).toBe('Suggested by the agent “Pace guard”, 5 min ago.');
  });

  it('after sending: sent to the revenue manager, logged, with the message and Undo', () => {
    const { el } = render({ status: 'applied', decidedBy: 'Compass user (web)', decidedAt: new Date(Date.now() - 3 * 60_000).toISOString() });
    expect(text(el.querySelector('.dcard-status'))).toBe('Sent to the revenue manager · Arbor Lisbon Chiado');
    expect(text(el.querySelector('.dcard-done'))).toBe('Logged · 3 min ago');
    expect(text(el.querySelector('.dcard-promise'))).toMatch(/^This went to your revenue manager as a task\./);
    const [message, undo] = buttons(el);
    expect([text(message), text(undo)]).toEqual([expect.stringMatching(/^View message/), expect.stringMatching(/^Undo/)]);
    message!.click();
    undo!.click();
    expect(viewed).toEqual(['prop-1']);
    expect(undone).toEqual(['prop-1']);
    expect(el.querySelector('article')!.classList.contains('decision-card')).toBe(false);
  });

  it('after dismissing: nothing was sent, there is no message, and it can be taken back', () => {
    const { el } = render({ status: 'denied', decidedAt: new Date(Date.now() - 60 * 60_000).toISOString() });
    expect(text(el.querySelector('.dcard-status'))).toBe('Dismissed · Arbor Lisbon Chiado');
    expect(text(el.querySelector('.dcard-done'))).toBe('Nothing was sent · 1 h ago');
    expect(buttons(el).map(text)).toEqual([expect.stringMatching(/^Undo/), 'See the reasoning']);
    buttons(el)[0]!.click();
    expect(undone).toEqual(['prop-1']);
  });

  it('a task for the house is sent to the general manager', () => {
    const { el } = render({ action: 'create_task', risk: 'low', hotel_code: 'DPS', title: 'Add kitchen shifts for the weekend' });
    expect(buttons(el).map(text)).toEqual(['Send to general manager', 'Dismiss', 'See the reasoning']);
    expect(text(el.querySelector('.dcard-kind'))).toBe('Task · low risk');
  });

  it('names a deleted agent by the name it had', () => {
    const { el } = render({ workflowId: 'gone', deletedWorkflowName: 'Event pricing watch' });
    expect(text(el.querySelector('.dcard-from'))).toContain('“Event pricing watch”');
  });
});
