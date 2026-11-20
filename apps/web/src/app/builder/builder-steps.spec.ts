import { CHECK_LABELS, maskEmail, specToGraph, type ChatEntry, type ChatLive } from '@compass/contracts';
import { edgeFlow, isEditable, nodeRunState } from './builder-canvas';
import { richText } from './builder-chat';
import { editorValues, nodePatch, parseHotels } from './builder-node-editor';
import { missingSteps, statusChip, testResult } from './builder-page';
import { IDLE_LIVE, type BuilderRun } from './builder-socket';
import { DATA_TOOL_LABELS, issueText, maskAddress, stepLabel, stepsSummary, toConversation } from './builder-steps';

const usage = { tokens: 0, costUsd: 0 };
const user = (id: number, text: string): ChatEntry => ({ id, kind: 'user', text, at: id });
const calls = (id: number, tools: [string, string, Record<string, unknown>][], text = ''): ChatEntry => ({
  id,
  kind: 'assistant',
  text,
  toolCalls: tools.map(([callId, name, args]) => ({ callId, name, args })),
  model: 'm',
  usage,
  stopReason: 'toolUse',
  at: id,
});
const result = (id: number, callId: string, name: string, error?: string): ChatEntry => ({ id, kind: 'tool_result', callId, name, isError: !!error, ...(error ? { error } : {}), at: id });
const reply = (id: number, text: string): ChatEntry => ({ id, kind: 'assistant', text, toolCalls: [], model: 'm', usage, stopReason: 'stop', at: id });
const live = (over: Partial<ChatLive>): ChatLive => ({ ...IDLE_LIVE, ...over });

describe('stepLabel', () => {
  it('names each builder tool and the value it set', () => {
    expect(stepLabel('set_trigger', { kind: 'schedule', every: 'day' })).toEqual({ label: 'Set trigger', detail: 'Every morning' });
    expect(stepLabel('set_trigger', { kind: 'schedule', every: 'week' }).detail).toBe('Every week');
    expect(stepLabel('set_trigger', { kind: 'brief', finding: 'pace_behind' }).detail).toBe('On pace behind');
    expect(stepLabel('set_trigger', { kind: 'manual' }).detail).toBe('By hand');
    expect(stepLabel('set_hotels', { hotels: ['LIS', 'OPO'] })).toEqual({ label: 'Set hotels', detail: 'LIS, OPO' });
    expect(stepLabel('set_hotels', { hotels: ['ALL'] }).detail).toBe('All hotels');
    expect(stepLabel('set_hotels', { hotels: ['A', 'B', 'C', 'D', 'E', 'F'] }).detail).toBe('A, B, C, D +2');
    expect(stepLabel('add_check', { tool: 'get_pace' })).toEqual({ label: 'Added check', detail: 'Pace vs last year' });
    expect(stepLabel('remove_check', { tool: 'get_inventory' })).toEqual({ label: 'Removed check', detail: 'get_inventory' });
    expect(stepLabel('set_goal', { name: 'Lisbon pace alert', goal: '…' })).toEqual({ label: 'Wrote goal', detail: 'Lisbon pace alert' });
    expect(stepLabel('set_action', { type: 'notify' })).toEqual({ label: 'Set action', detail: 'Notify the team' });
  });

  it('never shows an address in full in the transcript', () => {
    expect(stepLabel('set_email', { to: 'silviu@gmail.com' })).toEqual({ label: 'Set email', detail: 'si****@gmail.com' });
    expect(maskAddress('silviu@gmail.com')).toBe(maskEmail('silviu@gmail.com'));
    expect(maskAddress('a@b.co')).toBe(maskEmail('a@b.co'));
    expect(maskAddress('nonsense')).toBe(maskEmail('nonsense'));
  });

  it('reads data tools as what they looked at, known or not, and survives missing arguments', () => {
    expect(stepLabel('get_pace', { hotels: ['LIS'] })).toEqual({ label: 'Read pace vs last year', detail: 'LIS' });
    expect(stepLabel('list_hotels')).toEqual({ label: 'Looked up hotels', detail: '' });
    expect(stepLabel('get_lost_business').label).toBe('Read lost business');
    expect(stepLabel('set_trigger')).toEqual({ label: 'Set trigger', detail: '' });
    expect(stepLabel('set_hotels', { hotels: 'LIS' }).detail).toBe('');
  });

  it('keeps the same short names as the contract', () => {
    expect(DATA_TOOL_LABELS).toEqual(CHECK_LABELS);
  });
});

describe('toConversation', () => {
  const entries: ChatEntry[] = [
    user(1, 'Email me every morning if Lisbon falls behind'),
    calls(2, [['c1', 'set_trigger', { kind: 'schedule', every: 'day' }]], 'Setting the trigger.'),
    result(3, 'c1', 'set_trigger'),
    calls(4, [['c2', 'list_hotels', {}]]),
    result(5, 'c2', 'list_hotels'),
    calls(6, [['c3', 'set_hotels', { hotels: ['LIS'] }]]),
    result(7, 'c3', 'set_hotels'),
    reply(8, 'Which address should it email?'),
    user(9, 'ana@example.com'),
    calls(10, [['c4', 'set_email', { to: 'ana@example.com' }]]),
    result(11, 'c4', 'set_email', 'delivery.to: Invalid email'),
    reply(12, 'That address did not work.'),
  ];

  it('folds the tool calls between a question and its answer into one line of steps', () => {
    const items = toConversation(entries, IDLE_LIVE);
    expect(items.map((item) => item.kind)).toEqual(['user', 'steps', 'assistant', 'user', 'steps', 'assistant']);
    const first = items[1]!;
    if (first.kind !== 'steps') throw new Error('expected steps');
    expect(first.summary).toBe('Set trigger · Looked up hotels · Set hotels');
    expect(first.running).toBe(false);
    expect(first.steps.every((step) => step.status === 'done')).toBe(true);
    expect(items[2]).toMatchObject({ kind: 'assistant', text: 'Which address should it email?', streaming: false });
  });

  it('marks a failed tool call with its reason', () => {
    const steps = toConversation(entries, IDLE_LIVE)[4]!;
    if (steps.kind !== 'steps') throw new Error('expected steps');
    expect(steps.steps[0]).toMatchObject({ label: 'Set email', status: 'error', error: 'delivery.to: Invalid email' });
  });

  it('shows the turn in progress: an open call, a call only `live` knows, and the text being written', () => {
    const running = toConversation(
      [user(1, 'go'), calls(2, [['c1', 'set_trigger', { kind: 'manual' }]]), result(3, 'c1', 'set_trigger'), calls(4, [['c2', 'set_hotels', { hotels: ['ALL'] }]])],
      live({ running: true, tools: [{ callId: 'c2', name: 'set_hotels', status: 'running' }, { callId: 'c5', name: 'add_check', status: 'pending' }] }),
    );
    const steps = running[1]!;
    if (steps.kind !== 'steps') throw new Error('expected steps');
    expect(steps.running).toBe(true);
    expect(steps.steps.map((step) => [step.label, step.status])).toEqual([
      ['Set trigger', 'done'],
      ['Set hotels', 'running'],
      ['Added check', 'running'],
    ]);
    expect(stepsSummary(steps.steps)).toBe('Set trigger · Set hotels · Added check');

    const writing = toConversation([user(1, 'go')], live({ running: true, streamingText: 'All set' }));
    expect(writing.at(-1)).toEqual({ kind: 'assistant', key: 'live-text', text: 'All set', streaming: true });
  });

  it('starts a steps line from `live` alone, before any entry has landed', () => {
    const items = toConversation([user(1, 'go')], live({ running: true, tools: [{ callId: 'c1', name: 'set_trigger', status: 'pending' }] }));
    expect(items[1]).toMatchObject({ kind: 'steps', key: 'live-steps', summary: 'Set trigger', running: true });
  });

  it('notes a canvas edit and explains a run that ended without an answer', () => {
    const edited = toConversation([{ id: 1, kind: 'event', type: 'app.edit', data: { changed: ['trigger', 'check:get_pace', 'action'], chain: '…' }, at: 1 }], IDLE_LIVE);
    expect(edited).toEqual([{ kind: 'note', key: 'e1', text: 'You edited the trigger, checks and action on the canvas' }]);
    expect(toConversation([{ id: 1, kind: 'event', type: 'app.other', data: null, at: 1 }], IDLE_LIVE)).toEqual([]);

    expect(toConversation([user(1, 'go')], live({ failure: { reason: 'aborted' } })).at(-1)).toMatchObject({ kind: 'failure', text: 'Stopped.' });
    expect(toConversation([user(1, 'go')], live({ failure: { reason: 'who_knows' } })).at(-1)).toMatchObject({ kind: 'failure' });
  });
});

describe('issues, status and test result', () => {
  it('turns the server issues into plain lines, once each', () => {
    expect(issueText('trigger: Invalid input: expected object, received undefined')).toBe('Trigger: not set yet');
    expect(issueText('delivery.to: Invalid email address')).toBe('Email address: Invalid email address');
    expect(issueText('delivery: An email action needs the address to send to.')).toBe('Email address: An email action needs the address to send to.');
    expect(issueText('something else')).toBe('something else');
    expect(missingSteps(['name: Invalid input: expected string, received undefined', 'name: Invalid input: expected string, received undefined', 'goal: Too small', 'trigger: Invalid input'])).toEqual(['Trigger: not set yet', 'Name: not set yet', 'Goal: Too small']);
  });

  it('reads the status chip most urgent first', () => {
    const base = { connection: 'open' as const, loaded: true, issues: 0, workflowId: null, saved: false, pending: null, run: null };
    expect(statusChip({ ...base, connection: 'connecting', loaded: false }).text).toBe('Connecting…');
    expect(statusChip({ ...base, connection: 'reconnecting' })).toEqual({ tone: 'fail', text: 'Offline' });
    expect(statusChip({ ...base, issues: 3 }).text).toBe('Draft · 3 steps to finish');
    expect(statusChip({ ...base, issues: 1 }).text).toBe('Draft · 1 step to finish');
    expect(statusChip(base).text).toBe('Ready to save');
    expect(statusChip({ ...base, pending: 'save' }).text).toBe('Saving…');
    expect(statusChip({ ...base, workflowId: 'wf', saved: true })).toEqual({ tone: 'ok', text: 'Saved' });
    expect(statusChip({ ...base, workflowId: 'wf' }).text).toBe('Unsaved changes');
    expect(statusChip({ ...base, workflowId: 'wf', saved: true, pending: 'test' }).text).toBe('Testing…');
  });

  it('says how a test ended', () => {
    const draft = { action: { type: 'email' as const }, delivery: { channel: 'email' as const, to: 'silviu@gmail.com' } };
    const run = (over: Partial<BuilderRun>): BuilderRun => ({ runId: 'r', status: 'done', activeNode: null, done: [], failed: null, ...over });
    const label = (id: string) => ({ analyze: 'Kassandra explains why' })[id] ?? '';
    expect(testResult(null, draft, label, null)).toBeNull();
    expect(testResult(run({ status: 'running', activeNode: 'analyze' }), draft, label, null)).toBeNull();
    expect(testResult(run({ done: ['trigger', 'action'] }), draft, label, null)).toMatchObject({ tone: 'ok', text: 'Mail sent to si****@gmail.com' });
    expect(testResult(run({ done: ['trigger', 'action'] }), { action: { type: 'notify' } }, label, null)).toMatchObject({ tone: 'ok', text: 'The test ran to the end' });
    expect(testResult(run({ done: ['trigger'] }), draft, label, 'The hourly limit was reached.')).toEqual({ tone: 'warn', text: 'The test finished, but nothing was sent', detail: 'The hourly limit was reached.' });
    expect(testResult(run({ status: 'failed', failed: 'analyze' }), draft, label, null)).toMatchObject({ tone: 'fail', text: 'The test stopped at “Kassandra explains why”' });
    expect(testResult(run({ status: 'waiting_approval' }), draft, label, null)).toMatchObject({ tone: 'warn' });
  });
});

describe('canvas', () => {
  const graph = specToGraph({ trigger: { kind: 'manual' }, hotels: ['LIS'], checks: ['get_pace'] });
  const [trigger, scope, check, analyze] = graph.nodes as [(typeof graph.nodes)[0], (typeof graph.nodes)[0], (typeof graph.nodes)[0], (typeof graph.nodes)[0]];
  const run: BuilderRun = { runId: 'r', status: 'running', activeNode: 'check:get_pace', done: ['trigger', 'scope'], failed: null };

  it('lights nodes and connectors as a run walks the chain', () => {
    expect(nodeRunState(null, 'trigger')).toBeNull();
    expect(nodeRunState(run, 'trigger')).toBe('done');
    expect(nodeRunState(run, 'check:get_pace')).toBe('active');
    expect(nodeRunState(run, 'analyze')).toBeNull();
    expect(nodeRunState({ ...run, status: 'failed', activeNode: null, failed: 'analyze' }, 'analyze')).toBe('failed');

    expect(edgeFlow(null, trigger, scope)).toBe('idle');
    expect(edgeFlow(null, check, analyze)).toBe('placeholder');
    expect(edgeFlow(run, trigger, scope)).toBe('done');
    expect(edgeFlow(run, scope, check)).toBe('active');
  });

  it('opens a form on the nodes a person can set by hand', () => {
    expect(isEditable(trigger)).toBe(true);
    expect(isEditable(check)).toBe(true);
    expect(isEditable(specToGraph({}).nodes[2]!)).toBe(false);
    const withApproval = specToGraph({ action: { type: 'adjust_bar' } }).nodes.find((node) => node.kind === 'approval')!;
    expect(isEditable(withApproval)).toBe(false);
  });

  it('builds the edit patch for each node, or says what is wrong', () => {
    const values = { trigger: 'week' as const, hotels: 'lis, opo', name: 'Lisbon pace alert', goal: 'Email when Lisbon is more than 10% behind.', email: 'ana@example.com' };
    const draft = { checks: ['get_pace', 'get_pickup'], action: { type: 'email' as const, guidance: 'Keep it short' } };
    expect(nodePatch({ id: 'trigger', kind: 'trigger' }, draft, values)).toEqual({ patch: { trigger: { kind: 'schedule', every: 'week' } } });
    expect(nodePatch({ id: 'trigger', kind: 'trigger' }, draft, { ...values, trigger: 'manual' })).toEqual({ patch: { trigger: { kind: 'manual' } } });
    expect(nodePatch({ id: 'trigger', kind: 'trigger' }, draft, { ...values, trigger: null })).toHaveProperty('error');
    expect(nodePatch({ id: 'scope', kind: 'scope' }, draft, values)).toEqual({ patch: { hotels: ['LIS', 'OPO'] } });
    expect(nodePatch({ id: 'scope', kind: 'scope' }, draft, { ...values, hotels: ' , ' })).toHaveProperty('error');
    expect(nodePatch({ id: 'check:get_pace', kind: 'check' }, draft, values)).toEqual({ patch: { checks: ['get_pickup'] } });
    expect(nodePatch({ id: 'analyze', kind: 'analyze' }, draft, values)).toEqual({ patch: { name: 'Lisbon pace alert', goal: 'Email when Lisbon is more than 10% behind.' } });
    expect(nodePatch({ id: 'analyze', kind: 'analyze' }, draft, { ...values, goal: 'short' })).toHaveProperty('error');
    expect(nodePatch({ id: 'action', kind: 'action' }, draft, values)).toEqual({
      patch: { action: { type: 'email', guidance: 'Keep it short' }, delivery: { channel: 'email', to: 'ana@example.com' } },
    });
    expect(nodePatch({ id: 'action', kind: 'action' }, { action: { type: 'notify', guidance: 'x' } }, values)).toMatchObject({ patch: { action: { type: 'email', guidance: '' } } });
    expect(nodePatch({ id: 'action', kind: 'action' }, draft, { ...values, email: 'not an address' })).toHaveProperty('error');
    expect(nodePatch({ id: 'approval', kind: 'approval' }, draft, values)).toHaveProperty('error');
  });

  it('reads the editor values from the draft and parses hotel codes', () => {
    expect(editorValues({ trigger: { kind: 'schedule', every: 'day' }, hotels: ['LIS', 'OPO'], delivery: { channel: 'email', to: 'a@b.co' } })).toEqual({
      trigger: 'day',
      hotels: 'LIS, OPO',
      name: '',
      goal: '',
      email: 'a@b.co',
    });
    expect(editorValues({ trigger: { kind: 'brief', finding: 'pace_behind' } }).trigger).toBe('brief');
    expect(editorValues({}).trigger).toBeNull();
    expect(parseHotels('lis; opo  lis')).toEqual(['LIS', 'OPO']);
    expect(parseHotels('lis, all')).toEqual(['ALL']);
  });

  it('splits bold out of a reply and leaves the rest as text', () => {
    expect(richText('Lisbon is **20% behind**, so it would email you today.')).toEqual([
      { text: 'Lisbon is ', bold: false },
      { text: '20% behind', bold: true },
      { text: ', so it would email you today.', bold: false },
    ]);
    expect(richText('plain')).toEqual([{ text: 'plain', bold: false }]);
  });
});

describe('a check node on the canvas', () => {
  it('reads as a label a hotelier understands, without the tool name', () => {
    const node = specToGraph({ checks: ['get_pace'] }).nodes.find((n) => n.kind === 'check')!;
    expect(node.label).toBe('Pace vs last year');
    expect(`${node.label} ${node.detail}`).not.toContain('get_pace');
  });
});
