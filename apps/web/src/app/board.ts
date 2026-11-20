import { ChartCard } from './chart-card';
import { FilterBar } from './filter-bar';
import { Filters, parseFilterRequest } from './filters';
import { isWide, kpis } from './portfolio';
import { Component, DOCUMENT, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { ArtifactView } from './artifact';
import { DecisionsWidget } from './decisions';
import { KassandraComposer } from './kassandra/kassandra-composer';
import { KassandraDescribeView } from './kassandra/kassandra-describe-view';
import { MetricChart } from './metric-chart';
import { Live } from './live';
import { CompassStore } from './store';
import { METRICS, MetricKey, NIGHTS, Range, decisionNights, metricSeries, metricTotal } from './data';
import * as icons from './icons';

/** Driver weights per metric (sum to 1), applied to the actual change so contributions add up to the headline. */
const DRIVERS: Record<MetricKey, { label: string; w: number }[]> = {
  occupancy: [
    { label: 'Leisure transient', w: -21 },
    { label: 'Corporate', w: 18 },
    { label: 'Groups', w: 9 },
    { label: 'OTA', w: -5 },
  ],
  adr: [
    { label: 'BAR increases', w: 0.78 },
    { label: 'Corporate negotiated rates', w: 0.37 },
    { label: 'Shift towards OTA', w: -0.15 },
  ],
  revpar: [
    { label: 'ADR', w: 1.05 },
    { label: 'Occupancy', w: -0.05 },
  ],
  revenue: [
    { label: 'ADR', w: 1.05 },
    { label: 'Room nights', w: -0.05 },
  ],
};

/** One chart, four metrics: the KPI strip is the chart's tab bar, and each change opens its drivers. */
@Component({
  selector: 'app-performance-widget',
  imports: [NgIcon, MetricChart, HlmButtonImports, HlmToggleGroupImports],
  providers: [provideIcons({ ...icons })],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h3 class="text-[14px] font-semibold tracking-[-0.01em]">Performance</h3>
      <div hlmToggleGroup type="single" [value]="range()" (valueChange)="setRange($event)" variant="outline" size="sm" aria-label="Date range">
        <button hlmToggleGroupItem value="forward">Next 45 nights</button>
        <button hlmToggleGroupItem value="past">Last 45 nights</button>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-y-2 sm:grid-cols-4" role="tablist" aria-label="Metric">
      @for (k of kpis(); track k.key) {
        <div class="relative flex flex-col items-start gap-1 border-t pt-3 pb-1 sm:pr-4" [class]="metric() === k.key ? 'border-foreground' : 'border-border/70'">
          <button type="button" role="tab" [attr.aria-selected]="metric() === k.key" (click)="selectMetric(k.key)" class="flex flex-col items-start gap-1 text-left after:absolute after:inset-0 after:content-['']">
            <span class="text-[12.5px]" [class]="metric() === k.key ? 'text-foreground font-medium' : 'text-muted-foreground'">{{ k.label }}</span>
            <span class="text-[22px]/none font-[520] tracking-[-0.02em] tabular-nums">{{ k.value }}</span>
          </button>
          @if (range() === 'forward') {
            <button type="button" class="relative z-10 rounded text-[12px] tabular-nums underline decoration-dotted decoration-1 underline-offset-[3px] hover:decoration-solid text-muted-foreground" [attr.aria-expanded]="drivers() === k.key" (click)="toggleDrivers(k.key)">
              {{ k.delta >= 0 ? '▲' : '▼' }} {{ k.sign }}{{ k.deltaText }} <span class="text-muted-foreground">vs last year</span>
            </button>
          } @else {
            <span class="text-[12px] tabular-nums text-muted-foreground">{{ k.delta >= 0 ? '▲' : '▼' }} {{ k.sign }}{{ k.deltaText }} <span class="text-muted-foreground">vs last year</span></span>
          }
        </div>
      }
    </div>

    @if (driverRows(); as dr) {
      <div class="gen-in bg-muted/40 mt-3 rounded-lg p-3.5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-[14px] font-medium">What drove {{ dr.title }}</p>
            <p class="text-muted-foreground text-[12px]">Contributions add up to the total</p>
          </div>
          <button hlmBtn variant="ghost" size="icon-sm" aria-label="Close drivers" (click)="drivers.set(null)"><ng-icon name="phosphorXLight" /></button>
        </div>
        <ul class="mt-3 flex flex-col gap-2">
          @for (r of dr.rows; track r.label) {
            <li class="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_64px] items-center gap-3 text-[13px]">
              <span class="truncate">{{ r.label }}</span>
              <span class="bg-foreground/5 relative h-2 rounded-full" aria-hidden="true">
                <span class="bg-foreground/15 absolute inset-y-0 left-1/2 w-px"></span>
                <span class="absolute inset-y-0 rounded-full" [class]="r.value >= 0 ? 'bg-(--positive)' : 'bg-(--negative)'" [style.left.%]="r.value >= 0 ? 50 : 50 - r.pct" [style.width.%]="r.pct"></span>
              </span>
              <span class="text-right tabular-nums text-muted-foreground">{{ r.text }}</span>
            </li>
          }
        </ul>
        <button hlmBtn size="sm" variant="outline" class="mt-3" (click)="live.askAbout('What drove ' + dr.title + '?')"><ng-icon name="phosphorSparkleFill" class="text-(--brass)" />Ask why</button>
      </div>
    }

    <div class="-mx-1 mt-4 sm:-mx-2">
      <app-metric-chart [values]="series().ty" [compare]="series().ly" [dates]="dates()" [format]="meta().format" [tickFormat]="metric() === 'occupancy' ? pct : undefined" [capAt]="metric() === 'occupancy' ? 100 : null" [marks]="marks()" [height]="chartHeight" [zeroBased]="metric() === 'occupancy'" [ariaLabel]="meta().label + ', this year versus same time last year'" />
    </div>
    <div class="text-muted-foreground mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
      <span class="flex items-center gap-1.5"><i class="inline-block h-0.5 w-3 rounded bg-(--series)"></i>This year{{ range() === 'forward' ? ', on the books' : '' }}</span>
      <span class="flex items-center gap-1.5"><i class="inline-block w-3 border-t-[1.5px] border-dashed border-(--series-muted)"></i>Same time last year</span>
      @if (marks().length) {
        <span class="flex items-center gap-1.5"><i class="inline-block size-2.5 rounded-sm bg-(--brass-wash) ring-1 ring-(--brass)/40"></i>Needs a decision</span>
      }
    </div>
  `,
})
export class PerformanceWidget {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  private readonly doc = inject(DOCUMENT);
  protected readonly range = signal<Range>('forward');
  protected readonly metric = signal<MetricKey>('occupancy');
  protected readonly drivers = signal<MetricKey | null>(null);
  protected readonly chartHeight = this.doc.defaultView && this.doc.defaultView.innerWidth < 640 ? 220 : 260;
  protected readonly pct = (n: number) => `${n.toFixed(0)}%`;

  protected readonly nights = computed(() => NIGHTS[this.range()]);
  protected readonly dates = computed(() => this.nights().map((n) => n.date));
  protected readonly meta = computed(() => METRICS[this.metric()]);
  protected readonly series = computed(() => ({ ty: metricSeries(this.nights(), this.metric()), ly: metricSeries(this.nights(), this.metric(), true) }));
  private readonly decisionDates = new Set(decisionNights().slice(0, 6).map((d) => d.night.date));
  protected readonly marks = computed(() => (this.range() === 'forward' ? this.nights().flatMap((n, i) => (this.decisionDates.has(n.date) ? [i] : [])) : []));

  protected readonly kpis = computed(() =>
    (Object.keys(METRICS) as MetricKey[]).map((key) => {
      const m = METRICS[key];
      const ty = metricTotal(this.nights(), key);
      const ly = metricTotal(this.nights(), key, true);
      const delta = m.deltaUnit === 'pt' ? ty - ly : ((ty - ly) / ly) * 100;
      return { key, label: m.label, value: m.format(ty), delta, sign: delta >= 0 ? '+' : '−', deltaText: `${Math.abs(delta).toFixed(1)}${m.deltaUnit === 'pt' ? ' pt' : '%'}`, unit: m.deltaUnit };
    }),
  );

  protected readonly driverRows = computed(() => {
    const key = this.drivers();
    if (!key || this.range() !== 'forward') return null;
    const k = this.kpis().find((x) => x.key === key)!;
    const rows = DRIVERS[key].map((d) => ({ label: d.label, value: d.w * k.delta }));
    const max = Math.max(...rows.map((r) => Math.abs(r.value)), 0.0001);
    return {
      title: `${METRICS[key].label} ${k.sign}${k.deltaText}`,
      rows: rows.map((r) => ({ ...r, pct: (Math.abs(r.value) / max) * 48, text: `${r.value >= 0 ? '+' : '−'}${Math.abs(r.value).toFixed(1)}${k.unit === 'pt' ? ' pt' : '%'}` })),
    };
  });

  protected setRange(v: unknown) {
    if (v === 'forward' || v === 'past') this.range.set(v);
  }
  protected selectMetric(k: MetricKey) {
    this.metric.set(k);
    if (this.drivers()) this.drivers.set(k);
  }
  protected toggleDrivers(k: MetricKey) {
    this.metric.set(k);
    this.drivers.set(this.drivers() === k ? null : k);
  }
}


/** Canvas: boards are built from answers. Describe a view, or add any artifact from a thread. */
@Component({
  selector: 'app-board',
  imports: [NgIcon, KassandraComposer, KassandraDescribeView, ArtifactView, PerformanceWidget, DecisionsWidget, ChartCard, FilterBar, HlmButtonImports, HlmTooltipImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  template: `
    <div class="mx-auto flex max-w-[1120px] flex-col gap-6 px-[max(16px,env(safe-area-inset-left,0px))] pt-6 pb-28 sm:px-8 lg:pt-8">
      <header class="flex flex-col gap-4">
        <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-[14px]">
          <button hlmBtn variant="ghost" size="sm" class="text-muted-foreground -ml-2" (click)="store.go('boards')"><ng-icon name="phosphorArrowLeftLight" />Boards</button>
          <span class="text-muted-foreground">/</span>
          <span class="truncate">{{ store.activeBoard().name }}</span>
        </nav>
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-[24px] font-[560] tracking-[-0.02em]">{{ store.activeBoard().name }}</h1>
            <p class="text-muted-foreground text-[14px]">{{ store.activeBoard().description }} · <span title="The API doesn’t serve boards yet: these charts are computed in the browser from a read-only extract of compass_hotels.">snapshot of compass_hotels, 20 Nov 07:00</span></p>
          </div>
        </div>
        @if (hasCharts()) {
          <kassandra-composer label="Ask or filter" placeholder="Ask or filter, e.g. “Dubai hotels, next 90 nights vs budget”" [(mode)]="live.mode" (submitted)="onAsk($event)" />
        } @else {
          <kassandra-describe-view [boardId]="store.activeBoardId()" [boardName]="store.activeBoard().name" />
        }
      </header>

      @if (hasCharts()) {
        <div class="sticky top-0 z-20 -mx-2 bg-(--background)/92 px-2 py-2 backdrop-blur max-lg:top-0">
          <app-filter-bar />
        </div>
        <!-- Kassandra changed the filters: each change before → after, in the bar's own words, with Undo and Edit filters -->
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
        <ul class="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Key figures">
          @for (k of kpis(); track k.metric) {
            <li class="insight-card flex flex-col p-4">
              <p class="text-muted-foreground text-[12px]">{{ k.label }}</p>
              <div class="mt-1 flex items-end justify-between gap-2">
                <p class="text-[22px]/tight font-semibold tracking-[-0.02em] tabular-nums">{{ k.value }}</p>
                @if (k.spark.length > 1) {
                  <svg width="64" height="22" viewBox="0 0 64 22" class="shrink-0" aria-hidden="true">
                    @if (k.sparkCmp) {
                      <polyline [attr.points]="spark(k.spark, k.sparkCmp)[1]" fill="none" stroke="var(--series-cmp)" stroke-width="1.25" stroke-dasharray="3 2" />
                    }
                    <polyline [attr.points]="spark(k.spark, k.sparkCmp)[0]" fill="none" stroke="var(--series)" stroke-width="1.5" stroke-linejoin="round" />
                  </svg>
                }
              </div>
              <p class="mt-1 text-[12px] tabular-nums">{{ k.delta === null ? '' : (k.delta >= 0 ? '▲ ' : '▼ ') + k.deltaText }}</p>
              <p class="text-muted-foreground text-[12px] tabular-nums">{{ k.base }}</p>
            </li>
          }
        </ul>
      }

      <div class="grid gap-4 lg:grid-cols-2">
        @for (w of store.activeBoard().widgets; track w.id) {
          @switch (w.kind) {
            @case ('performance') {
              <section class="bg-card ring-foreground/8 min-w-0 rounded-xl p-4 ring-1 sm:p-5 lg:col-span-2"><app-performance-widget /></section>
            }
            @case ('decisions') {
              <section class="bg-card ring-foreground/8 min-w-0 rounded-xl p-4 ring-1 sm:p-5 lg:col-span-2"><app-decisions-widget /></section>
            }
            @case ('chart') {
              <app-chart-card [spec]="w.spec" [class]="wide(w.spec) ? 'lg:col-span-2' : ''" />
            }
            @case ('artifact') {
              <section class="bg-card ring-foreground/8 gen-in group relative min-w-0 rounded-xl p-4 ring-1">
                <app-artifact [spec]="w.spec" [height]="200" />
                <div class="text-muted-foreground mt-1 flex items-center justify-between gap-2 text-[12px]">
                  <span class="truncate">From “{{ w.addedFrom }}”</span>
                  <button hlmBtn variant="ghost" size="icon-xs" class="opacity-60 group-hover:opacity-100 focus-visible:opacity-100" [attr.aria-label]="'Remove ' + w.spec.title" hlmTooltip="Remove" (click)="store.removeWidget(store.activeBoardId(), w.id)"><ng-icon name="phosphorTrashLight" /></button>
                </div>
              </section>
            }
          }
        } @empty {
          <div class="text-muted-foreground border-border col-span-full rounded-xl border border-dashed p-8 text-center text-[14px]">This board is empty. Describe a view above, or use “Add to board” on any answer.</div>
        }
      </div>
    </div>
  `,
})
export class BoardView {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  protected readonly filters = inject(Filters);
  protected readonly wide = isWide;
  protected readonly hasCharts = computed(() => this.store.activeBoard().widgets.some((w) => w.kind === 'chart'));
  protected readonly kpis = computed(() => kpis(this.filters.state()));

  /** Filter requests change the page (with a receipt); anything else becomes a question in a thread. */
  protected onAsk(text: string) {
    const req = parseFilterRequest(text);
    if (req) this.filters.set(req.patch, 'kassandra', req.said);
    else this.live.askNew(text);
  }
  /** Sparkline points for this year and the comparison, on one shared scale. */
  protected spark(a: number[], b: number[] | null): [string, string] {
    const all = [...a, ...(b ?? [])];
    const lo = Math.min(...all);
    const span = Math.max(...all) - lo || 1;
    const pts = (xs: number[]) => xs.map((x, i) => `${((i / Math.max(1, xs.length - 1)) * 62 + 1).toFixed(1)},${(20 - ((x - lo) / span) * 18).toFixed(1)}`).join(' ');
    return [pts(a), b ? pts(b) : ''];
  }
}

function areaPaths(ty: number[], ly: number[], w = 300, h = 64) {
  const all = [...ty, ...ly];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const x = (i: number) => (i / (ty.length - 1)) * w;
  const y = (v: number) => h - 4 - ((v - min) / (max - min || 1)) * (h - 10);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const l = line(ty);
  return { line: l, area: `${l}L${w},${h}L0,${h}Z`, ly: line(ly) };
}

/**
 * All boards. Cards by default: a small set of heterogeneous dashboards, each with a live preview, which is
 * where NN/g says cards beat lists. The whole card is the click target, with a hover/press overlay
 * (Astryx ClickableCard). A list view stays one toggle away for scanning by name.
 */
@Component({
  selector: 'app-boards-list',
  imports: [NgIcon, HlmButtonImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block' },
  template: `
    <div class="mx-auto flex max-w-[1120px] flex-col gap-6 px-[max(16px,env(safe-area-inset-left,0px))] pt-6 pb-28 sm:px-8 lg:pt-8">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-[26px] font-semibold tracking-[-0.02em]">Boards</h1>
          <p class="text-muted-foreground text-[15px]">Dashboards built from your answers. Add any chart from a conversation.</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="bg-muted flex rounded-[8px] p-0.5" role="radiogroup" aria-label="Layout">
            <button type="button" role="radio" [attr.aria-checked]="layout() === 'grid'" aria-label="Grid" class="grid size-8 place-items-center rounded-[6px] transition-colors" [class]="layout() === 'grid' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'" (click)="layout.set('grid')"><ng-icon name="phosphorSquaresFourLight" class="text-[16px]" /></button>
            <button type="button" role="radio" [attr.aria-checked]="layout() === 'list'" aria-label="List" class="grid size-8 place-items-center rounded-[6px] transition-colors" [class]="layout() === 'list' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'" (click)="layout.set('list')"><ng-icon name="phosphorListLight" class="text-[16px]" /></button>
          </div>
          <button hlmBtn (click)="store.newBoard()"><ng-icon name="phosphorPlusLight" />New board</button>
        </div>
      </header>

      @if (layout() === 'grid') {
        <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          @for (b of rows(); track b.id) {
            <li class="min-w-0">
              <button type="button" class="clickable-card group flex h-full w-full flex-col text-left" (click)="store.openBoard(b.id)" [attr.aria-label]="'Open ' + b.name">
                <span class="flex items-start gap-3 p-4 pb-3">
                  <span class="bg-secondary text-foreground grid size-10 shrink-0 place-items-center rounded-[10px]"><ng-icon name="phosphorSquaresFourLight" class="text-[18px]" /></span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[16px] font-semibold tracking-[-0.01em]">{{ b.name }}</span>
                    <span class="text-muted-foreground line-clamp-2 min-h-[2.75em] text-[13.5px]/snug">{{ b.description }}</span>
                  </span>
                  <ng-icon name="phosphorArrowUpRightLight" class="text-muted-foreground group-hover:text-foreground mt-1 shrink-0 text-[16px] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
                <span class="flex items-end justify-between gap-3 px-4">
                  <span>
                    <span class="text-muted-foreground block text-[12.5px]">{{ b.label }} · next 45 nights</span>
                    <span class="block text-[24px]/tight font-semibold tracking-[-0.02em] tabular-nums">{{ b.value }}</span>
                  </span>
                  <span class="mb-1 text-[13px] font-medium tabular-nums text-muted-foreground">{{ b.delta >= 0 ? '▲' : '▼' }} {{ b.deltaText }}</span>
                </span>
                <svg viewBox="0 0 300 64" preserveAspectRatio="none" class="mt-2 block h-16 w-full" aria-hidden="true">
                  <defs><linearGradient [attr.id]="'g-' + b.id" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--series)" stop-opacity="0.22" /><stop offset="100%" stop-color="var(--series)" stop-opacity="0" /></linearGradient></defs>
                  <path [attr.d]="b.paths.area" [attr.fill]="'url(#g-' + b.id + ')'" />
                  <path [attr.d]="b.paths.ly" fill="none" class="stroke-(--series-muted)" stroke-width="1.25" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
                  <path [attr.d]="b.paths.line" fill="none" class="stroke-(--series)" stroke-width="1.75" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                </svg>
                <span class="border-border text-muted-foreground mt-auto flex items-center justify-between gap-2 border-t px-4 py-3 text-[12.5px] tabular-nums">
                  <span>Updated {{ b.updated }}</span>
                  <span>{{ b.count }} {{ b.count === 1 ? 'chart' : 'charts' }}</span>
                </span>
              </button>
            </li>
          }
          <li class="min-w-0">
            <button type="button" class="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed transition-colors" (click)="store.newBoard()">
              <span class="bg-secondary grid size-10 place-items-center rounded-full"><ng-icon name="phosphorPlusLight" class="text-[18px]" /></span>
              <span class="text-[14px] font-medium">New board</span>
              <span class="text-[12.5px]">or use “Add to board” on any answer</span>
            </button>
          </li>
        </ul>
      } @else {
        <ul class="clickable-list divide-border flex flex-col divide-y overflow-hidden rounded-[12px] border">
          @for (b of rows(); track b.id) {
            <li>
              <button type="button" class="clickable-row group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 text-left sm:grid-cols-[minmax(0,1fr)_120px_96px_20px]" (click)="store.openBoard(b.id)">
                <span class="min-w-0">
                  <span class="block truncate text-[15px] font-medium">{{ b.name }}</span>
                  <span class="text-muted-foreground block truncate text-[13px]">Updated {{ b.updated }} · {{ b.count }} {{ b.count === 1 ? 'chart' : 'charts' }}</span>
                </span>
                <span class="text-right tabular-nums">
                  <span class="block text-[15px] font-semibold">{{ b.value }}</span>
                  <span class="block text-[12.5px] text-muted-foreground">{{ b.delta >= 0 ? '▲' : '▼' }} {{ b.deltaText }}</span>
                </span>
                <svg viewBox="0 0 300 64" preserveAspectRatio="none" class="hidden h-8 w-24 sm:block" aria-hidden="true">
                  <path [attr.d]="b.paths.line" fill="none" class="stroke-(--series)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
                </svg>
                <ng-icon name="phosphorCaretRightLight" class="text-muted-foreground group-hover:text-foreground hidden sm:block" />
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class BoardsList {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  protected readonly layout = signal<'grid' | 'list'>('grid');
  protected readonly rows = computed(() =>
    this.store.boards().map((b) => {
      const m = METRICS[b.headline];
      const nights = NIGHTS.forward;
      const ty = metricTotal(nights, b.headline);
      const ly = metricTotal(nights, b.headline, true);
      const delta = m.deltaUnit === 'pt' ? ty - ly : ((ty - ly) / ly) * 100;
      return {
        id: b.id,
        name: b.name,
        description: b.description,
        updated: b.updated,
        count: b.widgets.length,
        label: m.label,
        value: m.format(ty),
        delta,
        deltaText: `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}${m.deltaUnit === 'pt' ? ' pt' : '%'} vs LY`,
        paths: areaPaths(metricSeries(nights, b.headline), metricSeries(nights, b.headline, true)),
      };
    }),
  );
}
