import { WorkflowSpec, type AuditEntry, type Brief, type ChatEntry, type Decision, type Proposal, type Workflow, type WorkflowRun, type WorkflowSpecInput } from '@compass/contracts';
import { DurableObject } from 'cloudflare:workers';
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { PiHarness } from 'agents/harness/pi';
import { Lifecycle } from 'agents/lifecycle';
import { createAI } from 'agents/models/pi-ai';
import { HotelData } from '../../application/hotel-data.ts';
import { admitWorkflow, mayEnable } from '../../application/workflows/capacity.ts';
import { createEmailExtension } from '../../application/workflows/email-tool.ts';
import { emailWorkflowBlocked, publicRun, publicWorkflow, recipientChanged } from '../../application/workflows/email.ts';
import { lazySettlement, probeOfWait } from '../../application/workflows/run-settle.ts';
import { isDue, lastRealRunAt } from '../../application/workflows/schedule.ts';
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

/** How long a read waits to learn whether a run's Pi operation has already ended. */
const PROBE_MS = 250;

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
    // Only enabled workflows count towards the cap; at 100 stored, the oldest that is off makes room (capacity.ts).
    const admitted = admitWorkflow(await this.#workflows(), parsed.data.enabled);
    if (!admitted.ok) return { error: admitted.error, status: 409 };
    for (const evicted of admitted.evict) await this.store.deleteWorkflow(evicted);
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
    // Turning a workflow on is held to the same cap as creating one, or a PATCH would be the way around it.
    if (parsed.data.enabled && !current.enabled) {
      const allowed = mayEnable(await this.#workflows(), id);
      if (!allowed.ok) return { error: allowed.error, status: 409 };
    }
    const workflow: Workflow = { ...current, ...parsed.data };
    await this.store.putWorkflow(workflow);
    return publicWorkflow(workflow);
  }

  // ---------------------------------------------------------------- runs

  /**
   * Starts a run. `opts.test` is a "send test now" run: an email workflow then always sends, marked as a test.
   * `opts.client` is who asked (the client address), for the email limits; without it a scheduled or brief run counts
   * as 'cron' and any other as 'manual'. Only a manual run is held to the per-client email limit (email-tool.ts).
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
    // A run still stored as running may have ended while nobody waited for it (a deploy, an eviction): settle it first.
    const runs: WorkflowRun[] = [];
    for (const stored of await this.store.listRuns(id)) runs.push(await this.#settleLazily(stored));
    const active = runs.find((r) => r.status === 'running' || r.status === 'waiting_approval');
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
    const stored = await this.store.getRun(runId);
    if (!stored) return { error: 'No such run.', status: 404 };
    const run = await this.#settleLazily(stored);
    const entries = projectEntries(await this.harness.session(run.sessionId).messages());
    return { run: publicRun((await this.store.getRun(runId)) ?? run), entries };
  }

  /**
   * Runs the enabled workflows the morning brief calls for: brief findings for their hotels, and the scheduled ones
   * that are due (`isDue`): a daily one every morning, a weekly one a week after its last run that was not a test.
   */
  async runTriggered(brief: Brief): Promise<WorkflowRun[]> {
    const started: WorkflowRun[] = [];
    const now = new Date();
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
      else if (!isDue(workflow, lastRealRunAt(await this.store.listRuns(workflow.id)), now)) continue;
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
    const probe = probeOfWait(await this.harness.session(run.sessionId).wait(run.id, AbortSignal.timeout(14 * 60_000)).catch(() => null));
    // No ending: still waiting (e.g. for approval), or Pi has no such operation. The decision settles it later, or the next read does.
    if (!probe || !('finished' in probe)) return;
    await this.#record(runId, { ...probe.finished, endedAt: new Date().toISOString() });
  }

  /**
   * `#settle` waits in memory, so a deploy or an eviction loses it and the run would stay `running` for good. Called
   * wherever a run is read: a run stored as `running` whose Pi operation has ended is recorded with its outcome, and
   * one older than 15 minutes whose session is not working is recorded as failed. Returns the run as it now is.
   */
  async #settleLazily(run: WorkflowRun): Promise<WorkflowRun> {
    if (run.status !== 'running') return run;
    const session = this.harness.session(run.sessionId);
    // A run stored but not yet submitted resolves as `not_found`: `probeOfWait` does not take that for an ending.
    const probe = probeOfWait(await session.wait(run.id, AbortSignal.timeout(PROBE_MS)).catch(() => null)) ?? {
      live: await session.busy().catch(() => false),
    };
    const outcome = lazySettlement(run, probe, new Date());
    if (!outcome) return run;
    await this.#record(run.id, outcome);
    return (await this.store.getRun(run.id)) ?? run;
  }

  /** Records how a run ended, on the run and on its workflow. A run already recorded as ended is left as it is. */
  async #record(runId: string, outcome: Pick<WorkflowRun, 'status' | 'endedAt' | 'summary'>): Promise<void> {
    const run = await this.store.getRun(runId);
    if (!run || run.status === 'done' || run.status === 'failed') return;
    await this.store.updateRun(runId, outcome);
    const workflow = await this.store.getWorkflow(run.workflowId);
    if (!workflow) return;
    // An email workflow that has used up its days or its emails turns itself off here, not only at its next run.
    const enabled = workflow.enabled && !emailWorkflowBlocked(workflow, new Date());
    // A later run of the workflow may have started since: only this run's own `lastRun` is updated.
    const lastRun = workflow.lastRun?.runId === runId || !workflow.lastRun ? { runId, at: run.startedAt, status: outcome.status } : workflow.lastRun;
    await this.store.putWorkflow({ ...workflow, enabled, lastRun });
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
