import type { Evidence } from '@compass/contracts';
import type { RunDataTool } from '../../application/boards/seed.ts';
import type { HotelData } from '../../application/hotel-data.ts';
import { err, ok } from '../../domain/result.ts';
import { DATA_TOOLS, type DataTool } from './catalog.ts';
import { runTool } from './run-tool.ts';

/**
 * Runs a catalog tool by name for server code that needs its rows and evidence (the sample boards). It goes through
 * the same argument schema and `runTool` as the MCP and Pi adapters, so a failure is the fixed text and its cause is logged.
 */
export function catalogRunner(data: HotelData): RunDataTool {
  return async (name, args) => {
    const tool = (DATA_TOOLS as readonly DataTool[]).find((candidate) => candidate.name === name);
    if (!tool) return err(`No data tool is called ${name}.`);
    const parsed = tool.input.safeParse(args);
    if (!parsed.success) return err(`Invalid arguments for ${name}.`);
    const outcome = await runTool(tool, data, parsed.data);
    if (!outcome.ok) return err(outcome.text);
    const { rows, evidence } = outcome.structured as { rows?: Record<string, unknown>[]; evidence?: Evidence };
    return rows && evidence ? ok({ rows, evidence }) : err(`${name} returns no rows.`);
  };
}
