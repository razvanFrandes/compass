import { ActionType, type Proposal } from '@compass/contracts';
import type { Context } from '@earendil-works/chord/context';
import { defineSignal, type Extension, type ToolExecutionApi, type ToolRegistration } from '@earendil-works/pi-durable';
import { bool, obj, str } from '@earendil-works/pi-schema';
import { z } from 'zod';
import { proposalRisk, proposalStatus } from '../../domain/action-risk.ts';
import { decisionOnRecord, handOver } from './decisions.ts';
import type { WorkflowStore } from './store.ts';

/**
 * The tools a workflow agent acts with. `propose_action` parks the call until a person decides: the decision arrives
 * as a durable signal (`app.decision`), so the wait survives deploys and evictions and holds no invocation meanwhile.
 * `apply_action` hands an approved action to the revenue manager as an RMS task and writes the audit log; Compass
 * itself never writes to source systems.
 */

export const DecisionSignal = defineSignal({
  name: 'app.decision',
  version: 1,
  schema: obj({ approved: bool(), by: str(), note: str() }),
});

const ProposeArgs = z.object({
  hotel_code: z.string().describe('Hotel code the action is for'),
  action: ActionType,
  title: z.string().min(5).max(120).describe('One decision, starting with a verb, with the nights in words, e.g. "Raise BAR for 16–18 Dec toward the comp set median". No hotel code.'),
  rationale: z
    .string()
    .min(10)
    .max(800)
    .describe(
      'Why, in two to four short sentences for a revenue manager: the money first, then the numbers behind it, quoted from your tool results. ' +
        'Hotel names, not codes; dates as "16–18 Dec"; a rate against the comp set as a percentage ("26% under the comp set median"), not a multiple. ' +
        'Never mention tools or what a tool did not return.',
    ),
  before: z.string().max(120).describe('The current state in a few words, e.g. "BAR AED 675–790"'),
  after: z.string().max(120).describe('The proposed state in a few words, e.g. "BAR AED 760–1,050"'),
  scope: z.string().max(160).describe('What the change covers, in words: nights as "16–18 Dec", room types or channels. No hotel code and no ISO dates.'),
  impact_eur: z.number().nullable().default(null).describe('EUR impact from a tool result, or null'),
  risk: z
    .enum(['low', 'high'])
    .describe('low: reversible and small (a notification, a task); high: prices, channels, contracts. adjust_bar, close_channel and open_channel are always high.'),
});

const ApplyArgs = z.object({ proposal_id: z.string() });

const jsonSchema = (schema: z.ZodObject) => {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  return rest;
};

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function createWorkflowExtension(store: WorkflowStore, now: () => Date = () => new Date()): Extension {
  const propose = {
    name: 'propose_action',
    description:
      'Propose one concrete action for a person to approve. Call it once per action, after you checked the data. ' +
      'Depending on how far the agent may go it is recorded as a suggestion, applied automatically (low risk), or waits for approval. ' +
      'When it returns approved, call apply_action with the proposal id.',
    parameters: jsonSchema(ProposeArgs),
    replay: 'safe',
    async execute(rawArgs: unknown, api: ToolExecutionApi, context: Context) {
      const scope = await store.runForSession(String(api.conversationId));
      if (!scope) throw new Error('propose_action only works inside a workflow run.');
      const { run, workflow } = scope;
      if (workflow.action.type === 'email') {
        return { output: [{ type: 'text', text: 'This agent sends an email and proposes nothing. Call send_email instead.' }] };
      }

      const existing = await store.proposalForTask(api.taskId);
      if (existing) {
        // Woken after a park: read the person's decision.
        const decision = await api.readSignal(DecisionSignal, 'decision', context);
        if (!decision || !('value' in decision)) return { sleep: { signals: [DecisionSignal.key('decision')] } };
        const { approved, by, note } = decision.value;
        // The app records a decision when the person makes it (decisions.ts): it is then already handed over or
        // dismissed, and may even have been taken back since. The agent only learns of it and never writes over it.
        if (await decisionOnRecord(store, existing.id)) {
          await store.updateRun(run.id, { status: 'running' });
          const text = approved
            ? `Approved by ${by}${note ? ` ("${note}")` : ''} and already handed over as a task. Do not call apply_action for proposal ${existing.id}; report what was sent.`
            : `Declined by ${by}${note ? `: "${note}"` : ''}. Do not apply proposal ${existing.id}; report the decision.`;
          return { output: [{ type: 'text', text }], details: { proposal: existing } };
        }
        const decided: Proposal = { ...existing, status: approved ? 'approved' : 'denied', decidedBy: by, decidedAt: now().toISOString(), note: note || null };
        await store.saveProposal(decided, api.taskId);
        await store.updateRun(run.id, { status: 'running' });
        const text = approved
          ? `Approved by ${by}${note ? ` ("${note}")` : ''}. Call apply_action with proposal_id "${existing.id}".`
          : `Declined by ${by}${note ? `: "${note}"` : ''}. Do not apply proposal ${existing.id}; report the decision.`;
        return { output: [{ type: 'text', text }], details: { proposal: decided } };
      }

      const args = ProposeArgs.parse(rawArgs);
      // The model's risk rating is advice: price and channel actions are always high risk, so they always need a person.
      const risk = proposalRisk(args.action, args.risk);
      const status = proposalStatus(workflow.autonomy, risk);
      const proposal: Proposal = {
        id: newId('prop'),
        workflowId: workflow.id,
        runId: run.id,
        hotel_code: args.hotel_code,
        action: args.action,
        title: args.title,
        rationale: args.rationale,
        change: { before: args.before, after: args.after, scope: args.scope },
        impact_eur: args.impact_eur,
        risk,
        status,
        createdAt: now().toISOString(),
        decidedBy: status === 'auto_approved' ? 'auto (low risk)' : null,
        decidedAt: status === 'auto_approved' ? now().toISOString() : null,
        note: null,
      };
      // An amended proposal for the same hotel and action replaces any earlier one of this run not yet applied.
      for (const earlier of await store.proposalsForRun(run.id)) {
        if (earlier.hotel_code === proposal.hotel_code && earlier.action === proposal.action && ['pending', 'approved', 'auto_approved'].includes(earlier.status)) {
          await store.updateProposal({ ...earlier, status: 'superseded' });
        }
      }
      await store.saveProposal(proposal, api.taskId);

      if (status === 'suggested') {
        await store.appendAudit({
          id: newId('audit'), at: now().toISOString(), workflowId: workflow.id, proposalId: proposal.id, hotel_code: proposal.hotel_code,
          action: proposal.action, by: 'workflow (suggest only)', outcome: 'suggested', receipt: 'Recorded as a suggestion. Nothing was sent.',
        });
        return { output: [{ type: 'text', text: `Recorded proposal ${proposal.id} as a suggestion. This agent only suggests: do not apply it.` }], details: { proposal } };
      }
      if (status === 'auto_approved') {
        return { output: [{ type: 'text', text: `Approved automatically (low risk). Call apply_action with proposal_id "${proposal.id}".` }], details: { proposal } };
      }
      // Wait for a person. The call parks; nothing runs until the decision signal arrives.
      await store.updateRun(run.id, { status: 'waiting_approval' });
      return { sleep: { signals: [DecisionSignal.key('decision')] } };
    },
  } as unknown as ToolRegistration;

  const apply = {
    name: 'apply_action',
    description:
      'Apply an approved proposal: it is handed to the revenue manager as an RMS task and written to the audit log. ' +
      'Only works for approved proposals; calling it twice returns the same receipt.',
    parameters: jsonSchema(ApplyArgs),
    replay: 'safe',
    async execute(rawArgs: unknown) {
      const { proposal_id } = ApplyArgs.parse(rawArgs);
      const proposal = await store.getProposal(proposal_id);
      if (!proposal) throw new Error(`No proposal ${proposal_id}.`);
      if (proposal.status === 'applied') {
        const done = await store.auditForProposal(proposal_id);
        return { output: [{ type: 'text', text: `Already applied: ${done?.receipt ?? ''}` }] };
      }
      if (proposal.status !== 'approved' && proposal.status !== 'auto_approved') {
        throw new Error(`Proposal ${proposal_id} is ${proposal.status}; only approved proposals can be applied.`);
      }
      // Handed to the person at the hotel whose job it is (the demo roster), and logged with their name.
      const { proposal: applied, receipt } = await handOver(store, proposal, proposal.decidedBy ?? 'unknown', now);
      return { output: [{ type: 'text', text: receipt }], details: { proposal: applied, receipt } };
    },
  } as unknown as ToolRegistration;

  return { name: 'compass-workflow', tools: [propose, apply] };
}
