import { Service, computed, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { BUSINESS_DAY, Decision, MetricKey, NIGHTS, decisionNights, formatDay, formatEur, formatEurShort, utc } from './data';
import type { ChartSpec } from './portfolio';
import { PORTFOLIO_SPECS, type Drill } from './portfolio';
import { drillContent } from './drill';
import { humanizeText } from './text';
import { COMPARES, CompareKey, FilterState, Filters, Pill, RANGES, RangeKey, scopeChips } from './filters';
import { AMS_BOOKING_SHARE, AMS_CONVERSION, BCN_OUT_OF_ORDER, BER_FEEDS, BRIEF, DPS_KITCHEN, GOP_MONTHLY, LIS_PACE, NYC_ACCOUNT } from './halcyon-data';

/* ───────────────────────── Artifact specs ─────────────────────────
   One declarative recipe for people and the AI: the model emits a spec,
   the same spec a user would build by hand. Components fetch the numbers. */
export type ArtifactSpec =
  | {
      id: string;
      kind: 'line';
      title: string;
      subtitle: string;
      metric: MetricKey;
      from: number; // index into NIGHTS.forward
      to: number;
      marks: number[]; // relative to `from`
      markLabel: string;
      source: string;
    }
  | {
      id: string;
      kind: 'bars';
      title: string;
      subtitle: string;
      rows: { label: string; value: number; note: string; display?: string; hi?: boolean }[];
      source: string;
    }
  | {
      id: string;
      kind: 'columns';
      title: string;
      subtitle: string;
      points: { label: string; value: number; hi?: boolean }[];
      unit: string;
      source: string;
    };

export type GenPhase = 'choosing' | 'props' | 'data' | 'done';
/** A brief item id, e.g. 'underpriced_demand:DXB2'. */
export type Topic = string;

interface Seg {
  t: string;
  b?: boolean;
  tone?: 'neg' | 'pos';
}
export interface Proposal {
  title: string;
  from: number;
  to: number;
  verb: 'Lower' | 'Raise';
  impact: number;
  reaches: string;
  why: string;
}
export interface TopicContent {
  steps: { title: string; detail: string }[];
  answer: Seg[];
  sources: string[];
  artifact: ArtifactSpec;
  proposal?: Proposal;
  definitions: [string, string][];
  sql: string;
  followUps: string[];
}

/* ───────────────────────── The morning brief (real data) ─────────────────────────
   The items are the backend's own detector results over compass_hotels (halcyon-data.ts),
   ranked the way the backend ranks them: a broken data feed first, then by money. */
export interface BriefRow {
  id: string;
  kind: string;
  severity: 'critical' | 'warning';
  hotel_code: string;
  hotel_name: string;
  impact_eur: number | null;
  impact_basis: string;
  sources: readonly string[];
  facts: Readonly<Record<string, string | number | null>>;
  /** The detector SQL (snapshot only; the live API keeps it server-side). */
  sql?: string;
  /** Live brief only: the backend's deterministic title, the model's summary, and the "Explore" question. */
  title?: string;
  summary?: string;
  question?: string;
}
export const BRIEF_ITEMS = BRIEF as unknown as readonly BriefRow[];
export const shortHotel = (name: string) => name.replace(/^(Arbor|Lumen|Tessera|Kestrel) /, '');
const fact = (r: BriefRow, k: string) => r.facts[k] ?? '';
const n0 = (n: number) => Math.round(n).toLocaleString('en-GB');
export const isoDay = (iso: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(utc(iso));
const monthShort = (ym: string) => new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(utc(`${ym}-01`));
const monthLong = (ym: string) => new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(utc(`${ym}-01`));
export interface GopMonth {
  month: string;
  gop: number;
  gop_budget: number;
}
export const gopMonths = (hotel: string) => ((GOP_MONTHLY as unknown as Record<string, GopMonth[]>)[hotel] ?? []);

/** Signed money in the brief's style: −€1.34M, +€43k. */
export const briefMoney = (r: BriefRow) => (r.impact_eur === null ? '' : `${r.impact_eur < 0 ? '−' : '+'}${formatEurShort(r.impact_eur)}`);

/** Short UI titles written from each detector's facts (the backend keeps longer deterministic titles). */
export function briefTitle(r: BriefRow): string {
  const h = shortHotel(r.hotel_name);
  switch (r.kind) {
    case 'data_stale':
      return `${h}: the ${fact(r, 'system')} feed hasn’t synced for ${fact(r, 'days_behind')} days`;
    case 'account_loss':
      return `${h} lost most of ${fact(r, 'account')}, its biggest corporate account`;
    case 'rooms_out_of_order':
      return `${h} has ${Math.round(Number(fact(r, 'avg_rooms_out')))} of ${fact(r, 'physical_rooms')} rooms out of order`;
    case 'web_conversion_drop':
      return `${h}: mobile conversion fell from ${fact(r, 'conversion_pct_previous_60d')}% to ${fact(r, 'conversion_pct_last_30d')}%`;
    case 'staffing_gap':
      return `${h}: the kitchen worked ${Math.round(Number(fact(r, 'staffing_pct')))}% of the hours it needed`;
    case 'underpriced_demand':
      return `${h} is priced under the market for Gulf Tech Week`;
    case 'pace_behind':
      return `${h} is ${Math.abs(Number(fact(r, 'pace_pct')))}% behind last year for the next 45 nights`;
    case 'gop_miss':
      return `${h} missed its ${monthLong(String(fact(r, 'month')))} GOP budget by ${Math.abs(Number(fact(r, 'gop_var_pct')))}%`;
    default:
      return `${h}: ${r.kind.replace(/_/g, ' ')}`;
  }
}

/** "Ask about this" opens the backend's own Explore question for the item. */
export function briefQuestion(r: BriefRow): string {
  const h = r.hotel_name;
  switch (r.kind) {
    case 'data_stale':
      return `Is anything wrong with the data at ${h}? What does the stale ${fact(r, 'system')} feed affect?`;
    case 'pace_behind':
      return `Why is ${h} pacing behind last year for the next 45 nights?`;
    case 'underpriced_demand':
      return `How is ${h} priced for ${isoDay(String(fact(r, 'first_night')))} to ${isoDay(String(fact(r, 'last_night')))} against its comp set?`;
    case 'account_loss':
      return `What happened with ${fact(r, 'account')} at ${h}, and what did it cost?`;
    case 'web_conversion_drop':
      return `Why did ${fact(r, 'device')} conversion on the ${h} website drop, and where did those bookings go?`;
    case 'staffing_gap':
      return `What is the ${fact(r, 'department')} staffing gap at ${h} doing to guests and revenue?`;
    case 'rooms_out_of_order':
      return `Why does ${h} have rooms out of order, and what are guests saying?`;
    case 'gop_miss':
      return `Why did ${h} miss its GOP budget in ${fact(r, 'month')}, and which P&L lines drove it?`;
    default:
      return `What happened at ${h}?`;
  }
}

/* Today's pending decision: Dubai Business Bay's Gulf Tech Week nights (story S6). */
export const DECISION_ID = 'underpriced_demand:DXB2';
export const DECISIONS: Decision[] = decisionNights();
export const DECISION_DATES = DECISIONS.map((d) => d.night.date);
export const DECISION_UNSOLD = DECISIONS.reduce((s, d) => s + d.night.avail - d.night.roomsSold, 0);
export const DECISION_UPSIDE = DECISIONS.reduce((s, d) => s + d.impact, 0);

const OTB_DEF: [string, string] = ['On the books', 'rooms booked and not cancelled, as of Fri 20 Nov'];
const STLY_DEF: [string, string] = ['Last year', 'same weekday 364 days earlier, at the same lead time'];
const BUSINESS_NOW = Date.UTC(2026, 10, 20, 7, 0);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hoursSince = (s: string) => {
  const [, d, mon, hm] = s.split(' ');
  const [hh, mm] = hm.split(':').map(Number);
  return Math.max(1, Math.round((BUSINESS_NOW - Date.UTC(2026, MONTHS.indexOf(mon), Number(d), hh, mm)) / 3_600_000));
};

function topicFor(r: BriefRow): TopicContent {
  const h = shortHotel(r.hotel_name);
  const base = { sources: r.sources.map((s) => s.replace(/^hotel\./, '')), sql: r.sql ?? '' };
  const impact = formatEurShort(r.impact_eur ?? 0);
  switch (r.kind) {
    case 'underpriced_demand': {
      const peak = DECISIONS[0];
      const from = Math.max(0, NIGHTS.forward.findIndex((n) => n.date === utc('2026-12-09')));
      const first = isoDay(String(fact(r, 'first_night')));
      const last = isoDay(String(fact(r, 'last_night')));
      return {
        ...base,
        steps: [
          { title: 'Read rate positions', detail: 'v_rate_position · 20 hotels × 45 nights' },
          { title: 'Checked rooms on the books', detail: 'otb_as_of() · as of 20 Nov' },
          { title: 'Matched city events', detail: 'Gulf Tech Week · 15–19 Dec' },
          { title: 'Applied the rule', detail: 'under 0.85× the median while busy' },
        ],
        answer: [
          { t: `${r.hotel_name} sells Gulf Tech Week (` },
          { t: `${first} – ${last}`, b: true },
          { t: ') at ' },
          { t: `${fact(r, 'avg_bar_vs_comp')}× the comp-set median`, b: true, tone: 'neg' },
          { t: `. It is already ${Math.round(peak.occ)}% full on ${first}, and ${fact(r, 'most_comps_sold_out_on_one_night')} competitors are sold out. At today’s rates the rooms already booked leave about ` },
          { t: impact, b: true },
          { t: ` on the table; the ${DECISION_UNSOLD} rooms still unsold can be repriced.` },
        ],
        artifact: {
          id: 'a-dxb2',
          kind: 'line',
          title: 'Occupancy on the books · 9–23 Dec',
          subtitle: `${h} · this year vs last year`,
          metric: 'occupancy',
          from,
          to: from + 15,
          marks: DECISION_DATES.map((d) => NIGHTS.forward.findIndex((n) => n.date === d) - from),
          markLabel: 'Gulf Tech Week',
          source: 'pace_vs_stly() · 15 nights',
        },
        proposal: {
          title: `Raise BAR for ${first} – ${last}`,
          from: peak.night.bar,
          to: peak.target!,
          verb: 'Raise',
          impact: DECISION_UPSIDE,
          reaches: 'Revenue manager · RMS task',
          why: `Each night goes to its comp-set median: ${DECISIONS.map((d) => `${formatDay(d.night.date)} ${formatEur(d.target!)}`).join(', ')}. Compass only reads your data; the revenue manager applies the rates in the RMS.`,
        },
        definitions: [
          ['BAR', 'best available rate for the base room; AED converted at 0.25'],
          ['Comp-set median', 'median of the competitors’ shopped rates for the night; sold-out competitors have no rate'],
          OTB_DEF,
        ],
        followUps: ['What does Dubai Marina charge those nights?', 'How did last year’s event nights pick up?', 'Which other nights are under the market?'],
      };
    }
    case 'account_loss':
      return {
        ...base,
        steps: [
          { title: 'Read accounts and stays', detail: 'reservations · reservation_nights' },
          { title: 'Compared every account', detail: 'last 6 months vs the 6 before' },
          { title: 'Priced the gap', detail: 'room revenue, EUR' },
        ],
        answer: [
          { t: `${fact(r, 'account')}, the biggest corporate account at ${r.hotel_name}, stayed ` },
          { t: `${n0(Number(fact(r, 'room_nights_previous_6m')))} room nights`, b: true },
          { t: ' in the six months before and ' },
          { t: n0(Number(fact(r, 'room_nights_last_6m'))), b: true, tone: 'neg' },
          { t: ` in the last six. The last stay was on ${isoDay(String(fact(r, 'last_stay')))}. That is about ` },
          { t: `${impact} less room revenue`, b: true },
          { t: ' than the six months before.' },
        ],
        artifact: {
          id: 'a-nyc',
          kind: 'columns',
          title: `${fact(r, 'account')} · room nights per month`,
          subtitle: h,
          points: (NYC_ACCOUNT as readonly { month: string; nights: number }[]).map((m) => ({ label: monthShort(m.month), value: m.nights })),
          unit: '',
          source: 'reservation_nights · accounts',
        },
        definitions: [['Room nights', 'nights stayed; cancelled bookings excluded'], ['Impact', r.impact_basis]],
        followUps: ['Who filled the rooms Vantor used to take?', 'Which other accounts are shrinking?', 'Set up a watcher for corporate accounts'],
      };
    case 'rooms_out_of_order':
      return {
        ...base,
        steps: [
          { title: 'Read room inventory', detail: 'room_inventory_daily · next 30 days' },
          { title: 'Priced the rooms', detail: 'last 30 days occupancy × ADR' },
        ],
        answer: [
          { t: `${r.hotel_name} has ` },
          { t: `${fact(r, 'avg_rooms_out')} of its ${fact(r, 'physical_rooms')} rooms`, b: true },
          { t: ' out of order on average for the next 30 days: ' },
          { t: `${n0(Number(fact(r, 'out_of_order_nights')))} room nights`, b: true },
          { t: ' it cannot sell. At last month’s occupancy and ADR that is about ' },
          { t: impact, b: true },
          { t: ' of room revenue.' },
        ],
        artifact: {
          id: 'a-bcn',
          kind: 'columns',
          title: 'Rooms out of order · weekly average',
          subtitle: h,
          points: (BCN_OUT_OF_ORDER as readonly { week: string; rooms_out: number }[]).map((w) => ({ label: formatDay(utc(w.week)), value: w.rooms_out, hi: utc(w.week) >= BUSINESS_DAY })),
          unit: '',
          source: 'room_inventory_daily · 18 weeks',
        },
        definitions: [['Out of order', 'rooms that cannot be sold that night'], ['Impact', r.impact_basis]],
        followUps: ['When does the renovation finish?', 'What are guests saying about noise?', 'Which nights would have sold out?'],
      };
    case 'web_conversion_drop':
      return {
        ...base,
        steps: [
          { title: 'Read web analytics', detail: 'web_daily · sessions and bookings by device' },
          { title: 'Compared conversion', detail: 'last 30 days vs the 60 before' },
          { title: 'Priced lost bookings', detail: 'earlier rate × average booking value' },
        ],
        answer: [
          { t: `Mobile conversion on the ${r.hotel_name} website fell to ` },
          { t: `${fact(r, 'conversion_pct_last_30d')}%`, b: true, tone: 'neg' },
          { t: ' in the last 30 days from ' },
          { t: `${fact(r, 'conversion_pct_previous_60d')}%`, b: true },
          { t: ' in the 60 days before, while desktop held at about 3%. The drop starts in the week of 19 Oct, and Booking.com’s share of new leisure bookings rose from ' },
          { t: `${AMS_BOOKING_SHARE.before}% to ${AMS_BOOKING_SHARE.after}%`, b: true },
          { t: `. Lost direct bookings come to about ${impact}.` },
        ],
        artifact: {
          id: 'a-ams',
          kind: 'columns',
          title: 'Mobile conversion · weekly',
          subtitle: `${h} website`,
          points: (AMS_CONVERSION as readonly { week: string; mobile: number }[]).map((w) => ({ label: formatDay(utc(w.week)), value: w.mobile, hi: utc(w.week) >= utc('2026-10-19') })),
          unit: '%',
          source: 'web_daily · 13 weeks',
        },
        definitions: [['Conversion', 'bookings ÷ sessions on the hotel website'], ['Impact', r.impact_basis]],
        followUps: ['What changed on the website around 19 Oct?', 'What did the shift to Booking.com cost in commission?', 'Set up a watcher for web conversion'],
      };
    case 'staffing_gap':
      return {
        ...base,
        steps: [
          { title: 'Read labour', detail: 'labor_daily · required vs worked hours' },
          { title: 'Read F&B', detail: 'fnb_daily · last 60 days' },
        ],
        answer: [
          { t: `The kitchen at ${r.hotel_name} worked ` },
          { t: `${fact(r, 'staffing_pct')}%`, b: true, tone: 'neg' },
          { t: ' of the hours its workload needed over the last 30 days. Week by week it ran at 68–71% from 5 Oct to 2 Nov and is back above 90% since 9 Nov. F&B revenue in the last 30 days is about ' },
          { t: impact, b: true },
          { t: ' below the 30 days before.' },
        ],
        artifact: {
          id: 'a-dps',
          kind: 'columns',
          title: 'Kitchen hours worked vs needed · weekly',
          subtitle: h,
          points: (DPS_KITCHEN as readonly { week: string; pct: number }[]).map((w) => ({ label: formatDay(utc(w.week)), value: w.pct, hi: w.pct < 90 })),
          unit: '%',
          source: 'labor_daily · 17 weeks',
        },
        definitions: [['Staffing', 'hours worked ÷ hours the workload needed'], ['Impact', r.impact_basis]],
        followUps: ['What did guests say about the food?', 'How did covers per occupied room change?', 'Which other kitchens are short-staffed?'],
      };
    case 'pace_behind': {
      const nights = LIS_PACE as readonly { bar_vs_comp: number | null }[];
      const priced = nights.filter((x) => x.bar_vs_comp !== null);
      const ratio = priced.reduce((s, x) => s + (x.bar_vs_comp ?? 0), 0) / Math.max(1, priced.length);
      const ty = Number(fact(r, 'rooms_otb'));
      const ly = Number(fact(r, 'rooms_otb_stly'));
      return {
        ...base,
        steps: [
          { title: 'Ran the pace check', detail: 'pace_vs_stly() · 20 hotels × 45 nights' },
          { title: 'Flagged hotels', detail: 'more than 10% behind last year' },
          { title: 'Read the rate position', detail: 'v_rate_position · Lisbon' },
        ],
        answer: [
          { t: `${r.hotel_name} has ` },
          { t: `${n0(ty)} rooms`, b: true },
          { t: ' on the books for the next 45 nights against ' },
          { t: n0(ly), b: true },
          { t: ' at the same point last year: ' },
          { t: `${Math.abs(Number(fact(r, 'pace_pct')))}% behind`, b: true, tone: 'neg' },
          { t: `, about ${impact} of room revenue. Its BAR averages ${ratio.toFixed(2)}× the comp-set median over those nights.` },
        ],
        artifact: {
          id: 'a-lis',
          kind: 'bars',
          title: 'Rooms on the books · next 45 nights',
          subtitle: h,
          rows: [
            { label: 'This year', value: ty, display: n0(ty), note: '', hi: true },
            { label: 'Last year', value: ly, display: n0(ly), note: '' },
          ],
          source: 'pace_vs_stly()',
        },
        definitions: [OTB_DEF, STLY_DEF, ['Impact', r.impact_basis]],
        followUps: ['Who changed Lisbon’s rates?', 'Which nights are furthest behind?', 'What would matching the comp set do?'],
      };
    }
    case 'gop_miss': {
      const months = gopMonths(r.hotel_code);
      const last = months[months.length - 1];
      return {
        ...base,
        steps: [
          { title: 'Read the P&L', detail: 'pnl_monthly · last closed month' },
          { title: 'Compared with budget', detail: 'GOP and total revenue, EUR' },
        ],
        answer: [
          { t: `${r.hotel_name} missed its ${monthLong(String(fact(r, 'month')))} GOP budget by ` },
          { t: `${Math.abs(Number(fact(r, 'gop_var_pct')))}%`, b: true, tone: 'neg' },
          { t: last ? `: ${formatEurShort(last.gop)} against ${formatEurShort(last.gop_budget)} budgeted, about ` : ', about ' },
          { t: `${impact} short`, b: true },
          { t: `. Revenue was ${Math.abs(Number(fact(r, 'revenue_var_pct')))}% under budget, and the GOP margin was ${fact(r, 'gop_margin_pct')}% against ${fact(r, 'gop_margin_budget_pct')}% planned.` },
        ],
        artifact: {
          id: `a-${r.hotel_code}-gop`,
          kind: 'columns',
          title: 'GOP per month · actual',
          subtitle: `${h} · highlighted: under budget`,
          points: months.map((m) => ({ label: monthShort(m.month), value: m.gop, hi: m.gop < m.gop_budget })),
          unit: '',
          source: 'pnl_monthly · 12 months',
        },
        definitions: [['GOP', 'gross operating profit: revenue minus departmental and undistributed expenses (USALI)'], ['Impact', r.impact_basis]],
        followUps: ['Which P&L lines drove the miss?', 'How does November look against budget?', 'Which other hotels are under budget?'],
      };
    }
    case 'data_stale': {
      const feeds = BER_FEEDS as readonly { system: string; status: string; last_sync: string }[];
      const at = String(fact(r, 'last_sync_at'));
      return {
        ...base,
        steps: [
          { title: 'Read data sources', detail: 'data_sources · 140 feeds' },
          { title: 'Flagged stale feeds', detail: '1 of 140 not syncing' },
        ],
        answer: [
          { t: 'The ' },
          { t: `${fact(r, 'system')} feed (${fact(r, 'vendor')})`, b: true },
          { t: ` at ${r.hotel_name} last synced on ` },
          { t: `${isoDay(at.slice(0, 10))} at ${at.slice(11)}`, b: true },
          { t: `, ${fact(r, 'days_behind')} days ago. Its other ${feeds.length - 1} feeds synced this morning. Until it catches up, Berlin’s F&B figures for those days are incomplete.` },
        ],
        artifact: {
          id: 'a-ber',
          kind: 'bars',
          title: 'Hours since each feed last synced',
          subtitle: h,
          rows: feeds.map((x) => ({ label: x.system, value: hoursSince(x.last_sync), display: `${hoursSince(x.last_sync)} h`, note: '', hi: x.status !== 'ok' })),
          source: 'data_sources',
        },
        definitions: [['Stale', 'the source has not synced on its schedule'], ['Impact', r.impact_basis]],
        followUps: ['What does the missing POS data affect?', 'Show Berlin’s F&B for the last 14 days', 'Which other feeds failed this month?'],
      };
    }
    default:
      // A detector this prototype doesn't know yet (the backend keeps adding them): show its own facts.
      return {
        ...base,
        steps: [{ title: 'Ran the detector', detail: base.sources.join(' · ') }],
        answer: [{ t: `${briefTitle(r)}. ` }, { t: r.impact_eur === null ? '' : `Impact ${briefMoney(r)}: ${r.impact_basis}.` }],
        artifact: {
          id: `a-${r.id}`,
          kind: 'bars',
          title: 'What the detector found',
          subtitle: h,
          rows: Object.entries(r.facts)
            .filter(([, v]) => typeof v === 'number')
            .map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: Math.abs(Number(v)), display: String(v), note: '' })),
          source: base.sources.join(' · '),
        },
        definitions: [['Impact', r.impact_basis]],
        followUps: [],
      };
  }
}

export const TOPICS: Record<Topic, TopicContent> = Object.fromEntries(BRIEF_ITEMS.map((r) => [r.id, topicFor(r)]));

/**
 * The scope a brief answer was computed for, and the nearest dashboard filters that show it.
 * When the answer's own window isn't a preset, the note says which preset it maps to.
 */
export function topicScope(topic: Topic): AnswerScope | undefined {
  const r = BRIEF_ITEMS.find((x) => x.id === topic);
  return r ? scopeForRow(r) : undefined;
}
export function scopeForRow(r: BriefRow): AnswerScope {
  const h = shortHotel(r.hotel_name);
  const own: Record<string, [string, string, RangeKey, CompareKey, string?]> = {
    pace_behind: ['stays 21 Nov 2026 – 4 Jan 2027 (next 45 nights)', 'vs same time last year', 'next30', 'stly', 'The answer covers 45 nights; the closest preset is next 30 nights'],
    underpriced_demand: [r.kind === 'underpriced_demand' ? `stays ${isoDay(String(fact(r, 'first_night')))} – ${isoDay(String(fact(r, 'last_night')))}` : '', 'vs comp-set median', 'next30', 'stly', 'The comp-set comparison isn’t a dashboard filter; the dashboard shows these nights within the next 30'],
    account_loss: ['stays in the last 6 months', 'vs the 6 months before', 'last30', 'ly_dow', 'Six-month windows aren’t presets; the dashboard shows the last 30 nights'],
    gop_miss: ['October 2026', 'vs budget', 'last_month', 'budget'],
    rooms_out_of_order: ['stays in the next 30 nights', 'out-of-order rooms', 'next30', 'stly'],
    web_conversion_drop: ['last 30 days vs the 60 before', 'mobile web', 'last30', 'ly_dow', 'Web sessions aren’t on the dashboard; it shows the same hotel and days'],
    staffing_gap: ['last 30 days', 'kitchen hours vs required', 'last30', 'ly_dow', 'Labour isn’t on the dashboard; it shows the same hotel and days'],
    data_stale: ['POS feed, last 7 days', 'last sync 17 Nov', 'last7', 'ly_dow'],
  };
  const o = own[r.kind];
  if (!o) return { chips: [h], patch: { hotels: [r.hotel_code] }, said: { hotels: `from the answer: ${h}` } };
  return {
    chips: [h, o[0], o[1]],
    patch: { hotels: [r.hotel_code], range: o[2], compare: o[3] },
    said: { hotels: `from the answer: ${h}`, range: o[4] ? o[4].replace(/^The answer covers/, 'answer covers') : `from the answer: ${RANGES[o[2]].label.toLowerCase()}`, compare: `from the answer: ${COMPARES[o[3]].label.toLowerCase()}` },
    note: o[4],
  };
}

/** Inbox items from brief rows: the deterministic title, the model's summary when there is one, the Explore question. */
function toItems(rows: readonly BriefRow[], old: readonly InboxItem[]): InboxItem[] {
  return rows.map((r) => {
    const prev = old.find((i) => i.id === r.id);
    return {
      id: r.id,
      topic: r.id,
      question: r.question ?? briefQuestion(r),
      summary: r.summary ? humanizeText(r.summary) : undefined,
      kind: 'insight',
      impact: briefMoney(r),
      tone: (r.impact_eur ?? -1) < 0 ? 'neg' : 'pos',
      title: briefTitle(r),
      detail: r.impact_basis,
      from: 'Morning brief',
      time: '07:00',
      status: prev?.status ?? 'new',
      resolution: prev?.resolution,
    };
  });
}

/** Routes a typed or spoken question to the brief item it is about (hotel names first, then the subject). */
export function guessTopic(q: string): Topic {
  const s = q.toLowerCase();
  const pick = (kind: string) => BRIEF_ITEMS.find((r) => r.kind === kind)?.id ?? BRIEF_ITEMS[0].id;
  if (/lisbon/.test(s)) return pick('pace_behind');
  if (/dubai|business bay|tech week/.test(s)) return pick('underpriced_demand');
  if (/new york|vantor/.test(s)) return pick('account_loss');
  if (/amsterdam/.test(s)) return pick('web_conversion_drop');
  if (/bali/.test(s)) return pick('staffing_gap');
  if (/barcelona/.test(s)) return pick('rooms_out_of_order');
  if (/berlin/.test(s)) return pick('data_stale');
  if (/comp set|comp-set|under the market|underpric|raise|rate decision/.test(s)) return pick('underpriced_demand');
  if (/account|corporate/.test(s)) return pick('account_loss');
  if (/mobile|conversion|website|booking\.com|channel|ota/.test(s)) return pick('web_conversion_drop');
  if (/kitchen|staff|f&b|food|covers/.test(s)) return pick('staffing_gap');
  if (/out of order|renovation|noise/.test(s)) return pick('rooms_out_of_order');
  if (/feed|stale|sync|pos\b/.test(s)) return pick('data_stale');
  return pick('pace_behind');
}

/* ───────────────────────── Threads ───────────────────────── */
export interface TraceStep {
  title: string;
  detail: string;
  status: 'pending' | 'running' | 'done';
}
export type Feedback = null | 'up' | 'down' | 'sent';
export interface Turn {
  id: number;
  question: string;
  topic: Topic;
  steps: TraceStep[];
  phase: GenPhase;
  answerVisible: boolean;
  stopped: boolean;
  seconds: number;
  proposal: 'open' | 'editing' | 'approved' | 'denied';
  target: number;
  feedback: Feedback;
  copied: boolean;
}
export interface Thread {
  id: string;
  title: string;
  itemId?: string;
  turns: Turn[];
  /** The scope this answer was computed for, shown as one line of chips (report: every quantitative answer declares it). */
  scope?: AnswerScope;
}
export interface AnswerScope {
  chips: string[];
  /** The dashboard filters that would show the same scope; null when no preset matches (a single night). */
  patch: Partial<FilterState> | null;
  said: Partial<Record<Pill, string>>;
  note?: string;
}

/* ───────────────────────── Inbox ───────────────────────── */
export interface InboxItem {
  id: string;
  /** The question "Explore" puts in the composer. */
  question: string;
  /** The model's one or two sentences (live brief), shown with an AI label. */
  summary?: string;
  topic: Topic;
  kind: 'insight' | 'approval';
  impact: string;
  tone: 'neg' | 'pos';
  title: string;
  detail: string;
  from: string;
  time: string;
  status: 'new' | 'seen' | 'done';
  resolution?: string;
}

/* ───────────────────────── Boards ───────────────────────── */
export type Widget =
  | { id: string; kind: 'performance' }
  | { id: string; kind: 'decisions' }
  | { id: string; kind: 'artifact'; spec: ArtifactSpec; addedFrom: string }
  | { id: string; kind: 'chart'; spec: ChartSpec };
export interface Board {
  id: string;
  name: string;
  description: string;
  headline: MetricKey;
  updated: string;
  widgets: Widget[];
}

/* ───────────────────────── Watchers ───────────────────────── */
export type RunOutcome = 'none' | 'finding' | 'pending' | 'failed' | 'skipped';
export type WatcherStatus = 'needs' | 'running' | 'watching' | 'paused' | 'failed';
export interface Watcher {
  id: string;
  name: string;
  glyph: string;
  /** "What it watches": text with bold values, like Mercury's rule sentences. */
  sentence: { t: string; b?: boolean }[];
  latest: { when: string; headline: string; why: string };
  runs: RunOutcome[]; // oldest → newest, last 14
  span: string;
  cadence: string;
  next: string | null;
  autonomy: 1 | 2 | 3;
  enabled: boolean;
  status: WatcherStatus;
  cta?: string;
}
export interface Activity {
  key?: string;
  day: 'Today' | 'Yesterday';
  time: string;
  text: string;
  watcher: string;
  by?: 'you';
  action?: 'review';
}
/** A watcher before it exists: what the create flow and the templates produce. */
export interface WatcherDraft {
  key?: string;
  name: string;
  glyph: string;
  sentence: { t: string; b?: boolean }[];
  cadence: string;
  firstRun: string;
  autonomy: 1 | 2;
  blurb?: string;
}
export type CreateStep = 'describe' | 'manual' | 'review';
export interface NightDecision {
  status: 'accepted' | 'kept';
  price?: number;
  time: string;
  reason?: string;
}

const RATE_LATEST = { when: 'today 06:00', headline: 'Raise Dubai Business Bay to the comp-set median for 16–18 Dec', why: 'Gulf Tech Week · 0.78× the comp set · 3 competitors sold out' };
const NEXT_RUN: Record<string, string> = { rate: 'next in 21 h 40 min', pace: 'next in 22 h 40 min', feeds: 'next in 40 min' };

export type View = 'inbox' | 'thread' | 'boards' | 'board' | 'watchers' | 'watcher' | 'builder' | 'catalog';

/** Views with an address of their own; the rest live at "/". */
const BUILDER_PATH = '/workflows/new';
export const isBuilderUrl = (loc: Pick<Location, 'pathname' | 'search'>) => loc.pathname.startsWith(BUILDER_PATH) || new URLSearchParams(loc.search).has('builder');
function initialView(): View {
  const loc = globalThis.location;
  return loc && isBuilderUrl(loc) ? 'builder' : 'inbox';
}

@Service()
export class CompassStore {
  readonly view = signal<View>(initialView());
  readonly activeThreadId = signal<string | null>(null);
  readonly activeBoardId = signal('revenue');
  readonly depth = signal<'quick' | 'thinker'>('thinker');
  /** The watcher page that is open, and the section to land on. */
  readonly activeWatcherId = signal('');
  readonly watcherSection = signal<'top' | 'history' | 'settings'>('top');
  /** The "New watcher" flow (agents_pattern.md §5.8); null when closed. */
  readonly creating = signal<{ step: CreateStep; draft?: WatcherDraft } | null>(null);

  /** The brief's rows: the 20 Nov snapshot until the live brief (GET /api/brief) loads. */
  readonly briefRows = signal<readonly BriefRow[]>(BRIEF_ITEMS);
  readonly briefSource = signal<'snapshot' | 'live'>('snapshot');
  readonly items = signal<InboxItem[]>(toItems(BRIEF_ITEMS, []));

  /** Swaps in a new brief, keeping what the person already did with items that are still there. */
  setBrief(rows: readonly BriefRow[], source: 'snapshot' | 'live') {
    this.briefRows.set(rows);
    this.briefSource.set(source);
    this.items.update((old) => toItems(rows, old));
  }

  readonly threads = signal<Thread[]>([]);
  readonly boards = signal<Board[]>([
    { id: 'portfolio', name: 'Portfolio', description: 'All 20 hotels: position, pace, mix, comp-set index and P&L', headline: 'occupancy', updated: '07:00', widgets: PORTFOLIO_SPECS.map((spec) => ({ id: `w-${spec.id}`, kind: 'chart' as const, spec })) },
    { id: 'revenue', name: 'Dubai Business Bay', description: 'Pace, rates and the nights that need a decision', headline: 'revpar', updated: '07:00', widgets: [{ id: 'w-perf', kind: 'performance' }, { id: 'w-dec', kind: 'decisions' }] },
    { id: 'weekends', name: 'Rate decisions', description: 'Nights priced under the market', headline: 'occupancy', updated: '06:00', widgets: [{ id: 'w-dec2', kind: 'decisions' }] },
    { id: 'channels', name: 'Amsterdam web', description: 'Mobile conversion and where the bookings went', headline: 'adr', updated: 'yesterday', widgets: [{ id: 'w-ams', kind: 'artifact', spec: TOPICS['web_conversion_drop:AMS'].artifact, addedFrom: 'Why did mobile conversion drop in Amsterdam?' }] },
  ]);

  readonly watchers = signal<Watcher[]>([
    {
      id: 'rate',
      name: 'Rate vs comp set',
      glyph: 'phosphorBinocularsLight',
      sentence: [{ t: 'Checks every hotel’s next ' }, { t: '45 nights', b: true }, { t: ' and recommends a rate when BAR sits under ' }, { t: '0.85× the comp set', b: true }, { t: ' on busy nights.' }],
      latest: RATE_LATEST,
      runs: ['none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'pending'],
      span: '14 days',
      cadence: 'Daily 06:00',
      next: 'next in 21 h 40 min',
      autonomy: 2,
      enabled: true,
      status: 'needs',
      cta: 'Review 3 nights',
    },
    {
      id: 'pace',
      name: 'Pace vs last year',
      glyph: 'phosphorTrendDownLight',
      sentence: [{ t: 'Checks all ' }, { t: '20 hotels', b: true }, { t: ' for the next 45 nights and alerts when one is more than ' }, { t: '10% behind last year', b: true }, { t: '.' }],
      latest: { when: 'today 07:00', headline: 'Lisbon Chiado is 17.4% behind for the next 45 nights', why: '2,231 rooms on the books vs 2,700 last year' },
      runs: ['none', 'none', 'none', 'none', 'none', 'finding', 'finding', 'finding', 'finding', 'finding', 'finding', 'finding', 'finding', 'finding'],
      span: '14 days',
      cadence: 'Daily 07:00',
      next: 'next in 22 h 40 min',
      autonomy: 1,
      enabled: true,
      status: 'watching',
    },
    {
      id: 'feeds',
      name: 'Data feeds',
      glyph: 'phosphorDatabaseLight',
      sentence: [{ t: 'Checks the ' }, { t: '140 data feeds', b: true }, { t: ' every hour and alerts when one ' }, { t: 'stops syncing', b: true }, { t: '.' }],
      latest: { when: 'today 08:00', headline: 'Berlin Mitte’s POS feed last synced Tue 17 Nov 04:12', why: 'The other 139 feeds synced this morning' },
      runs: Array<RunOutcome>(14).fill('finding'),
      span: '14 h',
      cadence: 'Hourly',
      next: 'next in 40 min',
      autonomy: 1,
      enabled: true,
      status: 'watching',
    },
  ]);

  readonly activity = signal<Activity[]>([
    { day: 'Today', time: '08:00', text: 'Data feeds checked 140 feeds · Berlin POS still stale', watcher: 'feeds' },
    { day: 'Today', time: '07:00', text: 'Pace vs last year flagged Lisbon Chiado · 17.4% behind', watcher: 'pace' },
    { day: 'Today', time: '06:00', text: 'Rate vs comp set recommended the comp-set median for Dubai Business Bay, 16–18 Dec', watcher: 'rate', action: 'review' },
    { day: 'Yesterday', time: '18:40', text: 'You set Pace vs last year to Alerts only', watcher: 'pace', by: 'you' },
    { day: 'Yesterday', time: '06:00', text: 'Rate vs comp set checked 20 hotels · nothing to recommend', watcher: 'rate' },
  ]);

  /** Decisions on single nights (keyed by UTC date ms). Compass only logs them and sends a task to the RMS. */
  readonly nightDecisions = signal<Record<number, NightDecision>>({});

  readonly activeThread = computed(() => this.threads().find((t) => t.id === this.activeThreadId()) ?? null);
  readonly activeBoard = computed(() => this.boards().find((b) => b.id === this.activeBoardId()) ?? this.boards()[0]);
  readonly needsYou = computed(() => this.items().filter((i) => i.status !== 'done'));
  readonly earlier = computed(() => this.items().filter((i) => i.status === 'done'));
  readonly unread = computed(() => this.items().filter((i) => i.status === 'new').length);
  readonly busy = computed(() => this.threads().some((t) => t.turns.some((x) => !x.answerVisible && !x.stopped)));

  private timers: ReturnType<typeof setTimeout>[] = [];
  private seq = 1;

  /* Navigation */
  go(view: View) {
    if (view === 'builder') return this.openBuilder();
    this.view.set(view);
  }

  /** The workflow builder at /workflows/new. The address changes first: the builder reads its draft id from it. */
  openBuilder() {
    const loc = globalThis.location;
    if (loc && !isBuilderUrl(loc)) globalThis.history?.pushState(null, '', BUILDER_PATH);
    this.view.set('builder');
  }

  openItem(id: string) {
    const item = this.items().find((i) => i.id === id);
    if (!item) return;
    this.items.update((list) => list.map((i) => (i.id === id && i.status === 'new' ? { ...i, status: 'seen' } : i)));
    let thread = this.threads().find((t) => t.itemId === id);
    if (!thread) {
      thread = { id: `t-${id}`, title: item.title, itemId: id, turns: [], scope: topicScope(item.topic) };
      this.threads.update((ts) => [thread!, ...ts]);
      this.activeThreadId.set(thread.id);
      this.view.set('thread');
      this.run(thread.id, this.questionFor(item), item.topic, true);
      return;
    }
    this.activeThreadId.set(thread.id);
    this.view.set('thread');
  }

  openThread(id: string) {
    this.activeThreadId.set(id);
    this.view.set('thread');
  }

  /** Global ask: starts a new thread from anywhere. */
  askNew(question: string) {
    const q = question.trim();
    if (!q) return;
    const id = `t${this.seq++}`;
    const topic = guessTopic(q);
    this.threads.update((ts) => [{ id, title: q, turns: [], scope: topicScope(topic) }, ...ts]);
    this.activeThreadId.set(id);
    this.view.set('thread');
    this.run(id, q, topic, false);
  }

  private readonly filters = inject(Filters);
  /** A click on a chart mark: a structured follow-up, answered from the same chart specs, with its own scope. */
  drill(d: Drill, s: FilterState) {
    const r = drillContent(d, s);
    const key = `drill:${d.dimension}:${d.value}:${JSON.stringify(s)}`;
    TOPICS[key] = r.content;
    const id = `t${this.seq++}`;
    const patch: Partial<FilterState> | null = d.dimension === 'night' ? null : d.dimension === 'hotel' ? { hotels: [d.value] } : d.dimension === 'channel' ? { channels: [d.value], chOp: 'is' } : { segments: [d.value], segOp: 'is' };
    const scope: AnswerScope = {
      chips: [...scopeChips(r.scope), ...(r.extraChip ? [r.extraChip] : [])],
      patch,
      said: d.dimension === 'hotel' ? { hotels: `clicked ${d.label}` } : d.dimension === 'channel' ? { channel: `clicked ${d.label}` } : d.dimension === 'segment' ? { segment: `clicked ${d.label}` } : {},
      note: patch ? undefined : 'A single night isn’t a dashboard preset',
    };
    this.threads.update((ts) => [{ id, title: r.question, turns: [], scope }, ...ts]);
    this.activeThreadId.set(id);
    this.view.set('thread');
    this.run(id, r.question, key, true);
  }
  /** "Apply to dashboard": the answer's scope becomes the dashboard filters, with a receipt and Undo. */
  applyScope(sc: AnswerScope) {
    if (!sc.patch) return;
    this.filters.set(sc.patch, 'kassandra', sc.said);
    this.openBoard('portfolio');
  }
  scopeDiffers(sc: AnswerScope) {
    if (!sc.patch) return false;
    const cur = this.filters.state();
    return Object.entries(sc.patch).some(([k, v]) => JSON.stringify(cur[k as keyof FilterState]) !== JSON.stringify(v));
  }

  /** Follow-up inside the open thread. */
  ask(question: string) {
    const id = this.activeThreadId();
    if (!id) return this.askNew(question);
    this.run(id, question.trim(), guessTopic(question), false);
  }

  private questionFor(item: InboxItem) {
    const r = BRIEF_ITEMS.find((x) => x.id === item.topic);
    return r ? briefQuestion(r) : item.title;
  }

  /* Generation timeline: trace steps → component skeleton phases → answer */
  private run(threadId: string, question: string, topic: Topic, fast: boolean) {
    if (!question || this.busy()) return;
    const c = TOPICS[topic];
    const turnId = this.seq++;
    const turn: Turn = {
      id: turnId,
      question,
      topic,
      steps: c.steps.map((s) => ({ ...s, status: 'pending' })),
      phase: 'choosing',
      answerVisible: false,
      stopped: false,
      seconds: 3,
      proposal: 'open',
      target: c.proposal?.to ?? 0,
      feedback: null,
      copied: false,
    };
    this.patchThread(threadId, (t) => ({ ...t, turns: [...t.turns, turn] }));
    const k = (fast ? 0.7 : 1) * (this.depth() === 'quick' ? 0.55 : 1);
    const n = c.steps.length;
    const stepAt = (i: number) => (300 + (i * 2400) / n) * k;
    const at = (ms: number, fn: () => void) => this.timers.push(setTimeout(fn, ms));
    const step = (i: number, status: TraceStep['status']) =>
      this.patchTurn(threadId, turnId, (x) => ({ ...x, steps: x.steps.map((s, j) => (j === i ? { ...s, status } : s)) }));

    for (let i = 0; i < n; i++) {
      at(stepAt(i) - 150 * k, () => step(i, 'running'));
      at(stepAt(i + 1) - 150 * k, () => step(i, 'done'));
    }
    at(900 * k, () => this.patchTurn(threadId, turnId, (x) => ({ ...x, phase: 'props' })));
    at(1700 * k, () => this.patchTurn(threadId, turnId, (x) => ({ ...x, phase: 'data' })));
    at(2900 * k, () => this.patchTurn(threadId, turnId, (x) => ({ ...x, phase: 'done' })));
    at(3200 * k, () => this.patchTurn(threadId, turnId, (x) => ({ ...x, answerVisible: true, seconds: Math.max(1, Math.round(3.2 * k)) })));
  }

  stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.threads.update((ts) =>
      ts.map((t) => ({
        ...t,
        turns: t.turns.map((x) => (!x.answerVisible && !x.stopped ? { ...x, stopped: true, seconds: 1, steps: x.steps.map((s) => (s.status === 'done' ? s : { ...s, status: 'pending' as const })) } : x)),
      })),
    );
  }

  patchThread(id: string, fn: (t: Thread) => Thread) {
    this.threads.update((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));
  }
  patchTurn(threadId: string, turnId: number, fn: (t: Turn) => Turn) {
    this.patchThread(threadId, (t) => ({ ...t, turns: t.turns.map((x) => (x.id === turnId ? fn(x) : x)) }));
  }

  /* Approvals resolve the inbox item and the watcher that raised it */
  decide(threadId: string, turnId: number, decision: Turn['proposal']) {
    this.patchTurn(threadId, turnId, (x) => ({ ...x, proposal: decision }));
    const turn = this.threads().find((t) => t.id === threadId)?.turns.find((x) => x.id === turnId);
    if (!turn || turn.topic !== DECISION_ID) return;
    // The card shows the first night; an adjustment moves every night by the same amount.
    const delta = turn.target - (TOPICS[DECISION_ID].proposal?.to ?? turn.target);
    if (decision === 'approved') this.decideBatch(DECISIONS.map((d) => ({ date: d.night.date, price: (d.target ?? 0) + delta })), true);
    else if (decision === 'denied') this.decideNights(DECISION_DATES, { status: 'kept', time: '08:20' }, true);
    else if (decision === 'open') this.decideNights(DECISION_DATES, null, true);
  }

  /** Approves several nights at once, each at its own rate; one receipt with Undo. */
  decideBatch(list: { date: number; price: number }[], silent = false) {
    this.nightDecisions.update((m) => {
      const next = { ...m };
      for (const x of list) next[x.date] = { status: 'accepted', price: x.price, time: '08:20' };
      return next;
    });
    this.syncItemsFromNights();
    if (silent) return;
    toast(`${list.length} rates sent to the RMS as tasks`, {
      description: list.map((x) => `${formatDay(x.date)} ${formatEur(x.price)}`).join(' · '),
      duration: Number.POSITIVE_INFINITY,
      action: { label: 'Undo', onClick: () => this.decideNights(list.map((x) => x.date), null) },
    });
  }

  snoozeItem(id: string) {
    const before = this.items();
    this.items.update((l) => l.map((i) => (i.id === id ? { ...i, status: 'done', resolution: 'Snoozed until tomorrow' } : i)));
    toast('Snoozed until tomorrow', { duration: 10000, action: { label: 'Undo', onClick: () => this.items.set(before) } });
  }

  restoreItem(id: string) {
    this.items.update((l) => l.map((i) => (i.id === id && i.status === 'done' ? { ...i, status: 'seen', resolution: undefined } : i)));
  }

  dismissItem(id: string) {
    const before = this.items();
    this.items.update((l) => l.map((i) => (i.id === id ? { ...i, status: 'done', resolution: 'Marked not useful' } : i)));
    toast('Moved to Earlier', { description: 'Compass will show fewer items like this.', duration: 10000, action: { label: 'Undo', onClick: () => this.items.set(before) } });
  }

  /** Adds a catalogue chart (its spec, not a picture) to another board. */
  addChartToBoard(boardId: string, spec: ChartSpec) {
    const wid = `w${this.seq++}`;
    this.boards.update((bs) => bs.map((b) => (b.id === boardId ? { ...b, updated: 'just now', widgets: [...b.widgets, { id: wid, kind: 'chart', spec: { ...spec, id: `${spec.id}-${wid}` } }] } : b)));
    const board = this.boards().find((b) => b.id === boardId)!;
    toast(`Added to ${board.name}`, { duration: 10000, action: { label: 'View', onClick: () => this.openBoard(boardId) }, cancel: { label: 'Undo', onClick: () => this.removeWidget(boardId, wid) } });
  }

  /* Boards: pin = choose where it goes, confirm with a toast that can undo */
  addToBoard(boardId: string | 'new', spec: ArtifactSpec, from: string) {
    let target = boardId;
    if (boardId === 'new') {
      target = `b${this.seq++}`;
      this.boards.update((bs) => [...bs, { id: target, name: 'New board', description: 'Built from your answers', headline: spec.kind === 'line' ? spec.metric : 'adr', updated: 'just now', widgets: [] }]);
    }
    const wid = `w${this.seq++}`;
    this.boards.update((bs) => bs.map((b) => (b.id === target ? { ...b, updated: 'just now', widgets: [...b.widgets, { id: wid, kind: 'artifact', spec, addedFrom: from }] } : b)));
    const board = this.boards().find((b) => b.id === target)!;
    toast(`Added to ${board.name}`, {
      description: spec.title,
      duration: 10000,
      action: { label: 'View', onClick: () => this.openBoard(target) },
      cancel: { label: 'Undo', onClick: () => this.removeWidget(target, wid) },
    });
  }

  isOnBoard(specId: string) {
    return this.boards().some((b) => b.widgets.some((w) => w.kind === 'artifact' && w.spec.id === specId));
  }

  removeWidget(boardId: string, widgetId: string) {
    this.boards.update((bs) => bs.map((b) => (b.id === boardId ? { ...b, widgets: b.widgets.filter((w) => w.id !== widgetId) } : b)));
  }

  newBoard() {
    const id = `b${this.seq++}`;
    this.boards.update((bs) => [...bs, { id, name: 'New board', description: 'Describe a view to add the first chart', headline: 'occupancy', updated: 'just now', widgets: [] }]);
    this.openBoard(id);
  }

  openBoard(id: string) {
    this.activeBoardId.set(id);
    this.view.set('board');
  }

  /* Night decisions: one shared state for the Inbox, the thread and the decision table */
  decideNights(dates: number[], d: NightDecision | null, silent = false) {
    this.nightDecisions.update((m) => {
      const next = { ...m };
      for (const date of dates) {
        if (d) next[date] = d;
        else delete next[date];
      }
      return next;
    });
    this.syncItemsFromNights();
    if (silent || !d) return;
    const label = dates.length > 1 ? `${dates.length} nights` : new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dates[0]);
    toast(d.status === 'accepted' ? `${d.price ? formatEur(d.price) + ' sent' : 'Sent'} to the RMS as a task` : `Kept the current rate`, {
      description: `${label} · logged ${d.time}${d.reason ? ' · ' + d.reason : ''}`,
      duration: Number.POSITIVE_INFINITY,
      action: { label: 'Undo', onClick: () => this.decideNights(dates, null) },
    });
  }

  private syncItemsFromNights() {
    const m = this.nightDecisions();
    const link: Record<string, number[]> = { [DECISION_ID]: DECISION_DATES };
    this.items.update((list) =>
      list.map((i) => {
        const dates = link[i.id];
        if (!dates) return i;
        if (dates.every((d) => m[d])) {
          const accepted = dates.filter((d) => m[d].status === 'accepted');
          return {
            ...i,
            status: 'done' as const,
            resolution: accepted.length ? `Approved · ${accepted.length} rates sent to the revenue manager · ${m[dates[0]].time}` : `Kept today’s rates · ${m[dates[0]].time}`,
          };
        }
        return i.status === 'done' && i.resolution?.match(/^(Approved|Kept)/) ? { ...i, status: 'seen' as const, resolution: undefined } : i;
      }),
    );
    const done = DECISION_DATES.every((d) => m[d]);
    const accepted = DECISION_DATES.filter((d) => m[d]?.status === 'accepted').length;
    const time = m[DECISION_DATES[0]]?.time ?? '08:20';
    // Only on a change of state, so a later "Run now" result is not overwritten.
    this.watchers.update((ws) =>
      ws.map((w) => {
        if (w.id !== 'rate') return w;
        if (done && w.status === 'needs')
          return {
            ...w,
            status: w.enabled ? 'watching' : 'paused',
            cta: undefined,
            runs: [...w.runs.slice(0, 13), 'finding'],
            latest: accepted
              ? { when: `today ${time}`, headline: `You approved ${accepted} rates for Dubai Business Bay, 16–18 Dec`, why: 'Sent to the revenue manager as RMS tasks' }
              : { when: `today ${time}`, headline: 'You kept today’s rates for Dubai Business Bay, 16–18 Dec', why: 'Logged · nothing was sent' },
          };
        if (!done && w.status !== 'needs' && w.status !== 'running') return { ...w, status: 'needs', cta: 'Review 3 nights', runs: [...w.runs.slice(0, 13), 'pending'], latest: RATE_LATEST };
        return w;
      }),
    );
    this.activity.update((a) => {
      const rest = a.filter((x) => x.key !== 'decision');
      if (!done) return rest;
      const text = accepted ? `You approved ${accepted} rates for Dubai Business Bay · sent to the revenue manager` : 'You kept today’s rates for Dubai Business Bay, 16–18 Dec';
      return [{ key: 'decision', day: 'Today', time, text, watcher: 'rate', by: 'you' }, ...rest];
    });
  }

  /* Watchers */
  setEnabled(id: string, enabled: boolean) {
    this.watchers.update((ws) =>
      ws.map((w) =>
        w.id === id
          ? {
              ...w,
              enabled,
              status: enabled ? (w.status === 'paused' ? 'watching' : w.status) : 'paused',
              next: enabled ? (NEXT_RUN[w.id] ?? (w.next && !w.next.startsWith('paused') ? w.next : 'first run tomorrow 07:00')) : null,
            }
          : w,
      ),
    );
    const w = this.watchers().find((x) => x.id === id)!;
    this.activity.update((a) => [{ day: 'Today', time: '08:20', text: `You ${enabled ? 'resumed' : 'paused'} ${w.name}`, watcher: id, by: 'you' }, ...a]);
  }

  setAutonomy(id: string, level: 1 | 2) {
    const before = this.watchers().find((x) => x.id === id)!;
    this.watchers.update((ws) => ws.map((w) => (w.id === id ? { ...w, autonomy: level } : w)));
    const names = { 1: 'Alerts only', 2: 'Recommends · you decide' };
    this.activity.update((a) => [{ day: 'Today', time: '08:20', text: `You set ${before.name} to ${names[level]}`, watcher: id, by: 'you' }, ...a]);
    if (level < before.autonomy) {
      toast(`${before.name}: ${names[level]}`, { duration: 10000, action: { label: 'Undo', onClick: () => this.watchers.update((ws) => ws.map((w) => (w.id === id ? { ...w, autonomy: before.autonomy } : w))) } });
    }
  }

  runNow(id: string) {
    this.watchers.update((ws) => ws.map((w) => (w.id === id ? { ...w, status: 'running' } : w)));
    setTimeout(() => {
      const w = this.watchers().find((x) => x.id === id);
      if (!w) return;
      // One plausible result per watcher; a new watcher's first run finds nothing yet.
      const results: Record<string, { outcome: RunOutcome; headline: string; why: string; ask: string }> = {
        rate: { outcome: 'none', headline: 'Nothing new to recommend', why: 'Checked 20 hotels × 45 nights against their comp sets', ask: 'Which nights are priced under the market?' },
        pace: { outcome: 'finding', headline: 'Lisbon Chiado is still 17.4% behind', why: '2,231 rooms on the books vs 2,700 last year', ask: 'Why is Arbor Lisbon Chiado pacing behind last year for the next 45 nights?' },
        feeds: { outcome: 'finding', headline: 'Berlin Mitte’s POS feed is still stale', why: 'Last synced Tue 17 Nov 04:12', ask: 'Is anything wrong with the data at Tessera Berlin Mitte? What does the stale POS feed affect?' },
      };
      const r = results[id] ?? { outcome: 'none' as RunOutcome, headline: 'Nothing to flag yet', why: 'First run, started by you', ask: `What does the ${w.name} watcher check?` };
      const latest = { when: 'just now', headline: r.headline, why: r.why };
      this.watchers.update((ws) =>
        ws.map((x) =>
          x.id === id
            ? { ...x, status: x.enabled ? (x.cta ? 'needs' : 'watching') : 'paused', latest, runs: [...x.runs.slice(1), r.outcome], span: x.span === 'no runs yet' ? '1 run' : x.span }
            : x,
        ),
      );
      this.activity.update((a) => [{ day: 'Today', time: '08:20', text: `${w.name} ran on request · ${r.outcome === 'finding' ? r.headline : 'no change'}`, watcher: id }, ...a]);
      // Notify on finish, never while running (GitLab agent notification rules).
      toast(`${w.name} finished`, { description: r.headline, duration: 6000, action: { label: 'Ask why', onClick: () => this.askNew(r.ask) } });
    }, 2200);
  }

  openWatcher(id: string, section: 'top' | 'history' | 'settings' = 'top') {
    this.activeWatcherId.set(id);
    this.watcherSection.set(section);
    this.view.set('watcher');
  }

  startCreate(step: CreateStep, draft?: WatcherDraft) {
    this.creating.set({ step, draft });
  }

  /** New watchers start low (Ramp: "review-only mode by default") and have no runs yet. */
  createWatcher(d: WatcherDraft) {
    const id = `w-${this.seq++}`;
    const w: Watcher = {
      id,
      name: d.name,
      glyph: d.glyph,
      sentence: d.sentence,
      latest: { when: 'not run yet', headline: `First run ${d.firstRun}`, why: 'Nothing checked yet' },
      runs: Array<RunOutcome>(14).fill('skipped'),
      span: 'no runs yet',
      cadence: d.cadence,
      next: `first run ${d.firstRun}`,
      autonomy: d.autonomy,
      enabled: true,
      status: 'watching',
    };
    this.watchers.update((ws) => [...ws, w]);
    this.activity.update((a) => [{ day: 'Today', time: '08:20', text: `You created ${d.name}`, watcher: id, by: 'you' }, ...a]);
    this.creating.set(null);
    if (this.view() !== 'watchers') this.view.set('watchers');
    toast(`${d.name} created`, { description: `First run ${d.firstRun}`, duration: 8000, action: { label: 'Run now', onClick: () => this.runNow(id) } });
  }

  duplicateWatcher(id: string) {
    const w = this.watchers().find((x) => x.id === id);
    if (!w) return;
    const copy: Watcher = {
      ...w,
      id: `w-${this.seq++}`,
      name: `${w.name} (copy)`,
      latest: { when: 'not run yet', headline: 'Paused until you turn it on', why: `Copied from ${w.name}` },
      runs: Array<RunOutcome>(14).fill('skipped'),
      span: 'no runs yet',
      next: null,
      enabled: false,
      status: 'paused',
      cta: undefined,
    };
    this.watchers.update((ws) => [...ws, copy]);
    toast(`Duplicated ${w.name}`, { description: 'The copy is paused until you turn it on.', duration: 6000 });
  }

  deleteWatcher(id: string) {
    const before = this.watchers();
    const w = before.find((x) => x.id === id);
    if (!w) return;
    this.watchers.update((ws) => ws.filter((x) => x.id !== id));
    if (this.view() === 'watcher' && this.activeWatcherId() === id) this.view.set('watchers');
    toast(`Deleted ${w.name}`, { duration: 10000, action: { label: 'Undo', onClick: () => this.watchers.set(before) } });
  }

  /** "Pause until…" (Mercury's auto-resume date) suits seasonal watchers. */
  pauseUntil(id: string, until: string) {
    this.setEnabled(id, false);
    this.watchers.update((ws) => ws.map((w) => (w.id === id ? { ...w, next: `paused until ${until}` } : w)));
    const w = this.watchers().find((x) => x.id === id)!;
    toast(`${w.name} paused until ${until}`, { duration: 8000, action: { label: 'Undo', onClick: () => this.setEnabled(id, true) } });
  }
}
