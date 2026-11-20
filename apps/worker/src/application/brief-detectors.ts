import type { BriefItem } from '@compass/contracts';
import type { Db } from './ports.ts';

/**
 * The morning brief detectors: fixed SQL over the whole portfolio, each priced in EUR so the brief can rank what
 * matters by money ("money, not percentages"). No model is involved here; it only explains the results afterwards.
 * Thresholds are tuned to flag real problems and stay quiet otherwise.
 */

interface Row {
  hotel_code: string;
  hotel_name: string;
  impact_eur: number | null;
  [fact: string]: string | number | null;
}

interface Detector {
  kind: BriefItem['kind'];
  severity: BriefItem['severity'];
  sources: string[];
  impact_basis: string;
  sql: string;
  /** Extra id part when one hotel can have several items of the kind. */
  detail?: (row: Row) => string;
  title: (row: Row) => string;
  question: (row: Row) => string;
}

const eur = (n: number | null) =>
  n === null ? '' : `€${Math.abs(n) >= 1_000_000 ? `${(Math.abs(n) / 1e6).toFixed(2)}M` : `${Math.round(Math.abs(n) / 1000)}k`}`;

export const DETECTORS: Detector[] = [
  {
    kind: 'data_stale',
    severity: 'critical',
    sources: ['hotel.data_sources'],
    impact_basis: 'not priced: figures from this source are incomplete until it syncs again',
    sql: `
      select d.hotel_code, h.name as hotel_name, null::float8 as impact_eur, d.system, d.vendor, d.status,
             to_char(d.last_sync_at, 'YYYY-MM-DD HH24:MI') as last_sync_at,
             (hotel.business_date() - d.last_sync_at::date) as days_behind
        from hotel.data_sources d join hotel.hotels h using (hotel_code)
       where d.status <> 'ok'`,
    detail: (r) => String(r['system']),
    title: (r) => `${r.hotel_name}: ${r['system']} feed (${r['vendor']}) has not synced for ${r['days_behind']} days`,
    question: (r) => `Is anything wrong with the data at ${r.hotel_name}? What does the stale ${r['system']} feed affect?`,
  },
  {
    kind: 'pace_behind',
    severity: 'warning',
    sources: ['hotel.pace_vs_stly()'],
    impact_basis: 'room revenue on the books vs the same point last year, next 45 nights',
    sql: `
      select p.hotel_code, h.name as hotel_name,
             round(sum(p.revenue_otb - p.revenue_otb_stly) * hotel.eur_rate(h.currency, hotel.business_date()))::float8 as impact_eur,
             round(100.0 * (sum(p.rooms_otb) - sum(p.rooms_otb_stly)) / nullif(sum(p.rooms_otb_stly), 0), 1)::float8 as pace_pct,
             sum(p.rooms_otb)::int as rooms_otb, sum(p.rooms_otb_stly)::int as rooms_otb_stly
        from hotel.pace_vs_stly(null, 45) p join hotel.hotels h using (hotel_code)
       group by p.hotel_code, h.name, h.currency
      having 100.0 * (sum(p.rooms_otb) - sum(p.rooms_otb_stly)) / nullif(sum(p.rooms_otb_stly), 0) <= -10`,
    title: (r) => `${r.hotel_name} is ${Math.abs(Number(r['pace_pct']))}% behind last year for the next 45 nights`,
    question: (r) => `Why is ${r.hotel_name} pacing behind last year for the next 45 nights?`,
  },
  {
    kind: 'underpriced_demand',
    severity: 'warning',
    sources: ['hotel.v_rate_position', 'hotel.otb_as_of()', 'hotel.room_inventory_daily'],
    impact_basis: 'gap to the comp set median × rooms already sold on those nights: revenue already left on the table at today\'s rate. Booked rooms cannot be repriced; the rooms still unsold can.',
    sql: `
      with bd as (select hotel.business_date() as d),
      otb as (select o.* from bd, hotel.otb_as_of(bd.d, null, bd.d, bd.d + 45) o)
      select r.hotel_code, h.name as hotel_name,
             round(sum((r.comp_median - r.bar_rate) * coalesce(o.rooms_on_books, 0) * hotel.eur_rate(h.currency, r.stay_date)))::float8 as impact_eur,
             count(*)::int as nights, to_char(min(r.stay_date), 'YYYY-MM-DD') as first_night, to_char(max(r.stay_date), 'YYYY-MM-DD') as last_night,
             round(avg(r.bar_vs_comp), 2)::float8 as avg_bar_vs_comp, max(r.comps_sold_out)::int as most_comps_sold_out_on_one_night
        from bd, hotel.v_rate_position r
        join hotel.hotels h using (hotel_code)
        join hotel.room_inventory_daily i on i.hotel_code = r.hotel_code and i.date = r.stay_date
        left join otb o on o.hotel_code = r.hotel_code and o.stay_date = r.stay_date
       where r.stay_date between bd.d and bd.d + 45 and r.bar_vs_comp < 0.85
         and (r.comps_sold_out >= 2 or coalesce(o.rooms_on_books, 0) > 0.7 * i.rooms_available)
       group by r.hotel_code, h.name
      having count(*) >= 2`,
    title: (r) => `${r.hotel_name} sells ${r['nights']} high-demand nights at ${r['avg_bar_vs_comp']}× the comp set (${r['first_night']} to ${r['last_night']})`,
    question: (r) => `How is ${r.hotel_name} priced for ${r['first_night']} to ${r['last_night']} against its comp set?`,
  },
  {
    kind: 'account_loss',
    severity: 'warning',
    sources: ['hotel.reservation_nights', 'hotel.reservations', 'hotel.accounts'],
    impact_basis: 'room revenue in the last 6 months vs the 6 months before',
    sql: `
      with bd as (select hotel.business_date() as d),
      x as (
        select n.hotel_code, a.name as account, a.account_type,
               count(*) filter (where n.stay_date >= bd.d - 182) as cur, count(*) filter (where n.stay_date < bd.d - 182) as prev,
               sum(n.room_revenue) filter (where n.stay_date >= bd.d - 182) as rcur,
               sum(n.room_revenue) filter (where n.stay_date < bd.d - 182) as rprev,
               max(n.stay_date) as last_stay
          from bd, hotel.reservation_nights n
          join hotel.reservations r using (reservation_id)
          join hotel.accounts a using (account_id)
         where n.stay_date between bd.d - 364 and bd.d - 1 and a.account_type in ('corporate', 'wholesaler')
         group by 1, 2, 3)
      select x.hotel_code, h.name as hotel_name,
             round((coalesce(x.rcur, 0) - x.rprev) * hotel.eur_rate(h.currency, (select d from bd)))::float8 as impact_eur,
             x.account, x.account_type, x.cur::int as room_nights_last_6m, x.prev::int as room_nights_previous_6m,
             to_char(x.last_stay, 'YYYY-MM-DD') as last_stay
        from x join hotel.hotels h using (hotel_code)
       where x.prev >= 500 and x.cur < 0.5 * x.prev`,
    detail: (r) => String(r['account']),
    title: (r) => `${r.hotel_name} lost most of ${r['account']}: ${r['room_nights_last_6m']} room nights in 6 months vs ${r['room_nights_previous_6m']} before`,
    question: (r) => `What happened with ${r['account']} at ${r.hotel_name}, and what did it cost?`,
  },
  {
    kind: 'web_conversion_drop',
    severity: 'warning',
    sources: ['hotel.web_daily'],
    impact_basis: 'direct bookings lost in the last 30 days at the earlier conversion rate × average booking value',
    sql: `
      with bd as (select hotel.business_date() as d),
      w as (
        select hotel_code, device,
               sum(sessions) filter (where date >= bd.d - 30) as s1, sum(bookings) filter (where date >= bd.d - 30) as b1,
               sum(sessions) filter (where date < bd.d - 30) as s0, sum(bookings) filter (where date < bd.d - 30) as b0,
               sum(booking_revenue) filter (where date < bd.d - 30) / nullif(sum(bookings) filter (where date < bd.d - 30), 0) as abv,
               max(currency) as currency
          from bd, hotel.web_daily where date between bd.d - 90 and bd.d - 1 group by 1, 2)
      select w.hotel_code, h.name as hotel_name,
             -round(((w.b0::numeric / w.s0) - (w.b1::numeric / w.s1)) * w.s1 * w.abv * hotel.eur_rate(w.currency, (select d from bd)))::float8 as impact_eur,
             w.device, round(100.0 * w.b1 / w.s1, 2)::float8 as conversion_pct_last_30d,
             round(100.0 * w.b0 / w.s0, 2)::float8 as conversion_pct_previous_60d
        from w join hotel.hotels h using (hotel_code)
       where w.s1 > 1000 and (w.b1::numeric / w.s1) < 0.7 * (w.b0::numeric / w.s0)`,
    detail: (r) => String(r['device']),
    title: (r) => `${r.hotel_name}: ${r['device']} website conversion fell to ${r['conversion_pct_last_30d']}% from ${r['conversion_pct_previous_60d']}%`,
    question: (r) => `Why did ${r['device']} conversion on the ${r.hotel_name} website drop, and where did those bookings go?`,
  },
  {
    kind: 'staffing_gap',
    severity: 'warning',
    sources: ['hotel.labor_daily', 'hotel.fnb_daily'],
    impact_basis: 'F&B revenue in the last 30 days vs the 30 days before',
    sql: `
      with bd as (select hotel.business_date() as d),
      gap as (
        select l.hotel_code, l.department, round(100.0 * sum(l.actual_hours) / sum(l.required_hours), 1) as staffing_pct
          from bd, hotel.labor_daily l where l.date between bd.d - 30 and bd.d - 1
         group by 1, 2 having sum(l.actual_hours) < 0.85 * sum(l.required_hours)),
      fnb as (
        select f.hotel_code,
               sum((f.food_revenue + f.beverage_revenue) * hotel.eur_rate(f.currency, f.date)) filter (where f.date >= bd.d - 30) as cur,
               sum((f.food_revenue + f.beverage_revenue) * hotel.eur_rate(f.currency, f.date)) filter (where f.date < bd.d - 30) as prev
          from bd, hotel.fnb_daily f where f.date between bd.d - 60 and bd.d - 1 group by 1)
      select g.hotel_code, h.name as hotel_name,
             case when g.department in ('Kitchen', 'F&B Service') then round(fnb.cur - fnb.prev)::float8 end as impact_eur,
             g.department, g.staffing_pct::float8 as staffing_pct
        from gap g join hotel.hotels h using (hotel_code) left join fnb using (hotel_code)`,
    detail: (r) => String(r['department']),
    title: (r) => `${r.hotel_name}: ${r['department']} worked ${r['staffing_pct']}% of the hours its workload needed in the last 30 days`,
    question: (r) => `What is the ${r['department']} staffing gap at ${r.hotel_name} doing to guests and revenue?`,
  },
  {
    kind: 'rooms_out_of_order',
    severity: 'warning',
    sources: ['hotel.room_inventory_daily', 'hotel.v_hotel_day'],
    impact_basis: 'out-of-order room nights in the next 30 days × last 30 days occupancy × ADR',
    sql: `
      with bd as (select hotel.business_date() as d),
      last30 as (
        select hotel_code, sum(rooms_sold)::numeric / sum(rooms_available) as occ, sum(room_revenue_eur) / nullif(sum(rooms_sold), 0) as adr
          from bd, hotel.v_hotel_day where date between bd.d - 30 and bd.d - 1 group by 1)
      select i.hotel_code, h.name as hotel_name, -round(sum(i.out_of_order) * l.occ * l.adr)::float8 as impact_eur,
             sum(i.out_of_order)::int as out_of_order_nights, round(avg(i.out_of_order), 1)::float8 as avg_rooms_out,
             max(i.physical_rooms)::int as physical_rooms
        from bd, hotel.room_inventory_daily i join hotel.hotels h using (hotel_code) join last30 l using (hotel_code)
       where i.date between bd.d and bd.d + 30
       group by i.hotel_code, h.name, l.occ, l.adr
      having avg(i.out_of_order) > 0.05 * max(i.physical_rooms)`,
    title: (r) => `${r.hotel_name} has ${r['avg_rooms_out']} of ${r['physical_rooms']} rooms out of order on average for the next 30 days`,
    question: (r) => `Why does ${r.hotel_name} have rooms out of order, and what are guests saying?`,
  },
];

const MAX_ITEMS = 10;
const MIN_IMPACT_EUR = 25_000;

export async function detectBriefItems(db: Db): Promise<BriefItem[]> {
  const found = await Promise.all(
    DETECTORS.map(async (detector) => {
      const rows = await db.query<Row>(detector.sql);
      return rows.map((row): BriefItem => {
        const { hotel_code, hotel_name, impact_eur, ...facts } = row;
        const impact = impact_eur === null ? null : Number(impact_eur);
        return {
          id: [detector.kind, hotel_code, detector.detail?.(row)].filter(Boolean).join(':'),
          kind: detector.kind,
          hotel_code,
          hotel_name,
          severity: detector.severity,
          impact_eur: impact,
          impact_basis: detector.impact_basis,
          title: `${detector.title(row)}${impact === null ? '' : ` (${eur(impact)})`}`,
          facts: Object.fromEntries(Object.entries(facts).filter(([, v]) => v !== null)) as Record<string, string | number>,
          question: detector.question(row),
          sources: detector.sources,
        };
      });
    }),
  );
  const items = found.flat().filter((i) => i.severity === 'critical' || Math.abs(i.impact_eur ?? 0) >= MIN_IMPACT_EUR);
  const critical = items.filter((i) => i.severity === 'critical');
  const ranked = items
    .filter((i) => i.severity !== 'critical')
    .sort((a, b) => Math.abs(b.impact_eur ?? 0) - Math.abs(a.impact_eur ?? 0));
  return [...critical, ...ranked].slice(0, MAX_ITEMS);
}
