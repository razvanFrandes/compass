import type { Evidence } from '@compass/contracts';

/**
 * Round 2 contracts §2, as the frontend reads them. They mirror `docs/round2-contracts.md` until the backend
 * branch exports the same names from `@compass/contracts`; then these become re-exports.
 */
export type EvidenceColumnKind = 'text' | 'hotel' | 'date' | 'month' | 'number' | 'percent' | 'currency' | 'count' | 'id';

export interface EvidenceColumn {
  /** The row property. */
  key: string;
  /** "Occupancy", "On the books", "Hotel". */
  label: string;
  kind: EvidenceColumnKind;
  /** "EUR", "nights", "pts". `ratio` on a percent column means the value is a fraction (0.11 = 11%). */
  unit?: string;
  /** Ids, kinds and internal flags: not shown unless the person asks. */
  hidden?: boolean;
}

/** `Evidence` plus what Round 2 adds to it. Every addition is optional, so older transcripts still render. */
export type RichEvidence = Evidence & {
  /** The human title of the tool call, e.g. "Pace vs last year". */
  title?: string;
  columns?: EvidenceColumn[];
  /** Human names for `sources`, keyed by the raw source. */
  sourceLabels?: Record<string, string>;
};

export type EvidenceRow = Record<string, unknown>;

/**
 * One tool call as the evidence panel reads it. A `ChatStep` and a `tool_result` transcript entry both fit, so
 * either can be passed as is.
 */
export interface EvidenceEntry {
  callId: string;
  /** The tool name, e.g. `get_pace`. */
  name: string;
  args?: Record<string, unknown>;
  rows?: EvidenceRow[];
  evidence?: RichEvidence;
  /** `done`, `error`, or a live status while the call is running. */
  status?: string;
  error?: string;
}

/** `GET /api/hotels` (contracts §1). */
export interface HotelRef {
  code: string;
  name: string;
  city: string;
  country: string;
  region: string;
  brand: string;
  rooms: number;
}
