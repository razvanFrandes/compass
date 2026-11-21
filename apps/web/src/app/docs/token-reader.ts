/*
  Reads design tokens from the page as it renders. The design-system page lists token names only; every value on
  it comes from `getComputedStyle`, so the page cannot disagree with the CSS and follows the theme switch.
*/

export type TokenKind = 'colour' | 'length' | 'time' | 'easing' | 'shadow' | 'font' | 'number' | 'other' | 'unset';

export interface TokenValue {
  name: string;
  /** The value the element resolves the custom property to; empty when the theme does not set it. */
  value: string;
  kind: TokenKind;
}

const COLOUR = /^(#[0-9a-f]{3,8}$|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|color-mix)\()/i;
const NAMED = new Set(['transparent', 'currentcolor', 'black', 'white']);
const LENGTH = /^-?[\d.]+(px|rem|em|ch|vh|vw|%)$/;
const TIME = /^-?[\d.]+m?s$/;
/** A shadow is one or more comma-separated layers with at least two lengths, or `none`. */
const SHADOW = /(^|,)\s*(inset\s+)?-?[\d.]+(px)?\s+-?[\d.]+(px)?/;

/** What a token's value is, from the value alone: the page shows a swatch for a colour, a bar for a length. */
export function classifyToken(value: string): TokenKind {
  const v = value.trim();
  if (!v) return 'unset';
  if (COLOUR.test(v) || NAMED.has(v.toLowerCase())) return 'colour';
  if (TIME.test(v)) return 'time';
  if (LENGTH.test(v)) return 'length';
  if (/^(cubic-bezier|steps|linear)\(/.test(v) || /^(ease|ease-in|ease-out|ease-in-out|linear)$/.test(v)) return 'easing';
  if (/^-?[\d.]+$/.test(v)) return 'number';
  if (SHADOW.test(v) && /(rgb|#|oklch|hsl|color)/i.test(v)) return 'shadow';
  if (/,/.test(v) && /(serif|sans|mono|system-ui|['"])/i.test(v)) return 'font';
  return 'other';
}

/** One custom property as `get` resolves it. `get` is `getComputedStyle(el).getPropertyValue` in the app. */
export function readToken(get: (name: string) => string, name: string): TokenValue {
  const value = (get(name) ?? '').trim();
  return { name, value, kind: classifyToken(value) };
}

export function readTokens(get: (name: string) => string, names: readonly string[]): TokenValue[] {
  return names.map((name) => readToken(get, name));
}

/** The tokens an element resolves, in the theme it sits in. */
export function readTokensOf(el: Element, names: readonly string[]): TokenValue[] {
  const style = getComputedStyle(el);
  return readTokens((name) => style.getPropertyValue(name), names);
}

/** A length in px ("0.75rem" → 12 at a 16px root), for drawing it to scale. Null when it is not a plain length. */
export function toPx(value: string, rootPx = 16): number | null {
  const m = value.trim().match(/^(-?[\d.]+)(px|rem|em)$/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return m[2] === 'px' ? n : n * rootPx;
}

/** A duration in ms ("0.11s" → 110). Null when it is not a time. */
export function toMs(value: string): number | null {
  const m = value.trim().match(/^(-?[\d.]+)(ms|s)$/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Math.round(m[2] === 's' ? n * 1000 : n);
}

/** Long values (a font stack, a two-layer shadow) are cut for the table; the full value stays in `title`. */
export function shortValue(value: string, max = 56): string {
  const v = value.trim().replace(/\s+/g, ' ');
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}
