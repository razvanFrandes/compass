import { err, ok, type Result } from './result.ts';

/**
 * First line of defence for model-written SQL. The database role is the second: it can only SELECT, every
 * transaction is read-only and every statement times out after 5 s. This check keeps obviously bad input
 * from reaching the database at all and gives the model a precise reason it can act on.
 *
 * The masker below follows PostgreSQL's own lexer on the points that matter (nested block comments, line
 * comments ended by \n or \r, backslash escapes in E'' strings), so it never mistakes code for a comment or a
 * string. Quoted identifiers are kept, not masked: `"pg_sleep"(10)` is still a call to pg_sleep.
 */
export type GuardReason =
  | 'empty'
  | 'unterminated'
  | 'unbalanced'
  | 'multiple_statements'
  | 'not_select'
  | 'forbidden_keyword';

export interface GuardError {
  reason: GuardReason;
  message: string;
}

/** Each result row may be at most this large; a bigger one fails the query instead of reaching the Worker. */
export const MAX_ROW_BYTES = 32_768;

const FORBIDDEN_WORDS = [
  // Statements and clauses that write, lock or change the session.
  'insert', 'update', 'delete', 'merge', 'drop', 'alter', 'create', 'truncate', 'grant', 'revoke', 'copy',
  'vacuum', 'analyze', 'reindex', 'cluster', 'lock', 'listen', 'notify', 'call', 'do', 'set', 'reset',
  'prepare', 'execute', 'deallocate', 'discard', 'refresh', 'security', 'comment', 'into',
  // Functions with side effects, file or network access, or that run SQL from a string.
  'set_config', 'current_setting', 'nextval', 'setval', 'version', 'ts_stat', 'ts_rewrite', 'xmlschema',
  'information_schema',
];
const FORBIDDEN_PATTERNS = [
  'pg_\\w*', // the catalog, pg_sleep*, pg_advisory_lock*, pg_read_file, pg_terminate_backend, …
  'lo_\\w+', // large objects
  'dblink\\w*',
  'inet_\\w+', // server and client addresses
  '\\w+_to_xml\\w*', // query_to_xml, table_to_xml, database_to_xml: run or dump SQL from a string
  'for\\s+(?:no\\s+key\\s+update|key\\s+share|share)', // row locks (FOR UPDATE is caught by "update")
];
const FORBIDDEN_RE = new RegExp(`\\b(${[...FORBIDDEN_WORDS, ...FORBIDDEN_PATTERNS].join('|')})\\b`, 'i');

const isIdentChar = (c: string | undefined) => c !== undefined && /[\w$\u0080-￿]/.test(c);

/**
 * Replaces comments and string literals with blanks, so later checks only see SQL structure. Quoted identifiers
 * become their bare words, so the keyword check still sees them.
 */
function maskSql(sql: string): Result<string, GuardError> {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i]!;
    const next = sql[i + 1];
    if (c === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n' && sql[i] !== '\r') i++;
      out += ' ';
    } else if (c === '/' && next === '*') {
      let depth = 1;
      i += 2;
      while (depth > 0) {
        if (i >= sql.length) return err({ reason: 'unterminated', message: 'Unterminated block comment.' });
        if (sql[i] === '/' && sql[i + 1] === '*') (depth++, (i += 2));
        else if (sql[i] === '*' && sql[i + 1] === '/') (depth--, (i += 2));
        else i++;
      }
      out += ' ';
    } else if (c === "'") {
      // E'…' strings treat a backslash as an escape, so E'\'' is one quote, not the end of the string.
      const prefix = sql[i - 1];
      const escapes = (prefix === 'e' || prefix === 'E') && !isIdentChar(sql[i - 2]);
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) return err({ reason: 'unterminated', message: 'Unterminated string literal.' });
        if (escapes && sql[j] === '\\') j += 2;
        else if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j++;
      }
      out += "''";
      i = j + 1;
    } else if (c === '"') {
      if (sql[i - 1] === '&' && (sql[i - 2] === 'u' || sql[i - 2] === 'U')) {
        return err({ reason: 'forbidden_keyword', message: 'Unicode-escaped identifiers (U&"…") are not allowed.' });
      }
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) return err({ reason: 'unterminated', message: 'Unterminated quoted identifier.' });
        if (sql[j] === '"' && sql[j + 1] === '"') j += 2;
        else if (sql[j] === '"') break;
        else j++;
      }
      out += ` ${sql.slice(i + 1, j).replace(/[^\w]+/g, ' ')} `;
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

function balanced(structure: string): boolean {
  let depth = 0;
  for (const c of structure) {
    if (c === '(') depth++;
    else if (c === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Checks that `sql` is one read-only SELECT and returns it wrapped with a row cap and a row-size cap. The body
 * sits on its own lines, so a trailing line comment cannot swallow the wrapper. A row larger than
 * MAX_ROW_BYTES fails the query with a message the model can act on.
 */
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
  if (!balanced(structure)) {
    return err({ reason: 'unbalanced', message: 'Unbalanced parentheses.' });
  }
  const forbidden = FORBIDDEN_RE.exec(structure);
  if (forbidden) {
    return err({ reason: 'forbidden_keyword', message: `"${forbidden[1]}" is not allowed in a read-only query.` });
  }

  const body = sql.trim().replace(/;\s*$/, '');
  const tooLarge = `('Result row larger than ${MAX_ROW_BYTES} bytes, select fewer or shorter columns: ' || pg_column_size(q.*))::int`;
  return ok(
    `select q.* from (\n${body}\n) as q\nwhere case when pg_column_size(q.*) > ${MAX_ROW_BYTES} then ${tooLarge} is null else true end\nlimit ${options.maxRows}`,
  );
}
