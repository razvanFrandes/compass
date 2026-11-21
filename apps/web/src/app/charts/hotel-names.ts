import { signal } from '@angular/core';
import { HALCYON_HOTELS, type HotelRef } from '../scope/hotels';

/*
  How a hotel reads on a chart. Rows carry codes ("LIS", "DXB2") or full names ("Arbor Lisbon Chiado"); a chart
  never shows a code. On the marks a hotel is its city ("Lisbon"), or its name without the brand where two hotels
  share a city ("Dubai Business Bay", "London Mayfair"); tooltips and tables use the full name.

  The names come from `GET /api/hotels` (ScopeService registers the catalog here) and, until it answers, from the
  built-in list of the group's hotels.
*/

export interface HotelNames {
  full: string;
  short: string;
}

type Directory = ReadonlyMap<string, HotelNames>;

function directoryOf(hotels: readonly Pick<HotelRef, 'code' | 'name' | 'brand' | 'city'>[]): Directory {
  const perCity = new Map<string, number>();
  for (const h of hotels) if (h.city) perCity.set(h.city, (perCity.get(h.city) ?? 0) + 1);
  const map = new Map<string, HotelNames>();
  for (const h of hotels) {
    const unbranded = h.brand && h.name.startsWith(`${h.brand} `) ? h.name.slice(h.brand.length + 1) : h.name;
    const short = h.city && perCity.get(h.city) === 1 ? h.city : unbranded;
    const names = { full: h.name, short };
    // A row may name the hotel by its code, its full name or its short one.
    map.set(h.code.toUpperCase(), names);
    map.set(h.name.toLowerCase(), names);
    map.set(unbranded.toLowerCase(), names);
  }
  return map;
}

const directory = signal<Directory>(directoryOf(HALCYON_HOTELS));

/** Registers the group's hotels (from `GET /api/hotels`). Charts that read hotel names draw again. */
export function setHotelCatalog(hotels: readonly Pick<HotelRef, 'code' | 'name' | 'brand' | 'city'>[]): void {
  if (hotels.length) directory.set(directoryOf(hotels));
}

/** Read inside a computed to follow the catalog (a chart built before `GET /api/hotels` answered is built again). */
export const hotelCatalog = directory.asReadonly();

/** The names of a hotel given by code or by name; undefined when the value is not one of the group's hotels. */
export function hotelNames(value: unknown): HotelNames | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const v = value.trim();
  const map = directory();
  return map.get(v.toUpperCase()) ?? map.get(v.toLowerCase());
}

/** "Lisbon" (short, for marks and axes) or "Arbor Lisbon Chiado" (full); anything else as it came. */
export function hotelLabel(value: unknown, style: 'short' | 'full'): string {
  const names = hotelNames(value);
  return names ? names[style] : String(value);
}
