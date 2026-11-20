import { maskEmail, WorkflowSpecShape, type ActionType, type BriefTriggerKind, type WorkflowDraft, type WorkflowTrigger } from './workflows.ts';
import type { z } from 'zod';

/**
 * A workflow as a chain of nodes, derived from its draft: trigger → scope → check(s) → analyze → [approval] → action.
 * A part that is still missing is a placeholder node, so the whole chain shows from the first message and fills in.
 * Positions are the canvas's job.
 */

export type WorkflowNodeKind = 'trigger' | 'scope' | 'check' | 'analyze' | 'approval' | 'action';

export interface WorkflowNode {
  /** The kind, or `check:<tool>` for a check. Stable across edits, so a canvas can animate what changed. */
  id: string;
  kind: WorkflowNodeKind;
  label: string;
  detail: string;
  /** empty: no value yet. draft: a value that is not valid or complete yet. complete: ready to save. */
  state: 'empty' | 'draft' | 'complete';
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: { from: string; to: string }[];
}

/** Short names for the data tools that make sense as a check. Any other tool shows under its own name. */
export const CHECK_LABELS: Record<string, string> = {
  get_pace: 'Pace vs last year',
  get_pickup: 'Pickup in the last days',
  get_rate_position: 'Rate vs the comp set',
  get_channel_mix: 'Channel mix',
  get_mix: 'Business mix',
  get_metric: 'A metric',
  get_forecast: 'Forecast',
  get_pnl: 'Profit and loss',
  get_data_health: 'Data freshness',
  get_web_funnel: 'Website funnel',
  get_account_production: 'Account production',
  get_review_scores: 'Review scores',
  find_reviews: 'What guests say',
  get_brief: 'The morning brief',
};

const FINDING_LABELS: Record<z.infer<typeof BriefTriggerKind>, string> = {
  data_stale: 'stale data',
  pace_behind: 'pace behind',
  underpriced_demand: 'underpriced demand',
  account_loss: 'an account loss',
  web_conversion_drop: 'a web conversion drop',
  staffing_gap: 'a staffing gap',
  rooms_out_of_order: 'rooms out of order',
  gop_miss: 'a GOP miss',
};

const ACTION_LABELS: Record<ActionType, string> = {
  adjust_bar: 'Adjust BAR',
  close_channel: 'Close a channel',
  open_channel: 'Open a channel',
  contact_account: 'Contact an account',
  create_task: 'Create a task',
  notify: 'Notify the team',
  email: 'Email',
};

const APPROVER_LABELS = { revenue_manager: 'the revenue manager', gm: 'the general manager' } as const;

const fields = WorkflowSpecShape.shape;
const stateOf = (field: z.ZodType, value: unknown): WorkflowNode['state'] => (field.safeParse(value).success ? 'complete' : 'draft');

function triggerNode(trigger: WorkflowTrigger | undefined): WorkflowNode {
  const node = { id: 'trigger', kind: 'trigger' } as const;
  if (!trigger) return { ...node, label: 'Choose a trigger', detail: 'When should it run?', state: 'empty' };
  const state = stateOf(fields.trigger, trigger);
  if (trigger.kind === 'schedule') {
    return { ...node, label: trigger.every === 'week' ? 'Every week, after the brief' : 'Every morning, after the brief', detail: 'On a schedule', state };
  }
  if (trigger.kind === 'brief') {
    return { ...node, label: `When the brief finds ${FINDING_LABELS[trigger.finding] ?? trigger.finding}`, detail: 'After the morning brief', state };
  }
  return { ...node, label: 'Run by hand', detail: 'Only when someone starts it', state };
}

function scopeNode(hotels: string[] | undefined): WorkflowNode {
  const node = { id: 'scope', kind: 'scope' } as const;
  if (!hotels?.length) return { ...node, label: 'Choose hotels', detail: 'Which hotels should it watch?', state: 'empty' };
  const state = stateOf(fields.hotels, hotels);
  if (hotels.includes('ALL')) return { ...node, label: 'All 20 hotels', detail: 'The whole group', state };
  return { ...node, label: hotels.join(', '), detail: hotels.length === 1 ? '1 hotel' : `${hotels.length} hotels`, state };
}

function checkNodes(checks: string[] | undefined): WorkflowNode[] {
  if (!checks?.length) return [{ id: 'check', kind: 'check', label: 'Add a check', detail: 'Which numbers should it look at?', state: 'empty' }];
  return [...new Set(checks)].map((tool) => ({ id: `check:${tool}`, kind: 'check', label: CHECK_LABELS[tool] ?? tool, detail: tool, state: 'complete' }));
}

function analyzeNode(goal: string | undefined): WorkflowNode {
  const node = { id: 'analyze', kind: 'analyze' } as const;
  if (!goal) return { ...node, label: 'Describe what to watch', detail: 'What should it look for, and when should it act?', state: 'empty' };
  return { ...node, label: 'Kassandra explains why', detail: goal, state: stateOf(fields.goal, goal) };
}

/** Email is low risk and needs no approval; a workflow that only suggests never acts, so it has nothing to approve. */
function approvalNode(draft: WorkflowDraft): WorkflowNode | null {
  const autonomy = draft.autonomy ?? 'approve';
  if (!draft.action || draft.action.type === 'email' || autonomy === 'suggest') return null;
  const approver = APPROVER_LABELS[draft.approver ?? 'revenue_manager'];
  return {
    id: 'approval',
    kind: 'approval',
    label: autonomy === 'auto_low_risk' ? 'Approval for higher-risk actions' : 'Waits for approval',
    detail: autonomy === 'auto_low_risk' ? `Acts alone on low-risk actions, asks ${approver} for the rest` : `Approved by ${approver}`,
    state: 'complete',
  };
}

function actionNode(draft: WorkflowDraft): WorkflowNode {
  const node = { id: 'action', kind: 'action' } as const;
  const { action, delivery } = draft;
  if (!action) return { ...node, label: 'Choose an action', detail: 'What should it do when it finds something?', state: 'empty' };
  const detail = action.guidance ?? '';
  if (action.type === 'email') {
    if (!delivery) return { ...node, label: 'Email', detail: detail || 'Needs an address to send to', state: 'draft' };
    const valid = stateOf(fields.action, action) === 'complete' && stateOf(fields.delivery, delivery) === 'complete';
    return { ...node, label: `Email ${maskEmail(delivery.to)}`, detail, state: valid ? 'complete' : 'draft' };
  }
  // A recipient on any other action is not a valid workflow yet.
  const state = delivery ? 'draft' : stateOf(fields.action, action);
  return { ...node, label: ACTION_LABELS[action.type] ?? action.type, detail, state };
}

/** Pure: the same draft always gives the same graph. Used by the worker and by the canvas. */
export function specToGraph(draft: WorkflowDraft): WorkflowGraph {
  const approval = approvalNode(draft);
  const nodes = [
    triggerNode(draft.trigger),
    scopeNode(draft.hotels),
    ...checkNodes(draft.checks),
    analyzeNode(draft.goal),
    ...(approval ? [approval] : []),
    actionNode(draft),
  ];
  const edges = nodes.slice(1).map((node, i) => ({ from: nodes[i]!.id, to: node.id }));
  return { nodes, edges };
}

/** The ids of the nodes in `after` that are new or that read differently than in `before`, in chain order. */
export function changedNodes(before: WorkflowGraph, after: WorkflowGraph): string[] {
  const previous = new Map(before.nodes.map((node) => [node.id, node]));
  return after.nodes
    .filter((node) => {
      const was = previous.get(node.id);
      return !was || was.label !== node.label || was.detail !== node.detail || was.state !== node.state;
    })
    .map((node) => node.id);
}
