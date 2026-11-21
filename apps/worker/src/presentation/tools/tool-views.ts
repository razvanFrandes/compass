import type { EvidenceColumn, EvidenceColumnKind } from '@compass/contracts';
import { humanize, inferColumns } from '../../domain/evidence-columns.ts';
import { metricByKey } from '../../domain/metrics.ts';

/**
 * How each catalog tool's rows are shown: a human title for its card ("Pace vs last year", not "get_pace"), and one
 * column per row property with a label a hotelier reads, the kind of value and its unit. The evidence panel renders
 * tables from this instead of guessing from property names; ids and internal flags are marked hidden.
 *
 * A tool whose rows change shape with its arguments (the roll-up level, the grain, a comparison) derives its
 * columns from them. `test/tool-columns.test.ts` runs every tool and fails on a row property without a column.
 */

type Args = Record<string, unknown>;
type Rows = readonly Record<string, unknown>[];

export interface ToolView {
  /** The tool's card title. */
  title: string;
  /** A title that says more for these arguments, e.g. the metric's own name. */
  titleFor?(args: Args): string;
  columns(args: Args, rows: Rows): EvidenceColumn[];
}

const col = (key: string, label: string, kind: EvidenceColumnKind, unit?: string): EvidenceColumn => ({ key, label, kind, ...(unit ? { unit } : {}) });
const hidden = (column: EvidenceColumn): EvidenceColumn => ({ ...column, hidden: true });
const text = (key: string, label: string) => col(key, label, 'text');
const eur = (key: string, label: string) => col(key, label, 'currency', 'EUR');
const pct = (key: string, label: string) => col(key, label, 'percent');
const count = (key: string, label: string, unit?: string) => col(key, label, 'count', unit);
const num = (key: string, label: string, unit?: string) => col(key, label, 'number', unit);
const date = (key: string, label: string) => col(key, label, 'date');

const HOTEL = col('hotel_code', 'Hotel', 'hotel');
const NIGHTS = 'room nights';

/** The `period` column: the start of the bucket, so a month reads as a month and the rest as a date. */
function period(grain: unknown, fallback: string): EvidenceColumn {
  switch (grain ?? fallback) {
    case 'month':
      return col('period', 'Month', 'month');
    case 'week':
      return date('period', 'Week starting');
    case 'day':
      return date('period', 'Date');
    default:
      return date('period', 'Period from');
  }
}

/** The `key` column of a tool that rolls up: a hotel code, or the name of a region, a brand or the group. */
function rollUp(by: unknown): EvidenceColumn {
  if (by === 'region') return text('key', 'Region');
  if (by === 'brand') return text('key', 'Brand');
  if (by === 'group') return text('key', 'Group');
  return col('key', 'Hotel', 'hotel');
}

const METRIC_KIND: Record<string, { kind: EvidenceColumnKind; unit?: string; change: { kind: EvidenceColumnKind; unit?: string } }> = {
  percent: { kind: 'percent', change: { kind: 'number', unit: 'pts' } },
  eur: { kind: 'currency', unit: 'EUR', change: { kind: 'currency', unit: 'EUR' } },
  index: { kind: 'number', unit: 'index', change: { kind: 'number', unit: 'index pts' } },
  count: { kind: 'count', unit: NIGHTS, change: { kind: 'count', unit: NIGHTS } },
};

const MIX_KEYS: Record<string, string> = { segment: 'Segment', channel: 'Channel', channel_type: 'Channel type' };

export const TOOL_VIEWS: Record<string, ToolView> = {
  list_hotels: {
    title: 'Hotels in the group',
    columns: () => [
      text('hotel_code', 'Code'),
      text('name', 'Hotel'),
      text('brand', 'Brand'),
      text('city', 'City'),
      text('country', 'Country'),
      text('region', 'Region'),
      text('currency', 'Currency'),
      count('rooms', 'Rooms'),
      num('meeting_space_sqm', 'Meeting space', 'sqm'),
    ],
  },
  list_metrics: {
    title: 'Metric definitions',
    columns: () => [hidden(col('key', 'Key', 'id')), text('label', 'Metric'), text('unit', 'Unit'), text('definition', 'Definition'), hidden(text('source', 'Source'))],
  },
  get_metric: {
    title: 'Metric over time',
    titleFor: (args) => `${metricByKey(args['metric'] as never).label}${args['compare'] === 'stly' ? ' vs last year' : ''}`,
    columns: (args) => {
      const metric = metricByKey(args['metric'] as never);
      const { kind, unit, change } = METRIC_KIND[metric.unit]!;
      return [
        period(args['grain'], 'month'),
        rollUp(args['by']),
        col('value', metric.label, kind, unit),
        ...(args['compare'] === 'stly'
          ? [col('compare_value', `${metric.label}, same time last year`, kind, unit), col('change', 'Change', change.kind, change.unit), pct('change_pct', 'Change %')]
          : []),
      ];
    },
  },
  get_kpis: {
    title: 'Headline KPIs vs last year',
    columns: (args) => {
      const perHotel = (args['by'] ?? 'hotel') === 'hotel';
      return [
        rollUp(args['by']),
        ...(perHotel ? [text('region', 'Region')] : []),
        pct('occupancy_pct', 'Occupancy'),
        pct('occupancy_ly_pct', 'Occupancy, last year'),
        eur('adr_eur', 'ADR'),
        eur('adr_ly_eur', 'ADR, last year'),
        eur('revpar_eur', 'RevPAR'),
        eur('revpar_ly_eur', 'RevPAR, last year'),
        eur('room_revenue_eur', 'Room revenue'),
        eur('room_revenue_ly_eur', 'Room revenue, last year'),
        count('rooms_sold', 'Rooms sold', NIGHTS),
        count('rooms_sold_ly', 'Rooms sold, last year', NIGHTS),
        ...(perHotel ? [num('mpi', 'MPI', 'index'), num('ari', 'ARI', 'index'), num('rgi', 'RGI', 'index')] : []),
      ];
    },
  },
  get_pickup: {
    title: 'Recent pickup',
    columns: () => [
      HOTEL,
      count('rooms_picked_up', 'Rooms picked up', NIGHTS),
      // A share between 0 and 1 (0.031 is 3.1% of capacity), not a percentage: the rows are what the model reads.
      num('pickup_pct', 'Pickup as a share of capacity', 'of capacity (1 = all rooms)'),
    ],
  },
  get_pace: {
    title: 'Pace vs last year',
    titleFor: (args) => (args['grain'] === 'day' ? 'Pace vs last year, night by night' : 'Pace vs last year'),
    columns: (args) => [
      HOTEL,
      ...(args['grain'] === 'day' ? [date('stay_date', 'Stay date')] : []),
      count('rooms_otb', 'On the books', NIGHTS),
      count('rooms_otb_stly', 'On the books, same time last year', NIGHTS),
      ...(args['grain'] === 'day'
        ? []
        : [
            pct('pace_pct', 'Pace vs last year'),
            col('revenue_otb', 'Revenue on the books', 'currency', 'local currency'),
            col('revenue_otb_stly', 'Revenue on the books, same time last year', 'currency', 'local currency'),
          ]),
    ],
  },
  get_rate_position: {
    title: 'Rate vs the comp set',
    columns: (args) => {
      const total = args['grain'] === 'total';
      return [
        HOTEL,
        ...(total ? [count('nights', 'Nights shopped')] : [date('stay_date', 'Stay date')]),
        col('bar_rate', total ? 'Our BAR, average' : 'Our BAR', 'currency', 'local currency'),
        col('comp_median', total ? 'Comp set median, average' : 'Comp set median', 'currency', 'local currency'),
        num('bar_vs_comp', 'Our BAR vs the comp set median', '× the median'),
        ...(total ? [] : [count('comps_sold_out', 'Comp set hotels sold out')]),
        pct('occupancy_otb_pct', 'Occupancy on the books'),
      ];
    },
  },
  get_channel_mix: {
    title: 'Channel mix',
    titleFor: (args) => (args['shape'] === 'flows' ? 'Channel revenue: kept and paid in commission' : 'Channel mix'),
    columns: (args) =>
      args['shape'] === 'flows'
        ? [text('channel', 'Channel'), text('lands_in', 'Lands in'), eur('amount_eur', 'Room revenue')]
        : [
            ...(args['shape'] === 'total' ? [] : [HOTEL]),
            text('channel', 'Channel'),
            text('channel_type', 'Channel type'),
            count('room_nights', 'Room nights', NIGHTS),
            eur('gross_revenue_eur', 'Gross revenue'),
            eur('commission_eur', 'Commission'),
            eur('net_revenue_eur', 'Net revenue'),
            pct('commission_pct', 'Commission, share of gross'),
          ],
  },
  get_mix: {
    title: 'Business mix',
    titleFor: (args) => `Business mix by ${(MIX_KEYS[String(args['by'])] ?? 'segment').toLowerCase()}`,
    columns: (args) => [
      period(args['grain'], 'month'),
      ...(args['rollUp'] ? [] : [HOTEL]),
      text('key', MIX_KEYS[String(args['by'])] ?? 'Segment'),
      count('room_nights', 'Room nights', NIGHTS),
      pct('share_pct', 'Share of room nights'),
      eur('revenue_eur', 'Room revenue'),
      eur('adr_eur', 'ADR'),
    ],
  },
  get_account_production: {
    title: 'Account production',
    columns: () => [
      HOTEL,
      text('account', 'Account'),
      text('account_type', 'Account type'),
      count('room_nights', 'Room nights', NIGHTS),
      count('previous_room_nights', 'Room nights, period before', NIGHTS),
      count('change', 'Change in room nights', NIGHTS),
      eur('revenue_eur', 'Room revenue'),
      eur('previous_revenue_eur', 'Room revenue, period before'),
      eur('revenue_change_eur', 'Change in room revenue'),
      date('first_stay_date', 'First stay'),
      date('last_stay_date', 'Last stay'),
    ],
  },
  get_fnb: {
    title: 'Food and beverage',
    columns: (args) => [
      period(args['grain'], 'week'),
      HOTEL,
      text('outlet_type', 'Outlet'),
      text('meal_period', 'Meal period'),
      count('covers', 'Covers'),
      eur('revenue_eur', 'F&B revenue'),
      count('rooms_sold', 'Rooms sold', NIGHTS),
      num('covers_per_occupied_room', 'Covers per occupied room'),
    ],
  },
  get_labor: {
    title: 'Staffing vs plan',
    columns: (args) => [
      period(args['grain'], 'week'),
      HOTEL,
      text('department', 'Department'),
      num('required_hours', 'Hours required', 'hours'),
      num('scheduled_hours', 'Hours scheduled', 'hours'),
      num('actual_hours', 'Hours worked', 'hours'),
      num('overtime_hours', 'Overtime', 'hours'),
      pct('staffing_pct', 'Hours worked vs required'),
      eur('labor_cost_eur', 'Labour cost'),
    ],
  },
  get_review_scores: {
    title: 'Review scores',
    columns: (args) => [
      period(args['grain'], 'month'),
      HOTEL,
      count('reviews', 'Reviews'),
      ...(['overall', 'staff', 'cleanliness', 'comfort', 'location', 'value', 'food'] as const).map((score) => num(score, humanize(score), 'out of 10')),
    ],
  },
  search_reviews: {
    title: 'Guest reviews',
    columns: () => [
      HOTEL,
      date('review_date', 'Review date'),
      text('source', 'Review site'),
      num('overall_score', 'Score', 'out of 10'),
      text('positive_text', 'What they liked'),
      text('negative_text', 'What they disliked'),
      text('topics', 'Topics'),
    ],
  },
  find_reviews: {
    title: 'What guests say',
    columns: () => [
      text('sentiment', 'Complaint or praise'),
      text('quote', 'What guests wrote'),
      num('similarity', 'Closeness to the question', '0–1'),
      count('mentions', 'Reviews saying it'),
      pct('share_pct', 'Share of reviews'),
      date('first_date', 'First said'),
      date('last_date', 'Last said'),
      hidden(text('mentions_by_hotel', 'Reviews saying it, per hotel')),
      col('hotel_code', 'Hotel of the latest review', 'hotel'),
      date('review_date', 'Latest review'),
      text('source', 'Review site'),
      num('overall_score', 'Score of the latest review', 'out of 10'),
      text('review_text', 'The latest review'),
    ],
  },
  get_web_funnel: {
    title: 'Website booking funnel',
    columns: (args) => [
      period(args['grain'], 'week'),
      HOTEL,
      text('key', args['by'] === 'source' ? 'Traffic source' : 'Device'),
      count('sessions', 'Sessions'),
      count('searches', 'Searches'),
      count('checkout_starts', 'Checkout starts'),
      count('bookings', 'Bookings'),
      pct('conversion_pct', 'Conversion'),
      pct('checkout_completion_pct', 'Checkout completion'),
      eur('booking_revenue_eur', 'Booking revenue'),
    ],
  },
  get_inventory: {
    title: 'Room inventory',
    columns: (args) => [
      period(args['grain'], 'week'),
      HOTEL,
      count('physical_rooms', 'Rooms'),
      count('min_out_of_order', 'Out of order, lowest', 'rooms'),
      count('max_out_of_order', 'Out of order, highest', 'rooms'),
      num('avg_out_of_order', 'Out of order, average', 'rooms'),
      count('room_nights_available', 'Room nights available', NIGHTS),
    ],
  },
  get_pnl: {
    title: 'Profit and loss',
    titleFor: (args) =>
      args['view'] === 'bridge' ? `GOP bridge from ${args['against'] === 'ly' ? 'last year' : 'budget'}` : args['view'] === 'lines' ? 'Profit and loss by line' : 'Profit and loss',
    columns: (args) => {
      if (args['view'] === 'bridge') {
        // `kind` says which rows are totals and which are steps: the waterfall reads it, a reader does not need it.
        return [period('total', 'total'), rollUp(args['by']), text('step', 'Step'), hidden(text('kind', 'Total or step')), eur('amount_eur', 'Effect on GOP')];
      }
      const start = [period(args['grain'], 'month'), rollUp(args['by'])];
      const basis = [count('months', 'Months'), text('basis', 'Actual or forecast')];
      if (args['view'] === 'lines') {
        return [
          ...start,
          text('line', 'P&L line'),
          ...basis,
          eur('value_eur', 'Value'),
          eur('budget_eur', 'Budget'),
          eur('var_eur', 'Variance to budget'),
          pct('var_pct', 'Variance to budget %'),
          text('favourable', 'Favourable'),
          eur('ly_eur', 'Last year'),
          pct('ly_var_pct', 'Change vs last year'),
        ];
      }
      return [
        ...start,
        ...basis,
        eur('revenue_eur', 'Total revenue'),
        eur('revenue_budget_eur', 'Revenue budget'),
        eur('revenue_var_eur', 'Revenue vs budget'),
        pct('revenue_var_pct', 'Revenue vs budget %'),
        eur('gop_eur', 'GOP'),
        eur('gop_budget_eur', 'GOP budget'),
        eur('gop_var_eur', 'GOP vs budget'),
        pct('gop_var_pct', 'GOP vs budget %'),
        pct('gop_margin_pct', 'GOP margin'),
        pct('gop_margin_budget_pct', 'GOP margin, budget'),
        pct('flowthrough_budget_pct', 'Flowthrough vs budget'),
        eur('revenue_ly_eur', 'Total revenue, last year'),
        eur('gop_ly_eur', 'GOP, last year'),
        pct('gop_margin_ly_pct', 'GOP margin, last year'),
        pct('revenue_ly_var_pct', 'Revenue vs last year'),
        pct('flowthrough_ly_pct', 'Flowthrough vs last year'),
      ];
    },
  },
  get_forecast: {
    title: 'Forecast',
    columns: (args) => [
      period(args['grain'], 'month'),
      rollUp(args['by']),
      count('rooms_available', 'Room nights available', NIGHTS),
      count('rooms_actual', 'Sold so far this month', NIGHTS),
      count('rooms_on_books', 'On the books', NIGHTS),
      count('rooms_on_books_stly', 'On the books, same time last year', NIGHTS),
      pct('pace_pct', 'Pace vs last year'),
      count('rooms_p10', 'Room nights, low (P10)', NIGHTS),
      count('rooms_p50', 'Room nights, expected (P50)', NIGHTS),
      count('rooms_p90', 'Room nights, high (P90)', NIGHTS),
      pct('occupancy_p10_pct', 'Occupancy, low (P10)'),
      pct('occupancy_p50_pct', 'Occupancy, expected (P50)'),
      pct('occupancy_p90_pct', 'Occupancy, high (P90)'),
      eur('room_revenue_p10_eur', 'Room revenue, low (P10)'),
      eur('room_revenue_p50_eur', 'Room revenue, expected (P50)'),
      eur('room_revenue_p90_eur', 'Room revenue, high (P90)'),
      count('budget_rooms_sold', 'Budget room nights', NIGHTS),
      pct('budget_occupancy_pct', 'Budget occupancy'),
      eur('budget_room_revenue_eur', 'Budget room revenue'),
      pct('p50_vs_budget_pct', 'Expected room nights vs budget'),
      pct('revenue_p50_vs_budget_pct', 'Expected room revenue vs budget'),
      text('budget_position', 'Budget against the range'),
    ],
  },
  get_meetings_events: {
    title: 'Meetings and events',
    columns: (args) => [
      period(args['grain'], 'month'),
      rollUp(args['by']),
      count('events', 'Definite events'),
      count('attendees', 'Attendees'),
      eur('revenue_eur', 'M&E revenue'),
      eur('space_av_revenue_eur', 'Space hire and AV'),
      eur('banquet_fnb_revenue_eur', 'Banquet F&B'),
      num('meeting_space_sqm', 'Meeting space', 'sqm'),
      eur('revenue_per_sqm_eur', 'Revenue per sqm'),
      count('room_days_booked', 'Meeting-room days booked'),
      count('room_days_available', 'Meeting-room days available'),
      pct('utilisation_pct', 'Utilisation'),
      count('tentative_events', 'Tentative events'),
      eur('tentative_revenue_eur', 'Tentative revenue'),
      count('cancelled_events', 'Cancelled events'),
    ],
  },
  get_lost_business: {
    title: 'Lost business',
    columns: (args) => [
      period(args['grain'], 'month'),
      rollUp(args['by']),
      text('reason', 'Reason'),
      text('detail', args['detail'] === 'channel' ? 'Channel' : args['detail'] === 'segment' ? 'Segment' : 'Detail'),
      count('requests', 'Requests turned away'),
      count('room_nights', 'Room nights turned away', NIGHTS),
      pct('share_pct', 'Share of room nights turned away'),
      eur('est_revenue_eur', 'Estimated value at BAR'),
    ],
  },
  get_brief: {
    title: 'Morning brief',
    columns: () => [
      hidden(col('id', 'ID', 'id')),
      hidden(text('kind', 'Kind of finding')),
      HOTEL,
      hidden(text('hotel_name', 'Hotel name')),
      text('severity', 'Severity'),
      eur('impact_eur', 'Impact'),
      text('impact_basis', 'What the impact measures'),
      text('title', 'Finding'),
      hidden(text('facts', 'The numbers behind it')),
      hidden(text('question', 'Question to explore')),
      hidden(text('sources', 'Sources')),
    ],
  },
  get_data_health: {
    title: 'Data freshness',
    columns: () => [
      HOTEL,
      text('system', 'System'),
      text('vendor', 'Vendor'),
      text('connection', 'Connection'),
      date('last_sync_at', 'Last sync'),
      text('status', 'Status'),
    ],
  },
  get_schema: { title: 'Available data', columns: () => [] },
  run_readonly_query: { title: 'Custom analysis', columns: (_args, rows) => inferColumns(rows) },
};

/** A human name for every table, view and function a tool or a brief detector reads. */
export const SOURCE_LABELS: Record<string, string> = {
  'hotel.hotels': 'Hotel list',
  'hotel.brands': 'Brands',
  'hotel.v_hotel_day': 'Daily hotel performance',
  'hotel.comp_set_daily': 'Comp set benchmark',
  'hotel.otb_as_of()': 'On-the-books snapshots',
  'hotel.pace_vs_stly()': 'Pace vs same time last year',
  'hotel.room_inventory_daily': 'Room inventory',
  'hotel.v_rate_position': 'Comp set rate shop',
  'hotel.rates_daily': 'Daily rates (BAR)',
  'hotel.v_channel_month': 'Channel revenue by month',
  'hotel.channels': 'Booking channels',
  'hotel.data_sources': 'Data feed status',
  'hotel.reservation_nights': 'Reservation nights',
  'hotel.reservations': 'Reservations',
  'hotel.accounts': 'Accounts',
  'hotel.labor_daily': 'Staffing hours',
  'hotel.fnb_daily': 'F&B sales (POS)',
  'hotel.outlets': 'F&B outlets',
  'hotel.reviews': 'Guest reviews',
  'hotel.review_passages': 'Review sentences',
  'hotel.web_daily': 'Website analytics',
  'hotel.pnl_monthly': 'Monthly P&L',
  'hotel.forecasts': 'RMS forecast',
  'hotel.budgets': 'Budget',
  'hotel.me_events': 'Meetings and events bookings',
  'hotel.meeting_rooms': 'Meeting rooms',
  'hotel.lost_business': 'Lost business',
  'hotel.*': 'All hotel data (custom analysis)',
  'governed metric catalog': 'Metric definitions',
};

/** The label of each source; one nobody named yet reads as its table name in words. */
export function sourceLabelsFor(sources: readonly string[]): Record<string, string> {
  return Object.fromEntries(sources.map((source) => [source, SOURCE_LABELS[source] ?? humanize(source.replace(/^hotel\./, '').replace(/\(\)$/, '').replace(/^v_/, ''))]));
}
