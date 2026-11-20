import type { ChatClientMessage, ChatServerMessage } from '@compass/contracts';
import { DurableObject } from 'cloudflare:workers';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness, type Extension } from '@earendil-works/pi-durable';
import { PiHarness, ROOT_SESSION, type PiSession } from 'agents/harness/pi';
import { Lifecycle } from 'agents/lifecycle';
import { createAI } from 'agents/models/pi-ai';
import { HotelData } from '../../application/hotel-data.ts';
import { openPostgres } from '../../infrastructure/postgres.ts';
import { WorkersAiEmbedder } from '../../infrastructure/workers-ai-embedder.ts';
import type { Env } from '../../env.ts';
import { projectEntries, projectLive } from './chat-projection.ts';
import { KASSANDRA_SECTIONS } from './kassandra-prompt.ts';
import { agentChangeFor, THINKER_MODEL, type AnswerMode } from './modes.ts';
import { createDataExtension } from './pi-data-extension.ts';
import { createDraftWorkflowExtension } from '../../application/workflows/draft-tool.ts';
import { BUDGET_NAME } from '../budget.ts';
import { budgetMessage } from '../http/budget-response.ts';
import { PublicError, publicMessage } from '../http/errors.ts';

export interface KassandraAnswer {
  status: 'done' | 'unanswered';
  text: string | null;
  reason: string | null;
  durationMs: number;
  mode: AnswerMode;
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
  data = createDataExtension(() => {
    const db = openPostgres(this.env.HYPERDRIVE.connectionString);
    return { data: new HotelData(db, new WorkersAiEmbedder(this.env.AI)), close: () => db.close() };
  });
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
    this.ctx.waitUntil(this.#serve(server, conversation, client));
    return new Response(null, { status: 101, webSocket: browser });
  }

  async #serve(socket: WebSocket, conversation: string, client: string): Promise<void> {
    const send = (message: ChatServerMessage) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };
    let watch: Awaited<ReturnType<PiSession['watch']>> | undefined;
    const closed = new Promise<void>((resolve) => {
      socket.addEventListener('close', () => resolve());
      socket.addEventListener('error', () => resolve());
    });

    socket.addEventListener('message', (event) => {
      void this.#onClientMessage(event.data, client).catch((error: unknown) => {
        if (!(error instanceof PublicError)) console.error('kassandra message failed', error);
        send({ type: 'error', message: publicMessage(error) });
      });
    });

    try {
      watch = await this.harness.session().watch();
      const sent = new Set<number>();
      const initial = projectEntries(watch.value.entries);
      for (const entry of initial) sent.add(entry.id);
      let lastLive = JSON.stringify(projectLive(watch.value.docs));
      send({ type: 'snapshot', conversation, entries: initial, live: JSON.parse(lastLive) });

      watch.start(async (call) => {
        if (call.kind !== 'value') return;
        const fresh = projectEntries(call.value.entries).filter((entry) => !sent.has(entry.id));
        for (const entry of fresh) sent.add(entry.id);
        if (fresh.length) send({ type: 'entries', entries: fresh });
        const live = JSON.stringify(projectLive(call.value.docs));
        if (live !== lastLive) {
          lastLive = live;
          send({ type: 'live', live: JSON.parse(live) });
        }
      });
      await closed;
    } catch (error) {
      console.error('kassandra socket failed', error);
      send({ type: 'error', message: publicMessage(error) });
      socket.close(1011, 'Kassandra is unavailable');
    } finally {
      await watch?.stop();
    }
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
    return {
      status: result.status,
      text: result.text ?? null,
      reason: result.reason ?? null,
      durationMs: Date.now() - started,
      mode,
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
