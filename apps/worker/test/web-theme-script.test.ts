import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const web = fileURLToPath(import.meta.resolve('../../web/'));
const script = /<script>([\s\S]*?)<\/script>/.exec(readFileSync(web + 'src/index.html', 'utf8'))?.[1] ?? '';

/**
 * The script in index.html sets the theme and the mode before the first paint, so the page never flashes the
 * wrong one. It cannot import apps/web/src/app/theme.ts, so it repeats that file's rules; this test runs the
 * script itself against a stand-in for the page and holds it to the same cases as theme.spec.ts.
 */
function boot(options: { theme?: string; mode?: string; device?: 'light' | 'dark' | 'unknown'; attrs?: Record<string, string>; storage?: 'blocked' } = {}) {
  const attrs = new Map(Object.entries(options.attrs ?? {}));
  const classes = new Set<string>();
  const stored = new Map<string, string>();
  if (options.theme !== undefined) stored.set('compass.theme', options.theme);
  if (options.mode !== undefined) stored.set('compass.mode', options.mode);
  const window: Record<string, unknown> = {};
  if (options.device !== 'unknown') window['matchMedia'] = (query: string) => ({ matches: query === `(prefers-color-scheme: ${options.device ?? 'dark'})` });
  runInNewContext(script, {
    window,
    document: {
      documentElement: {
        getAttribute: (name: string) => attrs.get(name) ?? null,
        setAttribute: (name: string, value: string) => attrs.set(name, value),
        classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) },
      },
    },
    localStorage: {
      getItem: (key: string) => {
        if (options.storage === 'blocked') throw new Error('SecurityError');
        return stored.get(key) ?? null;
      },
    },
  });
  return { theme: attrs.get('data-theme'), mode: attrs.get('data-mode'), classes: [...classes].join(' ') };
}

describe('the theme script of apps/web/src/index.html', () => {
  it('is there', () => {
    expect(script).toContain('compass.theme');
    expect(script).toContain('compass.mode');
  });

  it('starts a first visit in the default theme, in the dark mode, whatever the device prefers', () => {
    expect(boot({ device: 'dark' })).toEqual({ theme: 'default', mode: 'dark', classes: 'dark' });
    expect(boot({ device: 'light' })).toEqual({ theme: 'default', mode: 'dark', classes: 'dark' });
    expect(boot({ device: 'unknown' })).toEqual({ theme: 'default', mode: 'dark', classes: 'dark' });
    // A theme stored without a mode (it cannot be written that way today) is dark as well.
    expect(boot({ theme: 'default', device: 'light' })).toEqual({ theme: 'default', mode: 'dark', classes: 'dark' });
  });

  it('applies the two remembered choices', () => {
    expect(boot({ theme: 'juyo-concept', mode: 'dark', device: 'light' })).toEqual({ theme: 'juyo-concept', mode: 'dark', classes: 'dark' });
    expect(boot({ theme: 'juyo-concept', mode: 'light', device: 'dark' })).toEqual({ theme: 'juyo-concept', mode: 'light', classes: 'light' });
    expect(boot({ theme: 'default', mode: 'light', device: 'dark' })).toEqual({ theme: 'default', mode: 'light', classes: 'light' });
    expect(boot({ theme: 'default', mode: 'dark', device: 'light' })).toEqual({ theme: 'default', mode: 'dark', classes: 'dark' });
  });

  it('resolves the system mode from the device once it is chosen, for either theme', () => {
    expect(boot({ theme: 'juyo-concept', mode: 'system', device: 'dark' })).toEqual({ theme: 'juyo-concept', mode: 'system', classes: 'dark' });
    expect(boot({ theme: 'juyo-concept', mode: 'system', device: 'light' })).toEqual({ theme: 'juyo-concept', mode: 'system', classes: 'light' });
    expect(boot({ theme: 'default', mode: 'system', device: 'light' })).toEqual({ theme: 'default', mode: 'system', classes: 'light' });
    // No answer from the device: dark.
    expect(boot({ theme: 'default', mode: 'system', device: 'unknown' })).toEqual({ theme: 'default', mode: 'system', classes: 'dark' });
  });

  it('reads the single value of before the mode was a choice as what the person had', () => {
    expect(boot({ theme: 'light', device: 'dark' })).toEqual({ theme: 'default', mode: 'light', classes: 'light' });
    expect(boot({ theme: 'dark', device: 'light' })).toEqual({ theme: 'default', mode: 'dark', classes: 'dark' });
    // The concept theme was a light theme.
    expect(boot({ theme: 'juyo-concept', device: 'dark' })).toEqual({ theme: 'juyo-concept', mode: 'light', classes: 'light' });
  });

  it('ignores values it does not know', () => {
    expect(boot({ theme: 'sepia', mode: 'dim', device: 'light' })).toEqual({ theme: 'default', mode: 'dark', classes: 'dark' });
  });

  it('lets an attribute already on <html> win, and survives blocked storage', () => {
    expect(boot({ theme: 'default', mode: 'light', attrs: { 'data-theme': 'juyo-concept', 'data-mode': 'dark' } })).toEqual({ theme: 'juyo-concept', mode: 'dark', classes: 'dark' });
    expect(boot({ storage: 'blocked', device: 'light' })).toEqual({ theme: 'default', mode: 'dark', classes: 'dark' });
  });
});
