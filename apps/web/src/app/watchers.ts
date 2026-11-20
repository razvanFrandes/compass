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
import { AUTONOMY_LONG, AUTONOMY_ORDER, AUTONOMY_SHORT, latestFinding, nextRunText, runStrip, stripSummary, studioStatus, type Autonomy } from './studio/studio';
import { WorkflowActions } from './studio/workflow-actions';
import { WorkflowMenu } from './studio/workflow-menu';
import * as icons from './icons';

export const AUTONOMY_LABEL: Record<Workflow['autonomy'], string> = AUTONOMY_LONG;
export const RUN_STATUS: Record<string, string> = { running: 'Running', waiting_approval: 'Waiting for approval', done: 'Done', failed: 'Failed' };
export const triggerText = (w: Pick<Workflow, 'trigger'>) =>
  w.trigger.kind === 'schedule' ? `Every ${w.trigger.every}, after the morning brief` : w.trigger.kind === 'brief' ? `When the brief finds ${w.trigger.finding.replace(/_/g, ' ')}` : 'When you run it';
/** `silviu@gmail.com` → `si****@gmail.com` (same rule as contracts' maskEmail, without pulling zod into the bundle). */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  return at < 1 ? '****' : `${address.slice(0, Math.min(2, at))}****${address.slice(at)}`;
}
/** Hotel names, not codes, in receipts: "Lisbon Chiado". */
export const hotelName = (code: string) => HOTELS.find((h) => h.code === code)?.short ?? code;

/*
  Agent Studio: the backend's workflows (WorkflowsApi), agents that watch the numbers, propose an action and act
  once a person approves. Decisions waiting on you come first, then every workflow as a card (its latest finding,
  a strip of its last runs, its next run and how far it may go), then the audit log of what was handed to the RMS.
  Everything here is live; the list polls.
*/
@Component({
  selector: 'app-watchers',
  imports: [NgIcon, HlmButtonImports, ProposalCard, ScopeSwitcher, WorkflowMenu, ConfirmDialog],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  styles: `
    .ws-card { position: relative; display: flex; flex-direction: column; gap: 14px; padding: 18px; transition: border-color 175ms ease, opacity 175ms ease; }
    /* Paused: the card recedes (no fill, dashed edge, a faint strip) while its text keeps its contrast. */
    .ws-card[data-off] { background: transparent; border-style: dashed; box-shadow: none; }
    .ws-card[data-off] .ws-strip { opacity: 0.45; }
    .ws-chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border-radius: 9999px; font-size: 12px; font-weight: 500; white-space: nowrap; color: var(--muted-foreground); background: var(--overlay-hover); }
    .ws-chip::before { content: ''; width: 6px; height: 6px; border-radius: 9999px; background: currentColor; }
    .ws-chip[data-tone='needs'] { color: var(--decision); background: var(--decision-tint); }
    .ws-chip[data-tone='failed'] { color: var(--negative); background: color-mix(in srgb, var(--negative) 8%, transparent); }
    .ws-chip[data-tone='finding'], .ws-chip[data-tone='running'] { color: var(--foreground); }
    .ws-chip[data-tone='running']::before { animation: ws-blink 1.2s ease-in-out infinite; }
    @keyframes ws-blink { 50% { opacity: 0.25; } }
    .ws-finding { padding: 11px 13px; border-radius: 10px; background: var(--field); border: 1px solid var(--border); }
    .ws-finding[data-pending] { border-color: color-mix(in srgb, var(--decision) 50%, transparent); background: var(--decision-tint); }
    .ws-eyebrow { font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-foreground); }

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
    .ws-level button { min-width: 0; }
    /* The chosen level in the brand tint: it reads on a white card too, where a white pill would not. */
    .ws-level button[aria-checked='true'] { background: color-mix(in srgb, var(--brand) 16%, var(--card)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand) 45%, transparent); }
    .ws-level button:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ring); }
    @media (pointer: coarse) { .ws-level button { height: 36px; padding: 0 12px; } }
    @media (prefers-reduced-motion: reduce) {
      .ws-card { transition: none; }
      .ws-chip[data-tone='running']::before, .ws-tick[data-outcome='running'] { animation: none; }
    }
  `,
  template: `
    <div class="mx-auto flex max-w-[1180px] flex-col gap-8 px-[max(16px,env(safe-area-inset-left,0px))] pt-5 pb-28 sm:px-8 lg:pt-8 lg:pb-16">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 class="text-[26px] font-semibold tracking-[-0.02em]">Agent Studio</h1>
            <app-scope-switcher class="max-lg:hidden" />
          </div>
          <p class="text-muted-foreground mt-1 max-w-[64ch] text-[14px]">Agents that watch the numbers, propose an action and act once you approve. Each one says what it found last, how its runs went and when it runs next.</p>
        </div>
        <button hlmBtn (click)="store.openBuilder()"><ng-icon name="phosphorSparkleFill" aria-hidden="true" />New agent with Kassandra</button>
      </header>

      @if (live.pendingList().length) {
        <section aria-labelledby="w-decide">
          <h2 id="w-decide" class="mb-3 text-[15px] font-semibold">Needs your decision · {{ live.pendingList().length }}</h2>
          <div class="grid gap-4 md:grid-cols-2">
            @for (p of live.pendingList(); track p.id) {
              <app-proposal-card [proposal]="p" />
            }
          </div>
        </section>
      }

      <section aria-labelledby="w-list">
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="w-list" tabindex="-1" class="text-[15px] font-semibold outline-none">Agents{{ cards().length ? ' · ' + cards().length : '' }}</h2>
          <p class="text-muted-foreground flex items-center gap-3 text-[12.5px]">
            @if (live.workflows.isLoading() && !cards().length) {
              <span role="status">Loading…</span>
            }
            @if (hidden(); as n) {
              <span>{{ n }} more for other hotels · <button type="button" class="hover:text-foreground underline underline-offset-2" (click)="scope.clear()">Show all hotels</button></span>
            }
          </p>
        </div>
        @if (live.workflowsError(); as e) {
          <p role="alert" class="border-border mb-3 rounded-[10px] border border-dashed p-3 text-[13.5px]">Couldn’t load the agents: {{ e }} <button hlmBtn variant="outline" size="sm" (click)="live.workflows.reload()">Retry</button></p>
        }
        <ul class="grid gap-4 lg:grid-cols-2">
          @for (c of cards(); track c.w.id) {
            @let w = c.w;
            <li class="insight-card watcher-card--link ws-card" [attr.data-off]="w.enabled ? null : ''">
              <div>
                <div class="flex items-start gap-3">
                  <h3 class="min-w-0 flex-1 text-[16px]/snug font-semibold tracking-[-0.01em]">
                    <button type="button" class="card-link" (click)="open(w)">{{ w.name }}</button>
                  </h3>
                  <span class="ws-chip mt-0.5" [attr.data-tone]="c.status.tone"><span class="sr-only">Last run: </span>{{ c.status.text }}</span>
                  <app-workflow-menu class="above-link -mt-1 -mr-2" [workflow]="w" (deleted)="afterDelete()" />
                </div>
                <p class="text-muted-foreground mt-1 text-[13px]/snug">{{ c.what }}</p>
              </div>

              <div class="ws-finding" [attr.data-pending]="c.finding?.pending ? '' : null">
                <p class="ws-eyebrow">
                  {{ c.finding ? (c.finding.kind === 'proposal' ? 'Latest finding' : c.finding.test ? 'Last test' : 'Last run') : 'Latest finding' }}
                  @if (c.finding) {
                    <span class="font-normal tracking-normal normal-case"> · {{ ago(c.finding.at) }}</span>
                  }
                </p>
                @if (c.finding; as f) {
                  <p class="md-inline mt-1 line-clamp-2 text-[13.5px]/snug" [innerHTML]="f.html"></p>
                  @if (f.hotel) {
                    <p class="text-muted-foreground mt-1 text-[12.5px]">{{ scope.nameOf(f.hotel) }}{{ f.pending ? ' · waiting for your decision' : '' }}</p>
                  }
                } @else if (c.loading) {
                  <p class="text-muted-foreground mt-1 text-[13.5px]/snug" role="status">Loading its history…</p>
                } @else {
                  <p class="text-muted-foreground mt-1 text-[13.5px]/snug">Nothing yet. {{ w.enabled ? 'Its first run will show here.' : 'Resume it, or run it now, to see what it finds.' }}</p>
                }
              </div>

              <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div class="flex items-center gap-3">
                  <div class="ws-strip" role="img" [attr.aria-label]="c.stripText">
                    @for (tick of c.strip; track $index) {
                      <i class="ws-tick" [attr.data-outcome]="tick.outcome"></i>
                    }
                  </div>
                  <span class="text-muted-foreground text-[12.5px]" aria-hidden="true">{{ c.runCount ? (c.runCount === 1 ? '1 run' : 'last ' + c.runCount + ' runs') : 'no runs yet' }}</span>
                </div>
                <p class="text-muted-foreground flex items-center gap-1.5 text-[12.5px] tabular-nums"><ng-icon name="phosphorClockLight" class="text-[14px]" aria-hidden="true" />{{ c.next }}</p>
              </div>

              <div class="border-border/70 above-link mt-auto flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t pt-3.5">
                <div class="flex items-center gap-2 text-[13px]">
                  <button type="button" class="toggle" role="switch" [attr.aria-checked]="w.enabled" [attr.aria-label]="(w.enabled ? 'Pause ' : 'Turn on ') + w.name" [disabled]="!!busy(w.id)" (click)="actions.setEnabled(w, !w.enabled)"><i></i></button>
                  <span class="text-muted-foreground" aria-hidden="true">{{ w.enabled ? 'On' : 'Paused' }}</span>
                </div>
                @if (w.action.type === 'email') {
                  <p class="text-muted-foreground text-[12.5px]">Sends an email · no approval needed{{ emails(w) }}</p>
                } @else {
                  <div class="op-toggle ws-level" role="radiogroup" [attr.aria-label]="'How far ' + w.name + ' may go'">
                    @for (level of levels; track level) {
                      <button type="button" role="radio" [attr.aria-checked]="w.autonomy === level" [attr.tabindex]="w.autonomy === level ? 0 : -1" [attr.title]="levelLong(level)" [disabled]="!!busy(w.id)" (click)="actions.setAutonomy(w, level)" (keydown)="levelKey($event, w)">{{ levelShort(level) }}</button>
                    }
                  </div>
                }
                <button hlmBtn variant="secondary" size="sm" class="ml-auto" [disabled]="!!busy(w.id) || w.lastRun?.status === 'running' || !w.enabled" (click)="live.runNow(w)">{{ busy(w.id) || (w.lastRun?.status === 'running' ? 'Running…' : 'Run now') }}</button>
              </div>
            </li>
          } @empty {
            @if (!live.workflows.isLoading() && !live.workflowsError()) {
              <li class="text-muted-foreground border-border rounded-xl border border-dashed p-6 text-center text-[14px] lg:col-span-2">
                @if (hidden()) {
                  No agent watches {{ scope.phrase() }} yet. Create one with “New agent with Kassandra”: it starts on these hotels.
                } @else {
                  No agents yet. Describe one to Kassandra with “New agent with Kassandra”.
                }
              </li>
            }
          }
        </ul>
        @if (cards().length) {
          <p class="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" aria-hidden="true">
            <span class="inline-flex items-end gap-1.5"><i class="ws-tick ws-key" data-outcome="none"></i>ran, nothing to flag</span>
            <span class="inline-flex items-end gap-1.5"><i class="ws-tick ws-key" data-outcome="finding"></i>found something</span>
            <span class="inline-flex items-end gap-1.5"><i class="ws-tick ws-key" data-outcome="pending"></i>waits for you</span>
            <span class="inline-flex items-end gap-1.5"><i class="ws-tick ws-key" data-outcome="failed"></i>couldn’t run</span>
          </p>
        }
      </section>

      <section aria-labelledby="w-audit">
        <div class="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="w-audit" class="text-[15px] font-semibold">Audit log</h2>
          <span class="text-muted-foreground text-[12.5px]">Nothing is written to source systems: approved actions become tasks for the revenue manager</span>
        </div>
        @if (auditRows().length) {
          <div class="insight-card overflow-x-auto" tabindex="0" aria-label="Audit log">
            <table class="w-full text-[13px]">
              <thead class="text-muted-foreground text-[12px]">
                <tr>
                  <th scope="col" class="border-border border-b px-4 py-2 text-left font-medium">When</th>
                  <th scope="col" class="border-border border-b px-4 py-2 text-left font-medium">Hotel</th>
                  <th scope="col" class="border-border border-b px-4 py-2 text-left font-medium">Action</th>
                  <th scope="col" class="border-border border-b px-4 py-2 text-left font-medium">By</th>
                  <th scope="col" class="border-border border-b px-4 py-2 text-left font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                @for (a of auditRows().slice(0, showAll() ? 200 : 8); track a.id) {
                  <tr class="border-border border-b align-top last:border-b-0">
                    <td class="text-muted-foreground px-4 py-2 whitespace-nowrap">{{ ago(a.at) }}</td>
                    <td class="px-4 py-2 whitespace-nowrap">{{ scope.nameOf(a.hotel_code) }}</td>
                    <td class="px-4 py-2 whitespace-nowrap">{{ actionLabel(a.action) }}</td>
                    <td class="text-muted-foreground px-4 py-2 whitespace-nowrap">{{ by(a.by) }}</td>
                    <td class="px-4 py-2"><span class="font-medium">{{ outcome(a.outcome) }}</span><span class="text-muted-foreground block max-w-[60ch] text-[12.5px]">{{ human(a.receipt) }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (auditRows().length > 8) {
            <button hlmBtn variant="ghost" size="sm" class="mt-2" (click)="showAll.set(!showAll())">{{ showAll() ? 'Show fewer' : 'Show all ' + auditRows().length }}</button>
          }
        } @else {
          <p class="text-muted-foreground text-[13.5px]">Nothing yet. Approved and automatic actions are recorded here.</p>
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
  protected readonly levels = AUTONOMY_ORDER;

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
        what: this.what(w),
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

  /** "When the brief finds pace behind · All 20 hotels · Change the rate": what it watches, where, and what it may do. */
  private what(w: Workflow) {
    const hotels = w.hotels.includes('ALL') ? scopeLabel([], this.scope.catalog()) : scopeLabel(w.hotels, this.scope.catalog());
    const action = `${ACTION_LABEL[w.action.type] ?? w.action.type}${w.delivery ? ` to ${maskEmail(w.delivery.to)}` : ''}`;
    const by = w.createdBy === 'kassandra' ? ' · made with Kassandra' : w.createdBy === 'user' ? ' · yours' : '';
    return `${triggerText(w)} · ${hotels} · ${action}${by}`;
  }
  /** An email workflow turns itself off after 5 mails (docs/api.md, "Lifetime"). */
  protected emails(w: Workflow) {
    return typeof w.emailsSent === 'number' ? ` · ${w.emailsSent} of 5 emails sent` : '';
  }
  protected actionLabel(a: Workflow['action']['type']) {
    return ACTION_LABEL[a] ?? a;
  }
  protected levelShort(level: Autonomy) {
    return AUTONOMY_SHORT[level];
  }
  protected levelLong(level: Autonomy) {
    return AUTONOMY_LONG[level];
  }
  /** Arrow keys move the choice, as in any radio group; raising it still asks first. */
  protected levelKey(event: KeyboardEvent, w: Workflow) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = AUTONOMY_ORDER[(AUTONOMY_ORDER.indexOf(w.autonomy) + step + AUTONOMY_ORDER.length) % AUTONOMY_ORDER.length]!;
    const group = (event.currentTarget as HTMLElement).parentElement;
    void this.actions.setAutonomy(w, next).then((changed) => {
      const target = changed ? next : w.autonomy;
      setTimeout(() => group?.querySelectorAll<HTMLElement>('[role=radio]')[AUTONOMY_ORDER.indexOf(target)]?.focus(), 60);
    });
  }
  protected outcome(o: string) {
    return ({ sent_to_rms: 'Sent to the RMS', suggested: 'Suggested', undone: 'Undone', emailed: 'Emailed' } as Record<string, string>)[o] ?? o;
  }
  /** Receipts read as sentences: message ids and task ids stay out of the way. */
  protected human(s: string) {
    return humanizeText(s)
      .replace(/^Email\s*<[^>]+>\s*to\s+/i, 'Emailed ')
      .replace(/^RMS task \S+ for ([A-Z0-9]+):\s*/, (_, c: string) => `Task for the revenue manager at ${hotelName(c)}: `)
      .replace(/<[^>\s]+@[^>\s]+>/g, '');
  }
  protected by(who: string) {
    return /auto/i.test(who) ? 'Automatic (low risk)' : /test/i.test(who) ? 'Test run' : /^workflow/i.test(who) ? 'The agent' : who;
  }
  protected busy(id: string) {
    return this.live.busy()[id] ?? this.actions.busy()[id] ?? '';
  }
  protected open(w: Workflow) {
    this.store.activeWatcherId.set(w.id);
    this.store.go('watcher');
  }
  /** The card went away with its menu: the keyboard lands on the list's heading. */
  protected afterDelete() {
    setTimeout(() => this.doc.getElementById('w-list')?.focus(), 0);
  }
}
