# DATA_MODEL — PRDForge requirement ledger

> The ledger is the system of record, hosted on AgentBase by the `prdforge-ledger` service. The Claude Doc and the agent bundle are projections of it; the `prdforge` skill reads and writes it in slices through tools, never by holding it in context.

**Last updated:** 2026-10-29 · **Store:** PostgreSQL (Drizzle schema in `packages/shared`; `pgvector` for fact/control embeddings when available)

**Identity convention (decided):** the connector uses one organisation token, so every write carries `reported_by` (the Claude session user as reported by the skill, not verified) and `caller` (the connector identity). Human provenance lives in the Claude Doc's version history and the PDF attached at approval.

---

## 1. Entities

### PrdRun

One brief-to-PRD lifecycle for one product.

| Field                    | Type        | Notes                                                                                        |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------- |
| `id`                     | uuid (PK)   |                                                                                              |
| `product`                | text        | Product slug; unique among `active` runs (one active run per product lineage).               |
| `projectRef`             | text?       | Claude Project identifier or name, for resume.                                               |
| `stage`                  | enum        | `ingest\|draft\|secure\|review\|publish\|awaiting_review\|reconcile\|approve\|compile\|done` |
| `outcome`                | text        | Last typed outcome, e.g. `ok`, `blocked:budget`.                                             |
| `digest`                 | text        | Pinned Brief Digest (≤3k tokens).                                                            |
| `glossary`               | jsonb       | `{term: definition}`                                                                         |
| `budget`                 | jsonb       | `{tokens, toolCalls, wallClockMs, repairPasses}` caps and usage.                             |
| `docId`                  | text        | Live draft Claude Doc.                                                                       |
| `ledgerHash`             | text        | Hash of all current requirement statements + attributes.                                     |
| `parentRunId`            | uuid (FK)   | Set when a new brief version re-runs an approved product.                                    |
| `createdBy`              | text        | `reported_by` at creation (self-reported).                                                   |
| `caller`                 | text        | Connector identity (the organisation token's principal).                                     |
| `createdAt`, `updatedAt` | timestamptz |                                                                                              |

### SourceDocument

A file in the folder as ingested.

| Field              | Type      | Notes                                                                                  |
| ------------------ | --------- | -------------------------------------------------------------------------------------- |
| `id`               | uuid (PK) |                                                                                        |
| `runId`            | uuid (FK) |                                                                                        |
| `uploadRef`        | text      | Chat upload identifier or filename; `contentHash` detects re-uploads.                  |
| `name`, `mimeType` | text      |                                                                                        |
| `role`             | enum      | `brief\|diagram\|other`                                                                |
| `contentHash`      | text      |                                                                                        |
| `blocks`           | jsonb     | `[{anchor:"src:<id>:<n>", headingPath, text}]` — text is the cached normalised source. |
| `extraction`       | jsonb     | `DiagramExtraction` for diagrams.                                                      |
| `confidence`       | numeric   | OCR / vision confidence.                                                               |

### BriefFact

An anchored, atomic fact the drafting agents may cite.

| Field        | Type          | Notes                                                                                                        |
| ------------ | ------------- | ------------------------------------------------------------------------------------------------------------ |
| `id`         | text (PK)     | `FACT-<nnn>`                                                                                                 |
| `runId`      | uuid (FK)     |                                                                                                              |
| `kind`       | enum          | `goal\|actor\|system\|constraint\|data\|integration\|nfr\|assumption\|out_of_scope\|workflow_step\|decision` |
| `text`       | text          | One sentence.                                                                                                |
| `anchors`    | text[]        | `src:*` anchors.                                                                                             |
| `confidence` | numeric       | < 0.6 requires a `Finding`.                                                                                  |
| `embedding`  | vector(1536)? | Optional.                                                                                                    |

### WorkflowModel

Merged view of all diagrams.

| Field          | Type      | Notes                                                                                                               |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`           | uuid (PK) |                                                                                                                     |
| `runId`        | uuid (FK) |                                                                                                                     |
| `flows`        | jsonb     | `[{flowId, name, steps:[{stepId, actor, action, system?, dataStore?, next[]}], decisions:[...], boundaries:[...]}]` |
| `sourceDocIds` | uuid[]    |                                                                                                                     |

### Section

A node of the 29148-derived outline for this run.

| Field         | Type      | Notes                                                                                                                                                                                                          |
| ------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | text (PK) | `SEC-3.1` style, scoped by `runId`.                                                                                                                                                                            |
| `runId`       | uuid (FK) |                                                                                                                                                                                                                |
| `kind`        | enum      | `purpose\|scope\|overview\|definitions\|references\|functional\|performance\|usability\|interface\|data\|constraints\|attributes\|security\|verification\|assumptions\|open_questions\|coverage\|traceability` |
| `order`       | int       | Dependency order for drafting.                                                                                                                                                                                 |
| `mandatory`   | bool      |                                                                                                                                                                                                                |
| `narrative`   | text      | Prose block, ≤400 words.                                                                                                                                                                                       |
| `summary`     | text      | ≤120-word summary used as upstream context by later sections.                                                                                                                                                  |
| `contentHash` | text      | Drives incremental re-render.                                                                                                                                                                                  |
| `status`      | enum      | `empty\|drafted\|reviewed\|published\|tbd`                                                                                                                                                                     |

### Requirement

The unit of the PRD.

| Field            | Type          | Notes                                                                                                                                  |
| ---------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | text (PK)     | `REQ-<TYPE>-<nnn>`; never reused; scoped by product lineage (survives re-runs).                                                        |
| `runId`          | uuid (FK)     | Current owning run.                                                                                                                    |
| `sectionId`      | text (FK)     |                                                                                                                                        |
| `type`           | enum          | `F\|IF\|DATA\|PERF\|USE\|SEC\|CONSTR\|QUAL`                                                                                            |
| `statement`      | text          | Current text (verbatim if `origin = human`).                                                                                           |
| `rationale`      | text          |                                                                                                                                        |
| `source`         | jsonb         | `[{kind:"anchor", ref:"src:..."}\|{kind:"fact", ref:"FACT-.."}\|{kind:"workflow", ref:"stepId"}\|{kind:"derived", ref:"A.8.10", why}]` |
| `priority`       | enum          | `must\|should\|could\|wont`                                                                                                            |
| `verification`   | enum          | `inspection\|analysis\|demonstration\|test`                                                                                            |
| `stability`      | enum          | `stable\|volatile\|tbd`                                                                                                                |
| `stakeholders`   | text[]        |                                                                                                                                        |
| `dependsOn`      | text[]        | Other REQ IDs.                                                                                                                         |
| `origin`         | enum          | `agent\|human\|agent_on_request`                                                                                                       |
| `status`         | enum          | `draft\|reviewed\|published\|withdrawn\|needs_structuring`                                                                             |
| `revision`       | int           | Bumps on each `Revision`.                                                                                                              |
| `acceptance`     | jsonb         | `[{given, when, then}]` — filled at compile, may be pre-drafted.                                                                       |
| `openQuestionId` | text?         | Set when statement contains `TBD(...)`.                                                                                                |
| `embedding`      | vector(1536)? | For duplicate/conflict candidate search.                                                                                               |

### Revision

Append-only history of a requirement's statement.

| Field        | Type        | Notes                                               |
| ------------ | ----------- | --------------------------------------------------- |
| `id`         | uuid (PK)   |                                                     |
| `reqId`      | text (FK)   |                                                     |
| `revision`   | int         |                                                     |
| `statement`  | text        |                                                     |
| `origin`     | enum        | `agent\|human\|agent_on_request`                    |
| `reportedBy` | text?       | Session user as reported by the skill.              |
| `docVersion` | text?       | Claude Doc version where a human edit was observed. |
| `createdAt`  | timestamptz |                                                     |

### Decision

A clarifying answer or reviewer ruling recorded during a run.

| Field                | Type        | Notes                             |
| -------------------- | ----------- | --------------------------------- |
| `id`                 | text (PK)   | `DEC-<nnn>`                       |
| `runId`              | uuid (FK)   |                                   |
| `question`, `answer` | text        |                                   |
| `reportedBy`         | text        |                                   |
| `blocks`             | text[]      | REQ/SEC IDs the answer unblocked. |
| `createdAt`          | timestamptz |                                   |

### Control

Static catalogue, seeded once (93 rows).

| Field       | Type          | Notes                                                                  |
| ----------- | ------------- | ---------------------------------------------------------------------- |
| `id`        | text (PK)     | `A.5.1` … `A.8.34`                                                     |
| `theme`     | enum          | `organizational\|people\|physical\|technological`                      |
| `shortName` | text          |                                                                        |
| `summary`   | text          | 917V paraphrase; provenance tracked in repo.                           |
| `triggers`  | text[]        | Applicability tags (`pii`, `auth`, `cloud`, `supplier`, `logging`, …). |
| `embedding` | vector(1536)? |                                                                        |

### ControlMapping

| Field       | Type      | Notes                 |
| ----------- | --------- | --------------------- |
| `id`        | uuid (PK) |                       |
| `runId`     | uuid (FK) |                       |
| `reqId`     | text (FK) |                       |
| `controlId` | text (FK) |                       |
| `strength`  | enum      | `satisfies\|supports` |
| `rationale` | text      |                       |

### ControlStatus

Per-run coverage verdict (materialised for the matrix).

| Field                | Type | Notes                                       |
| -------------------- | ---- | ------------------------------------------- |
| `runId`, `controlId` | (PK) |                                             |
| `status`             | enum | `satisfied\|supported\|gap\|not_applicable` |
| `reason`             | text | Mandatory when `not_applicable`.            |

### Finding

A rubric or audit result.

| Field                     | Type      | Notes                                                                                      |
| ------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `id`                      | uuid (PK) |                                                                                            |
| `runId`                   | uuid (FK) |                                                                                            |
| `targetType`              | enum      | `requirement\|section\|mapping\|ingest\|run`                                               |
| `targetId`                | text      |                                                                                            |
| `rule`                    | text      | e.g. `29148.singular`, `29148.verifiable`, `trace.no_source`, `annexa.unmapped_applicable` |
| `severity`                | enum      | `blocking\|major\|minor`                                                                   |
| `message`, `suggestedFix` | text      |                                                                                            |
| `status`                  | enum      | `open\|repaired\|accepted_by_human\|superseded`                                            |
| `pass`                    | int       | Repair pass in which it was raised.                                                        |

### OpenQuestion

| Field      | Type      | Notes                         |
| ---------- | --------- | ----------------------------- |
| `id`       | text (PK) | `OQ-<nnn>`                    |
| `runId`    | uuid (FK) |                               |
| `question` | text      | Specific, answerable.         |
| `blocks`   | text[]    | REQ or SEC IDs waiting on it. |
| `status`   | enum      | `open\|answered\|dropped`     |
| `answer`   | text?     |                               |

### DocSnapshot

What the skill last rendered to / last read from the Claude Doc.

| Field                 | Type        | Notes                                                                                                |
| --------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `id`                  | uuid (PK)   |                                                                                                      |
| `runId`               | uuid (FK)   |                                                                                                      |
| `docId`, `docVersion` | text        | Claude Doc id and version from the connector; `docVersion` nullable, then `contentHash` is the lock. |
| `contentHash`         | text        | Hash of normalised `blocks`; always set.                                                             |
| `direction`           | enum        | `rendered\|read`                                                                                     |
| `blocks`              | jsonb       | `[{key: headingPath\|reqId, hash, text}]`                                                            |
| `renderedHash`        | text        | Per-section hashes used for incremental re-render.                                                   |
| `reconciled`          | bool        | A `read` snapshot must be reconciled before any new `rendered`.                                      |
| `createdAt`           | timestamptz |                                                                                                      |

### Approval

| Field        | Type               | Notes                                                              |
| ------------ | ------------------ | ------------------------------------------------------------------ |
| `id`         | uuid (PK)          |                                                                    |
| `runId`      | uuid (FK)          |                                                                    |
| `version`    | text               | `1.0`, `1.1` …                                                     |
| `reportedBy` | text               | Approver as reported by the skill (self-reported).                 |
| `docVersion` | text               | Claude Doc version at approval.                                    |
| `pdf`        | bytea / object ref | PDF export of the Doc at approval — the human-provenance artefact. |
| `ledgerHash` | text               | Must equal `PrdRun.ledgerHash` at compile.                         |
| `overrides`  | text[]             | Finding IDs approved despite `blocking`.                           |
| `approvedAt` | timestamptz        |                                                                    |

### Bundle

| Field        | Type        | Notes                                                                                                                                                                                                                          |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`         | uuid (PK)   |                                                                                                                                                                                                                                |
| `approvalId` | uuid (FK)   |                                                                                                                                                                                                                                |
| `files`      | jsonb       | `{name: text}` — file contents stored in Postgres (small, text-only): `PRD.agent.md`, `requirements.yaml`, `controls.yaml`, `traceability.csv`, `PRD.md`, `DATA_MODEL.md`, `AGENT_SPEC.md`; delivered to chat via `bundle.get` |
| `verify`     | jsonb       | Round-trip counts and result.                                                                                                                                                                                                  |
| `createdAt`  | timestamptz |                                                                                                                                                                                                                                |

### AuditEvent

| Field        | Type           | Notes                                                                             |
| ------------ | -------------- | --------------------------------------------------------------------------------- |
| `id`         | bigserial (PK) |                                                                                   |
| `runId`      | uuid (FK)      |                                                                                   |
| `caller`     | text           | Connector identity.                                                               |
| `reportedBy` | text?          | Session user as reported by the skill.                                            |
| `action`     | text           | `tool:<name>`, `stage:<name>`, `snapshot:read`, `snapshot:rendered`, `approve`, … |
| `refs`       | jsonb          | IDs and hashes only — never source or requirement text.                           |
| `tokens`     | int?           | For budget accounting.                                                            |
| `at`         | timestamptz    |                                                                                   |

## 2. Relationships

```
PrdRun 1──∞ SourceDocument
PrdRun 1──∞ BriefFact          PrdRun 1──1 WorkflowModel
PrdRun 1──∞ Section 1──∞ Requirement 1──∞ Revision
Requirement ∞──∞ Control   (via ControlMapping)
PrdRun ∞──∞ Control        (via ControlStatus)
PrdRun 1──∞ Finding        PrdRun 1──∞ OpenQuestion   PrdRun 1──∞ Decision
PrdRun 1──∞ DocSnapshot    PrdRun 1──∞ Approval 1──1 Bundle
PrdRun 1──∞ AuditEvent     PrdRun 0..1──∞ PrdRun (parentRunId)
```

## 3. Invariants

1. **One active run per product.** Partial unique index on `PrdRun(product) where stage <> 'done'`.
2. **Requirement IDs are immutable and never reused.** Withdrawn requirements keep their row with `status = withdrawn`; a re-run (child `PrdRun`) carries IDs forward.
3. **Every requirement has provenance.** `jsonb_array_length(source) >= 1`; a `derived` source must carry `why`.
4. **Human text is never overwritten by an agent.** Trigger: an `UPDATE` to `statement` where `origin = 'human'` is permitted only when the new `Revision.origin = 'human'` or a `Finding.status = accepted_by_human` references it.
5. **No render over an unreconciled read.** `DocSnapshot(direction='rendered')` may be inserted only if the latest `read` snapshot for the run has `reconciled = true`.
6. **Approval binds a ledger hash.** `Bundle` may be created only where `Approval.ledgerHash = PrdRun.ledgerHash` at compile time; otherwise compile fails `failed:compile_verify`.
7. **`not_applicable` needs a reason.** Check constraint on `ControlStatus`.
8. **Singular statements.** Application-level check (`29148.singular`) must pass or a `blocking` Finding must exist; the DB does not parse grammar.
9. **TBD implies a question.** `statement ILIKE '%TBD(%'` ⇒ `openQuestionId IS NOT NULL`.
10. **Audit is append-only** and content-free (no `statement`/`text` columns; refs only).
11. **Budget monotonic.** `budget.usage` only increases within a run; exceeding any cap sets `outcome = 'blocked:budget'` and halts between units.

## 4. Example DDL sketch

```sql
create type req_type as enum ('F','IF','DATA','PERF','USE','SEC','CONSTR','QUAL');
create type req_origin as enum ('agent','human','agent_on_request');
create type req_status as enum ('draft','reviewed','published','withdrawn','needs_structuring');
create type verification_method as enum ('inspection','analysis','demonstration','test');
create type priority as enum ('must','should','could','wont');

create table requirement (
  id              text primary key,                      -- REQ-F-012
  run_id          uuid not null references prd_run(id),
  section_id      text not null,
  type            req_type not null,
  statement       text not null,
  rationale       text not null,
  source          jsonb not null check (jsonb_array_length(source) >= 1),
  priority        priority not null,
  verification    verification_method not null,
  stability       text not null default 'tbd',
  stakeholders    text[] not null default '{}',
  depends_on      text[] not null default '{}',
  origin          req_origin not null default 'agent',
  status          req_status not null default 'draft',
  revision        int not null default 1,
  acceptance      jsonb,
  open_question_id text,
  embedding       vector(1536),
  constraint tbd_has_question
    check (statement not ilike '%TBD(%' or open_question_id is not null)
);

create unique index one_active_run_per_product
  on prd_run(product) where stage <> 'done';

create table control_status (
  run_id     uuid references prd_run(id),
  control_id text references control(id),
  status     text not null check (status in ('satisfied','supported','gap','not_applicable')),
  reason     text,
  primary key (run_id, control_id),
  constraint na_needs_reason check (status <> 'not_applicable' or reason is not null)
);
```

## 5. Validation

All tool inputs/outputs are zod schemas in `packages/shared/src/` generated alongside the Drizzle schema (one source of truth). `ledger.writeRequirements` rejects (and returns in `rejected[]`) any object failing grammar pre-checks (multiple `shall`, banned vagueness terms, missing units on numeric constraints) so bad objects never reach the DB. See [AGENT_SPEC.md](AGENT_SPEC.md) §1 tool table.
