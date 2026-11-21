import type { EvidenceColumn } from './evidence.ts';
import type { WidgetKind } from './widgets.ts';

/**
 * The numbers around the morning brief (`GET /api/brief/overview?hotels=`): the Pulse tiles, the next 14 nights,
 * the last 7 days of pickup, where the revenue is, the data feeds, and one chart per brief finding.
 *
 * Everything is computed in SQL for the hotels of the scope; no model is involved. Ratios come from sums over the
 * scope's hotels, money is in EUR at the business date's rate, and last year is the same weekday 364 days earlier.
 * A part that could not be read is null and named in `failed`, so one slow query never blanks the page.
 */
export interface BriefOverview {
  /** The data's "today". */
  businessDate: string;
  /** The hotel codes the numbers are for. Empty means the whole group. */
  hotels: string[];
  pulse: BriefPulse | null;
  nights: BriefNights | null;
  pickup: BriefPickup | null;
  money: BriefMoney | null;
  health: BriefFeed[] | null;
  /** One chart per brief finding in scope, by the finding's id. A finding without a chart is not in the map. */
  charts: Record<string, BriefChart>;
  /** The parts that could not be read (`pulse`, `nights`, `pickup`, `money`, `health`, or `chart:<finding id>`). */
  failed: string[];
}

export type PulseKey = 'occupancy' | 'adr' | 'revpar' | 'room_revenue' | 'pace' | 'total_revenue' | 'trevpar' | 'gop' | 'gop_margin';

export interface PulseTile {
  key: PulseKey;
  label: string;
  /** How to read `value`, `compare` and the series: a percentage (81.2 = 81.2%), EUR, or a count of room nights. */
  unit: 'percent' | 'eur' | 'count';
  value: number | null;
  /** The same figure for the comparison (`basis`). */
  compare: number | null;
  /** `value` against `compare`: in points for a percentage (`pp`), else in percent (`pct`). */
  delta: number | null;
  deltaUnit: 'pp' | 'pct';
  /** What the figure covers: "Next 30 nights" or the last closed month, "Oct 2026". */
  period: string;
  /** What it is compared with: "same time last year", "Oct 2025". */
  basis: string;
  /** A second comparison where the data has one: the month's budget, for the P&L tiles. */
  also?: { delta: number | null; deltaUnit: 'pp' | 'pct'; basis: string };
  /** The definition in one sentence, for the tile's tooltip and for Kassandra. */
  definition: string;
  /** The figure over time (a night or a month per point), with the comparison. */
  series: { x: string; value: number | null; compare: number | null }[];
}

export interface BriefPulse {
  /** The stay dates of the on-the-books tiles, inclusive. */
  from: string;
  to: string;
  /** The last closed month of the finance tiles (`YYYY-MM-01`), or null when the P&L has no actuals for the scope. */
  month: string | null;
  tiles: PulseTile[];
}

/** Why a night's rate deserves a look: under the market while demand is high, or over it while behind last year. */
export type RateFlag = 'underpriced' | 'overpriced';

export interface BriefNight {
  stay_date: string;
  rooms_available: number;
  rooms_otb: number;
  rooms_otb_stly: number;
  occupancy_pct: number | null;
  occupancy_stly_pct: number | null;
}

export interface BriefHotelNight extends BriefNight {
  hotel_code: string;
  /** Best available rate in the hotel's own currency, and against the comp set's median (1.00 = at the median). */
  bar_rate: number | null;
  currency: string;
  bar_vs_comp: number | null;
  comps_sold_out: number | null;
  /** A city event on that night, e.g. "Spree Fintech Forum". */
  event: string | null;
  rate_flag: RateFlag | null;
}

export interface BriefNights {
  from: string;
  to: string;
  /** One row per night for the scope as a whole, in date order. */
  total: (BriefNight & { events: number; rate_flags: number })[];
  /** One row per hotel and night, by hotel code then date. */
  hotels: BriefHotelNight[];
}

export interface BriefPickup {
  /** The booking days covered, inclusive: the 7 days up to the business date. */
  from: string;
  to: string;
  /** Room nights booked and cancelled on each day, for any future stay; `net_ly` is the same weekday last year. */
  byDay: { booking_date: string; booked: number; cancelled: number; net: number; net_ly: number }[];
  /** The same 7 days per hotel, with the room revenue booked in EUR. */
  byHotel: { hotel_code: string; booked: number; cancelled: number; net: number; net_ly: number; revenue_eur: number }[];
}

export interface BriefMoney {
  /** The stay dates covered, inclusive: the next 30 nights. */
  from: string;
  to: string;
  /** Room revenue on the books per hotel, against the same time last year. */
  byHotel: { hotel_code: string; region: string; revenue_eur: number; revenue_stly_eur: number; change_eur: number; change_pct: number | null }[];
  /** The scope's revenue on the books by stay week (weeks start on Monday). */
  byWeek: { week: string; revenue_eur: number; revenue_stly_eur: number }[];
}

export interface BriefFeed {
  hotel_code: string;
  /** "PMS", "POS", "Rate shopper"… */
  system: string;
  vendor: string;
  /** `ok`, or what is wrong (`stale`). */
  status: string;
  /** `YYYY-MM-DD HH:MM`. */
  last_sync_at: string;
  /** Whole days between the last sync and the business date. */
  days_behind: number;
}

/**
 * A chart for one brief finding, as a widget of the catalogue: the kind and the column keys are fixed per kind of
 * finding, and the rows come from SQL. It passes the same fit rules as a widget from `show_widget`.
 */
export interface BriefChart {
  kind: WidgetKind;
  /** What the chart shows, e.g. "Room nights on the books for the next 45 nights, by booking day". */
  title: string;
  subtitle?: string;
  x?: string;
  y?: string[];
  group?: string;
  compare?: string;
  format?: 'number' | 'percent' | 'currency' | 'count';
  rows: Record<string, unknown>[];
  columns: EvidenceColumn[];
  /** The tables, views or functions the rows were read from. */
  sources: string[];
}
