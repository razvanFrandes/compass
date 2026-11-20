import { DurableObject } from 'cloudflare:workers';
import { createModels } from '@earendil-works/pi-ai/models';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { PiHarness } from 'agents/harness/pi';
import { Lifecycle } from 'agents/lifecycle';
import { createAI } from 'agents/models/pi-ai';
import { HotelData } from '../../application/hotel-data.ts';
import { openPostgres } from '../../infrastructure/postgres.ts';
import type { Env } from '../../env.ts';
import { KASSANDRA_SECTIONS } from './kassandra-prompt.ts';
import { createDataExtension } from './pi-data-extension.ts';

export const THINKER_MODEL = 'anthropic/claude-sonnet-5.5';
export const QUICK_MODEL = 'anthropic/claude-haiku-5.5';

export interface KassandraAnswer {
  status: 'done' | 'unanswered';
  text: string | null;
  reason: string | null;
  durationMs: number;
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
  registry = createKassandraRegistry(this.env);

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

  /** Ask a question in this conversation and wait for the answer. */
  async ask(question: string, operationId?: string): Promise<KassandraAnswer> {
    const started = Date.now();
    const result = await this.harness.prompt(question, operationId ? { operationId } : undefined);
    return {
      status: result.status,
      text: result.text ?? null,
      reason: result.reason ?? null,
      durationMs: Date.now() - started,
    };
  }
}

function createKassandraRegistry(env: Env) {
  const registry = createRegistry();
  registry.install({ name: 'kassandra', sections: KASSANDRA_SECTIONS });
  registry.install(
    createDataExtension(() => {
      const db = openPostgres(env.HYPERDRIVE.connectionString);
      return { data: new HotelData(db), close: () => db.close() };
    }),
  );
  return registry;
}
