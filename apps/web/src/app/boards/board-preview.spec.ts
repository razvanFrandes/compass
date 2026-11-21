import type { BoardWidgetPreview } from '@compass/contracts';
import { boardCard, previewItems, withPreview } from './board-preview-model';

const days = Array.from({ length: 45 }, (_, i) => ({ stay_date: new Date(Date.UTC(2026, 10, 20 + i)).toISOString().slice(0, 10), bar_vs_comp: 0.9 + (i % 10) / 50 }));
const item = (over: Partial<BoardWidgetPreview> & Pick<BoardWidgetPreview, 'spec'>): BoardWidgetPreview => ({ id: `w-${over.spec.kind}`, columns: [], rows: [], ...over });

const kpi = item({
  spec: { kind: 'kpi', title: 'Group occupancy against last year', sourceCallId: 't', y: ['value'], compare: 'compare_value', format: 'percent' },
  columns: [{ key: 'value', label: 'Occupancy', kind: 'percent' }, { key: 'compare_value', label: 'Occupancy, last year', kind: 'percent' }],
  rows: [{ value: 71.4, compare_value: 69.2 }],
});
const line = item({ spec: { kind: 'line', title: 'Occupancy by week', sourceCallId: 't', x: 'period', y: ['value'], compare: 'compare_value' }, rows: Array.from({ length: 12 }, (_, i) => ({ period: `2026-0${(i % 9) + 1}-01`, value: 60 + i, compare_value: 58 + i })) });
const bar = item({ spec: { kind: 'bar', title: 'RevPAR by hotel', sourceCallId: 't', x: 'key', y: ['value'] }, rows: [{ key: 'AMS', value: 120 }, { key: 'LIS', value: -20 }, { key: 'DXB2', value: 80 }] });
const donut = item({ spec: { kind: 'donut', title: 'Room nights by channel', sourceCallId: 't', group: 'key', y: ['room_nights'] }, rows: ['Direct', 'OTA', 'GDS', 'Wholesale', 'Corporate', 'Other'].map((key, i) => ({ key, room_nights: 60 - i * 8 })) });
const calendar = item({ spec: { kind: 'calendar_heatmap', title: 'Rate position by night', sourceCallId: 't', x: 'stay_date', y: ['bar_vs_comp'] }, rows: days });
const table = item({ spec: { kind: 'table', title: 'Revenue against budget', sourceCallId: 't', y: ['key', 'revenue_eur'] }, rows: [{ key: 'AMS', revenue_eur: 10 }, { key: 'LIS', revenue_eur: 5 }] });

describe('boardCard', () => {
  it('leads with the first KPI as the headline, with its change against the comparison', () => {
    const card = boardCard([line, kpi, bar]);
    expect(card.headline).toEqual({ label: 'Group occupancy against last year', value: '71.4%', delta: '▲ 2.2 pts', spoken: 'up 2.2 pts', versus: 'vs last year', tone: 'good' });
    expect(card.tiles.map((t) => t.kind)).toEqual(['line', 'bars']);
  });

  it('draws up to four tiles when there is no KPI, each by the shape of its widget', () => {
    const card = boardCard([line, bar, donut, calendar, table]);
    expect(card.headline).toBeNull();
    expect(card.tiles.map((t) => t.kind)).toEqual(['line', 'bars', 'donut', 'cells']);
  });

  it('draws three tiles under a headline', () => {
    expect(boardCard([kpi, line, bar, donut, calendar]).tiles).toHaveLength(3);
  });

  it('draws a line with its comparison', () => {
    const tile = boardCard([line]).tiles[0]!;
    expect(tile.kind === 'line' && tile.line.startsWith('M0.0,')).toBe(true);
    expect(tile.kind === 'line' && tile.cmp.length).toBeGreaterThan(0);
  });

  it('draws bars from a zero line, below it for a negative value', () => {
    const tile = boardCard([bar]).tiles[0]!;
    if (tile.kind !== 'bars') throw new Error(tile.kind);
    expect(tile.bars).toHaveLength(3);
    const [ams, lis] = tile.bars;
    expect(ams!.neg).toBe(false);
    expect(lis!.neg).toBe(true);
    expect(lis!.y).toBeCloseTo(tile.zero, 5);
  });

  it('folds the parts of a donut after the fourth into one', () => {
    const tile = boardCard([donut]).tiles[0]!;
    expect(tile.kind === 'donut' && tile.arcs).toHaveLength(5);
  });

  it('lays a calendar out by weekday and week', () => {
    const tile = boardCard([calendar]).tiles[0]!;
    if (tile.kind !== 'cells') throw new Error(tile.kind);
    expect(tile.cells).toHaveLength(45);
    expect(tile.rows).toBe(7);
    expect(new Set(tile.cells.map((c) => c.row)).size).toBe(7);
  });

  it('shows a table as rows', () => {
    expect(boardCard([table]).tiles[0]!.kind).toBe('rows');
  });

  it('skips widgets it cannot draw from their rows rather than drawing a blank', () => {
    const broken = item({ spec: { kind: 'line', title: 'Nothing', sourceCallId: 't', x: 'period', y: ['value'] }, rows: [] });
    expect(boardCard([broken, bar]).tiles.map((t) => t.kind)).toEqual(['bars']);
  });
});

describe('previewItems', () => {
  it('uses the server preview when the list has one', () => {
    expect(previewItems({ widgets: [], preview: [bar] })).toEqual([bar]);
  });

  it('builds it from the widgets when they carry rows (boards kept in this browser)', () => {
    const widget = { id: 'w-1', spec: bar.spec, rows: bar.rows, columns: [], evidence: {} as never, addedAt: '' };
    expect(previewItems({ widgets: [widget, widget, widget, widget, widget] })).toHaveLength(4);
  });

  it('has nothing to draw for a list without rows or preview', () => {
    expect(previewItems({ widgets: [{ id: 'w', spec: bar.spec, addedAt: '' } as never] })).toEqual([]);
  });
});

describe('withPreview', () => {
  it('keeps the preview in step with a widget added, removed or moved on this page', () => {
    const summary = (p: BoardWidgetPreview) => ({ id: p.id, spec: p.spec, addedAt: '' }) as never;
    const added = { id: 'w-new', spec: line.spec, rows: line.rows, columns: [], evidence: {} as never, addedAt: '' };
    const board = { widgets: [summary(donut), added, summary(bar)], preview: [bar, donut] };
    expect(withPreview(board).preview!.map((p) => p.id)).toEqual([donut.id, 'w-new', bar.id]);
  });
});
