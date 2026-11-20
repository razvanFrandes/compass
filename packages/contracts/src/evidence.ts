import { z } from 'zod';

/**
 * Where a number came from. Every data tool returns one, so the UI can always answer
 * "how was this computed?" (principle: evidence is one click away).
 */
/**
 * How to show one column of a tool's rows: a label a hotelier reads, what the value is, its unit, and whether the
 * column is plumbing (ids, internal flags) that the UI hides by default.
 */
export const EvidenceColumnKind = z.enum(['text', 'hotel', 'date', 'month', 'number', 'percent', 'currency', 'count', 'id']);
export type EvidenceColumnKind = z.infer<typeof EvidenceColumnKind>;

export const EvidenceColumn = z.object({
  /** The row property. */
  key: z.string(),
  /** "Occupancy", "On the books", "Hotel". */
  label: z.string(),
  /** `hotel` is a hotel code (show the name); `month` and `date` are ISO dates; `id` is plumbing. */
  kind: EvidenceColumnKind,
  /** "EUR", "room nights", "pts". */
  unit: z.string().optional(),
  /** Ids, kinds, internal flags: hidden by default in the UI. */
  hidden: z.boolean().optional(),
});
export type EvidenceColumn = z.infer<typeof EvidenceColumn>;

export const Evidence = z.object({
  /** Tables, views or functions the query read, e.g. `hotel.v_hotel_day`. */
  sources: z.array(z.string()),
  /** Plain-language metric definitions that apply, keyed by metric. */
  definitions: z.record(z.string(), z.string()),
  /** The period the rows cover, as ISO dates (inclusive). */
  period: z.object({ from: z.string(), to: z.string() }).nullable(),
  /** The exact SQL that ran, with its parameters. */
  sql: z.string(),
  params: z.array(z.unknown()),
  rowCount: z.number().int(),
  /** The data's "today": stays before it are actuals, from it on are on the books. */
  businessDate: z.string(),
  notes: z.array(z.string()),
  /** One entry per row property, in display order. Every catalog tool sends it; a custom query's are inferred. */
  columns: z.array(EvidenceColumn).optional(),
  /** The tool's human title, e.g. "Pace vs last year". */
  title: z.string().optional(),
  /** A human name for each entry of `sources`, e.g. `hotel.v_hotel_day` → "Daily hotel performance". */
  sourceLabels: z.record(z.string(), z.string()).optional(),
});
export type Evidence = z.infer<typeof Evidence>;

/** What every data tool returns: rows the UI can render, plus their evidence. */
export interface DataResult<Row = Record<string, unknown>> {
  rows: Row[];
  evidence: Evidence;
}
