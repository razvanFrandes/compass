import type { EmailQuota } from '../application/workflows/email.ts';

/** The three calls the quota makes on a Durable Object's storage (`DurableObjectStorage` has them). */
export interface EmailQuotaStorage {
  list<T>(options: { prefix: string }): Promise<Map<string, T>>;
  put<T>(entries: Record<string, T>): Promise<void>;
  delete(keys: string[]): Promise<number>;
}

export const EMAIL_LIMITS = { perRecipientPerHour: 3, perRecipientPerDay: 6, perClientPerHour: 10, perDay: 50 } as const;

const HOUR_MS = 60 * 60 * 1000;
const PREFIX = 'emailq:';
const TO = `${PREFIX}to:`;
const DAY = `${PREFIX}day:`;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The email limits on a Durable Object's key-value storage:
 * - per recipient: 3 in a rolling hour and 6 per UTC day (the send times of the hour and of the day are kept);
 * - per client: 10 in a rolling hour (the send times are kept); a run without a client (the cron) has no such window;
 * - for everyone: 50 per UTC day (a count per day).
 *
 * No address is stored: a recipient's key is the SHA-256 hash of the address, trimmed and in lower case.
 *
 * One read of the quota's keys, then one write of all the windows or no write at all. Inside a Durable Object no
 * other request runs between the two (the input gate stays closed during storage calls; the hash is computed before
 * the read), so two takes cannot both get the last unit. A write also deletes the keys that no longer hold anything:
 * windows that have passed, earlier days, and keys from before the hash that still spell an address.
 */
export class DurableEmailQuota implements EmailQuota {
  readonly #storage: EmailQuotaStorage;
  readonly #now: () => Date;

  constructor(storage: EmailQuotaStorage, now: () => Date = () => new Date()) {
    this.#storage = storage;
    this.#now = now;
  }

  async take(recipient: string, client: string | null): Promise<{ ok: true } | { ok: false; reason: string }> {
    const toKey = `${TO}${await sha256Hex(recipient.trim().toLowerCase())}`;
    const now = this.#now();
    const at = now.getTime();
    const day = now.toISOString().slice(0, 10);
    const dayStart = Date.parse(`${day}T00:00:00.000Z`);
    const clientKey = client === null ? null : `${PREFIX}client:${client.trim().toLowerCase()}`;
    const dayKey = `${DAY}${day}`;

    const stored = await this.#storage.list<number[] | number>({ prefix: PREFIX });
    const times = (key: string | null) => {
      const value = key === null ? undefined : stored.get(key);
      return Array.isArray(value) ? value : [];
    };
    const inLastHour = (sentAt: number) => sentAt > at - HOUR_MS;
    const today = (sentAt: number) => sentAt >= dayStart;

    const toRecipient = times(toKey).filter((sentAt) => inLastHour(sentAt) || today(sentAt));
    const fromClient = times(clientKey).filter(inLastHour);
    const sentToday = stored.get(dayKey);
    const everyone = typeof sentToday === 'number' ? sentToday : 0;

    if (toRecipient.filter(inLastHour).length >= EMAIL_LIMITS.perRecipientPerHour) {
      return { ok: false, reason: `This address already got ${EMAIL_LIMITS.perRecipientPerHour} emails in the last hour. Try again later.` };
    }
    if (toRecipient.filter(today).length >= EMAIL_LIMITS.perRecipientPerDay) {
      return { ok: false, reason: `This address already got ${EMAIL_LIMITS.perRecipientPerDay} emails today. Try again tomorrow.` };
    }
    if (clientKey !== null && fromClient.length >= EMAIL_LIMITS.perClientPerHour) {
      return { ok: false, reason: `You have sent ${EMAIL_LIMITS.perClientPerHour} emails in the last hour. Try again later.` };
    }
    if (everyone >= EMAIL_LIMITS.perDay) {
      return { ok: false, reason: `The demo has sent its ${EMAIL_LIMITS.perDay} emails for today. Try again tomorrow.` };
    }

    const written: Record<string, number[] | number> = { [toKey]: [...toRecipient, at], [dayKey]: everyone + 1 };
    if (clientKey !== null) written[clientKey] = [...fromClient, at];

    const spent = [...stored.entries()].filter(([key, value]) => {
      if (key in written) return false;
      if (key.startsWith(DAY)) return key !== dayKey;
      if (!Array.isArray(value)) return true;
      if (!key.startsWith(TO)) return !value.some(inLastHour);
      // A recipient key that is not a hash was written before addresses were hashed: it holds an address, so it goes.
      return !/^[0-9a-f]{64}$/.test(key.slice(TO.length)) || !value.some((sentAt) => inLastHour(sentAt) || today(sentAt));
    });

    // No await between the two calls: the object's storage commits them together.
    const writes: Promise<unknown>[] = [this.#storage.put<number[] | number>(written)];
    const spentKeys = spent.map(([key]) => key);
    // One delete call takes at most 128 keys.
    for (let i = 0; i < spentKeys.length; i += 128) writes.push(this.#storage.delete(spentKeys.slice(i, i + 128)));
    await Promise.all(writes);
    return { ok: true };
  }
}
