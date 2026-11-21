import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projectEntries, projectLive } from '../src/presentation/agents/chat-projection.ts';

// A real Pi view captured from a faux-model run: user → assistant (text + get_pace call) → tool result → answer.
const view = JSON.parse(readFileSync(new URL('./fixtures/pi-view.json', import.meta.url).pathname, 'utf8'));

describe('projectEntries', () => {
  const entries = projectEntries(view.entries);

  it('keeps user, assistant and tool result entries, in order, and drops system entries', () => {
    expect(entries.map((e) => e.kind)).toEqual(['user', 'assistant', 'tool_result', 'assistant']);
    expect(entries.map((e) => e.id)).toEqual([...entries.map((e) => e.id)].sort((a, b) => a - b));
  });

  it('projects the user text', () => {
    expect(entries[0]).toMatchObject({ kind: 'user', text: 'How is Lisbon?' });
  });

  it('projects assistant text, tool calls and usage', () => {
    expect(entries[1]).toMatchObject({
      kind: 'assistant',
      text: 'Let me check.',
      stopReason: 'toolUse',
      toolCalls: [{ name: 'get_pace', args: { hotels: ['LIS'], daysAhead: 44 } }],
    });
    if (entries[1]?.kind === 'assistant') expect(entries[1].usage.tokens).toBeGreaterThan(0);
  });

  it('gives tool results their rows and evidence, not the text meant for the model', () => {
    const result = entries[2];
    expect(result?.kind).toBe('tool_result');
    if (result?.kind !== 'tool_result') return;
    expect(result.name).toBe('get_pace');
    expect(result.isError).toBe(false);
    expect(result.rows?.[0]).toMatchObject({ hotel_code: 'LIS' });
    expect(result.evidence?.sources).toContain('hotel.pace_vs_stly()');
    expect(result.callId).toBe(entries[1]?.kind === 'assistant' ? entries[1].toolCalls[0]?.callId : '');
  });

  it('passes a drafted workflow through to the UI', () => {
    const [entry] = projectEntries([
      { id: 50, kind: 'pi.tool-result', model: [{ role: 'toolResult', toolCallId: 'c9', toolName: 'draft_workflow', content: [{ type: 'text', text: 'Draft ready' }], details: { workflowDraft: { name: 'Dubai watch' } }, timestamp: 1 }] },
    ]);
    expect(entry).toMatchObject({ kind: 'tool_result', name: 'draft_workflow', draft: { name: 'Dubai watch' } });
  });

  it('says whether send_email sent a mail', () => {
    const result = (id: number, details: unknown) => ({
      id, kind: 'pi.tool-result', model: [{ role: 'toolResult', toolCallId: `c${id}`, toolName: 'send_email', content: [{ type: 'text', text: '…' }], details, timestamp: 1 }],
    });
    const [sent, refused, other] = projectEntries([result(1, { sent: true }), result(2, { sent: false }), result(3, undefined)]);
    expect(sent).toMatchObject({ kind: 'tool_result', sent: true });
    expect(refused).toMatchObject({ kind: 'tool_result', sent: false });
    expect(other && 'sent' in other).toBe(false);
  });

  it('passes a widget through to the UI, and never from a failed call', () => {
    const widget = { kind: 'bar', title: 'Lisbon is 17.4% behind', sourceCallId: 'c1', x: 'hotel_code', y: ['pace_pct'], rows: [{ hotel_code: 'LIS', pace_pct: -17.4 }], columns: [], evidence: { sources: [] } };
    const result = (id: number, isError: boolean, details: unknown) => ({
      id, kind: 'pi.tool-result', model: [{ role: 'toolResult', toolCallId: `c${id}`, toolName: 'show_widget', isError, content: [{ type: 'text', text: 'Shown' }], details, timestamp: 1 }],
    });
    const [shown, failed, malformed] = projectEntries([result(1, false, { widget }), result(2, true, { widget }), result(3, false, { widget: { kind: 'bar' } })]);
    expect(shown).toMatchObject({ kind: 'tool_result', name: 'show_widget', widget });
    expect(shown && 'rows' in shown).toBe(false);
    expect(failed && 'widget' in failed).toBe(false);
    expect(malformed && 'widget' in malformed).toBe(false);
  });

  it('projects our own labelled inputs as events', () => {
    const [event] = projectEntries([
      { id: 99, kind: 'app.approval', data: { approved: true, by: 'rm' }, model: [{ role: 'user', content: 'Approved', timestamp: 1 }] },
    ]);
    expect(event).toMatchObject({ id: 99, kind: 'event', type: 'app.approval', data: { approved: true, by: 'rm' } });
  });
});

describe('projectLive', () => {
  it('is idle with no run', () => {
    expect(projectLive({})).toEqual({ running: false, phase: 'idle', streamingText: '', tools: [], turns: 0, failure: null, usage: { tokens: 0, costUsd: 0 } });
  });

  it('shows a running run, its streamed text and its tools', () => {
    const live = projectLive({
      'pi.live': {
        run: { taskId: 9, turns: 1 },
        generation: { attempt: 1, message: { role: 'assistant', content: [{ type: 'text', text: 'Lisbon is ' }] } },
        tools: [{ callId: 'c1', name: 'get_pace', taskId: 12, status: 'running' }],
      },
      'pi.usage': { models: { 'cloudflare/x': { totalTokens: 100, cost: { total: 0.01 } } } },
    });
    expect(live).toEqual({
      running: true,
      phase: 'tools',
      streamingText: 'Lisbon is ',
      tools: [{ callId: 'c1', name: 'get_pace', status: 'running' }],
      turns: 1,
      failure: null,
      usage: { tokens: 100, costUsd: 0.01 },
    });
  });

  it('reports why a run ended without an answer', () => {
    const live = projectLive({ 'pi.live': { runFailure: { reason: 'model_error', detail: 'boom' } } });
    expect(live.failure).toEqual({ reason: 'model_error', detail: 'boom' });
    expect(live.running).toBe(false);
  });
});

describe('projectLive drafting: tool calls the model is still writing', () => {
  const during = (content: unknown[], tools: unknown[] = []) =>
    projectLive({ 'pi.live': { run: { taskId: 9, turns: 1 }, generation: { attempt: 1, message: { role: 'assistant', content } }, tools } });

  it('carries each streamed call with the arguments parsed so far, so a chart can show its title early', () => {
    const live = during([
      { type: 'thinking', thinking: 'A bar ranks the hotels.' },
      { type: 'toolCall', id: 'w1', name: 'show_widget', arguments: { kind: 'bar', title: 'Lisbon is 17.4% beh' } },
    ]);
    expect(live.drafting).toEqual([{ callId: 'w1', name: 'show_widget', args: { kind: 'bar', title: 'Lisbon is 17.4% beh' } }]);
    expect(live.phase).toBe('tools');
  });

  it('keeps a call whose arguments have not started, and never passes on a value that is not an object', () => {
    const live = during([
      { type: 'toolCall', id: 'c1', name: 'get_pace' },
      { type: 'toolCall', id: 'c2', name: 'get_mix', arguments: 'hotels' },
      { type: 'toolCall', id: 'c3', name: 'get_pickup', arguments: ['LIS'] },
    ]);
    expect(live.drafting).toEqual([
      { callId: 'c1', name: 'get_pace', args: {} },
      { callId: 'c2', name: 'get_mix', args: {} },
      { callId: 'c3', name: 'get_pickup', args: {} },
    ]);
  });

  it('is absent when the partial answer has no call, a call has no id yet, or nothing runs', () => {
    expect(during([{ type: 'text', text: 'Lisbon is ' }])).not.toHaveProperty('drafting');
    expect(during([{ type: 'toolCall', name: 'show_widget', arguments: {} }])).not.toHaveProperty('drafting');
    expect(projectLive({ 'pi.live': { generation: { message: { content: [{ type: 'toolCall', id: 'w1', name: 'show_widget', arguments: {} }] } } } })).not.toHaveProperty('drafting');
  });
});

describe('projectLive phase', () => {
  const during = (generation?: unknown, tools: unknown[] = []) =>
    projectLive({ 'pi.live': { run: { taskId: 9, turns: 0 }, ...(generation ? { generation } : {}), tools } });
  const partial = (...content: unknown[]) => ({ attempt: 1, message: { role: 'assistant', content } });

  it('is waiting until the model sends its first block', () => {
    expect(during().phase).toBe('waiting');
    expect(during({ attempt: 1 }).phase).toBe('waiting');
  });

  // Captured from a Thinker (Sonnet) turn: the provider sends the reasoning first and the answer only at the end,
  // so for seconds the partial holds a thinking block and no text.
  it('is thinking while the partial answer holds only reasoning, and streams none of it as text', () => {
    const live = during(partial({ type: 'thinking', thinking: 'The brief shows…', thinkingSignature: '' }));
    expect(live.phase).toBe('thinking');
    expect(live.streamingText).toBe('');
  });

  it('is writing once answer text follows the reasoning', () => {
    const live = during(partial({ type: 'thinking', thinking: 'The brief shows…' }, { type: 'text', text: 'Lisbon is ' }));
    expect(live.phase).toBe('writing');
    expect(live.streamingText).toBe('Lisbon is ');
  });

  it('is tools while the model writes a tool call or a tool runs', () => {
    expect(during(partial({ type: 'text', text: 'Let me check.' }, { type: 'toolCall', id: 'c1', name: 'get_pace', arguments: {} })).phase).toBe('tools');
    expect(during(undefined, [{ callId: 'c1', name: 'get_pace', status: 'running' }]).phase).toBe('tools');
  });

  it('is idle after a failed run, whatever partial was left', () => {
    expect(projectLive({ 'pi.live': { runFailure: { reason: 'aborted' }, generation: partial({ type: 'text', text: 'Lis' }) } }).phase).toBe('idle');
  });
});

describe('projectLive failure detail', () => {
  it('drops URLs and long internals from a provider error before it reaches the browser', () => {
    const detail = '502 from https://gateway.ai.cloudflare.com/v1/0123456789abcdef/compass/anthropic/v1/messages: ' + 'x'.repeat(500);
    const live = projectLive({ 'pi.live': { runFailure: { reason: 'model_error', detail } } });
    expect(live.failure?.reason).toBe('model_error');
    expect(live.failure?.detail).not.toContain('0123456789abcdef');
    expect(live.failure?.detail).toContain('[url]');
    expect(live.failure!.detail!.length).toBeLessThanOrEqual(200);
  });
});
