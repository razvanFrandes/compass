import { Component, input } from '@angular/core';
import { ChatStep } from './api';
import { EvidencePanel as JuyoEvidencePanel } from './evidence';

/**
 * The earlier name of the evidence panel, kept for the screens that still use it (a workflow run's log). It only
 * forwards to `<juyo-evidence-panel>` (src/app/evidence), so those screens get the same cards and tables.
 * New code uses `<juyo-evidence-panel>` or `<juyo-evidence-layout>` directly.
 */
@Component({
  selector: 'app-evidence-panel',
  imports: [JuyoEvidencePanel],
  host: { class: 'block' },
  template: `<juyo-evidence-panel [entries]="allSteps()" [focusCallId]="focus()" [empty]="empty()" />`,
})
export class EvidencePanel {
  readonly allSteps = input.required<ChatStep[]>();
  readonly focus = input<string | null>(null);
  readonly empty = input('Numbers in the answer will show where they came from here.');
}
