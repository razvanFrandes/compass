import { Component, DOCUMENT, ElementRef, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { CHANNELS, COMPARES, CompareKey, Filters, FilterState, HOTELS, RANGES, RangeKey, SEGMENTS, compareAllowed, hotelLabel, listLabel, lyDates, rangeDates } from './filters';
import * as icons from './icons';

type Panel = 'hotels' | 'range' | 'compare' | 'segment' | 'channel' | 'more';

/*
  The filter bar (report §"Bara globală ține trei controale permanente"): hotels, stay nights and comparison
  always visible with their resolved value; segment and channel promoted; the rest behind "+ Filter".
  Desktop: popovers that apply live. Phones: a row of chips, each opening a bottom sheet that applies
  in one batch ("Show results"), as NN/g advises when results aren't instant on mobile.
  The line underneath writes out the resolved scope and data freshness.
*/
@Component({
  selector: 'app-filter-bar',
  imports: [NgIcon, NgTemplateOutlet, HlmButtonImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block', '(document:click)': 'outside($event)', '(document:keydown.escape)': 'close()' },
  template: `
    <div class="filter-bar" role="toolbar" aria-label="Filters">
      <div class="-mx-1 flex items-center gap-2 px-1 pb-1 max-sm:overflow-x-auto sm:flex-wrap">
        @for (b of buttons(); track b.id) {
          <div class="relative shrink-0" [attr.data-panel]="b.id">
            <button type="button" class="filter-btn" [class.filter-btn--set]="b.set" [attr.aria-expanded]="open() === b.id" aria-haspopup="dialog" (click)="toggle(b.id, $event)">
              @if (b.icon) {
                <ng-icon [name]="b.icon" class="text-muted-foreground" />
              }
              <span class="text-muted-foreground max-sm:hidden">{{ b.label }}</span>
              <span class="font-medium">{{ b.value }}</span>
              <ng-icon name="phosphorCaretDownLight" class="text-muted-foreground" />
            </button>
            @if (open() === b.id && !phone()) {
              <div class="filter-pop" role="dialog" [attr.aria-label]="b.label">
                <ng-container [ngTemplateOutlet]="panel" [ngTemplateOutletContext]="{ $implicit: b.id }" />
              </div>
            }
          </div>
        }
        @if (!filters.isDefault()) {
          <button hlmBtn variant="ghost" size="sm" class="shrink-0" (click)="filters.reset()">Reset</button>
        }
      </div>
      <p class="text-muted-foreground mt-1.5 text-[12px]/snug" aria-live="polite">{{ filters.summary() }}</p>
    </div>

    <!-- Phones: one bottom sheet per chip, applied in one batch -->
    <dialog #sheet class="filter-sheet" [attr.aria-label]="sheetTitle()" (close)="open.set(null)" (cancel)="$event.preventDefault(); close()">
      @if (open() && phone()) {
        <header class="flex items-center justify-between border-b border-(--border) px-5 py-3.5">
          <h2 class="text-[16px] font-semibold">{{ sheetTitle() }}</h2>
          <button hlmBtn variant="ghost" size="icon-sm" aria-label="Close" (click)="close()"><ng-icon name="phosphorXLight" /></button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ng-container [ngTemplateOutlet]="panel" [ngTemplateOutletContext]="{ $implicit: open() }" />
        </div>
        <footer class="flex gap-2 border-t border-(--border) px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom,0px))]">
          <button hlmBtn variant="ghost" class="h-11" (click)="clearDraft()">Clear</button>
          <button hlmBtn class="h-11 flex-1" (click)="applyDraft()">Show results</button>
        </footer>
      }
    </dialog>

    <ng-template #panel let-id>
      @let s = working();
      @switch (id) {
        @case ('hotels') {
          <div class="flex w-[300px] max-w-full flex-col max-sm:w-full gap-2">
            <input class="field-input w-full" type="search" placeholder="Search hotels, cities, regions" aria-label="Search hotels" [value]="query()" (input)="query.set($any($event.target).value)" />
            <label class="filter-opt font-medium"><input type="checkbox" [checked]="!s.hotels.length" (change)="patch({ hotels: [] })" />All hotels ({{ hotels.length }})</label>
            <div class="max-h-[300px] overflow-y-auto pr-1 max-sm:max-h-none">
              @for (g of groups(); track g.region) {
                <fieldset class="mt-2">
                  <legend class="text-muted-foreground mb-1 flex w-full items-center justify-between text-[11.5px] font-medium tracking-[0.06em] uppercase">
                    {{ g.region }}
                    <button type="button" class="text-[11.5px] font-normal tracking-normal normal-case underline-offset-2 hover:underline" (click)="patch({ hotels: g.items.map(h => h.code) })">Only these</button>
                  </legend>
                  @for (h of g.items; track h.code) {
                    <label class="filter-opt"><input type="checkbox" [checked]="s.hotels.includes(h.code)" (change)="toggleHotel(h.code)" /><span class="min-w-0 flex-1 truncate">{{ h.short }}</span><span class="text-muted-foreground text-[12px]">{{ h.rooms }}</span></label>
                  }
                </fieldset>
              } @empty {
                <p class="text-muted-foreground py-3 text-[13px]">No hotel matches “{{ query() }}”.</p>
              }
            </div>
          </div>
        }
        @case ('range') {
          <div class="flex w-[300px] max-w-full flex-col max-sm:w-full gap-3" role="radiogroup" aria-label="Stay nights">
            @for (grp of rangeGroups; track grp.label) {
              <div>
                <p class="text-muted-foreground mb-1 text-[11.5px] font-medium tracking-[0.06em] uppercase">{{ grp.label }}</p>
                @for (r of grp.keys; track r) {
                  <label class="filter-opt"><input type="radio" name="fb-range" [checked]="s.range === r" (change)="patch({ range: r })" /><span class="flex-1">{{ ranges[r].label }}</span><span class="text-muted-foreground text-[12px]">{{ dates(r) }}</span></label>
                }
              </div>
            }
            <p class="text-muted-foreground text-[12px]">Stay dates. Booking-window filters are under “+ Filter”.</p>
          </div>
        }
        @case ('compare') {
          <div class="flex w-[320px] max-w-full flex-col max-sm:w-full gap-1" role="radiogroup" aria-label="Compare to">
            @for (c of compareKeys; track c) {
              <label class="filter-opt" [class.opacity-60]="!allowed(c)">
                <input type="radio" name="fb-compare" [disabled]="!allowed(c)" [checked]="s.compare === c" (change)="patch({ compare: c })" />
                <span class="flex flex-1 flex-col"><span>{{ compares[c].label }}</span><span class="text-muted-foreground text-[12px]">{{ compareHint(c) }}</span></span>
              </label>
            }
          </div>
        }
        @case ('segment') {
          <div class="flex w-[260px] max-w-full flex-col max-sm:w-full gap-1">
            <label class="filter-opt font-medium"><input type="checkbox" [checked]="!s.segments.length" (change)="patch({ segments: [] })" />All segments</label>
            @for (x of segments; track x.code) {
              <label class="filter-opt"><input type="checkbox" [checked]="s.segments.includes(x.code)" (change)="toggleList('segments', x.code)" />{{ x.name }}</label>
            }
          </div>
        }
        @case ('channel') {
          <div class="flex w-[260px] max-w-full flex-col max-sm:w-full gap-1">
            <label class="filter-opt font-medium"><input type="checkbox" [checked]="!s.channels.length" (change)="patch({ channels: [] })" />All channels</label>
            @for (x of channels; track x.code) {
              <label class="filter-opt"><input type="checkbox" [checked]="s.channels.includes(x.code)" (change)="toggleList('channels', x.code)" /><span class="flex-1">{{ x.name }}</span><span class="text-muted-foreground text-[12px]">{{ x.commission_pct }}%</span></label>
            }
          </div>
        }
        @case ('more') {
          <div class="flex w-[280px] max-w-full flex-col max-sm:w-full gap-1">
            @for (m of more; track m) {
              <div class="filter-opt text-muted-foreground"><ng-icon name="phosphorPlusLight" />{{ m }}<span class="ml-auto text-[11.5px]">next</span></div>
            }
            <p class="text-muted-foreground mt-1 text-[12px]">These dimensions aren’t in this prototype’s data cube yet.</p>
          </div>
        }
      }
    </ng-template>
  `,
})
export class FilterBar {
  protected readonly filters = inject(Filters);
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly sheet = viewChild.required<ElementRef<HTMLDialogElement>>('sheet');
  protected readonly hotels = HOTELS;
  protected readonly segments = SEGMENTS;
  protected readonly channels = CHANNELS;
  protected readonly ranges = RANGES;
  protected readonly compares = COMPARES;
  protected readonly compareKeys: CompareKey[] = ['stly', 'ly_dow', 'budget', 'forecast', 'none'];
  protected readonly rangeGroups: { label: string; keys: RangeKey[] }[] = [
    { label: 'Upcoming', keys: ['next7', 'next30', 'next90'] },
    { label: 'Past', keys: ['last7', 'last30'] },
  ];
  protected readonly more = ['Room type', 'Rate plan', 'Booking window', 'Length of stay', 'Source market'];

  protected readonly open = signal<Panel | null>(null);
  protected readonly phone = signal(false);
  protected readonly query = signal('');
  /** On phones the sheet edits a draft, applied in one batch; on desktop changes apply live. */
  protected readonly draft = signal<FilterState | null>(null);
  protected readonly working = computed(() => this.draft() ?? this.filters.state());

  protected readonly buttons = computed(() => {
    const s = this.filters.state();
    return [
      { id: 'hotels' as Panel, icon: 'phosphorBuildingsLight', label: 'Hotels', value: hotelLabel(s.hotels), set: !!s.hotels.length },
      { id: 'range' as Panel, icon: 'phosphorCalendarBlankLight', label: 'Stay', value: RANGES[s.range].label, set: s.range !== 'next30' },
      { id: 'compare' as Panel, icon: '', label: 'vs', value: COMPARES[s.compare].label, set: false },
      { id: 'segment' as Panel, icon: '', label: 'Segment', value: listLabel(s.segments, SEGMENTS, 'All'), set: !!s.segments.length },
      { id: 'channel' as Panel, icon: '', label: 'Channel', value: listLabel(s.channels, CHANNELS, 'All'), set: !!s.channels.length },
      { id: 'more' as Panel, icon: 'phosphorPlusLight', label: '', value: 'Filter', set: false },
    ];
  });
  protected readonly groups = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = HOTELS.filter((h) => !q || `${h.name} ${h.city} ${h.region}`.toLowerCase().includes(q));
    return [...new Set(list.map((h) => h.region))].map((region) => ({ region, items: list.filter((h) => h.region === region) }));
  });
  protected readonly sheetTitle = computed(() => ({ hotels: 'Hotels', range: 'Stay nights', compare: 'Compare to', segment: 'Segment', channel: 'Channel', more: 'More filters' })[this.open() ?? 'hotels']);

  constructor() {
    afterRenderEffect(() => {
      const d = this.sheet().nativeElement;
      if (this.open() && this.phone()) {
        if (!d.open) d.showModal();
      } else if (d.open) d.close();
    });
  }

  protected toggle(id: Panel, e: Event) {
    e.stopPropagation();
    if (this.open() === id) return this.close();
    this.phone.set(this.doc.defaultView?.matchMedia('(max-width: 639px)').matches ?? false);
    this.query.set('');
    this.draft.set(this.phone() ? { ...this.filters.state() } : null);
    this.open.set(id);
  }
  protected close() {
    this.open.set(null);
    this.draft.set(null);
  }
  protected outside(e: Event) {
    if (!this.open() || this.phone()) return;
    const t = e.target as HTMLElement;
    if (!t.closest?.(`[data-panel="${this.open()}"]`)) this.close();
  }
  protected patch(p: Partial<FilterState>) {
    if (this.draft()) {
      const next = { ...this.draft()!, ...p };
      this.draft.set(compareAllowed(next.range, next.compare) ? next : { ...next, compare: RANGES[next.range].future ? 'stly' : 'ly_dow' });
    } else this.filters.set(p);
  }
  protected toggleHotel(code: string) {
    const cur = this.working().hotels;
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    this.patch({ hotels: next.length === HOTELS.length ? [] : next });
  }
  protected toggleList(key: 'segments' | 'channels', code: string) {
    const cur = this.working()[key];
    this.patch({ [key]: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code] });
  }
  protected applyDraft() {
    const d = this.draft();
    if (d) this.filters.set(d);
    this.close();
  }
  protected clearDraft() {
    const id = this.open();
    const clear: Partial<FilterState> = id === 'hotels' ? { hotels: [] } : id === 'segment' ? { segments: [] } : id === 'channel' ? { channels: [] } : id === 'range' ? { range: 'next30' } : id === 'compare' ? { compare: RANGES[this.working().range].future ? 'stly' : 'ly_dow' } : {};
    this.patch(clear);
  }
  protected allowed(c: CompareKey) {
    return compareAllowed(this.working().range, c);
  }
  protected compareHint(c: CompareKey) {
    const r = this.working().range;
    if (!this.allowed(c)) return c === 'forecast' ? 'Forecasts exist for future nights only' : c === 'stly' ? 'For future nights; past nights compare with last year' : 'For past nights';
    return c === 'stly' || c === 'ly_dow' ? lyDates(r) : c === 'budget' ? 'Monthly budget, per night' : c === 'forecast' ? 'RMS forecast made 20 Nov, P50' : 'Hide comparison lines';
  }
  protected dates(r: RangeKey) {
    return rangeDates(r);
  }
}
