import { BOARD_LIMITS, BoardCreate, BoardPatch, BoardWidgetCreate, type Board, type BoardSummary, type BoardWidget, type BoardWidgetSummary } from '@compass/contracts';
import type { z } from 'zod';
import { err, ok, type Result } from '../../domain/result.ts';
import { fitWidget } from '../widgets/fit.ts';
import type { BoardStore } from './store.ts';

/**
 * Boards: the Canvas saved on the server (docs/round2-contracts.md §4). Every input is validated here, whoever calls:
 * a board widget must fit its rows by the same rules as Kassandra's show_widget, so a board never holds a chart the
 * catalogue cannot draw. Limits: 50 boards, 24 widgets per board, 200 rows per widget.
 */

export type BoardError = { kind: 'not_found' | 'invalid' | 'limit'; message: string };
type Outcome<T> = Promise<Result<T, BoardError>>;

const NO_BOARD: BoardError = { kind: 'not_found', message: 'No board has this id.' };
const NO_WIDGET: BoardError = { kind: 'not_found', message: 'This board has no widget with this id.' };

/** A validated input, or what is wrong with it as `path: message`, short enough to show. */
function parse<S extends z.ZodType>(schema: S, input: unknown): Result<z.infer<S>, BoardError> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  const issues = parsed.error.issues.slice(0, 3).map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`);
  return err({ kind: 'invalid', message: issues.join('; ').slice(0, 300) });
}

const summaryOf = (widget: BoardWidget): BoardWidgetSummary => ({
  id: widget.id,
  spec: widget.spec,
  ...(widget.question ? { question: widget.question } : {}),
  addedAt: widget.addedAt,
});

export class BoardService {
  readonly #store: BoardStore;
  readonly #now: () => Date;
  readonly #newId: () => string;

  constructor(store: BoardStore, now: () => Date = () => new Date(), newId: () => string = () => crypto.randomUUID().slice(0, 8)) {
    this.#store = store;
    this.#now = now;
    this.#newId = newId;
  }

  /** Every board, oldest first, with its widgets' specs and no rows. */
  async list(): Promise<BoardSummary[]> {
    return (await this.#store.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  async get(id: string): Outcome<Board> {
    const board = await this.#store.get(id);
    return board ? ok(await this.#full(board)) : err(NO_BOARD);
  }

  async create(input: unknown): Outcome<Board> {
    const parsed = parse(BoardCreate, input);
    if (!parsed.ok) return parsed;
    if ((await this.#store.list()).length >= BOARD_LIMITS.boards) {
      return err({ kind: 'limit', message: `The demo keeps at most ${BOARD_LIMITS.boards} boards. Delete one and try again.` });
    }
    const at = this.#now().toISOString();
    const board: BoardSummary = {
      id: `b-${this.#newId()}`,
      name: parsed.value.name,
      description: parsed.value.description ?? '',
      hotels: parsed.value.hotels ?? [],
      widgets: [],
      createdAt: at,
      updatedAt: at,
    };
    await this.#store.put(board);
    return ok({ ...board, widgets: [] });
  }

  /** Changes the name, the description or the hotels, or reorders the widgets (`order`: every widget id, once). */
  async update(id: string, input: unknown): Outcome<Board> {
    const board = await this.#store.get(id);
    if (!board) return err(NO_BOARD);
    const parsed = parse(BoardPatch, input);
    if (!parsed.ok) return parsed;
    const { order, ...fields } = parsed.value;

    let widgets = board.widgets;
    if (order) {
      const byId = new Map(board.widgets.map((widget) => [widget.id, widget]));
      const isPermutation = order.length === byId.size && new Set(order).size === order.length && order.every((widgetId) => byId.has(widgetId));
      if (!isPermutation) return err({ kind: 'invalid', message: 'order: list every widget id of the board exactly once.' });
      widgets = order.map((widgetId) => byId.get(widgetId)!);
    }
    const next: BoardSummary = {
      ...board,
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.description !== undefined ? { description: fields.description } : {}),
      ...(fields.hotels !== undefined ? { hotels: fields.hotels } : {}),
      widgets,
      updatedAt: this.#now().toISOString(),
    };
    await this.#store.put(next);
    return ok(await this.#full(next));
  }

  async remove(id: string): Outcome<null> {
    const board = await this.#store.get(id);
    if (!board) return err(NO_BOARD);
    await this.#store.delete(board);
    return ok(null);
  }

  /** Adds a widget from an answer: its spec with the rows, columns and evidence the chat sent. */
  async addWidget(id: string, input: unknown): Outcome<BoardWidget> {
    const board = await this.#store.get(id);
    if (!board) return err(NO_BOARD);
    const parsed = parse(BoardWidgetCreate, input);
    if (!parsed.ok) return parsed;
    const { spec, rows, columns, evidence, question } = parsed.value;
    const fitted = fitWidget(spec, { rows, columns });
    if (!fitted.ok) return err({ kind: 'invalid', message: `This widget cannot be drawn from its rows. ${fitted.error}` });
    if (board.widgets.length >= BOARD_LIMITS.widgetsPerBoard) {
      return err({ kind: 'limit', message: `A board holds at most ${BOARD_LIMITS.widgetsPerBoard} widgets. Remove one and try again.` });
    }
    const at = this.#now().toISOString();
    const widget: BoardWidget = { id: `w-${this.#newId()}`, spec: fitted.value, rows, columns, evidence, ...(question ? { question } : {}), addedAt: at };
    await this.#store.putWidget({ ...board, widgets: [...board.widgets, summaryOf(widget)], updatedAt: at }, widget);
    return ok(widget);
  }

  async removeWidget(id: string, widgetId: string): Outcome<null> {
    const board = await this.#store.get(id);
    if (!board) return err(NO_BOARD);
    if (!board.widgets.some((widget) => widget.id === widgetId)) return err(NO_WIDGET);
    const next = { ...board, widgets: board.widgets.filter((widget) => widget.id !== widgetId), updatedAt: this.#now().toISOString() };
    await this.#store.deleteWidget(next, widgetId);
    return ok(null);
  }

  /** Stores whole boards as given: the sample boards of a new demo (application/boards/seed.ts). */
  async seed(boards: readonly Board[]): Promise<void> {
    for (const board of boards) {
      await this.#store.put({ ...board, widgets: [] });
      let listed: BoardSummary = { ...board, widgets: [] };
      for (const widget of board.widgets) {
        listed = { ...listed, widgets: [...listed.widgets, summaryOf(widget)] };
        await this.#store.putWidget(listed, widget);
      }
    }
  }

  async #full(board: BoardSummary): Promise<Board> {
    const widgets = await this.#store.widgets(
      board.id,
      board.widgets.map((widget) => widget.id),
    );
    return { ...board, widgets };
  }
}
