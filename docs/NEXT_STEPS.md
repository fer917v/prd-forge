# NEXT_STEPS — PRDForge

**Status:** v0.3 · 2026-10-29 · Companion to [PRD.md](PRD.md), [SKILL.md](SKILL.md), [AGENT_SPEC.md](AGENT_SPEC.md), [DATA_MODEL.md](DATA_MODEL.md), `rubrics/`

Architecture as decided: Claude (Cowork, 917ventures workspace) is the brain and GUI via the `prdforge` skill; AgentBase hosts the deterministic `prdforge-ledger` service, reached through an organisation-level MCP connector with a static token; identity is self-reported plus Claude Doc provenance (option 2). Items marked **(legal)** are for counsel; this is a work plan, not legal advice.

---

## 0. Open decisions

| #   | Decision                                                                                                     | Default if unanswered     |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------- |
| D1  | Confidential briefs may be processed in the 917ventures Claude workspace (Owner decision).                   | Blocks pilot; no default  |
| D2  | Approver policy: anyone in the workspace, or a named list checked by the skill (self-reported, so advisory). | Anyone, recorded          |
| D3  | Service model: cheapest gateway model as a formality, or tool-only registration if AgentBase supports it.    | Cheapest gateway model    |
| D4  | Who supplies briefs and who approves (tightens personas and D2).                                             | Generic PM / product lead |

Closed: Workspace MCP (dropped), gateway models for reasoning (none), OAuth (dropped), Drive inputs (dropped).

## 1. Legal and IP

1. **Rubric paraphrase sign-off (legal).** Send `rubrics/ieee29148.yaml`, `rubrics/annex-a-2022.yaml`, `rubrics/PROVENANCE.md` to counsel: independent paraphrases citing identifiers, or reproduction? Record the answer in the PROVENANCE review log. Rewrite flagged lines; never drop a control.
2. **Output claim wording (legal).** Approve the strings the service renders in the Doc footer and the skill uses in chat. Proposed: "Structured in alignment with ISO/IEC/IEEE 29148:2018." and "Requirements are mapped to ISO/IEC 27001:2022 Annex A controls as an analysis aid; this is not a conformity assessment." Never "compliant" or "certified". Store in `rubrics/CLAIMS.md`; the service serves them via `ledger.render`.
3. **Standards licensing (legal, optional).** Only if retrieval over real standard text is wanted later; multi-user licence plus explicit licensor answer on internal indexing. Nothing in v1 depends on it.
4. **Data protection.** Privacy impact assessment covering two processors: the Claude workspace (session content) and AgentBase (ledger). Confirm each is covered by existing processing terms (Anthropic commercial terms for the workspace; Globe/917V terms for AgentBase). Set ledger retention (proposed 24 months after approval, then purge `BriefFact` and `SourceDocument.blocks`, keep `Requirement` tombstones and `Approval` PDFs). Check regulator registration applicability (NPC for Philippine personal data).
5. **Authorisation to process.** Written confirmation that brief owners have authorised AI processing on both platforms.
6. **Open-source hygiene.** Licences of shipped parsers in `TECH_STACK.md`; SBOM in CI from the first release.

## 2. AgentBase connector and skill publication

### 2a. Service exposure (AgentBase team)

1. Confirm the MCP bridge serves every skill (tool) of an imported agent, with a **static Application token** usable from claude.ai's custom-connector settings (internet-reachable HTTPS, Streamable HTTP).
2. Confirm limits: request payload ≥ 64 KB (fact batches), response payload ≥ 256 KB or pagination (`ledger.render` whole-Doc output, `bundle.get`), rate limit ≥ 60 calls/min per token (a drafting pass makes several calls per section).
3. Confirm D3: whether a tool-only listing exists; otherwise the agent carries a nominal model.

### 2b. Workspace connector (you, as Owner)

1. Claude admin settings → connectors → add the AgentBase MCP endpoint as an **organisation connector** with the static token; enable it for the members who will run PRDForge.
2. Record the connector name; the skill's `references/tool-map.md` must use the exact tool names the bridge exposes (prefixing may apply).
3. Spike (half a day): from a Cowork session, call `run.create`, `rubric.outline`, `ledger.writeRequirements` with one good and one bad object, `ledger.render`, `snapshot.diff`. Tick each against AGENT_SPEC §1. Record in `docs/HANDOFF.md`.

### 2c. Claude Docs spike (same half day)

From a Cowork session: create a Doc from Markdown blocks; read it back as structure; apply a section-level update; add and list comments; export to PDF. Any gap becomes a ladder in SKILL.md §6 (comments → appendix; structure → whole-body replace per section).

### 2d. Skill packaging and publication

1. Build the skill folder: `SKILL.md` (frontmatter: name `prdforge`, description with the triggers in SKILL.md header) + `references/` (outline, grammar, doc-template with approved claims, tool-map, golden-run). Use `anthropic-skills:skill-creator` to structure and to run evals.
2. Publish to the 917ventures Team Workspace the same way `ppt-master` was deployed; enable for the pilot members.
3. Create a **Claude Project template** per product: Project instructions name the `runId` convention and point at the skill; the Doc lives in the Project.

## 3. Scaffold the service

1. Empty repo folder locally, linked to the session; AgentBase Application client id/secret/token URL/API URL from Studio; Postgres URL with `pgvector`.
2. Say **"scaffold from this PRD"**. `precast:scaffold` interviews (name, Application, DB, model for D3; no web app), clones Precast flattened, stubs one agent `prdforge-ledger` in `crew.ts`, tools T1–T26 with zod schemas from DATA_MODEL, Drizzle schema, `.env.example` with `DATABASE_URL`, `AGENTBASE_LLM_MODEL`.
3. Copy `rubrics/` to the repo root. `scripts/seed-rubrics.ts`: load `annex-a-2022.yaml` into `control`; compile `ieee29148.yaml` grammar/banned terms into the T8 pre-check; serve `outline` via T15.
4. `pnpm connect --check` → `pnpm poc` → `run.create` + `run.get` against an empty ledger. First green.

## 4. Golden set and evals (parallel with §5)

`test/golden/` with five briefs: clean; diagram contradicts text; thin two-paragraph brief; PII-heavy consumer product; API-only product with hand-drawn flows. Two eval layers: **service tests** (AGENT_SPEC §4 — grammar fixtures, diff fixtures, invariants, compile/verify round-trip, hash stability) and **skill evals** (SKILL.md §9 — `rubric_pass_rate ≥ 0.9`, `human_edit_preserved = 1.0`, `security_citation_coverage = 1.0`, `bundle_roundtrip = 1.0`, `resume_from_any_stage`).

## 5. Build waves

| Wave | Scope                                                                                               | Exit criterion                                          |
| ---- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | Service: run/ledger/rubric/controls tools + pre-check + render; deploy to AgentBase; connector live | Spike in §2b passes end to end from Cowork              |
| 2    | Skill: start → ingest → clarify → draft → secure → review → publish on the clean brief              | Doc appears in the Project; `rubric_pass_rate` met      |
| 3    | Skill: sync → diff → reconcile → chat edit → re-render                                              | Scripted Doc-edit suite passes with zero overwrites     |
| 4    | Approve → PDF → `approval.create` → compile → verify → deliver                                      | `precast:scaffold` runs cleanly on the emitted `PRD.md` |
| 5    | Remaining golden briefs; budget paths; resume-from-any-stage; audit log review                      | All evals green                                         |

## 6. Deploy and first real run

1. Service: `pnpm emit:import-manifest`, push, **"put it on AgentBase"** → `precast:deploy` (Variables namespace with `DATABASE_URL`; Import from Repo; subscribe the Application; confirm the MCP bridge lists T1–T26).
2. Skill: publish v1 to the Team Workspace; enable for pilot members.
3. First real brief from the actual user group (D4); reviewers: product owner plus one security reviewer; measure PRD.md §6 metrics over two briefs before wider release.

## 7. This week's unblockers

1. You: D1, D2, D4; add the connector (§2b.1).
2. AgentBase team: §2a confirmations and D3.
3. Counsel: §1.1 and §1.2.
4. Engineering: §2b.3 and §2c spikes, then scaffold (§3).
