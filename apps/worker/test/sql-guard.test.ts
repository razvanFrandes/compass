import { describe, expect, it } from 'vitest';
import { guardReadOnlySql } from '../src/domain/sql-guard.ts';

describe('guardReadOnlySql', () => {
  it('accepts a single SELECT and wraps it with a row cap', () => {
    const result = guardReadOnlySql('select hotel_code, rooms from hotels', { maxRows: 200 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain('select hotel_code, rooms from hotels');
  });

  it('accepts WITH … SELECT and a trailing semicolon', () => {
    const result = guardReadOnlySql('with x as (select 1 as a) select a from x;', { maxRows: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain('with x as (select 1 as a) select a from x\n) as q');
  });

  it.each([
    ['insert into settings values (1, 2)', 'not_select'],
    ['update hotels set rooms = 0', 'not_select'],
    ['select 1; drop table hotels', 'multiple_statements'],
    ['with d as (delete from hotels returning *) select * from d', 'forbidden_keyword'],
    ['select set_config(\'default_transaction_read_only\', \'off\', false)', 'forbidden_keyword'],
    ['select pg_sleep(10)', 'forbidden_keyword'],
    ['select * from pg_catalog.pg_authid', 'forbidden_keyword'],
    ['', 'empty'],
    ['-- only a comment', 'empty'],
  ])('rejects %s', (sql, reason) => {
    const result = guardReadOnlySql(sql, { maxRows: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe(reason);
  });

  it('does not let a comment hide a second statement', () => {
    const result = guardReadOnlySql('select 1 /* ; */ ; delete from hotels', { maxRows: 10 });
    expect(result.ok).toBe(false);
  });

  it('ignores keywords and semicolons inside string literals', () => {
    const result = guardReadOnlySql("select * from reviews where negative_text ilike '%update; delete%'", { maxRows: 5 });
    expect(result.ok).toBe(true);
  });

  it('rejects an unterminated string literal', () => {
    const result = guardReadOnlySql("select 'abc", { maxRows: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('unterminated');
  });
});

describe('guardReadOnlySql: bypass attempts', () => {
  const rejected = (sql: string) => {
    const result = guardReadOnlySql(sql, { maxRows: 10 });
    return !result.ok;
  };

  it.each([
    ['a quoted function name', 'select "pg_sleep"(10)'],
    ['a quoted schema name', 'select * from "pg_catalog"."pg_authid"'],
    ['a unicode-escaped identifier', 'select U&"\\0070g_sleep"(10)'],
    ['a nested block comment that hides code', "select 1 /* /* */ ' */ , pg_sleep(10) --'"],
    ['an escape string with a backslash quote', "select E'\\'' , pg_sleep(10) -- '"],
    ['a line comment ended by a carriage return', 'select 1 --\r, pg_sleep(10)'],
    ['pg_sleep_for (a prefix match)', "select pg_sleep_for('10 seconds')"],
    ['advisory locks that outlive the query', 'select pg_advisory_lock(1)'],
    ['catalog tables without a schema', 'select datname from pg_database'],
    ['SQL run from a string by query_to_xml', "select query_to_xml('select 1', true, false, '')"],
    ['a whole-database XML dump', "select database_to_xml(true, false, '')"],
    ['SQL run from a string by ts_stat', "select * from ts_stat('select to_tsvector(name) from hotel.hotels')"],
    ['large objects', 'select lo_get(1)'],
    ['dblink', "select * from dblink('host=evil', 'select 1') as t(a int)"],
    ['FOR UPDATE', 'select * from hotel.hotels for update'],
    ['FOR SHARE', 'select * from hotel.hotels for share'],
    ['FOR NO KEY UPDATE', 'select * from hotel.hotels for no key update'],
    ['FOR KEY SHARE', 'select * from hotel.hotels for key share'],
    ['SELECT INTO (creates a table)', 'select * into stolen from hotel.hotels'],
    ['server settings', "select current_setting('data_directory')"],
    ['server address', 'select inet_server_addr()'],
    ['sequences', "select nextval('hotel.some_seq')"],
    ['a parenthesis that closes the row-cap wrapper', 'select 1) as q, generate_series(1, 1000000000) as g --'],
    ['an unbalanced opening parenthesis', 'select (1'],
    ['an unterminated nested comment', 'select 1 /* /* */'],
  ])('rejects %s', (_label, sql) => {
    expect(rejected(sql)).toBe(true);
  });

  it('keeps a trailing line comment from swallowing the row cap', () => {
    const result = guardReadOnlySql('select hotel_code from hotel.hotels -- all of them', { maxRows: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatch(/\n\) as q\b[\s\S]*limit 10$/);
  });

  it('caps the size of each result row', () => {
    const result = guardReadOnlySql("select repeat('x', 100000000) as huge", { maxRows: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain('pg_column_size(q.*)');
  });
});

describe('guardReadOnlySql: valid analytic SQL still passes', () => {
  it.each([
    ['a CTE with a window function', `with d as (
        select hotel_code, stay_date, rooms_sold, sum(rooms_sold) over (partition by hotel_code order by stay_date
          rows between 6 preceding and current row) as rolling_7
          from hotel.v_hotel_day)
      select * from d where stay_date >= hotel.business_date() - 30 order by hotel_code, stay_date`],
    ['the otb_as_of helper', "select * from hotel.otb_as_of(date '2026-10-01', 'LIS', date '2026-12-01', date '2026-12-31')"],
    ['the pace_vs_stly helper', "select * from hotel.pace_vs_stly('LIS', 90)"],
    ['the eur_rate helper', "select h.hotel_code, sum(d.room_revenue * hotel.eur_rate(h.currency, d.stay_date)) as rev_eur from hotel.v_hotel_day d join hotel.hotels h using (hotel_code) group by 1"],
    ['a date series for a calendar', "select d::date from generate_series(date '2026-11-01', date '2026-11-30', interval '1 day') as d"],
    ['an escape string with a newline', "select E'a\\nb' as two_lines"],
    ['a quoted alias', 'select 1 as "Rooms sold"'],
    ['FILTER and window frames', "select count(*) filter (where status = 'ok') from hotel.data_sources"],
    ['an alias named share', 'select 1 as share'],
    ['a string that mentions pg_sleep', "select * from hotel.reviews where negative_text ilike '%pg_sleep%'"],
  ])('accepts %s', (_label, sql) => {
    const result = guardReadOnlySql(sql, { maxRows: 200 });
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });
});
