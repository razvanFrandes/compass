import { Component, input, output } from '@angular/core';
import type { ChatWidget } from '../api';
import { WidgetChart } from '../charts/widget-chart';
import { KassandraBoardPicker } from './kassandra-board-picker';

/**
 * A chart, table or KPI in an answer (`show_widget`): the title is the conclusion, the numbers are the rows of the
 * tool result it names, and it can be kept on a board. `loading` draws the skeleton, with the same dimensions.
 */
@Component({
  selector: 'kassandra-widget',
  imports: [WidgetChart, KassandraBoardPicker],
  host: { class: 'block' },
  template: `
    @if (widget(); as w) {
      <figure class="insight-card gen-in p-4">
        <figcaption class="min-h-[42px]">
          <h3 class="text-[14.5px]/snug font-semibold tracking-[-0.005em] text-balance">{{ w.title }}</h3>
          @if (w.subtitle) {
            <p class="text-muted-foreground mt-0.5 text-[12.5px]">{{ w.subtitle }}</p>
          }
        </figcaption>
        <juyo-widget-chart class="mt-3 block h-[240px]" [spec]="w" [rows]="w.rows" [columns]="w.columns" />
        <div class="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2">
          @if (showEvidence()) {
            <button type="button" class="k-link text-muted-foreground hover:text-foreground text-[12.5px] underline underline-offset-2" (click)="evidence.emit(w.sourceCallId)">How this was computed</button>
          }
          @if (addable()) {
            <kassandra-board-picker class="ml-auto" [widget]="w" [question]="question()" />
          }
        </div>
      </figure>
    } @else {
      <div class="insight-card p-4" role="status" aria-label="Kassandra is drawing a chart">
        <div class="min-h-[42px]">
          <div class="skeleton-wave bg-muted h-4 w-3/5 rounded"></div>
          <div class="skeleton-wave bg-muted mt-2 h-3 w-2/5 rounded"></div>
        </div>
        <div class="skeleton-wave bg-muted mt-3 h-[240px] rounded-lg"></div>
        <div class="mt-3 flex min-h-8 items-center justify-between">
          <div class="skeleton-wave bg-muted h-3 w-32 rounded"></div>
          <div class="skeleton-wave bg-muted h-8 w-28 rounded-lg"></div>
        </div>
      </div>
    }
  `,
})
export class KassandraWidget {
  /** Null while the tool is still running: the skeleton shows. */
  readonly widget = input.required<ChatWidget | null>();
  readonly question = input<string | null>(null);
  readonly showEvidence = input(true);
  /** "Add to board" is offered. */
  readonly addable = input(true);
  /** "How this was computed": the call id of the tool result the widget draws. */
  readonly evidence = output<string>();
}
