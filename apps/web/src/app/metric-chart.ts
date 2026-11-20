import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { formatDay, formatWeekday } from './data';

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(+v.toFixed(6));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Line + area chart drawn to scale in real pixels, with an optional same-time-last-year series. */
@Component({
  selector: 'app-metric-chart',
  host: { class: 'relative block select-none' },
  template: `
    <svg
      [attr.width]="width()"
      [attr.height]="height()"
      class="block overflow-visible"
      role="img"
      [attr.aria-label]="ariaLabel()"
      (pointermove)="onMove($event)"
      (pointerleave)="hover.set(null)"
    >
      <defs>
        <linearGradient [attr.id]="gradId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--series)" stop-opacity="0.14" />
          <stop offset="100%" stop-color="var(--series)" stop-opacity="0" />
        </linearGradient>
      </defs>
      @for (t of geom().ticks; track t.v) {
        <line [attr.x1]="pad.l" [attr.x2]="width() - pad.r" [attr.y1]="t.y" [attr.y2]="t.y" class="stroke-(--grid)" stroke-width="1" />
        <text [attr.x]="pad.l - 10" [attr.y]="t.y" text-anchor="end" dominant-baseline="middle" class="fill-muted-foreground text-[11.5px] tabular-nums">{{ (tickFormat() ?? format())(t.v) }}</text>
      }
      @for (x of geom().xLabels; track x.i) {
        <text [attr.x]="x.x" [attr.y]="height() - 4" text-anchor="middle" class="fill-muted-foreground text-[11.5px] tabular-nums">{{ x.label }}</text>
      }
      @for (m of geom().marks; track m.i) {
        <rect [attr.x]="m.x - geom().step / 2" [attr.y]="pad.t" [attr.width]="geom().step" [attr.height]="geom().plotH" class="fill-(--brass-wash)" />
      }
      @if (geom().compare) {
        <path [attr.d]="geom().compare" fill="none" class="stroke-(--series-muted)" stroke-width="1.5" stroke-dasharray="3 4" stroke-linecap="round" />
      }
      @if (kind() === 'bar') {
        @for (p of geom().pts; track $index) {
          <rect
            [attr.x]="p.x - geom().barW / 2"
            [attr.y]="p.y"
            [attr.width]="geom().barW"
            [attr.height]="geom().base - p.y"
            rx="1.5"
            class="chart-fade"
            [class]="hover() === $index ? 'fill-(--series)' : 'fill-(--series)/75'"
          />
        }
      } @else {
        <path [attr.d]="geom().area" [attr.fill]="'url(#' + gradId + ')'" class="chart-fade" />
        <path [attr.d]="geom().line" fill="none" class="stroke-(--series) chart-draw" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" pathLength="1" />
      }
      @if (hover(); as h) {
        <line [attr.x1]="geom().pts[h].x" [attr.x2]="geom().pts[h].x" [attr.y1]="pad.t" [attr.y2]="pad.t + geom().plotH" class="stroke-foreground/25" stroke-width="1" />
        @if (geom().cpts[h]; as c) {
          <circle [attr.cx]="c.x" [attr.cy]="c.y" r="3" class="fill-background stroke-(--series-muted)" stroke-width="1.5" />
        }
        @if (kind() === 'line') {
          <circle [attr.cx]="geom().pts[h].x" [attr.cy]="geom().pts[h].y" r="3.5" class="fill-(--series) stroke-background" stroke-width="2" />
        }
      }
    </svg>
    @if (hover(); as h) {
      <div
        class="bg-popover text-popover-foreground ring-foreground/8 pointer-events-none absolute top-1 z-10 min-w-36 rounded-lg px-3 py-2 text-xs shadow-[0_8px_24px_-8px_oklch(0_0_0/0.25)] ring-1"
        [style.left.px]="tooltipLeft()"
      >
        <div class="text-muted-foreground mb-1.5 font-medium">{{ weekday(dates()[h]) }} {{ day(dates()[h]) }}</div>
        <div class="flex items-center justify-between gap-4 tabular-nums">
          <span class="flex items-center gap-1.5"><i class="inline-block h-0.5 w-2.5 rounded bg-(--series)"></i>This year</span>
          <span class="font-medium">{{ format()(values()[h]) }}</span>
        </div>
        @if (compare()[h] !== undefined) {
          <div class="text-muted-foreground mt-1 flex items-center justify-between gap-4 tabular-nums">
            <span class="flex items-center gap-1.5"><i class="inline-block h-0 w-2.5 border-t-[1.5px] border-dashed border-(--series-muted)"></i>Last year</span>
            <span>{{ format()(compare()[h]) }}</span>
          </div>
        }
      </div>
    }
  `,
})
export class MetricChart {
  readonly values = input.required<number[]>();
  readonly compare = input<number[]>([]);
  readonly dates = input.required<number[]>();
  readonly format = input<(n: number) => string>((n) => n.toFixed(0));
  readonly tickFormat = input<((n: number) => string) | undefined>(undefined);
  readonly height = input(260);
  readonly kind = input<'line' | 'bar'>('line');
  readonly marks = input<number[]>([]);
  readonly zeroBased = input(false);
  /** Upper bound for the scale, e.g. 100 for occupancy. */
  readonly capAt = input<number | null>(null);
  readonly ariaLabel = input('Chart');

  protected readonly gradId = `g${Math.random().toString(36).slice(2, 8)}`;
  protected readonly pad = { l: 52, r: 8, t: 10, b: 24 };
  protected readonly width = signal(600);
  protected readonly hover = signal<number | null>(null);

  protected readonly day = formatDay;
  protected readonly weekday = formatWeekday;

  constructor() {
    const el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    afterNextRender(() => {
      const ro = new ResizeObserver(([e]) => this.width.set(Math.max(240, Math.floor(e.contentRect.width))));
      ro.observe(el);
      this.destroy.onDestroy(() => ro.disconnect());
    });
  }
  private readonly destroy = inject(DestroyRef);

  protected readonly geom = computed(() => {
    const v = this.values();
    const c = this.compare();
    const w = this.width();
    const h = this.height();
    const { l, r, t, b } = this.pad;
    const plotW = w - l - r;
    const plotH = h - t - b;
    const all = [...v, ...c];
    let min = Math.min(...all);
    let max = Math.max(...all);
    if (this.zeroBased() || this.kind() === 'bar') min = 0;
    else min = min - (max - min) * 0.15;
    max = max + (max - min) * 0.08;
    if (this.capAt() !== null) max = Math.min(max, this.capAt()!);
    const ticks = niceTicks(min, max, plotH < 140 ? 2 : 4);
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const step = plotW / Math.max(1, v.length - 1);
    const x = (i: number) => l + i * step;
    const y = (n: number) => t + plotH - ((n - lo) / (hi - lo)) * plotH;
    const pts = v.map((n, i) => ({ x: x(i), y: y(n) }));
    const cpts = c.map((n, i) => ({ x: x(i), y: y(n) }));
    const toPath = (p: { x: number; y: number }[]) => p.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join('');
    const line = toPath(pts);
    const area = `${line}L${x(v.length - 1).toFixed(1)},${t + plotH}L${l},${t + plotH}Z`;
    const every = Math.ceil(v.length / Math.max(2, Math.floor(plotW / 70)));
    const xLabels = this.dates()
      .map((d, i) => ({ i, x: x(i), label: formatDay(d) }))
      .filter((_, i) => i % every === 0);
    return {
      ticks: ticks.map((tv) => ({ v: tv, y: y(tv) })),
      xLabels,
      pts,
      cpts,
      line,
      area,
      compare: c.length ? toPath(cpts) : '',
      step,
      plotH,
      barW: Math.max(2, Math.min(18, step * 0.62)),
      base: t + plotH,
      marks: this.marks().map((i) => ({ i, x: x(i) })),
    };
  });

  protected readonly tooltipLeft = computed(() => {
    const h = this.hover();
    if (h === null) return 0;
    const px = this.geom().pts[h].x;
    return px > this.width() - 170 ? px - 162 : px + 12;
  });

  protected onMove(e: PointerEvent) {
    const svg = e.currentTarget as SVGElement;
    const rect = svg.getBoundingClientRect();
    const i = Math.round((e.clientX - rect.left - this.pad.l) / this.geom().step);
    this.hover.set(Math.min(this.values().length - 1, Math.max(0, i)));
  }
}
