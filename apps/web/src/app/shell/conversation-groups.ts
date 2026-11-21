import type { ThreadKind } from '@compass/contracts';

/** A section of the sidebar's conversations: Today, Yesterday, Earlier. */
export interface DayGroup<T> {
  label: 'Today' | 'Yesterday' | 'Earlier';
  items: T[];
}

const DAY = 86_400_000;
const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const date = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Groups by the calendar day of `at` (local time), keeping the given order inside a group. Empty groups are left out. */
export function groupByDay<T extends { at: number }>(items: readonly T[], now: number): DayGroup<T>[] {
  const today = startOfDay(now);
  const groups: DayGroup<T>[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ];
  for (const item of items) {
    const index = item.at >= today ? 0 : item.at >= today - DAY ? 1 : 2;
    groups[index]!.items.push(item);
  }
  return groups.filter((group) => group.items.length);
}

/** When a conversation was last asked something, for its tooltip: "Today at 09:05", "Thu 12 Nov at 10:00". */
export function threadTime(at: number, now: number): string {
  const today = startOfDay(now);
  const day = at >= today ? 'Today' : at >= today - DAY ? 'Yesterday' : date.format(at).replace(',', '');
  return `${day} at ${clock.format(at)}`;
}

/** The small icon of a conversation: what its first answer showed, or the hotel it is about. */
export function threadIcon(meta: { kind?: ThreadKind; hotel?: string | null }): string {
  if (meta.kind === 'chart') return 'phosphorChartBarLight';
  if (meta.kind === 'table') return 'phosphorTableLight';
  return meta.hotel ? 'phosphorBuildingsLight' : 'phosphorChatTextLight';
}
