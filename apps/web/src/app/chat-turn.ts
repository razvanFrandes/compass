/*
  Small text helpers for tool calls and usage. The turn itself is drawn by the Kassandra component family
  (src/app/kassandra/kassandra-conversation.ts).
*/

/** "get_pace_vs_stly" → "Get pace vs stly". */
export const toolLabel = (name: string) => {
  const s = name.replace(/^mcp__\w+__/, '').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/** The few arguments worth reading, e.g. "LIS · 2026-11-21 → 2026-12-20". */
export const argsLine = (args: Record<string, unknown>) =>
  Object.entries(args)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
    .slice(0, 4)
    .map(([, v]) => String(v))
    .join(' · ');
/** "52.6k tokens · $0.05": the cost, kept quiet (the exact figures are in the tooltip). */
export const usageText = (u: { tokens: number; costUsd: number }) =>
  `${u.tokens >= 1000 ? `${(u.tokens / 1000).toFixed(1)}k` : u.tokens} tokens · $${u.costUsd < 0.01 ? u.costUsd.toFixed(3) : u.costUsd.toFixed(2)}`;
