import type { ChatEntry, ChatLive } from '@compass/contracts';

/**
 * The builder's transcript as a conversation: what the person said, what the agent did (its tool calls, folded
 * into one line such as "Set trigger · Set hotels · Added check"), and its short replies.
 */

export type StepStatus = 'running' | 'done' | 'error';

export interface BuilderStep {
  callId: string;
  /** What the call did, in two or three words: "Set trigger". */
  label: string;
  /** The value it set, when the arguments say so: "Every morning". */
  detail: string;
  status: StepStatus;
  /** Why it failed, when it did. */
  error?: string;
}

export type ConversationItem =
  | { kind: 'user'; key: string; text: string }
  | { kind: 'steps'; key: string; steps: BuilderStep[]; summary: string; running: boolean }
  | { kind: 'assistant'; key: string; text: string; streaming: boolean }
  | { kind: 'note'; key: string; text: string }
  | { kind: 'failure'; key: string; text: string };

/** The same short names as `CHECK_LABELS` in @compass/contracts, kept here so the chat does not bundle zod. */
export const DATA_TOOL_LABELS: Record<string, string> = {
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

const ACTION_NAMES: Record<string, string> = {
  adjust_bar: 'Adjust BAR',
  close_channel: 'Close a channel',
  open_channel: 'Open a channel',
  contact_account: 'Contact an account',
  create_task: 'Create a task',
  notify: 'Notify the team',
  email: 'Email',
};

const NODE_NAMES: Record<string, string> = { trigger: 'trigger', scope: 'hotels', check: 'checks', analyze: 'goal', approval: 'approval', action: 'action' };

const FAILURES: Record<string, string> = {
  aborted: 'Stopped.',
  turn_limit: 'Kassandra stopped after too many steps. Ask again to continue.',
  model_error: 'Kassandra could not answer just now. Try again in a moment.',
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);
const humanize = (name: string) => name.replace(/^(get|list|find|search)_/, '').replaceAll('_', ' ');

/** An address as anyone may read it: `silviu@gmail.com` → `si****@gmail.com` (the rule of `maskEmail` in contracts). */
export function maskAddress(address: string): string {
  const at = address.lastIndexOf('@');
  if (at < 1) return '****';
  return `${address.slice(0, Math.min(2, at))}****${address.slice(at)}`;
}

function triggerDetail(args: Record<string, unknown>): string {
  if (args['kind'] === 'schedule') return args['every'] === 'week' ? 'Every week' : 'Every morning';
  if (args['kind'] === 'brief') return `On ${text(args['finding']).replaceAll('_', ' ') || 'a brief finding'}`;
  if (args['kind'] === 'manual') return 'By hand';
  return '';
}

function hotelsDetail(args: Record<string, unknown>): string {
  const hotels = Array.isArray(args['hotels']) ? args['hotels'].filter((code): code is string => typeof code === 'string') : [];
  if (hotels.includes('ALL')) return 'All hotels';
  return hotels.length > 4 ? `${hotels.slice(0, 4).join(', ')} +${hotels.length - 4}` : hotels.join(', ');
}

/** One tool call as a step: what it did and, when the arguments say so, the value it set. */
export function stepLabel(name: string, args: Record<string, unknown> = {}): { label: string; detail: string } {
  switch (name) {
    case 'set_trigger':
      return { label: 'Set trigger', detail: triggerDetail(args) };
    case 'set_hotels':
      return { label: 'Set hotels', detail: hotelsDetail(args) };
    case 'add_check':
      return { label: 'Added check', detail: DATA_TOOL_LABELS[text(args['tool'])] ?? text(args['tool']) };
    case 'remove_check':
      return { label: 'Removed check', detail: DATA_TOOL_LABELS[text(args['tool'])] ?? text(args['tool']) };
    case 'set_goal':
      return { label: 'Wrote goal', detail: text(args['name']) };
    case 'set_action':
      return { label: 'Set action', detail: ACTION_NAMES[text(args['type'])] ?? text(args['type']) };
    case 'set_email':
      return { label: 'Set email', detail: args['to'] ? maskAddress(text(args['to'])) : '' };
    case 'list_hotels':
      return { label: 'Looked up hotels', detail: '' };
    case 'list_metrics':
      return { label: 'Looked up metrics', detail: '' };
    default: {
      const known = DATA_TOOL_LABELS[name];
      return { label: `Read ${known ? lowerFirst(known) : humanize(name)}`, detail: hotelsDetail(args) };
    }
  }
}

/** "Set trigger · Set hotels · Added check": the folded line of a turn's steps. */
export function stepsSummary(steps: readonly BuilderStep[]): string {
  return steps.map((step) => step.label).join(' · ');
}

function editNote(data: unknown): string {
  const changed = data && typeof data === 'object' && Array.isArray((data as { changed?: unknown }).changed) ? ((data as { changed: unknown[] }).changed as unknown[]) : [];
  const names = [...new Set(changed.filter((id): id is string => typeof id === 'string').map((id) => NODE_NAMES[id.split(':')[0]!] ?? id))];
  return names.length ? `You edited the ${joinWords(names)} on the canvas` : 'You edited the workflow on the canvas';
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

export function failureText(failure: NonNullable<ChatLive['failure']>): string {
  return FAILURES[failure.reason] ?? 'Kassandra stopped before finishing. Try again.';
}

/**
 * Pure: the same transcript and live state always give the same conversation.
 * The tool calls between a question and its answer are one `steps` item; while the answer is being written the
 * calls still open and the streamed text come from `live`.
 */
export function toConversation(entries: readonly ChatEntry[], live: ChatLive): ConversationItem[] {
  const items: ConversationItem[] = [];
  const results = new Map<string, Extract<ChatEntry, { kind: 'tool_result' }>>();
  for (const entry of entries) if (entry.kind === 'tool_result') results.set(entry.callId, entry);

  let group: Extract<ConversationItem, { kind: 'steps' }> | null = null;
  const seen = new Set<string>();

  for (const entry of entries) {
    if (entry.kind === 'user') {
      group = null;
      items.push({ kind: 'user', key: `e${entry.id}`, text: entry.text });
    } else if (entry.kind === 'assistant') {
      if (entry.toolCalls.length) {
        if (!group) {
          group = { kind: 'steps', key: `s${entry.id}`, steps: [], summary: '', running: false };
          items.push(group);
        }
        for (const call of entry.toolCalls) {
          const result = results.get(call.callId);
          seen.add(call.callId);
          group.steps.push({
            callId: call.callId,
            ...stepLabel(call.name, call.args),
            status: result ? (result.isError ? 'error' : 'done') : live.running ? 'running' : 'done',
            ...(result?.isError && result.error ? { error: result.error } : {}),
          });
        }
      }
      // What the agent says alongside a tool call is narration of the step; only a turn's last message is its reply.
      if (entry.stopReason !== 'toolUse' && entry.text.trim()) {
        group = null;
        items.push({ kind: 'assistant', key: `e${entry.id}`, text: entry.text, streaming: false });
      }
    } else if (entry.kind === 'event' && entry.type === 'app.edit') {
      group = null;
      items.push({ kind: 'note', key: `e${entry.id}`, text: editNote(entry.data) });
    }
  }

  if (live.running) {
    // Calls the model has just asked for, before they land as an entry.
    const pending = live.tools.filter((tool) => !seen.has(tool.callId));
    if (pending.length && !group) {
      group = { kind: 'steps', key: 'live-steps', steps: [], summary: '', running: true };
      items.push(group);
    }
    for (const tool of pending) {
      group!.steps.push({ callId: tool.callId, ...stepLabel(tool.name), status: tool.status === 'done' ? 'done' : 'running' });
    }
    if (live.streamingText.trim()) items.push({ kind: 'assistant', key: 'live-text', text: live.streamingText, streaming: true });
  } else if (live.failure) {
    items.push({ kind: 'failure', key: 'failure', text: failureText(live.failure) });
  }

  for (const item of items) {
    if (item.kind !== 'steps') continue;
    item.summary = stepsSummary(item.steps);
    item.running = live.running && item === group;
  }
  return items;
}

const ISSUE_FIELDS: Record<string, string> = {
  name: 'Name',
  trigger: 'Trigger',
  hotels: 'Hotels',
  checks: 'Checks',
  goal: 'Goal',
  action: 'Action',
  delivery: 'Email address',
  approver: 'Approver',
  autonomy: 'Autonomy',
  workflow: 'Workflow',
};

/** `delivery.to: Invalid email` → `Email address: Invalid email`. */
export function issueText(issue: string): string {
  const colon = issue.indexOf(':');
  if (colon < 1) return issue;
  const field = issue.slice(0, colon).split('.')[0]!;
  const message = issue.slice(colon + 1).trim();
  const name = ISSUE_FIELDS[field];
  if (!name) return issue;
  return /^(invalid input|required)/i.test(message) ? `${name}: not set yet` : `${name}: ${message}`;
}
