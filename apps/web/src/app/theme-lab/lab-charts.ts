import { Component, ElementRef, afterRenderEffect, inject, signal } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { type ChartStyle, EChart, chartStyle, palette } from '../echart';
import type { Palette } from '../portfolio';
import { LabState, isConceptPane, paneOf } from './lab-kit';

/* Sample data: room revenue on the books for the next 30 stay nights (EUR thousand), this year and last. */
const DAYS = Array.from({ length: 30 }, (_, i) => i);
const THIS_YEAR = [612, 598, 640, 655, 701, 742, 730, 648, 631, 660, 672, 715, 768, 751, 660, 642, 655, 668, 702, 733, 720, 610, 588, 595, 604, 632, 671, 664, 590, 571];
const LAST_YEAR = [590, 602, 618, 640, 668, 705, 712, 655, 640, 646, 650, 690, 731, 729, 672, 660, 662, 671, 688, 712, 708, 640, 622, 615, 611, 628, 650, 655, 612, 598];
const label = (i: number) => {
  const d = new Date(Date.UTC(2026, 10, 21 + i));
  return `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
};
const CHANNELS = ['Direct', 'OTA', 'Corporate', 'Groups', 'Wholesale'];
const MIX = [
  [38, 41, 44, 46],
  [31, 30, 27, 25],
  [16, 15, 15, 16],
  [10, 9, 10, 9],
  [5, 5, 4, 4],
];
const MONTHS = ['Aug', 'Sep', 'Oct', 'Nov'];

const axisText = (s: ChartStyle) => ({ color: s.axis, fontSize: 12, fontFamily: s.font });
const tooltip = (p: Palette, s: ChartStyle) => ({ trigger: 'axis', backgroundColor: p.popover, borderColor: p.border, borderWidth: 1, padding: [6, 10], textStyle: { color: p.fg, fontSize: 12, fontFamily: s.font }, axisPointer: { type: 'line', lineStyle: { color: s.rule } } });

/** This period against the comparison period: what a revenue manager reads most. */
function lineOption(p: Palette, s: ChartStyle): EChartsCoreOption {
  return {
    animationDuration: 400,
    grid: { left: 4, right: 96, top: 14, bottom: 4, containLabel: true },
    tooltip: { ...tooltip(p, s), valueFormatter: (v: number) => `€${v}k` },
    xAxis: { type: 'category', data: DAYS.map(label), boundaryGap: false, axisLine: { lineStyle: { color: s.rule } }, axisTick: { show: false }, axisLabel: { ...axisText(s), interval: 6 } },
    yAxis: { type: 'value', min: 500, max: 800, interval: 100, axisLabel: { ...axisText(s), formatter: (v: number) => `€${v}k` }, splitLine: { lineStyle: { color: p.grid } } },
    series: [
      { name: 'Last year', type: 'line', data: LAST_YEAR, symbol: 'none', lineStyle: { color: p.cmp, width: 1.5, type: s.cmpDash }, itemStyle: { color: p.cmp }, endLabel: { show: true, formatter: 'Last year', color: s.axis, fontSize: 12, fontFamily: s.font } },
      { name: 'This year', type: 'line', data: THIS_YEAR, symbol: 'none', lineStyle: { color: p.series, width: s.lineWidth }, itemStyle: { color: p.series }, endLabel: { show: true, formatter: 'This year', color: p.text, fontSize: 12, fontWeight: 600, fontFamily: s.font } },
    ],
  };
}

/** Categories: the order alternates light and dark steps, so neighbours never merge. */
function mixOption(p: Palette, s: ChartStyle): EChartsCoreOption {
  return {
    animationDuration: 400,
    grid: { left: 4, right: 86, top: 14, bottom: 4, containLabel: true },
    tooltip: { ...tooltip(p, s), axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(127,127,127,0.08)' } }, valueFormatter: (v: number) => `${v}%` },
    xAxis: { type: 'category', data: MONTHS, axisLine: { lineStyle: { color: s.rule } }, axisTick: { show: false }, axisLabel: axisText(s) },
    yAxis: { type: 'value', max: 100, interval: 25, axisLabel: { ...axisText(s), formatter: (v: number) => `${v}%` }, splitLine: { lineStyle: { color: p.grid } } },
    series: CHANNELS.map((name, i) => ({
      name,
      type: 'bar',
      stack: 'mix',
      barWidth: '46%',
      data: MIX[i],
      itemStyle: { color: s.categories[i], borderColor: p.card, borderWidth: 1, borderRadius: i === CHANNELS.length - 1 ? [s.barRadius, s.barRadius, 0, 0] : 0 },
      // The legend is the last bar's labels: no colour key to match by eye.
      label: { show: true, position: 'right', distance: 8, color: s.axis, fontSize: 12, fontFamily: s.font, formatter: (x: { dataIndex: number }) => (x.dataIndex === MONTHS.length - 1 ? name : '') },
      labelLayout: { moveOverlap: 'shiftY' },
    })),
  };
}

/** Chart samples drawn from the pane's own tokens, plus the sequential and diverging scales where a theme has them. */
@Component({
  selector: 'app-lab-charts',
  imports: [EChart],
  host: { class: 'block' },
  template: `
    <div class="grid gap-3 @3xl:grid-cols-2">
      <figure class="border-border bg-card min-w-0 rounded-lg border p-4">
        <figcaption class="text-[14px] font-semibold">Room revenue on the books, next 30 nights</figcaption>
        <p class="text-muted-foreground text-[12px]">This year is {{ lineWidth() }}px solid; last year is dashed and {{ concept() ? 'drained of colour' : 'violet' }}</p>
        @if (line(); as o) {
          <app-echart class="mt-2 h-[200px]" [option]="o" label="Line chart: room revenue on the books for the next 30 nights, this year against last year. This year ends near 571 thousand euros, last year near 598." />
        }
      </figure>
      <figure class="border-border bg-card min-w-0 rounded-lg border p-4">
        <figcaption class="text-[14px] font-semibold">Channel mix, share of room nights</figcaption>
        <p class="text-muted-foreground text-[12px]">Five categories, labelled on the last bar instead of a legend</p>
        @if (mix(); as o) {
          <app-echart class="mt-2 h-[200px]" [option]="o" label="Stacked bars: channel mix by month from August to November. Direct grows from 38 to 46 percent while OTA falls from 31 to 25." />
        }
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
  protected readonly line = signal<EChartsCoreOption | null>(null);
  protected readonly mix = signal<EChartsCoreOption | null>(null);
  protected readonly concept = signal(false);
  protected readonly lineWidth = signal(2);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    const lab = inject(LabState);
    afterRenderEffect(() => {
      lab.version();
      const pane = paneOf(this.host.nativeElement);
      const p = palette(pane);
      const s = chartStyle(pane);
      this.concept.set(isConceptPane(pane));
      this.lineWidth.set(s.lineWidth);
      this.line.set(lineOption(p, s));
      this.mix.set(mixOption(p, s));
    });
  }
}
