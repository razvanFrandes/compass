import { Component, DOCUMENT, DestroyRef, InjectionToken, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorWarningFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorArrowLeftLight, phosphorCheckLight, phosphorCircleNotchLight, phosphorPaperPlaneTiltLight, phosphorWifiSlashLight, phosphorXLight } from '@ng-icons/phosphor-icons/light';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { WorkflowDraft, WorkflowGraph } from '@compass/contracts';
import { CanvasResult, WorkflowCanvas } from './builder-canvas';
import { BuilderChat } from './builder-chat';
import { BuilderSocket, BuilderSocketOptions, builderSocketUrl, ensureDraftId, workflowToEdit, type BuilderRun } from './builder-socket';
import { issueText, maskAddress, toConversation } from './builder-steps';
import { scopeLabel, shortName, type HotelRef } from '../scope/hotels';
import { ScopeService } from '../scope/scope.service';
import { BUILDER_DESCRIBE } from '../store';

/** Overrides for the socket (a fake one in a preview or a test). */
export const BUILDER_SOCKET_OPTIONS = new InjectionToken<Partial<BuilderSocketOptions>>('BUILDER_SOCKET_OPTIONS');

export interface StatusChip {
  tone: 'neutral' | 'busy' | 'ok' | 'warn' | 'fail';
  text: string;
}

/** The one-line state of the draft, most urgent first. */
export function statusChip(state: {
  connection: 'connecting' | 'open' | 'reconnecting' | 'closed';
  loaded: boolean;
  issues: number;
  workflowId: string | null;
  saved: boolean;
  pending: 'save' | 'test' | null;
  run: BuilderRun | null;
}): StatusChip {
  if (state.connection === 'reconnecting' || state.connection === 'closed') return { tone: 'fail', text: 'Offline' };
  if (!state.loaded) return { tone: 'busy', text: 'Connecting…' };
  if (state.pending === 'test' || state.run?.status === 'running') return { tone: 'busy', text: 'Running a test…' };
  if (state.pending === 'save') return { tone: 'busy', text: 'Saving…' };
  if (state.issues > 0) return { tone: 'neutral', text: state.issues === 1 ? 'Draft · 1 detail missing' : `Draft · ${state.issues} details missing` };
  if (state.workflowId && state.saved) return { tone: 'ok', text: 'Saved' };
  if (state.workflowId) return { tone: 'warn', text: 'Unsaved changes' };
  return { tone: 'neutral', text: 'Ready to save' };
}

/** How a finished test reads under the canvas; nothing while it runs. `summary` is the run's own last word. */
export function testResult(run: BuilderRun | null, draft: WorkflowDraft, labelOf: (id: string) => string, summary: string | null): CanvasResult | null {
  if (!run || run.status === 'running') return null;
  if (run.status === 'waiting_approval') return { tone: 'warn', text: 'The test run needs your decision', detail: 'Approve or decline it in Agent Studio to let it finish.' };
  if (run.status === 'failed') {
    const where = run.failed ? labelOf(run.failed) : '';
    return { tone: 'fail', text: where ? `The test run stopped at “${where}”` : 'The test run couldn’t finish', detail: summary ?? 'Open the agent in Agent Studio to read its run log.' };
  }
  if (!run.done.includes('action')) return { tone: 'warn', text: 'The test run finished, but nothing was sent', detail: summary ?? 'Open the agent in Agent Studio to read its run log.' };
  const to = draft.action?.type === 'email' ? draft.delivery?.to : undefined;
  if (to) return { tone: 'ok', text: `Test email sent to ${maskAddress(to)}`, detail: 'Look for a subject that starts with “Test run ·” in your email.' };
  return { tone: 'ok', text: 'The test run finished' };
}

/** The steps the draft still needs, one line each, in plain words and in the order of the chain. */
export function missingSteps(issues: readonly string[]): string[] {
  const order = ['trigger', 'hotels', 'checks', 'name', 'goal', 'action', 'delivery'];
  const rank = (issue: string) => {
    const at = order.indexOf(issue.split(/[.:]/)[0]!);
    return at < 0 ? order.length : at;
  };
  return [...new Set([...issues].sort((a, b) => rank(a) - rank(b)).map(issueText))];
}

/**
 * The Hotels step with hotel names instead of codes: "Arbor Lisbon Chiado", "Europe · 8 hotels" or
 * "Lisbon Chiado + 2 more", with the names underneath. The server's graph carries the codes ("LIS, PAR, VIE").
 */
export function namedScope(graph: WorkflowGraph, hotels: readonly string[] | undefined, catalog: readonly HotelRef[]): WorkflowGraph {
  if (!hotels?.length || hotels.includes('ALL')) return graph;
  const chosen = catalog.filter((hotel) => hotels.includes(hotel.code));
  // A code the catalog does not know stays as the server wrote it.
  if (chosen.length !== new Set(hotels).size) return graph;
  const label = scopeLabel(hotels, catalog);
  const names = chosen.map(shortName).join(', ');
  // The names go underneath unless the label already is the names.
  const detail = chosen.length === 1 ? [chosen[0]!.city, chosen[0]!.country].filter(Boolean).join(', ') : names === label ? `${chosen.length} hotels` : names;
  return { ...graph, nodes: graph.nodes.map((node) => (node.id === 'scope' && node.state !== 'empty' ? { ...node, label, detail } : node)) };
}

/**
 * The workflow builder: the person describes a workflow in the chat, the agent fills in the chain on the canvas one
 * node per tool call, and "Send test now" runs it once while the nodes light up in order.
 */
@Component({
  selector: 'app-workflow-builder',
  imports: [NgIcon, BuilderChat, WorkflowCanvas, HlmButtonImports],
  providers: [provideIcons({ phosphorArrowLeftLight, phosphorCheckLight, phosphorCircleNotchLight, phosphorPaperPlaneTiltLight, phosphorWarningFill, phosphorWifiSlashLight, phosphorXLight })],
  host: { class: 'bg-background text-foreground flex min-h-dvh flex-col lg:h-dvh' },
  styles: `
    .wb-chip { display: inline-flex; flex-shrink: 0; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border-radius: 9999px; font-size: 12px; font-weight: 500; color: var(--muted-foreground); background: var(--overlay-hover); white-space: nowrap; }
    :host-context(:root.light) .wb-chip { --wb-tint: 6%; }
    .wb-chip::before { content: ''; width: 6px; height: 6px; border-radius: 9999px; background: currentColor; }
    .wb-chip[data-tone='ok'] { color: var(--positive); background: color-mix(in srgb, var(--positive) var(--wb-tint, 12%), transparent); }
    .wb-chip[data-tone='warn'] { color: var(--decision); background: color-mix(in srgb, var(--decision) var(--wb-tint, 12%), transparent); }
    .wb-chip[data-tone='fail'] { color: var(--negative); background: color-mix(in srgb, var(--negative) var(--wb-tint, 12%), transparent); }
    .wb-chip[data-tone='busy'] { color: var(--foreground); }
    .wb-chip[data-tone='busy']::before { animation: wb-blink 1.2s ease-in-out infinite; }
    @keyframes wb-blink { 50% { opacity: 0.25; } }
    .wb-off { opacity: 0.45; cursor: default; }
    .wb-off::after { display: none; }
    .wb-spin { animation: wb-spin 900ms linear infinite; }
    @keyframes wb-spin { to { transform: rotate(360deg); } }
    .wb-why {
      position: absolute; right: 0; top: calc(100% + 8px); z-index: 20; width: min(300px, calc(100vw - 32px)); padding: 12px 14px;
      border-radius: var(--radius-container, 12px); border: 1px solid var(--field-border); background: var(--popover); box-shadow: var(--popover-shadow, 0 16px 40px -16px rgb(0 0 0 / 0.7));
      font-size: 13px; line-height: 19px;
    }
    @media (prefers-reduced-motion: reduce) {
      .wb-chip[data-tone='busy']::before, .wb-spin { animation: none; }
    }
  `,
  template: `
    <header class="border-border/70 flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b px-3 py-2.5 sm:px-4 lg:min-h-14">
      <a hlmBtn variant="ghost" size="sm" [href]="backHref" class="text-muted-foreground -ml-1"><ng-icon name="phosphorArrowLeftLight" aria-hidden="true" />Agent Studio</a>
      <span class="text-muted-foreground" aria-hidden="true">/</span>
      <h1 class="min-w-0 truncate text-[14px] font-medium">{{ title() }}</h1>
      <span class="wb-chip" [attr.data-tone]="chip().tone"><span class="sr-only">Status: </span>{{ chip().text }}</span>

      <div class="relative ml-auto flex items-center gap-2" (mouseenter)="why.set(true)" (mouseleave)="why.set(false)" (focusin)="why.set(true)" (focusout)="why.set(false)" (keydown.escape)="why.set(false)">
        <button hlmBtn type="button" variant="outline" size="sm" [class.wb-off]="!canSave()" [attr.aria-disabled]="canSave() ? null : 'true'" [attr.aria-describedby]="!canSave() && blockers().length ? whyId : null" (click)="save()">
          @if (socket.pending() === 'save') {
            <ng-icon name="phosphorCircleNotchLight" class="wb-spin" aria-hidden="true" />Saving…
          } @else if (isSaved()) {
            <ng-icon name="phosphorCheckLight" aria-hidden="true" />Saved
          } @else {
            Save agent
          }
        </button>
        <button hlmBtn type="button" size="sm" [class.wb-off]="!canTest()" [attr.aria-disabled]="canTest() ? null : 'true'" [attr.aria-describedby]="!canTest() && blockers().length ? whyId : null" (click)="test()">
          @if (testing()) {
            <ng-icon name="phosphorCircleNotchLight" class="wb-spin" aria-hidden="true" />Running a test…
          } @else {
            <ng-icon name="phosphorPaperPlaneTiltLight" aria-hidden="true" />Run a test
          }
        </button>
        <!-- Why a button is off: always in the page for assistive technology, on screen on hover and focus. -->
        @if (blockers().length) {
          <div role="tooltip" [id]="whyId" [class]="why() ? 'wb-why' : 'sr-only'">
            <p class="font-medium">{{ blockersTitle() }}</p>
            <ul class="text-muted-foreground mt-1.5 flex list-disc flex-col gap-0.5 pl-4">
              @for (blocker of blockers(); track blocker) {
                <li>{{ blocker }}</li>
              }
            </ul>
          </div>
        }
      </div>
    </header>

    @if (offline()) {
      <div class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-(--field-border) bg-(--field) px-4 py-2 text-[13px]" role="status">
        <ng-icon name="phosphorWifiSlashLight" class="text-[16px] text-(--negative)" aria-hidden="true" />
        <span>The connection dropped. Reconnecting now; your draft is safe.</span>
        <button hlmBtn type="button" variant="link" size="sm" (click)="socket.reconnect()">Try again</button>
      </div>
    }
    @if (editFailed()) {
      <div class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-(--field-border) bg-(--decision-tint) px-4 py-2 text-[13px]/5" role="alert">
        <ng-icon name="phosphorWarningFill" class="shrink-0 text-[16px] text-(--decision)" aria-hidden="true" />
        <span>Couldn’t open this agent for editing, so changes made here won’t reach it. Go back and open it again.</span>
        <a hlmBtn variant="link" size="sm" [href]="backHref">Back to Agent Studio</a>
      </div>
    }
    @if (socket.error(); as message) {
      <div class="flex shrink-0 items-start gap-2.5 border-b border-(--field-border) bg-(--decision-tint) px-4 py-2 text-[13px]/5" role="alert">
        <ng-icon name="phosphorWarningFill" class="mt-0.5 shrink-0 text-[16px] text-(--decision)" aria-hidden="true" />
        <p class="min-w-0 flex-1">{{ message }}</p>
        <button hlmBtn type="button" variant="ghost" size="icon-xs" aria-label="Dismiss this message" (click)="socket.dismissError()"><ng-icon name="phosphorXLight" /></button>
      </div>
    }

    <main class="grid grid-cols-[minmax(0,1fr)] lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(360px,460px)_minmax(0,1fr)]">
      <section class="border-border/70 flex min-w-0 flex-col lg:min-h-0 lg:border-r" aria-label="Chat">
        <app-builder-chat class="lg:min-h-0 lg:flex-1" [describe]="describe" [items]="conversation()" [running]="socket.live().running" [online]="!offline()" (ask)="socket.ask($event)" (stop)="socket.abort()" />
      </section>
      <section class="border-border/70 min-w-0 max-lg:border-t lg:min-h-0" aria-label="Agent">
        <app-workflow-canvas
          class="lg:h-full lg:overflow-y-auto"
          [graph]="graph()"
          [draft]="socket.draft()"
          [changed]="socket.changed()"
          [revision]="socket.revision()"
          [run]="socket.run()"
          [result]="result()"
          [lockReason]="lockReason()"
          (edit)="socket.edit($event)"
        />
      </section>
    </main>
  `,
})
export class WorkflowBuilder {
  private readonly doc = inject(DOCUMENT);
  private readonly scope = inject(ScopeService);
  /** The workflow being edited (`/workflows/<id>/edit`), or null for a new one. */
  protected readonly editId = workflowToEdit(this.doc.defaultView!.location);
  /** `?describe=…` (from "Watch this" on a brief finding): what the chat's field opens with on a new agent. */
  protected readonly describe = this.editId ? null : (new URLSearchParams(this.doc.defaultView!.location.search).get(BUILDER_DESCRIBE)?.slice(0, 600) ?? null);
  protected readonly backHref = this.editId ? `/studio/${encodeURIComponent(this.editId)}` : '/studio';
  protected readonly socket = this.connect();
  private static next = 0;
  protected readonly whyId = `wb-why-${WorkflowBuilder.next++}`;
  protected readonly why = signal(false);

  protected readonly conversation = computed(() => toConversation(this.socket.entries(), this.socket.live()));
  protected readonly title = computed(() => {
    const name = this.socket.draft().name?.trim();
    if (this.editId) return name ? `Edit · ${name}` : 'Edit agent';
    return name || 'New agent';
  });
  protected readonly graph = computed(() => namedScope(this.socket.graph(), this.socket.draft().hotels, this.scope.catalog()));
  /** An edit link whose workflow the server did not load: the draft came back empty and unsaved. */
  protected readonly editFailed = computed(() => !!this.editId && this.socket.loaded() && this.socket.workflowId() === null && !this.socket.draft().name);
  protected readonly offline = computed(() => this.socket.state() === 'reconnecting' || this.socket.state() === 'closed');
  protected readonly testing = computed(() => this.socket.pending() === 'test' || this.socket.run()?.status === 'running');
  protected readonly isSaved = computed(() => this.socket.workflowId() !== null && this.socket.saved() && !this.socket.issues().length);

  protected readonly chip = computed(() =>
    statusChip({
      connection: this.socket.state(),
      loaded: this.socket.loaded(),
      issues: missingSteps(this.socket.issues()).length,
      workflowId: this.socket.workflowId(),
      saved: this.socket.saved(),
      pending: this.socket.pending(),
      run: this.socket.run(),
    }),
  );

  /** What keeps Save and Send test off, in the order the person can fix it. */
  protected readonly blockers = computed(() => {
    if (this.offline()) return ['You’re offline. Reconnecting now.'];
    if (!this.socket.loaded()) return ['The draft is still loading.'];
    if (this.testing()) return ['A test run is in progress.'];
    return missingSteps(this.socket.issues());
  });
  protected readonly blockersTitle = computed(() => (this.socket.loaded() && !this.offline() && !this.testing() ? 'Still needed before you can save' : 'Not available yet'));
  private readonly ready = computed(() => this.socket.loaded() && !this.offline() && !this.testing() && !this.socket.issues().length);
  protected readonly canSave = computed(() => this.ready() && !this.isSaved() && this.socket.pending() === null);
  protected readonly canTest = computed(() => this.ready() && this.socket.pending() === null);

  protected readonly lockReason = computed(() => {
    if (this.offline()) return 'Editing is paused until the connection is back.';
    return this.testing() ? 'Editing is paused while the test runs.' : '';
  });

  /** A test that ended without a mail explains itself in the run's summary (docs/api.md): read it once. */
  private readonly summary = resource({
    params: () => {
      const run = this.socket.run();
      if (!run || run.status === 'running' || run.status === 'waiting_approval') return undefined;
      return run.status === 'failed' || !run.done.includes('action') ? run.runId : undefined;
    },
    loader: async ({ params, abortSignal }) => {
      try {
        const response = await fetch(`/api/runs/${encodeURIComponent(params)}`, { signal: abortSignal });
        if (!response.ok) return null;
        const body = (await response.json()) as { run?: { summary?: string | null } };
        return body.run?.summary?.trim() || null;
      } catch {
        return null;
      }
    },
  });

  protected readonly result = computed(() =>
    testResult(this.socket.run(), this.socket.draft(), (id) => this.graph().nodes.find((node) => node.id === id)?.label ?? '', this.summary.value() ?? null),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.socket.close());
    // A new workflow starts on the hotels the person is working on (the sidebar scope), once, when the draft
    // arrives untouched. It shows on the Hotels step and can be changed there like any other edit.
    let decided = false;
    effect(() => {
      if (decided || !this.socket.loaded()) return;
      decided = true;
      untracked(() => {
        const hotels = this.scope.hotels();
        const untouched = !this.editId && this.socket.workflowId() === null && !this.socket.draft().hotels?.length && !this.socket.entries().length;
        if (untouched && hotels.length) this.socket.edit({ hotels });
      });
    });
  }

  protected save() {
    if (this.canSave()) this.socket.save();
  }

  protected test() {
    if (this.canTest()) this.socket.test();
  }

  private connect(): BuilderSocket {
    const overrides = inject(BUILDER_SOCKET_OPTIONS, { optional: true }) ?? {};
    const view = this.doc.defaultView!;
    return new BuilderSocket({ url: builderSocketUrl(view.location, ensureDraftId(view.location, view.history), this.editId), ...overrides });
  }
}
