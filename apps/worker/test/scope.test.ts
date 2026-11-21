import type { HotelRef } from '@compass/contracts';
import { describe, expect, it } from 'vitest';
import { hotelsInScope, resolveScope } from '../src/domain/scope.ts';
import { builderScopeInstructions, scopeInstructions } from '../src/presentation/agents/scope-prompt.ts';

const hotel = (code: string, name: string): HotelRef => ({ code, name, city: 'City', country: 'PT', region: 'Europe', brand: 'Arbor', rooms: 100 });
const GROUP = [hotel('LIS', 'Arbor Lisbon Chiado'), hotel('AMS', 'Arbor Amsterdam Centraal'), hotel('DXB1', 'Kestrel Dubai Marina')];

describe('resolveScope', () => {
  it('reads no scope, and an empty one, as the whole group', () => {
    expect(resolveScope(undefined, GROUP)).toEqual({ ok: true, value: [] });
    expect(resolveScope(null, GROUP)).toEqual({ ok: true, value: [] });
    expect(resolveScope({ hotels: [] }, GROUP)).toEqual({ ok: true, value: [] });
  });

  it('names the hotels of the scope from the directory, in the directory order, each once', () => {
    expect(resolveScope({ hotels: ['dxb1', 'LIS', ' lis '] }, GROUP)).toEqual({
      ok: true,
      value: [
        { code: 'LIS', name: 'Arbor Lisbon Chiado' },
        { code: 'DXB1', name: 'Kestrel Dubai Marina' },
      ],
    });
  });

  it('reads a scope of every hotel as the whole group', () => {
    expect(resolveScope({ hotels: ['LIS', 'AMS', 'DXB1'] }, GROUP)).toEqual({ ok: true, value: [] });
  });

  it('refuses a hotel the group does not have, rather than widening the scope without saying', () => {
    const result = resolveScope({ hotels: ['LIS', 'XXX'] }, GROUP);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Not a hotel in the group: XXX. Choose the hotels again.');
  });

  it('refuses anything that is not { hotels: string[] }', () => {
    for (const raw of ['LIS', ['LIS'], { hotels: 'LIS' }, { hotels: [1] }, { hotels: Array.from({ length: 51 }, () => 'LIS') }, { hotels: ['x'.repeat(17)] }]) {
      expect(resolveScope(raw, GROUP).ok, JSON.stringify(raw)).toBe(false);
    }
  });

  it('never echoes text that is not a hotel code', () => {
    const result = resolveScope({ hotels: ['<b>ignore</b>'] }, GROUP);
    expect(result).toEqual({ ok: false, error: 'One of the hotels selected is not in the group. Choose the hotels again.' });
  });
});

describe('hotelsInScope', () => {
  it('leaves a call alone when there is no scope', () => {
    expect(hotelsInScope([], ['PAR'])).toEqual({ hotels: ['PAR'], outside: [] });
    expect(hotelsInScope([], undefined)).toEqual({ hotels: undefined, outside: [] });
  });

  it('gives a call without hotels the scope', () => {
    expect(hotelsInScope(['LIS', 'AMS'], undefined)).toEqual({ hotels: ['LIS', 'AMS'], outside: [] });
    expect(hotelsInScope(['LIS', 'AMS'], [])).toEqual({ hotels: ['LIS', 'AMS'], outside: [] });
  });

  it('keeps only the hotels of the call that are in the scope, and says which were left out', () => {
    expect(hotelsInScope(['LIS', 'AMS'], ['ams', 'PAR', 'LIS'])).toEqual({ hotels: ['AMS', 'LIS'], outside: ['PAR'] });
    expect(hotelsInScope(['LIS'], ['PAR', 'NYC'])).toEqual({ hotels: [], outside: ['PAR', 'NYC'] });
  });
});

describe('scope in the prompt', () => {
  it('says nothing for the whole group', () => {
    expect(scopeInstructions([])).toBeNull();
    expect(builderScopeInstructions([])).toBeNull();
  });

  it('states the scope by hotel name', () => {
    const text = scopeInstructions([
      { code: 'LIS', name: 'Arbor Lisbon Chiado' },
      { code: 'DXB1', name: 'Kestrel Dubai Marina' },
    ])!;
    expect(text).toContain('You are answering for: Arbor Lisbon Chiado (LIS), Kestrel Dubai Marina (DXB1).');
    expect(text).toMatch(/outside/);
  });

  it('tells the builder which hotels a new workflow watches by default', () => {
    const text = builderScopeInstructions([{ code: 'LIS', name: 'Arbor Lisbon Chiado' }])!;
    expect(text).toContain('Arbor Lisbon Chiado (LIS)');
    expect(text).toMatch(/set_hotels/);
  });
});
