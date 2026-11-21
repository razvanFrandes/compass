import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { MemoryStorage } from '@earendil-works/pi-durable/storage/memory';
import { describe, expect, it } from 'vitest';
import { createDataExtension } from '../src/presentation/agents/pi-data-extension.ts';
import { agentChangeFor, QUICK_TOOLS } from '../src/presentation/agents/modes.ts';
import { withWidgets } from '../src/presentation/agents/widgets.ts';

const context = BACKGROUND_CONTEXT;

async function harnessWithData() {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  // As Kassandra installs it: the data tools plus show_widget.
  const data = withWidgets(
    createDataExtension(() => {
      throw new Error('no database in this test');
    }),
  );
  const registry = createRegistry();
  registry.install(data);
  const harness = await Harness.open(new MemoryStorage(), { models, registry }, context);
  return { harness, data, faux };
}

describe('answer modes', () => {
  it('Quick offers only the governed-metric tools and show_widget, on Haiku, with few turns', async () => {
    const { harness, data } = await harnessWithData();
    const root = await harness.root(context);
    await root.configure(agentChangeFor('quick', data), context);
    const agent = await root.agent(context);

    expect(agent.tools.map((t) => t.name).sort()).toEqual([...QUICK_TOOLS].sort());
    expect(agent.tools.map((t) => t.name)).toContain('show_widget');
    expect(agent.model).toEqual({ provider: 'cloudflare', modelId: 'anthropic/claude-haiku-5.5' });
    expect(agent.maxTurns).toBe(5);
    await harness.close(context);
  });

  it('Quick answers the channel and business mix: "What\'s the channel mix at Barcelona?" is a core question', () => {
    expect(QUICK_TOOLS).toContain('get_channel_mix');
    expect(QUICK_TOOLS).toContain('get_mix');
  });

  it('tells the model why a tool it called is not there, instead of Pi\'s bare "is not available"', async () => {
    const { harness, data, faux } = await harnessWithData();
    const seen: string[] = [];
    const lastResult = (ctx: { messages: readonly { role: string; content?: unknown }[] }) => {
      const last = ctx.messages.at(-1);
      seen.push(last?.role === 'toolResult' ? JSON.stringify(last.content) : '');
    };
    faux.setResponses([
      // A data tool Quick does not offer, then a tool that does not exist at all.
      fauxAssistantMessage(fauxToolCall('get_fnb', { from: '2026-11-01', to: '2026-11-19' }), { stopReason: 'toolUse' }),
      (ctx) => (lastResult(ctx), fauxAssistantMessage(fauxToolCall('get_channel_breakdown', { hotel: 'BCN' }), { stopReason: 'toolUse' })),
      (ctx) => (lastResult(ctx), fauxAssistantMessage(fauxText('Done.'))),
    ]);
    const root = await harness.root(context);
    await root.configure(agentChangeFor('quick', data), context);
    const model = faux.getModel();
    await root.configure({ model: { provider: model.provider, modelId: model.id } }, context);
    const submission = await root.submit({ type: 'input', content: 'F&B covers?' }, context);
    await submission.wait(context);

    expect(seen[0]).toContain('get_fnb is not offered in Quick mode');
    expect(seen[0]).toContain('Thinker');
    expect(seen[1]).toContain('There is no tool called get_channel_breakdown');
    for (const text of seen) expect(text).not.toContain('is not available');
    await harness.close(context);
  });

  it('Thinker offers every data tool and show_widget, on Sonnet', async () => {
    const { harness, data } = await harnessWithData();
    const root = await harness.root(context);
    await root.configure(agentChangeFor('quick', data), context);
    await root.configure(agentChangeFor('thinker', data), context);
    const agent = await root.agent(context);

    expect(agent.tools).toHaveLength(26);
    expect(agent.tools.map((t) => t.name)).toContain('show_widget');
    expect(agent.model).toEqual({ provider: 'cloudflare', modelId: 'anthropic/claude-sonnet-5.5' });
    await harness.close(context);
  });

  it('adds the hotel scope to the conversation instructions, next to the mode', () => {
    const data = createDataExtension(() => {
      throw new Error('no database in this test');
    });
    const scope = 'You are answering for: Arbor Lisbon Chiado (LIS).';
    expect(agentChangeFor('thinker', data).instructions).toMatch(/^Thinker mode:/);
    expect(agentChangeFor('thinker', data, scope).instructions!.endsWith(scope)).toBe(true);
    const quick = agentChangeFor('quick', data, scope).instructions!;
    expect(quick).toMatch(/^Quick mode:/);
    expect(quick.endsWith(scope)).toBe(true);
  });
});
