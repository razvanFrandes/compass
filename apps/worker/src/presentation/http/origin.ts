export const PUBLIC_HOST = 'juyo.razvanfrandes.com';

/** The app itself, and local development (wrangler dev, the Angular dev server). */
export function isAllowedOrigin(origin: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false; // "null" (sandboxed frames, file://) or garbage
  }
  return hostname === PUBLIC_HOST || hostname === 'localhost' || hostname === '127.0.0.1';
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Stops other websites from driving the API from a visitor's browser (spending the demo's budget, approving
 * proposals). Browsers always send Origin on a cross-origin POST, so a foreign Origin is refused. Requests without
 * Origin are scripts (curl, the evals): they pass, and meet the rate limits and the daily budget like everyone.
 */
export function rejectCrossSite(request: Request): Response | null {
  if (!MUTATING.has(request.method)) return null;
  const origin = request.headers.get('Origin');
  if (origin !== null) return isAllowedOrigin(origin) ? null : forbidden();
  return request.headers.get('Sec-Fetch-Site') === 'cross-site' ? forbidden() : null;
}

const forbidden = () => Response.json({ error: 'This API only accepts requests from the Compass app.' }, { status: 403 });
