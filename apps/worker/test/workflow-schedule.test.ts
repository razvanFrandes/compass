import type { Workflow, WorkflowRun } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { isDue, lastRealRunAt, nextMorning, nextScheduledRun } from '../src/application/workflows/schedule.ts';

const at = (iso: string) => new Date(iso);
type Scheduled = Pick<Workflow, 'trigger' | 'createdAt'>;
const createdAt = '2026-11-20T14:00:00.000Z';
const daily: Scheduled = { trigger: { kind: 'schedule', every: 'day' }, createdAt };
const weekly: Scheduled = { trigger: { kind: 'schedule', every: 'week' }, createdAt };
const onBrief: Scheduled = { trigger: { kind: 'brief', finding: 'pace_behind' }, createdAt };
const manual: Scheduled = { trigger: { kind: 'manual' }, createdAt };

describe('isDue', () => {
  it('a daily workflow is due every morning', () => {
    expect(isDue(daily, null, at('2026-11-21T05:00:00.000Z'))).toBe(true);
    expect(isDue(daily, '2026-11-21T04:00:00.000Z', at('2026-11-21T05:00:00.000Z'))).toBe(true);
  });

  it('a weekly workflow is not due on day 2 and is due on day 7', () => {
    const lastRun = '2026-11-20T05:00:20.000Z'; // the morning cron's run, some seconds after 05:00
    expect(isDue(weekly, lastRun, at('2026-11-21T05:00:05.000Z'))).toBe(false);
    expect(isDue(weekly, lastRun, at('2026-11-22T05:00:05.000Z'))).toBe(false);
    expect(isDue(weekly, lastRun, at('2026-11-26T05:00:05.000Z'))).toBe(false);
    // The cron of day 7 fires a little earlier in the minute than the run of day 0 started: still due.
    expect(isDue(weekly, lastRun, at('2026-11-27T05:00:05.000Z'))).toBe(true);
    expect(isDue(weekly, lastRun, at('2026-11-28T05:00:05.000Z'))).toBe(true);
  });

  it.each(['2026-11-20T03:00:00.000Z', '2026-11-20T12:00:00.000Z', '2026-11-20T20:00:00.000Z'])(
    'a weekly workflow that never ran is due at the first morning cron after it was created (%s)',
    (created) => {
      const fresh: Scheduled = { ...weekly, createdAt: created };
      const first = nextMorning(at(created));
      expect(isDue(fresh, null, first)).toBe(true);
      expect(nextScheduledRun(fresh, at(created), null)).toEqual(first);
      // After that first run it waits a week.
      const ran = new Date(first.getTime() + 20_000).toISOString();
      expect(isDue(fresh, ran, new Date(first.getTime() + 24 * 60 * 60 * 1000))).toBe(false);
      expect(nextScheduledRun(fresh, at(ran), ran)).toEqual(new Date(first.getTime() + 7 * 24 * 60 * 60 * 1000));
    },
  );

  it('the first morning cron is the same day for 03:00 and the next day for 12:00 and 20:00', () => {
    expect(nextMorning(at('2026-11-20T03:00:00.000Z'))).toEqual(at('2026-11-20T05:00:00.000Z'));
    expect(nextMorning(at('2026-11-20T12:00:00.000Z'))).toEqual(at('2026-11-21T05:00:00.000Z'));
    expect(nextMorning(at('2026-11-20T20:00:00.000Z'))).toEqual(at('2026-11-21T05:00:00.000Z'));
  });

  it('only test runs so far: still never really ran, so still due', () => {
    expect(isDue(weekly, lastRealRunAt([]), at('2026-11-21T05:00:00.000Z'))).toBe(true);
  });

  it('is due from 6.5 days after the last run', () => {
    const lastRun = '2026-11-20T05:00:00.000Z';
    expect(isDue(weekly, lastRun, at('2026-11-26T16:59:59.999Z'))).toBe(false);
    expect(isDue(weekly, lastRun, at('2026-11-26T17:00:00.000Z'))).toBe(true);
  });

  it('a workflow without a schedule is never due on one', () => {
    expect(isDue(onBrief, null, at('2026-12-20T05:00:00.000Z'))).toBe(false);
    expect(isDue(manual, null, at('2026-12-20T05:00:00.000Z'))).toBe(false);
  });
});

describe('lastRealRunAt', () => {
  const run = (id: string, startedAt: string, test?: boolean): WorkflowRun => ({
    id, workflowId: 'wf-1', sessionId: `s-${id}`, trigger: 'manual', status: 'done', startedAt, endedAt: null, summary: null, ...(test ? { test } : {}),
  });

  it('is the start of the latest run that is not a test, in any order', () => {
    const runs = [run('a', '2026-11-20T05:00:00.000Z'), run('c', '2026-11-23T10:00:00.000Z', true), run('b', '2026-11-21T09:00:00.000Z')];
    expect(lastRealRunAt(runs)).toBe('2026-11-21T09:00:00.000Z');
  });

  it('is null when there are only test runs, or none', () => {
    expect(lastRealRunAt([run('c', '2026-11-23T10:00:00.000Z', true)])).toBeNull();
    expect(lastRealRunAt([])).toBeNull();
  });
});

describe('nextScheduledRun', () => {
  it('a daily workflow runs again at the next 05:00 UTC cron, whenever the run was', () => {
    expect(nextScheduledRun(daily, at('2026-11-20T05:00:20.000Z'), null)).toEqual(at('2026-11-21T05:00:00.000Z'));
    expect(nextScheduledRun(daily, at('2026-11-20T14:00:00.000Z'), null)).toEqual(at('2026-11-21T05:00:00.000Z')); // a manual run: not now + 24 h
    expect(nextScheduledRun(daily, at('2026-11-20T04:59:00.000Z'), null)).toEqual(at('2026-11-20T05:00:00.000Z'));
    expect(nextScheduledRun(daily, at('2026-11-20T05:00:00.000Z'), null)).toEqual(at('2026-11-21T05:00:00.000Z'));
  });

  it('a brief workflow may run again the next morning', () => {
    expect(nextScheduledRun(onBrief, at('2026-11-20T06:00:00.000Z'), null)).toEqual(at('2026-11-21T05:00:00.000Z'));
    expect(nextScheduledRun(onBrief, at('2026-11-20T04:59:00.000Z'), null)).toEqual(at('2026-11-20T05:00:00.000Z'));
  });

  it('a weekly workflow runs again at the first cron it is due at: 7 days after a morning run', () => {
    expect(nextScheduledRun(weekly, at('2026-11-20T05:01:00.000Z'), '2026-11-20T05:00:20.000Z')).toEqual(at('2026-11-27T05:00:00.000Z'));
    // Asked later in the week, the answer is the same.
    expect(nextScheduledRun(weekly, at('2026-11-24T12:00:00.000Z'), '2026-11-20T05:00:20.000Z')).toEqual(at('2026-11-27T05:00:00.000Z'));
  });

  it('after a manual run in the evening the weekly cron of day 7 is too early, so it is day 8', () => {
    expect(nextScheduledRun(weekly, at('2026-11-20T18:00:00.000Z'), '2026-11-20T18:00:00.000Z')).toEqual(at('2026-11-28T05:00:00.000Z'));
  });

  it('a weekly workflow that never ran runs at the next morning cron', () => {
    expect(nextScheduledRun(weekly, at('2026-11-20T14:01:00.000Z'), null)).toEqual(at('2026-11-21T05:00:00.000Z'));
  });

  it('every cron it names is one the workflow is due at', () => {
    for (const lastRun of ['2026-11-20T05:00:20.000Z', '2026-11-20T16:59:00.000Z', '2026-11-20T17:01:00.000Z', '2026-11-20T23:59:00.000Z']) {
      const next = nextScheduledRun(weekly, at(lastRun), lastRun)!;
      expect(isDue(weekly, lastRun, next)).toBe(true);
      expect(isDue(weekly, lastRun, new Date(next.getTime() - 24 * 60 * 60 * 1000))).toBe(false);
    }
  });

  it('a manual workflow has no next run', () => {
    expect(nextScheduledRun(manual, at('2026-11-20T06:00:00.000Z'), null)).toBeNull();
  });
});
