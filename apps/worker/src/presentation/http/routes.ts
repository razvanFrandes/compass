/**
 * Which part of the Worker answers a path. Pure, so the order of the matches is tested: the builder socket lives
 * under /api/workflows and must win over the workflows handler, which would read "builder" as a workflow id.
 */
export type Route = 'mcp' | 'not_found' | 'kassandra_ws' | 'builder' | 'workflows' | 'api';

export function routeOf(pathname: string): Route {
  if (pathname === '/mcp') return 'mcp';
  if (!pathname.startsWith('/api/')) return 'not_found';
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
