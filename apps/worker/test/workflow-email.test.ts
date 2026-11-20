import type { Workflow } from '@compass/contracts';
import { describe, expect, it, vi } from 'vitest';
import { composeWorkflowEmail, FOOTER, type WorkflowEmailInput } from '../src/application/workflows/email.ts';
import { CloudflareEmailSender } from '../src/infrastructure/cloudflare-email-sender.ts';
import { DurableEmailQuota, type EmailQuotaStorage } from '../src/infrastructure/do-email-quota.ts';

const workflow: Workflow = {
  id: 'wf-lisbon', name: 'Lisbon pace watch', description: '', hotels: ['LIS1'], trigger: { kind: 'manual' },
  goal: 'Tell me when Lisbon pace falls behind last year.', checks: ['get_pace'], action: { type: 'email', guidance: '' },
  delivery: { channel: 'email', to: 'silviu@example.com' }, approver: 'revenue_manager', autonomy: 'approve', enabled: true,
  createdAt: '2026-11-20T08:00:00.000Z', createdBy: 'user', lastRun: null,
};

const input: WorkflowEmailInput = {
  workflow,
  test: false,
  wouldFire: true,
  summary: 'Lisbon is 12% behind last year for December.',
  facts: ['Rooms on the books: 1,240 vs 1,410 last year', 'ADR: 182 EUR vs 176 EUR'],
  definition: 'Pace: rooms on the books for the stay month, against the same day last year.',
  period: 'December 2026',
  question: 'Why is Lisbon pace behind?',
  appUrl: 'https://juyo.razvanfrandes.com',
};

describe('composeWorkflowEmail', () => {
  it('the last mail says the workflow is now paused', () => {
    const LAST = 'This was the last email from this workflow: it has reached its limit of 7 days or 5 emails and is now paused.';
    const last = composeWorkflowEmail({ ...input, final: true });
    expect(last.text).toContain(LAST);
    expect(last.html).toContain(LAST);
    const usual = composeWorkflowEmail(input);
    expect(usual.text).not.toContain('last email');
    expect(usual.html).not.toContain('last email');
    expect(composeWorkflowEmail({ ...input, final: false }).text).toBe(usual.text);
  });

  it('subject says Test on a test run', () => {
    expect(composeWorkflowEmail({ ...input, test: true }).subject).toBe('Test · Lisbon pace watch');
    expect(composeWorkflowEmail({ ...input, test: false }).subject).toBe('Lisbon pace watch');
  });

  it('keeps line breaks out of the subject', () => {
    const subject = composeWorkflowEmail({ ...input, workflow: { ...workflow, name: 'Pace\r\nBcc: x@example.com' } }).subject;
    expect(subject).toBe('Pace Bcc: x@example.com');
  });

  it('a test that would not fire says so', () => {
    const e = composeWorkflowEmail({ ...input, test: true, wouldFire: false });
    expect(e.text).toContain('Would not fire today');
    expect(e.html).toContain('Would not fire today');
  });

  it('a test that would fire says so, and a real run has no test note', () => {
    expect(composeWorkflowEmail({ ...input, test: true, wouldFire: true }).text).toContain('Would fire today');
    const real = composeWorkflowEmail(input);
    expect(real.text).not.toContain('fire today');
    expect(real.html).not.toContain('fire today');
  });

  it('carries the summary, facts, definition and period in text and html', () => {
    const e = composeWorkflowEmail(input);
    for (const body of [e.text, e.html]) {
      expect(body).toContain('Lisbon pace watch');
      expect(body).toContain(input.summary);
      expect(body).toContain('Rooms on the books: 1,240 vs 1,410 last year');
      expect(body).toContain('ADR: 182 EUR vs 176 EUR');
      expect(body).toContain(input.definition);
      expect(body).toContain('December 2026');
    }
    expect(e.html).toContain('<li');
  });

  it('leaves out the facts list when there are no facts', () => {
    expect(composeWorkflowEmail({ ...input, facts: [] }).html).not.toContain('<ul');
  });

  it('escapes HTML from the model and the user', () => {
    const html = composeWorkflowEmail({ ...input, summary: '<script>x</script> & "q"', workflow: { ...input.workflow, name: '<b>n</b>' } }).html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;n&lt;/b&gt;');
  });

  it('escapes facts, definition and period too', () => {
    const html = composeWorkflowEmail({ ...input, facts: ['<img src=x>'], definition: '<i>d</i>', period: '<u>p</u>' }).html;
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<i>');
    expect(html).not.toContain('<u>');
  });

  it('links to Kassandra with the question encoded', () => {
    expect(composeWorkflowEmail(input).text).toContain('https://juyo.razvanfrandes.com/ask?q=Why%20is%20Lisbon%20pace%20behind%3F');
    expect(composeWorkflowEmail(input).html).toContain('href="https://juyo.razvanfrandes.com/ask?q=Why%20is%20Lisbon%20pace%20behind%3F"');
  });

  it('a question cannot break out of the link', () => {
    const e = composeWorkflowEmail({ ...input, question: '"><script>&x=1', appUrl: 'https://juyo.razvanfrandes.com/' });
    expect(e.html).toContain('href="https://juyo.razvanfrandes.com/ask?q=%22%3E%3Cscript%3E%26x%3D1"');
  });

  it('carries the footer, in text and html', () => {
    const e = composeWorkflowEmail(input);
    expect(FOOTER).toBe('Compass demo · fictional data · you got this because someone entered your address in a Compass workflow.');
    expect(e.text).toContain(FOOTER);
    expect(e.html).toContain(FOOTER);
  });

  it('uses no external assets', () => {
    const html = composeWorkflowEmail(input).html;
    expect(html).not.toMatch(/<(img|link|script|style)\b/);
    expect(html.match(/https?:\/\/[^"<\s]+/g)?.every((url) => url.startsWith('https://juyo.razvanfrandes.com/ask?q='))).toBe(true);
  });
});

/** The two calls DurableEmailQuota makes on a Durable Object's storage, over a Map. */
class FakeStorage implements EmailQuotaStorage {
  readonly data = new Map<string, unknown>();
  async get<T>(keys: string[]) {
    return new Map(keys.filter((k) => this.data.has(k)).map((k) => [k, structuredClone(this.data.get(k)) as T]));
  }
  async put<T>(entries: Record<string, T>) {
    for (const [k, v] of Object.entries(entries)) this.data.set(k, structuredClone(v));
  }
}

function quotaAt(start: string) {
  let now = new Date(start).getTime();
  const storage = new FakeStorage();
  return {
    storage,
    quota: new DurableEmailQuota(storage, () => new Date(now)),
    advance: (ms: number) => { now += ms; },
  };
}
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('DurableEmailQuota', () => {
  it('quota refuses the 4th mail to one address within an hour, and allows it an hour later', async () => {
    const { quota, advance } = quotaAt('2026-11-20T10:00:00Z');
    for (let i = 0; i < 3; i++) {
      expect(await quota.take('a@example.com', `ip-${i}`)).toEqual({ ok: true });
      advance(MINUTE);
    }
    const refused = await quota.take('a@example.com', 'ip-9');
    expect(refused.ok).toBe(false);
    expect(refused.ok ? '' : refused.reason).toMatch(/address/i);
    advance(HOUR - 3 * MINUTE - 1); // 1 ms before the first mail is an hour old
    expect((await quota.take('a@example.com', 'ip-9')).ok).toBe(false);
    advance(1);
    expect(await quota.take('a@example.com', 'ip-9')).toEqual({ ok: true });
    // The window rolls: the 2nd and 3rd mail are still inside the hour.
    expect((await quota.take('a@example.com', 'ip-9')).ok).toBe(false);
  });

  it('counts an address in any letter case and with spaces around it as the same address', async () => {
    const { quota } = quotaAt('2026-11-20T10:00:00Z');
    expect((await quota.take('A@Example.com', 'ip-1')).ok).toBe(true);
    expect((await quota.take(' a@example.COM ', 'ip-2')).ok).toBe(true);
    expect((await quota.take('a@example.com', 'ip-3')).ok).toBe(true);
    expect((await quota.take('a@EXAMPLE.com', 'ip-4')).ok).toBe(false);
  });

  it('quota refuses the 11th mail from one client within an hour, and allows it an hour later', async () => {
    const { quota, advance } = quotaAt('2026-11-20T10:00:00Z');
    for (let i = 0; i < 10; i++) expect((await quota.take(`r${i}@example.com`, '2001:DB8::1')).ok).toBe(true);
    const refused = await quota.take('new@example.com', '2001:db8::1');
    expect(refused.ok).toBe(false);
    expect(await quota.take('new@example.com', 'other-ip')).toEqual({ ok: true });
    advance(HOUR);
    expect(await quota.take('new@example.com', '2001:db8::1')).toEqual({ ok: true });
  });

  it('quota refuses the 51st mail of the day across recipients', async () => {
    const { quota, advance } = quotaAt('2026-11-20T00:00:00Z');
    for (let i = 0; i < 50; i++) {
      expect(await quota.take(`r${i}@example.com`, `ip-${i}`)).toEqual({ ok: true });
      advance(10 * MINUTE);
    }
    const refused = await quota.take('late@example.com', 'ip-late'); // 08:20 UTC
    expect(refused.ok).toBe(false);
    expect(refused.ok ? '' : refused.reason).toMatch(/today|day/i);
    advance(15 * HOUR + 39 * MINUTE); // 23:59 UTC, same day
    expect((await quota.take('late@example.com', 'ip-late')).ok).toBe(false);
    advance(MINUTE); // 00:00 UTC, the next day
    expect(await quota.take('late@example.com', 'ip-late')).toEqual({ ok: true });
  });

  it('takes from all three windows or none', async () => {
    const { quota, storage } = quotaAt('2026-11-20T10:00:00Z');
    for (let i = 0; i < 3; i++) await quota.take('a@example.com', 'ip-1');
    const before = structuredClone([...storage.data.entries()]);
    // Refused for the address: the client's window and the day's count must not move.
    expect((await quota.take('a@example.com', 'ip-1')).ok).toBe(false);
    expect([...storage.data.entries()]).toEqual(before);
    // So the client still has 7 left, not 6.
    for (let i = 0; i < 7; i++) expect((await quota.take(`b${i}@example.com`, 'ip-1')).ok).toBe(true);
    expect((await quota.take('c@example.com', 'ip-1')).ok).toBe(false);
  });

  it('a refused client does not use up the address', async () => {
    const { quota } = quotaAt('2026-11-20T10:00:00Z');
    for (let i = 0; i < 10; i++) await quota.take(`r${i}@example.com`, 'ip-1');
    for (let i = 0; i < 5; i++) expect((await quota.take('a@example.com', 'ip-1')).ok).toBe(false);
    for (let i = 0; i < 3; i++) expect((await quota.take('a@example.com', `ip-ok-${i}`)).ok).toBe(true);
  });
});

describe('CloudflareEmailSender', () => {
  const email = { to: 'silviu@example.com', subject: 'Lisbon pace watch', text: 'text body', html: '<p>html body</p>' };

  it('sends from Compass <alerts@compass.razvanfrandes.com> and returns the message id', async () => {
    const send = vi.fn(async (_message: unknown) => ({ messageId: 'msg-1' }));
    const result = await new CloudflareEmailSender({ send } as unknown as SendEmail).send(email);
    expect(result).toEqual({ messageId: 'msg-1' });
    expect(send).toHaveBeenCalledExactlyOnceWith({
      from: { email: 'alerts@compass.razvanfrandes.com', name: 'Compass' },
      to: 'silviu@example.com',
      subject: 'Lisbon pace watch',
      text: 'text body',
      html: '<p>html body</p>',
    });
  });

  it('a failed send is an error value without internals, and is logged', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cause = Object.assign(new Error('destination address not verified: silviu@example.com'), { code: 'E_DELIVERY_FAILED' });
    const binding = { send: async () => { throw cause; } } as unknown as SendEmail;
    const result = await new CloudflareEmailSender(binding).send(email);
    expect(result).toEqual({ error: 'The email could not be sent.' });
    expect(log).toHaveBeenCalledWith('email send failed', 'E_DELIVERY_FAILED', cause);
    log.mockRestore();
  });
});

// Compile-time: a Durable Object's real storage is what DurableEmailQuota takes.
export const quotaOnDurableObject = (storage: DurableObjectStorage) => new DurableEmailQuota(storage);
