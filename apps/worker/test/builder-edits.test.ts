import { WorkflowSpec, type WorkflowDraft } from '@compass/contracts';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage, fauxProvider, fauxText } from '@earendil-works/pi-ai';
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { MemoryStorage } from '@earendil-works/pi-durable/storage/memory';
import { describe, expect, it } from 'vitest';
import { clientPatch, editEntry, EditLimiter, EDITS_PER_MINUTE, mergeChanged, savePlan } from '../src/application/workflows/builder-edits.ts';
import { projectEntries } from '../src/presentation/agents/chat-projection.ts';

const context = BACKGROUND_CONTEXT;

const saved: WorkflowDraft = {
  name: 'Lisbon pace watch',
  hotels: ['LIS1'],
  trigger: { kind: 'schedule', every: 'day' },
  goal: 'Tell me when Lisbon pace falls behind last year.',
  action: { type: 'email' },
  delivery: { channel: 'email', to: 'ana@example.com' },
};

describe('clientPatch', () => {
  it('reads null as "remove this field"', () => {
    const patch = clientPatch({ delivery: null, action: { type: 'notify' } });
    expect(patch).toEqual({ delivery: undefined, action: { type: 'notify' } });
    expect(patch && 'delivery' in patch).toBe(true);
  });

  it.each([[null], [undefined], ['x'], [[{ hotels: ['LIS1'] }]], [7]])('refuses %j, which is not an object', (raw) => {
    expect(clientPatch(raw)).toBeNull();
  });
});

describe('savePlan', () => {
  it('creates a workflow the first time', () => {
    expect(savePlan(saved, null, null)).toEqual({ kind: 'create' });
  });

  it('does nothing when the draft is as saved', () => {
    expect(savePlan(structuredClone(saved), saved, 'wf-1')).toEqual({ kind: 'none' });
  });

  it('updates the workflow without its recipient when another part changed', () => {
    const plan = savePlan({ ...saved, hotels: ['OPO1'] }, saved, 'wf-1');
    const { delivery: _fixed, ...rest } = saved;
    expect(plan).toStrictEqual({ kind: 'update', patch: { ...rest, hotels: ['OPO1'] } });
  });

  it('resets a field that was taken out of the draft, so the stored workflow matches what was saved', () => {
    const before: WorkflowDraft = { ...saved, description: 'Watches Lisbon.', checks: ['get_pace'], approver: 'gm', autonomy: 'suggest', enabled: false };
    const plan = savePlan(saved, before, 'wf-1');
    const { delivery: _fixed, ...rest } = saved;
    expect(plan).toStrictEqual({
      kind: 'update',
      patch: { ...rest, description: '', checks: [], approver: 'revenue_manager', autonomy: 'approve', enabled: true },
    });
    // What WorkflowAgents.update does with the patch: the stored workflow, the patch over it, parsed.
    const stored = WorkflowSpec.parse(before);
    const patch = plan.kind === 'update' ? plan.patch : {};
    expect(WorkflowSpec.parse({ ...stored, ...patch })).toEqual(WorkflowSpec.parse(saved));
  });

  it('leaves alone what the draft never set (a workflow the system turned off stays off)', () => {
    const plan = savePlan({ ...saved, hotels: ['OPO1'] }, saved, 'wf-1');
    expect(plan.kind === 'update' && 'enabled' in plan.patch).toBe(false);
  });

  it('treats the same address in another spelling as the same recipient', () => {
    const plan = savePlan({ ...saved, delivery: { channel: 'email', to: ' Ana@Example.com' } }, saved, 'wf-1');
    expect(plan.kind).toBe('update');
  });

  it.each([
    ['another address', { ...saved, delivery: { channel: 'email', to: 'bob@example.com' } }, saved],
    ['an address taken away', { ...saved, action: { type: 'notify' }, delivery: undefined }, saved],
    ['an address added', saved, { ...saved, action: { type: 'notify' }, delivery: undefined }],
  ] as [string, WorkflowDraft, WorkflowDraft][])('replaces the workflow for %s', (_name, draft, before) => {
    expect(savePlan(draft, before, 'wf-1')).toEqual({ kind: 'replace' });
  });
});

describe('EditLimiter', () => {
  it('allows 30 edits a minute per client, then refuses until the oldest is a minute old', () => {
    const limiter = new EditLimiter();
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < EDITS_PER_MINUTE; i++) expect(limiter.allow('a', t0 + i)).toBe(true);
    expect(EDITS_PER_MINUTE).toBe(30);
    expect(limiter.allow('a', t0 + 100)).toBe(false);
    expect(limiter.allow('b', t0 + 100)).toBe(true);
    expect(limiter.allow('a', t0 + 59_999)).toBe(false);
    expect(limiter.allow('a', t0 + 60_000)).toBe(true);
  });

  it('does not count refused edits and forgets idle clients', () => {
    const limiter = new EditLimiter();
    for (let i = 0; i < 40; i++) limiter.allow('a', 1000);
    expect(limiter.allow('a', 61_000)).toBe(true);
    limiter.allow('b', 200_000);
    expect(limiter.clients).toBe(1);
  });
});

describe('mergeChanged', () => {
  it('joins the nodes changed by several edits, once each', () => {
    expect(mergeChanged(['trigger'], ['scope', 'trigger'])).toEqual(['trigger', 'scope']);
    expect(mergeChanged(undefined, ['action'])).toEqual(['action']);
  });
});

describe('editEntry', () => {
  it('is shown as an app.edit event and read by the agent on its next turn, without starting a run', async () => {
    const faux = fauxProvider();
    const models = createModels();
    models.setProvider(faux.provider);
    const harness = await Harness.open(new MemoryStorage(), { models, registry: createRegistry() }, context);
    const model = faux.getModel();
    const root = await harness.root(context, { agent: { model: { provider: model.provider, modelId: model.id } } });

    let asked = 0;
    let seen = '';
    faux.setResponses([
      (ctx) => {
        asked++;
        seen = JSON.stringify(ctx.messages);
        return fauxAssistantMessage(fauxText('Noted.'));
      },
    ]);

    const draft: WorkflowDraft = { hotels: ['OPO1'], delivery: { channel: 'email', to: 'ana@example.com' }, action: { type: 'email' } };
    await (await root.submit({ type: 'write', entry: editEntry(draft, ['scope'], 1_700_000_000_000) }, context)).wait(context);
    expect(asked).toBe(0);

    await (await root.submit({ type: 'input', content: 'What changed?' }, context)).wait(context);
    expect(asked).toBe(1);
    expect(seen).toContain('edited the workflow on the canvas');
    expect(seen).toContain('OPO1');
    expect(seen).not.toContain('ana@example.com');

    const entries = projectEntries(await root.entries({ order: 'ascending' }, 20, undefined, context).then((page) => page.items));
    expect(entries[0]).toMatchObject({ kind: 'event', type: 'app.edit', data: { changed: ['scope'] }, at: 1_700_000_000_000 });
    await harness.close(context);
  });
});
