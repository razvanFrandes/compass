import { signal, type Signal } from '@angular/core';
import type { ChatLive } from '@compass/contracts';
import type { ChatStep, ChatTurn, ChatWidget, WidgetKind, WidgetSpec } from '../api';
import { stepDetail, stepTitle } from './turn-text';

/*
  Generative UI appears in three phases, with no layout shift (docs/decisions.md "Skeletons"):

    chosen     the tool call has started (it is in `live.tools`, or its entry has no usable arguments yet):
               a skeleton of the whole card;
    described  the arguments are known: the title and subtitle are real, the data area is still a skeleton,
               already at the dimensions of that widget kind;
    ready      the tool result is in: the chart (or the evidence card) takes the skeleton's place.

  This file maps the live state of a turn to those phases. It is pure, so the mapping is tested without a socket.
*/

export type SlotPhase = 'chosen' | 'described' | 'ready';

/** A widget in an answer, at whatever phase it has reached. */
export interface WidgetSlot {
  callId: string;
  phase: SlotPhase;
  /**
   * What `<juyo-widget-chart>` is given. Before the arguments are known it is a neutral bar chart with no title, so
   * the skeleton has a shape; from `described` on it is the real spec, so the skeleton has the final dimensions.
   */
  spec: WidgetSpec;
  /** Null until the arguments are known. */
  title: string | null;
  subtitle: string | null;
  /** The chart's rows, columns and evidence: only when `ready`. */
  widget: ChatWidget | null;
}

/** A data tool call that will become a card in "How this was computed". */
export interface EvidenceSlot {
  callId: string;
  phase: SlotPhase;
  /** "Pace vs last year". Null while only the call's existence is known. */
  title: string | null;
  /** "LIS · 1 Dec · 31 Dec". */
  detail: string;
}

type LiveTool = ChatLive['tools'][number] & { args?: Record<string, unknown> };

const WIDGET_KINDS: ReadonlySet<string> = new Set<WidgetKind>([
  'kpi', 'kpi_row', 'line', 'area', 'bar', 'stacked_bar', 'grouped_bar', 'pie', 'donut', 'table', 'heatmap', 'calendar_heatmap',
  'funnel', 'waterfall', 'bullet', 'sparkline_list', 'scatter', 'treemap', 'gauge', 'radar', 'sankey',
]);
const FORMATS: ReadonlySet<string> = new Set(['number', 'percent', 'currency', 'count']);

/** `mcp__compass__get_pace` → `get_pace`. */
export const toolName = (name: string) => name.replace(/^mcp__\w+__/, '');
const isWidgetTool = (name: string) => toolName(name) === 'show_widget';
/** The tools that read data and return rows with evidence. */
export const isDataTool = (name: string) => /^(get_|list_|find_|search_|run_readonly_query$)/.test(toolName(name));
const inFlight = (status: string) => status !== 'done' && status !== 'error';
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** The spec a `show_widget` call asks for, as far as its arguments say. Null until they name a kind and a title. */
export function specFromArgs(args: Record<string, unknown> | undefined): WidgetSpec | null {
  const kind = text(args?.['kind']);
  const title = text(args?.['title']);
  if (!args || !kind || !WIDGET_KINDS.has(kind) || !title) return null;
  const column = (key: string) => text(args[key]) ?? undefined;
  const y = Array.isArray(args['y']) ? args['y'].filter((key): key is string => typeof key === 'string' && !!key) : [];
  const format = text(args['format']);
  return {
    kind: kind as WidgetKind,
    title,
    sourceCallId: text(args['sourceCallId']) ?? '',
    ...(text(args['subtitle']) ? { subtitle: text(args['subtitle'])! } : {}),
    ...(column('x') ? { x: column('x') } : {}),
    ...(y.length ? { y } : {}),
    ...(column('group') ? { group: column('group') } : {}),
    ...(column('compare') ? { compare: column('compare') } : {}),
    ...(format && FORMATS.has(format) ? { format: format as WidgetSpec['format'] } : {}),
  };
}

const NEUTRAL: WidgetSpec = { kind: 'bar', title: '', sourceCallId: '' };

function slotFor(callId: string, widget: ChatWidget | undefined, args: Record<string, unknown> | undefined): WidgetSlot {
  if (widget) {
    const { rows: _rows, columns: _columns, evidence: _evidence, ...spec } = widget;
    return { callId, phase: 'ready', spec, title: widget.title, subtitle: widget.subtitle ?? null, widget };
  }
  const spec = specFromArgs(args);
  return spec ? { callId, phase: 'described', spec, title: spec.title, subtitle: spec.subtitle ?? null, widget: null } : { callId, phase: 'chosen', spec: NEUTRAL, title: null, subtitle: null, widget: null };
}

/** The live tool calls of a turn that its transcript does not have yet: they exist, and nothing else is known. */
function liveOnly(turn: ChatTurn, liveTools: readonly LiveTool[] | null | undefined): LiveTool[] {
  if (!turn.running || !liveTools?.length) return [];
  const known = new Set(turn.steps.map((step) => step.callId));
  return liveTools.filter((tool) => !known.has(tool.callId) && inFlight(tool.status));
}

/** How many tool calls the turn has made so far, the ones only `live.tools` knows about included. */
export function stepCount(turn: ChatTurn, liveTools?: readonly LiveTool[] | null): number {
  return turn.steps.length + liveOnly(turn, liveTools).length;
}

/**
 * The widgets of a turn, in the order Kassandra asked for them. A finished widget always shows; one in the making
 * shows only while the turn is running, so a stopped or failed call leaves no skeleton behind.
 */
export function widgetSlots(turn: ChatTurn, liveTools?: readonly LiveTool[] | null): WidgetSlot[] {
  const slots: WidgetSlot[] = [];
  for (const step of turn.steps) {
    if (step.widget) slots.push(slotFor(step.callId, step.widget, step.args));
    else if (isWidgetTool(step.name) && turn.running && inFlight(step.status)) slots.push(slotFor(step.callId, undefined, step.args));
  }
  for (const tool of liveOnly(turn, liveTools)) {
    if (isWidgetTool(tool.name)) slots.push(slotFor(tool.callId, undefined, tool.args));
  }
  return slots;
}

/** The data tool calls of a turn as the evidence cards they are becoming. Failed calls are left to the steps list. */
export function evidenceSlots(turn: ChatTurn, liveTools?: readonly LiveTool[] | null): EvidenceSlot[] {
  const slots: EvidenceSlot[] = [];
  for (const step of turn.steps) {
    if (!isDataTool(step.name)) continue;
    if (step.evidence) slots.push({ callId: step.callId, phase: 'ready', title: stepTitle(step), detail: stepDetail(step) });
    else if (turn.running && inFlight(step.status)) slots.push({ callId: step.callId, phase: 'described', title: stepTitle(step), detail: stepDetail(step) });
  }
  for (const tool of liveOnly(turn, liveTools)) {
    if (isDataTool(tool.name)) slots.push({ callId: tool.callId, phase: 'chosen', title: null, detail: '' });
  }
  return slots;
}

/**
 * The steps of a turn plus the data calls that only `live.tools` knows about, as steps with no arguments yet. An
 * evidence panel that draws waiting cards from steps (by `status`) then shows them from the first moment.
 */
export function stepsWithLive(turn: ChatTurn, liveTools?: readonly LiveTool[] | null): ChatStep[] {
  const extra = liveOnly(turn, liveTools)
    .filter((tool) => isDataTool(tool.name))
    .map((tool): ChatStep => ({ callId: tool.callId, name: tool.name, args: tool.args ?? {}, status: tool.status, narration: '' }));
  return extra.length ? [...turn.steps, ...extra] : turn.steps;
}

/** What is on screen for a slot: a skeleton that has just appeared stays, even when its data is already there. */
export function shownPhase(phase: SlotPhase, held: boolean): SlotPhase {
  return phase === 'ready' && held ? 'described' : phase;
}

/** A skeleton that shows for less than this reads as a flicker. */
export const SKELETON_MIN_MS = 300;

/**
 * Keeps skeletons on screen for at least `minMs`. Call `show(ids)` (from an effect) with the slots that are drawing
 * a skeleton right now; `held()` then names the ones that must keep it, whatever their data says. A slot that
 * arrives ready (a transcript loaded from the server) is never shown here, so it never gets a skeleton.
 */
export class SkeletonHold {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly ids = signal<ReadonlySet<string>>(new Set());
  readonly held: Signal<ReadonlySet<string>> = this.ids.asReadonly();

  constructor(private readonly minMs = SKELETON_MIN_MS) {}

  show(ids: readonly string[]): void {
    const fresh = ids.filter((id) => !this.timers.has(id));
    if (!fresh.length) return;
    for (const id of fresh) {
      this.timers.set(
        id,
        setTimeout(() => this.ids.update((current) => new Set([...current].filter((other) => other !== id))), this.minMs),
      );
    }
    this.ids.update((current) => new Set([...current, ...fresh]));
  }

  /** Stops the timers (the host is gone). */
  clear(): void {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }
}
