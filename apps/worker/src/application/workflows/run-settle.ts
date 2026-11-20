import type { WorkflowRun } from '@compass/contracts';

/**
 * A run is recorded as ended by a wait that lives in the object's memory. A deploy or an eviction ends that wait, and
 * the run would then stay `running` in storage for good and block every later run of its workflow with a 409. So a
 * stored `running` run is checked against its Pi session whenever it is read. Pure: the caller asks Pi.
 */

/** What the run's Pi session says: its operation has ended, or whether the session is still working. */
export type RunProbe = { finished: { status: 'done' | 'failed'; summary: string | null } } | { live: boolean };

/** What Pi's `session.wait` resolves with (`PiOperationResult`), as far as a run needs it. */
export type WaitResult = { status: 'done' | 'unanswered'; reason?: string; text?: string };

/**
 * What a wait on the run's operation tells. Pi resolves the wait (it does not reject) with `unanswered` and the reason
 * `not_found` for an operation it has no record of: `run()` stores the run before it submits the prompt, so a read in
 * between sees exactly that. Such a run has not ended; it is taken as not live, so only the 15 minutes can fail it.
 * Null when the wait gave no result (it timed out): the caller asks the session whether it is working.
 */
export function probeOfWait(result: WaitResult | null): RunProbe | null {
  if (!result) return null;
  if (result.status === 'unanswered' && result.reason === 'not_found') return { live: false };
  return { finished: { status: result.status === 'done' ? 'done' : 'failed', summary: result.text ?? result.reason ?? null } };
}

/** A run this old with no live session will not finish. */
export const STALE_RUN_MS = 15 * 60_000;

/**
 * How to record a run stored as `running`, or null to leave it: its session finished (take that outcome), or the run
 * is older than 15 minutes and its session is not working (failed). A run in any other status is never touched.
 */
export function lazySettlement(run: WorkflowRun, probe: RunProbe, now: Date): Pick<WorkflowRun, 'status' | 'endedAt' | 'summary'> | null {
  if (run.status !== 'running') return null;
  const endedAt = now.toISOString();
  if ('finished' in probe) return { status: probe.finished.status, endedAt, summary: probe.finished.summary };
  if (probe.live || now.getTime() - Date.parse(run.startedAt) <= STALE_RUN_MS) return null;
  return { status: 'failed', endedAt, summary: 'The run stopped before it finished.' };
}
