import { DurableObject } from 'cloudflare:workers';
import { emptyBudget, parseDailyLimits, spend, usage, type BudgetDecision, type BudgetKind, type BudgetState } from '../domain/budget.ts';
import type { Env } from '../env.ts';

/** The one instance every request shares. */
export const BUDGET_NAME = 'global';

/**
 * The daily budget of the public demo: one object counts every model-spending action of the UTC day. A Durable
 * Object runs one request at a time across its storage calls, so two visitors cannot both take the last unit.
 * Limits come from `env.DAILY_LIMITS` on every call, so a deploy with new limits applies at once.
 */
export class Budget extends DurableObject<Env> {
  async take(kind: BudgetKind): Promise<BudgetDecision> {
    const state = (await this.ctx.storage.get<BudgetState>('state')) ?? emptyBudget();
    const { state: next, decision } = spend(state, kind, parseDailyLimits(this.env.DAILY_LIMITS), new Date());
    if (decision.ok) await this.ctx.storage.put('state', next);
    return decision;
  }

  async status() {
    const state = (await this.ctx.storage.get<BudgetState>('state')) ?? emptyBudget();
    return usage(state, parseDailyLimits(this.env.DAILY_LIMITS), new Date());
  }
}
