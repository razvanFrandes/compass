import type { ChatEntry, ThreadKind, ThreadMeta } from '@compass/contracts';
import { err, ok, type Result } from '../domain/result.ts';

/**
 * A conversation's title and takeaway for the sidebar, written once after its first answer by the Quick model. The
 * model only rewords what the question and the answer already say: it computes nothing, and any failure falls back
 * to the cleaned question, so the sidebar never waits on it and never shows an error.
 */

/** What the writer is given: the first question, the final answer, and the widgets that answer showed. */
export interface ThreadExchange {
  question: string;
  answer: string;
  widgets: { kind: string; title: string }[];
}

/** The port to the Quick model: returns the model's raw text. Throws when the call fails. */
export interface ThreadSummaryWriter {
  write(input: ThreadExchange): Promise<string>;
}

export const TITLE_MAX = 48;
export const SUMMARY_MAX = 64;
export const RENAME_MAX = 120;

export const THREAD_SUMMARY_PROMPT = `You name conversations in the sidebar of Compass, a hotel analytics app for a revenue team.
You get the first question of a conversation, the assistant's answer and the titles of the charts it showed.
Reply with JSON only: {"title": "...", "summary": "..."}.
- title: what the conversation is about, 2 to 6 words, at most ${TITLE_MAX} characters, sentence case, no final period.
  Lead with the hotel or scope when there is one, then a colon: "Tessera Dubai: business mix", "Group: pace for December".
- summary: the answer's main takeaway in plain words, at most ${SUMMARY_MAX} characters, no final period: "Corporate down 12% vs last year".
  Use only numbers and facts written in the answer; never invent or compute one. If the answer has no takeaway, use "".
- For small talk or a greeting ("Salut.", "thanks"), give a short plain title such as "Quick hello" and an empty summary.
- Write in English, plainly. No emoji, no quotes, no marketing words.`;

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
/** Drops wrapping quotes and a final period, keeps "…" and "?"-free plain text. */
const tidy = (text: string) =>
  clean(text)
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\.+$/, '')
    .trim();

/** Cuts at a word so the text fits `max`, with an ellipsis. */
function fit(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[\s,;:–-]+$/, '');
  return `${cut || text.slice(0, max - 1)}…`;
}

/** The question as a title: no trailing scope in brackets, no final punctuation, a capital first letter, short. */
export function fallbackTitle(question: string): string {
  const base = clean(question)
    .replace(/\s*\([^()]*\)\s*$/, '')
    .replace(/[\s.?!…]+$/, '');
  if (!base) return 'New conversation';
  return fit(base.charAt(0).toUpperCase() + base.slice(1), 60);
}

/** The model's reply as a title and a takeaway, or why it cannot be read. */
export function parseThreadSummary(text: string): Result<{ title: string; summary: string | null }, string> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return err('no JSON object');
  let value: unknown;
  try {
    value = JSON.parse(match[0]);
  } catch {
    return err('invalid JSON');
  }
  const record = value as { title?: unknown; summary?: unknown } | null;
  const title = typeof record?.title === 'string' ? tidy(record.title) : '';
  if (!title) return err('no title');
  const summary = typeof record?.summary === 'string' ? tidy(record.summary) : '';
  return ok({ title: fit(title, TITLE_MAX + 12), summary: summary ? fit(summary, SUMMARY_MAX + 16) : null });
}

/** What the answer mainly showed: any chart or KPI wins over a table, and no widget is text. */
export function answerKind(widgets: ThreadExchange['widgets']): ThreadKind {
  if (widgets.some((w) => w.kind !== 'table')) return 'chart';
  return widgets.some((w) => w.kind === 'table') ? 'table' : 'text';
}

/** The first question and the first final answer after it, or null while there is none. */
export function firstExchange(entries: readonly ChatEntry[]): ThreadExchange | null {
  const first = entries.findIndex((e) => e.kind === 'user');
  if (first < 0) return null;
  const question = entries[first] as Extract<ChatEntry, { kind: 'user' }>;
  const widgets: ThreadExchange['widgets'] = [];
  for (const entry of entries.slice(first + 1)) {
    if (entry.kind === 'user') return null;
    if (entry.kind === 'tool_result' && entry.widget) widgets.push({ kind: entry.widget.kind, title: entry.widget.title });
    if (entry.kind === 'assistant' && entry.stopReason === 'stop' && entry.text.trim()) return { question: question.text, answer: entry.text, widgets };
  }
  return null;
}

/**
 * The meta of a conversation after its first answer. `writer` is null when the daily budget has nothing left: the
 * fallback is used and no model is called. A title the person already gave (`previous.renamed`) is kept.
 */
export async function summarizeThread(
  writer: ThreadSummaryWriter | null,
  exchange: ThreadExchange,
  hotels: readonly string[],
  previous?: Pick<ThreadMeta, 'title' | 'renamed'> | null,
): Promise<ThreadMeta> {
  let written: { title: string; summary: string | null } | null = null;
  if (writer) {
    try {
      const parsed = parseThreadSummary(await writer.write({ ...exchange, answer: exchange.answer.slice(0, 4000) }));
      if (parsed.ok) written = parsed.value;
      else console.warn('thread summary unreadable', parsed.error);
    } catch (error) {
      console.warn('thread summary failed', error instanceof Error ? error.message : error);
    }
  }
  const renamed = previous?.renamed === true;
  return {
    title: renamed ? previous.title : (written?.title ?? fallbackTitle(exchange.question)),
    summary: written?.summary ?? null,
    kind: answerKind(exchange.widgets),
    hotel: hotels.length === 1 ? hotels[0]! : null,
    renamed,
  };
}

/** A new name from the person: it replaces the title and is never overwritten by the model. */
export function renameMeta(previous: ThreadMeta | null, title: string): Result<ThreadMeta, string> {
  const name = clean(title);
  if (!name || name.length > RENAME_MAX) return err(`Send { title } (1–${RENAME_MAX} characters).`);
  return ok({ ...(previous ?? { summary: null, kind: 'text' as const, hotel: null }), title: name, renamed: true });
}
