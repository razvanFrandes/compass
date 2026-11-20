import { Component, computed, inject, input, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { ActionType, Proposal } from '@compass/contracts';
import { Live, ago } from './live';
import { formatEurShort } from './data';
import { humanizeText } from './text';
import { ScopeService } from './scope/scope.service';
import * as icons from './icons';

export const ACTION_LABEL: Record<ActionType, string> = {
  adjust_bar: 'Change the rate',
  close_channel: 'Close a channel',
  open_channel: 'Open a channel',
  contact_account: 'Contact the account',
  create_task: 'Create a task',
  notify: 'Notify',
  email: 'Send an email',
};
const STATUS: Record<Proposal['status'], string> = {
  pending: 'Waiting for your decision',
  approved: 'Approved',
  denied: 'Denied',
  auto_approved: 'Done on its own (low risk)',
  suggested: 'Suggested only',
  applied: 'Sent to the RMS',
  undone: 'Undone',
  superseded: 'Replaced by a newer proposal',
};

/**
 * A proposal from a workflow: what would change (before → after), why, the money, and Approve / Deny.
 * Compass is read-only: an approved action becomes a task for the revenue manager, logged in the audit.
 */
@Component({
  selector: 'app-proposal-card',
  imports: [HlmButtonImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  template: `
    @let p = proposal();
    <article class="relative flex h-full flex-col p-5" [class]="p.status === 'pending' ? 'decision-card' : 'insight-card'" [attr.aria-label]="p.title">
      <div class="flex items-center justify-between gap-3">
        <span class="card-eyebrow" [class]="p.status === 'pending' ? 'text-(--decision)' : 'text-muted-foreground'">{{ status() }}</span>
        <span class="text-muted-foreground text-right text-[12.5px]">{{ hotel() }} · {{ action() }}{{ p.risk === 'high' ? ' · high risk' : '' }}</span>
      </div>
      <h3 class="mt-2 text-[16px]/[1.35] font-semibold tracking-[-0.01em]">{{ p.title }}</h3>
      <p class="mt-3 text-[14px] tabular-nums">
        <span class="text-muted-foreground line-through decoration-1">{{ p.change.before }}</span> → <span class="font-medium">{{ p.change.after }}</span>
        <span class="text-muted-foreground"> · {{ p.change.scope }}</span>
      </p>
      @if (p.impact_eur !== null) {
        <p class="text-muted-foreground mt-1 text-[13px] tabular-nums">Impact {{ money() }}</p>
      }
      <p class="text-muted-foreground mt-2 text-[13.5px]" [class.line-clamp-3]="!more()">{{ rationale() }}</p>
      @if (p.rationale.length > 220) {
        <button type="button" class="text-muted-foreground hover:text-foreground self-start text-[12.5px] underline underline-offset-2" (click)="more.set(!more())">{{ more() ? 'Less' : 'Why, in full' }}</button>
      }
      <div class="mt-auto flex flex-wrap items-center gap-2 pt-4">
        @if (p.status === 'pending') {
          <button hlmBtn class="decision-btn" [disabled]="!!working()" (click)="live.decide(p, true)">{{ working() === 'Approving…' ? working() : 'Approve' }}</button>
          <button hlmBtn variant="ghost" [disabled]="!!working()" (click)="live.decide(p, false)">{{ working() === 'Denying…' ? working() : 'Deny' }}</button>
        } @else {
          <span class="text-muted-foreground text-[12.5px]">{{ p.decidedBy ? 'By ' + p.decidedBy + ' · ' : '' }}{{ when() }}</span>
          @if (p.status === 'approved' || p.status === 'applied' || p.status === 'auto_approved') {
            <button hlmBtn variant="ghost" size="sm" class="ml-auto" (click)="live.undo(p)">Undo</button>
          }
        }
      </div>
    </article>
  `,
})
export class ProposalCard {
  readonly proposal = input.required<Proposal>();
  protected readonly live = inject(Live);
  private readonly scope = inject(ScopeService);
  /** The hotel by name ("Arbor Amsterdam Centraal"), not by code. */
  protected readonly hotel = computed(() => this.scope.nameOf(this.proposal().hotel_code));
  protected readonly more = signal(false);
  protected readonly status = computed(() => STATUS[this.proposal().status]);
  protected readonly action = computed(() => ACTION_LABEL[this.proposal().action] ?? this.proposal().action);
  protected readonly working = computed(() => this.live.busy()[this.proposal().id] ?? '');
  protected readonly money = computed(() => {
    const v = this.proposal().impact_eur ?? 0;
    return `${v < 0 ? '−' : '+'}${formatEurShort(v)}`;
  });
  protected readonly rationale = computed(() => humanizeText(this.proposal().rationale));
  protected readonly when = computed(() => ago(this.proposal().decidedAt ?? this.proposal().createdAt));
}
