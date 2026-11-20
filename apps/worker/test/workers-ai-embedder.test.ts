import { describe, expect, it } from 'vitest';
import { WorkersAiEmbedder } from '../src/infrastructure/workers-ai-embedder.ts';

/** A stand-in for the AI binding that records each call and returns unit vectors. */
function fakeAi(dims = 1024, response?: unknown) {
  const calls: { model: string; inputs: { text: string[] } }[] = [];
  const ai = {
    run: async (model: string, inputs: { text: string[] }) => {
      calls.push({ model, inputs });
      return response ?? { shape: [inputs.text.length, dims], data: inputs.text.map((_, i) => Array.from({ length: dims }, (_, j) => (j === i % dims ? 1 : 0))) };
    },
  };
  return { ai: ai as unknown as Ai, calls };
}

describe('WorkersAiEmbedder', () => {
  it('embeds with bge-m3 and returns one 1024-dim vector per text, in order', async () => {
    const { ai, calls } = fakeAi();
    const embedder = new WorkersAiEmbedder(ai);
    const vectors = await embedder.embed(['a', 'b']);
    expect(embedder.model).toBe('@cf/baai/bge-m3');
    expect(embedder.dimensions).toBe(1024);
    expect(calls).toEqual([{ model: '@cf/baai/bge-m3', inputs: { text: ['a', 'b'], truncate_inputs: true } }]);
    expect(vectors).toHaveLength(2);
    expect(vectors[1]![1]).toBe(1);
  });

  it('splits more than 100 texts into batches (the model accepts at most 100 per request)', async () => {
    const { ai, calls } = fakeAi();
    const vectors = await new WorkersAiEmbedder(ai).embed(Array.from({ length: 230 }, (_, i) => `t${i}`));
    expect(calls.map((c) => c.inputs.text.length)).toEqual([100, 100, 30]);
    expect(vectors).toHaveLength(230);
  });

  it('makes no call for no texts', async () => {
    const { ai, calls } = fakeAi();
    expect(await new WorkersAiEmbedder(ai).embed([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('rejects an answer with the wrong dimensions or count', async () => {
    await expect(new WorkersAiEmbedder(fakeAi(768).ai).embed(['a'])).rejects.toThrow(/768/);
    await expect(new WorkersAiEmbedder(fakeAi(1024, { request_id: 'x' }).ai).embed(['a'])).rejects.toThrow(/no embeddings/i);
  });
});
