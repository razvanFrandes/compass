import { DOCUMENT, Service, computed, inject, signal, type Signal } from '@angular/core';

/** Where the choice is remembered: "collapsed" or "expanded". Nothing is stored until the person chooses. */
export const SIDEBAR_STORAGE_KEY = 'compass.sidebar';
/** Widths of the two states, in px. The shell's grid and the sidebar's own layout both read them. */
export const SIDEBAR_WIDTH = 256;
export const RAIL_WIDTH = 64;
/** From a rail item's edge to what opens beside it (a tooltip, the Threads menu): 12 px of rail, then 6 px of air. */
export const RAIL_TIP_GAP = 18;
/** Below 1280 px the sidebar starts as a rail, so the main area keeps at least ~1150 px. */
const NARROW = '(max-width: 1279.98px)';
/** The sidebar exists from Tailwind's `lg` up; a phone has the menu sheet instead (shell/mobile-menu.ts). */
const DESKTOP = '(min-width: 1024px)';

type Choice = 'collapsed' | 'expanded';
const isChoice = (value: unknown): value is Choice => value === 'collapsed' || value === 'expanded';

/**
 * Whether the main sidebar is the full panel or the narrow icon rail. The person's choice wins and is remembered
 * in this browser; until there is one, the width of the window decides.
 */
@Service()
export class SidebarState {
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly choice = signal<Choice | null>(this.restore());
  private readonly narrow = this.media(NARROW, false);

  /** False on a phone, where the sidebar is not shown and its shortcut does nothing. */
  readonly available = this.media(DESKTOP, true);
  readonly collapsed = computed(() => (this.choice() ?? (this.narrow() ? 'collapsed' : 'expanded')) === 'collapsed');

  toggle() {
    this.set(!this.collapsed());
  }

  set(collapsed: boolean) {
    const choice: Choice = collapsed ? 'collapsed' : 'expanded';
    this.choice.set(choice);
    try {
      this.view?.localStorage.setItem(SIDEBAR_STORAGE_KEY, choice);
    } catch {
      // Private mode or blocked storage: the choice still holds for this visit.
    }
  }

  private restore(): Choice | null {
    try {
      const saved = this.view?.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return isChoice(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  /** A media query as a signal; `fallback` where there is no `matchMedia` (tests, old engines). */
  private media(query: string, fallback: boolean): Signal<boolean> {
    const list = this.view?.matchMedia?.(query);
    const matches = signal(list?.matches ?? fallback);
    list?.addEventListener?.('change', (event) => matches.set(event.matches));
    return matches.asReadonly();
  }
}

/** An element that takes typed text: a "[" pressed there is a character, not a command. */
function takesText(target: EventTarget | null): boolean {
  const el = target as (Partial<HTMLElement> & { closest?: Element['closest'] }) | null;
  if (!el || typeof el.closest !== 'function') return false;
  return el.isContentEditable === true || el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="searchbox"], [role="menu"], [role="listbox"]') !== null;
}

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'repeat' | 'defaultPrevented' | 'target'>;

/**
 * The keys that collapse or expand the sidebar: "[" on its own, and ⌘\ or Ctrl+\ from anywhere.
 * "[" is ignored while typing; a layout that needs AltGr for it (Ctrl+Alt on Windows) still works.
 */
export function isSidebarShortcut(event: ShortcutEvent): boolean {
  if (event.repeat || event.defaultPrevented) return false;
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && (event.key === '\\' || event.code === 'Backslash')) return true;
  if (event.key !== '[' || event.metaKey || (event.ctrlKey && !event.altKey)) return false;
  return !takesText(event.target);
}
