/**
 * The statement grammar pre-check behind ledger.writeRequirements (AGENT_SPEC T8).
 * Pure and config-driven: the banned-term lists come from rubrics/ieee29148.yaml at
 * boot (see apps/agents/src/mastra/rubrics/load.ts); this module never reads a file.
 * Rule ids match the Finding rule ids in that rubric so a rejection reads like a finding.
 */

export interface GrammarConfig {
  bannedTerms: string[];
  forbiddenModals: string[];
  maxWords: number;
}

export interface GrammarViolation {
  rule: string;
  message: string;
}

export const DEFAULT_GRAMMAR: GrammarConfig = {
  bannedTerms: [],
  forbiddenModals: ['will', 'should', 'must', 'may', 'can', 'could'],
  maxWords: 40,
};

const COMPARATOR_BEFORE_NUMBER =
  /\b(?:within|at least|at most|no more than|up to|after|before|every|per|under|over|exceeds?|below|above)\s+\d|[≤≥<>]\s*\d/i;
const UNITS =
  '%|ms|s|sec|seconds?|min|minutes?|h|hours?|days?|weeks?|months?|years?|kb|mb|gb|tb|rps|tps|req|requests?|users?|records?|items?|px|mm|cm|m|km|kg|g|°c|°f|x|times|per|concurrent|characters?|chars?|digits?|attempts?|retries|bits?|bytes?|percent|percentile|tenants?|files?|rows?|calls?';
const NUMBER_WITH_UNIT = new RegExp(
  `\\b\\d+(?:[.,]\\d+)?(?:th|st|nd|rd)?(?:\\s+[A-Za-z-]+){0,2}\\s*(?:${UNITS})\\b`,
  'i',
);
const NUMBER = /(?<![A-Za-z.\-\d])\d+(?:[.,]\d+)?(?![A-Za-z\-\d]|[.,]\d)/;
const ID_LIKE = /\b(?:REQ|FACT|OQ|DEC|SEC|A)[-.][A-Z0-9.-]+/g;
const TBD_WITH_QUESTION = /TBD\(([^)]+)\)/;

export function checkStatement(
  statement: string,
  cfg: GrammarConfig = DEFAULT_GRAMMAR,
): GrammarViolation[] {
  const v: GrammarViolation[] = [];
  const s = statement.trim();
  const lower = s.toLowerCase();
  const words = s.split(/\s+/).filter(Boolean);

  const shallCount = (lower.match(/\bshall\b/g) ?? []).length;
  if (shallCount === 0) v.push({ rule: '29148.conforming', message: 'Statement has no "shall".' });
  if (shallCount > 1)
    v.push({
      rule: '29148.singular',
      message: `Statement has ${shallCount} "shall" clauses; split it.`,
    });

  for (const modal of cfg.forbiddenModals) {
    if (new RegExp(`\\b${modal}\\b`, 'i').test(s))
      v.push({
        rule: '29148.conforming',
        message: `Modal "${modal}" is not allowed in a statement; use "shall" and express priority in the priority field.`,
      });
  }

  if (/\b(and\/or)\b/i.test(s))
    v.push({ rule: '29148.unambiguous', message: '"and/or" is ambiguous.' });

  for (const term of cfg.bannedTerms) {
    const re = new RegExp(`(^|[^A-Za-z-])${escapeRegex(term)}(?=$|[^A-Za-z-])`, 'i');
    if (re.test(s))
      v.push({
        rule: '29148.unambiguous',
        message: `Banned term "${term}" — state a measurable constraint instead.`,
      });
  }

  if (/\bTBD\b/.test(s) && !TBD_WITH_QUESTION.test(s))
    v.push({
      rule: 'trace.tbd_without_question',
      message: 'Bare TBD; write TBD(<specific question>).',
    });

  const noIds = s.replace(ID_LIKE, '');
  if (NUMBER.test(noIds) && !NUMBER_WITH_UNIT.test(noIds) && !COMPARATOR_BEFORE_NUMBER.test(noIds))
    v.push({ rule: '29148.verifiable', message: 'A number appears without a unit or comparator.' });

  if (words.length > cfg.maxWords)
    v.push({
      rule: '29148.singular',
      message: `${words.length} words (max ${cfg.maxWords}); long statements are usually compound.`,
    });

  if (/^\s*(it|the solution|we)\b/i.test(s))
    v.push({
      rule: '29148.unambiguous',
      message: 'Subject must be the system or a named component, not "it", "the solution" or "we".',
    });

  return v;
}

export function tbdQuestion(statement: string): string | null {
  const m = TBD_WITH_QUESTION.exec(statement);
  return m ? m[1].trim() : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
