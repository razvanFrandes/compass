import type { Autonomy, Workflow, WorkflowRun } from '@compass/contracts';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { MemoryStorage } from '@earendil-works/pi-durable/storage/memory';
import { describe, expect, it } from 'vitest';
import { MemoryWorkflowStore } from '../src/application/workflows/memory-store.ts';
import { createWorkflowExtension, DecisionSignal } from '../src/application/workflows/workflow-tools.ts';

// The approval flow on a real pi-durable Harness with a scripted model: propose → park → a person decides
// (a durable signal) → the call resumes → apply → audit. No Cloudflare, no API key, no database.
const context = BACKGROUND_CONTEXT;

const PROPOSAL = {
  hotel_code: 'DXB2',
  action: 'adjust_bar',
  title: 'Raise BAR for Gulf Tech Week',
  rationale: 'BAR is 0.78x the comp set median on 16–18 Dec while three competitors are sold out.',
  before: '665–790 AED',
  after: '900–1,050 AED',
  scope: '16–18 Dec 2026, all room types',
  impact_eur: 42677,
  risk: 'high',
};

async function setup(autonomy: Autonomy) {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  const store = new MemoryWorkflowStore();
  const registry = createRegistry();
  registry.install(createWorkflowExtension(store));
  const harness = await Harness.open(new MemoryStorage(), { models, registry }, context);
  const model = faux.getModel();
  const root = await harness.root(context, { agent: { model: { provider: model.provider, modelId: model.id } } });

  const workflow: Workflow = {
    id: 'wf-dubai', name: 'Event pricing watch', description: '', hotels: ['DXB2'], trigger: { kind: 'manual' },
    goal: 'Price event nights to the market.', checks: [], action: { type: 'adjust_bar', guidance: '' },
    approver: 'revenue_manager', autonomy, enabled: true, createdAt: '2026-11-20T05:00:00Z', createdBy: 'template', lastRun: null,
  };
  const run: WorkflowRun = {
    id: 'run-1', workflowId: workflow.id, sessionId: String(root.id), trigger: 'manual', status: 'running',
    startedAt: '2026-11-20T05:00:00Z', endedAt: null, summary: null,
  };
  store.workflows.set(workflow.id, workflow);
  store.runs.set(run.id, run);
  return { faux, harness, root, store };
}

const lastToolText = (ctx: { messages: { role: string; content?: unknown }[] }) => {
  const last = ctx.messages.at(-1);
  return last?.role === 'toolResult' ? JSON.stringify(last.content) : '';
};

describe('workflow approval flow', () => {
  it('parks the proposal until a person approves, then applies it and writes the audit log', async () => {
    const { faux, harness, root, store } = await setup('approve');
    let afterDecision = '';
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('propose_action', PROPOSAL), { stopReason: 'toolUse' }),
      (ctx) => {
        afterDecision = lastToolText(ctx);
        const id = /proposal_id \\"([^\\"]+)\\"/.exec(afterDecision)?.[1] ?? '';
        return fauxAssistantMessage(fauxToolCall('apply_action', { proposal_id: id }), { stopReason: 'toolUse' });
      },
      fauxAssistantMessage(fauxText('Done: the rate change was sent to the RMS.')),
    ]);

    const submission = await root.submit({ type: 'input', content: 'Run the workflow now.' }, context);

    // The call parks: the proposal is pending, the run waits, and the model is not called again.
    await expect.poll(() => [...store.proposals.values()][0]?.status, { timeout: 5000 }).toBe('pending');
    const pending = [...store.proposals.values()][0]!;
    expect(pending).toMatchObject({ hotel_code: 'DXB2', action: 'adjust_bar', risk: 'high', impact_eur: 42677 });
    expect(store.runs.get('run-1')!.status).toBe('waiting_approval');
    expect(faux.state.callCount).toBe(1);

    // A person approves: a durable signal to the parked call.
    const taskId = store.taskOf(pending.id)!;
    expect(await harness.signal(taskId, DecisionSignal, 'decision', { approved: true, by: 'Ana (RM)', note: '' }, context)).toBe('delivered');

    const settled = await submission.wait(context);
    expect(settled.status).toBe('done');
    expect(afterDecision).toContain('Approved by Ana (RM)');
    expect(store.proposals.get(pending.id)).toMatchObject({ status: 'applied', decidedBy: 'Ana (RM)' });
    expect(store.audit).toHaveLength(1);
    expect(store.audit[0]).toMatchObject({ proposalId: pending.id, outcome: 'sent_to_rms', by: 'Ana (RM)' });
    await harness.close(context);
  });

  it('tells the model when a person denies, and applies nothing', async () => {
    const { faux, harness, root, store } = await setup('approve');
    let afterDecision = '';
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('propose_action', PROPOSAL), { stopReason: 'toolUse' }),
      (ctx) => {
        afterDecision = lastToolText(ctx);
        return fauxAssistantMessage(fauxText('Understood, no change.'));
      },
    ]);
    const submission = await root.submit({ type: 'input', content: 'Run the workflow now.' }, context);
    await expect.poll(() => [...store.proposals.values()][0]?.status, { timeout: 5000 }).toBe('pending');
    const pending = [...store.proposals.values()][0]!;
    await harness.signal(store.taskOf(pending.id)!, DecisionSignal, 'decision', { approved: false, by: 'Ana (RM)', note: 'Event demand is soft this year' }, context);
    await submission.wait(context);

    expect(afterDecision).toContain('Denied by Ana (RM)');
    expect(afterDecision).toContain('Event demand is soft this year');
    expect(store.proposals.get(pending.id)!.status).toBe('denied');
    expect(store.audit).toHaveLength(0);
    await harness.close(context);
  });

  it('only records a suggestion in suggest mode, without waiting', async () => {
    const { faux, harness, root, store } = await setup('suggest');
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('propose_action', PROPOSAL), { stopReason: 'toolUse' }),
      fauxAssistantMessage(fauxText('Suggestion recorded.')),
    ]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);
    expect([...store.proposals.values()][0]!.status).toBe('suggested');
    expect(store.audit[0]).toMatchObject({ outcome: 'suggested' });
    await harness.close(context);
  });

  it('acts alone on a low-risk action in auto_low_risk mode, but still asks for a high-risk one', async () => {
    const { faux, harness, root, store } = await setup('auto_low_risk');
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('propose_action', { ...PROPOSAL, action: 'notify', risk: 'low' }), { stopReason: 'toolUse' }),
      fauxAssistantMessage(fauxText('Notified.')),
    ]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);
    expect([...store.proposals.values()][0]!.status).toBe('auto_approved');
    await harness.close(context);
  });
});
