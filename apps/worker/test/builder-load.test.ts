import type { Workflow } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { loadedEntry, savePlan, unmaskPatch } from '../src/application/workflows/builder-edits.ts';
import { clientDraft, draftIssues, draftOfWorkflow } from '../src/application/workflows/draft.ts';
import { isWorkflowId } from '../src/presentation/http/routes.ts';

// "Edit" on a workflow opens it in the builder: the server loads the workflow into the draft with its real address,
// and the client sees the address masked until the person types another one.

const REAL = 'silviu@example.com';
const MASKED = 'si****@example.com';
const workflow: Workflow = {
  id: 'wf-1', name: 'Lisbon pace watch', description: 'Watches Lisbon.', hotels: ['LIS'], trigger: { kind: 'schedule', every: 'day' },
  goal: 'Email me when Lisbon is more than 10% behind last year.', checks: ['get_pace'], action: { type: 'email', guidance: 'Keep it short.' },
  delivery: { channel: 'email', to: REAL }, approver: 'revenue_manager', autonomy: 'approve', enabled: true,
  createdAt: '2026-11-01T08:00:00.000Z', createdBy: 'kassandra', lastRun: { runId: 'run-1', at: '2026-11-20T05:00:00.000Z', status: 'done' }, emailsSent: 3,
};

describe('draftOfWorkflow', () => {
  it('takes the spec of the workflow, with the real address, and nothing of its history', () => {
    const draft = draftOfWorkflow(workflow);
    expect(draft).toEqual({
      name: 'Lisbon pace watch', description: 'Watches Lisbon.', hotels: ['LIS'], trigger: { kind: 'schedule', every: 'day' },
      goal: 'Email me when Lisbon is more than 10% behind last year.', checks: ['get_pace'], action: { type: 'email', guidance: 'Keep it short.' },
      delivery: { channel: 'email', to: REAL }, approver: 'revenue_manager', autonomy: 'approve', enabled: true,
    });
    expect(draftIssues(draft)).toEqual([]);
  });

  it('has no delivery for a workflow that sends no email', () => {
    const { delivery: _none, ...rest } = workflow;
    expect('delivery' in draftOfWorkflow({ ...rest, action: { type: 'notify', guidance: '' } })).toBe(false);
  });
});

describe('clientDraft', () => {
  const draft = draftOfWorkflow(workflow);

  it('masks the address that came from the saved workflow', () => {
    expect(clientDraft(draft, REAL).delivery).toEqual({ channel: 'email', to: MASKED });
    expect(clientDraft(draft, REAL).name).toBe('Lisbon pace watch');
    expect(draft.delivery?.to).toBe(REAL);
  });

  it('shows an address the person typed in this draft in full', () => {
    expect(clientDraft({ ...draft, delivery: { channel: 'email', to: 'ana@example.com' } }, REAL).delivery?.to).toBe('ana@example.com');
    expect(clientDraft(draft, null).delivery?.to).toBe(REAL);
  });

  it('masks whatever the letter case, and leaves a draft without an address alone', () => {
    expect(clientDraft({ ...draft, delivery: { channel: 'email', to: 'Silviu@Example.com' } }, REAL).delivery?.to).toBe('Si****@Example.com');
    const { delivery: _none, ...without } = draft;
    expect(clientDraft(without, REAL)).toEqual(without);
  });
});

describe('unmaskPatch', () => {
  it('reads the masked address sent back by the client as the saved one', () => {
    expect(unmaskPatch({ name: 'New name', delivery: { channel: 'email', to: MASKED } }, REAL)).toEqual({
      name: 'New name',
      delivery: { channel: 'email', to: REAL },
    });
  });

  it('leaves another address, a removed address and a draft that was not loaded as they are', () => {
    const other = { delivery: { channel: 'email' as const, to: 'ana@example.com' } };
    expect(unmaskPatch(other, REAL)).toEqual(other);
    expect(unmaskPatch({ delivery: undefined }, REAL)).toEqual({ delivery: undefined });
    expect(unmaskPatch({ delivery: { channel: 'email', to: MASKED } }, null)).toEqual({ delivery: { channel: 'email', to: MASKED } });
  });
});

describe('saving a loaded workflow', () => {
  const loaded = draftOfWorkflow(workflow);

  it('has nothing to save until something changes', () => {
    expect(savePlan(loaded, loaded, 'wf-1')).toEqual({ kind: 'none' });
  });

  it('updates the same workflow when the address is the same, and never sends the address', () => {
    const plan = savePlan({ ...loaded, trigger: { kind: 'schedule', every: 'week' } }, loaded, 'wf-1');
    expect(plan.kind).toBe('update');
    if (plan.kind === 'update') {
      expect(plan.patch.trigger).toEqual({ kind: 'schedule', every: 'week' });
      expect('delivery' in plan.patch).toBe(false);
    }
  });

  it('makes a new workflow when the person types another address', () => {
    expect(savePlan({ ...loaded, delivery: { channel: 'email', to: 'ana@example.com' } }, loaded, 'wf-1')).toEqual({ kind: 'replace' });
  });
});

describe('loadedEntry', () => {
  it('tells the agent which workflow was opened and how its chain reads, with the address masked', () => {
    const entry = loadedEntry(draftOfWorkflow(workflow), 1_700_000_000_000);
    expect(entry.kind).toBe('app.loaded');
    const text = JSON.stringify(entry);
    expect(text).toContain('(I opened the saved workflow \\"Lisbon pace watch\\" to edit it.');
    expect(text).toContain(MASKED);
    expect(text).not.toContain(REAL);
  });
});

describe('isWorkflowId', () => {
  it.each([
    ['wf-1a2b3c4d', true],
    ['tpl-event-pricing', true],
    ['', false],
    ['wf 1', false],
    ['../x', false],
    ['x'.repeat(65), false],
  ])('%s → %s', (id, valid) => {
    expect(isWorkflowId(id)).toBe(valid);
  });
});
