import { createAI } from 'agents/models/pi-ai';
import { THREAD_SUMMARY_PROMPT, type ThreadSummaryWriter } from '../application/thread-summary.ts';
import { QUICK_MODEL } from '../presentation/agents/modes.ts';

/** The sidebar's title writer on the Quick model (Claude Haiku) through AI Gateway "compass" (the key lives on the gateway). */
export function createClaudeThreadSummaryWriter(binding: Ai): ThreadSummaryWriter {
  const ai = createAI({ binding, gateway: { id: 'compass', byokAlias: 'compass', collectLog: true } });
  return {
    async write({ question, answer, widgets }) {
      const content = JSON.stringify({ question, answer, charts: widgets.map((w) => w.title).filter(Boolean) });
      const reply = await ai.completeSimple(
        ai(QUICK_MODEL),
        { systemPrompt: THREAD_SUMMARY_PROMPT, messages: [{ role: 'user', content, timestamp: Date.now() }] },
        { reasoning: 'low', maxTokens: 2000 },
      );
      if (reply.stopReason === 'error') throw new Error(reply.errorMessage ?? 'thread summary writer failed');
      return reply.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('');
    },
  };
}
