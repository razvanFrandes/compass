import type { WorkflowRun } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { followEnds } from '../src/application/workflows/run-progress.ts';
import { lazySettlement, probeOfWait, STALE_RUN_MS } from '../src/application/workflows/run-settle.ts';

const run: WorkflowRun = {
  id: 'run-1', workflowId: 'wf-1', sessionId: 's-1', trigger: 'manual', status: 'running',
  startedAt: '2026-11-20T06:00:00.000Z', endedAt: null, summary: null,
};
const at = (iso: string) => new Date(iso);

describe('lazySettlement', () => {
  it('settles a run stored as running whose Pi session has finished', () => {
    const now = at('2026-11-20T06:02:00.000Z');
    expect(lazySettlement(run, { finished: { status: 'done', summary: 'Emailed.' } }, now)).toEqual({
      status: 'done', endedAt: '2026-11-20T06:02:00.000Z', summary: 'Emailed.',
    });
    expect(lazySettlement(run, { finished: { status: 'failed', summary: 'aborted' } }, now)).toEqual({
      status: 'failed', endedAt: '2026-11-20T06:02:00.000Z', summary: 'aborted',
    });
  });

  it('leaves a run alone while its session is still working, however old', () => {
    expect(lazySettlement(run, { live: true }, at('2026-11-20T06:01:00.000Z'))).toBeNull();
    expect(lazySettlement(run, { live: true }, at('2026-11-20T09:00:00.000Z'))).toBeNull();
  });

  it('fails a run older than 15 minutes with no live session, and not a younger one', () => {
    expect(STALE_RUN_MS).toBe(15 * 60_000);
    expect(lazySettlement(run, { live: false }, at('2026-11-20T06:15:00.000Z'))).toBeNull();
    expect(lazySettlement(run, { live: false }, at('2026-11-20T06:15:00.001Z'))).toEqual({
      status: 'failed', endedAt: '2026-11-20T06:15:00.001Z', summary: 'The run stopped before it finished.',
    });
  });

  it('never touches a run that is not stored as running', () => {
    const now = at('2026-11-20T08:00:00.000Z');
    for (const status of ['done', 'failed', 'waiting_approval'] as const) {
      expect(lazySettlement({ ...run, status }, { live: false }, now)).toBeNull();
      expect(lazySettlement({ ...run, status }, { finished: { status: 'done', summary: null } }, now)).toBeNull();
    }
  });
});

describe('probeOfWait', () => {
  it('an ended operation is finished, with its text or its reason', () => {
    expect(probeOfWait({ status: 'done', text: 'Emailed.' })).toEqual({ finished: { status: 'done', summary: 'Emailed.' } });
    expect(probeOfWait({ status: 'unanswered', reason: 'aborted' })).toEqual({ finished: { status: 'failed', summary: 'aborted' } });
    expect(probeOfWait({ status: 'unanswered' })).toEqual({ finished: { status: 'failed', summary: null } });
  });

  it('an operation Pi does not know yet is not finished: the run was stored, its prompt not yet submitted', () => {
    const probe = probeOfWait({ status: 'unanswered', reason: 'not_found' });
    expect(probe).toEqual({ live: false });
    // So a second run() in that window leaves the young run alone (and answers 409), and only the 15 minutes fail it.
    expect(lazySettlement(run, probe!, at('2026-11-20T06:00:01.000Z'))).toBeNull();
    expect(lazySettlement(run, probe!, at('2026-11-20T06:15:00.001Z'))?.status).toBe('failed');
  });

  it('a wait that timed out says nothing: the caller asks whether the session is working', () => {
    expect(probeOfWait(null)).toBeNull();
  });
});

describe('followEnds', () => {
  it('the builder stops following a run that ended or that waits for a person', () => {
    expect(followEnds('running')).toBe(false);
    expect(followEnds('waiting_approval')).toBe(true);
    expect(followEnds('done')).toBe(true);
    expect(followEnds('failed')).toBe(true);
  });
});
