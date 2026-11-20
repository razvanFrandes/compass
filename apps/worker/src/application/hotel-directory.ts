import type { HotelRef } from '@compass/contracts';
import type { Result } from '../domain/result.ts';

/**
 * The group's hotels, kept in memory: the list changes when a hotel opens, not between two requests. One read serves
 * everyone who asks while it is fresh, and callers that arrive together share one read. A failed read is not kept;
 * while the database is down, the last list still answers.
 */
export class HotelDirectory<E = unknown> {
  #hotels: HotelRef[] | undefined;
  #readAt = 0;
  #reading: Promise<Result<HotelRef[], E>> | undefined;

  readonly #ttlMs: number;
  readonly #now: () => number;

  constructor(ttlMs = 10 * 60_000, now: () => number = Date.now) {
    this.#ttlMs = ttlMs;
    this.#now = now;
  }

  async list(load: () => Promise<Result<HotelRef[], E>>): Promise<Result<HotelRef[], E>> {
    if (this.#hotels && this.#now() - this.#readAt < this.#ttlMs) return { ok: true, value: this.#hotels };
    this.#reading ??= load().finally(() => {
      this.#reading = undefined;
    });
    const read = await this.#reading;
    if (read.ok && read.value.length) {
      this.#hotels = read.value;
      this.#readAt = this.#now();
      return read;
    }
    // A refresh that failed: the list we had is still the best answer.
    if (!read.ok && this.#hotels) return { ok: true, value: this.#hotels };
    return read;
  }
}
