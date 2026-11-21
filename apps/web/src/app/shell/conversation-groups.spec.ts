import { groupByDay, threadIcon, threadTime } from './conversation-groups';

// Fixed local times: Friday 21 Nov 2026, 15:30.
const NOW = new Date(2026, 10, 21, 15, 30).getTime();
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();

describe('groupByDay', () => {
  const threads = [
    { id: 'a', title: 'A', at: at(21, 9) },
    { id: 'b', title: 'B', at: at(21, 0, 5) },
    { id: 'c', title: 'C', at: at(20, 23, 59) },
    { id: 'd', title: 'D', at: at(12, 10) },
  ];

  it('puts each conversation under Today, Yesterday or Earlier, by the calendar day, newest first', () => {
    expect(groupByDay(threads, NOW).map((g) => [g.label, g.items.map((t) => t.id)])).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      ['Earlier', ['d']],
    ]);
  });

  it('leaves out a group with nothing in it', () => {
    expect(groupByDay([threads[3]!], NOW).map((g) => g.label)).toEqual(['Earlier']);
    expect(groupByDay([], NOW)).toEqual([]);
  });

  it('keeps the order it was given inside a group', () => {
    expect(groupByDay([threads[1]!, threads[0]!], NOW)[0]!.items.map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('threadTime', () => {
  it('says the time for today and yesterday, and the date before', () => {
    expect(threadTime(at(21, 9, 5), NOW)).toBe('Today at 09:05');
    expect(threadTime(at(20, 18, 40), NOW)).toBe('Yesterday at 18:40');
    expect(threadTime(at(12, 10), NOW)).toBe('Thu 12 Nov at 10:00');
  });
});

describe('threadIcon', () => {
  it('shows what the answer was: a chart, a table, a hotel, or words', () => {
    expect(threadIcon({ kind: 'chart' })).toBe('phosphorChartBarLight');
    expect(threadIcon({ kind: 'table' })).toBe('phosphorTableLight');
    expect(threadIcon({ kind: 'text', hotel: 'LIS' })).toBe('phosphorBuildingsLight');
    expect(threadIcon({ kind: 'text' })).toBe('phosphorChatTextLight');
    expect(threadIcon({})).toBe('phosphorChatTextLight');
  });
});
