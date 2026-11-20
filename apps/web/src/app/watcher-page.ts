import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { Workflow, WorkflowRun } from '@compass/contracts';
import { CHECK_LABELS } from '@compass/contracts';
import { inline } from './markdown';
import { groupTurns, toApiError } from './api';
import { ChatTurnView } from './chat-turn';
import { EvidencePanel } from './evidence-panel';
import { Live, ago } from './live';
import { ACTION_LABEL, ProposalCard } from './proposal-card';
import { CompassStore } from './store';
import { AUTONOMY_LABEL, RUN_STATUS, hotelsText, maskEmail, triggerText } from './watchers';
import * as icons from './icons';

/*
  One workflow, live (GET /api/workflows/:id): what it watches and does, its autonomy, its runs with the full
  log of each (the same turns as a chat: steps, answer, evidence) and its proposals, with Approve / Deny / Undo.
  Polls while a run is going.
*/
@Component({
  selector: 'app-watcher-page',
  imports: [NgIcon, HlmButtonImports, ChatTurnView, EvidencePanel, ProposalCard],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  template: `
    <div class="mx-auto flex max-w-[1080px] flex-col gap-7 px-[max(16px,env(safe-area-inset-left,0px))] pt-5 pb-28 sm:px-8 lg:pt-8 lg:pb-16">
      <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-[14px]">
        <button hlmBtn variant="ghost" size="sm" class="text-muted-foreground -ml-2" (click)="store.go('watchers')"><ng-icon name="phosphorArrowLeftLight" />Agent Studio</button>
        <span class="text-muted-foreground">/</span>
        <span class="truncate">{{ wf()?.name ?? '…' }}</span>
      </nav>

      @if (error(); as e) {
        <p role="alert" class="border-border rounded-[10px] border border-dashed p-3 text-[13.5px]">Couldn’t load this workflow: {{ e }} <button hlmBtn variant="ghost" size="sm" (click)="detail.reload()">Try again</button></p>
      }

      @if (wf(); as w) {
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 max-w-[62ch]">
            <h1 class="text-[24px] font-semibold tracking-[-0.02em]">{{ w.name }}</h1>
            @if (w.description) {
              <p class="text-muted-foreground mt-1 text-[14px]">{{ w.description }}</p>
            }
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="toggle" role="switch" [attr.aria-checked]="w.enabled" [attr.aria-label]="w.enabled ? 'Pause this workflow' : 'Turn this workflow on'" (click)="toggle(w)"><i></i></button>
            <span class="text-muted-foreground mr-2 text-[13px]">{{ w.enabled ? 'On' : 'Paused' }}</span>
            <button hlmBtn [disabled]="!!busy() || running() || !w.enabled" (click)="runNow(w)">{{ busy() || (running() ? 'Running…' : 'Run now') }}</button>
          </div>
        </header>

        <section class="insight-card grid gap-x-8 gap-y-3 p-5 text-[13.5px] sm:grid-cols-2" aria-label="What it does">
          <div><p class="text-muted-foreground text-[12px]">When</p><p>{{ trigger(w) }}</p></div>
          <div><p class="text-muted-foreground text-[12px]">Hotels</p><p>{{ hotels(w.hotels) }}</p></div>
          <div class="sm:col-span-2"><p class="text-muted-foreground text-[12px]">What it watches</p><p>{{ w.goal }}</p></div>
          <div>
            <p class="text-muted-foreground text-[12px]">Action</p>
            <p>{{ action(w) }}{{ w.delivery ? ' to ' + mask(w.delivery.to) : '' }}</p>
            @if (w.action.guidance) {
              <p class="text-muted-foreground text-[12.5px]">{{ w.action.guidance }}</p>
            }
          </div>
          <div>
            <p class="text-muted-foreground text-[12px]" id="aut-label">Autonomy</p>
            @if (w.action.type === 'email') {
              <!-- Email is low risk: it needs no approval (contracts: approvalNode) -->
              <p>Sends an email · no approval needed</p>
            } @else {
              <div class="op-toggle mt-1" role="radiogroup" aria-labelledby="aut-label">
                @for (a of autonomies; track a) {
                  <button type="button" role="radio" [attr.aria-checked]="w.autonomy === a" [attr.tabindex]="w.autonomy === a ? 0 : -1" (click)="live.setAutonomy(w, a).then(reload)" (keydown)="autonomyKey($event, w)">{{ autonomyShort(a) }}</button>
                }
              </div>
              <p class="text-muted-foreground mt-1 text-[12.5px]">{{ autonomy(w) }} · approver: {{ w.approver === 'gm' ? 'general manager' : 'revenue manager' }}</p>
            }
          </div>
          @if (w.checks.length) {
            <div class="sm:col-span-2"><p class="text-muted-foreground text-[12px]">Checks first</p><p>{{ checks(w) }}</p></div>
          }
        </section>

        @if (proposals().length) {
          <section aria-labelledby="wp-prop">
            <h2 id="wp-prop" class="mb-3 text-[15px] font-semibold">Proposals</h2>
            <div class="grid gap-4 md:grid-cols-2">
              @for (p of proposals(); track p.id) {
                <app-proposal-card [proposal]="p" />
              }
            </div>
          </section>
        }

        <section aria-labelledby="wp-runs" class="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <h2 id="wp-runs" class="mb-3 text-[15px] font-semibold">Runs</h2>
            <ul class="flex flex-col gap-2" aria-label="Runs">
              @for (r of runs(); track r.id) {
                <li>
                  <button type="button" class="w-full rounded-[10px] border p-3 text-left text-[13px] transition-colors" [attr.aria-pressed]="r.id === runId()" [class]="r.id === runId() ? 'border-(--focus-brand) bg-(--overlay-hover)' : 'border-border hover:bg-(--overlay-hover)'" (click)="pickRun(r.id)">
                    <span class="flex items-center justify-between gap-2">
                      <span [class]="r.status === 'failed' ? 'text-(--negative) font-medium' : r.status === 'waiting_approval' ? 'text-(--decision) font-medium' : 'font-medium'">{{ status(r.status) }}{{ r.test ? ' · test' : '' }}</span>
                      <span class="text-muted-foreground text-[12px]">{{ ago(r.startedAt) }} · {{ r.trigger }}</span>
                    </span>
                    @if (r.summary) {
                      <span class="text-muted-foreground md-inline mt-1 line-clamp-3" [innerHTML]="summary(r.summary)"></span>
                    }
                  </button>
                </li>
              } @empty {
                <li class="text-muted-foreground text-[13.5px]">No runs yet. Run now starts one.</li>
              }
            </ul>
          </div>
          <div class="min-w-0">
            <h2 class="mb-3 text-[15px] font-semibold">Run log</h2>
            @if (runId()) {
              @if (log.isLoading() && !log.hasValue()) {
                <p class="text-muted-foreground text-[13.5px]" role="status">Loading the log…</p>
              }
              <div class="insight-card px-4 pb-4">
                @for (t of turns(); track t.key) {
                  <app-chat-turn [turn]="t" (evidence)="evidenceFor.set($event)" />
                } @empty {
                  @if (!log.isLoading()) {
                    <p class="text-muted-foreground pt-4 text-[13.5px]">This run has no log entries.</p>
                  }
                }
              </div>
              @if (evidenceFor()) {
                <div class="mt-4">
                  <h3 class="mb-2 text-[13.5px] font-semibold">How this was computed</h3>
                  <app-evidence-panel [allSteps]="allSteps()" [focus]="evidenceFor()" />
                </div>
              }
            } @else {
              <p class="text-muted-foreground text-[13.5px]">Pick a run to read what the agent checked and why.</p>
            }
          </div>
        </section>
      } @else if (!error()) {
        <p class="text-muted-foreground text-[14px]" role="status">Loading…</p>
      }
    </div>
  `,
})
export class WatcherPage {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  protected readonly detail = this.live.workflowsApi.detailResource(() => this.store.activeWatcherId() || undefined);
  private readonly picked = signal<string | null>(null);
  protected readonly wf = computed(() => (this.detail.hasValue() ? this.detail.value()?.workflow : undefined));
  protected readonly runs = computed(() => (this.detail.hasValue() ? (this.detail.value()?.runs ?? []) : []).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
  protected readonly proposals = computed(() => (this.detail.hasValue() ? (this.detail.value()?.proposals ?? []) : []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  protected readonly runId = computed(() => this.picked() ?? this.runs()[0]?.id ?? null);
  protected readonly log = this.live.workflowsApi.runLogResource(() => this.runId() ?? undefined);
  protected readonly turns = computed(() => groupTurns(this.log.hasValue() ? (this.log.value()?.entries ?? []) : []));
  protected readonly allSteps = computed(() => this.turns().flatMap((t) => t.steps));
  protected readonly evidenceFor = signal<string | null>(null);
  protected readonly running = computed(() => this.runs().some((r) => r.status === 'running'));
  protected readonly error = computed(() => (this.detail.error() ? toApiError(this.detail.error()).message : null));
  protected readonly busy = computed(() => this.live.busy()[this.store.activeWatcherId()] ?? '');
  protected readonly autonomies: Workflow['autonomy'][] = ['suggest', 'approve', 'auto_low_risk'];
  protected readonly ago = ago;
  protected readonly trigger = triggerText;
  protected readonly hotels = hotelsText;
  protected readonly mask = maskEmail;
  protected readonly reload = () => this.detail.reload();

  constructor() {
    // Poll while a run is going or a proposal waits, so the log and the decision move on by themselves.
    const timer = setInterval(() => {
      if (this.running() || this.proposals().some((p) => p.status === 'pending')) {
        this.detail.reload();
        this.log.reload();
      }
    }, 4000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
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
    await this.live.setEnabled(w, !w.enabled);
    this.detail.reload();
  }
  protected status(s: WorkflowRun['status']) {
    return RUN_STATUS[s] ?? s;
  }
  protected action(w: Workflow) {
    return ACTION_LABEL[w.action.type] ?? w.action.type;
  }
  protected autonomy(w: Workflow) {
    return AUTONOMY_LABEL[w.autonomy];
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
    void this.live.setAutonomy(w, next).then(() => {
      this.reload();
      setTimeout(() => group?.querySelectorAll<HTMLElement>('[role=radio]')[this.autonomies.indexOf(next)]?.focus(), 50);
    });
  }
  protected autonomyShort(a: Workflow['autonomy']) {
    return a === 'suggest' ? 'Suggest' : a === 'approve' ? 'Approve' : 'Act alone (low risk)';
  }
}
