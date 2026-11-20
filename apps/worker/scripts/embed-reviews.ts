/**
 * Dev-only job: embed the review sentences (passages) that have no embedding yet for the model. Never part of the Worker.
 *
 *   pnpm --filter @compass/worker embed:reviews                   # every review
 *   pnpm --filter @compass/worker embed:reviews -- --since 2025-06-01
 *
 * - Workers AI: wrangler's platform proxy gives this Node process the `AI` binding of scripts/embed.wrangler.jsonc,
 *   authenticated by the local `wrangler login` (OAuth). No API token is created or stored.
 * - Postgres: psql on the VM over SSH (host alias `compass-db`), as compass_admin switching to the loader role
 *   `compass_embedder`, which can only read the review texts and insert embeddings. No tunnel, no new password.
 * - Resumable and idempotent: it asks only for passages missing for the model, writes after every batch and
 *   inserts with `on conflict do nothing`. Re-run it after new reviews are loaded.
 */
import { spawnSync } from 'node:child_process';
import { getPlatformProxy } from 'wrangler';
import { SENTENCE_SPLIT } from '../src/application/review-search.ts';
import { WorkersAiEmbedder } from '../src/infrastructure/workers-ai-embedder.ts';

const SSH_HOST = process.env['EMBED_SSH_HOST'] ?? 'compass-db';
const PSQL = 'PGHOST=127.0.0.1 PGPORT=5433 PGUSER=compass_admin ~/opt/pg/bin/psql -X -q -At -v ON_ERROR_STOP=1 -d compass_hotels';
const BATCH = 100;

const sinceArg = process.argv.indexOf('--since');
const since = sinceArg > 0 ? process.argv[sinceArg + 1] : undefined;
if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error('--since takes an ISO date, YYYY-MM-DD');

/** Runs a SQL script on the VM as the loader role and returns stdout. */
function psql(script: string): string {
  const result = spawnSync('ssh', ['-o', 'BatchMode=yes', SSH_HOST, PSQL], {
    input: `set role compass_embedder;\n${script}`,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`psql on ${SSH_HOST} failed: ${result.stderr || result.error?.message}`);
  return result.stdout;
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const csv = (value: string) => `"${value.replaceAll('"', '""')}"`;

function pendingPassages(model: string): string[] {
  const window = since ? `where r.review_date >= ${quote(since)}::date` : '';
  const out = psql(`
    select coalesce(json_agg(t.content), '[]') from (
      select distinct btrim(c.sentence) as content
        from hotel.reviews r
       cross join lateral (values (r.positive_text), (r.negative_text)) s(review_text)
       cross join lateral regexp_split_to_table(btrim(s.review_text), ${quote(SENTENCE_SPLIT)}) c(sentence)
        ${window}
    ) t
     where t.content <> ''
       and not exists (select from hotel.review_passages p where p.model = ${quote(model)} and p.content_md5 = md5(t.content));`);
  return JSON.parse(out.trim()) as string[];
}

function store(model: string, texts: string[], vectors: number[][]): void {
  const rows = texts.map((text, i) => `${csv(text)},${csv(`[${vectors[i]!.join(',')}]`)}`).join('\n');
  psql(`
    begin;
    create temp table incoming (content text, embedding text) on commit drop;
    copy incoming from stdin with (format csv);
${rows}
\\.
    insert into hotel.review_passages (model, content_md5, content, embedding)
    select ${quote(model)}, md5(content), content, embedding::public.vector from incoming
    on conflict do nothing;
    commit;`);
}

const { env, dispose } = await getPlatformProxy<{ AI: Ai }>({ configPath: new URL('./embed.wrangler.jsonc', import.meta.url).pathname });
try {
  const embedder = new WorkersAiEmbedder(env.AI);
  const started = Date.now();
  const pending = pendingPassages(embedder.model);
  const chars = pending.reduce((sum, t) => sum + t.length, 0);
  console.log(`${pending.length} sentences to embed with ${embedder.model}${since ? ` (reviews since ${since})` : ''}, ${chars} characters.`);
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    store(embedder.model, batch, await embedder.embed(batch));
    console.log(`  ${Math.min(i + BATCH, pending.length)}/${pending.length}`);
  }
  const [total] = psql(`select count(*) from hotel.review_passages where model = ${quote(embedder.model)};`).trim().split('\n');
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)} s. ${total} sentences embedded for ${embedder.model}.`);
} finally {
  await dispose();
}
