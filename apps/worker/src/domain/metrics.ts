import type { MetricDefinition, MetricKey } from '@compass/contracts';

/**
 * The governed metric catalog. Definitions follow USALI and the standard hotel glossary, and every
 * ratio is computed from sums over the period, never as an average of daily ratios.
 * Money is converted to EUR on the stay date, so hotels in different currencies compare.
 */
export const METRICS: readonly MetricDefinition[] = [
  {
    key: 'occupancy',
    label: 'Occupancy',
    unit: 'percent',
    definition: 'Rooms sold ÷ rooms available (out-of-order rooms excluded), in %. Future dates show what is on the books.',
    source: 'hotel.v_hotel_day',
  },
  {
    key: 'adr',
    label: 'ADR',
    unit: 'eur',
    definition: 'Average daily rate: room revenue ÷ rooms sold, in EUR.',
    source: 'hotel.v_hotel_day',
  },
  {
    key: 'revpar',
    label: 'RevPAR',
    unit: 'eur',
    definition: 'Revenue per available room: room revenue ÷ rooms available, in EUR (= occupancy × ADR).',
    source: 'hotel.v_hotel_day',
  },
  {
    key: 'room_revenue',
    label: 'Room revenue',
    unit: 'eur',
    definition: 'Room revenue of the stay nights in the period, in EUR, before commission.',
    source: 'hotel.v_hotel_day',
  },
  {
    key: 'rooms_sold',
    label: 'Rooms sold',
    unit: 'count',
    definition: 'Room nights sold (cancelled and no-show reservations excluded).',
    source: 'hotel.v_hotel_day',
  },
  {
    key: 'mpi',
    label: 'MPI',
    unit: 'index',
    definition: 'Market penetration index: our occupancy ÷ comp set occupancy × 100. 100 is fair share.',
    source: 'hotel.comp_set_daily',
  },
  {
    key: 'ari',
    label: 'ARI',
    unit: 'index',
    definition: 'Average rate index: our ADR ÷ comp set ADR × 100, in local currency. 100 is fair share.',
    source: 'hotel.comp_set_daily',
  },
  {
    key: 'rgi',
    label: 'RGI',
    unit: 'index',
    definition: 'Revenue generation index: our RevPAR ÷ comp set RevPAR × 100. 100 is fair share.',
    source: 'hotel.comp_set_daily',
  },
];

export const metricByKey = (key: MetricKey): MetricDefinition => METRICS.find((m) => m.key === key)!;
