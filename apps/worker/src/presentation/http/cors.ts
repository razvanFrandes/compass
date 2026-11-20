/**
 * CORS. In production the app and the API share one origin, so no CORS header is sent and browsers keep other
 * sites from reading responses. Only the Angular dev server (a different port) is allowed in.
 */
const DEV_ORIGINS = new Set(['http://localhost:4200', 'http://127.0.0.1:4200']);

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !DEV_ORIGINS.has(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

/** Answers a CORS preflight: allowed for the dev server, refused for anyone else. Not a preflight → null. */
export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  const headers = corsHeaders(request.headers.get('Origin'));
  if (!headers['Access-Control-Allow-Origin']) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    },
  });
}

/**
 * A response with every Access-Control-* header removed. For /mcp: its clients (Claude Desktop and other MCP
 * clients) are not browsers, so no web page gets to read its answers.
 */
export function withoutCors(response: Response): Response {
  const names = [...response.headers.keys()].filter((name) => name.toLowerCase().startsWith('access-control-'));
  if (!names.length) return response;
  const copy = new Response(response.body, response);
  for (const name of names) copy.headers.delete(name);
  return copy;
}

/** Adds the CORS headers for `origin` to a response (a copy, since fetched responses are immutable). */
export function withCors(response: Response, origin: string | null): Response {
  const headers = corsHeaders(origin);
  if (!Object.keys(headers).length || response.status === 101) return response;
  const copy = new Response(response.body, response);
  for (const [k, v] of Object.entries(headers)) copy.headers.set(k, v);
  return copy;
}
