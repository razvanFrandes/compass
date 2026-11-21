import { HotelScope, type HotelRef } from '@compass/contracts';
import { err, ok, type Result } from './result.ts';

/**
 * The hotel scope of a conversation: the hotels a person works on (the sidebar's switcher). While it is set, the
 * assistant reads only those hotels. An empty scope is the whole group. Pure.
 */

export interface ScopeHotel {
  code: string;
  name: string;
}

const CODE = /^[A-Z0-9]{2,8}$/;

/**
 * Checks a scope as the client sent it against the group's hotels and names each hotel. The names end up in the
 * system prompt, so they come from the directory and never from the client. A code the group does not have is
 * refused: dropping it could leave no hotels, which would read as the whole group.
 */
export function resolveScope(raw: unknown, hotels: readonly HotelRef[]): Result<ScopeHotel[], string> {
  if (raw === undefined || raw === null) return ok([]);
  const parsed = HotelScope.safeParse(raw);
  if (!parsed.success) return err('Send the scope as { "hotels": ["LIS", …] }, with at most 50 hotel codes.');
  const wanted = new Set(parsed.data.hotels.map((code) => code.trim().toUpperCase()));
  const known = new Set(hotels.map((hotel) => hotel.code));
  const unknown = [...wanted].filter((code) => !known.has(code));
  if (unknown.length) {
    // Only what looks like a code is repeated back.
    const named = unknown.filter((code) => CODE.test(code));
    return err(named.length ? `Not a hotel in the group: ${named.join(', ')}. Choose the hotels again.` : 'One of the hotels selected is not in the group. Choose the hotels again.');
  }
  if (wanted.size === 0 || wanted.size === known.size) return ok([]);
  return ok(hotels.filter((hotel) => wanted.has(hotel.code)).map(({ code, name }) => ({ code, name })));
}

/**
 * The hotels one tool call reads under a scope: its own hotels that are in the scope, or the whole scope when it
 * names none. `outside` are the hotels it asked for and may not read. With no scope the call is left as it is.
 */
export function hotelsInScope(scope: readonly string[], requested: readonly string[] | undefined): { hotels: string[] | undefined; outside: string[] } {
  if (!scope.length) return { hotels: requested ? [...requested] : undefined, outside: [] };
  if (!requested?.length) return { hotels: [...scope], outside: [] };
  const codes = requested.map((code) => code.trim().toUpperCase());
  return { hotels: codes.filter((code) => scope.includes(code)), outside: codes.filter((code) => !scope.includes(code)) };
}
