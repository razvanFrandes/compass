import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const web = fileURLToPath(import.meta.resolve('../../web/'));
const script = /<script>([\s\S]*?)<\/script>/.exec(readFileSync(web + 'src/index.html', 'utf8'))?.[1] ?? '';

/**
 * The script in index.html sets the theme before the first paint, so the page never flashes the wrong one. It
 * cannot import apps/web/src/app/theme.ts (DEFAULT_THEME), so it repeats the rule; this test runs the script itself
 * against a stand-in for the page.
 *
 * The rule: a visitor who has not chosen gets the dark theme, whatever the device prefers. A choice is remembered.
 */
function boot(options: { saved?: string; device?: 'light' | 'dark' | 'unknown'; attr?: string; storage?: 'blocked' } = {}) {
  const attrs = new Map<string, string>(options.attr ? [['data-theme', options.attr]] : []);
  const classes = new Set<string>();
  let asked = 0;
  const window: Record<string, unknown> = {};
  if (options.device !== 'unknown') {
    window['matchMedia'] = (query: string) => {
      asked++;
      return { matches: query === `(prefers-color-scheme: ${options.device ?? 'dark'})`, addEventListener: () => undefined };
    };
  }
  class MutationObserver {
    observe() {}
  }
  runInNewContext(script, {
    window,
    MutationObserver,
    document: {
      documentElement: {
        getAttribute: (name: string) => attrs.get(name) ?? null,
        setAttribute: (name: string, value: string) => attrs.set(name, value),
        classList: {
          add: (name: string) => classes.add(name),
          remove: (name: string) => classes.delete(name),
          toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
        },
      },
    },
    localStorage: {
      getItem: (key: string) => {
        if (options.storage === 'blocked') throw new Error('SecurityError');
        return key === 'compass.theme' ? (options.saved ?? null) : null;
      },
    },
  });
  return { theme: attrs.get('data-theme'), classes: [...classes].join(' '), asked };
}

describe('the default theme, in the script of apps/web/src/index.html', () => {
  it('is there', () => {
    expect(script).toContain('compass.theme');
  });

  it('is dark on a first visit, whatever the device prefers', () => {
    for (const device of ['light', 'dark', 'unknown'] as const) {
      const page = boot({ device });
      expect(page.classes).toBe('dark');
      // A default, not a choice: nothing is written on <html>.
      expect(page.theme).toBeUndefined();
    }
  });

  it('does not ask the device at all', () => {
    expect(boot({ device: 'light' }).asked).toBe(0);
  });

  it('is dark when this browser blocks storage', () => {
    expect(boot({ device: 'light', storage: 'blocked' }).classes).toBe('dark');
  });

  it('keeps a remembered choice', () => {
    expect(boot({ saved: 'light', device: 'dark' })).toMatchObject({ theme: 'light', classes: 'light' });
    expect(boot({ saved: 'dark', device: 'light' })).toMatchObject({ theme: 'dark', classes: 'dark' });
    expect(boot({ saved: 'juyo-concept', device: 'dark' })).toMatchObject({ theme: 'juyo-concept', classes: 'light' });
    // A value this version does not know is not a choice.
    expect(boot({ saved: 'sepia', device: 'light' }).classes).toBe('dark');
  });

  it('lets an attribute already on <html> win over the remembered choice', () => {
    expect(boot({ attr: 'light', saved: 'dark' })).toMatchObject({ theme: 'light', classes: 'light' });
  });
});
