import { Component, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { WidgetChart } from './charts/widget-chart';
import { ViewAs } from './charts/view-as';
import type { WidgetSpec } from './charts/widget-types';
import { BOOKED, CHANNELS, COMPARES, Filters, RANGES, SEGMENTS, hotelLabel, rangeDates, scopeChips, tokenValue } from './filters';
import { ChartSpec, resolve } from './portfolio';
import { CompassStore } from './store';
import { Live } from './live';
import { BoardsService } from './boards/boards.service';
import { chartToWidget } from './boards/catalogue-widget';
import { CHART_HEIGHT, type ChartSize } from './theme/density';
import * as icons from './icons';

/*
  A chart of the Portfolio board (report: "Fiecare grafic poartă aceleași cinci piese"): a statement title and a
  scope line; a badge when a dashboard filter can't apply (click it for the read-only list); "View as" with only
  the kinds these rows fit; "Behind the numbers"; "Add to board" (saves the numbers, not a picture). The chart
  itself is <juyo-widget-chart>, the same component as Kassandra's answers, saved boards and /catalog. Clicking a
  mark sends a structured follow-up ({ drill: { dimension, value } }).
*/
/** A new board made from one chart is named after what the chart shows; rename it any time. */
const BOARD_NAME: Record<ChartSpec['kind'], string> = {
  position: 'Budget watch',
  pace: 'Pace',
  pickup: 'Pickup',
  fan: 'Forecast',
  mix_net: 'Channel profitability',
  share: 'Business mix',
  quadrant: 'Comp set position',
  bridge: 'GOP review',
  table: 'Hotel performance',
};

@Component({
  selector: 'app-chart-card',
  imports: [NgIcon, WidgetChart, ViewAs, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block min-w-0' },
  template: `
    @let r = resolved();
    <article class="insight-card flex h-full flex-col p-card-pad" [attr.aria-labelledby]="spec().id + '-t'">
      <header class="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div class="min-w-[min(100%,15rem)] flex-1">
          <h2 [id]="spec().id + '-t'" class="text-[15.5px]/snug font-semibold tracking-[-0.005em]">{{ r.title }}</h2>
          <p class="text-muted-foreground mt-1 text-[12.5px]/snug">{{ r.subtitle }}</p>
        </div>
        <div class="ml-auto flex flex-none items-start gap-3">
          @if (widget()) {
            <juyo-view-as class="mt-0.5" [for]="wc" />
          }
          <button hlmBtn variant="ghost" size="icon-sm" class="text-muted-foreground" [attr.aria-label]="'More for ' + r.title" [hlmDropdownMenuTrigger]="menu" align="end"><ng-icon name="phosphorDotsThreeBold" class="text-[18px]" /></button>
        </div>
      </header>

      @if (r.badge) {
        <button type="button" class="scope-badge mt-3 self-start" [attr.aria-expanded]="scopeOpen()" [attr.aria-controls]="spec().id + '-scope'" (click)="scopeOpen.set(!scopeOpen())">
          <ng-icon name="phosphorWarningCircleLight" />{{ r.badge.label }}
        </button>
      }
      @if (scopeOpen() && r.badge) {
        <div [id]="spec().id + '-scope'" class="latest-panel mt-2 rounded-[10px] p-3 text-[12.5px]">
          <p class="text-muted-foreground">{{ r.badge.detail }}</p>
          <p class="mt-2 font-medium">Filters on this chart</p>
          <ul class="text-muted-foreground mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            @for (f of filterList(); track f.k) {
              <li class="contents">
                <span>{{ f.k }}</span><span [class.line-through]="f.ignored">{{ f.v }}</span>
              </li>
            }
          </ul>
          <p class="text-muted-foreground mt-2">Struck-through filters don’t apply to this chart. The board keeps them for the other charts.</p>
        </div>
      }

      <div class="mt-stack min-h-0 flex-1">
        @if (r.empty; as e) {
          <div class="text-muted-foreground flex flex-col items-start gap-3 py-6 text-[14px]">
            {{ e.text }}
            @if (e.action; as a) {
              <button hlmBtn variant="outline" size="sm" (click)="filters.set(a.patch)">{{ a.label }}</button>
            }
          </div>
        }
        <!-- Kept while empty, so "View as" in the header always has its widget to point at -->
        <juyo-widget-chart
          #wc
          [hidden]="!!r.empty"
          [spec]="widget()?.spec ?? placeholder"
          [rows]="widget()?.rows ?? []"
          [columns]="widget()?.columns ?? []"
          [header]="false"
          [switcher]="true"
          controls="external"
          [viewKey]="'portfolio:' + spec().id"
          [height]="height()"
          (picked)="drillRow($event)"
        />
      </div>

      @if (howOpen()) {
        <section class="mt-card-pad text-[12.5px]" aria-label="Behind the numbers">
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            @for (d of r.definitions; track d[0]) {
              <dt class="text-muted-foreground">{{ d[0] }}</dt>
              <dd>{{ d[1] }}</dd>
            }
            <dt class="text-muted-foreground">Filters</dt>
            <dd>{{ scope() }}</dd>
            <dt class="text-muted-foreground">Data</dt>
            <dd>Halcyon group data, as of {{ asOf }}</dd>
          </dl>
          <p class="text-muted-foreground mt-2">{{ r.computed }}</p>
          <pre class="latest-panel mt-2 max-h-56 overflow-auto rounded-[8px] p-3 font-mono text-[11.5px]/relaxed whitespace-pre">{{ r.sql }}</pre>
        </section>
      }
    </article>

    <ng-template #menu>
      <hlm-dropdown-menu class="w-72">
        <button hlmDropdownMenuItem (triggered)="howOpen.set(!howOpen())"><ng-icon name="phosphorDatabaseLight" />{{ howOpen() ? 'Close Behind the numbers' : 'Behind the numbers' }}</button>
        <hlm-dropdown-menu-separator />
        <hlm-dropdown-menu-label>Add to board</hlm-dropdown-menu-label>
        @for (b of savedBoards(); track b.id) {
          <button hlmDropdownMenuItem (triggered)="addTo(b.id)"><ng-icon name="phosphorPlusLight" /><span class="truncate">{{ b.name }}</span></button>
        }
        <button hlmDropdownMenuItem (triggered)="addTo('new')"><ng-icon name="phosphorSquaresFourLight" />New board…</button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class ChartCard {
  /**
   * The height of the chart: `overview` (180 px) for a chart among others, `hero` (320 px) for the featured one,
   * `auto` for the chart's own height (a bullet per hotel grows with its rows).
   */
  readonly size = input<ChartSize | 'auto'>('auto');
  readonly spec = input.required<ChartSpec>();
  protected readonly filters = inject(Filters);
  protected readonly store = inject(CompassStore);
  private readonly live = inject(Live);
  protected readonly asOf = 'Fri 20 Nov, 07:00';
  protected readonly resolved = computed(() => resolve(this.spec(), this.filters.state()));
  protected readonly height = computed(() => {
    const size = this.size();
    return size === 'auto' ? (this.resolved().height ?? null) : CHART_HEIGHT[size];
  });
  /** The chart as a widget: the resolver's rows, under its statement title. */
  protected readonly widget = computed(() => {
    const r = this.resolved();
    if (!r.data || r.empty) return null;
    const { rows, columns, ...drawing } = r.data;
    const spec: WidgetSpec = { ...drawing, title: r.title, subtitle: r.subtitle, sourceCallId: `portfolio:${this.spec().id}` };
    return { spec, rows, columns };
  });
  protected readonly placeholder: WidgetSpec = { kind: 'table', title: 'No data', sourceCallId: 'portfolio:none' };
  protected readonly howOpen = signal(false);
  protected readonly scopeOpen = signal(false);
  private readonly boards = inject(BoardsService);
  protected readonly savedBoards = computed(() => this.boards.boards().slice(0, 8));
  protected readonly scope = computed(() => scopeChips(this.filters.state()).join(' · '));
  protected readonly filterList = computed(() => {
    const s = this.filters.state();
    const ig = this.resolved().ignores;
    return [
      { k: 'Hotels', v: hotelLabel(s.hotels), ignored: false },
      { k: 'Stay dates', v: `${RANGES[s.range].label} (${rangeDates(s.range)})`, ignored: ig.includes('stay nights') },
      { k: 'Compare', v: COMPARES[s.compare].label, ignored: ig.includes('comparison') },
      { k: 'Segment', v: s.segments.length ? tokenValue(s.segments, s.segOp, SEGMENTS) : 'All', ignored: ig.includes('segment') },
      { k: 'Channel', v: s.channels.length ? tokenValue(s.channels, s.chOp, CHANNELS) : 'All', ignored: ig.includes('channel') },
      ...(s.booked ? [{ k: 'Booked', v: BOOKED[s.booked].label, ignored: ig.includes('booking window') }] : []),
    ];
  });

  protected drillRow(row: Record<string, unknown>) {
    const d = this.resolved().drillRow?.(row);
    if (d) this.live.drill(d, this.filters.state());
  }
  /** The chart, with the numbers it shows right now, onto a saved board (or a new one named after the chart). */
  protected async addTo(target: string | 'new') {
    const payload = chartToWidget(this.spec(), this.filters.state());
    if (!payload) {
      toast('Nothing to add', { description: 'This chart has no data for these filters. Widen the filters and try again.', duration: 5000 });
      return;
    }
    await this.boards.addTo(target, payload, (id) => this.store.openBoard(id), BOARD_NAME[this.spec().kind]);
  }
}
