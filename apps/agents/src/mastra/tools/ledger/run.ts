import { createTool } from '@mastra/core/tools';
import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { RUN_STAGES, runStage, typedOutcome } from '@precast/shared';
import { getLedgerDb, schema } from '../../db/client';
import { audit, callerIdentity, reportedByField } from './common';

/** T1–T4 — run lifecycle. The state machine is the AGENT_SPEC §9 workflow. */

const ALLOWED: Record<string, string[]> = {
  ingest: ['ingest', 'draft'],
  draft: ['draft', 'secure', 'review'],
  secure: ['secure', 'review'],
  review: ['review', 'draft', 'publish'],
  publish: ['publish', 'awaiting_review'],
  awaiting_review: ['awaiting_review', 'reconcile', 'approve'],
  reconcile: ['reconcile', 'awaiting_review', 'publish'],
  approve: ['approve', 'compile', 'awaiting_review'],
  compile: ['compile', 'done', 'approve'],
  done: ['done'],
};

const runShape = z.object({
  id: z.string(),
  product: z.string(),
  projectRef: z.string().nullable(),
  stage: runStage,
  outcome: z.string().nullable(),
  digest: z.string().nullable(),
  docId: z.string().nullable(),
  ledgerHash: z.string().nullable(),
  parentRunId: z.string().nullable(),
  budget: z.object({ caps: z.record(z.number()), usage: z.record(z.number()) }),
  counts: z.object({
    facts: z.number(),
    requirements: z.number(),
    findingsOpen: z.number(),
    openQuestions: z.number(),
    decisions: z.number(),
  }),
});

async function runWithCounts(runId: string) {
  const db = getLedgerDb();
  const [run] = await db.select().from(schema.prdRun).where(eq(schema.prdRun.id, runId));
  if (!run) throw new Error(`run ${runId} not found`);
  const count = async (q: ReturnType<typeof sql>) =>
    Number((await db.execute<{ n: string }>(q))[0]?.n ?? 0);
  const counts = {
    facts: await count(
      sql`select count(*)::text as n from prdforge.brief_fact where run_id = ${runId}`,
    ),
    requirements: await count(
      sql`select count(*)::text as n from prdforge.requirement where run_id = ${runId} and status <> 'withdrawn'`,
    ),
    findingsOpen: await count(
      sql`select count(*)::text as n from prdforge.finding where run_id = ${runId} and status = 'open'`,
    ),
    openQuestions: await count(
      sql`select count(*)::text as n from prdforge.open_question where run_id = ${runId} and status = 'open'`,
    ),
    decisions: await count(
      sql`select count(*)::text as n from prdforge.decision where run_id = ${runId}`,
    ),
  };
  return { ...run, stage: run.stage as (typeof RUN_STAGES)[number], counts };
}

export const runCreate = createTool({
  id: 'run_create',
  description:
    'T1 — Start a PRD run for a product. One active run per product; pass parentRunId when a new brief version supersedes an approved run.',
  inputSchema: z.object({
    product: z.string().min(1).describe('Product slug, e.g. "merchant-onboarding"'),
    reported_by: reportedByField,
    projectRef: z.string().optional().describe('Claude Project name or id, for resume'),
    parentRunId: z.string().uuid().optional(),
  }),
  outputSchema: runShape,
  execute: async (input) => {
    const db = getLedgerDb();
    const [active] = await db
      .select({ id: schema.prdRun.id })
      .from(schema.prdRun)
      .where(and(eq(schema.prdRun.product, input.product), ne(schema.prdRun.stage, 'done')));
    if (active)
      throw new Error(
        `product "${input.product}" already has an active run ${active.id}; resume it with run_get`,
      );
    const [row] = await db
      .insert(schema.prdRun)
      .values({
        product: input.product,
        projectRef: input.projectRef ?? null,
        parentRunId: input.parentRunId ?? null,
        createdBy: input.reported_by,
        caller: callerIdentity(),
      })
      .returning({ id: schema.prdRun.id });
    await audit('run:create', {
      runId: row.id,
      reportedBy: input.reported_by,
      refs: { product: input.product },
    });
    return runWithCounts(row.id);
  },
});

export const runGet = createTool({
  id: 'run_get',
  description: 'T2 — Read a run with its counts. The resume entry point: continue at `stage`.',
  inputSchema: z.object({ runId: z.string().uuid() }),
  outputSchema: runShape,
  execute: async ({ runId }) => runWithCounts(runId),
});

export const runSetState = createTool({
  id: 'run_set_state',
  description:
    'T3 — Record a stage transition and the typed outcome of the step that ended (ok | ok_with_findings | blocked:<reason> | failed:<stage>). Transitions outside the state machine are refused.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    stage: runStage,
    outcome: typedOutcome.optional(),
    reported_by: reportedByField,
  }),
  outputSchema: runShape,
  execute: async (input) => {
    const db = getLedgerDb();
    const [run] = await db.select().from(schema.prdRun).where(eq(schema.prdRun.id, input.runId));
    if (!run) throw new Error(`run ${input.runId} not found`);
    if (!ALLOWED[run.stage]?.includes(input.stage))
      throw new Error(
        `cannot move from ${run.stage} to ${input.stage}; allowed: ${ALLOWED[run.stage]?.join(', ')}`,
      );
    await db
      .update(schema.prdRun)
      .set({ stage: input.stage, outcome: input.outcome ?? run.outcome, updatedAt: new Date() })
      .where(eq(schema.prdRun.id, input.runId));
    await audit('stage:' + input.stage, {
      runId: input.runId,
      reportedBy: input.reported_by,
      refs: { outcome: input.outcome ?? null },
    });
    return runWithCounts(input.runId);
  },
});

export const runSetDigest = createTool({
  id: 'run_set_digest',
  description:
    'T4 — Store the pinned Brief Digest (≤ 3,000 tokens ≈ 12,000 characters) and glossary for a run.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    digest: z.string().max(12_000),
    glossary: z.record(z.string()).optional(),
  }),
  outputSchema: z.object({ ok: z.literal(true), chars: z.number() }),
  execute: async (input) => {
    const db = getLedgerDb();
    await db
      .update(schema.prdRun)
      .set({
        digest: input.digest,
        ...(input.glossary ? { glossary: input.glossary } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.prdRun.id, input.runId));
    await audit('run:digest', { runId: input.runId, refs: { chars: input.digest.length } });
    return { ok: true as const, chars: input.digest.length };
  },
});

export const runSetProfile = createTool({
  id: 'run_set_profile',
  description:
    'T4 — Store the security applicability profile (data classes, actors, surfaces, integrations, jurisdictions).',
  inputSchema: z.object({
    runId: z.string().uuid(),
    profile: z.object({
      dataClasses: z.array(z.string()).default([]),
      actors: z.array(z.string()).default([]),
      surfaces: z.array(z.string()).default([]),
      integrations: z.array(z.string()).default([]),
      jurisdictions: z.array(z.string()).default([]),
      tags: z
        .array(z.string())
        .default([])
        .describe('Trigger tags from rubrics/annex-a-2022.yaml rules, e.g. pii, auth, cloud'),
    }),
  }),
  outputSchema: z.object({ ok: z.literal(true) }),
  execute: async (input) => {
    const db = getLedgerDb();
    await db
      .update(schema.prdRun)
      .set({ profile: input.profile, updatedAt: new Date() })
      .where(eq(schema.prdRun.id, input.runId));
    await audit('run:profile', { runId: input.runId, refs: { tags: input.profile.tags } });
    return { ok: true as const };
  },
});
