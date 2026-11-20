/*
  Text written by the model or a detector reaches people as is, so internal tokens are turned into words:
  ISO timestamps ("2026-11-17 04:12") become "Tue 17 Nov, 04:12", and the email tool's `would_fire` flag
  becomes what it means.
*/
const BUSINESS_YEAR = 2026;
const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function humanDate(y: number, mo: number, d: number, time?: string): string {
  const t = Date.UTC(y, mo - 1, d);
  if (Number.isNaN(t)) return `${y}-${mo}-${d}`;
  const base = time ? dayFmt.format(t) : dateFmt.format(t);
  return `${base}${y !== BUSINESS_YEAR ? ` ${y}` : ''}${time ? `, ${time}` : ''}`;
}

export function humanizeText(s: string): string {
  return s
    .replace(/\bwould_fire(?:\s+(?:set to|=|was|is|:))?\s*(true|false)\b/gi, (_, v: string) =>
      v.toLowerCase() === 'true' ? 'a note that the condition holds today' : 'a note that the condition doesn’t hold today',
    )
    .replace(/\bwould_fire\b/g, 'whether the condition holds')
    .replace(/\b(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?Z?)?\b/g, (_, y, mo, d, hh, mm) => humanDate(Number(y), Number(mo), Number(d), hh ? `${hh}:${mm}` : undefined));
}
