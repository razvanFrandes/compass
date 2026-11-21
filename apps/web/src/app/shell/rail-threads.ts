import { Component, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorChatsCircleFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorBuildingsLight, phosphorChartBarLight, phosphorChatTextLight, phosphorChatsCircleLight, phosphorNotePencilLight, phosphorTableLight } from '@ng-icons/phosphor-icons/light';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { Live } from '../live';
import { CompassStore } from '../store';
import { groupByDay, threadIcon, threadTime } from './conversation-groups';
import { RAIL_TIP_GAP } from './sidebar-state';

/**
 * Recent conversations in the collapsed sidebar: one icon that opens them as a menu beside the rail, under Today,
 * Yesterday and Earlier, with "New conversation" first. Renaming and deleting stay in the expanded sidebar.
 */
@Component({
  selector: 'app-rail-threads',
  imports: [NgIcon, HlmDropdownMenuImports, HlmTooltipImports],
  providers: [provideIcons({ phosphorChatsCircleLight, phosphorChatsCircleFill, phosphorBuildingsLight, phosphorChartBarLight, phosphorChatTextLight, phosphorNotePencilLight, phosphorTableLight })],
  host: { class: 'block' },
  template: `
    <button
      type="button"
      class="rail-item rounded-md"
      [class.rail-item--current]="inThread()"
      aria-label="Recent conversations"
      hlmTooltip="Recent conversations"
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
    <ng-template #menu>
      <hlm-dropdown-menu class="max-h-[min(560px,80dvh)] w-72" [style.margin-left.px]="gap">
        <button hlmDropdownMenuItem class="gap-2.5 text-[13px]" (triggered)="live.newChat()"><ng-icon name="phosphorNotePencilLight" aria-hidden="true" />New conversation</button>
        @for (g of groups(); track g.label) {
          <hlm-dropdown-menu-separator />
          <hlm-dropdown-menu-label>{{ g.label }}</hlm-dropdown-menu-label>
          @for (t of g.items; track t.id) {
            <button hlmDropdownMenuItem class="items-start gap-2.5 text-[13px]" [attr.aria-current]="isCurrent(t.id) ? 'page' : null" [title]="t.time" (triggered)="live.openConversation(t.id)">
              <ng-icon [name]="t.icon" class="text-muted-foreground mt-px" aria-hidden="true" />
              <span class="min-w-0 flex-1 text-left">
                <span class="block truncate" [class.font-medium]="isCurrent(t.id)">{{ t.title }}</span>
                @if (t.summary) {
                  <span class="text-muted-foreground block truncate text-[12px]"><span class="sr-only">. </span>{{ t.summary }}</span>
                }
              </span>
            </button>
          }
        }
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class RailThreads {
  /** How many conversations to show: the same as the expanded sidebar. */
  readonly limit = input(12);

  protected readonly live = inject(Live);
  private readonly store = inject(CompassStore);
  protected readonly open = signal(false);
  protected readonly gap = RAIL_TIP_GAP;

  protected readonly inThread = computed(() => this.store.view() === 'thread');
  protected readonly groups = computed(() => {
    // Read when the menu opens: the groups only need to be right while it is open.
    this.open();
    const now = Date.now();
    return groupByDay(
      this.live
        .conversations()
        .slice(0, this.limit())
        .map((c) => ({ ...c, icon: threadIcon(c), time: threadTime(c.at, now) })),
      now,
    );
  });

  protected isCurrent(id: string) {
    return this.inThread() && this.live.chat.conversation() === id;
  }
}
