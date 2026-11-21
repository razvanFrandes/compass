import { Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorBookOpenFill, phosphorSwatchesFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorBookOpenLight, phosphorBuildingsLight, phosphorChartBarLight, phosphorChatTextLight, phosphorTableLight } from '@ng-icons/phosphor-icons/light';
import { DocsRouter } from '../docs/docs-router';
import { GROUP } from '../data';
import * as icons from '../icons';
import { Live } from '../live';
import { ScopeSwitcher } from '../scope/scope-switcher';
import { CompassStore } from '../store';
import { AppearanceControls } from './appearance-controls';
import { CompassLogo } from './compass-logo';
import { threadIcon } from './conversation-groups';
import { PERSONA } from './user-menu';
import { isActiveNav, type NavItem } from './nav';
import { SidebarState } from './sidebar-state';

let nextId = 0;

/**
 * The phone's navigation: one "Menu" button for the header, and the sheet it opens from the right edge.
 *
 * A phone has no tab bar: the bottom of the screen belongs to Kassandra's ask bar, and nothing that can be tapped
 * sits under it. Everything the desktop sidebar holds is in the sheet instead, top to bottom: the logo, the hotel
 * scope, Inbox / Boards / Agent Studio with what waits there, the recent conversations (title and takeaway), the
 * secondary links, and at the foot the person (the same persona as the desktop's user menu) with the appearance controls. The button carries a dot while anything waits.
 *
 * The sheet is a native modal `<dialog>`: the browser keeps the focus inside it, closes it on Esc and on Android's
 * back, and gives the focus back to the button. A tap on the scrim closes it too. Picking a place closes it first.
 * The hotel picker opens above it as its own dialog, and the sheet is still there when the picker is done.
 */
@Component({
  selector: 'app-mobile-menu',
  imports: [NgIcon, CompassLogo, ScopeSwitcher, AppearanceControls],
  providers: [provideIcons({ ...icons, phosphorBookOpenFill, phosphorBookOpenLight, phosphorSwatchesFill, phosphorBuildingsLight, phosphorChartBarLight, phosphorChatTextLight, phosphorTableLight })],
  host: { class: 'block shrink-0' },
  styles: `
    /* Ink for text on the orange count: it passes 4.5:1 on --brass in every theme; white does not. */
    .mm-trigger, .mm-sheet { --mm-ink: #0d1117; --mm-current: rgb(from var(--foreground) r g b / 0.08); }

    .mm-trigger {
      position: relative; display: grid; width: 44px; height: 44px; place-items: center; border-radius: var(--radius-control, 10px);
      color: var(--foreground); outline: none; transition: background-color 150ms ease;
    }
    .mm-trigger ng-icon { font-size: 22px; }
    .mm-dot { position: absolute; top: 9px; right: 8px; width: 9px; height: 9px; border-radius: 9999px; background: var(--brass); box-shadow: 0 0 0 2px var(--background); }

    /* Closed, the dialog is display: none. Open, it slides in from the right; closing plays the same way back. */
    .mm-sheet {
      position: fixed; inset: 0 0 0 auto; margin: 0; padding: 0; overflow: hidden; flex-direction: column;
      width: min(360px, calc(100vw - 48px)); max-width: none; height: 100dvh; max-height: none;
      border: 0; border-left: 1px solid var(--border); background: var(--rail, var(--background)); color: var(--foreground);
      box-shadow: -28px 0 64px -24px rgb(0 0 0 / 0.55);
      transform: translateX(100%);
      transition: transform 200ms cubic-bezier(0.4, 0, 1, 1), overlay 200ms allow-discrete, display 200ms allow-discrete;
    }
    .mm-sheet[open] { display: flex; transform: none; transition-duration: 320ms; transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1); }
    .mm-sheet::backdrop {
      background: rgb(0 0 0 / 0); transition: background-color 200ms ease, overlay 200ms allow-discrete, display 200ms allow-discrete;
    }
    .mm-sheet[open]::backdrop { background: var(--scrim, rgb(0 0 0 / 0.55)); transition-duration: 320ms; }
    @starting-style {
      .mm-sheet[open] { transform: translateX(100%); }
      .mm-sheet[open]::backdrop { background: rgb(0 0 0 / 0); }
    }

    /* The sheet touches the top, right and bottom edges of the screen: each part keeps clear of its safe area. */
    .mm-head {
      display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 12px;
      padding: max(8px, env(safe-area-inset-top, 0px)) max(8px, env(safe-area-inset-right, 0px)) 8px 20px;
    }
    .mm-close {
      display: grid; width: 44px; height: 44px; flex-shrink: 0; place-items: center; border-radius: var(--radius-control, 10px);
      color: var(--muted-foreground); outline: none; transition: background-color 150ms ease, color 150ms ease;
    }
    .mm-close ng-icon { font-size: 20px; }

    .mm-body {
      display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 22px; overflow-y: auto; overscroll-behavior: contain;
      padding: 8px max(12px, env(safe-area-inset-right, 0px)) 20px 12px;
    }
    .mm-scope { padding: 3px; border: 1px solid var(--field-border); border-radius: var(--radius-container, 12px); background: rgb(from var(--foreground) r g b / 0.03); }
    .mm-list { display: flex; flex-direction: column; gap: 2px; }
    .mm-heading { padding: 0 12px 6px; color: var(--muted-foreground); font-size: 13px; font-weight: 500; }

    /* A place: 48 px tall, the whole row is the target. */
    .mm-item {
      display: flex; width: 100%; min-height: 48px; align-items: center; gap: 14px; padding: 0 12px; border-radius: var(--nav-item-radius, 10px);
      color: var(--foreground); font-size: 16px; text-align: left; outline: none; transition: background-color 150ms ease;
    }
    .mm-item ng-icon { flex-shrink: 0; color: var(--muted-foreground); font-size: 22px; }
    .mm-item[aria-current='page'] { background: var(--mm-current); font-weight: 500; }
    .mm-item[aria-current='page'] ng-icon { color: var(--foreground); }
    .mm-label { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* What waits there: a small, quiet pill in the row's own text colour. */
    .mm-count {
      display: grid; min-width: 24px; height: 22px; flex-shrink: 0; padding: 0 8px; place-items: center; border-radius: 9999px;
      background: rgb(from var(--foreground) r g b / 0.08); color: var(--foreground); font-size: 12.5px; font-weight: 500; line-height: 1; font-variant-numeric: tabular-nums;
    }
    /* Quieter rows: a conversation, a secondary link. Still 44 px. */
    .mm-item--quiet { min-height: 44px; color: var(--muted-foreground); font-size: 15px; }
    /* A smaller icon in the same 22 px column, so every label of the sheet starts on one line. */
    .mm-item--quiet ng-icon { width: 22px; font-size: 20px; }
    .mm-item--quiet[aria-current='page'] { color: var(--foreground); }
    /* A conversation: its title, and the takeaway of its answer under it. */
    .mm-item--thread { align-items: flex-start; padding-top: 9px; padding-bottom: 9px; }
    .mm-thread-text { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
    .mm-thread-text .mm-label { color: var(--foreground); }
    .mm-summary { overflow: hidden; color: var(--muted-foreground); font-size: 13.5px; text-overflow: ellipsis; white-space: nowrap; }
    .mm-user { display: flex; align-items: center; gap: 12px; padding: 0 4px; }
    .mm-avatar {
      display: grid; width: 36px; height: 36px; flex-shrink: 0; place-items: center; border-radius: 9999px;
      background: color-mix(in oklab, var(--brand, var(--primary)) 22%, var(--card, var(--background)));
      box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--brand, var(--primary)) 40%, transparent);
      color: var(--foreground); font-size: 13px; font-weight: 600;
    }

    .mm-foot {
      display: flex; flex-shrink: 0; flex-direction: column; gap: 12px; border-top: 1px solid var(--border);
      padding: 14px max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) 16px;
    }

    .mm-trigger:focus-visible, .mm-close:focus-visible, .mm-item:focus-visible { box-shadow: 0 0 0 2px var(--ring); }
    .mm-trigger:active, .mm-close:active, .mm-item:active { background: var(--overlay-pressed, rgb(from var(--foreground) r g b / 0.1)); }
    @media (hover: hover) {
      .mm-trigger:hover, .mm-close:hover, .mm-item:hover { background: var(--overlay-hover); }
      .mm-close:hover, .mm-item--quiet:hover { color: var(--foreground); }
      .mm-item[aria-current='page']:hover { background: var(--mm-current); }
    }

    /* A phone on its side: nothing is pinned, the whole sheet scrolls. */
    @media (max-height: 560px) {
      .mm-sheet[open] { display: block; overflow-y: auto; overscroll-behavior: contain; }
      .mm-body { overflow: visible; }
    }
    @media (prefers-reduced-motion: reduce) {
      .mm-sheet, .mm-sheet[open], .mm-sheet::backdrop, .mm-sheet[open]::backdrop, .mm-trigger, .mm-close, .mm-item { transition: none; }
    }
  `,
  template: `
    <button
      #trigger
      type="button"
      class="mm-trigger"
      aria-label="Menu"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="uid"
      [attr.aria-describedby]="waiting() ? uid + '-waiting' : null"
      (click)="show()"
    >
      <ng-icon name="phosphorListLight" aria-hidden="true" />
      @if (waiting()) {
        <!-- The dot is for the eye; the sentence beside it is what a screen reader hears after "Menu". -->
        <span class="mm-dot" aria-hidden="true"></span>
        <span class="sr-only" [id]="uid + '-waiting'">{{ waiting() }}</span>
      }
    </button>

    <!-- data-surface="inverse": in the Juyo concept theme the sheet is the night surface, like the sidebar. -->
    <dialog #sheet class="mm-sheet" data-surface="inverse" aria-label="Menu" [id]="uid" (close)="settle()" (click)="dismiss($event)">
      <div class="mm-head">
        <app-compass-logo variant="full" [size]="22" />
        <button #closeButton type="button" class="mm-close" aria-label="Close menu" (click)="close()">
          <ng-icon name="phosphorXLight" aria-hidden="true" />
        </button>
      </div>

      <div class="mm-body">
        <!-- The scope: which hotels the brief, Kassandra and new agents work on (src/app/scope) -->
        <div class="mm-scope">
          <app-scope-switcher variant="sidebar" [group]="group.name" />
        </div>

        <nav aria-label="Main">
          <ul class="mm-list">
            @for (n of items(); track n.view) {
              <li>
                <button type="button" class="mm-item" [attr.aria-current]="isActive(n.view) ? 'page' : null" (click)="go(n.view)">
                  <ng-icon [name]="isActive(n.view) ? n.iconActive : n.icon" aria-hidden="true" />
                  <span class="mm-label">{{ n.label }}</span>
                  @if (n.count) {
                    <span class="mm-count"><span class="sr-only">, </span>{{ n.count }}<span class="sr-only"> waiting</span></span>
                  }
                </button>
              </li>
            }
          </ul>
        </nav>

        @if (threads().length) {
          <section [attr.aria-labelledby]="uid + '-threads'">
            <h2 class="mm-heading" [id]="uid + '-threads'">Recent</h2>
            <ul class="mm-list">
              @for (t of threads(); track t.id) {
                <li>
                  <button type="button" class="mm-item mm-item--quiet mm-item--thread" [attr.aria-current]="isCurrentThread(t.id) ? 'page' : null" (click)="openThread(t.id)">
                    <ng-icon [name]="t.icon" aria-hidden="true" />
                    <span class="mm-thread-text">
                      <span class="mm-label">{{ t.title }}</span>
                      @if (t.summary) {
                        <span class="mm-summary"><span class="sr-only">. </span>{{ t.summary }}</span>
                      }
                    </span>
                  </button>
                </li>
              }
            </ul>
          </section>
        }

        <section [attr.aria-labelledby]="uid + '-more'">
          <h2 class="mm-heading" [id]="uid + '-more'">More</h2>
          <ul class="mm-list">
            @for (n of more; track n.view) {
              <li>
                <button type="button" class="mm-item mm-item--quiet" [attr.aria-current]="isActive(n.view) ? 'page' : null" (click)="go(n.view)">
                  <ng-icon [name]="isActive(n.view) ? n.iconActive : n.icon" aria-hidden="true" />
                  <span class="mm-label">{{ n.label }}</span>
                </button>
              </li>
            }
          </ul>
        </section>
      </div>

      <div class="mm-foot">
        <!-- The person, as on the desktop's user menu. There is no sign-in: the data and the team are fictional. -->
        <div class="mm-user">
          <span class="mm-avatar" aria-hidden="true">{{ persona.initials }}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[15px] font-medium">{{ persona.name }}</span>
            <span class="text-muted-foreground block truncate text-[13.5px]">{{ persona.role }}</span>
          </span>
          <span class="text-muted-foreground shrink-0 text-[12.5px]">Demo · fictional data</span>
        </div>
        <app-appearance-controls />
      </div>
    </dialog>
  `,
})
export class MobileMenu {
  /** Inbox, Boards, Agent Studio: the same items as the desktop sidebar. */
  readonly items = input.required<readonly NavItem[]>();
  /** How many conversations to list: the most recent ones. */
  readonly threadLimit = input(5);

  private readonly store = inject(CompassStore);
  private readonly live = inject(Live);
  private readonly sidebar = inject(SidebarState);
  private readonly docs = inject(DocsRouter);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly sheet = viewChild.required<ElementRef<HTMLDialogElement>>('sheet');
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');

  protected readonly uid = `mobile-menu-${nextId++}`;
  protected readonly group = GROUP;
  protected readonly open = signal(false);
  protected readonly persona = PERSONA;

  /** The secondary links, under the conversations: the docs hub first, then the theme lab. */
  protected readonly more: readonly NavItem[] = [
    { view: 'docs', label: 'Docs', icon: 'phosphorBookOpenLight', iconActive: 'phosphorBookOpenFill', count: 0 },
    { view: 'theme-lab', label: 'Theme lab', icon: 'phosphorSwatchesLight', iconActive: 'phosphorSwatchesFill', count: 0 },
  ];

  /** What waits, for the dot on the button: "6 in Inbox, 1 in Agent Studio". Empty when nothing does. */
  protected readonly waiting = computed(() => {
    const parts = this.items()
      .filter((item) => item.count > 0)
      .map((item) => `${item.count} in ${item.label}`);
    return parts.length ? `${parts.join(', ')} waiting` : '';
  });

  protected readonly threads = computed(() =>
    this.live
      .conversations()
      .slice(0, this.threadLimit())
      .map((c) => ({ ...c, icon: threadIcon(c) })),
  );

  constructor() {
    // The menu is the phone's. If the window grows into the desktop layout while it is open (a tablet turned on
    // its side), the sidebar takes over and the sheet goes.
    effect(() => {
      if (this.sidebar.available()) untracked(() => this.close());
    });
  }

  protected isActive(view: NavItem['view']) {
    return isActiveNav(this.store.view(), view);
  }

  protected isCurrentThread(id: string) {
    return this.store.view() === 'thread' && this.live.chat.conversation() === id;
  }

  protected show() {
    const dialog = this.sheet().nativeElement;
    if (this.isOpen(dialog)) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    this.open.set(true);
    // The first stop is the way out; the scope and the places follow in reading order.
    this.closeButton().nativeElement.focus();
  }

  protected close() {
    const dialog = this.sheet().nativeElement;
    if (!this.isOpen(dialog)) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    this.settle();
  }

  /** After any way of closing: the button, Esc, Android's back, the scrim, a place picked. */
  protected settle() {
    if (!this.open()) return;
    this.open.set(false);
    // A modal dialog hands the focus back on its own. Where the engine has none, or the focus was left on the page
    // behind, it goes to the button that opened the sheet.
    const trigger = this.trigger().nativeElement;
    const active = trigger.ownerDocument.activeElement;
    if (!active || active === trigger.ownerDocument.body || this.sheet().nativeElement.contains(active)) trigger.focus();
  }

  protected go(view: NavItem['view']) {
    this.close();
    // The docs hub keeps its own page and address (DocsRouter); every other place is the store's.
    if (view === 'docs') this.docs.open('index');
    else this.store.go(view);
  }

  protected openThread(id: string) {
    this.close();
    this.live.openConversation(id);
  }

  /** A tap outside the sheet lands on the dialog's backdrop, which belongs to the dialog element. */
  protected dismiss(event: MouseEvent) {
    const dialog = this.sheet().nativeElement;
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) this.close();
  }

  private isOpen(dialog: HTMLDialogElement) {
    return dialog.open || dialog.hasAttribute('open');
  }
}
