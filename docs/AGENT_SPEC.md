# AGENT_SPEC — `prdforge-ledger` (AgentBase-hosted service)

> One Precast/Mastra agent whose tools are deterministic. It does not reason: it stores, validates, slices, diffs, hashes and compiles. AgentBase hosts it (imported repo) and exposes its tools through its MCP bridge, which the 917ventures Claude workspace adds as an organisation connector with a static token. The thinking happens in the `prdforge` skill ([SKILL.md](SKILL.md)).

**Last updated:** 2026-10-29 · **Runtime:** Mastra (`apps/agents`), `crew.ts` with a single member · **Model:** a Mastra agent requires one; set the cheapest gateway model and keep `instructions` to "You are a tool router; call the requested tool and return its result verbatim." If AgentBase supports tool-only registration, prefer that and drop the model.

---

## 1 · prdforge-ledger — system of record

**Purpose:** Hold the canonical requirement ledger for every PRD run and guarantee that nothing enters it unvalidated, nothing leaves it unhashed, and every change is attributed.

### Abilities

| Ability                                                 | Built from                                    |
| ------------------------------------------------------- | --------------------------------------------- |
| **Keeping one run's state resumable**                   | T1–T4                                         |
| **Accepting only well-formed requirements**             | T8 + T9                                       |
| **Serving the rubrics and control catalogue in slices** | T15–T18                                       |
| **Detecting what humans changed in the Doc**            | T19–T21                                       |
| **Freezing an approved version with evidence**          | T22                                           |
| **Compiling and verifying the build bundle**            | T23–T25                                       |
| **Recording who did what**                              | universal (every write emits an `AuditEvent`) |

### Tools (all `[new]`, zod-typed in `packages/shared`, mirrored in DATA_MODEL.md)

| Tool                                                              | Input                                                            | Output                                  | Notes                                                                                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| T1 `run.create`                                                   | `{product, reported_by, parentRunId?}`                           | `PrdRun`                                | One active run per product lineage                                                                                                       |
| T2 `run.get`                                                      | `{runId}`                                                        | `PrdRun` + counts                       | Resume entry point                                                                                                                       |
| T3 `run.setState`                                                 | `{runId, stage, outcome?, reported_by}`                          | `PrdRun`                                | Stage transitions validated against the state machine                                                                                    |
| T4 `run.setDigest` / `run.setProfile`                             | `{runId, digest\|profile}`                                       | ok                                      | Digest capped at 3k tokens                                                                                                               |
| T5 `ledger.writeFacts`                                            | `{runId, facts[] ≤25, reported_by}`                              | `{ids[]}`                               | Anchors required                                                                                                                         |
| T6 `ledger.writeWorkflow`                                         | `{runId, flows[]}`                                               | `{id}`                                  |                                                                                                                                          |
| T7 `ledger.createSections`                                        | `{runId}`                                                        | `{sections[]}`                          | From `rubric.outline`                                                                                                                    |
| T8 `ledger.writeRequirements`                                     | `{runId, sectionId, requirements[] ≤15, reported_by}`            | `{ids[], rejected[{index, reasons[]}]}` | **Grammar pre-check**: single `shall`, no banned terms, numeric constraints carry units, `TBD(` implies a question, ≤40 words, ≥1 source |
| T9 `ledger.writeRevision`                                         | `{reqId, statement, origin, reported_by, docVersion?}`           | `{revisionId}`                          | Refuses agent-origin overwrite of human-origin text                                                                                      |
| T10 `ledger.writeSectionNarrative`                                | `{runId, sectionId, narrative, summary}`                         | ok                                      | ≤400 / ≤120 words                                                                                                                        |
| T11 `ledger.readSection`                                          | `{runId, sectionId, fields?}`                                    | `{section, requirements[]}`             | Slice reads only                                                                                                                         |
| T12 `ledger.writeMappings`                                        | `{runId, mappings[] ≤20}`                                        | `{ids[]}`                               |                                                                                                                                          |
| T13 `ledger.writeFindings`                                        | `{runId, findings[]}`                                            | `{ids[]}`                               | Rule IDs validated against the rubric                                                                                                    |
| T14 `ledger.writeDecision`                                        | `{runId, question, answer, reported_by, blocks[]}`               | `{id}`                                  | Clarifying answers                                                                                                                       |
| T15 `rubric.outline`                                              | `{}`                                                             | `{sections[]}`                          | From `rubrics/ieee29148.yaml`                                                                                                            |
| T16 `rubric.slice`                                                | `{sectionKind, reqTypes[]}`                                      | `{rules[]}`                             |                                                                                                                                          |
| T17 `controls.shortlist`                                          | `{profile}`                                                      | `{controls[]}`                          | Rule table in `rubrics/annex-a-2022.yaml`                                                                                                |
| T18 `controls.coverage`                                           | `{runId}`                                                        | `{statuses[]}`                          | Materialises `ControlStatus`; `not_applicable` needs a reason                                                                            |
| T19 `snapshot.write`                                              | `{runId, direction, docId, docVersion, blocks[], reconciled?}`   | `{id}`                                  | Rendered snapshots refused while the latest read is unreconciled                                                                         |
| T20 `snapshot.diff`                                               | `{runId, blocks[]}`                                              | `{changes[]}`                           | Structural diff vs last rendered snapshot; fuzzy REQ-ID recovery with similarity score                                                   |
| T21 `ledger.render`                                               | `{runId, sectionIds?}`                                           | `{blocks[], sectionHashes}`             | Deterministic Doc body from the ledger; includes approved claim strings                                                                  |
| T22 `approval.create`                                             | `{runId, docVersion, ledgerHash, reported_by, overrides[], pdf}` | `Approval`                              | Checks `ledgerHash` matches current; stores PDF                                                                                          |
| T23 `bundle.compile`                                              | `{approvalId}`                                                   | `Bundle`                                | Deterministic; no LLM                                                                                                                    |
| T24 `bundle.verify`                                               | `{bundleId}`                                                     | `{ok, mismatches[]}`                    | Parses YAML back, compares IDs/controls/acceptance                                                                                       |
| T25 `bundle.get`                                                  | `{bundleId, file?}`                                              | files                                   |                                                                                                                                          |
| T26 `ledger.summary` / `ledger.traceAudit` / `ledger.findSimilar` | `{runId…}`                                                       | reports                                 | Read-only helpers for the skill                                                                                                          |

### Guardrails

- **Never reasons.** No tool calls a model. If a request needs judgment, it returns data for the skill to judge.
- **Validation at the boundary.** T8 is the only way requirements enter; its pre-check is compiled from `rubrics/ieee29148.yaml` at boot.
- **Human text protected.** T9 enforces DATA_MODEL invariant 4; T19 enforces invariant 5.
- **Attribution.** Every write records `reported_by` as self-reported and the connector identity as the caller; neither is presented as verified.
- **Budget.** Per-run caps on requirement count, tool calls and repair passes; exceeding returns `blocked:budget` and refuses further writes until a human raises the cap via `run.setState`.
- **Secrets.** Only `DATABASE_URL` and the AgentBase-injected bearer; no Google, no vendor keys.

---

## 2. Exposure and auth

- Imported into AgentBase via `precast:deploy`; each tool becomes a skill on the listing; AgentBase's MCP bridge serves them.
- The 917ventures workspace Owner adds the bridge as an **organisation connector** with the **static token** AgentBase issues for the Application. All workspace members share it (decided — see PRD §8).
- Rate limits and payload sizes to confirm on the bridge: T5 batches (~25 facts ≈ 10–20 KB), T21 render output (whole Doc body, possibly 100 KB+ — paginate by section if limited), T25 bundle retrieval.

## 3. Memory & storage

No agent memory. All state in Postgres via Drizzle (`packages/shared`), `pgvector` for `BriefFact` / `Requirement` / `Control` embeddings (optional; `findSimilar` falls back to trigram similarity).

## 4. Evaluation

Service-level tests, independent of any model: grammar pre-check fixtures (accept/reject table from the rubric examples); snapshot diff fixtures (heading rename, REQ ID deletion, paragraph move); invariant tests for human-text protection and unreconciled-read refusal; bundle compile/verify round-trip on a seeded ledger; hash stability across identical ledgers.
