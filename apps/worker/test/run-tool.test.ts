import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { HotelData } from '../src/application/hotel-data.ts';
import { runTool, TOOL_FAILURE } from '../src/presentation/tools/run-tool.ts';
import type { DataTool } from '../src/presentation/tools/catalog.ts';

const data = {} as HotelData;
const tool = (run: DataTool['run']): DataTool => ({ name: 't', description: '', input: z.object({}), run });

describe('runTool', () => {
  it('returns the outcome of a tool that works', async () => {
    const outcome = await runTool(tool(async () => ({ ok: true, text: '[]', structured: {} })), data, {});
    expect(outcome).toEqual({ ok: true, text: '[]', structured: {} });
  });

  it('keeps expected, descriptive failures (e.g. a SQL error the model can fix)', async () => {
    const outcome = await runTool(tool(async () => ({ ok: false, text: 'column "x" does not exist' })), data, {});
    expect(outcome).toEqual({ ok: false, text: 'column "x" does not exist' });
  });

  it('hides an unexpected exception (connection strings, hosts, stack) behind a generic failure', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const outcome = await runTool(
      tool(async () => {
        throw new Error('connect ECONNREFUSED postgres://compass_ro:pw@abc.hyperdrive.local:5432/db');
      }),
      data,
      {},
    );
    expect(outcome).toEqual({ ok: false, text: TOOL_FAILURE });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
