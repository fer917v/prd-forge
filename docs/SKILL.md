# SKILL — `prdforge` (Claude skill, 917ventures workspace)

> Purpose → abilities → functions format. This is the specification of the skill; the shippable `SKILL.md` + reference files are produced from it in NEXT_STEPS §3. Runs in Cowork; uses Claude's native file reading, the Claude Docs connector, and the `prdforge-ledger` MCP tools served from AgentBase (see [AGENT_SPEC.md](AGENT_SPEC.md)).

**Last updated:** 2026-10-29 · **Trigger:** "generate a PRD", "PRDForge", "sync the PRD", "approve the PRD", "compile the PRD bundle", or an attached brief with a request for requirements.

---

## 0. Universal rules

1. **No fabrication.** Every requirement carries a `source` anchor or `derived(<control>, why)`. Unanchorable claims become open questions.
2. **Ledger is truth.** The skill never keeps the PRD in context or in the Doc alone; it reads and writes rows via `ledger.*` tools and treats the Doc as a projection.
3. **Human text wins.** Human-edited requirements are stored verbatim; the skill proposes via Doc comments, never overwrites.
4. **Unit-complete work.** ≤25 facts or ≤15 requirements per write; one section per drafting step; a step writes before it reports.
5. **Typed outcome per step:** `ok`, `ok_with_findings`, `blocked:<reason>`, `failed:<stage>`, recorded with `run.setState` and summarised to the user.
6. **Standards hygiene.** Cite identifiers only; never reproduce standard text; rubrics come from `rubric.slice`, never from memory.
7. **Context discipline.** Pinned Brief Digest ≤3k tokens; passages via `brief.lookup`; rubric slices per section; one image per extraction step.
8. **Identity.** Every state-changing call passes `reported_by` = the session user; the skill never claims this is verified.
9. **Resumability.** Start every invocation with `run.get`; continue from the recorded stage; never redo completed units.
10. **Budget.** Honour `blocked:budget` from the service; leave the Doc consistent with a status banner.

---

## 1 · Starting and resuming a run

**Purpose:** Bind the session to one `PrdRun` and pick up exactly where the ledger says we are.

| Ability                                    | Built from |
| ------------------------------------------ | ---------- |
| **Starting a PRD run from uploaded files** | F1 + F2    |
| **Resuming a run in a new session**        | F3         |
| **Reporting where things stand**           | F4         |

- **F1 — Intent routing** [new]: classify the request (`generate | sync | edit | status | approve | compile | help`) and extract targets (REQ IDs, section names). Mechanism: Claude. Ladder: ambiguous → ask one question.
- **F2 — Run creation** [new]: `run.create{product, reported_by}`; store `runId` in the Project's working notes and the Doc header. Mechanism: `prdforge-ledger` MCP. Ladder: connector unreachable → `blocked:ledger_unreachable`, nothing proceeds.
- **F3 — Resume** [new]: `run.get{runId}` (from Project notes or the Doc header) → continue at `stage`. Mechanism: MCP.
- **F4 — Status** [new]: counts, open questions, Doc link, last outcome. Mechanism: `run.get` + `ledger.summary`.

---

## 2 · Reading the brief and diagrams

**Purpose:** Convert the uploads into an anchored Brief Model and Workflow Model the rest of the skill can cite.

| Ability                                              | Built from |
| ---------------------------------------------------- | ---------- |
| **Reading the brief whatever format it came in**     | F1 + F2    |
| **Reading the workflow diagrams**                    | F3 + F4    |
| **Building the Brief Digest and glossary**           | F5         |
| **Spotting contradictions and gaps before drafting** | F6         |
| **Asking the PM what the brief doesn't say**         | F7         |

- **F1 — Document reading** [built]: Claude reads DOCX/PPTX/PDF natively (slide notes included); scanned PDFs via OCR in the session sandbox. Anchors `src:<file>:<block>` assigned per paragraph/slide. Ladder: unreadable file → ask for re-export.
- **F2 — Fact extraction** [new]: `BriefFact` rows (`goal|actor|system|constraint|data|integration|nfr|assumption|out_of_scope`) with anchors and confidence, written via `ledger.writeFacts` ≤25 per call. Mechanism: Claude + MCP.
- **F3 — Diagram extraction** [built]: one image per step, structured output `{actors, steps, decisions, dataStores, systems, edges, confidence}`. Mechanism: Claude vision. Ladder: confidence < 0.6 → flow recorded with a finding and an open question, not as requirements.
- **F4 — Workflow merge** [new]: unify per-image extractions into `WorkflowModel`; link steps to brief facts; `ledger.writeWorkflow`. Mechanism: Claude + MCP.
- **F5 — Digest & glossary** [new]: ≤3k-token digest stored with `run.setDigest`; regenerated only when facts change.
- **F6 — Consistency pre-check** [new]: brief-vs-diagram contradictions, undefined actors/systems, flows without goals → `ledger.writeFindings(kind: ingest)` and `OpenQuestion` rows.
- **F7 — Clarifying questions** [new]: when a mandatory section has < threshold facts, ask the PM up to 10 targeted questions (multiple-choice where possible) and record each answer with `ledger.writeDecision{question, answer, reported_by}`. Ladder: PM declines → proceed with `TBD(...)`.

---

## 3 · Drafting the PRD

**Purpose:** Write the PRD section by section as atomic, attributed requirement objects following the 29148 outline and grammar.

| Ability                                          | Built from             |
| ------------------------------------------------ | ---------------------- |
| **Laying out the PRD in standard order**         | F1                     |
| **Writing one section at a time from the facts** | F2 + F3 + F4           |
| **Keeping requirements atomic and testable**     | F5 (service pre-check) |
| **Carrying the narrative humans need**           | F6                     |
| **Fixing what the review flagged**               | F7                     |

- **F1 — Outline instantiation** [new]: `rubric.outline` → `Section` rows via `ledger.createSections`.
- **F2 — Section context assembly** [new]: digest + `brief.search{kinds}` facts + upstream section summaries + `rubric.slice{sectionKind, reqTypes}`; token-budgeted with ranked truncation. Mechanism: MCP + Claude.
- **F3 — Requirement drafting** [new]: emit requirement objects via `ledger.writeRequirements` (≤15; zod + grammar pre-check on the service; rejected objects come back with reasons and are fixed before moving on). Mechanism: Claude + MCP.
- **F4 — Workflow-to-requirement derivation** [new]: each workflow step/decision → functional + interface requirements + implied data entities, step ID as anchor.
- **F5 — Grammar conformance** [built on service]: singularity, banned terms, units, modal — enforced by the service pre-check; the skill never bypasses it.
- **F6 — Narrative blocks** [new]: purpose, scope, overview, assumptions as `Section.narrative` ≤400 words, anchored; `ledger.writeSectionNarrative`.
- **F7 — Targeted repair** [new]: given findings, rewrite only cited requirements; one pass per section; residuals stay visible.

---

## 4 · Security mapping

**Purpose:** Ensure the requirement set addresses the Annex A controls the product's data, actors and integrations make applicable, and show coverage.

| Ability                                                | Built from |
| ------------------------------------------------------ | ---------- |
| **Working out which controls apply**                   | F1 + F2    |
| **Mapping requirements to controls**                   | F3         |
| **Writing the security requirements the brief forgot** | F4 + F5    |
| **Showing coverage and gaps**                          | F6         |

- **F1 — Applicability profile** [new]: from digest + facts → `{dataClasses, actors, surfaces, integrations, jurisdictions}`; stored with `run.setProfile`.
- **F2 — Control shortlist** [built on service]: `controls.shortlist{profile}` returns applicable controls via the rule table in `rubrics/annex-a-2022.yaml`.
- **F3 — Requirement→control mapping** [new]: `ledger.writeMappings` ≤20 per call with `strength` and rationale.
- **F4 — Gap-driven requirement generation** [new]: for applicable controls with no `satisfies` mapping, draft product-specific `REQ-SEC-nnn` (never the catalogue pattern verbatim) with `source: derived(A.x.y, why)`.
- **F5 — Secure-SDLC set** [new]: A.8.25–A.8.29, A.8.31, A.8.33 as verifiable requirements for every software product.
- **F6 — Coverage matrix** [built on service]: `controls.coverage{runId}` computes `satisfied|supported|gap|not_applicable(reason)`; the skill never marks `not_applicable` without a reason.

---

## 5 · Reviewing

**Purpose:** Score every requirement and the set against the rubric, independently of the drafting pass, and emit actionable findings.

| Ability                                           | Built from |
| ------------------------------------------------- | ---------- |
| **Checking each requirement is well-formed**      | F1         |
| **Checking the set hangs together**               | F2 + F3    |
| **Checking security mapping honesty**             | F4         |
| **Telling the drafting step exactly what to fix** | F5         |

- **F1 — Individual scoring** [new]: nine characteristics per requirement, ≤20 per step, reason per failure. Run as a fresh step with only the rubric slice and the section in context (no drafting rationale) to keep it independent.
- **F2 — Set-level checks** [new]: completeness vs outline, consistency (`ledger.findSimilar` candidates + pairwise check), feasibility, comprehensibility, validatability.
- **F3 — Traceability audit** [built on service]: `ledger.traceAudit{runId}` returns requirements without sources, steps without requirements, `TBD` without questions.
- **F4 — Mapping audit** [new]: sample-check rationales; flag unmapped applicable controls lacking a reason.
- **F5 — Finding emission** [new]: `ledger.writeFindings` with rule IDs from the rubric; `blocking` only for singularity, verifiability, missing source, missing verification.

---

## 6 · Publishing and syncing the Claude Doc

**Purpose:** Keep the human PRD as a Claude Doc and the ledger in agreement, in both directions, without losing a human edit.

| Ability                                             | Built from |
| --------------------------------------------------- | ---------- |
| **Publishing the PRD as a readable Doc**            | F1 + F2    |
| **Noticing what humans changed**                    | F3 + F4    |
| **Folding human edits back into the ledger**        | F5 + F6    |
| **Making the edits the reviewer asked for in chat** | F7         |

- **F1 — Doc rendering** [new]: `ledger.render{runId}` returns the Doc body as Markdown blocks (deterministic template: title block with `runId`, status banner, outline headings, requirement blocks `**REQ-F-012** · Must · Test` + statement + rationale, appendices: open questions, coverage matrix, traceability, approved claim footer). Claude creates/updates the Doc via the Claude Docs connector (batch update). Then `snapshot.write{direction: rendered, docId, docVersion, blocks}`. Mechanism: MCP + Claude Docs. Ladder: connector batch limits → section-by-section updates.
- **F2 — Incremental re-render** [new]: only sections whose ledger hash changed since the last rendered snapshot; the Doc version from the connector is the optimistic lock; abort and re-sync if it moved.
- **F3 — Read & structural diff** [new]: read the Doc, normalise to blocks keyed by heading path + REQ ID, `snapshot.diff` against the last rendered snapshot → `unchanged|human_edited|human_added|human_deleted`. Mechanism: Claude Docs read + MCP.
- **F4 — Anchor recovery** [new]: mangled REQ ID → fuzzy match ≥0.85 else treat as add+delete and ask.
- **F5 — Reconciliation** [new]: human edits → `ledger.writeRevision{origin: human}`; additions → provisional requirements `needs_structuring`; deletions → `withdrawn(by human)`; Doc comments → open questions or decisions. Then `snapshot.write{direction: read, reconciled: true}`.
- **F6 — Post-edit re-scoring** [new]: §5 F1 and §4 F3 on changed requirements only; new findings posted as Doc comments anchored to the requirement. Ladder: no comments in connector → open-questions appendix.
- **F7 — Chat-driven edits** [new]: resolve targets, apply via §3 F7 with the instruction as the finding, `ledger.writeRevision{origin: agent_on_request, reported_by}`, re-render affected sections, reply with before/after.

**Invariant:** never render while the latest read snapshot is unreconciled; never write outside the run's Doc.

---

## 7 · Approving and compiling

**Purpose:** Freeze an approved version with its evidence and hand a build-ready bundle to the next step.

| Ability                                | Built from |
| -------------------------------------- | ---------- |
| **Freezing an approved version**       | F1 + F2    |
| **Emitting the agent-readable bundle** | F3 + F4    |
| **Proving nothing was lost**           | F5         |

- **F1 — Final sync** [new]: §6 F3–F5; refuse approval while unreconciled or `blocking` findings exist unless the user says "approve anyway" (recorded as overrides).
- **F2 — Approval record** [new]: export the Doc to PDF via the connector; `approval.create{runId, docVersion, ledgerHash, reported_by, overrides[], pdf}`; update the Doc banner to Approved v1.0 with hash, version and date. Mechanism: Claude Docs export + MCP.
- **F3 — Compile** [built on service]: `bundle.compile{approvalId}` builds `PRD.agent.md` (≤8k-token chapters + index), `requirements.yaml`, `controls.yaml`, `traceability.csv`, and Precast-shaped `PRD.md`, `DATA_MODEL.md`, `AGENT_SPEC.md` drafts. Deterministic, no LLM.
- **F4 — Delivery** [new]: fetch bundle files via `bundle.get` and deliver them in chat; name the next step (`precast:scaffold` from `PRD.md`).
- **F5 — Round-trip verification** [built on service]: `bundle.verify` compares emitted YAML to the ledger; mismatch → `failed:compile_verify`, nothing delivered.

---

## 8. Reference files shipped with the skill

- `references/outline.md` — the 18-section outline with guidance (mirror of `rubric.outline`; the service is authoritative).
- `references/grammar.md` — statement grammar, banned terms, good/bad examples.
- `references/doc-template.md` — the Doc layout and the approved claim strings.
- `references/tool-map.md` — every `prdforge-ledger` tool with its zod signature.
- `references/golden-run.md` — a worked example run transcript for calibration.

## 9. Evaluation

Same gates as before, now as skill evals over the five golden briefs: `rubric_pass_rate ≥ 0.9`, `human_edit_preserved = 1.0` (scripted Doc edits), `security_citation_coverage = 1.0`, `bundle_roundtrip = 1.0`, plus `resume_from_any_stage = pass`.
