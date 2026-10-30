# HANDOFF.md — Continuity Plan

> **Purpose.** Single, always-current entry point for any agent about to pick up work. Read this file first; everything you need to take over the last-executed task or continue the next one is captured here.
>
> **Authority.** This doc lives at the top of `docs/`. It is the **only** doc a takeover agent is required to read before doing anything else. Once you've read this, the **Resume prompt** below tells you exactly which other docs to consult.
>
> **Updates.** Every meaningful task closure MUST overwrite §1 + §2 + §4 of this file in the same change set that closes the task. See the enforcement clause in [`CLAUDE.md` §3.5](../CLAUDE.md#35-handoffmd-enforcement--mandatory).
>
> **What this is NOT.** Long-form session history (→ [`PROGRESS.md Session Log`](PROGRESS.md)); architectural rationale (→ [`SPEC.md`](SPEC.md)); the plan being executed (→ `docs/plans/...`). This file is _only_ the single-page continuity checkpoint.

---

## 1. Current state (overwrite on each handoff)

**PRDForge — wave 1 skeleton, booted and answering on the user's Mac.** This project is the `prdforge-ledger` service: the deterministic system of record behind the `prdforge` Claude skill (`docs/PRD.md`, `docs/AGENT_SPEC.md`, `docs/DATA_MODEL.md`, `docs/SKILL.md`, `docs/NEXT_STEPS.md`). One Mastra agent, no reasoning, 29 tools, a Drizzle schema in the `prdforge` Postgres schema, boot-time migrate + Annex A control seed, rubrics shipped in the image.

- Green: `pnpm verify:poc`, `pnpm -F @precast/shared test` (28), `pnpm -F @precast/agents test` (152), `pnpm -F @precast/agents build`.
- **Live on the Mac** (`~/Documents/prdforge`, the canonical copy): database `prdforge_13c568bc` provisioned, model `gemini-35-flash-dd840ef8`, boot log `prdforge ledger ready — 93 Annex A controls seeded`. Via `pnpm smoke:chat`: `run_create` → run `e62b51be-0b24-4abd-ac39-386a474938e8`, `ledger_create_sections` → 18. Grammar gate confirmed: SEC-3.1 holds only `REQ-F-001`; SMOKE-020 Passing. Agent sessions still cannot reach `*.917v.ai` (B1) — the user runs AgentBase commands in Terminal.
- Built tools: run lifecycle, facts, workflow, sections, requirements (grammar pre-check + lineage-stable ids + open questions), revisions (human text protected), narratives, mappings, findings, decisions, slice reads, summary, trace audit, similarity, coverage, snapshot write (unreconciled-read guard), render, approval (hash + blocking-finding checks).
- Stubs returning `blocked:not_implemented`: `snapshot_diff`, `bundle_compile`, `bundle_verify`, `bundle_get`.
- `apps/web` is untouched Precast (sign-in shell + chat demo). PRDForge has no web surface; the human UI is Cowork + Claude Docs. Keep `PRECAST_LOCAL_AGENTS=1` until the import.

_Known carry-forwards:_ PROGRESS B1–B4. Tool ids use underscores (`run_create`) where the spec writes dots (`run.create`).

---

## 2. Next task (overwrite on each handoff)

1. **Push** (B2): user creates an empty private GitHub repo `prdforge`, `git remote add origin …`, `git push -u origin develop`.
2. **`precast:deploy`**: Variables namespace with `DATABASE_URL` and `AGENTBASE_LLM_MODEL=gemini-35-flash-dd840ef8`, Import from Repo, subscribe the Application, confirm the MCP bridge lists the ledger tools; the Owner adds the bridge as an organisation connector in Claude; publish the `prdforge` skill to the Team Workspace; wave-0 spike from Cowork.
4. **Wave 1 hardening**: write the deferred TEST_CASES rows (tool integration against Postgres, invariant tests, render determinism), then build the B3 stubs in waves 3–4 order.

---

## 3. Resume prompt (paste into the next agent)

> Copy the block below verbatim into whichever agent picks up next. The prompt is self-contained — it tells the agent which docs to read, the authority order between them, and what verification to run before reporting "done".

```
You are taking over work. Read these in order before touching code:

1) docs/HANDOFF.md (this file) — current state + next task + return contract.
2) docs/PROGRESS.md — long-form context for the most recently closed task.
3) The plan file the current task references (linked in §2 above, if applicable). If §2 says "No scheduled next task", instead read PROGRESS.md Task Tracker and pick the highest-priority unchecked task there.

Authority order on disagreement:
- Tech-stack facts (versions, libs, container images, ports) → docs/TECH_STACK.md wins.
- Boilerplate structure (file layout, naming, conventions) → docs/SPEC.md wins.
- Working rules → CLAUDE.md wins.

Execution rules:
- Make atomic changes per task (code + tests + doc updates in one change set).
- Update docs/PROGRESS.md (Last Updated, Session Log, handoff note) on every meaningful change.
- Update docs/HANDOFF.md §1 + §2 + §4 in the SAME change set that closes a task.
- Run all tests listed for the task. If a pre-existing unrelated failure carries forward, document it under "Known carry-forwards" in HANDOFF.md §1.
- Stop after one logical task and report (a) what changed, (b) what tests ran + outcomes, (c) what's next.

Return format:
- Completed: <one-line summary>
- Files changed: <list>
- Tests run + outcomes: <list with green/red>
- Risks / blockers: <list>
- Next: <pointer to HANDOFF.md §2 or the new state thereof>
```

## 4. File map for takeover (always-current)

```
CLAUDE.md                   ← project brief + enforcement rules (auto-read by Claude Code)
README.md                   ← user-facing overview + quick start
package.json                ← root scripts + dependencies
pnpm-workspace.yaml         ← workspace configuration
turbo.json                  ← Turborepo task orchestration
tsconfig.base.json          ← shared TypeScript config
eslint.config.js            ← linting rules
.prettierrc                 ← formatting rules
.editorconfig               ← editor settings
.nvmrc                      ← Node version pin
.env.example                ← env var template (remote/managed infra URLs)
.githooks/pre-commit        ← doc-contract enforcement + lint-staged (native core.hooksPath)
.claude/settings.json       ← Claude Code hooks (PostToolUse, Stop, SessionStart)
docs/HANDOFF.md             ← this file (single-page continuity checkpoint)
docs/PROGRESS.md            ← live session log + task tracker (always update)
docs/SPEC.md                ← canonical boilerplate specification
docs/TECH_STACK.md          ← versions, libs, images, ports (authoritative)
docs/ADRS.md                ← architectural decision records (empty template)
docs/STYLE_GUIDE.md         ← code style + naming conventions
docs/SCRIPTS.md             ← every pnpm script with descriptions
docs/TEST_CASES.md          ← test catalog with traceability
docs/INTEGRATION_AGENTBASE.md ← AgentBase integration guide (reference)
docs/AGENT_SPINUP_PROMPTS.md ← prompts for building agents on Precast (template)
docs/plans/                 ← LIVE plans directory (create as needed)
docs/archive/               ← FROZEN, do-not-parse
apps/agents/src/mastra/index.ts   ← Mastra instance (registers crewAgents(crew), storage, logger, server:45000)
apps/agents/src/mastra/crew.ts    ← THE CREW — single source of truth for the roster + orchestrator (declare agents here)
apps/agents/src/mastra/agents/    ← example-agent.ts + summary-agent.ts (neutral placeholder members) + orchestrator.ts (createOrchestrator — in-process Agent Network front door)
apps/agents/src/mastra/lib/crew.ts ← defineCrew()/crewAgents() — N=1 pass-through, activate at 2+, guards; drives registration (and Phase-2 manifest)
apps/agents/src/mastra/lib/agentbase-model.ts ← resolveAgentModel() — org-admin-configured LLM per imported agent, else the agent's own fallback string
apps/agents/src/mastra/lib/storage.ts ← getMastraStore() — the single shared PostgresStore (one connection pool)
apps/agents/src/mastra/lib/memory.ts  ← createAgentMemory() — Memory config + why semanticRecall is off
apps/agents/src/mastra/tools/     ← example-tool.ts (+ .spec.ts) — neutral placeholder
apps/agents/Dockerfile            ← multi-stage build of the Mastra .mastra/output bundle
apps/web/app/                ← layout.tsx, providers.tsx, page.tsx, AgentChat.tsx, globals.css
apps/web/app/lib/a2a-client.ts ← server-only callAgent() (A2A; sends contextId + metadata.resourceId)
apps/web/app/lib/agent-context.ts ← resolveAgentContext() — server-derived resourceId/threadId (multi-tenancy boundary)
apps/web/app/lib/agentbase-auth.ts ← mints/caches the AgentBase Application's OAuth2 client_credentials JWT
apps/web/app/api/            ← route handlers: health/route.ts, a2a/[agentId]/route.ts
apps/web/test/               ← Vitest specs (env schema + fitness guards: a2a-only, docker-build, agent-context)
apps/web/e2e/                ← Playwright UI specs (home.spec.ts)
apps/web/Dockerfile          ← multi-stage build of the Next standalone server
packages/shared/src/         ← env parser (zod, ESM) + Postgres-only DATABASE_URL validation + shared types
templates/                   ← feed-forward planning docs (PRD, DATA_MODEL, AGENT_SPEC, DESIGN_SYSTEM)
scripts/bootstrap.mjs        ← new-project bootstrap (rename + set-ports + deps + reset docs + blank git)
scripts/poc.mjs              ← `pnpm poc`: build both apps, run them on 127.0.0.1, wait for health + sign-in; `pnpm stop`, `pnpm logs`
scripts/set-ports.mjs        ← retarget the agents/web port pair across env/configs/scripts/Dockerfiles/docs
scripts/rename-project.mjs   ← one-shot placeholder rename (walks all source)
scripts/update-deps.mjs      ← update deps to latest compatible + verify
scripts/progress-stamp.mjs   ← PROGRESS.md auto-journal
scripts/emit-import-manifest.mjs ← derive agentbase.import.json requiredEnv from the env schema
```

## 5. Lifecycle — when this file gets updated

- **On every meaningful task closure** — §1 (Current state), §2 (Next task), and §4 (File map for takeover, if files moved) are overwritten by the closing agent in the same change set as the code/doc changes.
- **§3 (Resume prompt) is stable** — only updated when the takeover contract itself changes (very rare).
- **§5 (Lifecycle) is meta** — only updated when this enforcement contract itself changes.

If you are picking up mid-session because the previous agent is unavailable, your first action is to read this file's §1 and §3, then paste §3's resume prompt into your next prompt to whichever agent continues the work. The seam is intentionally one file deep.
