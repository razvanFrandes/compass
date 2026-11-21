import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness, type Extension, type ToolRegistration } from '@earendil-works/pi-durable';
import { MemoryStorage } from '@earendil-works/pi-durable/storage/memory';
import type { Widget } from '@compass/contracts';
import { afterAll, describe, expect, it } from 'vitest';
import { HotelData } from '../src/application/hotel-data.ts';
import { openPostgres } from '../src/infrastructure/postgres.ts';
import { projectEntries } from '../src/presentation/agents/chat-projection.ts';
import { createDataExtension } from '../src/presentation/agents/pi-data-extension.ts';
import { MAX_WIDGETS_PER_ANSWER, widgetsOfLastAnswer, withWidgets } from '../src/presentation/agents/widgets.ts';

// show_widget on a real pi-durable Harness with a scripted (faux) model. The first test reads the local Halcyon
// database through the real get_pace tool; the others use a canned data tool, so they need no database.
process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);

const context = BACKGROUND_CONTEXT;
const open: Harness[] = [];
afterAll(async () => {
  for (const harness of open) await harness.close(context);
});

type Call = [name: string, args: Parameters<typeof fauxToolCall>[1]];
interface Seen {
  name: string;
  text: string;
  isError: boolean;
  details: { widget?: Widget; rows?: unknown[] } | undefined;
}

const EVIDENCE = { sources: ['hotel.fake'], definitions: {}, period: null, sql: 'select 1', params: [], rowCount: 0, businessDate: '2026-11-20', notes: [] };

/** A data tool that returns `rows` as the catalog tools do: text for the model, rows and evidence as details. */
function cannedData(rows: Record<string, unknown>[], evidence: Record<string, unknown> = EVIDENCE): Extension {
  const tool = {
    name: 'get_rows',
    description: 'Canned rows.',
    parameters: { type: 'object', properties: {} },
    replay: 'safe',
    async execute() {
      return { output: [{ type: 'text', text: JSON.stringify(rows) }], details: { rows, evidence } };
    },
  } as unknown as ToolRegistration;
  return { name: 'compass-data', tools: [tool] };
}

/**
 * Runs one question. Each step is one model turn: a fixed tool call, or a function of the result ids seen so far
 * (the model reads them at the end of each data tool result). Returns every tool result the model saw, and the
 * transcript as the chat projects it.
 */
async function run(data: Extension, steps: (Call | ((resultIds: string[]) => Call))[]) {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  const registry = createRegistry();
  registry.install(withWidgets(data));
  const harness = await Harness.open(new MemoryStorage(), { models, registry }, context);
  open.push(harness);
  const model = faux.getModel();
  const root = await harness.root(context, { agent: { model: { provider: model.provider, modelId: model.id } } });

  let seen: Seen[] = [];
  const resultIds = (messages: readonly { role: string; content?: unknown }[]) =>
    messages
      .filter((m) => m.role === 'toolResult')
      .flatMap((m) => [...JSON.stringify(m.content).matchAll(/Result id: (\S+?)[ .)]/g)].map((match) => match[1]!));
  faux.setResponses([
    ...steps.map((step) => (ctx: { messages: readonly { role: string; content?: unknown }[] }) => {
      const [name, args] = typeof step === 'function' ? step(resultIds(ctx.messages)) : step;
      return fauxAssistantMessage(fauxToolCall(name, args), { stopReason: 'toolUse' });
    }),
    (ctx) => {
      seen = ctx.messages
        .filter((m) => m.role === 'toolResult')
        .map((m) => ({ name: m.toolName, text: JSON.stringify(m.content), isError: m.isError, details: m.details as Seen['details'] }));
      return fauxAssistantMessage(fauxText('Done.'));
    },
  ]);
  const settled = await (await root.submit({ type: 'input', content: 'Show me.' }, context)).wait(context);
  const page = await root.commit((tx) => tx.scanEntries({ conversationId: root.id, order: 'ascending' }, 100), context);
  return { seen, status: settled.status, entries: projectEntries(page.items) };
}

const PACE = [
  { hotel_code: 'AMS', rooms_otb: 4209, rooms_otb_stly: 4065, pace_pct: 3.5 },
  { hotel_code: 'BCN', rooms_otb: 4674, rooms_otb_stly: 4889, pace_pct: -4.4 },
  { hotel_code: 'LIS', rooms_otb: 2231, rooms_otb_stly: 2700, pace_pct: -17.4 },
];
const bar = (sourceCallId: string, extra: Record<string, unknown> = {}) =>
  ['show_widget', { kind: 'bar', title: 'Lisbon is 17.4% behind last year', sourceCallId, x: 'hotel_code', y: ['pace_pct'], ...extra }] as Call;

describe('show_widget', () => {
  it('draws a widget from the rows of a real data tool result: the model supplies no number', async () => {
    const data = createDataExtension(() => {
      const db = openPostgres(process.env['DATABASE_URL']!);
      return { data: new HotelData(db), close: () => db.close() };
    });
    const { seen, status, entries } = await run(data, [['get_pace', { daysAhead: 45 }], (ids) => bar(ids[0]!, { subtitle: 'All hotels, next 45 nights' })]);

    expect(status).toBe('done');
    const [pace, shown] = seen;
    expect(pace!.text).toMatch(/Result id: \S+/);
    expect(shown).toMatchObject({ name: 'show_widget', isError: false });
    const widget = shown!.details!.widget!;
    expect(widget).toMatchObject({ kind: 'bar', title: 'Lisbon is 17.4% behind last year', subtitle: 'All hotels, next 45 nights', x: 'hotel_code', y: ['pace_pct'], format: 'percent' });
    // Rows, columns and evidence are the data tool's own.
    expect(widget.rows).toEqual(pace!.details!.rows);
    expect(widget.rows).toHaveLength(20);
    expect(widget.rows[0]).toHaveProperty('pace_pct');
    expect(widget.columns.find((c) => c.key === 'hotel_code')).toMatchObject({ kind: 'hotel' });
    expect(widget.evidence.sources).toContain('hotel.pace_vs_stly()');
    // The model reads a short receipt, not the rows again.
    expect(shown!.text).toContain('Lisbon is 17.4% behind last year');
    expect(shown!.text.length).toBeLessThan(400);

    // The chat sends the widget on the show_widget tool_result entry.
    const entry = entries.find((e) => e.kind === 'tool_result' && e.name === 'show_widget');
    expect(entry?.kind === 'tool_result' && entry.widget).toEqual(widget);
    expect(widgetsOfLastAnswer(entries)).toEqual([widget]);
  });

  it('prefers the columns the data tool named in its evidence', async () => {
    const columns = [
      { key: 'hotel_code', label: 'Hotel', kind: 'hotel' },
      { key: 'pace_pct', label: 'Pace vs last year', kind: 'percent', unit: '%' },
    ];
    const { seen } = await run(cannedData(PACE, { ...EVIDENCE, columns }), [['get_rows', {}], (ids) => bar(ids[0]!)]);
    expect(seen[1]!.details!.widget!.columns).toEqual(columns);
  });

  it('answers an unknown result id with the ids it can use', async () => {
    const { seen, status } = await run(cannedData(PACE), [['get_rows', {}], () => bar('made-up-id')]);
    expect(status).toBe('done');
    const [rows, shown] = seen;
    const id = /Result id: (\S+?)[ .)]/.exec(rows!.text)![1]!;
    expect(shown).toMatchObject({ isError: true });
    expect(shown!.text).toContain('made-up-id');
    expect(shown!.text).toContain(id);
    expect(shown!.text).toContain('get_rows');
    expect(shown!.details?.widget).toBeUndefined();
  });

  it('answers a kind that does not fit the rows with what to do instead', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => ({ hotel_code: `H${i}`, rooms_otb: 100 + i }));
    const { seen } = await run(cannedData(twenty), [
      ['get_rows', {}],
      (ids) => ['show_widget', { kind: 'pie', title: 'Rooms on the books by hotel', sourceCallId: ids[0]!, group: 'hotel_code', y: ['rooms_otb'] }],
      (ids) => ['show_widget', { kind: 'bar', title: 'Rooms on the books by hotel', sourceCallId: ids[0]!, x: 'hotel_code', y: ['nope'] }],
    ]);
    expect(seen[1]).toMatchObject({ isError: true, text: expect.stringMatching(/2–7 rows; that result has 20/) });
    expect(seen[2]).toMatchObject({ isError: true, text: expect.stringContaining('hotel_code, rooms_otb') });
  });

  it('refuses a result that has no rows to draw', async () => {
    const { seen } = await run(cannedData([]), [['get_rows', {}], () => bar('anything')]);
    // A result without rows prints no id, so there is nothing the model could name.
    expect(seen[0]!.text).not.toContain('Result id');
    expect(seen[1]).toMatchObject({ isError: true });
  });

  it(`shows at most ${MAX_WIDGETS_PER_ANSWER} widgets per answer`, async () => {
    const show = (title: string) => (ids: string[]) => bar(ids[0]!, { title });
    const { seen, entries } = await run(cannedData(PACE), [['get_rows', {}], show('One widget'), show('Two widgets'), show('Three widgets'), show('Four widgets'), show('Five widgets')]);
    expect(seen.slice(1).map((r) => r.isError)).toEqual([false, false, false, false, true]);
    expect(seen.at(-1)!.text).toMatch(/at most 4 widgets/);
    expect(widgetsOfLastAnswer(entries).map((w) => w.title)).toEqual(['One widget', 'Two widgets', 'Three widgets', 'Four widgets']);
  });
});

describe('withWidgets', () => {
  it('adds show_widget and its prompt sections to the data tools', () => {
    const extension = withWidgets(cannedData(PACE));
    expect(extension.tools?.map((t) => t.name)).toEqual(['get_rows', 'show_widget']);
    const prompt = (extension.sections ?? []).map((s) => `${s.key}: ${String(s.render({} as never, context))}`).join('\n');
    expect(prompt).toMatch(/widgets: /);
    expect(prompt).toContain('show_widget');
    expect(prompt).toMatch(/title .*conclusion/i);
    expect(prompt).toMatch(/Pick the kind by what the rows say/);
    expect(prompt).toMatch(/Up to 3 widgets/);
    expect(prompt).toMatch(/board_view: /);
    expect(prompt).toContain('Build a board view:');
    expect(prompt).toMatch(/2 to 4/);
  });
});
