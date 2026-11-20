import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const web = fileURLToPath(import.meta.resolve('../../web/'));
const read = (path: string) => readFileSync(web + path, 'utf8');

/**
 * The app's Content-Security-Policy (apps/web/public/_headers) allows inline scripts by hash only. An edit to the
 * theme script in index.html without a new hash would leave the deployed app unstyled, with no failing build.
 */
describe('apps/web/public/_headers', () => {
  const csp = /^\s*Content-Security-Policy:\s*(.+)$/m.exec(read('public/_headers'))?.[1] ?? '';

  it('allows every inline script of src/index.html by its hash', () => {
    const scripts = [...read('src/index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(csp).toContain(`'sha256-${createHash('sha256').update(script).digest('base64')}'`);
    }
  });

  it('keeps inline scripts and framing closed', () => {
    const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? '';
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).not.toContain('unsafe');
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
