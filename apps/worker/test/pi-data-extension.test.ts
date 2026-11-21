import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { AssistantEntry, createRegistry, Harness } from '@earendil-works/pi-durable';
import { MemoryStorage } from '@earendil-works/pi-durable/storage/memory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HotelData } from '../src/application/hotel-data.ts';
import { openPostgres } from '../src/infrastructure/postgres.ts';
import { createDataExtension } from '../src/presentation/agents/pi-data-extension.ts';

// The Pi adapter of the shared data tools, on an in-memory Harness with a scripted (faux) model:
// no Cloudflare, no API key. The tool itself runs for real against the local Halcyon database.
process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);

const context = BACKGROUND_CONTEXT;
let harness: Harness;
let scope: string[] = [];
const faux = fauxProvider();

beforeAll(async () => {
  const registry = createRegistry();
  registry.install(
    createDataExtension(() => {
      const db = openPostgres(process.env['DATABASE_URL']!);
      return { data: new HotelData(db), close: () => db.close() };
    }, async () => scope),
  );
  const models = createModels();
  models.setProvider(faux.provider);
  harness = await Harness.open(new MemoryStorage(), { models, registry }, context);
});
afterAll(() => harness.close(context));

describe('Pi data extension', () => {
  it('lets the model call a data tool and answer from its rows', async () => {
    let toolResultSeen = '';
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('get_pace', { hotels: ['LIS'], daysAhead: 44 }), { stopReason: 'toolUse' }),
      (ctx) => {
        const last = ctx.messages.at(-1);
        toolResultSeen = last?.role === 'toolResult' ? JSON.stringify(last.content) : '';
        return fauxAssistantMessage(fauxText('Lisbon is behind last year.'));
      },
    ]);

    const model = faux.getModel();
    const root = await harness.root(context, { agent: { model: { provider: model.provider, modelId: model.id } } });
    const submission = await root.submit({ type: 'input', content: 'How is Lisbon pacing?' }, context);
    const settled = await submission.wait(context);

    expect(settled.status).toBe('done');
    if (settled.status === 'done' && settled.type === 'input') {
      const answer = await root.commit((tx) => tx.entry(AssistantEntry, settled.answer), context);
      expect(JSON.stringify(answer?.model)).toContain('Lisbon is behind last year.');
    }
    expect(toolResultSeen).toContain('"hotel_code\\":\\"LIS\\"');
    expect(toolResultSeen).toContain('pace_pct');
  });

  it('limits a tool call to the hotel scope of the conversation', async () => {
    scope = ['AMS'];
    let toolResultSeen = '';
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('get_pace', { daysAhead: 44 }), { stopReason: 'toolUse' }),
      (ctx) => {
        const last = ctx.messages.at(-1);
        toolResultSeen = last?.role === 'toolResult' ? JSON.stringify(last.content) : '';
        return fauxAssistantMessage(fauxText('Amsterdam only.'));
      },
    ]);
    const root = await harness.root(context);
    const submission = await root.submit({ type: 'input', content: 'How are we pacing?' }, context);
    await submission.wait(context);
    scope = [];

    expect(toolResultSeen).toContain('"hotel_code\\":\\"AMS\\"');
    expect(toolResultSeen).not.toContain('LIS');
    expect(toolResultSeen).toContain('Limited to the hotels selected: AMS.');
  });

  it('offers every catalog tool to the model, with a JSON Schema', async () => {
    const root = await harness.root(context);
    const agent = await root.agent(context);
    const names = agent.tools.map((t) => t.name).sort();
    expect(names).toContain('get_metric');
    expect(names).toContain('run_readonly_query');
    expect(names).toHaveLength(25);
  });
});
