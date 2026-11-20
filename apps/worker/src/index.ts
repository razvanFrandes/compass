import { Decision } from '@compass/contracts';
import { createMcpHandler } from 'agents/mcp/server';
import { budgetedEmbedder } from './application/budgeted-embedder.ts';
import { HotelData } from './application/hotel-data.ts';
import type { Embedder } from './application/ports.ts';
import type { BudgetKind } from './domain/budget.ts';
import { openPostgres } from './infrastructure/postgres.ts';
import { WorkersAiEmbedder } from './infrastructure/workers-ai-embedder.ts';
import { BUDGET_NAME } from './presentation/budget.ts';
import { hasAdminKey } from './presentation/http/admin.ts';
import { MAX_MCP_BYTES, readJson, withBodyLimit } from './presentation/http/body.ts';
import { budgetExceeded } from './presentation/http/budget-response.ts';
import { preflight, withCors, withoutCors } from './presentation/http/cors.ts';
import { internalError } from './presentation/http/errors.ts';
import { isAllowedOrigin, PUBLIC_HOST, rejectCrossSite } from './presentation/http/origin.ts';
import { isDraftId, routeOf } from './presentation/http/routes.ts';
import { createCompassMcpServer } from './presentation/mcp/server.ts';

import type { Env } from './env.ts';

export { Kassandra } from './presentation/agents/kassandra.ts';
export { Briefs } from './presentation/briefs.ts';
export { WorkflowAgents } from './presentation/agents/workflow-agents.ts';
export { Budget } from './presentation/budget.ts';
export { WorkflowBuilder } from './presentation/agents/workflow-builder.ts';

/**
 * One database client per request, as Hyperdrive recommends: it pools the real connections for us.
 * MCP answers stream (SSE) and the tool runs while the body streams, so the client is closed only once
 * the whole body has been sent, not when the Response object is returned.
 */
async function withData(
  env: Env,
  ctx: ExecutionContext,
  run: (data: HotelData) => Promise<Response>,
  embedder: Embedder = new WorkersAiEmbedder(env.AI),
): Promise<Response> {
  const db = openPostgres(env.HYPERDRIVE.connectionString);
  let response: Response;
  try {
    response = await run(new HotelData(db, embedder));
  } catch (error) {
    ctx.waitUntil(db.close());
    throw error;
  }
  if (!response.body) {
    ctx.waitUntil(db.close());
    return response;
  }
  const { readable, writable } = new TransformStream();
  ctx.waitUntil(response.body.pipeTo(writable).finally(() => db.close()));
  return new Response(readable, response);
}

const clientOf = (request: Request) => request.headers.get('cf-connecting-ip') ?? 'local';
const error = (status: number, message: string) => Response.json({ error: message }, { status });

/** Per-client rate limit: null when the request may go on, else the 429 to send. */
async function rateLimited(limiter: RateLimit, request: Request, message: string): Promise<Response | null> {
  return (await limiter.limit({ key: clientOf(request) })).success ? null : error(429, message);
}

/** The daily budget of the whole demo: null when the request may go on, else the 429 to send. */
async function overBudget(env: Env, request: Request, kind: BudgetKind): Promise<Response | null> {
  if (hasAdminKey(request, env.ADMIN_KEY)) return null;
  const decision = await env.BUDGET.getByName(BUDGET_NAME).take(kind);
  return decision.ok ? null : budgetExceeded(decision);
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const origin = request.headers.get('Origin');
    // MCP clients are not browsers: /mcp answers never carry CORS headers, not even for the dev server.
    const cors = new URL(request.url).pathname === '/mcp' ? withoutCors : (response: Response) => withCors(response, origin);
    try {
      return cors(await route(request, env, ctx));
    } catch (e) {
      // Never send a stack trace, SQL or a connection string to the client: they go to the Worker logs.
      return cors(internalError(e));
    }
  },

  /** Every morning: regenerate the brief before anyone opens the app, then run the workflows it calls for. */
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      env.BRIEFS.getByName('halcyon')
        .regenerate()
        .then((brief) => env.WORKFLOWS.getByName('halcyon').runTriggered(brief))
        .then(() => undefined),
    );
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  const cors = preflight(request);
  if (cors) return cors;

  const target = routeOf(url.pathname);

  if (target === 'mcp') {
    // The MCP endpoint is public and read-only, so reviewers can connect Claude Desktop without a login.
    // A per-client rate limit keeps it from being used to hammer the database.
    const limited = await rateLimited(env.MCP_RATE_LIMIT, request, 'Too many requests. Try again in a minute.');
    if (limited) return limited;
    const bounded = await withBodyLimit(request, MAX_MCP_BYTES);
    if (!bounded.ok) return error(bounded.error.status, bounded.error.error);
    // The tools spend no model tokens of ours, except find_reviews: its Workers AI embedding has a daily budget.
    // Kassandra and the workflows need none: their questions and runs are budgeted already.
    const embedder = budgetedEmbedder(new WorkersAiEmbedder(env.AI), () => env.BUDGET.getByName(BUDGET_NAME).take('embedding'));
    return withData(
      env,
      ctx,
      (data) =>
        createMcpHandler(() => createCompassMcpServer(data), {
          route: '/mcp',
          allowedHostnames: [PUBLIC_HOST],
          allowedOriginHostnames: [PUBLIC_HOST],
        })(bounded.value, env, ctx),
      embedder,
    );
  }

  if (target === 'assets') {
    // The Angular app. Its files and browser navigations are answered before the Worker runs; what reaches this
    // line is any other request for a path that is no file (a script, curl), which gets index.html too.
    if (request.method !== 'GET' && request.method !== 'HEAD') return error(404, 'Not found');
    return env.ASSETS.fetch(request);
  }

  // Every mutating API call must come from the app (or from a script without Origin), never from another site.
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;

  if (target === 'kassandra_ws') {
    // The chat WebSocket: one Durable Object per conversation id. Questions sent over it are rate-limited and
    // budgeted inside the object.
    const origin = request.headers.get('Origin');
    if (origin && !isAllowedOrigin(origin)) return new Response('Origin not allowed', { status: 403 });
    const conversation = url.searchParams.get('conversation') ?? '';
    if (!/^[\w-]{1,64}$/.test(conversation)) return new Response('Pass ?conversation=<id> (letters, digits, - or _)', { status: 400 });
    return env.KASSANDRA.getByName(conversation).fetch(request);
  }

  if (target === 'builder') {
    // The workflow builder's WebSocket: one Durable Object per draft id, with Kassandra's origin rule. Questions sent
    // over it are rate-limited and budgeted inside the object; test runs are budgeted there.
    const origin = request.headers.get('Origin');
    if (origin && !isAllowedOrigin(origin)) return new Response('Origin not allowed', { status: 403 });
    const draft = url.searchParams.get('draft') ?? '';
    if (!isDraftId(draft)) return new Response('Pass ?draft=<id> (16–64 letters, digits, - or _)', { status: 400 });
    return env.WORKFLOW_BUILDER.getByName(draft).fetch(request);
  }

  if (url.pathname === '/api/kassandra/ask' && request.method === 'POST') {
    // Every question spends model tokens: rate-limited per client and counted against the daily budget.
    const limited = await rateLimited(env.ASK_RATE_LIMIT, request, 'Too many questions. Wait a minute and try again.');
    if (limited) return limited;
    const parsed = await readJson(request);
    if (!parsed.ok) return error(parsed.error.status, parsed.error.error);
    const body = parsed.value as { conversation?: unknown; question?: unknown; mode?: unknown } | null;
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question || question.length > 2000) return error(400, 'Send { question } (max 2000 characters).');
    const spent = await overBudget(env, request, 'question');
    if (spent) return spent;
    const conversation = typeof body?.conversation === 'string' && /^[\w-]{1,64}$/.test(body.conversation) ? body.conversation : crypto.randomUUID();
    const mode = body?.mode === 'quick' ? 'quick' : 'thinker';
    const answer = await env.KASSANDRA.getByName(conversation).ask(question, mode);
    return Response.json({ conversation, ...answer });
  }

  if (url.pathname === '/api/brief' && request.method === 'GET') {
    return Response.json(await env.BRIEFS.getByName('halcyon').latest());
  }

  if (url.pathname === '/api/brief/refresh' && request.method === 'POST') {
    // Regenerating spends model tokens, so it shares the questions' rate limit and has its own daily budget.
    const limited = await rateLimited(env.ASK_RATE_LIMIT, request, 'Too many requests. Wait a minute and try again.');
    if (limited) return limited;
    const spent = await overBudget(env, request, 'brief_refresh');
    if (spent) return spent;
    return Response.json(await env.BRIEFS.getByName('halcyon').regenerate());
  }

  if (url.pathname === '/api/budget' && request.method === 'GET') {
    return Response.json(await env.BUDGET.getByName(BUDGET_NAME).status());
  }

  if (target === 'workflows') return workflowRoutes(request, url, env);

  if (url.pathname === '/api/health') {
    return withData(env, ctx, async (data) => Response.json({ ok: true, businessDate: await data.businessDate() }));
  }

  return error(404, 'Not found');
}

/** Workflows (Act): list, create, edit, run; proposals inbox, decisions, undo; audit log; run logs. */
async function workflowRoutes(request: Request, url: URL, env: Env): Promise<Response> {
  const agents = env.WORKFLOWS.getByName('halcyon');
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'workflows', id?, action?]
  const method = request.method;
  const json = (value: unknown) => {
    if (value && typeof value === 'object' && 'error' in value && 'status' in value) {
      const { error: message, status } = value as { error: string; status: number };
      return error(status, message);
    }
    return Response.json(value);
  };
  /** The JSON body as an object, or the 400/413 to send. */
  const body = async (): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; response: Response }> => {
    const parsed = await readJson(request);
    if (!parsed.ok) return { ok: false, response: error(parsed.error.status, parsed.error.error) };
    const value = parsed.value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, response: error(400, 'Send a JSON object.') };
    return { ok: true, value: value as Record<string, unknown> };
  };
  const limited = () => rateLimited(env.ASK_RATE_LIMIT, request, 'Too many runs. Wait a minute.');

  if (parts[1] === 'workflows') {
    const [, , id, action] = parts;
    if (!id && method === 'GET') return json(await agents.list());
    if (!id && method === 'POST') {
      const b = await body();
      return b.ok ? json(await agents.create(b.value as never)) : b.response;
    }
    if (id && !action && method === 'GET') return json(await agents.get(id));
    if (id && !action && method === 'PATCH') {
      const b = await body();
      return b.ok ? json(await agents.update(id, b.value as never)) : b.response;
    }
    if (id && action === 'run' && method === 'POST') {
      const refused = (await limited()) ?? (await overBudget(env, request, 'workflow_run'));
      if (refused) return refused;
      // The client goes with the run: an email workflow's sends are limited per client, not for all "Run now" together.
      return json(await agents.run(id, 'manual', '', { client: clientOf(request) }));
    }
  }
  if (parts[1] === 'runs' && parts[2] && method === 'GET') return json(await agents.runLog(parts[2]));
  if (parts[1] === 'proposals') {
    const [, , id, action] = parts;
    if (!id && method === 'GET') return json(await agents.proposals((url.searchParams.get('status') as never) ?? undefined));
    if (id && action === 'decision' && method === 'POST') {
      const b = await body();
      if (!b.ok) return b.response;
      const decision = Decision.safeParse(b.value);
      if (!decision.success) return error(400, 'Send { approved: boolean, by: string, note?: string }.');
      // A decision wakes the parked workflow agent, which spends model tokens.
      const spent = await overBudget(env, request, 'decision');
      if (spent) return spent;
      return json(await agents.decide(id, decision.data));
    }
    if (id && action === 'undo' && method === 'POST') {
      const b = await body();
      if (!b.ok) return b.response;
      const by = String(b.value['by'] ?? '').slice(0, 60);
      if (!by) return error(400, 'Send { by: string }.');
      return json(await agents.undo(id, by));
    }
  }
  if (parts[1] === 'audit' && method === 'GET') return json(await agents.audit());
  return error(404, 'Not found');
}
