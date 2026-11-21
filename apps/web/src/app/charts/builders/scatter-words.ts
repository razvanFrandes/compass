import type { Corner } from './quadrant';

/*
  The words of the comp-set quadrant: price (rate index, ARI) across, share of demand (MPI) up, 100 = the comp set.
  Jargon stays in the tooltip's last line; the chart itself speaks plainly.
*/

/** What each corner means, long (wide cards) and short (phones). */
export const COMP_SET_CORNERS: Record<Corner, { long: string; short: string }> = {
  tr: { long: 'Pricier, still winning guests', short: 'Pricier, winning' },
  tl: { long: 'Cheaper, winning guests', short: 'Cheaper, winning' },
  br: { long: 'Pricier, losing guests', short: 'Pricier, losing' },
  bl: { long: 'Cheaper and losing guests', short: 'Cheaper, losing' },
};

/** The glyph that goes with each corner's colour, so colour is never the only cue. */
export const CORNER_GLYPH: Record<Corner, string> = { tr: '▲', tl: '●', br: '◆', bl: '▼' };

/** Rate index across and share index up: the comp-set quadrant. */
export function isCompSetPair(xKey: string, xLabel: string, yKey: string, yLabel: string): boolean {
  const rate = /(^|_)(ari|rate_index|ari_index)(_|$)/i.test(xKey) || /\bARI\b|rate index/i.test(xLabel);
  const share = /(^|_)(mpi|share_index|mpi_index|penetration)(_|$)/i.test(yKey) || /\bMPI\b|share index|penetration/i.test(yLabel);
  return rate && share;
}

/** "+4%", "−11%", "Comp set": an index read against 100. */
export function vsCompSet(v: number): string {
  const d = v - 100;
  if (Math.abs(d) < 0.05) return 'Comp set';
  const n = Math.abs(d) < 10 ? Math.round(Math.abs(d) * 10) / 10 : Math.round(Math.abs(d));
  return `${d > 0 ? '+' : '−'}${n}%`;
}

/** "4.4% more than the comp set", "the same as the comp set". */
export function vsCompSetWords(v: number, more: string, less: string): string {
  const d = v - 100;
  if (Math.abs(d) < 0.05) return 'same as comp set';
  const n = Math.abs(d) < 10 ? Math.round(Math.abs(d) * 10) / 10 : Math.round(Math.abs(d));
  return `${n}% ${d > 0 ? more : less}`;
}
