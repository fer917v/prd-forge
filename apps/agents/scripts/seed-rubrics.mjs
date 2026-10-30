// Seed the Control catalogue (rubrics/annex-a-2022.yaml) into prdforge.control. Idempotent.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { parse } from 'yaml';

const url = process.env.DATABASE_URL;
if (!url || !/^postgres(ql)?:/.test(url)) {
  console.error(
    'DATABASE_URL must be a Postgres URL (run through `pnpm db:seed` so .env is loaded).',
  );
  process.exit(1);
}
const file = resolve(
  process.env.PRDFORGE_RUBRICS_DIR ?? resolve(process.cwd(), '../../rubrics'),
  'annex-a-2022.yaml',
);
const catalogue = parse(readFileSync(file, 'utf8'));
const sql = postgres(url, { max: 1 });
let n = 0;
for (const c of catalogue.controls) {
  await sql`
    insert into prdforge.control (id, theme, short_name, summary, triggers, relevance, pattern, catalogue)
    values (${c.id}, ${c.theme}, ${c.shortName}, ${c.summary}, ${c.triggers}, ${c.relevance}, ${c.pattern ?? null}, 'iso27001-2022-annex-a')
    on conflict (id) do update set theme = excluded.theme, short_name = excluded.short_name, summary = excluded.summary,
      triggers = excluded.triggers, relevance = excluded.relevance, pattern = excluded.pattern`;
  n++;
}
await sql.end();
console.log(`seeded ${n} controls from rubrics/annex-a-2022.yaml (version ${catalogue.version})`);
