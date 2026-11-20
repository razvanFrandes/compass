import { agoShort } from './kassandra-thread-list';
import { boardNameFor } from './kassandra-board-picker';

describe('agoShort', () => {
  const now = Date.UTC(2026, 10, 20, 22, 0, 0);
  const minutes = (n: number) => now - n * 60_000;

  it('reads as the sidebar needs it: now, minutes, hours, then the day', () => {
    expect(agoShort(now, now)).toBe('now');
    expect(agoShort(minutes(0.9), now)).toBe('now');
    expect(agoShort(minutes(5), now)).toBe('5 min');
    expect(agoShort(minutes(59), now)).toBe('59 min');
    expect(agoShort(minutes(60 * 3 + 20), now)).toBe('3 h');
    expect(agoShort(minutes(60 * 26), now)).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
    expect(agoShort(minutes(60 * 24 * 9), now)).toMatch(/^1[012] Nov$/);
  });

  it('never shows a time in the future', () => {
    expect(agoShort(now + 5000, now)).toBe('now');
  });
});

describe('boardNameFor', () => {
  it('names a new board after the widget, cut at a word', () => {
    expect(boardNameFor('Channel mix')).toBe('Channel mix');
    expect(boardNameFor('Lisbon is 15.9% behind last year for December across every segment')).toBe('Lisbon is 15.9% behind last year for…');
    expect(boardNameFor('   ')).toBe('New board');
  });
});
