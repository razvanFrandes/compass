import { signal } from '@angular/core';
import type { BuilderClientMessage, BuilderServerMessage, ChatEntry, ChatLive, WorkflowDraft, WorkflowGraph } from '@compass/contracts';

/**
 * The workflow builder's socket (docs/api.md, "Workflow builder: WebSocket") as signals.
 * One instance per draft. It reconnects by itself; every new connection starts with a fresh snapshot and draft.
 */

export const DRAFT_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** A test run as the canvas reads it: node ids of the chain. */
export interface BuilderRun {
  runId: string;
  status: 'running' | 'waiting_approval' | 'done' | 'failed';
  activeNode: string | null;
  done: string[];
  failed: string | null;
}

export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed';

/** The chain before the server has said anything: six placeholders (the same as `specToGraph({})`). */
export const EMPTY_GRAPH: WorkflowGraph = {
  nodes: [
    { id: 'trigger', kind: 'trigger', label: 'Choose a trigger', detail: 'When should it run?', state: 'empty' },
    { id: 'scope', kind: 'scope', label: 'Choose hotels', detail: 'Which hotels should it watch?', state: 'empty' },
    { id: 'check', kind: 'check', label: 'Add a check', detail: 'Which numbers should it look at?', state: 'empty' },
    { id: 'analyze', kind: 'analyze', label: 'Describe what to watch', detail: 'What should it look for, and when should it act?', state: 'empty' },
    { id: 'action', kind: 'action', label: 'Choose an action', detail: 'What should it do when it finds something?', state: 'empty' },
  ],
  edges: [
    { from: 'trigger', to: 'scope' },
    { from: 'scope', to: 'check' },
    { from: 'check', to: 'analyze' },
    { from: 'analyze', to: 'action' },
  ],
};

export const IDLE_LIVE: ChatLive = { running: false, streamingText: '', tools: [], turns: 0, failure: null, usage: { tokens: 0, costUsd: 0 } };

/** The part of the browser's WebSocket this client uses, so a test can pass a fake. */
export interface SocketLike {
  readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface BuilderSocketOptions {
  /** The full socket URL, with the draft id. */
  url: string;
  createSocket?: (url: string) => SocketLike;
  /** Delays between reconnect attempts; the last one repeats. */
  backoffMs?: readonly number[];
}

const OPEN = 1;
const DEFAULT_BACKOFF = [500, 1000, 2000, 4000, 8000] as const;
/** Messages typed while the socket is down are sent when it is back; more than this is a stuck connection. */
const MAX_QUEUED = 8;

/**
 * The draft id is the only key to a draft, so it is a random UUID and lives in the address bar (`?draft=`):
 * reloading or coming back to the link reopens the same draft.
 */
export function ensureDraftId(location: Pick<Location, 'href'>, history: Pick<History, 'replaceState'>, random: () => string = () => crypto.randomUUID()): string {
  const url = new URL(location.href);
  const current = url.searchParams.get('draft');
  if (current && DRAFT_ID_PATTERN.test(current)) return current;
  const id = random();
  url.searchParams.set('draft', id);
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  return id;
}

/** `/workflows/<id>/edit` → the id of the workflow to open in the builder; null at `/workflows/new`. */
export function workflowToEdit(location: Pick<Location, 'pathname'>): string | null {
  const match = location.pathname.match(/^\/workflows\/([A-Za-z0-9_-]{1,64})\/edit\/?$/);
  return match && match[1] !== 'new' ? match[1]! : null;
}

/**
 * Same origin as the page: production serves the API itself, and `ng serve` proxies `/api`, sockets included.
 * With `workflowId`, the server loads that workflow into the draft, and Save updates it (round2-contracts.md §5).
 */
export function builderSocketUrl(location: Pick<Location, 'protocol' | 'host'>, draftId: string, workflowId?: string | null): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const workflow = workflowId ? `&workflow=${encodeURIComponent(workflowId)}` : '';
  return `${scheme}://${location.host}/api/workflows/builder/ws?draft=${encodeURIComponent(draftId)}${workflow}`;
}

export class BuilderSocket {
  readonly entries = signal<ChatEntry[]>([]);
  readonly live = signal<ChatLive>(IDLE_LIVE);
  readonly draft = signal<WorkflowDraft>({});
  readonly graph = signal<WorkflowGraph>(EMPTY_GRAPH);
  /** Node ids the last `draft` message changed. */
  readonly changed = signal<string[]>([]);
  /** Counts `draft` messages, so the canvas can replay its highlight when the same node changes twice. */
  readonly revision = signal(0);
  readonly workflowId = signal<string | null>(null);
  readonly issues = signal<string[]>([]);
  /** False until the first `draft` message: before it, nothing is known about the draft. */
  readonly loaded = signal(false);
  readonly run = signal<BuilderRun | null>(null);
  /** A save or a test the server has not answered yet. */
  readonly pending = signal<'save' | 'test' | null>(null);
  /** The draft reads the same as the workflow it was saved as. */
  readonly saved = signal(false);
  readonly state = signal<ConnectionState>('connecting');
  readonly connected = signal(false);
  /** The last thing the server refused or the connection lost, until the next action. */
  readonly error = signal<string | null>(null);

  readonly #url: string;
  readonly #createSocket: (url: string) => SocketLike;
  readonly #backoff: readonly number[];
  #socket: SocketLike | null = null;
  #attempt = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #queue: BuilderClientMessage[] = [];
  #closed = false;
  #askSeq = 0;

  constructor(options: BuilderSocketOptions) {
    this.#url = options.url;
    this.#createSocket = options.createSocket ?? ((url) => new WebSocket(url) as unknown as SocketLike);
    this.#backoff = options.backoffMs?.length ? options.backoffMs : DEFAULT_BACKOFF;
    this.#open();
  }

  /** `id` makes a resend after a dropped connection idempotent on the server. */
  ask(text: string): void {
    this.#act({ type: 'ask', text, id: `q-${Date.now().toString(36)}-${++this.#askSeq}` });
  }

  steer(text: string): void {
    this.#act({ type: 'steer', text });
  }

  abort(): void {
    this.#send({ type: 'abort' });
  }

  edit(patch: WorkflowDraft): void {
    this.#act({ type: 'edit', patch });
  }

  save(): void {
    this.#act({ type: 'save' });
    this.pending.set('save');
  }

  /** "Send test now": the server saves first when it has to. */
  test(): void {
    this.run.set(null);
    this.#act({ type: 'test' });
    this.pending.set('test');
  }

  dismissError(): void {
    this.error.set(null);
  }

  /** Try again now instead of waiting for the next attempt. */
  reconnect(): void {
    if (this.#closed || this.connected()) return;
    this.#clearTimer();
    this.#open();
  }

  close(): void {
    this.#closed = true;
    this.#clearTimer();
    this.connected.set(false);
    this.state.set('closed');
    const socket = this.#socket;
    this.#socket = null;
    if (socket) {
      this.#detach(socket);
      socket.close();
    }
  }

  #act(message: BuilderClientMessage): void {
    this.error.set(null);
    this.#send(message);
  }

  #send(message: BuilderClientMessage): void {
    const socket = this.#socket;
    if (socket && socket.readyState === OPEN) {
      socket.send(JSON.stringify(message));
      return;
    }
    if (this.#closed) return;
    if (this.#queue.length >= MAX_QUEUED) {
      this.error.set('Not connected. Your last message was not sent.');
      return;
    }
    this.#queue.push(message);
  }

  #open(): void {
    if (this.#closed) return;
    const previous = this.#socket;
    if (previous) {
      this.#detach(previous);
      previous.close();
    }
    let socket: SocketLike;
    try {
      socket = this.#createSocket(this.#url);
    } catch {
      this.#socket = null;
      this.#retry();
      return;
    }
    this.#socket = socket;
    socket.onopen = () => {
      if (socket !== this.#socket) return;
      this.#attempt = 0;
      this.connected.set(true);
      this.state.set('open');
      const queued = this.#queue;
      this.#queue = [];
      for (const message of queued) socket.send(JSON.stringify(message));
    };
    socket.onmessage = (event) => {
      if (socket !== this.#socket || typeof event.data !== 'string') return;
      let message: BuilderServerMessage;
      try {
        message = JSON.parse(event.data) as BuilderServerMessage;
      } catch {
        return;
      }
      this.#receive(message);
    };
    socket.onclose = () => {
      if (socket !== this.#socket) return;
      this.#socket = null;
      this.#retry();
    };
    // A failed connection also closes; `onclose` does the work.
    socket.onerror = () => undefined;
  }

  #retry(): void {
    this.connected.set(false);
    this.pending.set(null);
    if (this.#closed) return;
    this.state.set('reconnecting');
    // The server follows a test only while a socket is open, so a run in flight is lost to this page.
    if (this.run()?.status === 'running') {
      this.run.set(null);
      this.error.set('The connection dropped during the test. The run may still finish; check the workflow for its result.');
    }
    const delay = this.#backoff[Math.min(this.#attempt, this.#backoff.length - 1)]!;
    this.#attempt += 1;
    this.#clearTimer();
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#open();
    }, delay);
  }

  #receive(message: BuilderServerMessage): void {
    if (!message || typeof message !== 'object') return;
    switch (message.type) {
      case 'snapshot':
        // A snapshot is the whole transcript: it replaces what a dropped connection may have left half-told.
        this.entries.set(sortEntries(message.entries));
        this.live.set(message.live);
        return;
      case 'entries':
        this.entries.update((current) => mergeEntries(current, message.entries));
        return;
      case 'live':
        this.live.set(message.live);
        return;
      case 'error':
        this.error.set(message.message);
        this.pending.set(null);
        return;
      case 'draft': {
        // Saved: a first save or a replaced workflow gives a new id; a later save (or a fresh connection) changes
        // no node. Any other change after that is an edit the workflow does not have yet.
        const answersSave = this.pending() !== null || !this.loaded();
        if (message.workflowId === null) this.saved.set(false);
        else if (message.workflowId !== this.workflowId() || (answersSave && message.changed.length === 0)) this.saved.set(true);
        else if (message.changed.length) this.saved.set(false);
        if (this.pending() === 'save') this.pending.set(null);
        this.draft.set(message.draft);
        this.graph.set(message.graph);
        this.changed.set(message.changed);
        this.workflowId.set(message.workflowId);
        this.issues.set(message.issues);
        this.revision.update((count) => count + 1);
        this.loaded.set(true);
        return;
      }
      case 'run':
        this.pending.set(null);
        this.run.set({ runId: message.runId, status: message.status, activeNode: message.activeNode, done: message.done, failed: message.failed });
        return;
      default:
        return;
    }
  }

  #detach(socket: SocketLike): void {
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
  }

  #clearTimer(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}

const sortEntries = (entries: readonly ChatEntry[]) => [...entries].sort((a, b) => a.id - b.id);

/** Entries are immutable and keyed by `id`: a resent one replaces its copy, a new one is added in order. */
export function mergeEntries(current: readonly ChatEntry[], incoming: readonly ChatEntry[]): ChatEntry[] {
  if (!incoming.length) return [...current];
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return sortEntries([...byId.values()]);
}
