import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { Workflow, WorkflowRun } from '@compass/contracts';
import { CHECK_LABELS } from '@compass/contracts';
import { inline } from './markdown';
import { groupTurns, toApiError } from './api';
import { KassandraComposer } from './kassandra/kassandra-composer';
import { KassandraConversation } from './kassandra/kassandra-conversation';
import { EvidencePanel } from './evidence-panel';
import { Live, ago } from './live';
import { ACTION_LABEL, ProposalCard } from './proposal-card';
import { CompassStore } from './store';
import { AUTONOMY_LABEL, RUN_STATUS, maskEmail, triggerText } from './watchers';
import { scopeLabel } from './scope/hotels';
import { ScopeService } from './scope/scope.service';
import { ConfirmDialog } from './studio/confirm';
import { AUTONOMY_ORDER, AUTONOMY_SHORT, runStartText } from './studio/studio';
import { WorkflowActions } from './studio/workflow-actions';
import { WorkflowMenu } from './studio/workflow-menu';
import * as icons from './icons';

/*
  One workflow, live (GET /api/workflows/:id): what it watches and does, its autonomy, its runs with the full
  log of each (the same turns as a chat: steps, answer, evidence) and its proposals, with Approve / Deny / Undo.
  Polls while a run is going.
  Layout (docs/research/layout): a route of its own with a breadcrumb, a primary column of two thirds (what it
  watches for, decisions, runs and the log of the chosen run) and a secondary one of one third (how it works,
  ask about it). It is edited in the builder.
*/
@Component({
  selector: 'app-watcher-page',
  imports: [NgIcon, HlmButtonImports, KassandraComposer, KassandraConversation, EvidencePanel, ProposalCard, WorkflowMenu, ConfirmDialog],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  styles: `
    /* A run in the list: a row, not a card. The chosen one carries a tint and a mark on its edge. */
    .wp-run { display: block; width: 100%; padding: var(--space-stack) var(--space-card-pad); text-align: left; font-size: 13px; line-height: 18px; outline: none; transition: background-color 130ms ease; }
    .wp-run[aria-pressed='true'] { background: var(--overlay-hover); box-shadow: inset 2px 0 0 var(--focus-brand); }
    @media (hover: hover) { .wp-run:hover { background: var(--overlay-hover); } }
    .wp-run:focus-visible { box-shadow: inset 0 0 0 2px var(--ring); }
    @media (prefers-reduced-motion: reduce) { .wp-run { transition: none; } }
  `,
  template: `
    <!-- A page of its own: the breadcrumb, then a primary column (what it watches for, its decisions, its runs)
         of two thirds and a secondary one (how it works, ask about it) of one third. -->
    <div class="page gap-section flex flex-col pt-stack pb-28 lg:pb-section-lg">
      <nav aria-label="Breadcrumb" class="-mb-[calc(var(--space-section)-var(--space-stack))] flex h-14 items-center gap-1.5 text-[14px]">
        <button hlmBtn variant="ghost" size="sm" class="text-muted-foreground -ml-2" (click)="store.go('watchers')"><ng-icon name="phosphorArrowLeftLight" aria-hidden="true" />Agent Studio</button>
        <span class="text-muted-foreground">/</span>
        <span class="truncate">{{ wf()?.name ?? '…' }}</span>
      </nav>

      @if (error(); as e) {
        <p role="alert" class="border-border rounded-[10px] border border-dashed p-3 text-[13.5px]">Couldn’t load this agent. {{ e }} <button hlmBtn variant="ghost" size="sm" (click)="detail.reload()">Try again</button></p>
      }

      @if (wf(); as w) {
        <header class="gap-card-gap flex flex-wrap items-start justify-between">
          <div class="max-w-measure min-w-0">
            <h1 class="text-[24px] font-semibold tracking-[-0.02em]">{{ w.name }}</h1>
            @if (w.description) {
              <p class="text-muted-foreground mt-1 text-[14px]">{{ w.description }}</p>
            }
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="toggle" role="switch" [attr.aria-checked]="w.enabled" [attr.aria-label]="w.enabled ? 'Pause this agent' : 'Resume this agent'" (click)="toggle(w)"><i></i></button>
            <span class="text-muted-foreground mr-2 text-[13px]">{{ w.enabled ? 'On' : 'Paused' }}</span>
            <button hlmBtn variant="secondary" (click)="actions.edit(w)"><ng-icon name="phosphorPencilSimpleLight" aria-hidden="true" />Edit</button>
            <button hlmBtn [disabled]="!!busy() || running() || !w.enabled" (click)="runNow(w)">{{ busy() || (running() ? 'Running…' : 'Run now') }}</button>
            <app-workflow-menu [workflow]="w" (deleted)="store.go('watchers')" (duplicated)="open($event.id)" />
          </div>
        </header>

        <div class="gap-section grid grid-cols-12 items-start">
          <div class="gap-section col-span-12 flex min-w-0 flex-col lg:col-span-8">
            <!-- The hero: what the agent was told to watch for -->
            <section class="surface" aria-labelledby="wp-goal">
              <h2 id="wp-goal" class="text-muted-foreground text-[12px]/4 font-medium">What it watches for</h2>
              <p class="max-w-measure mt-stack text-[16px]/relaxed">{{ w.goal }}</p>
            </section>

            @if (proposals().length) {
              <section aria-labelledby="wp-prop">
                <h2 id="wp-prop" class="section-title mb-stack">Decisions</h2>
                <div class="gap-card-gap grid">
                  @for (p of proposals(); track p.id) {
                    <app-proposal-card [proposal]="p" />
                  }
                </div>
              </section>
            }

            <section aria-labelledby="wp-runs">
              <h2 id="wp-runs" class="section-title mb-stack">Runs</h2>
              @if (runs().length) {
                <ul class="surface surface--flush overflow-hidden" aria-label="Runs">
                  @for (r of shownRuns(); track r.id) {
                    <li class="border-border border-b last:border-b-0">
                      <button type="button" class="wp-run" [attr.aria-pressed]="r.id === runId()" (click)="pickRun(r.id)">
                        <span class="flex items-baseline justify-between gap-3">
                          <span [class]="r.status === 'failed' ? 'text-(--negative) font-medium' : r.status === 'waiting_approval' ? 'text-(--decision) font-medium' : 'font-medium'">{{ status(r.status) }}{{ r.test ? ' · test run' : '' }}</span>
                          <span class="text-muted-foreground shrink-0 text-[12px]">{{ ago(r.startedAt) }} · {{ startedBy(r.trigger) }}</span>
                        </span>
                        @if (r.summary) {
                          <span class="text-muted-foreground md-inline mt-0.5 line-clamp-2" [innerHTML]="summary(r.summary)"></span>
                        }
                      </button>
                    </li>
                  }
                </ul>
                @if (runs().length > runsCap) {
                  <button hlmBtn variant="ghost" size="sm" class="mt-stack" [attr.aria-expanded]="allRuns()" (click)="allRuns.set(!allRuns())">{{ allRuns() ? 'Show fewer' : 'Show all ' + runs().length + ' runs' }}</button>
                }
              } @else {
                <p class="text-muted-foreground text-[13.5px]">No runs yet. Choose “Run now” to start one.</p>
              }
            </section>

            <section aria-labelledby="wp-log" class="min-w-0">
              <h2 id="wp-log" class="section-title mb-stack">Run log</h2>
              @if (runId()) {
                @if (log.isLoading() && !log.hasValue()) {
                  <p class="text-muted-foreground text-[13.5px]" role="status">Loading the run log…</p>
                }
                <div class="surface pt-0">
                  <kassandra-conversation [turns]="turns()" (evidenceSelected)="evidenceFor.set($event.callId)">
                    @if (!log.isLoading()) {
                      <p class="text-muted-foreground pt-card-pad text-[13.5px]">Nothing was recorded for this run.</p>
                    }
                  </kassandra-conversation>
                </div>
                @if (evidenceFor()) {
                  <div class="mt-card-gap">
                    <h3 class="mb-stack text-[13.5px] font-semibold">Behind the numbers</h3>
                    <app-evidence-panel [allSteps]="allSteps()" [focus]="evidenceFor()" />
                  </div>
                }
              } @else {
                <p class="text-muted-foreground text-[13.5px]">Select a run to see what the agent checked and why.</p>
              }
            </section>
          </div>

          <aside class="gap-section col-span-12 flex min-w-0 flex-col lg:sticky lg:top-(--space-section) lg:col-span-4" aria-label="About this agent">
            <section class="surface" aria-labelledby="wp-how">
              <h2 id="wp-how" class="section-title">How it works</h2>
              <dl class="gap-stack mt-stack flex flex-col text-[13.5px]">
                <div><dt class="text-muted-foreground text-[12px]">When</dt><dd>{{ trigger(w) }}</dd></div>
                <div>
                  <dt class="text-muted-foreground text-[12px]">Hotels</dt>
                  <dd>{{ hotels(w.hotels) }}@if (hotelNames(w.hotels); as names) {<span class="text-muted-foreground block text-[12.5px]">{{ names }}</span>}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground text-[12px]">Action</dt>
                  <dd>
                    {{ action(w) }}{{ w.delivery ? ' to ' + mask(w.delivery.to) : '' }}
                    @if (w.action.guidance) {
                      <span class="text-muted-foreground block text-[12.5px]">{{ w.action.guidance }}</span>
                    }
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-foreground text-[12px]" id="aut-label">How far it may go</dt>
                  <dd>
                    @if (w.action.type === 'email') {
                      <!-- Email is low risk: it needs no approval (contracts: approvalNode) -->
                      Sends an email · no approval needed
                    } @else {
                      <span class="op-toggle mt-1" role="radiogroup" aria-labelledby="aut-label">
                        @for (a of autonomies; track a) {
                          <button type="button" role="radio" [attr.aria-checked]="w.autonomy === a" [attr.tabindex]="w.autonomy === a ? 0 : -1" [disabled]="!!busy()" [title]="autonomyLong(a)" (click)="actions.setAutonomy(w, a)" (keydown)="autonomyKey($event, w)">{{ autonomyShort(a) }}</button>
                        }
                      </span>
                      <span class="text-muted-foreground mt-1 block text-[12.5px]">Approver: the {{ w.approver === 'gm' ? 'general manager' : 'revenue manager' }}.</span>
                    }
                  </dd>
                </div>
                @if (w.checks.length) {
                  <div><dt class="text-muted-foreground text-[12px]">Data it reads first</dt><dd>{{ checks(w) }}</dd></div>
                }
              </dl>
            </section>

            <!-- "Ask about this": the question opens a thread with this workflow as its subject, and is sent at once -->
            <section aria-labelledby="wp-ask">
              <h2 id="wp-ask" class="section-title mb-stack">Ask about this agent</h2>
              <kassandra-composer label="Ask Kassandra about this agent" placeholder="Ask, e.g. “What did it find this week?”" [(mode)]="live.mode" (submitted)="ask(w, $event)" />
            </section>
          </aside>
        </div>
      } @else if (!error()) {
        <p class="text-muted-foreground text-[14px]" role="status">Loading the agent…</p>
      }
    </div>
    <app-confirm-dialog />
  `,
})
export class WatcherPage {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  protected readonly actions = inject(WorkflowActions);
  private readonly scope = inject(ScopeService);
  protected readonly detail = this.live.workflowsApi.detailResource(() => this.store.activeWatcherId() || undefined);
  private readonly picked = signal<string | null>(null);
  protected readonly wf = computed(() => (this.detail.hasValue() ? this.detail.value()?.workflow : undefined));
  protected readonly runs = computed(() => (this.detail.hasValue() ? (this.detail.value()?.runs ?? []) : []).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
  protected readonly proposals = computed(() => (this.detail.hasValue() ? (this.detail.value()?.proposals ?? []) : []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  protected readonly runId = computed(() => this.picked() ?? this.runs()[0]?.id ?? null);
  /** The list starts with the five latest runs (and always the one that is open); the rest sit behind "Show all". */
  protected readonly runsCap = 5;
  protected readonly allRuns = signal(false);
  protected readonly shownRuns = computed(() => {
    const runs = this.runs();
    if (this.allRuns() || runs.length <= this.runsCap) return runs;
    const open = this.runId();
    return runs.filter((run, index) => index < this.runsCap || run.id === open);
  });
  protected readonly log = this.live.workflowsApi.runLogResource(() => this.runId() ?? undefined);
  /** A run opens with an instruction to the agent; the log shows it as what started the run. */
  protected readonly turns = computed(() => groupTurns(this.log.hasValue() ? (this.log.value()?.entries ?? []) : []).map((turn) => ({ ...turn, question: runStartText(turn.question) })));
  protected readonly allSteps = computed(() => this.turns().flatMap((t) => t.steps));
  protected readonly evidenceFor = signal<string | null>(null);
  protected readonly running = computed(() => this.runs().some((r) => r.status === 'running'));
  protected readonly error = computed(() => (this.detail.error() ? toApiError(this.detail.error()).message : null));
  protected readonly busy = computed(() => this.live.busy()[this.store.activeWatcherId()] ?? this.actions.busy()[this.store.activeWatcherId()] ?? '');
  protected readonly autonomies = AUTONOMY_ORDER;
  protected readonly ago = ago;
  protected readonly trigger = triggerText;
  protected readonly mask = maskEmail;

  constructor() {
    // Poll while a run is going or a proposal waits, so the log and the decision move on by themselves.
    const timer = setInterval(() => {
      if (this.running() || this.proposals().some((p) => p.status === 'pending')) {
        this.detail.reload();
        this.log.reload();
      }
    }, 4000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    // A change from the menu, the switch or the autonomy control: read the workflow again.
    effect(() => {
      if (this.actions.changed()) untracked(() => (this.detail.reload(), this.live.workflows.reload()));
    });
  }

  /** "All 20 hotels", "Europe · 8 hotels", "Arbor Lisbon Chiado": names, not codes. */
  protected hotels(codes: string[]) {
    return scopeLabel(codes.includes('ALL') ? [] : codes, this.scope.catalog());
  }
  /** The hotels by name under a label that only counts them. */
  protected hotelNames(codes: string[]) {
    if (codes.includes('ALL') || codes.length < 3) return '';
    return codes.map((code) => this.scope.nameOf(code)).join(', ');
  }
  protected open(id: string) {
    this.store.activeWatcherId.set(id);
  }

  /** The question goes to a new thread, with what the workflow is and what its latest run said as its subject. */
  protected ask(w: Workflow, text: string) {
    const last = this.runs()[0]?.summary?.replace(/\s+/g, ' ').trim();
    const about = [`About the agent “${w.name}” (${this.hotels(w.hotels)})`, `it watches: ${w.goal.trim().replace(/\.$/, '')}`, ...(last ? [`its latest run said: ${last.slice(0, 280)}`] : [])].join('; ');
    this.live.askNew(`${about}. ${text}`);
  }
  protected pickRun(id: string) {
    this.picked.set(id);
    this.evidenceFor.set(null);
  }
  protected async runNow(w: Workflow) {
    const r = await this.live.runNow(w);
    if (r.ok) this.picked.set(r.value.id);
    this.detail.reload();
  }
  protected async toggle(w: Workflow) {
    await this.actions.setEnabled(w, !w.enabled);
  }
  protected status(s: WorkflowRun['status']) {
    return RUN_STATUS[s] ?? s;
  }
  /** What started the run, in words: "run by hand", not "manual". */
  protected startedBy(trigger: WorkflowRun['trigger']) {
    return ({ manual: 'run by hand', schedule: 'on schedule', brief: 'after the brief' } as Record<string, string>)[trigger] ?? trigger;
  }
  protected action(w: Workflow) {
    return ACTION_LABEL[w.action.type] ?? w.action.type;
  }
  /** What a level means: the tooltip of its button, not a line under the control. */
  protected autonomyLong(a: Workflow['autonomy']) {
    return AUTONOMY_LABEL[a];
  }
  /** "Pace vs last year · Review scores", not tool names. */
  protected checks(w: Workflow) {
    return w.checks.map((c) => CHECK_LABELS[c] ?? c.replace(/^get_/, '').replace(/_/g, ' ')).join(' · ');
  }
  /** A run's last word, as one line of safe Markdown with internal tokens turned into words. */
  protected summary(s: string) {
    return inline(s.replace(/\s*\n+\s*[-*•]\s+/g, ' · ').replace(/\s*\n+\s*/g, ' '));
  }
  /** Arrow keys move the choice, as in any radio group. */
  protected autonomyKey(e: KeyboardEvent, w: Workflow) {
    const i = this.autonomies.indexOf(w.autonomy);
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = this.autonomies[(i + step + this.autonomies.length) % this.autonomies.length];
    const group = (e.currentTarget as HTMLElement).parentElement;
    // Raising asks first: when the person cancels, the focus stays on the level that is still chosen.
    void this.actions.setAutonomy(w, next).then((changed) => {
      setTimeout(() => group?.querySelectorAll<HTMLElement>('[role=radio]')[this.autonomies.indexOf(changed ? next : w.autonomy)]?.focus(), 60);
    });
  }
  protected autonomyShort(a: Workflow['autonomy']) {
    return a === 'auto_low_risk' ? 'Act alone (low risk)' : AUTONOMY_SHORT[a];
  }
}
