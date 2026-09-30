# ChainOps AI — Engineering Handoff

**Read this first, then [AGENTS.md](../AGENTS.md) (rules),
[docs/ARCHITECTURE.md](ARCHITECTURE.md) (how it actually works),
[docs/DOMAIN-MODELS.md](DOMAIN-MODELS.md) (entity shapes), [docs/DEVELOPMENT.md](DEVELOPMENT.md)
(commands).** Everything here is verified against the local working tree.

---

## WHAT HAS BEEN DONE

### Phase 1 — Foundation — COMPLETED
- Next.js 15 App Router + React 19 + TypeScript 5.9 strict; Tailwind 3.4 with a CSS-variable
  token design system (dark-first), hand-rolled shadcn-style primitives over Radix; app shell
  (sidebar nav, topbar with search/notifications, ⌘K command palette, toasts, theme toggle).
- All domain types in `src/types/domain.ts`; pure domain modules (`state-machines.ts`,
  `slo.ts`, `ids.ts`); `AppError` hierarchy; deterministic seed dataset (fixed epoch
  `2026-09-30T12:00:00Z`, seeded PRNG, no `Math.random`); simulation skeleton: 60× virtual
  clock, mulberry32 PRNG, metric sampler, engine singleton.
- 11 secondary pages render `PlaceholderPage` ("coming in a later phase"); dashboard is real.
- 43 tests passing at that phase's scope (suite is now 73).

### Phase 2 — Project Management — COMPLETED
- Full project CRUD + archive/restore with Zod validation, slug rules and rename propagation
  (deployments/incidents/activity follow the slug), idempotent archive, search/filter,
  paginated summaries with SLO health rollup.
- Project detail page with Overview / Analysis / Activity / Settings tabs; create form
  (react-hook-form + zodResolver); API: `GET/POST /api/projects`, `GET/PATCH
  /api/projects/[id]`, `POST /api/projects/[id]/archive`.
- `ActivityStore` append-only audit log wired into services; 27 project-service tests.

### Phase 3 — Repository Analyzer — COMPLETED
- `RepositoryAnalyzer` port (`src/server/core/ports/repository-analyzer.ts`) with Zod-validated
  result schemas + `ANALYSIS_STAGES`; `MockRepositoryAnalyzer` simulated adapter (the only
  adapter), clearly flagged (`source: "demo-analysis"`, UI simulation banners).
- `AnalysisService`: start (dedupe in-flight, refuse archived projects), settle-on-read staged
  progression — 6 stages advancing every `STAGE_ADVANCE_MS = 1500` ms of **real time**, read
  advances the job and materializes the analyzer result at completion; history listing.
- Project detail Analysis tab: start/cancel, live stage progress via client polling
  (`useEffect` + `setInterval`), results rendering. API: `POST /api/projects/[id]/analysis`
  (start, 202) and `GET /api/projects/[id]/analysis` (latest, settled).
- 15 repository-analyzer + 8 analysis-service tests.

### Gates at handoff (verified)
The current full suite contains **107 tests across 15 files**. Phase verification is recorded in the roadmap.

---

## CURRENT STATE (after Phase 12)

- Phases 1–12 are implemented: foundation, project management, repository analysis, deployment,
  pipeline, simulated observability, telemetry-derived SLO/error budgets, incident response,
  bounded simulated chaos, structured Demo AI, audited policy-gated simulated remediation, and
  simulated multichain provider health/recovery.
  State remains in an **in-memory seeded store**.
- `DeploymentService` uses `MockDeploymentProvider` with settle-on-read progression. The
  deployment center supports creation, filtering, live progress, cancellation, retry, rollback,
  logs and canary weights. Demo failures are explicitly selected. No real repository, build
  service, or infrastructure is contacted.
- Authentication/authorization, database persistence and real provider integrations remain
  unimplemented. State resets on server restart.

---

## NEXT PHASE — Phase 13: Runbooks

Continue with the next roadmap phase only when explicitly requested. Chain Center is implemented
through the `ChainProvider` port and simulated adapter; no live provider integration is present.

The following Phase 4 checklist is historical planning context; Phase 4 is implemented as
described in the current-state summary above.

Integration points (all exist and are tested — reuse, don't recreate):

1. **State machine:** `DEPLOYMENT_TRANSITIONS`, `canTransitionDeployment`,
   `transitionDeployment`, `isDeploymentActive`, canonical `DEPLOYMENT_STEPS` (10 steps) in
   [src/server/core/domain/state-machines.ts](../src/server/core/domain/state-machines.ts).
   Legal paths include queued→running→canary→verifying→success, running→failed→rollback_pending→
   rolling_back→rolled_back, and cancellation from queued/running/canary.
2. **Service:** `DeploymentService.create` already builds a queued deployment with canonical
   pending steps; `DeploymentService.transition` already enforces the machine. Extend with
   progression (step completion, canary weight shifts on `Deployment.canary`, auto-rollback on
   failure per seed scenario dep-1039/dep-1041) rather than a parallel service.
3. **Simulation engine:** the singleton in `src/server/core/simulation/` is where `tick()`
   belongs. Today `tick()` only counts ticks (see Known Problems). Add deployment progression
   there or a sibling driver, keeping it deterministic (seeded PRNG, virtual clock), and keep
   the engine readable from services via the container.
4. **Activity & notifications:** append `ActivityEvent`s (kinds: `deployment`) and create
   `Notification`s at meaningful transitions (canary started/completed, failed, rolled back),
   matching seed-event style.
5. **API:** `GET /api/deployments` (paginated list) already exists. Add write routes using the
   existing `withParamsAndBody` wrapper + envelope; deployment creation from the UI should go
   through `POST /api/deployments` (project/service/version/gitSha validated with Zod).
6. **UI:** the deployments list page is a `PlaceholderPage`; replace it with a real list
   (reuse table/badge/status components) and extend the read-only
   `deployments/[id]` page with step timeline and canary display.
7. **Tests:** extend the state-machine/service tests: valid/invalid transition tables,
   progression determinism (virtual clock), canary shift math, rollback path, cancellation.
   Keep the settle-on-read or virtual-time pattern consistent with `AnalysisService`.

Do **not** invent real deployment providers (K8s/GitHub Actions) in Phase 4 — that is a later
port/adapter. Keep `Workspace.mode: "simulation"` labeling rules.

---

## IMPORTANT EXISTING ABSTRACTIONS (reuse these)

- **Route wrappers** [src/lib/api/with-route.ts](../src/lib/api/with-route.ts):
  `withRoute`, `withQuery(schema)`, `withParams(schema)`, `withParamsAndBody(schema)` —
  Zod validation, 16 KB body cap, requestId, error mapping. **Response envelope**
  [src/lib/api/response.ts](../src/lib/api/response.ts): `ok(data, meta)` / `errorResponse`
  with codes `VALIDATION_ERROR | NOT_FOUND | INVALID_TRANSITION | POLICY_BLOCKED | CONFLICT |
  INTERNAL`. Never hand-roll try/catch in routes.
- **Error hierarchy** `src/server/core/errors.ts`: `AppError` base with
  `NotFoundError`, `ValidationError`, `ConflictError`, `InvalidTransitionError`,
  `PolicyBlockedError` — throw these from services; wrappers map to codes.
- **Repositories:** generic `InMemoryRepository<T>` +
  `InMemoryProjectRepository`/`InMemoryAnalysisJobRepository` behind
  `ProjectRepository`/`AnalysisJobRepository` ports ([src/server/repositories/](../src/server/repositories/)).
  `ActivityStore` for append-only events. Access via `getRepos()`.
- **Container:** `src/server/container.ts` — the only composition root (`getContainer()`).
  Add new services there; never import repos/adapters from UI.
- **Ports/adapters pattern:** `RepositoryAnalyzer` port + `MockRepositoryAnalyzer` in
  `src/server/adapters/simulated/` — copy this shape for future providers
  (`isDemo` flag + provenance field in results).
- **Domain pure functions:** `state-machines.ts` (both machines + `DEPLOYMENT_STEPS`),
  `slo.ts` (`errorBudgetRemainingPct`, `burnRate`, `computeErrorBudget`, `clamp`),
  `ids.ts` (`nextBusinessId`, `seedCounter`, `resetCounters` — counters seeded from
  `COUNTER_SEED`).
- **Simulation core:** `src/server/core/simulation/` — virtual clock (60×), mulberry32 PRNG,
  metric sampler, engine singleton; `simNow`/`simNowMs` consumed by `engine.ts`; metric
  buckets are sampled against real time.
- **Settle-on-read pattern:** `AnalysisService.getById` advances stage progress on read
  (`STAGE_ADVANCE_MS`) — the established deterministic alternative to background timers;
  reuse for progress-style features.
- **UI kit:** `src/components/ui/*` (button, card, badge, status, table, dialog, tabs,
  toast…), `PageHeader`, `PlaceholderPage`, `EmptyState`, `ErrorState`, feature composition
  under `src/features/<domain>/`. Icon names come only from `lib/navigation.ts` (plain data —
  no components across the RSC boundary).
- **Seed:** `src/server/seed/demo-data.ts` exports the full dataset + `COUNTER_SEED` +
  `initCounters()`; `POST /api/demo/reset` re-seeds.

---

## KNOWN PROBLEMS (technical debt, verified)

1. **No real auth.** No session, no `requireUser`, no auth code anywhere. The actor "Adrian
   Vale" is hardcoded in `DeploymentService.create` and default actor parameters. Phase 4/5
   should thread a real actor or at least centralize the constant.
2. **Cross-aggregate store access.** Only projects and analysisJobs have repository ports;
   deployment/incident/SLO/chain services reach into `getRepos()` arrays directly. Extract
   repositories per aggregate when those phases start.
3. **Duplicated `paramsSchema`** in every dynamic API route (`{ id: string }` re-declared per
   file) — a shared constant would do.
4. **`zodResolver(... as never)`** cast in `src/features/projects/project-form.tsx` (RHF
   resolver typing workaround).
5. **`rawParams.data as P`** cast inside `withParamsAndBody` (handler-generic workaround).
6. **Three `globalThis as unknown as` singleton casts** (store, simulation engine, container) —
   intentional HMR pattern; don't multiply them.
7. **`SimulationEngine.tick()` only increments a counter.** Deployment progression follows the
   settle-on-read pattern and does not currently depend on engine ticks.
8. **Deployment history UI currently loads the first 50 entries.** The API supports paginated
   queries; client-side pagination should be added if demo volume grows beyond that bound.
9. **`DashboardService` hardcodes the greeting "1 incident investigating"** instead of
   deriving it from incident state.
10. **`DashboardService` hardcodes "simulated" mode labels** instead of reading
    `Workspace.mode`; benign now, but a trap when modes become real.
11. **Blast-radius rule duplicated** between DashboardService and SloService (chain-touching
    services degraded during chain incidents) — extract a shared domain helper when Phase 7
    touches it.
12. **TanStack Query v5 is installed and provided but effectively unused** — polling uses
    `useEffect` + `setInterval`; either adopt RQ or remove it eventually.
13. **No component/E2E tests** — the 73 tests cover server domain logic only.

---

## CRITICAL WARNINGS

1. **In-memory persistence.** All state lives on `globalThis` singletons; **every server
   restart wipes state** back to the deterministic seed. Don't add durable expectations
   without introducing a real persistence layer behind the repository ports.
2. **Settle-on-read is time-based.** `AnalysisService` advances on wall-clock reads
   (1.5 s/stage). Any change to it must keep tests deterministic (no unbounded real-time
   waits in tests).
3. **RSC serialization boundary.** Pages are React Server Components; **no functions,
   class instances, or components may cross into client components** — pass plain data, and
   icon *names* only (resolved via `lib/navigation.ts`). Client components exist only under
   `src/features/` (form/panel/controls) and `src/components/layout/`.
4. **`src/server/**` must never be imported from client code** — it would leak the
   container/store into the browser bundle. The `server/` split is enforced by convention.
5. **State machines are law.** Use `canTransitionDeployment`/`canTransitionIncident`; never
   assign status fields directly in services; invalid transitions must throw
   `InvalidTransitionError` (API → 409 INVALID_TRANSITION).
6. **Label simulation honestly.** Every simulated capability carries
   `mode: "simulation"` / `source: "demo-analysis"` / `isDemo` markers and UI banners. Never
   present simulated infra as real, and never name adapters as if they contact real systems.
7. **Validation & envelopes are not optional.** All external input goes through Zod via the
   `with-*` wrappers; all responses use the `ok`/`fail` envelope; services throw typed
   `AppError`s. New routes that bypass this break error handling app-wide.
8. **Don't touch `globalThis` singleton guards** in store.ts / engine / container.ts — they
   exist so Next dev HMR keeps one dataset; removing them causes duplicate-state bugs.
9. **Determinism rules:** seed is fixed-epoch, PRNG is mulberry32, tests set `TZ=UTC` and
   mock the store with `fixtures.reset()`. Never introduce `Math.random` or wall-clock
   dependence into domain/simulation code.
10. **Tooling gotchas:** Tailwind is **v3** (config in `tailwind.config.ts`, tokens as CSS
    variables in `globals.css`; do not upgrade to v4 semantics); `verbatimModuleSyntax` is on
    (use `import type` for type-only imports; lint enforces inline `type` imports);
    `noUncheckedIndexedAccess` makes array/record indexing `T | undefined` — handle it.
11. **Scope discipline:** implement phases sequentially and do not carry unresolved critical
    issues into the next phase.
