import type { EvidenceColumn } from '@compass/contracts';
import { tidyWidget } from '@compass/contracts/widget-tidy';
import { describe, expect, it } from 'vitest';

// The owner's table: "How has the segment mix changed versus last year?" drew get_mix (grain total, rolled up), whose
// period column holds the same start date on every row, and whose room nights header said its unit twice.
const columns: EvidenceColumn[] = [
  { key: 'period', label: 'Period from', kind: 'date' },
  { key: 'key', label: 'Segment', kind: 'text' },
  { key: 'room_nights', label: 'Room nights', kind: 'count', unit: 'room nights' },
  { key: 'share_pct', label: 'Share of room nights', kind: 'percent' },
];
const rows = [
  { period: '2026-11-21', key: 'Transient retail', room_nights: 115311, share_pct: 37 },
  { period: '2026-11-21', key: 'Corporate negotiated', room_nights: 59661, share_pct: 19.1 },
  { period: '2026-11-21', key: 'Group', room_nights: 30617, share_pct: 9.8 },
];
const table = { kind: 'table' as const, title: 'Corporate is the one segment losing share', subtitle: 'All 20 hotels', sourceCallId: 'c1' };

const byKey = (list: readonly EvidenceColumn[], key: string) => list.find((column) => column.key === key)!;

describe('tidyWidget', () => {
  it('hides a column that says the same on every row and states it once in the subtitle', () => {
    const tidy = tidyWidget({ ...table, rows, columns });
    expect(byKey(tidy.columns, 'period').hidden).toBe(true);
    expect(tidy.subtitle).toBe('All 20 hotels · Period from Sat 21 Nov 2026');
    expect(byKey(tidy.columns, 'key').hidden).toBeUndefined();
  });

  it('does not state it again when the subtitle already does', () => {
    const tidy = tidyWidget({ ...table, subtitle: 'All 20 hotels · stays 21 Nov 2026 – 20 Nov 2027', rows, columns });
    expect(byKey(tidy.columns, 'period').hidden).toBe(true);
    expect(tidy.subtitle).toBe('All 20 hotels · stays 21 Nov 2026 – 20 Nov 2027');
  });

  it('drops a table\'s constant column even when the model listed it', () => {
    const tidy = tidyWidget({ ...table, y: ['period', 'key', 'room_nights'], rows, columns });
    expect(tidy.y).toEqual(['key', 'room_nights']);
  });

  it('never repeats a unit the label already says ("Room nights (room nights)")', () => {
    const tidy = tidyWidget({ ...table, rows, columns });
    expect(byKey(tidy.columns, 'room_nights').unit).toBeUndefined();
    const nights = tidyWidget({ ...table, rows, columns: [...columns.slice(0, 2), { key: 'room_nights', label: 'Rooms sold', kind: 'count', unit: 'room nights' }] });
    expect(byKey(nights.columns, 'room_nights').unit).toBe('room nights');
  });

  it('keeps a constant column the chart draws, a number, and every column of a single row', () => {
    const bar = tidyWidget({ ...table, kind: 'bar', x: 'period', y: ['room_nights'], rows, columns });
    expect(byKey(bar.columns, 'period').hidden).toBeUndefined();
    const same = rows.map((row) => ({ ...row, share_pct: 10 }));
    expect(byKey(tidyWidget({ ...table, rows: same, columns }).columns, 'share_pct').hidden).toBeUndefined();
    const one = tidyWidget({ ...table, rows: rows.slice(0, 1), columns });
    expect(byKey(one.columns, 'period').hidden).toBeUndefined();
    expect(one.subtitle).toBe('All 20 hotels');
  });

  it('names a constant hotel by its name, and leaves the subtitle alone when it already names it', () => {
    const hotelColumns: EvidenceColumn[] = [{ key: 'hotel_code', label: 'Hotel', kind: 'hotel' }, ...columns.slice(1)];
    const hotelRows = rows.map(({ period: _p, ...row }) => ({ ...row, hotel_code: 'LON2' }));
    const name = (code: string) => (code === 'LON2' ? 'Kestrel London Canary Wharf' : undefined);
    const named = tidyWidget({ ...table, subtitle: 'Last 90 days', rows: hotelRows, columns: hotelColumns }, { hotelName: name });
    expect(named.subtitle).toBe('Last 90 days · Kestrel London Canary Wharf');
    expect(byKey(named.columns, 'hotel_code').hidden).toBe(true);
    const stated = tidyWidget({ ...table, subtitle: 'Kestrel London Canary Wharf · last 90 days', rows: hotelRows, columns: hotelColumns }, { hotelName: name });
    expect(stated.subtitle).toBe('Kestrel London Canary Wharf · last 90 days');
    // Without names (the server), a hotel is never written as its code.
    expect(tidyWidget({ ...table, subtitle: 'Last 90 days', rows: hotelRows, columns: hotelColumns }).subtitle).toBe('Last 90 days');
  });

  it('is idempotent and returns the same columns when there is nothing to tidy', () => {
    const once = tidyWidget({ ...table, rows, columns });
    const twice = tidyWidget({ ...table, ...once, rows });
    expect(twice).toEqual(once);
    const clean = [columns[1]!, columns[3]!];
    expect(tidyWidget({ ...table, rows, columns: clean }).columns).toBe(clean);
  });

  it('keeps the subtitle within its 140 characters', () => {
    const long = 'x'.repeat(130);
    expect(tidyWidget({ ...table, subtitle: long, rows, columns }).subtitle).toBe(long);
  });
});
