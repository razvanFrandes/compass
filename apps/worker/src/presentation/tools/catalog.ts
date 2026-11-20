import { Grain, MetricKey, type DataResult } from '@compass/contracts';
import { z } from 'zod';
import { PNL_LINES } from '../../application/finance-data.ts';
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
const rollUp = z.enum(['hotel', 'region', 'brand', 'group']).default('hotel').describe('What one row is');
const bucket = z.enum(['day', 'week', 'month', 'total']).describe('Bucket size; total gives one row for the whole period');

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
      'A governed hotel metric (occupancy, ADR, RevPAR, room revenue, rooms sold, MPI, ARI, RGI) per period, per hotel or ' +
      'rolled up by region, brand or the whole group, optionally against the same time last year. Ratios are computed from ' +
      'sums; money is in EUR. MPI, ARI and RGI are per hotel only.',
    input: z.object({
      metric: MetricKey,
      hotels,
      by: z.enum(['hotel', 'region', 'brand', 'group']).default('hotel').describe('What one row is'),
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
    name: 'get_mix',
    description:
      'Business mix: room nights, share of room nights, revenue and ADR in EUR by segment (RET, ADV, COR corporate, GRP, WHL, PKG), ' +
      'by channel or by channel type (direct, OTA, GDS, wholesale). Compare two periods to see a shift, e.g. corporate replaced by OTA.',
    input: z.object({
      hotels,
      from: isoDate,
      to: isoDate,
      grain: bucket.default('month'),
      by: z.enum(['segment', 'channel', 'channel_type']),
      basis: z
        .enum(['stay', 'booked'])
        .default('stay')
        .describe('stay: nights staying in the period; booked: nights of reservations made in the period (where new demand comes from)'),
    }),
    run: async (data, args) => success(await data.getMix(args)),
  }),
  tool({
    name: 'get_account_production',
    description:
      'Room nights per company account (corporate clients, wholesalers) in the period vs the period of the same length just before, ' +
      'with first and last stay dates. Sorted by biggest decline first. A lost account usually left months ago: use a long ' +
      'window (e.g. the last 6 months vs the 6 before) to find it.',
    input: z.object({
      hotels,
      from: isoDate,
      to: isoDate,
      limit: z.number().int().min(1).max(50).default(15),
      sort: z.enum(['decline', 'volume']).default('decline'),
    }),
    run: async (data, args) => success(await data.getAccountProduction(args)),
  }),
  tool({
    name: 'get_fnb',
    description:
      'Food & beverage: covers and revenue in EUR per outlet type and meal period, with covers per occupied room (capture of in-house demand).',
    input: z.object({
      hotels,
      from: isoDate,
      to: isoDate,
      grain: bucket.default('week'),
      mealPeriods: z.array(z.enum(['breakfast', 'lunch', 'dinner', 'all_day'])).optional(),
    }),
    run: async (data, args) => success(await data.getFnb(args)),
  }),
  tool({
    name: 'get_labor',
    description:
      'Staffing per department: hours the workload required vs scheduled vs actually worked, staffing_pct, overtime and labour cost in EUR.',
    input: z.object({
      hotels,
      department: z
        .enum(['Front Office', 'Housekeeping', 'Kitchen', 'F&B Service', 'Maintenance', 'Sales & Marketing', 'Administration & General'])
        .optional(),
      from: isoDate,
      to: isoDate,
      grain: bucket.default('week'),
    }),
    run: async (data, args) => success(await data.getLabor(args)),
  }),
  tool({
    name: 'get_review_scores',
    description: 'Guest review scores (0–10): overall, staff, cleanliness, comfort, location, value and food, with the review count.',
    input: z.object({ hotels, from: isoDate, to: isoDate, grain: bucket.default('month') }),
    run: async (data, args) => success(await data.getReviewScores(args)),
  }),
  tool({
    name: 'search_reviews',
    description: 'Guest review quotes containing a phrase (case-insensitive), newest first. Use it to hear the guests behind a score change.',
    input: z.object({
      hotels,
      text: z.string().min(2).max(100).describe('Phrase to find, e.g. "noise", "breakfast", "slow"'),
      from: isoDate.optional(),
      to: isoDate.optional(),
      limit: z.number().int().min(1).max(30).default(10),
    }),
    run: async (data, args) => success(await data.searchReviews(args)),
  }),
  tool({
    name: 'get_web_funnel',
    description:
      'Hotel website booking funnel by device or traffic source: sessions, searches, checkout starts, bookings, conversion and checkout completion.',
    input: z.object({ hotels, from: isoDate, to: isoDate, grain: bucket.default('week'), by: z.enum(['device', 'source']) }),
    run: async (data, args) => success(await data.getWebFunnel(args)),
  }),
  tool({
    name: 'get_inventory',
    description: 'Room inventory: physical rooms, rooms out of order (renovation, maintenance) and room nights available.',
    input: z.object({ hotels, from: isoDate, to: isoDate, grain: bucket.default('week') }),
    run: async (data, args) => success(await data.getInventory(args)),
  }),
  // Finance, forecast, meetings & events and lost business (application/finance-data.ts)
  tool({
    name: 'get_pnl',
    description:
      'Finance: the USALI P&L in EUR per month or for a whole period, per hotel or rolled up by region, brand or group. Actual for ' +
      'closed months, forecast for the current and future ones, against budget and last year: revenue and GOP with variance in EUR ' +
      'and %, GOP margin and flowthrough (Δ GOP ÷ Δ revenue). view "lines" lists every line (rooms, F&B, M&E and other revenue, ' +
      'departmental and undistributed expenses) with favourable or unfavourable variance. Use it for budget, profit and cost questions.',
    input: z.object({
      hotels,
      by: rollUp,
      from: isoDate,
      to: isoDate,
      grain: z.enum(['month', 'total']).default('month').describe('month, or total for one row for the whole period (e.g. year to date)'),
      view: z.enum(['summary', 'lines']).default('summary').describe('summary: revenue and GOP; lines: every P&L line'),
      lines: z.array(z.enum(PNL_LINES)).optional().describe('With view "lines": only these lines'),
    }),
    run: async (data, args) => fromResult(await data.finance.getPnl(args)),
  }),
  tool({
    name: 'get_forecast',
    description:
      'Forecast for the coming months: room nights, occupancy and room revenue in EUR as a P10–P50–P90 range, per hotel or rolled up, ' +
      'with what is on the books now vs the same time last year and the budget (and whether the budget sits below, within or above ' +
      'the range). The current month includes its actual nights. Always quote a forecast as a range, not one number.',
    input: z.object({
      hotels,
      by: rollUp,
      from: isoDate.optional().describe('Default: the current month'),
      to: isoDate.optional().describe('Default: the end of the forecast horizon'),
      grain: z.enum(['month', 'total']).default('month'),
    }),
    run: async (data, args) => fromResult(await data.finance.getForecast(args)),
  }),
  tool({
    name: 'get_meetings_events',
    description:
      'Meetings & events: definite events, attendees and M&E revenue in EUR (space hire, banquet F&B, AV), revenue per sqm of ' +
      'meeting space and meeting-room utilisation per period, per hotel or rolled up. Future dates show the pipeline, with ' +
      'tentative events and their revenue apart.',
    input: z.object({ hotels, by: rollUp, from: isoDate, to: isoDate, grain: bucket.default('month') }),
    run: async (data, args) => success(await data.finance.getMeetingsEvents(args)),
  }),
  tool({
    name: 'get_lost_business',
    description:
      'Demand turned away: requests and room nights lost to price (the guest saw our rate and left) vs no availability (we were ' +
      'full), with an estimated value at BAR in EUR. Read it next to get_rate_position: many price regrets = priced too high; ' +
      'many denials = full, so the rate could have been higher.',
    input: z.object({
      hotels,
      by: rollUp,
      from: isoDate,
      to: isoDate,
      grain: bucket.default('month'),
      basis: z.enum(['arrival', 'request']).default('arrival').describe('arrival: by stay date; request: by the day the guest asked'),
      detail: z.enum(['none', 'segment', 'channel']).default('none').describe('Split each reason further by segment or channel'),
    }),
    run: async (data, args) => success(await data.finance.getLostBusiness(args)),
  }),
  tool({
    name: 'get_brief',
    description:
      "Today's morning brief findings across all hotels: stale data feeds, pace behind last year, underpriced high-demand " +
      'nights, lost accounts, website conversion drops, staffing gaps and rooms out of order, each priced in EUR and ranked by money. ' +
      'Start here for "what should I look at today?"',
    input: z.object({}),
    run: async (data) => success(await data.getBriefItems()),
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
