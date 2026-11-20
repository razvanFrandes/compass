import { TestBed } from '@angular/core/testing';
import { KassandraEvidencePending } from './kassandra-evidence-pending';
import type { EvidenceSlot } from './live-slots';

function render(slots: EvidenceSlot[], held: string[] = []) {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(KassandraEvidencePending);
  fixture.componentRef.setInput('slots', slots);
  fixture.componentRef.setInput('held', new Set(held));
  fixture.detectChanges();
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll('li')].map((row) => ({ phase: row.getAttribute('data-phase'), text: row.textContent?.replace(/\s+/g, ' ').trim(), bones: row.querySelectorAll('.k-skel').length }));
}

describe('KassandraEvidencePending', () => {
  it('shows a skeleton row for a call that has only started, and its title once the arguments are known', () => {
    const rows = render([
      { callId: 'c1', phase: 'described', title: 'Pace vs last year', detail: 'LIS · 1 Dec · 31 Dec' },
      { callId: 'c2', phase: 'chosen', title: null, detail: '' },
    ]);
    expect(rows).toEqual([
      { phase: 'described', text: 'Pace vs last yearLIS · 1 Dec · 31 Dec · Reading the data…', bones: 1 },
      { phase: 'chosen', text: 'Kassandra is reading data', bones: 3 },
    ]);
  });

  it('gives way to the evidence card once the result is in, unless its skeleton has only just appeared', () => {
    const ready: EvidenceSlot = { callId: 'c1', phase: 'ready', title: 'Pace vs last year', detail: 'LIS' };
    expect(render([ready])).toEqual([]);
    expect(render([ready], ['c1']).map((row) => row.phase)).toEqual(['described']);
  });
});
