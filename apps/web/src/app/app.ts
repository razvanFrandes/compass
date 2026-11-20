import { Component, DOCUMENT, computed, effect, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { provideBrnTooltipGroup } from '@spartan-ng/brain/tooltip';
import { BoardView, BoardsList } from './board';
import { InboxView } from './inbox';
import { CompassStore, View } from './store';
import { ThreadView } from './thread';
import { WatchersView } from './watchers';
import { Live } from './live';
import { WatcherPage } from './watcher-page';
import { WorkflowBuilder } from './builder/builder-page';
import { JuyoLogo } from './juyo-logo';
import { NotFound } from './not-found';
import { BUILT_IN } from './board';
import { BoardsService } from './boards/boards.service';
import { GROUP } from './data';
import * as icons from './icons';

/**
 * Shell. Inbox → Thread → Board maps Juyo's Ask → Analyze → Act:
 * answers come to you, a conversation builds the artifact, boards keep what matters.
 */
@Component({
  selector: 'app-root',
  imports: [NgIcon, BoardView, BoardsList, InboxView, ThreadView, WatchersView, WatcherPage, WorkflowBuilder, JuyoLogo, NotFound, HlmButtonImports, HlmToasterImports, HlmTooltipImports],
  providers: [provideIcons({ ...icons }), provideBrnTooltipGroup()],
  host: { class: 'block', '(document:keydown)': 'onKey($event)' },
  template: `
    @if (store.view() === 'builder') {
      <!-- The workflow builder is a full-screen page with its own header and back link; its code loads on first visit -->
      @defer (on immediate) {
        <app-workflow-builder />
      } @placeholder {
        <p class="text-muted-foreground grid min-h-dvh place-items-center text-[14px]">Opening the workflow builder…</p>
      }
    } @else {
    <a href="#content" class="bg-foreground text-background sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>
    <div class="lg:grid lg:h-dvh lg:grid-cols-[232px_minmax(0,1fr)] lg:overflow-hidden">
      <!-- Navigation recedes: dimmer surface, light icons, Fill only for the current place -->
      <nav class="bg-(--rail) border-border/70 hidden min-h-0 flex-col gap-5 border-r px-3 py-4 lg:flex" aria-label="Main">
        <a href="/" class="text-foreground flex items-center px-2 py-0.5" aria-label="Juyo, morning brief" (click)="$event.preventDefault(); store.go('inbox')">
          <app-juyo-logo [size]="22" />
        </a>

        <button type="button" aria-disabled="true" hlmTooltip="Coming soon: switch between hotel groups" aria-describedby="soon-note" class="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2 py-1.5 text-left">
          <span class="bg-foreground/90 text-background grid size-7 place-items-center rounded-md text-[12px] font-semibold">H</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-medium">{{ group.name }}</span>
            <span class="text-muted-foreground block truncate text-[12px]">All {{ group.hotels }} hotels</span>
          </span>
          <ng-icon name="phosphorCaretUpDownLight" class="text-muted-foreground opacity-50" />
        </button>

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

        @if (live.conversations().length) {
          <div class="flex min-h-0 flex-col gap-1">
            <p class="text-muted-foreground px-2 text-[12px] font-medium tracking-[0.04em] uppercase">Threads</p>
            <ul class="flex min-h-0 flex-col gap-px overflow-y-auto text-[13px]">
              @for (t of live.conversations().slice(0, 8); track t.id) {
                <li>
                  <button type="button" class="block w-full truncate rounded-md px-2 py-1 text-left transition-colors" [class]="store.view() === 'thread' && live.chat.conversation() === t.id ? 'bg-foreground/6 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/4'" (click)="live.openConversation(t.id)">{{ t.title }}</button>
                </li>
              }
            </ul>
          </div>
        }

        <div class="text-muted-foreground mt-auto flex flex-col gap-px text-[14px]">
          <button type="button" class="hover:text-foreground hover:bg-foreground/4 flex items-center gap-2.5 rounded-md px-2 py-1.5" (click)="toggleTheme()">
            <ng-icon [name]="dark() ? 'phosphorSunLight' : 'phosphorMoonLight'" class="text-[16px]" />{{ dark() ? 'Light theme' : 'Dark theme' }}
          </button>
          <span id="soon-note" class="sr-only">Coming soon</span>
          <p class="px-2 pt-3 text-[12px]/relaxed">Halcyon Hospitality is a fictional group with generated data. Business date Fri 20 Nov 2026.</p>
        </div>
      </nav>

      <main id="content" class="min-w-0 max-lg:overflow-x-clip lg:min-h-0" [class]="store.view() === 'thread' ? 'h-dvh' : 'lg:overflow-y-auto'">
        @if (store.view() !== 'thread') {
          <header class="flex h-14 items-center justify-between px-[max(16px,env(safe-area-inset-left,0px))] lg:hidden">
            <a href="/" class="text-foreground flex items-center gap-2" aria-label="Juyo, morning brief" (click)="$event.preventDefault(); store.go('inbox')">
              <app-juyo-logo [size]="20" />
              <span class="text-muted-foreground text-[14px]">/ Halcyon</span>
            </a>
            <button hlmBtn variant="ghost" size="icon" [attr.aria-label]="dark() ? 'Switch to light theme' : 'Switch to dark theme'" (click)="toggleTheme()"><ng-icon [name]="dark() ? 'phosphorSunLight' : 'phosphorMoonLight'" /></button>
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
          @case ('watcher') {
            <!-- Loads on first visit: it reads CHECK_LABELS from @compass/contracts, which brings zod -->
            @defer (on immediate) {
              <app-watcher-page />
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
    <hlm-toaster [theme]="dark() ? 'dark' : 'light'" [position]="phone() ? 'top-center' : 'bottom-right'" [offset]="phone() ? '12px' : '24px'" />
  `,
})
export class App {
  protected readonly store = inject(CompassStore);
  protected readonly live = inject(Live);
  private readonly doc = inject(DOCUMENT);
  protected readonly group = GROUP;
  protected readonly dark = signal(this.doc.documentElement.classList.contains('dark'));
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

  /** The choice is remembered (the theme script in index.html reads it first, then the OS setting). */
  protected toggleTheme() {
    const next = this.dark() ? 'light' : 'dark';
    this.doc.documentElement.dataset['theme'] = next;
    this.dark.set(next === 'dark');
    try {
      localStorage.setItem('compass.theme', next);
    } catch {
      /* private mode: the choice lasts for this visit */
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
    default:
      return 'Morning brief · Juyo';
  }
}
