import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { getLedgerDb, schema } from '../../db/client';

/**
 * Shared plumbing for every ledger tool: the caller identity, the audit row every write
 * emits (DATA_MODEL invariant 10: ids and hashes only, never text), id allocation and the
 * ledger hash.
 */

export const reportedByField = z
  .string()
  .min(1)
  .describe(
    'Session user as reported by the prdforge skill. Recorded as self-reported, never verified.',
  );

/** The connector principal. One static Application token means one caller (PRD §8). */
export function callerIdentity(): string {
  return process.env.AGENTBASE_CLIENT_ID ?? 'local';
}

export async function audit(
  action: string,
  opts: { runId?: string | null; reportedBy?: string | null; refs?: Record<string, unknown> } = {},
): Promise<void> {
  const db = getLedgerDb();
  await db.insert(schema.auditEvent).values({
    runId: opts.runId ?? null,
    caller: callerIdentity(),
    reportedBy: opts.reportedBy ?? null,
    action,
    refs: opts.refs ?? {},
  });
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Next `PREFIX-nnn` id for a run-scoped sequence (facts, questions, decisions). */
export async function nextSequenceId(
  table: 'brief_fact' | 'open_question' | 'decision',
  prefix: string,
  runId: string,
  offset = 0,
): Promise<string> {
  const db = getLedgerDb();
  const rows = await db.execute<{ n: string }>(
    sql`select count(*)::text as n from prdforge.${sql.raw(table)} where run_id = ${runId}`,
  );
  const n = Number(rows[0]?.n ?? 0) + 1 + offset;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

/**
 * Requirement ids are global per product lineage and never reused (invariant 2):
 * `REQ-<TYPE>-<nnn>` counts every requirement of that type ever written for runs that share
 * the lineage root, withdrawn ones included.
 */
export async function nextRequirementId(runId: string, type: string, offset = 0): Promise<string> {
  const db = getLedgerDb();
  const rows = await db.execute<{ n: string }>(sql`
    with recursive lineage as (
      select id, parent_run_id from prdforge.prd_run where id = ${runId}
      union all
      select r.id, r.parent_run_id from prdforge.prd_run r join lineage l on r.id = l.parent_run_id
    ),
    root as (select id from lineage where parent_run_id is null limit 1),
    family as (
      select id from prdforge.prd_run where id = (select id from root)
      union all
      select r.id from prdforge.prd_run r join family f on r.parent_run_id = f.id
    )
    select count(*)::text as n from prdforge.requirement
    where type = ${type} and run_id in (select id from family)
  `);
  const n = Number(rows[0]?.n ?? 0) + 1 + offset;
  return `REQ-${type}-${String(n).padStart(3, '0')}`;
}

/** Hash of every current requirement's statement + attributes, in id order (PrdRun.ledgerHash). */
export async function computeLedgerHash(runId: string): Promise<string> {
  const db = getLedgerDb();
  const rows = await db.execute<{ line: string }>(sql`
    select concat_ws('|', id, type, statement, rationale, source::text, priority, verification, stability, origin, status, revision) as line
    from prdforge.requirement where run_id = ${runId} order by id
  `);
  return sha256(rows.map((r) => r.line).join('\n'));
}

export async function touchRun(runId: string): Promise<void> {
  const db = getLedgerDb();
  const hash = await computeLedgerHash(runId);
  await db.execute(
    sql`update prdforge.prd_run set ledger_hash = ${hash}, updated_at = now() where id = ${runId}`,
  );
}

export const notImplemented = (tool: string) => ({
  outcome: 'blocked:not_implemented' as const,
  tool,
  message: `${tool} is scaffolded but not built yet (see docs/PROGRESS.md blockers).`,
});
