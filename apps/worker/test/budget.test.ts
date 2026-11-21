import { describe, expect, it } from 'vitest';
import { DEFAULT_DAILY_LIMITS, emptyBudget, parseDailyLimits, spend } from '../src/domain/budget.ts';

const at = (iso: string) => new Date(iso);

describe('parseDailyLimits', () => {
  it('uses the defaults when nothing is configured', () => {
    expect(parseDailyLimits(undefined)).toEqual(DEFAULT_DAILY_LIMITS);
  });

  it('takes configured limits and keeps the default for the rest', () => {
    expect(parseDailyLimits({ question: 50 })).toEqual({ ...DEFAULT_DAILY_LIMITS, question: 50 });
  });

  it('accepts a JSON string, as a secret or a dashboard variable would be', () => {
    expect(parseDailyLimits('{"workflow_run": 3}')).toEqual({ ...DEFAULT_DAILY_LIMITS, workflow_run: 3 });
  });

  it('ignores invalid values instead of failing open', () => {
    expect(parseDailyLimits({ question: -1, decision: 'lots', brief_refresh: 2.5 })).toEqual(DEFAULT_DAILY_LIMITS);
    expect(parseDailyLimits('not json')).toEqual(DEFAULT_DAILY_LIMITS);
  });
});

describe('the voice budget', () => {
  it('caps the temporary speech-to-text keys of a day, and can be changed or switched off like the others', () => {
    expect(DEFAULT_DAILY_LIMITS.voice).toBe(300);
    expect(parseDailyLimits({ voice: 5 }).voice).toBe(5);
    const spent = spend({ day: '2026-11-21', used: { voice: 5 } }, 'voice', parseDailyLimits({ voice: 5 }), new Date('2026-11-21T10:00:00Z'));
    expect(spent.decision).toMatchObject({ ok: false, kind: 'voice', limit: 5, remaining: 0 });
    expect(spend(emptyBudget(), 'voice', parseDailyLimits({ voice: 0 }), new Date('2026-11-21T10:00:00Z')).decision.ok).toBe(false);
  });
});

describe('the embedding budget', () => {
  it('allows 2000 semantic searches a day by default and can be configured', () => {
    expect(DEFAULT_DAILY_LIMITS.embedding).toBe(2000);
    expect(parseDailyLimits({ embedding: 10 }).embedding).toBe(10);
  });
});

describe('the conversation title budget', () => {
  it('defaults to 300 a day and can be set', () => {
    expect(DEFAULT_DAILY_LIMITS.thread_title).toBe(300);
    expect(parseDailyLimits({ thread_title: 2 }).thread_title).toBe(2);
    const { decision } = spend(emptyBudget(), 'thread_title', { ...DEFAULT_DAILY_LIMITS, thread_title: 0 }, new Date('2026-11-20T10:00:00Z'));
    expect(decision.ok).toBe(false);
  });
});

describe('the board budget', () => {
  it('allows 600 board changes a day by default, apart from the questions', () => {
    expect(DEFAULT_DAILY_LIMITS.board_write).toBe(600);
    expect(parseDailyLimits({ board_write: 5 }).board_write).toBe(5);
    const { state, decision } = spend(emptyBudget(), 'board_write', { ...DEFAULT_DAILY_LIMITS, board_write: 1 }, new Date('2026-11-20T10:00:00Z'));
    expect(decision).toMatchObject({ ok: true, kind: 'board_write', remaining: 0 });
    expect(spend(state, 'board_write', { ...DEFAULT_DAILY_LIMITS, board_write: 1 }, new Date('2026-11-20T10:00:01Z')).decision.ok).toBe(false);
    expect(spend(state, 'question', DEFAULT_DAILY_LIMITS, new Date('2026-11-20T10:00:01Z')).decision.ok).toBe(true);
  });
});

describe('spend', () => {
  const limits = { ...DEFAULT_DAILY_LIMITS, question: 2 };

  it('counts each use per UTC day until the limit, then refuses', () => {
    let state = emptyBudget();
    const now = at('2026-11-20T10:00:00Z');
    const first = spend(state, 'question', limits, now);
    expect(first.decision).toMatchObject({ ok: true, used: 1, limit: 2, remaining: 1 });
    state = first.state;
    const second = spend(state, 'question', limits, now);
    expect(second.decision).toMatchObject({ ok: true, used: 2, remaining: 0 });
    state = second.state;
    const third = spend(state, 'question', limits, now);
    expect(third.decision).toMatchObject({ ok: false, used: 2, remaining: 0, resetsAt: '2026-11-21T00:00:00.000Z' });
    // A refusal does not count.
    expect(third.state.used.question).toBe(2);
  });

  it('keeps each kind separate', () => {
    const { state } = spend(emptyBudget(), 'question', limits, at('2026-11-20T10:00:00Z'));
    expect(spend(state, 'workflow_run', limits, at('2026-11-20T10:00:00Z')).decision.used).toBe(1);
  });

  it('starts again at midnight UTC', () => {
    let { state } = spend(emptyBudget(), 'question', limits, at('2026-11-20T23:59:00Z'));
    state = spend(state, 'question', limits, at('2026-11-20T23:59:30Z')).state;
    expect(spend(state, 'question', limits, at('2026-11-20T23:59:59Z')).decision.ok).toBe(false);
    const next = spend(state, 'question', limits, at('2026-11-21T00:00:01Z'));
    expect(next.decision).toMatchObject({ ok: true, used: 1 });
    expect(next.state.day).toBe('2026-11-21');
  });

  it('refuses everything of a kind whose limit is 0', () => {
    expect(spend(emptyBudget(), 'brief_refresh', { ...limits, brief_refresh: 0 }, at('2026-11-20T10:00:00Z')).decision.ok).toBe(false);
  });
});

describe('budgetExceeded', () => {
  it('answers 429 with a plain message, the reset time and Retry-After', async () => {
    const { budgetExceeded } = await import('../src/presentation/http/budget-response.ts');
    const response = budgetExceeded(
      { ok: false, kind: 'question', used: 300, limit: 300, remaining: 0, resetsAt: '2026-11-21T00:00:00.000Z' },
      new Date('2026-11-20T23:00:00Z'),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('3600');
    const body = (await response.json()) as { error: string; resetsAt: string };
    expect(body.error).toBe('Today’s limit of 300 questions for this demo is used up. It resets at midnight UTC.');
    expect(body.resetsAt).toBe('2026-11-21T00:00:00.000Z');
  });

  it('names board changes in plain words', async () => {
    const { budgetMessage } = await import('../src/presentation/http/budget-response.ts');
    expect(budgetMessage({ ok: false, kind: 'board_write', used: 600, limit: 600, remaining: 0, resetsAt: '' })).toBe(
      'Today’s limit of 600 board changes for this demo is used up. It resets at midnight UTC.',
    );
  });
});
