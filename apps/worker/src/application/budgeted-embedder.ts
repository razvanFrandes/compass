import type { Embedder } from './ports.ts';

/**
 * An embedder that takes one unit of a budget before every call. The public MCP server uses it, so anonymous
 * find_reviews calls cannot run up Workers AI spend. A spent budget, or one that cannot be reached, fails the call
 * like any other embedder failure, before the model is called.
 */
export function budgetedEmbedder(inner: Embedder, take: () => Promise<{ ok: boolean }>): Embedder {
  return {
    model: inner.model,
    dimensions: inner.dimensions,
    async embed(texts) {
      const { ok } = await take();
      if (!ok) throw new Error('The daily embedding budget is used up.');
      return inner.embed(texts);
    },
  };
}
