import { Component, computed, input } from '@angular/core';
import type { EvidenceColumn, WidgetSpec } from '../api';

const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

type Shape = 'figure' | 'bars' | 'line' | 'round' | 'list';
const SHAPE: Partial<Record<WidgetSpec['kind'], Shape>> = {
  kpi: 'figure',
  kpi_row: 'figure',
  line: 'line',
  area: 'line',
  scatter: 'line',
  bar: 'bars',
  stacked_bar: 'bars',
  grouped_bar: 'bars',
  waterfall: 'bars',
  funnel: 'bars',
  pie: 'round',
  donut: 'round',
  gauge: 'round',
  radar: 'round',
};

/**
 * PLACEHOLDER (r2/fe-kassandra): the selector and inputs of the chart catalogue's widget renderer, which another
 * branch builds at this path (`spec`, `rows`, `columns`, `compact`, `header`, `loading`). Until it lands, a widget
 * is drawn as its rows: one large figure for a KPI, a small table for anything else. Numbers come from the tool
 * rows only.
 *
 * Like the real one, it shows a skeleton while `rows` is null or `loading` is set, shaped by the widget kind and
 * with the same box as the finished widget (a fixed 240 px body here), so nothing moves when the data arrives.
 */
@Component({
  selector: 'juyo-widget-chart',
  host: { class: 'block', '[attr.data-kind]': 'spec().kind' },
  template: `
    @if (header() && spec().title) {
      <p class="text-[14.5px]/snug font-semibold">{{ spec().title }}</p>
      @if (spec().subtitle) {
        <p class="text-muted-foreground mt-0.5 mb-3 text-[12.5px]">{{ spec().subtitle }}</p>
      }
    }
    <div class="h-[240px] overflow-auto" [attr.aria-busy]="pending() ? 'true' : null">
      @if (pending()) {
        <div class="flex h-full" role="status" [attr.data-shape]="shape()">
          <span class="sr-only">Loading {{ spec().title || 'the chart' }}</span>
          @switch (shape()) {
            @case ('figure') {
              <div class="flex w-full flex-col justify-center gap-3">
                <i class="k-skel block h-3 w-[30%]"></i>
                <i class="k-skel block h-9 w-[46%]"></i>
                <i class="k-skel block h-3 w-[36%]"></i>
              </div>
            }
            @case ('bars') {
              <div class="flex w-full items-end gap-[4%] pt-2">
                @for (h of [46, 72, 58, 88, 64, 40, 76, 52]; track $index) {
                  <i class="k-skel block flex-1 rounded-b-none" [style.height.%]="h"></i>
                }
              </div>
            }
            @case ('line') {
              <svg class="size-full" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                <path class="k-skel-stroke" d="M0,30 L14,24 L28,27 L42,16 L56,19 L70,9 L84,13 L100,5" fill="none" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
              </svg>
            }
            @case ('round') {
              <div class="grid w-full place-items-center"><i class="k-skel block size-[168px] !rounded-full"></i></div>
            }
            @default {
              <div class="flex w-full flex-col justify-center gap-4">
                @for (w of [92, 78, 86, 64, 72, 58]; track $index) {
                  <i class="k-skel block h-3.5" [style.width.%]="w"></i>
                }
              </div>
            }
          }
        </div>
      } @else if (spec().kind === 'kpi' && kpi(); as k) {
        <div class="flex h-full flex-col justify-center">
          <p class="text-[40px]/none font-semibold tracking-[-0.02em] tabular-nums">{{ k.value }}</p>
          <p class="text-muted-foreground mt-2 text-[13px]">{{ k.label }}</p>
        </div>
      } @else {
        <table class="w-full text-[12.5px] tabular-nums">
          <caption class="sr-only">{{ spec().title }}</caption>
          <thead class="text-muted-foreground sticky top-0 bg-(--card)">
            <tr>
              @for (c of shown(); track c.key) {
                <th scope="col" class="border-border border-b py-1.5 pr-3 text-left font-medium whitespace-nowrap">{{ c.label }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (r of data().slice(0, 50); track $index) {
              <tr class="border-border border-b last:border-b-0">
                @for (c of shown(); track c.key) {
                  <td class="py-1.5 pr-3 whitespace-nowrap">{{ cell(r[c.key], c) }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class WidgetChart {
  readonly spec = input.required<WidgetSpec>();
  /** The rows of the tool result the spec points at. Null or undefined while they load: the skeleton shows. */
  readonly rows = input<readonly object[] | null | undefined>(null);
  readonly columns = input<readonly EvidenceColumn[] | null | undefined>(null);
  /** Denser, for chat answers and board tiles. The placeholder has one density. */
  readonly compact = input(false);
  /** Shows the spec's title and subtitle above the widget (off when the host card already shows them). */
  readonly header = input(true);
  /** Forces the skeleton even when rows are present. */
  readonly loading = input(false);

  protected readonly pending = computed(() => !this.rows() || this.loading());
  protected readonly shape = computed<Shape>(() => SHAPE[this.spec().kind] ?? 'list');
  protected readonly data = computed(() => (this.rows() ?? []) as readonly Record<string, unknown>[]);

  /** The columns the spec plots, else every visible one. */
  protected readonly shown = computed<EvidenceColumn[]>(() => {
    const spec = this.spec();
    const columns = this.columns() ?? [];
    const known = new Map(columns.map((c) => [c.key, c]));
    const named = [spec.x, spec.group, ...(spec.y ?? []), spec.compare].filter((key): key is string => !!key);
    const keys = named.length ? [...new Set(named)] : columns.length ? columns.filter((c) => !c.hidden).map((c) => c.key) : Object.keys(this.data()[0] ?? {});
    return keys.slice(0, 6).map((key) => known.get(key) ?? { key, label: key.replace(/_/g, ' '), kind: 'text' });
  });
  protected readonly kpi = computed(() => {
    const first = this.data()[0];
    const column = this.shown().find((c) => typeof first?.[c.key] === 'number');
    return column ? { value: this.cell(first![column.key], column), label: column.label } : null;
  });

  protected cell(value: unknown, column: EvidenceColumn): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value !== 'number') return String(value);
    if (column.kind === 'percent') return `${number.format(value)}%`;
    return `${number.format(value)}${column.unit ? ` ${column.unit}` : ''}`;
  }
}
