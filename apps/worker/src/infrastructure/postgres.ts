import postgres from 'postgres';
import type { Db } from '../application/ports.ts';

export interface PostgresDb extends Db {
  close(): Promise<void>;
}

/**
 * Postgres through postgres.js. In a Worker the URL is Hyperdrive's `connectionString`, which pools for us;
 * locally it is the read-only `compass_ro` role on the compass-datagen database.
 */
export function openPostgres(url: string): PostgresDb {
  const sql = postgres(url, {
    max: 5,
    fetch_types: false, // one round trip less per connection; we cast in SQL instead
    prepare: true,
    connection: { application_name: 'compass' },
  });
  return {
    async query<Row>(text: string, params: readonly unknown[] = []) {
      const rows = await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[]);
      return [...rows] as Row[];
    },
    close: () => sql.end({ timeout: 5 }),
  };
}
