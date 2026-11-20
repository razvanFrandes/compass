import type { BriefItem } from '@compass/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateBrief, parseSummaries, type BriefWriter } from '../src/application/brief.ts';
import { openPostgres, type PostgresDb } from '../src/infrastructure/postgres.ts';

process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);

let db: PostgresDb;
beforeAll(() => {
  db = openPostgres(process.env['DATABASE_URL']!);
});
afterAll(() => db.close());

describe('parseSummaries', () => {
  it('reads the JSON object even with text around it, and keeps only known ids', () => {
    const text = 'Here you go:\n```json\n{"a": "First.", "b": "  Second. ", "zzz": "unknown"}\n```';
    expect(parseSummaries(text, ['a', 'b', 'c'])).toEqual({ a: 'First.', b: 'Second.' });
  });

  it('returns nothing for a reply that is not JSON', () => {
    expect(parseSummaries('Sorry, I cannot.', ['a'])).toEqual({});
  });
});

describe('generateBrief', () => {
  it('adds the writer’s sentences to the detected items', async () => {
    let seen: BriefItem[] = [];
    const writer: BriefWriter = {
      async summarize(items) {
        seen = items;
        return { summaries: Object.fromEntries(items.map((i) => [i.id, `About ${i.hotel_code}.`])), model: 'test', usage: { tokens: 10, costUsd: 0.001 } };
      },
    };
    const brief = await generateBrief(db, writer, new Date('2026-11-20T05:00:00Z'));
    expect(brief.businessDate).toBe('2026-11-20');
    expect(brief.items.length).toBe(seen.length);
    expect(brief.items[0]!.summary).toBe(`About ${brief.items[0]!.hotel_code}.`);
    expect(brief.model).toBe('test');
  });

  it('still ships the brief, with titles only, when the writer fails', async () => {
    const writer: BriefWriter = {
      summarize: () => Promise.reject(new Error('model down')),
    };
    const brief = await generateBrief(db, writer);
    expect(brief.items.length).toBeGreaterThan(0);
    expect(brief.items.every((i) => i.summary === undefined && i.title.length > 0)).toBe(true);
    expect(brief.model).toBeNull();
  });
});
