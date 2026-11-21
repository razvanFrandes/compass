import type { HotelData } from '../../application/hotel-data.ts';
import { FAILURE_TEXT, failureClass } from '../../domain/tool-failure.ts';
import type { DataTool, ToolOutcome } from './catalog.ts';

/** A failure that may pass: retry once with the same arguments (tool-failure.ts). */
export const TOOL_FAILURE = FAILURE_TEXT.temporary;
/** A statement that ran out of time: retry once, narrower. */
export const TOOL_TIMEOUT = FAILURE_TEXT.timeout;
/** A failure that will repeat: do not retry. */
export const TOOL_FAULT = FAILURE_TEXT.fault;

/** What the model reads for an unexpected error: its class, never its text. */
export const failureText = (error: unknown): string => FAILURE_TEXT[failureClass(error)];

/**
 * Runs a catalog tool for an adapter (MCP, Pi). Expected failures (a rejected or failing custom query) come back as
 * the tool wrote them, so the model can fix its SQL. An unexpected exception, such as a lost database connection,
 * may carry hosts or connection details: it goes to the logs, and the caller reads only its class (temporary,
 * timeout or fault) and what to do about it. So does the `cause` of a failure the tool caught itself: it is logged
 * here and never returned.
 * `scope` is the conversation's hotel scope (codes), for the Pi agents; the public MCP server has none.
 */
export async function runTool(tool: DataTool, data: HotelData, args: unknown, scope: readonly string[] = []): Promise<ToolOutcome> {
  try {
    const outcome = await tool.run(data, args as never, scope);
    if (outcome.ok || !('cause' in outcome)) return outcome;
    console.error(`tool ${tool.name} failed`, outcome.cause);
    return { ok: false, text: outcome.text };
  } catch (error) {
    console.error(`tool ${tool.name} failed`, error);
    return { ok: false, text: failureText(error) };
  }
}
