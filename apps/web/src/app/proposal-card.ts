import { Component, ViewEncapsulation, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { ActionType, Proposal } from '@compass/contracts';
import { Live, ago } from './live';
import { decisionView } from './proposal-text';
import { ScopeService } from './scope/scope.service';
import * as icons from './icons';

export const ACTION_LABEL: Record<ActionType, string> = {
  adjust_bar: 'Change the rate',
  close_channel: 'Close a channel',
  open_channel: 'Open a channel',
  contact_account: 'Contact the account',
  create_task: 'Create a task',
  notify: 'Notify the team',
  email: 'Send an email',
};

/** What `Live.decide` shows on the buttons while the answer is on its way. */
export const SENDING = 'Sending…';
export const DISMISSING = 'Dismissing…';

let next = 0;

/**
 * A decision: something an agent suggests, waiting for a person. The card is written for the person who decides, not
 * for a rate desk (proposal-text.ts): what is suggested and why in plain words, what it could be worth, and what
 * sending it does. Compass is read-only, and the card says so: "Send to revenue manager" hands over a task and
 * writes the audit log; no rate, channel or account changes. The figures behind it (today → suggested, the nights
 * it covers, the agent's full reasoning) are one step down, behind "See the reasoning".
 *
 * One card for every place a decision shows: the morning brief, Agent Studio, an agent's page and a board.
 */
@Component({
  selector: 'app-proposal-card',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ ...icons })],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './proposal-card.css',
  host: { class: 'block' },
  template: `
    @let p = proposal();
    @let v = view();
    <article class="dcard" [class]="p.status === 'pending' ? 'decision-card' : 'insight-card'" [attr.aria-labelledby]="uid + '-t'">
      <div class="dcard-top">
        <p class="dcard-status" [class.dcard-status--waiting]="p.status === 'pending'">
          <span class="dcard-state">{{ v.status }}</span><span class="dcard-hotel"> · {{ hotel() }}</span>
        </p>
        <p class="dcard-kind">{{ v.kind }}</p>
      </div>

      <h3 class="dcard-title" [id]="uid + '-t'">{{ v.title }}</h3>
      <p class="dcard-summary">{{ v.summary }}</p>
      <p class="dcard-promise"><ng-icon name="phosphorLockSimpleLight" aria-hidden="true" /><span>{{ v.promise }}</span></p>

      <div class="dcard-actions">
        @if (p.status === 'pending') {
          <button hlmBtn class="decision-btn" [disabled]="!!working()" (click)="live.decide(p, true)">{{ working() === sending ? sending : 'Send to revenue manager' }}</button>
          <button hlmBtn variant="ghost" [disabled]="!!working()" (click)="live.decide(p, false)">{{ working() === dismissing ? dismissing : 'Dismiss' }}</button>
        } @else {
          <p class="dcard-done">{{ done() }}</p>
          @if (v.canUndo) {
            <button hlmBtn variant="ghost" size="sm" (click)="live.undo(p)">Undo<span class="sr-only">: {{ v.title }}</span></button>
          }
        }
        <button type="button" class="dcard-why" [attr.aria-expanded]="open()" [attr.aria-controls]="uid + '-r'" (click)="open.set(!open())">
          {{ open() ? 'Hide the reasoning' : 'See the reasoning' }}<ng-icon name="phosphorCaretDownLight" [class.rotate-180]="open()" aria-hidden="true" />
        </button>
      </div>

      <div class="dcard-reasoning" [id]="uid + '-r'" [hidden]="!open()">
        <dl>
          @if (v.reasoning.today || v.reasoning.suggested) {
            <div class="dcard-plan">
              <dt>Today</dt>
              <dd>{{ v.reasoning.today || 'not stated' }}</dd>
              <dt><span aria-hidden="true">→ </span>Suggested</dt>
              <dd>{{ v.reasoning.suggested || 'not stated' }}</dd>
            </div>
          }
          @if (v.reasoning.covers) {
            <div>
              <dt>Covers</dt>
              <dd>{{ v.reasoning.covers }}</dd>
            </div>
          }
          <div>
            <dt>Why</dt>
            <dd>{{ v.reasoning.why }}</dd>
          </div>
        </dl>
        <p class="dcard-from">Suggested by the agent {{ agent() }}, {{ suggested() }}.</p>
      </div>
    </article>
  `,
})
export class ProposalCard {
  readonly proposal = input.required<Proposal>();
  protected readonly live = inject(Live);
  private readonly scope = inject(ScopeService);
  protected readonly uid = `dcard-${next++}`;
  protected readonly sending = SENDING;
  protected readonly dismissing = DISMISSING;
  protected readonly open = signal(false);

  /** The hotel by name ("Arbor Lisbon Chiado"), never by code. */
  protected readonly hotel = computed(() => this.scope.nameOf(this.proposal().hotel_code));
  protected readonly view = computed(() => decisionView(this.proposal(), this.scope.catalog()));
  protected readonly working = computed(() => this.live.busy()[this.proposal().id] ?? '');
  /** After the decision: what it left behind and when. "Logged · 3 min ago", "Nothing was sent · 1 h ago". */
  protected readonly done = computed(() => {
    const outcome = this.view().outcome;
    const when = ago(this.proposal().decidedAt ?? this.proposal().createdAt);
    return [outcome ? outcome[0]!.toUpperCase() + outcome.slice(1) : '', when].filter(Boolean).join(' · ');
  });
  /** The agent that suggested it, by name; a deleted agent keeps the name it had. */
  protected readonly agent = computed(() => {
    const p = this.proposal();
    const name = p.deletedWorkflowName ?? this.live.workflowList().find((w) => w.id === p.workflowId)?.name;
    return name ? `“${name}”` : 'that watches this hotel';
  });
  protected readonly suggested = computed(() => ago(this.proposal().createdAt));
}
