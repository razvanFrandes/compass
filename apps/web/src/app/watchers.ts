import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { Workflow } from '@compass/contracts';
import { Live, ago } from './live';
import { ACTION_LABEL, ProposalCard } from './proposal-card';
import { CompassStore } from './store';
import { humanizeText } from './text';
import * as icons from './icons';

export const AUTONOMY_LABEL: Record<Workflow['autonomy'], string> = {
  suggest: 'Suggests only',
  approve: 'Acts after you approve',
  auto_low_risk: 'Acts alone on low-risk actions',
};
export const RUN_STATUS: Record<string, string> = { running: 'Running', waiting_approval: 'Waiting for approval', done: 'Done', failed: 'Failed' };
export const triggerText = (w: Pick<Workflow, 'trigger'>) =>
  w.trigger.kind === 'schedule' ? `Every ${w.trigger.every}, after the morning brief` : w.trigger.kind === 'brief' ? `When the brief finds ${w.trigger.finding.replace(/_/g, ' ')}` : 'When you run it';
/** `silviu@gmail.com` → `si****@gmail.com` (same rule as contracts' maskEmail, without pulling zod into the bundle). */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  return at < 1 ? '****' : `${address.slice(0, Math.min(2, at))}****${address.slice(at)}`;
}
export const hotelsText = (h: string[]) => (h.includes('ALL') ? 'All hotels' : h.join(', '));

/*
  Watchers are the backend's workflows (WorkflowsApi): agents that watch the numbers, propose an action and act
  once a person approves. Decisions waiting on you come first, then every workflow with its last run and
  Run now, then the audit log of what was handed to the RMS. Everything here is live; the list polls.
*/
@Component({
  selector: 'app-watchers',
  imports: [NgIcon, HlmButtonImports, ProposalCard],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  template: `
    <div class="mx-auto flex max-w-[1080px] flex-col gap-8 px-[max(16px,env(safe-area-inset-left,0px))] pt-5 pb-28 sm:px-8 lg:pt-8 lg:pb-16">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-[26px] font-semibold tracking-[-0.02em]">Watchers</h1>
          <p class="text-muted-foreground mt-1 text-[14px]">Workflows that watch the numbers, propose an action and act once you approve.</p>
        </div>
        <button hlmBtn (click)="store.openBuilder()"><ng-icon name="phosphorSparkleFill" />New workflow by chat</button>
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
        <div class="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="w-list" class="text-[15px] font-semibold">Workflows{{ list().length ? ' · ' + list().length : '' }}</h2>
          @if (live.workflows.isLoading()) {
            <span class="text-muted-foreground text-[12.5px]" role="status">Loading…</span>
          }
        </div>
        @if (live.workflowsError(); as e) {
          <p role="alert" class="border-border mb-3 rounded-[10px] border border-dashed p-3 text-[13.5px]">Couldn’t load the workflows: {{ e }} <button hlmBtn variant="ghost" size="sm" (click)="live.workflows.reload()">Try again</button></p>
        }
        <ul class="grid gap-3">
          @for (w of list(); track w.id) {
            <li class="insight-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5" [class.opacity-70]="!w.enabled">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-[15px] font-semibold">
                    <button type="button" class="text-left hover:underline" (click)="open(w)">{{ w.name }}</button>
                  </h3>
                  @if (w.createdBy !== 'template') {
                    <span class="scope-chip">{{ w.createdBy === 'kassandra' ? 'by Kassandra' : 'yours' }}</span>
                  }
                  @if (!w.enabled) {
                    <span class="scope-chip">Paused</span>
                  }
                </div>
                <p class="text-muted-foreground mt-0.5 text-[13px]">{{ trigger(w) }} · {{ hotels(w.hotels) }} · {{ action(w) }}{{ w.delivery ? ' to ' + mask(w.delivery.to) : '' }} · {{ autonomy(w) }}</p>
                <p class="mt-1 text-[12.5px]">
                  @if (w.lastRun; as r) {
                    <span [class]="r.status === 'failed' ? 'text-(--negative)' : r.status === 'waiting_approval' ? 'text-(--decision)' : 'text-muted-foreground'">{{ runStatus(r.status) }}</span>
                    <span class="text-muted-foreground"> · last run {{ ago(r.at) }}</span>
                  } @else {
                    <span class="text-muted-foreground">Hasn’t run yet</span>
                  }
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <button type="button" class="toggle" role="switch" [attr.aria-checked]="w.enabled" [attr.aria-label]="(w.enabled ? 'Pause ' : 'Turn on ') + w.name" [disabled]="!!busy(w.id)" (click)="live.setEnabled(w, !w.enabled)"><i></i></button>
                <button hlmBtn variant="secondary" size="sm" [disabled]="!!busy(w.id) || w.lastRun?.status === 'running' || !w.enabled" (click)="live.runNow(w)">{{ busy(w.id) || (w.lastRun?.status === 'running' ? 'Running…' : 'Run now') }}</button>
                <button hlmBtn variant="ghost" size="sm" (click)="open(w)">Open</button>
              </div>
            </li>
          } @empty {
            @if (!live.workflows.isLoading() && !live.workflowsError()) {
              <li class="text-muted-foreground border-border rounded-xl border border-dashed p-6 text-center text-[14px]">No workflows yet. Describe one to Kassandra with “New workflow by chat”.</li>
            }
          }
        </ul>
      </section>

      <section aria-labelledby="w-audit">
        <div class="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="w-audit" class="text-[15px] font-semibold">Audit log</h2>
          <span class="text-muted-foreground text-[12.5px]">Compass writes nothing to source systems: approved actions become RMS tasks</span>
        </div>
        @if (audit().length) {
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
                @for (a of audit().slice(0, showAll() ? 200 : 8); track a.id) {
                  <tr class="border-border border-b align-top last:border-b-0">
                    <td class="text-muted-foreground px-4 py-2 whitespace-nowrap">{{ ago(a.at) }}</td>
                    <td class="px-4 py-2">{{ a.hotel_code }}</td>
                    <td class="px-4 py-2 whitespace-nowrap">{{ actionLabel(a.action) }}</td>
                    <td class="text-muted-foreground px-4 py-2 whitespace-nowrap">{{ a.by }}</td>
                    <td class="px-4 py-2"><span class="font-medium">{{ outcome(a.outcome) }}</span><span class="text-muted-foreground block max-w-[60ch] text-[12.5px]">{{ human(a.receipt) }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (audit().length > 8) {
            <button hlmBtn variant="ghost" size="sm" class="mt-2" (click)="showAll.set(!showAll())">{{ showAll() ? 'Show fewer' : 'Show all ' + audit().length }}</button>
          }
        } @else {
          <p class="text-muted-foreground text-[13.5px]">Nothing yet. Approved and automatic actions are recorded here.</p>
        }
      </section>
    </div>
  `,
})
export class WatchersView {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  protected readonly showAll = signal(false);
  protected readonly list = computed(() => [...this.live.workflowList()].sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)));
  protected readonly audit = computed(() => (this.live.audit.hasValue() ? this.live.audit.value() : []));
  protected readonly ago = ago;
  protected readonly trigger = triggerText;
  protected readonly hotels = hotelsText;
  protected readonly mask = maskEmail;

  constructor() {
    this.live.reloadAll();
  }
  protected action(w: Workflow) {
    return ACTION_LABEL[w.action.type] ?? w.action.type;
  }
  protected actionLabel(a: Workflow['action']['type']) {
    return ACTION_LABEL[a] ?? a;
  }
  protected autonomy(w: Workflow) {
    return w.action.type === 'email' ? 'No approval needed' : AUTONOMY_LABEL[w.autonomy];
  }
  protected runStatus(s: string) {
    return RUN_STATUS[s] ?? s;
  }
  protected outcome(o: string) {
    return ({ sent_to_rms: 'Sent to the RMS', suggested: 'Suggested', undone: 'Undone', emailed: 'Emailed' } as Record<string, string>)[o] ?? o;
  }
  protected human(s: string) {
    return humanizeText(s);
  }
  protected busy(id: string) {
    return this.live.busy()[id] ?? '';
  }
  protected open(w: Workflow) {
    this.store.activeWatcherId.set(w.id);
    this.store.go('watcher');
  }
}
