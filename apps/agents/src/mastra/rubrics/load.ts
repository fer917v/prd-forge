import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { GrammarConfig } from '@precast/shared';

/**
 * The derived rubrics (rubrics/*.yaml at the repo root) are the only reference material the
 * service holds. They are 917V-authored paraphrases citing standard identifiers — never
 * standard text (rubrics/PROVENANCE.md). Loaded once per process.
 */

export interface OutlineSection {
  id: string;
  kind: string;
  title: string;
  order: number;
  mandatory: boolean;
  guidance?: string;
  reqTypes?: string[];
  appliesWhen?: string;
  maxWords?: number;
}

export interface RubricRule {
  id: string;
  name?: string;
  check: string;
  severity: 'blocking' | 'major' | 'minor';
}

export interface Ieee29148Rubric {
  version: string;
  outline: OutlineSection[];
  attributes: { name: string; rule: string; optional?: boolean }[];
  grammar: {
    pattern: string;
    modal: { required: string; forbidden: string[] };
    bannedTerms: Record<string, string[]>;
    lengthRule: string;
    examples: unknown;
  };
  individualCharacteristics: RubricRule[];
  setCharacteristics: RubricRule[];
  traceabilityRules: RubricRule[];
  repair: { maxPassesPerSection: number; blockingRules: string[] };
}

export interface ControlEntry {
  id: string;
  theme: string;
  shortName: string;
  summary: string;
  triggers: string[];
  relevance: 'high' | 'medium' | 'low';
  pattern: string | null;
}

export interface AnnexARubric {
  version: string;
  controls: ControlEntry[];
  rules: Record<string, string[]>;
  notApplicableDefaults: { id: string; reason: string }[];
}

const here = dirname(fileURLToPath(import.meta.url));

function rubricsDir(): string {
  // Built bundle (apps/agents/.mastra/output) and source (apps/agents/src/mastra/rubrics)
  // both sit under apps/agents; the repo root is the first ancestor holding rubrics/.
  const override = process.env.PRDFORGE_RUBRICS_DIR;
  if (override) return override;
  let dir = here;
  for (let i = 0; i < 8; i++) {
    try {
      readFileSync(resolve(dir, 'rubrics/ieee29148.yaml'));
      return resolve(dir, 'rubrics');
    } catch {
      dir = dirname(dir);
    }
  }
  return resolve(process.cwd(), 'rubrics');
}

let ieee: Ieee29148Rubric | undefined;
let annex: AnnexARubric | undefined;

export function loadIeee29148(): Ieee29148Rubric {
  ieee ??= parse(readFileSync(resolve(rubricsDir(), 'ieee29148.yaml'), 'utf8')) as Ieee29148Rubric;
  return ieee;
}

export function loadAnnexA(): AnnexARubric {
  annex ??= parse(readFileSync(resolve(rubricsDir(), 'annex-a-2022.yaml'), 'utf8')) as AnnexARubric;
  return annex;
}

/** The grammar pre-check config compiled from the rubric (AGENT_SPEC T8). */
export function grammarConfig(): GrammarConfig {
  const g = loadIeee29148().grammar;
  const banned = Object.values(g.bannedTerms)
    .flat()
    .map((t) => t.replace(/\s*\(.*\)$/, '').trim())
    .filter((t) => t && t !== 'and/or');
  return { bannedTerms: banned, forbiddenModals: g.modal.forbidden, maxWords: 40 };
}

/** Rule ids the reviewer may cite — a finding naming an unknown rule is refused (T13). */
export function knownRuleIds(): Set<string> {
  const r = loadIeee29148();
  return new Set(
    [...r.individualCharacteristics, ...r.setCharacteristics, ...r.traceabilityRules]
      .map((x) => x.id)
      .concat([
        'annexa.unmapped_applicable',
        'annexa.weak_mapping',
        'ingest.contradiction',
        'ingest.undefined_actor',
        'ingest.low_confidence',
      ]),
  );
}
