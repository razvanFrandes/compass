import type { HotelRef } from '../api/hotels-api';

export type { HotelRef };

/**
 * The 20 Halcyon hotels, as `GET /api/hotels` will return them (docs/round2-contracts.md §1).
 * The fallback while that endpoint is not deployed, and whenever it cannot be reached: same codes, names,
 * regions, brands and room counts as `PF_HOTELS` in portfolio-data.ts (hotels.spec.ts checks they agree).
 */
export const HALCYON_HOTELS: readonly HotelRef[] = [
  { code: 'TYO', name: 'Arbor Tokyo Ginza', city: 'Tokyo', country: 'Japan', region: 'Asia', brand: 'Arbor', rooms: 210 },
  { code: 'SIN', name: 'Kestrel Singapore Marina', city: 'Singapore', country: 'Singapore', region: 'Asia', brand: 'Kestrel', rooms: 280 },
  { code: 'DPS', name: 'Lumen Bali Uluwatu', city: 'Bali', country: 'Indonesia', region: 'Asia', brand: 'Lumen', rooms: 200 },
  { code: 'AMS', name: 'Arbor Amsterdam Centraal', city: 'Amsterdam', country: 'Netherlands', region: 'Europe', brand: 'Arbor', rooms: 220 },
  { code: 'LIS', name: 'Arbor Lisbon Chiado', city: 'Lisbon', country: 'Portugal', region: 'Europe', brand: 'Arbor', rooms: 150 },
  { code: 'PAR', name: 'Arbor Paris Opera', city: 'Paris', country: 'France', region: 'Europe', brand: 'Arbor', rooms: 180 },
  { code: 'LON1', name: 'Kestrel London Mayfair', city: 'London', country: 'United Kingdom', region: 'Europe', brand: 'Kestrel', rooms: 120 },
  { code: 'VIE', name: 'Kestrel Vienna Ring', city: 'Vienna', country: 'Austria', region: 'Europe', brand: 'Kestrel', rooms: 140 },
  { code: 'BCN', name: 'Lumen Barcelona Mar', city: 'Barcelona', country: 'Spain', region: 'Europe', brand: 'Lumen', rooms: 300 },
  { code: 'BER', name: 'Tessera Berlin Mitte', city: 'Berlin', country: 'Germany', region: 'Europe', brand: 'Tessera', rooms: 240 },
  { code: 'LON2', name: "Tessera London King's Cross", city: 'London', country: 'United Kingdom', region: 'Europe', brand: 'Tessera', rooms: 260 },
  { code: 'DOH', name: 'Arbor Doha West Bay', city: 'Doha', country: 'Qatar', region: 'Middle East', brand: 'Arbor', rooms: 250 },
  { code: 'DXB1', name: 'Kestrel Dubai Marina', city: 'Dubai', country: 'United Arab Emirates', region: 'Middle East', brand: 'Kestrel', rooms: 320 },
  { code: 'DXB2', name: 'Tessera Dubai Business Bay', city: 'Dubai', country: 'United Arab Emirates', region: 'Middle East', brand: 'Tessera', rooms: 300 },
  { code: 'NYC', name: 'Arbor New York Midtown', city: 'New York', country: 'United States', region: 'North America', brand: 'Arbor', rooms: 380 },
  { code: 'YYZ', name: 'Arbor Toronto Financial District', city: 'Toronto', country: 'Canada', region: 'North America', brand: 'Arbor', rooms: 230 },
  { code: 'MIA', name: 'Lumen Miami Beach', city: 'Miami', country: 'United States', region: 'North America', brand: 'Lumen', rooms: 260 },
  { code: 'CHI', name: 'Tessera Chicago Loop', city: 'Chicago', country: 'United States', region: 'North America', brand: 'Tessera', rooms: 280 },
  { code: 'GRU', name: 'Arbor Sao Paulo Faria Lima', city: 'Sao Paulo', country: 'Brazil', region: 'South America', brand: 'Arbor', rooms: 240 },
  { code: 'EZE', name: 'Tessera Buenos Aires Palermo', city: 'Buenos Aires', country: 'Argentina', region: 'South America', brand: 'Tessera', rooms: 180 },
];

/** True for what `GET /api/hotels` promises: a non-empty list of hotels with a code, a name, a region and a brand. */
export function isHotelList(value: unknown): value is HotelRef[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((h: unknown) => {
      if (typeof h !== 'object' || h === null) return false;
      const hotel = h as Record<string, unknown>;
      return ['code', 'name', 'region', 'brand'].every((key) => typeof hotel[key] === 'string' && hotel[key] !== '');
    })
  );
}

/** "Arbor Lisbon Chiado" → "Lisbon Chiado": the name without its brand, for places where the room is tight. */
export function shortName(hotel: Pick<HotelRef, 'name' | 'brand'>): string {
  return hotel.name.startsWith(`${hotel.brand} `) ? hotel.name.slice(hotel.brand.length + 1) : hotel.name;
}

const CODE = /^[A-Z0-9]{2,8}$/;

/**
 * A selection in one canonical form: upper case, no repeats, in the catalog's order, known hotels only.
 * An empty list means the whole group, and so do `ALL` and a list that names every hotel.
 */
export function normalizeCodes(codes: readonly string[], catalog: readonly HotelRef[]): string[] {
  const wanted = new Set(codes.map((code) => code.trim().toUpperCase()).filter((code) => CODE.test(code)));
  if (wanted.has('ALL')) return [];
  const known = catalog.filter((hotel) => wanted.has(hotel.code)).map((hotel) => hotel.code);
  return known.length === catalog.length ? [] : known;
}

/** `?hotels=LIS,PAR` → `['LIS', 'PAR']`. Null when the address says nothing about the scope. */
export function parseScopeParam(value: string | null | undefined): string[] | null {
  if (value === null || value === undefined) return null;
  return [...new Set(value.split(/[,\s]+/).map((code) => code.trim().toUpperCase()).filter((code) => CODE.test(code) && code !== 'ALL'))].slice(0, 64);
}

/** The address with the scope in `?hotels=`; the whole group has no parameter. Everything else in it stays. */
export function withScopeParam(href: string, codes: readonly string[], base = 'http://localhost'): string {
  const url = new URL(href, base);
  if (codes.length) url.searchParams.set('hotels', codes.join(','));
  else url.searchParams.delete('hotels');
  // Commas are safe in a query and keep the address readable.
  const search = url.searchParams.toString().replace(/%2C/gi, ',');
  return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
}

const plural = (n: number) => (n === 1 ? '1 hotel' : `${n} hotels`);

/** The regions and the brands of the catalog, each with its hotels, in the order they first appear. */
export function hotelSets(catalog: readonly HotelRef[]): { regions: { name: string; codes: string[] }[]; brands: { name: string; codes: string[] }[] } {
  const by = (key: 'region' | 'brand') => {
    const sets = new Map<string, string[]>();
    for (const hotel of catalog) sets.set(hotel[key], [...(sets.get(hotel[key]) ?? []), hotel.code]);
    return [...sets].map(([name, codes]) => ({ name, codes }));
  };
  return { regions: by('region'), brands: by('brand').sort((a, b) => a.name.localeCompare(b.name)) };
}

const sameSet = (a: readonly string[], b: ReadonlySet<string>) => a.length === b.size && a.every((code) => b.has(code));

/**
 * The scope in a few words: "All 20 hotels", "Europe · 8 hotels", "Arbor · 8 hotels", "Arbor Lisbon Chiado",
 * "Lisbon Chiado, Paris Opera" or "Lisbon Chiado + 2 more".
 */
export function scopeLabel(codes: readonly string[], catalog: readonly HotelRef[]): string {
  const chosen = catalog.filter((hotel) => codes.includes(hotel.code));
  if (!chosen.length || chosen.length === catalog.length) return `All ${plural(catalog.length)}`;
  if (chosen.length === 1) return chosen[0]!.name;
  const set = new Set(chosen.map((hotel) => hotel.code));
  const { regions, brands } = hotelSets(catalog);
  const whole = [...regions, ...brands].find((group) => sameSet(group.codes, set));
  if (whole) return `${whole.name} · ${plural(whole.codes.length)}`;
  if (chosen.length === 2) return `${shortName(chosen[0]!)}, ${shortName(chosen[1]!)}`;
  return `${shortName(chosen[0]!)} + ${chosen.length - 1} more`;
}

/** The same scope for a sentence: "all 20 hotels", "8 hotels in Europe", "8 Arbor hotels", "Arbor Lisbon Chiado", "3 hotels". */
export function scopePhrase(codes: readonly string[], catalog: readonly HotelRef[]): string {
  const chosen = catalog.filter((hotel) => codes.includes(hotel.code));
  if (!chosen.length || chosen.length === catalog.length) return `all ${plural(catalog.length)}`;
  if (chosen.length === 1) return chosen[0]!.name;
  const set = new Set(chosen.map((hotel) => hotel.code));
  const { regions, brands } = hotelSets(catalog);
  const region = regions.find((group) => sameSet(group.codes, set));
  if (region) return `${plural(region.codes.length)} in ${region.name}`;
  const brand = brands.find((group) => sameSet(group.codes, set));
  if (brand) return `${brand.codes.length} ${brand.name} hotels`;
  return plural(chosen.length);
}

export interface ScopeChip {
  key: string;
  label: string;
  /** The hotels the chip stands for; removing the chip removes them all. */
  codes: string[];
}

/** The selection as removable chips: a whole region collapses into one chip, the rest is one chip per hotel. */
export function scopeChips(codes: readonly string[], catalog: readonly HotelRef[]): ScopeChip[] {
  const left = new Set(codes);
  const chips: ScopeChip[] = [];
  for (const region of hotelSets(catalog).regions) {
    if (region.codes.length > 1 && region.codes.every((code) => left.has(code))) {
      chips.push({ key: `region:${region.name}`, label: `${region.name} · ${region.codes.length}`, codes: region.codes });
      for (const code of region.codes) left.delete(code);
    }
  }
  for (const hotel of catalog) if (left.has(hotel.code)) chips.push({ key: hotel.code, label: shortName(hotel), codes: [hotel.code] });
  return chips;
}

export type PickerOptionKind = 'all' | 'region' | 'brand' | 'hotel';

export interface PickerOption {
  /** Unique and stable in the list, safe as part of a DOM id: `all`, `region-europe`, `brand-arbor`, `hotel-LIS`. */
  id: string;
  kind: PickerOptionKind;
  label: string;
  /** The second line of a hotel ("Lisbon, Portugal · 150 rooms"); the count of a set ("8"). */
  hint: string;
  codes: string[];
}

export interface PickerGroup {
  key: string;
  label: string;
  options: PickerOption[];
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const slug = (text: string) => fold(text).replace(/[^a-z0-9]+/g, '-');
const tokens = (query: string) => fold(query).split(/\s+/).filter(Boolean);

/** Every word of the query is in the hotel's name, city, country, region, brand or code. */
export function hotelMatches(hotel: HotelRef, query: string): boolean {
  const words = tokens(query);
  if (!words.length) return true;
  const haystack = fold([hotel.name, hotel.city, hotel.country, hotel.region, hotel.brand, hotel.code].join(' '));
  return words.every((word) => haystack.includes(word));
}

/**
 * What the picker lists for a query: quick picks first (the whole group, each region, each brand), then the
 * hotels under their region. A set stays a quick pick while its name matches; "All hotels" only without a query.
 */
export function pickerGroups(catalog: readonly HotelRef[], query = ''): PickerGroup[] {
  const words = tokens(query);
  const named = (name: string) => words.every((word) => fold(name).includes(word));
  const { regions, brands } = hotelSets(catalog);
  const quick: PickerOption[] = [];
  if (!words.length) quick.push({ id: 'all', kind: 'all', label: `All ${plural(catalog.length)}`, hint: '', codes: [] });
  for (const region of regions) if (named(region.name)) quick.push({ id: `region-${slug(region.name)}`, kind: 'region', label: region.name, hint: String(region.codes.length), codes: region.codes });
  for (const brand of brands) if (named(brand.name)) quick.push({ id: `brand-${slug(brand.name)}`, kind: 'brand', label: brand.name, hint: String(brand.codes.length), codes: brand.codes });

  const groups: PickerGroup[] = quick.length ? [{ key: 'quick', label: 'Quick picks', options: quick }] : [];
  for (const region of regions) {
    const options = catalog
      .filter((hotel) => hotel.region === region.name && hotelMatches(hotel, query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((hotel): PickerOption => ({
        id: `hotel-${hotel.code}`,
        kind: 'hotel',
        label: hotel.name,
        hint: [hotel.country && hotel.country !== hotel.city ? `${hotel.city}, ${hotel.country}` : hotel.city, hotel.rooms ? `${hotel.rooms} rooms` : ''].filter(Boolean).join(' · '),
        codes: [hotel.code],
      }));
    if (options.length) groups.push({ key: `region:${region.name}`, label: region.name, options });
  }
  return groups;
}

/** How much of an option the selection holds. "All hotels" is chosen exactly when nothing narrower is. */
export function optionState(selected: readonly string[], option: PickerOption): 'all' | 'some' | 'none' {
  if (option.kind === 'all') return selected.length ? 'none' : 'all';
  const held = option.codes.filter((code) => selected.includes(code)).length;
  return held === 0 ? 'none' : held === option.codes.length ? 'all' : 'some';
}

/**
 * The selection after picking an option. "All hotels" clears it. A hotel toggles. A region or a brand adds its
 * hotels, or removes them when they are all in already. The result is canonical (see `normalizeCodes`).
 */
export function toggleOption(selected: readonly string[], option: PickerOption, catalog: readonly HotelRef[]): string[] {
  if (option.kind === 'all') return [];
  const remove = optionState(selected, option) === 'all';
  const next = remove ? selected.filter((code) => !option.codes.includes(code)) : [...selected, ...option.codes];
  return normalizeCodes(next, catalog);
}
