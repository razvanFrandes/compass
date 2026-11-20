import { changedNodes, maskEmail, specToGraph, WorkflowDraft, WorkflowSpec } from '@compass/contracts';
import { describe, expect, it } from 'vitest';

describe('specToGraph', () => {
  it('draws the empty chain from an empty draft', () => {
    const g = specToGraph({});
    expect(g.nodes.map((n) => n.id)).toEqual(['trigger', 'scope', 'check', 'analyze', 'action']);
    expect(g.nodes.every((n) => n.state === 'empty')).toBe(true);
    expect(g.edges).toEqual([{ from: 'trigger', to: 'scope' }, { from: 'scope', to: 'check' }, { from: 'check', to: 'analyze' }, { from: 'analyze', to: 'action' }]);
  });

  it('one node per check, in order', () => {
    const g = specToGraph({ checks: ['get_pace', 'get_rate_position'] });
    expect(g.nodes.map((n) => n.id)).toEqual(['trigger', 'scope', 'check:get_pace', 'check:get_rate_position', 'analyze', 'action']);
  });

  it('labels a known check, falls back to the tool name, and draws a repeated check once', () => {
    const g = specToGraph({ checks: ['get_pace', 'run_readonly_query', 'get_pace'] });
    expect(g.nodes.filter((n) => n.kind === 'check').map((n) => [n.id, n.label])).toEqual([
      ['check:get_pace', 'Pace vs last year'],
      ['check:run_readonly_query', 'run_readonly_query'],
    ]);
  });

  it('keeps the tool name of a check out of what the canvas shows', () => {
    const [pace] = specToGraph({ checks: ['get_pace'] }).nodes.filter((n) => n.kind === 'check');
    expect(pace).toMatchObject({ id: 'check:get_pace', label: 'Pace vs last year', detail: 'Read first on every run' });
    expect(`${pace!.label} ${pace!.detail}`).not.toContain('get_pace');
  });

  it('no approval node for email, an approval node for price actions', () => {
    expect(specToGraph({ action: { type: 'email' } }).nodes.some((n) => n.kind === 'approval')).toBe(false);
    expect(specToGraph({ action: { type: 'adjust_bar' }, autonomy: 'approve' }).nodes.map((n) => n.id)).toContain('approval');
  });

  it('puts the approval node between analyze and action, and leaves it out when the workflow only suggests', () => {
    const g = specToGraph({ action: { type: 'adjust_bar' } });
    expect(g.nodes.map((n) => n.id).slice(-3)).toEqual(['analyze', 'approval', 'action']);
    expect(g.edges.slice(-2)).toEqual([{ from: 'analyze', to: 'approval' }, { from: 'approval', to: 'action' }]);
    expect(specToGraph({ action: { type: 'adjust_bar' }, autonomy: 'suggest' }).nodes.some((n) => n.kind === 'approval')).toBe(false);
  });

  it('an email action without an address is a draft node', () => {
    expect(specToGraph({ action: { type: 'email' } }).nodes.find((n) => n.id === 'action')?.state).toBe('draft');
    expect(specToGraph({ action: { type: 'email' }, delivery: { channel: 'email', to: 'a@b.co' } }).nodes.find((n) => n.id === 'action')?.state).toBe('complete');
  });

  it('shows the recipient masked on the action node', () => {
    const action = specToGraph({ action: { type: 'email' }, delivery: { channel: 'email', to: 'silviu@gmail.com' } }).nodes.find((n) => n.id === 'action');
    expect(action?.label).toBe('Send an email to si****@gmail.com');
    expect(JSON.stringify(action)).not.toContain('silviu');
  });

  it('labels the trigger, the scope and the goal', () => {
    const label = (draft: WorkflowDraft, id: string) => specToGraph(draft).nodes.find((n) => n.id === id)?.label;
    expect(label({ trigger: { kind: 'schedule', every: 'day' } }, 'trigger')).toBe('Every morning, after the brief');
    expect(label({ trigger: { kind: 'brief', finding: 'pace_behind' } }, 'trigger')).toBe('When the brief finds a hotel behind last year’s pace');
    expect(label({ trigger: { kind: 'manual' } }, 'trigger')).toBe('Only when you run it');
    expect(label({ hotels: ['ALL'] }, 'scope')).toBe('All 20 hotels');
    expect(label({ hotels: ['LIS1', 'DXB2'] }, 'scope')).toBe('LIS1, DXB2');
    expect(label({ goal: 'Email me if pace falls 10% behind STLY.' }, 'analyze')).toBe('Kassandra looks for this');
  });

  it('a value that is not valid yet is a draft node', () => {
    const state = (draft: WorkflowDraft, id: string) => specToGraph(draft).nodes.find((n) => n.id === id)?.state;
    expect(state({ goal: 'too short' }, 'analyze')).toBe('draft');
    expect(state({ goal: 'Email me if pace falls 10% behind STLY.' }, 'analyze')).toBe('complete');
    expect(state({ hotels: [] }, 'scope')).toBe('empty');
    expect(state({ action: { type: 'notify' }, delivery: { channel: 'email', to: 'a@b.co' } }, 'action')).toBe('draft');
  });
});

describe('changedNodes', () => {
  it('lists added and relabelled nodes', () => {
    expect(changedNodes(specToGraph({}), specToGraph({ hotels: ['LIS1'] }))).toEqual(['scope']);
  });

  it('lists a new check and not the nodes that stayed the same', () => {
    const before = specToGraph({ hotels: ['LIS1'], checks: ['get_pace'] });
    expect(changedNodes(before, specToGraph({ hotels: ['LIS1'], checks: ['get_pace', 'get_pickup'] }))).toEqual(['check:get_pickup']);
    expect(changedNodes(before, before)).toEqual([]);
  });
});

describe('WorkflowSpec', () => {
  const base = { name: 'Lisbon pace', hotels: ['LIS1'], trigger: { kind: 'schedule', every: 'day' }, goal: 'Email me if pace falls 10% behind STLY.' };

  it('requires delivery exactly when the action is email', () => {
    expect(WorkflowSpec.safeParse({ ...base, action: { type: 'email' } }).success).toBe(false);
    expect(WorkflowSpec.safeParse({ ...base, action: { type: 'email' }, delivery: { channel: 'email', to: 'a@b.co' } }).success).toBe(true);
    expect(WorkflowSpec.safeParse({ ...base, action: { type: 'notify' }, delivery: { channel: 'email', to: 'a@b.co' } }).success).toBe(false);
  });

  it('takes one valid address only', () => {
    const withTo = (to: string) => WorkflowSpec.safeParse({ ...base, action: { type: 'email' }, delivery: { channel: 'email', to } }).success;
    expect(withTo('not an address')).toBe(false);
    expect(withTo('a@b.co, c@d.co')).toBe(false);
  });

  it('still parses a workflow without email, with its defaults', () => {
    const parsed = WorkflowSpec.safeParse({ ...base, action: { type: 'notify' } });
    expect(parsed.success && parsed.data.autonomy).toBe('approve');
    expect(parsed.success && 'delivery' in parsed.data).toBe(false);
  });

  it('WorkflowDraft accepts any subset of the spec', () => {
    expect(WorkflowDraft.safeParse({}).success).toBe(true);
    expect(WorkflowDraft.safeParse({ action: { type: 'email' } }).success).toBe(true);
    expect(WorkflowDraft.safeParse({ hotels: 'LIS1' }).success).toBe(false);
  });
});

describe('maskEmail', () => {
  it('masks addresses', () => {
    expect(maskEmail('silviu@gmail.com')).toBe('si****@gmail.com');
    expect(maskEmail('a@b.co')).toBe('a****@b.co');
  });

  it('gives nothing away for text that is not an address', () => {
    expect(maskEmail('silviu')).toBe('****');
  });
});
