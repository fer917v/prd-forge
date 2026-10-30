import { createTool } from '@mastra/core/tools';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getLedgerDb, schema } from '../../db/client';
import { loadAnnexA } from '../../rubrics/load';
import { audit } from './common';

/** T11, T18, T26 — slice reads and computed views. */

export const ledgerReadSection = createTool({
  id: 'ledger_read_section',
  description:
    'T11 — One section with its requirements (never the whole PRD). Pass summariesOnly to get only upstream summaries for context assembly.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    sectionId: z.string().optional(),
    summariesOnly: z.boolean().default(false),
  }),
  outputSchema: z.object({
    sections: z.array(
      z.object({
        id: z.string(),
        kind: z.string(),
        title: z.string(),
        order: z.number(),
        status: z.string(),
        narrative: z.string().nullable(),
        summary: z.string().nullable(),
      }),
    ),
    requirements: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        statement: z.string(),
        rationale: z.string(),
        source: z.unknown(),
        priority: z.string(),
        verification: z.string(),
        origin: z.string(),
        status: z.string(),
        revision: z.number(),
        openQuestionId: z.string().nullable(),
      }),
    ),
  }),
  execute: async (input) => {
    const db = getLedgerDb();
    if (input.summariesOnly) {
      const sections = await db
        .select()
        .from(schema.section)
        .where(eq(schema.section.runId, input.runId))
        .orderBy(schema.section.order);
      return { sections: sections.map((s) => ({ ...s, narrative: null })), requirements: [] };
    }
    if (!input.sectionId) throw new Error('sectionId is required unless summariesOnly');
    const sections = await db
      .select()
      .from(schema.section)
      .where(and(eq(schema.section.runId, input.runId), eq(schema.section.id, input.sectionId)));
    const requirements = await db
      .select()
      .from(schema.requirement)
      .where(
        and(
          eq(schema.requirement.runId, input.runId),
          eq(schema.requirement.sectionId, input.sectionId),
        ),
      )
      .orderBy(schema.requirement.id);
    return { sections, requirements };
  },
});

export const ledgerSummary = createTool({
  id: 'ledger_summary',
  description:
    'T26 — Counts per section and type, open findings by severity, open questions, and the current ledger hash — for status replies.',
  inputSchema: z.object({ runId: z.string().uuid() }),
  outputSchema: z.object({
    ledgerHash: z.string().nullable(),
    bySection: z.array(
      z.object({ sectionId: z.string(), status: z.string(), requirements: z.number() }),
    ),
    byType: z.record(z.number()),
    findings: z.record(z.number()),
    openQuestions: z.array(
      z.object({ id: z.string(), question: z.string(), blocks: z.array(z.string()) }),
    ),
  }),
  execute: async ({ runId }) => {
    const db = getLedgerDb();
    const [run] = await db
      .select({ ledgerHash: schema.prdRun.ledgerHash })
      .from(schema.prdRun)
      .where(eq(schema.prdRun.id, runId));
    const bySection = await db.execute<{
      sectionId: string;
      status: string;
      requirements: string;
    }>(sql`
      select s.id as "sectionId", s.status, count(r.id)::text as requirements
      from prdforge.section s left join prdforge.requirement r on r.run_id = s.run_id and r.section_id = s.id and r.status <> 'withdrawn'
      where s.run_id = ${runId} group by s.id, s.status, s."order" order by s."order"`);
    const byType = await db.execute<{ type: string; n: string }>(
      sql`select type, count(*)::text as n from prdforge.requirement where run_id = ${runId} and status <> 'withdrawn' group by type`,
    );
    const findings = await db.execute<{ severity: string; n: string }>(
      sql`select severity, count(*)::text as n from prdforge.finding where run_id = ${runId} and status = 'open' group by severity`,
    );
    const oq = await db
      .select({
        id: schema.openQuestion.id,
        question: schema.openQuestion.question,
        blocks: schema.openQuestion.blocks,
      })
      .from(schema.openQuestion)
      .where(and(eq(schema.openQuestion.runId, runId), eq(schema.openQuestion.status, 'open')));
    return {
      ledgerHash: run?.ledgerHash ?? null,
      bySection: bySection.map((r) => ({
        sectionId: r.sectionId,
        status: r.status,
        requirements: Number(r.requirements),
      })),
      byType: Object.fromEntries(byType.map((r) => [r.type, Number(r.n)])),
      findings: Object.fromEntries(findings.map((r) => [r.severity, Number(r.n)])),
      openQuestions: oq,
    };
  },
});

export const controlsCoverage = createTool({
  id: 'controls_coverage',
  description:
    'T18 — Materialise the Annex A coverage matrix for a run: each applicable control is satisfied, supported or a gap; controls outside the profile take the catalogue’s not-applicable default with its reason. Explicit notApplicable entries need a reason.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    notApplicable: z
      .array(z.object({ controlId: z.string(), reason: z.string().min(1) }))
      .default([]),
  }),
  outputSchema: z.object({
    statuses: z.array(
      z.object({
        controlId: z.string(),
        status: z.string(),
        reason: z.string().nullable(),
        requirements: z.array(z.string()),
      }),
    ),
    gaps: z.array(z.string()),
  }),
  execute: async (input) => {
    const db = getLedgerDb();
    const [run] = await db
      .select({ profile: schema.prdRun.profile })
      .from(schema.prdRun)
      .where(eq(schema.prdRun.id, input.runId));
    const tags = new Set<string>([
      'software',
      'always',
      ...((run?.profile as { tags?: string[] } | null)?.tags ?? []),
    ]);
    const a = loadAnnexA();
    const applicable = new Set<string>();
    for (const t of tags) for (const id of a.rules[t] ?? []) applicable.add(id);
    const mappings = await db
      .select()
      .from(schema.controlMapping)
      .where(eq(schema.controlMapping.runId, input.runId));
    const byControl = new Map<string, { strength: string; reqId: string }[]>();
    for (const m of mappings)
      byControl.set(m.controlId, [...(byControl.get(m.controlId) ?? []), m]);
    const na = new Map(a.notApplicableDefaults.map((d) => [d.id, d.reason]));
    for (const x of input.notApplicable) na.set(x.controlId, x.reason);
    const statuses = a.controls.map((c) => {
      const maps = byControl.get(c.id) ?? [];
      let status: string,
        reason: string | null = null;
      if (maps.some((m) => m.strength === 'satisfies')) status = 'satisfied';
      else if (maps.length) status = 'supported';
      else if (applicable.has(c.id)) status = 'gap';
      else {
        status = 'not_applicable';
        reason = na.get(c.id) ?? 'No trigger in the product profile selects this control.';
      }
      return { controlId: c.id, status, reason, requirements: maps.map((m) => m.reqId) };
    });
    await db.delete(schema.controlStatus).where(eq(schema.controlStatus.runId, input.runId));
    await db
      .insert(schema.controlStatus)
      .values(
        statuses.map((s) => ({
          runId: input.runId,
          controlId: s.controlId,
          status: s.status,
          reason: s.reason,
        })),
      );
    const gaps = statuses.filter((s) => s.status === 'gap').map((s) => s.controlId);
    await audit('controls:coverage', {
      runId: input.runId,
      refs: { gaps, applicable: applicable.size },
    });
    return { statuses, gaps };
  },
});

export const ledgerTraceAudit = createTool({
  id: 'ledger_trace_audit',
  description:
    'T26 — Traceability audit: requirements without sources, TBD without a question, workflow steps no requirement cites, open questions blocking nothing.',
  inputSchema: z.object({ runId: z.string().uuid() }),
  outputSchema: z.object({
    noSource: z.array(z.string()),
    tbdWithoutQuestion: z.array(z.string()),
    uncoveredSteps: z.array(z.string()),
    orphanQuestions: z.array(z.string()),
  }),
  execute: async ({ runId }) => {
    const db = getLedgerDb();
    const reqs = await db
      .select({
        id: schema.requirement.id,
        statement: schema.requirement.statement,
        source: schema.requirement.source,
        openQuestionId: schema.requirement.openQuestionId,
      })
      .from(schema.requirement)
      .where(and(eq(schema.requirement.runId, runId)));
    const noSource = reqs
      .filter((r) => !Array.isArray(r.source) || r.source.length === 0)
      .map((r) => r.id);
    const tbdWithoutQuestion = reqs
      .filter((r) => /TBD/.test(r.statement) && !r.openQuestionId)
      .map((r) => r.id);
    const cited = new Set<string>();
    for (const r of reqs)
      for (const s of (r.source as { kind: string; ref: string }[]) ?? [])
        if (s.kind === 'workflow') cited.add(s.ref);
    const flows = await db
      .select({ flows: schema.workflowModel.flows })
      .from(schema.workflowModel)
      .where(eq(schema.workflowModel.runId, runId));
    const uncoveredSteps: string[] = [];
    for (const w of flows)
      for (const f of (w.flows as { steps: { stepId: string }[] }[]) ?? [])
        for (const s of f.steps) if (!cited.has(s.stepId)) uncoveredSteps.push(s.stepId);
    const oq = await db
      .select({ id: schema.openQuestion.id, blocks: schema.openQuestion.blocks })
      .from(schema.openQuestion)
      .where(and(eq(schema.openQuestion.runId, runId), eq(schema.openQuestion.status, 'open')));
    return {
      noSource,
      tbdWithoutQuestion,
      uncoveredSteps,
      orphanQuestions: oq.filter((q) => q.blocks.length === 0).map((q) => q.id),
    };
  },
});

export const ledgerFindSimilar = createTool({
  id: 'ledger_find_similar',
  description:
    'T26 — Candidate duplicate or conflicting requirements for a statement (trigram similarity; pgvector when available). Returns candidates for the skill to judge, never a verdict.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    statement: z.string().min(1),
    k: z.number().int().min(1).max(20).default(5),
  }),
  outputSchema: z.object({
    candidates: z.array(
      z.object({ id: z.string(), statement: z.string(), similarity: z.number() }),
    ),
  }),
  execute: async (input) => {
    const db = getLedgerDb();
    const rows = await db.execute<{ id: string; statement: string; similarity: number }>(sql`
      select id, statement, similarity(statement, ${input.statement}) as similarity
      from prdforge.requirement where run_id = ${input.runId} and status <> 'withdrawn'
      order by similarity desc limit ${input.k}`);
    return { candidates: rows.map((r) => ({ ...r, similarity: Number(r.similarity) })) };
  },
});
