import { Component, DOCUMENT, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { ChartCard } from './chart-card';
import { FilterBar } from './filter-bar';
import { COMPARES, DEFAULTS, Filters, parseFilterRequest, scopeChips } from './filters';
import { PORTFOLIO_SPECS, kpiWidget, kpis, type ChartSpec } from './portfolio';
import type { ChartSize } from './theme/density';
import { KassandraComposer } from './kassandra/kassandra-composer';
import { KassandraDescribeView } from './kassandra/kassandra-describe-view';
import { Live, ago } from './live';
import { CompassStore, DUBAI_BOARD, PORTFOLIO_BOARD } from './store';
import { METRICS, MetricKey, NIGHTS, Range, metricSeries, metricTotal } from './data';
import { ProposalCard } from './proposal-card';
import { BoardsService } from './boards/boards.service';
import type { Board, BoardWidget } from './boards/types';
import { ViewAs } from './charts/view-as';
import { WidgetChart, subtitleWithUnit } from './charts/widget-chart';
import type { EvidenceColumn, WidgetSpec } from './charts/widget-types';
import { tidyBoardWidget } from './widget-tidy';
import { formatDate, formatPeriod } from './evidence/format';
import { sourceLabel } from './evidence/labels';
import * as icons from './icons';
import { BoardCardVisual } from './boards/board-card-visual';
import { boardCard, previewItems, type CardHeadline } from './boards/board-preview-model';
import { BOARDS_ASKS, boardAsks } from './boards/board-asks';
import { KassandraDock } from './kassandra/kassandra-dock';
import { hotelCatalog } from './charts/hotel-names';

/** Boards that come with the product, computed in the browser from the Halcyon extract (they have filters). */
export const BUILT_IN = [
  { id: PORTFOLIO_BOARD, name: 'Portfolio', description: 'All 20 hotels against budget and last year: pace, pickup, forecast, mix, comp set and P&L' },
  { id: DUBAI_BOARD, name: 'Dubai Business Bay', description: 'Pace and rates for one hotel, and the decisions waiting on it' },
] as const;
export const isBuiltIn = (id: string) => BUILT_IN.some((b) => b.id === id);

/** One chart, four metrics: the KPI strip picks the metric; this year against the same time last year. */
@Component({
  selector: 'app-performance-widget',
  imports: [WidgetChart],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h2 class="text-[14px] font-semibold tracking-[-0.01em]">Performance</h2>
      <div class="op-toggle" role="radiogroup" aria-label="Nights">
        <button type="button" role="radio" [attr.aria-checked]="range() === 'forward'" [attr.tabindex]="range() === 'forward' ? 0 : -1" (click)="range.set('forward')" (keydown)="rangeKey($event)">Next 45 nights</button>
        <button type="button" role="radio" [attr.aria-checked]="range() === 'past'" [attr.tabindex]="range() === 'past' ? 0 : -1" (click)="range.set('past')" (keydown)="rangeKey($event)">Last 45 nights</button>
      </div>
    </div>

    <div class="mt-card-pad grid grid-cols-2 gap-y-2 sm:grid-cols-4" role="group" aria-label="Metric">
      @for (k of kpis(); track k.key) {
        <button type="button" [attr.aria-pressed]="metric() === k.key" (click)="metric.set(k.key)" class="flex flex-col items-start gap-1 border-t pt-3 pb-1 text-left sm:pr-4" [class]="metric() === k.key ? 'border-foreground' : 'border-border/70'">
          <span class="text-[12.5px]" [class]="metric() === k.key ? 'text-foreground font-medium' : 'text-muted-foreground'">{{ k.label }}</span>
          <span class="text-[22px]/none font-[520] tracking-[-0.02em] tabular-nums">{{ k.value }}</span>
          <span class="text-muted-foreground text-[12px] tabular-nums">{{ k.arrow }} {{ k.deltaText }} vs last year</span>
        </button>
      }
    </div>

    <div class="-mx-1 mt-card-pad sm:-mx-2">
      @let w = widget();
      <juyo-widget-chart [spec]="w.spec" [rows]="w.rows" [columns]="w.columns" [header]="false" [switcher]="true" controls="external" [height]="chartHeight" />
    </div>
  `,
})
export class PerformanceWidget {
  private readonly doc = inject(DOCUMENT);
  protected readonly range = signal<Range>('forward');
  protected readonly metric = signal<MetricKey>('occupancy');
  protected readonly chartHeight = this.doc.defaultView && this.doc.defaultView.innerWidth < 640 ? 220 : 260;
  protected readonly nights = computed(() => NIGHTS[this.range()]);
  protected readonly meta = computed(() => METRICS[this.metric()]);
  /** The chosen figure by night, this year against the same time last year: a line, drawn by the one chart system. */
  protected readonly widget = computed(() => {
    const key = this.metric();
    const m = this.meta();
    const ty = metricSeries(this.nights(), key);
    const ly = metricSeries(this.nights(), key, true);
    const kind: EvidenceColumn['kind'] = key === 'occupancy' ? 'percent' : 'currency';
    const unit = key === 'occupancy' ? undefined : 'EUR';
    const forward = this.range() === 'forward';
    const spec: WidgetSpec = { kind: 'line', title: `${m.label} by night`, subtitle: forward ? 'Next 45 nights, on the books' : 'Last 45 nights', sourceCallId: `dubai:${key}:${this.range()}`, x: 'stay_date', y: ['value'], compare: 'last_year' };
    return {
      spec,
      rows: this.nights().map((n, i) => ({ stay_date: new Date(n.date).toISOString().slice(0, 10), value: ty[i], last_year: ly[i] })),
      columns: [
        { key: 'stay_date', label: 'Night of stay', kind: 'date' as const },
        { key: 'value', label: forward ? 'This year, on the books' : 'This year', kind, ...(unit ? { unit } : {}) },
        { key: 'last_year', label: 'Same time last year', kind, ...(unit ? { unit } : {}) },
      ],
    };
  });
  protected readonly kpis = computed(() =>
    (Object.keys(METRICS) as MetricKey[]).map((key) => {
      const m = METRICS[key];
      const ty = metricTotal(this.nights(), key);
      const ly = metricTotal(this.nights(), key, true);
      const delta = m.deltaUnit === 'pt' ? ty - ly : ((ty - ly) / ly) * 100;
      const flat = Math.abs(delta) < 0.05;
      return { key, label: m.label, value: m.format(ty), arrow: flat ? '' : delta > 0 ? '▲' : '▼', deltaText: `${flat ? '±' : delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}${m.deltaUnit === 'pt' ? ' pts' : '%'}` };
    }),
  );
  protected rangeKey(e: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    this.range.set(this.range() === 'forward' ? 'past' : 'forward');
    const group = (e.currentTarget as HTMLElement).parentElement;
    setTimeout(() => group?.querySelector<HTMLElement>('[aria-checked=true]')?.focus(), 0);
  }
}

/** A saved widget: the chart, its title and scope, and its own menu (move, remove, behind the numbers). */
@Component({
  selector: 'app-saved-widget',
  imports: [NgIcon, WidgetChart, ViewAs, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block min-w-0' },
  template: `
    @let w = widget();
    <article class="insight-card flex h-full flex-col p-card-pad" [attr.aria-labelledby]="'w-' + w.id">
      <header class="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div class="min-w-[min(100%,15rem)] flex-1">
          <h2 [id]="'w-' + w.id" class="text-[15.5px]/snug font-semibold tracking-[-0.005em]">{{ w.spec.title }}</h2>
          @if (withUnit(w.spec.subtitle, wc.unitNote()); as sub) {
            <p class="text-muted-foreground mt-1 text-[12.5px]/snug">{{ sub }}</p>
          }
        </div>
        <div class="ml-auto flex flex-none items-start gap-3">
        <juyo-view-as class="mt-0.5" [for]="wc" />
        <button hlmBtn variant="ghost" size="icon-sm" class="text-muted-foreground" [attr.aria-label]="'More for ' + w.spec.title" [hlmDropdownMenuTrigger]="menu" align="end"><ng-icon name="phosphorDotsThreeBold" class="text-[18px]" /></button>
        </div>
      </header>
      <div class="mt-stack min-h-0 flex-1">
        <juyo-widget-chart #wc [spec]="w.spec" [rows]="w.rows" [columns]="w.columns" [header]="false" [switcher]="true" controls="external" [viewKey]="'board:' + w.id" [today]="w.evidence.businessDate || null" />
      </div>
      @if (how()) {
        <section class="mt-card-pad text-[12.5px]" aria-label="Behind the numbers">
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            @if (w.evidence.period) {
              <dt class="text-muted-foreground">Period</dt>
              <dd>{{ period(w.evidence.period) }}</dd>
            }
            <dt class="text-muted-foreground">Data as of</dt>
            <dd>{{ day(w.evidence.businessDate) }}</dd>
            <dt class="text-muted-foreground">Sources</dt>
            <dd>{{ sources() }}</dd>
            @for (d of defs(); track d[0]) {
              <dt class="text-muted-foreground">{{ d[0] }}</dt>
              <dd>{{ d[1] }}</dd>
            }
          </dl>
          @for (n of w.evidence.notes; track $index) {
            <p class="text-muted-foreground mt-2">{{ n }}</p>
          }
          <details class="mt-2">
            <summary class="text-muted-foreground hover:text-foreground cursor-pointer">Show the query</summary>
            <pre class="latest-panel mt-2 max-h-56 overflow-auto rounded-[8px] p-3 font-mono text-[11.5px]/relaxed whitespace-pre">{{ w.evidence.sql }}</pre>
          </details>
        </section>
      }
      <p class="text-muted-foreground mt-stack text-[12px]">Added {{ added() }}{{ w.question ? ' · from “' + w.question + '”' : '' }}</p>
    </article>
    <ng-template #menu>
      <hlm-dropdown-menu class="w-56">
        <button hlmDropdownMenuItem (triggered)="how.set(!how())"><ng-icon name="phosphorDatabaseLight" />{{ how() ? 'Close Behind the numbers' : 'Behind the numbers' }}</button>
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem [disabled]="first()" (triggered)="move(-1)"><ng-icon name="phosphorArrowUpLight" />Move up</button>
        <button hlmDropdownMenuItem [disabled]="last()" (triggered)="move(1)"><ng-icon name="phosphorArrowDownLight" />Move down</button>
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem (triggered)="remove()"><ng-icon name="phosphorTrashLight" />Remove from board</button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class SavedWidget {
  /** Tidied as it arrives (widget-tidy.ts): a board may hold widgets saved before the server tidied them. */
  readonly widget = input.required<BoardWidget, BoardWidget>({ alias: 'widgetRef', transform: tidyBoardWidget });
  /** The subtitle, with the unit of the amounts when the chart's numbers carry none. */
  protected readonly withUnit = subtitleWithUnit;
  readonly board = input.required<Board>({ alias: 'boardRef' });
  private readonly boards = inject(BoardsService);
  protected readonly how = signal(false);
  protected readonly defs = computed(() => Object.entries(this.widget().evidence.definitions ?? {}));
  /** Sources by the name a hotelier knows, never the table. */
  protected readonly sources = computed(() => [...new Set(this.widget().evidence.sources.map((s) => sourceLabel(s)))].join(', '));
  protected readonly period = formatPeriod;
  protected readonly day = (iso: string) => formatDate(iso);
  protected readonly added = computed(() => ago(this.widget().addedAt));
  private readonly index = computed(() => this.board().widgets.findIndex((w) => w.id === this.widget().id));
  protected readonly first = computed(() => this.index() <= 0);
  protected readonly last = computed(() => this.index() >= this.board().widgets.length - 1);

  protected async move(by: number) {
    const ids = this.board().widgets.map((w) => w.id);
    const i = this.index();
    const j = i + by;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await this.boards.update(this.board().id, { order: ids });
  }
  protected async remove() {
    const w = this.widget();
    const b = this.board();
    const r = await this.boards.removeWidget(b.id, w.id);
    if (r.ok)
      toast(`Removed from ${b.name}`, {
        duration: 8000,
        action: { label: 'Undo', onClick: () => void this.boards.addWidget(b.id, { spec: w.spec, rows: w.rows, columns: w.columns, evidence: w.evidence, question: w.question }) },
      });
  }
}

/**
 * A board. The built-in ones (Portfolio, Dubai Business Bay) are computed in the browser and have filters.
 * Saved boards come from the server (or this browser until /api/boards is deployed): their charts carry their
 * own rows, and the board can be renamed, duplicated, deleted and reordered.
 */
@Component({
  selector: 'app-board',
  imports: [NgIcon, KassandraComposer, KassandraDescribeView, KassandraDock, PerformanceWidget, ChartCard, FilterBar, ProposalCard, SavedWidget, WidgetChart, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  template: `
    <!-- A board is full width on a 12-column grid: sections apart by --space-section, cards by --space-card-gap -->
    <div class="page page--wide gap-section flex flex-col pt-stack pb-(--dock-h,7rem)">
      <nav aria-label="Breadcrumb" class="-mb-[calc(var(--space-section)-var(--space-stack))] flex h-14 items-center gap-1.5 text-[14px]">
        <button hlmBtn variant="ghost" size="sm" class="text-muted-foreground -ml-2" (click)="store.go('boards')"><ng-icon name="phosphorArrowLeftLight" />Boards</button>
        <span class="text-muted-foreground">/</span>
        <span class="truncate">{{ title() }}</span>
      </nav>

      @switch (kind()) {
        @case ('portfolio') {
          <header>
            <h1 class="text-[24px] font-[560] tracking-[-0.02em]">Portfolio</h1>
            <p class="text-muted-foreground mt-1 text-[14px]">Position, pace, pickup, mix, comp set and P&amp;L · data as of Fri 20 Nov, 07:00</p>
          </header>
          <!-- The filters and the key figures are one group: the board's first row. The filter bar is a compact region. -->
          <div class="gap-stack flex flex-col">
          <div data-density="compact" class="sticky top-0 z-20 -mx-2 bg-(--background)/92 px-2 py-2 backdrop-blur">
            <app-filter-bar />
          </div>
          @if (filters.receipt(); as rc) {
            <section class="receipt gen-in items-start" aria-label="Filters Kassandra set">
              <span class="orb-mark mt-0.5 shrink-0" aria-hidden="true"></span>
              <div class="min-w-0 flex-1 text-[13.5px]">
                <p class="font-medium">Kassandra changed {{ rc.changes.length }} {{ rc.changes.length === 1 ? 'filter' : 'filters' }}</p>
                <ul class="mt-1 flex flex-col gap-0.5">
                  @for (c of rc.changes; track c.key) {
                    <li>
                      <span class="text-muted-foreground">{{ c.label + ': ' }}</span><span class="text-muted-foreground line-through decoration-1">{{ c.from }}</span>{{ ' → ' }}<span>{{ c.to }}</span>
                      @if (c.said) {
                        <span class="text-muted-foreground">{{ ' (' + c.said + ')' }}</span>
                      }
                    </li>
                  }
                </ul>
              </div>
              <div class="flex shrink-0 gap-1 max-sm:flex-col">
                <button hlmBtn variant="ghost" size="sm" (click)="filters.undoReceipt()">Undo</button>
                <button hlmBtn variant="ghost" size="sm" (click)="filters.edit(rc.changes[0].key)">Edit filters</button>
              </div>
            </section>
          }
          <!-- The key figures: one widget, drawn like every other (figure, delta against a named base, sparkline with the comparison dashed) -->
          @let kw = kpiWidget();
          <section class="insight-card min-w-0 p-card-pad" aria-label="Key figures">
            <juyo-widget-chart [spec]="kw.spec" [rows]="kw.rows" [columns]="kw.columns" [header]="false" [switcher]="true" controls="external" />
            <p class="text-muted-foreground mt-2 text-[12px]">{{ kpiBase() }}</p>
          </section>
          </div>
          <!-- Twelve columns: the board's hero and its table take a row; the rest sit two to a row, three on a wide screen -->
          <div class="grid-12">
            @for (spec of specs; track spec.id) {
              <app-chart-card [spec]="spec" [size]="chartSize(spec)" [class]="wide(spec) ? 'col-span-12' : 'col-span-12 lg:col-span-6 min-[1600px]:col-span-4'" />
            }
          </div>
        }

        @case ('dubai') {
          <header>
            <h1 class="text-[24px] font-[560] tracking-[-0.02em]">Dubai Business Bay</h1>
            <p class="text-muted-foreground mt-1 text-[14px]">Tessera Dubai Business Bay · pace and rates · data as of Fri 20 Nov, 07:00</p>
          </header>
          <section class="surface min-w-0"><app-performance-widget /></section>
          <section aria-labelledby="dxb-dec">
            <h2 id="dxb-dec" class="section-title mb-stack">Decisions for this hotel</h2>
            @if (dubaiProposals().length) {
              <div class="gap-card-gap grid md:grid-cols-2">
                @for (p of dubaiProposals(); track p.id) {
                  <app-proposal-card [proposal]="p" />
                }
              </div>
            } @else {
              <p class="text-muted-foreground text-[14px]">
                No decisions waiting. When the morning brief finds this hotel priced under its comp set, an agent proposes a rate and the decision appears here and in Agent Studio.
                <button type="button" class="text-foreground underline underline-offset-2" (click)="store.go('watchers')">Open Agent Studio</button>
              </p>
            }
          </section>
        }

        @case ('saved') {
          @if (board(); as b) {
            <header class="gap-stack flex flex-wrap items-start justify-between">
              <div class="min-w-0 flex-1">
                @if (renaming()) {
                  <form class="flex flex-wrap items-center gap-2" (submit)="$event.preventDefault(); saveName()">
                    <label for="board-name" class="sr-only">Board name</label>
                    <input #nameInput id="board-name" class="field-input h-10 min-w-0 flex-1 text-[20px] font-semibold" maxlength="80" [value]="b.name" (keydown.escape)="renaming.set(false)" />
                    <button hlmBtn size="sm" type="submit">Save</button>
                    <button hlmBtn size="sm" variant="ghost" type="button" (click)="renaming.set(false)">Cancel</button>
                  </form>
                } @else {
                  <h1 class="text-[24px] font-[560] tracking-[-0.02em]">{{ b.name }}</h1>
                }
                <p class="text-muted-foreground mt-1 text-[14px]">{{ b.description || 'Charts from Kassandra’s answers' }} · {{ b.widgets.length }} {{ b.widgets.length === 1 ? 'chart' : 'charts' }} · updated {{ updated(b) }}{{ boards.mode() === 'local' ? ' · saved in this browser' : '' }}</p>
              </div>
              <button hlmBtn variant="outline" size="sm" [hlmDropdownMenuTrigger]="boardMenu" align="end" aria-label="Board actions"><ng-icon name="phosphorDotsThreeBold" />Board</button>
            </header>
            <div class="grid-12 grid-flow-row-dense">
              @for (w of b.widgets; track w.id) {
                <app-saved-widget [class]="span(w)" [widgetRef]="w" [boardRef]="b" />
              } @empty {
                <div class="text-muted-foreground border-border col-span-full rounded-xl border border-dashed p-card-pad py-section text-center text-[14px]">
                  No charts on this board yet. Describe a chart in the bar at the bottom and Kassandra adds it here, or choose “Add to board” on any chart in an answer.
                  <button type="button" class="text-foreground mt-1 block w-full underline underline-offset-2" (click)="store.openBoard(portfolioBoard)">Or add charts from the Portfolio board</button>
                </div>
              }
            </div>
          } @else if (boards.loaded() && !loading()) {
            <section class="py-10 text-center">
              <h1 class="text-[22px] font-semibold">This board doesn’t exist</h1>
              <p class="text-muted-foreground mt-2 text-[14px]">It may have been deleted, or the link may be old or mistyped.</p>
              <button hlmBtn class="mt-4" (click)="store.go('boards')">See all boards</button>
            </section>
          } @else {
            <p class="text-muted-foreground text-[14px]" role="status">Loading the board…</p>
          }
        }
      }
    </div>

    <kassandra-dock [within]="host">
      @switch (kind()) {
        @case ('saved') {
          @if (board(); as b) {
            <kassandra-describe-view #describe [docked]="true" inputId="board-ask" [boardId]="b.id" [boardName]="b.name" placeholder="Describe a chart to add to this board…" [examples]="boardExamples()" [(mode)]="live.mode" />
          }
        }
        @case ('portfolio') {
          <kassandra-composer inputId="board-ask" [docked]="true" label="Ask Kassandra or filter" placeholder="Ask or filter, e.g. “Dubai hotels, next 90 nights vs budget”" [examples]="portfolioAsks" [(mode)]="live.mode" (submitted)="onAsk($event)" />
        }
        @default {
          <kassandra-composer inputId="board-ask" [docked]="true" label="Ask Kassandra" placeholder="Ask about Dubai Business Bay…" [examples]="dubaiAsks()" [(mode)]="live.mode" (submitted)="live.askNew($event)" />
        }
      }
    </kassandra-dock>

    <ng-template #boardMenu>
      <hlm-dropdown-menu class="w-52">
        <button hlmDropdownMenuItem (triggered)="startRename()"><ng-icon name="phosphorPencilSimpleLight" />Rename</button>
        <button hlmDropdownMenuItem (triggered)="duplicate()"><ng-icon name="phosphorCopyLight" />Duplicate</button>
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem (triggered)="confirmDelete()"><ng-icon name="phosphorTrashLight" />Delete board…</button>
      </hlm-dropdown-menu>
    </ng-template>

    <dialog #delDlg class="confirm-dialog" aria-labelledby="del-title" (close)="onDeleteClosed()">
      <h2 id="del-title" class="text-[16px] font-semibold">Delete “{{ board()?.name }}”?</h2>
      <p class="text-muted-foreground mt-2 text-[14px]">{{ board()?.widgets?.length === 1 ? 'Its chart goes' : 'Its ' + (board()?.widgets?.length ?? 0) + ' charts go' }} with it. This can’t be undone.</p>
      <form method="dialog" class="mt-5 flex justify-end gap-2">
        <button hlmBtn variant="ghost" value="cancel">Cancel</button>
        <button hlmBtn variant="destructive" value="delete">Delete board</button>
      </form>
    </dialog>
  `,
})
export class BoardView {
  protected readonly store = inject(CompassStore);
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly portfolioAsks = boardAsks([]);
  protected readonly dubaiAsks = computed(() => (hotelCatalog(), boardAsks(['DXB2'])));
  /** The Prompts menu of a saved board: charts to add, about its hotels. */
  protected readonly boardExamples = computed(() => (hotelCatalog(), boardAsks(this.board()?.hotels ?? [])));
  private readonly describe = viewChild<KassandraDescribeView>('describe');
  protected readonly live = inject(Live);
  protected readonly filters = inject(Filters);
  protected readonly boards = inject(BoardsService);
  protected readonly portfolioBoard = PORTFOLIO_BOARD;
  /** The board's hero, its waterfall and its table take a whole row of the 12 columns; the rest share a row. */
  protected readonly wide = (spec: ChartSpec) => spec.kind === 'position' || spec.kind === 'bridge' || spec.kind === 'table';
  /** Height presets, never free heights: 180 px among others, 320 px when featured; a bar per row keeps its own. */
  protected chartSize(spec: ChartSpec): ChartSize | 'auto' {
    if (spec.kind === 'pace' || spec.kind === 'pickup' || spec.kind === 'fan') return 'overview';
    return spec.kind === 'bridge' || spec.kind === 'quadrant' ? 'hero' : 'auto';
  }
  protected readonly specs = PORTFOLIO_SPECS;
  protected readonly kind = computed<'portfolio' | 'dubai' | 'saved'>(() => {
    const id = this.store.activeBoardId();
    return id === PORTFOLIO_BOARD ? 'portfolio' : id === DUBAI_BOARD ? 'dubai' : 'saved';
  });
  /** What the tiles' deltas are against, said once under them. */
  protected readonly kpiBase = computed(() => {
    const s = this.filters.state();
    return s.compare === 'none' ? 'No comparison' : `Changes against ${COMPARES[s.compare].label.toLowerCase()}; the dashed line in each trend is the comparison.`;
  });
  /** The key figures as a kpi_row widget, under the board's filters. */
  protected readonly kpiWidget = computed(() => {
    const { rows, columns, ...drawing } = kpiWidget(this.filters.state());
    return { spec: { ...drawing, title: 'Key figures', subtitle: scopeChips(this.filters.state()).join(' · '), sourceCallId: 'portfolio:kpis' } as WidgetSpec, rows, columns };
  });
  protected readonly loading = signal(false);
  protected readonly renaming = signal(false);
  private readonly full = signal<Board | null>(null);
  /** The open board and when it last changed, compared by value: the list gets a new array on every load, and reloading
      the board for each would fetch it again and again. */
  private readonly stamp = computed(
    () => {
      const id = this.store.activeBoardId();
      return { id, stamp: this.boards.boards().find((b) => b.id === id)?.updatedAt };
    },
    { equal: (a, b) => a.id === b.id && a.stamp === b.stamp },
  );
  /** The saved board with its rows (the list may hold widgets without rows on the server). */
  protected readonly board = computed(() => {
    const id = this.store.activeBoardId();
    const listed = this.boards.boards().find((b) => b.id === id) ?? null;
    if (!listed) return null;
    if (this.boards.mode() === 'local') return listed;
    const f = this.full();
    return f && f.id === id ? { ...listed, widgets: orderLike(listed, f) } : null;
  });
  protected readonly title = computed(() => (this.kind() === 'portfolio' ? 'Portfolio' : this.kind() === 'dubai' ? 'Dubai Business Bay' : (this.board()?.name ?? 'Board')));
  private readonly allProposals = this.live.workflowsApi.proposalsResource(() => undefined);
  protected readonly dubaiProposals = computed(() => (this.allProposals.hasValue() ? this.allProposals.value() : []).filter((p) => p.hotel_code === 'DXB2').sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || b.createdAt.localeCompare(a.createdAt)).slice(0, 4));
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly delDlg = viewChild<ElementRef<HTMLDialogElement>>('delDlg');

  constructor() {
    // Load the rows of a saved board when it opens or changes on the server.
    effect(() => {
      const { id, stamp } = this.stamp();
      if (this.kind() !== 'saved' || !this.boards.loaded() || this.boards.mode() === 'local' || !stamp) return;
      this.loading.set(true);
      void this.boards.full(id).then((b) => {
        this.full.set(b);
        this.loading.set(false);
      });
    });
    effect(() => {
      if (this.renaming()) setTimeout(() => this.nameInput()?.nativeElement.select(), 0);
    });
    // "Ask Kassandra to add charts" on the board's card: the cursor goes to the composer once the board is drawn.
    effect(() => {
      const view = this.describe();
      const b = this.board();
      if (!view || !b || this.boards.askOnOpen() !== b.id) return;
      this.boards.askOnOpen.set(null);
      setTimeout(() => view.focus(), 0);
    });
  }

  /** Filter requests change the page (with a receipt); anything else is a question for Kassandra. */
  protected onAsk(text: string) {
    const req = parseFilterRequest(text);
    if (req) this.filters.set(req.patch, 'kassandra', req.said);
    else this.live.askNew(text);
  }
  /** Columns of the 12 a chart takes (boardSpan): wide charts the row, the rest half of it on a wide screen. */
  protected span(w: BoardWidget) {
    return boardSpan(w);
  }
  protected updated(b: Board) {
    return ago(b.updatedAt);
  }
  protected startRename() {
    this.renaming.set(true);
  }
  protected async saveName() {
    const b = this.board();
    const name = this.nameInput()?.nativeElement.value.trim() ?? '';
    if (!b || !name) return;
    const r = await this.boards.update(b.id, { name });
    if (r.ok) this.renaming.set(false);
  }
  protected async duplicate() {
    const b = this.board();
    if (!b) return;
    const r = await this.boards.duplicate(b.id);
    if (r.ok) {
      toast(`Duplicated as “${r.value.name}”`, { duration: 6000 });
      this.store.openBoard(r.value.id);
    }
  }
  protected confirmDelete() {
    this.delDlg()?.nativeElement.showModal();
  }
  protected async onDeleteClosed() {
    const dlg = this.delDlg()?.nativeElement;
    const b = this.board();
    if (!dlg || dlg.returnValue !== 'delete' || !b) return;
    dlg.returnValue = '';
    const r = await this.boards.remove(b.id);
    if (r.ok) {
      toast(`Deleted “${b.name}”`, { duration: 5000 });
      this.store.go('boards');
    }
  }
}

/** Kinds whose content is narrow: a figure, a round chart, a calendar of a few months. */
const NARROW_KINDS = new Set(['kpi', 'gauge', 'pie', 'donut', 'funnel', 'radar', 'bullet', 'treemap', 'calendar_heatmap']);

/**
 * The columns of the board's 12 a widget takes. Wide charts take the row: a long time series, a table, a heatmap, a
 * bridge, a flow, a list of many bars. Everything else takes half on a wide screen, so a KPI, a donut or a calendar never
 * sits alone in a full-width card; the grid packs the halves densely. A narrow figure keeps its height (it does not
 * stretch to its neighbour's).
 */
export function boardSpan(w: Pick<BoardWidget, 'spec' | 'rows'>): string {
  const kind = w.spec.kind;
  const rows = w.rows?.length ?? 0;
  const half = 'col-span-12 lg:col-span-6';
  if (kind === 'kpi' || kind === 'gauge') return `${half} self-start`;
  if (kind === 'calendar_heatmap') return rows > 100 ? 'col-span-12' : half;
  if (NARROW_KINDS.has(kind)) return half;
  if (kind === 'kpi_row') return (w.spec.y?.length ?? 4) > 3 ? 'col-span-12' : half;
  if (kind === 'line' || kind === 'area' || kind === 'sparkline_list' || kind === 'scatter') return rows > 16 ? 'col-span-12' : half;
  if (kind === 'bar' || kind === 'grouped_bar' || kind === 'stacked_bar') return rows > 12 ? 'col-span-12' : half;
  return 'col-span-12';
}

/** The widgets in the order the list has them (a reorder reaches the list first). */
function orderLike(listed: Board, full: Board): BoardWidget[] {
  const byId = new Map(full.widgets.map((w) => [w.id, w]));
  const ordered = listed.widgets.map((w) => byId.get(w.id)).filter((w): w is BoardWidget => !!w);
  return ordered.length === full.widgets.length ? ordered : full.widgets;
}

/**
 * All boards: the two built in, then the saved ones. Each card says what it holds; the built-in ones show
 * their own headline (the portfolio's for Portfolio, Dubai's for Dubai), saved ones their chart count.
 */
@Component({
  selector: 'app-boards-list',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports, BoardCardVisual, KassandraComposer, KassandraDock],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  template: `
    <div class="page gap-section flex flex-col pt-section pb-(--dock-h,7rem)">
      <header class="gap-card-gap flex flex-wrap items-end justify-between">
        <div>
          <h1 class="text-[26px] font-semibold tracking-[-0.02em]">Boards</h1>
          <p class="text-muted-foreground max-w-measure mt-1 text-[15px]">The numbers you check every day, kept in one place. Kassandra builds a board from a description, or you add charts from an answer.</p>
        </div>
        <button hlmBtn (click)="openNew()"><ng-icon name="phosphorPlusLight" />New board</button>
      </header>

      @if (boards.error(); as e) {
        <p role="alert" class="border-border rounded-[10px] border border-dashed p-3 text-[13.5px]">Couldn’t load your saved boards. {{ e }} <button hlmBtn variant="ghost" size="sm" (click)="boards.load()">Try again</button></p>
      }

      <ul class="chart-row" aria-label="Boards">
        @for (c of builtIns(); track c.id) {
          <li class="clickable-card relative flex min-w-0 flex-col">
            <div class="flex items-start gap-3 p-card-pad pb-stack">
              <div class="min-w-0 flex-1">
                <h2 class="board-card-title"><button type="button" class="card-link" (click)="store.openBoard(c.id)">{{ c.name }}</button></h2>
                <p class="text-muted-foreground line-clamp-2 min-h-[2.75em] text-[13.5px]/snug">{{ c.description }}</p>
              </div>
              <span class="scope-chip shrink-0">Built in</span>
            </div>
            <app-board-card-visual [headline]="c.headline" [spark]="c.paths" />
            <p class="sr-only">{{ c.headline.label }}: {{ c.headline.value }}{{ c.headline.delta ? ', ' + c.headline.spoken + ' ' + c.headline.versus : '' }}.</p>
            <div class="text-muted-foreground mt-auto flex items-center justify-between gap-2 px-card-pad pt-stack pb-card-pad text-[12.5px] tabular-nums">
              <span>Data as of 20 Nov, 07:00</span>
              <span>{{ c.count }} charts</span>
            </div>
          </li>
        }
        @for (b of cards(); track b.id) {
          <li class="clickable-card relative flex min-w-0 flex-col">
            <div class="p-card-pad pb-stack pr-12">
              <h2 class="board-card-title"><button type="button" class="card-link" (click)="store.openBoard(b.id)">{{ b.name }}</button></h2>
              <p class="text-muted-foreground line-clamp-2 min-h-[2.75em] text-[13.5px]/snug">{{ b.description || 'Charts from Kassandra’s answers' }}</p>
            </div>
            @if (b.widgets.length) {
              <app-board-card-visual [headline]="b.card.headline" [tiles]="b.card.tiles" [placeholder]="!b.card.headline && !b.card.tiles.length" />
              @if (b.card.headline; as h) {
                <p class="sr-only">{{ h.label }}: {{ h.value }}{{ h.delta ? ', ' + h.spoken + ' ' + h.versus : '' }}.</p>
              }
              <ul class="sr-only" [attr.aria-label]="'Charts on ' + b.name">
                @for (w of b.widgets; track w.id) {
                  <li>{{ w.spec.title }}</li>
                }
              </ul>
            } @else {
              <div class="board-empty">
                <app-board-card-visual [placeholder]="true" />
                <div class="board-empty-cta">
                  <p class="text-muted-foreground text-[13px]">No charts yet</p>
                  <button hlmBtn variant="outline" size="sm" class="card-over bg-(--card)" (click)="askToAdd(b.id)"><span class="orb-mark size-3.5" aria-hidden="true"></span>Ask Kassandra to add charts</button>
                </div>
              </div>
            }
            <div class="text-muted-foreground mt-auto flex items-center justify-between gap-2 px-card-pad pt-stack pb-card-pad text-[12.5px] tabular-nums">
              <span>Updated {{ ago(b.updatedAt) }}</span>
              <span>{{ b.widgets.length }} {{ b.widgets.length === 1 ? 'chart' : 'charts' }}</span>
            </div>
            <button hlmBtn variant="ghost" size="icon-sm" class="card-over text-muted-foreground !absolute top-[calc(var(--space-card-pad)-6px)] right-[calc(var(--space-card-pad)-8px)]" [attr.aria-label]="'Actions for ' + b.name" [hlmDropdownMenuTrigger]="cardMenu" [hlmDropdownMenuTriggerData]="{ $implicit: b }" align="end"><ng-icon name="phosphorDotsThreeBold" class="text-[18px]" /></button>
          </li>
        }
        <li class="min-w-0">
          <button type="button" class="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 flex h-full min-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed transition-colors" (click)="openNew()">
            <span class="bg-secondary grid size-10 place-items-center rounded-full"><ng-icon name="phosphorPlusLight" class="text-[18px]" /></span>
            <span class="text-[14px] font-medium">New board</span>
            <span class="px-4 text-center text-[12.5px]">Describe it to Kassandra, or add charts from an answer</span>
          </button>
        </li>
      </ul>
      @if (boards.mode() === 'local') {
        <p class="text-muted-foreground text-[12.5px]">Your boards are saved in this browser only.</p>
      }
    </div>

    <kassandra-dock [within]="host">
      <kassandra-composer
        inputId="boards-ask"
        [docked]="true"
        label="Ask Kassandra"
        placeholder="Ask for a board or a chart, e.g. “Lisbon’s pace and pickup”…"
        [examples]="boardsAsks"
        examplesTitle="Try asking"
        [(mode)]="live.mode"
        (submitted)="live.askNew($event)"
      />
    </kassandra-dock>

    <ng-template #cardMenu let-b>
      <hlm-dropdown-menu class="w-48">
        <button hlmDropdownMenuItem (triggered)="store.openBoard(b.id)"><ng-icon name="phosphorArrowUpRightLight" />Open</button>
        <button hlmDropdownMenuItem (triggered)="duplicate(b)"><ng-icon name="phosphorCopyLight" />Duplicate</button>
        <button hlmDropdownMenuItem (triggered)="askDelete(b)"><ng-icon name="phosphorTrashLight" />Delete…</button>
      </hlm-dropdown-menu>
    </ng-template>

    <dialog #newDlg class="confirm-dialog" aria-labelledby="new-title">
      <form class="flex flex-col gap-3" (submit)="$event.preventDefault(); create()">
        <h2 id="new-title" class="text-[16px] font-semibold">New board</h2>
        <label class="flex flex-col gap-1 text-[13px]">Name<input #newName class="field-input" required maxlength="80" [value]="suggested()" /></label>
        <label class="flex flex-col gap-1 text-[13px]">Description <span class="text-muted-foreground">(optional)</span><input #newDesc class="field-input" maxlength="200" /></label>
        <div class="mt-2 flex justify-end gap-2">
          <button hlmBtn variant="ghost" type="button" (click)="newDlg.close()">Cancel</button>
          <button hlmBtn type="submit">Create board</button>
        </div>
      </form>
    </dialog>

    <dialog #delDlg class="confirm-dialog" aria-labelledby="ldel-title" (close)="onDeleteClosed()">
      <h2 id="ldel-title" class="text-[16px] font-semibold">Delete “{{ deleting()?.name }}”?</h2>
      <p class="text-muted-foreground mt-2 text-[14px]">Its charts go with it. This can’t be undone.</p>
      <form method="dialog" class="mt-5 flex justify-end gap-2">
        <button hlmBtn variant="ghost" value="cancel">Cancel</button>
        <button hlmBtn variant="destructive" value="delete">Delete board</button>
      </form>
    </dialog>
  `,
})
export class BoardsList {
  protected readonly store = inject(CompassStore);
  protected readonly boards = inject(BoardsService);
  protected readonly live = inject(Live);
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly boardsAsks = BOARDS_ASKS;
  /** Each saved board with what its card draws: a headline figure and tiny charts from its first widgets. */
  protected readonly cards = computed(() => this.boards.boards().map((b) => ({ ...b, card: boardCard(previewItems(b)) })));
  protected readonly ago = ago;
  protected readonly deleting = signal<Board | null>(null);
  protected readonly suggested = computed(() => this.boards.freshName());
  private readonly newDlg = viewChild.required<ElementRef<HTMLDialogElement>>('newDlg');
  private readonly newName = viewChild.required<ElementRef<HTMLInputElement>>('newName');
  private readonly newDesc = viewChild.required<ElementRef<HTMLInputElement>>('newDesc');
  private readonly delDlg = viewChild.required<ElementRef<HTMLDialogElement>>('delDlg');

  /** Each built-in board's headline from its own data: the portfolio for Portfolio, Dubai for Dubai. */
  protected readonly builtIns = computed(() => {
    const occ = kpis(DEFAULTS)[0];
    const dxb = NIGHTS.forward;
    const ty = metricTotal(dxb, 'occupancy');
    const ly = metricTotal(dxb, 'occupancy', true);
    const d = ty - ly;
    const sign = (x: number) => (Math.abs(x) < 0.05 ? '±' : x > 0 ? '▲ +' : '▼ −');
    const headline = (label: string, value: string, delta: number | null): CardHeadline => ({
      label,
      value,
      delta: delta === null ? null : `${sign(delta)}${Math.abs(delta).toFixed(1)} pts`,
      spoken: delta === null ? '' : `${Math.abs(delta) < 0.05 ? 'no change,' : delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)} pts`,
      versus: delta === null ? '' : 'vs last year',
      tone: 'flat',
    });
    return [
      { ...BUILT_IN[0], headline: headline('Occupancy · next 30 nights, all hotels', occ.value, occ.delta), paths: paths(occ.spark, occ.sparkCmp ?? []), count: 9 },
      { ...BUILT_IN[1], headline: headline('Occupancy · next 45 nights', METRICS.occupancy.format(ty), d), paths: paths(metricSeries(dxb, 'occupancy'), metricSeries(dxb, 'occupancy', true)), count: 2 },
    ];
  });

  /** "Ask Kassandra to add charts": the board opens with the cursor in its composer. */
  protected askToAdd(id: string) {
    this.boards.askOnOpen.set(id);
    this.store.openBoard(id);
  }
  protected openNew() {
    this.newDlg().nativeElement.showModal();
    setTimeout(() => this.newName().nativeElement.select(), 0);
  }
  protected async create() {
    const r = await this.boards.create({ name: this.newName().nativeElement.value, description: this.newDesc().nativeElement.value });
    if (!r.ok) return;
    this.newDlg().nativeElement.close();
    this.newDesc().nativeElement.value = '';
    this.store.openBoard(r.value.id);
  }
  protected async duplicate(b: Board) {
    const r = await this.boards.duplicate(b.id);
    if (r.ok) toast(`Duplicated as “${r.value.name}”`, { duration: 6000, action: { label: 'Open', onClick: () => this.store.openBoard(r.value.id) } });
  }
  protected askDelete(b: Board) {
    this.deleting.set(b);
    this.delDlg().nativeElement.showModal();
  }
  protected async onDeleteClosed() {
    const dlg = this.delDlg().nativeElement;
    const b = this.deleting();
    if (dlg.returnValue !== 'delete' || !b) return;
    dlg.returnValue = '';
    const r = await this.boards.remove(b.id);
    if (r.ok) toast(`Deleted “${b.name}”`, { duration: 5000 });
  }
}

function paths(ty: number[], ly: number[], w = 300, h = 64) {
  const all = [...ty, ...ly];
  if (!all.length) return { line: '', ly: '' };
  const min = Math.min(...all);
  const max = Math.max(...all);
  const x = (i: number, n: number) => (i / Math.max(1, n - 1)) * w;
  const y = (v: number) => h - 4 - ((v - min) / (max - min || 1)) * (h - 10);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i, vals.length).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return { line: line(ty), ly: ly.length ? line(ly) : '' };
}
