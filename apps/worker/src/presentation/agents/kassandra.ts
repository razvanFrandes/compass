import type { ChatClientMessage, ChatEntry, ChatServerMessage, ThreadMeta, Widget } from '@compass/contracts';
import { DurableObject } from 'cloudflare:workers';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness, type Extension } from '@earendil-works/pi-durable';
import { PiHarness, ROOT_SESSION } from 'agents/harness/pi';
import { Lifecycle } from 'agents/lifecycle';
import { createAI } from 'agents/models/pi-ai';
import { HotelData } from '../../application/hotel-data.ts';
import { openPostgres } from '../../infrastructure/postgres.ts';
import { WorkersAiEmbedder } from '../../infrastructure/workers-ai-embedder.ts';
import type { Env } from '../../env.ts';
import { firstExchange, renameMeta, summarizeThread } from '../../application/thread-summary.ts';
import { createClaudeThreadSummaryWriter } from '../../infrastructure/thread-summary-writer.ts';
import type { Result } from '../../domain/result.ts';
import { projectEntries } from './chat-projection.ts';
import { serveChatSocket } from './chat-socket.ts';
import { KASSANDRA_SECTIONS } from './kassandra-prompt.ts';
import { agentChangeFor, THINKER_MODEL, type AnswerMode } from './modes.ts';
import { createDataExtension } from './pi-data-extension.ts';
import { widgetsOfLastAnswer, withWidgets } from './widgets.ts';
import { createDraftWorkflowExtension } from '../../application/workflows/draft-tool.ts';
import { BUDGET_NAME } from '../budget.ts';
import { budgetMessage } from '../http/budget-response.ts';
import { PublicError } from '../http/errors.ts';
import { scopeFor } from '../hotels.ts';
import type { ScopeHotel } from '../../domain/scope.ts';
import { scopeInstructions } from './scope-prompt.ts';

export interface KassandraAnswer {
  status: 'done' | 'unanswered';
  text: string | null;
  reason: string | null;
  durationMs: number;
  mode: AnswerMode;
  /** The widgets Kassandra showed with this answer (show_widget), in order. */
  widgets: Widget[];
}

/**
 * Kassandra: one Durable Object per conversation, running a durable Pi agent (pi-durable via PiHarness).
 * The transcript, tool calls and retries live in the object's SQLite, so a deploy or an eviction mid-answer
 * resumes instead of losing the conversation. Claude is reached through AI Gateway "compass", which holds the
 * Anthropic key (BYOK alias "compass"); the Worker holds no provider key.
 */
export class Kassandra extends DurableObject<Env> {
  ai = createAI({ binding: this.env.AI, gateway: { id: 'compass', byokAlias: 'compass', collectLog: true } });

  // One registry per object, never at module scope: Pi keeps each Harness subscribed to its registry.
  // The hotel scope of the conversation is kept in storage (`scope`: hotel codes), so a run that resumes after an
  // eviction reads the same hotels. Every tool call reads it.
  // The data tools, plus show_widget: a chart, table or KPI drawn from the rows of one of their results.
  data = withWidgets(
    createDataExtension(
      () => {
        const db = openPostgres(this.env.HYPERDRIVE.connectionString);
        return { data: new HotelData(db, new WorkersAiEmbedder(this.env.AI)), close: () => db.close() };
      },
      async () => (await this.ctx.storage.get<string[]>('scope')) ?? [],
    ),
  );
  registry = createKassandraRegistry(this.data);

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
    defaults: { model: this.ai(THINKER_MODEL), thinkingLevel: 'low', maxTurns: 10 },
  });

  lifecycle = Lifecycle.install(this).use(this.harness);

  /**
   * The chat WebSocket. The server sends a snapshot, then each new transcript entry once and every change of the
   * live state (streamed text, running tools, failures). The client asks, steers or aborts. Watches live in memory,
   * so a reconnect after a restart simply gets a fresh snapshot of the durable transcript.
   */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const conversation = new URL(request.url).searchParams.get('conversation') ?? '';
    const client = request.headers.get('cf-connecting-ip') ?? 'local';
    const { 0: browser, 1: server } = new WebSocketPair();
    server.accept();
    this.ctx.waitUntil(
      serveChatSocket(server, this.harness.session(), {
        conversation,
        name: 'Kassandra',
        onMessage: (raw) => this.#onClientMessage(raw, client),
        onOpen: async (send) => {
          const meta = await this.ctx.storage.get<ThreadMeta>('meta');
          if (meta) send({ type: 'meta', meta });
        },
        onEntries: (fresh, send) => this.#afterEntries(fresh, send),
      }),
    );
    return new Response(null, { status: 101, webSocket: browser });
  }

  async #onClientMessage(raw: unknown, client: string): Promise<void> {
    let message: ChatClientMessage;
    try {
      message = JSON.parse(String(raw)) as ChatClientMessage;
    } catch {
      throw new PublicError('Send a JSON message.');
    }
    const session = this.harness.session();
    if (message.type === 'abort') {
      await session.abort();
      return;
    }
    const text = message.text?.trim();
    if (typeof text !== 'string' || !text || text.length > 2000) throw new PublicError('Ask a question of up to 2,000 characters.');
    // Every question spends model tokens: rate-limited per client and counted against the demo's daily budget.
    if (!(await this.env.ASK_RATE_LIMIT.limit({ key: client })).success) {
      throw new PublicError('Too many questions. Wait a minute and try again.');
    }
    // A scope that is not valid is refused before the question takes from the budget.
    let scope: ScopeHotel[] = [];
    if (message.type === 'ask') {
      const resolved = await scopeFor(this.env, message.scope);
      if (!resolved.ok) throw new PublicError(resolved.error.message);
      scope = resolved.value;
    }
    const budget = await this.env.BUDGET.getByName(BUDGET_NAME).take('question');
    if (!budget.ok) throw new PublicError(budgetMessage(budget));
    if (message.type === 'steer') await session.steer(text);
    else {
      await this.#useMode(message.mode ?? 'thinker', scope);
      await session.submit(text, message.id ? { operationId: message.id } : undefined);
    }
  }

  /**
   * Switches the conversation's agent to a mode (model, offered tools, turn limit) and a hotel scope before a
   * question. While a run is going the change would reach it mid-answer, so a question sent then keeps the current
   * mode and scope. The scope is in two places that change together: the codes the tools read from storage, and
   * the instructions that name the hotels.
   */
  async #useMode(mode: AnswerMode, scope: readonly ScopeHotel[]): Promise<void> {
    if (await this.harness.session().busy()) return;
    await this.ctx.storage.put('scope', scope.map((hotel) => hotel.code));
    const conversation = await this.harness.conversation(ROOT_SESSION);
    await conversation.configure(agentChangeFor(mode, this.data, scopeInstructions(scope)), BACKGROUND_CONTEXT);
  }

  /** Ask a question in this conversation and wait for the answer. `scope` is already checked (`scopeFor`). */
  async ask(question: string, mode: AnswerMode = 'thinker', operationId?: string, scope: readonly ScopeHotel[] = []): Promise<KassandraAnswer> {
    const started = Date.now();
    await this.#useMode(mode, scope);
    const result = await this.harness.prompt(question, operationId ? { operationId } : undefined);
    const widgets = widgetsOfLastAnswer(projectEntries(await this.harness.session().messages()));
    // The sidebar's title, once: not awaited, the answer does not wait for it.
    if (result.status === 'done') void this.meta().catch((error: unknown) => console.warn('thread meta failed', error));
    return {
      status: result.status,
      text: result.text ?? null,
      reason: result.reason ?? null,
      durationMs: Date.now() - started,
      mode,
      widgets,
    };
  }

  /* ── The sidebar's title and takeaway (application/thread-summary.ts) ── */

  #summarizing: Promise<ThreadMeta | null> | null = null;

  /** Once the first answer is final, its title and takeaway go to the client that is watching. */
  async #afterEntries(fresh: readonly ChatEntry[], send: (message: ChatServerMessage) => void): Promise<void> {
    if (!fresh.some((entry) => entry.kind === 'assistant' && entry.stopReason === 'stop')) return;
    if (await this.ctx.storage.get<boolean>('summarized')) return;
    const meta = await this.meta();
    if (meta) send({ type: 'meta', meta });
  }

  /**
   * The conversation's meta. Written once, after the first answer, with one Quick model call taken from the daily
   * budget (`thread_title`); with no budget left, or if the call fails, the title is the cleaned question. Null for a
   * conversation that has not been asked anything, or whose first answer is not in yet.
   */
  async meta(): Promise<ThreadMeta | null> {
    const stored = (await this.ctx.storage.get<ThreadMeta>('meta')) ?? null;
    if (await this.ctx.storage.get<boolean>('summarized')) return stored;
    // Asked nothing yet (the scope is stored before every question): no transcript to read, nothing to open.
    const hotels = await this.ctx.storage.get<string[]>('scope');
    if (!hotels) return stored;
    this.#summarizing ??= this.#summarize(hotels).finally(() => (this.#summarizing = null));
    return this.#summarizing;
  }

  async #summarize(hotels: string[]): Promise<ThreadMeta | null> {
    const exchange = firstExchange(projectEntries(await this.harness.session().messages()));
    if (!exchange) return (await this.ctx.storage.get<ThreadMeta>('meta')) ?? null;
    const budget = await this.env.BUDGET.getByName(BUDGET_NAME).take('thread_title');
    const writer = budget.ok ? createClaudeThreadSummaryWriter(this.env.AI) : null;
    const written = await summarizeThread(writer, exchange, hotels, await this.ctx.storage.get<ThreadMeta>('meta'));
    // A rename may have landed while the model wrote: the person's title wins.
    const latest = await this.ctx.storage.get<ThreadMeta>('meta');
    const meta = latest?.renamed ? { ...written, title: latest.title, renamed: true } : written;
    await this.ctx.storage.put({ meta, summarized: true });
    return meta;
  }

  /** A title from the person. It is kept over the one the model writes. */
  async rename(title: string): Promise<Result<ThreadMeta, string>> {
    const next = renameMeta((await this.ctx.storage.get<ThreadMeta>('meta')) ?? null, title);
    if (next.ok) await this.ctx.storage.put('meta', next.value);
    return next;
  }

  /**
   * Deletes the conversation: the run stops, the transcript, the scope and the meta go. The object then restarts, so
   * nothing it held in memory outlives the delete.
   */
  async forget(): Promise<void> {
    try {
      if (await this.harness.session().busy()) await this.harness.session().abort();
    } catch (error) {
      console.warn('kassandra forget: abort failed', error);
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    setTimeout(() => {
      try {
        this.ctx.abort('conversation deleted');
      } catch {
        // Not available everywhere (local dev): the object is evicted in time anyway.
      }
    }, 0);
  }
}

function createKassandraRegistry(data: Extension) {
  const registry = createRegistry();
  registry.install({ name: 'kassandra', sections: KASSANDRA_SECTIONS });
  registry.install(data);
  registry.install(createDraftWorkflowExtension());
  return registry;
}
