import type { Brief, BriefItem, Workflow } from '@compass/contracts';

/**
 * The first runs of the brief-triggered workflows. They normally start from the 05:00 cron; a workflow that has
 * never run would leave the Inbox empty until then. So on first use, each one whose finding is in today's brief
 * runs once, and the Inbox opens with a real proposal to decide.
 */

/** How many runs one seeding starts at most: the five templates. Each run is a full agent run. */
export const MAX_SEED_RUNS = 5;

/** The findings of today's brief that start this workflow: its kind of finding, for one of its hotels. */
export function briefHits(workflow: Pick<Workflow, 'trigger' | 'hotels'>, brief: Brief): BriefItem[] {
  const { trigger, hotels } = workflow;
  if (trigger.kind !== 'brief') return [];
  return brief.items.filter((item) => item.kind === trigger.finding && (hotels.includes('ALL') || hotels.includes(item.hotel_code)));
}

/** What a brief run is told about why it started. */
export function briefReason(workflow: Pick<Workflow, 'trigger'>, hits: readonly BriefItem[]): string {
  const finding = workflow.trigger.kind === 'brief' ? workflow.trigger.finding : '';
  return `brief finding ${finding} for ${hits.map((hit) => hit.hotel_code).join(', ')}`;
}

/**
 * A workflow that waits for the brief, is on, and proposes rather than mails. An email workflow is never seeded:
 * nobody should get mail because someone opened the app.
 */
export const seedable = (workflow: Workflow): boolean =>
  workflow.enabled && workflow.trigger.kind === 'brief' && workflow.action.type !== 'email' && workflow.lastRun === null;

/**
 * The workflows to run now: seedable, never ran (`hasRun`), with a finding in today's brief. The templates first,
 * then the oldest, and at most `MAX_SEED_RUNS`.
 */
export function seedCandidates(workflows: readonly Workflow[], hasRun: (id: string) => boolean, brief: Brief): { workflowId: string; reason: string }[] {
  const rank = (workflow: Workflow) => (workflow.createdBy === 'template' ? 0 : 1);
  return workflows
    .filter((workflow) => seedable(workflow) && !hasRun(workflow.id))
    .map((workflow) => ({ workflow, hits: briefHits(workflow, brief) }))
    .filter(({ hits }) => hits.length > 0)
    .sort((a, b) => rank(a.workflow) - rank(b.workflow) || a.workflow.createdAt.localeCompare(b.workflow.createdAt))
    .slice(0, MAX_SEED_RUNS)
    .map(({ workflow, hits }) => ({ workflowId: workflow.id, reason: briefReason(workflow, hits) }));
}

export interface SeedDeps {
  /** Whether the seeding already happened. */
  done(): Promise<boolean>;
  markDone(): Promise<void>;
  workflows(): Promise<Workflow[]>;
  /** Whether the workflow has any run on record. */
  hasRun(workflowId: string): Promise<boolean>;
  /** Today's brief. */
  brief(): Promise<Brief>;
  /** Takes one workflow run from the daily budget; false when it is spent. */
  takeBudget(): Promise<boolean>;
  /** Starts the run; false when it could not start. */
  run(workflowId: string, reason: string): Promise<boolean>;
}

export interface SeedOutcome {
  /** already: seeded before. seeded: done now. budget: the daily budget ran out, the rest is for another time. failed: the brief could not be read. */
  status: 'already' | 'seeded' | 'budget' | 'failed';
  started: string[];
}

/**
 * Runs each candidate once. Idempotent twice over: it is remembered as done, and a workflow that has a run is never
 * a candidate again, so an interruption half-way does not start anything twice. Each run takes from the daily budget
 * of workflow runs like "Run now" does; when that is spent the seeding stops, undone, to finish another day.
 */
export async function seedRuns(deps: SeedDeps): Promise<SeedOutcome> {
  if (await deps.done()) return { status: 'already', started: [] };
  const workflows = (await deps.workflows()).filter(seedable);
  const ran = new Set<string>();
  for (const workflow of workflows) if (await deps.hasRun(workflow.id)) ran.add(workflow.id);

  let candidates: { workflowId: string; reason: string }[] = [];
  if (workflows.some((workflow) => !ran.has(workflow.id))) {
    let brief: Brief;
    try {
      brief = await deps.brief();
    } catch {
      return { status: 'failed', started: [] };
    }
    candidates = seedCandidates(workflows, (id) => ran.has(id), brief);
  }

  const started: string[] = [];
  for (const candidate of candidates) {
    if (!(await deps.takeBudget())) return { status: 'budget', started };
    if (await deps.run(candidate.workflowId, candidate.reason)) started.push(candidate.workflowId);
  }
  await deps.markDone();
  return { status: 'seeded', started };
}
