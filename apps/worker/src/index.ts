import { Decision } from '@compass/contracts';
import { createMcpHandler } from 'agents/mcp/server';
import { HotelData } from './application/hotel-data.ts';
import { openPostgres } from './infrastructure/postgres.ts';
import { createCompassMcpServer } from './presentation/mcp/server.ts';

import type { Env } from './env.ts';

export { Kassandra } from './presentation/agents/kassandra.ts';
export { Briefs } from './presentation/briefs.ts';
export { WorkflowAgents } from './presentation/agents/workflow-agents.ts';

const PUBLIC_HOST = 'juyo.razvanfrandes.com';

/** Browsers may open the chat socket from the app itself and from local development. */
function isAllowedOrigin(origin: string): boolean {
  const { hostname } = new URL(origin);
  return hostname === PUBLIC_HOST || hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * One database client per request, as Hyperdrive recommends: it pools the real connections for us.
 * MCP answers stream (SSE) and the tool runs while the body streams, so the client is closed only once
 * the whole body has been sent, not when the Response object is returned.
 */
async function withData(env: Env, ctx: ExecutionContext, run: (data: HotelData) => Promise<Response>): Promise<Response> {
  const db = openPostgres(env.HYPERDRIVE.connectionString);
  let response: Response;
  try {
    response = await run(new HotelData(db));
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

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/mcp') {
      // The MCP endpoint is public and read-only, so reviewers can connect Claude Desktop without a login.
      // A per-client rate limit keeps it from being used to hammer the database.
      const client = request.headers.get('cf-connecting-ip') ?? 'local';
      if (!(await env.MCP_RATE_LIMIT.limit({ key: client })).success) {
        return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
      }
      return withData(env, ctx, (data) =>
        createMcpHandler(() => createCompassMcpServer(data), {
          route: '/mcp',
          allowedHostnames: [PUBLIC_HOST],
          allowedOriginHostnames: [PUBLIC_HOST],
        })(request, env, ctx),
      );
    }

    if (url.pathname === '/api/kassandra/ws') {
      // The chat WebSocket: one Durable Object per conversation id.
      const origin = request.headers.get('Origin');
      if (origin && !isAllowedOrigin(origin)) return new Response('Origin not allowed', { status: 403 });
      const conversation = url.searchParams.get('conversation') ?? '';
      if (!/^[\w-]{1,64}$/.test(conversation)) return new Response('Pass ?conversation=<id> (letters, digits, - or _)', { status: 400 });
      return env.KASSANDRA.getByName(conversation).fetch(request);
    }

    if (url.pathname === '/api/kassandra/ask' && request.method === 'POST') {
      // Every question spends model tokens, so it is rate-limited per client.
      const client = request.headers.get('cf-connecting-ip') ?? 'local';
      if (!(await env.ASK_RATE_LIMIT.limit({ key: client })).success) {
        return Response.json({ error: 'Too many questions. Wait a minute and try again.' }, { status: 429 });
      }
      const body = (await request.json().catch(() => null)) as { conversation?: string; question?: string; mode?: string } | null;
      const question = body?.question?.trim();
      if (!question || question.length > 2000) return Response.json({ error: 'Send { question } (max 2000 characters).' }, { status: 400 });
      const conversation = body?.conversation && /^[\w-]{1,64}$/.test(body.conversation) ? body.conversation : crypto.randomUUID();
      const mode = body?.mode === 'quick' ? 'quick' : 'thinker';
      const answer = await env.KASSANDRA.getByName(conversation).ask(question, mode);
      return Response.json({ conversation, ...answer });
    }

    if (url.pathname === '/api/brief' && request.method === 'GET') {
      return Response.json(await env.BRIEFS.getByName('halcyon').latest());
    }

    if (url.pathname === '/api/brief/refresh' && request.method === 'POST') {
      // Regenerating spends model tokens, so it shares the questions' rate limit.
      const client = request.headers.get('cf-connecting-ip') ?? 'local';
      if (!(await env.ASK_RATE_LIMIT.limit({ key: client })).success) {
        return Response.json({ error: 'Too many requests. Wait a minute and try again.' }, { status: 429 });
      }
      return Response.json(await env.BRIEFS.getByName('halcyon').regenerate());
    }

    if (url.pathname.startsWith('/api/workflows') || url.pathname.startsWith('/api/proposals') || url.pathname === '/api/audit' || url.pathname.startsWith('/api/runs/')) {
      return workflowRoutes(request, url, env);
    }

    if (url.pathname === '/api/health') {
      return withData(env, ctx, async (data) => Response.json({ ok: true, businessDate: await data.businessDate() }));
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
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

/** Workflows (Act): list, create, edit, run; proposals inbox, decisions, undo; audit log; run logs. */
async function workflowRoutes(request: Request, url: URL, env: Env): Promise<Response> {
  const agents = env.WORKFLOWS.getByName('halcyon');
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'workflows', id?, action?]
  const method = request.method;
  const json = (value: unknown) => {
    if (value && typeof value === 'object' && 'error' in value && 'status' in value) {
      const { error, status } = value as { error: string; status: number };
      return Response.json({ error }, { status });
    }
    return Response.json(value);
  };
  const body = async () => (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const limited = async () => {
    const client = request.headers.get('cf-connecting-ip') ?? 'local';
    return !(await env.ASK_RATE_LIMIT.limit({ key: client })).success;
  };

  if (parts[1] === 'workflows') {
    const [, , id, action] = parts;
    if (!id && method === 'GET') return json(await agents.list());
    if (!id && method === 'POST') return json(await agents.create((await body()) as never));
    if (id && !action && method === 'GET') return json(await agents.get(id));
    if (id && !action && method === 'PATCH') return json(await agents.update(id, (await body()) as never));
    if (id && action === 'run' && method === 'POST') {
      if (await limited()) return Response.json({ error: 'Too many runs. Wait a minute.' }, { status: 429 });
      return json(await agents.run(id, 'manual'));
    }
  }
  if (parts[1] === 'runs' && parts[2] && method === 'GET') return json(await agents.runLog(parts[2]));
  if (parts[1] === 'proposals') {
    const [, , id, action] = parts;
    if (!id && method === 'GET') return json(await agents.proposals((url.searchParams.get('status') as never) ?? undefined));
    if (id && action === 'decision' && method === 'POST') {
      const decision = Decision.safeParse(await body());
      if (!decision.success) return Response.json({ error: 'Send { approved: boolean, by: string, note?: string }.' }, { status: 400 });
      return json(await agents.decide(id, decision.data));
    }
    if (id && action === 'undo' && method === 'POST') {
      const by = String((await body())['by'] ?? '').slice(0, 60);
      if (!by) return Response.json({ error: 'Send { by: string }.' }, { status: 400 });
      return json(await agents.undo(id, by));
    }
  }
  if (parts[1] === 'audit' && method === 'GET') return json(await agents.audit());
  return Response.json({ error: 'Not found' }, { status: 404 });
}
