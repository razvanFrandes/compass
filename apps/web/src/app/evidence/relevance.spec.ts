import { arrangeCalls, backedCounts, backingCells, figureSources, lookupSummary, planColumns, toolRole } from './relevance';
import type { EvidenceColumn, EvidenceRow } from './types';

const call = (callId: string, name: string) => ({ callId, name });
const ids = (calls: readonly { callId: string }[]) => calls.map((item) => item.callId);

const hotels = call('h', 'list_hotels');
const health = call('d', 'get_data_health');
const brief = call('b', 'get_brief');
const production = call('p', 'get_account_production');
const pace = call('q', 'get_pace');

describe('toolRole', () => {
  it('tells the tools that read the numbers from lookup tables and sanity checks', () => {
    expect(['get_account_production', 'get_pace', 'get_metric', 'run_readonly_query', 'find_reviews'].map(toolRole)).toEqual(['data', 'data', 'data', 'data', 'data']);
    expect(['list_hotels', 'list_metrics', 'get_schema'].map(toolRole)).toEqual(['reference', 'reference', 'reference']);
    expect(['get_data_health', 'get_brief'].map(toolRole)).toEqual(['check', 'check']);
  });

  it('reads through the MCP prefix, and takes a tool it does not know for data', () => {
    expect(toolRole('mcp__compass__list_hotels')).toBe('reference');
    expect(toolRole('mcp__compass__get_pace')).toBe('data');
    expect(toolRole('get_something_new')).toBe('data');
  });
});

describe('arrangeCalls', () => {
  it('keeps the hotel list and a freshness check out of the data behind the Vantor answer', () => {
    // The calls as Kassandra made them: the lookup first, then the data and the check.
    const arranged = arrangeCalls([hotels, production, health], new Map([['p', 7]]));
    expect(ids(arranged.answer)).toEqual(['p']);
    expect(ids(arranged.lookups)).toEqual(['h', 'd']);
  });

  it('orders the results that fed the answer by how many of its numbers they back, ties in the order made', () => {
    const metric = call('m', 'get_metric');
    const arranged = arrangeCalls([pace, metric, production], new Map([['p', 4], ['q', 1], ['m', 1]]));
    expect(ids(arranged.answer)).toEqual(['p', 'q', 'm']);
    expect(ids(arrangeCalls([pace, metric]).answer)).toEqual(['q', 'm']);
  });

  it('counts a check as data when the answer quotes it, or when it is all the answer read', () => {
    expect(ids(arrangeCalls([production, brief], new Map([['b', 1]])).answer)).toEqual(['b', 'p']);
    expect(ids(arrangeCalls([production, brief]).lookups)).toEqual(['b']);
    const alone = arrangeCalls([hotels, health]);
    expect(ids(alone.answer)).toEqual(['d']);
    expect(ids(alone.lookups)).toEqual(['h']);
  });

  it('shows a lookup table as the data only when a finished answer read nothing else', () => {
    expect(ids(arrangeCalls([hotels]).answer)).toEqual(['h']);
    // While the answer is still being worked on, the data it was looked up for is on its way.
    expect(arrangeCalls([hotels], new Map(), false)).toEqual({ answer: [], lookups: [hotels] });
  });
});

describe('figureSources', () => {
  it('never traces a number to a lookup table while there is anything else, and prefers data over checks', () => {
    expect(ids(figureSources([hotels, health, production]))).toEqual(['p', 'd']);
    expect(ids(figureSources([hotels]))).toEqual(['h']);
  });
});

describe('lookupSummary', () => {
  it('says what Kassandra looked up, in a sentence', () => {
    expect(lookupSummary([hotels])).toBe('Kassandra also looked up the hotel list');
    expect(lookupSummary([hotels, health])).toBe('Kassandra also looked up the hotel list and checked data freshness');
    expect(lookupSummary([hotels, call('m', 'list_metrics'), call('s', 'get_schema'), brief])).toBe('Kassandra also looked up the hotel list, the metric definitions and the data model and read the morning brief');
  });

  it('names a lookup once, and one it does not know by its title', () => {
    expect(lookupSummary([hotels, call('h2', 'list_hotels')])).toBe('Kassandra also looked up the hotel list');
    expect(lookupSummary([{ callId: 'x', name: 'list_segments', title: 'Segment list' }])).toBe('Kassandra also looked up segment list');
    expect(lookupSummary([])).toBe('');
  });
});

describe('backedCounts and backingCells', () => {
  const figures = [
    { callId: 'p', rowIndex: 0, key: 'previous_room_nights' },
    { callId: 'p', rowIndex: 0, key: 'room_nights' },
    { callId: 'p', rowIndex: 4, key: 'revenue_change_eur' },
    { callId: 'p', rowIndex: 1, key: 'revenue_change_eur' },
    { callId: 'q', rowIndex: 2, key: 'pace_pct' },
  ];

  it('counts the numbers of the answer each result backs', () => {
    expect([...backedCounts(figures)]).toEqual([['p', 4], ['q', 1]]);
  });

  it('gives the rows that back them in the order of the data, and the columns in the order quoted', () => {
    expect(backingCells(figures, 'p')).toEqual({ rows: [0, 1, 4], keys: ['previous_room_nights', 'room_nights', 'revenue_change_eur'] });
    expect(backingCells(figures, 'nothing')).toEqual({ rows: [], keys: [] });
  });
});

describe('planColumns', () => {
  const text = (key: string, label: string): EvidenceColumn => ({ key, label, kind: 'text' });
  const keys = (columns: readonly EvidenceColumn[]) => columns.map((column) => column.key);

  const hotelColumns: EvidenceColumn[] = [
    text('hotel_code', 'Code'),
    text('name', 'Hotel'),
    text('brand', 'Brand'),
    text('city', 'City'),
    text('country', 'Country'),
    text('region', 'Region'),
    text('currency', 'Currency'),
    { key: 'rooms', label: 'Rooms', kind: 'count' },
    { key: 'meeting_space_sqm', label: 'Meeting space', kind: 'number', unit: 'sqm' },
  ];
  const hotelRows: EvidenceRow[] = [
    { hotel_code: 'DPS', name: 'Lumen Bali Uluwatu', brand: 'Lumen', city: 'Bali', country: 'ID', region: 'Asia', currency: 'IDR', rooms: 200, meeting_space_sqm: 400 },
    { hotel_code: 'SIN', name: 'Kestrel Singapore Marina', brand: 'Kestrel', city: 'Singapore', country: 'SG', region: 'Asia', currency: 'SGD', rooms: 280, meeting_space_sqm: 1300 },
    { hotel_code: 'LIS', name: 'Arbor Lisbon Chiado', brand: 'Arbor', city: 'Lisbon', country: 'PT', region: 'Europe', currency: 'EUR', rooms: 150, meeting_space_sqm: 220 },
  ];

  it('leaves the code beside a name, the country and the currency for "More columns"', () => {
    const plan = planColumns(hotelColumns, hotelRows);
    expect(keys(plan.shown)).toEqual(['name', 'brand', 'city', 'region', 'rooms', 'meeting_space_sqm']);
    expect(keys(plan.more)).toEqual(['hotel_code', 'country', 'currency']);
  });

  const accountColumns: EvidenceColumn[] = [
    { key: 'hotel_code', label: 'Hotel', kind: 'hotel' },
    text('account', 'Account'),
    text('account_type', 'Account type'),
    { key: 'room_nights', label: 'Room nights', kind: 'count' },
    { key: 'previous_room_nights', label: 'Room nights, period before', kind: 'count' },
    { key: 'change', label: 'Change in room nights', kind: 'count' },
    { key: 'revenue_eur', label: 'Room revenue', kind: 'currency', unit: 'EUR' },
    { key: 'previous_revenue_eur', label: 'Room revenue, period before', kind: 'currency', unit: 'EUR' },
    { key: 'revenue_change_eur', label: 'Change in room revenue', kind: 'currency', unit: 'EUR' },
    { key: 'first_stay_date', label: 'First stay', kind: 'date' },
    { key: 'last_stay_date', label: 'Last stay', kind: 'date' },
  ];
  const accountRows: EvidenceRow[] = [
    { hotel_code: 'NYC', account: 'Vantor Consulting', account_type: 'corporate', room_nights: 477, previous_room_nights: 5504, change: -5027, revenue_eur: 144102, previous_revenue_eur: 1495492, revenue_change_eur: -1351390, first_stay_date: '2025-11-18', last_stay_date: '2026-07-15' },
    { hotel_code: 'NYC', account: 'Marlowe-Ito wedding', account_type: 'group', room_nights: 286, previous_room_nights: 686, change: -400, revenue_eur: 64418, previous_revenue_eur: 145286, revenue_change_eur: -80868, first_stay_date: '2025-12-14', last_stay_date: '2026-11-20' },
  ];

  it('leads with what tells the rows apart, and says once what every row shares', () => {
    const plan = planColumns(accountColumns, accountRows);
    expect(keys(plan.shown)).toEqual(['account', 'account_type', 'room_nights', 'previous_room_nights', 'change', 'revenue_eur']);
    expect(keys(plan.shared)).toEqual(['hotel_code']);
    expect(keys(plan.more)).toEqual(['previous_revenue_eur', 'revenue_change_eur', 'first_stay_date', 'last_stay_date', 'hotel_code']);
  });

  it('never drops a column the answer quotes, and fills what room is left in the order of the data', () => {
    const quoted = ['previous_room_nights', 'room_nights', 'change', 'previous_revenue_eur', 'revenue_eur', 'revenue_change_eur'];
    expect(keys(planColumns(accountColumns, accountRows, { prefer: quoted, max: 4 }).shown)).toEqual(['account', 'room_nights', 'previous_room_nights', 'change', 'revenue_eur', 'previous_revenue_eur', 'revenue_change_eur']);
    expect(keys(planColumns(accountColumns, accountRows, { prefer: ['revenue_change_eur'], max: 4 }).shown)).toEqual(['account', 'account_type', 'room_nights', 'revenue_change_eur']);
  });

  it('keeps a column that says the same on every row when it is preferred, or when it is the only name a row has', () => {
    expect(keys(planColumns(accountColumns, accountRows, { prefer: ['hotel_code'] }).shown)).toContain('hotel_code');
    const oneHotel: EvidenceRow[] = [
      { hotel_code: 'LIS', rooms_otb: 10 },
      { hotel_code: 'LIS', rooms_otb: 12 },
    ];
    const plan = planColumns([accountColumns[0]!, { key: 'rooms_otb', label: 'On the books', kind: 'count' }], oneHotel);
    expect(keys(plan.shown)).toEqual(['hotel_code', 'rooms_otb']);
    expect(plan.shared).toEqual([]);
  });

  it('leaves an empty column and ids for "More columns", ids last', () => {
    const columns: EvidenceColumn[] = [{ key: 'id', label: 'ID', kind: 'id' }, text('title', 'Finding'), { key: 'impact_eur', label: 'Impact', kind: 'currency', unit: 'EUR' }, text('note', 'Note')];
    const rows: EvidenceRow[] = [
      { id: 'a', title: 'Stale feed', impact_eur: null, note: 'x' },
      { id: 'b', title: 'Lost account', impact_eur: null, note: 'y' },
    ];
    const plan = planColumns(columns, rows);
    expect(keys(plan.shown)).toEqual(['title', 'note']);
    expect(keys(plan.more)).toEqual(['impact_eur', 'id']);
  });

  it('shows every column when all of them are internal', () => {
    const columns: EvidenceColumn[] = [{ key: 'id', label: 'ID', kind: 'id' }];
    expect(planColumns(columns, [{ id: 'a' }])).toEqual({ shown: columns, more: [], shared: [] });
  });
});
