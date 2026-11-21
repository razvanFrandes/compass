import { BUDGET_LABELS, type BudgetDecision } from '../../domain/budget.ts';

export function budgetMessage(decision: BudgetDecision): string {
  return `Today’s limit of ${decision.limit} ${BUDGET_LABELS[decision.kind]} for this demo is used up. It resets at midnight UTC.`;
}

export function budgetExceeded(decision: BudgetDecision, now = new Date()): Response {
  const retryAfter = Math.max(1, Math.ceil((Date.parse(decision.resetsAt) - now.getTime()) / 1000));
  return Response.json(
    { error: budgetMessage(decision), resetsAt: decision.resetsAt },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}
