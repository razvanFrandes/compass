import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import { AriaComponent, DataZoomComponent, GraphicComponent, GridComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { AxisBreak, LabelLayout } from 'echarts/features';
import { SVGRenderer } from 'echarts/renderers';
import type { Palette } from './portfolio';

// Modular imports keep the bundle to the chart types the catalogue uses.
echarts.use([BarChart, LineChart, PieChart, ScatterChart, AriaComponent, DataZoomComponent, GraphicComponent, GridComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, TooltipComponent, AxisBreak, LabelLayout, SVGRenderer]);

// Our own themes: ECharts' default palette fails 3:1 on white, and every series colour comes from the renderer anyway.
const base = (text: string) => ({ backgroundColor: 'transparent', textStyle: { fontFamily: 'Inter, ui-sans-serif, system-ui', color: text } });
echarts.registerTheme('compass-dark', base('#9ba3ad'));
echarts.registerTheme('compass-light', base('#57606a'));

const isLight = () => typeof document !== 'undefined' && document.documentElement.classList.contains('light');
/** Theme as a signal, so option builders re-run with the right palette when the app switches theme. */
export const chartTheme = signal<'dark' | 'light'>(isLight() ? 'light' : 'dark');
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  new MutationObserver(() => chartTheme.set(isLight() ? 'light' : 'dark')).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

/** Chart colours come from the design tokens, read when the theme changes. */
export function palette(): Palette {
  chartTheme();
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return {
    series: v('--series', '#5b8deb'),
    seriesSoft: v('--series-soft', 'rgb(91 141 235 / 0.55)'),
    cmp: v('--series-cmp', '#9685e4'),
    ref: v('--series-ref', '#c9d1d9'),
    grey: v('--series-muted', '#8b949e'),
    fg: v('--foreground', '#eef1f4'),
    text: v('--text-1', '#e6edf3'),
    muted: v('--muted-foreground', '#9ba3ad'),
    grid: v('--grid', 'rgb(255 255 255 / 0.06)'),
    card: v('--card', '#161c22'),
    popover: v('--popover', '#1e2429'),
    border: v('--field-border', '#2a2e33'),
    neg: v('--negative', '#f0616d'),
  };
}

/**
 * A thin ECharts host. Theme switches go through setTheme (ngx-echarts would destroy and rebuild the chart);
 * options replace the previous ones; the chart follows its container's size.
 */
@Component({
  selector: 'app-echart',
  host: { class: 'block', role: 'img', '[attr.aria-label]': 'label()' },
  template: `<div #el class="h-full w-full" aria-hidden="true"></div>`,
})
export class EChart {
  readonly option = input.required<EChartsCoreOption>();
  readonly label = input('');
  /** A click on a data mark: its index, for the card's structured drill. */
  readonly pick = output<number>();
  private readonly el = viewChild.required<ElementRef<HTMLDivElement>>('el');
  private chart?: EChartsType;

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const node = this.el().nativeElement;
      this.chart = echarts.init(node, `compass-${chartTheme()}`, { renderer: 'svg' });
      this.chart.setOption(this.option(), true);
      this.chart.on('click', (e) => {
        if (typeof e.dataIndex === 'number' && e.componentType === 'series') this.pick.emit(e.dataIndex);
      });
      const ro = new ResizeObserver(() => this.chart?.resize());
      ro.observe(node);
      destroy.onDestroy(() => {
        ro.disconnect();
        this.chart?.dispose();
      });
    });
    effect(() => {
      const opt = this.option();
      this.chart?.setOption(opt, true);
    });
    effect(() => {
      const t = chartTheme();
      this.chart?.setTheme(`compass-${t}`);
    });
  }
}
