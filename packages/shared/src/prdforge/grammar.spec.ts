import { describe, expect, it } from 'vitest';
import { checkStatement, tbdQuestion, type GrammarConfig } from './grammar.js';

const cfg: GrammarConfig = {
  bannedTerms: ['fast', 'user-friendly', 'support', 'etc', 'as needed', 'and/or'],
  forbiddenModals: ['will', 'should', 'must', 'may', 'can', 'could'],
  maxWords: 40,
};

const rules = (s: string) => checkStatement(s, cfg).map((v) => v.rule);

describe('grammar pre-check (AGENT_SPEC T8)', () => {
  it('accepts the rubric good examples', () => {
    expect(
      checkStatement(
        'When a user submits a loan application, the system shall persist the application record within 2 seconds at the 95th percentile.',
        cfg,
      ),
    ).toEqual([]);
    expect(
      checkStatement(
        'The system shall encrypt personal data at rest using AES-256 or an equivalent algorithm approved by the security team.',
        cfg,
      ),
    ).toEqual([]);
  });

  it('rejects the wrong modal and vague qualities', () => {
    const r = rules('The system should be fast and user-friendly.');
    expect(r).toContain('29148.conforming');
    expect(r).toContain('29148.unambiguous');
  });

  it('rejects two obligations in one statement', () => {
    expect(
      rules('The system shall allow upload and the system shall allow sharing of files.'),
    ).toContain('29148.singular');
  });

  it('rejects "support" as a verb', () => {
    expect(rules('The system shall support SSO.')).toContain('29148.unambiguous');
  });

  it('requires a unit on numbers but ignores identifiers', () => {
    expect(rules('The system shall lock an account after 5 failed attempts.')).toEqual([]);
    expect(rules('The system shall retain logs for 24.')).toContain('29148.verifiable');
    expect(rules('The system shall satisfy REQ-SEC-012 before release.')).toEqual([]);
  });

  it('requires a question with TBD', () => {
    expect(rules('The system shall respond within TBD.')).toContain('trace.tbd_without_question');
    expect(
      rules('The system shall respond within TBD(what latency does the brief require?).'),
    ).toEqual([]);
    expect(tbdQuestion('x TBD(what latency?) y')).toBe('what latency?');
  });

  it('rejects pronoun subjects', () => {
    expect(rules('It shall log every request with a timestamp.')).toContain('29148.unambiguous');
  });
});
