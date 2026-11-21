import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import type { BoardWidget, ChatWidget } from '../api';
import { ScopeService } from '../scope/scope.service';
import { BoardsService } from '../boards/boards.service';
import { KassandraComposer } from './kassandra-composer';
import { KassandraConversation } from './kassandra-conversation';
import { kassandraSession, sessionId } from './kassandra-session';

/** What a description is sent as, so Kassandra answers with widgets (`show_widget`) rather than prose. */
export const BOARD_VIEW_PREFIX = 'Build a board view: ';

/**
 * "Describe a view" on a board: the description goes to Kassandra as "Build a board view: …", her work shows under
 * the bar, and every widget she answers with is saved on this board through `BoardsService` (POST
 * /api/boards/:id/widgets), which the board page reads, so the board redraws by itself. A receipt says what was
 * added, with Undo; `(added)` and `(removed)` say the same to a host that wants to know.
 */
@Component({
  selector: 'kassandra-describe-view',
  imports: [KassandraComposer, KassandraConversation, HlmButtonImports],
  host: { class: 'block' },
  template: `
    <kassandra-composer
      label="Describe this board to Kassandra"
      [placeholder]="placeholder()"
      [busy]="chat.running()"
      [phase]="chat.live()?.phase"
      [showMode]="false"
      [showPrompts]="false"
      (submitted)="describe($event)"
      (stopped)="chat.abort()"
    />

    @if (receipt(); as r) {
      <section class="receipt gen-in mt-3 items-start" aria-label="Charts Kassandra added">
        <span class="orb-mark mt-0.5 shrink-0" aria-hidden="true"></span>
        <div class="min-w-0 flex-1 text-[13.5px]" role="status">
          <p class="font-medium">Kassandra added {{ r.widgets.length }} {{ r.widgets.length === 1 ? 'chart' : 'charts' }} to {{ boardName() }}</p>
          <ul class="text-muted-foreground mt-1 flex flex-col gap-0.5">
            @for (w of r.widgets; track w.id) {
              <li>{{ w.spec.title }}</li>
            }
          </ul>
        </div>
        <button hlmBtn type="button" variant="ghost" size="sm" class="shrink-0" [disabled]="undoing()" (click)="undo()">{{ undoing() ? 'Undoing…' : 'Undo' }}</button>
      </section>
    }

    @if (latest().length || chat.error()) {
      <div class="mt-1">
        <kassandra-conversation [turns]="latest()" [phase]="chat.live()?.phase" [liveTools]="chat.live()?.tools" [error]="chat.error()" [showEvidence]="false" [addToBoard]="false" [stoppable]="true" (stopped)="chat.abort()" />
      </div>
    }
  `,
})
export class KassandraDescribeView {
  readonly boardId = input.required<string>();
  readonly boardName = input('this board');
  readonly placeholder = input('Describe what this board should show, e.g. “channel profitability after commission”');
  /** Widgets saved on the board from the last description. */
  readonly added = output<BoardWidget[]>();
  /** Widgets taken back with Undo (their ids). */
  readonly removed = output<string[]>();

  private readonly boards = inject(BoardsService);
  private readonly scope = inject(ScopeService);
  protected readonly chat = kassandraSession(sessionId('board-view'));
  /** Only the description being worked on, or the last one: a board is not a transcript. */
  protected readonly latest = computed(() => this.chat.turns().slice(-1));
  protected readonly receipt = signal<{ widgets: BoardWidget[] } | null>(null);
  protected readonly undoing = signal(false);
  /** Turns whose widgets are saved already, by key. */
  private readonly done = new Set<string>();
  private description = '';

  constructor() {
    // When Kassandra has finished a description, what she showed goes on the board.
    effect(() => {
      const turn = this.chat.turns().at(-1);
      if (!turn || turn.pending || turn.running || this.done.has(turn.key)) return;
      const widgets = turn.steps.flatMap((step) => (step.widget ? [step.widget] : []));
      if (!widgets.length) return;
      this.done.add(turn.key);
      untracked(() => void this.save(widgets));
    });
  }

  protected describe(text: string) {
    this.description = text;
    this.receipt.set(null);
    this.chat.ask(`${BOARD_VIEW_PREFIX}${text}`, 'thinker', { hotels: this.scope.hotels() });
  }

  private async save(widgets: ChatWidget[]) {
    const saved: BoardWidget[] = [];
    for (const widget of widgets) {
      const { rows, columns, evidence, ...spec } = widget;
      const result = await this.boards.addWidget(this.boardId(), { spec, rows, columns, evidence, ...(this.description ? { question: this.description } : {}) }, true);
      if (result.ok) saved.push(result.value);
      else {
        toast(`Couldn’t add “${widget.title}” to ${this.boardName()}`, { description: result.message, duration: 8000 });
        break;
      }
    }
    if (!saved.length) return;
    this.receipt.set({ widgets: saved });
    this.added.emit(saved);
  }

  protected async undo() {
    const current = this.receipt();
    if (!current) return;
    this.undoing.set(true);
    const gone: string[] = [];
    for (const widget of current.widgets) {
      const result = await this.boards.removeWidget(this.boardId(), widget.id);
      // A failure is said by the service, in the server's words.
      if (result.ok) gone.push(widget.id);
    }
    this.undoing.set(false);
    const left = current.widgets.filter((widget) => !gone.includes(widget.id));
    this.receipt.set(left.length ? { widgets: left } : null);
    if (gone.length) this.removed.emit(gone);
  }
}
