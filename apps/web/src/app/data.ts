// Real (generated) data from the local compass_hotels database: Halcyon Hospitality Group, business date Fri 20 Nov 2026.
// halcyon-data.ts is produced by scratchpad/halcyon/extract.py with read-only SQL; nothing here is invented.
// Night-level views (boards, the rate calendar, the night panel) follow the hotel with today's pending decision:
// Tessera Dubai Business Bay, where Gulf Tech Week (15–19 Dec) is missing from the pricing calendar (story S6).
import { BUSINESS_DATE as BUSINESS_DATE_ISO, FOCUS, FOCUS_CURVES, FOCUS_FORWARD, FOCUS_PAST, HOTELS } from './halcyon-data';

const DAY = 86_400_000;
export const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const BUSINESS_DATE = utc(BUSINESS_DATE_ISO);

export const GROUP = { name: 'Halcyon Hospitality', fullName: 'Halcyon Hospitality Group', hotels: HOTELS.length } as const;
export const HOTEL = {
  code: FOCUS.code,
  name: 'Dubai Business Bay',
  fullName: FOCUS.name,
  rooms: FOCUS.rooms,
  city: FOCUS.city,
  currency: FOCUS.currency,
  fx: FOCUS.fx,
} as const;

export interface Night {
  date: number; // UTC ms
  roomsSold: number;
  roomsSoldStly: number;
  avail: number;
  adr: number; // EUR
  adrStly: number; // EUR
  bar: number; // EUR
  barLocal: number; // hotel currency (AED)
  compMedian: number | null; // EUR; null when the comp set is sold out
  compLocal: number | null;
  compsSoldOut: number;
  event?: string;
}

export type Range = 'forward' | 'past';
export type MetricKey = 'occupancy' | 'adr' | 'revpar' | 'revenue';

interface RawNight {
  readonly date: string;
  readonly sold: number;
  readonly sold_stly: number;
  readonly rev: number;
  readonly rev_stly: number;
  readonly bar: number;
  readonly comp: number | null;
  readonly comps_sold_out: number;
  readonly avail: number;
  readonly event: string | null;
}

function toNight(r: RawNight): Night {
  const fx = HOTEL.fx;
  return {
    date: utc(r.date),
    roomsSold: r.sold,
    roomsSoldStly: r.sold_stly,
    avail: r.avail,
    adr: r.sold ? (r.rev / r.sold) * fx : 0,
    adrStly: r.sold_stly ? (r.rev_stly / r.sold_stly) * fx : 0,
    bar: r.bar * fx,
    barLocal: r.bar,
    compMedian: r.comp === null ? null : r.comp * fx,
    compLocal: r.comp,
    compsSoldOut: r.comps_sold_out,
    event: r.event ?? undefined,
  };
}

export const NIGHTS: Record<Range, Night[]> = {
  forward: (FOCUS_FORWARD as readonly RawNight[]).map(toNight),
  past: (FOCUS_PAST as readonly RawNight[]).map(toNight),
};

export function metricSeries(nights: Night[], metric: MetricKey, stly = false): number[] {
  return nights.map((n) => {
    const sold = stly ? n.roomsSoldStly : n.roomsSold;
    const adr = stly ? n.adrStly : n.adr;
    switch (metric) {
      case 'occupancy':
        return (sold / n.avail) * 100;
      case 'adr':
        return adr;
      case 'revpar':
        return (sold * adr) / n.avail;
      case 'revenue':
        return sold * adr;
    }
  });
}

export function metricTotal(nights: Night[], metric: MetricKey, stly = false): number {
  const sold = nights.reduce((s, n) => s + (stly ? n.roomsSoldStly : n.roomsSold), 0);
  const rev = nights.reduce((s, n) => s + (stly ? n.roomsSoldStly * n.adrStly : n.roomsSold * n.adr), 0);
  const avail = nights.reduce((s, n) => s + n.avail, 0);
  switch (metric) {
    case 'occupancy':
      return (sold / avail) * 100;
    case 'adr':
      return rev / sold;
    case 'revpar':
      return rev / avail;
    case 'revenue':
      return rev;
  }
}

const eur0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const local0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: HOTEL.currency, maximumFractionDigits: 0 });

export const METRICS: Record<MetricKey, { label: string; short: string; format: (n: number) => string; deltaUnit: 'pt' | '%' }> = {
  occupancy: { label: 'Occupancy', short: 'Occ', format: (n) => `${n.toFixed(1)}%`, deltaUnit: 'pt' },
  adr: { label: 'ADR', short: 'ADR', format: (n) => eur0.format(n), deltaUnit: '%' },
  revpar: { label: 'RevPAR', short: 'RevPAR', format: (n) => eur0.format(n), deltaUnit: '%' },
  revenue: { label: 'Room revenue', short: 'Revenue', format: (n) => (n >= 1e6 ? `€${(n / 1e6).toFixed(1)}M` : `€${Math.round(n / 1e3)}k`), deltaUnit: '%' },
};

export const formatEur = (n: number) => eur0.format(n);
/** Rates in the hotel's own currency, as the RMS holds them. */
export const formatLocal = (n: number) => local0.format(n);
/** Money in the brief's style: €1.34M, €43k (the backend's own formatter). */
export const formatEurShort = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `€${(Math.abs(n) / 1e6).toFixed(2)}M` : `€${Math.round(Math.abs(n) / 1000)}k`;

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
export const formatDay = (d: number) => dayFmt.format(d).replace('Sept', 'Sep');
export const formatWeekday = (d: number) => weekdayFmt.format(d);

export interface Decision {
  night: Night;
  occ: number;
  occLy: number;
  pace: number; // points vs STLY
  barGap: number; // BAR minus comp-set median, EUR
  kind: 'lower' | 'raise' | 'package';
  target?: number; // recommended BAR, EUR
  targetLocal?: number; // recommended BAR in the hotel currency
  action: string;
  reason: string;
  impact: number; // EUR, the most the change can add on rooms still unsold
  lead: number; // days until arrival
}

export const BUSINESS_DAY = BUSINESS_DATE;

/**
 * Nights that need a rate decision. Same rule as the backend's `underpriced_demand` detector:
 * BAR under 0.85× the comp-set median while at least 2 competitors are sold out or the hotel is over 70% full.
 * The recommendation is the comp-set median (rounded down to 5 in the hotel's currency), and the impact is
 * what that adds on the rooms still unsold if they sell: a ceiling, computed by rule, never by the model.
 */
export function decisionNights(): Decision[] {
  return NIGHTS.forward
    .map((n): Decision | null => {
      if (n.compLocal === null || n.compMedian === null) return null;
      const ratio = n.barLocal / n.compLocal;
      if (!(ratio < 0.85 && (n.compsSoldOut >= 2 || n.roomsSold > 0.7 * n.avail))) return null;
      const occ = (n.roomsSold / n.avail) * 100;
      const occLy = (n.roomsSoldStly / n.avail) * 100;
      const targetLocal = Math.floor(n.compLocal / 5) * 5;
      const target = targetLocal * HOTEL.fx;
      const lead = Math.round((n.date - BUSINESS_DATE) / DAY);
      return {
        night: n,
        occ,
        occLy,
        pace: occ - occLy,
        barGap: n.bar - n.compMedian,
        kind: 'raise',
        target,
        targetLocal,
        action: `Raise BAR to ${eur0.format(target)}`,
        reason: `${ratio.toFixed(2)}× the comp set${n.compsSoldOut ? ` · ${n.compsSoldOut} sold out` : ''}`,
        impact: (targetLocal - n.barLocal) * (n.avail - n.roomsSold) * HOTEL.fx,
        lead,
      };
    })
    .filter((d): d is Decision => d !== null)
    .sort((a, b) => a.night.date - b.night.date);
}

/** Real booking curve for a forward night: occupancy on the books from 90 days out to arrival, this year and last. */
export function paceFor(date: number): { ty: (number | null)[]; ly: number[]; from: number } | null {
  const iso = new Date(date).toISOString().slice(0, 10);
  const c = (FOCUS_CURVES as Record<string, { readonly ty: readonly (number | null)[]; readonly ly: readonly number[] }>)[iso];
  const n = NIGHTS.forward.find((x) => x.date === date);
  if (!c || !n) return null;
  return { ty: c.ty.map((v) => (v === null ? null : (v / n.avail) * 100)), ly: c.ly.map((v) => (v / n.avail) * 100), from: 90 };
}
