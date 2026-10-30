# PROGRESS.md — Context Memory

> **This file is the ultimate cross-tool context memory.** All coding agents MUST update this file on every meaningful change. If you finish work without updating PROGRESS.md, the work is **not** considered complete.

**Last Updated:** 2026-10-30
**Updated By:** Claude (Cowork) — PRDForge scaffold, wave 1 skeleton
**Active Branch:** develop

---

## 0. How to Use This File

### 0.1 When to Update

You MUST update PROGRESS.md when you:

- Start or finish a task / subtask listed below.
- Make a code change, however small.
- Make or revise a design decision.
- Add, modify, or remove tests.
- Change environment variables or infrastructure config.
- Discover a blocker, risk, or open question.
- Switch tools between sessions.

### 0.2 How to Update

1. Bump **Last Updated** + **Updated By** at the top.
2. Append an entry to the **Session Log** (top of log = newest).
3. Tick / untick relevant **Task Tracker** checkboxes.
4. Update **Open Decisions**, **Known Blockers**, **Test Coverage** as needed.
5. If you started/finished a phase, update the **Phase Plan**.
6. Keep entries terse. Link to files where helpful.

### 0.3 What Belongs Here vs Elsewhere

- **Here:** state of work, decisions, blockers, what's next, who/what did what.
- **Not here:** architectural rationale (→ [SPEC.md](SPEC.md)), style rules (→ [STYLE_GUIDE.md](STYLE_GUIDE.md)), test definitions (→ [TEST_CASES.md](TEST_CASES.md)).
- **Never here:** secrets, raw tokens, PII.

---

## 1. Project Snapshot

> Fill this in for your project after `pnpm bootstrap`.

| Field            | Value                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project**      | prdforge                                                                                                                                                             |
| **Mission**      | PRD Generation — the ledger service behind the prdforge Claude skill: stores, validates, hashes, diffs and compiles PRD requirements; it never reasons (docs/PRD.md) |
| **Stacks**       | pnpm + Turborepo · Mastra (agents) · Next.js + Astryx + Better Auth (web) · zod · Postgres/Redis (remote/managed)                                                    |
| **Repo Root**    | prdforge/ (GitHub remote pending)                                                                                                                                    |
| **Primary Docs** | [SPEC.md](SPEC.md), [TECH_STACK.md](TECH_STACK.md), [STYLE_GUIDE.md](STYLE_GUIDE.md)                                                                                 |

---

## 2. Phase Plan

> Track major phases here. Mark each: Not Started / In Progress / Completed / Blocked

| #   | Phase                                                                | Status      | Exit Criteria                                                             |
| --- | -------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| 0   | Spikes: AgentBase MCP bridge from Cowork; Claude Docs connector      | Blocked     | Every capability ticked or given a named fallback (docs/NEXT_STEPS.md §2) |
| 1   | Service: run/ledger/rubric/controls tools, grammar pre-check, render | In Progress | Boots against Postgres; spike calls pass from Cowork; service tests green |
| 2   | Skill: start → read → clarify → draft → secure → review → publish    | Not Started | Doc appears in the Project; rubric_pass_rate ≥ 0.9                        |
| 3   | Skill: sync → diff → reconcile → chat edit → re-render               | Not Started | Scripted Doc-edit suite passes with zero overwrites                       |
| 4   | Approve → PDF → approval → compile → verify → deliver                | Not Started | precast:scaffold runs on the emitted PRD.md; bundle_roundtrip = 1.0       |
| 5   | Remaining golden briefs; budget paths; resume; audit review          | Not Started | All evals green; first real brief                                         |

---

## 3. Task Tracker (live)

> Mark each task `[ ]`, `[~]` in-progress, `[x]` done, `[!]` blocked.

- [ ] (add your first task)

---

## 4. Open Decisions

| ID    | Decision | Date | Rationale |
| ----- | -------- | ---- | --------- |
| D-001 | —        | —    | —         |

---

## 5. Known Blockers

| ID  | Blocker                                                                                                                                         | Impact                                                                                                           | Workaround                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | The Cowork sandbox's egress policy refuses `agentbase-api.917v.ai` and `agentbase-keycloak.917v.ai` (proxy 403)                                 | Cannot run `pnpm connect`, `pnpm db:provision` or `pnpm poc`; model is the placeholder `pending-until-connected` | Workspace Owner adds both hosts under Organization settings → Capabilities → allowed domains; then `pnpm connect`, `pnpm db:provision`, `pnpm poc agents` |
| B2  | `gh` is not signed in here and there is no interactive terminal                                                                                 | Cannot create the GitHub remote from this session                                                                | User supplies repo URL + token with contents:write, or pushes from their machine                                                                          |
| B3  | Stubbed tools: `snapshot_diff`, `bundle_compile`, `bundle_verify`, `bundle_get` answer `blocked:not_implemented`                                | Waves 3–4 cannot complete                                                                                        | Build in waves 3–4 per docs/NEXT_STEPS.md §5                                                                                                              |
| B4  | Deferred tests (TEST_CASES `Not Started` rows): tool integration against Postgres, snapshot invariants, approval hash check, render determinism | Hardening debt owed before wave 1 is called done                                                                 | Wave 1 hardening after the first boot against the provisioned database                                                                                    |

---

## 6. Test Coverage

| Area                | Tests                                                                                                 | Status  |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| Agents (Vitest)     | `apps/agents/src/**` — boilerplate guards (152 tests); ledger tool integration tests Not Started (B4) | Passing |
| Shared (Vitest)     | `packages/shared/src/prdforge/grammar.spec.ts` — grammar pre-check, 7 cases                           | Passing |
| Web/shared (Vitest) | `apps/web/test/**` — env schema + fitness guards                                                      | Passing |
| E2E (Playwright)    | `apps/web/e2e/**` — home page                                                                         | Passing |

---

## 7. Environment State

| Variable               | Value                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `Node`                 | 24.22.2 in the scaffold session (nodejs.org blocked; installed from the npm registry) |
| `pnpm`                 | 9.15.9                                                                                |
| `Ports`                | see TECH_STACK §6 (set by bootstrap; infra is remote)                                 |
| `DATABASE_URL`         | placeholder — provision pending B1                                                    |
| `PRECAST_LOCAL_AGENTS` | 1 until the first AgentBase import                                                    |

---

## 8. Session Log

<!-- Newest first. The progress-stamp hook appends <auto-journal> markers here. -->

- **2026-10-30 · Claude (Cowork) · PRDForge scaffold — wave 1 skeleton ·** Bootstrapped from Precast 0.12.4 as `prdforge` with the AgentBase Application written to `.env` (secret scrubbed with `pnpm forget-secret`), `--db=later` because the sandbox cannot reach `*.917v.ai` (B1). Replaced the placeholder crew with one agent, `prdforge-ledger` (`agents/prdforge-ledger.ts`, no memory, no MCP toolset, router-only instructions) and 29 Mastra tools under `tools/ledger/` covering AGENT_SPEC T1–T26 (`run_*`, `ledger_*`, `rubric_*`, `controls_*`, `snapshot_*`, `approval_create`, `bundle_*`). Built: run lifecycle with state-machine guard, facts, workflow, sections, requirements with the grammar pre-check and lineage-stable `REQ-<TYPE>-<nnn>` ids, revisions with human-text protection, narratives, mappings, findings (rule ids validated against the rubric), decisions, slice reads, summary, trace audit, trigram similarity, coverage matrix, snapshot write with the unreconciled-read guard, deterministic render, approval with ledger-hash and blocking-finding checks. Stubbed with typed `blocked:not_implemented`: `snapshot_diff`, `bundle_compile`, `bundle_verify`, `bundle_get` (B3). Data: Drizzle schema in the `prdforge` Postgres schema (`db/schema.ts`, 17 tables, invariants 1/5/6/7 in code or index), migration `drizzle/0000_prdforge_ledger.sql` (+ `pg_trgm`), boot-time migrate + control seed (`db/bootstrap.ts`, top-level await in `index.ts`); Dockerfile ships `rubrics/` and `drizzle/`. Shared: `@precast/shared` gains `prdforge/types.ts` (zod domain) and `prdforge/grammar.ts` (pure pre-check) with 7 Vitest cases. Docs: feed-forward docs copied from the PRD-Forge Project (PRD, AGENT_SPEC, DATA_MODEL, SKILL, NEXT_STEPS) and `rubrics/`. **Verified:** `pnpm verify:poc` green, 28 shared + 152 agents tests green, `mastra build` green. **Not verified:** any call against Postgres — no database yet (B1). · `apps/agents/src/mastra/{crew.ts,index.ts,agents/prdforge-ledger.ts,db/*,rubrics/load.ts,tools/ledger/*}`, `apps/agents/{Dockerfile,drizzle.config.ts,drizzle/*,scripts/seed-rubrics.mjs,package.json}`, `packages/shared/src/prdforge/*`, `rubrics/*`, `docs/*`

- **2026-08-11 · Claude Code · orchestrator-crew Phases 2 + 4(R2/R3) — import-manifest emission + container telemetry ·** **P2:** extended `scripts/emit-import-manifest.mjs` to emit an `orchestration` block into `agentbase.import.json` — orchestrator id read from `ORCHESTRATOR_ID` via regex (single source; no TS loader/DB needed in the bare-Node emit context), `members` omitted (AgentBase discovers them, same as `agents`), `defaultImport: orchestrator-only`. Guarded by `apps/agents/src/mastra/orchestration-manifest.spec.ts` (manifest orchestrator === `ORCHESTRATOR_ID`, members omitted, valid mode). **P4 R2/R3:** added `apps/agents/src/mastra/telemetry/otel.ts` (`@opentelemetry/sdk-node` + `exporter-trace-otlp-http` + `instrumentation-http`/`-undici`), self-starting and imported FIRST in `index.ts`, so the container installs W3C propagation (continues AgentBase's inbound `traceparent` across the crew's in-process hops + re-injects on egress) and exports spans when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (AgentBase injects it — R5). Telemetry init is best-effort and never crashes serving. **Why:** make the crew importable into AgentBase with an operator full-crew/orchestrator-only choice, and keep complete trace visibility despite in-process routing. **Verified:** typecheck + lint + 55 agents tests + `mastra build` all green. **Carry-forward:** live e2e trace-stitch through the _bundled_ container isn't verified here (no running stack); ESM instrumentation ordering may want a `node --import` preload — see HANDOFF §2. AgentBase-side P3 + P4 R1/R4/R5 landed in `~/Projects/agentbase`. · `scripts/emit-import-manifest.mjs`, `agentbase.import.json`, `apps/agents/src/mastra/{orchestration-manifest.spec.ts,telemetry/otel.ts,index.ts}`, `apps/agents/package.json`, `docs/{HANDOFF.md,PROGRESS.md,TECH_STACK.md,plans/orchestrator-crew-plan.md}`

- **2026-08-11 · Claude Code · orchestrator-crew Phase 1 — shipped the in-process orchestrator crew into the boilerplate ·** Added `apps/agents/src/mastra/crew.ts` as the single source of truth for the roster + orchestrator, `lib/crew.ts` (`defineCrew()` — N=1 transparent pass-through, activates at 2+; `crewAgents()` — deduped registration; guards for the reserved `crew-orchestrator` id, duplicate member ids, and nested crews), and `agents/orchestrator.ts` (`createOrchestrator()` — a Mastra Agent Network via the `agents:` field, i.e. in-process agents-as-tools with an LLM-routed tight prompt; no memory by design, same transformation-vs-conversation rule as `summary-agent`). Rewired `index.ts` to register `crewAgents(crew)` instead of hand-listing agents. Members are untouched → each keeps its own `/api/.well-known/:id/agent-card.json` and stays standalone; the orchestrator is purely additive. **Why:** Phase 1 of `docs/plans/orchestrator-crew-plan.md` — a default single-point-of-contact for every Precast Mastra app, without swallowing the subagents. **Verified:** `tsc --noEmit`, `eslint src`, 51 agents-package tests (8 new `lib/crew.spec.ts`), and `mastra build` all green. Live A2A-card fetch deferred: this checkout's `.env` has only placeholder DB creds + an invalid `file:` `MASTRA_DB_URL`, so the server can't boot here. **Next:** Phase 2 — extend `scripts/emit-import-manifest.mjs` to emit the `orchestration` block from `crew.ts`. · `apps/agents/src/mastra/{crew.ts,index.ts}`, `apps/agents/src/mastra/agents/orchestrator.ts`, `apps/agents/src/mastra/lib/{crew.ts,crew.spec.ts}`, `docs/{HANDOFF.md,PROGRESS.md,plans/orchestrator-crew-plan.md}`

---

## 9. Cross-Tool Handoff Notes

| Date       | Agent           | Context                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-30 | Claude (Cowork) | **PRDForge wave 1 skeleton committed; nothing has run against a database yet.** Unblock B1 (allow `*.917v.ai` in the workspace egress), then: `pnpm connect` (pick the cheapest model — the service never reasons), `pnpm db:provision`, `pnpm poc agents`, confirm boot logs say "prdforge ledger ready — 93 Annex A controls seeded", call `run_create`/`run_get`/`ledger_create_sections`/`ledger_write_requirements` once through Studio, then push (B2) and `precast:deploy`. Then build B3 stubs and pay B4.                                                            |
| 2026-08-11 | Claude Code     | Orchestrator-crew **Phase 1 done** — in-process orchestrator (`crew-orchestrator`, Mastra Agent Network) scaffolded into the boilerplate via `mastra/crew.ts` + `lib/crew.ts` (`defineCrew`/`crewAgents`) + `agents/orchestrator.ts`; activates at 2+ members, N=1 pass-through; members keep their own cards. Green: typecheck, lint, 51 agents tests, `mastra build`. **Next: Phase 2** — emit the `orchestration` block from `crew.ts` in `scripts/emit-import-manifest.mjs` (plan §8.2). Then mirror to precast-plugin / precast-ground-zero, and AgentBase-side Phase 3. |

---

## 10. Changelog

- (record notable milestones here)
