import type { HotelData } from '../../application/hotel-data.ts';
import type { DataTool, ToolOutcome } from './catalog.ts';

export const TOOL_FAILURE = 'The data source failed to answer. Try again in a moment, or use another tool.';

/**
 * Runs a catalog tool for an adapter (MCP, Pi). Expected failures (a rejected or failing custom query) come back as
 * the tool wrote them, so the model can fix its SQL. An unexpected exception, such as a lost database connection,
 * may carry hosts or connection details: it goes to the logs, and the caller sees a generic failure. So does the
 * `cause` of a failure the tool caught itself: it is logged here and never returned.
 */
export async function runTool(tool: DataTool, data: HotelData, args: unknown): Promise<ToolOutcome> {
  try {
    const outcome = await tool.run(data, args as never);
    if (outcome.ok || !('cause' in outcome)) return outcome;
    console.error(`tool ${tool.name} failed`, outcome.cause);
    return { ok: false, text: outcome.text };
  } catch (error) {
    console.error(`tool ${tool.name} failed`, error);
    return { ok: false, text: TOOL_FAILURE };
  }
}
