import type { Kassandra } from './presentation/agents/kassandra.ts';
import type { Briefs } from './presentation/briefs.ts';

export interface Env {
  AI: Ai;
  HYPERDRIVE: Hyperdrive;
  MCP_RATE_LIMIT: RateLimit;
  ASK_RATE_LIMIT: RateLimit;
  KASSANDRA: DurableObjectNamespace<Kassandra>;
  BRIEFS: DurableObjectNamespace<Briefs>;
}
