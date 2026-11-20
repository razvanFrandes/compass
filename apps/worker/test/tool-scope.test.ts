import type { Evidence } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import type { HotelData } from '../src/application/hotel-data.ts';
import { DATA_TOOLS, SCOPE_FREE_TOOLS, SCOPE_ROW_TOOLS, type DataTool } from '../src/presentation/tools/catalog.ts';
import { runTool } from '../src/presentation/tools/run-tool.ts';
import { TOOL_CALLS } from './fixtures/tool-calls.ts';

// A hotel scope ("answer only for Lisbon and Amsterdam") holds for every data tool: a call's hotels are cut down to
// the scope, a call without hotels gets the scope, and a call for other hotels is refused before it reads anything.

const tools = DATA_TOOLS as readonly DataTool[];
const takesHotels = (tool: DataTool) => 'hotels' in tool.input.shape;
const evidence: Evidence = { sources: [], definitions: {}, period: null, sql: '', params: [], rowCount: 0, businessDate: '2026-11-20', notes: [] };

/** A data layer that records how each method was called and answers with no rows, as a result and as a value. */
function recorder() {
  const calls: { method: string; args: unknown[] }[] = [];
  const answer = { ok: true, value: { rows: [], evidence }, rows: [], evidence };
  const handler: ProxyHandler<object> = {
    get: (_target, method: string) => {
      if (method === 'finance') return new Proxy({}, handler);
      if (method === 'businessDate') return async () => '2026-11-20';
      if (method === 'listMetrics') return () => ({ rows: [] });
      if (method === 'getSchema') return async () => 'schema';
      return async (...args: unknown[]) => (calls.push({ method, args }), answer);
    },
  };
  return { data: new Proxy({}, handler) as unknown as HotelData, calls };
}

const firstCall = (name: string) => ({ ...(TOOL_CALLS[name]?.[0] ?? { question: 'noise' }) });
const hotelsRead = (calls: { args: unknown[] }[]) => (calls[0]!.args[0] as { hotels?: string[] }).hotels;

describe('hotel scope on the data tools', () => {
  it('places every tool: it takes hotels, it filters its rows by hotel, or it reads no hotel data', () => {
    for (const tool of tools) {
      const places = [takesHotels(tool), SCOPE_ROW_TOOLS.includes(tool.name), SCOPE_FREE_TOOLS.includes(tool.name)].filter(Boolean);
      expect(places, tool.name).toHaveLength(1);
    }
  });

  for (const tool of tools.filter(takesHotels)) {
    it(`${tool.name}: a call without hotels reads the scope`, async () => {
      const { data, calls } = recorder();
      const { hotels: _dropped, ...args } = firstCall(tool.name);
      const outcome = await runTool(tool, data, tool.input.parse(args), ['LIS', 'AMS']);
      expect(outcome.ok).toBe(true);
      expect(hotelsRead(calls)).toEqual(['LIS', 'AMS']);
    });

    it(`${tool.name}: a call for hotels inside and outside the scope reads only those inside, and says so`, async () => {
      const { data, calls } = recorder();
      const outcome = await runTool(tool, data, tool.input.parse({ ...firstCall(tool.name), hotels: ['PAR', 'LIS'] }), ['LIS', 'AMS']);
      expect(hotelsRead(calls)).toEqual(['LIS']);
      if (!outcome.ok) throw new Error(outcome.text);
      expect(outcome.text).toContain('Limited to the hotels selected: LIS, AMS. Left out, not among them: PAR.');
      expect((outcome.structured as { evidence: Evidence }).evidence.notes).toContain('Limited to the hotels selected: LIS, AMS. Left out, not among them: PAR.');
    });

    it(`${tool.name}: a call only for hotels outside the scope is refused and reads nothing`, async () => {
      const { data, calls } = recorder();
      const outcome = await runTool(tool, data, tool.input.parse({ ...firstCall(tool.name), hotels: ['PAR'] }), ['LIS', 'AMS']);
      expect(outcome).toEqual({ ok: false, text: 'PAR is outside the hotels you are answering for (LIS, AMS). Use only those hotels.' });
      expect(calls).toEqual([]);
    });

    it(`${tool.name}: without a scope the call is as the model wrote it`, async () => {
      const { data, calls } = recorder();
      const { hotels: _dropped, ...args } = firstCall(tool.name);
      const outcome = await runTool(tool, data, tool.input.parse(args));
      expect(hotelsRead(calls)).toBeUndefined();
      if (!outcome.ok) throw new Error(outcome.text);
      expect(outcome.text).not.toContain('Scope:');
    });
  }

  it.each([
    ['list_hotels', 'listHotels', 0],
    ['get_brief', 'getBriefItems', 0],
    ['run_readonly_query', 'runReadonlyQuery', 1],
  ])('%s hands the scope to the data layer, which filters its rows by hotel', async (name, method, position) => {
    const { data, calls } = recorder();
    const tool = tools.find((t) => t.name === name)!;
    const outcome = await runTool(tool, data, tool.input.parse(firstCall(name)), ['LIS']);
    expect(calls[0]!.method).toBe(method);
    expect(calls[0]!.args[position]).toEqual(['LIS']);
    if (!outcome.ok) throw new Error(outcome.text);
    expect(outcome.text).toContain('Limited to the hotels selected: LIS.');
  });

  it('leaves the tools that read no hotel data as they are', async () => {
    for (const name of SCOPE_FREE_TOOLS) {
      const { data } = recorder();
      const outcome = await runTool(tools.find((t) => t.name === name)!, data, {}, ['LIS']);
      if (!outcome.ok) throw new Error(outcome.text);
      expect(outcome.text).not.toContain('Scope:');
    }
  });
});
