import { DEMO_TEAM, handoverRole, recipientFor, type Autonomy, type Proposal, type Workflow, type WorkflowRun } from '@compass/contracts';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { MemoryStorage } from '@earendil-works/pi-durable/storage/memory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HotelData } from '../src/application/hotel-data.ts';
import { handOver, recordDecision, undoDecision } from '../src/application/workflows/decisions.ts';
import { MemoryWorkflowStore } from '../src/application/workflows/memory-store.ts';
import { createWorkflowExtension, DecisionSignal } from '../src/application/workflows/workflow-tools.ts';
import { openPostgres, type PostgresDb } from '../src/infrastructure/postgres.ts';

const NOW = () => new Date('2026-11-20T07:15:00.000Z');
const BY = 'Compass user (web)';

const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  id: 'prop-1',
  workflowId: 'tpl-pace-guard',
  runId: 'run-1',
  hotel_code: 'LIS',
  action: 'adjust_bar',
  title: "Lower BAR on Lisbon's most overpriced nights to 1.2x comp median",
  rationale: 'LIS has 2,231 room nights on the books against 2,700 last year.',
  change: { before: 'BAR 145–220 EUR', after: 'Cap at about 1.2x comp median', scope: 'LIS, 2026-11-20 to 2027-01-03' },
  impact_eur: 38187,
  risk: 'high',
  status: 'pending',
  createdAt: '2026-11-20T05:02:00.000Z',
  decidedBy: null,
  decidedAt: null,
  note: null,
  ...over,
});
const stored = (over: Partial<Proposal> = {}) => {
  const store = new MemoryWorkflowStore();
  const p = proposal(over);
  store.proposals.set(p.id, p);
  return { store, p };
};

describe('the demo roster', () => {
  it('names a revenue manager and a general manager for every hotel, on a reserved domain', () => {
    expect(Object.keys(DEMO_TEAM)).toHaveLength(20);
    const people = Object.values(DEMO_TEAM).flatMap((t) => [t.revenueManager, t.gm]);
    expect(new Set(people.map((m) => m.name)).size).toBe(40);
    for (const member of people) expect(member.email).toMatch(/^[a-z]+(\.[a-z]+)+@halcyon\.example\.com$/);
    expect(DEMO_TEAM['LIS']).toEqual({ hotel: 'Arbor Lisbon Chiado', revenueManager: { name: 'Ana Pop', email: 'ana.pop@halcyon.example.com' }, gm: { name: 'Miguel Faria', email: 'miguel.faria@halcyon.example.com' } });
    expect(DEMO_TEAM['DOH']!.revenueManager.email).toBe('noor.al.sayed@halcyon.example.com');
  });

  it('sends rates, channels and accounts to the revenue manager, and house tasks to the general manager', () => {
    expect((['adjust_bar', 'close_channel', 'open_channel', 'contact_account', 'email'] as const).map(handoverRole)).toEqual(Array(5).fill('revenue_manager'));
    expect((['create_task', 'notify'] as const).map(handoverRole)).toEqual(['general_manager', 'general_manager']);
    expect(recipientFor('lis', 'adjust_bar')).toEqual({ name: 'Ana Pop', email: 'ana.pop@halcyon.example.com', role: 'revenue_manager', roleLabel: 'Revenue manager', hotel: 'Arbor Lisbon Chiado', hotel_code: 'LIS' });
    expect(recipientFor('DPS', 'create_task')).toMatchObject({ name: 'Made Surya', role: 'general_manager', roleLabel: 'General manager', hotel: 'Lumen Bali Uluwatu' });
    expect(recipientFor('XXX', 'adjust_bar')).toBeNull();
  });

  describe('against the hotel database', () => {
    process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);
    let db: PostgresDb;
    beforeAll(() => void (db = openPostgres(process.env['DATABASE_URL']!)));
    afterAll(() => db.close());

    it('covers exactly the group’s hotels, under their own names', async () => {
      const hotels = await new HotelData(db).hotelRefs();
      if (!hotels.ok) throw new Error('hotelRefs failed');
      expect(Object.fromEntries(Object.entries(DEMO_TEAM).map(([code, t]) => [code, t.hotel]))).toEqual(Object.fromEntries(hotels.value.map((h) => [h.code, h.name])));
    });
  });
});

describe('sending a decision on', () => {
  it('hands it to the hotel’s revenue manager as a task, logs it with the recipient and returns the receipt', async () => {
    const { store, p } = stored();
    const outcome = await recordDecision(store, p, { approved: true, by: BY, note: '' }, NOW);
    expect(outcome.handedTo).toEqual({ name: 'Ana Pop', email: 'ana.pop@halcyon.example.com', role: 'revenue_manager', roleLabel: 'Revenue manager', hotel: 'Arbor Lisbon Chiado', hotel_code: 'LIS' });
    expect(outcome.proposal).toMatchObject({ id: 'prop-1', status: 'applied', decidedBy: BY, decidedAt: '2026-11-20T07:15:00.000Z', note: null });
    expect(outcome.receipt).toMatch(/^RMS task rms-\S+ for Ana Pop \(Revenue manager, Arbor Lisbon Chiado\): Lower BAR on Lisbon's most overpriced nights/);
    expect(store.proposals.get('prop-1')).toEqual(outcome.proposal);
    expect(store.audit).toEqual([
      { id: expect.stringMatching(/^audit-/), at: '2026-11-20T07:15:00.000Z', workflowId: 'tpl-pace-guard', proposalId: 'prop-1', hotel_code: 'LIS', action: 'adjust_bar', by: BY, outcome: 'sent_to_rms', receipt: outcome.receipt, handedTo: outcome.handedTo },
    ]);
  });

  it('keeps the note the person wrote, and the name of a deleted agent', async () => {
    const { store, p } = stored({ deletedWorkflowName: 'Pace guard' });
    const outcome = await recordDecision(store, p, { approved: true, by: BY, note: 'only midweek' }, NOW);
    expect(outcome.proposal.note).toBe('only midweek');
    expect(store.audit[0]!.deletedWorkflowName).toBe('Pace guard');
  });

  it('a task for the house goes to the general manager', async () => {
    const { store, p } = stored({ hotel_code: 'DPS', action: 'create_task', risk: 'low', title: 'Add kitchen shifts' });
    const outcome = await recordDecision(store, p, { approved: true, by: BY, note: '' }, NOW);
    expect(outcome.handedTo).toMatchObject({ name: 'Made Surya', roleLabel: 'General manager', hotel: 'Lumen Bali Uluwatu' });
    expect(outcome.receipt).toContain('for Made Surya (General manager, Lumen Bali Uluwatu)');
  });

  it('a hotel without a roster is still handed over, to nobody by name', async () => {
    const { store, p } = stored({ hotel_code: 'OPO' });
    const outcome = await recordDecision(store, p, { approved: true, by: BY, note: '' }, NOW);
    expect(outcome.handedTo).toBeNull();
    expect(outcome.receipt).toMatch(/^RMS task rms-\S+ for the revenue manager \(OPO\): /);
    expect(store.audit[0]).not.toHaveProperty('handedTo');
  });

  it('is written once: handing the same proposal over again returns the same receipt', async () => {
    const { store, p } = stored();
    const first = await recordDecision(store, p, { approved: true, by: BY, note: '' }, NOW);
    const again = await handOver(store, store.proposals.get('prop-1')!, 'someone else', NOW);
    expect(again.receipt).toBe(first.receipt);
    expect(again.proposal.decidedBy).toBe(BY);
    expect(store.audit).toHaveLength(1);
  });
});

describe('dismissing a decision', () => {
  it('sends nothing, and says so in the audit log', async () => {
    const { store, p } = stored();
    const outcome = await recordDecision(store, p, { approved: false, by: BY, note: '' }, NOW);
    expect(outcome).toMatchObject({ handedTo: null, receipt: 'Dismissed. Nothing was sent.', proposal: { status: 'denied', decidedBy: BY, decidedAt: '2026-11-20T07:15:00.000Z' } });
    expect(store.audit).toHaveLength(1);
    expect(store.audit[0]).toMatchObject({ proposalId: 'prop-1', outcome: 'dismissed', by: BY, receipt: 'Dismissed. Nothing was sent.' });
    expect(store.audit[0]).not.toHaveProperty('handedTo');
  });
});

describe('taking a decision back', () => {
  it('a sent one: the same person gets a task to reverse it, and the proposal reads undone', async () => {
    const { store, p } = stored();
    await recordDecision(store, p, { approved: true, by: BY, note: '' }, NOW);
    const undone = await undoDecision(store, store.proposals.get('prop-1')!, BY, NOW);
    if ('error' in undone) throw new Error(undone.error);
    expect(undone.proposal.status).toBe('undone');
    expect(undone.entry).toMatchObject({ outcome: 'undone', by: BY, handedTo: { name: 'Ana Pop' }, receipt: expect.stringMatching(/^RMS task to reverse it, for Ana Pop \(Revenue manager, Arbor Lisbon Chiado\): /) });
    expect(store.audit.map((a) => a.outcome)).toEqual(['sent_to_rms', 'undone']);
  });

  it('a dismissed one: it waits for a decision again, and can then be sent', async () => {
    const { store, p } = stored();
    await recordDecision(store, p, { approved: false, by: BY, note: '' }, NOW);
    const undone = await undoDecision(store, store.proposals.get('prop-1')!, BY, NOW);
    if ('error' in undone) throw new Error(undone.error);
    expect(undone.proposal).toMatchObject({ status: 'pending', decidedBy: null, decidedAt: null });
    expect(undone.entry).toMatchObject({ outcome: 'undone', receipt: 'The dismissal was taken back. The suggestion waits for a decision again.' });
    expect(undone.entry).not.toHaveProperty('handedTo');
    const sent = await recordDecision(store, store.proposals.get('prop-1')!, { approved: true, by: BY, note: '' }, NOW);
    expect(sent.proposal.status).toBe('applied');
    expect(store.audit.map((a) => a.outcome)).toEqual(['dismissed', 'undone', 'sent_to_rms']);
    // The handover is the entry "already applied" reads back, not the dismissal before it.
    expect((await store.auditForProposal('prop-1'))?.outcome).toBe('sent_to_rms');
  });

  it('refuses what cannot be taken back: a decision still waiting, or one already undone', async () => {
    const { store, p } = stored();
    expect(await undoDecision(store, p, BY, NOW)).toEqual({ error: 'Only a decision that was sent or dismissed can be taken back.', status: 409 });
    expect(await undoDecision(store, proposal({ status: 'undone' }), BY, NOW)).toMatchObject({ status: 409 });
    expect(store.audit).toHaveLength(0);
  });
});

// With the agent: the person's decision is recorded when they make it; the parked agent then only learns of it.
describe('the agent behind a decision that was already recorded', () => {
  const context = BACKGROUND_CONTEXT;
  const ARGS = { hotel_code: 'DXB2', action: 'adjust_bar', title: 'Raise BAR for Gulf Tech Week', rationale: 'BAR is 0.78x the comp set median on 16–18 Dec.', before: '665–790 AED', after: '900–1,050 AED', scope: '16–18 Dec 2026', impact_eur: 42677, risk: 'high' };

  async function parked(autonomy: Autonomy = 'approve') {
    const faux = fauxProvider();
    const models = createModels();
    models.setProvider(faux.provider);
    const store = new MemoryWorkflowStore();
    const registry = createRegistry();
    registry.install(createWorkflowExtension(store, NOW));
    const harness = await Harness.open(new MemoryStorage(), { models, registry }, context);
    const model = faux.getModel();
    const root = await harness.root(context, { agent: { model: { provider: model.provider, modelId: model.id } } });
    const workflow: Workflow = { id: 'wf-dubai', name: 'Event pricing watch', description: '', hotels: ['DXB2'], trigger: { kind: 'manual' }, goal: 'Price event nights to the market.', checks: [], action: { type: 'adjust_bar', guidance: '' }, approver: 'revenue_manager', autonomy, enabled: true, createdAt: '2026-11-20T05:00:00Z', createdBy: 'template', lastRun: null };
    const run: WorkflowRun = { id: 'run-1', workflowId: workflow.id, sessionId: String(root.id), trigger: 'manual', status: 'running', startedAt: '2026-11-20T05:00:00Z', endedAt: null, summary: null };
    store.workflows.set(workflow.id, workflow);
    store.runs.set(run.id, run);
    return { faux, harness, root, store };
  }
  const lastToolText = (ctx: { messages: { role: string; content?: unknown }[] }) => {
    const last = ctx.messages.at(-1);
    return last?.role === 'toolResult' ? JSON.stringify(last.content) : '';
  };

  it('sent: the agent is told it is already handed over, and applying again changes nothing', async () => {
    const { faux, harness, root, store } = await parked();
    const heard: string[] = [];
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('propose_action', ARGS), { stopReason: 'toolUse' }),
      (ctx) => {
        heard.push(lastToolText(ctx));
        const id = [...store.proposals.keys()][0]!;
        return fauxAssistantMessage(fauxToolCall('apply_action', { proposal_id: id }), { stopReason: 'toolUse' });
      },
      (ctx) => {
        heard.push(lastToolText(ctx));
        return fauxAssistantMessage(fauxText('Done.'));
      },
    ]);
    const submission = await root.submit({ type: 'input', content: 'Run.' }, context);
    await expect.poll(() => [...store.proposals.values()][0]?.status, { timeout: 5000 }).toBe('pending');
    const pending = [...store.proposals.values()][0]!;

    const outcome = await recordDecision(store, pending, { approved: true, by: BY, note: '' }, NOW);
    expect(outcome.handedTo).toMatchObject({ name: 'Rania Aziz', hotel: 'Tessera Dubai Business Bay' });
    await harness.signal(store.taskOf(pending.id)!, DecisionSignal, 'decision', { approved: true, by: BY, note: '' }, context);
    await submission.wait(context);

    expect(heard[0]).toContain('already handed over');
    expect(heard[1]).toContain('Already applied');
    expect(store.proposals.get(pending.id)).toMatchObject({ status: 'applied', decidedBy: BY });
    expect(store.audit).toHaveLength(1);
    expect(store.audit[0]).toMatchObject({ outcome: 'sent_to_rms', handedTo: { name: 'Rania Aziz' } });
    await harness.close(context);
  });

  it('dismissed, then taken back before the agent wakes: the agent does not dismiss it again', async () => {
    const { faux, harness, root, store } = await parked();
    let heard = '';
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('propose_action', ARGS), { stopReason: 'toolUse' }),
      (ctx) => {
        heard = lastToolText(ctx);
        return fauxAssistantMessage(fauxText('It was dismissed.'));
      },
    ]);
    const submission = await root.submit({ type: 'input', content: 'Run.' }, context);
    await expect.poll(() => [...store.proposals.values()][0]?.status, { timeout: 5000 }).toBe('pending');
    const pending = [...store.proposals.values()][0]!;

    await recordDecision(store, pending, { approved: false, by: BY, note: '' }, NOW);
    await undoDecision(store, store.proposals.get(pending.id)!, BY, NOW);
    await harness.signal(store.taskOf(pending.id)!, DecisionSignal, 'decision', { approved: false, by: BY, note: '' }, context);
    await submission.wait(context);

    expect(heard).toContain('Declined by');
    expect(store.proposals.get(pending.id)!.status).toBe('pending');
    await harness.close(context);
  });

  it('an action the agent applies on its own is logged with who got it', async () => {
    const { faux, harness, root, store } = await parked('auto_low_risk');
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('propose_action', { ...ARGS, action: 'create_task', risk: 'low', title: 'Check the event calendar' }), { stopReason: 'toolUse' }),
      () => fauxAssistantMessage(fauxToolCall('apply_action', { proposal_id: [...store.proposals.keys()][0]! }), { stopReason: 'toolUse' }),
      fauxAssistantMessage(fauxText('Done.')),
    ]);
    await (await root.submit({ type: 'input', content: 'Run.' }, context)).wait(context);
    expect(store.audit).toHaveLength(1);
    expect(store.audit[0]).toMatchObject({ outcome: 'sent_to_rms', by: 'auto (low risk)', handedTo: { name: 'Samir Khoury', roleLabel: 'General manager' } });
    expect([...store.proposals.values()][0]!.status).toBe('applied');
    await harness.close(context);
  });
});
