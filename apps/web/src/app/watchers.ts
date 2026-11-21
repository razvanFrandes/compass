import { Component, DOCUMENT, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { Workflow } from '@compass/contracts';
import type { WorkflowDetail } from './api';
import { Live, ago } from './live';
import { ACTION_LABEL, ProposalCard } from './proposal-card';
import { CompassStore } from './store';
import { humanizeText } from './text';
import { HOTELS } from './filters';
import { inline } from './markdown';
import { ScopeSwitcher } from './scope/scope-switcher';
import { ScopeService } from './scope/scope.service';
import { scopeLabel } from './scope/hotels';
import { ConfirmDialog } from './studio/confirm';
import { AUTONOMY_LONG, AUTONOMY_SHORT, FINDING_LABEL, latestFinding, nextRunText, runStrip, stripSummary, studioStatus } from './studio/studio';
import { WorkflowActions } from './studio/workflow-actions';
import { WorkflowMenu } from './studio/workflow-menu';
import * as icons from './icons';

export const AUTONOMY_LABEL: Record<Workflow['autonomy'], string> = AUTONOMY_LONG;
export const RUN_STATUS: Record<string, string> = { running: 'Running…', waiting_approval: 'Needs your decision', done: 'Finished', failed: 'Couldn’t run' };
export const triggerText = (w: Pick<Workflow, 'trigger'>) =>
  w.trigger.kind === 'schedule'
    ? w.trigger.every === 'week'
      ? 'Every week, after the morning brief'
      : 'Every morning, after the brief'
    : w.trigger.kind === 'brief'
      ? `When the brief finds ${FINDING_LABEL[w.trigger.finding] ?? w.trigger.finding.replace(/_/g, ' ')}`
      : 'Only when you run it';
/** `silviu@gmail.com` → `si****@gmail.com` (same rule as contracts' maskEmail, without pulling zod into the bundle). */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  return at < 1 ? '****' : `${address.slice(0, Math.min(2, at))}****${address.slice(at)}`;
}
/** Hotel names, not codes, in receipts: "Lisbon Chiado". */
export const hotelName = (code: string) => HOTELS.find((h) => h.code === code)?.short ?? code;

/*
  Agent Studio: the backend's workflows (WorkflowsApi), agents that watch the numbers, propose an action and act
  once a person approves. Decisions waiting on you come first, then every workflow as a row of one table (its last
  run, its latest finding, what it may do, a strip of its last runs and its next run), then the audit log of what
  was handed to the RMS. How far an agent may go is changed on its own page.
  Everything here is live; the list polls.
*/
@Component({
  selector: 'app-watchers',
  imports: [NgIcon, HlmButtonImports, ProposalCard, ScopeSwitcher, WorkflowMenu, ConfirmDialog],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  styles: `
    /*
      The list of agents is a table: the rows are alike and are compared by status, last finding and next run
      (docs/research/layout). A row is two lines: --row-h plus a line, so 64 px, or 56 px when compact.
      Lines separate rows here and nowhere else on the page.
    */
    /* Positioned, so the visually hidden caption and header inside the table are clipped with it and never widen the page. */
    .ws-wrap { position: relative; overflow-x: auto; overscroll-behavior-x: contain; outline: none; }
    .ws-wrap:focus-visible { box-shadow: 0 0 0 2px var(--ring); }
    .ws-table { width: 100%; min-width: 940px; table-layout: fixed; border-collapse: separate; border-spacing: 0; font-size: 13px; line-height: 18px; }
    .ws-table th, .ws-table td { padding: 10px var(--cell-pad-x); text-align: left; vertical-align: middle; background: var(--ws-row, var(--card)); border-bottom: 1px solid var(--border); }
    .ws-table thead th { height: var(--row-h); padding-block: 0; font-size: 12px; font-weight: 500; color: var(--muted-foreground); white-space: nowrap; }
    .ws-table tbody th, .ws-table tbody td { height: calc(var(--row-h) + 1.5rem); font-weight: 400; }
    .ws-table tbody tr:last-child > * { border-bottom: 0; }
    .ws-table th:first-child { padding-left: var(--space-card-pad); }
    .ws-table th:last-child, .ws-table td:last-child { padding-right: var(--space-card-pad); }
    .ws-table tbody tr { cursor: pointer; }
    @media (hover: hover) { .ws-table tbody tr:hover { --ws-row: color-mix(in srgb, var(--foreground) 4%, var(--card)); } }
    /* On a narrow screen the table scrolls sideways and the agent's name stays in view. */
    .ws-table th:first-child { position: sticky; left: 0; z-index: 1; }
    .ws-name { display: block; max-width: 100%; overflow: hidden; border-radius: 4px; font-size: 14px; line-height: 20px; font-weight: 600; letter-spacing: -0.005em; text-align: left; text-overflow: ellipsis; white-space: nowrap; outline: none; }
    .ws-name:focus-visible { box-shadow: 0 0 0 2px var(--ring); }
    @media (hover: hover) { .ws-table tbody tr:hover .ws-name { text-decoration: underline; text-underline-offset: 3px; } }
    .ws-sub { display: block; overflow: hidden; color: var(--muted-foreground); font-size: 12.5px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
    /* Paused: the row recedes (a faint strip) while its text keeps its contrast. */
    .ws-table tr[data-off] .ws-strip { opacity: 0.45; }
    .ws-chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border-radius: 9999px; font-size: 12px; font-weight: 500; white-space: nowrap; color: var(--muted-foreground); background: var(--overlay-hover); }
    .ws-chip::before { content: ''; width: 6px; height: 6px; border-radius: 9999px; background: currentColor; }
    .ws-chip[data-tone='needs'] { color: var(--decision); background: var(--decision-tint); }
    .ws-chip[data-tone='failed'] { color: var(--negative); background: color-mix(in srgb, var(--negative) 8%, transparent); }
    .ws-chip[data-tone='finding'], .ws-chip[data-tone='running'] { color: var(--foreground); }
    .ws-chip[data-tone='running']::before { animation: ws-blink 1.2s ease-in-out infinite; }
    @keyframes ws-blink { 50% { opacity: 0.25; } }

    /* Run strip (Sentry Crons): height carries the outcome, so it reads without colour. Tall = it found something. */
    .ws-strip { display: flex; align-items: flex-end; gap: 3px; height: 22px; width: 132px; flex-shrink: 0; }
    .ws-tick { flex: 1; min-width: 0; height: 7px; border-radius: 2px; background: var(--series-muted); }
    .ws-tick[data-outcome='empty'] { height: 7px; background: transparent; box-shadow: inset 0 0 0 1px var(--field-border-hover); }
    .ws-tick[data-outcome='finding'] { height: 22px; background: var(--foreground); opacity: 0.78; }
    .ws-tick[data-outcome='pending'] { height: 22px; background: var(--decision); }
    .ws-tick[data-outcome='failed'] { height: 22px; background: repeating-linear-gradient(135deg, var(--negative) 0 3px, color-mix(in srgb, var(--negative) 35%, transparent) 3px 6px); }
    .ws-tick[data-outcome='running'] { height: 14px; background: var(--brand); animation: ws-blink 1.2s ease-in-out infinite; }
    .ws-key { flex: none; width: 6px; }
    .ws-key:not([data-outcome='none']) { height: 14px; }
    /* The audit log: a compact table, one line a row unless the outcome needs two. */
    .ws-log { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; line-height: var(--leading-body); }
    .ws-log th, .ws-log td { padding: calc((var(--row-h) - var(--leading-body)) / 2) var(--cell-pad-x); text-align: left; vertical-align: top; border-bottom: 1px solid var(--border); }
    .ws-log thead th { font-size: 12px; font-weight: 500; color: var(--muted-foreground); }
    .ws-log tbody tr:last-child > * { border-bottom: 0; }
    .ws-log th:first-child, .ws-log td:first-child { padding-left: var(--space-card-pad); }
    .ws-log th:last-child, .ws-log td:last-child { padding-right: var(--space-card-pad); }
    @media (prefers-reduced-motion: reduce) {
      .ws-chip[data-tone='running']::before, .ws-tick[data-outcome='running'] { animation: none; }
    }
  `,
  template: `
    <div class="page gap-section flex flex-col pt-section pb-28 lg:pb-section-lg">
      <header class="gap-card-gap flex flex-wrap items-end justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 class="text-[26px] font-semibold tracking-[-0.02em]">Agent Studio</h1>
            <app-scope-switcher class="max-lg:hidden" />
          </div>
          <p class="text-muted-foreground max-w-measure mt-1 text-[14px]">Agents watch the numbers for you, propose an action and act once you approve. Each row shows the last run, the latest finding, the recent runs and the next run.</p>
        </div>
        <button hlmBtn (click)="store.openBuilder()"><ng-icon name="phosphorSparkleFill" aria-hidden="true" />New agent with Kassandra</button>
      </header>

      @if (live.pendingList().length) {
        <section aria-labelledby="w-decide">
          <h2 id="w-decide" class="section-title mb-stack">Needs your decision · {{ live.pendingList().length }}</h2>
          <div class="gap-card-gap grid md:grid-cols-2">
            @for (p of live.pendingList(); track p.id) {
              <app-proposal-card [proposal]="p" />
            }
          </div>
        </section>
      }

      <section aria-labelledby="w-list">
        <div class="mb-stack flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="w-list" tabindex="-1" class="section-title outline-none">Agents{{ cards().length ? ' · ' + cards().length : '' }}</h2>
          <p class="text-muted-foreground flex items-center gap-3 text-[12.5px]">
            @if (live.workflows.isLoading() && !cards().length) {
              <span role="status">Loading agents…</span>
            }
            @if (hidden(); as n) {
              <span>{{ n }} more on other hotels · <button type="button" class="hover:text-foreground underline underline-offset-2" (click)="scope.clear()">Show all hotels</button></span>
            }
          </p>
        </div>
        @if (live.workflowsError(); as e) {
          <p role="alert" class="border-border mb-stack rounded-[10px] border border-dashed p-3 text-[13.5px]">Couldn’t load your agents. {{ e }} <button hlmBtn variant="outline" size="sm" (click)="live.workflows.reload()">Try again</button></p>
        }
        @if (cards().length) {
          <div class="surface surface--flush ws-wrap" role="region" tabindex="0" aria-label="Agents, as a table">
            <table class="ws-table">
              <caption class="sr-only">Agents: what each one watches, its last run, its latest finding, what it may do and its recent runs</caption>
              <thead>
                <tr>
                  <th scope="col" class="w-[21%]">Agent</th>
                  <th scope="col" class="w-[156px]">Last run</th>
                  <th scope="col">Latest finding</th>
                  <th scope="col" class="w-[148px]">Action</th>
                  <th scope="col" class="w-[172px]">Recent runs</th>
                  <th scope="col" class="w-[184px]"><span class="sr-only">Pause, run or change</span></th>
                </tr>
              </thead>
              <tbody>
                @for (c of cards(); track c.w.id) {
                  @let w = c.w;
                  <tr [attr.data-off]="w.enabled ? null : ''" (click)="rowClick($event, w)">
                    <th scope="row">
                      <button type="button" class="ws-name" (click)="open(w)">{{ w.name }}</button>
                      <span class="ws-sub" [attr.title]="c.when">{{ c.when }}</span>
                    </th>
                    <td>
                      <span class="ws-chip" [attr.data-tone]="c.status.tone">{{ c.status.text }}</span>
                    </td>
                    <td>
                      @if (c.finding; as f) {
                        <span class="md-inline line-clamp-2" [innerHTML]="f.html"></span>
                        <span class="ws-sub">{{ f.kind === 'proposal' ? 'Finding' : f.test ? 'Test run' : 'Run' }} · {{ ago(f.at) }}{{ f.hotel ? ' · ' + scope.nameOf(f.hotel) : '' }}{{ f.pending ? ' · waiting for your decision' : '' }}</span>
                      } @else if (c.loading) {
                        <span class="text-muted-foreground" role="status">Loading recent runs…</span>
                      } @else {
                        <span class="text-muted-foreground">{{ w.enabled ? 'No findings yet. The first run shows here.' : 'No findings yet. Resume the agent to see what it finds.' }}</span>
                      }
                    </td>
                    <td>
                      <span class="block truncate" [attr.title]="c.action">{{ c.action }}</span>
                      <span class="ws-sub" [attr.title]="c.limit">{{ c.limit }}</span>
                    </td>
                    <td>
                      <span class="ws-strip" role="img" [attr.aria-label]="c.stripText">
                        @for (tick of c.strip; track $index) {
                          <i class="ws-tick" [attr.data-outcome]="tick.outcome"></i>
                        }
                      </span>
                      <span class="ws-sub mt-1 tabular-nums" [attr.title]="c.next">{{ c.next }}</span>
                    </td>
                    <td>
                      <span class="flex items-center justify-end gap-2">
                        <button type="button" class="toggle" role="switch" [attr.aria-checked]="w.enabled" [attr.aria-label]="(w.enabled ? 'Pause ' : 'Resume ') + w.name" [disabled]="!!busy(w.id)" (click)="actions.setEnabled(w, !w.enabled)"><i></i></button>
                        @let runText = busy(w.id) || (w.lastRun?.status === 'running' ? 'Running…' : 'Run now');
                        <button hlmBtn variant="secondary" size="sm" [attr.aria-label]="runText + ': ' + w.name" [disabled]="!!busy(w.id) || w.lastRun?.status === 'running' || !w.enabled" (click)="live.runNow(w)">{{ runText }}</button>
                        <app-workflow-menu class="-mr-2" [workflow]="w" (deleted)="afterDelete()" />
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="text-muted-foreground mt-stack flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" aria-hidden="true">
            <span class="inline-flex items-end gap-1.5"><i class="ws-tick ws-key" data-outcome="none"></i>Nothing to flag</span>
            <span class="inline-flex items-end gap-1.5"><i class="ws-tick ws-key" data-outcome="finding"></i>Found something</span>
            <span class="inline-flex items-end gap-1.5"><i class="ws-tick ws-key" data-outcome="pending"></i>Needs your decision</span>
            <span class="inline-flex items-end gap-1.5"><i class="ws-tick ws-key" data-outcome="failed"></i>Couldn’t run</span>
          </p>
        } @else if (!live.workflows.isLoading() && !live.workflowsError()) {
          <p class="text-muted-foreground border-border rounded-xl border border-dashed p-card-pad text-center text-[14px]">
            @if (hidden()) {
              No agent watches {{ scope.phrase() }} yet. Choose “New agent with Kassandra” and the new agent starts on these hotels.
            } @else {
              No agents yet. Choose “New agent with Kassandra” and describe what to watch.
            }
          </p>
        }
      </section>

      <section aria-labelledby="w-audit">
        <div class="mb-stack flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="w-audit" class="section-title">Audit log</h2>
          <span class="text-muted-foreground text-[12.5px]">Nothing changes in your hotel systems. An approved action becomes a task for the revenue manager.</span>
        </div>
        @if (auditRows().length) {
          <!-- A log is scanned, not read: a compact region -->
          <div data-density="compact" class="surface surface--flush ws-wrap" role="region" tabindex="0" aria-label="Audit log, as a table">
            <table class="ws-log">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Hotel</th>
                  <th scope="col">Action</th>
                  <th scope="col">By</th>
                  <th scope="col">Outcome</th>
                </tr>
              </thead>
              <tbody>
                @for (a of auditRows().slice(0, showAll() ? 200 : 5); track a.id) {
                  <tr>
                    <td class="text-muted-foreground whitespace-nowrap">{{ ago(a.at) }}</td>
                    <td class="whitespace-nowrap">{{ scope.nameOf(a.hotel_code) }}</td>
                    <td class="whitespace-nowrap">{{ actionLabel(a.action) }}</td>
                    <td class="text-muted-foreground whitespace-nowrap">{{ by(a.by) }}</td>
                    <td><span class="font-medium">{{ outcome(a.outcome) }}</span><span class="text-muted-foreground max-w-measure block text-[12.5px]">{{ human(a.receipt) }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (auditRows().length > 5) {
            <button hlmBtn variant="ghost" size="sm" class="mt-stack" (click)="showAll.set(!showAll())">{{ showAll() ? 'Show fewer' : 'Show all ' + auditRows().length }}</button>
          }
        } @else {
          <p class="text-muted-foreground text-[13.5px]">No actions yet. Every action an agent takes, approved or on its own, is recorded here.</p>
        }
      </section>
    </div>
    <app-confirm-dialog />
  `,
})
export class WatchersView {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  protected readonly scope = inject(ScopeService);
  protected readonly actions = inject(WorkflowActions);
  private readonly doc = inject(DOCUMENT);
  protected readonly showAll = signal(false);

  /** Runs and proposals per workflow (GET /api/workflows/:id), read again when its last run or its inbox moves. */
  private readonly details = signal<Record<string, WorkflowDetail>>({});
  private readonly asked = new Map<string, string>();
  /** A clock for "next run" and "3 min ago": it moves with every poll of the list. */
  private readonly now = signal(Date.now());

  protected readonly audit = computed(() => (this.live.audit.hasValue() ? this.live.audit.value() : []));
  /** The audit log follows the scope too. */
  protected readonly auditRows = computed(() => this.audit().filter((entry) => this.scope.includes(entry.hotel_code)));
  private readonly all = computed(() => [...this.live.workflowList()].sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)));
  /** The workflows that watch a hotel in scope; one for the whole group always does. */
  private readonly list = computed(() => this.all().filter((w) => w.hotels.includes('ALL') || w.hotels.some((code) => this.scope.includes(code))));
  protected readonly hidden = computed(() => this.all().length - this.list().length);

  protected readonly cards = computed(() => {
    const audit = this.audit();
    const now = this.now();
    return this.list().map((w) => {
      const detail = this.details()[w.id];
      const runs = detail?.runs ?? [];
      const proposals = detail?.proposals ?? [];
      const strip = runStrip(runs, proposals, audit);
      const finding = latestFinding(runs, proposals);
      return {
        w,
        when: this.when(w),
        action: this.action(w),
        limit: this.limit(w),
        status: studioStatus(w, runs, proposals, audit),
        finding: finding ? { ...finding, html: inline(finding.text) } : null,
        loading: !detail && !!w.lastRun,
        strip,
        stripText: stripSummary(strip),
        runCount: strip.filter((tick) => tick.outcome !== 'empty').length,
        next: nextRunText(w, runs, now),
      };
    });
  });

  protected readonly ago = (iso: string) => ago(iso, this.now());

  constructor() {
    this.live.reloadAll();
    // Anything changed from a menu or a control here: read the lists again.
    effect(() => {
      if (this.actions.changed()) untracked(() => this.live.reloadAll());
    });
    effect(() => {
      const pending = this.live.pendingList();
      for (const w of this.live.workflowList()) {
        const key = `${w.lastRun?.runId ?? ''}|${w.lastRun?.status ?? ''}|${pending.filter((p) => p.workflowId === w.id).length}`;
        if (this.asked.get(w.id) === key) continue;
        this.asked.set(w.id, key);
        void this.live.workflowsApi.get(w.id).then((result) => {
          if (result.ok) this.details.update((details) => ({ ...details, [w.id]: result.value }));
          else this.asked.delete(w.id);
        });
      }
      untracked(() => this.now.set(Date.now()));
    });
  }

  /** "When the brief finds pace behind · All 20 hotels": what it watches and where. */
  private when(w: Workflow) {
    const hotels = w.hotels.includes('ALL') ? scopeLabel([], this.scope.catalog()) : scopeLabel(w.hotels, this.scope.catalog());
    return `${triggerText(w)} · ${hotels}`;
  }
  /** "Change the rate", "Send an email to si****@gmail.com": what it may do. */
  private action(w: Workflow) {
    return `${ACTION_LABEL[w.action.type] ?? w.action.type}${w.delivery ? ` to ${maskEmail(w.delivery.to)}` : ''}`;
  }
  /** How far it may go, and who made it: "Ask first · built with Kassandra". An email needs no approval. */
  private limit(w: Workflow) {
    const by = w.createdBy === 'kassandra' ? ' · built with Kassandra' : w.createdBy === 'user' ? ' · created by you' : '';
    // An email workflow turns itself off after 5 mails (docs/api.md, "Lifetime").
    const sent = typeof w.emailsSent === 'number' ? ` · ${w.emailsSent} of 5 sent` : '';
    return w.action.type === 'email' ? `No approval needed${sent}${by}` : `${AUTONOMY_SHORT[w.autonomy]}${by}`;
  }
  protected actionLabel(a: Workflow['action']['type']) {
    return ACTION_LABEL[a] ?? a;
  }
  protected outcome(o: string) {
    return ({ sent_to_rms: 'Sent to the revenue manager', suggested: 'Suggested only', undone: 'Undone', emailed: 'Email sent' } as Record<string, string>)[o] ?? o;
  }
  /** Receipts read as sentences: message ids and task ids stay out of the way. */
  protected human(s: string) {
    return humanizeText(s)
      .replace(/^Email\s*<[^>]+>\s*to\s+/i, 'Emailed ')
      .replace(/^RMS task \S+ for ([A-Z0-9]+):\s*/, (_, c: string) => `Task for the revenue manager at ${hotelName(c)}: `)
      .replace(/^RMS task to revert:\s*/, 'Task for the revenue manager to reverse it: ')
      .replace(/<[^>\s]+@[^>\s]+>/g, '');
  }
  protected by(who: string) {
    return /auto/i.test(who) ? 'The agent, acting alone' : /test/i.test(who) ? 'Test run' : /^workflow/i.test(who) ? 'The agent' : who;
  }
  protected busy(id: string) {
    return this.live.busy()[id] ?? this.actions.busy()[id] ?? '';
  }
  protected open(w: Workflow) {
    this.store.activeWatcherId.set(w.id);
    this.store.go('watcher');
  }
  /** A click anywhere on a row opens the agent, unless it landed on one of the row's own controls. The name is the keyboard's way in. */
  protected rowClick(event: MouseEvent, w: Workflow) {
    if ((event.target as HTMLElement).closest('button, a, [role="switch"], app-workflow-menu')) return;
    this.open(w);
  }
  /** The card went away with its menu: the keyboard lands on the list's heading. */
  protected afterDelete() {
    setTimeout(() => this.doc.getElementById('w-list')?.focus(), 0);
  }
}
