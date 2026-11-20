import type { BoardWidget } from '@compass/contracts';

/* Round 2 contracts (docs/round2-contracts.md §3–4) as the board UI names them; the shapes live in @compass/contracts. */
export type { Board, BoardWidget, EvidenceColumn, WidgetKind, WidgetSpec } from '@compass/contracts';

export type WidgetRow = Record<string, unknown>;

/** What "Add to board" sends (POST /api/boards/:id/widgets). */
export type WidgetPayload = Pick<BoardWidget, 'spec' | 'rows' | 'columns' | 'evidence' | 'question'>;
