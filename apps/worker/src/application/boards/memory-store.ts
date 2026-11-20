import type { BoardSummary, BoardWidget } from '@compass/contracts';
import type { BoardStore } from './store.ts';

/** In-memory store for tests. */
export class MemoryBoardStore implements BoardStore {
  readonly boards = new Map<string, BoardSummary>();
  readonly bodies = new Map<string, BoardWidget>();

  async list() {
    return [...this.boards.values()];
  }
  async get(id: string) {
    return this.boards.get(id);
  }
  async put(board: BoardSummary) {
    this.boards.set(board.id, board);
  }
  async delete(board: BoardSummary) {
    this.boards.delete(board.id);
    for (const widget of board.widgets) this.bodies.delete(`${board.id}:${widget.id}`);
  }
  async widgets(boardId: string, ids: readonly string[]) {
    return ids.flatMap((id) => this.bodies.get(`${boardId}:${id}`) ?? []);
  }
  async putWidget(board: BoardSummary, widget: BoardWidget) {
    this.bodies.set(`${board.id}:${widget.id}`, widget);
    this.boards.set(board.id, board);
  }
  async deleteWidget(board: BoardSummary, widgetId: string) {
    this.bodies.delete(`${board.id}:${widgetId}`);
    this.boards.set(board.id, board);
  }
}
