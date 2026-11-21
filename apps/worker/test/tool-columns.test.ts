import { EvidenceColumn, type Evidence } from '@compass/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HotelData } from '../src/application/hotel-data.ts';
import { inferColumns } from '../src/domain/evidence-columns.ts';
import { openPostgres, type PostgresDb } from '../src/infrastructure/postgres.ts';
import { DATA_TOOLS, type DataTool } from '../src/presentation/tools/catalog.ts';
import { SOURCE_LABELS, TOOL_VIEWS, sourceLabelsFor } from '../src/presentation/tools/tool-views.ts';
import { TOOL_CALLS } from './fixtures/tool-calls.ts';

// Every catalog tool tells the UI how to show its rows: a human title, and one column (label, kind, unit) per row
// property. The tools run for real against the local Halcyon database, so a column added to a query without a
// label fails here.
process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);

const tools = DATA_TOOLS as readonly DataTool[];
const period = { from: '2026-10-01', to: '2026-10-31' };

const CALLS = TOOL_CALLS;

/** Tools that cannot run on the local database, or that return no rows. */
const NOT_RUN = new Set(['find_reviews', 'get_schema']);

let db: PostgresDb;
let data: HotelData;
beforeAll(() => {
  db = openPostgres(process.env['DATABASE_URL']!);
  data = new HotelData(db);
});
afterAll(() => db.close());

type Shown = { rows: Record<string, unknown>[]; evidence: Evidence; args: Record<string, unknown> };

/** Each distinct call runs once: some of these queries are heavy, and the database is shared with the other suites. */
const ran = new Map<string, Promise<Shown>>();

function evidenceOf(tool: DataTool, raw: Record<string, unknown>): Promise<Shown> {
  const key = `${tool.name} ${JSON.stringify(raw)}`;
  let shown = ran.get(key);
  if (!shown) {
    shown = (async () => {
      const args = tool.input.parse(raw);
      const outcome = await tool.run(data, args as never);
      if (!outcome.ok) throw new Error(`${tool.name} failed: ${outcome.text}`);
      return { ...(outcome.structured as Omit<Shown, 'args'>), args };
    })();
    ran.set(key, shown);
  }
  return shown;
}

describe('tool views', () => {
  it('has a title and columns for every catalog tool, and for no other name', () => {
    expect(Object.keys(TOOL_VIEWS).sort()).toEqual(tools.map((tool) => tool.name).sort());
    for (const tool of tools) expect(TOOL_VIEWS[tool.name]!.title.length, tool.name).toBeGreaterThan(3);
  });

  it('has sample arguments for every tool that returns rows from the database', () => {
    expect(Object.keys(CALLS).sort()).toEqual(tools.map((tool) => tool.name).filter((name) => !NOT_RUN.has(name)).sort());
  });

  for (const tool of tools.filter((t) => !NOT_RUN.has(t.name))) {
    for (const args of CALLS[tool.name] ?? []) {
      it(`${tool.name} ${JSON.stringify(args)} declares a column for every row property`, async () => {
        const { rows, evidence, args: parsed } = await evidenceOf(tool, args);
        expect(rows.length, 'the sample arguments should return rows').toBeGreaterThan(0);
        const view = TOOL_VIEWS[tool.name]!;
        expect(evidence.title).toBe(view.titleFor?.(parsed) ?? view.title);

        const columns = evidence.columns ?? [];
        for (const column of columns) expect(EvidenceColumn.safeParse(column).success, column.key).toBe(true);
        const keys = columns.map((column) => column.key);
        expect(new Set(keys).size, 'column keys are unique').toBe(keys.length);
        const rowKeys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
        expect(rowKeys.filter((key) => !keys.includes(key)), 'row properties without a column').toEqual([]);
        // No column describes a property the rows do not have: the UI would draw an empty column.
        expect(keys.filter((key) => !rowKeys.includes(key)), 'columns without a row property').toEqual([]);

        // Every source has a name written for it, not one derived from the table name.
        for (const source of evidence.sources) expect(SOURCE_LABELS[source], source).toBeTruthy();
        expect(evidence.sourceLabels).toEqual(sourceLabelsFor(evidence.sources));
      });
    }
  }

  it('find_reviews declares a column for every property of a match', async () => {
    const match = {
      sentiment: 'complaint', quote: 'Noise.', similarity: 0.75, mentions: 3, share_pct: 2.1, first_date: '2026-09-01', last_date: '2026-11-01',
      mentions_by_hotel: { BCN: 3 }, hotel_code: 'BCN', review_date: '2026-11-01', source: 'Booking.com', overall_score: 8.1, review_text: 'Noise.',
    };
    const evidence = { sources: ['hotel.reviews', 'hotel.review_passages'], definitions: {}, period: null, sql: '', params: [], rowCount: 1, businessDate: '2026-11-20', notes: [] };
    const fake = { findReviews: async () => ({ ok: true, value: { rows: [match], evidence } }) } as unknown as HotelData;
    const tool = tools.find((t) => t.name === 'find_reviews')!;
    const outcome = await tool.run(fake, tool.input.parse({ question: 'noise' }) as never);
    if (!outcome.ok) throw new Error(outcome.text);
    const shown = (outcome.structured as { evidence: Evidence }).evidence;
    expect(shown.columns?.map((column) => column.key).sort()).toEqual(Object.keys(match).sort());
    expect(shown.title).toBe('What guests say');
    expect(shown.sourceLabels).toEqual({ 'hotel.reviews': 'Guest reviews', 'hotel.review_passages': 'Review sentences' });
  });

  it('hides plumbing columns and marks hotel codes, money and percentages', async () => {
    const pace = (await evidenceOf(tools.find((t) => t.name === 'get_pace')!, { hotels: ['LIS'] })).evidence.columns!;
    expect(pace.find((c) => c.key === 'hotel_code')).toEqual({ key: 'hotel_code', label: 'Hotel', kind: 'hotel' });
    expect(pace.find((c) => c.key === 'pace_pct')).toMatchObject({ label: 'Pace vs last year', kind: 'percent' });
    expect(pace.find((c) => c.key === 'rooms_otb')).toMatchObject({ label: 'On the books', kind: 'count', unit: 'room nights' });

    const brief = (await evidenceOf(tools.find((t) => t.name === 'get_brief')!, {})).evidence.columns!;
    expect(brief.find((c) => c.key === 'id')).toMatchObject({ kind: 'id', hidden: true });
    expect(brief.find((c) => c.key === 'kind')).toMatchObject({ hidden: true });
    expect(brief.find((c) => c.key === 'impact_eur')).toMatchObject({ kind: 'currency', unit: 'EUR' });
  });

  it('titles a call after what it shows, where the tool can show different things', async () => {
    const titleOf = async (name: string, args: Record<string, unknown>) => (await evidenceOf(tools.find((t) => t.name === name)!, args)).evidence.title;
    expect(await titleOf('get_metric', { metric: 'occupancy', hotels: ['LIS'], ...period })).toBe('Occupancy');
    expect(await titleOf('get_metric', { metric: 'adr', hotels: ['LIS'], compare: 'stly', ...period })).toBe('ADR vs last year');
    expect(await titleOf('get_mix', { hotels: ['LIS'], by: 'channel_type', ...period })).toBe('Business mix by channel type');
    expect(await titleOf('get_pnl', { hotels: ['MIA'], view: 'lines', ...period })).toBe('Profit and loss by line');
    expect(await titleOf('get_pace', { hotels: ['LIS'] })).toBe('Pace vs last year');
  });

  it('labels the value of get_metric after the metric, and the key after the roll-up', async () => {
    const tool = tools.find((t) => t.name === 'get_metric')!;
    const byHotel = (await evidenceOf(tool, { metric: 'occupancy', hotels: ['LIS'], ...period })).evidence.columns!;
    expect(byHotel).toEqual([
      { key: 'period', label: 'Month', kind: 'month' },
      { key: 'key', label: 'Hotel', kind: 'hotel' },
      { key: 'value', label: 'Occupancy', kind: 'percent' },
    ]);
    const byRegion = (await evidenceOf(tool, { metric: 'adr', by: 'region', grain: 'week', compare: 'stly', ...period })).evidence.columns!;
    expect(byRegion.map((c) => [c.key, c.label, c.kind, c.unit])).toEqual([
      ['period', 'Week starting', 'date', undefined],
      ['key', 'Region', 'text', undefined],
      ['value', 'ADR', 'currency', 'EUR'],
      ['compare_value', 'ADR, same time last year', 'currency', 'EUR'],
      ['change', 'Change', 'currency', 'EUR'],
      ['change_pct', 'Change %', 'percent', undefined],
    ]);
  });

  it('names every source the tools and the brief detectors read', () => {
    expect(sourceLabelsFor(['hotel.v_hotel_day', 'hotel.otb_as_of()'])).toEqual({
      'hotel.v_hotel_day': 'Daily hotel performance',
      'hotel.otb_as_of()': 'On-the-books snapshots',
    });
    // An unknown source still gets a readable name rather than nothing.
    expect(sourceLabelsFor(['hotel.some_new_table'])).toEqual({ 'hotel.some_new_table': 'Some new table' });
    expect(SOURCE_LABELS['hotel.*']).toBe('All hotel data (custom analysis)');
  });
});

describe('inferColumns (run_readonly_query)', () => {
  it('infers kinds from names and values', () => {
    const columns = inferColumns([
      { hotel_code: 'LIS', date: '2026-10-01', month: '2026-10-01', rooms_sold: 120, room_revenue_eur: 18250.5, occupancy_pct: 81.2, channel: 'Direct', reservation_id: 991, adr: 152.08, is_actual: true },
    ]);
    expect(columns).toEqual([
      { key: 'hotel_code', label: 'Hotel', kind: 'hotel' },
      { key: 'date', label: 'Date', kind: 'date' },
      { key: 'month', label: 'Month', kind: 'month' },
      { key: 'rooms_sold', label: 'Rooms sold', kind: 'count' },
      { key: 'room_revenue_eur', label: 'Room revenue', kind: 'currency', unit: 'EUR' },
      { key: 'occupancy_pct', label: 'Occupancy', kind: 'percent' },
      { key: 'channel', label: 'Channel', kind: 'text' },
      { key: 'reservation_id', label: 'Reservation ID', kind: 'id', hidden: true },
      { key: 'adr', label: 'ADR', kind: 'currency' },
      { key: 'is_actual', label: 'Is actual', kind: 'text' },
    ]);
  });

  it('reads the value when the name says nothing', () => {
    const columns = inferColumns([
      { a: '2026-10-05', b: 12, c: 12.5, d: 'x', e: null },
      { a: '2026-10-06', b: 13, c: 14, d: 'y', e: 3.2 },
    ]);
    expect(columns.map((c) => c.kind)).toEqual(['date', 'count', 'number', 'text', 'number']);
  });

  it('covers the properties of every row, not only the first, and survives no rows', () => {
    expect(inferColumns([{ a: 1 }, { a: 2, b: 'x' }]).map((c) => c.key)).toEqual(['a', 'b']);
    expect(inferColumns([])).toEqual([]);
  });

  it('keeps acronyms and never trusts a name that claims a date over a value that is not one', () => {
    const columns = inferColumns([{ revpar_eur: 99.1, gop_margin_pct: 31.2, stay_date: 'next week', bar_rate: 220 }]);
    expect(columns).toEqual([
      { key: 'revpar_eur', label: 'RevPAR', kind: 'currency', unit: 'EUR' },
      { key: 'gop_margin_pct', label: 'GOP margin', kind: 'percent' },
      { key: 'stay_date', label: 'Stay date', kind: 'text' },
      { key: 'bar_rate', label: 'BAR rate', kind: 'currency' },
    ]);
  });
});
