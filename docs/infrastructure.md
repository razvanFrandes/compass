# Infrastructure

```
Client (browser, Claude Desktop)
   │  https://juyo.razvanfrandes.com
   ▼
Cloudflare Worker  compass-juyo  (apps/worker)
   │  env.HYPERDRIVE  (Hyperdrive config "compass-db": pooling + query cache)
   ▼
Workers VPC service "compass-db"  (tcp, postgresql, 127.0.0.1:5433)
   │  Cloudflare Tunnel "compass-db"  (cloudflared runs on the VM, outbound only)
   ▼
VM (HostHatch, CloudPanel site user razvanfrandes-compass-db, no root)
   Postgres 17.12 + pgvector (conda-forge, in ~/opt/pg), data in ~/pgdata
   listens on 127.0.0.1:5433 only, TLS on (self-signed), scram-sha-256
```

- **No inbound port is opened on the VM.** Postgres listens on localhost. cloudflared dials out to Cloudflare, and Hyperdrive reaches the database through the tunnel.
- **Roles:**
  - `compass_admin` (owner; its password is in `~/.pgpass` on the VM);
  - `compass_ro`, which the Worker uses:
    - `SELECT` on schema `hotel` only;
    - every transaction is read-only;
    - `statement_timeout = 5s`.
- **Memory:** `shared_buffers = 512MB`, `max_connections = 40`. The VM also hosts other sites.
- **Restarts:** the site user's crontab has `@reboot` entries for Postgres and cloudflared, plus a 5-minute watchdog for each.
- **Data:** loaded from `compass-datagen/out/full` with `db/load.sh` (Halcyon: 20 hotels, 1.2M reservations, business date 2026-11-20). To reload, rsync `db/` and `out/full/` to `~/compass-datagen` on the VM and run `db/load.sh` with `DATABASE_URL` pointing at `compass_admin`. Then re-run the grants for `compass_ro`.

## Semantic review search (pgvector)

`find_reviews` ranks review sentences by meaning. The embeddings live next to the reviews; DDL and grants are in `apps/worker/db/review-passages.sql` (idempotent, run as `compass_admin`).

```sql
create table hotel.review_passages (
  model text not null, content_md5 text not null, content text not null,
  embedding public.vector(1024) not null, embedded_at timestamptz not null default now(),
  primary key (model, content_md5));
create index review_passages_embedding_hnsw on hotel.review_passages
  using hnsw (embedding public.vector_cosine_ops) with (m = 16, ef_construction = 64);
```

- **What is embedded:**
  - one row per distinct **sentence** of `positive_text` (praise) and `negative_text` (complaint), split after `.`, `!` or `?`;
  - the row is content-addressed by `md5(sentence)` and the model id, so reviews join to it by text and never by a foreign key;
  - existing `hotel.*` tables are untouched.
- **Why sentences:** sentence chunks keep one topic per vector. A review that praises the breakfast and the view then matches "breakfast" without the view diluting it.
- **Why separate sides:** praise and complaints stay apart, so a hit can say which one it is.
- **Model:** Workers AI `@cf/baai/bge-m3`:
  - 1024 dims, unit-normalised;
  - at most 100 texts per request; we truncate inputs over its 60k-token context;
  - $0.012 per M input tokens;
  - questions and passages are embedded the same way, with no instruction prefix.
- **Coverage:** every review, 2025-01-02 to 2026-11-19 (all 203,791). The generated corpus is templated:
  - its 556k sentence occurrences contain only **51 distinct sentences**;
  - embedding them took about 3 s, about 2,100 characters, well under a cent;
  - so there was no reason to limit the period.
  - With real, unique reviews the same table holds one row per sentence. That is roughly 1.5 M rows for this group, about $0.10 at today's price.
- **Query:** filter, then rank exactly.
  - Reviews are filtered first by hotel, period and sentiment, and split into sentences.
  - The distinct sentences in that scope are ranked by exact cosine distance (`operator(public.<=>)`).
  - Hits under 0.55 similarity are dropped.
  - Filtering first keeps every hit inside the requested scope. An HNSW scan filters only after it finds neighbours, so a selective filter can return fewer than k hits.
  - The planner uses a sequential scan here, which is right at 51 rows. The HNSW index is for growth and for unfiltered nearest-neighbour lookups.
- **Timing (compass_ro, through the tunnel):**
  - one hotel: 0.2–0.6 s;
  - the whole group over 90 days: about 0.6 s;
  - the whole group over a year: about 1.6 s, within the 5 s `statement_timeout`.
  - If reviews grow by orders of magnitude, precompute a `review_id → sentence md5` map instead of splitting the text on each query.
- **Grants:**
  - `compass_ro` has `SELECT` on `hotel.review_passages`. pgvector is in schema `public` and `compass_ro`'s `search_path` is `hotel`, so the SQL qualifies `public.vector` and `operator(public.<=>)`.
  - `compass_embedder` is the loader role. It is `NOLOGIN` with no password, and has:
    - `USAGE` on schema `hotel`;
    - `SELECT (review_date, positive_text, negative_text)` on `hotel.reviews`;
    - `SELECT, INSERT` on `hotel.review_passages`.
- **(Re-)running the embed job** after new reviews are loaded:
  ```sh
  pnpm --filter @compass/worker embed:reviews                    # all reviews
  pnpm --filter @compass/worker embed:reviews -- --since 2026-01-01
  ```
  - It runs on your machine:
    - Workers AI comes through wrangler's platform proxy (`scripts/embed.wrangler.jsonc`, AI binding only), authenticated by `wrangler login`;
    - Postgres is reached as `ssh compass-db psql …` with `set role compass_embedder`.
  - No tunnel, API token or new password is needed, and nothing is exposed by the production Worker.
  - It embeds only the sentences missing for the model and writes after every batch of 100 with `on conflict do nothing`, so it can be stopped and re-run safely.
- **Integration tests** against this database and the real model:
  ```sh
  ssh -f -N -L 15433:127.0.0.1:5433 compass-db
  RAG_VM=1 pnpm --filter @compass/worker exec vitest run test/review-search.vm.test.ts
  ```
  - They cover the planted stories S3 (DPS kitchen shortage) and S5 (BCN renovation noise), asked in other words than the reviews use.
  - The local Postgres 16 has no pgvector. Against it, `find_reviews` answers that semantic search is unavailable and points to `search_reviews`. To try it under `wrangler dev`, point `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` at the tunnel.

## Local development

- **Database:** the local `compass_hotels` database and the same read-only role.
- **Secret files** (all git-ignored):
  - `apps/worker/.env` — `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`, read by `wrangler dev`;
  - `apps/worker/.env.local` — `DATABASE_URL` for the Vitest integration tests;
  - `apps/worker/.env.production` — the production `compass_ro` password.
- **Testing against production data:** open `ssh -L 15433:127.0.0.1:5433 compass-db` and point `DATABASE_URL` at `127.0.0.1:15433`.

## Cloudflare resources

| Resource | Name | Id |
|---|---|---|
| Worker | compass-juyo | route `juyo.razvanfrandes.com` (custom domain) |
| Hyperdrive | compass-db | `0d5570d3cead4ad69805cd67233d92b3` |
| Workers VPC service | compass-db | `01a1f9c3-d18c-7002-9c9c-b6bc8b102c98` |
| Tunnel | compass-db | `730ca4b7-4cfb-4418-b89f-72dff11eb3fb` |
| Rate limit | MCP_RATE_LIMIT | namespace 2001, 60 requests/min per client |
