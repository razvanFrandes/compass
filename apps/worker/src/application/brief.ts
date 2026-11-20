import type { Brief, BriefItem } from '@compass/contracts';
import { detectBriefItems } from './brief-detectors.ts';
import type { Db } from './ports.ts';

/** Writes the explanation sentence for each brief item. The model sees only the item's own facts. */
export interface BriefWriter {
  summarize(items: BriefItem[]): Promise<{ summaries: Record<string, string>; model: string; usage: { tokens: number; costUsd: number } }>;
}

export const BRIEF_SYSTEM_PROMPT = `You write the morning brief for the revenue team of Halcyon Hospitality Group (20 hotels).
For each item you get a deterministic finding: a title, its money impact in EUR, what the impact means, and the facts behind it.
Write one or two plain sentences per item that say what happened and why it matters for the hotel.
Rules: use only the numbers in that item's facts, impact and title; do not compute new numbers; do not speculate about causes the facts do not show; no greetings; British English.
Answer with only a JSON object mapping each item id to its sentence, e.g. {"pace_behind:LIS": "…"}.`;

/** Extracts the `{ id: sentence }` object from the model's reply, ignoring anything around it. */
export function parseSummaries(text: string, ids: readonly string[]): Record<string, string> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return {};
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    return Object.fromEntries(
      ids.filter((id) => typeof parsed[id] === 'string' && (parsed[id] as string).trim()).map((id) => [id, (parsed[id] as string).trim()]),
    );
  } catch {
    return {};
  }
}

/** Detects the items, then asks the writer to explain them. If the writer fails, the brief still ships with titles. */
export async function generateBrief(db: Db, writer: BriefWriter | null, now = new Date()): Promise<Brief> {
  const [items, [{ d: businessDate } = { d: '' }]] = await Promise.all([
    detectBriefItems(db),
    db.query<{ d: string }>(`select to_char(hotel.business_date(), 'YYYY-MM-DD') as d`),
  ]);
  let summaries: Record<string, string> = {};
  let model: string | null = null;
  let usage = { tokens: 0, costUsd: 0 };
  if (writer && items.length) {
    try {
      ({ summaries, model, usage } = await writer.summarize(items));
    } catch (error) {
      console.warn('brief writer failed', error);
    }
  }
  return {
    businessDate,
    generatedAt: now.toISOString(),
    items: items.map((item) => (summaries[item.id] ? { ...item, summary: summaries[item.id] } : item)),
    model,
    usage,
  };
}
