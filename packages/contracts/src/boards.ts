import { z } from 'zod';
import { Evidence, EvidenceColumn } from './evidence.ts';
import { WIDGET_MAX_ROWS, WidgetSpec } from './widgets.ts';

/**
 * Boards: the Canvas saved on the server (docs/round2-contracts.md §4). One Durable Object holds every board of the
 * group. A board widget is a copy of a widget from an answer: its spec, rows, columns and evidence.
 */

export const BOARD_LIMITS = {
  boards: 50,
  widgetsPerBoard: 24,
  rowsPerWidget: WIDGET_MAX_ROWS,
  nameChars: 80,
  descriptionChars: 300,
  hotels: 40,
  columnsPerWidget: 80,
  questionChars: 2000,
} as const;

export interface BoardWidget {
  id: string;
  spec: WidgetSpec;
  rows: Record<string, unknown>[];
  columns: EvidenceColumn[];
  evidence: Evidence;
  /** The question whose answer the widget came from. */
  question?: string;
  addedAt: string;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  /** Hotel codes the board is about; empty for the whole group. */
  hotels: string[];
  widgets: BoardWidget[];
  createdAt: string;
  updatedAt: string;
}

export { BOARD_PREVIEW } from './widget-limits.ts';

/** A widget in a board's preview: its spec, and the rows and columns that spec draws, cut to `BOARD_PREVIEW`. */
export interface BoardWidgetPreview {
  id: string;
  spec: WidgetSpec;
  columns: EvidenceColumn[];
  rows: Record<string, unknown>[];
}

/** A widget in `GET /api/boards`: its spec (with the title), no rows. */
export type BoardWidgetSummary = Pick<BoardWidget, 'id' | 'spec' | 'question' | 'addedAt'>;
/** A board in `GET /api/boards`. */
export type BoardSummary = Omit<Board, 'widgets'> & { widgets: BoardWidgetSummary[] };
/** A board as `GET /api/boards` lists it: the summary, and the preview of its first widgets (absent from older servers). */
export type BoardListItem = BoardSummary & { preview?: BoardWidgetPreview[] };

const name = z.string().trim().min(1).max(BOARD_LIMITS.nameChars);
const description = z.string().trim().max(BOARD_LIMITS.descriptionChars);
const hotels = z.array(z.string().regex(/^[A-Za-z0-9]{2,8}$/)).max(BOARD_LIMITS.hotels);

/** `POST /api/boards`. */
export const BoardCreate = z.strictObject({ name, description: description.optional(), hotels: hotels.optional() });
export type BoardCreate = z.infer<typeof BoardCreate>;

/** `PATCH /api/boards/:id`. `order` lists every widget id of the board, in the new order. */
export const BoardPatch = z.strictObject({
  name: name.optional(),
  description: description.optional(),
  hotels: hotels.optional(),
  order: z.array(z.string().max(64)).max(BOARD_LIMITS.widgetsPerBoard).optional(),
});
export type BoardPatch = z.infer<typeof BoardPatch>;

/** A column as a client may store it: `EvidenceColumn` with bounded strings (the body is public input). */
const BoardColumn = EvidenceColumn.extend({
  key: z.string().min(1).max(64),
  label: z.string().max(80),
  unit: z.string().max(64).optional(),
});

/** `POST /api/boards/:id/widgets`: a widget from an answer, as the chat sent it. */
export const BoardWidgetCreate = z.strictObject({
  spec: WidgetSpec,
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(BOARD_LIMITS.rowsPerWidget),
  columns: z.array(BoardColumn).min(1).max(BOARD_LIMITS.columnsPerWidget),
  // Loose: evidence gains fields over time (columns, title, source labels) and a board keeps what the answer had.
  evidence: Evidence.loose(),
  question: z.string().trim().max(BOARD_LIMITS.questionChars).optional(),
});
export type BoardWidgetCreate = z.infer<typeof BoardWidgetCreate>;
