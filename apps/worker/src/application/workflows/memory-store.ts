import type { AuditEntry, Proposal, Workflow, WorkflowRun } from '@compass/contracts';
import type { TaskRef, WorkflowStore } from './store.ts';

/** In-memory store for tests. */
export class MemoryWorkflowStore implements WorkflowStore {
  readonly workflows = new Map<string, Workflow>();
  readonly runs = new Map<string, WorkflowRun>();
  readonly proposals = new Map<string, Proposal>();
  readonly audit: AuditEntry[] = [];
  readonly #tasks = new Map<string, TaskRef>();
  readonly #emails = new Map<string, string>();

  taskOf(proposalId: string): TaskRef | undefined {
    return this.#tasks.get(proposalId);
  }

  async runForSession(sessionId: string) {
    const run = [...this.runs.values()].find((r) => r.sessionId === sessionId);
    const workflow = run && this.workflows.get(run.workflowId);
    return run && workflow ? { run, workflow } : null;
  }
  async updateRun(runId: string, patch: Partial<WorkflowRun>) {
    const run = this.runs.get(runId);
    if (run) this.runs.set(runId, { ...run, ...patch });
  }
  async proposalForTask(taskId: TaskRef) {
    const id = [...this.#tasks.entries()].find(([, t]) => String(t) === String(taskId))?.[0];
    return id ? (this.proposals.get(id) ?? null) : null;
  }
  async saveProposal(proposal: Proposal, taskId: TaskRef) {
    this.proposals.set(proposal.id, proposal);
    this.#tasks.set(proposal.id, taskId);
  }
  async updateProposal(proposal: Proposal) {
    this.proposals.set(proposal.id, proposal);
  }
  async proposalsForRun(runId: string) {
    return [...this.proposals.values()].filter((p) => p.runId === runId);
  }
  async getProposal(id: string) {
    return this.proposals.get(id) ?? null;
  }
  async auditForProposal(proposalId: string) {
    return this.audit.find((a) => a.proposalId === proposalId && a.outcome !== 'undone') ?? null;
  }
  async appendAudit(entry: AuditEntry) {
    this.audit.push(entry);
  }
  async emailForRun(runId: string) {
    return this.#emails.get(runId) ?? null;
  }
  async recordEmail(runId: string, workflowId: string, receipt: string, test: boolean) {
    this.#emails.set(runId, receipt);
    const workflow = this.workflows.get(workflowId);
    if (workflow && !test) this.workflows.set(workflowId, { ...workflow, emailsSent: (workflow.emailsSent ?? 0) + 1 });
  }
}
