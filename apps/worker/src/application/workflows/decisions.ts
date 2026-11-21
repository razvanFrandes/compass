import { recipientFor, TEAM_ROLE_LABEL, handoverRole, type AuditEntry, type Decision, type DecisionReceipt, type Handover, type Proposal } from '@compass/contracts';
import type { WorkflowStore } from './store.ts';

/**
 * What happens when a person decides. Compass is read-only, so "sending" a suggestion on does one thing: it hands a
 * task to a named person at that hotel (the demo roster) and writes a line in the audit log. No rate, channel or
 * booking changes, and no email is sent. Dismissing sends nothing and is logged too. Either can be taken back.
 *
 * The decision is recorded here, when the person makes it, and not when the agent behind it wakes up: the receipt
 * the person sees is then true at once, and it does not depend on a model turn.
 */

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** "Ana Pop (Revenue manager, Arbor Lisbon Chiado)", or the role and the hotel code when the roster has no one. */
const addressee = (proposal: Proposal, to: Handover | null) =>
  to ? `${to.name} (${to.roleLabel}, ${to.hotel})` : `the ${TEAM_ROLE_LABEL[handoverRole(proposal.action)].toLowerCase()} (${proposal.hotel_code})`;

const what = (proposal: Proposal) => `${proposal.title} (${proposal.change.before} → ${proposal.change.after}, ${proposal.change.scope}).`;

function entry(proposal: Proposal, by: string, at: string, outcome: AuditEntry['outcome'], receipt: string, handedTo: Handover | null): AuditEntry {
  return {
    id: newId('audit'),
    at,
    workflowId: proposal.workflowId,
    proposalId: proposal.id,
    hotel_code: proposal.hotel_code,
    action: proposal.action,
    by,
    outcome,
    receipt,
    ...(handedTo ? { handedTo } : {}),
    ...(proposal.deletedWorkflowName ? { deletedWorkflowName: proposal.deletedWorkflowName } : {}),
  };
}

/**
 * Hands a proposal to the person at the hotel whose job it is: a task for them, and a line in the audit log.
 * Written once: a proposal that was already handed over gives back the same receipt.
 */
export async function handOver(store: WorkflowStore, proposal: Proposal, by: string, now: () => Date = () => new Date()): Promise<DecisionReceipt> {
  const handedTo = recipientFor(proposal.hotel_code, proposal.action);
  if (proposal.status === 'applied') {
    const done = await store.auditForProposal(proposal.id);
    return { proposal, handedTo: done?.handedTo ?? handedTo, receipt: done?.receipt ?? '' };
  }
  const at = now().toISOString();
  const receipt = `RMS task ${newId('rms')} for ${addressee(proposal, handedTo)}: ${what(proposal)}`;
  const applied: Proposal = { ...proposal, status: 'applied', decidedBy: proposal.decidedBy ?? by, decidedAt: proposal.decidedAt ?? at };
  await store.appendAudit(entry(applied, applied.decidedBy ?? by, at, 'sent_to_rms', receipt, handedTo));
  await store.updateProposal(applied);
  return { proposal: applied, handedTo, receipt };
}

export const DISMISSED_RECEIPT = 'Dismissed. Nothing was sent.';

/** Records what the person decided: sent on (handed over and logged), or dismissed (logged, nothing sent). */
export async function recordDecision(store: WorkflowStore, proposal: Proposal, decision: Decision, now: () => Date = () => new Date()): Promise<DecisionReceipt> {
  const at = now().toISOString();
  const decided: Proposal = { ...proposal, decidedBy: decision.by, decidedAt: at, note: decision.note || null };
  if (decision.approved) return handOver(store, decided, decision.by, now);
  const dismissed: Proposal = { ...decided, status: 'denied' };
  await store.appendAudit(entry(dismissed, decision.by, at, 'dismissed', DISMISSED_RECEIPT, null));
  await store.updateProposal(dismissed);
  return { proposal: dismissed, handedTo: null, receipt: DISMISSED_RECEIPT };
}

export interface DecisionError {
  error: string;
  status: number;
}

/**
 * Takes a decision back. A sent one: the person who got the task gets one to reverse it. A dismissed one: the
 * suggestion waits for a decision again. Both are logged.
 */
export async function undoDecision(store: WorkflowStore, proposal: Proposal, by: string, now: () => Date = () => new Date()): Promise<{ proposal: Proposal; entry: AuditEntry } | DecisionError> {
  const at = now().toISOString();
  if (proposal.status === 'applied' || proposal.status === 'approved' || proposal.status === 'auto_approved') {
    const handedTo = (await store.auditForProposal(proposal.id))?.handedTo ?? recipientFor(proposal.hotel_code, proposal.action);
    const receipt = `RMS task to reverse it, for ${addressee(proposal, handedTo)}: ${proposal.title} (${proposal.change.after} → ${proposal.change.before}, ${proposal.change.scope}).`;
    const undone: Proposal = { ...proposal, status: 'undone' };
    const logged = entry(undone, by, at, 'undone', receipt, handedTo);
    await store.appendAudit(logged);
    await store.updateProposal(undone);
    return { proposal: undone, entry: logged };
  }
  if (proposal.status === 'denied') {
    const waiting: Proposal = { ...proposal, status: 'pending', decidedBy: null, decidedAt: null, note: null };
    const logged = entry(waiting, by, at, 'undone', 'The dismissal was taken back. The suggestion waits for a decision again.', null);
    await store.appendAudit(logged);
    await store.updateProposal(waiting);
    return { proposal: waiting, entry: logged };
  }
  return { error: 'Only a decision that was sent or dismissed can be taken back.', status: 409 };
}

/** Whether the person's decision on this proposal is already on record (sent on or dismissed), whatever came after. */
export async function decisionOnRecord(store: WorkflowStore, proposalId: string): Promise<boolean> {
  return (await store.auditsForProposal(proposalId)).some((a) => a.outcome === 'sent_to_rms' || a.outcome === 'dismissed');
}
