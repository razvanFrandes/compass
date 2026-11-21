import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, viewChild } from '@angular/core';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { BarChart, CustomChart, FunnelChart, GaugeChart, HeatmapChart, LineChart, PieChart, RadarChart, SankeyChart, ScatterChart, TreemapChart } from 'echarts/charts';
import { CalendarComponent, GraphicComponent, GridComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent, VisualMapContinuousComponent } from 'echarts/components';
import { AxisBreak, LabelLayout } from 'echarts/features';
import { SVGRenderer } from 'echarts/renderers';

// Only what the widget catalogue draws. SVG keeps text crisp and lets the page's font features apply.
echarts.use([BarChart, CustomChart, FunnelChart, GaugeChart, HeatmapChart, LineChart, PieChart, RadarChart, SankeyChart, ScatterChart, TreemapChart, CalendarComponent, GraphicComponent, GridComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent, VisualMapContinuousComponent, AxisBreak, LabelLayout, SVGRenderer]);

/**
 * A thin ECharts host for the widget catalogue. Colours and fonts arrive in the option (built from the design
 * tokens), so there is no ECharts theme to switch; a new option replaces the old one; the chart follows its box.
 */
@Component({
  selector: 'juyo-echart',
  host: { class: 'block h-full w-full' },
  template: `<div #el class="h-full w-full"></div>`,
})
export class EChartHost {
  readonly option = input.required<EChartsCoreOption>();
  private readonly el = viewChild.required<ElementRef<HTMLDivElement>>('el');
  private chart?: EChartsType;
  private applied?: EChartsCoreOption;

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const node = this.el().nativeElement;
      // The chart is created once its box has a size (a hidden tab or a test DOM has none), then follows it.
      const fit = () => {
        if (!node.clientWidth || !node.clientHeight) return;
        if (this.chart) return this.chart.resize();
        this.chart = echarts.init(node, null, { renderer: 'svg' });
        this.applied = this.option();
        this.chart.setOption(this.applied, true);
      };
      fit();
      const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
      ro?.observe(node);
      destroy.onDestroy(() => {
        ro?.disconnect();
        this.chart?.dispose();
      });
    });
    // A new option replaces the old one. The same option again (an unrelated change upstream) leaves the drawing
    // alone: setOption would redraw it and hide a tooltip under a pointer that has not moved.
    effect(() => {
      const option = this.option();
      if (!this.chart || option === this.applied) return;
      this.applied = option;
      this.chart.setOption(option, true);
    });
  }

  /** Highlights one mark and shows its tooltip: what the arrow keys do. */
  showTip(seriesIndex: number, dataIndex: number) {
    this.chart?.dispatchAction({ type: 'downplay' });
    this.chart?.dispatchAction({ type: 'highlight', seriesIndex, dataIndex });
    this.chart?.dispatchAction({ type: 'showTip', seriesIndex, dataIndex });
  }

  hideTip() {
    this.chart?.dispatchAction({ type: 'downplay' });
    this.chart?.dispatchAction({ type: 'hideTip' });
  }
}
