import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { fauxProvider } from '@earendil-works/pi-ai';
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
