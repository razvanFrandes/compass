import { Component, computed, input } from '@angular/core';
import type { EvidenceColumn, WidgetSpec } from '../api';

const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

/**
 * PLACEHOLDER (r2/fe-kassandra): the selector and inputs of the chart catalogue's widget renderer, which another
 * branch builds at this path. Until it lands, every widget is drawn as its rows: one large figure for a KPI, a small
 * table for anything else. Numbers come from the tool rows only. Fixed height, so the real chart drops in without
 * moving the page.
 */
@Component({
  selector: 'juyo-widget-chart',
  host: { class: 'block h-[240px] overflow-auto' },
  template: `
    @if (spec().kind === 'kpi' && kpi(); as k) {
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
          @for (r of rows().slice(0, 50); track $index) {
            <tr class="border-border border-b last:border-b-0">
              @for (c of shown(); track c.key) {
                <td class="py-1.5 pr-3 whitespace-nowrap">{{ cell(r[c.key], c) }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class WidgetChart {
  readonly spec = input.required<WidgetSpec>();
  readonly rows = input.required<Record<string, unknown>[]>();
  readonly columns = input<EvidenceColumn[]>([]);

  /** The columns the spec plots, else every visible one. */
  protected readonly shown = computed<EvidenceColumn[]>(() => {
    const spec = this.spec();
    const known = new Map(this.columns().map((c) => [c.key, c]));
    const named = [spec.x, spec.group, ...(spec.y ?? []), spec.compare].filter((key): key is string => !!key);
    const keys = named.length ? [...new Set(named)] : this.columns().length ? this.columns().filter((c) => !c.hidden).map((c) => c.key) : Object.keys(this.rows()[0] ?? {});
    return keys.slice(0, 6).map((key) => known.get(key) ?? { key, label: key.replace(/_/g, ' '), kind: 'text' });
  });
  protected readonly kpi = computed(() => {
    const column = this.shown().find((c) => typeof this.rows()[0]?.[c.key] === 'number');
    return column ? { value: this.cell(this.rows()[0]![column.key], column), label: column.label } : null;
  });

  protected cell(value: unknown, column: EvidenceColumn): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value !== 'number') return String(value);
    if (column.kind === 'percent') return `${number.format(value)}%`;
    return `${number.format(value)}${column.unit ? ` ${column.unit}` : ''}`;
  }
}
