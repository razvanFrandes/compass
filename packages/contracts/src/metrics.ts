import { z } from 'zod';

export const MetricKey = z.enum([
  'occupancy',
  'adr',
  'revpar',
  'room_revenue',
  'rooms_sold',
  'mpi',
  'ari',
  'rgi',
]);
export type MetricKey = z.infer<typeof MetricKey>;

/** `total` gives one row for the whole period. */
export const Grain = z.enum(['day', 'week', 'month', 'total']);
export type Grain = z.infer<typeof Grain>;

/** `stly`: same time last year (−364 days, so weekdays line up). */
export const Compare = z.enum(['none', 'stly']);
export type Compare = z.infer<typeof Compare>;

export const Unit = z.enum(['percent', 'eur', 'index', 'count']);
export type Unit = z.infer<typeof Unit>;

/** What one row is: a hotel, or a roll-up of hotels by region, brand or the whole group. */
export const MetricLevel = z.enum(['hotel', 'region', 'brand', 'group']);
export type MetricLevel = z.infer<typeof MetricLevel>;

/** A reference to a governed metric. The model emits this, never the number itself. */
export const MetricQuery = z.object({
  metric: MetricKey,
  hotels: z.array(z.string()).optional(),
  by: MetricLevel.default('hotel'),
  from: z.iso.date(),
  to: z.iso.date(),
  grain: Grain.default('month'),
  compare: Compare.default('none'),
});
export type MetricQuery = z.infer<typeof MetricQuery>;
/** A MetricQuery before defaults (by: hotel, grain: month, compare: none) are applied. */
export type MetricQueryInput = z.input<typeof MetricQuery>;

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: Unit;
  definition: string;
  source: string;
}

export interface MetricRow {
  period: string;
  /** Hotel code, region, brand name or "Halcyon group", depending on `by`. */
  key: string;
  value: number | null;
  compare_value?: number | null;
  /** value − compare_value, and the same in % of compare_value (only with compare: stly). */
  change?: number | null;
  change_pct?: number | null;
}
