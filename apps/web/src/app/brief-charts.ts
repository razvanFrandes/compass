import { Component, computed, input } from '@angular/core';
import { Night, formatDay, formatEur } from './data';

/*
  One chart per insight card (insight_feed.md §5.5): no legend, direct labels (max three), no gridlines,
  this year solid blue, comparison dashed purple, the one region the sentence talks about shaded.
  The card title is the chart's text alternative, so the SVGs are aria-hidden.
*/

/** Booking pace for a night: rooms on the books by days before arrival, this year to today vs last year. */
@Component({
  selector: 'app-pace-chart',
  host: { class: 'relative block', 'aria-hidden': 'true' },
  template: `
    <svg class="block w-full overflow-visible" [style.height.px]="height()" viewBox="0 0 300 100" preserveAspectRatio="none">
      <path [attr.d]="g().lyPath" fill="none" class="stroke-(--series-muted)" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />
      <path [attr.d]="g().tyArea" class="fill-(--series)/12" />
      <path [attr.d]="g().tyPath" fill="none" class="stroke-(--series)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      <line [attr.x1]="g().todayX" [attr.x2]="g().todayX" y1="0" y2="100" class="stroke-(--text-1)/25" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke" />
      <line [attr.x1]="g().todayX" [attr.x2]="g().todayX" [attr.y1]="g().tyY" [attr.y2]="g().lyY" [attr.class]="g().tyAbove ? 'stroke-(--series)' : 'stroke-(--negative)'" stroke-width="2" vector-effect="non-scaling-stroke" />
    </svg>
    <span class="absolute -translate-x-full pr-2 text-[12px] font-semibold text-(--series) tabular-nums" [class]="g().tyAbove ? '-translate-y-[130%]' : 'translate-y-[30%]'" [style.left.%]="g().todayX / 3" [style.top.%]="g().tyY">{{ tyLabel() }}</span>
    <span class="text-muted-foreground absolute -translate-x-full pr-2 text-[12px] tabular-nums" [class]="g().tyAbove ? 'translate-y-[30%]' : '-translate-y-[130%]'" [style.left.%]="g().todayX / 3" [style.top.%]="g().lyY">LY {{ lyLabel() }}</span>
    <span class="absolute -translate-y-1/2 rounded-[4px] px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums" [class]="g().tyAbove ? 'bg-[color-mix(in_srgb,var(--series)_16%,var(--card))] text-(--series)' : 'bg-[color-mix(in_srgb,var(--negative)_16%,var(--card))] text-(--negative)'" [style.left]="'calc(' + g().todayX / 3 + '% + 6px)'" [style.top.%]="(g().tyY + g().lyY) / 2">{{ gapLabel() }}</span>
    <div class="text-muted-foreground relative mt-1 flex h-4 justify-between text-[11.5px]">
      <span>{{ from() }} days out</span>
      <span class="absolute -translate-x-1/2" [style.left.%]="g().todayX / 3">today</span>
      <span>arrival</span>
    </div>
  `,
})
export class PaceChart {
  readonly ty = input.required<(number | null)[]>();
  readonly ly = input.required<number[]>();
  readonly from = input(90);
  readonly height = input(120);
  readonly tyLabel = input('');
  readonly lyLabel = input('');
  readonly gapLabel = input('');

  protected readonly g = computed(() => {
    const ly = this.ly();
    const ty = this.ty();
    const n = ly.length - 1;
    const max = Math.max(...ly, ...ty.filter((v): v is number => v !== null)) * 1.08;
    const x = (i: number) => (i / n) * 300;
    const y = (v: number) => 100 - (v / max) * 100;
    const lyPath = ly.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const pts = ty.map((v, i) => (v === null ? null : { x: x(i), y: y(v) })).filter((p): p is { x: number; y: number } => !!p);
    const tyPath = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
    const last = pts[pts.length - 1];
    const todayIdx = pts.length - 1;
    return {
      lyPath,
      tyPath,
      tyArea: `${tyPath}L${last.x.toFixed(1)},100L0,100Z`,
      todayX: last.x,
      tyY: last.y,
      lyY: y(ly[todayIdx]),
      tyAbove: last.y < y(ly[todayIdx]),
    };
  });
}

/** Daily pickup by stay date with the event nights shaded and labelled. */
@Component({
  selector: 'app-pickup-bars',
  host: { class: 'relative block', 'aria-hidden': 'true' },
  template: `
    <div class="relative" [style.height.px]="height()">
      @if (band(); as b) {
        <div class="absolute inset-y-0 rounded-[6px] bg-(--foreground)/5 ring-1 ring-(--foreground)/10 ring-inset" [style.left.%]="b.left" [style.width.%]="b.width">
          <span class="text-muted-foreground absolute -top-0.5 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap text-[11.5px] font-medium">{{ bandLabel() }}</span>
        </div>
      }
      <div class="absolute inset-x-0 bottom-0 flex h-[86%] items-end gap-[3px] px-[2px]">
        @for (v of bars(); track $index) {
          <span class="flex-1 rounded-t-[3px]" [class]="!highlight().length || highlight().includes($index) ? 'bg-(--series)' : 'bg-(--series)/35'" [style.height.%]="(v / max()) * 100"></span>
        }
      </div>
    </div>
    <div class="text-muted-foreground mt-1.5 flex justify-between text-[11.5px]"><span>{{ startLabel() }}</span><span>{{ caption() }}</span><span>{{ endLabel() }}</span></div>
  `,
})
export class PickupBars {
  readonly bars = input.required<number[]>();
  readonly highlight = input<number[]>([]);
  readonly bandLabel = input('');
  readonly startLabel = input('');
  readonly endLabel = input('');
  readonly caption = input('');
  readonly height = input(104);
  protected readonly max = computed(() => Math.max(...this.bars()) * 1.05);
  protected readonly band = computed(() => {
    const h = this.highlight();
    if (!h.length) return null;
    const n = this.bars().length;
    return { left: (Math.min(...h) / n) * 100, width: ((Math.max(...h) - Math.min(...h) + 1) / n) * 100 };
  });
}

/** One 100% bar: the channel the sentence is about in blue, the rest muted, last year's share as a tick. */
@Component({
  selector: 'app-share-bar',
  host: { class: 'block', 'aria-hidden': 'true' },
  template: `
    <div class="mb-2 flex items-baseline justify-between gap-3">
      <span class="flex items-baseline gap-1.5 text-[13px]"><span class="font-semibold text-(--series)">{{ segments()[0].label }} {{ segments()[0].value }}%</span><span class="text-muted-foreground">of pickup</span></span>
      <span class="text-muted-foreground text-[12px] tabular-nums">LY {{ ly() }}%</span>
    </div>
    <div class="relative">
      <div class="flex h-7 overflow-hidden rounded-[6px]">
        @for (s of segments(); track s.label; let i = $index) {
          <span class="h-full border-r-2 border-(--card) last:border-r-0" [class]="i === 0 ? 'bg-(--series)' : shades[i % shades.length]" [style.width.%]="s.value"></span>
        }
      </div>
      <span class="absolute -top-1 -bottom-1 w-[2px] rounded bg-(--series-muted) shadow-[0_0_0_1px_var(--card)]" [style.left.%]="ly()"></span>
    </div>
    <div class="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] tabular-nums">
      @for (s of segments().slice(1); track s.label) {
        <span>{{ s.label }} {{ s.value }}%</span>
      }
    </div>
  `,
})
export class ShareBar {
  readonly segments = input.required<{ label: string; value: number }[]>();
  readonly ly = input(0);
  // Neutral steps derived from the text colour, so they read as greys in both themes.
  protected readonly shades = ['bg-(--foreground)/12', 'bg-(--foreground)/20', 'bg-(--foreground)/28', 'bg-(--foreground)/36', 'bg-(--foreground)/44'];
}

/**
 * Your rate against the market, night by night: BAR solid blue, comp-set median dashed grey, the event nights shaded.
 * Sold-out comp sets have no median, so that night leaves a gap rather than an invented value.
 */
@Component({
  selector: 'app-rate-chart',
  host: { class: 'relative block', 'aria-hidden': 'true' },
  template: `
    <div class="relative" [style.height.px]="height()">
      @if (g().band; as b) {
        <div class="absolute inset-y-0 rounded-[6px] bg-(--foreground)/5" [style.left.%]="b.left" [style.width.%]="b.width">
          <span class="text-muted-foreground absolute -top-0.5 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap text-[11.5px] font-medium">{{ bandLabel() }}</span>
        </div>
      }
      <svg class="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
        <path [attr.d]="g().comp" fill="none" class="stroke-(--series-muted)" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />
        <path [attr.d]="g().bar" fill="none" class="stroke-(--series)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      </svg>
      @if (g().peak; as k) {
        <span class="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--series) shadow-[0_0_0_2px_var(--card)]" [style.left.%]="k.x" [style.top.%]="k.bar"></span>
        <span class="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-(--series-muted) bg-(--card)" [style.left.%]="k.x" [style.top.%]="k.comp"></span>
        <span class="text-muted-foreground absolute translate-x-2 -translate-y-1/2 text-[12px] whitespace-nowrap tabular-nums" [style.left.%]="k.x" [style.top.%]="k.comp">Market {{ k.compLabel }}</span>
        <span class="absolute translate-x-2 -translate-y-1/2 text-[12px] font-semibold whitespace-nowrap text-(--series) tabular-nums" [style.left.%]="k.x" [style.top.%]="k.bar">You {{ k.barLabel }}</span>
      }
    </div>
    <div class="text-muted-foreground mt-1.5 flex justify-between text-[11.5px]"><span>{{ first() }}</span><span>BAR vs comp-set median</span><span>{{ last() }}</span></div>
  `,
})
export class RateChart {
  readonly nights = input.required<Night[]>();
  readonly highlight = input<number[]>([]); // dates (UTC ms) to shade
  readonly peak = input<number | null>(null); // date to label
  readonly bandLabel = input('');
  readonly height = input(112);
  protected readonly first = computed(() => (this.nights().length ? formatDay(this.nights()[0].date) : ''));
  protected readonly last = computed(() => (this.nights().length ? formatDay(this.nights()[this.nights().length - 1].date) : ''));
  protected readonly g = computed(() => {
    const ns = this.nights();
    const vals = ns.flatMap((n) => [n.bar, n.compMedian ?? n.bar]);
    const lo = Math.min(...vals) * 0.9;
    const hi = Math.max(...vals) * 1.06;
    const x = (i: number) => ((i + 0.5) / ns.length) * 300;
    const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
    const path = (pick: (n: Night) => number | null) => {
      let d = '';
      let pen = false;
      ns.forEach((n, i) => {
        const v = pick(n);
        if (v === null) {
          pen = false;
          return;
        }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      return d;
    };
    const hl = this.highlight();
    const idx = ns.map((n, i) => (hl.includes(n.date) ? i : -1)).filter((i) => i >= 0);
    const band = idx.length ? { left: (Math.min(...idx) / ns.length) * 100, width: ((Math.max(...idx) - Math.min(...idx) + 1) / ns.length) * 100 } : null;
    const pi = ns.findIndex((n) => n.date === this.peak());
    const pn = pi >= 0 ? ns[pi] : null;
    const peak = pn && pn.compMedian !== null ? { x: x(pi) / 3, bar: y(pn.bar), comp: y(pn.compMedian), barLabel: formatEur(pn.bar), compLabel: formatEur(pn.compMedian) } : null;
    return { bar: path((n) => n.bar), comp: path((n) => n.compMedian), band, peak };
  });
}

/** A sparkline for compact tiles: one line, optionally a dashed comparison. */
@Component({
  selector: 'app-spark',
  host: { class: 'block', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" class="h-full w-full overflow-visible">
      @if (g().cmp) {
        <path [attr.d]="g().cmp" fill="none" class="stroke-(--series-muted)" stroke-width="1.25" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
      }
      <path [attr.d]="g().main" fill="none" class="stroke-(--series)" stroke-width="1.75" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    </svg>
  `,
})
export class Spark {
  readonly values = input.required<number[]>();
  readonly compare = input<number[] | null>(null);
  protected readonly g = computed(() => {
    const a = this.values();
    const b = this.compare() ?? [];
    const all = [...a, ...b];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const line = (v: number[]) => v.map((n, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, v.length - 1)) * 100).toFixed(1)},${(30 - ((n - lo) / (hi - lo || 1)) * 28).toFixed(1)}`).join('');
    return { main: line(a), cmp: b.length ? line(b) : '' };
  });
}
