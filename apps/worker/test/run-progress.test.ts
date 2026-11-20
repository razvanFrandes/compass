import { specToGraph, type ChatEntry } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { runProgress } from '../src/application/workflows/run-progress.ts';

const graph = specToGraph({
  name: 'Lisbon pace watch',
  hotels: ['LIS1'],
  trigger: { kind: 'schedule', every: 'day' },
  checks: ['get_pace'],
  goal: 'Tell me when Lisbon pace falls more than 10% behind last year.',
  action: { type: 'email' },
  delivery: { channel: 'email', to: 'ana@example.com' },
});

let id = 0;
const assistant = (text: string, ...calls: [callId: string, name: string][]): ChatEntry => ({
  id: ++id,
  kind: 'assistant',
  text,
  toolCalls: calls.map(([callId, name]) => ({ callId, name, args: {} })),
  model: 'm',
  usage: { tokens: 0, costUsd: 0 },
  stopReason: calls.length ? 'toolUse' : 'stop',
  at: 0,
});
const result = (callId: string, name: string, isError = false, sent?: boolean): ChatEntry => ({
  id: ++id,
  kind: 'tool_result',
  callId,
  name,
  isError,
  ...(sent === undefined ? {} : { sent }),
  at: 0,
});
const user: ChatEntry = { id: ++id, kind: 'user', text: 'Run the workflow now.', at: 0 };

const log: ChatEntry[] = [
  user,
  assistant('', ['c1', 'get_pace']),
  result('c1', 'get_pace'),
  assistant('Lisbon is 20% behind last year.', ['c2', 'send_email']),
  result('c2', 'send_email', false, true),
  assistant('Lisbon is behind; I sent the email.'),
];

describe('runProgress', () => {
  it('starts with the trigger and the scope done', () => {
    expect(runProgress([user], graph, 'running')).toEqual({ activeNode: 'check:get_pace', done: ['trigger', 'scope'], failed: null });
  });

  it('walks the whole chain of a finished run', () => {
    expect(runProgress(log, graph, 'done')).toEqual({
      activeNode: null,
      done: ['trigger', 'scope', 'check:get_pace', 'analyze', 'action'],
      failed: null,
    });
  });

  it('is on a check from its call until its result', () => {
    expect(runProgress(log.slice(0, 2), graph, 'running')).toEqual({ activeNode: 'check:get_pace', done: ['trigger', 'scope'], failed: null });
    expect(runProgress(log.slice(0, 3), graph, 'running')).toEqual({ activeNode: 'analyze', done: ['trigger', 'scope', 'check:get_pace'], failed: null });
  });

  it('is on the action while the email is being sent', () => {
    expect(runProgress(log.slice(0, 4), graph, 'running')).toEqual({ activeNode: 'action', done: ['trigger', 'scope', 'check:get_pace'], failed: null });
  });

  it('marks the node a failed run stopped on', () => {
    expect(runProgress(log.slice(0, 2), graph, 'failed')).toEqual({ activeNode: null, done: ['trigger', 'scope'], failed: 'check:get_pace' });
  });

  it('names analyze when a run fails (or times out) between tool calls', () => {
    expect(runProgress(log.slice(0, 3), graph, 'failed')).toEqual({ activeNode: null, done: ['trigger', 'scope', 'check:get_pace'], failed: 'analyze' });
  });

  it('makes analyze active for a tool that is not a check, once a check has finished', () => {
    const entries = [...log.slice(0, 3), assistant('', ['c9', 'get_pickup'])];
    expect(runProgress(entries, graph, 'running')).toMatchObject({ activeNode: 'analyze', done: ['trigger', 'scope', 'check:get_pace'] });
  });

  it('stays on the first check while the agent writes or reads other data before any check', () => {
    expect(runProgress([user, assistant('I will read the pace first.')], graph, 'running')).toMatchObject({ activeNode: 'check:get_pace', done: ['trigger', 'scope'] });
    expect(runProgress([user, assistant('', ['c1', 'get_pickup'])], graph, 'running')).toMatchObject({ activeNode: 'check:get_pace', done: ['trigger', 'scope'] });
  });

  it('is on analyze from the start when the workflow has no check', () => {
    expect(runProgress([user, assistant('Thinking.')], specToGraph({ goal: 'Watch Lisbon.' }), 'running')).toMatchObject({ activeNode: 'analyze' });
  });

  it('never steps backwards when the agent narrates before its first tool call', () => {
    const narrated: ChatEntry[] = [
      user,
      assistant('I will check the pace of Lisbon.'),
      assistant('', ['c1', 'get_pace']),
      result('c1', 'get_pace'),
      assistant('Lisbon is 20% behind last year, so I will send the email.'),
      assistant('', ['c2', 'send_email']),
      result('c2', 'send_email', false, true),
    ];
    const order = graph.nodes.map((node) => node.id);
    const active = narrated.slice(1).map((_, i) => runProgress(narrated.slice(0, i + 2), graph, 'running').activeNode);
    expect(active).toEqual(['check:get_pace', 'check:get_pace', 'analyze', 'analyze', 'action', null]);
    const steps = active.filter((id) => id !== null).map((id) => order.indexOf(id));
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(runProgress(narrated, graph, 'done')).toEqual({ activeNode: null, done: ['trigger', 'scope', 'check:get_pace', 'analyze', 'action'], failed: null });
  });

  it('does not finish the action when the email tool failed', () => {
    const entries = [...log.slice(0, 4), result('c2', 'send_email', true), assistant('The email could not be sent.')];
    expect(runProgress(entries, graph, 'done')).toEqual({ activeNode: null, done: ['trigger', 'scope', 'check:get_pace', 'analyze'], failed: null });
  });

  it('does not finish the action when no mail went out, as when the address is over its hourly limit', () => {
    const entries = [...log.slice(0, 4), result('c2', 'send_email', false, false), assistant('The limit was reached; no email sent.')];
    expect(runProgress(entries.slice(0, 5), graph, 'running')).toEqual({ activeNode: 'analyze', done: ['trigger', 'scope', 'check:get_pace'], failed: null });
    expect(runProgress(entries, graph, 'done')).toEqual({ activeNode: null, done: ['trigger', 'scope', 'check:get_pace', 'analyze'], failed: null });
  });

  it('stays on the first check while two run side by side', () => {
    const two = specToGraph({ checks: ['get_pace', 'get_pickup'] });
    const entries = [user, assistant('', ['c1', 'get_pace'], ['c2', 'get_pickup']), result('c2', 'get_pickup')];
    expect(runProgress(entries, two, 'running')).toMatchObject({ activeNode: 'check:get_pace', done: ['trigger', 'scope', 'check:get_pickup'] });
  });
});
