import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiHttp, toApiError, type ApiResult, type Board, type BoardWidget, type ChatWidget } from '../api';

/** The server keeps at most this many rows per widget (docs/round2-contracts.md §4). */
export const MAX_WIDGET_ROWS = 200;

/** A board as the list returns it: its widgets carry the spec and title only, no rows. */
export type BoardSummary = Omit<Board, 'widgets'> & { widgets: Pick<BoardWidget, 'id' | 'spec'>[] };

/**
 * Server-saved boards (docs/round2-contracts.md §4), as far as Kassandra needs them: list the boards, make one, add
 * a widget from an answer and take it back. Calls return an `ApiResult` and never throw.
 */
@Service()
export class BoardsApi {
  private readonly api = inject(ApiHttp);
  private readonly http = inject(HttpClient);

  list(): Promise<ApiResult<BoardSummary[]>> {
    return this.api.get('boards');
  }

  create(board: { name: string; description?: string; hotels?: string[] }): Promise<ApiResult<Board>> {
    return this.api.post('boards', board);
  }

  /** Adds a widget Kassandra showed, with the rows it was drawn from, so the board never needs the model again. */
  addWidget(boardId: string, widget: ChatWidget, question?: string): Promise<ApiResult<BoardWidget>> {
    const { rows, columns, evidence, ...spec } = widget;
    return this.api.post(`boards/${encodeURIComponent(boardId)}/widgets`, { spec, rows: rows.slice(0, MAX_WIDGET_ROWS), columns, evidence, ...(question ? { question } : {}) });
  }

  async removeWidget(boardId: string, widgetId: string): Promise<ApiResult<void>> {
    try {
      await firstValueFrom(this.http.delete(this.api.url(`boards/${encodeURIComponent(boardId)}/widgets/${encodeURIComponent(widgetId)}`)));
      return { ok: true, value: undefined };
    } catch (cause) {
      return { ok: false, error: toApiError(cause) };
    }
  }
}
