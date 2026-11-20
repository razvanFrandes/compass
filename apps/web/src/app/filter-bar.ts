import { Component, DOCUMENT, ElementRef, afterRenderEffect, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import {
  BOOKED,
  BRAND_NAME,
  BookedKey,
  CHANNELS,
  COMPARES,
  COMPARE_KEYS,
  CompareKey,
  FilterState,
  Filters,
  HOTELS,
  Op,
  Pill,
  RANGES,
  RANGE_GROUPS,
  RangeKey,
  SEGMENTS,
  compareDates,
  compareReason,
  defaultCompare,
  hotelLabel,
  rangeDates,
  tokenValue,
} from './filters';
import * as icons from './icons';

type Panel = Pill | 'more' | 'all';

/*
  The global filter bar (report "Filtre și grafice pentru Compass", stage 1), sticky under the page title:
  [Hotels] [Stay dates] [vs …] [Segment] [Channel] [+ Filter] [Reset], with the resolved scope on one line.
  - Desktop: popovers; single-select controls apply at once, multi-selects apply as you tick.
  - Phones: [Hotels] [Stay] [vs] [Filters · N]; each opens a bottom sheet that applies in one batch.
  - Optional dimensions are tokens with their own remove button; the operator shows only when it isn't "is".
  - Pills Kassandra (or Undo) just changed glow once; every update is announced once in a status region.
*/
@Component({
  selector: 'app-filter-bar',
  imports: [NgIcon, NgTemplateOutlet, HlmButtonImports],
  providers: [provideIcons({ ...icons })],
  host: { class: 'block', '(document:click)': 'outside($event)', '(document:keydown.escape)': 'close()' },
  template: `
    @let s = filters.state();
    <div class="filter-bar" role="toolbar" aria-label="Filters">
      <div class="-mx-1 flex items-center gap-2 px-1 pb-1 max-sm:overflow-x-auto sm:flex-wrap">
        <!-- Permanent: hotels, stay dates, comparison -->
        @for (b of permanent(); track b.id) {
          <div class="relative shrink-0" [attr.data-panel]="b.id">
            <button type="button" class="filter-btn" [class.filter-btn--set]="b.set" [class.filter-btn--flash]="flashing(b.id)" [attr.aria-expanded]="open() === b.id" aria-haspopup="dialog" (click)="toggle(b.id, $event)">
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

        <!-- Promoted: segment and channel. Set, they read as tokens with their own remove button. -->
        @for (b of promoted(); track b.id) {
          <div class="relative shrink-0 max-sm:hidden" [attr.data-panel]="b.id">
            @if (b.set) {
              <span class="filter-token" [class.filter-btn--flash]="flashing(b.id)">
                <button type="button" [attr.aria-expanded]="open() === b.id" aria-haspopup="dialog" (click)="toggle(b.id, $event)">
                  <span class="text-muted-foreground">{{ b.label }}</span><span class="font-medium">{{ b.value }}</span>
                </button>
                <button type="button" [attr.aria-label]="'Remove filter: ' + b.label + ' ' + b.value" (click)="remove(b.id, $event)"><ng-icon name="phosphorXLight" /></button>
              </span>
            } @else {
              <button type="button" class="filter-btn" [class.filter-btn--flash]="flashing(b.id)" [attr.aria-expanded]="open() === b.id" aria-haspopup="dialog" (click)="toggle(b.id, $event)">
                <span class="text-muted-foreground">{{ b.label }}</span><span class="font-medium">All</span>
                <ng-icon name="phosphorCaretDownLight" class="text-muted-foreground" />
              </button>
            }
            @if (open() === b.id && !phone()) {
              <div class="filter-pop" role="dialog" [attr.aria-label]="b.label">
                <ng-container [ngTemplateOutlet]="panel" [ngTemplateOutletContext]="{ $implicit: b.id }" />
              </div>
            }
          </div>
        }

        <!-- Optional tokens added from "+ Filter" -->
        @if (s.booked) {
          <div class="relative shrink-0 max-sm:hidden" data-panel="booked">
            <span class="filter-token" [class.filter-btn--flash]="flashing('booked')">
              <button type="button" [attr.aria-expanded]="open() === 'booked'" aria-haspopup="dialog" (click)="toggle('booked', $event)">
                <span class="text-muted-foreground">Booked</span><span class="font-medium">{{ bookedLabel(s.booked) }}</span>
              </button>
              <button type="button" [attr.aria-label]="'Remove filter: Booked ' + bookedLabel(s.booked)" (click)="remove('booked', $event)"><ng-icon name="phosphorXLight" /></button>
            </span>
            @if (open() === 'booked' && !phone()) {
              <div class="filter-pop" role="dialog" aria-label="Booked">
                <ng-container [ngTemplateOutlet]="panel" [ngTemplateOutletContext]="{ $implicit: 'booked' }" />
              </div>
            }
          </div>
        }

        <div class="relative shrink-0 max-sm:hidden" data-panel="more">
          <button type="button" class="filter-btn" [attr.aria-expanded]="open() === 'more'" aria-haspopup="dialog" (click)="toggle('more', $event)"><ng-icon name="phosphorPlusLight" />Filter</button>
          @if (open() === 'more' && !phone()) {
            <div class="filter-pop" role="dialog" aria-label="Add a filter">
              <ng-container [ngTemplateOutlet]="panel" [ngTemplateOutletContext]="{ $implicit: 'more' }" />
            </div>
          }
        </div>

        <!-- Phones: one chip for every optional filter -->
        <div class="shrink-0 sm:hidden">
          <button type="button" class="filter-btn" [class.filter-btn--set]="filters.optionalCount() > 0" [attr.aria-expanded]="open() === 'all'" aria-haspopup="dialog" (click)="toggle('all', $event)">
            <ng-icon name="phosphorSlidersHorizontalLight" />Filters{{ filters.optionalCount() ? ' · ' + filters.optionalCount() : '' }}
          </button>
        </div>

        @if (!filters.isDefault()) {
          <button hlmBtn variant="ghost" size="sm" class="shrink-0" (click)="filters.reset()">Reset</button>
        }
      </div>
      <p class="text-muted-foreground mt-1.5 text-[12px]/snug">{{ filters.summary() }}</p>
      <p class="sr-only" role="status">{{ filters.status() }}</p>
    </div>

    <!-- Phones: one bottom sheet per chip, applied in one batch -->
    <dialog #sheet class="filter-sheet" [attr.aria-label]="sheetTitle()" (close)="onSheetClosed()" (cancel)="$event.preventDefault(); close()">
      @if (open() && phone()) {
        <header class="flex items-center justify-between border-b border-(--border) px-5 py-3.5">
          <h2 class="text-[16px] font-semibold">{{ sheetTitle() }}</h2>
          <button hlmBtn variant="ghost" size="icon-sm" aria-label="Close" (click)="close()"><ng-icon name="phosphorXLight" /></button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          @if (open() === 'all') {
            <div class="flex flex-col gap-6">
              <section><h3 class="mb-2 text-[13px] font-semibold">Segment</h3><ng-container [ngTemplateOutlet]="panel" [ngTemplateOutletContext]="{ $implicit: 'segment' }" /></section>
              <section><h3 class="mb-2 text-[13px] font-semibold">Channel</h3><ng-container [ngTemplateOutlet]="panel" [ngTemplateOutletContext]="{ $implicit: 'channel' }" /></section>
              <section><h3 class="mb-2 text-[13px] font-semibold">Booked</h3><ng-container [ngTemplateOutlet]="panel" [ngTemplateOutletContext]="{ $implicit: 'booked' }" /></section>
            </div>
          } @else {
            <ng-container [ngTemplateOutlet]="panel" [ngTemplateOutletContext]="{ $implicit: open() }" />
          }
        </div>
        <footer class="flex gap-2 border-t border-(--border) px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom,0px))]">
          <button hlmBtn variant="ghost" class="h-11" (click)="clearDraft()">Clear</button>
          <button hlmBtn class="h-11 flex-1" (click)="applyDraft()">Show results</button>
        </footer>
      }
    </dialog>

    <ng-template #panel let-id>
      @let w = working();
      @switch (id) {
        @case ('hotels') {
          <div class="flex w-[340px] max-w-full flex-col gap-2 max-sm:w-full">
            <input class="field-input w-full" type="search" placeholder="Search name, city or brand" aria-label="Search hotels" [value]="query()" (input)="query.set($any($event.target).value)" />
            <div class="flex items-center justify-between">
              <label class="filter-opt font-medium"><input type="checkbox" [checked]="!w.hotels.length" (change)="patch({ hotels: [] })" />All hotels ({{ hotels.length }})</label>
              <div class="op-toggle" role="group" aria-label="Group hotels by">
                <button type="button" [attr.aria-pressed]="groupBy() === 'region'" (click)="groupBy.set('region')">Region</button>
                <button type="button" [attr.aria-pressed]="groupBy() === 'brand'" (click)="groupBy.set('brand')">Brand</button>
              </div>
            </div>
            <div class="max-h-[320px] overflow-y-auto pr-1 max-sm:max-h-none">
              @for (g of groups(); track g.key) {
                @let st = groupState(g.codes);
                <fieldset class="mt-1">
                  <legend class="sr-only">{{ g.label }}</legend>
                  <label class="filter-opt font-medium">
                    <input type="checkbox" [checked]="st === 'all'" [indeterminate]="st === 'some'" (change)="toggleGroup(g.codes)" />
                    <span class="flex-1">{{ g.label }} ({{ g.codes.length }})</span>
                  </label>
                  @for (h of g.items; track h.code) {
                    <div class="group/opt flex items-center pl-6">
                      <label class="filter-opt min-w-0 flex-1">
                        <input type="checkbox" [checked]="isChecked(h.code)" (change)="toggleHotel(h.code)" />
                        <span class="min-w-0 flex-1 truncate">{{ h.short }}</span>
                        <span class="text-muted-foreground text-[12px]">{{ h.city }}</span>
                      </label>
                      <button type="button" class="text-muted-foreground ml-1 rounded px-1.5 py-1 text-[12px] opacity-0 group-hover/opt:opacity-100 focus-visible:opacity-100 max-sm:opacity-100" [attr.aria-label]="'Only ' + h.short" (click)="patch({ hotels: [h.code] })">Only</button>
                    </div>
                  }
                </fieldset>
              } @empty {
                <p class="text-muted-foreground py-3 text-[13px]">No hotel matches “{{ query() }}”.</p>
              }
            </div>
            <footer class="border-border text-muted-foreground flex items-center justify-between border-t pt-2 text-[12.5px]">
              <span>{{ w.hotels.length || hotels.length }} of {{ hotels.length }} selected</span>
              @if (w.hotels.length) {
                <button type="button" class="text-foreground underline-offset-2 hover:underline" (click)="patch({ hotels: [] })">Clear</button>
              }
            </footer>
          </div>
        }
        @case ('range') {
          <div class="flex w-[340px] max-w-full flex-col gap-3 max-sm:w-full" role="radiogroup" aria-label="Stay dates">
            @for (grp of rangeGroups; track grp.label) {
              <div>
                <p class="text-muted-foreground mb-1 text-[11.5px] font-medium tracking-[0.06em] uppercase">{{ grp.label }}</p>
                @for (r of grp.keys; track r) {
                  <label class="filter-opt" [class.opacity-60]="ranges[r].unavailable">
                    <input type="radio" name="fb-range" [disabled]="!!ranges[r].unavailable" [checked]="w.range === r" (change)="patch({ range: r })" />
                    <span class="flex-1">{{ ranges[r].label }}</span>
                    <span class="text-muted-foreground text-right text-[12px]">{{ ranges[r].unavailable ?? dates(r) }}</span>
                  </label>
                }
              </div>
            }
            <p class="text-muted-foreground text-[12px]">Nights of stay. When the bookings were made is a separate filter: “+ Filter → Booked”.</p>
          </div>
        }
        @case ('compare') {
          <div class="flex w-[360px] max-w-full flex-col gap-1 max-sm:w-full" role="radiogroup" aria-label="Compare with">
            @for (c of compareKeys; track c) {
              @let why = reason(c);
              <label class="filter-opt" [class.opacity-60]="why">
                <input type="radio" name="fb-compare" [disabled]="!!why" [checked]="w.compare === c" (change)="patch({ compare: c })" />
                <span class="flex flex-1 flex-col"
                  ><span>{{ compares[c].label }}{{ c === defaultFor() ? ' (default)' : '' }}</span
                  ><span class="text-muted-foreground text-[12px]">{{ why ?? hint(c) }}</span></span
                >
              </label>
            }
          </div>
        }
        @case ('segment') {
          <div class="flex w-[280px] max-w-full flex-col gap-2 max-sm:w-full">
            <div class="op-toggle self-start" role="group" aria-label="Segment operator">
              <button type="button" [attr.aria-pressed]="w.segOp === 'is'" (click)="patch({ segOp: 'is' })">is</button>
              <button type="button" [attr.aria-pressed]="w.segOp === 'is_not'" (click)="patch({ segOp: 'is_not' })">is not</button>
            </div>
            <div class="flex flex-col">
              @for (x of segments; track x.code) {
                <label class="filter-opt"><input type="checkbox" [checked]="w.segments.includes(x.code)" (change)="toggleList('segments', x.code)" />{{ x.name }}</label>
              }
            </div>
          </div>
        }
        @case ('channel') {
          <div class="flex w-[300px] max-w-full flex-col gap-2 max-sm:w-full">
            <div class="op-toggle self-start" role="group" aria-label="Channel operator">
              <button type="button" [attr.aria-pressed]="w.chOp === 'is'" (click)="patch({ chOp: 'is' })">is</button>
              <button type="button" [attr.aria-pressed]="w.chOp === 'is_not'" (click)="patch({ chOp: 'is_not' })">is not</button>
            </div>
            <div class="flex flex-col">
              @for (x of channels; track x.code) {
                <label class="filter-opt"
                  ><input type="checkbox" [checked]="w.channels.includes(x.code)" (change)="toggleList('channels', x.code)" /><span class="flex-1">{{ x.name }}</span
                  ><span class="text-muted-foreground text-[12px]">{{ x.commission_pct }}% comm.</span></label
                >
              }
            </div>
          </div>
        }
        @case ('booked') {
          <div class="flex w-[260px] max-w-full flex-col gap-1 max-sm:w-full" role="radiogroup" aria-label="Booked">
            <label class="filter-opt"><input type="radio" name="fb-booked" [checked]="!w.booked" (change)="patch({ booked: null })" /><span class="flex-1">Any time</span></label>
            @for (b of bookedKeys; track b) {
              <label class="filter-opt"><input type="radio" name="fb-booked" [checked]="w.booked === b" (change)="patch({ booked: b })" /><span class="flex-1">{{ booked[b].label }}</span></label>
            }
            <p class="text-muted-foreground mt-1 text-[12px]">When the reservation was made. Pickup uses it; charts that count every booking say so with a badge.</p>
          </div>
        }
        @case ('more') {
          <!-- Command list: pick a dimension, then its values -->
          <div class="flex w-[300px] max-w-full flex-col gap-2">
            <input class="field-input w-full" type="search" placeholder="Filter by…" aria-label="Find a dimension" [value]="dimQuery()" (input)="dimQuery.set($any($event.target).value)" />
            <ul class="flex flex-col" role="listbox" aria-label="Dimensions">
              @for (d of dims(); track d.id) {
                <li role="option" [attr.aria-disabled]="!d.ok" [attr.aria-selected]="false">
                  <button type="button" class="filter-opt w-full text-left" [disabled]="!d.ok" [class.opacity-60]="!d.ok" (click)="openDim(d.id, $event)">
                    <span class="flex flex-1 flex-col"
                      ><span>{{ d.label }}</span>
                      @if (d.hint) {
                        <span class="text-muted-foreground text-[12px]">{{ d.hint }}</span>
                      }
                    </span>
                    @if (d.ok) {
                      <ng-icon name="phosphorCaretRightLight" class="text-muted-foreground" />
                    }
                  </button>
                </li>
              }
            </ul>
          </div>
        }
      }
    </ng-template>
  `,
})
export class FilterBar {
  protected readonly filters = inject(Filters);
  private readonly doc = inject(DOCUMENT);
  private readonly sheet = viewChild.required<ElementRef<HTMLDialogElement>>('sheet');
  protected readonly hotels = HOTELS;
  protected readonly segments = SEGMENTS;
  protected readonly channels = CHANNELS;
  protected readonly ranges = RANGES;
  protected readonly compares = COMPARES;
  protected readonly booked = BOOKED;
  protected readonly compareKeys = COMPARE_KEYS;
  protected readonly rangeGroups = RANGE_GROUPS;
  protected readonly bookedKeys = Object.keys(BOOKED) as BookedKey[];

  protected readonly open = signal<Panel | null>(null);
  protected readonly phone = signal(false);
  protected readonly query = signal('');
  protected readonly dimQuery = signal('');
  protected readonly groupBy = signal<'region' | 'brand'>('region');
  /** On phones the sheet edits a draft, applied in one batch; on desktop changes apply live. */
  protected readonly draft = signal<FilterState | null>(null);
  protected readonly working = computed(() => this.draft() ?? this.filters.state());
  private readonly flashOn = signal<Pill[]>([]);

  protected readonly permanent = computed(() => {
    const s = this.filters.state();
    return [
      { id: 'hotels' as Pill, icon: 'phosphorBuildingsLight', label: 'Hotels', value: hotelLabel(s.hotels), set: !!s.hotels.length },
      { id: 'range' as Pill, icon: 'phosphorCalendarBlankLight', label: 'Stay dates', value: RANGES[s.range].label, set: s.range !== 'next30' },
      { id: 'compare' as Pill, icon: '', label: 'vs', value: COMPARES[s.compare].label, set: s.compare !== defaultCompare(s.range) },
    ];
  });
  protected readonly promoted = computed(() => {
    const s = this.filters.state();
    return [
      { id: 'segment' as Pill, label: 'Segment', value: tokenValue(s.segments, s.segOp, SEGMENTS), set: !!s.segments.length },
      { id: 'channel' as Pill, label: 'Channel', value: tokenValue(s.channels, s.chOp, CHANNELS), set: !!s.channels.length },
    ];
  });
  protected readonly groups = computed(() => {
    const q = this.query().trim().toLowerCase();
    const by = this.groupBy();
    const list = HOTELS.filter((h) => !q || `${h.name} ${h.city} ${h.region} ${BRAND_NAME[h.brand] ?? h.brand}`.toLowerCase().includes(q));
    const keys = [...new Set(list.map((h) => (by === 'region' ? h.region : h.brand)))];
    return keys.map((key) => {
      const items = list.filter((h) => (by === 'region' ? h.region : h.brand) === key);
      const all = HOTELS.filter((h) => (by === 'region' ? h.region : h.brand) === key);
      return { key, label: by === 'region' ? key : (BRAND_NAME[key] ?? key), items, codes: all.map((h) => h.code) };
    });
  });
  protected readonly dims = computed(() => {
    const q = this.dimQuery().trim().toLowerCase();
    const all = [
      { id: 'booked', label: 'Booked', hint: 'When the reservation was made', ok: true },
      { id: 'segment', label: 'Segment', hint: '', ok: true },
      { id: 'channel', label: 'Channel', hint: '', ok: true },
      { id: 'room_type', label: 'Room type', hint: 'Not in this prototype’s extract yet', ok: false },
      { id: 'rate_plan', label: 'Rate plan', hint: 'Not in this prototype’s extract yet', ok: false },
      { id: 'los', label: 'Length of stay', hint: 'Not in this prototype’s extract yet', ok: false },
      { id: 'market', label: 'Source market', hint: 'Not in this prototype’s extract yet', ok: false },
    ];
    return all.filter((d) => !q || d.label.toLowerCase().includes(q));
  });
  protected readonly sheetTitle = computed(() => ({ hotels: 'Hotels', range: 'Stay dates', compare: 'Compare with', segment: 'Segment', channel: 'Channel', booked: 'Booked', more: 'Add a filter', all: 'Filters' })[this.open() ?? 'hotels']);
  protected readonly defaultFor = computed(() => defaultCompare(this.working().range));

  constructor() {
    afterRenderEffect(() => {
      const d = this.sheet().nativeElement;
      if (this.open() && this.phone()) {
        if (!d.open) d.showModal();
      } else if (d.open) d.close();
    });
    // Changed pills glow once.
    effect((onCleanup) => {
      const f = this.filters.flash();
      if (!f.pills.length) return;
      untracked(() => this.flashOn.set(f.pills));
      const t = setTimeout(() => this.flashOn.set([]), 1700);
      onCleanup(() => clearTimeout(t));
    });
    // "Edit filters" on a receipt opens the first changed pill.
    effect(() => {
      const r = this.filters.editRequest();
      if (!r) return;
      untracked(() => this.openPanel(r.pill));
    });
  }

  protected flashing(p: Pill) {
    return this.flashOn().includes(p);
  }
  private isPhone() {
    return this.doc.defaultView?.matchMedia('(max-width: 639px)').matches ?? false;
  }
  private openPanel(id: Panel) {
    this.phone.set(this.isPhone());
    if (this.phone() && (id === 'segment' || id === 'channel' || id === 'booked' || id === 'more')) id = 'all';
    this.query.set('');
    this.dimQuery.set('');
    this.draft.set(this.phone() ? { ...this.filters.state() } : null);
    this.open.set(id);
  }
  protected toggle(id: Panel, e: Event) {
    e.stopPropagation();
    if (this.open() === id) return this.close();
    this.openPanel(id);
  }
  protected close() {
    this.open.set(null);
    this.draft.set(null);
  }
  protected onSheetClosed() {
    if (this.phone()) this.close();
  }
  protected outside(e: Event) {
    if (!this.open() || this.phone()) return;
    const t = e.target as HTMLElement;
    if (!t.isConnected) return; // the click re-rendered its own panel (e.g. "Only"); keep it open
    if (!t.closest?.(`[data-panel="${this.open()}"]`)) this.close();
  }
  protected openDim(id: string, e: Event) {
    e.stopPropagation();
    if (id === 'booked' && !this.filters.state().booked) this.filters.set({ booked: '7d' });
    this.openPanel(id as Panel);
  }
  protected remove(id: Pill, e: Event) {
    e.stopPropagation();
    this.filters.set(id === 'segment' ? { segments: [], segOp: 'is' } : id === 'channel' ? { channels: [], chOp: 'is' } : { booked: null });
  }
  protected patch(p: Partial<FilterState>) {
    if (this.draft()) {
      const next = { ...this.draft()!, ...p };
      this.draft.set(compareReason(next.range, next.compare) === null ? next : { ...next, compare: defaultCompare(next.range) });
    } else this.filters.set(p);
  }
  protected isChecked(code: string) {
    const w = this.working().hotels;
    return !w.length || w.includes(code);
  }
  protected groupState(codes: string[]): 'all' | 'some' | 'none' {
    const w = this.working().hotels;
    if (!w.length) return 'all';
    const n = codes.filter((c) => w.includes(c)).length;
    return n === codes.length ? 'all' : n ? 'some' : 'none';
  }
  protected toggleGroup(codes: string[]) {
    // Unticking a fully ticked group removes it (from "all hotels" too); ticking adds it.
    const cur = this.working().hotels.length ? this.working().hotels : HOTELS.map((h) => h.code);
    const allIn = codes.every((c) => cur.includes(c));
    const next = allIn ? cur.filter((c) => !codes.includes(c)) : [...new Set([...cur, ...codes])];
    this.patch({ hotels: next.length === HOTELS.length ? [] : next });
  }
  protected toggleHotel(code: string) {
    const cur = this.working().hotels.length ? this.working().hotels : HOTELS.map((h) => h.code);
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    this.patch({ hotels: next.length === HOTELS.length || !next.length ? [] : next });
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
    const clear: Partial<FilterState> =
      id === 'hotels'
        ? { hotels: [] }
        : id === 'range'
          ? { range: 'next30' }
          : id === 'compare'
            ? { compare: defaultCompare(this.working().range) }
            : { segments: [], segOp: 'is', channels: [], chOp: 'is', booked: null };
    this.patch(clear);
  }
  protected reason(c: CompareKey) {
    return compareReason(this.working().range, c);
  }
  protected hint(c: CompareKey) {
    return c === 'none' ? 'Hide comparison marks' : compareDates(this.working().range, c);
  }
  protected dates(r: RangeKey) {
    return rangeDates(r);
  }
  protected bookedLabel(b: BookedKey) {
    return BOOKED[b].label;
  }
  protected op(o: Op) {
    return o === 'is_not' ? 'is not' : 'is';
  }
}
