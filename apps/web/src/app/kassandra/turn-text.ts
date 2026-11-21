import type { ChatLive, Evidence } from '@compass/contracts';
import type { ChatStep, ChatTurn } from '../api';
import { HALCYON_HOTELS, shortName } from '../scope/hotels';
import { humanizeText } from '../text';

/** What a tool does, in a hotelier's words. The tool's own name never reaches the screen. */
const TOOL_TITLES: Record<string, string> = {
  list_hotels: 'Hotels in the group',
  list_metrics: 'Metric definitions',
  get_schema: 'Available data',
  get_data_health: 'Data freshness',
  get_metric: 'Metric over time',
  get_pace: 'Pace vs last year',
  get_pickup: 'Recent pickup',
  get_rate_position: 'Rate vs the comp set',
  get_channel_mix: 'Channel mix',
  get_mix: 'Business mix',
  get_account_production: 'Account production',
  get_inventory: 'Room inventory',
  get_web_funnel: 'Website booking funnel',
  get_pnl: 'Profit and loss',
  get_forecast: 'Forecast',
  get_lost_business: 'Lost business',
  get_fnb: 'Food and beverage',
  get_labor: 'Staffing vs plan',
  get_meetings_events: 'Meetings and events',
  get_review_scores: 'Review scores',
  find_reviews: 'What guests say',
  search_reviews: 'Guest reviews',
  get_brief: 'Morning brief',
  run_readonly_query: 'Custom analysis',
  show_widget: 'Drew a chart',
  draft_workflow: 'Drafted an agent',
  send_email: 'Email',
};

/** A step's title: the server's human title when it sends one (round2-contracts §2), else ours, else the name in words. */
export function stepTitle(step: Pick<ChatStep, 'name' | 'evidence' | 'widget'>): string {
  const fromServer = (step.evidence as (Evidence & { title?: string }) | undefined)?.title;
  if (fromServer) return fromServer;
  const name = step.name.replace(/^mcp__\w+__/, '');
  if (TOOL_TITLES[name]) return TOOL_TITLES[name];
  const words = name.replace(/^get_/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A hotel code as the hotel's name ("LIS" → "Lisbon Chiado"); anything else as it is. */
const HOTEL_NAMES = new Map(HALCYON_HOTELS.map((hotel) => [hotel.code, shortName(hotel)]));
const named = (value: string) => (value === 'ALL' ? 'All hotels' : (HOTEL_NAMES.get(value) ?? value));

/** The few arguments worth reading, e.g. "Lisbon Chiado, Dubai Business Bay · 21 Nov · 20 Dec". Objects and internal ids are left out. */
export function stepDetail(step: Pick<ChatStep, 'name' | 'args'>): string {
  if (step.name === 'show_widget' || step.name === 'draft_workflow') return '';
  return Object.entries(step.args)
    .filter(([key, value]) => !/id$/i.test(key) && value !== null && value !== undefined && value !== '' && (typeof value !== 'object' || (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string'))))
    .slice(0, 4)
    .map(([, value]) => humanizeText(Array.isArray(value) ? value.map(named).join(', ') : named(String(value))))
    .join(' · ');
}

export function stepStatus(step: ChatStep): string {
  if (step.status === 'error') return 'couldn’t finish';
  if (step.status !== 'done') return 'in progress';
  if (step.widget || step.draft) return '';
  if (step.rows) return `${step.rows.length} ${step.rows.length === 1 ? 'row' : 'rows'}`;
  return step.sent === false ? 'nothing sent' : step.sent ? 'sent' : '';
}

const PHASE_TEXT: Record<string, string> = { waiting: 'Thinking…', thinking: 'Thinking…', tools: 'Checking the data…', writing: 'Writing…' };

/**
 * What Kassandra is doing, for the running turn; null when it is not running. Thinker answers mostly arrive in one
 * piece at the end, so this line carries the wait.
 */
export function phaseText(turn: ChatTurn, phase: ChatLive['phase'] | null | undefined): string | null {
  if (!turn.running || turn.answer) return null;
  if (turn.streamingText) return 'Writing…';
  return PHASE_TEXT[phase ?? ''] ?? (turn.steps.some((step) => step.status !== 'done' && step.status !== 'error') ? 'Checking the data…' : 'Thinking…');
}

export function failureText(reason: string): string {
  const known: Record<string, string> = {
    aborted: 'You stopped it.',
    model_error: 'Something went wrong on our side. Ask again in a moment.',
    turn_limit: 'The question took too many steps. Narrow it to one hotel or a shorter period and ask again.',
    budget: 'Today’s limit is reached. Try again tomorrow.',
  };
  return known[reason] ?? 'Something went wrong on our side. Ask again in a moment.';
}

export const workedText = (ms: number | null) => (ms === null ? '' : ms < 1000 ? 'under a second' : `${Math.round(ms / 1000)}s`);

/** Quick runs on Haiku, Thinker on Sonnet: the mode, read from the model that wrote the answer. */
export function modeOf(model: string): string {
  return /haiku/i.test(model) ? 'Quick' : /sonnet|opus/i.test(model) ? 'Thinker' : model.replace(/^.*\//, '');
}

/* ── Follow-up suggestions ── */

const NEXT_BY_TOOL: Record<string, string[]> = {
  get_pace: ['Which segments are behind last year?', 'Which nights are furthest behind?'],
  get_pickup: ['Which nights picked up most in the last 7 days?'],
  get_rate_position: ['On which nights are we priced below the comp set?'],
  get_channel_mix: ['Which channel costs the most in commission?'],
  get_mix: ['How has the segment mix changed versus last year?'],
  get_metric: ['Which hotels drive that?'],
  get_forecast: ['How does the forecast compare with budget?'],
  get_pnl: ['Which cost lines moved GOP the most?'],
  get_data_health: ['Which numbers does the stale feed affect?'],
  get_web_funnel: ['Where in the funnel do mobile visitors drop off?'],
  get_account_production: ['Which accounts produced less than last year?'],
  get_inventory: ['How many rooms are out of order, and until when?'],
  get_lost_business: ['How much demand did we turn away on price?'],
  get_fnb: ['Which outlets are behind budget?'],
  get_labor: ['Where is staffing short of the workload?'],
  get_meetings_events: ['Which events are still tentative?'],
  get_review_scores: ['What do guests complain about most?'],
  find_reviews: ['How many reviews mention this, by hotel?'],
  search_reviews: ['How many reviews mention this, by hotel?'],
  get_brief: ['Which finding costs the most?'],
};
const BACKGROUND_TOOLS = new Set(['get_data_health', 'get_brief']);
/** Offered when an answer has rows and no chart. An answer that shows a preview already has one. */
export const AS_CHART = 'Show this as a chart';
const WATCH = 'Watch this and email me when it changes';

/**
 * Up to three next questions for a finished answer, from the data it read: a different cut of the same data, a
 * chart when it showed none, and a workflow that keeps watching. Fixed wording: no model writes these.
 */
export function followUps(turn: ChatTurn): string[] {
  if (turn.running || turn.pending || !turn.answer) return [];
  const out: string[] = [];
  const used = [...new Set(turn.steps.filter((step) => step.status === 'done').map((step) => step.name.replace(/^mcp__\w+__/, '')))];
  // Kassandra often checks data freshness before anything else: what the question was about comes first.
  const tools = [...used.filter((tool) => !BACKGROUND_TOOLS.has(tool)), ...used.filter((tool) => BACKGROUND_TOOLS.has(tool))];
  for (const tool of tools) {
    const next = NEXT_BY_TOOL[tool]?.find((question) => !out.includes(question));
    if (next && out.length < 2) out.push(next);
  }
  const hasRows = turn.steps.some((step) => (step.rows?.length ?? 0) > 1);
  if (hasRows && !turn.steps.some((step) => step.widget)) out.push(AS_CHART);
  if (hasRows && !turn.steps.some((step) => step.draft) && out.length < 3) out.push(WATCH);
  return out.slice(0, 3);
}
