import { signal, type Signal } from '@angular/core';
import type { ChatLive } from '@compass/contracts';
import type { ChatStep, ChatTurn, ChatWidget, WidgetKind, WidgetSpec } from '../api';
import { toolTitle } from '../evidence/labels';
import { isPreviewTool, previewWidget, readingOf, widgetFromArgs } from './preview';
import { stepDetail, stepTitle } from './turn-text';

/*
  Generative UI appears in three phases, with no layout shift (docs/decisions.md "Skeletons"):

    chosen     the tool call has started (it is in `live.tools`, or its entry has no usable arguments yet):
               a skeleton of the whole card;
    described  the arguments are known: the title and subtitle are real, the data area is still a skeleton,
               already at the dimensions of that widget kind;
    ready      the tool result is in: the chart (or the evidence card) takes the skeleton's place.

  With previews on, a chart does not wait for Kassandra to ask for one. A slot then walks further back:

    chosen     a data tool call has started (`live.tools`, or `live.drafting` while the model still writes it):
               a neutral skeleton;
    described  the call's arguments are known: the tool's title over the skeleton;
    ready      its rows are in: an instant preview, drawn here with no model (kassandra/preview.ts). If she
               reads the same thing again narrower, the new rows redraw that preview where it is;
    ready      Kassandra's show_widget for that result: her kind and title take the preview's place, in the
               same slot. If she never asks, the preview stays as the chart of the answer.

  This file maps the live state of a turn to those phases. It is pure, so the mapping is tested without a socket.
*/

export type SlotPhase = 'chosen' | 'described' | 'ready';

/** A widget in an answer, at whatever phase it has reached. */
export interface WidgetSlot {
  /**
   * The card's identity for as long as it is on screen. A preview is known by its data call, and Kassandra's widget
   * of that result keeps the id, so the preview turns into her chart in place. A widget with no preview before it is
   * known by its own show_widget call.
   */
  callId: string;
  phase: SlotPhase;
  /**
   * True while the chart is the instant preview: drawn from a data result, with Kassandra still working and free to
   * choose another kind. False for her own widgets, and for a preview that stayed once the answer was final.
   */
  preview: boolean;
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

export type LiveTool = ChatLive['tools'][number] & { args?: Record<string, unknown> };

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

/** A widget's spec without its rows: the same object for the same widget, so a chart is not redrawn on every live update. */
const specs = new WeakMap<ChatWidget, WidgetSpec>();
function specOf(widget: ChatWidget): WidgetSpec {
  let spec = specs.get(widget);
  if (!spec) {
    const { rows: _rows, columns: _columns, evidence: _evidence, ...rest } = widget;
    specs.set(widget, (spec = rest));
  }
  return spec;
}
const described = new WeakMap<object, WidgetSpec | null>();
function specOfArgs(args: Record<string, unknown> | undefined): WidgetSpec | null {
  if (!args) return null;
  if (!described.has(args)) described.set(args, specFromArgs(args));
  return described.get(args) ?? null;
}

const ready = (callId: string, widget: ChatWidget, preview = false): WidgetSlot => ({ callId, phase: 'ready', preview, spec: specOf(widget), title: widget.title, subtitle: widget.subtitle ?? null, widget });

function slotFor(callId: string, widget: ChatWidget | undefined, args: Record<string, unknown> | undefined): WidgetSlot {
  if (widget) return ready(callId, widget);
  const spec = specOfArgs(args);
  return spec
    ? { callId, phase: 'described', preview: false, spec, title: spec.title, subtitle: spec.subtitle ?? null, widget: null }
    : { callId, phase: 'chosen', preview: false, spec: NEUTRAL, title: null, subtitle: null, widget: null };
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

/** An answer never shows more charts than this, unless Kassandra herself asked for more (a board view may have 4). */
export const MAX_CHARTS = 3;

export interface SlotOptions {
  /**
   * Draw a chart from each data result as soon as it is in, without waiting for show_widget. Off by default: a
   * workflow's log and a board's "describe a view" show only what Kassandra chose.
   */
  previews?: boolean;
}

/** A show_widget call of the turn: finished with its widget, or in the making. */
interface WidgetCall {
  callId: string;
  widget?: ChatWidget;
  args?: Record<string, unknown>;
  /** Its `assistant` entry is in: the arguments are whole, not a stream cut mid-word. */
  committed: boolean;
}

const sourceOf = (call: WidgetCall) => call.widget?.sourceCallId ?? text(call.args?.['sourceCallId']);

/** A data call as the chart it is becoming: a skeleton, then the preview of its rows. Null when it has nothing to draw. */
function previewSlot(step: ChatStep, turn: ChatTurn): WidgetSlot | null {
  if (!isPreviewTool(step.name)) return null;
  if (step.rows) {
    const widget = previewWidget(step);
    return widget ? ready(step.callId, widget, turn.running) : null;
  }
  if (!turn.running || !inFlight(step.status)) return null;
  // The call's arguments are known before its rows: what it reads ("Occupancy", "Pace vs last year") stands over the skeleton.
  return { callId: step.callId, phase: 'described', preview: true, spec: NEUTRAL, title: toolTitle(step.name, step.args), subtitle: stepDetail(step) || null, widget: null };
}

/**
 * Kassandra's call over the preview it charts. Finished: her widget, in the preview's slot. Still running: her kind
 * and title already (the client runs the server's own check on her arguments), else her title over the preview.
 */
function adopt(slot: WidgetSlot, call: WidgetCall, source: ChatStep | undefined): WidgetSlot {
  if (call.widget) return ready(slot.callId, call.widget);
  const spec = specOfArgs(call.args);
  if (!spec) return slot;
  const early = call.committed && call.args && source ? widgetFromArgs(spec, call.args, source) : null;
  if (early) return ready(slot.callId, early, true);
  // The arguments are still streaming: the title can show, the kind waits until the columns are all there.
  return { ...slot, title: spec.title, subtitle: spec.subtitle ?? slot.subtitle };
}

/**
 * The charts of a turn, in the order they first appeared. A finished widget always shows; one in the making shows
 * only while the turn is running, so a stopped or failed call leaves no skeleton behind.
 *
 * With `previews`, every data call that can be charted has a slot from the moment it starts, and Kassandra's widget
 * of a result takes over that result's slot. Previews are for a run in progress or an answer that landed: a run that
 * stopped without one keeps only what Kassandra showed. At most `MAX_CHARTS` charts: hers first, previews in what is left.
 */
export function widgetSlots(turn: ChatTurn, liveTools?: readonly LiveTool[] | null, options: SlotOptions = {}): WidgetSlot[] {
  const live = liveOnly(turn, liveTools);
  const previews = !!options.previews && (turn.running || turn.answer !== null);
  const steps = new Map(turn.steps.map((step) => [step.callId, step]));

  // Everything that may become a card, in the order it appeared: data calls (previews) and show_widget calls.
  const slots: WidgetSlot[] = [];
  /** The slot that draws a data call's rows, by the call's id. A re-read shares the slot of the call it repeats. */
  const bySource = new Map<string, number>();
  /** The slot of each reading (tool + what it reads), while it is still a preview. */
  const byReading = new Map<string, number>();
  /** The show_widget call that took over a slot, by the slot's id. */
  const adopted = new Map<string, WidgetCall>();
  const own = new Set<string>();
  const free = (slot: WidgetSlot) => !own.has(slot.callId) && !adopted.has(slot.callId);

  const place = (call: WidgetCall) => {
    const source = sourceOf(call);
    const at = source ? (bySource.get(source) ?? -1) : -1;
    if (at >= 0 && free(slots[at]!)) {
      adopted.set(slots[at]!.callId, call);
      slots[at] = adopt(slots[at]!, call, steps.get(source!));
      return;
    }
    // Nothing says yet which result she is charting. If a preview is free she is most likely drawing that one: wait
    // for her arguments rather than open a second skeleton next to it. With one preview there is no doubt, so the
    // title she is writing shows over it at once.
    if (!call.widget && !source) {
      const waiting = slots.filter(free);
      if (waiting.length === 1 && waiting[0]!.phase === 'ready') slots[slots.indexOf(waiting[0]!)] = adopt(waiting[0]!, call, undefined);
      if (waiting.length) return;
    }
    own.add(call.callId);
    slots.push(slotFor(call.callId, call.widget, call.args));
  };

  const preview = (step: ChatStep) => {
    const slot = previewSlot(step, turn);
    const reading = readingOf(step);
    const at = byReading.get(reading) ?? -1;
    if (at >= 0 && free(slots[at]!)) {
      // The same reading again (usually narrower): its rows redraw the chart that is there, in the same card. While
      // they load, and if they turn out to have nothing to draw, the earlier chart stays.
      bySource.set(step.callId, at);
      if (slot?.phase === 'ready') slots[at] = { ...slot, callId: slots[at]!.callId };
      return;
    }
    if (!slot) return;
    bySource.set(step.callId, slots.length);
    byReading.set(reading, slots.length);
    slots.push(slot);
  };

  for (const step of turn.steps) {
    if (step.widget) place({ callId: step.callId, widget: step.widget, args: step.args, committed: true });
    else if (isWidgetTool(step.name)) {
      if (turn.running && inFlight(step.status)) place({ callId: step.callId, args: step.args, committed: true });
    } else if (previews) preview(step);
  }
  for (const tool of live) {
    if (isWidgetTool(tool.name)) place({ callId: tool.callId, args: tool.args, committed: false });
    else if (previews && isPreviewTool(tool.name)) {
      // A tool that already has a preview waiting is most likely being read again: its arguments will say.
      const again = slots.some((slot) => free(slot) && steps.has(slot.callId) && toolName(steps.get(slot.callId)!.name) === toolName(tool.name));
      if (!again) slots.push({ callId: tool.callId, phase: 'chosen', preview: true, spec: NEUTRAL, title: null, subtitle: null, widget: null });
    }
  }

  // Her charts are never dropped; previews fill what is left of the limit, first come first.
  const hers = (slot: WidgetSlot) => own.has(slot.callId) || adopted.has(slot.callId);
  let room = Math.max(0, MAX_CHARTS - slots.filter(hers).length);
  return slots.filter((slot) => hers(slot) || room-- > 0);
}

/**
 * `live.tools` with the calls the model is still writing (`live.drafting`) in front of their time: they count as
 * pending calls with the arguments streamed so far. A call that is already in `tools` keeps its real status.
 */
export function liveCalls(live: Pick<ChatLive, 'tools' | 'drafting'> | null | undefined): LiveTool[] {
  const tools: LiveTool[] = [...(live?.tools ?? [])];
  for (const draft of live?.drafting ?? []) {
    if (!tools.some((tool) => tool.callId === draft.callId)) tools.push({ callId: draft.callId, name: draft.name, status: 'pending', args: draft.args });
  }
  return tools;
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
