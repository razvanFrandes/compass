import { WorkflowSpec, type AuditEntry, type Brief, type ChatEntry, type Decision, type Proposal, type Workflow, type WorkflowRun, type WorkflowSpecInput } from '@compass/contracts';
import { DurableObject } from 'cloudflare:workers';
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { PiHarness } from 'agents/harness/pi';
import { Lifecycle } from 'agents/lifecycle';
import { createAI } from 'agents/models/pi-ai';
import { HotelData } from '../../application/hotel-data.ts';
import { createEmailExtension } from '../../application/workflows/email-tool.ts';
import { emailWorkflowBlocked, publicRun, publicWorkflow, recipientChanged } from '../../application/workflows/email.ts';
import { templateWorkflows, workflowInstructions } from '../../application/workflows/templates.ts';
import { createWorkflowExtension, DecisionSignal } from '../../application/workflows/workflow-tools.ts';
import type { Env } from '../../env.ts';
import { CloudflareEmailSender } from '../../infrastructure/cloudflare-email-sender.ts';
import { DurableEmailQuota } from '../../infrastructure/do-email-quota.ts';
import { DurableWorkflowStore } from '../../infrastructure/do-workflow-store.ts';
import { openPostgres } from '../../infrastructure/postgres.ts';
import { WorkersAiEmbedder } from '../../infrastructure/workers-ai-embedder.ts';
import { projectEntries } from './chat-projection.ts';
import { KASSANDRA_SECTIONS } from './kassandra-prompt.ts';
import { THINKER_MODEL } from './modes.ts';
import { createDataExtension } from './pi-data-extension.ts';

export type WorkflowError = { error: string; status: number };

/** Enabled workflows run every morning from the cron, so their number bounds the daily spend: cap it. */
export const MAX_WORKFLOWS = 30;

/**
 * The workflow agents of the group, in one Durable Object. Each run is its own durable Pi session: it checks the data,
 * proposes an action and, when a person must approve, parks on a durable signal. The wait holds no invocation and
 * survives deploys; the decision endpoint delivers the signal and the run continues where it stopped.
 *
 * An email workflow sends a mail instead of proposing. The API has no login, so what it returns never holds a
 * recipient in full (`publicWorkflow`) or the address of the client that started a run (`publicRun`).
 */
export class WorkflowAgents extends DurableObject<Env> {
  ai = createAI({ binding: this.env.AI, gateway: { id: 'compass', byokAlias: 'compass', collectLog: true } });
  store = new DurableWorkflowStore(this.ctx.storage);
  registry = this.#createRegistry();

  harness = new PiHarness({
    harness: ({ storage, context, onWake }) => {
      const models = createModels();
      models.setProvider(this.ai.provider);
      return Harness.open(
        storage,
        { models, registry: this.registry, onWake, settings: { afterFailedRun: 'withdraw', retry: { maxRetries: 2 } } },
        context,
      );
    },
    defaults: { model: this.ai(THINKER_MODEL), thinkingLevel: 'low', maxTurns: 12 },
  });

  lifecycle = Lifecycle.install(this).use(this.harness);

  // ---------------------------------------------------------------- workflows

  async list(): Promise<Workflow[]> {
    return (await this.#workflows()).map(publicWorkflow);
  }

  /** The workflows as stored, with the real recipients. Seeds the templates on first use. */
  async #workflows(): Promise<Workflow[]> {
    let workflows = await this.store.listWorkflows();
    if (!workflows.length) {
      workflows = templateWorkflows(new Date().toISOString());
      for (const wf of workflows) await this.store.putWorkflow(wf);
    }
    return workflows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
  }

  async get(id: string): Promise<{ workflow: Workflow; runs: WorkflowRun[]; proposals: Proposal[] } | WorkflowError> {
    const workflow = await this.store.getWorkflow(id);
    if (!workflow) return { error: 'No such workflow.', status: 404 };
    const proposals = (await this.store.listProposals()).filter((p) => p.workflowId === id);
    return { workflow: publicWorkflow(workflow), runs: (await this.store.listRuns(id)).map(publicRun), proposals };
  }

  async create(input: WorkflowSpecInput, createdBy: Workflow['createdBy'] = 'user'): Promise<Workflow | WorkflowError> {
    const parsed = WorkflowSpec.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), status: 400 };
    if ((await this.#workflows()).length >= MAX_WORKFLOWS) {
      return { error: `The demo holds at most ${MAX_WORKFLOWS} workflows. Disable or edit an existing one.`, status: 409 };
    }
    const workflow: Workflow = { ...parsed.data, id: `wf-${crypto.randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString(), createdBy, lastRun: null };
    await this.store.putWorkflow(workflow);
    return publicWorkflow(workflow);
  }

  async update(id: string, patch: Partial<WorkflowSpecInput>): Promise<Workflow | WorkflowError> {
    const current = await this.store.getWorkflow(id);
    if (!current) return { error: 'No such workflow.', status: 404 };
    // The recipient is fixed at creation: anyone can call this API, so a PATCH must not redirect a workflow's mail.
    const { delivery, ...rest } = patch;
    if (delivery !== undefined && recipientChanged(current, delivery)) {
      return { error: "The recipient can't be changed. Create a new workflow.", status: 400 };
    }
    const parsed = WorkflowSpec.safeParse({ ...current, ...rest });
    if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), status: 400 };
    const workflow: Workflow = { ...current, ...parsed.data };
    await this.store.putWorkflow(workflow);
    return publicWorkflow(workflow);
  }

  // ---------------------------------------------------------------- runs

  /**
   * Starts a run. `opts.test` is a "send test now" run: an email workflow then always sends, marked as a test.
   * `opts.client` is who asked (the client address), for the email limits; without it a scheduled or brief run counts
   * as 'cron' and any other as 'manual'.
   */
  async run(
    id: string,
    trigger: WorkflowRun['trigger'] = 'manual',
    reason = '',
    opts: { test?: boolean; client?: string } = {},
  ): Promise<WorkflowRun | WorkflowError> {
    const workflow = await this.store.getWorkflow(id);
    if (!workflow) return { error: 'No such workflow.', status: 404 };
    const test = opts.test === true;
    // An email workflow ends after 7 days or 5 emails. A test still runs: it is held by the hourly and daily limits.
    const blocked = test ? null : emailWorkflowBlocked(workflow, new Date());
    if (blocked) {
      if (workflow.enabled) await this.store.putWorkflow({ ...workflow, enabled: false });
      return { error: blocked, status: 400 };
    }
    const active = (await this.store.listRuns(id)).find((r) => r.status === 'running' || r.status === 'waiting_approval');
    if (active) return { error: `This workflow already has a run in progress (${active.id}).`, status: 409 };

    const session = await this.harness.sessions.create({ agent: { instructions: workflowInstructions(workflow, test) } });
    const run: WorkflowRun = {
      id: `run-${crypto.randomUUID().slice(0, 8)}`,
      workflowId: id,
      sessionId: session.id,
      trigger,
      status: 'running',
      startedAt: new Date().toISOString(),
      endedAt: null,
      summary: null,
      ...(test ? { test } : {}),
      client: opts.client || (trigger === 'manual' ? 'manual' : 'cron'),
    };
    await this.store.putRun(run);
    await this.store.putWorkflow({ ...workflow, lastRun: { runId: run.id, at: run.startedAt, status: run.status } });
    await session.submit(`Run the workflow now (trigger: ${trigger}${reason ? `, ${reason}` : ''}${test ? ', test run' : ''}).`, { operationId: run.id });
    this.ctx.waitUntil(this.#settle(run.id));
    return publicRun(run);
  }

  /** The run's log: its transcript, projected like the chat. */
  async runLog(runId: string): Promise<{ run: WorkflowRun; entries: ChatEntry[] } | WorkflowError> {
    const run = await this.store.getRun(runId);
    if (!run) return { error: 'No such run.', status: 404 };
    const entries = projectEntries(await this.harness.session(run.sessionId).messages());
    return { run: publicRun((await this.store.getRun(runId)) ?? run), entries };
  }

  /** Runs the enabled workflows the morning brief calls for: brief findings for their hotels, and the daily ones. */
  async runTriggered(brief: Brief): Promise<WorkflowRun[]> {
    const started: WorkflowRun[] = [];
    for (const workflow of await this.#workflows()) {
      if (!workflow.enabled) continue;
      const trigger = workflow.trigger;
      let reason = '';
      if (trigger.kind === 'brief') {
        const hits = brief.items.filter(
          (i) => i.kind === trigger.finding && (workflow.hotels.includes('ALL') || workflow.hotels.includes(i.hotel_code)),
        );
        if (!hits.length) continue;
        reason = `brief finding ${trigger.finding} for ${hits.map((h) => h.hotel_code).join(', ')}`;
      } else if (trigger.kind !== 'schedule') continue;
      const run = await this.run(workflow.id, trigger.kind === 'brief' ? 'brief' : 'schedule', reason);
      if (!('error' in run)) started.push(run);
    }
    return started;
  }

  // ---------------------------------------------------------------- proposals

  async proposals(status?: Proposal['status']): Promise<Proposal[]> {
    return (await this.store.listProposals()).filter((p) => !status || p.status === status);
  }

  /** A person approves or denies: a durable signal to the parked propose_action call, which then continues. */
  async decide(proposalId: string, decision: Decision): Promise<Proposal | WorkflowError> {
    const proposal = await this.store.getProposal(proposalId);
    if (!proposal) return { error: 'No such proposal.', status: 404 };
    if (proposal.status !== 'pending') return { error: `This proposal is already ${proposal.status}.`, status: 409 };
    const taskId = await this.store.taskForProposal(proposalId);
    if (taskId === undefined) return { error: 'The proposal has no waiting run.', status: 409 };
    const result = await this.harness.signal(taskId, DecisionSignal, 'decision', decision);
    if (result !== 'delivered' && result !== 'duplicate') return { error: `The run could not take the decision (${result}).`, status: 409 };
    this.ctx.waitUntil(this.#settle(proposal.runId));
    return { ...proposal, status: decision.approved ? 'approved' : 'denied', decidedBy: decision.by, note: decision.note || null };
  }

  /** Undo an applied action: a compensating RMS task, audited. */
  async undo(proposalId: string, by: string): Promise<AuditEntry | WorkflowError> {
    const proposal = await this.store.getProposal(proposalId);
    if (!proposal) return { error: 'No such proposal.', status: 404 };
    if (proposal.status !== 'applied') return { error: `Only applied proposals can be undone (this one is ${proposal.status}).`, status: 409 };
    const entry: AuditEntry = {
      id: `audit-${crypto.randomUUID().slice(0, 8)}`,
      at: new Date().toISOString(),
      workflowId: proposal.workflowId,
      proposalId,
      hotel_code: proposal.hotel_code,
      action: proposal.action,
      by,
      outcome: 'undone',
      receipt: `RMS task to revert: ${proposal.title} (${proposal.change.after} → ${proposal.change.before}, ${proposal.change.scope}).`,
    };
    await this.store.appendAudit(entry);
    await this.store.updateProposal({ ...proposal, status: 'undone' });
    return entry;
  }

  audit(): Promise<AuditEntry[]> {
    return this.store.listAudit();
  }

  // ---------------------------------------------------------------- internals

  /** Waits for a run's operation to settle, then records its outcome. Safe to call more than once. */
  async #settle(runId: string): Promise<void> {
    const run = await this.store.getRun(runId);
    if (!run || run.status === 'done' || run.status === 'failed') return;
    const result = await this.harness.session(run.sessionId).wait(run.id, AbortSignal.timeout(14 * 60_000)).catch(() => null);
    if (!result) return; // still waiting (e.g. for approval); the decision settles it later
    const status = result.status === 'done' ? 'done' : 'failed';
    const endedAt = new Date().toISOString();
    await this.store.updateRun(runId, { status, endedAt, summary: result.text ?? result.reason ?? null });
    const workflow = await this.store.getWorkflow(run.workflowId);
    if (!workflow) return;
    // An email workflow that has used up its days or its emails turns itself off here, not only at its next run.
    const enabled = workflow.enabled && !emailWorkflowBlocked(workflow, new Date());
    await this.store.putWorkflow({ ...workflow, enabled, lastRun: { runId, at: run.startedAt, status } });
  }

  #createRegistry() {
    const registry = createRegistry();
    registry.install({ name: 'kassandra', sections: KASSANDRA_SECTIONS });
    registry.install(
      createDataExtension(() => {
        const db = openPostgres(this.env.HYPERDRIVE.connectionString);
        return { data: new HotelData(db, new WorkersAiEmbedder(this.env.AI)), close: () => db.close() };
      }),
    );
    registry.install(createWorkflowExtension(this.store));
    // The quota sits on this object's own storage: there is one WorkflowAgents object, so every send passes through it.
    registry.install(
      createEmailExtension({
        store: this.store,
        sender: new CloudflareEmailSender(this.env.EMAIL),
        quota: new DurableEmailQuota(this.ctx.storage),
        appUrl: this.env.APP_URL,
      }),
    );
    return registry;
  }
}
