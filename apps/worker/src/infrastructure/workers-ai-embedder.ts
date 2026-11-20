import type { Embedder } from '../application/ports.ts';

const MODEL = '@cf/baai/bge-m3';
const DIMENSIONS = 1024;
/** bge-m3 accepts at most 100 texts per request. */
const BATCH = 100;

/**
 * Embeddings from Workers AI's bge-m3 (multilingual, 1024 dimensions, unit-normalised, CLS pooling).
 * bge-m3 needs no query instruction prefix, so questions and passages are embedded the same way.
 * Inputs over the model's context are truncated rather than rejected.
 */
export class WorkersAiEmbedder implements Embedder {
  readonly model = MODEL;
  readonly dimensions = DIMENSIONS;
  readonly #ai: Ai;

  constructor(ai: Ai) {
    this.#ai = ai;
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      const output = (await this.#ai.run(MODEL, { text: batch, truncate_inputs: true })) as { data?: number[][] };
      const data = output.data;
      if (!Array.isArray(data) || data.length !== batch.length) {
        throw new Error(`Workers AI ${MODEL} returned no embeddings for ${batch.length} texts.`);
      }
      for (const vector of data) {
        if (vector.length !== DIMENSIONS) throw new Error(`Workers AI ${MODEL} returned ${vector.length} dimensions, expected ${DIMENSIONS}.`);
      }
      vectors.push(...data);
    }
    return vectors;
  }
}
