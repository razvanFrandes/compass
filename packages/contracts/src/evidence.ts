import { z } from 'zod';

/**
 * Where a number came from. Every data tool returns one, so the UI can always answer
 * "how was this computed?" (principle: evidence is one click away).
 */
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
});
export type Evidence = z.infer<typeof Evidence>;

/** What every data tool returns: rows the UI can render, plus their evidence. */
export interface DataResult<Row = Record<string, unknown>> {
  rows: Row[];
  evidence: Evidence;
}
