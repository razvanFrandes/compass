import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { HotelData } from '../src/application/hotel-data.ts';
import type { ReviewMatch } from '../src/application/review-search.ts';
import { openPostgres, type PostgresDb } from '../src/infrastructure/postgres.ts';
import { WorkersAiEmbedder } from '../src/infrastructure/workers-ai-embedder.ts';
import { DATA_TOOLS, type DataTool } from '../src/presentation/tools/catalog.ts';

// Semantic review search end to end, against the production database (local Postgres has no pgvector) and the real
// Workers AI model. Opt-in, because it needs an SSH tunnel and calls a paid (if nearly free) API:
//
//   ssh -f -N -L 15433:127.0.0.1:5433 compass-db
//   RAG_VM=1 pnpm --filter @compass/worker exec vitest run test/review-search.vm.test.ts
//
// It connects as the read-only compass_ro (password from .env.production), like the Worker does.
// The planted stories (compass-datagen): S3, a kitchen shortage in Bali (DPS) from October 2026, and S5, a renovation
// in Barcelona (BCN). The questions use other words than the reviews do.

const enabled = process.env['RAG_VM'] === '1';

describe.skipIf(!enabled)('find_reviews on the production database', () => {
  let db: PostgresDb;
  let data: HotelData;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    process.loadEnvFile(new URL('../.env.production', import.meta.url).pathname);
    const port = process.env['RAG_VM_PORT'] ?? '15433';
    db = openPostgres(`postgres://compass_ro:${encodeURIComponent(process.env['COMPASS_RO_PASSWORD']!)}@127.0.0.1:${port}/compass_hotels`);
    const proxy = await getPlatformProxy<{ AI: Ai }>({ configPath: new URL('../scripts/embed.wrangler.jsonc', import.meta.url).pathname });
    dispose = proxy.dispose;
    data = new HotelData(db, new WorkersAiEmbedder(proxy.env.AI));
  }, 60_000);
  afterAll(async () => {
    await db?.close();
    await dispose?.();
  });

  async function ask(input: Parameters<HotelData['findReviews']>[0]): Promise<ReviewMatch[]> {
    const result = await data.findReviews(input);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    return result.value.rows;
  }

  it('S3: "food quality and slow dinner service" in Bali surfaces the understaffed restaurant, new since October', async () => {
    const rows = await ask({ question: 'food quality and slow dinner service', hotels: ['DPS'], from: '2026-08-01', to: '2026-11-20' });
    const top = rows.slice(0, 2);
    expect(top.map((r) => r.quote).sort()).toEqual(['Dinner took over an hour and room service never came.', 'The restaurant was clearly understaffed.']);
    for (const row of top) {
      expect(row.sentiment).toBe('complaint');
      expect(row.first_date >= '2026-10-01').toBe(true);
      expect(row.mentions).toBeGreaterThan(100);
      expect(row.hotel_code).toBe('DPS');
    }
  });

  it('S5: "noise from building works" in Barcelona surfaces the construction noise first', async () => {
    const [top] = await ask({ question: 'noise from building works', hotels: ['BCN'] });
    expect(top?.quote).toMatch(/^Construction noise/);
    expect(top?.sentiment).toBe('complaint');
    expect(top?.mentions).toBeGreaterThan(100);
  });

  it('S5 group-wide: the construction noise is a Barcelona problem', async () => {
    const [top] = await ask({ question: 'noise from building works' });
    expect(top?.quote).toMatch(/^Construction noise/);
    expect(Object.keys(top!.mentions_by_hotel)).toEqual(['BCN']);
  });

  it('praise only, through the catalog tool: "what do guests like about breakfast" in Bali', async () => {
    const tool = (DATA_TOOLS as readonly DataTool[]).find((t) => t.name === 'find_reviews')!;
    const outcome = await tool.run(data, tool.input.parse({ question: 'what do guests like about breakfast', hotels: ['DPS'], sentiment: 'praise' }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const rows = outcome.structured['rows'] as ReviewMatch[];
    expect(rows[0]?.quote).toMatch(/breakfast/i);
    expect(rows.every((r) => r.sentiment === 'praise')).toBe(true);
    expect(outcome.text).toMatch(/Searched (\d+) of \1 distinct sentences/);
  });

  it('returns nothing for a topic no guest wrote about, and says so', async () => {
    const result = await data.findReviews({ question: 'wifi connection' });
    expect(result.ok && result.value.rows).toEqual([]);
    expect(result.ok && result.value.evidence.notes.join(' ')).toMatch(/No sentence is close enough/);
  });

  it('runs the vector search as compass_ro within the 5 s statement timeout, group-wide over a year', async () => {
    const started = Date.now();
    await ask({ question: 'rude staff at check-in', from: '2025-11-20', to: '2026-11-20' });
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
