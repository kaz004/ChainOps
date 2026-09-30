# ChainOps AI — Architecture (as actually implemented)

This document describes the codebase as it exists today (after Phase 12), not the aspirational
design. The original design documents `docs/00-*` … `docs/05-*` remain useful for intent, but
this file is the source of truth for what is real.

Reality markers: **REAL** (works end-to-end), **MOCKED** (deterministic fake data, labeled),
**SIMULATED** (fake runtime behavior with realistic progression), **PLACEHOLDER** (UI exists,
states "coming in a later phase"), **NOT IMPLEMENTED** (nothing exists).

---

## 1. Stack & tooling (REAL)

- **Framework:** Next.js 15.5 (App Router, React 19), TypeScript 5.9 strict mode
  (`noUncheckedIndexedAccess` on).
- **Styling:** Tailwind CSS 3.4 with CSS-variable design tokens (dark-first, `class` dark mode);
  PostCSS + autoprefixer. shadcn-style hand-rolled primitives over Radix UI.
- **Package manager:** npm (package-lock.json present; no workspace/monorepo).
- **Runtime:** Node 22 (dev machine); Next.js server runtime for all server code.
- **Testing:** Vitest 3 (node environment), tests in `tests/*.test.ts`, alias `@` → `./src`.
- **Lint:** ESLint 9 flat config (`eslint.config.mjs`) with typescript-eslint + react-hooks.
- **No database, no ORM, no env vars, no auth provider, no Dockerfile, no deployment config.**
  GitHub Actions CI runs the test, type-check, lint, and production-build gates.

## 2. Folder structure (actual)

```text
src/
├── app/
│   ├── (app)/                    # authenticated-style shell group
│   │   ├── layout.tsx            # skip link + ShellFrame (server) + search/notifications data
│   │   ├── error.tsx, loading.tsx, not-found
│   │   ├── dashboard/page.tsx            # REAL (rendered from services + sim)
│   │   ├── projects/                     # REAL: list, new (form), [slug] (tabbed detail)
│   │   ├── deployments/                  # REAL simulated center + live detail/actions
│   │   ├── pipelines/                    # REAL simulated runs + deployment handoff
│   │   ├── settings/page.tsx             # REAL (demo reset works)
│   │   ├── chains/page.tsx                 # simulated Chain Center
│   │   └── {infrastructure,postmortems,runbooks}/page.tsx # placeholders
│   ├── api/                      # route handlers (thin; see §6)
│   ├── layout.tsx                # fonts, theme init script, AppProviders
│   ├── page.tsx                  # redirect → /dashboard
│   └── globals.css               # design tokens (REAL)
├── components/                   # design system (REAL, domain-agnostic)
│   ├── ui/                       # button, card, badge, status, table, dialog, dropdown,
│   │                             # tabs, input, textarea, label, skeleton, separator,
│   │                             # copy-button, toast (zustand store + viewport)
│   ├── layout/                   # app-shell (client, nav + Radix drawer), topbar (client),
│   │                             # shell-frame (server bridge), command-palette (cmdk),
│   │                             # page-header, placeholder-page, app-providers (theme+RQ)
│   ├── theme/theme-provider.tsx  # client context + localStorage, no flash
│   └── feedback/                 # states (Empty/Error), page-skeletons, not-found-card
├── features/                     # domain-flavored composition (server unless interactive)
│   ├── dashboard/                # summary-tiles, service-health-table, side-rail,
│   │                             # activity-timeline  (all server components)
│   ├── projects/                 # project-form (client), archive-controls (client),
│   │                             # analysis-panel (client, polling), project-tabs (server)
│   ├── slo/slo-status-badge.tsx
│   └── incidents/incident-controls.tsx
├── lib/
│   ├── api/with-route.ts         # REAL: withRoute/withQuery/withParams/withParamsAndBody
│   ├── api/response.ts           # REAL: ok/fail/errorResponse envelope
│   ├── format.ts, utils.ts, navigation.ts   # navigation = plain data (icon keys only)
├── server/                       # NEVER imported by client code
│   ├── container.ts              # composition root (globalThis singleton)
│   ├── core/
│   │   ├── domain/state-machines.ts   # deployment + incident tables, DEPLOYMENT_STEPS
│   │   ├── domain/slo.ts              # errorBudgetRemainingPct/burnRate/computeErrorBudget
│   │   ├── domain/ids.ts              # business-ID counters (resettable)
│   │   ├── errors.ts                  # AppError hierarchy
│   │   ├── ports/                    # analyzer, deployment, telemetry ports
│   │   └── simulation/                # clock (60× virtual), prng (mulberry32),
│   │                                  # sample (metric sampler), engine, singleton
│   ├── adapters/simulated/                        # analyzer, deployment, telemetry, chain, AI, remediation adapters
│   ├── repositories/              # store.ts (Repos aggregate + globalThis guard),
│   │                              # in-memory.ts (generic), project-repository.ts,
│   │                              # analysis-job-repository.ts, activity.ts, types.ts
│   ├── seed/demo-data.ts          # deterministic dataset (fixed epoch T0)
│   └── services/                  # application services (see §5)
└── types/domain.ts                # ALL entity/enum types
tests/                             # 15 vitest files, 107 tests
docs/                              # this file + roadmap/domain-models/development/handoff
                                   # + legacy design docs 00–05
```

## 3. Data flow (actual)

1. **Server render:** `app/(app)/**/page.tsx` (Server Components) call
   `getContainer().<service>.<method>()` directly for first paint. No HTTP hop.
2. **Client interactivity:** client feature components (`analysis-panel`, `project-form`,
   `archive-controls`) call `/api/...` via `fetch`; TanStack Query is installed and provided
   (`AppProviders`) but polling currently uses a small `useEffect` + `setInterval` pattern.
3. **API routes:** validate via `lib/api/with-route.ts` wrappers (Zod + 16 KB body guard +
   requestId + error mapping), delegate to services, return `ok(data, meta)` envelopes.
4. **Services:** own business logic; use repositories (`getRepos()`), the simulation engine,
   and domain modules; throw typed `AppError`s; append activity events.
5. **Simulation:** `SimulationEngine` singleton generates metric snapshots from per-entity
   seeded state; `MockRepositoryAnalyzer` produces analyses from deterministic demo metadata.

## 4. Persistence (MOCKED, by design)

- **Everything is in-memory**, guarded on `globalThis` so Next dev HMR and multiple route
  modules share one dataset: `store.ts` (`Repos`), `container.ts` (`Container`),
  simulation singleton. **Data resets on server restart.**
- `POST /api/demo/reset` re-seeds everything (works from Settings UI).
- Generic `InMemoryRepository<T>` plus typed `InMemoryProjectRepository` and
  `InMemoryAnalysisJobRepository`; `ActivityStore` is append-only.
- A SQL/Drizzle adapter can replace these behind the same interfaces; services were written
  against `ProjectRepository`/`AnalysisJobRepository` ports (other services still reach the
  store directly — see the known problems in [HANDOFF.md](HANDOFF.md).

## 5. Services (REAL logic over MOCKED data)

| Service | What it actually does |
|---|---|
| `DashboardService` | Aggregates one dashboard payload: sim service snapshots (blast-radius aware), recent deployments, chain status, activity, open incidents, computed SLO compliance (inverse budget formula) + avg error budget. |
| `ProjectService` | Full project CRUD w/ Zod schemas; slug rename propagates to deployments/incidents/activity; archive/restore w/ idempotency; `listSummaries` (SLO health rollup via injected `evaluateSlos`); `getDetail` bundle incl. project-scoped activity. |
| `DeploymentService` | Filtered/paginated list, get by ID/business ID, project list, creation, guarded status actions, retry and rollback. Settles deployment progression through the injected simulated provider and writes activity/log history. |
| `PipelineService` | Deterministic 11-stage CI simulation, stage failure/retry/cancel, run history and deployment handoff after Production success. |
| `TelemetryService` | Validates explorer filters and returns bounded deterministic metrics, health, trace/log correlation from the simulated provider. |
| `IncidentService` | Alert/SLO telemetry evaluation, deduplicated alert→incident creation, filtered list, correlated detail bundle, guarded transitions and alert resolution. |
| `ChaosService` | Allowlisted, bounded simulated fault runs; production confirmation; blast-radius checks; shared telemetry effects; abort/expiry cleanup and incident promotion. |
| `AIService` | Evidence assembly for incident RCA, summaries, postmortems and deployment risk; provider outputs are schema-validated and advisory only. |
| `RemediationService` | Policy evaluation, role-checked approval, allowlisted simulated execution, verification and audit trail. |
| `SloService` | Computes request-weighted SLI and `ErrorBudget` from simulated telemetry; healthy/at-risk/breached (14.4× fast-burn rule); production deploy policy input. |
| `ChainService` | Reads the `ChainProvider` port for four-network snapshots, simulated block progression, seeded gas estimates, weighted RPC health and provider status. |
| `NotificationService` | List/unread count/mark-read. |
| `AnalysisService` | Start (dedupe in-flight, refuse archived), settle-on-read staged progression (6 stages × 1.5 s), materializes analyzer result at completion, history. |

## 6. API surface (actual routes)

```text
GET   /api/dashboard                     GET   /api/projects           (summaries)
GET   /api/chains                        POST  /api/projects           (create)
GET   /api/health (liveness+engine)      GET   /api/projects/[id]      (detail bundle)
GET   /api/ready   (seeded check)        PATCH /api/projects/[id]      (partial update)
GET   /api/deployments (paginated)       POST  /api/projects/[id]/archive
POST  /api/deployments (create queued)   POST  /api/deployments/[id] (cancel/retry/rollback)
GET   /api/deployments/[id] (settled)    POST  /api/projects/[id]/restore
GET/POST /api/pipelines                 GET/POST /api/pipelines/[id]
GET   /api/observability (filtered)     GET   /api/slos (list or id query)
GET/POST /api/incidents                 GET/POST /api/incidents/[id]
GET/POST /api/chaos                     GET/POST /api/chaos/[id]
GET/POST /api/remediations              GET/POST /api/remediations/[id]
POST  /api/demo/reset                    POST  /api/projects/[id]/analysis (start, 202)
                                         GET   /api/projects/[id]/analysis (latest, settled)
```

Envelope: `{ data, meta? }` or `{ error: { code, message, requestId } }`. Codes: `VALIDATION_ERROR`,
`NOT_FOUND`, `INVALID_TRANSITION`, `POLICY_BLOCKED`, `CONFLICT`, `INTERNAL`. 413 on >16 KB bodies.
**Real authentication: NOT IMPLEMENTED.** Remediation role checks use seeded demo roles and
the API's fixed demo owner; this is not a production security boundary.

## 7. Simulation engine (SIMULATED, deterministic)

- `clock.ts`: virtual time at 60× real time from a process-start epoch (`simNow`, `simNowMs`).
  Note: only `engine.status()` currently reports sim time; metric sampling buckets by real time.
- `prng.ts`: mulberry32 + FNV-style seed hashing; determinism unit-tested.
- `sample.ts`: `sampleNow(entityId, kind, profile, failure)` — 5-minute correlation buckets,
  baseline profiles, failure multipliers. `MetricPoint` type exists but no series endpoint yet.
- `engine.ts`: registry of services (baseline profiles) and chain failures
  (`injectRpcFailure("rpc-base-b")` seeded → Base degraded). `serviceSnapshot()` derives
  HealthStatus from sampled error rate/latency. `tick()` only counts;
  a 1 s `setInterval` runs unref'd.
- Blast-radius rule (duplicated in Dashboard/SLO services): open incidents fully affect their
  `serviceIds`; other chain-touching services get a mild bump.

## 8. What is REAL / MOCKED / SIMULATED / PLACEHOLDER / NOT IMPLEMENTED

**REAL (local application behavior):** design system & shell (theme, palette, drawer, toasts),
project CRUD + archive + filters + forms, project detail tabs (Overview/Analysis/Activity/Settings),
analysis job lifecycle & progress UI, deployment and pipeline create/list/detail/actions, incident
alert/detection/transition and correlated detail flows, SLO evaluation/deployment gating and dashboard aggregation,
API envelope & validation & error mapping, demo reset, health/ready endpoints.

**MOCKED (deterministic fake data, labeled):** entire seed dataset (projects, services,
deployments, incidents, chains, providers, SLOs, notifications, activity, one analysis job);
`MockRepositoryAnalyzer` results (`source: "demo-analysis"`; banner in UI).

**SIMULATED (fake runtime behavior):** service health telemetry and metrics/logs/traces
(five-minute deterministic samples, including project-to-chain failure propagation), chain block
progress and RPC failover, seeded gas estimates, analysis, deployment and pipeline progression
(staged settle-on-read), controlled demo failures, canary traffic weights, rollback, deterministic
Demo AI, chaos runs and policy-gated remediation. No external AI, telemetry, CI, deployment,
blockchain, or RPC infrastructure is contacted.

**PLACEHOLDER (UI exists, explicitly says "soon"):** Infrastructure, Runbooks,
Postmortems (4 pages) + 8 of the 11 project-detail tabs.

**NOT IMPLEMENTED:** real auth/authz, real database, real deployment/CI integrations, external
alerting integrations, real AI or infrastructure integrations, runbooks, real
repository/LLM/K8s/RPC integrations, env vars,
Docker or production deployment config. GitHub Actions CI is configured for repository checks,
not for deployment.

## 9. Configuration & build

- **Environment variables: none.** No `.env` handling exists; nothing reads `process.env` in
  `src/`. Introducing config later should use `NEXT_PUBLIC_*` sparingly and server-only vars.
- **Build/deploy:** `npm run build` produces a standard `.next` production build; `npm start`
  serves it. **Demo state is in-process memory — a long-lived `next start` is required for the
  demo to persist; serverless/edge or multi-instance deploys would lose/reset state.**
  GitHub Actions CI validates changes but does not deploy the app. No Dockerfile or platform
  deployment configuration exists.
