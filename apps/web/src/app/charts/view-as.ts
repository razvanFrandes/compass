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

/**
 * "View as": the kinds a chart's rows can be shown as, as a row of compact buttons (icon + name). One is always
 * chosen, so it is a radio group: Tab reaches the chosen one, the arrow keys move and choose, Home and End jump.
 * The kind the chart came with is marked "Recommended". The row wraps on a narrow card.
 *
 * It only shows the choice and reports a new one: which kinds fit is `compatibleKinds`, and the chart itself is
 * `<juyo-widget-chart>`, which hosts this under its body.
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
  host: { class: 'wc-view', role: 'radiogroup', '[attr.aria-label]': 'label()' },
  template: `
    <span class="wc-view-label" aria-hidden="true">View as</span>
    @for (o of options(); track o.kind; let i = $index) {
      <button
        type="button"
        role="radio"
        class="wc-view-btn"
        [attr.aria-checked]="o.kind === value()"
        [attr.tabindex]="o.kind === focusable() ? 0 : -1"
        [attr.data-kind]="o.kind"
        [attr.title]="o.reason"
        (click)="picked.emit(o.kind)"
        (keydown)="onKey($event, i)"
      >
        <ng-icon [name]="icons[o.kind]" aria-hidden="true" />
        <span>{{ names[o.kind] }}</span>
        @if (o.kind === recommended()) {
          <span class="wc-view-rec"><span class="sr-only">, </span>Recommended</span>
        }
      </button>
    }
  `,
})
export class ViewAs {
  /** The kinds these rows can be shown as (`compatibleKinds`). */
  readonly options = input.required<readonly KindOption[]>();
  /** The kind on screen. */
  readonly value = input.required<WidgetKind>();
  /** The kind the chart came with: Kassandra's choice, or the first look at the rows. */
  readonly recommended = input<WidgetKind | null>(null);
  /** What is being viewed, for the group's name: the chart's title. */
  readonly of = input('');
  readonly picked = output<WidgetKind>();

  protected readonly icons = KIND_ICONS;
  protected readonly names = KIND_LABELS;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly label = computed(() => (this.of() ? `View as: ${this.of()}` : 'View as'));
  /** Tab stops on the chosen kind (the first one if the choice is not among them). */
  protected readonly focusable = computed(() => (this.options().some((o) => o.kind === this.value()) ? this.value() : this.options()[0]?.kind));

  protected onKey(event: KeyboardEvent, at: number) {
    const n = this.options().length;
    const to = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: n - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const next = (to + n) % n;
    const option = this.options()[next];
    if (!option) return;
    // A radio group chooses as it moves; the buttons stay the same elements, so focus can follow at once.
    this.picked.emit(option.kind);
    this.host.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }
}
