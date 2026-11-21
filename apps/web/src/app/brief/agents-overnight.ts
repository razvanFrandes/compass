import { Component, ViewEncapsulation, input, output } from '@angular/core';
import type { AgentRow } from './brief-model';

/**
 * What Agent Studio ran since the last brief, for the hotels in scope: each agent with how its last run went,
 * when, and what it found. The name opens the agent's page.
 */
@Component({
  selector: 'app-agents-overnight',
  encapsulation: ViewEncapsulation.None,
  styleUrl: './agents-overnight.css',
  host: { class: 'block min-w-0' },
  template: `
    <ul class="agents">
      @for (a of rows(); track a.id) {
        <li class="agent">
          <i class="agent-dot" [attr.data-tone]="a.status.tone" aria-hidden="true"></i>
          <div class="min-w-0 flex-1">
            <p class="agent-head">
              <button type="button" class="agent-name" (click)="open.emit(a.id)">{{ a.name }}</button>
              <span class="agent-status" [attr.data-tone]="a.status.tone">{{ a.status.text }}</span>
            </p>
            @if (a.loading) {
              <p class="agent-finding" aria-hidden="true"><span class="skeleton agent-skel"></span></p>
            } @else if (a.finding) {
              <p class="agent-finding">{{ a.finding }}</p>
            }
            <p class="agent-meta">
              @if (a.at) {
                Ran {{ ago()(a.at) }}@if (a.hotel) {<span> · {{ nameOf()(a.hotel) }}</span>}
              } @else {
                Runs after the next brief
              }
            </p>
          </div>
        </li>
      }
    </ul>
  `,
})
export class AgentsOvernight {
  readonly rows = input.required<readonly AgentRow[]>();
  readonly nameOf = input<(code: string) => string>((code) => code);
  readonly ago = input<(iso: string) => string>((iso) => iso);
  readonly open = output<string>();
}
