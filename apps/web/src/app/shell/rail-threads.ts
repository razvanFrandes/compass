import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorChatsCircleFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorChatsCircleLight } from '@ng-icons/phosphor-icons/light';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { agoShort } from '../kassandra/kassandra-thread-list';
import { Live } from '../live';
import { CompassStore } from '../store';
import { RAIL_TIP_GAP } from './sidebar-state';

/**
 * Threads in the collapsed sidebar: one icon that opens the list as a menu beside the rail. Renaming and deleting
 * stay in the expanded sidebar, where each thread has room for its ⋯ button.
 */
@Component({
  selector: 'app-rail-threads',
  imports: [NgIcon, HlmDropdownMenuImports, HlmTooltipImports],
  providers: [provideIcons({ phosphorChatsCircleLight, phosphorChatsCircleFill })],
  host: { class: 'block' },
  template: `
    @if (threads().length) {
      <button
        type="button"
        class="rail-item rounded-md"
        [class.rail-item--current]="inThread()"
        aria-label="Threads"
        hlmTooltip="Threads"
        position="right"
        [sideOffset]="gap"
        [tooltipDisabled]="open()"
        [hlmDropdownMenuTrigger]="menu"
        side="right"
        align="start"
        (hlmDropdownMenuOpened)="open.set(true)"
        (hlmDropdownMenuClosed)="open.set(false)"
      >
        <ng-icon [name]="inThread() ? 'phosphorChatsCircleFill' : 'phosphorChatsCircleLight'" class="rail-icon" aria-hidden="true" />
      </button>
    }
    <ng-template #menu>
      <hlm-dropdown-menu class="w-72" [style.margin-left.px]="gap">
        <hlm-dropdown-menu-label>Threads</hlm-dropdown-menu-label>
        @for (t of threads(); track t.id) {
          <button hlmDropdownMenuItem class="gap-3 text-[13px]" [class.font-medium]="isCurrent(t.id)" [attr.aria-current]="isCurrent(t.id) ? 'page' : null" [title]="t.title" (triggered)="live.openConversation(t.id)">
            <span class="min-w-0 flex-1 truncate text-left">{{ t.title }}</span>&ngsp;<span class="text-muted-foreground shrink-0 text-[11.5px] font-normal tabular-nums">{{ t.ago }}</span>
          </button>
        }
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class RailThreads {
  /** How many threads to show: the same as the expanded sidebar. */
  readonly limit = input(8);

  protected readonly live = inject(Live);
  private readonly store = inject(CompassStore);
  protected readonly open = signal(false);
  protected readonly gap = RAIL_TIP_GAP;
  private readonly now = signal(Date.now());

  protected readonly inThread = computed(() => this.store.view() === 'thread');
  protected readonly threads = computed(() =>
    this.live
      .conversations()
      .slice(0, this.limit())
      .map((c) => ({ ...c, ago: agoShort(c.at, this.now()) })),
  );

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }

  protected isCurrent(id: string) {
    return this.inThread() && this.live.chat.conversation() === id;
  }
}
