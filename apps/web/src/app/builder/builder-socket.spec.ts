import type { BuilderServerMessage, ChatEntry, WorkflowGraph } from '@compass/contracts';
import { specToGraph } from '@compass/contracts';
import { BuilderSocket, EMPTY_GRAPH, IDLE_LIVE, builderSocketUrl, ensureDraftId, mergeEntries, workflowToEdit, type SocketLike } from './builder-socket';

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  closed = false;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(message: BuilderServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({});
  }
}

const URL = 'wss://example.test/api/workflows/builder/ws?draft=abc';
const user = (id: number, text: string): ChatEntry => ({ id, kind: 'user', text, at: id });
const snapshot = (entries: ChatEntry[]): BuilderServerMessage => ({ type: 'snapshot', conversation: 'abc', entries, live: IDLE_LIVE });
const graphWithTrigger: WorkflowGraph = specToGraph({ trigger: { kind: 'schedule', every: 'day' } });
const draftMessage = (over: Partial<Extract<BuilderServerMessage, { type: 'draft' }>> = {}): BuilderServerMessage => ({
  type: 'draft',
  draft: { trigger: { kind: 'schedule', every: 'day' } },
  graph: graphWithTrigger,
  changed: ['trigger'],
  workflowId: null,
  issues: ['goal: Invalid input: expected string, received undefined'],
  ...over,
});

function connect() {
  const client = new BuilderSocket({ url: URL, createSocket: (url) => new FakeSocket(url), backoffMs: [100, 200] });
  return { client, socket: () => FakeSocket.all.at(-1)! };
}

describe('BuilderSocket', () => {
  beforeEach(() => {
    FakeSocket.all = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('starts with the placeholder chain, the same one the server sends for an empty draft', () => {
    const { client } = connect();
    expect(EMPTY_GRAPH).toEqual(specToGraph({}));
    expect(client.graph()).toEqual(EMPTY_GRAPH);
    expect(client.state()).toBe('connecting');
    expect(client.connected()).toBe(false);
    expect(client.loaded()).toBe(false);
    expect(FakeSocket.all[0]!.url).toBe(URL);
  });

  it('takes the snapshot, then merges later entries by id', () => {
    const { client, socket } = connect();
    socket().open();
    expect(client.connected()).toBe(true);
    socket().receive(snapshot([user(2, 'b'), user(1, 'a')]));
    expect(client.entries().map((entry) => entry.id)).toEqual([1, 2]);

    socket().receive({ type: 'entries', entries: [user(3, 'c'), user(2, 'b again')] });
    expect(client.entries().map((entry) => entry.id)).toEqual([1, 2, 3]);
    expect(client.entries()[1]).toMatchObject({ text: 'b again' });

    socket().receive({ type: 'live', live: { ...IDLE_LIVE, running: true, streamingText: 'Setting' } });
    expect(client.live().running).toBe(true);
  });

  it('replaces the draft on every draft message and counts the revisions', () => {
    const { client, socket } = connect();
    socket().open();
    socket().receive(draftMessage({ draft: {}, graph: EMPTY_GRAPH, changed: [], issues: ['a: b', 'c: d'] }));
    expect(client.loaded()).toBe(true);
    expect(client.changed()).toEqual([]);
    expect(client.issues()).toHaveLength(2);

    socket().receive(draftMessage());
    expect(client.draft()).toEqual({ trigger: { kind: 'schedule', every: 'day' } });
    expect(client.graph().nodes[0]).toMatchObject({ id: 'trigger', state: 'complete' });
    expect(client.changed()).toEqual(['trigger']);
    expect(client.workflowId()).toBeNull();
    expect(client.revision()).toBe(2);
  });

  it('sends ask (with an id), steer, abort, edit, save and test as the contract spells them', () => {
    const { client, socket } = connect();
    socket().open();
    client.ask('Email me every morning');
    client.steer('weekly instead');
    client.abort();
    client.edit({ goal: 'Watch the pace of Lisbon' });
    client.save();
    client.test();
    const sent = socket().sent as { type: string; id?: string }[];
    expect(sent.map((message) => message.type)).toEqual(['ask', 'steer', 'abort', 'edit', 'save', 'test']);
    expect(sent[0]).toMatchObject({ type: 'ask', text: 'Email me every morning' });
    expect(sent[0]!.id).toMatch(/^q-/);
    expect(sent[3]).toEqual({ type: 'edit', patch: { goal: 'Watch the pace of Lisbon' } });
  });

  it('tracks a save: pending until the draft comes back with its workflow id, unsaved after a later change', () => {
    const { client, socket } = connect();
    socket().open();
    socket().receive(draftMessage({ issues: [] }));
    expect(client.saved()).toBe(false);

    client.save();
    expect(client.pending()).toBe('save');
    socket().receive(draftMessage({ issues: [], changed: [], workflowId: 'wf_1' }));
    expect(client.pending()).toBeNull();
    expect(client.workflowId()).toBe('wf_1');
    expect(client.saved()).toBe(true);

    socket().receive(draftMessage({ issues: [], changed: ['analyze'], workflowId: 'wf_1' }));
    expect(client.saved()).toBe(false);

    client.save();
    socket().receive(draftMessage({ issues: [], changed: [], workflowId: 'wf_1' }));
    expect(client.saved()).toBe(true);
  });

  it('follows a test run node by node and clears the pending test on its first message', () => {
    const { client, socket } = connect();
    socket().open();
    client.test();
    expect(client.pending()).toBe('test');
    expect(client.run()).toBeNull();

    socket().receive({ type: 'run', runId: 'r1', status: 'running', activeNode: 'check:get_pace', done: ['trigger', 'scope'], failed: null });
    expect(client.pending()).toBeNull();
    expect(client.run()).toEqual({ runId: 'r1', status: 'running', activeNode: 'check:get_pace', done: ['trigger', 'scope'], failed: null });

    socket().receive({ type: 'run', runId: 'r1', status: 'done', activeNode: null, done: ['trigger', 'scope', 'check:get_pace', 'analyze', 'action'], failed: null });
    expect(client.run()).toMatchObject({ status: 'done', activeNode: null });
    expect(client.run()!.done).toContain('action');
  });

  it('keeps a server error until the next action, and an error ends a pending save', () => {
    const { client, socket } = connect();
    socket().open();
    client.save();
    socket().receive({ type: 'error', message: 'The agent can’t be saved yet.' });
    expect(client.error()).toBe('The agent can’t be saved yet.');
    expect(client.pending()).toBeNull();
    client.edit({ hotels: ['LIS'] });
    expect(client.error()).toBeNull();
  });

  it('reconnects with a backoff and replaces the transcript with the fresh snapshot', () => {
    const { client, socket } = connect();
    socket().open();
    socket().receive(snapshot([user(1, 'a'), user(2, 'half-told')]));
    socket().receive(draftMessage());

    socket().drop();
    expect(client.connected()).toBe(false);
    expect(client.state()).toBe('reconnecting');
    expect(FakeSocket.all).toHaveLength(1);

    vi.advanceTimersByTime(100);
    expect(FakeSocket.all).toHaveLength(2);
    socket().drop(); // the second attempt fails too: the next wait is longer
    vi.advanceTimersByTime(199);
    expect(FakeSocket.all).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(3);

    socket().open();
    expect(client.state()).toBe('open');
    socket().receive(snapshot([user(1, 'a'), user(3, 'c')]));
    socket().receive(draftMessage({ changed: [] }));
    expect(client.entries().map((entry) => entry.id)).toEqual([1, 3]);
    expect(client.changed()).toEqual([]);
    expect(client.graph().nodes[0]!.state).toBe('complete');
  });

  it('sends what was typed while offline once the socket is back', () => {
    const { client, socket } = connect();
    client.ask('before the socket opened');
    expect(socket().sent).toEqual([]);
    socket().open();
    expect(socket().sent).toHaveLength(1);

    socket().drop();
    client.edit({ hotels: ['LIS'] });
    vi.advanceTimersByTime(100);
    socket().open();
    expect(socket().sent).toEqual([{ type: 'edit', patch: { hotels: ['LIS'] } }]);
  });

  it('gives up a test run that was in flight when the connection dropped, and says so', () => {
    const { client, socket } = connect();
    socket().open();
    socket().receive({ type: 'run', runId: 'r1', status: 'running', activeNode: 'analyze', done: ['trigger'], failed: null });
    socket().drop();
    expect(client.run()).toBeNull();
    expect(client.error()).toMatch(/connection dropped during the test/i);
  });

  it('ignores a socket it has replaced, garbage frames, and stops for good on close()', () => {
    const { client, socket } = connect();
    const first = socket();
    first.open();
    first.drop();
    client.reconnect();
    expect(FakeSocket.all).toHaveLength(2);
    first.receive(snapshot([user(9, 'stale')]));
    expect(client.entries()).toEqual([]);

    socket().open();
    socket().onmessage?.({ data: 'not json' });
    socket().onmessage?.({ data: 'null' });
    expect(client.error()).toBeNull();

    client.close();
    expect(socket().closed).toBe(true);
    expect(client.state()).toBe('closed');
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.all).toHaveLength(2);
    client.ask('after close');
    expect(socket().sent).toEqual([]);
  });
});

describe('draft id and socket address', () => {
  it('keeps a valid draft id from the address bar', () => {
    const replaceState = vi.fn();
    const id = 'a'.repeat(36);
    expect(ensureDraftId({ href: `https://x.test/workflows/new?draft=${id}` }, { replaceState }, () => 'unused')).toBe(id);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('replaces a missing or malformed id with a random one and writes it to the address bar', () => {
    const replaceState = vi.fn();
    const fresh = '0b8c2f0e-6f0f-4a65-9d0e-0a4b6f2f9c11';
    expect(ensureDraftId({ href: 'https://x.test/workflows/new?builder&draft=short#top' }, { replaceState }, () => fresh)).toBe(fresh);
    expect(replaceState).toHaveBeenCalledWith(null, '', `/workflows/new?builder=&draft=${fresh}#top`);
  });

  it('builds the socket address from the page: wss on https, ws on http, through the dev proxy', () => {
    expect(builderSocketUrl({ protocol: 'https:', host: 'juyo.razvanfrandes.com' }, 'abc')).toBe('wss://juyo.razvanfrandes.com/api/workflows/builder/ws?draft=abc');
    expect(builderSocketUrl({ protocol: 'http:', host: 'localhost:4200' }, 'abc')).toBe('ws://localhost:4200/api/workflows/builder/ws?draft=abc');
    // Editing: the workflow to load rides along, and the draft id stays a fresh one (round2-contracts.md §5).
    expect(builderSocketUrl({ protocol: 'https:', host: 'x.test' }, 'abc', 'wf-8044fd15')).toBe('wss://x.test/api/workflows/builder/ws?draft=abc&workflow=wf-8044fd15');
    expect(workflowToEdit({ pathname: '/workflows/wf-8044fd15/edit' })).toBe('wf-8044fd15');
    expect(workflowToEdit({ pathname: '/workflows/tpl-pace-guard/edit/' })).toBe('tpl-pace-guard');
    expect(workflowToEdit({ pathname: '/workflows/new' })).toBeNull();
    expect(workflowToEdit({ pathname: '/workflows/a%2Fb/edit' })).toBeNull();
  });

  it('merges entries without touching the list it was given', () => {
    const current = [user(1, 'a')];
    expect(mergeEntries(current, [user(2, 'b')]).map((entry) => entry.id)).toEqual([1, 2]);
    expect(current).toHaveLength(1);
  });
});
