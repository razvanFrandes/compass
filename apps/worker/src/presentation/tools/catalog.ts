import { Grain, MetricKey, type DataResult } from '@compass/contracts';
import { z } from 'zod';
import type { DataError, HotelData } from '../../application/hotel-data.ts';
import type { Result } from '../../domain/result.ts';

/**
 * The data tools, defined once. Two adapters expose them: the public MCP server (Claude Desktop and any other
 * MCP client) and the Pi agents inside Compass. Both therefore share the same names, descriptions, argument
 * schemas, definitions and SQL guard.
 */

export type ToolOutcome =
  | { ok: true; text: string; structured: Record<string, unknown> }
  | { ok: false; text: string };

export interface DataTool<S extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  input: S;
  run(data: HotelData, args: z.infer<S>): Promise<ToolOutcome>;
}

const MAX_TEXT_ROWS = 60;

const hotels = z
  .array(z.string())
  .optional()
  .describe('Hotel codes, e.g. ["LIS", "AMS"]. Omit for the whole group. Use list_hotels for the codes.');
const isoDate = z.iso.date().describe('ISO date, YYYY-MM-DD');

/** Rows for the model as compact JSON (capped), plus the full rows and evidence as structured content. */
export function success(result: DataResult<object>): ToolOutcome {
  const shown = result.rows.slice(0, MAX_TEXT_ROWS);
  const more = result.rows.length > shown.length ? `\n(${result.rows.length - shown.length} more rows not shown)` : '';
  const ev = result.evidence;
  const definitions = Object.entries(ev.definitions).map(([k, v]) => `${k}: ${v}`);
  const text = [
    JSON.stringify(shown),
    more,
    definitions.length ? `\nDefinitions: ${definitions.join(' | ')}` : '',
    ev.notes.length ? `\nNotes: ${ev.notes.join(' ')}` : '',
    `\nBusiness date: ${ev.businessDate}. Sources: ${ev.sources.join(', ')}.`,
  ].join('');
  return { ok: true, text, structured: { rows: result.rows, evidence: ev } };
}

export function failure(error: DataError): ToolOutcome {
  const hint = error.kind === 'database' ? ' Fix the query and try again; call get_schema for table and column names.' : '';
  return { ok: false, text: `${error.message}${hint}` };
}

const fromResult = (result: Result<DataResult<object>, DataError>) => (result.ok ? success(result.value) : failure(result.error));

function tool<S extends z.ZodObject>(definition: DataTool<S>): DataTool<S> {
  return definition;
}

export const DATA_TOOLS = [
  tool({
    name: 'list_hotels',
    description: 'List the hotels of the group: code, name, brand, city, region, currency, rooms, meeting space.',
    input: z.object({}),
    run: async (data) => success(await data.listHotels()),
  }),
  tool({
    name: 'list_metrics',
    description: 'List the governed metrics get_metric can compute, with their definitions and units.',
    input: z.object({}),
    run: async (data) => {
      const { rows } = data.listMetrics();
      return { ok: true, text: JSON.stringify(rows), structured: { rows } };
    },
  }),
  tool({
    name: 'get_metric',
    description:
      'A governed hotel metric (occupancy, ADR, RevPAR, room revenue, rooms sold, MPI, ARI, RGI) per hotel and period, ' +
      'optionally against the same time last year. Ratios are computed from sums; money is in EUR.',
    input: z.object({
      metric: MetricKey,
      hotels,
      from: isoDate,
      to: isoDate,
      grain: Grain.default('month').describe('Bucket size of the period column'),
      compare: z.enum(['none', 'stly']).default('none').describe('stly adds compare_value: same period last year'),
    }),
    run: async (data, args) => fromResult(await data.getMetric(args)),
  }),
  tool({
    name: 'get_pickup',
    description:
      'Booking pickup: rooms added to the books in the last daysBack days for the next horizonDays nights, as a share ' +
      'of capacity, per hotel. Compare a hotel with its region to spot slow pickup.',
    input: z.object({
      hotels,
      region: z.enum(['Europe', 'North America', 'South America', 'Middle East', 'Asia']).optional(),
      daysBack: z.number().int().min(1).max(90).default(21),
      horizonDays: z.number().int().min(1).max(180).default(44),
    }),
    run: async (data, args) => success(await data.getPickup(args)),
  }),
  tool({
    name: 'get_pace',
    description:
      'Pace: room nights on the books for the next daysAhead nights against the same point last year, per hotel, with pace_pct.',
    input: z.object({ hotels, daysAhead: z.number().int().min(7).max(365).default(90) }),
    run: async (data, args) => success(await data.getPace(args)),
  }),
  tool({
    name: 'get_rate_position',
    description:
      'Rate position: our BAR against the comp set median from the latest rate shop, per future night (bar_vs_comp 1.00 = at the median).',
    input: z.object({ hotels, from: isoDate.optional(), to: isoDate.optional() }),
    run: async (data, args) => success(await data.getRatePosition(args)),
  }),
  tool({
    name: 'get_channel_mix',
    description: 'Channel mix: room nights, gross revenue, commission and net revenue by booking channel, in EUR.',
    input: z.object({ hotels, from: isoDate, to: isoDate }),
    run: async (data, args) => success(await data.getChannelMix(args)),
  }),
  tool({
    name: 'get_data_health',
    description:
      'Data health: last sync and status of each source system (PMS, RMS, POS, …) per hotel. Check it before trusting a sudden drop.',
    input: z.object({ hotels }),
    run: async (data, args) => success(await data.getDataHealth(args)),
  }),
  tool({
    name: 'get_schema',
    description: 'The database schema (tables, views, columns) and the SQL helper functions, for writing run_readonly_query.',
    input: z.object({}),
    run: async (data) => {
      const text = await data.getSchema();
      return { ok: true, text, structured: { schema: text } };
    },
  }),
  tool({
    name: 'run_readonly_query',
    description:
      'Run one read-only PostgreSQL SELECT over schema hotel when no specific tool fits. Capped at 200 rows, 5 s timeout. ' +
      'Call get_schema first. Convert money to EUR with hotel.eur_rate() before comparing hotels.',
    input: z.object({ sql: z.string().min(1).describe('One SELECT or WITH … SELECT statement') }),
    run: async (data, args) => fromResult(await data.runReadonlyQuery(args.sql)),
  }),
] as const satisfies readonly DataTool[];
