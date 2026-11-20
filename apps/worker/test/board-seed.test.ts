import type { Board, Evidence } from '@compass/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BoardService } from '../src/application/boards/boards.ts';
import { MemoryBoardStore } from '../src/application/boards/memory-store.ts';
import { buildSeedBoards, SEED_BOARDS, type RunDataTool } from '../src/application/boards/seed.ts';
import { HotelData } from '../src/application/hotel-data.ts';
import { err, ok, type Result } from '../src/domain/result.ts';
import { openPostgres } from '../src/infrastructure/postgres.ts';
import { catalogRunner } from '../src/presentation/tools/run-catalog-tool.ts';

// The sample boards, built from the local Halcyon database through the real catalog tools.
process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);
const db = openPostgres(process.env['DATABASE_URL']!);
const data = new HotelData(db);
afterAll(() => db.close());

const NOW = new Date('2026-11-20T06:00:00.000Z');
const planned = SEED_BOARDS.reduce((count, board) => count + board.widgets.length, 0);

describe('sample boards', () => {
  // Built once for both tests: thirteen real queries are enough load on a database other tests are timing.
  let built: Result<Board[], string>;
  beforeAll(async () => {
    built = await buildSeedBoards(catalogRunner(data), await data.businessDate(), NOW);
  });

  it('builds every planned widget from real rows, and each fits its kind', async () => {
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const boards = built.value;

    expect(boards.map((b) => b.id)).toEqual(['portfolio', 'dubai-business-bay', 'amsterdam-web']);
    expect(boards[0]).toMatchObject({ name: 'Portfolio overview', hotels: [] });
    expect(boards[1]!.hotels).toEqual(['DXB2']);
    // Nothing was dropped: a widget whose tool failed or whose rows did not fit would be missing.
    expect(boards.flatMap((b) => b.widgets)).toHaveLength(planned);
    expect(planned).toBeGreaterThanOrEqual(10);

    for (const widget of boards.flatMap((b) => b.widgets)) {
      expect(widget.rows.length).toBeGreaterThan(0);
      expect(widget.rows.length).toBeLessThanOrEqual(200);
      expect(widget.columns.length).toBeGreaterThan(0);
      expect(widget.evidence.sql).toBeTruthy();
      expect(widget.evidence.businessDate).toBe('2026-11-20');
      expect(widget.spec.sourceCallId).toMatch(/^seed:/);
      expect(widget.question).toBeTruthy();
      // Every column the spec names is in the rows.
      for (const key of [widget.spec.x, ...(widget.spec.y ?? []), widget.spec.group, widget.spec.compare]) {
        if (key) expect(widget.rows[0]).toHaveProperty(key);
      }
    }
    // The boards show several kinds, not one chart repeated.
    expect(new Set(boards.flatMap((b) => b.widgets.map((w) => w.spec.kind))).size).toBeGreaterThanOrEqual(6);
  });

  it('can be stored and read back as boards', async () => {
    if (!built.ok) throw new Error(built.error);
    const boards = new BoardService(new MemoryBoardStore());
    await boards.seed(built.value);
    const list = await boards.list();
    expect(list.map((b) => b.name)).toEqual(['Portfolio overview', 'Dubai Business Bay', 'Amsterdam website']);
    expect(await boards.get('portfolio')).toEqual({ ok: true, value: built.value[0] });
  });
});

describe('sample boards when the data source is unwell', () => {
  const evidence: Evidence = { sources: [], definitions: {}, period: null, sql: 'select 1', params: [], rowCount: 1, businessDate: '2026-11-20', notes: [] };

  it('fails as a whole when no tool answers, so seeding is tried again later', async () => {
    const down: RunDataTool = async () => err('The data source failed to answer.');
    expect(await buildSeedBoards(down, '2026-11-20', NOW)).toEqual({ ok: false, error: 'No sample widget could be built: The data source failed to answer.' });
  });

  it('leaves out a widget whose tool fails or whose rows do not fit, and keeps the rest', async () => {
    const onlyPace: RunDataTool = async (name) =>
      name === 'get_pace' ? ok({ rows: [{ hotel_code: 'DXB2', pace_pct: 4.2 }, { hotel_code: 'LIS', pace_pct: -17.4 }], evidence }) : err('down');
    const built = await buildSeedBoards(onlyPace, '2026-11-20', NOW);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    // The portfolio bar chart fits two rows; Dubai's KPI needs one row and is left out. A board left empty is not created.
    expect(built.value.map((b) => b.id)).toEqual(['portfolio']);
    expect(built.value[0]!.widgets.map((w) => w.spec.kind)).toEqual(['bar']);
  });
});
