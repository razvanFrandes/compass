import { Component, DestroyRef, ElementRef, afterRenderEffect, computed, inject, input, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorBuildingsLight, phosphorChartBarLight, phosphorChatTextLight, phosphorNotePencilLight, phosphorPencilSimpleLight, phosphorTableLight, phosphorTrashLight } from '@ng-icons/phosphor-icons/light';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { Live, type ConversationRef } from '../live';
import { groupByDay, threadIcon, threadStamp, threadTime } from '../shell/conversation-groups';
import { RAIL_TIP_GAP } from '../shell/sidebar-state';
import { CompassStore } from '../store';

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** "now", "5 min", "3 h", "Tue", "12 Nov": how long ago, short. */
export function agoShort(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h`;
  return seconds < 6 * 86_400 ? weekday.format(at) : dayMonth.format(at);
}

/**
 * "Recent" in the sidebar: the conversations with Kassandra, under Today, Yesterday and Earlier. Each has a short
 * title and, under it, the takeaway of its answer, both written on the server after the first answer (until then,
 * the question). A small icon says what the answer showed. When it was last asked is on the right of the title (the time, or the date before yesterday) and, in full, in the tooltip.
 * On hover and focus, Rename and Delete take the time's place and the text makes room for them, so nothing overlaps.
 * Rename (in place) and Delete (with Undo) show on hover and on focus. "New" starts an empty conversation.
 *
 * The styles are global (styles.css, `.k-recent`, `.k-thread`).
 */
@Component({
  selector: 'kassandra-thread-list',
  imports: [NgIcon, HlmTooltipImports],
  providers: [provideIcons({ phosphorBuildingsLight, phosphorChartBarLight, phosphorChatTextLight, phosphorNotePencilLight, phosphorPencilSimpleLight, phosphorTableLight, phosphorTrashLight })],
  host: { class: 'k-recent flex min-h-0 flex-col gap-1' },
  template: `
    <div class="k-recent-head">
      <h2 class="text-muted-foreground text-[12.5px] font-medium" [id]="uid + '-head'">Recent</h2>
      <button type="button" class="k-recent-new" aria-label="New conversation" hlmTooltip="New conversation" position="right" [sideOffset]="gap" (click)="live.newChat()">
        <ng-icon name="phosphorNotePencilLight" class="text-[16px]" aria-hidden="true" />
      </button>
    </div>
    @if (groups().length) {
      <div class="-mx-1 flex min-h-0 flex-col overflow-y-auto px-1 pb-1" role="group" [attr.aria-labelledby]="uid + '-head'">
        @for (g of groups(); track g.label) {
          <h3 class="k-day" [id]="uid + '-' + g.label">{{ g.label }}</h3>
          <ul class="flex flex-col gap-0.5" [attr.aria-labelledby]="uid + '-' + g.label">
            @for (t of g.items; track t.id) {
              <li class="k-thread" [class.k-thread--current]="isCurrent(t.id)" [attr.data-thread]="t.id">
                @if (editing() === t.id) {
                  <label class="sr-only" [for]="'rename-' + t.id">Rename conversation</label>
                  <input #rename [id]="'rename-' + t.id" class="k-thread-input" [value]="t.title" maxlength="120" autocomplete="off" (keydown.enter)="commit(t.id, rename.value)" (keydown.escape)="$event.stopPropagation(); cancel()" (blur)="commit(t.id, rename.value)" />
                } @else {
                  <button
                    type="button"
                    class="k-thread-open"
                    [attr.aria-current]="isCurrent(t.id) ? 'page' : null"
                    [hlmTooltip]="t.time"
                    position="right"
                    [sideOffset]="gap"
                    (click)="live.openConversation(t.id)"
                  >
                    <ng-icon [name]="t.icon" [attr.data-icon]="t.icon" class="k-thread-icon" aria-hidden="true" />
                    <span class="k-thread-text">
                      <span class="k-thread-line">
                        <span class="k-thread-title">{{ t.title }}</span>
                        <span class="k-thread-time" aria-hidden="true">{{ t.stamp }}</span>
                      </span>
                      @if (t.summary) {
                        <span class="k-thread-summary"><span class="sr-only">. </span>{{ t.summary }}</span>
                      }
                    </span>
                    <span class="sr-only">, {{ t.time }}</span>
                  </button>
                  <span class="k-thread-actions">
                    <button type="button" class="k-thread-action" [attr.aria-label]="'Rename ' + t.title" hlmTooltip="Rename" (click)="startRename(t.id)">
                      <ng-icon name="phosphorPencilSimpleLight" aria-hidden="true" />
                    </button>
                    <button type="button" class="k-thread-action" [attr.aria-label]="'Delete ' + t.title" hlmTooltip="Delete" (click)="remove(t)">
                      <ng-icon name="phosphorTrashLight" aria-hidden="true" />
                    </button>
                  </span>
                }
              </li>
            }
          </ul>
        }
      </div>
    } @else {
      <p class="text-muted-foreground px-[11px] text-[12.5px]/snug">Your conversations with Kassandra will show here.</p>
    }
  `,
})
export class KassandraThreadList {
  /** How many conversations to show. */
  readonly limit = input(12);

  protected readonly live = inject(Live);
  private readonly store = inject(CompassStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private static next = 0;
  protected readonly uid = `k-recent-${KassandraThreadList.next++}`;
  protected readonly gap = RAIL_TIP_GAP;
  protected readonly editing = signal<string | null>(null);
  private readonly now = signal(Date.now());
  private readonly renameField = viewChild<ElementRef<HTMLInputElement>>('rename');

  protected readonly groups = computed(() =>
    groupByDay(
      this.live
        .conversations()
        .slice(0, this.limit())
        .map((c) => ({ ...c, icon: threadIcon(c), time: threadTime(c.at, this.now()), stamp: threadStamp(c.at, this.now()) })),
      this.now(),
    ),
  );

  constructor() {
    // Today and Yesterday move at midnight; once a minute is enough.
    const tick = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
    afterRenderEffect(() => {
      const field = this.renameField()?.nativeElement;
      if (field && document.activeElement !== field) {
        field.focus();
        field.select();
      }
    });
  }

  protected isCurrent(id: string) {
    return this.store.view() === 'thread' && this.live.chat.conversation() === id;
  }

  protected startRename(id: string) {
    this.editing.set(id);
  }

  protected commit(id: string, title: string) {
    if (this.editing() !== id) return;
    this.live.renameConversation(id, title);
    this.editing.set(null);
    this.refocus(id);
  }

  protected cancel() {
    const id = this.editing();
    this.editing.set(null);
    if (id) this.refocus(id);
  }

  protected remove(thread: ConversationRef) {
    const removed = this.live.deleteConversation(thread.id);
    if (!removed) return;
    toast('Conversation deleted', { description: removed.title, duration: 8000, action: { label: 'Undo', onClick: () => this.live.restoreConversation(removed) } });
    // The row is gone: the focus goes to "New conversation", the next stop that stays.
    this.host.nativeElement.querySelector<HTMLElement>('.k-recent-new')?.focus();
  }

  /** After a rename, the focus goes back to the conversation's row. */
  private refocus(id: string) {
    setTimeout(() => {
      const row = [...this.host.nativeElement.querySelectorAll<HTMLElement>('.k-thread')].find((el) => el.dataset['thread'] === id);
      row?.querySelector<HTMLElement>('.k-thread-open')?.focus();
    }, 0);
  }
}
