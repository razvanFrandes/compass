import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { type WorkflowDraft, specToGraph } from '@compass/contracts';
import type { AnswerMode } from '@compass/contracts';
import type { BuilderRun } from '../../builder/builder-socket';
import { WorkflowCanvas } from '../../builder/builder-canvas';
import { SPECIMENS } from '../../charts/catalog-samples';
import { WidgetChart, type WidgetLoading } from '../../charts/widget-chart';
import { DataTable } from '../../evidence/data-table';
import { EvidencePanel } from '../../evidence/evidence-panel';
import { KassandraComposer } from '../../kassandra/kassandra-composer';
import { KassandraConversation } from '../../kassandra/kassandra-conversation';
import { JuyoOrb, type OrbState } from '../../orb/juyo-orb';
import { ProposalCard } from '../../proposal-card';
import { HotelPicker } from '../../scope/hotel-picker';
import { scopeLabel } from '../../scope/hotels';
import { ScopeService } from '../../scope/scope.service';
import { CompassStore } from '../../store';
import { DOCS_KIT } from '../docs-kit';
import { PACE_ANSWER, PACE_COLUMNS_PUBLIC, PACE_ROWS, SAMPLE_DRAFT, SAMPLE_ENTRIES, SAMPLE_PROPOSAL, SAMPLE_RUNS, SAMPLE_TILES, SAMPLE_TURNS, WHEN_TO_USE } from './component-samples';

const SECTIONS = [
  { id: 'charts', label: 'Charts' },
  { id: 'kpi', label: 'KPI tiles' },
  { id: 'findings', label: 'Findings' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'kassandra', label: 'Kassandra' },
  { id: 'scope', label: 'Scope picker' },
  { id: 'agents', label: 'Agent card' },
  { id: 'builder', label: 'Builder nodes' },
  { id: 'orb', label: 'Orb' },
  { id: 'skeletons', label: 'Skeletons' },
] as const;

const RUN_LABEL: Record<string, string> = { none: 'nothing found', finding: 'a finding', pending: 'waiting for a decision', failed: 'failed', skipped: 'skipped' };

/**
 * /docs/components: every component that can appear in an answer or on a board, as a live example with one line
 * on when to use it. The examples are the app's own components, fed sample rows.
 */
@Component({
  selector: 'docs-components',
  imports: [...DOCS_KIT, HlmButtonImports, WidgetChart, DataTable, EvidencePanel, KassandraComposer, KassandraConversation, HotelPicker, WorkflowCanvas, JuyoOrb, ProposalCard],
  host: { class: 'block' },
  styles: `
    .when {
      font-size: 13px;
      line-height: 1.45;
      color: var(--muted-foreground);
    }
    .kind {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--foreground);
    }
    .jump {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: var(--chip-radius, 9999px);
      font-size: 12.5px;
      color: var(--muted-foreground);
    }
    .jump:hover {
      color: var(--foreground);
      border-color: var(--input);
    }
    .jump:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
    @media (pointer: coarse) {
      .jump {
        min-height: 44px;
      }
    }
    .example {
      min-width: 0;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: var(--radius-container, 14px);
      background: var(--background);
    }
    @media (max-width: 479.98px) {
      .example {
        padding: 14px;
      }
    }
  `,
  template: `
    <div class="flex flex-col gap-section-lg">
      <div>
        <docs-head
          eyebrow="Docs · Components"
          title="Every part that can appear in an answer or on a board"
          lede="Kassandra does not write markup. She chooses a component from this catalogue and names the data; the component formats the values and draws itself. Each example below is the real component with sample rows, with one line on when to use it."
        />
        <nav class="mt-5 flex flex-wrap gap-2" aria-label="Sections of this page">
          @for (s of sections; track s.id) {
            <button type="button" class="jump" (click)="jump(s.id)">{{ s.label }}</button>
          }
        </nav>
      </div>

      <docs-section heading="Charts" anchor="charts" [note]="kinds + ' widget kinds, drawn by one component, \`juyo-widget-chart\`, from one spec and one set of colour tokens. Each offers the same rows as a table.'">
        <ul class="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          @for (c of charts; track c.id) {
            <li class="docs-panel flex min-w-0 flex-col gap-3 p-4" [class.lg:col-span-2]="c.wide">
              <p class="flex flex-wrap items-baseline gap-x-2.5"><span class="kind">{{ c.spec.kind }}</span><span class="when">{{ c.when }}</span></p>
              @defer (on viewport) {
                <juyo-widget-chart [spec]="c.spec" [rows]="c.rows" [columns]="c.columns" [compact]="true" />
              } @placeholder {
                <div class="h-[260px]" aria-hidden="true"></div>
              }
            </li>
          }
        </ul>
        <p class="text-muted-foreground mt-4 text-[13.5px]">The <a class="docs-link" href="/catalog" (click)="catalog($event)">chart catalogue</a> shows each kind in both themes and both modes, at both densities and in every loading state.</p>
      </docs-section>

      <docs-section heading="KPI tiles" anchor="kpi" note="Use a tile for a figure the reader checks every morning. Each tile is a button: it asks Kassandra why the figure moved. The solid line is this year, the dashed one the same time last year.">
        <div class="example">
          <ul class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            @for (m of tiles; track m.label) {
              <li>
                <button type="button" class="clickable-card flex w-full flex-col items-stretch gap-1 p-3.5 text-left" (click)="asked.set('What drove the portfolio’s ' + m.label.toLowerCase() + ' for the next 30 nights?')">
                  <span class="text-muted-foreground text-[12px]">{{ m.label }}</span>
                  <span class="text-[24px]/tight font-semibold tracking-[-0.02em] tabular-nums">{{ m.value }}</span>
                  <svg viewBox="0 0 120 40" preserveAspectRatio="none" class="mt-1 h-10 w-full" aria-hidden="true">
                    <path [attr.d]="m.ly" fill="none" class="stroke-(--series-muted)" stroke-width="1.25" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
                    <path [attr.d]="m.ty" fill="none" class="stroke-(--series)" stroke-width="1.75" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                  </svg>
                  <span class="text-muted-foreground text-[12px] tabular-nums">{{ m.delta }} <span class="sr-only">versus last year.</span></span>
                  <span class="text-muted-foreground text-[12px]">Ask why <span aria-hidden="true">→</span></span>
                </button>
              </li>
            }
          </ul>
        </div>
      </docs-section>

      <docs-section heading="Finding and decision cards" anchor="findings" note="A finding card states one thing that changed, with its money. A decision card is the only orange thing on a screen: use it when a person has to say yes or no.">
        <div class="example grid gap-4 lg:grid-cols-2">
          <article class="insight-card flex flex-col p-5">
            <div class="flex items-start justify-between gap-3">
              <h3 class="text-[16px]/[1.35] font-semibold tracking-[-0.01em]">Barcelona Mar has 26 of 300 rooms out of order</h3>
              <span class="money-chip shrink-0">−€115k</span>
            </div>
            <p class="text-muted-foreground mt-2 text-[14px]">An average of 25.7 rooms are out of order over the next 30 days, which puts about €115k of room revenue at risk. <span class="ai-tag">AI</span></p>
            <p class="text-muted-foreground mt-2 text-[12.5px]">Room inventory · next 30 days</p>
            <div class="mt-auto pt-4"><button hlmBtn variant="secondary" size="sm" (click)="asked.set('Why does Barcelona have rooms out of order, and what are guests saying?')">Explore</button></div>
          </article>
          <div inert><app-proposal-card [proposal]="proposal" /></div>
        </div>
        <p class="text-muted-foreground mt-3 text-[13px]">The decision card is the real component, shown inert: on the Inbox, Approve and Deny act on a real proposal. The small “AI” tag marks the one sentence a model wrote.</p>
      </docs-section>

      <docs-section heading="Evidence panel and data table" anchor="evidence" note="Use the panel wherever an answer quotes a number. It leads with the figures the answer used, then the sources, the definitions, the period and the SQL. The table hides plumbing columns, shows hotels by name and formats each value from its column’s kind.">
        <div class="grid gap-4 xl:grid-cols-2">
          <div class="example">
            <p class="docs-k mb-3">juyo-evidence-panel</p>
            <juyo-evidence-panel [entries]="entries" [answer]="answer" [focusCallId]="focus()" />
          </div>
          <div class="example">
            <p class="docs-k mb-3">juyo-data-table</p>
            <juyo-data-table [rows]="rows" [columns]="columns" caption="Pace vs last year, five hotels" businessDate="2026-11-20" />
          </div>
        </div>
      </docs-section>

      <docs-section heading="Kassandra: composer and conversation" anchor="kassandra" note="One composer and one conversation component, wherever Kassandra appears. The steps stay collapsed above the answer, and a widget sits in a card that never changes size.">
        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div class="example">
            <p class="docs-k">kassandra-conversation</p>
            <kassandra-conversation [turns]="turns" [addToBoard]="false" (evidenceSelected)="focus.set($event.callId)" />
          </div>
          <div class="example flex flex-col gap-4 self-start">
            <p class="docs-k">kassandra-composer</p>
            <kassandra-composer inputId="docs-composer" placeholder="Ask about any hotel, night or metric…" [(mode)]="mode" (submitted)="asked.set($event)" />
            <p class="text-muted-foreground text-[13px]" role="status">
              @if (asked(); as q) {
                You asked: “{{ q }}”. Nothing was sent: this page is an example.
              } @else {
                Type a question and press Enter. On this page nothing is sent.
              }
            </p>
          </div>
        </div>
      </docs-section>

      <docs-section heading="Scope picker" anchor="scope" note="Use it wherever a person chooses hotels: the sidebar, a page header, a workflow’s Hotels step. A region or a brand adds its hotels in one pick. This example keeps its own selection; the sidebar’s picker sets the scope of the whole app.">
        <div class="example">
          <p class="mb-3 flex flex-wrap gap-x-2 text-[13.5px]" role="status"><span class="text-muted-foreground">Selection:</span><span class="font-medium">{{ pickedLabel() }}</span></p>
          <div class="flex h-[380px] max-w-[520px] flex-col">
            <app-hotel-picker [hotels]="scope.catalog()" [(value)]="picked" label="Hotels for this example" />
          </div>
        </div>
      </docs-section>

      <docs-section heading="Agent card and run strip" anchor="agents" note="One card per agent in Agent Studio: what it found last, how its last 14 runs went and how far it may go. In the strip, height carries the outcome, so it reads without colour: tall means it found something.">
        <div class="example">
          <article class="insight-card flex max-w-[560px] flex-col gap-3.5 p-[18px]" aria-label="Sample agent: Event pricing watch">
            <div>
              <div class="flex items-start gap-3">
                <h3 class="min-w-0 flex-1 text-[16px]/snug font-semibold tracking-[-0.01em]">Event pricing watch</h3>
                <span class="status-chip status-chip--needs">Needs you</span>
              </div>
              <p class="text-muted-foreground mt-1 text-[13px]/snug">When the brief finds underpriced demand · Dubai Business Bay</p>
            </div>
            <div class="rounded-[10px] border border-(--field-border) bg-(--field) px-3 py-2.5">
              <p class="docs-k">Latest finding <span class="font-normal tracking-normal normal-case">· 2 h ago</span></p>
              <p class="mt-1 text-[13.5px]/snug">Raise BAR to the comp-set median for 16–18 Dec: 0.78× the market while 83% full.</p>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div class="flex items-center gap-3">
                <div class="run-strip w-[132px]" role="img" [attr.aria-label]="runsLabel()">
                  @for (r of runs(); track $index) {
                    <i class="run" [class]="r === 'none' ? '' : 'run--' + r"></i>
                  }
                </div>
                <span class="text-muted-foreground text-[12.5px]" aria-hidden="true">last {{ runs().length }} runs</span>
              </div>
              <p class="text-muted-foreground text-[12.5px] tabular-nums">Next run tomorrow 05:00 UTC</p>
            </div>
            <div class="border-border/70 flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t pt-3.5">
              <div class="flex items-center gap-2 text-[13px]">
                <button type="button" class="toggle" role="switch" [attr.aria-checked]="enabled()" [attr.aria-label]="(enabled() ? 'Pause' : 'Turn on') + ' the sample agent'" (click)="enabled.set(!enabled())"><i></i></button>
                <span class="text-muted-foreground" aria-hidden="true">{{ enabled() ? 'On' : 'Paused' }}</span>
              </div>
              <div class="seg" role="radiogroup" aria-label="How far the sample agent may go">
                @for (l of levels; track l.id) {
                  <button type="button" role="radio" [attr.aria-checked]="autonomy() === l.id" (click)="autonomy.set(l.id)">{{ l.label }}</button>
                }
              </div>
              <button hlmBtn variant="secondary" size="sm" class="ml-auto" [disabled]="!enabled()" (click)="runNow()">Run now</button>
            </div>
          </article>
          <p class="text-muted-foreground mt-3 text-[13px]">A static copy of the card in Agent Studio. “Run now” here only adds a tick to the strip.</p>
        </div>
      </docs-section>

      <docs-section heading="Builder canvas nodes" anchor="builder" note="A workflow is one chain: trigger → hotels → checks → analysis → approval → action. The chain is derived from the workflow’s spec by \`specToGraph\`, so the agent cannot draw a graph the runner cannot execute. Click a node to edit it by hand; play a test to see the nodes light up in order.">
        <div class="example">
          <div class="mb-3 flex flex-wrap items-center gap-3">
            <button hlmBtn variant="secondary" size="sm" [disabled]="!!run()" (click)="playRun()">{{ run() ? 'Running the test…' : 'Play a test run' }}</button>
            <span class="text-muted-foreground text-[13px]">This canvas is not connected to an agent: edits stay on this page.</span>
          </div>
          <div class="border-border h-[640px] overflow-hidden rounded-xl border">
            <app-workflow-canvas class="h-full" [graph]="graph()" [draft]="draft()" [run]="run()" [revision]="revision()" (edit)="edit($event)" />
          </div>
        </div>
      </docs-section>

      <docs-section heading="The orb" anchor="orb" note="Kassandra’s presence while she listens and thinks. It is the only colour in the ask bar, and it appears in voice mode only: at rest the composer shows a flat mark, so a page of composers holds no WebGL context.">
        <div class="example flex flex-wrap items-center gap-x-8 gap-y-5">
          <juyo-orb [size]="132" [state]="orb()" [level]="orb() === 'listening' || orb() === 'speaking' ? 0.55 : 0" />
          <div class="flex min-w-0 flex-col gap-3">
            <div class="seg self-start" role="radiogroup" aria-label="Orb state">
              @for (s of orbStates; track s) {
                <button type="button" role="radio" [attr.aria-checked]="orb() === s" (click)="orb.set(s)">{{ s }}</button>
              }
            </div>
            <p class="text-muted-foreground flex items-center gap-2.5 text-[13.5px]"><span class="orb-mark block shrink-0" aria-hidden="true"></span>The mark the composer shows at rest.</p>
            <p class="text-muted-foreground text-[13.5px]"><a class="docs-link" href="/orb-lab">Open the orb lab</a>&ngsp;for sizes, a real microphone and every state.</p>
          </div>
        </div>
      </docs-section>

      <docs-section heading="Skeleton states" anchor="skeletons" note="Every catalogue component has a skeleton with the same dimensions as the finished component. A streamed widget passes through three states in one box, and the box never changes size.">
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <button hlmBtn variant="secondary" size="sm" [disabled]="playing()" (click)="replay()">{{ playing() ? 'Streaming…' : 'Replay the stream' }}</button>
          <span class="text-muted-foreground text-[13px]" role="status">{{ playing() ? 'Showing: ' + stateName(stream()) : 'Each card below holds one state.' }}</span>
        </div>
        <ul class="grid gap-4 lg:grid-cols-3">
          @for (s of states; track s.value) {
            <li class="docs-panel flex min-w-0 flex-col gap-3 p-4">
              <p class="flex flex-wrap items-baseline gap-x-2.5"><span class="kind">{{ s.label }}</span><span class="when">{{ s.when }}</span></p>
              <juyo-widget-chart [spec]="line.spec" [rows]="line.rows" [columns]="line.columns" [compact]="true" [loading]="playing() ? stream() : s.value" />
            </li>
          }
        </ul>
      </docs-section>
    </div>
  `,
})
export class DocsComponents {
  protected readonly scope = inject(ScopeService);
  private readonly store = inject(CompassStore);

  protected readonly sections = SECTIONS;
  /** One specimen per widget kind, from the catalogue's own samples. */
  protected readonly charts = SPECIMENS.filter((g) => g.id !== 'fallbacks')
    .flatMap((g) => g.items)
    .map((s) => ({ ...s, when: WHEN_TO_USE[s.spec.kind] }));
  protected readonly kinds = new Set(this.charts.map((c) => c.spec.kind)).size;
  protected readonly line = this.charts.find((c) => c.spec.kind === 'line') ?? this.charts[0]!;

  protected readonly tiles = SAMPLE_TILES;
  protected readonly proposal = SAMPLE_PROPOSAL;
  protected readonly entries = SAMPLE_ENTRIES;
  protected readonly answer = PACE_ANSWER;
  protected readonly rows = PACE_ROWS;
  protected readonly columns = PACE_COLUMNS_PUBLIC;
  protected readonly turns = SAMPLE_TURNS;

  /** The evidence card the conversation asked to see. */
  protected readonly focus = signal<string | null>(null);
  protected readonly mode = signal<AnswerMode>('thinker');
  protected readonly asked = signal('');

  protected readonly picked = signal<string[]>(['LIS', 'AMS']);
  protected readonly pickedLabel = computed(() => scopeLabel(this.picked(), this.scope.catalog()));

  /* The sample agent card */
  protected readonly runs = signal<string[]>([...SAMPLE_RUNS]);
  protected readonly runsLabel = computed(() => {
    const counts = new Map<string, number>();
    for (const r of this.runs()) counts.set(r, (counts.get(r) ?? 0) + 1);
    return `Last ${this.runs().length} runs: ${[...counts].map(([k, n]) => `${n} ${RUN_LABEL[k] ?? k}`).join(', ')}.`;
  });
  protected readonly enabled = signal(true);
  protected readonly levels = [
    { id: 'suggest', label: 'Suggest' },
    { id: 'approve', label: 'Ask first' },
    { id: 'auto_low_risk', label: 'Act alone' },
  ] as const;
  protected readonly autonomy = signal<'suggest' | 'approve' | 'auto_low_risk'>('approve');

  /* The sample workflow on the canvas */
  protected readonly draft = signal<WorkflowDraft>(SAMPLE_DRAFT);
  protected readonly graph = computed(() => specToGraph(this.draft()));
  protected readonly revision = signal(0);
  protected readonly run = signal<BuilderRun | null>(null);

  protected readonly orbStates: readonly OrbState[] = ['idle', 'listening', 'thinking', 'speaking'];
  protected readonly orb = signal<OrbState>('thinking');

  /* Skeleton states */
  protected readonly states: { value: WidgetLoading; label: string; when: string }[] = [
    { value: 'skeleton', label: 'skeleton', when: 'The widget is chosen; its title is not known yet.' },
    { value: 'title', label: 'title', when: 'The title is real; the rows are on their way.' },
    { value: 'none', label: 'loaded', when: 'The chart takes the skeleton’s place.' },
  ];
  protected readonly stream = signal<WidgetLoading>('none');
  protected readonly playing = signal(false);

  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }

  protected stateName(state: WidgetLoading) {
    return this.states.find((s) => s.value === state)?.label ?? state;
  }

  protected jump(id: string) {
    const doc = globalThis.document;
    const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    doc?.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  protected catalog(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.store.go('catalog');
  }

  protected runNow() {
    this.runs.update((r) => [...r.slice(1), 'finding']);
  }

  /** A manual edit on the canvas: the draft changes and the chain is derived again. */
  protected edit(patch: WorkflowDraft) {
    this.draft.update((d) => ({ ...d, ...patch }));
    this.revision.update((n) => n + 1);
  }

  /** Lights the nodes in order, the way a real test run reports its progress. */
  protected playRun() {
    const ids = this.graph().nodes.map((n) => n.id);
    this.timers.forEach(clearTimeout);
    this.timers = ids.map((id, i) => setTimeout(() => this.run.set({ runId: 'docs', status: 'running', activeNode: id, done: ids.slice(0, i), failed: null }), i * 750));
    this.timers.push(setTimeout(() => this.run.set({ runId: 'docs', status: 'done', activeNode: null, done: ids, failed: null }), ids.length * 750));
    this.timers.push(setTimeout(() => this.run.set(null), ids.length * 750 + 1600));
  }

  /** Plays the three states in every card, the way a streamed answer fills in. */
  protected replay() {
    this.playing.set(true);
    this.stream.set('skeleton');
    this.timers.push(
      setTimeout(() => this.stream.set('title'), 1400),
      setTimeout(() => this.stream.set('none'), 2800),
      setTimeout(() => this.playing.set(false), 4200),
    );
  }
}
