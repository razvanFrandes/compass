import { Component, DOCUMENT, computed, effect, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
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
import { JuyoLogo } from './juyo-logo';
import { NotFound } from './not-found';
import { BUILT_IN } from './board';
import { BoardsService } from './boards/boards.service';
import { ScopeSwitcher } from './scope/scope-switcher';
import { OrbLab } from './orb/orb-lab';
import { CatalogView } from './charts/catalog';
import { GROUP } from './data';
import { KassandraThreadList } from './kassandra/kassandra-thread-list';
import * as icons from './icons';

/**
 * Shell. Inbox → Thread → Board maps Juyo's Ask → Analyze → Act:
 * answers come to you, a conversation builds the artifact, boards keep what matters.
 */
@Component({
  selector: 'app-root',
  imports: [NgIcon, BoardView, BoardsList, InboxView, ThreadView, WatchersView, WatcherPage, WorkflowBuilder, JuyoLogo, NotFound, ScopeSwitcher, OrbLab, CatalogView, ThemeLab, KassandraThreadList, ThemeSwitcher, HlmToasterImports],
  providers: [provideIcons({ ...icons }), provideBrnTooltipGroup()],
  host: { class: 'block', '(document:keydown)': 'onKey($event)' },
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
    <div class="lg:grid lg:h-dvh lg:grid-cols-[232px_minmax(0,1fr)] lg:overflow-hidden">
      <!-- Navigation recedes: dimmer surface, light icons, Fill only for the current place -->
      <nav class="bg-(--rail) border-border/70 hidden min-h-0 flex-col gap-5 border-r px-3 py-4 lg:flex" aria-label="Main">
        <a href="/" class="text-foreground flex items-center px-2 py-0.5" aria-label="Juyo, morning brief" (click)="$event.preventDefault(); store.go('inbox')">
          <app-juyo-logo [size]="22" />
        </a>

        <!-- The scope: which hotels the brief, Kassandra and new workflows work on (src/app/scope) -->
        <app-scope-switcher variant="sidebar" [group]="group.name" />

        <ul class="flex flex-col gap-px text-[14px]">
          @for (n of nav(); track n.view) {
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors"
                [class]="isActive(n.view) ? 'bg-foreground/6 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/4'"
                [attr.aria-current]="isActive(n.view) ? 'page' : null"
                (click)="store.go(n.view)"
              >
                <ng-icon [name]="isActive(n.view) ? n.iconActive : n.icon" class="text-[16px]" />
                <span class="flex-1 text-left">{{ n.label }}</span>
                @if (n.count) {
                  <span class="text-(--brass-ink) text-[12px] font-medium tabular-nums">{{ n.count }}</span>
                }
              </button>
            </li>
          }
        </ul>

        <kassandra-thread-list />

        <div class="text-muted-foreground mt-auto flex flex-col gap-px text-[14px]">
          <!-- Theme and mode: src/app/theme/theme-switcher (variant="menu" is its one-button shape) -->
          <app-theme-switcher class="px-2 pb-1.5" />
          <button type="button" class="flex items-center gap-2.5 rounded-md px-2 py-1.5" [class]="store.view() === 'theme-lab' ? 'bg-foreground/6 text-foreground font-medium' : 'hover:text-foreground hover:bg-foreground/4'" [attr.aria-current]="store.view() === 'theme-lab' ? 'page' : null" (click)="store.go('theme-lab')"><ng-icon name="phosphorSwatchesLight" class="text-[16px]" />Theme lab</button>
          <p class="px-2 pt-3 text-[12px]/relaxed">Halcyon Hospitality is a fictional group with generated data. Business date Fri 20 Nov 2026.</p>
        </div>
      </nav>

      <main id="content" class="min-w-0 max-lg:overflow-x-clip lg:min-h-0" [class]="store.view() === 'thread' ? 'h-dvh' : 'lg:overflow-y-auto'">
        @if (store.view() !== 'thread') {
          <header class="flex h-14 items-center justify-between px-[max(16px,env(safe-area-inset-left,0px))] lg:hidden">
            <div class="flex min-w-0 items-center gap-2">
              <a href="/" class="text-foreground flex shrink-0 items-center" aria-label="Juyo, morning brief" (click)="$event.preventDefault(); store.go('inbox')">
                <app-juyo-logo [size]="20" />
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
              <p class="text-muted-foreground px-8 pt-8 text-[14px]" role="status">Loading…</p>
            }
          }
          @case ('watcher') {
            <!-- Loads on first visit: it reads CHECK_LABELS from @compass/contracts, which brings zod -->
            @defer (on immediate) {
              <app-watcher-page />
            } @placeholder {
              <p class="text-muted-foreground px-8 pt-8 text-[14px]" role="status">Loading…</p>
            }
          }
          @case ('catalog') {
            <!-- /catalog: the chart design-system page; its code (and the extra chart types) loads on first visit -->
            @defer (on immediate) {
              <app-catalog />
            } @placeholder {
              <p class="text-muted-foreground px-8 pt-8 text-[14px]" role="status">Loading…</p>
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
  protected readonly group = GROUP;
  protected readonly theme = inject(Theme);
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
    const cur = this.store.view();
    return cur === v || (v === 'inbox' && cur === 'thread') || (v === 'boards' && cur === 'board') || (v === 'watchers' && cur === 'watcher');
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

/** "Morning brief · Juyo", "Pace in Lisbon · Kassandra", "Agent Studio · Juyo". */
export function pageTitle(view: View, thread: string, board: string): string {
  const cut = (t: string) => (t.length > 60 ? `${t.slice(0, 57)}…` : t);
  switch (view) {
    case 'thread':
      return `${cut(thread)} · Kassandra`;
    case 'boards':
      return 'Boards · Juyo';
    case 'board':
      return `${cut(board)} · Juyo`;
    case 'watchers':
      return 'Agent Studio · Juyo';
    case 'watcher':
      return 'Agent · Agent Studio · Juyo';
    case 'builder':
      return 'New agent · Agent Studio · Juyo';
    case 'notfound':
      return 'Not found · Juyo';
    case 'orb-lab':
      return 'Kassandra orb · Juyo';
    case 'catalog':
      return 'Chart catalogue · Juyo';
    case 'theme-lab':
      return 'Theme lab · Juyo';
    default:
      return 'Morning brief · Juyo';
  }
}
