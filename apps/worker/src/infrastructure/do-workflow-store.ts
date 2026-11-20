import type { AuditEntry, Proposal, Workflow, WorkflowRun } from '@compass/contracts';
import type { TaskRef, WorkflowStore } from '../application/workflows/store.ts';

/** The workflow store on a Durable Object's key-value storage (SQLite-backed). */
export class DurableWorkflowStore implements WorkflowStore {
  readonly #storage: DurableObjectStorage;

  constructor(storage: DurableObjectStorage) {
    this.#storage = storage;
  }

  // ---- workflows and runs
  async listWorkflows(): Promise<Workflow[]> {
    return [...(await this.#storage.list<Workflow>({ prefix: 'wf:' })).values()];
  }
  getWorkflow(id: string) {
    return this.#storage.get<Workflow>(`wf:${id}`);
  }
  putWorkflow(workflow: Workflow) {
    return this.#storage.put(`wf:${workflow.id}`, workflow);
  }
  getRun(id: string) {
    return this.#storage.get<WorkflowRun>(`run:${id}`);
  }
  async putRun(run: WorkflowRun) {
    await this.#storage.put({ [`run:${run.id}`]: run, [`session:${run.sessionId}`]: run.id });
  }
  async listRuns(workflowId?: string): Promise<WorkflowRun[]> {
    const runs = [...(await this.#storage.list<WorkflowRun>({ prefix: 'run:' })).values()];
    return runs.filter((r) => !workflowId || r.workflowId === workflowId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async runForSession(sessionId: string) {
    const runId = await this.#storage.get<string>(`session:${sessionId}`);
    const run = runId ? await this.getRun(runId) : undefined;
    const workflow = run ? await this.getWorkflow(run.workflowId) : undefined;
    return run && workflow ? { run, workflow } : null;
  }
  async updateRun(runId: string, patch: Partial<WorkflowRun>) {
    const run = await this.getRun(runId);
    if (run) await this.#storage.put(`run:${runId}`, { ...run, ...patch });
  }

  // ---- proposals
  async proposalForTask(taskId: TaskRef) {
    const id = await this.#storage.get<string>(`task:${taskId}`);
    return id ? ((await this.getProposal(id)) ?? null) : null;
  }
  async saveProposal(proposal: Proposal, taskId: TaskRef) {
    await this.#storage.put({ [`prop:${proposal.id}`]: proposal, [`task:${taskId}`]: proposal.id, [`proptask:${proposal.id}`]: taskId });
  }
  async updateProposal(proposal: Proposal) {
    await this.#storage.put(`prop:${proposal.id}`, proposal);
  }
  async getProposal(id: string) {
    return (await this.#storage.get<Proposal>(`prop:${id}`)) ?? null;
  }
  async proposalsForRun(runId: string) {
    return (await this.listProposals()).filter((p) => p.runId === runId);
  }
  taskForProposal(id: string) {
    return this.#storage.get<TaskRef>(`proptask:${id}`);
  }
  async listProposals(): Promise<Proposal[]> {
    return [...(await this.#storage.list<Proposal>({ prefix: 'prop:' })).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ---- audit
  async auditForProposal(proposalId: string) {
    return (await this.listAudit()).find((a) => a.proposalId === proposalId && a.outcome !== 'undone') ?? null;
  }
  async appendAudit(entry: AuditEntry) {
    await this.#storage.put(`audit:${entry.at}:${entry.id}`, entry);
  }
  async listAudit(): Promise<AuditEntry[]> {
    return [...(await this.#storage.list<AuditEntry>({ prefix: 'audit:', reverse: true })).values()];
  }

  // ---- email
  async emailForRun(runId: string) {
    return (await this.#storage.get<string>(`email:${runId}`)) ?? null;
  }
  /** The receipt and the workflow's count go in one write, so a mail is never recorded without being counted. */
  async recordEmail(runId: string, workflowId: string, receipt: string, test: boolean) {
    const workflow = test ? undefined : await this.getWorkflow(workflowId);
    await this.#storage.put<string | Workflow>({
      [`email:${runId}`]: receipt,
      ...(workflow ? { [`wf:${workflowId}`]: { ...workflow, emailsSent: (workflow.emailsSent ?? 0) + 1 } } : {}),
    });
  }
}
