"""Builds src/app/portfolio-data.ts: the portfolio cube behind the filter bar and the chart catalogue.

Read-only SQL on compass_hotels. Everything the Portfolio board shows is computed in the browser from these
rows by deterministic code (the model never computes a number). The SQL of each block is exported too,
so every chart's "How this was computed" shows the query it came from.
usage: python3 -I extract_portfolio.py <path/to/portfolio-data.ts>
"""
import csv, io, json, re, subprocess, sys


def q(sql):
    r = subprocess.run(['psql', '-d', 'compass_hotels', '-X', '-q', '--csv', '-v', 'ON_ERROR_STOP=1',
                        '-c', 'set default_transaction_read_only = on', '-c', 'set search_path = hotel', '-c', sql],
                       capture_output=True, text=True)
    if r.returncode:
        sys.exit(f'query failed: {r.stderr.strip()}\n{sql}')
    return list(csv.DictReader(io.StringIO(r.stdout)))


def num(v):
    if v in (None, ''):
        return None
    f = float(v)
    return int(f) if f.is_integer() else round(f, 2)


SQL = {}
SQL['nights'] = """-- one row per hotel and stay night, EUR at today's rate
with bd as (select business_date() d),
fwd as (
  select p.hotel_code, p.stay_date, i.rooms_available avail, p.rooms_otb rooms, p.rooms_otb_stly cmp_rooms,
         p.revenue_otb * eur_rate(h.currency, bd.d) rev, p.revenue_otb_stly * eur_rate(h.currency, bd.d) cmp_rev,
         f.rooms_p10 p10, f.rooms_p50 p50, f.rooms_p90 p90, f.room_revenue_p50 * eur_rate(h.currency, bd.d) fc_rev,
         lyd.rooms_on_books lyd_rooms, lyd.revenue_on_books * eur_rate(h.currency, bd.d) lyd_rev
    from bd, pace_vs_stly(null, 90) p
    join hotels h using (hotel_code)
    join room_inventory_daily i on i.hotel_code = p.hotel_code and i.date = p.stay_date
    left join forecasts f on f.hotel_code = p.hotel_code and f.stay_date = p.stay_date and f.forecast_date = business_date()
    -- same date last year (365 days), on the books at the same lead time
    left join otb_as_of((select d from bd) - 365, null, (select d from bd) + 1 - 365, (select d from bd) + 90 - 365) lyd
           on lyd.hotel_code = p.hotel_code and lyd.stay_date = p.stay_date - 365
   where p.stay_date > bd.d),
past as (
  select d.hotel_code, d.date stay_date, d.rooms_available avail, d.rooms_sold rooms, ly.rooms_sold cmp_rooms,
         d.room_revenue_eur rev, ly.room_revenue_eur cmp_rev, null::int p10, null::int p50, null::int p90, null::numeric fc_rev,
         lyd.rooms_sold lyd_rooms, lyd.room_revenue_eur lyd_rev
    from bd, v_hotel_day d
    join v_hotel_day ly on ly.hotel_code = d.hotel_code and ly.date = d.date - 364    -- same weekday last year
    join v_hotel_day lyd on lyd.hotel_code = d.hotel_code and lyd.date = d.date - 365  -- same date last year
   where d.date between bd.d - 90 and bd.d - 1)
select x.*, b.rooms_sold::numeric / extract(day from (date_trunc('month', x.stay_date) + interval '1 month - 1 day')) bud_rooms,
       b.room_revenue * eur_rate(b.currency, (select d from bd)) / extract(day from (date_trunc('month', x.stay_date) + interval '1 month - 1 day')) bud_rev
  from (select * from fwd union all select * from past) x
  left join budgets b on b.hotel_code = x.hotel_code and b.month = date_trunc('month', x.stay_date)
 order by x.hotel_code, x.stay_date"""

EOM = "(date_trunc('month', bd.d) + interval '1 month - 1 day')::date"
WINDOWS = {'next7': ('bd.d + 1', 'bd.d + 7'), 'next30': ('bd.d + 1', 'bd.d + 30'), 'next90': ('bd.d + 1', 'bd.d + 90'),
           'rest_month': ('bd.d + 1', EOM),
           'next_month': ("(date_trunc('month', bd.d) + interval '1 month')::date", "(date_trunc('month', bd.d) + interval '2 month - 1 day')::date"),
           'yesterday': ('bd.d - 1', 'bd.d - 1'), 'last7': ('bd.d - 7', 'bd.d - 1'), 'last30': ('bd.d - 30', 'bd.d - 1'),
           'mtd': ("date_trunc('month', bd.d)::date", 'bd.d - 1'),
           'last_month': ("(date_trunc('month', bd.d) - interval '1 month')::date", "(date_trunc('month', bd.d) - interval '1 day')::date")}
FUTURE = {'next7', 'next30', 'next90', 'rest_month', 'next_month'}
SQL['mix'] = """-- room nights, revenue and commission by segment and channel for one window of stay nights
with bd as (select business_date() d)
select n.hotel_code, r.segment, r.channel, count(*) room_nights,
       sum(n.room_revenue * eur_rate(r.currency, bd.d)) rev,
       sum(n.room_revenue * eur_rate(r.currency, bd.d) * c.commission_pct / 100) commission
  from bd, reservation_nights n join reservations r using (reservation_id) join channels c on c.channel = r.channel
 where n.stay_date between {lo} and {hi}
   and r.status not in ('cancelled', 'no_show')
   and r.created_at::date <= bd.d          -- on the books as of today
 group by 1, 2, 3"""
SQL['mix_cmp'] = """-- the comparison for the mix: same weekday last year (364 days); for future nights on the books as of the same day last year
with bd as (select business_date() d)
select r.hotel_code, r.segment, r.channel, count(*) room_nights,
       sum(r.avg_daily_rate * eur_rate(r.currency, bd.d)) rev,
       sum(r.avg_daily_rate * eur_rate(r.currency, bd.d) * c.commission_pct / 100) commission
  from bd, reservations r join channels c on c.channel = r.channel
  cross join generate_series(r.arrival_date, r.departure_date - 1, interval '1 day') n
 where n::date between {lo} - 364 and {hi} - 364
   and {as_of}
 group by 1, 2, 3"""
SQL['pace'] = """-- pace: room nights on the books for the window, as of each day (same rule as otb_as_of()), as +1/-1 events
with bd as (select business_date() d),
rn as (select r.hotel_code, r.created_at::date c, r.cancelled_at::date x
         from bd, reservations r cross join generate_series(r.arrival_date, r.departure_date - 1, interval '1 day') n
        where n::date between {lo} - {shift} and {hi} - {shift})
select hotel_code, greatest(c, {lo} - {shift} - 60) d, count(*) n from bd, rn group by 1, 2
union all
select hotel_code, greatest(x, {lo} - {shift} - 60), -count(*) from bd, rn where x is not null group by 1, 2"""
SQL['pickup'] = """-- pickup by stay night: room nights booked and cancelled in the last {k} days; last year shifted 364 days
with bd as (select business_date() d),
rn as (select r.hotel_code, n::date + {shift} stay, r.created_at::date c, r.cancelled_at::date x
         from bd, reservations r cross join generate_series(r.arrival_date, r.departure_date - 1, interval '1 day') n
        where n::date between bd.d + 1 - {shift} and bd.d + 90 - {shift})
select hotel_code, stay::text, count(*) filter (where c between bd.d - {shift} - {k} + 1 and bd.d - {shift}) booked,
       count(*) filter (where x between bd.d - {shift} - {k} + 1 and bd.d - {shift}) cancelled
  from bd, rn group by 1, 2"""
SQL['index'] = """-- MPI, ARI and RGI against the comp set benchmark for one window of past nights
with bd as (select business_date() d),
own as (select hotel_code, sum(rooms_sold)::numeric rs, sum(rooms_available) ra, sum(room_revenue) rev
          from bd, v_hotel_day where date between {lo} and {hi} group by 1),
cs as (select hotel_code, sum(rooms_sold)::numeric rs, sum(rooms_available) ra, sum(room_revenue) rev
         from bd, comp_set_daily where date between {lo} and {hi} group by 1)
select o.hotel_code,
       round(100 * (o.rs / o.ra) / (c.rs / c.ra), 1) mpi,
       round(100 * (o.rev / o.rs) / (c.rev / c.rs), 1) ari,
       round(100 * (o.rev / o.ra) / (c.rev / c.ra), 1) rgi
  from own o join cs c using (hotel_code)"""
SQL['pnl'] = """-- the last closed month of the P&L, actual and budget, EUR
with m as (select max(month) as month from pnl_monthly where scenario = 'actual')
select p.hotel_code, p.line, p.scenario, sum(p.amount * eur_rate(p.currency, p.month)) amount
  from pnl_monthly p, m where p.month = m.month and p.scenario in ('actual', 'budget')
 group by 1, 2, 3"""

out = {'businessDate': q('select business_date()::text d')[0]['d'],
       'closedMonth': q("select to_char(max(month), 'YYYY-MM') m from pnl_monthly where scenario = 'actual'")[0]['m']}
out['hotels'] = [{k: num(v) if k == 'rooms' else v for k, v in r.items()} for r in q(
    "select hotel_code code, name, regexp_replace(name, '^(Arbor|Lumen|Tessera|Kestrel) ', '') short, city, region, brand_code brand, rooms from hotels order by region, name")]

rows = q(SQL['nights'])
dates = sorted({r['stay_date'] for r in rows})
idx = {d: i for i, d in enumerate(dates)}
cols = ['avail', 'rooms', 'cmp_rooms', 'rev', 'cmp_rev', 'p10', 'p50', 'p90', 'fc_rev', 'bud_rooms', 'bud_rev', 'lyd_rooms', 'lyd_rev']
cube = {}
for r in rows:
    h = cube.setdefault(r['hotel_code'], {c: [None] * len(dates) for c in cols})
    for c in cols:
        v = num(r[c])
        h[c][idx[r['stay_date']]] = None if v is None else (round(v) if c in ('rev', 'cmp_rev', 'fc_rev', 'bud_rev', 'lyd_rev') else round(v, 1) if c == 'bud_rooms' else v)
out['dates'] = dates
out['nights'] = cube

mix = {}
for w, (lo, hi) in WINDOWS.items():
    for r in q(SQL['mix'].format(lo=lo, hi=hi)):
        mix.setdefault(w, []).append([r['hotel_code'], r['segment'], r['channel'], int(r['room_nights']), round(float(r['rev'])), round(float(r['commission']))])
out['mix'] = mix
out['segments'] = q('select segment code, name from segments')
out['channels'] = [{**r, 'commission_pct': num(r['commission_pct'])} for r in q('select channel code, name, channel_type type, commission_pct from channels')]

STLY_AS_OF = "r.created_at::date <= bd.d - 364 and (r.cancelled_at is null or r.cancelled_at::date > bd.d - 364)"
LY_FINAL = "r.status not in ('cancelled', 'no_show')"
mix_cmp = {}
for w, (lo, hi) in WINDOWS.items():
    for r in q(SQL['mix_cmp'].format(lo=lo, hi=hi, as_of=STLY_AS_OF if w in FUTURE else LY_FINAL)):
        mix_cmp.setdefault(w, []).append([r['hotel_code'], r['segment'], r['channel'], int(r['room_nights']), round(float(r['rev'])), round(float(r['commission']))])
out['mix_cmp'] = mix_cmp

import datetime as dt
BD = dt.date.fromisoformat(out['businessDate'])
def window_dates(w):
    r = q(f"select ({WINDOWS[w][0]})::text lo, ({WINDOWS[w][1]})::text hi from (select business_date() d) bd")[0]
    return dt.date.fromisoformat(r['lo']), dt.date.fromisoformat(r['hi'])
pace = {}
for w in WINDOWS:
    lo, hi = window_dates(w)
    first = lo - dt.timedelta(days=60)
    entry = {'first': first.isoformat(), 'ty': {}, 'ly': {}}
    for key, shift, last in (('ty', 0, min(hi, BD)), ('ly', 364, hi)):
        ev = {}
        for r in q(SQL['pace'].format(lo=WINDOWS[w][0], hi=WINDOWS[w][1], shift=shift)):
            ev.setdefault(r['hotel_code'], {}).setdefault(dt.date.fromisoformat(r['d']) + dt.timedelta(days=shift), 0)
            ev[r['hotel_code']][dt.date.fromisoformat(r['d']) + dt.timedelta(days=shift)] += int(r['n'])
        for h, e in ev.items():
            run, arr, d = 0, [], first
            while d <= last:
                run += e.get(d, 0)
                arr.append(run)
                d += dt.timedelta(days=1)
            entry[key][h] = arr
    pace[w] = entry
out['pace'] = pace

pickup = {}
for k in (1, 7, 30):
    for key, shift in (('ty', 0), ('ly', 364)):
        for r in q(SQL['pickup'].format(k=k, shift=shift)):
            h = pickup.setdefault(str(k), {}).setdefault(key, {}).setdefault(r['hotel_code'], [[0] * 90, [0] * 90])
            i = (dt.date.fromisoformat(r['stay']) - BD).days - 1
            if 0 <= i < 90:
                h[0][i], h[1][i] = int(r['booked']), int(r['cancelled'])
out['pickup'] = pickup
out['events'] = q("select city, name, start_date::text start, end_date::text end from city_events where end_date >= business_date() - 90 and start_date <= business_date() + 90 order by start_date")

out['index'] = {w: {r['hotel_code']: {k: num(r[k]) for k in ('mpi', 'ari', 'rgi')} for r in q(SQL['index'].format(lo=lo, hi=hi))}
                for w, (lo, hi) in WINDOWS.items() if w not in FUTURE}
pnl = {}
for r in q(SQL['pnl']):
    pnl.setdefault(r['hotel_code'], {}).setdefault(r['line'], {})[r['scenario']] = round(float(r['amount']))
out['pnl'] = pnl
out['sql'] = SQL

ts = ['// Generated from compass_hotels by apps/web/scripts/halcyon/extract_portfolio.py (read-only SQL). Do not edit by hand.']
for k, v in out.items():
    ts.append(f'export const PF_{re.sub(r"(?<!^)(?=[A-Z])", "_", k).upper()} = {json.dumps(v, ensure_ascii=False, separators=(",", ":"))} as const;')
open(sys.argv[1], 'w').write('\n'.join(ts) + '\n')
print('size', sum(len(x) for x in ts), 'dates', len(dates), dates[0], dates[-1], 'hotels', len(cube), 'mix rows', {k: len(v) for k, v in mix.items()}, 'pnl', len(pnl))
