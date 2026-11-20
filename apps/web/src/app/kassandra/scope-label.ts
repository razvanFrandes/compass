import { HOTELS } from '../halcyon-data';

const NAMES = new Map<string, string>((HOTELS as readonly { code: string; name: string }[]).map((hotel) => [hotel.code, hotel.name]));

/** The hotel scope as chips for the composer: "All 20 hotels", or the hotels by name, at most two and a count. */
export function scopeChips(hotels: readonly string[]): string[] {
  if (!hotels.length) return [`All ${NAMES.size} hotels`];
  const names = hotels.map((code) => NAMES.get(code) ?? code);
  return names.length <= 2 ? names : [names[0]!, `+${names.length - 1} more`];
}
