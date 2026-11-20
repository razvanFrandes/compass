import type { HotelRef } from '@compass/contracts';
import { HotelDirectory } from '../application/hotel-directory.ts';
import { HotelData, type DataError } from '../application/hotel-data.ts';
import { err, ok, type Result } from '../domain/result.ts';
import { resolveScope, type ScopeHotel } from '../domain/scope.ts';
import type { Env } from '../env.ts';
import { openPostgres } from '../infrastructure/postgres.ts';

export const HOTELS_UNAVAILABLE = 'Couldn’t load the hotels. Try again in a moment.';

/**
 * One directory per isolate: it holds the hotel list (public reference data) for ten minutes, never a connection.
 * The Worker's requests and the Durable Objects that run in the same isolate share it.
 */
const directory = new HotelDirectory<DataError>();

/** The group's hotels, from memory when fresh, else from the database with a client opened for this one read. */
export function groupHotels(env: Env): Promise<Result<HotelRef[], DataError>> {
  return directory.list(async () => {
    const db = openPostgres(env.HYPERDRIVE.connectionString);
    try {
      return await new HotelData(db).hotelRefs();
    } finally {
      await db.close();
    }
  });
}

/** Why a scope was not taken: `400` it is not a valid scope, `503` the hotel list could not be read. */
export interface ScopeRefusal {
  status: 400 | 503;
  message: string;
}

/**
 * The scope a client sent with a question, checked against the group's hotels and named. No scope, or an empty one,
 * is the whole group and reads nothing.
 */
export async function scopeFor(env: Env, raw: unknown): Promise<Result<ScopeHotel[], ScopeRefusal>> {
  if (raw === undefined || raw === null) return ok([]);
  const hotels = await groupHotels(env);
  if (!hotels.ok) {
    console.error('hotel list failed', 'cause' in hotels.error ? hotels.error.cause : hotels.error.kind);
    return err({ status: 503, message: HOTELS_UNAVAILABLE });
  }
  const scope = resolveScope(raw, hotels.value);
  return scope.ok ? scope : err({ status: 400, message: scope.error });
}
