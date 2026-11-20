import type { Evidence } from './evidence.ts';

/**
 * The Kassandra chat protocol over WebSocket: `wss://<host>/api/kassandra/ws?conversation=<id>`.
 *
 * The server projects Pi's durable transcript into these shapes, so the UI never depends on Pi's internal format.
 * Entries are immutable once sent (keyed by `id`, ascending); `live` is the current run state and replaces the
 * previous one each time.
 */

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
      at: number;
    }
  | { id: number; kind: 'event'; type: string; data: unknown; at: number };

export interface ChatLive {
  /** A run is going: the agent is thinking, calling tools or writing. */
  running: boolean;
  /** The answer being streamed right now, before it is committed as an `assistant` entry. */
  streamingText: string;
  /** Tool calls of the current turn and their status. */
  tools: { callId: string; name: string; status: 'pending' | 'running' | 'done' | 'sleeping' | 'waiting' | string }[];
  /** Model turns taken in the current run. */
  turns: number;
  /** Why the last run ended without an answer (`model_error`, `turn_limit`, `aborted`, …), until the next run. */
  failure: { reason: string; detail?: string } | null;
  /** Spend of the whole conversation so far. */
  usage: { tokens: number; costUsd: number };
}

export type ChatServerMessage =
  | { type: 'snapshot'; conversation: string; entries: ChatEntry[]; live: ChatLive }
  | { type: 'entries'; entries: ChatEntry[] }
  | { type: 'live'; live: ChatLive }
  | { type: 'error'; message: string };

export type ChatClientMessage =
  /** Ask a question. `id` makes a retried send idempotent. Sent while busy, it is queued as a follow-up. */
  | { type: 'ask'; text: string; id?: string }
  /** Steer the running answer ("use last year instead"), joining it after the current round of tools. */
  | { type: 'steer'; text: string }
  /** Stop the running answer. */
  | { type: 'abort' };
