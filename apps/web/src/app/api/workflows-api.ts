import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type {
  AuditEntry,
  ChatEntry,
  Decision,
  Proposal,
  ProposalStatus,
  Workflow,
  WorkflowDraft,
  WorkflowRun,
  WorkflowSpecInput,
} from '@compass/contracts';
import { ApiHttp, type ApiResult } from './api-http';

export interface WorkflowDetail {
  workflow: Workflow;
  runs: WorkflowRun[];
  proposals: Proposal[];
}

/** A run and its log, projected like the chat: feed `entries` to `groupTurns` to render it. */
export interface RunLog {
  run: WorkflowRun;
  entries: ChatEntry[];
}

/** `note` is optional when sending (the server defaults it to ''). */
export type DecisionInput = Pick<Decision, 'approved' | 'by'> & { note?: string };

/**
 * Workflows, runs, the approval inbox and the audit log.
 *
 * Calls return an `ApiResult` and never throw. The `*Resource` methods give a signal-based view of a GET for a
 * screen (call them in an injection context, e.g. a field initializer); `reload()` them to poll.
 */
@Service()
export class WorkflowsApi {
  private readonly api = inject(ApiHttp);

  list(): Promise<ApiResult<Workflow[]>> {
    return this.api.get('workflows');
  }

  get(id: string): Promise<ApiResult<WorkflowDetail>> {
    return this.api.get(`workflows/${encodeURIComponent(id)}`);
  }

  /** 409 with the server's message when 30 workflows are already enabled. */
  create(spec: WorkflowSpecInput): Promise<ApiResult<Workflow>> {
    return this.api.post('workflows', spec);
  }

  /** E.g. `{ enabled: false }` or `{ autonomy: 'suggest' }`. An email workflow's recipient cannot change (400). */
  patch(id: string, changes: WorkflowDraft): Promise<ApiResult<Workflow>> {
    return this.api.patch(`workflows/${encodeURIComponent(id)}`, changes);
  }

  /** "Run now". 409 while the workflow has a run in progress; 429 over the budget. */
  run(id: string): Promise<ApiResult<WorkflowRun>> {
    return this.api.post(`workflows/${encodeURIComponent(id)}/run`);
  }

  runLog(runId: string): Promise<ApiResult<RunLog>> {
    return this.api.get(`runs/${encodeURIComponent(runId)}`);
  }

  /** The approval inbox is `proposals('pending')`. */
  proposals(status?: ProposalStatus): Promise<ApiResult<Proposal[]>> {
    return this.api.get('proposals', { status });
  }

  /** Approve or deny. Wakes the parked run, so the proposal moves on a moment later: reload the inbox. */
  decide(proposalId: string, decision: DecisionInput): Promise<ApiResult<Proposal>> {
    return this.api.post(`proposals/${encodeURIComponent(proposalId)}/decision`, { note: '', ...decision });
  }

  /** Undo an applied proposal: a compensating RMS task, audited. */
  undo(proposalId: string, by: string): Promise<ApiResult<Proposal>> {
    return this.api.post(`proposals/${encodeURIComponent(proposalId)}/undo`, { by });
  }

  /** Newest first. */
  audit(): Promise<ApiResult<AuditEntry[]>> {
    return this.api.get('audit');
  }

  listResource(): HttpResourceRef<Workflow[]> {
    return httpResource<Workflow[]>(() => this.api.url('workflows'), { defaultValue: [] });
  }

  /** Idle while `id()` is undefined. */
  detailResource(id: () => string | undefined): HttpResourceRef<WorkflowDetail | undefined> {
    return httpResource<WorkflowDetail>(() => {
      const value = id();
      return value ? this.api.url(`workflows/${encodeURIComponent(value)}`) : undefined;
    });
  }

  /** Idle while `runId()` is undefined. */
  runLogResource(runId: () => string | undefined): HttpResourceRef<RunLog | undefined> {
    return httpResource<RunLog>(() => {
      const value = runId();
      return value ? this.api.url(`runs/${encodeURIComponent(value)}`) : undefined;
    });
  }

  proposalsResource(status: () => ProposalStatus | undefined = () => 'pending'): HttpResourceRef<Proposal[]> {
    return httpResource<Proposal[]>(() => this.api.url('proposals', { status: status() }), { defaultValue: [] });
  }

  auditResource(): HttpResourceRef<AuditEntry[]> {
    return httpResource<AuditEntry[]>(() => this.api.url('audit'), { defaultValue: [] });
  }
}
