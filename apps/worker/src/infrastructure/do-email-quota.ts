import type { EmailQuota } from '../application/workflows/email.ts';

/** The two calls the quota makes on a Durable Object's storage (`DurableObjectStorage` has both). */
export interface EmailQuotaStorage {
  get<T>(keys: string[]): Promise<Map<string, T>>;
  put<T>(entries: Record<string, T>): Promise<void>;
}

export const EMAIL_LIMITS = { perRecipientPerHour: 3, perClientPerHour: 10, perDay: 50 } as const;

const HOUR_MS = 60 * 60 * 1000;

/**
 * The email limits on a Durable Object's key-value storage: 3 per recipient and 10 per client in a rolling hour
 * (the send times are kept), 50 for everyone per UTC day (a count per day).
 *
 * One read of the three keys, then one write of all three or no write at all. Inside a Durable Object no other
 * request runs between the two (the input gate stays closed during storage calls), so two takes cannot both get the last unit.
 */
export class DurableEmailQuota implements EmailQuota {
  readonly #storage: EmailQuotaStorage;
  readonly #now: () => Date;

  constructor(storage: EmailQuotaStorage, now: () => Date = () => new Date()) {
    this.#storage = storage;
    this.#now = now;
  }

  async take(recipient: string, client: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const now = this.#now();
    const at = now.getTime();
    const toKey = `emailq:to:${recipient.trim().toLowerCase()}`;
    const clientKey = `emailq:client:${client.trim().toLowerCase()}`;
    const dayKey = `emailq:day:${now.toISOString().slice(0, 10)}`;

    const stored = await this.#storage.get<number[] | number>([toKey, clientKey, dayKey]);
    const lastHour = (key: string) => ((stored.get(key) as number[] | undefined) ?? []).filter((sentAt) => sentAt > at - HOUR_MS);
    const toRecipient = lastHour(toKey);
    const fromClient = lastHour(clientKey);
    const today = (stored.get(dayKey) as number | undefined) ?? 0;

    if (toRecipient.length >= EMAIL_LIMITS.perRecipientPerHour) {
      return { ok: false, reason: `This address already got ${EMAIL_LIMITS.perRecipientPerHour} emails in the last hour. Try again later.` };
    }
    if (fromClient.length >= EMAIL_LIMITS.perClientPerHour) {
      return { ok: false, reason: `You have sent ${EMAIL_LIMITS.perClientPerHour} emails in the last hour. Try again later.` };
    }
    if (today >= EMAIL_LIMITS.perDay) {
      return { ok: false, reason: `The demo has sent its ${EMAIL_LIMITS.perDay} emails for today. Try again tomorrow.` };
    }

    await this.#storage.put<number[] | number>({ [toKey]: [...toRecipient, at], [clientKey]: [...fromClient, at], [dayKey]: today + 1 });
    return { ok: true };
  }
}
