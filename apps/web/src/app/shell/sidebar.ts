import { Component, DOCUMENT, ElementRef, Injector, ViewEncapsulation, afterNextRender, computed, inject, input, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorSidebarSimpleLight } from '@ng-icons/phosphor-icons/light';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { GROUP } from '../data';
import * as icons from '../icons';
import { KassandraThreadList } from '../kassandra/kassandra-thread-list';
import { ScopeSwitcher } from '../scope/scope-switcher';
import { CompassStore } from '../store';
import { isActiveNav, type NavItem } from './nav';
import { CompassLogo } from './compass-logo';
import { RailThreads } from './rail-threads';
import { UserMenu } from './user-menu';
import { RAIL_TIP_GAP, SidebarState, isSidebarShortcut } from './sidebar-state';

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
  imports: [NgIcon, CompassLogo, ScopeSwitcher, KassandraThreadList, RailThreads, UserMenu, HlmTooltipImports],
  providers: [provideIcons({ ...icons, phosphorSidebarSimpleLight })],
  encapsulation: ViewEncapsulation.None,
  host: {
    id: 'main-nav',
    'aria-label': 'Main',
    class: 'rail bg-(--rail) border-border/70 hidden min-h-0 flex-col gap-card-pad overflow-hidden border-r px-3 py-4 lg:flex',
    '[attr.data-collapsed]': 'collapsed() ? "" : null',
    '(document:keydown)': 'onKey($event)',
  },
  styles: `
    /* Ink for text on the orange dot of the rail: it passes 4.5:1 on --brass in all three themes; white does not. */
    .rail { --rail-ink: #0d1117; --rail-hover: rgb(from var(--foreground) r g b / 0.045); --rail-active: rgb(from var(--foreground) r g b / 0.075); }
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
    /* What waits there: a small, quiet pill. The text is the row's own colour, so it holds 4.5:1 in every theme. */
    .rail-count {
      display: grid; flex-shrink: 0; min-width: 20px; height: 18px; padding: 0 6px; place-items: center; border-radius: 9999px;
      background: rgb(from var(--foreground) r g b / 0.075); color: var(--foreground); font-size: 11px; font-weight: 500; line-height: 1; letter-spacing: 0.01em;
    }
    .rail-item--active .rail-count { background: rgb(from var(--foreground) r g b / 0.1); }
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

    /* Navigation, then Recent (it takes the room and scrolls), then the person, pinned at the bottom. */
    .rail-nav { display: flex; flex-direction: column; gap: 2px; }
    .rail-recent { display: flex; min-height: 0; flex: 1; flex-direction: column; margin-top: 10px; }
    .rail[data-collapsed] .rail-recent { margin-top: 0; }
    .rail-foot { margin: 0 -4px; padding-top: 10px; border-top: 1px solid rgb(from var(--foreground) r g b / 0.08); }

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

    <ul class="rail-nav text-[14px]">
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
              <span class="rail-count tabular-nums"><span class="sr-only">, </span>{{ n.count }}<span class="sr-only"> waiting</span></span>
            }
          </button>
        </li>
      }
    </ul>

    <!-- Recent conversations: the list in the panel, one icon with a menu in the rail -->
    <div class="rail-recent">
      @if (collapsed()) {
        <app-rail-threads />
      } @else {
        <kassandra-thread-list />
      }
    </div>

    <!-- The person: Docs, Appearance, Keyboard shortcuts (user-menu.ts) -->
    <div class="rail-foot">
      <app-user-menu [collapsed]="collapsed()" />
    </div>
  `,
})
export class Sidebar {
  /** Inbox, Boards, Agent Studio: the same items as the phone's menu. */
  readonly items = input.required<readonly NavItem[]>();

  protected readonly store = inject(CompassStore);
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
