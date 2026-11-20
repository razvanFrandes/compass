import {
  specToGraph,
  type BuilderClientMessage,
  type BuilderServerMessage,
  type ChatEntry,
  type WorkflowDraft,
  type WorkflowGraph,
  type WorkflowRun,
} from '@compass/contracts';
import { DurableObject } from 'cloudflare:workers';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness, type Extension } from '@earendil-works/pi-durable';
import { PiHarness, ROOT_SESSION } from 'agents/harness/pi';
import { Lifecycle } from 'agents/lifecycle';
import { createAI } from 'agents/models/pi-ai';
import { HotelData } from '../../application/hotel-data.ts';
import { clientPatch, editEntry, EditLimiter, mergeChanged, savePlan } from '../../application/workflows/builder-edits.ts';
import { createBuilderExtension, type DraftHost } from '../../application/workflows/builder-tools.ts';
import { applyDraftPatch, draftIssues } from '../../application/workflows/draft.ts';
import { followEnds, runProgress } from '../../application/workflows/run-progress.ts';
import type { Env } from '../../env.ts';
import { openPostgres } from '../../infrastructure/postgres.ts';
import { WorkersAiEmbedder } from '../../infrastructure/workers-ai-embedder.ts';
import { BUDGET_NAME } from '../budget.ts';
import { budgetMessage } from '../http/budget-response.ts';
import { PublicError } from '../http/errors.ts';
import { DATA_TOOLS } from '../tools/catalog.ts';
import { BUILDER_SECTIONS } from './builder-prompt.ts';
import { serveChatSocket } from './chat-socket.ts';
import { THINKER_MODEL } from './modes.ts';
import { createDataExtension } from './pi-data-extension.ts';
import type { WorkflowError } from './workflow-agents.ts';

/** The data tools a workflow may name as a check: every read-only tool of the catalog. */
const ALLOWED_CHECKS = DATA_TOOLS.map((tool) => tool.name);

/** A client message is a question or a patch of a few fields; nothing legitimate is larger. */
const MAX_MESSAGE_CHARS = 16_000;
const POLL_MS = 1_000;
const FOLLOW_MS = 3 * 60_000;

type Send = (message: BuilderServerMessage) => void;

/**
 * The workflow builder: one Durable Object per draft, running a durable Pi agent like Kassandra. The agent edits the
 * draft through tools, one node per call; the person edits it on the canvas. Every change is sent to the open
 * sockets as a `draft` message with the graph. The object also saves the draft as a workflow and follows its test
 * runs, mapped to the graph's nodes.
 *
 * The draft holds the recipient's address in full: `WorkflowAgents` only ever returns it masked, so this object is
 * what remembers it between the conversation and the save. Storage keys: `draft`, `workflowId`, `saved` (the draft
 * as last saved, to tell what a later save has to change) and `edited` (the nodes edited by hand since the agent
 * was last told).
 */
export class WorkflowBuilder extends DurableObject<Env> {
  ai = createAI({ binding: this.env.AI, gateway: { id: 'compass', byokAlias: 'compass', collectLog: true } });

  /** The open sockets. In memory: a socket does not outlive the object. */
  #sockets = new Set<Send>();
  /** Edits and saves run one at a time: two edits must not start from the same draft, nor two saves create two workflows. */
  #queue: Promise<unknown> = Promise.resolve();
  /** A test run this object started and still follows. */
  #testing = false;
  #editLimit = new EditLimiter();

  host: DraftHost = {
    get: () => this.#draft(),
    apply: async (patch) => {
      const applied = await this.#apply(patch);
      return 'error' in applied ? applied : { changed: applied.changed };
    },
  };

  // One registry per object, never at module scope: Pi keeps each Harness subscribed to its registry.
  registry = createBuilderRegistry(
    createDataExtension(() => {
      const db = openPostgres(this.env.HYPERDRIVE.connectionString);
      return { data: new HotelData(db, new WorkersAiEmbedder(this.env.AI)), close: () => db.close() };
    }),
    this.host,
  );

  harness = new PiHarness({
    harness: ({ storage, context, onWake }) => {
      const models = createModels();
      models.setProvider(this.ai.provider);
      return Harness.open(
        storage,
        {
          models,
          registry: this.registry,
          onWake,
          settings: { afterFailedRun: 'withdraw', retry: { maxRetries: 2 } },
          onReport: (report) => console.warn('pi report', report.kind, report.error),
        },
        context,
      );
    },
    // One tool call per node and a look at the data: a full chain takes about ten turns.
    defaults: { model: this.ai(THINKER_MODEL), thinkingLevel: 'low', maxTurns: 16 },
  });

  lifecycle = Lifecycle.install(this).use(this.harness);

  /** The builder WebSocket: Kassandra's chat protocol, plus `draft` and `run` messages. */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const draftId = new URL(request.url).searchParams.get('draft') ?? '';
    const client = request.headers.get('cf-connecting-ip') ?? 'local';
    const { 0: browser, 1: server } = new WebSocketPair();
    server.accept();
    let opened: Send | undefined;
    this.ctx.waitUntil(
      serveChatSocket(server, this.harness.session(), {
        conversation: draftId,
        name: 'Workflow builder',
        onMessage: (raw) => this.#onClientMessage(raw, client),
        onOpen: async (send) => {
          opened = send;
          this.#sockets.add(send);
          send(await this.#draftMessage(await this.#draft(), []));
        },
      }).finally(() => {
        if (opened) this.#sockets.delete(opened);
      }),
    );
    return new Response(null, { status: 101, webSocket: browser });
  }

  // ---------------------------------------------------------------- the draft

  async #draft(): Promise<WorkflowDraft> {
    return (await this.ctx.storage.get<WorkflowDraft>('draft')) ?? {};
  }

  async #workflowId(): Promise<string | null> {
    return (await this.ctx.storage.get<string>('workflowId')) ?? null;
  }

  /** Validates and stores one patch, then tells every socket. On an error nothing changes and nothing is sent. */
  #apply(patch: WorkflowDraft): Promise<{ draft: WorkflowDraft; changed: string[] } | { error: string }> {
    return this.#inTurn(async () => {
      const current = await this.#draft();
      const applied = applyDraftPatch(current, patch, ALLOWED_CHECKS);
      if ('error' in applied) return applied;
      // A patch that repeats what the draft already says writes nothing; the sender still gets the draft back.
      if (JSON.stringify(applied.draft) !== JSON.stringify(current)) await this.ctx.storage.put('draft', applied.draft);
      this.#broadcast(await this.#draftMessage(applied.draft, applied.changed));
      return applied;
    });
  }

  /** Runs `work` after everything queued before it, whether that succeeded or not. */
  #inTurn<T>(work: () => Promise<T>): Promise<T> {
    const next = this.#queue.then(work);
    this.#queue = next.catch(() => undefined);
    return next;
  }

  async #draftMessage(draft: WorkflowDraft, changed: string[]): Promise<BuilderServerMessage> {
    return { type: 'draft', draft, graph: specToGraph(draft), changed, workflowId: await this.#workflowId(), issues: draftIssues(draft) };
  }

  #broadcast(message: BuilderServerMessage): void {
    for (const send of this.#sockets) send(message);
  }

  // ---------------------------------------------------------------- client messages

  async #onClientMessage(raw: unknown, client: string): Promise<void> {
    let message: BuilderClientMessage;
    try {
      if (String(raw).length > MAX_MESSAGE_CHARS) throw new Error('too large');
      message = JSON.parse(String(raw)) as BuilderClientMessage;
    } catch {
      throw new PublicError('Send a JSON message of at most 16 KB.');
    }
    const session = this.harness.session();
    switch (message?.type) {
      case 'abort':
        await session.abort();
        return;
      case 'edit':
        return this.#edit(message.patch, client);
      case 'save':
        await this.#save();
        return;
      case 'test':
        return this.#test(client);
      case 'ask':
      case 'steer': {
        const text = typeof message.text === 'string' ? message.text.trim() : '';
        if (!text || text.length > 2000) throw new PublicError('Send a question of 1–2000 characters.');
        // Every question spends model tokens: rate-limited per client and counted against the demo's daily budget.
        if (!(await this.env.ASK_RATE_LIMIT.limit({ key: client })).success) {
          throw new PublicError('Too many questions. Wait a minute and try again.');
        }
        const budget = await this.env.BUDGET.getByName(BUDGET_NAME).take('question');
        if (!budget.ok) throw new PublicError(budgetMessage(budget));
        await this.#noteEdits();
        if (message.type === 'steer') await session.steer(text);
        else await session.submit(text, message.id ? { operationId: message.id } : undefined);
        return;
      }
      default:
        throw new PublicError('Unknown message type. Send ask, steer, abort, edit, save or test.');
    }
  }

  /**
   * A manual edit on the canvas, applied like a tool's. The transcript is not written here: an edit only remembers
   * which nodes changed, and the next question carries one note for all of them (`#noteEdits`). So edits, which are
   * free, cannot grow the transcript or the context of the next question.
   */
  async #edit(rawPatch: unknown, client: string): Promise<void> {
    if (!this.#editLimit.allow(client, Date.now())) throw new PublicError('Too many edits. Wait a minute and try again.');
    const patch = clientPatch(rawPatch);
    if (!patch) throw new PublicError('Send { "type": "edit", "patch": { … } } with the fields to change.');
    const applied = await this.#apply(patch);
    if ('error' in applied) throw new PublicError(applied.error);
    if (!applied.changed.length) return;
    await this.#inTurn(async () => {
      await this.ctx.storage.put('edited', mergeChanged(await this.ctx.storage.get<string[]>('edited'), applied.changed));
    });
  }

  /**
   * Tells the agent about the edits made by hand since it was last told, in one `app.edit` entry with the chain as
   * it now reads. A write places an entry without starting a run; while a run is going it joins after the current
   * tool round.
   */
  async #noteEdits(): Promise<void> {
    await this.#inTurn(async () => {
      const edited = await this.ctx.storage.get<string[]>('edited');
      if (!edited?.length) return;
      const conversation = await this.harness.conversation(ROOT_SESSION);
      await conversation.submit({ type: 'write', entry: editEntry(await this.#draft(), edited, Date.now()) }, BACKGROUND_CONTEXT);
      await this.ctx.storage.delete('edited');
    });
  }

  // ---------------------------------------------------------------- save and test

  /**
   * Saves the draft as a workflow and returns its id. The first save creates it; a later one updates it, without
   * the recipient, which a saved workflow never changes. A draft with another recipient becomes a new workflow, and
   * the one it replaces is turned off so that it stops mailing the old address.
   */
  #save(): Promise<{ workflowId: string; draft: WorkflowDraft }> {
    return this.#inTurn(() => this.#saveNow());
  }

  async #saveNow(): Promise<{ workflowId: string; draft: WorkflowDraft }> {
    const draft = await this.#draft();
    const issues = draftIssues(draft);
    if (issues.length) throw new PublicError(`The workflow cannot be saved yet. ${issues.join(' ')}`);

    const agents = this.env.WORKFLOWS.getByName('halcyon');
    const current = await this.#workflowId();
    const plan = savePlan(draft, (await this.ctx.storage.get<WorkflowDraft>('saved')) ?? null, current);
    if (plan.kind === 'none' && current) {
      // Nothing to change, but the client that asked still gets its answer.
      this.#broadcast(await this.#draftMessage(draft, []));
      return { workflowId: current, draft };
    }

    let workflowId = current;
    if (plan.kind === 'update' && current) {
      const updated = await agents.update(current, plan.patch as never);
      if ('error' in updated) throw new PublicError(updated.error);
    } else {
      const created = await agents.create(draft as never);
      if ('error' in created) throw new PublicError(created.error);
      workflowId = created.id;
    }
    // Stored before the old workflow is turned off: if that fails, the next save must not create a third one.
    await this.ctx.storage.put({ workflowId, saved: draft });
    this.#broadcast(await this.#draftMessage(draft, []));
    if (plan.kind === 'replace' && current) {
      const stopped = await agents.update(current, { enabled: false });
      if ('error' in stopped) {
        console.error('workflow builder could not turn off the replaced workflow', current, stopped.error);
        throw new PublicError(`Saved as a new workflow, but the earlier one (${current}) could not be turned off. Turn it off in the workflow list.`);
      }
    }
    return { workflowId: workflowId as string, draft };
  }

  /** "Send test now": saves if needed, starts a test run and follows it on the graph. */
  async #test(client: string): Promise<void> {
    if (this.#testing) throw new PublicError('A test run is already in progress.');
    this.#testing = true;
    let following = false;
    try {
      const { workflowId, draft } = await this.#save();
      // A run spends model tokens: counted against the daily budget, like "Run now". It does not take from the
      // per-minute limit of the questions, or a person who has just talked the workflow through could not test it.
      // What bounds tests: this budget, one test at a time per draft (`#testing`), and the email limits.
      const budget = await this.env.BUDGET.getByName(BUDGET_NAME).take('workflow_run');
      if (!budget.ok) throw new PublicError(budgetMessage(budget));

      const run = await this.env.WORKFLOWS.getByName('halcyon').run(workflowId, 'manual', 'test from builder', { test: true, client });
      if ('error' in run) throw new PublicError(run.error);
      following = true;
      this.ctx.waitUntil(
        this.#follow(run.id, specToGraph(draft))
          .catch((error: unknown) => {
            console.error('workflow builder could not follow the run', error);
            this.#broadcast({ type: 'error', message: 'The test run could not be followed. See the workflow for its result.' });
          })
          .finally(() => {
            this.#testing = false;
          }),
      );
    } finally {
      if (!following) this.#testing = false;
    }
  }

  /**
   * Polls the run's log and sends its place on the graph each time it changes, until the run ends or parks for an
   * approval (the last `run` message carries that status), nobody is listening any more, or 3 minutes pass. After
   * 3 minutes the builder gives up on the run (which may still finish): it sends a last `run` message as failed on
   * the node the run was on, and an `error` saying where to look.
   */
  async #follow(runId: string, graph: WorkflowGraph): Promise<void> {
    const agents = this.env.WORKFLOWS.getByName('halcyon');
    const until = Date.now() + FOLLOW_MS;
    let last = '';
    for (;;) {
      // The RPC stub's type loses the log (its entries hold `unknown` data), so it is named here.
      const log = (await agents.runLog(runId)) as unknown as { run: WorkflowRun; entries: ChatEntry[] } | WorkflowError;
      if ('error' in log) throw new Error(log.error);
      const { status } = log.run;
      const message: BuilderServerMessage = { type: 'run', runId, status, ...runProgress(log.entries, graph, status) };
      const text = JSON.stringify(message);
      if (text !== last) {
        last = text;
        this.#broadcast(message);
      }
      if (followEnds(status) || this.#sockets.size === 0) return;
      if (Date.now() >= until) {
        this.#broadcast({ type: 'run', runId, status: 'failed', ...runProgress(log.entries, graph, 'failed') });
        this.#broadcast({ type: 'error', message: 'The test run is taking too long; check the run log.' });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }
}

function createBuilderRegistry(data: Extension, host: DraftHost) {
  const registry = createRegistry();
  registry.install({ name: 'workflow-builder', sections: BUILDER_SECTIONS });
  registry.install(createBuilderExtension(host, ALLOWED_CHECKS));
  registry.install(data);
  return registry;
}
