import { maskEmail, type Workflow, type WorkflowRun } from '@compass/contracts';

/** A mail ready to go out. */
export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends one mail. A failure is a value, not an exception. */
export interface EmailSender {
  send(email: OutgoingEmail): Promise<{ messageId: string } | { error: string }>;
}

/**
 * The send limits of the public demo: per recipient, per client and for everyone together.
 * `take` uses one unit from all three windows, or from none when any of them is full.
 */
export interface EmailQuota {
  take(recipient: string, client: string): Promise<{ ok: true } | { ok: false; reason: string }>;
}

export interface WorkflowEmailInput {
  workflow: Workflow;
  /** A "send test now" run. */
  test: boolean;
  /** Whether the workflow's condition holds today. A test is sent either way. */
  wouldFire: boolean;
  summary: string;
  facts: string[];
  /** How the numbers are defined. */
  definition: string;
  /** The period the numbers cover. */
  period: string;
  /** The question the Explore link asks Kassandra. */
  question: string;
  /** The app's origin, e.g. https://juyo.razvanfrandes.com. */
  appUrl: string;
  /** The workflow's last mail: with it the workflow reaches its limit and stops. */
  final?: boolean;
}

export const LAST_EMAIL = 'This was the last email from this workflow: it has reached its limit of 7 days or 5 emails and is now paused.';

export const FOOTER = 'Compass demo · fictional data · you got this because someone entered your address in a Compass workflow.';

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** One line, so a name can never add a header. */
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MUTED = 'color:#6b7280;font-size:13px;line-height:1.5';

/** Pure: the subject and both bodies of a workflow's mail. Every value from the model or the user is escaped in the HTML. */
export function composeWorkflowEmail(input: WorkflowEmailInput): Omit<OutgoingEmail, 'to'> {
  const name = oneLine(input.workflow.name);
  const subject = input.test ? `Test · ${name}` : name;
  const note = input.test ? `Test run · ${input.wouldFire ? 'Would fire today' : 'Would not fire today'}` : null;
  const link = `${input.appUrl.replace(/\/+$/, '')}/ask?q=${encodeURIComponent(input.question)}`;

  const text = [
    name,
    ...(note ? [note] : []),
    input.summary,
    ...(input.facts.length ? [input.facts.map((fact) => `- ${fact}`).join('\n')] : []),
    `Definition: ${input.definition}\nPeriod: ${input.period}`,
    ...(input.final ? [LAST_EMAIL] : []),
    `Explore in Kassandra: ${link}`,
    `--\n${FOOTER}`,
  ].join('\n\n');

  const facts = input.facts.length
    ? `<ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.6">${input.facts.map((fact) => `<li style="margin:0 0 4px">${escapeHtml(fact)}</li>`).join('')}</ul>`
    : '';
  const html = [
    '<!doctype html>',
    `<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>`,
    `<body style="margin:0;padding:24px 16px;background:#f3f4f6;${FONT};color:#111827">`,
    '<div style="max-width:560px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px">',
    note ? `<p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#92400e">${escapeHtml(note)}</p>` : '',
    `<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(name)}</h1>`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;white-space:pre-line">${escapeHtml(input.summary)}</p>`,
    facts,
    `<p style="margin:0 0 4px;${MUTED}">${escapeHtml(input.definition)}</p>`,
    `<p style="margin:0 0 24px;${MUTED}">Period: ${escapeHtml(input.period)}</p>`,
    input.final ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.5;font-weight:600;color:#92400e">${escapeHtml(LAST_EMAIL)}</p>` : '',
    `<p style="margin:0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#111827;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">Explore in Kassandra</a></p>`,
    '</div>',
    `<p style="max-width:560px;margin:16px auto 0;text-align:center;${MUTED}">${escapeHtml(FOOTER)}</p>`,
    '</body></html>',
  ].join('');

  return { subject, text, html };
}

export const EMAIL_WORKFLOW_LIMITS = { days: 7, emails: 5 } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure: why an email workflow may not send on its own any more, or null when it may. The public demo has no login, so
 * an email workflow ends after 7 days or 5 sent emails, whichever comes first. Other workflows are never blocked.
 */
export function emailWorkflowBlocked(workflow: Workflow, now: Date): string | null {
  if (workflow.action.type !== 'email') return null;
  if ((workflow.emailsSent ?? 0) >= EMAIL_WORKFLOW_LIMITS.emails) {
    return `This workflow has sent its ${EMAIL_WORKFLOW_LIMITS.emails} emails and is now off. Create a new workflow to keep getting them.`;
  }
  if (now.getTime() > Date.parse(workflow.createdAt) + EMAIL_WORKFLOW_LIMITS.days * DAY_MS) {
    return `Email workflows stop after ${EMAIL_WORKFLOW_LIMITS.days} days and this one is now off. Create a new workflow to keep getting them.`;
  }
  return null;
}

/** A workflow as the open API shows it: the recipient masked, in a copy. Storage keeps the real address for the runs. */
export function publicWorkflow<T extends Pick<Workflow, 'delivery'>>(workflow: T): T {
  return workflow.delivery ? { ...workflow, delivery: { ...workflow.delivery, to: maskEmail(workflow.delivery.to) } } : workflow;
}

/** A run as the open API shows it: without the address of the client that started it. */
export function publicRun(run: WorkflowRun): WorkflowRun {
  const { client: _private, ...shown } = run;
  return shown;
}

/**
 * Pure: whether a patch's `delivery` names another recipient than the saved one. Repeating the address is fine, as
 * saved or as the API shows it (masked), so a client can send back the workflow it read.
 */
export function recipientChanged(current: Pick<Workflow, 'delivery'>, delivery: unknown): boolean {
  const to = (delivery as { to?: unknown } | null)?.to;
  if (typeof to !== 'string' || !current.delivery) return true;
  const saved = current.delivery.to.trim().toLowerCase();
  const given = to.trim().toLowerCase();
  return given !== saved && given !== maskEmail(saved);
}
