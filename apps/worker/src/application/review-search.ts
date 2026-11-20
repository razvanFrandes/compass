import type { DataResult, Evidence } from '@compass/contracts';
import { err, ok, type Result } from '../domain/result.ts';
import type { DataError } from './hotel-data.ts';
import type { Db, Embedder } from './ports.ts';

/**
 * Semantic search over guest reviews (RAG for unstructured text; numbers stay in SQL).
 *
 * Each review has two sides, `positive_text` (praise) and `negative_text` (complaint), chunked into sentences
 * (passages). Their embeddings live in hotel.review_passages, content-addressed by md5(sentence), so a sentence that
 * many reviews share is embedded once.
 * The search filters reviews by hotel, period and sentiment first, then ranks the distinct passages in that scope
 * by exact cosine distance to the question. Filtering first keeps every hit inside the asked scope (an HNSW scan
 * that filters afterwards can return fewer than k), and the filtered set is small: at most a few thousand distinct sentences.
 */

export type Sentiment = 'complaint' | 'praise' | 'any';

export interface FindReviewsInput {
  question: string;
  hotels?: string[];
  from?: string;
  to?: string;
  sentiment?: Sentiment;
  k?: number;
}

/** One distinct sentence (passage) that matches the question, with how often guests wrote it and its latest review. */
export interface ReviewMatch {
  sentiment: 'complaint' | 'praise';
  quote: string;
  similarity: number;
  mentions: number;
  share_pct: number;
  first_date: string;
  last_date: string;
  mentions_by_hotel: Record<string, number>;
  hotel_code: string;
  review_date: string;
  source: string;
  overall_score: number;
  /** The full positive_text or negative_text of that latest review, for context around the sentence. */
  review_text: string;
}

/** What the SQL returns: the coverage columns on every row, the match columns null when nothing matched. */
export type FindReviewsRow = { [K in keyof ReviewMatch]: ReviewMatch[K] | null } & {
  scope_reviews: number;
  scope_passages: number;
  embedded_passages: number;
  embedded_from: string | null;
  embedded_to: string | null;
};

/**
 * How a review side is chunked: one passage per sentence, split after . ! or ? followed by whitespace.
 * The query and the loader (scripts/embed-reviews.ts) both use it, so they always agree on the passages.
 */
export const SENTENCE_SPLIT = '(?<=[.!?])\\s+';

export const DEFAULT_K = 8;
export const DEFAULT_DAYS = 90;
/**
 * bge-m3 cosine similarity below which a sentence is not about the question. Calibrated on this corpus: an
 * off-topic question ("wifi connection") tops out at 0.547 and most sentences sit at 0.40–0.50, while sentences on
 * the asked topic score 0.60–0.75 (e.g. "noise from building works" → "Construction noise from the floor below…" 0.752).
 */
export const MIN_SIMILARITY = 0.55;

/**
 * $1 question vector, $2 hotels (null = all), $3 from, $4 to, $5 sentiment, $6 model, $7 k, $8 min similarity.
 * pgvector lives in schema public and compass_ro's search_path is `hotel`, so the type and operator are qualified.
 */
export const FIND_REVIEWS_SQL = `
with reviews as (
  select r.review_id, r.hotel_code, r.review_date, r.positive_text, r.negative_text
    from hotel.reviews r
   where ($2::text[] is null or r.hotel_code = any($2::text[]))
     and r.review_date between $3::date and $4::date
),
-- One row per review and distinct sentence in it (the sentence key is its md5, so every grouping below hashes).
scope as (
  select distinct r.review_id, r.hotel_code, r.review_date, s.sentiment, md5(btrim(c.sentence)) as content_md5
    from reviews r
   cross join lateral (values ('praise', r.positive_text), ('complaint', r.negative_text)) s(sentiment, review_text)
   cross join lateral regexp_split_to_table(btrim(s.review_text), '${SENTENCE_SPLIT}') c(sentence)
   where btrim(c.sentence) <> '' and ($5::text = 'any' or s.sentiment = $5::text)
),
passages as (
  select sentiment, content_md5, count(*)::int as mentions, min(review_date) as first_date, max(review_date) as last_date
    from scope group by sentiment, content_md5
),
embedded as (
  select p.*, e.content, e.embedding operator(public.<=>) $1::public.vector as distance
    from passages p join hotel.review_passages e on e.model = $6::text and e.content_md5 = p.content_md5
),
coverage as (
  select (select count(*) from reviews)::int as scope_reviews,
         (select count(*) from passages)::int as scope_passages,
         (select count(*) from embedded)::int as embedded_passages,
         (select to_char(min(first_date), 'YYYY-MM-DD') from embedded) as embedded_from,
         (select to_char(max(last_date), 'YYYY-MM-DD') from embedded) as embedded_to
),
ranked as (
  select * from embedded where 1 - distance >= $8::float8 order by distance limit $7::int
),
-- One pass over the scope for the k matches only: per-hotel counts and the latest review that says it.
hits as (
  select s.* from scope s join ranked m on m.sentiment = s.sentiment and m.content_md5 = s.content_md5
),
by_hotel as (
  select sentiment, content_md5, jsonb_object_agg(hotel_code, n order by n desc, hotel_code) as mentions_by_hotel
    from (select sentiment, content_md5, hotel_code, count(*)::int as n from hits group by 1, 2, 3) h
   group by 1, 2
),
latest as (
  select distinct on (h.sentiment, h.content_md5) h.sentiment, h.content_md5, v.hotel_code, v.review_date, v.source, v.overall_score,
         case h.sentiment when 'praise' then v.positive_text else v.negative_text end as review_text
    from hits h join hotel.reviews v on v.review_id = h.review_id
   order by h.sentiment, h.content_md5, h.review_date desc, h.review_id desc
)
select m.sentiment, m.content as quote, round((1 - m.distance)::numeric, 3)::float8 as similarity, m.mentions,
       round(100.0 * m.mentions / nullif(c.scope_reviews, 0), 1)::float8 as share_pct,
       to_char(m.first_date, 'YYYY-MM-DD') as first_date, to_char(m.last_date, 'YYYY-MM-DD') as last_date,
       b.mentions_by_hotel, x.hotel_code, to_char(x.review_date, 'YYYY-MM-DD') as review_date, x.source,
       x.overall_score::float8 as overall_score, x.review_text,
       c.*
  from coverage c
  left join ranked m on true
  left join by_hotel b on b.sentiment = m.sentiment and b.content_md5 = m.content_md5
  left join latest x on x.sentiment = m.sentiment and x.content_md5 = m.content_md5
 order by m.distance nulls last`;

export interface FindReviewsQuery {
  sql: string;
  params: unknown[];
  period: { from: string; to: string };
  sentiment: Sentiment;
  k: number;
}

/** The SQL and its parameters. The period defaults to the 90 days up to the business date. */
export function buildFindReviewsQuery(input: FindReviewsInput, vector: readonly number[], model: string, businessDate: string): FindReviewsQuery {
  const to = input.to ?? businessDate;
  const from = input.from ?? addDays(to, -DEFAULT_DAYS);
  const sentiment = input.sentiment ?? 'any';
  const k = input.k ?? DEFAULT_K;
  return {
    sql: FIND_REVIEWS_SQL,
    params: [`[${vector.join(',')}]`, input.hotels?.length ? input.hotels : null, from, to, sentiment, model, k, MIN_SIMILARITY],
    period: { from, to },
    sentiment,
    k,
  };
}

/** Splits the coverage columns off into notes; keeps only real matches as rows. */
export function shapeFindReviews(rows: readonly FindReviewsRow[], context: { model: string; question: string; period: { from: string; to: string } }) {
  const first = rows[0];
  const matches: ReviewMatch[] = rows
    .filter((row) => row.quote !== null)
    .map((row) => ({
      sentiment: row.sentiment!,
      quote: row.quote!,
      similarity: row.similarity!,
      mentions: row.mentions!,
      share_pct: row.share_pct!,
      first_date: row.first_date!,
      last_date: row.last_date!,
      mentions_by_hotel: row.mentions_by_hotel ?? {},
      hotel_code: row.hotel_code!,
      review_date: row.review_date!,
      source: row.source!,
      overall_score: row.overall_score!,
      review_text: row.review_text!,
    }));
  const scope = first ?? { scope_reviews: 0, scope_passages: 0, embedded_passages: 0, embedded_from: null, embedded_to: null };
  const coverage =
    scope.scope_passages === 0
      ? `No reviews in scope for ${context.period.from} to ${context.period.to}.`
      : `Coverage: ${scope.embedded_passages} of ${scope.scope_passages} distinct sentences from ${scope.scope_reviews} reviews in scope are embedded` +
        (scope.embedded_from ? ` (reviews dated ${scope.embedded_from} to ${scope.embedded_to}).` : '.');
  const notes = [
    `Semantic search with ${context.model}: review sentences ranked by cosine similarity to "${context.question}", at least ${MIN_SIMILARITY}.`,
    'One row per distinct review sentence; mentions counts the reviews in scope that contain it; hotel_code, review_date, source, overall_score and review_text are from its latest review.',
    coverage,
    ...(matches.length === 0 && scope.scope_passages > 0 ? ['No sentence is close enough in meaning. Try other words, a wider period or search_reviews for an exact phrase.'] : []),
  ];
  return { rows: matches, notes, coverage: scope };
}

/** Embeds the question, runs the filtered vector search and returns the matches with their evidence. */
export async function findReviews(
  db: Db,
  embedder: Embedder,
  input: FindReviewsInput,
  businessDate: string,
): Promise<Result<DataResult<ReviewMatch>, DataError>> {
  const question = input.question.trim();
  if (!question) return err({ kind: 'invalid', message: 'Ask a question, e.g. "noise from building works".' });
  if (input.from && input.to && input.from > input.to) return err({ kind: 'invalid', message: '`from` must be on or before `to`.' });
  let vector: number[];
  try {
    [vector] = (await embedder.embed([question])) as [number[]];
  } catch (error) {
    return err({ kind: 'database', message: `Could not embed the question: ${error instanceof Error ? error.message : String(error)}` });
  }
  const query = buildFindReviewsQuery({ ...input, question }, vector, embedder.model, businessDate);
  let raw: FindReviewsRow[];
  try {
    raw = await db.query<FindReviewsRow>(query.sql, query.params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/review_passages|type "?public\.vector"? does not exist|schema "public"/.test(message)) {
      return err({ kind: 'invalid', message: 'This database has no review embeddings (hotel.review_passages), so semantic search is unavailable. Use search_reviews with a phrase.' });
    }
    return err({ kind: 'database', message });
  }
  const shaped = shapeFindReviews(raw, { model: embedder.model, question, period: query.period });
  const evidence: Evidence = {
    sources: ['hotel.reviews', 'hotel.review_passages'],
    definitions: {
      similarity: `Cosine similarity between the question and the passage, both embedded with ${embedder.model} (1 = same meaning).`,
      mentions: 'Reviews in the hotel(s) and period whose positive_text (praise) or negative_text (complaint) contains this sentence.',
      share_pct: 'mentions as a share of all reviews in scope.',
    },
    period: query.period,
    sql: query.sql.replace(/\s+/g, ' ').trim(),
    // The 1024 numbers of the question vector would drown the evidence; name it instead.
    params: [`<${embedder.model} embedding of "${question}">`, ...query.params.slice(1)],
    rowCount: shaped.rows.length,
    businessDate,
    notes: shaped.notes,
  };
  return ok({ rows: shaped.rows, evidence });
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
