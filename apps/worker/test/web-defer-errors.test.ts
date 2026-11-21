import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = fileURLToPath(import.meta.resolve('../../web/src/app/'));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

/** The text of each `@defer` block with its connected `@placeholder`/`@loading`/`@error` blocks. */
function deferBlocks(code: string): string[] {
  const blocks: string[] = [];
  let at = code.indexOf('@defer');
  while (at !== -1) {
    let i = code.indexOf('{', at);
    let end = i;
    // The defer block, then any chained `} @placeholder {`, `} @loading {`, `} @error {` blocks.
    for (;;) {
      let depth = 0;
      for (; i < code.length; i++) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}' && --depth === 0) break;
      }
      end = i;
      const next = /^\s*@(placeholder|loading|error)\b[^{]*\{/.exec(code.slice(i + 1));
      if (!next) break;
      i = i + 1 + next[0].length - 1;
    }
    blocks.push(code.slice(at, end + 1));
    at = code.indexOf('@defer', end);
  }
  return blocks;
}

/**
 * A deploy replaces the app's hashed chunks, and a missing chunk is answered with index.html (the single-page
 * fallback). A `@defer` block without `@error` then shows its placeholder forever: the builder stayed on
 * "Opening the agent builder…" (r5/builder-open). Every deferred page must handle the failure.
 */
describe('@defer blocks in apps/web', () => {
  const files = sources(src).map((path) => ({ path, blocks: deferBlocks(readFileSync(path, 'utf8')) })).filter((file) => file.blocks.length);

  it('finds the deferred pages', () => {
    expect(files.some((file) => file.path.endsWith('app.ts'))).toBe(true);
  });

  it('each has an @error block, so a chunk that fails to load never leaves a placeholder on screen', () => {
    const missing = files.flatMap((file) => file.blocks.filter((block) => !/@error\b/.test(block)).map((block) => `${file.path}: ${block.split('\n')[0]}`));
    expect(missing).toEqual([]);
  });
});
