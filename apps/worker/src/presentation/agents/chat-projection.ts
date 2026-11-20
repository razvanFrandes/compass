import type { ChatEntry, ChatLive, Evidence } from '@compass/contracts';

/**
 * Projects Pi's durable transcript (entries) and live documents into the chat protocol the UI speaks.
 * Pure functions over plain JSON, so they are unit-tested against a captured Pi view.
 */

type Json = Record<string, unknown>;
type Part = { type?: string; text?: string; id?: string; name?: string; arguments?: unknown };

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const textOf = (content: unknown): string =>
  typeof content === 'string'
    ? content
    : asArray<Part>(content)
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('');

export function projectEntries(entries: readonly unknown[]): ChatEntry[] {
  const out: ChatEntry[] = [];
  for (const raw of entries) {
    const entry = raw as Json;
    const id = entry['id'] as number;
    const kind = entry['kind'] as string;
    const message = asArray<Json>(entry['model'])[0] ?? {};
    const at = (message['timestamp'] as number | undefined) ?? 0;

    if (kind === 'pi.user') {
      out.push({ id, kind: 'user', text: textOf(message['content']), at });
    } else if (kind === 'pi.assistant') {
      const parts = asArray<Part>(message['content']);
      const usage = (message['usage'] ?? {}) as { totalTokens?: number; cost?: { total?: number } };
      out.push({
        id,
        kind: 'assistant',
        text: textOf(parts),
        toolCalls: parts
          .filter((p) => p.type === 'toolCall')
          .map((p) => ({ callId: p.id ?? '', name: p.name ?? '', args: (p.arguments ?? {}) as Record<string, unknown> })),
        model: String(message['model'] ?? ''),
        usage: { tokens: usage.totalTokens ?? 0, costUsd: usage.cost?.total ?? 0 },
        stopReason: String(message['stopReason'] ?? ''),
        at,
      });
    } else if (kind === 'pi.tool-result') {
      const isError = message['isError'] === true;
      const details = (message['details'] ?? {}) as { rows?: Record<string, unknown>[]; evidence?: Evidence };
      out.push({
        id,
        kind: 'tool_result',
        callId: String(message['toolCallId'] ?? ''),
        name: String(message['toolName'] ?? ''),
        isError,
        ...(isError ? { error: textOf(message['content']) } : {}),
        ...(details.rows ? { rows: details.rows } : {}),
        ...(details.evidence ? { evidence: details.evidence } : {}),
        at,
      });
    } else if (!kind.startsWith('pi.')) {
      out.push({ id, kind: 'event', type: kind, data: entry['data'] ?? null, at });
    }
    // pi.system, pi.reset, compaction summaries and other internal entries are not shown.
  }
  return out;
}

export function projectLive(docs: Readonly<Record<string, unknown>>): ChatLive {
  const live = (docs['pi.live'] ?? {}) as Json;
  const run = live['run'] as { turns?: number } | undefined;
  const generation = live['generation'] as { message?: { content?: unknown } } | undefined;
  const failure = live['runFailure'] as { reason?: string; detail?: unknown } | undefined;
  const models = ((docs['pi.usage'] ?? {}) as { models?: Record<string, { totalTokens?: number; cost?: { total?: number } }> }).models ?? {};
  const usage = Object.values(models).reduce(
    (sum, u) => ({ tokens: sum.tokens + (u.totalTokens ?? 0), costUsd: sum.costUsd + (u.cost?.total ?? 0) }),
    { tokens: 0, costUsd: 0 },
  );
  return {
    running: run !== undefined,
    streamingText: textOf(generation?.message?.content),
    tools: asArray<{ callId: string; name: string; status: string }>(live['tools']).map((t) => ({
      callId: t.callId,
      name: t.name,
      status: t.status,
    })),
    turns: run?.turns ?? 0,
    failure: failure?.reason
      ? { reason: failure.reason, ...(typeof failure.detail === 'string' ? { detail: failure.detail } : {}) }
      : null,
    usage: { tokens: usage.tokens, costUsd: Math.round(usage.costUsd * 1e6) / 1e6 },
  };
}
