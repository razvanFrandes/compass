import type { Boards } from './presentation/boards.ts';
import type { Budget } from './presentation/budget.ts';
import type { Kassandra } from './presentation/agents/kassandra.ts';
import type { Briefs } from './presentation/briefs.ts';
import type { WorkflowAgents } from './presentation/agents/workflow-agents.ts';
import type { WorkflowBuilder } from './presentation/agents/workflow-builder.ts';

export interface Env {
  /** The Angular app's files (wrangler.jsonc `assets`): unknown paths answer with index.html. */
  ASSETS: Fetcher;
  AI: Ai;
  HYPERDRIVE: Hyperdrive;
  MCP_RATE_LIMIT: RateLimit;
  ASK_RATE_LIMIT: RateLimit;
  /** POST /api/voice/token: 10 temporary keys per minute per client. */
  VOICE_RATE_LIMIT: RateLimit;
  /** Board changes: 60 per minute per client. */
  BOARD_RATE_LIMIT: RateLimit;
  /** GET /api/brief/overview: 30 reads per minute per client. */
  BRIEF_RATE_LIMIT: RateLimit;
  /** /api/kassandra/conversations: 60 requests per minute per client. */
  CONVERSATION_RATE_LIMIT: RateLimit;
  KASSANDRA: DurableObjectNamespace<Kassandra>;
  BRIEFS: DurableObjectNamespace<Briefs>;
  WORKFLOWS: DurableObjectNamespace<WorkflowAgents>;
  BUDGET: DurableObjectNamespace<Budget>;
  WORKFLOW_BUILDER: DurableObjectNamespace<WorkflowBuilder>;
  BOARDS: DurableObjectNamespace<Boards>;
  /** Cloudflare Email Sending; the only sender allowed is alerts@compass.razvanfrandes.com. */
  EMAIL: SendEmail;
  /** The app's public origin, for links in emails: https://juyo.razvanfrandes.com. */
  APP_URL: string;
  /** Per-UTC-day limits of the public demo, e.g. { "question": 300 }. Missing keys keep the defaults (domain/budget.ts). */
  DAILY_LIMITS?: unknown;
  /** Optional secret: requests with `x-compass-admin-key: <ADMIN_KEY>` skip the daily budget. */
  ADMIN_KEY?: string;
  /**
   * Secret: the Soniox project key (`wrangler secret put SONIOX_API_KEY`). Used only to mint temporary keys for voice
   * input; never returned or logged. Without it, POST /api/voice/token answers 503 and the app falls back to Web Speech.
   */
  SONIOX_API_KEY?: string;
}
