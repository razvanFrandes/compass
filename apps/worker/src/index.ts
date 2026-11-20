import { createMcpHandler } from 'agents/mcp/server';
import { HotelData } from './application/hotel-data.ts';
import { openPostgres } from './infrastructure/postgres.ts';
import { createCompassMcpServer } from './presentation/mcp/server.ts';

export interface Env {
  HYPERDRIVE: Hyperdrive;
  MCP_RATE_LIMIT: RateLimit;
}

const PUBLIC_HOST = 'juyo.razvanfrandes.com';

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

    if (url.pathname === '/api/health') {
      return withData(env, ctx, async (data) => Response.json({ ok: true, businessDate: await data.businessDate() }));
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
