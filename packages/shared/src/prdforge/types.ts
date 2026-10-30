import { z } from 'zod';

/**
 * PRDForge domain types — the zod source of truth mirrored by the Drizzle schema in
 * apps/agents/src/mastra/db/schema.ts and by every ledger tool's input/output.
 * See docs/DATA_MODEL.md.
 */

export const RUN_STAGES = [
  'ingest',
  'draft',
  'secure',
  'review',
  'publish',
  'awaiting_review',
  'reconcile',
  'approve',
  'compile',
  'done',
] as const;
export const runStage = z.enum(RUN_STAGES);
export type RunStage = z.infer<typeof runStage>;

export const REQ_TYPES = ['F', 'IF', 'DATA', 'PERF', 'USE', 'SEC', 'CONSTR', 'QUAL'] as const;
export const reqType = z.enum(REQ_TYPES);
export const reqOrigin = z.enum(['agent', 'human', 'agent_on_request']);
export const reqStatus = z.enum([
  'draft',
  'reviewed',
  'published',
  'withdrawn',
  'needs_structuring',
]);
export const priority = z.enum(['must', 'should', 'could', 'wont']);
export const verificationMethod = z.enum(['inspection', 'analysis', 'demonstration', 'test']);
export const stability = z.enum(['stable', 'volatile', 'tbd']);

export const factKind = z.enum([
  'goal',
  'actor',
  'system',
  'constraint',
  'data',
  'integration',
  'nfr',
  'assumption',
  'out_of_scope',
  'workflow_step',
  'decision',
]);

export const sectionKind = z.enum([
  'purpose',
  'scope',
  'overview',
  'definitions',
  'references',
  'functional',
  'performance',
  'usability',
  'interface',
  'data',
  'constraints',
  'attributes',
  'security',
  'verification',
  'assumptions',
  'open_questions',
  'coverage',
  'traceability',
]);

export const requirementSource = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('anchor'), ref: z.string().min(1) }),
  z.object({ kind: z.literal('fact'), ref: z.string().regex(/^FACT-\d+$/) }),
  z.object({ kind: z.literal('workflow'), ref: z.string().min(1) }),
  z.object({ kind: z.literal('derived'), ref: z.string().min(1), why: z.string().min(1) }),
]);
export type RequirementSource = z.infer<typeof requirementSource>;

/** What the skill sends to ledger.writeRequirements — no id yet; the service assigns it. */
export const requirementDraft = z.object({
  type: reqType,
  statement: z.string().min(1),
  rationale: z.string().min(1),
  source: z.array(requirementSource).min(1),
  priority,
  verification: verificationMethod,
  stability: stability.default('tbd'),
  stakeholders: z.array(z.string()).default([]),
  dependsOn: z.array(z.string()).default([]),
  openQuestion: z.string().optional().describe('Required when the statement contains TBD(...)'),
});
export type RequirementDraft = z.infer<typeof requirementDraft>;

export const requirementRow = requirementDraft.extend({
  id: z.string().regex(/^REQ-[A-Z]+-\d{3,}$/),
  runId: z.string().uuid(),
  sectionId: z.string(),
  origin: reqOrigin,
  status: reqStatus,
  revision: z.number().int().positive(),
  openQuestionId: z.string().nullable(),
});
export type RequirementRow = z.infer<typeof requirementRow>;

export const briefFactDraft = z.object({
  kind: factKind,
  text: z.string().min(1),
  anchors: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1),
});
export type BriefFactDraft = z.infer<typeof briefFactDraft>;

export const findingDraft = z.object({
  targetType: z.enum(['requirement', 'section', 'mapping', 'ingest', 'run']),
  targetId: z.string(),
  rule: z.string().min(1),
  severity: z.enum(['blocking', 'major', 'minor']),
  message: z.string().min(1),
  suggestedFix: z.string().optional(),
});
export type FindingDraft = z.infer<typeof findingDraft>;

export const controlMappingDraft = z.object({
  reqId: z.string(),
  controlId: z.string().regex(/^A\.[5-8]\.\d{1,2}$/),
  strength: z.enum(['satisfies', 'supports']),
  rationale: z.string().min(1),
});

export const typedOutcome = z
  .string()
  .regex(/^(ok|ok_with_findings|blocked:[a-z_]+|failed:[a-z_]+)$/);

export const reportedBy = z
  .string()
  .min(1)
  .describe('The Claude session user as reported by the skill. Self-reported, not verified.');
