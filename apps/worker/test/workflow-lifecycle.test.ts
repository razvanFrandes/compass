import type { AuditEntry, Proposal, Workflow, WorkflowRun } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { duplicateOf, removeWorkflow } from '../src/application/workflows/lifecycle.ts';
import { DurableWorkflowStore } from '../src/infrastructure/do-workflow-store.ts';
import { corsHeaders, preflight } from '../src/presentation/http/cors.ts';
import { FakeStorage } from './fixtures/fake-storage.ts';

const workflow = (over: Partial<Workflow> = {}): Workflow => ({
  id: 'wf-1', name: 'Lisbon pace watch', description: 'Watches Lisbon.', hotels: ['LIS'], trigger: { kind: 'schedule', every: 'day' },
  goal: 'Email me when Lisbon is more than 10% behind last year.', checks: ['get_pace'], action: { type: 'email', guidance: '' },
  delivery: { channel: 'email', to: 'silviu@example.com' }, approver: 'revenue_manager', autonomy: 'approve', enabled: true,
  createdAt: '2026-11-01T08:00:00.000Z', createdBy: 'kassandra', lastRun: { runId: 'run-1', at: '2026-11-20T05:00:00.000Z', status: 'done' }, emailsSent: 3,
  ...over,
});
const run = (id: string, workflowId: string, status: WorkflowRun['status'] = 'done'): WorkflowRun => ({
  id, workflowId, sessionId: `s-${id}`, trigger: 'brief', status, startedAt: '2026-11-20T05:00:00.000Z', endedAt: null, summary: null,
});
const proposal = (id: string, workflowId: string, runId: string, status: Proposal['status'] = 'applied'): Proposal => ({
  id, workflowId, runId, hotel_code: 'DXB2', action: 'adjust_bar', title: 'Raise BAR', rationale: 'Below the comp set.',
  change: { before: '665', after: '820', scope: '16–18 Dec' }, impact_eur: 12000, risk: 'high', status, createdAt: '2026-11-20T05:01:00.000Z',
  decidedBy: null, decidedAt: null, note: null,
});
const audit = (id: string, workflowId: string): AuditEntry => ({
  id, at: `2026-11-20T05:0${id.at(-1)}:00.000Z`, workflowId, proposalId: 'prop-a', hotel_code: 'DXB2', action: 'adjust_bar', by: 'Ana Pop', outcome: 'sent_to_rms', receipt: 'RMS task',
});

describe('duplicateOf', () => {
  it('copies the workflow as a new one made by a person, turned off, named "(copy)", with nothing of its history', () => {
    const copy = duplicateOf(workflow(), 'wf-2', '2026-11-21T09:00:00.000Z');
    expect(copy).toEqual({
      ...workflow(),
      id: 'wf-2',
      name: 'Lisbon pace watch (copy)',
      enabled: false,
      createdBy: 'user',
      createdAt: '2026-11-21T09:00:00.000Z',
      lastRun: null,
      emailsSent: undefined,
    });
    expect('emailsSent' in copy).toBe(false);
  });

  it('keeps the name within 80 characters', () => {
    const copy = duplicateOf(workflow({ name: 'x'.repeat(80) }), 'wf-2', '2026-11-21T09:00:00.000Z');
    expect(copy.name).toHaveLength(80);
    expect(copy.name.endsWith(' (copy)')).toBe(true);
  });

  it('copies a template as a workflow of the person', () => {
    expect(duplicateOf(workflow({ createdBy: 'template', id: 'tpl-pace-guard' }), 'wf-9', '2026-11-21T09:00:00.000Z').createdBy).toBe('user');
  });
});

describe('removeWorkflow', () => {
  async function seeded() {
    const storage = new FakeStorage();
    const store = new DurableWorkflowStore(storage as unknown as DurableObjectStorage);
    await store.putWorkflow(workflow({ id: 'wf-1', name: 'Event pricing watch' }));
    await store.putWorkflow(workflow({ id: 'wf-2', name: 'Pace guard' }));
    await store.putRun(run('run-a', 'wf-1'));
    await store.putRun(run('run-b', 'wf-2'));
    await store.saveProposal(proposal('prop-a', 'wf-1', 'run-a'), 'task-a' as never);
    await store.saveProposal(proposal('prop-b', 'wf-2', 'run-b'), 'task-b' as never);
    await store.appendAudit(audit('audit-1', 'wf-1'));
    await store.appendAudit(audit('audit-2', 'wf-2'));
    return { storage, store };
  }

  it('removes the workflow and keeps its runs, proposals and audit entries, marked with the name it had', async () => {
    const { storage, store } = await seeded();
    const before = storage.data.size;
    expect(await removeWorkflow(store, 'wf-1')).toEqual({ ok: true, value: { name: 'Event pricing watch' } });

    expect(await store.getWorkflow('wf-1')).toBeUndefined();
    expect(storage.data.size).toBe(before - 1);
    expect((await store.getRun('run-a'))?.deletedWorkflowName).toBe('Event pricing watch');
    expect((await store.getProposal('prop-a'))?.deletedWorkflowName).toBe('Event pricing watch');
    expect((await store.listAudit()).find((entry) => entry.id === 'audit-1')?.deletedWorkflowName).toBe('Event pricing watch');
    // The proposal still finds the task it was created by, so its record stays whole.
    expect(await store.taskForProposal('prop-a')).toBe('task-a');
  });

  it('leaves the other workflows and what belongs to them untouched', async () => {
    const { store } = await seeded();
    await removeWorkflow(store, 'wf-1');
    expect((await store.getWorkflow('wf-2'))?.name).toBe('Pace guard');
    expect((await store.getRun('run-b'))?.deletedWorkflowName).toBeUndefined();
    expect((await store.getProposal('prop-b'))?.deletedWorkflowName).toBeUndefined();
    expect((await store.listAudit()).find((entry) => entry.id === 'audit-2')?.deletedWorkflowName).toBeUndefined();
    expect(await store.listAudit()).toHaveLength(2);
  });

  it('answers 404 for a workflow that is not there', async () => {
    const { store } = await seeded();
    expect(await removeWorkflow(store, 'wf-9')).toEqual({ ok: false, error: { error: 'That agent no longer exists.', status: 404 } });
  });

  it.each(['running', 'waiting_approval'] as const)('refuses while a run of it is %s: the run would lose its workflow', async (status) => {
    const { store } = await seeded();
    await store.putRun(run('run-c', 'wf-1', status));
    const result = await removeWorkflow(store, 'wf-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(409);
    expect(await store.getWorkflow('wf-1')).toBeDefined();
    expect((await store.getRun('run-a'))?.deletedWorkflowName).toBeUndefined();
  });
});

describe('CORS for the dev server', () => {
  it('allows DELETE in a preflight, for deleting a workflow from the Angular dev server', () => {
    const ok = preflight(new Request('https://juyo.razvanfrandes.com/api/workflows/wf-1', { method: 'OPTIONS', headers: { Origin: 'http://localhost:4200' } }));
    expect(ok?.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PATCH, DELETE, OPTIONS');
    expect(corsHeaders('https://evil.example')).toEqual({});
  });
});
