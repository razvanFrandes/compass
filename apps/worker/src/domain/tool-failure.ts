/**
 * Why a data tool failed, as a class the model can act on. The error itself may name hosts, roles or databases, so
 * only the class reaches the model; the error goes to the logs.
 *   temporary  the connection dropped, the server was busy or restarting: the same call may work a moment later;
 *   timeout    the statement ran out of time: a narrower call (fewer hotels, a shorter period) may work;
 *   fault      the tool's own query broke (a view or column gone after a data change) or the database refused the
 *              login: every call will fail the same way until it is fixed, so retrying only wastes the answer.
 */
export type FailureClass = 'temporary' | 'timeout' | 'fault';

/**
 * SQLSTATE classes that will fail the same way on every try: the statement itself (0A, 21, 22, 23, 25, 2B, 42, 54)
 * or the login and database (28, 3D).
 */
const LASTING = new Set(['0A', '21', '22', '23', '25', '2B', '42', '54', '28', '3D']);
const STATEMENT_TIMEOUT = '57014';

/**
 * The class of an error from the database. A SQLSTATE says it; anything else (a driver code such as
 * CONNECTION_CLOSED or ECONNREFUSED, a Hyperdrive or network error without one) is taken for temporary.
 */
export function failureClass(error: unknown): FailureClass {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (code === STATEMENT_TIMEOUT) return 'timeout';
  if (typeof code === 'string' && code.length === 5 && LASTING.has(code.slice(0, 2))) return 'fault';
  return 'temporary';
}

/** What the model reads for each class: what happened, and what to do next. It never says "not available". */
export const FAILURE_TEXT: Record<FailureClass, string> = {
  temporary:
    'Temporary failure: the database did not answer (the connection dropped or it was busy). Call this tool once more ' +
    'with the same arguments. If it fails again, tell the reader this figure cannot be read right now and answer with what you have.',
  timeout:
    'Timeout: the query took longer than the database allows. Call this tool once more with a narrower request (a shorter ' +
    'period, fewer hotels or a coarser grain). If it fails again, tell the reader this figure cannot be read right now.',
  fault:
    'Fault on our side: this tool could not read its data, and not because of your arguments, so every call will fail the ' +
    'same way. Do not call it again in this answer. Use another tool that answers the question if there is one, and tell ' +
    'the reader in one sentence that this figure could not be read.',
};
