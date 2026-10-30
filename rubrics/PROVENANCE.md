# Rubric provenance

The files in this folder are 917 Ventures-authored working material. They are **not** copies of, and do not contain text from, ISO/IEC/IEEE 29148:2018 or ISO/IEC 27001:2022. They cite clause and control identifiers so readers who hold licensed copies can look them up.

| File                | Derived from                                                                                                        | Method                                                                                                                                                                                                                                             | Status                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `ieee29148.yaml`    | Public structure of the 29148 SRS information item and the widely published requirement/set quality characteristics | Rewritten as operational check questions, grammar rules and a banned-term list in PRDForge's own vocabulary; outline IDs are PRDForge's, not the standard's clause numbers                                                                         | Draft v0.1 — awaiting legal and PM&I review     |
| `annex-a-2022.yaml` | Public list of the 93 Annex A control identifiers and themes                                                        | Each control given a one-line intent paraphrase framed as product-requirement guidance, a trigger tag set, a relevance rating for software PRDs and a requirement _shape_; applicability rules and not-applicable defaults are PRDForge heuristics | Draft v0.1 — awaiting legal and security review |

## Rules for maintainers

1. Never paste standard text into these files, into prompts, or into generated PRDs. If a paraphrase drifts toward the source wording, rewrite it.
2. `pattern` values are shapes for the drafting agent; the agent must always produce product-specific statements. Emitting a pattern verbatim is a `29148.correct` failure.
3. Changes bump `version` and are recorded below with reviewer and date.
4. Output PRDs cite identifiers in the form `IEEE 29148` (document-level alignment claim only) and `ISO/IEC 27001:2022 A.n.m`.
5. The mapping and coverage matrix are an analysis aid, not a conformity statement. Generated PRDs carry a footer saying so.

## Review log

| Version | Date       | Change            | Reviewer    |
| ------- | ---------- | ----------------- | ----------- |
| 0.1     | 2026-10-28 | Initial authoring | — (pending) |

## Seeding

`annex-a-2022.yaml` → `Control` table (see DATA_MODEL.md). `rules` and `notApplicableDefaults` are loaded by security-mapper at start-up. `ieee29148.yaml` → served by `rubric.slice`; `outline` creates `Section` rows per run; `grammar.bannedTerms` is compiled into the `ledger.writeRequirements` pre-check.
