import { z } from 'zod';
import type { Handover } from './team.ts';

/**
 * Workflows (Juyo's "Act"): agents that watch the numbers, propose an action and act once a person approves.
 * A workflow is a declarative spec, the same whether a person builds it by hand or Kassandra drafts it from chat.
 * Compass is read-only: an approved action is logged and handed to the revenue manager as an RMS task; no data is written.
 */

export const BriefTriggerKind = z.enum([
  'data_stale',
  'pace_behind',
  'underpriced_demand',
  'account_loss',
  'web_conversion_drop',
  'staffing_gap',
  'rooms_out_of_order',
  'gop_miss',
]);

export const WorkflowTrigger = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('schedule'), every: z.enum(['day', 'week']).describe('Runs after the morning brief') }),
  z.object({ kind: z.literal('brief'), finding: BriefTriggerKind.describe('Runs when the morning brief has this finding for one of its hotels') }),
  z.object({ kind: z.literal('manual') }),
]);
export type WorkflowTrigger = z.infer<typeof WorkflowTrigger>;

export const ActionType = z.enum(['adjust_bar', 'close_channel', 'open_channel', 'contact_account', 'create_task', 'notify', 'email']);
export type ActionType = z.infer<typeof ActionType>;

/**
 * suggest: propose only, never act. approve: act after a person approves. auto_low_risk: act alone on low-risk
 * actions, ask for the rest. Trust is earned gradually (suggest → approve → act alone).
 */
export const Autonomy = z.enum(['suggest', 'approve', 'auto_low_risk']);
export type Autonomy = z.infer<typeof Autonomy>;

/** Where an email workflow sends its mail: one address, no lists. */
export const EmailDelivery = z.object({ channel: z.literal('email'), to: z.email().max(254) });
export type EmailDelivery = z.infer<typeof EmailDelivery>;

/** The plain object. Use it for `.shape` and `.partial()`, which zod refuses on the refined `WorkflowSpec`. */
export const WorkflowSpecShape = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(400).default(''),
  hotels: z.array(z.string()).min(1).describe('Hotel codes, or ["ALL"] for the whole group'),
  trigger: WorkflowTrigger,
  /** What to watch and when to act, in plain language: the agent's brief. */
  goal: z.string().min(10).max(1000),
  /** The tools the agent should check first (it may use others). */
  checks: z.array(z.string()).max(8).default([]),
  /** The kind of action it may propose. */
  action: z.object({ type: ActionType, guidance: z.string().max(400).default('') }),
  /** The recipient, for an email action only. */
  delivery: EmailDelivery.optional(),
  approver: z.enum(['revenue_manager', 'gm']).default('revenue_manager'),
  autonomy: Autonomy.default('approve'),
  enabled: z.boolean().default(true),
});

/** A complete workflow: an email action has a recipient, and no other action has one. */
export const WorkflowSpec = WorkflowSpecShape.superRefine((spec, ctx) => {
  const isEmail = spec.action.type === 'email';
  if (isEmail && !spec.delivery) ctx.addIssue({ code: 'custom', path: ['delivery'], message: 'Add the address to send the email to.' });
  if (!isEmail && spec.delivery) ctx.addIssue({ code: 'custom', path: ['delivery'], message: 'Only an agent that sends an email can have an address.' });
});
export type WorkflowSpec = z.infer<typeof WorkflowSpec>;
export type WorkflowSpecInput = z.input<typeof WorkflowSpec>;

/** A workflow being built: any part of the spec may still be missing. */
export const WorkflowDraft = WorkflowSpecShape.partial();
export type WorkflowDraft = z.input<typeof WorkflowDraft>;

/** An address as shown to anyone but its owner: `silviu@gmail.com` → `si****@gmail.com`. */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  if (at < 1) return '****';
  return `${address.slice(0, Math.min(2, at))}****${address.slice(at)}`;
}

export interface Workflow extends WorkflowSpec {
  id: string;
  createdAt: string;
  createdBy: 'template' | 'user' | 'kassandra';
  lastRun: { runId: string; at: string; status: WorkflowRun['status'] } | null;
  /** Emails this workflow has sent (email workflows only). */
  emailsSent?: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  /** The Pi session that ran it; its transcript is the run log. */
  sessionId: string;
  trigger: 'manual' | 'schedule' | 'brief';
  status: 'running' | 'waiting_approval' | 'done' | 'failed';
  startedAt: string;
  endedAt: string | null;
  /** The agent's final message. */
  summary: string | null;
  /** A "send test now" run: it always sends, marked as a test. */
  test?: boolean;
  /** Who started it (the client address), for rate limits. */
  client?: string;
  /** Set when its workflow was deleted: the name it had, since `workflowId` no longer resolves. */
  deletedWorkflowName?: string;
}

/** superseded: the agent replaced it with an amended proposal (e.g. to meet an approver's condition). */
export type ProposalStatus = 'pending' | 'approved' | 'denied' | 'auto_approved' | 'suggested' | 'applied' | 'undone' | 'superseded';

export interface Proposal {
  id: string;
  workflowId: string;
  runId: string;
  hotel_code: string;
  action: ActionType;
  title: string;
  /** Why, with the numbers the agent found. */
  rationale: string;
  /** Before → after, e.g. BAR 665 → 820 AED for 16–18 Dec. */
  change: { before: string; after: string; scope: string };
  impact_eur: number | null;
  risk: 'low' | 'high';
  status: ProposalStatus;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
  /** Set when its workflow was deleted: the name it had, since `workflowId` no longer resolves. */
  deletedWorkflowName?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  workflowId: string;
  proposalId: string;
  hotel_code: string;
  action: ActionType;
  by: string;
  /** `dismissed`: a person dismissed the suggestion, and nothing was sent. `undone`: a sent suggestion or a dismissal was taken back. */
  outcome: 'sent_to_rms' | 'suggested' | 'undone' | 'emailed' | 'dismissed';
  /** The task handed to the RMS / revenue manager (mocked: nothing is written to source systems). */
  receipt: string;
  /** Who it was handed to (the demo roster, team.ts). Absent on a dismissal and on entries written before the roster. */
  handedTo?: Handover;
  /** Set when its workflow was deleted: the name it had, since `workflowId` no longer resolves. */
  deletedWorkflowName?: string;
}

/** What a person sends to decide on a proposal. */
export const Decision = z.object({
  approved: z.boolean(),
  by: z.string().min(1).max(60),
  note: z.string().max(400).default(''),
});
export type Decision = z.infer<typeof Decision>;

/**
 * What `POST /api/proposals/:id/decision` answers: the proposal as it now stands, who it was handed to (null for a
 * dismissal, and for a hotel without a roster), and the receipt written to the audit log.
 */
export interface DecisionReceipt {
  proposal: Proposal;
  handedTo: Handover | null;
  receipt: string;
}
