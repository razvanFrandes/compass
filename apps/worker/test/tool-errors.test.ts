import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { budgetedEmbedder } from '../src/application/budgeted-embedder.ts';
import { HotelData } from '../src/application/hotel-data.ts';
import type { Db, Embedder } from '../src/application/ports.ts';
import { DEFAULT_DAILY_LIMITS, emptyBudget, spend } from '../src/domain/budget.ts';
import { DATA_TOOLS, success, type DataTool } from '../src/presentation/tools/catalog.ts';
import { runTool, TOOL_FAILURE } from '../src/presentation/tools/run-tool.ts';

// What a tool tells the model (or any MCP client) when the database or the embedder fails: never hosts, ports,
// account ids or provider URLs. Only run_readonly_query shows database error text, so the model can fix its SQL.

const SEMANTIC_UNAVAILABLE = 'Semantic search is unavailable right now. Use search_reviews with a phrase.';
const DB_ERROR = 'write CONNECTION_CLOSED db.internal:5432';

/** Every query fails, as when the connection is lost. */
const deadDb: Db = { query: async () => Promise.reject(new Error(DB_ERROR)) };
/** The business date answers, every other query fails: the failure then happens inside the tool's own query. */
const failingDb = (error: Error = new Error(DB_ERROR)): Db => ({
  query: async <Row>(sql: string) => {
    if (/business_date\(\), 'YYYY-MM-DD'\) as d$/.test(sql)) return [{ d: '2026-11-20' }] as Row[];
    throw error;
  },
});
/** An error as postgres.js raises it for a failing statement: it carries Postgres's SQLSTATE. */
const sqlError = (message: string, code: string) => Object.assign(new Error(message), { code });
const embedder = (embed: Embedder['embed'] = async (texts) => texts.map(() => [0.6, 0.8])): Embedder => ({ model: 'm', dimensions: 2, embed });

// A future period, so get_forecast accepts it too.
const ARGS: Record<string, unknown> = { from: '2026-12-01', to: '2026-12-31', metric: 'occupancy', text: 'noise', question: 'noise' };
const BY: Record<string, string> = { get_mix: 'segment', get_web_funnel: 'device' };
const call = (name: string, data: HotelData, extra: Record<string, unknown> = {}) => {
  const tool = (DATA_TOOLS as readonly DataTool[]).find((t) => t.name === name)!;
  const by = BY[name] ? { by: BY[name] } : {};
  return runTool(tool, data, tool.input.parse({ ...ARGS, ...by, ...extra }));
};

let log: MockInstance<typeof console.error>;
beforeEach(() => {
  log = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => log.mockRestore());

describe('a database failure', () => {
  // list_metrics reads no database; run_readonly_query is the one tool that may show database errors.
  const tools = DATA_TOOLS.map((t) => t.name).filter((name) => name !== 'list_metrics' && name !== 'run_readonly_query');

  it.each(tools)('%s hides it behind the generic failure and logs it', async (name) => {
    for (const db of [deadDb, failingDb()]) {
      log.mockClear();
      const outcome = await call(name, new HotelData(db, embedder()));
      expect(outcome).toEqual({ ok: false, text: TOOL_FAILURE });
      expect(outcome.text).not.toContain('db.internal');
      expect(log).toHaveBeenCalledWith(`tool ${name} failed`, expect.objectContaining({ message: DB_ERROR }));
    }
  });

  it.each([
    ['a missing column', 'column "nope" does not exist', '42703'],
    ['a statement timeout', 'canceling statement due to statement timeout', '57014'],
    ['a division by zero', 'division by zero', '22012'],
    ['a write in a read-only transaction', 'cannot execute DELETE in a read-only transaction', '25006'],
  ])('run_readonly_query still shows a SQL error (%s), with the hint to fix the query', async (_what, message, code) => {
    const outcome = await call('run_readonly_query', new HotelData(failingDb(sqlError(message, code))), { sql: 'select nope from hotels' });
    expect(outcome).toEqual({ ok: false, text: `${message} Fix the query and try again; call get_schema for table and column names.` });
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    ['a lost connection', new Error(DB_ERROR)],
    ['a driver error code', sqlError(DB_ERROR, 'CONNECTION_CLOSED')],
    ['a refused connection', sqlError('connect ECONNREFUSED db.internal:5432', 'ECONNREFUSED')],
    ['a connection exception from the server', sqlError('connection to db.internal failed', '08006')],
    ['a refused login', sqlError('no pg_hba.conf entry for host "db.internal", user "compass_ro", database "compass"', '28000')],
    ['a wrong password', sqlError('password authentication failed for user "compass_ro" at db.internal', '28P01')],
    ['a missing database', sqlError('database "compass" does not exist on db.internal', '3D000')],
    ['too many connections', sqlError('too many connections for role "compass_ro" on db.internal', '53300')],
    ['a server shutting down', sqlError('terminating connection due to administrator command (db.internal)', '57P01')],
    ['a server starting up', sqlError('the database system is starting up (db.internal)', '57P03')],
  ])('run_readonly_query hides an error that is not a SQL error (%s)', async (_what, error) => {
    const outcome = await call('run_readonly_query', new HotelData(failingDb(error)), { sql: 'select 1' });
    expect(outcome).toEqual({ ok: false, text: TOOL_FAILURE });
    expect(outcome.text).not.toContain('db.internal');
    expect(log).toHaveBeenCalledWith('tool run_readonly_query failed', error);
  });
});

describe('find_reviews without a working embedder', () => {
  const okDb: Db = { query: async <Row>() => [{ d: '2026-11-20' }] as Row[] };

  it('says semantic search is unavailable and keeps the provider error in the logs', async () => {
    const down = embedder(async () => Promise.reject(new Error('502 from https://api.cloudflare.com/accounts/abc123/ai/run')));
    const outcome = await call('find_reviews', new HotelData(okDb, down));
    expect(outcome).toEqual({ ok: false, text: SEMANTIC_UNAVAILABLE });
    expect(log).toHaveBeenCalledWith('tool find_reviews failed', expect.objectContaining({ message: expect.stringContaining('abc123') }));
  });

  it('gives the same answer once the daily embedding budget is spent, without calling the model', async () => {
    const calls: string[] = [];
    const spent = budgetedEmbedder(
      embedder(async (texts) => (calls.push(...texts), texts.map(() => [0.6, 0.8]))),
      async () => ({ ok: false }),
    );
    expect(await call('find_reviews', new HotelData(okDb, spent))).toEqual({ ok: false, text: SEMANTIC_UNAVAILABLE });
    expect(calls).toEqual([]);
  });

  it('fails closed when the budget cannot be reached', async () => {
    const unreachable = budgetedEmbedder(embedder(), async () => Promise.reject(new Error('Durable Object budget.internal is overloaded')));
    expect(await call('find_reviews', new HotelData(okDb, unreachable))).toEqual({ ok: false, text: SEMANTIC_UNAVAILABLE });
  });
});

describe('budgetedEmbedder', () => {
  it('takes one unit per call and refuses the 2001st embedding of the day', async () => {
    let state = emptyBudget();
    const now = new Date('2026-11-20T10:00:00Z');
    let embedded = 0;
    const inner = embedder(async (texts) => ((embedded += 1), texts.map(() => [1, 0])));
    const budgeted = budgetedEmbedder(inner, async () => {
      const taken = spend(state, 'embedding', DEFAULT_DAILY_LIMITS, now);
      state = taken.state;
      return taken.decision;
    });
    expect(budgeted.model).toBe('m');
    expect(budgeted.dimensions).toBe(2);
    for (let i = 0; i < 2000; i++) expect(await budgeted.embed(['noise'])).toEqual([[1, 0]]);
    await expect(budgeted.embed(['noise'])).rejects.toThrow(/budget/);
    expect(embedded).toBe(2000);
  });
});

describe('success', () => {
  const evidence = { sources: ['hotel.reviews'], definitions: {}, period: null, sql: '', params: [], rowCount: 200, businessDate: '2026-11-20', notes: [] };

  it('stops adding rows to the model text at 50,000 characters and says how many are left out', () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ i, text: 'x'.repeat(1024) }));
    const outcome = success({ rows, evidence });
    expect(outcome.text.length).toBeLessThan(51_000);
    const shown = (JSON.parse(outcome.text.slice(0, outcome.text.indexOf('\n'))) as unknown[]).length;
    expect(shown).toBeGreaterThan(40);
    expect(outcome.text).toContain(`… ${200 - shown} more rows not shown.`);
    expect(outcome.ok && outcome.structured['rows']).toHaveLength(200);
  });

  it('keeps the bound after untrusted text is escaped: every "<" becomes six characters', () => {
    const rows = Array.from({ length: 200 }, () => ({ text: '<'.repeat(1024) }));
    const outcome = success({ rows, evidence }, 'guest reviews');
    expect(outcome.text.length).toBeLessThan(51_000);
    const shown = outcome.text.match(/"text"/g)!.length;
    expect(shown).toBeGreaterThan(5);
    expect(outcome.text).toContain(`… ${200 - shown} more rows not shown.`);
    expect(outcome.text).toContain('</untrusted_data>');
  });

  it('never goes over the bound, even when the next row is large', () => {
    const rows = Array.from({ length: 5 }, () => ({ text: 'x'.repeat(30_000) }));
    const outcome = success({ rows, evidence });
    expect(outcome.text.length).toBeLessThan(51_000);
    expect(outcome.text).toContain('… 4 more rows not shown.');
  });

  it('shows every row of a small result, with no note', () => {
    const outcome = success({ rows: [{ a: 1 }, { a: 2 }], evidence });
    expect(outcome.text.startsWith('[{"a":1},{"a":2}]\n')).toBe(true);
    expect(outcome.text).not.toContain('not shown');
  });
});

describe('get_schema', () => {
  it('marks vector columns, so a custom query never selects one', async () => {
    const db: Db = {
      query: async <Row>(sql: string) =>
        (sql.includes('information_schema')
          ? [
              { table_name: 'review_passages', column_name: 'content', data_type: 'text', udt_name: 'text' },
              { table_name: 'review_passages', column_name: 'embedding', data_type: 'USER-DEFINED', udt_name: 'vector' },
              { table_name: 'reviews', column_name: 'review_id', data_type: 'bigint', udt_name: 'int8' },
            ]
          : [{ d: '2026-11-20' }]) as Row[],
    };
    const outcome = await call('get_schema', new HotelData(db));
    expect(outcome.text).toContain('- hotel.review_passages(content text, embedding (vector; never select it))\n- hotel.reviews(review_id bigint)');
  });
});
