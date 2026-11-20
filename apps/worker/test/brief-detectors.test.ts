import type { BriefItem } from '@compass/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detectBriefItems } from '../src/application/brief-detectors.ts';
import { openPostgres, type PostgresDb } from '../src/infrastructure/postgres.ts';

process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);

let db: PostgresDb;
let items: BriefItem[];

beforeAll(async () => {
  db = openPostgres(process.env['DATABASE_URL']!);
  items = await detectBriefItems(db);
});
afterAll(() => db.close());

const find = (kind: BriefItem['kind'], hotel: string) => items.find((i) => i.kind === kind && i.hotel_code === hotel);

describe('morning brief detectors', () => {
  it('S7: flags the stale Berlin POS feed as critical, first', () => {
    expect(items[0]).toMatchObject({ kind: 'data_stale', hotel_code: 'BER', severity: 'critical' });
  });

  it('S1: Lisbon pace is behind last year', () => {
    const item = find('pace_behind', 'LIS')!;
    expect(item.facts['pace_pct']).toBeLessThan(-10);
    expect(item.impact_eur).toBeLessThan(0);
  });

  it('S2: New York lost Vantor Consulting, worth over €1M', () => {
    const item = find('account_loss', 'NYC')!;
    expect(item.facts['account']).toBe('Vantor Consulting');
    expect(item.impact_eur).toBeLessThan(-1_000_000);
  });

  it('S3: Bali kitchen is understaffed', () => {
    const item = find('staffing_gap', 'DPS')!;
    expect(item.facts['department']).toBe('Kitchen');
    expect(item.facts['staffing_pct']).toBeLessThan(85);
  });

  it('S4: Amsterdam mobile conversion dropped', () => {
    const item = find('web_conversion_drop', 'AMS')!;
    expect(item.facts['device']).toBe('mobile');
    expect(item.impact_eur).toBeLessThan(0);
  });

  it('S5: Barcelona has rooms out of order', () => {
    expect(find('rooms_out_of_order', 'BCN')!.facts['out_of_order_nights']).toBeGreaterThan(500);
  });

  it('S6: Dubai Business Bay sells high-demand nights below the market', () => {
    const item = find('underpriced_demand', 'DXB2')!;
    expect(item.impact_eur).toBeGreaterThan(0);
  });

  it('flags a material GOP miss against budget in the last closed month: Miami, October', async () => {
    const item = find('gop_miss', 'MIA')!;
    const [o] = await db.query<{ var: number }>(
      `select round(sum(amount * hotel.eur_rate(currency, month)) filter (where scenario = 'actual')
                  - sum(amount * hotel.eur_rate(currency, month)) filter (where scenario = 'budget'))::float8 as var
         from hotel.pnl_monthly where hotel_code = 'MIA' and line = 'GOP' and month = '2026-10-01'`,
    );
    expect(item.impact_eur).toBe(o!.var);
    expect(item.facts['month']).toBe('2026-10');
    expect(item.facts['gop_var_pct']).toBeLessThan(-10);
    expect(item.sources).toContain('hotel.pnl_monthly');
  });

  it('stays quiet on small GOP misses: only Miami missed October by more than 10%', () => {
    expect(items.filter((i) => i.kind === 'gop_miss').map((i) => i.hotel_code)).toEqual(['MIA']);
  });

  it('stays focused: no more than ten items, no one-off group events', () => {
    expect(items.length).toBeLessThanOrEqual(10);
    expect(items.some((i) => String(i.facts['account'] ?? '').includes('wedding'))).toBe(false);
  });

  it('ranks the rest by absolute money impact', () => {
    const priced = items.filter((i) => i.severity !== 'critical').map((i) => Math.abs(i.impact_eur ?? 0));
    expect(priced).toEqual([...priced].sort((a, b) => b - a));
  });

  it('gives every item a question for Kassandra and its sources', () => {
    for (const item of items) {
      expect(item.question.length).toBeGreaterThan(10);
      expect(item.sources.length).toBeGreaterThan(0);
    }
  });
});
