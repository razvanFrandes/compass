import type { BoardWidgetPreview } from '@compass/contracts';
import { BOARD_PREVIEW } from '@compass/contracts/widget-fit';
import { buildWidget, context } from '../charts/builders';
import { cell, numberAt, pickValueKey } from '../charts/builders/shared';
import { num, parseDate } from '../charts/format';
import type { WidgetRow } from '../charts/widget-types';
import type { Board } from './types';

/*
  What a board's card on the Boards page draws: a headline figure (its first KPI, said like the built-in boards say
  theirs) and a small mosaic of its first widgets as tiny charts without axes, each by the shape of its widget. Every
  number comes from the widget's own rows; nothing is computed here but positions.
*/

/** The card's headline: a board's first KPI. */
export interface CardHeadline {
  label: string;
  value: string;
  /** "▲ 2.2 pts" (the arrow carries the direction), or null without a comparison. */
  delta: string | null;
  spoken: string;
  versus: string;
  tone: 'good' | 'bad' | 'flat';
}

/** Tiles draw in a 100 × 40 box. */
export const TILE_W = 100;
export const TILE_H = 40;

export type MiniTile =
  | { kind: 'line'; title: string; line: string; area: string; cmp: string }
  | { kind: 'bars'; title: string; zero: number; bars: { x: number; y: number; w: number; h: number; neg: boolean }[] }
  | { kind: 'donut'; title: string; arcs: { d: string; i: number }[] }
  | { kind: 'cells'; title: string; rows: number; cols: number; cells: { row: number; col: number; level: number }[] }
  | { kind: 'figure'; title: string; value: string }
  | { kind: 'rows'; title: string; widths: number[] };

export interface BoardCard {
  headline: CardHeadline | null;
  tiles: MiniTile[];
}

type ListedBoard = Pick<Board, 'widgets'> & { preview?: BoardWidgetPreview[] };

/** What a card draws: the server's preview, or (a board kept in this browser has its rows) its first widgets. */
export function previewItems(board: ListedBoard): BoardWidgetPreview[] {
  if (board.preview) return board.preview;
  return board.widgets
    .filter((w) => Array.isArray(w.rows) && w.rows.length)
    .slice(0, BOARD_PREVIEW.widgets)
    .map((w) => ({ id: w.id, spec: w.spec, columns: w.columns ?? [], rows: w.rows }));
}

/**
 * The board with its preview brought up to date after a change on this page (a widget added, removed or moved): the
 * previews it had, plus any widget it now holds with rows, for its first widgets in their order.
 */
export function withPreview<T extends ListedBoard>(board: T): T {
  if (!board.preview) return board;
  const known = new Map<string, BoardWidgetPreview>(board.preview.map((p) => [p.id, p]));
  for (const w of board.widgets) if (Array.isArray(w.rows) && w.rows.length) known.set(w.id, { id: w.id, spec: w.spec, columns: w.columns ?? [], rows: w.rows });
  const preview = board.widgets.slice(0, BOARD_PREVIEW.widgets).flatMap((w) => known.get(w.id) ?? []);
  return { ...board, preview };
}

export function boardCard(items: readonly BoardWidgetPreview[]): BoardCard {
  let headline: CardHeadline | null = null;
  let used: BoardWidgetPreview | null = null;
  for (const item of items) {
    if (item.spec.kind !== 'kpi') continue;
    headline = headlineOf(item);
    if (headline) {
      used = item;
      break;
    }
  }
  const room = headline ? 3 : 4;
  const tiles: MiniTile[] = [];
  for (const item of items) {
    if (item === used || tiles.length >= room) continue;
    const tile = tileOf(item);
    if (tile) tiles.push(tile);
  }
  return { headline, tiles };
}

function headlineOf(item: BoardWidgetPreview): CardHeadline | null {
  if (!item.rows.length) return null;
  const built = buildWidget({ spec: item.spec, rows: item.rows as WidgetRow[], columns: item.columns });
  if (built.render !== 'kpi') return null;
  const { value, delta, versus } = built.kpi;
  return { label: item.spec.title, value, delta: delta?.text ?? null, spoken: delta?.spoken ?? '', versus: delta ? versus : '', tone: delta?.tone ?? 'flat' };
}

function tileOf(item: BoardWidgetPreview): MiniTile | null {
  const rows = item.rows as WidgetRow[];
  if (!rows.length) return null;
  const c = context({ spec: item.spec, rows, columns: item.columns });
  const key = pickValueKey(c);
  const title = item.spec.title;
  switch (item.spec.kind) {
    case 'kpi':
    case 'kpi_row':
    case 'gauge': {
      const built = buildWidget({ spec: item.spec.kind === 'gauge' ? { ...item.spec, kind: 'kpi' } : item.spec, rows, columns: item.columns });
      const value = built.render === 'kpi' ? built.kpi.value : built.render === 'kpi_row' ? built.tiles[0]?.value : undefined;
      return value ? { kind: 'figure', title, value } : null;
    }
    case 'line':
    case 'area':
    case 'sparkline_list':
    case 'scatter': {
      const series = item.spec.group ? rows.filter((r) => cell(r, item.spec.group) === cell(rows[0], item.spec.group)) : rows;
      const values = series.map((r) => numberAt(r, key));
      const compare = item.spec.compare ? series.map((r) => numberAt(r, item.spec.compare)) : [];
      return lineTile(title, values, compare);
    }
    case 'pie':
    case 'donut':
    case 'treemap':
    case 'sankey':
      return donutTile(title, rows, item.spec.group ?? item.spec.x, key);
    case 'calendar_heatmap':
      return calendarTile(title, rows, item.spec.x, key);
    case 'heatmap':
      return heatTile(title, rows, item.spec.x, item.spec.group, key);
    case 'table':
      return { kind: 'rows', title, widths: rows.slice(0, 5).map((_, i) => [92, 74, 84, 66, 78][i]!) };
    default:
      return barTile(title, rows.map((r) => numberAt(r, key)));
  }
}

function lineTile(title: string, values: (number | null)[], compare: (number | null)[]): MiniTile | null {
  const ok = [...values, ...compare].filter((v): v is number => v !== null);
  if (values.filter((v) => v !== null).length < 2) return null;
  const lo = Math.min(...ok);
  const hi = Math.max(...ok);
  const span = hi - lo || 1;
  const x = (i: number, n: number) => (i / Math.max(1, n - 1)) * TILE_W;
  const y = (v: number) => (hi === lo ? TILE_H / 2 : TILE_H - 3 - ((v - lo) / span) * (TILE_H - 8));
  const path = (vs: (number | null)[]) => {
    let pen = 'M';
    return vs
      .map((v, i) => {
        if (v === null) {
          pen = 'M';
          return '';
        }
        const step = `${pen}${x(i, vs.length).toFixed(1)},${y(v).toFixed(1)}`;
        pen = 'L';
        return step;
      })
      .join('');
  };
  const line = path(values);
  const pts = values.map((v, i) => (v === null ? null : i)).filter((i): i is number => i !== null);
  const area = `${line}L${x(pts.at(-1)!, values.length).toFixed(1)},${TILE_H}L${x(pts[0]!, values.length).toFixed(1)},${TILE_H}Z`;
  return { kind: 'line', title, line, area, cmp: compare.some((v) => v !== null) ? path(compare) : '' };
}

function barTile(title: string, raw: (number | null)[]): MiniTile | null {
  const values = raw.slice(0, 24).map((v) => v ?? 0);
  if (!values.length || values.every((v) => v === 0)) return null;
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const top = 2;
  const usable = TILE_H - top;
  const zero = top + (hi / span) * usable;
  const slot = TILE_W / values.length;
  const w = Math.max(1.5, slot * (values.length > 12 ? 0.7 : 0.62));
  return {
    kind: 'bars',
    title,
    zero,
    bars: values.map((v, i) => {
      const h = Math.max(0.8, (Math.abs(v) / span) * usable);
      return { x: i * slot + (slot - w) / 2, y: v < 0 ? zero : zero - h, w, h, neg: v < 0 };
    }),
  };
}

function donutTile(title: string, rows: WidgetRow[], nameKey: string | undefined, key: string | undefined): MiniTile | null {
  const parts = rows.map((r) => ({ name: String(cell(r, nameKey) ?? ''), v: Math.max(0, numberAt(r, key) ?? 0) })).filter((p) => p.v > 0);
  if (!parts.length) return null;
  parts.sort((a, b) => b.v - a.v);
  const shown = parts.slice(0, 4).map((p) => p.v);
  const rest = parts.slice(4).reduce((s, p) => s + p.v, 0);
  const values = rest > 0 ? [...shown, rest] : shown;
  const total = values.reduce((s, v) => s + v, 0);
  const R = 17;
  const r = 10.5;
  const cx = 20;
  const cy = 20;
  let a = -Math.PI / 2;
  const at = (rad: number, angle: number) => `${(cx + rad * Math.cos(angle)).toFixed(2)},${(cy + rad * Math.sin(angle)).toFixed(2)}`;
  const gap = values.length > 1 ? 0.04 : 0;
  const arcs = values.map((v, i) => {
    const sweep = Math.min((v / total) * Math.PI * 2, Math.PI * 2 - 0.001);
    const from = a + gap / 2;
    const to = a + sweep - gap / 2;
    a += sweep;
    const large = to - from > Math.PI ? 1 : 0;
    return { d: `M${at(R, from)}A${R},${R} 0 ${large} 1 ${at(R, to)}L${at(r, to)}A${r},${r} 0 ${large} 0 ${at(r, from)}Z`, i: rest > 0 && i === values.length - 1 ? -1 : i };
  });
  return { kind: 'donut', title, arcs };
}

const DAY = 86_400_000;

function calendarTile(title: string, rows: WidgetRow[], xKey: string | undefined, key: string | undefined): MiniTile | null {
  const days = rows.map((r) => ({ t: parseDate(cell(r, xKey)), v: numberAt(r, key) })).filter((d): d is { t: number; v: number } => d.t !== null && d.v !== null);
  if (!days.length) return null;
  const first = Math.min(...days.map((d) => d.t));
  const offset = (new Date(first).getUTCDay() + 6) % 7;
  const levels = levelsOf(days.map((d) => d.v));
  const cells = days.map((d, i) => {
    const n = Math.round((d.t - first) / DAY) + offset;
    return { row: n % 7, col: Math.floor(n / 7), level: levels[i]! };
  });
  return { kind: 'cells', title, rows: 7, cols: Math.max(...cells.map((c) => c.col)) + 1, cells };
}

function heatTile(title: string, rows: WidgetRow[], xKey: string | undefined, yKey: string | undefined, key: string | undefined): MiniTile | null {
  const xs = [...new Set(rows.map((r) => String(cell(r, xKey) ?? '')))].slice(0, 16);
  const ys = [...new Set(rows.map((r) => String(cell(r, yKey) ?? '')))].slice(0, 7);
  const kept = rows.filter((r) => xs.includes(String(cell(r, xKey) ?? '')) && ys.includes(String(cell(r, yKey) ?? '')) && num(cell(r, key)) !== null);
  if (!kept.length) return null;
  const levels = levelsOf(kept.map((r) => numberAt(r, key)!));
  return { kind: 'cells', title, rows: ys.length, cols: xs.length, cells: kept.map((r, i) => ({ row: ys.indexOf(String(cell(r, yKey) ?? '')), col: xs.indexOf(String(cell(r, xKey) ?? '')), level: levels[i]! })) };
}

/** Each value's step, 0 to 4, between the lowest and the highest. */
function levelsOf(values: number[]): number[] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return values.map((v) => (hi > lo ? Math.round(((v - lo) / (hi - lo)) * 4) : 2));
}
