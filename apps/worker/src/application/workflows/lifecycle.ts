import type { AuditEntry, Proposal, Workflow, WorkflowRun } from '@compass/contracts';
import { err, ok, type Result } from '../../domain/result.ts';

/** A refusal of the workflows API: the message for the person and the HTTP status. */
export type WorkflowError = { error: string; status: number };

const MAX_NAME_CHARS = 80;
const COPY_SUFFIX = ' (copy)';

/**
 * A copy of a workflow as a new one: made by a person, turned off until they turn it on, and with none of the
 * history of the one it was copied from (runs, emails sent). An email workflow keeps its recipient: the copy is the
 * same person's workflow, and the limits per recipient hold for it too.
 */
export function duplicateOf(source: Workflow, id: string, now: string): Workflow {
  const { emailsSent: _history, ...spec } = source;
  return {
    ...spec,
    id,
    name: `${source.name.slice(0, MAX_NAME_CHARS - COPY_SUFFIX.length).trimEnd()}${COPY_SUFFIX}`,
    enabled: false,
    createdBy: 'user',
    createdAt: now,
    lastRun: null,
  };
}

/** What deleting a workflow reads and writes. The Durable Object's store in production. */
export interface WorkflowRecords {
  getWorkflow(id: string): Promise<Workflow | undefined>;
  listRuns(workflowId?: string): Promise<WorkflowRun[]>;
  listProposals(): Promise<Proposal[]>;
  listAudit(): Promise<AuditEntry[]>;
  updateRun(runId: string, patch: Partial<WorkflowRun>): Promise<void>;
  updateProposal(proposal: Proposal): Promise<void>;
  /** Writes an audit entry under its own time and id: writing one again replaces it. */
  appendAudit(entry: AuditEntry): Promise<void>;
  /** Removes the workflow itself and nothing that belongs to it. */
  forgetWorkflow(id: string): Promise<void>;
}

/**
 * Deletes a workflow a person no longer wants. What it did stays on record: its runs, its proposals and its audit
 * entries keep their place, each marked with the name the workflow had, since its id no longer leads anywhere.
 * Refused while a run of it is going or waits for an approval: that run still needs its workflow to finish.
 */
export async function removeWorkflow(store: WorkflowRecords, id: string): Promise<Result<{ name: string }, WorkflowError>> {
  const workflow = await store.getWorkflow(id);
  if (!workflow) return err({ error: 'No such workflow.', status: 404 });
  const runs = await store.listRuns(id);
  const active = runs.find((run) => run.status === 'running' || run.status === 'waiting_approval');
  if (active) {
    const why = active.status === 'waiting_approval' ? 'a proposal waiting for a decision' : 'a run in progress';
    return err({ error: `This workflow has ${why}. Decide it or wait for the run to end, then delete the workflow.`, status: 409 });
  }
  const deletedWorkflowName = workflow.name;
  for (const run of runs) await store.updateRun(run.id, { deletedWorkflowName });
  for (const proposal of await store.listProposals()) {
    if (proposal.workflowId === id) await store.updateProposal({ ...proposal, deletedWorkflowName });
  }
  for (const entry of await store.listAudit()) {
    if (entry.workflowId === id) await store.appendAudit({ ...entry, deletedWorkflowName });
  }
  await store.forgetWorkflow(id);
  return ok({ name: deletedWorkflowName });
}
