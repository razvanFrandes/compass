import type { HotelRef } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { HotelDirectory } from '../src/application/hotel-directory.ts';
import { err, ok } from '../src/domain/result.ts';

const LIS: HotelRef = { code: 'LIS', name: 'Arbor Lisbon Chiado', city: 'Lisbon', country: 'Portugal', region: 'Europe', brand: 'Arbor', rooms: 164 };

describe('HotelDirectory', () => {
  it('reads the hotels once and answers from memory until the list is stale', async () => {
    let now = 0;
    let loads = 0;
    const directory = new HotelDirectory(60_000, () => now);
    const load = async () => (loads++, ok([LIS]));

    expect(await directory.list(load)).toEqual({ ok: true, value: [LIS] });
    now = 59_999;
    expect(await directory.list(load)).toEqual({ ok: true, value: [LIS] });
    expect(loads).toBe(1);
    now = 60_000;
    await directory.list(load);
    expect(loads).toBe(2);
  });

  it('reads once for callers that arrive together', async () => {
    let loads = 0;
    const directory = new HotelDirectory(60_000, () => 0);
    const load = async () => (loads++, ok([LIS]));
    await Promise.all([directory.list(load), directory.list(load), directory.list(load)]);
    expect(loads).toBe(1);
  });

  it('does not remember a failure, nor an empty list', async () => {
    const directory = new HotelDirectory(60_000, () => 0);
    const failed = await directory.list(async () => err({ kind: 'internal' as const, cause: new Error('db.internal:5432') }));
    expect(failed.ok).toBe(false);
    expect(await directory.list(async () => ok([]))).toEqual({ ok: true, value: [] });
    expect(await directory.list(async () => ok([LIS]))).toEqual({ ok: true, value: [LIS] });
  });

  it('keeps answering with the last list when a refresh fails', async () => {
    let now = 0;
    const directory = new HotelDirectory(60_000, () => now);
    await directory.list(async () => ok([LIS]));
    now = 120_000;
    expect(await directory.list(async () => err({ kind: 'internal' as const, cause: new Error('down') }))).toEqual({ ok: true, value: [LIS] });
  });
});
