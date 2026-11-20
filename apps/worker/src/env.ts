import type { Kassandra } from './presentation/agents/kassandra.ts';

export interface Env {
  AI: Ai;
  HYPERDRIVE: Hyperdrive;
  MCP_RATE_LIMIT: RateLimit;
  ASK_RATE_LIMIT: RateLimit;
  KASSANDRA: DurableObjectNamespace<Kassandra>;
}
