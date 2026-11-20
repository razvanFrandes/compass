import type { Extension, ToolRegistration } from '@earendil-works/pi-durable';
import { z } from 'zod';
import type { HotelData } from '../../application/hotel-data.ts';
import { DATA_TOOLS, type DataTool } from '../tools/catalog.ts';
import { runTool } from '../tools/run-tool.ts';

/** Opens the data layer for one tool call. In a Worker it opens a Hyperdrive client and closes it after. */
export type DataOpener = () => { data: HotelData; close(): Promise<void> };

/**
 * The shared data tools as a Pi extension. Every tool is read-only, so it is `replay: "safe"`: if the Durable
 * Object is evicted mid-call, Pi runs it again instead of reporting it as interrupted.
 */
/**
 * The hotel scope in force (hotel codes; empty for the whole group). Read at each tool call, from where the host
 * keeps it durably, so a run that resumes after an eviction keeps the scope it started with.
 */
export type ScopeReader = () => Promise<readonly string[]>;

/**
 * `scope`, when given, limits every tool call to the conversation's hotels (catalog.ts).
 */
export function createDataExtension(open: DataOpener, scope?: ScopeReader): Extension {
  return {
    name: 'compass-data',
    tools: (DATA_TOOLS as readonly DataTool[]).map((tool) => toPiTool(tool, open, scope)),
  };
}

function toPiTool(tool: DataTool, open: DataOpener, scope?: ScopeReader): ToolRegistration {
  const { $schema: _ignored, ...parameters } = z.toJSONSchema(tool.input, { io: 'input' }) as Record<string, unknown>;
  return {
    name: tool.name,
    description: tool.description,
    parameters,
    replay: 'safe',
    async execute(args) {
      const parsed = tool.input.safeParse(args ?? {});
      if (!parsed.success) throw new Error(`Invalid arguments: ${z.prettifyError(parsed.error)}`);
      const hotels = (await scope?.()) ?? [];
      const { data, close } = open();
      try {
        const outcome = await runTool(tool, data, parsed.data, hotels);
        if (!outcome.ok) throw new Error(outcome.text);
        // `output` is what the model reads; `details` (rows + evidence) is for the UI and never reaches the model.
        return { output: [{ type: 'text', text: outcome.text }], details: outcome.structured };
      } finally {
        await close();
      }
    },
  } as ToolRegistration;
}
