import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HotelData } from '../src/application/hotel-data.ts';
import { openPostgres, type PostgresDb } from '../src/infrastructure/postgres.ts';
import { createCompassMcpServer } from '../src/presentation/mcp/server.ts';

process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname);

let db: PostgresDb;
let client: Client;

beforeAll(async () => {
  db = openPostgres(process.env['DATABASE_URL']!);
  const server = createCompassMcpServer(new HotelData(db));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientSide);
});
afterAll(async () => {
  await client.close();
  await db.close();
});

type ToolResult = { isError?: boolean; content: { type: string; text?: string }[]; structuredContent?: Record<string, unknown> };
const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args }) as Promise<ToolResult>;

describe('Compass MCP server', () => {
  it('lists read-only tools with descriptions', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_account_production', 'get_brief', 'get_channel_mix', 'get_data_health', 'get_fnb', 'get_inventory', 'get_labor', 'get_metric',
      'get_mix', 'get_pace', 'get_pickup', 'get_rate_position', 'get_review_scores', 'get_schema', 'get_web_funnel',
      'list_hotels', 'list_metrics', 'run_readonly_query', 'search_reviews',
    ]);
    for (const tool of tools) {
      expect(tool.description?.length).toBeGreaterThan(20);
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it('returns rows and evidence as structured content', async () => {
    const result = await call('get_metric', { metric: 'occupancy', hotels: ['LIS'], from: '2026-10-01', to: '2026-10-31' });
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { rows: { value: number }[]; evidence: { sql: string } };
    expect(data.rows[0]!.value).toBeGreaterThan(30);
    expect(data.evidence.sql).toMatch(/v_hotel_day/);
    expect(result.content[0]!.text).toContain('LIS');
  });

  it('validates arguments', async () => {
    const result = await call('get_metric', { metric: 'happiness', from: '2026-10-01', to: '2026-10-31' });
    expect(result.isError).toBe(true);
  });

  it('turns a rejected query into an error result the model can act on', async () => {
    const result = await call('run_readonly_query', { sql: 'drop table hotel.hotels' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/Only SELECT/);
  });

  it('describes the schema for custom queries', async () => {
    const result = await call('get_schema');
    const text = result.content[0]!.text!;
    expect(text).toContain('reservations');
    expect(text).toContain('otb_as_of');
  });
});
