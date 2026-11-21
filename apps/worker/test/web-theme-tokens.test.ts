import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const web = fileURLToPath(import.meta.resolve('../../web/'));
const css = readFileSync(web + 'src/themes/juyo-concept/tokens.css', 'utf8');

/**
 * The Juyo concept theme has a light and a dark mode in one file (docs/research/theme/juyo-concept-spec.md §14).
 * This test reads the CSS itself, so the promises the spec makes about the dark mode cannot drift from the values:
 * the structure of the two blocks, and the contrast of the pairs the theme is built on.
 */
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  expect(start, `block "${selector}"`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('\n}', start));
};
const declarations = (text: string) => new Map([...text.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));

const light = declarations(block("[data-theme='juyo-concept']"));
const dark = declarations(block("[data-theme='juyo-concept'].dark"));

/** A role as a hex colour in one mode: the dark block first when asked, then the light block, following `var()`. */
function resolve(name: string, mode: 'light' | 'dark'): string {
  const value = (mode === 'dark' ? dark.get(name) : undefined) ?? light.get(name);
  if (!value) throw new Error(`${name} is not declared`);
  const alias = /^var\((--[a-z0-9-]+)\)$/.exec(value);
  return alias ? resolve(alias[1]!, mode) : value;
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function ratio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const SURFACES = ['--background', '--card', '--popover', '--muted'];
const HUES = ['blue', 'violet', 'orange', 'teal', 'green', 'red', 'ochre', 'slate', 'plum'];

describe('the Juyo concept theme, tokens.css', () => {
  it('has a dark block that only sets tokens the light block declares', () => {
    // A light pane nested in a dark page gets every value back only if the light block declares it.
    expect(dark.size).toBeGreaterThan(90);
    expect([...dark.keys()].filter((name) => !light.has(name))).toEqual([]);
  });

  it('gives every colour scale a complete dark column', () => {
    const steps = [...Array.from({ length: 13 }, (_, i) => `--jc-ink-${i}`), ...HUES.flatMap((hue) => Array.from({ length: 8 }, (_, i) => `--jc-${hue}-${i + 1}`))];
    for (const step of steps) {
      expect(light.get(step), `${step}, light`).toMatch(/^#[0-9a-f]{6}$/);
      expect(dark.get(step), `${step}, dark`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('keeps the rail and the signal orange the same in both modes', () => {
    expect([...dark.keys()].filter((name) => name.startsWith('--jc-night-') || name === '--jc-orange-signal')).toEqual([]);
    expect(resolve('--rail', 'dark')).toBe('#101418');
  });

  it('uses no pure black and no pure white in the dark mode', () => {
    expect([...dark.values()].filter((value) => /^#(000000|ffffff)$/i.test(value))).toEqual([]);
  });

  it('lifts each dark layer above the one under it', () => {
    const ladder = ['--rail', '--background', '--card', '--popover', '--muted'].map((name) => luminance(resolve(name, 'dark')));
    expect(ladder).toEqual([...ladder].sort((a, b) => a - b));
    expect(new Set(ladder).size).toBe(ladder.length);
  });

  describe.each(['light', 'dark'] as const)('%s mode', (mode) => {
    const on = (fg: string, bg: string) => ratio(resolve(fg, mode), resolve(bg, mode));

    it('text reaches 4.5:1 on every surface', () => {
      for (const surface of SURFACES) {
        expect(on('--foreground', surface), `text on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(on('--muted-foreground', surface), `secondary text on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(on('--primary-foreground', '--primary')).toBeGreaterThanOrEqual(4.5);
      expect(on('--destructive-foreground', '--destructive-fill')).toBeGreaterThanOrEqual(4.5);
      expect(on('--on-signal', '--jc-orange-signal')).toBeGreaterThanOrEqual(4.5);
    });

    it('coloured text reaches 4.5:1 on a card, on the canvas and on its own tint', () => {
      for (const role of ['--link', '--decision', '--kassandra', '--positive', '--negative', '--destructive']) {
        expect(on(role, '--card'), `${role} on a card`).toBeGreaterThanOrEqual(4.5);
        expect(on(role, '--background'), `${role} on the canvas`).toBeGreaterThanOrEqual(4.5);
      }
      expect(on('--decision', '--decision-tint')).toBeGreaterThanOrEqual(4.5);
      expect(on('--kassandra', '--kassandra-tint')).toBeGreaterThanOrEqual(4.5);
      expect(on('--foreground', '--selected')).toBeGreaterThanOrEqual(4.5);
      expect(on('--muted-foreground', '--decision-tint')).toBeGreaterThanOrEqual(4.5);
    });

    it('chart marks, field borders and the focus ring reach 3:1', () => {
      for (const mark of ['--series', '--series-cmp', '--series-ref', '--series-muted', '--series-3', '--brass', '--cat-1', '--cat-2', '--cat-3', '--cat-4', '--cat-5', '--cat-6']) {
        expect(on(mark, '--card'), `${mark} on a card`).toBeGreaterThanOrEqual(3);
      }
      expect(on('--series', '--background')).toBeGreaterThanOrEqual(3);
      for (const surface of SURFACES) {
        expect(on('--border-control', surface), `field border on ${surface}`).toBeGreaterThanOrEqual(3);
        expect(on('--ring', surface), `focus ring on ${surface}`).toBeGreaterThanOrEqual(3);
      }
      expect(on('--on-inverse-ring', '--rail')).toBeGreaterThanOrEqual(3);
    });

    it('neighbouring categories differ by 2:1 or more in luminance', () => {
      for (let n = 1; n < 6; n++) expect(on(`--cat-${n}`, `--cat-${n + 1}`), `category ${n} against ${n + 1}`).toBeGreaterThanOrEqual(2);
    });

    it('every hue keeps its step promises: 5 is a graphic, 6 is text', () => {
      // The light column promises a graphic on the canvas, a card and a popover (ink 0 to 2); the dark one on a fill too.
      const graphicOn = mode === 'dark' ? SURFACES : SURFACES.filter((surface) => surface !== '--muted');
      for (const hue of HUES) {
        for (const surface of graphicOn) expect(on(`--jc-${hue}-5`, surface), `${hue}-5 on ${surface}`).toBeGreaterThanOrEqual(3);
        for (const surface of SURFACES) {
          // Known, spec §13: the light ochre-6 is 4.48:1 on a muted fill. Ochre is a chart category and is never set as text.
          if (mode === 'light' && hue === 'ochre' && surface === '--muted') continue;
          expect(on(`--jc-${hue}-6`, surface), `${hue}-6 on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(on(`--jc-${hue}-6`, `--jc-${hue}-1`), `${hue}-6 on its tint`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});
