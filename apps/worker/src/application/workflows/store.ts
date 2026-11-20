import type { AuditEntry, Proposal, Workflow, WorkflowRun } from '@compass/contracts';
import type { TaskId } from '@earendil-works/pi-durable';

/** A Pi task id, stored as-is to signal the parked call later. */
export type TaskRef = TaskId;

/** Where workflows, runs, proposals and the audit log live. Durable Object storage in production. */
export interface WorkflowStore {
  /** The run (and its workflow) that a Pi conversation belongs to. */
  runForSession(sessionId: string): Promise<{ run: WorkflowRun; workflow: Workflow } | null>;
  updateRun(runId: string, patch: Partial<WorkflowRun>): Promise<void>;
  proposalForTask(taskId: TaskRef): Promise<Proposal | null>;
  saveProposal(proposal: Proposal, taskId: TaskRef): Promise<void>;
  /** Saves a changed proposal, keeping the task it was created by. */
  updateProposal(proposal: Proposal): Promise<void>;
  getProposal(id: string): Promise<Proposal | null>;
  auditForProposal(proposalId: string): Promise<AuditEntry | null>;
  appendAudit(entry: AuditEntry): Promise<void>;
}
