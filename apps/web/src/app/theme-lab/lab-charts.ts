import { Component, ElementRef, afterRenderEffect, inject, signal } from '@angular/core';
import { WIDGET_THEME_SCOPE, WidgetChart } from '../charts/widget-chart';
import type { EvidenceColumn, WidgetSpec } from '../charts/widget-types';
import { LabState, isConceptPane, paneOf } from './lab-kit';

/* Sample data: room revenue on the books for the next 30 stay nights (EUR thousand), this year and last. */
const DAYS = Array.from({ length: 30 }, (_, i) => i);
const THIS_YEAR = [612, 598, 640, 655, 701, 742, 730, 648, 631, 660, 672, 715, 768, 751, 660, 642, 655, 668, 702, 733, 720, 610, 588, 595, 604, 632, 671, 664, 590, 571];
const LAST_YEAR = [590, 602, 618, 640, 668, 705, 712, 655, 640, 646, 650, 690, 731, 729, 672, 660, 662, 671, 688, 712, 708, 640, 622, 615, 611, 628, 650, 655, 612, 598];
const CHANNELS = ['Direct', 'OTA', 'Corporate', 'Groups', 'Wholesale'];
const MIX = [
  [38, 41, 44, 46],
  [31, 30, 27, 25],
  [16, 15, 15, 16],
  [10, 9, 10, 9],
  [5, 5, 4, 4],
];
const MONTHS = ['Aug', 'Sep', 'Oct', 'Nov'];

const col = (key: string, label: string, kind: EvidenceColumn['kind'], unit?: string): EvidenceColumn => ({ key, label, kind, ...(unit ? { unit } : {}) });

/** This period against the comparison period: what a revenue manager reads most. */
const LINE = {
  spec: { kind: 'line', title: 'Room revenue on the books, next 30 nights', sourceCallId: 'lab:line', x: 'stay_date', y: ['this_year'], compare: 'last_year' } satisfies WidgetSpec,
  rows: DAYS.map((i) => ({ stay_date: new Date(Date.UTC(2026, 10, 21 + i)).toISOString().slice(0, 10), this_year: THIS_YEAR[i] * 1000, last_year: LAST_YEAR[i] * 1000 })),
  columns: [col('stay_date', 'Night of stay', 'date'), col('this_year', 'This year', 'currency', 'EUR'), col('last_year', 'Last year', 'currency', 'EUR')],
};

/** Categories: the theme's categorical hues in their fixed order. */
const MIX_WIDGET = {
  spec: { kind: 'stacked_bar', title: 'Channel mix, share of room nights', sourceCallId: 'lab:mix', x: 'month', y: CHANNELS.map((c) => c.toLowerCase()) } satisfies WidgetSpec,
  rows: MONTHS.map((m, j) => ({ month: m, ...Object.fromEntries(CHANNELS.map((c, i) => [c.toLowerCase(), MIX[i][j]])) })),
  columns: [col('month', 'Month', 'text'), ...CHANNELS.map((c) => col(c.toLowerCase(), c, 'percent'))],
};

/** Chart samples drawn from the pane's own tokens, plus the sequential and diverging scales where a theme has them. */
@Component({
  selector: 'app-lab-charts',
  imports: [WidgetChart],
  // The charts follow the pane's theme: they read its tokens again whenever the lab changes one.
  providers: [{ provide: WIDGET_THEME_SCOPE, useFactory: () => inject(LabState).version }],
  host: { class: 'block' },
  template: `
    <div class="grid gap-3 @3xl:grid-cols-2">
      <figure class="border-border bg-card min-w-0 rounded-lg border p-4">
        <figcaption class="text-[14px] font-semibold">Room revenue on the books, next 30 nights</figcaption>
        <p class="text-muted-foreground text-[12px]">This year is {{ lineWidth() }}px solid; last year is dashed and {{ concept() ? 'drained of colour' : 'violet' }}</p>
        <juyo-widget-chart class="mt-2 block" [spec]="line.spec" [rows]="line.rows" [columns]="line.columns" [header]="false" [switcher]="true" controls="external" [height]="200" />
      </figure>
      <figure class="border-border bg-card min-w-0 rounded-lg border p-4">
        <figcaption class="text-[14px] font-semibold">Channel mix, share of room nights</figcaption>
        <p class="text-muted-foreground text-[12px]">Five categories in the theme's fixed order</p>
        <juyo-widget-chart class="mt-2 block" [spec]="mix.spec" [rows]="mix.rows" [columns]="mix.columns" [header]="false" [switcher]="true" controls="external" [height]="200" />
      </figure>
    </div>
    <div class="mt-3 grid gap-3 @3xl:grid-cols-2">
      @if (concept()) {
        <div>
          <p class="text-[12.5px] font-medium">Sequential, for a quantity (occupancy, pickup)</p>
          <div class="mt-1.5 flex h-6 overflow-hidden rounded-[2px]" role="img" aria-label="Seven blue steps, from the surface’s end of the scale to the far end">
            @for (n of seq; track n) {
              <span class="flex-1" [style.background]="'var(--seq-' + n + ')'"></span>
            }
          </div>
          <p class="text-muted-foreground mt-1 flex justify-between text-[11.5px]"><span>Low</span><span>High</span></p>
        </div>
        <div>
          <p class="text-[12.5px] font-medium">Diverging, for a variance against budget or last year</p>
          <div class="mt-1.5 flex h-6 overflow-hidden rounded-[2px]" role="img" aria-label="Orange below, grey at zero, blue above">
            @for (n of div; track n) {
              <span class="flex-1" [style.background]="'var(--div-' + n + ')'"></span>
            }
          </div>
          <p class="text-muted-foreground mt-1 flex justify-between text-[11.5px]"><span>Behind</span><span>On plan</span><span>Ahead</span></p>
        </div>
      } @else {
        <p class="text-muted-foreground text-[12.5px] @3xl:col-span-2">The default themes have no sequential or diverging scale. Heat maps mix the series colour with the card, one alpha step at a time.</p>
      }
    </div>
  `,
})
export class LabCharts {
  protected readonly seq = [1, 2, 3, 4, 5, 6, 7];
  protected readonly div = ['neg-3', 'neg-2', 'neg-1', 'zero', 'pos-1', 'pos-2', 'pos-3'];
  protected readonly line = LINE;
  protected readonly mix = MIX_WIDGET;
  protected readonly concept = signal(false);
  protected readonly lineWidth = signal(2);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    const lab = inject(LabState);
    afterRenderEffect(() => {
      lab.version();
      const pane = paneOf(this.host.nativeElement);
      this.concept.set(isConceptPane(pane));
      this.lineWidth.set(Number.parseFloat(getComputedStyle(pane ?? this.host.nativeElement).getPropertyValue('--chart-line-width')) || 2);
    });
  }
}
