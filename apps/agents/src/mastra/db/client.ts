import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { assertPostgresUrl } from '@precast/shared';
import * as schema from './schema';

export type LedgerDb = PostgresJsDatabase<typeof schema>;

let db: LedgerDb | undefined;

/**
 * One connection pool per process for the ledger. Same DATABASE_URL as Mastra's own
 * store (ADR-002: one Postgres), different schema (`prdforge`, see schema.ts).
 * Lazy so that importing a tool never opens a connection — only the first call does.
 */
export function getLedgerDb(): LedgerDb {
  if (db) return db;
  const url = assertPostgresUrl(process.env.DATABASE_URL ?? '');
  const client = postgres(url, { max: 5, prepare: false });
  db = drizzle(client, { schema });
  return db;
}

export { schema };
