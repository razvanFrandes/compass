/** The only way the application reaches the database. Implemented over Postgres (Hyperdrive in production). */
export interface Db {
  query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<Row[]>;
}

/** Turns text into vectors for semantic search. Implemented over Workers AI (`@cf/baai/bge-m3`). */
export interface Embedder {
  /** The model id, stored next to every embedding so vectors from different models never mix. */
  readonly model: string;
  readonly dimensions: number;
  /** One vector per text, in order. */
  embed(texts: readonly string[]): Promise<number[][]>;
}
