import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from '@angular/cdk/overlay';
import { Component, DOCUMENT, ElementRef, Injector, afterNextRender, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { DEMO_TEAM, TEAM_ROLE_LABEL } from '@compass/contracts';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorBookOpenLight, phosphorCaretRightLight, phosphorCaretUpDownLight, phosphorKeyboardLight, phosphorPaletteLight } from '@ng-icons/phosphor-icons/light';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { DocsRouter } from '../docs/docs-router';
import { CompassStore } from '../store';
import { DensitySwitch } from '../theme/density-switch';
import { ThemeSwitcher } from '../theme/theme-switcher';
import { RAIL_TIP_GAP } from './sidebar-state';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** The person the demo is seen as: the revenue manager of Arbor Lisbon Chiado, from the fictional team. There is no sign-in. */
export const PERSONA = { name: DEMO_TEAM['LIS']!.revenueManager.name, role: TEAM_ROLE_LABEL.revenue_manager, initials: initials(DEMO_TEAM['LIS']!.revenueManager.name) } as const;

let nextId = 0;

/**
 * The foot of the desktop sidebar: who is using Compass, and the menu of what belongs to them, like an account
 * menu. Docs, Appearance and Keyboard shortcuts, then a quiet line that the data is fictional.
 *
 * The menu is Spartan's dropdown (CDK menu): arrow keys move, Esc closes and gives the focus back to the button.
 * Appearance is not a list of choices but two switchers, so it opens a small dialog beside the button (a CDK
 * overlay), with the theme switcher (Theme × Mode), the density switch and the theme lab. The focus goes to the
 * chosen theme; Tab stays inside; Esc or a click outside closes it and the focus comes back to the button.
 *
 * In the rail it is the avatar alone, named by the persona, and opens the same menu.
 */
@Component({
  selector: 'app-user-menu',
  imports: [NgIcon, CdkConnectedOverlay, CdkOverlayOrigin, CdkTrapFocus, ThemeSwitcher, DensitySwitch, HlmDropdownMenuImports, HlmTooltipImports],
  providers: [provideIcons({ phosphorBookOpenLight, phosphorCaretRightLight, phosphorCaretUpDownLight, phosphorKeyboardLight, phosphorPaletteLight })],
  host: { class: 'block' },
  styles: `
    .um-trigger {
      display: flex; width: 100%; align-items: center; gap: 10px; overflow: hidden; padding: 6px; border-radius: var(--radius-control, 8px);
      color: var(--foreground); text-align: left; white-space: nowrap; outline: none; transition: background-color 150ms ease;
    }
    .um-trigger[aria-expanded='true'] { background: var(--rail-hover, var(--overlay-hover)); }
    @media (hover: hover) { .um-trigger:hover { background: var(--rail-hover, var(--overlay-hover)); } }
    .um-trigger:focus-visible { box-shadow: 0 0 0 2px var(--ring); }
    /* The avatar: the persona's initials on a quiet tint of the brand, a hairline ring so it holds on every surface. */
    .um-avatar {
      display: grid; width: 28px; height: 28px; flex-shrink: 0; place-items: center; border-radius: 9999px;
      background: color-mix(in oklab, var(--brand, var(--primary)) 22%, var(--card, var(--background)));
      box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--brand, var(--primary)) 40%, transparent);
      color: var(--foreground); font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
    }
    .um-avatar::before {
      content: attr(data-initials);
    }
    .um-text { min-width: 0; flex: 1; transition: opacity 120ms ease; }
    .um-caret { flex-shrink: 0; color: var(--muted-foreground); font-size: 14px; transition: opacity 120ms ease; }
    :host([data-collapsed]) :is(.um-text, .um-caret) { opacity: 0; }
    .um-fly .seg > button { outline: none; }
    .um-fly .seg > button:focus-visible, .um-fly-link:focus-visible { box-shadow: 0 0 0 2px var(--ring); }
    .um-fly-link { outline: none; }
    @media (prefers-reduced-motion: reduce) { .um-trigger, .um-text, .um-caret { transition: none; } }
  `,
  template: `
    <button
      #trigger
      #origin="cdkOverlayOrigin"
      cdkOverlayOrigin
      type="button"
      class="um-trigger"
      [attr.aria-label]="collapsed() ? label : null"
      [hlmDropdownMenuTrigger]="menu"
      side="top"
      align="start"
      [hlmTooltip]="label"
      position="right"
      [sideOffset]="gap"
      [tooltipDisabled]="!collapsed() || menuOpen() || panelOpen()"
      (hlmDropdownMenuOpened)="menuOpen.set(true)"
      (hlmDropdownMenuClosed)="menuOpen.set(false)"
    >
      <!-- The initials are drawn, not written: in the rail the label alone names the button (label in name). -->
      <span class="um-avatar" aria-hidden="true" [attr.data-initials]="persona.initials"></span>
      <!-- Open, the name and role on screen are the button's name (WCAG 2.5.3); in the rail, only the avatar shows and the label says who. -->
      <span class="um-text" [attr.aria-hidden]="collapsed() ? 'true' : null">
        <span class="block truncate text-[13px] font-medium">{{ persona.name }}</span><span class="sr-only">, </span>
        <span class="text-muted-foreground block truncate text-[12px]">{{ persona.role }}</span>
      </span>
      <ng-icon name="phosphorCaretUpDownLight" class="um-caret" aria-hidden="true" />
    </button>

    <ng-template #menu>
      <hlm-dropdown-menu class="w-64" [style.margin-left.px]="collapsed() ? gap : 0">
        <hlm-dropdown-menu-label class="flex items-center gap-2.5 py-2">
          <!-- The initials are drawn, not written: in the rail the label alone names the button (label in name). -->
      <span class="um-avatar" aria-hidden="true" [attr.data-initials]="persona.initials"></span>
          <span class="min-w-0">
            <span class="text-foreground block truncate text-[13px] font-medium">{{ persona.name }}</span>
            <span class="block truncate text-[12px]">{{ persona.role }} · Arbor Lisbon Chiado</span>
          </span>
        </hlm-dropdown-menu-label>
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem (triggered)="docs.open('index')"><ng-icon name="phosphorBookOpenLight" aria-hidden="true" />Docs</button>
        <button hlmDropdownMenuItem aria-haspopup="dialog" (triggered)="openAppearance()">
          <ng-icon name="phosphorPaletteLight" aria-hidden="true" />Appearance<ng-icon name="phosphorCaretRightLight" class="text-muted-foreground ml-auto" aria-hidden="true" />
        </button>
        <button hlmDropdownMenuItem (triggered)="shortcuts()"><ng-icon name="phosphorKeyboardLight" aria-hidden="true" />Keyboard shortcuts</button>
        <hlm-dropdown-menu-separator />
        <hlm-dropdown-menu-label class="text-[11.5px]">Demo · fictional data</hlm-dropdown-menu-label>
      </hlm-dropdown-menu>
    </ng-template>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="panelOpen()"
      [cdkConnectedOverlayPositions]="positions"
      (attach)="focusFirst()"
      (detach)="panelOpen.set(false)"
      (overlayOutsideClick)="outside($event)"
      (overlayKeydown)="onKey($event)"
    >
      <div
        #panel
        cdkTrapFocus
        role="dialog"
        aria-label="Appearance"
        [id]="panelId"
        class="um-fly bg-popover text-popover-foreground ring-foreground/10 motion-safe:animate-in fade-in-0 slide-in-from-left-1 flex w-[280px] flex-col gap-3 rounded-lg p-3 shadow-md ring-1 duration-100"
      >
        <app-theme-switcher />
        <app-density-switch />
        <div class="border-border/70 border-t pt-2">
          <button type="button" class="um-fly-link text-muted-foreground hover:text-foreground rounded text-[12.5px] underline underline-offset-2" [attr.aria-current]="store.view() === 'theme-lab' ? 'page' : null" (click)="lab()">Theme lab</button>
        </div>
      </div>
    </ng-template>
  `,
})
export class UserMenu {
  /** The sidebar is the icon rail: the avatar alone, with a tooltip. */
  readonly collapsed = input(false);

  protected readonly store = inject(CompassStore);
  protected readonly docs = inject(DocsRouter);
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly persona = PERSONA;
  protected readonly label = `${PERSONA.name}, ${PERSONA.role}`;
  protected readonly gap = RAIL_TIP_GAP;
  protected readonly menuOpen = signal(false);
  protected readonly panelOpen = signal(false);
  protected readonly panelId = `user-appearance-${nextId++}`;
  /** To the right of the sidebar, its foot on the button's foot (the button sits at the bottom of the window). */
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'bottom', offsetX: RAIL_TIP_GAP },
    { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: RAIL_TIP_GAP },
  ];

  constructor() {
    // The button moves when the sidebar collapses or expands: the panel would be left behind, so it closes.
    effect(() => {
      const collapsed = this.collapsed();
      untracked(() => {
        this.panelOpen.set(false);
        this.host.nativeElement.toggleAttribute('data-collapsed', collapsed);
      });
    });
  }

  /** After the menu has closed and handed the focus back to the button. */
  protected openAppearance() {
    setTimeout(() => this.panelOpen.set(true), 0);
  }

  protected shortcuts() {
    this.docs.open('accessibility');
    afterNextRender(() => this.doc.getElementById('keyboard')?.scrollIntoView({ block: 'start' }), { injector: this.injector });
  }

  /** The first stop is the theme that is chosen now. */
  protected focusFirst() {
    afterNextRender(() => this.panel()?.nativeElement.querySelector<HTMLElement>('[role=radio][tabindex="0"]')?.focus(), { injector: this.injector });
  }

  protected onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.closePanel();
  }

  /** A click on the button itself opens the menu; any other click outside closes, and the focus goes where the click went. */
  protected outside(event: MouseEvent) {
    if (!this.trigger().nativeElement.contains(event.target as Node)) this.panelOpen.set(false);
  }

  protected lab() {
    this.closePanel();
    this.store.go('theme-lab');
  }

  private closePanel() {
    this.panelOpen.set(false);
    this.trigger().nativeElement.focus();
  }
}
