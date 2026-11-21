import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DecisionReceipt, Proposal } from '@compass/contracts';
import { HandoverSheet } from './handover-sheet';
import { Live } from './live';
import { CompassStore } from './store';

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

const SENT: Proposal = {
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
  status: 'applied',
  createdAt: '2026-11-20T22:35:00.000Z',
  decidedBy: 'Compass user (web)',
  decidedAt: '2026-11-21T00:45:00.000Z',
  note: null,
};
const RECEIPT: DecisionReceipt = {
  proposal: SENT,
  handedTo: { name: 'Ana Pop', email: 'ana.pop@halcyon.example.com', role: 'revenue_manager', roleLabel: 'Revenue manager', hotel: 'Arbor Lisbon Chiado', hotel_code: 'LIS' },
  receipt: 'RMS task rms-mwpk3x-4 for Ana Pop (Revenue manager, Arbor Lisbon Chiado): Lower BAR … .',
};

describe('HandoverSheet', () => {
  const message = signal<DecisionReceipt | null>(null);
  const opened: [string, string][] = [];

  function render() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Live, useValue: { message } }, { provide: CompassStore, useValue: { openWatcher: (id: string, section: string) => void opened.push([id, section]) } }],
    });
    const fixture = TestBed.createComponent(HandoverSheet);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, dialog: el.querySelector('dialog')! };
  }

  beforeEach(() => {
    message.set(null);
    opened.length = 0;
  });

  it('is closed until a message is asked for, then opens as a modal named by its subject', () => {
    const { fixture, dialog } = render();
    expect(dialog.open).toBe(false);
    message.set(RECEIPT);
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe('hand-title');
    expect(text(dialog.querySelector('#hand-title'))).toBe("Suggestion for Arbor Lisbon Chiado: lower rates on Lisbon's most overpriced nights");
  });

  it('shows who it went to, when, the suggestion and the reasoning in plain words', () => {
    const { fixture, dialog } = render();
    message.set(RECEIPT);
    fixture.detectChanges();
    const meta = Object.fromEntries([...dialog.querySelectorAll('.hand-meta > div')].map((row) => [text(row.querySelector('dt')), text(row.querySelector('dd'))]));
    expect(meta['To']).toBe('Ana Pop, Revenue manager · Arbor Lisbon Chiado ana.pop@halcyon.example.com');
    expect(meta['From']).toBe('Compass, sent on by you');
    expect(meta['Sent']).toMatch(/21 Nov 2026, \d{2}:45 · task rms-mwpk3x-4$/);
    expect(text(dialog.querySelector('.hand-suggestion'))).toBe("Lower rates on Lisbon's most overpriced nights");
    const plan = Object.fromEntries([...dialog.querySelectorAll('.hand-plan > div')].map((row) => [text(row.querySelector('dt')), text(row.querySelector('dd'))]));
    expect(plan['Today']).toBe('€145–220 a night, up to 1.9× the competition');
    expect(plan['Suggested']).toBe('Cap at about 1.2× the competition');
    expect(plan['Covers']).toBe('Lisbon, all room types, stay dates Fri 20 Nov – Sun 3 Jan');
    expect(plan['The reasoning']).toContain('2,231 room nights on the books against 2,700 last year');
    expect(text(dialog)).not.toMatch(/\bLIS\b|\d{4}-\d{2}-\d{2}|\bBAR\b|comp median/);
  });

  it('says at its foot what the demo does and does not do', () => {
    const { fixture, dialog } = render();
    message.set(RECEIPT);
    fixture.detectChanges();
    expect(text(dialog.querySelector('.hand-foot p'))).toBe('Demo: Compass hands this to your RMS and revenue manager as a task. Compass never changes your rates. No email is sent, and the people in the demo team are fictional.');
  });

  it('the evidence link opens the agent’s run history and closes the sheet', () => {
    const { fixture, dialog } = render();
    message.set(RECEIPT);
    fixture.detectChanges();
    const link = dialog.querySelector<HTMLAnchorElement>('.hand-link')!;
    expect(link.getAttribute('href')).toBe('/studio/tpl-pace-guard');
    link.click();
    fixture.detectChanges();
    expect(opened).toEqual([['tpl-pace-guard', 'history']]);
    expect(dialog.open).toBe(false);
  });

  it('Close closes it and clears the message, so the same one can be opened again', () => {
    const { fixture, dialog } = render();
    message.set(RECEIPT);
    fixture.detectChanges();
    [...dialog.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === 'Close')!.click();
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
    expect(message()).toBeNull();
  });

  it('a hotel without a roster entry names the role, not a person', () => {
    const { fixture, dialog } = render();
    message.set({ ...RECEIPT, handedTo: null });
    fixture.detectChanges();
    expect(text(dialog.querySelector('.hand-meta dd'))).toBe('The revenue manager · Arbor Lisbon Chiado');
  });
});
