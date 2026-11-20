import { computed, signal, type Signal } from '@angular/core';
import type { AnswerMode, ChatClientMessage, ChatEntry, ChatLive, ChatServerMessage } from '@compass/contracts';
import { groupTurns, type ChatTurn, type PendingAsk, type Usage } from './chat-turns';
import type { AskScope } from './round2-contracts';

/** The part of a `WebSocket` the client uses, so tests can pass a fake. */
export interface SocketLike {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type SocketFactory = (url: string) => SocketLike;

/** `idle`: not asked to connect. `connecting`: first attempt. `open`: snapshot received. `reconnecting`: lost, retrying. */
export type ChatStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

export interface ChatSocketOptions<Extra extends { type: string } = never> {
  /** Called on every (re)connect, so it can follow the current conversation. */
  url: () => string;
  createSocket?: SocketFactory;
  /** Messages that are not part of the chat protocol (the builder's `draft` and `run`). */
  onMessage?: (message: Extra) => void;
  /** Backoff between reconnects: `baseMs · 2^attempt`, capped at `maxMs`, plus up to 25% jitter. */
  backoff?: { baseMs: number; maxMs: number };
}

interface QueuedAsk extends PendingAsk {
  mode?: AnswerMode;
  /** The hotels the question is asked for (round2-contracts §1); absent for the whole group. */
  scope?: AskScope;
  /** Sent on the current or an earlier socket; false while it waits for a connection. */
  sent: boolean;
}

const OPEN = 1;
const NO_USAGE: Usage = { tokens: 0, costUsd: 0 };
const CHAT_TYPES = new Set(['snapshot', 'entries', 'live', 'error']);

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function parse(data: unknown): { type: string } | null {
  if (typeof data !== 'string') return null;
  try {
    const message: unknown = JSON.parse(data);
    return typeof message === 'object' && message !== null && typeof (message as { type?: unknown }).type === 'string'
      ? (message as { type: string })
      : null;
  } catch {
    return null;
  }
}

/**
 * The Kassandra chat protocol over one WebSocket, as signals. It keeps the transcript merged by entry id, replaces
 * `live` on every update, reconnects with backoff (a fresh snapshot is merged in), and resends questions that were
 * not confirmed, with the same id, so none is asked twice.
 *
 * Not an Angular service: `KassandraChat` wraps one for the main chat, and the workflow builder can make its own
 * with `onMessage` for its extra messages.
 */
export class ChatSocket<Extra extends { type: string } = never> {
  private readonly entriesById = new Map<number, ChatEntry>();
  private readonly _entries = signal<ChatEntry[]>([]);
  private readonly _live = signal<ChatLive | null>(null);
  private readonly _status = signal<ChatStatus>('idle');
  private readonly _error = signal<string | null>(null);
  private readonly _pending = signal<QueuedAsk[]>([]);

  private socket: SocketLike | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;

  /** The transcript, ascending by id. Entries never change once received. */
  readonly entries: Signal<ChatEntry[]> = this._entries.asReadonly();
  /** The run state; null until the first snapshot. */
  readonly live: Signal<ChatLive | null> = this._live.asReadonly();
  readonly status: Signal<ChatStatus> = this._status.asReadonly();
  /** True once the snapshot is in: questions go out at once. While false they are kept and sent on reconnect. */
  readonly connected = computed(() => this._status() === 'open');
  /** The last message the server rejected (rate limit, daily budget, empty question). Show it as is. */
  readonly error: Signal<string | null> = this._error.asReadonly();
  /** Questions sent from here that are not in the transcript yet. */
  readonly pending: Signal<readonly PendingAsk[]> = this._pending.asReadonly();
  /** Show the Stop button while true. */
  readonly running = computed(() => this._live()?.running ?? false);
  /** Tokens and cost of the whole conversation, for the cost meter. */
  readonly usage = computed<Usage>(() => this._live()?.usage ?? NO_USAGE);
  /** The transcript grouped for rendering; see `groupTurns`. */
  readonly turns = computed<ChatTurn[]>(() => groupTurns(this._entries(), this._live(), this._pending()));

  constructor(private readonly options: ChatSocketOptions<Extra>) {}

  /** Opens the socket if it is not open or on its way. Safe to call again. */
  connect(): void {
    if (this.socket || this.retry) return;
    this._status.set('connecting');
    this.open();
  }

  /** Closes the socket and stops reconnecting. The transcript stays, so a later `connect()` merges into it. */
  disconnect(): void {
    this.clearRetry();
    this.attempt = 0;
    this.dropSocket();
    this._status.set('idle');
  }

  /** Disconnects and forgets the transcript, e.g. before the URL changes to another conversation. */
  reset(): void {
    this.disconnect();
    this.entriesById.clear();
    this._entries.set([]);
    this._live.set(null);
    this._error.set(null);
    this._pending.set([]);
  }

  /**
   * Asks a question and returns its id, or null when the text is empty. It shows at once as a pending turn. While
   * the socket is down it is kept and sent after the reconnect. `scope` restricts the answer to those hotels; leave
   * it out (or empty) for the whole group.
   */
  ask(text: string, mode?: AnswerMode, scope?: AskScope): string | null {
    const question = text.trim();
    if (!question) return null;
    this._error.set(null);
    const ask: QueuedAsk = { id: newId(), text: question, ...(mode ? { mode } : {}), ...(scope?.hotels.length ? { scope: { hotels: [...scope.hotels] } } : {}), sent: false };
    this._pending.update((pending) => [...pending, ask]);
    if (this.connected()) this.sendAsk(ask);
    else this.connect();
    return ask.id;
  }

  /** Steers the running answer. False when it could not be sent (not connected, or empty). */
  steer(text: string): boolean {
    const steer = text.trim();
    if (!steer) return false;
    this._error.set(null);
    return this.send({ type: 'steer', text: steer });
  }

  /** Stops the running answer. False when not connected. */
  abort(): boolean {
    return this.send({ type: 'abort' });
  }

  clearError(): void {
    this._error.set(null);
  }

  /** Sends any message of the socket's protocol (the builder's `edit`, `save`, `test`). False when not connected. */
  send(message: ChatClientMessage | { type: string }): boolean {
    if (!this.connected() || this.socket?.readyState !== OPEN) return false;
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  private open(): void {
    let socket: SocketLike;
    try {
      socket = (this.options.createSocket ?? ((url) => new WebSocket(url)))(this.options.url());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onmessage = (event) => {
      if (this.socket === socket) this.receive(event.data);
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.scheduleReconnect();
    };
    // An error is always followed by a close, which is where the reconnect is scheduled.
    socket.onerror = () => undefined;
  }

  private receive(data: unknown): void {
    const message = parse(data);
    if (!message) return;
    if (!CHAT_TYPES.has(message.type)) {
      this.options.onMessage?.(message as Extra);
      return;
    }
    const chat = message as ChatServerMessage;
    switch (chat.type) {
      case 'snapshot':
        this.merge(chat.entries);
        this._live.set(chat.live);
        this.attempt = 0;
        this._status.set('open');
        // Whatever is still unconfirmed goes out again with its id: the server ignores the ones it already has.
        for (const ask of this._pending()) this.sendAsk(ask);
        break;
      case 'entries':
        this.merge(chat.entries);
        break;
      case 'live':
        this._live.set(chat.live);
        break;
      case 'error':
        this._error.set(chat.message);
        // A rejected question never reaches the transcript: stop showing it as on its way.
        this._pending.update((pending) => pending.filter((ask) => !ask.sent));
        break;
    }
  }

  private merge(incoming: readonly ChatEntry[]): void {
    if (!Array.isArray(incoming)) return;
    const confirmed: string[] = [];
    let added = false;
    for (const entry of incoming) {
      if (this.entriesById.has(entry.id)) continue;
      this.entriesById.set(entry.id, entry);
      added = true;
      if (entry.kind === 'user') confirmed.push(entry.text.trim());
    }
    if (!added) return;
    this._entries.set([...this.entriesById.values()].sort((a, b) => a.id - b.id));
    if (confirmed.length && this._pending().length) {
      this._pending.update((pending) =>
        pending.filter((ask) => {
          const at = confirmed.indexOf(ask.text);
          if (at < 0) return true;
          confirmed.splice(at, 1);
          return false;
        }),
      );
    }
  }

  private sendAsk(ask: QueuedAsk): void {
    const message = { type: 'ask', text: ask.text, id: ask.id, ...(ask.mode ? { mode: ask.mode } : {}), ...(ask.scope ? { scope: ask.scope } : {}) };
    const sent = this.send(message);
    if (sent && !ask.sent) this._pending.update((pending) => pending.map((other) => (other.id === ask.id ? { ...other, sent: true } : other)));
  }

  private scheduleReconnect(): void {
    this._status.set('reconnecting');
    const { baseMs, maxMs } = this.options.backoff ?? { baseMs: 500, maxMs: 15_000 };
    const delay = Math.min(maxMs, baseMs * 2 ** this.attempt);
    this.attempt += 1;
    this.retry = setTimeout(
      () => {
        this.retry = null;
        this.open();
      },
      delay * (1 + Math.random() * 0.25),
    );
  }

  private clearRetry(): void {
    if (this.retry !== null) clearTimeout(this.retry);
    this.retry = null;
  }

  private dropSocket(): void {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    try {
      socket.close(1000);
    } catch {
      // Already closed.
    }
  }
}
