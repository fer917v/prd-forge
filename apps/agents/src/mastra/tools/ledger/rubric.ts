import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { sectionKind } from '@precast/shared';
import { getLedgerDb, schema } from '../../db/client';
import { loadAnnexA, loadIeee29148 } from '../../rubrics/load';
import { audit } from './common';

/** T15–T17 — the rubrics, served in slices so the skill never loads a catalogue whole. */

export const rubricOutline = createTool({
  id: 'rubric_outline',
  description:
    'T15 — The 18-section PRD outline (IEEE 29148-derived) in drafting order, with per-section guidance.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    version: z.string(),
    sections: z.array(
      z.object({
        id: z.string(),
        kind: z.string(),
        title: z.string(),
        order: z.number(),
        mandatory: z.boolean(),
        guidance: z.string().optional(),
        reqTypes: z.array(z.string()).optional(),
        appliesWhen: z.string().optional(),
      }),
    ),
  }),
  execute: async () => {
    const r = loadIeee29148();
    return {
      version: String(r.version),
      sections: r.outline.map((s) => ({ ...s, guidance: s.guidance?.trim() })),
    };
  },
});

export const rubricSlice = createTool({
  id: 'rubric_slice',
  description:
    'T16 — Only the rules relevant to one section: the grammar, the attribute list, the individual characteristics, and the set characteristics that apply at that point. Call it per section instead of memorising the rubric.',
  inputSchema: z.object({
    sectionKind,
    reqTypes: z.array(z.string()).default([]),
  }),
  outputSchema: z.object({
    section: z
      .object({
        id: z.string(),
        title: z.string(),
        guidance: z.string().optional(),
        maxWords: z.number().optional(),
      })
      .nullable(),
    grammar: z.object({
      pattern: z.string(),
      requiredModal: z.string(),
      bannedTerms: z.array(z.string()),
      lengthRule: z.string(),
    }),
    attributes: z.array(
      z.object({ name: z.string(), rule: z.string(), optional: z.boolean().optional() }),
    ),
    rules: z.array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        check: z.string(),
        severity: z.string(),
      }),
    ),
    blockingRules: z.array(z.string()),
    repairPassesPerSection: z.number(),
  }),
  execute: async ({ sectionKind: kind }) => {
    const r = loadIeee29148();
    const s = r.outline.find((o) => o.kind === kind) ?? null;
    const narrativeKinds = new Set([
      'purpose',
      'scope',
      'overview',
      'definitions',
      'references',
      'assumptions',
    ]);
    const rules = narrativeKinds.has(kind)
      ? r.setCharacteristics.filter(
          (x) => x.id.endsWith('comprehensible') || x.id.endsWith('complete'),
        )
      : [...r.individualCharacteristics, ...r.traceabilityRules];
    return {
      section: s
        ? { id: s.id, title: s.title, guidance: s.guidance?.trim(), maxWords: s.maxWords }
        : null,
      grammar: {
        pattern: r.grammar.pattern,
        requiredModal: r.grammar.modal.required,
        bannedTerms: Object.values(r.grammar.bannedTerms).flat(),
        lengthRule: r.grammar.lengthRule,
      },
      attributes: r.attributes,
      rules,
      blockingRules: r.repair.blockingRules,
      repairPassesPerSection: r.repair.maxPassesPerSection,
    };
  },
});

export const controlsShortlist = createTool({
  id: 'controls_shortlist',
  description:
    'T17 — The ISO/IEC 27001:2022 Annex A controls that apply to a product profile, from the deterministic rule table (profile tags → controls), with each control’s intent paraphrase, relevance and requirement shape. `software` and `always` are implied.',
  inputSchema: z.object({
    tags: z.array(z.string()).describe('Trigger tags, e.g. ["pii","auth","cloud","integration"]'),
  }),
  outputSchema: z.object({
    applicable: z.array(
      z.object({
        id: z.string(),
        shortName: z.string(),
        theme: z.string(),
        summary: z.string(),
        relevance: z.string(),
        pattern: z.string().nullable(),
        because: z.array(z.string()),
      }),
    ),
    notApplicableDefaults: z.array(z.object({ id: z.string(), reason: z.string() })),
    unknownTags: z.array(z.string()),
  }),
  execute: async ({ tags }) => {
    const a = loadAnnexA();
    const wanted = new Set(['software', 'always', ...tags]);
    const because = new Map<string, string[]>();
    const unknownTags: string[] = [];
    for (const t of wanted) {
      const ids = a.rules[t];
      if (!ids) {
        if (!['software', 'always'].includes(t)) unknownTags.push(t);
        continue;
      }
      for (const id of ids) because.set(id, [...(because.get(id) ?? []), t]);
    }
    const byId = new Map(a.controls.map((c) => [c.id, c]));
    const applicable = [...because.entries()]
      .map(([id, why]) => ({ c: byId.get(id)!, why }))
      .filter((x) => x.c)
      .sort((x, y) => x.c.id.localeCompare(y.c.id, undefined, { numeric: true }))
      .map(({ c, why }) => ({
        id: c.id,
        shortName: c.shortName,
        theme: c.theme,
        summary: c.summary,
        relevance: c.relevance,
        pattern: c.pattern ?? null,
        because: why,
      }));
    const applicableIds = new Set(applicable.map((x) => x.id));
    return {
      applicable,
      notApplicableDefaults: a.notApplicableDefaults.filter((d) => !applicableIds.has(d.id)),
      unknownTags,
    };
  },
});

export const ledgerCreateSections = createTool({
  id: 'ledger_create_sections',
  description: 'T7 — Instantiate the outline as Section rows for a run (idempotent).',
  inputSchema: z.object({ runId: z.string().uuid() }),
  outputSchema: z.object({
    created: z.number(),
    sections: z.array(
      z.object({ id: z.string(), kind: z.string(), title: z.string(), order: z.number() }),
    ),
  }),
  execute: async ({ runId }) => {
    const db = getLedgerDb();
    const r = loadIeee29148();
    const rows = r.outline.map((s) => ({
      runId,
      id: s.id,
      kind: s.kind,
      order: s.order,
      mandatory: s.mandatory,
      title: s.title,
    }));
    const inserted = await db
      .insert(schema.section)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: schema.section.id });
    await audit('ledger:create_sections', { runId, refs: { created: inserted.length } });
    return {
      created: inserted.length,
      sections: rows.map(({ id, kind, title, order }) => ({ id, kind, title, order })),
    };
  },
});
