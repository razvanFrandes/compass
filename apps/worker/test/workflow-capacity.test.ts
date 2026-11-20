import type { Proposal, Workflow, WorkflowRun } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { admitWorkflow, mayEnable, MAX_STORED_WORKFLOWS, MAX_WORKFLOWS } from '../src/application/workflows/capacity.ts';
import { DurableWorkflowStore } from '../src/infrastructure/do-workflow-store.ts';
import { FakeStorage } from './fixtures/fake-storage.ts';

const FULL = 'The demo runs at most 30 agents at a time. Pause one and try again.';

const workflow = (n: number, over: Partial<Workflow> = {}): Workflow => ({
  id: `wf-${n}`, name: `Workflow ${n}`, description: '', hotels: ['ALL'], trigger: { kind: 'manual' },
  goal: 'Watch the pace of the group.', checks: [], action: { type: 'notify', guidance: '' }, approver: 'revenue_manager',
  autonomy: 'approve', enabled: true, createdAt: new Date(Date.UTC(2026, 10, 1, 0, n)).toISOString(), createdBy: 'user', lastRun: null,
  ...over,
});
const many = (count: number, over: Partial<Workflow> = {}, from = 0) => Array.from({ length: count }, (_, i) => workflow(from + i, over));

describe('admitWorkflow', () => {
  it('refuses a new workflow while 30 are enabled, and takes it once one is turned off', () => {
    expect(MAX_WORKFLOWS).toBe(30);
    const full = many(30);
    expect(admitWorkflow(full, true)).toEqual({ ok: false, error: FULL });
    const oneOff = full.map((w, i) => (i === 7 ? { ...w, enabled: false } : w));
    expect(admitWorkflow(oneOff, true)).toEqual({ ok: true, evict: [] });
  });

  it('does not count disabled workflows: 25 saved and turned off do not block a create', () => {
    const stored = [...many(5, { createdBy: 'template' }), ...many(25, { enabled: false }, 5)];
    expect(admitWorkflow(stored, true)).toEqual({ ok: true, evict: [] });
  });

  it('a workflow created turned off is taken even when 30 are enabled', () => {
    expect(admitWorkflow(many(30), false)).toEqual({ ok: true, evict: [] });
  });

  it('at 100 stored workflows, makes room by dropping the oldest disabled one a person or Kassandra made', () => {
    expect(MAX_STORED_WORKFLOWS).toBe(100);
    const stored = [
      workflow(0, { enabled: false, createdBy: 'template' }), // the oldest, but a template
      workflow(1), // older, but enabled
      workflow(2, { enabled: false, lastRun: { runId: 'run-1', at: '2026-11-01T00:00:00.000Z', status: 'waiting_approval' } }), // a run is waiting
      workflow(3, { enabled: false, createdBy: 'kassandra' }),
      workflow(4, { enabled: false }),
      ...many(95, { enabled: false }, 5),
    ];
    expect(stored).toHaveLength(100);
    expect(admitWorkflow(stored, true)).toEqual({ ok: true, evict: ['wf-3'] });
    expect(admitWorkflow(stored.slice(0, 99), true)).toEqual({ ok: true, evict: [] });
  });
});

describe('mayEnable', () => {
  it('refuses to turn a workflow on while 30 others are enabled', () => {
    const stored = [...many(30), workflow(30, { enabled: false })];
    expect(mayEnable(stored, 'wf-30')).toEqual({ ok: false, error: FULL });
    expect(mayEnable(stored.slice(1), 'wf-30')).toEqual({ ok: true });
    // A workflow that is already on stays on.
    expect(mayEnable(stored, 'wf-3')).toEqual({ ok: true });
  });
});

describe('DurableWorkflowStore.deleteWorkflow', () => {
  it('deletes the workflow with its runs, their email marks and its proposals, and nothing else', async () => {
    const storage = new FakeStorage();
    const store = new DurableWorkflowStore(storage as unknown as DurableObjectStorage);
    const run = (id: string, workflowId: string): WorkflowRun => ({
      id, workflowId, sessionId: `s-${id}`, trigger: 'manual', status: 'done', startedAt: '2026-11-20T06:00:00.000Z', endedAt: null, summary: null,
    });
    const proposal = (id: string, workflowId: string, runId: string) => ({ id, workflowId, runId, createdAt: '2026-11-20T06:00:00.000Z' }) as Proposal;
    for (const wf of [workflow(1), workflow(2)]) await store.putWorkflow(wf);
    await store.putRun(run('run-a', 'wf-1'));
    await store.putRun(run('run-b', 'wf-2'));
    await store.markEmailPending('run-a');
    await store.recordEmail('run-a', 'wf-1', 'Email msg-1', true);
    await store.recordEmail('run-b', 'wf-2', 'Email msg-2', true);
    await store.saveProposal(proposal('prop-a', 'wf-1', 'run-a'), 'task-a' as never);
    await store.saveProposal(proposal('prop-b', 'wf-2', 'run-b'), 'task-b' as never);

    await store.deleteWorkflow('wf-1');

    expect([...storage.data.keys()].sort()).toEqual(
      ['email:run-b', 'prop:prop-b', 'proptask:prop-b', 'run:run-b', 'session:s-run-b', 'task:task-b', 'wf:wf-2'].sort(),
    );
  });
});
