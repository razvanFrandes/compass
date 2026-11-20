import { Component, DestroyRef, ElementRef, afterRenderEffect, computed, inject, input, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorDotsThreeBold } from '@ng-icons/phosphor-icons/bold';
import { phosphorPencilSimpleLight, phosphorTrashLight } from '@ng-icons/phosphor-icons/light';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { Live, type ConversationRef } from '../live';
import { CompassStore } from '../store';

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** "now", "5 min", "3 h", "Tue", "12 Nov": how long ago, short enough for the sidebar. */
export function agoShort(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h`;
  return seconds < 6 * 86_400 ? weekday.format(at) : dayMonth.format(at);
}

/**
 * The Threads list of the sidebar: each conversation with Kassandra by its own title and how long ago it was last
 * asked something. ⋯ renames it in place or deletes it (with Undo).
 */
@Component({
  selector: 'kassandra-thread-list',
  imports: [NgIcon, HlmDropdownMenuImports],
  providers: [provideIcons({ phosphorDotsThreeBold, phosphorPencilSimpleLight, phosphorTrashLight })],
  host: { class: 'flex min-h-0 flex-col gap-1' },
  template: `
    @if (threads().length) {
      <h2 class="text-muted-foreground px-2 text-[12px] font-medium tracking-[0.04em] uppercase">Threads</h2>
      <ul class="-mx-1 flex min-h-0 flex-col gap-px overflow-y-auto px-1 py-0.5 text-[13px]">
        @for (t of threads(); track t.id) {
          <li class="k-thread group/thread" [class.k-thread--current]="isCurrent(t.id)">
            @if (editing() === t.id) {
              <label class="sr-only" [for]="'rename-' + t.id">Rename thread</label>
              <input #rename [id]="'rename-' + t.id" class="k-thread-input" [value]="t.title" maxlength="120" autocomplete="off" (keydown.enter)="commit(t.id, rename.value)" (keydown.escape)="$event.stopPropagation(); editing.set(null)" (blur)="commit(t.id, rename.value)" />
            } @else {
              <button type="button" class="k-thread-open" [attr.aria-current]="isCurrent(t.id) ? 'page' : null" [title]="t.title" (click)="live.openConversation(t.id)">
                <span class="min-w-0 flex-1 truncate">{{ t.title }}</span>
                <span class="k-thread-time">{{ t.ago }}</span>
              </button>
              <button type="button" class="k-thread-more" [attr.aria-label]="'More for ' + t.title" [hlmDropdownMenuTrigger]="menu" [hlmDropdownMenuTriggerData]="{ $implicit: t }" align="start">
                <ng-icon name="phosphorDotsThreeBold" class="text-[16px]" aria-hidden="true" />
              </button>
            }
          </li>
        }
      </ul>
    }
    <ng-template #menu let-t>
      <hlm-dropdown-menu class="w-44">
        <button hlmDropdownMenuItem (triggered)="startRename(t.id)"><ng-icon name="phosphorPencilSimpleLight" aria-hidden="true" />Rename</button>
        <button hlmDropdownMenuItem (triggered)="remove(t)"><ng-icon name="phosphorTrashLight" aria-hidden="true" />Delete</button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class KassandraThreadList {
  /** How many threads to show. */
  readonly limit = input(8);

  protected readonly live = inject(Live);
  private readonly store = inject(CompassStore);
  protected readonly editing = signal<string | null>(null);
  private readonly now = signal(Date.now());
  private readonly renameField = viewChild<ElementRef<HTMLInputElement>>('rename');

  protected readonly threads = computed(() =>
    this.live
      .conversations()
      .slice(0, this.limit())
      .map((c) => ({ ...c, ago: agoShort(c.at, this.now()) })),
  );

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 30_000);
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
    // After the menu has closed and handed focus back to its trigger.
    setTimeout(() => this.editing.set(id), 0);
  }

  protected commit(id: string, title: string) {
    if (this.editing() !== id) return;
    this.live.renameConversation(id, title);
    this.editing.set(null);
  }

  protected remove(thread: ConversationRef) {
    const removed = this.live.deleteConversation(thread.id);
    if (!removed) return;
    toast('Thread deleted', { description: removed.title, duration: 8000, action: { label: 'Undo', onClick: () => this.live.restoreConversation(removed) } });
  }
}
