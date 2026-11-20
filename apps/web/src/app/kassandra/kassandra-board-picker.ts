import { Component, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorCaretDownLight, phosphorCheckLight, phosphorPlusLight, phosphorSquaresFourLight } from '@ng-icons/phosphor-icons/light';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import type { ChatWidget } from '../api';
import { CompassStore } from '../store';
import { BoardsApi, type BoardSummary } from './boards-api';

/** A board's name from a widget's title: the title is a conclusion, so its first words name the subject. */
export function boardNameFor(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= 40) return clean || 'New board';
  const cut = clean.slice(0, 40);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 20 ? cut.lastIndexOf(' ') : 40)}…`;
}

/**
 * "Add to board ▾" on a widget Kassandra showed: pick a board or make a new one. The widget is saved on the server
 * with its rows (POST /api/boards/:id/widgets); a toast offers View and Undo. Failures show the server's own words.
 */
@Component({
  selector: 'kassandra-board-picker',
  imports: [NgIcon, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ phosphorCaretDownLight, phosphorCheckLight, phosphorPlusLight, phosphorSquaresFourLight })],
  host: { class: 'inline-flex' },
  template: `
    @if (added(); as a) {
      <button hlmBtn type="button" variant="ghost" size="sm" class="text-muted-foreground max-w-[16rem]" (click)="view(a.boardId)">
        <ng-icon name="phosphorCheckLight" aria-hidden="true" /><span class="truncate">On {{ a.boardName }} · View</span>
      </button>
    } @else {
      <button hlmBtn type="button" variant="outline" size="sm" [disabled]="saving()" [hlmDropdownMenuTrigger]="menu" align="end" (hlmDropdownMenuOpened)="load()">
        <ng-icon name="phosphorPlusLight" aria-hidden="true" />{{ saving() ? 'Adding…' : 'Add to board' }}<ng-icon name="phosphorCaretDownLight" class="text-muted-foreground" aria-hidden="true" />
      </button>
    }
    <ng-template #menu>
      <hlm-dropdown-menu class="w-64">
        <hlm-dropdown-menu-label>Add to board</hlm-dropdown-menu-label>
        @if (loading()) {
          <p class="text-muted-foreground px-2 py-1.5 text-[13px]" role="status">Loading your boards…</p>
        } @else if (error(); as e) {
          <p class="text-muted-foreground px-2 py-1.5 text-[13px]" role="alert">{{ e }}</p>
        } @else {
          @for (board of boards(); track board.id) {
            <button hlmDropdownMenuItem (triggered)="add(board.id, board.name)">
              <ng-icon name="phosphorSquaresFourLight" aria-hidden="true" /><span class="min-w-0 flex-1 truncate">{{ board.name }}</span>
              <span class="text-muted-foreground text-[12px] tabular-nums">{{ board.widgets.length }}</span>
            </button>
          }
        }
        <hlm-dropdown-menu-separator />
        <button hlmDropdownMenuItem (triggered)="addToNew()"><ng-icon name="phosphorPlusLight" aria-hidden="true" />New board</button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class KassandraBoardPicker {
  readonly widget = input.required<ChatWidget>();
  /** The question the widget answered, kept with it on the board. */
  readonly question = input<string | null>(null);
  /** The widget is on a board now. */
  readonly saved = output<{ boardId: string; widgetId: string }>();

  private readonly api = inject(BoardsApi);
  private readonly store = inject(CompassStore);
  protected readonly boards = signal<BoardSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly added = signal<{ boardId: string; boardName: string; widgetId: string } | null>(null);

  protected async load() {
    this.loading.set(!this.boards().length);
    this.error.set(null);
    const result = await this.api.list();
    this.loading.set(false);
    if (result.ok) this.boards.set(result.value);
    else this.error.set(`Your boards didn’t load: ${result.error.message}`);
  }

  protected async addToNew() {
    this.saving.set(true);
    const created = await this.api.create({ name: boardNameFor(this.widget().title), description: 'Built from Kassandra’s answers' });
    if (!created.ok) {
      this.saving.set(false);
      toast('The board wasn’t created', { description: created.error.message, duration: 8000 });
      return;
    }
    await this.add(created.value.id, created.value.name);
  }

  protected async add(boardId: string, boardName: string) {
    this.saving.set(true);
    const result = await this.api.addWidget(boardId, this.widget(), this.question() ?? undefined);
    this.saving.set(false);
    if (!result.ok) {
      toast(`Not added to ${boardName}`, { description: result.error.message, duration: 8000 });
      return;
    }
    const widgetId = result.value.id;
    this.added.set({ boardId, boardName, widgetId });
    this.saved.emit({ boardId, widgetId });
    toast(`Added to ${boardName}`, {
      description: this.widget().title,
      duration: 10000,
      action: { label: 'View', onClick: () => this.view(boardId) },
      cancel: { label: 'Undo', onClick: () => void this.undo(boardId, boardName, widgetId) },
    });
  }

  private async undo(boardId: string, boardName: string, widgetId: string) {
    const result = await this.api.removeWidget(boardId, widgetId);
    if (result.ok) this.added.set(null);
    else toast(`Still on ${boardName}`, { description: result.error.message, duration: 8000 });
  }

  protected view(boardId: string) {
    this.store.openBoard(boardId);
  }
}
