import { Component, computed, input, output } from '@angular/core';
import { WidgetChart, type WidgetLoading } from '../charts/widget-chart';
import { KassandraBoardPicker } from './kassandra-board-picker';
import { shownPhase, type SlotPhase, type WidgetSlot } from './live-slots';

/** The phase of a slot as `<juyo-widget-chart>` draws it: its whole skeleton, the skeleton under a real title, the chart. */
const LOADING: Record<SlotPhase, WidgetLoading> = { chosen: 'skeleton', described: 'title', ready: 'none' };

/**
 * A chart, table or KPI in an answer (`show_widget`), in the three phases of docs/decisions.md "Skeletons":
 *
 *   chosen     the call has started: skeleton lines for the title, a skeleton for the chart;
 *   described  its arguments are known: the real title and subtitle, the chart still a skeleton, now with the
 *              dimensions of that widget kind;
 *   ready      the result is in: the chart takes the skeleton's place, in the same box.
 *
 * The card is the same element through all three, and the chart area is always `<juyo-widget-chart>` (its own
 * skeleton while there are no rows), so nothing moves when the data arrives. `held` keeps a skeleton that has just
 * appeared on screen for its minimum time. The title is the conclusion; the numbers are the tool's rows.
 */
@Component({
  selector: 'kassandra-widget',
  imports: [WidgetChart, KassandraBoardPicker],
  host: { class: 'block', '[attr.data-phase]': 'phase()' },
  template: `
    @let s = slot();
    <figure class="insight-card gen-in p-card-pad" [attr.aria-busy]="phase() === 'ready' ? null : 'true'">
      <figcaption class="min-h-[42px]">
        @if (s.title) {
          <h3 class="text-[14.5px]/snug font-semibold tracking-[-0.005em] text-balance">{{ s.title }}</h3>
          @if (s.subtitle) {
            <p class="text-muted-foreground mt-0.5 text-[12.5px]">{{ s.subtitle }}</p>
          }
        } @else {
          <span class="sr-only" role="status">Kassandra is drawing a chart</span>
          <span class="block pt-0.5">
            <i class="k-skel block h-4 w-3/5"></i>
            <i class="k-skel mt-2 block h-3 w-2/5"></i>
          </span>
        }
      </figcaption>
      <juyo-widget-chart class="mt-stack block" [spec]="s.spec" [rows]="s.widget?.rows ?? null" [columns]="s.widget?.columns ?? null" [loading]="loading()" [header]="false" [compact]="true" />
      <div class="mt-stack flex min-h-8 flex-wrap items-center justify-between gap-2">
        @if (phase() === 'ready' && s.widget; as w) {
          @if (showEvidence()) {
            <button type="button" class="k-link text-muted-foreground hover:text-foreground text-[12.5px] underline underline-offset-2" (click)="evidence.emit(w.sourceCallId)">Behind the numbers</button>
          }
          @if (addable()) {
            <kassandra-board-picker class="ml-auto" [widget]="w" [question]="question()" />
          }
        } @else {
          <i class="k-skel block h-3 w-32" aria-hidden="true"></i>
          @if (addable()) {
            <i class="k-skel block h-8 w-[124px] !rounded-lg" aria-hidden="true"></i>
          }
        }
      </div>
    </figure>
  `,
})
export class KassandraWidget {
  /** The widget at the phase it has reached (see `widgetSlots`). */
  readonly slot = input.required<WidgetSlot>();
  /** Its skeleton has just appeared and must stay a little longer, even if the chart is already there. */
  readonly held = input(false);
  readonly question = input<string | null>(null);
  readonly showEvidence = input(true);
  /** "Add to board" is offered. */
  readonly addable = input(true);
  /** "Behind the numbers": the call id of the tool result the widget draws. */
  readonly evidence = output<string>();

  protected readonly phase = computed(() => shownPhase(this.slot().phase, this.held()));
  protected readonly loading = computed(() => LOADING[this.phase()]);
}
