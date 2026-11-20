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
  'get_kpis',
  'get_pace',
  'get_pickup',
  'get_rate_position',
  'get_data_health',
  'get_brief',
  'get_pnl',
  'get_forecast',
  // Not a data tool: it draws a widget from the rows of one of the above (presentation/agents/widgets.ts).
  'show_widget',
] as const;

const QUICK_INSTRUCTIONS =
  'Quick mode: answer in at most three sentences from one or two governed metrics. If the question needs a deeper ' +
  'diagnosis across sources, give the headline number and say that Thinker mode can explain why. The widget rules still ' +
  'hold: call show_widget once (two at most) on the result you already have, then write the three sentences.';

const THINKER_INSTRUCTIONS =
  'Thinker mode: reason across sources. You may call a data tool only to feed a widget (the same question in the shape a ' +
  'chart needs: a grain, a roll-up, a bridge, flows), and you should when the rows you have cannot draw what the answer says.';

/** `scope` is the hotel scope as instructions (scope-prompt.ts), or null for the whole group. */
export function agentChangeFor(mode: AnswerMode, data: Extension, scope: string | null = null): AgentChange {
  const tools = data.tools ?? [];
  if (mode === 'quick') {
    return {
      model: { provider: 'cloudflare', modelId: QUICK_MODEL },
      thinkingLevel: 'low',
      modelTools: tools.filter((t) => (QUICK_TOOLS as readonly string[]).includes(t.name)),
      // One more than a Quick answer needed before widgets: showing one is a tool round of its own.
      maxTurns: 5,
      instructions: scope ? `${QUICK_INSTRUCTIONS}\n\n${scope}` : QUICK_INSTRUCTIONS,
    };
  }
  return {
    model: { provider: 'cloudflare', modelId: THINKER_MODEL },
    // Not 'off': Sonnet 5.5 rejects `thinking: { type: "disabled" }`, which pi-ai sends for it (model_error). With
    // reasoning on, the provider sends the answer text in one piece at the end of the turn: see `ChatLive.phase`.
    thinkingLevel: 'low',
    modelTools: null,
    // Two more than before widgets: the call that shapes rows for a chart, and the show_widget round.
    maxTurns: 12,
    instructions: scope ? `${THINKER_INSTRUCTIONS}\n\n${scope}` : THINKER_INSTRUCTIONS,
  };
}
