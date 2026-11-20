import type { ChatClientMessage, Widget } from '@compass/contracts';
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
  // The data tools, plus show_widget: a chart, table or KPI drawn from the rows of one of their results.
  data = withWidgets(
    createDataExtension(() => {
      const db = openPostgres(this.env.HYPERDRIVE.connectionString);
      return { data: new HotelData(db, new WorkersAiEmbedder(this.env.AI)), close: () => db.close() };
    }),
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
    if (typeof text !== 'string' || !text || text.length > 2000) throw new PublicError('Send a question of 1–2000 characters.');
    // Every question spends model tokens: rate-limited per client and counted against the demo's daily budget.
    if (!(await this.env.ASK_RATE_LIMIT.limit({ key: client })).success) {
      throw new PublicError('Too many questions. Wait a minute and try again.');
    }
    const budget = await this.env.BUDGET.getByName(BUDGET_NAME).take('question');
    if (!budget.ok) throw new PublicError(budgetMessage(budget));
    if (message.type === 'steer') await session.steer(text);
    else {
      await this.#useMode(message.mode ?? 'thinker');
      await session.submit(text, message.id ? { operationId: message.id } : undefined);
    }
  }

  /**
   * Switches the conversation's agent to a mode (model, offered tools, turn limit) before a question. While a run is
   * going the change would reach it mid-answer, so a question sent then keeps the current mode.
   */
  async #useMode(mode: AnswerMode): Promise<void> {
    if (await this.harness.session().busy()) return;
    const conversation = await this.harness.conversation(ROOT_SESSION);
    await conversation.configure(agentChangeFor(mode, this.data), BACKGROUND_CONTEXT);
  }

  /** Ask a question in this conversation and wait for the answer. */
  async ask(question: string, mode: AnswerMode = 'thinker', operationId?: string): Promise<KassandraAnswer> {
    const started = Date.now();
    await this.#useMode(mode);
    const result = await this.harness.prompt(question, operationId ? { operationId } : undefined);
    const widgets = widgetsOfLastAnswer(projectEntries(await this.harness.session().messages()));
    return {
      status: result.status,
      text: result.text ?? null,
      reason: result.reason ?? null,
      durationMs: Date.now() - started,
      mode,
      widgets,
    };
  }
}

function createKassandraRegistry(data: Extension) {
  const registry = createRegistry();
  registry.install({ name: 'kassandra', sections: KASSANDRA_SECTIONS });
  registry.install(data);
  registry.install(createDraftWorkflowExtension());
  return registry;
}
