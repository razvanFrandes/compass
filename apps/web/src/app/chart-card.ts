import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { EChart, palette } from './echart';
import { BOOKED, CHANNELS, COMPARES, Filters, RANGES, SEGMENTS, hotelLabel, rangeDates, scopeChips, tokenValue } from './filters';
import { Cell, ChartSpec, VIEW_LABEL, View, resolve } from './portfolio';
import { CompassStore } from './store';
import * as icons from './icons';

/*
  The one card every chart uses, whether people or Kassandra made it (report: "Fiecare grafic poartă
  aceleași cinci piese"): a statement title and a scope line; a badge when a dashboard filter can't apply
  (click it for the read-only list); Chart/Table; "Show as" with Auto plus only the compatible views (the
  others say what they lack); "How this was computed"; "Add to board" (saves the spec, not a picture);
  "Wrong chart". Clicking a mark sends a structured follow-up ({ drill: { dimension, value } }).
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
          @if (r.views.length > 1 && !r.empty) {
            <div class="seg" role="radiogroup" aria-label="Chart or table">
              <button type="button" role="radio" [attr.aria-checked]="mode() === 'chart'" aria-label="Chart" (click)="mode.set('chart')"><ng-icon name="phosphorChartBarLight" /></button>
              <button type="button" role="radio" [attr.aria-checked]="mode() === 'table'" aria-label="Table" (click)="mode.set('table')"><ng-icon name="phosphorListLight" /></button>
            </div>
          }
          <button hlmBtn variant="ghost" size="icon-sm" class="text-muted-foreground" [attr.aria-label]="'More for ' + r.title" [hlmDropdownMenuTrigger]="menu" align="end"><ng-icon name="phosphorDotsThreeBold" class="text-[18px]" /></button>
        </div>
      </header>

      @if (r.badge) {
        <button type="button" class="scope-badge mt-3 self-start" [attr.aria-expanded]="scopeOpen()" [attr.aria-controls]="spec().id + '-scope'" (click)="scopeOpen.set(!scopeOpen())">
          <ng-icon name="phosphorWarningCircleLight" />{{ r.badge.label }}
        </button>
      }
      @if (scopeOpen() && r.badge) {
        <div [id]="spec().id + '-scope'" class="latest-panel mt-2 rounded-[10px] p-3 text-[12.5px]">
          <p class="text-muted-foreground">{{ r.badge.detail }}</p>
          <p class="mt-2 font-medium">Filters on this chart</p>
          <ul class="text-muted-foreground mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            @for (f of filterList(); track f.k) {
              <li class="contents">
                <span>{{ f.k }}</span><span [class.line-through]="f.ignored">{{ f.v }}</span>
              </li>
            }
          </ul>
          <p class="text-muted-foreground mt-2">Struck-through filters don’t apply to this chart; the dashboard keeps them for the others.</p>
        </div>
      }

      @if (manual()) {
        <p class="text-muted-foreground mt-2 text-[12px]">
          Shown as {{ label(shownView()) }}, your choice.
          <button type="button" class="text-foreground underline underline-offset-2" (click)="backToAuto()">Back to Auto</button>
        </p>
      }

      <div class="mt-4 min-h-0 flex-1">
        @if (r.empty; as e) {
          <div class="text-muted-foreground flex flex-col items-start gap-3 py-6 text-[14px]">
            {{ e.text }}
            @if (e.action; as a) {
              <button hlmBtn variant="outline" size="sm" (click)="filters.set(a.patch)">{{ a.label }}</button>
            }
          </div>
        } @else if (mode() === 'table' || view() === 'table') {
          <div class="max-h-[420px] overflow-auto" tabindex="0" [attr.aria-label]="r.title + ' (table)'">
            <table class="w-full text-[13px] tabular-nums">
              <caption class="sr-only">{{ r.title }}</caption>
              <thead class="text-muted-foreground sticky top-0 z-[1] bg-(--card) text-[12px]">
                <tr>
                  @for (c of r.table.columns; track $index) {
                    <th scope="col" class="border-border border-b py-2 font-medium whitespace-nowrap" [class]="align(r, $index) === 'l' ? 'pr-3 text-left' : 'pl-3 text-right'">{{ c }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of r.table.rows; track $index) {
                  <tr class="border-border border-b last:border-b-0">
                    @for (cell of row; track $index) {
                      @let c = cellOf(cell);
                      @if ($index === 0) {
                        <th scope="row" class="py-2 pr-3 text-left whitespace-nowrap" [class]="c.text === 'Chain total' ? 'font-semibold' : 'font-normal'">{{ c.text }}</th>
                      } @else {
                        <td class="py-2 pl-3 whitespace-nowrap" [class]="align(r, $index) === 'l' ? 'text-left' : 'text-right'" [class.text-muted-foreground]="c.muted">
                          @if (c.spark) {
                            <svg width="72" height="20" viewBox="0 0 72 20" class="inline-block align-middle" aria-hidden="true">
                              <polyline [attr.points]="sparkPoints(c.spark)" fill="none" stroke="var(--series)" stroke-width="1.5" stroke-linejoin="round" />
                            </svg>
                          } @else {
                            @if (c.bar !== undefined) {
                              <span class="cell-bar mr-2" aria-hidden="true"><i [style.width.%]="c.bar * 100"></i></span>
                            }
                            {{ c.text }}
                          }
                        </td>
                      }
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
          <app-echart [option]="option()" [label]="r.aria" [style.height.px]="r.height" (pick)="drill($event)" />
        }
      </div>

      @if (mode() === 'chart' && view() !== 'table' && view() !== 'kpi' && r.legend.length && !r.empty) {
        <ul class="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]" aria-label="Legend">
          @for (l of r.legend; track l.label) {
            <li class="flex items-center gap-1.5"><i [class]="'legend-mark legend-mark--' + l.mark" aria-hidden="true"></i>{{ l.label }}</li>
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
            <dt class="text-muted-foreground">Scope</dt>
            <dd>{{ scope() }}</dd>
            <dt class="text-muted-foreground">Data</dt>
            <dd>compass_hotels, as of {{ asOf }}</dd>
          </dl>
          <p class="text-muted-foreground mt-2">{{ r.computed }}</p>
          <pre class="latest-panel mt-2 max-h-56 overflow-auto rounded-[8px] p-3 font-mono text-[11.5px]/relaxed whitespace-pre">{{ r.sql }}</pre>
        </section>
      }
    </article>

    <ng-template #menu>
      <hlm-dropdown-menu class="w-72">
        <hlm-dropdown-menu-label>Show as</hlm-dropdown-menu-label>
        <button hlmDropdownMenuItem class="items-start" (triggered)="backToAuto()">
          <ng-icon [name]="!manual() && mode() === 'chart' ? 'phosphorCheckLight' : 'phosphorSparkleLight'" class="mt-0.5" />
          <span class="flex flex-col items-start text-left"
            ><span>Auto · {{ label(r.view) }}</span><span class="text-muted-foreground text-[11.5px]">{{ r.autoWhy }}</span></span
          >
        </button>
        @for (v of r.views; track v.view) {
          <button hlmDropdownMenuItem class="items-start" [disabled]="!v.ok" (triggered)="pick(v.view)">
            <ng-icon [name]="manual() && isShown(v.view) ? 'phosphorCheckLight' : v.view === 'table' ? 'phosphorListLight' : 'phosphorChartBarLight'" class="mt-0.5" />
            <span class="flex flex-col items-start text-left"
              ><span>{{ label(v.view) }}</span>
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
  protected readonly asOf = 'Fri 20 Nov, 07:00';
  protected readonly resolved = computed(() => resolve(this.spec(), this.filters.state()));
  /** A manual "Show as" is a local change to the spec; it survives filter changes while it stays valid. */
  private readonly chosen = linkedSignal<{ r: ReturnType<typeof resolve> }, View | null>({
    source: () => ({ r: this.resolved() }),
    computation: (src, prev) => (prev?.value && src.r.views.some((x) => x.view === prev.value && x.ok) ? prev.value : null),
  });
  protected readonly manual = computed(() => this.chosen() !== null);
  protected readonly view = computed<View>(() => this.chosen() ?? this.resolved().view);
  protected readonly mode = signal<'chart' | 'table'>('chart');
  protected readonly shownView = computed<View>(() => (this.mode() === 'table' ? 'table' : this.view()));
  protected readonly howOpen = signal(false);
  protected readonly scopeOpen = signal(false);
  private readonly width = signal(600);
  protected readonly option = computed(() => this.resolved().option(this.view(), palette(), this.width()));
  protected readonly otherBoards = computed(() =>
    this.store
      .boards()
      .filter((b) => b.id !== this.store.activeBoardId())
      .slice(0, 3),
  );
  protected readonly scope = computed(() => scopeChips(this.filters.state()).join(' · '));
  protected readonly filterList = computed(() => {
    const s = this.filters.state();
    const ig = this.resolved().ignores;
    return [
      { k: 'Hotels', v: hotelLabel(s.hotels), ignored: false },
      { k: 'Stay dates', v: `${RANGES[s.range].label} (${rangeDates(s.range)})`, ignored: ig.includes('stay nights') },
      { k: 'Compare', v: COMPARES[s.compare].label, ignored: ig.includes('comparison') },
      { k: 'Segment', v: s.segments.length ? tokenValue(s.segments, s.segOp, SEGMENTS) : 'All', ignored: ig.includes('segment') },
      { k: 'Channel', v: s.channels.length ? tokenValue(s.channels, s.chOp, CHANNELS) : 'All', ignored: ig.includes('channel') },
      ...(s.booked ? [{ k: 'Booked', v: BOOKED[s.booked].label, ignored: ig.includes('booking window') }] : []),
    ];
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const ro = new ResizeObserver(([e]) => this.width.set(Math.round(e.contentRect.width / 40) * 40));
      ro.observe(host);
      destroy.onDestroy(() => ro.disconnect());
    });
  }

  protected label(v: View) {
    return VIEW_LABEL[v];
  }
  protected isShown(v: View) {
    return v === 'table' ? this.mode() === 'table' : this.mode() === 'chart' && this.view() === v;
  }
  protected pick(v: View) {
    if (v === 'table') {
      this.mode.set('table');
      return;
    }
    this.mode.set('chart');
    this.chosen.set(v === this.resolved().view ? null : v);
  }
  protected backToAuto() {
    this.mode.set('chart');
    this.chosen.set(null);
  }
  protected align(r: ReturnType<typeof resolve>, i: number) {
    return r.table.align?.[i] ?? 'r';
  }
  protected cellOf(c: Cell): { text: string; bar?: number; spark?: number[]; muted?: boolean } {
    return typeof c === 'string' ? { text: c } : c;
  }
  protected sparkPoints(xs: number[]) {
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    const span = hi - lo || 1;
    return xs.map((x, i) => `${((i / Math.max(1, xs.length - 1)) * 70 + 1).toFixed(1)},${(18 - ((x - lo) / span) * 16).toFixed(1)}`).join(' ');
  }
  protected drill(i: number) {
    const d = this.resolved().drill?.(i);
    if (d) this.store.drill(d, this.filters.state());
  }
  protected wrongChart() {
    toast('Logged: wrong chart', { description: 'Kassandra uses this to pick a different view for this question next time.', duration: 5000 });
  }
}
