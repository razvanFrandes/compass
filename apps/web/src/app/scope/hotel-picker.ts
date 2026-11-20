import { Component, DOCUMENT, ElementRef, computed, inject, input, model, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCheckBold, phosphorMinusBold } from '@ng-icons/phosphor-icons/bold';
import { phosphorMagnifyingGlassLight, phosphorXLight } from '@ng-icons/phosphor-icons/light';
import { normalizeCodes, optionState, pickerGroups, scopeChips, toggleOption, type HotelRef, type PickerOption, type ScopeChip } from './hotels';

/**
 * Picks hotels: the whole group, a region, a brand or any set of hotels. One search box filters by name, city,
 * country, region, brand or code. Used by the scope switcher and by the workflow builder's Hotels step.
 *
 * It is an ARIA combobox that keeps its listbox open: focus stays in the search box and `aria-activedescendant`
 * names the option the arrow keys are on. Arrows move, Enter picks, Escape clears the search (a second Escape is
 * left to whatever holds the picker), and Backspace in an empty search removes the last chip.
 *
 * `value` holds hotel codes; an empty list means the whole group.
 */
@Component({
  selector: 'app-hotel-picker',
  imports: [NgIcon],
  providers: [provideIcons({ phosphorCheckBold, phosphorMinusBold, phosphorMagnifyingGlassLight, phosphorXLight })],
  host: { class: 'hp flex min-h-0 flex-col' },
  styles: `
    .hp-search {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0; min-height: 40px; padding: 0 10px; border-radius: 10px;
      border: 1px solid var(--input); background: var(--field); transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .hp-search:focus-within { border-color: var(--focus-brand); box-shadow: 0 0 0 3px rgb(153 106 213 / 0.28); }
    .hp-search input { flex: 1; min-width: 0; height: 38px; background: transparent; color: var(--foreground); font-size: 14px; outline: none; }
    .hp-search input::placeholder { color: var(--muted-foreground); }
    .hp-clear { display: grid; place-items: center; width: 24px; height: 24px; flex-shrink: 0; border-radius: 6px; color: var(--muted-foreground); outline: none; }
    .hp-clear:focus-visible { box-shadow: 0 0 0 2px var(--ring); }

    .hp-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; flex-shrink: 0; max-height: 92px; overflow-y: auto; padding-top: 10px; }
    .hp-chip {
      display: inline-flex; align-items: center; gap: 2px; height: 26px; padding: 0 2px 0 9px; border-radius: 9999px; font-size: 12.5px;
      color: var(--foreground); background: color-mix(in srgb, var(--brand) 16%, transparent); border: 1px solid color-mix(in srgb, var(--brand) 38%, transparent);
    }
    .hp-chip button { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 9999px; color: var(--muted-foreground); outline: none; }
    .hp-chip button:focus-visible { box-shadow: 0 0 0 2px var(--ring); color: var(--foreground); }
    .hp-reset { height: 26px; padding: 0 8px; border-radius: 8px; font-size: 12.5px; color: var(--muted-foreground); text-decoration: underline; text-underline-offset: 2px; outline: none; }
    .hp-reset:focus-visible { box-shadow: 0 0 0 2px var(--ring); }

    .hp-list { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; margin: 10px -6px 0; padding: 0 6px 2px; outline: none; }
    .hp-group + .hp-group { margin-top: 10px; }
    .hp-heading { padding: 4px 8px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-foreground); }
    .hp-group--quick { display: flex; flex-wrap: wrap; gap: 6px; }
    .hp-group--quick .hp-heading { flex-basis: 100%; margin-bottom: -2px; }

    .hp-option { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 5px 8px; border-radius: 8px; cursor: pointer; scroll-margin: 28px 0 8px; }
    .hp-option[data-active] { background: var(--overlay-hover); box-shadow: inset 0 0 0 1px var(--field-border-hover); }
    .hp-box {
      display: grid; place-items: center; width: 16px; height: 16px; flex-shrink: 0; border-radius: 4px; font-size: 11px;
      border: 1.5px solid var(--muted-foreground); color: var(--primary-foreground); transition: background-color 120ms ease, border-color 120ms ease;
    }
    .hp-option[data-state='all'] .hp-box, .hp-option[data-state='some'] .hp-box { background: var(--primary); border-color: var(--primary); }
    .hp-name { display: block; font-size: 14px; line-height: 19px; color: var(--text-1); }
    .hp-hint { display: block; font-size: 12.5px; line-height: 17px; color: var(--muted-foreground); }

    .hp-pill {
      display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 10px; border-radius: 9999px; cursor: pointer;
      font-size: 13px; color: var(--foreground); border: 1px solid var(--field-border-hover); scroll-margin: 28px 0 8px;
      transition: background-color 120ms ease, border-color 120ms ease;
    }
    .hp-pill small { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--muted-foreground); }
    .hp-pill ng-icon { font-size: 11px; color: var(--brand); }
    .hp-pill[data-state='all'] { background: color-mix(in srgb, var(--brand) 18%, transparent); border-color: color-mix(in srgb, var(--brand) 55%, transparent); }
    .hp-pill[data-state='all'] small { color: var(--foreground); }
    .hp-pill[data-state='some'] { border-style: dashed; border-color: color-mix(in srgb, var(--brand) 60%, transparent); }
    .hp-pill[data-active] { box-shadow: 0 0 0 2px var(--ring); }

    .hp-empty { margin-top: 10px; padding: 18px 8px; text-align: center; font-size: 13.5px; color: var(--muted-foreground); }
    .hp-empty button { color: var(--foreground); text-decoration: underline; text-underline-offset: 2px; border-radius: 4px; outline: none; }
    .hp-empty button:focus-visible { box-shadow: 0 0 0 2px var(--ring); }

    @media (hover: hover) {
      .hp-clear:hover, .hp-chip button:hover, .hp-reset:hover { color: var(--foreground); }
      .hp-pill:hover { border-color: color-mix(in srgb, var(--brand) 60%, transparent); }
    }
    @media (pointer: coarse) {
      .hp-search input { font-size: 16px; height: 44px; }
      .hp-option { min-height: 52px; }
      .hp-pill { min-height: 38px; padding: 0 13px; font-size: 14px; }
      .hp-chip { height: 32px; }
      .hp-chip button { width: 26px; height: 26px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .hp-search, .hp-box, .hp-pill { transition: none; }
    }
  `,
  template: `
    <div class="hp-search">
      <ng-icon name="phosphorMagnifyingGlassLight" class="text-muted-foreground text-[16px]" aria-hidden="true" />
      <input
        #search
        type="text"
        role="combobox"
        aria-autocomplete="list"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="done"
        [id]="uid + '-search'"
        [attr.aria-label]="label()"
        [attr.aria-expanded]="flat().length > 0"
        [attr.aria-controls]="flat().length ? uid + '-list' : null"
        [attr.aria-activedescendant]="activeId()"
        [attr.aria-describedby]="uid + '-keys'"
        [placeholder]="placeholder()"
        [value]="query()"
        (input)="onInput($any($event.target).value)"
        (keydown)="onKey($event)"
      />
      @if (query()) {
        <button type="button" class="hp-clear" aria-label="Clear the search" (click)="clearQuery()"><ng-icon name="phosphorXLight" aria-hidden="true" /></button>
      }
    </div>
    <p class="sr-only" [id]="uid + '-keys'">Arrow keys move through the list, Enter selects, Backspace removes the last hotel.</p>

    @if (chips().length) {
      <ul class="hp-chips" aria-label="Selected hotels">
        @for (chip of chips(); track chip.key) {
          <li class="hp-chip">
            <span>{{ chip.label }}</span>
            <button type="button" [attr.aria-label]="'Remove ' + chip.label" (click)="removeChip(chip)"><ng-icon name="phosphorXLight" class="text-[12px]" aria-hidden="true" /></button>
          </li>
        }
        <li><button type="button" class="hp-reset" (click)="reset()">Clear all</button></li>
      </ul>
    }

    @if (flat().length) {
      <div class="hp-list" role="listbox" aria-multiselectable="true" tabindex="-1" [id]="uid + '-list'" [attr.aria-label]="label()">
        @for (group of groups(); track group.key) {
          <div class="hp-group" role="group" [class.hp-group--quick]="group.key === 'quick'" [attr.aria-labelledby]="uid + '-g-' + $index">
            <div class="hp-heading" [id]="uid + '-g-' + $index">{{ group.label }}</div>
            @for (option of group.options; track option.id) {
              @let state = stateOf(option);
              <div
                role="option"
                [class]="option.kind === 'hotel' ? 'hp-option' : 'hp-pill'"
                [id]="domId(option)"
                [attr.aria-selected]="state === 'all'"
                [attr.data-state]="state"
                [attr.data-active]="activeId() === domId(option) ? '' : null"
                (mousedown)="$event.preventDefault()"
                (click)="pick(option)"
              >
                @if (option.kind === 'hotel') {
                  <span class="hp-box" aria-hidden="true">
                    @if (state === 'all') {
                      <ng-icon name="phosphorCheckBold" />
                    }
                  </span>
                  <span class="min-w-0">
                    <span class="hp-name">{{ option.label }}</span>
                    <span class="hp-hint">{{ option.hint }}</span>
                  </span>
                } @else {
                  @if (state === 'all') {
                    <ng-icon name="phosphorCheckBold" aria-hidden="true" />
                  } @else if (state === 'some') {
                    <ng-icon name="phosphorMinusBold" aria-hidden="true" />
                  }
                  <span>{{ option.label }}</span>
                  @if (option.hint) {
                    <small aria-hidden="true">{{ option.hint }}</small>
                    <span class="sr-only">, {{ setHint(option) }}</span>
                  }
                }
              </div>
            }
          </div>
        }
      </div>
    } @else {
      <p class="hp-empty">No hotel matches “{{ query() }}”. <button type="button" (click)="clearQuery()">Clear the search</button></p>
    }

    <!-- One polite region: how many hotels match while typing, and what a pick changed. -->
    <p class="sr-only" role="status">{{ announcement() }}</p>
  `,
})
export class HotelPicker {
  /** The hotels to choose from. */
  readonly hotels = input.required<readonly HotelRef[]>();
  /** Hotel codes; empty means the whole group. */
  readonly value = model<string[]>([]);
  /** The accessible name of the search box and of the list. */
  readonly label = input('Hotels');
  readonly placeholder = input('Search hotels, cities, brands…');

  private static next = 0;
  protected readonly uid = `hp-${HotelPicker.next++}`;
  private readonly doc = inject(DOCUMENT);
  private readonly search = viewChild.required<ElementRef<HTMLInputElement>>('search');

  protected readonly query = signal('');
  private readonly cursor = signal<string | null>(null);
  private readonly said = signal('');

  private readonly selected = computed(() => normalizeCodes(this.value(), this.hotels()));
  protected readonly groups = computed(() => pickerGroups(this.hotels(), this.query()));
  protected readonly flat = computed(() => this.groups().flatMap((group) => group.options));
  protected readonly chips = computed(() => scopeChips(this.selected(), this.hotels()));

  /** The option the keyboard is on. While searching, it starts on the first hotel, so Enter takes the best match. */
  private readonly active = computed<PickerOption | null>(() => {
    const options = this.flat();
    const at = options.find((option) => option.id === this.cursor());
    if (at) return at;
    return this.query().trim() ? (options.find((option) => option.kind === 'hotel') ?? options[0] ?? null) : null;
  });
  protected readonly activeId = computed(() => {
    const option = this.active();
    return option ? this.domId(option) : null;
  });

  protected readonly announcement = computed(() => {
    if (this.said()) return this.said();
    if (!this.query().trim()) return '';
    const count = this.flat().filter((option) => option.kind === 'hotel').length;
    return count === 1 ? '1 hotel matches.' : `${count} hotels match.`;
  });

  /** Puts the keyboard in the search box (the holder calls it when it opens). */
  focus(): void {
    this.search().nativeElement.focus();
  }

  protected domId(option: PickerOption): string {
    return `${this.uid}-${option.id}`;
  }

  protected stateOf(option: PickerOption) {
    return optionState(this.selected(), option);
  }

  /** "3 of 8 hotels selected", for a region or a brand. */
  protected setHint(option: PickerOption): string {
    const held = option.codes.filter((code) => this.selected().includes(code)).length;
    return `${held} of ${option.codes.length} hotels selected`;
  }

  protected onInput(text: string) {
    this.query.set(text);
    this.cursor.set(null);
    this.said.set('');
  }

  protected clearQuery() {
    this.onInput('');
    this.focus();
  }

  protected pick(option: PickerOption) {
    const adding = optionState(this.selected(), option) !== 'all';
    const next = toggleOption(this.selected(), option, this.hotels());
    this.cursor.set(option.id);
    this.value.set(next);
    this.said.set(this.describe(option, adding, next));
  }

  protected removeChip(chip: ScopeChip) {
    const next = this.selected().filter((code) => !chip.codes.includes(code));
    this.value.set(next);
    this.said.set(`${chip.label} removed. ${this.total(next)}`);
    this.focus();
  }

  protected reset() {
    this.value.set([]);
    this.said.set(`Cleared. ${this.total([])}`);
    this.focus();
  }

  protected onKey(event: KeyboardEvent) {
    if (event.isComposing) return;
    switch (event.key) {
      case 'ArrowDown':
        return this.move(event, 1);
      case 'ArrowUp':
        return this.move(event, -1);
      case 'PageDown':
        return this.move(event, 6, false);
      case 'PageUp':
        return this.move(event, -6, false);
      case 'Home':
      case 'End':
        // With text in the box these keys move the caret, as in any text field.
        if (this.query()) return;
        return this.moveTo(event, event.key === 'Home' ? 0 : this.flat().length - 1);
      case 'Enter': {
        // Never submit a form the picker sits in.
        event.preventDefault();
        const option = this.active();
        if (!option) return;
        const searching = this.query().trim() !== '';
        this.pick(option);
        if (searching) {
          this.query.set('');
          this.reveal();
        }
        return;
      }
      case 'Escape':
        if (!this.query()) return;
        event.preventDefault();
        event.stopPropagation();
        this.onInput('');
        return;
      case 'Backspace': {
        if (this.query()) return;
        const last = this.chips().at(-1);
        if (last) {
          event.preventDefault();
          this.removeChip(last);
        }
        return;
      }
      default:
        return;
    }
  }

  private move(event: KeyboardEvent, step: number, wrap = true) {
    const options = this.flat();
    if (!options.length) return;
    const active = this.active();
    const at = active ? options.indexOf(active) : -1;
    const last = options.length - 1;
    let next: number;
    if (at < 0) next = step > 0 ? 0 : last;
    else if (wrap) next = (at + step + options.length) % options.length;
    else next = Math.max(0, Math.min(last, at + step));
    this.moveTo(event, next);
  }

  private moveTo(event: KeyboardEvent, index: number) {
    const option = this.flat()[index];
    if (!option) return;
    event.preventDefault();
    this.cursor.set(option.id);
    this.said.set('');
    this.reveal();
  }

  /** Keeps the option the keyboard is on in view; the list has rendered it already, only its highlight moves. */
  private reveal() {
    queueMicrotask(() => {
      const id = this.activeId();
      if (id) this.doc.getElementById(id)?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  private total(codes: readonly string[]): string {
    const all = this.hotels().length;
    return codes.length ? `${codes.length} of ${all} hotels selected.` : `All ${all} hotels selected.`;
  }

  private describe(option: PickerOption, adding: boolean, next: readonly string[]): string {
    if (option.kind === 'all') return this.total(next);
    const noun = option.kind === 'hotel' ? option.label : `${option.label}, ${option.codes.length} hotels,`;
    return `${noun} ${adding ? 'selected' : 'removed'}. ${this.total(next)}`;
  }
}
