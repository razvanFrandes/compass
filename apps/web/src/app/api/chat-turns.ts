import type { ChatEntry, ChatLive, Evidence, WorkflowSpec } from '@compass/contracts';
import type { ChatWidget } from './round2-contracts';

type AssistantEntry = Extract<ChatEntry, { kind: 'assistant' }>;
type ToolResultEntry = Extract<ChatEntry, { kind: 'tool_result' }>;
export type ChatEventEntry = Extract<ChatEntry, { kind: 'event' }>;

export interface Usage {
  tokens: number;
  costUsd: number;
}

/** One tool call of a turn, with its result once it has landed. */
export interface ChatStep {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  /**
   * `done` or `error` once the result is in. Before that, the live status of the call (`pending`, `running`,
   * `sleeping`, `waiting`), or `pending` when the run is no longer live.
   */
  status: 'pending' | 'running' | 'done' | 'error' | 'sleeping' | 'waiting' | (string & {});
  /** What the agent said before this round of tool calls (set on the first call of the round). */
  narration: string;
  error?: string;
  rows?: Record<string, unknown>[];
  evidence?: Evidence;
  /** A workflow drafted in chat (`draft_workflow`): an editable card with Save. */
  draft?: WorkflowSpec;
  /** `send_email` only: whether a mail went out. */
  sent?: boolean;
  /** `show_widget` only: a chart, table or KPI from the catalogue, with the rows of the tool result it names. */
  widget?: ChatWidget;
}

/** A question and everything that answered it. */
export interface ChatTurn {
  /** Stable key for `@for`: the user entry's id, `pending:<ask id>` before the server has it, or `head`. */
  key: string;
  /** Null for entries that came before the first question in view (e.g. the transcript was cut at 50 entries). */
  question: string | null;
  /** The question was sent but the server has not committed it yet. */
  pending: boolean;
  steps: ChatStep[];
  /** The final answer, in Markdown. Null while it is being worked on, or if the run ended without one. */
  answer: string | null;
  /** The answer as it is being written. Empty unless this is the running turn. */
  streamingText: string;
  /** This turn is the one the agent is working on: show the Stop button and the step spinner. */
  running: boolean;
  /** Why the run ended without an answer (`model_error`, `turn_limit`, `aborted`, …). Last turn only. */
  failure: ChatLive['failure'];
  /** From the question to the last entry of the turn: "Worked for 4s". Null when it cannot be told. */
  workedMs: number | null;
  /** The model that wrote the last message of the turn. */
  model: string | null;
  /** What this turn cost (the sum of its model calls). */
  usage: Usage;
  /** Labelled inputs recorded in this turn (`app.approval`, `app.edit`, …). */
  events: ChatEventEntry[];
}

/** A question the client has sent that is not in the transcript yet. */
export interface PendingAsk {
  id: string;
  text: string;
}

function emptyTurn(key: string, question: string | null): ChatTurn & { startedAt: number | null; lastAt: number | null } {
  return {
    key,
    question,
    pending: false,
    steps: [],
    answer: null,
    streamingText: '',
    running: false,
    failure: null,
    workedMs: null,
    model: null,
    usage: { tokens: 0, costUsd: 0 },
    events: [],
    startedAt: null,
    lastAt: null,
  };
}

/** A turn that asks for tools is narrating its steps; anything else is the answer. */
function isStepTurn(entry: AssistantEntry): boolean {
  return entry.stopReason === 'toolUse' || entry.toolCalls.length > 0;
}

function applyResult(step: ChatStep, result: ToolResultEntry): void {
  step.status = result.isError ? 'error' : 'done';
  if (result.error !== undefined) step.error = result.error;
  if (result.rows !== undefined) step.rows = result.rows;
  if (result.evidence !== undefined) step.evidence = result.evidence;
  if (result.draft !== undefined) step.draft = result.draft;
  if (result.sent !== undefined) step.sent = result.sent;
  // `widget` is in docs/round2-contracts.md §3 and not in the published entry type yet.
  const widget = (result as ToolResultEntry & { widget?: ChatWidget }).widget;
  if (widget !== undefined) step.widget = widget;
}

/**
 * Groups a transcript into turns, as in docs/api.md "Rendering a turn": user entry → steps (one per tool call, with
 * its result matched by `callId`) → the final answer. `live` decorates the last turn: the streaming text, the status
 * of calls still in flight, the failure. Pure, so it also renders a workflow run's log (`GET /api/runs/:id`).
 */
export function groupTurns(entries: readonly ChatEntry[], live?: ChatLive | null, pending: readonly PendingAsk[] = []): ChatTurn[] {
  const turns: ReturnType<typeof emptyTurn>[] = [];
  const steps = new Map<string, ChatStep>();
  let current: ReturnType<typeof emptyTurn> | undefined;
  // What was written in a message that only draws charts: the answer, if the run then ends without saying more.
  // Asked to answer visually, a model often writes its sentences beside `show_widget` and stops with an empty message.
  let beside: { turn: ReturnType<typeof emptyTurn>; step: ChatStep; text: string } | undefined;

  const turn = (): ReturnType<typeof emptyTurn> => {
    if (!current) {
      current = emptyTurn('head', null);
      turns.push(current);
    }
    return current;
  };

  for (const entry of entries) {
    if (entry.kind === 'user') {
      current = emptyTurn(String(entry.id), entry.text);
      current.startedAt = entry.at;
      turns.push(current);
      continue;
    }
    const into = turn();
    into.lastAt = entry.at;
    if (entry.kind === 'assistant') {
      into.model = entry.model;
      into.usage = { tokens: into.usage.tokens + entry.usage.tokens, costUsd: into.usage.costUsd + entry.usage.costUsd };
      if (isStepTurn(entry)) {
        const first = into.steps.length;
        entry.toolCalls.forEach((call, index) => {
          const step: ChatStep = { ...call, status: 'pending', narration: index === 0 ? entry.text : '' };
          steps.set(call.callId, step);
          into.steps.push(step);
        });
        const drawsOnly = entry.toolCalls.length > 0 && entry.toolCalls.every((call) => call.name === 'show_widget');
        const step = into.steps[first];
        beside = drawsOnly && entry.text.trim() && step ? { turn: into, step, text: entry.text } : undefined;
      } else if (entry.text) {
        into.answer = entry.text;
      } else if (beside?.turn === into && into.answer === null) {
        // The run ended here with nothing more to say: it is said once, as the answer, not as the chart's narration.
        into.answer = beside.text;
        beside.step.narration = '';
      }
    } else if (entry.kind === 'tool_result') {
      let step = steps.get(entry.callId);
      if (!step) {
        // The call's own entry is out of view (older than the snapshot): keep the result as a step of its own.
        step = { callId: entry.callId, name: entry.name, args: {}, status: 'pending', narration: '' };
        steps.set(entry.callId, step);
        into.steps.push(step);
      }
      applyResult(step, entry);
    } else {
      into.events.push(entry);
    }
  }

  for (const ask of pending) {
    const waiting = emptyTurn(`pending:${ask.id}`, ask.text);
    waiting.pending = true;
    turns.push(waiting);
  }

  // The live state belongs to the last committed turn: a question sent while an answer is running is queued behind
  // it. Once that turn has its answer, a run that starts is for the next question, which may not be committed yet.
  const committed = [...turns].reverse().find((candidate) => !candidate.pending);
  const firstPending = turns.find((candidate) => candidate.pending);
  const last = committed && (committed.answer === null || !firstPending) ? committed : (firstPending ?? committed);
  if (last && live) {
    last.running = live.running;
    last.streamingText = live.running ? live.streamingText : '';
    last.failure = live.running ? null : live.failure;
    if (live.running) {
      for (const tool of live.tools) {
        const step = steps.get(tool.callId);
        if (step && last.steps.includes(step) && step.status === 'pending') step.status = tool.status;
      }
    }
  }

  return turns.map(({ startedAt, lastAt, ...rest }) => ({
    ...rest,
    // The server sends `at: 0` when it has no timestamp.
    workedMs: startedAt && lastAt ? Math.max(0, lastAt - startedAt) : null,
  }));
}
