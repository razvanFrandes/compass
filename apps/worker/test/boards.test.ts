import { BOARD_LIMITS, type Board, type BoardWidget } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { BoardService } from '../src/application/boards/boards.ts';
import { MemoryBoardStore } from '../src/application/boards/memory-store.ts';
import { inferColumns } from '../src/application/widgets/columns.ts';

const EVIDENCE = { sources: ['hotel.pace_vs_stly()'], definitions: {}, period: null, sql: 'select 1', params: [], rowCount: 3, businessDate: '2026-11-20', notes: [] };
const ROWS = [
  { hotel_code: 'AMS', pace_pct: 3.5 },
  { hotel_code: 'BCN', pace_pct: -4.4 },
  { hotel_code: 'LIS', pace_pct: -17.4 },
];
const widget = (over: Record<string, unknown> = {}) => ({
  spec: { kind: 'bar', title: 'Lisbon is 17.4% behind last year', sourceCallId: 'toolu_1', x: 'hotel_code', y: ['pace_pct'] },
  rows: ROWS,
  columns: inferColumns(ROWS),
  evidence: EVIDENCE,
  question: 'How is pace by hotel?',
  ...over,
});

function service() {
  let tick = 0;
  let id = 0;
  // A clock that moves one second per call and ids that count, so order and timestamps can be asserted.
  const now = () => new Date(Date.UTC(2026, 10, 20, 10, 0, tick++));
  return new BoardService(new MemoryBoardStore(), now, () => `id${++id}`);
}

async function boardWith(boards: BoardService, count: number): Promise<{ board: Board; widgets: BoardWidget[] }> {
  const created = await boards.create({ name: 'Pace' });
  if (!created.ok) throw new Error('create failed');
  const widgets: BoardWidget[] = [];
  for (let i = 0; i < count; i++) {
    const added = await boards.addWidget(created.value.id, widget({ spec: { ...widget().spec, title: `Widget ${i + 1}` } }));
    if (!added.ok) throw new Error(added.error.message);
    widgets.push(added.value);
  }
  return { board: created.value, widgets };
}

describe('boards: create, read, change, delete', () => {
  it('creates a board with defaults and reads it back', async () => {
    const boards = service();
    const created = await boards.create({ name: '  Lisbon pace  ' });
    expect(created).toEqual({
      ok: true,
      value: { id: 'b-id1', name: 'Lisbon pace', description: '', hotels: [], widgets: [], createdAt: '2026-11-20T10:00:00.000Z', updatedAt: '2026-11-20T10:00:00.000Z' },
    });
    expect(await boards.get('b-id1')).toEqual(created);
  });

  it('keeps the description and the hotels it is given', async () => {
    const created = await service().create({ name: 'Lisbon', description: 'Pace and rates', hotels: ['LIS'] });
    expect(created).toMatchObject({ ok: true, value: { description: 'Pace and rates', hotels: ['LIS'] } });
  });

  it.each([
    ['no name', {}, 'name'],
    ['an empty name', { name: '   ' }, 'name'],
    ['a name that is too long', { name: 'x'.repeat(81) }, 'name'],
    ['a hotel that is not a code', { name: 'A', hotels: ['<script>'] }, 'hotels'],
    ['a field boards do not have', { name: 'A', owner: 'me' }, 'owner'],
    ['a body that is not an object', 'Lisbon', 'object'],
  ])('refuses %s', async (_name, input, named) => {
    const created = await service().create(input);
    expect(created).toEqual({ ok: false, error: { kind: 'invalid', message: expect.stringContaining(named) } });
  });

  it('lists boards oldest first, with widget specs and no rows', async () => {
    const boards = service();
    const { board, widgets } = await boardWith(boards, 1);
    await boards.create({ name: 'Second' });
    const list = await boards.list();
    expect(list.map((b) => b.name)).toEqual(['Pace', 'Second']);
    expect(list[0]!.id).toBe(board.id);
    expect(list[0]!.widgets).toEqual([{ id: widgets[0]!.id, spec: widgets[0]!.spec, question: 'How is pace by hotel?', addedAt: widgets[0]!.addedAt }]);
    expect(JSON.stringify(list)).not.toContain('"rows"');
  });

  it('renames a board and moves its updatedAt', async () => {
    const boards = service();
    const { board } = await boardWith(boards, 0);
    const updated = await boards.update(board.id, { name: 'Pace watch', description: 'Next 45 nights', hotels: ['LIS', 'AMS'] });
    expect(updated).toMatchObject({ ok: true, value: { name: 'Pace watch', description: 'Next 45 nights', hotels: ['LIS', 'AMS'], createdAt: board.createdAt } });
    expect(updated.ok && updated.value.updatedAt > board.updatedAt).toBe(true);
  });

  it('refuses an invalid change and leaves the board alone', async () => {
    const boards = service();
    const { board } = await boardWith(boards, 0);
    expect(await boards.update(board.id, { name: '' })).toMatchObject({ ok: false, error: { kind: 'invalid' } });
    expect(await boards.get(board.id)).toMatchObject({ ok: true, value: { name: 'Pace', updatedAt: board.updatedAt } });
  });

  it('deletes a board with its widgets', async () => {
    const boards = service();
    const { board } = await boardWith(boards, 2);
    expect(await boards.remove(board.id)).toEqual({ ok: true, value: null });
    expect(await boards.get(board.id)).toMatchObject({ ok: false, error: { kind: 'not_found' } });
    expect(await boards.list()).toEqual([]);
  });

  it('answers not_found for a board that is not there', async () => {
    const boards = service();
    const missing = { ok: false, error: { kind: 'not_found', message: 'No board has this id.' } };
    expect(await boards.get('nope')).toEqual(missing);
    expect(await boards.update('nope', { name: 'A' })).toEqual(missing);
    expect(await boards.remove('nope')).toEqual(missing);
    expect(await boards.addWidget('nope', widget())).toEqual(missing);
    expect(await boards.removeWidget('nope', 'w-1')).toEqual(missing);
  });

  it(`keeps at most ${BOARD_LIMITS.boards} boards`, async () => {
    const boards = service();
    for (let i = 0; i < BOARD_LIMITS.boards; i++) expect((await boards.create({ name: `Board ${i}` })).ok).toBe(true);
    expect(await boards.create({ name: 'One too many' })).toEqual({
      ok: false,
      error: { kind: 'limit', message: 'The demo keeps at most 50 boards. Delete one and try again.' },
    });
  });
});

describe('boards: widgets', () => {
  it('adds a widget with its rows, columns and evidence, and shows it on the board', async () => {
    const boards = service();
    const { board, widgets } = await boardWith(boards, 1);
    expect(widgets[0]).toEqual({
      id: 'w-id2',
      spec: { kind: 'bar', title: 'Widget 1', sourceCallId: 'toolu_1', x: 'hotel_code', y: ['pace_pct'], format: 'percent' },
      rows: ROWS,
      columns: inferColumns(ROWS),
      evidence: EVIDENCE,
      question: 'How is pace by hotel?',
      addedAt: '2026-11-20T10:00:01.000Z',
    });
    const read = await boards.get(board.id);
    expect(read).toMatchObject({ ok: true, value: { widgets: [widgets[0]], updatedAt: '2026-11-20T10:00:01.000Z' } });
  });

  it('keeps evidence fields it does not know yet', async () => {
    const boards = service();
    const { board } = await boardWith(boards, 0);
    const added = await boards.addWidget(board.id, widget({ evidence: { ...EVIDENCE, title: 'Pace vs last year', columns: inferColumns(ROWS) } }));
    expect(added).toMatchObject({ ok: true, value: { evidence: { title: 'Pace vs last year' } } });
  });

  it.each([
    ['no rows', { rows: [] }, 'rows'],
    ['more than 200 rows', { rows: Array.from({ length: 201 }, (_, i) => ({ hotel_code: `H${i}`, pace_pct: i })) }, 'rows'],
    ['no spec', { spec: undefined }, 'spec'],
    ['a kind that does not exist', { spec: { ...widget().spec, kind: 'hologram' } }, 'kind'],
    ['no evidence', { evidence: undefined }, 'evidence'],
    ['columns that are not columns', { columns: [{ key: 'hotel_code' }] }, 'columns'],
  ])('refuses a widget with %s', async (_name, over, named) => {
    const boards = service();
    const { board } = await boardWith(boards, 0);
    const added = await boards.addWidget(board.id, widget(over));
    expect(added).toEqual({ ok: false, error: { kind: 'invalid', message: expect.stringContaining(named) } });
    expect(await boards.get(board.id)).toMatchObject({ ok: true, value: { widgets: [] } });
  });

  it('refuses a widget whose kind does not fit its rows, like show_widget does', async () => {
    const boards = service();
    const { board } = await boardWith(boards, 0);
    const added = await boards.addWidget(board.id, widget({ spec: { ...widget().spec, kind: 'line' } }));
    expect(added).toMatchObject({ ok: false, error: { kind: 'invalid', message: expect.stringMatching(/ordered x/) } });
    const unknown = await boards.addWidget(board.id, widget({ spec: { ...widget().spec, y: ['revpar'] } }));
    expect(unknown).toMatchObject({ ok: false, error: { kind: 'invalid', message: expect.stringContaining('"revpar"') } });
  });

  it(`keeps at most ${BOARD_LIMITS.widgetsPerBoard} widgets on a board`, async () => {
    const boards = service();
    const { board } = await boardWith(boards, BOARD_LIMITS.widgetsPerBoard);
    expect(await boards.addWidget(board.id, widget())).toEqual({
      ok: false,
      error: { kind: 'limit', message: 'A board holds at most 24 widgets. Remove one and try again.' },
    });
  });

  it('removes a widget, and answers not_found for one that is not there', async () => {
    const boards = service();
    const { board, widgets } = await boardWith(boards, 2);
    expect(await boards.removeWidget(board.id, widgets[0]!.id)).toEqual({ ok: true, value: null });
    expect(await boards.get(board.id)).toMatchObject({ ok: true, value: { widgets: [{ id: widgets[1]!.id }] } });
    expect(await boards.removeWidget(board.id, widgets[0]!.id)).toEqual({ ok: false, error: { kind: 'not_found', message: 'This board has no widget with this id.' } });
  });

  it('reorders the widgets', async () => {
    const boards = service();
    const { board, widgets } = await boardWith(boards, 3);
    const [a, b, c] = widgets.map((w) => w.id) as [string, string, string];
    const updated = await boards.update(board.id, { order: [c, a, b] });
    expect(updated.ok && updated.value.widgets.map((w) => w.id)).toEqual([c, a, b]);
    expect((await boards.list())[0]!.widgets.map((w) => w.id)).toEqual([c, a, b]);
  });

  it.each([
    ['misses a widget', (ids: string[]) => ids.slice(1)],
    ['names a widget twice', (ids: string[]) => [ids[0]!, ids[0]!, ids[1]!]],
    ['names a widget of another board', (ids: string[]) => [...ids.slice(1), 'w-other']],
  ])('refuses an order that %s', async (_name, order) => {
    const boards = service();
    const { board, widgets } = await boardWith(boards, 3);
    const ids = widgets.map((w) => w.id);
    expect(await boards.update(board.id, { order: order(ids) })).toEqual({
      ok: false,
      error: { kind: 'invalid', message: 'order: list every widget id of the board exactly once.' },
    });
    expect((await boards.list())[0]!.widgets.map((w) => w.id)).toEqual(ids);
  });
});

describe('boards: seeding', () => {
  it('stores whole boards as given, in order, and lists them first', async () => {
    const boards = service();
    const { widgets } = await boardWith(boards, 1);
    const seed: Board = { id: 'portfolio', name: 'Portfolio overview', description: 'All hotels', hotels: [], widgets: [{ ...widgets[0]!, id: 'w-seed' }], createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' };
    await boards.seed([seed]);
    expect((await boards.list()).map((b) => b.id)).toEqual(['portfolio', 'b-id1']);
    expect(await boards.get('portfolio')).toEqual({ ok: true, value: seed });
  });
});
