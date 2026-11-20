import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import type { SkeletonPlan } from './builders/skeleton';

/*
  One placeholder per widget kind, drawn in the layout the finished chart will have: bars where bars will be,
  a ring for a donut, rows and columns for a table. Everything is decoration (aria-hidden); the widget around
  it says "Loading …". The shapes stretch with the body, so the box is the finished widget's box.
*/

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Dash pattern for a circle of radius `r` split into shares (percent) with a small gap between parts. */
function arcs(r: number, shares: number[], gap = 1.6): { dash: string; offset: number }[] {
  const c = 2 * Math.PI * r;
  let at = 0;
  return shares.map((share) => {
    const len = (share / 100) * c;
    const arc = { dash: `${Math.max(0, len - gap).toFixed(2)} ${(c - Math.max(0, len - gap)).toFixed(2)}`, offset: -at };
    at += len;
    return arc;
  });
}

function polygon(cx: number, cy: number, r: number, radii: number[]): string {
  return radii
    .map((k, i) => {
      const a = (Math.PI * 2 * i) / radii.length - Math.PI / 2;
      return `${(cx + Math.cos(a) * r * k).toFixed(1)},${(cy + Math.sin(a) * r * k).toFixed(1)}`;
    })
    .join(' ');
}

@Component({
  selector: 'juyo-widget-skeleton',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'wc-sk', 'aria-hidden': 'true', '[attr.data-kind]': 'plan().kind', '[class.wc-sk--h]': 'plan().horizontal' },
  template: `
    @let p = plan();
    @if (p.legend || p.ramp) {
      <div class="wc-sk-legend">
        @for (i of legend(); track i) {
          <span><i class="wc-sk-dot"></i><i class="wc-sk-t" [style.width.px]="44 + ((i * 17) % 30)"></i></span>
        }
        @if (p.ramp) {
          <span><i class="wc-sk-t" style="width: 62px"></i><i class="wc-sk-t" style="width: 78px; height: 8px"></i></span>
        }
      </div>
    }
    <div class="wc-sk-plot">
      @switch (p.kind) {
        @case ('kpi') {
          <div class="wc-sk-kpi">
            <div class="wc-sk-stack">
              <i class="wc-sk-t" style="width: 72px"></i>
              <i class="wc-sk-b" [style.height.px]="compact() ? 30 : 40" style="width: 148px"></i>
              <i class="wc-sk-t" style="width: 116px"></i>
            </div>
            @if (p.spark) {
              <svg class="wc-sk-wave" viewBox="0 0 100 28" preserveAspectRatio="none"><path [attr.d]="wave" /></svg>
            }
          </div>
        }
        @case ('kpi_row') {
          <div class="wc-sk-tiles" [style.--wc-tiles]="p.tileColumns">
            @for (i of tiles(); track i) {
              <div class="wc-sk-tile">
                <i class="wc-sk-t" style="width: 58%"></i>
                <i class="wc-sk-b" [style.height.px]="compact() ? 20 : 24" style="width: 64%; margin-top: 6px"></i>
                <div class="wc-sk-tile-foot">
                  <i class="wc-sk-t" style="width: 40%"></i>
                  @if (p.spark) {
                    <svg class="wc-sk-wave" viewBox="0 0 100 28" preserveAspectRatio="none"><path [attr.d]="wave" /></svg>
                  }
                </div>
              </div>
            }
          </div>
        }
        @case ('line') {
          <ng-container [ngTemplateOutlet]="xy" [ngTemplateOutletContext]="{ marks: 'line' }" />
        }
        @case ('area') {
          <ng-container [ngTemplateOutlet]="xy" [ngTemplateOutletContext]="{ marks: 'area' }" />
        }
        @case ('scatter') {
          <ng-container [ngTemplateOutlet]="xy" [ngTemplateOutletContext]="{ marks: 'scatter' }" />
        }
        @case ('waterfall') {
          <ng-container [ngTemplateOutlet]="xy" [ngTemplateOutletContext]="{ marks: 'waterfall' }" />
        }
        @case ('bar') {
          <ng-container [ngTemplateOutlet]="p.horizontal ? rows : xy" [ngTemplateOutletContext]="{ marks: 'bar' }" />
        }
        @case ('stacked_bar') {
          <ng-container [ngTemplateOutlet]="p.horizontal ? rows : xy" [ngTemplateOutletContext]="{ marks: 'stacked' }" />
        }
        @case ('grouped_bar') {
          <ng-container [ngTemplateOutlet]="p.horizontal ? rows : xy" [ngTemplateOutletContext]="{ marks: 'grouped' }" />
        }
        @case ('bullet') {
          <ng-container [ngTemplateOutlet]="rows" [ngTemplateOutletContext]="{ marks: 'bullet' }" />
        }
        @case ('sparkline_list') {
          <div class="wc-sk-list">
            @for (w of names; track $index) {
              <div class="wc-sk-spark-row">
                <i class="wc-sk-t" [style.width.%]="w"></i>
                <svg class="wc-sk-wave" viewBox="0 0 100 28" preserveAspectRatio="none"><path [attr.d]="$index % 2 ? waveDown : wave" /></svg>
                <i class="wc-sk-t" style="width: 40px; justify-self: end"></i>
                <i class="wc-sk-t" style="width: 48px; justify-self: end"></i>
              </div>
            }
          </div>
        }
        @case ('table') {
          <div class="wc-sk-table">
            @for (r of tableRows(); track r) {
              <div class="wc-sk-tr" [class.wc-sk-th]="r === 0">
                <i class="wc-sk-t" [style.width.%]="r === 0 ? 34 : names[r % names.length] * 0.9"></i>
                @for (c of tableCols(); track c) {
                  <i class="wc-sk-t" [style.width.px]="r === 0 ? 48 : 30 + (((r + c) * 13) % 26)" style="justify-self: end"></i>
                }
              </div>
            }
          </div>
        }
        @case ('heatmap') {
          <div class="wc-sk-heat">
            @for (r of heatRows(); track r) {
              <div class="wc-sk-heat-row">
                <i class="wc-sk-t" [style.width.%]="names[r % names.length]"></i>
                @for (c of seven; track c) {
                  <i class="wc-sk-b" [style.opacity]="0.45 + (((r * 3 + c * 5) % 7) / 7) * 0.55"></i>
                }
              </div>
            }
            <div class="wc-sk-heat-row wc-sk-heat-x">
              <i></i>
              @for (c of seven; track c) {
                <i class="wc-sk-t" style="width: 24px; justify-self: center"></i>
              }
            </div>
          </div>
        }
        @case ('calendar_heatmap') {
          <div class="wc-sk-cal-wrap">
            <div class="wc-sk-cal">
              @for (i of calendarCells(); track i) {
                <i class="wc-sk-b" [style.opacity]="0.45 + (((i * 5) % 9) / 9) * 0.55"></i>
              }
            </div>
          </div>
        }
        @case ('pie') {
          <svg class="wc-sk-round" viewBox="0 0 100 100">
            @for (a of pieArcs; track $index) {
              <circle cx="50" cy="50" r="21" fill="none" stroke-width="42" [attr.stroke-dasharray]="a.dash" [attr.stroke-dashoffset]="a.offset" transform="rotate(-90 50 50)" [style.opacity]="1 - $index * 0.16" />
            }
          </svg>
        }
        @case ('donut') {
          <svg class="wc-sk-round" viewBox="0 0 100 100">
            @for (a of donutArcs; track $index) {
              <circle cx="50" cy="50" r="35" fill="none" stroke-width="13" [attr.stroke-dasharray]="a.dash" [attr.stroke-dashoffset]="a.offset" transform="rotate(-90 50 50)" [style.opacity]="1 - $index * 0.16" />
            }
            <rect x="34" y="42" width="32" height="10" rx="3" class="wc-sk-solid" />
            <rect x="41" y="56" width="18" height="4" rx="2" class="wc-sk-solid" />
          </svg>
        }
        @case ('gauge') {
          <svg class="wc-sk-round" viewBox="0 0 100 74">
            <path d="M 12.9 67.3 A 41 41 0 1 1 87.1 67.3" fill="none" stroke-width="8" stroke-linecap="round" />
            <rect x="32" y="40" width="36" height="12" rx="3" class="wc-sk-solid" />
            <rect x="40" y="57" width="20" height="4" rx="2" class="wc-sk-solid" />
          </svg>
        }
        @case ('radar') {
          <svg class="wc-sk-round" viewBox="0 0 100 100">
            <polygon [attr.points]="hex[0]" fill="none" class="wc-sk-hair" />
            <polygon [attr.points]="hex[1]" fill="none" class="wc-sk-hair" />
            <polygon [attr.points]="hex[2]" fill="none" class="wc-sk-hair" />
            <polygon [attr.points]="hex[3]" class="wc-sk-fill" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
        }
        @case ('funnel') {
          <div class="wc-sk-funnel">
            @for (w of funnel; track $index) {
              <div class="wc-sk-funnel-row">
                <i class="wc-sk-t" [style.width.px]="56 + (($index * 23) % 40)" style="justify-self: end"></i>
                <i class="wc-sk-b wc-sk-funnel-step" [style.width.%]="w" [style.--wc-next]="(funnel[$index + 1] ?? w * 0.7) / w" [style.opacity]="1 - $index * 0.13"></i>
                <i class="wc-sk-t" style="width: 64px"></i>
              </div>
            }
          </div>
        }
        @case ('treemap') {
          <div class="wc-sk-tree">
            @for (i of seven; track i) {
              <i class="wc-sk-b" [style.grid-area]="'t' + i" [style.opacity]="1 - i * 0.09"></i>
            }
          </div>
        }
        @case ('sankey') {
          <svg class="wc-sk-flow" viewBox="0 0 100 60" preserveAspectRatio="none">
            @for (f of flows; track $index) {
              <path [attr.d]="f" class="wc-sk-band" />
            }
            @for (n of flowNodes; track $index) {
              <rect [attr.x]="n[0]" [attr.y]="n[1]" width="1.6" [attr.height]="n[2]" rx="0.4" class="wc-sk-fill" />
            }
          </svg>
        }
        @default {
          <div class="wc-sk-list">
            @for (w of names; track $index) {
              <i class="wc-sk-t" [style.width.%]="w + 30" style="height: 14px"></i>
            }
          </div>
        }
      }
    </div>

    <!-- Upright charts: value ticks on the left, hairlines, category ticks below -->
    <ng-template #xy let-marks="marks">
      <div class="wc-sk-xy">
        <div class="wc-sk-yticks">
          @for (i of four; track i) {
            <i class="wc-sk-t" [style.width.px]="i === 0 ? 26 : 20"></i>
          }
        </div>
        <div class="wc-sk-area">
          @switch (marks) {
            @case ('line') {
              <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                @if (p.compare || p.series > 1) {
                  <path class="wc-sk-stroke wc-sk-stroke--cmp" d="M0,22 L12,18 L24,21 L36,12 L48,15 L60,8 L72,11 L84,5 L100,3" />
                }
                <path class="wc-sk-stroke" d="M0,32 L12,27 L24,30 L36,21 L48,24 L60,15 L72,19 L84,12 L100,9" />
              </svg>
            }
            @case ('area') {
              <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                <path class="wc-sk-wash" d="M0,32 L12,29 L24,27 L36,25 L48,21 L60,19 L72,13 L84,9 L100,5 L100,40 L0,40 Z" />
                <path class="wc-sk-stroke" d="M0,32 L12,29 L24,27 L36,25 L48,21 L60,19 L72,13 L84,9 L100,5" />
              </svg>
            }
            @case ('scatter') {
              <i class="wc-sk-cross wc-sk-cross--v"></i>
              <i class="wc-sk-cross wc-sk-cross--h"></i>
              @for (d of dots; track $index) {
                <i class="wc-sk-point" [style.left.%]="d[0]" [style.bottom.%]="d[1]"></i>
              }
            }
            @case ('waterfall') {
              <div class="wc-sk-cols">
                @for (s of steps; track $index) {
                  <span class="wc-sk-col"><i class="wc-sk-b wc-sk-float" [style.bottom.%]="s[0]" [style.height.%]="s[1]"></i></span>
                }
              </div>
            }
            @case ('stacked') {
              <div class="wc-sk-cols">
                @for (h of columns; track $index) {
                  <span class="wc-sk-col wc-sk-col--stack" [style.height.%]="h">
                    <i class="wc-sk-b" style="flex: 2; opacity: 0.55"></i>
                    <i class="wc-sk-b" style="flex: 5; opacity: 0.8"></i>
                    <i class="wc-sk-b" style="flex: 4"></i>
                  </span>
                }
              </div>
            }
            @case ('grouped') {
              <div class="wc-sk-cols">
                @for (h of columns; track $index) {
                  <span class="wc-sk-col wc-sk-col--pair">
                    <i class="wc-sk-b" [style.height.%]="h"></i>
                    <i class="wc-sk-b" [style.height.%]="h * 0.86 + 6" style="opacity: 0.6"></i>
                  </span>
                }
              </div>
            }
            @default {
              <div class="wc-sk-cols">
                @for (h of columns; track $index) {
                  <span class="wc-sk-col"><i class="wc-sk-b" [style.height.%]="h"></i></span>
                }
              </div>
            }
          }
        </div>
        <div class="wc-sk-xticks">
          @for (i of six; track i) {
            <i class="wc-sk-t" style="width: 30px"></i>
          }
        </div>
      </div>
    </ng-template>

    <!-- Lying bars: a name, the bar, its value -->
    <ng-template #rows let-marks="marks">
      <div class="wc-sk-rows">
        @for (w of bars(); track $index) {
          <div class="wc-sk-row">
            <i class="wc-sk-t" [style.width.%]="names[$index % names.length]" style="justify-self: end"></i>
            @switch (marks) {
              @case ('bullet') {
                <span class="wc-sk-track">
                  <i class="wc-sk-b" [style.width.%]="w"></i>
                  @if (p.compare) {
                    <i class="wc-sk-tick" [style.left.%]="w + ($index % 2 ? -7 : 8)"></i>
                  }
                </span>
              }
              @case ('stacked') {
                <span class="wc-sk-hbar" [style.width.%]="w">
                  <i class="wc-sk-b" style="flex: 4"></i>
                  <i class="wc-sk-b" style="flex: 5; opacity: 0.8"></i>
                  <i class="wc-sk-b" style="flex: 2; opacity: 0.55"></i>
                </span>
              }
              @case ('grouped') {
                <span class="wc-sk-hpair">
                  <i class="wc-sk-b" [style.width.%]="w"></i>
                  <i class="wc-sk-b" [style.width.%]="w * 0.86 + 6" style="opacity: 0.6"></i>
                </span>
              }
              @default {
                <span class="wc-sk-hbar wc-sk-hbar--one">
                  <i class="wc-sk-b" [style.width.%]="w"></i>
                  @if (p.compare) {
                    <i class="wc-sk-tick" [style.left.%]="w + ($index % 2 ? -6 : 7)"></i>
                  }
                </span>
              }
            }
            <i class="wc-sk-t" style="width: 36px; justify-self: end"></i>
          </div>
        }
      </div>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
})
export class WidgetSkeleton {
  readonly plan = input.required<SkeletonPlan>();
  readonly compact = input(false);
  readonly narrow = input(false);

  protected readonly four = range(4);
  protected readonly six = range(6);
  protected readonly seven = range(7);
  /** Name widths, as a share of the name column: uneven, like real names. */
  protected readonly names = [86, 68, 78, 54, 72, 60, 82, 64];
  protected readonly columns = [52, 74, 61, 88, 67, 46];
  /** Waterfall: [bottom %, height %] — an opening total, steps down and up, a closing total. */
  protected readonly steps = [
    [0, 84],
    [76, 8],
    [76, 5],
    [58, 23],
    [53, 5],
    [49, 4],
    [0, 49],
  ];
  protected readonly dots = [
    [14, 82],
    [34, 60],
    [44, 71],
    [52, 44],
    [58, 58],
    [63, 34],
    [70, 66],
    [78, 49],
    [86, 30],
    [41, 28],
    [29, 41],
  ];
  protected readonly funnel = [100, 62, 40, 24, 13];
  protected readonly wave = 'M0,20 L14,16 L28,18 L42,10 L56,13 L70,7 L84,9 L100,4';
  protected readonly waveDown = 'M0,7 L14,9 L28,6 L42,13 L56,11 L70,17 L84,15 L100,21';
  protected readonly pieArcs = arcs(21, [44, 26, 17, 13], 0.9);
  protected readonly donutArcs = arcs(35, [38, 24, 18, 12, 8]);
  protected readonly hex = [polygon(50, 52, 40, [1, 1, 1, 1, 1, 1]), polygon(50, 52, 40, [0.66, 0.66, 0.66, 0.66, 0.66, 0.66]), polygon(50, 52, 40, [0.33, 0.33, 0.33, 0.33, 0.33, 0.33]), polygon(50, 52, 40, [0.62, 0.84, 0.58, 0.9, 0.7, 0.5])];
  /** Sankey: five sources flowing into two sinks. Nodes are [x, y, height]; bands are filled curves between them. */
  protected readonly flowNodes = [
    [0, 2, 13],
    [0, 18, 19],
    [0, 40, 8],
    [0, 50, 5],
    [0, 57, 3],
    [98.4, 4, 40],
    [98.4, 50, 8],
  ];
  protected readonly flows = [band(2, 13, 4, 13), band(18, 15, 17, 15), band(33, 4, 50, 4), band(40, 8, 32, 8), band(50, 4, 40, 4), band(54, 1, 54, 1), band(57, 2, 55, 2), band(59, 1, 57, 1)];

  protected readonly legend = computed(() => range(this.plan().legend));
  protected readonly tiles = computed(() => range(this.plan().tiles));
  protected readonly bars = computed(() => [92, 86, 74, 70, 66, 58, 49, 41].slice(0, this.plan().kind === 'grouped_bar' ? 5 : this.compact() ? 6 : 8));
  protected readonly tableRows = computed(() => range(this.compact() ? 6 : 8));
  protected readonly tableCols = computed(() => range(this.narrow() ? 2 : 4));
  protected readonly heatRows = computed(() => range(this.compact() ? 5 : 8));
  protected readonly calendarCells = computed(() => range(7 * (this.narrow() ? 12 : 18)));
}

/** A filled band from the left edge (y, height) to the right edge (y, height), eased like a sankey link. */
function band(y1: number, h1: number, y2: number, h2: number): string {
  const [a, b] = [1.6, 98.4];
  return `M${a},${y1} C50,${y1} 50,${y2} ${b},${y2} L${b},${y2 + h2} C50,${y2 + h2} 50,${y1 + h1} ${a},${y1 + h1} Z`;
}
