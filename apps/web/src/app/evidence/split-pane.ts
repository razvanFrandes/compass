import { Component, ElementRef, Injector, afterNextRender, afterRenderEffect, computed, effect, inject, input, model, signal, untracked, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorSidebarSimpleLight } from '@ng-icons/phosphor-icons/light';
import { clampPosition, positionFromPointer, readSplit, splitKey, splitRange, writeSplit } from './split-pane-logic';

/**
 * Two panes side by side with a divider the person can move: drag it, use the arrow keys on it (Shift for
 * bigger steps, Home and End for the limits, Enter to fold the second pane away), or double-click it to go back
 * to the default. The second pane can be collapsed to a slim rail that keeps its name and the button that brings
 * it back. The split and the collapse are remembered.
 *
 * Usage: `<juyo-split-pane><div paneStart>…</div><aside paneEnd>…</aside></juyo-split-pane>`.
 * With `single`, only the first pane is laid out (phones: the second pane's content lives in a sheet instead).
 */
@Component({
  selector: 'juyo-split-pane',
  imports: [NgIcon],
  providers: [provideIcons({ phosphorSidebarSimpleLight })],
  host: { class: 'flex h-full min-h-0 w-full min-w-0', '[class.sp-dragging]': 'dragging()' },
  styles: `
    :host(.sp-dragging) {
      cursor: col-resize;
      user-select: none;
    }
    .sp-start {
      display: flex;
      flex: 1 1 0;
      min-width: 0;
      min-height: 0;
      flex-direction: column;
    }
    .sp-end {
      display: flex;
      flex: 0 0 auto;
      min-width: 0;
      min-height: 0;
      flex-direction: column;
    }
    .sp-sep {
      position: relative;
      z-index: 5;
      flex: none;
      width: 1px;
      background: var(--border);
      cursor: col-resize;
      touch-action: none;
      outline: none;
    }
    /* A wide, invisible target around a hairline. */
    .sp-sep::before {
      content: '';
      position: absolute;
      inset: 0 -7px;
    }
    .sp-sep::after {
      content: '';
      position: absolute;
      inset: 0 -1px;
      background: var(--focus-brand);
      opacity: 0;
      transition: opacity 130ms ease;
    }
    .sp-grip {
      position: absolute;
      top: 50%;
      left: 50%;
      z-index: 1;
      width: 5px;
      height: 36px;
      border-radius: 3px;
      background: var(--input);
      box-shadow: 0 0 0 3px var(--background);
      transform: translate(-50%, -50%);
      transition: background-color 130ms ease;
      pointer-events: none;
    }
    @media (hover: hover) {
      .sp-sep:hover::after {
        opacity: 0.7;
      }
      .sp-sep:hover .sp-grip {
        background: var(--brand);
      }
    }
    .sp-sep:focus-visible::after,
    :host(.sp-dragging) .sp-sep::after {
      opacity: 1;
    }
    .sp-sep:focus-visible .sp-grip,
    :host(.sp-dragging) .sp-grip {
      background: var(--brand);
    }
    .sp-rail {
      display: flex;
      flex: none;
      width: 44px;
      justify-content: center;
      padding-top: 12px;
      border-left: 1px solid var(--border);
    }
    /* The folded pane keeps its name on the rail, written down the side, so it is clear what the button brings back. */
    .sp-rail button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      width: 32px;
      height: max-content;
      padding: 7px 0 12px;
      border-radius: var(--radius-control, 8px);
      color: var(--muted-foreground);
      outline: none;
      cursor: pointer;
      transition:
        background-color 130ms ease,
        color 130ms ease;
    }
    .sp-rail-label {
      writing-mode: vertical-rl;
      font-size: 12.5px;
      line-height: 18px;
      font-weight: 500;
      white-space: nowrap;
    }
    .sp-rail-label::first-letter {
      text-transform: uppercase;
    }
    .sp-rail button:hover {
      background: var(--overlay-hover);
      color: var(--foreground);
    }
    .sp-rail button:focus-visible {
      box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring);
    }
    @media (prefers-reduced-motion: reduce) {
      .sp-sep::after,
      .sp-grip,
      .sp-rail button {
        transition: none;
      }
    }
  `,
  template: `
    <div class="sp-start"><ng-content select="[paneStart]" /></div>
    @if (!single()) {
      @if (collapsed()) {
        <div class="sp-rail">
          <button #expand type="button" aria-expanded="false" [attr.aria-label]="'Show ' + endLabel()" [title]="'Show ' + endLabel()" (click)="restore()">
            <ng-icon name="phosphorSidebarSimpleLight" class="-scale-x-100 text-[18px]" aria-hidden="true" />
            <span class="sp-rail-label" aria-hidden="true">{{ endLabel() }}</span>
          </button>
        </div>
      } @else {
        <div
          #separator
          class="sp-sep"
          role="separator"
          tabindex="0"
          aria-orientation="vertical"
          [attr.aria-label]="label()"
          [attr.aria-valuenow]="valueNow()"
          [attr.aria-valuemin]="valueMin()"
          [attr.aria-valuemax]="valueMax()"
          [attr.aria-valuetext]="valueNow() + '% ' + startLabel() + ', ' + (100 - valueNow()) + '% ' + endLabel()"
          title="Drag to resize. Double-click to reset."
          (pointerdown)="dragStart($event)"
          (pointermove)="dragMove($event)"
          (pointerup)="dragEnd($event)"
          (pointercancel)="dragEnd($event)"
          (dblclick)="reset()"
          (keydown)="onKey($event)"
        >
          <span class="sp-grip" aria-hidden="true"></span>
        </div>
        <div class="sp-end" [style.width.%]="100 - position()" [style.min-width.px]="minEnd()"><ng-content select="[paneEnd]" /></div>
      }
    }
  `,
})
export class SplitPane {
  /** Where the split is remembered in localStorage. Without a key it lasts for this visit. */
  readonly storageKey = input<string | null>(null);
  /** The divider's default position: the first pane's share of the width, in percent. */
  readonly defaultPosition = input(56);
  /** The second pane's default width in px. When set, it wins over `defaultPosition` once the width is known. */
  readonly defaultEnd = input<number | null>(null);
  /** The least width of each pane, in px. */
  readonly minStart = input(380);
  readonly minEnd = input(320);
  /** Lay out the first pane only (narrow screens). */
  readonly single = input(false);
  /** The divider's accessible name. */
  readonly label = input('Resize the panels');
  /** What each side holds, for the divider's value text and the rail button: "conversation", "behind the numbers". */
  readonly startLabel = input('first panel');
  readonly endLabel = input('second panel');
  /** The second pane is folded away to a rail. Two-way: `[(collapsed)]`. */
  readonly collapsed = model(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly separator = viewChild<ElementRef<HTMLElement>>('separator');
  private readonly expand = viewChild<ElementRef<HTMLElement>>('expand');

  /** The person's choice; null follows the default. */
  private readonly chosen = signal<number | null>(null);
  private readonly width = signal(0);
  protected readonly dragging = signal(false);
  private restored = false;

  private readonly range = computed(() => splitRange(this.width(), { minStart: this.minStart(), minEnd: this.minEnd() }));
  /** Where the divider sits until the person moves it: the second pane at its default width, else the default share. */
  private readonly fallback = computed(() => {
    const end = this.defaultEnd();
    const width = this.width();
    return end && width > 0 ? 100 - (end / width) * 100 : this.defaultPosition();
  });
  /** The divider's position, always within what the container allows right now. */
  readonly position = computed(() => clampPosition(this.chosen() ?? this.fallback(), this.range()));
  protected readonly valueNow = computed(() => Math.round(this.position()));
  protected readonly valueMin = computed(() => Math.round(this.range().min));
  protected readonly valueMax = computed(() => Math.round(this.range().max));

  constructor() {
    effect(() => {
      const stored = readSplit(this.storageKey());
      untracked(() => {
        if (stored) {
          this.chosen.set(stored.position);
          if (stored.collapsed) this.collapsed.set(true);
        }
        this.restored = true;
      });
    });
    effect(() => {
      const state = { position: this.chosen(), collapsed: this.collapsed() };
      // Not on every pointer move: once, when the drag ends.
      if (this.dragging() || !this.restored) return;
      writeSplit(untracked(this.storageKey), state);
    });
    afterRenderEffect((onCleanup) => {
      const element = this.host.nativeElement;
      this.width.set(element.getBoundingClientRect().width);
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver((entries) => this.width.set(entries[0]?.contentRect.width ?? element.getBoundingClientRect().width));
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }

  /** Back to the default split. */
  reset(): void {
    this.chosen.set(null);
  }

  /** Folds the second pane away; focus goes to the button that brings it back. */
  collapse(): void {
    this.collapsed.set(true);
    afterNextRender(() => this.expand()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Brings the second pane back; focus goes to the divider. */
  restore(): void {
    this.collapsed.set(false);
    afterNextRender(() => this.separator()?.nativeElement.focus(), { injector: this.injector });
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const action = splitKey(event.key, this.position(), this.range(), { shift: event.shiftKey });
    if (!action) return;
    event.preventDefault();
    if (action.type === 'toggle') this.collapse();
    else this.chosen.set(action.position);
  }

  protected dragStart(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    (event.currentTarget as HTMLElement).focus();
    this.dragging.set(true);
  }

  protected dragMove(event: PointerEvent): void {
    if (!this.dragging()) return;
    this.chosen.set(positionFromPointer(event.clientX, this.host.nativeElement.getBoundingClientRect(), this.range()));
  }

  protected dragEnd(event: PointerEvent): void {
    if (!this.dragging()) return;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.dragging.set(false);
  }
}
