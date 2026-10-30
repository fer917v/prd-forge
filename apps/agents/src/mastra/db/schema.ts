import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  bigserial,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The PRDForge requirement ledger (docs/DATA_MODEL.md), in its own Postgres schema so it
 * never mixes with Mastra's `prdforge_agents` tables or sign-in's `prdforge_auth`.
 * Enum-like columns are `text` constrained by the zod schemas in @precast/shared; the
 * invariants the database itself enforces are the unique indexes and checks below, the
 * rest live in the tools (see DATA_MODEL §3).
 */
export const ledger = pgSchema('prdforge');

export const prdRun = ledger.table(
  'prd_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    product: text('product').notNull(),
    projectRef: text('project_ref'),
    stage: text('stage').notNull().default('ingest'),
    outcome: text('outcome'),
    digest: text('digest'),
    glossary: jsonb('glossary').$type<Record<string, string>>().notNull().default({}),
    profile: jsonb('profile').$type<Record<string, unknown>>(),
    budget: jsonb('budget')
      .$type<{ caps: Record<string, number>; usage: Record<string, number> }>()
      .notNull()
      .default({ caps: { requirements: 400, toolCalls: 2000, repairPasses: 18 }, usage: {} }),
    docId: text('doc_id'),
    ledgerHash: text('ledger_hash'),
    parentRunId: uuid('parent_run_id'),
    createdBy: text('created_by').notNull(),
    caller: text('caller').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Invariant 1: one active run per product.
    uniqueIndex('one_active_run_per_product')
      .on(t.product)
      .where(sql`${t.stage} <> 'done'`),
  ],
);

export const sourceDocument = ledger.table('source_document', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => prdRun.id),
  uploadRef: text('upload_ref').notNull(),
  name: text('name').notNull(),
  mimeType: text('mime_type').notNull(),
  role: text('role').notNull(),
  contentHash: text('content_hash').notNull(),
  blocks: jsonb('blocks')
    .$type<{ anchor: string; headingPath: string[]; text: string }[]>()
    .notNull()
    .default([]),
  extraction: jsonb('extraction'),
  confidence: numeric('confidence'),
});

export const briefFact = ledger.table('brief_fact', {
  id: text('id').primaryKey(),
  runId: uuid('run_id')
    .notNull()
    .references(() => prdRun.id),
  kind: text('kind').notNull(),
  text: text('text').notNull(),
  anchors: text('anchors').array().notNull(),
  confidence: numeric('confidence').notNull(),
});

export const workflowModel = ledger.table('workflow_model', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => prdRun.id),
  flows: jsonb('flows').notNull(),
  sourceDocIds: uuid('source_doc_ids').array().notNull().default([]),
});

export const section = ledger.table(
  'section',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => prdRun.id),
    id: text('id').notNull(),
    kind: text('kind').notNull(),
    order: integer('order').notNull(),
    mandatory: boolean('mandatory').notNull().default(true),
    title: text('title').notNull(),
    narrative: text('narrative'),
    summary: text('summary'),
    contentHash: text('content_hash'),
    status: text('status').notNull().default('empty'),
  },
  (t) => [primaryKey({ columns: [t.runId, t.id] })],
);

export const requirement = ledger.table(
  'requirement',
  {
    id: text('id').primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => prdRun.id),
    sectionId: text('section_id').notNull(),
    type: text('type').notNull(),
    statement: text('statement').notNull(),
    rationale: text('rationale').notNull(),
    source: jsonb('source').notNull(),
    priority: text('priority').notNull(),
    verification: text('verification').notNull(),
    stability: text('stability').notNull().default('tbd'),
    stakeholders: text('stakeholders').array().notNull().default([]),
    dependsOn: text('depends_on').array().notNull().default([]),
    origin: text('origin').notNull().default('agent'),
    status: text('status').notNull().default('draft'),
    revision: integer('revision').notNull().default(1),
    acceptance: jsonb('acceptance'),
    openQuestionId: text('open_question_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('requirement_run_section').on(t.runId, t.sectionId)],
);

export const revision = ledger.table('revision', {
  id: uuid('id').primaryKey().defaultRandom(),
  reqId: text('req_id')
    .notNull()
    .references(() => requirement.id),
  revision: integer('revision').notNull(),
  statement: text('statement').notNull(),
  origin: text('origin').notNull(),
  reportedBy: text('reported_by'),
  docVersion: text('doc_version'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const decision = ledger.table('decision', {
  id: text('id').primaryKey(),
  runId: uuid('run_id')
    .notNull()
    .references(() => prdRun.id),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  reportedBy: text('reported_by').notNull(),
  blocks: text('blocks').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const control = ledger.table('control', {
  id: text('id').primaryKey(),
  theme: text('theme').notNull(),
  shortName: text('short_name').notNull(),
  summary: text('summary').notNull(),
  triggers: text('triggers').array().notNull().default([]),
  relevance: text('relevance').notNull(),
  pattern: text('pattern'),
  catalogue: text('catalogue').notNull().default('iso27001-2022-annex-a'),
});

export const controlMapping = ledger.table('control_mapping', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => prdRun.id),
  reqId: text('req_id')
    .notNull()
    .references(() => requirement.id),
  controlId: text('control_id')
    .notNull()
    .references(() => control.id),
  strength: text('strength').notNull(),
  rationale: text('rationale').notNull(),
});

export const controlStatus = ledger.table(
  'control_status',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => prdRun.id),
    controlId: text('control_id')
      .notNull()
      .references(() => control.id),
    status: text('status').notNull(),
    reason: text('reason'),
  },
  (t) => [primaryKey({ columns: [t.runId, t.controlId] })],
);

export const finding = ledger.table('finding', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => prdRun.id),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  rule: text('rule').notNull(),
  severity: text('severity').notNull(),
  message: text('message').notNull(),
  suggestedFix: text('suggested_fix'),
  status: text('status').notNull().default('open'),
  pass: integer('pass').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const openQuestion = ledger.table('open_question', {
  id: text('id').primaryKey(),
  runId: uuid('run_id')
    .notNull()
    .references(() => prdRun.id),
  question: text('question').notNull(),
  blocks: text('blocks').array().notNull().default([]),
  status: text('status').notNull().default('open'),
  answer: text('answer'),
});

export const docSnapshot = ledger.table('doc_snapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => prdRun.id),
  docId: text('doc_id').notNull(),
  docVersion: text('doc_version'),
  contentHash: text('content_hash').notNull(),
  direction: text('direction').notNull(),
  blocks: jsonb('blocks').notNull(),
  renderedHash: jsonb('rendered_hash').$type<Record<string, string>>(),
  reconciled: boolean('reconciled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const approval = ledger.table('approval', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => prdRun.id),
  version: text('version').notNull(),
  reportedBy: text('reported_by').notNull(),
  docVersion: text('doc_version').notNull(),
  pdfRef: text('pdf_ref'),
  ledgerHash: text('ledger_hash').notNull(),
  overrides: text('overrides').array().notNull().default([]),
  approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bundle = ledger.table('bundle', {
  id: uuid('id').primaryKey().defaultRandom(),
  approvalId: uuid('approval_id')
    .notNull()
    .references(() => approval.id),
  files: jsonb('files').$type<Record<string, string>>().notNull(),
  verify: jsonb('verify').$type<{ ok: boolean; mismatches: string[] }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvent = ledger.table('audit_event', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  runId: uuid('run_id'),
  caller: text('caller').notNull(),
  reportedBy: text('reported_by'),
  action: text('action').notNull(),
  refs: jsonb('refs').notNull().default({}),
  tokens: integer('tokens'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});
