/**
 * The morning brief: what changed across the portfolio and why it matters, ranked by money.
 * Items are found by fixed SQL detectors; the model only writes the sentence that explains each one.
 */

export type BriefKind =
  | 'data_stale'
  | 'pace_behind'
  | 'underpriced_demand'
  | 'account_loss'
  | 'web_conversion_drop'
  | 'staffing_gap'
  | 'rooms_out_of_order'
  | 'gop_miss';

export interface BriefItem {
  /** Stable for the day: `<kind>:<hotel>[:<detail>]`. */
  id: string;
  kind: BriefKind;
  hotel_code: string;
  hotel_name: string;
  /** `critical` items (a broken data feed) come first; the rest are ranked by money impact. */
  severity: 'critical' | 'warning';
  /** Signed money impact in EUR: negative is revenue lost or at risk, positive is revenue left on the table. Null when it cannot be priced. */
  impact_eur: number | null;
  /** What the impact means, e.g. "room revenue on the books vs last year, next 45 nights". */
  impact_basis: string;
  /** A deterministic one-line title, used when the model's summary is unavailable. */
  title: string;
  /** The detector's numbers, for the card and for the model. */
  facts: Record<string, number | string>;
  /** The question to open in Kassandra ("Explore"). */
  question: string;
  sources: string[];
}

export interface Brief {
  businessDate: string;
  generatedAt: string;
  /** Ranked: critical first, then by absolute money impact. */
  items: (BriefItem & {
    /** The model's explanation: one or two sentences, only from `facts`. Absent if generation failed. */
    summary?: string;
  })[];
  /** How the summaries were written, for the "AI" label and the cost meter. */
  model: string | null;
  usage: { tokens: number; costUsd: number };
}
