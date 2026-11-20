/** The only way the application reaches the database. Implemented over Postgres (Hyperdrive in production). */
export interface Db {
  query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<Row[]>;
}
