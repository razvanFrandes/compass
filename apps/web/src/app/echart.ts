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
const base = (text: string, font = 'Inter, ui-sans-serif, system-ui') => ({ backgroundColor: 'transparent', textStyle: { fontFamily: font, color: text } });
echarts.registerTheme('compass-dark', base('#9ba3ad'));
echarts.registerTheme('compass-light', base('#57606a'));

const root = () => document.documentElement;
const isLight = () => typeof document !== 'undefined' && root().classList.contains('light');
/** Theme as a signal, so option builders re-run with the right palette when the app switches theme. */
export const chartTheme = signal<'dark' | 'light'>(isLight() ? 'light' : 'dark');

/** The ECharts theme in use: the default themes' dark or light, or the concept theme's own in either mode. */
export type ChartSkin = 'dark' | 'light' | 'juyo-concept' | 'juyo-concept-dark';
const skinNow = (): ChartSkin => {
  const mode = isLight() ? 'light' : 'dark';
  if (typeof document === 'undefined' || root().dataset['theme'] !== 'juyo-concept') return mode;
  return mode === 'light' ? 'juyo-concept' : 'juyo-concept-dark';
};
export const chartSkin = signal<ChartSkin>(skinNow());
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  new MutationObserver(() => {
    chartTheme.set(isLight() ? 'light' : 'dark');
    chartSkin.set(skinNow());
  }).observe(root(), { attributes: true, attributeFilter: ['class', 'data-theme'] });
}

/** Chart colours come from the design tokens, read when the theme changes. Pass an element to read a themed subtree. */
export function palette(scope?: Element): Palette {
  chartTheme();
  chartSkin();
  const cs = getComputedStyle(scope ?? root());
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

/** How marks are drawn, from the theme's chart tokens. The fallbacks are what the default themes have always drawn. */
export interface ChartStyle {
  font: string;
  lineWidth: number;
  cmpDash: number[];
  barRadius: number;
  axis: string;
  rule: string;
  categories: string[];
}
export function chartStyle(scope?: Element): ChartStyle {
  chartTheme();
  chartSkin();
  const cs = getComputedStyle(scope ?? root());
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  const px = (n: string, f: number) => Number.parseFloat(v(n, '')) || f;
  return {
    font: v('--font-sans', 'Inter, ui-sans-serif, system-ui'),
    lineWidth: px('--chart-line-width', 2.5),
    cmpDash: v('--chart-cmp-dash', '4 4').split(/\s+/).map(Number),
    barRadius: px('--chart-bar-radius', 3),
    axis: v('--chart-axis', v('--muted-foreground', '#9ba3ad')),
    rule: v('--chart-rule', v('--field-border', '#2a2e33')),
    categories: [1, 2, 3, 4, 5].map((n) => v(`--cat-${n}`, v(`--chart-${n}`, '#5b8deb'))),
  };
}

/** The concept theme's ECharts defaults are built from its tokens, the first time each of its modes is used. */
const conceptRegistered = new Set<ChartSkin>();
function themeName(skin: ChartSkin) {
  if (skin !== 'dark' && skin !== 'light' && !conceptRegistered.has(skin)) {
    const p = palette();
    const s = chartStyle();
    echarts.registerTheme(`compass-${skin}`, {
      ...base(s.axis, s.font),
      categoryAxis: { axisLine: { lineStyle: { color: s.rule } }, axisTick: { show: false }, splitLine: { show: false } },
      valueAxis: { axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: p.grid, width: 1 } } },
      line: { lineStyle: { width: s.lineWidth }, symbol: 'none', smooth: false },
      bar: { itemStyle: { borderRadius: s.barRadius } },
    });
    conceptRegistered.add(skin);
  }
  return `compass-${skin}`;
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
      this.chart = echarts.init(node, themeName(chartSkin()), { renderer: 'svg' });
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
      const name = themeName(chartSkin());
      this.chart?.setTheme(name);
    });
  }
}
