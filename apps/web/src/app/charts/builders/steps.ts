/** An axis step at or above `v`: 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceStep(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Number(([1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= v - 1e-9) ?? v).toPrecision(12));
}

/** A round number at or above `v`: 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 or 10 times a power of ten. */
export function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const found = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * mag).find((s) => s >= v - 1e-9) ?? v;
  return Number(found.toPrecision(12));
}
