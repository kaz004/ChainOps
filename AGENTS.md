# AGENTS.md — Engineering Rules for Coding Agents

This file establishes permanent rules for any agent (human or AI) working in this repository.
Read it fully before making changes. For the current state of the system, see
[docs/HANDOFF.md](docs/HANDOFF.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## PROJECT PURPOSE

**ChainOps AI** is an AI-assisted SRE control plane for deploying, observing, testing, and
recovering distributed multichain applications. Engineering teams use it to:

- connect Git repositories and analyze applications
- generate deployment plans and run CI/CD pipelines
- deploy workloads and observe services (metrics, logs, traces)
- define SLOs, track error budgets, detect incidents
- perform AI-assisted root-cause analysis and policy-approved remediation
- run controlled chaos experiments
- inspect blockchain/RPC health across multiple networks

It is an infrastructure platform, not a generic dashboard. The defining product loop is:
**healthy → inject failure → detect → AI RCA → policy → remediation → recover → resolve → postmortem**.
Every feature should serve that loop. When something is simulated, it must be labeled as
simulated — never presented as controlling real infrastructure.

---

## CURRENT STATE

| Phase | Scope | Status |
|---|---|---|
| Phase 1 | Foundation (shell, design system, seeded data, simulation skeleton, dashboard) | **COMPLETED** |
| Phase 2 | Project Management (CRUD, archive, search/filter, detail tabs, activity) | **COMPLETED** |
| Phase 3 | Repository Analyzer (analyzer port, mock adapter, analysis jobs, results UI) | **COMPLETED** |
| Phase 4 — Deployment Engine | Deterministic deployment progression, controls, history | **COMPLETED** |
| Phase 5 — CI/CD Pipeline | Deterministic staged runs linked to deployments | **COMPLETED** |
| Phase 6 — Observability | Deterministic telemetry, logs, traces, filters and health explorer | **COMPLETED** |
| Phase 7 — SLO & Error Budgets | Telemetry-derived SLI/budgets and production deploy gate | **COMPLETED** |
| Phase 8 — Incident Management | Alert detection, guarded lifecycle, correlated incident detail | **COMPLETED** |
| Phase 9 — Chaos Engineering | Bounded simulated fault runs integrated with telemetry and incidents | **COMPLETED** |
| Phase 10 — AI Operations | Structured Demo AI provider, evidence-linked analysis and postmortem drafts | **COMPLETED** |
| Phase 11 — Policy & Remediation | Allowlisted, audited, approval-gated simulated recovery | **COMPLETED** |
| Phase 12 — Multichain Infrastructure | Simulated chain/RPC health with policy-gated failover and recovery links | **COMPLETED** |

Do not assume a phase is complete unless the code proves it. Verify in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), which distinguishes REAL / MOCKED / SIMULATED /
PLACEHOLDER / NOT IMPLEMENTED.

---

## ARCHITECTURE RULES

The layering is mandatory. Dependencies point downward only:

```text
UI (app/ routes, features/, components/)
  ↓
API layer (src/app/api/** — thin route handlers via lib/api wrappers)
  ↓
Application services (src/server/services/**)
  ↓
Domain (src/server/core/domain/**, src/types/domain.ts)
  ↓
Repositories (src/server/repositories/**)  ·  Ports (src/server/core/ports/**)
  ↓
Adapters (src/server/adapters/**)  ·  Simulation (src/server/core/simulation/**)
```

- Business logic must NOT live inside React components. Components render data received from
  services; interactions call APIs which call services.
- `src/server/container.ts` is the only composition root. UI/pages resolve services via
  `getContainer()`; never import repositories or adapters directly from UI code.
- Route handlers must stay thin: validation + service call + response envelope. Cross-cutting
  request concerns (Zod validation, error mapping, requestId, body-size guard) live in
  `src/lib/api/with-route.ts` — use its wrappers, do not hand-roll try/catch in routes.
- Do not create abstractions without a real domain boundary behind them.

---

## CODING RULES

- TypeScript strict mode is on (`tsconfig.json`). No new `any`; no `@ts-ignore`.
- Avoid unsafe casts (`as unknown as X` outside the three established `globalThis` singletons).
- Reuse existing abstractions before creating new ones (see [docs/HANDOFF.md](docs/HANDOFF.md)
  for the list). Duplicated business logic is a bug.
- Keep components focused; extract feature components under `src/features/<domain>/`.
- Use semantic domain types from `src/types/domain.ts`; do not re-invent string unions that
  already exist there.
- Validate all external input with Zod (shared constants like `ENVIRONMENTS`, `CHAIN_NETWORKS`
  should drive schemas).
- Errors: services throw typed `AppError` subclasses from `src/server/core/errors.ts`
  (`NotFoundError`, `ConflictError`, `ValidationError`, `InvalidTransitionError`,
  `PolicyBlockedError`). Routes map them via `errorResponse()` — never leak stack traces.
- Avoid new dependencies unless genuinely necessary; prefer extending existing utilities
  (`src/lib/format.ts`, `src/lib/utils.ts`).

---

## PROVIDER RULES

External systems must sit behind port interfaces (`src/server/core/ports/`) with adapter
implementations (`src/server/adapters/`). Existing example: `RepositoryAnalyzer` port with
`MockRepositoryAnalyzer`. Planned ports (do not create until the phase that needs them):
`DeploymentProvider`, `TelemetryProvider`, `ChainProvider`, `AIProvider`, `PolicyEngine`.

- Mock/simulated implementations must be clearly identified: adapter field `isDemo`, result
  field `source: "demo-analysis"`, plus UI banners explaining the simulation.
- Never represent simulated infrastructure as real. Never claim a mock contacted GitHub,
  Kubernetes, an RPC endpoint, or an LLM.

---

## STATE MACHINE RULES

Critical workflows use explicit, table-driven state transitions in
`src/server/core/domain/state-machines.ts` (deployment, incident already exist).

- Invalid transitions must be rejected (`InvalidTransitionError`), never silently coerced.
- New workflows (analysis already follows this spirit; chaos, remediation next) must define
  their transitions as pure functions with unit tests before building UI.

---

## SECURITY RULES

Never:

- expose secrets or log sensitive values (the demo dataset contains no real secrets; keep it so)
- hardcode credentials or API keys (there are no env vars or secrets in v0 — keep it that way)
- execute arbitrary AI-generated shell commands (future remediation must be allowlisted actions
  gated by a policy engine)
- trust unvalidated external input (all request bodies/queries go through Zod)
- bypass the service layer from UI, or read/write repositories from client components
- introduce `eval`, dynamic code execution, or unsanitized HTML injection

AI recommendations must never directly execute dangerous actions — approval and policy checks
are mandatory before any destructive operation (see `PolicyBlockedError` for the intended flow).

---

## PERFORMANCE RULES

- Prefer Server Components; `"use client"` only for genuine interactivity (existing pattern:
  forms, dialogs, polling panels, command palette).
- No duplicated data fetching: pages call a service once and pass data down; client polling
  exists only where state actually moves (analysis progress panel pattern).
- No unnecessary effects; no expensive computation inside render. Derived lists belong in
  services (e.g., `ProjectService.getDetail()` returns one bundle).
- Watch DOM size: large tables/logs must use server-side pagination (`DeploymentService.list`
  paginates) or virtualization before shipping.

---

## TESTING RULES

- Critical business logic must have deterministic vitest tests in `tests/`:
  state machines, SLO/error-budget math, PRNG determinism, validation schemas, service logic.
- Tests must not depend on global mutable state — construct services with isolated
  in-memory repositories, or stub the store module (see `tests/project-service.test.ts`,
  `tests/analysis-service.test.ts` for the patterns).
- New domain logic ships with tests in the same change.

---

## DEVELOPMENT RULES

Before modifying existing code:

1. Inspect it (read the file and its callers).
2. Understand its dependencies and tests.
3. Preserve working functionality.
4. Make focused changes.
5. Run `npm test`.
6. Run `npx tsc --noEmit`.
7. Run `npm run lint`.
8. Review the diff.
9. Fix any introduced problems.

Do not rewrite unrelated modules. Do not silently remove existing functionality. Do not commit
unless explicitly asked.

## PHASE RULE

Only implement the phase explicitly requested by the user. Do not automatically continue into
future phases, and do not "finish" other placeholders opportunistically. The roadmap sequence
lives in [docs/ROADMAP.md](docs/ROADMAP.md).
