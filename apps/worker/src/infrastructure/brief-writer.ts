import type { BriefItem } from '@compass/contracts';
import { createAI } from 'agents/models/pi-ai';
import { BRIEF_SYSTEM_PROMPT, parseSummaries, type BriefWriter } from '../application/brief.ts';

export const BRIEF_MODEL = 'anthropic/claude-haiku-5.5';

/** The brief writer on Claude Haiku through AI Gateway "compass" (the key lives on the gateway). */
export function createClaudeBriefWriter(binding: Ai): BriefWriter {
  const ai = createAI({ binding, gateway: { id: 'compass', byokAlias: 'compass', collectLog: true } });
  return {
    async summarize(items: BriefItem[]) {
      const input = items.map(({ id, title, impact_eur, impact_basis, facts, hotel_name }) => ({ id, hotel_name, title, impact_eur, impact_basis, facts }));
      const reply = await ai.completeSimple(
        ai(BRIEF_MODEL),
        { systemPrompt: BRIEF_SYSTEM_PROMPT, messages: [{ role: 'user', content: JSON.stringify(input), timestamp: Date.now() }] },
        { reasoning: 'low', maxTokens: 3000 },
      );
      if (reply.stopReason === 'error') throw new Error(reply.errorMessage ?? 'brief writer failed');
      const text = reply.content.filter((part) => part.type === 'text').map((part) => part.text).join('');
      return {
        summaries: parseSummaries(text, items.map((i) => i.id)),
        model: BRIEF_MODEL,
        usage: { tokens: reply.usage?.totalTokens ?? 0, costUsd: reply.usage?.cost?.total ?? 0 },
      };
    },
  };
}
