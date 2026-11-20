/*
  Words for what the data tools return. The server sends a title, column labels and source labels (contracts §2);
  these maps are the fallback for transcripts written before that, and for anything the server leaves out. Nothing
  here is shown as a raw name: an unknown tool, column or source is still turned into plain words.
*/

/** Tool name → the title of its evidence card. */
const TOOL_TITLES: Record<string, string> = {
  list_hotels: 'Hotels in the group',
  list_metrics: 'Metric definitions',
  get_metric: 'Metric over time',
  get_pace: 'Pace vs last year',
  get_pickup: 'Pickup in the last days',
  get_rate_position: 'Rate vs the comp set',
  get_channel_mix: 'Channel mix',
  get_mix: 'Business mix',
  get_account_production: 'Account production',
  get_fnb: 'Food and beverage',
  get_labor: 'Staffing against plan',
  get_review_scores: 'Review scores',
  search_reviews: 'Reviews mentioning a phrase',
  find_reviews: 'What guests say',
  get_web_funnel: 'Website funnel',
  get_inventory: 'Room inventory',
  get_pnl: 'Profit and loss',
  get_forecast: 'Forecast',
  get_meetings_events: 'Meetings and events',
  get_lost_business: 'Lost business',
  get_brief: 'The morning brief',
  get_data_health: 'Data freshness',
  get_schema: 'Data model',
  run_readonly_query: 'Custom query',
};

/** Governed metric keys → their names (for `get_metric`, whose title is the metric it read). */
const METRIC_NAMES: Record<string, string> = {
  occupancy: 'Occupancy',
  adr: 'ADR',
  revpar: 'RevPAR',
  trevpar: 'TRevPAR',
  goppar: 'GOPPAR',
  room_revenue: 'Room revenue',
  total_revenue: 'Total revenue',
  rooms_sold: 'Rooms sold',
  rooms_available: 'Rooms available',
  gop: 'GOP',
  gop_margin: 'GOP margin',
};

/** Raw source → what a hotelier would call it. */
const SOURCE_LABELS: Record<string, string> = {
  'hotel.v_hotel_day': 'Daily hotel performance',
  'hotel.pace_vs_stly': 'Pace vs same time last year',
  'hotel.otb_as_of': 'On-the-books snapshots',
  'hotel.room_inventory_daily': 'Room inventory',
  'hotel.hotels': 'Hotel list',
  'hotel.brands': 'Brands',
  'hotel.reviews': 'Guest reviews',
  'hotel.review_passages': 'Review sentences',
  'hotel.comp_set_daily': 'Comp set rates',
  'hotel.v_rate_position': 'Rate vs comp set',
  'hotel.v_comp_set_index': 'Comp set index',
  'hotel.reservations': 'Reservations',
  'hotel.reservation_nights': 'Reservation nights',
  'hotel.pnl_monthly': 'Monthly P&L',
  'hotel.budgets': 'Budgets',
  'hotel.forecasts': 'Forecasts',
  'hotel.web_daily': 'Website analytics',
  'hotel.labor_daily': 'Labour schedules',
  'hotel.fnb_daily': 'F&B sales (POS)',
  'hotel.outlets': 'F&B outlets',
  'hotel.data_sources': 'Data feed status',
  'hotel.accounts': 'Accounts',
  'hotel.v_channel_month': 'Channel production',
  'hotel.channels': 'Channels',
  'hotel.rates_daily': 'Daily rates',
  'hotel.meeting_rooms': 'Meeting rooms',
  'hotel.me_events': 'Meetings and events',
  'hotel.lost_business': 'Lost business',
  'hotel.eur_rate': 'Exchange rates',
  'hotel.business_date': 'Business date',
};

/** Whole column keys with a better name than their parts give. */
const COLUMN_LABELS: Record<string, string> = {
  hotel_code: 'Hotel',
  hotel: 'Hotel',
  hotel_name: 'Hotel name',
  key: 'Group',
  value: 'Value',
  period: 'Period',
  stay_date: 'Stay date',
  rooms_otb: 'Rooms on the books',
  rooms_otb_stly: 'Same time last year',
  rooms_on_books: 'Rooms on the books',
  rooms_on_books_stly: 'Same time last year',
  revenue_otb: 'Revenue on the books',
  revenue_otb_stly: 'Revenue, same time last year',
  pace_pct: 'Pace vs last year',
  rooms_picked_up: 'Rooms picked up',
  pickup_pct: 'Pickup',
  bar_rate: 'BAR',
  comp_median: 'Comp set median',
  bar_vs_comp: 'BAR vs comp set',
  comps_sold_out: 'Comps sold out',
  last_sync_at: 'Last sync',
  impact_eur: 'Impact',
  impact_basis: 'Basis of the impact',
  adr_eur: 'ADR',
  share_pct: 'Share',
  est_revenue_eur: 'Estimated revenue',
  overall_score: 'Overall score',
  review_text: 'Review',
  mentions_by_hotel: 'Mentions by hotel',
};

/** Parts of a column key that are not ordinary words. */
const TOKEN_WORDS: Record<string, string> = {
  otb: 'on the books',
  stly: 'same time last year',
  ly: 'last year',
  adr: 'ADR',
  revpar: 'RevPAR',
  trevpar: 'TRevPAR',
  goppar: 'GOPPAR',
  gop: 'GOP',
  bar: 'BAR',
  fnb: 'F&B',
  pnl: 'P&L',
  av: 'AV',
  ota: 'OTA',
  pos: 'POS',
  pms: 'PMS',
  rms: 'RMS',
  crs: 'CRS',
  sql: 'SQL',
  id: 'ID',
  avg: 'average',
  min: 'lowest',
  max: 'highest',
  var: 'variance',
  est: 'estimated',
  comp: 'comp set',
  comps: 'comp set hotels',
  sqm: 'm²',
  p10: 'P10',
  p50: 'P50',
  p90: 'P90',
  vs: 'vs',
};

/** Suffixes that say the unit, which the cell already shows. */
const UNIT_SUFFIX = /_(pct|percent|eur|usd|gbp)$/;

const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "rooms_otb_stly" → "Rooms on the books same time last year"; "gop_margin_pct" → "GOP margin". */
export function humanizeKey(key: string): string {
  const known = COLUMN_LABELS[key];
  if (known) return known;
  const words = key
    .replace(UNIT_SUFFIX, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .split(/[_\s.-]+/)
    .filter(Boolean)
    .map((part) => TOKEN_WORDS[part.toLowerCase()] ?? part.toLowerCase());
  return sentence(words.join(' ')) || key;
}

/**
 * A definition or a note as the server wrote it, with what is internal turned into words: a column name
 * ("rooms_actual") reads as its label, an ISO date is left to `humanizeText`.
 */
export function proseKeys(text: string): string {
  return text.replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g, (token) => {
    const words = humanizeKey(token);
    return words.charAt(0).toLowerCase() + words.slice(1);
  });
}

/** The title of a tool call's card: the server's, else the label map, else the tool name in plain words. */
export function toolTitle(name: string, args?: Record<string, unknown>, serverTitle?: string): string {
  if (serverTitle?.trim()) return serverTitle.trim();
  const tool = name.replace(/^mcp__\w+?__/, '');
  if (tool === 'get_metric' && typeof args?.['metric'] === 'string') {
    const metric = args['metric'];
    return METRIC_NAMES[metric] ?? humanizeKey(metric);
  }
  return TOOL_TITLES[tool] ?? humanizeKey(tool.replace(/^(get|list|find|search)_/, ''));
}

/** Whether a tool reads data, so a call still in flight can hold a place in the panel. */
export function isDataTool(name: string): boolean {
  return /^(get|list|find|search)_|^run_readonly_query$/.test(name.replace(/^mcp__\w+?__/, ''));
}

/** "hotel.v_hotel_day" → "Daily hotel performance"; an unknown source still reads as words. */
export function sourceLabel(source: string, serverLabels?: Record<string, string>): string {
  const fromServer = serverLabels?.[source]?.trim();
  if (fromServer) return fromServer;
  const bare = source.replace(/\(\)$/, '');
  const known = SOURCE_LABELS[bare];
  if (known) return known;
  return humanizeKey(bare.replace(/^\w+\./, '').replace(/^v_/, '').replace(/_(daily|monthly)$/, ''));
}
