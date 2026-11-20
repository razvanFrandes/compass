import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { BoardWidget } from '../api';
import { SOCKET_FACTORY } from '../api';
import { FakeSocket, answer, live, result, steps, user } from '../api/testing';
import { ScopeService } from '../scope/scope.service';
import { KassandraDescribeView } from './kassandra-describe-view';
import { evidence, widget } from './testing';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  TestBed.tick();
};

function render() {
  FakeSocket.reset();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SOCKET_FACTORY, useValue: (url: string) => new FakeSocket(url) }] });
  const fixture = TestBed.createComponent(KassandraDescribeView);
  fixture.componentRef.setInput('boardId', 'b1');
  fixture.componentRef.setInput('boardName', 'Revenue');
  fixture.detectChanges();
  const added: BoardWidget[][] = [];
  const removed: string[][] = [];
  fixture.componentInstance.added.subscribe((widgets) => added.push(widgets));
  fixture.componentInstance.removed.subscribe((ids) => removed.push(ids));
  const describe = (text: string) => (fixture.componentInstance as unknown as { describe(text: string): void }).describe(text);
  return { fixture, http: TestBed.inject(HttpTestingController), added, removed, describe };
}
const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const saved = (id: string, title: string): BoardWidget => ({ id, spec: { kind: 'bar', title, sourceCallId: 'c1' }, rows: [], columns: [], evidence: evidence(), addedAt: '2026-11-20T22:00:00Z' });

describe('KassandraDescribeView', () => {
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
    http.expectNone('/api/boards/b1/widgets');

    socket.serve({ type: 'entries', entries: [answer(5, 'Added a view of channel profitability.')] });
    socket.serve({ type: 'live', live: live() });
    await flush();
    const post = http.expectOne('/api/boards/b1/widgets');
    expect(post.request.body).toMatchObject({ spec: { kind: 'bar', title: 'Direct is the most profitable channel', sourceCallId: 'c1' }, rows: widget().rows, question: 'channel profitability' });
    post.flush(saved('w1', 'Direct is the most profitable channel'));
    await flush();
    fixture.detectChanges();

    const receipt = (fixture.nativeElement as HTMLElement).querySelector('section[aria-label="Views Kassandra added"]')!;
    expect(text(receipt.querySelector('[role=status] p'))).toBe('Kassandra added 1 view to Revenue');
    expect(text(receipt.querySelector('[role=status] li'))).toBe('Direct is the most profitable channel');
    expect(added).toEqual([[saved('w1', 'Direct is the most profitable channel')]]);

    receipt.querySelector('button')!.click();
    await flush();
    const undo = http.expectOne('/api/boards/b1/widgets/w1');
    expect(undo.request.method).toBe('DELETE');
    undo.flush(null);
    await flush();
    fixture.detectChanges();
    expect(removed).toEqual([['w1']]);
    expect((fixture.nativeElement as HTMLElement).querySelector('section[aria-label="Views Kassandra added"]')).toBeNull();
    http.verify();
  });

  it('saves nothing when the answer has no widget, and shows the answer', async () => {
    const { fixture, http, added, describe } = render();
    describe('something vague');
    const socket = FakeSocket.last;
    socket.serve({ type: 'snapshot', conversation: 'x', entries: [user(1, 'Build a board view: something vague'), answer(2, 'Which metric should it show?')], live: live() });
    await flush();
    fixture.detectChanges();
    http.expectNone('/api/boards/b1/widgets');
    expect(added).toEqual([]);
    expect(text((fixture.nativeElement as HTMLElement).querySelector('app-markdown'))).toBe('Which metric should it show?');
  });
});
