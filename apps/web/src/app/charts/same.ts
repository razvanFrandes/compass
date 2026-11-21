/**
 * Structural equality for the plain data a chart is drawn from (rows, columns, theme tokens): numbers, strings,
 * booleans, null, arrays and plain objects. A live conversation re-sends the same rows as new objects; comparing
 * them by value keeps the chart (and the tooltip under the pointer) as it is.
 */
export function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameData(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !sameData((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}
