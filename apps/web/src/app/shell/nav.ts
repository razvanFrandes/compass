import type { View } from '../store';

/** A place in the main navigation: the sidebar on desktop, the menu sheet on a phone. */
export interface NavItem {
  view: View;
  label: string;
  /** Phosphor Light at rest, Fill for the current place. */
  icon: string;
  iconActive: string;
  /** What waits there; 0 shows no badge. */
  count: number;
}

/** A thread belongs to the Inbox, a board to Boards, a workflow's page to Agent Studio. */
export function isActiveNav(current: View, item: View): boolean {
  return current === item || (item === 'inbox' && current === 'thread') || (item === 'boards' && current === 'board') || (item === 'watchers' && current === 'watcher');
}
