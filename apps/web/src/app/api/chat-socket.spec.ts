import { ChatSocket } from './chat-socket';
import { answer, FakeSocket, live, steps, user } from './testing';

function setup(onMessage?: (message: { type: string }) => void) {
  const chat = new ChatSocket<{ type: string }>({
    url: () => 'ws://test/api/kassandra/ws?conversation=c1',
    createSocket: (url) => new FakeSocket(url),
    backoff: { baseMs: 100, maxMs: 1000 },
    ...(onMessage ? { onMessage } : {}),
  });
  return chat;
}

const snapshot = (entries = [user(1, 'hello'), answer(2, 'hi')], state = live()) => ({ type: 'snapshot' as const, conversation: 'c1', entries, live: state });

describe('ChatSocket', () => {
  beforeEach(() => {
    FakeSocket.reset();
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does nothing until asked to connect, then is connected once the snapshot is in', () => {
    const chat = setup();
    expect(FakeSocket.instances).toHaveLength(0);
    expect(chat.status()).toBe('idle');

    chat.connect();
    chat.connect();
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.last.url).toBe('ws://test/api/kassandra/ws?conversation=c1');
    expect(chat.connected()).toBe(false);

    FakeSocket.last.serve(snapshot());
    expect(chat.connected()).toBe(true);
    expect(chat.entries().map((entry) => entry.id)).toEqual([1, 2]);
    expect(chat.live()).toEqual(live());
  });

  it('appends entries by id, ignores repeats and keeps them in order', () => {
    const chat = setup();
    chat.connect();
    FakeSocket.last.serve(snapshot());
    const first = chat.entries()[0];

    FakeSocket.last.serve({ type: 'entries', entries: [user(4, 'later'), user(3, 'more')] });
    FakeSocket.last.serve({ type: 'entries', entries: [user(3, 'a repeat, ignored')] });

    expect(chat.entries().map((entry) => entry.id)).toEqual([1, 2, 3, 4]);
    expect(chat.entries()[2]).toMatchObject({ text: 'more' });
    expect(chat.entries()[0]).toBe(first);
  });

  it('replaces live and exposes running, usage and turns', () => {
    const chat = setup();
    chat.connect();
    FakeSocket.last.serve(snapshot([user(1, 'q')]));
    FakeSocket.last.serve({ type: 'live', live: live({ running: true, streamingText: 'Lis', usage: { tokens: 1200, costUsd: 0.04 } }) });

    expect(chat.running()).toBe(true);
    expect(chat.usage()).toEqual({ tokens: 1200, costUsd: 0.04 });
    expect(chat.turns()).toHaveLength(1);
    expect(chat.turns()[0]).toMatchObject({ question: 'q', running: true, streamingText: 'Lis' });

    FakeSocket.last.serve({ type: 'entries', entries: [answer(2, 'Lisbon is behind.')] });
    FakeSocket.last.serve({ type: 'live', live: live({ usage: { tokens: 1500, costUsd: 0.05 } }) });
    expect(chat.turns()[0]).toMatchObject({ answer: 'Lisbon is behind.', running: false, streamingText: '' });
    expect(chat.running()).toBe(false);
  });

  it('sends ask with an id and the mode, and shows it as pending until its entry arrives', () => {
    const chat = setup();
    chat.connect();
    FakeSocket.last.serve(snapshot([]));

    const id = chat.ask('  Why is Lisbon pacing behind?  ', 'quick');
    expect(id).toBeTruthy();
    expect(FakeSocket.last.sent).toEqual([{ type: 'ask', text: 'Why is Lisbon pacing behind?', id, mode: 'quick' }]);
    expect(chat.turns()).toHaveLength(1);
    expect(chat.turns()[0]).toMatchObject({ question: 'Why is Lisbon pacing behind?', pending: true });

    FakeSocket.last.serve({ type: 'entries', entries: [user(1, 'Why is Lisbon pacing behind?')] });
    expect(chat.pending()).toEqual([]);
    expect(chat.turns()).toHaveLength(1);
    expect(chat.turns()[0]).toMatchObject({ key: '1', pending: false });
  });

  it('does not send an empty question', () => {
    const chat = setup();
    chat.connect();
    FakeSocket.last.serve(snapshot([]));
    expect(chat.ask('   ')).toBeNull();
    expect(FakeSocket.last.sent).toEqual([]);
  });

  it('connects on the first ask and sends it after the snapshot', () => {
    const chat = setup();
    const id = chat.ask('hello?');
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.last.sent).toEqual([]);

    FakeSocket.last.serve(snapshot([]));
    expect(FakeSocket.last.sent).toEqual([{ type: 'ask', text: 'hello?', id }]);
  });

  it('sends steer and abort only while connected', () => {
    const chat = setup();
    expect(chat.steer('use last 30 days')).toBe(false);
    expect(chat.abort()).toBe(false);

    chat.connect();
    FakeSocket.last.serve(snapshot());
    expect(chat.steer(' use last 30 days ')).toBe(true);
    expect(chat.steer('  ')).toBe(false);
    expect(chat.abort()).toBe(true);
    expect(FakeSocket.last.sent).toEqual([{ type: 'steer', text: 'use last 30 days' }, { type: 'abort' }]);
  });

  it('surfaces a server error, drops the rejected question, and clears the error on the next ask', () => {
    const chat = setup();
    chat.connect();
    FakeSocket.last.serve(snapshot([]));
    chat.ask('one too many');

    FakeSocket.last.serve({ type: 'error', message: 'Too many questions. Try again in a minute.' });
    expect(chat.error()).toBe('Too many questions. Try again in a minute.');
    expect(chat.pending()).toEqual([]);
    expect(chat.connected()).toBe(true);

    chat.ask('again');
    expect(chat.error()).toBeNull();
  });

  it('reconnects with a growing backoff and merges the fresh snapshot', () => {
    const chat = setup();
    chat.connect();
    FakeSocket.last.serve(snapshot());

    FakeSocket.last.drop();
    expect(chat.status()).toBe('reconnecting');
    expect(chat.connected()).toBe(false);
    expect(chat.entries()).toHaveLength(2);

    vi.advanceTimersByTime(99);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);

    // The second attempt fails too: the wait doubles, up to the cap.
    FakeSocket.last.drop();
    vi.advanceTimersByTime(199);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);
    for (const wait of [400, 800, 1000, 1000]) {
      FakeSocket.last.drop();
      vi.advanceTimersByTime(wait - 1);
      const before = FakeSocket.instances.length;
      vi.advanceTimersByTime(1);
      expect(FakeSocket.instances.length).toBe(before + 1);
    }

    FakeSocket.last.serve(snapshot([answer(2, 'hi'), user(3, 'while away'), steps(4, [{ callId: 'a', name: 'get_pace' }])], live({ running: true })));
    expect(chat.connected()).toBe(true);
    expect(chat.entries().map((entry) => entry.id)).toEqual([1, 2, 3, 4]);
    expect(chat.running()).toBe(true);

    // Connected again: the backoff starts over.
    FakeSocket.last.drop();
    const count = FakeSocket.instances.length;
    vi.advanceTimersByTime(100);
    expect(FakeSocket.instances.length).toBe(count + 1);
  });

  it('resends an unconfirmed question with the same id after a reconnect', () => {
    const chat = setup();
    chat.connect();
    FakeSocket.last.serve(snapshot([]));
    const id = chat.ask('did this arrive?', 'thinker');
    FakeSocket.last.drop();

    const queued = chat.ask('asked while offline');
    vi.advanceTimersByTime(100);
    expect(FakeSocket.last.sent).toEqual([]);

    FakeSocket.last.serve(snapshot([]));
    expect(FakeSocket.last.sent).toEqual([
      { type: 'ask', text: 'did this arrive?', id, mode: 'thinker' },
      { type: 'ask', text: 'asked while offline', id: queued },
    ]);
  });

  it('does not resend a question the fresh snapshot already holds', () => {
    const chat = setup();
    chat.connect();
    FakeSocket.last.serve(snapshot([]));
    chat.ask('did this arrive?');
    FakeSocket.last.drop();
    vi.advanceTimersByTime(100);

    FakeSocket.last.serve(snapshot([user(1, 'did this arrive?')], live({ running: true })));
    expect(FakeSocket.last.sent).toEqual([]);
    expect(chat.pending()).toEqual([]);
    expect(chat.turns()).toHaveLength(1);
  });

  it('stops reconnecting after disconnect and ignores the old socket', () => {
    const chat = setup();
    chat.connect();
    const socket = FakeSocket.last;
    socket.serve(snapshot());

    chat.disconnect();
    expect(socket.closedByClient).toBe(true);
    expect(chat.status()).toBe('idle');
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);

    // A drop that was waiting to reconnect is cancelled too.
    chat.connect();
    FakeSocket.last.drop();
    chat.disconnect();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(chat.entries()).toHaveLength(2);
  });

  it('forgets the transcript on reset', () => {
    const chat = setup();
    chat.connect();
    FakeSocket.last.serve(snapshot(undefined, live({ usage: { tokens: 9, costUsd: 1 } })));
    chat.reset();
    expect(chat.entries()).toEqual([]);
    expect(chat.live()).toBeNull();
    expect(chat.usage()).toEqual({ tokens: 0, costUsd: 0 });
    expect(chat.turns()).toEqual([]);
  });

  it('ignores what it cannot read and hands other message types to onMessage', () => {
    const other: { type: string }[] = [];
    const chat = setup((message) => other.push(message));
    chat.connect();
    FakeSocket.last.serve(snapshot());

    FakeSocket.last.raw('not json');
    FakeSocket.last.raw(new ArrayBuffer(2));
    FakeSocket.last.raw('{"no":"type"}');
    FakeSocket.last.serve({ type: 'draft', issues: [] });

    expect(chat.entries()).toHaveLength(2);
    expect(chat.error()).toBeNull();
    expect(other).toEqual([{ type: 'draft', issues: [] }]);
  });

  it('retries when the socket cannot even be created', () => {
    let fail = true;
    const chat = new ChatSocket({
      url: () => 'ws://test',
      createSocket: (url) => {
        if (fail) throw new Error('blocked');
        return new FakeSocket(url);
      },
      backoff: { baseMs: 100, maxMs: 1000 },
    });
    chat.connect();
    expect(chat.status()).toBe('reconnecting');
    fail = false;
    vi.advanceTimersByTime(100);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
