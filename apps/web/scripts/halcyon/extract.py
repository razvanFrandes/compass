"""Builds src/app/halcyon-data.ts for the Compass prototype from the local compass_hotels database (read-only).

Every number the prototype shows comes from here: the morning brief runs the backend's own detector SQL
(apps/worker/src/application/brief-detectors.ts), and the rest are plain queries on the
views and functions the data generator ships (v_rate_position, pace_vs_stly, otb_as_of, ...).
usage: python3 -I extract.py <path/to/halcyon-data.ts>
"""
import csv
import io
import json
import pathlib
import re
import subprocess
import sys

DETECTORS = str(pathlib.Path(__file__).resolve().parents[3] / 'worker/src/application/brief-detectors.ts')


def q(sql):
    r = subprocess.run(
        ['psql', '-d', 'compass_hotels', '-X', '-q', '--csv', '-v', 'ON_ERROR_STOP=1',
         '-c', 'set default_transaction_read_only = on', '-c', 'set search_path = hotel', '-c', sql],
        capture_output=True, text=True)
    if r.returncode:
        sys.exit(f'query failed: {r.stderr.strip()}\n{sql}')
    return list(csv.DictReader(io.StringIO(r.stdout)))


def num(v):
    if v in (None, ''):
        return None
    f = float(v)
    return int(f) if f.is_integer() else f


def rows(sql):
    return [{k: (num(v) if re.fullmatch(r'-?\d+(\.\d+)?', v or '') else (v if v != '' else None)) for k, v in r.items()} for r in q(sql)]


out = {}
out['businessDate'] = q('select business_date()::text d')[0]['d']
out['hotels'] = rows('select hotel_code as code, name, city, region, currency, rooms from hotels order by name')

# ── Morning brief: the backend's detectors, ranked like the backend does (critical first, then |EUR|) ──
src = open(DETECTORS).read()
brief = []
for kind, severity, sources, basis, sql in re.findall(
        r"kind: '([a-z_]+)',\s*severity: '([a-z]+)',\s*sources: \[([^\]]*)\],\s*impact_basis:\s*'((?:[^'\\]|\\.)*)',\s*sql: `(.*?)`",
        src, flags=re.S):
    for r in rows(sql):
        brief.append({
            'id': f"{kind}:{r['hotel_code']}", 'kind': kind, 'severity': severity, 'hotel_code': r.pop('hotel_code'),
            'hotel_name': r.pop('hotel_name'), 'impact_eur': r.pop('impact_eur'),
            'impact_basis': basis.replace("\\'", "'"), 'sources': re.findall(r"'([^']+)'", sources),
            'facts': r, 'sql': '\n'.join(line[6:] if line.startswith('      ') else line for line in sql.strip('\n').split('\n')),
        })
brief.sort(key=lambda b: (b['severity'] != 'critical', -abs(b['impact_eur'] or 0)))
out['brief'] = brief

# ── Pulse: the whole portfolio, on the books for the next 30 nights vs the same time last year (EUR) ──
out['pulse'] = rows("""
  with p as (select p.*, eur_rate(h.currency, business_date()) fx from pace_vs_stly(null, 30) p join hotels h using (hotel_code)),
       i as (select date, sum(rooms_available) avail from room_inventory_daily group by 1)
  select p.stay_date::text as date, sum(rooms_otb)::int rooms, sum(rooms_otb_stly)::int rooms_stly, max(i.avail)::int avail,
         round(sum(revenue_otb * fx))::int rev, round(sum(revenue_otb_stly * fx))::int rev_stly
    from p join i on i.date = p.stay_date group by 1 order by 1""")

# ── The hotel in focus for night-level views: Tessera Dubai Business Bay (S6, Gulf Tech Week) ──
focus = rows("select hotel_code code, name, city, rooms, currency, eur_rate(currency, business_date())::float8 fx from hotels where hotel_code = 'DXB2'")[0]
out['focus'] = focus
out['focusForward'] = rows("""
  select p.stay_date::text as date, p.rooms_otb::int sold, p.rooms_otb_stly::int sold_stly, round(p.revenue_otb)::int rev, round(p.revenue_otb_stly)::int rev_stly,
         round(coalesce(r.bar_rate, rd.bar_rate))::int bar, round(r.comp_median::numeric)::int comp, coalesce(r.comps_sold_out, 0)::int comps_sold_out,
         i.rooms_available avail,
         (select string_agg(e.name, ', ') from city_events e where e.city = 'Dubai' and p.stay_date between e.start_date and e.end_date) event
    from pace_vs_stly('DXB2', 45) p
    left join v_rate_position r on r.hotel_code = 'DXB2' and r.stay_date = p.stay_date
    left join rates_daily rd on rd.hotel_code = 'DXB2' and rd.stay_date = p.stay_date
    join room_inventory_daily i on i.hotel_code = 'DXB2' and i.date = p.stay_date
   where p.stay_date > business_date() order by 1""")
out['focusPast'] = rows("""
  select d.date::text as date, d.rooms_sold::int sold, ly.rooms_sold::int sold_stly, round(d.room_revenue)::int rev, round(ly.room_revenue)::int rev_stly,
         round(rd.bar_rate)::int bar, round(r.comp_median::numeric)::int comp, coalesce(r.comps_sold_out, 0)::int comps_sold_out, d.rooms_available avail,
         (select string_agg(e.name, ', ') from city_events e where e.city = 'Dubai' and d.date between e.start_date and e.end_date) event
    from v_hotel_day d join v_hotel_day ly on ly.hotel_code = d.hotel_code and ly.date = d.date - 364
    left join rates_daily rd on rd.hotel_code = d.hotel_code and rd.stay_date = d.date
    left join v_rate_position r on r.hotel_code = d.hotel_code and r.stay_date = d.date
   where d.hotel_code = 'DXB2' and d.date between business_date() - 45 and business_date() - 1 order by 1""")
# Booking curve for Wed 16 Dec (Gulf Tech Week) and the same weekday last year, 90 days out to arrival.
out['focusPace'] = {
    'night': '2026-12-16',
    'ty': [r['otb'] for r in rows("""
      select (select coalesce(sum(rooms_on_books), 0) from otb_as_of(g::date, 'DXB2', '2026-12-16', '2026-12-16'))::int otb
        from generate_series(date '2026-12-16' - 90, business_date(), interval '1 day') g order by g""")],
    'ly': [r['otb'] for r in rows("""
      select (select coalesce(sum(rooms_on_books), 0) from otb_as_of(g::date, 'DXB2', '2025-12-17', '2025-12-17'))::int otb
        from generate_series(date '2025-12-17' - 90, date '2025-12-17', interval '1 day') g order by g""")],
    'avail': rows("select rooms_available a from room_inventory_daily where hotel_code = 'DXB2' and date = '2026-12-16'")[0]['a'],
}

# Booking curves for every forward night: rooms on the books 90 days out to arrival, this year (up to today) and
# the same weekday last year (stay date − 364 days, at the same lead time).
import datetime as _dt
_bd = _dt.date.fromisoformat(out['businessDate'])
curves = {}
for r in rows("""
  with ty as (select g::date as_of, o.stay_date, o.rooms_on_books from generate_series(date '2026-11-21' - 90, business_date(), interval '1 day') g,
                     lateral otb_as_of(g::date, 'DXB2', date '2026-11-21', date '2027-01-04') o),
       ly as (select g::date as_of, o.stay_date, o.rooms_on_books from generate_series(date '2025-11-22' - 90, date '2026-01-05', interval '1 day') g,
                     lateral otb_as_of(g::date, 'DXB2', date '2025-11-22', date '2026-01-05') o)
  select 'ty' k, (stay_date - as_of) lead, stay_date::text d, rooms_on_books::int n from ty where stay_date - as_of between 0 and 90
  union all
  select 'ly' k, (stay_date - as_of) lead, (stay_date + 364)::text d, rooms_on_books::int n from ly where stay_date - as_of between 0 and 90"""):
    c = curves.setdefault(r['d'], {'ty': [None] * 91, 'ly': [0] * 91})
    c[r['k']][90 - r['lead']] = r['n']
for d, c in curves.items():
    night = _dt.date.fromisoformat(d)
    for i in range(91):  # index i = 90 - lead; as_of = night - lead
        if c['ty'][i] is None and night - _dt.timedelta(days=90 - i) <= _bd:
            c['ty'][i] = 0
out['focusCurves'] = curves

# Competitors' latest shopped rates per forward night (null = sold out), as v_rate_position computes its median.
comp = {}
for r in rows("""
  with latest as (select cr.competitor_id, cr.stay_date, cr.rate,
                         row_number() over (partition by cr.competitor_id, cr.stay_date order by cr.shop_date desc) rn
                    from comp_rates cr where cr.stay_date > business_date() and cr.stay_date <= business_date() + 45)
  select l.stay_date::text d, c.name, round(l.rate)::int rate
    from latest l join competitors c using (competitor_id)
   where c.hotel_code = 'DXB2' and l.rn = 1 order by 1, 2"""):
    comp.setdefault(r['d'], []).append({'name': r['name'], 'rate': r['rate']})
out['focusComps'] = comp

# ── Evidence series for the brief cards ──
out['nycAccount'] = rows("""
  select to_char(m, 'YYYY-MM') as month,
         (select count(*) from reservation_nights n join reservations r using (reservation_id) join accounts a using (account_id)
           where a.name = 'Vantor Consulting' and n.hotel_code = 'NYC' and r.status <> 'cancelled'
             and n.stay_date >= m and n.stay_date < m + interval '1 month' and n.stay_date < business_date())::int nights
    from generate_series(date '2025-08-01', date_trunc('month', business_date()), interval '1 month') m order by m""")
out['amsConversion'] = rows("""
  select to_char(date_trunc('week', date), 'YYYY-MM-DD') week,
         round(100.0 * sum(bookings) filter (where device = 'mobile') / sum(sessions) filter (where device = 'mobile'), 2)::float8 mobile,
         round(100.0 * sum(bookings) filter (where device = 'desktop') / sum(sessions) filter (where device = 'desktop'), 2)::float8 desktop
    from web_daily where hotel_code = 'AMS' and date >= date_trunc('week', business_date()) - interval '13 weeks' and date < date_trunc('week', business_date())
   group by 1 order by 1""")
out['amsBookingShare'] = rows("""
  select round(100.0 * avg((channel = 'BDC')::int) filter (where created_at::date < business_date() - 30), 1)::float8 before,
         round(100.0 * avg((channel = 'BDC')::int) filter (where created_at::date >= business_date() - 30), 1)::float8 after
    from reservations where hotel_code = 'AMS' and segment in ('RET', 'ADV', 'PKG') and created_at::date >= business_date() - 90""")[0]
out['bcnOutOfOrder'] = rows("""
  select to_char(date_trunc('week', date), 'YYYY-MM-DD') week, round(avg(out_of_order), 1)::float8 rooms_out, max(physical_rooms)::int physical
    from room_inventory_daily where hotel_code = 'BCN' and date between business_date() - 84 and business_date() + 41 group by 1 order by 1""")
out['dpsKitchen'] = rows("""
  select to_char(date_trunc('week', date), 'YYYY-MM-DD') week, round(100.0 * sum(actual_hours) / sum(required_hours), 1)::float8 pct
    from labor_daily where hotel_code = 'DPS' and department = 'Kitchen' and date >= business_date() - 112 and date < business_date() group by 1 order by 1""")
out['lisPace'] = rows("""
  select p.stay_date::text as date, p.rooms_otb::int rooms, p.rooms_otb_stly::int rooms_stly, round(r.bar_vs_comp, 2)::float8 bar_vs_comp
    from pace_vs_stly('LIS', 45) p left join v_rate_position r on r.hotel_code = 'LIS' and r.stay_date = p.stay_date
   where p.stay_date > business_date() order by 1""")
# GOP actual vs budget by month for any hotel the GOP detector flags (finance, pnl_monthly, EUR).
out['gopMonthly'] = {b['hotel_code']: rows(f"""
  with m as (select max(month) as month from pnl_monthly where scenario = 'actual')
  select to_char(p.month, 'YYYY-MM') as month,
         round(sum(p.amount * eur_rate(p.currency, p.month)) filter (where p.scenario = 'actual' and p.line = 'GOP'))::int gop,
         round(sum(p.amount * eur_rate(p.currency, p.month)) filter (where p.scenario = 'budget' and p.line = 'GOP'))::int gop_budget
    from pnl_monthly p, m
   where p.hotel_code = '{b['hotel_code']}' and p.month > m.month - interval '12 months' and p.month <= m.month
   group by 1 order by 1""") for b in brief if b['kind'] == 'gop_miss'}
out['berFeeds'] = rows("""
  select system, vendor, status, to_char(last_sync_at, 'Dy DD Mon HH24:MI') last_sync from data_sources where hotel_code = 'BER' order by status desc, system""")

ts = ['// Generated from the local compass_hotels database (Halcyon Hospitality Group) by apps/web/scripts/halcyon/extract.py.',
      '// Read-only queries; the brief uses the backend\'s detector SQL verbatim. Do not edit by hand: re-run the script.',
      '/* eslint-disable */']
for k, v in out.items():
    ts.append(f'export const {re.sub(r"(?<!^)(?=[A-Z])", "_", k).upper()} = {json.dumps(v, ensure_ascii=False, separators=(',', ':'))} as const;')
open(sys.argv[1], 'w').write('\n'.join(ts) + '\n')
print('brief', [(b['id'], b['impact_eur']) for b in brief])
print('focus forward', len(out['focusForward']), 'past', len(out['focusPast']), 'pace', len(out['focusPace']['ty']), len(out['focusPace']['ly']))
