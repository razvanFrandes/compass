import { maskEmail } from '@compass/contracts';
import type { Extension, ToolExecutionApi, ToolRegistration } from '@earendil-works/pi-durable';
import { z } from 'zod';
import { composeWorkflowEmail, emailWorkflowBlocked, type EmailQuota, type EmailSender } from './email.ts';
import type { WorkflowStore } from './store.ts';

/**
 * The tool an email workflow acts with. The mail is a fixed template: the model fills in the summary, the facts and
 * the labels, never the recipient or the layout. Email is low risk, so no approval.
 *
 * At most one mail per run. The run is marked pending before the send and gets its receipt only when the send is
 * confirmed. A replayed or repeated call returns the receipt, or, when an earlier attempt never confirmed (a crash
 * mid-send, a sender error), sends nothing: a missing mail is better than the same mail twice.
 */

const SendEmailArgs = z.object({
  would_fire: z.boolean().describe("Whether the workflow's condition holds today, from your tool results"),
  summary: z.string().min(20).max(800).describe('What you found, in two or three sentences, quoting numbers from tool results'),
  facts: z.array(z.string().max(160)).min(1).max(6).describe('The key numbers, one per line, copied from tool results'),
  definition: z.string().max(300).describe('How the numbers are defined, from the tool result'),
  period: z.string().max(80).describe('The period the numbers cover, e.g. "December 2026"'),
  question: z.string().max(200).describe('A follow-up question the reader can ask Kassandra about this finding'),
});

const jsonSchema = (schema: z.ZodObject) => {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  return rest;
};

/** What a call tells the model, and whether a mail went out (a refusal is an answer, not a tool error). */
type Outcome = { text: string; sent: boolean };
const notSent = (text: string): Outcome => ({ text, sent: false });

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export interface EmailExtensionDeps {
  store: WorkflowStore;
  sender: EmailSender;
  quota: EmailQuota;
  /** The app's origin, for the "Explore in Kassandra" link. */
  appUrl: string;
  now?: () => Date;
}

export function createEmailExtension({ store, sender, quota, appUrl, now = () => new Date() }: EmailExtensionDeps): Extension {
  /** Sends in progress by run id, so two calls in one turn share one send. */
  const sending = new Map<string, Promise<Outcome>>();

  const sendEmail = {
    name: 'send_email',
    description:
      "Email the workflow's recipient what you found, in a fixed template. Call it after you checked the data, at most once per run. " +
      'The recipient is set by the workflow; you cannot choose it. Quote numbers from tool results only. ' +
      'On a scheduled run nothing is sent when would_fire is false; a test run always sends and says whether it would fire today.',
    parameters: jsonSchema(SendEmailArgs),
    replay: 'safe',
    async execute(rawArgs: unknown, api: ToolExecutionApi) {
      const scope = await store.runForSession(String(api.conversationId));
      if (!scope) throw new Error('send_email only works inside a workflow run.');
      const { run, workflow } = scope;

      const send = async (): Promise<Outcome> => {
        const earlier = await store.emailForRun(run.id);
        if (earlier) return { text: earlier, sent: true };
        if (await store.emailPending(run.id)) return notSent('An earlier attempt to send this email did not confirm; not sending again.');
        if (workflow.action.type !== 'email' || !workflow.delivery) return notSent('This workflow has no email action; no email sent.');

        const args = SendEmailArgs.parse(rawArgs);
        const test = run.test === true;
        if (!test && !args.would_fire) return notSent('Nothing to report; no email sent.');

        // One spelling of the address for the limits and for the send, so a variant cannot get its own allowance.
        const to = workflow.delivery.to.trim().toLowerCase();
        const allowed = await quota.take(to, run.client ?? 'manual');
        if (!allowed.ok) return notSent(`${allowed.reason} No email sent.`);

        // The last mail says so: with this send the workflow reaches its 5 emails, or its 7 days are over.
        const final = !test && emailWorkflowBlocked({ ...workflow, emailsSent: (workflow.emailsSent ?? 0) + 1 }, now()) !== null;
        const mail = composeWorkflowEmail({
          workflow, test, wouldFire: args.would_fire, summary: args.summary, facts: args.facts,
          definition: args.definition, period: args.period, question: args.question, appUrl, final,
        });
        await store.markEmailPending(run.id);
        const sent = await sender.send({ to, ...mail });
        if ('error' in sent) return notSent(`${sent.error} No email sent.`);

        const receipt = `Email ${sent.messageId} to ${maskEmail(to)}`;
        await store.recordEmail(run.id, workflow.id, receipt, test);
        await store.appendAudit({
          id: newId('audit'), at: now().toISOString(), workflowId: workflow.id, proposalId: '', hotel_code: workflow.hotels.join(', '),
          action: 'email', by: test ? 'workflow (test run)' : 'workflow', outcome: 'emailed', receipt,
        });
        return { text: receipt, sent: true };
      };

      let work = sending.get(run.id);
      if (!work) {
        work = send().finally(() => sending.delete(run.id));
        sending.set(run.id, work);
      }
      const outcome = await work;
      // `output` is what the model reads; `details.sent` tells the UI whether a mail went out.
      return { output: [{ type: 'text', text: outcome.text }], details: { sent: outcome.sent } };
    },
  } as unknown as ToolRegistration;

  return { name: 'compass-workflow-email', tools: [sendEmail] };
}
