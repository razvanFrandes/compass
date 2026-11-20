import { describe, expect, it } from 'vitest';
import { guardReadOnlySql } from '../src/domain/sql-guard.ts';

describe('guardReadOnlySql', () => {
  it('accepts a single SELECT and wraps it with a row cap', () => {
    const result = guardReadOnlySql('select hotel_code, rooms from hotels', { maxRows: 200 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('select * from (select hotel_code, rooms from hotels) as q limit 200');
  });

  it('accepts WITH … SELECT and a trailing semicolon', () => {
    const result = guardReadOnlySql('with x as (select 1 as a) select a from x;', { maxRows: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('select * from (with x as (select 1 as a) select a from x) as q limit 10');
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
