import { Component, computed, inject, input, output } from '@angular/core';
import type { ChatWidget } from '../api';
import { specAs } from '../charts/kinds';
import { ViewAsMemory } from '../charts/view-memory';
import { WidgetChart, type WidgetLoading } from '../charts/widget-chart';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorDatabaseLight } from '@ng-icons/phosphor-icons/light';
import { ViewAs } from '../charts/view-as';
import { KassandraBoardPicker } from './kassandra-board-picker';
import { shownPhase, type SlotPhase, type WidgetSlot } from './live-slots';

/** The phase of a slot as `<juyo-widget-chart>` draws it: its whole skeleton, the skeleton under a real title, the chart. */
const LOADING: Record<SlotPhase, WidgetLoading> = { chosen: 'skeleton', described: 'title', ready: 'none' };

/**
 * A chart, table or KPI in an answer, in the three phases of docs/decisions.md "Skeletons":
 *
 *   chosen     a call has started: skeleton lines for the title, a skeleton for the chart;
 *   described  its arguments are known: the real title and subtitle, the chart still a skeleton, now with the
 *              dimensions of that widget kind;
 *   ready      the result is in: the chart takes the skeleton's place, in the same box.
 *
 * The card is the same element through all three, and the chart area is always `<juyo-widget-chart>` (its own
 * skeleton while there are no rows), so nothing moves when the data arrives. `held` keeps a skeleton that has just
 * appeared on screen for its minimum time. The title is the conclusion; the numbers are the tool's rows.
 *
 * A slot may be an instant preview (drawn from a data result before Kassandra chose a chart): it says "Preview",
 * and when her show_widget for that result lands the same card takes her kind and title. In the card's header,
 * top right, "View as" lists the kinds its rows can be shown as (icons; the choice is remembered for this answer),
 * then "Behind the numbers" and "Add to board" (which saves the kind on screen), so the body is only the chart.
 */
@Component({
  selector: 'kassandra-widget',
  imports: [WidgetChart, KassandraBoardPicker, NgIcon, ViewAs],
  providers: [provideIcons({ phosphorDatabaseLight })],
  host: { class: 'block', '[attr.data-phase]': 'phase()', '[attr.data-preview]': 'previewing() ? "" : null' },
  styles: `
    .k-tool {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-control, 7px);
      color: var(--muted-foreground);
      font-size: 16px;
      transition: color 120ms ease, background-color 120ms ease;
    }
    .k-tool:hover {
      color: var(--foreground);
      background: var(--overlay-hover);
    }
    .k-tool:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 1px;
    }
    @media (pointer: coarse) {
      .k-tool {
        width: 40px;
        height: 40px;
      }
    }
    .k-preview {
      flex: none;
      margin-top: 1px;
      padding: 1px 7px;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--muted-foreground);
      font-size: 11px;
      line-height: 16px;
      white-space: nowrap;
    }
  `,
  template: `
    @let s = slot();
    <figure class="insight-card gen-in p-card-pad" [attr.aria-busy]="phase() === 'ready' ? null : 'true'">
      <figcaption class="flex min-h-[42px] items-start gap-3">
        <div class="min-w-0 flex-1">
          @if (s.title) {
            <h3 class="text-[14.5px]/snug font-semibold tracking-[-0.005em] text-balance">{{ s.title }}</h3>
            @if (s.subtitle) {
              <p class="text-muted-foreground mt-0.5 text-[12.5px]">{{ s.subtitle }}</p>
            }
          } @else {
            <span class="sr-only" role="status">{{ s.preview ? 'Kassandra is reading the data' : 'Kassandra is drawing a chart' }}</span>
            <span class="block pt-0.5">
              <i class="k-skel block h-4 w-3/5"></i>
              <i class="k-skel mt-2 block h-3 w-2/5"></i>
            </span>
          }
        </div>
        @if (previewing()) {
          <p class="k-preview" title="Drawn from the data as it arrived. Kassandra may still choose another chart.">Preview<span class="sr-only">: drawn from the data as it arrived. Kassandra may still choose another chart.</span></p>
        }
        <!-- The card's tools sit top right, so the body is only the chart: View as, Behind the numbers, Add to board -->
        <div class="flex min-w-[3.5rem] flex-none items-center justify-end gap-1">
          @if (phase() === 'ready' && shown(); as w) {
            <juyo-view-as [for]="wc" />
            @if (showEvidence()) {
              <button type="button" class="k-tool" aria-label="Behind the numbers" title="Behind the numbers" (click)="evidence.emit(w.sourceCallId)"><ng-icon name="phosphorDatabaseLight" aria-hidden="true" /></button>
            }
            @if (addable()) {
              <kassandra-board-picker [widget]="w" [question]="question()" [compact]="true" />
            }
          } @else {
            <i class="k-skel block h-7 w-14 !rounded-lg" aria-hidden="true"></i>
          }
        </div>
      </figcaption>
      <juyo-widget-chart #wc class="mt-stack block" [spec]="s.spec" [rows]="s.widget?.rows ?? null" [columns]="s.widget?.columns ?? null" [loading]="loading()" [header]="false" [compact]="true" [switcher]="true" controls="external" [viewKey]="viewKey()" />
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

  private readonly memory = inject(ViewAsMemory);
  protected readonly phase = computed(() => shownPhase(this.slot().phase, this.held()));
  protected readonly loading = computed(() => LOADING[this.phase()]);
  /** The chart on screen is the instant preview, not yet Kassandra's choice. */
  protected readonly previewing = computed(() => this.slot().preview && this.phase() === 'ready');
  /** "View as" is remembered per chart of an answer: the slot's id outlives the preview turning into Kassandra's chart. */
  protected readonly viewKey = computed(() => `answer:${this.slot().callId}`);
  /** The widget as it shows: with the kind chosen in "View as". This is what "Add to board" saves. */
  protected readonly shown = computed<ChatWidget | null>(() => {
    const widget = this.slot().widget;
    if (!widget) return null;
    const { rows, columns, evidence, ...spec } = widget;
    const view = specAs(spec, this.memory.kind(this.viewKey()), rows, columns);
    return view === spec ? widget : { ...view, rows, columns, evidence };
  });
}
