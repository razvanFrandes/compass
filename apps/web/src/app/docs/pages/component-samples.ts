import type { Evidence, EvidenceColumn, Proposal, WidgetKind, WorkflowDraft } from '@compass/contracts';
import type { ChatTurn, ChatWidget } from '../../api';
import type { EvidenceEntry } from '../../evidence/types';

/*
  Sample data for /docs/components. It is shaped like what the Halcyon tools return (the same hotels and stories
  as the brief), so each real component renders the way it does in the product. None of it is fetched.
*/

/** One line per widget kind: when Kassandra should reach for it. */
export const WHEN_TO_USE: Record<WidgetKind, string> = {
  kpi: 'One figure and its change: the headline of an answer.',
  kpi_row: 'Three to five related figures, read side by side.',
  gauge: 'One value against a target, such as occupancy against budget.',
  sparkline_list: 'The same trend for many hotels, to spot the one that differs.',
  bullet: 'Actual against a target for a short list of hotels.',
  line: 'A trend over ordered dates, with last year as a dashed line.',
  area: 'A cumulative build-up over time, such as pickup.',
  calendar_heatmap: 'One value per night across months: where the year is full or thin.',
  bar: 'Rank a handful of hotels, channels or segments.',
  grouped_bar: 'Two series per category, such as actual and budget by month.',
  stacked_bar: 'How a total splits, and how the split moves over time.',
  waterfall: 'How one total becomes another, step by step.',
  radar: 'A profile across five to seven indexes, against parity.',
  donut: 'Two to seven parts of one whole. The server refuses anything else.',
  pie: 'Parts of one whole when there are very few of them.',
  treemap: 'Parts of a whole on two levels, such as region and hotel.',
  funnel: 'Stages that shrink, such as search to booking.',
  sankey: 'Where a total flows to, such as revenue to commission and net.',
  scatter: 'Two measures per hotel, to find the outliers.',
  heatmap: 'One value across two categories, such as hotel by weekday.',
  table: 'Exact values, when the reader will look rows up.',
};

const PACE_COLUMNS: EvidenceColumn[] = [
  { key: 'hotel_code', label: 'Hotel', kind: 'hotel' },
  { key: 'rooms_otb', label: 'On the books', kind: 'count', unit: 'room nights' },
  { key: 'rooms_otb_stly', label: 'Same time last year', kind: 'count', unit: 'room nights' },
  { key: 'pace_pct', label: 'Pace vs last year', kind: 'percent' },
  { key: 'revenue_otb_eur', label: 'Revenue on the books', kind: 'currency', unit: 'EUR' },
];

export const PACE_ROWS: Record<string, unknown>[] = [
  { hotel_code: 'LIS', rooms_otb: 2231, rooms_otb_stly: 2700, pace_pct: -17.4, revenue_otb_eur: 412300 },
  { hotel_code: 'NYC', rooms_otb: 5120, rooms_otb_stly: 5890, pace_pct: -13.1, revenue_otb_eur: 1930400 },
  { hotel_code: 'AMS', rooms_otb: 3010, rooms_otb_stly: 3105, pace_pct: -3.1, revenue_otb_eur: 702900 },
  { hotel_code: 'BCN', rooms_otb: 4388, rooms_otb_stly: 4301, pace_pct: 2.0, revenue_otb_eur: 866200 },
  { hotel_code: 'DXB2', rooms_otb: 4420, rooms_otb_stly: 3980, pace_pct: 11.1, revenue_otb_eur: 968000 },
];

export const PACE_EVIDENCE: Evidence = {
  title: 'Pace vs last year',
  sources: ['hotel.pace_vs_stly()'],
  sourceLabels: { 'hotel.pace_vs_stly()': 'Pace against the same time last year' },
  definitions: {
    'On the books': 'Rooms booked and not cancelled, as of the business date.',
    'Last year': 'The same weekday 364 days earlier, at the same lead time.',
  },
  period: { from: '2026-11-21', to: '2027-01-04' },
  sql: "select hotel_code, rooms_otb, rooms_otb_stly, pace_pct, revenue_otb_eur\nfrom hotel.pace_vs_stly($1::date, $2::date)\nwhere hotel_code = any($3)\norder by pace_pct",
  params: ['2026-11-21', '2027-01-04', ['LIS', 'NYC', 'AMS', 'BCN', 'DXB2']],
  rowCount: PACE_ROWS.length,
  businessDate: '2026-11-20',
  notes: ['Scope: only LIS, NYC, AMS, BCN, DXB2.'],
  columns: PACE_COLUMNS,
};

export const PACE_COLUMNS_PUBLIC = PACE_COLUMNS;

export const PACE_ANSWER =
  'Lisbon Chiado has **2,231 room nights** on the books for the next 45 nights, against 2,700 at the same point last year: **17.4% behind**. New York Midtown is next, 13.1% behind. Dubai Business Bay is 11.1% ahead, which is Gulf Tech Week.\n\n- Lisbon’s gap is in pickup, not cancellations.\n- Its BAR sits above the comp-set median on most of those nights.';

const HOTEL_NAMES: Record<string, string> = { LIS: 'Lisbon Chiado', NYC: 'New York Midtown', AMS: 'Amsterdam Centraal', BCN: 'Barcelona Mar', DXB2: 'Dubai Business Bay' };

/** The widget Kassandra drew from that result: the same rows, with the hotel by name on the axis. */
const PACE_WIDGET: ChatWidget = {
  kind: 'bar',
  title: 'Lisbon and New York are the furthest behind last year',
  subtitle: 'Pace vs last year · stays 21 Nov 2026 – 4 Jan 2027',
  sourceCallId: 'docs-pace',
  x: 'hotel',
  y: ['pace_pct'],
  format: 'percent',
  rows: PACE_ROWS.map((r) => ({ hotel: HOTEL_NAMES[String(r['hotel_code'])] ?? r['hotel_code'], pace_pct: r['pace_pct'] })),
  columns: [
    { key: 'hotel', label: 'Hotel', kind: 'text' },
    { key: 'pace_pct', label: 'Pace vs last year', kind: 'percent' },
  ],
  evidence: PACE_EVIDENCE,
};

/** One finished turn: a question, two steps (a data tool and a widget) and the answer. */
export const SAMPLE_TURNS: ChatTurn[] = [
  {
    key: 'docs-turn',
    question: 'Which hotels are pacing behind last year for the next 45 nights?',
    pending: false,
    steps: [
      { callId: 'docs-pace', name: 'get_pace', args: { hotels: ['LIS', 'NYC', 'AMS', 'BCN', 'DXB2'], from: '2026-11-21', to: '2027-01-04' }, status: 'done', narration: '', rows: PACE_ROWS, evidence: PACE_EVIDENCE },
      { callId: 'docs-widget', name: 'show_widget', args: { kind: 'bar', title: PACE_WIDGET.title, sourceCallId: 'docs-pace' }, status: 'done', narration: '', widget: PACE_WIDGET },
    ],
    answer: PACE_ANSWER,
    streamingText: '',
    running: false,
    failure: null,
    workedMs: 9400,
    model: 'claude-sonnet-5.5',
    usage: { tokens: 18420, costUsd: 0.071 },
    events: [],
  },
];

export const SAMPLE_ENTRIES: EvidenceEntry[] = [
  { callId: 'docs-pace', name: 'get_pace', args: { hotels: ['LIS', 'NYC', 'AMS', 'BCN', 'DXB2'], from: '2026-11-21', to: '2027-01-04' }, rows: PACE_ROWS, evidence: PACE_EVIDENCE, status: 'done' },
];

export const SAMPLE_PROPOSAL: Proposal = {
  id: 'docs-sample',
  workflowId: 'docs-workflow',
  runId: 'docs-run',
  hotel_code: 'DXB2',
  action: 'adjust_bar',
  title: 'Raise BAR to the comp-set median for 16–18 Dec',
  rationale: 'Gulf Tech Week. BAR is 0.78× the comp-set median while the hotel is already 83% full, and three competitors are sold out on the peak night.',
  change: { before: 'AED 665', after: 'AED 820', scope: '16–18 Dec' },
  impact_eur: 43000,
  risk: 'high',
  status: 'pending',
  createdAt: '2026-11-20T06:00:00.000Z',
  decidedBy: null,
  decidedAt: null,
  note: null,
};

/** A workflow with every kind of node: trigger → hotels → two checks → analysis → approval → action. */
export const SAMPLE_DRAFT: WorkflowDraft = {
  name: 'Event pricing watch',
  description: '',
  hotels: ['DXB2'],
  trigger: { kind: 'brief', finding: 'underpriced_demand' },
  goal: 'When Dubai Business Bay is priced under the market on busy nights, propose the comp-set median.',
  checks: ['get_rate_position', 'get_pace'],
  action: { type: 'adjust_bar', guidance: 'Propose the comp-set median for each night.' },
  approver: 'revenue_manager',
  autonomy: 'approve',
  enabled: true,
};

/** A sparkline path in a 120 × 40 box, the way the Inbox tiles draw one. */
export function sparkPath(values: readonly number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * 120).toFixed(1)} ${(36 - ((v - min) / span) * 32).toFixed(1)}`).join(' ');
}

export const SAMPLE_TILES = [
  { label: 'Occupancy', value: '71.8%', delta: '▲ 2.4 pp', ty: sparkPath([62, 64, 66, 65, 69, 72, 74, 73, 76, 78, 77, 80]), ly: sparkPath([60, 63, 64, 66, 66, 69, 70, 72, 73, 74, 75, 76]) },
  { label: 'ADR', value: '€206', delta: '▲ 5.9%', ty: sparkPath([188, 192, 196, 199, 204, 203, 208, 211, 209, 214, 216, 219]), ly: sparkPath([180, 183, 188, 190, 192, 195, 196, 199, 201, 202, 205, 206]) },
  { label: 'RevPAR', value: '€148', delta: '▲ 8.3%', ty: sparkPath([118, 124, 129, 131, 140, 146, 152, 154, 159, 166, 167, 175]), ly: sparkPath([110, 116, 121, 126, 128, 135, 138, 143, 147, 150, 154, 157]) },
  { label: 'Room revenue', value: '€14.2M', delta: '▼ 1.1%', ty: sparkPath([1.2, 1.25, 1.22, 1.3, 1.28, 1.31, 1.27, 1.33, 1.3, 1.29, 1.34, 1.31]), ly: sparkPath([1.21, 1.24, 1.26, 1.29, 1.3, 1.3, 1.32, 1.33, 1.33, 1.35, 1.36, 1.37]) },
] as const;

/** The last 14 runs of the sample agent, oldest first, in the classes the run strip uses. */
export const SAMPLE_RUNS = ['none', 'none', 'none', 'finding', 'none', 'none', 'skipped', 'none', 'none', 'finding', 'none', 'failed', 'none', 'pending'] as const;
export type SampleRun = (typeof SAMPLE_RUNS)[number] | 'finding';
