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
  /** The hotel's own currency (ISO code), from its country; undefined for a country this list does not know. */
  currency?: string;
}

/** Local currency by country, as `GET /api/hotels` (ISO alpha-2) or the built-in list (English name) gives it. */
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  JP: 'JPY', Japan: 'JPY',
  SG: 'SGD', Singapore: 'SGD',
  ID: 'IDR', Indonesia: 'IDR',
  NL: 'EUR', Netherlands: 'EUR', PT: 'EUR', Portugal: 'EUR', FR: 'EUR', France: 'EUR', AT: 'EUR', Austria: 'EUR', ES: 'EUR', Spain: 'EUR', DE: 'EUR', Germany: 'EUR', IT: 'EUR', Italy: 'EUR', IE: 'EUR', Ireland: 'EUR', BE: 'EUR', Belgium: 'EUR', GR: 'EUR', Greece: 'EUR',
  GB: 'GBP', UK: 'GBP', 'United Kingdom': 'GBP',
  CH: 'CHF', Switzerland: 'CHF',
  QA: 'QAR', Qatar: 'QAR',
  AE: 'AED', 'United Arab Emirates': 'AED',
  US: 'USD', 'United States': 'USD',
  CA: 'CAD', Canada: 'CAD',
  BR: 'BRL', Brazil: 'BRL',
  AR: 'ARS', Argentina: 'ARS',
};

type Directory = ReadonlyMap<string, HotelNames>;

type CatalogHotel = Pick<HotelRef, 'code' | 'name' | 'brand' | 'city'> & Partial<Pick<HotelRef, 'country'>>;

function directoryOf(hotels: readonly CatalogHotel[]): Directory {
  const perCity = new Map<string, number>();
  for (const h of hotels) if (h.city) perCity.set(h.city, (perCity.get(h.city) ?? 0) + 1);
  const map = new Map<string, HotelNames>();
  for (const h of hotels) {
    const unbranded = h.brand && h.name.startsWith(`${h.brand} `) ? h.name.slice(h.brand.length + 1) : h.name;
    const short = h.city && perCity.get(h.city) === 1 ? h.city : unbranded;
    const currency = h.country ? CURRENCY_BY_COUNTRY[h.country.trim()] : undefined;
    const names: HotelNames = { full: h.name, short, ...(currency ? { currency } : {}) };
    // A row may name the hotel by its code, its full name or its short one.
    map.set(h.code.toUpperCase(), names);
    map.set(h.name.toLowerCase(), names);
    map.set(unbranded.toLowerCase(), names);
  }
  return map;
}

const directory = signal<Directory>(directoryOf(HALCYON_HOTELS));

/** Registers the group's hotels (from `GET /api/hotels`). Charts that read hotel names draw again. */
export function setHotelCatalog(hotels: readonly CatalogHotel[]): void {
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
