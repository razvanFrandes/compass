import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { EChart, palette } from './echart';
import { COMPARES, Filters, RANGES, hotelLabel, listLabel, SEGMENTS, CHANNELS } from './filters';
import { ChartSpec, VIEW_LABEL, View, resolve } from './portfolio';
import { CompassStore } from './store';
import * as icons from './icons';

/*
  The one card every chart uses, made by people or by Kassandra (report, "Fiecare grafic poartă aceleași
  cinci piese"): a statement title, a scope line, a badge when it can't follow a dashboard filter,
  Chart/Table, a switcher limited to compatible views (the others say why), "How this was computed",
  "Add to board" and "Wrong chart".
*/
@Component({
  selector: 'app-chart-card',
  imports: [NgIcon, EChart, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block min-w-0' },
  template: `
    @let r = resolved();
    <article class="insight-card flex h-full flex-col p-5" [attr.aria-labelledby]="spec().id + '-t'">
      <header class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <h3 [id]="spec().id + '-t'" class="text-[15.5px]/snug font-semibold tracking-[-0.005em]">{{ r.title }}</h3>
          <p class="text-muted-foreground mt-1 text-[12.5px]/snug">{{ r.subtitle }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          @if (r.views.length > 1) {
            <div class="seg" role="radiogroup" aria-label="Show as">
              <button type="button" role="radio" [attr.aria-checked]="mode() === 'chart'" aria-label="Chart" (click)="mode.set('chart')"><ng-icon name="phosphorChartBarLight" /></button>
              <button type="button" role="radio" [attr.aria-checked]="mode() === 'table'" aria-label="Table" (click)="mode.set('table')"><ng-icon name="phosphorListLight" /></button>
            </div>
          }
          <button hlmBtn variant="ghost" size="icon-sm" class="text-muted-foreground" [attr.aria-label]="'More for ' + r.title" [hlmDropdownMenuTrigger]="menu" align="end"><ng-icon name="phosphorDotsThreeBold" class="text-[18px]" /></button>
        </div>
      </header>

      @if (r.badge) {
        <button type="button" class="scope-badge mt-3 self-start" [attr.aria-expanded]="scopeOpen()" (click)="scopeOpen.set(!scopeOpen())">
          <ng-icon name="phosphorWarningCircleLight" />{{ r.badge.label }}
        </button>
      }
      @if (scopeOpen()) {
        <div class="latest-panel mt-2 rounded-[10px] p-3 text-[12.5px]">
          <p class="text-muted-foreground">{{ r.badge?.detail }}</p>
          <p class="mt-2 font-medium">Filters on this chart</p>
          <ul class="text-muted-foreground mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            @for (f of filterList(); track f.k) {
              <li class="contents"><span>{{ f.k }}</span><span [class.line-through]="f.ignored">{{ f.v }}{{ f.ignored ? ' (not applied)' : '' }}</span></li>
            }
          </ul>
        </div>
      }

      <div class="mt-4 min-h-0 flex-1">
        @if (r.empty; as e) {
          <div class="text-muted-foreground flex flex-col items-start gap-2 py-6 text-[14px]">
            {{ e.text }}
            @if (e.action; as a) {
              <button hlmBtn variant="outline" size="sm" (click)="filters.set(a.patch)">{{ a.label }}</button>
            }
          </div>
        } @else if (mode() === 'table' || view() === 'table') {
          <div class="max-h-[340px] overflow-auto">
            <table class="w-full text-[13px] tabular-nums">
              <thead class="text-muted-foreground sticky top-0 bg-(--card) text-[12px]">
                <tr>
                  @for (c of r.table.columns; track $index) {
                    <th scope="col" class="border-border border-b py-2 font-medium" [class]="(r.table.align?.[$index] ?? 'r') === 'l' ? 'pr-3 text-left' : 'pl-3 text-right'">{{ c }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of r.table.rows; track $index) {
                  <tr class="border-border border-b last:border-b-0">
                    @for (cell of row; track $index) {
                      <td class="py-2" [class]="(r.table.align?.[$index] ?? 'r') === 'l' ? 'pr-3 text-left' : 'text-muted-foreground pl-3 text-right'" [class.text-foreground]="$index === 1">{{ cell }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (view() === 'kpi' && r.kpi) {
          <p class="text-[34px]/tight font-semibold tracking-[-0.02em] tabular-nums">{{ r.kpi.value }}</p>
          <p class="text-muted-foreground mt-1 text-[13px]">{{ r.kpi.delta }}</p>
        } @else {
          <app-echart [option]="option()" [label]="r.aria" [style.height.px]="r.height" />
        }
      </div>

      @if (mode() === 'chart' && view() !== 'table' && r.legend.length && !r.empty) {
        <ul class="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]" aria-label="Legend">
          @for (l of r.legend; track l.label) {
            <li class="flex items-center gap-1.5"><i class="legend-mark" [class]="'legend-mark legend-mark--' + l.mark" aria-hidden="true"></i>{{ l.label }}</li>
          }
        </ul>
      }

      @if (howOpen()) {
        <section class="border-border mt-4 border-t pt-3 text-[12.5px]" aria-label="How this was computed">
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            @for (d of r.definitions; track d[0]) {
              <dt class="text-muted-foreground">{{ d[0] }}</dt>
              <dd>{{ d[1] }}</dd>
            }
          </dl>
          <p class="text-muted-foreground mt-2">{{ r.computed }}</p>
          <pre class="latest-panel mt-2 max-h-56 overflow-auto rounded-[8px] p-3 font-mono text-[11.5px]/relaxed whitespace-pre">{{ r.sql }}</pre>
        </section>
      }
    </article>

    <ng-template #menu>
      <hlm-dropdown-menu class="w-64">
        <hlm-dropdown-menu-label>Show as</hlm-dropdown-menu-label>
        @for (v of r.views; track v.view) {
          <button hlmDropdownMenuItem class="items-start" [disabled]="!v.ok" (triggered)="pick(v.view)">
            <ng-icon [name]="isShown(v.view) ? 'phosphorCheckLight' : v.view === 'table' ? 'phosphorListLight' : 'phosphorChartBarLight'" class="mt-0.5" />
            <span class="flex flex-col items-start text-left"><span>{{ label(v.view) }}</span>
              @if (v.reason && !v.ok) {
                <span class="text-muted-foreground text-[11.5px]">{{ v.reason }}</span>
              }
            </span>
          </button>
        }
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem (triggered)="howOpen.set(!howOpen())"><ng-icon name="phosphorDatabaseLight" />{{ howOpen() ? 'Hide how this was computed' : 'How this was computed' }}</button>
        @for (b of otherBoards(); track b.id) {
          <button hlmDropdownMenuItem (triggered)="store.addChartToBoard(b.id, spec())"><ng-icon name="phosphorPlusLight" />Add to {{ b.name }}</button>
        }
        <button hlmDropdownMenuItem (triggered)="wrongChart()"><ng-icon name="phosphorThumbsDownLight" />Wrong chart</button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class ChartCard {
  readonly spec = input.required<ChartSpec>();
  protected readonly filters = inject(Filters);
  protected readonly store = inject(CompassStore);
  protected readonly resolved = computed(() => resolve(this.spec(), this.filters.state()));
  /** Keeps the person's choice while it stays valid for the data; falls back to the resolver's choice. */
  protected readonly view = linkedSignal<{ r: ReturnType<typeof resolve> }, View>({
    source: () => ({ r: this.resolved() }),
    computation: (src, prev) => (prev && src.r.views.some((v) => v.view === prev.value && v.ok) ? prev.value : src.r.view),
  });
  protected readonly mode = signal<'chart' | 'table'>('chart');
  protected readonly howOpen = signal(false);
  protected readonly scopeOpen = signal(false);
  /** Card width, bucketed so a resize only rebuilds the chart when the layout really changes. */
  private readonly width = signal(600);
  protected readonly option = computed(() => this.resolved().option(this.view(), palette(), this.width()));

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const ro = new ResizeObserver(([e]) => this.width.set(Math.round(e.contentRect.width / 40) * 40));
      ro.observe(host);
      destroy.onDestroy(() => ro.disconnect());
    });
  }
  protected readonly otherBoards = computed(() => this.store.boards().filter((b) => b.id !== this.store.activeBoardId()).slice(0, 3));
  protected readonly filterList = computed(() => {
    const s = this.filters.state();
    const ig = this.resolved().ignores;
    return [
      { k: 'Hotels', v: hotelLabel(s.hotels), ignored: false },
      { k: 'Stay', v: RANGES[s.range].label, ignored: ig.includes('stay nights') },
      { k: 'Compare', v: COMPARES[s.compare].label, ignored: ig.includes('comparison') },
      { k: 'Segment', v: listLabel(s.segments, SEGMENTS, 'All'), ignored: ig.includes('segment') },
      { k: 'Channel', v: listLabel(s.channels, CHANNELS, 'All'), ignored: ig.includes('channel') },
    ];
  });

  protected isShown(v: View) {
    return v === 'table' ? this.mode() === 'table' : this.mode() === 'chart' && this.view() === v;
  }
  protected label(v: View) {
    return VIEW_LABEL[v];
  }
  protected pick(v: View) {
    if (v === 'table') this.mode.set('table');
    else {
      this.mode.set('chart');
      this.view.set(v);
    }
  }
  protected wrongChart() {
    toast('Logged: wrong chart', { description: 'Kassandra uses this to pick a different view for this question next time.', duration: 5000 });
  }
}
