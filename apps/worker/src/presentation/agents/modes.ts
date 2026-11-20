import type { AgentChange, Extension } from '@earendil-works/pi-durable';

/**
 * Kassandra's answer modes, after Juyo's own tiers:
 * - Quick: a fast, cheap answer from a trusted source. Haiku, only the governed-metric tools, a few turns.
 * - Thinker: reasons across sources. Sonnet, every tool, more turns.
 * A mode is a per-conversation agent change (model, offered tools, turn limit, instructions), applied before a question.
 */
export type AnswerMode = 'quick' | 'thinker';

export const THINKER_MODEL = 'anthropic/claude-sonnet-5.5';
export const QUICK_MODEL = 'anthropic/claude-haiku-5.5';

export const QUICK_TOOLS = [
  'list_hotels',
  'list_metrics',
  'get_metric',
  'get_pace',
  'get_pickup',
  'get_rate_position',
  'get_data_health',
] as const;

const QUICK_INSTRUCTIONS =
  'Quick mode: answer in at most three sentences from one or two governed metrics. If the question needs a deeper ' +
  'diagnosis across sources, give the headline number and say that Thinker mode can explain why.';

export function agentChangeFor(mode: AnswerMode, data: Extension): AgentChange {
  const tools = data.tools ?? [];
  if (mode === 'quick') {
    return {
      model: { provider: 'cloudflare', modelId: QUICK_MODEL },
      thinkingLevel: 'low',
      modelTools: tools.filter((t) => (QUICK_TOOLS as readonly string[]).includes(t.name)),
      maxTurns: 4,
      instructions: QUICK_INSTRUCTIONS,
    };
  }
  return {
    model: { provider: 'cloudflare', modelId: THINKER_MODEL },
    thinkingLevel: 'low',
    modelTools: null,
    maxTurns: 10,
    instructions: null,
  };
}
