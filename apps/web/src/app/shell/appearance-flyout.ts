import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, Injector, afterNextRender, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorPaletteLight } from '@ng-icons/phosphor-icons/light';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { CompassStore } from '../store';
import { DensitySwitch } from '../theme/density-switch';
import { ThemeSwitcher } from '../theme/theme-switcher';
import { RAIL_TIP_GAP } from './sidebar-state';

let nextId = 0;

/**
 * "Appearance" at the foot of the desktop sidebar: one item, like the places above it, that opens a small panel
 * to the right of the sidebar (or of the rail) with the theme switcher (Theme and Mode), the density switch and a
 * link to the theme lab. The sidebar itself stays quiet: the controls are one click away, not always in view.
 *
 * The panel is a CDK overlay tied to the item. Enter or Space opens it and the focus goes to the chosen theme;
 * Tab moves between the groups and stays inside, the arrow keys choose inside a group; Esc closes and gives the
 * focus back to the item; a click anywhere else closes it.
 *
 * The item uses the sidebar's `rail-item` look (global styles in sidebar.ts).
 */
@Component({
  selector: 'app-appearance-flyout',
  imports: [NgIcon, CdkConnectedOverlay, CdkOverlayOrigin, CdkTrapFocus, ThemeSwitcher, DensitySwitch, HlmTooltipImports],
  providers: [provideIcons({ phosphorPaletteLight })],
  host: { class: 'block' },
  styles: `
    .ap-fly .seg > button { outline: none; }
    .ap-fly .seg > button:focus-visible, .ap-fly-link:focus-visible { box-shadow: 0 0 0 2px var(--ring); }
    .ap-fly-link { outline: none; }
  `,
  template: `
    <button
      #trigger
      #origin="cdkOverlayOrigin"
      cdkOverlayOrigin
      type="button"
      class="rail-item rounded-md"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? panelId : null"
      hlmTooltip="Appearance"
      position="right"
      [sideOffset]="gap"
      [tooltipDisabled]="!collapsed() || open()"
      (click)="toggle()"
    >
      <ng-icon name="phosphorPaletteLight" class="rail-icon" aria-hidden="true" />
      <span class="rail-label">Appearance</span>
    </button>

    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open()" [cdkConnectedOverlayPositions]="positions" (attach)="focusFirst()" (detach)="open.set(false)" (overlayOutsideClick)="outside($event)" (overlayKeydown)="onKey($event)">
      <div
        #panel
        cdkTrapFocus
        role="dialog"
        aria-label="Appearance"
        [id]="panelId"
        class="ap-fly bg-popover text-popover-foreground ring-foreground/10 motion-safe:animate-in fade-in-0 slide-in-from-left-1 flex w-[280px] flex-col gap-3 rounded-lg p-3 shadow-md ring-1 duration-100"
      >
        <app-theme-switcher />
        <app-density-switch />
        <div class="border-border/70 border-t pt-2">
          <button type="button" class="ap-fly-link text-muted-foreground hover:text-foreground rounded text-[12.5px] underline underline-offset-2" [attr.aria-current]="store.view() === 'theme-lab' ? 'page' : null" (click)="lab()">Theme lab</button>
        </div>
      </div>
    </ng-template>
  `,
})
export class AppearanceFlyout {
  /** The sidebar is a rail of icons: the item shows its tooltip, and the panel opens beside the rail. */
  readonly collapsed = input(false);

  protected readonly store = inject(CompassStore);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly open = signal(false);
  protected readonly gap = RAIL_TIP_GAP;
  protected readonly panelId = `appearance-flyout-${nextId++}`;
  /** To the right of the item, its foot on the item's foot (the item sits at the bottom of the window). */
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'bottom', offsetX: RAIL_TIP_GAP },
    { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: RAIL_TIP_GAP },
  ];

  constructor() {
    // The item moves when the sidebar collapses or expands: the panel would be left behind, so it closes.
    effect(() => {
      this.collapsed();
      untracked(() => this.open.set(false));
    });
  }

  protected toggle() {
    this.open.update((open) => !open);
  }

  /** The first stop is the theme that is chosen now. */
  protected focusFirst() {
    afterNextRender(() => this.panel()?.nativeElement.querySelector<HTMLElement>('[role=radio][tabindex="0"]')?.focus(), { injector: this.injector });
  }

  protected onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }

  /** A click on the item itself is its own toggle; any other click outside closes, and the focus goes where the click went. */
  protected outside(event: MouseEvent) {
    if (!this.trigger().nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  protected lab() {
    this.close();
    this.store.go('theme-lab');
  }

  private close() {
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }
}
