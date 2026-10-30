import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getLedgerDb, schema } from './client';
import { loadAnnexA } from '../rubrics/load';

/**
 * Bring the ledger schema up to date and seed the control catalogue at boot. The hosted
 * container has no shell step between build and start, so the app owns its migrations:
 * `drizzle/` and `rubrics/` ship in the image (apps/agents/Dockerfile) and this runs once
 * per process before the first tool call. Idempotent. Off with PRDFORGE_AUTO_MIGRATE=0.
 */
export async function bootstrapLedger(): Promise<{ migrated: boolean; controls: number }> {
  if (process.env.PRDFORGE_AUTO_MIGRATE === '0') return { migrated: false, controls: 0 };
  const db = getLedgerDb();
  await migrate(db, { migrationsFolder: migrationsDir() });
  const catalogue = loadAnnexA();
  for (const c of catalogue.controls) {
    await db
      .insert(schema.control)
      .values({
        id: c.id,
        theme: c.theme,
        shortName: c.shortName,
        summary: c.summary,
        triggers: c.triggers,
        relevance: c.relevance,
        pattern: c.pattern ?? null,
      })
      .onConflictDoUpdate({
        target: schema.control.id,
        set: {
          theme: sql`excluded.theme`,
          shortName: sql`excluded.short_name`,
          summary: sql`excluded.summary`,
          triggers: sql`excluded.triggers`,
          relevance: sql`excluded.relevance`,
          pattern: sql`excluded.pattern`,
        },
      });
  }
  return { migrated: true, controls: catalogue.controls.length };
}

function migrationsDir(): string {
  const override = process.env.PRDFORGE_MIGRATIONS_DIR;
  if (override) return override;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, 'drizzle');
    if (existsSync(resolve(candidate, 'meta/_journal.json'))) return candidate;
    dir = dirname(dir);
  }
  return resolve(process.cwd(), 'drizzle');
}
