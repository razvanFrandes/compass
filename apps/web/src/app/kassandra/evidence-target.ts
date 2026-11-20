import type { ChatLive } from '@compass/contracts';
import type { ChatStep, ChatTurn } from '../api';
import { stepsWithLive } from './live-slots';

/*
  What "Behind the numbers" explains. A chart is drawn from a tool result that may be older than the answer it
  sits in ("Show this as a chart" draws what the previous answer read), so a turn's evidence is more than its own
  data calls: it is also the results its charts draw from, wherever they were read. This file maps a click to that
  evidence. It is pure, so the mapping is tested without a socket.
*/

/** "Behind the numbers" was asked for one tool result of one turn; `widgetCallId` when it was asked on a chart. */
export interface EvidenceSelection {
  turnKey: string;
  /** The tool result to open: a step's own call, or the call a chart draws from. */
  callId: string;
  /** The `show_widget` call of the chart that was clicked. */
  widgetCallId?: string;
}

/** What the panel is asked to show. */
export interface EvidenceTarget {
  /** The turn being explained: the one the click was in. */
  turn: ChatTurn | null;
  /** The card to open, highlight and bring into view. */
  callId: string | null;
  /** The chart that was asked about, when one was: its title, and the columns of the source it draws. */
  chart: { title: string; columns: string[] } | null;
}

type LiveTools = ChatLive['tools'] | null | undefined;

const withResult = (step: ChatStep) => !!step.evidence;

/** A turn has something to explain: a result with evidence, or a chart (which carries its own). */
export function hasEvidence(turn: ChatTurn): boolean {
  return turn.steps.some((step) => step.evidence || step.widget);
}

/**
 * The tool calls that explain one turn: its own steps (with the calls only `live.tools` knows), and before them
 * the results its charts draw from when those were read in an earlier turn. A source that is no longer in the
 * transcript (cut at the last entries) is rebuilt from the chart itself: the server copies the rows, the columns
 * and the evidence of the source into every widget.
 */
export function evidenceEntries(turns: readonly ChatTurn[], turn: ChatTurn, liveTools?: LiveTools): ChatStep[] {
  const own = stepsWithLive(turn, liveTools);
  const borrowed: ChatStep[] = [];
  for (const step of own) {
    const widget = step.widget;
    if (!widget) continue;
    const source = widget.sourceCallId;
    if ([...own, ...borrowed].some((other) => other.callId === source && withResult(other))) continue;
    const elsewhere = turns.flatMap((other) => (other === turn ? [] : other.steps)).find((other) => other.callId === source && withResult(other));
    borrowed.push(
      elsewhere ?? {
        callId: source,
        name: 'chart_source',
        args: {},
        status: 'done',
        narration: '',
        rows: widget.rows,
        evidence: { ...widget.evidence, columns: widget.evidence.columns ?? widget.columns },
      },
    );
  }
  return borrowed.length ? [...borrowed, ...own] : own;
}

/** The numbers a turn states: its answer, and the titles of its charts (a chart's title is a conclusion with a figure in it). */
export function statedText(turn: ChatTurn): string | null {
  const titles = turn.steps.flatMap((step) => (step.widget ? [step.widget.title] : []));
  const text = [turn.answer ?? '', ...titles].filter(Boolean).join('\n');
  return text || null;
}

/**
 * Where a click on "Behind the numbers" leads: the turn it was in, the card of the tool result it is about, and
 * for a chart its title and the columns it draws (so the table keeps them on screen).
 */
export function evidenceTarget(turns: readonly ChatTurn[], selection: EvidenceSelection | null): EvidenceTarget {
  const turn = selection ? (turns.find((candidate) => candidate.key === selection.turnKey) ?? null) : null;
  if (!selection || !turn) return { turn: null, callId: null, chart: null };
  const widget = selection.widgetCallId ? turn.steps.find((step) => step.callId === selection.widgetCallId)?.widget : undefined;
  if (!widget) return { turn, callId: selection.callId, chart: null };
  const columns = [widget.x, ...(widget.y ?? []), widget.compare, widget.group].filter((key): key is string => !!key);
  return { turn, callId: widget.sourceCallId, chart: { title: widget.title, columns: [...new Set(columns)] } };
}
