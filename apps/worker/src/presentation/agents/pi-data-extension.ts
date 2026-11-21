import { hook, ToolTask, type Extension, type ToolExecutionResult, type ToolRegistration } from '@earendil-works/pi-durable';
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
    hooks: [hook(ToolTask, { afterTool: (call, result) => (unavailable(result) ? notOffered(call.name) : result) })],
  };
}

const DATA_TOOL_NAMES = new Set<string>(DATA_TOOLS.map((tool) => tool.name));

const unavailable = (result: ToolExecutionResult) => result.diagnostics?.some((diagnostic) => diagnostic.code === 'tool_unavailable') === true;

/**
 * Pi answers a call to a tool its request did not offer with "Tool get_mix is not available", which a model passes
 * on as "the channel mix isn't available in this session": as if the data were missing. Instead it reads why. A data
 * tool is only ever left out by Quick mode (modes.ts); any other name is no tool at all.
 */
function notOffered(name: string): ToolExecutionResult {
  const text = DATA_TOOL_NAMES.has(name)
    ? `${name} is not offered in Quick mode, which answers from the headline tools only; the data itself is there. Do not call ` +
      'it again. Answer with the tools you have. If they cannot answer the question, say so in one sentence and that ' +
      'Thinker mode answers it in full.'
    : `There is no tool called ${name}. Call only the tools you are offered, with their exact names.`;
  return { output: [{ type: 'text', text }], isError: true };
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
      if (!parsed.success) throw new Error(`Invalid arguments: ${z.prettifyError(parsed.error)}\nFix them and call the tool again.`);
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
