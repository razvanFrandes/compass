import { McpServer } from '@modelcontextprotocol/server';
import type { HotelData } from '../../application/hotel-data.ts';
import { DATA_TOOLS, type DataTool } from '../tools/catalog.ts';

/**
 * The Compass MCP server: the public door to the hotel data, for Claude Desktop, ChatGPT or any MCP client.
 * The tools come from the shared catalog, so outside AIs and Compass's own agents use the same definitions.
 */

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export function createCompassMcpServer(data: HotelData): McpServer {
  const server = new McpServer(
    { name: 'compass-hotels', version: '0.1.0' },
    {
      instructions:
        'Hotel analytics for Halcyon Hospitality Group (20 hotels, fictional data). Prefer get_metric and the other ' +
        'specific tools; use run_readonly_query only when none fits. Never compute numbers yourself: quote the rows. ' +
        'Every result carries its evidence (definitions, sources, SQL).',
    },
  );

  for (const tool of DATA_TOOLS as readonly DataTool[]) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.input, annotations: READ_ONLY },
      async (args: unknown) => {
        const outcome = await tool.run(data, args as never);
        return outcome.ok
          ? { content: [{ type: 'text' as const, text: outcome.text }], structuredContent: outcome.structured }
          : { content: [{ type: 'text' as const, text: outcome.text }], isError: true };
      },
    );
  }

  return server;
}
