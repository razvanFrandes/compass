import { Component, DOCUMENT, ElementRef, Injector, afterNextRender, booleanAttribute, computed, inject, input, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorBuildingsLight, phosphorCaretDownLight, phosphorCaretUpDownLight } from '@ng-icons/phosphor-icons/light';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HotelPicker } from './hotel-picker';
import { ScopeService } from './scope.service';

/** Below this width the picker is a bottom sheet (the same breakpoint as Tailwind's `sm`). */
const PHONE = '(max-width: 639.98px)';
const POP_WIDTH = 416;

/**
 * The scope control: a button that says which hotels the person works on and opens the hotel picker.
 * `sidebar` is the group switcher at the top of the navigation; `chip` is the compact form for a page header.
 * With `compact`, the sidebar form is the group's initial with the number of hotels in scope as a badge: what
 * the collapsed sidebar (the icon rail) shows. It is the same button, so the picker and the focus stay put.
 * The picker opens in a native modal dialog: anchored under the button on a wide screen, a bottom sheet on a
 * phone. A pick applies at once, so the page behind follows while the picker is open.
 */
@Component({
  selector: 'app-scope-switcher',
  imports: [NgIcon, HotelPicker, HlmButtonImports, HlmTooltipImports],
  providers: [provideIcons({ phosphorBuildingsLight, phosphorCaretDownLight, phosphorCaretUpDownLight })],
  host: { class: 'block min-w-0', '(window:resize)': 'place()' },
  styles: `
    .sw-side {
      position: relative; display: flex; width: 100%; align-items: center; gap: 10px; overflow: hidden; padding: 6px; border-radius: var(--radius-control, 8px);
      text-align: left; white-space: nowrap; outline: none; transition: background-color 130ms ease;
    }
    /* Compact (the icon rail): the button is 40 px wide, so only the initial shows; the names are cut off and faded. */
    .sw-text, .sw-caret { transition: opacity 120ms ease; }
    .sw-side[data-compact] :is(.sw-text, .sw-caret) { opacity: 0; }
    .sw-count {
      position: absolute; top: 1px; right: 1px; display: grid; min-width: 16px; height: 16px; padding: 0 4px; place-items: center; border-radius: 9999px;
      border: 1px solid var(--field-border); background: var(--card); color: var(--foreground);
      font-size: var(--type-micro-size, 11px); font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums;
    }
    /* A narrowed scope reads stronger than the whole group. */
    .sw-count[data-narrowed] { border-color: var(--rail, var(--background)); background: var(--foreground); color: var(--background); }
    .sw-chip {
      display: inline-flex; max-width: 100%; align-items: center; gap: 6px; height: 28px; padding: 0 9px; border-radius: 9999px; outline: none;
      font-size: 12.5px; color: var(--foreground); background: var(--field); border: 1px solid var(--field-border-hover); transition: border-color 130ms ease;
    }
    .sw-chip[data-narrowed] { border-color: color-mix(in srgb, var(--brand) 55%, transparent); background: color-mix(in srgb, var(--brand) 12%, var(--field)); }
    .sw-side:focus-visible, .sw-chip:focus-visible { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring); }
    @media (hover: hover) {
      .sw-side:hover { background: var(--overlay-hover); }
      .sw-chip:hover { border-color: color-mix(in srgb, var(--brand) 60%, transparent); }
    }
    @media (pointer: coarse) { .sw-chip { height: 36px; padding: 0 12px; font-size: 13.5px; } }

    .sw-pop {
      position: fixed; inset: auto; left: var(--sw-x, 12px); top: var(--sw-y, 64px); margin: 0; padding: 0; overflow: hidden;
      width: min(${POP_WIDTH}px, calc(100vw - 16px)); max-width: none; max-height: min(620px, calc(100dvh - var(--sw-y, 64px) - 12px));
      border: 1px solid var(--field-border); border-radius: var(--radius-container, 14px); background: var(--popover); color: var(--foreground);
      box-shadow: var(--popover-shadow, 0 24px 60px -18px rgb(0 0 0 / 0.65), 0 2px 8px rgb(0 0 0 / 0.2));
    }
    .sw-pop[open] { display: flex; flex-direction: column; animation: sw-in 150ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    .sw-pop::backdrop { background: transparent; }
    .sw-grabber { display: none; }
    @keyframes sw-in { from { opacity: 0; transform: translateY(-4px) scale(0.985); } }
    @keyframes sw-up { from { transform: translateY(24px); opacity: 0; } }

    @media ${PHONE} {
      .sw-pop {
        inset: auto 0 0 0; width: 100vw; height: min(88dvh, 760px); max-height: none; border-width: 1px 0 0; border-radius: var(--radius-overlay, 18px) var(--radius-overlay, 18px) 0 0;
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }
      .sw-pop[open] { animation-name: sw-up; animation-duration: 220ms; }
      .sw-pop::backdrop { background: var(--scrim, rgb(0 0 0 / 0.55)); }
      .sw-grabber { display: block; width: 36px; height: 4px; margin: 8px auto 0; border-radius: 9999px; background: var(--field-border-hover); flex-shrink: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .sw-pop[open] { animation: none; }
      .sw-side, .sw-chip, .sw-text, .sw-caret { transition: none; }
    }
  `,
  template: `
    @if (variant() === 'sidebar') {
      <button
        #trigger
        type="button"
        class="sw-side"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        [attr.data-compact]="compact() ? '' : null"
        [hlmTooltip]="tip()"
        position="right"
        sideOffset="18"
        [tooltipDisabled]="!compact() || open()"
        (click)="show()"
      >
        <span class="bg-foreground/90 text-background grid size-7 shrink-0 place-items-center rounded-md text-[12px] font-semibold" aria-hidden="true">{{ initial() }}</span>
        <span class="sw-text min-w-0 flex-1">
          <span class="block truncate text-[13px] font-medium">{{ group() }}</span>
          <span class="block truncate text-[12px]" [class]="scope.isAll() ? 'text-muted-foreground' : 'text-foreground'">{{ scope.label() }}</span>
        </span>
        <span class="sr-only">. Change hotels</span>
        <ng-icon name="phosphorCaretUpDownLight" class="sw-caret text-muted-foreground shrink-0" aria-hidden="true" />
        @if (compact()) {
          <!-- The label above already says how many; the badge is for the eye. -->
          <span class="sw-count" [attr.data-narrowed]="scope.isAll() ? null : ''" aria-hidden="true">{{ scope.count() }}</span>
        }
      </button>
    } @else {
      <button #trigger type="button" class="sw-chip" aria-haspopup="dialog" [attr.aria-expanded]="open()" [attr.data-narrowed]="scope.isAll() ? null : ''" (click)="show()">
        <ng-icon name="phosphorBuildingsLight" class="text-muted-foreground shrink-0 text-[14px]" aria-hidden="true" />
        <span class="sr-only">Hotels: </span>
        <span class="truncate">{{ scope.label() }}</span>
        <ng-icon name="phosphorCaretDownLight" class="text-muted-foreground shrink-0 text-[11px]" aria-hidden="true" />
      </button>
    }

    <dialog #dialog class="sw-pop" [attr.aria-labelledby]="uid + '-title'" [style.--sw-x]="x() + 'px'" [style.--sw-y]="y() + 'px'" (close)="open.set(false)" (click)="dismiss($event)">
      <span class="sw-grabber" aria-hidden="true"></span>
      <div class="flex shrink-0 items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
        <h2 class="text-[14px] font-semibold" [id]="uid + '-title'">Which hotels?</h2>
        <p class="text-muted-foreground text-[12.5px] tabular-nums">{{ scope.isAll() ? 'Whole group' : scope.count() + ' of ' + scope.catalog().length }}</p>
      </div>
      <!-- The list is only in the page while the picker is open: a closed switcher is one button. -->
      @if (open()) {
        <app-hotel-picker class="min-h-0 flex-1 px-4" label="Search hotels" [hotels]="scope.catalog()" [value]="scope.hotels()" (valueChange)="scope.set($event)" />
      }
      <div class="border-border/70 mt-1 flex shrink-0 items-center justify-between gap-3 border-t px-4 py-2.5">
        <p class="text-muted-foreground min-w-0 text-[12.5px]/snug">Kassandra, the morning brief and new agents follow this choice.</p>
        <button #done hlmBtn type="button" size="sm" (click)="close()">Done</button>
      </div>
    </dialog>
  `,
})
export class ScopeSwitcher {
  readonly variant = input<'sidebar' | 'chip'>('chip');
  /** The hotel group's name, on the sidebar form. */
  readonly group = input('Halcyon Hospitality');
  /** The sidebar form, 40 px wide: the initial and a count badge (the collapsed sidebar). */
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly scope = inject(ScopeService);
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly picker = viewChild(HotelPicker);
  private readonly injector = inject(Injector);
  private readonly done = viewChild.required<ElementRef<HTMLButtonElement>>('done');

  private static next = 0;
  protected readonly uid = `sw-${ScopeSwitcher.next++}`;
  protected readonly open = signal(false);
  protected readonly x = signal(12);
  protected readonly y = signal(64);
  protected readonly initial = computed(() => this.group().trim().charAt(0).toUpperCase());
  /** What the compact form says on hover and focus: "Halcyon Hospitality · All 20 hotels". */
  protected readonly tip = computed(() => `${this.group()} · ${this.scope.label()}`);

  protected show() {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) return;
    this.place();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    this.open.set(true);
    // The dialog opens with the focus on Done. With a mouse or a keyboard it moves to the search box as soon as
    // the list is there; on a touch screen it stays, because the keyboard would cover half the sheet.
    this.done().nativeElement.focus();
    if (!this.view?.matchMedia?.('(pointer: coarse)').matches) afterNextRender(() => this.picker()?.focus(), { injector: this.injector });
  }

  protected close() {
    const dialog = this.dialog().nativeElement;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    this.open.set(false);
  }

  /** A click outside the panel lands on the dialog's backdrop, which belongs to the dialog element. */
  protected dismiss(event: MouseEvent) {
    const dialog = this.dialog().nativeElement;
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) this.close();
  }

  /** Under the button, kept inside the window. The phone sheet ignores it. */
  protected place() {
    const button = this.trigger()?.nativeElement;
    const view = this.view;
    if (!button || !view) return;
    const box = button.getBoundingClientRect();
    const width = Math.min(POP_WIDTH, view.innerWidth - 16);
    this.x.set(Math.round(Math.max(8, Math.min(box.left, view.innerWidth - width - 8))));
    this.y.set(Math.round(Math.min(box.bottom + 6, Math.max(8, view.innerHeight - 360))));
  }
}
