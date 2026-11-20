import type { Board, BoardSummary, BoardWidget } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { BoardService } from '../src/application/boards/boards.ts';
import { MemoryBoardStore } from '../src/application/boards/memory-store.ts';
import { inferColumns } from '../src/application/widgets/columns.ts';
import { boardRoutes, isBoardsPath, MAX_WIDGET_BYTES } from '../src/presentation/http/board-routes.ts';

// The boards API over the real service on a memory store: status codes, body limits, and the order of the guards.
const HOST = 'https://juyo.razvanfrandes.com';
const ROWS = [
  { hotel_code: 'AMS', pace_pct: 3.5 },
  { hotel_code: 'LIS', pace_pct: -17.4 },
];
const WIDGET = {
  spec: { kind: 'bar', title: 'Lisbon is 17.4% behind last year', sourceCallId: 'toolu_1', x: 'hotel_code', y: ['pace_pct'] },
  rows: ROWS,
  columns: inferColumns(ROWS),
  evidence: { sources: ['hotel.pace_vs_stly()'], definitions: {}, period: null, sql: 'select 1', params: [], rowCount: 2, businessDate: '2026-11-20', notes: [] },
};

function api(guards: { rateLimited?: boolean; overBudget?: boolean } = {}) {
  const calls: string[] = [];
  const refusal = (name: string, refuse: boolean | undefined) => async () => {
    calls.push(name);
    return refuse ? Response.json({ error: `${name} says no` }, { status: 429 }) : null;
  };
  const boards = new BoardService(new MemoryBoardStore());
  const deps = { boards, rateLimited: refusal('rate', guards.rateLimited), overBudget: refusal('budget', guards.overBudget) };
  const send = (method: string, path: string, body?: unknown) => {
    const url = new URL(HOST + path);
    const init = body === undefined ? { method } : { method, body: typeof body === 'string' ? body : JSON.stringify(body) };
    return boardRoutes(new Request(url, init), url, deps);
  };
  return { send, calls, boards };
}

async function seeded() {
  const context = api();
  const board = (await (await context.send('POST', '/api/boards', { name: 'Pace' })).json()) as Board;
  context.calls.length = 0;
  return { ...context, board };
}

describe('isBoardsPath', () => {
  it.each([
    ['/api/boards', true],
    ['/api/boards/b-1', true],
    ['/api/boards/b-1/widgets/w-1', true],
    ['/api/boardsx', false],
    ['/api/brief', false],
  ])('%s → %s', (path, expected) => expect(isBoardsPath(path)).toBe(expected));
});

describe('boards API', () => {
  it('creates, lists, reads, changes and deletes a board', async () => {
    const { send } = api();
    const created = await send('POST', '/api/boards', { name: 'Lisbon pace', hotels: ['LIS'] });
    expect(created.status).toBe(201);
    const board = (await created.json()) as Board;
    expect(board).toMatchObject({ name: 'Lisbon pace', hotels: ['LIS'], widgets: [] });

    const list = (await (await send('GET', '/api/boards')).json()) as BoardSummary[];
    expect(list.map((b) => b.id)).toEqual([board.id]);

    const read = await send('GET', `/api/boards/${board.id}`);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual(board);

    const patched = await send('PATCH', `/api/boards/${board.id}`, { name: 'Lisbon' });
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ id: board.id, name: 'Lisbon' });

    const deleted = await send('DELETE', `/api/boards/${board.id}`);
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe('');
    expect((await send('GET', `/api/boards/${board.id}`)).status).toBe(404);
  });

  it('adds a widget to a board and removes it', async () => {
    const { send, board } = await seeded();
    const added = await send('POST', `/api/boards/${board.id}/widgets`, { ...WIDGET, question: 'How is pace?' });
    expect(added.status).toBe(201);
    const widget = (await added.json()) as BoardWidget;
    expect(widget).toMatchObject({ spec: { kind: 'bar', format: 'percent' }, rows: ROWS, question: 'How is pace?' });

    const read = (await (await send('GET', `/api/boards/${board.id}`)).json()) as Board;
    expect(read.widgets).toEqual([widget]);

    expect((await send('DELETE', `/api/boards/${board.id}/widgets/${widget.id}`)).status).toBe(204);
    expect((await send('DELETE', `/api/boards/${board.id}/widgets/${widget.id}`)).status).toBe(404);
  });

  it('answers 400 with the reason for an invalid body, and 404 for a board that is not there', async () => {
    const { send, board } = await seeded();
    const invalid = await send('POST', '/api/boards', { name: '' });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: string }).error).toContain('name');
    expect((await send('POST', '/api/boards', '{nope')).status).toBe(400);
    expect((await send('POST', '/api/boards', '[1]')).status).toBe(400);
    expect((await send('PATCH', `/api/boards/${board.id}`, { order: ['w-x'] })).status).toBe(400);
    expect((await send('POST', `/api/boards/${board.id}/widgets`, { ...WIDGET, spec: { ...WIDGET.spec, kind: 'pie' } })).status).toBe(400);
    expect((await send('PATCH', '/api/boards/nope', { name: 'A' })).status).toBe(404);
    expect((await send('POST', '/api/boards/nope/widgets', WIDGET)).status).toBe(404);
  });

  it('answers 409 at a limit', async () => {
    const { send, board } = await seeded();
    for (let i = 0; i < 24; i++) expect((await send('POST', `/api/boards/${board.id}/widgets`, WIDGET)).status).toBe(201);
    const full = await send('POST', `/api/boards/${board.id}/widgets`, WIDGET);
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: 'A board holds at most 24 widgets. Remove one and try again.' });
  });

  it('answers 404 for paths and methods it does not have, and for ids that could not be ids', async () => {
    const { send, board } = await seeded();
    expect((await send('PUT', `/api/boards/${board.id}`, {})).status).toBe(404);
    expect((await send('DELETE', '/api/boards')).status).toBe(404);
    expect((await send('GET', `/api/boards/${board.id}/widgets`)).status).toBe(404);
    expect((await send('GET', `/api/boards/${board.id}/widgets/w-1/rows`)).status).toBe(404);
    expect((await send('GET', `/api/boards/${'x'.repeat(65)}`)).status).toBe(404);
    expect((await send('GET', '/api/boards/a%20b')).status).toBe(404);
  });
});

describe('boards API: limits on writes', () => {
  it('takes a board body of at most 16 KB and a widget of at most 256 KB', async () => {
    const { send, board } = await seeded();
    expect((await send('POST', '/api/boards', { name: 'A', description: 'x'.repeat(17_000) })).status).toBe(413);

    const wide = (bytes: number) => ({ ...WIDGET, rows: ROWS.map((row) => ({ ...row, note: 'x'.repeat(bytes / 2) })) });
    expect((await send('POST', `/api/boards/${board.id}/widgets`, wide(100_000))).status).toBe(201);
    const tooBig = await send('POST', `/api/boards/${board.id}/widgets`, wide(MAX_WIDGET_BYTES));
    expect(tooBig.status).toBe(413);
    expect(await tooBig.json()).toEqual({ error: 'The request body is larger than 256 KB.' });
  });

  it('checks the rate limit, then the body, then the budget, and only then writes', async () => {
    const { send, calls, board } = await seeded();
    expect((await send('POST', '/api/boards', { name: 'Second' })).status).toBe(201);
    expect(calls).toEqual(['rate', 'budget']);

    // An invalid body is refused before it can spend the day's budget.
    calls.length = 0;
    expect((await send('POST', '/api/boards', { name: '' })).status).toBe(400);
    expect((await send('POST', `/api/boards/${board.id}/widgets`, { ...WIDGET, rows: [] })).status).toBe(400);
    expect((await send('PATCH', `/api/boards/${board.id}`, { name: '' })).status).toBe(400);
    expect(calls).toEqual(['rate', 'rate', 'rate']);
  });

  it('writes nothing when the client is rate-limited', async () => {
    const { send, calls, boards } = api({ rateLimited: true });
    const response = await send('POST', '/api/boards', { name: 'Pace' });
    expect(response.status).toBe(429);
    expect(calls).toEqual(['rate']);
    expect(await boards.list()).toEqual([]);
  });

  it('writes nothing when the daily budget is used up', async () => {
    const { send, boards } = api({ overBudget: true });
    for (const [method, path, body] of [
      ['POST', '/api/boards', { name: 'Pace' }],
      ['PATCH', '/api/boards/b-1', { name: 'Pace' }],
      ['DELETE', '/api/boards/b-1', undefined],
      ['POST', '/api/boards/b-1/widgets', WIDGET],
      ['DELETE', '/api/boards/b-1/widgets/w-1', undefined],
    ] as const) {
      expect((await send(method, path, body)).status).toBe(429);
    }
    expect(await boards.list()).toEqual([]);
  });

  it('does not limit reads', async () => {
    const { send, calls } = api({ rateLimited: true, overBudget: true });
    expect((await send('GET', '/api/boards')).status).toBe(200);
    expect((await send('GET', '/api/boards/nope')).status).toBe(404);
    expect(calls).toEqual([]);
  });
});
