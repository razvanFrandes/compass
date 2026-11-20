import type { Workflow, WorkflowRun } from '@compass/contracts';

/**
 * When a workflow runs on its own. One cron fires every morning (`triggers.crons` in wrangler.jsonc); it regenerates
 * the brief and then starts the workflows that are due. Pure: the caller reads the runs and the clock.
 */

/** The hour (UTC) of the morning cron. */
export const MORNING_HOUR_UTC = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A weekly workflow is due from 6.5 days after its last run, not a full 7: the cron does not start it at the same
 * second every morning, and a run a few seconds "early" must not push the week to 8 days.
 */
export const WEEK_DUE_MS = 6.5 * DAY_MS;

type Scheduled = Pick<Workflow, 'trigger' | 'createdAt'>;

/** The first morning cron after `now`. */
export function nextMorning(now: Date): Date {
  const morning = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), MORNING_HOUR_UTC);
  return new Date(morning > now.getTime() ? morning : morning + DAY_MS);
}

/** When the workflow last really ran: the start of its latest run that is not a test, or null. */
export function lastRealRunAt(runs: readonly WorkflowRun[]): string | null {
  let last: string | null = null;
  for (const run of runs) if (!run.test && (last === null || run.startedAt > last)) last = run.startedAt;
  return last;
}

/**
 * Whether the morning cron at `now` starts a workflow that runs on a schedule. A daily one: always. A weekly one: when
 * 7 days (less the tolerance) have passed since `lastRunAt`, its last run that was not a test, or since it was created
 * when it never ran. A workflow with another trigger is never due on a schedule.
 */
export function isDue(workflow: Scheduled, lastRunAt: string | null, now: Date): boolean {
  const { trigger } = workflow;
  if (trigger.kind !== 'schedule') return false;
  if (trigger.every === 'day') return true;
  return now.getTime() - Date.parse(lastRunAt ?? workflow.createdAt) >= WEEK_DUE_MS;
}

/**
 * When the workflow would next run on its own after `now`, or null for a manual one. Daily, or waiting for a brief
 * finding: the next morning cron. Weekly: the first morning cron it is due at (`isDue`), so 7 days after a run the
 * cron started, and up to 8 after one a person started later in the day.
 */
export function nextScheduledRun(workflow: Scheduled, now: Date, lastRunAt: string | null): Date | null {
  const { trigger } = workflow;
  if (trigger.kind !== 'schedule' && trigger.kind !== 'brief') return null;
  let next = nextMorning(now);
  if (trigger.kind === 'schedule') {
    // At most 7 steps: every cron from 6.5 days after the last run is due.
    for (let step = 0; step < 8 && !isDue(workflow, lastRunAt, next); step++) next = new Date(next.getTime() + DAY_MS);
  }
  return next;
}
