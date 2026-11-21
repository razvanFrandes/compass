/** Arguments for each catalog tool that reads rows from the database, with one entry per shape its rows can take. */
const period = { from: '2026-10-01', to: '2026-10-31' };

export const TOOL_CALLS: Record<string, Record<string, unknown>[]> = {
  list_hotels: [{}],
  list_metrics: [{}],
  get_metric: [
    { metric: 'occupancy', hotels: ['LIS'], ...period },
    { metric: 'adr', by: 'region', grain: 'week', compare: 'stly', ...period },
    { metric: 'rooms_sold', by: 'group', grain: 'total', compare: 'stly', ...period },
    { metric: 'mpi', hotels: ['LIS'], grain: 'day', from: '2026-10-01', to: '2026-10-03' },
  ],
  get_kpis: [
    { by: 'group', ...period },
    { by: 'hotel', region: 'Asia', ...period },
  ],
  get_pickup: [{ hotels: ['LIS', 'DXB1'] }],
  get_pace: [{ hotels: ['LIS'] }, { hotels: ['LIS'], grain: 'day', from: '2026-12-01', to: '2026-12-31' }],
  get_rate_position: [
    { hotels: ['DXB1'], from: '2026-12-10', to: '2026-12-20' },
    { hotels: ['DXB1', 'DXB2'], from: '2026-12-10', to: '2026-12-20', grain: 'total' },
  ],
  get_channel_mix: [
    { hotels: ['LIS'], ...period },
    { shape: 'total', ...period },
    { hotels: ['LIS'], shape: 'flows', ...period },
  ],
  get_mix: [
    { hotels: ['LIS'], by: 'segment', ...period },
    { by: 'segment', rollUp: true, ...period },
    { hotels: ['LIS'], by: 'channel_type', grain: 'total', basis: 'booked', ...period },
    { by: 'channel', grain: 'total', rollUp: true, ...period },
  ],
  get_account_production: [{ hotels: ['MIA'], from: '2026-05-01', to: '2026-10-31' }],
  get_fnb: [{ hotels: ['DPS'], ...period }],
  get_labor: [{ hotels: ['DPS'], ...period }],
  get_review_scores: [{ hotels: ['BCN'], ...period }],
  search_reviews: [{ hotels: ['BCN'], text: 'noise' }],
  get_web_funnel: [
    { hotels: ['AMS'], by: 'device', ...period },
    { hotels: ['AMS'], by: 'source', grain: 'month', ...period },
  ],
  get_inventory: [{ hotels: ['BCN'], ...period }],
  get_pnl: [
    { hotels: ['MIA'], ...period },
    { hotels: ['MIA'], view: 'lines', by: 'brand', grain: 'total', ...period },
    { by: 'group', view: 'bridge', ...period },
  ],
  get_forecast: [{ hotels: ['LIS'] }, { by: 'region', grain: 'total' }],
  get_meetings_events: [{ hotels: ['LIS'], ...period }],
  get_lost_business: [
    { hotels: ['LIS'], ...period },
    { by: 'group', detail: 'segment', basis: 'request', grain: 'week', ...period },
    { hotels: ['LIS'], detail: 'channel', grain: 'total', ...period },
  ],
  get_brief: [{}],
  get_data_health: [{ hotels: ['BER'] }],
  run_readonly_query: [{ sql: 'select hotel_code, date, rooms_sold, room_revenue_eur from hotel.v_hotel_day order by date desc limit 3' }],
};
