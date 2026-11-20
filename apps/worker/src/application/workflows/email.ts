import type { Workflow } from '@compass/contracts';

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
}

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
    `<p style="margin:0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#111827;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">Explore in Kassandra</a></p>`,
    '</div>',
    `<p style="max-width:560px;margin:16px auto 0;text-align:center;${MUTED}">${escapeHtml(FOOTER)}</p>`,
    '</body></html>',
  ].join('');

  return { subject, text, html };
}
