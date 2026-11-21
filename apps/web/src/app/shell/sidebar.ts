import { Component, DOCUMENT, ElementRef, Injector, ViewEncapsulation, afterNextRender, computed, inject, input, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorBookOpenFill, phosphorSwatchesFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorBookOpenLight, phosphorCompassLight, phosphorInfoLight, phosphorSidebarSimpleLight } from '@ng-icons/phosphor-icons/light';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { GROUP } from '../data';
import * as icons from '../icons';
import { KassandraThreadList } from '../kassandra/kassandra-thread-list';
import { ScopeSwitcher } from '../scope/scope-switcher';
import { DocsRouter } from '../docs/docs-router';
import { CompassStore } from '../store';
import { DensitySwitch } from '../theme/density-switch';
import { ThemeSwitcher } from '../theme/theme-switcher';
import { isActiveNav, type NavItem } from './nav';
import { CompassLogo } from './compass-logo';
import { RailThreads } from './rail-threads';
import { RAIL_TIP_GAP, RAIL_WIDTH, SidebarState, isSidebarShortcut } from './sidebar-state';

/**
 * The main sidebar, on `<nav appSidebar>`. It has two states: the full panel, and a 64 px rail of icons that
 * leaves the room to the page. Every control sits on one vertical axis (32 px from the left edge) in both
 * states, so collapsing wipes the labels away and nothing else moves.
 *
 * The button that switches is at the top, beside the logo, where Linear, Notion, GitHub and Claude have it;
 * in the rail it sits right under the mark, so it stays the second stop in the focus order. "[" and ⌘\ / Ctrl+\
 * do the same from the keyboard.
 *
 * The styles are global (no encapsulation) and all start with `rail`: the Threads button of the rail is another
 * component and shares the item's look. The concept theme reaches the nav through `nav[aria-label='Main']`.
 */
@Component({
  selector: 'nav[appSidebar]',
  imports: [NgIcon, CompassLogo, ScopeSwitcher, KassandraThreadList, RailThreads, ThemeSwitcher, DensitySwitch, HlmTooltipImports],
  providers: [provideIcons({ ...icons, phosphorBookOpenFill, phosphorBookOpenLight, phosphorCompassLight, phosphorInfoLight, phosphorSidebarSimpleLight, phosphorSwatchesFill })],
  encapsulation: ViewEncapsulation.None,
  host: {
    id: 'main-nav',
    'aria-label': 'Main',
    class: 'rail bg-(--rail) border-border/70 hidden min-h-0 flex-col gap-card-pad overflow-hidden border-r px-3 py-4 lg:flex',
    '[attr.data-collapsed]': 'collapsed() ? "" : null',
    '(document:keydown)': 'onKey($event)',
  },
  styles: `
    /* Ink for text on the orange count: it passes 4.5:1 on --brass in all three themes; white does not. */
    .rail { --rail-ink: #0d1117; --rail-hover: rgb(from var(--foreground) r g b / 0.04); --rail-active: rgb(from var(--foreground) r g b / 0.06); }
    .rail[data-collapsed] { --rail-active: rgb(from var(--foreground) r g b / 0.1); }

    .rail-head { display: flex; min-height: 32px; align-items: center; justify-content: space-between; gap: 8px; }
    .rail-logo { display: flex; flex-shrink: 0; align-items: center; padding: 2px 9px; border-radius: 6px; color: var(--foreground); outline: none; }
    .rail-toggle {
      display: grid; flex-shrink: 0; width: 32px; height: 32px; place-items: center; border-radius: 6px; color: var(--muted-foreground); outline: none;
      transition: background-color 150ms ease, color 150ms ease;
    }
    .rail-toggle ng-icon, .rail-icon { flex-shrink: 0; font-size: 18px; }
    .rail[data-collapsed] .rail-head { flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 12px; }
    .rail[data-collapsed] .rail-toggle { width: 100%; }

    /* An item is as wide as the sidebar: 40 px in the rail, where its 18 px icon is centred and the label is cut off. */
    .rail-item {
      position: relative; display: flex; width: 100%; align-items: center; gap: 10px; overflow: hidden; min-height: var(--control-h-sm); padding: 4px 8px 4px 11px;
      color: var(--muted-foreground); text-align: left; white-space: nowrap; outline: none; transition: background-color 150ms ease, color 150ms ease;
    }
    .rail-item--active { background: var(--rail-active); color: var(--foreground); font-weight: 500; }
    .rail-item--current { color: var(--foreground); }
    .rail-label { min-width: 0; flex: 1; transition: opacity 120ms ease; }
    /* A step toward the text colour: --brass-ink alone is 4.3:1 on the current row in the light theme. */
    .rail-count { flex-shrink: 0; color: color-mix(in srgb, var(--brass-ink) 86%, var(--foreground)); font-size: 12px; font-weight: 500; }
    .rail[data-collapsed] .rail-label { opacity: 0; }
    .rail[data-collapsed] .rail-count {
      position: absolute; top: 1px; right: 1px; display: grid; min-width: 16px; height: 16px; padding: 0 4px; place-items: center; border-radius: 9999px;
      background: var(--brass); color: var(--rail-ink); font-size: var(--type-micro-size, 11px); font-weight: 600; line-height: 1; letter-spacing: 0;
      box-shadow: 0 0 0 1.5px var(--rail);
    }
    @media (hover: hover) {
      .rail-item:hover, .rail-toggle:hover { background: var(--rail-hover); color: var(--foreground); }
      .rail-item--active:hover { background: var(--rail-active); }
    }
    .rail-item[aria-expanded='true'] { background: var(--rail-hover); color: var(--foreground); }
    .rail-logo:focus-visible, .rail-toggle:focus-visible, .rail-item:focus-visible { box-shadow: 0 0 0 2px var(--ring); }

    .rail-foot { display: flex; flex-direction: column; gap: 1px; margin-top: auto; }
    .rail-theme { padding: 0 8px 6px; }
    .rail[data-collapsed] .rail-theme { padding: 0 0 6px; justify-content: center; }
    .rail[data-collapsed] .rail-theme > button { width: 100%; }
    .rail-density { padding: 0 8px 6px; }
    .rail[data-collapsed] .rail-density { padding: 0 0 6px; }

    /* The note about the demo data: a paragraph in the panel, a popover beside the rail. */
    .rail-note { padding: 12px 8px 0; color: var(--muted-foreground); }
    .rail-note[popover] {
      position: fixed; inset: auto auto 16px ${RAIL_WIDTH + 8}px; width: 264px; margin: 0; padding: 10px 12px;
      border: 1px solid var(--field-border); border-radius: var(--popover-radius, 10px); background: var(--popover); color: var(--popover-foreground);
      box-shadow: var(--popover-shadow, 0 12px 32px -12px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.16));
    }

    /* The key in the tooltip of the collapse button; the tooltip is drawn outside the nav. */
    .rail-kbd {
      display: inline-grid; min-width: 18px; height: 18px; margin-left: 6px; padding: 0 4px; place-items: center; border-radius: 4px;
      background: rgb(from var(--background) r g b / 0.16); font-family: var(--font-mono); font-size: 11px; line-height: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .rail-toggle, .rail-item, .rail-label { transition: none; }
    }
  `,
  template: `
    <div class="rail-head">
      <a href="/" class="rail-logo" aria-label="Compass, morning brief" (click)="$event.preventDefault(); store.go('inbox')">
        <app-compass-logo [size]="22" [variant]="collapsed() ? 'mark' : 'full'" />
      </a>
      <button
        #toggleButton
        type="button"
        class="rail-toggle"
        aria-controls="main-nav"
        aria-keyshortcuts="[ Control+\\ Meta+\\"
        [attr.aria-label]="toggleLabel()"
        [attr.aria-expanded]="!collapsed()"
        [hlmTooltip]="toggleTip"
        [position]="collapsed() ? 'right' : 'bottom'"
        [sideOffset]="collapsed() ? tipGap : 8"
        (click)="toggle()"
      >
        <ng-icon name="phosphorSidebarSimpleLight" aria-hidden="true" />
      </button>
      <ng-template #toggleTip>{{ toggleLabel() }}<kbd class="rail-kbd">[</kbd></ng-template>
    </div>

    <!-- The scope: which hotels the brief, Kassandra and new agents work on (src/app/scope) -->
    <app-scope-switcher variant="sidebar" [compact]="collapsed()" [group]="group.name" />

    <ul class="flex flex-col gap-px text-[14px]">
      @for (n of items(); track n.view) {
        <li>
          <button
            type="button"
            class="rail-item rounded-md"
            [class.rail-item--active]="isActive(n.view)"
            [attr.aria-current]="isActive(n.view) ? 'page' : null"
            [hlmTooltip]="n.label"
            position="right"
            [sideOffset]="tipGap"
            [tooltipDisabled]="!collapsed()"
            (click)="store.go(n.view)"
          >
            <ng-icon [name]="isActive(n.view) ? n.iconActive : n.icon" class="rail-icon" aria-hidden="true" />
            <span class="rail-label">{{ n.label }}</span>
            @if (n.count) {
              <span class="rail-count tabular-nums">{{ n.count }}</span>
            }
          </button>
        </li>
      }
    </ul>

    <!-- Threads: the list in the panel, one icon with a menu in the rail -->
    @if (collapsed()) {
      <app-rail-threads />
    } @else {
      <kassandra-thread-list />
    }

    <div class="rail-foot text-muted-foreground text-[14px]">
      <!-- Theme and mode (src/app/theme/theme-switcher): two rows in the panel, one button with a menu in the rail -->
      @if (collapsed()) {
        <app-theme-switcher class="rail-theme" variant="menu" side="right" align="end" />
      } @else {
        <app-theme-switcher class="rail-theme" />
      }
      <!-- Comfortable or Compact (src/app/theme/density-switch.ts): beside the theme, and separate from it -->
      <app-density-switch class="rail-density" [collapsed]="collapsed()" [tipGap]="tipGap + 2" />
      @for (n of foot; track n.view) {
        <button
          type="button"
          class="rail-item rounded-md"
          [class.rail-item--active]="isActive(n.view)"
          [attr.aria-current]="isActive(n.view) ? 'page' : null"
          [hlmTooltip]="n.label"
          position="right"
          [sideOffset]="tipGap"
          [tooltipDisabled]="!collapsed()"
          (click)="go(n.view)"
        >
          <ng-icon [name]="isActive(n.view) ? n.iconActive : n.icon" class="rail-icon" aria-hidden="true" />
          <span class="rail-label">{{ n.label }}</span>
        </button>
      }
      @if (collapsed()) {
        <button type="button" class="rail-item rounded-md" popovertarget="rail-note" aria-label="About this demo" hlmTooltip="About this demo" position="right" [sideOffset]="tipGap">
          <ng-icon name="phosphorInfoLight" class="rail-icon" aria-hidden="true" />
        </button>
      }
      <p id="rail-note" class="rail-note text-[12px]/relaxed" [attr.popover]="collapsed() ? 'auto' : null">Halcyon Hospitality is a fictional group. All figures are generated, as of Fri 20 Nov 2026.</p>
    </div>
  `,
})
export class Sidebar {
  /** Inbox, Boards, Agent Studio: the same items as the phone's menu. */
  readonly items = input.required<readonly NavItem[]>();

  protected readonly store = inject(CompassStore);
  private readonly docs = inject(DocsRouter);
  private readonly state = inject(SidebarState);
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly toggleButton = viewChild.required<ElementRef<HTMLButtonElement>>('toggleButton');

  protected readonly group = GROUP;
  protected readonly collapsed = this.state.collapsed;
  /** A tooltip starts 6 px outside the rail: the item ends 12 px before the rail's edge. */
  protected readonly tipGap = RAIL_TIP_GAP;
  protected readonly toggleLabel = computed(() => (this.collapsed() ? 'Expand sidebar' : 'Collapse sidebar'));

  /** The links at the foot, above the note: the theme lab and the docs hub (src/app/docs). In the panel and in the rail. */
  protected readonly foot: readonly NavItem[] = [
    { view: 'theme-lab', label: 'Theme lab', icon: 'phosphorSwatchesLight', iconActive: 'phosphorSwatchesFill', count: 0 },
    { view: 'docs', label: 'Docs', icon: 'phosphorBookOpenLight', iconActive: 'phosphorBookOpenFill', count: 0 },
  ];

  /** The docs hub keeps its own page and address (DocsRouter); every other place is the store's. */
  protected go(view: NavItem['view']) {
    if (view === 'docs') this.docs.open('index');
    else this.store.go(view);
  }

  protected isActive(view: NavItem['view']) {
    return isActiveNav(this.store.view(), view);
  }

  protected toggle() {
    const nav = this.host.nativeElement;
    const hadFocus = nav.contains(this.doc.activeElement);
    // The button moves when the state changes, and its tooltip would be left behind. The tooltip has no "hide"
    // of its own, but it closes when its button loses the focus: it is told so, and the focus stays where it is.
    this.toggleButton().nativeElement.dispatchEvent(new FocusEvent('blur'));
    this.state.toggle();
    // The thread list and the rail's own buttons come and go with the state: if the focus was on one of them,
    // it moves to the button that switches, not to the top of the page.
    if (hadFocus) {
      afterNextRender(
        () => {
          if (!nav.contains(this.doc.activeElement)) this.toggleButton().nativeElement.focus();
        },
        { injector: this.injector },
      );
    }
  }

  /** "[" and ⌘\ / Ctrl+\. Not on a phone, and not while a modal dialog (the hotel picker, a sheet) has the keyboard. */
  protected onKey(event: KeyboardEvent) {
    if (!this.state.available() || !isSidebarShortcut(event) || this.modalOpen()) return;
    event.preventDefault();
    this.toggle();
  }

  /** Where the engine has no modal dialogs (or no `:modal`), the pickers open as plain ones: any open dialog counts. */
  private modalOpen(): boolean {
    return [...this.doc.querySelectorAll('dialog[open]')].some((dialog) => {
      try {
        return typeof (dialog as HTMLDialogElement).showModal !== 'function' || dialog.matches(':modal');
      } catch {
        return true;
      }
    });
  }
}
