import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { EChart, palette } from '../echart';
import type { Palette } from '../portfolio';
import type { EvidenceColumn, WidgetRow, WidgetSpec } from './types';

/*
  STAND-IN for r2/fe-charts' `<juyo-widget-chart>` (same selector and inputs: spec, rows, columns).
  When that branch lands, import its component in board.ts instead of this one and delete this file.
  It draws the common kinds with the app's ECharts host and falls back to a table for the rest, so saved
  boards are readable meanwhile.
*/

const fmtFor = (c: EvidenceColumn | undefined, format?: WidgetSpec['format']) => {
  const kind = c?.kind === 'currency' || format === 'currency' ? 'currency' : c?.kind === 'percent' || format === 'percent' ? 'percent' : 'number';
  return (v: unknown) => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v !== 'number') return String(v);
    if (kind === 'percent') return `${v.toFixed(Math.abs(v) < 10 ? 1 : 0)}%`;
    if (kind === 'currency') {
      const a = Math.abs(v);
      const s = a >= 1e6 ? `€${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `€${Math.round(a / 1e3)}k` : `€${Math.round(a).toLocaleString('en-GB')}`;
      return v < 0 ? `−${s}` : s;
    }
    return Math.abs(v) >= 1e4 ? `${(v / 1e3).toFixed(1)}k` : v.toLocaleString('en-GB', { maximumFractionDigits: 1 });
  };
};

@Component({
  selector: 'juyo-widget-chart',
  imports: [EChart],
  host: { class: 'block min-w-0' },
  template: `
    @if (mode() === 'kpi') {
      <ul class="grid gap-3" [style.grid-template-columns]="'repeat(' + kpis().length + ', minmax(0, 1fr))'">
        @for (k of kpis(); track k.label) {
          <li>
            <p class="text-muted-foreground text-[12px]">{{ k.label }}</p>
            <p class="text-[24px]/tight font-semibold tracking-[-0.02em] tabular-nums">{{ k.value }}</p>
          </li>
        }
      </ul>
    } @else if (mode() === 'chart') {
      <app-echart [option]="option()" [label]="spec().title" [style.height.px]="height()" />
    } @else {
      <div class="max-h-[360px] overflow-auto" tabindex="0" [attr.aria-label]="spec().title + ' (table)'">
        <table class="w-full text-[13px] tabular-nums">
          <thead class="text-muted-foreground sticky top-0 bg-(--card) text-[12px]">
            <tr>
              @for (c of visible(); track c.key) {
                <th scope="col" class="border-border border-b py-2 pr-3 text-left font-medium whitespace-nowrap">{{ c.label }}{{ c.unit && c.kind !== 'currency' && c.kind !== 'percent' ? ' (' + c.unit + ')' : '' }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track $index) {
              <tr class="border-border border-b last:border-b-0">
                @for (c of visible(); track c.key; let first = $first) {
                  @if (first) {
                    <th scope="row" class="py-2 pr-3 text-left font-normal whitespace-nowrap">{{ cell(c, r[c.key]) }}</th>
                  } @else {
                    <td class="py-2 pr-3 whitespace-nowrap" [class.text-right]="c.kind !== 'text' && c.kind !== 'hotel' && c.kind !== 'date'">{{ cell(c, r[c.key]) }}</td>
                  }
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class WidgetChart {
  readonly spec = input.required<WidgetSpec>();
  readonly rows = input.required<WidgetRow[]>();
  readonly columns = input<EvidenceColumn[]>([]);
  private readonly width = signal(600);
  protected readonly visible = computed<EvidenceColumn[]>(() => (this.columns().length ? this.columns() : Object.keys(this.rows()[0] ?? {}).map((key): EvidenceColumn => ({ key, label: key, kind: 'text' }))).filter((c) => !c.hidden));
  protected readonly mode = computed<'kpi' | 'chart' | 'table'>(() => {
    const k = this.spec().kind;
    if (k === 'kpi' || k === 'kpi_row') return 'kpi';
    return ['line', 'area', 'bar', 'stacked_bar', 'grouped_bar', 'bullet', 'pie', 'donut', 'scatter', 'funnel', 'waterfall'].includes(k) && this.rows().length ? 'chart' : 'table';
  });
  protected readonly height = computed(() => {
    const k = this.spec().kind;
    const n = this.rows().length;
    return ['bar', 'stacked_bar', 'grouped_bar', 'bullet', 'funnel'].includes(k) && this.horizontal() ? Math.max(140, n * 30 + 40) : k === 'pie' || k === 'donut' ? 260 : 240;
  });
  private readonly horizontal = computed(() => {
    const x = this.spec().x;
    const c = this.columns().find((cc) => cc.key === x);
    return !c || c.kind === 'text' || c.kind === 'hotel';
  });
  protected readonly kpis = computed(() => {
    const s = this.spec();
    const row = this.rows()[0] ?? {};
    const keys = s.y?.length ? s.y : Object.keys(row);
    return keys.map((k) => {
      const c = this.columns().find((cc) => cc.key === k);
      return { label: c?.label ?? k, value: fmtFor(c, s.format)(row[k]) };
    });
  });
  protected readonly option = computed(() => build(this.spec(), this.rows(), this.columns(), palette(), this.width(), this.horizontal()));

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const ro = new ResizeObserver(([e]) => this.width.set(Math.round(e.contentRect.width / 40) * 40));
      ro.observe(host);
      destroy.onDestroy(() => ro.disconnect());
    });
  }

  protected cell(c: EvidenceColumn, v: unknown) {
    return fmtFor(c)(v);
  }
}

function build(s: WidgetSpec, rows: WidgetRow[], cols: EvidenceColumn[], p: Palette, width: number, horizontal: boolean): EChartsCoreOption {
  const colOf = (k?: string) => cols.find((c) => c.key === k);
  const x = s.x ?? cols[0]?.key ?? Object.keys(rows[0] ?? {})[0];
  const ys = s.y?.length ? s.y : cols.filter((c) => c.key !== x && !c.hidden && c.kind !== 'text' && c.kind !== 'hotel').slice(0, 1).map((c) => c.key);
  const f = fmtFor(colOf(ys[0]), s.format);
  const cats = rows.map((r) => String(r[x] ?? ''));
  const axis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: p.muted, fontSize: 12 }, splitLine: { lineStyle: { color: p.grid } } };
  const tooltip = { trigger: 'axis', confine: true, backgroundColor: p.popover, borderColor: p.border, textStyle: { color: p.fg, fontSize: 12 }, valueFormatter: (v: number) => f(v) };
  const series = ys.map((k, i) => ({ name: colOf(k)?.label ?? k, key: k, color: i === 0 ? p.series : i === 1 ? p.grey : p.seriesSoft }));
  const base = { aria: { enabled: true, label: { description: s.title } }, animationDuration: 300, textStyle: { fontFamily: 'Inter' } };
  const nums = (k: string) => rows.map((r) => (typeof r[k] === 'number' ? (r[k] as number) : null));

  if (s.kind === 'pie' || s.kind === 'donut') {
    const label = s.group ?? x;
    const greys = [p.series, '#8b949e', '#6e7681', '#a3abb4', '#565e66', '#c0c6cc', '#3d444b'];
    return {
      ...base,
      tooltip: { trigger: 'item', confine: true, backgroundColor: p.popover, borderColor: p.border, textStyle: { color: p.fg, fontSize: 12 }, valueFormatter: (v: number) => f(v) },
      series: [
        {
          type: 'pie',
          radius: s.kind === 'donut' ? ['52%', '72%'] : ['0%', '72%'],
          startAngle: 90,
          data: rows.map((r, i) => ({ name: String(r[label]), value: r[ys[0]], itemStyle: { color: greys[i % greys.length], borderColor: p.card, borderWidth: 2 } })),
          label: { color: p.text, fontSize: 12, formatter: '{b}\n{d}%' },
          labelLine: { lineStyle: { color: p.border } },
        },
      ],
    };
  }
  if (s.kind === 'scatter') {
    const yk = ys[0];
    return {
      ...base,
      grid: { left: 8, right: 16, top: 16, bottom: 24, containLabel: true },
      tooltip: { trigger: 'item', confine: true, backgroundColor: p.popover, borderColor: p.border, textStyle: { color: p.fg, fontSize: 12 } },
      xAxis: { type: 'value', scale: true, name: colOf(x)?.label, nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: p.muted }, ...axis },
      yAxis: { type: 'value', scale: true, name: colOf(yk)?.label, nameTextStyle: { color: p.muted }, ...axis },
      series: [{ type: 'scatter', symbolSize: 9, itemStyle: { color: p.series }, data: rows.map((r) => [r[x], r[yk], s.group ? r[s.group] : '']), label: { show: !!s.group, position: 'right', color: p.text, fontSize: 11, formatter: (d: { data: unknown[] }) => String(d.data[2] ?? '') }, labelLayout: { hideOverlap: true } }],
    };
  }
  const isBar = s.kind !== 'line' && s.kind !== 'area';
  const stack = s.kind === 'stacked_bar' ? 's' : undefined;
  let data = series.map((ser) => ({
    name: ser.name,
    type: isBar ? 'bar' : 'line',
    stack,
    barMaxWidth: horizontal ? 12 : 18,
    symbol: 'none',
    smooth: false,
    areaStyle: s.kind === 'area' && ser.key === ys[0] ? { opacity: 0.12 } : undefined,
    lineStyle: { width: ser.key === ys[0] ? 2 : 1.5 },
    itemStyle: { color: ser.color },
    data: nums(ser.key),
  })) as Record<string, unknown>[];
  if (s.kind === 'waterfall') {
    // Floating steps between the totals; rows flagged total: true stand on zero.
    const vals = nums(ys[0]).map((v) => v ?? 0);
    let run = 0;
    const lift: number[] = [];
    const up: (number | string)[] = [];
    const down: (number | string)[] = [];
    rows.forEach((r, i) => {
      const v = vals[i];
      if (r['total'] === true || i === 0) {
        lift.push(0);
        up.push(v);
        down.push('-');
        run = v;
      } else {
        lift.push(v >= 0 ? run : run + v);
        up.push(v >= 0 ? v : '-');
        down.push(v < 0 ? -v : '-');
        run += v;
      }
    });
    data = [
      { type: 'bar', stack: 'w', data: lift, itemStyle: { color: 'transparent' }, tooltip: { show: false }, emphasis: { disabled: true } },
      { type: 'bar', stack: 'w', name: 'Raised', data: up, barMaxWidth: 30, itemStyle: { color: p.series } },
      { type: 'bar', stack: 'w', name: 'Lowered', data: down, barMaxWidth: 30, itemStyle: { color: p.neg } },
    ];
  }
  if (s.compare && rows.some((r) => typeof r[s.compare!] === 'number')) {
    const cmp = { name: colOf(s.compare)?.label ?? s.compare, color: p.cmp };
    data.push(
      isBar && s.kind !== 'waterfall'
        ? { name: cmp.name, type: 'scatter', symbol: 'rect', symbolSize: horizontal ? [2.5, 18] : [18, 2.5], itemStyle: { color: cmp.color }, data: horizontal ? nums(s.compare).map((v, i) => [v, i]) : nums(s.compare), z: 4 }
        : { name: cmp.name, type: 'line', symbol: 'none', lineStyle: { type: 'dashed', width: 1.5, color: cmp.color }, itemStyle: { color: cmp.color }, data: nums(s.compare) },
    );
  }
  const catAxis = { type: 'category', data: cats, ...axis, axisLabel: { ...axis.axisLabel, color: horizontal ? p.text : p.muted, width: horizontal ? Math.round(width * 0.3) : undefined, overflow: 'truncate', interval: horizontal ? 0 : Math.max(0, Math.ceil(cats.length / (width < 560 ? 4 : 8)) - 1) }, splitLine: { show: false }, inverse: horizontal };
  const valAxis = { type: 'value', ...axis, axisLabel: { ...axis.axisLabel, formatter: (v: number) => f(v) }, splitNumber: 3 };
  return {
    ...base,
    grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
    tooltip: { ...tooltip, axisPointer: { type: isBar ? 'shadow' : 'line', shadowStyle: { color: 'rgba(127,127,127,0.08)' } } },
    xAxis: horizontal && isBar ? valAxis : { ...catAxis, boundaryGap: isBar },
    yAxis: horizontal && isBar ? catAxis : valAxis,
    series: data,
  };
}
