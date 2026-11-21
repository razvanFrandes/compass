import { TestBed } from '@angular/core/testing';
import type { BoardWidget } from '../api';
import { SOCKET_FACTORY } from '../api';
import { FakeSocket, answer, live, result, steps, user } from '../api/testing';
import { ScopeService } from '../scope/scope.service';
import { KassandraDescribeView } from './kassandra-describe-view';
import { evidence, widget } from './testing';

const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  TestBed.tick();
};

/** The boards endpoint (BoardsService talks to it with fetch): records every call and answers like the server. */
function boardsServer() {
  const calls: { method: string; path: string; body: unknown }[] = [];
  let next = 1;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET';
    const path = String(input);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
    if (method === 'GET') return json([]);
    if (method === 'POST') return json(saved(`w${next++}`, (body as { spec: { title: string } }).spec.title));
    return new Response(null, { status: 204 });
  });
  return { calls, writes: () => calls.filter((call) => call.method !== 'GET') };
}

function render() {
  FakeSocket.reset();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: SOCKET_FACTORY, useValue: (url: string) => new FakeSocket(url) }] });
  const http = boardsServer();
  const fixture = TestBed.createComponent(KassandraDescribeView);
  fixture.componentRef.setInput('boardId', 'b1');
  fixture.componentRef.setInput('boardName', 'Revenue');
  fixture.detectChanges();
  const added: BoardWidget[][] = [];
  const removed: string[][] = [];
  fixture.componentInstance.added.subscribe((widgets) => added.push(widgets));
  fixture.componentInstance.removed.subscribe((ids) => removed.push(ids));
  const describe = (text: string) => (fixture.componentInstance as unknown as { describe(text: string): void }).describe(text);
  return { fixture, http, added, removed, describe };
}
const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const saved = (id: string, title: string): BoardWidget => ({ id, spec: { kind: 'bar', title, sourceCallId: 'c1' }, rows: [], columns: [], evidence: evidence(), addedAt: '2026-11-20T22:00:00Z' });

describe('KassandraDescribeView', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the description as a board view, for the hotel scope, on a conversation of its own', () => {
    const { describe } = render();
    TestBed.inject(ScopeService).set(['LIS']);
    describe('channel profitability after commission');
    const socket = FakeSocket.last;
    expect(socket.url).toMatch(/\/api\/kassandra\/ws\?conversation=board-view-[a-z0-9]{12}$/);
    socket.serve({ type: 'snapshot', conversation: 'x', entries: [], live: live() });
    expect(socket.sent).toEqual([expect.objectContaining({ type: 'ask', text: 'Build a board view: channel profitability after commission', mode: 'thinker', scope: { hotels: ['LIS'] } })]);
  });

  it('adds the widgets Kassandra answers with to the board, says so, and takes them back on Undo', async () => {
    const { fixture, http, added, removed, describe } = render();
    describe('channel profitability');
    const socket = FakeSocket.last;
    socket.serve({ type: 'snapshot', conversation: 'x', entries: [], live: live({ running: true }) });
    socket.serve({
      type: 'entries',
      entries: [
        user(1, 'Build a board view: channel profitability'),
        steps(2, [{ callId: 'c1', name: 'get_channel_mix' }, { callId: 'c2', name: 'show_widget' }]),
        result(3, 'c1', { rows: [{ channel: 'Direct', net: 100 }], evidence: evidence() }),
        { ...result(4, 'c2', { name: 'show_widget' }), widget: widget({ title: 'Direct is the most profitable channel' }) },
      ],
    });
    await flush();
    // Nothing is saved while she is still working.
    expect(http.writes()).toEqual([]);

    socket.serve({ type: 'entries', entries: [answer(5, 'Added a view of channel profitability.')] });
    socket.serve({ type: 'live', live: live() });
    await flush();
    expect(http.writes()).toEqual([{ method: 'POST', path: '/api/boards/b1/widgets', body: expect.objectContaining({ spec: expect.objectContaining({ kind: 'bar', title: 'Direct is the most profitable channel', sourceCallId: 'c1' }), rows: widget().rows, question: 'channel profitability' }) }]);
    fixture.detectChanges();

    const receipt = (fixture.nativeElement as HTMLElement).querySelector('section[aria-label="Charts Kassandra added"]')!;
    expect(text(receipt.querySelector('[role=status] p'))).toBe('Kassandra added 1 chart to Revenue');
    expect(text(receipt.querySelector('[role=status] li'))).toBe('Direct is the most profitable channel');
    expect(added).toEqual([[saved('w1', 'Direct is the most profitable channel')]]);

    receipt.querySelector('button')!.click();
    await flush();
    expect(http.writes().at(-1)).toMatchObject({ method: 'DELETE', path: '/api/boards/b1/widgets/w1' });
    fixture.detectChanges();
    expect(removed).toEqual([['w1']]);
    expect((fixture.nativeElement as HTMLElement).querySelector('section[aria-label="Charts Kassandra added"]')).toBeNull();
  });

  it('saves nothing when the answer has no widget, and shows the answer', async () => {
    const { fixture, http, added, describe } = render();
    describe('something vague');
    const socket = FakeSocket.last;
    socket.serve({ type: 'snapshot', conversation: 'x', entries: [user(1, 'Build a board view: something vague'), answer(2, 'Which metric should it show?')], live: live() });
    await flush();
    fixture.detectChanges();
    expect(http.writes()).toEqual([]);
    expect(added).toEqual([]);
    expect(text((fixture.nativeElement as HTMLElement).querySelector('app-markdown'))).toBe('Which metric should it show?');
  });
});
