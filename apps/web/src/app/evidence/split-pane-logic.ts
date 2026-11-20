/*
  The arithmetic of a two-pane split, kept apart from the component so it can be tested without a layout engine.
  The divider's position is the share of the width the first pane takes, in percent: it is what
  `aria-valuenow` reports, so Left makes the first pane narrower and Right makes it wider.
*/

export interface SplitLimits {
  /** The least width of the first pane, in px. */
  minStart: number;
  /** The least width of the second pane, in px. */
  minEnd: number;
}

/** How far the divider can go, in percent of the width. */
export interface SplitRange {
  min: number;
  max: number;
}

export interface SplitState {
  /** Null means "wherever the default is": a reset is remembered as a reset, not as a number. */
  position: number | null;
  collapsed: boolean;
}

export type SplitKeyAction = { type: 'move'; position: number } | { type: 'toggle' } | null;

export const SPLIT_STEP = 2;
export const SPLIT_BIG_STEP = 10;

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * The divider's range for a container of `width` px. With no width yet (not measured) the full 10–90% is allowed;
 * when both minimums cannot fit, the divider is pinned where the first pane keeps its minimum.
 */
export function splitRange(width: number, limits: SplitLimits): SplitRange {
  if (!(width > 0)) return { min: 10, max: 90 };
  const min = Math.min(100, round1((limits.minStart / width) * 100));
  const max = Math.max(0, round1(100 - (limits.minEnd / width) * 100));
  return max >= min ? { min, max } : { min, max: min };
}

export function clampPosition(position: number, range: SplitRange): number {
  if (!Number.isFinite(position)) return range.min;
  return round1(Math.min(range.max, Math.max(range.min, position)));
}

/** The divider's position under the pointer. */
export function positionFromPointer(clientX: number, box: { left: number; width: number }, range: SplitRange): number {
  if (!(box.width > 0)) return range.min;
  return clampPosition(((clientX - box.left) / box.width) * 100, range);
}

/**
 * What a key does on the divider (WAI-ARIA window splitter): Left and Right move it by a step (Shift: a big
 * step), Home and End go to the limits, Enter collapses or restores the second pane. Any other key: null.
 */
export function splitKey(key: string, position: number, range: SplitRange, options: { shift?: boolean } = {}): SplitKeyAction {
  const step = options.shift ? SPLIT_BIG_STEP : SPLIT_STEP;
  switch (key) {
    case 'ArrowLeft':
      return { type: 'move', position: clampPosition(position - step, range) };
    case 'ArrowRight':
      return { type: 'move', position: clampPosition(position + step, range) };
    case 'Home':
      return { type: 'move', position: range.min };
    case 'End':
      return { type: 'move', position: range.max };
    case 'Enter':
      return { type: 'toggle' };
    default:
      return null;
  }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const storageOrNull = (): StorageLike | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** The remembered split, or null when there is none, it is unreadable, or storage is blocked. */
export function readSplit(key: string | null | undefined, storage: StorageLike | null = storageOrNull()): SplitState | null {
  if (!key || !storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SplitState> | null;
    if (typeof value !== 'object' || value === null) return null;
    const position = typeof value.position === 'number' && Number.isFinite(value.position) && value.position > 0 && value.position < 100 ? value.position : null;
    return { position, collapsed: value.collapsed === true };
  } catch {
    return null;
  }
}

/** Remembers the split. Storage that refuses (private mode, quota) is ignored: the split lasts for this visit. */
export function writeSplit(key: string | null | undefined, state: SplitState, storage: StorageLike | null = storageOrNull()): void {
  if (!key || !storage) return;
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch {
    /* not remembered this time */
  }
}
