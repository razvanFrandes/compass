/*
  Chart colours come from the design tokens in styles.css, read from the element that hosts the chart, so a
  chart follows whichever theme surrounds it. The two constants are the same values, for tests and as fallbacks.

  Colour jobs (docs/decisions.md): current period blue, comparison purple dashed, teal as the second series,
  orange only for "needs a decision", green/red only with ▲/▼. Categorical charts take the hues in this fixed
  order and never cycle: the sixth part is a tint, everything after it is grey.
  The five-hue order passes colour-blind separation (ΔE ≥ 8 adjacent) and 3:1 against the card in both themes.
*/

export interface ChartTokens {
  mode: 'dark' | 'light';
  /** Primary ink: titles, hero values. */
  fg: string;
  /** Body ink: direct labels. */
  text: string;
  /** Axis ticks, secondary labels. */
  muted: string;
  /** Hairlines. */
  grid: string;
  /** The surface the chart sits on: gaps and rings are drawn in it. */
  surface: string;
  popover: string;
  border: string;
  /** Current period. */
  series: string;
  /** Comparison period (last year, budget). */
  cmp: string;
  /** Neutral reference marks. */
  ref: string;
  grey: string;
  decision: string;
  pos: string;
  neg: string;
  /** Categorical hues in their fixed order. */
  cat: readonly string[];
}

export const DARK_TOKENS: ChartTokens = {
  mode: 'dark',
  fg: '#eef1f4',
  text: '#e6edf3',
  muted: '#9ba3ad',
  grid: 'rgb(255 255 255 / 0.06)',
  surface: '#161c22',
  popover: '#1e2429',
  border: '#2a2e33',
  series: '#5b8deb',
  cmp: '#9685e4',
  ref: '#b7bfc8',
  grey: '#8b949e',
  decision: '#fe7637',
  pos: '#4cc38a',
  neg: '#f0616d',
  cat: ['#5b8deb', '#32bebf', '#9685e4', '#d9a441', '#e07bb0'],
};

export const LIGHT_TOKENS: ChartTokens = {
  mode: 'light',
  fg: '#101418',
  text: '#101418',
  muted: '#5e6670',
  grid: 'rgb(16 20 24 / 0.07)',
  surface: '#ffffff',
  popover: '#ffffff',
  border: '#d9dce1',
  series: '#2f66d0',
  cmp: '#7a68d8',
  ref: '#57606a',
  grey: '#8c959f',
  decision: '#c2410c',
  pos: '#1f7a55',
  neg: '#c2333f',
  cat: ['#2f66d0', '#1f8f90', '#7a68d8', '#a8740f', '#c2528f'],
};

/** The two categorical hues the app's tokens do not have yet (amber, pink), per theme. */
export const EXTRA_CAT = { dark: ['#d9a441', '#e07bb0'], light: ['#a8740f', '#c2528f'] } as const;

/** Reads the tokens in effect on `el` (falls back to the constants where a token is missing). */
export function readTokens(el: Element): ChartTokens {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const surface = v('--wc-surface', '') || v('--card', DARK_TOKENS.surface);
  const mode: 'dark' | 'light' = luminance(surface) > 0.4 ? 'light' : 'dark';
  const f = mode === 'light' ? LIGHT_TOKENS : DARK_TOKENS;
  const series = v('--series', f.series);
  const cmp = v('--series-cmp', f.cmp);
  return {
    mode,
    fg: v('--foreground', f.fg),
    text: v('--text-1', f.text),
    muted: v('--muted-foreground', f.muted),
    grid: v('--grid', f.grid),
    surface,
    popover: v('--popover', f.popover),
    border: v('--field-border', f.border),
    series,
    cmp,
    ref: v('--series-ref', f.ref),
    grey: v('--series-muted', f.grey),
    decision: v('--decision', f.decision),
    pos: v('--positive', f.pos),
    neg: v('--negative', f.neg),
    // The extra hues follow the surface, not a global class, so a scoped theme preview gets the right pair.
    cat: [series, v('--series-3', f.cat[1]), cmp, EXTRA_CAT[mode][0], EXTRA_CAT[mode][1]],
  };
}

function rgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** `t` of colour `a` over `b` (1 = all `a`). Non-hex colours pass through unchanged. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return a;
  const c = x.map((n, i) => Math.round(n * t + y[i] * (1 - t)));
  return `#${c.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const c = rgb(hex);
  if (!c) return 0;
  const [r, g, b] = c.map((n) => {
    const s = n / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** Ink for a label printed inside a fill: near-black or white, whichever reads better. */
export function inkOn(fill: string): string {
  return contrast('#0d1117', fill) >= contrast('#ffffff', fill) ? '#0d1117' : '#ffffff';
}

/** The colour of categorical part `i`: five hues, then a tint of the first, then grey. "Other" is always grey. */
export function catColor(t: ChartTokens, i: number, name?: string): string {
  if (name && /^(other|others|rest|unknown)$/i.test(name.trim())) return t.grey;
  if (i < t.cat.length) return t.cat[i];
  if (i === t.cat.length) return mix(t.series, t.surface, 0.5);
  return t.grey;
}

/** Sequential ramp for magnitude: one hue, from near the surface up to the full series colour. */
export function seqRamp(t: ChartTokens, steps = 5): string[] {
  const lo = t.mode === 'dark' ? 0.16 : 0.12;
  return Array.from({ length: steps }, (_, i) => mix(t.series, t.surface, lo + ((1 - lo) * i) / Math.max(1, steps - 1)));
}

/** The ramp colour for `v` between `min` and `max`, interpolated continuously. */
export function seqColor(t: ChartTokens, v: number, min: number, max: number): string {
  const lo = t.mode === 'dark' ? 0.16 : 0.12;
  const p = max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 1;
  return mix(t.series, t.surface, lo + (1 - lo) * p);
}
