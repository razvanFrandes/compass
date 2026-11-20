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

  it('projects our own labelled inputs as events', () => {
    const [event] = projectEntries([
      { id: 99, kind: 'app.approval', data: { approved: true, by: 'rm' }, model: [{ role: 'user', content: 'Approved', timestamp: 1 }] },
    ]);
    expect(event).toMatchObject({ id: 99, kind: 'event', type: 'app.approval', data: { approved: true, by: 'rm' } });
  });
});

describe('projectLive', () => {
  it('is idle with no run', () => {
    expect(projectLive({})).toEqual({ running: false, streamingText: '', tools: [], turns: 0, failure: null, usage: { tokens: 0, costUsd: 0 } });
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
