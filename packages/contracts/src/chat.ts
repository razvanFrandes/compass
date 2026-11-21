import type { Evidence } from './evidence.ts';
import type { HotelScope } from './hotels.ts';
import type { Widget } from './widgets.ts';
import type { WorkflowSpec } from './workflows.ts';

/**
 * The Kassandra chat protocol over WebSocket: `wss://<host>/api/kassandra/ws?conversation=<id>`.
 *
 * The server projects Pi's durable transcript into these shapes, so the UI never depends on Pi's internal format.
 * Entries are immutable once sent (keyed by `id`, ascending); `live` is the current run state and replaces the
 * previous one each time.
 */

/** Quick: a fast answer from governed metrics (Haiku). Thinker: reasons across every source (Sonnet). Default thinker. */
export type AnswerMode = 'quick' | 'thinker';

export type ChatEntry =
  | { id: number; kind: 'user'; text: string; at: number }
  | {
      id: number;
      kind: 'assistant';
      text: string;
      /** Tools the model asked for in this turn; their results arrive as `tool_result` entries with the same callId. */
      toolCalls: { callId: string; name: string; args: Record<string, unknown> }[];
      model: string;
      usage: { tokens: number; costUsd: number };
      /** `stop` for a final answer, `toolUse` when tool calls follow. */
      stopReason: string;
      at: number;
    }
  | {
      id: number;
      kind: 'tool_result';
      callId: string;
      name: string;
      isError: boolean;
      /** Error text when `isError`; otherwise absent (the data is in `rows`). */
      error?: string;
      rows?: Record<string, unknown>[];
      evidence?: Evidence;
      /** A workflow Kassandra drafted (draft_workflow): show it as an editable card with Save → POST /api/workflows. */
      draft?: WorkflowSpec;
      /** `send_email` only: whether a mail went out. False when nothing was to report, or a limit or the sender refused it. */
      sent?: boolean;
      /**
       * `show_widget` only: a chart, table or KPI to draw under the answer. Its rows, columns and evidence are copied by
       * the server from the tool result `sourceCallId` names; the model chose only the kind, the title and the columns.
       */
      widget?: Widget;
      at: number;
    }
  | { id: number; kind: 'event'; type: string; data: unknown; at: number };

export interface ChatLive {
  /** A run is going: the agent is thinking, calling tools or writing. */
  running: boolean;
  /**
   * What the agent is doing right now: `waiting` for the model's first output, `thinking` (reasoning, no answer text
   * yet), `writing` (`streamingText` is growing), `tools` (calling tools), `idle` with no run. The server always sends
   * it. Thinker answers can stay in `thinking` for seconds and then land whole: the model sends its reasoning first.
   */
  phase?: 'idle' | 'waiting' | 'thinking' | 'writing' | 'tools';
  /** The answer being streamed right now, before it is committed as an `assistant` entry. */
  streamingText: string;
  /** Tool calls of the current turn and their status. */
  tools: { callId: string; name: string; status: 'pending' | 'running' | 'done' | 'sleeping' | 'waiting' | string }[];
  /**
   * Tool calls the model is writing right now, with their arguments as far as they have streamed (a string may be cut
   * mid-word, later keys may be missing). Absent when there is none. A call leaves this list when its `assistant`
   * entry is committed; from then on it is in `tools`. The UI uses it to start a skeleton, or to show a chart's title,
   * before the call exists.
   */
  drafting?: { callId: string; name: string; args: Record<string, unknown> }[];
  /** Model turns taken in the current run. */
  turns: number;
  /** Why the last run ended without an answer (`model_error`, `turn_limit`, `aborted`, …), until the next run. */
  failure: { reason: string; detail?: string } | null;
  /** Spend of the whole conversation so far. */
  usage: { tokens: number; costUsd: number };
}

/** What a conversation's first answer mainly showed, for the sidebar's icon. */
export type ThreadKind = 'chart' | 'table' | 'text';

/**
 * A conversation as the sidebar lists it, written once on the server after its first answer (the Quick model, short
 * and plain) and kept with the conversation. `title` replaces the cut-off question ("Tessera Dubai: business mix");
 * `summary` is the answer's takeaway ("Corporate down 12% vs last year"), null when there was none to say. A title the
 * person gave (`renamed`) is never replaced.
 */
export interface ThreadMeta {
  title: string;
  summary: string | null;
  kind: ThreadKind;
  /** The hotel code when the conversation is about one hotel, else null. */
  hotel: string | null;
  renamed: boolean;
}

/** `GET /api/kassandra/conversations?ids=a,b`: the meta of each conversation that has one. */
export type ThreadMetaList = Record<string, ThreadMeta>;

export type ChatServerMessage =
  | { type: 'snapshot'; conversation: string; entries: ChatEntry[]; live: ChatLive }
  /** The conversation's title and takeaway: on connect when there is one, and once the first answer has one. */
  | { type: 'meta'; meta: ThreadMeta }
  | { type: 'entries'; entries: ChatEntry[] }
  | { type: 'live'; live: ChatLive }
  | { type: 'error'; message: string };

export type ChatClientMessage =
  /**
   * Ask a question. `id` makes a retried send idempotent. Sent while busy, it is queued as a follow-up.
   * `scope` limits the answer to some hotels: every data tool then reads only those. Absent or empty is the whole group.
   */
  | { type: 'ask'; text: string; id?: string; mode?: AnswerMode; scope?: HotelScope }
  /** Steer the running answer ("use last year instead"), joining it after the current round of tools. */
  | { type: 'steer'; text: string }
  /** Stop the running answer. */
  | { type: 'abort' };
