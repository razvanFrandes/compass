import type { ChatEntry, ChatLive, ChatServerMessage } from '@compass/contracts';
import type { SocketLike } from './chat-socket';

/** Test helpers: a fake socket and entry builders. Not used by the app. */

export class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  static get last(): FakeSocket {
    return FakeSocket.instances.at(-1)!;
  }
  static reset(): void {
    FakeSocket.instances = [];
  }

  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly sent: Record<string, unknown>[] = [];
  closedByClient = false;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(): void {
    this.closedByClient = true;
    this.readyState = 3;
  }

  /** The server accepts the socket and sends a message. */
  serve(message: ChatServerMessage | { type: string; [key: string]: unknown }): void {
    this.readyState = 1;
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  }

  raw(data: unknown): void {
    this.readyState = 1;
    this.onmessage?.({ data } as MessageEvent);
  }

  /** The connection drops. */
  drop(): void {
    this.readyState = 3;
    this.onclose?.({ code: 1006 } as CloseEvent);
  }
}

export const live = (patch: Partial<ChatLive> = {}): ChatLive => ({
  running: false,
  streamingText: '',
  tools: [],
  turns: 0,
  failure: null,
  usage: { tokens: 0, costUsd: 0 },
  ...patch,
});

export const user = (id: number, text: string, at = id * 1000): ChatEntry => ({ id, kind: 'user', text, at });

export const steps = (id: number, calls: { callId: string; name: string }[], text = '', at = id * 1000): ChatEntry => ({
  id,
  kind: 'assistant',
  text,
  toolCalls: calls.map((call) => ({ ...call, args: { hotels: ['LIS'] } })),
  model: 'claude-sonnet',
  usage: { tokens: 100, costUsd: 0.01 },
  stopReason: 'toolUse',
  at,
});

export const answer = (id: number, text: string, at = id * 1000): ChatEntry => ({
  id,
  kind: 'assistant',
  text,
  toolCalls: [],
  model: 'claude-sonnet',
  usage: { tokens: 50, costUsd: 0.02 },
  stopReason: 'stop',
  at,
});

export const result = (id: number, callId: string, patch: Partial<Extract<ChatEntry, { kind: 'tool_result' }>> = {}, at = id * 1000): ChatEntry => ({
  id,
  kind: 'tool_result',
  callId,
  name: 'get_pace',
  isError: false,
  at,
  ...patch,
});
