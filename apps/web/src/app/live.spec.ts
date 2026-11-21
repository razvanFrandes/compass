import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SOCKET_FACTORY } from './api';
import { FakeSocket, live as liveState, user } from './api/testing';
import { Live, threadTitle } from './live';
import { ScopeService } from './scope/scope.service';
import { CompassStore } from './store';

function create(url = '/') {
  history.replaceState(null, '', url);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SOCKET_FACTORY, useValue: (socketUrl: string) => new FakeSocket(socketUrl) }] });
  const live = TestBed.inject(Live);
  TestBed.tick();
  return { live, store: TestBed.inject(CompassStore), scope: TestBed.inject(ScopeService) };
}

/** The server accepts the socket with this transcript; returns the questions the client then sent. */
function accept(entries = [] as ReturnType<typeof user>[]) {
  const socket = FakeSocket.last;
  socket.serve({ type: 'snapshot', conversation: 'x', entries, live: liveState() });
  TestBed.tick();
  return socket.sent.filter((message) => message['type'] === 'ask');
}

describe('Live: asking Kassandra', () => {
  beforeEach(() => {
    FakeSocket.reset();
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    history.replaceState(null, '', '/');
  });

  it('Explore opens the thread and sends the question at once, in the chosen mode', () => {
    const { live, store } = create();
    live.mode.set('quick');
    live.explore('Why is Lisbon pacing behind?', undefined, 'brief:pace_behind:LIS');
    expect(store.view()).toBe('thread');
    expect(live.composer().text).toBe('');
    expect(accept()).toEqual([expect.objectContaining({ type: 'ask', text: 'Why is Lisbon pacing behind?', mode: 'quick' })]);
    expect(live.conversations().map((c) => c.title)).toEqual(['Why is Lisbon pacing behind?']);
  });

  it('sends the global hotel scope with every question, and leaves it out for the whole group', () => {
    const { live, scope } = create();
    live.askNew('How is occupancy?');
    expect(accept()[0]).not.toHaveProperty('scope');
    scope.set(['LIS', 'DXB2']);
    live.askNew('And ADR?');
    expect(accept()[0]!['scope']).toEqual({ hotels: ['LIS', 'DXB2'] });
    live.send('For December only');
    expect(FakeSocket.last.sent.at(-1)).toMatchObject({ type: 'ask', text: 'For December only', scope: { hotels: ['LIS', 'DXB2'] } });
  });

  it('the same Explore item reopens its thread instead of asking again', () => {
    const { live, store } = create();
    live.explore('Why is Lisbon pacing behind?', undefined, 'brief:pace_behind:LIS');
    const id = live.chat.conversation();
    accept();
    live.askNew('Something else in between');
    store.go('inbox');

    live.explore('Why is Lisbon pacing behind?', undefined, 'brief:pace_behind:LIS');
    expect(live.chat.conversation()).toBe(id);
    expect(store.view()).toBe('thread');
    expect(live.conversations()).toHaveLength(2);
    // The transcript is on the server already: nothing is asked a second time.
    expect(accept([user(1, 'Why is Lisbon pacing behind?')])).toEqual([]);
  });

  it('asks again when the reopened thread turns out to be empty (the first question was refused)', () => {
    const { live } = create();
    live.explore('Why is Lisbon pacing behind?', undefined, 'brief:pace_behind:LIS');
    live.newChat();
    live.explore('Why is Lisbon pacing behind?', undefined, 'brief:pace_behind:LIS');
    expect(accept()).toEqual([expect.objectContaining({ text: 'Why is Lisbon pacing behind?' })]);
    expect(live.conversations()).toHaveLength(1);
  });

  it('another item, or the same item under another hotel scope, is another thread', () => {
    const { live, scope } = create();
    live.explore('Why is Lisbon pacing behind?', undefined, 'brief:pace_behind:LIS');
    live.explore('Why did New York lose its account?', undefined, 'brief:account_loss:NYC');
    scope.set(['LIS']);
    live.explore('Why is Lisbon pacing behind?', undefined, 'brief:pace_behind:LIS');
    expect(live.conversations()).toHaveLength(3);
    expect(new Set(live.conversations().map((c) => c.title)).size).toBe(3);
  });

  it('a click that stands for a question (a KPI tile) is sent at once and deduplicated by its question', () => {
    const { live } = create();
    live.askAbout('What drove the portfolio’s occupancy for the next 30 nights?');
    expect(accept()).toHaveLength(1);
    live.newChat();
    live.askAbout('What drove the portfolio’s occupancy for the next 30 nights?');
    expect(live.conversations()).toHaveLength(1);
  });

  it('typed questions always start a new thread, each with its own title', () => {
    const { live } = create();
    live.askNew('How is occupancy?');
    live.askNew('How is occupancy?');
    expect(live.conversations().map((c) => c.title)).toEqual(['How is occupancy? · 2', 'How is occupancy?']);
  });

  it('/ask?q= only fills the composer of a fresh conversation: opening a link never asks', () => {
    localStorage.setItem('compass.kassandra.conversation', 'old-conversation');
    const { live, store } = create('/ask?q=Why%20is%20Lisbon%20behind%3F');
    expect(store.view()).toBe('thread');
    expect(live.composer().text).toBe('Why is Lisbon behind?');
    expect(live.chat.conversation()).not.toBe('old-conversation');
    expect(FakeSocket.instances.flatMap((socket) => socket.sent)).toEqual([]);
    expect(live.conversations()).toEqual([]);
  });

  it('renames a thread, deletes it and brings it back', () => {
    const { live } = create();
    live.askNew('How is occupancy?');
    const id = live.chat.conversation();
    live.renameConversation(id, '  Occupancy,   group  ');
    expect(live.conversations()[0]!.title).toBe('Occupancy, group');
    live.renameConversation(id, '   ');
    expect(live.conversations()[0]!.title).toBe('Occupancy, group');

    const removed = live.deleteConversation(id)!;
    TestBed.tick();
    expect(live.conversations()).toEqual([]);
    expect(live.chat.conversation()).not.toBe(id);
    live.restoreConversation(removed);
    expect(live.conversations().map((c) => c.title)).toEqual(['Occupancy, group']);
  });

  it('moves a thread to the top when it is asked something', () => {
    const { live } = create();
    live.askNew('First question');
    const first = live.chat.conversation();
    vi.advanceTimersByTime(60_000);
    live.askNew('Second question');
    expect(live.conversations()[0]!.title).toBe('Second question');
    live.openConversation(first);
    vi.advanceTimersByTime(60_000);
    live.send('A follow-up');
    expect(live.conversations().map((c) => c.title)).toEqual(['First question', 'Second question']);
    expect(live.conversations()[0]!.at).toBeGreaterThan(live.conversations()[1]!.at);
  });
});

describe('Live: the sidebar’s titles from the server', () => {
  const META = { title: 'Group: occupancy', summary: 'Occupancy up 2 pts vs last year', kind: 'chart' as const, hotel: null, renamed: false };
  const http = () => TestBed.inject(HttpTestingController);
  /** Requests to the conversations API, answered with nothing (an empty list, 204). */
  const calls = () =>
    http()
      .match((r) => r.url.includes('/kassandra/conversations'))
      .map((r) => {
        const call = `${r.request.method} ${r.request.urlWithParams}`;
        r.flush(r.request.method === 'GET' ? {} : r.request.method === 'PATCH' ? META : null);
        return { call, body: r.request.body as unknown };
      });

  beforeEach(() => {
    FakeSocket.reset();
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    history.replaceState(null, '', '/');
  });

  it('takes the title, the takeaway and the kind the server wrote once the first answer is in', () => {
    const { live } = create();
    live.askNew('How is occupancy?');
    accept();
    FakeSocket.last.serve({ type: 'meta', meta: META });
    TestBed.tick();
    expect(live.conversations()[0]).toMatchObject({ title: 'Group: occupancy', summary: 'Occupancy up 2 pts vs last year', kind: 'chart', hotel: null, named: true });
  });

  it('keeps a title the person gave over the one the server wrote', () => {
    const { live } = create();
    live.askNew('How is occupancy?');
    accept();
    live.renameConversation(live.chat.conversation(), 'Mine');
    FakeSocket.last.serve({ type: 'meta', meta: META });
    TestBed.tick();
    expect(live.conversations()[0]).toMatchObject({ title: 'Mine', summary: 'Occupancy up 2 pts vs last year' });
  });

  it('asks the server for the titles it does not have yet, and applies them', async () => {
    localStorage.setItem('compass.conversations', JSON.stringify([{ id: 'c-old', title: 'How is pace?', at: Date.now() }, { id: 'c-done', title: 'Done', at: Date.now(), named: true }]));
    const { live } = create();
    await vi.advanceTimersByTimeAsync(1500);
    const request = http().expectOne((r) => r.url.includes('/kassandra/conversations'));
    expect(request.request.method).toBe('GET');
    expect(request.request.urlWithParams).toBe('/api/kassandra/conversations?ids=c-old');
    request.flush({ 'c-old': { ...META, title: 'Group: pace' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(live.conversations().find((c) => c.id === 'c-old')).toMatchObject({ title: 'Group: pace', named: true });
  });

  it('a rename is kept on the server', async () => {
    const { live } = create();
    live.askNew('How is occupancy?');
    const id = live.chat.conversation();
    live.renameConversation(id, 'Occupancy, group');
    await vi.advanceTimersByTimeAsync(0);
    expect(calls().filter((c) => c.call.startsWith('PATCH'))).toEqual([{ call: `PATCH /api/kassandra/conversations/${id}`, body: { title: 'Occupancy, group' } }]);
  });

  it('a delete reaches the server once the Undo window is over; Undo in time keeps it', async () => {
    const { live } = create();
    live.askNew('First');
    const first = live.chat.conversation();
    live.askNew('Second');
    const second = live.chat.conversation();

    const removed = live.deleteConversation(first)!;
    await vi.advanceTimersByTimeAsync(3000);
    live.restoreConversation(removed);
    live.deleteConversation(second);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls().filter((c) => c.call.startsWith('DELETE'))).toEqual([{ call: `DELETE /api/kassandra/conversations/${second}`, body: null }]);
  });
});

describe('threadTitle', () => {
  it('drops the scope in brackets and cuts long questions at a word', () => {
    expect(threadTitle('What is behind the Corporate segment? (All 20 hotels · next 30 nights)')).toBe('What is behind the Corporate segment?');
    const long = threadTitle('Why is the pace for the Lisbon hotel so far behind the same time last year for the month of December?');
    expect(long.length).toBeLessThanOrEqual(72);
    expect(long.endsWith('…')).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });

  it('numbers a title that is taken', () => {
    expect(threadTitle('How is occupancy?', ['How is occupancy?'])).toBe('How is occupancy? · 2');
    expect(threadTitle('How is occupancy?', ['How is occupancy?', 'How is occupancy? · 2'])).toBe('How is occupancy? · 3');
    expect(threadTitle('   ')).toBe('New conversation');
  });
});
