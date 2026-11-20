import type { Workflow, WorkflowRun } from '@compass/contracts';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { MemoryStorage } from '@earendil-works/pi-durable/storage/memory';
import { describe, expect, it } from 'vitest';
import { createEmailExtension } from '../src/application/workflows/email-tool.ts';
import { emailWorkflowBlocked, publicRun, publicWorkflow, recipientChanged, type EmailQuota, type EmailSender, type OutgoingEmail } from '../src/application/workflows/email.ts';
import { MemoryWorkflowStore } from '../src/application/workflows/memory-store.ts';
import { workflowInstructions } from '../src/application/workflows/templates.ts';

// send_email on a real pi-durable Harness with a scripted model and a sender that only records. No Cloudflare, no mail.
const context = BACKGROUND_CONTEXT;

const MAIL = {
  would_fire: true,
  summary: 'Lisbon is 12% behind last year on the books for December.',
  facts: ['Rooms on the books: 1,240 vs 1,410 last year', 'ADR: 182 EUR vs 176 EUR'],
  definition: 'Pace: rooms on the books for the stay month, against the same day last year.',
  period: 'December 2026',
  question: 'Why is Lisbon pace behind last year?',
};

const WORKFLOW: Workflow = {
  id: 'wf-lisbon', name: 'Lisbon pace watch', description: '', hotels: ['LIS1'], trigger: { kind: 'schedule', every: 'day' },
  goal: 'Email me when Lisbon pace falls more than 10% behind last year.', checks: ['get_pace'], action: { type: 'email', guidance: '' },
  delivery: { channel: 'email', to: ' Silviu@Example.com ' }, approver: 'revenue_manager', autonomy: 'approve', enabled: true,
  createdAt: '2026-11-20T05:00:00.000Z', createdBy: 'user', lastRun: null,
};

class FakeSender implements EmailSender {
  readonly sent: OutgoingEmail[] = [];
  async send(email: OutgoingEmail) {
    this.sent.push(email);
    return { messageId: `msg-${this.sent.length}` };
  }
}

async function setup(options: { test?: boolean; quota?: EmailQuota; sender?: EmailSender } = {}) {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  const store = new MemoryWorkflowStore();
  const sender = new FakeSender();
  const taken: { recipient: string; client: string }[] = [];
  const quota: EmailQuota = options.quota ?? {
    take: async (recipient, client) => {
      taken.push({ recipient, client });
      return { ok: true };
    },
  };
  const registry = createRegistry();
  registry.install(
    createEmailExtension({ store, sender: options.sender ?? sender, quota, appUrl: 'https://juyo.razvanfrandes.com', now: () => new Date('2026-11-20T06:00:00.000Z') }),
  );
  const harness = await Harness.open(new MemoryStorage(), { models, registry }, context);
  const model = faux.getModel();
  const root = await harness.root(context, { agent: { model: { provider: model.provider, modelId: model.id } } });

  const run: WorkflowRun = {
    id: 'run-1', workflowId: WORKFLOW.id, sessionId: String(root.id), trigger: 'schedule', status: 'running',
    startedAt: '2026-11-20T06:00:00.000Z', endedAt: null, summary: null, client: 'cron', ...(options.test ? { test: true } : {}),
  };
  store.workflows.set(WORKFLOW.id, WORKFLOW);
  store.runs.set(run.id, run);
  return { faux, harness, root, store, sender, taken };
}

const toolTexts = (ctx: { messages: { role: string; content?: unknown }[] }) =>
  ctx.messages.filter((m) => m.role === 'toolResult').map((m) => JSON.stringify(m.content));

/** What each send_email result tells the UI: whether a mail went out. */
const toolSent = (ctx: { messages: { role: string; details?: unknown }[] }) =>
  ctx.messages.filter((m) => m.role === 'toolResult').map((m) => (m.details as { sent?: boolean } | undefined)?.sent);

const callSendEmail = (args: typeof MAIL = MAIL) => fauxAssistantMessage(fauxToolCall('send_email', args), { stopReason: 'toolUse' });

describe('send_email', () => {
  it('sends once when the condition holds', async () => {
    const { faux, harness, root, store, sender, taken } = await setup();
    let seen: string[] = [];
    let sentFlags: (boolean | undefined)[] = [];
    faux.setResponses([
      callSendEmail(),
      (ctx) => {
        seen = toolTexts(ctx);
        sentFlags = toolSent(ctx);
        return fauxAssistantMessage(fauxText('Emailed.'));
      },
    ]);
    const settled = await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);

    expect(settled.status).toBe('done');
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({ to: 'silviu@example.com', subject: 'Lisbon pace watch' });
    expect(sender.sent[0]!.text).toContain('Lisbon is 12% behind last year');
    expect(sender.sent[0]!.text).toContain('https://juyo.razvanfrandes.com/ask?q=');
    // The same normalised address goes to the quota and to the sender.
    expect(taken).toEqual([{ recipient: 'silviu@example.com', client: 'cron' }]);
    expect(store.audit).toHaveLength(1);
    expect(store.audit[0]).toMatchObject({ outcome: 'emailed', workflowId: 'wf-lisbon', action: 'email', receipt: 'Email msg-1 to si****@example.com' });
    expect(JSON.stringify(store.audit)).not.toContain('silviu@');
    expect(seen.join()).toContain('Email msg-1 to si****@example.com');
    expect(seen.join()).not.toContain('silviu@');
    expect(sentFlags).toEqual([true]);
    expect(store.workflows.get('wf-lisbon')!.emailsSent).toBe(1);
    await harness.close(context);
  });

  it('does not send twice when the call is replayed', async () => {
    const { faux, harness, root, store, sender } = await setup();
    let seen: string[] = [];
    faux.setResponses([
      callSendEmail(),
      callSendEmail(),
      (ctx) => {
        seen = toolTexts(ctx);
        return fauxAssistantMessage(fauxText('Emailed.'));
      },
    ]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);

    expect(sender.sent).toHaveLength(1);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toContain('Email msg-1 to si****@example.com');
    expect(seen[1]).toContain('Email msg-1 to si****@example.com');
    expect(store.audit).toHaveLength(1);
    expect(store.workflows.get('wf-lisbon')!.emailsSent).toBe(1);
    await harness.close(context);
  });

  it('does not send twice when the model calls it twice in one turn', async () => {
    const { faux, harness, root, store, sender } = await setup();
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall('send_email', MAIL), fauxToolCall('send_email', MAIL)], { stopReason: 'toolUse' }),
      fauxAssistantMessage(fauxText('Emailed.')),
    ]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);

    expect(sender.sent).toHaveLength(1);
    expect(store.audit).toHaveLength(1);
    await harness.close(context);
  });

  it('a scheduled run that finds nothing sends nothing', async () => {
    const { faux, harness, root, store, sender, taken } = await setup();
    let seen: string[] = [];
    faux.setResponses([
      callSendEmail({ ...MAIL, would_fire: false }),
      (ctx) => {
        seen = toolTexts(ctx);
        return fauxAssistantMessage(fauxText('Nothing to report.'));
      },
    ]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);

    expect(sender.sent).toHaveLength(0);
    expect(taken).toHaveLength(0);
    expect(store.audit).toHaveLength(0);
    expect(seen.join()).toContain('Nothing to report; no email sent.');
    await harness.close(context);
  });

  it('a test run sends even when it would not fire', async () => {
    const { faux, harness, root, store, sender } = await setup({ test: true });
    faux.setResponses([callSendEmail({ ...MAIL, would_fire: false }), fauxAssistantMessage(fauxText('Test sent.'))]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.subject).toBe('Test · Lisbon pace watch');
    expect(sender.sent[0]!.text).toContain('Would not fire today');
    expect(store.audit[0]).toMatchObject({ outcome: 'emailed' });
    // A test does not use up the workflow's five emails.
    expect(store.workflows.get('wf-lisbon')!.emailsSent ?? 0).toBe(0);
    await harness.close(context);
  });

  it('quota refusal sends nothing and says why', async () => {
    const reason = 'This address already got 3 emails in the last hour. Try again later.';
    const { faux, harness, root, store, sender } = await setup({ quota: { take: async () => ({ ok: false, reason }) } });
    let seen: string[] = [];
    let sentFlags: (boolean | undefined)[] = [];
    faux.setResponses([
      callSendEmail(),
      (ctx) => {
        seen = toolTexts(ctx);
        sentFlags = toolSent(ctx);
        return fauxAssistantMessage(fauxText('Not sent.'));
      },
    ]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);

    expect(sender.sent).toHaveLength(0);
    expect(store.audit).toHaveLength(0);
    expect(await store.emailForRun('run-1')).toBeNull();
    expect(seen.join()).toContain(reason);
    expect(sentFlags).toEqual([false]);
    await harness.close(context);
  });

  it('a failed send is not recorded as sent', async () => {
    const { faux, harness, root, store } = await setup({ sender: { send: async () => ({ error: 'The email could not be sent.' }) } });
    let seen: string[] = [];
    faux.setResponses([
      callSendEmail(),
      (ctx) => {
        seen = toolTexts(ctx);
        return fauxAssistantMessage(fauxText('Not sent.'));
      },
    ]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);

    expect(seen.join()).toContain('The email could not be sent.');
    expect(store.audit).toHaveLength(0);
    expect(await store.emailForRun('run-1')).toBeNull();
    expect(store.workflows.get('wf-lisbon')!.emailsSent ?? 0).toBe(0);
    await harness.close(context);
  });
});

describe('send_email, at most once', () => {
  it('a call that finds a pending marker sends nothing', async () => {
    const { faux, harness, root, store, sender, taken } = await setup();
    await store.markEmailPending('run-1');
    let seen: string[] = [];
    faux.setResponses([
      callSendEmail(),
      (ctx) => {
        seen = toolTexts(ctx);
        return fauxAssistantMessage(fauxText('Not sent again.'));
      },
    ]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);

    expect(sender.sent).toHaveLength(0);
    expect(taken).toHaveLength(0);
    expect(store.audit).toHaveLength(0);
    expect(seen.join()).toContain('An earlier attempt to send this email did not confirm; not sending again.');
    await harness.close(context);
  });

  it('marks the run pending before the send, and only a confirmed send writes the receipt', async () => {
    const { faux, harness, root, store } = await setup({
      sender: {
        send: async () => {
          // At the moment of the send the marker is already there and no receipt is.
          expect(await store.emailPending('run-1')).toBe(true);
          expect(await store.emailForRun('run-1')).toBeNull();
          return { error: 'The email could not be sent.' };
        },
      },
    });
    let seen: string[] = [];
    faux.setResponses([
      callSendEmail(),
      callSendEmail(),
      (ctx) => {
        seen = toolTexts(ctx);
        return fauxAssistantMessage(fauxText('Not sent.'));
      },
    ]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);

    expect(seen[0]).toContain('The email could not be sent.');
    expect(seen[1]).toContain('did not confirm; not sending again.');
    expect(await store.emailForRun('run-1')).toBeNull();
    await harness.close(context);
  });
});

describe('send_email, the last mail', () => {
  const LAST = 'This was the last email from this workflow';

  it('the fifth email says it is the last', async () => {
    const { faux, harness, root, store, sender } = await setup();
    store.workflows.set(WORKFLOW.id, { ...WORKFLOW, emailsSent: 4 });
    faux.setResponses([callSendEmail(), fauxAssistantMessage(fauxText('Emailed.'))]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.text).toContain(LAST);
    expect(sender.sent[0]!.html).toContain(LAST);
    expect(store.workflows.get(WORKFLOW.id)!.emailsSent).toBe(5);
    await harness.close(context);
  });

  it('an email sent after the 7 days says it is the last', async () => {
    const { faux, harness, root, store, sender } = await setup();
    store.workflows.set(WORKFLOW.id, { ...WORKFLOW, createdAt: '2026-11-13T05:00:00.000Z' });
    faux.setResponses([callSendEmail(), fauxAssistantMessage(fauxText('Emailed.'))]);
    await (await root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);
    expect(sender.sent[0]!.text).toContain(LAST);
    await harness.close(context);
  });

  it('an earlier email does not, and neither does a test', async () => {
    const first = await setup();
    first.store.workflows.set(WORKFLOW.id, { ...WORKFLOW, emailsSent: 3 });
    first.faux.setResponses([callSendEmail(), fauxAssistantMessage(fauxText('Emailed.'))]);
    await (await first.root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);
    expect(first.sender.sent[0]!.text).not.toContain(LAST);
    await first.harness.close(context);

    const test = await setup({ test: true });
    test.store.workflows.set(WORKFLOW.id, { ...WORKFLOW, emailsSent: 4 });
    test.faux.setResponses([callSendEmail(), fauxAssistantMessage(fauxText('Test sent.'))]);
    await (await test.root.submit({ type: 'input', content: 'Run the workflow now.' }, context)).wait(context);
    expect(test.sender.sent).toHaveLength(1);
    expect(test.sender.sent[0]!.text).not.toContain(LAST);
    await test.harness.close(context);
  });
});

describe('emailWorkflowBlocked', () => {
  const at = (iso: string) => new Date(iso);

  it('blocks an email workflow after 7 days', () => {
    expect(emailWorkflowBlocked(WORKFLOW, at('2026-11-27T05:00:00.001Z'))).toMatch(/7 days/);
  });

  it('blocks an email workflow at 5 sent emails', () => {
    expect(emailWorkflowBlocked({ ...WORKFLOW, emailsSent: 5 }, at('2026-11-21T05:00:00.000Z'))).toMatch(/5 emails/);
  });

  it('does not block otherwise', () => {
    expect(emailWorkflowBlocked(WORKFLOW, at('2026-11-27T05:00:00.000Z'))).toBeNull();
    expect(emailWorkflowBlocked({ ...WORKFLOW, emailsSent: 4 }, at('2026-11-21T05:00:00.000Z'))).toBeNull();
    const { delivery: _none, ...rest } = WORKFLOW;
    const other: Workflow = { ...rest, action: { type: 'notify', guidance: '' }, emailsSent: 9 };
    expect(emailWorkflowBlocked(other, at('2027-11-20T05:00:00.000Z'))).toBeNull();
  });
});

describe('workflowInstructions for an email workflow', () => {
  it('tells the agent to send an email, not to propose', () => {
    const text = workflowInstructions(WORKFLOW);
    expect(text).toContain('send_email');
    expect(text).not.toContain('propose_action');
    expect(text).not.toContain('apply_action');
    expect(text).toContain('never compute numbers yourself');
    expect(text).not.toContain('Silviu');
  });

  it('on a test run, always call send_email exactly once with would_fire', () => {
    const text = workflowInstructions(WORKFLOW, true);
    expect(text).toMatch(/test run/i);
    expect(text).toMatch(/always call send_email exactly once/);
    expect(text).toContain('would_fire');
  });

  it('keeps the propose/apply steps for other workflows', () => {
    const { delivery: _none, ...rest } = WORKFLOW;
    const text = workflowInstructions({ ...rest, action: { type: 'adjust_bar', guidance: '' } });
    expect(text).toContain('propose_action');
    expect(text).not.toContain('send_email');
  });
});

describe('what the open API shows and accepts', () => {
  const saved: Workflow = { ...WORKFLOW, delivery: { channel: 'email', to: 'silviu@example.com' } };

  it('masks the recipient in a copy and leaves the stored workflow alone', () => {
    const shown = publicWorkflow(saved);
    expect(shown.delivery).toEqual({ channel: 'email', to: 'si****@example.com' });
    expect(saved.delivery!.to).toBe('silviu@example.com');
    const { delivery: _none, ...rest } = saved;
    const other: Workflow = { ...rest, action: { type: 'notify', guidance: '' } };
    expect(publicWorkflow(other)).toEqual(other);
  });

  it('leaves the client address out of a run', () => {
    const run: WorkflowRun = {
      id: 'run-1', workflowId: 'wf-lisbon', sessionId: 's', trigger: 'manual', status: 'done', startedAt: '2026-11-20T06:00:00.000Z',
      endedAt: null, summary: null, test: true, client: '203.0.113.7',
    };
    expect(publicRun(run)).toEqual({ ...run, client: undefined });
    expect(JSON.stringify(publicRun(run))).not.toContain('203.0.113.7');
  });

  it('a patch may repeat the recipient, as saved or as shown, but not change it', () => {
    expect(recipientChanged(saved, { channel: 'email', to: 'silviu@example.com' })).toBe(false);
    expect(recipientChanged(saved, { channel: 'email', to: ' Silviu@Example.com ' })).toBe(false);
    expect(recipientChanged(saved, { channel: 'email', to: 'si****@example.com' })).toBe(false);
    expect(recipientChanged(saved, { channel: 'email', to: 'other@example.com' })).toBe(true);
    expect(recipientChanged(saved, null)).toBe(true);
    expect(recipientChanged(saved, { channel: 'email' })).toBe(true);
    // A workflow saved without a recipient cannot get one by PATCH either.
    const { delivery: _none, ...rest } = saved;
    const other: Workflow = { ...rest, action: { type: 'notify', guidance: '' } };
    expect(recipientChanged(other, { channel: 'email', to: 'other@example.com' })).toBe(true);
  });
});
