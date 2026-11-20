import { Grain, MetricKey, type DataResult } from '@compass/contracts';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { DataError, HotelData } from '../../application/hotel-data.ts';
import type { Result } from '../../domain/result.ts';

/**
 * The Compass MCP server: the single door to the hotel data. The in-app agents (Pi) and any outside client
 * (Claude Desktop, ChatGPT…) use these same tools, so they share one set of definitions and one SQL guard.
 */

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const MAX_TEXT_ROWS = 60;

const hotels = z
  .array(z.string())
  .optional()
  .describe('Hotel codes, e.g. ["LIS", "AMS"]. Omit for the whole group. Use list_hotels for the codes.');
const isoDate = z.iso.date().describe('ISO date, YYYY-MM-DD');

type ToolResult = {
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** Rows for the model as compact JSON (capped), plus the full rows and evidence as structured content. */
function success(result: DataResult<object>): ToolResult {
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
  return { content: [{ type: 'text', text }], structuredContent: { rows: result.rows, evidence: ev } };
}

function failure(error: DataError): ToolResult {
  const hint =
    error.kind === 'database' ? ' Fix the query and try again; call get_schema for table and column names.' : '';
  return { content: [{ type: 'text', text: `${error.message}${hint}` }], isError: true };
}

const fromResult = (result: Result<DataResult<object>, DataError>) => (result.ok ? success(result.value) : failure(result.error));

export function createCompassMcpServer(data: HotelData): McpServer {
  const server = new McpServer(
    { name: 'compass-hotels', version: '0.1.0' },
    {
      instructions:
        'Hotel analytics for Halcyon Hospitality Group (20 hotels, fictional data). Prefer get_metric and the other ' +
        'specific tools; use run_readonly_query only when none fits. Never compute numbers yourself: quote the rows. ' +
        'Every result carries its evidence (definitions, sources, SQL).',
    },
  );

  server.registerTool(
    'list_hotels',
    {
      description: 'List the hotels of the group: code, name, brand, city, region, currency, rooms, meeting space.',
      annotations: READ_ONLY,
    },
    async () => success(await data.listHotels()),
  );

  server.registerTool(
    'list_metrics',
    {
      description: 'List the governed metrics get_metric can compute, with their definitions and units.',
      annotations: READ_ONLY,
    },
    async () => {
      const { rows } = data.listMetrics();
      return { content: [{ type: 'text', text: JSON.stringify(rows) }], structuredContent: { rows } };
    },
  );

  server.registerTool(
    'get_metric',
    {
      description:
        'A governed hotel metric (occupancy, ADR, RevPAR, room revenue, rooms sold, MPI, ARI, RGI) per hotel and period, ' +
        'optionally against the same time last year. Ratios are computed from sums; money is in EUR.',
      inputSchema: z.object({
        metric: MetricKey,
        hotels,
        from: isoDate,
        to: isoDate,
        grain: Grain.default('month').describe('Bucket size of the period column'),
        compare: z.enum(['none', 'stly']).default('none').describe('stly adds compare_value: same period last year'),
      }),
      annotations: READ_ONLY,
    },
    async (args) => fromResult(await data.getMetric(args)),
  );

  server.registerTool(
    'get_pickup',
    {
      description:
        'Booking pickup: rooms added to the books in the last daysBack days for the next horizonDays nights, as a share ' +
        'of capacity, per hotel. Compare a hotel with its region to spot slow pickup.',
      inputSchema: z.object({
        hotels,
        region: z.enum(['Europe', 'North America', 'South America', 'Middle East', 'Asia']).optional(),
        daysBack: z.number().int().min(1).max(90).default(21),
        horizonDays: z.number().int().min(1).max(180).default(44),
      }),
      annotations: READ_ONLY,
    },
    async (args) => success(await data.getPickup(args)),
  );

  server.registerTool(
    'get_pace',
    {
      description:
        'Pace: room nights on the books for the next daysAhead nights against the same point last year, per hotel, with pace_pct.',
      inputSchema: z.object({ hotels, daysAhead: z.number().int().min(7).max(365).default(90) }),
      annotations: READ_ONLY,
    },
    async (args) => success(await data.getPace(args)),
  );

  server.registerTool(
    'get_rate_position',
    {
      description:
        'Rate position: our BAR against the comp set median from the latest rate shop, per future night (bar_vs_comp 1.00 = at the median).',
      inputSchema: z.object({ hotels, from: isoDate.optional(), to: isoDate.optional() }),
      annotations: READ_ONLY,
    },
    async (args) => success(await data.getRatePosition(args)),
  );

  server.registerTool(
    'get_channel_mix',
    {
      description: 'Channel mix: room nights, gross revenue, commission and net revenue by booking channel, in EUR.',
      inputSchema: z.object({ hotels, from: isoDate, to: isoDate }),
      annotations: READ_ONLY,
    },
    async (args) => success(await data.getChannelMix(args)),
  );

  server.registerTool(
    'get_data_health',
    {
      description:
        'Data health: last sync and status of each source system (PMS, RMS, POS, …) per hotel. Check it before trusting a sudden drop.',
      inputSchema: z.object({ hotels }),
      annotations: READ_ONLY,
    },
    async (args) => success(await data.getDataHealth(args)),
  );

  server.registerTool(
    'get_schema',
    {
      description: 'The database schema (tables, views, columns) and the SQL helper functions, for writing run_readonly_query.',
      annotations: READ_ONLY,
    },
    async () => ({ content: [{ type: 'text', text: await data.getSchema() }] }),
  );

  server.registerTool(
    'run_readonly_query',
    {
      description:
        'Run one read-only PostgreSQL SELECT over schema hotel when no specific tool fits. Capped at 200 rows, 5 s timeout. ' +
        'Call get_schema first. Convert money to EUR with hotel.eur_rate() before comparing hotels.',
      inputSchema: z.object({ sql: z.string().min(1).describe('One SELECT or WITH … SELECT statement') }),
      annotations: READ_ONLY,
    },
    async ({ sql }) => fromResult(await data.runReadonlyQuery(sql)),
  );

  return server;
}
