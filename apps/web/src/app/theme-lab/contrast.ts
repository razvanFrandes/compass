/**
 * Contrast maths for the theme lab. WCAG 2.2 is the gate (1.4.3 text 4.5:1, 1.4.11 graphics and control
 * borders 3:1); APCA is shown next to it as a second reading, because it tracks perceived contrast better for
 * small text and dark surfaces. Both work on 8-bit sRGB.
 */
export type Rgb = readonly [number, number, number];

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance. */
export const luminance = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** WCAG 2.x contrast ratio, 1 to 21. Not rounded: 4.499 is a fail. */
export function wcagRatio(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// APCA 0.0.98G-4g (the constants of the public apca-w3 reference implementation).
const apcaY = ([r, g, b]: Rgb) => {
  const y = 0.2126729 * (r / 255) ** 2.4 + 0.7151522 * (g / 255) ** 2.4 + 0.072175 * (b / 255) ** 2.4;
  return y > 0.022 ? y : y + (0.022 - y) ** 1.414;
};

/** APCA lightness contrast (Lc) of text on a background. Positive for dark text on light, negative for the reverse. */
export function apcaLc(text: Rgb, background: Rgb) {
  const yText = apcaY(text);
  const yBg = apcaY(background);
  if (Math.abs(yBg - yText) < 0.0005) return 0;
  if (yBg > yText) {
    const sapc = (yBg ** 0.56 - yText ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  }
  const sapc = (yBg ** 0.65 - yText ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}

export const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** What a pair is for, and the WCAG ratio it must reach. */
export type PairKind = 'text' | 'graphic';
export const REQUIRED: Record<PairKind, number> = { text: 4.5, graphic: 3 };
export const passes = (ratio: number, kind: PairKind) => ratio >= REQUIRED[kind];
