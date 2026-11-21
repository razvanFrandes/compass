import type { BoardWidget, ChatWidget } from './api';
import { tidyBoardWidget, tidyChatWidget } from './widget-tidy';

// Widgets saved before the server tidied them (and any that slip past it): the web hides a column that says the
// same on every row, states it once in the subtitle, and never repeats a unit the label says.
const columns: ChatWidget['columns'] = [
  { key: 'period', label: 'Period from', kind: 'date' },
  { key: 'key', label: 'Segment', kind: 'text' },
  { key: 'room_nights', label: 'Room nights', kind: 'count', unit: 'room nights' },
];
const rows = [
  { period: '2026-11-21', key: 'RET', room_nights: 115311 },
  { period: '2026-11-21', key: 'COR', room_nights: 59661 },
];
const evidence: ChatWidget['evidence'] = { sources: [], definitions: {}, period: null, sql: '', params: [], rowCount: 2, businessDate: '2026-11-20', notes: [] };
const owner: ChatWidget = { kind: 'table', title: 'Corporate is losing share', subtitle: 'All 20 hotels', sourceCallId: 'c1', rows, columns, evidence };

describe('tidyChatWidget', () => {
  it('fixes the owner\'s segment mix table: no "Period from" column, no "Room nights (room nights)"', () => {
    const tidy = tidyChatWidget(owner);
    expect(tidy.columns.find((c) => c.key === 'period')!.hidden).toBe(true);
    expect(tidy.subtitle).toBe('All 20 hotels · Period from Sat 21 Nov 2026');
    expect(tidy.columns.find((c) => c.key === 'room_nights')).toEqual({ key: 'room_nights', label: 'Room nights', kind: 'count' });
    expect(tidy.rows).toBe(rows);
  });

  it('names a hotel that is the same on every row, never its code', () => {
    const one: ChatWidget = { ...owner, subtitle: 'Last 90 days', rows: rows.map((r) => ({ ...r, period: undefined, hotel_code: 'LIS' })), columns: [{ key: 'hotel_code', label: 'Hotel', kind: 'hotel' }, ...columns.slice(1)] };
    expect(tidyChatWidget(one).subtitle).toBe('Last 90 days · Arbor Lisbon Chiado');
  });

  it('returns the same object when there is nothing to tidy, and the same tidy object each time', () => {
    const clean: ChatWidget = { ...owner, columns: [columns[1]!], rows: rows.map(({ key }) => ({ key })) };
    expect(tidyChatWidget(clean)).toBe(clean);
    expect(tidyChatWidget(owner)).toBe(tidyChatWidget(owner));
  });
});

describe('tidyBoardWidget', () => {
  it('tidies a saved board widget the same way', () => {
    const { rows: r, columns: c, evidence: e, ...spec } = owner;
    const saved = { id: 'w1', spec, rows: r, columns: c, evidence: e, addedAt: '2026-11-21T10:00:00Z' } as BoardWidget;
    const tidy = tidyBoardWidget(saved);
    expect(tidy.spec.subtitle).toBe('All 20 hotels · Period from Sat 21 Nov 2026');
    expect(tidy.columns.find((col) => col.key === 'period')!.hidden).toBe(true);
    expect(tidy.id).toBe('w1');
  });
});
