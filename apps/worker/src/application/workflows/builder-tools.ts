import { ActionType, BriefTriggerKind, specToGraph, WorkflowSpecShape, type WorkflowDraft, type WorkflowGraph } from '@compass/contracts';
import type { Extension, ToolRegistration } from '@earendil-works/pi-durable';
import { z } from 'zod';

/**
 * The tools the builder agent edits a workflow draft with. Each call changes one part of the draft, so the canvas
 * fills in node by node; the result shows the model the whole chain as it now reads. An invalid value fails the
 * call with the reason and changes nothing.
 */

/** Where the draft lives (the builder's Durable Object; in memory in tests). `apply` validates, stores and announces. */
export interface DraftHost {
  get(): Promise<WorkflowDraft>;
  apply(patch: WorkflowDraft): Promise<{ changed: string[] } | { error: string }>;
}

const spec = WorkflowSpecShape.shape;

// Flat, because a tool's parameters must be one object; the draft checks that the parts fit the kind.
const TriggerArgs = z.object({
  kind: z.enum(['schedule', 'brief', 'manual']).describe('schedule: every day or week, after the morning brief. brief: when the brief has a finding. manual: only when someone starts it.'),
  every: z.enum(['day', 'week']).optional().describe('For kind "schedule"'),
  finding: BriefTriggerKind.optional().describe('For kind "brief": the finding that starts it'),
});
const HotelsArgs = z.object({ hotels: spec.hotels });
const CheckArgs = z.object({ tool: z.string().describe('The name of a data tool') });
const GoalArgs = z.object({
  name: spec.name.describe('A short name for the workflow'),
  goal: spec.goal.describe('What to watch and when to act, in plain language'),
});
const ActionArgs = z.object({
  type: ActionType,
  guidance: z.string().max(400).optional().describe('How to act, e.g. what the message should say'),
});
const EmailArgs = z.object({ to: z.string().describe('The one address the email goes to') });

const jsonSchema = (schema: z.ZodObject) => {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  return rest;
};

function parse<T>(schema: z.ZodType<T>, rawArgs: unknown): T {
  const parsed = schema.safeParse(rawArgs);
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join('.') || 'arguments'}: ${issue.message}`).join(' '));
  return parsed.data;
}

const chain = (graph: WorkflowGraph) => graph.nodes.map((node) => (node.state === 'empty' ? `(${node.label})` : node.label)).join(' → ');

export function createBuilderExtension(host: DraftHost, allowedChecks: readonly string[]): Extension {
  const result = (said: string, graph: WorkflowGraph, changed: string[]) => ({
    output: [{ type: 'text', text: `${said} Chain: ${chain(graph)}` }],
    details: { graph, changed },
  });

  /** Applies one patch and reports the chain as it now reads. */
  const edit = async (patch: WorkflowDraft, said: string) => {
    const applied = await host.apply(patch);
    if ('error' in applied) throw new Error(applied.error);
    return result(said, specToGraph(await host.get()), applied.changed);
  };

  const tool = (name: string, description: string, args: z.ZodObject, execute: (rawArgs: unknown) => Promise<unknown>) =>
    ({ name, description, parameters: jsonSchema(args), replay: 'safe', execute }) as unknown as ToolRegistration;

  const checkList = `One of: ${allowedChecks.join(', ')}.`;

  return {
    name: 'compass-workflow-builder',
    tools: [
      tool('set_trigger', 'Set when the workflow runs: on a schedule, on a morning brief finding, or by hand.', TriggerArgs, (rawArgs) =>
        edit({ trigger: rawArgs as WorkflowDraft['trigger'] }, 'Set the trigger.'),
      ),

      tool('set_hotels', 'Set the hotels the workflow watches: hotel codes, or ["ALL"] for the whole group. Replaces the current list.', HotelsArgs, (rawArgs) => {
        const { hotels } = parse(HotelsArgs, rawArgs);
        return edit({ hotels }, `Set the hotels to ${hotels.join(', ')}.`);
      }),

      tool('add_check', `Add a data tool the workflow checks first, at most 8. ${checkList}`, CheckArgs, async (rawArgs) => {
        const { tool: name } = parse(CheckArgs, rawArgs);
        const draft = await host.get();
        const checks = draft.checks ?? [];
        if (checks.includes(name)) return result(`${name} is already a check; nothing changed.`, specToGraph(draft), []);
        return edit({ checks: [...checks, name] }, `Added the check ${name}.`);
      }),

      tool('remove_check', 'Remove a check from the workflow.', CheckArgs, async (rawArgs) => {
        const { tool: name } = parse(CheckArgs, rawArgs);
        const checks = (await host.get()).checks ?? [];
        if (!checks.includes(name)) throw new Error(`${name} is not a check of this workflow. Its checks: ${checks.join(', ') || 'none'}.`);
        return edit({ checks: checks.filter((check) => check !== name) }, `Removed the check ${name}.`);
      }),

      tool('set_goal', 'Name the workflow and say what it watches and when it acts. This is the brief the workflow agent follows.', GoalArgs, (rawArgs) => {
        const { name, goal } = parse(GoalArgs, rawArgs);
        return edit({ name, goal }, `Named it "${name}" and set the goal.`);
      }),

      tool(
        'set_action',
        'Set what the workflow does when it finds something. For "email" also call set_email with the address. Any other action removes the email address.',
        ActionArgs,
        (rawArgs) => {
          const { type, guidance } = parse(ActionArgs, rawArgs);
          const action = { type, guidance: guidance ?? '' };
          // Only an email action has an address; one left behind would keep the draft from ever being saved.
          return edit(type === 'email' ? { action } : { action, delivery: undefined }, `Set the action to ${type}.`);
        },
      ),

      tool('set_email', 'Make the workflow send an email to one address. Replaces any other action.', EmailArgs, async (rawArgs) => {
        const { to } = parse(EmailArgs, rawArgs);
        const current = (await host.get()).action;
        const action = current?.type === 'email' ? current : { type: 'email' as const };
        return edit({ action, delivery: { channel: 'email', to } }, 'Set the email address.');
      }),
    ],
  };
}
