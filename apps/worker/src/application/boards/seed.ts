import type { Board, BoardWidget, Evidence, WidgetSpec } from '@compass/contracts';
import { err, ok, type Result } from '../../domain/result.ts';
import { columnsFor } from '../widgets/columns.ts';
import { fitWidget } from '../widgets/fit.ts';

/**
 * The sample boards a new demo starts with, so the Boards page is never empty. They are built like any board widget:
 * a catalog tool returns rows and evidence from the database, and a spec that fits those rows draws them. Nothing here
 * is a typed number. Periods are relative to the data's business date.
 */

type Row = Record<string, unknown>;
/** Runs a catalog data tool by name: its rows and evidence, or the text of its failure. */
export type RunDataTool = (name: string, args: Record<string, unknown>) => Promise<Result<{ rows: Row[]; evidence: Evidence }, string>>;

/** A day `offset` days from the business date, as an ISO date. */
type Day = (offset: number) => string;

interface SeedWidget {
  tool: string;
  args: (day: Day) => Record<string, unknown>;
  spec: Omit<WidgetSpec, 'sourceCallId'>;
  /** The question that gives this widget in Kassandra, for "ask about this". */
  question: string;
}

interface SeedBoard {
  id: string;
  name: string;
  description: string;
  hotels: string[];
  widgets: SeedWidget[];
}

const last30 = (day: Day) => ({ from: day(-30), to: day(-1) });
const next45 = (day: Day) => ({ from: day(0), to: day(44) });

export const SEED_BOARDS: readonly SeedBoard[] = [
  {
    id: 'portfolio',
    name: 'Portfolio overview',
    description: 'All 20 hotels: occupancy, RevPAR, pace and profit against last year and budget',
    hotels: [],
    widgets: [
      {
        tool: 'get_metric',
        args: (day) => ({ metric: 'occupancy', by: 'group', ...last30(day), grain: 'total', compare: 'stly' }),
        spec: { kind: 'kpi', title: 'Group occupancy against last year', subtitle: 'All 20 hotels · last 30 nights', y: ['value'], compare: 'compare_value', format: 'percent' },
        question: 'What was group occupancy over the last 30 nights against last year?',
      },
      {
        tool: 'get_metric',
        args: (day) => ({ metric: 'occupancy', by: 'group', from: day(-84), to: day(-1), grain: 'week', compare: 'stly' }),
        spec: { kind: 'line', title: 'Group occupancy by week against last year', subtitle: 'All 20 hotels · last 12 weeks', x: 'period', y: ['value'], compare: 'compare_value', format: 'percent' },
        question: 'How has group occupancy moved week by week over the last 12 weeks against last year?',
      },
      {
        tool: 'get_metric',
        args: (day) => ({ metric: 'revpar', by: 'hotel', ...last30(day), grain: 'total', compare: 'stly' }),
        spec: { kind: 'bar', title: 'RevPAR by hotel against last year', subtitle: 'All 20 hotels · last 30 nights · EUR', x: 'key', y: ['value'], compare: 'compare_value', format: 'currency' },
        question: 'Which hotels have the highest and lowest RevPAR over the last 30 nights, against last year?',
      },
      {
        tool: 'get_pace',
        args: () => ({ daysAhead: 45 }),
        spec: { kind: 'bar', title: 'Pace against last year by hotel', subtitle: 'All 20 hotels · next 45 nights', x: 'hotel_code', y: ['pace_pct'] },
        question: 'Which hotels are pacing behind last year for the next 45 nights?',
      },
      {
        tool: 'get_pnl',
        args: (day) => ({ by: 'hotel', from: day(-90), to: day(-1), grain: 'total' }),
        spec: { kind: 'table', title: 'Revenue and GOP against budget by hotel', subtitle: 'All 20 hotels · last 3 months', y: ['key', 'revenue_eur', 'revenue_var_pct', 'gop_eur', 'gop_var_pct', 'gop_margin_pct'] },
        question: 'How do revenue and GOP compare with budget by hotel over the last 3 months?',
      },
    ],
  },
  {
    id: 'dubai-business-bay',
    name: 'Dubai Business Bay',
    description: 'Pace, rates and occupancy for the nights that need a decision',
    hotels: ['DXB2'],
    widgets: [
      {
        tool: 'get_pace',
        args: () => ({ hotels: ['DXB2'], daysAhead: 45 }),
        spec: { kind: 'kpi', title: 'Pace against last year', subtitle: 'Tessera Dubai Business Bay · next 45 nights', y: ['pace_pct'] },
        question: 'How is Tessera Dubai Business Bay pacing against last year for the next 45 nights?',
      },
      {
        tool: 'get_rate_position',
        args: (day) => ({ hotels: ['DXB2'], ...next45(day) }),
        spec: { kind: 'line', title: 'Our BAR against the comp set median by night', subtitle: 'Tessera Dubai Business Bay · next 45 nights · local currency', x: 'stay_date', y: ['bar_rate', 'comp_median'] },
        question: 'How does our BAR at Tessera Dubai Business Bay compare with the comp set for the next 45 nights?',
      },
      {
        tool: 'get_rate_position',
        args: (day) => ({ hotels: ['DXB2'], ...next45(day) }),
        spec: { kind: 'calendar_heatmap', title: 'BAR against the comp set median by night (above or below it, in %)', subtitle: 'Tessera Dubai Business Bay · next 45 nights', x: 'stay_date', y: ['bar_vs_comp'] },
        question: 'On which nights is Tessera Dubai Business Bay priced under the comp set?',
      },
      {
        tool: 'get_metric',
        args: (day) => ({ metric: 'occupancy', hotels: ['DXB2'], ...next45(day), grain: 'day', compare: 'stly' }),
        spec: { kind: 'area', title: 'Occupancy on the books by night against last year', subtitle: 'Tessera Dubai Business Bay · next 45 nights', x: 'period', y: ['value'], compare: 'compare_value', format: 'percent' },
        question: 'What is occupancy on the books at Tessera Dubai Business Bay for the next 45 nights against last year?',
      },
    ],
  },
  {
    id: 'amsterdam-web',
    name: 'Amsterdam website',
    description: 'Mobile conversion and where the bookings came from',
    hotels: ['AMS'],
    widgets: [
      {
        tool: 'get_web_funnel',
        args: (day) => ({ hotels: ['AMS'], ...last30(day), grain: 'total', by: 'device' }),
        spec: { kind: 'funnel', title: 'Booking funnel by device', subtitle: 'Arbor Amsterdam Centraal · last 30 days', x: 'key', y: ['sessions', 'searches', 'checkout_starts', 'bookings'] },
        question: 'Where does the booking funnel of Arbor Amsterdam Centraal lose visitors, by device, over the last 30 days?',
      },
      {
        tool: 'get_web_funnel',
        args: (day) => ({ hotels: ['AMS'], from: day(-84), to: day(-1), grain: 'week', by: 'device' }),
        spec: { kind: 'line', title: 'Website conversion by device, by week', subtitle: 'Arbor Amsterdam Centraal · last 12 weeks', x: 'period', y: ['conversion_pct'], group: 'key' },
        question: 'How has website conversion at Arbor Amsterdam Centraal moved by device over the last 12 weeks?',
      },
      {
        tool: 'get_web_funnel',
        args: (day) => ({ hotels: ['AMS'], ...last30(day), grain: 'total', by: 'device' }),
        spec: { kind: 'bar', title: 'Checkout completion by device', subtitle: 'Arbor Amsterdam Centraal · last 30 days', x: 'key', y: ['checkout_completion_pct'] },
        question: 'How many visitors who start a checkout at Arbor Amsterdam Centraal finish it, by device?',
      },
      {
        tool: 'get_mix',
        args: (day) => ({ hotels: ['AMS'], ...last30(day), grain: 'total', by: 'channel_type', basis: 'booked' }),
        spec: { kind: 'donut', title: 'Room nights booked by channel type', subtitle: 'Arbor Amsterdam Centraal · booked in the last 30 days', group: 'key', y: ['room_nights'] },
        question: 'Where did the bookings of Arbor Amsterdam Centraal come from in the last 30 days, by channel type?',
      },
    ],
  },
];

const DAY_MS = 86_400_000;

/**
 * Builds the sample boards. A widget whose tool fails or whose rows do not fit its kind is left out, and so is a board
 * left with no widget. When nothing at all could be built (the data source is down) the whole build fails, so the caller
 * tries again later instead of recording an empty demo as seeded.
 */
export async function buildSeedBoards(run: RunDataTool, businessDate: string, now: Date): Promise<Result<Board[], string>> {
  const day: Day = (offset) => new Date(Date.parse(businessDate) + offset * DAY_MS).toISOString().slice(0, 10);
  const boards: Board[] = [];
  let lastFailure = 'no widget is planned.';

  for (const [boardIndex, seed] of SEED_BOARDS.entries()) {
    // One millisecond apart, so the boards list in this order.
    const at = new Date(now.getTime() + boardIndex).toISOString();
    // The widgets of a board are read at once (at most 5, the size of the connection pool) and kept in their order.
    const built = await Promise.all(
      seed.widgets.map(async (planned, index): Promise<Result<BoardWidget, string>> => {
        const result = await run(planned.tool, planned.args(day));
        if (!result.ok) return result;
        const { rows, evidence } = result.value;
        const columns = columnsFor(rows, evidence);
        const fitted = fitWidget({ ...planned.spec, sourceCallId: `seed:${seed.id}:${index + 1}` }, { rows, columns });
        if (!fitted.ok) return err(`${seed.id} widget ${index + 1} does not fit its rows: ${fitted.error}`);
        return ok({ id: `w-${seed.id}-${index + 1}`, spec: fitted.value, rows, columns, evidence, question: planned.question, addedAt: at });
      }),
    );
    const widgets = built.flatMap((widget) => (widget.ok ? [widget.value] : []));
    for (const widget of built) if (!widget.ok) lastFailure = widget.error;
    if (widgets.length) boards.push({ id: seed.id, name: seed.name, description: seed.description, hotels: seed.hotels, widgets, createdAt: at, updatedAt: at });
  }
  return boards.length ? ok(boards) : err(`No sample widget could be built: ${lastFailure}`);
}
