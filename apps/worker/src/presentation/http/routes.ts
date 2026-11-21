/**
 * Which part of the Worker answers a path. Pure, so the order of the matches is tested: the builder socket lives
 * under /api/workflows and must win over the workflows handler, which would read "builder" as a workflow id.
 * Everything outside /api/ and /mcp is the Angular app: a file, or index.html for the app's own routes.
 */
export type Route = 'mcp' | 'assets' | 'kassandra_ws' | 'builder' | 'workflows' | 'api';

export function routeOf(pathname: string): Route {
  if (pathname === '/mcp') return 'mcp';
  if (!pathname.startsWith('/api/')) return 'assets';
  if (pathname === '/api/kassandra/ws') return 'kassandra_ws';
  if (pathname === '/api/workflows/builder/ws') return 'builder';
  if (pathname.startsWith('/api/workflows') || pathname.startsWith('/api/proposals') || pathname === '/api/audit' || pathname.startsWith('/api/runs/')) {
    return 'workflows';
  }
  return 'api';
}

/**
 * A draft id, chosen by the client: 16–64 letters, digits, - or _ (clients use `crypto.randomUUID()`). It names the
 * builder's Durable Object and is all that guards the draft, so a short, guessable id is refused.
 */
export const isDraftId = (id: string): boolean => /^[A-Za-z0-9_-]{16,64}$/.test(id);

/** A workflow id as the server makes them (`wf-1a2b3c4d`, `tpl-pace-guard`): 1–64 letters, digits, - or _. */
export const isWorkflowId = (id: string): boolean => /^[A-Za-z0-9_-]{1,64}$/.test(id);

/**
 * `?hotels=LIS,AMS` as the scope a question would carry (`{ hotels }`), or undefined for the whole group. Only the
 * form is read here; `resolveScope` checks the codes against the group's hotels.
 */
export function hotelsParam(value: string | null): { hotels: string[] } | undefined {
  const codes = [...new Set((value ?? '').split(',').map((code) => code.trim().toUpperCase()).filter(Boolean))];
  return codes.length ? { hotels: codes } : undefined;
}
