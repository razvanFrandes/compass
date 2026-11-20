import type { Budget } from './presentation/budget.ts';
import type { Kassandra } from './presentation/agents/kassandra.ts';
import type { Briefs } from './presentation/briefs.ts';
import type { WorkflowAgents } from './presentation/agents/workflow-agents.ts';
import type { WorkflowBuilder } from './presentation/agents/workflow-builder.ts';

export interface Env {
  AI: Ai;
  HYPERDRIVE: Hyperdrive;
  MCP_RATE_LIMIT: RateLimit;
  ASK_RATE_LIMIT: RateLimit;
  KASSANDRA: DurableObjectNamespace<Kassandra>;
  BRIEFS: DurableObjectNamespace<Briefs>;
  WORKFLOWS: DurableObjectNamespace<WorkflowAgents>;
  BUDGET: DurableObjectNamespace<Budget>;
  WORKFLOW_BUILDER: DurableObjectNamespace<WorkflowBuilder>;
  /** Cloudflare Email Sending; the only sender allowed is alerts@compass.razvanfrandes.com. */
  EMAIL: SendEmail;
  /** The app's public origin, for links in emails: https://juyo.razvanfrandes.com. */
  APP_URL: string;
  /** Per-UTC-day limits of the public demo, e.g. { "question": 300 }. Missing keys keep the defaults (domain/budget.ts). */
  DAILY_LIMITS?: unknown;
  /** Optional secret: requests with `x-compass-admin-key: <ADMIN_KEY>` skip the daily budget. */
  ADMIN_KEY?: string;
}
