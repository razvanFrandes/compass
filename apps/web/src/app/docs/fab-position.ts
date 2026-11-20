/*
  Where the floating Docs button sits. It starts in the bottom right corner and moves up when something it must
  not cover is there: a Kassandra composer, a toast, the phone tab bar. The rule is a pure function of rectangles,
  so it is tested without a browser.
*/

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface FabLayout {
  viewportHeight: number;
  /** The button's own box at rest: its horizontal extent and its height. */
  left: number;
  right: number;
  height: number;
  /** The distance from the bottom of the viewport when nothing is in the way. */
  base: number;
  /** The room kept between the button and what it avoids. */
  gap: number;
  obstacles: readonly Box[];
  /** Past this lift the button would float in the middle of the screen, so it stays at rest instead. */
  max: number;
}

const overlaps = (a: Box, b: Box, gap: number) => a.right > b.left - gap && a.left < b.right + gap && a.bottom > b.top - gap && a.top < b.bottom + gap;

/** The distance from the bottom of the viewport to the button's bottom edge. */
export function fabLift(l: FabLayout): number {
  let lift = l.base;
  // Moving above one obstacle can land on the next (a composer above the tab bar), so repeat until it is clear.
  for (let i = 0; i <= l.obstacles.length; i++) {
    const box: Box = { left: l.left, right: l.right, top: l.viewportHeight - lift - l.height, bottom: l.viewportHeight - lift };
    const hit = l.obstacles.find((o) => o.right > o.left && o.bottom > o.top && overlaps(box, o, l.gap));
    if (!hit) return lift;
    lift = Math.ceil(l.viewportHeight - hit.top + l.gap);
    if (lift > l.max) return l.base;
  }
  return lift;
}

/** True when a key press belongs to a field, so "?" typed into a question never opens the panel. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as (Element & { isContentEditable?: boolean }) | null;
  if (!el || typeof el.closest !== 'function') return false;
  if (el.isContentEditable) return true;
  return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="searchbox"]');
}
