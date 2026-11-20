import { WorkflowSpec } from '@compass/contracts';
import type { Extension, ToolRegistration } from '@earendil-works/pi-durable';
import { z } from 'zod';

/**
 * Lets Kassandra draft a workflow from a conversation ("watch Dubai every morning and ask me before raising rates").
 * It only validates and returns the spec: the UI shows it as an editable card and the person saves it.
 */
export function createDraftWorkflowExtension(): Extension {
  const { $schema: _ignored, ...parameters } = z.toJSONSchema(WorkflowSpec, { io: 'input' }) as Record<string, unknown>;
  const draft = {
    name: 'draft_workflow',
    description:
      'Draft a workflow (an agent that watches the data, proposes an action and acts after approval) from what the user ' +
      'asked for. Triggers: a morning brief finding, a daily/weekly schedule, or manual. Autonomy: suggest, approve (default), ' +
      'or auto_low_risk. The draft is shown to the user to edit and save; nothing runs until they save it.',
    parameters,
    replay: 'safe',
    async execute(args: unknown) {
      const parsed = WorkflowSpec.safeParse(args);
      if (!parsed.success) throw new Error(`Invalid workflow: ${z.prettifyError(parsed.error)}`);
      return {
        output: [{ type: 'text', text: `Draft "${parsed.data.name}" is ready for the user to review and save. Summarise it in one sentence.` }],
        details: { workflowDraft: parsed.data },
      };
    },
  } as unknown as ToolRegistration;
  return { name: 'compass-workflow-drafts', tools: [draft] };
}
