import { PF_HOTELS } from '../portfolio-data';
import {
  HALCYON_HOTELS,
  hotelMatches,
  isHotelList,
  normalizeCodes,
  optionState,
  parseScopeParam,
  pickerGroups,
  scopeChips,
  scopeLabel,
  scopePhrase,
  shortName,
  toggleOption,
  withScopeParam,
} from './hotels';

const H = HALCYON_HOTELS;
const EUROPE = ['AMS', 'LIS', 'PAR', 'LON1', 'VIE', 'BCN', 'BER', 'LON2'];
const option = (id: string, query = '') => pickerGroups(H, query).flatMap((group) => group.options).find((o) => o.id === id)!;

describe('the built-in hotel list', () => {
  it('is the 20 Halcyon hotels of the embedded data: same codes, names, regions and rooms', () => {
    expect(H).toHaveLength(20);
    const embedded = new Map((PF_HOTELS as readonly { code: string; name: string; region: string; rooms: number; city: string }[]).map((h) => [h.code, h]));
    for (const hotel of H) {
      expect(embedded.get(hotel.code)).toMatchObject({ name: hotel.name, region: hotel.region, rooms: hotel.rooms, city: hotel.city });
      expect(hotel.name.startsWith(`${hotel.brand} `)).toBe(true);
      expect(hotel.country).not.toBe('');
    }
    expect(isHotelList(H)).toBe(true);
  });

  it('tells a hotel list from anything else an endpoint might answer', () => {
    expect(isHotelList([])).toBe(false);
    expect(isHotelList({ error: 'Not found' })).toBe(false);
    expect(isHotelList([{ code: 'LIS' }])).toBe(false);
    expect(isHotelList(undefined)).toBe(false);
  });
});

describe('a selection of hotels', () => {
  it('has one canonical form: known codes, upper case, catalog order, and empty for the whole group', () => {
    expect(normalizeCodes(['par', ' LIS ', 'par', 'XXX', 'drop table'], H)).toEqual(['LIS', 'PAR']);
    expect(normalizeCodes(['ALL', 'LIS'], H)).toEqual([]);
    expect(normalizeCodes(H.map((h) => h.code), H)).toEqual([]);
    expect(normalizeCodes([], H)).toEqual([]);
  });

  it('reads and writes the address', () => {
    expect(parseScopeParam(null)).toBeNull();
    expect(parseScopeParam('')).toEqual([]);
    expect(parseScopeParam('lis, par,LIS')).toEqual(['LIS', 'PAR']);
    expect(parseScopeParam('<script>,LIS')).toEqual(['LIS']);
    expect(withScopeParam('/studio', ['LIS', 'PAR'])).toBe('/studio?hotels=LIS,PAR');
    expect(withScopeParam('/ask?c=abc&hotels=BER#top', ['LIS'])).toBe('/ask?c=abc&hotels=LIS#top');
    expect(withScopeParam('/ask?c=abc&hotels=BER', [])).toBe('/ask?c=abc');
    expect(withScopeParam('/', [])).toBe('/');
  });

  it('reads in a few words', () => {
    expect(scopeLabel([], H)).toBe('All 20 hotels');
    expect(scopeLabel(['LIS'], H)).toBe('Arbor Lisbon Chiado');
    expect(scopeLabel(EUROPE, H)).toBe('Europe · 8 hotels');
    expect(scopeLabel(['DXB1', 'LON1', 'SIN', 'VIE'], H)).toBe('Kestrel · 4 hotels');
    expect(scopeLabel(['PAR', 'LIS'], H)).toBe('Lisbon Chiado, Paris Opera');
    expect(scopeLabel(['LIS', 'PAR', 'NYC'], H)).toBe('Lisbon Chiado + 2 more');
    expect(scopePhrase([], H)).toBe('all 20 hotels');
    expect(scopePhrase(EUROPE, H)).toBe('8 hotels in Europe');
    expect(scopePhrase(['DXB1', 'LON1', 'SIN', 'VIE'], H)).toBe('4 Kestrel hotels');
    expect(scopePhrase(['LIS', 'PAR', 'NYC'], H)).toBe('3 hotels');
    expect(shortName(H.find((h) => h.code === 'LON2')!)).toBe("London King's Cross");
  });

  it('shows as chips: a whole region is one chip, the rest one each', () => {
    expect(scopeChips([], H)).toEqual([]);
    expect(scopeChips([...EUROPE, 'NYC'], H).map((chip) => chip.label)).toEqual(['Europe · 8', 'New York Midtown']);
    expect(scopeChips(['LIS', 'PAR'], H).map((chip) => chip.codes)).toEqual([['LIS'], ['PAR']]);
  });
});

describe('what the picker lists', () => {
  it('starts with the quick picks, then the hotels under their region', () => {
    const groups = pickerGroups(H);
    expect(groups.map((group) => group.label)).toEqual(['Quick picks', 'Asia', 'Europe', 'Middle East', 'North America', 'South America']);
    expect(groups[0]!.options.map((o) => o.label)).toEqual(['All 20 hotels', 'Asia', 'Europe', 'Middle East', 'North America', 'South America', 'Arbor', 'Kestrel', 'Lumen', 'Tessera']);
    expect(groups.slice(1).flatMap((group) => group.options)).toHaveLength(20);
    expect(option('hotel-LIS')).toMatchObject({ label: 'Arbor Lisbon Chiado', hint: 'Lisbon, Portugal · 150 rooms', codes: ['LIS'] });
    // A city state is not said twice.
    expect(option('hotel-SIN').hint).toBe('Singapore · 280 rooms');
  });

  it('filters by name, city, country, region, brand or code, every word and without accents', () => {
    const hotels = (query: string) => pickerGroups(H, query).flatMap((group) => group.options).filter((o) => o.kind === 'hotel').map((o) => o.codes[0]);
    expect(hotels('lisb')).toEqual(['LIS']);
    expect(hotels('london')).toEqual(['LON1', 'LON2']);
    expect(hotels('kestrel london')).toEqual(['LON1']);
    expect(hotels('united arab')).toEqual(['DXB1', 'DXB2']);
    expect(hotels('dxb2')).toEqual(['DXB2']);
    expect(hotels('São Paulo')).toEqual(['GRU']);
    expect(hotels('middle east')).toEqual(['DOH', 'DXB1', 'DXB2']);
    expect(hotels('zzz')).toEqual([]);
    expect(hotelMatches(H[0]!, '   ')).toBe(true);
  });

  it('keeps a region or a brand as a quick pick while its name matches', () => {
    const quick = (query: string) => pickerGroups(H, query).find((group) => group.key === 'quick')?.options.map((o) => o.label) ?? [];
    expect(quick('eur')).toEqual(['Europe']);
    expect(quick('arbor')).toEqual(['Arbor']);
    expect(quick('america')).toEqual(['North America', 'South America']);
    expect(quick('lisbon')).toEqual([]);
    expect(pickerGroups(H, 'zzz')).toEqual([]);
  });
});

describe('picking an option', () => {
  it('toggles a hotel; the first pick narrows the whole group to it', () => {
    expect(toggleOption([], option('hotel-LIS'), H)).toEqual(['LIS']);
    expect(toggleOption(['LIS'], option('hotel-PAR'), H)).toEqual(['LIS', 'PAR']);
    expect(toggleOption(['LIS', 'PAR'], option('hotel-LIS'), H)).toEqual(['PAR']);
    // Removing the last hotel is the whole group again.
    expect(toggleOption(['PAR'], option('hotel-PAR'), H)).toEqual([]);
  });

  it('adds a region or a brand, removes it when it is all in, and "All hotels" clears', () => {
    expect(toggleOption(['NYC'], option('region-europe'), H)).toEqual([...['AMS', 'LIS', 'PAR', 'LON1', 'VIE', 'BCN', 'BER', 'LON2'], 'NYC']);
    expect(toggleOption(['LIS'], option('region-europe'), H)).toEqual(['AMS', 'LIS', 'PAR', 'LON1', 'VIE', 'BCN', 'BER', 'LON2']);
    expect(toggleOption([...EUROPE, 'NYC'], option('region-europe'), H)).toEqual(['NYC']);
    expect(toggleOption(['NYC'], option('brand-kestrel'), H)).toEqual(['SIN', 'LON1', 'VIE', 'DXB1', 'NYC']);
    expect(toggleOption(EUROPE, option('all'), H)).toEqual([]);
  });

  it('says how much of an option is selected', () => {
    expect(optionState([], option('all'))).toBe('all');
    expect(optionState(['LIS'], option('all'))).toBe('none');
    expect(optionState(['LIS'], option('region-europe'))).toBe('some');
    expect(optionState(EUROPE, option('region-europe'))).toBe('all');
    expect(optionState(['NYC'], option('region-europe'))).toBe('none');
    expect(optionState(['LIS'], option('hotel-LIS'))).toBe('all');
  });
});
