import type { WidgetKind } from './widget-types';

/*
  Example questions that make Kassandra answer with each kind of widget. One list feeds the "Try asking" gallery
  (the empty Thread and the Inbox ask area) and the "Ask Kassandra" line under each kind on /catalog.

  The gallery questions are the visual eval stories of apps/worker/evals/stories.json (V1–V8) plus four more: each is
  checked there to come back with the kind named here. The other kinds' questions are worded for their kind, but
  Kassandra chooses the widget from the data, so she may answer one of those with a simpler chart.
*/

export interface AskExample {
  kind: WidgetKind;
  question: string;
}
export interface AskGroup {
  /** What the answers of the group show. */
  title: string;
  items: AskExample[];
}

/** How a kind is named to a person: "a line chart", "KPI tiles". */
export const KIND_NAMES: Record<WidgetKind, string> = {
  kpi: 'a KPI tile',
  kpi_row: 'KPI tiles',
  line: 'a line chart with last year',
  area: 'an area chart',
  bar: 'a bar chart',
  stacked_bar: 'a stacked bar chart',
  grouped_bar: 'a grouped bar chart',
  pie: 'a pie chart',
  donut: 'a donut chart',
  table: 'a table',
  heatmap: 'a heatmap',
  calendar_heatmap: 'a calendar heatmap',
  funnel: 'a funnel',
  waterfall: 'a waterfall',
  bullet: 'a bullet chart',
  sparkline_list: 'a list of sparklines',
  scatter: 'a scatter plot',
  treemap: 'a treemap',
  gauge: 'a gauge',
  radar: 'a radar chart',
  sankey: 'a sankey diagram',
};

/** The gallery: 12 questions, grouped by what the answer shows. */
export const ASK_GROUPS: readonly AskGroup[] = [
  { title: 'Headline numbers', items: [{ kind: 'kpi_row', question: 'Give me the headline KPIs for Asia this month' }] },
  { title: 'Trends', items: [{ kind: 'line', question: 'How is Lisbon pacing for December vs last year?' }] },
  {
    title: 'Comparison',
    items: [
      { kind: 'bar', question: 'Which hotels are furthest behind last year’s pace?' },
      { kind: 'bullet', question: 'How is each European hotel’s GOP against budget in October?' },
      { kind: 'scatter', question: 'Where are we priced vs the comp set in Dubai next 30 nights?' },
    ],
  },
  {
    title: 'Mix',
    items: [
      { kind: 'donut', question: 'What’s the channel mix at Barcelona?' },
      { kind: 'treemap', question: 'Where does the group’s room revenue come from?' },
      { kind: 'sankey', question: 'Where does channel revenue go, and what is left after commission?' },
    ],
  },
  {
    title: 'Calendar',
    items: [
      { kind: 'heatmap', question: 'Show occupancy for the next 14 nights by hotel' },
      { kind: 'calendar_heatmap', question: 'Show the booking calendar for Dubai Business Bay through January' },
    ],
  },
  { title: 'Bridges', items: [{ kind: 'waterfall', question: 'What drove GOP vs budget in October for the group?' }] },
  { title: 'Funnel', items: [{ kind: 'funnel', question: 'How is Amsterdam’s mobile booking funnel doing?' }] },
];

/** Three of them, shown before the rest where space is short (the Inbox). */
export const FEATURED_ASKS: readonly AskExample[] = (['waterfall', 'heatmap', 'kpi_row'] as const).map((kind) => ASK_GROUPS.flatMap((group) => group.items).find((item) => item.kind === kind)!);

/** A question for every kind, for /catalog: the gallery's where it has one. */
export const ASK_BY_KIND: Record<WidgetKind, string> = {
  kpi: 'What is group RevPAR this month?',
  gauge: 'How full is Lisbon for December against its budget?',
  sparkline_list: 'How has RevPAR moved at each hotel over the last 14 days?',
  area: 'How did bookings for 16 December at Dubai Business Bay build up?',
  grouped_bar: 'How has group revenue tracked against budget each month since June?',
  stacked_bar: 'How has New York’s segment mix shifted since June?',
  radar: 'How does Lisbon compare with its comp set on occupancy, rate and RevPAR?',
  pie: 'What is New York’s segment mix this month?',
  table: 'List on-the-books room nights against last year for every hotel in December',
  ...(Object.fromEntries(ASK_GROUPS.flatMap((group) => group.items.map((item) => [item.kind, item.question]))) as Partial<Record<WidgetKind, string>>),
} as Record<WidgetKind, string>;
