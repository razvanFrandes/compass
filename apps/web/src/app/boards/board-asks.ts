import type { AskExample } from '../charts/ask-examples';
import { hotelLabel } from '../charts/hotel-names';

/** The Prompts menu on the Boards page: questions that build a board, or a chart worth keeping on one. */
export const BOARDS_ASKS: readonly AskExample[] = [
  { kind: 'bar', question: 'Build me a board for Lisbon’s pace and pickup' },
  { kind: 'bar', question: 'Show RevPAR by hotel against last year' },
  { kind: 'calendar_heatmap', question: 'On which nights is Dubai Business Bay priced under its comp set?' },
  { kind: 'kpi_row', question: 'Group occupancy, ADR and RevPAR for the next 30 nights against last year' },
];

/** The hotels a board is about, as a person names them: one, two, "3 hotels", or the whole group. */
function scopeName(hotels: readonly string[], name: (code: string) => string): string {
  if (!hotels.length) return 'all hotels';
  if (hotels.length === 1) return name(hotels[0]!);
  if (hotels.length === 2) return `${name(hotels[0]!)} and ${name(hotels[1]!)}`;
  return `these ${hotels.length} hotels`;
}

/** The Prompts menu on a board: charts to add, about the board's own hotels. */
export function boardAsks(hotels: readonly string[], name: (code: string) => string = (code) => hotelLabel(code, 'full')): AskExample[] {
  const scope = scopeName(hotels, name);
  return [
    { kind: 'kpi', question: `Pace against last year for ${scope}, next 45 nights` },
    { kind: 'area', question: `Occupancy on the books by night for ${scope} against last year` },
    { kind: 'calendar_heatmap', question: `Our rate against the comp set by night for ${scope}` },
    { kind: 'donut', question: `Room nights by channel for ${scope}, booked in the last 30 days` },
  ];
}
