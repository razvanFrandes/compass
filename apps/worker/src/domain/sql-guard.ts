import { err, ok, type Result } from './result.ts';

/**
 * First line of defence for model-written SQL. The database role is the second: it can only SELECT, every
 * transaction is read-only and every statement times out after 5 s. This check keeps obviously bad input
 * from reaching the database at all and gives the model a precise reason it can act on.
 */
export type GuardReason =
  | 'empty'
  | 'unterminated'
  | 'multiple_statements'
  | 'not_select'
  | 'forbidden_keyword';

export interface GuardError {
  reason: GuardReason;
  message: string;
}

const FORBIDDEN = [
  'insert', 'update', 'delete', 'merge', 'drop', 'alter', 'create', 'truncate', 'grant', 'revoke', 'copy',
  'vacuum', 'analyze', 'reindex', 'cluster', 'lock', 'listen', 'notify', 'call', 'do', 'set', 'reset',
  'prepare', 'execute', 'deallocate', 'discard', 'refresh', 'security', 'comment',
  'set_config', 'pg_sleep', 'pg_terminate_backend', 'pg_cancel_backend', 'pg_read_file', 'pg_ls_dir',
  'lo_import', 'lo_export', 'dblink', 'pg_catalog', 'information_schema', 'pg_authid', 'pg_shadow',
];
const FORBIDDEN_RE = new RegExp(`\\b(${FORBIDDEN.join('|')})\\b`, 'i');

/** Replaces comments and string/identifier literals with spaces, so later checks only see SQL structure. */
function maskSql(sql: string): Result<string, GuardError> {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i]!;
    const next = sql[i + 1];
    if (c === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      out += ' ';
    } else if (c === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) return err({ reason: 'unterminated', message: 'Unterminated block comment.' });
      i = end + 2;
      out += ' ';
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) return err({ reason: 'unterminated', message: 'Unterminated literal.' });
        if (sql[j] === c && sql[j + 1] === c) j += 2; // escaped quote
        else if (sql[j] === c) break;
        else j++;
      }
      out += c === "'" ? "''" : '"x"';
      i = j + 1;
    } else if (c === '$') {
      return err({ reason: 'forbidden_keyword', message: 'Dollar-quoted strings and parameters are not allowed.' });
    } else {
      out += c;
      i++;
    }
  }
  return ok(out);
}

/** Checks that `sql` is one read-only SELECT and returns it wrapped with a row cap. */
export function guardReadOnlySql(sql: string, options: { maxRows: number }): Result<string, GuardError> {
  const masked = maskSql(sql);
  if (!masked.ok) return masked;

  const structure = masked.value.trim().replace(/;\s*$/, '');
  if (!structure) return err({ reason: 'empty', message: 'The query is empty.' });
  if (structure.includes(';')) {
    return err({ reason: 'multiple_statements', message: 'Send exactly one statement, without semicolons.' });
  }
  if (!/^(select|with)\b/i.test(structure)) {
    return err({ reason: 'not_select', message: 'Only SELECT or WITH … SELECT queries are allowed.' });
  }
  const forbidden = FORBIDDEN_RE.exec(structure);
  if (forbidden) {
    return err({ reason: 'forbidden_keyword', message: `"${forbidden[1]}" is not allowed in a read-only query.` });
  }

  const body = sql.trim().replace(/;\s*$/, '');
  return ok(`select * from (${body}) as q limit ${options.maxRows}`);
}
