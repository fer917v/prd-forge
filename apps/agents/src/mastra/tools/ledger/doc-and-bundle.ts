import { createTool } from '@mastra/core/tools';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getLedgerDb, schema } from '../../db/client';
import { audit, computeLedgerHash, notImplemented, reportedByField, sha256 } from './common';

/**
 * T19–T25 — Doc snapshots, render, approval, bundle. snapshot_write, approval_create and
 * ledger_render are built; snapshot_diff, bundle_compile, bundle_verify and bundle_get are
 * typed stubs for the hardening waves (docs/PROGRESS.md blockers). A stub answers with a
 * typed `blocked:not_implemented` outcome rather than pretending.
 */

const block = z.object({ key: z.string().describe('heading path or REQ id'), text: z.string() });

export const snapshotWrite = createTool({
  id: 'snapshot_write',
  description:
    'T19 — Record what was rendered to, or read from, the Claude Doc. A `rendered` snapshot is refused while the latest `read` snapshot is unreconciled (invariant 5).',
  inputSchema: z.object({
    runId: z.string().uuid(),
    direction: z.enum(['rendered', 'read']),
    docId: z.string().min(1),
    docVersion: z.string().optional(),
    blocks: z.array(block),
    reconciled: z.boolean().default(false),
    reported_by: reportedByField,
  }),
  outputSchema: z.object({ id: z.string(), contentHash: z.string() }),
  execute: async (input) => {
    const db = getLedgerDb();
    if (input.direction === 'rendered') {
      const [lastRead] = await db
        .select()
        .from(schema.docSnapshot)
        .where(
          and(eq(schema.docSnapshot.runId, input.runId), eq(schema.docSnapshot.direction, 'read')),
        )
        .orderBy(desc(schema.docSnapshot.createdAt))
        .limit(1);
      if (lastRead && !lastRead.reconciled)
        throw new Error(
          `the latest read snapshot ${lastRead.id} is not reconciled; reconcile human edits before rendering`,
        );
    }
    const contentHash = sha256(input.blocks.map((b) => `${b.key}\u0000${b.text}`).join('\n'));
    const [row] = await db
      .insert(schema.docSnapshot)
      .values({
        runId: input.runId,
        direction: input.direction,
        docId: input.docId,
        docVersion: input.docVersion ?? null,
        contentHash,
        blocks: input.blocks,
        reconciled: input.direction === 'read' ? input.reconciled : true,
      })
      .returning({ id: schema.docSnapshot.id });
    if (input.docId)
      await db
        .update(schema.prdRun)
        .set({ docId: input.docId })
        .where(eq(schema.prdRun.id, input.runId));
    await audit('snapshot:' + input.direction, {
      runId: input.runId,
      reportedBy: input.reported_by,
      refs: { id: row.id, contentHash, docVersion: input.docVersion ?? null },
    });
    return { id: row.id, contentHash };
  },
});

export const snapshotDiff = createTool({
  id: 'snapshot_diff',
  description:
    'T20 — Structural diff of a Doc read against the last rendered snapshot (unchanged | human_edited | human_added | human_deleted), with fuzzy REQ-id recovery. [scaffolded, not built]',
  inputSchema: z.object({ runId: z.string().uuid(), blocks: z.array(block) }),
  outputSchema: z.object({ outcome: z.string(), tool: z.string(), message: z.string() }),
  execute: async () => notImplemented('snapshot_diff'),
});

export const ledgerRender = createTool({
  id: 'ledger_render',
  description:
    'T21 — Deterministic Doc body from the ledger as Markdown blocks keyed by heading path / REQ id, plus per-section hashes for incremental re-render. Pass sectionIds to render a subset.',
  inputSchema: z.object({ runId: z.string().uuid(), sectionIds: z.array(z.string()).optional() }),
  outputSchema: z.object({
    blocks: z.array(block),
    sectionHashes: z.record(z.string()),
    ledgerHash: z.string(),
  }),
  execute: async (input) => {
    const db = getLedgerDb();
    const [run] = await db.select().from(schema.prdRun).where(eq(schema.prdRun.id, input.runId));
    if (!run) throw new Error(`run ${input.runId} not found`);
    const sections = (
      await db
        .select()
        .from(schema.section)
        .where(eq(schema.section.runId, input.runId))
        .orderBy(schema.section.order)
    ).filter((s) => !input.sectionIds || input.sectionIds.includes(s.id));
    const reqs = await db
      .select()
      .from(schema.requirement)
      .where(eq(schema.requirement.runId, input.runId))
      .orderBy(schema.requirement.id);
    const oq = await db
      .select()
      .from(schema.openQuestion)
      .where(eq(schema.openQuestion.runId, input.runId));
    const statuses = await db
      .select()
      .from(schema.controlStatus)
      .where(eq(schema.controlStatus.runId, input.runId));
    const blocks: { key: string; text: string }[] = [];
    const sectionHashes: Record<string, string> = {};
    if (!input.sectionIds) {
      blocks.push({
        key: 'title',
        text: `# PRD — ${run.product}\n\nrun ${run.id} · status ${run.stage} · ${run.ledgerHash ? 'ledger ' + run.ledgerHash.slice(0, 12) : 'unhashed'}`,
      });
    }
    for (const s of sections) {
      const parts: { key: string; text: string }[] = [{ key: s.id, text: `## ${s.title}` }];
      if (s.narrative) parts.push({ key: `${s.id}/narrative`, text: s.narrative });
      for (const r of reqs.filter((r) => r.sectionId === s.id && r.status !== 'withdrawn')) {
        parts.push({
          key: r.id,
          text: `**${r.id}** · ${cap(r.priority)} · ${cap(r.verification)}\n\n${r.statement}\n\n_Rationale:_ ${r.rationale}`,
        });
      }
      if (s.kind === 'open_questions')
        for (const q of oq.filter((q) => q.status === 'open'))
          parts.push({
            key: q.id,
            text: `- **${q.id}** ${q.question} (blocks ${q.blocks.join(', ') || '—'})`,
          });
      if (s.kind === 'coverage' && statuses.length)
        parts.push({
          key: `${s.id}/matrix`,
          text: [
            '| Control | Status | Reason / requirements |',
            '| --- | --- | --- |',
            ...statuses
              .filter((c) => c.status !== 'not_applicable')
              .map((c) => `| ${c.controlId} | ${c.status} | ${c.reason ?? ''} |`),
          ].join('\n'),
        });
      sectionHashes[s.id] = sha256(parts.map((p) => p.text).join('\n'));
      blocks.push(...parts);
    }
    if (!input.sectionIds)
      blocks.push({
        key: 'footer',
        text: '_Structured in alignment with ISO/IEC/IEEE 29148:2018. Requirements are mapped to ISO/IEC 27001:2022 Annex A controls as an analysis aid; this is not a conformity assessment._',
      });
    const ledgerHash = await computeLedgerHash(input.runId);
    return { blocks, sectionHashes, ledgerHash };
  },
});

export const approvalCreate = createTool({
  id: 'approval_create',
  description:
    'T22 — Freeze an approved version: the ledger hash must equal the current one; blocking findings must be listed in overrides. Records reported_by (self-reported), the Doc version and the PDF reference.',
  inputSchema: z.object({
    runId: z.string().uuid(),
    docVersion: z.string().min(1),
    ledgerHash: z.string().min(1),
    reported_by: reportedByField,
    overrides: z.array(z.string().uuid()).default([]),
    pdfRef: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string(), version: z.string(), ledgerHash: z.string() }),
  execute: async (input) => {
    const db = getLedgerDb();
    const current = await computeLedgerHash(input.runId);
    if (current !== input.ledgerHash)
      throw new Error(
        `ledger hash moved (${current.slice(0, 12)} now vs ${input.ledgerHash.slice(0, 12)} given); sync and re-read before approving`,
      );
    const blocking = await db
      .select({ id: schema.finding.id })
      .from(schema.finding)
      .where(
        and(
          eq(schema.finding.runId, input.runId),
          eq(schema.finding.status, 'open'),
          eq(schema.finding.severity, 'blocking'),
        ),
      );
    const unapproved = blocking.map((b) => b.id).filter((id) => !input.overrides.includes(id));
    if (unapproved.length)
      throw new Error(
        `${unapproved.length} blocking finding(s) are open and not overridden: ${unapproved.join(', ')}`,
      );
    const prior = await db
      .select({ version: schema.approval.version })
      .from(schema.approval)
      .where(eq(schema.approval.runId, input.runId));
    const version = `1.${prior.length}`;
    const [row] = await db
      .insert(schema.approval)
      .values({
        runId: input.runId,
        version,
        reportedBy: input.reported_by,
        docVersion: input.docVersion,
        ledgerHash: input.ledgerHash,
        overrides: input.overrides,
        pdfRef: input.pdfRef ?? null,
      })
      .returning({ id: schema.approval.id });
    await db
      .update(schema.prdRun)
      .set({ stage: 'approve', ledgerHash: input.ledgerHash, updatedAt: new Date() })
      .where(eq(schema.prdRun.id, input.runId));
    await audit('approve', {
      runId: input.runId,
      reportedBy: input.reported_by,
      refs: {
        approvalId: row.id,
        version,
        ledgerHash: input.ledgerHash,
        overrides: input.overrides,
      },
    });
    return { id: row.id, version, ledgerHash: input.ledgerHash };
  },
});

export const bundleCompile = createTool({
  id: 'bundle_compile',
  description:
    'T23 — Compile the coding-agent bundle (PRD.agent.md, requirements.yaml, controls.yaml, traceability.csv, Precast PRD/DATA_MODEL/AGENT_SPEC drafts) from an approval. Deterministic, no LLM. [scaffolded, not built]',
  inputSchema: z.object({ approvalId: z.string().uuid() }),
  outputSchema: z.object({ outcome: z.string(), tool: z.string(), message: z.string() }),
  execute: async () => notImplemented('bundle_compile'),
});

export const bundleVerify = createTool({
  id: 'bundle_verify',
  description:
    'T24 — Parse the emitted bundle back and compare ids, controls and acceptance to the ledger. [scaffolded, not built]',
  inputSchema: z.object({ bundleId: z.string().uuid() }),
  outputSchema: z.object({ outcome: z.string(), tool: z.string(), message: z.string() }),
  execute: async () => notImplemented('bundle_verify'),
});

export const bundleGet = createTool({
  id: 'bundle_get',
  description: 'T25 — Fetch one bundle file or the whole bundle. [scaffolded, not built]',
  inputSchema: z.object({ bundleId: z.string().uuid(), file: z.string().optional() }),
  outputSchema: z.object({ outcome: z.string(), tool: z.string(), message: z.string() }),
  execute: async () => notImplemented('bundle_get'),
});

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
