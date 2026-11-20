import type { BoardSummary, BoardWidget } from '@compass/contracts';
import type { BoardStore } from '../application/boards/store.ts';

/**
 * The board store on a Durable Object's key-value storage (SQLite-backed). A board's summary is one value and each
 * widget (up to 200 rows, at most 256 KB as the API takes it) is its own value, well under the 2 MB a value may hold.
 */
export class DurableBoardStore implements BoardStore {
  readonly #storage: DurableObjectStorage;

  constructor(storage: DurableObjectStorage) {
    this.#storage = storage;
  }

  async list(): Promise<BoardSummary[]> {
    return [...(await this.#storage.list<BoardSummary>({ prefix: 'board:' })).values()];
  }
  get(id: string) {
    return this.#storage.get<BoardSummary>(`board:${id}`);
  }
  put(board: BoardSummary) {
    return this.#storage.put(`board:${board.id}`, board);
  }
  async delete(board: BoardSummary): Promise<void> {
    // A board lists at most 24 widgets; one delete call takes at most 128 keys.
    await this.#storage.delete([`board:${board.id}`, ...board.widgets.map((widget) => `widget:${board.id}:${widget.id}`)]);
  }
  async widgets(boardId: string, ids: readonly string[]): Promise<BoardWidget[]> {
    if (!ids.length) return [];
    const stored = await this.#storage.get<BoardWidget>(ids.map((id) => `widget:${boardId}:${id}`));
    return ids.flatMap((id) => stored.get(`widget:${boardId}:${id}`) ?? []);
  }
  async putWidget(board: BoardSummary, widget: BoardWidget): Promise<void> {
    await this.#storage.put<BoardSummary | BoardWidget>({ [`board:${board.id}`]: board, [`widget:${board.id}:${widget.id}`]: widget });
  }
  async deleteWidget(board: BoardSummary, widgetId: string): Promise<void> {
    // Not one write, but the object runs one request at a time across them, and an orphan widget is never listed.
    await this.#storage.put(`board:${board.id}`, board);
    await this.#storage.delete(`widget:${board.id}:${widgetId}`);
  }
}
