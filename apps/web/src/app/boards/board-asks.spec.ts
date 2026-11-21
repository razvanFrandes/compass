import type { WidgetKind } from '@compass/contracts';
import { boardSpan } from '../board';
import { BOARDS_ASKS, boardAsks } from './board-asks';

describe('board prompts', () => {
  it('offers the Boards page examples that build boards', () => {
    expect(BOARDS_ASKS.map((a) => a.question)).toContain('Build me a board for Lisbon’s pace and pickup');
    expect(BOARDS_ASKS.map((a) => a.question)).toContain('Show RevPAR by hotel against last year');
  });

  it('offers a board examples about its own hotels', () => {
    const asks = boardAsks(['DXB2'], (code) => (code === 'DXB2' ? 'Tessera Dubai Business Bay' : code));
    expect(asks.length).toBeGreaterThanOrEqual(3);
    for (const a of asks) expect(a.question).toContain('Tessera Dubai Business Bay');
  });

  it('names two hotels together, and the group when the board has none', () => {
    expect(boardAsks(['AMS', 'LIS'], (c) => c)[0]!.question).toContain('AMS and LIS');
    expect(boardAsks([], (c) => c)[0]!.question).toContain('all hotels');
  });
});

describe('boardSpan', () => {
  const w = (kind: WidgetKind, rows = 5, y?: string[]) => ({ spec: { kind, title: 'T', sourceCallId: 's', ...(y ? { y } : {}) }, rows: Array.from({ length: rows }, () => ({})) });

  it('gives narrow content half the row on a wide screen, never a full-width card of its own', () => {
    for (const kind of ['kpi', 'gauge', 'donut', 'pie', 'funnel', 'calendar_heatmap'] as const) expect(boardSpan(w(kind, 45)), kind).toContain('lg:col-span-6');
    expect(boardSpan(w('kpi'))).toContain('self-start');
  });

  it('gives wide charts the whole row: long series, tables, heatmaps, many bars', () => {
    expect(boardSpan(w('line', 45))).toBe('col-span-12');
    expect(boardSpan(w('table'))).toBe('col-span-12');
    expect(boardSpan(w('heatmap'))).toBe('col-span-12');
    expect(boardSpan(w('bar', 20))).toBe('col-span-12');
    expect(boardSpan(w('bar', 4))).toContain('lg:col-span-6');
    expect(boardSpan(w('line', 12))).toContain('lg:col-span-6');
  });
});
