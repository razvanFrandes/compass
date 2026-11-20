import type { ActionType, Autonomy, ProposalStatus } from '@compass/contracts';

/**
 * Price and channel actions are always high risk. The model may rate the other actions, and may raise any of them to
 * high, but it can never lower these: text injected into its context (a guest review, say) must not be able to get a
 * price change applied without a person.
 */
export const ALWAYS_HIGH_RISK: ReadonlySet<ActionType> = new Set(['adjust_bar', 'close_channel', 'open_channel']);

export type Risk = 'low' | 'high';

export function proposalRisk(action: ActionType, claimed: Risk): Risk {
  return ALWAYS_HIGH_RISK.has(action) ? 'high' : claimed;
}

/** What happens to a new proposal: recorded only, applied alone (low risk only), or parked for a person. */
export function proposalStatus(autonomy: Autonomy, risk: Risk): Extract<ProposalStatus, 'suggested' | 'auto_approved' | 'pending'> {
  if (autonomy === 'suggest') return 'suggested';
  if (autonomy === 'auto_low_risk' && risk === 'low') return 'auto_approved';
  return 'pending';
}
