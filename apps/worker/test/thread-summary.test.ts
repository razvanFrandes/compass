import type { ChatEntry } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import {
  answerKind,
  fallbackTitle,
  firstExchange,
  parseThreadSummary,
  renameMeta,
  summarizeThread,
  THREAD_SUMMARY_PROMPT,
  type ThreadSummaryWriter,
} from '../src/application/thread-summary.ts';

const user = (id: number, text: string): ChatEntry => ({ id, kind: 'user', text, at: id });
const assistant = (id: number, text: string, stopReason = 'stop'): ChatEntry => ({
  id,
  kind: 'assistant',
  text,
  toolCalls: [],
  model: 'm',
  usage: { tokens: 0, costUsd: 0 },
  stopReason,
  at: id,
});
const widget = (id: number, kind: string, title: string): ChatEntry =>
  ({ id, kind: 'tool_result', callId: `c${id}`, name: 'show_widget', isError: false, widget: { kind, title }, at: id }) as unknown as ChatEntry;

const writer = (reply: string | Error) => {
  const calls: unknown[] = [];
  const w: ThreadSummaryWriter = {
    async write(input) {
      calls.push(input);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return { w, calls };
};

describe('fallbackTitle', () => {
  it.each([
    ['How is Tessera Dubai doing on corporate? (Tessera Dubai · MTD)', 'How is Tessera Dubai doing on corporate'],
    ['  salut.  ', 'Salut'],
    ['why   is pace down?!', 'Why is pace down'],
    ['', 'New conversation'],
  ])('%j → %j', (question, title) => {
    expect(fallbackTitle(question)).toBe(title);
  });

  it('cuts a long question at a word, with an ellipsis, under 60 characters', () => {
    const title = fallbackTitle('Compare the average daily rate of every Arbor hotel in Europe against the comp set over the last ninety days');
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toMatch(/\s…$/);
  });
});

describe('parseThreadSummary', () => {
  it('reads the JSON the model writes, even inside a fence', () => {
    expect(parseThreadSummary('```json\n{"title":"Tessera Dubai: business mix","summary":"Corporate down 12% vs last year"}\n```')).toEqual({
      ok: true,
      value: { title: 'Tessera Dubai: business mix', summary: 'Corporate down 12% vs last year' },
    });
  });

  it('trims, drops a final period and quotes, and caps the lengths', () => {
    const r = parseThreadSummary(JSON.stringify({ title: ' "Pace in Lisbon." ', summary: `${'x'.repeat(200)}.` }));
    expect(r.ok && r.value.title).toBe('Pace in Lisbon');
    expect(r.ok && r.value.summary!.length).toBeLessThanOrEqual(80);
  });

  it('keeps an empty summary as null', () => {
    expect(parseThreadSummary('{"title":"Quick hello","summary":""}')).toEqual({ ok: true, value: { title: 'Quick hello', summary: null } });
  });

  it('refuses text without a title', () => {
    expect(parseThreadSummary('Sure! Here is a title').ok).toBe(false);
    expect(parseThreadSummary('{"summary":"x"}').ok).toBe(false);
  });
});

describe('answerKind', () => {
  it('is a chart when the answer drew one, a table for a table, else text', () => {
    expect(answerKind([{ kind: 'table', title: '' }, { kind: 'line', title: '' }])).toBe('chart');
    expect(answerKind([{ kind: 'table', title: '' }])).toBe('table');
    expect(answerKind([{ kind: 'kpi_row', title: '' }])).toBe('chart');
    expect(answerKind([])).toBe('text');
  });
});

describe('firstExchange', () => {
  it('is the first question and the final answer that followed, with its widgets', () => {
    const entries = [user(1, 'How is pace?'), assistant(2, '', 'toolUse'), widget(3, 'bar', 'Pace by hotel'), assistant(4, 'Pace is up 3%.'), user(5, 'And Lisbon?')];
    expect(firstExchange(entries)).toEqual({ question: 'How is pace?', answer: 'Pace is up 3%.', widgets: [{ kind: 'bar', title: 'Pace by hotel' }] });
  });

  it('is null until the first answer is final', () => {
    expect(firstExchange([user(1, 'How is pace?'), assistant(2, '', 'toolUse')])).toBeNull();
    expect(firstExchange([])).toBeNull();
  });
});

describe('summarizeThread', () => {
  const exchange = { question: 'How is Tessera Dubai Business Bay doing on business mix?', answer: 'Corporate is down 12% on last year…', widgets: [{ kind: 'bar', title: 'Mix by segment' }] };

  it('asks the writer once and returns its title and takeaway, with the kind and the hotel', async () => {
    const { w, calls } = writer('{"title":"Tessera Dubai: business mix","summary":"Corporate down 12% vs last year"}');
    const meta = await summarizeThread(w, exchange, ['DXB2']);
    expect(meta).toEqual({ title: 'Tessera Dubai: business mix', summary: 'Corporate down 12% vs last year', kind: 'chart', hotel: 'DXB2', renamed: false });
    expect(calls).toHaveLength(1);
  });

  it('names no hotel when the scope is several hotels or the whole group', async () => {
    const { w } = writer('{"title":"Group pace","summary":"Up 3%"}');
    expect((await summarizeThread(w, exchange, ['LIS', 'AMS'])).hotel).toBeNull();
    expect((await summarizeThread(w, exchange, [])).hotel).toBeNull();
  });

  it('falls back to the cleaned question when the model fails or writes nonsense', async () => {
    const failing = await summarizeThread(writer(new Error('gateway down')).w, exchange, []);
    expect(failing).toEqual({ title: 'How is Tessera Dubai Business Bay doing on business mix', summary: null, kind: 'chart', hotel: null, renamed: false });
    expect((await summarizeThread(writer('no json here').w, exchange, [])).title).toBe(failing.title);
  });

  it('without a writer (no budget left), uses the fallback and calls nothing', async () => {
    expect((await summarizeThread(null, { question: 'Salut.', answer: 'Bună!', widgets: [] }, [])).title).toBe('Salut');
  });

  it('keeps a title the person gave', async () => {
    const { w } = writer('{"title":"Model title","summary":"Takeaway"}');
    const meta = await summarizeThread(w, exchange, [], { title: 'My title', renamed: true });
    expect(meta.title).toBe('My title');
    expect(meta.summary).toBe('Takeaway');
    expect(meta.renamed).toBe(true);
  });

  it('tells the model to be short and plain, and to title small talk too', () => {
    expect(THREAD_SUMMARY_PROMPT).toMatch(/JSON/);
    expect(THREAD_SUMMARY_PROMPT).toMatch(/small talk|greeting/i);
    expect(THREAD_SUMMARY_PROMPT).toMatch(/never invent/i);
  });
});

describe('renameMeta', () => {
  it('sets the title and marks it as the person’s, keeping the rest', () => {
    const before = { title: 'A', summary: 'S', kind: 'chart' as const, hotel: null, renamed: false };
    expect(renameMeta(before, '  Dubai   corporate  ')).toEqual({ ok: true, value: { ...before, title: 'Dubai corporate', renamed: true } });
  });

  it('starts a meta when there is none yet', () => {
    expect(renameMeta(null, 'Mine')).toEqual({ ok: true, value: { title: 'Mine', summary: null, kind: 'text', hotel: null, renamed: true } });
  });

  it('refuses an empty or too long title', () => {
    expect(renameMeta(null, '   ').ok).toBe(false);
    expect(renameMeta(null, 'x'.repeat(121)).ok).toBe(false);
  });
});
