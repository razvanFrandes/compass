import { describe, expect, it } from 'vitest';
import type { Db, Embedder } from '../src/application/ports.ts';
import {
  buildFindReviewsQuery,
  DEFAULT_K,
  findReviews,
  type FindReviewsRow,
  MIN_SIMILARITY,
  SENTENCE_SPLIT,
  shapeFindReviews,
} from '../src/application/review-search.ts';

// The pure parts of semantic review search: query building, result shaping and the flow, with no database.
// test/review-search.vm.test.ts runs the same code against the production database for the planted stories.

const coverage = { scope_reviews: 1220, scope_passages: 49, embedded_passages: 49, embedded_from: '2026-08-01', embedded_to: '2026-11-19' };
const match: FindReviewsRow = {
  sentiment: 'complaint',
  quote: 'Dinner took over an hour and room service never came.',
  similarity: 0.702,
  mentions: 350,
  share_pct: 28.7,
  first_date: '2026-10-06',
  last_date: '2026-11-19',
  mentions_by_hotel: { DPS: 350 },
  hotel_code: 'DPS',
  review_date: '2026-11-19',
  source: 'Google',
  overall_score: 6.8,
  review_text: 'The restaurant was clearly understaffed. Dinner took over an hour and room service never came.',
  ...coverage,
};
const noMatch: FindReviewsRow = Object.fromEntries(Object.keys(match).map((key) => [key, null])) as unknown as FindReviewsRow;

const fakeEmbedder = (vector = [0.6, 0.8]): Embedder & { calls: string[][] } => {
  const calls: string[][] = [];
  return { model: '@cf/baai/bge-m3', dimensions: vector.length, calls, embed: async (texts) => (calls.push([...texts]), texts.map(() => vector)) };
};
const fakeDb = (rows: unknown[] | Error): Db & { calls: { sql: string; params: readonly unknown[] }[] } => {
  const calls: { sql: string; params: readonly unknown[] }[] = [];
  return {
    calls,
    query: async <Row>(sql: string, params: readonly unknown[] = []) => {
      calls.push({ sql, params });
      if (rows instanceof Error) throw rows;
      return rows as Row[];
    },
  };
};

describe('buildFindReviewsQuery', () => {
  it('passes the vector as a pgvector literal and every filter as a parameter', () => {
    const query = buildFindReviewsQuery(
      { question: 'slow dinner', hotels: ['DPS'], from: '2026-10-01', to: '2026-11-19', sentiment: 'complaint', k: 5 },
      [0.25, -0.5],
      '@cf/baai/bge-m3',
      '2026-11-20',
    );
    expect(query.params).toEqual(['[0.25,-0.5]', ['DPS'], '2026-10-01', '2026-11-19', 'complaint', '@cf/baai/bge-m3', 5, MIN_SIMILARITY]);
    expect(query.period).toEqual({ from: '2026-10-01', to: '2026-11-19' });
  });

  it('defaults to the whole group, both sentiments, the last 90 days up to the business date and k = 8', () => {
    const query = buildFindReviewsQuery({ question: 'noise' }, [1], 'm', '2026-11-20');
    expect(query.params.slice(1, 5)).toEqual([null, '2026-08-22', '2026-11-20', 'any']);
    expect(query.k).toBe(DEFAULT_K);
  });

  it('counts the 90 days back from `to` when only `to` is given', () => {
    expect(buildFindReviewsQuery({ question: 'noise', to: '2026-03-01' }, [1], 'm', '2026-11-20').period).toEqual({ from: '2025-12-01', to: '2026-03-01' });
  });

  it('treats an empty hotel list as the whole group', () => {
    expect(buildFindReviewsQuery({ question: 'noise', hotels: [] }, [1], 'm', '2026-11-20').params[1]).toBeNull();
  });

  it('filters reviews by hotel, period and sentiment before ranking, with pgvector qualified for compass_ro', () => {
    const { sql } = buildFindReviewsQuery({ question: 'noise' }, [1], 'm', '2026-11-20');
    const scope = sql.slice(sql.indexOf('with reviews'), sql.indexOf('passages as'));
    expect(scope).toMatch(/hotel_code = any\(\$2::text\[\]\)/);
    expect(scope).toMatch(/review_date between \$3::date and \$4::date/);
    expect(scope).toMatch(/s\.sentiment = \$5::text/);
    expect(sql).toContain('operator(public.<=>) $1::public.vector');
    expect(sql).toContain(`regexp_split_to_table(btrim(s.review_text), '${SENTENCE_SPLIT}')`);
    expect(sql).not.toMatch(/\[\d/); // the vector is never inlined
  });
});

describe('SENTENCE_SPLIT', () => {
  it('splits a review side into sentences after . ! or ?', () => {
    const split = (text: string) => text.split(new RegExp(SENTENCE_SPLIT));
    expect(split('The restaurant was clearly understaffed. Dinner took over an hour and room service never came.')).toEqual([
      'The restaurant was clearly understaffed.',
      'Dinner took over an hour and room service never came.',
    ]);
    expect(split('Loud! Why? Fine.')).toEqual(['Loud!', 'Why?', 'Fine.']);
    expect(split('Room 3.5 stars')).toEqual(['Room 3.5 stars']);
  });
});

describe('shapeFindReviews', () => {
  const context = { model: '@cf/baai/bge-m3', question: 'slow dinner', period: { from: '2026-08-01', to: '2026-11-19' } };

  it('keeps the match columns as rows and turns coverage into a note', () => {
    const shaped = shapeFindReviews([match], context);
    expect(shaped.rows).toEqual([
      {
        sentiment: 'complaint',
        quote: match.quote,
        similarity: 0.702,
        mentions: 350,
        share_pct: 28.7,
        first_date: '2026-10-06',
        last_date: '2026-11-19',
        mentions_by_hotel: { DPS: 350 },
        hotel_code: 'DPS',
        review_date: '2026-11-19',
        source: 'Google',
        overall_score: 6.8,
        review_text: match.review_text,
      },
    ]);
    expect(shaped.rows[0]).not.toHaveProperty('scope_reviews');
    expect(shaped.notes.join(' ')).toContain('49 of 49 distinct sentences from 1220 reviews in scope are embedded (reviews dated 2026-08-01 to 2026-11-19)');
    expect(shaped.notes[0]).toContain('"slow dinner"');
  });

  it('reports coverage and a hint when nothing is close enough in meaning', () => {
    const shaped = shapeFindReviews([{ ...noMatch, ...coverage }], context);
    expect(shaped.rows).toEqual([]);
    expect(shaped.notes.join(' ')).toMatch(/49 of 49/);
    expect(shaped.notes.join(' ')).toMatch(/No sentence is close enough/);
  });

  it('says when there are no reviews at all in scope', () => {
    const shaped = shapeFindReviews([{ ...noMatch, scope_reviews: 0, scope_passages: 0, embedded_passages: 0 }], context);
    expect(shaped.notes.join(' ')).toMatch(/No reviews in scope for 2026-08-01 to 2026-11-19/);
  });

  it('shows partial coverage honestly', () => {
    const shaped = shapeFindReviews([{ ...match, embedded_passages: 30 }], context);
    expect(shaped.notes.join(' ')).toMatch(/30 of 49 distinct sentences/);
  });
});

describe('findReviews', () => {
  it('embeds the trimmed question once, queries and returns rows with evidence', async () => {
    const embedder = fakeEmbedder();
    const db = fakeDb([match]);
    const result = await findReviews(db, embedder, { question: '  slow dinner ', hotels: ['DPS'] }, '2026-11-20');
    expect(embedder.calls).toEqual([['slow dinner']]);
    expect(db.calls[0]!.params[0]).toBe('[0.6,0.8]');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(1);
    const ev = result.value.evidence;
    expect(ev.sources).toEqual(['hotel.reviews', 'hotel.review_passages']);
    expect(ev.period).toEqual({ from: '2026-08-22', to: '2026-11-20' });
    expect(ev.params[0]).toBe('<@cf/baai/bge-m3 embedding of "slow dinner">');
    expect(ev.params.slice(1)).toEqual([['DPS'], '2026-08-22', '2026-11-20', 'any', '@cf/baai/bge-m3', DEFAULT_K, MIN_SIMILARITY]);
    expect(ev.sql).not.toContain('\n');
    expect(ev.definitions['similarity']).toMatch(/bge-m3/);
    expect(ev.rowCount).toBe(1);
    expect(ev.businessDate).toBe('2026-11-20');
  });

  it('rejects an empty question or a reversed period without calling the model', async () => {
    const embedder = fakeEmbedder();
    expect((await findReviews(fakeDb([]), embedder, { question: '   ' }, '2026-11-20')).ok).toBe(false);
    const reversed = await findReviews(fakeDb([]), embedder, { question: 'noise', from: '2026-11-01', to: '2026-10-01' }, '2026-11-20');
    expect(reversed.ok ? null : reversed.error.kind).toBe('invalid');
    expect(embedder.calls).toHaveLength(0);
  });

  it('turns a model or database failure into an error the tool can report', async () => {
    const failing: Embedder = { model: 'm', dimensions: 1, embed: async () => Promise.reject(new Error('AI down')) };
    const modelDown = await findReviews(fakeDb([]), failing, { question: 'noise' }, '2026-11-20');
    expect(modelDown.ok ? null : modelDown.error.message).toMatch(/Could not embed the question: AI down/);
    const noStore = await findReviews(fakeDb(new Error('relation "hotel.review_passages" does not exist')), fakeEmbedder(), { question: 'noise' }, '2026-11-20');
    expect(noStore.ok ? null : noStore.error).toMatchObject({ kind: 'invalid', message: expect.stringMatching(/search_reviews/) });
    const dbDown = await findReviews(fakeDb(new Error('timeout')), fakeEmbedder(), { question: 'noise' }, '2026-11-20');
    expect(dbDown.ok ? null : dbDown.error).toEqual({ kind: 'database', message: 'timeout' });
  });
});
