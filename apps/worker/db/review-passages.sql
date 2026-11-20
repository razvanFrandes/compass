-- Semantic search over guest reviews: the embedding store and its loader role.
-- Run once as compass_admin; it is idempotent. Existing hotel.* tables are not altered.
--
--   ssh compass-db 'PGHOST=127.0.0.1 PGPORT=5433 PGUSER=compass_admin ~/opt/pg/bin/psql -X -v ON_ERROR_STOP=1 -d compass_hotels' \
--     < apps/worker/db/review-passages.sql
--
-- A passage is one sentence of a review's positive_text (praise) or negative_text (complaint), split on . ! or ?
-- followed by whitespace (SENTENCE_SPLIT in src/application/review-search.ts). Sentence chunks keep one topic per
-- vector, so a review that praises breakfast and the view matches "breakfast" without the view diluting it.
-- Content-addressed: one row per distinct sentence and model, keyed by md5(content). Reviews join to it by text,
-- so a sentence is embedded once however many reviews contain it; with unique real-world texts it degrades
-- gracefully to one row per review sentence.
-- pgvector lives in schema public (and compass_ro's search_path is `hotel`), so the type is always qualified.

create table if not exists hotel.review_passages (
  model        text not null,
  content_md5  text not null,
  content      text not null,
  embedding    public.vector(1024) not null,
  embedded_at  timestamptz not null default now(),
  primary key (model, content_md5)
);
comment on table hotel.review_passages is
  'Embeddings of distinct review sentences (from positive_text / negative_text), keyed by model and md5(sentence).';

-- Cosine HNSW. At today's size (dozens of sentences) the planner rightly prefers an exact scan; the index is for growth
-- and for unfiltered nearest-neighbour queries.
create index if not exists review_passages_embedding_hnsw
  on hotel.review_passages using hnsw (embedding public.vector_cosine_ops) with (m = 16, ef_construction = 64);

grant select on hotel.review_passages to compass_ro;

-- The loader: no login and no password. compass_admin (over SSH on the VM) runs `set role compass_embedder`,
-- so the job can only read the review texts and add embeddings.
do $$ begin
  if not exists (select from pg_roles where rolname = 'compass_embedder') then
    create role compass_embedder nologin;
  end if;
end $$;
grant usage on schema hotel to compass_embedder;
grant select (review_date, positive_text, negative_text) on hotel.reviews to compass_embedder;
grant select, insert on hotel.review_passages to compass_embedder;
