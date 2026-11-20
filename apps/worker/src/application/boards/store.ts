import type { BoardSummary, BoardWidget } from '@compass/contracts';

/**
 * Where boards live: Durable Object storage in production, memory in tests. A board is kept as its summary (name,
 * hotels, and each widget's spec in order); a widget's rows, columns and evidence are kept apart, so listing the boards
 * never reads them.
 */
export interface BoardStore {
  list(): Promise<BoardSummary[]>;
  get(id: string): Promise<BoardSummary | undefined>;
  put(board: BoardSummary): Promise<void>;
  /** Deletes a board with the widgets it lists. */
  delete(board: BoardSummary): Promise<void>;
  /** The widgets with these ids, in the order asked. An id that is not stored is left out. */
  widgets(boardId: string, ids: readonly string[]): Promise<BoardWidget[]>;
  /** Stores a widget and the board that now lists it, in one write. */
  putWidget(board: BoardSummary, widget: BoardWidget): Promise<void>;
  /** Deletes a widget and stores the board that no longer lists it, in one write. */
  deleteWidget(board: BoardSummary, widgetId: string): Promise<void>;
}
