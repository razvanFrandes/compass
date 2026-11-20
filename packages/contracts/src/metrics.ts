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

export const Grain = z.enum(['day', 'week', 'month']);
export type Grain = z.infer<typeof Grain>;

/** `stly`: same time last year (−364 days, so weekdays line up). */
export const Compare = z.enum(['none', 'stly']);
export type Compare = z.infer<typeof Compare>;

export const Unit = z.enum(['percent', 'eur', 'index', 'count']);
export type Unit = z.infer<typeof Unit>;

/** A reference to a governed metric. The model emits this, never the number itself. */
export const MetricQuery = z.object({
  metric: MetricKey,
  hotels: z.array(z.string()).optional(),
  from: z.iso.date(),
  to: z.iso.date(),
  grain: Grain.default('month'),
  compare: Compare.default('none'),
});
export type MetricQuery = z.infer<typeof MetricQuery>;

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: Unit;
  definition: string;
  source: string;
}

export interface MetricRow {
  period: string;
  hotel_code: string;
  value: number | null;
  compare_value?: number | null;
}
