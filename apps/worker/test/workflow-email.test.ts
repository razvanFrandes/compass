import type { Workflow } from '@compass/contracts';
import { describe, expect, it, vi } from 'vitest';
import { composeWorkflowEmail, FOOTER, neutraliseLinks, type WorkflowEmailInput } from '../src/application/workflows/email.ts';
import { CloudflareEmailSender } from '../src/infrastructure/cloudflare-email-sender.ts';
import { DurableEmailQuota, EMAIL_LIMITS, type EmailQuotaStorage } from '../src/infrastructure/do-email-quota.ts';

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

  it('the subject has a fixed form, and says Test on a test run', () => {
    expect(composeWorkflowEmail({ ...input, test: true }).subject).toBe('Test · Compass alert · Lisbon pace watch');
    expect(composeWorkflowEmail({ ...input, test: false }).subject).toBe('Compass alert · Lisbon pace watch');
  });

  it('keeps line breaks out of the subject', () => {
    const subject = composeWorkflowEmail({ ...input, workflow: { ...workflow, name: 'Pace\r\nBcc: someone' } }).subject;
    expect(subject).toBe('Compass alert · Pace Bcc: someone');
  });

  it('cuts the name to 60 characters, in the subject and in the bodies', () => {
    const name = `${'Lisbon pace watch '.repeat(4)}END`; // 75 characters
    const e = composeWorkflowEmail({ ...input, workflow: { ...workflow, name } });
    expect(e.subject).toBe(`Compass alert · ${name.slice(0, 60).trim()}`);
    expect(e.subject).not.toContain('END');
    expect(e.text).not.toContain('END');
    expect(e.html).not.toContain('END');
  });

  it('cuts the summary to 500 characters', () => {
    const e = composeWorkflowEmail({ ...input, summary: `${'Pace is behind. '.repeat(40)}END` });
    expect(e.text).toContain('Pace is behind.');
    expect(e.text).not.toContain('END');
    expect(e.html).not.toContain('END');
  });

  it('removes links and domains from every field the model or the person wrote', () => {
    const e = composeWorkflowEmail({
      ...input,
      workflow: { ...workflow, name: 'Claim prize at evil.example' },
      summary: 'Lisbon is 12% behind. Log in at https://phish.example/login?u=1 or www.phish.example now.',
      facts: ['Rooms: 1,240 vs 1,410. Details: bad-site.io/offer', 'ADR: 182.50 EUR vs 176 EUR, see HTTP://Shout.Example'],
      definition: 'Pace, as defined on defs.example.org.',
      period: 'December 2026 (cal.example)',
      question: 'Why is pace behind? Ask at ask.example',
    });
    for (const body of [e.subject, e.text, e.html]) {
      expect(body).not.toMatch(/evil\.example|phish\.example|bad-site\.io|shout\.example|defs\.example\.org|cal\.example|ask\.example/i);
    }
    for (const body of [e.text, e.html]) {
      expect(body).toContain('[link removed]');
      // The numbers stay as they are.
      expect(body).toContain('Rooms: 1,240 vs 1,410.');
      expect(body).toContain('ADR: 182.50 EUR vs 176 EUR');
      expect(body).toContain('Lisbon is 12% behind.');
    }
    expect(e.subject).toBe('Compass alert · Claim prize at [link removed]');
    expect(decodeURIComponent(e.text.match(/ask\?q=(\S+)/)![1]!)).toBe('Why is pace behind? Ask at [link removed]');
    // The app's own link is still there.
    expect(e.text).toContain('https://juyo.razvanfrandes.com/ask?q=');
    expect(e.html).toContain('href="https://juyo.razvanfrandes.com/ask?q=');
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

describe('neutraliseLinks', () => {
  const APP = 'https://juyo.razvanfrandes.com';
  const clean = (text: string) => neutraliseLinks(text, APP);

  it.each([
    ['see https://evil.example/a?b=c now', 'see [link removed] now'],
    ['see http://evil.example', 'see [link removed]'],
    ['go to www.evil.example/x', 'go to [link removed]'],
    ['evil.example is down', '[link removed] is down'],
    ['mail bob@evil.example', 'mail bob@[link removed]'],
    ['a.b.evil.co.uk/path', '[link removed]'],
    ['пример.рф', '[link removed]'],
    ['HTTPS://EVIL.EXAMPLE', '[link removed]'],
  ])('%s → %s', (text, expected) => {
    expect(clean(text)).toBe(expected);
  });

  it('keeps the app\'s own host, and nothing that only looks like it', () => {
    expect(clean('open https://juyo.razvanfrandes.com/ask?q=pace')).toBe('open https://juyo.razvanfrandes.com/ask?q=pace');
    expect(clean('open juyo.razvanfrandes.com')).toBe('open juyo.razvanfrandes.com');
    expect(clean('https://juyo.razvanfrandes.com.evil.example/x')).toBe('[link removed]');
    expect(clean('https://juyo.razvanfrandes.com@evil.example/x')).toBe('[link removed]');
    expect(clean('https://juyo.razvanfrandes.com/go?to=https://evil.example')).toBe('[link removed]');
    expect(clean('razvanfrandes.com')).toBe('[link removed]');
  });

  it('keeps the channel and review-source names that are written like a domain', () => {
    for (const text of ['Booking.com share is 32%', 'booking.com and BOOKING.COM', 'Hotels.com, Expedia.com.', 'Source: Booking.com']) {
      expect(clean(text)).toBe(text);
    }
  });

  it('a brand name is kept only as a bare name: with a scheme, a path, a port or more labels it is a link', () => {
    expect(clean('visit evil.com/login')).toBe('visit [link removed]');
    expect(clean('https://x.io')).toBe('[link removed]');
    expect(clean('https://booking.com')).toBe('[link removed]');
    expect(clean('www.booking.com')).toBe('[link removed]');
    expect(clean('Booking.com/login')).toBe('[link removed]');
    expect(clean('booking.com:8080')).toBe('[link removed]');
    expect(clean('booking.com?next=evil')).toBe('[link removed]');
    expect(clean('secure.booking.com')).toBe('[link removed]');
    expect(clean('booking.com.evil.io')).toBe('[link removed]');
    expect(clean('evil-booking.com')).toBe('[link removed]');
    expect(clean('pay@booking.com')).toBe('pay@[link removed]');
    expect(clean('x_booking.com')).toBe('x_[link removed]');
    expect(clean('booking.com@evil.io')).toBe('[link removed]@[link removed]');
    expect(clean('(Booking.com) "Booking.com": 32%')).toBe('(Booking.com) "Booking.com": 32%');
  });

  it('leaves numbers, percentages, abbreviations and hotel codes alone', () => {
    for (const text of ['Rooms: 1,240 vs 1,410 (12.5% down)', 'ADR 182.50 EUR', 'e.g. LIS1, i.e. Lisbon', 'RevPAR 96.4 at 9 a.m.', 'Pace is behind. Pickup is flat.']) {
      expect(clean(text)).toBe(text);
    }
  });
});

/** The calls DurableEmailQuota makes on a Durable Object's storage, over a Map. */
class FakeStorage implements EmailQuotaStorage {
  readonly data = new Map<string, unknown>();
  async list<T>({ prefix }: { prefix: string }) {
    return new Map([...this.data].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v) as T]));
  }
  async put<T>(entries: Record<string, T>) {
    for (const [k, v] of Object.entries(entries)) this.data.set(k, structuredClone(v));
  }
  async delete(keys: string[]) {
    return keys.filter((k) => this.data.delete(k)).length;
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

  it('refuses the 7th mail of the UTC day to one address, and allows it the next day', async () => {
    expect(EMAIL_LIMITS.perRecipientPerDay).toBe(6);
    const { quota, advance } = quotaAt('2026-11-20T00:00:00Z');
    // One every 30 minutes, so the hourly limit of 3 never applies.
    for (let i = 0; i < 6; i++) {
      expect(await quota.take('a@example.com', `ip-${i}`)).toEqual({ ok: true });
      advance(30 * MINUTE);
    }
    const refused = await quota.take('a@example.com', 'ip-9'); // 03:00 UTC
    expect(refused.ok).toBe(false);
    expect(refused.ok ? '' : refused.reason).toBe('This address already got 6 emails today. Try again tomorrow.');
    expect(await quota.take('b@example.com', 'ip-9')).toEqual({ ok: true });
    advance(20 * HOUR + 59 * MINUTE); // 23:59 UTC, same day
    expect((await quota.take('a@example.com', 'ip-9')).ok).toBe(false);
    advance(MINUTE); // 00:00 UTC, the next day
    expect(await quota.take('a@example.com', 'ip-9')).toEqual({ ok: true });
  });

  it('a refusal for the day changes nothing', async () => {
    const { quota, storage, advance } = quotaAt('2026-11-20T00:00:00Z');
    for (let i = 0; i < 6; i++) {
      await quota.take('a@example.com', 'ip-1');
      advance(30 * MINUTE);
    }
    const before = structuredClone([...storage.data.entries()]);
    expect((await quota.take('a@example.com', 'ip-1')).ok).toBe(false);
    expect([...storage.data.entries()]).toEqual(before);
  });

  it('a scheduled run has no client: only the address and the day are counted', async () => {
    const { quota, storage } = quotaAt('2026-11-20T05:00:00Z');
    for (let i = 0; i < 12; i++) expect(await quota.take(`r${i}@example.com`, null)).toEqual({ ok: true });
    expect([...storage.data.keys()].filter((k) => k.startsWith('emailq:client:'))).toEqual([]);
    for (let i = 0; i < 2; i++) await quota.take('a@example.com', null);
    expect((await quota.take('a@example.com', null)).ok).toBe(true);
    expect((await quota.take('a@example.com', null)).ok).toBe(false); // 3 per hour per address still holds
    for (let i = 15; i < 50; i++) await quota.take(`s${i}@example.com`, null);
    expect((await quota.take('late@example.com', null)).ok).toBe(false); // and so do the 50 per day
  });

  it('stores no address: the key of an address is its SHA-256 hash', async () => {
    const { quota, storage } = quotaAt('2026-11-20T10:00:00Z');
    await quota.take(' Silviu@Example.com ', 'ip-1');
    const keys = [...storage.data.keys()];
    expect(JSON.stringify([...storage.data.entries()]).toLowerCase()).not.toContain('silviu');
    // sha256('silviu@example.com')
    const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('silviu@example.com'))).toString('hex');
    expect(keys).toContain(`emailq:to:${hash}`);
  });

  it('a write drops the keys that hold nothing any more', async () => {
    const { quota, storage, advance } = quotaAt('2026-11-20T10:00:00Z');
    storage.data.set('emailq:to:old@example.com', [Date.parse('2026-11-20T09:59:00Z')]); // a key from before the hash
    await quota.take('a@example.com', 'ip-1');
    await quota.take('b@example.com', 'ip-2');
    expect([...storage.data.keys()].some((k) => k.includes('old@example.com'))).toBe(false);
    expect(storage.data.size).toBe(5); // 2 addresses, 2 clients, the day

    advance(HOUR); // 11:00: ip-1 and ip-2 have nothing in the last hour; the addresses still count for today
    await quota.take('c@example.com', 'ip-3');
    expect([...storage.data.keys()].filter((k) => k.startsWith('emailq:client:'))).toEqual(['emailq:client:ip-3']);
    expect([...storage.data.keys()].filter((k) => k.startsWith('emailq:to:'))).toHaveLength(3);

    advance(24 * HOUR); // the next day: yesterday's count and addresses go
    await quota.take('d@example.com', 'ip-4');
    expect([...storage.data.keys()].filter((k) => k.startsWith('emailq:day:'))).toEqual(['emailq:day:2026-11-21']);
    expect([...storage.data.keys()].filter((k) => k.startsWith('emailq:to:'))).toHaveLength(1);
    expect([...storage.data.keys()].filter((k) => k.startsWith('emailq:client:'))).toEqual(['emailq:client:ip-4']);
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
