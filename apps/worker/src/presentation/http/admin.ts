/**
 * The owner's key: requests carrying `x-compass-admin-key: <ADMIN_KEY>` skip the daily budget (not the rate
 * limits), e.g. to run the evals or a live demo after the public budget is spent. ADMIN_KEY is a Worker secret;
 * when it is not set, nobody skips the budget.
 */
export const ADMIN_HEADER = 'x-compass-admin-key';

export function constantTimeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function hasAdminKey(request: Request, adminKey: string | undefined): boolean {
  if (!adminKey) return false;
  const given = request.headers.get(ADMIN_HEADER);
  return given !== null && constantTimeEqual(given, adminKey);
}
