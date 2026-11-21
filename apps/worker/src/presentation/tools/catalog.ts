import { Grain, MetricKey, type DataResult, type Evidence } from '@compass/contracts';
import { z } from 'zod';
import { PNL_LINES, type FinanceError } from '../../application/finance-data.ts';
import type { DataError, HotelData } from '../../application/hotel-data.ts';
import type { Result } from '../../domain/result.ts';
import { hotelsInScope } from '../../domain/scope.ts';
import { escapeUntrusted, untrustedBlock } from '../../domain/untrusted.ts';
import { failureText } from './run-tool.ts';
import { sourceLabelsFor, TOOL_VIEWS } from './tool-views.ts';

/**
 * The data tools, defined once. Two adapters expose them: the public MCP server (Claude Desktop and any other
 * MCP client) and the Pi agents inside Compass. Both therefore share the same names, descriptions, argument
 * schemas, definitions and SQL guard.
 */

export type ToolOutcome =
  | { ok: true; text: string; structured: Record<string, unknown> }
  /** `text` is all a model or an MCP client may read. `cause` is the real error, for runTool to log. */
  | { ok: false; text: string; cause?: unknown };

export interface DataTool<S extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  input: S;
  /**
   * `scope` is the hotel scope of the conversation (hotel codes; empty or absent for the whole group). A tool with a
   * `hotels` argument gets it already cut down to the scope; a tool without one passes the scope to the data layer.
   */
  run(data: HotelData, args: z.infer<S>, scope?: readonly string[]): Promise<ToolOutcome>;
}

/** Tools without a `hotels` argument whose rows are per hotel: the data layer filters them by the scope. */
export const SCOPE_ROW_TOOLS: readonly string[] = ['list_hotels', 'get_brief', 'run_readonly_query'];
/** Tools that read no hotel data (the metric catalog, the schema): a scope changes nothing. */
export const SCOPE_FREE_TOOLS: readonly string[] = ['list_metrics', 'get_schema'];

const MAX_TEXT_ROWS = 60;
/** The rows in the model text never take more characters than this, counted as the model reads them (after escaping). */
const MAX_TEXT_CHARS = 50_000;

const hotels = z
  .array(z.string())
  .optional()
  .describe('Hotel codes, e.g. ["LIS", "AMS"]. Omit for the whole group. Use list_hotels for the codes.');
const isoDate = z.iso.date().describe('ISO date, YYYY-MM-DD');
const rollUp = z.enum(['hotel', 'region', 'brand', 'group']).default('hotel').describe('What one row is');
const REGIONS = ['Europe', 'North America', 'South America', 'Middle East', 'Asia'] as const;
const bucket = z.enum(['day', 'week', 'month', 'total']).describe('Bucket size; total gives one row for the whole period');

/**
 * Rows for the model as compact JSON (capped), plus the full rows and evidence as structured content.
 * Pass `untrusted` (a source label) when the rows carry free text from outside, e.g. guest reviews: the model then
 * reads them inside <untrusted_data>, as data. The structured rows for the UI stay as they are.
 */
export function success(result: DataResult<object>, untrusted?: string): ToolOutcome {
  const shown: string[] = [];
  let length = 2; // the brackets
  for (const row of result.rows) {
    if (shown.length >= MAX_TEXT_ROWS) break;
    const rowJson = untrusted ? escapeUntrusted(JSON.stringify(row)) : JSON.stringify(row);
    length += rowJson.length + 1; // and its comma
    if (length > MAX_TEXT_CHARS) break;
    shown.push(rowJson);
  }
  const hidden = result.rows.length - shown.length;
  const more = hidden ? `\n… ${hidden} more rows not shown.` : '';
  const ev = result.evidence;
  const definitions = Object.entries(ev.definitions).map(([k, v]) => `${k}: ${v}`);
  const json = `[${shown.join(',')}]`;
  const text = [
    untrusted ? untrustedBlock(json, untrusted) : json,
    more,
    definitions.length ? `\nDefinitions: ${definitions.join(' | ')}` : '',
    ev.notes.length ? `\nNotes: ${ev.notes.join(' ')}` : '',
    `\nBusiness date: ${ev.businessDate}. Sources: ${ev.sources.join(', ')}.`,
  ].join('');
  return { ok: true, text, structured: { rows: result.rows, evidence: ev } };
}

/**
 * What the model reads when a tool fails. Only a failing custom query (`database`, from run_readonly_query) shows
 * database error text. Any other database failure shows the fixed text of its class (temporary, timeout, fault: what
 * to do next), an embedder failure its own message, and the cause goes to the logs.
 */
export function failure(error: DataError | FinanceError): ToolOutcome {
  switch (error.kind) {
    case 'internal':
      return { ok: false, text: failureText(error.cause), cause: error.cause };
    case 'unavailable':
      return { ok: false, text: error.message, cause: error.cause };
    case 'database':
      return { ok: false, text: `${error.message} Fix the query and try again; call get_schema for table and column names.` };
    default:
      return { ok: false, text: error.message };
  }
}

const fromResult = (result: Result<DataResult<object>, DataError | FinanceError>, untrusted?: string) =>
  result.ok ? success(result.value, untrusted) : failure(result.error);

/**
 * Adds what the UI needs to show the rows (tool-views.ts): the tool's human title, a column per row property and a
 * name for each source. It goes into the evidence, so the model's text is unchanged.
 */
function withView(name: string, args: Record<string, unknown>, outcome: ToolOutcome): ToolOutcome {
  const view = TOOL_VIEWS[name];
  if (!outcome.ok || !view) return outcome;
  const { rows, evidence } = outcome.structured as { rows?: unknown; evidence?: Evidence };
  if (!evidence || !Array.isArray(rows)) return outcome;
  const shown: Evidence = {
    ...evidence,
    title: view.titleFor?.(args) ?? view.title,
    columns: view.columns(args, rows as Record<string, unknown>[]),
    sourceLabels: sourceLabelsFor(evidence.sources),
  };
  return { ...outcome, structured: { ...outcome.structured, evidence: shown } };
}

/**
 * Says in the model's text and in the evidence that the rows are limited to the scope, and which hotels of the call
 * were left out, so neither the model nor the reader takes them for the whole group.
 */
function withScopeNote(outcome: ToolOutcome, scope: readonly string[], outside: readonly string[]): ToolOutcome {
  if (!outcome.ok) return outcome;
  const note = `Limited to the hotels selected: ${scope.join(', ')}.${outside.length ? ` Left out, not among them: ${outside.join(', ')}.` : ''}`;
  const evidence = (outcome.structured as { evidence?: Evidence }).evidence;
  return {
    ...outcome,
    text: `${outcome.text}\n${note}`,
    structured: evidence ? { ...outcome.structured, evidence: { ...evidence, notes: [...evidence.notes, note] } } : outcome.structured,
  };
}

/**
 * Wraps a tool's own `run` with what every tool shares: the hotel scope (a `hotels` argument is cut down to it, a call
 * only for hotels outside it is refused before any read) and the view of its rows.
 */
function tool<S extends z.ZodObject>(definition: DataTool<S>): DataTool<S> {
  const takesHotels = 'hotels' in definition.input.shape;
  return {
    ...definition,
    run: async (data, args, scope = []) => {
      if (!scope.length || SCOPE_FREE_TOOLS.includes(definition.name)) return withView(definition.name, args, await definition.run(data, args));
      let scoped = args;
      let outside: string[] = [];
      if (takesHotels) {
        const within = hotelsInScope(scope, (args as { hotels?: string[] }).hotels);
        if (!within.hotels?.length) {
          const many = within.outside.length > 1;
          return { ok: false, text: `${within.outside.join(', ')} ${many ? 'are' : 'is'} outside the hotels you are answering for (${scope.join(', ')}). Use only those hotels.` };
        }
        scoped = { ...args, hotels: within.hotels };
        outside = within.outside;
      }
      return withScopeNote(withView(definition.name, scoped, await definition.run(data, scoped, scope)), scope, outside);
    },
  };
}

export const DATA_TOOLS = [
  tool({
    name: 'list_hotels',
    description: 'List the hotels of the group: code, name, brand, city, region, currency, rooms, meeting space.',
    input: z.object({}),
    run: async (data, _args, scope) => success(await data.listHotels(scope)),
  }),
  tool({
    name: 'list_metrics',
    description: 'List the metrics get_metric can compute, with their fixed definitions and units.',
    input: z.object({}),
    run: async (data) => {
      const { rows } = data.listMetrics();
      const evidence: Evidence = {
        sources: ['governed metric catalog'],
        definitions: {},
        period: null,
        sql: '',
        params: [],
        rowCount: rows.length,
        businessDate: await data.businessDate(),
        notes: ['These definitions are fixed in Compass. Every ratio is computed from sums, never from an average of ratios.'],
      };
      return { ok: true, text: JSON.stringify(rows), structured: { rows, evidence } };
    },
  }),
  tool({
    name: 'get_metric',
    description:
      'A hotel metric with a fixed definition (occupancy, ADR, RevPAR, room revenue, rooms sold, MPI, ARI, RGI) per period, per hotel or ' +
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
    name: 'get_kpis',
    description:
      'The headline figures of a period in ONE row per hotel, region, brand or the whole group: occupancy, ADR, RevPAR, room ' +
      'revenue and rooms sold, each next to the same period last year (the _ly columns). Per hotel the row also has its region and ' +
      'its comp set indices (mpi, ari, rgi; actuals only). Use it for "the headline KPIs" (by group or region: one row, a kpi_row), ' +
      'to compare hotels on two measures at once (a scatter of ari against mpi, or adr_eur against occupancy_pct) and for revenue ' +
      'by hotel inside its region (a treemap). For a trend over time use get_metric.',
    input: z.object({
      hotels,
      region: z.enum(REGIONS).optional().describe('Only the hotels of this region'),
      by: rollUp,
      from: isoDate,
      to: isoDate,
    }),
    run: async (data, args) => fromResult(await data.getKpis(args)),
  }),
  tool({
    name: 'get_pickup',
    description:
      'Booking pickup: rooms added to the books in the last daysBack days for the next horizonDays nights, as a share ' +
      'of capacity, per hotel. Compare a hotel with its region to spot slow pickup.',
    input: z.object({
      hotels,
      region: z.enum(REGIONS).optional(),
      daysBack: z.number().int().min(1).max(90).default(21),
      horizonDays: z.number().int().min(1).max(180).default(44),
    }),
    run: async (data, args) => success(await data.getPickup(args)),
  }),
  tool({
    name: 'get_pace',
    description:
      'Pace: room nights on the books for the next daysAhead nights against the same point last year, per hotel, with pace_pct. ' +
      'Pass from and to for the pace of a window of stay dates (e.g. December). grain "day" gives it night by night (rooms_otb ' +
      'next to rooms_otb_stly per stay date): the pace curve a line chart draws.',
    input: z.object({
      hotels,
      daysAhead: z.number().int().min(7).max(365).default(90),
      from: isoDate.optional().describe('First stay date of the window. Default: the business date'),
      to: isoDate.optional().describe('Last stay date of the window. Default: daysAhead nights from the business date'),
      grain: z.enum(['total', 'day']).default('total').describe('total: one row per hotel; day: one row per hotel and stay date'),
    }),
    run: async (data, args) => success(await data.getPace(args)),
  }),
  tool({
    name: 'get_rate_position',
    description:
      'Rate position: our BAR against the comp set median from the latest rate shop, per future night (bar_vs_comp 1.00 = at the ' +
      'median), with the occupancy on the books of that night (occupancy_otb_pct): a night that is filling while priced under the ' +
      'median is underpriced. grain "total" gives one row per hotel for the whole window (average BAR against the average median).',
    input: z.object({
      hotels,
      from: isoDate.optional(),
      to: isoDate.optional(),
      grain: z.enum(['night', 'total']).default('night').describe('night: one row per hotel and night; total: one row per hotel for the window'),
    }),
    run: async (data, args) => success(await data.getRatePosition(args)),
  }),
  tool({
    name: 'get_channel_mix',
    description:
      'Channel mix: room nights, gross revenue, commission (also as a share of gross, commission_pct) and net revenue by booking channel, in EUR. shape "hotel" gives a row ' +
      'per hotel and channel; "total" one row per channel summed over the hotels (the parts of one whole); "flows" one row per ' +
      'channel and where its revenue lands (Net revenue or Commission), which is what a sankey draws.',
    input: z.object({
      hotels,
      from: isoDate,
      to: isoDate,
      shape: z.enum(['hotel', 'total', 'flows']).default('hotel').describe('hotel: per hotel and channel; total: per channel over the hotels; flows: channel → Net revenue / Commission'),
    }),
    run: async (data, args) => success(await data.getChannelMix(args)),
  }),
  tool({
    name: 'get_mix',
    description:
      'Business mix: room nights, share of room nights, revenue and ADR in EUR by segment (transient retail, advance purchase, corporate, group, wholesale, leisure package), ' +
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
      rollUp: z.boolean().default(false).describe('true: one row per period and key, summed over the hotels, for the mix of a region or the group'),
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
    run: async (data, args) => success(await data.getAccountProduction(args), 'account names'),
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
    run: async (data, args) => success(await data.searchReviews(args), 'guest reviews'),
  }),
  tool({
    name: 'find_reviews',
    description:
      'Search guest reviews by meaning, not exact words: "what do guests say about breakfast", "noise from building works". ' +
      'Returns the review sentences closest to the question (complaints from negative_text, praise from positive_text) with ' +
      'similarity, how many reviews in scope say it (mentions, share_pct, first and last date, per hotel) and the latest such ' +
      'review (hotel, date, source, score). Defaults to the last 90 days. Use search_reviews for an exact phrase.',
    input: z.object({
      question: z.string().min(2).max(300).describe('What to look for, in plain words, e.g. "food quality and slow dinner service"'),
      hotels,
      from: isoDate.optional().describe('ISO date, YYYY-MM-DD. Default: 90 days before `to`'),
      to: isoDate.optional().describe('ISO date, YYYY-MM-DD. Default: the business date'),
      sentiment: z.enum(['complaint', 'praise', 'any']).default('any'),
      k: z.number().int().min(1).max(20).default(8).describe('How many distinct sentences to return'),
    }),
    run: async (data, args) => fromResult(await data.findReviews(args), 'guest reviews'),
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
      'departmental and undistributed expenses) with favourable or unfavourable variance. view "bridge" gives the steps from budget ' +
      'GOP (or last year, against "ly") to GOP for one hotel or one roll-up: what each line added or took away, which is what a ' +
      'waterfall draws and what "what drove GOP" asks for. Use it for budget, profit and cost questions.',
    input: z.object({
      hotels,
      by: rollUp,
      from: isoDate,
      to: isoDate,
      grain: z.enum(['month', 'total']).default('month').describe('month, or total for one row for the whole period (e.g. year to date)'),
      view: z.enum(['summary', 'lines', 'bridge']).default('summary').describe('summary: revenue and GOP; lines: every P&L line; bridge: the steps from budget GOP to GOP, for the whole period'),
      lines: z.array(z.enum(PNL_LINES)).optional().describe('With view "lines": only these lines'),
      against: z.enum(['budget', 'ly']).default('budget').describe('With view "bridge": start from the budget or from last year'),
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
      'nights, lost accounts, website conversion drops, staffing gaps, rooms out of order and GOP misses against budget, each priced ' +
      'in EUR and ranked by money. ' +
      'Start here for "what should I look at today?"',
    input: z.object({}),
    run: async (data, _args, scope) => success(await data.getBriefItems(scope), 'account names'),
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
    run: async (data, args, scope) => fromResult(await data.runReadonlyQuery(args.sql, scope), 'custom query rows'),
  }),
] as const satisfies readonly DataTool[];
