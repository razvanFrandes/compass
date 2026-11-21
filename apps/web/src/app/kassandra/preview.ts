import { fitWidget } from '@compass/contracts/widget-fit';
import type { ChatStep, ChatWidget, WidgetSpec } from '../api';
import { type KindHint, recommendSpec } from '../charts/kinds';
import { humanizeText } from '../text';
import { named as hotelName, stepTitle } from './turn-text';

/*
  The instant preview: a chart drawn from a data tool's rows the moment they arrive, before Kassandra has taken
  another turn to choose one. No model is involved: `recommendSpec` reads the shape of the rows, the numbers are the
  tool's own, and the title is the tool's name for what it returned. When Kassandra's show_widget for the same result
  lands, her kind and title take the preview's place (kassandra/live-slots.ts).
*/

const bare = (name: string) => name.replace(/^mcp__\w+__/, '');

/**
 * Tools whose rows are looked up or read, not charted: the hotel list, definitions, feed status, the brief's
 * findings, guest quotes. They never get a preview (Kassandra can still chart them herself).
 */
const REFERENCE_TOOLS: ReadonlySet<string> = new Set(['list_hotels', 'list_metrics', 'get_schema', 'get_data_health', 'get_brief', 'find_reviews', 'search_reviews']);

/** A data tool whose result may be drawn before Kassandra says how. */
export const isPreviewTool = (name: string) => /^(get_|run_readonly_query$)/.test(bare(name)) && !REFERENCE_TOOLS.has(bare(name));

/** Arguments that say for whom and for when, not what is read: the same reading with other values of these is a re-read. */
const SCOPE_ARGS: ReadonlySet<string> = new Set(['hotels', 'hotel', 'from', 'to', 'start', 'end', 'date', 'daysAhead', 'days', 'limit', 'top', 'k']);

/**
 * What a data call reads, apart from its scope: the tool and the arguments that shape its rows (the metric, the
 * roll-up, the grain). Kassandra often reads the same thing again narrower (fewer hotels, a shorter period): two
 * calls with the same reading are one chart, and the later rows take the earlier one's place.
 */
export function readingOf(step: Pick<ChatStep, 'name' | 'args'>): string {
  const shape = Object.entries(step.args)
    .filter(([key]) => !SCOPE_ARGS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
  return `${bare(step.name)} ${JSON.stringify(shape)}`;
}

/**
 * The number a tool's rows are about, where it is not simply the first one: which column to draw and what to hold
 * it against. Only columns: the kind always comes from the shape of the rows.
 */
const TOOL_HINTS: Record<string, KindHint> = {
  get_rate_position: { y: ['bar_rate', 'comp_median'] },
  get_forecast: { y: ['rooms_p50'], compare: 'budget_rooms_sold' },
  get_review_scores: { y: ['overall'] },
  get_labor: { y: ['scheduled_hours'], compare: 'required_hours' },
  get_inventory: { y: ['max_out_of_order'] },
  get_meetings_events: { y: ['revenue_eur'] },
  get_fnb: { y: ['revenue_eur'] },
  get_lost_business: { y: ['room_nights'] },
};

/** The scope line of a preview: the hotels the call named and the period its rows cover. "Lisbon Chiado, Amsterdam Centraal · 1 Dec – 31 Dec": hotels by name, as everywhere a hotelier reads. */
function scopeLine(step: Pick<ChatStep, 'args' | 'evidence'>): string {
  const named = step.args['hotels'];
  const hotels = Array.isArray(named) ? named.filter((code): code is string => typeof code === 'string') : [];
  const who = hotels.length === 0 ? '' : hotels.length <= 4 ? hotels.map(hotelName).join(', ') : `${hotels.length} hotels`;
  const period = step.evidence?.period;
  const when = period ? humanizeText(period.from === period.to ? period.from : `${period.from} – ${period.to}`) : '';
  return [who, when].filter(Boolean).join(' · ').slice(0, 140);
}

/** Results never change once they are in, so each is read once: the same rows give the same widget object. */
const previews = new WeakMap<object, ChatWidget | null>();

/**
 * The preview of a data step: its rows as the kind a first look suggests, or null when there is nothing to draw
 * (no rows, more than a widget holds, or rows that only read as a table).
 */
export function previewWidget(step: Pick<ChatStep, 'callId' | 'name' | 'args' | 'rows' | 'evidence'>): ChatWidget | null {
  const { rows, evidence } = step;
  if (!rows?.length || !evidence || !isPreviewTool(step.name)) return null;
  const known = previews.get(rows);
  if (known !== undefined) return known;
  const columns = evidence.columns ?? [];
  const picked = recommendSpec(rows, columns, TOOL_HINTS[bare(step.name)]);
  const title = stepTitle(step);
  const subtitle = scopeLine(step);
  const widget: ChatWidget | null =
    picked && picked.kind !== 'table'
      ? { ...picked, title: title.length >= 3 ? title : `${title} data`, ...(subtitle ? { subtitle } : {}), sourceCallId: step.callId, rows, columns, evidence }
      : null;
  previews.set(rows, widget);
  return widget;
}

const fitted = new WeakMap<object, WeakMap<object, ChatWidget | null>>();

/**
 * Kassandra's chart before the server confirms it: the spec her show_widget call asks for, over the rows of the
 * result it names. The check is the server's own (`fitWidget`), so what passes here is what comes back. Null when
 * the spec does not fit: the server will refuse it too, and the preview stays.
 */
export function widgetFromArgs(spec: WidgetSpec, args: object, source: Pick<ChatStep, 'callId' | 'rows' | 'evidence'>): ChatWidget | null {
  const { rows, evidence } = source;
  if (!rows?.length || !evidence) return null;
  let byRows = fitted.get(args);
  if (!byRows) fitted.set(args, (byRows = new WeakMap()));
  const known = byRows.get(rows);
  if (known !== undefined) return known;
  const columns = evidence.columns ?? [];
  const result = fitWidget({ ...spec, sourceCallId: source.callId }, { rows, columns });
  const widget: ChatWidget | null = result.ok ? { ...result.value, rows, columns, evidence } : null;
  byRows.set(rows, widget);
  return widget;
}
