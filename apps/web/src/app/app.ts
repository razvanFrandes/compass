import { Component, DOCUMENT, computed, effect, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCompassLight } from '@ng-icons/phosphor-icons/light';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { provideBrnTooltipGroup } from '@spartan-ng/brain/tooltip';
import { BoardView, BoardsList } from './board';
import { InboxView } from './inbox';
import { CompassStore, View } from './store';
import { Theme } from './theme';
import { ThemeSwitcher } from './theme/theme-switcher';
import { ThemeLab } from './theme-lab/theme-lab';
import { ThreadView } from './thread';
import { WatchersView } from './watchers';
import { Live } from './live';
import { WatcherPage } from './watcher-page';
import { WorkflowBuilder } from './builder/builder-page';
import { CompassLogo } from './shell/compass-logo';
import { NotFound } from './not-found';
import { BUILT_IN } from './board';
import { BoardsService } from './boards/boards.service';
import { ScopeSwitcher } from './scope/scope-switcher';
import { OrbLab } from './orb/orb-lab';
import { CatalogView } from './charts/catalog';
import { isActiveNav } from './shell/nav';
import { Sidebar } from './shell/sidebar';
import { RAIL_WIDTH, SIDEBAR_WIDTH, SidebarState } from './shell/sidebar-state';
import * as icons from './icons';

/**
 * Shell. Inbox → Thread → Board maps Juyo's Ask → Analyze → Act:
 * answers come to you, a conversation builds the artifact, boards keep what matters.
 */
@Component({
  selector: 'app-root',
  imports: [NgIcon, BoardView, BoardsList, InboxView, ThreadView, WatchersView, WatcherPage, WorkflowBuilder, CompassLogo, NotFound, ScopeSwitcher, OrbLab, CatalogView, ThemeLab, Sidebar, ThemeSwitcher, HlmButtonImports, HlmToasterImports],
  providers: [provideIcons({ ...icons, phosphorCompassLight }), provideBrnTooltipGroup()],
  host: { class: 'block', '(document:keydown)': 'onKey($event)' },
  styles: `
    /* The sidebar's column: the panel or the rail. The main area follows the change, it does not jump. */
    @media (min-width: 64rem) {
      .shell {
        grid-template-columns: ${SIDEBAR_WIDTH}px minmax(0, 1fr);
        transition: grid-template-columns var(--motion-moderate, 200ms) var(--ease-standard, cubic-bezier(0.2, 0, 0, 1));
      }
      .shell--rail { grid-template-columns: ${RAIL_WIDTH}px minmax(0, 1fr); }
    }
    @media (prefers-reduced-motion: reduce) {
      .shell { transition: none; }
    }
  `,
  template: `
    @if (store.view() === 'builder') {
      <!-- The workflow builder is a full-screen page with its own header and back link; its code loads on first visit -->
      @defer (on immediate) {
        <app-workflow-builder />
      } @placeholder {
        <p class="text-muted-foreground grid min-h-dvh place-items-center text-[14px]">Opening the agent builder…</p>
      }
    } @else if (store.view() === 'orb-lab') {
      <!-- /orb-lab: the demo page for the Kassandra orb; its code loads only there -->
      @defer (on immediate) {
        <app-orb-lab />
      }
    } @else {
    <a href="#content" class="bg-foreground text-background sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>
    <div class="shell lg:grid lg:h-dvh lg:overflow-hidden" [class.shell--rail]="sidebar.collapsed()">
      <!-- Navigation recedes: dimmer surface, light icons, Fill only for the current place. It collapses to a rail of icons (src/app/shell). -->
      <nav appSidebar [items]="nav()"></nav>

      <main id="content" class="min-w-0 max-lg:overflow-x-clip lg:min-h-0" [class]="store.view() === 'thread' ? 'h-dvh' : 'lg:overflow-y-auto'">
        @if (store.view() !== 'thread') {
          <header class="flex h-14 items-center justify-between px-[max(16px,env(safe-area-inset-left,0px))] lg:hidden">
            <div class="flex min-w-0 items-center gap-2">
              <a href="/" class="text-foreground flex shrink-0 items-center" aria-label="Compass, morning brief" (click)="$event.preventDefault(); store.go('inbox')">
                <app-compass-logo [size]="20" />
              </a>
              <span class="text-muted-foreground text-[14px]" aria-hidden="true">/</span>
              <app-scope-switcher />
            </div>
            <app-theme-switcher variant="menu" />
          </header>
        }
        @switch (store.view()) {
          @case ('notfound') {
            <app-not-found />
          }
          @case ('inbox') {
            <app-inbox />
          }
          @case ('thread') {
            <app-thread class="h-full" />
          }
          @case ('boards') {
            <app-boards-list />
          }
          @case ('board') {
            <app-board />
          }
          @case ('watchers') {
            <app-watchers />
          }
          @case ('theme-lab') {
            <!-- The design tokens of every theme, side by side; its code loads on first visit -->
            @defer (on immediate) {
              <app-theme-lab />
            } @placeholder {
              <p class="text-muted-foreground px-page-x pt-section text-[14px]" role="status">Loading the theme lab…</p>
            }
          }
          @case ('watcher') {
            <!-- Loads on first visit: it reads CHECK_LABELS from @compass/contracts, which brings zod -->
            @defer (on immediate) {
              <app-watcher-page />
            } @placeholder {
              <p class="text-muted-foreground px-page-x pt-section text-[14px]" role="status">Loading the agent…</p>
            }
          }
          @case ('catalog') {
            <!-- /catalog: the chart design-system page; its code (and the extra chart types) loads on first visit -->
            @defer (on immediate) {
              <app-catalog />
            } @placeholder {
              <p class="text-muted-foreground px-page-x pt-section text-[14px]" role="status">Loading the chart catalogue…</p>
            }
          }
        }
      </main>
    </div>

    <!-- Phone: bottom tab bar (hidden inside a thread, which has its own back button) -->
    @if (store.view() !== 'thread') {
      <nav class="bg-background/90 border-border/70 fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t pb-[env(safe-area-inset-bottom,0px)] backdrop-blur lg:hidden" aria-label="Main">
        @for (n of nav(); track n.view) {
          <button type="button" class="relative flex flex-col items-center gap-0.5 py-2 text-[12px]" [class]="isActive(n.view) ? 'text-foreground font-medium' : 'text-muted-foreground'" [attr.aria-current]="isActive(n.view) ? 'page' : null" (click)="store.go(n.view)">
            <ng-icon [name]="isActive(n.view) ? n.iconActive : n.icon" class="text-[20px]" />
            {{ n.label }}
            @if (n.count) {
              <span class="bg-(--brass) text-background absolute top-1 left-1/2 ml-2 rounded-full px-1.5 text-[11px] font-semibold tabular-nums">{{ n.count }}</span>
            }
          </button>
        }
      </nav>
    }

    }
    <!-- Toasts sit where no composer is: top on phones (the ask bar and tab bar are at the bottom), bottom right on desktop -->
    <hlm-toaster [theme]="theme.dark() ? 'dark' : 'light'" [position]="phone() ? 'top-center' : 'bottom-right'" [offset]="phone() ? '12px' : '24px'" />
  `,
})
export class App {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  private readonly doc = inject(DOCUMENT);
  protected readonly theme = inject(Theme);
  protected readonly sidebar = inject(SidebarState);
  protected readonly phone = signal(this.doc.defaultView?.matchMedia('(max-width: 1023px)').matches ?? false);

  constructor() {
    effect(() => {
      this.doc.title = pageTitle(this.store.view(), this.live.title(), this.boardName());
    });
  }

  protected readonly nav = computed(() => [
    { view: 'inbox' as View, label: 'Inbox', icon: 'phosphorTrayLight', iconActive: 'phosphorTrayFill', count: this.store.unread() },
    { view: 'boards' as View, label: 'Boards', icon: 'phosphorSquaresFourLight', iconActive: 'phosphorSquaresFourFill', count: 0 },
    { view: 'watchers' as View, label: 'Agent Studio', icon: 'phosphorLightningLight', iconActive: 'phosphorLightningFill', count: this.live.pendingList().length },
  ]);

  protected isActive(v: View) {
    return isActiveNav(this.store.view(), v);
  }

  /** ⌘K / Ctrl+K: ask from anywhere. */
  protected onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.store.go('inbox');
      setTimeout(() => (this.doc.getElementById('global-ask') as HTMLInputElement | null)?.focus(), 30);
    }
  }

  private readonly boards = inject(BoardsService);
  private readonly boardName = computed(() => {
    const id = this.store.activeBoardId();
    return BUILT_IN.find((b) => b.id === id)?.name ?? this.boards.boards().find((b) => b.id === id)?.name ?? 'Board';
  });
}

/** "Morning brief · Compass", "Pace in Lisbon · Kassandra", "Agent Studio · Compass". */
export function pageTitle(view: View, thread: string, board: string): string {
  const cut = (t: string) => (t.length > 60 ? `${t.slice(0, 57)}…` : t);
  switch (view) {
    case 'thread':
      return `${cut(thread)} · Kassandra`;
    case 'boards':
      return 'Boards · Compass';
    case 'board':
      return `${cut(board)} · Compass`;
    case 'watchers':
      return 'Agent Studio · Compass';
    case 'watcher':
      return 'Agent · Agent Studio · Compass';
    case 'builder':
      return 'New agent · Agent Studio · Compass';
    case 'notfound':
      return 'Page not found · Compass';
    case 'orb-lab':
      return 'Kassandra orb · Compass';
    case 'catalog':
      return 'Chart catalogue · Compass';
    case 'theme-lab':
      return 'Theme lab · Compass';
    default:
      return 'Morning brief · Compass';
  }
}
