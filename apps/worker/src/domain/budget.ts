/**
 * The demo's daily budget: how many model-spending actions the whole public site may take per UTC day, for every
 * visitor together. Per-client rate limits stop one client from hammering the site; this caps the total spend
 * whatever the number of clients. Pure logic: the Budget Durable Object stores the state.
 */

export const BUDGET_KINDS = ['question', 'workflow_run', 'decision', 'brief_refresh', 'embedding'] as const;
export type BudgetKind = (typeof BUDGET_KINDS)[number];
export type DailyLimits = Record<BudgetKind, number>;

/** Defaults when `DAILY_LIMITS` is not set. Change them in wrangler.jsonc `vars.DAILY_LIMITS`. */
export const DEFAULT_DAILY_LIMITS: DailyLimits = {
  question: 300, // Kassandra questions and steers, WebSocket and HTTP
  workflow_run: 60, // "Run now"
  decision: 120, // approve or deny: each one wakes a workflow agent
  brief_refresh: 24, // "Refresh brief"
  embedding: 2000, // find_reviews through the public MCP server: one Workers AI embedding each
};

export const BUDGET_LABELS: Record<BudgetKind, string> = {
  question: 'questions',
  workflow_run: 'workflow runs',
  decision: 'approval decisions',
  brief_refresh: 'brief refreshes',
  embedding: 'semantic searches',
};

export interface BudgetState {
  day: string; // YYYY-MM-DD, UTC
  used: Partial<Record<BudgetKind, number>>;
}

export interface BudgetDecision {
  ok: boolean;
  kind: BudgetKind;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

export const emptyBudget = (): BudgetState => ({ day: '', used: {} });

/** Reads limits from config (an object, or a JSON string). Any missing or invalid value keeps its default. */
export function parseDailyLimits(raw: unknown): DailyLimits {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = undefined;
    }
  }
  const limits = { ...DEFAULT_DAILY_LIMITS };
  if (value && typeof value === 'object') {
    for (const kind of BUDGET_KINDS) {
      const n = (value as Record<string, unknown>)[kind];
      if (typeof n === 'number' && Number.isInteger(n) && n >= 0) limits[kind] = n;
    }
  }
  return limits;
}

const utcDay = (now: Date) => now.toISOString().slice(0, 10);
const nextMidnight = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();

/** Takes one unit of `kind` if today's limit allows it. A refusal changes nothing. */
export function spend(state: BudgetState, kind: BudgetKind, limits: DailyLimits, now: Date): { state: BudgetState; decision: BudgetDecision } {
  const day = utcDay(now);
  const today = state.day === day ? state : { day, used: {} };
  const used = today.used[kind] ?? 0;
  const limit = limits[kind];
  const resetsAt = nextMidnight(now);
  if (used >= limit) {
    return { state: today, decision: { ok: false, kind, used, limit, remaining: 0, resetsAt } };
  }
  const next = { day, used: { ...today.used, [kind]: used + 1 } };
  return { state: next, decision: { ok: true, kind, used: used + 1, limit, remaining: limit - used - 1, resetsAt } };
}

/** Today's usage for every kind, without spending. */
export function usage(state: BudgetState, limits: DailyLimits, now: Date): Record<BudgetKind, { used: number; limit: number }> {
  const today = state.day === utcDay(now) ? state.used : {};
  return Object.fromEntries(BUDGET_KINDS.map((k) => [k, { used: today[k] ?? 0, limit: limits[k] }])) as Record<
    BudgetKind,
    { used: number; limit: number }
  >;
}
