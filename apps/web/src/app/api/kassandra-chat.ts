import { DestroyRef, inject, InjectionToken, Service, signal, type Signal } from '@angular/core';
import type { AnswerMode, ThreadMeta } from '@compass/contracts';
import { API_BASE, wsUrl } from './api-config';
import { ChatSocket, type SocketFactory } from './chat-socket';
import type { AskScope } from './round2-contracts';

/** How sockets are made. Tests provide a fake. */
export const SOCKET_FACTORY = new InjectionToken<SocketFactory>('SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url) => new WebSocket(url),
});

export const CONVERSATION_STORAGE_KEY = 'compass.kassandra.conversation';

const CONVERSATION_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isConversationId(value: unknown): value is string {
  return typeof value === 'string' && CONVERSATION_ID.test(value);
}

function newConversationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function readStored(): string | null {
  try {
    const stored = localStorage.getItem(CONVERSATION_STORAGE_KEY);
    return isConversationId(stored) ? stored : null;
  } catch {
    return null;
  }
}

function store(id: string): void {
  try {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, id);
  } catch {
    // Private mode or blocked storage: the conversation lasts for this page only.
  }
}

/**
 * The Kassandra chat (`/api/kassandra/ws`). One conversation at a time; its id is kept in local storage, so a
 * reload comes back to the same durable transcript. Nothing connects until `connect()` or the first `ask()`.
 */
@Service()
export class KassandraChat {
  private readonly base = inject(API_BASE);
  private readonly _conversation = signal(readStored() ?? newConversationId());
  private readonly _meta = signal<{ conversation: string; meta: ThreadMeta } | null>(null);
  private readonly chat = new ChatSocket<{ type: 'meta'; meta: ThreadMeta }>({
    url: () => wsUrl(this.base, 'kassandra/ws', { conversation: this._conversation() }),
    createSocket: inject(SOCKET_FACTORY),
    // The conversation's title and takeaway, written on the server after its first answer.
    onMessage: (message) => {
      if (message.type === 'meta' && message.meta && typeof message.meta.title === 'string') this._meta.set({ conversation: this._conversation(), meta: message.meta });
    },
  });

  readonly conversation: Signal<string> = this._conversation.asReadonly();
  readonly entries = this.chat.entries;
  readonly live = this.chat.live;
  readonly status = this.chat.status;
  readonly connected = this.chat.connected;
  readonly error = this.chat.error;
  readonly pending = this.chat.pending;
  readonly running = this.chat.running;
  readonly usage = this.chat.usage;
  readonly turns = this.chat.turns;
  /** The last title and takeaway the server sent, with the conversation it belongs to. */
  readonly meta = this._meta.asReadonly();

  constructor() {
    store(this._conversation());
    inject(DestroyRef).onDestroy(() => this.chat.disconnect());
  }

  connect(): void {
    this.chat.connect();
  }

  disconnect(): void {
    this.chat.disconnect();
  }

  /**
   * `mode` applies from this question on; a question sent while an answer is running keeps the current mode.
   * `scope` is the hotel scope the answer is restricted to (empty or absent: the whole group).
   */
  ask(text: string, mode: AnswerMode = 'thinker', scope?: AskScope): string | null {
    return this.chat.ask(text, mode, scope);
  }

  steer(text: string): boolean {
    return this.chat.steer(text);
  }

  abort(): boolean {
    return this.chat.abort();
  }

  clearError(): void {
    this.chat.clearError();
  }

  /** Switches to another conversation (e.g. an id from the URL) and connects. False when the id is not valid. */
  open(conversation: string): boolean {
    if (!isConversationId(conversation)) return false;
    if (conversation !== this._conversation()) {
      this.chat.reset();
      this._conversation.set(conversation);
      store(conversation);
    }
    this.chat.connect();
    return true;
  }

  /** Starts an empty conversation ("New chat") and returns its id. It connects on the first question. */
  newConversation(): string {
    const id = newConversationId();
    this.chat.reset();
    this._conversation.set(id);
    store(id);
    return id;
  }
}
