import type { Brief, BriefItem, Workflow } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { briefHits, MAX_SEED_RUNS, seedCandidates, seedRuns, type SeedDeps } from '../src/application/workflows/seed.ts';
import { templateWorkflows } from '../src/application/workflows/templates.ts';

// Brief-triggered workflows that never ran run once on first use, so the Inbox opens with a real pending proposal
// (Dubai's event nights priced under the market) instead of waiting for the next 05:00 cron.

const item = (kind: BriefItem['kind'], hotel_code: string): BriefItem => ({
  id: `${kind}:${hotel_code}`, kind, hotel_code, hotel_name: hotel_code, severity: 'warning', impact_eur: -1000, impact_basis: '', title: '', facts: {}, question: '', sources: [],
});
const brief = (...items: BriefItem[]): Brief => ({ businessDate: '2026-11-20', generatedAt: '2026-11-20T05:00:00.000Z', items, model: null, usage: { tokens: 0, costUsd: 0 } });
const templates = () => templateWorkflows('2026-11-20T00:00:00.000Z');
const byId = (id: string) => templates().find((workflow) => workflow.id === id)!;
const DUBAI = brief(item('underpriced_demand', 'DXB2'), item('pace_behind', 'LIS'));

describe('briefHits', () => {
  it('finds the findings of the workflow\'s kind for its hotels', () => {
    expect(briefHits(byId('tpl-event-pricing'), DUBAI).map((hit) => hit.hotel_code)).toEqual(['DXB2']);
    expect(briefHits({ ...byId('tpl-event-pricing'), hotels: ['LIS'] }, DUBAI)).toEqual([]);
    expect(briefHits({ ...byId('tpl-event-pricing'), hotels: ['DXB2', 'LIS'] }, DUBAI)).toHaveLength(1);
  });

  it('finds nothing for a workflow that does not wait for the brief', () => {
    expect(briefHits({ ...byId('tpl-event-pricing'), trigger: { kind: 'manual' } }, DUBAI)).toEqual([]);
  });
});

describe('seedCandidates', () => {
  const never = () => false;

  it('picks the enabled brief-triggered workflows that never ran and have a finding today, with the reason', () => {
    expect(seedCandidates(templates(), never, DUBAI)).toEqual([
      { workflowId: 'tpl-event-pricing', reason: 'brief finding underpriced_demand for DXB2' },
      { workflowId: 'tpl-pace-guard', reason: 'brief finding pace_behind for LIS' },
    ]);
  });

  it('leaves out a workflow that ran before, one that is off, and one with no finding today', () => {
    expect(seedCandidates(templates(), (id) => id === 'tpl-event-pricing', DUBAI).map((c) => c.workflowId)).toEqual(['tpl-pace-guard']);
    const off = templates().map((w) => (w.id === 'tpl-pace-guard' ? { ...w, enabled: false } : w));
    expect(seedCandidates(off, never, DUBAI).map((c) => c.workflowId)).toEqual(['tpl-event-pricing']);
    expect(seedCandidates(templates(), never, brief())).toEqual([]);
  });

  it('never seeds an email workflow: nobody should get mail because someone opened the app', () => {
    const email: Workflow = { ...byId('tpl-event-pricing'), id: 'wf-mail', action: { type: 'email', guidance: '' }, delivery: { channel: 'email', to: 'a@example.com' } };
    expect(seedCandidates([email], never, DUBAI)).toEqual([]);
  });

  it('starts the templates first and at most five runs', () => {
    expect(MAX_SEED_RUNS).toBe(5);
    const mine = Array.from({ length: 6 }, (_, i): Workflow => ({ ...byId('tpl-event-pricing'), id: `wf-${i}`, createdBy: 'user', createdAt: '2026-11-01T00:00:00.000Z' }));
    const picked = seedCandidates([...mine, ...templates()], never, DUBAI).map((c) => c.workflowId);
    expect(picked).toEqual(['tpl-event-pricing', 'tpl-pace-guard', 'wf-0', 'wf-1', 'wf-2']);
  });
});

describe('seedRuns', () => {
  function world(over: Partial<SeedDeps> = {}) {
    const state = { done: false, ran: [] as string[], budget: 10, briefReads: 0 };
    const deps: SeedDeps = {
      done: async () => state.done,
      markDone: async () => void (state.done = true),
      workflows: async () => templates(),
      hasRun: async (id) => state.ran.includes(id),
      brief: async () => (state.briefReads++, DUBAI),
      takeBudget: async () => state.budget-- > 0,
      run: async (id) => (state.ran.push(id), true),
      ...over,
    };
    return { state, deps };
  }

  it('runs each candidate once and remembers that it seeded', async () => {
    const { state, deps } = world();
    expect(await seedRuns(deps)).toEqual({ status: 'seeded', started: ['tpl-event-pricing', 'tpl-pace-guard'] });
    expect(state.done).toBe(true);
    expect(state.budget).toBe(8);
  });

  it('does nothing the second time, without reading the brief or the budget', async () => {
    const { state, deps } = world();
    await seedRuns(deps);
    expect(await seedRuns(deps)).toEqual({ status: 'already', started: [] });
    expect(state.ran).toEqual(['tpl-event-pricing', 'tpl-pace-guard']);
    expect(state.briefReads).toBe(1);
    expect(state.budget).toBe(8);
  });

  it('stops when the daily budget of workflow runs is spent, and tries the rest another time', async () => {
    const { state, deps } = world();
    state.budget = 1;
    expect(await seedRuns(deps)).toEqual({ status: 'budget', started: ['tpl-event-pricing'] });
    expect(state.done).toBe(false);
    state.budget = 5;
    expect(await seedRuns(deps)).toEqual({ status: 'seeded', started: ['tpl-pace-guard'] });
    expect(state.ran).toEqual(['tpl-event-pricing', 'tpl-pace-guard']);
  });

  it('is done even when a run could not start: it does not try again on every visit', async () => {
    const { state, deps } = world({ run: async () => false });
    expect(await seedRuns(deps)).toEqual({ status: 'seeded', started: [] });
    expect(state.done).toBe(true);
  });

  it('is done at once when nothing needs a first run, spending nothing', async () => {
    const { state, deps } = world({ brief: async () => brief() });
    expect(await seedRuns(deps)).toEqual({ status: 'seeded', started: [] });
    expect(state.budget).toBe(10);
    expect(state.done).toBe(true);
  });

  it('reports a brief that cannot be read and leaves the seed for later', async () => {
    const { state, deps } = world({
      brief: async () => {
        throw new Error('db down');
      },
    });
    expect(await seedRuns(deps)).toEqual({ status: 'failed', started: [] });
    expect(state.done).toBe(false);
  });
});
