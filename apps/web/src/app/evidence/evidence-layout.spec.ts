import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EvidenceLayout } from './evidence-layout';
import type { EvidenceEntry } from './types';

const production: EvidenceEntry = {
  callId: 'p1',
  name: 'get_account_production',
  args: { hotels: ['NYC'] },
  status: 'done',
  rows: [
    { account: 'Vantor Consulting', revenue_eur: 144102 },
    { account: 'Marlowe-Ito wedding', revenue_eur: 64418 },
  ],
  evidence: { sources: [], definitions: {}, period: null, sql: 'select 1', params: [], rowCount: 2, businessDate: '2026-11-20', notes: [], title: 'Account production' },
};

function render(inputs: Record<string, unknown>) {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(EvidenceLayout);
  fixture.componentRef.setInput('entries', [production]);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, about: () => el.querySelector('aside header p')?.textContent ?? null };
}

describe('EvidenceLayout', () => {
  it('says which answer it explains', () => {
    expect(render({ question: 'What happened with Vantor Consulting?' }).about()).toBe('For the answer to “What happened with Vantor Consulting?”');
  });

  it('names the chart when a chart was asked about, and follows it to the result it draws', () => {
    const { el, about } = render({ question: 'Show this as a chart', chart: 'Vantor Consulting revenue fell €1.35M', focusCallId: 'p1', focusColumns: ['account', 'revenue_eur'] });
    expect(about()).toBe('For the chart “Vantor Consulting revenue fell €1.35M”');
    const card = el.querySelector('[data-call="p1"]')!;
    expect(card.classList.contains('is-focus')).toBe(true);
    expect(card.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('says nothing under the title while there is nothing to explain', () => {
    expect(render({}).about()).toBeNull();
  });

  it('keeps a labelled button on the rail when the panel is folded away, and open() brings it back', () => {
    const { fixture, el } = render({ question: 'Why?' });
    el.querySelector<HTMLButtonElement>('button[aria-label="Hide how this was computed"]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('aside')).toBeNull();
    const rail = el.querySelector<HTMLButtonElement>('.sp-rail button')!;
    expect(rail.getAttribute('aria-label')).toBe('Show how this was computed');
    expect(rail.textContent!.trim()).toBe('how this was computed');
    fixture.componentInstance.open('p1');
    fixture.detectChanges();
    expect(el.querySelector('aside')).not.toBeNull();
  });
});
