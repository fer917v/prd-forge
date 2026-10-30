# PRD — PRDForge (working name)

> Feed-forward planning doc. Companion docs: [SKILL.md](SKILL.md) (the Claude skill that does the work) · [AGENT_SPEC.md](AGENT_SPEC.md) (the AgentBase-hosted ledger service) · [DATA_MODEL.md](DATA_MODEL.md) · [NEXT_STEPS.md](NEXT_STEPS.md)

**Product:** PRDForge — brief-to-PRD system (IEEE 29148-aligned, ISO/IEC 27001:2022 Annex A-mapped)
**Author:** Fer (917 Ventures, PM&I) · drafted with Claude
**Status:** Draft v0.3 · **Last updated:** 2026-10-29

---

## 1. Problem

Product briefs arrive as decks, Word docs and whiteboard photos. Turning one into a PRD that (a) a reviewer will sign off and (b) a coding agent can build from takes a PM days, and the result rarely satisfies either reader: humans want narrative and rationale, coding agents want atomic, uniquely-identified, testable requirements with explicit traceability. Security requirements are usually bolted on late, if at all, and nobody can show which ISO 27001 controls a product's requirements actually address.

## 2. Goals

- Produce, from an uploaded brief plus workflow diagrams, a **human-readable PRD** whose structure follows the IEEE 29148 SRS information-item outline and whose requirements each satisfy the 29148 individual-requirement quality characteristics.
- Make every security-relevant requirement **cite the ISO/IEC 27001:2022 Annex A control(s)** it satisfies, generate the security requirements the brief is silent on, and emit a control coverage matrix with an explicit gap list.
- Let reviewers **edit the PRD directly as a Claude Doc** or **ask Claude to edit it**, with both paths reconciled into one canonical requirement ledger.
- On an explicit **approve**, freeze the PRD as v1.0 and compile a **coding-agent PRD bundle** (Markdown + YAML requirement objects + traceability index + Precast feed-forward doc drafts).
- Run as a **Claude skill in the 917ventures workspace (Cowork)** backed by a **ledger service hosted on AgentBase**, reached through an organisation-level MCP connector.

### Non-goals

- A bespoke UI. Cowork chat and Claude Docs are the surfaces.
- Google Drive/Docs integration. Briefs are uploaded in chat; outputs are Claude Docs and chat-delivered files.
- Reproducing IEEE or ISO text. Rubrics are derived; outputs cite identifiers only.
- Certifying 27001 compliance. Output is a mapping and gap analysis, not an audit opinion.
- Generating code, test suites, or the Precast scaffold itself (`precast:scaffold` is downstream).
- Reasoning inside the AgentBase service. It validates, stores, slices and compiles; Claude thinks.

## 3. Personas

| Persona                                                               | Need                                                                                                                                |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Product manager** (author)                                          | Upload a brief + diagrams in a Cowork session, get a reviewable PRD Doc the same day; iterate by prompting or by typing in the Doc. |
| **Reviewer / approver** (product lead, business sponsor)              | Read a conventional document, comment and edit where they like, say "approve" once.                                                 |
| **Security / compliance reviewer**                                    | See which Annex A controls are addressed, which are gaps, and why each security requirement exists.                                 |
| **Build agent operator** (dev using `precast:scaffold` / Claude Code) | Receive a bundle that needs no interpretation: stable REQ IDs, verification methods, data entities, agent roles.                    |

## 4. User journeys (happy path)

1. **Start.** PM opens a Claude Project for the product, attaches `brief.pptx` and `flow-*.png` in a Cowork session and says _"Generate a PRD."_ The `prdforge` skill creates a `PrdRun` in the ledger (via the AgentBase connector) and reads the files natively.
2. **Ingest.** Claude extracts anchored facts and per-diagram workflow models and writes them to the ledger in small batches; contradictions and gaps become open questions. If a mandatory section has too little to go on, Claude asks the PM a short set of questions before drafting and records each answer as a `Decision`.
3. **Draft.** Section by section in 29148 outline order, Claude writes requirement objects through the ledger's validating write tool (grammar pre-check, ≤15 per call): ID, `shall` statement, rationale, source anchor, priority, verification method, stability. Security requirements are added and mapped to Annex A controls; a coverage matrix is produced.
4. **Self-review.** A separate review pass scores each requirement and the set against the 29148 rubric; failures loop back once per section; residual findings go to the Doc's open-questions appendix, never dropped.
5. **Publish.** Claude renders the ledger into a **Claude Doc** in the Project (`PRD — <product> (draft)`), with REQ IDs as stable anchors and the coverage matrix as an appendix, then records a rendered snapshot and summarises the run with the open questions.
6. **Revise.** Reviewers edit the Doc directly or ask in chat: _"Make REQ-F-012 apply only to enterprise tenants."_ On every "sync" and before every re-render, Claude reads the Doc, diffs it against the last snapshot, reconciles human edits into the ledger (re-scoring only changed requirements), and re-renders only changed sections. Human text is never overwritten.
7. **Approve.** The approver says _"approve"_ in the session. Claude performs a final sync, exports the Doc to PDF, records an `Approval` with the ledger hash, the reporting user, the Doc version and the PDF, and the service compiles the **bundle**: `PRD.agent.md`, `requirements.yaml`, `controls.yaml`, `traceability.csv`, plus Precast-shaped `PRD.md`, `DATA_MODEL.md`, `AGENT_SPEC.md`. Claude delivers the files in chat and names the next step (`precast:scaffold` from `PRD.md`).

### Alternate paths

- **Thin brief.** Fewer than N anchorable facts for a mandatory section → section marked `TBD` with specific questions; PM told before publishing; nothing invented.
- **Human edit breaks a rule.** Ledger keeps the human text verbatim, rubric flags it, Claude proposes a split as a Doc comment; human text wins until accepted.
- **Approve with open findings.** Allowed; carried into the bundle as `KNOWN-ISSUES`.
- **New session days later.** The Project holds the Doc and the `runId`; the skill resumes any stage from the ledger.
- **Brief v2.** A child run inherits the ledger; unchanged requirements keep IDs, changed ones bump revision, removed ones are `withdrawn`.

## 5. Scope (v1)

- Chat-uploaded DOCX, PPTX, PDF, PNG/JPG; one product per Claude Project, one active run per product.
- Brief Model + Workflow Model extraction with source anchors, done by Claude natively.
- Requirement ledger on AgentBase (Postgres) as the system of record; the Claude Doc and the bundle are projections.
- 29148-aligned outline and attribute set; Annex A 2022 mapping with coverage matrix and generated security requirements (rubrics served by the ledger service).
- Rubric-driven self-review with one bounded repair loop per section.
- Claude Doc publish, sync, reconcile; chat-driven edits; chat `approve`; PDF export on approval.
- Bundle compile and round-trip verification in the service; files delivered in chat.
- Audit log on the service and typed run outcomes (`published`, `revised`, `approved`, `blocked:<reason>`, `failed:<stage>`).

Out of scope for v1: Drive/Docs integration, Jira/Linear export, multi-language output, org-specific ISMS overlays (v2 module), licensed standards retrieval, per-user connector credentials.

## 6. Success metrics

| Metric                                                      | Target                   |
| ----------------------------------------------------------- | ------------------------ |
| Time from "generate" to Doc, 30-page brief + 6 diagrams     | < 20 min of session time |
| Requirements passing the 29148 rubric on first publish      | > 90%                    |
| Human-edited requirements lost or overwritten by re-render  | 0                        |
| Security-relevant requirements with ≥1 Annex A citation     | 100%                     |
| Sections published as `TBD` without a stated question       | 0                        |
| Build agent clarifying questions traceable to PRD ambiguity | < 3 per project          |
| Reviewer edit round-trips before approve                    | median ≤ 2               |

## 7. Design constraints — long context

The brief, the rubrics, the control catalogue and the growing PRD will not fit one prompt. The skill treats the session context as a **working set** and the ledger as storage:

1. **Ledger, not context, holds the truth.** Every requirement, fact and finding is a row on the service; the skill reads slices through tools. The full PRD is never in context.
2. **Pinned digest + on-demand lookup.** A ≤3k-token Brief Digest stays in context; full passages are fetched by anchor only when a section needs them.
3. **Section-scoped work in dependency order,** each section seeing summaries of upstream sections, not bodies.
4. **Rubric slicing.** The service returns only the rules for the section and requirement types in hand; the catalogue lives in Postgres.
5. **Unit-complete writes.** ≤15 requirement objects per validating tool call; a stopped session never leaves a half-written object.
6. **Diff, don't re-read.** Doc reconciliation is structural (heading + REQ-ID anchors); only changed blocks are re-parsed and re-scored.
7. **Per-image extraction** with structured output, merged afterwards.
8. **Resumable from the ledger** at any stage; every step keyed by `(runId, stage, sectionId|docVersion)` so replays are no-ops.
9. **Budget envelope per run** on the service side (tool calls, requirement count, repair passes) with a typed `blocked:budget` outcome.

## 8. Identity and evidence (decided: static connector token + Doc-side provenance)

The AgentBase connector authenticates with one organisation-level token; the service therefore sees one caller. Identity is backfilled as follows: Claude passes the session user into every state-changing call as `reported_by` (self-reported, recorded as such); the Claude Doc's own version history, authenticated by the workspace, is the human provenance; on approval the Doc is exported to PDF and attached to the `Approval` alongside the ledger hash and Doc version. The "who" lives in the Doc, the "what" is hashed in the ledger.

## 9. Risks & open questions

- **Confidential briefs in Claude seats.** Owner decision on whether brief content may be processed in the 917ventures Claude workspace; same question as for any Cowork use of confidential material.
- **Claude Docs connector surface.** Design assumes read, structured update, batch, export (PDF/Word) and comments. Verify in a spike; if comments are unavailable, findings go to the open-questions appendix.
- **AgentBase MCP connector.** Confirmed to exist with a static token; confirm rate limits and payload size for `ledger.writeFacts` batches and bundle retrieval.
- **Self-reported identity** is weaker than OAuth; acceptable for v1 by decision. Revisit if approvals become contractually significant.
- **Session-boundedness.** Long runs may span sessions; the skill must never hold unsaved state. Mitigation: every stage writes before it returns a summary.
- **Vision extraction quality** on hand-drawn diagrams; confidence gating and open questions rather than invented requirements.
- **Service model formality.** A Mastra agent requires a model even when it never reasons; assign the cheapest gateway model or register tool-only if AgentBase supports it.

## 10. Traceability

- Skill behaviour → [SKILL.md](SKILL.md)
- Service tools and guardrails → [AGENT_SPEC.md](AGENT_SPEC.md)
- Data model → [DATA_MODEL.md](DATA_MODEL.md)
- UI/design language → none (Cowork + Claude Docs)
