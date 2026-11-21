import { Component, ElementRef, ViewEncapsulation, computed, inject, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  phosphorCalendarDotsLight,
  phosphorChartBarLight,
  phosphorChartDonutLight,
  phosphorChartLineLight,
  phosphorChartLineUpLight,
  phosphorChartPieLight,
  phosphorChartPolarLight,
  phosphorChartScatterLight,
  phosphorColumnsLight,
  phosphorFlowArrowLight,
  phosphorFunnelLight,
  phosphorGaugeLight,
  phosphorGridFourLight,
  phosphorHashLight,
  phosphorPulseLight,
  phosphorSquareSplitHorizontalLight,
  phosphorSquaresFourLight,
  phosphorStackLight,
  phosphorStepsLight,
  phosphorTableLight,
  phosphorTargetLight,
} from '@ng-icons/phosphor-icons/light';
import { KIND_LABELS, type KindOption } from './kinds';
import type { WidgetKind } from './widget-types';

/** One Phosphor icon per kind: the same picture wherever a kind is named. */
export const KIND_ICONS: Record<WidgetKind, string> = {
  kpi: 'phosphorHashLight',
  kpi_row: 'phosphorSquareSplitHorizontalLight',
  gauge: 'phosphorGaugeLight',
  bullet: 'phosphorTargetLight',
  bar: 'phosphorChartBarLight',
  grouped_bar: 'phosphorColumnsLight',
  stacked_bar: 'phosphorStackLight',
  line: 'phosphorChartLineLight',
  area: 'phosphorChartLineUpLight',
  sparkline_list: 'phosphorPulseLight',
  calendar_heatmap: 'phosphorCalendarDotsLight',
  donut: 'phosphorChartDonutLight',
  pie: 'phosphorChartPieLight',
  treemap: 'phosphorSquaresFourLight',
  funnel: 'phosphorFunnelLight',
  waterfall: 'phosphorStepsLight',
  scatter: 'phosphorChartScatterLight',
  heatmap: 'phosphorGridFourLight',
  radar: 'phosphorChartPolarLight',
  sankey: 'phosphorFlowArrowLight',
  table: 'phosphorTableLight',
};

/** What `[for]` reads: a `<juyo-widget-chart>` with its switcher on. */
export interface ViewAsSource {
  options(): readonly KindOption[];
  view(): { kind: WidgetKind; title: string };
  recommendedKind(): WidgetKind;
  viewAs(kind: WidgetKind): void;
}

/**
 * "View as": the kinds a chart's rows can be shown as, as a compact segmented control of icons, one per kind, with
 * the kind's name as its tooltip and accessible name. One is always chosen, so it is a radio group: Tab reaches the
 * chosen one, the arrow keys move and choose, Home and End jump. The kind the chart came with carries a small dot
 * ("Recommended").
 *
 * It sits in the card's header, top right. A chart with its own header hosts it there; a host that draws the
 * header itself (Kassandra's answer cards, boards) places it with `[for]="chart"`:
 *
 *   <juyo-view-as [for]="wc" />  …  <juyo-widget-chart #wc [switcher]="true" [header]="false" … />
 *
 * It only shows the choice and reports a new one: which kinds fit is `compatibleKinds`.
 */
@Component({
  selector: 'juyo-view-as',
  imports: [NgIcon],
  providers: [
    provideIcons({
      phosphorCalendarDotsLight,
      phosphorChartBarLight,
      phosphorChartDonutLight,
      phosphorChartLineLight,
      phosphorChartLineUpLight,
      phosphorChartPieLight,
      phosphorChartPolarLight,
      phosphorChartScatterLight,
      phosphorColumnsLight,
      phosphorFlowArrowLight,
      phosphorFunnelLight,
      phosphorGaugeLight,
      phosphorGridFourLight,
      phosphorHashLight,
      phosphorPulseLight,
      phosphorSquareSplitHorizontalLight,
      phosphorSquaresFourLight,
      phosphorStackLight,
      phosphorStepsLight,
      phosphorTableLight,
      phosphorTargetLight,
    }),
  ],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './view-as.css',
  host: { class: 'wc-view', role: 'radiogroup', '[attr.aria-label]': 'label()', '[class.wc-view--empty]': 'opts().length < 2' },
  template: `
    @for (o of opts(); track o.kind; let i = $index) {
      <button
        type="button"
        role="radio"
        class="wc-view-btn"
        [attr.aria-checked]="o.kind === current()"
        [attr.aria-label]="names[o.kind] + (o.kind === rec() ? ', recommended' : '')"
        [attr.tabindex]="o.kind === focusable() ? 0 : -1"
        [attr.data-kind]="o.kind"
        [attr.title]="names[o.kind] + (o.kind === rec() ? ' · Recommended' : '') + (o.reason ? '\n' + o.reason : '')"
        (click)="choose(o.kind)"
        (keydown)="onKey($event, i)"
      >
        <ng-icon [name]="icons[o.kind]" aria-hidden="true" />
        @if (o.kind === rec()) {
          <i class="wc-view-rec" aria-hidden="true"></i>
        }
      </button>
    }
  `,
})
export class ViewAs {
  /** The kinds these rows can be shown as (`compatibleKinds`). Not needed with `[for]`. */
  readonly options = input<readonly KindOption[]>([]);
  /** The kind on screen. Not needed with `[for]`. */
  readonly value = input<WidgetKind | null>(null);
  /** The kind the chart came with: Kassandra's choice, or the first look at the rows. */
  readonly recommended = input<WidgetKind | null>(null);
  /** What is being viewed, for the group's name: the chart's title. */
  readonly of = input('');
  /** The chart this switches: its options, its kind on screen and its recommendation are read from it, and a choice goes to it. */
  readonly for = input<ViewAsSource | null>(null);
  readonly picked = output<WidgetKind>();

  protected readonly icons = KIND_ICONS;
  protected readonly names = KIND_LABELS;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly opts = computed(() => this.for()?.options() ?? this.options());
  protected readonly current = computed(() => this.for()?.view().kind ?? this.value());
  protected readonly rec = computed(() => this.for()?.recommendedKind() ?? this.recommended());
  protected readonly label = computed(() => {
    const of = this.for()?.view().title ?? this.of();
    return of ? `View as: ${of}` : 'View as';
  });
  /** Tab stops on the chosen kind (the first one if the choice is not among them). */
  protected readonly focusable = computed(() => (this.opts().some((o) => o.kind === this.current()) ? this.current() : this.opts()[0]?.kind));

  protected choose(kind: WidgetKind) {
    this.for()?.viewAs(kind);
    this.picked.emit(kind);
  }

  protected onKey(event: KeyboardEvent, at: number) {
    const n = this.opts().length;
    const to = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: n - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const next = (to + n) % n;
    const option = this.opts()[next];
    if (!option) return;
    // A radio group chooses as it moves; the buttons stay the same elements, so focus can follow at once.
    this.choose(option.kind);
    this.host.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }
}
