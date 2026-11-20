import { WorkflowSpec, type WorkflowDraft } from '@compass/contracts';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { MemoryStorage } from '@earendil-works/pi-durable/storage/memory';
import { describe, expect, it } from 'vitest';
import { createBuilderExtension, type DraftHost } from '../src/application/workflows/builder-tools.ts';
import { applyDraftPatch, draftIssues } from '../src/application/workflows/draft.ts';

// The builder's tools on a real pi-durable Harness with a scripted model: each call edits one node of the draft.
const context = BACKGROUND_CONTEXT;
const ALLOWED = ['get_pace', 'get_pickup', 'get_rate_position'];

describe('applyDraftPatch', () => {
  const draft: WorkflowDraft = { hotels: ['LIS1'], trigger: { kind: 'manual' }, checks: ['get_pace'] };

  it.each([
    ['no hotels', { hotels: [] }, 'hotels'],
    ['a bad address', { delivery: { channel: 'email', to: 'nope' } }, 'delivery'],
    ['a check that is not a data tool', { checks: ['drop_table'] }, 'drop_table'],
    ['checks that are not a list', { checks: 'get_pace' }, 'checks'],
    ['a field the spec does not have', { owner: 'me' }, 'owner'],
  ])('rejects %s and leaves the draft alone', (_name, patch, named) => {
    const before = structuredClone(draft);
    const result = applyDraftPatch(draft, patch as WorkflowDraft, ALLOWED);
    expect(result).toEqual({ error: expect.stringContaining(named) });
    expect(draft).toEqual(before);
  });

  it('names the node a valid patch changed', () => {
    expect(applyDraftPatch({}, { hotels: ['LIS1'] }, ALLOWED)).toEqual({ draft: { hotels: ['LIS1'] }, changed: ['scope'] });
  });

  it('applies nothing when one field of the patch is invalid', () => {
    expect(applyDraftPatch(draft, { hotels: ['OPO1'], goal: 'short' }, ALLOWED)).toEqual({ error: expect.stringContaining('goal') });
  });

  it('removes the address when the patch sets it to undefined', () => {
    const withAddress: WorkflowDraft = { action: { type: 'email' }, delivery: { channel: 'email', to: 'ana@example.com' } };
    const result = applyDraftPatch(withAddress, { action: { type: 'notify' }, delivery: undefined }, ALLOWED);
    expect(result).toMatchObject({ changed: ['approval', 'action'] });
    expect('draft' in result && 'delivery' in result.draft).toBe(false);
  });

  it('allows at most 8 checks', () => {
    const many = Array.from({ length: 9 }, (_, i) => `tool_${i}`);
    expect(applyDraftPatch({}, { checks: many }, many)).toEqual({ error: expect.stringContaining('checks') });
  });
});

describe('draftIssues', () => {
  const complete: WorkflowDraft = { name: 'Pace watch', hotels: ['LIS1'], trigger: { kind: 'manual' }, goal: 'Tell me when pace falls behind.', action: { type: 'notify' } };

  it('says which parts are missing', () => {
    expect(draftIssues({ hotels: ['LIS1'], action: { type: 'email' } })).toEqual([
      expect.stringMatching(/^name: /),
      expect.stringMatching(/^trigger: /),
      expect.stringMatching(/^goal: /),
    ]);
  });

  it('says an email action still needs its address', () => {
    expect(draftIssues({ ...complete, action: { type: 'email' } })).toEqual(['delivery: An email action needs the address to send to.']);
  });

  it('says nothing once the draft can be saved', () => {
    expect(draftIssues(complete)).toEqual([]);
  });
});

class MemoryDraftHost implements DraftHost {
  draft: WorkflowDraft;
  constructor(draft: WorkflowDraft = {}) {
    this.draft = draft;
  }
  async get() {
    return this.draft;
  }
  async apply(patch: WorkflowDraft) {
    const result = applyDraftPatch(this.draft, patch, ALLOWED);
    if ('error' in result) return result;
    this.draft = result.draft;
    return { changed: result.changed };
  }
}

interface ToolResult {
  text: string;
  isError: boolean;
  details: { changed?: string[]; graph?: { nodes: { id: string }[] } } | undefined;
}

/** Runs the scripted tool calls one model turn each, and returns what the model saw after each call. */
async function runCalls(host: DraftHost, calls: [name: string, args: Parameters<typeof fauxToolCall>[1]][]): Promise<ToolResult[]> {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  const registry = createRegistry();
  registry.install(createBuilderExtension(host, ALLOWED));
  const harness = await Harness.open(new MemoryStorage(), { models, registry }, context);
  const model = faux.getModel();
  const root = await harness.root(context, { agent: { model: { provider: model.provider, modelId: model.id } } });

  let results: ToolResult[] = [];
  faux.setResponses([
    ...calls.map(([name, args]) => fauxAssistantMessage(fauxToolCall(name, args), { stopReason: 'toolUse' })),
    (ctx) => {
      results = ctx.messages
        .filter((m) => m.role === 'toolResult')
        .map((m) => ({ text: JSON.stringify(m.content), isError: m.isError, details: m.details as ToolResult['details'] }));
      return fauxAssistantMessage(fauxText('Done.'));
    },
  ]);
  await (await root.submit({ type: 'input', content: 'Build it.' }, context)).wait(context);
  await harness.close(context);
  return results;
}

describe('builder tools', () => {
  it('builds a saveable workflow one node at a time, in chain order', async () => {
    const host = new MemoryDraftHost();
    const results = await runCalls(host, [
      ['set_trigger', { kind: 'schedule', every: 'day' }],
      ['set_hotels', { hotels: ['LIS1'] }],
      ['add_check', { tool: 'get_pace' }],
      ['set_goal', { name: 'Lisbon pace watch', goal: 'Tell me when Lisbon pace falls behind last year.' }],
      ['set_email', { to: 'ana@example.com' }],
    ]);

    expect(results.map((r) => r.isError)).toEqual([false, false, false, false, false]);
    expect(results.map((r) => r.details?.changed)).toEqual([['trigger'], ['scope'], ['check:get_pace'], ['analyze'], ['action']]);
    expect(results.at(-1)!.details!.graph!.nodes.map((n) => n.id)).toEqual(['trigger', 'scope', 'check:get_pace', 'analyze', 'action']);
    // The model sees the whole chain after every call, with the address masked.
    expect(results[1]!.text).toContain('Every morning, after the brief → LIS1 → (Add a check) → (Describe what to watch) → (Choose an action)');
    expect(results.at(-1)!.text).toContain('Email an****@example.com');
    expect(results.at(-1)!.text).not.toContain('ana@example.com');

    expect(WorkflowSpec.safeParse(host.draft).success).toBe(true);
    expect(draftIssues(host.draft)).toEqual([]);
    expect(host.draft).toMatchObject({ action: { type: 'email' }, delivery: { channel: 'email', to: 'ana@example.com' } });
  });

  it('add_check with an unknown tool fails the call and adds no check', async () => {
    const host = new MemoryDraftHost({ checks: ['get_pace'] });
    const [result] = await runCalls(host, [['add_check', { tool: 'drop_table' }]]);
    expect(result).toMatchObject({ isError: true, text: expect.stringContaining('drop_table') });
    expect(host.draft.checks).toEqual(['get_pace']);
  });

  it('add_check of a check already there succeeds and changes nothing', async () => {
    const host = new MemoryDraftHost({ checks: ['get_pace'] });
    const [result] = await runCalls(host, [['add_check', { tool: 'get_pace' }]]);
    expect(result).toMatchObject({ isError: false, details: { changed: [] } });
    expect(host.draft.checks).toEqual(['get_pace']);
  });

  it('remove_check removes a check, and fails for one that is not there', async () => {
    const host = new MemoryDraftHost({ checks: ['get_pace', 'get_pickup'] });
    const [removed, absent] = await runCalls(host, [
      ['remove_check', { tool: 'get_pace' }],
      ['remove_check', { tool: 'get_rate_position' }],
    ]);
    expect(removed).toMatchObject({ isError: false });
    expect(absent).toMatchObject({ isError: true, text: expect.stringContaining('get_rate_position') });
    expect(host.draft.checks).toEqual(['get_pickup']);
  });

  it('an invalid value fails the call with the reason and leaves the draft alone', async () => {
    const host = new MemoryDraftHost({ hotels: ['LIS1'] });
    const results = await runCalls(host, [
      ['set_hotels', { hotels: [] }],
      ['set_email', { to: 'nope' }],
      ['set_trigger', { kind: 'schedule' }],
    ]);
    expect(results.map((r) => r.isError)).toEqual([true, true, true]);
    expect(results[0]!.text).toContain('hotels');
    expect(results[1]!.text).toContain('delivery');
    expect(host.draft).toEqual({ hotels: ['LIS1'] });
  });

  it('set_email replaces another action, and set_action away from email drops the address', async () => {
    const host = new MemoryDraftHost({ action: { type: 'notify', guidance: 'Ping the team' } });
    await runCalls(host, [['set_email', { to: 'ana@example.com' }]]);
    expect(host.draft).toMatchObject({ action: { type: 'email' }, delivery: { channel: 'email', to: 'ana@example.com' } });
    expect(host.draft.action?.guidance ?? '').toBe('');

    const [result] = await runCalls(host, [['set_action', { type: 'create_task', guidance: 'Open a task for the RM' }]]);
    expect(result!.details!.changed).toEqual(['approval', 'action']);
    expect(host.draft.action).toEqual({ type: 'create_task', guidance: 'Open a task for the RM' });
    expect('delivery' in host.draft).toBe(false);
  });

  it('set_email keeps the guidance of an email action and only changes the address', async () => {
    const host = new MemoryDraftHost({ action: { type: 'email', guidance: 'Keep it to three lines' }, delivery: { channel: 'email', to: 'old@example.com' } });
    await runCalls(host, [['set_email', { to: 'new@example.com' }]]);
    expect(host.draft).toEqual({ action: { type: 'email', guidance: 'Keep it to three lines' }, delivery: { channel: 'email', to: 'new@example.com' } });
  });
});
