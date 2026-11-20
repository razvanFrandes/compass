import { z } from 'zod';

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
]);

export const WorkflowTrigger = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('schedule'), every: z.enum(['day', 'week']).describe('Runs after the morning brief') }),
  z.object({ kind: z.literal('brief'), finding: BriefTriggerKind.describe('Runs when the morning brief has this finding for one of its hotels') }),
  z.object({ kind: z.literal('manual') }),
]);
export type WorkflowTrigger = z.infer<typeof WorkflowTrigger>;

export const ActionType = z.enum(['adjust_bar', 'close_channel', 'open_channel', 'contact_account', 'create_task', 'notify']);
export type ActionType = z.infer<typeof ActionType>;

/**
 * suggest: propose only, never act. approve: act after a person approves. auto_low_risk: act alone on low-risk
 * actions, ask for the rest. Trust is earned gradually (suggest → approve → act alone).
 */
export const Autonomy = z.enum(['suggest', 'approve', 'auto_low_risk']);
export type Autonomy = z.infer<typeof Autonomy>;

export const WorkflowSpec = z.object({
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
  approver: z.enum(['revenue_manager', 'gm']).default('revenue_manager'),
  autonomy: Autonomy.default('approve'),
  enabled: z.boolean().default(true),
});
export type WorkflowSpec = z.infer<typeof WorkflowSpec>;
export type WorkflowSpecInput = z.input<typeof WorkflowSpec>;

export interface Workflow extends WorkflowSpec {
  id: string;
  createdAt: string;
  createdBy: 'template' | 'user' | 'kassandra';
  lastRun: { runId: string; at: string; status: WorkflowRun['status'] } | null;
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
}

export interface AuditEntry {
  id: string;
  at: string;
  workflowId: string;
  proposalId: string;
  hotel_code: string;
  action: ActionType;
  by: string;
  outcome: 'sent_to_rms' | 'suggested' | 'undone';
  /** The task handed to the RMS / revenue manager (mocked: nothing is written to source systems). */
  receipt: string;
}

/** What a person sends to decide on a proposal. */
export const Decision = z.object({
  approved: z.boolean(),
  by: z.string().min(1).max(60),
  note: z.string().max(400).default(''),
});
export type Decision = z.infer<typeof Decision>;
