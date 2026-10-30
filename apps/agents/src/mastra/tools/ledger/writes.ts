import { createTool } from '@mastra/core/tools';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  briefFactDraft,
  checkStatement,
  controlMappingDraft,
  findingDraft,
  reqOrigin,
  requirementDraft,
  tbdQuestion,
} from '@precast/shared';
import { getLedgerDb, schema } from '../../db/client';
import { grammarConfig, knownRuleIds, loadAnnexA } from '../../rubrics/load';
import { audit, nextRequirementId, nextSequenceId, reportedByField, touchRun } from './common';

/** T5, T6, T8–T14 — the only ways content enters the ledger. */

export const ledgerWriteFacts = createTool({
  id: 'ledger_write_facts',
  description:
    'T5 — Record up to 25 anchored facts extracted from the brief. Every fact needs ≥1 source anchor (src:<file>:<block>).',
  inputSchema: z.object({
    runId: z.string().uuid(),
    facts: z.array(briefFactDraft).min(1).max(25),
    reported_by: reportedByField,
  }),
  outputSchema: z.object({ ids: z.array(z.string()), lowConfidence: z.array(z.string()) }),
  execute: async (input) => {
    const db = getLedgerDb();
    const ids: string[] = [];
    const lowConfidence: string[] = [];
    for (let i = 0; i < input.facts.length; i++) {
      const f = input.facts[i];
      const id = await nextSequenceId('brief_fact', 'FACT', input.runId, i);
      await db
        .insert(schema.briefFact)
        .values({
          id,
          runId: input.runId,
          kind: f.kind,
          text: f.text,
          anchors: f.anchors,
          confidence: String(f.confidence),
        });
      ids.push(id);
      if (f.confidence < 0.6) lowConfidence.push(id);
    }
    if (lowConfidence.length) {
      await db.insert(schema.finding).values(
        lowConfidence.map((id) => ({
          runId: input.runId,
          targetType: 'ingest',
          targetId: id,
          rule: 'ingest.low_confidence',
          severity: 'major',
          message: `Fact ${id} was extracted with confidence < 0.6; confirm it with the PM before any requirement relies on it.`,
        })),
      );
    }
    await audit('ledger:write_facts', {
      runId: input.runId,
      reportedBy: input.reported_by,
      refs: { ids, lowConfidence },
    });
    return { ids, lowConfidence };
  },
});

export const ledgerWriteWorkflow = createTool({
  id: 'ledger_write_workflow',
  description:
    'T6 — Store the merged WorkflowModel (flows, steps, decisions, boundaries) extracted from the diagrams.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    flows: z.array(
      z.object({
        flowId: z.string(),
        name: z.string(),
        steps: z.array(
          z.object({
            stepId: z.string(),
            actor: z.string(),
            action: z.string(),
            system: z.string().optional(),
            dataStore: z.string().optional(),
            next: z.array(z.string()).default([]),
          }),
        ),
        decisions: z
          .array(
            z.object({
              decisionId: z.string(),
              question: z.string(),
              outcomes: z.array(z.string()),
            }),
          )
          .default([]),
        boundaries: z.array(z.string()).default([]),
        confidence: z.number().min(0).max(1).default(1),
      }),
    ),
    sourceDocIds: z.array(z.string().uuid()).default([]),
  }),
  outputSchema: z.object({ id: z.string(), steps: z.number() }),
  execute: async (input) => {
    const db = getLedgerDb();
    const [row] = await db
      .insert(schema.workflowModel)
      .values({ runId: input.runId, flows: input.flows, sourceDocIds: input.sourceDocIds })
      .returning({ id: schema.workflowModel.id });
    const steps = input.flows.reduce((n, f) => n + f.steps.length, 0);
    await audit('ledger:write_workflow', {
      runId: input.runId,
      refs: { id: row.id, flows: input.flows.length, steps },
    });
    return { id: row.id, steps };
  },
});

export const ledgerWriteRequirements = createTool({
  id: 'ledger_write_requirements',
  description:
    'T8 — Write up to 15 requirement objects into a section. Each statement passes the grammar pre-check (one "shall", no banned terms, numbers carry units, TBD only as TBD(question), ≤40 words, ≥1 source) or comes back in `rejected` with reasons; accepted ones get stable REQ-<TYPE>-<nnn> ids.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    sectionId: z.string(),
    requirements: z.array(requirementDraft).min(1).max(15),
    reported_by: reportedByField,
    origin: reqOrigin.default('agent'),
  }),
  outputSchema: z.object({
    ids: z.array(z.string()),
    rejected: z.array(
      z.object({
        index: z.number(),
        reasons: z.array(z.object({ rule: z.string(), message: z.string() })),
      }),
    ),
  }),
  execute: async (input) => {
    const db = getLedgerDb();
    const [run] = await db
      .select({ id: schema.prdRun.id, budget: schema.prdRun.budget })
      .from(schema.prdRun)
      .where(eq(schema.prdRun.id, input.runId));
    if (!run) throw new Error(`run ${input.runId} not found`);
    const [sec] = await db
      .select({ id: schema.section.id })
      .from(schema.section)
      .where(and(eq(schema.section.runId, input.runId), eq(schema.section.id, input.sectionId)));
    if (!sec)
      throw new Error(
        `section ${input.sectionId} not found for this run; call ledger_create_sections first`,
      );

    const cfg = grammarConfig();
    const ids: string[] = [];
    const rejected: { index: number; reasons: { rule: string; message: string }[] }[] = [];
    const perType: Record<string, number> = {};

    for (let i = 0; i < input.requirements.length; i++) {
      const r = input.requirements[i];
      const reasons = checkStatement(r.statement, cfg);
      const tbd = tbdQuestion(r.statement);
      if (tbd && !r.openQuestion)
        reasons.push({
          rule: 'trace.tbd_without_question',
          message: 'Statement has TBD(...) but no openQuestion was supplied.',
        });
      for (const s of r.source)
        if (s.kind === 'derived' && !s.why)
          reasons.push({
            rule: 'trace.derived_without_why',
            message: 'A derived source must say why.',
          });
      if (reasons.length) {
        rejected.push({ index: i, reasons });
        continue;
      }
      const offset = perType[r.type] ?? 0;
      perType[r.type] = offset + 1;
      const id = await nextRequirementId(input.runId, r.type, offset);
      let openQuestionId: string | null = null;
      if (tbd) {
        openQuestionId = await nextSequenceId('open_question', 'OQ', input.runId);
        await db
          .insert(schema.openQuestion)
          .values({
            id: openQuestionId,
            runId: input.runId,
            question: r.openQuestion ?? tbd,
            blocks: [id],
          });
      }
      await db.insert(schema.requirement).values({
        id,
        runId: input.runId,
        sectionId: input.sectionId,
        type: r.type,
        statement: r.statement,
        rationale: r.rationale,
        source: r.source,
        priority: r.priority,
        verification: r.verification,
        stability: r.stability,
        stakeholders: r.stakeholders,
        dependsOn: r.dependsOn,
        origin: input.origin,
        openQuestionId,
      });
      await db
        .insert(schema.revision)
        .values({
          reqId: id,
          revision: 1,
          statement: r.statement,
          origin: input.origin,
          reportedBy: input.reported_by,
        });
      ids.push(id);
    }
    await db
      .update(schema.section)
      .set({ status: 'drafted' })
      .where(and(eq(schema.section.runId, input.runId), eq(schema.section.id, input.sectionId)));
    await touchRun(input.runId);
    await audit('ledger:write_requirements', {
      runId: input.runId,
      reportedBy: input.reported_by,
      refs: { sectionId: input.sectionId, ids, rejected: rejected.length },
    });
    return { ids, rejected };
  },
});

export const ledgerWriteRevision = createTool({
  id: 'ledger_write_revision',
  description:
    'T9 — Replace a requirement’s statement with a new revision. An agent-origin revision over human-origin text is refused (DATA_MODEL invariant 4) unless acceptedFindingId names a finding the human accepted.',
  inputSchema: z.object({
    reqId: z.string(),
    statement: z.string().min(1),
    origin: reqOrigin,
    reported_by: reportedByField,
    docVersion: z.string().optional(),
    acceptedFindingId: z.string().uuid().optional(),
  }),
  outputSchema: z.object({
    reqId: z.string(),
    revision: z.number(),
    grammar: z.array(z.object({ rule: z.string(), message: z.string() })),
  }),
  execute: async (input) => {
    const db = getLedgerDb();
    const [req] = await db
      .select()
      .from(schema.requirement)
      .where(eq(schema.requirement.id, input.reqId));
    if (!req) throw new Error(`requirement ${input.reqId} not found`);
    if (req.origin === 'human' && input.origin !== 'human') {
      let accepted = false;
      if (input.acceptedFindingId) {
        const [f] = await db
          .select()
          .from(schema.finding)
          .where(eq(schema.finding.id, input.acceptedFindingId));
        accepted = !!f && f.status === 'accepted_by_human' && f.targetId === input.reqId;
      }
      if (!accepted)
        throw new Error(
          `${input.reqId} was written by a human; propose the change as a finding or Doc comment instead of overwriting it`,
        );
    }
    const next = req.revision + 1;
    await db
      .update(schema.requirement)
      .set({
        statement: input.statement,
        origin: input.origin,
        revision: next,
        updatedAt: new Date(),
        status: input.origin === 'human' ? req.status : 'draft',
      })
      .where(eq(schema.requirement.id, input.reqId));
    await db
      .insert(schema.revision)
      .values({
        reqId: input.reqId,
        revision: next,
        statement: input.statement,
        origin: input.origin,
        reportedBy: input.reported_by,
        docVersion: input.docVersion ?? null,
      });
    await touchRun(req.runId);
    await audit('ledger:write_revision', {
      runId: req.runId,
      reportedBy: input.reported_by,
      refs: { reqId: input.reqId, revision: next, origin: input.origin },
    });
    // Human text is kept verbatim; the grammar result is advisory so the skill can raise a finding.
    return {
      reqId: input.reqId,
      revision: next,
      grammar: checkStatement(input.statement, grammarConfig()),
    };
  },
});

export const ledgerWriteSectionNarrative = createTool({
  id: 'ledger_write_section_narrative',
  description:
    'T10 — Store a section’s prose (≤400 words) and its ≤120-word summary used as upstream context by later sections.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    sectionId: z.string(),
    narrative: z.string(),
    summary: z.string(),
  }),
  outputSchema: z.object({
    ok: z.literal(true),
    narrativeWords: z.number(),
    summaryWords: z.number(),
  }),
  execute: async (input) => {
    const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
    const nw = words(input.narrative),
      sw = words(input.summary);
    if (nw > 400) throw new Error(`narrative is ${nw} words; max 400`);
    if (sw > 120) throw new Error(`summary is ${sw} words; max 120`);
    const db = getLedgerDb();
    const res = await db
      .update(schema.section)
      .set({ narrative: input.narrative, summary: input.summary, status: 'drafted' })
      .where(and(eq(schema.section.runId, input.runId), eq(schema.section.id, input.sectionId)))
      .returning({ id: schema.section.id });
    if (!res.length) throw new Error(`section ${input.sectionId} not found for this run`);
    await audit('ledger:write_narrative', {
      runId: input.runId,
      refs: { sectionId: input.sectionId, nw, sw },
    });
    return { ok: true as const, narrativeWords: nw, summaryWords: sw };
  },
});

export const ledgerWriteMappings = createTool({
  id: 'ledger_write_mappings',
  description:
    'T12 — Map up to 20 requirements to Annex A controls with a strength and a rationale.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    mappings: z.array(controlMappingDraft).min(1).max(20),
  }),
  outputSchema: z.object({ ids: z.array(z.string()), unknownControls: z.array(z.string()) }),
  execute: async (input) => {
    const db = getLedgerDb();
    const known = new Set(loadAnnexA().controls.map((c) => c.id));
    const unknownControls = input.mappings.map((m) => m.controlId).filter((c) => !known.has(c));
    const good = input.mappings.filter((m) => known.has(m.controlId));
    const ids = good.length
      ? (
          await db
            .insert(schema.controlMapping)
            .values(good.map((m) => ({ runId: input.runId, ...m })))
            .returning({ id: schema.controlMapping.id })
        ).map((r) => r.id)
      : [];
    await audit('ledger:write_mappings', {
      runId: input.runId,
      refs: { count: ids.length, unknownControls },
    });
    return { ids, unknownControls };
  },
});

export const ledgerWriteFindings = createTool({
  id: 'ledger_write_findings',
  description:
    'T13 — Record review findings. Rule ids must come from the rubric (rubric_slice lists them); unknown rules are refused.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    findings: z.array(findingDraft).min(1).max(50),
    pass: z.number().int().min(0).default(0),
  }),
  outputSchema: z.object({ ids: z.array(z.string()), blocking: z.number() }),
  execute: async (input) => {
    const known = knownRuleIds();
    const bad = input.findings.filter((f) => !known.has(f.rule)).map((f) => f.rule);
    if (bad.length) throw new Error(`unknown rule ids: ${[...new Set(bad)].join(', ')}`);
    const db = getLedgerDb();
    const rows = await db
      .insert(schema.finding)
      .values(input.findings.map((f) => ({ runId: input.runId, ...f, pass: input.pass })))
      .returning({ id: schema.finding.id });
    const blocking = input.findings.filter((f) => f.severity === 'blocking').length;
    await audit('ledger:write_findings', {
      runId: input.runId,
      refs: { count: rows.length, blocking, pass: input.pass },
    });
    return { ids: rows.map((r) => r.id), blocking };
  },
});

export const ledgerWriteDecision = createTool({
  id: 'ledger_write_decision',
  description:
    'T14 — Record a clarifying answer or reviewer ruling, and the REQ/SEC ids it unblocks.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    question: z.string().min(1),
    answer: z.string().min(1),
    reported_by: reportedByField,
    blocks: z.array(z.string()).default([]),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async (input) => {
    const db = getLedgerDb();
    const id = await nextSequenceId('decision', 'DEC', input.runId);
    await db
      .insert(schema.decision)
      .values({
        id,
        runId: input.runId,
        question: input.question,
        answer: input.answer,
        reportedBy: input.reported_by,
        blocks: input.blocks,
      });
    if (input.blocks.length)
      await db.execute(
        sql`update prdforge.open_question set status = 'answered', answer = ${input.answer} where run_id = ${input.runId} and blocks && ${input.blocks}::text[] and status = 'open'`,
      );
    await audit('ledger:write_decision', {
      runId: input.runId,
      reportedBy: input.reported_by,
      refs: { id, blocks: input.blocks },
    });
    return { id };
  },
});
