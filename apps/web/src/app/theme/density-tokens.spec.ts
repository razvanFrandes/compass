import { DENSITY_TOKENS, LAYOUT_CONSTANTS } from './density';

/*
  src/density.css is the source of the values; DENSITY_TOKENS is what the theme lab and the docs list. This reads
  the stylesheet from disk and checks that the two agree, that both densities set every token, and that the
  Tailwind utilities and the names the brief was promised (docs/research/layout/tokens.md) exist.
*/
describe('density tokens (src/density.css)', () => {
  let css = '';
  /** The declarations of the first rule whose selector list starts with `selector`. */
  const block = (selector: string): Record<string, string> => {
    const start = css.indexOf(`\n${selector}`);
    expect(start, `no rule for ${selector}`).toBeGreaterThan(-1);
    const open = css.indexOf('{', start);
    const body = css.slice(open + 1, css.indexOf('}', open)).replace(/\/\*[\s\S]*?\*\//g, '');
    return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  };

  beforeAll(async () => {
    // Node's fs, loaded by a name the bundler does not follow: the spec runs in Node with a DOM.
    const fsName = 'node:fs';
    const fs = (await import(/* @vite-ignore */ fsName)) as { readFileSync(path: string, encoding: string): string };
    const cwd = (globalThis as unknown as { process: { cwd(): string } }).process.cwd();
    css = fs.readFileSync(`${cwd}/src/density.css`, 'utf8');
  });

  it('sets every density token for comfortable, on :root and on a comfortable region', () => {
    const start = css.indexOf('\n:root,');
    expect(css.slice(start, css.indexOf('{', start))).toContain("[data-density='comfortable']");
    const comfortable = block(':root,');
    for (const token of DENSITY_TOKENS) expect(comfortable[token.name], token.name).toBe(token.comfortable);
    expect(Object.keys(comfortable).sort()).toEqual(DENSITY_TOKENS.map((t) => t.name).sort());
  });

  it('sets the same tokens for compact, each one smaller or equal', () => {
    const compact = block("[data-density='compact']");
    for (const token of DENSITY_TOKENS) {
      expect(compact[token.name], token.name).toBe(token.compact);
      expect(parseFloat(token.compact), token.name).toBeLessThanOrEqual(parseFloat(token.comfortable));
    }
    expect(Object.keys(compact).sort()).toEqual(DENSITY_TOKENS.map((t) => t.name).sort());
  });

  it('has the values of the brief: gutter 24/16, section 32/24, card gap 16/8, card padding 24/16, stack 12/8, rows 40/32, controls 36/32', () => {
    const px = (name: string) => {
      const token = DENSITY_TOKENS.find((t) => t.name === name)!;
      return [parseFloat(token.comfortable) * 16, parseFloat(token.compact) * 16];
    };
    expect(px('--space-page-x')).toEqual([24, 16]);
    expect(px('--space-section')).toEqual([32, 24]);
    expect(px('--space-section-lg')).toEqual([48, 32]);
    expect(px('--space-card-gap')).toEqual([16, 8]);
    expect(px('--space-card-pad')).toEqual([24, 16]);
    expect(px('--space-stack')).toEqual([12, 8]);
    expect(px('--row-h')).toEqual([40, 32]);
    expect(px('--control-h')).toEqual([36, 32]);
  });

  it('never changes a font size with the density', () => {
    const sized = (rule: Record<string, string>) => Object.keys(rule).filter((name) => /^--(text|font|type)-/.test(name));
    expect(sized(block(':root,'))).toEqual([]);
    expect(sized(block("[data-density='compact']"))).toEqual([]);
  });

  it('keeps overlays comfortable and touch targets at 44 px', () => {
    const start = css.indexOf('\n:root,');
    const selector = css.slice(start, css.indexOf('{', start));
    for (const overlay of ['dialog', "[role='dialog']", "[role='menu']", '[data-overlay]']) expect(selector).toContain(overlay);
    const touch = css.slice(css.indexOf('@media (pointer: coarse)'));
    expect(touch).toMatch(/--control-h:\s*2\.75rem/);
    expect(touch).toMatch(/--row-h:\s*2\.75rem/);
  });

  it('declares the layout constants', () => {
    const constants = block(':root {');
    for (const token of LAYOUT_CONSTANTS) expect(constants[token.name], token.name).toBe(token.value);
  });

  it('maps the tokens into Tailwind utilities', () => {
    const start = css.indexOf('@theme inline');
    const theme = css.slice(start, css.indexOf('}', start));
    // The names the research gives, which the brief consumes.
    for (const [key, token] of [
      ['--spacing-page-x', '--space-page-x'],
      ['--spacing-section', '--space-section'],
      ['--spacing-card-gap', '--space-card-gap'],
      ['--spacing-card-pad', '--space-card-pad'],
      ['--spacing-stack', '--space-stack'],
      ['--spacing-row', '--row-h'],
      ['--spacing-control', '--control-h'],
      ['--container-content', '--content-max'],
    ]) {
      expect(theme).toContain(`${key}: var(${token});`);
    }
    for (const name of ['--text-label', '--text-body', '--text-card-title', '--text-section', '--text-kpi', '--text-kpi-sm']) expect(css).toContain(`${name}:`);
    expect(css).toContain('.num {');
  });
});
