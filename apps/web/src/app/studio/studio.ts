import type { AuditEntry, Proposal, Workflow, WorkflowRun } from '@compass/contracts';

/*
  Agent Studio, the pure part: how a workflow's runs, proposals and audit entries read on its card
  (docs/decisions.md, "Watchers are cards with a run strip"). Everything here comes from the API as it is:
  GET /api/workflows/:id for the runs and proposals, GET /api/audit for the mails that went out.
*/

export type Autonomy = Workflow['autonomy'];

/** Trust is earned in this order: suggest → approve → act alone on low-risk actions. */
export const AUTONOMY_ORDER: readonly Autonomy[] = ['suggest', 'approve', 'auto_low_risk'];
export const AUTONOMY_SHORT: Record<Autonomy, string> = { suggest: 'Suggest', approve: 'Approve', auto_low_risk: 'Act alone' };
export const AUTONOMY_LONG: Record<Autonomy, string> = {
  suggest: 'Suggests only',
  approve: 'Acts after you approve',
  auto_low_risk: 'Acts alone on low-risk actions',
};
/** What a level lets the workflow do, for the confirmation before raising it. */
export const AUTONOMY_MEANS: Record<Autonomy, string> = {
  suggest: 'It only records what it would do. Nothing is sent anywhere.',
  approve: 'It prepares the action and waits. Nothing happens until you approve it in the inbox.',
  auto_low_risk: 'It creates tasks and notifications on its own. Prices and channels still wait for your approval.',
};

/** More freedom for the workflow than it has now. Raising asks first; lowering is immediate, with Undo. */
export const isRaise = (from: Autonomy, to: Autonomy) => AUTONOMY_ORDER.indexOf(to) > AUTONOMY_ORDER.indexOf(from);

export type RunOutcome = 'none' | 'finding' | 'pending' | 'failed' | 'running';

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/**
 * How one run ended. A finding is a run that proposed something or sent its mail; `pending` is a finding that
 * still waits for a person. A mail has no proposal, so it is matched to the run by the audit entry's time.
 */
export function runOutcome(run: WorkflowRun, proposals: readonly Proposal[], audit: readonly AuditEntry[]): RunOutcome {
  if (run.status === 'failed') return 'failed';
  const mine = proposals.filter((p) => p.runId === run.id);
  if (run.status === 'waiting_approval' || mine.some((p) => p.status === 'pending')) return 'pending';
  if (run.status === 'running') return 'running';
  if (mine.some((p) => p.status !== 'superseded')) return 'finding';
  // A test always sends its mail, whatever it found, so a test's mail is not a finding.
  if (run.test) return 'none';
  const from = time(run.startedAt);
  // A mail is logged while the run writes its summary; a minute of slack covers clocks and a slow last step.
  const to = (Number.isNaN(time(run.endedAt)) ? from : time(run.endedAt)) + 60_000;
  const mailed = audit.some((entry) => entry.workflowId === run.workflowId && entry.outcome === 'emailed' && time(entry.at) >= from && time(entry.at) <= to);
  return mailed ? 'finding' : 'none';
}

export const OUTCOME_LABEL: Record<RunOutcome, string> = {
  none: 'Nothing to flag',
  finding: 'Found something',
  pending: 'Needs your decision',
  failed: 'Couldn’t run',
  running: 'Running',
};

export interface RunTick {
  /** The run's id; empty for a slot with no run yet. */
  id: string;
  outcome: RunOutcome | 'empty';
  at: string | null;
  test: boolean;
}

/** The last `size` runs, oldest first, padded on the left so the strip keeps its width from the first run on. */
export function runStrip(runs: readonly WorkflowRun[], proposals: readonly Proposal[], audit: readonly AuditEntry[], size = 14): RunTick[] {
  const recent = [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).slice(-size);
  const ticks = recent.map((run): RunTick => ({ id: run.id, outcome: runOutcome(run, proposals, audit), at: run.startedAt, test: !!run.test }));
  const padding = Array.from({ length: Math.max(0, size - ticks.length) }, (): RunTick => ({ id: '', outcome: 'empty', at: null, test: false }));
  return [...padding, ...ticks];
}

/** The strip in words, for a screen reader and for anyone who does not read bar heights: "Last 5 runs: 2 found something, 1 couldn’t run." */
export function stripSummary(ticks: readonly RunTick[]): string {
  const runs = ticks.filter((tick) => tick.outcome !== 'empty');
  if (!runs.length) return 'No runs yet.';
  const count = (outcome: RunOutcome) => runs.filter((tick) => tick.outcome === outcome).length;
  const parts = [
    count('finding') + count('pending') ? `${count('finding') + count('pending')} found something` : '',
    count('none') ? `${count('none')} found nothing` : '',
    count('failed') ? `${count('failed')} couldn’t run` : '',
    count('running') ? `${count('running')} running now` : '',
  ].filter(Boolean);
  return `${runs.length === 1 ? 'Last run' : `Last ${runs.length} runs`}: ${parts.join(', ')}.`;
}

/** How the last run went, apart from whether the workflow is on. */
export interface StudioStatus {
  tone: 'needs' | 'running' | 'failed' | 'finding' | 'quiet';
  text: string;
}

export function studioStatus(workflow: Pick<Workflow, 'lastRun'>, runs: readonly WorkflowRun[], proposals: readonly Proposal[], audit: readonly AuditEntry[]): StudioStatus {
  if (proposals.some((p) => p.status === 'pending') || workflow.lastRun?.status === 'waiting_approval') return { tone: 'needs', text: OUTCOME_LABEL.pending };
  if (workflow.lastRun?.status === 'running') return { tone: 'running', text: 'Running…' };
  if (workflow.lastRun?.status === 'failed') return { tone: 'failed', text: OUTCOME_LABEL.failed };
  if (!workflow.lastRun) return { tone: 'quiet', text: 'Hasn’t run yet' };
  const last = runs.find((run) => run.id === workflow.lastRun?.runId);
  if (last?.test) return { tone: 'quiet', text: 'Test ran' };
  const outcome = last ? runOutcome(last, proposals, audit) : 'none';
  return outcome === 'finding' ? { tone: 'finding', text: OUTCOME_LABEL.finding } : { tone: 'quiet', text: OUTCOME_LABEL.none };
}

export interface LatestFinding {
  /** One or two sentences, Markdown as the agent wrote it. */
  text: string;
  /** The hotel code of a proposal; empty for a run's summary. */
  hotel: string;
  at: string;
  /** `proposal`: what it proposed. `run`: its last word when the last run proposed nothing. */
  kind: 'proposal' | 'run';
  pending: boolean;
  /** The run was a "Send test now". */
  test: boolean;
}

/** The first sentences of a run's summary, up to about `max` characters: the conclusion, without the working. */
export function firstSentences(summary: string, max = 220): string {
  const first = summary.replace(/\r\n?/g, '\n').split(/\n\s*\n/)[0]!.replace(/\s*\n\s*/g, ' ').trim();
  if (first.length <= max) return first;
  // A sentence ends at a full stop that a space follows, so "27.57" and "8.0" stay whole.
  const sentences = first.match(/.+?[.!?]+(?=\s|$)|.+$/g) ?? [first];
  let text = '';
  for (const sentence of sentences) {
    if (text && (text + sentence).length > max) break;
    text += sentence;
  }
  return text.trim().length > max ? `${text.slice(0, max).trimEnd()}…` : text.trim();
}

/** The newest thing the workflow found: its latest proposal, else what its latest run concluded. */
export function latestFinding(runs: readonly WorkflowRun[], proposals: readonly Proposal[]): LatestFinding | null {
  const proposal = [...proposals].filter((p) => p.status !== 'superseded').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const run = [...runs].filter((r) => r.summary?.trim()).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  // A newer run that proposed nothing replaces an old proposal only when it is a real run, not a test.
  if (proposal && (!run || run.test || run.startedAt <= proposal.createdAt || run.id === proposal.runId)) {
    return { text: proposal.title, hotel: proposal.hotel_code, at: proposal.createdAt, kind: 'proposal', pending: proposal.status === 'pending', test: false };
  }
  if (run) return { text: firstSentences(run.summary!), hotel: '', at: run.endedAt ?? run.startedAt, kind: 'run', pending: false, test: !!run.test };
  return null;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** The cron runs the brief and the workflows every morning at 05:00 UTC (docs/api.md, "Schedule"). */
const CRON_HOUR_UTC = 5;

/** The first 05:00 UTC at or after `from`. */
export function nextCron(from: number): number {
  const day = Math.floor(from / DAY) * DAY + CRON_HOUR_UTC * HOUR;
  return day >= from ? day : day + DAY;
}

/**
 * When the workflow runs next, in milliseconds, or null when nothing is scheduled (off, or run by hand).
 * A weekly workflow first runs at the next cron, then at the first cron at least 6.5 days after its last run that
 * was not a test. A workflow on a brief finding is checked after every morning's brief.
 */
export function nextRunAt(workflow: Pick<Workflow, 'enabled' | 'trigger' | 'lastRun'>, runs: readonly WorkflowRun[], now: number): number | null {
  if (!workflow.enabled || workflow.trigger.kind === 'manual') return null;
  if (workflow.trigger.kind === 'schedule' && workflow.trigger.every === 'week') {
    const last = [...runs].filter((run) => !run.test).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (last) return nextCron(Math.max(now, Date.parse(last.startedAt) + 6.5 * DAY));
  }
  return nextCron(now);
}

/** "today, 07:00", "tomorrow, 07:00" or "Sat 28 Nov, 07:00", in the reader's time zone. */
export function formatWhen(at: number, now: number, timeZone?: string): string {
  const day = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(at);
  if (day(at) === day(now)) return `today, ${clock}`;
  if (day(at) === day(now + DAY)) return `tomorrow, ${clock}`;
  return `${new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(at)}, ${clock}`;
}

/** The "next run" line of a card. */
export function nextRunText(workflow: Pick<Workflow, 'enabled' | 'trigger' | 'lastRun'>, runs: readonly WorkflowRun[], now: number, timeZone?: string): string {
  if (!workflow.enabled) return 'Paused · no run scheduled';
  if (workflow.trigger.kind === 'manual') return 'Runs when you start it';
  const at = nextRunAt(workflow, runs, now);
  if (at === null) return 'No run scheduled';
  const when = formatWhen(at, now, timeZone);
  return workflow.trigger.kind === 'brief' ? `Reads the next brief ${when}` : `Next run ${when}`;
}
